# Serah terima antar-session

Catatan bersama untuk semua session Claude Code (dua akun memakai repo yang
sama, tidak ada ingatan yang terbagi selain file ini dan riwayat git).
**Baca di awal session, perbarui di akhir session, commit & push.**

Terakhir diperbarui: 2026-11-10 (3.27.0 Olahragaku R3 siap di branch claude/friendly-galileo-omr8xf, BELUM deploy — tanpa SQL; live: 3.26.0 run #202)

## Siapa sedang kerja

| Akun | Status | Branch | Area |
|---|---|---|---|
| — | — | — | (akun B selesai; main = live #146) |

Isi baris ini saat mulai (mis. "akun B · aktif · claude/xyz · Worker inbox"),
kosongkan lagi saat selesai. Kalau ada akun lain tercatat aktif di area yang
sama, jangan ubah file yang sama — tanya Bos dulu.

## Menunggu

- **2026-11-10 — 3.27.0 Olahragaku R3 — BELUM DEPLOY. Tanpa SQL** (pakai tabel 0044 + `users.metadata_json`).
  Branch `claude/friendly-galileo-omr8xf`. Keputusan Bos: video = animasi ilustrasi AI (A) + tombol cari YouTube (B);
  menu harian gratis 1×/hari selama program (ulang 300); shift → jendela buka 1 jam sebelum shift mulai.
  - Worker: `$.fitKerja` {mode, shifts≤4, hari{tanggal→shift}, ingatkan} via `PUT /api/member/fit/kerja[/hari]`;
    `POST /fit/menu` (id `menu:<uid>:<tgl>` gratis; `ulang:true` 300 koin), `/fit/coach/eval` (1.500, idem & unik per
    minggu Senin), `/fit/coach/ask` (3 gratis/hari, lalu 300; jawaban kosong tidak di-refund); `fitCharge`/`fitRefund`/
    `fitAiJson`; `sendFitWindowReminders` di cron tiap menit saat menit 0 (klaim `$.fitRemind`, maks 40/run);
    `POST /api/admin/fit/gerakan-gambar` (admin, `generateStoryImage` → R2 `olahraga/gerakan/<key>/<0-3>`) + publik
    `GET /api/fit/gerakan/:key/:frame`. Harga di konstanta Worker (`FIT_EVAL_PRICE` dll.), dikirim ke klien lewat GET /fit.
  - Frontend: `program.ts` (sanitizeKerja, jendelaHari, sanitizeMenuHarian, sanitizeEvaluasi, senin), `KerjaCard`,
    `CoachCard` (di bawah kartu program), `GerakanMedia` (4 frame bergantian + link YouTube), `/admin/olahraga` (tombol
    "Buat yang belum ada", berurutan, lewati yang sudah ada; ±Rp650/gambar, 160 gambar).
  - Dites lokal (mock OpenRouter + gambar PNG tiruan, D1 lokal, Playwright Pixel 7 & 1280): menu gratis/duplikat/ulang
    −300/refund, evaluasi −1.500 + duplikat, tanya 3 gratis lalu −300, provider 500 → refund, jawaban kosong tidak
    refund, jam di luar jendela dibuang, shift malam → jendela 18–02 di prompt, admin gambar 403/200/skip, gambar
    publik 200 & key aneh 404, cron klaim `2026-11-10|buka` sekali; 0 error JS. **Belum dites**: notifikasi lonceng
    (tabel `notifications` tidak ada di D1 lokal), kualitas gambar & teks AI asli.
  - **Setelah deploy (Bos)**: buka Admin › Olahragaku → "Buat yang belum ada" (±160 gambar, ±Rp104 rb).

- **2026-11-09 — 3.26.0 Olahragaku (Rilis 1 + 2 dari 3) — LIVE (run #202, commit 4e44ae8). SQL 0044 dijalankan Bos
  (belum diverifikasi lewat query oleh dev).** Cek live: /membership/olahraga & /app/olahraga 200, /api/member/fit 401
  tanpa login, /versi 3.26.0. **Berikutnya: Bos uji beli 1 program dengan AI asli.** Branch
  `claude/friendly-galileo-omr8xf` (juga membawa c6fe32e langkah unshallow routine + triase audit 09-11).
  Rancangan & keputusan Bos: `docs/rancangan/olahragaku.md` (bagian 9).
  - **MIGRASI 0044 (`cloudflare/migrations/0044_olahraga.sql`)**, additive: `fit_profiles`, `fit_weights`
    (UNIQUE user+tanggal), `fit_programs` (index unik parsial 1 aktif/user), `fit_workouts`, `fit_coach` — 3 terakhir untuk
    R2/R3. Tanpa 0044: GET → ready:false (+prefill), tulis → 503, klien simpan di localStorage `leosiqra-olahraga`.
  - Worker `handleMemberFit` (`/api/member/fit*`): requireSession, `sanitizeFitProfile` (whitelist dari
    `src/lib/olahraga/types.ts`), FREE hanya 7 hari riwayat timbangan, prefill dari `$.healthProfile` + cek status-gizi
    Sehatku, `deleteFitForUser` dipanggil di reset data & hapus user admin. PREF_FEATURES + "olahraga".
  - Frontend: `src/lib/olahraga/{types,hitung,rules,metode,api}.ts` (hitung = Mifflin-St Jeor, IMT Kemenkes, batas
    1.200/1.500 kkal, maks 1%/minggu; rules = kunci metode per kondisi + tingkat lanjut butuh "rutin"; metode = 20
    metode, 104 pertanyaan), `components/olahraga/*`, rute `/membership/olahraga` & `/app/olahraga`, fitur id
    `olahraga`. **Makanku pindah ke Olahragaku** (tab Makan); Sehatku = Asuransi + Cek, `#makan` lama dialihkan;
    alias fitur lama `makan` → `olahraga`. Kebijakan privasi + poin data kesehatan.
  - Keputusan Bos: FREE hanya baca metode (+kuis); mengikuti = PRO + 5.000 koin (program AI, R2). Tombol "Ikuti" saat
    ini: FREE web → panel Paket, PRO → "segera hadir" (nonaktif). App HP tidak punya halaman beli PRO → teks saja.
  - Dites lokal (wrangler dev --local https + D1 skema produksi + 0033/0037–0040/0044, Playwright 1280 & Pixel 7):
    401 tanpa login, sebelum 0044 ready:false/503, validasi (tanggal 2026-02-30 ditolak — bug ketemu & diperbaiki),
    FREE 7 hari / PRO semua, IDOR hapus timbangan user lain → 404, hapus semua; UI: prefill dari Sehatku, hitungan
    cocok manual (P 36 th 158 cm 92,5 kg → BMR 1.572, TDEE 1.886, target 1.386), 5 metode terkunci untuk maag+pemula,
    kuis → hasil, saran alternatif hanya metode yang boleh, timbangan tersimpan, sehat#makan → olahraga#makan, HP tanpa
    overflow, 0 error JS (selain beacon Cloudflare Insights di localhost).
  - **R2 (sesi yang sama)**: `POST /api/member/fit/programs` (PRO, `PROGRAM_PRICE` 5.000 koin di `src/lib/olahraga/program.ts`,
    debit atomik idem `fit_program:<uid>:<request_id>` → OpenRouter gemini-2.5-flash/lite max_tokens 9000, 2 percobaan →
    `sanitizePlan` → batch tutup program lama + insert + set `$.mealTarget`; gagal → refund `refund:<idem>`),
    `/programs/:id/end`, `/fit/workouts` (kkal MET server). `src/lib/olahraga/gerakan.ts` 40 gerakan (tanpa gambar),
    `gerakanAman` (alat, kondisi, IMT ≥30/sendi → low-impact, jantung/pingsan → duduk/peregangan/MET ≤3). UI: sheet
    bayar di detail metode, kartu program aktif (tab Program), tab Latihan, `MakanBanner`. Dites dengan mock OpenRouter
    (salinan index.ts, URL di-sed ke 127.0.0.1:8790): FREE 403, terkunci/kuis 400 tanpa potong, AI ngawur & 500 →
    refund, sukses 6.000→1.000, id sama tanpa potong, koin kurang 402, klik ganda bersamaan 1× potong + 409, IDOR 404,
    gerakan palsu dibuang, dosis dibatasi, menu di luar jendela dibuang; Playwright Pixel 7 & 1280 alur beli → latihan →
    banner, 0 error JS. **Belum dites dengan model asli** (kualitas program Gemini sungguhan + waktu respons, timeout 90 s).
  - Belum: ilustrasi gerakan (butuh OpenRouter key di sesi atau dibuat setelah deploy), R3 (evaluasi mingguan
    1.500, tanya coach 3/hari lalu 300, pengingat jendela makan). Fakta konten yang perlu dicek Bos/ahli: batas gula
    50 g, protein 1,2–1,6 g/kg berat target, keto 20–50 g karbo, tahap 5:2 800 kkal (karangan, bukan standar).

- **2026-11-09 — 3.25.0 Pajak Center baru — LIVE (run #201, commit e9d2355, Release v3.25.0). MIGRASI 0043 SUDAH
  dijalankan Bos (dikonfirmasi 2026-11-09).**
  Branch `claude/pajak-center-20261109`.
  - **MIGRASI 0043 (`cloudflare/migrations/0043_tax_settings.sql`)**: tabel `tax_settings(user_id, year, data_json,
    updated_at, PK(user_id,year))`. Tanpa 0043: GET → ready:false, PUT → 503 not_ready, klien simpan di localStorage
    (`leosiqra-pajak-<tahun>`); setelan lama (`pajak-center-marital-status`, `-dependents`, `-pph21-<tahun>`) ikut terbawa.
  - Worker `handleMemberTax` (`/api/member/tax/settings?year=`): requireSession, `sanitizeTaxSettings` (whitelist,
    clamp, bulan 01–12, dokumen TAX_DOC_KEYS), maks 16 KB (413).
  - Frontend: `src/lib/pajak/rules.ts` (SEMUA angka aturan: PTKP, tarif Pasal 17, biaya jabatan 5%/6 jt, UMKM 0,5% /
    Rp500 jt / Rp4,8 M / 7 th, tenggat + geser hari kerja via hariLibur), `settings.ts`, `pajakXlsx.ts`,
    `components/pajak/PajakCenter.tsx` (5 tab). page.tsx lama (1197 baris) diganti; PajakKesehatan tetap dipakai.
  - Mode usaha `final` TIDAK masuk tarif progresif; `pembukuan` = omzet − Biaya Usaha masuk neto. Neto lama (semua
    pemasukan − pengeluaran) DIBUANG — salah untuk karyawan.
  - Dites: 18 kasus hitung manual (esbuild + node) cocok; E2E wrangler dev lokal (gaji 135 jt, omzet 675,85 jt, zakat
    2,5 jt) → UMKM 879.270, PKP 72,5 jt, PPh 4.875.000 cocok; setelan tersimpan di akun & bertahan reload; xlsx 4 sheet;
    HP 390 tanpa overflow; API tanpa tabel/401/400/413/sanitasi. Belum: cetak PDF dicek visual (pakai window.print biasa).

- **2026-11-09 — 3.24.0 Laporan Usahaku + PDF/Excel — LIVE (run #200, commit 0f7aad0, Release v3.24.0). Tanpa SQL.**
  Branch `claude/usaha-laporan-20261109`. (Rilis 2 berikutnya: Pajak Center baru — lihat "Langkah berikutnya".)
  - Worker `GET /api/member/shops/:id/report?from&to` (BACA SAJA, di handleShopRoutes → requireSession + cek
    `shops.user_id`): penjualan dengan items/pembeli/kasir/sumber dari payload_json, biaya per jenis, bahan & riwayat
    stok; maks ±400 hari & 5.000 transaksi (`truncated`). Dites wrangler dev lokal: 401 tanpa login, 404 toko user lain.
  - Frontend: `src/lib/shopReport.ts` (fetch + `summarize`), `components/ladang/LaporanUsaha.tsx` (rute
    `/membership/ladang/laporan?id=` & `/app/ladang/laporan?id=`), tombol "Laporan & unduh" di UsahaView.
    PDF = `window.print()` dengan CSS cetak (hanya `#laporan-sheet`, rincian mulai halaman 2).
    Excel = `src/lib/shopReportXlsx.ts`, **dependency baru `exceljs@4.4.0`** dimuat lewat import() build browser
    `exceljs/dist/exceljs.min.js` (shim tipe `src/types/exceljs-browser.d.ts`).
  - Dites E2E (wrangler dev --local + out, 21 penjualan/3 biaya): angka cocok manual (omzet 854.000, biaya 475.000),
    xlsx 6 sheet dibuka openpyxl, PDF 3 halaman, web 1280 & HP 390, 0 error JS.
  - Tes lokal: D1 lokal dibuat dari `cloudflare/schema-production.sql` + migrasi 0027/0029–0033/0036 + `ALTER TABLE
    accounts ADD sort_order`; butuh `.dev.vars` SESSION_SECRET (di-gitignore) dan `wrangler dev --local-protocol https`.

- **2026-11-09 — Tema TERANG untuk landing, /mulai, masuk & daftar (ikut 3.23.6) — LIVE (run #199, commit 0eae434,
  Release v3.23.6). Tanpa SQL.** Branch `claude/tema-terang-20261109` (berisi juga perbaikan blur 3.23.6 + hapus ScrollTilt).
  - Bos: "jangan hitam-hitam, buat putih, bersih tapi tetap keren". Navy dibuang: `Aurora` kini pastel
    (indigo .18 / amber .2 / ungu .14 + titik indigo), panel/pita auth & aside /mulai = gradien `#eef0ff → white →
    #fff5e4`, teks slate. Landing: hero terang, judul `.lp-ink` (indigo→ungu→emas, globals.css), tombol utama emas,
    kotak fakta putih, lengkung SVG dihapus, CTA penutup kartu pastel. `Navbar variant="clean"` (dulu "dark") = kaca
    putih + lambang LS + tombol emas.
  - Dites 1280×656 (landing, masuk, daftar, mulai) & 390×844: 0 error JS; gulir landing 60 fps/0 jank, login 60 fps.

- **2026-11-09 — 3.23.6 + landing: animasi tanpa kedip — LIVE (run #199). Tanpa SQL.**
  Branch `claude/landing-flicker-20261109`.
  - Bos: demo landing kedap-kedip/lag. Penyebab: blur yang di-render ulang tiap frame — `Aurora` (blob `blur-[90px]`
    yang bergerak), glow `blur-3xl` di belakang AppShowcase, transisi layar demo `filter: blur(6px)`, heroItem
    `filter: blur(10px)`, dan `backdrop-blur` di Navbar dark (fixed, di atas konten bergerak), tombol, kotak fakta,
    serta `FinanceChips`.
  - Semua diganti: Aurora = `radial-gradient` tanpa filter (hanya transform bergerak), glow = radial-gradient,
    transisi demo = opacity+y, Navbar dark = latar hampir pekat tanpa backdrop-filter, chip = `bg-white` tanpa blur.
  - Ukur rAF 12 s di 1280×656 (headless): landing 20 fps/±70 jank → 60 fps/0 jank; /auth/login 17 fps/93 jank →
    60 fps/0 jank. ATURAN: jangan pakai `filter: blur` / `backdrop-blur` pada elemen yang bergerak atau di atasnya.
  - Rekaman layar Bos (run #198): saat digulir jendela demo SEBAGIAN KOSONG/PUTIH → penyebab `ScrollTilt` (rotateX 3D
    + perspective + useSpring ikut scroll) pada lapisan 1120×680. ScrollTilt DIHAPUS (file juga). Gulir terus 8 s:
    20 fps/30 jank → 60 fps/0 jank. Jangan pasang transform 3D yang mengikuti scroll di elemen besar.

- **2026-11-09 — Landing: demo AppShowcase tampilan baru, pita kartu dicabut — LIVE (run #198). TANPA naik
  versi. Tanpa SQL.** Branch `claude/landing-showcase-20261109`.
  - Bos: hero ngelag karena pita kartu (`.auth-ticker` + FinanceChips ber-backdrop-blur) → pita & Leo di atas mockup
    DIHAPUS dari landing. Jangan tambah animasi berat di hero landing; ubah yang sudah ada.
  - `AppShowcase.tsx`: sidebar mockup pakai lambang `logo-emblem.png`, ubin ikon berwarna (`tint` per SCREENS, senada
    Sidebar.tsx), item aktif kartu putih + garis aksen, tombol "Catat transaksi" gelap + kartu profil PRO; header
    "Cari fitur… Ctrl K" + tombol Leo gradien (ganti "Tambah Cepat" hijau). Tinggi item tetap 42 px/langkah (kursor
    animasi bergantung ini). Tab HP pakai ikon bulat berwarna. `.auth-aurora` + `will-change: transform`.
  - Dites Playwright 1280×656 & 390×844: kursor tetap pas di menu, halaman tidak tergulir sendiri, 0 error JS.

- **2026-11-09 — Landing page (/) baru — LIVE (run #197). TANPA naik versi (keputusan Bos: landing di
  luar versi aplikasi) → CHANGELOG tidak disentuh, Release tidak dibuat. Tanpa SQL.** Branch `claude/landing-baru-20261109`.
  - Hero gelap navy-emas (`Aurora` dari AuthLayout), badge `.auth-shine`, judul sans + `.lp-gold` (globals.css), CTA
    emas, pita `.auth-ticker` berisi FinanceChips, AppShowcase + Leo mengintip + 2 kartu `paper-float`, FACTS kaca gelap,
    lengkung SVG ke bagian terang; marquee teks diberi berlian emas; CTA penutup navy + Aurora + tombol emas.
  - `Navbar variant="dark"` dirombak (dulu gaya Dark Luxury, tidak dipakai): kaca navy, lambang `logo-emblem.png`, link
    putih/amber, tombol Daftar emas. Halaman publik lain tetap `light`.
  - Bug lama diperbaiki: `AppShowcase` (HP) memanggil `scrollIntoView` tiap tab demo berganti → halaman ikut tergulir
    (sekarang 287 px saat dibuka). Kini hanya deretan tab yang digeser (`box.scrollTo`).
  - Dites Playwright 1280×656, 1440×900, 390×844: tanpa overflow-x, tanpa error JS, HP tidak lagi tergulir sendiri.
  - Banner "Pasang Leosiqra di HP" (komponen lama) masih menutup pojok kanan bawah — tidak diubah.

- **2026-11-09 — 3.23.5 Panel auth diam (sticky), form bergulir — LIVE (run #196, commit 380549f, Release v3.23.5). Tanpa SQL.**
  Branch `claude/auth-panel-diam-20261109`. Permintaan Bos: panel diam, form yang geser.
  - Aside `lg:sticky lg:top-0 lg:h-screen lg:self-start` (self-start wajib di grid supaya sticky jalan), isi tetap rata
    atas tanpa overflow-y. Layar ≤ 620px tinggi: subjudul keunggulan disembunyikan, pita & header dirapatkan.
  - Dites Playwright (gulir 500px di kolom form): 1280×656 login/daftar, 1100×540, 1440×900 → panel top 0, tombol
    kembali tetap di y=40 (540: y=24), keunggulan terakhir masih di dalam layar; HP tidak terpengaruh; 0 error JS.

- **2026-11-09 — 3.23.4 Perbaikan panel auth (regresi 3.23.3) — LIVE (run #195, commit 0f6dc0f, Release v3.23.4). Tanpa SQL.**
  Branch `claude/auth-panel-fix-20261109`.
  - 3.23.3 membuat panel `lg:sticky lg:h-screen lg:overflow-y-auto` + isi `justify-center` → di layar Bos (±1280×656)
    celah kosong besar di bawah logo & panel menggulir sendiri (logo hilang). Bos kecewa ("tambah hancur").
  - Sekarang panel ikut tinggi halaman (`lg:min-h-screen`, tanpa sticky/overflow), isi rata atas
    (`pt-[clamp(28px,7vh,72px)]`), kartu dekorasi `mt-auto` & tetap disembunyikan bila tinggi < 860px.
  - Dites Playwright 1280×656 (login, daftar, + gulir), 1100×540, 1440×900: tidak ada celah/tumpukan, 0 error JS.
  - Bos protes animasi hilang (kartu dekorasi tersembunyi < 860px). Diganti pita `.auth-ticker` (Tx/Voice/Budget/Balance
    ×2, 42 s) TEPAT DI BAWAH JUDUL (bukan di dasar panel — dasar panel = dasar halaman, di bawah layar), ikon PERKS
    `paper-float`, badge `.auth-shine` + `.auth-twinkle`. Layar < 760px tinggi: paragraf sub disembunyikan.
    Dites: pita terlihat & bergerak di 1280×656 (login & daftar) dan 1440×900.
  - PELAJARAN: tes di ukuran layar Bos (tablet landscape ±1280×650) DAN dalam keadaan digulir sebelum minta "gas".

- **2026-11-09 — 3.23.3 Logo & layar pendek halaman auth — LIVE (run #194, commit eaab081, Release v3.23.3). Tanpa SQL.**
  Branch `claude/auth-logo-20261109`.
  - Laporan Bos (tablet ±1100×540 CSS px): logo jelek, nama "Leo/siqra" dua warna jelek, panel kiri bertumpuk.
  - Aset baru `public/images/logo-emblem.png` (256 px, potongan lambang dari Logo-new.png, latar transparan) dipakai
    di `Brand` AuthLayout & header /mulai (tile putih). Nama polos "Leosiqra".
  - Panel brand: `lg:overflow-y-auto`, header & isi `shrink-0`, kartu dekorasi `[@media(max-height:860px)]:hidden`.
  - Dites Playwright 1100×540 (login, daftar, mulai), 1280×720, 1440×900, 390×844: tidak bertumpuk, 0 error JS.

- **2026-11-09 — 3.23.1 Langit Teduh + 3.23.2 /mulai senada — LIVE (run #193, commit bb2db55, Release v3.23.2;
  ikut 3.22.1 & 3.23.0). Tanpa SQL.** Rantai branch: mulai-lanjut → daftar-baru → teduh-langit → `claude/mulai-baru-20261109`
  (paling ujung, berisi semuanya).
  - Teduh `LangitHero` (ui.tsx): warna langit diinterpolasi dari tabel `LANGIT` (jam → 3 warna), matahari terbit 5.85 /
    terbenam 17.95 di busur kanan, tenggelam di balik 3 lapis bukit SVG, bulan sabit SVG (mask), bintang & bintang jatuh
    sesuai `gelap`, update tiap menit. `faseLangit` dihapus. Sapaan `sapaWaktu()` dipakai TeduhApp & AlkitabHome
    (sore sampai 18.15, lalu malam). Dites jam 05:30–21:00 dengan clock Playwright (Islam; Kristen tidak dites karena
    Alkitab butuh API).
  - /mulai: aside = gradien navy + `Aurora` (diekspor dari AuthLayout), sticky di laptop; frame HP bercahaya emas;
    logo tile putih + wordmark Leo/siqra; progress bar sampai emas. Dites web 1440 & HP 390, 0 error JS.

- **2026-11-09 — 3.23.0 Halaman daftar & masuk baru — LIVE (run #193). Tanpa SQL.**
  Branch `claude/daftar-baru-20261109` (di atas `claude/mulai-lanjut-20261109`).
  - Hanya tampilan `components/auth/AuthLayout.tsx` (dipakai /auth/register & /auth/login): laptop = 2 kolom, panel
    brand navy-emas sticky (aurora `.auth-aurora` di globals.css, 3 PERKS, TxChip/VoiceChip/BudgetChip) + form kanan;
    HP = pita gelap atas + kartu form `-mt-[120px]`. Props AuthLayout tidak berubah; logika form tidak diubah.
  - Klaim di panel dijaga faktual (Gratis 14 hari tanpa kartu kredit, verifikasi 2 langkah tersedia). Desain sendiri,
    bukan tiruan Oyenza.
  - Dites Playwright: register 1440 & Pixel-ish 390, login 1440 & 390, submit daftar (mock) → body benar + "Akunmu
    siap", 0 error JS.

- **2026-11-09 — 3.22.1 /mulai: isian tamu lama tidak lagi melompat ke langkah terakhir — LIVE (run #193).
  Tanpa SQL.** Branch `claude/mulai-lanjut-20261109`.
  - Laporan Bos: klik Daftar → langsung "Hari pertama, beres." Penyebab: `leosiqra-guest-onboarding.done` di
    localStorage → `setStep(LAST)` saat halaman dibuka. Sekarang `resumable` → kartu "Lanjutkan daftar / Mulai dari
    awal" di layar sambutan; "Ulangi dari awal" di langkah terakhir (`clearGuest`).
  - Dites Playwright (build lokal): kartu muncul, Lanjutkan → langkah terakhir, Ulangi/Mulai dari awal → Langkah 1
    + localStorage terhapus, reload tanpa kartu, 0 error JS. Sidebar.tsx ikut dirapikan Prettier (tanpa ubah perilaku).

- **2026-11-09 — 3.22.0 Menu samping baru — LIVE (run #192, commit f004177, Release v3.22.0). Tanpa SQL.**
  - `Sidebar.tsx` hanya tampilan: ubin ikon berwarna (fitur pakai `tint` features.ts, 4 halaman inti `KEUANGAN_TINT`),
    item aktif = kartu putih + garis aksen (layoutId `sidebar-active`), `GroupLabel`, kartu profil (pil Gratis/PRO).
    Logika menu/PRO/tamu/shortcut N tidak diubah.
  - Tombol "Cari fitur… Ctrl K" → `OPEN_PALETTE_EVENT` (`leosiqra:open-palette`) di CommandPalette; Tanya Leo jadi
    tombol ikon gradien di sebelahnya.
  - Bug lama diperbaiki: di `.web-dark` tombol Catat transaksi (bg-slate-950) berubah putih tanpa teks → `web-keep`.
  - Dites Playwright (build lokal, API mock): web 1440 terang/gelap, tablet 1000 (rel ikon), HP 390 (laci), tombol Cari
    membuka palet & fokus ke input, 0 error JS. Belum dicek: akun PRO (pil PRO + sisa hari), akun tamu.

- **2026-11-09 — 3.21.1 Stikerku: foto kamera/galeri bisa disimpan lagi — LIVE (run #191, commit 4bb871e,
  Release v3.21.1). Tanpa SQL.** Workflow dijalankan Bos (dispatch dari session cloud ditolak auto mode).
  - Penyebab: html-to-image `cacheBust` menambah `?waktu` ke URL gambar; `blob:` URL ber-query gagal di-fetch →
    "Gagal membuat gambar" setiap latar foto. Perbaikan: foto dikonversi ke data URL JPEG (sisi terpanjang 2160 px)
    saat dipilih (`photoToDataUrl` di `StikerApp.tsx`). Jangan kembalikan ke `URL.createObjectURL` untuk gambar yang diekspor.
  - Dites Playwright (build lokal, API mock): kode lama tidak ada unduhan; kode baru Galeri/Kamera → PNG 1080×1920
    berisi foto, 0 error JS. Belum dites: Bagikan (share sheet) di HP asli, foto HEIC.
  - Video "Perjalanan v1→v3.21" (1080×1920, 82 dtk) dibuat di session ini; skripnya tidak di-commit.

- **2026-11-09 — 3.21.0 Teduh baru (+3.20.1 pelafalan Alkitab) — LIVE (run #190, Release v3.21.0 09:37 UTC). Tanpa SQL.**
  - Teduh layar penuh (`/membership/teduh` masuk FULLSCREEN_PATHS) + dock; bahan UI bersama di
    `components/teduh/ui.tsx` (TeduhShell, LangitHero langit per waktu, AngkaNaik, CincinProgres, JedaSejenak,
    LembarTab, NomorAyat, CatatanPribadi). Animasi framer-motion, hormati `useReducedMotion`. JANGAN pasang
    `filter`/`transform` yang menetap di pembungkus konten — elemen `fixed` (lembar Pelajari) jadi terkurung.
  - Renungan harian: `lib/teduh/renungan.ts` (bahan renungan & langkah per tema = tulisan tim, bukan tafsir;
    catatan pribadi localStorage `leosiqra-teduh-catatan`).
  - Pelajari Al-Qur'an: tafsir Al-Mukhtasar QuranEnc (`scripts/teduh/build-tafsir.mjs` → `public/teduh/tafsir/t*.json`,
    tanpa diubah, tanpa nomor versi → dicatat tanggal salinan) + kata per kata langsung dari api.quran.com (publik,
    CORS *, arti per kata Inggris) + catatan. Pelajari Alkitab: rujukan silang OpenBible.info CC BY 4.0
    (`scripts/teduh/build-silang.mjs` → `public/teduh/silang/b*.json`, 6 teratas per ayat) + konteks perikop + catatan.
  - **Audio murattal**: `audioService` kini jatuh ke CDN publik `verses.quran.com/<qari>/mp3/SSSAAA.mp3` (9 qari,
    dicek 206) bila Worker 503 (kunci QF belum ada). Kalau kunci QF dipasang, otomatis pakai API QF.
  - Dites Playwright web 1440 + Pixel 7 (siang & malam): renungan, audio diputar, tafsir, kata per kata, catatan,
    jeda, pembaca surah + Pelajari, Alkitab renungan/ayat terkait/konteks (Alkitab pakai respons tiruan).

- **2026-11-09 — 3.20.0 API Indonesia + Alkitab TB — LIVE (run #189, commit 9b764fe; termasuk 3.18.0 & 3.19.0). Tanpa SQL.**
  - Bos sudah memasang secret `APIINDONESIA_KEY`. Respons API asli belum dicek dari sisi kita (butuh login akun
    produksi) — menunggu konfirmasi/screenshot Bos.
  - Keputusan Bos (eksplisit): pakai API Indonesia (apiindonesia.id), termasuk **Alkitab TB** selagi menunggu izin
    LAI (surat sudah disiapkan untuk Bos kirim ke info@alkitab.or.id; surat AYT ke ylsa@sabda.org). Bila ada
    keberatan → **takedown: tambah `ALKITAB_TB_OFF` = `1` bertipe SECRET** di dashboard Cloudflare (tanpa deploy; tipe Text akan terhapus saat deploy karena wrangler.toml punya [vars] tanpa keep_vars) → 451 + layar
    "Alkitab sedang disiapkan".
  - Worker `handleApiIndonesia`: `/api/member/libur`, `/api/member/teduh/sholat/kota`, `/api/member/teduh/sholat`,
    `/api/member/teduh/alkitab/kitab|pasal`. Header `x-api-key` dari **secret `APIINDONESIA_KEY`** (belum ada →
    503 unconfigured, klien pakai cadangan). Cache bersama caches.default (libur 7 hari, sholat 30 hari, Alkitab 7
    hari); limiter `apiid:user:` hanya saat cache kosong. Bentuk respons dari OpenAPI apiindonesia.id/openapi.json.
  - Klien: `lib/hariLiburApi.ts` (API menimpa data bawaan per tahun; `pakaiDataApi`, `liburStore`), JadwalSholat
    (cari 514 kab/kota → jadwal bulanan disimpan per bulan di localStorage; GPS → hitung lokal), `lib/teduh/alkitab.ts`
    + `components/teduh/AlkitabHome.tsx` (Kristen & Katolik `siap: true`; teks tidak disimpan permanen; progres
    pasal/tanda di localStorage `leosiqra-teduh-alkitab`; TTS Web Speech id-ID).
  - **Belum dites dengan API asli** (dites dengan respons tiruan + Worker tanpa kunci/kunci palsu/saklar takedown).
    Saat kunci terpasang: cek format `abbr` kitab (Worker menolak abbr di luar `^[1-3]?[A-Za-z]{1,12}$`), isi ayat
    tema (rujukan per nomor kitab kanon 1–66), dan field `ashr`/`ashar`.

- **2026-11-09 — 3.19.0 Tanggal merah + jadwal sholat — LIVE (run #189). Tanpa SQL.**
  - `src/lib/hariLibur.ts`: daftar SKB 3 Menteri 2026 (Setneg) & 2027 (Kemenag), dicek jumlah (17+8, 18+8) & nama
    hari. **Tambah tahun berikutnya saat SKB terbit (±September)**; tanggal Hijriah bisa digeser KMA → perbarui.
    Helper: isHariKerja, hariKerjaSebelum, rentangLibur (libur panjang), liburBerikutnya.
  - `components/libur/LiburCard.tsx` (Ringkasan web setelah HealthScoreCard, Beranda /app setelah WeeklyInsights;
    dihitung di browser via useSyncExternalStore — build statis tak tahu "hari ini") + modal kalender;
    `LiburHint` di /membership/recurring & /app/recurring.
  - Jadwal sholat: `src/lib/teduh/sholat.ts` (adhan 4.4.3 MIT; Subuh 20°, Isya 18°, Syafi'i, ihtiyat
    Subuh/Ashar/Isya +2, Dzuhur/Maghrib +3, pembulatan ke atas — dikalibrasi ke Bimas Islam Kemenag Jakarta Nov 2026,
    selisih ≤1 menit), lokasi localStorage `leosiqra-teduh-lokasi` (dibulatkan 2 desimal), `JadwalSholat.tsx`.
  - API Indonesia TIDAK dipakai (perantara berbayar per request); data diambil dari sumber aslinya.
  - Dites Playwright web + Pixel 7: kartu Natal 45 hari lagi / 4 hari, kalender 2027, hint rutin 25 Des → Rab 23
    Des, jadwal sholat GPS Bogor, 0 error JS.

- **2026-11-09 — 3.18.0 Teduh (Rilis 1: Al-Qur'an) — LIVE (run #189). Tanpa SQL.**
  - Data statis: `scripts/teduh/build-quran.mjs` dari `data/teduh/quran/` (Tanzil Uthmani 1.1 **XML** — basmalah di
    atribut `bismillah`, bukan bagian ayat 1; metadata Tanzil; QuranEnc `indonesian_affairs` v1.0.1-csv.1) →
    `public/teduh/quran/surah.json` + `s1..s114.json` (di-commit). Lisensi: Tanzil CC BY 3.0 verbatim + catatan hak
    cipta ikut di tiap file; QuranEnc: tanpa diubah, cantumkan versi, perbarui bila ada versi baru, tanpa iklan
    tak pantas. Kredit tampil di bawah halaman.
  - Pilihan agama & progres/tanda ayat **hanya localStorage** (`leosiqra-teduh-agama`, `leosiqra-teduh-quran`) —
    agama = data pribadi spesifik (UU PDP). Sinkron ke akun belum ada (butuh persetujuan eksplisit kalau dibuat).
  - Audio: Worker `GET /api/member/teduh/reciters|audio?surah=&reciter=` → Quran Foundation Content API (OAuth client
    credentials, cache 1 hari). **Butuh secret `QF_CLIENT_ID` + `QF_CLIENT_SECRET`** (opsional `QF_ENV=prelive`);
    tanpa itu 503 "Audio murattal sedang disiapkan." **Belum dites dengan API asli** (dites dengan audio tiruan:
    sorot, lanjut otomatis, ulangi, qari). URL relatif di-resolve ke `https://verses.quran.foundation/` — cek saat
    kunci ada.
  - UI: `components/teduh/{TeduhApp,QuranReader}.tsx`, `lib/teduh/{agama,quran}.ts`, rute `/membership/teduh`,
    `/app/teduh`, fitur id `teduh` (features + PREF_FEATURES + fiturCatalog + /app/more). Font Amiri Quran (OFL).
  - Agama lain: belum ada teks — Kristen/Katolik (LAI, TB berhak cipta; TL 1954 perlu cek), Hindu, Buddha, Konghucu
    menunggu sumber berizin. Jangan pakai teks/terjemahan tanpa izin; jangan buat isi kitab dengan AI.

- **2026-11-09 — 3.17.0 Ukuran teks LIVE (run #188, commit e390955). Tanpa SQL. Diff besar (±257 file) tapi mekanis.**
  - Codemod: SEMUA `text-[Npx]` (4.244×) → `fs-N` (N<20) / `fsh-N` (N≥20). Utility di globals.css:
    `fs-*` = N px × `--fs` (min 9px), `fsh-*` = N px × `--fs-h`. `--text-xs…9xl`, `text-label/caption` juga ×skala.
    **Mulai sekarang tulis `fs-13` / `fsh-24`, bukan `text-[13px]`** (yang lama tidak ikut setelan).
  - Skala: sedang (bawaan, baru) --fs .95 / --fs-h .88; kecil .9/.82; besar 1.06/1. `:root[data-teks=…]`.
  - `src/lib/textSizeBoot.ts` (skrip <head> di root layout, tanpa React) + `src/lib/textSize.ts` (`useTextSize`,
    useSyncExternalStore). UI: AppearanceView (judul baris Pengaturan → "Tampilan"), /app/profile Preferensi.
  - tailwind-merge: classGroups font-size + `fs`/`fsh` (utils.ts) → `cn('fs-13','text-sm')` menyisakan terakhir.
  - Dites Playwright: h1 Ringkasan 31,7px (sedang) / 29,5 (kecil) / 36 (besar), klik Kecil di Pengaturan & Besar di
    Profil HP tersimpan, 0 error JS. Belum dicek halaman satu per satu (mungkin ada teks yang sekarang terlalu kecil).

- **2026-11-09 — 3.16.1 LIVE (run #187, commit 2b04b06). Tanpa SQL.** `components/peta/MapControls.tsx`: tumpukan tombol (3D global
  semua tab + pitch, lapisan kepadatan `tempat-heat` (heatmap), Lokasiku (GPS sekali, marker `.peta-me`, tidak
  disimpan), kompas saat miring), `usePlaceLayers` (tiang `tempat-3d` per tempat, memudar zoom 13→14,5 karena
  `building-3d` gaya liberty muncul zoom ≥14). PlaceMap: `attributionControl:false` + kredit kecil sendiri
  (OpenFreeMap © OpenMapTiles © OpenStreetMap — WAJIB tetap ada, lisensi), prop `controls` (+/− hanya di picker).
  ThreeDToggle Rekap dihapus (pakai MapControls). Dites Playwright 1440 + Pixel 7, 0 error JS.

- **2026-11-09 — 3.16.0 Peta Belanja Rilis 3 (Rekap + 3D) LIVE (run #186, commit 2ca4aed; termasuk 3.15.1). Tanpa SQL.**
  - Worker: `POST /api/member/places/areas {points}` → `{areas, pending}`; reverse Nominatim zoom 14, kunci koordinat
    3 desimal, `caches.default` 90 hari (null 7 hari), maks 4 titik baru/panggilan berjeda 1,1 s, limiter
    `geo-area:user:` hanya saat ada titik baru. `parsePlaceArea`: Jakarta suburb=kec; Bandung district=kec &
    suburb=kel; Surabaya municipality=kec; kec kosong → dikelompokkan per kelurahan (label "Kel.").
  - Klien: `areaCache` (localStorage `leosiqra-peta-wilayah`, maks 600), `groupAreas` (pembanding periode
    sebelumnya, radius 80%), `components/peta/RekapView.tsx` (`useAreas` bertahap, `useAreaLayer`: circle 2D +
    fill-extrusion heksagon 3D, pitch 58°), tab Rekap di PetaApp.
  - Dites lokal Playwright 1440 + Pixel 7: 9 wilayah, Kec. Cilandak 46%, 3D + pilih wilayah, kembali ke Peta pitch 0,
    0 error JS; endpoint 401 tanpa login, cache kedua 0,36 s. Belum dites: beban Nominatim saat banyak user baru.
  - Berikutnya: belum ada rencana Peta lanjutan; tunggu masukan Bos.

- **2026-11-09 — 3.15.1 — LIVE bersama 3.16.0 (run #186). Tanpa SQL.** TransactionReviewForm (AI Scan/Voice app): kirim `date` dari
  saran AI (kolom Tanggal + "Hari ini", max hari ini) dan pakai `account_id` saran AI kalau milik user. Dites
  Playwright (respons AI dicegat): tersimpan 2026-11-05 di GoPay, lokasi struk tersimpan (source struk).

- **2026-11-09 — 3.15.0 Peta Belanja Rilis 2 (Jejak + lokasi otomatis) LIVE (run #185, commit 10273a0). Tanpa SQL.**
  - Worker: GET /api/member/places ikut `t.created_at` (jam di Jejak); `DELETE /api/member/places` = hapus semua lokasi
    user (transaksi utuh); `aiExtractTransaction` (foto saja) mengembalikan `suggestion.place {name,address}` dari struk.
  - `src/lib/places.ts`: `placePrefs` (localStorage `leosiqra-peta-zona`, `leosiqra-peta-otomatis` — TIDAK ke server),
    `zoneAt`, `nearestKnown` (±60 m), `MAX_AUTO_ACCURACY` 100 m, `dayTrips` (rute hanya dari perhentian berjam; yang
    dicatat di hari lain masuk `extra`).
  - `components/peta/PlaceDraft.tsx` (`usePlaceDraft` → chip + `commit(txId)`), dipasang di AddTransactionModal (web),
    AddTransactionSheet (app), input-cepat, TransactionReviewForm (AI Scan/Voice). Struk: alamat dicari via
    /places/search kalau GPS tidak dipakai.
  - `JejakView.tsx` (`useReplay`: rAF di luar React, layer `jejak`/`jejak-trail`, HUD), `LocationSettings.tsx`
    (otomatis, zona + radius, hapus lokasi lama di zona, hapus semua).
  - **Bug 3.14.0 diperbaiki**: `.peta-pin{position:relative}` menimpa `position:absolute` marker MapLibre → pin
    bertumpuk dan tergeser ke bawah (makin banyak pin makin jauh). Sekarang `absolute`.
  - Dites lokal (Playwright 1440 + Pixel 7, TZ Jakarta): Jejak 7 Nov, putar ulang sampai Selesai, setelan otomatis,
    zona Rumah → chip "Di zona Rumah", di luar zona → "Uniqlo Senayan City · ±18 m", hapus semua (26→0, transaksi
    45 tetap), 401 tanpa login, 0 error JS. Belum dites: baca alamat struk (butuh OpenRouter), GPS HP asli.
  - Berikutnya: Rilis 3 (rekap per kecamatan + 3D).

- **2026-11-09 — 3.14.0 Peta Belanja (Rilis 1 dari 3) LIVE (run #184, commit 5e4ed17).**
  - SQL 0042 (`tx_places`) dijalankan Bos di D1 Console sebelum deploy (belum diverifikasi lewat query).
  - Keputusan peta: coba MapLibre + OpenFreeMap + Nominatim dulu; kalau pencarian jelek → ganti pencarian saja
    (HERE/Foursquare/Photon), Google paling akhir (billing + ToS: data Places wajib di peta Google, tak boleh disimpan).
  - Rilis 2 yang disepakati arahnya: auto-lokasi saat catat (opt-in, hanya transaksi hari ini, akurasi ≤100 m),
    Zona Rumah/Kantor + radius (disimpan di perangkat, tidak dikirim ke server), tab Jejak + putar ulang,
    alamat dari struk, tombol Hapus semua lokasiku. Pin otomatis 'diam 20–30 menit' TIDAK (butuh lokasi latar
    belakang: web tak bisa, Play Store ketat).
  - Worker: `handleMemberPlaces` — `GET /api/member/places?days=`, `PUT|DELETE /api/member/places/:txId` (cek pemilik
    transaksi), `GET /api/member/places/search?q=` (proxy Nominatim, countrycodes=id, cache 30 hari di caches.default,
    rate limit `AI_PARSE_RATE_LIMITER` key `geo:user:`). Hapus transaksi → `deletePlacesForTransactions`.
  - Frontend: `src/lib/places.ts` (groupPlaces: nama sama ≤150 m / tanpa nama ≤40 m, lewati investasi),
    `src/components/peta/{PlaceMap,LocationPicker,PetaApp}.tsx`, rute `/membership/peta` + `/app/peta`, tombol
    "📍 Tandai lokasi di sini" di AddTransactionModal (pengeluaran). Fitur id `peta` (features + fiturCatalog + /app/more).
  - MapLibre GL 6.15.0 + gaya OpenFreeMap (gratis, atribusi OSM). Worker MapLibre disalin ke
    `public/maplibre-gl-worker.mjs` oleh `predev`/`prebuild` (`scripts/salin-maplibre-worker.mjs`, file di-gitignore +
    eslint ignore) dan dipakai via `setWorkerUrl`. Kotak peta harus `h-full w-full` (CSS maplibre memaksa
    `position:relative`, jadi `absolute inset-0` membuat tinggi peta salah).
  - Dites lokal (wrangler dev --local + Playwright 1440 & Pixel 7): peta & pin tampil, pilih pin, Tandai → GPS →
    Simpan (pin 5→6), API 401/400/404 benar, 0 error JS. Belum dites: GPS di HP asli, Nominatim dari Worker produksi.
  - Berikutnya: Rilis 2 (struk baca alamat + tab Jejak/replay), Rilis 3 (rekap per kecamatan + 3D).

- **2026-11-09 — 3.13.0 LIVE (run #183, commit 1b7b25b). Tanpa SQL.** Rapor Keuangan
  (rute tetap `/membership/cek-keuangan`, fitur id `cek`): `src/lib/rapor.ts` (7 indikator, bobot WEIGHTS, nilai
  A–E, mode penuh/perkiraan/kosong, prevScore, `simulate`) + `CekKeuanganApp.tsx` ditulis ulang. Batas = pedoman umum
  (bukan kutipan buku OJK). Dites Playwright 1440/1000/Pixel 7, 0 error JS. Akun tes lokal diubah GUEST→ACTIVE (lokal).

- **2026-11-08 — 3.12.3 LIVE (run #182, commit dab329b). Tanpa SQL.** `SIDEBAR_LIMIT = 6` + `sidebarFeatures()` di
  features.ts; sidebar "Fitur lainnya +N"; halaman /membership/fitur menyembunyikan fitur yang sudah di sidebar (+ menu
  Keuangan & Catat), kolom diseimbangkan otomatis. Label PRO (akun Gratis, `usePlan` / profile di Sidebar) dari
  `Fitur.pro` di fiturCatalog — hanya fitur yang jatahnya memang lebih besar di Worker (AI_LIMITS, STORY_AI, SW_LIMITS,
  STAFF_LIMIT); tidak ada fitur yang terkunci. Belum dites dengan akun PRO (label harus hilang).

- **2026-11-08 — 3.12.2 LIVE (run #181, commit 9913184). Tanpa SQL.** Sidebar: maks 5 fitur (+ fitur yang sedang
  dibuka) lalu "Semua fitur +N" (`/membership/fitur`). Halaman Semua fitur = hanya tombol, kolom tetap (LAYOUT3/LAYOUT2),
  tanpa sakelar/animasi/kartu saran; atur fitur menu tetap via Pengaturan → Fitur. /app/more (HP) masih versi 3.12.0
  (strip saran + cari) — belum disamakan.

- **2026-11-08 — 3.12.1 LIVE (run #180, commit 737911c). Tanpa SQL.** "Atur fitur" di sidebar → `/membership/fitur?atur=1`
  (mode Atur langsung; kartu "Fitur kamu" disembunyikan saat Atur). Pop-up Pengaturan → Fitur diberi tombol ke tampilan
  baru. Belum dites klik sidebar dengan akun aktif (akun tes = tamu, menu fitur tersembunyi).

- **2026-11-08 — 3.12.0 LIVE (run #179, commit 8baa83e; termasuk 3.11.1). Tanpa SQL.**
  - Semua Fitur baru: `src/lib/fiturCatalog.ts` (katalog per tujuan, `since` untuk lencana Baru, riwayat buka di
    localStorage `leosiqra-fitur-dibuka`), `src/components/fitur/{FiturHub,useFiturStatus,CommandPalette,AppSaranStrip}`.
    Ctrl/⌘+K global di layout membership (di /membership/fitur memfokuskan kolom cari). App: /app/more ditambah
    strip saran, cari, status & lencana. Halaman Fitur/Kanvas/Cek belum masuk WEB_DARK_READY (isi tetap terang).
  - Dites Playwright 1440/1000/Pixel 7: status terisi, saran, Atur (sakelar), cari, palet → Pajak Center, 0 error JS.
- **3.11.1 (ikut rilis 3.12.0):**
  - FlowBoard kosong di 3.11.0 (wadah `flex-1` tanpa tinggi) → `absolute inset-0`. Tab Kanvas h-9, tidak terpotong.
  - Mode fokus web ≥768px: event `leosiqra:focus-mode` {on}; layout menggeser `main` (md:ml-[400px]) dan Sidebar
    `focusHidden`; panel jawaban fixed kiri 400px meluncur masuk (delay 150ms), Esc/✕ menutup. HP tetap sheet bawah.
  - `chapterProgress.done` kini juga untuk bab tanpa kartu yang dihitung (bab hitungan saja).
  - Dites Playwright 1440, 1000×668, Pixel 7: sidebar −288/−84 saat panel buka, kembali 0 saat tutup, 0 error JS.

- **2026-11-08 — 3.11.0 LIVE (run #178, commit f8551dd): Kanvas v2 + Cek Keuangan. Tanpa SQL baru (pakai 0041).**
  - Kanvas web tidak lagi layar penuh (dihapus dari FULLSCREEN_PATHS); app tetap layar penuh. Tab + picker template,
    `?id=` / `?baru=<template>` (dipakai saran kartu akhir).
  - Template v2 (`src/lib/kanvas/templates.ts`): kartu data/tanya/cek/tugas/angka/hitung/info; selesai = dijawab,
    dilewati (`done['skip.<id>']`), atau angka otomatis tersedia. Persiapan Nikah 7 bab (id `nk*`) — jawaban 3.10.0
    tidak terbawa (id lama). Acuan rasio ditulis sebagai pedoman umum; kutipan buku OJK dari Oyenza TIDAK disalin.
  - Komponen: Board (focus/onReady), cards (bab berwarna, Leo di Mulai, kartu akhir gelap), Panel, FlowBoard,
    useFinance, CekKeuanganApp. Fitur id baru `cek` (features.ts + PREF_FEATURES Worker).
  - Dites lokal Playwright web 1440 & Pixel 7: alur Bab 1–3 dengan auto-lanjut, Bab 4 terlewati otomatis (angka
    terisi), navigasi bab, kartu akhir + saran, reload tersimpan, 0 error JS. Belum dites: dark mode v2, perangkat asli.

- **2026-11-08 — 3.10.0 LIVE (run #177, commit 22bddf6). PERLU SQL 0041 (Bos konfirmasi dengan "gas").**
  - Cek live: `/api/member/canvas` tanpa sesi 401, bundle /membership/kanvas berisi "Arus Uangku".
  - **MIGRASI 0041 (`cloudflare/migrations/0041_canvases.sql`)**: tabel `canvases` (id, user_id, template, title,
    state_json, rev, created_at, updated_at). Tanpa 0041: GET daftar `{ready:false}` → klien menyimpan kanvas di
    localStorage (`leosiqra-kanvas-v1`) dengan banner "disimpan di perangkat ini" (dites).
  - Worker `handleMemberCanvas` (/api/member/canvas[/:id]): requireSession, semua query `AND user_id = ?`, maks 30
    kanvas (dicek di dalam INSERT…SELECT, uji 31 paralel → 29 masuk), id UUID klien (ulang = 200), PUT dengan `rev`
    (basi = 409, klien memuat versi server), state disaring `sanitizeCanvasState` (kunci regex, ≤1000 char jawaban,
    angka finite, koordinat ±20000, ≤40 catatan, warna whitelist), maks 48 KB (413). `kanvas` masuk PREF_FEATURES.
  - Frontend: `src/lib/kanvas/{data,templates,service}.ts`, `src/components/kanvas/{Board,cards,KanvasApp}.tsx`,
    halaman `/membership/kanvas` (FULLSCREEN_PATHS) & `/app/kanvas`, fitur id `kanvas` (default menyala; user yang
    sudah menyimpan pilihan fitur perlu menyalakannya). Rute di dalam halaman via `?id=` / `?arus=1`.
  - Template: id kartu = kunci jawaban tersimpan, JANGAN diganti. Fakta regulasi yang dipakai: Kontak OJK 157 /
    WA 081-157-157-157, LPS Rp2 M, PNBP nikah di luar KUA Rp600rb, PP 55/2022 omzet ≤ Rp500 jt bebas PPh final.
  - Dites lokal (D1 0041 & tanpa 0041; Playwright web 1440, Pixel 7, dark mode): API (401 anon, dobel, 409, 413,
    sanitasi), buat/isi/centang/catatan/seret/reload tersimpan, Rapikan, Arus Uangku 3 periode (HP: tata letak
    atas-bawah), hitung KPR dicek manual. 0 error JS (selain kurs eksternal yang memang diblokir di tes).
    Belum dites: dua perangkat sungguhan bersamaan, gestur cubit di HP sungguhan.

- **2026-11-08 — 3.9.0 LIVE (run #176, commit b7a84c5). PERLU SQL 0040 (Bos konfirmasi dengan "gas").**
  - Cek live: beranda 200, `/api/member/health/checks` tanpa sesi 401, string 3.9.0 & kartu "Kesehatan & Asuransi" ada di bundle.
  - **MIGRASI 0040 (`cloudflare/migrations/0040_health_followup_results.sql`)** — jalankan di D1 Console SETELAH 0038
    & 0039: `health_claims.followup_at`, `health_checks.results_json`. Tanpa 0040 kode tetap jalan (fallback
    `isMissingColumn`): angka hasil tidak tersimpan (respons `results_saved:false`, toast memberi tahu), pengingat
    klaim dilewati diam-diam.
  - Pajak Center: `src/components/pajak/PajakKesehatan.tsx` (data `healthService.summary(year)`).
  - Cron harian `sendClaimFollowups`: klaim `diajukan` ≥14 hari, 1 UPDATE…RETURNING, maks CRON_HEALTH_USERS user,
    ikut toggle notify.bills, diulang tiap 14 hari selama masih diajukan. Badge di AsuransiView.
  - Angka hasil cek: `CHECK_RESULT_FIELDS` (Worker) = `RESULT_FIELDS` (healthChecks.ts), angka di luar batas dibuang
    server-side, field asing diabaikan. Grafik tren + IMT (Kemenkes) di CheckSheet. Tanpa label diagnosis tensi/gula.
  - Stikerku "Bln lalu" (`computeStoryStats(…, past)`, `?periode=bulan-lalu`). TIDAK ada push baru: push rekap
    tanggal 1 yang sudah ada (`sendInsightPushes`) diarahkan ke stiker kalau fitur stiker menyala (tetap 1 push/bulan).
  - Dites lokal (wrangler + D1 lokal 0040 & tanpa 0040, Playwright Pixel 7 & web 1366): sanitasi angka, fallback,
    cron klaim (lama ditandai, baru tidak, tidak dobel), SQL flag stiker (array/tanpa/rusak), UI 0 error JS.
    Belum dites: cabang tanggal 1 sendInsightPushes end-to-end (butuh tanggal 1); push di HP sungguhan.
  - Berikutnya: **Kanvas (3.10.0)** — diagram arus uang "Dari catatanmu" + papan rencana bertemplate (Persiapan Nikah
    dst.), pan/zoom, jawaban tersimpan di akun. Desain sendiri, referensi Oyenza hanya konsep.

- **2026-11-08 — 3.8.0 LIVE (run #175, commit e4b191a, Release v3.8.0): Stikerku fitur sendiri. Tanpa SQL.**
  - Stikerku jadi fitur terpisah: `/membership/stiker` (FULLSCREEN_PATHS) & `/app/stiker`, fitur id `stiker`
    (features.ts + PREF_FEATURES Worker + grid Lainnya HP). Komponen pindah ke `src/components/stiker/` (StikerApp,
    stickers). Tab Stiker dicabut dari CeritaApp (kembali ke versi 86262b1) + ikon pintasan di dock Cerita.
    User yang sudah menyimpan pilihan fitur perlu menyalakan Stikerku di panel Fitur (sama seperti fitur baru lain).
  - Satu layar: root `fixed inset-0`, kanvas diskalakan ke sisa ruang (ResizeObserver, min lebar/tinggi), hanya
    `[data-scroll]` daftar stiker yang menggulir (HP: horizontal 1 baris; lebar ≥1024 atau ≥768 mendatar: grid
    vertikal di panel kanan). Layar ≤640px tinggi: subjudul & baris info disembunyikan.
  - Stiker baru `struk` (28 total). Dites Playwright web 1366, tablet 1000×668, iPhone 13, iPhone SE: halaman tidak
    menggulir, daftar stiker menggulir, tombol terlihat, ekspor 1080×1920, 0 error JS; Cerita 3 tab + pintasan OK.

- **2026-11-08 — 3.7.0 LIVE (run #174, commit aacc78d, Release v3.7.0): Stiker cerita. Tanpa SQL.**
  - Tab baru Stiker di Cerita (`src/components/cerita/StikerView.tsx`, `stiker/stickers.tsx` 27 stiker,
    `src/lib/storyStats.ts`). Data dari `transactionService.getUserTransactions` (sama dengan Ringkasan: isSpend =
    pengeluaran non-investasi). Ekspor PNG di perangkat dengan `html-to-image@1.11.13` (dependency baru, lock hanya +1
    entri): kanvas logis 360×640/450, diskalakan ke layar, ekspor pixelRatio 3 → 1080×1920 / 1080×1350.
  - Desain sendiri (Leo, Leosiqra), bukan tiruan Oyenza (referensi Bos hanya untuk konsep).
  - Dites lokal (Playwright web 1366 & iPhone 13): hari ini 3 pengeluaran (beli saham 2 jt TIDAK dihitung), tambah/
    geser/putar stiker, ekspor Story 1080×1920 & Post 1080×1350 + sembunyikan nominal, 27 stiker diekspor per
    kelompok & dicek visual; 0 error JS, tanpa scroll samping. Belum dites: tombol Bagikan (navigator.share dengan file)
    di HP sungguhan — headless tidak punya share sheet; fallback = simpan file.

- **2026-11-08 — 3.6.6 LIVE (run #173, commit ef397f5, Release v3.6.6): perbaikan Sehatku. Tanpa SQL.**
  - Review Sehatku (backend + uji API/UI lokal). Diperbaiki: cron pengingat Cek & premi klaim dalam 1 UPDATE…RETURNING,
    maks 25 user/putaran, push digabung per user, cek pakai jendela susulan 7 hari (29 Feb ikut); guard bayar premi
    paralel (next_due harus sama); klaim cair Rp0 ditolak. Dites: 32 user/60 catatan penyerang → 25 lalu 6, notif mati
    tidak pernah; 24 cek API (saldo, dobel, IDOR) lolos; UI web/tablet/HP 0 error JS.
  - **MIGRASI 0039 (health_checks) belum dikonfirmasi dijalankan** — kalau belum, tab Cek tidak bisa menyimpan catatan.
  - Catatan ⚪ belum dikerjakan: `item_key` cek bebas (tidak di-whitelist), JSON rusak → 500 generik, foto meal yatim di R2
    kalau batch gagal, Asuransi menerima kartu kredit sedangkan Makanku tidak, hapus catatan makan/cek tidak menghapus
    transaksinya (disengaja, respons `tx_kept`).

- **2026-11-08 — 3.6.5 LIVE (run #172, commit 927faab, Release v3.6.5 otomatis). Tanpa SQL.**
  - Hasil jual tidak tercatat 2× (Barangku jual menutup iklan Ladangku; Laku menolak barang terjual, guard atomik).
    Dites lokal main vs rilis: main 1 jt → 2,6 jt (2 pemasukan), rilis 1 jt → 1,8 jt; urutan terbalik & iklan tanpa
    barang juga benar.
  - Kebocoran biaya AI ditutup (422 setelah model dipanggil = jatah terpakai; Cerita PRO cek expired_at; Makanku).
    Diverifikasi routine dengan mock OpenRouter, tidak diulang. Efek ke user: foto bukan struk/makanan memakan jatah.
  - Cek live: beranda 200, endpoint tanpa sesi 401, string "3.6.5" ada di bundle dashboard, tag v3.6.5 ada.
  - Data lama (tercatat 2× sebelum 3.6.5): SQL koreksi di `cloudflare/maintenance/2026-11-08-koreksi-jual-dobel/`
    (1-cek.sql baca saja; 2-koreksi.sql balikkan saldo rekening + total member lalu hapus transaksi dobel dari "Laku").
    Diuji di D1 lokal (2,6 jt → 1,8 jt, data kontrol tidak berubah, aman diulang). Dijalankan Bos di D1 Console.

- **2026-11-08 — Bersih-bersih branch (akun ini).**
  - 3 draf artikel (`claude/artikel-cara-mengatur-gaji-5-juta`, `-catatan-tabungan`, `-laporan-keuangan-pribadi`)
    dicek ulang terhadap main 3.6.4: merge bersih, lolos aturan workflow Terbitkan artikel, tsc + build gabungan OK.
    Artikel gaji 5 juta: perubahan `src/app/panduan/cara-mengatur-gaji/page.tsx` (tautan internal) DIKELUARKAN —
    file itu di luar daftar izin workflow sehingga terbit selalu gagal. Tambahkan tautannya terpisah setelah terbit.
  - 13 branch lama yang sudah setara main SUDAH DIHAPUS (2026-11-08, Bos lewat Termux; dicek ulang dari session).
  - Bersih-bersih lanjutan (Termux): ~87 branch `claude/` yang sudah ter-merge / setara main dihapus.
    `claude/halaman-transaksi` diarsipkan sebagai tag **`arsip/halaman-transaksi`** (5a95b7e) lalu branch-nya dihapus.
    Sisa branch `claude/` (dicek 2026-11-08, semua merge bersih ke main kecuali yang ditandai):
    - draf artikel (tunggu ✅ Bos): artikel-cara-mengatur-gaji-5-juta, artikel-catatan-tabungan, artikel-laporan-keuangan-pribadi
    - patch menunggu Bos: fix-kesalahan-hashtag-typo-aturuang (promo/cek-kata ejaan hashtag)
    - fix-jual-dobel-listing-20261105, fix-biaya-ai-20261107, fix-biaya-makanku-20261108: SUDAH LIVE di 3.6.5
      (boleh dihapus)
    - usulan aturan tim: belajar-20261025, belajar-20261101 (promo/TEAMS.md)
    - fix-merge-queue-shallow-20261028: isinya sudah 100% di main (konflik cuma karena urutan) → boleh dihapus
    Session cloud tidak bisa hapus branch/push tag (proxy 403) — pakai Termux `gh api` (lihat riwayat chat 2026-11-08).
    Kalau branch kerja yang sudah di-merge ikut terhapus (mis. form-transaksi-20261108, wordmark-anim-20261108) dan
    masih dipakai di sesi lain, push saja lagi — isinya sudah ada di main.
  - Deploy run #171 (dipicu akun ini 08:30 UTC) = main d4ae39a, kode sama dengan 3.6.4 yang sudah live di #170.

- **2026-11-08 — RILIS 3.6.4: LIVE (run 42403091544, commit 36d6649). Tanpa SQL. Belum dicek: logo bank di prod.**
  - `src/components/AccountSelect.tsx` (baru, web): dropdown inline logo (logoUrl → matchIndonesianInstitutionLogo) +
    saldo / sisa limit kartu kredit (computeCreditUsage). "Tanpa rekening" dihapus; rekening pertama non-kartu-kredit
    terpilih otomatis; submit tanpa rekening ditolak ("Pilih rekening dulu"); 0 rekening → link ke /membership/rekening.
  - `CategorySelect` size="sm": daftar inline dengan emoji categoryVisual, sub kategori dipilih di daftar (input sub
    kategori terpisah dihapus dari form). BUG lama diperbaiki: efek baca auth.currentUser sekali saat mount →
    kosong kalau /api/auth/me belum selesai; sekarang menunggu onAuthStateChanged (berlaku untuk semua pemakai).
  - Dicek lokal: simpan pengeluaran 45rb ke BCA → saldo 4.250.000 → 4.205.000, kategori+sub tersimpan. Logo bank
    tidak bisa dicek lokal (public/logos diunduh saat deploy).

- **2026-11-08 — RILIS 3.6.3: LIVE (run 42400196318, commit e8f4c7f). Tanpa SQL.** Form transaksi
  diringkas (Bos: "kebesaran"): modal 440px putih, nominal 26px di kartu tipis, chip kecil, tombol h-11.
  `CategorySelect` dapat prop `size="sm"` (default tetap 'md', 11 pemakai lain tidak berubah); badge INCOME dimatikan di form ini.

- **2026-11-08 — RILIS 3.6.2: LIVE (run 42399274527, commit da97d03): tombol & form catat transaksi baru. Tanpa SQL.**
  - `Sidebar.tsx`: tombol "Catat transaksi" (slate-950 + tile oranye, Plus berputar saat hover, kbd N, fullOnly).
  - `AddTransactionModal.tsx`: hanya JSX diganti (header gradien per tipe, nominal besar, chip tanggal & rekening,
    "Tanpa rekening" = '' → 'General', cicilan di <details>, footer sticky "Simpan Rp…"). handleSubmit/logika kurs TIDAK diubah.
  - Dicek: tsc, eslint, build, screenshot lokal web 1366 + iPhone 13. Belum: simpan transaksi nyata di prod.

- **2026-11-08 — RILIS 3.6.1: LIVE (run 42397920483, commit ace0f1e, Release v3.6.1): wordmark Leosiqra beranimasi. Tanpa SQL.**
  - `src/components/brand/Wordmark.tsx` + CSS `.wm-*` di globals.css (rise per huruf, sheen mask berkala, wave saat
    hover, logo `.wm-logo` miring); prefers-reduced-motion mematikan. Dipakai di Sidebar web.

- **2026-11-07 — RILIS 3.6.0: LIVE (run 42396910024, commit 923789c, Release v3.6.0): Sehatku › Cek. MIGRASI 0039 menunggu Bos.**
  - **MIGRASI di D1 Console** (0039_health_checks.sql): tabel `health_checks` + 2 index. Tanpa tabel: info CKG tampil,
    pencatatan → ready:false / 503.
  - Worker (di handleMemberHealth): PUT /health/profile ($.healthProfile {birthYear, sex, catin}), GET/POST/DELETE
    /health/checks (id = request_id, biaya opsional → pengeluaran Kesehatan › Lab/Dokter, related_type health_check,
    satu batch + guard). `sendCheckReminders` di cron harian: catatan terbaru per jenis (bukan vaksin) yang genap 1
    tahun dalam 7 hari → 1 push per user, `reminded=1`.
  - Isi `src/lib/healthChecks.ts` dari **Kepmenkes HK.01.07/MENKES/84/2026** (Juknis CKG, 9 Feb 2026, bab II.D/B &
    persiapan; dibaca 7 Nov 2026 dari kesprimkom.kemkes.go.id — host Kemenkes ditambah ke environment leosiqra).
    CKG setahun sekali; syarat usia/jenis kelamin persis juknis. Vaksin dewasa TIDAK diatur juknis → hanya catat dosis.
  - Dites lokal: profil + validasi, cek gratis, cek berbayar 75rb + dobel (saldo 200rb→125rb, masuk biaya Lab),
    tanggal masa depan/key aneh 400, vaksin dosis, cron H-7 menandai, hapus (tx tetap). UI web 1366 + iPhone 13.

- **2026-11-07 — RILIS 3.5.1: LIVE (run 42369534906, commit 0f40bd9, Release v3.5.1): Leo beda per tab Sehatku. Tanpa SQL.**
  - leoGuides: topik `asuransi` = Leo si Pelindung (aksesori `shield`, biru), topik baru `kesehatan` = Leo si Dokter
    (aksesori `doctor`: cermin dahi + stetoskop, teal) untuk tab Cek; `makan` tetap Leo si Koki. Aksesori `nurse`
    dihapus (mirip topi koki). AI_CHAT_PAGES Worker + `kesehatan`. SehatApp: LeoGuide `key={tab}` → obrolan per tab.

- **2026-11-07 — RILIS 3.5.0: LIVE (run 42369027648, commit 5a5afd4, Release v3.5.0): Sehatku › Asuransi. MIGRASI 0038 SUDAH dijalankan Bos (2026-11-07).**
  - **MIGRASI di D1 Console** (0038_health.sql, boleh sebelum/sesudah deploy): tabel `health_policies` + `health_claims`
    (+ 3 index). Tanpa tabel: biaya kesehatan & direktori tetap jalan, Polisku/Klaim → ready:false / 503.
  - Worker `handleMemberHealth` (/api/member/health/*): summary (biaya per bulan & sub dari kategori Kesehatan, polis,
    klaim, rekening IDR), POST costs (pengeluaran Kesehatan, idem related_id=request_id), policies CRUD (maks 30),
    POST policies/:id/pay (pengeluaran Kesehatan › Asuransi + next_due maju per periode, anchor due_day; idem
    payload.premiumPayId), claims CRUD (maks 300) + PATCH status cair+account → pemasukan "Klaim Asuransi" sekali
    (tx_id IS NULL). `sendPremiumReminders` di cron harian (H-3/H-1, reminded_for "tgl|tahap", toggle notify.bills).
  - Direktori `src/lib/insurers.ts`: dibaca 7 Nov 2026 dari situs resmi (environment baru **leosiqra** dengan 20 host
    asuransi + OJK — sesi lain tetap di Default). Terverifikasi: Allianz, Astra Life, Avrist, AXA Mandiri, Equity, FWD,
    Generali, Manulife, Prudential (+BPJS dari Perpres 64/2020). Belum (situs 403/JS/redirect): AIA (aia.co.id belum
    di-allow), BNI Life, BRI Life, Chubb, Great Eastern ID, Inhealth, MSIG, Panin, Sequis, Sinar Mas, Sun Life, Tokio
    Marine, Zurich → hanya nama + situs.
  - Logo: ikon resmi (favicon/apple-touch-icon) diunduh dari situs perusahaan → `public/insurers/*.png|svg` (12: bpjs,
    allianz, astralife, avrist, axamandiri, equity, generali, greateastern, manulife, prudential, sinarmas, zurich);
    sisanya tile inisial. Catatan "Logo milik masing-masing perusahaan" di bawah grid. Tampilan sengaja beda dari
    Oyenza: kartu polis gaya kartu fisik (carousel), panel ringkasan 4 angka, grid logo, header popup berwarna.
    Carousel baru dirender setelah data ada (kalau tidak, snap menahan kartu "Tambah" → scrollLeft ke ujung).
  - AI chat page 'asuransi' (Leo si Perawat, aksesori topi perawat).
  - Dites lokal: biaya 50rb + dobel; polis + validasi; bayar premi + dobel; jatuh tempo 31 Jan→28 Feb→31 Mar; klaim
    disetujui 1,5jt → cair → pemasukan, cair lagi tidak dobel; saldo 1jt→1,55jt sesuai; cron H-3 menandai polis;
    hapus polis melepas klaim. UI web 1366 + iPhone 13, 0 error JS.

- **2026-11-07 — RILIS 3.4.0: LIVE (run 42366120539, commit b02d143, Release v3.4.0): analisis makanan dari ketikan + bayar koin. Tanpa SQL baru.**
  - `/api/member/meals/analyze` terima `text` (≥3, ≤300 karakter) tanpa foto. PATCH meals kini juga items/score/tip/ai.
  - Biaya (keputusan Bos): AI_LIMITS.meal FREE 1 / PRO 10 per hari gratis, lalu MEAL_AI_PRICE = 200 koin.
    `withMealCharge` (menggantikan withAiQuota utk meal): ambil jatah → kalau habis debit koin atomik bersyarat saldo
    (kind `meal_ai`) → gagal/!ok → release jatah / refund `meal_ai_refund` (idem `refund:<kunci>`). Tak cukup → 402
    code no_coins. Respons sukses + `charged` ('free'|'coin') & `price`. Grup admin: pakai.
  - UI: tombol "Hitung pakai Leo / Hitung ulang" di samping kolom Makan apa?, chip "−200 koin"/"jatah gratis", info
    jatah + saldo koin di bawah tombol Foto.
  - Dites lokal: tanpa input 400; jatah gratis + AI gagal → jatah 0 lagi; jatah habis & koin 0 → 402; koin 500 →
    −200 lalu +200 refund (saldo 500, 2 baris ledger); GET ai {used, limit, price, coins}. **Belum: AI asli.**

- **2026-11-07 — RILIS 3.3.1: LIVE (run 42365175967, commit 271a2ea, Release v3.3.1): Makanku → Sehatku (layar penuh). Tanpa SQL baru (0037 tetap perlu).**
  - `src/components/sehat/SehatApp.tsx`: bar atas + dock (tab hash #makan/#asuransi/#cek; Asuransi & Cek = "segera").
    Web `/membership/sehat` (masuk FULLSCREEN_PATHS), app `/app/sehat` (di luar grup tab). MakanApp `embedded`.
  - `/membership/makan` & `/app/makan` = redirect ke `/sehat#makan`. Fitur id 'sehat' (label Sehatku, ikon HeartPulse);
    'makan' lama dipetakan ke 'sehat' di normalizeFeatures dan tetap sah di PREF_FEATURES Worker.
  - Berikutnya (rencana): tab Asuransi = kartu biaya kesehatan tahun ini + Polisku (premi & pengingat); Cek menyusul.
  - Dicek: tsc, eslint, build; screenshot web 1366 (tanpa sidebar), iPhone 13 terang/gelap, tab segera, redirect, 0 error JS.

- **2026-11-07 — RILIS 3.3.0: LIVE (run 42364373366, commit 37f2743, Release v3.3.0): Makanku + popup Leo per fitur. MIGRASI 0037 SUDAH dijalankan Bos (2026-11-07).**
  - **MIGRASI di D1 Console** (0037_meals.sql, boleh sebelum/sesudah deploy): tabel `meals` + index. Tanpa tabel:
    GET → ready:false (banner "sedang disiapkan"), simpan → 503.
  - Worker: `/api/member/meals` GET (hari + minggu Sen–Min + streak + target + belanja Makanan & Minuman minggu ini +
    rekening IDR non-kartu + kuota), POST (id = request_id, INSERT OR IGNORE; pengeluaran opsional kategori Makanan &
    Minuman, sub Makan/Jajan & Kopi, related_type 'meal', saldo via quickTxBalanceStatements dalam SATU batch, hanya
    kalau baris meal baru dengan tx_id itu ada), PATCH, DELETE (transaksi SENGAJA tetap), GET :id/photo (R2 meals/…),
    PUT target (800–6000, metadata $.mealTarget). `/api/member/meals/analyze` lewat withAiQuota kind **meal**
    (FREE 3 / PRO 30) — OpenRouter PARSE_TRANSACTION_MODELS, JSON gizi + price_idr + score + tip.
  - AI chat: `page` opsional (AI_CHAT_PAGES: makan/cerita/fokus/ladang/investasi) → konteks `halamanAktif`
    (+ data makan 7 hari untuk makan). Riwayat chat tidak berubah formatnya.
  - Frontend: `src/components/makan/*`, `src/components/ai/LeoGuide.tsx` (aksesori Leo per halaman + popup chat),
    `src/lib/leoGuides.ts`, halaman `/membership/makan` & `/app/makan`, fitur 'makan' (FEATURES/DEFAULT/PREF_FEATURES).
    AiOrb-link di Cerita/Fokus/Ladangku/Investasiku diganti LeoGuide (Fokus: hanya di tab non-Fokus, seperti dulu).
  - Dites lokal (wrangler): simpan+pengeluaran 25rb → saldo 100rb→75rb, 1 tx; request sama → duplicate tanpa tx kedua;
    rekening asing 400; nama kosong 400; PATCH; target 1800 ok / 99 → 400; analyze tanpa AI → 503 & kuota kembali 0;
    DELETE → tx tetap; tanpa login 401; GET hari/minggu/belanja benar. UI web 1366 + iPhone 13 terang/gelap, popup
    Leo + chat, sheet tambah/edit, 0 page error. **Belum dites: AI asli** (analisis foto & jawaban popup — OpenRouter
    tidak terjangkau dari sandbox; D1 lokal drift membuat /ai/chat 500 di lokal, bukan di produksi).

- **2026-11-07 — RILIS 3.2.0: LIVE (run 42361611192, commit 2924e0c, Release v3.2.0). Tanpa SQL.**
  - Sinkron Release SUDAH dijalankan (run 42361808455): Release v1.0.0–v3.1.0 dibuat, judul/catatan v3.0.2–v3.2.0
    diperbarui, Latest = v3.2.0, APK di v3.0.2 tetap. Jalankan lagi kalau catatan CHANGELOG versi lama diubah.
  - Halaman Riwayat versi: `/membership/versi` (link: Pengaturan › Riwayat versi + chip versi) dan `/app/versi`
    (ketuk versi di Profil app HP). Timeline per generasi, filter era, buka/tutup, badge "Versi kamu". Data dari
    CHANGELOG.md saat build (`src/lib/changelog.ts`) — format `## X.Y.Z — YYYY-MM-DD — Judul` WAJIB dijaga.
  - CHANGELOG dirapikan (semua entri berjudul, bahasa user, peta versi lengkap). `npm run versi` kini menambah
    baris peta versi otomatis (penanda `<!-- peta-baru -->`).
  - GitHub Releases versi lama: session Claude TIDAK boleh membuat Release (403). Dibuat lewat workflow baru
    **Sinkron Release** (`sync-releases.yml`, manual, contents: write): bikin v1.0.0–v3.1.0 di commit
    `.github/release-targets.txt` (bukan Latest) + perbarui judul/catatan Release yang sudah ada. Jalankan SETELAH
    3.2.0 masuk main (sudah). Deploy main kini memberi judul "Leosiqra X — Judul".
  - Dicek: tsc, eslint, prettier, build; screenshot web 1366 + iPhone 13 terang/gelap, 0 error JS.

- **2026-11-07 — RILIS 3.1.3: LIVE (run 42360670539, commit e3b1651, Release v3.1.3). MIGRASI 0036 SUDAH dijalankan Bos (2026-11-07).**
  - **MIGRASI di D1 Console** (0036_stock_staff_id.sql, boleh sebelum/sesudah deploy):
    `ALTER TABLE shop_stock_moves ADD COLUMN by_staff_id TEXT;` Tanpa kolom: Worker tidak menulisnya (perilaku = 3.1.2).
    Cek kolom di-cache per isolate (ada → permanen, belum ada → dicek ulang tiap 60 dtk).
  - Catatan stok manual oleh akun tim (awal/masuk/pakai/opname) kini menyimpan by_staff_id. Batalkan oleh tim: kalau
    by_staff_id terisi → harus sama dengan id tim; kalau kosong (catatan lama) → tetap dicocokkan by_name + hari ini.
  - Dites lokal (wrangler dev): sebelum migrasi tim batalkan miliknya 200; setelah migrasi catatan A punya by_staff_id,
    A dihapus → tim B bernama sama batalkan catatan A 403, miliknya sendiri 200, pemilik batalkan catatan A 200. tsc Worker 0.

- **2026-11-07 — RILIS 3.1.2: LIVE (run 42359676148, commit 36b4557, Release v3.1.2). Tanpa SQL.**
  - POST /api/member/transactions tanpa `account_id` (atau null) → 400 "Rekening wajib dipilih." (dulu 500). Dicek di D1 produksi:
    transactions.account_id NOT NULL = 1. "", "General", "Wallet" tetap diterima seperti sebelumnya.
  - Dites lokal (wrangler dev): tanpa/null 400; "" & General 201; rekening orang lain 400 "Rekening tidak ditemukan.". tsc Worker 0.
    Catatan: D1 lokal account_id masih nullable (drift), jadi di lokal kode lama malah 201 — di produksi pasti 500.

- **2026-11-07 — RILIS 3.1.1: LIVE (run 42358417617, commit 1e0b916, Release v3.1.1). Berisi rapih-frontend Tahap 1–3 + alur-versi + fix-validasi-kategori. Tanpa SQL.**
  - Push ke main dilakukan akun LGblack (kredit habis sebelum dispatch); deploy + sinkron artikel diselesaikan akun lain.
  - 3 draf artikel SUDAH disinkronkan dengan main (merge main, bukan force-push; konflik panduan/page.tsx diselesaikan, prettier,
    tsc 0): gaji-5-juta ff7346f, catatan-tabungan dcf10eb, laporan-keuangan-pribadi 7baca83. Siap dipublish lewat ✅ Telegram.
  - 13 branch basi di bawah BELUM dihapus (izin hapus branch ditolak di session). Sudah dicek: semua isinya ada di main
    (pengingat-pintar & skor-kesehatan = commit d95c777 di main, beda format saja). Hapus manual di GitHub kalau mau.
  - Belum dicek langsung: leosiqra.com setelah deploy (sandbox tidak bisa akses domain produksi).
  - (Catatan lama di bawah dibiarkan untuk riwayat.)
  - Cukup merge branch ini (alur-versi & fix-validasi ikut). Setelah live, Deploy main membuat Release v3.1.1.
  - **WAJIB tepat setelah merge:** 3 draf artikel (`claude/artikel-cara-mengatur-gaji-5-juta`, `-catatan-tabungan`,
    `-laporan-keuangan-pribadi`, status `draf_menunggu_bos`) konflik 1 baris di `src/app/panduan/page.tsx` dengan main
    yang sudah diformat → publish-article (merge otomatis saat Bos ✅) akan GAGAL. Perbaiki dengan merge main baru ke
    tiap branch artikel (tanpa force-push), selesaikan konflik, `npx prettier --write` file artikelnya, push. Jangan
    lakukan sebelum rapih masuk main (diff jadi 440 file → workflow menolak).
  - Branch lama yang sudah setara dengan main (aman diabaikan/dihapus kalau Bos setuju): app-tag-lengkap,
    fitur-fix-input-suara-20261012, friendly-galileo-7cxowa, friendly-galileo-7yleap, pengingat-pintar, push-fcm,
    push-foreground, seo-meta-uang-kas-spt, seo-og-twitter-meta, sesi-app-native, skor-kesehatan, web-dark-bertahap,
    web-dark-sisa.
  - `claude/halaman-transaksi` (56 commit, 12–23 Okt, redesign "pola Oyenza": Peta 3D, Ingatan Leo, Pasar & belajar,
    dll.) TIDAK pernah masuk main & bentrok 49 file + nomor migrasi 0010–0016 bentrok. Dianggap ditinggalkan; kalau
    ada fitur yang mau diambil, port ulang sebagai pekerjaan baru di atas main.

- **2026-11-07 (branch claude/alur-versi-20261107) — Alur versi + rilis 3.1.0, BELUM merge. Tanpa SQL.**
  - Satu versi di package.json → tampil "v3.1.0 · build N"; `npm run versi -- patch|minor|major`; CHANGELOG.md berisi
    aturan X.Y.Z + peta versi 1.0→3.1.0 (disusun ulang dari git). Deploy main membuat tag/Release vX.Y.Z setelah live
    (permissions contents: write) & Telegram menyebut versi + build. APK ikut versi package.json, ditempel ke Release.
  - Urutan merge disarankan: branch ini dulu (3.1.0), lalu rapih-frontend + fix-validasi-kategori sebagai 3.1.1
    (naikkan versi di branch rapih setelah ini masuk main; konflik kecil di SettingsPanel/profile/version.ts).
- **2026-11-06 (branch claude/rapih-frontend-20261106) — Rapikan komentar frontend (Tahap 1), BELUM merge. Tanpa SQL, tanpa perubahan perilaku.**
  - 159 file di `src/`: ~780 baris komentar "keterangan" dihapus (label seksi JSX, komentar yang mengulang kode,
    pembatas, catatan riwayat). Komentar KENAPA (keamanan, uang, drift D1, workaround native) + eslint-disable tetap.
  - Bukti tidak ada kode berubah: pengecek token TypeScript vs origin/main → 0 beda di 159 file; tsc 0, build lolos,
    ESLint sama dengan main. Merge sesudah branch claude/usahaku-web (Akun B) supaya konflik minimal.
  - **Tahap 2 (2026-11-07, branch yang sama): Prettier** — `prettier@3.6.2` + `.prettierrc.json` (120 kolom, kutip
    tunggal), `npm run format` / `format:check`, cakupan `src/` saja. 441 file diformat. Chunk JS build dibandingkan
    sebelum/sesudah: identik setelah normalisasi (spasi JSX, nama variabel minifier, hash styled-jsx). 15
    eslint-disable dipindah ke baris yang benar; ESLint = main. **Setelah merge, branch lain yang menyentuh `src/`
    jalankan `npm run format` sebelum merge** supaya konflik formatnya hilang.
  - **Tahap 3 (2026-11-07): komentar Worker** — 1.374 blok ditinjau: 52 dihapus, 55 diringkas, sisanya (alasan
    keamanan/uang/D1/cron/API luar) tetap. Token kode index.ts identik, tsc Worker 0, bundle dry-run identik.
  - **Uji runtime (wrangler dev lokal, main vs branch berdampingan, D1 lokal sama):** 28 endpoint GET identik (beda
    hanya kode referral acak); alur Input Cepat via UI → saldo BCA 5.000.000→4.962.500 di keduanya, 0 error JS; jalur
    AI chat identik (OpenRouter dummy → pesan ramah sama); 112 halaman × web/HP difoto: 0 beda di luar derau render
    (main vs main sendiri pun ±0,2%), error JS sama persis (kurs diblokir tes, #418 hanya efek jam palsu).
  - Temuan lama (ada di main juga) → branch terpisah `claude/fix-validasi-kategori-20261107`: POST transaksi tanpa
    `category` sekarang 400, bukan 500. `account_id` kosong masih 500 — cek dulu NOT NULL di D1 produksi sebelum
    divalidasi (mungkin ada alur sah tanpa rekening).

- **2026-11-07 — Halaman pembayaran rapi + Admin › Koin lengkap: LIVE (run 42303011955, commit d5eae38). Tanpa SQL.**
  - /membership/contact ditulis ulang jadi "Upgrade & Top up": tab PRO / Top up koin, kartu paket, kartu checkout (total + salin,
    transfer/QRIS, unggah bukti, ref, catatan), riwayat pembayaranku. Baru di Worker: GET /api/member/payments (20 terakhir milik user).
  - Admin › Koin (src/app/admin/koin): tab Ringkasan (beredar, bulan ini, asal koin, per jenis, antrean top up), Pengguna
    (cari, saldo, riwayat, tambah/kurangi), Riwayat (filter grup), Aturan (read-only), Tarik tunai lama (hanya muncul kalau ada data).
    Worker handleAdminCoins: GET /api/admin/coins/{summary,users,ledger}, POST /api/admin/coins/adjust (kind admin_adjust,
    idem admin_adjust:<request_id>, tolak kalau saldo jadi minus → 409, |jumlah| ≤ 10 jt, alasan wajib, log COIN_ADJUST).
    story_ai_refund dihitung di grup "pakai" (bersih dengan story_ai), bukan hadiah.
  - Admin › Pembayaran: kartu per tiket, badge KOIN/PRO, filter jenis, konfirmasi spesifik ("Tambahkan N koin?"), toast (bukan alert),
    catatan member + link WhatsApp, pendapatan PRO vs koin dipisah.
  - Dites lokal: adjust +2500 → 201; request_id sama → 409; −999999 → 409 saldo kurang; alasan pendek/desimal → 400; tanpa login → 401.
    Screenshot HP + web tanpa page error. Belum dites: data produksi asli (banyak user/tiket), QRIS/rekening asli (lokal kosong).

- **2026-11-07 — Sistem koin baru + kuota AI FREE vs PRO: LIVE (run 42300089133, commit 73296e1). Tanpa SQL.**
  - Keputusan Bos: satu jenis koin, 1 koin = Rp1, bisa dibeli; hadiah TIDAK lagi bisa dicairkan.
    COIN_RULES: proMonthCost 2.000 → **15.000** (= harga PRO, beli koin tidak bisa jadi PRO lebih murah), refActiveReferrer
    300→500, refActiveReferee 100→200, refPro 1.000→1.500 (tidak cashable), streak 50→100. POST /coins/withdraw → 410;
    endpoint admin penarikan tetap ada untuk pengajuan lama.
  - Top up koin: COIN_PACKAGES koin-10/25/50/100 (Rp10–100 rb, 1:1, TANPA bonus) lewat jalur pembayaran manual yang sama
    (payment-info menambah paket koin ke pro_packages; package_json kind "coin"). Admin setuju → grantCoins topup:<id>.
  - Bug lama diperbaiki: persetujuan pembayaran tidak idempoten (klik dobel = PRO dobel) → UPDATE bersyarat status.
  - Kuota AI harian (withAiQuota di router; metadata $.aiq_<jenis>; gagal apa pun → jatah kembali):
    chat FREE 5 / PRO 50, scan struk (parse dengan gambar) FREE 3 / PRO 30, suara FREE 5 / PRO 40; teks biasa tidak
    dihitung. GET /api/member/ai/quota. Chat Leo menampilkan "Sisa x/y chat hari ini · PRO 50×/hari".
  - Ilustrasi Cerita: PRO 10 gratis/BULAN (dulu 1/hari ≈ Rp19.500 biaya/bulan/user), FREE 0; selebihnya 1.000 koin.
  - UI Koin: kartu "Bisa ditarik" → "Tukar PRO 15.000/bln", formulir tarik tunai diganti "Top up koin" (→ /membership/contact?package=koin-N).
  - Dites lokal: FREE chat 6 → 429 pesan jelas; gagal → kuota kembali (0/5); teks tidak dihitung; top up koin-10 → +10.000,
    setuju ganda → already; durationMonths palsu diabaikan; tukar PRO 10.600 koin → ditolak (butuh 15.000); tarik → 410.
  - Catatan: pengguna lama yang punya koin kehilangan hak tarik & nilai tukar PRO naik — sudah disetujui Bos ("belum banyak yang pakai").

- **2026-11-07 — Cerita: AI dari foto (anime/kartun) + Kalender bulan berfoto: LIVE (run 42296259066, commit 1c5582a). Tanpa SQL.**
  - Laporan Bos: AI tidak bisa dipakai → penyebab: tombol AI mati kalau tulisan < 8 huruf (Bos punya foto tanpa tulisan).
    Kini ada foto → foto DIUBAH jadi ilustrasi (image-to-image: foto dikirim sebagai image_url ke model gambar);
    tanpa foto → dari tulisan. Gaya: Anime / Kartun 3D / Chibi / Cat air (generik, tanpa nama studio). Model cadangan
    `google/gemini-2.5-flash-image-preview`; parsing gambar lebih longgar (images[]/content[], image_url/imageUrl);
    pesan galat jelas (402 saldo OpenRouter admin habis, 429 ramai, filter keamanan). Ada foto + ilustrasi → toggle Ilustrasi/Asli.
  - Bug: tab Setahun memakai scrollIntoView → ikut menggulir halaman yang dikunci → judul atas terpotong di semua tab.
    Kini gulir kotak `[data-scroll]` saja + window.scrollTo(0,0) saat ganti tab.
  - Tab "Kalender" (ganti "Setahun"): tampilan Bulan = tiap tanggal kartu berisi foto/ilustrasi hari itu, kalau tidak ada
    = wajah Leo sesuai mood (`LeoFace`, SVG statis ringan), nomor tanggal + emoji cuaca, ringkasan bulan (jumlah hari,
    sebaran mood, pengeluaran). Tampilan Tahun = 12 bulan mini (mood/uang), ketuk → buka bulan.
  - Dites lokal: AI dari foto tanpa tulisan diterima (gagal hanya karena tanpa key), tanpa foto & tulisan 400; UI HP/tablet/web
    0 error JS, scrollY halaman 0. **Ilustrasi asli belum dicoba** (tanpa API key di lokal).

- **2026-11-07 — Fitur baru "Cerita Hari Ini" (jurnal harian): LIVE (run 42272516574, commit fae04cb). Migrasi 0035 SUDAH dijalankan Bos (2026-11-07).**
  - **MIGRASI di D1 Console**: 0035_stories.sql (tabel `stories`, PK user_id+date). Tanpa tabel: GET → ready:false, simpan 503.
  - Halaman layar penuh: `/membership/cerita` (FULLSCREEN_PATHS, fitur id `cerita`) & `/app/cerita` (grid Lainnya). Menu:
    Tulis · Setahun · Kumpulan. Mood bertema cuaca (Badai/Mendung/Berawan/Cerah/Pelangi) + stiker Leo per mood (gratis),
    foto (R2, ≤2 MB, JPG/PNG/WebP), ilustrasi AI (OpenRouter `google/gemini-2.5-flash-image`, bisa ditimpa var
    OPENROUTER_IMAGE_MODEL; modalities image+text). Jatah: PRO 1 gratis/hari, FREE 0; selebihnya 1.000 koin
    (STORY_AI_PRICE). Koin dipotong dulu (bersyarat saldo), gagal → dikembalikan (story_ai_refund); jatah gratis via
    users.metadata_json $.storyAi {day,n}, dikembalikan saat gagal.
  - Ringkasan hari otomatis: keluar/masuk/jumlah transaksi + menit fokus. Setahun = 12 kalender bulan, warna mood atau
    intensitas pengeluaran (kuartil). Kumpulan: hari beruntun, total halaman, cari, daftar per bulan.
  - `useFitHeight` dipindah ke src/lib (dipakai Fokus & Cerita).
  - LeoMascot: animasi rx/ry/r (framer) memunculkan error konsol "Expected length, undefined" (termasuk yang lama: menguap,
    bayangan bola, gelembung tidur, mengunyah) → semua diganti scale.
  - Dites lokal: API (sebelum migrasi 503/ready:false, simpan & simpan mood saja, ringkasan Rp160.000/2 tx/fokus 50 mnt,
    tanggal masa depan/ngawur 400, mood ngawur 400, foto 200 + GET image/png, foto palsu 400, AI tanpa key → jatah PRO
    kembali & koin FREE −1000/+1000, koin kurang 402); UI HP/tablet/web 0 error JS, halaman terkunci. **Ilustrasi AI asli
    belum dicoba** (tidak ada API key di lokal) — cek di produksi setelah deploy.

- **2026-11-07 — Fokus bareng Leo: layar penuh ala Ladangku + tampilan baru "Bukit Fokus": LIVE (run 42272516574). Tanpa SQL.**
  - Web `/membership/fokus` masuk FULLSCREEN_PATHS (tanpa sidebar/tab bawah); app pindah ke `/app/fokus` (di luar grup tab,
    tanpa tab bawah & tombol +). Bar atas: tombol kembali (pil gelap) · judul per tab · ⚙️ (Fokus) / Leo AI; menu melayang
    di bawah `[data-focus-dock]` (Fokus · Tenang · Rekap). Tinggi diukur sampai atas menu; diukur ulang setelah animasi masuk
    halaman (transform induk sempat menggeser menu → ukuran pertama salah 468 vs 680 px). MIN_FIT 340 (iPhone SE muat).
  - Tampilan baru (beda dari Oyenza — tanpa kamar/meja/lampu/jendela): `FocusScene` = Leo di puncak bukit, langit ikut jam,
    matahari/bulan berjalan di lengkung langit sesuai progres sesi, timer besar di tengah lengkung (ukuran cqh), kunang-kunang
    (malam) / kupu-kupu (siang), barang per jenis di rumput. Bukit viewBox -800…1200 → skala menurut tinggi (tidak naik di
    layar lebar); Leo ukuran 0.4cqh. Musik & semua pengaturan di lembar ⚙️ / chip musik di langit.
  - Tenang: bidang malam dengan bola cahaya + cincin bernapas, kontrol kaca di bawah.
  - Dites lokal: iPhone 13 (/app & /membership), iPhone SE, tablet 1000×668, web 1366×860 — tidak bisa digulir, tombol
    terbawah di atas menu, Leo tidak tidur 30 dtk, 0 error JS.
  - Berikutnya (permintaan Bos): fitur jurnal harian ala Oyenza (nama & tampilan beda) — belum dimulai, perlu keputusan.

- **2026-11-07 — Fokus bareng Leo: satu layar penuh + Leo bernapas: LIVE (run 42263962169, commit 5e1a06b). Tanpa SQL.**
  - Satu layar (HP/tablet/web): `useFitHeight` di FocusApp mengukur ruang (top elemen → atas tab bawah `[data-bottom-bar]`
    + 34px tombol +), mengunci gulir html/body; < 420px (HP landscape) tidak dikunci. Strip "Hari ini belum ada sesi" dihapus.
    Pengaturan sesi + volume pindah ke tombol ⚙️ (lembar bawah HP / modal web). HP: musik jadi baris chip ringkas.
    App HP: header = tombol kembali + tab + ⚙️ satu baris. Adegan `FocusScene fill` (container query, 16:10 tidak gepeng).
    Tenang: lingkaran mengisi ruang; di HP pilihan disembunyikan selama latihan. Rekap gulir di dalam kartunya.
  - Bug: Leo tertidur saat Tenang (timer kantuk 15/22 dtk tanpa sentuhan) → prop `stayAwake` (Fokus & Tenang).
  - LeoMascot prop `breathing` + `breathAmt`: dada & surai mengembang ikut napas, mata terpejam, pipi menggembung saat
    tahan, mulut "o" + embusan saat hembus.
  - Catatan: offsetParent selalu null untuk position:fixed → deteksi tab bawah pakai ukuran + display.
  - Dites lokal Playwright: iPhone 13 (/app & /membership), iPhone SE, tablet 1000×668, web 1366×860 — tidak bisa digulir,
    tombol terbawah di atas tombol + (app 534 < 586), Leo tidak tidur setelah 30 dtk, 0 error JS.

- **2026-11-07 — Fitur baru "Fokus bareng Leo": LIVE (run 42260880305, commit e28af25). Migrasi 0034 menunggu Bos.**
  - **MIGRASI 0034 SUDAH dijalankan Bos (2026-11-07).** (0034_focus_sessions.sql; boleh sebelum/sesudah deploy — tanpa tabel, fitur tetap jalan,
    rekap disimpan di perangkat lalu otomatis terkirim setelah tabel ada).
  - Halaman: `/membership/fokus` (web, menu "Fokus bareng Leo", id fitur `fokus` — masuk DEFAULT_FEATURES; user yang sudah
    pernah mengatur menu perlu nyalakan di Atur fitur) & `/app/fokus` (grid Lainnya).
  - Tab Fokus: pomodoro 15/25/50/90/atur (5–180), jenis Belajar/Kerja/Baca/Usaha/Lainnya + catatan, istirahat pendek/panjang
    tiap N sesi, auto istirahat/lanjut, jeda/+5/lewati/berhenti (≥1 mnt tetap tercatat), judul tab = sisa waktu, Wake Lock,
    notifikasi + getar saat selesai, lonceng dijadwalkan di AudioContext (tepat walau tab di belakang). Timer dari endsAt
    (localStorage `leosiqra:focus:run`, tahan refresh & sinkron antar tab).
  - Musik: `src/lib/focus/audio.ts` — DISINTESIS Web Audio (lo-fi akor jazz + beat + vinyl, hujan, ombak, brown noise),
    tanpa file lagu → bebas royalti. Otomatis menyala saat fokus mulai (dari klik). Setelah refresh perlu ketuk "Putar musik".
  - Tab Tenang: napas lega / kotak 4×4 / 4-7-8, 1/3/5 mnt, lingkaran + Leo bernapas, getar per langkah, suara ombak opsional
    (hanya mematikan suara miliknya sendiri). Tab Rekap: hari ini / 7 hari / beruntun (≥10 mnt/hari), grafik 7 hari, per jenis, riwayat + hapus.
  - API `/api/member/focus` GET (90 hari) / POST (id UUID klien, ulang = 200 duplicate) / DELETE; validasi waktu, jam HP
    kecepatan ≤2 hari digeser ke jam server; reset data & hapus user ikut menghapus focus_sessions.
  - LeoMascot: prop `headphones` + `music` (not melayang). Adegan kamar SVG orisinal (`FocusScene`): langit jendela & lampu ikut jam,
    jam dinding sungguhan, barang meja per jenis.
  - Dites lokal: API (503 sebelum migrasi, 201/200 dobel, 400 data aneh, 401, delete 200/404); Playwright web 1366 + tablet 1000×668
    + iPhone 13 (jam dipercepat): mulai → judul "24:56 · Fokus", musik jalan, jeda 1 mnt tidak mengurangi, selesai → "Mantap!"
    → istirahat otomatis → selesai, sesi tersimpan 1500 dtk; Tenang selesai; Rekap tampil; 0 error JS. Suara asli belum didengar
    di perangkat sungguhan (headless tanpa speaker).

- **2026-11-06 — Kartu sapaan Ringkasan lebih ringkas + animasi Leo dirapikan: LIVE (run 42254697995, commit 4d769bb). Tanpa SQL.**
  - Hero: padding/huruf lebih kecil (tablet 321→274px, HP 447→389px), kolom Tanya Leo lebih ramping.
  - Gelembung LeoBuddy: maks 290px, teks 13–14px, kata ber-tanda-hubung ("rata-rata") tidak dipotong.
  - LeoBuddy dulu dirender DUA kali (HP & desktop, timer/listener dobel) → satu instans, ukuran lewat mascotClassName.
  - LeoMascot: prop `ledge` (ambang kaca, kaki tidak mengambang); bola memantul di atas kepala (irama 1,1 dtk, gepeng
    saat kena, kepala mengangguk, bayangan) — dulu melayang jauh & kaki naik ke muka; koin dilempar di samping wajah,
    tumpukan di ambang; timer boop dibersihkan saat unmount.
  - Dites lokal: rekaman frame 21:30 & 23:30, tablet 1000×668 + iPhone 13, tap Leo, 0 error JS
    (sisa peringatan recharts "width(-1)" sudah ada sebelumnya).

- **2026-11-06 — Ringkasan/Beranda bersih: kartu "N usulan transaksi menunggu" dihapus: LIVE (run 42252405367, commit f83ebd5). Tanpa SQL.**
  - InboxBanner dihapus (web Ringkasan & app Beranda). Penanda tinggal badge di ikon Kotak Masuk: web sudah ada di header;
    app HP kini punya `InboxButton variant="app"` di samping lonceng (→ /app/inbox).
  - Bug lama InboxButton: badge sering kosong di pemuatan pertama (effect jalan ulang → hasil fetch dibuang, fetch kedua
    dilewati jeda 60 dtk). Kini angka disebar ke semua tombol yang tampil (listeners). Dites lokal: web & app "3 usulan", 0 error JS.

- **2026-11-06 — Popup tidak mengganggu + grid HP + notif login tidak spam: LIVE (run 42250941798, commit fdc7de3). Tanpa SQL.**
  - InstallBanner: hanya di beranda (/, /membership, /membership/dashboard, /app) + artikel publik, maksimal SEKALI per
    sesi tab (sessionStorage `leosiqra:install-ad-shown`; useRef supaya yang sedang tampil tidak ikut hilang), ikon tidak
    bergoyang terus, tablet: "Pasang Leosiqra di perangkat ini".
  - DevNoticeBanner: satu baris tipis tanpa animasi ping, tutup = 14 hari (dulu 3), versi app HP hanya di Beranda /app.
  - 46 grid responsif tanpa kolom dasar → `grid-cols-1` (minmax(0,1fr)). Bug nyata: Ringkasan HP kartu
    "Catatan terbaru"/"Segera" 473px di layar 390px → nominal terpotong. Kini 358px.
  - Transaksi HP: ringkasan "Rp 7,5 jt" (spasi sama dengan "Rp 819.000").
  - Dites lokal Playwright: 34 halaman /membership × HP/tablet/web + 23 /app HP, 0 error JS, 0 scroll samping.
  - Notif "Login Baru Terdeteksi": login ulang dari perangkat yang SAMA tidak dikirim lagi. Penanda = cookie
    `<SESSION_COOKIE_NAME>_dev` (1 tahun, HttpOnly, id acak + HMAC SESSION_SECRET terikat user; tidak dihapus saat
    logout). Browser/perangkat lain & cookie palsu tetap dikabari. Hanya login sandi (Google login memang tidak kirim notif).
    Dites lokal: A pertama +1, A logout→login 0, B baru +1, B cookie palsu +1.

- **2026-11-06 — Bersihkan data tim/stok + rapikan angka kasir: LIVE (run 42243711843, commit 198e387). Tanpa SQL.**
  - Bug: Hapus semua data / admin hapus user TIDAK menghapus shop_staff, staff_sessions, shop_materials,
    shop_stock_moves, shop_recipes (tanpa FK) → akun tim pemilik yang sudah reset MASIH BISA LOGIN.
    Kini `deleteShopExtrasForUser` (best effort per tabel). Hapus satu usaha → `deleteShopExtras`: stok & resep usaha
    itu dihapus + id usaha dicabut dari shop_staff.shop_ids (json_each). Transaksi lama tetap. Hapus akun tim: tidak berubah
    (sesi dicabut + baris dihapus; transaksi & riwayat stok "oleh <nama>" tetap).
  - `parseQty`: "1.500" dulu terbaca 1,5 → kini 1500 (titik + kelompok 3 angka = ribuan; "2.5"/"0.250" tetap desimal).
  - `short` (UsahaView) menangani minus: "−Rp125 rb" (dulu formatIDR penuh → terpotong "−Rp 125…"). Kartu Biaya di
    kasir/Usahaku/tim pakai short(-x). Kartu statistik: <380px jadi 2 kolom (yang ke-3 lebar penuh), font sedikit kecil.
    "mulai Rp5 rb" tidak patah baris.
  - Dites lokal (wrangler dev, D1 lokal): hapus Toko A → bahan/riwayat A 0, tim tinggal akses Toko B; reset data →
    staff/sesi/bahan/riwayat/resep 0, login tim ditolak; UI iPhone SE/13 + web 0 error JS.
  - Catatan (DIRAPIKAN di 3.1.3, lihat atas): batalkan catatan stok oleh tim mencocokkan by_name, bukan id akun — tim baru bernama sama
    di hari yang sama bisa membatalkan catatan tim lama. Perlu kolom staff id (migrasi) kalau mau dirapikan.
  - Catatan: cloudflare/schema-production.sql (dump Juli) sudah usang (accounts/categories kurang sort_order,
    transaction_type) — untuk tes lokal tambah kolom manual.

- **2026-11-06 — Koreksi stok salah input: live #146.**
  - Stok › Ubah: nama, satuan, batas minimum **+ stok sekarang** (perubahan stok = move opname "Diubah manual", selisih tercatat).
  - Riwayat › **Batalkan** satu catatan manual (awal/masuk/pakai/opname): `POST …/stock/moves/:id/revert` (pemilik
    `/api/member/shops/:id/stock/…`, tim `/api/staff/shops/:id/stock/…`). Stok −qty, reverted_at diisi, atomik & anti dobel.
    Ditolak: catatan dari transaksi (hapus transaksinya), sudah ada opname sesudahnya (pakai Ubah), tim selain miliknya hari ini.
    GET stok kini kirim `linked` (0/1) per move.
  - Dites lokal: salah pakai 100 → batalkan → kembali; ulang 409; linked 400; sebelum opname 409; opname terakhir bisa;
    tim batalkan miliknya 200, punya pemilik 403; UI HP Ubah 93→90 lalu batalkan → 93, 0 error JS.
- **2026-11-06 — Stok oleh tim + mode tim dirapikan: live #145.**
  - Worker: `/api/staff/shops/:id/stock[/materials|/moves]` → handleShopStock(..., { name }) — tim boleh lihat, tambah bahan,
    pakai/masuk/hitung fisik (by_name = nama tim, tanggal dipaksa hari ini); ubah/arsip bahan & aturan per produk → 403;
    respons tim tanpa cost/avg_cost & tanpa bahan arsip. Usaha tak diberikan → 403.
  - StockView: context { api, staff, onBuy } (pemilik pakai stockService, tim staffStockService). Tombol **Beli <bahan>** di
    tiap bahan → Catat pengeluaran dengan bahan terpilih (uang keluar + stok masuk sekaligus) — pemilik & tim.
  - /tim ditulis ulang: header sapaan, menu bawah Ringkas / Kasir / Stok (badge hampir habis), pilihan usaha berupa chip,
    kasir dengan Catat biaya & Stok + statistik (omzet, oleh kamu, biaya), Ringkas dengan kartu per usaha & peringatan stok.
  - Dites lokal: API tim (pakai/opname/tambah 201 "Rina", ubah/arsip/aturan 403, usaha lain 403, cost disembunyikan);
    Playwright HP+web: Beli Botol 50 pcs Rp125.000 → stok 198→248, biaya dari rekening kunci "oleh Rina"; 0 error JS, tanpa loop muat.
- **2026-11-06 — live #144:** MCP stok (get_shop_stock / set_shop_stock /
  set_shop_recipes — lihat entri Stok di bawah) + **kasir umum, bukan khusus top up**: "Cari produk…", contoh teks/prompt
  netral, dan **kolom pembeli tidak lagi wajib otomatis untuk toko berkategori** — kini gaya kasir `buyer: opsional|wajib`
  (Tampilan › Data pembeli; bawaan opsional; MCP set_kasir_style ikut). CXA Store perlu disetel "Wajib" oleh Bos.
  Dites lokal: Toko Kue (berkategori) bayar tanpa pembeli OK + stok resep berkurang.
- **2026-11-06 — Usahaku › Stok bahan + Resep produk: live #143** (run pertama gagal: Cloudflare API 503 "no healthy upstream", re-run sukses). Migrasi 0033 sudah dijalankan Bos.
  - Tabel: `shop_materials` (stok sekarang), `shop_stock_moves` (buku stok: awal/beli/masuk/pakai/jual/opname,
    qty bertanda, ref_tx_id, ref_key unik = anti dobel, reverted_at), `shop_recipes` (bahan per 1 produk, key "kategori|nama").
  - Kasir tombol **Stok** (badge hampir habis): tab Bahan (tambah, pakai/masuk/hitung fisik, ubah, arsip), Resep
    (bahan per produk + modal & untung per produk dari harga beli rata-rata), Riwayat. Kartu Usahaku: "N bahan hampir habis".
  - Biaya bisa "Masuk ke stok" (kind beli, cost = nominal → harga rata-rata). Penjualan kasir (pemilik & tim) mengurangi
    stok sesuai resep dalam batch yang sama dengan transaksi (dobel request_id → stok tidak terpotong lagi).
    Webhook website BELUM mengurangi stok (tidak ada kunci produk).
  - Umum untuk semua jenis usaha (bukan parfum saja): istilah "bahan / barang", tab Daftar / Per produk / Riwayat,
    satuan bebas, tombol **"Jadikan stok 1:1"** (toko barang jadi: tiap produk = 1 barang stok, batch dari klien,
    maks 100 bahan/usaha). Pilihan cepat Biaya: bahan/barang toko itu dulu, lalu umum (bahan baku, kemasan, ongkir, sewa, gaji…).
  - Hapus transaksi (kedua jalur DELETE) → stok dikembalikan, KECUALI bahan yang sudah di-hitung fisik (opname) sesudahnya.
  - Tim: `/api/staff/me` kirim `materials` (baca saja), Catat biaya + masuk stok boleh; ubah bahan/resep/opname hanya pemilik.
  - Tanpa tabel 0033: semua alur lama jalan (stok dilewati), endpoint stok 503.
  - MCP (gratis FREE, tulis butuh scope write): `get_shop_stock`, `set_shop_stock` (isi dari Excel/sheet: buat baru /
    setel stok sisa sebagai opname, bawaan PRATINJAU, apply: true; idempotency_key), `set_shop_recipes` (bahan per produk
    by i / name+group, bahan by nama). Dites lokal lewat /mcp: pratinjau tidak menulis, apply buat 2 + setel 1, tidak valid
    dilaporkan, produk/bahan tak ketemu dilaporkan.
  - Dites lokal: tambah bahan (dup 409, negatif 400), resep abaikan bahan asing, jual 2 → −2 botol −60,5 ml, dobel 409 stok
    tetap, jual tim −1/−30,25 "oleh Rina", beli via biaya +100 (avg Rp2.500/pcs), bahan asing 400, opname delta & dobel 409,
    hapus jual/biaya mengembalikan (yang ter-opname tidak), arsip → tidak dipotong, cookie tim → stok pemilik 401. UI HP+web 0 error JS.
- **2026-11-06 — Pengeluaran usaha + rapikan HP: live #142.**
  - Kasir (pemilik & tim) tombol **Biaya** → catat beli botol/dus/bahan: transaksi `pengeluaran` kategori
    **"Biaya Usaha"** (sub: Bahan & Stok / Kemasan / Operasional / Lainnya), related_type 'shop', request_id
    anti dobel (payload_json.expenseId), saldo rekening berkurang dalam satu batch. Tim: rekening kunci + hari ini.
  - Endpoint: `POST /api/member/shops/:id/expense`, `POST /api/staff/shops/:id/expense`; `/api/staff/me` kini kirim `type`.
  - Semua hitungan omzet kini HANYA pemasukan (sebelumnya semua tx related_type 'shop'); Usahaku menampilkan
    Biaya & Bersih (omzet − biaya), kasir: Omzet hari ini / Biaya hari ini / Bersih bulan ini; daftar "Hari ini" campur (biaya merah).
  - HP: tombol hero tidak terpotong, label tahap tidak numpuk, aksi kasir di baris sendiri, bar struk tidak menutupi daftar.
  - Catatan: "Biaya Usaha" belum ada di daftar kategori bawaan (tidak diubah supaya user lama aman) — tampil sebagai
    teks kategori di Transaksi/Rekap. Dites lokal: pemilik a2 −45.000, dobel 409, tim a3 −12.000 "· oleh Rina", usaha lain 403,
    cookie silang 401; UI HP 0 error JS.
- **2026-11-06 (branch claude/usahaku-web) — Usahaku › Tim (akun kasir) Tahap 1, **live #140/#141**. Migrasi 0032 sudah (Bos sempat buat & coba login akun tim). #141: "@" di depan username dibuang otomatis (login/buat), tampilan tanpa @.**
  - Pemilik: tombol **Tim** di hero Usahaku → buat anggota (nama, username `toko-nama` — tanda hubung = penanda akun tim,
    sandi awal, usaha yang boleh dibuka, rekening Rupiah non-kartu-kredit yang DIKUNCI). Batas FREE 1 / PRO 5.
    Atur: ganti usaha/rekening, reset sandi, nonaktifkan, hapus (semua mencabut sesi).
  - Anggota login di `/tim` (atau login biasa — username ber-tanda-hubung dialihkan ke `/tim`). Sesi terpisah
    (cookie `<SESSION_COOKIE_NAME>_tim`, tabel staff_sessions) — tidak pernah lolos requireSession → /api/member/* 401.
    Hanya Ringkas (omzet hari ini) + kasir usaha yang diberikan. Penjualan: rekening & tanggal dipaksa server
    (rekening kunci, hari ini WIB), catatan "· oleh <nama>", request_id idempoten.
  - Endpoint: `/api/staff/{login,logout,me,password,shops/:id/sale}`, `/api/member/staff[/:id]`.
  - Dites lokal (wrangler dev): validasi (username/sandi/usaha asing/kartu kredit ditolak), limit FREE 409, dup 409,
    cookie staff → member 401, cookie pemilik → /api/staff/me 401, /me tanpa link_url/hook/kontak, jual masuk Tunai +15.000,
    ulang 409, usaha tak diberikan 403, reset sandi & nonaktifkan mencabut sesi, login nonaktif 403, logout. UI web + HP 0 error JS.
  - Belum: Tahap 2 (peran Pengelola). Belum dicoba di HP asli / app Capacitor.
- **2026-11-06 (branch claude/usahaku-web) — "Baca ulang website": cek katalog (tambah & hapus) via AI-mu, **live #139**. Tanpa SQL.**
  - MCP baru `sync_shop_catalog` (tulis, gratis FREE): kirim SELURUH produk dari website → produk baru ditambah
    (disisipkan setelah produk terakhir di kategori yang sama), yang tidak ada lagi DIHAPUS, harga diperbarui.
    Bawaan `apply: false` = PRATINJAU (tambah/hapus/harga_berubah, total sebelum/sesudah), simpan dengan `apply: true`.
    Penghapusan besar (>5 & >30% katalog) ditolak kecuali `allow_large_removal: true`. Penjualan lama tidak terpengaruh.
  - Layar 💲 Harga: tab "Baca ulang website" dengan 2 pilihan — **Cek katalog** (sync_shop_catalog, pratinjau dulu) dan
    **Cek harga** (update_shop_prices). Kelola › Website: kalau katalog sudah terisi, perintah AI memakai sync_shop_catalog
    (pratinjau) — bukan set_shop_products replace.
  - Dites lokal: pratinjau tidak mengubah DB; apply: +344 Diamond (di grup ML), −86 Diamond FF, 1 harga berubah; hapus 8/10
    → pratinjau memperingatkan, apply tanpa izin ditolak, dengan izin tersimpan; UI HP 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Update harga "hanya yang sudah ada" lewat AI-mu, **live #138**. Tanpa SQL.**
  - MCP baru `update_shop_prices` (tulis, gratis FREE): HANYA mengubah harga produk yang sudah ada, tidak pernah
    menambah/menghapus. Cocok lewat `i` (get_shop kini mengirim `i` + `website`; kalau `name` ikut dikirim & tidak
    cocok dengan i → tidak diubah) atau name+group persis; nama sama di beberapa kategori tanpa group → `ambiguous`
    (tidak diubah). Laporan updated/unchanged/not_found/invalid_price/ambiguous; mengisi catalog_synced_at.
  - Webhook `/products` mode baru `"prices"` (logika sama, `applyPriceUpdates`).
  - Layar 💲 Harga: tab "Ubah manual" / "Dari website (AI-mu)" — kartu AiMcpCard dengan perintah langkah demi
    langkah (get_shop → baca website → cocokkan yang ada → update_shop_prices → laporan). Catatan: Leosiqra tidak bisa
    menjalankan AI pengguna terjadwal; sarankan fitur tugas terjadwal di aplikasi AI-nya atau webhook.
  - Dites lokal: i, i+nama salah (tidak diubah), ambigu, dengan group, tidak ketemu, harga 0; webhook prices: 2 diubah,
    1 not_found, jumlah produk tetap 5; UI HP 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Update harga manual & otomatis, **live #137**; migrasi 0031 SUDAH dijalankan Bos (jalan kedua kali → "duplicate column" = wajar, kolom sudah ada).**
  - **MIGRASI di D1 Console** (0031_shop_catalog_sync.sql; boleh sebelum/sesudah deploy — tanpa kolom, sinkron tetap
    jalan, cuma waktu "terakhir diperbarui" tidak tercatat): `ALTER TABLE shops ADD COLUMN catalog_synced_at TEXT;`
  - Otomatis: `POST /api/hooks/shop/<id>/products` (kunci webhook yang sama, `authShopHook` dipakai bersama dengan
    webhook penjualan) body `{ mode: "update"|"replace", products: [{ name, price, group?, unit? }] }` — update =
    group+nama sama ikut harga, baru ditambah, lainnya tetap; balasan updated/added/unchanged; maks 120; harga 0 dibuang.
  - Manual: tombol "Harga" di header kasir → `PriceEditor.tsx` (cari, naik/turun X% untuk hasil cari/semua, bulatkan
    Rp100, edit per produk, selisih tampil, simpan sekali). HookSection: bagian "Perbarui harga otomatis" + contoh kode;
    perintah AI ikut mencakup sinkron harga. Banner "Harga diperbarui otomatis dari website: …" di editor harga.
  - Dites lokal: sebelum migrasi update jalan & GET tetap; setelah migrasi waktu tercatat; kunci salah 401, kosong/121
    produk/harga 0 → 400, replace; editor web+HP: +5% bulat Rp100 hanya hasil cari "Diamond" + 60 UC manual → tersimpan.
- **2026-11-05 (branch claude/usahaku-web) — Status "AI tersambung" di Ladangku & Pengaturan, **live #137**. Tanpa SQL.**
  - `src/lib/mcpStatus.ts` (`useMcpStatus`, cache 30 dtk, muat ulang saat tab aktif, `refreshMcpStatus` dipanggil
    McpConnectCard setelah load) dari `/api/member/mcp/tokens`: none / read / write + nama AI.
  - `AiMcpCard` langkah 1: write → "✓ AI tersambung: Claude · izin mengubah aktif" + Atur; read → peringatan
    "izin baca saja — sambungkan ulang & centang izin mengubah" + Atur; none → Hubungkan (seperti dulu).
  - Pengaturan › Aplikasi terhubung: kartu Claude & ChatGPT badge "Terhubung" + "Tersambung: <nama> — Atur untuk
    menambah AI lain", tombol Atur TETAP. McpConnectCard: baris status "N AI tersambung …" + cara menambah AI lain.
  - Dites lokal (Playwright): tiga keadaan write/read/none di kasir › Tampilan, kartu Pengaturan & kartu MCP, 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Gambar katalog: skema MCP lengkap + ikon data:image, **live #137**.**
  - Laporan Bos (balasan Claude-nya): `set_kasir_style` belum mencantumkan `logoUrl`/`categoryImages`, `list_shops`
    belum memuat semua pilihan. Kini skema set_kasir_style punya logoUrl, categoryImages (DIGABUNG, "" = hapus),
    browse, mode; `kasir_style_options` memuat semua pilihan + aturan gambar.
  - Gambar boleh `data:image/(png|jpeg|webp|gif|svg+xml)` ≤8.000 karakter (ikon SVG orisinal buatan AI pengguna),
    total ≤150.000; `data:text/html` dll ditolak. set_catalog_images melaporkan `rejected_invalid` + `dropped_total_limit`.
  - Klien MCP (Claude/ChatGPT) memuat daftar alat saat chat dimulai → setelah deploy pengguna perlu chat BARU
    (atau sambung ulang konektor) supaya skema baru terbaca.
  - Dites lokal: skema 19 field, ikon SVG ML/PUBG + logo terpasang & Free Fire lama tetap, data:text/html dibuang,
    data 9.000 karakter ditolak & dilaporkan, kasir web+HP menampilkan ikon, 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Logo toko & gambar per kategori, **live #136**. Tanpa SQL.**
  - `style_json.logoUrl` + `categoryImages {group: url}` (maks 60). `safeImageUrl` = https saja (bukan http/data:/
    javascript:, tanpa IP/localhost/.internal, ≤500 karakter). Tampil lewat `CatalogImage` (`<img>` lazy,
    referrer dimatikan, gagal muat → inisial/emoji). Dipakai di header kasir, kotak katalog, chip, judul kategori, kartu
    toko di Usahaku; juga dikirim ke desain bebas (`shop.logoUrl`, `shop.categoryImages`).
  - MCP baru `set_catalog_images` (tulis, gratis FREE): merge per kategori, image_url kosong = hapus, melaporkan
    `rejected_not_https` & `warning_unknown_categories`. Editor Tampilan: bagian "Logo & gambar kategori" (tautan
    manual + kartu "Minta AI-mu memasang gambar"). Editor hanya mengirim field yang DIUBAH dan Worker
    MENGGABUNGKAN dengan style tersimpan (PUT shops/:id style = merge) — perubahan AI via MCP saat editor terbuka
    tidak tertimpa (dites: AI pasang logo+gambar, editor ganti tema → ketiganya tersimpan).
  - **Akun Bos SENGAJA belum diisi gambar** (Bos mau tes sendiri lewat MCP).
  - Dites lokal (gambar disimulasikan): MCP pasang logo + 2 kategori, http/data:/IP ditolak, kategori tak dikenal
    diperingatkan, hapus per kategori; PUT javascript: dibuang; web+HP: 3 gambar tampil, gambar 404 & tanpa gambar →
    inisial berwarna; 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Kasir "Katalog kategori", **live #135**. Tanpa SQL.**
  - `style_json.browse` = 'katalog' (DEFAULT baru) | 'gulir'. Katalog: grid kotak per kategori/game (ikon inisial, jumlah
    pilihan, "mulai Rp…", badge ×n kalau ada di struk) → ketuk = halaman daftar harga kategori itu + tombol "Kembali ke
    katalog" (gulir ke atas). Chip geser disembunyikan; pencarian tetap lintas kategori. 'gulir' = tampilan lama (chip +
    semua produk). Pilihan "Cara jelajah" di editor & `browse` di MCP set_kasir_style.
  - Dites lokal web+HP: 4 kotak, buka Free Fire → 3 produk saja, tambah → Kembali → badge ×1, cari "uc" → 2 produk,
    0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Kasir mode BEBAS (desain HTML/CSS/JS sendiri), **live #135**. Tanpa SQL.**
  - `style_json.mode` = 'bawaan' | 'bebas' + `customHtml` (maks 60 rb karakter). Desain TIDAK pernah dijalankan di
    halaman Leosiqra: `CustomKasirFrame.tsx` → `<iframe sandbox="allow-scripts">` tanpa allow-same-origin (origin
    kosong: tanpa cookie/localStorage/API sesi/halaman induk; tanpa forms/popup/top-navigation) + CSP di awal dokumen
    (default-src 'none', tanpa koneksi; img https:/data:; Google Fonts). Jembatan `window.Leosiqra`: onData (katalog +
    isi struk), add(i)/remove(i), checkout(), rupiah(n). Pesan dari iframe divalidasi (sumber, jenis, indeks) dan dibatasi
    15/detik. Struk, ID pembeli & pencatatan uang tetap komponen Leosiqra.
  - Editor Tampilan: "Gaya kasir: Bawaan / Bebas" — textarea kode, "Pakai contoh" (`KASIR_SAMPLE_HTML`), pratinjau
    interaktif, kartu "Minta AI-mu mendesain". MCP baru `set_kasir_template` (tulis, gratis FREE) + `mode` di
    set_kasir_style; list_shops tidak mengirim HTML (has_custom_html), get_shop mengirim.
  - Dites lokal: desain contoh → klik produk masuk struk Leosiqra (70 Diamond ×2 + 86 Diamond = Rp40.000), Bayar di
    desain membuka struk (web: panel samping, HP: sheet); desain JAHAT (cookie, localStorage, parent.document, fetch &
    XHR ke /api/member/accounts, top.location, window.open) → semua diblokir, halaman induk tetap; set_kasir_template
    via MCP akun FREE → tampil di HP. 0 error JS.
  - Catatan risiko yang diterima: desain bisa menampilkan gambar https (bisa dipakai mengirim data yang DIKETIK DI
    DALAM desain ke luar). Data yang diterima desain hanya katalog publik; teks peringatan "jangan ketik PIN/password
    di dalam desain" tampil di kasir.
- **2026-11-05 (branch claude/usahaku-web) — Sambungkan website (webhook) + rombak tampilan kasir, **live #134**; migrasi 0030 SUDAH dijalankan Bos.**
  - **MIGRASI WAJIB di D1 Console** (file 0030_shop_hook.sql, boleh sebelum/sesudah deploy — Worker tahan kolom belum
    ada: kasir jalan, "Sambungkan website" & webhook membalas 503):
    `ALTER TABLE shops ADD COLUMN hook_hash TEXT;` / `ALTER TABLE shops ADD COLUMN hook_account_id TEXT;` /
    `ALTER TABLE shops ADD COLUMN hook_last_at TEXT;`
  - Webhook publik `POST /api/hooks/shop/<shopId>` (`handleShopHook`), header `Authorization: Bearer lsq_shk_…`. Kunci =
    `mcpRandomSecret`, disimpan SHA-256 (`hook_hash`) — tidak pernah dikirim ke klien (GET hanya `hook_on`). Body:
    `order_id` (wajib, unik → `payload_json.saleId = "web:<order_id>"`), `amount` (wajib, Rupiah), opsional product,
    buyer (PIN/OTP ditolak), qty, date. Rekening tujuan = `hook_account_id` (dipilih user, IDR). Rate limit
    MCP_RATE_LIMITER per usaha. Preflight browser tidak mengizinkan header authorization → hanya server-ke-server.
    Catatan transaksi berakhiran " · via website" + `payload.source = 'website'` (badge 🌐 di kasir).
  - Pencatatan kasir & webhook kini satu fungsi `recordShopSale` (batch atomik yang sama, saleKey anti dobel).
  - Member: `POST /api/member/shops/:id/hook {account_id}` → kunci (SEKALI) + url; ganti = kunci lama mati;
    `DELETE` = putus. UI `HookSection.tsx` di Kelola: status (Tersambung → rekening · terakhir masuk), contoh kode
    Node/PHP/cURL, kartu AI-mu (perintah TANPA kunci).
  - Tampilan kasir tambahan (style_json, tanpa migrasi baru): header besar/ringkas, posisi struk kiri/kanan, ukuran
    tombol normal/besar, tampilkan omzet/cari/penjualan hari ini. Juga di MCP set_kasir_style.
  - Dites lokal: sebelum migrasi (GET jalan, 503), tanpa/salah kunci 401, order_id/amount/PIN 400, sah 201 saldo +19.500,
    kirim ulang = duplicate, 3× paralel → 1 tercatat (saldo +29.500 total), ganti kunci → lama 401, kunci toko lain 401,
    putus → 401, tanpa sesi tidak bisa buat kunci; Playwright web+HP 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — MCP Usahaku GRATIS untuk FREE, **live #134**. Tanpa SQL.**
  - Keputusan Bos: tool tulis Usahaku (`create_shop`, `update_shop`, `set_shop_products`, `set_kasir_style`) boleh untuk
    member FREE. Izin tulis (scope `write`) kini bisa dibuat semua member (token manual & OAuth); tool uang
    `add_transaction` & `set_budget` ditandai `pro: true` dan tetap khusus PRO (`mcpCanUse` di tools/list + cek per
    panggilan). Token baca-saja tetap tidak bisa menulis apa pun. Respons token/izin: `canWrite: true` +
    `canWriteMoney` (= PRO). Teks layar izin (McpConnectCard, /izinkan-ai), tabel paket, dan /panduan/mcp diperbarui.
  - Member FREE yang SUDAH terhubung dengan token/izin baca perlu menghubungkan ulang & mencentang izin mengubah.
  - Dites lokal: FREE+tulis → tool Usahaku ada & set_kasir_style jalan, add_transaction ditolak (0 transaksi);
    FREE+baca → tool tulis tidak ditawarkan, panggilan ditolak; PRO → semua tool.
- **2026-11-05 (branch claude/usahaku-web) — Usahaku TANPA AI Leosiqra (keputusan Bos: semua lewat AI/MCP milik
  pengguna), **live #133**. Tanpa SQL.**
  - DIHAPUS dari Worker: `handleShopIdeas` (ide usaha), `handleShopImportPrices` + `handleShopImportPages` + semua
    pengambil halaman (fetchDirectHtml/reader r.jina.ai/pickShopPages), kuota `shopIdeaAi`/`shopImportAi`, env
    `SHOP_IMPORT_READER`. Rute lama (`/shops/ideas`, `/:id/import-prices`, `/:id/import-pages`) membalas **410**
    `code: use_mcp` + pesan. Riwayat kode ada di git (commit sebelum ini) kalau perlu dikembalikan.
  - MCP baru: `create_shop` (simpan ide usaha pilihan pengguna, + products & plan, maks 5 usaha) dan `update_shop`
    (nama/tagline/deskripsi/emoji/WA/cara bayar/area/website/rencana) — pakai `sanitizeShopFields` yang sama dengan
    aplikasi (PIN/OTP & tautan editor ditolak, WA → 62…). Instruksi server MCP: ambil harga website dengan alat web
    milik AI-nya lalu `set_shop_products`.
  - UI: komponen bersama `AiMcpCard` (1 Hubungkan · 2 Salin perintah · 3 Muat ulang + Buka Claude/ChatGPT) dipakai di
    Usaha baru (ide), Kelola › Website (ambil harga), Tampilan kasir. Usahaku & Kasir memuat ulang otomatis saat tab
    kembali aktif (`visibilitychange`). `shopService.ideas/importPrices/importPages` dihapus.
  - **Akibat yang perlu Bos tahu**: menyimpan lewat AI = tool tulis MCP = **khusus PRO**. Member FREE masih bisa
    daftar usaha & isi katalog manual, dan AI-nya bisa membaca, tapi tidak bisa menyimpan lewat AI.
  - Dites lokal: 410 untuk 3 rute lama; create_shop/update_shop + validasi; Playwright web+HP 0 error JS.
    **Belum**: dipanggil dari Claude/ChatGPT asli (termasuk apakah AI-nya mampu membuka semua halaman cxastore.id).
- **2026-11-05 (branch claude/usahaku-web) — perbaikan kecil, **live #132**. Tanpa SQL.**
  - Bug "Hubungkan AI macet" di Tampilan kasir (web): panel Pengaturan (z-80) terbuka DI BELAKANG Modal (z-88). Sekarang
    popup ditutup dulu lalu `openSettings('app-mcp')` (langsung kartu Claude & ChatGPT). HP: tautan /app/profile + tutup.
  - Nama kategori dari penemu halaman: teks link gabungan ("MOBILE LEGENDS Moonton MOBILE LEGENDS") → potongan yang
    cocok dengan nama dari URL ("MOBILE LEGENDS"). Berlaku untuk impor BARU — kategori lama di katalog Bos tetap sampai
    diambil ulang (Ganti semua).
  - Placeholder Daftarkan usaha: "mis. Toko Kue Leosiqra" / "mis. Kue kering & bolu rumahan".
- **2026-11-05 (branch claude/usahaku-web) — Ladangku layar penuh + tampilan kasir (manual & AI pengguna via MCP), **live #131** (migrasi 0029 SUDAH dijalankan Bos).**
  - **MIGRASI WAJIB di D1 Console** (boleh sebelum/sesudah deploy — Worker tahan kolom belum ada: baca tanpa kolom,
    simpan tampilan → 503 "belum aktif"): `ALTER TABLE shops ADD COLUMN style_json TEXT;` (file 0029_shop_style.sql).
  - Web `/membership/ladang` (+ `/ladang/kasir`) masuk `FULLSCREEN_PATHS`: tanpa sidebar, header (Ringkasan · judul tab
    · orb AI) + dock melayang seperti Investasiku. HP tetap tab pil.
  - Halaman Usaha dirapikan: hero omzet bulan ini / hari ini / transaksi / jumlah usaha; kartu toko berwarna tema
    kasirnya + Hari ini / Bulan ini / Produk; baris "langkah berikut" hanya kalau belum tahap Jualan.
  - **Tampilan kasir** (`KasirStyleEditor.tsx`, tema di `kasirTheme.ts`): tema 8 warna, tata letak Kartu/Daftar/Ringkas,
    kolom 2/3/4, gaya kartu, satuan, teks sambutan, penutup struk, urutan kategori. Worker `sanitizeKasirStyle` =
    whitelist (tema/tata letak tak dikenal → nilai lama, teks tanpa `<>`, field lain dibuang). BUKAN HTML/CSS bebas.
  - **MCP** (AI milik pengguna, tidak memakai kuota AI Leosiqra): `list_shops`, `get_shop` (baca), `set_kasir_style`,
    `set_shop_products` (tulis — PRO + token izin tulis, sama dengan tool tulis lain; mode append cocok per group+nama,
    harga 0 dibuang, maks 120). Instruksi server MCP ditambah. Editor punya "Salin perintah" + "Hubungkan AI".
  - `Modal` & `BottomSheet` kini `role="dialog"` + `aria-label`.
  - Dites lokal: tanpa kolom (GET jalan, simpan 503), sanitasi style nakal, MCP tools/list (FREE: tool tulis hilang,
    panggil → ditolak), set_kasir_style/append/usaha orang lain → ditolak; Playwright web+HP 0 error JS.
    **Belum**: dipanggil dari Claude/ChatGPT asli.
- **2026-11-05 (branch claude/usahaku-web) — Halaman KASIR per usaha, **live #130**. Tanpa SQL.**
  - Route baru `/membership/ladang/kasir?id=<usaha>` & `/app/ladang/kasir?id=` (`KasirView.tsx`). Klik usaha di Usahaku →
    kasir (bukan popup lagi). Header: omzet hari ini / jumlah transaksi / bulan ini + "Kelola" (= `ShopDetail` lama:
    kontak, produk, katalog, website — tanpa ringkasan jualan). Katalog: cari + chip kategori + kartu produk (ketuk = +1,
    badge ×n). Struk (web ≥lg panel kanan; HP & web sempit bar bawah → sheet): item ±, "Item di luar katalog", Nama/ID
    pembeli (wajib kalau produk berkategori), rekening (diingat per usaha di localStorage), tanggal, Total diterima bisa
    diubah (potongan ditampilkan) → `POST /shops/:id/sale` (satu transaksi, request_id) → layar selesai + "Salin struk"
    (teks WA) + "Transaksi baru". Daftar "Penjualan hari ini".
  - Worker: sale menerima `items` (≤30, hanya catatan di `payload_json.items`; nominal tetap `amount`). `SaleForm` lama
    di UsahaView dihapus. DevNoticeBanner disembunyikan di `/app/ladang/kasir` (menimpa bar struk). `BottomSheet` kini
    `role="dialog"` + `aria-label` judul. Tombol Kelola di HP punya aria-label.
  - Diuji lokal web + HP: 4 item (70rb) dipotong jadi 60rb, tanpa ID ditolak, catatan "[CXA Store] 70 Diamond ×2,
    140 Diamond, 86 Diamond · 112233 (2001) · Rudi", items tersimpan, saldo +60rb per transaksi, struk tersalin, 0 error JS.
- **2026-11-05 (branch claude/usahaku-web) — Baca SEMUA halaman game dari website toko, **live #130**. Tanpa SQL.**
  - Permintaan Bos: toko top up (mis. https://cxastore.id/) punya halaman per game (`/id/mobile-legends`) — AI harus
    membuka semuanya. **cxastore.id TIDAK bisa dibuka dari sandbox** — strukturnya asumsi, perlu dicek di produksi.
  - Worker baru `POST /api/member/shops/:id/import-pages {url}` (tanpa AI, tanpa kuota, rate-limit biasa): ambil
    beranda (`fetchDirectHtml`, pengaman SSRF sama) → link `<a href>` (+ alt gambar) → kalau < 3, pembaca r.jina.ai
    dengan `x-with-links-summary` (markdown, termasuk link bergambar) → `pickShopPages`: domain sama saja, maks 60,
    buang beranda/`/id`, login/cek transaksi/blog/kebijakan/akun/aset, query & hash dibuang; judul = teks link
    (kata generik "Beli/Top up/Lagi" → dari URL).
  - `import-prices` menerima `group` (nama halaman → kategori produk), teks per halaman ≤20 rb karakter, kuota baru
    terpisah `$.shopImportAi` **60 halaman/hari** (dulu ikut kuota ide 5/hari). `shopQuota()` generik.
  - UI Website: Ambil daftar harga → daftar halaman (centang, Pilih semua/Kosongkan) → baca satu per satu dengan
    progres + "Berhenti & pakai hasil" (rate-limit ditunggu 12 dtk, ulang ≤3×; kuota habis = berhenti) → "N produk
    dari M halaman" + daftar halaman tanpa harga → Ganti semua/Tambahkan. Tanpa sub-halaman → baca halaman itu saja.
    Selama proses, kotak brief & kolom link disembunyikan (cuma baris alamat).
  - Dites lokal (mock): 4 halaman ketemu dari beranda berisi login/cek-transaksi/blog/IG/logo/`/id`; halaman tanpa harga
    → kuota dikembalikan (3 terpakai); situs JS → via pembaca, link bergambar ketemu; web + HP → kasir 3 kategori.
- **2026-11-05 (branch claude/usahaku-web) — **live #129**. Tanpa SQL.**
  - **Tagih › Nyicil**: tombol Nyicil per piutang → nominal (+ chip 25%/50%) → `debtService.pay` (endpoint lama,
    atomik, server memotong kelebihan jadi pelunasan). Progres "Sudah kembali X dari Y". Diuji: 25rb + 30rb + Sudah
    bayar 45rb = 100rb, status lunas, saldo +100rb persis.
  - **Bug Kekayaan (laporan Bos)**: filter "Lunas" hanya menampilkan catatan yang DIBUAT di bulan terpilih → piutang
    Oktober yang dilunasi November tidak muncul di mana pun. Sekarang ikut tampil kalau ada pembayaran di bulan itu
    (`paidMonthsByDebtId`, HutangPanel). Diuji: sebelum fix hanya 1 dari 2, sesudah 2 dari 2.
  - **Usahaku — AI ide ngaco** (Bos: "CXA Store, top up games" → keluar jastip makanan): prompt ide sekarang WAJIB di
    bidang yang disebut user, usaha yang sudah ada = ide pertama pakai nama aslinya, top up/voucher game dinyatakan legal;
    temperature 0.8 → 0.5. **Belum dites dengan AI asli.** + jalur **"Sudah punya usaha? Daftarkan langsung"**
    (`DirectShopForm`: nama, ikon, jualan apa — tanpa AI, tanpa kuota) → detail usaha (isi WA, tempel website).
- **2026-11-05 (branch claude/usahaku-web) — Usahaku › Website + kasir top up, **live #128**. Tanpa SQL baru.**
  - Bagian "Website" di ShopDetail (`WebsiteSection`, `UsahaView.tsx`): belum ada link → kotak "Belum punya website?"
    (Salin brief markdown `websiteBrief()` di `shopService.ts` + Buka Pabrik.AI `https://app.vantis.sh` + Lihat isi brief),
    kolom tautan (DIPINDAH dari ContactForm), "Ambil daftar harga dari website" → pratinjau → Tambahkan (nama sama =
    harga ikut website, sisanya ditambah, maks 20) / Ganti semua / batal. Tahap "Promosi" → "Online" (`promotedAt` ATAU
    `linkUrl`).
  - Worker `POST /api/member/shops/:id/import-prices` (lihat kode: `fetchPublicPage`, `pageHtmlToText`, cadangan
    r.jina.ai, env `SHOP_IMPORT_READER=false` mematikan). Tambahan sesi ini: usaha bukan milik user → 404 sebelum fetch;
    `shopMoney` membuang sen ",00"/".00" dulu ("Rp1.500.000,00" → 1.500.000, dulu jadi 150 juta).
  - Dites lokal (wrangler + mock halaman/jina/AI): ditolak → http, localhost, 127.0.0.1, [::1], 2130706433,
    leosiqra.com, *.internal, redirect ke 127.0.0.1, `/studio?sessionId=`, 403, bukan HTML — kuota TIDAK terpotong;
    redirect ke halaman toko OK; halaman JS → `via: pembaca`; "Rp22.000" → 22000, harga 0 dibuang, `<script>` dinetralkan;
    tanpa sesi 401; kuota 5/hari menolak ke-6. UI Playwright web + HP (`/membership/ladang#usaha`, `/app/ladang#usaha`):
    salin brief, tautan editor ditolak, Tambahkan & Ganti semua tersimpan, tahap jadi Online, 0 error JS.
  - **Belum diverifikasi di produksi**: AI & situs ASLI (r.jina.ai dan Pabrik.AI tidak bisa dijangkau dari sandbox). Rate-limit AI (12/menit)
    ikut terpakai oleh permintaan yang ditolak validasi — sengaja dibiarkan (murah, mencegah spam).
  - **+ Kasir & katalog berkategori (permintaan Bos: katalog top up FF/MLBB/PUBG).** Produk punya `group` opsional
    (kategori, ≤40 karakter, di `products_json` — tanpa migrasi). `SHOP_PRODUCTS_MAX` 20 → **120** (frontend
    `PRODUCTS_MAX` sama). AI import mengisi `group`, teks halaman ≤30 rb karakter, `max_tokens` 9000. "Catat penjualan"
    jadi **"Buka kasir"** kalau ada kategori: pilih kategori (kotak + cari) → pilih nominal → **Nama / ID pembeli WAJIB**
    → jumlah/total/rekening → simpan. Sale menerima `buyer` (≤60, PIN/OTP ditolak) → catatan transaksi
    "[Usaha] Free Fire · 140 Diamond ×2 · 5550001 (2101) · Sari" + `payload_json.buyer`. Tambahkan saat import
    mencocokkan kategori+nama. Katalog WA & brief dikelompokkan per kategori. Dites lokal (mock): import 8 produk
    3 kategori, kasir web+HP, total 2×19.500 = 39.000, tanpa ID ditolak, saldo +10.000 sekali (kirim ulang 409),
    0 error JS. Gambar katalog PNG tetap 7 produk pertama.
- **2026-11-04 (branch claude/usahaku) — Usahaku + tab Ringkas + Jual pakai foto & Sedang dijual, live #127.**
  - Tabel `shops` & `listings` dibuat Bos di D1 Console pakai versi PENDEK (CREATE minimal + ALTER ADD COLUMN, tanpa
    FK/DEFAULT — baris panjang & tanda kutip rusak saat ditempel). Isinya setara file 0027/0028; hapus user/reset tetap
    menghapus manual. Kalau perlu cek: `PRAGMA table_info(shops)` / `(listings)`.
  - **Migrasi `cloudflare/migrations/0027_shops.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy** (tabel `shops`).
  - **+ Migrasi `cloudflare/migrations/0028_listings.sql` (tabel `listings`, "Sedang dijual") juga WAJIB sebelum deploy.**
  - **Jual pakai foto**: `SellFlow` punya Foto/Galeri → `itemService.scan` mengisi nama/varian, foto ikut ke
    `POST /items/appraise` (`image_base64`, ≤2 MB, magic bytes) → AI menilai kondisi (`appraisal.seen`). Setiap taksir
    sukses OTOMATIS membuat/memperbarui baris `listings` (per `listing_id`, atau iklan aktif untuk `item_id` yang sama;
    maks 50 aktif) + foto ke R2 `listings/<user>/…`. Ubah harga/judul/deskripsi → `PUT /api/member/listings/:id` (jeda
    800 ms). `POST /listings/:id/sold` = satu batch: pemasukan (Pemasukan › Jual Barang, related_type 'item') opsional +
    barang Barangku terjual + iklan terjual, bersyarat `status='dijual'` (diuji 3× paralel → 1×201 + 2×409). Tab Jual:
    "Sedang dijual" + badge di daftar Barangku; "Sudah terjual" gabungan iklan & barang (tanpa dobel).
  - Ladangku jadi 4 tab: `#ringkas` (default) / `#usaha` / `#jual` / `#tagih`.
  - **Ringkas** (`RingkasView.tsx`): "Cuan bulan ini" HANYA dari hasil Ladangku — pemasukan `related_type` 'shop' / 'item'
    atau sub 'Jual Barang' (gaji tidak ikut — alasan tab Target lama dihapus). Target opsional `prefs.cuanTarget`.
    Kartu ke Usahaku / Jual / Tagih + "Uang masuk bulan ini".
  - **Usahaku** (`UsahaView.tsx`, `shopService.ts`): `POST /api/member/shops/ideas` (AI, 3 rencana Rupiah, kuota 5/hari
    `$.shopIdeaAi`, dikembalikan kalau gagal, tanpa web search), CRUD `/api/member/shops` (maks 5/user), `POST /:id/sale`
    (pemasukan Usaha & Freelance › Penjualan + saldo, `request_id` → `payload_json.saleId` anti dobel). Tahap: Rencana →
    Katalog (WA + produk) → Promosi (`promoted_at`, saat salin/bagikan katalog) → Jualan (≥1 penjualan).
  - Katalog: teks WA, gambar PNG 1080×1350 (canvas di klien), tautan `wa.me/<62…>?text=`. TIDAK ada halaman publik.
    Tautan toko online opsional: https saja, tautan editor (`/studio`, `sessionId=` dll) ditolak. Catatan bayar yang
    memuat PIN/password/OTP/CVV ditolak. Nomor WA dinormalisasi ke 62….
  - Diuji lokal (D1 + mock AI): ide (sanitasi `<script>`, rentang dibalik → diurutkan, ide kosong dibuang), validasi tautan
    & PIN, penjualan 3× paralel → 1×201 + 2×409, saldo +44rb sekali, user lain → 404. **Belum**: respons AI asli.
- **2026-11-04 (branch claude/ladangku-3) — tab Target Ladangku DIHAPUS (permintaan Bos: ikut menghitung gaji yang
  kategorinya bukan "Gaji"), live #126.** `TargetView.tsx` dihapus; `#target` jatuh ke tab Jual. `prefs.cuanTarget`
  di Worker dibiarkan (tidak dipakai UI, tidak berbahaya).
- **2026-11-04 (branch claude/ladangku-2) — Ladangku tab Tagih & Target, live #125. Tanpa migrasi.**
  - Ladangku jadi 3 tab (hash `#jual` / `#tagih` / `#target`) di `src/components/ladang/LadangView.tsx`.
  - **Tagih** (`TagihView.tsx`): piutang belum lunas (`paidByDebt`/`debtRemaining`, hanya IDR), "Ingatkan" = `wa.me/?text=`
    (3 nada, kontak dipilih user — tanpa API WA), "Sudah bayar" = `debtService.pay` lunas penuh.
  - **Patungan** `POST /api/member/debts/split` (`handleSplitDebt`): bagi rata rupiah bulat (sisa ke orang pertama, jumlah =
    total persis), maks 20 nama (dobel beda huruf besar dibuang), rekening IDR WAJIB (kolom account_id NOT NULL + FK —
    'General' gagal FK). `apply_balance` (default true): saldo −(total−bagianku) untuk piutang (`balanceApplied`) +
    pengeluaran bagianku (kategori pilihan) lewat `quickTxBalanceStatements`. Anti dobel: `request_id` UUID klien →
    `payload_json.splitId`; baris berikutnya bersyarat EXISTS baris pertama. Diuji: 3× paralel → 1×201 + 2×409, saldo −350rb
    sekali; 100rb/3 = 33.334+33.333+33.333; tanpa potong saldo → saldo tetap.
  - **Target** (`TargetView.tsx`): cuan = pemasukan bulan ini selain Gaji/Hasil Investasi/kategori investasi, tanpa
    related_type debt/transfer/investasi. Target per bulan di `prefs.cuanTarget` (PUT /api/member/preferences, 0–1e11).
  - Buka toko (website publik) sengaja TIDAK dibuat (risiko hosting konten user/penipuan) — tunggu keputusan Bos.
- **2026-11-04 (branch claude/ladangku) — Ladangku (jual barang nganggur), live #124. Tanpa migrasi.**
  - Halaman `/membership/ladang` + `/app/ladang` (`src/components/ladang/*`), fitur `ladang` (menu Fitur, default nyala untuk
    user tanpa preferensi; `PREF_FEATURES` Worker ikut). Tombol "Jual di Ladangku" di editor Barangku (`?item=<id>`).
  - `POST /api/member/items/appraise`: AI (gemini-2.5-flash, fallback lite) + **plugin web OpenRouter (BERBAYAR per request,
    disetujui Bos)** → harga bawah/wajar/atas/cepat laku + judul & deskripsi iklan. Kuota **5×/user/hari** (`metadata_json
    $.appraiseAi`, atomik, dikembalikan kalau AI gagal) + `AI_PARSE_RATE_LIMITER`. Tautan iklan HANYA dari `annotations`
    url_citation (tautan karangan model dibuang — diuji). Kill switch: var `OPENROUTER_APPRAISE_WEB=false`.
  - `POST /api/member/items/:id/sell {price, account_id|null, date}`: satu batch — INSERT pemasukan (Pemasukan › Jual Barang,
    related_type 'item') bersyarat `status='aktif'` + saldo/total via `quickTxBalanceStatements` + item `terjual`
    (manual_value = harga laku). Diuji 3× paralel → 1×201 + 2×409, saldo naik sekali. Rekening wajib IDR.
  - Barang di luar Barangku: "Sudah laku" = `addTransaction` pemasukan biasa (applyBalance).
  - **Belum terverifikasi**: respons asli OpenRouter + plugin web (format `annotations`, kualitas harga) — lokal pakai mock.
    Cek setelah deploy dengan 1–2 taksiran sungguhan.
- **2026-11-04 (branch claude/koleksiku-2) — Koleksiku tahap 2, live #123:**
  - **Migrasi `cloudflare/migrations/0026_collectible_alerts.sql` (ALTER TABLE collectibles ADD COLUMN alert_price REAL)
    dijalankan Bos di D1 Console.** Tanpa kolom ini cron :45 diam (return), PUT cetakan tetap jalan (`.catch`).
  - **Steam (CS2)**: `POST /api/member/collectibles/steam/import {profile?}` (URL /id/, /profiles/, steamID64; kosong = profil
    tersimpan `users.metadata_json $.steam {id,syncedAt}`), jeda 2 menit/user. Inventaris publik
    `steamcommunity.com/inventory/<id64>/730/2` (maks 2 halaman × 2000), hanya `marketable = 1`, dikelompokkan per
    `market_hash_name` (= `ref_id`, kind `steam`). Sinkron ulang: jumlah diperbarui, yang hilang DIHAPUS (hanya kalau
    inventaris lengkap & tidak terpotong batas 2000). `DELETE /steam` = putuskan + hapus semua item Steam.
  - Harga Steam: Skinport `sales/history` (median 7 hari, 50 nama/panggilan). **Dari wrangler dev lokal Skinport selalu 406**
    (header `Accept-Encoding: br` jadi `identity` di proxy sandbox — terlihat di httpbin) → cadangan **Steam Market
    priceoverview** (USD, maks 15 nama/panggilan; harga Steam lebih tinggi dari Skinport). Di produksi BELUM terverifikasi
    apakah Skinport lolos (flag `brotli_content_encoding` aktif via compat date) — cek log setelah deploy.
  - **Progres set**: `GET /pokemon/sets` → kartu unik per set (`ref_id` sampai '-' terakhir) vs `cardCount.official` TCGdex
    (`/v2/en/sets/:id`, cache 24 jam), maks 20 set.
  - **Cron** (trigger tiap menit): menit :25 `refreshStaleCollectiblePrices` (8 kartu + 50 nama Steam paling basi lintas
    user), menit :45 `sendCollectiblePriceAlerts` (selisih ≥20% DAN ≥Rp50.000 × jumlah vs `alert_price` → 1 push/user,
    maks 12 user/jalan, klaim bersyarat `alert_price = old`; NULL = isi diam-diam). Toggle notifikasi `collectibles`.
  - Diuji lokal (D1 lokal + mock inventaris): import, privat → pesan jelas, sinkron ulang (hapus 4 tambah 1), POST
    kind steam ditolak, PUT nama/manual_value item steam diabaikan, sets, cron :25 update harga, cron :45 baseline lalu
    1 push (gabung nama sama), jalan ulang tidak dobel, +5% tidak dikirim. **Belum**: inventaris CS2 publik asli (yang
    dicoba semua privat/kosong), Skinport dari Cloudflare produksi.
- **2026-11-04 (branch claude/koleksiku) — Koleksiku tahap 1, live #122:**
  - **Migrasi `cloudflare/migrations/0025_collectibles.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy** (2 tabel:
    `collectibles`, `collectible_value_history`).
  - Tab Kekayaan `#koleksi` + `/app/koleksi` (`src/components/koleksi/*`). Jenis: `pokemon` (data & harga dari **TCGdex**
    api.tcgdex.net — publik, tanpa kunci; pokemontcg.io ditolak karena 5/8 percobaan 500/502) dan `lainnya` (nilai manual).
    Steam = tahap 2 (Skinport API butuh header `Accept-Encoding: br`; inventaris Steam publik bisa dibaca).
  - API `/api/member/collectibles` (+ `/pokemon/search`, `/pokemon/card/:id`, `/refresh`, `/:id`, `/:id/photo`), maks 2000/user.
    Harga diperbarui saat Koleksiku dibuka (`POST /refresh`, kartu > 20 jam, cache 12 jam) — BUKAN cron (cron gratis 50
    subrequest/jalan). Tiap refresh/perubahan → titik `collectible_value_history` hari itu (grafik).
  - Nilai IDR: `src/lib/collectibles.ts unitValueIdr` (cek kurs ada — `convert()` mengembalikan angka mentah kalau kurs
    kosong) = `snapshotCollectibleValue` Worker. Masuk Kekayaan bersih (`computeNetWorth.collectiblesValueIdr`).
- **2026-11-04 (branch claude/langgananku) — Langgananku + Radar, live #120:**
  - **Migrasi `cloudflare/migrations/0024_subscriptions.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy.**
  - Memantau langganan (BUKAN Transaksi Rutin; tidak mencatat transaksi). API `/api/member/subscriptions` (GET/POST,
    `/:id` PUT/DELETE), maks 200/user. Jadwal = `anchor_date` + kelipatan siklus (mingguan/bulanan/3bulan/tahunan,
    tgl 31 → hari terakhir bulan) — `src/lib/subscriptions.ts nextCharge` = SQL cron (diuji 0 beda).
  - Cron harian `sendSubscriptionReminders`: H-1 sebelum ditagih (aktif), H-2 sebelum masa coba habis (coba), maks 30/user,
    toggle notifikasi `subscriptions`. Push → `/membership/langganan` (app: `/app/langganan`).
  - Katalog 47 layanan `src/lib/subscriptionCatalog.ts` (harga = PERKIRAAN). Logo (live #121): ikon HD diunduh SAAT DEPLOY
    oleh `scripts/fetch-logos.mjs` ke `/logos/<domain>.png` (cek nama aplikasi `app:`), `SubLogo` tidak memakai /api/logo
    (Worker gagal ke API Apple → favicon pecah & lambat); tanpa file → huruf warna merek. Radar: `radarScan` lokal (tanpa AI) atas pengeluaran **30 hari** (keputusan Bos):
    cocok katalog = "pasti", nama sama ≥2× nominal ±15% jarak teratur = "mungkin". Animasi `RadarScan.tsx`.
  - Juga di branch ini: Kotak Masuk + lonceng hanya di halaman Keuangan (`Header.tsx`, prefix dari `keuanganNav`);
    Kekayaan dirapikan (judul+Tambah satu baris, tab baris sendiri & label pendek di HP, grup kosong → baris
    "Belum dicatat", urutan Kas→Tabungan→Investasi→Barangku→Piutang→Kewajiban, komposisi "<1%", grafik HP 110px).
  - Menu: fitur `langganan` (features.ts + PREF_FEATURES Worker, bawaan ON untuk user baru), navGroups Transaksi,
    app Lainnya → Langgananku. Tahap 2 (belum): deteksi harga naik, cek dobel, status sudah dibayar.
- **2026-11-04 security check (branch claude/security-cron-flood):** 🟠 cron pengingat bisa dibanjiri satu akun
  (LIMIT global) → diperbaiki dengan batas per user `ROW_NUMBER() OVER (PARTITION BY user_id)` di 4 cron + hutang
  disaring H-3/H-1 di SQL; foto barang ≤2 MB + 12/menit; tanggal 2026-02-31 ditolak. Rincian & bukti:
  `.claude/skills/security-check/references/triaged.md`.
- **2026-11-04 (branch claude/fitur-barang) — Barangku, live #117 (migrasi 0023 dijalankan Bos? cek "Fitur Barangku belum aktif"):**
  - **Migrasi `cloudflare/migrations/0023_items.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy**
    (tanpa tabel: API balas 503 "belum aktif", Ringkasan Kekayaan tetap jalan, cron garansi dilewati).
  - API `/api/member/items` (GET/POST), `/:id` (PUT/DELETE), `/:id/photo` (GET/PUT/DELETE, R2 `items/<user>/<id>-<acak>`,
    JPG/PNG/WebP ≤5 MB, hanya pemilik). Maks 500 barang/user. Reset data & hapus user (admin) ikut hapus foto.
  - Cron harian `sendWarrantyReminders`: H-30 & H-7 sebelum `warranty_until`, klaim `warranty_reminded_for`, toggle `warranty`.
  - UI: tab Kekayaan `#barangku` + `/app/barangku` (komponen sama `src/components/barangku/*`), nilai sekarang
    `src/lib/itemValue.ts` (susut per kategori, mode auto/tetap/manual), masuk Kekayaan bersih (`computeNetWorth.itemsValueIdr`).
  - Teruji: wrangler dev lokal (CRUD, validasi, akses user lain 404, foto, cron 2× tanpa dobel, reset hapus foto) + Playwright mock.
  - Tahap 2 live #118: `POST /api/member/items/scan` (AI OpenRouter baca foto barang/struk → saran,
    tidak menyimpan; rate limit AI parse; harga/tanggal/garansi hanya kalau tercetak). Form: pilih foto barang baru → AI
    otomatis, isi kolom kosong saja, foto struk tidak dipakai sebagai foto barang. "Jadikan barang": daftar transaksi web
    (ikon 📦 saat hover / tombol di HP web) & detail transaksi app → `?dari=<id>` → form terisi nama, harga IDR, tanggal.
    Fitur Koleksi terpisah (nanti).
- **2026-11-04 (branch claude/app-skor-sisa):**
  - Live #115: Skor Kesehatan di Beranda app HP (`AppHealthScore`), "Masa aktif sisa N hari" di /app/profile.
  - Live #116: **jatuh tempo hutang/piutang** di `payload_json.due` (`{date}` sekali / `{day}` tiap bulan,
    tanpa migrasi). POST/PUT `/api/member/transactions` terima `due` (hanya type debt; PUT `due:null` = hapus,
    ganti due menghapus `dueRemindedFor`). `sendDebtDueReminders` (cron harian): H-3 & H-1, sisa = pokok − bayaran
    tertaut, klaim `payload_json.dueRemindedFor`, ikut toggle `bills`. UI: DebtModal & HutangPanel web
    (`DueDateInput`), AddDebtSheet/DebtDetailSheet/daftar app (`DueDateField`), helper `src/lib/debtDue.ts`.
    appUrl: `/membership/kekayaan#hutang` → `/app/debts`, `?pengaturan=paket` → `/app/profile`.
    Teruji: wrangler dev lokal (cron 2× tanpa dobel, validasi API) + Playwright mock. Belum: push sungguhan.
- **2026-11-03 malam, deploy #114 (3 ide Tower di-ACC Bos):**
  - Mode gelap web sisa: Investasiku, Kekayaan/Tabungan, Kotak Masuk (`.web-keep` di kartu yang selalu gelap).
  - `sendPlanExpiryReminders` (cron harian): push H-3 & H-1 sebelum `expired_at` (trial/PRO), klaim
    `$.prefs.planRemind`. Belum: email & "sisa N hari" di /app/profile.
  - `sendBudgetAlerts` (cron menit, tiap jam menit ke-5): anggaran kategori 80% lalu 100%, state
    `$.prefs.budgetAlert`, CAS. `sendBillReminders` (harian): transaksi rutin Pengeluaran/Tabungan H-3,
    klaim `payload_json.remindedFor`. NOTIFY_KEYS + `budget`, `bills` (toggle di Pengaturan → Notifikasi).
    Hutang/cicilan H-3 tidak bisa: tabel hutang tak punya tanggal jatuh tempo.
  - Skor Kesehatan Finansial (`src/lib/healthScore.ts`, `HealthScoreCard`) di dashboard web saja, dihitung
    di browser. Belum: versi HP, kartu bagikan.
  - Belum terverifikasi di produksi: ketiga push baru (butuh kondisi data nyata).
- **2026-11-03 malam (live setelah deploy ini):**
  - Sesi app native permanen seperti PWA: /masuk & /auth/login kirim `isPwa: true` juga untuk Capacitor
    (`isNativeApp`). Dulu 30 hari & dihitung sesi web (bisa ditendang MAX_CONCURRENT_WEB_SESSIONS).
  - Tag HP lengkap: `src/components/app/AppTagChips.tsx` (pilih + "Tag baru" → prefs.tags), dipakai form & detail
    transaksi (detail: tiap ketuk PUT {tags}, juga untuk transfer/tertaut).
  - Mode gelap web +6 halaman (lihat komentar `src/lib/webTheme.ts`); kelas `.web-keep` untuk kartu yang selalu
    gelap. Belum: Investasiku (pakai .web-keep di kartu nilai + tombol kembali + bar bawah), Kekayaan, Kotak Masuk.
  - Tower: ide Import mutasi → diterapkan; ide Pengingat pintar diberi `catatanDev` (yang sudah/belum ada).
    (Ketiga ide itu sudah dikerjakan — lihat entri deploy #114 di atas.)
- **Cron pengingat per menit** (c15533c, live deploy #111): akun Cloudflare = **Workers Free, maks 5 cron per AKUN**
  (deploy 273a32e gagal saat menambah trigger ke-4 di worker ini). Trigger `*/10` diganti `* * * * *`: tiap menit
  `sendDueReminders`; menit kelipatan 10 (`event.scheduledTime`) tugas lama 10 menit (promo, pengingat harian, Gmail,
  Slack). JANGAN menambah trigger baru — gabungkan ke cabang yang ada. Belum dipantau di produksi (cek pengingat ±1
  menit & video promo/Gmail tetap jalan).
- **Angka app HP = web** (6a54e55): beli/jual investasi netral (`txKind`), Beranda Pemasukan tanpa transfer masuk,
  Statistik tanpa investasi, ringkasan /app/transactions via txKind.
- **Tag di app HP** (`claude/app-tag`, 2026-11-03): sheet Tambah Transaksi menampilkan chip tag (prefs.tags, hanya
  kalau Tag nyala & ada daftar; bukan transfer), maks 5; quickTxService kirim tag lewat PUT /transactions/:id setelah
  quick-transaction (tanpa ubah Worker; gagal tag ≠ gagal transaksi). /app/transactions: chip tag per baris, filter
  per tag, pencarian ikut nama tag. Belum: membuat tag baru dari HP (tetap lewat Pengaturan web), ubah tag transaksi
  lama di HP.
- **App HP Tabungan** (`claude/app-target-tabungan`, 2026-11-03): kartu target di `/app/savings` kini ikon + warna
  (`targetIcon`/`targetColor` dari lib/targets, sama dengan web), nama target, progres berwarna, "🎉 Tercapai",
  "N bln lagi · Rp X/bln" (`neededPerMonth`). Target tanpa setoran tetap tampil; target di depan. Daftar
  "Setoran otomatis" hanya target dengan nominal > 0 (dulu "Rp 0 tiap bulan").
- **Rilis APK ke GitHub Releases** (c10aa1e, 2026-11-03): workflow manual `release-android.yml` (isi versi 1.2.3 →
  APK bertanda tangan kunci tetap → Release `v<versi>` + `leosiqra-<versi>.apk`). versionCode = 100 + nomor run.
  BELUM bisa jalan sampai Bos mengisi secret `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (keystore dibuat Bos di Termux — bukan kunci Play Store). Pertama kali
  pasang rilis: hapus APK debug dulu (beda kunci). Deploy #106 (tablet, /masuk, notifikasi) live; APK debug dengan
  presentationOptions = run Build APK Android #3.
- **App native: tablet, login app, notifikasi saat app dibuka** (`claude/app-tablet-login`, 2026-11-03):
  - Tablet (Capacitor, sisi layar terpendek ≥ 600dp, `src/lib/device.ts` `isNativeTablet`) → AppShell mengalihkan ke
    `/membership/dashboard` (tampilan web). Layout /membership di native: initNativePush + tombol back Android
    (Ringkasan → minimize), belum login → `/masuk`. HP tetap /app.
  - Halaman masuk app `/masuk` (email, sandi, Lupa sandi, "Belum punya akun? Daftar" → /auth/register): dipakai saat
    belum login di native (AppShell, logout Profil /app, /membership). Web tetap /auth/login & /mulai. Tanpa Google
    (OAuth Google diblokir di WebView).
  - Push saat app di depan: Android tidak menampilkan notifikasi FCM; `capacitor.config.ts`
    `PushNotifications.presentationOptions` ["badge","sound","alert"] → plugin menampilkan notifikasi sistem
    (BUTUH APK BARU). Event `leosiqra:push` memuat ulang lonceng. Belum diuji di HP.
- **Input suara app Android** (ea3f686, live 2026-11-03): perekam WebView selalu "Izin mikrofon ditolak" karena
  manifest tidak punya `MODIFY_AUDIO_SETTINGS` (BridgeWebChromeClient Capacitor meminta itu + RECORD_AUDIO).
  Sementara: di native, NotAllowedError → pengenal suara bawaan HP (plugin speech-recognition). Permanen: izin
  sudah ditambah di manifest → perlu build APK baru (`build-android.yml`) & pasang ulang. Belum dicoba Bos di HP.
- **Push native Android (FCM) AKTIF** (2026-11-03): migrasi 0022 dijalankan via API D1 (sesi Termux, atas
  perintah Bos), secret `FCM_SERVICE_ACCOUNT` terpasang, APK debug (`leosiqra-debug-1`) dipasang di HP Bos →
  token terdaftar → pengingat tes MUNCUL sebagai notifikasi HP. Sisa: rilis Play Store (keystore lama belum
  ketemu, `versionCode` masih 1), iOS belum (perlu Firebase Messaging di app iOS).
  Live juga (d28645a): di app HP, ketuk pengingat bernominal (push native & daftar Notifikasi /app) membuka
  sheet **Tambah Transaksi** terisi nominal+catatan, kategori dikosongkan (wajib pilih) — `src/lib/txPrefill.ts`
  (`openAppNotificationUrl`, antrean `pending` sampai layout tab terpasang). Web tetap ke Input Cepat. Belum dicoba
  Bos di HP setelah deploy.
- Live (2026-11-03 sore, `claude/input-hp-v2`): **form Tambah Transaksi app HP v2** (permintaan Bos, contoh disetujui):
  panel warna atas (merah Keluar / hijau Masuk / ungu Transfer) berisi kapsul jenis, tombol kalkulator & ✨, nominal
  besar, pil kategori + pil "rekening · tanggal"; kategori satu baris ikon bulat (`CategoryGrid layout="row"`,
  "Lainnya" = semua petak); pil kedua membuka Detail (rekening/Dari-Ke, tanggal, catatan; keypad disembunyikan);
  transfer = kotak Dari ⇄ Ke; keypad datar `AmountKeypad variant="flat"` (000 untuk IDR/KHR, "." untuk USD dll.,
  kalkulator lewat tombol panel); satu tombol Simpan bergradasi. `BottomSheet bare`. Logika simpan TIDAK berubah
  (diuji Playwright + API tiruan: payload quick-transaction benar, Batalkan muncul). Sheet lain yang memakai
  AmountKeypad/BottomSheet tidak berubah (prop baru opsional).
  v3 (masukan Bos dari HP): "Lainnya"/pil kategori membuka semua kategori TANPA keypad (keypad kembali setelah
  kategori dipilih atau nominal diketuk — "Ketuk nominal untuk mengetik"); baris ringkas otomatis bergeser ke
  kategori terpilih; pilihan rekening = kartu 2 kolom dengan logo (logoUrl → matchIndonesianInstitutionLogo →
  emoji jenis) + saldo (ikut sembunyikan-saldo `useBalanceVisibility`; tanpa sen untuk IDR/KHR).
  v4: lembar Detail + tombol Selesai DIHAPUS — semua satu halaman. Panel atas: pil kategori, pil rekening (logo
  kecil), pil tanggal. Rekening & tanggal = pop-up di dalam sheet (`picker` "acc"/"to"/"date"), satu ketukan
  memilih & menutup. Catatan = kolom tipis di bawah kategori. Transfer: Dari/Ke dengan logo, masing-masing pop-up.
  v5: tombol ✨ = mode AI — keypad, kategori & catatan disembunyikan, tampil 3 tombol besar Suara / Foto struk / Ketik
  (`SmartBar layout="tiles"`; layout bawaan "bar" di /input-cepat tidak berubah). Setelah AI mengisi, mode AI
  tertutup otomatis → form biasa + catatan "Terisi dari …". Suara & foto memakai AI sungguhan (belum dicoba di HP
  setelah perubahan ini; di headless hanya jalur Ketik yang diuji).
- Live (0b277e8, 2026-11-03): **form Tambah Transaksi app HP satu layar** (pilihan Bos) — `AddTransactionSheet` +
  `src/components/app/CategoryGrid.tsx` (petak ikon, urut paling sering dipakai, "Lainnya", pil sub-kategori),
  rekening jadi pil (`AccountPills`), tanggal+Catatan satu baris, SmartBar dilipat ke tombol ✨, keypad tombol `000`
  (AmountKeypad dipakai sheet lain juga). Diuji Playwright + API tiruan (tanpa font emoji); simpan sungguhan & data
  asli belum dicoba Bos. Usulan terbuka: tampilan nominal "IDR 25,000" → "Rp 25.000".
- Token D1 lokal (cek/migrasi dari HP) hanya ada di HP Termux: `/data/data/com.termux/files/home/.config/leosiqra/cloudflare.env`.

## Status produksi

- **Live (main = produksi)**: Koin & Referral (Kawananmu), lampiran struk (R2),
  Aplikasi terhubung `/membership/aplikasi` (tidak di menu) via Composio:
  Google Calendar, Gmail → Kotak Masuk, Google Sheets, Notion, Slack → Kotak
  Masuk; Claude & ChatGPT (MCP). Kotak Masuk web `/membership/kotak-masuk` dan
  HP `/app/inbox`. Aktivasi aplikasi pakai koin (`APP_ACTIVATION` di Worker:
  Calendar/Sheets/Notion/Slack 200, Gmail 500 koin per 30 hari; PRO gratis).
- Perbaikan security check 2026-10-27 juga sudah live: Kotak Masuk tidak
  menandai "bukan transaksi" saat AI gangguan (`ai_unavailable`), streak koin
  per user, cek NONAKTIF atomik di tukar PRO. Hasil audit:
  `.claude/skills/security-check/references/triaged.md`.
- Halaman **Impor** `/membership/impor` juga sudah live (2026-10-28): CSV/XLSX di
  browser, PDF BCA, PDF lain & tangkapan layar via AI (kuota 40/hari), tinjau per
  baris, cek dobel, riwayat + Batalkan, ekspor CSV; hapus transaksi impor tidak
  lagi membalik saldo/total. Pembacaan AI sungguhan belum diuji di produksi.
- Menu Profil baru + versi **v3.0.1** juga sudah live (2026-10-28). Versi ada di
  `src/lib/version.ts` & `package.json`; versi Android/iOS native belum diubah.
- Koin baru `LeoCoin` (warna Leosiqra + cetakan singa maskot) & avatar Profil
  simetris juga sudah live (2026-10-28).
- Pop-up **Fitur** di Pengaturan sudah live (2026-10-28): × matikan / + aktifkan
  fitur menu samping, disimpan di `$.prefs.features` (validasi `PREF_FEATURES` =
  `FeatureId` di `src/lib/features.ts`; null = 5 bawaan). Hanya visibilitas menu;
  belum berlaku di menu aplikasi HP (`/app/*`).
- **Template kategori v1** sudah live (2026-10-28): 15 grup (`CATEGORY_TEMPLATE` di
  `src/lib/defaultCategories.ts` = Worker), jenis kategori di `$.prefs.categoryKinds`,
  sinkron user lama lewat POST `/api/member/categories/template` (sekali per user,
  flag `$.prefs.categoryTemplate`, hanya menambah). Tampilan Kategori & Anggaran
  baru (kartu ringkasan, cincin %). Grup yang dihapus user tidak muncul lagi.
- View **Target** di Pengaturan → Uang sudah live (2026-10-28): target = recurring
  tipe Tabungan + targetAmount, memakai RecurringModal yang sama.
- Perbaikan **"pindah halaman lemot"** sudah live (2026-10-28, run #39): `cloudflareApi` kini
  menggabung GET yang sama & menyimpannya 20 detik (`clearApiCache` dibuang pada
  setiap request non-GET, `notifyCollectionChanged`/BroadcastChannel, dan saat
  tab aktif lagi); animasi `.page-enter` 0.2s tanpa blur, stagger dipersingkat.
  Lokal: muat awal 18→11 API, pindah halaman 0–1 API (dulu transaksi 2.000 baris
  + auth/me tiap klik). Kalau ada data terasa basi, curigai cache ini dulu.
- Panel Pengaturan selalu mulai dari atas saat dibuka/pindah tampilan (`scrollRef` di `SettingsPanel.tsx`) sudah live (run #40).
- Sudah live (run #41): form **Target baru** (`TargetFormModal`: ikon+warna, nama, nominal,
  tanggal tercapai, setoran otomatis opsional, dana awal dari rekening) dipakai halaman
  Tabungan & Pengaturan → Target; halaman **Tabungan** ditata ulang (kartu target + Setor
  langsung, pos lain, riwayat per tanggal). Worker: payload_json recurring kini juga
  `icon`/`color`/`targetDate` (digabung, bukan ditimpa); Tabungan boleh `amount = 0`
  (target tanpa setoran otomatis) — cron & kalender melewati `amount > 0`; nama target
  dobel ditolak 409. Kategori target = nama awal (ganti nama tidak memutus progres).
  Belum: kartu target di aplikasi HP (`/app/savings`) belum menampilkan ikon/warna.
- Sudah live (run #42): **Transaksi rutin** di Pengaturan (view `rutin`: ringkasan masuk/keluar
  per bulan, daftar, jeda/hapus) + form baru `RecurringFormModal` (uang keluar/masuk, nominal
  besar, chip kategori, rekening, 7 pilihan selang, pratinjau 3 tanggal). Worker: interval baru
  `Dua Mingguan`/`Dua Bulanan`/`Tiga Bulanan` (advanceNextDate, RRULE `INTERVAL=n` di .ics &
  Google Calendar). Diuji lokal: cron mencatat sekali walau dipicu 2×, next_date +2 bulan.
  Halaman lama `/membership/recurring` tetap ada (tautan notifikasi push).
- Sudah live (run #43): halaman `/membership/recurring` ditata ulang (ringkasan masuk/keluar/
  tabungan/sisa per bulan, "7 hari ke depan", filter, kartu jadwal, preset saat kosong) memakai
  `RecurringFormModal`; data lewat `recurringService.listMine()` (API langsung, tanpa filter uid).
- Sudah live (run #44): **Awal periode anggaran** (Pengaturan → Pengaturan, view `periode`: grid tgl
  1–28 + pratinjau periode berjalan). Pref `$.prefs.budgetStartDay` (1–28, default 1, validasi Worker).
  Dipakai: Kategori & Anggaran (web), `/app/budget`, konteks asisten AI (`budgetUsage`), MCP
  `get_budgets` (`budgetPeriodBounds`). TIDAK dipakai (tetap bulan kalender): laporan bulanan,
  insight proyeksi budget, dashboard "Ke mana uangmu" (pakai pemilih bulan).
- Sudah live (run #45): **Tag** transaksi. Pref `$.prefs.tags` = { enabled, list: [{name, color}] }
  (maks 40, warna = CATEGORY_COLORS). Tag per transaksi di `transactions.payload_json.tags` (maks 5;
  POST `tags`, PUT `tags` lewat json_set — key lain di payload_json tetap). Pengaturan → Pengaturan →
  Tag (`TagsView`), pemilih di `AddTransactionModal`, chip + filter `?tag=` + ubah tag per baris +
  kolom Tag di CSV di Riwayat (`/membership/transactions/daily`). Belum: aplikasi HP (`/app`),
  Tambah Cepat/AI/impor belum bisa memberi tag.
- Sudah live (run #46): tampilan HP (<768px) disederhanakan. Ringkasan: tanpa kartu "Hari ini",
  lencana/streak, Insight Mingguan, chip "biasanya jam segini"; Ke mana uangmu maks 4, Terbaru maks 5,
  "Fitur kamu" → "Saldo" (2 kartu). Riwayat: Ekspor/Tambah disembunyikan (ada FAB), periode & filter
  dilipat di tombol "Filter", aksi Tag/Hapus muncul saat baris diketuk. Tablet/desktop tidak berubah.
- Sudah live (run #47): Pengaturan → **Cara catat utama** (pref `inputMode` lama: ketik/suara/foto, kini
  dipakai: tombol + HP, tombol Tambah di menu samping & Riwayat → form / `/input-cepat?mulai=suara|foto`;
  pintasan N tetap form) dan **Keyboard nominal** (pref baru `amountKeypad` standar/kalkulator →
  tombol kalkulator mini `AmountCalculator` di AddTransactionModal & Input Cepat; parser sendiri,
  tanpa eval). User yang dulu memilih suara/foto di onboarding kini tombol + membuka cara itu.
- Sudah live (run #48): Pengaturan → **Shortcut iPhone** (`ShortcutsView`, view `shortcut`): 3 resep Pintasan
  tanpa token — suara (`/input-cepat?mulai=suara`), tangkapan layar (`?mulai=tempel` → tombol baca
  gambar dari clipboard), SMS bank (`?teks=<isi pesan>` → dibaca AI/parser lokal). Semua hanya mengisi
  form; user tetap menyimpan. Belum diuji di iPhone asli (Pintasan, clipboard Safari).
- Sudah live (run #49): Pengaturan → **Pembaca Notifikasi** (`NotificationReaderView`, view `notif-reader`,
  juga `?pengaturan=notif-reader`). Browser tidak bisa membaca notifikasi aplikasi lain, jadi isinya jalur nyata:
  SMS bank (→ Shortcut iPhone), email bank (→ Gmail/Kotak Masuk), dan "Tempel teks notifikasi" →
  `/input-cepat?teks=`. Tanpa perubahan Worker/D1. Notifikasi otomatis Android = butuh plugin native
  (NotificationListenerService) — belum dibuat.
- Sudah live (run #50): resep **Notifikasi aplikasi bank** — Bos
  konfirmasi iPhone-nya punya Pintasan › Automasi › Aplikasi › "Saat saya menerima notifikasi". Resep baru
  `notif` di `ShortcutsView` (Enkode URL → Buka URL `/input-cepat?teks=`), kartu pertama di Pembaca Notifikasi
  membuka Shortcut iPhone dengan resep itu terbuka (`initialOpen`). Nama tindakan "Enkode URL" & variabel
  "Input Pintasan" belum dicocokkan dengan iPhone asli.
  Juga live (run #50): **Impor mutasi jadi pop-up** di Pengaturan (view `impor`, `?pengaturan=impor`; grup
  baru "Impor & ekspor" + Ekspor CSV). Logika halaman Impor dipindah ke `src/components/impor/ImportMutasi.tsx`
  (`inPanel`), `/membership/impor` tetap ada. **PDF berkata sandi** (pdf.js di browser, sandi tidak dikirim).
  **Bug produksi diperbaiki**: semua impor PDF gagal di browser ('No "GlobalWorkerOptions.workerSrc"') sejak
  Impor live — `pdfText.ts` kini memuat `pdf.worker.mjs` ke `globalThis.pdfjsWorker`. Dibuktikan dengan build
  lama vs baru (static export lokal).
  Juga live di web (run #50): **Kartu e-money (NFC)** — bagian native BELUM dirilis (perlu build app) — Pengaturan view `emoney` + `/app/emoney` (menu Lainnya HP),
  komponen `src/components/emoney/EmoneyScanner.tsx`, jembatan `src/lib/emoney.ts`. Plugin native LOKAL
  "Emoney": iOS `ios/App/App/EmoneyPlugin.swift` (didaftarkan di `AppViewController`, dipakai SceneDelegate;
  entitlement NFC TAG + daftar AID di Info.plist), Android `EmoneyPlugin.java` (didaftarkan di MainActivity,
  izin NFC, reader mode). Baca saja: Mandiri e-money (AID A000000018300001 / 0000000000000001; 00B2010400
  BE @12..15, cadangan 00B500000A LE) & BNI TapCash (AID A000424E49100001 / A000424E49999999 / 112233445566;
  9032030000 → 3 byte BE @2..4). APDU dari repo open-source muhakmal/osp-kue-reader & agusibrahim/
  prepaidcard_reader — **belum diuji dengan kartu asli**. Simpan = PUT saldo absolut (idempoten), bukan
  transaksi. Swift belum pernah dikompilasi (tidak ada Xcode di container); Java dicek javac + stub & uji
  parsing. Butuh: kapabilitas "NFC Tag Reading" di App ID Apple, build & rilis ulang aplikasi iOS/Android.
  Aplikasi lama tanpa plugin → layar "Perbarui aplikasi".
  Juga live (run #50): **Impor / ekspor CSV** (Pengaturan view `csv`, `CsvView.tsx`): ekspor per rentang tanggal —
  **Worker berubah**: `export.csv?from=&to=` (YYYY-MM-DD, inklusif, `substr(date,1,10)`, divalidasi; tanpa
  parameter = perilaku lama). Impor CSV kini mengenali kolom **Jenis/Type** (`kind` di ColumnMapping): sebelumnya
  CSV ekspor Leosiqra yang diimpor balik membuat semua pengeluaran jadi pemasukan; baris transfer/hutang dilewati.
  BELUM: pindahan multi-dompet dari app lain (Money Manager, Money Lover, …) — tunggu keputusan Bos.
- Sudah live (run #51): **Pengingat & Notifikasi**.
  - Pengaturan → Pengingat (view `pengingat`, `RemindersView.tsx`, `reminderService.ts`): nama, waktu, nominal
    opsional, ulang sekali/mingguan/bulanan. **Butuh migrasi `0020_reminders.sql`** (tabel `reminders`) — tanpa
    itu API membalas 503 "belum aktif" & cron diam. Worker: `/api/member/reminders` (GET/POST/PUT/DELETE, maks 50),
    cron 10 menit `sendDueReminders` (klaim bersyarat `due_at` → tidak dobel; bulanan pakai `anchor_day` WIB,
    31 → 30/28 tanpa bergeser; tertinggal → lompat ke jadwal berikutnya, 1 notifikasi). Notifikasi dengan nominal
    membuka `/input-cepat?teks=`.
  - Notifikasi: pref baru `$.prefs.notify` {reminders, summary, weekly, monthly} (default true). Ringkasan harian
    00:01 kini bisa dimatikan. BARU: push wawasan mingguan (Senin 10:00 WIB, `computeWeeklyInsights`) & bulanan
    (tgl 1, `buildMonthlyReport`), penanda `$.prefs.weeklySent/monthlySent`. Diuji lokal dengan wrangler dev + D1
    lokal (API, cron dobel, bulanan tgl 31, query kandidat) dan UI lewat Playwright → Worker lokal.
  - (2026-11-03, AKTIF & teruji di HP Bos — migrasi 0022 + secret sudah) **Push native Android via FCM**: plugin
    `@capacitor/push-notifications` (src/lib/nativePush.ts, dipanggil AppShell setelah login: izin → token →
    POST /api/member/native-push-token). Worker `sendNativePushToUser` dipanggil dari `sendWebPushToUser` (semua
    notifikasi lonceng ikut ke HP); OAuth service account RS256 via WebCrypto (diuji dengan kunci RSA nyata).
    Token diikat ke SESI (JOIN sessions saat kirim; logout = berhenti; cron harian hapus token tanpa sesi).
    Butuh: migrasi 0022, secret Worker `FCM_SERVICE_ACCOUNT` (JSON service account), `android/app/google-services.json`,
    build ulang APK. iOS BELUM: APNs wajib HTTP/2, subrequest Worker HTTP/1.1 → perlu Firebase Messaging di app iOS.
    Android: izin POST_NOTIFICATIONS, ikon status `ic_stat_leosiqra` (vector), warna `notification_accent`.
    Status 2026-11-03 sore: `android/app/google-services.json` SUDAH di branch (248b402, project
    `leosiqra-a02fe`). Review keamanan (sesi cloud): 🟠 token per user tidak dibatasi + token palsu (FCM 400
    INVALID_ARGUMENT) tidak pernah dihapus → satu user bisa daftar ribuan token, tiap notifikasinya ribuan fetch →
    cron pengingat/ringkasan habis jatah subrequest untuk user lain. **Wajib tambal sebelum deploy**: maks 5 token
    per user (hapus tertua setelah INSERT) + hapus token saat FCM 400 INVALID_ARGUMENT. 🟡: flag `started` di
    nativePush.ts → login akun lain tanpa tutup app tidak daftar ulang token; URL notif `/membership/*` membuka
    UI web di app. Belum ada workflow build APK (Bos hanya punya Termux, tanpa PC) → usul `build-android.yml`
    (assembleDebug, APK diunduh dari Actions); rilis Play Store butuh keystore lama (lokasi belum diketahui) +
    naikkan `versionCode` (masih 1). Masih menunggu Bos: secret `FCM_SERVICE_ACCOUNT`, migrasi 0022, "gas".
    **Ditambal (2026-11-03 malam, Termux)**: 🟠 maks 5 token/user (`NATIVE_PUSH_MAX_TOKENS`, batch upsert+prune;
    kirim juga LIMIT 5) + hapus token saat FCM 400 soal "registration token" (400 lain, mis. payload salah, TIDAK
    menghapus) — diuji SQLite (1000 token palsu → 5) & klasifikasi error. 🟡 `initNativePush(userId, openUrl, force)`
    daftar ulang saat user berganti / AppShell dipasang ulang (logout→login sesi baru); `toAppUrl`
    (src/lib/appUrl.ts) memetakan URL /membership/* ke /app/* untuk ketuk push & daftar lonceng app.
    Workflow **`build-android.yml`**: APK debug (Actions → Artifacts), manual atau otomatis saat push branch
    `claude/**` yang mengubah android/, package*.json, capacitor.config.ts. Keystore upload Play Store TIDAK ada
    di HP Termux (cek ~/.config/leosiqra-android) — APK debug harus menggantikan versi Play Store (hapus dulu).
  - Live (2026-11-03, deploy eb9effde) Aplikasi HP: `/app/notifikasi` (tab Notifikasi + Pengingat, `?tab=pengingat`),
    lonceng + angka belum dibaca di Beranda `/app`, menu "Pengingat" di Lainnya. Daftar notifikasi dipakai bersama
    (`src/components/notifications/NotificationList.tsx`) oleh lonceng web & HP. `RemindersView` punya varian dark:
    (hanya aktif di /app). Native Capacitor TIDAK punya web push → banner "muncul di tab Notifikasi"; push native
    (FCM/APNs, @capacitor/push-notifications) belum dibuat. Push sungguhan belum dicoba Bos.
- Sudah live (run #52): **Tampilan**.
  - **Mode gelap web BERTAHAP** (keputusan Bos): Pengaturan → Mode gelap (`AppearanceView`, ThemeContext yang sama
    dengan /app, localStorage `leosiqra-theme`). Cara kerja: scope `.web-dark` di globals.css memetakan ulang
    variabel warna Tailwind v4 (slate dibalik, pastel → tint gelap, teks -700+ → terang; `--color-white` TIDAK
    diubah, bg-white dkk dioverride di `@layer utilities`). Kerangka (sidebar, header, tab bar, panel Pengaturan)
    selalu ikut tema; isi halaman hanya rute di `WEB_DARK_READY` (`src/lib/webTheme.ts`, sekarang hanya
    Ringkasan). Halaman berikutnya: cek tampilannya gelap → tambahkan prefix-nya. JANGAN pasang kelas `.dark` di
    scope web (varian dark: milik /app akan terbalik). Banner "Pasang Leosiqra" (root layout) belum ikut gelap.
  - **Tampilkan Leo** & **Tema musiman**: pref `$.prefs.showMascot` / `$.prefs.seasonal` (default true, Worker
    divalidasi). `useLeoPrefs`, `lib/season.ts` (Ramadan–Lebaran perkiraan 2027–2029, Agustus, Oktober,
    Desember) → aksesoris di `LeoMascot` (`season` prop) + hiasan emoji di kartu Ringkasan.
  - Bahasa English: DILEWATI (keputusan Bos) — belum ada sistem terjemahan.
- Sudah live (run #53): **Privasi & keamanan + Perangkat lain**.
  - Privasi: **Izin** (`PermissionsView`: status kamera/mikrofon/notifikasi via Permissions API, tombol Izinkan),
    **Ingatan asisten** (`AssistantMemoryView`, pref `$.prefs.aiMemory` {style, learned, about} maks 600 karakter,
    divalidasi Worker; disisipkan ke prompt Tanya Leo lewat `aiMemoryBlock` — dilabeli catatan user, bukan aturan
    sistem), **Statistik pemakaian** (localStorage `leosiqra:analytics-off`; `WebAnalytics` tidak memuat beacon
    Cloudflare kalau dimatikan). Keamanan akun & Atur ulang data tetap di bawahnya.
  - Pengaturan → Perangkat lain → Pasang di ponsel (`/install`).
- Sudah live (run #54): **Panel Pengaturan ramping** — kelas `.settings-compact` di dialog SettingsPanel
  (globals.css): `--spacing` 0.22rem (semua jarak Tailwind ±12% lebih rapat) + ukuran `text-[Npx]` turun satu
  tingkat; dialog `sm:max-w-lg`. **Posisi gulir per tampilan** (`scrollPos` di SettingsPanel): sub-menu mulai dari
  atas, Kembali memulihkan posisi menu sebelumnya.
- Sudah live (run #55): lapisan panel Pengaturan tanpa `backdrop-blur`. Bos melaporkan "kedipan hitam" saat buka
  panel di tablet (Chrome Android); dari video: 1 frame bagian atas panel tidak tergambar (latar buram gelap
  terlihat) — glitch compositing GPU dengan backdrop-filter. Video diambil sebelum run #55; BELUM dikonfirmasi
  hilang. Kalau masih: coba hapus animasi spring `y` dialog / tambah `transform-gpu`.
- **Live (run #56)** (akun B): **Lonceng notifikasi** di header (`NotificationBell`, portal ke body karena header
  memakai backdrop-filter). Tab Notifikasi (riwayat, tandai dibaca/semua) + tab Pengingat (`RemindersView`).
  Worker: tabel `notifications` (**migrasi 0021**), `recordNotification` dipanggil di `sendWebPushToUser` → semua
  push server tercatat (juga untuk user tanpa langganan push); `/api/member/notifications` (GET, POST read-all,
  POST :id/read); dibersihkan di cron harian (>60 hari, >100/user). Tanpa migrasi: lonceng kosong, bukan error.
- **Live (run #56)** (akun B): dropdown **Tambah Cepat** di header dihapus (permintaan Bos) — header kini hanya
  menu, judul, lonceng. Langkah tur + bagian Panduan soal Tambah Cepat ikut dihapus. Menu Input Cepat di Pengaturan tetap.
- **Live (run #56)** (akun B): kedipan hitam saat buka Pengaturan dari Ringkasan (masih ada setelah run #55) —
  semua blur di bawah overlay dibuang: blob `blur-2xl` + tombol `backdrop-blur` di kartu sapaan dashboard (blob jadi
  radial-gradient), `backdrop-blur` header (bg jadi /95) & tab bar HP. Belum dicek di HP asli — tunggu konfirmasi Bos.
- **Live (run #57)** (akun B): **Ringkasan v2** (dashboard web) — kartu sapaan dengan langit ikut jam + **Leo Buddy**
  (`src/components/dashboard/LeoBuddy.tsx`): Leo ngomong pakai data asli (lewat anggaran, pengingat ≤7 hari, jatah
  harian, ritme vs bulan lalu, kebiasaan jam segini, kategori teratas), ekspresi ikut isi pesan, ketuk Leo → kaget-ketawa
  + pesan berikutnya. Jatah harian = (total anggaran bulanan − belanja kategori beranggaran sebelum hari ini) / sisa
  hari. Baris saldo/keluar/masuk, grafik **Ritme pengeluaran** (`SpendPaceChart`, kumulatif vs bulan lalu + garis
  anggaran), **Catatan terbaru** per hari, **Segera** (pengingat aktif ≤30 hari + tagihan kartu). Tanpa migrasi baru.
  Diuji lokal (wrangler dev + data 2 bulan, HP/desktop, terang/gelap, anggaran sisa/habis).
  + **Pemandangan langit** (`SkyScene.tsx`, animasi `.sky-*` di globals.css): langit ikut jam (pagi/siang/sore/
  malam), matahari melintas busur (05–19), bulan + bintang berkelip + bintang jatuh (malam), awan & burung, siluet
  kota (jendela menyala malam) + hutan. Tanpa blur. Di HP matahari/bulan di pojok kanan atas; dekor musiman cuma desktop.
- **Live (run #58)** (akun B): **judul kecil di header dihapus** (semua halaman member). `Header.tsx` tidak lagi
  fixed/berjudul; lonceng (+ tombol menu ≡ di HP) dipindah lewat portal ke `<HeaderSlot />` di baris judul halaman
  (Ringkasan, Transaksi, Laporan, Rekening, Semua fitur, Kotak Masuk, Tabungan, Transaksi berulang; dua slot
  `sm:hidden`/`hidden sm:flex` → yang terlihat dipakai). Halaman tanpa slot: baris tipis lonceng (+ ≡). `main`
  tidak lagi `pt-16`. Tambah slot ke halaman lain kalau mau sebaris.
- **Live (run #59)** (akun B): dashboard web tidak lagi menghitung **beli/jual investasi** sebagai
  pengeluaran/pemasukan — `isInvestmentFlow` di `src/lib/utils.ts` (cermin `isInvestmentPurchaseRow` Worker,
  index.ts:940: relatedType "investasi" atau pengeluaran berkategori Investasi/Saham/Deposito). Berlaku ke
  Keluar/Masuk, hari ini, Ke mana uangmu, Ritme, jatah harian, kata-kata Leo; barisnya tampil netral di Catatan
  terbaru. Halaman lain (Laporan, Transaksi) belum dicek memakai aturan yang sama.
- **Live (run #60)** (akun B): **Kartu Saya dihapus, dilebur ke Rekening** + rapikan Transaksi/Laporan/Rekening.
  Rekening: ketuk rekening/kartu → `AccountDetail` (saldo atau limit/terpakai/sisa, siklus tagihan kartu, masuk/keluar
  bulan ini, 8 transaksi terakhir, Ubah/Hapus); "Atur urutan" ↑↓ (reorderAccounts, dicek tersimpan setelah reload).
  `/membership/cards` kini cuma redirect ke Rekening (notifikasi lama). Dihapus dari menu, Fitur (id 'kartu' tetap sah
  tapi disaring `isShownFeature`), DEFAULT_FEATURES, Panduan; push tagihan kartu Worker → `/membership/rekening`
  (perlu deploy Worker — ikut workflow). Transaksi: kartu Keluar/Masuk/Selisih, beli/jual investasi = pindah dana
  (`isInvestmentFlow`), PAGE 60. Laporan: 3 kartu ringkasan, kontrol satu baris, donat + daftar berdampingan,
  investasi dikecualikan. `Modal` bersama: tanpa backdrop-blur & tanpa `mt-16` sisa header lama.
- **Live (run #61)** (akun B): **Transaksi dipadatkan** — judul & nominal lebih kecil, Keluar/Masuk/Selisih jadi satu
  kartu tipis 3 kolom, Periode jadi dropdown, Jenis jadi segmented kecil sebaris dengan pencarian, chip filter
  ringkas (13px) + tombol Reset, baris transaksi lebih rapat (ikon 36px, teks 14px).
- **Live (run #62)** (akun B): **mode Pilih di Transaksi** (`components/transactions/BulkBar.tsx`). Tombol Pilih →
  ikon baris jadi centang, pilih sehari lewat lingkaran di judul tanggal, bar aksi melayang (z-60, di atas ajakan
  pasang PWA): Semua, Kategori, Hapus. Pindah kategori hanya kalau semua pengeluaran atau semua pemasukan (bukan
  transfer/investasi), kategori investasi disembunyikan; update kategori saja (saldo tak berubah). Hapus = loop
  `deleteTransaction` (endpoint biasa, saldo dibalik server), id pasangan transfer yang sudah ikut terhapus dilewati;
  berhenti & lapor kalau gagal di tengah. Pilihan disaring ke yang terlihat di filter. Diuji lokal: kategori di server
  berubah, saldo BCA/Tunai kembali persis sebesar 3 transaksi yang dihapus.
- **Live (run #63)** (akun B): **Laporan bulanan** (`components/laporan/ReportExtras.tsx`): mode Bulanan pakai
  **kalender gelembung** (ukuran ∝ √belanja, merah > 1,5× rata-rata, centang hijau = hari hemat, hari ini bingkai +
  titik berdenyut; ketuk hari → rincian + link `Transaksi?tanggal=YYYY-MM-DD`), menggantikan batang harian (batang
  tetap di Tahunan). **Pola mingguan** (rata-rata per hari Sen–Min) dan **Pengeluaran terbesar** (podium 🥇🥈🥉 + 3
  berikutnya) di kedua mode. Transaksi menerima `?tanggal=`.
- **Live (run #63)** (akun B): **Cek hari** (`components/laporan/DayReview.tsx`) — ketuk hari di kalender Laporan →
  modal semua transaksi hari itu: cincin progres + Leo, centang per transaksi (letup + riak hijau, baris pindah ke
  "Sudah dicek"), "Semua sudah benar" → konfeti + Leo senang + "Hari berikutnya", ketuk baris → ganti kategori
  (pengeluaran/pemasukan saja, kategori investasi disembunyikan; ganti = otomatis dicek), panah ←/→ hari. Kalender
  memberi lencana ✓ untuk hari yang semua pengeluarannya sudah dicek. Worker: PUT transaksi menerima
  `reviewed: boolean` → `payload_json.reviewed` (tanpa migrasi; bukan data uang). Perlu deploy Worker.
- **Live (run #64)** (akun B): **Laporan tahunan** — batang bertumpuk diganti **"Bulan demi bulan"** (`YearMonths` di
  ReportExtras): kartu per bulan mulai bulan pertama yang ada catatan, berisi keluar, batang vs rata-rata, cincin
  % ditabung ((masuk−keluar)/masuk), 👑 terhemat / 🔥 terboros, ketuk → Bulanan bulan itu; strip rekor (rata-rata,
  % ditabung, terhemat, terboros, kategori paling naik). "Kategori dari waktu ke waktu" jadi matriks gelembung
  berwarna kategori.
- **Live (run #65)** (akun B): **Laporan dirampingkan** (bulanan & tahunan): judul 30px + label periode, kontrol
  kecil, ringkasan jadi satu kartu tipis 3 kolom (HP format "jt", desktop lengkap — dicek tidak ada teks terpotong
  dengan angka ratusan juta), heading 17px, grafik/donat/podium/pola lebih kecil, gelembung kalender dibatasi px &
  % sel, 👑/🔥 kartu bulan pindah ke sebelah nama bulan, Anggaran ikon saja di HP.
- **Live (run #66)** (akun B): **halaman Anggaran** `/membership/budget` (dulu redirect ke Pengaturan; tidak di menu
  samping — dibuka dari tombol Anggaran di Laporan/Ringkasan & kata Leo). Kartu sisa/lewat + bar dengan penanda hari
  periode + status (Aman/Hampir habis/Terlalu cepat/Lewat) + perkiraan akhir periode; per kategori (bar + penanda,
  sisa/lewat, "terlalu cepat"); "Belum ada anggaran"; **mode Ubah** = semua nominal bulanan diedit di tempat, simpan
  sekaligus (kosong = hapus). Periode ikut budgetStartDay. Pengaturan → Kategori & Anggaran: catatan periode kini
  ikut awal periode (bukan selalu "bulan kalender"), tautan ke halaman Anggaran, tombol tanpa backdrop-blur.
- **Live (run #67)** (akun B): **ganti nama kategori** — Pengaturan → Kategori → detail, ketuk
  nama (ikon pensil). Endpoint baru `POST /api/member/categories/rename {from,to}`: satu `DB.batch` (atomik) mengganti
  `category` di transactions, categories, budgets, recurring + pindah kunci prefs categoryStyles/categoryKinds. Hanya
  baris user dari sesi. 409 kalau nama dipakai kategori lain (gabung kategori belum didukung), 400 untuk kategori
  sistem (hutang/piutang/transfer/top up/tabungan/investasi/saham/deposito) & nama baru berisi "investasi". Diuji
  lokal (wrangler): 29 transaksi + anggaran + ikon/jenis pindah, prefs lain utuh, 409/400/404 benar. Tanpa migrasi.
- **Live (run #68)** (akun B): **ganti nama dari halaman Anggaran** — mode "Ubah" kini juga
  mengedit nama kategori (kolom nama), disimpan bersama nominal (nominal dulu, lalu rename via endpoint yang sama).
  Nama ganda antar isian ditolak di klien; sisanya divalidasi server. Tombol Ubah dapat aria-label (di HP cuma ikon).
- **Live (run #69)** (akun B): **Rekening dirampingkan** — header ramping (h1 26/30 + jumlah rekening),
  kartu saldo gelap dengan bar komposisi kas (warna per rekening + legenda %, ketuk → detail) & chip tagihan kartu
  terdekat, banner keamanan satu baris, baris rekening ringkas (titik warna + % kas), kartu kredit jadi kartu mini
  (h-136, grid 2–3 kolom di desktop) dengan total tagihan di judul, Target pakai cincin progres 2 kolom.
- **Live (run #70)** (akun B): **pusat Kartu kredit** di Rekening
  (`CreditCardHub`, dibuka dari "Kelola"/kartu mini/chip tagihan): carousel kartu (•••• 4 digit + logo jaringan),
  tiket tagihan tercetak + jatuh tempo + min. bayar, "Sudah bayar", "Ubah kartu", belum ditagih/terpakai/sisa limit,
  belanja siklus ini, kartu paling longgar dipakai hari ini, timeline 30 hari (cetak/jatuh tempo).
  Worker: `POST /api/member/accounts/:id/pay {from_account_id, amount, date, ref}` = dua baris transfer
  (Keluar/Masuk, format sama dgn Transfer & Top Up, Masuk ikut punya target_account_id) + kedua saldo dalam satu
  batch; `ref` (payRef di payload_json) bikin kirim ulang/paralel no-op. Akun kartu: `card_last4` (tepat 4 angka)
  & `card_network` (visa/mastercard/jcb/amex/gpn) di payload_json, input salah → 400. AccountModal: field 4 digit &
  jaringan. Diuji lokal: bayar 3,322 jt (saldo BCA & kartu pas), ref sama → duplicate, 3 paralel → 1 masuk, hapus
  sisi Masuk/Keluar (reverse=1) → pasangan ikut terhapus & saldo pulih, validasi 400/404/401. Belum: pindai kartu (AI).
- **Live (run #71)** (akun B): **form kartu kredit khusus** (`CreditCardForm`)
  menggantikan form rekening umum utk kartu (pusat kartu Tambah/Ubah, detail rekening, AccountModal pilih "Credit Card"
  → pindah, modal global 'kartu'; `CardModal.tsx` lama yang tak terpakai dihapus). Pratinjau kartu live (`CardFace`,
  dipakai juga carousel), pilih bank (logo otomatis), nama, 4 digit, tanggal cetak/jatuh tempo via grid 1–28, tagihan,
  limit, minimum bayar, pengingat Mati/H-1/H-3/H-5/H-7, jaringan, warna, hapus kartu.
  Worker: `reminder_days` (0/1/3/5/7) di payload_json, cron pengingat kartu pakai `cardReminderDays` (bawaan tetap
  H-3/H-1/hari H). `POST /api/member/cards/scan {imageBase64}` → {bank, network, last4} via OpenRouter (model
  PARSE_TRANSACTION_MODELS), kuota 20/hari/user (dikembalikan kalau AI gagal), foto tidak disimpan, server hanya
  kembalikan 4 digit terakhir, respons AI tidak di-log. **Belum teruji dgn AI sungguhan** (lokal tanpa API key; UI diuji
  dgn respons tiruan) — cek pindai di production.
- **Live (run #72)** (akun B): **pusat Kartu kredit dirombak** — tampilan utama = tumpukan kartu
  (kartu belakang menyembul 58px, margin negatif berbasis `100cqw / 1.586`) + tips Leo + daftar tagihan 30 hari ke depan
  (tanggal, nominal, warna kartu). Ketuk kartu/tagihan → detail kartu itu: kartu terbang ke atas (framer `layoutId`),
  kartu lain mengintip di belakang, tiket tagihan + Sudah bayar/Ubah, belum ditagih/terpakai/limit, belanja siklus ini
  (animasi berurutan); "Semua kartu" kembali ke tumpukan. Logika angka tidak berubah.
- **Live (run #72)** (akun B): **Rekening & form kartu dirampingkan** — bagian Kartu kredit di
  Rekening jadi daftar ringkas (thumbnail kartu + 4 digit, status jatuh tempo, tagihan/terpakai, bar limit; ketuk →
  detail di pusat kartu), banner keamanan jadi catatan kecil di bawah halaman. CreditCardForm: pratinjau lebih kecil
  dengan tombol "Pindai" menempel, bagian digabung (kartu · tanggal+pengingat · tagihan · tampilan), input lebih padat.
- **Live (run #73)** (akun B): **form kartu: pilih bank** — kolom Bank membuka panel grid logo + cari
  (25 penerbit + "Bank lain"); nama kartu terisi otomatis "Kartu Kredit {bank}" dan tetap bisa diubah (nama yang
  diketik user tidak ditimpa saat ganti bank). Hasil pindai "PT Bank Negara Indonesia" dll. dicocokkan ke daftar.
  indonesianBanks: tambah BSI, Krom, blu.
- **Live (run #74)** (akun B): **logo bank tanpa globe** — build tidak punya NEXT_PUBLIC_LOGO_DEV_TOKEN,
  jadi logo pakai favicon Google (s2) yang mengirim ikon globe kalau situs bank tak punya favicon. LogoImage kini
  menulis ulang URL s2 (termasuk logo_url lama di DB) ke `t3.gstatic.com/faviconV2` TANPA fallback_opts (harusnya error
  kalau ikon tak ada → fallback tampil) + ikon ≤16px dianggap gagal. Picker bank: fallback monogram warna merek per bank.
  OCBC domain → ocbc.id. **Belum terverifikasi** (gstatic diblok di sandbox): cek di production apakah logo yang tadinya
  tampil tetap tampil & yang globe jadi monogram. Logo asli lebih lengkap kalau Bos isi token logo.dev ke build env.
- **Live (run #75)** (akun B): **Leo beraktivitas di Ringkasan** — LeoMascot dapat prop `activity`
  (eat: pegang paha ayam + mengunyah + remah; play: bola memantul, mata ikut, kaki menepuk; coins: lempar koin berputar +
  tumpukan koin; sleep: zzz + gelembung napas). LeoBuddy memilih aktivitas tiap 12 dtk ikut jam perangkat (22–05 tidur,
  11–14 & 18–20 makan, selain itu main bola/koin/makan/santai) + keterangan "Leo lagi …"; diketuk → berhenti 6,5 dtk untuk
  ngomong (mood pesan) lalu lanjut. prefers-reduced-motion: tanpa aktivitas.
- **Live (run #75)** (akun B): **tema musiman = hari raya/tanggal merah Indonesia** (`lib/season.ts`):
  Tahun Baru, Isra Mikraj/Tahun Baru Islam/Maulid (islami), Imlek, Nyepi, Ramadan & Idul Fitri, Jumat Agung & Paskah,
  Hari Buruh, Kenaikan, Waisak, Pancasila, Idul Adha, HUT RI (Agustus), Natal. Halloween dihapus. Aksesoris Leo per hari
  raya (LeoMascot SeasonAccessory) + hiasan kartu + ucapan Leo di hari H. Prioritas: hari H > hari raya terdekat dalam
  rentang > musim panjang (Ramadan, Agustus). Tanggal tetap & Paskah (rumus) pasti; **tabel LUNAR 2027–2029 perkiraan —
  perbarui dari SKB 3 Menteri tiap tahun.**
- **Live (run #76)** (akun B): **AI Leosiqra → "AI Leo"** — orb diganti wajah Leo (SVG ringan di AiOrb,
  dipakai web & /app/assistant/chat; saat mikir mata melirik + cincin berputar), layar sambutan pakai LeoMascot penuh +
  chip saran ringkas, judul halaman ramping (h1 26/30 + HeaderSlot), chat di kartu putih, panel kanan desktop: 2 fitur +
  daftar insight ringkas. AiChat dapat prop `layout` opsional; tidak lagi auto-scroll saat layar sambutan.
- **Live (run #77)** (akun B): **panel Fitur sinkron** — Bos lihat sidebar "12 aktif" tapi panel "5 aktif"
  (fitur aktif tetap di "Fitur lainnya"). Tidak bisa direproduksi lokal; dugaan data basi (useFeatures dulu ambil prefs
  SEKALI per sesi). Kini `refresh()` saat panel Fitur dibuka & saat tab aktif lagi (dilewati saat ada simpan berjalan);
  tile terbang naik/turun antar "Fitur kamu" ⇄ "Fitur lainnya" (framer layoutId). Cek di production.
- **Live (run #78)** (akun B): **Investasiku** = Investasi + Data Pasar jadi satu (`/membership/investment`):
  kartu nilai investasi + alokasi Saham/Deposito/Lainnya, simulasi "Mau taruh berapa?" (preset = deposito aktif user + contoh
  Deposito 4,5%/20%, SBN 6,5%/10%, RDPU 4,5%/0% — PERKIRAAN, bunga bisa diubah, bunga sederhana), daftar portofolio (tab +
  tombol tambah buka modal saham/deposito/investasi_lain, baris → halaman /membership/investasi/*), kolom kanan harga pasar
  (emas/gram, USD/IDR, kripto watchlist, kurs) via hook baru `useMarketData` (logika dari halaman Data Pasar lama).
  `/membership/market-data` → redirect `/membership/investment#pasar`; fitur 'pasar' disembunyikan (id tetap sah);
  menu & label "Investasiku". Rumus total sama dengan versi lama (non-Planned, IDR).
- **Live (run #79)** (akun B): **urutan menu fitur** — `featuresFromIds` kini mengurutkan sesuai FEATURES
  (bukan urutan saat dinyalakan); Investasiku nomor 2 di bawah AI Leo; label menu "AI Leosiqra" → "AI Leo".
- **Live (run #80)** (akun B, tanpa migrasi): **Investasiku layar penuh** — `/membership/investment`
  tanpa sidebar (`FULLSCREEN_PATHS` di `membership/layout.tsx`), tombol kembali ke Ringkasan, dock melayang gelap
  (`InvestShell`, tab di hash URL `#kabar/#sbn/#belajar`): Investasiku (`TabInvestasiku`, isi halaman lama + kartu Kabar),
  Kabar "Radar Leo" (`TabKabar`, saring topik), SBN (`TabSbn`: tangga bunga LPS/BI/SBN, "sebulan dapat berapa", daftar seri),
  Belajar (`TabBelajar`). Worker baru `GET /api/member/kabar`: RSS CNBC Indonesia (market/news/investment), skor relevansi
  ke dompet (kata kunci berbobot), buang video/hiburan/promosi, gabung judul mirip, maks 6 per topik, urut skor × kesegaran,
  cache edge 30 mnt (`kabar/v2`). **Belum terverifikasi**: fetch RSS CNBC sungguhan (sandbox diblok) — kalau kosong di prod,
  cek log `Kabar: gagal ambil`. Angka BI-Rate/LPS/SBN = **data manual** `src/lib/sbnData.ts` per 2026-10-29, WAJIB
  diperbarui saat berubah (halaman memperingatkan setelah 45 hari). Peta yield curve pasar belum dibuat (tak ada sumber data).
- **Live (run #81)** (akun B, frontend saja): **menu Transfer & Top Up dihapus** — fitur 'transfer'
  keluar dari FEATURES (id tetap sah di tipe & Worker) dan dari navGroups/halaman Fitur. `/membership/transactions/topup`
  → redirect `/membership/transactions/daily?jenis=transfer` (Riwayat dengan filter Transfer aktif). Datanya tidak
  berubah (memang baris transaksi type transfer/topup); mencatat tetap lewat Catat Transaksi → Transfer & Top Up.
- **Live (run #82)** (akun B, frontend saja): **halaman Kekayaan** `/membership/kekayaan` —
  Tabungan + Hutang & Piutang + ringkasan kekayaan bersih jadi satu, tab di hash (`#tabungan`, `#hutang`). Halaman lama
  dipindah utuh jadi `components/kekayaan/TabunganPanel.tsx` & `HutangPanel.tsx` (logika uang tidak berubah);
  `/membership/tabungan` & `/membership/transactions/debt` → redirect. Rumus di `lib/netWorth.ts`: kas (rekening
  non-kartu, kurs) + tabungan (setor − tarik) + investasi (non-Planned, nilai kini) + piutang sisa − kartu kredit terpakai
  − hutang sisa (hutang "Kartu Kredit" yg menempel ke rekening kartu tidak dobel). Grafik jejak = mundur dari angka hari ini
  pakai pemasukan/pengeluaran (tanpa investasi/transfer/cicilan hutang) — PERKIRAAN, tertulis di halaman. Fitur menu:
  id 'tabungan' = "Kekayaan"; 'hutang' dinormalisasi ke 'tabungan' (`normalizeFeatures`), Worker tidak diubah.
- **Live (run #83)** (akun B, frontend saja): **rapikan menu** — Laporan Tahunan DIHAPUS (`/membership/annual` →
  redirect `/membership/laporan`, dobel dengan mode Tahunan). Cetak/PDF pindah ke Laporan: tombol "Cetak / PDF"
  (window.print) + kop khusus cetak + CSS @media print di halaman itu (bulanan & tahunan). Dompet Bersama, Impor &
  Kotak Masuk keluar dari menu Fitur (halaman tetap; Dompet Bersama & Impor ada di Pengaturan / Catat Transaksi).
  Kotak Masuk jadi ikon `InboxButton` di samping lonceng (Header), dengan angka usulan menunggu.
- **Live (run #84)** (akun B, frontend saja): **tampilan Hutang & Piutang** (`HutangPanel`) — tabel 15 kolom diganti
  kartu per catatan (sisa, progres pelunasan, sejak/rekening/cicilan/bunga), neraca hutang vs piutang + selisih, saring
  Semua/Hutang/Piutang, modal cicilan dengan tombol 25%/50%/semua sisa + pratinjau sisa. Fungsi uang (cicilan, lunas,
  hapus) TIDAK diubah — catatan: masih multi-request dari klien (bukan batch atomik), sama seperti sebelumnya.
- **Live (run #85)** (akun B, frontend saja): **form Tambah/Ubah Rekening** (`AccountModal`) — pratinjau kartu langsung,
  jenis jadi tombol ikon (tanpa "Investasi" — rekening lama berjenis itu tetap bisa diedit), pilihan cepat bank/e-wallet
  berlogo, input saldo besar + mata uang ringkas. Logika simpan sama.
  `CurrencySelect` dapat prop `compact` & selalu memuat IDR + nilai terpilih (dulu daftar kosong → "-- Pilih --" walau IDR).
  Rencana: form lain menyusul bertahap (Bos minta "semua form").
- **Live (run #86)** (akun B, frontend saja): **Kekayaan → tombol Tambah** (tahap 1). Menu "Tambah ke kekayaan":
  Akun, Kartu kredit, Investasi, Target tabungan, Piutang/utang, Transfer (pakai modal yang sudah ada); Properti/kendaraan
  & Barang/koleksi bertanda "Segera" (butuh tempat simpan baru = migrasi). "Akun" → `AddAccountPicker` (cari + saring,
  26 bank + 9 e-wallet/pembayaran berlogo, Tunai, Kartu kredit, Isi manual) → `AccountModal` dengan prop `preset`
  (nama/jenis/logo terisi; dikirim lewat modalData 'rekening'). Investasi/kripto sengaja tidak jadi rekening.
  `indonesianBanks.ts`: + PayPal, Wise, Revolut.
- **Live (run #87)** (akun B, Worker ikut, tanpa migrasi): **Kekayaan → Tambah → Investasi**
  (`AddInvestmentModal`). Jenis: Saham Indonesia, Kripto, Saham AS & ETF (Harga otomatis: cari ticker →
  `/api/member/stock-search` / CoinGecko search, harga dari `/api/member/stock-price` / CoinGecko simple/price IDR),
  Emas, Reksa dana, Obligasi/SBN, Lainnya (manual), Deposito → modal deposito lama. Saham IDX bisa input lot/lembar.
  Sumber dana WAJIB (keputusan Bos) — simpan lewat `investmentService.entry` (batch atomik, saldo terpotong, transaksi
  tertaut). Worker: pencarian saham kini ikut ETF (quoteType ETF), cache `stock-search-v3`.
  **Bug lama (belum diperbaiki)**: Worker tidak mengonversi mata uang posisi ↔ rekening — posisi USD dari rekening
  IDR memotong angka USD mentah. Form baru MENCEGAH (saham USD wajib rekening USD); form saham/investasi lama masih
  bisa memicunya.
- **Live (run #88)** (akun B, Worker ikut, tanpa migrasi): **Jejak Uang** `/membership/jejak-uang`
  (`components/jejak/JejakUang.tsx`) — versi kita dari "Ikuti uangmu" Oyenza: diagram aliran (Sankey SVG buatan sendiri)
  sumber pemasukan → total → kategori (top 6 + Lainnya) → tempat (judul transaksi, top 3 + "N tempat lain"); di HP 3 kolom
  + rincian tempat saat kategori diketuk. Bulanan/Tahunan. Data = pemasukan/pengeluaran tanpa isInvestmentFlow (sama
  Laporan). Pengeluaran > pemasukan → node "Dari simpanan" (penyeimbang, bukan data). Animasi: pita terbuka kiri→kanan
  (clipPath), partikel mengalir (stroke-dash), node tumbuh; reduced-motion dihormati. Node punya tinggi minimum (MINH)
  → pita beda tebal di kedua ujung. Fitur baru id `jejak` (FEATURES, DEFAULT_FEATURES, navGroups, Worker PREF_FEATURES)
  — user yang sudah punya preferensi Fitur harus menyalakannya sendiri di Atur fitur.
- **Live (run #89)** (akun B, Worker ikut, tanpa migrasi): **logo bank resolusi tinggi + tautkan akun**.
  Bug: logo bank kosong (huruf) di pemilih akun — favicon Google cuma 16px untuk banyak situs bank & LogoImage
  menganggap ≤16px gagal. Kini Worker `GET /api/logo?d=<domain>` (sesi wajib, whitelist LOGO_DOMAINS = daftar di
  `src/lib/indonesianBanks.ts`, SVG ditolak, cache edge 7 hari / 404 1 hari): coba apple-touch-icon → `<link rel=icon>`
  terbesar di beranda → faviconV2. `LogoImage` mengarahkan URL favicon Google untuk domain itu ke /api/logo (berlaku
  juga ke logo lama di DB). **Belum terverifikasi di prod** (sandbox tanpa internet) — kalau masih huruf, cek
  `curl https://www.leosiqra.com/api/logo?d=bca.co.id` dengan cookie sesi.
  Tautkan: rekening punya `purpose` 'belanja'|'nabung' di payload_json (Worker validasi). Pemilih akun menandai bank
  yang sudah dimiliki ("✓ Sudah ada") → layar "Tautkan <bank>": atur belanja/nabung per rekening (+ pasang logo kalau
  belum ada) atau "Tambah rekening <bank> lain". AccountModal punya pilihan "Dipakai untuk". Kekayaan menampilkan label.
  Catatan: purpose saat ini HANYA label/pengelompokan — tidak mengubah cara saldo dihitung.
- **Live (run #90)** (akun B, frontend saja): Tambah investasi → Deposito kini membuka form deposito DI ATAS popup
  (popup Tambah investasi tidak ditutup).
- **Live (run #91)** (akun B, Worker ikut, tanpa migrasi): **logo bank HD dari ikon aplikasi App Store**.
  Bos lapor logo masih ada yang kosong & tidak HD setelah run #89. `/api/logo` kini PERTAMA mengambil ikon aplikasi
  resmi 512px lewat API iTunes (`APP_ICONS` di Worker: App Store ID terverifikasi untuk Livin'/BRImo/wondr/BSI/OCTO/bale,
  sisanya cari nama aplikasi + cocokkan nama penerbit), baru apple-touch-icon / favicon. Cache dinaikkan ke `logo/v2`.
  Belum terverifikasi di prod (sandbox tidak bisa akses Apple/Play Store). Kalau masih ada yang kosong: perbaiki
  `term`/`seller` atau isi `id` (App Store ID) untuk domain itu di APP_ICONS.
- **Live (run #91)** — **Banner "Leosiqra sedang dalam pengembangan"** (akun B, 2026-10-30, permintaan Bos sebelum jeda limit mingguan):
  `src/components/DevNoticeBanner.tsx` — web (di bawah Header membership) & app HP (pil di atas tab bar `/app`), link ke
  Saran. Bisa ditutup; muncul lagi setelah 3 hari. **Matikan** dengan `ENABLED = false` di file itu setelah fase
  pengembangan selesai.
- **Live (run #92)** (akun B, frontend + workflow): **logo bank HD diunduh saat deploy** — log: 36/37 OK (BCA mobile, Livin', OCTO, BRImo, wondr, dll via App Store; blu & Jago via Play). UOB gagal, Citibank salah ambil ikon "Citilink" (seller regex /citi/ terlalu longgar). Run #91 terbukti: ikon App
  Store dari Worker TIDAK muncul (BCA/Mandiri/CIMB masih favicon pecah, BRI dll huruf) — panggilan API Apple dari
  Worker gagal. Kini `scripts/fetch-logos.mjs` dijalankan GitHub Actions (step "Logo bank (HD)", continue-on-error)
  sebelum build: App Store (iTunes lookup/search) → cadangan Google Play og:image, cek nama penerbit, simpan
  `public/logos/<domain>.png` (256px, di-.gitignore). LogoImage: `/logos/<domain>.png` → kalau 404 `/api/logo` → huruf.
  **Cek laporan "Logo bank: N/37 berhasil" di log job deploy**; domain GAGAL → perbaiki term/id/play/seller di skrip.

## Migrasi D1

Dijalankan manual oleh Bos lewat Console D1 (token GitHub belum punya izin D1).
Cek/eksekusi dari HP (akun ini): token D1 lokal di `/data/data/com.termux/files/home/.config/leosiqra/cloudflare.env`
(chmod 600, di luar repo, jangan dicetak). Pakai: `set -a; . <file>; set +a; cd cloudflare; npx wrangler d1 execute
membersite_leosiqra_db --remote --command "..."`. SELECT boleh langsung; tulis/ubah skema → tanya Bos dulu.
- `0017_coins.sql` — sudah (dikonfirmasi Bos).
- `0018_transaction_attachments.sql` — sudah (dicek langsung ke D1 2026-11-03).
- `0019_inbox.sql` — sudah (Kotak Masuk Gmail jalan di produksi).
- `0020_reminders.sql` — sudah (Bos, 2026-10-28; Console D1 butuh SQL tanpa komentar `--` kalau ditempel satu baris).
- `0021_notifications.sql` — sudah (dicek langsung ke D1 2026-11-03).
- `0033_shop_stock.sql` — sudah (dikonfirmasi Bos 2026-11-06, 3 tabel ada).
- `0032_shop_staff.sql` — sudah (Bos membuat akun tim di produksi 2026-11-06).
- `0043_tax_settings.sql` — sudah (dikonfirmasi Bos 2026-11-09).
- `0022_native_push_tokens.sql` — **BELUM** (token push Android/FCM; tanpa tabel: endpoint 503, kirim dilewati — aman).

## Belum terverifikasi di produksi

- Slack: daftar channel & baca pesan (format balikan Composio tidak terdokumentasi rinci).
- Notion: tulis laporan bulanan.
- Gmail: teks "Terhubung sebagai email@…" di cek koneksi.
- Kotak Masuk di HP & panel per sumber (Gmail/Slack) — belum dicoba Bos.
- Shortcut iPhone (Pintasan, Automasi SMS, tempel clipboard Safari) & mode "Ucapkan" (mic otomatis).
- Asisten AI & MCP dengan awal periode anggaran ≠ 1.
- (sesi akun B 2026-10-28) Impor PDF asli (BCA & PDF bersandi) setelah perbaikan pdf.js worker; impor balik CSV ekspor.
- Pengingat: push sungguhan & ketuk → Input Cepat terisi.
- Wawasan mingguan: Senin 2 Nov jalan tapi 0 terkirim (2 pelanggan push tanpa transaksi; Bos tak punya langganan
  push). Live 2026-11-03 (deploy 8996fe8c): kandidat = semua user aktif yg punya transaksi (8 hari / sejak awal
  bulan), selalu masuk lonceng, push hanya pelanggan. **Cek lonceng Senin 9 Nov 10:00 WIB** (3 user: 7b434d,
  dd335d, 0e02e0) & rekap November 1 Des. Catatan: penanda dipasang sebelum hitung → kalau hitung error, user
  itu terlewat minggu itu (console.error saja).
- User dd335d = akun demo `leowendry+demo@gmail.com` (routine Tim Konten): login harian 08.46 WIB (curl,
  promo/demo-seed.mjs) & ±14.45 WIB (Chrome Linux, promo/record.mjs) itu NORMAL, bukan penyusup.
- Resep Shortcut "Notifikasi aplikasi bank" (nama tindakan "Enkode URL"/variabel "Input Pintasan" di iPhone asli).
- Kartu e-money NFC: perlu kapabilitas "NFC Tag Reading" di App ID Apple, build & rilis ulang iOS/Android, tes kartu
  asli (Swift belum pernah dikompilasi).
- Tanya Leo dengan Ingatan asisten terisi (butuh OpenRouter produksi).
- Uji UI di HP Termux ini: `workerd` (wrangler dev lokal) TIDAK bisa jalan (tcmalloc 48-bit VA). Pola yang jalan:
  `npm run build` → `npx serve out -l 4173` → Playwright dengan API di-mock (`page.route`). Chromium dipasang manual
  (unzip chromium-linux-arm64 build 1194 ke ~/.cache/ms-playwright/chromium-1194, executablePath eksplisit; lib via apt).
- Mode gelap: halaman selain Ringkasan belum dicek → tambahkan ke WEB_DARK_READY satu per satu.

## Catatan Impor
- Impor = riwayat: TIDAK mengubah saldo rekening (keputusan Bos 2026-10-28).
  Baris impor: `related_type='import'`, `related_id` = id batch, nama file di
  `payload_json.importName`. Impor lama (sebelum 2026-10-28) tidak punya batch
  → tidak muncul di Riwayat.
- Sebelum perbaikan, menghapus satu transaksi impor dari halaman Transaksi web
  ikut membalik saldo & total → saldo rekening user yang pernah melakukannya
  mungkin sudah bergeser (tidak bisa dideteksi otomatis).
  Dicek ke D1 2026-11-03: 0 baris impor, 0 user pernah pakai kuota AI impor, 0 payload importName
  → tidak ada bukti user terdampak (23 user). Rekonsiliasi saldo: 26/33 rekening cocok
  (initial_balance + transaksi = balance); 7 selisih bukan dari impor. Ditelusuri: BCA Platinum user 7b434d
  = pengeluaran "Investasi" 280 jt bertanggal mundur (tak menggerakkan saldo) − piutang 5 jt; sisa ~14,8 jt
  tak terlacak (dugaan: hapus transfer/piutang sebelum 27 Sep tidak membalik saldo). User 7b434d = akun Bos
  (leo.wendry@gmail.com); Bos konfirmasi 2026-11-03 saldo BCA Platinum = saldo bank asli → tidak perlu tindakan. Cash KHR = baris Transfer Masuk lama tersimpan 32,50 USD
  (tak dikonversi) + Top Up tanpa baris Masuk; saldo kemungkinan benar. Data TIDAK diubah.
- Live (2026-11-03, deploy 353a2725): streak bulan surplus & konteks kategori AI kini juga mengecualikan
  catatan investasi lama tanpa tautan (kategori Investasi/Saham/Deposito, sama dengan isInvestmentPurchaseRow).
- Impor belum ada di aplikasi HP (`/app/*`) — baru versi web.

## Langkah berikutnya / ide

- ~~Pajak Center baru~~ → dikerjakan di 3.25.0 (lihat Menunggu). Catatan lama: PPh final UMKM 0,5% dari omzet Usahaku
  (batas Rp500 jt/tahun tidak kena, setor tgl 15), asisten SPT tahunan (karyawan/usaha/campuran, biaya jabatan 5% maks
  Rp6 jt, zakat pengurang), kalender & pengingat pajak, setelan pajak disimpan di akun (butuh migrasi D1 baru), ekspor
  .xlsx (exceljs sudah ada), desain & animasi baru. Pajak Center sekarang: `src/app/membership/pajak-center/page.tsx`
  (1197 baris, setelan PTKP/PPh21 hanya localStorage, ekspor .xls HTML + window.print).

Pola kerja dengan Bos (lanjutkan sama): Bos kirim screenshot Oyenza per menu Pengaturan →
bikin versi Leosiqra yang **fiturnya nyata tapi desainnya beda** (jangan sama) → uji lokal
(Playwright, ponsel/tablet/desktop) → commit+push branch → lapor ringkas → deploy hanya setelah
Bos bilang **"gas"**. Menu Pengaturan yang sudah dibuat: Fitur, Target, Transaksi rutin, Awal
periode anggaran, Tag, Cara catat utama, Keyboard nominal, Shortcut iPhone, Kategori & Anggaran, Pembaca Notifikasi, Impor mutasi (pop-up), Kartu e-money, Impor/ekspor CSV, Pengingat, Notifikasi.
Semua menu Pengaturan dari screenshot Oyenza sudah dibuat (2026-10-28). Sisa: pindahan multi-dompet dari app
lain (Money Manager dll — tunggu keputusan Bos soal saldo & pembuatan rekening), Bahasa English (dilewati),
mode gelap halaman lain (bertahap), push native di aplikasi HP (FCM/APNs).
Mode HP: Bos minta tampilan HP **simpel** — jangan menambah kepadatan di <768px.

- Tunggu hasil tes Bos untuk poin di atas, perbaiki parser kalau perlu.
- Aplikasi terhubung versi HP (`/app/*`) belum ada — tombol Hubungkan membuka versi web.

## Cara deploy (ringkas)

Hanya setelah Bos bilang **"gas"**: `git push origin HEAD:main` (fast-forward
saja), lalu jalankan workflow `deploy-main.yml` dengan input `konfirmasi: gas`.
Workflow menjalankan tsc + build lalu deploy, dan memberi kabar ke Telegram.

## Routine / tugas terjadwal

Pasang di **satu akun saja**. Akun cadangan menyimpan salinan dalam keadaan
nonaktif dan hanya dinyalakan saat akun utama kena limit (lalu dimatikan lagi)
— kalau aktif di dua akun, notifikasi & aksi terjadi dua kali.
- (2026-11-03) Perbaikan UOB/Citibank di `fetch-logos.mjs` sudah ter-deploy 30 Okt. Tapi workflow `publish-article.yml`
  (deploy artikel 31 Okt) build TANPA `fetch-logos.mjs` → `public/logos` kosong di produksi (logo HD 404, jatuh ke
  /api/logo/huruf). Diperbaiki: step "Logo bank (HD)" ditambahkan ke `publish-article.yml`, lalu deploy-main ulang.
  Setiap workflow yang deploy WAJIB menjalankan `fetch-logos.mjs` sebelum build.
