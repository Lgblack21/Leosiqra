"use client";

import { useEffect, useState } from 'react';
import {
  Flame,
  Gem,
  PiggyBank,
  TrendingUp,
  CreditCard,
  HandCoins,
  Repeat,
  Users,
  ShieldCheck,
  Globe,
  Waypoints,
  Timer,
  NotebookPen,
  Calculator,
  Package,
  Sparkle,
  Coins,
  Network,
  Map as MapIcon,
  type LucideIcon,
} from 'lucide-react';

// Fitur yang bisa dinyalakan/dimatikan user ("Kelola fitur"). Mematikan fitur
// hanya menyembunyikan menu & kotaknya di Dashboard — datanya TIDAK dihapus.
// Pilihan disimpan per perangkat (localStorage), tanpa tabel baru.
export type FeatureId =
  | 'streak'
  | 'kekayaan'
  | 'tabungan'
  | 'investasi'
  | 'kartu'
  | 'hutang'
  | 'rutin'
  | 'dompet-bersama'
  | 'pajak'
  | 'pasar'
  | 'arus'
  | 'fokus'
  | 'jurnal'
  | 'investasiku'
  | 'barang'
  | 'koleksi'
  | 'cuan'
  | 'kanvas'
  | 'peta';

export interface FeatureDef {
  id: FeatureId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string; // kelas warna ikon
  href: string;
  /** Halaman menu yang ikut disembunyikan saat fitur dimatikan. */
  navHrefs: string[];
  isNew?: boolean;
  /** Label pendek untuk sidebar. */
  short?: string;
}

