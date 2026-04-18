import { clearSessionCookie, hashIpAddress, makeSessionCookie, parseCookies, signSessionToken, verifySessionToken } from "../utils/auth.js";
import { first, nowIso, run } from "../utils/db.js";
import { forbidden, unauthorized } from "../utils/http.js";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14;

export async function getSessionContext(request, env) {
  const token = parseCookies(request).session;
  if (!token || !env.SESSION_SECRET) return null;

  const payload = await verifySessionToken(env.SESSION_SECRET, token);
  if (!payload?.sid || !payload?.uid) return null;

  const session = await first(
    env,
    `SELECT s.id as session_id, s.expires_at, s.user_id, s.role, u.email, u.name, u.photo_url, u.plan, u.status
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL LIMIT 1`,
    payload.sid,
    payload.uid
  );
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;

  await run(env, "UPDATE sessions SET last_seen_at = ? WHERE id = ?", nowIso(), payload.sid);
  return {
    sessionId: payload.sid,
    user: {
      id: session.user_id,
      role: session.role,
      email: session.email,
      name: session.name,
      photoUrl: session.photo_url,
      plan: session.plan,
      status: session.status
    }
  };
}

export async function createSession(env, user, request) {
  const sessionId = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000).toISOString();
  const ipHash = await hashIpAddress(request.headers.get("CF-Connecting-IP"));
  const userAgent = request.headers.get("user-agent");

  await run(
    env,
    "INSERT INTO sessions (id, user_id, role, user_agent, ip_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    sessionId,
    user.id,
    user.role,
    userAgent,
    ipHash,
    expiresAt,
    createdAt,
    createdAt
  );

  const token = await signSessionToken(env.SESSION_SECRET, {
    sid: sessionId,
    uid: user.id,
    role: user.role,
    exp: Date.parse(expiresAt)
  });
  return makeSessionCookie(token, SESSION_DURATION_SECONDS);
}

export async function revokeSession(env, sessionId) {
  if (!sessionId) return;
  await run(env, "UPDATE sessions SET revoked_at = ? WHERE id = ?", nowIso(), sessionId);
}

export async function requireAdmin(request, env) {
  const context = await getSessionContext(request, env);
  if (!context) return unauthorized("Login admin dibutuhkan.");
  if (context.user.role !== "admin") return forbidden("Akses admin dibutuhkan.");
  return context;
}

export function logoutCookieHeader() {
  return clearSessionCookie();
}
