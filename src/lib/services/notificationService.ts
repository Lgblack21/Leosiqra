import { cloudflareApi } from '../cloudflare-api';

// Riwayat notifikasi (lonceng). Worker: /api/member/notifications.
export type AppNotification = { id: string; title: string; body: string; url: string | null; read: boolean; createdAt: string };

export const notificationService = {
  list() {
    return cloudflareApi<{ items: AppNotification[]; unread: number }>('/api/member/notifications', { cache: 'no-store' });
  },
  markRead(id: string) {
    return cloudflareApi<{ ok: boolean }>(`/api/member/notifications/${id}/read`, { method: 'POST' });
  },
  markAllRead() {
    return cloudflareApi<{ ok: boolean }>('/api/member/notifications/read-all', { method: 'POST' });
  },
};
