# Rancangan — Usahaku R3: bon pelanggan, pesanan & DP, utang supplier

Status: **DI-ACC Bos 2026-11-16 ("gas aja" = semua saran bagian 8).** Bon pelanggan dikerjakan **3.30.0**
(branch `claude/usahaku-bon-20261116`, migrasi `0047_shop_bon.sql`). Pesanan & DP dikerjakan **3.31.0** (branch `claude/usahaku-pesanan-20261116`, tanpa migrasi baru — pakai kolom 0047). Berikutnya: utang supplier (3.32).
Catatan 3.30: nama pelanggan juga disimpan di `buyer` (langsung tampil di laporan lama); bon dari **akun tim belum**
(UI kasir tim belum punya pilihan cara bayar) — menyusul bersama toggle izin per akun tim.
Catatan 3.31: entri `pesanan` (net 0, tanpa kas) + `dp` (ref_id → pesanan, kas +). Diambil = `jual` berbentuk bon
(`pay_method 'bon'`, `ref_id` → pesanan) dan DP di-UPDATE jadi `bayar_piutang` (ref_id → penjualan) dalam satu batch,
jadi sisa yang belum dibayar otomatis muncul sebagai bon. Batal tahan = DP jadi `jual` channel "DP hangus".
Cek stok bahan cukup/tidak di kartu pesanan **belum** dibuat.

## 1. Masalahnya

Usahaku sekarang hanya kenal uang yang **sudah** pindah tangan (plus marketplace "belum cair"). Padahal di
warung, katering, kue, dan toko online, banyak uang yang *belum*:

- **Bon / tempo**: pelanggan ambil barang sekarang, bayar akhir bulan (atau dicicil).
- **Pesanan & DP**: kue ulang tahun dipesan Senin, DP 50%, diambil & dilunasi Sabtu.
- **Utang ke supplier**: tepung datang hari ini, bayar 2 minggu lagi.

Tanpa ini, pemilik mencatat di buku tulis terpisah — dan laporan Usahaku jadi tidak utuh (omzet bon tidak
tercatat, atau tercatat sebagai uang masuk padahal belum).

## 2. Yang sudah ada (dicek 2026-11-16)

| Bahan | Di mana | Bisa dipakai? |
|---|---|---|
| `shop_entries` + status `menunggu` / `selesai`, endpoint `…/entries/:id/settle` | 0045, Worker | Ya — "belum dibayar" = pola yang sama dengan "belum cair" |
| Tagih (Ladangku) + teks pengingat WA (`reminderText`, `wa.me`) | `TagihView.tsx` | Teks & tombol WA dipakai ulang; datanya TIDAK (itu hutang-piutang pribadi) |
| Jatuh tempo + pengingat H-3 untuk hutang pribadi | `payload.due`, cron | Pola cron dipakai ulang untuk jatuh tempo usaha |
| Kasir: jual langsung/marketplace, struk WA | `KasirView.tsx` | Tambah pilihan "Belum dibayar (bon)" & "Pesanan" |

## 3. Bon pelanggan (piutang usaha)

- Di kasir, cara bayar tambah **"Bon / bayar nanti"** → isi nama pelanggan (wajib), WA (opsional), jatuh tempo
  (opsional). Penjualan dicatat `status = 'menunggu'`, `channel_type = 'langsung'`, tanpa kas tujuan.
- **Omzet dihitung saat jual** (sama seperti marketplace belum cair — barangnya sudah keluar). Kas belum bertambah.
- **Bayar sebagian / lunas**: entri baru `type = 'bayar_piutang'` yang menunjuk penjualan asal (`ref_id`),
  menambah kas yang dipilih. Sisa bon = harga jual − Σ pembayaran. Lunas → penjualan asal jadi `selesai`.
- Beranda: kartu **"Bon pelanggan"** — total belum dibayar, per pelanggan, yang lewat jatuh tempo diberi merah,
  tombol **Ingatkan via WA** (teks dari `reminderText`) dan **Terima bayaran**.

## 4. Pesanan & DP

