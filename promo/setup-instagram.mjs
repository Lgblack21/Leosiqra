// Sekali saja: verifikasi token Instagram (API with Instagram Login) untuk
// posting Reels otomatis, ambil IG_USER_ID, dan perpanjang token ke 60 hari.
//
//   node setup-instagram.mjs        (token ditempel saat diminta, tidak tampil)
//
// Hasil disimpan ke promo/.instagram.env (gitignore). Lalu:
//   cd .. && for k in IG_USER_ID IG_ACCESS_TOKEN; do
//     grep "^$k=" promo/.instagram.env | cut -d= -f2- | npx wrangler secret put $k; done
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const ask = (q) =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(q) ? s : "");
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write("\n");
      resolve(a.trim());
    });
  });

let token = process.env.IG_ACCESS_TOKEN || (await ask("Tempel access token Instagram lalu Enter: "));
if (!token) process.exit(1);
const api = "https://graph.instagram.com/v23.0";

const me = await (await fetch(`${api}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(token)}`)).json();
if (me.error || !me.user_id) {
  console.error("Token ditolak Instagram:", me.error?.message || "tanpa user_id");
  process.exit(1);
}
if (!/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(me.account_type || "")) {
  console.error(`Akun @${me.username} bertipe ${me.account_type} — ubah dulu ke akun Profesional (Creator/Bisnis) di aplikasi Instagram.`);
  process.exit(1);
}
// Perpanjang (berlaku 60 hari; Worker memperpanjang sendiri tiap ±20 hari).
const ref = await (await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`)).json();
if (ref.access_token) token = ref.access_token;
writeFileSync(join(import.meta.dirname, ".instagram.env"), `IG_USER_ID=${me.user_id}\nIG_ACCESS_TOKEN=${token}\n`, { mode: 0o600 });
console.log(`✅ Terhubung ke @${me.username} (${me.account_type}).\nTersimpan di promo/.instagram.env — lanjutkan perintah wrangler secret put di atas.`);
