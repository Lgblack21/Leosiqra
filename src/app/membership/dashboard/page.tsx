"use client";

import { useState, useEffect, useMemo } from 'react';

import {
  TrendingUp,
  Wallet,
  TrendingDown,
  CreditCard,
  Landmark,
  ChevronRight,
  LayoutDashboard,
  Building2,
  Banknote,
  Plus,
  Zap,
  Sparkles,
  ArrowUp,
} from 'lucide-react';
import Link from 'next/link';
import { cn, isIncomingTransaction, formatIDR, formatMoney } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { LogoImage } from '@/components/ui/LogoImage';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { accountService, Account } from '@/lib/services/accountService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { isCreditAccountType, computeCreditUsage, getCardCycle } from '@/lib/creditCard';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
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
import { itemService } from '@/lib/services/itemService';

// Beli investasi tersimpan sebagai "pengeluaran" tapi bukan biaya hidup —
// aturan yang sama dengan insight mingguan & laporan bulanan di Worker.
const isInvestmentCategory = (category?: string) =>
  Boolean(category) && (/investasi/i.test(category!) || category === 'Saham' || category === 'Deposito');

export default function MonthlyDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Semua transaksi (tanpa filter bulan) — dipakai siklus tagihan kartu
  // kredit, yang tanggal cetaknya bisa jatuh di bulan sebelumnya.
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  // Dashboard selalu bulan berjalan — bulan lain dilihat di Laporan.
  const [selectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
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

  const [ask, setAsk] = useState('');
  const [itemsValue, setItemsValue] = useState(0);
  useEffect(() => {
    const load = () => itemService.list().then((l) => setItemsValue(l.reduce((s, i) => s + (Number(i.current_value) || 0), 0))).catch(() => setItemsValue(0));
    load();
    return subscribeToCollectionChanges('items', load);
  }, []);
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
  const kekayaanBersih = rekeningAset + totalTabunganSaldo + investasiNilai + piutang + itemsValue - creditCardBills - otherDebts;
  const featureBase: Partial<Record<FeatureId, TileStat>> = {
    kekayaan: { value: formatRp(kekayaanBersih), sub: 'Kekayaan bersih' },
    cuan: (() => {
      const side = transactions.filter((t) => t.type === 'pemasukan' && !/gaji|salary/i.test(t.category || '')).reduce((s, t) => s + toIdrAmount(t), 0);
      return { value: formatRp(side), sub: 'Cuan bulan ini (di luar gaji)' };
    })(),
    arus: { value: `${netBalance >= 0 ? '+' : '−'}${formatRp(Math.abs(netBalance))}`, sub: `Masuk ${formatRp(totalPemasukan)} · keluar ${formatRp(totalPengeluaran)}` },
    tabungan: { value: formatRp(totalTabunganSaldo), sub: `${savings.length} catatan setoran` },
    investasi: { value: formatRp(investasiNilai), sub: `${investments.filter((i) => i.status === 'Active').length} aktif` },
    kartu: { value: formatRp(creditCardBills), sub: dueLabel ?? (creditCardBills > 0 ? 'Tagihan terpakai' : 'Tidak ada tagihan') },
    hutang: { value: formatRp(otherDebts), sub: piutang > 0 ? `Piutang ${formatRp(piutang)}` : otherDebts > 0 ? 'Belum lunas' : 'Bebas hutang 🎉' },
  };

  const recent = [...allTransactions]
    .filter((t) => t.type !== 'debt')
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5);
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(selectedYear, selectedMonth));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* 1. Sapaan: saldo, Leo, tanya, catat */}
      <AuthScene className="auth-hero rounded-[28px] shadow-xl shadow-indigo-950/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/45 via-slate-950/15 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-5 p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/85">
              <Greeting />{firstName ? `, ${firstName}` : ''} 👋
            </p>
            <button type="button" onClick={() => setShowAccountsModal(true)} className="group mt-2 block text-left focus-visible:outline-none">
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
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = ask.trim();
                openModal('ai_chat', q ? { prompt: q } : null);
                setAsk('');
              }}
              className="mt-5 flex max-w-md items-center gap-2 rounded-2xl bg-white/95 py-1.5 pl-4 pr-1.5 shadow-lg shadow-indigo-950/20"
            >
              <Sparkles size={16} className="shrink-0 text-violet-500" />
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onFocus={(e) => {
                  // Klik kolom kosong = buka chat langsung (seperti Oyenza).
                  if (!ask.trim()) {
                    e.currentTarget.blur();
                    openModal('ai_chat');
                  }
                }}
                placeholder="Tanya Leo… mis. minggu ini habis berapa?"
                aria-label="Tanya Leo"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Kirim pertanyaan" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40">
                <ArrowUp size={16} />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => openModal('harian')} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-lg shadow-indigo-950/20 transition-transform hover:-translate-y-0.5">
                <Plus size={16} strokeWidth={2.6} /> Catat transaksi
              </button>
              <Link href="/input-cepat" className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25">
                <Zap size={16} /> Input cepat
              </Link>
            </div>
          </div>

          <div className="hidden items-end gap-2 self-end md:flex">
            <div className="mb-16 max-w-[210px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-[13px] font-semibold leading-snug text-slate-700 shadow-lg">{leo.text}</div>
            <LeoMascot mood={leo.mood} size={120} interactive className="shrink-0" />
          </div>
        </div>
      </AuthScene>

      <SecurityNudge />

      {/* 2. Hari ini + bulan ini */}
      <div className="grid items-start gap-5 md:grid-cols-2">
        {isOn('streak') && <CloseDayCard transactions={allTransactions} accounts={accounts} />}

        <div className={cn('flex min-w-0 flex-col rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]', !isOn('streak') && 'md:col-span-2')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold capitalize text-slate-400">Bulan ini · {monthName}</p>
            <Link href="/membership/laporan" className="flex items-center gap-0.5 text-xs font-bold text-indigo-600 hover:underline">
              Laporan <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Masuk</p>
              {statsLoading ? <Skeleton className="mt-1 h-7 w-28" /> : <p className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatRp(totalPemasukan)}</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500">Keluar</p>
              {statsLoading ? <Skeleton className="mt-1 h-7 w-28" /> : <p className="text-lg font-extrabold text-rose-500 tabular-nums">{formatRp(totalPengeluaran)}</p>}
            </div>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Sisa bulan ini <b className={netBalance < 0 ? 'text-rose-500' : 'text-slate-800'}>{netBalance < 0 ? '−' : ''}{formatRp(Math.abs(netBalance))}</b>
          </p>

          {paceSource ? (
            <div className="pt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">{paceSource === 'budget' ? 'Anggaran terpakai' : 'Dari pemasukan'}</span>
                <span className={cn('rounded-full px-2 py-0.5 font-bold', paceStatus === 'over' ? 'bg-rose-50 text-rose-600' : paceStatus === 'fast' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                  {paceStatus === 'over' ? 'Lewat batas' : paceStatus === 'fast' ? 'Agak cepat' : 'Aman'}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', paceStatus === 'over' ? 'bg-rose-500' : paceStatus === 'fast' ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500')}
                  style={{ width: `${Math.min(100, usedFrac * 100)}%` }}
                />
                {isCurrentPeriod && <div className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-slate-800" style={{ left: `${dayFrac * 100}%` }} title="Hari ini" />}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {paceStatus === 'over'
                  ? `Lewat ${formatRp(paceSpent - paceCap)} dari ${paceSource === 'budget' ? 'anggaran' : 'pemasukan'}.`
                  : `Sisa ${formatRp(paceCap - paceSpent)} · ±${formatRp(perDayLeft)}/hari untuk ${daysLeft} hari`}
              </p>
            </div>
          ) : (
            <button type="button" onClick={() => openModal('budget_target')} className="pt-4 text-left text-xs font-bold text-indigo-600 hover:underline">
              Atur anggaran bulanan supaya Leo bisa ngingetin →
            </button>
          )}
        </div>
      </div>

      {/* 3. Fitur kamu */}
      <FeatureTiles base={featureBase} limit={5} />

      {/* 4. Transaksi terakhir */}
      <div className="rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="font-extrabold text-slate-900">Transaksi terakhir</h2>
          <Link href="/membership/transactions/daily" className="flex items-center gap-0.5 text-sm font-bold text-indigo-600 hover:underline">
            Lihat semua <ChevronRight size={15} />
          </Link>
        </div>
        {loading && allTransactions.length === 0 ? (
          <div className="space-y-2 p-5 pt-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : recent.length === 0 ? (
          <div className="p-5 pt-2">
            <EmptyState title="Belum ada transaksi" description="Catat pemasukan atau pengeluaran pertamamu lewat tombol Catat transaksi di atas." icon={<LayoutDashboard size={24} />} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 pb-2">
            {recent.map((trx, i) => {
              const incoming = isIncomingTransaction(trx);
              return (
                <li key={trx.id || i} className="flex items-center gap-3 px-5 py-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
                    {incoming ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{trx.note || trx.category}</p>
                    <p className="truncate text-xs text-slate-400">{formatDate(trx.date)} · {trx.category}</p>
                  </div>
                  <p className={cn('whitespace-nowrap text-sm font-extrabold tabular-nums', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                    {incoming ? '+' : '−'}{formatRp(toIdrAmount(trx))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <WeeklyInsights target="web" />

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
