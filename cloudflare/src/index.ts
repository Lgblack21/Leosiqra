import { verifySync } from "otplib";
import { DurableObject } from "cloudflare:workers";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription as WebPushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { computeCardCycle, clampCycleDay, lastStatementDate, daysBetween, type CardCycleSettings } from "../../src/lib/creditCycle";

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  LOGIN_RATE_LIMITER?: RateLimit;
  AI_PARSE_RATE_LIMITER?: RateLimit;
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
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  OPENROUTER_MODEL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PROMO_SECRET?: string;
  PROMO_ROUTINE_SECRET?: string;
  // Posting otomatis video promo (opsional — tanpa ini antrean posting tidak aktif).
  IG_USER_ID?: string;
  IG_ACCESS_TOKEN?: string;
  YT_CLIENT_ID?: string;
  YT_CLIENT_SECRET?: string;
  YT_REFRESH_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  LOGO_DEV_TOKEN?: string;
  COINGECKO_API_KEY?: string;
  OPENROUTER_WEB_SEARCH?: string;
  OPENROUTER_CHAT_MODEL?: string;
  // Email transaksional (reset password) lewat Resend. Tanpa RESEND_API_KEY
  // fitur Lupa Password menjawab 503 "belum aktif" alih-alih diam-diam gagal.
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  plan: "FREE" | "PRO";
  status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING";
  whatsapp?: string | null;
  // Status 2FA saja — kunci rahasia TOTP tidak pernah dikirim ke browser
  // (dulu ikut terkirim lewat /api/auth/me, jadi siapa pun yang memegang sesi
  // bisa menyalinnya dan membuat kode 2FA sendiri).
  twoFactorEnabled?: boolean;
  // Kapan terakhir akun ini membuka aplikasi terpasang (dari layar utama) —
  // dipakai iklan "pasang aplikasi" supaya tidak tampil ke yang sudah pasang.
  appsOpened?: { leosiqra?: string; inputCepat?: string };
  photoURL?: string | null;
  // false untuk akun Google (password_hash cuma sentinel 'oauth$google', bukan
  // password asli) — dipakai frontend untuk skip verifikasi "password saat
  // ini" di Ganti Password / Reset Data, karena memang tidak pernah ada.
  hasPassword?: boolean;
  // true kalau user sudah menyelesaikan onboarding awal (setup profil/mata
  // uang/kategori/rekening). Dipakai membership layout untuk memaksa user baru
  // ke /membership/onboarding sebelum boleh memakai aplikasi. Disimpan lewat
  // kolom currency_initialized yang sudah ada (tanpa migrasi baru — lihat
  // catatan drift schema production di tempat lain).
  onboarded?: boolean;
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

// Vision-model calls (AI Scan/Voice) biayanya lebih mahal dari chat teks
// biasa — batasi per-user supaya satu akun tidak bisa memanggil endpoint ini
// bertubi-tubi. Fail-open kalau binding belum ke-deploy, sama seperti
// checkRateLimit di atas.
const checkAiParseRateLimit = async (env: Env, userId: string): Promise<boolean> => {
  if (!env.AI_PARSE_RATE_LIMITER) return true;
  const { success } = await env.AI_PARSE_RATE_LIMITER.limit({ key: `ai-parse:user:${userId}` });
  return success;
};

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

