import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from "./totp.js";

function toBase64Url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(password, iterations = 210000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
  return `pbkdf2$${iterations}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(password, storedHash) {
  const [scheme, iterationsRaw, saltEncoded, expectedEncoded] = (storedHash || "").split("$");
  if (scheme !== "pbkdf2") return false;
  const iterations = Number.parseInt(iterationsRaw, 10);
  const salt = fromBase64Url(saltEncoded);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
  return safeEqual(toBase64Url(new Uint8Array(derivedBits)), expectedEncoded);
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(/;\s*/)
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export async function signSessionToken(secret, payload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(await hmac(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  const expected = toBase64Url(await hmac(secret, encodedPayload));
  if (!safeEqual(expected, signature)) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function makeSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 14) {
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0";
}

export async function hashIpAddress(ipAddress) {
  if (!ipAddress) return null;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ipAddress)));
  return toBase64Url(digest);
}

export function createTwoFactorSetup(email, issuer) {
  const secret = generateTotpSecret();
  return { secret, otpauthUrl: buildOtpAuthUrl({ issuer, email, secret }) };
}

export async function verifyTwoFactor(secret, token) {
  return verifyTotp(secret, token);
}
