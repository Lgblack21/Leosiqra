"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, CreditCard, Eye, EyeOff, HandCoins, Landmark, PiggyBank, Plus, Scale, TrendingUp, Wallet } from 'lucide-react';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { savingsGoalService, type SavingsGoal } from '@/lib/services/savingsGoalService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { getCardCycle } from '@/lib/creditCard';
import { computeNetWorth, netWorthTrail } from '@/lib/netWorth';
import { targetColor, targetIcon } from '@/lib/targets';
import { useModal } from '@/context/ModalContext';
import { LogoImage } from '@/components/ui/LogoImage';
import { cn, formatIDR } from '@/lib/utils';
import type { KekayaanTab } from '@/components/kekayaan/KekayaanShell';

// Tab Ringkasan di halaman Kekayaan: kekayaan bersih + jejaknya, aset vs
// kewajiban, komposisi, lalu rincian per kelompok. Semua angka dari
// lib/netWorth (rumus sama dengan Rekening, Investasiku & panel Hutang).

const HIDE_KEY = 'leosiqra-hide-balance'; // sama dengan halaman Rekening
const RANGES = [
  { id: 30, label: '1B' },
  { id: 90, label: '3B' },
  { id: 365, label: '1T' },
] as const;
const GROUP = {
  cash: { label: 'Kas & rekening', color: '#38bdf8', icon: Wallet },
  savings: { label: 'Tabungan', color: '#f472b6', icon: PiggyBank },
  investments: { label: 'Investasi', color: '#818cf8', icon: TrendingUp },
  piutang: { label: 'Piutang', color: '#34d399', icon: HandCoins },
} as const;
type GroupId = keyof typeof GROUP;
const TYPE_EMOJI: Record<string, string> = { 'Bank Account': '🏦', 'E-Wallet': '📱', Cash: '💵', 'Investment Account': '📈' };
const TYPE_LABEL: Record<string, string> = { 'Bank Account': 'Bank', 'E-Wallet': 'E-wallet', Cash: 'Tunai', 'Investment Account': 'Rekening investasi' };
const INV_EMOJI: Record<string, string> = { Saham: '📈', Deposito: '🏦', Lainnya: '🪙' };
const short = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e9) return `${s}Rp${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (a >= 1e6) return `${s}Rp${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  if (a >= 1e3) return `${s}Rp${Math.round(a / 1e3)} rb`;
  return `${s}${formatIDR(a)}`;
};
const fmtDay = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
const dueLabel = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = fmtDay(new Date(y, m - 1, d));
  return days <= 0 ? `${date} · hari ini` : days === 1 ? `${date} · besok` : `${date} · ${days} hari lagi`;
};

