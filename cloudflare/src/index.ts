import { verifySync } from "otplib";
import { DurableObject } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  ASSETS: Fetcher;
  FILES_BUCKET?: R2Bucket;
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

const rewriteAuthRscPath = (pathname: string) => {
  const match = pathname.match(
    /^\/auth\/(login|register)\/(?:%20| )*_{0,2}next\.auth[./](login|register)(.*)$/i
  );
  if (!match) {
    return null;
  }

  const [, routeInPath, routeInFile, rawSuffix] = match;
  if (routeInPath !== routeInFile) {
    return null;
  }

  const suffix = rawSuffix.startsWith(".__PAGE__.txt")
    ? rawSuffix.replace(".__PAGE__.txt", "/__PAGE__.txt")
    : rawSuffix;

  return `/auth/${routeInPath}/__next.auth/${routeInFile}${suffix}`;
};

const buildDottedRscCandidates = (pathname: string, namespace: "membership" | "admin") => {
  const marker = `/__next.${namespace}.`;
  const idx = pathname.indexOf(marker);
  if (idx < 0) {
    return [];
  }

  const head = pathname.slice(0, idx);
  const dotted = pathname.slice(idx + marker.length).replace(/^_+/, "");
  const candidates: string[] = [];

  const pushUnique = (value: string) => {
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  // Direct nested mapping: __next.membership.foo.bar.txt -> __next.membership/foo/bar.txt
  if (dotted.endsWith(".__PAGE__.txt")) {
    const stem = dotted.slice(0, -".__PAGE__.txt".length);
    pushUnique(`${head}/__next.${namespace}/${stem.replaceAll(".", "/")}/__PAGE__.txt`);
    pushUnique(`${head}/__next.${namespace}/${stem}.txt`);
  }

  if (dotted.endsWith(".txt")) {
    const stem = dotted.slice(0, -".txt".length);
    pushUnique(`${head}/__next.${namespace}/${stem.replaceAll(".", "/")}.txt`);
    pushUnique(`${head}/__next.${namespace}/${stem}.txt`);
    pushUnique(`${head}/__next.${namespace}/${stem.replaceAll(".", "/")}/__PAGE__.txt`);
  }

  // Fallback: only first dotted segment becomes subdir, rest as file name.
  const dotIndex = dotted.indexOf(".");
  if (dotIndex > 0) {
    const first = dotted.slice(0, dotIndex);
    const rest = dotted.slice(dotIndex + 1);
    pushUnique(`${head}/__next.${namespace}/${first}/${rest}`);
  }

  return candidates;
};

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

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

const verifyLegacyPbkdf2 = async (password: string, passwordHash: string) => {
  const [scheme, iterationsRaw, saltB64Url, expectedB64Url] = passwordHash.split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !saltB64Url || !expectedB64Url) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(saltB64Url),
      iterations,
    },
    keyMaterial,
    256
  );

  return toBase64Url(derivedBits) === expectedB64Url;
};