export const FEATURES: FeatureDef[] = [
  { id: 'streak', short: 'Streak', label: 'Tutup hari & streak', description: 'Cek catatanmu tiap malam, tutup harinya, jaga streak dan kumpulkan koin.', icon: Flame, tone: 'bg-orange-50 text-orange-500', href: '/membership/streak', navHrefs: ['/membership/streak'], isNew: true },
  { id: 'kekayaan', short: 'Kekayaan', label: 'Kekayaan', description: 'Rekening, tabungan, investasi, dan piutang dikurangi utang — jadi satu angka kekayaan bersih.', icon: Gem, tone: 'bg-violet-50 text-violet-600', href: '/membership/kekayaan', navHrefs: ['/membership/kekayaan'], isNew: true },
  { id: 'tabungan', short: 'Tabungan', label: 'Tabungan & target', description: 'Setoran tabungan dan target seperti dana darurat, rumah, atau liburan.', icon: PiggyBank, tone: 'bg-sky-50 text-sky-600', href: '/membership/tabungan', navHrefs: ['/membership/tabungan'] },
  { id: 'investasi', short: 'Investasi', label: 'Investasi', description: 'Saham, deposito, emas, kripto, dan investasi lain dalam satu portofolio.', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600', href: '/membership/investment', navHrefs: ['/membership/investment', '/membership/investasi/saham', '/membership/investasi/deposito', '/membership/investasi/lainnya'] },
  { id: 'investasiku', short: 'Simulasi investasi', label: 'Simulasi Investasiku', description: 'Uangmu jadi berapa di SBN, reksa dana pasar uang, deposito, atau tabungan — sudah dipotong pajak.', icon: Calculator, tone: 'bg-lime-50 text-lime-600', href: '/membership/investasiku', navHrefs: ['/membership/investasiku'], isNew: true },
  { id: 'kartu', short: 'Kartu kredit', label: 'Kartu kredit', description: 'Limit, tagihan, dan tanggal jatuh tempo tiap kartu kredit atau paylater.', icon: CreditCard, tone: 'bg-amber-50 text-amber-600', href: '/membership/rekening?panel=kartu', navHrefs: ['/membership/cards'] },
  { id: 'hutang', short: 'Hutang & piutang', label: 'Hutang & piutang', description: 'Catat pinjaman dan uang yang kamu pinjamkan, lengkap dengan cicilannya.', icon: HandCoins, tone: 'bg-rose-50 text-rose-500', href: '/membership/transactions/debt', navHrefs: ['/membership/transactions/debt'] },
  { id: 'arus', short: 'Ikuti uangmu', label: 'Ikuti uangmu', description: 'Dari mana uangmu datang dan ke mana perginya, dalam satu gambar.', icon: Waypoints, tone: 'bg-fuchsia-50 text-fuchsia-600', href: '/membership/arus', navHrefs: ['/membership/arus'], isNew: true },
  { id: 'rutin', short: 'Langganan', label: 'Langganan & tagihan rutin', description: 'Netflix, listrik, cicilan, gaji — total per bulan, kalender tagihan, dan cek langganan otomatis.', icon: Repeat, tone: 'bg-indigo-50 text-indigo-600', href: '/membership/langganan', navHrefs: ['/membership/langganan', '/membership/recurring'] },
  { id: 'dompet-bersama', short: 'Dompet bersama', label: 'Dompet bersama', description: 'Kas keluarga atau patungan bareng teman, semua anggota bisa mencatat.', icon: Users, tone: 'bg-teal-50 text-teal-600', href: '/membership/dompet-bersama', navHrefs: ['/membership/dompet-bersama'] },
  { id: 'fokus', short: 'Fokus', label: 'Fokus', description: 'Timer Pomodoro bareng Leo untuk belajar, kerja, atau baca — lengkap dengan rekap mingguan.', icon: Timer, tone: 'bg-indigo-50 text-indigo-600', href: '/membership/fokus', navHrefs: ['/membership/fokus'], isNew: true },
  { id: 'jurnal', short: 'Jurnal', label: 'Jurnal', description: 'Satu halaman tiap hari: mood, satu kalimat, dan satu hal yang berarti. Tahunmu jadi titik-titik warna.', icon: NotebookPen, tone: 'bg-pink-50 text-pink-600', href: '/membership/jurnal', navHrefs: ['/membership/jurnal'], isNew: true },
  { id: 'barang', short: 'Barang', label: 'Barang', description: 'Semua barang milikmu — HP, laptop, motor — lengkap dengan nilai dan masa garansi.', icon: Package, tone: 'bg-stone-100 text-stone-600', href: '/membership/barang', navHrefs: ['/membership/barang'], isNew: true },
  { id: 'koleksi', short: 'Koleksi', label: 'Koleksi', description: 'Kartu, sneakers, figur, dan barang koleksi lain dengan nilai taksiranmu.', icon: Sparkle, tone: 'bg-yellow-50 text-yellow-600', href: '/membership/koleksi', navHrefs: ['/membership/koleksi'], isNew: true },
  { id: 'cuan', short: 'Cuan', label: 'Cuan', description: 'Target cuan bulanan, jual barang nganggur, tagih piutang lewat WhatsApp, dan ide dari Leo.', icon: Coins, tone: 'bg-emerald-50 text-emerald-600', href: '/membership/cuan', navHrefs: ['/membership/cuan'], isNew: true },
  { id: 'kanvas', short: 'Kanvas', label: 'Kanvas', description: 'Semua uangmu dalam satu papan: dari uang masuk, rekening, sampai pengeluaran dan tabungan.', icon: Network, tone: 'bg-sky-50 text-sky-600', href: '/membership/kanvas', navHrefs: ['/membership/kanvas'], isNew: true },
  { id: 'peta', short: 'Peta', label: 'Peta', description: 'Tempat-tempat kamu belanja di peta, jejak harian, dan rekap 30 hari.', icon: MapIcon, tone: 'bg-teal-50 text-teal-600', href: '/membership/peta', navHrefs: ['/membership/peta'], isNew: true },
  { id: 'pajak', short: 'Pajak', label: 'Pajak Center', description: 'Bantu siapkan data SPT dari catatan keuanganmu.', icon: ShieldCheck, tone: 'bg-slate-100 text-slate-600', href: '/membership/pajak-center', navHrefs: ['/membership/pajak-center'] },
  { id: 'pasar', short: 'Data pasar', label: 'Data pasar', description: 'Harga saham, kripto, emas, dan kurs terkini.', icon: Globe, tone: 'bg-cyan-50 text-cyan-600', href: '/membership/market-data', navHrefs: ['/membership/market-data'] },
];

// Default dibuat ringkas: fitur keuangan inti nyala, fitur tambahan mati
// (tinggal dinyalakan di Kelola fitur). Data fitur yang mati tetap aman.
const DEFAULT_OFF: FeatureId[] = ['arus', 'kanvas', 'fokus', 'jurnal', 'cuan', 'barang', 'koleksi', 'peta', 'investasiku', 'pajak', 'pasar'];
const KEY = 'leo-features:v1';
const EVENT = 'leo-features-change';

const read = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
};

export const isFeatureOn = (prefs: Record<string, boolean>, id: FeatureId) => prefs[id] ?? !DEFAULT_OFF.includes(id);

export function useFeatures() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const sync = () => setPrefs(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setFeature = (id: FeatureId, on: boolean) => {
    const next = { ...read(), [id]: on };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage diblokir — pilihan berlaku sampai halaman dimuat ulang */
    }
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  };

  const enabled = FEATURES.filter((f) => isFeatureOn(prefs, f.id));
  const hiddenHrefs = new Set(FEATURES.filter((f) => !isFeatureOn(prefs, f.id)).flatMap((f) => f.navHrefs));
  return { prefs, enabled, hiddenHrefs, setFeature, isOn: (id: FeatureId) => isFeatureOn(prefs, id) };
}
