"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronRight, Landmark, Minus, Newspaper, Plus, ShieldCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Skeleton } from '@/components/ui/Skeleton';
import { KabarTab, SbnTab, BelajarTab } from '@/components/pasar/Tabs';
import {
  card, daysTo, fmtDate, kuponRange, netReturn, offerOpen, pct, rp, rpShort, TOPIC_EMOJI,
  type PasarFeed, type PasarNews, type SbnOffer,
} from '@/components/pasar/shared';

// Pasar & belajar (padanan "Oyenku"): simulasi menaruh uang di SBN ritel yang
// sedang ditawarkan vs deposito (bunga LPS), kabar uang minggu ini, data SBN,
// dan materi belajar. Data pasar diambil otomatis oleh Worker (lihat
// cloudflare/src/pasar.ts) — halaman ini tidak pernah mengarang angka.

type Tab = 'pasar' | 'kabar' | 'sbn' | 'belajar';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'pasar', label: 'Pasar', icon: <LeoMascot mood="idle" size={22} /> },
  { id: 'kabar', label: 'Kabar', icon: <Newspaper size={19} /> },
  { id: 'sbn', label: 'SBN', icon: <Landmark size={19} /> },
  { id: 'belajar', label: 'Belajar', icon: <BookOpen size={19} /> },
];
const HORIZONS = [
  { id: '1m', label: '1 mgg', months: 0.25 },
  { id: '1b', label: '1 bln', months: 1 },
  { id: '3b', label: '3 bln', months: 3 },
  { id: '1t', label: '1 thn', months: 12 },
  { id: '2t', label: '2 thn', months: 24 },
] as const;

export default function PasarPage() {
  const [tab, setTab] = useState<Tab>('pasar');
  const [data, setData] = useState<{ feed: PasarFeed | null; news: PasarNews[] } | null>(null);
  const [error, setError] = useState('');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    cloudflareApi<{ feed: PasarFeed | null; news: PasarNews[] }>('/api/member/pasar')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Data pasar belum bisa dimuat.'));
    investmentService.getUserInvestments('session').then((l) => setInvestments(l.filter((i) => i.status === 'Active'))).catch(() => {});
    transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
  }, []);

  const feed = data?.feed ?? null;
  const news = data?.news ?? [];

  return (
    <div className="mx-auto max-w-6xl pb-32">
      <h1 className="sr-only">Pasar & belajar</h1>
      {error ? (
        <div className="rounded-3xl bg-amber-50 p-6 text-sm text-amber-800">{error}</div>
      ) : !data ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[520px] rounded-3xl" /><Skeleton className="h-[420px] rounded-3xl" /></div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {tab === 'pasar' && <PasarTab feed={feed} news={news} investments={investments} go={setTab} />}
            {tab === 'kabar' && <KabarTab feed={feed} news={news} transactions={transactions} investments={investments} go={setTab} />}
            {tab === 'sbn' && <SbnTab feed={feed} />}
            {tab === 'belajar' && <BelajarTab feed={feed} />}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Navigasi bawah mengambang */}
      <nav aria-label="Bagian Pasar & belajar" className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[288px]">
        <LayoutGroup id="pasar-tabs">
          <div className="flex gap-1 rounded-[26px] bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-current={tab === t.id ? 'page' : undefined} className={cn('relative flex w-20 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-bold transition-colors', tab === t.id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                {tab === t.id && <motion.span layoutId="pasar-tab-pill" className="absolute inset-0 rounded-[20px] bg-slate-100" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative flex h-6 items-center">{t.icon}</span>
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </nav>
    </div>
  );
}

// ================= Tab Pasar =================
type Option = { id: string; label: string; rate: number; kind: 'sbn' | 'depo'; minimal?: boolean; months?: number | null; offer?: SbnOffer };