const readAppsOpened = (metadataJson: string | null | undefined) => {
  if (!metadataJson) return {};
  try {
    const m = JSON.parse(metadataJson) as Record<string, unknown>;
    const pick = (v: unknown) => (typeof v === "string" ? v : undefined);
    return { leosiqra: pick(m.appOpenedLeosiqra), inputCepat: pick(m.appOpenedInputCepat) };
  } catch {
    return {};
  }
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
    currency_initialized?: number | null;
    metadata_json?: string | null;
  } | null = null;

  try {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, s.role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.expired_at, u.whatsapp, u.two_factor_secret, u.photo_url, u.password_hash, u.currency_initialized, u.metadata_json
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
      .bind(sessionId)
      .first<typeof result>();
  } catch {
    result = await env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, u.role as role, s.expires_at,
              u.name, u.email, u.plan, u.status, u.expired_at, u.whatsapp, u.two_factor_secret, u.photo_url, u.password_hash, u.currency_initialized, u.metadata_json
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
      twoFactorEnabled: Boolean(result.two_factor_secret),
      appsOpened: readAppsOpened(result.metadata_json),
      photoURL: result.photo_url ?? null,
      hasPassword: !result.password_hash?.startsWith("oauth$"),
      onboarded: result.currency_initialized === 1,
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
    .replaceAll(/\sstyle\s*=\s*'[^']*(expression|url\s*\(\s*javascript:)[^']*'/gi, "")
    // Varian tanpa tanda kutip & setelah "/" (mis. <img src=x onerror=...>,
    // <svg/onload=...>) — dulu lolos. Lapisan utama tetap iframe sandbox di
    // frontend (SandboxedHtml); ini cuma cadangan.
    .replaceAll(/[\s/]on\w+\s*=\s*[^\s>"']+/gi, " ")
    .replaceAll(/\s(srcdoc|formaction|xlink:href|href|src|poster|action)\s*=\s*(javascript:|data:text\/html)[^\s>]*/gi, "");
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
  const today = todayWIB();
  const currentYmWib = today.slice(0, 7);
  const [accounts, transactions, budgets, investments, savings, recurring, currencies, categories, categoryMonths] = await Promise.all([
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
              total_interest, payment_status, related_type
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
      `SELECT description, amount, amount_idr, currency, category, transaction_type, from_account, to_goal, date, display_date
         FROM savings WHERE user_id = ? ORDER BY date DESC LIMIT 100`
    )
      .bind(userId)
      .all(),
    env.DB.prepare(
      `SELECT name, type, category, account_id, amount, interval, next_date, note, status, payload_json
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
    // Total per kategori per bulan (bulan ini + 3 bulan sebelumnya), dihitung
    // SQL supaya akurat walau transaksi lebih banyak dari LIMIT di atas.
    // Beli/jual investasi (related_type 'investasi') & transfer tidak dihitung.
    env.DB.prepare(
      `SELECT substr(COALESCE(NULLIF(display_date, ''), date), 1, 7) AS ym, type, COALESCE(NULLIF(category, ''), 'Lainnya') AS category,
              SUM(COALESCE(NULLIF(amount_idr, 0), amount)) AS total, COUNT(*) AS n
         FROM transactions
        WHERE user_id = ? AND type IN ('pemasukan', 'pengeluaran')
          AND COALESCE(related_type, '') <> 'investasi'
          AND substr(COALESCE(NULLIF(display_date, ''), date), 1, 7) >= ?
        GROUP BY ym, type, category`
    )
      .bind(userId, shiftYm(currentYmWib, -3))
      .all<{ ym: string; type: string; category: string; total: number; n: number }>(),
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

  // Ringkasan bulan berjalan, DIHITUNG & DIFORMAT DI SERVER — bukan dibiarkan
  // ke AI untuk menjumlahkan/memformat sendiri dari daftar transaksi mentah.
  // Sebelumnya AI sering menulis nominal tanpa titik ribuan (mis. "Rp93977366"
  // alih-alih "Rp93.977.366") dan kadang membuat kesimpulan aneh/muter-muter
  // saat pemasukan & pengeluaran kebetulan sama besar. Field siap-pakai di
  // sini menghilangkan kebutuhan AI menghitung/memformat sendiri untuk
  // pertanyaan umum seputar "aman tidak pengeluaran bulan ini".
  const formatRupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
  // Bulan berjalan menurut WIB — dulu jam server (UTC), jadi awal bulan sampai
  // pukul 07.00 WIB masih terhitung bulan sebelumnya.
  const currentYm = currentYmWib;
  const monthTx = (transactions.results ?? []).filter((t) => {
    const row = t as { display_date?: string | null; date?: string | null };
    const d = String(row.display_date || row.date || "");
    return d.startsWith(currentYm);
  });
  // Menaruh uang ke investasi (Deposito/Saham/dll) tersimpan sebagai type
  // "pengeluaran" tapi BUKAN kerugian — cuma uang tunai berubah jadi
  // instrumen investasi (sudah dihitung terpisah di "investments"). Kalau
  // ikut dijumlah di sini, monthSummary jadi menyesatkan persis seperti bug
  // yang ditemukan di Dashboard Tahunan (taruh Rp280jt ke deposito bikin
  // kelihatan defisit besar padahal surplus) — lihat juga Pajak Center yang
  // sudah lebih dulu mengecualikan kasus yang sama.
  const isInvestmentPurchaseRow = (t: unknown) => {
    const row = t as { type?: string; category?: string; related_type?: string | null };
    if (row.related_type === "investasi") return true;
    return row.type === "pengeluaran" && (row.category?.toLowerCase().includes("investasi") || row.category === "Saham" || row.category === "Deposito");
  };
  const sumByType = (type: string) =>
    monthTx
      .filter((t) => (t as { type?: string }).type === type && !isInvestmentPurchaseRow(t) && (t as { related_type?: string | null }).related_type !== "investasi")
      .reduce((s, t) => {
        const row = t as { amount_idr?: number; amount?: number };
        return s + (Number(row.amount_idr) || Number(row.amount) || 0);
      }, 0);
  const monthIncome = sumByType("pemasukan");
  const monthExpense = sumByType("pengeluaran");
  const monthNet = monthIncome - monthExpense;
  const monthSummary = {
    bulan: currentYm,
    totalPemasukanFormatted: formatRupiah(monthIncome),
    totalPengeluaranFormatted: formatRupiah(monthExpense),
    statusFormatted:
      monthNet > 0
        ? `Surplus ${formatRupiah(monthNet)} (pemasukan lebih besar dari pengeluaran)`
        : monthNet < 0
          ? `Defisit ${formatRupiah(Math.abs(monthNet))} (pengeluaran lebih besar dari pemasukan)`
          : "Seimbang (total pemasukan dan pengeluaran bulan ini persis sama)",
  };

  // Ringkasan tabungan PER GOAL (kategori), DIHITUNG & DIFORMAT DI SERVER —
  // alasan sama seperti monthSummary di atas. Kasus nyata yang memicu ini:
  // AI diminta "sisa target tabungan Dana Darurat" dan menjumlahkan beberapa
  // baris "savings" mentah sendiri, lalu salah tulis ulang hasilnya jadi 10x
  // lipat (Rp389 juta padahal aslinya Rp38,9 juta) — bukan data yang salah,
  // AI-nya yang salah transkrip angka besar. Field siap-pakai di sini
  // menghilangkan kebutuhan itu sama sekali untuk pertanyaan seperti itu.
  const savingsTotalByCategory = new Map<string, number>();
  for (const row of (savings.results ?? []) as Array<{
    category?: string;
    transaction_type?: string;
    amount?: number;
    amount_idr?: number;
  }>) {
    const cat = row.category || "Lainnya";
    const value = Number(row.amount_idr) || Number(row.amount) || 0;
    const signed = row.transaction_type === "Penarikan" ? -value : value;
    savingsTotalByCategory.set(cat, (savingsTotalByCategory.get(cat) ?? 0) + signed);
  }
  const goalTargetByCategory = new Map<string, number>();
  for (const row of (recurring.results ?? []) as Array<{
    type?: string;
    category?: string;
    payload_json?: string | null;
  }>) {
    if (row.type !== "Tabungan" || !row.category || !row.payload_json) continue;
    try {
      const parsed = JSON.parse(row.payload_json) as { targetAmount?: number };
      if (typeof parsed.targetAmount === "number" && parsed.targetAmount > 0) {
        goalTargetByCategory.set(row.category, parsed.targetAmount);
      }
    } catch {
      // payload_json tidak valid JSON — abaikan.
    }
  }
  const savingsSummary = Array.from(savingsTotalByCategory.entries()).map(([category, total]) => {
    const target = goalTargetByCategory.get(category);
    return {
      category,
      totalTerkumpulFormatted: formatRupiah(total),
      targetFormatted: target ? formatRupiah(target) : undefined,
      sisaMenujuTargetFormatted: target ? formatRupiah(Math.max(0, target - total)) : undefined,
    };
  });

  // ===== Analisis siap-pakai (dihitung server, AI tinggal membaca) =====
  const isInvestCat = (c: string) => c.toLowerCase().includes("investasi") || c === "Saham" || c === "Deposito";
  const catRows = ((categoryMonths.results ?? []) as Array<{ ym: string; type: string; category: string; total: number }>)
    .filter((r) => !(r.type === "pengeluaran" && isInvestCat(r.category)));
  const prevYm = shiftYm(currentYm, -1);
  const prev3 = [shiftYm(currentYm, -1), shiftYm(currentYm, -2), shiftYm(currentYm, -3)];
  const sumCat = (type: string, ym: string, cat?: string) =>
    catRows.filter((r) => r.type === type && r.ym === ym && (!cat || r.category === cat)).reduce((s, r) => s + (Number(r.total) || 0), 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const [y, m] = currentYm.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dayOfMonth = Number(today.slice(8, 10));
  const expenseThisMonth = sumCat("pengeluaran", currentYm);
  const incomeThisMonth = sumCat("pemasukan", currentYm);
  const expensePrevMonth = sumCat("pengeluaran", prevYm);
  const dailyAvg = dayOfMonth > 0 ? expenseThisMonth / dayOfMonth : 0;
  const categoriesOf = (type: string) => Array.from(new Set(catRows.filter((r) => r.type === type).map((r) => r.category)));
  const perCategory = (type: string, limit: number) =>
    categoriesOf(type)
      .map((cat) => {
        const now_ = sumCat(type, currentYm, cat);
        const prev = sumCat(type, prevYm, cat);
        const avg3 = prev3.reduce((s, ym) => s + sumCat(type, ym, cat), 0) / 3;
        return { cat, now_, prev, avg3 };
      })
      .filter((x) => x.now_ > 0 || x.prev > 0)
      .sort((a, b) => b.now_ - a.now_)
      .slice(0, limit)
      .map((x) => ({
        kategori: x.cat,
        bulanIni: formatRupiah(x.now_),
        bulanLalu: formatRupiah(x.prev),
        rataRata3BulanSebelumnya: formatRupiah(x.avg3),
        perubahanVsRataRataPersen: pct(x.now_, x.avg3),
      }));
  const budgetUsage = ((budgets.results ?? []) as Array<{ type?: string; category?: string; amount?: number; period?: string }>)
    .filter((b) => (b.type ?? "pengeluaran") === "pengeluaran" && (b.period ?? "monthly") === "monthly" && Number(b.amount) > 0)
    .map((b) => {
      const used = sumCat("pengeluaran", currentYm, b.category ?? "");
      const limit = Number(b.amount);
      const usedPct = Math.round((used / limit) * 100);
      return {
        kategori: b.category,
        batasBulanan: formatRupiah(limit),
        terpakai: formatRupiah(used),
        sisa: formatRupiah(Math.max(0, limit - used)),
        terpakaiPersen: usedPct,
        status: usedPct >= 100 ? "sudah lewat batas" : usedPct >= 80 ? "hampir habis" : "aman",
      };
    });
  const in14Days = shiftDateStr(today, 14);
  const upcoming = ((recurring.results ?? []) as Array<{ name?: string; type?: string; amount?: number; next_date?: string; status?: string }>)
    .filter((r) => r.status !== "PAUSED" && r.next_date && r.next_date.slice(0, 10) >= today && r.next_date.slice(0, 10) <= in14Days)
    .sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)))
    .map((r) => ({ nama: r.name, jenis: r.type, nominal: formatRupiah(Number(r.amount) || 0), tanggal: String(r.next_date).slice(0, 10) }));
  const analisis = {
    hariIni: today,
    bulanIni: {
      bulan: currentYm,
      hariKe: dayOfMonth,
      jumlahHariBulanIni: daysInMonth,
      pemasukan: formatRupiah(incomeThisMonth),
      pengeluaran: formatRupiah(expenseThisMonth),
      rataRataPengeluaranPerHari: formatRupiah(dailyAvg),
      proyeksiPengeluaranSampaiAkhirBulan: formatRupiah(dailyAvg * daysInMonth),
      selisihPemasukanMinusPengeluaran: formatRupiah(incomeThisMonth - expenseThisMonth),
    },
    bulanLalu: { bulan: prevYm, pemasukan: formatRupiah(sumCat("pemasukan", prevYm)), pengeluaran: formatRupiah(expensePrevMonth) },
    perubahanPengeluaranVsBulanLaluPersen: pct(expenseThisMonth, expensePrevMonth),
    catatanPerbandingan: "Bulan ini baru berjalan sebagian — bandingkan dengan hati-hati (pakai proyeksi atau rata-rata per hari).",
    pengeluaranPerKategori: perCategory("pengeluaran", 10),
    pemasukanPerKategori: perCategory("pemasukan", 5),
    budgetBulanIni: budgetUsage,
    jadwalRutin14HariKeDepan: upcoming,
  };

  // Transaksi mentah versi ringkas (120 hari terakhir, maks 250 baris), nama
  // rekening sudah dipetakan & field kosong dibuang — hemat token dan lebih
  // mudah dibaca model dibanding JSON penuh 500 baris.
  const accountName = new Map(accountsClean.map((a) => [a.id, a.name]));
  const since120 = shiftDateStr(today, -120);
  const recentTransactions = ((transactions.results ?? []) as Array<Record<string, unknown>>)
    .filter((t) => String(t.display_date || t.date || "").slice(0, 10) >= since120)
    .slice(0, 250)
    .map((t) => {
      const out: Record<string, unknown> = {
        tanggal: String(t.display_date || t.date || "").slice(0, 10),
        jenis: t.type,
        nominalIdr: Math.round(Number(t.amount_idr) || Number(t.amount) || 0),
        kategori: t.category,
        sub: t.sub_category,
        rekening: accountName.get(String(t.account_id)) ?? undefined,
        keRekening: t.target_account_id ? accountName.get(String(t.target_account_id)) : undefined,
        catatan: t.note,
        mataUangAsli: t.currency && t.currency !== "IDR" ? `${t.amount} ${t.currency}` : undefined,
        terkaitInvestasi: t.related_type === "investasi" ? true : undefined,
        pemberiUtang: t.lender_name,
        totalUtang: t.total_debt,
        statusBayar: t.payment_status,
      };
      for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined || out[k] === "") delete out[k];
      return out;
    });

  return {
    analisis,
    accounts: accountsClean,
    totalBalanceIdr,
    accountsMissingRate: accountsMissingRate.length > 0 ? Array.from(new Set(accountsMissingRate)) : undefined,
    monthSummary,
    savingsSummary,
    transaksiTerbaru: recentTransactions,
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
type MarketSnapshot = { text: string; fetchedAt: number; degraded: boolean };
let marketSnapshotCache: MarketSnapshot | null = null;
const MARKET_CACHE_MS = 5 * 60 * 1000;
// Kalau hasil fetch-nya "degradasi" (ada harga inti yang hilang padahal
// response CoinGecko-nya 200 OK — pernah kejadian berulang, kemungkinan
// rate-limit/anti-bot CoinGecko yang selektif per-ID untuk trafik dari IP
// Cloudflare), jangan simpan itu selama 5 menit penuh — cache pendek supaya
// permintaan berikutnya cepat coba lagi alih-alih ikut kena "tidak tersedia"
// selama 5 menit ke semua user.
const MARKET_DEGRADED_CACHE_MS = 20 * 1000;
// "v2": versi baru cache key supaya entri lama (yang mungkin degradasi dan
// masih ke-cache 5 menit) tidak ikut kepakai saat perubahan ini pertama kali
// di-deploy.
const MARKET_CACHE_KEY = new Request("https://cache.internal.leosiqra.com/market-snapshot-v2");

type CryptoPrices = Record<string, { usd?: number; usd_24h_change?: number }>;
const EXPECTED_CRYPTO_IDS = ["bitcoin", "ethereum", "solana", "holotoken", "pax-gold"];

// CoinGecko dengan API key (Demo tier, gratis) jadi provider utama lagi —
// endpoint publik anonim (tanpa key) kena rate-limit (429) dari IP Cloudflare
// Workers karena berbagi pool IP dengan jutaan Workers script lain di dunia;
// API key dapat kuota terpisah per-akun, bukan ikut limit bersama itu. Kalau
// COINGECKO_API_KEY belum diisi di Cloudflare, tetap coba endpoint publik
// (mungkin gagal seperti sebelumnya) supaya tidak keras-mati.
const fetchCryptoFromCoinGecko = async (apiKey?: string): Promise<CryptoPrices | null> => {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)",
      Accept: "application/json",
    };
    if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,holotoken,pax-gold&vs_currencies=usd&include_24hr_change=true",
      { headers }
    );
    if (!res.ok) {
      console.error("CoinGecko fetch gagal:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    return (await res.json()) as CryptoPrices;
  } catch (error) {
    console.error("CoinGecko fetch error:", error);
    return null;
  }
};

// Binance publik sebagai cadangan kalau CoinGecko gagal (mis. key belum
// dipasang, atau CoinGecko sedang bermasalah) — tetap punya semua instrumen
// yang kita perlukan: BTC/ETH/SOL/HOT via pair *USDT, emas via PAXGUSDT (Pax
// Gold, token yang sama yang dipakai CoinGecko sebagai proksi harga emas).
// Catatan: Binance pernah kebalikin 403 (blokir region/IP) dari Cloudflare
// Workers juga, jadi ini bukan jaminan, cuma percobaan tambahan.
const BINANCE_SYMBOL_TO_ID: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
  HOTUSDT: "holotoken",
  PAXGUSDT: "pax-gold",
};

const fetchCryptoFromBinance = async (): Promise<CryptoPrices | null> => {
  try {
    const symbolsParam = encodeURIComponent(JSON.stringify(Object.keys(BINANCE_SYMBOL_TO_ID)));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
      headers: { "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)", Accept: "application/json" },
    });
    if (!res.ok) {
      console.error("Binance fetch gagal:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const raw = (await res.json()) as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>;
    const crypto: CryptoPrices = {};
    for (const t of raw) {
      const id = BINANCE_SYMBOL_TO_ID[t.symbol];
      if (!id) continue;
      crypto[id] = { usd: Number(t.lastPrice), usd_24h_change: Number(t.priceChangePercent) };
    }
    return crypto;
  } catch (error) {
    console.error("Binance fetch error:", error);
    return null;
  }
};

// Proxy CoinGecko untuk halaman member/admin. Browser dulu memanggil
// api.coingecko.com langsung — sebagian koneksi (terlihat dari ISP Indonesia)
// diblokir CloudFront CoinGecko (403 tanpa header CORS), jadi harga kripto di
// Dashboard/Data Pasar/Investasi Lainnya kosong. Lewat Worker: pakai
// COINGECKO_API_KEY, hasil di-cache di edge, dan cuma path + parameter yang
// memang dipakai aplikasi yang diteruskan (bukan open proxy).
const COINGECKO_PROXY_RULES: Record<string, { params: string[]; ttl: number }> = {
  "simple/price": { params: ["ids", "vs_currencies", "include_24hr_change"], ttl: 60 },
  "coins/markets": { params: ["vs_currency", "ids", "price_change_percentage"], ttl: 60 },
  search: { params: ["query"], ttl: 86400 },
};

async function handleCoinGeckoProxy(request: Request, env: Env, subpath: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const rule = COINGECKO_PROXY_RULES[subpath];
  if (!rule) return json({ error: "Not found" }, { status: 404 });

  const incoming = new URL(request.url);
  const upstream = new URL(`https://api.coingecko.com/api/v3/${subpath}`);
  for (const name of rule.params) {
    const value = incoming.searchParams.get(name);
    if (value === null) continue;
    if (value.length > 600) return json({ error: "Parameter terlalu panjang." }, { status: 400 });
    upstream.searchParams.set(name, value);
  }

  const cacheKey = new Request(upstream.toString());
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(cacheKey).catch(() => undefined);
  if (cached) return new Response(cached.body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=30" } });

  const headers: Record<string, string> = { "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)", Accept: "application/json" };
  if (env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
  const res = await fetch(upstream.toString(), { headers }).catch(() => null);
  if (!res || !res.ok) {
    console.error("CoinGecko proxy gagal:", subpath, res?.status);
    return json({ error: "Data kripto sedang tidak tersedia. Coba lagi sebentar." }, { status: 502 });
  }
  const body = await res.text();
  await cache
    .put(cacheKey, new Response(body, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${rule.ttl}` } }))
    .catch(() => undefined);
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=30" } });
}

const fetchMarketSnapshot = async (env: Env): Promise<string> => {
  if (marketSnapshotCache) {
    const ttl = marketSnapshotCache.degraded ? MARKET_DEGRADED_CACHE_MS : MARKET_CACHE_MS;
    if (Date.now() - marketSnapshotCache.fetchedAt < ttl) {
      return marketSnapshotCache.text;
    }
  }

  const edgeCache = caches.default;
  const cachedRes = await edgeCache.match(MARKET_CACHE_KEY);
  if (cachedRes) {
    const text = await cachedRes.text();
    // Cache-Control: max-age dari edgeCache.put menentukan berapa lama entri
    // ini SEHARUSNYA sudah tidak valid — kalau match() masih mengembalikannya
    // meski sudah lewat max-age (Cache API Cloudflare tidak selalu strict soal
    // ini), anggap degraded juga supaya in-memory cache di atas tidak ikut
    // menahan versi basi selama 5 menit penuh.
    const cacheControl = cachedRes.headers.get("cache-control") ?? "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const degraded = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 <= MARKET_DEGRADED_CACHE_MS : false;
    marketSnapshotCache = { text, fetchedAt: Date.now(), degraded };
    return text;
  }

  try {
    const [coinGeckoCrypto, fxRes] = await Promise.all([
      fetchCryptoFromCoinGecko(env.COINGECKO_API_KEY),
      fetch("https://open.er-api.com/v6/latest/USD", {
        headers: { "User-Agent": "Leosiqra/1.0 (+https://www.leosiqra.com)", Accept: "application/json" },
      }),
    ]);

    let crypto: CryptoPrices = coinGeckoCrypto ?? {};
    const coinGeckoMissing = EXPECTED_CRYPTO_IDS.filter((id) => crypto[id]?.usd === undefined);
    if (coinGeckoMissing.length > 0) {
      console.error(`CoinGecko tidak lengkap (hilang: ${coinGeckoMissing.join(", ")}) — coba fallback Binance.`);
      const binanceCrypto = await fetchCryptoFromBinance();
      if (binanceCrypto) {
        // Gabung: pakai CoinGecko sebagai basis, isi yang bolong dari Binance.
        crypto = { ...binanceCrypto, ...crypto };
      }
    }

    if (!fxRes.ok) {
      console.error("Exchange-rate fetch gagal:", fxRes.status, (await fxRes.text()).slice(0, 200));
    }
    if (Object.keys(crypto).length === 0 && !fxRes.ok) {
      // Keduanya (crypto & fx) gagal total — pakai cache lama kalau ada, biar
      // percobaan berikutnya yang menyegarkan.
      if (marketSnapshotCache) return marketSnapshotCache.text;
      throw new Error(`Fetch data pasar gagal total (crypto kosong, fx ${fxRes.status})`);
    }

    const fx = fxRes.ok ? ((await fxRes.json()) as { rates?: Record<string, number> }) : {};
    const idrRate = fx.rates?.IDR;

    const missingIds = EXPECTED_CRYPTO_IDS.filter((id) => crypto[id]?.usd === undefined);
    const isDegraded = missingIds.length > 0 || idrRate === undefined;
    if (missingIds.length > 0) {
      console.error(`Data pasar tetap tidak lengkap setelah fallback — ID hilang: ${missingIds.join(", ")}`);
    }

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
    const cacheMs = isDegraded ? MARKET_DEGRADED_CACHE_MS : MARKET_CACHE_MS;
    marketSnapshotCache = { text, fetchedAt: Date.now(), degraded: isDegraded };
    await edgeCache.put(
      MARKET_CACHE_KEY,
      new Response(text, { headers: { "Cache-Control": `max-age=${cacheMs / 1000}` } })
    );
    return text;
  } catch (error) {
    console.error("Gagal mengambil data pasar untuk AI:", error);
    return marketSnapshotCache?.text ?? "Data pasar sedang tidak tersedia saat ini.";
  }
};

const buildAiSystemPrompt = (userContext: unknown, marketSnapshot: string) => `Kamu adalah Leosiqra — asisten keuangan di aplikasi Leosiqra yang ngobrol kayak teman yang melek duit: santai, jujur, dan to the point.

## Gaya ngobrol (WAJIB)
- Pakai Bahasa Indonesia sehari-hari yang gaul tapi tetap sopan: "aku" & "kamu", boleh "gak", "banget", "sih", "nih", "kok", "yuk", "oke", "mantap", "lumayan". JANGAN pakai "Anda", "saya", atau kalimat kaku ala surat resmi.
- JANGAN kasar, JANGAN ngejek, JANGAN pakai bahasa alay/singkatan aneh (bkn, yg, dgn). Emoji boleh, maksimal 1–2 per jawaban, tidak wajib.
- Kalau user nulis pakai bahasa Inggris atau gaya formal, ikutin gaya mereka.
- Langsung ke inti. Buka dengan jawaban/angka utamanya, baru penjelasan singkat. Hindari basa-basi pembuka ("Tentu!", "Baik, berikut…").
- Jawaban pendek: umumnya 2–6 kalimat. Kalau ada banyak angka/rincian, pakai poin-poin (- ) dan tebalkan angka penting pakai **dua bintang**. Jangan bikin tabel.
- Kalau relevan, tutup dengan 1 saran konkret yang bisa langsung dilakukan (mis. "coba pasang budget Hiburan Rp500 ribu"). Jangan ceramah panjang.
- Kalau pertanyaannya ambigu, tanya balik singkat. Kalau user cuma nyapa, sapa balik singkat dan tawarkan bantuan.

## Cara pakai data (WAJIB)
- Hari ini (WIB): ${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)}.
- SELALU utamakan angka yang sudah dihitung server di "analisis", "monthSummary", "savingsSummary", "totalBalanceIdr" — jangan menjumlahkan ulang sendiri dari "transaksiTerbaru" kalau angkanya sudah tersedia. Salin angka yang sudah berformat apa adanya.
- "analisis.pengeluaranPerKategori" membandingkan bulan ini vs bulan lalu vs rata-rata 3 bulan sebelumnya — pakai ini untuk pertanyaan "aku boros di mana", "kategori apa yang naik". Ingat bulan ini baru berjalan sebagian (lihat analisis.bulanIni.hariKe), jadi untuk perbandingan pakai proyeksi atau rata-rata per hari.
- "analisis.budgetBulanIni" = realisasi budget per kategori; "analisis.jadwalRutin14HariKeDepan" = tagihan/gaji/tabungan rutin yang akan jalan.
- Saldo per rekening: "balance" dalam mata uang ASLI rekening itu (lihat "currency") — jangan sebut Rupiah kalau currency-nya bukan IDR. Untuk total lintas mata uang pakai "balanceIdr"/"totalBalanceIdr". Kalau balanceIdr null (lihat accountsMissingRate), bilang jujur kursnya belum tersedia.
- Rekening bertipe "Credit Card"/"kartu": "balance" negatif = tagihan terpakai; "creditLimit" = limit kartu.
- Transaksi yang "terkaitInvestasi" (beli/jual investasi) dan transfer antar rekening sendiri BUKAN pengeluaran/penghasilan riil — jangan dihitung sebagai belanja atau pemasukan.
- Hutang/piutang ada di transaksi jenis "debt": kategori "Hutang" = user berutang, "Piutang" = user meminjamkan; statusBayar "lunas" berarti sudah selesai.
- Di "investments", "transaction_type" Beli/Pembelian menambah posisi, Jual/Penjualan mengurangi; jangan dijumlah mentah jadi satu.
- Semua nominal Rupiah yang kamu tulis sendiri WAJIB pakai titik ribuan: Rp93.977.366 (bukan Rp93977366). Nominal besar boleh diringkas: Rp12,5 juta.
- Kalau datanya gak ada, bilang jujur dan sarankan cara mencatatnya di Leosiqra — JANGAN mengarang angka.
- Jangan menjanjikan keuntungan investasi pasti, dan jangan menyuruh beli/jual aset tertentu sebagai kepastian — kasih pertimbangan, bukan perintah.

## Data pasar real-time (sudah diambil sistem beberapa menit lalu)
${marketSnapshot}
Kalau ditanya harga kripto, emas, atau kurs USD/IDR, jawab langsung pakai angka di atas persis apa adanya. Jangan bilang kamu gak punya akses data real-time. Kalau barisnya "tidak tersedia", bilang jujur datanya lagi gak tersedia.

## Topik lain
Kamu boleh jawab pertanyaan umum di luar keuangan dengan gaya yang sama, tapi keahlian utamamu adalah keuangan pribadi user di aplikasi ini.

## Data keuangan user (JSON)
${JSON.stringify(userContext)}`;

// Beberapa provider di balik OpenRouter membatasi akses berdasarkan region IP
// pemanggil — IP edge Cloudflare Workers bisa saja diblokir oleh satu provider
// meski modelnya sendiri valid. Kirim beberapa kandidat model sekaligus
// (fitur routing/fallback bawaan OpenRouter) supaya jika satu provider
// menolak, permintaan otomatis dicoba ke provider/model berikutnya.
// Model chat AI Leosiqra (dipilih pemilik aplikasi, 30 Sep 2026): Gemini 2.5
// Flash Lite — ±5x lebih murah dari Gemini 3 Flash (±Rp35 vs Rp182 per pesan
// untuk akun ber-data besar); angka analisis sudah dihitung server, jadi model
// cukup merangkum. Cadangan otomatis kalau provider pertama menolak/gangguan.
// Sengaja di-pin di sini (bukan dari secret OPENROUTER_MODEL yang nilainya
// tidak terlihat di repo); bisa ditimpa lewat var OPENROUTER_CHAT_MODEL.
const OPENROUTER_FALLBACK_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-v3.2",
];

const runOpenRouterAssistant = async (
  env: Env,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  prompt: string
) => {
  const openRouter = await getOpenRouterKey(env);
  if (!openRouter) {
    return "AI-nya belum aktif nih — admin perlu memasang API key OpenRouter dulu.";
  }

  // Batasi riwayat agar konteks tidak membengkak tanpa batas.
  const recentHistory = history.slice(-20);

  const preferredModel = env.OPENROUTER_CHAT_MODEL;
  const models = preferredModel
    ? [preferredModel, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== preferredModel)]
    : OPENROUTER_FALLBACK_MODELS;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openRouter.key}`,
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
      temperature: 0.7,
      max_tokens: 900,
      // Web search (plugin OpenRouter) — model dasar cuma tahu data sampai
      // cutoff training-nya (mis. tidak tahu presiden Indonesia saat ini),
      // plugin ini nyuntik hasil pencarian web sebagai konteks tambahan
      // sebelum model menjawab. INI DIKENAKAN BIAYA TAMBAHAN PER REQUEST oleh
      // OpenRouter (di luar biaya token biasa) — toggle via env var
      // OPENROUTER_WEB_SEARCH kalau ternyata kebutuhan biayanya berubah,
      // tanpa perlu ubah kode lagi.
      ...(env.OPENROUTER_WEB_SEARCH === "true" ? { plugins: [{ id: "web" }] } : {}),
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
  return textOutput || "Waduh, aku lagi gak bisa jawab sekarang. Coba kirim ulang sebentar lagi ya.";
};

// Kredit OpenRouter habis → OpenRouter membalas 402. Tampilkan pesan yang
// jujur ke user (bukan "coba foto lebih jelas"/"ada kendala") dan kabari admin
// lewat Telegram — maksimal sekali per 6 jam per lokasi edge.
const AI_QUOTA_MESSAGE =
  "AI Leosiqra lagi istirahat sebentar karena kuota AI-nya habis. Tim kami sudah dikabari — coba lagi nanti ya, atau catat manual dulu.";
const isAiQuotaError = (err: unknown) => /OpenRouter request gagal \(402\)/.test(err instanceof Error ? err.message : String(err));
const notifyAiQuotaOnce = async (env: Env) => {
  try {
    const key = new Request("https://cache.internal.leosiqra.com/ai-quota-alert");
    if (await caches.default.match(key)) return;
    await caches.default.put(key, new Response("1", { headers: { "Cache-Control": "max-age=21600" } }));
  } catch {
    /* cache tidak tersedia — tetap kirim */
  }
  await sendTelegramNotification(
    env,
    "⚠️ <b>Kredit OpenRouter habis</b>\nAI Leosiqra (chat, scan struk, voice) tidak bisa menjawab sampai kredit diisi.\nIsi di https://openrouter.ai/settings/credits"
  );
};

// ── API key OpenRouter yang bisa diganti admin ─────────────────────────────
// Disimpan terenkripsi (AES-GCM, kunci diturunkan dari SESSION_SECRET via
// HKDF) di tabel app_secrets. Kalau tidak ada / gagal didekripsi (mis.
// SESSION_SECRET dirotasi), jatuh balik ke secret Cloudflare
// OPENROUTER_API_KEY. Sengaja TIDAK lewat Cloudflare API: token yang bisa
// mengubah secret Worker juga bisa mengubah kodenya — terlalu kuat untuk
// disimpan di dalam Worker.
const OPENROUTER_KEY_SECRET_ID = "openrouter_api_key";
// Management key opsional — HANYA dipakai membaca saldo akun
// (/api/v1/credits menolak API key biasa). Tidak pernah dipakai untuk chat.
const OPENROUTER_MANAGEMENT_SECRET_ID = "openrouter_management_key";
const OPENROUTER_KEY_CACHE_MS = 60_000;
let openRouterKeyCache: { value: { key: string; source: "admin" | "cloudflare" } | null; at: number } | null = null;

const appSecretCryptoKey = async (env: Env) => {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("leosiqra-app-secrets"), info: new TextEncoder().encode("v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptAppSecret = async (env: Env, plain: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await appSecretCryptoKey(env), new TextEncoder().encode(plain));
  return `v1.${toBase64Url(iv.buffer)}.${toBase64Url(cipher)}`;
};

const decryptAppSecret = async (env: Env, stored: string) => {
  const [version, ivPart, cipherPart] = stored.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      await appSecretCryptoKey(env),
      fromBase64Url(cipherPart)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
};

const getOpenRouterKey = async (env: Env): Promise<{ key: string; source: "admin" | "cloudflare" } | null> => {
  if (openRouterKeyCache && Date.now() - openRouterKeyCache.at < OPENROUTER_KEY_CACHE_MS) return openRouterKeyCache.value;
  let value: { key: string; source: "admin" | "cloudflare" } | null = null;
  try {
    const row = await env.DB.prepare("SELECT value_enc FROM app_secrets WHERE id = ?")
      .bind(OPENROUTER_KEY_SECRET_ID)
      .first<{ value_enc: string }>();
    const fromAdmin = row ? await decryptAppSecret(env, row.value_enc) : null;
    if (fromAdmin) value = { key: fromAdmin, source: "admin" };
  } catch {
    // Tabel belum ada (migrasi belum jalan) — pakai secret Cloudflare.
  }
  if (!value && env.OPENROUTER_API_KEY) value = { key: env.OPENROUTER_API_KEY, source: "cloudflare" };
  openRouterKeyCache = { value, at: Date.now() };
  return value;
};

const readAppSecret = async (env: Env, id: string) => {
  const row = await env.DB.prepare("SELECT value_enc FROM app_secrets WHERE id = ?")
    .bind(id)
    .first<{ value_enc: string }>()
    .catch(() => null);
  return row ? decryptAppSecret(env, row.value_enc) : null;
};

const maskApiKey = (key: string) => (key.length > 14 ? `${key.slice(0, 9)}…${key.slice(-4)}` : "••••");

type OpenRouterKeyInfo = { label: string | null; usage: number; limit: number | null; limitRemaining: number | null; isFreeTier: boolean };

const fetchOpenRouterKeyInfo = async (key: string): Promise<{ ok: true; info: OpenRouterKeyInfo } | { ok: false; status: number }> => {
  const response = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` } });
  if (!response.ok) return { ok: false, status: response.status };
  const body = (await response.json()) as {
    data?: { label?: string; usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean };
  };
  const d = body.data ?? {};
  return {
    ok: true,
    info: {
      label: d.label ?? null,
      usage: Number(d.usage ?? 0),
      limit: d.limit ?? null,
      limitRemaining: d.limit_remaining ?? null,
      isFreeTier: Boolean(d.is_free_tier),
    },
  };
};

const fetchOpenRouterCredits = async (key: string): Promise<{ total: number; used: number } | null> => {
  const response = await fetch("https://openrouter.ai/api/v1/credits", { headers: { authorization: `Bearer ${key}` } });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: { total_credits?: number; total_usage?: number } };
  if (typeof body.data?.total_credits !== "number") return null;
  return { total: body.data.total_credits, used: Number(body.data.total_usage ?? 0) };
};

async function handleAdminAiStatus(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) return authResult.error;

  const active = await getOpenRouterKey(env);
  const meta = await env.DB.prepare("SELECT updated_by, updated_at FROM app_secrets WHERE id = ?")
    .bind(OPENROUTER_KEY_SECRET_ID)
    .first<{ updated_by: string | null; updated_at: string }>()
    .catch(() => null);
  const managementKey = await readAppSecret(env, OPENROUTER_MANAGEMENT_SECRET_ID);

  const base = {
    source: active?.source ?? "none",
    keyHint: active ? maskApiKey(active.key) : null,
    updatedBy: active?.source === "admin" ? meta?.updated_by ?? null : null,
    updatedAt: active?.source === "admin" ? meta?.updated_at ?? null : null,
    hasCloudflareSecret: Boolean(env.OPENROUTER_API_KEY),
    models: { chat: env.OPENROUTER_CHAT_MODEL || OPENROUTER_FALLBACK_MODELS[0], parse: PARSE_TRANSACTION_MODELS[0] },
    managementKeyHint: managementKey ? maskApiKey(managementKey) : null,
  };
  const [keyInfo, credits] = await Promise.all([
    active ? fetchOpenRouterKeyInfo(active.key).catch(() => ({ ok: false as const, status: 0 })) : { ok: false as const, status: 0 },
    managementKey ? fetchOpenRouterCredits(managementKey).catch(() => null) : null,
  ]);
  return json({
    ...base,
    keyValid: keyInfo.ok,
    keyInfo: keyInfo.ok ? keyInfo.info : null,
    credits: credits ? { ...credits, remaining: Math.max(0, credits.total - credits.used) } : null,
  });
}

// PUT = pasang key baru (dites dulu ke OpenRouter), DELETE = hapus key dari
// admin (API key → kembali ke secret Cloudflare). kind: "api" (default) atau
// "management" (khusus baca saldo). Keduanya wajib password admin.
async function handleAdminAiKey(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) return authResult.error;
  const admin = authResult.session.user;

  if (!(await checkRateLimit(env, [`ai-key:${admin.id}`]))) {
    return json({ error: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi." }, { status: 429 });
  }

  const payload = await parseJson<{ apiKey?: string; password?: string; kind?: string }>(request);
  const isManagement = payload.kind === "management";
  const secretId = isManagement ? OPENROUTER_MANAGEMENT_SECRET_ID : OPENROUTER_KEY_SECRET_ID;
  const keyLabel = isManagement ? "Management key AI" : "API key AI";
  const user = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(admin.id)
    .first<{ password_hash: string }>();
  if (!user) return json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  if (!user.password_hash.startsWith("oauth$")) {
    if (!payload.password) return json({ error: "Masukkan password admin untuk konfirmasi." }, { status: 400 });
    const verification = await verifyPassword(payload.password, user.password_hash);
    if (!verification.ok) return json({ error: "Password admin salah." }, { status: 401 });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM app_secrets WHERE id = ?").bind(secretId).run();
    openRouterKeyCache = null;
    await insertAdminLog(env, admin.email, `Hapus ${keyLabel}`, "OpenRouter", isManagement ? "Saldo tidak dipantau lagi" : "Kembali ke secret Cloudflare", "amber");
    return json({ ok: true });
  }

  const apiKey = String(payload.apiKey ?? "").trim();
  if (!/^sk-or-[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    return json({ error: "Format API key tidak valid. Key OpenRouter diawali \"sk-or-\"." }, { status: 400 });
  }
  if (isManagement) {
    // Management key diverifikasi dengan endpoint yang memang akan dipakai.
    const credits = await fetchOpenRouterCredits(apiKey).catch(() => null);
    if (!credits) {
      return json({ error: "Key ditolak OpenRouter sebagai Management key. Buat di openrouter.ai/settings/management-keys." }, { status: 400 });
    }
  } else {
    const check = await fetchOpenRouterKeyInfo(apiKey).catch(() => ({ ok: false as const, status: 0 }));
    if (!("info" in check)) {
      return json(
        { error: check.status === 401 ? "Key ditolak OpenRouter — pastikan key-nya benar dan belum dihapus." : "Tidak bisa menghubungi OpenRouter untuk mengecek key. Coba lagi." },
        { status: 400 }
      );
    }
  }

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO app_secrets (id, value_enc, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET value_enc = excluded.value_enc, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
  )
    .bind(secretId, await encryptAppSecret(env, apiKey), admin.email, now)
    .run();
  openRouterKeyCache = null;
  await insertAdminLog(env, admin.email, `Ganti ${keyLabel}`, "OpenRouter", maskApiKey(apiKey), "indigo");
  return json({ ok: true, keyHint: maskApiKey(apiKey) });
}

// ── Video promo harian (GitHub Actions → Worker) ───────────────────────────
// Job render di GitHub tidak memegang token Telegram / key OpenRouter; cukup
// satu PROMO_SECRET bersama. Worker yang memanggil OpenRouter (model & batas
// token dikunci — bukan proxy AI umum) dan meneruskan video ke chat admin.
const PROMO_MODELS = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];
const PROMO_MAX_VIDEO_BYTES = 49 * 1024 * 1024; // batas sendVideo Bot API 50 MB

// Dua kunci terpisah (GitHub Actions & Claude Code routine) supaya bisa dicabut
// sendiri-sendiri.
const isPromoAuthorized = (request: Request, env: Env) => {
  const given = request.headers.get("x-promo-secret") ?? "";
  return [env.PROMO_SECRET, env.PROMO_ROUTINE_SECRET].some(
    (secret) => Boolean(secret && secret.length >= 32 && constantTimeEqual(given, secret))
  );
};

async function handlePromoScript(request: Request, env: Env) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  const payload = await parseJson<{ system?: string; user?: string }>(request);
  const system = String(payload.system ?? "");
  const user = String(payload.user ?? "");
  if (!system || !user || system.length > 12_000 || user.length > 12_000) {
    return json({ error: "Prompt tidak valid." }, { status: 400 });
  }
  const openRouter = await getOpenRouterKey(env);
  if (!openRouter) return json({ error: "AI belum dikonfigurasi." }, { status: 503 });
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openRouter.key}`,
      "http-referer": env.APP_URL || "https://www.leosiqra.com",
      "x-title": "Leosiqra Promo",
    },
    body: JSON.stringify({
      models: PROMO_MODELS,
      route: "fallback",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    if (response.status === 402) await notifyAiQuotaOnce(env);
    console.error("Promo script OpenRouter gagal:", response.status, detail);
    return json({ error: `AI gagal (${response.status})` }, { status: 502 });
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json({ content: data.choices?.[0]?.message?.content ?? "" });
}

// multipart: text (wajib, HTML Telegram), video + thumbnail + caption (opsional).
async function handlePromoTelegram(request: Request, env: Env) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({ error: "Telegram belum dikonfigurasi." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Form tidak valid." }, { status: 400 });
  const text = String(form.get("text") ?? "").slice(0, 4000);
  const video = form.get("video");
  const api = (method: string) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const telegramError = async (res: Response) => {
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    return json({ error: `Telegram ${res.status}: ${body.description ?? "gagal"}` }, { status: 502 });
  };

  // id riwayat (opsional) → tombol rating di bawah video; jawabannya masuk
  // lewat /api/promo/telegram-hook dan dibaca routine besok paginya.
  const id = String(form.get("id") ?? "");
  let messageId: number | undefined;

  if (video instanceof File) {
    if (video.size > PROMO_MAX_VIDEO_BYTES) return json({ error: "Video terlalu besar." }, { status: 413 });
    const out = new FormData();
    out.append("chat_id", env.TELEGRAM_CHAT_ID);
    out.append("supports_streaming", "true");
    if (PROMO_ID_RE.test(id)) {
      const rows = [PROMO_RATINGS.map((label, n) => ({ text: label, callback_data: `r:${id}:${n + 1}` }))];
      // Video yang masuk antrean posting otomatis: bisa dibatalkan / dipercepat.
      const on = promoPostingEnabled(env);
      if (form.get("schedule") === "1" && (on.ig || on.yt)) {
        rows.push([
          { text: "⛔ Batal posting", callback_data: `q:${id}:x` },
          { text: "🚀 Posting sekarang", callback_data: `q:${id}:p` },
        ]);
      }
      out.append("reply_markup", JSON.stringify({ inline_keyboard: rows }));
    }
    for (const key of ["width", "height", "duration"]) {
      const v = form.get(key);
      if (typeof v === "string" && /^\d{1,5}$/.test(v)) out.append(key, v);
    }
    out.append("caption", String(form.get("caption") ?? "").slice(0, 1000));
    out.append("video", video, "leosiqra-promo.mp4");
    const thumb = form.get("thumbnail");
    if (thumb instanceof File && thumb.size < 2 * 1024 * 1024) out.append("thumbnail", thumb, "cover.jpg");
    const res = await fetch(api("sendVideo"), { method: "POST", body: out });
    if (!res.ok) return telegramError(res);
    const sent = (await res.json().catch(() => ({}))) as { result?: { message_id?: number } };
    messageId = sent.result?.message_id;
  }
  if (text) {
    const res = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!res.ok) return telegramError(res);
  }
  return json({ ok: true, messageId });
}

// Riwayat video promo (topik/format/gaya yang sudah dipakai) — disimpan di R2
// supaya pembuat video (GitHub Actions / Claude Code routine) yang jalan dari
// mesin baru tiap hari tidak mengulang ide yang sama.
const PROMO_HISTORY_KEY = "promo/history.json";

async function handlePromoHistory(request: Request, env: Env) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  const bucket = env.FILES_BUCKET;
  if (!bucket) return json({ error: "Penyimpanan belum dikonfigurasi." }, { status: 503 });
  if (request.method === "GET") {
    const obj = await bucket.get(PROMO_HISTORY_KEY);
    return json({ items: obj ? JSON.parse(await obj.text()) : [] });
  }
  const body = await request.text();
  if (body.length > 300_000) return json({ error: "Riwayat terlalu besar." }, { status: 413 });
  let items: unknown;
  try {
    items = (JSON.parse(body) as { items?: unknown }).items;
  } catch {
    return json({ error: "JSON tidak valid." }, { status: 400 });
  }
  if (!Array.isArray(items)) return json({ error: "items harus array." }, { status: 400 });
  // Pembuat video menulis ulang seluruh riwayat yang dibacanya di awal render;
  // rating/catatan yang masuk lewat webhook selama render jangan sampai hilang.
  const current = await bucket.get(PROMO_HISTORY_KEY);
  if (current) {
    const saved = new Map(
      (JSON.parse(await current.text()) as PromoHistoryItem[]).filter((it) => it && it.id).map((it) => [it.id, it])
    );
    for (const it of items as PromoHistoryItem[]) {
      const prev = it && it.id ? saved.get(it.id) : undefined;
      if (!prev) continue;
      if (it.rating === undefined && prev.rating !== undefined) Object.assign(it, { rating: prev.rating, ratedAt: prev.ratedAt });
      if (!it.note && prev.note) it.note = prev.note;
    }
  }
  await bucket.put(PROMO_HISTORY_KEY, JSON.stringify(items.slice(-365)), {
    httpMetadata: { contentType: "application/json" },
  });
  return json({ ok: true, count: Math.min(items.length, 365) });
}

// Rating video dari pemilik (tombol di bawah video Telegram) + catatan bebas
// (balas video dengan teks). Tersimpan di item riwayat yang sama, jadi routine
// besok bisa belajar format/gaya/suara mana yang disukai.
const PROMO_RATINGS = ["🔥 Bagus", "👍 Oke", "👎 Kurang"];
const PROMO_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

// Telegram hanya menerima [A-Za-z0-9_-] untuk secret_token, jadi turunkan
// dari PROMO_SECRET (promo/setup-webhook.mjs menghitung yang sama).
const promoHookToken = async (env: Env) => {
  if (!env.PROMO_SECRET || env.PROMO_SECRET.length < 32) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tg-hook:${env.PROMO_SECRET}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

type PromoHistoryItem = { id?: string; tgMessageId?: number; rating?: number; note?: string; ratedAt?: string };

async function handlePromoTelegramHook(request: Request, env: Env) {
  const expected = await promoHookToken(env);
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !constantTimeEqual(given, expected)) return json({ error: "Unauthorized" }, { status: 401 });
  const bucket = env.FILES_BUCKET;
  if (!bucket || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({ ok: true });

  const update = await parseJson<{
    callback_query?: {
      id: string;
      data?: string;
      from?: { id?: number };
      message?: { message_id?: number; chat?: { id?: number }; reply_markup?: { inline_keyboard?: { text: string; callback_data?: string }[][] } };
    };
    message?: {
      message_id?: number;
      text?: string;
      from?: { id?: number };
      chat?: { id?: number };
      reply_to_message?: { message_id?: number };
    };
  }>(request).catch(() => ({}) as Record<string, never>);
  const owner = String(env.TELEGRAM_CHAT_ID);
  const api = (method: string, body: unknown) =>
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const load = async () => {
    const obj = await bucket.get(PROMO_HISTORY_KEY);
    return (obj ? JSON.parse(await obj.text()) : []) as PromoHistoryItem[];
  };
  const save = (items: PromoHistoryItem[]) =>
    bucket.put(PROMO_HISTORY_KEY, JSON.stringify(items.slice(-365)), {
      httpMetadata: { contentType: "application/json" },
    });

  const cb = update.callback_query;
  if (cb) {
    // Hanya pemilik (chat tujuan video) yang boleh menilai.
    if (String(cb.from?.id ?? "") !== owner && String(cb.message?.chat?.id ?? "") !== owner) {
      await api("answerCallbackQuery", { callback_query_id: cb.id });
      return json({ ok: true });
    }
    const m = /^r:([A-Za-z0-9_-]{4,40}):([1-3])$/.exec(cb.data ?? "");
    const q = /^q:([A-Za-z0-9_-]{4,40}):([xp])$/.exec(cb.data ?? "");
    if (/^n:/.test(cb.data ?? "")) {   // tombol status (sudah dipilih): tidak melakukan apa-apa
      await api("answerCallbackQuery", { callback_query_id: cb.id });
      return json({ ok: true });
    }
    let reply = "Rating tidak dikenali.";
    // Tanda yang TETAP terlihat di pesan (notifikasi kecil cepat hilang): tombol terpilih diberi ✅,
    // tombol antrean diganti status, supaya jelas tombolnya bekerja.
    let kb = (cb.message?.reply_markup?.inline_keyboard ?? []).map((row) => row.map((b) => ({ ...b })));
    let touch = false;
    if (q) {
      reply = await setPromoQueueStatus(env, q[1], q[2] === "x" ? "batal" : "sekarang");
      const label = reply.startsWith("⛔") ? "⛔ Posting dibatalkan" : reply.startsWith("🚀") ? "🚀 Akan diposting ±10 menit" : reply.startsWith("Sudah") ? "✅ Sudah terposting" : null;
      if (label) {
        kb = kb.map((row) => (row.some((b) => b.callback_data?.startsWith("q:")) ? [{ text: label, callback_data: `n:${q[1]}` }] : row));
        touch = true;
      }
    } else if (m) {
      const items = await load();
      const item = items.find((it) => it.id === m[1]);
      if (item) {
        item.rating = Number(m[2]);
        item.ratedAt = nowIso();
        await save(items);
        reply = `Tercatat: ${PROMO_RATINGS[item.rating - 1]}. Balas videonya kalau mau kasih catatan.`;
        kb = kb.map((row) => row.map((b) => {
          const mm = /^r:[A-Za-z0-9_-]{4,40}:([1-3])$/.exec(b.callback_data ?? "");
          return mm ? { ...b, text: (mm[1] === m[2] ? "✅ " : "") + PROMO_RATINGS[Number(mm[1]) - 1] } : b;
        }));
        touch = true;
      } else {
        reply = "Video ini tidak ada di riwayat.";
      }
    }
    await api("answerCallbackQuery", { callback_query_id: cb.id, text: reply, show_alert: Boolean(q) });
    const msgId = cb.message?.message_id;
    if (touch && msgId && kb.length) await api("editMessageReplyMarkup", { chat_id: owner, message_id: msgId, reply_markup: { inline_keyboard: kb } }).catch(() => undefined);
    return json({ ok: true });
  }

  const msg = update.message;
  const replyTo = msg?.reply_to_message?.message_id;
  const text = (msg?.text ?? "").trim();
  if (msg && replyTo && text && String(msg.chat?.id ?? "") === owner && !text.startsWith("/")) {
    const items = await load();
    const item = items.find((it) => it.tgMessageId === replyTo);
    if (item) {
      item.note = [item.note, text.slice(0, 500)].filter(Boolean).join(" | ").slice(-1000);
      await save(items);
      await api("sendMessage", { chat_id: owner, text: "📝 Catatan disimpan, dipakai tim konten besok.", reply_to_message_id: msg.message_id });
    }
  }
  return json({ ok: true });
}

// Angka nyata untuk tim AI (LGBLACK Tower / routine): HANYA agregat jumlah —
// tidak ada id, email, nama, atau data keuangan user. Admin & akun demo promo
// tidak ikut dihitung.
async function handlePromoStats(request: Request, env: Env) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new1d,
       SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new7d,
       SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new30d,
       SUM(CASE WHEN plan = 'PRO' AND (expired_at IS NULL OR expired_at > ?) THEN 1 ELSE 0 END) AS pro
     FROM users
     WHERE role = 'user' AND lower(email) <> ?`
  )
    .bind(iso(now - 86400000), iso(now - 7 * 86400000), iso(now - 30 * 86400000), iso(now), PROMO_DEMO_EMAIL)
    .first<{ total: number; new1d: number | null; new7d: number | null; new30d: number | null; pro: number | null }>();
  return json({
    members: {
      total: row?.total ?? 0,
      new1d: row?.new1d ?? 0,
      new7d: row?.new7d ?? 0,
      new30d: row?.new30d ?? 0,
      pro: row?.pro ?? 0,
    },
    at: nowIso(),
  });
}
const PROMO_DEMO_EMAIL = "leowendry+demo@gmail.com";

// ── Posting otomatis video promo (Instagram Reels + YouTube Shorts) ─────────
// Alur: make.mjs mengunggah video (PUT /api/promo/upload) + mendaftarkan
// antrean (POST /api/promo/queue) → video Telegram dapat tombol ⛔ Batal /
// 🚀 Posting sekarang → cron 10 menitan memposting yang sudah waktunya
// (default 19:00 WIB). Instagram butuh URL video publik: dilayani Worker lewat
// URL bertanda tangan (HMAC, kedaluwarsa 2 hari), bukan bucket publik.
const PROMO_QUEUE_CRON = "*/10 * * * *";
const PROMO_QUEUE_KEY = "promo/queue.json";
const PROMO_IG_TOKEN_KEY = "promo/ig-token.json";
const IG_API = "https://graph.instagram.com/v23.0";

type PromoPlatformState = { id?: string; container?: string; url?: string; error?: string; tries?: number; doneAt?: string };
type PromoQueueItem = {
  id: string;
  title: string;
  caption: string;
  postAt: string;
  status: "terjadwal" | "batal" | "terposting" | "gagal";
  createdAt: string;
  ig?: PromoPlatformState;
  yt?: PromoPlatformState;
  metrics?: { ig?: Record<string, number>; yt?: Record<string, number>; at?: string };
};

const promoPostingEnabled = (env: Env) => ({
  ig: Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN),
  yt: Boolean(env.YT_CLIENT_ID && env.YT_CLIENT_SECRET && env.YT_REFRESH_TOKEN),
});

const loadPromoQueue = async (env: Env): Promise<PromoQueueItem[]> => {
  const obj = await env.FILES_BUCKET?.get(PROMO_QUEUE_KEY);
  return obj ? (JSON.parse(await obj.text()) as PromoQueueItem[]) : [];
};
const savePromoQueue = (env: Env, items: PromoQueueItem[]) =>
  env.FILES_BUCKET?.put(PROMO_QUEUE_KEY, JSON.stringify(items.slice(-60)), { httpMetadata: { contentType: "application/json" } });

const promoMediaSig = async (env: Env, id: string, exp: number) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`promo-media:${env.PROMO_SECRET ?? ""}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${exp}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const promoMediaUrl = async (env: Env, id: string) => {
  const exp = Math.floor(Date.now() / 1000) + 2 * 86400;
  // workers.dev, bukan www: proteksi bot Cloudflare di zona www menantang IP
  // datacenter (termasuk server Meta yang mengunduh video).
  const base = "https://membersite-leosiqra.leowendry.workers.dev";
  return `${base}/api/promo/media/${id}.mp4?exp=${exp}&sig=${await promoMediaSig(env, id, exp)}`;
};

// PUT /api/promo/upload?id=<id> — body = mp4.
async function handlePromoUpload(request: Request, env: Env, url: URL) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  const id = url.searchParams.get("id") ?? "";
  if (!PROMO_ID_RE.test(id)) return json({ error: "id tidak valid." }, { status: 400 });
  const size = Number(request.headers.get("content-length") ?? 0);
  if (!size || size > PROMO_MAX_VIDEO_BYTES) return json({ error: "Ukuran video tidak valid (maks 49 MB)." }, { status: 413 });
  if (!env.FILES_BUCKET) return json({ error: "Penyimpanan belum dikonfigurasi." }, { status: 503 });
  const body = await request.arrayBuffer();
  if (body.byteLength > PROMO_MAX_VIDEO_BYTES) return json({ error: "Video terlalu besar." }, { status: 413 });
  await env.FILES_BUCKET.put(`promo/videos/${id}.mp4`, body, { httpMetadata: { contentType: "video/mp4" } });
  return json({ ok: true, bytes: body.byteLength });
}

// GET /api/promo/media/<id>.mp4?exp&sig — untuk Instagram (butuh URL publik).
async function handlePromoMedia(request: Request, env: Env, url: URL, id: string) {
  const exp = Number(url.searchParams.get("exp") ?? 0);
  const sig = url.searchParams.get("sig") ?? "";
  if (!PROMO_ID_RE.test(id) || !exp || exp < Date.now() / 1000 || !env.PROMO_SECRET) return new Response("Not found", { status: 404 });
  if (!constantTimeEqual(sig, await promoMediaSig(env, id, exp))) return new Response("Not found", { status: 404 });
  const obj = await env.FILES_BUCKET?.get(`promo/videos/${id}.mp4`);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers: { "content-type": "video/mp4", "content-length": String(obj.size), "cache-control": "private, max-age=3600" } });
}

// POST /api/promo/queue {id, title, caption, postAt?} — daftarkan video ke antrean.
async function handlePromoQueue(request: Request, env: Env) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.FILES_BUCKET) return json({ error: "Penyimpanan belum dikonfigurasi." }, { status: 503 });
  if (request.method === "GET") return json({ items: await loadPromoQueue(env), enabled: promoPostingEnabled(env) });
  const p = await parseJson<{ id?: string; title?: string; caption?: string; postAt?: string }>(request);
  const id = String(p.id ?? "");
  if (!PROMO_ID_RE.test(id)) return json({ error: "id tidak valid." }, { status: 400 });
  if (!(await env.FILES_BUCKET.head(`promo/videos/${id}.mp4`))) return json({ error: "Video belum diunggah." }, { status: 400 });
  const postAt = p.postAt && !Number.isNaN(Date.parse(p.postAt)) ? new Date(p.postAt).toISOString() : defaultPromoPostAt();
  const items = await loadPromoQueue(env);
  const item: PromoQueueItem = {
    id,
    title: String(p.title ?? "").slice(0, 95),
    caption: String(p.caption ?? "").slice(0, 2100),
    postAt,
    status: "terjadwal",
    createdAt: nowIso(),
  };
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) items[i] = { ...items[i], ...item, ig: items[i].ig, yt: items[i].yt };
  else items.push(item);
  await savePromoQueue(env, items);
  return json({ ok: true, postAt, enabled: promoPostingEnabled(env) });
}

// 19:00 WIB hari ini (atau besok kalau sudah lewat).
const defaultPromoPostAt = () => {
  const now = Date.now();
  const wib = new Date(now + 7 * 3600e3);
  const target = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 19 - 7, 0, 0);
  return new Date(target > now ? target : target + 86400e3).toISOString();
};

const setPromoQueueStatus = async (env: Env, id: string, action: "batal" | "sekarang") => {
  const items = await loadPromoQueue(env);
  const item = items.find((x) => x.id === id);
  if (!item) return "Video ini tidak ada di antrean posting.";
  if (item.status === "terposting") return "Sudah terposting.";
  if (action === "batal") {
    item.status = "batal";
    await savePromoQueue(env, items);
    return "⛔ Posting dibatalkan.";
  }
  item.status = "terjadwal";
  item.postAt = nowIso();
  await savePromoQueue(env, items);
  return "🚀 Diposting dalam ±10 menit.";
};

// ── Instagram (Instagram API with Instagram Login) ──
const instagramToken = async (env: Env) => {
  const obj = await env.FILES_BUCKET?.get(PROMO_IG_TOKEN_KEY);
  const saved = obj ? (JSON.parse(await obj.text()) as { token: string; refreshedAt: string }) : null;
  let token = saved?.token || env.IG_ACCESS_TOKEN || "";
  const age = saved ? Date.now() - Date.parse(saved.refreshedAt) : Infinity;
  // Token long-lived berlaku 60 hari; perpanjang tiap ±20 hari.
  if (token && age > 20 * 86400e3) {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const data = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && data.access_token) {
      token = data.access_token;
      await env.FILES_BUCKET?.put(PROMO_IG_TOKEN_KEY, JSON.stringify({ token, refreshedAt: nowIso() }), { httpMetadata: { contentType: "application/json" } });
    }
  }
  return token;
};

const igCall = async (path: string, token: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET") => {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${IG_API}/${path}${method === "GET" ? `?${qs}` : ""}`, method === "POST" ? { method, body: qs } : undefined);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || data.error) throw new Error(`Instagram ${res.status}: ${data.error?.message ?? "gagal"}`.slice(0, 200));
  return data;
};

// Satu langkah per cron (container → tunggu FINISHED → publish) supaya tidak
// menunggu lama di satu eksekusi.
const stepInstagram = async (env: Env, item: PromoQueueItem) => {
  const st = (item.ig ??= {});
  if (st.id) return;
  const token = await instagramToken(env);
  if (!st.container) {
    const data = await igCall(`${env.IG_USER_ID}/media`, token, { media_type: "REELS", video_url: await promoMediaUrl(env, item.id), caption: item.caption, share_to_feed: "true" }, "POST");
    st.container = String(data.id);
    return;
  }
  const c = await igCall(st.container, token, { fields: "status_code,status" });
  if (c.status_code === "ERROR" || c.status_code === "EXPIRED") throw new Error(`Instagram memproses video gagal: ${String(c.status ?? c.status_code)}`);
  if (c.status_code !== "FINISHED") return;
  const pub = await igCall(`${env.IG_USER_ID}/media_publish`, token, { creation_id: st.container }, "POST");
  st.id = String(pub.id);
  const info = await igCall(st.id, token, { fields: "permalink" }).catch(() => ({}) as Record<string, unknown>);
  st.url = String(info.permalink ?? "");
  st.doneAt = nowIso();
};

// ── YouTube (Data API v3, upload resumable) ──
const youtubeAccessToken = async (env: Env) => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.YT_CLIENT_ID ?? "", client_secret: env.YT_CLIENT_SECRET ?? "", refresh_token: env.YT_REFRESH_TOKEN ?? "", grant_type: "refresh_token" }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Token YouTube gagal: ${data.error_description ?? data.error ?? res.status}`);
  return data.access_token;
};

const stepYoutube = async (env: Env, item: PromoQueueItem) => {
  const st = (item.yt ??= {});
  if (st.id) return;
  const obj = await env.FILES_BUCKET?.get(`promo/videos/${item.id}.mp4`);
  if (!obj) throw new Error("file video hilang dari R2");
  const token = await youtubeAccessToken(env);
  const title = /#shorts/i.test(item.title) ? item.title : `${item.title} #Shorts`.slice(0, 100);
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": "video/mp4", "x-upload-content-length": String(obj.size) },
    body: JSON.stringify({
      snippet: { title, description: item.caption.slice(0, 4900), categoryId: "22", defaultLanguage: "id", defaultAudioLanguage: "id" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  const session = init.headers.get("location");
  if (!init.ok || !session) throw new Error(`YouTube init ${init.status}: ${(await init.text()).slice(0, 150)}`);
  const up = await fetch(session, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(obj.size) }, body: await obj.arrayBuffer() });
  const data = (await up.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!up.ok || !data.id) throw new Error(`YouTube upload ${up.status}: ${data.error?.message ?? ""}`.slice(0, 200));
  st.id = data.id;
  st.url = `https://youtube.com/shorts/${data.id}`;
  st.doneAt = nowIso();
};

const promoTelegram = (env: Env, text: string) =>
  env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
    ? fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      }).catch(() => null)
    : Promise.resolve(null);

