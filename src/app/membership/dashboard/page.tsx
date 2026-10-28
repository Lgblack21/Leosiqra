"use client";

import { useState, useEffect, useMemo } from 'react';
import { InboxBanner } from '@/components/inbox/InboxBanner';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
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
  BellRing,
} from 'lucide-react';
import { cn, formatIDR, formatMoney, isIncomingTransaction } from '@/lib/utils';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { LogoImage } from '@/components/ui/LogoImage';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
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
import { LeoBuddy, type LeoTip } from '@/components/dashboard/LeoBuddy';
import { SpendPaceChart, type PacePoint } from '@/components/dashboard/SpendPaceChart';
import { reminderService, type Reminder } from '@/lib/services/reminderService';

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
  const [reminders, setReminders] = useState<Reminder[]>([]);
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
    reminderService.list().then(setReminders).catch(() => setReminders([]));
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

  // ===== Tambahan Ringkasan v2: ritme, jatah harian, "Segera", kata-kata Leo =====
  const budgetedCats = useMemo(
    () => new Set(budgets.filter((b) => b.type === 'pengeluaran' && b.period === 'monthly' && Number(b.amount) > 0).map((b) => b.category)),
    [budgets]
  );
  const monthlyBudgetTotal = useMemo(
    () => budgets.filter((b) => b.type === 'pengeluaran' && b.period === 'monthly').reduce((s, b) => s + (Number(b.amount) || 0), 0),
    [budgets]
  );

  // Kumulatif pengeluaran per tanggal: bulan terpilih vs bulan sebelumnya.
  const pace = useMemo(() => {
    const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const pm = new Date(selectedYear, selectedMonth - 1, 1);
    const prevDays = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
    const curr = new Array<number>(days + 1).fill(0);
    // Hanya kategori yang punya anggaran bulanan — untuk jatah harian.
    const budgeted = new Array<number>(days + 1).fill(0);
    const prev = new Array<number>(Math.max(days, prevDays) + 1).fill(0);
    for (const t of cashFlow) {
      if (t.type !== 'pengeluaran') continue;
      const d = new Date(t.date);
      if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
        curr[d.getDate()] += toIdrAmount(t);
        if (budgetedCats.has(t.category || 'Lainnya')) budgeted[d.getDate()] += toIdrAmount(t);
      }
      else if (d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth()) prev[d.getDate()] += toIdrAmount(t);
    }
    const lastDay = isCurrentMonth && now ? now.getDate() : days;
    let a = 0;
    let b = 0;
    let prevAtLastDay = 0;
    let beforeToday = 0;
    let budgetedBeforeToday = 0;
    for (let day = 1; day < lastDay; day++) budgetedBeforeToday += budgeted[day];
    const data: PacePoint[] = [];
    for (let day = 1; day <= days; day++) {
      a += curr[day];
      if (day <= prevDays) b += prev[day];
      if (day === lastDay - 1) beforeToday = a;
      if (day === Math.min(lastDay, prevDays)) prevAtLastDay = b;
      data.push({ day, now: day <= lastDay ? a : null, prev: day <= prevDays ? b : null });
    }
    return { data, days, lastDay, prevAtLastDay, beforeToday: lastDay > 1 ? beforeToday : 0, budgetedBeforeToday, budgetedToday: budgeted[lastDay] ?? 0 };
  }, [cashFlow, selectedMonth, selectedYear, isCurrentMonth, now, budgetedCats]);
  const spentToDate = pace.data[pace.lastDay - 1]?.now ?? 0;
  const paceDiff = spentToDate - pace.prevAtLastDay;
  const dailyAvg = isCurrentMonth && pace.lastDay > 1 ? Math.round(pace.beforeToday / (pace.lastDay - 1)) : 0;
  // Jatah hari ini = sisa anggaran bulan ini (kategori beranggaran, sebelum
  // hari ini) dibagi sisa hari. Dibandingkan dengan belanja hari ini di
  // kategori yang sama — kategori tanpa anggaran tidak ikut dihitung.
  const dailyAllowance =
    isCurrentMonth && monthlyBudgetTotal > 0 ? Math.max(0, Math.round((monthlyBudgetTotal - pace.budgetedBeforeToday) / (pace.days - pace.lastDay + 1))) : null;
  const budgetedToday = pace.budgetedToday;

  // Segera: pengingat aktif ≤30 hari + tagihan kartu kredit yang tercetak.
  const upcoming = useMemo(() => {
    if (!now) return [];
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const items: { id: string; title: string; amount: number | null; days: number; kind: 'reminder' | 'card'; href?: string }[] = [];
    for (const r of reminders) {
      if (!r.active) continue;
      const due = new Date(r.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due.getTime() - start.getTime()) / 86400e3);
      if (days >= 0 && days <= 30) items.push({ id: r.id, title: r.title, amount: r.amount, days, kind: 'reminder' });
    }
    for (const a of accounts) {
      if (!isCreditAccountType(a.type)) continue;
      const cycle = getCardCycle(a, allTransactions);
      if (!cycle || cycle.amountDue <= 0) continue;
      items.push({
        id: `card-${a.id}`,
        title: `Tagihan ${a.name}`,
        amount: exchangeRateService.convert(cycle.amountDue, a.currency || 'IDR', 'IDR', fxRates),
        days: cycle.daysUntilDue,
        kind: 'card',
        href: '/membership/cards',
      });
    }
    return items.sort((x, y) => x.days - y.days);
  }, [reminders, accounts, allTransactions, fxRates, now]);
  const dueText = (days: number) => (days < 0 ? `lewat ${Math.abs(days)} hari` : days === 0 ? 'hari ini' : days === 1 ? 'besok' : `${days} hari lagi`);

  // Kata-kata Leo — semua dari data asli, urut dari yang paling penting.
  const tips: LeoTip[] = (() => {
    if (statsLoading) return [{ id: 'load', text: 'Bentar ya, aku hitung dulu keuanganmu…', mood: 'watch' }];
    const list: LeoTip[] = [];
    const over = categories.filter((c) => c.budget > 0 && c.spent > c.budget).sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
    if (over[0]) list.push({ id: 'over', mood: 'sad', text: `Waduh, ${over[0].category} udah lewat anggaran ${short(over[0].spent - over[0].budget)} di ${monthLabel}. Rem dikit, yuk.`, action: { label: 'Atur anggaran', onClick: () => openSettings('kategori') } });
    const soon = upcoming.find((u) => u.days <= 7);
    if (soon) list.push({ id: `soon-${soon.id}`, mood: 'watch', text: `Jangan lupa: ${soon.title}${soon.amount ? ` ${short(soon.amount)}` : ''} — ${dueText(soon.days)}.`, action: soon.href ? { label: 'Lihat', href: soon.href } : { label: 'Pengingat', onClick: () => openSettings('pengingat') } });
    if (isCurrentMonth && now) {
      if (todaysSpend.length === 0 && now.getHours() >= 10) list.push({ id: 'today-empty', mood: 'watch', text: 'Hari ini belum ada catatan. Tadi bayar apa aja?', action: { label: 'Catat', onClick: () => openModal('harian') } });
      else if (dailyAllowance === 0) list.push({ id: 'budget-gone', mood: 'sad', text: `Anggaran ${monthLabel} udah habis sebelum hari ini. Sisa ${pace.days - pace.lastDay + 1} hari — tahan dulu yang nggak penting, ya.`, action: { label: 'Atur anggaran', onClick: () => openSettings('kategori') } });
      else if (dailyAllowance !== null && budgetedToday > dailyAllowance) list.push({ id: 'today-over', mood: 'sad', text: `Hari ini udah ${short(budgetedToday)} dari jatah harian ${short(dailyAllowance)}. Besok lebih hemat ya!` });
      else if (dailyAvg > 0 && spentToday > dailyAvg * 1.5) list.push({ id: 'today-high', mood: 'sad', text: `Hari ini ${short(spentToday)} — lebih tinggi dari rata-rata harianmu ${short(dailyAvg)}.` });
      else if (spentToday > 0) list.push({ id: 'today-ok', mood: 'happy', text: `Mantap! Hari ini ${short(spentToday)}, masih aman${dailyAllowance ? ` di bawah jatah ${short(dailyAllowance)}` : dailyAvg > 0 ? ` di bawah rata-rata ${short(dailyAvg)}` : ''}.` });
      if (pace.prevAtLastDay > 0 && Math.abs(paceDiff) >= 1000) {
        list.push(
          paceDiff < 0
            ? { id: 'pace', mood: 'happy', text: `Sampai tanggal ${pace.lastDay}, kamu ${short(-paceDiff)} lebih hemat dari ${prevMonthLabel}. Pertahankan!` }
            : { id: 'pace', mood: 'sad', text: `Sampai tanggal ${pace.lastDay}, pengeluaranmu ${short(paceDiff)} lebih banyak dari ${prevMonthLabel}.`, action: { label: 'Tanya Leo kenapa', href: '/membership/ai-leosiqra' } }
        );
      }
      if (usual[0]) list.push({ id: 'usual', mood: 'idle', text: `Biasanya jam segini kamu catat ${usual[0].title} (~${short(usual[0].avg)}). Mau dicatat sekarang?`, action: { label: 'Catat', onClick: () => openModal('harian') } });
    }
    const top = categories[0];
    if (top && totalPengeluaran > 0) list.push({ id: 'top', mood: 'idle', text: `Paling banyak di ${monthLabel} buat ${top.category}: ${short(top.spent)} (${Math.round((top.spent / totalPengeluaran) * 100)}%).`, action: { label: 'Tanya Leo', href: '/membership/ai-leosiqra' } });
    if (list.length === 0) list.push({ id: 'hi', mood: 'happy', text: 'Halo, aku Leo! Catat transaksimu, nanti aku bantu jagain dompetmu.', action: { label: 'Catat', onClick: () => openModal('harian') } });
    return list.slice(0, 5);
  })();

  // Warna langit kartu sapaan ikut jam (hex, bukan kelas slate/indigo, supaya
  // tidak ikut dibalik mode gelap).
  const hour = now?.getHours() ?? 12;
  const sky =
    hour < 4 || hour >= 19
      ? 'from-[#0b1026] via-[#1e1b4b] to-[#4c1d95]'
      : hour < 11
        ? 'from-[#0ea5e9] via-[#6366f1] to-[#8b5cf6]'
        : hour < 15
          ? 'from-[#4f46e5] via-[#7c3aed] to-[#d946ef]'
          : 'from-[#fb923c] via-[#e11d48] to-[#7c3aed]';
  const night = hour < 4 || hour >= 19;

  const yesterday = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : null;
  const dayLabel = (d: Date) =>
    now && sameDay(d, now) ? 'Hari ini' : yesterday && sameDay(d, yesterday) ? 'Kemarin' : new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
  const recentGroups = (() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    recent.forEach((t) => {
      const label = dayLabel(new Date(t.date));
      const g = groups[groups.length - 1];
      if (g && g.label === label) g.items.push(t);
      else groups.push({ label, items: [t] });
    });
    return groups;
  })();

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
    <div className="mx-auto max-w-6xl space-y-6 pb-12 md:space-y-8">
      {/* Judul + aksi cepat */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 md:text-[36px]">Ringkasan</h1>
          <p className="text-[14px] text-slate-500">
            {now ? now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '}
          </p>
        </div>
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

      {/* Kartu sapaan: langit ikut jam + Leo yang bisa diajak ngobrol */}
      <section className={cn('relative overflow-hidden rounded-[32px] bg-gradient-to-br p-5 text-white shadow-[0_28px_60px_-30px_rgba(79,70,229,0.85)] md:p-8', sky)}>
        <div aria-hidden className={cn('absolute inset-0 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]', night ? 'opacity-40' : 'opacity-20')} />
        {/* Gradien biasa, bukan blur/backdrop-blur: di Chrome Android lapisan blur
            berkedip hitam saat overlay (mis. panel Pengaturan) dibuka di atasnya. */}
        <div aria-hidden className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_65%)]" />
        {season && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {SEASON_INFO[season].deco.map((d, i) => (
              <span key={i} className="leo-season-float absolute select-none text-[22px] opacity-70" style={{ left: `${[62, 76, 88][i]}%`, top: `${[6, 16, 5][i]}%`, animationDelay: `${i * 0.9}s` }}>{d}</span>
            ))}
          </div>
        )}
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:items-end md:gap-8">
          <div className="min-w-0">
            <p className="text-[26px] font-extrabold tracking-tight md:text-[32px]">
              {now ? greeting(now.getHours()) : 'Halo'}{firstName ? `, ${firstName}` : ''}.
            </p>
            <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/70">Keluar hari ini</p>
            {statsLoading ? (
              <div className="mt-2 h-14 w-56 animate-pulse rounded-2xl bg-white/20" />
            ) : (
              <p className="mt-1 text-[44px] font-extrabold leading-none tracking-tight tabular-nums md:text-[56px]">
                <AnimatedNumber value={spentToday} format={formatIDR} />
              </p>
            )}
            <p className="mt-2 text-[14px] text-white/80">
              {todaysSpend.length > 0 ? `dari ${todaysSpend.length} pembayaran` : 'Belum ada pengeluaran hari ini'}
            </p>
            {!statsLoading && dailyAllowance === 0 && (
              <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white/90">Anggaran {monthLabel} sudah habis</p>
            )}
            {!statsLoading && !!dailyAllowance && (
              <div className="mt-4 max-w-sm">
                <div className="flex justify-between text-[12px] font-semibold text-white/80">
                  <span>Jatah anggaran hari ini {short(dailyAllowance)}</span>
                  <span>{budgetedToday > dailyAllowance ? `lewat ${short(budgetedToday - dailyAllowance)}` : `sisa ${short(dailyAllowance - budgetedToday)}`}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
                  <div className={cn('h-full rounded-full', budgetedToday > dailyAllowance ? 'bg-[#fda4af]' : 'bg-white')} style={{ width: `${Math.min(100, (budgetedToday / dailyAllowance) * 100)}%` }} />
                </div>
              </div>
            )}
            <Link href="/membership/ai-leosiqra" className="mt-5 flex w-full max-w-lg items-center gap-3 rounded-full bg-white/95 py-2 pl-5 pr-2 text-slate-400 shadow-lg transition-colors hover:bg-white">
              <Sparkles size={17} className="text-indigo-500" />
              <span className="flex-1 truncate text-[15px]">Tanya Leo apa aja soal uangmu…</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white"><Send size={16} /></span>
            </Link>
          </div>
          {leo.showMascot && (
            <>
              <LeoBuddy tips={tips} season={season} size={150} className="hidden md:flex" />
              <LeoBuddy tips={tips} season={season} size={104} className="md:hidden" />
            </>
          )}
        </div>
      </section>

      <SecurityNudge />

      {/* Denyut: saldo, keluar & masuk bulan terpilih */}
      <section className="grid grid-cols-3 gap-2.5 md:gap-4">
        <button type="button" onClick={() => setShowAccountsModal(true)} className={cn(card, 'min-w-0 p-3.5 text-left transition-shadow hover:shadow-md md:p-5')}>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 md:text-[13px]"><Wallet size={14} className="text-indigo-500" /> Saldo bersih</span>
          <span className="mt-1.5 block truncate text-[15px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[24px]">{accountsLoaded ? formatIDR(totalSaldoRekening) : '…'}</span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400 md:text-[12px]">{accounts.length} rekening</span>
        </button>
        <Link href="/membership/transactions/daily" className={cn(card, 'min-w-0 p-3.5 transition-shadow hover:shadow-md md:p-5')}>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 md:text-[13px]"><ArrowUpRight size={14} className="text-rose-500" /> Keluar {monthLabel}</span>
          <span className="mt-1.5 block truncate text-[15px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[24px]">{formatIDR(totalPengeluaran)}</span>
          {pace.prevAtLastDay > 0 ? (
            <span className={cn('mt-0.5 block truncate text-[11px] font-semibold md:text-[12px]', paceDiff > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {paceDiff > 0 ? '▲' : '▼'} {short(Math.abs(paceDiff))} vs {prevMonthLabel}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-[11px] text-slate-400 md:text-[12px]">{transactions.filter((t) => t.type === 'pengeluaran').length} transaksi</span>
          )}
        </Link>
        <Link href="/membership/transactions/daily" className={cn(card, 'min-w-0 p-3.5 transition-shadow hover:shadow-md md:p-5')}>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 md:text-[13px]"><ArrowDownLeft size={14} className="text-emerald-500" /> Masuk {monthLabel}</span>
          <span className="mt-1.5 block truncate text-[15px] font-extrabold tracking-tight text-emerald-600 tabular-nums md:text-[24px]">{formatIDR(totalPemasukan)}</span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400 md:text-[12px]">
            {totalPemasukan > 0 ? `selisih ${totalPemasukan - totalPengeluaran >= 0 ? '+' : '−'}${short(Math.abs(totalPemasukan - totalPengeluaran))}` : 'belum ada pemasukan'}
          </span>
        </Link>
      </section>

      {/* Bulan terpilih: ke mana uangmu + ritme */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[22px]">
            {monthLabel} {selectedYear}{isCurrentMonth && now ? <span className="ml-2 text-[14px] font-semibold text-slate-400">hari ke-{now.getDate()}</span> : null}
          </h2>
          <MonthPicker
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={cn(card, 'p-5 md:p-6')}>
            <div className="flex items-baseline justify-between">
              <p className="text-[16px] font-bold text-slate-900">Ke mana uangmu</p>
              <button type="button" onClick={() => openSettings('kategori')} className="text-[13px] font-bold text-indigo-600 hover:underline">Atur anggaran</button>
            </div>
            {statsLoading ? (
              <div className="mt-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : categories.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-slate-500">Belum ada pengeluaran di {monthLabel}.</p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {categories.slice(0, 6).map((c, i) => {
                  const over = c.budget > 0 && c.spent > c.budget;
                  const width = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : (c.spent / maxCat) * 100;
                  const visual = categoryVisual(c.category, 'pengeluaran');
                  return (
                    <li key={c.category} className={cn('flex items-center gap-3', i >= 4 && 'hidden md:flex')}>
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[18px]', visual.tile)} aria-hidden>{visual.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[14px] font-semibold text-slate-800">{c.category}</span>
                          <span className={cn('shrink-0 text-[14px] font-bold tabular-nums', over ? 'text-rose-600' : 'text-slate-900')}>
                            {short(c.spent)}{c.budget > 0 && <span className="font-medium text-slate-400"> / {short(c.budget)}</span>}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full rounded-full', over ? 'bg-rose-500' : BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${Math.max(2, width)}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {hasBudgets && (overBudget > 0 || outsideBudget > 0) && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-[13px]">
                {overBudget > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 font-bold text-rose-600">Lewat anggaran {short(overBudget)}</span>}
                {outsideBudget > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{short(outsideBudget)} di luar anggaran</span>}
              </div>
            )}
          </div>

          <div className={cn(card, 'p-5 md:p-6')}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[16px] font-bold text-slate-900">Ritme pengeluaran</p>
              <span className="flex items-center gap-3 text-[12px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />{monthLabel}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />{prevMonthLabel}</span>
              </span>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {pace.prevAtLastDay > 0
                ? `Sampai tanggal ${pace.lastDay}: ${short(spentToDate)} vs ${short(pace.prevAtLastDay)} di ${prevMonthLabel}.`
                : `Total keluar sampai tanggal ${pace.lastDay}: ${short(spentToDate)}.`}
            </p>
            {statsLoading ? <Skeleton className="mt-4 h-52" /> : <div className="mt-3"><SpendPaceChart data={pace.data} budget={monthlyBudgetTotal} monthShort={monthLabel} prevShort={prevMonthLabel} /></div>}
          </div>
        </div>
      </section>

      {/* Catatan terbaru (dikelompokkan per hari) + Segera */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className={cn(card, 'p-5 md:p-6')}>
          <div className="flex items-baseline justify-between">
            <p className="text-[16px] font-bold text-slate-900">Catatan terbaru</p>
            <Link href="/membership/transactions/daily" className="text-[13px] font-bold text-indigo-600 hover:underline">Lihat semua</Link>
          </div>
          {statsLoading ? (
            <div className="mt-3 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : recent.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-slate-50 py-6 text-center">
              <p className="text-[14px] text-slate-500">Belum ada transaksi. Yuk catat yang pertama.</p>
              <button type="button" onClick={() => openModal('harian')} className="rounded-full bg-indigo-600 px-5 py-2.5 text-[14px] font-bold text-white">Catat sekarang</button>
            </div>
          ) : (
            <div className="mt-2">
              {recentGroups.map((g, gi) => (
                <div key={g.label} className={cn(gi >= 3 && 'hidden md:block')}>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{g.label}</p>
                  <div className="divide-y divide-slate-100">{g.items.map((t, i) => <TxRow key={t.id || i} t={t} />)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn(card, 'p-5 md:p-6')}>
          <div className="flex items-baseline justify-between">
            <p className="text-[16px] font-bold text-slate-900">Segera</p>
            <button type="button" onClick={() => openSettings('pengingat')} className="text-[13px] font-bold text-indigo-600 hover:underline">Pengingat</button>
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-slate-50 px-4 py-6 text-center">
              <BellRing size={22} className="text-slate-400" />
              <p className="text-[14px] text-slate-500">Tidak ada tagihan atau pengingat 30 hari ke depan.</p>
              <button type="button" onClick={() => openSettings('pengingat')} className="mt-1 flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200"><Plus size={14} /> Buat pengingat</button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.slice(0, 5).map((u) => {
                const urgent = u.days <= 3;
                const inner = (
                  <>
                    <span className={cn('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none', u.days < 0 ? 'bg-rose-500 text-white' : urgent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                      {u.kind === 'card' ? <CreditCard size={17} /> : <BellRing size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-slate-900">{u.title}</span>
                      <span className={cn('block text-[12px]', u.days < 0 ? 'font-bold text-rose-600' : urgent ? 'font-semibold text-amber-700' : 'text-slate-500')}>{dueText(u.days)}</span>
                    </span>
                    {u.amount ? <span className="shrink-0 text-[14px] font-bold text-slate-900 tabular-nums">{formatIDR(u.amount)}</span> : null}
                  </>
                );
                return (
                  <li key={u.id}>
                    {u.href ? (
                      <Link href={u.href} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-slate-50">{inner}</Link>
                    ) : (
                      <button type="button" onClick={() => openSettings('pengingat')} className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-slate-50">{inner}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Pintasan fitur (saldo sudah di baris atas) — di HP cukup empat teratas */}
      <section>
        <h2 className="mb-3 px-1 text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[22px]">Fitur kamu</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {features.slice(1).map((f, fi) => {
            const inner = (
              <>
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm', f.tile)}><f.icon size={18} /></span>
                <p className="mt-3 truncate text-[13px] font-semibold text-slate-500">{f.label}</p>
                <p className="truncate text-[16px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[18px]">{f.value}</p>
                <p className="mt-0.5 truncate text-[12px] text-slate-400">{f.caption}</p>
              </>
            );
            const cls = cn(card, 'group block min-w-0 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(49,46,129,0.4)]', fi >= 4 && 'hidden md:block');
            return f.href ? (
              <Link key={f.label} href={f.href} className={cls}>{inner}</Link>
            ) : (
              <button key={f.label} type="button" onClick={f.onClick} className={cn(cls, 'w-full')}>{inner}</button>
            );
          })}
        </div>
      </section>

      <div className="hidden space-y-6 md:block md:space-y-8">
        <GamificationStrip />
        <WeeklyInsights target="web" />
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
