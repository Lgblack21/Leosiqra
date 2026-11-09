'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, FlaskConical, Info } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { useFinance } from '@/components/kanvas/useFinance';
import { rp, short } from '@/lib/kanvas/data';
import { computeRapor, gradeOf, simulate, WEIGHTS, type Indicator, type Rapor } from '@/lib/rapor';
import { cn } from '@/lib/utils';

// Rapor Keuangan: nilai 0–100 + huruf, tujuh indikator yang bisa dibuka, tren 6 bulan,
// simulasi "bagaimana kalau", dan rencana perbaikan berurutan. Semua dari catatan user sendiri.

const APP: Record<string, string> = {
  '/membership/kekayaan': '/app/wallet',
  '/membership/recurring': '/app/recurring',
  '/membership/investment': '/app/investments',
  '/membership/transactions/input': '/app/transactions',
};
const GRADE_CLS = {
  emerald: {
    text: 'text-emerald-500',
    stroke: '#10b981',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  teal: {
    text: 'text-teal-500',
    stroke: '#14b8a6',
    soft: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  },
  amber: {
    text: 'text-amber-500',
    stroke: '#f59e0b',
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  orange: {
    text: 'text-orange-500',
    stroke: '#f97316',
    soft: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  rose: {
    text: 'text-rose-500',
    stroke: '#f43f5e',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
};
const scoreTone = (s: number | null) => (s === null ? null : gradeOf(s).tone);

function Gauge({ score }: { score: number | null }) {
  const r = 70;
  const len = Math.PI * r;
  const tone = scoreTone(score);
  return (
    <svg viewBox="0 0 180 100" className="w-full max-w-[260px]" aria-hidden>
      <path
        d="M20 90 A70 70 0 0 1 160 90"
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        className="stroke-white/10"
      />
      {score !== null ? (
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          stroke={GRADE_CLS[tone!].stroke}
          strokeDasharray={`${(score / 100) * len} ${len}`}
        />
      ) : null}
    </svg>
  );
}

function Bar({ score }: { score: number | null }) {
  const tone = scoreTone(score);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {score !== null ? (
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(4, score)}%`, background: GRADE_CLS[tone!].stroke }}
        />
      ) : null}
    </div>
  );
}

function Trend({ r }: { r: Rapor }) {
  const rows = r.months;
  const max = Math.max(1, ...rows.map((x) => Math.max(x.income, x.expense)));
  return (
    <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-baseline justify-between">
        <h2 className="fs-16 font-black">Masuk vs keluar, 6 bulan</h2>
        <span className="flex gap-3 fs-11.5 font-semibold text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Masuk
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Keluar
          </span>
        </span>
      </div>
      <div className="mt-4 flex h-36 items-end gap-2">
        {rows.map((x) => (
          <div key={x.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-[18px] rounded-t-md bg-emerald-500"
                style={{ height: `${(x.income / max) * 100}%` }}
                title={`Masuk ${rp(x.income)}`}
              />
              <div
                className="w-1/2 max-w-[18px] rounded-t-md bg-rose-400"
                style={{ height: `${(x.expense / max) * 100}%` }}
                title={`Keluar ${rp(x.expense)}`}
              />
            </div>
            <span className="fs-11 font-semibold text-slate-400">{x.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 fs-11.5 text-slate-400">* bulan berjalan</p>
    </div>
  );
}

function IndicatorCard({ ind, href }: { ind: Indicator; href: (h: string) => string }) {
  const [open, setOpen] = useState(false);
  const tone = scoreTone(ind.score);
  const hist = ind.history?.filter((v): v is number => v !== null) ?? [];
  return (
    <div className="rounded-[22px] bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl fs-15 font-black tabular-nums',
              tone ? GRADE_CLS[tone].soft : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
            )}
          >
            {ind.score ?? '–'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="fs-15 font-black text-slate-900 dark:text-white">{ind.label}</p>
            <p className="truncate fs-12.5 text-slate-500">
              <span className="font-bold text-slate-700 dark:text-slate-200">{ind.value}</span> · {ind.target}
            </p>
          </div>
          <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
        <div className="mt-3">
          <Bar score={ind.score} />
        </div>
      </button>
      {open ? (
        <div className="space-y-2.5 border-t border-slate-100 px-4 pb-4 pt-3 fs-13 dark:border-slate-800">
          <p className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {ind.detail}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <b>Kenapa penting:</b> {ind.why}
          </p>
          {ind.score !== null && ind.score < 70 ? (
            <p className="text-slate-600 dark:text-slate-300">
              <b>Cara memperbaiki:</b> {ind.fix}
            </p>
          ) : null}
          {hist.length >= 2 ? (
            <div className="flex items-end gap-1">
              {hist.map((v, i) => (
                <span
                  key={i}
                  className="w-3 rounded-sm"
                  style={{ height: `${Math.max(4, v * 0.32)}px`, background: GRADE_CLS[gradeOf(v).tone].stroke }}
                />
              ))}
              <span className="ml-2 fs-11.5 text-slate-400">nilai per bulan</span>
            </div>
          ) : null}
          <Link
            href={href(ind.href)}
            className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400"
          >
            {ind.linkLabel} <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Simulator({ r, m }: { r: Rapor; m: Parameters<typeof simulate>[1] }) {
  const [cut, setCut] = useState(10);
  const [extra, setExtra] = useState(0);
  const res = simulate(r, m, cut / 100, extra);
  const diff = res.score !== null && r.score !== null ? res.score - r.score : null;
  const step = r.income > 10_000_000 ? 500_000 : 100_000;
  return (
    <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="flex items-center gap-2 fs-16 font-black">
        <FlaskConical size={18} className="text-violet-500" /> Bagaimana kalau…
      </h2>
      <p className="fs-12.5 text-slate-500">Geser untuk melihat efeknya ke nilai rapormu.</p>
      <label className="mt-4 block">
        <span className="flex justify-between fs-13 font-bold">
          Pangkas pengeluaran{' '}
          <span className="text-violet-600 dark:text-violet-400">
            {cut}% · hemat {short((r.expense * cut) / 100)}/bln
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={40}
          value={cut}
          onChange={(e) => setCut(Number(e.target.value))}
          className="mt-2 w-full accent-violet-600"
        />
      </label>
      <label className="mt-3 block">
        <span className="flex justify-between fs-13 font-bold">
          Tambahan pemasukan <span className="text-violet-600 dark:text-violet-400">{rp(extra)}/bln</span>
        </span>
        <input
          type="range"
          min={0}
          max={step * 20}
          step={step}
          value={extra}
          onChange={(e) => setExtra(Number(e.target.value))}
          className="mt-2 w-full accent-violet-600"
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="fs-11 font-bold uppercase tracking-wider text-slate-400">Nilai</p>
          <p className="fsh-22 font-black tabular-nums">
            {res.score ?? '–'}
            {diff ? (
              <span className={cn('ml-1 fs-13', diff > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {diff > 0 ? `+${diff}` : diff}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="fs-11 font-bold uppercase tracking-wider text-slate-400">Sisa/bulan</p>
          <p className={cn('fs-16 font-black tabular-nums', res.left < 0 && 'text-rose-600')}>{short(res.left)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="fs-11 font-bold uppercase tracking-wider text-slate-400">Dana darurat 3×</p>
          <p className="fs-16 font-black">
            {res.monthsToBuffer === null
              ? 'tidak tercapai'
              : res.monthsToBuffer === 0
                ? 'sudah ✓'
                : `${res.monthsToBuffer} bln`}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CekKeuanganApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const fin = useFinance();
  const href = (h: string) => (variant === 'app' ? (APP[h.split('?')[0]] ?? h) : h);
  const r = useMemo(() => (fin ? computeRapor(fin.tx, fin.metrics) : null), [fin]);
  const m = fin?.metrics;
  const plan = r
    ? [...r.indicators]
        .filter((i) => i.score !== null && i.score < 70)
        .sort((a, b) => (100 - b.score!) * WEIGHTS[b.id] - (100 - a.score!) * WEIGHTS[a.id])
        .slice(0, 3)
    : [];
  const tone = r?.grade ? GRADE_CLS[r.grade.tone] : null;
  const delta = r && r.score !== null && r.prevScore !== null ? r.score - r.prevScore : null;
  const leo = !r
    ? 'Sebentar, Leo sedang membaca catatanmu…'
    : r.score === null
      ? 'Catat pemasukan dan pengeluaranmu dulu — rapornya langsung terisi, tidak perlu menunggu sebulan.'
      : plan[0]
        ? `Paling berdampak sekarang: ${plan[0].label.toLowerCase()}. ${plan[0].fix}`
        : 'Semua indikator utama sudah sehat. Pertahankan, lalu naikkan porsi investasimu pelan-pelan.';

  return (
    <div
      className={cn(
        'text-slate-900 dark:text-white',
        variant === 'app' &&
          'min-h-dvh bg-[#f6f5f1] px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))] dark:bg-slate-950',
      )}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-3">
          {variant === 'app' ? (
            <Link
              href="/app/more"
              aria-label="Kembali"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <ArrowLeft size={18} />
            </Link>
          ) : null}
          <div className="flex-1">
            <h1 className="fsh-26 font-black tracking-tight md:fsh-34">Rapor Keuangan</h1>
            <p className="fs-13.5 text-slate-500 dark:text-slate-400">
              Nilai kesehatan keuanganmu dari catatan & Kekayaan sendiri — diperbarui setiap kali dibuka.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white ring-1 ring-white/10">
            <div className="flex flex-col items-center text-center">
              <Gauge score={r?.score ?? null} />
              <div className="-mt-14 flex items-end gap-2">
                <span className="fsh-52 font-black leading-none tabular-nums">{r?.score ?? '–'}</span>
                {r?.grade ? <span className={cn('mb-1.5 fsh-30 font-black', tone!.text)}>{r.grade.letter}</span> : null}
              </div>
              <p className="mt-1 fs-15 font-bold">{r?.grade?.label ?? (r ? 'Belum bisa dinilai' : 'Memuat…')}</p>
              <p className="mt-0.5 fs-12 text-white/50">{r?.basis}</p>
              {delta !== null && delta !== 0 ? (
                <span
                  className={cn(
                    'mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 fs-12 font-bold',
                    delta > 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300',
                  )}
                >
                  {delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {delta > 0 ? `+${delta}` : delta} dari bulan lalu
                </span>
              ) : null}
              {r?.mode === 'perkiraan' ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 fs-12 font-bold text-amber-300">
                  <Info size={13} /> Perkiraan — makin akurat setelah sebulan penuh
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/[.07] p-3.5 ring-1 ring-white/10">
              <LeoBadge topic="investasi" size={40} />
              <p className="fs-13 leading-relaxed text-white/80">{leo}</p>
            </div>
            {r && r.mode !== 'kosong' ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Masuk/bln', r.income, 'text-emerald-300'],
                  ['Keluar/bln', r.expense, 'text-rose-300'],
                  ['Cicilan/bln', r.cicilan, 'text-amber-300'],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-2xl bg-white/[.05] px-2 py-2.5 ring-1 ring-white/10">
                    <p className="fs-10.5 font-bold uppercase tracking-wider text-white/45">{l as string}</p>
                    <p className={cn('fs-15 font-black tabular-nums', c as string)}>{short(v as number)}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {r ? (
              <div className="mt-4 space-y-1.5">
                {r.indicators.map((i) => (
                  <div key={i.id} className="flex items-center gap-2.5 fs-12.5">
                    <span className="w-[42%] truncate text-white/70">{i.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      {i.score !== null ? (
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, i.score)}%`,
                            background: GRADE_CLS[gradeOf(i.score).tone].stroke,
                          }}
                        />
                      ) : null}
                    </span>
                    <span className="w-8 text-right font-black tabular-nums text-white/85">{i.score ?? '–'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            {r ? <Trend r={r} /> : null}
            {r && m && r.mode !== 'kosong' ? <Simulator r={r} m={m} /> : null}
          </div>
        </div>

        {plan.length ? (
          <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
            <h2 className="fs-16 font-black">Rencana perbaikan</h2>
            <p className="fs-12.5 text-slate-500">Diurutkan dari yang paling berdampak ke nilaimu.</p>
            <div className="mt-3 space-y-2">
              {plan.map((p, i) => (
                <Link
                  key={p.id}
                  href={href(p.href)}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 fs-12 font-black text-white dark:bg-white dark:text-slate-900">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block fs-14 font-bold">{p.label}</span>
                    <span className="block fs-12.5 text-slate-500">{p.fix}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="mb-3 fs-16 font-black">Tujuh indikator</h2>
          <div className="grid items-start gap-3 md:grid-cols-2">
            {(r?.indicators ?? []).map((ind) => (
              <IndicatorCard key={ind.id} ind={ind} href={href} />
            ))}
          </div>
        </div>

        <p className="fs-11.5 leading-relaxed text-slate-400">
          Batas yang dipakai adalah pedoman umum perencanaan keuangan, bukan nasihat keuangan pribadi. Beli investasi,
          transfer, dan utang-piutang tidak dihitung sebagai pemasukan/pengeluaran; bayar utang dihitung sebagai
          cicilan.
        </p>
      </div>
    </div>
  );
}
