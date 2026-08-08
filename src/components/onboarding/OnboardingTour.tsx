"use client";

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Building2,
  TrendingUp,
  PiggyBank,
  Calculator,
  Sparkles,
  Tags,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  X,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Kunci localStorage — dipakai supaya tur tetap jalan walau user reload halaman
// di tengah-tengah walkthrough (state React di layout hilang saat full reload,
// localStorage tidak).
const TOUR_FLAG = 'leosiqra_onboarding_tour';
const TOUR_STEP = 'leosiqra_onboarding_tour_step';
// Event kustom yang dipancarkan wizard onboarding begitu setup selesai, supaya
// komponen ini (yang sudah ter-mount di layout sejak halaman onboarding) tahu
// harus mulai tur — tanpa perlu remount.
export const START_TOUR_EVENT = 'leosiqra:start-tour';

interface TourStop {
  path: string;
  icon: React.ElementType;
  title: string;
  content: string;
}

// Urutan "keliling halaman" — tiap langkah benar-benar memindahkan user ke
// halaman aslinya (bukan cuma menyorot menu), jadi user melihat tiap halaman
// satu per satu sambil membaca penjelasan singkatnya.
const STOPS: TourStop[] = [
  {
    path: '/membership/dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard — Beranda kamu',
    content: 'Ini pusat kendali: total aset, pemasukan, pengeluaran, dan ringkasan keuangan kamu dalam satu layar. Semua angka di sini otomatis mengikuti transaksi yang kamu catat.',
  },
  {
    path: '/membership/transactions/input',
    icon: PlusCircle,
    title: 'Input Transaksi',
    content: 'Catat setiap pemasukan & pengeluaran di sini. Pilih rekening, kategori, dan nominal — saldo rekening langsung ter-update otomatis.',
  },
  {
    path: '/membership/rekening',
    icon: Building2,
    title: 'Rekening',
    content: 'Semua rekening bank, e-wallet, uang tunai, dan kartu kredit/paylater kamu berkumpul di sini lengkap dengan saldonya.',
  },
  {
    path: '/membership/investment',
    icon: TrendingUp,
    title: 'Investasi',
    content: 'Pantau saham, deposito, emas, dan aset lain. Harga saham/kripto tersinkron otomatis biar nilai portofoliomu selalu terkini.',
  },
  {
    path: '/membership/tabungan',
    icon: PiggyBank,
    title: 'Tabungan',
    content: 'Buat target tabungan (mis. Dana Darurat, Liburan) dan pantau progresnya sampai tercapai.',
  },
  {
    path: '/membership/pajak-center',
    icon: Calculator,
    title: 'Pajak Center',
    content: 'Hitung SPT/PPh otomatis dari data penghasilanmu — salah satu fitur andalan Leosiqra biar urusan pajak nggak bikin pusing.',
  },
  {
    path: '/membership/ai-leosiqra',
    icon: Sparkles,
    title: 'AI Leosiqra',
    content: 'Asisten AI yang paham datamu. Tanya apa aja: "berapa pengeluaran bulan ini?", "aku boros di mana?", dan dapat jawaban langsung.',
  },
  {
    path: '/membership/nama-akun',
    icon: Tags,
    title: 'Nama Akun & Kategori',
    content: 'Atur kategori dan sub-kategori transaksimu sesuka hati. Yang kamu pilih saat setup tadi bisa ditambah/ubah kapan saja di sini.',
  },
  {
    path: '/membership/profile',
    icon: UserCircle,
    title: 'Profil & Keamanan — Selesai! 🎉',
    content: 'Kelola profil, foto, keamanan 2FA, dan langganan di sini. Itu dia keliling singkatnya — selamat menikmati Leosiqra!',
  },
];

export const OnboardingTour = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const startTour = useCallback(() => {
    localStorage.setItem(TOUR_FLAG, '1');
    localStorage.setItem(TOUR_STEP, '0');
    setStep(0);
    setActive(true);
  }, []);

  // Init dari localStorage (kasus reload di tengah tur) + dengarkan event dari
  // wizard onboarding untuk kasus start normal (tanpa reload).
  useEffect(() => {
    if (localStorage.getItem(TOUR_FLAG) === '1') {
      const saved = Number(localStorage.getItem(TOUR_STEP) || '0');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- rehidrasi state tur sekali dari localStorage (kasus reload di tengah walkthrough); localStorage tidak tersedia saat SSR jadi tidak bisa dipakai sebagai initializer useState.
      setStep(Number.isFinite(saved) ? Math.min(Math.max(saved, 0), STOPS.length - 1) : 0);
      setActive(true);
    }
    const handler = () => startTour();
    window.addEventListener(START_TOUR_EVENT, handler);
    return () => window.removeEventListener(START_TOUR_EVENT, handler);
  }, [startTour]);

  const finish = useCallback(() => {
    localStorage.removeItem(TOUR_FLAG);
    localStorage.removeItem(TOUR_STEP);
    setActive(false);
  }, []);

  const goTo = useCallback(
    (nextStep: number) => {
      const clamped = Math.min(Math.max(nextStep, 0), STOPS.length - 1);
      setStep(clamped);
      localStorage.setItem(TOUR_STEP, String(clamped));
      const target = STOPS[clamped].path;
      if (pathname !== target) router.push(target);
    },
    [pathname, router]
  );

  if (!active) return null;
  const stop = STOPS[step];
  if (!stop) return null;
  const isLast = step === STOPS.length - 1;
  const isFirst = step === 0;
  const Icon = stop.icon;

  return (
    <>
      {/* Backdrop lembut — tidak menutup halaman sepenuhnya supaya user tetap
          bisa melihat halaman yang sedang dijelaskan di baliknya. */}
      <div
        className="fixed inset-0 z-[9998] bg-slate-900/30 backdrop-blur-[1px] animate-in fade-in duration-300"
        aria-hidden
        onClick={() => { /* sengaja tidak menutup — biar tidak ke-skip nggak sengaja */ }}
      />

      {/* Kartu: bottom-sheet di mobile, kartu mengambang di kanan-bawah desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={stop.title}
        className={cn(
          'fixed z-[9999] bg-white shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-4 fade-in duration-300',
          'inset-x-0 bottom-0 rounded-t-[28px] p-6 pb-8',
          'sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[360px] sm:rounded-[28px] sm:pb-6'
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              {isLast ? <PartyPopper size={20} /> : <Icon size={20} />}
            </div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
              Keliling Aplikasi · {step + 1}/{STOPS.length}
            </p>
          </div>
          <button
            onClick={finish}
            aria-label="Tutup tur"
            className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 -mt-1 -mr-1 p-1"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{stop.title}</h3>
        <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-2">{stop.content}</p>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden my-5">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STOPS.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors px-2 py-2"
          >
            Lewati
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => goTo(step - 1)}
                aria-label="Kembali"
                className="w-11 h-11 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : goTo(step + 1))}
              className="px-5 h-11 rounded-xl text-[13px] font-black text-white flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
            >
              {isLast ? 'Selesai' : 'Lanjut'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
