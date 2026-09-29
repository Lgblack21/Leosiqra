# Brief harian — Claude Code sebagai kreator video Leosiqra

Kamu jalan otomatis tiap pagi (Claude Code routine, tanpa manusia). Tugasmu:
bikin **1 video promo vertikal baru** untuk Instagram Reels (@leosiqra_official)
dan YouTube Shorts (Leosiqra), lalu kirim ke Telegram pemilik. Tidak ada yang
bisa ditanya — ambil keputusan sendiri, tapi patuhi aturan di bawah.

Video harus **beda dari hari-hari sebelumnya**, menarik (bikin orang berhenti
scroll di 2 detik pertama), dan terasa dibuat dengan niat — kamu yang jadi
sutradara, penulis naskah, dan motion designer-nya.

## Aturan keras (jangan dilanggar)

- Klaim tentang Leosiqra HANYA dari `promo/content.mjs` (`FEATURES`, `OFFER`):
  "Coba gratis 14 hari, tanpa kartu kredit", Android/iPhone/web. Jangan mengarang
  fitur, harga, jumlah pengguna, testimoni, atau penghargaan.
- Angka hitung-hitungan harus benar secara matematika. Cek ulang.
- Jangan sebut/menampilkan merek lain (bank, e-wallet, toko, app pesaing).
- Bahasa Indonesia santai anak muda, sopan, tanpa SARA/politik/konten sensitif.
- Musik tetap dari `music.mjs` (sintetis, bebas hak cipta). Jangan unduh musik/
  gambar/video dari internet — semua visual dibuat di `stage.html`.
- Jangan commit/push apa pun, jangan ubah kode aplikasi (`src/`, `cloudflare/`),
  jangan menampilkan isi `PROMO_SECRET` di log/pesan.
- Maksimal 1 video terkirim per run.

## Langkah

### 0. Siapkan alat (sekali per run)
```bash
cd promo
npm ci --no-audit --no-fund
npx playwright install --with-deps chromium
pip install -q edge-tts==7.2.8
(command -v ffmpeg || (sudo apt-get install -y -qq ffmpeg || apt-get install -y -qq ffmpeg)) >/dev/null 2>&1 \
  || { npm i --no-save ffmpeg-static && export FFMPEG_PATH=$(node -p "require('ffmpeg-static')"); }
(apt-get install -y -qq fonts-noto-color-emoji || sudo apt-get install -y -qq fonts-noto-color-emoji) >/dev/null 2>&1 || true
```
`PROMO_SECRET` sudah ada di environment. `PROMO_API_URL` default `https://www.leosiqra.com`.
Kalau `python3` bukan yang punya edge-tts, set `PYTHON=` ke interpreter yang benar.

### 1. Baca riwayat
```bash
curl -s -H "x-promo-secret: $PROMO_SECRET" https://www.leosiqra.com/api/promo/history
```
Lihat ±30 entri terakhir (format, topic, hook, palette, style, screens). Pilih
konsep yang **tidak** mengulang topik/hook, dan gaya visual (palette +
background + transisi) yang berbeda dari 3 video terakhir.

### 2. Tentukan konsep & tulis naskah
Bebas pilih format (hitung-hitungan, pamer fitur, tips, POV/relatable, mitos vs
fakta, kuis, before/after, "3 tanda kamu…", tantangan 7 hari, dll.) atau
format baru. Tulis `promo/out/script.json`:

```json
{
  "format": "pov", "topic": "…",
  "style": { "palette": "sunset", "background": "rays", "transition": "flip", "subtitle": "karaoke", "font": "Poppins",
             "music": { "bpm": 110 } },
  "scenes": [
    { "type": "hook", "text": "maks 6 kata", "emoji": "🫠", "say": "…" },
    { "type": "number", "label": "…", "prefix": "Rp", "to": 9125000, "suffix": "", "say": "…" },
    { "type": "list", "title": "…", "items": ["…", "…", "…"], "say": "…" },
    { "type": "mythfact", "myth": "…", "fact": "…", "say": "…" },
    { "type": "quiz", "question": "…", "options": ["…", "…", "…"], "answer": 1, "say": "…" },
    { "type": "phone", "screen": "quick|scan|voice|ai|savings|budget|debt|level|stats|market|recurring|tax", "text": "…", "say": "…" },
    { "type": "cta", "text": "…", "say": "Coba gratis empat belas hari… follow…" }
  ],
  "caption": "1–3 kalimat + emoji + ajakan komentar/simpan",
  "hashtags": ["#…", "…"]
}
```
- 4–6 scene, pertama `hook`, terakhir `cta`. `say` = yang diucapkan voice-over
  (angka ditulis dengan kata, maks 25 kata/scene, total ≤ 75 kata).
- Pilihan gaya ada di `plan.mjs` (`PALETTES`, `BACKGROUNDS`, `FONTS`,
  `TRANSITIONS`, `SUBTITLE_STYLES`); `palette` juga boleh objek warna sendiri
  (`bg1,bg2,accent,pop,text,card,ink`) asal kontrasnya bagus.

### 3. (Dianjurkan) Tambah sesuatu yang baru
Supaya video tidak terasa template, boleh tambah scene type, layar HP, background,
atau efek baru di `stage.html` (daftarkan juga di `SCENE_TYPES`/`SCREENS` +
`normalizeScript` di `plan.mjs`). Aturan mesin animasi: semua gerak lewat
`A()` (Web Animations ter-pause) atau `T()` (fungsi waktu) — tanpa CSS
animation/transition, tanpa `Math.random()`/`Date.now()` saat render, tanpa
gambar dari internet. Layar HP = "Ilustrasi · data contoh", tampilkan fitur
sesuai `FEATURES`. Area aman: konten utama di y 280–1450 px, jangan taruh
teks penting di 380 px terbawah / 140 px kanan (tertutup UI Reels/Shorts).

### 4. Render uji & periksa sendiri (wajib)
```bash
PROMO_SCRIPT_FILE=out/script.json node make.mjs --no-send   # catat angka "seed" di log
F=${FFMPEG_PATH:-ffmpeg}
$F -loglevel error -y -i out/leosiqra-promo.mp4 -vf "fps=1,scale=270:480,tile=8x4" -frames:v 1 out/sheet.jpg
$F -i out/leosiqra-promo.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep " I:"
```
Buka `out/sheet.jpg` (dan frame penuh `out/cover.jpg` + beberapa frame di momen
penting, mis. `-ss 3.2 -frames:v 1 out/f.jpg`) dengan Read, lalu cek:
teks terpotong/keluar layar, elemen bertumpuk, frame kosong saat transisi,
kontras subtitle, salah ketik, handle @leosiqra_official & YouTube Leosiqra
tampil, angka benar, durasi 15–35 dtk, loudness ±-14 LUFS. Perbaiki lalu render
ulang — maksimal 3 putaran.

### 5. Kirim
Render final + kirim ke Telegram + simpan riwayat (pakai seed yang sama):
```bash
PROMO_SEED=<seed> PROMO_SCRIPT_FILE=out/script.json node make.mjs
```
Kalau gagal total setelah usaha wajar, kirim kabar singkat:
```bash
curl -s -H "x-promo-secret: $PROMO_SECRET" -F "text=⚠️ Video promo hari ini gagal: <alasan singkat>" https://www.leosiqra.com/api/promo/telegram
```

### 6. Ringkasan
Akhiri dengan ringkasan singkat: konsep, format/topik, gaya, hal baru yang kamu
tambahkan, hasil QA, dan status pengiriman.
