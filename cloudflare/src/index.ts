import { verifySync } from "otplib";
import { DurableObject } from "cloudflare:workers";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription as WebPushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  LOGIN_RATE_LIMITER?: RateLimit;
  ASSETS: Fetcher;
  FILES_BUCKET?: R2Bucket;
  REALTIME_ROOM: DurableObjectNamespace;
  APP_NAME: string;
  APP_ENV: string;
  APP_URL: string;
  SESSION_COOKIE_NAME: string;
  SESSION_SECRET: string;
  MAINTENANCE_BYPASS_ADMIN?: string;
  R2_PUBLIC_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  LOGO_DEV_TOKEN?: string;
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
  photoURL?: string | null;
  // false untuk akun Google (password_hash cuma sentinel 'oauth$google', bukan
  // password asli) — dipakai frontend untuk skip verifikasi "password saat
  // ini" di Ganti Password / Reset Data, karena memang tidak pernah ada.
  hasPassword?: boolean;
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

// Tanggal "hari ini" versi WIB (UTC+7, tanpa DST) — dipakai untuk default
// tanggal transaksi. Server Cloudflare Workers selalu UTC, jadi antara jam
// 00:00-06:59 WIB, `new Date().toISOString()` masih menunjukkan tanggal UTC
// KEMARIN (mis. jam 01:00 WIB tanggal 20 = jam 18:00 UTC tanggal 19) —
// menggeser waktu +7 jam dulu sebelum diambil tanggalnya memperbaiki ini.
const todayWIB = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Dipakai buat kasih tahu admin lewat Telegram (permintaan akses baru,
// pembayaran baru) — sengaja tidak pernah melempar error kalau gagal/belum
// dikonfigurasi, supaya alur utama (request access / submit pembayaran) tidak
// pernah gagal gara-gara notifikasi Telegram bermasalah.
const sendTelegramNotification = async (env: Env, message: string) => {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Gagal mengirim notifikasi Telegram:", err);
  }
};

// User baru langsung dapat akses penuh (status AKTIF) selama durasi Free Plan
// yang di-set admin di Pengaturan (admin_settings.free_plan_days — field yang
// sama dipakai tombol "Set Free" di halaman Kelola Pelanggan), tanpa perlu
// approval manual. Dipakai bareng oleh registrasi email dan Google OAuth
// supaya keduanya konsisten. Kalau durasinya 0/belum di-set, fallback ke
// perilaku lama (GUEST, perlu approval manual lewat "Request Akses").
const computeTrialGrant = async (env: Env): Promise<{ status: "AKTIF" | "GUEST"; expiredAt: string | null }> => {
  const settings = await env.DB.prepare("SELECT free_plan_days FROM admin_settings WHERE id = 'global'")
    .first<{ free_plan_days: number | null }>();
  const trialDays = Number(settings?.free_plan_days ?? 0);
  if (!Number.isFinite(trialDays) || trialDays <= 0) {
    return { status: "GUEST", expiredAt: null };
  }
  return {
    status: "AKTIF",
    expiredAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
  };
};

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

const signSession = async (env: Env, sessionId: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionId));
  return toBase64Url(signature);
};

// Tanda tangan lama (SHA-256 non-HMAC) — hanya untuk memverifikasi token yang sudah beredar.
const legacySessionSignature = async (env: Env, sessionId: string) => {
  const payload = `${sessionId}.${env.SESSION_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return toBase64Url(digest);
};

const createSessionToken = async (env: Env, sessionId: string) =>
  `${sessionId}.${await signSession(env, sessionId)}`;

const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const sessionCookie = (env: Env, token: string, maxAgeSeconds: number) =>
  `${env.SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

const roleCookie = (env: Env, role: AppUser["role"], maxAgeSeconds: number) =>
  `${env.SESSION_COOKIE_NAME}_role=${role}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

const clearSessionCookie = (env: Env) =>
  `${env.SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const clearRoleCookie = (env: Env) =>
  `${env.SESSION_COOKIE_NAME}_role=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

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

// Cegah brute-force/credential-stuffing di login & spam di register — dicek
// per-IP dan (khusus login) per-email juga, supaya penyerang yang nyebar
// request dari banyak IP ke satu email korban tetap kena batas.
// Fail-open kalau binding belum ke-deploy (mis. dev lokal) supaya tidak
// mem-block auth sama sekali kalau rate limiter-nya belum tersedia.
const checkRateLimit = async (env: Env, keys: string[]): Promise<boolean> => {
  if (!env.LOGIN_RATE_LIMITER) return true;
  for (const key of keys) {
    const { success } = await env.LOGIN_RATE_LIMITER.limit({ key });
    if (!success) return false;
  }
  return true;
};

const clientIpOf = (request: Request) => request.headers.get("cf-connecting-ip") || "unknown";

// Cloudflare Workers membatasi PBKDF2 maksimal 100.000 iterasi.
const PBKDF2_ITERATIONS = 100000;

// Hash password baru dengan PBKDF2 + salt acak per-user (format: pbkdf2$iter$salt$hash).
const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt.buffer)}$${toBase64Url(derivedBits)}`;
};

// Hash SHA-256 lama (tanpa salt) — hanya untuk memverifikasi akun lama & memicu rehash.
const legacySha256Hash = async (password: string) => sha256Hex(`leosiqra::${password}`);

const verifyPbkdf2 = async (password: string, passwordHash: string) => {
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
  if (passwordHash.startsWith("pbkdf2$")) {
    const ok = await verifyPbkdf2(password, passwordHash);
    return { ok, needsRehash: false };
  }

  // Hash lama berbasis SHA-256: verifikasi lalu tandai untuk di-rehash ke PBKDF2.
  const ok = (await legacySha256Hash(password)) === passwordHash;
  return { ok, needsRehash: ok };
};

// PWA ter-install minta sesi "permanen" (login dari web tetap 30 hari seperti
// biasa) — tidak ada expiry sungguhan yang aman di kolom NOT NULL, jadi pakai
// 100 tahun sebagai proksi permanen.
const SESSION_TTL_SECONDS_WEB = 60 * 60 * 24 * 30;
const SESSION_TTL_SECONDS_PWA = 60 * 60 * 24 * 365 * 100;

const createSession = async (env: Env, request: Request, user: AppUser, options: { permanent?: boolean } = {}) => {
  const sessionId = generateId();
  const ttlSeconds = options.permanent ? SESSION_TTL_SECONDS_PWA : SESSION_TTL_SECONDS_WEB;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
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
    maxAgeSeconds: ttlSeconds,
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

  const expectedHmac = await signSession(env, sessionId);
  const legacySignature = await legacySessionSignature(env, sessionId);
  if (
    !constantTimeEqual(providedSignature, expectedHmac) &&
    !constantTimeEqual(providedSignature, legacySignature)
  ) {
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
    expired_at: string | null;
    whatsapp?: string | null;
    two_factor_secret?: string | null;
    photo_url?: string | null;
    password_hash?: string;
  } | null = null;

  try {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, s.role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.expired_at, u.whatsapp, u.two_factor_secret, u.photo_url, u.password_hash
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
      .bind(sessionId)
      .first<typeof result>();
  } catch {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, u.role as role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.expired_at, u.whatsapp, u.two_factor_secret, u.photo_url, u.password_hash
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

  // Trial 14-hari (dan langganan PRO yang habis) sama-sama disimpan lewat
  // kolom `expired_at` — tidak ada cron di Workers, jadi turunkan status ke
  // GUEST secara "lazy" begitu ketahuan sudah lewat, di titik tunggal ini
  // (dipakai semua request terautentikasi) supaya konsisten di mana pun.
  if (result.status === "AKTIF" && result.expired_at && new Date(result.expired_at).getTime() <= Date.now()) {
    await env.DB.prepare("UPDATE users SET status = 'GUEST' WHERE id = ?").bind(result.user_id).run();
    result.status = "GUEST";
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
      photoURL: result.photo_url ?? null,
      hasPassword: !result.password_hash?.startsWith("oauth$"),
    } satisfies AppUser,
  };
};

// Satu-satunya akun yang boleh ubah foto & kata motivasi developer di landing
// page — role tetap 'admin' biasa di DB (enum role cuma admin/user, ubah jadi
// superadmin penuh butuh migrasi CHECK constraint yang jauh lebih berisiko),
// jadi pembatasannya dilakukan lewat pengecekan email persis di sini.
const SUPERADMIN_EMAIL = "leo.wendry@yahoo.com";

// Sesi dianggap "permanen" (PWA ter-install, lihat createSession) kalau masa
// berlakunya jauh lebih panjang dari sesi web normal — dihitung dari selisih
// expires_at/created_at, bukan kolom terpisah, supaya tidak perlu migrasi
// schema baru (lihat catatan drift schema production di tempat lain).
const PERMANENT_SESSION_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 365; // > 1 tahun
const isPermanentSession = (createdAt: string, expiresAt: string) =>
  new Date(expiresAt).getTime() - new Date(createdAt).getTime() > PERMANENT_SESSION_THRESHOLD_MS;

// Batas sesi WEB (non-permanen) yang boleh aktif bersamaan per user — sesi PWA
// permanen tidak pernah dihitung/di-evict di sini, jadi PWA tidak akan pernah
// ke-logout paksa gara-gara user login dari banyak PC.
const MAX_CONCURRENT_WEB_SESSIONS = 3;

const enforceSessionCap = async (env: Env, userId: string) => {
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, expires_at, last_seen_at FROM sessions WHERE user_id = ? AND expires_at > ?`
  )
    .bind(userId, new Date().toISOString())
    .all<{ id: string; created_at: string; expires_at: string; last_seen_at: string }>();

  const webSessions = (results ?? [])
    .filter((s) => !isPermanentSession(s.created_at, s.expires_at))
    .sort((a, b) => new Date(a.last_seen_at || a.created_at).getTime() - new Date(b.last_seen_at || b.created_at).getTime());

  const excess = webSessions.length - MAX_CONCURRENT_WEB_SESSIONS;
  if (excess <= 0) return;

  for (const session of webSessions.slice(0, excess)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();
  }
};

// Label ramah buat notifikasi login baru & halaman "Kelola Perangkat" — cuma
// tebakan best-effort dari User-Agent, tidak perlu akurat sempurna.
const describeUserAgent = (ua: string | null | undefined): string => {
  if (!ua) return "Perangkat tidak dikenal";
  const isIphone = /iphone/i.test(ua);
  const isIpad = /ipad/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMac = /macintosh/i.test(ua);
  const isWindows = /windows/i.test(ua);
  const isLinux = /linux/i.test(ua) && !isAndroid;
  const os = isIphone ? "iPhone" : isIpad ? "iPad" : isAndroid ? "Android" : isMac ? "Mac" : isWindows ? "Windows" : isLinux ? "Linux" : "";

  const isEdge = /edg\//i.test(ua);
  const isChrome = /chrome\//i.test(ua) && !isEdge && !/opr\//i.test(ua);
  const isFirefox = /firefox\//i.test(ua);
  const isSafari = /safari\//i.test(ua) && !isChrome && !isEdge && !/crios\//i.test(ua) && !/fxios\//i.test(ua);
  const browser = isEdge ? "Edge" : isChrome ? "Chrome" : isFirefox ? "Firefox" : isSafari ? "Safari" : "Browser";

  return os ? `${browser} di ${os}` : browser;
};

async function handleListSessions(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const { results } = await env.DB.prepare(
    `SELECT id, user_agent, created_at, last_seen_at, expires_at
       FROM sessions
      WHERE user_id = ? AND expires_at > ?
      ORDER BY last_seen_at DESC`
  )
    .bind(authResult.session.user.id, new Date().toISOString())
    .all<{ id: string; user_agent: string | null; created_at: string; last_seen_at: string; expires_at: string }>();

  const items = (results ?? []).map((s) => ({
    id: s.id,
    device: describeUserAgent(s.user_agent),
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
    isPermanent: isPermanentSession(s.created_at, s.expires_at),
    isCurrent: s.id === authResult.session.sessionId,
  }));

  return json({ items });
}

async function handleDeleteSession(request: Request, env: Env, sessionId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const result = await env.DB.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

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
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<(iframe|object|embed|link|meta|base|form)[\s\S]*?>[\s\S]*?<\/\1>/gi, "")
    .replaceAll(/<(iframe|object|embed|link|meta|base|form)[^>]*\/?>/gi, "")
    .replaceAll(/\son\w+="[^"]*"/gi, "")
    .replaceAll(/\son\w+='[^']*'/gi, "")
    .replaceAll(/\s(srcdoc|formaction|xlink:href|href|src|poster|action)\s*=\s*"(javascript:|data:text\/html)[^"]*"/gi, "")
    .replaceAll(/\s(srcdoc|formaction|xlink:href|href|src|poster|action)\s*=\s*'(javascript:|data:text\/html)[^']*'/gi, "")
    .replaceAll(/\sstyle\s*=\s*"[^"]*(expression|url\s*\(\s*javascript:)[^"]*"/gi, "")
    .replaceAll(/\sstyle\s*=\s*'[^']*(expression|url\s*\(\s*javascript:)[^']*'/gi, "");
};

const getMaintenanceSettings = async (env: Env) =>
  env.DB.prepare(
    `SELECT
      id,
      maintenance_is_active,
      maintenance_type,
      maintenance_code,
      maintenance_image_url,
      whatsapp,
      billing_email,
      developer_name,
      developer_photo_url,
      developer_quote
     FROM admin_settings
     WHERE id = 'global'
     LIMIT 1`
  ).first<{
    id: string;
    maintenance_is_active: number;
    maintenance_type: string | null;
    maintenance_code: string | null;
    maintenance_image_url: string | null;
    whatsapp: string | null;
    billing_email: string | null;
    developer_name: string | null;
    developer_photo_url: string | null;
    developer_quote: string | null;
  }>();

// Konteks lengkap keuangan user untuk AI — sebelumnya cuma kirim sebagian
// kolom (tanpa amount_idr/currency di transaksi, tanpa detail hutang, tanpa
// recurring/currencies sama sekali) dengan limit kecil (40 transaksi dll),
// jadi AI sering "buta" terhadap transaksi mata uang asing, hutang/piutang,
// dan riwayat lama user. Sekarang ambil semua tabel keuangan dengan kolom
// lengkap dan limit yang jauh lebih longgar.
const buildUserContext = async (env: Env, userId: string) => {
  const [accounts, transactions, budgets, investments, savings, recurring, currencies, categories] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, type, currency, balance, initial_balance, payload_json
         FROM accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
      .bind(userId)
      .all<{
        id: string;
        name: string;
        type: string;
        currency: string;
        balance: number;
        initial_balance: number;
        payload_json: string | null;
      }>(),
    env.DB.prepare(
      `SELECT type, amount, amount_idr, currency, category, sub_category, account_id, target_account_id, note,
              date, display_date, status, lender_name, total_debt, installment_tenor, monthly_interest,
              total_interest, payment_status
         FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 500`
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT type, category, amount, period FROM budgets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    )
      .bind(userId)
      .all(),
    // status != 'Planned' membuang baris proyeksi otomatis "(Hasil Akhir)"
    // yang dibuat DepositModal untuk tiap deposito baru — bukan posisi nyata,
    // supaya AI tidak menghitungnya dobel dengan baris "Penempatan" aslinya.
    env.DB.prepare(
      `SELECT name, type, platform, currency, amount_invested, amount_idr, current_value, current_value_idr,
              return_percentage, transaction_type, category, quantity, unit, stock_code, exchange_code,
              date_invested, target_date, duration_months, status
         FROM investments WHERE user_id = ? AND status != 'Planned' ORDER BY created_at DESC LIMIT 100`
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      `SELECT description, amount, amount_idr, currency, category, from_account, to_goal, date, display_date
         FROM savings WHERE user_id = ? ORDER BY date DESC LIMIT 100`
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      `SELECT name, type, category, account_id, amount, interval, next_date, note, status
         FROM recurring WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT code, name, symbol, is_default FROM currencies WHERE user_id = ? ORDER BY created_at DESC LIMIT 30"
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      "SELECT category, sub_category, scope FROM categories WHERE user_id = ? ORDER BY category ASC, sort_order ASC LIMIT 200"
    )
      .bind(userId)
      .all(),
  ]);

  // Kartu kredit/paylater dimodelkan sebagai limit (creditLimit disimpan di
  // payload_json), bukan saldo kas — bongkar di sini supaya AI tidak perlu
  // parse JSON bersarang sendiri dari string.
  const accountsRaw = (accounts.results ?? []).map((a) => {
    let creditLimit = 0;
    if (a.payload_json) {
      try {
        const parsed = JSON.parse(a.payload_json) as { creditLimit?: number };
        creditLimit = Number(parsed.creditLimit) || 0;
      } catch {
        // payload_json tidak valid JSON — abaikan.
      }
    }
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency || "IDR",
      balance: a.balance,
      initialBalance: a.initial_balance,
      creditLimit,
    };
  });

  // AI sering keliru mengonversi lintas mata uang sendiri (mis. mengira
  // saldo KHR sudah dalam Rupiah, atau tidak bisa konversi USD karena kurs
  // di ringkasan pasar cuma mencakup beberapa mata uang). Hitung balanceIdr
  // di server pakai kurs live yang sama dipakai transaksi/investasi
  // (fetchIdrConversionRate), supaya AI tinggal baca angkanya, tidak perlu
  // menghitung sendiri.
  const uniqueCurrencies = Array.from(
    new Set(accountsRaw.map((a) => a.currency).filter((c) => c && c !== "IDR"))
  );
  const rateEntries = await Promise.all(
    uniqueCurrencies.map(async (c) => [c, await fetchIdrConversionRate(c)] as const)
  );
  const rateByCurrency = new Map(rateEntries);
  const accountsClean = accountsRaw.map((a) => {
    const rate = a.currency === "IDR" ? 1 : rateByCurrency.get(a.currency);
    return {
      ...a,
      balanceIdr: typeof rate === "number" ? Math.round(a.balance * rate) : null,
    };
  });
  const totalBalanceIdr = accountsClean.reduce((s, a) => s + (a.balanceIdr ?? 0), 0);
  const accountsMissingRate = accountsClean.filter((a) => a.balanceIdr === null).map((a) => a.currency);

  return {
    accounts: accountsClean,
    totalBalanceIdr,
    accountsMissingRate: accountsMissingRate.length > 0 ? Array.from(new Set(accountsMissingRate)) : undefined,
    transactions: transactions.results,
    budgets: budgets.results,
    investments: investments.results,
    savings: savings.results,
    recurring: recurring.results,
    currencies: currencies.results,
    categories: categories.results,
  };
};

