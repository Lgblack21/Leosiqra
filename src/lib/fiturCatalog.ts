import {
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  Compass,
  FileUp,
  Footprints,
  Gauge,
  Headphones,
  HeartPulse,
  ListOrdered,
  Map as MapIcon,
  Leaf,
  MessageSquareHeart,
  NotebookPen,
  PieChart,
  PiggyBank,
  PlusCircle,
  Radar,
  Repeat,
  ShieldCheck,
  Sprout,
  Sticker,
  Timer,
  TrendingUp,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureId } from '@/lib/features';

// Katalog semua fitur untuk halaman Semua Fitur & pencarian Ctrl+K. Dikelompokkan per TUJUAN
// (bukan per menu). `feature` = id yang bisa dinyalakan/dimatikan di menu samping; `since` =
// versi rilis fitur (lencana "Baru" untuk dua versi minor terakhir).

export type GoalId = 'catat' | 'harta' | 'rencana' | 'hidup' | 'usaha' | 'leo' | 'bantuan';
export type Fitur = {
  key: string;
  label: string;
  sub: string;
  href: string;
  appHref?: string;
  icon: LucideIcon;
  goal: GoalId;
  feature?: FeatureId;
  since?: string;
  keywords?: string;
  /** Fitur tetap bisa dipakai paket Gratis; PRO dapat jatah lebih besar (dijalankan di Worker). */
  pro?: string;
};

export const GOALS: { id: GoalId; label: string; sub: string; tone: string }[] = [
  { id: 'catat', label: 'Catat & pantau', sub: 'Uang masuk, keluar, dan tagihan', tone: 'sky' },
  { id: 'harta', label: 'Tumbuhkan harta', sub: 'Tabungan, investasi, kekayaan bersih', tone: 'emerald' },
  { id: 'rencana', label: 'Rencanakan', sub: 'Tujuan, cek kesehatan keuangan, pajak', tone: 'violet' },
  { id: 'hidup', label: 'Sehat & tenang', sub: 'Badan, fokus, dan cerita harianmu', tone: 'rose' },
  { id: 'usaha', label: 'Usaha', sub: 'Jualan dan catatan usaha kecil', tone: 'amber' },
  { id: 'leo', label: 'Leo', sub: 'Asisten keuanganmu', tone: 'indigo' },
  { id: 'bantuan', label: 'Bantuan', sub: 'Panduan dan kabari kami', tone: 'slate' },
];

export const TONE: Record<string, { tile: string; soft: string; text: string; ring: string }> = {
  sky: {
    tile: 'from-sky-400 to-cyan-500',
    soft: 'bg-sky-50 dark:bg-sky-500/10',
    text: 'text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-100 dark:ring-sky-500/20',
  },
  emerald: {
    tile: 'from-emerald-400 to-teal-500',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-300',
    ring: 'ring-emerald-100 dark:ring-emerald-500/20',
  },
  violet: {
    tile: 'from-violet-500 to-fuchsia-500',
    soft: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-300',
    ring: 'ring-violet-100 dark:ring-violet-500/20',
  },
  rose: {
    tile: 'from-rose-400 to-orange-400',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-300',
    ring: 'ring-rose-100 dark:ring-rose-500/20',
  },
  amber: {
    tile: 'from-amber-400 to-orange-500',
    soft: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-300',
    ring: 'ring-amber-100 dark:ring-amber-500/20',
  },
  indigo: {
    tile: 'from-indigo-500 to-violet-500',
    soft: 'bg-indigo-50 dark:bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-300',
    ring: 'ring-indigo-100 dark:ring-indigo-500/20',
  },
  slate: {
    tile: 'from-slate-400 to-slate-600',
    soft: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    ring: 'ring-slate-200 dark:ring-slate-700',
  },
};

