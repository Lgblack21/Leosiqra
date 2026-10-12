# Rancangan skema — Mode Keluarga/Patungan (Shared Wallet)

Status: **Fase 1 DIKODE (2026-10-12)** setelah rancangan di-ACC Bos dengan 5
jawaban (FREE 1 dompet/3 anggota, PRO 5/10; owner tidak bisa dihapus sebelum
serah kepemilikan; editor hanya ubah/hapus transaksi sendiri; web + HP
sekaligus; fase 2 nanti). Migrasi menjadi **`0009_shared_wallets.sql`** (nomor
0008 sudah dipakai `signup_sources`). Halaman: `/membership/dompet-bersama` &
`/app/dompet-bersama` (komponen sama). Realtime: Worker mem-publish
`shared_wallet.changed`, tapi SSE `/api/realtime` belum tersambung di app ini,
jadi UI menyegarkan data saat tab/app aktif lagi.

## Prinsip (urut prioritas CLAUDE.md)

1. **Tidak menyentuh tabel & query pribadi.** `transactions` (41 query),
   `accounts` (39 query, termasuk mutasi `balance = balance ± ?`) dan `budgets`
   semuanya dikunci `WHERE user_id = ?`. Menambah konsep "pemilik bersama" ke
   tabel itu berarti mengubah ~90 query sekaligus — satu yang terlewat = IDOR di
   data uang. Jadi Shared Wallet = **buku kas terpisah** dengan tabel sendiri
   (prefix `sw_`). Data pribadi tetap 100% terisolasi seperti sekarang.
2. **Saldo dihitung, bukan disimpan.** Saldo dompet = `SUM` dari transaksi
   aktif. Tidak ada `UPDATE ... SET balance = balance + ?`, jadi tidak ada
   race condition saat dua anggota input bersamaan, dan tidak ada saldo
   "melenceng" kalau satu request gagal di tengah.
3. **Uang sebagai INTEGER** (satuan terkecil mata uang: rupiah utuh untuk IDR).
   Tabel baru, jadi bisa benar sejak awal — tidak mewarisi masalah float REAL.
   **Satu mata uang per dompet** (default IDR) — tidak ada konversi kurs di
   fase 1 (bug multi-currency pernah menggigit app ini).
4. **Anti-dobel:** setiap transaksi membawa `client_request_id` dari klien;
   `UNIQUE (wallet_id, client_request_id)` + `INSERT OR IGNORE` → klik dobel /
   retry jaringan tidak membuat transaksi ganda.
5. **Akses selalu lewat keanggotaan di server.** Semua endpoint
   `/api/member/shared-wallets/:id/*` memanggil `requireSession` lalu
   `requireWalletRole(env, userId, walletId, minRole)` yang membaca
   `sw_members` dengan `user_id` dari sesi. `wallet_id` dari URL tidak pernah
   dipercaya tanpa cek ini.

## Skema (migrasi additive `0008_shared_wallets.sql`)

```sql
-- Dompet bersama. Mata uang tetap per dompet (tidak bisa diubah setelah ada transaksi).
CREATE TABLE IF NOT EXISTS sw_wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                 -- maks 60 karakter (validasi server)
  currency TEXT NOT NULL DEFAULT 'IDR',
  owner_id TEXT NOT NULL,             -- salinan cepat dari sw_members role='owner'
  archived_at TEXT,                   -- arsip, bukan hapus keras
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Keanggotaan + peran. Satu baris per (dompet, user).
CREATE TABLE IF NOT EXISTS sw_members (
  wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  display_name TEXT NOT NULL,         -- snapshot nama saat bergabung (riwayat tetap terbaca)
  joined_at TEXT NOT NULL,
  PRIMARY KEY (wallet_id, user_id),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sw_members_user ON sw_members(user_id);

-- Undangan via link/kode. Token acak 32 byte; yang disimpan HANYA hash-nya
-- (pola sama dengan password_reset_tokens).
CREATE TABLE IF NOT EXISTS sw_invites (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),  -- undangan tidak bisa memberi 'owner'
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,           -- default 7 hari
  revoked_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);

-- Buku kas bersama. Terpisah dari `transactions` pribadi.
CREATE TABLE IF NOT EXISTS sw_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pemasukan', 'pengeluaran')),
  amount INTEGER NOT NULL CHECK (amount > 0),   -- satuan terkecil mata uang dompet
  category TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,                 -- YYYY-MM-DD (WIB), sama seperti transactions.date
  paid_by TEXT,                       -- user yang membayar/menerima (untuk patungan); NULL = kas bersama
  created_by TEXT,                    -- NULL kalau akun pembuatnya dihapus (riwayat tetap ada)
  client_request_id TEXT NOT NULL,    -- anti-dobel dari klien
  deleted_at TEXT,                    -- hapus lunak; saldo hanya menghitung deleted_at IS NULL
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (wallet_id, client_request_id),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sw_tx_wallet_date ON sw_transactions(wallet_id, date DESC);

-- Budget bulanan per kategori untuk dompet bersama.
CREATE TABLE IF NOT EXISTS sw_budgets (
  wallet_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (wallet_id, category),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);

-- Jejak aktivitas (siapa menambah/mengubah/menghapus apa) — penting untuk
-- kepercayaan antar anggota di app uang. Tanpa nominal di kolom teks bebas.
CREATE TABLE IF NOT EXISTS sw_activity (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,               -- tx_create | tx_update | tx_delete | member_join | member_leave | role_change | invite_create | invite_revoke
  target_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sw_activity_wallet ON sw_activity(wallet_id, created_at DESC);
```