// Snapshot data pasar (kripto + emas + kurs) di-cache di edge Cloudflare (bukan
// cuma memori per-isolate) agar tiap chat baru tidak memicu fetch baru ke
// CoinGecko — isolate Worker sering di-reset di trafik rendah, dan CoinGecko
// membatasi rate limit publiknya dengan ketat (429 kalau terlalu sering).
type MarketSnapshot = { text: string; fetchedAt: number };
let marketSnapshotCache: MarketSnapshot | null = null;
const MARKET_CACHE_MS = 5 * 60 * 1000;
const MARKET_CACHE_KEY = new Request("https://cache.internal.leosiqra.com/market-snapshot");

const fetchMarketSnapshot = async (): Promise<string> => {
  if (marketSnapshotCache && Date.now() - marketSnapshotCache.fetchedAt < MARKET_CACHE_MS) {
    return marketSnapshotCache.text;
  }

  const edgeCache = caches.default;
  const cachedRes = await edgeCache.match(MARKET_CACHE_KEY);
  if (cachedRes) {
    const text = await cachedRes.text();
    marketSnapshotCache = { text, fetchedAt: Date.now() };
    return text;
  }

  try {
    const [cryptoRes, fxRes] = await Promise.all([
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,holotoken,pax-gold&vs_currencies=usd&include_24hr_change=true",
        { headers: { "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)", Accept: "application/json" } }
      ),
      fetch("https://open.er-api.com/v6/latest/USD", {
        headers: { "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)", Accept: "application/json" },
      }),
    ]);

    // Kalau salah satu API gagal (mis. CoinGecko lagi rate-limit), jangan
    // gagalkan SELURUH snapshot — dulu satu gagal bikin baris yang lain (kurs
    // USD/IDR dari provider terpisah) ikut tidak tersedia padahal datanya ada.
    // Tampilkan degradasi sebagian: baris yang gagal jadi "tidak tersedia",
    // baris yang berhasil tetap tampil.
    if (!cryptoRes.ok) {
      console.error("CoinGecko fetch gagal:", cryptoRes.status, (await cryptoRes.text()).slice(0, 200));
    }
    if (!fxRes.ok) {
      console.error("Exchange-rate fetch gagal:", fxRes.status, (await fxRes.text()).slice(0, 200));
    }
    if (!cryptoRes.ok && !fxRes.ok) {
      // Keduanya gagal — pakai cache lama kalau ada, biar percobaan
      // berikutnya (setelah rate limit reda) yang menyegarkan.
      if (marketSnapshotCache) return marketSnapshotCache.text;
      throw new Error(`Fetch data pasar gagal (crypto ${cryptoRes.status}, fx ${fxRes.status})`);
    }

    const crypto = cryptoRes.ok
      ? ((await cryptoRes.json()) as Record<string, { usd?: number; usd_24h_change?: number }>)
      : {};
    const fx = fxRes.ok ? ((await fxRes.json()) as { rates?: Record<string, number> }) : {};
    const idrRate = fx.rates?.IDR;

    const NA = "tidak tersedia";
    const fmtUsd = (n?: number) =>
      typeof n === "number" ? `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 2 })}` : NA;
    const fmtChange = (n?: number) => (typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : NA);
    const goldPerGramIdr =
      crypto["pax-gold"]?.usd && idrRate ? (crypto["pax-gold"].usd * idrRate) / 31.1035 : undefined;

    const lines = [
      `USD/IDR: ${idrRate ? `Rp${Math.round(idrRate).toLocaleString("id-ID")}` : NA}`,
      `BTC/USD: ${fmtUsd(crypto.bitcoin?.usd)} (${fmtChange(crypto.bitcoin?.usd_24h_change)} 24 jam)`,
      `ETH/USD: ${fmtUsd(crypto.ethereum?.usd)} (${fmtChange(crypto.ethereum?.usd_24h_change)} 24 jam)`,
      `SOL/USD: ${fmtUsd(crypto.solana?.usd)} (${fmtChange(crypto.solana?.usd_24h_change)} 24 jam)`,
      `HOT/USD: ${fmtUsd(crypto.holotoken?.usd)} (${fmtChange(crypto.holotoken?.usd_24h_change)} 24 jam)`,
      `Emas (XAU) per gram: ${goldPerGramIdr ? `Rp${Math.round(goldPerGramIdr).toLocaleString("id-ID")}` : NA} (${fmtChange(crypto["pax-gold"]?.usd_24h_change)} 24 jam)`,
    ];

    const text = lines.join("\n");
    marketSnapshotCache = { text, fetchedAt: Date.now() };
    await edgeCache.put(
      MARKET_CACHE_KEY,
      new Response(text, { headers: { "Cache-Control": `max-age=${MARKET_CACHE_MS / 1000}` } })
    );
    return text;
  } catch (error) {
    console.error("Gagal mengambil data pasar untuk AI:", error);
    return marketSnapshotCache?.text ?? "Data pasar sedang tidak tersedia saat ini.";
  }
};

