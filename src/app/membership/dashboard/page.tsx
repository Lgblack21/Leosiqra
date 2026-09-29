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
  Banknote
} from 'lucide-react';
import { cn, isIncomingTransaction, formatIDR, formatMoney } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Modal } from '@/components/ui/Modal';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
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

interface MarketTicker {
  label: string; sub: string; val: string; pct: string; up: boolean | null;
  color: string;
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
  const totalInvestasi = useMemo(() => investments.reduce((s, i) => s + (Number(i.amountIDR) || Number(i.amountInvested) || 0), 0), [investments]);
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

  const pemasukanPct = totalPengeluaran > 0 ? Math.min(Math.round((totalPemasukan / Math.max(totalPengeluaran, 1)) * 100), 100) : 100;
  const pengeluaranPct = totalPemasukan > 0 ? Math.min(Math.round((totalPengeluaran / Math.max(totalPemasukan, 1)) * 100), 100) : 0;
  // % porsi Tabungan dari total saldo semua rekening (net worth), bukan lagi
  // relatif ke pemasukan bulanan — konsisten dengan sifat all-time-nya.
  const tabunganPct = totalSaldoRekening > 0 ? Math.min(Math.round((totalTabunganSaldo / totalSaldoRekening) * 100), 100) : 0;
  const investasiPct = totalPemasukan > 0 ? Math.min(Math.round((totalInvestasi / Math.max(totalPemasukan, 1)) * 100), 100) : 0;

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

