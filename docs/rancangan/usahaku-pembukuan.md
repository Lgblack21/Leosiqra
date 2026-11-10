# Rancangan — Usahaku jadi Pembukuan Usaha

Status: **DI-ACC Bos 2026-11-10** (jawaban bagian 10). Belum ada coding — R1 menunggu "gas" Bos.

## Keputusan Bos (chat 2026-11-10)

1. **Jenis toko** banyak, ambil yang paling banyak dipakai orang; menu & isian menyesuaikan jenis toko.
2. **Usahaku keluar dari Ladangku** → menu sendiri, layar penuh. Ladangku tinggal Jual barang bekas + Tagih.
3. **Uang usaha terpisah dari uang pribadi** (tidak campur lagi). Bisa **transfer dari rekening pribadi
   ke kas/bank usaha** (dan sebaliknya).
4. **Kasir gratis**; marketplace, HPP, laporan lengkap = **PRO**.
5. **Dua tipe jualan**:
   - **Langsung** (IG, WA, offline, website, chat admin) — **tanpa isian biaya**. Dicatat saat pembeli
     bayar. Cara bayar Transfer / COD / Tunai / QRIS, **harga sama** untuk semua cara bayar.
   - **Marketplace / e-commerce** (Shopee, Tokopedia, TikTok Shop, Lazada, …) — **ada isian biaya**.
6. **Biaya marketplace diisi sendiri**, per baris (nama biaya + nominal), **ditotal jadi satu**, dengan
   keterangan (mis. "Biaya admin Shopee"). Tidak ada persen otomatis yang dipaksakan.
7. **Harga reseller** per produk (opsional, biasanya lebih murah) + sakelar "Pembeli reseller" di kasir.

---

## 1. Kondisi sekarang (dicek dari kode, 2026-11-10)

- Usahaku = tab "Usaha" di Ladangku (`src/components/ladang/LadangView.tsx`).
- Tabel: `shops` (katalog di `products_json`: name/price/unit/group — **tanpa HPP**), `shop_staff`,
  `staff_sessions`, `shop_materials`, `shop_stock_moves`, `shop_recipes`. Maks 5 toko per user.
- **Tidak ada tabel penjualan/biaya sendiri**: penjualan = baris `transactions` pribadi (`pemasukan`,
  "Usaha & Freelance › Penjualan", `related_type='shop'`) dan **mengubah saldo rekening pribadi**;
  biaya = `pengeluaran` "Biaya Usaha" (`recordShopSale` / `recordShopExpense` di Worker).
- Laporan (`src/lib/shopReport.ts`): `laba = omzet − biaya` (kas, tanpa HPP). Pajak Center membaca omzet ini.
- Yang belum ada: kas usaha, HPP, jalur jualan, biaya marketplace, reseller, piutang/utang usaha, supplier,
  laba rugi/arus kas/neraca.

## 2. Jenis toko

Dipilih saat membuat toko (bisa diganti). Menentukan istilah, menu yang muncul, dan isian produk.

| Jenis | Contoh | Menu / isian khas |
|---|---|---|
| 🍜 Kuliner | Warung makan, kafe, kedai minuman, katering | Resep → stok bahan, HPP dari bahan |
| 🛍️ Online shop / toko barang | Fashion, skincare, aksesoris, gadget | Stok barang jadi, varian, **marketplace**, reseller |
| 🏪 Kelontong / sembako | Warung sembako, toko grosir | Banyak barang, harga ecer & grosir |
| ✂️ Jasa | Laundry, salon/barber, bengkel, servis HP | Tarif jasa, tanpa stok barang |
| 🎂 Kue & pesanan rumahan | Kue, frozen food, hampers, catering rumahan | Bahan + resep, pesanan/DP (rilis 3) |
| 🎮 Top up game & produk digital | Top up game, pulsa/kuota, token listrik, voucher, PPOB | Modal per transaksi (harga beli dari supplier), margin kecil, **saldo deposit supplier** = kas usaha, tanpa stok fisik |
| 🔁 Dropship / reseller | Jual produk orang lain tanpa stok | Harga beli dari supplier per pesanan, marketplace |
| 🖨️ Fotokopi & ATK | Fotokopi, print, alat tulis | Jasa per lembar + barang |
| 🏠 Sewa & rental | Kos-kosan, rental motor/mobil/alat, sewa kamera | Tarif per hari/bulan, penyewa |
| 🌾 Pertanian & peternakan | Kebun, ternak ayam/ikan | Panen/hasil, biaya pakan & pupuk |
| 💻 Freelance & jasa online | Desain, editing, jasa digital | Tagihan per klien, tanpa stok |
| 📦 Lainnya / umum | Usaha campuran | Semua menu bisa dinyalakan manual |

