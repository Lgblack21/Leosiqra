# Serah terima antar-session

Catatan bersama untuk semua session Claude Code (dua akun memakai repo yang
sama, tidak ada ingatan yang terbagi selain file ini dan riwayat git).
**Baca di awal session, perbarui di akhir session, commit & push.**

Terakhir diperbarui: 2026-11-06 (branch claude/bersih-data-tim-stok — siap deploy, menunggu "gas"; main = live #146)

## Siapa sedang kerja

| Akun | Status | Branch | Area |
|---|---|---|---|
| — | — | — | (akun B selesai; main = live #146) |

Isi baris ini saat mulai (mis. "akun B · aktif · claude/xyz · Worker inbox"),
kosongkan lagi saat selesai. Kalau ada akun lain tercatat aktif di area yang
sama, jangan ubah file yang sama — tanya Bos dulu.

## Menunggu

- **2026-11-06 (branch claude/bersih-data-tim-stok) — Bersihkan data tim/stok + rapikan angka kasir. BELUM deploy (tunggu "gas"). Tanpa SQL.**
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
  - Catatan (belum diubah): batalkan catatan stok oleh tim mencocokkan by_name, bukan id akun — tim baru bernama sama
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
