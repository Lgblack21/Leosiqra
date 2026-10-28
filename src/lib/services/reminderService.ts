import { cloudflareApi } from '../cloudflare-api';

// Pengingat buatan user (Worker: /api/member/reminders, tabel reminders).
// dueAt = ISO UTC; repeat ulang mingguan/bulanan dihitung server.
export type ReminderRepeat = 'none' | 'weekly' | 'monthly';
export type Reminder = { id: string; title: string; amount: number | null; dueAt: string; repeat: ReminderRepeat; active: boolean; lastSentAt: string | null };
export type ReminderInput = { title: string; amount: number | null; dueAt: string; repeat: ReminderRepeat };

export const reminderService = {
  async list() {
    return (await cloudflareApi<{ items: Reminder[] }>('/api/member/reminders')).items;
  },
  create(input: ReminderInput) {
    return cloudflareApi<{ ok: boolean; id: string }>('/api/member/reminders', { method: 'POST', json: input });
  },
  update(id: string, patch: Partial<ReminderInput & { active: boolean }>) {
    return cloudflareApi<{ ok: boolean }>(`/api/member/reminders/${id}`, { method: 'PUT', json: patch });
  },
  remove(id: string) {
    return cloudflareApi<{ ok: boolean }>(`/api/member/reminders/${id}`, { method: 'DELETE' });
  },
};
