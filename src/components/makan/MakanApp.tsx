'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  ImagePlus,
  PenLine,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { LeoGuide, LeoBadge } from '@/components/ai/LeoGuide';
import { MealSheet, type SheetState } from '@/components/makan/MealSheet';
import { mealPhotoUrl, mealService, SLOTS, slotOf, type Meal, type MealDay } from '@/lib/meals';
import { longDate, shiftDate, wibToday } from '@/lib/stories';
import { cn, formatIDR } from '@/lib/utils';

const DAY = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const num = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
const short = (n: number) =>
  n >= 1_000_000
    ? `Rp${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`
    : n >= 1000
      ? `Rp${num(n / 1000)} rb`
      : `Rp${num(n)}`;

function KcalRing({ value, target }: { value: number; target: number }) {
  const reduce = useReducedMotion();
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, target ? value / target : 0);
  const over = value > target;
  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90">
        <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
        <motion.circle
          cx="68"
          cy="68"
          r={r}
          fill="none"
          stroke={over ? '#FDE68A' : '#fff'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[28px] font-black leading-none tracking-tight">{num(value)}</div>
        <div className="mt-1 text-[11px] font-semibold text-white/85">dari {num(target)} kkal</div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-white/90">{label}</span>
        <span className="font-bold">
          {num(value)}
          <span className="font-medium text-white/75"> / {num(goal)} g</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/25">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MealCard({ meal, index, onOpen }: { meal: Meal; index: number; onOpen: () => void }) {
  const slot = slotOf(meal.slot);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200/80 transition-shadow hover:shadow-md dark:bg-slate-900 dark:ring-slate-800"
    >
      {meal.has_photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat API berkuki, bukan aset statis
        <img
          src={mealPhotoUrl(meal.id, meal.updated_at)}
          alt={meal.name}
          className={cn(
            'h-16 w-16 shrink-0 rounded-2xl border-[3px] border-white object-cover shadow-md ring-1 ring-slate-200 transition-transform group-hover:rotate-0 dark:border-slate-800 dark:ring-slate-700',
            index % 2 ? 'rotate-2' : '-rotate-2',
          )}
        />
      ) : (
        <span
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl',
            slot.tint,
          )}
        >
          {slot.emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-slate-900 dark:text-white">{meal.name}</span>
        <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-slate-400">
          {meal.time} · {slot.label}
          {meal.protein != null || meal.carbs != null || meal.fat != null
            ? ` · P ${num(meal.protein ?? 0)} · K ${num(meal.carbs ?? 0)} · L ${num(meal.fat ?? 0)} g`
            : ''}
        </span>
        {meal.price ? (
          <span
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
              meal.recorded
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {formatIDR(meal.price)} {meal.recorded ? '· tercatat' : ''}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[17px] font-black text-slate-900 dark:text-white">
          {meal.kcal != null ? num(meal.kcal) : '–'}
        </span>
        <span className="block text-[11px] font-semibold text-slate-400">kkal</span>
      </span>
    </button>
  );
}

export function MakanApp({ variant = 'web', embedded = false }: { variant?: 'web' | 'app'; embedded?: boolean }) {
  const [date, setDate] = useState(wibToday);
  const [data, setData] = useState<MealDay | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState('');
  const [editTarget, setEditTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await mealService.day(date));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat catatan makan.');
    }
  }, [date]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ambil catatan makan saat tanggal berganti
    void load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const today = data?.today ?? wibToday();
  const items = useMemo(() => data?.items ?? [], [data]);
  const totals = useMemo(
    () =>
      items.reduce(
        (a, m) => ({
          kcal: a.kcal + (m.kcal ?? 0),
          protein: a.protein + (m.protein ?? 0),
          carbs: a.carbs + (m.carbs ?? 0),
          fat: a.fat + (m.fat ?? 0),
          spend: a.spend + (m.recorded && m.price ? m.price : 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0, spend: 0 },
      ),
    [items],
  );
  const target = data?.target ?? 2000;
  // Patokan umum pembagian energi: protein ±15%, karbohidrat ±55%, lemak ±30%.
  const goal = { protein: (target * 0.15) / 4, carbs: (target * 0.55) / 4, fat: (target * 0.3) / 9 };
  const week = data?.week ?? [];
  const weekMax = Math.max(target, ...week.map((d) => d.kcal), 1);
  const weekDays = week.filter((d) => d.count > 0);
  const weekAvg = weekDays.length ? weekDays.reduce((a, d) => a + d.kcal, 0) / weekDays.length : 0;
  const weekMealSpend = week.reduce((a, d) => a + d.spend, 0);
  const ai = data?.ai;
  const aiLeft = ai ? Math.max(0, ai.limit - ai.used) : 0;
  const notReady = data?.ready === false;

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setSheet({ mode: 'new', file: f });
  };
  const saveTarget = async () => {
    const v = Number(targetDraft.replace(/\D/g, ''));
    if (!(v >= 800 && v <= 6000)) {
      setToast('Target kalori 800–6.000 kkal.');
      return;
    }
    try {
      await mealService.setTarget(v);
      setEditTarget(false);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Gagal menyimpan target.');
    }
  };

  return (
    <div
      className={cn(
        !embedded && 'mx-auto max-w-6xl pb-28',
        !embedded && (variant === 'app' ? 'px-4 pt-[calc(env(safe-area-inset-top)+14px)]' : 'px-1'),
      )}
    >
      {embedded ? null : (
        <header className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link
            href={variant === 'app' ? '/app/more' : '/membership/dashboard'}
            aria-label="Kembali"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="text-[20px] font-black tracking-tight text-slate-900 dark:text-white">Sehatku · Makan</h1>
            <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
              Foto piringmu, Leo hitung gizi & belanjanya
            </p>
          </div>
          <LeoGuide topic="makan" />
        </header>
      )}

      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Hari sebelumnya"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setDate(today)}
          className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
        >
          {date === today ? 'Hari ini · ' : ''}
          {longDate(date)}
        </button>
        <button
          type="button"
          aria-label="Hari berikutnya"
          disabled={date >= today}
          onClick={() => setDate((d) => shiftDate(d, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {notReady ? (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Sehatku sedang disiapkan di server — sebentar lagi bisa dipakai.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-500 p-5 text-white shadow-xl shadow-rose-500/20 md:p-6">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -bottom-16 left-24 h-40 w-40 rounded-full bg-white/10" aria-hidden />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <KcalRing value={totals.kcal} target={target} />
              <div className="min-w-0 flex-1 space-y-2.5">
                <MacroBar label="Protein" value={totals.protein} goal={goal.protein} color="bg-sky-200" />
                <MacroBar label="Karbohidrat" value={totals.carbs} goal={goal.carbs} color="bg-amber-200" />
                <MacroBar label="Lemak" value={totals.fat} goal={goal.fat} color="bg-lime-200" />
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[12px] font-bold">
              <span className="rounded-full bg-white/18 px-3 py-1 backdrop-blur">🍽️ {items.length}× makan</span>
              <span className="rounded-full bg-white/18 px-3 py-1 backdrop-blur">💸 {formatIDR(totals.spend)}</span>
              {data?.streak ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-3 py-1 backdrop-blur">
                  <Flame size={13} /> {data.streak} hari beruntun
                </span>
              ) : null}
              {editTarget ? (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-slate-800">
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void saveTarget()}
                    className="w-16 bg-transparent px-1 text-[13px] font-bold outline-none"
                    aria-label="Target kalori harian"
                  />
                  <span className="text-[11px] text-slate-500">kkal</span>
                  <button
                    type="button"
                    onClick={() => void saveTarget()}
                    className="rounded-full bg-slate-900 px-2.5 py-0.5 text-white"
                  >
                    Simpan
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTargetDraft(String(target));
                    setEditTarget(true);
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/18 px-3 py-1 backdrop-blur hover:bg-white/25"
                >
                  <Pencil size={12} /> Target {num(target)} kkal
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-4 ring-1 ring-slate-200/80 md:p-5 dark:bg-slate-900 dark:ring-slate-800">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <button
                type="button"
                disabled={notReady}
                onClick={() => camRef.current?.click()}
                className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 sm:col-span-1 text-[15px] font-bold text-white shadow-lg shadow-slate-900/15 transition-transform active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                <Camera size={19} /> Foto makananmu
              </button>
              <button
                type="button"
                disabled={notReady}
                onClick={() => galRef.current?.click()}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
              >
                <ImagePlus size={18} /> Galeri
              </button>
              <button
                type="button"
                disabled={notReady}
                onClick={() => setSheet({ mode: 'new' })}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
              >
                <PenLine size={18} /> Tulis
              </button>
            </div>
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <input
              ref={galRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {ai ? (
              <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-[12px] text-slate-500 dark:text-slate-400">
                <Sparkles size={13} className="text-amber-500" />
                {aiLeft > 0 ? (
                  <span>
                    Gratis {aiLeft}× lagi hari ini · berikutnya {num(ai.price)} koin
                  </span>
                ) : (
                  <span>Jatah gratis hari ini habis · {num(ai.price)} koin per analisis</span>
                )}
                <span className="font-semibold text-slate-600 dark:text-slate-300">· saldo {num(ai.coins)} koin</span>
                {!ai.pro ? <span>· PRO gratis {ai.proLimit}×/hari</span> : null}
              </p>
            ) : null}
          </section>

          <section className="space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-800">
                <LeoBadge topic="makan" size={72} />
                <p className="mt-3 text-[15px] font-bold text-slate-700 dark:text-slate-200">
                  {date === today ? 'Belum ada makanan hari ini' : 'Tidak ada catatan makan di hari ini'}
                </p>
                <p className="mt-1 max-w-xs text-[13px] text-slate-500 dark:text-slate-400">
                  Foto piringmu begitu makanan datang — Leo kenali menunya, kalorinya, dan bisa langsung catat
                  belanjanya.
                </p>
              </div>
            ) : (
              SLOTS.filter((s) => items.some((m) => m.slot === s.id)).map((s) => (
                <div key={s.id}>
                  <div className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold text-slate-600 dark:text-slate-300">
                    <span>{s.emoji}</span> {s.label}
                    <span className="ml-auto text-[12px] font-semibold text-slate-400">
                      {num(items.filter((m) => m.slot === s.id).reduce((a, m) => a + (m.kcal ?? 0), 0))} kkal
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items
                      .filter((m) => m.slot === s.id)
                      .map((m, i) => (
                        <MealCard key={m.id} meal={m} index={i} onOpen={() => setSheet({ mode: 'edit', meal: m })} />
                      ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-black text-slate-900 dark:text-white">Minggu ini</h2>
              <span className="text-[12px] font-semibold text-slate-400">
                {week.reduce((a, d) => a + d.count, 0)}× makan
              </span>
            </div>
            <div className="relative mt-4 flex h-36 items-end gap-2">
              <div
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-rose-300/70 dark:border-rose-400/40"
                style={{ bottom: `${(target / weekMax) * 100}%` }}
                aria-hidden
              />
              {week.map((d, i) => {
                const h = d.kcal ? Math.max(6, (d.kcal / weekMax) * 100) : 3;
                const sel = d.date === date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.date > today}
                    onClick={() => setDate(d.date)}
                    title={`${DAY[i]}: ${num(d.kcal)} kkal · ${d.count}× makan`}
                    className="group relative flex h-full flex-1 flex-col justify-end disabled:opacity-40"
                  >
                    <span
                      className={cn(
                        'w-full rounded-xl transition-all',
                        d.kcal > target
                          ? 'bg-gradient-to-t from-amber-400 to-rose-400'
                          : sel
                            ? 'bg-gradient-to-t from-orange-500 to-rose-500'
                            : d.kcal
                              ? 'bg-gradient-to-t from-orange-200 to-rose-200 group-hover:from-orange-300 group-hover:to-rose-300 dark:from-orange-500/40 dark:to-rose-500/40'
                              : 'bg-slate-100 dark:bg-slate-800',
                      )}
                      style={{ height: `${h}%` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              {week.map((d, i) => (
                <span
                  key={d.date}
                  className={cn(
                    'flex-1 text-center text-[11px] font-semibold',
                    d.date === date ? 'text-slate-900 dark:text-white' : 'text-slate-400',
                  )}
                >
                  {DAY[i]}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Rata-rata</div>
                <div className="text-[16px] font-black text-slate-900 dark:text-white">{num(weekAvg)} kkal</div>
                <div className="text-[11px] text-slate-400">per hari tercatat</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Belanja makan</div>
                <div className="text-[16px] font-black text-slate-900 dark:text-white">
                  {short(data?.foodSpendWeek ?? 0)}
                </div>
                <div className="truncate text-[11px] text-slate-400">{short(weekMealSpend)} dari catatan makan</div>
              </div>
            </div>
          </section>

          {items.find((m) => m.tip) ? (
            <section className="rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 p-5 ring-1 ring-amber-100 dark:from-amber-500/10 dark:to-orange-500/10 dark:ring-amber-500/20">
              <div className="flex items-start gap-3">
                <LeoBadge topic="makan" size={40} />
                <div>
                  <div className="text-[13px] font-black text-amber-900 dark:text-amber-200">Kata Leo</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                    {[...items].reverse().find((m) => m.tip)?.tip}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <p className="px-2 text-center text-[11.5px] leading-relaxed text-slate-400">
            Kalori & gizi adalah perkiraan AI dari foto, bukan saran medis. Foto disimpan di akunmu dan hanya kamu yang
            bisa melihatnya; menghapus catatan makan ikut menghapus fotonya.
          </p>
        </aside>
      </div>

      {sheet ? (
        <MealSheet
          state={sheet}
          date={date}
          today={today}
          day={data}
          onClose={() => {
            setSheet(null);
            void load(); // jatah/koin analisis mungkin sudah terpakai
          }}
          onSaved={(msg) => {
            setSheet(null);
            setToast(msg);
            void load();
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[90] flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
