"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, ChevronRight, Eye, EyeOff, LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { cn, isIncomingTransaction, formatIDR } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { accountService, Account } from '@/lib/services/accountService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { SecurityNudge } from '@/components/SecurityNudge';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { AuthScene } from '@/components/auth/AuthScene';
import { useModal } from '@/context/ModalContext';
import { budgetService, type Budget } from '@/lib/services/budgetService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { CloseDayCard } from '@/components/streak/CloseDay';
import { FeatureTiles, type TileStat } from '@/components/features/FeatureTiles';
import { type FeatureId } from '@/lib/features';
import { itemService } from '@/lib/services/itemService';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';

// Ringkasan: satu angka besar (pengeluaran bulan ini), ke mana uangnya pergi,
// transaksi terbaru, lalu "Hari ini" dan fitur yang dinyalakan. Semua baca saja.

const card = 'rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]';
const toIdr = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;
const isSpend = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt` : n >= 1e3 ? `${Math.round(n / 1e3)}rb` : String(Math.round(n)));

type ChartMode = 'kategori' | 'harian' | 'dua-minggu' | 'terbesar' | 'kalender' | 'vs-bulan' | 'none';
const CHART_MODES: { id: ChartMode; label: string; hint: string }[] = [
  { id: 'kategori', label: 'Kategori', hint: 'Per kategori, dibanding anggaran' },
  { id: 'harian', label: 'Batang harian', hint: 'Pengeluaran tiap hari bulan ini' },
  { id: 'dua-minggu', label: 'Dua minggu', hint: '14 hari terakhir' },
  { id: 'terbesar', label: 'Hari terbesar', hint: '5 hari paling boros' },
  { id: 'kalender', label: 'Kalender', hint: 'Peta panas sebulan' },
  { id: 'vs-bulan', label: 'vs bulan lalu', hint: 'Akumulasi dibanding bulan lalu' },
  { id: 'none', label: 'Tanpa grafik', hint: 'Cukup ringkasannya' },
];
const CHART_KEY = 'leo-home-chart:v1';
const HIDE_KEY = 'leo-home-hide:v1';
const readLS = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export default function MonthlyDashboard() {
  const { openModal } = useModal();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [itemsValue, setItemsValue] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [ask, setAsk] = useState('');
  const [hidden, setHidden] = useState(() => (typeof window === 'undefined' ? false : readLS(HIDE_KEY) === '1'));
  const [chart, setChart] = useState<ChartMode>(() => {
    const v = typeof window === 'undefined' ? null : readLS(CHART_KEY);
    return CHART_MODES.some((m) => m.id === v) ? (v as ChartMode) : 'kategori';
  });

  useEffect(() => {
    const loadAccounts = () => accountService.getUserAccounts('session').then(setAccounts).catch(console.error);
    loadAccounts();
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
    return subscribeToCollectionChanges('accounts', loadAccounts);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      setLoading(true);
      Promise.all([transactionService.getUserTransactions('session'), investmentService.getUserInvestments('session'), savingsService.getUserSavings('session')])
        .then(([t, i, s]) => {
          if (!active) return;
          setAllTransactions(t);
          setInvestments(i);
          setSavings(s);
        })
        .catch((err) => console.error('Gagal memuat ringkasan:', err))
        .finally(() => active && setLoading(false));
    };
    load();
    const u = ['transactions', 'investments', 'savings'].map((c) => subscribeToCollectionChanges(c, load));
    return () => {
      active = false;
      u.forEach((f) => f());
    };
  }, []);

  useEffect(() => {
    const load = () => budgetService.getUserBudgets('session').then(setBudgets).catch(() => setBudgets([]));
    load();
    return subscribeToCollectionChanges('budgets', load);
  }, []);

  useEffect(() => {
    cloudflareApi<{ user?: { id?: string; name?: string } | null }>('/api/auth/me')
      .then((r) => {
        setFirstName(r.user?.name?.trim().split(/\s+/)[0] ?? '');
        if (r.user?.id) recurringService.getUserRecurring(r.user.id).then(setRecurring).catch(() => {});
      })
      .catch(() => {});
    const load = () => itemService.list().then((l) => setItemsValue(l.reduce((s, i) => s + (Number(i.current_value) || 0), 0))).catch(() => setItemsValue(0));
    load();
    return subscribeToCollectionChanges('items', load);
  }, []);

  // ===== Angka bulan berjalan
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(now);
  const prevMonthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(y, m - 1, 1));
  const txs = useMemo(() => allTransactions.filter((t) => t.type !== 'debt'), [allTransactions]);
  const monthTx = txs.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; });
  const monthSpend = monthTx.filter(isSpend).reduce((s, t) => s + toIdr(t), 0);
  const totalPemasukan = monthTx.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);
  const totalPengeluaran = monthTx.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + toIdr(t), 0);
  const todayOut = txs.filter((t) => !isIncomingTransaction(t) && t.type === 'pengeluaran' && sameDay(new Date(t.date), now));
  const todayOutTotal = todayOut.reduce((s, t) => s + toIdr(t), 0);

  // Bulan lalu sampai tanggal yang sama (adil: hari ke-13 vs hari ke-13).
  const prevSpendSameDay = txs
    .filter((t) => { const d = new Date(t.date); const p = new Date(y, m - 1, 1); return isSpend(t) && d.getFullYear() === p.getFullYear() && d.getMonth() === p.getMonth() && d.getDate() <= today; })
    .reduce((s, t) => s + toIdr(t), 0);
  const vsPrev = monthSpend - prevSpendSameDay;

  // Anggaran bulanan (tahunan dibagi 12) per kategori pengeluaran.
  const budgetByCat = useMemo(() => {
    const map = new Map<string, number>();
    budgets.filter((b) => b.type === 'pengeluaran').forEach((b) => map.set(b.category, (map.get(b.category) ?? 0) + (b.period === 'yearly' ? (Number(b.amount) || 0) / 12 : Number(b.amount) || 0)));
    return map;
  }, [budgets]);
  const budgetTotal = [...budgetByCat.values()].reduce((s, v) => s + v, 0);
  const spendByCat = new Map<string, number>();
  monthTx.filter(isSpend).forEach((t) => spendByCat.set(t.category || 'Lainnya', (spendByCat.get(t.category || 'Lainnya') ?? 0) + toIdr(t)));
  const budgetedSpent = [...spendByCat.entries()].filter(([c]) => budgetByCat.has(c)).reduce((s, [, v]) => s + v, 0);
  const outsideBudget = budgetTotal > 0 ? monthSpend - budgetedSpent : 0;
  const budgetLeft = budgetTotal - budgetedSpent;
  const daysLeft = daysInMonth - today + 1;
  const perDay = budgetLeft > 0 ? budgetLeft / daysLeft : 0;

  // Langganan yang jatuh tempo 7 hari ke depan (chip → halaman Langganan).
  const weekBills = recurring.filter((r) => {
    const d = Math.round((new Date(r.nextDate).setHours(0, 0, 0, 0) - new Date(y, m, today).getTime()) / 864e5);
    return r.status === 'ACTIVE' && r.type === 'Pengeluaran' && d >= 0 && d <= 7;
  }).length;

  // ===== Angka "Fitur kamu" (aturan sama dengan halaman Kekayaan)
  const totalTabungan = savings.reduce((s, i) => { const a = Number(i.amountIDR) || i.amount; return i.transactionType === 'Penarikan' ? s - a : s + a; }, 0);
  const unpaidDebts = allTransactions.filter((t) => t.type === 'debt' && t.paymentStatus !== 'lunas');
  const creditIds = new Set(accounts.filter((a) => isCreditAccountType(a.type)).map((a) => a.id));
  const creditCardBills =
    accounts.filter((a) => isCreditAccountType(a.type)).reduce((s, a) => s + exchangeRateService.convert(computeCreditUsage(a).used, a.currency || 'IDR', 'IDR', fxRates), 0) +
    unpaidDebts.filter((t) => t.category === 'Hutang' && t.subCategory === 'Kartu Kredit' && (!t.accountId || !creditIds.has(t.accountId))).reduce((s, t) => s + toIdr(t), 0);
  const otherDebts = unpaidDebts.filter((t) => t.category === 'Hutang' && t.subCategory !== 'Kartu Kredit').reduce((s, t) => s + toIdr(t), 0);
  const piutang = unpaidDebts.filter((t) => t.category === 'Piutang').reduce((s, t) => s + toIdr(t), 0);
  const rekeningAset = accounts.filter((a) => !isCreditAccountType(a.type)).reduce((s, a) => s + exchangeRateService.convert(a.balance || 0, a.currency || 'IDR', 'IDR', fxRates), 0);
  const investasiNilai = investments.filter((i) => i.status === 'Active').reduce((s, i) => s + (Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0), 0);
  const net = totalPemasukan - totalPengeluaran;
  const featureBase: Partial<Record<FeatureId, TileStat>> = {
    kekayaan: { value: formatIDR(rekeningAset + totalTabungan + investasiNilai + piutang + itemsValue - creditCardBills - otherDebts), sub: 'Kekayaan bersih' },
    cuan: { value: formatIDR(monthTx.filter((t) => t.type === 'pemasukan' && !/gaji|salary/i.test(t.category || '')).reduce((s, t) => s + toIdr(t), 0)), sub: 'Cuan bulan ini (di luar gaji)' },
    arus: { value: `${net >= 0 ? '+' : '−'}${formatIDR(Math.abs(net))}`, sub: `Masuk ${formatIDR(totalPemasukan)} · keluar ${formatIDR(totalPengeluaran)}` },
    kartu: { value: formatIDR(creditCardBills), sub: creditCardBills > 0 ? 'Tagihan terpakai' : 'Tidak ada tagihan' },
  };

  const recent = [...txs].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6);
  const firstLoad = loading && allTransactions.length === 0;
  const hour = now.getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const mask = (s: string) => (hidden ? 'Rp•••••' : s);
  // Komentar Leo di samping angka besar.
  const leo: { mood: LeoMood; text: string } =
    budgetTotal > 0 && budgetLeft < 0
      ? { mood: 'sad', text: 'Anggaran bulan ini sudah terlewati. Rem dikit ya 🙏' }
      : todayOut.length === 0
        ? { mood: 'idle', text: 'Belum ada catatan hari ini. Scan struk atau bilang saja ke aku!' }
        : prevSpendSameDay > 0 && vsPrev > prevSpendSameDay * 0.2
          ? { mood: 'idle', text: `Bulan ini agak ngebut dibanding ${prevMonthName} 👀` }
          : { mood: 'happy', text: `Mantap! ${todayOut.length} catatan hari ini, keuanganmu on track ✨` };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* 1. Hero: satu angka besar + tanya Leo + chip penting */}
      <AuthScene className="auth-hero rounded-[28px] shadow-xl shadow-indigo-950/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/50 via-slate-950/20 to-transparent" aria-hidden />
        <div className="relative flex gap-6 p-6 text-white md:p-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize text-white/75">{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight drop-shadow-sm md:text-[28px]">{greet}{firstName ? `, ${firstName}` : ''}.</h2>
            <p className="mt-1 text-[15px] text-white/85">
              {todayOut.length > 0 ? (
                <>Hari ini <b className="text-white">{mask(formatIDR(todayOutTotal))}</b> keluar lewat {todayOut.length} pembayaran.</>
              ) : (
                'Belum ada pengeluaran tercatat hari ini.'
              )}
            </p>

            <div className="mt-6 flex items-center gap-3">
              {firstLoad ? (
                <span className="block h-14 w-72 animate-pulse rounded-2xl bg-white/20" />
              ) : (
                <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums drop-shadow-sm md:text-[56px]">
                  {hidden ? 'Rp•••••' : <AnimatedNumber value={monthSpend} format={formatIDR} />}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setHidden((h) => { writeLS(HIDE_KEY, h ? '0' : '1'); return !h; }); }}
                aria-label={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
                className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-white/80">Pengeluaran {monthName} · hari ke-{today}</p>

            <form
              onSubmit={(e) => { e.preventDefault(); const q = ask.trim(); openModal('ai_chat', q ? { prompt: q } : null); setAsk(''); }}
              className="mt-6 flex max-w-xl items-center gap-2 rounded-full bg-white py-1.5 pl-5 pr-1.5 shadow-lg shadow-indigo-950/20"
            >
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Tanya apa saja soal uangmu…"
                aria-label="Tanya Leo"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Kirim pertanyaan" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-700">
                <ArrowUp size={17} />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {weekBills > 0 && (
                <Chip href="/membership/langganan" dot="bg-amber-400">{weekBills} tagihan minggu ini</Chip>
              )}
              {prevSpendSameDay > 0 && Math.abs(vsPrev) >= 1000 && (
                <Chip href="/membership/laporan" dot={vsPrev > 0 ? 'bg-rose-400' : 'bg-emerald-400'}>
                  {mask(formatIDR(Math.abs(vsPrev)))} {vsPrev > 0 ? 'lebih banyak' : 'lebih hemat'} dari {prevMonthName}
                </Chip>
              )}
              {budgetTotal > 0 ? (
                <Chip href="/membership/budget" dot={budgetLeft < 0 ? 'bg-rose-400' : 'bg-indigo-300'}>
                  {budgetLeft < 0 ? `Lewat anggaran ${mask(formatIDR(-budgetLeft))}` : `Sisa anggaran ${mask(formatIDR(budgetLeft))}`}
                </Chip>
              ) : (
                <Chip href="/membership/budget" dot="bg-white/60">Atur anggaran</Chip>
              )}
            </div>
          </div>

          <div className="hidden items-end gap-2 self-end lg:flex">
            <div className="mb-20 max-w-[220px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-[13px] font-semibold leading-snug text-slate-700 shadow-lg">{leo.text}</div>
            <LeoMascot mood={leo.mood} size={130} interactive className="shrink-0" />
          </div>
        </div>
      </AuthScene>

      <SecurityNudge />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Kiri */}
        <div className="min-w-0 space-y-5">
          <section className={cn(card, 'p-5 md:p-6')}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Ke mana uangmu</h2>
              <ChartPicker value={chart} onChange={(v) => { setChart(v); writeLS(CHART_KEY, v); }} />
            </div>

            {firstLoad ? (
              <div className="mt-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={chart} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <WhereChart mode={chart} monthTx={monthTx} txs={txs} spendByCat={spendByCat} budgetByCat={budgetByCat} now={now} hidden={hidden} />
                </motion.div>
              </AnimatePresence>
            )}

            <div className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-500">
              {budgetTotal > 0 ? (
                <>
                  <p>
                    {budgetLeft >= 0 ? (
                      <>Sisa anggaran <b className="text-slate-800">{mask(formatIDR(budgetLeft))}</b> · {mask(formatIDR(perDay))}/hari untuk {daysLeft} hari</>
                    ) : (
                      <>Anggaran terlewati <b className="text-rose-600">{mask(formatIDR(-budgetLeft))}</b></>
                    )}
                  </p>
                  {outsideBudget > 0 && <p><b className="text-slate-700">{mask(formatIDR(outsideBudget))}</b> di luar anggaran</p>}
                </>
              ) : (
                <Link href="/membership/budget" className="font-bold text-indigo-600 hover:underline">Atur anggaran supaya kelihatan sisa per harinya →</Link>
              )}
            </div>
          </section>

          <section className={card}>
            <div className="flex items-center justify-between px-5 pb-1 pt-5 md:px-6">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Terbaru</h2>
              <Link href="/membership/transactions/daily" className="flex items-center gap-0.5 text-sm font-bold text-indigo-600 hover:underline">
                Lihat semua <ChevronRight size={15} />
              </Link>
            </div>
            {firstLoad ? (
              <div className="space-y-2 p-5 pt-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : recent.length === 0 ? (
              <div className="p-5 pt-2">
                <EmptyState title="Belum ada transaksi" description="Coba scan struk atau catat pakai suara dari tombol di atas." icon={<LayoutDashboard size={24} />} />
              </div>
            ) : (
              <ul className="pb-2">
                {recent.map((t, i) => {
                  const inc = isIncomingTransaction(t);
                  const d = new Date(t.date);
                  return (
                    <motion.li key={t.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Link href={`/membership/transactions/daily?date=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50 md:px-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">{categoryEmoji(t.category)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">{t.note || t.category}</p>
                          <p className="truncate text-xs text-slate-400">
                            {sameDay(d, now) ? 'Hari ini' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)} · {t.category}
                          </p>
                        </div>
                        <p className={cn('whitespace-nowrap text-sm font-extrabold tabular-nums', inc ? 'text-emerald-600' : 'text-slate-800')}>
                          {inc ? '+' : '−'}{mask(formatIDR(toIdr(t)))}
                        </p>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Kanan */}
        <div className="min-w-0 space-y-5">
          <CloseDayCard transactions={allTransactions} accounts={accounts} />
          <FeatureTiles base={featureBase} limit={6} narrow />
        </div>
      </div>
    </div>
  );
}