// Metrik nyata (views/likes/komentar) untuk video 7 hari terakhir — sekali sehari.
const collectPromoMetrics = async (env: Env, items: PromoQueueItem[]) => {
  const recent = items.filter((x) => x.status === "terposting" && Date.now() - Date.parse(x.postAt) < 8 * 86400e3);
  const ytIds = recent.map((x) => x.yt?.id).filter(Boolean) as string[];
  const yt: Record<string, Record<string, number>> = {};
  if (ytIds.length && promoPostingEnabled(env).yt) {
    try {
      const token = await youtubeAccessToken(env);
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ytIds.join(",")}`, { headers: { authorization: `Bearer ${token}` } });
      const data = (await res.json().catch(() => ({}))) as { items?: Array<{ id: string; statistics?: Record<string, string> }> };
      for (const v of data.items ?? []) yt[v.id] = { views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0), comments: Number(v.statistics?.commentCount ?? 0) };
    } catch (error) {
      console.error("metrik YouTube:", error);
    }
  }
  const igToken = promoPostingEnabled(env).ig ? await instagramToken(env).catch(() => "") : "";
  for (const item of recent) {
    item.metrics ??= {};
    if (item.yt?.id && yt[item.yt.id]) item.metrics.yt = yt[item.yt.id];
    if (igToken && item.ig?.id) {
      try {
        const base = await igCall(item.ig.id, igToken, { fields: "like_count,comments_count" });
        const ins = await igCall(`${item.ig.id}/insights`, igToken, { metric: "views,reach,saved,shares" }).catch(() => ({ data: [] }) as Record<string, unknown>);
        const m: Record<string, number> = { likes: Number(base.like_count ?? 0), comments: Number(base.comments_count ?? 0) };
        for (const d of (ins.data as Array<{ name: string; values?: Array<{ value: number }> }>) ?? []) m[d.name] = Number(d.values?.[0]?.value ?? 0);
        item.metrics.ig = m;
      } catch (error) {
        console.error("metrik Instagram:", error);
      }
    }
    item.metrics.at = nowIso();
  }
  // Salin ke riwayat supaya routine (lessons.mjs) belajar dari angka nyata.
  const obj = await env.FILES_BUCKET?.get(PROMO_HISTORY_KEY);
  if (obj) {
    const hist = JSON.parse(await obj.text()) as Array<Record<string, unknown>>;
    for (const item of recent) {
      const h = hist.find((x) => x.id === item.id);
      if (!h) continue;
      h.metrics = item.metrics;
      h.igUrl = item.ig?.url || undefined;
      h.ytUrl = item.yt?.url || undefined;
    }
    await env.FILES_BUCKET?.put(PROMO_HISTORY_KEY, JSON.stringify(hist.slice(-365)), { httpMetadata: { contentType: "application/json" } });
  }
};

async function processPromoQueue(env: Env) {
  if (!env.FILES_BUCKET) return;
  const on = promoPostingEnabled(env);
  const items = await loadPromoQueue(env);
  let changed = false;
  for (const item of items) {
    if (item.status !== "terjadwal" || Date.parse(item.postAt) > Date.now()) continue;
    for (const [name, enabled, step] of [["ig", on.ig, stepInstagram], ["yt", on.yt, stepYoutube]] as const) {
      const st = (item[name] ??= {});
      if (!enabled || st.id || (st.tries ?? 0) >= 3) continue;
      try {
        await step(env, item);
        st.error = undefined;
      } catch (error) {
        st.tries = (st.tries ?? 0) + 1;
        st.error = String(error instanceof Error ? error.message : error).slice(0, 200);
        if (name === "ig") st.container = undefined;
      }
      changed = true;
    }
    const states = [on.ig ? item.ig : null, on.yt ? item.yt : null].filter(Boolean) as PromoPlatformState[];
    const finished = states.every((s) => s.id || (s.tries ?? 0) >= 3);
    if (states.length && finished) {
      item.status = states.some((s) => s.id) ? "terposting" : "gagal";
      changed = true;
      const lines = [
        item.status === "terposting" ? `✅ Video promo terposting: "${item.title}"` : `⚠️ Posting video "${item.title}" gagal`,
        on.ig ? `Instagram: ${item.ig?.url || item.ig?.error || "-"}` : "",
        on.yt ? `YouTube: ${item.yt?.url || item.yt?.error || "-"}` : "",
      ].filter(Boolean);
      await promoTelegram(env, lines.join("\n"));
    }
  }
  // Metrik sekali sehari, sekitar 07:00 WIB.
  const wibHour = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  const wibMin = new Date().getUTCMinutes();
  if (wibHour === 7 && wibMin < 10) {
    await collectPromoMetrics(env, items);
    changed = true;
  }
  if (changed) await savePromoQueue(env, items);
}

// Kerja tim konten dipecah beberapa sesi sehari (ide → naskah → produksi);
// tiap sesi jalan di mesin baru, jadi hasil antar-sesi disimpan di R2.
// key: draft-YYYY-MM-DD (per hari) atau playbook (pelajaran jangka panjang).
async function handlePromoDraft(request: Request, env: Env, url: URL) {
  if (!isPromoAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  const bucket = env.FILES_BUCKET;
  if (!bucket) return json({ error: "Penyimpanan belum dikonfigurasi." }, { status: 503 });
  const key = url.searchParams.get("key") ?? "";
  if (!/^(draft-\d{4}-\d{2}-\d{2}|playbook)$/.test(key)) return json({ error: "key tidak valid." }, { status: 400 });
  const r2Key = `promo/${key}.json`;
  if (request.method === "GET") {
    const obj = await bucket.get(r2Key);
    return json({ data: obj ? JSON.parse(await obj.text()) : null });
  }
  const body = await request.text();
  if (body.length > 200_000) return json({ error: "Draft terlalu besar." }, { status: 413 });
  let data: unknown;
  try {
    data = (JSON.parse(body) as { data?: unknown }).data;
  } catch {
    return json({ error: "JSON tidak valid." }, { status: 400 });
  }
  if (data === null || typeof data !== "object") return json({ error: "data harus objek." }, { status: 400 });
  await bucket.put(r2Key, JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
  return json({ ok: true });
}

const runAiAssistant = async (
  env: Env,
  prompt: string,
  userContext: unknown,
  history: Array<{ role: "user" | "assistant"; content: string }>
) => {
  const marketSnapshot = await fetchMarketSnapshot(env);
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
  // Aturan sama dengan reset/ganti password — dulu pendaftaran menerima
  // password sepanjang apa pun (bahkan 1 karakter) karena hanya dicek di klien.
  if (payload.password.length < 8) {
    return json({ error: "Password minimal 8 karakter." }, { status: 400 });
  }
  if (payload.password.length > 200) {
    return json({ error: "Password terlalu panjang." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email).trim())) {
    return json({ error: "Format email tidak valid." }, { status: 400 });
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

    // Email yang sudah terdaftar SELALU ditolak. Dulu akun Google-only
    // (password_hash sentinel `oauth$google`) boleh "diklaim" lewat register —
    // itu account takeover: siapa pun yang tahu email user Google bisa set
    // password + 2FA baru dan langsung dapat sesi sebagai korban tanpa
    // verifikasi apa pun. User Google yang ingin punya password lokal harus
    // lewat Lupa Password (membuktikan kepemilikan email) atau Profil (sesi
    // yang sudah login).
    if (existing.password_hash.startsWith("oauth$")) {
      return json(
        { error: "Email ini sudah terdaftar lewat Google. Silakan masuk dengan tombol \"Lanjutkan dengan Google\"." },
        { status: 409 }
      );
    }
    return json(
      { error: "Email sudah terdaftar. Silakan login, atau gunakan menu lupa password." },
      { status: 409 }
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
    twoFactorEnabled: Boolean(payload.twoFactorSecret),
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

const PASSWORD_RESET_TTL_MINUTES = 30;
// Jeda minimal antar email reset ke alamat yang sama — cegah inbox korban
// dibanjiri lewat endpoint publik ini.
const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 120;
const PASSWORD_RESET_DEFAULT_ORIGIN = "https://www.leosiqra.com";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const sendPasswordResetEmail = async (env: Env, to: string, name: string, link: string) => {
  const safeName = escapeHtml(name || "Sobat Leosiqra");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px">Reset password Leosiqra</h1>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Halo ${safeName},</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6">Kami menerima permintaan untuk mengatur ulang password akun Leosiqra kamu. Klik tombol di bawah untuk membuat password baru. Link ini berlaku ${PASSWORD_RESET_TTL_MINUTES} menit dan hanya bisa dipakai sekali.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:10px">Buat password baru</a></p>
    <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.6">Kalau tombol tidak bisa diklik, salin link ini ke browser:<br><span style="word-break:break-all">${link}</span></p>
    <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6">Tidak merasa meminta reset? Abaikan email ini — password kamu tidak berubah.</p>
  </div></body></html>`;
  const textBody = `Halo ${name || "Sobat Leosiqra"},\n\nKlik link berikut untuk membuat password baru (berlaku ${PASSWORD_RESET_TTL_MINUTES} menit, sekali pakai):\n${link}\n\nTidak merasa meminta reset? Abaikan email ini — password kamu tidak berubah.`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || "Leosiqra <no-reply@leosiqra.com>",
      to: [to],
      subject: "Reset password Leosiqra",
      html,
      text: textBody,
    }),
  });
  if (!response.ok) {
    // Detail error cuma di log server, tidak pernah ke client.
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
};

// POST /api/auth/password/forgot — publik. Jawabannya SELALU sama untuk email
// terdaftar maupun tidak (cegah enumerasi akun).
async function handleForgotPassword(request: Request, env: Env) {
  const genericOk = json({
    ok: true,
    message: "Kalau email tersebut terdaftar, link reset password sudah kami kirim. Cek inbox dan folder spam.",
  });

  if (!env.RESEND_API_KEY) {
    return json(
      { error: "Reset password lewat email belum aktif. Silakan hubungi admin lewat WhatsApp." },
      { status: 503 }
    );
  }

  const payload = await parseJson<{ email?: string }>(request);
  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) {
    return json({ error: "Masukkan alamat email yang valid." }, { status: 400 });
  }

  if (
    !(await checkRateLimit(env, [
      `forgot:ip:${clientIpOf(request)}`,
      `forgot:email:${email}`,
    ]))
  ) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat." }, { status: 429 });
  }

  const user = await env.DB.prepare("SELECT id, name, email, role FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; name: string; email: string; role: string }>();
  if (!user) {
    return genericOk;
  }

  const recent = await env.DB.prepare(
    "SELECT created_at FROM password_reset_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(user.id)
    .first<{ created_at: string }>();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000) {
    return genericOk;
  }

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(tokenBytes.buffer);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

  // Token lama yang belum terpakai dimatikan — cuma link terbaru yang berlaku.
  await env.DB.batch([
    env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL")
      .bind(now, user.id),
    env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(generateId(), user.id, await sha256Hex(token), expiresAt, await sha256Hex(clientIpOf(request)), now),
  ]);

  // Link cuma boleh mengarah ke origin Leosiqra yang dikenal — jangan pernah
  // pakai Host dari request mentah-mentah (host header injection di email reset).
  const requestOrigin = new URL(request.url).origin;
  const linkOrigin =
    ALLOWED_ORIGINS.has(requestOrigin) && requestOrigin.startsWith("https://")
      ? requestOrigin
      : PASSWORD_RESET_DEFAULT_ORIGIN;
  const link = `${linkOrigin}/auth/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail(env, user.email, user.name, link);
  } catch (error) {
    // Tetap jawab generik: membalas error khusus di sini (padahal email tak
    // terdaftar dapat 200) membocorkan email mana yang terdaftar setiap kali
    // Resend sedang gangguan. Kegagalan cukup tercatat di log Worker.
    console.error("Gagal mengirim email reset password:", error);
  }

  return genericOk;
}

// POST /api/auth/password/reset — publik, dibuktikan oleh token dari email.
async function handleResetPassword(request: Request, env: Env) {
  const payload = await parseJson<{ token?: string; password?: string }>(request);
  const token = (payload.token ?? "").trim();
  const password = payload.password ?? "";

  if (!token) {
    return json({ error: "Link reset tidak valid." }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
  }
  if (password.length > 200) {
    return json({ error: "Password terlalu panjang." }, { status: 400 });
  }

  if (!(await checkRateLimit(env, [`reset:ip:${clientIpOf(request)}`]))) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat." }, { status: 429 });
  }

  const tokenHash = await sha256Hex(token);
  const now = nowIso();
  const row = await env.DB.prepare(
    `SELECT user_id FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
  )
    .bind(tokenHash, now)
    .first<{ user_id: string }>();

  const invalid = json(
    { error: "Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru." },
    { status: 400 }
  );
  if (!row) {
    return invalid;
  }

  // Satu batch atomik: klaim token (hanya kalau masih belum terpakai), lalu
  // ganti password, cabut SEMUA sesi user, dan matikan token lain — tiga
  // langkah terakhir disyaratkan nonce milik request ini yang berhasil
  // mengklaim token, jadi request kedua dengan token sama tidak mengubah apa pun.
  const nonce = generateId();
  const claimed = "EXISTS (SELECT 1 FROM password_reset_tokens WHERE token_hash = ? AND consume_nonce = ?)";
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE password_reset_tokens SET used_at = ?, consume_nonce = ?
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
    ).bind(now, nonce, tokenHash, now),
    env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND ${claimed}`)
      .bind(await hashPassword(password), now, row.user_id, tokenHash, nonce),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND ${claimed}`)
      .bind(row.user_id, tokenHash, nonce),
    env.DB.prepare(
      `UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL AND ${claimed}`
    ).bind(now, row.user_id, tokenHash, nonce),
  ]);

  if (!results[0]?.meta.changes) {
    return invalid;
  }

  return json({ ok: true });
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
      twoFactorEnabled: Boolean(user.two_factor_secret),
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

// Cuma terima redirect target ke tree /app (UI mobile/Capacitor) atau
// /input-cepat (PWA Input Cepat) — mencegah open redirect kalau parameter/
// cookie ini diisi sembarangan. Mirror dari sanitizeNext di
// src/app/auth/login/page.tsx.
const isAppNext = (value: string | null | undefined): value is string =>
  Boolean(value && /^\/(app|input-cepat)(\/|\?|$)/.test(value));

const oauthNextCookie = (next: string) =>
  `oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

const clearOauthNextCookie = () =>
  `oauth_next=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// Login Google untuk akun yang mengaktifkan 2FA: sesi BELUM dibuat di callback.
// Cookie sementara bertanda tangan (5 menit) menyimpan user & tujuan, lalu
// kode Authenticator diverifikasi di POST /api/auth/google/2fa. Dulu login
// Google langsung masuk tanpa kode — melewati 2FA yang sengaja dipasang user.
const GOOGLE_2FA_COOKIE = "oauth_2fa";
const GOOGLE_2FA_TTL_SECONDS = 300;
const createGoogle2faCookie = async (env: Env, userId: string, next: string) => {
  const body = `${userId}|${Date.now() + GOOGLE_2FA_TTL_SECONDS * 1000}|${encodeURIComponent(next)}`;
  const sig = await signSession(env, `g2fa|${body}`);
  return `${GOOGLE_2FA_COOKIE}=${encodeURIComponent(`${body}.${sig}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${GOOGLE_2FA_TTL_SECONDS}`;
};
const clearGoogle2faCookie = () => `${GOOGLE_2FA_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const readGoogle2faCookie = async (env: Env, request: Request) => {
  const raw = getCookieValue(request, GOOGLE_2FA_COOKIE);
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!constantTimeEqual(sig, await signSession(env, `g2fa|${body}`))) return null;
  const [userId, exp, next] = body.split("|");
  if (!userId || !(Number(exp) > Date.now())) return null;
  return { userId, next: decodeURIComponent(next ?? "") };
};

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
  const next = url.searchParams.get("next");
  if (isAppNext(next)) {
    headers.append("set-cookie", oauthNextCookie(next));
  }
  return new Response(null, { status: 302, headers });
}

async function handleGoogleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const failRedirect = (message: string) => {
    const headers = new Headers({
      location: `${url.origin}/auth/login?error=${encodeURIComponent(message)}`,
    });
    headers.append("set-cookie", clearOauthStateCookie());
    headers.append("set-cookie", clearOauthNextCookie());
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
  if (!profile.email || profile.email_verified !== true) {
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

  const cookieNext = getCookieValue(request, "oauth_next");

  if (user.two_factor_secret) {
    const next = user.role === "admin" ? "/admin" : isAppNext(cookieNext) ? cookieNext : "/membership/dashboard";
    const headers = new Headers({ location: `${url.origin}/auth/login?google2fa=1` });
    headers.append("set-cookie", clearOauthStateCookie());
    headers.append("set-cookie", clearOauthNextCookie());
    headers.append("set-cookie", await createGoogle2faCookie(env, user.id, next));
    return new Response(null, { status: 302, headers });
  }

  const session = await createSession(env, request, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    status: user.status,
    whatsapp: user.whatsapp,
    twoFactorEnabled: Boolean(user.two_factor_secret),
  });

  const destination =
    user.role === "admin"
      ? "/admin"
      : isAppNext(cookieNext)
      ? cookieNext
      : "/membership/dashboard";
  const headers = new Headers({ location: `${url.origin}${destination}` });
  headers.append("set-cookie", clearOauthStateCookie());
  headers.append("set-cookie", clearOauthNextCookie());
  headers.append("set-cookie", sessionCookie(env, session.token, 60 * 60 * 24 * 30));
  headers.append("set-cookie", roleCookie(env, user.role, 60 * 60 * 24 * 30));
  return new Response(null, { status: 302, headers });
}

async function handleGoogle2fa(request: Request, env: Env) {
  const pending = await readGoogle2faCookie(env, request);
  if (!pending) {
    return json({ error: "Sesi login Google sudah habis. Silakan masuk dengan Google lagi." }, { status: 401 });
  }
  if (!(await checkRateLimit(env, [`login:ip:${clientIpOf(request)}`, `login:g2fa:${pending.userId}`]))) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat." }, { status: 429 });
  }
  const payload = await parseJson<{ twoFactorToken?: string; isPwa?: boolean }>(request);
  const user = await env.DB.prepare(
    `SELECT id, name, email, role, plan, status, whatsapp, two_factor_secret FROM users WHERE id = ?`
  )
    .bind(pending.userId)
    .first<{
      id: string; name: string; email: string; role: "admin" | "user"; plan: "FREE" | "PRO";
      status: "AKTIF" | "NONAKTIF" | "GUEST" | "PENDING"; whatsapp?: string | null; two_factor_secret?: string | null;
    }>();
  if (!user) return json({ error: "Akun tidak ditemukan." }, { status: 401 });
  if (
    user.two_factor_secret &&
    !(payload.twoFactorToken && verifySync({ token: payload.twoFactorToken, secret: user.two_factor_secret, strategy: "totp" }).valid)
  ) {
    return json({ error: "Kode 2FA tidak valid." }, { status: 401 });
  }
  const session = await createSession(
    env,
    request,
    {
      id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan,
      status: user.status, whatsapp: user.whatsapp, twoFactorEnabled: Boolean(user.two_factor_secret),
    },
    { permanent: payload.isPwa === true }
  );
  const destination = user.role === "admin" ? "/admin" : isAppNext(pending.next) ? pending.next : "/membership/dashboard";
  return jsonWithCookies(
    { ok: true, destination, user: { role: user.role } },
    [clearGoogle2faCookie(), sessionCookie(env, session.token, session.maxAgeSeconds), roleCookie(env, user.role, session.maxAgeSeconds)]
  );
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
  // Khusus type "debt": saldo rekening langsung ikut berubah saat dicatat
  // (piutang = uang keluar, hutang tunai = uang masuk). Lihat debtBalanceDelta.
  applyDebtBalance?: boolean;
}

// Jenis hutang yang uangnya tidak pernah masuk ke rekening (belanjanya sudah
// tercatat sebagai pengeluaran) — mencatat hutangnya tidak boleh menambah saldo.
const DEBT_KINDS_WITHOUT_CASH = new Set(["Kartu Kredit", "Paylater"]);

