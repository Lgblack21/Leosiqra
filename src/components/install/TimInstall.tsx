'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Check, ChevronDown, X } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InstallAnimation } from '@/components/install/InstallAnimation';
import { useInstallPrompt, detectPlatform, isInAppBrowser, isNativeApp, isStandaloneDisplay, type Platform } from '@/lib/pwaInstall';
import { cn } from '@/lib/utils';

// Pasang aplikasi Tim (PWA /tim, manifest sendiri) di layar utama Android/iPhone. Harus dari halaman /tim:
// dialog install browser selalu memasang aplikasi milik halaman yang sedang dibuka. Tampil sebagai notifikasi.
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

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_KEY = 'leosiqra:tim-install-snooze';

/** Notifikasi "Pasang aplikasi Tim" yang muncul sendiri dari atas layar (bukan tombol). Tidak muncul kalau sudah
 *  dibuka sebagai aplikasi; "Nanti" = sembunyi 7 hari di perangkat ini. iPhone / tanpa dialog install → panduan. */
export function TimInstall() {
  const { state, promptInstall } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>('android');
  const [show, setShow] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    if (isStandaloneDisplay() || isNativeApp()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi perangkat setelah hydrate
    setPlatform(detectPlatform() === 'ios' ? 'ios' : 'android');
    let snoozed = false;
    try {
      snoozed = Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_MS;
    } catch {
      /* penyimpanan diblokir → tetap tampil */
    }
    if (snoozed) return;
    // Beri jeda supaya halaman sempat tampil & event install Chrome sempat masuk.
    const t = window.setTimeout(() => setShow(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  const later = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* tidak tersimpan — notif bisa muncul lagi */
    }
    setShow(false);
  };
  const pasang = async () => {
    if (state === 'available') {
      const r = await promptInstall();
      if (r === 'accepted') return setShow(false);
    }
    setShow(false);
    setGuide(true);
  };
  const visible = show && state !== 'installed';
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            role="dialog"
            aria-label="Pasang aplikasi Tim"
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_e, info) => info.offset.y < -40 && later()}
            className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-[96] mx-auto max-w-md"
          >
            <div className="flex items-start gap-3 rounded-[22px] bg-white/95 p-3.5 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/70 backdrop-blur-xl">
              <span className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-[12px] shadow-sm">
                <Image src="/images/tim-192.png" alt="" fill sizes="44px" className="object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 fs-11 font-semibold uppercase tracking-wide text-slate-400">
                  Leosiqra Tim <span className="normal-case tracking-normal">· sekarang</span>
                </p>
                <p className="fs-14 font-extrabold text-slate-900">Pasang aplikasi Tim di HP ini</p>
                <p className="fs-12 leading-snug text-slate-500">Buka langsung dari layar utama, tanpa ketik alamat lagi.</p>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={pasang} className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 fs-12 font-black text-white shadow-md shadow-emerald-600/25 active:scale-95">
                    <Download size={13} /> Pasang
                  </button>
                  <button type="button" onClick={later} className="rounded-full px-3 py-2 fs-12 font-bold text-slate-500 hover:bg-slate-100">
                    Nanti
                  </button>
                </div>
              </div>
              <button type="button" onClick={later} aria-label="Tutup" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomSheet isOpen={guide} onClose={() => setGuide(false)} title="Pasang aplikasi Tim">
        <InstallBody platform={platform} />
      </BottomSheet>
    </>
  );
}
