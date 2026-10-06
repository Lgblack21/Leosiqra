// Sekali saja (setelah Worker ter-deploy): daftarkan webhook bot Telegram ke
// /api/promo/telegram-hook supaya tombol rating 🔥/👍/👎 & balasan catatan
// sampai ke Worker. Token tidak pernah dicetak.
//
//   TELEGRAM_BOT_TOKEN=… PROMO_SECRET=… node setup-webhook.mjs
//   (opsional HOOK_BASE; default alamat workers.dev — www.leosiqra.com
//   menantang IP datacenter, termasuk server Telegram)
import { createHash } from "node:crypto";

const { TELEGRAM_BOT_TOKEN: token, PROMO_SECRET: secret } = process.env;
if (!token || !secret || secret.length < 32) {
  console.error("Butuh TELEGRAM_BOT_TOKEN dan PROMO_SECRET (≥32 karakter) di environment.");
  process.exit(1);
}
const base = process.env.HOOK_BASE || "https://membersite-leosiqra.leowendry.workers.dev";
// Sama dengan promoHookToken() di cloudflare/src/index.ts.
const secretToken = createHash("sha256").update(`tg-hook:${secret}`).digest("hex");

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${base}/api/promo/telegram-hook`,
    secret_token: secretToken,
    allowed_updates: ["callback_query", "message"],
    drop_pending_updates: true,
  }),
});
const data = await res.json();
console.log(data.ok ? `Webhook terpasang → ${base}/api/promo/telegram-hook` : `Gagal: ${data.description}`);
const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
console.log(`Status: pending ${info.result?.pending_update_count ?? "?"}, error terakhir: ${info.result?.last_error_message || "-"}`);
