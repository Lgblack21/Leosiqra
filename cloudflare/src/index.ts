import { authenticator } from "otplib";

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  ASSETS?: R2Bucket;
  REALTIME_ROOM: DurableObjectNamespace;
  AI?: Ai;
  APP_NAME: string;
  APP_ENV: string;
  APP_URL: string;
  SESSION_COOKIE_NAME: string;
  SESSION_SECRET: string;
  DEFAULT_FREE_PLAN_DAYS?: string;
  MAINTENANCE_BYPASS_ADMIN?: string;
  GEMINI_API_KEY?: string;
  AI_PROVIDER?: string;
  R2_PUBLIC_BASE_URL?: string;
}

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  plan: "FREE" | "PRO";
  status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
  whatsapp?: string | null;
  two_factor_secret?: string | null;
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });

const text = (body: string, init: ResponseInit = {}) =>
  new Response(body, init);

const jsonWithCookies = (data: unknown, cookies: string[], init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
};

const parseJson = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Payload JSON tidak valid.");
  }
};

const generateId = () => crypto.randomUUID();

const nowIso = () => new Date().toISOString();

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

const sha256Hex = async (value: string) => {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const createSessionToken = async (env: Env, sessionId: string) => {
  const payload = `${sessionId}.${env.SESSION_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return `${sessionId}.${toBase64Url(digest)}`;
};

const sessionCookie = (env: Env, token: string, maxAgeSeconds: number) =>
  `${env.SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

const roleCookie = (env: Env, role: AppUser["role"], maxAgeSeconds: number) =>
  `${env.SESSION_COOKIE_NAME}_role=${role}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

const clearSessionCookie = (env: Env) =>
  `${env.SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const clearRoleCookie = (env: Env) =>
  `${env.SESSION_COOKIE_NAME}_role=; Path=/; Secure; SameSite=Lax; Max-Age=0`;

const getCookieValue = (request: Request, name: string) => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const rawCookie of cookieHeader.split(";")) {
    const [key, ...valueParts] = rawCookie.trim().split("=");
    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
};

const hashPassword = async (password: string) => sha256Hex(`leosiqra::${password}`);

const verifyPassword = async (password: string, passwordHash: string) => {
  const hashed = await hashPassword(password);
  return hashed === passwordHash;
};

const createSession = async (env: Env, request: Request, user: AppUser) => {
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const ipAddress =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    null;
  const userAgent = request.headers.get("user-agent");

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, role, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, user.id, user.role, expiresAt, ipAddress, userAgent)
    .run();

  return {
    token: await createSessionToken(env, sessionId),
    expiresAt,
  };
};

const readSession = async (env: Env, request: Request) => {
  const token = getCookieValue(request, env.SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const [sessionId, providedSignature] = token.split(".");
  if (!sessionId || !providedSignature) {
    return null;
  }

  const expected = await createSessionToken(env, sessionId);
  if (expected !== token) {
    return null;
  }

  const result = await env.DB.prepare(
    `SELECT s.id as session_id, s.user_id, s.role, s.expires_at,
            u.name, u.email, u.plan, u.status, u.whatsapp, u.two_factor_secret
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
  )
    .bind(sessionId)
    .first<{
      session_id: string;
      user_id: string;
      role: "admin" | "user";
      expires_at: string;
      name: string;
      email: string;
      plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
      whatsapp?: string | null;
      two_factor_secret?: string | null;
    }>();

  if (!result || new Date(result.expires_at).getTime() <= Date.now()) {
    if (result?.session_id) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(result.session_id).run();
    }
    return null;
  }

  await env.DB.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(result.session_id)
    .run();

  return {
    sessionId: result.session_id,
    user: {
      id: result.user_id,
      role: result.role,
      email: result.email,
      name: result.name,
      plan: result.plan,
      status: result.status,
      whatsapp: result.whatsapp,
      two_factor_secret: result.two_factor_secret,
    } satisfies AppUser,
  };
};

const requireSession = async (env: Env, request: Request, requiredRole?: "admin" | "user") => {
  const session = await readSession(env, request);
  if (!session) {
    return { error: json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (requiredRole === "admin" && session.user.role !== "admin") {
    return { error: json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
};

const sanitizeMaintenanceHtml = (unsafeHtml?: string | null) => {
  if (!unsafeHtml) {
    return "";
  }

  return unsafeHtml
    .replaceAll(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replaceAll(/\son\w+="[^"]*"/gi, "")
    .replaceAll(/\son\w+='[^']*'/gi, "");
};

const getMaintenanceSettings = async (env: Env) =>
  env.DB.prepare(
    `SELECT
      id,
      maintenance_is_active,
      maintenance_type,
      maintenance_code,
      maintenance_image_url
     FROM admin_settings
     WHERE id = 'global'
     LIMIT 1`
  ).first<{
    id: string;
    maintenance_is_active: number;
    maintenance_type: string | null;
    maintenance_code: string | null;
    maintenance_image_url: string | null;
  }>();

const buildUserContext = async (env: Env, userId: string) => {
  const [accounts, transactions, budgets, investments, savings] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, type, currency, balance FROM accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5"
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT type, amount, category, note, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20"
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT category, amount, period FROM budgets WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT name, type, current_value_idr, return_percentage FROM investments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT description, amount_idr, date FROM savings WHERE user_id = ? ORDER BY date DESC LIMIT 10"
    )
      .bind(userId)
      .all(),
  ]);

  return {
    accounts: accounts.results,
    transactions: transactions.results,
    budgets: budgets.results,
    investments: investments.results,
    savings: savings.results,
  };
};

const runAiAssistant = async (env: Env, prompt: string, userContext: unknown) => {
  const intro =
    "Anda adalah AI assistant finansial Leosiqra. Jawab dalam Bahasa Indonesia, ringkas, aman, dan jangan memberi janji keuntungan investasi.";

  if (env.AI) {
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: intro },
        {
          role: "user",
          content: `Konteks user:\n${JSON.stringify(userContext, null, 2)}\n\nPertanyaan:\n${prompt}`,
        },
      ],
    });

    const output = Array.isArray((response as { response?: string }).response)
      ? JSON.stringify((response as { response?: unknown }).response)
      : (response as { response?: string }).response;

    return output ?? "Maaf, saya belum bisa memproses pertanyaan Anda saat ini.";
  }

  return "AI binding belum dikonfigurasi. Simpan `GEMINI_API_KEY` atau binding `AI` di Cloudflare untuk mengaktifkan assistant.";
};

async function handleRegister(request: Request, env: Env) {
  const payload = await parseJson<{
    name?: string;
    email?: string;
    password?: string;
    whatsapp?: string;
    twoFactorSecret?: string;
  }>(request);

  if (!payload.name || !payload.email || !payload.password) {
    return json({ error: "Nama, email, dan password wajib diisi." }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(payload.email.toLowerCase())
    .first();

  if (existing) {
    return json({ error: "Email sudah terdaftar." }, { status: 409 });
  }

  const userId = generateId();
  await env.DB.prepare(
    `INSERT INTO users (
      id, name, email, password_hash, whatsapp, role, plan, status, two_factor_secret, currency_initialized
    ) VALUES (?, ?, ?, ?, ?, 'user', 'FREE', 'GUEST', ?, 0)`
  )
    .bind(
      userId,
      payload.name,
      payload.email.toLowerCase(),
      await hashPassword(payload.password),
      payload.whatsapp ?? null,
      payload.twoFactorSecret ?? null
    )
    .run();

  const user: AppUser = {
    id: userId,
    email: payload.email.toLowerCase(),
    name: payload.name,
    role: "user",
    plan: "FREE",
    status: "GUEST",
    whatsapp: payload.whatsapp ?? null,
    two_factor_secret: payload.twoFactorSecret ?? null,
  };

  const session = await createSession(env, request, user);

  return jsonWithCookies(
    {
      ok: true,
      user,
    },
    [
      sessionCookie(env, session.token, 60 * 60 * 24 * 30),
      roleCookie(env, user.role, 60 * 60 * 24 * 30),
    ],
    { status: 201 }
  );
}

async function handleLogin(request: Request, env: Env) {
  const payload = await parseJson<{
    email?: string;
    password?: string;
    twoFactorToken?: string;
  }>(request);

  if (!payload.email || !payload.password) {
    return json({ error: "Email dan password wajib diisi." }, { status: 400 });
  }

  const user = await env.DB.prepare(
    `SELECT id, name, email, password_hash, role, plan, status, whatsapp, two_factor_secret
       FROM users
      WHERE email = ?`
  )
    .bind(payload.email.toLowerCase())
    .first<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: "admin" | "user";
      plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
      whatsapp?: string | null;
      two_factor_secret?: string | null;
    }>();

  if (!user || !(await verifyPassword(payload.password, user.password_hash))) {
    return json({ error: "Email atau password tidak valid." }, { status: 401 });
  }

  if (user.two_factor_secret && !payload.twoFactorToken) {
    return json({ needsTwoFactor: true }, { status: 202 });
  }

  if (
    user.two_factor_secret &&
    payload.twoFactorToken &&
    !authenticator.check(payload.twoFactorToken, user.two_factor_secret)
  ) {
    return json({ error: "Kode 2FA tidak valid." }, { status: 401 });
  }

  const session = await createSession(env, request, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    status: user.status,
    whatsapp: user.whatsapp,
    two_factor_secret: user.two_factor_secret,
  });

  return jsonWithCookies(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
      },
    },
    [
      sessionCookie(env, session.token, 60 * 60 * 24 * 30),
      roleCookie(env, user.role, 60 * 60 * 24 * 30),
    ]
  );
}

async function handleMe(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const settings = await getMaintenanceSettings(env);
  return json({
    user: authResult.session.user,
    maintenance: settings
      ? {
          isActive: settings.maintenance_is_active === 1,
          type: settings.maintenance_type,
          code: sanitizeMaintenanceHtml(settings.maintenance_code),
          imageUrl: settings.maintenance_image_url,
        }
      : null,
  });
}

async function handleLogout(request: Request, env: Env) {
  const token = getCookieValue(request, env.SESSION_COOKIE_NAME);
  const sessionId = token?.split(".")[0];
  if (sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  return jsonWithCookies(
    { ok: true },
    [clearSessionCookie(env), clearRoleCookie(env)]
  );
}

async function handleListTransactions(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
  const rows = await env.DB.prepare(
    `SELECT *
       FROM transactions
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?`
  )
    .bind(authResult.session.user.id, limit)
    .all();

  return json({ items: rows.results });
}

async function handleCreateTransaction(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{
    type?: string;
    amount?: number;
    amount_idr?: number;
    category?: string;
    sub_category?: string;
    currency?: string;
    account_id?: string;
    target_account_id?: string;
    date?: string;
    display_date?: string;
    note?: string;
  }>(request);

  if (!payload.type || !payload.amount || !payload.date) {
    return json({ error: "type, amount, dan date wajib diisi." }, { status: 400 });
  }

  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, user_id, type, amount, amount_idr, category, sub_category, currency,
      account_id, target_account_id, date, display_date, note, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED')`
  )
    .bind(
      id,
      authResult.session.user.id,
      payload.type,
      payload.amount,
      payload.amount_idr ?? payload.amount,
      payload.category ?? null,
      payload.sub_category ?? null,
      payload.currency ?? "IDR",
      payload.account_id ?? null,
      payload.target_account_id ?? null,
      payload.date,
      payload.display_date ?? payload.date,
      payload.note ?? null
    )
    .run();

  const durableId = env.REALTIME_ROOM.idFromName(`member:${authResult.session.user.id}`);
  await env.REALTIME_ROOM.get(durableId).fetch("https://realtime.internal/publish", {
    method: "POST",
    body: JSON.stringify({
      event: "transaction.created",
      payload: { id, userId: authResult.session.user.id },
    }),
  });

  return json({ ok: true, id }, { status: 201 });
}

async function handleAdminSettings(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  if (request.method === "GET") {
    const settings = await env.DB.prepare("SELECT * FROM admin_settings WHERE id = 'global'").first();
    return json({ item: settings });
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const fields = Object.keys(payload);
  if (fields.length === 0) {
    return json({ error: "Payload tidak boleh kosong." }, { status: 400 });
  }

  const allowed = new Set([
    "billing_email",
    "whatsapp",
    "pro_price",
    "bank_name",
    "bank_account_name",
    "bank_number",
    "qris_text",
    "qris_url",
    "free_plan_days",
    "maintenance_is_active",
    "maintenance_type",
    "maintenance_code",
    "maintenance_image_url",
    "market_user_covered",
    "market_fx_update",
    "market_crypto_update",
    "market_stock_update",
    "market_last_update",
  ]);

  const sanitizedEntries = fields
    .filter((key) => allowed.has(key))
    .map((key) => [key, key === "maintenance_code" ? sanitizeMaintenanceHtml(String(payload[key] ?? "")) : payload[key]]);

  if (sanitizedEntries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = sanitizedEntries.map(([key]) => `${key} = ?`).join(", ");
  const values = sanitizedEntries.map(([, value]) => value);

  await env.DB.prepare(`UPDATE admin_settings SET ${assignments} WHERE id = 'global'`)
    .bind(...values)
    .run();

  await env.DB.prepare(
    "INSERT INTO admin_logs (id, admin_email, action, target, note, color) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      generateId(),
      authResult.session.user.email,
      "settings.update",
      "admin_settings",
      "Admin settings updated from Cloudflare Worker",
      "slate"
    )
    .run();

  return json({ ok: true });
}

async function handleAiChat(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ prompt?: string }>(request);
  if (!payload.prompt?.trim()) {
    return json({ error: "Prompt wajib diisi." }, { status: 400 });
  }

  const userContext = await buildUserContext(env, authResult.session.user.id);
  const answer = await runAiAssistant(env, payload.prompt, userContext);

  const existing = await env.DB.prepare("SELECT id, messages_json FROM ai_chats WHERE user_id = ?")
    .bind(authResult.session.user.id)
    .first<{ id: string; messages_json: string }>();

  const nextMessages = existing
    ? JSON.parse(existing.messages_json)
    : [];

  nextMessages.push(
    { role: "user", content: payload.prompt, createdAt: nowIso() },
    { role: "assistant", content: answer, createdAt: nowIso() }
  );

  if (existing) {
    await env.DB.prepare("UPDATE ai_chats SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(JSON.stringify(nextMessages), existing.id)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO ai_chats (id, user_id, messages_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(generateId(), authResult.session.user.id, JSON.stringify(nextMessages))
      .run();
  }

  return json({ answer, messages: nextMessages });
}

async function handleSignedUpload(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ fileName?: string; contentType?: string }>(request);
  const fileName = payload.fileName?.replace(/[^\w.-]/g, "_") ?? "upload.bin";
  const key = `payments/${authResult.session.user.id}/${Date.now()}-${fileName}`;

  return json({
    key,
    publicUrl: env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL}/${key}` : null,
    uploadStrategy: "Direct upload ke R2/Images perlu ditambahkan sesuai bucket policy. Endpoint ini sudah menyiapkan key yang tervalidasi.",
    contentType: payload.contentType ?? "application/octet-stream",
  });
}

async function handleRealtime(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const roomId = env.REALTIME_ROOM.idFromName(`member:${authResult.session.user.id}`);
  return env.REALTIME_ROOM.get(roomId).fetch(request);
}

export class RealtimeRoom extends DurableObject {
  private sessions = new Set<WritableStreamDefaultWriter>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/publish") {
      const body = await request.text();
      for (const writer of this.sessions) {
        await writer.write(`data: ${body}\n\n`);
      }
      return json({ ok: true });
    }

    if (url.pathname === "/sse") {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      this.sessions.add(writer);
      await writer.write(`event: ready\ndata: {"ok":true}\n\n`);

      request.signal.addEventListener("abort", () => {
        this.sessions.delete(writer);
        writer.close().catch(() => undefined);
      });

      return new Response(stream.readable, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    try {
      if (url.pathname === "/health") {
        return json({
          ok: true,
          app: env.APP_NAME,
          env: env.APP_ENV,
          now: nowIso(),
        });
      }

      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        return handleRegister(request, env);
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return handleLogin(request, env);
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        return handleMe(request, env);
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return handleLogout(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "GET") {
        return handleListTransactions(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "POST") {
        return handleCreateTransaction(request, env);
      }

      if (url.pathname === "/api/member/ai/chat" && request.method === "POST") {
        return handleAiChat(request, env);
      }

      if (url.pathname === "/api/member/uploads/sign" && request.method === "POST") {
        return handleSignedUpload(request, env);
      }

      if (url.pathname === "/api/admin/settings" && (request.method === "GET" || request.method === "PUT")) {
        return handleAdminSettings(request, env);
      }

      if (url.pathname === "/api/realtime" && request.method === "GET") {
        return handleRealtime(new Request("https://realtime.internal/sse", request), env);
      }

      return text("Not found", { status: 404 });
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "Unexpected error",
        },
        { status: 500 }
      );
    }
  },
};

export default worker;
