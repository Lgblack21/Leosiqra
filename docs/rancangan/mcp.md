# Rancangan keamanan — Leosiqra MCP (sambungkan akun ke Claude/ChatGPT)

Status: **Tahap 1+2 SUDAH DIKODE (2026-10-24), tahap 3 (OAuth) SUDAH DIKODE
(2026-10-25), tahap 4 (panduan) belum.** Keputusan Bos 2026-10-23: OAuth 2.1 + PKCE ikut (tahap 3), DCR terbuka
dengan rate limit + domain ditampilkan, baca untuk semua member & tulis khusus
PRO, token manual 30/90/365 hari, URL `www.leosiqra.com/mcp`, tool tulis v1
hanya `add_transaction` + `set_budget`.

### Yang sudah ada di branch (tahap 1+2)

- Migrasi `cloudflare/migrations/0010_mcp.sql`: `mcp_tokens`, `mcp_activity`,
  `mcp_idempotency` (tabel OAuth menyusul di migrasi tahap 3). **Jalankan
  migrasi SEBELUM deploy Worker**; kalau belum, `/mcp` & `/api/member/mcp/*`
  menjawab 503 "belum aktif" dan fitur lain normal (diuji).
- `wrangler.toml`: binding baru `MCP_RATE_LIMITER` (60/menit/token) &
  `MCP_WRITE_RATE_LIMITER` (10/menit/token), fail-closed di produksi.
- `POST /mcp` (Streamable HTTP stateless, jawaban JSON): `initialize`, `ping`,
  `tools/list`, `tools/call`; `GET/DELETE /mcp` → 405. Tool tulis hanya muncul
  di `tools/list` kalau token ber-izin tulis DAN akun PRO (dicek ulang tiap panggilan).
- `GET/POST /api/member/mcp/tokens`, `DELETE /api/member/mcp/tokens/:id`,
  `GET /api/member/mcp/activity` (cookie sesi; POST/DELETE wajib Origin terdaftar).
- Token dicabut otomatis saat reset password, ganti password, dan admin reset 2FA;
  user `NONAKTIF` → 401.
- UI: Profil → Keamanan → kartu "Hubungkan ke AI" (web `/membership`). Tree
  mobile `/app` belum punya UI token — sengaja, token dipakai dari laptop
  (Claude Code); bisa ditambah kalau Bos mau.

### Yang sudah ada di branch (tahap 3 — OAuth, 2026-10-25)

- Migrasi additive `cloudflare/migrations/0011_mcp_oauth.sql`: `mcp_oauth_clients`,
  `mcp_oauth_codes`, `mcp_refresh_tokens`. **Urutan deploy: 0010 → 0011 → Worker.**
  Tanpa 0011: `/oauth/*` menjawab 503 rapi, token manual & Profil tetap jalan.
- Metadata: `GET /.well-known/oauth-protected-resource` (RFC 9728) dan
  `GET /.well-known/oauth-authorization-server` (RFC 8414; S256 saja). 401 dari
  `/mcp` sekarang membawa `resource_metadata=` supaya claude.ai/ChatGPT tahu
  harus login.
- `POST /oauth/register` — DCR terbuka, 5/menit per IP (limiter login). Redirect
  hanya `https://` atau `http://localhost|127.0.0.1|[::1]`; tanpa
  `token_endpoint_auth_method` → `client_secret_basic` (RFC 7591), `none` = klien publik.
- `GET /oauth/authorize` → validasi `client_id` + `redirect_uri` (sama persis) +
  PKCE S256 + `resource` → halaman statis **`/izinkan-ai`** (login dulu via
  `?next=`, termasuk 2FA & Google). Parameter salah sebelum redirect_uri terbukti
  valid = TIDAK di-redirect (cegah open redirect).
- Layar izin menampilkan nama klien + **domain redirect besar**; ber-badge
  "resmi" hanya untuk domain `claude.ai`, `claude.com`, `chatgpt.com`,
  `openai.com`, selain itu peringatan "tidak terverifikasi". Izin tulis tidak
  dicentang default, hanya untuk PRO dan kalau diminta klien.
