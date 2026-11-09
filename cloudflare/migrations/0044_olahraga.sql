-- Olahragaku (rancangan docs/rancangan/olahragaku.md). Additive: hanya tabel baru.
-- Boleh dijalankan sebelum/sesudah deploy: tanpa tabel, GET /api/member/fit → ready:false dan simpan → 503
-- (klien menyimpan profil di perangkat dulu).
-- R1 memakai fit_profiles & fit_weights; fit_programs, fit_workouts, fit_coach dipakai R2/R3 (dibuat sekarang
-- supaya Bos cukup menjalankan satu migrasi).

CREATE TABLE IF NOT EXISTS fit_profiles (
  user_id TEXT PRIMARY KEY,
  sex TEXT NOT NULL,
  birth_year INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  activity TEXT NOT NULL,
  goal_kg REAL,
  conditions_json TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT 'tanpa',
  experience TEXT NOT NULL DEFAULT 'belum',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fit_weights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kg REAL NOT NULL,
  waist_cm REAL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS fit_programs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  diet_key TEXT NOT NULL,
  workout_key TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  quiz_json TEXT,
  plan_json TEXT,
  ai INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_programs_active ON fit_programs(user_id) WHERE status = 'aktif';

CREATE TABLE IF NOT EXISTS fit_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  program_id TEXT,
  kind TEXT NOT NULL,
  minutes INTEGER,
  kcal INTEGER,
  items_json TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fit_workouts_user_date ON fit_workouts(user_id, date);

CREATE TABLE IF NOT EXISTS fit_coach (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  week_start TEXT,
  program_id TEXT,
  input_json TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_coach_week ON fit_coach(user_id, kind, week_start) WHERE kind = 'eval';