function Chip({ href, dot, children }: { href: string; dot: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/25">
      <span className={cn('h-2 w-2 rounded-full', dot)} /> {children}
    </Link>
  );
}

function ChartPicker({ value, onChange }: { value: ChartMode; onChange: (v: ChartMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Ganti grafik" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900">
        <SlidersHorizontal size={14} /> {CHART_MODES.find((c) => c.id === value)?.label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200"
            role="menu"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-bold text-slate-400">Grafik beranda</p>
            {CHART_MODES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={value === c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50', value === c.id && 'bg-indigo-50/60')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{c.label}</span>
                  <span className="block truncate text-xs text-slate-400">{c.hint}</span>
                </span>
                {value === c.id && <Check size={16} className="shrink-0 text-indigo-600" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WhereChart({ mode, monthTx, txs, spendByCat, budgetByCat, now, hidden }: {
  mode: ChartMode;
  monthTx: Transaction[];
  txs: Transaction[];
  spendByCat: Map<string, number>;
  budgetByCat: Map<string, number>;
  now: Date;
  hidden: boolean;
}) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const money = (n: number) => (hidden ? '•••' : formatIDR(n));

  // Total pengeluaran per hari (semua waktu, kunci tanggal lokal).
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    txs.filter(isSpend).forEach((t) => { const k = dayKey(new Date(t.date)); map.set(k, (map.get(k) ?? 0) + toIdr(t)); });
    return map;
  }, [txs]);
  const dayHref = (d: Date) => `/membership/transactions/daily?date=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (mode === 'none') return null;
  const empty = <p className="mt-6 py-6 text-center text-sm text-slate-400">Belum ada pengeluaran bulan ini.</p>;
  const hasSpend = monthTx.some(isSpend);

  if (mode === 'kategori') {
    const rows = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!rows.length) return empty;
    const max = Math.max(...rows.map(([c, v]) => Math.max(v, budgetByCat.get(c) ?? 0)));
    return (
      <ul className="mt-4 space-y-3.5">
        {rows.map(([cat, v], i) => {
          const cap = budgetByCat.get(cat);
          const over = cap != null && v > cap;
          return (
            <li key={cat}>
              <Link href={`/membership/transactions/daily?category=${encodeURIComponent(cat)}&period=bulan`} className="group block">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                    <span>{categoryEmoji(cat)}</span><span className="truncate group-hover:text-slate-900">{cat}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <b className={over ? 'text-rose-600' : 'text-slate-800'}>{money(v)}</b>
                    {cap != null && <span className="text-xs text-slate-400"> / {money(cap)}</span>}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
                  {cap != null && <div className="absolute inset-y-0 left-0 rounded-full bg-slate-200" style={{ width: `${(cap / max) * 100}%` }} />}
                  <motion.div
                    className={cn('absolute inset-y-0 left-0 rounded-full', over ? 'bg-rose-500' : 'bg-indigo-500')}
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / max) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  if (mode === 'harian' || mode === 'dua-minggu') {
    const days = mode === 'harian'
      ? Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1))
      : Array.from({ length: 14 }, (_, i) => new Date(y, m, now.getDate() - 13 + i));
    const vals = days.map((d) => perDay.get(dayKey(d)) ?? 0);
    const max = Math.max(1, ...vals);
    if (!vals.some(Boolean)) return empty;
    return (
      <div className="mt-5">
        <div className="flex h-40 items-end gap-[3px]">
          {days.map((d, i) => {
            const future = d > now && !sameDay(d, now);
            return (
              <Link key={i} href={dayHref(d)} title={`${d.getDate()}/${d.getMonth() + 1} · ${money(vals[i])}`} className="group flex h-full flex-1 items-end">
                <motion.span
                  className={cn('w-full rounded-t-md', sameDay(d, now) ? 'bg-indigo-600' : future ? 'bg-slate-100' : 'bg-indigo-300 group-hover:bg-indigo-500')}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(future ? 2 : 3, (vals[i] / max) * 100)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.012 }}
                />
              </Link>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span>{days[0].getDate()}/{days[0].getMonth() + 1}</span>
          <span>Puncak {money(max)}</span>
          <span>{days[days.length - 1].getDate()}/{days[days.length - 1].getMonth() + 1}</span>
        </div>
      </div>
    );
  }

  if (mode === 'terbesar') {
    const rows = Array.from({ length: now.getDate() }, (_, i) => new Date(y, m, i + 1))
      .map((d) => ({ d, v: perDay.get(dayKey(d)) ?? 0 }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
    if (!rows.length) return empty;
    return (
      <ul className="mt-4 space-y-1">
        {rows.map((r, i) => (
          <li key={i}>
            <Link href={dayHref(r.d)} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-600">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold capitalize text-slate-700">{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(r.d)}</span>
              <span className="text-sm font-extrabold text-slate-800 tabular-nums">{money(r.v)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (mode === 'kalender') {
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Senin dulu
    const vals = Array.from({ length: daysInMonth }, (_, i) => perDay.get(dayKey(new Date(y, m, i + 1))) ?? 0);
    const max = Math.max(1, ...vals);
    const tone = (v: number) => (v === 0 ? 'bg-slate-50 text-slate-400' : v / max > 0.66 ? 'bg-indigo-600 text-white' : v / max > 0.33 ? 'bg-indigo-300 text-indigo-950' : 'bg-indigo-100 text-indigo-900');
    return (
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
          {vals.map((v, i) => {
            const d = new Date(y, m, i + 1);
            return (
              <Link key={i} href={dayHref(d)} title={money(v)} className={cn('flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-transform hover:scale-105', tone(v), sameDay(d, now) && 'ring-2 ring-slate-900')}>
                {i + 1}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // vs bulan lalu — akumulasi harian
  if (!hasSpend) return empty;
  const prevDays = new Date(y, m, 0).getDate();
  const cum = (mm: number, upto: number) => Array.from({ length: upto }, (_, i) => perDay.get(dayKey(new Date(y, mm, i + 1))) ?? 0).reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
  const thisCum = cum(m, now.getDate());
  const prevCum = cum(m - 1, prevDays);
  const data = Array.from({ length: Math.max(daysInMonth, prevDays) }, (_, i) => ({ day: i + 1, ini: thisCum[i] ?? null, lalu: prevCum[i] ?? null }));
  return (
    <div className="mt-4 h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval={6} />
          <Tooltip formatter={(v) => (hidden ? '•••' : short(Number(v)))} labelFormatter={(d) => `Hari ke-${d}`} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Area type="monotone" dataKey="lalu" name="Bulan lalu" stroke="#cbd5e1" strokeDasharray="4 4" fill="#f1f5f9" />
          <Area type="monotone" dataKey="ini" name="Bulan ini" stroke="#4f46e5" strokeWidth={2.5} fill="#e0e7ff" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
