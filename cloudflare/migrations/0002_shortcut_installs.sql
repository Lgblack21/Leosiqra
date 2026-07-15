-- Tautan install Shortcut iOS "1 tap": menyimpan token mentah sementara
-- (<15 menit, sekali pakai) supaya Shortcuts app iOS bisa mengambil file
-- .shortcut yang sudah berisi token, tanpa cookie sesi.
CREATE TABLE IF NOT EXISTS shortcut_installs (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  raw_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT
);