// Perubahan saldo saat hutang/piutang DICATAT (bukan saat dibayar): piutang
// mengurangi saldo rekening (uang dipinjamkan), hutang tunai menambah saldo.
// 0 kalau tidak berlaku. Pembayaran/pelunasan tetap lewat pemasukan/pengeluaran
// biasa, jadi siklus pinjam → lunas kembali netral.
const debtBalanceDelta = (category: string | null | undefined, subCategory: string | null | undefined, amount: number) => {
  if (category === "Piutang") return -amount;
  if (category === "Hutang" && !DEBT_KINDS_WITHOUT_CASH.has(subCategory ?? "")) return amount;
  return 0;
};

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

  // Hutang/piutang yang langsung memengaruhi saldo: hanya ke rekening sungguhan
  // dengan mata uang yang sama (tanpa konversi diam-diam). Penanda
  // balanceApplied di payload_json dipakai saat catatan dihapus untuk
  // membalikkan saldonya — catatan lama (tanpa penanda) tidak ikut dibalik.
  let debtDelta = 0;
  if (params.type === "debt" && params.applyDebtBalance && params.accountId && !NON_ACCOUNT_IDS.has(params.accountId)) {
    const account = await env.DB.prepare("SELECT currency FROM accounts WHERE id = ? AND user_id = ?")
      .bind(params.accountId, userId)
      .first<{ currency: string | null }>();
    if (account && (account.currency || "IDR") === currency) {
      debtDelta = debtBalanceDelta(params.category, params.subCategory, params.amount);
    }
  }

  const insert = env.DB.prepare(
    `INSERT INTO transactions (
      id, user_id, type, amount, amount_idr, category, sub_category, currency,
      account_id, target_account_id, lender_name, total_debt, installment_tenor,
      monthly_interest, total_interest, date, display_date, note, status,
      payment_status, related_id, related_type, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      debtDelta !== 0 ? JSON.stringify({ balanceApplied: true }) : null,
      nowIso(),
      nowIso()
    );

  if (debtDelta !== 0) {
    // Satu batch: catatan + saldo tersimpan bersama atau gagal bersama.
    await env.DB.batch([
      insert,
      env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?").bind(debtDelta, params.accountId, userId),
    ]);
  } else {
    await insert.run();
  }

  const durableId = env.REALTIME_ROOM.idFromName(`member:${userId}`);
  await env.REALTIME_ROOM.get(durableId).fetch("https://realtime.internal/publish", {
    method: "POST",
    body: JSON.stringify({
      event: "transaction.created",
      payload: { id, userId },
    }),
  });

  return { id, balanceApplied: debtDelta !== 0 };
};

// Id rekening dari request (account_id, target_account_id) harus milik user
// sesi. Tanpa cek ini user bisa menautkan transaksi/recurring/investasi ke
// rekening orang lain — saldo korban tetap aman (semua update saldo ber-user_id),
// tapi FK transactions.account_id ON DELETE RESTRICT membuat korban tidak bisa
// menghapus rekeningnya. Nilai khusus ('General', 'Wallet', kosong) dilewati.
const NON_ACCOUNT_IDS = new Set(["", "General", "Wallet"]);
const assertOwnAccounts = async (env: Env, userId: string, ids: unknown[]): Promise<Response | null> => {
  const toCheck = [
    ...new Set(ids.filter((v): v is string => typeof v === "string" && !NON_ACCOUNT_IDS.has(v))),
  ];
  for (const accountId of toCheck) {
    const owned = await env.DB.prepare("SELECT 1 AS ok FROM accounts WHERE id = ? AND user_id = ?")
      .bind(accountId, userId)
      .first<{ ok: number }>();
    if (!owned) {
      return json({ error: "Rekening tidak ditemukan." }, { status: 400 });
    }
  }
  return null;
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
    apply_balance?: boolean;
  }>(request);
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [payload.account_id, payload.target_account_id]);
  if (accountError) return accountError;

  if (!payload.type || !payload.amount || !payload.date) {
    return json({ error: "type, amount, dan date wajib diisi." }, { status: 400 });
  }

  const { id, balanceApplied } = await insertTransactionRecord(env, authResult.session.user.id, {
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
    applyDebtBalance: payload.apply_balance === true,
  });

  return json({ ok: true, id, balance_applied: balanceApplied }, { status: 201 });
}

// Impor mutasi bank/e-wallet dari CSV (parsing & pemetaan kolom dilakukan di
// klien — lihat ImportTransactionsModal). SENGAJA TIDAK menyentuh
// accounts.balance: baris yang diimpor adalah histori yang sudah terjadi dan
// biasanya saldo akunnya sudah benar/di-maintain manual oleh user, jadi ikut
// menambah/mengurangi saldo di sini akan menghitung dobel — beda dengan alur
// input manual/recurring yang memang transaksi baru yang belum pernah
// tercermin di saldo. Dedup terhadap transaksi yang sudah ada (tanggal+
// nominal+catatan sama) supaya re-upload file yang sama tidak menggandakan.
async function handleImportTransactions(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;

  const payload = await parseJson<{
    account_id?: string;
    accountId?: string;
    currency?: string;
    rows?: Array<{ date?: string; note?: string; amount?: number; type?: string; category?: string }>;
  }>(request);

  const accountId = String(pickPayloadValue(payload, "account_id", "accountId") ?? "");
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!accountId || rows.length === 0) {
    return json({ error: "Rekening dan minimal 1 baris data wajib diisi." }, { status: 400 });
  }
  if (rows.length > 1000) {
    return json({ error: "Maksimal 1000 baris per impor — pecah file jadi beberapa bagian." }, { status: 400 });
  }

  const acc = await env.DB.prepare("SELECT currency FROM accounts WHERE id = ? AND user_id = ?")
    .bind(accountId, userId)
    .first<{ currency: string }>();
  if (!acc) {
    return json({ error: "Rekening tidak ditemukan." }, { status: 404 });
  }
  const currency = payload.currency || acc.currency || "IDR";

  const dates = rows.map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean);
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : todayWIB();
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : todayWIB();

  const { results: existingRows } = await env.DB.prepare(
    `SELECT substr(date, 1, 10) as d, amount, note FROM transactions
      WHERE user_id = ? AND account_id = ? AND substr(date, 1, 10) BETWEEN ? AND ?`
  )
    .bind(userId, accountId, minDate, maxDate)
    .all<{ d: string; amount: number; note: string | null }>();

  const existingKeys = new Set(
    (existingRows ?? []).map((r) => `${r.d}|${Number(r.amount)}|${(r.note ?? "").trim()}`)
  );

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const dateStr = String(row.date ?? "").slice(0, 10);
    const amount = Number(row.amount) || 0;
    const note = String(row.note ?? "").trim();
    const type = row.type === "pemasukan" ? "pemasukan" : "pengeluaran";

    if (!dateStr || amount <= 0) {
      skipped++;
      continue;
    }
    const key = `${dateStr}|${amount}|${note}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key); // cegah baris duplikat di dalam file yang sama

    try {
      await insertTransactionRecord(env, userId, {
        type,
        amount,
        category: row.category || "Impor Mutasi",
        currency,
        accountId,
        date: dateStr,
        note: note || undefined,
        relatedType: "import",
      });
      inserted++;
    } catch (error) {
      console.error("Gagal impor satu baris mutasi:", error);
      skipped++;
    }
  }

  return json({ ok: true, inserted, skipped, total: rows.length });
}

// Endpoint ringkas untuk otomasi eksternal (Shortcut iOS, dll): akun & kategori
// cukup dikirim sebagai teks biasa (dicocokkan ke data asli di sini), dan
// tanggal default ke hari ini — supaya Shortcut tidak perlu langkah
// Get Contents of URL/Choose from List/Filter berlapis untuk sekadar
// menentukan account_id.
// POST /api/member/transfer — pindah dana antar rekening sendiri (atau top up
// ke e-wallet luar yang tidak dilacak, to_account_id = "Wallet"). Format baris
// SAMA PERSIS dengan TopUpModal di web ("<Label> Keluar"/"<Label> Masuk",
// note "[<Label> Keluar] ..."/"[<Label> Masuk] ...", tanggal sama) supaya
// findTransferPair di hapus-transaksi tetap bisa memasangkan kedua sisi.
// Bedanya: semua (dua baris + saldo kedua rekening + total) dalam SATU batch
// D1, dan konversi kurs dikerjakan server kalau mata uang rekening berbeda.
// POST /api/member/debts/:id/pay — bayar cicilan / lunasi hutang atau piutang.
// Format baris pembayaran SAMA dengan halaman web Hutang & Piutang (type
// pengeluaran untuk Hutang / pemasukan untuk Piutang, related_type 'debt',
// related_id = id catatan), supaya sisa tagihan di web & aplikasi selalu
// sama. Bedanya: sisa dihitung ulang di server dan semuanya (baris
// pembayaran, saldo, total, status lunas) dalam SATU batch. INSERT-nya
// bersyarat "total bayar tidak melebihi pokok", dan update lain disyaratkan
// baris pembayaran itu benar-benar masuk — dua request bersamaan (double tap)
// tidak bisa membayar melebihi sisa.
async function handlePayDebt(request: Request, env: Env, debtId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<{ amount?: number; account_id?: string; date?: string }>(request);

  const debt = await env.DB.prepare(
    `SELECT id, amount, amount_idr, currency, category, account_id, lender_name, note, payment_status
       FROM transactions WHERE id = ? AND user_id = ? AND type = 'debt'`
  )
    .bind(debtId, userId)
    .first<{ id: string; amount: number; amount_idr: number; currency: string | null; category: string; account_id: string; lender_name: string | null; note: string | null; payment_status: string | null }>();
  if (!debt) return json({ error: "Catatan hutang/piutang tidak ditemukan." }, { status: 404 });
  if (debt.payment_status === "lunas") return json({ error: "Catatan ini sudah lunas." }, { status: 409 });

  const principal = Number(debt.amount) || 0;
  const paidRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM transactions WHERE user_id = ? AND related_id = ? AND related_type = 'debt'`
  )
    .bind(userId, debt.id)
    .first<{ paid: number }>();
  const remaining = Math.max(0, Math.round((principal - (Number(paidRow?.paid) || 0)) * 100) / 100);
  if (remaining <= 0) return json({ error: "Tidak ada sisa yang perlu dibayar." }, { status: 409 });

  const requested = Number(payload.amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return json({ error: "Nominal pembayaran harus lebih dari 0." }, { status: 400 });
  }
  const payNow = Math.min(Math.round(requested * 100) / 100, remaining);
  const settles = remaining - payNow <= 0.005;

  // Rekening pembayaran: rekening catatan kalau valid milik user; kalau catatan
  // lama tidak punya rekening (mis. "General"), wajib dipilih di request.
  const ownAccount = async (id: unknown) =>
    typeof id === "string" && id
      ? await env.DB.prepare("SELECT id FROM accounts WHERE id = ? AND user_id = ?").bind(id, userId).first<{ id: string }>()
      : null;
  const account = (await ownAccount(payload.account_id)) ?? (await ownAccount(debt.account_id));
  if (!account) {
    return json({ error: "Pilih rekening untuk pembayaran ini.", needAccount: true }, { status: 400 });
  }

  const isHutang = debt.category === "Hutang";
  const financeType = isHutang ? "pengeluaran" : "pemasukan";
  const ratio = principal > 0 && Number(debt.amount_idr) > 0 ? Number(debt.amount_idr) / principal : 1;
  const amountIdr = payNow * ratio;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date ?? "")) ? String(payload.date) : todayWIB();
  const label = settles ? "Lunas" : "Cicilan";
  const note = `[${label}] ${debt.category} ${debt.lender_name ? `ke/dari ${debt.lender_name}` : ""} - ${debt.note || ""}`.replace(/\s+/g, " ").trim();
  const now = nowIso();
  const paymentId = generateId();
  const inserted = "EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)";

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, amount_idr, category, sub_category, currency,
         account_id, date, display_date, note, status, related_id, related_type, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, 'debt', ?, ?
        WHERE (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = ? AND related_id = ? AND related_type = 'debt') + ? <= ? + 0.005
          AND NOT EXISTS (SELECT 1 FROM transactions WHERE id = ? AND payment_status = 'lunas')`
    ).bind(
      paymentId, userId, financeType, payNow, amountIdr, debt.category, `${debt.category} ${label}`, debt.currency || "IDR",
      account.id, date, date, note, debt.id, now, now,
      userId, debt.id, payNow, principal, debt.id
    ),
    env.DB.prepare(`UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ? AND ${inserted}`)
      .bind(isHutang ? -payNow : payNow, account.id, userId, paymentId, userId),
    env.DB.prepare(
      isHutang
        ? `UPDATE users SET total_expenses = COALESCE(total_expenses, 0) + ?, total_wealth = COALESCE(total_wealth, 0) - ? WHERE id = ? AND ${inserted}`
        : `UPDATE users SET total_income = COALESCE(total_income, 0) + ?, total_wealth = COALESCE(total_wealth, 0) + ? WHERE id = ? AND ${inserted}`
    ).bind(payNow, payNow, userId, paymentId, userId),
    env.DB.prepare(
      `UPDATE transactions SET payment_status = 'lunas', status = 'VERIFIED', updated_at = ?
        WHERE id = ? AND user_id = ? AND ${inserted}
          AND (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = ? AND related_id = ? AND related_type = 'debt') >= ? - 0.005`
    ).bind(now, debt.id, userId, paymentId, userId, userId, debt.id, principal),
  ]);

  if (!results[0]?.meta.changes) {
    return json({ error: "Tagihan ini baru saja berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  }
  return json({ ok: true, id: paymentId, paid: payNow, remaining: Math.max(0, remaining - payNow), settled: settles }, { status: 201 });
}

async function handleCreateTransfer(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<{
    from_account_id?: string;
    to_account_id?: string;
    amount?: number;
    note?: string;
    date?: string;
    kind?: "transfer" | "topup";
  }>(request);

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Nominal transfer harus lebih dari 0." }, { status: 400 });
  }
  const fromId = String(payload.from_account_id ?? "");
  const toId = String(payload.to_account_id ?? "");
  if (!fromId || !toId) {
    return json({ error: "Rekening asal dan tujuan wajib dipilih." }, { status: 400 });
  }
  if (fromId === toId) {
    return json({ error: "Rekening asal dan tujuan tidak boleh sama." }, { status: 400 });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date ?? "")) ? String(payload.date) : todayWIB();

  type AccRow = { id: string; name: string; currency: string | null; type: string };
  const from = await env.DB.prepare("SELECT id, name, currency, type FROM accounts WHERE id = ? AND user_id = ?")
    .bind(fromId, userId)
    .first<AccRow>();
  if (!from) return json({ error: "Rekening asal tidak ditemukan." }, { status: 400 });
  const isExternal = toId === "Wallet";
  const to = isExternal
    ? null
    : await env.DB.prepare("SELECT id, name, currency, type FROM accounts WHERE id = ? AND user_id = ?")
        .bind(toId, userId)
        .first<AccRow>();
  if (!isExternal && !to) return json({ error: "Rekening tujuan tidak ditemukan." }, { status: 400 });

  const fromCur = from.currency || "IDR";
  const toCur = to?.currency || fromCur;
  const rateOf = async (cur: string) => (cur === "IDR" ? 1 : await fetchIdrConversionRate(cur));
  const fromRate = await rateOf(fromCur);
  const toRate = isExternal ? fromRate : await rateOf(toCur);
  if (!fromRate || !toRate) {
    return json({ error: "Kurs mata uang sedang tidak tersedia. Coba lagi sebentar lagi." }, { status: 503 });
  }
  const amountIdr = amount * fromRate;
  const amountTo = fromCur === toCur ? amount : Math.round(((amount * fromRate) / toRate) * 100) / 100;

  const label = payload.kind === "topup" || isExternal || to?.type === "E-Wallet" ? "Top Up" : "Transfer";
  const baseNote = String(payload.note ?? "").trim() || `${label} ke ${isExternal ? "Digital Wallet" : to!.name}`;
  const now = nowIso();
  const outId = generateId();
  const inId = generateId();
  const insertSql = `INSERT INTO transactions (
      id, user_id, type, amount, amount_idr, category, sub_category, currency,
      account_id, target_account_id, date, display_date, note, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?)`;

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(insertSql).bind(
      outId, userId, isExternal ? "pengeluaran" : "transfer", amount, amountIdr, label, `${label} Keluar`, fromCur,
      from.id, toId, date, date, `[${label} Keluar] ${baseNote}`, now, now
    ),
    env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?").bind(amount, from.id, userId),
  ];
  if (to) {
    statements.push(
      env.DB.prepare(insertSql).bind(
        inId, userId, "transfer", amountTo, amountIdr, label, `${label} Masuk`, toCur,
        to.id, null, date, date, `[${label} Masuk] ${baseNote}`, now, now
      ),
      env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?").bind(amountTo, to.id, userId)
    );
  } else {
    // Top up ke e-wallet luar = uang benar-benar keluar dari rekening yang
    // dilacak — dihitung pengeluaran (sama seperti TopUpModal).
    statements.push(
      env.DB.prepare(
        `UPDATE users SET total_expenses = COALESCE(total_expenses, 0) + ?, total_wealth = COALESCE(total_wealth, 0) - ? WHERE id = ?`
      ).bind(amountIdr, amountIdr, userId)
    );
  }
  await env.DB.batch(statements);

  return json({ ok: true, ids: to ? [outId, inId] : [outId], amountTo, label }, { status: 201 });
}

