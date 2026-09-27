---
name: security-check
description: Audit keamanan untuk repo Leosiqra (Next.js static export + satu Cloudflare Worker di cloudflare/src/index.ts, D1 raw SQL, sesi cookie). Pakai skill ini setiap kali user minta "security check", "cek keamanan", "audit security", "ada celah gak", "aman gak kalau di-deploy", minta review keamanan sebelum deploy, atau setelah menambah/mengubah endpoint API, alur login/register/reset password, upload file, fitur admin, cron, atau apa pun yang menyentuh saldo/uang — bahkan kalau user tidak menyebut kata "security" secara eksplisit.
---

# Security check — Leosiqra

Leosiqra menyimpan data keuangan asli user, jadi satu celah auth atau IDOR
berarti orang lain bisa baca/ubah uang orang. Skill ini adalah alur audit yang
berulang: pemindai otomatis untuk hal mekanis, lalu review manual untuk hal
yang butuh nalar, lalu verifikasi yang AMAN (tidak pernah menyerang produksi).

Arsitektur yang perlu diingat:
- Semua API ada di `cloudflare/src/index.ts` (routing manual `if (url.pathname ...)`).
- Auth = cookie `leosiqra_session` (HMAC) → `requireSession(env, request, role?)`.
  User ID **selalu** dari `authResult.session.user.id`, tidak pernah dari body/query.
- D1 tanpa ORM — semua query raw `env.DB.prepare(...)`. Isolasi data antar user
  sepenuhnya bergantung pada `WHERE ... user_id = ?` di tiap query.
- Frontend static export (`output: "export"`): `middleware.ts` TIDAK jalan;
  proteksi halaman cuma di client — keamanan sesungguhnya harus di Worker.
- Skema produksi ada di `cloudflare/schema-production.sql` (sering tertinggal
  beberapa kolom dari produksi asli — lihat Jebakan).

## Alur kerja

### 1. Tentukan cakupan

- **Default — perubahan terbaru**: audit yang berubah sejak commit terakhir di
  `origin/main` plus yang belum di-commit:
  `git diff origin/main --stat` dan `git status --short`. Fokus ke file itu,
  tapi ikuti alurnya ke fungsi yang dipanggil.
- **Audit penuh**: kalau user minta "full", "semua", atau sebelum rilis besar —
  jalani seluruh checklist.

Sebutkan cakupan yang dipilih di awal laporan supaya user tahu apa yang tidak dicek.

### 2. Jalankan pemindai

```bash
python3 .claude/skills/security-check/scripts/scan.py          # ringkasan
python3 .claude/skills/security-check/scripts/scan.py --json   # untuk diolah
```

Pemindai mencari: route member/admin tanpa `requireSession`, route admin tanpa
cek role, SQL ke tabel milik user tanpa `user_id`, SQL dengan interpolasi `${}`,
error mentah/field `debug` di response, secret ter-hardcode (termasuk di
`[vars]` wrangler.toml), dan pola frontend berbahaya.

Hasilnya **kandidat**, bukan vonis. Triase tiap kandidat dengan membaca kodenya:
- `sql-tanpa-user_id` aman kalau id-nya berasal dari query lain yang sudah
  ber-`user_id`, dari token acak (sesi/reset), atau fungsinya cron/admin. BUG kalau
  id-nya dari `url`/body request.
- `sql-interpolasi` aman kalau isi `${}` cuma nama kolom/klausa dari whitelist
  kode (mis. `assignments` dari `allowed`), BUG kalau ada nilai dari request.
- `dangerouslySetInnerHTML` aman kalau isinya konstanta atau sudah disanitasi;
  berisiko kalau isinya dari AI, input user, atau pengaturan admin yang di-render ke user lain.

Sebelum mentriase, baca `references/triaged.md` — daftar kandidat yang sudah
pernah dicek (aman / temuan terbuka / belum ditriase). Yang tercatat aman dan
kodenya tidak berubah cukup disebut singkat "sudah ditriase, aman"; jangan
hilangkan diam-diam. Di akhir audit, perbarui file itu dengan hasil triase baru.

### 3. Review manual

