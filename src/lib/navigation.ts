import {
  LayoutDashboard,
  BarChart3,
  Bot,
  PlusCircle,
  ListOrdered,
  Repeat,
  Building2,
  PieChart,
  TrendingUp,
  Briefcase,
  Landmark,
  Coins,
  Target,
  ShieldCheck,
  CalendarRange,
  User,
  Compass,
  Headphones,
  MessageSquareHeart,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Satu sumber data navigasi /membership — dipakai Sidebar (menu), Header
// (judul halaman), dan halaman Panduan (tur yang menyorot grup sidebar lewat
// data-tour="sidebar-group-<id>"). URL sengaja TIDAK diubah dari struktur
// lama supaya bookmark user & OnboardingTour (navigasi per path) tetap jalan;
// yang berubah cuma pengelompokan dan label.

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

// Menu samping dibagi dua: "Keuangan" (4 halaman inti, selalu tampil) dan
// "Fitur" (pintasan ke fitur yang paling sering dipakai + "Semua fitur").
// navGroups di bawah tetap jadi daftar lengkap semua fitur — dipakai halaman
// /membership/fitur, judul Header, dan halaman Panduan.
export const keuanganNav: NavItem[] = [
  { label: 'Ringkasan', href: '/membership/dashboard', icon: LayoutDashboard },
  { label: 'Transaksi', href: '/membership/transactions/daily', icon: ListOrdered },
  { label: 'Laporan', href: '/membership/laporan', icon: BarChart3 },
  { label: 'Rekening', href: '/membership/rekening', icon: Building2 },
];

export const fiturNav: NavItem[] = [
  { label: 'AI Leo', href: '/membership/ai-leosiqra', icon: Bot },
  { label: 'Investasiku', href: '/membership/investment', icon: TrendingUp },
  { label: 'Kekayaan', href: '/membership/kekayaan', icon: PieChart },
];

export const SEMUA_FITUR_HREF = '/membership/fitur';

// Kompatibilitas: dulu dipakai Sidebar sebagai menu paling atas.
export const primaryNav: NavItem[] = [keuanganNav[0], fiturNav[0]];

export const navGroups: NavGroup[] = [
  {
    id: 'transaksi',
    label: 'Transaksi',
    icon: ListOrdered,
    items: [
      { label: 'Catat Transaksi', href: '/membership/transactions/input', icon: PlusCircle },
      { label: 'Riwayat Transaksi', href: '/membership/transactions/daily', icon: ListOrdered },
      { label: 'Transaksi Rutin', href: '/membership/recurring', icon: Repeat },
    ],
  },
  {
    id: 'aset',
    label: 'Rekening & Aset',
    icon: Building2,
    items: [
      { label: 'Rekening', href: '/membership/rekening', icon: Building2 },
      { label: 'Kekayaan', href: '/membership/kekayaan', icon: PieChart },
      { label: 'Dompet Bersama', href: '/membership/dompet-bersama', icon: Users },
    ],
  },
  {
    id: 'investasi',
    label: 'Investasi',
    icon: TrendingUp,
    items: [
      { label: 'Investasiku', href: '/membership/investment', icon: TrendingUp },
      { label: 'Saham', href: '/membership/investasi/saham', icon: Briefcase },
      { label: 'Deposito', href: '/membership/investasi/deposito', icon: Landmark },
      { label: 'Investasi Lainnya', href: '/membership/investasi/lainnya', icon: Coins },
    ],
  },
  {
    id: 'perencanaan',
    label: 'Perencanaan & Laporan',
    icon: Target,
    items: [
      { label: 'Laporan Tahunan', href: '/membership/annual', icon: CalendarRange },
      { label: 'Pajak Center', href: '/membership/pajak-center', icon: ShieldCheck },
    ],
  },
  {
    id: 'akun',
    label: 'Akun & Bantuan',
    icon: User,
    items: [
      { label: 'Panduan', href: '/membership/panduan', icon: Compass },
      { label: 'Saran & Kritik', href: '/membership/saran', icon: MessageSquareHeart },
      { label: 'Hubungi Kami', href: '/membership/hubungi-kami', icon: Headphones },
    ],
  },
];

// Halaman yang tidak ada di menu tapi tetap butuh judul di Header.
const extraTitles: Record<string, string> = {
  '/membership/contact': 'Upgrade ke PRO',
  '/membership/onboarding': 'Setup Awal',
  '/membership/fitur': 'Semua fitur',
  '/membership/aplikasi': 'Aplikasi terhubung',
  '/membership/kotak-masuk': 'Kotak Masuk',
  '/membership/impor': 'Impor',
  '/membership/laporan': 'Laporan',
  '/membership/budget': 'Kategori & Anggaran',
  '/membership/nama-akun': 'Kategori & Anggaran',
  '/membership/profile': 'Pengaturan',
};

export function findNavContext(pathname: string): { title: string; group?: string } {
  const main = keuanganNav.find((i) => i.href === pathname) ?? fiturNav.find((i) => i.href === pathname);
  if (main) return { title: main.label };
  for (const group of navGroups) {
    const item = group.items.find((i) => i.href === pathname);
    if (item) return { title: item.label, group: group.label };
  }
  return { title: extraTitles[pathname] ?? 'Leosiqra' };
}
