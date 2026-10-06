# Brief harian — Tim Konten AI Leosiqra (3 sesi per hari kerja)

Kamu "Tim Konten" Leosiqra yang jalan otomatis (Claude Code routine, tanpa
manusia). Satu hari kerja = **1 video promo vertikal** untuk Instagram Reels
(@leosiqra_official) dan YouTube Shorts (Leosiqra), dikerjakan pelan-pelan di
**3 sesi** dan dikirim ke Telegram pemilik **sebelum 17:00 WIB**. Jangan
buru-buru — tiap sesi fokus bikin bagian itu sebagus mungkin.

| Sesi (WIB) | Peran | Hasil di draft |
|---|---|---|
| 08:30 | Ide & Analisis | `stage: "ide"` + konsep terpilih + shot list |
| 11:30 | Naskah & Review | `stage: "naskah"` + `script` (format script.json) |
| 14:30 | Produksi & Kirim | render, QA, kirim ±16:30, `stage: "terkirim"` |

Cek jam WIB (`TZ=Asia/Jakarta date`) untuk tahu kamu sesi yang mana. Kalau
draft hari ini tertinggal (mis. sesi pagi gagal), kerjakan tahap yang belum
ada dulu — tapi tetap maksimal 1 video terkirim per hari: kalau draft sudah
`terkirim`, berhenti.

**Baca juga `promo/TEAMS.md`**: otak tiap tim (belajar dari hasil nyata) dan
sinkronisasi ke LGBLACK Tower (kantor 3D Bos). Setiap sesi WAJIB: baca otak
tim → kerja → tulis pelajaran + status ke Tower.

## Aturan keras (jangan dilanggar)

- Klaim tentang Leosiqra HANYA dari `promo/content.mjs` (`FEATURES`, `OFFER`):
  "Coba gratis 14 hari, tanpa kartu kredit", Android/iPhone/web. Jangan mengarang
  fitur, harga, jumlah pengguna, testimoni, atau penghargaan.
- Angka hitung-hitungan harus benar secara matematika. Cek ulang.
- Jangan sebut/menampilkan merek lain (bank, e-wallet, toko, app pesaing).
- Bahasa Indonesia santai anak muda, sopan, tanpa SARA/politik/konten sensitif.
- Musik tetap dari `music.mjs` (sintetis, bebas hak cipta). Jangan unduh musik/
  gambar/video dari internet — visual dibuat di `stage.html` + rekaman aplikasi
  asli dari akun demo.
- Jangan commit/push apa pun, jangan ubah kode aplikasi (`src/`, `cloudflare/`),
  jangan menampilkan isi `PROMO_SECRET`, `OPENAI_API_KEY`, `DEMO_PASSWORD` di log/pesan.
- Akun demo hanya untuk direkam: jangan ubah profil/password/data massal-nya.
- JANGAN pernah mematikan/mengosongkan `OPENAI_API_KEY`, `DEMO_EMAIL`,
  `DEMO_PASSWORD` (mis. `env -u …`) untuk "mempercepat" atau menghindari error.
  Suara manusia & rekaman asli adalah inti video. Kalau OpenAI/rekaman gagal,
  pipeline sudah otomatis pakai cadangan — biarkan, lalu laporkan penyebabnya
  (pesan error dari log, tanpa nilai secret) di ringkasan.
- Maksimal 1 video terkirim per hari.

## Alat bersama

```bash
API=https://membersite-leosiqra.leowendry.workers.dev
H="x-promo-secret: $PROMO_SECRET"
D=$(TZ=Asia/Jakarta date +%F)
curl -s -H "$H" "$API/api/promo/history"                      # riwayat (+ rating & catatan pemilik)
curl -s -H "$H" "$API/api/promo/draft?key=draft-$D"            # draft hari ini → {"data": …|null}
curl -s -H "$H" "$API/api/promo/draft?key=playbook"            # pelajaran jangka panjang
# simpan draft (SELALU kirim objek lengkap, bukan potongan):
curl -s -X PUT -H "$H" -H "content-type: application/json" --data @draft.json "$API/api/promo/draft?key=draft-$D"
#   draft.json = {"data": {"stage": "...", "concept": {...}, "script": {...}, "notes": [...]}}
cd promo && npm ci --no-audit --no-fund && PROMO_SECRET=$PROMO_SECRET node lessons.mjs   # ringkasan rating → out/lessons.md
```

