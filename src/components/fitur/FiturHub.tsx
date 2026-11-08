'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Search, Sparkles, X } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { HeaderSlot } from '@/components/Header';
import { useFeatures } from '@/lib/useFeatures';
import { FITUR, GOALS, TONE, isNew, readSeen, searchFitur, toneOf, type Fitur } from '@/lib/fiturCatalog';
import { useFiturStatus, type Status } from '@/components/fitur/useFiturStatus';
import { APP_VERSION } from '@/lib/version';
import type { FeatureId } from '@/lib/features';
import { cn } from '@/lib/utils';

const KEYFRAMES = `
@keyframes fitur-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes fitur-wiggle { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
`;
const enter = (i: number) => ({ animation: `fitur-in .45s ${Math.min(i, 24) * 0.03}s both cubic-bezier(.2,.8,.2,1)` });

function Spark({ data, cls }: { data: number[]; cls: string }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" className={cn('h-9 w-full', cls)} preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Ring({ value, cls }: { value: number; cls: string }) {
  const len = 2 * Math.PI * 15;
  return (
    <svg viewBox="0 0 36 36" className={cn('h-12 w-12 -rotate-90', cls)} aria-hidden>
      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-slate-800" />
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={`${value * len} ${len}`}
      />
    </svg>
  );
}

const toneText = (s?: Status) =>
  s?.tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : s?.tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : s?.tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-500 dark:text-slate-400';