Baca `references/checklist.md` dan jalani bagian yang relevan dengan cakupan.
Checklist itu memuat area yang tidak bisa ditangkap pemindai (alur auth, IDOR
lewat id dari request, mutasi saldo, enumerasi akun, Host header, upload, AI,
cron) plus pola celah yang **pernah benar-benar terjadi** di repo ini — itu
prioritas pertama karena pola yang sama cenderung muncul lagi.

### 4. Verifikasi temuan dengan aman

Temuan serius harus dibuktikan, bukan ditebak — tapi JANGAN pernah mencoba
eksploit ke produksi atau ke akun user asli (mis. mencoba register ulang email
user sungguhan untuk "ngetes" takeover).

- Jalankan Worker lokal di atas D1 lokal berisi skema produksi dan data dummy:
  lihat bagian "Verifikasi lokal" di `references/checklist.md`.
- Query produksi hanya boleh read-only dan hanya agregat/jumlah (mis. "berapa
  akun yang rentan"), bukan membaca isi data pribadi user.

### 5. Laporkan

Tulis dalam Bahasa Indonesia santai-teknis (sesuai CLAUDE.md), dengan format:

```
## Security check — <cakupan> (<tanggal>)

Ringkasan: <1–2 kalimat: ada celah kritis atau tidak>

| # | Tingkat | Temuan | Lokasi |
|---|---|---|---|
| 1 | 🔴 Kritis | ... | [file.ts:123](path#L123) |

### 1. <judul temuan>
- **Dampak:** siapa bisa melakukan apa ke data siapa
- **Skenario:** langkah konkret penyerang
- **Bukti:** hasil verifikasi lokal / baris kode
- **Perbaikan:** usulan konkret

Sudah ditriase & aman: <daftar singkat kandidat pemindai yang aman + alasannya>
Tidak dicek: <yang di luar cakupan>
```

Tingkat: 🔴 Kritis (bisa akses/ubah data user lain, ambil alih akun, bocor
secret), 🟠 Tinggi (butuh kondisi khusus, atau bocor info sensitif), 🟡 Sedang
(hardening, defense-in-depth), ⚪ Info.

### 6. Perbaikan

Jangan memperbaiki diam-diam. Setelah laporan, tawarkan perbaikan untuk
temuan 🔴/🟠 dulu. Kalau user setuju: perbaiki minimal, verifikasi ulang di
lokal (tunjukkan serangan yang sama sekarang gagal), jalankan tsc/build, dan
deploy hanya setelah user bilang "gas" (aturan CLAUDE.md). Celah kritis yang
sudah live di produksi: sebutkan di awal pesan, jangan ditunda ke akhir.

## Jebakan di lingkungan ini

- **zsh tidak memecah variabel jadi argumen.** `CMD="npx tsc --noEmit"; $CMD`
  gagal diam-diam ("command not found") dan hitungan error jadi 0 palsu. Pakai
  function shell (`tsw() { npx tsc ... "$@"; }`) atau tulis perintah langsung.
  Hal sama untuk `set -- $var` — tidak memecah di zsh.
- **Node dari nvm** tidak ada di PATH default: `export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH`.
- **Typecheck Worker** (tidak ikut `tsc` root):
  `npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --lib es2022,webworker cloudflare/src/index.ts cloudflare-env.d.ts`
  — sudah ada ±27 error bawaan (tipe sesi, `caches.default`, web push). Bandingkan
  jumlah/isi error sebelum vs sesudah, jangan cuma lihat angka mentah.
- **Skema dump tertinggal kolom** dari produksi: `savings.transaction_type`,
  `categories.sort_order`, `investments.maturity_action`, `investments.related_investment_id`.
  Tambahkan dengan `ALTER TABLE` di D1 lokal sebelum tes.
- **`pkill -f <pola>`** bisa ikut membunuh shell yang menjalankannya (pola ada
  di command line shell itu sendiri). Simpan PID dari `$!` lalu `kill` PID itu.
- **GET ke Worker lokal lewat http di-redirect 301 ke https** — itu perilaku
  produksi yang disengaja, bukan bug; tes endpoint pakai POST/PUT/DELETE atau baca D1 langsung.
- **Akses `wrangler d1 execute --remote` bisa diblokir mode auto** Claude Code.
  Kalau diblokir, berikan query read-only ke user untuk dijalankan sendiri.
