"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Minus, Plus, RefreshCw, Settings2, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { Investment } from '@/lib/services/investmentService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useMarketData } from '@/lib/hooks/useMarketData';
import { CryptoWatchlistModal } from '@/components/modals/CryptoWatchlistModal';
import { CoinOption } from '@/lib/coingecko';
import { LogoImage } from '@/components/ui/LogoImage';
import { HeaderSlot } from '@/components/Header';
import { useModal } from '@/context/ModalContext';
import { cn, formatIDR } from '@/lib/utils';

// Investasiku — portofolio (dulu "Investasi") + simulasi + harga pasar (dulu
// halaman "Data Pasar") dalam satu halaman. Rumus total sama dengan versi lama:
// semua posisi non-Planned, dihitung dalam IDR (amountIDR/currentValueIDR).

type Kind = 'Saham' | 'Deposito' | 'Lainnya';
const KIND: Record<Kind, { label: string; color: string; href: string; modal: 'saham' | 'deposito' | 'investasi_lain'; emoji: string }> = {
  Saham: { label: 'Saham', color: '#6366f1', href: '/membership/investasi/saham', modal: 'saham', emoji: '📈' },
  Deposito: { label: 'Deposito', color: '#10b981', href: '/membership/investasi/deposito', modal: 'deposito', emoji: '🏦' },
  Lainnya: { label: 'Lainnya', color: '#f59e0b', href: '/membership/investasi/lainnya', modal: 'investasi_lain', emoji: '🪙' },
};
const idrInvested = (i: Investment) => Number(i.amountIDR) || Number(i.amountInvested) || 0;
const idrCurrent = (i: Investment) => Number(i.currentValueIDR) || Number(i.currentValue) || 0;
const short = (n: number) =>
  Math.abs(n) >= 1e9 ? `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  : Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
  : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);

// Simulasi: bunga sederhana setelah pajak. Pilihan = deposito milik user +
// contoh umum (PERKIRAAN — bunga bisa diubah).
type Preset = { id: string; label: string; rate: number; tax: number; note: string };
const GENERIC: Preset[] = [
  { id: 'dep', label: 'Deposito', rate: 4.5, tax: 20, note: 'contoh bunga deposito bank' },
  { id: 'sbn', label: 'SBN ritel', rate: 6.5, tax: 10, note: 'contoh kupon SBN (ORI/SR)' },
  { id: 'rdpu', label: 'Reksa dana pasar uang', rate: 4.5, tax: 0, note: 'contoh imbal hasil, tanpa pajak' },
];
const PERIODS = [
  { id: '1b', label: '1 bln', months: 1 },
  { id: '3b', label: '3 bln', months: 3 },
  { id: '6b', label: '6 bln', months: 6 },
  { id: '1t', label: '1 thn', months: 12 },
  { id: '5t', label: '5 thn', months: 60 },
];
const STEP = 1_000_000;

export default function InvestasikuPage() {
  const reduce = useReducedMotion();
  const { openModal } = useModal();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'Semua' | Kind>('Semua');
  const market = useMarketData();

  useEffect(() => {
    let unsubInv: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { setInvestments([]); return; }
      const q = query(collection(db, 'investments'), where('userId', '==', u.uid), orderBy('dateInvested', 'desc'));
      unsubInv = onSnapshot(q, (snap) => {
        setInvestments(
          snap.docs
            .map((doc) => {
              const d = doc.data();
              return {
                ...d, id: doc.id,
                amountInvested: Number(d.amountInvested) || 0,
                currentValue: Number(d.currentValue) || 0,
                returnPercentage: Number(d.returnPercentage) || 0,
                dateInvested: d.dateInvested?.toDate?.() ?? new Date(),
                createdAt: d.createdAt?.toDate?.() ?? new Date(),
              } as Investment;
            })
            // Baris proyeksi "(Hasil Akhir)" deposito berstatus Planned — bukan posisi nyata.
            .filter((inv) => inv.status !== 'Planned')
        );
        setLoaded(true);
      });
    });
    return () => { unsub(); if (unsubInv) unsubInv(); };
  }, []);

  const totalModal = investments.reduce((s, i) => s + idrInvested(i), 0);
  const totalNilai = investments.reduce((s, i) => s + idrCurrent(i), 0);
  const selisih = totalNilai - totalModal;
  const roi = totalModal > 0 ? (selisih / totalModal) * 100 : 0;
  const byKind = (k: Kind) => investments.filter((i) => (k === 'Lainnya' ? i.type !== 'Saham' && i.type !== 'Deposito' : i.type === k));
  const alloc = (Object.keys(KIND) as Kind[]).map((k) => ({ k, value: byKind(k).reduce((s, i) => s + idrCurrent(i), 0) })).filter((a) => a.value > 0);
  const shown = (tab === 'Semua' ? investments : byKind(tab)).slice().sort((a, b) => idrCurrent(b) - idrCurrent(a));

  // ---- Simulasi ----
  const presets: Preset[] = useMemo(() => {
    const mine = investments
      .filter((i) => i.type === 'Deposito' && i.status === 'Active' && i.returnPercentage > 0)
      .slice(0, 2)
      .map((i) => ({ id: `my-${i.id}`, label: i.name.replace(/\s*\(.*\)$/, ''), rate: i.returnPercentage, tax: i.taxPercentage ?? 20, note: 'bunga depositomu' }));
    return [...mine, ...GENERIC];
  }, [investments]);
  const [amount, setAmount] = useState(10_000_000);
  const [editing, setEditing] = useState(false);
  const [presetId, setPresetId] = useState<string>('dep');
  const [rateOverride, setRateOverride] = useState<Record<string, string>>({});
  const [periodId, setPeriodId] = useState('1t');
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const rate = Number((rateOverride[preset.id] ?? String(preset.rate)).replace(',', '.')) || 0;
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[3];
  const netYear = (rate / 100) * (1 - preset.tax / 100);
  const gain = Math.round(amount * netYear * (period.months / 12));
  const bars = Array.from({ length: 12 }, (_, k) => Math.round(amount * netYear * ((period.months * (k + 1)) / 12 / 12)));
  const maxBar = Math.max(1, ...bars);
  const endDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + period.months);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  })();

  const m = market;
  const goldGram = m.gold ? m.gold.price_idr / 31.1035 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Investasiku</h1>
          <p className="text-[13px] text-slate-500">{investments.length} posisi · harga pasar diperbarui tiap menit</p>
        </div>
        <div className="flex items-center gap-2">
          <HeaderSlot />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Total portofolio */}
          <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 text-white md:p-6">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-white/60">Nilai investasi</p>
                <p className="text-[30px] font-extrabold leading-tight tracking-tight tabular-nums md:text-[34px]">{formatIDR(totalNilai)}</p>
                <p className="text-[13px] text-white/70 tabular-nums">Modal {short(totalModal)}</p>
              </div>
              {totalModal > 0 && (
                <span className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold tabular-nums', selisih >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300')}>
                  {selisih >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {selisih >= 0 ? '+' : '−'}{short(Math.abs(selisih))} · {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                </span>
              )}
            </div>
            {alloc.length > 0 && (
              <div className="relative mt-4">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
                  {alloc.map((a) => (
                    <motion.span key={a.k} initial={reduce ? false : { width: 0 }} animate={{ width: `${(a.value / totalNilai) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full" style={{ background: KIND[a.k].color }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {alloc.map((a) => (
                    <button key={a.k} type="button" onClick={() => setTab(a.k)} className="flex items-center gap-1.5 text-[12px] text-white/75 hover:text-white">
                      <span className="h-2 w-2 rounded-full" style={{ background: KIND[a.k].color }} />
                      {KIND[a.k].label} <span className="font-semibold text-white tabular-nums">{Math.round((a.value / totalNilai) * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Simulasi */}
          <section className="overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-100">
            <div className="px-5 pt-5 text-center md:px-6">
              <p className="text-[13px] text-slate-500">Mau taruh berapa?</p>
              <div className="mt-1 flex items-center justify-center gap-3">
                <button type="button" onClick={() => setAmount((a) => Math.max(STEP, a - STEP))} aria-label="Kurangi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><Minus size={18} /></button>
                {editing ? (
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={amount ? amount.toLocaleString('id-ID') : ''}
                    onChange={(e) => setAmount(Math.min(1e12, Number(e.target.value.replace(/\D/g, '')) || 0))}
                    onBlur={() => setEditing(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
                    aria-label="Nominal simulasi"
                    className="w-full min-w-0 max-w-[260px] bg-transparent text-center text-[30px] font-extrabold tracking-tight text-slate-900 outline-none md:text-[36px]"
                  />
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className="min-w-0 truncate text-[30px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[36px]">
                    <span className="mr-1 text-[18px] font-semibold text-slate-400">Rp</span>{amount.toLocaleString('id-ID')}
                  </button>
                )}
                <button type="button" onClick={() => setAmount((a) => Math.min(1e12, a + STEP))} aria-label="Tambah" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><Plus size={18} /></button>
              </div>
              <p className="text-[11px] text-slate-400">Ketuk angkanya untuk mengubah</p>
            </div>

            <div className="mt-4 flex gap-1.5 overflow-x-auto px-5 pb-1 no-scrollbar md:px-6">
              {presets.map((p) => (
                <button key={p.id} type="button" onClick={() => setPresetId(p.id)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-colors', p.id === preset.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
                  {p.label} · {(Number((rateOverride[p.id] ?? String(p.rate)).replace(',', '.')) || 0).toLocaleString('id-ID')}%
                </button>
              ))}
            </div>

            <div className="px-5 pt-4 md:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] text-slate-500">Saldo kamu nanti</p>
                  <p className="text-[24px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[28px]">{formatIDR(amount + gain)}</p>
                  <p className="text-[12px] text-slate-500">{endDate} · <span className="font-semibold text-emerald-600">+{formatIDR(gain)}</span> setelah pajak {preset.tax}%</p>
                </div>
                <label className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-500 ring-1 ring-slate-200">
                  Bunga
                  <input
                    inputMode="decimal"
                    value={rateOverride[preset.id] ?? String(preset.rate).replace('.', ',')}
                    onChange={(e) => setRateOverride((o) => ({ ...o, [preset.id]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) }))}
                    aria-label="Bunga per tahun"
                    className="w-12 bg-transparent text-right font-bold text-slate-900 outline-none"
                  />
                  % / thn
                </label>
              </div>
              <div className="mt-4 flex h-32 items-end gap-1.5" aria-hidden>
                {bars.map((b, k) => (
                  <motion.span
                    key={`${period.id}-${preset.id}-${k}`}
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: `${Math.max(4, (b / maxBar) * 100)}%` }}
                    transition={{ duration: 0.5, delay: reduce ? 0 : k * 0.03, ease: 'easeOut' }}
                    className={cn('flex-1 rounded-t-lg', k === bars.length - 1 ? 'bg-gradient-to-t from-emerald-700 to-emerald-500' : 'bg-gradient-to-t from-emerald-500 to-emerald-300')}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Perkiraan: {preset.note}, bunga sederhana. Ubah bunganya sesuai produk yang kamu lihat.</p>
            </div>

            <div className="mt-3 flex border-t border-slate-100 bg-slate-50/60 p-1.5">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPeriodId(p.id)} className={cn('flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors', p.id === period.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Portofolio */}
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Portofolio</h2>
              <div className="flex gap-1.5">
                {(Object.keys(KIND) as Kind[]).map((k) => (
                  <button key={k} type="button" onClick={() => openModal(KIND[k].modal)} aria-label={`Tambah ${KIND[k].label}`} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                    <Plus size={13} /> {KIND[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-2 flex gap-1 rounded-full bg-slate-100 p-1">
              {(['Semua', 'Saham', 'Deposito', 'Lainnya'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn('flex-1 rounded-full py-1.5 text-[13px] font-semibold', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                  {t}
                </button>
              ))}
            </div>
            {!loaded ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}</div>
            ) : shown.length === 0 ? (
              <div className="rounded-[20px] bg-white p-6 text-center ring-1 ring-slate-100">
                <p className="text-[15px] font-semibold text-slate-900">Belum ada {tab === 'Semua' ? 'investasi' : tab.toLowerCase()}</p>
                <p className="mt-1 text-[13px] text-slate-500">Catat saham, deposito, emas, reksa dana, atau kripto yang kamu punya.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
                {shown.map((inv, i) => {
                  const kind: Kind = inv.type === 'Saham' || inv.type === 'Deposito' ? inv.type : 'Lainnya';
                  const diff = idrCurrent(inv) - idrInvested(inv);
                  const pct = idrInvested(inv) > 0 ? (diff / idrInvested(inv)) * 100 : inv.returnPercentage || 0;
                  return (
                    <motion.li key={inv.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                      <Link href={KIND[kind].href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[18px]" style={{ background: `${KIND[kind].color}1a` }}>
                          {inv.logoUrl ? <LogoImage src={inv.logoUrl} alt={inv.name} fallbackText={inv.name.slice(0, 3).toUpperCase()} className="h-full w-full object-cover" /> : KIND[kind].emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-slate-900">{inv.name}</p>
                          <p className="truncate text-[12px] text-slate-500">
                            {KIND[kind].label}{inv.platform ? ` · ${inv.platform}` : ''}{kind === 'Saham' && inv.sharesCount ? ` · ${inv.sharesCount.toLocaleString('id-ID')} lembar` : ''}{kind === 'Deposito' && inv.returnPercentage ? ` · ${inv.returnPercentage}%/thn` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[14px] font-bold text-slate-900 tabular-nums">{short(idrCurrent(inv))}</p>
                          <p className={cn('text-[12px] font-semibold tabular-nums', diff >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{diff >= 0 ? '+' : ''}{pct.toFixed(2)}%</p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-slate-300" />
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Harga pasar */}
        <aside id="pasar" className="min-w-0 scroll-mt-20 space-y-4">
          <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Harga pasar</h2>
              <button type="button" onClick={() => void m.refresh()} disabled={m.loading} aria-label="Perbarui harga" className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={13} className={m.loading ? 'animate-spin' : ''} />
                {m.lastUpdated ? m.lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '…'}
              </button>
            </div>
            {m.error && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-600">{m.error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/60 p-3">
                <p className="text-[11px] font-semibold text-amber-700">🥇 Emas / gram</p>
                <p className="mt-0.5 text-[15px] font-extrabold text-slate-900 tabular-nums">{goldGram ? short(goldGram) : '—'}</p>
                {m.gold && <p className={cn('text-[11px] font-semibold tabular-nums', m.gold.change_24h >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{m.gold.change_24h >= 0 ? '+' : ''}{m.gold.change_24h.toFixed(2)}% 24j</p>}
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3">
                <p className="text-[11px] font-semibold text-sky-700">💵 USD / IDR</p>
                <p className="mt-0.5 text-[15px] font-extrabold text-slate-900 tabular-nums">{m.usdIdrRate ? Math.round(m.usdIdrRate).toLocaleString('id-ID') : '—'}</p>
                <p className="text-[11px] text-slate-500">kurs tengah</p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Kripto</h3>
              <button type="button" onClick={() => m.setShowWatchlistModal(true)} className="flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline">
                <Settings2 size={13} /> Pilih koin
              </button>
            </div>
            {m.loading && !m.lastUpdated ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : m.cryptoData.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-slate-500">Data kripto belum tersedia.</p>
            ) : (
              <ul className="space-y-1">
                {m.cryptoData.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                    <LogoImage src={c.logoUrl} alt={c.name} fallbackText={c.icon} className="h-8 w-8 shrink-0 rounded-full border border-slate-100 bg-white object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums">
                        {m.usdIdrRate ? short(c.current_price * m.usdIdrRate) : `$${c.current_price.toLocaleString('en-US')}`}
                      </p>
                      <p className={cn('text-[11px] font-semibold tabular-nums', c.price_change_percentage_24h >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                        {c.price_change_percentage_24h >= 0 ? '+' : ''}{c.price_change_percentage_24h.toFixed(2)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100">
            <h3 className="mb-2 text-[15px] font-bold text-slate-900">Kurs ke Rupiah</h3>
            {m.exchangeRates.length === 0 ? (
              <p className="py-3 text-center text-[13px] text-slate-500">{m.loading ? 'Memuat…' : 'Data kurs belum tersedia.'}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {m.exchangeRates.map((r) => {
                  const code = /\(([A-Z]{3,5})\)/.exec(r.from)?.[1] ?? r.from;
                  return (
                    <li key={r.from} className="flex items-center justify-between py-2">
                      <span className="text-[13px] text-slate-600"><span className="font-semibold text-slate-900">{code}</span> {r.from.replace(/\s*\([A-Z]+\)$/, '')}</span>
                      <span className="text-[13px] font-bold text-slate-900 tabular-nums">{r.rate >= 100 ? Math.round(r.rate).toLocaleString('id-ID') : r.rate.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><ShieldCheck size={12} /> Sumber: CoinGecko & Open Exchange Rates · perbarui otomatis tiap menit</p>
          </section>
        </aside>
      </div>

      <CryptoWatchlistModal
        isOpen={m.showWatchlistModal}
        onClose={() => m.setShowWatchlistModal(false)}
        initialSelected={m.cryptoData.map((c): CoinOption => ({ id: c.id, name: c.name, symbol: c.symbol.split('/')[0], logoUrl: c.logoUrl }))}
        onSave={m.handleSaveWatchlist}
      />
    </div>
  );
}
