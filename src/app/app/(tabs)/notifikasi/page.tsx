'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlarmClock, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lightTap } from '@/lib/haptics';
import { FadeIn } from '@/components/app/FadeIn';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { useNotifications, NotificationItems, ReadAllButton } from '@/components/notifications/NotificationList';
import { RemindersView } from '@/components/settings/RemindersView';
import { openAppNotificationUrl } from '@/lib/txPrefill';

// Notifikasi & Pengingat versi HP — sama dengan lonceng web (riwayat dari
// /api/member/notifications + RemindersView). Di aplikasi native belum ada
// push, jadi di sinilah pengingat terlihat. ?tab=pengingat membuka tab kedua.
// Layout /app tidak memasang FeedbackProvider — halaman ini membawanya sendiri.
type Tab = 'notif' | 'pengingat';

function AppNotifications() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('notif');
  const notif = useNotifications();

  useEffect(() => {
    // Static export: baca query di klien (tanpa useSearchParams + Suspense).
    if (new URLSearchParams(window.location.search).get('tab') === 'pengingat') setTab('pengingat');
  }, []);

  const pick = (t: Tab) => {
    lightTap();
    setTab(t);
    window.history.replaceState(null, '', t === 'pengingat' ? '?tab=pengingat' : window.location.pathname);
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10 space-y-5">
      <FadeIn>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Notifikasi</h1>
      </FadeIn>

      <div className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            ['notif', 'Notifikasi', BellRing],
            ['pengingat', 'Pengingat', AlarmClock],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 fs-13 font-semibold transition',
              tab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <Icon size={14} /> {label}
            {id === 'notif' && notif.unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 fs-10 font-bold text-white">{notif.unread}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pengingat' ? (
        <RemindersView />
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-2 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <NotificationItems state={notif} openUrl={(url) => openAppNotificationUrl(url, router.push)} />
          </div>
          {!!notif.items?.length && <ReadAllButton state={notif} />}
        </div>
      )}
    </div>
  );
}

export default function AppNotificationsPage() {
  return (
    <FeedbackProvider>
      <AppNotifications />
    </FeedbackProvider>
  );
}