const buildAiSystemPrompt = (userContext: unknown, marketSnapshot: string) => `Kamu adalah Leosiqra, asisten AI di aplikasi pencatatan keuangan pribadi Leosiqra.

PENTING — DATA PASAR REAL-TIME (WAJIB DIBACA):
Sistem SUDAH mengambil data pasar berikut secara real-time khusus untuk menjawab pertanyaanmu saat ini. Ini BUKAN data lama atau perkiraan — ini angka aktual dari beberapa menit terakhir:
${marketSnapshot}

Jika user bertanya soal harga kripto, emas, atau kurs USD/IDR, JAWAB LANGSUNG memakai angka-angka di atas — SALIN persis apa adanya, jangan dibulatkan atau diubah. JANGAN PERNAH bilang "saya tidak punya akses data real-time" atau "saya tidak tahu harga terkini" — kamu SUDAH diberi data itu di atas, gunakan! Jika salah satu baris data bertuliskan "tidak tersedia", katakan JUJUR bahwa data itu sedang tidak tersedia — JANGAN mengarang angka 0 atau angka lain untuk menggantikannya.

Kamu boleh menjawab pertanyaan APA SAJA, termasuk topik umum di luar keuangan — layaknya asisten AI serba bisa. Namun keahlian dan fokus utamamu adalah membantu pengguna memahami serta mengelola data keuangan pribadi mereka sendiri di aplikasi ini (transaksi, rekening, investasi, tabungan, budget, recurring, hutang/piutang). Setiap kali pertanyaan menyentuh keuangan pengguna, SELALU rujuk data konkret di bawah ini dan jawab dengan angka nyata — jangan mengarang angka atau data yang tidak ada.

Cara membaca Konteks Data Keuangan Pengguna di bawah:
- Setiap akun di "accounts" punya field "currency" (mata uang ASLI akun itu — bisa IDR, USD, KHR, dll) dan "balance" (saldo dalam mata uang ASLI itu, BUKAN Rupiah kalau currency-nya bukan IDR). JANGAN PERNAH menyebut "balance" sebagai "Rupiah" kalau currency akun itu bukan "IDR" — sebut sesuai currency aslinya (mis. "175.000 KHR", bukan "175.000 Rupiah").
- Untuk menjumlahkan/membandingkan saldo LINTAS akun berbeda mata uang, JANGAN hitung sendiri — server SUDAH menghitungkan "balanceIdr" (saldo akun itu dikonversi ke Rupiah) per akun, dan "totalBalanceIdr" (total semua akun, sudah dijumlah dalam Rupiah) di level teratas konteks. Pakai kedua field itu langsung. Kalau "balanceIdr" suatu akun bernilai null, itu berarti kursnya sedang tidak tersedia (lihat "accountsMissingRate") — sebutkan JUJUR bahwa akun itu belum bisa dikonversi, jangan dijumlah sebagai 0 atau diabaikan diam-diam dari total.
- Pola sama berlaku di "transactions"/"savings"/"investments": field amount_idr (sudah dikonversi ke Rupiah oleh server) dipakai untuk menjumlahkan/membandingkan lintas mata uang — jangan jumlahkan field "amount" mentah dari mata uang berbeda seolah semuanya Rupiah.
- Akun bertipe "Credit Card"/"kartu" TIDAK memakai "balance" sebagai saldo kas — itu limit kartu. Terpakai = initialBalance + total pengeluaran dari akun ini (transaksi type pengeluaran/debt kategori Piutang dengan account_id ini) − total pemasukan ke akun ini; Sisa Limit = creditLimit − Terpakai.
- Transaksi dengan type "debt": category "Hutang" berarti pengguna berutang, category "Piutang" berarti pengguna memberi pinjaman. payment_status "lunas" berarti sudah selesai — jangan hitung yang lunas sebagai hutang/piutang aktif.
- Field "currencies" adalah daftar mata uang yang dipakai pengguna (bukan saldo), dipakai kalau ditanya mata uang apa saja yang mereka lacak.
- Field "categories" adalah daftar kategori/subkategori custom yang pengguna buat sendiri (bukan transaksi) — pakai ini kalau ditanya kategori apa saja yang mereka punya, atau untuk mencocokkan nama kategori yang benar (jangan mengarang nama kategori yang tidak ada di daftar ini).
- Untuk pertanyaan soal "hari ini"/"kemarin"/tanggal tertentu di "transactions"/"savings", PAKAI field "display_date" (bukan "date" mentah) sebagai tanggal yang dilihat pengguna di aplikasi — keduanya bisa beda sehari karena penyesuaian zona waktu WIB. Kalau "display_date" kosong/null, baru pakai "date" sebagai fallback.
- Transaksi dengan type "transfer" (atau yang punya "target_account_id" terisi) adalah perpindahan dana ANTAR rekening milik pengguna sendiri (dari account_id ke target_account_id) — bukan pengeluaran/pemasukan riil, jangan dihitung sebagai belanja atau penghasilan.
- Di "investments", field "transaction_type" membedakan baris "Beli"/"Pembelian" (menambah posisi) vs "Jual"/"Penjualan" (realisasi/keluar posisi) — jangan jumlahkan keduanya begitu saja sebagai total investasi aktif. Field "date_invested" adalah tanggal transaksinya, "stock_code"/"exchange_code" khusus saham, "quantity"/"unit" khusus emas/kripto/aset lain.

Konteks Data Keuangan Pengguna (JSON):
${JSON.stringify(userContext, null, 2)}

Aturan:
- Jawab dalam Bahasa Indonesia, ringkas, jelas, dan ramah.
- Gunakan format Rupiah yang jelas saat membahas nominal.
- Jangan menjanjikan keuntungan investasi yang pasti.
- Jika data spesifik yang diminta memang tidak ada di konteks (bukan soal data pasar di atas), sampaikan dengan jujur alih-alih mengarang.
- Untuk pertanyaan di luar topik keuangan, jawab senormal asisten AI pada umumnya.`;

// Beberapa provider di balik OpenRouter membatasi akses berdasarkan region IP
// pemanggil — IP edge Cloudflare Workers bisa saja diblokir oleh satu provider
// meski modelnya sendiri valid. Kirim beberapa kandidat model sekaligus
// (fitur routing/fallback bawaan OpenRouter) supaya jika satu provider
// menolak, permintaan otomatis dicoba ke provider/model berikutnya.
const OPENROUTER_FALLBACK_MODELS = [
  "meta-llama/llama-3.1-8b-instruct",
  "deepseek/deepseek-chat",
  "google/gemini-2.0-flash-001",
];