Migrasi ini **hanya menambah tabel** — tidak ada `ALTER` ke tabel lama,
aman diterapkan sebelum kode dideploy (kode lama tidak membacanya).

## Hak akses per peran

| Aksi | owner | editor | viewer |
|---|---|---|---|
| Lihat saldo, transaksi, budget, anggota | ✅ | ✅ | ✅ |
| Tambah transaksi | ✅ | ✅ | ❌ |
| Ubah/hapus transaksi | semua | buatan sendiri | ❌ |
| Atur budget | ✅ | ✅ | ❌ |
| Buat/cabut undangan, ubah peran, keluarkan anggota | ✅ | ❌ | ❌ |
| Arsipkan dompet | ✅ | ❌ | ❌ |
| Keluar dari dompet | (harus serahkan owner dulu) | ✅ | ✅ |

## Endpoint (rencana, semua `requireSession` + cek peran)

- `GET/POST /api/member/shared-wallets` — daftar dompet saya / buat dompet (pembuat = owner).
- `GET/PATCH /api/member/shared-wallets/:id` — detail (saldo = SUM) / ganti nama, arsip (owner).
- `GET/POST /api/member/shared-wallets/:id/transactions`, `PATCH/DELETE …/transactions/:txId`
  — `txId` selalu dicari dengan `AND wallet_id = ?` (cegah IDOR lintas dompet).
- `PUT /api/member/shared-wallets/:id/budgets`
- `POST /api/member/shared-wallets/:id/invites`, `DELETE …/invites/:inviteId` (owner).
- `POST /api/member/shared-wallets/join` `{ token }` — wajib login, rate-limit
  (pakai binding rate-limit yang sudah ada), token di-hash lalu dicocokkan;
  `used_count < max_uses`, belum kedaluwarsa, belum dicabut — dicek & dinaikkan
  dalam satu `UPDATE … WHERE used_count < max_uses` (anti race dua orang klik bersamaan).
- `GET/DELETE /api/member/shared-wallets/:id/members[/:userId]`.

Respons tidak pernah memuat email anggota lain — cukup `display_name`
(privasi; email anggota bisa dipakai enumerasi akun).

## Realtime

Tidak perlu Durable Object baru (dan tidak perlu migrasi DO di wrangler.toml):
setelah tulis berhasil, Worker mem-publish `{ type: "shared_wallet_changed", walletId }`
ke room yang sudah ada `member:<userId>` untuk tiap anggota (maks ~10 anggota
→ ≤10 subrequest). Payload **tanpa nominal**; klien me-refetch lewat API yang
ber-auth. Notifikasi push (web push yang sudah ada) opsional, bisa dimatikan per user.

## Yang sengaja TIDAK masuk fase 1

- Transaksi bersama **tidak** otomatis memotong saldo rekening pribadi
  (`accounts.balance`). Menghubungkan keduanya menyentuh logika saldo pribadi
  yang sudah pernah bermasalah — dibahas terpisah di fase 2 kalau Bos mau.
- Tidak ikut dihitung di laporan pribadi (Dashboard, laporan bulanan email,
  AI Leosiqra, Pajak Center) — supaya angka pribadi user tidak berubah diam-diam.
- Hitung "siapa utang siapa" (settle-up patungan) — fase 2; kolom `paid_by`
  sudah disiapkan supaya tidak perlu migrasi ulang.
- Multi-mata uang per dompet.

## Keputusan untuk Bos

1. **Batas paket:** usul FREE = 1 dompet bersama, maks 3 anggota; PRO = 5 dompet, maks 10 anggota. Setuju?
2. **Kalau owner menghapus akunnya:** usul ditolak sampai owner menyerahkan
   kepemilikan / mengarsipkan dompet (FK `owner_id` RESTRICT). Atau dompet ikut terhapus?
3. **Editor boleh ubah/hapus transaksi anggota lain?** Usul: tidak (hanya owner), demi kepercayaan.
4. **Urutan UI:** web `/membership` dulu lalu mobile `/app`, atau keduanya sekaligus (effort ~2×)?
5. **Fase 2 (sambung ke saldo rekening pribadi & settle-up)** — mau direncanakan sekarang atau tunggu fase 1 dipakai dulu?

## Rencana verifikasi (saat kode dikerjakan)

- `wrangler dev` lokal dengan D1 lokal (skema produksi + migrasi 0008), 3 user dummy:
  user C (bukan anggota) mencoba GET/POST/PATCH ke dompet A → harus 404/403;
  viewer mencoba tambah transaksi → 403; editor mengubah transaksi owner → 403;
  `txId` dompet lain lewat URL dompet sendiri → 404.
- Dua POST paralel dengan `client_request_id` sama → 1 baris.
- Undangan `max_uses=1` dipakai 2 user paralel → hanya 1 yang masuk.
- `npx tsc --noEmit`, typecheck Worker (bandingkan baseline 49), `npm run build`.
