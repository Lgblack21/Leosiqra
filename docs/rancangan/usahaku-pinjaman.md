# Rancangan — Usahaku: jenis usaha Pinjaman (harian / mingguan)

Status: **DI-ACC Bos 2026-11-16 ("gas" = semua saran bagian 8: admin default dipotong, Minggu & cuti bersama libur
(bisa dimatikan per pinjaman), bayar lebih = bayar di muka, PRO).** Tahap 1 dikerjakan **3.34.0** (branch
`claude/usahaku-pinjaman-20261116`, migrasi `0048_shop_pinjaman.sql`).

Contoh Bos: pinjam Rp1.000.000, admin Rp50.000 dipotong → diterima Rp950.000; harian 12× Rp100.000 = Rp1.200.000.
Untung Rp250.000 = admin Rp50.000 + jasa Rp200.000 (per angsuran ≈ Rp83.333 pokok + Rp16.667 jasa).

Catatan 3.34: PRO hanya untuk membuat peminjam/pinjaman baru; menerima angsuran tetap bisa walau PRO habis.
Pilihan Minggu/cuti libur ada di form pinjaman (bukan pengaturan toko).

Tahap 2 di-ACC Bos 2026-11-16 ("gas"): urutan **Laporan & Excel (3.35)** → notifikasi pagi **07:00 WIB** (3.36) →
geser jadwal (3.37). Penagih pakai akun tim = **nanti** (kalau sudah ada penagih).

Catatan: ini pinjaman dari modal pribadi pemilik, **bukan koperasi** (tidak ada anggota/simpanan/SHU).
Nama usaha sebaiknya tidak memakai kata "Koperasi" sebelum berbadan hukum. Leosiqra hanya alat catat
pemilik — tidak menyalurkan dana, tidak menghubungi peminjam atas nama pemilik.

## 1. Yang diminta Bos (2026-11-16)

- Ada di Usahaku sebagai toko biasa, tapi **halaman di dalamnya berbeda** (tanpa kasir/stok).
- Pinjam → ada **admin** (diisi manual) → dicicil **harian** atau **mingguan**; jadwal ditentukan pemilik.
- **Tanpa denda.** Tidak bayar hari ini → besok tagihannya jadi 2× (tunggakan menumpuk).
- **Tanggal merah = libur, tidak ada tagihan.**
- **1 peminjam = 1 pinjaman aktif** (harus lunas dulu sebelum pinjam lagi).

## 2. Yang sudah ada di kode (dicek 2026-11-16)

| Bahan | Di mana | Dipakai untuk |
|---|---|---|
| Menu samping per toko (TABS di hash) | `UsahakuApp.tsx` (3.33) | Menu khusus jenis Pinjaman |
| Jenis usaha (`SHOP_KINDS`) | `src/lib/usaha/jenis.ts` | Tambah jenis `pinjaman` |
| Buku usaha: kas, `shop_entries`, satu batch + `entry_key` anti dobel, `cashEnough` | Worker (0045–0047) | Uang keluar saat cair, uang masuk saat angsuran |
| Bayar ≤ sisa, dicek di dalam batch | `…/entries/:id/pay` (3.30) | Pola yang sama untuk angsuran |
| Tanggal merah resmi (libur + cuti bersama, SKB 3 Menteri) + API ter-update | `src/lib/hariLibur.ts`, `/api/member/libur` | Melompati tanggal merah di jadwal |
| Tombol & teks pengingat WA | `TagihView.reminderText`, kartu bon | "Ingatkan" peminjam |

## 3. Alur di layar

**Menu samping toko Pinjaman:** Ringkasan · **Tagihan hari ini** · Pinjaman · Peminjam · Kas · Laporan · Pengaturan.

**Pinjaman baru** (peminjam yang belum punya pinjaman aktif):
- Pokok (mis. Rp1.000.000), **admin** (rupiah, manual) + cara admin: *dipotong dari uang yang diserahkan* atau
  *dibayar terpisah*.
- Jadwal: **harian** / **mingguan**, **angsuran per kali** (Rp) × **berapa kali**, tanggal mulai.
  Bantuan opsional: isi "jasa %" → angsuran dihitungkan (tetap bisa diubah).
- Pratinjau sebelum simpan: *uang diserahkan Rp900.000 · total kembali Rp1.200.000 · 30× harian ·
  selesai Rab, 23 Des (melewati 25 Des Natal & Minggu)* + daftar tanggal tagihan.

**Tagihan hari ini** (halaman utama sehari-hari):
- Satu baris per peminjam yang punya tagihan s.d. hari ini: *Bu Rina · ke-5 dari 30 · **Rp80.000**
  (hari ini 40rb + nunggak 1×)*. Tombol **Terima** (nominal terisi, bisa diubah/sebagian) dan **Ingatkan** (WA).
