"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, ChevronRight, Coins, CreditCard, Eye, EyeOff, Gem, HandCoins, Landmark, Package, PiggyBank, Plus, Sparkle, TrendingUp, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { useModal, type ModalType } from '@/context/ModalContext';
import { accountService, type Account } from '@/lib/services/accountService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { savingsGoalService, type SavingsGoal } from '@/lib/services/savingsGoalService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { itemService, type Item } from '@/lib/services/itemService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { computeCreditUsage, getCardCycle, isCreditAccountType } from '@/lib/creditCard';
import { isInvestmentCategory } from '@/lib/categoryEmoji';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';

// Kekayaan (pola Oyenza): satu angka kekayaan bersih + semua yang kamu punya
// dan kamu utang dalam satu halaman — kartu kredit, dompet, tabungan,
// investasi, barang & aset, piutang, utang. Tabungan, Investasi, dan
// Hutang & piutang tidak lagi jadi menu sendiri; halaman lengkapnya dibuka
// lewat "Lihat semua" di bagiannya. Baca saja (menambah lewat menu Tambah).
//
// Grafik: Leosiqra tidak menyimpan riwayat kekayaan, jadi titik-titik
// sebelumnya dihitung mundur dari arus kas (pemasukan − pengeluaran, tanpa
// pembelian investasi/tabungan yang cuma memindah uang) — perkiraan.

type Range = '1B' | '3B' | '1T' | 'Semua';
const RANGE_DAYS: Record<Range, number> = { '1B': 30, '3B': 90, '1T': 365, Semua: 3650 };
const card = 'rounded-[22px] bg-slate-100/70';
const ADD: { label: string; modal?: ModalType; href?: string; icon: React.ReactNode }[] = [
  { label: 'Tambah akun', modal: 'rekening', icon: <Landmark size={16} /> },
  { label: 'Tambah kartu kredit', modal: 'kartu', icon: <CreditCard size={16} /> },
  { label: 'Setor tabungan', modal: 'tabungan', icon: <PiggyBank size={16} /> },
  { label: 'Tambah saham & reksa dana', modal: 'saham', icon: <TrendingUp size={16} /> },
  { label: 'Tambah deposito', modal: 'deposito', icon: <Landmark size={16} /> },
  { label: 'Tambah emas, kripto, lainnya', modal: 'investasi_lain', icon: <Coins size={16} /> },
  { label: 'Tambah barang / kendaraan', href: '/membership/barang', icon: <Package size={16} /> },
  { label: 'Tambah koleksi', href: '/membership/koleksi', icon: <Sparkle size={16} /> },
  { label: 'Piutang / utang', modal: 'hutang_piutang', icon: <HandCoins size={16} /> },
  { label: 'Transfer', modal: 'topup_transfer', icon: <ArrowUp size={16} className="rotate-45" /> },
];

