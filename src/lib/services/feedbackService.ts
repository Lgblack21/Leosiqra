import { cloudflareApi } from '../cloudflare-api';

export type FeedbackCategory = 'saran' | 'kritik' | 'masalah' | 'pujian';
export type FeedbackStatus = 'baru' | 'dibaca' | 'selesai';

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  // hanya di daftar admin
  page?: string | null;
  platform?: string | null;
  user_name?: string | null;
  user_email?: string | null;
}

export const FEEDBACK_MAX_CHARS = 1000;

export const feedbackService = {
  send(input: { category: FeedbackCategory; rating: number | null; message: string; page?: string; platform: 'web' | 'app' }) {
    return cloudflareApi<{ ok: true; id: string }>('/api/member/feedback', { method: 'POST', json: input });
  },
  async mine() {
    const r = await cloudflareApi<{ items: FeedbackItem[] }>('/api/member/feedback');
    return r.items;
  },
  async adminList() {
    const r = await cloudflareApi<{ items: FeedbackItem[] }>('/api/admin/feedback');
    return r.items;
  },
  adminUpdate(id: string, patch: { status?: FeedbackStatus; reply?: string }) {
    return cloudflareApi<{ ok: true }>(`/api/admin/feedback/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch });
  },
};