async function handleQuickTransaction(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }
  const userId = authResult.session.user.id;

  const payload = await parseJson<{
    type?: string;
    amount?: number;
    category?: string;
    sub_category?: string;
    account?: string;
    account_id?: string;
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
  const accountIdParam = typeof payload.account_id === "string" ? payload.account_id.trim() : "";
  const accountName = typeof payload.account === "string" ? payload.account.trim() : "";
  if (!accountIdParam && !accountName) {
    return json({ error: "account wajib diisi." }, { status: 400 });
  }
  // Tanggal opsional (mis. "kemarin" dari Input Cepat) — hanya YYYY-MM-DD dan
  // tidak boleh di masa depan (WIB).
  const today = todayWIB();
  const rawDate = typeof payload.date === "string" ? payload.date.trim().slice(0, 10) : "";
  if (rawDate && (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || rawDate > today)) {
    return json({ error: "Tanggal harus format YYYY-MM-DD dan tidak boleh di masa depan." }, { status: 400 });
  }
  const date = rawDate || today;

  const accounts = await env.DB.prepare("SELECT id, name, currency FROM accounts WHERE user_id = ?")
    .bind(userId)
    .all<{ id: string; name: string; currency: string }>();

  // account_id (Input Cepat) lebih dulu — pasti tepat. Nama (Shortcut iOS):
  // cocok persis dulu, baru "mengandung" — dan kalau "mengandung" cocok ke
  // lebih dari satu rekening (mis. "BCA" → BCA Blue & BCA Platinum), tolak
  // daripada menebak rekening yang salah.
  let match: { id: string; name: string; currency: string } | undefined;
  if (accountIdParam) {
    match = accounts.results?.find((a) => a.id === accountIdParam);
  } else {
    const needle = accountName.toLowerCase();
    match = accounts.results?.find((a) => a.name.toLowerCase() === needle);
    if (!match) {
      const partial = (accounts.results ?? []).filter((a) => a.name.toLowerCase().includes(needle));
      if (partial.length > 1) {
        return json(
          { error: `Nama akun "${accountName}" cocok ke beberapa rekening: ${partial.map((a) => a.name).join(", ")}. Tulis lebih lengkap.` },
          { status: 409 }
        );
      }
      match = partial[0];
    }
  }

  if (!match) {
    const available = (accounts.results ?? []).map((a) => a.name).join(", ") || "(belum ada rekening)";
    return json({ error: `Akun "${accountName || accountIdParam}" tidak ditemukan. Akun tersedia: ${available}` }, { status: 404 });
  }

  const currency = match.currency || "IDR";
  const amountIdr = await resolveIdrAmount(currency, amount, undefined);
  const id = generateId();
  const now = nowIso();

  // Catat transaksi + ubah saldo dalam satu batch atomik (dulu dua langkah:
  // kalau update saldo gagal, transaksi tercatat tapi saldo tertinggal).
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO transactions (
         id, user_id, type, amount, amount_idr, category, sub_category, currency,
         account_id, date, display_date, note, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?)`
    ).bind(
      id, userId, type, amount, amountIdr, payload.category?.trim() || null, payload.sub_category?.trim() || null,
      currency, match.id, date, date, payload.note?.trim() || null, now, now
    ),
    env.DB.prepare(
      `UPDATE accounts SET balance = balance + ?
        WHERE id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)`
    ).bind(type === "pemasukan" ? amount : -amount, match.id, userId, id, userId),
    // Total member ikut dicatat — simetris dengan pembalikan saat transaksi
    // dihapus (DELETE ?reverse=1), jadi simpan lalu "Batalkan" bersih nol.
    env.DB.prepare(
      type === "pemasukan"
        ? `UPDATE users SET total_income = COALESCE(total_income, 0) + ?, total_wealth = COALESCE(total_wealth, 0) + ?
            WHERE id = ? AND EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)`
        : `UPDATE users SET total_expenses = COALESCE(total_expenses, 0) + ?, total_wealth = COALESCE(total_wealth, 0) - ?
            WHERE id = ? AND EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)`
    ).bind(amount, amount, userId, id, userId),
  ]);

  try {
    const durableId = env.REALTIME_ROOM.idFromName(`member:${userId}`);
    await env.REALTIME_ROOM.get(durableId).fetch("https://realtime.internal/publish", {
      method: "POST",
      body: JSON.stringify({ event: "transaction.created", payload: { id, userId } }),
    });
  } catch (error) {
    console.error("Realtime publish quick-transaction gagal (transaksi tetap tercatat):", error);
  }

  return json({ ok: true, id, matchedAccount: match.name, currency }, { status: 201 });
}

async function handleUpdateTransaction(request: Request, env: Env, transactionId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [payload.account_id, payload.target_account_id]);
  if (accountError) return accountError;
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

  // Hutang/piutang yang saat dicatat sudah mengubah saldo: nominal/rekening/
  // jenisnya tidak boleh diubah diam-diam (saldo tidak ikut menyesuaikan).
  // Status lunas, catatan, dll. tetap boleh.
  const moneyFields = ["type", "amount", "amount_idr", "currency", "account_id", "category", "sub_category"];
  if (entries.some(([key]) => moneyFields.includes(key))) {
    const current = await env.DB.prepare("SELECT type, payload_json FROM transactions WHERE id = ? AND user_id = ?")
      .bind(transactionId, authResult.session.user.id)
      .first<{ type: string | null; payload_json: string | null }>();
    if (current?.type === "debt" && /"balanceApplied"\s*:\s*true/.test(current.payload_json ?? "")) {
      return json(
        { error: "Nominal/rekening catatan ini sudah memengaruhi saldo. Hapus catatannya lalu catat ulang supaya saldo tetap benar." },
        { status: 409 }
      );
    }
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

type DeletableTransactionRow = {
  id: string;
  type: string | null;
  amount: number | null;
  category: string | null;
  sub_category: string | null;
  payload_json: string | null;
  account_id: string | null;
  target_account_id: string | null;
  date: string | null;
  note: string | null;
  created_at: string | null;
};

// Transfer antar rekening sendiri (TopUpModal) tersimpan sebagai DUA baris
// tanpa kolom penghubung: sisi "<Label> Keluar" (account_id = sumber,
// target_account_id = tujuan) dan sisi "<Label> Masuk" (account_id = tujuan),
// dengan note "[<Label> Keluar] X" / "[<Label> Masuk] X" dan tanggal yang sama.
// Pasangan dicari dengan SEMUA kriteria itu sekaligus — kalau tidak ketemu
// persis, dianggap tidak berpasangan (lebih aman daripada salah hapus).
async function findTransferPair(env: Env, userId: string, row: DeletableTransactionRow) {
  const match = /^(.+) (Keluar|Masuk)$/.exec(row.sub_category ?? "");
  if (!match || !row.note || !row.date || !row.account_id) return null;
  const [, label, side] = match;
  const otherSide = side === "Keluar" ? "Masuk" : "Keluar";
  const expectedNote = row.note.replace(`[${label} ${side}]`, `[${label} ${otherSide}]`);
  if (expectedNote === row.note) return null;

  if (side === "Keluar") {
    if (!row.target_account_id || row.target_account_id === "Wallet") return null;
    return env.DB.prepare(
      `SELECT id, type, amount, category, sub_category, payload_json, account_id, target_account_id, date, note, created_at
         FROM transactions
        WHERE user_id = ? AND id != ? AND sub_category = ? AND account_id = ? AND date = ? AND note = ?
        ORDER BY ABS(julianday(created_at) - julianday(?)) ASC
        LIMIT 1`
    )
      .bind(userId, row.id, `${label} Masuk`, row.target_account_id, row.date, expectedNote, row.created_at)
      .first<DeletableTransactionRow>();
  }

  return env.DB.prepare(
    `SELECT id, type, amount, category, sub_category, payload_json, account_id, target_account_id, date, note, created_at
       FROM transactions
      WHERE user_id = ? AND id != ? AND sub_category = ? AND target_account_id = ? AND date = ? AND note = ?
      ORDER BY ABS(julianday(created_at) - julianday(?)) ASC
      LIMIT 1`
  )
    .bind(userId, row.id, `${label} Keluar`, row.account_id, row.date, expectedNote, row.created_at)
    .first<DeletableTransactionRow>();
}

// Statement untuk membalikkan efek satu baris transaksi ke saldo rekening &
// total member — kebalikan persis dari yang dilakukan saat baris dibuat
// (AddTransactionModal / TopUpModal / updateMemberTotals). Tiap UPDATE
// disyaratkan baris transaksinya MASIH ADA, dan dijalankan sebelum DELETE
// dalam satu batch: kalau request hapus terkirim dua kali, batch kedua
// otomatis no-op, saldo tidak terbalik dua kali.
function buildReversalStatements(env: Env, userId: string, row: DeletableTransactionRow) {
  const amount = Number(row.amount) || 0;
  const statements: D1PreparedStatement[] = [];
  const stillExists = "EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)";
  const isTransferSide = row.type === "transfer" || row.type === "topup";
  const side = /(Keluar|Masuk)$/.exec(row.sub_category ?? "")?.[1];

  let balanceDelta = 0;
  if (row.type === "pemasukan") balanceDelta = -amount;
  else if (row.type === "pengeluaran") balanceDelta = amount;
  else if (isTransferSide && side === "Keluar") balanceDelta = amount;
  else if (isTransferSide && side === "Masuk") balanceDelta = -amount;
  else if (row.type === "debt") {
    // Hanya catatan hutang/piutang yang saat dibuat memang mengubah saldo.
    let applied = false;
    try {
      applied = Boolean((JSON.parse(row.payload_json || "{}") as { balanceApplied?: boolean }).balanceApplied);
    } catch {
      applied = false;
    }
    if (applied) balanceDelta = -debtBalanceDelta(row.category, row.sub_category, amount);
  }

  const accountId = row.account_id;
  if (balanceDelta !== 0 && accountId && accountId !== "General" && accountId !== "Wallet") {
    statements.push(
      env.DB.prepare(
        `UPDATE accounts SET balance = balance + ?
          WHERE id = ? AND user_id = ? AND ${stillExists}`
      ).bind(balanceDelta, accountId, userId, row.id, userId)
    );
  }

  if (row.type === "pemasukan") {
    statements.push(
      env.DB.prepare(
        `UPDATE users
            SET total_income = COALESCE(total_income, 0) - ?,
                total_wealth = COALESCE(total_wealth, 0) - ?
          WHERE id = ? AND ${stillExists}`
      ).bind(amount, amount, userId, row.id, userId)
    );
  } else if (row.type === "pengeluaran") {
    statements.push(
      env.DB.prepare(
        `UPDATE users
            SET total_expenses = COALESCE(total_expenses, 0) - ?,
                total_wealth = COALESCE(total_wealth, 0) + ?
          WHERE id = ? AND ${stillExists}`
      ).bind(amount, amount, userId, row.id, userId)
    );
  }

  return statements;
}

async function handleDeleteTransaction(request: Request, env: Env, transactionId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }
  const userId = authResult.session.user.id;

  // Client lama membalikkan saldo sendiri SEBELUM memanggil endpoint ini, jadi
  // pembalikan di server hanya jalan kalau client secara eksplisit memintanya
  // (?reverse=1). Tanpa flag ini perilakunya sama persis seperti dulu — cegah
  // saldo terbalik dua kali dari tab/PWA/app yang masih pakai bundle lama.
  const serverSideReversal = new URL(request.url).searchParams.get("reverse") === "1";

  if (!serverSideReversal) {
    const result = await env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
      .bind(transactionId, userId)
      .run();

    if (!result.meta.changes) {
      return json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    return json({ ok: true, deletedIds: [transactionId] });
  }

  const row = await env.DB.prepare(
    `SELECT id, type, amount, category, sub_category, payload_json, account_id, target_account_id, date, note, created_at
       FROM transactions
      WHERE id = ? AND user_id = ?`
  )
    .bind(transactionId, userId)
    .first<DeletableTransactionRow>();

  if (!row) {
    return json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  const rows = [row];
  const pair = await findTransferPair(env, userId, row);
  if (pair) rows.push(pair);

  const statements: D1PreparedStatement[] = [];
  for (const item of rows) {
    statements.push(...buildReversalStatements(env, userId, item));
    statements.push(
      env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").bind(item.id, userId)
    );
  }

  // D1 batch = satu transaksi SQL: semua pembalikan saldo + penghapusan
  // berhasil bersama atau gagal bersama.
  await env.DB.batch(statements);

  return json({ ok: true, deletedIds: rows.map((item) => item.id) });
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

// Pengaturan siklus tagihan kartu kredit (Tahap 3) — dititipkan di
// payload_json seperti cardColor/creditLimit. Nilai null = hapus pengaturan.
// Tanggal dibatasi 1–28 supaya selalu ada di setiap bulan (termasuk Februari).
const CARD_CYCLE_FIELDS: Array<[string, string, (v: number) => number | null]> = [
  ["statement_day", "statementDay", (v) => (Number.isFinite(v) ? Math.min(28, Math.max(1, Math.round(v))) : null)],
  ["due_day", "dueDay", (v) => (Number.isFinite(v) ? Math.min(28, Math.max(1, Math.round(v))) : null)],
  ["min_payment_percent", "minPaymentPercent", (v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null)],
  ["min_payment_amount", "minPaymentAmount", (v) => (Number.isFinite(v) ? Math.max(0, v) : null)],
];

const hasCardCycleFields = (payload: Record<string, unknown>) =>
  CARD_CYCLE_FIELDS.some(([key]) => payload[key] !== undefined);

const applyCardCycleFields = (payload: Record<string, unknown>, target: Record<string, unknown>) => {
  for (const [key, prop, normalize] of CARD_CYCLE_FIELDS) {
    if (payload[key] === undefined) continue;
    const value = payload[key] === null || payload[key] === "" ? null : normalize(Number(payload[key]));
    if (value === null) delete target[prop];
    else target[prop] = value;
  }
};

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
  applyCardCycleFields(payload, extra);
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

  if (payload.card_color !== undefined || payload.credit_limit !== undefined || hasCardCycleFields(payload)) {
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
    applyCardCycleFields(payload, payloadObj);
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

  const userId = authResult.session.user.id;

  // transactions.account_id punya FOREIGN KEY ... ON DELETE RESTRICT di
  // skema produksi — rekening yang masih punya transaksi tidak bisa dihapus
  // (sebelumnya jadi error 500 generik). Cek dulu supaya user dapat alasan
  // yang jelas, bukan "Terjadi kesalahan pada server".
  const usage = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM transactions WHERE account_id = ? AND user_id = ?"
  )
    .bind(accountId, userId)
    .first<{ total: number }>();
  const transactionCount = Number(usage?.total ?? 0);
  const inUseResponse = (count?: number) =>
    json(
      {
        error: `Rekening ini masih dipakai oleh ${count ? `${count} ` : ""}transaksi, jadi belum bisa dihapus. Hapus transaksinya dulu di Riwayat Transaksi.`,
        transactionCount: count ?? null,
      },
      { status: 409 }
    );

  if (transactionCount > 0) {
    return inUseResponse(transactionCount);
  }

  try {
    const result = await env.DB.prepare("DELETE FROM accounts WHERE id = ? AND user_id = ?")
      .bind(accountId, userId)
      .run();

    if (!result.meta.changes) {
      return json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }
  } catch (error) {
    // Transaksi baru masuk di antara COUNT dan DELETE di atas.
    if (String(error).includes("FOREIGN KEY constraint failed")) {
      return inUseResponse();
    }
    throw error;
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
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Nominal budget harus lebih dari 0." }, { status: 400 });
  if (!["pengeluaran", "pemasukan"].includes(payload.type ?? "pengeluaran")) {
    return json({ error: "Jenis budget harus pengeluaran atau pemasukan." }, { status: 400 });
  }
  if (!["monthly", "yearly"].includes(payload.period ?? "monthly")) {
    return json({ error: "Periode budget harus bulanan atau tahunan." }, { status: 400 });
  }
  const id = generateId();
  await env.DB.prepare(
    "INSERT INTO budgets (id, user_id, type, category, amount, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      authResult.session.user.id,
      payload.type ?? "pengeluaran",
      String(payload.category ?? "").trim() || "Umum",
      amount,
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
  if (payload.amount !== undefined && !(Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0)) {
    return json({ error: "Nominal budget harus lebih dari 0." }, { status: 400 });
  }
  if (payload.type !== undefined && !["pengeluaran", "pemasukan"].includes(String(payload.type))) {
    return json({ error: "Jenis budget harus pengeluaran atau pemasukan." }, { status: 400 });
  }
  if (payload.period !== undefined && !["monthly", "yearly"].includes(String(payload.period))) {
    return json({ error: "Periode budget harus bulanan atau tahunan." }, { status: 400 });
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
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [payload.account_id]);
  if (accountError) return accountError;
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
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [payload.account_id]);
  if (accountError) return accountError;
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

// ---- Buku besar investasi ---------------------------------------------------
// SATU tabel efek per jenis baris investasi, dipakai persis sama saat baris
// dibuat (sign +1) dan saat dihapus/di-rebook (sign −1) — jadi buat lalu hapus
// selalu kembali ke nol. Efek: saldo rekening, total member, dan satu baris
// transaksi tertaut (related_type 'investasi') untuk riwayat/statistik.
//   Beli/Pembelian/Penempatan : uang keluar sebesar modal (amount_invested)
//   Jual/Penjualan/Penarikan  : uang masuk sebesar hasil (current_value),
//                               total investasi berkurang sebesar modal
//   Bunga                     : uang masuk sebesar bunga (current − modal)
const INVESTMENT_OUTFLOW_TYPES = new Set(["Penempatan", "Beli", "Pembelian"]);
const INVESTMENT_SALE_TYPES = new Set(["Jual", "Penjualan", "Penarikan"]);
const INVESTMENT_EFFECT_TYPES = new Set([...INVESTMENT_OUTFLOW_TYPES, ...INVESTMENT_SALE_TYPES, "Bunga"]);

type InvestmentLedgerRow = {
  id: string;
  name: string | null;
  type: string | null;
  transaction_type: string | null;
  amount_invested: number;
  amount_idr: number | null;
  current_value: number;
  current_value_idr: number | null;
  currency: string | null;
  account_id: string | null;
};

type InvestmentEffect = {
  balance: number;
  income: number;
  expenses: number;
  investment: number;
  tx: { type: "pemasukan" | "pengeluaran"; amount: number; amountIdr: number } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const investmentEffect = (row: InvestmentLedgerRow): InvestmentEffect => {
  const invested = round2(Number(row.amount_invested) || 0);
  const current = round2(Number(row.current_value) || 0);
  const type = row.transaction_type ?? "";
  const investedIdr = Number(row.amount_idr) || invested;
  const currentIdr = Number(row.current_value_idr) || current;
  if (INVESTMENT_OUTFLOW_TYPES.has(type)) {
    return { balance: -invested, income: 0, expenses: invested, investment: invested, tx: { type: "pengeluaran", amount: invested, amountIdr: investedIdr } };
  }
  if (INVESTMENT_SALE_TYPES.has(type)) {
    return { balance: current, income: current, expenses: 0, investment: -invested, tx: { type: "pemasukan", amount: current, amountIdr: currentIdr } };
  }
  if (type === "Bunga") {
    const interest = round2(Math.max(0, current - invested));
    const ratio = current > 0 ? currentIdr / current : 1;
    return { balance: interest, income: interest, expenses: 0, investment: 0, tx: { type: "pemasukan", amount: interest, amountIdr: interest * ratio } };
  }
  return { balance: 0, income: 0, expenses: 0, investment: 0, tx: null };
};

const investmentTxLabel = (row: InvestmentLedgerRow) => {
  const t = row.transaction_type ?? "";
  if (row.type === "Deposito") return `Deposito - ${t}`;
  if (row.type === "Saham") return `${t === "Jual" ? "Jual" : "Beli"} Saham ${row.name ?? ""}`.trim();
  return `${t} ${row.name ?? ""}`.trim();
};

/**
 * Statement saldo + total untuk efek baris (sign +1 = terapkan, −1 = balikkan),
 * dan (kalau sign +1) baris transaksi tertaut. Semua dijaga `guard` (klausa SQL
 * + bind) supaya hanya jalan kalau statement klaim di batch yang sama berhasil.
 */
const investmentEffectStatements = (
  env: Env,
  userId: string,
  row: InvestmentLedgerRow,
  sign: 1 | -1,
  guard: { sql: string; binds: unknown[] },
  tx?: { date: string; note: string; label?: string }
) => {
  const effect = investmentEffect(row);
  const statements: D1PreparedStatement[] = [];
  const hasAccount = Boolean(row.account_id) && !NON_ACCOUNT_IDS.has(row.account_id ?? "");
  if (hasAccount && effect.balance !== 0) {
    statements.push(
      env.DB.prepare(`UPDATE accounts SET balance = ROUND(balance + ?, 2) WHERE id = ? AND user_id = ? AND ${guard.sql}`)
        .bind(sign * effect.balance, row.account_id, userId, ...guard.binds)
    );
  }
  if (effect.income || effect.expenses || effect.investment) {
    statements.push(
      env.DB.prepare(
        `UPDATE users SET total_income = ROUND(COALESCE(total_income, 0) + ?, 2), total_expenses = ROUND(COALESCE(total_expenses, 0) + ?, 2),
                          total_wealth = ROUND(COALESCE(total_wealth, 0) + ?, 2), total_investment = ROUND(COALESCE(total_investment, 0) + ?, 2)
          WHERE id = ? AND ${guard.sql}`
      ).bind(
        sign * effect.income, sign * effect.expenses, sign * (effect.income - effect.expenses), sign * effect.investment,
        userId, ...guard.binds
      )
    );
  }
  if (sign === 1 && tx && effect.tx && hasAccount && effect.tx.amount > 0) {
    const now = nowIso();
    statements.push(
      env.DB.prepare(
        `INSERT INTO transactions (id, user_id, type, amount, amount_idr, category, sub_category, currency, account_id,
                                   date, display_date, note, status, related_id, related_type, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, 'Investasi', ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, 'investasi', ?, ? WHERE ${guard.sql}`
      ).bind(
        generateId(), userId, effect.tx.type, round2(effect.tx.amount), effect.tx.amountIdr, tx.label ?? investmentTxLabel(row),
        row.currency || "IDR", row.account_id, tx.date, tx.date, tx.note, row.id, now, now, ...guard.binds
      )
    );
  }
  return statements;
};

/** Hapus transaksi tertaut baris ini (tanpa efek saldo — efeknya dibalik lewat buku besar). */
const deleteLinkedInvestmentTxStatement = (env: Env, userId: string, row: InvestmentLedgerRow, guard: { sql: string; binds: unknown[] }) => {
  const effect = investmentEffect(row);
  // Hanya transaksi yang jenisnya sesuai efek baris ini — catatan lama
  // "Cairkan" ditautkan ke baris Penempatan tapi berjenis pemasukan, jangan ikut.
  return env.DB.prepare(
    `DELETE FROM transactions WHERE user_id = ? AND related_type = 'investasi' AND related_id = ? AND type = ? AND ${guard.sql}`
  ).bind(userId, row.id, effect.tx?.type ?? "-", ...guard.binds);
};

const INVESTMENT_LEDGER_COLUMNS =
  "id, name, type, transaction_type, amount_invested, amount_idr, current_value, current_value_idr, currency, account_id";

const loadInvestmentRow = (env: Env, userId: string, id: string) =>
  env.DB.prepare(`SELECT ${INVESTMENT_LEDGER_COLUMNS}, status, shares_count, quantity, price_per_share, price_per_unit,
                         return_percentage, tax_percentage, date_invested, target_date, duration_days, platform,
                         category, stock_code, exchange_code, logo_url, unit, updated_at, related_investment_id
                    FROM investments WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<InvestmentLedgerRow & {
      status: string | null; shares_count: number | null; quantity: number | null; price_per_share: number | null;
      price_per_unit: number | null; return_percentage: number | null; tax_percentage: number | null;
      date_invested: string | null; target_date: string | null; duration_days: number | null; platform: string | null;
      category: string | null; stock_code: string | null; exchange_code: string | null; logo_url: string | null;
      unit: string | null; updated_at: string | null; related_investment_id: string | null;
    }>();

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const dayOf = (value: unknown, fallback: string) => {
  const s = typeof value === "string" ? value.trim() : "";
  return ISO_DAY.test(s) ? s.slice(0, 10) : fallback;
};

/**
 * Baca & validasi isian posisi baru (dipakai entry & rebook). Nilai uang
 * dihitung server: Saham = lembar × harga, Lainnya = jumlah × harga/unit,
 * Deposito = pokok (+ bunga bersih untuk current_value).
 */
const buildInvestmentPosition = async (payload: Record<string, unknown>) => {
  const type = String(payload.type ?? "");
  const txType = String(payload.transaction_type ?? "");
  const allowed: Record<string, string[]> = {
    Saham: ["Beli"],
    Lainnya: ["Pembelian"],
    Deposito: ["Penempatan", "Bunga", "Penarikan"],
  };
  if (!allowed[type]?.includes(txType)) return { error: "Jenis investasi/transaksi tidak didukung." } as const;
  const currency = String(payload.currency ?? "IDR").toUpperCase() || "IDR";
  const name = String(payload.name ?? payload.stock_code ?? "").trim();
  if (!name) return { error: "Nama investasi wajib diisi." } as const;
  const today = todayWIB();
  const dateInvested = dayOf(payload.date_invested, today);
  if (dateInvested > today) return { error: "Tanggal tidak boleh di masa depan." } as const;

  let invested = 0;
  let current = 0;
  const extra: Record<string, unknown> = {};
  if (type === "Saham") {
    const shares = Number(payload.shares_count);
    const price = Number(payload.price_per_share);
    if (!(shares > 0) || !(price > 0)) return { error: "Jumlah lembar dan harga per lembar harus lebih dari 0." } as const;
    invested = round2(shares * price);
    const cur = Number(payload.current_value);
    current = cur > 0 ? cur : invested;
    Object.assign(extra, {
      shares_count: shares, price_per_share: price,
      stock_code: String(payload.stock_code ?? name).trim().toUpperCase(),
      exchange_code: String(payload.exchange_code ?? "IDX").trim().toUpperCase() || "IDX",
    });
  } else if (type === "Lainnya") {
    const qty = Number(payload.quantity);
    const price = Number(payload.price_per_unit);
    if (!(qty > 0) || !(price > 0)) return { error: "Jumlah dan harga per unit harus lebih dari 0." } as const;
    invested = round2(qty * price);
    const cur = Number(payload.current_value);
    current = cur > 0 ? cur : invested;
    Object.assign(extra, { quantity: qty, price_per_unit: price, unit: payload.unit ? String(payload.unit) : null });
  } else {
    invested = Number(payload.amount_invested);
    if (!(invested > 0)) return { error: "Nominal deposito harus lebih dari 0." } as const;
    const rate = Math.max(0, Number(payload.return_percentage) || 0);
    const tax = Math.min(100, Math.max(0, Number(payload.tax_percentage) || 0));
    const targetDate = dayOf(payload.target_date, "");
    if (!targetDate || targetDate <= dateInvested) return { error: "Tanggal jatuh tempo harus setelah tanggal penempatan." } as const;
    const days = daysBetweenIso(`${dateInvested}T00:00:00Z`, `${targetDate}T00:00:00Z`);
    current = round2(computeDepositResult(invested, rate, tax, days).totalResult);
    const action = String(payload.maturity_action ?? "cairkan");
    Object.assign(extra, {
      return_percentage: rate, tax_percentage: tax, target_date: `${targetDate}T00:00:00.000Z`, duration_days: days,
      maturity_action: txType === "Penempatan" ? (["cairkan", "aro_bunga", "aro_full"].includes(action) ? action : "cairkan") : null,
    });
  }
  const ratio = currency === "IDR" ? 1 : (await resolveIdrAmount(currency, 1, undefined)) || 1;
  return {
    position: {
      name: type === "Saham" ? String(extra.stock_code) : name,
      type, transaction_type: txType, currency,
      platform: payload.platform ? String(payload.platform).trim() : null,
      category: payload.category ? String(payload.category) : type,
      logo_url: payload.logo_url ? String(payload.logo_url) : null,
      amount_invested: invested, amount_idr: invested * ratio,
      current_value: current, current_value_idr: current * ratio,
      return_percentage: invested > 0 && type !== "Deposito" ? ((current - invested) / invested) * 100 : Number(extra.return_percentage ?? 0),
      date_invested: `${dateInvested}T00:00:00.000Z`,
      status: txType === "Penarikan" ? "Closed" : "Active",
      ...extra,
    } as Record<string, unknown>,
    date: dateInvested,
  } as const;
};

const POSITION_COLUMNS = [
  "name", "type", "transaction_type", "currency", "platform", "category", "logo_url", "amount_invested", "amount_idr",
  "current_value", "current_value_idr", "return_percentage", "tax_percentage", "date_invested", "target_date",
  "duration_days", "status", "maturity_action", "shares_count", "price_per_share", "stock_code", "exchange_code",
  "quantity", "price_per_unit", "unit",
] as const;
// Kolom NOT NULL di tabel investments yang bisa kosong untuk jenis tertentu
// (mis. saham tidak punya pajak) — isi default, bukan null.
const POSITION_DEFAULTS: Record<string, unknown> = { platform: "", tax_percentage: 0, return_percentage: 0, currency: "IDR" };
const positionValue = (pos: Record<string, unknown>, column: string) => pos[column] ?? POSITION_DEFAULTS[column] ?? null;

const requireOwnedAccount = async (env: Env, userId: string, accountId: unknown) => {
  if (typeof accountId !== "string" || NON_ACCOUNT_IDS.has(accountId)) return null;
  return env.DB.prepare("SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?")
    .bind(accountId, userId)
    .first<{ id: string; currency: string | null }>();
};

// POST /api/member/investments/entry — catat posisi baru + efek uangnya atomik.
async function handleInvestmentEntry(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<Record<string, unknown>>(request);

  const built = await buildInvestmentPosition(payload);
  if ("error" in built) return json({ error: built.error }, { status: 400 });
  const account = await requireOwnedAccount(env, userId, payload.account_id);
  if (!account) return json({ error: "Pilih rekening sumber dana." }, { status: 400 });

  // id boleh dikirim client (UUID per percobaan simpan) — submit ganda karena
  // jaringan lambat ditolak oleh PRIMARY KEY, bukan tercatat dua kali.
  const clientId = typeof payload.id === "string" && /^[0-9a-f-]{16,64}$/i.test(payload.id) ? payload.id : null;
  const id = clientId ?? generateId();
  const pos = built.position;
  const cols = ["id", "user_id", "account_id", ...POSITION_COLUMNS, "created_at", "updated_at"];
  const now = nowIso();
  const values = [id, userId, account.id, ...POSITION_COLUMNS.map((c) => positionValue(pos, c)), now, now];
  const row: InvestmentLedgerRow = {
    id, name: String(pos.name), type: String(pos.type), transaction_type: String(pos.transaction_type),
    amount_invested: Number(pos.amount_invested), amount_idr: Number(pos.amount_idr),
    current_value: Number(pos.current_value), current_value_idr: Number(pos.current_value_idr),
    currency: String(pos.currency), account_id: account.id,
  };
  const guard = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND user_id = ? AND created_at = ?)", binds: [id, userId, now] };
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO investments (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...values),
      ...investmentEffectStatements(env, userId, row, 1, guard, { date: built.date, note: `[Baru] ${investmentTxLabel(row)}` }),
    ]);
  } catch (error) {
    // Dianggap kiriman ganda HANYA kalau baris dengan id ini memang sudah ada
    // milik user ini — error lain (mis. kolom wajib kosong) tetap dilempar.
    if (clientId) {
      const existing = await env.DB.prepare("SELECT 1 AS ok FROM investments WHERE id = ? AND user_id = ?")
        .bind(clientId, userId)
        .first<{ ok: number }>();
      if (existing) return json({ ok: true, id, duplicate: true });
    }
    throw error;
  }
  return json({ ok: true, id }, { status: 201 });
}

