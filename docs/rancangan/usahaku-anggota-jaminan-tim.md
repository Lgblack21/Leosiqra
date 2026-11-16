# Rancangan — Pinjaman: anggota (daftar step-by-step + kartu), jaminan, tim (kas usaha + kartu staf)

Status: **DRAF, menunggu ACC Bos.** Belum ada kode. Butuh migrasi D1 baru (Bos jalankan di D1 Console).
Permintaan Bos 2026-11-16: kartu anggota, foto anggota & KTP, jaminan (opsional, foto), daftar anggota step by step
("daftar dulu jadi anggota, baru boleh dikasih pinjaman"), tim bisa memilih kas usaha, kartu staf + foto staf.

## 1. Yang sudah ada (dicek 2026-11-16)

| Bahan | Di mana | Catatan |
|---|---|---|
| Peminjam (nama, WA, catatan) | `shop_borrowers` (0048) | Belum ada foto, KTP, alamat, nomor anggota |
| Akun tim (username, sandi, toko yang boleh dibuka) | `shop_staff` (0032), `TeamManager.tsx` | **`account_id` = rekening PRIBADI**, bukan kas usaha → ini yang Bos minta dibereskan |
| Foto privat (R2, dibuka lewat endpoint berlogin) | Barangku (`items.photo_key`), cerita (`stories.photo_key`) | Pola dipakai ulang untuk foto anggota/KTP/jaminan/staf |
| Unggah Cloudinary | logo, foto produk | **Link publik** — TIDAK dipakai untuk KTP/jaminan |
| Kecilkan foto sebelum unggah | `src/lib/cloudinary.ts` `shrinkImage` | Dipakai ulang (maks ±1600 px, JPEG) |

## 2. Anggota: daftar step by step

Menu **Peminjam** jadi **Anggota**. Tombol **Daftar anggota baru** → 4 langkah (bisa kembali ke langkah sebelumnya):

1. **Data diri** — nama lengkap*, no. WhatsApp*, alamat*, pekerjaan/usaha (opsional), catatan (opsional).
2. **Foto diri*** — kamera atau galeri (dipakai di kartu anggota).
3. **Foto KTP*** — kamera atau galeri. Disimpan privat, hanya pemilik yang bisa membuka.
4. **Periksa & setujui** — ringkasan + centang *"Anggota setuju data & fotonya disimpan untuk keperluan pinjaman"*.
   → **Nomor anggota** otomatis per usaha (mis. `AGT-0001`) + **kartu anggota** langsung jadi.

Aturan: **Pinjaman baru hanya untuk anggota yang datanya lengkap.** Peminjam lama (dibuat di 3.34–3.37) tetap jalan
pinjamannya, tapi diberi tanda *"Lengkapi data anggota"* dan harus dilengkapi sebelum pinjaman berikutnya.

## 3. Kartu anggota & kartu staf

Ukuran kartu KTP (85,6 × 54 mm), warna ikut tema toko:
- **Kartu anggota:** logo + nama usaha, foto, nama, nomor anggota, tanggal bergabung, QR (isinya **hanya nomor
  anggota**, tanpa data pribadi).
- **Kartu staf:** logo + nama usaha, foto, nama, jabatan (Kasir / Penagih), nomor staf.
- Tombol: **Unduh gambar** (PNG, dibuat di HP), **Kirim lewat WA**, **Cetak**. NIK/KTP **tidak** tampil di kartu.

## 4. Jaminan (opsional, per pinjaman)

Di form Pinjaman baru: sakelar **Ada jaminan** → jenis (BPKB motor, BPKB mobil, sertifikat, elektronik, emas,
lainnya), keterangan (mis. "BPKB Beat 2019 B 1234 XYZ"), perkiraan nilai (opsional), **1–3 foto** (privat).
Detail pinjaman menampilkan jaminannya. Saat lunas: tombol **Jaminan sudah dikembalikan** (tanggal tercatat).

## 5. Tim

- **Kas usaha per staf:** di form akun tim, pilihan uang masuk berisi **kas usaha** toko itu (bukan rekening
  pribadi). Penjualan kasir/angsuran yang dicatat staf masuk ke kas tersebut. Toko tanpa buku usaha = cara lama.
- **Foto staf + kartu staf** (bagian 3), nomor staf otomatis.
- **Jabatan Penagih** (opsional, lihat pertanyaan 5): login di HP sendiri, hanya melihat *Tagihan hari ini* dan bisa
  **Terima** angsuran ke kas yang ditentukan. Tidak bisa membuat/menghapus pinjaman, tidak bisa melihat KTP/jaminan.

## 6. Data pribadi (UU PDP) — wajib

- Foto KTP, jaminan, anggota, staf: **R2 privat**, dibuka hanya lewat endpoint berlogin milik pemilik; tidak ikut
  Excel; tidak dikirim ke AI; tidak tampil ke akun tim.
- NIK **tidak diketik/disimpan sebagai teks** (cukup foto KTP) — data sensitif yang tersimpan sesedikit mungkin.
- Hapus anggota → foto KTP & fotonya ikut dihapus dari penyimpanan; riwayat pinjaman tetap (nama saja).
- Batas foto 2 MB setelah dikecilkan; hanya JPG/PNG/WebP (dicek dari isi file, bukan nama).

## 7. Teknis (garis besar)

- Migrasi `0049`: `shop_borrowers` + `member_no`, `address`, `job`, `photo_key`, `ktp_key`, `consent_at`,
  `registered_at`; `shop_loans` + `collateral_json`; `shop_staff` + `photo_key`, `staff_no`, `title`, `kas_json`
  (peta toko → kas usaha). Kode tetap jalan sebelum migrasi (fitur baru tampil "menunggu pembaruan database").
- Endpoint foto: `POST/GET/DELETE …/pinjaman/peminjam/:id/foto|ktp`, `…/loans/:id/jaminan/:n`, staf `…/team/:id/foto`.
- Kartu dibuat di perangkat (canvas → PNG), foto diambil lewat endpoint berlogin.

## 8. Tahapan

1. **3.38** Anggota: daftar step by step, foto diri & KTP, nomor & **kartu anggota**, wajib anggota sebelum pinjam.
2. **3.39** Jaminan (opsional, foto, tanda dikembalikan).
3. **3.40** Tim: **kas usaha per staf**, foto & **kartu staf** (+ Penagih kalau di-ACC).

## 9. Pertanyaan untuk Bos

1. **Data wajib anggota**: nama, WA, alamat, foto diri, foto KTP. NIK cukup dari foto KTP (tidak diketik)? *Saran: ya.*
2. **Peminjam lama** wajib dilengkapi sebelum pinjaman berikutnya (pinjaman yang berjalan tetap jalan)? *Saran: ya.*
3. **Kartu anggota** untuk semua anggota terdaftar (bukan hanya yang sudah pinjam)? *Saran: semua anggota.*
4. **Kas tim**: pemilik yang menentukan kas usaha untuk tiap staf per toko? *Saran: ya.*
5. **Jabatan Penagih** (staf terima angsuran di HP-nya) dibuat sekarang di 3.40? *Saran: ya kalau sudah ada penagih.*
6. **PRO** untuk anggota/kartu/jaminan? *Saran: PRO (bagian dari usaha pinjaman yang sudah PRO).*