function PasarTab({ feed, news, investments, go }: { feed: PasarFeed | null; news: PasarNews[]; investments: Investment[]; go: (t: Tab) => void }) {
  const reduce = useReducedMotion();
  const [amount, setAmount] = useState(5_000_000);
  const [editing, setEditing] = useState(false);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]['id']>('1t');
  const open = (feed?.sbnOffers ?? []).filter(offerOpen);
  const offer = open[0] ?? null;
  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    for (const o of open) for (const t of o.tenors) list.push({ id: `${o.seri}${t.label}`, label: `${o.seri}${t.label} · ${t.minimal ? 'min. ' : ''}${pct(t.kupon)}`, rate: t.kupon, kind: 'sbn', minimal: t.minimal, months: t.tahun ? t.tahun * 12 : null, offer: o });
    if (feed?.lps) list.push({ id: 'depo', label: `Deposito · ${pct(feed.lps.umum)}`, rate: feed.lps.umum, kind: 'depo' });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);
  const [pick, setPick] = useState<string | null>(null);
  const opt = options.find((o) => o.id === pick) ?? options[0] ?? null;
  const depo = options.find((o) => o.kind === 'depo') ?? null;
  const h = HORIZONS.find((x) => x.id === horizon)!;
  const gain = opt ? netReturn(amount, opt.rate, h.months, opt.kind) : 0;
  const depoGain = depo ? netReturn(amount, depo.rate, h.months, 'depo') : 0;
  const end = new Date(Date.now() + h.months * 30.44 * 864e5);
  const steps = h.months <= 1 ? (h.months < 1 ? 7 : 4) : Math.min(24, Math.round(h.months));
  const bars = Array.from({ length: steps }, (_, i) => {
    const m = (h.months * (i + 1)) / steps;
    return { a: opt ? netReturn(amount, opt.rate, m, opt.kind) : 0, b: depo ? netReturn(amount, depo.rate, m, 'depo') : 0 };
  });
  const max = Math.max(1, ...bars.map((b) => Math.max(b.a, b.b)));
  const stepAmt = amount >= 50_000_000 ? 10_000_000 : 1_000_000;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        {/* Mau taruh berapa? */}
        <div className="px-2 pt-2 text-center">
          <p className="text-sm text-slate-500">Mau taruh berapa?</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button type="button" aria-label="Kurangi" onClick={() => setAmount((a) => Math.max(1_000_000, a - stepAmt))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><Minus size={18} /></button>
            {editing ? (
              <input autoFocus inputMode="numeric" aria-label="Nominal" defaultValue={amount.toLocaleString('id-ID')} onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, '')); if (v > 0) setAmount(Math.min(v, 100_000_000_000)); setEditing(false); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="w-full min-w-0 bg-transparent text-center text-[44px] font-extrabold tracking-tight text-slate-900 outline-none" />
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 items-baseline justify-center gap-2">
                <span className="text-2xl font-semibold text-slate-400">Rp</span>
                <motion.span key={amount} initial={reduce ? false : { y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="truncate text-[44px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[52px]">{amount.toLocaleString('id-ID')}</motion.span>
              </button>
            )}
            <button type="button" aria-label="Tambah" onClick={() => setAmount((a) => a + stepAmt)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><Plus size={18} /></button>
          </div>
          <p className="text-xs text-slate-400">Ketuk angkanya untuk mengubah</p>
          {offer ? (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700"><TrendingUp size={15} className="text-emerald-600" /> {offer.seri} · {kuponRange(offer)} per tahun</span>
          ) : feed?.lps ? (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700"><TrendingUp size={15} className="text-amber-600" /> Deposito dijamin LPS · {pct(feed.lps.umum)} per tahun</span>
          ) : null}
        </div>
        <button type="button" onClick={() => go('sbn')} className="mt-5 h-14 w-full rounded-full bg-slate-900 text-[15px] font-bold text-white transition-colors hover:bg-slate-800">{offer ? `Cara beli ${offer.seri}` : 'Lihat pilihan SBN'}</button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-slate-500"><ShieldCheck size={14} /> {offer ? 'Dijamin negara, kupon masuk tiap bulan' : 'Deposito dijamin LPS sampai Rp2 miliar per bank'}</p>

        {/* Simulasi */}
        <section className={cn(card, 'mt-6 overflow-hidden')}>
          <p className="border-b border-slate-200/70 px-5 py-4 text-lg font-extrabold text-slate-900">Simulasi</p>
          {!opt ? (
            <p className="p-5 text-sm text-slate-500">Data bunga belum tersedia. Coba lagi beberapa saat lagi.</p>
          ) : (
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <button key={o.id} type="button" onClick={() => setPick(o.id)} className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors', opt.id === o.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200/60')}>{o.label}</button>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500">Saldo kamu nanti</p>
              <motion.p key={`${opt.id}-${horizon}-${amount}`} initial={reduce ? false : { opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[34px] font-extrabold tracking-tight text-slate-900 tabular-nums">{rp(amount + gain)}</motion.p>
              <p className="text-sm text-slate-500">
                {fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })} · <b className="text-emerald-600">+{rp(gain)} setelah pajak</b>{opt.minimal ? ' · paling sedikit' : ''}
              </p>
              <div className="mt-5 flex h-44 items-end gap-1.5">
                {bars.map((b, i) => (
                  <div key={i} className="relative flex h-full flex-1 items-end">
                    {opt.kind === 'sbn' && depo && <span className="absolute bottom-0 left-0 right-0 rounded-md bg-slate-200" style={{ height: `${(b.b / max) * 100}%` }} />}
                    <motion.span
                      className={cn('relative w-full rounded-md', i === bars.length - 1 ? (opt.kind === 'sbn' ? 'bg-emerald-700' : 'bg-amber-600') : opt.kind === 'sbn' ? 'bg-emerald-500' : 'bg-amber-400')}
                      initial={reduce ? false : { height: 0 }}
                      animate={{ height: `${Math.max(2, (b.a / max) * 100)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.025 }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-400"><span>{fmtDate(new Date(Date.now() + (h.months / steps) * 30.44 * 864e5))}</span><span>{fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              {opt.kind === 'sbn' && depo && (
                <>
                  <p className="mt-3 flex gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> {opt.id}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-300" /> Deposito</span></p>
                  <p className="mt-1 text-sm text-slate-700">Deposito dengan bunga LPS dapat {rp(depoGain)} dalam waktu yang sama. {opt.id}: {rp(gain - depoGain)} {gain >= depoGain ? 'lebih banyak' : 'lebih sedikit'}.</p>
                </>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                {opt.kind === 'sbn' ? `Kupon ${opt.minimal ? 'minimal, bisa naik ikut BI-Rate' : 'tetap'} · setelah pajak 10%` : amount <= 7_500_000 ? 'Simpanan s.d. Rp7,5 jt tidak dipotong pajak bunga' : 'Setelah pajak bunga 20%'} · perkiraan bunga sederhana
              </p>
            </div>
          )}
          <LayoutGroup id="pasar-horizon">
            <div className="flex border-t border-slate-200/70 p-2">
              {HORIZONS.map((x) => (
                <button key={x.id} type="button" onClick={() => setHorizon(x.id)} className={cn('relative flex-1 rounded-full py-2.5 text-sm font-semibold', horizon === x.id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                  {horizon === x.id && <motion.span layoutId="horizon-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" />}
                  <span className="relative">{x.label}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        </section>
      </div>

      {/* Kanan */}
      <div className="min-w-0 space-y-4">
        {offer && (
          <button type="button" onClick={() => go('sbn')} className={cn(card, 'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-100')}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Landmark size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-900">{offer.seri} sedang ditawarkan</span>
              <span className="block text-sm text-slate-500">{daysTo(offer.akhir) !== null ? `${daysTo(offer.akhir)} hari lagi · ` : ''}{offer.tenors.map((t) => pct(t.kupon)).join(' · ')}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-600">Lihat di SBN <ChevronRight size={15} /></span>
          </button>
        )}

        <section className={cn(card, 'p-4')}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-extrabold text-slate-900">Kabar minggu ini</p>
            <button type="button" onClick={() => go('kabar')} className="text-sm font-semibold text-slate-600 hover:text-slate-900">Lihat semua</button>
          </div>
          {news.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada kabar.</p> : (
            <ul className="mt-2 divide-y divide-slate-200/70">
              {news.slice(0, 3).map((n) => (
                <li key={n.id}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-base">{TOPIC_EMOJI[n.topic] ?? '📰'}</span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-bold text-slate-800">{n.title}</span>
                      <span className="text-xs text-slate-400">{n.topic} · {n.source} · {fmtDate(n.published_at)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(card, 'p-4')}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-extrabold text-slate-900">Investasimu</p>
            <Link href="/membership/kekayaan" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Buka Kekayaan</Link>
          </div>
          {investments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Belum ada investasi tercatat. <Link href="/membership/investment" className="font-semibold text-indigo-600">Catat sekarang</Link></p>
          ) : (
            <ul className="mt-1 divide-y divide-slate-200/70">
              {[...investments].sort((a, b) => (Number(b.currentValueIDR) || Number(b.amountIDR) || 0) - (Number(a.currentValueIDR) || Number(a.amountIDR) || 0)).slice(0, 4).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="truncate text-slate-700">{i.name}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{rpShort(Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/membership/market-data" className={cn(card, 'flex items-center justify-between p-4 text-sm font-semibold text-slate-700 hover:bg-slate-100')}>
          Harga saham, kripto & kurs lengkap <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
