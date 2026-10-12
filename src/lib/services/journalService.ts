import { cloudflareApi } from '../cloudflare-api';

export type Mood = 1 | 2 | 3 | 4 | 5;
export interface JournalEntry {
  day: string; // YYYY-MM-DD (WIB)
  mood: Mood | null;
  note: string | null;
  highlight: string | null;
  updated_at?: string;
}

// Jurnal harian (Worker /api/member/journal, tabel jr_entries).
export const journalService = {
  list(year?: number) {
    return cloudflareApi<{ today: string; items: JournalEntry[] }>(`/api/member/journal${year ? `?year=${year}` : ''}`);
  },
  save(day: string, data: { mood: Mood | null; note: string; highlight: string }) {
    return cloudflareApi<{ ok: boolean; item?: JournalEntry; deleted?: boolean }>(`/api/member/journal/${day}`, { method: 'PUT', json: data });
  },
};