const runOpenRouterAssistant = async (
  env: Env,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  prompt: string
) => {
  if (!env.OPENROUTER_API_KEY) {
    return "AI belum dikonfigurasi. Simpan `OPENROUTER_API_KEY` di Cloudflare untuk mengaktifkan asisten.";
  }

  // Batasi riwayat agar konteks tidak membengkak tanpa batas.
  const recentHistory = history.slice(-20);

  const preferredModel = env.OPENROUTER_MODEL;
  const models = preferredModel
    ? [preferredModel, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== preferredModel)]
    : OPENROUTER_FALLBACK_MODELS;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "http-referer": env.APP_URL || "https://www.leosiqra.com",
      "x-title": env.APP_NAME || "Leosiqra",
    },
    body: JSON.stringify({
      models,
      route: "fallback",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory,
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenRouter request gagal (${response.status}): ${payload.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const textOutput = data.choices?.[0]?.message?.content?.trim();
  return textOutput || "Maaf, saya belum bisa memproses pertanyaan Anda saat ini.";
};

const runAiAssistant = async (
  env: Env,
  prompt: string,
  userContext: unknown,
  history: Array<{ role: "user" | "assistant"; content: string }>
) => {
  const marketSnapshot = await fetchMarketSnapshot();
  const systemPrompt = buildAiSystemPrompt(userContext, marketSnapshot);
  return runOpenRouterAssistant(env, systemPrompt, history, prompt);
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

  if (!(await checkRateLimit(env, [`register:ip:${clientIpOf(request)}`]))) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat." }, { status: 429 });
  }

  const existing = await env.DB.prepare("SELECT id, role, plan, status, password_hash FROM users WHERE email = ?")
    .bind(payload.email.toLowerCase())
    .first<{
      id: string;
      role: "admin" | "user";
      plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
      password_hash: string;
    }>();

  if (existing) {
    if (existing.role === "admin") {
      return json({ error: "Email admin tidak bisa diregister ulang." }, { status: 409 });
    }

    // Cuma boleh "klaim" akun yang belum pernah punya password lokal beneran
    // (mis. akun yang baru pernah login lewat Google, sentinel `oauth$google`).
    // Kalau sudah ada password asli, register ulang WAJIB ditolak — kalau tidak,
    // siapapun yang tahu email orang lain bisa timpa password (+ 2FA) orang itu
    // dan langsung login sebagai dia tanpa verifikasi apapun (account takeover).
    if (existing.password_hash !== "oauth$google") {
      return json(
        { error: "Email sudah terdaftar. Silakan login, atau gunakan menu lupa password." },
        { status: 409 }
      );
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
  const trial = await computeTrialGrant(env);
  await env.DB.prepare(
    `INSERT INTO users (
      id, name, email, password_hash, whatsapp, role, plan, status, expired_at, two_factor_secret, currency_initialized, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'user', 'FREE', ?, ?, ?, 0, ?, ?)`
  )
    .bind(
      userId,
      payload.name,
      payload.email.toLowerCase(),
      await hashPassword(payload.password),
      payload.whatsapp ?? null,
      trial.status,
      trial.expiredAt,
      payload.twoFactorSecret ?? null,
      nowIso(),
      nowIso()
    )
    .run();

  const user: AppUser = {
    id: userId,
    email: payload.email.toLowerCase(),
    name: payload.name,
    role: "user",
    plan: "FREE",
    status: trial.status,
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
    isPwa?: boolean;
  }>(request);

  if (!payload.email || !payload.password) {
    return json({ error: "Email/Username dan password wajib diisi." }, { status: 400 });
  }

  // Field "email" di payload sengaja tetap dipakai buat identifier login secara
  // umum (email ATAU username, lihat kolom users.username) — menghindari ganti
  // nama field di semua caller, cukup tebak dari isinya: ada "@" -> email.
  const identifier = payload.email.trim().toLowerCase();
  const isEmailIdentifier = identifier.includes("@");
  if (
    !(await checkRateLimit(env, [
      `login:ip:${clientIpOf(request)}`,
      `login:identifier:${identifier}`,
    ]))
  ) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat." }, { status: 429 });
  }

  const user = await env.DB.prepare(
    `SELECT id, name, email, password_hash, role, plan, status, whatsapp, two_factor_secret
       FROM users
      WHERE ${isEmailIdentifier ? "email" : "LOWER(username)"} = ?`
  )
    .bind(identifier)
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
    return json({ error: "Email/Username atau password tidak valid." }, { status: 401 });
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

  const session = await createSession(
    env,
    request,
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      status: user.status,
      whatsapp: user.whatsapp,
      two_factor_secret: user.two_factor_secret,
    },
    { permanent: payload.isPwa === true }
  );

  // Non-fatal: batasi jumlah sesi web bersamaan & kabari device lain kalau ada
  // login baru — jangan sampai gagal di sini menggagalkan login itu sendiri.
  try {
    await enforceSessionCap(env, user.id);
  } catch (error) {
    console.error("Gagal enforce session cap:", error);
  }
  try {
    const deviceLabel = describeUserAgent(request.headers.get("user-agent"));
    const when = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    });
    await sendWebPushToUser(
      env,
      user.id,
      "Login Baru Terdeteksi",
      `${deviceLabel} · ${when} WIB`,
      "/membership/profile"
    );
  } catch (error) {
    console.error("Gagal kirim notifikasi login baru:", error);
  }

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
      sessionCookie(env, session.token, session.maxAgeSeconds),
      roleCookie(env, user.role, session.maxAgeSeconds),
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
          whatsapp: settings.whatsapp,
        }
      : null,
    // Kontak publik (WA/email) — sengaja dipisah dari /api/admin/settings
    // (admin-only) supaya halaman Hubungi Kami tetap tampil untuk pengunjung
    // yang belum login maupun member biasa (bukan admin).
    contact: settings
      ? {
          whatsapp: settings.whatsapp,
          billingEmail: settings.billing_email,
        }
      : null,
    // Profil developer (foto + kata motivasi) untuk landing page — publik,
    // tapi cuma SUPERADMIN_EMAIL yang bisa mengubahnya lewat /api/admin/settings.
    developer: settings
      ? {
          name: settings.developer_name,
          photoUrl: settings.developer_photo_url,
          quote: settings.developer_quote,
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

const googleRedirectUri = (url: URL) => `${url.origin}/api/auth/google/callback`;

const oauthStateCookie = (state: string) =>
  `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

const clearOauthStateCookie = () =>
  `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

async function handleGoogleStart(request: Request, env: Env) {
  const url = new URL(request.url);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(
      `${url.origin}/auth/login?error=${encodeURIComponent("Login Google belum dikonfigurasi.")}`,
      302
    );
  }

  const state = generateId();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(url),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const headers = new Headers({
    location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
  headers.append("set-cookie", oauthStateCookie(state));
  return new Response(null, { status: 302, headers });
}

async function handleGoogleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const failRedirect = (message: string) => {
    const headers = new Headers({
      location: `${url.origin}/auth/login?error=${encodeURIComponent(message)}`,
    });
    headers.append("set-cookie", clearOauthStateCookie());
    return new Response(null, { status: 302, headers });
  };

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return failRedirect("Login Google belum dikonfigurasi.");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookieValue(request, "oauth_state");
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) {
    return failRedirect("Sesi login Google tidak valid. Silakan coba lagi.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(url),
    }).toString(),
  });
  if (!tokenResponse.ok) {
    return failRedirect("Gagal memverifikasi akun Google.");
  }
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return failRedirect("Token Google tidak ditemukan.");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) {
    return failRedirect("Gagal mengambil profil Google.");
  }
  const profile = (await profileResponse.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.email || profile.email_verified === false) {
    return failRedirect("Email Google belum terverifikasi.");
  }

  const email = profile.email.toLowerCase();
  let user = await env.DB.prepare(
    `SELECT id, name, email, role, plan, status, whatsapp, two_factor_secret, photo_url
       FROM users WHERE email = ?`
  )
    .bind(email)
    .first<{
      id: string;
      name: string;
      email: string;
      role: "admin" | "user";
      plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
      whatsapp?: string | null;
      two_factor_secret?: string | null;
      photo_url?: string | null;
    }>();

  if (!user) {
    const userId = generateId();
    const displayName = profile.name?.trim() || email.split("@")[0];
    // Sentinel hash: akun Google tidak punya password lokal (login password nonaktif).
    const trial = await computeTrialGrant(env);
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, password_hash, photo_url, role, plan, status, expired_at, currency_initialized, created_at, updated_at)
       VALUES (?, ?, ?, 'oauth$google', ?, 'user', 'FREE', ?, ?, 0, ?, ?)`
    )
      .bind(userId, displayName, email, profile.picture ?? null, trial.status, trial.expiredAt, nowIso(), nowIso())
      .run();
    user = {
      id: userId,
      name: displayName,
      email,
      role: "user",
      plan: "FREE",
      status: trial.status,
      whatsapp: null,
      two_factor_secret: null,
      photo_url: profile.picture ?? null,
    };
  } else if (profile.picture && !user.photo_url) {
    await env.DB.prepare("UPDATE users SET photo_url = ? WHERE id = ?")
      .bind(profile.picture, user.id)
      .run();
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

  const destination = user.role === "admin" ? "/admin" : "/membership/dashboard";
  const headers = new Headers({ location: `${url.origin}${destination}` });
  headers.append("set-cookie", clearOauthStateCookie());
  headers.append("set-cookie", sessionCookie(env, session.token, 60 * 60 * 24 * 30));
  headers.append("set-cookie", roleCookie(env, user.role, 60 * 60 * 24 * 30));
  return new Response(null, { status: 302, headers });
}

async function handleListTransactions(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "50");
  // Cap dinaikkan agar laporan bulanan/tahunan tidak diam-diam kehilangan transaksi lama
  // dari periode yang dipilih (dashboard menyaring berdasarkan tanggal di sisi client).
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 2000) : 50;
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

// Dipakai saat klien (mis. Shortcut iOS) mengirim transaksi dalam mata uang
// asing tanpa amount_idr — API publik gratis yang sama dipakai frontend
// (exchangeRateService), supaya nilai IDR-nya tetap akurat tanpa klien
// perlu tahu kurs sama sekali.
const fetchIdrConversionRate = async (currency: string): Promise<number | null> => {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.IDR;
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
};

// Dipakai savings & investments (sama seperti transaksi): kalau klien tidak
// kirim nilai IDR yang valid (mis. fetch kurs gagal di browser karena
// firewall/CORS), hitung ulang di server lewat fetchIdrConversionRate alih-alih
// diam-diam menyimpan amount mentah seolah sudah IDR.
const resolveIdrAmount = async (
  currency: string,
  amount: number,
  providedIdr: unknown
): Promise<number> => {
  if (typeof providedIdr === "number" && Number.isFinite(providedIdr) && providedIdr > 0) {
    return providedIdr;
  }
  if (currency && currency !== "IDR") {
    const rate = await fetchIdrConversionRate(currency);
    if (rate) return amount * rate;
  }
  return amount;
};

interface TransactionInsertParams {
  type: string;
  amount: number;
  amountIdr?: number;
  category?: string | null;
  subCategory?: string | null;
  currency?: string;
  accountId?: string | null;
  targetAccountId?: string | null;
  date: string;
  displayDate?: string;
  note?: string | null;
  status?: string;
  lenderName?: string | null;
  totalDebt?: number | null;
  installmentTenor?: number | null;
  monthlyInterest?: number | null;
  totalInterest?: number | null;
  paymentStatus?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
}

// Inti pembuatan transaksi, dipakai bersama oleh endpoint umum
// (/api/member/transactions) dan endpoint ringkas untuk otomasi eksternal
// (/api/member/quick-transaction) supaya logikanya (konversi IDR, publish
// realtime) tidak dobel.
const insertTransactionRecord = async (env: Env, userId: string, params: TransactionInsertParams) => {
  const currency = params.currency ?? "IDR";
  let amountIdr = params.amountIdr;
  if (amountIdr === undefined && currency !== "IDR") {
    const rate = await fetchIdrConversionRate(currency);
    if (rate) {
      amountIdr = params.amount * rate;
    }
  }
  if (amountIdr === undefined) {
    amountIdr = params.amount;
  }

  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, user_id, type, amount, amount_idr, category, sub_category, currency,
      account_id, target_account_id, lender_name, total_debt, installment_tenor,
      monthly_interest, total_interest, date, display_date, note, status,
      payment_status, related_id, related_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      params.type,
      params.amount,
      amountIdr,
      params.category ?? null,
      params.subCategory ?? null,
      currency,
      params.accountId ?? null,
      params.targetAccountId ?? null,
      params.lenderName ?? null,
      params.totalDebt ?? null,
      params.installmentTenor ?? null,
      params.monthlyInterest ?? null,
      params.totalInterest ?? null,
      params.date,
      params.displayDate ?? params.date,
      params.note ?? null,
      params.status ?? "VERIFIED",
      params.paymentStatus ?? null,
      params.relatedId ?? null,
      params.relatedType ?? null,
      nowIso(),
      nowIso()
    )
    .run();

  const durableId = env.REALTIME_ROOM.idFromName(`member:${userId}`);
  await env.REALTIME_ROOM.get(durableId).fetch("https://realtime.internal/publish", {
    method: "POST",
    body: JSON.stringify({
      event: "transaction.created",
      payload: { id, userId },
    }),
  });

  return id;
};

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
    status?: string;
    lender_name?: string;
    total_debt?: number;
    installment_tenor?: number;
    monthly_interest?: number;
    total_interest?: number;
    payment_status?: string;
    related_id?: string;
    related_type?: string;
  }>(request);

  if (!payload.type || !payload.amount || !payload.date) {
    return json({ error: "type, amount, dan date wajib diisi." }, { status: 400 });
  }

  const id = await insertTransactionRecord(env, authResult.session.user.id, {
    type: payload.type,
    amount: payload.amount,
    amountIdr: payload.amount_idr,
    category: payload.category,
    subCategory: payload.sub_category,
    currency: payload.currency,
    accountId: payload.account_id,
    targetAccountId: payload.target_account_id,
    date: payload.date,
    displayDate: payload.display_date,
    status: payload.status,
    lenderName: payload.lender_name,
    totalDebt: payload.total_debt,
    installmentTenor: payload.installment_tenor,
    monthlyInterest: payload.monthly_interest,
    totalInterest: payload.total_interest,
    paymentStatus: payload.payment_status,
    relatedId: payload.related_id,
    relatedType: payload.related_type,
    note: payload.note,
  });

  return json({ ok: true, id }, { status: 201 });
}

// Endpoint ringkas untuk otomasi eksternal (Shortcut iOS, dll): akun & kategori
// cukup dikirim sebagai teks biasa (dicocokkan ke data asli di sini), dan
// tanggal default ke hari ini — supaya Shortcut tidak perlu langkah
// Get Contents of URL/Choose from List/Filter berlapis untuk sekadar
// menentukan account_id.
async function handleQuickTransaction(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{
    type?: string;
    amount?: number;
    category?: string;
    sub_category?: string;
    account?: string;
    note?: string;
    date?: string;
  }>(request);

  // Shortcut iOS (Ask Each Time) mengirim semuanya sebagai teks, jadi normalisasi
  // dulu: type di-lowercase/trim, amount di-Number-kan supaya "50000" tetap valid.
  const rawType = typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
  const type = rawType === "pemasukan" ? "pemasukan" : rawType === "pengeluaran" ? "pengeluaran" : null;
  const amount = Number(payload.amount);
  if (!type || !Number.isFinite(amount) || amount <= 0) {
    return json({ error: "type (pengeluaran/pemasukan) dan amount wajib diisi." }, { status: 400 });
  }
  if (!payload.account || !payload.account.trim()) {
    return json({ error: "account wajib diisi." }, { status: 400 });
  }

  const accounts = await env.DB.prepare("SELECT id, name, currency FROM accounts WHERE user_id = ?")
    .bind(authResult.session.user.id)
    .all<{ id: string; name: string; currency: string }>();

  const needle = payload.account.trim().toLowerCase();
  const match =
    accounts.results?.find((a) => a.name.toLowerCase() === needle) ??
    accounts.results?.find((a) => a.name.toLowerCase().includes(needle));

  if (!match) {
    const available = (accounts.results ?? []).map((a) => a.name).join(", ") || "(belum ada rekening)";
    return json({ error: `Akun "${payload.account}" tidak ditemukan. Akun tersedia: ${available}` }, { status: 404 });
  }

  const id = await insertTransactionRecord(env, authResult.session.user.id, {
    type,
    amount,
    category: payload.category?.trim() || undefined,
    subCategory: payload.sub_category?.trim() || undefined,
    currency: match.currency,
    accountId: match.id,
    date: payload.date ?? todayWIB(),
    note: payload.note?.trim() || undefined,
  });

  // Endpoint transaksi biasa (/api/member/transactions) menyerahkan update saldo
  // ke klien (accountService.updateAccountBalance) — tapi quick-transaction ini
  // dipakai otomasi (Shortcut iOS/Input Cepat) yang tidak melakukan panggilan
  // kedua itu, jadi saldo harus di-update di sini juga supaya tidak diam-diam
  // tertinggal nol.
  await env.DB.prepare(
    `UPDATE accounts
        SET balance = balance + ?
      WHERE id = ? AND user_id = ?`
  )
    .bind(type === "pemasukan" ? amount : -amount, match.id, authResult.session.user.id)
    .run();

  return json({ ok: true, id, matchedAccount: match.name, currency: match.currency }, { status: 201 });
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
      ORDER BY sort_order ASC, created_at DESC`
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
  // Data ekstra akun (cardColor, creditLimit utk kartu kredit/paylater) dititipkan
  // di kolom payload_json agar tidak perlu migrasi skema.
  const extra: Record<string, unknown> = {};
  if (payload.card_color) extra.cardColor = payload.card_color;
  if (payload.credit_limit !== undefined) extra.creditLimit = Number(payload.credit_limit) || 0;
  const payloadJson = Object.keys(extra).length ? JSON.stringify(extra) : null;

  // Rekening baru selalu masuk paling akhir di daftar — ambil sort_order
  // tertinggi yang ada lalu +1.
  const maxRow = await env.DB.prepare(
    `SELECT MAX(sort_order) as maxOrder FROM accounts WHERE user_id = ?`
  )
    .bind(authResult.session.user.id)
    .first<{ maxOrder: number | null }>();
  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  await env.DB.prepare(
    `INSERT INTO accounts (
      id, user_id, name, type, currency, balance, initial_balance, base_value, logo_url, logo_label, payload_json, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      payload.logo_label ?? null,
      payloadJson,
      nextOrder,
      nowIso(),
      nowIso()
    )
    .run();

  return json({ ok: true, id }, { status: 201 });
}

// Reorder sekaligus banyak rekening (hasil drag-and-drop di halaman Kartu
// Saya) — index di array `ids` jadi sort_order barunya.
async function handleReorderAccounts(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ ids?: string[] }>(request);
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  if (ids.length === 0) {
    return json({ error: "ids wajib diisi." }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i++) {
    await env.DB.prepare(
      `UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    )
      .bind(i, nowIso(), ids[i], authResult.session.user.id)
      .run();
  }

  return json({ ok: true });
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

  if (payload.card_color !== undefined || payload.credit_limit !== undefined) {
    const existing = await env.DB.prepare("SELECT payload_json FROM accounts WHERE id = ? AND user_id = ?")
      .bind(accountId, authResult.session.user.id)
      .first<{ payload_json: string | null }>();
    let payloadObj: Record<string, unknown> = {};
    if (existing?.payload_json) {
      try {
        payloadObj = JSON.parse(existing.payload_json);
      } catch {
        // payload_json lama tidak valid JSON — mulai dari objek kosong.
      }
    }
    if (payload.card_color !== undefined) payloadObj.cardColor = payload.card_color;
    if (payload.credit_limit !== undefined) payloadObj.creditLimit = Number(payload.credit_limit) || 0;
    entries.push(["payload_json", JSON.stringify(payloadObj)]);
  }

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

// ===== Backfill logo bank/e-wallet Indonesia untuk rekening lama =====
// Duplikat kecil dari src/lib/indonesianBanks.ts (frontend) — worker & Next.js
// di-build terpisah di repo ini (lihat juga CRYPTO_ID_MAP di market-data page
// vs snapshot pasar di worker), jadi daftar ini sengaja disalin, bukan di-share.
interface BankLogoEntry {
  domain: string;
  aliases: string[];
}

const BANK_LOGO_ENTRIES: BankLogoEntry[] = [
  { domain: "bca.co.id", aliases: ["bca"] },
  { domain: "bankmandiri.co.id", aliases: ["bank mandiri", "mandiri"] },
  { domain: "bri.co.id", aliases: ["bri"] },
  { domain: "bni.co.id", aliases: ["bni"] },
  { domain: "cimbniaga.co.id", aliases: ["cimb niaga", "cimb"] },
  { domain: "danamon.co.id", aliases: ["danamon"] },
  { domain: "permatabank.com", aliases: ["permata"] },
  { domain: "btpn.com", aliases: ["btpn"] },
  { domain: "jenius.com", aliases: ["jenius"] },
  { domain: "ocbcnisp.com", aliases: ["ocbc nisp", "ocbc"] },
  { domain: "maybank.co.id", aliases: ["maybank"] },
  { domain: "bankmega.com", aliases: ["bank mega", "mega"] },
  { domain: "sinarmas.co.id", aliases: ["sinarmas"] },
  { domain: "btn.co.id", aliases: ["btn"] },
  { domain: "kbbukopin.co.id", aliases: ["bukopin", "kb bank"] },
  { domain: "panin.co.id", aliases: ["panin"] },
  { domain: "bankbjb.co.id", aliases: ["bjb", "bank jabar"] },
  { domain: "jago.com", aliases: ["bank jago", "jago"] },
  { domain: "seabank.co.id", aliases: ["seabank", "sea bank"] },
  { domain: "allobank.com", aliases: ["allo bank", "allobank"] },
  { domain: "dbs.com", aliases: ["dbs", "digibank"] },
  { domain: "hsbc.co.id", aliases: ["hsbc"] },
  { domain: "uob.co.id", aliases: ["uob"] },
  { domain: "sc.com", aliases: ["standard chartered", "stanchart"] },
  { domain: "citibank.co.id", aliases: ["citibank", "citi"] },
];

const EWALLET_LOGO_ENTRIES: BankLogoEntry[] = [
  { domain: "gojek.com", aliases: ["gopay"] },
  { domain: "ovo.id", aliases: ["ovo"] },
  { domain: "dana.id", aliases: ["dana"] },
  { domain: "shopeepay.co.id", aliases: ["shopeepay", "shopee pay"] },
  { domain: "linkaja.id", aliases: ["linkaja", "link aja"] },
  { domain: "flip.id", aliases: ["flip"] },
];