export function RingkasanKekayaan({ go, onAddAccount }: { go: (t: KekayaanTab) => void; onAddAccount: () => void }) {
  const reduce = useReducedMotion();
  const { openModal } = useModal();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [range, setRange] = useState<number>(30);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferensi lokal baru terbaca setelah hydrate (static export)
    try { setHidden(localStorage.getItem(HIDE_KEY) === '1'); } catch { /* storage diblokir */ }
    exchangeRateService.getLatestRates().then(setFx).catch(console.error);
    let alive = true;
    const loadAccounts = () => accountService.getUserAccounts('session').then((v) => alive && setAccounts(v)).catch(console.error);
    const loadTrx = () => transactionService.getUserTransactions('session').then((v) => alive && setTransactions(v)).catch(console.error);
    const loadInv = () => investmentService.getUserInvestments('session').then((v) => alive && setInvestments(v)).catch(console.error);
    const loadSav = () => {
      savingsService.getUserSavings('session').then((v) => alive && setSavings(v)).catch(console.error);
      savingsGoalService.getUserSavingsGoals().then((v) => alive && setGoals(v)).catch(() => alive && setGoals([]));
    };
    Promise.allSettled([loadAccounts(), loadTrx(), loadInv(), loadSav()]).then(() => alive && setLoaded(true));
    const unsubs = [
      subscribeToCollectionChanges('accounts', loadAccounts),
      subscribeToCollectionChanges('transactions', () => { loadTrx(); loadAccounts(); }),
      subscribeToCollectionChanges('investments', loadInv),
      subscribeToCollectionChanges('savings', () => { loadSav(); loadAccounts(); }),
    ];
    return () => { alive = false; unsubs.forEach((u) => u()); };
  }, []);

  const toggleHidden = () => setHidden((h) => {
    try { localStorage.setItem(HIDE_KEY, h ? '0' : '1'); } catch { /* abaikan */ }
    return !h;
  });
  const money = (n: number) => (hidden ? 'Rp ••••••' : formatIDR(Math.round(n)));
  const shortM = (n: number) => (hidden ? '••••' : short(n));

  const nw = useMemo(
    () => computeNetWorth({ accounts, transactions, investments, savings, toIdr: (n, c) => exchangeRateService.convert(n, c || 'IDR', 'IDR', fx) }),
    [accounts, transactions, investments, savings, fx]
  );
  const t = nw.totals;
  const trail = useMemo(() => netWorthTrail(t.net, transactions, range), [t.net, transactions, range]);
  const delta = trail.length ? t.net - trail[0].value : 0;
  const cycles = useMemo(
    () => nw.cards.map((c) => ({ ...c, cycle: getCardCycle(c.account, transactions) })).sort((a, b) => (a.cycle?.daysUntilDue ?? 999) - (b.cycle?.daysUntilDue ?? 999)),
    [nw.cards, transactions]
  );
  const comp = (Object.keys(GROUP) as GroupId[]).map((id) => ({ id, ...GROUP[id], value: Math.max(0, t[id]) })).filter((g) => g.value > 0);
  const compTotal = comp.reduce((s, g) => s + g.value, 0);
  const debtRatio = t.assets > 0 ? t.liabilities / t.assets : 0;

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="h-[340px] animate-pulse rounded-[32px] bg-slate-200/70" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-[26px] bg-white" />)}</div>
          <div className="h-80 animate-pulse rounded-[26px] bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kekayaan bersih */}
      <section className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_120%_at_0%_0%,#0f3d38_0%,#0b1220_55%,#0b1220_100%)] p-5 text-white md:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
              Kekayaan bersih
              <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </p>
            <p className={cn('mt-1 text-[36px] font-extrabold leading-none tracking-tight tabular-nums md:text-[52px]', t.net < 0 && 'text-rose-300')}>{money(t.net)}</p>
            <p className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold', delta >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300')}>
              {delta >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {delta >= 0 ? 'Naik' : 'Turun'} {shortM(Math.abs(delta))} dalam {range === 30 ? '30 hari' : range === 90 ? '3 bulan' : '1 tahun'}
            </p>
          </div>
          <div role="tablist" aria-label="Rentang waktu" className="flex gap-1 rounded-full bg-white/10 p-1">
            {RANGES.map((r) => (
              <button key={r.id} type="button" role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={cn('rounded-full px-3.5 py-1.5 text-[12px] font-bold', range === r.id ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white')}>{r.label}</button>
            ))}
          </div>
        </div>
        <TrailChart points={trail} up={delta >= 0} hidden={hidden} reduce={Boolean(reduce)} />
        <p className="relative mt-1 text-[11px] text-white/40">Garis = perkiraan dari pemasukan & pengeluaran yang tercatat. Naik-turun harga investasi & saldo yang diubah manual tidak ikut.</p>
      </section>

      {/* Aset vs kewajiban */}
      <section className="grid gap-3 rounded-[26px] bg-white p-4 ring-1 ring-slate-100 md:grid-cols-[1fr_1fr_1.3fr] md:items-center md:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><ArrowUpRight size={20} /></span>
          <div><p className="text-[12px] text-slate-500">Aset</p><p className="text-[19px] font-extrabold tabular-nums text-slate-900">{money(t.assets)}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ArrowDownRight size={20} /></span>
          <div><p className="text-[12px] text-slate-500">Kewajiban</p><p className="text-[19px] font-extrabold tabular-nums text-slate-900">{money(t.liabilities)}</p></div>
        </div>
        <div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${t.assets + t.liabilities > 0 ? (t.assets / (t.assets + t.liabilities)) * 100 : 0}%` }} transition={{ duration: 0.8 }} className="h-full bg-emerald-400" />
            <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${t.assets + t.liabilities > 0 ? (t.liabilities / (t.assets + t.liabilities)) * 100 : 0}%` }} transition={{ duration: 0.8, delay: 0.1 }} className="h-full bg-rose-400" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500">
            <Scale size={13} />
            {t.liabilities <= 0 ? 'Bebas utang — mantap.' : `Utang = ${Math.round(debtRatio * 100)}% dari aset${debtRatio > 0.5 ? ' · cukup berat, prioritaskan pelunasan' : debtRatio > 0.3 ? ' · masih wajar, jangan bertambah' : ' · sehat'}`}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-3">
          <Group icon={Wallet} tone="bg-sky-50 text-sky-600" title="Kas & rekening" total={money(t.cash)} count={nw.cash.length} action={<Link href="/membership/rekening" className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Rekening</Link>}>
            {nw.cash.length === 0 ? <Empty text="Belum ada rekening." onAdd={onAddAccount} label="Tambah akun" /> : nw.cash.map(({ account, value }) => (
              <Row key={account.id} href="/membership/rekening" icon={<LogoImage src={account.logoUrl} alt={account.name} fallbackText={account.name.slice(0, 3).toUpperCase()} fallbackIcon={<span aria-hidden className="text-[18px]">{TYPE_EMOJI[account.type] ?? '🏦'}</span>} className="h-full w-full object-cover" />} title={account.name} sub={`${TYPE_LABEL[account.type] ?? account.type}${account.purpose === 'nabung' ? ' · 🐷 Nabung' : account.purpose === 'belanja' ? ' · 🛒 Belanja' : ''}${account.currency && account.currency !== 'IDR' ? ` · ${account.currency}` : ''}`} value={money(value)} negative={value < 0} />
            ))}
          </Group>

          <Group icon={PiggyBank} tone="bg-pink-50 text-pink-600" title="Tabungan" total={money(t.savings)} count={goals.length} action={<button type="button" onClick={() => go('tabungan')} className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Kelola</button>}>
            {goals.length === 0 ? <Empty text={t.savings > 0 ? 'Tabungan tanpa target.' : 'Belum ada tabungan.'} onAdd={() => go('tabungan')} label="Buat target" /> : goals.slice(0, 5).map((g) => {
              const pct = g.targetAmount ? Math.min(100, (g.currentTotal / g.targetAmount) * 100) : null;
              return (
                <li key={g.id}>
                  <button type="button" onClick={() => go('tabungan')} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]" style={{ background: `${targetColor(g)}1f` }}>{targetIcon(g)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-slate-900">{g.name}</span>
                      {pct !== null ? (
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: targetColor(g) }} /></span>
                          <span className="text-[11px] font-semibold tabular-nums text-slate-500">{Math.floor(pct)}%</span>
                        </span>
                      ) : <span className="block text-[12px] text-slate-500">Tanpa nominal target</span>}
                    </span>
                    <span className="whitespace-nowrap text-[14px] font-bold tabular-nums text-slate-900">{money(g.currentTotal)}</span>
                  </button>
                </li>
              );
            })}
          </Group>

          <Group icon={TrendingUp} tone="bg-indigo-50 text-indigo-600" title="Investasi" total={money(t.investments)} count={nw.investments.length} action={<Link href="/membership/investment" className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Investasiku</Link>}>
            {nw.investments.length === 0 ? <Empty text="Belum ada investasi." onAdd={() => openModal('investasi_lain')} label="Tambah investasi" /> : nw.investments.slice().sort((a, b) => b.value - a.value).slice(0, 6).map(({ inv, value, cost }) => {
              const gain = value - cost;
              return (
                <Row key={inv.id} href="/membership/investment" icon={<span aria-hidden className="text-[18px]">{INV_EMOJI[inv.type] ?? '🪙'}</span>} title={inv.name} sub={<>{inv.stockCode || inv.type}{cost > 0 && Math.abs(gain) >= 1 && !hidden && <span className={gain >= 0 ? 'text-emerald-600' : 'text-rose-600'}> · {gain >= 0 ? '+' : '−'}{short(Math.abs(gain)).replace('−', '')} ({gain >= 0 ? '+' : '−'}{Math.abs((gain / cost) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)</span>}</>} value={money(value)} />
              );
            })}
          </Group>

          <Group icon={HandCoins} tone="bg-emerald-50 text-emerald-600" title="Piutang" total={money(t.piutang)} count={nw.piutang.length} action={<button type="button" onClick={() => go('hutang')} className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Kelola</button>}>
            {nw.piutang.length === 0 ? <Empty text="Tidak ada uang yang dipinjam orang." onAdd={() => openModal('hutang_piutang')} label="Catat piutang" /> : nw.piutang.slice(0, 5).map((p) => (
              <Row key={p.id} onClick={() => go('hutang')} icon={<span aria-hidden className="text-[18px]">🤝</span>} title={p.name} sub={`Sejak ${fmtDay(p.date)}${p.remaining < p.total - 0.5 ? ` · sisa dari ${shortM(p.total)}` : ''}`} value={money(p.remaining)} />
            ))}
          </Group>

          <Group icon={Landmark} tone="bg-rose-50 text-rose-600" title="Kewajiban" total={t.liabilities > 0 ? `−${money(t.liabilities)}` : money(0)} count={cycles.length + nw.hutang.length} action={<button type="button" onClick={() => go('hutang')} className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Kelola</button>}>
            {cycles.length + nw.hutang.length === 0 ? <Empty text="Tidak ada utang. 🎉" onAdd={() => openModal('hutang_piutang')} label="Catat hutang" /> : (
              <>
                {cycles.filter((c) => c.used > 0.5).map(({ account, used, cycle }) => (
                  <Row key={account.id} href="/membership/rekening" icon={<CreditCard size={18} className="text-rose-500" />} title={account.name} sub={cycle && cycle.amountDue > 0 ? `Jatuh tempo ${dueLabel(cycle.dueDate, cycle.daysUntilDue)}` : 'Kartu kredit · terpakai'} value={`−${money(used)}`} negative />
                ))}
                {nw.hutang.slice(0, 5).map((h) => (
                  <Row key={h.id} onClick={() => go('hutang')} icon={<span aria-hidden className="text-[18px]">🧾</span>} title={h.name} sub={`${h.note ?? 'Hutang'} · sejak ${fmtDay(h.date)}`} value={`−${money(h.remaining)}`} negative />
                ))}
              </>
            )}
          </Group>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <section className="rounded-[26px] bg-white p-5 ring-1 ring-slate-100">
            <h3 className="text-[16px] font-bold text-slate-900">Komposisi aset</h3>
            {compTotal <= 0 ? <p className="py-6 text-center text-[13px] text-slate-500">Belum ada aset tercatat.</p> : (
              <div className="mt-3 flex items-center gap-4">
                <Donut parts={comp.map((g) => ({ value: g.value, color: g.color }))} reduce={Boolean(reduce)} label={hidden ? '••••' : short(compTotal)} />
                <ul className="min-w-0 flex-1 space-y-2">
                  {comp.map((g) => (
                    <li key={g.id} className="flex items-center gap-2 text-[13px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{g.label}</span>
                      <span className="font-bold tabular-nums text-slate-900">{Math.round((g.value / compTotal) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {cycles.some((c) => c.cycle && c.cycle.amountDue > 0) && (
            <section className="rounded-[26px] bg-white p-5 ring-1 ring-slate-100">
              <div className="flex items-center justify-between"><h3 className="text-[16px] font-bold text-slate-900">Tagihan kartu</h3><Link href="/membership/rekening" className="text-[12px] font-bold text-slate-500 hover:text-slate-900">Semua</Link></div>
              <ul className="mt-3 space-y-2">
                {cycles.filter((c) => c.cycle && c.cycle.amountDue > 0).slice(0, 3).map(({ account, cycle }) => (
                  <li key={account.id} className={cn('flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5', (cycle?.daysUntilDue ?? 99) <= 3 ? 'bg-rose-50' : 'bg-slate-50')}>
                    <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-slate-900">{account.name}</span><span className="text-[11px] text-slate-500">{cycle && dueLabel(cycle.dueDate, cycle.daysUntilDue)}</span></span>
                    <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-slate-900">{money(exchangeRateService.convert(cycle?.amountDue ?? 0, account.currency || 'IDR', 'IDR', fx))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[26px] bg-slate-900 p-5 text-white">
            <h3 className="text-[16px] font-bold">Tambah ke kekayaan</h3>
            <p className="text-[12px] text-white/60">Yang belum dicatat belum ikut terhitung.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Akun', emoji: '🏦', on: onAddAccount },
                { label: 'Target tabungan', emoji: '🐷', on: () => go('tabungan') },
                { label: 'Investasi / emas', emoji: '🪙', on: () => openModal('investasi_lain') },
                { label: 'Hutang / piutang', emoji: '🤝', on: () => openModal('hutang_piutang') },
              ].map((a) => (
                <button key={a.label} type="button" onClick={a.on} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-left text-[12px] font-semibold hover:bg-white/15">
                  <span aria-hidden className="text-[16px]">{a.emoji}</span><span className="min-w-0 flex-1 leading-tight">{a.label}</span><Plus size={14} className="shrink-0 text-white/60" />
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Group({ icon: Icon, tone, title, total, count, action, children }: { icon: typeof Wallet; tone: string; title: string; total: string; count: number; action: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-[26px] bg-white ring-1 ring-slate-100">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', tone)}><Icon size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-slate-900">{title}{count > 0 && <span className="ml-1.5 text-[12px] font-semibold text-slate-400">{count}</span>}</span>
            <span className="block text-[13px] font-semibold tabular-nums text-slate-500">{total}</span>
          </span>
          <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', !open && '-rotate-90')} />
        </button>
        {action}
      </div>
      {open && <ul className="divide-y divide-slate-100 border-t border-slate-100">{children}</ul>}
    </section>
  );
}

function Row({ icon, title, sub, value, negative, href, onClick }: { icon: ReactNode; title: string; sub: ReactNode; value: string; negative?: boolean; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-slate-900">{title}</span>
        <span className="block truncate text-[12px] text-slate-500">{sub}</span>
      </span>
      <span className={cn('whitespace-nowrap text-[14px] font-bold tabular-nums', negative ? 'text-rose-600' : 'text-slate-900')}>{value}</span>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50';
  return <li>{href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>}</li>;
}

function Empty({ text, onAdd, label }: { text: string; onAdd: () => void; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-4">
      <span className="text-[13px] text-slate-500">{text}</span>
      <button type="button" onClick={onAdd} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"><Plus size={13} /> {label}</button>
    </li>
  );
}

function Donut({ parts, label, reduce }: { parts: { value: number; color: string }[]; label: string; reduce: boolean }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  // Awal tiap segmen = jumlah panjang segmen sebelumnya.
  const segs = parts.map((p, i) => ({ ...p, len: (p.value / total) * C, start: parts.slice(0, i).reduce((s, q) => s + (q.value / total) * C, 0) }));
  return (
    <div className="relative h-[124px] w-[124px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segs.map((p, i) => (
          <motion.circle key={i} cx="50" cy="50" r={R} fill="none" stroke={p.color} strokeWidth="12" strokeLinecap="butt"
            strokeDasharray={`${Math.max(0, p.len - 1)} ${C}`} strokeDashoffset={-p.start}
            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.1 }} />
        ))}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] text-slate-400">Aset</span>
        <span className="text-[13px] font-extrabold tabular-nums text-slate-900">{label}</span>
      </span>
    </div>
  );
}

function TrailChart({ points, up, hidden, reduce }: { points: { date: Date; value: number }[]; up: boolean; hidden: boolean; reduce: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 600;
  const H = 150;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(1, Math.abs(max) * 0.05);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => 12 + (1 - (v - min) / span) * (H - 24);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const color = up ? '#34d399' : '#fb7185';
  const h = hover ?? points.length - 1;
  return (
    <div className="relative mt-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[150px] w-full touch-pan-y md:h-[180px]"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Grafik jejak kekayaan bersih"
      >
        <defs>
          <linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#nw-fill)" />
        <motion.path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="white" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white/15" style={{ left: `${(h / (points.length - 1)) * 100}%`, top: `${(y(points[h].value) / H) * 100}%`, background: color }} />
      <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
        <span>{fmtDay(points[0].date)}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white tabular-nums">{fmtDay(points[h].date)} · {hidden ? 'Rp ••••' : formatIDR(points[h].value)}</span>
        <span>{fmtDay(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
