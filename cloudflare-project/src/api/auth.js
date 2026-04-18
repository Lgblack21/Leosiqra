import { createTwoFactorSetup, hashPassword, verifyPassword, verifyTwoFactor } from "../utils/auth.js";
import { ensureDefaultCurrencies, first, nowIso, run } from "../utils/db.js";
import { badRequest, json, unauthorized } from "../utils/http.js";
import { createSession, revokeSession, logoutCookieHeader } from "../middleware/auth.js";

async function verifyTurnstile(env, token, ipAddress) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  if (ipAddress) form.append("remoteip", ipAddress);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const result = await response.json();
  return !!result.success;
}

export async function handleAuth(request, env, sessionContext) {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/auth/2fa/setup") {
    const body = await request.json();
    if (!body?.email) return badRequest("Email dibutuhkan untuk setup 2FA.");
    return json({ ok: true, data: createTwoFactorSetup(body.email, env.APP_NAME || "Leosiqra") });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    return json({ ok: true, data: sessionContext?.user || null });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await request.json();
    if (!body?.name || !body?.email || !body?.password) return badRequest("Nama, email, dan password wajib diisi.");

    const passesTurnstile = await verifyTurnstile(env, body.turnstileToken, request.headers.get("CF-Connecting-IP"));
    if (!passesTurnstile) return badRequest("Validasi Turnstile gagal.");

    const existing = await first(env, "SELECT id FROM users WHERE email = ? LIMIT 1", body.email.toLowerCase());
    if (existing) return badRequest("Email sudah terdaftar.");

    if (body.twoFactorSecret && body.twoFactorCode) {
      const validTotp = await verifyTwoFactor(body.twoFactorSecret, body.twoFactorCode);
      if (!validTotp) return badRequest("Kode 2FA tidak valid.");
    }

    const userId = crypto.randomUUID();
    const timestamp = nowIso();
    await run(
      env,
      `INSERT INTO users
       (id, email, password_hash, name, whatsapp, role, plan, status, two_factor_secret, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'user', 'FREE', 'GUEST', ?, ?, ?)`,
      userId,
      body.email.toLowerCase(),
      await hashPassword(body.password),
      body.name,
      body.whatsapp || null,
      body.twoFactorSecret || null,
      timestamp,
      timestamp
    );

    await ensureDefaultCurrencies(env, userId);
    const cookie = await createSession(env, { id: userId, role: "user" }, request);
    return json({ ok: true, data: { id: userId, role: "user", email: body.email.toLowerCase(), name: body.name } }, { status: 201, headers: { "set-cookie": cookie } });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await request.json();
    if (!body?.email || !body?.password) return badRequest("Email dan password wajib diisi.");

    const user = await first(
      env,
      "SELECT id, email, password_hash, role, name, photo_url, plan, status, two_factor_secret FROM users WHERE email = ? LIMIT 1",
      body.email.toLowerCase()
    );
    if (!user) return unauthorized("Email atau password salah.");
    if (!(await verifyPassword(body.password, user.password_hash))) return unauthorized("Email atau password salah.");

    if (user.two_factor_secret) {
      if (!body.twoFactorCode) return json({ ok: false, requiresTwoFactor: true }, { status: 202 });
      if (!(await verifyTwoFactor(user.two_factor_secret, body.twoFactorCode))) return unauthorized("Kode 2FA tidak valid.");
    }

    const cookie = await createSession(env, { id: user.id, role: user.role }, request);
    return json({ ok: true, data: { id: user.id, email: user.email, role: user.role, name: user.name, photoUrl: user.photo_url, plan: user.plan, status: user.status } }, { headers: { "set-cookie": cookie } });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    if (sessionContext?.sessionId) await revokeSession(env, sessionContext.sessionId);
    return json({ ok: true }, { headers: { "set-cookie": logoutCookieHeader() } });
  }

  return null;
}
