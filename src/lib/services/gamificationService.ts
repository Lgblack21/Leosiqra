import { cloudflareApi } from '../cloudflare-api';

export interface GamificationBadge {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
}

export interface GamificationChallenge {
  id: string;
  category: string;
  label: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  done: boolean;
}

export interface GamificationLevel {
  level: number;
  name: string;
  minXp: number;
  nextXp: number | null;
  nextName: string | null;
}

export interface GamificationData {
  streakDays: number;
  surplusStreakMonths: number;
  badges: GamificationBadge[];
  // Opsional: worker versi lama belum mengirim field ini.
  challenges?: GamificationChallenge[];
  xp?: number;
  level?: GamificationLevel;
}

export const gamificationService = {
  async getUserGamification() {
    return cloudflareApi<GamificationData>('/api/member/gamification');
  }
};

// Progres ke level berikutnya, 0–1 (Lv 10 selalu penuh).
export const levelProgress = (xp: number, level: GamificationLevel) =>
  level.nextXp === null ? 1 : Math.min(1, Math.max(0, (xp - level.minXp) / (level.nextXp - level.minXp)));

// Tabungan dihitung dalam juta di server — tampilkan sebagai rupiah ringkas.
export const challengeProgressLabel = (c: GamificationChallenge) =>
  c.id.startsWith('saver-') ? `Rp${c.progress} / ${c.target} jt` : `${c.progress}/${c.target}`;

// Urutan tampil: yang belum selesai & paling dekat selesai dulu, lalu yang sudah selesai.
export const sortChallenges = (list: GamificationChallenge[]) =>
  [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.progress / b.target - a.progress / a.target;
  });