Daftar ini **terbuka** (keputusan Bos: "kalau ada lagi jenis usaha tambah aja") — jenis baru cukup menambah
satu entri konfigurasi (nama, ikon, menu yang aktif, isian produk), tanpa mengubah alur kasir.

Toko lama otomatis = "Lainnya" (semua fitur yang sekarang tetap ada) sampai Bos/pengguna memilih jenis.

## 3. Tampilan baru (layar penuh, pola Sehatku/Olahragaku)

Rute baru `/membership/usahaku` dan `/app/usahaku` (rute Ladangku lama untuk Usaha dialihkan ke sini).
Pemilih toko di atas (kalau punya >1 toko). Menu bawah:

```
[ Beranda ]  [ Kasir ]  [ Stok ]  [ Laporan ]      ⚙️ Pengaturan (kanan atas)
```

- **Beranda**: omzet & laba hari ini/bulan ini, saldo tiap kas usaha, uang marketplace belum cair,
  stok menipis, tombol besar "Catat penjualan" & "Catat biaya".
- **Kasir**: grid produk tombol besar + keranjang + satu tombol **Bayar** (nyaman 1 tangan di HP).
- **Stok**: barang jadi + bahan (yang sekarang di StockView).
- **Laporan**: laba, laba per jalur jualan, per produk, per reseller (rilis 2).
- **⚙️ Pengaturan**: data toko, jenis toko, jalur jualan yang dipakai, kas usaha, tim, website, tampilan kasir.

## 4. Alur kasir

1. Pilih produk (sakelar **Pembeli reseller** → harga pindah ke harga reseller; nama reseller opsional).
2. **Jual lewat mana?** (hanya jalur yang dinyalakan di pengaturan toko yang muncul)
   - **Langsung**: IG · WA · Offline · Website · Lainnya → pilih **cara bayar** (Transfer / COD / Tunai /
     QRIS) → pilih **kas usaha** penerima → **Selesai**. Tidak ada isian biaya.
     (Opsional, terlipat: "Ongkir/fee COD dipotong kurir" → dicatat sebagai biaya pengiriman.)
   - **Marketplace**: Shopee · Tokopedia · TikTok Shop · Lazada · lainnya → isi **biaya-biaya**:
     ```
     Biaya admin Shopee        Rp 8.000   ✕
     Biaya layanan             Rp 4.000   ✕
     + Tambah biaya   [Admin] [Layanan] [Ongkir] [Voucher] [Komisi affiliate] [Lainnya]
     ─────────────────────────────────────
     Total potongan            Rp12.000
     Uang diterima             Rp88.000
     ```
     Tombol cepat cuma mengisi **nama** biaya (nominal tetap diketik sendiri). Keterangan default
     "Biaya admin <nama marketplace>". Status uang: **Menunggu cair** → tombol **Sudah cair** (pilih kas
     tujuan, boleh ubah nominal kalau beda) nanti.
3. Struk / bagikan WA seperti sekarang.

## 5. Kas usaha & pemisahan uang

- Tiap toko punya **kas usaha** sendiri (mis. "Kas toko", "BCA Usaha", "Saldo Shopee"). Saldo awal bisa diisi.
- Penjualan & biaya toko mengubah **kas usaha**, bukan rekening pribadi; **tidak muncul** di statistik
  pribadi (pemasukan/pengeluaran pribadi tidak lagi kecampur).