## Sesi 1 — 08:30 Ide & Analisis

1. Baca riwayat ±30 entri terakhir + `out/lessons.md` + playbook. **Rating dan
   catatan pemilik adalah sinyal terpenting** — ikuti yang 🔥, hindari pola 👎,
   patuhi catatannya.
2. Tulis **5 ide** berbeda (format, topik, hook 2 detik pertama, fitur yang
   dipamerkan, shot rekaman).
3. Pakai topi **Tim Analisis**: beri skor 1–10 untuk tiap ide (kekuatan hook,
   relevansi buat anak muda Indonesia, beda dari 3 video terakhir, cocok
   dengan pelajaran rating). Pilih 1, tulis alasannya.
4. Susun shot list. Utamakan **rekaman aplikasi asli** (scene `device`, minimal
   1, idealnya 2). Video 2D murni (tanpa `device`) boleh, tapi maks 1 dari 5
   video terakhir (`kind` di riwayat; `plan.mjs` juga memaksa ini).
5. **Senin saja — Tim Promosi**: kampanye minggu ini (tema, seri 5 video,
   target views/rating) → simpan di draft `campaign` dan pakai sepanjang minggu
   (hari lain: baca `campaign` dari draft Senin, `draft-<tanggal Senin>`).
6. Simpan draft `{stage: "ide", ideas, concept, shots, campaign?}`.
7. **Tower**: tulis `status/hari-ini` (stage 0), `metrik/ringkas`, dan
   `konten/<id>` (7 video terakhir, sudah termasuk rating & views kemarin);
   perbarui `otak/analisis` (+ `otak/promosi` hari Senin) — lihat TEAMS.md.
8. **Update playbook** kalau ada pelajaran yang sudah terbukti (≥3 video dengan
   pola rating/views sama): `{rules: ["…", …]}` maks 15 aturan, singkat.

## Sesi 2 — 11:30 Naskah & Review

1. Ambil draft. Tulis naskah lengkap (format di bawah), termasuk caption &
   hashtag.
2. Review kritis sebagai Tim Analisis: klaim hanya dari `content.mjs`,
   matematika benar, tanpa merek lain, `say` enak diucapkan (angka pakai kata),
   hook ≤ 6 kata, total narasi ≤ 75 kata. Revisi sampai lolos.
3. Simpan draft `{stage: "naskah", …, script}`.
4. **Tower**: `status/hari-ini` (stage 1) + perbarui `otak/konten` (pelajaran
   dari review: klaim/angka/hook yang diperbaiki).

## Sesi 3 — 14:30 Produksi & Kirim

### Siapkan alat
```bash
cd promo
npm ci --no-audit --no-fund
npx playwright install --with-deps chromium
pip install -q edge-tts==7.2.8
(command -v ffmpeg || (sudo apt-get install -y -qq ffmpeg || apt-get install -y -qq ffmpeg)) >/dev/null 2>&1 \
  || { npm i --no-save ffmpeg-static && export FFMPEG_PATH=$(node -p "require('ffmpeg-static')"); }
(apt-get install -y -qq fonts-noto-color-emoji || sudo apt-get install -y -qq fonts-noto-color-emoji) >/dev/null 2>&1 || true
```
`PROMO_SECRET` sudah ada di environment. Pakai `PROMO_API_URL=https://membersite-leosiqra.leowendry.workers.dev` — www.leosiqra.com menantang IP datacenter (proteksi bot Cloudflare); `api.mjs` juga otomatis pindah ke alamat ini kalau kena tantangan.
Kalau `python3` bukan yang punya edge-tts, set `PYTHON=` ke interpreter yang benar.

