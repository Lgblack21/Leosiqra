import {
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  Target,
  Wallet,
  Inbox,
  Upload,
  Plug,
  User,
  Tags,
  Compass,
  Headphones,
  MessageSquareHeart,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { FEATURES } from '@/lib/features';

// Satu sumber navigasi /membership — dipakai Sidebar, Header (judul halaman),
// tab sub-halaman (SectionTabs), dan tur Panduan. Sidebar sengaja datar dan
// pendek (gaya baru): Keuangan (5 halaman inti), Fitur (hanya yang dinyalakan
// user di Kelola fitur), Pencatatan. Halaman lain tetap ada — dijangkau lewat
// tab di atas halaman induknya, menu akun, atau tombol Tambah transaksi.
// URL lama TIDAK diubah supaya bookmark & tur per path tetap jalan.

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const coreNav: NavItem[] = [
  { label: 'Ringkasan', href: '/membership/dashboard', icon: LayoutDashboard },
  { label: 'Transaksi', href: '/membership/transactions/daily', icon: ListOrdered },
  { label: 'Laporan', href: '/membership/laporan', icon: BarChart3 },
  { label: 'Anggaran', href: '/membership/budget', icon: Target },
  { label: 'Dompet', href: '/membership/rekening', icon: Wallet },
];

// `modal` = membuka form (bukan pindah halaman).
export const captureNav: (NavItem & { modal?: 'import_mutasi' })[] = [
  { label: 'Impor mutasi', href: '#impor', icon: Upload, modal: 'import_mutasi' },
  { label: 'Kotak masuk', href: '/membership/kotak-masuk', icon: Inbox },
  { label: 'Aplikasi terhubung', href: '/membership/aplikasi-terhubung', icon: Plug },
];

// Menu akun (dibuka dari kartu user di bawah sidebar).
export const accountNav: NavItem[] = [
  { label: 'Profil & keamanan', href: '/membership/profile', icon: User },
  { label: 'Kelola fitur', href: '/membership/fitur', icon: SlidersHorizontal },
  { label: 'Kategori & mata uang', href: '/membership/nama-akun', icon: Tags },
  { label: 'Panduan', href: '/membership/panduan', icon: Compass },
  { label: 'Saran & kritik', href: '/membership/saran', icon: MessageSquareHeart },
  { label: 'Hubungi kami', href: '/membership/hubungi-kami', icon: Headphones },
];

// Tab sub-halaman: halaman yang "satu keluarga" tampil sebagai tab di atas
// konten supaya sidebar tidak perlu memuat semuanya.
export interface SectionTab { label: string; href: string }
export const sectionTabs: SectionTab[][] = [
  [
    { label: 'Riwayat', href: '/membership/transactions/daily' },
    { label: 'Catat', href: '/membership/transactions/input' },
    { label: 'Transfer & top up', href: '/membership/transactions/topup' },
    { label: 'Transaksi rutin', href: '/membership/recurring' },
  ],
  [
    { label: 'Ringkasan', href: '/membership/laporan' },
    { label: 'Laporan cetak', href: '/membership/annual' },
    { label: 'Ikuti uangmu', href: '/membership/arus' },
    { label: 'Kanvas', href: '/membership/kanvas' },
    { label: 'Pajak', href: '/membership/pajak-center' },
  ],
  [
    { label: 'Rekening', href: '/membership/rekening' },
    { label: 'Tabungan', href: '/membership/tabungan' },
    { label: 'Dompet bersama', href: '/membership/dompet-bersama' },
  ],
  [
    { label: 'Ringkasan', href: '/membership/investment' },
    { label: 'Saham', href: '/membership/investasi/saham' },
    { label: 'Deposito', href: '/membership/investasi/deposito' },
    { label: 'Lainnya', href: '/membership/investasi/lainnya' },
    { label: 'Simulasi', href: '/membership/investasiku' },
    { label: 'Data pasar', href: '/membership/market-data' },
  ],
  [
    { label: 'Barang', href: '/membership/barang' },
    { label: 'Koleksi', href: '/membership/koleksi' },
  ],
  [
    { label: 'Langganan', href: '/membership/langganan' },
    { label: 'Transaksi rutin', href: '/membership/recurring' },
  ],
];

export const tabsFor = (pathname: string) => sectionTabs.find((g) => g.some((t) => t.href === pathname)) ?? null;

// Judul halaman untuk Header.
const TITLES: Record<string, string> = {
  '/membership/dashboard': 'Ringkasan',
  '/membership/ai-leosiqra': 'Tanya Leo',
  '/membership/transactions/daily': 'Transaksi',
  '/membership/transactions/input': 'Catat transaksi',
  '/membership/transactions/topup': 'Transfer & top up',
  '/membership/transactions/debt': 'Hutang & piutang',
  '/membership/recurring': 'Transaksi rutin',
  '/membership/laporan': 'Laporan',
  '/membership/annual': 'Laporan cetak',
  '/membership/budget': 'Anggaran',
  '/membership/rekening': 'Dompet',
  '/membership/cards': 'Kartu kredit',
  '/membership/investment': 'Investasi',
  '/membership/investasi/saham': 'Saham',
  '/membership/investasi/deposito': 'Deposito',
  '/membership/investasi/lainnya': 'Investasi lainnya',
  '/membership/market-data': 'Data pasar',
  '/membership/pajak-center': 'Pajak',
  '/membership/contact': 'Upgrade ke PRO',
  '/membership/onboarding': 'Setup awal',
};

export function findNavContext(pathname: string): { title: string } {
  if (TITLES[pathname]) return { title: TITLES[pathname] };
  const all = [...coreNav, ...captureNav, ...accountNav];
  const item = all.find((i) => i.href === pathname);
  if (item) return { title: item.label };
  const feature = FEATURES.find((f) => f.href === pathname || f.navHrefs.includes(pathname));
  if (feature) return { title: feature.short ?? feature.label };
  return { title: 'Leosiqra' };
}