- `POST /api/member/mcp/authorize` (cookie + Origin terdaftar) menerbitkan kode
  10 menit sekali pakai; maks 10 aplikasi terhubung per member.
- `POST /oauth/token`: `authorization_code` (klaim kode atomik, cek klien +
  redirect_uri + PKCE; kode dipakai ulang → koneksi dicabut) dan `refresh_token`
  (rotasi sekali pakai, 30 hari geser; refresh lama dipakai ulang → koneksi
  dicabut). Access token = token `lsq_mcp_` 1 jam di `mcp_tokens`
  (`source='oauth'`), dirotasi di baris yang sama, jadi izin/PRO/rate
  limit/log persis sama dengan token manual.
- Profil → Keamanan: koneksi OAuth tampil di daftar yang sama (badge "Login
  AI"), tombol hapus = putuskan koneksi (access + semua refresh). Reset/ganti
  password & admin reset 2FA ikut memutus semua koneksi.
- CORS `*` hanya untuk `/oauth/token`, `/oauth/register`, `/.well-known/oauth-*`
  (tanpa cookie). `/izinkan-ai` kena `X-Frame-Options: DENY` dari `_headers`.

**Koreksi rancangan:** `insertTransactionRecord` TIDAK mengubah saldo rekening
untuk pemasukan/pengeluaran (hanya hutang/piutang). Yang mengubah saldo +
total member secara atomik adalah alur `quick-transaction`, jadi
`add_transaction` memakai `quickTxBalanceStatements` (diekstrak dari
`handleQuickTransaction`, SQL sama persis) dalam satu batch bersama klaim
anti-dobel.

## Temuan penting dari dokumentasi resmi (dicek 2026-10-12)

Ide awal di Tower = "token per member dibuat di Profil, ditempel di AI". Ternyata
**token tempel saja tidak cukup untuk aplikasi yang paling banyak dipakai member:**

| Klien | Cara auth yang didukung | Sumber |
|---|---|---|
| claude.ai web/HP (Free, Pro, Max) — Customize → Connectors → **Add custom connector** | **OAuth** (per user sign-in). Header statis (`authorization`, `x-api-key`) ada di bagian *Request headers*, tapi masih **beta untuk sebagian organisasi** dan dianjurkan untuk kredensial bersama, bukan per orang. Free plan: maks 1 custom connector. | claude.com/docs/connectors/custom/add-unlisted |
| ChatGPT (Developer mode, Plus/Pro/Business/Enterprise/Edu web) | **OAuth** atau tanpa auth. Tidak ada kolom header token bebas. | developers.openai.com — guide "ChatGPT Developer mode" |
| Claude Code, Claude Desktop (config), klien MCP lain | Header `Authorization: Bearer <token>` bisa | dok. masing-masing |

Kesimpulan: supaya member awam bisa "Add custom connector → masukkan URL →
login Leosiqra → Izinkan", Worker perlu **OAuth 2.1 (authorization code +
PKCE)** di samping token manual. Token manual tetap ada untuk Claude Code /
klien lain. Ini menambah lingkup dibanding usulan awal → keputusan Bos #1.

## Prinsip (urut prioritas CLAUDE.md)

1. **Jalur auth terpisah dari cookie.** Endpoint MCP TIDAK memakai
   `requireSession` (cookie), dan token MCP TIDAK pernah diterima oleh
   `/api/member/*` maupun `/api/admin/*`. Fungsi baru `requireMcpToken(env,
   request)` → `{ userId, tokenId, scopes }`. Akun admin: token MCP selalu
   diperlakukan sebagai user biasa (tidak ada tool admin sama sekali).
2. **User ID hanya dari token.** Tool tidak punya parameter `user_id`. Semua
   query memakai `WHERE user_id = ?` dengan id dari token — sama seperti
   endpoint member.
