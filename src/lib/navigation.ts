import {
  LayoutDashboard,
  Bot,
  PlusCircle,
  ListOrdered,
  ArrowLeftRight,
  Repeat,
  Building2,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Briefcase,
  Landmark,
  Coins,
  Globe,
  Target,
  HandCoins,
  ShieldCheck,
  CalendarRange,
  User,
  Tags,
  Compass,
  Headphones,
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

// Entri tanpa grup — selalu kelihatan di paling atas.
export const primaryNav: NavItem[] = [
  { label: 'Dashboard', href: '/membership/dashboard', icon: LayoutDashboard },
  { label: 'AI Leosiqra', href: '/membership/ai-leosiqra', icon: Bot },
];

export const navGroups: NavGroup[] = [
  {
    id: 'transaksi',
    label: 'Transaksi',
    icon: ListOrdered,
    items: [
      { label: 'Catat Transaksi', href: '/membership/transactions/input', icon: PlusCircle },
      { label: 'Riwayat Transaksi', href: '/membership/transactions/daily', icon: ListOrdered },
      { label: 'Transfer & Top Up', href: '/membership/transactions/topup', icon: ArrowLeftRight },
      { label: 'Transaksi Rutin', href: '/membership/recurring', icon: Repeat },
    ],
  },
  {
    id: 'aset',
    label: 'Rekening & Aset',
    icon: Building2,
    items: [
      { label: 'Rekening', href: '/membership/rekening', icon: Building2 },
      { label: 'Kartu Saya', href: '/membership/cards', icon: CreditCard },
      { label: 'Tabungan', href: '/membership/tabungan', icon: PiggyBank },
    ],
  },
  {
    id: 'investasi',
    label: 'Investasi',
    icon: TrendingUp,
    items: [
      { label: 'Ringkasan Portofolio', href: '/membership/investment', icon: TrendingUp },
      { label: 'Saham', href: '/membership/investasi/saham', icon: Briefcase },
      { label: 'Deposito', href: '/membership/investasi/deposito', icon: Landmark },
      { label: 'Investasi Lainnya', href: '/membership/investasi/lainnya', icon: Coins },
      { label: 'Data Pasar', href: '/membership/market-data', icon: Globe },
    ],
  },
  {
    id: 'perencanaan',
    label: 'Perencanaan & Laporan',
    icon: Target,
    items: [
      { label: 'Budget & Target', href: '/membership/budget', icon: Target },
      { label: 'Hutang & Piutang', href: '/membership/transactions/debt', icon: HandCoins },
      { label: 'Laporan Tahunan', href: '/membership/annual', icon: CalendarRange },
      { label: 'Pajak Center', href: '/membership/pajak-center', icon: ShieldCheck },
    ],
  },
  {
    id: 'akun',
    label: 'Akun & Bantuan',
    icon: User,
    items: [
      { label: 'Profil & Keamanan', href: '/membership/profile', icon: User },
      { label: 'Kategori & Mata Uang', href: '/membership/nama-akun', icon: Tags },
      { label: 'Panduan', href: '/membership/panduan', icon: Compass },
      { label: 'Hubungi Kami', href: '/membership/hubungi-kami', icon: Headphones },
    ],
  },
];

// Halaman yang tidak ada di menu tapi tetap butuh judul di Header.
const extraTitles: Record<string, string> = {
  '/membership/contact': 'Upgrade ke PRO',
  '/membership/onboarding': 'Setup Awal',
};

export function findNavContext(pathname: string): { title: string; group?: string } {
  const primary = primaryNav.find((i) => i.href === pathname);
  if (primary) return { title: primary.label };
  for (const group of navGroups) {
    const item = group.items.find((i) => i.href === pathname);
    if (item) return { title: item.label, group: group.label };
  }
  return { title: extraTitles[pathname] ?? 'Leosiqra' };
}