**Catatan sandbox cloud Claude Code** (dari run pertama — lakukan langsung, jangan
buang waktu mendiagnosis ulang). Internet lewat proxy yang memasang sertifikat
sendiri di `/root/.ccr/ca-bundle.crt`:
```bash
# 1) edge-tts (aiohttp/certifi) harus percaya CA proxy
mkdir -p ~/py && printf 'import certifi\ncertifi.where = lambda: "/root/.ccr/ca-bundle.crt"\n' > ~/py/sitecustomize.py
export PYTHONPATH=~/py SSL_CERT_FILE=/root/.ccr/ca-bundle.crt NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
# 2) Chromium tidak bisa memuat Google Fonts lewat proxy (ERR_CERT_AUTHORITY_INVALID):
#    pasang font yang dipakai secara lokal (sesuaikan dengan font pilihanmu)
mkdir -p ~/.fonts && cd ~/.fonts && curl -sS -A "Mozilla/4.0" \
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Poppins:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;700&family=Inter:wght@400;600;700;800&family=Archivo+Black&family=DM+Serif+Display" \
  | grep -o "https://[^)]*" | while read u; do curl -sS -O "$u"; done; fc-cache -f >/dev/null; cd -
# 3) Browser bawaan sandbox (/opt/pw-browsers, build 1194) beda versi dengan
#    Playwright di package.json — kalau launch gagal "Executable doesn't exist
#    …chromium_headless_shell-XXXX", buat symlink ke build yang ada:
#    mkdir -p /opt/pw-browsers/chromium_headless_shell-XXXX && \
#    ln -s /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux /opt/pw-browsers/chromium_headless_shell-XXXX/chrome-headless-shell-linux64 && \
#    ln -s headless_shell /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/chrome-headless-shell
```
Log "font gagal dimuat" dari make.mjs tidak apa-apa selama font lokal di atas terpasang.

`PROMO_SECRET`, `OPENAI_API_KEY`, `DEMO_EMAIL`, `DEMO_PASSWORD` sudah ada di
environment. `OPENAI_API_KEY` boleh key OpenAI (`sk-proj-…`, pakai
gpt-4o-mini-tts) **atau key OpenRouter (`sk-or-…`, pakai openai/gpt-audio-mini)** —
`voice.mjs` memilih sendiri. Tanpa key suara jatuh ke edge-tts; tanpa akun demo
scene `device` jatuh ke ilustrasi — keduanya tercatat di log, sebut di ringkasan.

1. Ambil draft, tulis `draft.script` ke `promo/out/script.json`.
2. Render uji:
```bash
PROMO_SCRIPT_FILE=out/script.json node make.mjs --no-send   # catat angka "seed" di log
F=${FFMPEG_PATH:-ffmpeg}
$F -loglevel error -y -i out/leosiqra-promo.mp4 -vf "fps=1,scale=270:480,tile=8x4" -frames:v 1 out/sheet.jpg
$F -i out/leosiqra-promo.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep " I:"
```
3. QA (wajib): buka `out/sheet.jpg`, `out/cover.jpg`, dan beberapa frame penting
   (`-ss 3.2 -frames:v 1 out/f.jpg`) dengan Read. Cek teks terpotong/bertumpuk,
   frame kosong, rekaman aplikasi tampil (bukan layar login/kosong/error), tidak
   ada merek lain di layar rekaman, kontras subtitle, salah ketik, handle
   tampil, angka benar, durasi 15–35 dtk, loudness ±-14 LUFS, suara terdengar
   natural. Perbaiki lalu render ulang — maksimal 3 putaran.
