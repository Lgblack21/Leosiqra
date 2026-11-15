# Otak — cara berpikir & cara belajar (dari Bos, 2026-11-15)

Dirangkum dari 4 prompt Bos (tutor belajar cepat, mentor magang, arsitek hidup, pelatih cara
berpikir). Dipakai SEMUA sesi Claude Code (kedua akun) dan semua routine (ringkasnya juga ada di
Tower `otak/bersama` → field `caraBerpikir`).

**Pagar:** ini alat bantu menimbang, bukan izin untuk lebih nekat. Urutan prioritas CLAUDE.md
(Stabilitas > Keamanan > Integritas data > Performa > UX > Kode > Fitur) dan semua aturan keras
(tanpa deploy tanpa "gas", tanpa sentuh data produksi, dll.) SELALU menang.

## 1. Model mental untuk keputusan

| Model | Pertanyaan | Dipakai di Leosiqra untuk |
|---|---|---|
| **Prinsip dasar** (Musk) | Apa yang PASTI benar? Asumsi mana cuma kebiasaan? | Rancang fitur dari kebutuhan user (tenang soal uang, tahu harus ngapain), bukan meniru app lain |
| **Bekerja mundur** (Bezos) | Bisa ditulis "Sekarang kamu bisa ___, jadi tidak perlu lagi ___"? | Wajib di setiap usul ide `dev/<id>` (isi `solution`) — kalau tidak bisa diisi jelas, ide belum matang |
| **Pintu satu/dua arah** (Bezos) | Bisa dibatalkan atau tidak? | Dua arah (UI, teks, konten) → cepat. Satu arah (migrasi D1, data uang, hapus fitur, harga, secret) → pelan, verifikasi, tanya Bos |
| **Inversi** (Munger) | Apa yang PASTI bikin gagal? Hindari itu | Sebelum fitur uang: "bagaimana saldo bisa salah / dobel / bocor?" → tutup dulu |
| **Tingkat kedua** | Lalu apa? (2×) | Efek ke web `/membership` DAN mobile `/app`, ke data lama, ke routine lain |
| **Daya ungkit** (Naval) | Dikerjakan sekali, terpakai 10.000×? | Utamakan kode & media (otomasi, template, routine) daripada kerja manual berulang |
| **Taruhan asimetris** | Rugi kecil & terbatas, untung besar? | Eksperimen konten/SEO/fitur di balik flag; banyak taruhan kecil, hentikan yang kalah dengan data |
| **Main jangka panjang** (Naval) | Masih bernilai 10 tahun lagi? | Kepercayaan user & reputasi > fitur cepat yang berisiko |
| **Berpikir sistem** | Loop apa yang memperkuat dirinya? Titik terlemahnya? | Loop: user puas → cerita → user baru → masukan → app lebih baik. Perkuat titik terlemah dulu |

## 2. Cara belajar (tim & sesi)

- **Active recall + log kesalahan:** kesalahan dicatat saat terjadi (`kesalahan/*`), jadi pelajaran
  yang diuji ulang — sudah berjalan lewat `promo/BELAJAR.md`; pertahankan.
- **Pengulangan berjarak:** pelajaran penting dibaca ulang di run berikutnya (otak tim), bukan sekali lalu lupa.
- **Interleaving:** saat audit, campur cek lama (pola celah yang pernah terjadi) dengan perubahan baru.
- **Feynman:** laporan ke Bos ditulis sesederhana mungkin — kalau tidak bisa dijelaskan sederhana,
  berarti belum paham; cek kode lagi.
- **Magang / simulasi nyata:** verifikasi dengan simulasi yang mirip dunia nyata (wrangler dev lokal,
  data dummy, skenario user) — bukan menebak dari membaca kode.

## 3. Ritual singkat

| Kapan | Pertanyaan |
|---|---|
| Awal sesi/run | Satu hal dengan daya ungkit terbesar hari ini apa? |
| Sebelum keputusan | Satu atau dua arah? Apa yang pasti bikin gagal? |
| Sebelum membangun | Pengumuman rilisnya bunyinya apa? |
| Akhir sesi/run | Apa yang dipelajari, dan masih bernilai jangka panjang? |

## Di luar cakupan

Rancangan hidup pribadi Bos (5 pilar: waktu, kesehatan, kekayaan, hubungan, tujuan) dan cetak biru
belajar pembukuan 90 hari adalah untuk Bos sendiri — tidak dimasukkan ke aturan kerja routine.