- Urut: yang nunggak paling lama di atas. Total tagihan hari ini & yang sudah diterima di atas daftar.
- Hari libur (tanggal merah/Minggu): tampil "Hari ini libur — tidak ada tagihan baru"; tunggakan tetap tampil.

## 4. Hitungan

- **Total kembali** = angsuran × jumlah kali. **Jasa** = total kembali − pokok. **Pendapatan** = admin + jasa.
- **Seharusnya sudah dibayar** s.d. hari ini = angsuran × (jumlah tanggal tagihan ≤ hari ini).
- **Tagihan hari ini** = seharusnya − sudah dibayar (min 0). Lebih dari itu = **bayar di muka** (tampil
  "lunas s.d. tgl X"). Tanpa denda.
- **Telat** = hari sejak tanggal tagihan tertua yang belum tertutup → lancar / 1–7 / 8–30 / >30 hari (macet).
- Pendapatan jasa diakui **bertahap** saat angsuran masuk, proporsional:
  jasa diakui kumulatif = round(total dibayar × jasa ÷ total kembali); tiap angsuran = selisihnya →
  jumlahnya pas sama dengan jasa total saat lunas (tanpa selisih pembulatan).
- Semua rupiah bulat (integer).

## 5. Kas & laporan (yang beda dari toko jualan)

- **Uang diserahkan bukan biaya**, **angsuran bukan omzet**. Laba = **admin + jasa** saja.
- Saat cair: kas − (pokok − admin kalau dipotong; pokok kalau terpisah, plus kas + admin terpisah).
  Kas tunai tidak boleh minus (`cashEnough`, sama seperti biaya).
- Ringkasan: **uang beredar** (sisa tagihan semua pinjaman aktif), **modal masih di luar** (pokok belum kembali),
  pendapatan bulan ini, jumlah peminjam aktif, yang nunggak (per kelompok telat).
- Laporan/Excel: per peminjam (pokok, total, dibayar, sisa, telat), pendapatan per bulan.

## 6. Teknis (garis besar)

- Migrasi `0048_shop_pinjaman.sql`:
  - `shop_borrowers` (id, owner_id, shop_id, name, wa, note, created_at, archived_at)
  - `shop_loans` (id, owner_id, shop_id, borrower_id, principal, admin_fee, admin_mode, installment, count,
    frequency, start_date, due_dates_json, status `aktif|lunas|batal`, created_at, closed_at)
  - **unique index parsial** `(owner_id, shop_id, borrower_id) WHERE status = 'aktif'` → 1 pinjaman aktif per
    peminjam dijaga database, bukan cuma tampilan.
- Uang tetap lewat `shop_entries` (kas & riwayat tetap satu tempat): tipe baru `pinjam_cair` (kas −),
  `pinjam_admin` (kas +, kalau admin terpisah), `angsuran` (kas +, `ref_id` → pinjaman, payload pokok/jasa).
- **Jadwal dikunci saat pinjaman dibuat** (`due_dates_json`): dibuat di perangkat dari `hariLibur` (sudah ada),
  dicek server (format, urut naik, jumlah = count, ≥ tanggal mulai, ≤ 400 tanggal). SKB berubah belakangan →
  jadwal pinjaman lama tidak ikut berubah; pemilik bisa "Geser jadwal" manual (fase 2).
- Angsuran: satu batch, `entry_key` unik (anti dobel), **ditolak kalau melebihi sisa** (dicek di dalam batch),
  status `lunas` di-set di batch yang sama saat sisa = 0.
- Hapus angsuran = boleh (kas kembali, status kembali `aktif` kalau perlu). Hapus pinjaman = hanya kalau belum
  ada angsuran.
- Semua endpoint `requireSession` + pemilik saja (akun tim: belum).
- Web `/membership` & HP `/app` (komponen sama).

## 7. Tahapan

1. **Rilis 1:** jenis Pinjaman + menu sendiri, Peminjam, Pinjaman baru (+ pratinjau jadwal), Tagihan hari ini
   (Terima, Ingatkan WA), Kas, Ringkasan.
2. **Rilis 2:** Laporan & Excel, ringkasan pagi lewat notifikasi ("12 tagihan hari ini, Rp…"), geser jadwal,
   akun tim (penagih) boleh menerima angsuran.

## 8. Pertanyaan untuk Bos

1. **Admin**: default *dipotong dari uang yang diserahkan* (pinjam 1 jt, terima 900 rb)? Saran: ya, tapi bisa
   diganti per pinjaman.
2. **Hari Minggu** libur juga untuk jadwal harian? Saran: ya (bisa dimatikan per toko).
3. **Cuti bersama** ikut libur, atau hanya libur nasional? Saran: ikut libur (bisa dimatikan per toko).
4. **Bayar lebih** dari tagihan hari itu = bayar di muka untuk hari berikutnya? Saran: ya.
5. **Gratis vs PRO**? Saran: PRO (fitur baru yang besar, sama seperti pesanan/utang).
