"use client";

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { AS_OF, BI_RATE, LPS, SBN_KIND_INFO, SBN_RETAIL, SBN_SOURCES, TAX_DEPOSITO, TAX_SBN, isStale, monthlyNet } from '@/lib/sbnData';
import { cn, formatIDR } from '@/lib/utils';

// Tab SBN: tangga bunga (LPS → BI-Rate → SBN ritel tertinggi), "Sebulan dapat
// berapa?", dan semua seri ritel. Semua angka dari lib/sbnData.ts (resmi,
// diperbarui manual, bertanggal AS_OF).

const fmtDate = (ymd: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T00:00:00`));
const pct = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
const AMOUNTS = [1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];
const amountLabel = (n: number) => `Rp ${n / 1_000_000} jt`;
type Filter = 'semua' | 'tetap' | 'mengambang' | 'syariah' | 'dijual';

export function TabSbn() {
  const reduce = useReducedMotion();
  const [amount, setAmount] = useState(10_000_000);
  const [filter, setFilter] = useState<Filter>('semua');
  const [sort, setSort] = useState<'kupon' | 'tenor'>('kupon');
  const top = SBN_RETAIL[0];
  const stale = isStale();

  const ladder = [
    { label: 'Deposito LPS', sub: 'dijamin, paling tinggi', rate: LPS.bankUmum, cls: 'from-slate-200 to-slate-300 text-slate-700' },
    { label: 'BI-Rate', sub: `diputuskan ${fmtDate(BI_RATE.decided)}`, rate: BI_RATE.rate, cls: 'from-violet-200 to-violet-300 text-violet-900' },
    { label: 'SBN ritel', sub: top ? `tertinggi: ${top.code}` : '', rate: top?.coupon ?? 0, cls: 'from-teal-500 to-emerald-600 text-white' },
  ];
  const maxRate = Math.max(...ladder.map((l) => l.rate));

  const compare = [
    ...SBN_RETAIL.slice(0, 5).map((s) => ({ key: s.code, label: s.code, sub: pct(s.coupon), value: monthlyNet(amount, s.coupon, TAX_SBN), color: SBN_KIND_INFO[s.kind].color })),
    { key: 'dep', label: 'Deposito', sub: `bunga LPS ${pct(LPS.bankUmum)}`, value: monthlyNet(amount, LPS.bankUmum, TAX_DEPOSITO), color: '#94a3b8' },
  ];
  const maxMonthly = Math.max(...compare.map((c) => c.value), 1);

  const list = SBN_RETAIL.filter((s) =>
    filter === 'tetap' ? !s.floating : filter === 'mengambang' ? s.floating : filter === 'syariah' ? SBN_KIND_INFO[s.kind].syariah : filter === 'dijual' ? SBN_KIND_INFO[s.kind].tradable : true
  ).sort((a, b) => (sort === 'kupon' ? b.coupon - a.coupon : b.tenorYears - a.tenorYears));
  const scaleMax = 8;

  return (
    <div className="space-y-4">
      {stale && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-100">
          <AlertTriangle size={16} className="shrink-0" /> Angka di halaman ini per {fmtDate(AS_OF)} dan mungkin sudah berubah — cek sumber resminya di bawah.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tangga bunga */}
        <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tangga bunga</p>
          <h2 className="text-[20px] font-extrabold tracking-tight text-slate-900">SBN ritel sampai {top ? pct(top.coupon) : '—'} setahun</h2>
          {/* Tinggi batang proporsional terhadap bunga tertinggi (85% area); Leo duduk di atas batang tertinggi. */}
          <div className="mt-4 grid h-60 grid-cols-3 items-end gap-2.5">
            {ladder.map((l, i) => {
              const h = (l.rate / maxRate) * 78;
              const tallest = l.rate === maxRate;
              return (
                <div key={l.label} className="relative flex h-full flex-col justify-end">
                  {tallest && (
                    <motion.div
                      initial={reduce ? false : { y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 18 }}
                      className="absolute inset-x-0 flex justify-center"
                      style={{ bottom: `calc(${h}% - 10px)` }}
                    >
                      <LeoMascot mood="happy" size={60} />
                    </motion.div>
                  )}
                  <motion.div
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.7, delay: i * 0.12, ease: 'easeOut' }}
                    className={cn('flex items-start justify-center rounded-t-[18px] bg-gradient-to-b pt-2 text-[15px] font-extrabold tabular-nums', l.cls)}
                  >
                    {pct(l.rate)}
                  </motion.div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2.5 text-center">
            {ladder.map((l) => (
              <div key={l.label}>
                <p className="text-[13px] font-semibold text-slate-800">{l.label}</p>
                <p className="text-[11px] text-slate-400">{l.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sebulan dapat berapa */}
        <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Sebulan dapat berapa?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => setAmount(a)} className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold', a === amount ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {amountLabel(a)}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {compare.map((c, i) => (
              <li key={c.key} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{c.label}</p>
                  <p className="truncate text-[11px] text-slate-400">{c.sub}</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <motion.div key={`${c.key}-${amount}`} initial={reduce ? false : { width: 0 }} animate={{ width: `${(c.value / maxMonthly) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} className="h-full rounded-full" style={{ background: c.color }} />
                </div>
                <p className="w-24 text-right text-[14px] font-bold text-slate-900 tabular-nums">{formatIDR(c.value)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">Per bulan setelah pajak: kupon SBN {TAX_SBN}%, bunga deposito {TAX_DEPOSITO}%. Kupon mengambang (SBR/ST) bisa berubah tiap 3 bulan, tapi tidak turun di bawah kupon awalnya.</p>
        </section>
      </div>

      {/* Semua seri */}
      <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-100">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Seri ritel</p>
          <p className="text-[12px] text-slate-400">{list.length} seri · per {fmtDate(AS_OF)}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {([['semua', 'Semua'], ['tetap', 'Kupon tetap'], ['mengambang', 'Mengambang'], ['syariah', 'Syariah'], ['dijual', 'Bisa dijual']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{l}</button>
            ))}
          </div>
          <div className="flex rounded-full bg-slate-100 p-0.5">
            {(['kupon', 'tenor'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSort(k)} className={cn('rounded-full px-3 py-1 text-[12px] font-semibold capitalize', sort === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{k}</button>
            ))}
          </div>
        </div>
        <div className="relative mt-4 h-4 text-[10px] font-semibold text-slate-400" aria-hidden>
          <span className="absolute -translate-x-1/2" style={{ left: `calc(56px + (100% - 56px) * ${LPS.bankUmum / scaleMax})` }}>LPS {pct(LPS.bankUmum)}</span>
          <span className="absolute -translate-x-1/2" style={{ left: `calc(56px + (100% - 56px) * ${BI_RATE.rate / scaleMax})` }}>BI {pct(BI_RATE.rate)}</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {list.map((s, i) => {
            const info = SBN_KIND_INFO[s.kind];
            return (
              <motion.li key={s.code} layout={!reduce} initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-extrabold" style={{ background: `${info.color}1a`, color: info.color }}>{s.kind}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-slate-900">{s.code}</p>
                    <p className="truncate text-[12px] text-slate-500">{s.tenorYears} tahun · {s.floating ? 'mengambang' : 'tetap'} · {info.tradable ? 'bisa dijual' : 'bisa dicairkan awal'}{info.syariah ? ' · syariah' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[17px] font-extrabold text-slate-900 tabular-nums">{pct(s.coupon)}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">≈ {formatIDR(monthlyNet(amount, s.coupon, TAX_SBN))}/bln</p>
                  </div>
                </div>
                <div className="relative ml-14 mt-2 h-2 rounded-full bg-slate-100">
                  <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${(s.coupon / scaleMax) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 + i * 0.04 }} className="h-full rounded-full" style={{ background: info.color }} />
                  <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-slate-400" style={{ left: `${(LPS.bankUmum / scaleMax) * 100}%` }} />
                  <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-violet-400" style={{ left: `${(BI_RATE.rate / scaleMax) * 100}%` }} />
                </div>
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">≈ per bulan dari {amountLabel(amount)} setelah pajak {TAX_SBN}%. Seri hanya bisa dibeli saat masa penawaran; seri yang sudah beredar dijual-beli di pasar sekunder.</p>
      </section>

      <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-100">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Sumber</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {SBN_SOURCES.map((src) => (
            <li key={src.name}>
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-slate-900">{src.name}</span>
                  <span className="block text-[12px] text-slate-500">{src.what}</span>
                </span>
                <ExternalLink size={15} className="shrink-0 text-slate-400" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">Angka resmi per {fmtDate(AS_OF)}. Bukan ajakan membeli — pilihannya tetap di kamu.</p>
      </section>
    </div>
  );
}
