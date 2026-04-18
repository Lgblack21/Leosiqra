const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => BASE32_ALPHABET[value % BASE32_ALPHABET.length]).join("");
}

function base32ToBytes(secret) {
  const clean = secret.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const output = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    output.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(output);
}

async function hotp(secret, counter, digits = 6) {
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);

  const key = await crypto.subtle.importKey(
    "raw",
    base32ToBytes(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, "0");
}

export async function verifyTotp(secret, token, options = {}) {
  if (!secret || !/^\d{6}$/.test(token || "")) return false;
  const step = options.step ?? 30;
  const digits = options.digits ?? 6;
  const window = options.window ?? 1;
  const currentCounter = Math.floor(Date.now() / 1000 / step);

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = await hotp(secret, currentCounter + offset, digits);
    if (candidate === token) return true;
  }
  return false;
}

export function buildOtpAuthUrl({ issuer, email, secret }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const safeIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}
