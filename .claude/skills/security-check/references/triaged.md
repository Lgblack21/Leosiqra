# Kandidat pemindai yang sudah ditriase

Catatan hasil audit sebelumnya supaya audit berikutnya tidak mengulang kerja.
Nomor baris bisa bergeser — cocokkan lewat nama fungsi. Kalau kode fungsi yang
tercatat di sini berubah, triase ulang (status "aman" tidak otomatis berlaku lagi).
Perbarui file ini di akhir setiap audit.

## Aman (dicek 2026-09-27)

| Kandidat | Lokasi (fungsi) | Alasan aman |
|---|---|---|
| admin route tanpa handler terpisah | route `/api/admin/debug/enforce-username-unique` | `requireSession(env, request, "admin")` dipanggil langsung di blok route |
| `sql-tanpa-user_id` UPDATE ai_chats `WHERE id = ?` | `handlePutAiChatHistory`, `handleAiChat` | `id` berasal dari SELECT yang sudah `WHERE user_id = ?` sesi |
| `sql-tanpa-user_id` sessions | `readSession`, `handleLogout`, `enforceSessionCap` | lookup berdasarkan id sesi dari cookie ber-HMAC / id sesi milik user sendiri |
| `sql-tanpa-user_id` password_reset_tokens | `handleResetPassword` | lookup berdasarkan hash token acak 32 byte; batch dijaga nonce |
| `sql-interpolasi` `${claimed}` / `${stillExists}` | `handleResetPassword`, `findTransferPair`/`buildReversalStatements` | isinya konstanta string SQL di kode, bukan input |
| `sql-interpolasi` `${isEmailIdentifier ? ... }` | `handleLogin` | hanya memilih antara dua nama kolom literal |
| `dangerouslySetInnerHTML` → `SandboxedHtml` | `MaintenanceGuard`, preview di `admin/pengaturan` | tidak lagi pakai `dangerouslySetInnerHTML`; iframe sandbox tanpa script |
| `dangerouslySetInnerHTML` JSON-LD | `src/app/layout.tsx` | `JSON.stringify` objek konstanta |
| `dangerouslySetInnerHTML` jawaban AI | `ai-leosiqra/page.tsx`, `app/assistant/chat/page.tsx` (`formatText`) | `escapeHtml` (& < > " ') dijalankan dulu, baru ditambah `<strong>/<em>/<br/>` |
| GET yang mengubah data (CSRF) | semua route `request.method === "GET"` | semua GET yang terdaftar hanya membaca data |
| push_subscriptions dicari per endpoint | `handleCreatePushSubscription` | pindah akun di browser yang sama memang disengaja; URL endpoint push tidak bisa ditebak (⚪ info) |

## Temuan terbuka

(tidak ada)

## Sudah diperbaiki

| Tanggal | Temuan | Perbaikan |
|---|---|---|
| 2026-09-27 | 🟠 Sanitasi HTML maintenance bisa ditembus (`on*` tanpa kutip, `<svg/onload>`, `javascript:` tanpa kutip) — HTML tampil ke semua user | HTML maintenance sekarang dirender di `SandboxedHtml` (iframe `sandbox` tanpa `allow-scripts`/`allow-same-origin`) di `MaintenanceGuard` & preview admin; `sanitizeMaintenanceHtml` ditambah pola tanpa kutip sebagai cadangan. Diverifikasi di browser: script & fetch dari HTML jahat yang tidak disanitasi tidak jalan |

## Belum ditriase

- `sql-interpolasi` `${assignments}` di handler update (transactions, accounts,
  budgets, investments, profile, categories, recurring, admin settings, admin
  user): pola `allowed = new Set([...])` terlihat di `handleUpdateAccount`, belum
  diverifikasi satu per satu di handler lain.
- `sql-tanpa-user_id` di `backfillIndonesianBankLogos`, `handleAdminPayments`,
  `handleAdminPaymentById`, `processMaturedDeposit`, `processDueRecurringTransactions`,
  `sendWebPushToSubscription`: kemungkinan besar cron/admin — pastikan tidak bisa
  dipanggil dari route member.