const matchLogoDomain = (accountName: string, entries: BankLogoEntry[]): string | null => {
  const q = accountName.trim().toLowerCase();
  if (!q) return null;
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (q === alias || q.startsWith(`${alias} `)) return entry.domain;
    }
  }
  return null;
};

const matchIndonesianInstitutionLogo = (accountName: string, accountType: string, logoDevToken?: string): string | null => {
  const entries =
    accountType === "E-Wallet"
      ? EWALLET_LOGO_ENTRIES
      : accountType === "Bank Account" || accountType === "Credit Card"
        ? BANK_LOGO_ENTRIES
        : null;
  if (!entries) return null;

  const domain = matchLogoDomain(accountName, entries);
  if (!domain) return null;

  // Token publishable logo.dev (dipasang buat gambar HD) — kalau belum di-set,
  // fallback ke favicon Google (resolusi rendah, tapi tetap tampil sesuatu).
  if (logoDevToken) {
    return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=128&format=png`;
  }
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
};

// One-off: isi logo_url untuk rekening LAMA yang cocok nama bank/e-wallet-nya
// dan belum punya logo sama sekali, ATAU yang masih pakai favicon Google lama
// (upgrade ke logo.dev) — tidak pernah menimpa logo hasil upload manual asli
// (mis. dari Cloudinary).
const backfillIndonesianBankLogos = async (env: Env): Promise<{ updated: number; checked: number }> => {
  const { results } = await env.DB.prepare(
    `SELECT id, name, type FROM accounts
      WHERE logo_url IS NULL OR logo_url = '' OR logo_url LIKE 'https://www.google.com/s2/favicons%'`
  ).all<{ id: string; name: string; type: string }>();
  const rows = results ?? [];

  let updated = 0;
  for (const row of rows) {
    const matched = matchIndonesianInstitutionLogo(row.name, row.type, env.LOGO_DEV_TOKEN);
    if (!matched) continue;
    await env.DB.prepare(`UPDATE accounts SET logo_url = ? WHERE id = ?`).bind(matched, row.id).run();
    updated++;
  }
  return { updated, checked: rows.length };
};

// One-off: pasang UNIQUE index di kolom username (case-insensitive, cuma untuk
// baris yang username-nya diisi — banyak user lama masih '' jadi tidak boleh
// kena unique juga). Pengecekan aplikasi di handleUpdateMemberProfile sudah
// mencegah tabrakan di alur normal, index ini cuma menutup celah race
// condition (dua request nyaris bersamaan) di level database.
const enforceUsernameUniqueIndex = async (
  env: Env
): Promise<{ ok: true } | { ok: false; duplicates: { username: string; count: number }[] }> => {
  const { results } = await env.DB.prepare(
    `SELECT LOWER(username) as username, COUNT(*) as count
       FROM users
      WHERE username IS NOT NULL AND username != ''
      GROUP BY LOWER(username)
     HAVING COUNT(*) > 1`
  ).all<{ username: string; count: number }>();

  if ((results ?? []).length > 0) {
    return { ok: false, duplicates: results as { username: string; count: number }[] };
  }

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(LOWER(username)) WHERE username IS NOT NULL AND username != ''`
  ).run();
  return { ok: true };
};

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
    "INSERT INTO budgets (id, user_id, type, category, amount, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      payload.type ?? "pengeluaran",
      payload.category ?? "Umum",
      Number(payload.amount ?? 0),
      payload.period ?? "monthly",
      nowIso(),
      nowIso()
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

// Harga saham live dari Yahoo Finance, diproksi lewat Worker (chart endpoint-nya
// tidak izinkan CORS dari browser). Di-cache per simbol biar tidak kena rate limit.
const YAHOO_EXCHANGE_SUFFIX: Record<string, string> = {
  IDX: ".JK",
};
const STOCK_PRICE_CACHE_MS = 5 * 60 * 1000;

async function fetchStockPrice(symbol: string, exchange: string) {
  const suffix = YAHOO_EXCHANGE_SUFFIX[exchange.toUpperCase()] ?? "";
  const yahooSymbol = `${symbol.toUpperCase()}${suffix}`;
  const cacheKey = new Request(`https://cache.internal.leosiqra.com/stock-price/${encodeURIComponent(yahooSymbol)}`);
  const edgeCache = caches.default;

  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    return (await cached.json()) as { price: number; currency: string; changePercent: number };
  }

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Yahoo Finance error ${res.status}`);
  }

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
      }>;
    };
  };
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`Simbol ${yahooSymbol} tidak ditemukan.`);
  }

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const result = { price, currency: meta.currency || "IDR", changePercent };

  await edgeCache.put(
    cacheKey,
    new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json", "Cache-Control": `max-age=${STOCK_PRICE_CACHE_MS / 1000}` },
    })
  );
  return result;
}

async function handleStockPrice(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const exchange = url.searchParams.get("exchange") || "IDX";
  if (!symbol) {
    return json({ error: "symbol wajib diisi." }, { status: 400 });
  }

  try {
    const data = await fetchStockPrice(symbol, exchange);
    return json(data);
  } catch (error) {
    console.error("fetchStockPrice failed", error);
    return json({ error: "Gagal mengambil harga saham." }, { status: 502 });
  }
}

// Cari kode saham dari Yahoo Finance (dipakai combobox "Kode Saham" — biar
// user tinggal pilih dari hasil pencarian, bukan hafal kode + upload logo
// manual). Diproksi lewat Worker karena search endpoint-nya juga tidak izinkan
// CORS langsung dari browser, sama seperti chart endpoint di atas.
type StockSearchResult = { symbol: string; name: string; exchangeCode: string; logoUrl: string };

async function fetchStockSearch(query: string, env: Env): Promise<StockSearchResult[]> {
  // v2: cache key sengaja diganti supaya entri lama dengan logoUrl yang salah
  // (simbol tanpa akhiran bursa, lihat catatan logoUrl di bawah) tidak kepakai lagi.
  const cacheKey = new Request(`https://cache.internal.leosiqra.com/stock-search-v2/${encodeURIComponent(query.toLowerCase())}`);
  const edgeCache = caches.default;

  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    return (await cached.json()) as StockSearchResult[];
  }

  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Yahoo Finance search error ${res.status}`);
  }

  const data = (await res.json()) as {
    quotes?: Array<{
      symbol: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
      exchDisp?: string;
    }>;
  };

  const results: StockSearchResult[] = (data.quotes ?? [])
    .filter((q) => q.quoteType === "EQUITY")
    .slice(0, 8)
    .map((q) => {
      const isJakarta = q.symbol.endsWith(".JK");
      const stockCode = isJakarta ? q.symbol.slice(0, -3) : q.symbol;
      const exchangeCode = isJakarta ? "IDX" : q.exchDisp || "";
      // Logo HARUS pakai simbol lengkap dengan akhiran bursa asli Yahoo
      // (mis. "BBCA.JK", "0700.HK") — simbol polos tanpa akhiran sering nyasar
      // ke instrumen lain yang kebetulan pakai kode sama (mis. "BBCA" polos
      // matched ke JPMorgan BetaBuilders Canada ETF, bukan Bank Central Asia).
      const logoUrl = env.LOGO_DEV_TOKEN
        ? `https://img.logo.dev/ticker/${encodeURIComponent(q.symbol)}?token=${env.LOGO_DEV_TOKEN}&size=128`
        : "";
      return {
        symbol: stockCode,
        name: q.longname || q.shortname || stockCode,
        exchangeCode,
        logoUrl,
      };
    });

  await edgeCache.put(
    cacheKey,
    new Response(JSON.stringify(results), {
      headers: { "content-type": "application/json", "Cache-Control": "max-age=1800" },
    })
  );
  return results;
}

async function handleStockSearch(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return json({ items: [] });
  }

  try {
    const items = await fetchStockSearch(q, env);
    return json({ items });
  } catch (error) {
    console.error("fetchStockSearch failed", error);
    return json({ error: "Gagal mencari saham." }, { status: 502 });
  }
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
  const currency = String(payload.currency ?? "IDR");
  const amountInvested = Number(payload.amount_invested ?? 0);
  const currentValue = Number(payload.current_value ?? 0);
  const amountIdr = await resolveIdrAmount(currency, amountInvested, payload.amount_idr);
  const currentValueIdr = await resolveIdrAmount(currency, currentValue, payload.current_value_idr);
  await env.DB.prepare(
    `INSERT INTO investments (
      id, user_id, name, type, platform, amount_invested, amount_idr, current_value, current_value_idr,
      return_percentage, tax_percentage, currency, duration_months, transaction_type, category, account_id,
      logo_url, quantity, unit, price_per_unit, stock_code, exchange_code, shares_count, price_per_share,
      date_invested, target_date, duration_days, status, maturity_action, related_investment_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.name ?? ""),
      String(payload.type ?? "Lainnya"),
      payload.platform ?? null,
      amountInvested,
      amountIdr,
      currentValue,
      currentValueIdr,
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
      payload.status ?? "Active",
      payload.maturity_action ?? null,
      payload.related_investment_id ?? null,
      nowIso(),
      nowIso()
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
    "maturity_action",
    "related_investment_id",
  ]);
  const entries = Object.entries(payload).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const result = await env.DB.prepare(
    `UPDATE investments
        SET ${assignments}, updated_at = ?
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, nowIso(), investmentId, authResult.session.user.id)
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
    `SELECT id, name, email, username, whatsapp, address, photo_url, role, plan, status, expired_at, created_at,
            total_wealth, total_income, total_expenses, total_savings, total_investment,
            credit_card_bills, other_debts, two_factor_secret, currency_initialized
       FROM users
      WHERE id = ?`
  )
    .bind(authResult.session.user.id)
    .first();

  return json({ item });
}

