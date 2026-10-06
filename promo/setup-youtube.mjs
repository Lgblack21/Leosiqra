// Sekali saja: ambil refresh token YouTube (channel Leosiqra) untuk posting
// otomatis. Jalankan di laptop (butuh browser):
//
//   YT_CLIENT_ID=… YT_CLIENT_SECRET=… node setup-youtube.mjs
//
// Membuka halaman login Google; pilih akun/channel Leosiqra lalu izinkan.
// Hasil disimpan ke promo/.youtube.env (gitignore) — tidak dicetak. Lalu:
//   cd .. && for k in YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN; do
//     grep "^$k=" promo/.youtube.env | cut -d= -f2- | npx wrangler secret put $k; done
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Butuh YT_CLIENT_ID dan YT_CLIENT_SECRET (OAuth client tipe Desktop dari Google Cloud Console).");
  process.exit(1);
}

const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const redirect = `http://127.0.0.1:${server.address().port}`;
const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.search = new URLSearchParams({
  client_id: id,
  redirect_uri: redirect,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log("Membuka browser untuk login Google…\nKalau tidak terbuka, buka link ini manual:\n" + auth.href);
spawn("xdg-open", [auth.href], { stdio: "ignore", detached: true }).on("error", () => {});

const code = await new Promise((resolve, reject) => {
  server.on("request", (req, res) => {
    const u = new URL(req.url, redirect);
    const c = u.searchParams.get("code");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(c ? "<h2>Berhasil ✅ — kembali ke terminal.</h2>" : `<h2>Gagal: ${u.searchParams.get("error") || "tanpa kode"}</h2>`);
    if (c) resolve(c);
    else reject(new Error(u.searchParams.get("error") || "tanpa kode"));
  });
});
server.close();

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
});
const tok = await res.json();
if (!tok.refresh_token) {
  console.error("Tidak dapat refresh token:", tok.error_description || tok.error || res.status);
  process.exit(1);
}
// Cek channel yang terhubung (supaya tidak salah akun).
const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
const name = ch.items?.[0]?.snippet?.title || "(tidak terbaca)";
writeFileSync(join(import.meta.dirname, ".youtube.env"), `YT_CLIENT_ID=${id}\nYT_CLIENT_SECRET=${secret}\nYT_REFRESH_TOKEN=${tok.refresh_token}\n`, { mode: 0o600 });
console.log(`✅ Terhubung ke channel: ${name}\nTersimpan di promo/.youtube.env — lanjutkan perintah wrangler secret put di atas.`);
