"use client";

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, AlarmClock, CheckCheck, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService, type AppNotification } from '@/lib/services/notificationService';
import { RemindersView } from '@/components/settings/RemindersView';
import { openSettings } from '@/lib/settingsPanel';
import { useTheme } from '@/context/ThemeContext';

// Lonceng di header: riwayat notifikasi (semua push dari server ikut tercatat)
// + tab Pengingat. Angka belum dibaca diperbarui tiap 2 menit & saat tab aktif.
// Panel dirender lewat portal ke <body>: header dulu memakai backdrop-filter, yang
// menjadi kotak acuan elemen fixed di dalamnya (panel jadi terkurung di header).
const POLL_MS = 120_000;

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} hari lalu` : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso));
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notif' | 'pengingat'>('notif');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  // Di luar scope .web-dark (portal) → pasang sendiri sesuai tema.
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  const load = useCallback(() => {
    notificationService
      .list()
      .then((r) => { setItems(r.items); setUnread(r.unread); })
      .catch(() => setItems((cur) => cur ?? []));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, load]);

  const openItem = async (n: AppNotification) => {
    if (!n.read) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
      setUnread((u) => Math.max(0, u - 1));
      void notificationService.markRead(n.id).catch(() => undefined);
    }
    if (n.url) {
      setOpen(false);
      // Input Cepat membaca ?teks= saat dimuat → navigasi penuh.
      if (n.url.startsWith('/input-cepat')) window.location.href = n.url;
      else router.push(n.url);
    }
  };
  const readAll = async () => {
    setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? cur);
    setUnread(0);
    await notificationService.markAllRead().catch(() => load());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setTab('notif'); setOpen(true); }}
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn('fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-start sm:justify-end sm:p-4 sm:pt-20 print:hidden', resolvedTheme === 'dark' && 'web-dark')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Notifikasi"
              className="settings-compact flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:max-h-[78vh] sm:w-[400px] sm:rounded-[24px]"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                <div className="flex flex-1 rounded-full bg-slate-100 p-1">
                  {([['notif', 'Notifikasi', BellRing], ['pengingat', 'Pengingat', AlarmClock]] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition', tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
                    >
                      <Icon size={14} /> {label}
                      {id === 'notif' && unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                  <X size={17} />
                </button>
              </div>

              <div className="min-h-[240px] flex-1 overflow-y-auto px-4 pb-4 pt-2">
                {tab === 'pengingat' ? (
                  <RemindersView openNotifications={() => { setOpen(false); openSettings('notifikasi'); }} />
                ) : items === null ? (
                  <p className="py-10 text-center text-[13px] text-slate-400">Memuat…</p>
                ) : items.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Bell size={22} /></span>
                    <p className="mt-3 text-[14px] font-semibold text-slate-800">Belum ada notifikasi</p>
                    <p className="mx-auto mt-0.5 max-w-[260px] text-[12px] text-slate-500">Pengingat, ringkasan harian & wawasan dari Leosiqra akan muncul di sini.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void openItem(n)}
                          className={cn('flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50', !n.read && 'bg-indigo-50/60')}
                        >
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-indigo-500')} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[14px] leading-snug text-slate-900', !n.read && 'font-semibold')}>{n.title}</span>
                            {n.body && <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{n.body}</span>}
                            <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tab === 'notif' && !!items?.length && (
                <div className="border-t border-slate-100 p-3">
                  <button type="button" onClick={() => void readAll()} disabled={!unread} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40">
                    <CheckCheck size={15} /> Tandai semua dibaca
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </>
  );
}
