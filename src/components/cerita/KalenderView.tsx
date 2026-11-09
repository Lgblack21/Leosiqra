'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { LeoFace } from './LeoFace';
import { MOODS, moodOf, storyImageUrl, wibToday, type StoryYear } from '@/lib/stories';
import { cn } from '@/lib/utils';

// Kalender cerita. Bulan: tiap tanggal = kartu kecil berisi FOTO hari itu (atau ilustrasinya),
// kalau tidak ada foto = wajah Leo sesuai mood; nomor tanggal & cuaca di pojok. Tahun: 12 bulan
// mini berwarna mood/pengeluaran — ketuk bulan untuk membukanya.
const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const SPEND = ['#E0E7FF', '#A5B4FC', '#6366F1', '#3730A3'];
const pad = (n: number) => String(n).padStart(2, '0');
const rb = (n: number) =>
  n >= 1e6
    ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : n >= 1e3
      ? `Rp${Math.round(n / 1e3)} rb`
      : `Rp${n.toLocaleString('id-ID')}`;

export function KalenderView({
  year,
  data,
  onYear,
  onOpen,
}: {
  year: number;
  data: StoryYear | null;
  onYear: (y: number) => void;
  onOpen: (date: string) => void;
}) {
  const today = wibToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;
  const [view, setView] = useState<'bulan' | 'tahun'>('bulan');
  const [month, setMonth] = useState(() => (year === thisYear ? thisMonth : 11));
  const [colorBy, setColorBy] = useState<'mood' | 'uang'>('mood');
  const byDate = new Map((data?.items ?? []).map((i) => [i.date, i]));

  const goMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (y > thisYear || (y === thisYear && m > thisMonth)) return;
    setMonth(m);
    if (y !== year) onYear(y);
  };

  // Tampilan tahun: gulir KOTAK ini saja ke bulan berjalan (scrollIntoView ikut menggulir
  // halaman yang dikunci → judul atas terpotong).
  const box = useRef<HTMLDivElement>(null);
  const nowMonth = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (view !== 'tahun' || year !== thisYear) return;
    const scroller = box.current?.closest<HTMLElement>('[data-scroll]');
    const el = nowMonth.current;
    if (scroller && el) scroller.scrollTop = Math.max(0, el.offsetTop - scroller.clientHeight / 3);
  }, [view, year, thisYear]);

  const spends = Object.values(data?.spend ?? {})
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const q = (p: number) => spends[Math.min(spends.length - 1, Math.floor(p * spends.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const spendColor = (v: number) => (v <= 0 ? null : SPEND[v <= cuts[0] ? 0 : v <= cuts[1] ? 1 : v <= cuts[2] ? 2 : 3]);

  const key = `${year}-${pad(month + 1)}`;
  const monthItems = (data?.items ?? []).filter((i) => i.date.startsWith(key));
  const monthSpend = Object.entries(data?.spend ?? {})
    .filter(([d]) => d.startsWith(key))
    .reduce((a, [, v]) => a + v, 0);
  const moodCount = MOODS.map((m) => ({ ...m, n: monthItems.filter((i) => i.mood === m.id).length }));
  const moodTotal = moodCount.reduce((a, m) => a + m.n, 0);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <button
          type="button"
          onClick={() => (view === 'bulan' ? goMonth(-1) : onYear(year - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Sebelumnya"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-[120px] text-center fs-15 font-extrabold text-slate-900 dark:text-white">
          {view === 'bulan' ? `${MONTHS[month]} ${year}` : year}
        </span>
        <button
          type="button"
          disabled={view === 'bulan' ? year === thisYear && month >= thisMonth : year >= thisYear}
          onClick={() => (view === 'bulan' ? goMonth(1) : onYear(year + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          aria-label="Berikutnya"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="flex gap-1.5">
        {view === 'tahun' && (
          <div className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(['mood', 'uang'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setColorBy(k)}
                className={cn(
                  'rounded-full px-3 py-1 fs-12 font-bold',
                  colorBy === k
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500',
                )}
              >
                {k === 'mood' ? 'Mood' : 'Uang'}
              </button>
            ))}
          </div>
        )}
        <div className="flex rounded-full bg-slate-900 p-1 dark:bg-white">
          {(['bulan', 'tahun'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={cn(
                'rounded-full px-3.5 py-1 fs-12 font-bold',
                view === k
                  ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white'
                  : 'text-white/70 dark:text-slate-500',
              )}
            >
              {k === 'bulan' ? 'Bulan' : 'Tahun'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (view === 'tahun') {
    return (
      <div ref={box} className="space-y-3 pb-2">
        {header}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS.map((name, mi) => {
            const lead = (new Date(Date.UTC(year, mi, 1)).getUTCDay() + 6) % 7;
            const len = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
            return (
              <button
                key={name}
                ref={year === thisYear && mi === thisMonth ? nowMonth : undefined}
                type="button"
                disabled={year === thisYear && mi > thisMonth}
                onClick={() => {
                  setMonth(mi);
                  setView('bulan');
                }}
                className="rounded-[20px] bg-white p-2.5 text-left ring-1 ring-slate-100 transition-shadow hover:shadow-md disabled:opacity-60 disabled:hover:shadow-none dark:bg-slate-900 dark:ring-slate-800"
              >
                <p className="mb-1.5 fs-12 font-bold text-slate-700 dark:text-slate-200">{name}</p>
                <div className="grid grid-cols-7 gap-[3px]">
                  {Array.from({ length: lead }, (_, i) => (
                    <span key={`x${i}`} />
                  ))}
                  {Array.from({ length: len }, (_, di) => {
                    const d = `${year}-${pad(mi + 1)}-${pad(di + 1)}`;
                    const item = byDate.get(d);
                    const color =
                      colorBy === 'mood'
                        ? (moodOf(item?.mood)?.color ?? (item ? '#C7D2FE' : null))
                        : spendColor(data?.spend?.[d] ?? 0);
                    return (
                      <span
                        key={d}
                        className={cn(
                          'aspect-square rounded-[4px]',
                          d === today && 'ring-2 ring-indigo-500',
                          !color && (d > today ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-slate-100 dark:bg-slate-800'),
                        )}
                        style={color ? { background: color } : undefined}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 fs-11 text-slate-500">
          {colorBy === 'mood' ? (
            MOODS.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: m.color }} />
                {m.emoji} {m.label}
              </span>
            ))
          ) : (
            <>
              Pengeluaran:
              {SPEND.map((c, i) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
                  {['rendah', 'sedang', 'tinggi', 'paling tinggi'][i]}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const len = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return (
    <div ref={box} className="grid grid-cols-1 gap-3 pb-2 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-3">
        {header}
        <div className="rounded-[28px] bg-white p-2.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-4">
          <div className="mb-1.5 grid grid-cols-7 gap-1.5 md:gap-2">
            {WEEK.map((w, i) => (
              <span key={w} className={cn('text-center fs-11 font-bold', i === 6 ? 'text-rose-400' : 'text-slate-400')}>
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`x${i}`} />
            ))}
            {Array.from({ length: len }, (_, di) => {
              const d = `${year}-${pad(month + 1)}-${pad(di + 1)}`;
              const item = byDate.get(d);
              const m = moodOf(item?.mood);
              const img = item
                ? item.has_ai
                  ? storyImageUrl(d, 'ai', item.updated_at)
                  : item.has_photo
                    ? storyImageUrl(d, 'photo', item.updated_at)
                    : null
                : null;
              const future = d > today;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={future}
                  onClick={() => onOpen(d)}
                  aria-label={`${di + 1} ${MONTHS[month]}${item ? ' · ada cerita' : ''}`}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-xl transition-transform md:aspect-[3/2] md:rounded-2xl lg:aspect-[7/5]',
                    !future && 'hover:scale-[1.04] active:scale-95',
                    d === today && 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900',
                    !item && (future ? 'bg-slate-50 dark:bg-slate-800/30' : 'bg-slate-100 dark:bg-slate-800'),
                  )}
                  style={item && !img ? { background: `${m?.color ?? '#C7D2FE'}2e` } : undefined}
                >
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element -- gambar privat dari API
                    <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {item && !img && <LeoFace mood={item.mood} className="absolute inset-0 m-auto h-[76%] w-[76%]" />}
                  <span
                    className={cn(
                      'absolute left-1 top-1 rounded-md px-1 fs-10 font-extrabold leading-4 md:left-1.5 md:top-1.5 md:fs-11',
                      img
                        ? 'bg-black/45 text-white'
                        : future
                          ? 'text-slate-300 dark:text-slate-600'
                          : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {di + 1}
                  </span>
                  {m && (
                    <span
                      className="absolute bottom-0.5 right-0.5 fs-11 leading-none md:bottom-1 md:right-1 md:fs-14"
                      aria-hidden
                    >
                      {m.emoji}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-[24px] bg-gradient-to-br from-amber-100 via-pink-100 to-violet-100 p-4 dark:from-amber-500/15 dark:via-pink-500/15 dark:to-violet-500/15">
          <p className="fs-12 font-semibold text-slate-600 dark:text-slate-300">
            {MONTHS[month]} {year}
          </p>
          <p className="fsh-26 font-black tracking-tight text-slate-900 dark:text-white">
            {monthItems.length} <span className="fs-14 font-bold text-slate-500">hari bercerita</span>
          </p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/70 dark:bg-slate-900/50">
            {moodTotal > 0 &&
              moodCount
                .filter((x) => x.n)
                .map((x) => <span key={x.id} style={{ width: `${(x.n / moodTotal) * 100}%`, background: x.color }} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 fs-11 font-semibold text-slate-600 dark:text-slate-300">
            {moodCount
              .filter((x) => x.n)
              .map((x) => (
                <span key={x.id}>
                  {x.emoji} {x.n}
                </span>
              ))}
            {!moodTotal && <span>Belum ada mood bulan ini.</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
            <Wallet size={18} />
          </span>
          <span>
            <span className="block fs-12 text-slate-500">Pengeluaran bulan ini</span>
            <span className="block fs-17 font-extrabold text-slate-900 dark:text-white">
              {rb(Math.round(monthSpend))}
            </span>
          </span>
        </div>
      </aside>
    </div>
  );
}