4. Kirim (seed sama) — sekitar 16:30, sebelum 17:00:
```bash
PROMO_SEED=<seed> PROMO_SCRIPT_FILE=out/script.json node make.mjs
```
   Video terkirim dengan tombol rating 🔥/👍/👎; pemilik juga bisa membalas
   videonya dengan catatan. Itu masuk ke riwayat untuk sesi besok.
   **Tim Promosi**: sebelum kirim, tulis paket posting — `caption` naskah =
   caption IG final (hook kuat di baris pertama, 1–3 kalimat, ajakan
   simpan/komentar), hashtag 5–8; judul YouTube = hook (≤ 95 huruf, Worker
   menambah #Shorts). `make.mjs` otomatis mengunggah video ke antrean posting
   19:00 WIB (Bos bisa ⛔ batal / 🚀 percepat di Telegram).
5. Simpan draft `{stage: "terkirim", …, seed, posting}` (`posting` = ringkasan
   paket posting: jam, platform, caption singkat, hashtag, komentar pertama).
6. **Tower**: `status/hari-ini` (stage 4, label "Terkirim · posting 19:00"),
   `konten/<id>` video hari ini (+ field `posting`, `caption`),
   `metrik/ringkas`; perbarui `otak/konten` & `otak/promosi`. Selama render
   berjalan, set stage 2 lalu 3 supaya Bos melihat progres.

Kalau gagal total setelah usaha wajar, kirim kabar singkat:
```bash
curl -s -H "$H" -F "text=⚠️ Video promo hari ini gagal: <alasan singkat>" "$API/api/promo/telegram"
```

## Format naskah (`script.json`)

```json
{
  "format": "pov", "topic": "…",
  "style": { "palette": "sunset", "background": "studio", "transition": "flip", "subtitle": "karaoke", "font": "Poppins",
             "music": { "bpm": 110 } },
  "scenes": [
    { "type": "hook", "text": "maks 6 kata", "emoji": "🫠", "say": "…" },
    { "type": "device", "shot": "quick|home|stats|budget|savings|ai|transactions|wallet|recurring",
      "camera": "orbit|push|tilt|float|sweep", "focus": 0.3, "text": "maks 4 kata", "say": "…" },
    { "type": "number", "label": "…", "prefix": "Rp", "to": 9125000, "suffix": "", "say": "…" },
    { "type": "list", "title": "…", "items": ["…", "…", "…"], "say": "…" },
    { "type": "mythfact", "myth": "…", "fact": "…", "say": "…" },
    { "type": "quiz", "question": "…", "options": ["…", "…", "…"], "answer": 1, "say": "…" },
    { "type": "phone", "screen": "scan|voice|debt|level|market|tax|…", "text": "…", "say": "…" },
    { "type": "cta", "text": "…", "say": "Coba gratis empat belas hari… follow…" }
  ],
  "caption": "1–3 kalimat + emoji + ajakan komentar/simpan",
  "hashtags": ["#…", "…"]
}
```
- 4–6 scene, pertama `hook`, terakhir `cta`. `say` = yang diucapkan voice-over
  (angka ditulis dengan kata, maks 25 kata/scene, total ≤ 75 kata).
- `device` = rekaman aplikasi asli dari akun demo (`record.mjs` SHOTS: apa
  yang "jari" lakukan per shot ada di sana) di HP 3D dengan gerak kamera;
  `focus` = bagian layar yang didekati kamera `push` (0 atas … 1 bawah).
  `phone` = ilustrasi — untuk fitur yang tidak bisa direkam (scan struk,
  suara, hutang, level, pasar, pajak).
- Suara: biarkan `plan.mjs` memilih acak (field `voice` dikosongkan) — 8 suara
  `coral|shimmer|sage|alloy|ash|ballad|echo|verse`, tidak sama dengan kemarin.
  Isi `voice` sendiri HANYA kalau rating/catatan pemilik jelas menyukai suara tertentu.
- Gaya lain ada di `plan.mjs` (`PALETTES`, `BACKGROUNDS` termasuk latar 3D
  `studio`/`bokeh`, `FONTS`, `TRANSITIONS`, `SUBTITLE_STYLES`).

## Menambah sesuatu yang baru (dianjurkan, di sesi 3)

Boleh tambah scene type, shot rekaman, gerak kamera, background, atau efek
baru di `stage.html` / `record.mjs` (daftarkan juga di `plan.mjs`). Aturan mesin
animasi: semua gerak lewat `A()` (Web Animations ter-pause) atau `T()` (fungsi
waktu) — tanpa CSS animation/transition, tanpa `Math.random()`/`Date.now()`
saat render, tanpa gambar dari internet. Area aman: konten utama di y
280–1450 px, jangan taruh teks penting di 380 px terbawah / 140 px kanan.

## Ringkasan (akhir tiap sesi)

Tulis singkat: sesi apa, keputusan yang diambil (dan alasannya), hal baru,
hasil QA, status pengiriman, serta pelajaran dari rating yang kamu pakai.