// POST /api/member/investments/:id/sell — jual sebagian/seluruh posisi Saham/Lainnya.
async function handleInvestmentSell(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<Record<string, unknown>>(request);

  const orig = await loadInvestmentRow(env, userId, investmentId);
  if (!orig) return json({ error: "Posisi tidak ditemukan." }, { status: 404 });
  const isStock = orig.type === "Saham";
  if (!(isStock || orig.type === "Lainnya") || orig.status !== "Active" || !INVESTMENT_OUTFLOW_TYPES.has(orig.transaction_type ?? "")) {
    return json({ error: "Posisi ini tidak bisa dijual." }, { status: 409 });
  }
  const held = Number(isStock ? orig.shares_count : orig.quantity) || 0;
  const qty = Number(payload.quantity);
  const price = Number(payload.price);
  if (!(qty > 0) || !(price > 0)) return json({ error: "Jumlah dan harga jual harus lebih dari 0." }, { status: 400 });
  if (qty > held + 1e-9) return json({ error: `Jumlah melebihi yang dimiliki (${held}).` }, { status: 400 });
  const account = (await requireOwnedAccount(env, userId, payload.account_id)) ?? (await requireOwnedAccount(env, userId, orig.account_id));
  if (!account) return json({ error: "Pilih rekening tujuan dana." }, { status: 400 });
  const date = dayOf(payload.date, todayWIB());
  if (date > todayWIB()) return json({ error: "Tanggal tidak boleh di masa depan." }, { status: 400 });

  const invested = Number(orig.amount_invested) || 0;
  const costSold = round2(held > 0 ? (invested * qty) / held : 0);
  const proceeds = round2(qty * price);
  const remaining = round2(held - qty);
  const keep = held > 0 ? remaining / held : 0;
  const idrRatio = invested > 0 && Number(orig.amount_idr) > 0 ? Number(orig.amount_idr) / invested : 1;
  const saleId = generateId();
  const now = nowIso();
  const saleType = isStock ? "Jual" : "Penjualan";
  const sale: InvestmentLedgerRow = {
    id: saleId, name: orig.name, type: orig.type, transaction_type: saleType,
    amount_invested: costSold, amount_idr: costSold * idrRatio, current_value: proceeds, current_value_idr: proceeds * idrRatio,
    currency: orig.currency, account_id: account.id,
  };
  const qtyCol = isStock ? "shares_count" : "quantity";
  const guard = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND user_id = ?)", binds: [saleId, userId] };
  const results = await env.DB.batch([
    // Klaim: baris jual hanya dibuat kalau jumlah milik posisi asal belum berubah
    // sejak dibaca (jual ganda/bersamaan → hanya satu yang lolos).
    env.DB.prepare(
      `INSERT INTO investments (id, user_id, name, type, platform, category, logo_url, amount_invested, amount_idr,
                                current_value, current_value_idr, return_percentage, currency, transaction_type, account_id,
                                ${qtyCol}, ${isStock ? "price_per_share, stock_code, exchange_code" : "price_per_unit, unit"},
                                date_invested, status, related_investment_id, created_at, updated_at)
       SELECT ?, ?, name, type, platform, category, logo_url, ?, ?, ?, ?, ?, currency, ?, ?, ?, ?,
              ${isStock ? "stock_code, exchange_code" : "unit"}, ?, 'Closed', id, ?, ?
         FROM investments WHERE id = ? AND user_id = ? AND status = 'Active' AND ${qtyCol} = ?`
    ).bind(
      saleId, userId, sale.amount_invested, sale.amount_idr, proceeds, sale.current_value_idr,
      costSold > 0 ? ((proceeds - costSold) / costSold) * 100 : 0, saleType, account.id, qty, price,
      `${date}T00:00:00.000Z`, now, now, orig.id, userId, held
    ),
    env.DB.prepare(
      `UPDATE investments SET ${qtyCol} = ?, amount_invested = amount_invested * ?, amount_idr = amount_idr * ?,
              current_value = current_value * ?, current_value_idr = current_value_idr * ?, status = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND ${guard.sql}`
    ).bind(remaining, keep, keep, keep, keep, remaining > 0 ? "Active" : "Closed", now, orig.id, userId, ...guard.binds),
    ...investmentEffectStatements(env, userId, sale, 1, guard, {
      date,
      note: `Penjualan ${qty} ${isStock ? "lembar" : orig.unit || "unit"} ${orig.name ?? ""} @ ${price} (${proceeds - costSold >= 0 ? "untung" : "rugi"} ${round2(Math.abs(proceeds - costSold))})`,
    }),
  ]);
  if (!results[0]?.meta.changes) return json({ error: "Posisi ini baru saja berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return json({ ok: true, id: saleId, proceeds, costBasis: costSold, remaining }, { status: 201 });
}

// POST /api/member/investments/:id/cairkan — cairkan deposito (sebelum jatuh tempo: bunga hangus).
async function handleDepositCairkan(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const dep = await loadInvestmentRow(env, userId, investmentId);
  if (!dep) return json({ error: "Deposito tidak ditemukan." }, { status: 404 });
  if (dep.type !== "Deposito" || dep.transaction_type !== "Penempatan" || dep.status !== "Active") {
    return json({ error: "Deposito ini sudah tidak aktif." }, { status: 409 });
  }
  const account = await requireOwnedAccount(env, userId, dep.account_id);
  if (!account) return json({ error: "Rekening sumber deposito tidak ditemukan." }, { status: 400 });

  const today = todayWIB();
  const invested = Number(dep.amount_invested) || 0;
  const matured = !dep.target_date || dep.target_date.slice(0, 10) <= today;
  const interest = matured
    ? round2(computeDepositResult(invested, Number(dep.return_percentage) || 0, Number(dep.tax_percentage) || 0, Number(dep.duration_days) || 0).interestOnly)
    : 0;
  const total = round2(invested + interest);
  const idrRatio = invested > 0 && Number(dep.amount_idr) > 0 ? Number(dep.amount_idr) / invested : 1;
  const closeId = generateId();
  const now = nowIso();
  const closing: InvestmentLedgerRow = {
    id: closeId, name: `${dep.name} (Dicairkan${matured ? "" : " - Awal"})`, type: "Deposito", transaction_type: "Penarikan",
    amount_invested: invested, amount_idr: invested * idrRatio, current_value: total, current_value_idr: total * idrRatio,
    currency: dep.currency, account_id: account.id,
  };
  const guard = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND user_id = ?)", binds: [closeId, userId] };
  const projectionId = await findProjectionRowId(env, dep.id, userId, dep.name ?? "");
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO investments (id, user_id, name, type, platform, category, amount_invested, amount_idr, current_value,
                                current_value_idr, return_percentage, tax_percentage, currency, transaction_type, account_id,
                                date_invested, target_date, duration_days, status, related_investment_id, created_at, updated_at)
       SELECT ?, ?, ?, 'Deposito', platform, category, ?, ?, ?, ?, return_percentage, tax_percentage, currency, 'Penarikan', ?,
              ?, ?, duration_days, 'Closed', id, ?, ?
         FROM investments WHERE id = ? AND user_id = ? AND status = 'Active'`
    ).bind(
      closeId, userId, closing.name, closing.amount_invested, closing.amount_idr, total, closing.current_value_idr, account.id,
      `${today}T00:00:00.000Z`, `${today}T00:00:00.000Z`, now, now, dep.id, userId
    ),
    env.DB.prepare(`UPDATE investments SET status = 'Closed', updated_at = ? WHERE id = ? AND user_id = ? AND ${guard.sql}`)
      .bind(now, dep.id, userId, ...guard.binds),
    ...(projectionId
      ? [env.DB.prepare(`DELETE FROM investments WHERE id = ? AND user_id = ? AND status = 'Planned' AND ${guard.sql}`).bind(projectionId, userId, ...guard.binds)]
      : []),
    ...investmentEffectStatements(env, userId, closing, 1, guard, {
      date: today,
      note: matured ? `Deposito ${dep.name} dicairkan` : `Deposito ${dep.name} dicairkan sebelum jatuh tempo, bunga hangus`,
    }),
  ]);
  if (!results[0]?.meta.changes) return json({ error: "Deposito ini baru saja berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return json({ ok: true, id: closeId, total, matured }, { status: 201 });
}

// PUT /api/member/investments/:id/rebook — edit penuh (web): balikkan efek lama,
// hapus transaksi tertaut lama, tulis ulang posisi, terapkan efek baru — satu batch.
async function handleInvestmentRebook(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<Record<string, unknown>>(request);
  const old = await loadInvestmentRow(env, userId, investmentId);
  if (!old) return json({ error: "Investasi tidak ditemukan." }, { status: 404 });
  if (old.status === "Planned") return json({ error: "Baris proyeksi tidak bisa diedit." }, { status: 409 });

  const built = await buildInvestmentPosition({ ...payload, type: payload.type ?? old.type });
  if ("error" in built) return json({ error: built.error }, { status: 400 });
  const account = await requireOwnedAccount(env, userId, payload.account_id ?? old.account_id);
  if (!account) return json({ error: "Pilih rekening sumber dana." }, { status: 400 });

  const now = nowIso();
  const token = `${now}#${generateId()}`;
  const pos: Record<string, unknown> = { ...built.position, status: old.status === "Closed" && built.position.transaction_type !== "Penarikan" ? old.status : built.position.status };
  const assignments = [...POSITION_COLUMNS, "account_id"].map((c) => `${c} = ?`).join(", ");
  const newRow: InvestmentLedgerRow = {
    id: old.id, name: String(pos.name), type: String(pos.type), transaction_type: String(pos.transaction_type),
    amount_invested: Number(pos.amount_invested), amount_idr: Number(pos.amount_idr),
    current_value: Number(pos.current_value), current_value_idr: Number(pos.current_value_idr),
    currency: String(pos.currency), account_id: account.id,
  };
  // Klaim optimistik: hanya kalau baris belum berubah sejak dibaca (updated_at
  // sama) — token unik di updated_at menjaga statement lain di batch ini.
  const guard = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND user_id = ? AND updated_at = ?)", binds: [old.id, userId, token] };
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE investments SET updated_at = ? WHERE id = ? AND user_id = ? AND updated_at IS ?`)
      .bind(token, old.id, userId, old.updated_at),
    ...investmentEffectStatements(env, userId, old, -1, guard),
    deleteLinkedInvestmentTxStatement(env, userId, old, guard),
    env.DB.prepare(`UPDATE investments SET ${assignments} WHERE id = ? AND user_id = ? AND ${guard.sql}`)
      .bind(...POSITION_COLUMNS.map((c) => positionValue(pos, c)), account.id, old.id, userId, ...guard.binds),
    ...investmentEffectStatements(env, userId, newRow, 1, guard, { date: built.date, note: `[Update] ${investmentTxLabel(newRow)}` }),
  ]);
  if (!results[0]?.meta.changes) return json({ error: "Investasi ini baru saja berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return json({ ok: true, id: old.id });
}

async function handleDeleteInvestment(request: Request, env: Env, investmentId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) {
    return authResult.error;
  }
  const userId = authResult.session.user.id;

  // Client lama membalikkan saldo & total sendiri SEBELUM memanggil endpoint
  // ini — pembalikan di server hanya kalau diminta (?reverse=1), supaya tab
  // yang masih memakai bundle lama tidak membalikkan dua kali.
  if (new URL(request.url).searchParams.get("reverse") !== "1") {
    const result = await env.DB.prepare("DELETE FROM investments WHERE id = ? AND user_id = ?")
      .bind(investmentId, userId)
      .run();

    if (!result.meta.changes) {
      return json({ error: "Investasi tidak ditemukan." }, { status: 404 });
    }

    return json({ ok: true });
  }

  const row = await loadInvestmentRow(env, userId, investmentId);
  if (!row) return json({ error: "Investasi tidak ditemukan." }, { status: 404 });

  // Balikkan efek lewat tabel yang SAMA dengan saat dibuat, hapus transaksi
  // tertautnya, lalu hapus barisnya — satu batch; hapus ganda hanya sekali.
  const guard = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND user_id = ?)", binds: [row.id, userId] };
  const statements: D1PreparedStatement[] = [
    ...investmentEffectStatements(env, userId, row, -1, guard),
    deleteLinkedInvestmentTxStatement(env, userId, row, guard),
  ];
  // Baris hasil jual/cairkan: kembalikan posisi asalnya seperti sebelum dijual
  // (lembar/jumlah & modal ditambah lagi, status aktif) — kalau tidak, hapus
  // catatan jual membuat lembar yang terjual "hilang" dari posisi asal.
  if (row.related_investment_id && (row.transaction_type === "Jual" || row.transaction_type === "Penjualan")) {
    const qtyCol = row.type === "Saham" ? "shares_count" : "quantity";
    const soldQty = Number(row.type === "Saham" ? row.shares_count : row.quantity) || 0;
    statements.push(
      env.DB.prepare(
        `UPDATE investments SET ${qtyCol} = COALESCE(${qtyCol}, 0) + ?, amount_invested = amount_invested + ?,
                amount_idr = COALESCE(amount_idr, 0) + ?, current_value = current_value + ?,
                current_value_idr = COALESCE(current_value_idr, 0) + ?, status = 'Active', updated_at = ?
          WHERE id = ? AND user_id = ? AND status IN ('Active', 'Closed') AND ${guard.sql}`
      ).bind(
        soldQty, Number(row.amount_invested) || 0, Number(row.amount_idr) || 0, Number(row.amount_invested) || 0,
        Number(row.amount_idr) || 0, nowIso(), row.related_investment_id, userId, ...guard.binds
      )
    );
  } else if (row.related_investment_id && row.type === "Deposito" && row.transaction_type === "Penarikan") {
    statements.push(
      env.DB.prepare(
        `UPDATE investments SET status = 'Active', updated_at = ?
          WHERE id = ? AND user_id = ? AND transaction_type = 'Penempatan' AND status = 'Closed' AND ${guard.sql}`
      ).bind(nowIso(), row.related_investment_id, userId, ...guard.binds)
    );
  }
  statements.push(
    env.DB.prepare("DELETE FROM investments WHERE id = ? AND user_id = ?").bind(row.id, userId),
  );
  const results = await env.DB.batch(statements);
  if (!results[results.length - 1]?.meta.changes) {
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
            credit_card_bills, other_debts, currency_initialized,
            -- status saja; kunci rahasia 2FA tidak pernah dikirim ke browser
            CASE WHEN COALESCE(two_factor_secret, '') <> '' THEN 1 ELSE 0 END AS two_factor_enabled
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

// Setup Awal (web) dalam satu batch atomik: mata uang, kategori bawaan,
// rekening pertama (opsional), lalu tandai selesai. Dulu dikirim ±25 request
// berurutan dan tanda "selesai" paling akhir — kalau user menutup halaman di
// tengah, ia harus mengulang dan kategori jadi dobel. Sekarang semua atau
// tidak sama sekali, dan aman diulang: mata uang/kategori/rekening yang sudah
// ada tidak dibuat lagi.
const ONBOARDING_ACCOUNT_TYPES = new Set(["Bank Account", "E-Wallet", "Cash"]);
async function handleCompleteOnboarding(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<{
    name?: unknown;
    whatsapp?: unknown;
    currency?: { code?: unknown; name?: unknown; symbol?: unknown };
    categories?: Array<{ category?: unknown; subCategory?: unknown }>;
    account?: { name?: unknown; type?: unknown; balance?: unknown; logoUrl?: unknown; logoLabel?: unknown } | null;
  }>(request);

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(payload.name, 100);
  if (!name) return json({ error: "Nama wajib diisi." }, { status: 400 });
  const whatsapp = str(payload.whatsapp, 30);
  // Validasi SEBELUM dipotong — kalau tidak, "RUPIAH" lolos sebagai "RUP".
  const code = str(payload.currency?.code, 10).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return json({ error: "Mata uang tidak valid." }, { status: 400 });
  const currencyName = str(payload.currency?.name, 60) || code;
  const currencySymbol = str(payload.currency?.symbol, 8) || code;

  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  if (rawCategories.length > 80) return json({ error: "Terlalu banyak kategori." }, { status: 400 });
  const seen = new Set<string>();
  const categories: Array<{ category: string; sub: string }> = [];
  for (const c of rawCategories) {
    const category = str(c?.category, 60);
    const sub = str(c?.subCategory, 60);
    if (!category || !sub || seen.has(`${category}\u0000${sub}`)) continue;
    seen.add(`${category}\u0000${sub}`);
    categories.push({ category, sub });
  }

  let account: { name: string; type: string; balance: number; logoUrl: string | null; logoLabel: string | null } | null = null;
  if (payload.account) {
    const accName = str(payload.account.name, 60);
    const accType = str(payload.account.type, 30);
    const balance = Number(payload.account.balance ?? 0);
    if (!accName || !ONBOARDING_ACCOUNT_TYPES.has(accType) || !Number.isFinite(balance) || Math.abs(balance) > 1e15) {
      return json({ error: "Data rekening tidak valid." }, { status: 400 });
    }
    const logoUrl = str(payload.account.logoUrl, 500);
    account = {
      name: accName,
      type: accType,
      balance: Math.round(balance * 100) / 100,
      logoUrl: /^https:\/\//.test(logoUrl) ? logoUrl : null,
      logoLabel: str(payload.account.logoLabel, 60) || accName,
    };
  }

  const now = nowIso();
  const insertCurrency = (c: string, n: string, sym: string, isDefault: number) =>
    env.DB.prepare(
      `INSERT INTO currencies (id, user_id, code, name, symbol, is_default, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE user_id = ? AND code = ?)`
    ).bind(generateId(), userId, c, n, sym, isDefault, now, now, userId, c);

  const statements: D1PreparedStatement[] = [
    insertCurrency(code, currencyName, currencySymbol, 1),
    // Mata uang pilihan jadi satu-satunya default (kalau sebelumnya sudah ada).
    env.DB.prepare("UPDATE currencies SET is_default = CASE WHEN code = ? THEN 1 ELSE 0 END WHERE user_id = ?").bind(code, userId),
  ];
  // IDR selalu ada — dipakai sebagai basis konversi kurs di seluruh aplikasi.
  if (code !== "IDR") statements.push(insertCurrency("IDR", "Rupiah Indonesia", "Rp", 0));

  for (const c of categories) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO categories (id, user_id, category, sub_category, status, sort_order, created_at, updated_at)
         SELECT ?, ?, ?, ?, 'VERIFIED',
                COALESCE((SELECT MAX(sort_order) FROM categories WHERE user_id = ? AND category = ?), -1) + 1, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = ? AND category = ? AND sub_category = ?)`
      ).bind(generateId(), userId, c.category, c.sub, userId, c.category, now, now, userId, c.category, c.sub)
    );
  }

  if (account) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO accounts (id, user_id, name, type, currency, balance, initial_balance, base_value, logo_url, logo_label, payload_json, sort_order, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL,
                COALESCE((SELECT MAX(sort_order) FROM accounts WHERE user_id = ?), -1) + 1, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = ? AND name = ?)`
      ).bind(generateId(), userId, account.name, account.type, code, account.balance, account.balance, account.logoUrl, account.logoLabel, userId, now, now, userId, account.name)
    );
  }

  statements.push(
    env.DB.prepare(
      `UPDATE users SET name = ?, whatsapp = CASE WHEN ? <> '' THEN ? ELSE whatsapp END, currency_initialized = 1, updated_at = ? WHERE id = ?`
    ).bind(name, whatsapp, whatsapp, now, userId)
  );

  await env.DB.batch(statements);
  return json({ ok: true });
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

// Target tabungan (fitur goal-based saving) disimpan di kolom payload_json
// yang sudah ada di skema `recurring` (lihat schema-production.sql) tapi
// belum pernah dipakai — jadi tidak perlu migrasi kolom baru.
const buildRecurringPayloadJson = (payload: Record<string, unknown>): string | null => {
  const targetAmountRaw = pickPayloadValue(payload, "target_amount", "targetAmount");
  const targetAmount = typeof targetAmountRaw === "number" ? targetAmountRaw : Number(targetAmountRaw);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
  return JSON.stringify({ targetAmount });
};

// Nilai yang boleh disimpan untuk recurring/budget — sama dengan pilihan di
// form web & mobile. Nominal negatif pada recurring "Pengeluaran" dulu lolos
// dan membuat cron MENAMBAH saldo tiap periode.
const RECURRING_TYPES = new Set(["Pengeluaran", "Pemasukan", "Tabungan"]);
const RECURRING_INTERVALS = new Set(["Harian", "Mingguan", "Bulanan", "Tahunan"]);
const RECURRING_STATUSES = new Set(["ACTIVE", "PAUSED"]);
const validateRecurringPayload = (payload: Record<string, unknown>, partial: boolean): string | null => {
  const has = (...keys: string[]) => keys.some((k) => payload[k] !== undefined);
  if (!partial || has("amount")) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "Nominal harus lebih dari 0.";
  }
  if ((!partial || has("type")) && !RECURRING_TYPES.has(String(payload.type ?? "Pengeluaran"))) {
    return "Jenis jadwal harus Pengeluaran, Pemasukan, atau Tabungan.";
  }
  if ((!partial || has("interval", "interval_value")) &&
      !RECURRING_INTERVALS.has(String(pickPayloadValue(payload, "interval_value", "interval") ?? "Bulanan"))) {
    return "Interval tidak dikenal.";
  }
  if (has("status") && !RECURRING_STATUSES.has(String(payload.status))) return "Status tidak dikenal.";
  if ((!partial || has("name")) && !String(payload.name ?? "").trim()) return "Nama jadwal wajib diisi.";
  return null;
};

async function handleCreateRecurring(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<Record<string, unknown>>(request);
  const invalid = validateRecurringPayload(payload, false);
  if (invalid) return json({ error: invalid }, { status: 400 });
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [pickPayloadValue(payload, "account_id", "accountId")]);
  if (accountError) return accountError;
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO recurring (id, user_id, name, type, category, account_id, amount, interval, next_date, note, status, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      buildRecurringPayloadJson(payload),
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
  const invalid = validateRecurringPayload(payload, true);
  if (invalid) return json({ error: invalid }, { status: 400 });
  const accountError = await assertOwnAccounts(env, authResult.session.user.id, [pickPayloadValue(payload, "account_id", "accountId")]);
  if (accountError) return accountError;
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
  if (payload.target_amount !== undefined || payload.targetAmount !== undefined) {
    updates.set("payload_json", buildRecurringPayloadJson(payload));
  }

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
  const userId = authResult.session.user.id;
  const payload = await parseJson<Record<string, unknown>>(request);
  const id = generateId();
  const currency = String(payload.currency ?? "IDR");
  const amount = Number(payload.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Nominal harus lebih dari 0." }, { status: 400 });
  }
  const transactionType = String(pickPayloadValue(payload, "transaction_type", "transactionType") ?? "Setoran");
  if (transactionType !== "Setoran" && transactionType !== "Penarikan") {
    return json({ error: "Tipe tabungan tidak dikenal." }, { status: 400 });
  }
  const fromAccount = String(pickPayloadValue(payload, "from_account", "fromAccount") ?? "");
  const accountError = await assertOwnAccounts(env, userId, [fromAccount]);
  if (accountError) return accountError;

  // apply_balance: saldo rekening ikut diubah di batch yang sama (Setoran
  // mengurangi, Penarikan menambah). Client lama mengubah saldo sendiri lewat
  // /accounts/:id/balance dan tidak mengirim flag ini — perilakunya tetap.
  const applyBalance =
    (payload.apply_balance === true || payload.applyBalance === true) && !NON_ACCOUNT_IDS.has(fromAccount);
  if (applyBalance) {
    const account = await env.DB.prepare("SELECT currency FROM accounts WHERE id = ? AND user_id = ?")
      .bind(fromAccount, userId)
      .first<{ currency: string | null }>();
    if ((account?.currency || "IDR") !== currency) {
      return json({ error: "Mata uang harus sama dengan mata uang rekening." }, { status: 400 });
    }
  }

  const amountIdr = await resolveIdrAmount(currency, amount, payload.amount_idr ?? payload.amountIDR);
  const insert = env.DB.prepare(
    `INSERT INTO savings (
      id, user_id, description, amount, amount_idr, currency, category, sub_category,
      from_account, to_goal, transaction_type, date, display_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    String(payload.description ?? ""),
    amount,
    amountIdr,
    currency,
    String(payload.category ?? ""),
    pickPayloadValue(payload, "sub_category", "subCategory") ?? null,
    fromAccount,
    String(pickPayloadValue(payload, "to_goal", "toGoal") ?? ""),
    transactionType,
    toIsoIfDateLike(payload.date) ?? nowIso(),
    payload.display_date ?? payload.displayDate ?? nowIso(),
    nowIso(),
    nowIso()
  );

  if (!applyBalance) {
    await insert.run();
    return json({ ok: true, id }, { status: 201 });
  }
  await env.DB.batch([
    insert,
    env.DB.prepare(
      `UPDATE accounts SET balance = balance + ?
        WHERE id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM savings WHERE id = ? AND user_id = ?)`
    ).bind(transactionType === "Penarikan" ? amount : -amount, fromAccount, userId, id, userId),
  ]);
  return json({ ok: true, id, balanceApplied: true }, { status: 201 });
}

async function handleDeleteSaving(request: Request, env: Env, savingId: string) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;

  // Sama seperti hapus transaksi: pembalikan saldo di server hanya kalau client
  // memintanya (?reverse=1) — client lama sudah membalikkan saldo sendiri.
  if (new URL(request.url).searchParams.get("reverse") !== "1") {
    const result = await env.DB.prepare("DELETE FROM savings WHERE id = ? AND user_id = ?")
      .bind(savingId, userId)
      .run();
    if (!result.meta.changes) {
      return json({ error: "Tabungan tidak ditemukan." }, { status: 404 });
    }
    return json({ ok: true });
  }

  const row = await env.DB.prepare(
    "SELECT id, amount, from_account, transaction_type FROM savings WHERE id = ? AND user_id = ?"
  )
    .bind(savingId, userId)
    .first<{ id: string; amount: number; from_account: string | null; transaction_type: string | null }>();
  if (!row) return json({ error: "Tabungan tidak ditemukan." }, { status: 404 });

  const amount = Number(row.amount) || 0;
  const statements: D1PreparedStatement[] = [];
  if (row.from_account && !NON_ACCOUNT_IDS.has(row.from_account) && amount !== 0) {
    statements.push(
      env.DB.prepare(
        `UPDATE accounts SET balance = balance + ?
          WHERE id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM savings WHERE id = ? AND user_id = ?)`
      ).bind(row.transaction_type === "Penarikan" ? -amount : amount, row.from_account, userId, row.id, userId)
    );
  }
  statements.push(env.DB.prepare("DELETE FROM savings WHERE id = ? AND user_id = ?").bind(row.id, userId));
  const results = await env.DB.batch(statements);
  if (!results[results.length - 1]?.meta.changes) {
    return json({ error: "Tabungan tidak ditemukan." }, { status: 404 });
  }
  return json({ ok: true });
}

type ProPackageRow = { id?: unknown; name?: unknown; durationMonths?: unknown; price?: unknown };

