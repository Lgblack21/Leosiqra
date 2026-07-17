# Setup di PC Baru

Panduan pindah kerja dari satu komputer ke komputer lain. Kode & histori commit
otomatis ikut lewat `git clone` — yang **tidak** ikut adalah beberapa hal di
bawah ini yang harus disiapkan manual sekali di komputer baru.

## 1. Clone & install

```bash
git clone https://github.com/Lgblack21/Leosiqra.git
cd Leosiqra
npm ci
```

## 2. Buat file `.env.local`

Wajib ada sebelum build — tanpa ini, **semua tombol upload foto/logo gagal**
("Gagal mengunggah foto. Pastikan konfigurasi Cloudinary benar."). File ini
sengaja tidak ikut lewat git (`.gitignore`), jadi harus dibuat ulang manual.

Buat file `.env.local` di root project, isinya:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=gzauvqss
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=Leosiqra
```

Kedua nilai di atas memang publik (ikut ter-bake ke bundle browser saat build,
jadi aman ditulis di sini) — bukan rahasia. **API Secret Cloudinary tidak
pernah dipakai di sini** dan tidak boleh ditaruh di kode klien mana pun.
Lihat `.env.example` untuk templatenya.

## 3. Login Cloudflare (wrangler)

Supaya bisa deploy (`npm run cf:deploy`):

```bash
npx wrangler login
```

Pilih akun **leowendry@gmail.com** — ini akun yang memegang Worker
`membersite-leosiqra`, D1 database, dan R2 bucket produksi. Login ke akun lain
akan membuat wrangler mencoba deploy/membuat resource di akun yang salah.

## 4. Login Git (GitHub)

Supaya bisa `git push`, pastikan login sebagai akun **Lgblack21** (pemilik
repo ini), bukan akun lain. Kalau muncul popup login saat push pertama kali,
pilih akun yang benar di situ.

## 5. Deploy

```bash
npm run cf:deploy
```

Ini menjalankan `next build` (hasil ke folder `out/`) lalu `wrangler deploy`.
Tidak ada CI — semua deploy dilakukan manual dari command ini.

---

## Fakta penting lain soal project ini

- **Tidak ada `.github/workflows`** — push ke GitHub saja tidak men-deploy
  apa pun ke production. Harus jalankan `npm run cf:deploy` manual.
- Production: Cloudflare Worker `membersite-leosiqra`, D1 database
  `membersite_leosiqra_db`, R2 bucket `leosiqra-assets`.
- Domain: www.leosiqra.com
