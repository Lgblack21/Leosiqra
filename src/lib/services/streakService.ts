import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

export type DayKind = 'closed' | 'late' | 'shield';

export interface StreakSummary {
  today: string; // YYYY-MM-DD (WIB)
  todayKind: DayKind | null;
  streak: number;
  best: number;
  shields: number;
  maxShields: number;
  coins: number;
  week: { start: string; closed: number; target: number };
  days: { day: string; kind: DayKind }[];
  missed: string[];
}

// Tutup hari + streak (Worker /api/member/streak, tabel dc_*). Kalau migrasi
// belum diterapkan, Worker menjawab 503 → pemanggil menyembunyikan fiturnya.
export const streakService = {
  get(month?: string) {
    return cloudflareApi<StreakSummary>(`/api/member/streak${month ? `?month=${month}` : ''}`);
  },
  async close(day?: string) {
    const res = await cloudflareApi<StreakSummary>('/api/member/streak/close', { method: 'POST', json: day ? { day } : {} });
    notifyCollectionChanged('streak');
    return res;
  },
};
