"use client";

import { useState, useEffect, useMemo } from 'react';
import { InboxBanner } from '@/components/inbox/InboxBanner';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  FileCheck,
  Globe,
  HandCoins,
  Landmark,
  Mic,
  PiggyBank,
  Plus,
  ScanLine,
  Send,
  Sparkles,
  Wallet,
  CalendarRange,
  Building2,
  Banknote,
} from 'lucide-react';
import { cn, formatIDR, formatMoney, isIncomingTransaction } from '@/lib/utils';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { LogoImage } from '@/components/ui/LogoImage';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useLeoPrefs } from '@/lib/useLeoPrefs';
import { currentSeason, SEASON_INFO } from '@/lib/season';
import { useModal } from '@/context/ModalContext';
import { openSettings } from '@/lib/settingsPanel';
import { auth } from '@/lib/cf-client';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { accountService, Account } from '@/lib/services/accountService';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { isCreditAccountType, computeCreditUsage, getCardCycle } from '@/lib/creditCard';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { GamificationStrip } from '@/components/GamificationStrip';
import { WeeklyInsights } from '@/components/WeeklyInsights';
import { SecurityNudge } from '@/components/SecurityNudge';

// Ringkasan (dashboard member): kartu sapaan hari ini → catatan hari ini →
// pengeluaran bulan terpilih per kategori + budget → transaksi terbaru →
// kartu fitur (saldo, tabungan, investasi, tagihan kartu, hutang, pajak…).
// Semua nominal dalam IDR (amountIDR yang dikonversi saat disimpan).

const greeting = (h: number) => (h >= 4 && h < 11 ? 'Selamat pagi' : h >= 11 && h < 15 ? 'Selamat siang' : h >= 15 && h < 18 ? 'Selamat sore' : 'Selamat malam');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const short = (n: number) =>
  Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);