async function handleCreateMemberPayment(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;
  const payload = await parseJson<Record<string, unknown>>(request);

  // Paket, durasi & harga resmi diambil dari pengaturan admin — BUKAN dari
  // request. Dulu durationMonths dari client dipakai saat admin menyetujui,
  // jadi member bisa bayar 1 bulan tapi minta 1200 bulan PRO.
  const packagePayload = (payload.package as Record<string, unknown> | undefined) ?? {};
  const packageId = String(packagePayload.id ?? payload.package_id ?? "");
  const settings = await env.DB.prepare("SELECT value_json FROM admin_settings WHERE id = 'global'").first<{ value_json: string | null }>();
  let packages: ProPackageRow[] = [];
  try {
    const parsed = JSON.parse(settings?.value_json ?? "{}") as { proPackages?: unknown };
    if (Array.isArray(parsed.proPackages)) packages = parsed.proPackages as ProPackageRow[];
  } catch {
    packages = [];
  }
  const pkg = packages.find((p) => String(p.id) === packageId);
  if (!pkg) {
    return json({ error: "Paket tidak ditemukan. Muat ulang halaman lalu pilih paket lagi." }, { status: 400 });
  }
  const durationMonths = Math.max(1, Math.min(120, Math.round(Number(pkg.durationMonths) || 1)));
  const packageName = String(pkg.name ?? "Paket PRO").slice(0, 80);
  const expectedPrice = Number(pkg.price) || 0;

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return json({ error: "Nominal transfer tidak valid." }, { status: 400 });
  }

  // Bukti bayar hanya dari Cloudinary (tempat upload aplikasi) — URL lain
  // bisa dipakai melacak atau menipu admin saat gambarnya dibuka.
  const proofRaw = payload.proof_image_url ?? payload.proofImageUrl;
  const proofUrl = typeof proofRaw === "string" && proofRaw.trim() ? proofRaw.trim() : null;
  if (proofUrl && !/^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//.test(proofUrl)) {
    return json({ error: "Bukti pembayaran tidak valid. Unggah ulang gambarnya." }, { status: 400 });
  }

  // Cegah spam pengajuan: maksimal 5 yang masih menunggu per akun.
  const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM payments WHERE user_id = ? AND status = 'MENUNGGU'")
    .bind(userId)
    .first<{ n: number }>();
  if ((pending?.n ?? 0) >= 5) {
    return json({ error: "Masih ada beberapa pembayaran yang menunggu verifikasi. Tunggu admin memprosesnya dulu." }, { status: 429 });
  }

  // Identitas dari akun yang login, bukan dari request.
  const user = await env.DB.prepare("SELECT name, email, whatsapp, photo_url FROM users WHERE id = ?")
    .bind(userId)
    .first<{ name: string | null; email: string; whatsapp: string | null; photo_url: string | null }>();
  const userName = user?.name || authResult.session.user.name || "-";
  const userEmail = user?.email || authResult.session.user.email;

  const packageJson = JSON.stringify({
    id: packageId,
    name: packageName,
    durationMonths,
    expectedPrice,
    method: String(payload.method ?? "Bank Transfer").slice(0, 40),
    ref: payload.ref ? String(payload.ref).slice(0, 80) : null,
  });
  const note = payload.note ? String(payload.note).slice(0, 500) : null;
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO payments (
      id, user_id, user_name, user_email, user_whatsapp, user_photo_url, amount,
      package_json, proof_image_url, note, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU', ?, ?)`
  )
    .bind(
      id, userId, userName, userEmail, user?.whatsapp ?? null, user?.photo_url ?? null, amount,
      packageJson, proofUrl, note, nowIso(), nowIso()
    )
    .run();

  const mismatch = expectedPrice > 0 && Math.round(amount) !== Math.round(expectedPrice);
  await sendTelegramNotification(
    env,
    `💰 <b>Pembayaran Baru</b>\n` +
      `Nama: ${escapeHtml(userName)}\n` +
      `Email: ${escapeHtml(userEmail)}\n` +
      `Paket: ${escapeHtml(packageName)} (${durationMonths} bulan)\n` +
      `Jumlah: Rp ${amount.toLocaleString("id-ID")}` +
      (mismatch ? ` ⚠️ harga paket Rp ${expectedPrice.toLocaleString("id-ID")}` : "") +
      `\n\nVerifikasi di Admin &gt; Pembayaran.`
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
  // Hanya bentuk pesan yang wajar, maksimal 200 pesan terakhir & 20rb karakter
  // per pesan — dulu isi apa pun sebesar apa pun disimpan apa adanya.
  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .slice(-200)
    .map((m) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(m)) {
        if (typeof v === "string") out[k] = v.slice(0, 20_000);
        else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
        // Objek kecil (mis. timestamp dari client) tetap disimpan.
        else if (typeof v === "object" && JSON.stringify(v).length <= 1000) out[k] = v;
      }
      return out;
    });
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
    `SELECT id, name, email, role, plan, status, expired_at, photo_url, created_at, whatsapp,
            CASE WHEN COALESCE(two_factor_secret, '') <> '' THEN 1 ELSE 0 END AS has_2fa
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
      `SELECT id, name, email, role, plan, status, expired_at, photo_url, created_at, whatsapp,
              CASE WHEN COALESCE(two_factor_secret, '') <> '' THEN 1 ELSE 0 END AS has_2fa
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
    resetTwoFactor?: boolean;
  }>(request);

  // Reset 2FA untuk user yang kehilangan Authenticator (setelah admin
  // memverifikasi kepemilikan akun di luar aplikasi). Semua sesi user itu ikut
  // dicabut supaya siapa pun yang sedang login harus masuk ulang.
  if (payload.resetTwoFactor === true) {
    if (target.id === authResult.session.user.id) {
      return json({ error: "Reset 2FA akun sendiri lewat halaman Profil." }, { status: 400 });
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET two_factor_secret = NULL WHERE id = ?").bind(userId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    ]);
    await insertAdminLog(
      env,
      authResult.session.user.email,
      "RESET_2FA",
      target.email,
      "Reset verifikasi 2 langkah & cabut semua sesi",
      "amber"
    );
    return json({ ok: true });
  }

  if (payload.plan !== undefined && !["FREE", "PRO"].includes(payload.plan)) {
    return json({ error: "Plan tidak valid." }, { status: 400 });
  }
  if (payload.status !== undefined && !["AKTIF", "NONAKTIF", "GUEST", "PENDING"].includes(payload.status)) {
    return json({ error: "Status tidak valid." }, { status: 400 });
  }
  if (payload.expiredAt && Number.isNaN(Date.parse(payload.expiredAt))) {
    return json({ error: "Tanggal kedaluwarsa tidak valid." }, { status: 400 });
  }

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
  if (payload.prompt.length > 2000) {
    return json({ error: "Pesan terlalu panjang (maksimal 2.000 karakter)." }, { status: 400 });
  }
  // Tiap pesan memanggil model berbayar — batasi per user (anggaran terpisah
  // dari AI parse, binding rate limiter yang sama dengan key berbeda).
  if (env.AI_PARSE_RATE_LIMITER) {
    const { success } = await env.AI_PARSE_RATE_LIMITER.limit({ key: `ai-chat:user:${authResult.session.user.id}` });
    if (!success) {
      return json({ error: "Terlalu banyak pesan dalam waktu singkat. Coba lagi sebentar lagi." }, { status: 429 });
    }
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
  // Terima dua format: dari server (role user/assistant + content) dan format
  // lama yang dulu disimpan ulang oleh browser (role model + text) — dulu
  // format kedua tersaring habis sehingga AI "lupa" obrolan sebelumnya.
  const history = (nextMessages as Array<Record<string, unknown>>)
    .map((m) => {
      const role = m.role === "user" ? "user" : m.role === "assistant" || m.role === "model" ? "assistant" : null;
      const content = typeof m.content === "string" ? m.content : typeof m.text === "string" ? m.text : "";
      return role && content.trim() ? { role: role as "user" | "assistant", content } : null;
    })
    .filter((m): m is { role: "user" | "assistant"; content: string } => m !== null);

  const userContext = await buildUserContext(env, authResult.session.user.id);
  let answer: string;
  try {
    answer = await runAiAssistant(env, payload.prompt, userContext, history);
  } catch (error) {
    if (isAiQuotaError(error)) {
      console.warn("AI quota (402):", error instanceof Error ? error.message : error);
      await notifyAiQuotaOnce(env);
      return json({ error: AI_QUOTA_MESSAGE, code: "ai_quota" }, { status: 503 });
    }
    console.error("AI chat gagal:", error);
    return json({ error: "AI lagi ada gangguan sebentar. Coba kirim ulang ya." }, { status: 502 });
  }

  nextMessages.push(
    { role: "user", content: payload.prompt, createdAt: nowIso() },
    { role: "assistant", content: answer, createdAt: nowIso() }
  );
  // Simpan paling banyak 200 pesan terakhir — riwayat lama tidak tumbuh tanpa batas.
  if (nextMessages.length > 200) nextMessages.splice(0, nextMessages.length - 200);

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

// Dipakai khusus fitur AI Scan (foto struk) & Voice (transkrip suara). Semua
// kandidat WAJIB bisa menerima gambar — request foto yang nyasar ke model
// text-only bisa gagal tak terduga — jadi tidak memakai daftar chat di atas.
// Gemini 2.5 Flash Lite (murah) dengan Gemini 2.5 Flash sebagai cadangan kalau
// provider pertama gangguan. Dipakai juga untuk Voice supaya hasil ekstraksi
// konsisten antara Scan & Voice.
const PARSE_TRANSACTION_MODELS = ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];

type ParsedTransactionSuggestion = {
  type: "pengeluaran" | "pemasukan";
  amount: number;
  category: string | null;
  sub_category: string | null;
  note: string | null;
  confidence: "high" | "medium" | "low";
  /** Rekening yang disebut (mis. "pakai BCA") — hanya id rekening milik user. */
  account_id?: string | null;
  /** Tanggal yang disebut (mis. "kemarin"), YYYY-MM-DD, maks 60 hari ke belakang. */
  date?: string | null;
};

// Model kadang tetap membungkus JSON dalam code fence markdown walau sudah
// diminta untuk tidak — buang pembungkusnya dulu sebelum JSON.parse.
const stripJsonFences = (raw: string) =>
  raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

async function handleParseTransaction(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;

  if (!(await checkAiParseRateLimit(env, authResult.session.user.id))) {
    return json({ error: "Terlalu banyak permintaan AI. Coba lagi dalam beberapa saat." }, { status: 429 });
  }

  const payload = await parseJson<{ text?: string; imageBase64?: string }>(request);
  const hasText = typeof payload.text === "string" && payload.text.trim().length > 0;
  const hasImage = typeof payload.imageBase64 === "string" && payload.imageBase64.trim().length > 0;
  if (hasText === hasImage) {
    return json({ error: "Kirim salah satu: teks atau foto, tidak boleh dua-duanya atau kosong." }, { status: 400 });
  }
  if (hasText && payload.text!.length > 1000) {
    return json({ error: "Teks terlalu panjang (maksimal 1.000 karakter)." }, { status: 400 });
  }
  // base64 ±4/3 ukuran file — ~7 juta karakter ≈ foto 5 MB.
  if (hasImage && payload.imageBase64!.length > 7_000_000) {
    return json({ error: "Foto terlalu besar. Coba foto ulang dengan resolusi lebih kecil." }, { status: 413 });
  }

  const openRouter = await getOpenRouterKey(env);
  if (!openRouter) {
    return json({ ok: false, error: "AI belum dikonfigurasi." }, { status: 422 });
  }

  const categoryRows = await env.DB.prepare(
    `SELECT category, sub_category FROM categories WHERE user_id = ? ORDER BY category ASC`
  )
    .bind(authResult.session.user.id)
    .all<{ category: string; sub_category: string }>();
  const userCategories = (categoryRows.results ?? []).map((c) => ({
    category: c.category,
    sub_category: c.sub_category,
  }));
  const accountRows = await env.DB.prepare(`SELECT id, name, type, currency FROM accounts WHERE user_id = ?`)
    .bind(authResult.session.user.id)
    .all<{ id: string; name: string; type: string; currency: string }>();
  const userAccounts = accountRows.results ?? [];
  const today = todayWIB();

  const systemPrompt = `Kamu adalah asisten yang mengekstrak detail transaksi keuangan dari foto struk/nota ATAU teks hasil transkrip suara pengguna.
Balas HANYA dengan satu objek JSON valid, TANPA teks lain, TANPA markdown code fence, sesuai skema persis berikut:
{
  "type": "pengeluaran" | "pemasukan",
  "amount": <angka, tanpa simbol mata uang atau pemisah ribuan>,
  "category": <string, harus SALAH SATU dari daftar berikut, atau null kalau tidak yakin>,
  "sub_category": <string sub-kategori dari kategori yang dipilih, atau null>,
  "note": <string ringkas, misal nama merchant/deskripsi, atau null>,
  "confidence": "high" | "medium" | "low",
  "account": <nama rekening PERSIS dari daftar rekening di bawah kalau pengguna menyebutnya (mis. "pakai BCA", "dari cash"), atau null>,
  "date": <"YYYY-MM-DD" kalau pengguna menyebut waktu (mis. "kemarin", "2 hari lalu", "tanggal 25") atau tanggal tercetak di struk, atau null>
}

Hari ini (WIB): ${today}.

Daftar kategori pengguna yang SAH (jangan mengarang nama di luar daftar ini):
${JSON.stringify(userCategories)}

Daftar rekening pengguna (pakai nama persis, jangan mengarang):
${JSON.stringify(userAccounts.map((a) => ({ name: a.name, type: a.type, currency: a.currency })))}`;

  const userContent = hasImage
    ? [
        { type: "text", text: "Ekstrak detail transaksi dari foto struk/nota ini." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${payload.imageBase64}` } },
      ]
    : payload.text!.trim();

  let rawContent: string;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openRouter.key}`,
        "http-referer": env.APP_URL || "https://www.leosiqra.com",
        "x-title": env.APP_NAME || "Leosiqra",
      },
      body: JSON.stringify({
        models: PARSE_TRANSACTION_MODELS,
        route: "fallback",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        // Respons cuma satu objek JSON kecil — batasi output supaya tidak
        // kena limit token/kredit OpenRouter (model default bisa minta
        // puluhan ribu token walau responsnya sendiri singkat).
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter request gagal (${response.status}): ${errText.slice(0, 300)}`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    if (isAiQuotaError(error)) {
      console.warn("AI quota (402):", error instanceof Error ? error.message : error);
      await notifyAiQuotaOnce(env);
      return json({ ok: false, error: AI_QUOTA_MESSAGE, code: "ai_quota" }, { status: 503 });
    }
    return json(
      {
        ok: false,
        error: "AI tidak bisa membaca data transaksi dari input ini. Coba foto/ucapan yang lebih jelas, atau isi manual.",
      },
      { status: 422 }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    return json(
      {
        ok: false,
        error: "AI tidak bisa membaca data transaksi dari input ini. Coba foto/ucapan yang lebih jelas, atau isi manual.",
      },
      { status: 422 }
    );
  }

  const type = parsed.type === "pengeluaran" || parsed.type === "pemasukan" ? parsed.type : null;
  const amount = Number(parsed.amount);
  if (!type || !Number.isFinite(amount) || amount <= 0) {
    return json(
      {
        ok: false,
        error: "AI tidak bisa membaca data transaksi dari input ini. Coba foto/ucapan yang lebih jelas, atau isi manual.",
      },
      { status: 422 }
    );
  }

  // Kategori dari AI cuma dipakai kalau persis cocok (case-insensitive) sama
  // kategori nyata milik user — kalau AI mengarang nama, biarkan kosong
  // supaya user pilih manual dari CategorySelect, bukan gagal total (amount
  // & type tetap berguna meski kategorinya tidak match).
  const matchedCategory = userCategories.find(
    (c) => c.category.toLowerCase() === String(parsed.category ?? "").toLowerCase()
  );

  const suggestion: ParsedTransactionSuggestion = {
    type,
    amount,
    category: matchedCategory?.category ?? null,
    sub_category: matchedCategory ? String(parsed.sub_category ?? matchedCategory.sub_category ?? "") || null : null,
    note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : null,
    confidence: parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "low",
    account_id: null,
    date: null,
  };

  // Rekening & tanggal dari AI hanya dipakai kalau valid: nama rekening harus
  // persis milik user (tidak ditebak), tanggal format YYYY-MM-DD, tidak di
  // masa depan dan maksimal 60 hari ke belakang.
  const aiAccount = String(parsed.account ?? "").trim().toLowerCase();
  if (aiAccount) {
    suggestion.account_id = userAccounts.find((a) => a.name.toLowerCase() === aiAccount)?.id ?? null;
  }
  const aiDate = String(parsed.date ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(aiDate) && aiDate <= today && daysBetween(aiDate, today) <= 60) {
    suggestion.date = aiDate;
  }

  return json({ ok: true, suggestion });
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
  const raw = computeDepositResult(invested, rate, taxRate, days);
  // Uang dibulatkan ke 2 desimal sebelum menyentuh saldo/total.
  const interestOnly = round2(raw.interestOnly);
  const totalResult = round2(invested + interestOnly);
  const action = inv.maturity_action || "cairkan";
  const today = inv.target_date.slice(0, 10);
  const projectionId = await findProjectionRowId(env, inv.id, inv.user_id, inv.name);
  const now = nowIso();
  // Klaim anti-dobel: statement pertama tiap cabang hanya berhasil kalau
  // deposito masih Active dengan target_date yang sama seperti saat dibaca,
  // sambil menulis token unik ke updated_at. Semua efek uang di batch yang sama
  // dijaga token itu — cron yang di-retry/berjalan bersamaan tidak bisa
  // mencairkan dua kali, dan gagal di tengah = seluruh batch batal.
  const token = `${now}#${generateId()}`;
  const claimed = { sql: "EXISTS (SELECT 1 FROM investments WHERE id = ? AND updated_at = ?)", binds: [inv.id, token] };
  const claimWhere = "id = ? AND user_id = ? AND status = 'Active' AND target_date = ?";

  if (action === "cairkan") {
    const totalResultIdr = await resolveIdrAmount(currency, totalResult, undefined);
    const investedIdr = await resolveIdrAmount(currency, invested, undefined);
    const closingId = generateId();
    const closing: InvestmentLedgerRow = {
      id: closingId, name: `${inv.name} (Dicairkan)`, type: "Deposito", transaction_type: "Penarikan",
      amount_invested: invested, amount_idr: investedIdr, current_value: totalResult, current_value_idr: totalResultIdr,
      currency, account_id: inv.account_id,
    };
    await env.DB.batch([
      env.DB.prepare(`UPDATE investments SET status = 'Closed', updated_at = ? WHERE ${claimWhere}`)
        .bind(token, inv.id, inv.user_id, inv.target_date),
      env.DB.prepare(
        `INSERT INTO investments (
          id, user_id, name, type, platform, amount_invested, amount_idr, current_value, current_value_idr,
          return_percentage, tax_percentage, currency, transaction_type, category, account_id,
          date_invested, target_date, duration_days, status, related_investment_id, created_at, updated_at
        ) SELECT ?, ?, ?, 'Deposito', ?, ?, ?, ?, ?, ?, ?, ?, 'Penarikan', ?, ?, ?, ?, ?, 'Closed', ?, ?, ? WHERE ${claimed.sql}`
      ).bind(
        closingId, inv.user_id, closing.name, inv.platform, invested, investedIdr, totalResult, totalResultIdr, rate, taxRate,
        currency, inv.category, inv.account_id, inv.target_date, inv.target_date, days, inv.id, now, now, ...claimed.binds
      ),
      ...(projectionId
        ? [env.DB.prepare(`DELETE FROM investments WHERE id = ? AND status = 'Planned' AND ${claimed.sql}`).bind(projectionId, ...claimed.binds)]
        : []),
      ...investmentEffectStatements(env, inv.user_id, closing, 1, claimed, {
        date: today,
        note: `[Otomatis] Deposito ${inv.name} cair jatuh tempo (pokok+bunga)`,
        label: "Deposito - Penarikan (Otomatis)",
      }),
    ]);
    return;
  }

  const newDateInvested = inv.target_date;
  const newTargetDate = addMonthsIso(inv.target_date, 1);
  const newDurationDays = daysBetweenIso(newDateInvested, newTargetDate);

  if (action === "aro_bunga") {
    const interestOnlyIdr = await resolveIdrAmount(currency, interestOnly, undefined);
    const nextResult = computeDepositResult(invested, rate, taxRate, newDurationDays);
    const nextTotalIdr = await resolveIdrAmount(currency, nextResult.totalResult, undefined);
    const hasAccount = Boolean(inv.account_id) && !NON_ACCOUNT_IDS.has(inv.account_id ?? "");
    await env.DB.batch([
      env.DB.prepare(`UPDATE investments SET date_invested = ?, target_date = ?, duration_days = ?, updated_at = ? WHERE ${claimWhere}`)
        .bind(newDateInvested, newTargetDate, newDurationDays, token, inv.id, inv.user_id, inv.target_date),
      ...(hasAccount
        ? [
            env.DB.prepare(`UPDATE accounts SET balance = ROUND(balance + ?, 2) WHERE id = ? AND user_id = ? AND ${claimed.sql}`)
              .bind(interestOnly, inv.account_id, inv.user_id, ...claimed.binds),
            env.DB.prepare(
              `INSERT INTO transactions (id, user_id, type, amount, amount_idr, category, sub_category, currency, account_id,
                                         date, display_date, note, status, related_id, related_type, created_at, updated_at)
               SELECT ?, ?, 'pemasukan', ?, ?, 'Investasi', 'Deposito - Bunga (Otomatis)', ?, ?, ?, ?, ?, 'VERIFIED', ?, 'investasi', ?, ?
                WHERE ${claimed.sql}`
            ).bind(
              generateId(), inv.user_id, round2(interestOnly), interestOnlyIdr, currency, inv.account_id, today, today,
              `[Otomatis] Bunga deposito ${inv.name} cair ke rekening, pokok diperpanjang 1 bulan`, inv.id, now, now, ...claimed.binds
            ),
          ]
        : []),
      env.DB.prepare(
        `UPDATE users SET total_income = ROUND(COALESCE(total_income, 0) + ?, 2), total_wealth = ROUND(COALESCE(total_wealth, 0) + ?, 2)
          WHERE id = ? AND ${claimed.sql}`
      ).bind(interestOnly, interestOnly, inv.user_id, ...claimed.binds),
      ...(projectionId
        ? [
            env.DB.prepare(
              `UPDATE investments SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
                      date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
                WHERE id = ? AND ${claimed.sql}`
            ).bind(
              nextResult.totalResult, nextTotalIdr, nextResult.totalResult, nextTotalIdr, newTargetDate, newTargetDate,
              newDurationDays, now, projectionId, ...claimed.binds
            ),
          ]
        : []),
    ]);
    return;
  }

  if (action === "aro_full") {
    const newInvested = totalResult;
    const newInvestedIdr = await resolveIdrAmount(currency, newInvested, undefined);
    const nextResult = computeDepositResult(newInvested, rate, taxRate, newDurationDays);
    const nextTotalIdr = await resolveIdrAmount(currency, nextResult.totalResult, undefined);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE investments SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
                date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
          WHERE ${claimWhere}`
      ).bind(
        newInvested, newInvestedIdr, newInvested, newInvestedIdr, newDateInvested, newTargetDate, newDurationDays, token,
        inv.id, inv.user_id, inv.target_date
      ),
      env.DB.prepare(`UPDATE users SET total_investment = ROUND(COALESCE(total_investment, 0) + ?, 2) WHERE id = ? AND ${claimed.sql}`)
        .bind(interestOnly, inv.user_id, ...claimed.binds),
      ...(projectionId
        ? [
            env.DB.prepare(
              `UPDATE investments SET amount_invested = ?, amount_idr = ?, current_value = ?, current_value_idr = ?,
                      date_invested = ?, target_date = ?, duration_days = ?, updated_at = ?
                WHERE id = ? AND ${claimed.sql}`
            ).bind(
              nextResult.totalResult, nextTotalIdr, nextResult.totalResult, nextTotalIdr, newTargetDate, newTargetDate,
              newDurationDays, now, projectionId, ...claimed.binds
            ),
          ]
        : []),
    ]);
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

const formatCurrencyForPush = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);
  } catch {
    return formatRupiahForPush(n);
  }
};

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

// ===== Insight proaktif (AI Leosiqra) =====
// Dihitung on-demand dari data transaksi/budget yang sudah ada (tanpa tabel
// baru) — anomali kategori, proyeksi budget kebablasan, dan tren bulanan.
// Rule-based (bukan panggilan LLM) supaya cepat, gratis, dan deterministik;
// AI chat tetap bisa menjelaskan lebih lanjut kalau user tanya.

type MonthlyCategoryRow = { ym: string; category: string; type: string; total: number };

type UserInsight = {
  id: string;
  type: "anomaly" | "budget_pace" | "trend";
  severity: "info" | "warning";
  title: string;
  body: string;
};

const computeUserInsights = async (env: Env, userId: string): Promise<UserInsight[]> => {
  const insights: UserInsight[] = [];

  const todayStr = todayWIB(); // "YYYY-MM-DD"
  const currentYm = todayStr.slice(0, 7);
  const dayOfMonth = Number(todayStr.slice(8, 10));
  const [yearNum, monthNum] = currentYm.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const prevYm = new Date(Date.UTC(yearNum, monthNum - 2, 1)).toISOString().slice(0, 7);
  // Ambil ~4 bulan histori — cukup untuk rata-rata 3 bulan pembanding, tidak berat di query.
  const historyStart = new Date(Date.UTC(yearNum, monthNum - 1 - 4, 1)).toISOString().slice(0, 10);

  const { results } = await env.DB.prepare(
    `SELECT substr(date, 1, 7) as ym, category, type,
            SUM(COALESCE(NULLIF(amount_idr, 0), amount)) as total
       FROM transactions
      WHERE user_id = ? AND type IN ('pengeluaran', 'pemasukan') AND date >= ?
      GROUP BY ym, category, type`
  )
    .bind(userId, historyStart)
    .all<MonthlyCategoryRow>();

  // Menaruh uang ke investasi (Deposito/Saham/dll) tersimpan sebagai type
  // "pengeluaran" tapi BUKAN kerugian — sama seperti bug yang ditemukan di
  // Dashboard Tahunan & monthSummary AI chat. Kalau ikut dijumlah di sini,
  // "tren pengeluaran" jadi salah, dan naik-turunnya alokasi investasi bisa
  // salah dianggap "anomali pengeluaran" padahal itu perilaku menabung yang
  // baik, bukan masalah.
  const isInvestmentCategory = (category: string) =>
    category?.toLowerCase().includes("investasi") || category === "Saham" || category === "Deposito";

  const byCategory = new Map<string, { current: number; history: number[] }>();
  const totalsByYmType = new Map<string, number>();
  for (const row of results ?? []) {
    if (row.type === "pengeluaran" && isInvestmentCategory(row.category)) continue;
    totalsByYmType.set(`${row.ym}:${row.type}`, (totalsByYmType.get(`${row.ym}:${row.type}`) ?? 0) + row.total);
    if (row.type !== "pengeluaran") continue;
    const entry = byCategory.get(row.category) ?? { current: 0, history: [] };
    if (row.ym === currentYm) entry.current += row.total;
    else if (row.ym < currentYm) entry.history.push(row.total);
    byCategory.set(row.category, entry);
  }

  // Butuh minimal beberapa hari berjalan supaya proyeksi pace tidak liar (mis.
  // sekali belanja gede di tanggal 1 langsung diproyeksikan x30).
  const canProject = dayOfMonth >= 3;

  // 1) Anomali kategori: proyeksi bulan ini vs rata-rata histori kategori itu.
  if (canProject) {
    for (const [category, { current, history }] of byCategory) {
      if (history.length < 2 || current < 100000) continue;
      const avg = history.reduce((s, v) => s + v, 0) / history.length;
      if (avg <= 0) continue;
      const projected = (current / dayOfMonth) * daysInMonth;
      if (projected >= avg * 1.4) {
        const pct = Math.round((projected / avg - 1) * 100);
        insights.push({
          id: `anomaly-${category}`,
          type: "anomaly",
          severity: "warning",
          title: `Pengeluaran ${category} berpotensi naik ${pct}%`,
          body: `Proyeksi bulan ini ~${formatRupiahForPush(projected)}, dibanding rata-rata ${formatRupiahForPush(avg)}/bulan pada bulan-bulan sebelumnya.`,
        });
      }
    }
  }

  // 2) Proyeksi budget bulanan yang berpotensi kebablasan.
  if (canProject) {
    const { results: budgetRows } = await env.DB.prepare(
      `SELECT category, amount FROM budgets WHERE user_id = ? AND type = 'pengeluaran' AND period = 'monthly'`
    )
      .bind(userId)
      .all<{ category: string; amount: number }>();

    for (const b of budgetRows ?? []) {
      const spent = byCategory.get(b.category)?.current ?? 0;
      if (spent <= 0 || !b.amount) continue;
      const projected = (spent / dayOfMonth) * daysInMonth;
      if (projected > b.amount * 1.05) {
        const pct = Math.round((projected / b.amount) * 100);
        insights.push({
          id: `budget-${b.category}`,
          type: "budget_pace",
          severity: "warning",
          title: `Budget ${b.category} berpotensi jebol`,
          body: `Dengan kecepatan belanja sekarang, proyeksi akhir bulan ~${formatRupiahForPush(projected)} (${pct}% dari target ${formatRupiahForPush(b.amount)}).`,
        });
      }
    }
  }

  // 3) Tren pengeluaran bulan ini vs bulan lalu (keseluruhan, semua kategori).
  if (canProject) {
    const curExpense = totalsByYmType.get(`${currentYm}:pengeluaran`) ?? 0;
    const prevExpense = totalsByYmType.get(`${prevYm}:pengeluaran`) ?? 0;
    if (prevExpense > 0) {
      const projectedExpense = (curExpense / dayOfMonth) * daysInMonth;
      const pct = Math.round((projectedExpense / prevExpense - 1) * 100);
      if (Math.abs(pct) >= 20) {
        insights.push({
          id: "monthly-trend",
          type: "trend",
          severity: pct > 0 ? "warning" : "info",
          title: pct > 0
            ? `Pengeluaran bulan ini diproyeksi naik ${pct}%`
            : `Pengeluaran bulan ini diproyeksi turun ${Math.abs(pct)}%`,
          body: `Dibanding bulan lalu (${formatRupiahForPush(prevExpense)}), proyeksi total bulan ini ~${formatRupiahForPush(projectedExpense)}.`,
        });
      }
    }
  }

  // Paling relevan dulu (anomali kategori & budget di atas tren umum), batasi
  // biar UI tidak kebanjiran kartu.
  return insights.slice(0, 6);
};

async function handleListInsights(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const items = await computeUserInsights(env, authResult.session.user.id);
  return json({ items });
}

// ===== Gamifikasi ringan =====
// Sama seperti insight: dihitung on-demand dari data yang sudah ada, tanpa
// tabel baru. Streak dipatahkan lembut (grace period 1 hari) supaya user
// yang belum sempat mencatat transaksi HARI INI tidak langsung kelihatan
// putus di 0 sebelum harinya berakhir.

const shiftDateStr = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const shiftYm = (ym: string, months: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
};

type GamificationBadge = { id: string; label: string; description: string; unlocked: boolean };
type GamificationChallenge = {
  id: string;
  category: string;
  label: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  done: boolean;
};

// Level 1–10. XP dihitung ulang dari data user setiap request (bukan disimpan),
// jadi tidak ada risiko XP dobel dan user lama langsung dapat level sesuai
// riwayatnya. Total XP semua challenge = 2680; Lv 10 butuh 2350 — tetap
// tercapai tanpa challenge utang (tidak semua orang punya utang).
const LEVELS: Array<{ level: number; name: string; minXp: number }> = [
  { level: 1, name: "Pemula", minXp: 0 },
  { level: 2, name: "Pencatat", minXp: 60 },
  { level: 3, name: "Teratur", minXp: 150 },
  { level: 4, name: "Hemat", minXp: 300 },
  { level: 5, name: "Perencana", minXp: 500 },
  { level: 6, name: "Disiplin", minXp: 750 },
  { level: 7, name: "Penabung", minXp: 1050 },
  { level: 8, name: "Investor", minXp: 1400 },
  { level: 9, name: "Master", minXp: 1850 },
  { level: 10, name: "Legenda", minXp: 2350 },
];

const levelForXp = (xp: number) => {
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  return { level: current.level, name: current.name, minXp: current.minXp, nextXp: next ? next.minXp : null, nextName: next ? next.name : null };
};

const computeUserGamification = async (
  env: Env,
  userId: string
): Promise<{
  streakDays: number;
  surplusStreakMonths: number;
  badges: GamificationBadge[];
  challenges: GamificationChallenge[];
  xp: number;
  level: ReturnType<typeof levelForXp>;
}> => {
  const todayStr = todayWIB();
  const currentYm = todayStr.slice(0, 7);

  // --- Streak mencatat transaksi (hari berturut-turut) ---
  const { results: dateRows } = await env.DB.prepare(
    `SELECT DISTINCT substr(date, 1, 10) as d FROM transactions WHERE user_id = ? AND date >= ?`
  )
    .bind(userId, shiftDateStr(todayStr, -120))
    .all<{ d: string }>();
  const dateSet = new Set((dateRows ?? []).map((r) => r.d));

  let streakDays = 0;
  let cursor = dateSet.has(todayStr) ? todayStr : shiftDateStr(todayStr, -1);
  while (dateSet.has(cursor)) {
    streakDays++;
    cursor = shiftDateStr(cursor, -1);
  }

  // --- Streak bulan surplus (pemasukan > pengeluaran), hanya bulan yang sudah tuntas ---
  // Beli/jual investasi tercatat sebagai pengeluaran/pemasukan tertaut
  // (related_type 'investasi'), tapi itu pindah bentuk aset, bukan belanja —
  // tanpa filter ini bulan saat user berinvestasi jadi dianggap defisit.
  const { results: monthRows } = await env.DB.prepare(
    `SELECT substr(date, 1, 7) as ym, type, SUM(COALESCE(NULLIF(amount_idr, 0), amount)) as total
       FROM transactions
      WHERE user_id = ? AND type IN ('pemasukan', 'pengeluaran') AND date >= ?
        AND COALESCE(related_type, '') <> 'investasi'
      GROUP BY ym, type`
  )
    .bind(userId, shiftYm(currentYm, -13))
    .all<{ ym: string; type: string; total: number }>();

  const monthTotals = new Map<string, { pemasukan: number; pengeluaran: number }>();
  for (const row of monthRows ?? []) {
    const entry = monthTotals.get(row.ym) ?? { pemasukan: 0, pengeluaran: 0 };
    if (row.type === "pemasukan") entry.pemasukan = row.total;
    else entry.pengeluaran = row.total;
    monthTotals.set(row.ym, entry);
  }

  let surplusStreakMonths = 0;
  let ymCursor = shiftYm(currentYm, -1); // mulai dari bulan sebelum bulan berjalan (belum tuntas)
  while (true) {
    const t = monthTotals.get(ymCursor);
    if (!t || (t.pemasukan <= 0 && t.pengeluaran <= 0)) break;
    if (t.pemasukan > t.pengeluaran) {
      surplusStreakMonths++;
      ymCursor = shiftYm(ymCursor, -1);
    } else {
      break;
    }
  }

  // --- Data pendukung badge lain ---
  const investmentCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM investments WHERE user_id = ?`)
    .bind(userId)
    .first<{ c: number }>();

  const debtStats = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN payment_status = 'belum' THEN 1 ELSE 0 END) as outstanding,
       COUNT(*) as total
     FROM transactions WHERE user_id = ? AND type = 'debt'`
  )
    .bind(userId)
    .first<{ outstanding: number | null; total: number }>();

  // Hanya setoran — penarikan juga tersimpan sebagai baris bernominal positif
  // di tabel savings, jadi dulu ikut menambah "total setoran".
  const savingsTotal = await env.DB.prepare(
    `SELECT SUM(COALESCE(NULLIF(amount_idr, 0), amount)) as total, COUNT(*) as n
       FROM savings WHERE user_id = ? AND COALESCE(transaction_type, 'Setoran') = 'Setoran'`
  )
    .bind(userId)
    .first<{ total: number | null; n: number }>();
  const totalSavingsIdr = savingsTotal?.total ?? 0;

  const counts = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM accounts WHERE user_id = ?1) as accounts,
       (SELECT COUNT(*) FROM transactions WHERE user_id = ?1 AND type IN ('pemasukan', 'pengeluaran') AND COALESCE(related_type, '') <> 'investasi') as tx,
       (SELECT COUNT(*) FROM budgets WHERE user_id = ?1) as budgets,
       (SELECT COUNT(*) FROM recurring WHERE user_id = ?1) as recurring,
       (SELECT COUNT(DISTINCT type) FROM investments WHERE user_id = ?1) as invTypes,
       (SELECT COUNT(*) FROM transactions WHERE user_id = ?1 AND type = 'debt' AND category = 'Hutang') as hutangTotal,
       (SELECT COUNT(*) FROM transactions WHERE user_id = ?1 AND type = 'debt' AND category = 'Hutang' AND payment_status = 'belum') as hutangOpen`
  )
    .bind(userId)
    .first<{ accounts: number; tx: number; budgets: number; recurring: number; invTypes: number; hutangTotal: number; hutangOpen: number }>();
  const c = counts ?? { accounts: 0, tx: 0, budgets: 0, recurring: 0, invTypes: 0, hutangTotal: 0, hutangOpen: 0 };

  const badges: GamificationBadge[] = [
    {
      id: "streak-7",
      label: "Pencatat Konsisten",
      description: "Catat transaksi 7 hari berturut-turut",
      unlocked: streakDays >= 7,
    },
    {
      id: "streak-30",
      label: "Pencatat Disiplin",
      description: "Catat transaksi 30 hari berturut-turut",
      unlocked: streakDays >= 30,
    },
    {
      id: "surplus-3",
      label: "Hemat Konsisten",
      description: "Surplus (pemasukan > pengeluaran) 3 bulan berturut-turut",
      unlocked: surplusStreakMonths >= 3,
    },
    {
      id: "surplus-6",
      label: "Master Anggaran",
      description: "Surplus 6 bulan berturut-turut",
      unlocked: surplusStreakMonths >= 6,
    },
    {
      id: "investor",
      label: "Investor Pemula",
      description: "Sudah mulai mencatat investasi",
      unlocked: (investmentCount?.c ?? 0) > 0,
    },
    {
      id: "debt-free",
      label: "Bebas Utang",
      description: "Semua utang yang pernah dicatat sudah lunas",
      unlocked: (debtStats?.total ?? 0) > 0 && (debtStats?.outstanding ?? 0) === 0,
    },
    {
      id: "saver-1jt",
      label: "Nabung Rp1 Juta",
      description: "Total setoran tabungan tembus Rp1.000.000",
      unlocked: totalSavingsIdr >= 1_000_000,
    },
    {
      id: "saver-10jt",
      label: "Nabung Rp10 Juta",
      description: "Total setoran tabungan tembus Rp10.000.000",
      unlocked: totalSavingsIdr >= 10_000_000,
    },
  ];

  const ch = (id: string, category: string, label: string, description: string, xp: number, progress: number, target: number): GamificationChallenge => {
    const p = Math.max(0, Math.min(target, Math.floor(progress)));
    return { id, category, label, description, xp, progress: p, target, done: p >= target };
  };
  const challenges: GamificationChallenge[] = [
    ch("first-account", "Mulai", "Rekening pertama", "Tambahkan satu rekening, e-wallet, atau dompet", 20, c.accounts, 1),
    ch("first-tx", "Mulai", "Transaksi pertama", "Catat pemasukan atau pengeluaran pertamamu", 20, c.tx, 1),
    ch("streak-3", "Konsisten", "Streak 3 hari", "Catat transaksi 3 hari berturut-turut", 30, streakDays, 3),
    ch("streak-7", "Konsisten", "Streak 7 hari", "Catat transaksi 7 hari berturut-turut", 60, streakDays, 7),
    ch("streak-14", "Konsisten", "Streak 14 hari", "Catat transaksi 14 hari berturut-turut", 120, streakDays, 14),
    ch("streak-30", "Konsisten", "Streak 30 hari", "Catat transaksi 30 hari berturut-turut", 250, streakDays, 30),
    ch("tx-10", "Rajin", "10 transaksi", "Total 10 transaksi tercatat", 30, c.tx, 10),
    ch("tx-50", "Rajin", "50 transaksi", "Total 50 transaksi tercatat", 80, c.tx, 50),
    ch("tx-150", "Rajin", "150 transaksi", "Total 150 transaksi tercatat", 150, c.tx, 150),
    ch("tx-500", "Rajin", "500 transaksi", "Total 500 transaksi tercatat", 300, c.tx, 500),
    ch("first-budget", "Rencana", "Budget pertama", "Pasang budget untuk satu kategori", 40, c.budgets, 1),
    ch("first-recurring", "Rencana", "Transaksi rutin", "Jadwalkan satu transaksi rutin (tagihan/gaji)", 40, c.recurring, 1),
    ch("surplus-1", "Hemat", "Surplus 1 bulan", "Pemasukan lebih besar dari pengeluaran selama sebulan penuh", 60, surplusStreakMonths, 1),
    ch("surplus-3", "Hemat", "Surplus 3 bulan", "Surplus 3 bulan berturut-turut", 150, surplusStreakMonths, 3),
    ch("surplus-6", "Hemat", "Surplus 6 bulan", "Surplus 6 bulan berturut-turut", 300, surplusStreakMonths, 6),
    ch("first-saving", "Nabung", "Setoran pertama", "Setor ke salah satu tujuan tabungan", 30, savingsTotal?.n ?? 0, 1),
    ch("saver-1jt", "Nabung", "Nabung Rp1 juta", "Total setoran tabungan Rp1.000.000", 80, totalSavingsIdr / 1_000_000, 1),
    ch("saver-10jt", "Nabung", "Nabung Rp10 juta", "Total setoran tabungan Rp10.000.000", 200, totalSavingsIdr / 1_000_000, 10),
    ch("saver-50jt", "Nabung", "Nabung Rp50 juta", "Total setoran tabungan Rp50.000.000", 400, totalSavingsIdr / 1_000_000, 50),
    ch("first-investment", "Investasi", "Investasi pertama", "Catat satu investasi (saham, emas, deposito, dll)", 50, investmentCount?.c ?? 0, 1),
    ch("investment-3", "Investasi", "3 jenis investasi", "Punya 3 jenis investasi berbeda", 120, c.invTypes, 3),
    ch("debt-free", "Utang", "Bebas utang", "Lunasi semua utang yang pernah dicatat", 150, c.hutangTotal > 0 ? c.hutangTotal - c.hutangOpen : 0, Math.max(1, c.hutangTotal)),
  ];
  const xp = challenges.reduce((sum, x) => sum + (x.done ? x.xp : 0), 0);

  return { streakDays, surplusStreakMonths, badges, challenges, xp, level: levelForXp(xp) };
};

// Tanda tangan upload Cloudinary: hanya user yang login yang bisa upload,
// file masuk folder miliknya, dan format dibatasi ke gambar. Selama secret
// belum dipasang, balas 503 supaya klien kembali ke preset unsigned lama —
// setelah preset di Cloudinary diubah jadi "Signed", hanya jalur ini yang jalan.
const CLOUDINARY_ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic,heif";
async function handleCloudinarySignature(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return json({ error: "Upload bertanda tangan belum dikonfigurasi." }, { status: 503 });
  }
  const userId = authResult.session.user.id;
  if (env.AI_PARSE_RATE_LIMITER) {
    const { success } = await env.AI_PARSE_RATE_LIMITER.limit({ key: `upload-sign:user:${userId}` });
    if (!success) return json({ error: "Terlalu banyak upload. Coba lagi sebentar." }, { status: 429 });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `leosiqra/${userId.replace(/[^\w-]/g, "")}`;
  // Parameter diurutkan alfabetis sesuai aturan tanda tangan Cloudinary.
  const toSign = `allowed_formats=${CLOUDINARY_ALLOWED_FORMATS}&folder=${folder}&timestamp=${timestamp}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign + env.CLOUDINARY_API_SECRET));
  const signature = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    allowedFormats: CLOUDINARY_ALLOWED_FORMATS,
    signature,
  });
}

// Dipanggil aplikasi terpasang (mode standalone) saat dibuka, maksimal
// ±sekali per 12 jam per perangkat. Hanya menyimpan waktu terakhir dibuka per
// aplikasi di users.metadata_json — tidak ada data perangkat yang disimpan.
const APP_OPENED_KEYS: Record<string, string> = { leosiqra: "$.appOpenedLeosiqra", "input-cepat": "$.appOpenedInputCepat" };
async function handleAppOpened(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const payload = await parseJson<{ app?: unknown }>(request);
  const path = typeof payload.app === "string" ? APP_OPENED_KEYS[payload.app] : undefined;
  if (!path) return json({ error: "Aplikasi tidak dikenal." }, { status: 400 });
  await env.DB.prepare(
    `UPDATE users
        SET metadata_json = json_set(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, ?, ?)
      WHERE id = ?`
  )
    .bind(path, nowIso(), authResult.session.user.id)
    .run();
  return json({ ok: true });
}

// ===== Saran & kritik =====
const FEEDBACK_CATEGORIES: Record<string, string> = { saran: "💡 Saran", kritik: "🗣️ Kritik", masalah: "🐞 Masalah", pujian: "❤️ Pujian" };
const FEEDBACK_STATUSES = new Set(["baru", "dibaca", "selesai"]);
const FEEDBACK_MAX_CHARS = 1000;
const FEEDBACK_DAILY_LIMIT = 10;

async function handleCreateFeedback(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const user = authResult.session.user;
  const payload = await parseJson<{ category?: unknown; rating?: unknown; message?: unknown; page?: unknown; platform?: unknown }>(request);

  const category = typeof payload.category === "string" ? payload.category : "";
  if (!FEEDBACK_CATEGORIES[category]) return json({ error: "Pilih jenis masukan." }, { status: 400 });
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (message.length < 5) return json({ error: "Tulis masukanmu minimal 5 karakter." }, { status: 400 });
  if (message.length > FEEDBACK_MAX_CHARS) return json({ error: `Masukan maksimal ${FEEDBACK_MAX_CHARS} karakter.` }, { status: 400 });
  const ratingNum = Number(payload.rating);
  const rating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null;
  const page = typeof payload.page === "string" && payload.page.startsWith("/") ? payload.page.slice(0, 120) : null;
  const platform = payload.platform === "app" ? "app" : "web";

  if (env.AI_PARSE_RATE_LIMITER) {
    const { success } = await env.AI_PARSE_RATE_LIMITER.limit({ key: `feedback:user:${user.id}` });
    if (!success) return json({ error: "Terlalu cepat. Coba lagi sebentar." }, { status: 429 });
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND created_at >= ?")
    .bind(user.id, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= FEEDBACK_DAILY_LIMIT) {
    return json({ error: "Kamu sudah mengirim banyak masukan hari ini. Terima kasih! Coba lagi besok ya." }, { status: 429 });
  }

  const id = generateId();
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO feedback (id, user_id, category, rating, message, page, platform, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?, ?)`
  )
    .bind(id, user.id, category, rating, message, page, platform, now, now)
    .run();

  await sendTelegramNotification(
    env,
    `<b>${FEEDBACK_CATEGORIES[category]} baru</b>${rating ? ` · ${"★".repeat(rating)}${"☆".repeat(5 - rating)}` : ""}\n` +
      `Dari: ${escapeHtml(user.name || "-")} (${escapeHtml(user.email)})\n` +
      (page ? `Halaman: ${escapeHtml(page)} · ${platform}\n` : "") +
      `\n${escapeHtml(message.length > 600 ? message.slice(0, 600) + "…" : message)}`
  );
  return json({ ok: true, id }, { status: 201 });
}

async function handleListMyFeedback(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const { results } = await env.DB.prepare(
    `SELECT id, category, rating, message, status, admin_reply, replied_at, created_at
       FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`
  )
    .bind(authResult.session.user.id)
    .all();
  return json({ items: results ?? [] });
}

async function handleAdminListFeedback(request: Request, env: Env) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) return authResult.error;
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.category, f.rating, f.message, f.page, f.platform, f.status, f.admin_reply, f.replied_at, f.created_at,
            u.name AS user_name, u.email AS user_email
       FROM feedback f LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC LIMIT 300`
  ).all();
  return json({ items: results ?? [] });
}

async function handleAdminUpdateFeedback(request: Request, env: Env, feedbackId: string) {
  const authResult = await requireSession(env, request, "admin");
  if (authResult.error) return authResult.error;
  const payload = await parseJson<{ status?: unknown; reply?: unknown }>(request);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (payload.status !== undefined) {
    if (typeof payload.status !== "string" || !FEEDBACK_STATUSES.has(payload.status)) return json({ error: "Status tidak valid." }, { status: 400 });
    sets.push("status = ?");
    binds.push(payload.status);
  }
  if (payload.reply !== undefined) {
    const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
    if (reply.length > FEEDBACK_MAX_CHARS) return json({ error: `Balasan maksimal ${FEEDBACK_MAX_CHARS} karakter.` }, { status: 400 });
    sets.push("admin_reply = ?", "replied_at = ?");
    binds.push(reply || null, reply ? nowIso() : null);
    // Membalas otomatis menandai masukan sudah ditindaklanjuti.
    if (reply && payload.status === undefined) sets.push("status = 'selesai'");
  }
  if (sets.length === 0) return json({ error: "Tidak ada perubahan." }, { status: 400 });
  const result = await env.DB.prepare(`UPDATE feedback SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
    .bind(...binds, nowIso(), feedbackId)
    .run();
  if (!result.meta.changes) return json({ error: "Masukan tidak ditemukan." }, { status: 404 });
  await insertAdminLog(env, authResult.session.user.email, "FEEDBACK_UPDATE", feedbackId, `Update masukan: ${sets.map((x) => x.split(" ")[0]).join(", ")}`, "indigo");
  return json({ ok: true });
}

