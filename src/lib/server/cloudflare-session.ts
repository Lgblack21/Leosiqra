import { cookies } from "next/headers";

export type SessionRole = "admin" | "user";

export async function getCloudflareSessionSnapshot() {
  const cookieStore = await cookies();
  const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "leosiqra_session";
  const roleCookieName = `${sessionCookieName}_role`;

  return {
    sessionToken: cookieStore.get(sessionCookieName)?.value ?? null,
    role: (cookieStore.get(roleCookieName)?.value as SessionRole | undefined) ?? null,
  };
}

export async function hasCloudflareSession() {
  const snapshot = await getCloudflareSessionSnapshot();
  return Boolean(snapshot.sessionToken);
}

export async function requireCloudflareRole(role: SessionRole) {
  const snapshot = await getCloudflareSessionSnapshot();
  return snapshot.role === role;
}
