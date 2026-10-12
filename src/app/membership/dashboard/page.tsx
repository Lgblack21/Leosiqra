"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  TrendingUp,
  Wallet,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Landmark,
  Search,
  ChevronRight,
  LayoutDashboard,
  RefreshCw,
  Building2,
  Banknote,
  Plus,
  ArrowLeftRight,
  Zap,
  Target,
  Flame,
  Sparkles,
  ArrowUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, isIncomingTransaction, formatIDR, formatMoney } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Modal } from '@/components/ui/Modal';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LogoImage } from '@/components/ui/LogoImage';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { accountService, Account } from '@/lib/services/accountService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { isCreditAccountType, computeCreditUsage, getCardCycle } from '@/lib/creditCard';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { GamificationStrip } from '@/components/GamificationStrip';
import { WeeklyInsights } from '@/components/WeeklyInsights';
import { SecurityNudge } from '@/components/SecurityNudge';
import { AuthScene, Greeting } from '@/components/auth/AuthScene';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { useModal } from '@/context/ModalContext';
import { budgetService, type Budget } from '@/lib/services/budgetService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { CloseDayCard } from '@/components/streak/CloseDay';
import { FeatureTiles, type TileStat } from '@/components/features/FeatureTiles';
import { useFeatures, type FeatureId } from '@/lib/features';

interface MarketTicker {
  label: string; sub: string; val: string; pct: string; up: boolean | null;
  color: string;
}

// Beli investasi tersimpan sebagai "pengeluaran" tapi bukan biaya hidup —
// aturan yang sama dengan insight mingguan & laporan bulanan di Worker.
const isInvestmentCategory = (category?: string) =>
  Boolean(category) && (/investasi/i.test(category!) || category === 'Saham' || category === 'Deposito');

const TILE_TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
} as const;

// Kotak statistik dashboard: ikon berwarna, label biasa (bukan kapital
// renggang), angka besar, keterangan kecil, progress opsional.
function Tile({ label, icon, tone, value, valueClassName, caption, badge, progress, progressClassName, loading }: {
  label: string;
  icon: React.ReactNode;
  tone: keyof typeof TILE_TONES;
  value: React.ReactNode;
  valueClassName?: string;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  progress?: number;
  progressClassName?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[24px] border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl', TILE_TONES[tone])}>{icon}</span>
          <span className="truncate text-[13px] sm:text-sm font-semibold text-slate-500">{label}</span>
        </div>
        {badge && <span className="hidden sm:block">{badge}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : (
        <p className={cn('truncate text-lg sm:text-[22px] font-extrabold tracking-tight text-slate-900 tabular-nums', valueClassName)}>{value}</p>
      )}
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full transition-all duration-700', progressClassName ?? 'bg-slate-700')} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {caption && <p className="mt-2 text-xs font-medium text-slate-400">{caption}</p>}
    </div>
  );
}

const FILTER_OPTIONS = ['Semua', 'Pemasukan', 'Pengeluaran', 'Investasi', 'Tabungan'] as const;
type FilterType = typeof FILTER_OPTIONS[number];