- Kasir → **"Jadikan pesanan"**: nama pemesan, tanggal ambil, DP (boleh 0).
- DP masuk kas sebagai entri `type = 'dp'` (kas bertambah) — **belum omzet** (barang belum diserahkan).
- **Ambil / selesai**: pesanan jadi penjualan penuh di tanggal ambil (omzet diakui di sini), DP dihitung sebagai
  bagian pembayaran, sisanya dibayar sekarang **atau** jadi bon (masuk bagian 3).
- **Batal**: DP dikembalikan (kas berkurang) atau ditahan sebagai pendapatan lain — pemilik memilih.
- Beranda: **"Pesanan"** urut tanggal ambil (hari ini / besok / minggu ini), stok bahan cukup atau tidak (resep).
- Stok bahan berkurang saat pesanan **diambil**, bukan saat dipesan.

## 5. Utang supplier

- Catat biaya → pilihan **"Belum dibayar (tempo)"**: nama supplier (wajib), jatuh tempo (opsional).
  Biaya/persediaan tercatat di tanggal terima barang (laba ikut benar, termasuk stok bertambah), kas **tidak** berkurang.
- **Bayar**: entri `type = 'bayar_utang'` (`ref_id` ke biaya asal), kas berkurang (kas tunai tidak boleh minus).
- Beranda: **"Utang ke supplier"** — total, per supplier, jatuh tempo terdekat.
- Pengingat jatuh tempo H-3 lewat notifikasi (cron yang sama polanya dengan hutang pribadi; klaim dulu sebelum kirim).

## 6. Laporan setelah R3

- Omzet: termasuk bon (seperti sekarang termasuk marketplace belum cair). Pesanan baru masuk saat diambil.
- Blok baru **"Uang yang belum pindah tangan"**: bon pelanggan (belum dibayar), marketplace belum cair, DP pesanan
  yang belum diambil (= uang pelanggan yang kamu pegang), utang ke supplier.
- Rincian piutang per pelanggan & utang per supplier, umur (≤7 hari, 8–30, >30).
- Excel: lembar "Piutang" & "Utang".

## 7. Teknis (garis besar)

- Migrasi `0047` (Bos jalankan): `ALTER TABLE shop_entries ADD COLUMN ref_id TEXT;` `ADD COLUMN due_date TEXT;`
  `ADD COLUMN party TEXT;` (nama pelanggan/supplier) + index `(owner_id, shop_id, ref_id)`. Kontak WA di `payload_json`.
  Kode tetap jalan sebelum migrasi (fitur R3 tampil "menunggu pembaruan database").
- Tipe entri baru: `bayar_piutang`, `dp`, `pesanan`, `bayar_utang`; status `menunggu` dipakai bersama.
- Semua mutasi kas: satu batch, `entry_key` unik (anti dobel), pembayaran ditolak kalau melebihi sisa
  (dicek di dalam batch, bukan dari baca sebelumnya — pelajaran 3.28.4).
- Hapus penjualan yang sudah punya pembayaran → ditolak (hapus pembayarannya dulu), supaya kas tidak pecah.
- Kasir tim: boleh mencatat bon & pesanan (pemilik bisa matikan per akun tim); **tidak** bisa menerima pelunasan
  bon kecuali diizinkan.
- Web `/membership` & HP `/app`.

## 8. Pertanyaan untuk Bos

1. **Omzet pesanan** diakui saat **diambil** (bukan saat DP)? Saran: ya — barang belum diserahkan = belum terjual.
2. **DP batal**: default dikembalikan ke pelanggan, atau ditahan jadi pendapatan? Saran: pemilik pilih tiap kali,
   default dikembalikan.
3. **Gratis vs PRO**: saran — bon pelanggan **gratis** (paling sering dipakai warung, bikin orang mulai pakai);
   pesanan & DP + utang supplier + laporan umur piutang **PRO**.
4. **Akun tim** boleh mencatat bon & pesanan? Saran: boleh, tapi pelunasan bon hanya pemilik (bisa diizinkan).
5. Urutan: saran **bon pelanggan dulu** (3.30), lalu pesanan & DP (3.31), lalu utang supplier (3.32) — tiap rilis
   bisa dipakai sendiri dan dites dengan data asli sebelum lanjut.