const toIdrAmount = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;
const BAR_COLORS = ['bg-indigo-600', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-slate-400'];
const card = 'rounded-[24px] bg-white ring-1 ring-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export default function MonthlyDashboard() {
  // Ikon/warna kategori pilihan user (Pengaturan → Kategori & Anggaran).
  useCategoryStyles();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Semua transaksi (tanpa filter bulan) — dipakai siklus tagihan kartu
  // kredit, yang tanggal cetaknya bisa jatuh di bulan sebelumnya.
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  // Jam & tanggal dari perangkat, baru diketahui setelah hydrate (static export).
  const [now, setNow] = useState<Date | null>(null);
  const leo = useLeoPrefs();
  const season = now && leo.seasonal ? currentSeason(now) : null;
  const { openModal } = useModal();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sapaan & "hari ini" mengikuti jam perangkat
    setNow(new Date());
    const loadBudgets = () => budgetService.getUserBudgets('session').then(setBudgets).catch(console.error);
    loadBudgets();
    return subscribeToCollectionChanges('budgets', loadBudgets);
  }, []);

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

  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + toIdrAmount(t), 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + toIdrAmount(t), 0), [transactions]);
  const totalInvestasi = useMemo(() => investments.reduce((s, i) => s + (Number(i.amountIDR) || Number(i.amountInvested) || 0), 0), [investments]);
  // Saldo Tabungan bersifat all-time (total setoran aktif di fitur Tabungan).
  const totalTabunganSaldo = useMemo(() => savings.reduce((s, item) => {
    const amt = Number(item.amountIDR) || item.amount;
    return item.transactionType === 'Penarikan' ? s - amt : s + amt;
  }, 0), [savings]);
  const totalSaldoRekening = useMemo(
    () => accounts.reduce((s, a) => s + exchangeRateService.convert(a.balance || 0, a.currency || 'IDR', 'IDR', fxRates), 0),
    [accounts, fxRates]
  );

  // Tagihan Kartu Kredit = total terpakai semua rekening kartu kredit + catatan
  // Hutang "Kartu Kredit" lama yang belum lunas & TIDAK menempel ke rekening
  // kartu (supaya tidak terhitung dobel). Lihat lib/creditCard.ts.
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

  // Jatuh tempo terdekat di antara kartu yang siklusnya diatur & masih punya tagihan.
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

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  // Arus kas saja — catatan hutang/piutang (type "debt") bukan transaksi kas.
  const cashFlow = useMemo(() => allTransactions.filter((t) => t.type !== 'debt'), [allTransactions]);
  const todays = useMemo(() => (now ? cashFlow.filter((t) => sameDay(new Date(t.date), now)) : []), [cashFlow, now]);
  const todaysSpend = todays.filter((t) => t.type === 'pengeluaran');
  const spentToday = todaysSpend.reduce((s, t) => s + toIdrAmount(t), 0);
  const recent = useMemo(
    () => [...cashFlow].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [cashFlow]
  );

  // "Biasanya jam segini": pengeluaran yang paling sering dicatat (createdAt)
  // di jam yang sama (±1 jam) dalam 60 hari terakhir — pintasan untuk mencatat lagi.
  const usual = useMemo(() => {
    if (!now) return [];
    const since = now.getTime() - 60 * 86400e3;
    const hour = now.getHours();
    const count = new Map<string, { n: number; sum: number }>();
    for (const t of cashFlow) {
      const d = new Date(t.createdAt);
      if (t.type !== 'pengeluaran' || Number.isNaN(d.getTime()) || d.getTime() < since || Math.abs(d.getHours() - hour) > 1) continue;
      const key = (t.note || t.subCategory || t.category || '').trim();
      if (!key) continue;
      const c = count.get(key) ?? { n: 0, sum: 0 };
      count.set(key, { n: c.n + 1, sum: c.sum + toIdrAmount(t) });
    }
    return [...count.entries()].filter(([, c]) => c.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 2).map(([title, c]) => ({ title, avg: Math.round(c.sum / c.n / 1000) * 1000 }));
  }, [cashFlow, now]);

  // Bulan terpilih vs bulan sebelumnya (pengeluaran, IDR).
  const isCurrentMonth = now ? selectedMonth === now.getMonth() && selectedYear === now.getFullYear() : false;
  const prevMonthSpend = useMemo(() => {
    const pm = new Date(selectedYear, selectedMonth - 1, 1);
    return cashFlow
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'pengeluaran' && d.getMonth() === pm.getMonth() && d.getFullYear() === pm.getFullYear();
      })
      .reduce((s, t) => s + toIdrAmount(t), 0);
  }, [cashFlow, selectedMonth, selectedYear]);
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(selectedYear, selectedMonth));
  const prevMonthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(selectedYear, selectedMonth - 1));

  // Ke mana uangmu: pengeluaran bulan terpilih per kategori + budget bulanan kategori itu.
  const categories = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const t of transactions) if (t.type === 'pengeluaran') byCat.set(t.category || 'Lainnya', (byCat.get(t.category || 'Lainnya') ?? 0) + toIdrAmount(t));
    const monthlyBudget = new Map(budgets.filter((b) => b.type === 'pengeluaran' && b.period === 'monthly').map((b) => [b.category, Number(b.amount) || 0]));
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([category, spent]) => ({ category, spent, budget: monthlyBudget.get(category) ?? 0 }));
  }, [transactions, budgets]);
  const maxCat = Math.max(1, ...categories.map((c) => c.spent));
  const overBudget = categories.reduce((s, c) => (c.budget > 0 && c.spent > c.budget ? s + (c.spent - c.budget) : s), 0);
  const outsideBudget = categories.reduce((s, c) => (c.budget > 0 ? s : s + c.spent), 0);
  const hasBudgets = categories.some((c) => c.budget > 0);

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

  const txTitle = (t: Transaction) => t.note || t.subCategory || t.category;
  // `date` cuma tanggal (YYYY-MM-DD); jam diambil dari waktu dicatat (createdAt).
  const txLine = (t: Transaction, withDate: boolean) => {
    const created = new Date(t.createdAt);
    const time = Number.isNaN(created.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(created);
    const day = withDate ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date)) : '';
    const acc = accountName.get(t.accountId);
    return [day, time, t.category, acc].filter(Boolean).join(' · ');
  };
  const TxRow = ({ t, withDate = false }: { t: Transaction; withDate?: boolean }) => {
    const incoming = isIncomingTransaction(t) || (t.type === 'topup' && Boolean(t.subCategory?.includes('Masuk')));
    // Pindah dana antar rekening sendiri / ke tabungan & investasi: netral, bukan belanja.
    const transfer = !incoming && t.type !== 'pengeluaran';
    const visual = categoryVisual(t.category, t.type);
    return (
      <div className="flex items-center gap-3.5 py-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]', visual.tile)} aria-hidden>{visual.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{txTitle(t)}</p>
          <p className="truncate text-[12px] text-slate-500">{txLine(t, withDate)}</p>
        </div>
        <p className={cn('shrink-0 text-[15px] font-bold tabular-nums', incoming ? 'text-emerald-600' : transfer ? 'text-slate-500' : 'text-slate-900')}>
          {incoming ? '+' : transfer ? '' : '−'}{formatIDR(toIdrAmount(t))}
        </p>
      </div>
    );
  };

  const firstName = auth.currentUser?.displayName?.split(' ')[0];
  const statsLoading = loading && allTransactions.length === 0;

  const features: { href?: string; onClick?: () => void; icon: React.ElementType; tile: string; label: string; value: string; caption: string }[] = [
    { onClick: () => setShowAccountsModal(true), icon: Wallet, tile: 'bg-indigo-600', label: 'Saldo bersih', value: accountsLoaded ? formatIDR(totalSaldoRekening) : '…', caption: `${accounts.length} rekening & dompet` },
    { href: '/membership/tabungan', icon: PiggyBank, tile: 'bg-pink-500', label: 'Tabungan', value: formatIDR(totalTabunganSaldo), caption: `${savings.length} catatan tabungan` },
    { href: '/membership/investment', icon: Landmark, tile: 'bg-violet-500', label: 'Investasi', value: formatIDR(totalInvestasi), caption: `${investments.filter((i) => i.status === 'Active').length} investasi aktif` },
    { href: '/membership/cards', icon: CreditCard, tile: 'bg-rose-500', label: 'Tagihan kartu', value: formatIDR(creditCardBills), caption: dueLabel ?? 'Tidak ada tagihan tercetak' },
    { href: '/membership/transactions/debt', icon: HandCoins, tile: 'bg-amber-500', label: 'Hutang lain', value: formatIDR(otherDebts), caption: otherDebts > 0 ? 'Belum lunas' : 'Tidak ada hutang' },
    { href: '/membership/pajak-center', icon: FileCheck, tile: 'bg-emerald-500', label: 'Pajak Center', value: 'SPT tahunan', caption: 'Harta, utang & penghasilan setahun' },
    { href: '/membership/laporan', icon: CalendarRange, tile: 'bg-sky-500', label: 'Laporan', value: String(selectedYear), caption: 'Tren, kategori & tempat teratas' },
    { href: '/membership/market-data', icon: Globe, tile: 'bg-slate-700', label: 'Data pasar', value: 'Kurs & saham', caption: 'Pantau harga terbaru' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12 md:space-y-8">
      {/* Judul + aksi cepat */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Ringkasan</h1>
        <div className="flex gap-2">
          <Link href="/input-cepat" className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <ScanLine size={16} /> <span className="hidden sm:inline">Struk</span>
          </Link>
          <Link href="/input-cepat" className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <Mic size={16} /> <span className="hidden sm:inline">Suara</span>
          </Link>
        </div>
      </div>

      <InboxBanner />

      {/* Kartu sapaan: hari ini */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-[0_24px_50px_-28px_rgba(79,70,229,0.8)] md:p-8">
        <div aria-hidden className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        {season && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {SEASON_INFO[season].deco.map((d, i) => (
              <span key={i} className="leo-season-float absolute select-none text-[22px] opacity-70" style={{ left: `${[66, 78, 90][i]}%`, top: `${[10, 46, 24][i]}%`, animationDelay: `${i * 0.9}s` }}>{d}</span>
            ))}
          </div>
        )}
        {leo.showMascot && (
          <div className="pointer-events-none absolute -bottom-8 right-2 hidden md:block">
            <LeoMascot mood="idle" size={170} season={season} />
          </div>
        )}
        <div className="relative max-w-xl">
          <p className="text-[28px] font-extrabold tracking-tight md:text-[34px]">
            {now ? greeting(now.getHours()) : 'Halo'}{firstName ? `, ${firstName}` : ''}.
          </p>
          <p className="mt-1 text-[14px] text-white/80">
            Hari ini{now ? ` · ${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
          </p>
          {statsLoading ? (
            <div className="mt-4 h-14 w-56 animate-pulse rounded-2xl bg-white/20" />
          ) : (
            <p className="mt-4 text-[44px] font-extrabold leading-none tracking-tight tabular-nums md:text-[56px]">
              <AnimatedNumber value={spentToday} format={formatIDR} />
            </p>
          )}
          <p className="mt-2 text-[14px] text-white/80">
            {todaysSpend.length > 0 ? `keluar dari ${todaysSpend.length} pembayaran` : 'Belum ada pengeluaran hari ini'}
          </p>
          <Link href="/membership/ai-leosiqra" className="mt-6 flex w-full items-center gap-3 rounded-full bg-white/95 py-2 pl-5 pr-2 text-slate-400 shadow-lg transition-colors hover:bg-white">
            <Sparkles size={17} className="text-indigo-500" />
            <span className="flex-1 truncate text-[15px]">Tanya Leo: bulan ini boros di mana?</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white"><Send size={16} /></span>
          </Link>
          {(usual.length > 0 || dueLabel) && (
            <div className="mt-4 hidden flex-wrap items-center gap-2 md:flex">
              {usual.length > 0 && <span className="text-[13px] font-semibold text-white/85">Biasanya jam segini</span>}
              {usual.map((u) => (
                <button key={u.title} type="button" onClick={() => openModal('harian')} className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold backdrop-blur hover:bg-white/30">
                  {u.title} · {short(u.avg)} <Plus size={13} />
                </button>
              ))}
              {dueLabel && (
                <Link href="/membership/cards" className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold backdrop-blur hover:bg-white/30">
                  <CreditCard size={13} /> {dueLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <SecurityNudge />

      {/* Hari ini — di HP cukup kartu sapaan + Terbaru (versi ringkas). */}
      <section className={cn(card, 'hidden p-5 md:block md:p-6')}>
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Hari ini{now ? ` · ${now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
        </p>
        <p className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-900">
          {todaysSpend.length} pembayaran · {formatIDR(spentToday)}
        </p>
        {statsLoading ? (
          <div className="mt-3 space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : todays.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-slate-50 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
            <LeoMascot mood="peek" size={72} />
            <p className="flex-1 text-[14px] text-slate-500">Belum ada catatan hari ini. Tadi bayar apa?</p>
            <button type="button" onClick={() => openModal('harian')} className="rounded-full bg-indigo-600 px-5 py-2.5 text-[14px] font-bold text-white">Catat sekarang</button>
          </div>
        ) : (
          <>
            <div className="mt-2 divide-y divide-slate-100">{todays.slice(0, 3).map((t, i) => <TxRow key={t.id || i} t={t} />)}</div>
            {todays.length > 3 && <p className="mt-1 text-[13px] font-semibold text-slate-400">+{todays.length - 3} lagi</p>}
            <Link href="/membership/transactions/daily" className="mt-4 flex items-center justify-center rounded-full bg-slate-50 py-3 text-[14px] font-bold text-slate-700 hover:bg-slate-100">
              Lihat semua catatan hari ini
            </Link>
          </>
        )}
      </section>

      <div className="hidden space-y-6 md:block md:space-y-8">
        <GamificationStrip />
        <WeeklyInsights target="web" />
      </div>

      {/* Pengeluaran bulan terpilih per kategori */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-slate-500">
              Pengeluaran {monthLabel}{isCurrentMonth && now ? ` · hari ke-${now.getDate()}` : ''}
            </p>
            <Link href="/membership/transactions/daily" className="mt-1 flex items-center gap-1 text-[34px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums md:text-[40px]">
              {formatIDR(totalPengeluaran)} <ChevronRight size={22} className="text-slate-300" />
            </Link>
            {prevMonthSpend > 0 && (
              <p className={cn('mt-2 flex items-center gap-1 text-[14px]', totalPengeluaran > prevMonthSpend ? 'text-rose-600' : 'text-emerald-600')}>
                {totalPengeluaran > prevMonthSpend ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                {short(Math.abs(totalPengeluaran - prevMonthSpend))} {totalPengeluaran > prevMonthSpend ? 'lebih banyak' : 'lebih sedikit'} dari {prevMonthLabel}
              </p>
            )}
            {totalPemasukan > 0 && <p className="mt-1 text-[13px] text-slate-500">Pemasukan {monthLabel}: <span className="font-bold text-emerald-600">{formatIDR(totalPemasukan)}</span></p>}
          </div>
          <MonthPicker
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        </div>

        <div className={cn(card, 'p-5 md:p-6')}>
          <div className="flex items-baseline justify-between">
            <p className="text-[16px] font-bold text-slate-900">Ke mana uangmu</p>
            <button type="button" onClick={() => openSettings('kategori')} className="text-[13px] font-bold text-indigo-600 hover:underline">Atur anggaran</button>
          </div>
          {statsLoading ? (
            <div className="mt-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : categories.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-slate-500">Belum ada pengeluaran di {monthLabel}.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {categories.slice(0, 7).map((c, i) => {
                const over = c.budget > 0 && c.spent > c.budget;
                const width = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : (c.spent / maxCat) * 100;
                return (
                  <li key={c.category} className={cn(i >= 4 && 'hidden md:block')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold text-slate-800">{c.category}</span>
                      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', over ? 'text-rose-600' : 'text-slate-900')}>{short(c.spent)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full', over ? 'bg-rose-500' : BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${Math.max(2, width)}%` }} />
                    </div>
                    {c.budget > 0 && <p className="mt-1 text-[12px] text-slate-400">dari budget {short(c.budget)}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {hasBudgets && (overBudget > 0 || outsideBudget > 0) && (
            <div className="mt-5 border-t border-slate-100 pt-4 text-[14px]">
              {overBudget > 0 && <p className="font-bold text-rose-600">Lewat budget {short(overBudget)}</p>}
              {outsideBudget > 0 && <p className="text-slate-500">{short(outsideBudget)} di luar budget</p>}
            </div>
          )}
        </div>
      </section>

      {/* Terbaru */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Terbaru</h2>
          <Link href="/membership/transactions/daily" className="text-[14px] font-bold text-indigo-600 hover:underline">Lihat semua</Link>
        </div>
        <div className={cn(card, 'divide-y divide-slate-100 px-5 py-1 md:px-6')}>
          {statsLoading ? (
            <div className="space-y-2 py-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : recent.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-slate-500">Belum ada transaksi. Mulai dari tombol + Tambah transaksi.</p>
          ) : (
            recent.map((t, i) => (
              <div key={t.id || i} className={cn(i >= 5 && 'hidden md:block')}><TxRow t={t} withDate /></div>
            ))
          )}
        </div>
      </section>

      {/* Fitur kamu — di HP cukup dua teratas (saldo & tabungan); sisanya di menu. */}
      <section>
        <h2 className="mb-3 px-1 text-[22px] font-extrabold tracking-tight text-slate-900"><span className="md:hidden">Saldo</span><span className="hidden md:inline">Fitur kamu</span></h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map((f, fi) => {
            const inner = (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white', f.tile)}><f.icon size={17} /></span>
                  <span className="truncate text-[13px] md:text-[14px] font-semibold text-slate-500">{f.label}</span>
                  <ChevronRight size={16} className="ml-auto text-slate-300" />
                </div>
                <p className="mt-3 truncate text-[17px] font-extrabold md:text-[22px] tracking-tight text-slate-900 tabular-nums">{f.value}</p>
                <p className="mt-0.5 truncate text-[12px] md:text-[13px] text-slate-500">{f.caption}</p>
              </>
            );
            const cls = cn(card, 'block min-w-0 p-4 md:p-5 text-left transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(49,46,129,0.35)] hover:ring-indigo-100', fi >= 2 && 'hidden md:block');
            return f.href ? (
              <Link key={f.label} href={f.href} className={cls}>{inner}</Link>
            ) : (
              <button key={f.label} type="button" onClick={f.onClick} className={cn(cls, 'w-full')}>{inner}</button>
            );
          })}
        </div>
      </section>

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
                    <p className="text-caption text-slate-400 whitespace-nowrap tabular-nums">≈ {formatIDR(idrValue)}</p>
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