export const FITUR: Fitur[] = [
  {
    key: 'catat',
    label: 'Catat transaksi',
    sub: 'Masuk atau keluar, 10 detik',
    href: '/membership/transactions/input',
    appHref: '/app/transactions',
    icon: PlusCircle,
    goal: 'catat',
    keywords: 'tambah input pengeluaran pemasukan',
  },
  {
    key: 'riwayat',
    label: 'Riwayat transaksi',
    sub: 'Semua catatanmu',
    href: '/membership/transactions/daily',
    appHref: '/app/transactions',
    icon: ListOrdered,
    goal: 'catat',
    keywords: 'daftar histori',
  },
  {
    key: 'laporan',
    label: 'Laporan',
    sub: 'Grafik bulananmu',
    href: '/membership/laporan',
    appHref: '/app/statistics',
    icon: BarChart3,
    goal: 'catat',
    keywords: 'statistik grafik',
  },
  {
    key: 'rekening',
    label: 'Rekening',
    sub: 'Bank, dompet, e-wallet',
    href: '/membership/rekening',
    appHref: '/app/wallet',
    icon: Building2,
    goal: 'catat',
    keywords: 'akun saldo bank ewallet',
  },
  {
    key: 'rutin',
    label: 'Transaksi rutin',
    sub: 'Gaji, cicilan, tagihan otomatis',
    href: '/membership/recurring',
    appHref: '/app/recurring',
    icon: Repeat,
    goal: 'catat',
    feature: 'rutin',
    keywords: 'otomatis berulang cicilan',
  },
  {
    key: 'langganan',
    label: 'Langgananku',
    sub: 'Netflix, Spotify & kawan',
    href: '/membership/langganan',
    appHref: '/app/langganan',
    icon: Radar,
    goal: 'catat',
    feature: 'langganan',
    keywords: 'subscription tagihan bulanan',
  },
  {
    key: 'jejak',
    label: 'Jejak Uang',
    sub: 'Uangmu lari ke mana',
    href: '/membership/jejak-uang',
    icon: Footprints,
    goal: 'catat',
    feature: 'jejak',
    keywords: 'analisis kebiasaan',
  },
  {
    key: 'impor',
    label: 'Impor mutasi',
    sub: 'Dari rekening koran / e-wallet',
    href: '/membership/impor',
    icon: FileUp,
    goal: 'catat',
    keywords: 'import csv pdf mutasi',
  },
  {
    key: 'kekayaan',
    label: 'Kekayaan',
    sub: 'Harta bersih & utang',
    href: '/membership/kekayaan',
    appHref: '/app/wallet',
    icon: PieChart,
    goal: 'harta',
    feature: 'tabungan',
    keywords: 'aset utang piutang tabungan harta',
  },
  {
    key: 'investasi',
    label: 'Investasiku',
    sub: 'Saham, deposito, lainnya',
    href: '/membership/investment',
    appHref: '/app/investments',
    icon: TrendingUp,
    goal: 'harta',
    feature: 'investasi',
    keywords: 'saham reksadana deposito emas',
  },
  {
    key: 'budget',
    label: 'Anggaran',
    sub: 'Batas belanja per kategori',
    href: '/membership/budget',
    appHref: '/app/budget',
    icon: PiggyBank,
    goal: 'harta',
    keywords: 'budget batas',
  },
  {
    key: 'bersama',
    label: 'Dompet Bersama',
    sub: 'Keuangan berdua / keluarga',
    href: '/membership/dompet-bersama',
    appHref: '/app/dompet-bersama',
    icon: Users,
    goal: 'harta',
    keywords: 'pasangan keluarga patungan',
    pro: 'PRO: 5 dompet, 10 anggota',
  },
  {
    key: 'kanvas',
    label: 'Kanvas',
    sub: 'Rencana bab demi bab',
    href: '/membership/kanvas',
    appHref: '/app/kanvas',
    icon: Waypoints,
    goal: 'rencana',
    feature: 'kanvas',
    since: '3.10.0',
    keywords: 'rencana nikah kpr pensiun dana darurat',
  },
  {
    key: 'peta',
    label: 'Peta Belanja',
    sub: 'Ke mana uangmu dibelanjakan',
    href: '/membership/peta',
    appHref: '/app/peta',
    icon: MapIcon,
    goal: 'catat',
    feature: 'peta',
    since: '3.14.0',
    keywords: 'peta lokasi tempat belanja map gps',
  },
  {
    key: 'teduh',
    label: 'Teduh',
    sub: "Kitab suci & ketenangan — mulai dari Al-Qur'an",
    href: '/membership/teduh',
    appHref: '/app/teduh',
    icon: Leaf,
    goal: 'hidup',
    feature: 'teduh',
    since: '3.18.0',
    keywords:
      'quran al-quran ayat surah murattal agama islam kristen katolik hindu buddha konghucu alkitab sedekah zakat ibadah',
  },
  {
    key: 'cek',
    label: 'Rapor Keuangan',
    sub: 'Nilai A–E dari tujuh indikator',
    href: '/membership/cek-keuangan',
    appHref: '/app/cek-keuangan',
    icon: Gauge,
    goal: 'rencana',
    feature: 'cek',
    since: '3.11.0',
    keywords: 'rapor nilai skor cek kesehatan rasio dana darurat utang',
  },
  {
    key: 'pajak',
    label: 'Pajak Center',
    sub: 'Draft SPT tahunan',
    href: '/membership/pajak-center',
    icon: ShieldCheck,
    goal: 'rencana',
    feature: 'pajak',
    keywords: 'spt pph npwp',
  },
  {
    key: 'tahunan',
    label: 'Rekap tahunan',
    sub: 'Setahunmu dalam angka',
    href: '/membership/annual',
    icon: CalendarClock,
    goal: 'rencana',
    keywords: 'wrapped tahun',
  },
  {
    key: 'sehat',
    label: 'Sehatku',
    sub: 'Makan, cek kesehatan, asuransi',
    href: '/membership/sehat',
    appHref: '/app/sehat',
    icon: HeartPulse,
    goal: 'hidup',
    feature: 'sehat',
    keywords: 'kesehatan bpjs asuransi makan kalori',
    pro: 'PRO: analisis makanan 10×/hari',
  },
  {
    key: 'fokus',
    label: 'Fokus bareng Leo',
    sub: 'Pomodoro & catatan fokus',
    href: '/membership/fokus',
    appHref: '/app/fokus',
    icon: Timer,
    goal: 'hidup',
    feature: 'fokus',
    keywords: 'pomodoro belajar kerja timer',
  },
  {
    key: 'cerita',
    label: 'Cerita Hari Ini',
    sub: 'Satu halaman sehari',
    href: '/membership/cerita',
    appHref: '/app/cerita',
    icon: NotebookPen,
    goal: 'hidup',
    feature: 'cerita',
    keywords: 'jurnal diary mood',
    pro: 'PRO: 10 ilustrasi AI/bulan',
  },
  {
    key: 'stiker',
    label: 'Stikerku',
    sub: 'Angka keuangan jadi stiker',
    href: '/membership/stiker',
    appHref: '/app/stiker',
    icon: Sticker,
    goal: 'hidup',
    feature: 'stiker',
    since: '3.8.0',
    keywords: 'story instagram bagikan',
  },
  {
    key: 'ladang',
    label: 'Ladangku',
    sub: 'Jual, kasir, tagih',
    href: '/membership/ladang',
    appHref: '/app/ladang',
    icon: Sprout,
    goal: 'usaha',
    feature: 'ladang',
    keywords: 'usaha toko kasir jualan umkm',
    pro: 'PRO: 5 akun tim',
  },
  {
    key: 'ai',
    label: 'AI Leo',
    sub: 'Tanya apa saja soal uangmu',
    href: '/membership/ai-leosiqra',
    appHref: '/app/assistant',
    icon: Bot,
    goal: 'leo',
    feature: 'ai',
    keywords: 'chat asisten tanya',
    pro: 'PRO: 50 chat/hari',
  },
  {
    key: 'panduan',
    label: 'Panduan',
    sub: 'Cara memakai Leosiqra',
    href: '/membership/panduan',
    icon: Compass,
    goal: 'bantuan',
    keywords: 'bantuan tutorial',
  },
  {
    key: 'saran',
    label: 'Saran & kritik',
    sub: 'Bantu kami jadi lebih baik',
    href: '/membership/saran',
    appHref: '/app/saran',
    icon: MessageSquareHeart,
    goal: 'bantuan',
    keywords: 'feedback masukan',
  },
  {
    key: 'hubungi',
    label: 'Hubungi kami',
    sub: 'Ada masalah? Kabari',
    href: '/membership/hubungi-kami',
    icon: Headphones,
    goal: 'bantuan',
    keywords: 'kontak cs support',
  },
];