- **Transfer pribadi ↔ usaha**:
  - Rekening pribadi → kas usaha = **Setor modal** (di sisi pribadi tercatat sebagai transfer keluar,
    bukan pengeluaran).
  - Kas usaha → rekening pribadi = **Ambil uang usaha (prive)** (di sisi pribadi = transfer masuk).
  - Antar kas usaha (mis. Saldo Shopee → BCA Usaha = tarik dana marketplace).
- **Data lama**: penjualan/biaya yang sudah tercatat di rekening pribadi **tidak diubah/dipindah**
  (aman, tidak menyentuh saldo). Ditampilkan sebagai "riwayat sebelum kas usaha" di laporan.
  Pajak Center menjumlah omzet lama + baru.

## 6. Produk

Field baru per produk: **harga reseller** (opsional), **harga modal/HPP** (opsional; untuk kuliner/kue bisa
dihitung dari resep × harga bahan yang sudah ada), **stok barang jadi** (untuk online shop/kelontong).

## 7. Gratis vs PRO

| Fitur | FREE | PRO |
|---|---|---|
| Kasir jualan langsung, 1 toko, 1 kas usaha, laporan omzet dasar | ✅ | ✅ |
| Jualan marketplace + biaya, status cair | — | ✅ |
| Lebih dari 1 toko / kas usaha, harga reseller | — | ✅ |
| HPP, laba per jalur/produk/reseller, ekspor PDF/Excel | — | ✅ |
| Tim/kasir staf | (ikut aturan sekarang) | ✅ |

(Usul — Bos tinggal koreksi angka/batasnya. Pengguna lama yang sudah punya >1 toko tidak kehilangan tokonya.)

## 8. Urutan rilis

| Rilis | Isi |
|---|---|
| **R1** | Menu Usahaku layar penuh + jenis toko + kasir 2 tipe (langsung / marketplace dengan biaya diisi sendiri) + kas usaha terpisah + transfer pribadi↔usaha + harga reseller |
| **R2** | HPP + laporan laba per jalur, per produk, per reseller; status "sudah cair" marketplace di laporan |
| **R3** | Pesanan & DP (kue/pesanan rumahan), piutang pelanggan, supplier & utang, stok masuk dari pembelian |
| **R4** | Impor Excel penghasilan marketplace, arus kas, neraca sederhana, ekspor rapi untuk KUR/pajak, AI Leo baca buku usaha |

## 9. Teknis (garis besar, detail saat R1)

- Tabel baru (migrasi D1, dijalankan Bos): `shop_accounts` (kas usaha: shop_id, nama, jenis
  kas/bank/marketplace, saldo), `shop_entries` (buku usaha: penjualan/biaya/transfer, jalur, cara bayar,
  reseller, total, potongan, status cair, `items_json`, `fees_json` [{label, amount}]), kolom `shops.kind`
  (jenis toko) + `shops.channels_json`. Produk tetap di `products_json` (tambah `resellerPrice`, `cost`).
- Uang: integer rupiah (bukan float), idempotensi per penjualan (pola `saleId` yang sudah ada), transfer
  pribadi↔usaha atomik (`DB.batch`) supaya tidak bisa terjadi satu sisi saja.
- Kasir staf (`/api/staff/...`), MCP tools toko, webhook website, Pajak Center, Laporan Usahaku → ikut
  dipindah ke buku usaha; semuanya dicek satu per satu saat R1.
- Web (`/membership`) dan app HP (`/app`) dua-duanya.

## 10. Jawaban Bos (2026-11-10)

1. Batas FREE vs PRO bagian 7: **setuju**.
2. Uang marketplace cair: **bisa dipilih** — default langsung ke bank usaha, atau ditampung di kas
   "Saldo Shopee/Tokopedia" dulu lalu tarik dana.
3. Jenis toko: **fleksibel, tambah terus** (termasuk top up game dll) — lihat bagian 2.
