// Panggilan ke Worker Leosiqra dari mesin pembuat video (GitHub Actions /
// Claude Code routine). www.leosiqra.com ada di belakang proteksi bot
// Cloudflare yang menantang IP datacenter ("Just a moment…", 403), jadi kalau
// kena tantangan, ulangi lewat alamat workers.dev (tidak lewat proteksi zona).
const WORKERS_DEV = "https://membersite-leosiqra.leowendry.workers.dev";

const isChallenge = (res) => res.status === 403 && (res.headers.get("content-type") || "").includes("text/html");

export const promoFetch = async (path, init = {}) => {
  const bases = [...new Set([process.env.PROMO_API_URL || "https://www.leosiqra.com", WORKERS_DEV])];
  const headers = { ...(init.headers || {}), "x-promo-secret": process.env.PROMO_SECRET || "" };
  let last;
  for (const base of bases) {
    last = await fetch(`${base}${path}`, { ...init, headers });
    if (!isChallenge(last)) return last;
    console.warn(`${base} menantang (proteksi bot), coba alamat lain…`);
  }
  return last;
};
