# Rancangan — Usahaku R2: HPP & laba yang benar

Status: **DRAF, menunggu ACC Bos** (2026-11-15). Belum ada kode. Pertanyaan untuk Bos di bagian 9.

## 1. Masalahnya

Laporan sekarang: laba = omzet − biaya yang tercatat ("dasar kas", label sudah jujur sejak 3.28.6).
Akibatnya laba lompat-lompat. Beli stok 1 juta di awal bulan, baru laku separuh → bulan itu kelihatan
rugi; bulan depan sisanya laku tanpa beli lagi → kelihatan untung besar. Pemilik tidak bisa menjawab
pertanyaan paling dasar: **produk mana yang sebenarnya untung?**

Yang dibutuhkan:
- **Laba kotor** = omzet − HPP (modal barang yang *terjual*).
- **Laba bersih** = laba kotor − potongan marketplace − biaya operasional.
- Laba per produk, per jalur jualan, per reseller.

## 2. Yang sudah ada di kode (dicek 2026-11-15)

| Bahan | Di mana | Catatan |
|---|---|---|
| Resep produk → bahan per 1 produk | `shop_recipes` (`product_key` = "kategori\|nama", `items_json` [{m, q}]) | Dipakai mengurangi stok saat terjual |
| Stok bahan + riwayat | `shop_materials`, `shop_stock_moves` (`awal/beli/masuk/pakai/jual/opname`) | Penjualan bikin gerak `jual` (qty minus), **tanpa nilai rupiah** |
| Harga rata-rata bahan | dihitung saat baca: Σ cost ÷ Σ qty dari gerak `beli` | Rata-rata sepanjang masa, bukan per waktu |
| Perkiraan modal per produk | `StockView.tsx` (resep × harga rata-rata), cuma tampilan | Tidak tersimpan, tidak masuk laporan |
| Rincian item penjualan | `payload_json.items` di `shop_entries` (nama, harga, qty, `key`) | `key` cocok dengan resep |
| Produk | `shops.products_json` (nama, harga, satuan, grup, harga reseller) | **Belum ada harga modal** |

Jadi separuh jalan sudah ada. Yang belum ada: harga modal manual dan **modal yang dikunci saat penjualan
terjadi**.

## 3. Sumber modal per produk (urutan prioritas)

1. **Modal per transaksi** (top up game, pulsa, dropship): harga beli ke supplier bisa beda tiap pesanan → diisi
   di kasir per baris (opsional, terlipat "Modal pesanan ini").
2. **Modal dari resep** (kuliner, kue): Σ (qty bahan × harga rata-rata bahan). Otomatis kalau semua bahan
   di resep sudah punya harga beli.
3. **Modal manual per produk** (online shop, kelontong, barang jadi): field baru "Harga modal" di daftar
   produk, di sebelah harga jual & harga reseller.
4. Tidak ada satu pun → penjualan itu **tanpa modal** (bukan dianggap modal 0).

## 4. Kunci modal saat penjualan (inti R2)

Saat penjualan dicatat (kasir pemilik, kasir tim, website, MCP), Worker menghitung modal tiap baris dan
**menyimpannya bersama penjualan**:
- `payload_json.items[].cost` = modal per satuan saat itu, dan sumbernya (`transaksi | resep | manual`).
- Kolom baru `shop_entries.cogs` = total modal penjualan itu (rupiah bulat), `NULL` kalau ada baris tanpa
  modal sama sekali.

Kenapa dikunci, bukan dihitung ulang saat laporan dibuka: harga bahan naik bulan depan tidak boleh
mengubah laba bulan lalu. Ini juga cara akuntansi yang benar.

Konsekuensi:
- Ubah harga modal/resep → hanya berlaku ke penjualan **setelahnya**.
- Hapus penjualan → modalnya ikut hilang (sudah satu baris).
- Penjualan sebelum R2 → **tanpa modal**. Tidak diisi mundur otomatis (tidak menebak data uang lama).
  Opsional: tombol "Perkirakan modal penjualan lama pakai harga sekarang" yang jelas ditandai *perkiraan*.

