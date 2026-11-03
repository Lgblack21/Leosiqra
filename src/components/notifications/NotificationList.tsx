"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService, type AppNotification } from '@/lib/services/notificationService';

// Riwayat notifikasi (lonceng) — dipakai panel lonceng web (NotificationBell)
// dan halaman /app/notifikasi. Varian dark: hanya aktif di /app (scope .dark);
// web memakai .web-dark yang memetakan ulang warna sendiri.

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} hari lalu` : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso));
};

// pollMs: muat ulang berkala (lonceng di header); 0 = hanya saat dipasang &
// saat tab aktif lagi.
export function useNotifications(pollMs = 0) {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    notificationService
      .list()
      .then((r) => { setItems(r.items); setUnread(r.unread); })
      .catch(() => setItems((cur) => cur ?? []));
  }, []);

  useEffect(() => {
    load();
    const id = pollMs > 0 ? window.setInterval(load, pollMs) : 0;
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    // Push yang masuk saat aplikasi HP dibuka (lihat PUSH_EVENT di nativePush) → angka lonceng ikut naik.
    window.addEventListener('leosiqra:push', load);
    return () => {
      if (id) window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('leosiqra:push', load);
    };
  }, [load, pollMs]);

  const markRead = useCallback((n: AppNotification) => {
    if (n.read) return;
    setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
    setUnread((u) => Math.max(0, u - 1));
    void notificationService.markRead(n.id).catch(() => undefined);
  }, []);

  const readAll = useCallback(async () => {
    setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? cur);
    setUnread(0);
    await notificationService.markAllRead().catch(() => load());
  }, [load]);

  return { items, unread, load, markRead, readAll };
}

export function NotificationItems({
  state,
  onNavigate,
  openUrl,
}: {
  state: ReturnType<typeof useNotifications>;
  onNavigate?: () => void;
  // /app membuka URL dengan caranya sendiri (openAppNotificationUrl: versi app, sheet transaksi).
  openUrl?: (url: string) => void;
}) {
  const router = useRouter();
  const { items, markRead } = state;

  const openItem = (n: AppNotification) => {
    markRead(n);
    if (!n.url) return;
    onNavigate?.();
    if (openUrl) return openUrl(n.url);
    const url = n.url;
    // Input Cepat membaca ?teks= saat dimuat → navigasi penuh.
    if (url.startsWith('/input-cepat')) window.location.href = url;
    else router.push(url);
  };

  if (items === null) return <p className="py-10 text-center text-[13px] text-slate-400">Memuat…</p>;
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"><Bell size={22} /></span>
        <p className="mt-3 text-[14px] font-semibold text-slate-800 dark:text-slate-100">Belum ada notifikasi</p>
        <p className="mx-auto mt-0.5 max-w-[260px] text-[12px] text-slate-500 dark:text-slate-400">Pengingat, ringkasan harian & wawasan dari Leosiqra akan muncul di sini.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => openItem(n)}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
              !n.read && 'bg-indigo-50/60 dark:bg-indigo-500/10'
            )}
          >
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-indigo-500')} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[14px] leading-snug text-slate-900 dark:text-slate-100', !n.read && 'font-semibold')}>{n.title}</span>
              {n.body && <span className="mt-0.5 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">{n.body}</span>}
              <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ReadAllButton({ state }: { state: ReturnType<typeof useNotifications> }) {
  return (
    <button
      type="button"
      onClick={() => void state.readAll()}
      disabled={!state.unread}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <CheckCheck size={15} /> Tandai semua dibaca
    </button>
  );
}
