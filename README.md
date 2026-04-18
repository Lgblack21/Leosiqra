# Leosiqra Rekapan

Repo ini sekarang memakai stack Cloudflare penuh.

Project aktif:

- [cloudflare-project/](./cloudflare-project)

## Jalankan Project Aktif

Dari root repo:

```bash
npm run dev
```

Atau langsung dari folder project baru:

```bash
cd cloudflare-project
npm install
npm run dev
```

## Script Root

```bash
npm run dev
npm run deploy
npm run check
npm run db:migrate
npm run db:migrate:remote
npm run data:import
npm run r2:upload
```

Semua script di atas mendelegasikan ke `cloudflare-project/`.

## Catatan

- Root repo tidak lagi ditujukan untuk menjalankan stack lama.
- Semua pengembangan baru lanjut di `cloudflare-project/`.