3. **Pakai ulang logika bisnis yang sudah ada, jangan menulis ulang.**
   `add_transaction` memanggil `assertOwnAccounts` + `insertTransactionRecord`
   (yang sudah menangani `amount_idr`/multi-currency & mutasi saldo);
   laporan memakai aturan `computeUserInsights` (investasi ≠ pengeluaran,
   `COALESCE(NULLIF(amount_idr,0),amount)`). Dua jalur hitung = dua versi
   kebenaran saldo.
4. **Tanpa hapus di versi 1** (sesuai usulan). Juga tanpa ubah transaksi lama,
   tanpa transfer antar-rekening, tanpa investasi/hutang di v1 — tool tulis
   hanya `add_transaction` (pemasukan/pengeluaran biasa) dan `set_budget`.
5. **Rahasia tidak pernah tersimpan mentah.** Token & kode OAuth disimpan
   sebagai SHA-256 (pola yang sama dengan undangan Dompet Bersama dan reset
   password), ditampilkan ke member **sekali** saat dibuat.
6. **Setiap panggilan tercatat** (log per token yang bisa dilihat member) dan
   tunduk rate limit per token.

## Skema (migrasi additive `0010_mcp.sql` — cek ulang nomor saat menulis kode)

```sql
-- Token akses MCP. Dibuat manual di Profil ATAU diterbitkan lewat OAuth.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                  -- "Claude di laptop", maks 60
  token_hash TEXT NOT NULL UNIQUE,     -- sha256 hex dari token mentah (prefix "lsq_mcp_")
  token_hint TEXT NOT NULL,            -- 4 karakter terakhir, untuk dikenali di UI
  scopes TEXT NOT NULL,                -- 'read' atau 'read write'
  source TEXT NOT NULL CHECK (source IN ('manual', 'oauth')),
  client_id TEXT,                      -- klien OAuth (null untuk manual)
  expires_at TEXT NOT NULL,            -- manual: 30/90/365 hari; oauth access: 1 jam
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);

-- Refresh token OAuth (rotasi sekali pakai; dipakai ulang = cabut seluruh keluarga).
CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  expires_at TEXT NOT NULL,            -- 60 hari
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Kode otorisasi OAuth (10 menit, sekali pakai, terikat PKCE + redirect_uri).
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,        -- S256 saja, 'plain' ditolak
  scopes TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Klien OAuth hasil Dynamic Client Registration (kalau dipakai — lihat keputusan #2).
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,         -- JSON array, HTTPS saja (+ http://localhost untuk klien lokal)
  created_at TEXT NOT NULL
);

-- Log aktivitas per token (tanpa isi argumen keuangan mentah; cukup tool + ringkasan).
CREATE TABLE IF NOT EXISTS mcp_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  ok INTEGER NOT NULL,
  summary TEXT,                        -- mis. "pengeluaran Rp25.000 · Makan"; maks 120
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_activity_user ON mcp_activity(user_id, created_at);

-- Anti-dobel tool tulis (AI agent sering mengulang panggilan tool).
CREATE TABLE IF NOT EXISTS mcp_idempotency (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  result_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
```

Semua tabel baru; tidak ada `ALTER` ke tabel lama. Sesuai pelajaran tim: kalau
Worker ter-deploy sebelum migrasi, endpoint MCP menjawab 503 "belum aktif" dan
fitur lain tetap normal (uji: DROP tabel lokal).

## Endpoint