// Dipanggil dari tombol "Request Akses" di sidebar saat trial 14-hari sudah
// habis (status balik ke GUEST). Cuma pindah GUEST->PENDING supaya muncul di
// halaman admin/user untuk diverifikasi manual — bukan dari status lain,
// supaya tidak bisa dipakai untuk "reset" status NONAKTIF/PENDING sendiri.
async function handleRequestAccess(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const result = await env.DB.prepare(
    "UPDATE users SET status = 'PENDING' WHERE id = ? AND status = 'GUEST'"
  )
    .bind(authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Permintaan hanya bisa dikirim saat status akun GUEST." }, { status: 409 });
  }

  await sendTelegramNotification(
    env,
    `🔔 <b>Permintaan Akses Baru</b>\n` +
      `Nama: ${authResult.session.user.name}\n` +
      `Email: ${authResult.session.user.email}\n\n` +
      `Verifikasi di Admin &gt; Kelola Pelanggan.`
  );

  return json({ ok: true, status: "PENDING" });
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
    ["username", "username"],
    ["phone", "whatsapp"],
    ["address", "address"],
    // CATATAN KEAMANAN: plan/status/expired_at sengaja TIDAK diizinkan di sini.
    // Field billing hanya boleh diubah lewat alur admin (approve pembayaran)
    // agar member tidak bisa mengaktifkan PRO sendiri tanpa membayar.
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

  // Username dipakai sebagai identitas login alternatif (selain email, lihat
  // handleLogin) — tidak ada UNIQUE constraint di kolom ini (schema lama),
  // jadi keunikannya dijaga di level aplikasi, di sini, sebelum disimpan.
  if (payload.username !== undefined) {
    const normalizedUsername = String(payload.username ?? "").trim().toLowerCase();
    if (normalizedUsername) {
      if (!/^[a-z0-9_.]{3,20}$/.test(normalizedUsername)) {
        return json(
          { error: "Username 3-20 karakter, hanya huruf kecil/angka/underscore/titik (tanpa spasi)." },
          { status: 400 }
        );
      }
      const existing = await env.DB.prepare("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?")
        .bind(normalizedUsername, authResult.session.user.id)
        .first();
      if (existing) {
        return json({ error: "Username sudah dipakai user lain, coba yang lain." }, { status: 409 });
      }
    }
    payload.username = normalizedUsername;
  }

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

async function handleChangeMemberPassword(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ currentPassword?: string; newPassword?: string }>(request);
  if (!payload.newPassword) {
    return json({ error: "Password baru wajib diisi." }, { status: 400 });
  }
  if (payload.newPassword.length < 8) {
    return json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .bind(authResult.session.user.id)
    .first<{ id: string; password_hash: string }>();
  if (!user) {
    return json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  // Akun Google tidak punya password lokal (password_hash cuma sentinel
  // 'oauth$google') — jadi tidak ada apa pun untuk diverifikasi, biarkan
  // mereka langsung SET password baru (sesi yang aktif sudah jadi bukti
  // identitas). Akun biasa tetap wajib verifikasi password lama.
  const isOAuthAccount = user.password_hash.startsWith("oauth$");
  if (!isOAuthAccount) {
    if (!payload.currentPassword) {
      return json({ error: "Password saat ini wajib diisi." }, { status: 400 });
    }
    const verification = await verifyPassword(payload.currentPassword, user.password_hash);
    if (!verification.ok) {
      return json({ error: "Password saat ini tidak sesuai." }, { status: 401 });
    }
  }

  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(await hashPassword(payload.newPassword), user.id)
    .run();

  return json({ ok: true });
}

async function handleUpdateMemberTwoFactor(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ secret?: string; disable?: boolean; currentPassword?: string }>(request);

  if (payload.disable) {
    if (!payload.currentPassword) {
      return json({ error: "Password saat ini wajib diisi untuk menonaktifkan 2FA." }, { status: 400 });
    }
    const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .bind(authResult.session.user.id)
      .first<{ id: string; password_hash: string }>();
    if (!user) {
      return json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const verification = await verifyPassword(payload.currentPassword, user.password_hash);
    if (!verification.ok) {
      return json({ error: "Password saat ini tidak sesuai." }, { status: 401 });
    }
    await env.DB.prepare("UPDATE users SET two_factor_secret = NULL WHERE id = ?")
      .bind(authResult.session.user.id)
      .run();
    return json({ ok: true });
  }

  if (!payload.secret) {
    return json({ error: "Secret 2FA wajib diisi." }, { status: 400 });
  }
  await env.DB.prepare("UPDATE users SET two_factor_secret = ? WHERE id = ?")
    .bind(payload.secret, authResult.session.user.id)
    .run();
  return json({ ok: true });
}

// Tabel yang berisi data pribadi pengguna (transaksi, rekening, dst) yang
// dihapus total oleh "Reset Semua Data". Sengaja TIDAK termasuk: users
// (akun itu sendiri wajib tetap ada), sessions (agar tidak ter-logout),
// payments (riwayat pembayaran/billing tetap perlu untuk audit),
// admin_logs, auth_rate_limits, funnel_events, password_resets.
const RESET_DATA_TABLES = [
  "transactions",
  "accounts",
  "budgets",
  "categories",
  "currencies",
  "investments",
  "recurring",
  "savings",
  "ai_chats",
  "ai_chat_events",
  "uploads",
] as const;

async function handleResetMemberData(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<{ currentPassword?: string }>(request);

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .bind(authResult.session.user.id)
    .first<{ id: string; password_hash: string }>();
  if (!user) {
    return json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  // Akun Google tidak punya password lokal untuk diverifikasi — sesi yang
  // aktif + frasa konfirmasi ("HAPUS SEMUA DATA", dicek di frontend) jadi
  // gerbang keamanannya. Akun biasa tetap wajib masukkan password saat ini.
  const isOAuthAccount = user.password_hash.startsWith("oauth$");
  if (!isOAuthAccount) {
    if (!payload.currentPassword) {
      return json({ error: "Password saat ini wajib diisi." }, { status: 400 });
    }
    const verification = await verifyPassword(payload.currentPassword, user.password_hash);
    if (!verification.ok) {
      return json({ error: "Password saat ini tidak sesuai." }, { status: 401 });
    }
  }

  const statements = [
    ...RESET_DATA_TABLES.map((table) =>
      env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(user.id)
    ),
    env.DB.prepare(
      `UPDATE users
          SET total_wealth = 0, total_income = 0, total_expenses = 0, total_savings = 0,
              total_investment = 0, credit_card_bills = 0, other_debts = 0, currency_initialized = 0
        WHERE id = ?`
    ).bind(user.id),
  ];

  await env.DB.batch(statements);

  return json({ ok: true });
}

async function handleListCategories(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const rows = await env.DB.prepare(
    `SELECT *
       FROM categories
      WHERE user_id = ?
      ORDER BY category ASC, sort_order ASC, created_at ASC`
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
  const category = String(payload.category ?? "Lainnya");

  // Subkategori baru selalu masuk paling akhir di grup kategorinya —
  // ambil sort_order tertinggi yang ada lalu +1.
  const maxRow = await env.DB.prepare(
    `SELECT MAX(sort_order) as maxOrder FROM categories WHERE user_id = ? AND category = ?`
  )
    .bind(authResult.session.user.id, category)
    .first<{ maxOrder: number | null }>();
  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  await env.DB.prepare(
    "INSERT INTO categories (id, user_id, category, sub_category, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      category,
      String(pickPayloadValue(payload, "sub_category", "subCategory") ?? "General"),
      String(payload.status ?? "ACTIVE"),
      nextOrder,
      nowIso(),
      nowIso()
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
  if (payload.sort_order !== undefined || payload.sortOrder !== undefined) {
    updates.set("sort_order", Number(pickPayloadValue(payload, "sort_order", "sortOrder")) || 0);
  }

  if (updates.size === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = Array.from(updates.keys()).map((key) => `${key} = ?`).join(", ");
  const values = Array.from(updates.values());
  const result = await env.DB.prepare(
    `UPDATE categories
        SET ${assignments}, updated_at = ?
      WHERE id = ? AND user_id = ?`
  )
    .bind(...values, nowIso(), categoryId, authResult.session.user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

// Reorder sekaligus banyak subkategori dalam satu grup kategori (hasil
// drag-and-drop di halaman Nama Akun) — index di array `ids` jadi sort_order barunya.
async function handleReorderCategories(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  const payload = await parseJson<{ ids?: string[] }>(request);
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  if (ids.length === 0) {
    return json({ error: "ids wajib diisi." }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i++) {
    await env.DB.prepare(
      `UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    )
      .bind(i, nowIso(), ids[i], authResult.session.user.id)
      .run();
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
    "INSERT INTO currencies (id, user_id, code, name, symbol, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.code ?? "IDR"),
      String(payload.name ?? "Rupiah"),
      String(payload.symbol ?? "Rp"),
      Number(payload.is_default ?? payload.isDefault ?? 0) ? 1 : 0,
      nowIso(),
      nowIso()
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
    `INSERT INTO recurring (id, user_id, name, type, category, account_id, amount, interval, next_date, note, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.name ?? ""),
      String(payload.type ?? "Pengeluaran"),
      String(payload.category ?? ""),
      String(pickPayloadValue(payload, "account_id", "accountId") ?? ""),
      Number(payload.amount ?? 0),
      String(pickPayloadValue(payload, "interval_value", "interval") ?? "Bulanan"),
      toIsoIfDateLike(pickPayloadValue(payload, "next_date", "nextDate")) ?? nowIso(),
      payload.note ?? null,
      payload.status ?? "ACTIVE",
      nowIso(),
      nowIso()
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
    updates.set("interval", pickPayloadValue(payload, "interval_value", "interval"));
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
  const currency = String(payload.currency ?? "IDR");
  const amount = Number(payload.amount ?? 0);
  const amountIdr = await resolveIdrAmount(currency, amount, payload.amount_idr ?? payload.amountIDR);
  await env.DB.prepare(
    `INSERT INTO savings (
      id, user_id, description, amount, amount_idr, currency, category, sub_category,
      from_account, to_goal, transaction_type, date, display_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      String(payload.description ?? ""),
      amount,
      amountIdr,
      currency,
      String(payload.category ?? ""),
      pickPayloadValue(payload, "sub_category", "subCategory") ?? null,
      String(pickPayloadValue(payload, "from_account", "fromAccount") ?? ""),
      String(pickPayloadValue(payload, "to_goal", "toGoal") ?? ""),
      String(pickPayloadValue(payload, "transaction_type", "transactionType") ?? "Setoran"),
      toIsoIfDateLike(payload.date) ?? nowIso(),
      payload.display_date ?? payload.displayDate ?? nowIso(),
      nowIso(),
      nowIso()
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
  const packageName = String(packagePayload.name ?? payload.package_name ?? "-");
  // Skema produksi menyimpan detail paket + metode dalam satu kolom package_json.
  const packageJson = JSON.stringify({
    id: packagePayload.id ?? payload.package_id ?? null,
    name: packagePayload.name ?? payload.package_name ?? null,
    durationMonths: Number(packagePayload.durationMonths ?? payload.package_duration_months ?? 1),
    method: payload.method ?? "Bank Transfer",
    ref: payload.ref ?? null,
  });
  const id = generateId();
  const userName = String(payload.user_name ?? payload.userName ?? authResult.session.user.name);
  const userEmail = String(payload.user_email ?? payload.userEmail ?? authResult.session.user.email);
  const amount = Number(payload.amount ?? 0);
  await env.DB.prepare(
    `INSERT INTO payments (
      id, user_id, user_name, user_email, user_whatsapp, user_photo_url, amount,
      package_json, proof_image_url, note, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      userName,
      userEmail,
      payload.user_whatsapp ?? payload.userWhatsapp ?? authResult.session.user.whatsapp ?? null,
      payload.user_photo_url ?? payload.userPhotoURL ?? null,
      amount,
      packageJson,
      payload.proof_image_url ?? payload.proofImageUrl ?? null,
      payload.note ?? null,
      payload.status ?? "MENUNGGU",
      nowIso(),
      nowIso()
    )
    .run();

  await sendTelegramNotification(
    env,
    `💰 <b>Pembayaran Baru</b>\n` +
      `Nama: ${userName}\n` +
      `Email: ${userEmail}\n` +
      `Paket: ${packageName}\n` +
      `Jumlah: Rp ${amount.toLocaleString("id-ID")}\n\n` +
      `Verifikasi di Admin &gt; Pembayaran.`
  );

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
    await env.DB.prepare("INSERT INTO ai_chats (id, user_id, messages_json, updated_at) VALUES (?, ?, ?, ?)")
      .bind(id, authResult.session.user.id, JSON.stringify(messages), nowIso())
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
    const settings = await env.DB.prepare("SELECT * FROM admin_settings WHERE id = 'global'").first<
      Record<string, unknown>
    >();
    let proPackages: unknown[] = [];
    const rawJson = settings?.value_json;
    if (typeof rawJson === "string" && rawJson) {
      try {
        const parsed = JSON.parse(rawJson) as { proPackages?: unknown[] };
        if (Array.isArray(parsed.proPackages)) proPackages = parsed.proPackages;
      } catch {
        // value_json lama tidak valid JSON — abaikan.
      }
    }
    return json({ item: settings ? { ...settings, pro_packages: proPackages } : settings });
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
    "developer_name",
    "developer_photo_url",
    "developer_quote",
  ]);

  // Field developer_* cuma boleh diubah SUPERADMIN_EMAIL, walau admin lain
  // tetap bisa akses tab-tab settings yang lain.
  const developerFields = ["developer_name", "developer_photo_url", "developer_quote"];
  if (
    fields.some((key) => developerFields.includes(key)) &&
    authResult.session.user.email !== SUPERADMIN_EMAIL
  ) {
    return json({ error: "Hanya superadmin yang bisa mengubah profil developer." }, { status: 403 });
  }

  // D1 tidak menerima boolean JS mentah lewat .bind() — harus dikonversi ke
  // integer 0/1 dulu, sama seperti pola is_default di tempat lain.
  const sanitizedEntries = fields
    .filter((key) => allowed.has(key))
    .map((key) => {
      if (key === "maintenance_code") return [key, sanitizeMaintenanceHtml(String(payload[key] ?? ""))];
      if (key === "maintenance_is_active") return [key, payload[key] ? 1 : 0];
      return [key, payload[key]];
    });

  // Belum ada kolom khusus untuk daftar paket Pro — disimpan sebagai JSON di
  // kolom value_json yang sudah ada (sebelumnya tidak terpakai sama sekali).
  if (payload.pro_packages !== undefined) {
    sanitizedEntries.push(["value_json", JSON.stringify({ proPackages: payload.pro_packages })]);
  }

  if (sanitizedEntries.length === 0) {
    return json({ error: "Tidak ada field yang bisa diperbarui." }, { status: 400 });
  }

  const assignments = sanitizedEntries.map(([key]) => `${key} = ?`).join(", ");
  const values = sanitizedEntries.map(([, value]) => value);

  await env.DB.prepare(`UPDATE admin_settings SET ${assignments} WHERE id = 'global'`)
    .bind(...values)
    .run();

  const settingsLogTimestamp = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO admin_logs (id, admin_email, action, target, note, color, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      generateId(),
      authResult.session.user.email,
      "settings.update",
      "admin_settings",
      "Admin settings updated from Cloudflare Worker",
      "slate",
      settingsLogTimestamp,
      settingsLogTimestamp
    )
    .run();

  return json({ ok: true });
}

// Subset admin_settings yang aman dibaca member biasa (bukan admin) untuk
// menyelesaikan pembayaran Pro: rekening/QRIS/paket/kontak. Sengaja endpoint
// terpisah dari /api/admin/settings (admin-only) — sebelumnya halaman
// Konfirmasi Pembayaran memakai endpoint admin itu langsung sehingga member
// non-admin selalu gagal fetch (403) dan rekening/QRIS/WA/email kosong.
async function handleMemberPaymentInfo(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const settings = await env.DB.prepare(
    `SELECT
      billing_email,
      whatsapp,
      pro_price,
      bank_name,
      bank_account_name,
      bank_number,
      qris_text,
      qris_url,
      free_plan_days,
      value_json
     FROM admin_settings
     WHERE id = 'global'
     LIMIT 1`
  ).first<Record<string, unknown>>();

  let proPackages: unknown[] = [];
  const rawJson = settings?.value_json;
  if (typeof rawJson === "string" && rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as { proPackages?: unknown[] };
      if (Array.isArray(parsed.proPackages)) proPackages = parsed.proPackages;
    } catch {
      // value_json lama tidak valid JSON — abaikan.
    }
  }

  return json({
    item: settings
      ? {
          billing_email: settings.billing_email,
          whatsapp: settings.whatsapp,
          pro_price: settings.pro_price,
          bank_name: settings.bank_name,
          bank_account_name: settings.bank_account_name,
          bank_number: settings.bank_number,
          qris_text: settings.qris_text,
          qris_url: settings.qris_url,
          free_plan_days: settings.free_plan_days,
          pro_packages: proPackages,
        }
      : null,
  });
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
  const logTimestamp = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO admin_logs (id, admin_email, action, target, note, color, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(generateId(), adminEmail, action, target, note, color, logTimestamp, logTimestamp)
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
    `SELECT id, user_id, user_email, user_name, package_json
       FROM payments
      WHERE id = ?`
  )
    .bind(paymentId)
    .first<{
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      package_json: string | null;
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
    let packageMonths = 1;
    try {
      packageMonths = Number(JSON.parse(payment.package_json ?? "{}").durationMonths) || 1;
    } catch {
      packageMonths = 1;
    }
    const monthsToAdd = packageMonths > 0 ? packageMonths : 1;
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

    const postLogTimestamp = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO admin_logs (id, admin_email, action, target, note, color, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        generateId(),
        authResult.session.user.email,
        payload.action ?? "admin.action",
        payload.target ?? "unknown",
        payload.note ?? "",
        payload.color ?? "slate",
        postLogTimestamp,
        postLogTimestamp
      )
      .run();
    return json({ ok: true }, { status: 201 });
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
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

  const nextMessages: Array<{ role: string; content: string; createdAt: string }> = existing
    ? JSON.parse(existing.messages_json)
    : [];

  // Riwayat percakapan sebelumnya diteruskan ke model agar AI ingat konteks
  // obrolan, bukan hanya menjawab satu pertanyaan tanpa memori.
  const history = nextMessages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const userContext = await buildUserContext(env, authResult.session.user.id);
  const answer = await runAiAssistant(env, payload.prompt, userContext, history);

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

// --- Deposito: perpanjangan/pencairan otomatis saat jatuh tempo -----------
// Cron harian (wrangler.toml). maturity_action: cairkan / aro_bunga / aro_full.

interface DepositRow {
  id: string;
  user_id: string;
  name: string;
  platform: string | null;
  amount_invested: number;
  amount_idr: number;
  return_percentage: number;
  tax_percentage: number;
  currency: string;
  category: string | null;
  account_id: string | null;
  date_invested: string;
  target_date: string;
  maturity_action: string | null;
}

const addMonthsIso = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

const daysBetweenIso = (startIso: string, endIso: string) =>
  Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000));

const computeDepositResult = (invested: number, ratePercent: number, taxPercent: number, days: number) => {
  const grossInterest = invested * (ratePercent / 100) * (days / 365);
  const taxAmount = grossInterest * (taxPercent / 100);
  const interestOnly = grossInterest - taxAmount;
  return { interestOnly, totalResult: invested + interestOnly };
};

// Baris proyeksi "(Hasil Akhir)" dibuat DepositModal dengan status 'Planned' —
// dicari lewat related_investment_id (baris baru), dengan fallback cocokkan
// nama untuk deposito lama yang dibuat sebelum kolom ini ada.
const findProjectionRowId = async (env: Env, parentId: string, userId: string, parentName: string) => {
  const byRelation = await env.DB.prepare(
    `SELECT id FROM investments WHERE related_investment_id = ? AND user_id = ? AND status = 'Planned' LIMIT 1`
  )
    .bind(parentId, userId)
    .first<{ id: string }>();
  if (byRelation) return byRelation.id;

  const byName = await env.DB.prepare(
    `SELECT id FROM investments WHERE user_id = ? AND status = 'Planned' AND name = ? LIMIT 1`
  )
    .bind(userId, `${parentName} (Hasil Akhir)`)
    .first<{ id: string }>();
  return byName?.id ?? null;
};

const processMaturedDeposit = async (env: Env, inv: DepositRow) => {
  const invested = Number(inv.amount_invested) || 0;
  const rate = Number(inv.return_percentage) || 0;
  const taxRate = Number(inv.tax_percentage) || 0;
  const currency = inv.currency || "IDR";
  const days = daysBetweenIso(inv.date_invested, inv.target_date);
  const { interestOnly, totalResult } = computeDepositResult(invested, rate, taxRate, days);
  const action = inv.maturity_action || "cairkan";
  const today = inv.target_date.slice(0, 10);
  const projectionId = await findProjectionRowId(env, inv.id, inv.user_id, inv.name);

  if (action === "cairkan") {
    if (inv.account_id) {
      await env.DB.prepare(`UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`)
        .bind(totalResult, inv.account_id, inv.user_id)
        .run();
    }

    const totalResultIdr = await resolveIdrAmount(currency, totalResult, undefined);
    await insertTransactionRecord(env, inv.user_id, {
      type: "pemasukan",
      amount: totalResult,
      amountIdr: totalResultIdr,
      category: "Investasi",
      subCategory: "Deposito - Penarikan (Otomatis)",
      currency,
      accountId: inv.account_id,
      date: today,
      note: `[Otomatis] Deposito ${inv.name} cair jatuh tempo (pokok+bunga)`,
    });

    await env.DB.prepare(
      `UPDATE users
          SET total_income = COALESCE(total_income, 0) + ?,
              total_wealth = COALESCE(total_wealth, 0) + ?,
              total_investment = COALESCE(total_investment, 0) - ?
        WHERE id = ?`
    )
      .bind(totalResult, totalResult, invested, inv.user_id)
      .run();

    // Tutup baris asli (biar cron tidak memprosesnya lagi) dan catat baris
    // Penarikan baru, sama seperti alur manual, supaya total portofolio pas.
    await env.DB.prepare(`UPDATE investments SET status = 'Closed', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), inv.id)
      .run();

    const closingId = generateId();
    await env.DB.prepare(
      `INSERT INTO investments (
        id, user_id, name, type, platform, amount_invested, amount_idr, current_value, current_value_idr,
        return_percentage, tax_percentage, currency, transaction_type, category, account_id,
        date_invested, target_date, duration_days, status, related_investment_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'Deposito', ?, ?, ?, ?, ?, ?, ?, ?, 'Penarikan', ?, ?, ?, ?, ?, 'Closed', ?, ?, ?)`
    )
      .bind(
        closingId,
        inv.user_id,
        `${inv.name} (Dicairkan)`,
        inv.platform,
        invested,
        await resolveIdrAmount(currency, invested, undefined),
        totalResult,
        totalResultIdr,
        rate,
        taxRate,
        currency,
        inv.category,
        inv.account_id,
        inv.target_date,
        inv.target_date,
        days,
        inv.id,
        nowIso(),
        nowIso()
      )
      .run();

    if (projectionId) {
      await env.DB.prepare(`DELETE FROM investments WHERE id = ?`).bind(projectionId).run();
    }
    return;
  }

  if (action === "aro_bunga") {
    if (inv.account_id) {
      await env.DB.prepare(`UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`)
        .bind(interestOnly, inv.account_id, inv.user_id)
        .run();
    }

    const interestOnlyIdr = await resolveIdrAmount(currency, interestOnly, undefined);
    await insertTransactionRecord(env, inv.user_id, {
      type: "pemasukan",
      amount: interestOnly,
      amountIdr: interestOnlyIdr,
      category: "Investasi",
      subCategory: "Deposito - Bunga (Otomatis)",
      currency,
      accountId: inv.account_id,
      date: today,
      note: `[Otomatis] Bunga deposito ${inv.name} cair ke rekening, pokok diperpanjang 1 bulan`,
    });

    await env.DB.prepare(
      `UPDATE users
          SET total_income = COALESCE(total_income, 0) + ?,
              total_wealth = COALESCE(total_wealth, 0) + ?
        WHERE id = ?`
    )
      .bind(interestOnly, interestOnly, inv.user_id)
      .run();

    const newDateInvested = inv.target_date;
    const newTargetDate = addMonthsIso(inv.target_date, 1);
    const newDurationDays = daysBetweenIso(newDateInvested, newTargetDate);

    await env.DB.prepare(
      `UPDATE investments
          SET date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(newDateInvested, newTargetDate, newDurationDays, nowIso(), inv.id)
      .run();

    const nextResult = computeDepositResult(invested, rate, taxRate, newDurationDays);
    const nextTotalIdr = await resolveIdrAmount(currency, nextResult.totalResult, undefined);
    if (projectionId) {
      await env.DB.prepare(
        `UPDATE investments
            SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
                date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
          WHERE id = ?`
      )
        .bind(
          nextResult.totalResult,
          nextTotalIdr,
          nextResult.totalResult,
          nextTotalIdr,
          newTargetDate,
          newTargetDate,
          newDurationDays,
          nowIso(),
          projectionId
        )
        .run();
    }
    return;
  }

  if (action === "aro_full") {
    const newInvested = totalResult;
    const newInvestedIdr = await resolveIdrAmount(currency, newInvested, undefined);
    const newDateInvested = inv.target_date;
    const newTargetDate = addMonthsIso(inv.target_date, 1);
    const newDurationDays = daysBetweenIso(newDateInvested, newTargetDate);

    await env.DB.prepare(
      `UPDATE investments
          SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
              date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(
        newInvested,
        newInvestedIdr,
        newInvested,
        newInvestedIdr,
        newDateInvested,
        newTargetDate,
        newDurationDays,
        nowIso(),
        inv.id
      )
      .run();

    await env.DB.prepare(
      `UPDATE users SET total_investment = COALESCE(total_investment, 0) + ? WHERE id = ?`
    )
      .bind(interestOnly, inv.user_id)
      .run();

    const nextResult = computeDepositResult(newInvested, rate, taxRate, newDurationDays);
    const nextTotalIdr = await resolveIdrAmount(currency, nextResult.totalResult, undefined);
    if (projectionId) {
      await env.DB.prepare(
        `UPDATE investments
            SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
                date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
          WHERE id = ?`
      )
        .bind(
          nextResult.totalResult,
          nextTotalIdr,
          nextResult.totalResult,
          nextTotalIdr,
          newTargetDate,
          newTargetDate,
          newDurationDays,
          nowIso(),
          projectionId
        )
        .run();
    }
  }
};

// ===== Web Push: subscription CRUD + pengiriman notifikasi =====

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function handleVapidPublicKey(env: Env) {
  if (!env.VAPID_PUBLIC_KEY) {
    return json({ error: "Push notification belum dikonfigurasi di server." }, { status: 503 });
  }
  return json({ publicKey: env.VAPID_PUBLIC_KEY });
}

async function handleCreatePushSubscription(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<{
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>(request);
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return json({ error: "Data subscription tidak lengkap." }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent") || null;
  const existing = await env.DB.prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?")
    .bind(payload.endpoint)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(
      `UPDATE push_subscriptions
          SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(authResult.session.user.id, payload.keys.p256dh, payload.keys.auth, userAgent, nowIso(), existing.id)
      .run();
    return json({ ok: true, id: existing.id });
  }
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      authResult.session.user.id,
      payload.endpoint,
      payload.keys.p256dh,
      payload.keys.auth,
      userAgent,
      nowIso(),
      nowIso()
    )
    .run();
  return json({ ok: true, id }, { status: 201 });
}

async function handleDeletePushSubscription(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<{ endpoint?: string }>(request);
  if (!payload.endpoint) {
    return json({ error: "endpoint wajib diisi." }, { status: 400 });
  }
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
    .bind(payload.endpoint, authResult.session.user.id)
    .run();
  return json({ ok: true });
}

const formatRupiahForPush = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

// Kirim ke SATU subscription. Kalau push service balas 404/410 (subscription
// kadaluarsa/dicabut user dari sisi browser), langsung bersihkan baris itu
// supaya tidak dicoba lagi di pengiriman berikutnya.
const sendWebPushToSubscription = async (
  env: Env,
  sub: PushSubscriptionRow,
  message: PushMessage
): Promise<boolean> => {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT || "mailto:admin@leosiqra.com",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const subscription: WebPushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  try {
    const payload = await buildPushPayload(message, subscription, vapid);
    const res = await fetch(sub.endpoint, payload);
    if (res.status === 404 || res.status === 410) {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
    }
    return res.ok;
  } catch (error) {
    console.error(`Gagal mengirim push ke subscription ${sub.id}:`, error);
    return false;
  }
};

// Kirim ke SEMUA perangkat/subscription milik satu user (bisa lebih dari satu).
const sendWebPushToUser = async (env: Env, userId: string, title: string, body: string, url: string) => {
  const { results } = await env.DB.prepare(
    "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?"
  )
    .bind(userId)
    .all<PushSubscriptionRow>();
  const message: PushMessage = {
    data: { title, body, url },
    options: { urgency: "normal" },
  };
  for (const sub of results ?? []) {
    await sendWebPushToSubscription(env, sub, message);
  }
};

// Broadcast satu kali ke SEMUA subscription semua user (bukan per-user) — untuk
// pengumuman fitur baru dll. Dipanggil manual dari admin tools, bukan cron.
const sendWebPushToAllUsers = async (
  env: Env,
  title: string,
  body: string,
  url: string
): Promise<{ sent: number; total: number }> => {
  const { results } = await env.DB.prepare(
    "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions"
  ).all<PushSubscriptionRow>();
  const subs = results ?? [];
  const message: PushMessage = { data: { title, body, url }, options: { urgency: "normal" } };

  let sent = 0;
  for (const sub of subs) {
    try {
      const ok = await sendWebPushToSubscription(env, sub, message);
      if (ok) sent++;
    } catch (error) {
      console.error(`Gagal broadcast push ke subscription ${sub.id}:`, error);
    }
  }
  return { sent, total: subs.length };
};

// ===== Job 1: ringkasan Pengeluaran/Pemasukan kemarin, jam 00:01 WIB =====

const sendDailySummaryNotifications = async (env: Env) => {
  // WIB = UTC+7, jadi 00:01 WIB = 17:01 UTC hari sebelumnya. Pada saat cron
  // ini jalan, "kemarin WIB" adalah rentang [hari ini 17:00 UTC - 24 jam,
  // hari ini 17:00 UTC).
  const now = new Date();
  const endOfWibDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17, 0, 0));
  const startOfWibDay = new Date(endOfWibDay.getTime() - 24 * 60 * 60 * 1000);

  const { results } = await env.DB.prepare(
    `SELECT user_id, type, SUM(COALESCE(NULLIF(amount_idr, 0), amount)) as total
       FROM transactions
      WHERE date >= ? AND date < ? AND type IN ('pengeluaran', 'pemasukan')
      GROUP BY user_id, type`
  )
    .bind(startOfWibDay.toISOString(), endOfWibDay.toISOString())
    .all<{ user_id: string; type: string; total: number }>();

  const totalsByUser = new Map<string, { pengeluaran: number; pemasukan: number }>();
  for (const row of results ?? []) {
    const entry = totalsByUser.get(row.user_id) ?? { pengeluaran: 0, pemasukan: 0 };
    if (row.type === "pengeluaran") entry.pengeluaran = row.total || 0;
    else if (row.type === "pemasukan") entry.pemasukan = row.total || 0;
    totalsByUser.set(row.user_id, entry);
  }

  for (const [userId, totals] of totalsByUser) {
    // Tidak ada aktivitas sama sekali kemarin -> jangan kirim apa-apa.
    if (totals.pengeluaran <= 0 && totals.pemasukan <= 0) continue;
    try {
      let body = `Pengeluaran ${formatRupiahForPush(totals.pengeluaran)}`;
      if (totals.pemasukan > 0) {
        body += `, Pemasukan ${formatRupiahForPush(totals.pemasukan)}`;
      }
      await sendWebPushToUser(env, userId, "Ringkasan Kemarin", body, "/membership/transactions/daily");
    } catch (error) {
      console.error(`Gagal mengirim ringkasan harian ke user ${userId}:`, error);
    }
  }
};

// ===== Job 2: pengingat recurring yang jatuh tempo hari ini, jam 10:00 WIB =====

type RecurringRow = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval: string;
  next_date: string;
};

// Majukan next_date ke kemunculan berikutnya sesuai interval-nya. Rollover
// akhir bulan ditangani manual (mis. 31 Jan + 1 bulan -> akhir Feb, bukan
// meluber ke awal Maret).
const advanceNextDate = (dateStr: string, interval: string): string => {
  const d = new Date(dateStr);
  switch (interval) {
    case "Harian":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "Mingguan":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "Tahunan":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "Bulanan":
    default: {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const daysInNewMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, daysInNewMonth));
      break;
    }
  }
  return d.toISOString();
};

// Notifikasi pengingat SAJA — tidak otomatis membuat transaksinya.
const processDueRecurringReminders = async (env: Env) => {
  // Cron ini jalan jam 03:00 UTC = 10:00 WIB, dan karena tidak melewati
  // tengah malam WIB (03:00 + 7 jam = 10:00, masih tanggal UTC yang sama),
  // tanggal UTC saat ini SAMA dengan tanggal WIB-nya — tidak perlu offset.
  const todayStr = nowIso().slice(0, 10);
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, name, category, amount, interval, next_date
       FROM recurring
      WHERE status = 'ACTIVE' AND substr(next_date, 1, 10) = ?`
  )
    .bind(todayStr)
    .all<RecurringRow>();

  for (const row of results ?? []) {
    try {
      const body = `${row.name} (${row.category}) - ${formatRupiahForPush(row.amount)}`;
      await sendWebPushToUser(env, row.user_id, "Pengingat Recurring", body, "/membership/recurring");
    } catch (error) {
      console.error(`Gagal kirim pengingat recurring ${row.id}:`, error);
    }
    // Majukan next_date terlepas dari sukses/gagalnya push, supaya reminder
    // yang gagal terkirim tidak nyangkut dan berulang tiap hari selamanya.
    try {
      const newNextDate = advanceNextDate(row.next_date, row.interval);
      await env.DB.prepare("UPDATE recurring SET next_date = ?, updated_at = ? WHERE id = ?")
        .bind(newNextDate, nowIso(), row.id)
        .run();
    } catch (error) {
      console.error(`Gagal memajukan next_date recurring ${row.id}:`, error);
    }
  }
};

const processMaturedDeposits = async (env: Env) => {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, name, platform, amount_invested, amount_idr, return_percentage, tax_percentage,
            currency, category, account_id, date_invested, target_date, maturity_action
       FROM investments
      WHERE type = 'Deposito' AND status = 'Active' AND transaction_type = 'Penempatan'
        AND target_date IS NOT NULL AND target_date <= ?`
  )
    .bind(nowIso())
    .all<DepositRow>();

  for (const inv of results ?? []) {
    try {
      await processMaturedDeposit(env, inv);
    } catch (error) {
      console.error(`Gagal memproses jatuh tempo deposito ${inv.id}:`, error);
    }
  }
};

// App-nya same-origin (frontend + API disajikan dari Worker yang sama), jadi
// CORS lintas-origin normalnya tidak pernah dipakai — daftar ini cuma buat
// jaga-jaga (preview domain, dev lokal), bukan wildcard "*" yang kebuka lebar.
const ALLOWED_ORIGINS = new Set([
  "https://www.leosiqra.com",
  "https://leosiqra.com",
  "https://membersite-leosiqra.leowendry.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:8787",
]);

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin");
      const headers: Record<string, string> = {
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type",
        vary: "Origin",
      };
      if (origin && ALLOWED_ORIGINS.has(origin)) {
        headers["access-control-allow-origin"] = origin;
      }
      return new Response(null, { headers });
    }

    try {
      if ((request.method === "GET" || request.method === "HEAD") && url.protocol === "http:") {
        url.protocol = "https:";
        return Response.redirect(url.toString(), 301);
      }

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

      if (url.pathname === "/api/member/sessions" && request.method === "GET") {
        return await handleListSessions(request, env);
      }

      if (url.pathname.startsWith("/api/member/sessions/") && request.method === "DELETE") {
        const sessionId = url.pathname.slice("/api/member/sessions/".length);
        return await handleDeleteSession(request, env, sessionId);
      }

      if (url.pathname === "/api/auth/google" && request.method === "GET") {
        return await handleGoogleStart(request, env);
      }

      if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
        return await handleGoogleCallback(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "GET") {
        return await handleListTransactions(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "POST") {
        return await handleCreateTransaction(request, env);
      }

      if (url.pathname === "/api/member/quick-transaction" && request.method === "POST") {
        return await handleQuickTransaction(request, env);
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

      if (url.pathname === "/api/member/accounts/reorder" && request.method === "PUT") {
        return await handleReorderAccounts(request, env);
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

      if (url.pathname === "/api/member/stock-price" && request.method === "GET") {
        return await handleStockPrice(request, env);
      }

      if (url.pathname === "/api/member/stock-search" && request.method === "GET") {
        return await handleStockSearch(request, env);
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

      if (url.pathname === "/api/member/request-access" && request.method === "POST") {
        return await handleRequestAccess(request, env);
      }

      if (url.pathname === "/api/member/profile" && request.method === "PATCH") {
        return await handleUpdateMemberProfile(request, env);
      }

      if (url.pathname === "/api/member/password" && request.method === "PATCH") {
        return await handleChangeMemberPassword(request, env);
      }

      if (url.pathname === "/api/member/2fa" && request.method === "PATCH") {
        return await handleUpdateMemberTwoFactor(request, env);
      }

      if (url.pathname === "/api/member/reset-data" && request.method === "POST") {
        return await handleResetMemberData(request, env);
      }

      if (url.pathname === "/api/member/categories" && request.method === "GET") {
        return await handleListCategories(request, env);
      }

      if (url.pathname === "/api/member/categories" && request.method === "POST") {
        return await handleCreateCategory(request, env);
      }

      if (url.pathname === "/api/member/categories/reorder" && request.method === "PUT") {
        return await handleReorderCategories(request, env);
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

      if (url.pathname === "/api/vapid-public-key" && request.method === "GET") {
        return await handleVapidPublicKey(env);
      }

      if (url.pathname === "/api/member/push-subscription" && request.method === "POST") {
        return await handleCreatePushSubscription(request, env);
      }

      if (url.pathname === "/api/member/push-subscription" && request.method === "DELETE") {
        return await handleDeletePushSubscription(request, env);
      }

      if (url.pathname === "/api/member/payments" && request.method === "POST") {
        return await handleCreateMemberPayment(request, env);
      }

      if (url.pathname === "/api/member/payment-info" && request.method === "GET") {
        return await handleMemberPaymentInfo(request, env);
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

      // Trigger manual buat testing notifikasi tanpa nunggu jadwal cron —
      // admin-only. ?job=daily untuk ringkasan harian (aman diulang-ulang,
      // cuma baca data), ?job=recurring untuk pengingat recurring (HATI-HATI:
      // ini juga memajukan next_date beneran seperti kalau cron asli jalan,
      // jangan dipanggil sembarangan kalau cron 10:00 WIB hari itu juga aktif).
      if (url.pathname === "/api/admin/debug/run-notifications" && request.method === "POST") {
        const authResult = await requireSession(env, request, "admin");
        if (authResult.error) return authResult.error;
        const job = url.searchParams.get("job");
        if (job === "daily") {
          await sendDailySummaryNotifications(env);
        } else if (job === "recurring") {
          await processDueRecurringReminders(env);
        } else {
          return json({ error: "Pakai ?job=daily atau ?job=recurring." }, { status: 400 });
        }
        return json({ ok: true, job });
      }

      // Admin-only, one-off: isi logo_url rekening lama yang cocok nama bank/
      // e-wallet Indonesia dan belum punya logo. Aman diulang — cuma menyentuh
      // baris yang logo_url-nya masih kosong.
      if (url.pathname === "/api/admin/debug/backfill-bank-logos" && request.method === "POST") {
        const authResult = await requireSession(env, request, "admin");
        if (authResult.error) return authResult.error;
        const result = await backfillIndonesianBankLogos(env);
        return json({ ok: true, ...result });
      }

      // Admin-only: broadcast push notification ke SEMUA user (bukan cuma satu).
      // Dipakai untuk pengumuman fitur, jadi isi title/body dikontrol manual
      // oleh admin, bukan hardcoded.
      if (url.pathname === "/api/admin/debug/broadcast-notification" && request.method === "POST") {
        const authResult = await requireSession(env, request, "admin");
        if (authResult.error) return authResult.error;
        const payload = await parseJson<{ title?: string; body?: string; url?: string }>(request);
        const title = typeof payload.title === "string" ? payload.title.trim() : "";
        const body = typeof payload.body === "string" ? payload.body.trim() : "";
        const targetUrl = typeof payload.url === "string" && payload.url.trim() ? payload.url.trim() : "/membership/rekening";
        if (!title || !body) {
          return json({ error: "title dan body wajib diisi." }, { status: 400 });
        }
        const result = await sendWebPushToAllUsers(env, title, body, targetUrl);
        return json({ ok: true, ...result });
      }

      // Admin-only, one-off: tutup celah race condition di uniqueness username
      // dengan UNIQUE index di database. Kalau ternyata sudah ada username
      // yang bentrok (dibuat sebelum pengecekan aplikasi ada), index TIDAK
      // dipasang — daftar bentrokannya dikembalikan supaya diselesaikan manual dulu.
      if (url.pathname === "/api/admin/debug/enforce-username-unique" && request.method === "POST") {
        const authResult = await requireSession(env, request, "admin");
        if (authResult.error) return authResult.error;
        const result = await enforceUsernameUniqueIndex(env);
        if (!result.ok) {
          const list = result.duplicates.map((d) => `"${d.username}" (${d.count}x)`).join(", ");
          return json(
            { ok: false, error: `Ada username yang bentrok, ganti salah satunya dulu: ${list}`, duplicates: result.duplicates },
            { status: 409 }
          );
        }
        return json({ ok: true });
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
      console.error("Unhandled worker error", error);
      return json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "1 17 * * *") {
      // 17:01 UTC = 00:01 WIB (hari berikutnya) — ringkasan kemarin.
      ctx.waitUntil(sendDailySummaryNotifications(env));
      return;
    }
    // 03:00 UTC = 10:00 WIB — deposito jatuh tempo + pengingat recurring hari ini.
    ctx.waitUntil(processMaturedDeposits(env));
    ctx.waitUntil(processDueRecurringReminders(env));
  },
};

export default worker;

