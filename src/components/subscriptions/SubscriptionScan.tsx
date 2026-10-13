"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus, RotateCcw, Search, Sparkles } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { isInvestmentCategory } from '@/lib/categoryEmoji';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { ServiceLogo } from '@/components/subscriptions/ServiceLogo';
import { matchService, serviceCategoryOf, type CatalogService } from '@/lib/subscriptionCatalog';
import type { Transaction } from '@/lib/services/transactionService';
import type { RecurringTransaction } from '@/lib/services/recurringService';

// "Cek langganan": Leo membuka kalender 30 hari terakhir lalu memeriksa
// tanggalnya satu per satu. Tanggal yang punya pembayaran ke platform
// langganan (dikenali dari catatan transaksinya) menyala dengan logonya,
// dan di akhir muncul daftar temuan — yang belum ada di Langganan bisa
// langsung ditambahkan. Semua baca saja; tidak ada yang tersimpan otomatis.

const DAYS = 30;
const WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const fmtDay = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type Hit = { day: Date; service: CatalogService; amount: number; tx: Transaction };
export type Pattern = { key: string; label: string; category: string; accountId: string; amount: number; months: number; day: number };
type Phase = 'idle' | 'opening' | 'scanning' | 'done';

export function SubscriptionScan({
  transactions,
  subs,
  patterns,
  onAdd,
  onAddPattern,
}: {
  transactions: Transaction[];
  subs: RecurringTransaction[];
  patterns: Pattern[];
  onAdd: (prefill: Partial<RecurringTransaction>) => void;
  onAddPattern: (p: Pattern) => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [cursor, setCursor] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 30 hari terakhir (hari ini paling akhir) + temuan per tanggal.
  const { days, lead, hitsByDay } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: DAYS }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1) + i));
    const lead = (days[0].getDay() + 6) % 7;
    const hitsByDay = days.map((d) => {
      const seen = new Set<string>();
      const out: Hit[] = [];
      for (const t of transactions) {
        if (t.type !== 'pengeluaran' || isInvestmentCategory(t.category) || !sameDay(new Date(t.date), d)) continue;
        const svc = matchService(`${t.note ?? ''} ${t.subCategory ?? ''}`) ?? matchService(t.category ?? '');
        if (!svc || seen.has(svc.id)) continue;
        seen.add(svc.id);
        out.push({ day: d, service: svc, amount: toIdr(t), tx: t });
      }
      return out;
    });
    return { days, lead, hitsByDay };
  }, [transactions]);

  // Satu baris per layanan (tanggal terbarunya), plus status sudah/belum di Langganan.
  const found = useMemo(() => {
    const map = new Map<string, { service: CatalogService; dates: Date[]; amount: number; tx: Transaction; known: boolean }>();
    hitsByDay.flat().forEach((h) => {
      const cur = map.get(h.service.id);
      if (cur) {
        cur.dates.push(h.day);
        cur.amount = h.amount;
        cur.tx = h.tx;
      } else {
        const known = subs.some((r) => r.service === h.service.id || norm(r.name).includes(norm(h.service.name).split(' ')[0]));
        map.set(h.service.id, { service: h.service, dates: [h.day], amount: h.amount, tx: h.tx, known });
      }
    });
    return [...map.values()].sort((a, b) => Number(a.known) - Number(b.known) || b.amount - a.amount);
  }, [hitsByDay, subs]);
  const fresh = found.filter((f) => !f.known);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const start = () => {
    if (timer.current) clearTimeout(timer.current);
    setCursor(-1);
    setPhase('opening');
    const step = (i: number) => {
      if (i >= DAYS) {
        timer.current = setTimeout(() => setPhase('done'), reduce ? 0 : 350);
        return;
      }
      setCursor(i);
      const pause = reduce ? 10 : hitsByDay[i].length ? 650 : 75;
      timer.current = setTimeout(() => step(i + 1), pause);
    };
    timer.current = setTimeout(() => {
      setPhase('scanning');
      step(0);
    }, reduce ? 0 : 750);
  };

  // Gelembung Leo selama scan.
  const lastHit = cursor >= 0 ? [...hitsByDay.slice(0, cursor + 1)].reverse().find((h) => h.length) : undefined;
  const latestIsNow = cursor >= 0 && hitsByDay[cursor]?.length > 0;
  const bubble =
    phase === 'opening'
      ? 'Buka kalender dulu…'
      : phase === 'scanning'
        ? latestIsNow
          ? `${fmtDay(days[cursor])}: ada ${hitsByDay[cursor].map((h) => h.service.name).join(', ')}!`
          : `Memeriksa ${fmtDay(days[Math.max(0, cursor)])}…`
        : found.length
          ? fresh.length
            ? `Ketemu ${found.length} platform, ${fresh.length} belum ada di Langganan.`
            : `Ketemu ${found.length} platform, semuanya sudah tercatat 👍`
          : 'Nggak ada pembayaran ke platform langganan dalam 30 hari ini.';
  const mood: LeoMood = phase === 'done' ? (fresh.length ? 'happy' : 'idle') : phase === 'opening' ? 'peek' : latestIsNow ? 'happy' : 'watch';
  const scannedHits = hitsByDay.slice(0, cursor + 1).flat().length;

  return (
    <div className="overflow-hidden rounded-[26px] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {phase === 'idle' && <LeoMascot mood="watch" size={64} />}
          <div>
            <p className="font-bold text-slate-900">Cek langganan</p>
            <p className="text-sm text-slate-500">Leo memeriksa pembayaranmu 30 hari terakhir, tanggal demi tanggal, dan mengumpulkan langganannya.</p>
          </div>
        </div>
        {phase === 'idle' && (
          <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-indigo-700">
            <Search size={15} /> Cek sekarang
          </button>
        )}
        {phase === 'done' && (
          <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
            <RotateCcw size={14} /> Cek ulang
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {phase !== 'idle' && (
          <motion.div key="scan" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
            <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* Leo + kalender */}
              <div className="relative">
                <div className="mb-3 flex items-end gap-2">
                  <motion.div animate={phase === 'scanning' && !reduce ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: phase === 'scanning' ? Infinity : 0 }}>
                    <LeoMascot mood={mood} size={70} />
                  </motion.div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={bubble}
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="mb-6 rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm"
                    >
                      {bubble}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <motion.div
                  initial={{ rotateX: -80, opacity: 0, y: -10 }}
                  animate={{ rotateX: 0, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.15 }}
                  style={{ transformPerspective: 900, transformOrigin: 'top center' }}
                  className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-indigo-900/10 ring-1 ring-indigo-100"
                >
                  {/* Ring jilid kalender */}
                  <div className="relative flex items-center justify-between bg-indigo-600 px-4 py-2.5 text-white">
                    <span className="text-sm font-bold">{fmtDay(days[0])} – {fmtDay(days[DAYS - 1])}</span>
                    <span className="text-xs font-semibold text-indigo-100 tabular-nums">{phase === 'done' ? 'Selesai' : `${Math.max(0, cursor + 1)}/${DAYS} hari`}</span>
                    <span className="absolute -top-1.5 left-8 h-3 w-1.5 rounded-full bg-indigo-300" />
                    <span className="absolute -top-1.5 right-8 h-3 w-1.5 rounded-full bg-indigo-300" />
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                      {days.map((d, i) => {
                        const hits = hitsByDay[i];
                        const scanned = phase === 'done' || i <= cursor;
                        const active = phase === 'scanning' && i === cursor;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'relative flex aspect-square items-center justify-center rounded-lg text-[11px] font-bold transition-colors duration-200',
                              scanned ? (hits.length ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50/70 text-indigo-300') : 'bg-slate-50 text-slate-400',
                              active && 'ring-2 ring-indigo-500'
                            )}
                          >
                            {scanned && hits.length > 0 ? (
                              <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} title={`${fmtDay(d)} · ${hits.map((h) => h.service.name).join(', ')}`}>
                                <ServiceLogo service={hits[0].service.id} name={hits[0].service.name} size={22} />
                              </motion.span>
                            ) : (
                              d.getDate()
                            )}
                            {scanned && hits.length > 1 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] text-slate-900">{hits.length}</span>}
                            {active && !reduce && (
                              <motion.span className="pointer-events-none absolute inset-0 rounded-lg bg-indigo-400/30" initial={{ opacity: 0.8, scale: 0.6 }} animate={{ opacity: 0, scale: 1.4 }} transition={{ duration: 0.35 }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Temuan */}
              <div className="min-w-0">
                {phase !== 'done' ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-500">Ditemukan sejauh ini: <b className="text-slate-800">{scannedHits}</b></p>
                    <AnimatePresence initial={false}>
                      {hitsByDay.slice(0, cursor + 1).flat().reverse().slice(0, 5).map((h) => (
                        <motion.div
                          key={`${h.day.getTime()}-${h.service.id}`}
                          layout
                          initial={{ opacity: 0, x: 20, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
                        >
                          <ServiceLogo service={h.service.id} name={h.service.name} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-800">{h.service.name}</span>
                            <span className="text-xs text-slate-400">{fmtDay(h.day)}</span>
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 tabular-nums">{formatIDR(h.amount)}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {lastHit === undefined && <p className="rounded-2xl bg-white/60 px-4 py-6 text-center text-sm text-slate-400">Belum ada yang ketemu…</p>}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    {found.length === 0 && patterns.length === 0 && (
                      <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-600">Tidak ada pembayaran ke platform langganan yang tercatat 30 hari ini. Kalau kamu bayar lewat kartu/e-wallet, catat dengan nama layanannya (mis. “Netflix”) supaya Leo bisa mengenalinya.</p>
                    )}
                    {found.map((f, i) => (
                      <motion.div key={f.service.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                        <ServiceLogo service={f.service.id} name={f.service.name} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-800">{f.service.name} · {formatIDR(f.amount)}</span>
                          <span className="block truncate text-xs text-slate-400">Tanggal {f.dates.map(fmtDay).join(', ')}</span>
                        </span>
                        {f.known ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-600"><Check size={12} /> Sudah ada</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const last = f.dates[f.dates.length - 1];
                              const next = new Date(last.getFullYear(), last.getMonth() + 1, last.getDate());
                              onAdd({
                                name: f.service.name,
                                service: f.service.id,
                                serviceCategory: f.service.category,
                                type: 'Pengeluaran',
                                amount: f.amount,
                                category: f.tx.category || serviceCategoryOf(f.service.category).expense,
                                accountId: f.tx.accountId || '',
                                interval: 'Bulanan',
                                nextDate: next,
                                status: 'ACTIVE',
                              });
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            <Plus size={12} /> Tambahkan
                          </button>
                        )}
                      </motion.div>
                    ))}
                    {patterns.length > 0 && (
                      <>
                        <p className="pt-2 text-xs font-semibold text-slate-500">Pembayaran berulang lainnya (4 bulan terakhir)</p>
                        {patterns.map((p) => (
                          <div key={p.key} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3">
                            <ServiceLogo name={p.label} size={36} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-slate-800">{p.label}</span>
                              <span className="text-xs text-slate-400">±{formatIDR(p.amount)} · {p.months} bulan · sekitar tgl {p.day}</span>
                            </span>
                            <button type="button" onClick={() => onAddPattern(p)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50">
                              <Sparkles size={12} /> Jadikan
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