const verifyPassword = async (password: string, passwordHash: string) => {
  const hashed = await hashPassword(password);
  if (hashed === passwordHash) {
    return { ok: true, needsRehash: false };
  }

  if (passwordHash.startsWith("pbkdf2$")) {
    const ok = await verifyLegacyPbkdf2(password, passwordHash);
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
};

const createSession = async (env: Env, request: Request, user: AppUser) => {
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const ipAddress =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    null;
  const userAgent = request.headers.get("user-agent");

  const schema = await env.DB.prepare("PRAGMA table_info(sessions)").all<{
    name: string;
    notnull: number;
    dflt_value: string | null;
  }>();
  const columns = new Set((schema.results ?? []).map((col) => col.name));

  const valuesByColumn: Record<string, string | null> = {
    id: sessionId,
    user_id: user.id,
    role: user.role,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: nowIso(),
    last_seen_at: nowIso(),
  };

  const insertColumns = Object.keys(valuesByColumn).filter((key) => columns.has(key));
  const placeholders = insertColumns.map(() => "?").join(", ");
  const sql = `INSERT INTO sessions (${insertColumns.join(", ")}) VALUES (${placeholders})`;
  const bindValues = insertColumns.map((key) => valuesByColumn[key] ?? null);

  await env.DB.prepare(sql).bind(...bindValues).run();

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

  let result: {
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
  } | null = null;

  try {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, s.role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.whatsapp, u.two_factor_secret
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
      .bind(sessionId)
      .first<typeof result>();
  } catch {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, u.role as role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.whatsapp, u.two_factor_secret
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
      .bind(sessionId)
      .first<typeof result>();
  }

  if (!result || new Date(result.expires_at).getTime() <= Date.now()) {
    if (result?.session_id) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(result.session_id).run();
    }
    return null;
  }

  try {
    await env.DB.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(result.session_id)
      .run();
  } catch {
    // abaikan jika schema lama belum punya kolom last_seen_at
  }

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

const runGeminiAssistant = async (apiKey: string, intro: string, prompt: string, userContext: unknown) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${intro}\n\nKonteks user:\n${JSON.stringify(
                  userContext,
                  null,
                  2
                )}\n\nPertanyaan:\n${prompt}`,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Gemini request gagal (${response.status}): ${payload.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  return textOutput || "Maaf, saya belum bisa memproses pertanyaan Anda saat ini.";
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

  if (env.GEMINI_API_KEY) {
    try {
      return await runGeminiAssistant(env.GEMINI_API_KEY, intro, prompt, userContext);
    } catch (error) {
      console.error("Gemini fallback error:", error);
    }
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

  const existing = await env.DB.prepare("SELECT id, role, plan, status FROM users WHERE email = ?")
    .bind(payload.email.toLowerCase())
    .first<{
      id: string;
      role: "admin" | "user";
      plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
    }>();

  if (existing) {
    if (existing.role === "admin") {
      return json({ error: "Email admin tidak bisa diregister ulang." }, { status: 409 });
    }

    await env.DB.prepare(
      `UPDATE users
          SET name = ?, password_hash = ?, whatsapp = ?, two_factor_secret = ?
        WHERE id = ?`
    )
      .bind(
        payload.name,
        await hashPassword(payload.password),
        payload.whatsapp ?? null,
        payload.twoFactorSecret ?? null,
        existing.id
      )
      .run();

    const user: AppUser = {
      id: existing.id,
      email: payload.email.toLowerCase(),
      name: payload.name,
      role: "user",
      plan: existing.plan ?? "FREE",
      status: existing.status ?? "GUEST",
      whatsapp: payload.whatsapp ?? null,
      two_factor_secret: payload.twoFactorSecret ?? null,
    };

    const session = await createSession(env, request, user);

    return jsonWithCookies(
      {
        ok: true,
        recovered: true,
        user,
      },
      [
        sessionCookie(env, session.token, 60 * 60 * 24 * 30),
        roleCookie(env, user.role, 60 * 60 * 24 * 30),
      ],
      { status: 200 }
    );
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

  const passwordVerification = user
    ? await verifyPassword(payload.password, user.password_hash)
    : { ok: false, needsRehash: false };

  if (!user || !passwordVerification.ok) {
    return json({ error: "Email atau password tidak valid." }, { status: 401 });
  }

  if (passwordVerification.needsRehash) {
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(payload.password), user.id)
      .run();
  }

  if (user.two_factor_secret && !payload.twoFactorToken) {
    return json({ needsTwoFactor: true }, { status: 202 });
  }

  if (
    user.two_factor_secret &&
    payload.twoFactorToken &&
    !verifySync({
      token: payload.twoFactorToken,
      secret: user.two_factor_secret,
      strategy: "totp",
    }).valid
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
  const session = await readSession(env, request);
  let settings: Awaited<ReturnType<typeof getMaintenanceSettings>> = null;
  try {
    settings = await getMaintenanceSettings(env);
  } catch {
    settings = null;
  }
  return json({
    user: session?.user ?? null,
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

async function handleUpdateTransaction(request: Request, env: Env, transactionId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const allowed = new Set([
    "type",
    "amount",
    "amount_idr",
    "category",
    "sub_category",
    "currency",
    "account_id",
    "target_account_id",
    "date",
    "display_date",
    "note",
    "status",
    "payment_status",
    "related_id",
    "related_type",
  ]);

  const entries = Object.entries(payload).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  const result = await env.DB.prepare(
    `UPDATE transactions
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, transactionId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleDeleteTransaction(request: Request, env: Env, transactionId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const result = await env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
    .bind(transactionId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleListAccounts(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const rows = await env.DB.prepare(
    `SELECT *
       FROM accounts
      WHERE user_id = ?
      ORDER BY created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();

  return json({ items: rows.results });
}

async function handleCreateAccount(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO accounts (
      id, user_id, name, type, currency, balance, initial_balance, base_value, logo_url, logo_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.name ?? ""),
      String(payload.type ?? ""),
      String(payload.currency ?? "IDR"),
      Number(payload.balance ?? 0),
      Number(payload.initial_balance ?? 0),
      Number(payload.base_value ?? 0),
      payload.logo_url ?? null,
      payload.logo_label ?? null
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

async function handleUpdateAccount(request: Request, env: Env, accountId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const allowed = new Set([
    "name",
    "type",
    "currency",
    "balance",
    "initial_balance",
    "base_value",
    "logo_url",
    "logo_label",
  ]);
  const entries = Object.entries(payload).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const result = await env.DB.prepare(
    `UPDATE accounts
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, accountId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleDeleteAccount(request: Request, env: Env, accountId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const result = await env.DB.prepare("DELETE FROM accounts WHERE id = ? AND user_id = ?")
    .bind(accountId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleAdjustAccountBalance(request: Request, env: Env, accountId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ delta?: number }>(request);
  const delta = Number(payload.delta ?? 0);
  const result = await env.DB.prepare(
    `UPDATE accounts
        SET balance = balance + ?
      WHERE id = ? AND user_id = ?`
  )
    .bind(delta, accountId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleListBudgets(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const rows = await env.DB.prepare(
    `SELECT *
       FROM budgets
      WHERE user_id = ?
      ORDER BY created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();

  return json({ items: rows.results });
}

async function handleCreateBudget(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ type?: string; category?: string; amount?: number; period?: string }>(request);
  const id = generateId();
  await env.DB.prepare(
    "INSERT INTO budgets (id, user_id, type, category, amount, period) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      payload.type ?? "pengeluaran",
      payload.category ?? "Umum",
      Number(payload.amount ?? 0),
      payload.period ?? "monthly"
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

async function handleUpdateBudget(request: Request, env: Env, budgetId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const allowed = new Set(["type", "category", "amount", "period"]);
  const entries = Object.entries(payload).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const result = await env.DB.prepare(
    `UPDATE budgets
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, budgetId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Budget tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleDeleteBudget(request: Request, env: Env, budgetId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const result = await env.DB.prepare("DELETE FROM budgets WHERE id = ? AND user_id = ?")
    .bind(budgetId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Budget tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleListInvestments(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const rows = type
    ? await env.DB.prepare(
        `SELECT *
           FROM investments
          WHERE user_id = ? AND type = ?
          ORDER BY created_at DESC`
      )
        .bind(authResult.session.user.id, type)
        .all()
    : await env.DB.prepare(
        `SELECT *
           FROM investments
          WHERE user_id = ?
          ORDER BY created_at DESC`
      )
        .bind(authResult.session.user.id)
        .all();

  return json({ items: rows.results });
}

async function handleCreateInvestment(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO investments (
      id, user_id, name, type, platform, amount_invested, amount_idr, current_value, current_value_idr,
      return_percentage, tax_percentage, currency, duration_months, transaction_type, category, account_id,
      logo_url, quantity, unit, price_per_unit, stock_code, exchange_code, shares_count, price_per_share,
      date_invested, target_date, duration_days, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.name ?? ""),
      String(payload.type ?? "Lainnya"),
      payload.platform ?? null,
      Number(payload.amount_invested ?? 0),
      Number(payload.amount_idr ?? 0),
      Number(payload.current_value ?? 0),
      Number(payload.current_value_idr ?? 0),
      Number(payload.return_percentage ?? 0),
      Number(payload.tax_percentage ?? 0),
      String(payload.currency ?? "IDR"),
      Number(payload.duration_months ?? 0),
      payload.transaction_type ?? null,
      payload.category ?? null,
      payload.account_id ?? null,
      payload.logo_url ?? null,
      Number(payload.quantity ?? 0),
      payload.unit ?? null,
      Number(payload.price_per_unit ?? 0),
      payload.stock_code ?? null,
      payload.exchange_code ?? null,
      Number(payload.shares_count ?? 0),
      Number(payload.price_per_share ?? 0),
      payload.date_invested ?? null,
      payload.target_date ?? null,
      Number(payload.duration_days ?? 0),
      payload.status ?? "Active"
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

async function handleUpdateInvestment(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const allowed = new Set([
    "name",
    "type",
    "platform",
    "amount_invested",
    "amount_idr",
    "current_value",
    "current_value_idr",
    "return_percentage",
    "tax_percentage",
    "currency",
    "duration_months",
    "transaction_type",
    "category",
    "account_id",
    "logo_url",
    "quantity",
    "unit",
    "price_per_unit",
    "stock_code",
    "exchange_code",
    "shares_count",
    "price_per_share",
    "date_invested",
    "target_date",
    "duration_days",
    "status",
  ]);
  const entries = Object.entries(payload).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const result = await env.DB.prepare(
    `UPDATE investments
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, investmentId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Investasi tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

async function handleDeleteInvestment(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const result = await env.DB.prepare("DELETE FROM investments WHERE id = ? AND user_id = ?")
    .bind(investmentId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Investasi tidak ditemukan." }, { status: 404 });
  }

  return json({ ok: true });
}

const pickPayloadValue = (payload: Record<string, unknown>, snakeKey: string, camelKey: string) =>
  payload[snakeKey] ?? payload[camelKey];

const toIsoIfDateLike = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const raw = (value as Record<string, unknown>).value;
    if (typeof raw === "string" || raw instanceof Date) {
      const parsed = Date.parse(String(raw));
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
  }
  return value ?? null;
};

async function handleGetMemberProfile(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const item = await env.DB.prepare(
    `SELECT id, name, email, whatsapp, photo_url, role, plan, status, expired_at, created_at,
            total_wealth, total_income, total_expenses, total_savings, total_investment,
            credit_card_bills, other_debts, two_factor_secret, currency_initialized
       FROM users
      WHERE id = ?`
  )
    .bind(authResult.session.user.id)
    .first();

  return json({ item });
}

async function handleUpdateMemberProfile(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const allowed = new Map<string, string>([
    ["name", "name"],
    ["whatsapp", "whatsapp"],
    ["photoURL", "photo_url"],
    ["photo_url", "photo_url"],
    ["username", "name"],
    ["phone", "whatsapp"],
    ["address", "whatsapp"],
    ["plan", "plan"],
    ["status", "status"],
    ["expiredAt", "expired_at"],
    ["expired_at", "expired_at"],
    ["totalWealth", "total_wealth"],
    ["total_wealth", "total_wealth"],
    ["totalIncome", "total_income"],
    ["total_income", "total_income"],
    ["totalExpenses", "total_expenses"],
    ["total_expenses", "total_expenses"],
    ["totalSavings", "total_savings"],
    ["total_savings", "total_savings"],
    ["totalInvestment", "total_investment"],
    ["total_investment", "total_investment"],
    ["creditCardBills", "credit_card_bills"],
    ["credit_card_bills", "credit_card_bills"],
    ["otherDebts", "other_debts"],
    ["other_debts", "other_debts"],
    ["currencyInitialized", "currency_initialized"],
    ["currency_initialized", "currency_initialized"],
  ]);

  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, rawValue] of Object.entries(payload)) {
    const field = allowed.get(key);
    if (!field) continue;

    if (
      rawValue &&
      typeof rawValue === "object" &&
      "__op" in (rawValue as Record<string, unknown>) &&
      (rawValue as Record<string, unknown>).__op === "increment"
    ) {
      const incrementValue = Number((rawValue as Record<string, unknown>).value ?? 0);
      assignments.push(`${field} = COALESCE(${field}, 0) + ?`);
      values.push(incrementValue);
      continue;
    }

    const nextValue =
      field.endsWith("_at") || field === "expired_at"
        ? toIsoIfDateLike(rawValue)
        : rawValue;
    assignments.push(`${field} = ?`);
    values.push(nextValue ?? null);
  }

  if (assignments.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  await env.DB.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values, authResult.session.user.id)
    .run();

  return json({ ok: true });
}

async function handleListCategories(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const rows = await env.DB.prepare(
    `SELECT *
       FROM categories
      WHERE user_id = ?
      ORDER BY created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();
  return json({ items: rows.results });
}

async function handleCreateCategory(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  await env.DB.prepare(
    "INSERT INTO categories (id, user_id, category, sub_category, status) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.category ?? "Lainnya"),
      String(pickPayloadValue(payload, "sub_category", "subCategory") ?? "General"),
      String(payload.status ?? "ACTIVE")
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

async function handleUpdateCategory(request: Request, env: Env, categoryId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const payload = await parseJson<Record<string, unknown>>(request);
  const updates = new Map<string, unknown>();
  if (payload.category !== undefined) updates.set("category", payload.category);
  if (payload.sub_category !== undefined || payload.subCategory !== undefined) {
    updates.set("sub_category", pickPayloadValue(payload, "sub_category", "subCategory"));
  }
  if (payload.status !== undefined) updates.set("status", payload.status);

  if (updates.size === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = Array.from(updates.keys()).map((key) => `${key} = ?`).join(", ");
  const values = Array.from(updates.values());
  const result = await env.DB.prepare(
    `UPDATE categories
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, categoryId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleDeleteCategory(request: Request, env: Env, categoryId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const result = await env.DB.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?")
    .bind(categoryId, authResult.session.user.id)
    .run();
  if (!result.meta.changes) {
    return json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleListCurrencies(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const rows = await env.DB.prepare(
    `SELECT *
       FROM currencies
      WHERE user_id = ?
      ORDER BY created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();
  return json({ items: rows.results });
}

async function handleCreateCurrency(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();

  await env.DB.prepare(
    "INSERT INTO currencies (id, user_id, code, name, symbol, is_default) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.code ?? "IDR"),
      String(payload.name ?? "Rupiah"),
      String(payload.symbol ?? "Rp"),
      Number(payload.is_default ?? payload.isDefault ?? 0) ? 1 : 0
    )
    .run();
  return json({ ok: true, id }, { status: 201 });
}

async function handleDeleteCurrency(request: Request, env: Env, currencyId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const result = await env.DB.prepare("DELETE FROM currencies WHERE id = ? AND user_id = ?")
    .bind(currencyId, authResult.session.user.id)
    .run();
  if (!result.meta.changes) {
    return json({ error: "Mata uang tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleListRecurring(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const rows = await env.DB.prepare(
    `SELECT *
       FROM recurring
      WHERE user_id = ?
      ORDER BY created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();
  return json({ items: rows.results });
}

async function handleCreateRecurring(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO recurring (id, user_id, name, type, category, account_id, amount, interval_value, next_date, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.name ?? ""),
      String(payload.type ?? "Pengeluaran"),
      payload.category ?? null,
      pickPayloadValue(payload, "account_id", "accountId") ?? null,
      Number(payload.amount ?? 0),
      pickPayloadValue(payload, "interval_value", "interval") ?? "Bulanan",
      toIsoIfDateLike(pickPayloadValue(payload, "next_date", "nextDate")),
      payload.note ?? null,
      payload.status ?? "ACTIVE"
    )
    .run();
  return json({ ok: true, id }, { status: 201 });
}

async function handleUpdateRecurring(request: Request, env: Env, recurringId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);
  const updates = new Map<string, unknown>();

  if (payload.name !== undefined) updates.set("name", payload.name);
  if (payload.type !== undefined) updates.set("type", payload.type);
  if (payload.category !== undefined) updates.set("category", payload.category);
  if (payload.account_id !== undefined || payload.accountId !== undefined) {
    updates.set("account_id", pickPayloadValue(payload, "account_id", "accountId"));
  }
  if (payload.amount !== undefined) updates.set("amount", payload.amount);
  if (payload.interval_value !== undefined || payload.interval !== undefined) {
    updates.set("interval_value", pickPayloadValue(payload, "interval_value", "interval"));
  }
  if (payload.next_date !== undefined || payload.nextDate !== undefined) {
    updates.set("next_date", toIsoIfDateLike(pickPayloadValue(payload, "next_date", "nextDate")));
  }
  if (payload.note !== undefined) updates.set("note", payload.note);
  if (payload.status !== undefined) updates.set("status", payload.status);

  if (updates.size === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = Array.from(updates.keys()).map((key) => `${key} = ?`).join(", ");
  const values = Array.from(updates.values());
  const result = await env.DB.prepare(
    `UPDATE recurring
        SET ${assignments}
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, recurringId, authResult.session.user.id)
    .run();
  if (!result.meta.changes) {
    return json({ error: "Recurring tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleDeleteRecurring(request: Request, env: Env, recurringId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const result = await env.DB.prepare("DELETE FROM recurring WHERE id = ? AND user_id = ?")
    .bind(recurringId, authResult.session.user.id)
    .run();
  if (!result.meta.changes) {
    return json({ error: "Recurring tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleListSavings(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const rows = await env.DB.prepare(
    `SELECT *
       FROM savings
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC`
  )
    .bind(authResult.session.user.id)
    .all();
  return json({ items: rows.results });
}

async function handleCreateSaving(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO savings (
      id, user_id, description, amount, amount_idr, currency, category, sub_category,
      from_account, to_goal, date, display_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.description ?? ""),
      Number(payload.amount ?? 0),
      Number(payload.amount_idr ?? payload.amountIDR ?? payload.amount ?? 0),
      String(payload.currency ?? "IDR"),
      payload.category ?? null,
      pickPayloadValue(payload, "sub_category", "subCategory") ?? null,
      pickPayloadValue(payload, "from_account", "fromAccount") ?? null,
      pickPayloadValue(payload, "to_goal", "toGoal") ?? null,
      toIsoIfDateLike(payload.date) ?? nowIso(),
      payload.display_date ?? payload.displayDate ?? nowIso()
    )
    .run();
  return json({ ok: true, id }, { status: 201 });
}

async function handleDeleteSaving(request: Request, env: Env, savingId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const result = await env.DB.prepare("DELETE FROM savings WHERE id = ? AND user_id = ?")
    .bind(savingId, authResult.session.user.id)
    .run();
  if (!result.meta.changes) {
    return json({ error: "Tabungan tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

async function handleCreateMemberPayment(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);

  const packagePayload = (payload.package as Record<string, unknown> | undefined) ?? {};
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO payments (
      id, user_id, user_email, user_name, user_photo_url, method, ref, package_id, package_name,
      package_duration_months, amount, note, proof_image_url, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.user_email ?? payload.userEmail ?? authResult.session.user.email),
      String(payload.user_name ?? payload.userName ?? authResult.session.user.name),
      payload.user_photo_url ?? payload.userPhotoURL ?? null,
      payload.method ?? "Bank Transfer",
      payload.ref ?? null,
      packagePayload.id ?? payload.package_id ?? null,
      packagePayload.name ?? payload.package_name ?? null,
      Number(packagePayload.durationMonths ?? payload.package_duration_months ?? 1),
      Number(payload.amount ?? 0),
      payload.note ?? null,
      payload.proof_image_url ?? payload.proofImageUrl ?? null,
      payload.status ?? "MENUNGGU"
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

async function handleGetAiChatHistory(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  let item:
    | { id: string; user_id: string; messages_json: string; updated_at: string }
    | { user_id: string; messages_json: string; updated_at: string }
    | null = null;
  try {
    item = await env.DB.prepare(
      "SELECT id, user_id, messages_json, updated_at FROM ai_chats WHERE user_id = ?"
    )
      .bind(authResult.session.user.id)
      .first<{ id: string; user_id: string; messages_json: string; updated_at: string }>();
  } catch {
    item = await env.DB.prepare(
      "SELECT user_id, messages_json, updated_at FROM ai_chats WHERE user_id = ?"
    )
      .bind(authResult.session.user.id)
      .first<{ user_id: string; messages_json: string; updated_at: string }>();
  }

  if (!item) {
    return json({ item: null });
  }

  return json({
    item: {
      id: "id" in item ? item.id : item.user_id,
      user_id: item.user_id,
      messages: JSON.parse(item.messages_json),
      updated_at: item.updated_at,
    },
  });
}

async function handlePutAiChatHistory(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<{ messages?: unknown[] }>(request);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  try {
    const existing = await env.DB.prepare("SELECT id FROM ai_chats WHERE user_id = ?")
      .bind(authResult.session.user.id)
      .first<{ id: string }>();

    if (existing) {
      await env.DB.prepare("UPDATE ai_chats SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(JSON.stringify(messages), existing.id)
        .run();
      return json({ ok: true, id: existing.id });
    }

    const id = generateId();
    await env.DB.prepare("INSERT INTO ai_chats (id, user_id, messages_json) VALUES (?, ?, ?)")
      .bind(id, authResult.session.user.id, JSON.stringify(messages))
      .run();
    return json({ ok: true, id }, { status: 201 });
  } catch {
    const existingLegacy = await env.DB.prepare("SELECT user_id FROM ai_chats WHERE user_id = ?")
      .bind(authResult.session.user.id)
      .first<{ user_id: string }>();

    if (existingLegacy) {
      await env.DB.prepare("UPDATE ai_chats SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(JSON.stringify(messages), authResult.session.user.id)
        .run();
      return json({ ok: true, id: authResult.session.user.id });
    }

    await env.DB.prepare(
      "INSERT INTO ai_chats (user_id, messages_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(authResult.session.user.id, JSON.stringify(messages))
      .run();
    return json({ ok: true, id: authResult.session.user.id }, { status: 201 });
  }
}

async function handleDeleteAiChatHistory(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  await env.DB.prepare("DELETE FROM ai_chats WHERE user_id = ?")
    .bind(authResult.session.user.id)
    .run();
  return json({ ok: true });
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

async function handleAdminUsers(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  const rows = await env.DB.prepare(
    `SELECT id, name, email, role, plan, status, expired_at, photo_url, created_at, whatsapp
       FROM users
      ORDER BY created_at DESC`
  ).all();

  return json({ items: rows.results });
}

async function insertAdminLog(
  env: Env,
  adminEmail: string,
  action: string,
  target: string,
  note: string,
  color: string
) {
  await env.DB.prepare(
    "INSERT INTO admin_logs (id, admin_email, action, target, note, color) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(generateId(), adminEmail, action, target, note, color)
    .run();
}

async function handleAdminUserById(request: Request, env: Env, userId: string) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  const target = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; email: string }>();

  if (!target) {
    return json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  if (request.method === "GET") {
    const item = await env.DB.prepare(
      `SELECT id, name, email, role, plan, status, expired_at, photo_url, created_at, whatsapp
         FROM users
        WHERE id = ?`
    )
      .bind(userId)
      .first();
    return json({ item });
  }

  if (request.method === "DELETE") {
    if (target.id === authResult.session.user.id) {
      return json({ error: "Admin tidak bisa menghapus akun sendiri." }, { status: 400 });
    }

    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    await insertAdminLog(
      env,
      authResult.session.user.email,
      "DELETE_USER",
      target.email,
      "Menghapus akun pengguna dari database",
      "rose"
    );
    return json({ ok: true });
  }

  if (request.method !== "PATCH") {
    return text("Method not allowed", { status: 405 });
  }

  const payload = await parseJson<{
    plan?: "FREE" | "PRO";
    status?: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
    expiredAt?: string | null;
  }>(request);

  const entries: Array<[string, string | null]> = [];
  if (payload.plan) {
    entries.push(["plan", payload.plan]);
  }
  if (payload.status) {
    entries.push(["status", payload.status]);
  }
  if (payload.expiredAt !== undefined) {
    entries.push(["expired_at", payload.expiredAt ?? null]);
  }

  if (entries.length === 0) {
    return json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  const assignment = entries.map(([field]) => `${field} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await env.DB.prepare(`UPDATE users SET ${assignment} WHERE id = ?`)
    .bind(...values, userId)
    .run();

  await insertAdminLog(
    env,
    authResult.session.user.email,
    "UPDATE_USER",
    target.email,
    `Update user: ${entries.map(([field]) => field).join(", ")}`,
    "indigo"
  );

  return json({ ok: true });
}

async function handleAdminPayments(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  const rows = await env.DB.prepare(
    `SELECT *
       FROM payments
      ORDER BY created_at DESC`
  ).all();

  return json({ items: rows.results });
}

async function handleAdminPaymentById(request: Request, env: Env, paymentId: string) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  if (request.method !== "PATCH") {
    return text("Method not allowed", { status: 405 });
  }

  const payload = await parseJson<{ status?: string }>(request);
  const nextStatus = payload.status?.toUpperCase();
  if (!nextStatus || !["MENUNGGU", "DISETUJUI", "DITOLAK", "GAGAL"].includes(nextStatus)) {
    return json({ error: "Status pembayaran tidak valid." }, { status: 400 });
  }

  const payment = await env.DB.prepare(
    `SELECT id, user_id, user_email, user_name, package_duration_months
       FROM payments
      WHERE id = ?`
  )
    .bind(paymentId)
    .first<{
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      package_duration_months: number | null;
    }>();

  if (!payment) {
    return json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  if (nextStatus === "DISETUJUI") {
    await env.DB.prepare("UPDATE payments SET status = ?, approved_at = ? WHERE id = ?")
      .bind(nextStatus, nowIso(), paymentId)
      .run();

    const currentUser = await env.DB.prepare("SELECT expired_at FROM users WHERE id = ?")
      .bind(payment.user_id)
      .first<{ expired_at: string | null }>();

    const now = new Date();
    const baseDate =
      currentUser?.expired_at && new Date(currentUser.expired_at).getTime() > Date.now()
        ? new Date(currentUser.expired_at)
        : now;
    const monthsToAdd =
      payment.package_duration_months && payment.package_duration_months > 0
        ? payment.package_duration_months
        : 1;
    const nextExpired = new Date(baseDate);
    nextExpired.setMonth(nextExpired.getMonth() + monthsToAdd);

    await env.DB.prepare("UPDATE users SET plan = 'PRO', status = 'AKTIF', expired_at = ? WHERE id = ?")
      .bind(nextExpired.toISOString(), payment.user_id)
      .run();

    await insertAdminLog(
      env,
      authResult.session.user.email,
      "APPROVE_PAYMENT",
      payment.user_email,
      `Menyetujui pembayaran tiket ${payment.id} dan mengaktifkan PRO`,
      "emerald"
    );
    return json({ ok: true });
  }

  await env.DB.prepare("UPDATE payments SET status = ? WHERE id = ?")
    .bind(nextStatus, paymentId)
    .run();

  await insertAdminLog(
    env,
    authResult.session.user.email,
    nextStatus === "DITOLAK" ? "REJECT_PAYMENT" : "UPDATE_PAYMENT",
    payment.user_email,
    `Mengubah status pembayaran ${payment.id} menjadi ${nextStatus}`,
    nextStatus === "DITOLAK" ? "rose" : "slate"
  );

  return json({ ok: true });
}

async function handleAdminLogs(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) {
    return authResult.error;
  }

  if (request.method === "POST") {
    const payload = await parseJson<{
      action?: string;
      target?: string;
      note?: string;
      color?: string;
    }>(request);

    await env.DB.prepare(
      "INSERT INTO admin_logs (id, admin_email, action, target, note, color) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        generateId(),
        authResult.session.user.email,
        payload.action ?? "admin.action",
        payload.target ?? "unknown",
        payload.note ?? "",
        payload.color ?? "slate"
      )
      .run();
    return json({ ok: true }, { status: 201 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);
  const rows = await env.DB.prepare(
    `SELECT id, admin_email, action, target, note, color, created_at
       FROM admin_logs
      ORDER BY created_at DESC
      LIMIT ?`
  )
    .bind(limit)
    .all();

  return json({ items: rows.results });
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

  let existing:
    | { id: string; messages_json: string }
    | { user_id: string; messages_json: string }
    | null = null;
  let useLegacyAiChatSchema = false;
  try {
    existing = await env.DB.prepare("SELECT id, messages_json FROM ai_chats WHERE user_id = ?")
      .bind(authResult.session.user.id)
      .first<{ id: string; messages_json: string }>();
  } catch {
    useLegacyAiChatSchema = true;
    existing = await env.DB.prepare("SELECT user_id, messages_json FROM ai_chats WHERE user_id = ?")
      .bind(authResult.session.user.id)
      .first<{ user_id: string; messages_json: string }>();
  }

  const nextMessages = existing
    ? JSON.parse(existing.messages_json)
    : [];

  nextMessages.push(
    { role: "user", content: payload.prompt, createdAt: nowIso() },
    { role: "assistant", content: answer, createdAt: nowIso() }
  );

  if (existing) {
    if (useLegacyAiChatSchema || !("id" in existing)) {
      await env.DB.prepare("UPDATE ai_chats SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(JSON.stringify(nextMessages), authResult.session.user.id)
        .run();
    } else {
      await env.DB.prepare("UPDATE ai_chats SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(JSON.stringify(nextMessages), existing.id)
        .run();
    }
  } else if (useLegacyAiChatSchema) {
    await env.DB.prepare(
      "INSERT INTO ai_chats (user_id, messages_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(authResult.session.user.id, JSON.stringify(nextMessages))
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
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        url.pathname.length > 1 &&
        url.pathname.endsWith("/") &&
        !url.pathname.startsWith("/_next/")
      ) {
        const normalized = `${url.origin}${url.pathname.slice(0, -1)}${url.search}`;
        return Response.redirect(normalized, 308);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/login") {
        return Response.redirect(`${url.origin}/auth/login`, 308);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/register") {
        return Response.redirect(`${url.origin}/auth/register`, 308);
      }

      if (url.pathname === "/health") {
        return json({
          ok: true,
          app: env.APP_NAME,
          env: env.APP_ENV,
          now: nowIso(),
        });
      }

      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        return await handleRegister(request, env);
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        return await handleMe(request, env);
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return await handleLogout(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "GET") {
        return await handleListTransactions(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "POST") {
        return await handleCreateTransaction(request, env);
      }

      if (url.pathname.startsWith("/api/member/transactions/")) {
        const transactionId = url.pathname.slice("/api/member/transactions/".length);
        if (request.method === "PUT") {
          return await handleUpdateTransaction(request, env, transactionId);
        }
        if (request.method === "DELETE") {
          return await handleDeleteTransaction(request, env, transactionId);
        }
      }

      if (url.pathname === "/api/member/accounts" && request.method === "GET") {
        return await handleListAccounts(request, env);
      }

      if (url.pathname === "/api/member/accounts" && request.method === "POST") {
        return await handleCreateAccount(request, env);
      }

      if (url.pathname.startsWith("/api/member/accounts/")) {
        const accountPath = url.pathname.slice("/api/member/accounts/".length);
        if (accountPath.endsWith("/balance") && request.method === "POST") {
          const accountId = accountPath.slice(0, -"/balance".length);
          return await handleAdjustAccountBalance(request, env, accountId);
        }
        if (request.method === "PUT") {
          return await handleUpdateAccount(request, env, accountPath);
        }
        if (request.method === "DELETE") {
          return await handleDeleteAccount(request, env, accountPath);
        }
      }

      if (url.pathname === "/api/member/budgets" && request.method === "GET") {
        return await handleListBudgets(request, env);
      }

      if (url.pathname === "/api/member/budgets" && request.method === "POST") {
        return await handleCreateBudget(request, env);
      }

      if (url.pathname.startsWith("/api/member/budgets/")) {
        const budgetId = url.pathname.slice("/api/member/budgets/".length);
        if (request.method === "PUT") {
          return await handleUpdateBudget(request, env, budgetId);
        }
        if (request.method === "DELETE") {
          return await handleDeleteBudget(request, env, budgetId);
        }
      }

      if (url.pathname === "/api/member/investments" && request.method === "GET") {
        return await handleListInvestments(request, env);
      }

      if (url.pathname === "/api/member/investments" && request.method === "POST") {
        return await handleCreateInvestment(request, env);
      }

      if (url.pathname.startsWith("/api/member/investments/")) {
        const investmentId = url.pathname.slice("/api/member/investments/".length);
        if (request.method === "PUT") {
          return await handleUpdateInvestment(request, env, investmentId);
        }
        if (request.method === "DELETE") {
          return await handleDeleteInvestment(request, env, investmentId);
        }
      }

      if (url.pathname === "/api/member/profile" && request.method === "GET") {
        return await handleGetMemberProfile(request, env);
      }

      if (url.pathname === "/api/member/profile" && request.method === "PATCH") {
        return await handleUpdateMemberProfile(request, env);
      }

      if (url.pathname === "/api/member/categories" && request.method === "GET") {
        return await handleListCategories(request, env);
      }

      if (url.pathname === "/api/member/categories" && request.method === "POST") {
        return await handleCreateCategory(request, env);
      }

      if (url.pathname.startsWith("/api/member/categories/")) {
        const categoryId = url.pathname.slice("/api/member/categories/".length);
        if (request.method === "PUT") {
          return await handleUpdateCategory(request, env, categoryId);
        }
        if (request.method === "DELETE") {
          return await handleDeleteCategory(request, env, categoryId);
        }
      }

      if (url.pathname === "/api/member/currencies" && request.method === "GET") {
        return await handleListCurrencies(request, env);
      }

      if (url.pathname === "/api/member/currencies" && request.method === "POST") {
        return await handleCreateCurrency(request, env);
      }

      if (url.pathname.startsWith("/api/member/currencies/")) {
        const currencyId = url.pathname.slice("/api/member/currencies/".length);
        if (request.method === "DELETE") {
          return await handleDeleteCurrency(request, env, currencyId);
        }
      }

      if (url.pathname === "/api/member/recurring" && request.method === "GET") {
        return await handleListRecurring(request, env);
      }

      if (url.pathname === "/api/member/recurring" && request.method === "POST") {
        return await handleCreateRecurring(request, env);
      }

      if (url.pathname.startsWith("/api/member/recurring/")) {
        const recurringId = url.pathname.slice("/api/member/recurring/".length);
        if (request.method === "PUT") {
          return await handleUpdateRecurring(request, env, recurringId);
        }
        if (request.method === "DELETE") {
          return await handleDeleteRecurring(request, env, recurringId);
        }
      }

      if (url.pathname === "/api/member/savings" && request.method === "GET") {
        return await handleListSavings(request, env);
      }

      if (url.pathname === "/api/member/savings" && request.method === "POST") {
        return await handleCreateSaving(request, env);
      }

      if (url.pathname.startsWith("/api/member/savings/")) {
        const savingId = url.pathname.slice("/api/member/savings/".length);
        if (request.method === "DELETE") {
          return await handleDeleteSaving(request, env, savingId);
        }
      }

      if (url.pathname === "/api/member/payments" && request.method === "POST") {
        return await handleCreateMemberPayment(request, env);
      }

      if (url.pathname === "/api/member/ai/chat/history" && request.method === "GET") {
        return await handleGetAiChatHistory(request, env);
      }

      if (url.pathname === "/api/member/ai/chat/history" && request.method === "PUT") {
        return await handlePutAiChatHistory(request, env);
      }

      if (url.pathname === "/api/member/ai/chat/history" && request.method === "DELETE") {
        return await handleDeleteAiChatHistory(request, env);
      }

      if (url.pathname === "/api/member/ai/chat" && request.method === "POST") {
        return await handleAiChat(request, env);
      }

      if (url.pathname === "/api/member/uploads/sign" && request.method === "POST") {
        return await handleSignedUpload(request, env);
      }

      if (url.pathname === "/api/admin/settings" && (request.method === "GET" || request.method === "PUT")) {
        return await handleAdminSettings(request, env);
      }

      if (url.pathname === "/api/admin/users" && request.method === "GET") {
        return await handleAdminUsers(request, env);
      }

      if (url.pathname.startsWith("/api/admin/users/")) {
        const userId = url.pathname.slice("/api/admin/users/".length);
        if (request.method === "GET" || request.method === "PATCH" || request.method === "DELETE") {
          return await handleAdminUserById(request, env, userId);
        }
      }

      if (url.pathname === "/api/admin/payments" && request.method === "GET") {
        return await handleAdminPayments(request, env);
      }

      if (url.pathname.startsWith("/api/admin/payments/")) {
        const paymentId = url.pathname.slice("/api/admin/payments/".length);
        if (request.method === "PATCH") {
          return await handleAdminPaymentById(request, env, paymentId);
        }
      }

      if (
        url.pathname === "/api/admin/logs" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        return await handleAdminLogs(request, env);
      }

      if (url.pathname === "/api/realtime" && request.method === "GET") {
        return await handleRealtime(new Request("https://realtime.internal/sse", request), env);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const compatPath = rewriteAuthRscPath(url.pathname);
        if (compatPath) {
          const compatUrl = new URL(request.url);
          compatUrl.pathname = compatPath;
          const authAsset = await env.ASSETS.fetch(new Request(compatUrl.toString(), request));
          if (authAsset.status !== 404) {
            return authAsset;
          }
        }

        for (const namespace of ["membership", "admin"] as const) {
          const candidates = buildDottedRscCandidates(url.pathname, namespace);
          for (const candidate of candidates) {
            const candidateUrl = new URL(request.url);
            candidateUrl.pathname = candidate;
            const assetResponse = await env.ASSETS.fetch(new Request(candidateUrl.toString(), request));
            if (assetResponse.status !== 404) {
              return assetResponse;
            }
          }
        }
        return await env.ASSETS.fetch(request);
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