export default function KekayaanPage() {
  const { openModal } = useModal();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [hidden, setHidden] = useState(false);
  const [range, setRange] = useState<Range>('1B');
  const [addOpen, setAddOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const [goldGram, setGoldGram] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      Promise.all([
        accountService.getUserAccounts('session'),
        savingsService.getUserSavings('session'),
        investmentService.getUserInvestments('session'),
        transactionService.getUserTransactions('session'),
      ])
        .then(([a, s, i, t]) => {
          setAccounts(a);
          setSavings(s);
          setInvestments(i);
          setTransactions(t);
        })
        .catch(() => setAccounts([]));
    const loadItems = () => itemService.list().then(setItems).catch(() => setItems([]));
    const loadGoals = () => savingsGoalService.getUserSavingsGoals().then(setGoals).catch(() => setGoals([]));
    load();
    loadItems();
    loadGoals();
    exchangeRateService.getLatestRates().then(setFx).catch(() => {});
    // Harga emas per gram (dari data pasar) untuk menilai emas dengan harga hari ini.
    cloudflareApi<{ feed: { goldGramIdr: number | null } | null }>('/api/member/pasar').then((r) => setGoldGram(r.feed?.goldGramIdr ?? null)).catch(() => {});
    const unsubs = [
      ...['accounts', 'savings', 'investments', 'transactions'].map((c) => subscribeToCollectionChanges(c, load)),
      subscribeToCollectionChanges('items', loadItems),
      subscribeToCollectionChanges('recurring', loadGoals),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const toIdr = (amount: number, currency?: string) => exchangeRateService.convert(amount || 0, currency || 'IDR', 'IDR', fx);
  const idrOf = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;

  const w = useMemo(() => {
    const accs = accounts ?? [];
    const cash = accs.filter((a) => !isCreditAccountType(a.type));
    const credit = accs.filter((a) => isCreditAccountType(a.type));
    const creditIds = new Set(credit.map((a) => a.id));
    const kas = cash.reduce((s, a) => s + toIdr(a.balance, a.currency), 0);
    const tabungan = savings.reduce((s, it) => s + (it.transactionType === 'Penarikan' ? -1 : 1) * (Number(it.amountIDR) || it.amount), 0);
    const activeInv = investments.filter((i) => i.status === 'Active');
    const isGoldGram = (i: Investment) => /emas|gold|antam|logam mulia/i.test(i.name) && /^(g|gr|gram)$/i.test((i.unit ?? '').trim()) && Number(i.quantity) > 0;
    const invValue = (i: Investment) => (goldGram && isGoldGram(i) ? Number(i.quantity) * goldGram : Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0);
    const investasi = activeInv.reduce((s, i) => s + invValue(i), 0);
    const unpaid = transactions.filter((t) => t.type === 'debt' && t.paymentStatus !== 'lunas');
    const piutangList = unpaid.filter((t) => t.category === 'Piutang');
    const hutangList = unpaid.filter((t) => t.category === 'Hutang' && !(t.subCategory === 'Kartu Kredit' && t.accountId && creditIds.has(t.accountId)));
    const piutang = piutangList.reduce((s, t) => s + idrOf(t), 0);
    const kartu = credit.reduce((s, a) => s + toIdr(computeCreditUsage(a).used, a.currency), 0);
    const hutang = hutangList.reduce((s, t) => s + idrOf(t), 0);
    const barang = items.reduce((s, i) => s + (Number(i.current_value) || 0), 0);
    const aset = kas + tabungan + investasi + piutang + barang;
    const kewajiban = kartu + hutang;
    return { cash, credit, kas, tabungan, activeInv, invValue, investasi, piutangList, hutangList, piutang, kartu, hutang, barang, aset, kewajiban, bersih: aset - kewajiban };
    // toIdr bergantung pada fx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, savings, investments, transactions, items, fx, goldGram]);

  // Riwayat perkiraan: mundur dari hari ini memakai arus kas harian.
  const series = useMemo(() => {
    const days = Math.min(RANGE_DAYS[range], 3650);
    const flowByDay = new Map<string, number>();
    let earliest = nowMs;
    for (const t of transactions) {
      if (t.type !== 'pemasukan' && t.type !== 'pengeluaran') continue;
      if (t.type === 'pengeluaran' && (isInvestmentCategory(t.category) || /tabungan/i.test(t.category || ''))) continue;
      const d = new Date(t.date);
      earliest = Math.min(earliest, +d);
      const k = d.toISOString().slice(0, 10);
      flowByDay.set(k, (flowByDay.get(k) ?? 0) + (t.type === 'pemasukan' ? idrOf(t) : -idrOf(t)));
    }
    const span = range === 'Semua' ? Math.max(30, Math.ceil((nowMs - earliest) / 864e5)) : days;
    const out: { day: string; value: number }[] = [];
    let v = w.bersih;
    for (let i = 0; i <= span; i++) {
      const d = new Date(nowMs - i * 864e5).toISOString().slice(0, 10);
      out.push({ day: d, value: v });
      v -= flowByDay.get(d) ?? 0;
    }
    return out.reverse();
  }, [transactions, w.bersih, range, nowMs]);
  const delta30 = (() => {
    const flow = transactions
      .filter((t) => (t.type === 'pemasukan' || (t.type === 'pengeluaran' && !isInvestmentCategory(t.category) && !/tabungan/i.test(t.category || ''))) && +new Date(t.date) >= nowMs - 30 * 864e5)
      .reduce((s, t) => s + (t.type === 'pemasukan' ? idrOf(t) : -idrOf(t)), 0);
    return flow;
  })();

  const loading = accounts === null;
  const money = (n: number) => (hidden ? 'Rp ••••••' : formatIDR(n));
  const comp = [
    { label: 'Kas', value: w.kas, color: 'bg-sky-500' },
    { label: 'Tabungan', value: w.tabungan, color: 'bg-indigo-500' },
    { label: 'Investasi', value: w.investasi, color: 'bg-violet-500' },
    { label: 'Barang & aset', value: w.barang, color: 'bg-orange-500' },
    { label: 'Piutang', value: w.piutang, color: 'bg-fuchsia-400' },
  ].filter((c) => c.value > 0);
  const compTotal = comp.reduce((s, c) => s + c.value, 0) || 1;
  const missing = [
    w.tabungan <= 0 && { label: 'Tabungan', sub: 'Dana darurat, target, celengan', icon: <PiggyBank size={18} />, tone: 'bg-indigo-50 text-indigo-600', go: () => openModal('tabungan') },
    !w.activeInv.some((i) => /emas|gold|antam/i.test(i.name)) && { label: 'Emas', sub: goldGram ? `Per gram, harga hari ini ±${formatIDR(goldGram)}` : 'Per gram, dinilai harga hari ini', icon: <Coins size={18} />, tone: 'bg-amber-50 text-amber-600', go: () => openModal('investasi_lain') },
    !w.activeInv.some((i) => /bpjs|jht|dplk|pensiun|taspen/i.test(i.name)) && { label: 'Pensiun', sub: 'BPJS JHT, DPLK, Taspen — catat saldonya', icon: <Landmark size={18} />, tone: 'bg-teal-50 text-teal-600', go: () => openModal('investasi_lain') },
    w.activeInv.length === 0 && { label: 'Investasi', sub: 'Saham, reksa dana, deposito, emas, kripto', icon: <TrendingUp size={18} />, tone: 'bg-violet-50 text-violet-600', go: () => openModal('saham') },
    !items.some((i) => i.kind === 'barang') && { label: 'Barang', sub: 'HP, laptop, motor, jam tangan', icon: <Package size={18} />, tone: 'bg-rose-50 text-rose-500', go: () => router.push('/membership/barang') },
    !items.some((i) => i.kind === 'koleksi') && { label: 'Koleksi', sub: 'Kartu, sneakers, barang mewah', icon: <Sparkle size={18} />, tone: 'bg-lime-50 text-lime-600', go: () => router.push('/membership/koleksi') },
    w.piutangList.length === 0 && w.hutangList.length === 0 && { label: 'Piutang & utang', sub: 'Pinjaman dan uang yang dipinjamkan', icon: <HandCoins size={18} />, tone: 'bg-amber-50 text-amber-600', go: () => openModal('hutang_piutang') },
  ].filter(Boolean) as { label: string; sub: string; icon: React.ReactNode; tone: string; go: () => void }[];

  const Section = ({ title, total, href, children, negative }: { title: string; total: number; href?: string; children: React.ReactNode; negative?: boolean }) => (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <span className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold tabular-nums', negative ? 'text-rose-600' : 'text-slate-600')}>{negative && total > 0 ? '-' : ''}{money(total)}</span>
          {href && <Link href={href} className="text-sm font-bold text-slate-900 hover:underline">Lihat semua</Link>}
        </span>
      </div>
      <ul className={cn(card, 'overflow-hidden')}>{children}</ul>
    </section>
  );
  const Row = ({ icon, title, sub, value, negative, onClick }: { icon: React.ReactNode; title: string; sub: React.ReactNode; value: number; negative?: boolean; onClick?: () => void }) => (
    <li className="border-b border-slate-200/60 last:border-0">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-200/40">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{sub}</span>
        </span>
        <span className={cn('text-[15px] font-bold tabular-nums', negative ? 'text-rose-600' : 'text-slate-900')}>{negative ? '-' : ''}{money(Math.abs(value))}</span>
        <ChevronRight size={16} className="text-slate-400" />
      </button>
    </li>
  );
  const Emoji = ({ e, tone = 'bg-slate-200/70' }: { e: string; tone?: string }) => <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg', tone)}>{e}</span>;
  const fmtDue = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <h1 className="sr-only">Kekayaan</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-7">
          {/* Angka utama */}
          <div>
            <p className="text-sm text-slate-500">Kekayaan bersih</p>
            {loading ? <Skeleton className="mt-2 h-12 w-72" /> : (
              <p className={cn('mt-1 flex items-start gap-1 leading-none', w.bersih < 0 ? 'text-rose-600' : 'text-slate-900')}>
                <span className="mt-1.5 text-lg font-bold text-slate-400">Rp</span>
                <span className="text-[48px] font-extrabold tracking-tight tabular-nums">{hidden ? '••••••' : <AnimatedNumber value={w.bersih} format={(n) => Math.round(n).toLocaleString('id-ID')} />}</span>
                <button type="button" onClick={() => setHidden((v) => !v)} aria-label={hidden ? 'Tampilkan' : 'Sembunyikan'} className="ml-1 mt-4 rounded-full p-1 text-slate-400 hover:text-slate-700">{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </p>
            )}
            {!loading && delta30 !== 0 && (
              <span className={cn('mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium', delta30 < 0 ? 'text-slate-800' : 'text-slate-800')}>
                {delta30 < 0 ? <ArrowDown size={15} className="text-rose-500" /> : <ArrowUp size={15} className="text-emerald-600" />}
                {delta30 < 0 ? 'Turun' : 'Naik'} {hidden ? '••' : formatIDR(Math.abs(delta30))} dalam 30 hari
              </span>
            )}
            <div className="mt-5 h-44">
              {!hidden && series.length > 2 && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={series[series.length - 1].value >= series[0].value ? '#10b981' : '#ef4444'} stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip formatter={(v) => formatIDR(Number(v))} labelFormatter={(d) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(d)))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke={series[series.length - 1].value >= series[0].value ? '#10b981' : '#ef4444'} strokeWidth={2} fill="url(#nwg)" isAnimationActive={!reduce} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {series.length > 2 && <div className="flex justify-between text-[11px] text-slate-400"><span>{fmtDue(new Date(series[0].day))}</span><span>perkiraan dari arus kas</span><span>{fmtDue(new Date(series[series.length - 1].day))}</span></div>}
            <LayoutGroup id="nw-range">
              <div className="mt-3 flex rounded-full bg-slate-100 p-1">
                {(['1B', '3B', '1T', 'Semua'] as Range[]).map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)} className={cn('relative flex-1 rounded-full py-2 text-sm font-medium', range === r ? 'text-slate-900' : 'text-slate-500')}>
                    {range === r && <motion.span layoutId="nw-range-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" />}
                    <span className="relative">{r}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
          </div>

          {loading ? <Skeleton className="h-80 rounded-3xl" /> : (
            <>
              {w.credit.length > 0 && (
                <Section title="Kartu kredit" total={w.kartu} negative href="/membership/rekening?panel=kartu">
                  {w.credit.map((a) => {
                    const used = toIdr(computeCreditUsage(a).used, a.currency);
                    const cyc = getCardCycle(a, transactions);
                    return <Row key={a.id} icon={<AccountLogo acc={a} size={40} />} title={`${a.name}${a.last4 ? ` ••${a.last4}` : ''}`} sub={cyc && cyc.amountDue > 0 ? `Tagihan ${formatIDR(cyc.amountDue)} · jatuh tempo ${fmtDue(new Date(`${cyc.dueDate}T00:00:00`))}` : used > 0 ? 'Terpakai' : 'Lunas'} value={used} negative={used > 0} onClick={() => router.push('/membership/rekening?panel=kartu')} />;
                  })}
                </Section>
              )}

              <Section title="Dompet" total={w.kas} href="/membership/rekening">
                {w.cash.length === 0 ? <li className="px-4 py-4 text-sm text-slate-500">Belum ada dompet.</li> : w.cash.map((a) => (
                  <Row key={a.id} icon={<AccountLogo acc={a} size={40} />} title={a.name} sub={a.type === 'Cash' ? 'Tunai' : a.type === 'E-Wallet' ? 'E-wallet' : a.type === 'Bank Account' ? 'Bank' : a.type} value={toIdr(a.balance, a.currency)} negative={a.balance < 0} onClick={() => router.push('/membership/rekening')} />
                ))}
              </Section>

              {(w.tabungan > 0 || goals.length > 0) && (
                <Section title="Tabungan" total={w.tabungan} href="/membership/tabungan">
                  {goals.length ? goals.map((g) => (
                    <Row key={g.id} icon={<Emoji e="🐷" tone="bg-indigo-50" />} title={g.name} sub={g.targetAmount ? `${Math.round(g.progressPercent ?? 0)}% dari ${formatIDR(g.targetAmount)}` : g.category} value={g.currentTotal} onClick={() => router.push('/membership/tabungan')} />
                  )) : <Row icon={<Emoji e="🐷" tone="bg-indigo-50" />} title="Total setoran" sub={`${savings.length} catatan`} value={w.tabungan} onClick={() => router.push('/membership/tabungan')} />}
                </Section>
              )}

              {w.activeInv.length > 0 && (
                <Section title="Investasi" total={w.investasi} href="/membership/investment">
                  {w.activeInv.map((i) => {
                    const cost = Number(i.amountIDR) || Number(i.amountInvested) || 0;
                    const val = w.invValue(i);
                    const gain = val - cost;
                    return (
                      <Row key={i.id} icon={<Emoji e={i.type === 'Deposito' ? '🏦' : /emas|gold/i.test(i.name) ? '🪙' : /bitcoin|kripto|crypto|eth/i.test(i.name) ? '₿' : '📈'} tone="bg-violet-50" />} title={i.name}
                        sub={<>{i.type}{goldGram && /emas|gold|antam/i.test(i.name) && /^(g|gr|gram)$/i.test((i.unit ?? '').trim()) ? ` · ${i.quantity} g × ${formatIDR(goldGram)}` : ''}{cost > 0 && gain !== 0 && <b className={cn('ml-1', gain > 0 ? 'text-emerald-600' : 'text-rose-600')}>{gain > 0 ? '+' : '−'}{formatIDR(Math.abs(gain))} ({((gain / cost) * 100).toFixed(1)}%)</b>}</>}
                        value={val} onClick={() => router.push('/membership/investment')} />
                    );
                  })}
                </Section>
              )}

              {items.length > 0 && (
                <Section title="Barang & aset" total={w.barang} href="/membership/barang">
                  {items.map((i) => (
                    <Row key={i.id} icon={<Emoji e={i.kind === 'koleksi' ? '✨' : /kendaraan|motor|mobil/i.test(i.category ?? '') ? '🚗' : '📦'} tone="bg-orange-50" />} title={i.name} sub={i.category || (i.kind === 'koleksi' ? 'Koleksi' : 'Barang')} value={Number(i.current_value) || 0} onClick={() => router.push(i.kind === 'koleksi' ? '/membership/koleksi' : '/membership/barang')} />
                  ))}
                </Section>
              )}

              {w.piutangList.length > 0 && (
                <Section title="Piutang" total={w.piutang} href="/membership/transactions/debt">
                  {w.piutangList.map((t) => <Row key={t.id} icon={<Emoji e="🤝" tone="bg-amber-50" />} title={t.lenderName || t.note || 'Piutang'} sub={`Dicatat ${fmtDue(new Date(t.date))}`} value={idrOf(t)} onClick={() => router.push('/membership/transactions/debt')} />)}
                </Section>
              )}

              {w.hutangList.length > 0 && (
                <Section title="Utang" total={w.hutang} negative href="/membership/transactions/debt">
                  {w.hutangList.map((t) => <Row key={t.id} icon={<Emoji e="🧾" tone="bg-rose-50" />} title={t.lenderName || t.note || 'Utang'} sub={t.subCategory || 'Pinjaman'} value={idrOf(t)} negative onClick={() => router.push('/membership/transactions/debt')} />)}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Kanan: komposisi + belum dihitung */}
        <div className="order-first min-w-0 space-y-6 lg:sticky lg:top-24 lg:order-none">
          <div className="flex justify-end">
            <button type="button" onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} /> Tambah</button>
          </div>
          {comp.length > 0 && (
            <div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {comp.map((c, i) => <motion.span key={c.label} className={cn('h-full', c.color)} initial={reduce ? false : { width: 0 }} animate={{ width: `${(c.value / compTotal) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.08 }} />)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {comp.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                    <span className={cn('h-2 w-2 rounded-full', c.color)} /><b className="text-slate-900">{c.label}</b> {hidden ? '••' : formatIDR(c.value).replace(/\s/g, '')} · {Math.round((c.value / compTotal) * 100)}%
                  </span>
                ))}
              </div>
              {w.kewajiban > 0 && <p className="mt-3 text-xs text-slate-500">Dikurangi kartu kredit & utang <b className="text-rose-600">{money(w.kewajiban)}</b></p>}
            </div>
          )}

          {missing.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-lg font-bold text-slate-900">Belum tercatat</h2>
              <ul className={cn(card, 'overflow-hidden')}>
                {missing.map((m) => (
                  <li key={m.label} className="border-b border-slate-200/60 last:border-0">
                    <button type="button" onClick={m.go} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-200/40">
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', m.tone)}>{m.icon}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[15px] text-slate-900">{m.label}</span><span className="block text-xs text-slate-500">{m.sub}</span></span>
                      <Plus size={17} className="text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={cn(card, 'flex items-center gap-3 p-4')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Gem size={18} /></span>
            <p className="text-xs leading-relaxed text-slate-600">Aset {money(w.aset)} − kewajiban {money(w.kewajiban)}. Tabungan & investasi dihitung terpisah dari saldo dompet, jadi tidak dobel.</p>
          </div>
        </div>
      </div>

      {/* Menu Tambah */}
      <AnimatePresence>
        {addOpen && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddOpen(false)} role="dialog" aria-modal="true" aria-label="Tambah ke kekayaan">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="w-full max-w-md rounded-[28px] bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <p className="font-bold text-slate-900">Tambah</p>
                <button type="button" onClick={() => setAddOpen(false)} aria-label="Tutup" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <ul className="overflow-hidden rounded-2xl bg-slate-50">
                {ADD.map((a, i) => (
                  <motion.li key={a.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-100 last:border-0">
                    <button type="button" onClick={() => { setAddOpen(false); if (a.href) router.push(a.href); else if (a.modal) openModal(a.modal); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-slate-800 hover:bg-slate-100">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">{a.icon}</span>{a.label}
                    </button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