  return (
    <div className="stagger-in space-y-6 md:space-y-8 max-w-[1400px] pb-10">
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard Bulanan"
        subtitle={`Ringkasan keuanganmu periode ${periodLabel}`}
        actions={
          <MonthPicker
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        }
      />

      <GamificationStrip />

      {/* Baris 1: Saldo (kartu utama) + arus kas bulan ini */}
      <div className="stagger-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <button
          type="button"
          onClick={() => setShowAccountsModal(true)}
          className="sheen md:col-span-2 lg:col-span-1 text-left w-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-card p-5 md:p-6 shadow-xl shadow-emerald-600/15 relative overflow-hidden hover:shadow-2xl hover:shadow-emerald-600/25 hover:-translate-y-0.5 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-label font-bold text-emerald-100 uppercase">Saldo Bersih</p>
            <span className="flex items-center gap-0.5 text-caption font-bold text-emerald-100">
              Lihat rekening <ChevronRight size={14} />
            </span>
          </div>
          {!accountsLoaded ? (
            <div className="h-9 w-2/3 mb-5 rounded-control bg-white/20 animate-pulse" />
          ) : (
            <p className={cn('text-2xl md:text-3xl font-black mb-5 tracking-tight tabular-nums truncate', totalSaldoRekening >= 0 ? 'text-white' : 'text-rose-200')}>
              <AnimatedNumber value={totalSaldoRekening} format={formatRp} />
            </p>
          )}
          <p className="text-caption font-bold text-emerald-100">
            {accounts.length} rekening · {transactions.length} transaksi bulan ini
          </p>
        </button>

        <StatCard
          label="Pemasukan"
          icon={<TrendingUp size={12} className="text-emerald-500" />}
          value={<AnimatedNumber value={totalPemasukan} format={formatRp} />}
          loading={statsLoading}
          badge={<Badge tone={pengeluaranPct <= 80 ? 'info' : 'danger'}>{pengeluaranPct <= 80 ? 'Sehat' : 'Waspada'}</Badge>}
          progress={pemasukanPct}
          progressClassName="bg-emerald-500"
          caption={`${incomeCount} transaksi`}
        />
        <StatCard
          label="Pengeluaran"
          icon={<TrendingDown size={12} className="text-rose-500" />}
          value={<AnimatedNumber value={totalPengeluaran} format={formatRp} />}
          loading={statsLoading}
          badge={<Badge tone={pengeluaranPct > 90 ? 'danger' : 'neutral'}>{pengeluaranPct > 90 ? 'Waspada' : 'Normal'}</Badge>}
          progress={pengeluaranPct}
          progressClassName="bg-rose-500"
          caption={`${pengeluaranPct}% dari pemasukan`}
        />
      </div>

      {/* Baris 2: aset & kewajiban */}
      <div className="stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          label="Tabungan"
          icon={<PiggyBank size={12} className="text-blue-500" />}
          value={<AnimatedNumber value={totalTabunganSaldo} format={formatRp} />}
          loading={statsLoading}
          badge={<Badge tone="info">{savings.length} trx</Badge>}
          progress={tabunganPct}
          progressClassName="bg-blue-500"
          caption={`${tabunganPct}% dari saldo`}
        />
        <StatCard
          label="Investasi"
          icon={<Wallet size={12} className="text-slate-600" />}
          value={<AnimatedNumber value={totalInvestasi} format={formatRp} />}
          loading={statsLoading}
          badge={<Badge tone="info">{investments.filter(i => i.status === 'Active').length} aktif</Badge>}
          progress={investasiPct}
          caption={`${investasiPct}% dari pemasukan`}
        />
        <StatCard
          label="Tagihan Kartu Kredit"
          icon={<CreditCard size={12} className="text-rose-500" />}
          value={<AnimatedNumber value={creditCardBills} format={formatRp} />}
          valueClassName={creditCardBills > 0 ? 'text-rose-500' : undefined}
          loading={statsLoading}
          badge={nearestDue && (nearestDue.cycle.overdue || nearestDue.cycle.daysUntilDue <= 3)
            ? <Badge tone={nearestDue.cycle.overdue ? 'danger' : 'warning'}>{nearestDue.cycle.overdue ? 'Telat' : 'Segera'}</Badge>
            : undefined}
          caption={dueLabel ?? (creditCardBills > 0 ? 'Perlu dibayar' : 'Tidak ada tagihan')}
        />
        <StatCard
          label="Hutang Lainnya"
          icon={<Landmark size={12} className="text-slate-600" />}
          value={<AnimatedNumber value={otherDebts} format={formatRp} />}
          valueClassName={otherDebts > 0 ? 'text-rose-500' : undefined}
          loading={statsLoading}
          caption={otherDebts > 0 ? 'Kewajiban aktif' : 'Bebas hutang'}
        />
      </div>

      {/* Baris 3: pengeluaran tertinggi + pulse pasar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="p-5 md:p-6 lg:col-span-2">
          <CardHeader title="Pengeluaran Tertinggi" icon={<TrendingDown size={12} className="text-rose-500" />} />
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : topExpenses.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topExpenses.map((trx, i) => (
                <div key={trx.id || i} className="rounded-control bg-slate-50 p-3.5 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 text-xs font-black">
                    #{i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption font-medium text-slate-500 truncate">{trx.category}</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{trx.note || trx.category}</p>
                    <p className="text-xs font-black text-rose-500 tabular-nums">{formatRp(toIdrAmount(trx))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expenseCount > 3 && (
            <p className="text-caption text-slate-400 mt-3">dari {expenseCount} transaksi pengeluaran bulan ini</p>
          )}
        </Card>

        <Card className="p-5 md:p-6">
          <CardHeader
            title="Pulse Pasar"
            action={
              <button
                onClick={fetchMarket}
                disabled={marketLoading}
                aria-label="Muat ulang data pasar"
                className="p-1.5 -m-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={14} className={marketLoading ? 'animate-spin' : ''} />
              </button>
            }
          />
          <div className="space-y-4">
            {marketLoading ? (
              [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9" />)
            ) : marketTickers.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-label font-black', m.color)}>
                    {m.label.split('/')[0].slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 leading-none mb-1">{m.label}</p>
                    <p className="text-caption text-slate-400">{m.sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 leading-none mb-1 tabular-nums">{m.val}</p>
                  <p className={cn(
                    'text-caption font-bold tabular-nums',
                    m.up === null ? 'text-slate-300' : m.up ? 'text-emerald-500' : 'text-rose-500'
                  )}>{m.up !== null && (m.up ? '+' : '')}{m.pct}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Daftar transaksi periode ini */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6 flex flex-col gap-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Transaksi Bulan Ini</h2>
              <p className="text-caption text-slate-400">Semua nominal dalam IDR</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kategori atau catatan..."
                aria-label="Cari transaksi"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-control text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
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
          <div className="p-5 md:p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : visibleData.length === 0 ? (
          <div className="p-5 md:p-8">
            {searchQuery || filterType !== 'Semua' ? (
              <EmptyState title="Tidak ada yang cocok" description="Coba ganti filter atau kata kunci pencarian." icon={<Search size={24} />} />
            ) : (
              <EmptyState title="Belum ada transaksi" description="Catat pemasukan atau pengeluaran pertama lewat tombol Tambah Cepat di pojok kanan atas." icon={<LayoutDashboard size={24} />} />
            )}
          </div>
        ) : (
          <>
            {/* Mobile: list */}
            <ul className="md:hidden divide-y divide-slate-100">
              {visibleData.map((trx, i) => {
                const incoming = isIncomingTransaction(trx);
                return (
                  <li key={trx.id || i} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{trx.note || trx.category}</p>
                      <p className="text-caption text-slate-400 truncate">{formatDate(trx.date)} · {trx.category}</p>
                    </div>
                    <p className={cn('text-sm font-black tabular-nums whitespace-nowrap', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                      {incoming ? '+' : '−'}{formatRp(toIdrAmount(trx))}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: tabel */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/70">
                    <th className="px-6 py-3 text-label font-bold uppercase text-slate-400">Tanggal</th>
                    <th className="px-6 py-3 text-label font-bold uppercase text-slate-400">Kategori / Catatan</th>
                    <th className="px-6 py-3 text-label font-bold uppercase text-slate-400 text-center">Tipe</th>
                    <th className="px-6 py-3 text-label font-bold uppercase text-slate-400 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleData.map((trx, i) => {
                    const incoming = isIncomingTransaction(trx);
                    return (
                      <tr key={trx.id || i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900">{formatDate(trx.date)}</td>
                        <td className="px-6 py-3.5 text-slate-700 max-w-[420px] truncate">
                          <span className="font-bold">{trx.category}</span>
                          {trx.note && <span className="text-slate-400"> — {trx.note}</span>}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <Badge tone={incoming ? 'success' : 'danger'} className="capitalize">{trx.type}</Badge>
                        </td>
                        <td className={cn('px-6 py-3.5 text-right font-black tabular-nums', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                          {incoming ? '+' : '−'}{formatRp(toIdrAmount(trx))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Ringkasan — dihitung dari baris yang sedang tampil */}
            <div className="bg-slate-900 text-white px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-label font-bold uppercase text-slate-400">
                {footerLabel} · {visibleData.length} transaksi
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-black tabular-nums">
                <span className="text-emerald-400">Masuk +{formatRp(footerTotals.masuk)}</span>
                <span className="text-rose-300">Keluar −{formatRp(footerTotals.keluar)}</span>
                <span className={footerTotals.net < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Net {footerTotals.net >= 0 ? '+' : ''}{formatRp(footerTotals.net)}
                </span>
              </div>
            </div>
          </>
        )}
      </Card>

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
                className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-control border border-slate-100"
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
