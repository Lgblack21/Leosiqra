"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, AlarmClock, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, NotificationItems, ReadAllButton } from '@/components/notifications/NotificationList';
import { RemindersView } from '@/components/settings/RemindersView';
import { openSettings } from '@/lib/settingsPanel';
import { useTheme } from '@/context/ThemeContext';

// Lonceng di header: riwayat notifikasi (semua push dari server ikut tercatat)
// + tab Pengingat. Angka belum dibaca diperbarui tiap 2 menit & saat tab aktif.
// Panel dirender lewat portal ke <body>: header dulu memakai backdrop-filter, yang
// menjadi kotak acuan elemen fixed di dalamnya (panel jadi terkurung di header).
const POLL_MS = 120_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notif' | 'pengingat'>('notif');
  const notif = useNotifications(POLL_MS);
  const { items, unread, load } = notif;
  const [mounted, setMounted] = useState(false);
  // Di luar scope .web-dark (portal) → pasang sendiri sesuai tema.
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, load]);

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
                ) : (
                  <NotificationItems state={notif} onNavigate={() => setOpen(false)} />
                )}
              </div>

              {tab === 'notif' && !!items?.length && (
                <div className="border-t border-slate-100 p-3">
                  <ReadAllButton state={notif} />
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