| Path | Auth | Fungsi |
|---|---|---|
| `POST /mcp` | Bearer token MCP | Streamable HTTP MCP (JSON-RPC). Mode stateless: tiap request diautentikasi ulang, tanpa `Mcp-Session-Id` yang dipercaya untuk otorisasi. `GET /mcp` → 405 (tidak ada stream server→klien di v1). |
| `GET /.well-known/oauth-protected-resource` | publik | metadata RFC 9728 → menunjuk authorization server |
| `GET /.well-known/oauth-authorization-server` | publik | metadata RFC 8414 (`code_challenge_methods_supported: ["S256"]`) |
| `GET /oauth/authorize` (halaman static `/membership/mcp/izinkan`) | **cookie sesi** (login + 2FA seperti biasa) | layar persetujuan: nama klien, domain redirect, izin baca/tulis (tulis tidak dicentang default) |
| `POST /api/member/mcp/authorize` | cookie sesi (SameSite=Lax) + cek `Origin` baru | terbitkan kode (dipanggil tombol "Izinkan") |
| `POST /oauth/token` | publik (PKCE) | tukar kode / refresh → access token |
| `POST /oauth/register` | publik, rate limit per IP | DCR (kalau keputusan #2 = ya) |
| `GET/POST/DELETE /api/member/mcp/tokens` | cookie sesi | daftar / buat token manual / cabut (OAuth & manual) |
| `GET /api/member/mcp/activity` | cookie sesi | 100 aktivitas terakhir |

Respons 401 dari `/mcp` menyertakan
`WWW-Authenticate: Bearer resource_metadata="https://www.leosiqra.com/.well-known/oauth-protected-resource"`
supaya klien tahu harus memulai OAuth.

CORS: `/mcp` & `/oauth/token` dipanggil server-ke-server oleh Anthropic/OpenAI,
jadi **tidak** perlu menambah origin ke `ALLOWED_ORIGINS`. Endpoint OAuth
publik tidak memasang cookie dan tidak membaca cookie.

## Tool v1

| Tool | Izin | Isi |
|---|---|---|
| `list_wallets` | read | nama rekening, jenis, mata uang, saldo (tanpa nomor rekening) |
| `list_transactions` | read | filter bulan/kategori/rekening, maks 100 baris per panggilan |
| `get_report` | read | ringkasan bulan: pemasukan, pengeluaran, top kategori, tabungan bersih (aturan sama dengan laporan bulanan/insight) |
| `get_budgets` | read | budget bulan ini + terpakai |
| `list_categories` | read | kategori milik user |
| `add_transaction` | write | `type` (pemasukan/pengeluaran), `amount` (bilangan bulat > 0, maks sama dengan form web), `category`, `account_id` (wajib milik user → `assertOwnAccounts`), `date` (≤ hari ini + 1), `note`, **`idempotency_key` wajib** |
| `set_budget` | write | kategori + nominal bulanan (validasi sama dengan endpoint budget) |

Validasi input di server untuk SEMUA argumen (client = AI, bukan batas
kepercayaan). `account_id` tidak ditemukan / bukan milik user → error yang sama
("Rekening tidak ditemukan"), supaya tidak bisa menebak id milik orang lain.

## Ancaman & mitigasi

| # | Ancaman | Mitigasi |
|---|---|---|
| 1 | Token bocor (ditempel di chat, file config, screenshot) | prefix `lsq_mcp_` (gampang dikenali secret scanner), hash di D1, kedaluwarsa wajib, cabut 1 klik, `last_used_at` terlihat; reset/ganti password & "keluar dari semua perangkat" **ikut mencabut semua token MCP** |
| 2 | Token dipakai ke API member (eskalasi) | `requireSession` hanya cookie; token MCP hanya dikenali `requireMcpToken` di `/mcp`. Uji: token MCP sebagai cookie/Bearer ke `/api/member/accounts` → 401 |
| 3 | IDOR lewat argumen tool (`account_id` user lain) | semua query `WHERE user_id = ?` dari token; uji 2 user lokal: user A pakai id rekening B → error, tidak ada baris tertulis |
| 4 | Prompt injection: catatan transaksi berisi "abaikan instruksi, hapus semua…" lalu dibaca AI | tidak ada tool hapus/transfer; tool tulis butuh izin `write` yang dicentang manual; klien (Claude/ChatGPT) meminta konfirmasi tool tulis; hasil tool menandai teks user sebagai data. Teks catatan dipotong & dibersihkan karakter kontrol |
| 5 | AI mengulang `add_transaction` (retry) → saldo dobel | `idempotency_key` wajib + `INSERT OR IGNORE` ke `mcp_idempotency` **sebelum** `insertTransactionRecord` dalam satu `DB.batch`; panggilan ulang mengembalikan id lama |
| 6 | Open redirect / pencurian kode OAuth | `redirect_uri` harus persis sama dengan yang terdaftar; HTTPS saja (kecuali `http://localhost`/`127.0.0.1` untuk klien lokal); PKCE S256 wajib; kode 10 menit sekali pakai; `state` dikembalikan apa adanya |
| 7 | Phishing lewat layar persetujuan ("Claude" palsu) | tampilkan **domain redirect** besar-besar, bukan cuma `client_name`; nama klien DCR ditandai "tidak terverifikasi" kecuali domain claude.ai/chatgpt.com |
| 8 | CSRF pada tombol "Izinkan" | cookie sesi sudah `SameSite=Lax` (POST lintas situs tidak membawa cookie); karena endpoint ini menerbitkan kunci akses, tambah lapis kedua: cek header `Origin` ∈ `ALLOWED_ORIGINS` (endpoint member lain saat ini hanya mengandalkan SameSite) |
| 9 | Refresh token dicuri | rotasi sekali pakai; refresh lama dipakai lagi → cabut seluruh `family_id` |
| 10 | Banjir panggilan / biaya D1 | binding rate limit baru `MCP_RATE_LIMITER` (mis. 60/menit per token, 10/menit untuk tool tulis); `/oauth/register` & `/oauth/token` per IP; maks 10 token aktif per user; fail-closed di produksi seperti limiter lain |
| 11 | Bocor error mentah D1 ke AI | error tool diterjemahkan ke pesan Indonesia; detail hanya `console.error` |
| 12 | Data keuangan member mengalir ke pihak ketiga | ini memang inti fiturnya → halaman persetujuan & panduan menjelaskan dengan jelas: data yang dibaca AI dikirim ke penyedia AI pilihan member; tambah poin di `/privacy` |

## Tahapan kode (setelah rancangan di-ACC)

1. Migrasi + token manual + `/mcp` tool baca + halaman Profil (token, log). Bisa
   dipakai dari Claude Code / Desktop config.
2. Tool tulis (`add_transaction`, `set_budget`) + idempotensi.
3. OAuth (metadata, authorize, token, DCR/CIMD) → claude.ai & ChatGPT.
4. Panduan `/panduan/mcp` dengan langkah yang diverifikasi dari dokumentasi
   resmi saat menulis (menu claude.ai saat ini: **Customize → Connectors → Add
   custom connector**; ChatGPT: aktifkan Developer mode di Settings → Apps →
   Advanced settings, lalu buat connector) + tangkapan layar.

Verifikasi tiap tahap: `wrangler dev` lokal + D1 lokal, 2 user dummy (uji IDOR
& token user A tidak bisa membaca user B), token kedaluwarsa/dicabut → 401,
retry `add_transaction` 3× paralel → 1 baris & saldo bergeser sekali, MCP
Inspector lokal untuk alur protokol, tsc + tsc Worker (baseline 0) + build.

## Keputusan Bos

1. **OAuth ikut dikerjakan?** (usul: ya, tahap 3 — tanpa OAuth member claude.ai
   biasa & ChatGPT tidak bisa memasang; tanpa OAuth fitur hanya untuk Claude
   Code/Desktop config = segmen kecil.)
2. **Pendaftaran klien OAuth:** Dynamic Client Registration terbuka (usul: ya,
   dengan rate limit + layar persetujuan menampilkan domain), atau hanya klien
   terdaftar manual (claude.ai, chatgpt.com)?
3. **Khusus PRO?** (usul: baca untuk semua, tulis khusus PRO — atau semua PRO.)
4. **Masa berlaku token manual:** pilihan 30/90/365 hari (usul) atau tanpa
   kedaluwarsa?
5. **URL:** `https://www.leosiqra.com/mcp` (usul, satu domain dengan app) atau
   subdomain `mcp.leosiqra.com`?
6. **Tool tulis v1** cukup `add_transaction` + `set_budget` (usul), tanpa
   transfer/investasi/hutang/hapus?