function Badges({ f, coba: cobaSet }: { f: Fitur; coba: Set<string> }) {
  const baru = isNew(f, APP_VERSION);
  const coba = !baru && cobaSet.has(f.key);
  if (!baru && !coba) return null;
  return baru ? (
    <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
      Baru
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      Coba
    </span>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition',
        on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          on ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function Tile({
  f,
  i,
  s,
  coba,
  atur,
  on,
  to,
  onToggle,
}: {
  f: Fitur;
  i: number;
  s?: Status;
  coba: Set<string>;
  atur: boolean;
  on: boolean;
  to: string;
  onToggle: () => void;
}) {
  const t = TONE[toneOf(f)];
  const Icon = f.icon;
  return (
    <Link
      href={to}
      onClick={(e) => atur && e.preventDefault()}
      style={{
        ...enter(i),
        ...(atur && f.feature ? { animation: `fitur-wiggle .5s ${(i % 5) * 0.07}s ease-in-out infinite` } : {}),
      }}
      className="group flex items-center gap-3 rounded-[22px] bg-white p-3 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,.4)] dark:bg-slate-900 dark:ring-slate-800"
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm transition group-hover:scale-105',
          t.tile,
        )}
      >
        <Icon size={22} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14.5px] font-black text-slate-900 dark:text-white">{f.label}</span>
          <Badges f={f} coba={coba} />
        </span>
        <span
          className={cn(
            'block truncate text-[12.5px] font-semibold',
            s ? toneText(s) : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {s?.text ?? f.sub}
        </span>
      </span>
      {atur && f.feature ? <Toggle on={on} label={`Tampilkan ${f.label} di menu`} onChange={onToggle} /> : null}
    </Link>
  );
}

export function FiturHub({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const { active, save } = useFeatures();
  const { status, saran } = useFiturStatus();
  const [q, setQ] = useState('');
  const [atur, setAtur] = useState(false);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const href = (f: Fitur | string) => {
    const h = typeof f === 'string' ? f : f.href;
    if (variant !== 'app') return h;
    const item = typeof f === 'string' ? FITUR.find((x) => h.startsWith(x.href)) : f;
    return item?.appHref ? h.replace(item.href, item.appHref) : h;
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- riwayat buka fitur hanya ada di perangkat (setelah hydrate)
    setSeen(readSeen());
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeSet = new Set<string>(active);
  // Kartu besar (dua pertama) untuk fitur dengan status paling bermakna.
  const pinned = useMemo(() => {
    const rank = ['kekayaan', 'kanvas', 'cek', 'investasi', 'langganan', 'jejak', 'fokus', 'sehat'];
    const r = (k: string) => (rank.includes(k) ? rank.indexOf(k) : 99);
    return FITUR.filter((f) => f.feature && active.includes(f.feature)).sort((a, b) => r(a.key) - r(b.key));
  }, [active]);
  const results = q.trim() ? searchFitur(q) : null;
  // Ajakan "Coba": maksimal 3 fitur yang belum dipasang di menu dan belum pernah dibuka di perangkat ini.
  const coba = useMemo(
    () =>
      new Set(
        seen === null
          ? []
          : FITUR.filter((f) => f.feature && !active.includes(f.feature) && !seen.has(f.key))
              .slice(0, 3)
              .map((f) => f.key),
      ),
    [seen, active],
  );

  const toggle = async (id: FeatureId) => {
    setErr('');
    const next = activeSet.has(id) ? active.filter((x) => x !== id) : [...active, id];
    try {
      await save(next as FeatureId[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan pilihan fitur.');
    }
  };

  return (
    <div
      className={cn(
        'mx-auto max-w-6xl space-y-7 pb-14 text-slate-900 dark:text-white',
        variant === 'app' && 'px-4 pt-2',
      )}
    >
      <style>{KEYFRAMES}</style>

      <div className="flex flex-wrap items-end justify-between gap-3" style={enter(0)}>
        <div>
          <h1 className="text-[30px] font-black tracking-tight md:text-[40px]">Semua fitur</h1>
          <p className="text-[14.5px] text-slate-500 dark:text-slate-400">
            Satu tempat untuk semua alat keuanganmu — lengkap dengan kabar terbarunya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAtur((a) => !a)}
            className={cn(
              'h-10 rounded-full px-4 text-[13.5px] font-bold transition',
              atur
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700',
            )}
          >
            {atur ? 'Selesai' : 'Atur menu'}
          </button>
          {variant === 'web' ? <HeaderSlot /> : null}
        </div>
      </div>

      <label
        className="flex h-14 items-center gap-3 rounded-[20px] bg-white px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 dark:bg-slate-900 dark:ring-slate-700"
        style={enter(1)}
      >
        <Search size={20} className="text-slate-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari fitur… mis. pajak, cicilan, nikah"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-slate-400"
        />
        {q ? (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => setQ('')}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        ) : variant === 'web' ? (
          <kbd className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-500 sm:block dark:bg-slate-800">
            Ctrl K
          </kbd>
        ) : null}
      </label>
      {err ? <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-[13px] font-semibold text-rose-700">{err}</p> : null}
      {atur ? (
        <p className="rounded-2xl bg-indigo-50 px-4 py-3 text-[13px] font-semibold text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
          Nyalakan fitur yang ingin tampil di menu samping. Fitur yang dimatikan tetap bisa dibuka dari halaman ini.
        </p>
      ) : null}

      {results ? (
        <section>
          <h2 className="mb-3 text-[15px] font-black">
            {results.length ? `${results.length} fitur cocok` : 'Tidak ada fitur yang cocok'}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((f, i) => (
              <Tile
                key={f.key}
                f={f}
                i={i}
                s={status[f.key]}
                coba={coba}
                atur={atur}
                on={Boolean(f.feature && activeSet.has(f.feature))}
                to={href(f)}
                onToggle={() => f.feature && void toggle(f.feature)}
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section
            style={enter(2)}
            className="relative overflow-hidden rounded-[30px] bg-slate-950 p-5 text-white ring-1 ring-white/10 md:p-6"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-orange-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/30 to-sky-500/20 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <LeoBadge topic="investasi" size={52} />
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                  <Sparkles size={13} /> Untukmu hari ini
                </p>
                <p className="text-[19px] font-black leading-tight">Ini yang paling berguna sekarang</p>
              </div>
            </div>
            <div
              className={cn(
                'relative mt-4 grid gap-2.5',
                saran.length >= 3 ? 'md:grid-cols-3' : saran.length === 2 ? 'md:grid-cols-2' : '',
              )}
            >
              {saran.map((s) => (
                <Link
                  key={s.key + s.title}
                  href={href(s.href)}
                  className="group rounded-[20px] bg-white/[.07] p-4 ring-1 ring-white/10 transition hover:bg-white/[.12]"
                >
                  <span
                    className={cn(
                      'mb-2 inline-block h-1.5 w-8 rounded-full',
                      s.tone === 'warn' ? 'bg-amber-300' : s.tone === 'good' ? 'bg-emerald-300' : 'bg-sky-300',
                    )}
                  />
                  <p className="text-[15px] font-black">{s.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-white/65">{s.text}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-white/85">
                    Buka <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {pinned.length ? (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[17px] font-black">Fitur kamu</h2>
                <span className="text-[12.5px] text-slate-400">tampil di menu samping</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {pinned.map((f, i) => {
                  const t = TONE[toneOf(f)];
                  const s = status[f.key];
                  const big = i < 2;
                  const Icon = f.icon;
                  return (
                    <Link
                      key={f.key}
                      href={href(f)}
                      onClick={(e) => atur && e.preventDefault()}
                      style={{
                        ...enter(3 + i),
                        ...(atur ? { animation: `fitur-wiggle .5s ${(i % 5) * 0.07}s ease-in-out infinite` } : {}),
                      }}
                      className={cn(
                        'group relative flex flex-col justify-between overflow-hidden rounded-[26px] bg-white p-4 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,.45)] dark:bg-slate-900 dark:ring-slate-800',
                        big ? 'col-span-2 min-h-[150px] md:p-5' : 'min-h-[132px]',
                      )}
                    >
                      <div
                        className={cn(
                          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl',
                          t.soft,
                        )}
                      />
                      <div className="relative flex items-start gap-3">
                        <span
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm',
                            t.tile,
                          )}
                        >
                          <Icon size={21} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5">
                            <span className="truncate text-[15px] font-black">{f.label}</span>
                            <Badges f={f} coba={coba} />
                          </p>
                          <p className="truncate text-[12px] text-slate-400">{f.sub}</p>
                        </div>
                        {atur ? (
                          <Toggle
                            on
                            label={`Sembunyikan ${f.label} dari menu`}
                            onChange={() => void toggle(f.feature!)}
                          />
                        ) : null}
                      </div>
                      <div className="relative mt-3 flex items-end justify-between gap-3">
                        <p className={cn('text-[14px] font-black leading-snug', s ? toneText(s) : 'text-slate-400')}>
                          {s?.text ?? 'Buka'}
                        </p>
                        {big && s?.spark ? (
                          <div className="w-32 shrink-0">
                            <Spark data={s.spark} cls={t.text} />
                          </div>
                        ) : s?.progress !== undefined ? (
                          <Ring value={s.progress} cls={t.text} />
                        ) : (
                          <ArrowRight
                            size={18}
                            className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                          />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {GOALS.map((g, gi) => {
            const items = FITUR.filter((f) => f.goal === g.id && !(f.feature && activeSet.has(f.feature) && !atur));
            if (!items.length) return null;
            const t = TONE[g.tone];
            return (
              <section key={g.id} style={enter(6 + gi)}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className={cn('h-6 w-1.5 rounded-full bg-gradient-to-b', t.tile)} />
                  <div>
                    <h2 className="text-[17px] font-black leading-tight">{g.label}</h2>
                    <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{g.sub}</p>
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((f, i) => (
                    <Tile
                      key={f.key}
                      f={f}
                      i={i}
                      s={status[f.key]}
                      coba={coba}
                      atur={atur}
                      on={Boolean(f.feature && activeSet.has(f.feature))}
                      to={href(f)}
                      onToggle={() => f.feature && void toggle(f.feature)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-slate-400">
            <Check size={14} /> Angka di halaman ini dihitung dari catatanmu sendiri dan diperbarui setiap kali dibuka.
          </p>
        </>
      )}
    </div>
  );
}