async function handleGamification(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const data = await computeUserGamification(env, authResult.session.user.id);
  return json(data);
}

// ===== Goal-based saving otomatis =====
// Sebuah "goal" adalah baris `recurring` bertipe 'Tabungan' (dieksekusi oleh
// processDueRecurringTransactions sebagai setoran otomatis ke tabel `savings`).
// Target total (opsional) disimpan di payload_json — lihat buildRecurringPayloadJson.

type SavingsGoalRow = {
  id: string;
  name: string;
  category: string;
  account_id: string | null;
  amount: number;
  interval: string;
  next_date: string;
  status: string;
  payload_json: string | null;
};

async function handleListSavingsGoals(request: Request, env: Env) {
  const authResult = await requireSession(env, request);
  if (authResult.error) return authResult.error;
  const userId = authResult.session.user.id;

  const { results: goalRows } = await env.DB.prepare(
    `SELECT id, name, category, account_id, amount, interval, next_date, status, payload_json
       FROM recurring
      WHERE user_id = ? AND type = 'Tabungan'
      ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<SavingsGoalRow>();

  // Total tersetor per kategori goal, dihitung dari amount_idr (bukan amount
  // mentah) — konsisten dengan aturan laporan ber-IDR lainnya di codebase ini.
  const { results: totalsRows } = await env.DB.prepare(
    `SELECT category,
            SUM(CASE WHEN transaction_type = 'Penarikan' THEN -1 ELSE 1 END * COALESCE(NULLIF(amount_idr, 0), amount)) as total
       FROM savings
      WHERE user_id = ?
      GROUP BY category`
  )
    .bind(userId)
    .all<{ category: string; total: number }>();
  const totalsByCategory = new Map((totalsRows ?? []).map((r) => [r.category, r.total || 0]));

  const items = (goalRows ?? []).map((row) => {
    let targetAmount: number | null = null;
    if (row.payload_json) {
      try {
        const parsed = JSON.parse(row.payload_json) as { targetAmount?: number };
        targetAmount = typeof parsed.targetAmount === "number" ? parsed.targetAmount : null;
      } catch {
        // payload_json tidak valid JSON — abaikan.
      }
    }
    const currentTotal = totalsByCategory.get(row.category) ?? 0;
    const progressPercent = targetAmount && targetAmount > 0 ? Math.min(100, (currentTotal / targetAmount) * 100) : null;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      accountId: row.account_id,
      monthlyAmount: row.amount,
      interval: row.interval,
      nextDate: row.next_date,
      status: row.status,
      targetAmount,
      currentTotal,
      progressPercent,
    };
  });

  return json({ items });
}

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

// Pengingat tenggat SPT Tahunan (31 Maret) — broadcast ke semua user pada
// tanggal WIB tertentu saja, jadi cukup nebeng cron harian yang sudah ada
// (tidak perlu cron trigger baru) tanpa perlu tabel "sudah lapor/belum".
const TAX_DEADLINE_REMINDERS: Record<string, string> = {
  "02-01": "SPT Tahunan Pajak Penghasilan jatuh tempo 31 Maret. Cek draft otomatis kamu sekarang di Pajak Center — masih ada waktu ~2 bulan buat siap-siap.",
  "03-20": "Tinggal 11 hari lagi menuju batas lapor SPT Tahunan (31 Maret). Cek & siapkan draft di Pajak Center sebelum kena telat lapor.",
};

// ===== Pengingat jatuh tempo kartu kredit (H-3, H-1, hari H), jam 10:00 WIB =====
// Kalkulasi siklus memakai src/lib/creditCycle.ts yang sama dengan frontend
// (Kartu Saya & Dashboard), jadi angka di notifikasi = angka di layar.
const CARD_REMINDER_DAYS = new Set([3, 1, 0]);

const formatMoneyForPush = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: currency || "IDR", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || ""} ${Math.round(amount).toLocaleString("id-ID")}`.trim();
  }
};

const sendCreditCardDueReminders = async (env: Env) => {
  const today = todayWIB();
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, name, currency, balance, payload_json
       FROM accounts
      WHERE type IN ('Credit Card', 'kartu') AND payload_json LIKE '%dueDay%'`
  ).all<{ id: string; user_id: string; name: string; currency: string | null; balance: number; payload_json: string | null }>();

  for (const card of results ?? []) {
    try {
      let settings: CardCycleSettings = {};
      try {
        settings = JSON.parse(card.payload_json || "{}") as CardCycleSettings;
      } catch {
        continue;
      }
      const statementDay = clampCycleDay(settings.statementDay);
      if (!statementDay || !clampCycleDay(settings.dueDay)) continue;
      const used = Math.max(0, -(Number(card.balance) || 0));
      if (used <= 0) continue;

      // Cuma arus SETELAH tanggal cetak terakhir yang memengaruhi tagihan tercetak.
      const since = lastStatementDate(today, statementDay);
      const { results: txs } = await env.DB.prepare(
        `SELECT type, sub_category, amount, date FROM transactions
          WHERE account_id = ? AND user_id = ? AND type != 'debt' AND substr(date, 1, 10) > ?`
      )
        .bind(card.id, card.user_id, since)
        .all<{ type: string; sub_category: string | null; amount: number; date: string }>();
      const flows = (txs ?? []).map((t) => {
        const incoming =
          t.type === "pemasukan" || ((t.type === "transfer" || t.type === "topup") && (t.sub_category ?? "").includes("Masuk"));
        return { date: String(t.date).slice(0, 10), delta: incoming ? -(Number(t.amount) || 0) : Number(t.amount) || 0 };
      });

      const cycle = computeCardCycle(used, flows, settings, today);
      if (!cycle || cycle.amountDue <= 0 || !CARD_REMINDER_DAYS.has(cycle.daysUntilDue)) continue;

      const currency = card.currency || "IDR";
      const when = cycle.daysUntilDue === 0 ? "hari ini" : cycle.daysUntilDue === 1 ? "besok" : `${cycle.daysUntilDue} hari lagi`;
      const [y, m, d] = cycle.dueDate.split("-").map(Number);
      const dueText = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
      await sendWebPushToUser(
        env,
        card.user_id,
        `Tagihan ${card.name} jatuh tempo ${when}`,
        `Tagihan ${formatMoneyForPush(cycle.amountDue, currency)} · minimum ${formatMoneyForPush(cycle.minPayment, currency)} · jatuh tempo ${dueText}.`,
        "/membership/cards"
      );
    } catch (error) {
      console.error("Gagal memproses pengingat kartu kredit", card.id, error);
    }
  }
};

const sendTaxDeadlineReminders = async (env: Env) => {
  const body = TAX_DEADLINE_REMINDERS[todayWIB().slice(5)];
  if (!body) return;
  await sendWebPushToAllUsers(env, "Pengingat SPT Tahunan", body, "/membership/pajak-center");
};

// ===== Job 2: eksekusi recurring yang jatuh tempo hari ini, jam 10:00 WIB =====

type RecurringRow = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  category: string;
  account_id: string | null;
  amount: number;
  interval: string;
  next_date: string;
  note: string | null;
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

// Jadwal yang telat lebih dari ini TIDAK dieksekusi mundur (saldo user bisa
// sudah dicatat manual selama itu) — dilompati ke jadwal berikutnya + notifikasi.
const RECURRING_CATCHUP_DAYS = 3;
const dayDiff = (fromDay: string, toDay: string) =>
  Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);

// Eksekusi beneran: bikin baris transaksi + update saldo rekening (di mata
// uang rekening itu sendiri, tanpa konversi — sama seperti alur input manual/
// Input Cepat), baru kirim notifikasi "sudah tercatat".
//
// Dulu cuma mengambil jadwal yang next_date-nya PERSIS hari ini — sekali cron
// terlewat (gagal/deploy/jadwal dibuat dengan tanggal lampau), jadwal itu
// macet selamanya. Sekarang semua yang jatuh tempo <= hari ini diproses:
// telat <= RECURRING_CATCHUP_DAYS dieksekusi dengan tanggal jatuh temponya,
// yang lebih lama dilompati tanpa menyentuh saldo.
const processDueRecurringTransactions = async (env: Env) => {
  const todayStr = todayWIB();
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, name, type, category, account_id, amount, interval, next_date, note
       FROM recurring
      WHERE status = 'ACTIVE' AND substr(next_date, 1, 10) <= ?`
  )
    .bind(todayStr)
    .all<RecurringRow>();

  for (const row of results ?? []) {
    try {
      const normalizedType = row.type?.toLowerCase();

      if (normalizedType !== "tabungan" && normalizedType !== "pemasukan" && normalizedType !== "pengeluaran") {
        // Jenis lama seperti "Transfer" tidak pernah punya akun tujuan di skema
        // ini — mengeksekusinya sebagai "pengeluaran" akan memotong saldo sumber
        // tanpa ada rekening yang menerima (uang lenyap). Jeda saja jadwalnya
        // dan biarkan user mengubahnya secara sadar.
        await env.DB.prepare("UPDATE recurring SET status = 'PAUSED', updated_at = ? WHERE id = ?")
          .bind(nowIso(), row.id)
          .run();
        console.error(`Recurring ${row.id} punya type tidak didukung ("${row.type}") — dijeda otomatis.`);
        continue;
      }

      let nextDate = row.next_date;

      // 1) Terlalu lama terlewat: lompati ke kemunculan pertama yang masih di
      //    jendela kejar (atau di masa depan) dengan satu UPDATE ber-klaim.
      if (dayDiff(nextDate.slice(0, 10), todayStr) > RECURRING_CATCHUP_DAYS) {
        let target = nextDate;
        let skipped = 0;
        while (dayDiff(target.slice(0, 10), todayStr) > RECURRING_CATCHUP_DAYS && skipped < 5000) {
          target = advanceNextDate(target, row.interval);
          skipped += 1;
        }
        const skip = await env.DB.prepare(
          "UPDATE recurring SET next_date = ?, updated_at = ? WHERE id = ? AND next_date = ? AND status = 'ACTIVE'"
        )
          .bind(target, nowIso(), row.id, nextDate)
          .run();
        if (!skip.meta.changes) continue; // diproses proses lain
        console.warn(`Recurring ${row.id}: ${skipped} jadwal terlewat dilompati (${nextDate.slice(0, 10)} -> ${target.slice(0, 10)}).`);
        try {
          await sendWebPushToUser(
            env,
            row.user_id,
            "Jadwal Berulang Terlewat",
            `${row.name}: ${skipped} jadwal yang sudah lewat tidak dicatat otomatis supaya saldo tidak dobel. Cek & catat manual kalau perlu. Jadwal berikutnya ${target.slice(0, 10)}.`,
            "/membership/recurring"
          );
        } catch (error) {
          console.error(`Notifikasi lompat recurring ${row.id} gagal:`, error);
        }
        nextDate = target;
      }

      // 2) Kejar yang jatuh tempo <= hari ini (maks. beberapa untuk jadwal harian).
      let guard = 0;
      while (nextDate.slice(0, 10) <= todayStr && guard < RECURRING_CATCHUP_DAYS + 2) {
        guard += 1;
        const executed = await executeRecurringOccurrence(env, { ...row, next_date: nextDate }, nextDate.slice(0, 10));
        if (!executed) break;
        nextDate = advanceNextDate(nextDate, row.interval);
      }
    } catch (error) {
      console.error(`Gagal eksekusi recurring ${row.id}:`, error);
      // Batch atomik gagal = tidak ada yang tercatat & next_date tidak maju,
      // jadi bisa di-retry lewat pemicu manual/cron berikutnya tanpa dobel.
      continue;
    }
  }
};

// Satu kemunculan jadwal, atomik + anti-dobel. `occurrenceDay` = tanggal jatuh
// tempo (YYYY-MM-DD) yang dipakai sebagai tanggal transaksi. Return true kalau
// kemunculan ini benar-benar dicatat oleh panggilan ini.
const executeRecurringOccurrence = async (env: Env, row: RecurringRow, occurrenceDay: string): Promise<boolean> => {
  const normalizedType = row.type?.toLowerCase();
  let currency = "IDR";
  if (row.account_id) {
    const acc = await env.DB.prepare("SELECT currency FROM accounts WHERE id = ? AND user_id = ?")
      .bind(row.account_id, row.user_id)
      .first<{ currency: string }>();
    currency = acc?.currency || "IDR";
  }
  const amountIdr = await resolveIdrAmount(currency, row.amount, undefined);
  const now = nowIso();

  // Eksekusi atomik + anti-dobel: statement pertama "mengklaim" jadwal ini
  // (memajukan next_date HANYA kalau masih bernilai lama, sambil menulis
  // token unik ke updated_at). Pencatatan & perubahan saldo di batch yang
  // sama hanya jalan kalau token itu yang tertulis — cron yang di-retry,
  // pemicu admin manual, atau dua worker bersamaan tidak bisa mencatat
  // dua kali. Gagal di tengah = seluruh batch batal (next_date tidak maju,
  // bisa dicoba lagi).
  const claimToken = `${now}#${generateId()}`;
  const claimed = "EXISTS (SELECT 1 FROM recurring WHERE id = ? AND updated_at = ?)";
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      "UPDATE recurring SET next_date = ?, updated_at = ? WHERE id = ? AND next_date = ? AND status = 'ACTIVE'"
    ).bind(advanceNextDate(row.next_date, row.interval), claimToken, row.id, row.next_date),
  ];

  const txId = generateId();
  let pushTitle: string;
  let pushBody: string;
  let pushUrl: string;
  if (normalizedType === "tabungan") {
    // Goal-based saving otomatis: setoran ke pos tabungan (bukan baris
    // `transactions`), memotong saldo akun sumber di mata uangnya sendiri
    // — persis alur manual SavingsModal (Setoran).
    const displayDate = new Date(`${occurrenceDay}T00:00:00Z`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const savingId = generateId();
    statements.push(
      env.DB.prepare(
        `INSERT INTO savings (
           id, user_id, description, amount, amount_idr, currency, category, sub_category,
           from_account, to_goal, transaction_type, date, display_date, created_at, updated_at
         ) SELECT ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'Setoran', ?, ?, ?, ? WHERE ${claimed}`
      ).bind(
        savingId, row.user_id, row.note || `Setoran otomatis: ${row.name}`, row.amount, amountIdr, currency,
        row.category, row.account_id ?? "", row.category, occurrenceDay, displayDate, now, now,
        row.id, claimToken
      )
    );
    if (row.account_id) {
      statements.push(
        env.DB.prepare(`UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ? AND ${claimed}`)
          .bind(row.amount, row.account_id, row.user_id, row.id, claimToken)
      );
    }
    pushTitle = "Setoran Tabungan Otomatis";
    pushBody = `${row.name} (${row.category}) - ${formatCurrencyForPush(row.amount, currency)} berhasil disetor otomatis ke tabungan.`;
    pushUrl = "/membership/tabungan";
  } else {
    const txType = normalizedType;
    statements.push(
      env.DB.prepare(
        `INSERT INTO transactions (
           id, user_id, type, amount, amount_idr, category, currency, account_id,
           date, display_date, note, status, related_id, related_type, created_at, updated_at
         ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, 'recurring', ?, ? WHERE ${claimed}`
      ).bind(
        txId, row.user_id, txType, row.amount, amountIdr, row.category, currency, row.account_id,
        occurrenceDay, occurrenceDay, row.note || `Otomatis dari Recurring: ${row.name}`, row.id, now, now,
        row.id, claimToken
      )
    );
    if (row.account_id) {
      statements.push(
        env.DB.prepare(`UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ? AND ${claimed}`)
          .bind(txType === "pemasukan" ? row.amount : -row.amount, row.account_id, row.user_id, row.id, claimToken)
      );
    }
    pushTitle = "Transaksi Berulang Tercatat";
    pushBody = `${row.name} (${row.category}) - ${formatCurrencyForPush(row.amount, currency)} sudah tercatat otomatis.`;
    pushUrl = "/membership/recurring";
  }

  const batchResults = await env.DB.batch(statements);
  if (!batchResults[0]?.meta.changes) {
    // Sudah dieksekusi oleh proses lain (retry/pemicu manual) — lewati.
    return false;
  }

  try {
    if (normalizedType !== "tabungan") {
      const durableId = env.REALTIME_ROOM.idFromName(`member:${row.user_id}`);
      await env.REALTIME_ROOM.get(durableId).fetch("https://realtime.internal/publish", {
        method: "POST",
        body: JSON.stringify({ event: "transaction.created", payload: { id: txId, userId: row.user_id } }),
      });
    }
    await sendWebPushToUser(env, row.user_id, pushTitle, pushBody, pushUrl);
  } catch (error) {
    console.error(`Notifikasi recurring ${row.id} gagal (transaksi tetap tercatat):`, error);
  }
  return true;
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

      // Kanonis-kan ke www — Search Console melaporkan leosiqra.com (apex)
      // dan www.leosiqra.com sama-sama 200 OK sebagai halaman terpisah tanpa
      // versi kanonis ("Duplikat, tanpa ada versi kanonis pilihan pengguna").
      if ((request.method === "GET" || request.method === "HEAD") && url.hostname === "leosiqra.com") {
        url.hostname = "www.leosiqra.com";
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

      // Kanonis-kan file .html mentah (artefak nama file Next static export)
      // ke URL bersih tanpa ekstensi — Search Console melaporkan
      // /index.html, /privacy.html, /terms.html sebagai halaman "dengan
      // pengalihan"/duplikat terpisah dari versi bersihnya (/, /privacy,
      // /terms) yang dipakai di sitemap & seluruh link internal.
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        url.pathname.endsWith(".html") &&
        !url.pathname.startsWith("/_next/")
      ) {
        const clean = url.pathname === "/index.html" ? "/" : url.pathname.slice(0, -".html".length);
        return Response.redirect(`${url.origin}${clean}${url.search}`, 308);
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

      if (url.pathname === "/api/auth/password/forgot" && request.method === "POST") {
        return await handleForgotPassword(request, env);
      }

      if (url.pathname === "/api/auth/password/reset" && request.method === "POST") {
        return await handleResetPassword(request, env);
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

      if (url.pathname === "/api/auth/google/2fa" && request.method === "POST") {
        return await handleGoogle2fa(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "GET") {
        return await handleListTransactions(request, env);
      }

      if (url.pathname === "/api/member/transactions" && request.method === "POST") {
        return await handleCreateTransaction(request, env);
      }

      if (url.pathname.startsWith("/api/member/debts/") && url.pathname.endsWith("/pay") && request.method === "POST") {
        const debtId = url.pathname.slice("/api/member/debts/".length, -"/pay".length);
        return await handlePayDebt(request, env, debtId);
      }

      if (url.pathname === "/api/member/transfer" && request.method === "POST") {
        return await handleCreateTransfer(request, env);
      }

      if (url.pathname === "/api/member/quick-transaction" && request.method === "POST") {
        return await handleQuickTransaction(request, env);
      }

      if (url.pathname === "/api/member/transactions/import" && request.method === "POST") {
        return await handleImportTransactions(request, env);
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

      if (url.pathname === "/api/member/insights" && request.method === "GET") {
        return await handleListInsights(request, env);
      }

      if (url.pathname === "/api/member/feedback" && request.method === "POST") {
        return await handleCreateFeedback(request, env);
      }
      if (url.pathname === "/api/member/feedback" && request.method === "GET") {
        return await handleListMyFeedback(request, env);
      }
      if (url.pathname.startsWith("/api/market/coingecko/") && request.method === "GET") {
        return await handleCoinGeckoProxy(request, env, url.pathname.slice("/api/market/coingecko/".length));
      }
      if (url.pathname === "/api/promo/script" && request.method === "POST") {
        return await handlePromoScript(request, env);
      }
      if (url.pathname === "/api/promo/history" && (request.method === "GET" || request.method === "PUT")) {
        return await handlePromoHistory(request, env);
      }
      if (url.pathname === "/api/promo/telegram" && request.method === "POST") {
        return await handlePromoTelegram(request, env);
      }
      if (url.pathname === "/api/promo/telegram-hook" && request.method === "POST") {
        return await handlePromoTelegramHook(request, env);
      }
      if (url.pathname === "/api/promo/upload" && request.method === "PUT") {
        return await handlePromoUpload(request, env, url);
      }
      if (url.pathname === "/api/promo/queue" && (request.method === "GET" || request.method === "POST")) {
        return await handlePromoQueue(request, env);
      }
      if (url.pathname.startsWith("/api/promo/media/") && url.pathname.endsWith(".mp4") && (request.method === "GET" || request.method === "HEAD")) {
        return await handlePromoMedia(request, env, url, url.pathname.slice("/api/promo/media/".length, -".mp4".length));
      }
      if (url.pathname === "/api/promo/stats" && request.method === "GET") {
        return await handlePromoStats(request, env);
      }
      if (url.pathname === "/api/promo/draft" && (request.method === "GET" || request.method === "PUT")) {
        return await handlePromoDraft(request, env, url);
      }
      if (url.pathname === "/api/admin/ai-status" && request.method === "GET") {
        return await handleAdminAiStatus(request, env);
      }
      if (url.pathname === "/api/admin/ai-key" && (request.method === "PUT" || request.method === "DELETE")) {
        return await handleAdminAiKey(request, env);
      }
      if (url.pathname === "/api/admin/feedback" && request.method === "GET") {
        return await handleAdminListFeedback(request, env);
      }
      if (url.pathname.startsWith("/api/admin/feedback/") && request.method === "PATCH") {
        return await handleAdminUpdateFeedback(request, env, url.pathname.slice("/api/admin/feedback/".length));
      }

      if (url.pathname === "/api/member/app-opened" && request.method === "POST") {
        return await handleAppOpened(request, env);
      }

      if (url.pathname === "/api/member/onboarding" && request.method === "POST") {
        return await handleCompleteOnboarding(request, env);
      }

      if (url.pathname === "/api/member/uploads/cloudinary-signature" && request.method === "POST") {
        return await handleCloudinarySignature(request, env);
      }

      if (url.pathname === "/api/member/gamification" && request.method === "GET") {
        return await handleGamification(request, env);
      }

      if (url.pathname === "/api/member/savings-goals" && request.method === "GET") {
        return await handleListSavingsGoals(request, env);
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

      if (url.pathname === "/api/member/investments/entry" && request.method === "POST") {
        return await handleInvestmentEntry(request, env);
      }

      {
        const m = /^\/api\/member\/investments\/([^/]+)\/(sell|cairkan|rebook)$/.exec(url.pathname);
        if (m && m[2] === "sell" && request.method === "POST") return await handleInvestmentSell(request, env, m[1]);
        if (m && m[2] === "cairkan" && request.method === "POST") return await handleDepositCairkan(request, env, m[1]);
        if (m && m[2] === "rebook" && request.method === "PUT") return await handleInvestmentRebook(request, env, m[1]);
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

      if (url.pathname === "/api/member/ai/parse-transaction" && request.method === "POST") {
        return await handleParseTransaction(request, env);
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
      // cuma baca data), ?job=recurring untuk EKSEKUSI recurring jatuh tempo
      // (HATI-HATI: ini beneran bikin transaksi + update saldo, sama seperti
      // kalau cron asli jalan — jangan dipanggil sembarangan kalau cron
      // 10:00 WIB hari itu juga aktif, bisa dobel transaksi).
      if (url.pathname === "/api/admin/debug/run-notifications" && request.method === "POST") {
        const authResult = await requireSession(env, request, "admin");
        if (authResult.error) return authResult.error;
        const job = url.searchParams.get("job");
        if (job === "daily") {
          await sendDailySummaryNotifications(env);
        } else if (job === "recurring") {
          await processDueRecurringTransactions(env);
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
    if (event.cron === PROMO_QUEUE_CRON) {
      // Tiap 10 menit: posting video promo yang sudah waktunya + metrik harian.
      // Cabang sendiri supaya TIDAK ikut menjalankan deposito/recurring di bawah.
      ctx.waitUntil(processPromoQueue(env));
      return;
    }
    if (event.cron === "1 17 * * *") {
      // 17:01 UTC = 00:01 WIB (hari berikutnya) — ringkasan kemarin + (kalau
      // tanggalnya cocok) pengingat tenggat SPT Tahunan.
      ctx.waitUntil(sendDailySummaryNotifications(env));
      ctx.waitUntil(sendTaxDeadlineReminders(env));
      return;
    }
    // 03:00 UTC = 10:00 WIB — deposito jatuh tempo + eksekusi recurring hari ini.
    ctx.waitUntil(processMaturedDeposits(env));
    ctx.waitUntil(processDueRecurringTransactions(env));
    ctx.waitUntil(sendCreditCardDueReminders(env));
  },
};

export default worker;

