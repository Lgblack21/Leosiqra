import { cloudflareApi } from '../cloudflare-api';

export type FocusKind = 'belajar' | 'kerja' | 'baca';
export interface FocusSession {
  id: string;
  kind: FocusKind;
  label: string | null;
  minutes: number;
  day: string; // YYYY-MM-DD (WIB)
  created_at: string;
}

// Sesi fokus (Worker /api/member/focus, tabel fk_sessions) — 30 hari terakhir.
export const focusService = {
  list() {
    return cloudflareApi<{ today: string; items: FocusSession[] }>('/api/member/focus');
  },
  log(kind: FocusKind, minutes: number, label?: string) {
    return cloudflareApi<{ ok: boolean; id: string }>('/api/member/focus', { method: 'POST', json: { kind, minutes, label: label || undefined } });
  },
};