export const toneOf = (f: Fitur) => GOALS.find((g) => g.id === f.goal)?.tone ?? 'slate';

// "Baru" = dirilis di minor yang sama atau satu minor sebelum versi aplikasi sekarang.
export const isNew = (f: Fitur, appVersion: string) => {
  if (!f.since) return false;
  const [a, b] = appVersion.split('.').map(Number);
  const [x, y] = f.since.split('.').map(Number);
  return a === x && b - y <= 1 && b >= y;
};

export const searchFitur = (q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return FITUR;
  return FITUR.filter((f) => `${f.label} ${f.sub} ${f.keywords ?? ''}`.toLowerCase().includes(s));
};

// Riwayat buka fitur (per perangkat) untuk ajakan "Belum dicoba".
const SEEN_KEY = 'leosiqra-fitur-dibuka';
export const markSeen = (href: string) => {
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    const f = FITUR.find(
      (x) => href === x.href || href.startsWith(`${x.href}/`) || (x.appHref && href.startsWith(x.appHref)),
    );
    if (!f || set.has(f.key)) return;
    set.add(f.key);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-100)));
  } catch {
    /* storage diblokir */
  }
};
export const readSeen = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

// Jatah PRO per href fitur (untuk label PRO di menu samping).
export const proHint = (href: string) => FITUR.find((f) => f.href === href)?.pro;
