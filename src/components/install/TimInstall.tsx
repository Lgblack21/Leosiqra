'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InstallAnimation } from '@/components/install/InstallAnimation';
import { useInstallPrompt, detectPlatform, isInAppBrowser, isNativeApp, isStandaloneDisplay, type Platform } from '@/lib/pwaInstall';
import { cn } from '@/lib/utils';

// Pasang aplikasi Tim (PWA /tim, manifest sendiri) di layar utama Android/iPhone. Harus dari halaman /tim:
// dialog install browser selalu memasang aplikasi milik halaman yang sedang dibuka. Pola sama dengan Input Cepat.
function InstallBody({ platform }: { platform: Platform }) {
  const { state, promptInstall } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(state !== 'available');
  const inApp = isInAppBrowser();
  return (
    <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex items-center gap-3">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] shadow-md">
          <Image src="/images/tim-192.png" alt="" fill sizes="48px" className="object-cover" />
        </span>
        <p className="fs-13 leading-snug text-slate-600">
          Pasang <b>Tim</b> di layar utama HP supaya bisa langsung dibuka seperti aplikasi, tanpa ketik alamat lagi.
        </p>
      </div>
      {inApp && (
        <p className="rounded-2xl bg-amber-50 p-3 fs-12 font-semibold text-amber-800">
          Buka halaman ini di {platform === 'ios' ? 'Safari' : 'Chrome'} dulu. Browser di dalam WhatsApp atau aplikasi lain
          gak bisa memasang aplikasi.
        </p>
      )}
      {state === 'installed' ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 fs-13 font-bold text-emerald-700">
          <Check size={16} /> Tim terpasang. Buka dari layar utama HP.
        </p>
      ) : state === 'available' ? (
        <button
          type="button"
          onClick={() => promptInstall().then((r) => r !== 'accepted' && setShowSteps(true))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 fs-14 font-black text-white shadow-lg shadow-emerald-600/20 active:scale-[0.99]"
        >
          <Download size={16} /> Pasang Tim
        </button>
      ) : null}
      <button type="button" onClick={() => setShowSteps((v) => !v)} className="flex w-full items-center justify-center gap-1 fs-12 font-bold text-slate-500">
        {showSteps ? 'Sembunyikan langkah' : 'Lihat langkah pemasangan'}
        <ChevronDown size={14} className={cn('transition-transform', showSteps && 'rotate-180')} />
      </button>
      {showSteps && <InstallAnimation platform={platform} app="tim" compact />}
      {platform === 'ios' && (
        <p className="text-center fs-11 text-slate-400">Di iPhone, setelah dipasang kamu perlu masuk sekali lagi dari aplikasinya.</p>
      )}
    </div>
  );
}

export function TimInstall({ className }: { className?: string }) {
  const [platform, setPlatform] = useState<Platform>('android');
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi perangkat & mode standalone setelah hydrate
    setPlatform(detectPlatform() === 'ios' ? 'ios' : 'android');
    setHidden(isStandaloneDisplay() || isNativeApp());
  }, []);
  if (hidden) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('mx-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 fs-12 font-bold text-slate-600 shadow-sm ring-1 ring-slate-100', className)}
      >
        <span className="relative h-5 w-5 overflow-hidden rounded-md">
          <Image src="/images/tim-192.png" alt="" fill sizes="20px" className="object-cover" />
        </span>
        Pasang aplikasi Tim di HP
      </button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Pasang aplikasi Tim">
        <InstallBody platform={platform} />
      </BottomSheet>
    </>
  );
}