export default function MonthlyDashboard() {
  const [filterType, setFilterType] = useState<FilterType>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Semua transaksi (tanpa filter bulan) — dipakai siklus tagihan kartu
  // kredit, yang tanggal cetaknya bisa jatuh di bulan sebelumnya.
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketTickers, setMarketTickers] = useState<MarketTicker[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Catatan Hutang "Kartu Kredit" yang belum lunas — dipakai untuk tagihan
  // kartu yang dicatat cara lama (tanpa rekening kartu kredit).
  const [unpaidCardDebts, setUnpaidCardDebts] = useState<Transaction[]>([]);
  const [otherDebts, setOtherDebts] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  // Saldo Bersih = total saldo semua rekening saat ini, tidak terikat bulan
  // yang dipilih di MonthPicker (sama seperti "Total Saldo" di Profile).
  useEffect(() => {
    const loadAccounts = () => accountService.getUserAccounts('session').then(setAccounts).catch(console.error).finally(() => setAccountsLoaded(true));
    loadAccounts();
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
    // getUserAccounts cuma fetch sekali, bukan live subscription — refetch
    // manual tiap ada tambah/edit/hapus rekening di mana pun (modal, halaman
    // lain) supaya nggak perlu reload manual.
    return subscribeToCollectionChanges('accounts', loadAccounts);
  }, []);

  useEffect(() => {
    let active = true;
    const loadTransactionsAndInvestments = () => {
      setLoading(true);
      Promise.all([
        transactionService.getUserTransactions('session'),
        investmentService.getUserInvestments('session'),
        savingsService.getUserSavings('session'),
      ])
        .then(([allTransactions, allInvestments, allSavings]) => {
          if (!active) return;
          const periodTransactions = allTransactions.filter((t) => {
            const d = new Date(t.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
          });
          setTransactions(periodTransactions);
          setAllTransactions(allTransactions);
          setInvestments(allInvestments);
          setSavings(allSavings);

          // Ringkasan hutang dihitung otomatis dari catatan Hutang yang belum lunas
          // (jenisnya disimpan di subCategory oleh DebtModal): Kartu Kredit vs lainnya.
          const unpaidDebts = allTransactions.filter(
            (t) => t.type === 'debt' && t.category === 'Hutang' && t.paymentStatus !== 'lunas'
          );
          const sumIDR = (list: typeof unpaidDebts) =>
            list.reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
          setUnpaidCardDebts(unpaidDebts.filter((t) => t.subCategory === 'Kartu Kredit'));
          setOtherDebts(sumIDR(unpaidDebts.filter((t) => t.subCategory !== 'Kartu Kredit')));
        })
        .catch((err) => {
          console.error('Gagal memuat dashboard member:', err);
          if (!active) return;
          setTransactions([]);
          setInvestments([]);
          setSavings([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    loadTransactionsAndInvestments();
    // getUserTransactions/getUserInvestments/getUserSavings cuma fetch sekali —
    // refetch manual tiap ada input/hapus transaksi, investasi, atau tabungan
    // di mana pun.
    const unsubTrx = subscribeToCollectionChanges('transactions', loadTransactionsAndInvestments);
    const unsubInv = subscribeToCollectionChanges('investments', loadTransactionsAndInvestments);
    const unsubSav = subscribeToCollectionChanges('savings', loadTransactionsAndInvestments);
    return () => {
      active = false;
      unsubTrx();
      unsubInv();
      unsubSav();
    };
  }, [selectedMonth, selectedYear]);

  const fetchMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const [cryptoRes, fxRes] = await Promise.all([
        fetch('/api/market/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'),
        fetch('https://open.er-api.com/v6/latest/USD')
      ]);
      const crypto = cryptoRes.ok ? await cryptoRes.json() : null;
      const fx = fxRes.ok ? await fxRes.json() : null;
      const tickers: MarketTicker[] = [
        { label: 'BTC/USD', sub: 'Bitcoin', val: crypto ? `$${Number(crypto.bitcoin?.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', pct: crypto ? `${Number(crypto.bitcoin?.usd_24h_change).toFixed(2)}%` : '-', up: crypto ? crypto.bitcoin?.usd_24h_change >= 0 : null, color: 'bg-amber-100 text-amber-600' },
        { label: 'ETH/USD', sub: 'Ethereum', val: crypto ? `$${Number(crypto.ethereum?.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', pct: crypto ? `${Number(crypto.ethereum?.usd_24h_change).toFixed(2)}%` : '-', up: crypto ? crypto.ethereum?.usd_24h_change >= 0 : null, color: 'bg-slate-100 text-slate-600' },
        { label: 'USD/IDR', sub: 'Rupiah', val: fx ? `Rp${Number(fx.rates?.IDR).toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : '-', pct: '-', up: null, color: 'bg-emerald-100 text-emerald-600' },
        { label: 'EUR/USD', sub: 'Euro', val: fx ? `$${(1 / Number(fx.rates?.EUR)).toFixed(4)}` : '-', pct: '-', up: null, color: 'bg-blue-100 text-blue-600' },
      ];
      setMarketTickers(tickers);
    } catch (e) { console.error(e); }
    finally { setMarketLoading(false); }
  }, []);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  const filteredData = useMemo(() => {
    // Catatan Hutang/Piutang (type "debt") bukan arus kas — kalau ikut
    // ditampilkan di sini bareng transaksi asli, kelihatan seperti transaksi
    // dobel untuk pembelian yang sama (lihat fix yang sama di Transaksi
    // Harian). Tidak ada tab filter khusus "Hutang" di halaman ini, jadi
    // kalau tidak dikecualikan dari "Semua" ia cuma numpang lewat tanpa
    // tempat yang benar.
    if (filterType === 'Semua') return transactions.filter(t => t.type !== 'debt');
    if (filterType === 'Pemasukan') return transactions.filter((t) => t.type === 'pemasukan');
    if (filterType === 'Pengeluaran') return transactions.filter((t) => t.type === 'pengeluaran');
    if (filterType === 'Investasi') {
      return transactions.filter((t) =>
        t.type === 'investasi' || /investasi|saham|deposito/i.test(t.category || '')
      );
    }
    if (filterType === 'Tabungan') {
      return transactions.filter((t) =>
        t.type === 'tabungan' || /tabungan|dana darurat/i.test(t.category || '')
      );
    }
    return transactions;
  }, [transactions, filterType]);

  // Halaman ini ditandai "(Dalam IDR)" — jadi setiap nominal harus pakai
  // amountIDR (sudah dikonversi saat transaksi disimpan), bukan .amount
  // mentah yang masih dalam mata uang asli transaksi itu.
  const toIdrAmount = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;
  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + toIdrAmount(t), 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + toIdrAmount(t), 0), [transactions]);
  const netBalance = totalPemasukan - totalPengeluaran;
  // Saldo Tabungan kartu dashboard bersifat all-time (sama seperti Investasi
  // di sebelahnya) — bukan sisa pemasukan-pengeluaran bulan berjalan, supaya
  // benar-benar merefleksikan total setoran aktif di fitur Tabungan.
  const totalTabunganSaldo = useMemo(() => savings.reduce((s, item) => {
    const amt = Number(item.amountIDR) || item.amount;
    return item.transactionType === 'Penarikan' ? s - amt : s + amt;
  }, 0), [savings]);
  const totalSaldoRekening = useMemo(
    () => accounts.reduce((s, a) => s + exchangeRateService.convert(a.balance || 0, a.currency || 'IDR', 'IDR', fxRates), 0),
    [accounts, fxRates]
  );

  const formatRp = formatIDR;

  // Tagihan Kartu Kredit = total terpakai semua rekening kartu kredit (dari
  // saldonya, lihat lib/creditCard.ts) + catatan Hutang "Kartu Kredit" yang
  // belum lunas dan TIDAK menempel ke rekening kartu kredit. Catatan yang
  // menempel ke rekening kartu dilewati supaya tidak terhitung dobel.
  const creditCardBills = useMemo(() => {
    const creditAccounts = accounts.filter((a) => isCreditAccountType(a.type));
    const creditIds = new Set(creditAccounts.map((a) => a.id));
    const cardsUsed = creditAccounts.reduce(
      (s, a) => s + exchangeRateService.convert(computeCreditUsage(a).used, a.currency || 'IDR', 'IDR', fxRates),
      0
    );
    const legacyDebts = unpaidCardDebts
      .filter((t) => !t.accountId || !creditIds.has(t.accountId))
      .reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
    return cardsUsed + legacyDebts;
  }, [accounts, fxRates, unpaidCardDebts]);

  // Jatuh tempo terdekat di antara kartu yang siklusnya diatur & masih punya
  // tagihan periode tercetak.
  const nearestDue = useMemo(() => {
    const cycles = accounts
      .filter((a) => isCreditAccountType(a.type))
      .map((a) => ({ account: a, cycle: getCardCycle(a, allTransactions) }))
      .filter((x): x is { account: Account; cycle: NonNullable<typeof x.cycle> } => Boolean(x.cycle && x.cycle.amountDue > 0));
    cycles.sort((a, b) => a.cycle.daysUntilDue - b.cycle.daysUntilDue);
    return cycles[0] ?? null;
  }, [accounts, allTransactions]);
  const dueLabel = (() => {
    if (!nearestDue) return null;
    const { cycle, account } = nearestDue;
    const [y, m, d] = cycle.dueDate.split('-').map(Number);
    const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
    if (cycle.overdue) return `${account.name}: lewat jatuh tempo ${Math.abs(cycle.daysUntilDue)} hari (${date})`;
    if (cycle.daysUntilDue === 0) return `${account.name}: jatuh tempo hari ini`;
    return `${account.name}: jatuh tempo ${date} · ${cycle.daysUntilDue} hari lagi`;
  })();

  const visibleData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredData;
    return filteredData.filter((t) =>
      `${t.category || ''} ${t.subCategory || ''} ${t.note || ''}`.toLowerCase().includes(q)
    );
  }, [filteredData, searchQuery]);

  // Tab "Semua" tanpa pencarian tetap pakai total resmi (pemasukan vs
  // pengeluaran murni, transfer tidak dihitung). Selain itu, total dihitung
  // dari baris yang sedang tampil — sebelumnya footer selalu menampilkan
  // total pemasukan seluruh bulan meskipun filternya "Pengeluaran".
  const footerTotals = useMemo(() => {
    if (filterType === 'Semua' && !searchQuery.trim()) {
      return { masuk: totalPemasukan, keluar: totalPengeluaran, net: netBalance };
    }
    const masuk = visibleData.filter(isIncomingTransaction).reduce((s, t) => s + toIdrAmount(t), 0);
    const keluar = visibleData.filter((t) => !isIncomingTransaction(t)).reduce((s, t) => s + toIdrAmount(t), 0);
    return { masuk, keluar, net: masuk - keluar };
  }, [filterType, searchQuery, visibleData, totalPemasukan, totalPengeluaran, netBalance]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return <Building2 size={18} className="text-white" />;
      case 'E-Wallet': return <Wallet size={18} className="text-white" />;
      case 'Cash': return <Banknote size={18} className="text-white" />;
      case 'Investment Account': return <Landmark size={18} className="text-white" />;
      case 'Credit Card': return <CreditCard size={18} className="text-white" />;
      default: return <Building2 size={18} className="text-white" />;
    }
  };

  const getBgForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return 'bg-blue-600';
      case 'E-Wallet': return 'bg-indigo-600';
      case 'Cash': return 'bg-emerald-500';
      case 'Investment Account': return 'bg-slate-900';
      case 'Credit Card': return 'bg-rose-500';
      default: return 'bg-blue-500';
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d);

  const footerLabel = filterType === 'Semua' ? 'Total Keseluruhan' : `Total ${filterType}`;

  const pengeluaranPct = totalPemasukan > 0 ? Math.min(Math.round((totalPengeluaran / Math.max(totalPemasukan, 1)) * 100), 100) : 0;

  const expenseCount = transactions.filter(t => t.type === 'pengeluaran').length;
  const incomeCount = transactions.filter(t => t.type === 'pemasukan').length;
  const topExpenses = transactions
    .filter(t => t.type === 'pengeluaran')
    .sort((a, b) => toIdrAmount(b) - toIdrAmount(a))
    .slice(0, 3);
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth));
  // Skeleton cuma di load pertama per periode — refetch realtime (tiap ada
  // transaksi baru) jangan bikin angka yang sudah tampil kedip jadi skeleton.
  const statsLoading = loading && transactions.length === 0;

  // ===== Tambahan tampilan (baca saja — tidak ada tulis data) =====
  const { openModal } = useModal();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    const load = () => budgetService.getUserBudgets('session').then(setBudgets).catch(() => setBudgets([]));
    load();
    return subscribeToCollectionChanges('budgets', load);
  }, []);

  useEffect(() => {
    cloudflareApi<{ user?: { name?: string } | null }>('/api/auth/me')
      .then((r) => setFirstName(r.user?.name?.trim().split(/\s+/)[0] ?? ''))
      .catch(() => {});
  }, []);

  const now = new Date();
  const isCurrentPeriod = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isToday = (d: Date) =>
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const todayTrx = allTransactions.filter((t) => t.type !== 'debt' && isToday(new Date(t.date)));
  const todayOut = todayTrx.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + toIdrAmount(t), 0);

  // Laju pengeluaran: biaya hidup bulan ini (tanpa beli investasi) dibanding
  // budget pengeluaran bulanan (budget tahunan dibagi 12). Tanpa budget,
  // pembandingnya pemasukan bulan ini. Penanda "hari ini" = porsi bulan yang
  // sudah lewat — kalau bar melewati penanda, berarti belanja lebih cepat dari jadwal.
  const paceSpent = transactions
    .filter((t) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category))
    .reduce((s, t) => s + toIdrAmount(t), 0);
  const budgetTotal = budgets
    .filter((b) => b.type === 'pengeluaran')
    .reduce((s, b) => s + (b.period === 'yearly' ? (Number(b.amount) || 0) / 12 : Number(b.amount) || 0), 0);
  const paceSource: 'budget' | 'pemasukan' | null = budgetTotal > 0 ? 'budget' : totalPemasukan > 0 ? 'pemasukan' : null;
  const paceCap = paceSource === 'budget' ? budgetTotal : totalPemasukan;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dayFrac = isCurrentPeriod ? now.getDate() / daysInMonth : 1;
  const usedFrac = paceCap > 0 ? paceSpent / paceCap : 0;
  const paceStatus: 'over' | 'fast' | 'ok' = usedFrac > 1 ? 'over' : usedFrac > dayFrac + 0.1 ? 'fast' : 'ok';
  const dailySpend = Array.from({ length: daysInMonth }, () => 0);
  for (const t of transactions) {
    if (t.type !== 'pengeluaran' || isInvestmentCategory(t.category)) continue;
    const day = new Date(t.date).getDate();
    if (day >= 1 && day <= daysInMonth) dailySpend[day - 1] += toIdrAmount(t);
  }
  const dailyMax = Math.max(1, ...dailySpend);
  const daysLeft = isCurrentPeriod ? daysInMonth - now.getDate() + 1 : 0;
  const perDayLeft = daysLeft > 0 ? Math.max(0, paceCap - paceSpent) / daysLeft : 0;

  // Komentar Leo di kartu sapaan.
  const leo: { mood: LeoMood; text: string } = !isCurrentPeriod
    ? { mood: 'idle', text: `Lagi lihat ringkasan ${periodLabel} ya.` }
    : paceSource && paceStatus === 'over'
      ? { mood: 'sad', text: `Pengeluaran bulan ini udah lewat ${paceSource === 'budget' ? 'budget' : 'pemasukan'}. Rem dikit ya 🙏` }
      : todayTrx.length === 0
        ? { mood: 'idle', text: 'Belum ada catatan hari ini. Yuk catat, cuma 5 detik!' }
        : paceSource && paceStatus === 'fast'
          ? { mood: 'idle', text: `Belanja agak ngebut nih, masih ${daysLeft} hari lagi 👀` }
          : { mood: 'idle', text: `Mantap! ${todayTrx.length} catatan hari ini, keuanganmu on track ✨` };

  const router = useRouter();
  const [ask, setAsk] = useState('');
  const { isOn } = useFeatures();

  // Angka untuk kotak "Fitur kamu" — aturan sama dengan halaman Kekayaan.
  const unpaidDebtRows = allTransactions.filter((t) => t.type === 'debt' && t.paymentStatus !== 'lunas');
  const piutang = unpaidDebtRows.filter((t) => t.category === 'Piutang').reduce((s, t) => s + toIdrAmount(t), 0);
  const rekeningAset = accounts
    .filter((a) => !isCreditAccountType(a.type))
    .reduce((s, a) => s + exchangeRateService.convert(a.balance || 0, a.currency || 'IDR', 'IDR', fxRates), 0);
  const investasiNilai = investments
    .filter((i) => i.status === 'Active')
    .reduce((s, i) => s + (Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0), 0);
  const kekayaanBersih = rekeningAset + totalTabunganSaldo + investasiNilai + piutang - creditCardBills - otherDebts;
  const featureBase: Partial<Record<FeatureId, TileStat>> = {
    kekayaan: { value: formatRp(kekayaanBersih), sub: 'Kekayaan bersih' },
    tabungan: { value: formatRp(totalTabunganSaldo), sub: `${savings.length} catatan setoran` },
    investasi: { value: formatRp(investasiNilai), sub: `${investments.filter((i) => i.status === 'Active').length} aktif` },
    kartu: { value: formatRp(creditCardBills), sub: dueLabel ?? (creditCardBills > 0 ? 'Tagihan terpakai' : 'Tidak ada tagihan') },
    hutang: { value: formatRp(otherDebts), sub: piutang > 0 ? `Piutang ${formatRp(piutang)}` : otherDebts > 0 ? 'Belum lunas' : 'Bebas hutang 🎉' },
  };

  const quickActions: { label: string; icon: React.ReactNode; onClick?: () => void; href?: string; primary?: boolean }[] = [
    { label: 'Catat transaksi', icon: <Plus size={16} strokeWidth={2.6} />, onClick: () => openModal('harian'), primary: true },
    { label: 'Transfer', icon: <ArrowLeftRight size={16} />, onClick: () => openModal('topup_transfer') },
    { label: 'Tabungan', icon: <PiggyBank size={16} />, onClick: () => openModal('tabungan') },
    { label: 'Input cepat', icon: <Zap size={16} />, href: '/input-cepat' },
  ];

  return (
    <div className="space-y-6 md:space-y-7 max-w-[1400px] pb-10">
      {/* ===== Kartu sapaan: langit sesuai jam + Leo ===== */}
      <AuthScene className="auth-hero rounded-[28px] shadow-xl shadow-indigo-950/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/40 via-slate-950/15 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-6 p-6 text-white md:flex-row md:items-end md:justify-between md:p-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/85">
              <Greeting />{firstName ? `, ${firstName}` : ''} 👋
            </p>
            <button
              type="button"
              onClick={() => setShowAccountsModal(true)}
              className="group mt-3 block text-left focus-visible:outline-none"
            >
              <span className="flex items-center gap-1 text-[13px] font-semibold text-white/75">
                Saldo bersih <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
              {!accountsLoaded ? (
                <span className="mt-1 block h-11 w-56 animate-pulse rounded-2xl bg-white/20" />
              ) : (
                <span className={cn('mt-0.5 block truncate text-[34px] font-extrabold leading-tight tracking-tight tabular-nums drop-shadow-sm md:text-[42px]', totalSaldoRekening < 0 && 'text-rose-200')}>
                  <AnimatedNumber value={totalSaldoRekening} format={formatRp} />
                </span>
              )}
              <span className="mt-1 block text-xs font-medium text-white/70">{accounts.length} rekening · ketuk untuk rincian</span>
            </button>

            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2 text-[13px] font-semibold ring-1 ring-white/20 backdrop-blur-md">
              <Flame size={15} className="text-amber-300" />
              Hari ini keluar <span className="tabular-nums font-extrabold">{formatRp(todayOut)}</span>
              <span className="text-white/60">· {todayTrx.length} catatan</span>
            </div>

            {/* Tanya Leo — dikirim ke AI Leosiqra */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = ask.trim();
                if (q) router.push(`/membership/ai-leosiqra?q=${encodeURIComponent(q)}`);
              }}
              className="mt-5 flex max-w-md items-center gap-2 rounded-2xl bg-white/95 py-1.5 pl-4 pr-1.5 shadow-lg shadow-indigo-950/20"
            >
              <Sparkles size={16} className="shrink-0 text-violet-500" />
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Tanya Leo apa saja… mis. minggu ini habis berapa?"
                aria-label="Tanya Leo"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Kirim pertanyaan" disabled={!ask.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40">
                <ArrowUp size={16} />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickActions.map((a) => {
                const cls = cn(
                  'inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98]',
                  a.primary
                    ? 'bg-white text-indigo-700 shadow-lg shadow-indigo-950/20'
                    : 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25'
                );
                return a.href ? (
                  <Link key={a.label} href={a.href} className={cls}>{a.icon}{a.label}</Link>
                ) : (
                  <button key={a.label} type="button" onClick={a.onClick} className={cls}>{a.icon}{a.label}</button>
                );
              })}
            </div>
          </div>

          {/* Leo + gelembung komentar */}
          <div className="flex items-end gap-2 self-end md:self-auto">
            <div className="relative mb-16 max-w-[220px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-[13px] font-semibold leading-snug text-slate-700 shadow-lg">
              {leo.text}
            </div>
            <LeoMascot mood={leo.mood} size={124} interactive className="shrink-0" />
          </div>
        </div>
      </AuthScene>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {isOn('streak') && <CloseDayCard transactions={allTransactions} accounts={accounts} className="lg:col-span-1 lg:self-start" />}
        <FeatureTiles base={featureBase} className={isOn('streak') ? 'lg:col-span-2' : 'lg:col-span-3'} />
      </div>

      <GamificationStrip />

      <SecurityNudge />

      <WeeklyInsights target="web" />

      {/* ===== Ringkasan periode ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Ringkasan {periodLabel}</h2>
          <p className="text-sm text-slate-500">Semua nominal dalam rupiah</p>
        </div>
        <MonthPicker
          value={{ month: selectedMonth, year: selectedYear }}
          onChange={({ month, year }) => {
            setSelectedMonth(month);
            setSelectedYear(year);
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-5">
        {/* Laju pengeluaran */}
        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Target size={17} /></span>
              <span className="text-sm font-semibold text-slate-500">Laju pengeluaran</span>
            </div>
            {paceSource && (
              <span className={cn(
                'rounded-full px-3 py-1 text-xs font-bold',
                paceStatus === 'over' ? 'bg-rose-50 text-rose-600' : paceStatus === 'fast' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              )}>
                {paceStatus === 'over' ? 'Lewat batas' : paceStatus === 'fast' ? 'Agak cepat' : 'Aman'}
              </span>
            )}
          </div>

          {statsLoading ? (
            <Skeleton className="mt-5 h-20" />
          ) : paceSource ? (
            <>
              <p className="mt-4 text-[22px] font-extrabold tracking-tight text-slate-900 tabular-nums">
                {formatRp(paceSpent)} <span className="text-base font-semibold text-slate-400">dari {formatRp(paceCap)}</span>
              </p>
              <p className="text-xs font-medium text-slate-400">
                Dibanding {paceSource === 'budget' ? 'budget pengeluaran bulanan' : 'pemasukan bulan ini (belum ada budget)'} · tanpa pembelian investasi
              </p>
              <div className="relative mt-5 h-3 rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', paceStatus === 'over' ? 'bg-rose-500' : paceStatus === 'fast' ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500')}
                  style={{ width: `${Math.min(100, usedFrac * 100)}%` }}
                />
                {isCurrentPeriod && (
                  <div className="absolute -top-1.5 h-6 w-0.5 rounded-full bg-slate-800" style={{ left: `${dayFrac * 100}%` }}>
                    <span className="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-slate-500">hari ini</span>
                  </div>
                )}
              </div>
              <p className="mt-8 text-sm text-slate-600">
                {!isCurrentPeriod
                  ? `Terpakai ${Math.round(usedFrac * 100)}% di ${periodLabel}.`
                  : paceStatus === 'over'
                    ? `Sudah lewat ${formatRp(paceSpent - paceCap)}. Coba tahan belanja yang nggak mendesak sampai akhir bulan.`
                    : `Sisa ${formatRp(paceCap - paceSpent)} untuk ${daysLeft} hari — kira-kira ${formatRp(perDayLeft)} per hari.`}
              </p>
              {/* Pengeluaran per hari bulan ini */}
              <div className="mt-5">
                <div className="flex h-16 items-end gap-[3px]" aria-hidden>
                  {dailySpend.map((v, i) => {
                    const future = isCurrentPeriod && i + 1 > now.getDate();
                    const today = isCurrentPeriod && i + 1 === now.getDate();
                    return (
                      <div
                        key={i}
                        title={`${i + 1} ${periodLabel}: ${formatRp(v)}`}
                        className={cn(
                          'flex-1 rounded-t-[4px] transition-all duration-500',
                          future ? 'bg-slate-100' : today ? 'bg-violet-500' : v > 0 ? 'bg-indigo-300' : 'bg-slate-100'
                        )}
                        style={{ height: future || v === 0 ? '6%' : `${Math.max(8, (v / dailyMax) * 100)}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400">
                  <span>1</span>
                  <span>Pengeluaran per hari</span>
                  <span>{daysInMonth}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Atur budget bulanan biar Leo bisa ngingetin kalau belanjamu mulai ngebut.</p>
              <button type="button" onClick={() => openModal('budget_target')} className="shrink-0 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
                Atur budget
              </button>
            </div>
          )}
        </div>

        {/* Pemasukan & pengeluaran */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:col-span-2 lg:grid-cols-1">
          <Tile
            label="Pemasukan"
            tone="emerald"
            icon={<TrendingUp size={17} />}
            value={<AnimatedNumber value={totalPemasukan} format={formatRp} />}
            loading={statsLoading}
            caption={`${incomeCount} transaksi`}
          />
          <Tile
            label="Pengeluaran"
            tone="rose"
            icon={<TrendingDown size={17} />}
            value={<AnimatedNumber value={totalPengeluaran} format={formatRp} />}
            loading={statsLoading}
            badge={<Badge tone={pengeluaranPct > 90 ? 'danger' : 'neutral'}>{pengeluaranPct > 90 ? 'Waspada' : 'Normal'}</Badge>}
            progress={pengeluaranPct}
            progressClassName="bg-rose-500"
            caption={`${pengeluaranPct}% dari pemasukan · ${expenseCount} transaksi`}
          />
        </div>
      </div>

      {/* Pengeluaran terbesar + pasar */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Sparkles size={17} /></span>
            <span className="text-sm font-semibold text-slate-500">Pengeluaran terbesar bulan ini</span>
          </div>
          {statsLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : topExpenses.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {topExpenses.map((trx, i) => (
                <div key={trx.id || i} className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-extrabold text-rose-500 shadow-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{trx.note || trx.category}</p>
                    <p className="truncate text-xs text-slate-400">{trx.category}</p>
                    <p className="text-sm font-extrabold text-rose-500 tabular-nums">{formatRp(toIdrAmount(trx))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expenseCount > 3 && (
            <p className="mt-3 text-xs text-slate-400">dari {expenseCount} transaksi pengeluaran bulan ini</p>
          )}
        </div>

        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Pasar hari ini</span>
            <button
              onClick={fetchMarket}
              disabled={marketLoading}
              aria-label="Muat ulang data pasar"
              className="-m-1.5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <RefreshCw size={14} className={marketLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-3.5">
            {marketLoading ? (
              [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9" />)
            ) : marketTickers.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold', m.color)}>
                    {m.label.split('/')[0].slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-none text-slate-900">{m.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{m.sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold leading-none text-slate-900 tabular-nums">{m.val}</p>
                  <p className={cn(
                    'mt-1 text-xs font-bold tabular-nums',
                    m.up === null ? 'text-slate-300' : m.up ? 'text-emerald-500' : 'text-rose-500'
                  )}>{m.up !== null && (m.up ? '+' : '')}{m.pct}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daftar transaksi periode ini */}
      <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Transaksi bulan ini</h2>
              <p className="text-xs text-slate-400">{visibleData.length} transaksi tampil</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kategori atau catatan..."
                aria-label="Cari transaksi"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
          </div>
          <SegmentedControl
            ariaLabel="Filter jenis transaksi"
            options={FILTER_OPTIONS}
            value={filterType}
            onChange={setFilterType}
            className="self-start max-w-full"
          />
        </div>

        {loading && transactions.length === 0 ? (
          <div className="space-y-3 p-5 md:p-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : visibleData.length === 0 ? (
          <div className="p-5 md:p-8">
            {searchQuery || filterType !== 'Semua' ? (
              <EmptyState title="Tidak ada yang cocok" description="Coba ganti filter atau kata kunci pencarian." icon={<Search size={24} />} />
            ) : (
              <EmptyState title="Belum ada transaksi" description="Catat pemasukan atau pengeluaran pertama lewat tombol Catat transaksi di atas." icon={<LayoutDashboard size={24} />} />
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {visibleData.map((trx, i) => {
                const incoming = isIncomingTransaction(trx);
                return (
                  <li key={trx.id || i} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 md:px-6">
                    <span className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                      incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                    )}>
                      {incoming ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{trx.note || trx.category}</p>
                      <p className="truncate text-xs text-slate-400">{formatDate(trx.date)} · {trx.category}{trx.subCategory ? ` · ${trx.subCategory}` : ''}</p>
                    </div>
                    <p className={cn('whitespace-nowrap text-sm font-extrabold tabular-nums', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                      {incoming ? '+' : '−'}{formatRp(toIdrAmount(trx))}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Ringkasan — dihitung dari baris yang sedang tampil */}
            <div className="flex flex-col justify-between gap-2 bg-indigo-50/70 px-5 py-4 sm:flex-row sm:items-center md:px-6">
              <p className="text-sm font-bold text-indigo-900">
                {footerLabel} · {visibleData.length} transaksi
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-extrabold tabular-nums">
                <span className="text-emerald-600">Masuk +{formatRp(footerTotals.masuk)}</span>
                <span className="text-rose-500">Keluar −{formatRp(footerTotals.keluar)}</span>
                <span className={footerTotals.net < 0 ? 'text-rose-600' : 'text-indigo-700'}>
                  Bersih {footerTotals.net >= 0 ? '+' : ''}{formatRp(footerTotals.net)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
        title="Rincian Rekening"
        maxWidth="max-w-lg"
      >
        <div className="space-y-2.5">
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Belum ada rekening</p>
          ) : accounts.map((acc) => {
            const isCredit = isCreditAccountType(acc.type);
            const credit = isCredit ? computeCreditUsage(acc, transactions) : null;
            const displayAmount = isCredit && credit ? credit.remaining : (acc.balance || 0);
            const idrValue = exchangeRateService.convert(displayAmount, acc.currency || 'IDR', 'IDR', fxRates);
            return (
              <div
                key={acc.id}
                className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
                  <LogoImage
                    src={acc.logoUrl}
                    alt={acc.name}
                    fallbackText={acc.name.substring(0, 3).toUpperCase()}
                    fallbackIcon={(
                      <div className={`w-full h-full flex items-center justify-center ${getBgForType(acc.type)}`}>
                        {getIconForType(acc.type)}
                      </div>
                    )}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{acc.name}</p>
                  <p className="text-caption text-slate-400 truncate">
                    {isCredit ? 'Sisa Limit' : acc.type}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900 whitespace-nowrap tabular-nums">{formatMoney(displayAmount, acc.currency)}</p>
                  {acc.currency && acc.currency !== 'IDR' && (
                    <p className="text-caption text-slate-400 whitespace-nowrap tabular-nums">≈ {formatRp(idrValue)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