## 5. Masalah dobel hitung (perlu keputusan Bos)

Kalau laba bersih = omzet − HPP − **semua** biaya, belanja stok terhitung dua kali:
sekali sebagai biaya "Bahan & Stok" saat beli, sekali lagi sebagai HPP saat terjual.

Usul: di **mode laba dengan HPP**, biaya kategori **"Bahan & Stok"** dianggap **pembelian persediaan**,
bukan biaya. Tetap kelihatan di arus kas (uang keluar), tapi tidak mengurangi laba — yang mengurangi laba
adalah HPP saat barangnya laku. Biaya lain (ongkir, iklan, gaji, sewa, listrik, kemasan, operasional) tetap
mengurangi laba bersih.

Catatan: "Kemasan" bisa dua-duanya (persediaan atau biaya). Usul: tetap biaya, kecuali Bos mau dimasukkan
ke resep sebagai bahan.

## 6. Laporan setelah R2

Angka utama berubah jadi:

```
Omzet                         Rp 10.000.000
− Modal barang terjual (HPP)  Rp  6.200.000
= Laba kotor                  Rp  3.800.000   (38%)
− Potongan marketplace        Rp    450.000
− Biaya operasional           Rp  1.100.000
= Laba bersih                 Rp  2.250.000   (22,5%)
```

- **Cakupan modal**: "Modal tercatat untuk 86% omzet" + daftar produk yang belum punya modal dengan tombol
  "Isi modal". Kalau cakupan < 100%, laba kotor/bersih diberi tanda *perkiraan*.
- **Per produk**: terjual, omzet, modal, laba, margin — urut laba (bukan omzet). Produk rugi diberi warna.
- **Per jalur**: tambah kolom modal & laba (Shopee: omzet − potongan − modal).
- **Per reseller**: omzet & laba penjualan reseller vs biasa.
- "Laba (dasar kas)" tetap ada sebagai baris kecil / tab "Arus kas", untuk yang belum mengisi modal.
- Excel ikut: lembar Produk + kolom modal & laba.

## 7. Teknis (garis besar)

- Migrasi `0046_shop_cogs.sql` (Bos jalankan di D1 Console): `ALTER TABLE shop_entries ADD COLUMN cogs INTEGER;`
  Kode tetap jalan tanpa kolom ini (deteksi "no such column" → penjualan dicatat tanpa modal, seperti pola 0045).
- `ShopProduct` + `cost?: number` (rupiah bulat, opsional) di `sanitizeShopProducts`.
- Fungsi baru `productCosts(env, owner, shop, keys)` → modal per `product_key` (manual > resep). Dipanggil di
  `recordBookSale` sebelum batch; nilai ikut di INSERT yang sama (tetap atomik & anti dobel).
- Kasir tim: modal dihitung di server, **tidak pernah dikirim ke tim** (aturan yang sudah ada: cost/avg_cost
  tidak dikirim ke tim).
- Report Worker kirim `cogs` + `items[].cost`; hitungan laba di `summarize` (`src/lib/shopReport.ts`).
- Uang: semua integer rupiah; modal per satuan boleh desimal untuk resep (mis. 12,5 g × Rp 180) tapi total
  per baris dibulatkan sekali.
- Web `/membership` & HP `/app` (komponen sama).

## 8. Yang TIDAK masuk R2

Utang/piutang, pesanan & DP (R3); neraca, impor Excel marketplace (R4); FIFO per batch (rata-rata dulu,
FIFO kalau ada permintaan nyata); retur barang.

## 9. Pertanyaan untuk Bos

1. **Dobel hitung (bagian 5):** setuju biaya "Bahan & Stok" jadi pembelian persediaan di laporan laba HPP?
2. **Modal per transaksi** untuk top up/dropship (bagian 3.1): perlu di R2, atau cukup modal manual per produk dulu?
3. **Penjualan lama:** biarkan "tanpa modal", atau sediakan tombol *perkiraan* pakai harga sekarang?
4. **PRO:** HPP & laba per produk/jalur = PRO (sesuai tabel R1)? Pengguna gratis tetap lihat laba dasar kas.
