"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Radar as RadarIcon, Sparkles } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { lightTap } from '@/lib/haptics';
import type { Transaction } from '@/lib/services/transactionService';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { addDaysStr, CYCLE_SHORT, daysBetween, monthlyEquivalent, nextCharge, radarScan, RADAR_DAYS, type RadarHit, type Subscription } from '@/lib/subscriptions';
import { SubLogo } from '@/components/langganan/SubLogo';

// Radar Langgananku: grid 30 hari (kolom = minggu, baris = Sen–Min) disapu
// sinar radar kolom demi kolom; tanggal pembayaran langganan menyala dengan
// logonya, temuan masuk "baki" dengan total per bulan yang naik. Lalu daftar
// hasil untuk dicentang & disimpan. Deteksi = lib/subscriptions radarScan
// (lokal, tanpa AI). Kelas dark: untuk /app; web memakai .web-dark.

const STEP_MS = 85;
const CELL = 38; // px per sel
const GAP = 6;
const fmtShort = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

export function RadarScan({ transactions, subs, onDone }: { transactions: Transaction[]; subs: Subscription[]; onDone: (msg: string) => void }) {
  const reduce = useReducedMotion();
  const today = toLocalDateString();
  const from = addDaysStr(today, -(RADAR_DAYS - 1));
  const hits = useMemo(() => radarScan(transactions, subs, today), [transactions, subs, today]);

  // Peta tanggal → kandidat (logo pertama yang tampil di sel itu).
  const byDay = useMemo(() => {
    const m = new Map<string, RadarHit[]>();
    for (const h of hits) for (const d of h.dates) m.set(d, [...(m.get(d) ?? []), h]);
    return m;
  }, [hits]);
  const firstSeen = useMemo(() => new Map(hits.map((h) => [h.id, daysBetween(from, h.dates[0])])), [hits, from]);

  // Grid: kolom mulai Senin minggu `from`.
  const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Senin
  const columns = Math.ceil((lead + RADAR_DAYS) / 7);
  const cells = Array.from({ length: columns * 7 }, (_, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const idx = col * 7 + row - lead;
    return { col, row, idx, day: idx >= 0 && idx < RADAR_DAYS ? addDaysStr(from, idx) : null };
  });

  const [pos, setPos] = useState(reduce ? RADAR_DAYS : 0);
  const done = pos >= RADAR_DAYS;
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (reduce || done) return;
    timer.current = window.setTimeout(() => setPos((p) => Math.min(RADAR_DAYS, p + 1)), STEP_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [pos, done, reduce]);

  const found = hits.filter((h) => (firstSeen.get(h.id) ?? 0) < pos);
  const lastFound = useRef(0);
  useEffect(() => {
    if (found.length > lastFound.current) { lastFound.current = found.length; lightTap(); }
  }, [found.length]);
  const runningTotal = found.reduce((s, h) => s + monthlyEquivalent(h.amount, h.cycle), 0);
  const sweepCol = Math.floor((pos + lead) / 7);

  return (
    <div className="space-y-4">
      <div className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(130%_120%_at_0%_0%,#0b2b2a_0%,#0b1220_60%)] p-4 text-white">
        <div className="flex items-center gap-3">
          <RadarDisc spinning={!done} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300/80">{RADAR_DAYS} hari · {fmtShort(from)} – {fmtShort(today)}</p>
            <p className="text-[17px] font-extrabold leading-tight">{done ? (hits.length ? `Radar menemukan ${hits.length} langganan` : 'Radar selesai — tidak ada yang baru') : 'Radar sedang memindai pembayaranmu…'}</p>
          </div>
        </div>

        {/* Peta 30 hari */}
        <div className="mt-4 overflow-x-auto no-scrollbar">
          <div className="relative mx-auto grid w-max" style={{ gridTemplateColumns: `repeat(${columns}, ${CELL}px)`, gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: 'column', gap: GAP }}>
            {cells.map(({ col, row, idx, day }) => {
              if (!day) return <span key={`${col}-${row}`} />;
              const scanned = idx < pos;
              const here = byDay.get(day);
              const lit = scanned && here?.length;
              return (
                <span key={day} title={fmtShort(day)} className={cn('relative flex items-center justify-center rounded-[10px] transition-colors duration-300', lit ? 'bg-emerald-400/25 ring-1 ring-emerald-300/60' : scanned ? 'bg-white/[0.07]' : 'bg-white/[0.025]')}>
                  {!lit && <span className={cn('text-[11px] font-semibold tabular-nums', scanned ? 'text-white/45' : 'text-white/20')}>{Number(day.slice(8))}</span>}
                  {lit && (
                    <motion.span initial={reduce ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }}>
                      <SubLogo name={here![0].name} domain={here![0].domain} color={here![0].color} size={28} className="ring-0" />
                    </motion.span>
                  )}
                </span>
              );
            })}
            {!done && !reduce && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-[-6px] w-[46px] rounded-full bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent blur-[2px]"
                animate={{ left: sweepCol * (CELL + GAP) - 4 }}
                transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
              />
            )}
          </div>
          <div className="mx-auto mt-1.5 w-max text-[10px] text-white/40" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, ${CELL}px)`, gap: GAP }}>
            {Array.from({ length: columns }, (_, c) => {
              const d = addDaysStr(from, c * 7 - lead);
              return <span key={c} className="text-center">{fmtShort(d < from ? from : d)}</span>;
            })}
          </div>
        </div>

        {/* Baki temuan */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5">
          <div className="flex min-w-0 flex-1 -space-x-2">
            <AnimatePresence initial={false}>
              {found.slice(0, 7).map((h) => (
                <motion.span key={h.id} initial={reduce ? false : { scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }} className="rounded-[10px] ring-2 ring-[#0b1220]">
                  <SubLogo name={h.name} domain={h.domain} color={h.color} size={30} />
                </motion.span>
              ))}
            </AnimatePresence>
            {found.length === 0 && <span className="text-[12px] text-white/50">{done ? 'Belum ada pola langganan di catatanmu.' : 'Mencari pola bayar berulang…'}</span>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{found.length} ditemukan</p>
            <p className="text-[15px] font-extrabold tabular-nums">±{formatIDR(Math.round(runningTotal))}<span className="text-[11px] font-semibold text-white/50">/bln</span></p>
          </div>
        </div>
        {!done && (
          <button type="button" onClick={() => setPos(RADAR_DAYS)} className="mt-3 w-full text-center text-[12px] font-bold text-white/60 hover:text-white">Lewati animasi</button>
        )}
      </div>

      {done && <RadarResults hits={hits} onDone={onDone} />}
    </div>
  );
}

function RadarDisc({ spinning }: { spinning: boolean }) {
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-300/30">
      <span className="absolute inset-[7px] rounded-full ring-1 ring-emerald-300/20" />
      <span className="absolute inset-[15px] rounded-full ring-1 ring-emerald-300/20" />
      {spinning ? (
        <span className="absolute inset-0 animate-spin rounded-full [animation-duration:1.6s] [background:conic-gradient(from_0deg,transparent_0deg,rgba(110,231,183,0.55)_60deg,transparent_62deg)]" />
      ) : (
        <Check size={22} className="relative text-emerald-300" />
      )}
      {spinning && <RadarIcon size={18} className="relative text-emerald-200" />}
    </span>
  );
}

function RadarResults({ hits, onDone }: { hits: RadarHit[]; onDone: (msg: string) => void }) {
  const today = toLocalDateString();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(hits.filter((h) => h.confidence === 'pasti').map((h) => h.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = hits.filter((h) => picked.has(h.id));
  const total = chosen.reduce((s, h) => s + monthlyEquivalent(h.amount, h.cycle), 0);

  const save = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    setError('');
    let ok = 0;
    for (const h of chosen) {
      try {
        await subscriptionService.create({ name: h.name, serviceKey: h.serviceKey ?? null, domain: h.domain ?? null, category: h.category, amount: h.amount, cycle: h.cycle, anchorDate: h.anchorDate, accountId: h.accountId ?? null });
        ok++;
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : 'Sebagian gagal disimpan.');
      }
    }
    setBusy(false);
    if (ok) onDone(`${ok} langganan masuk Langgananku.`);
  };

  if (!hits.length) {
    return (
      <div className="rounded-3xl bg-slate-50 p-5 text-center dark:bg-slate-800/60">
        <Sparkles size={22} className="mx-auto text-slate-400" />
        <p className="mt-2 text-[14px] font-bold text-slate-900 dark:text-white">Tidak ada langganan baru terdeteksi</p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Radar membaca catatan transaksi 30 hari terakhir. Catat tagihan seperti “Netflix” atau “Spotify” di catatan transaksi supaya radar mengenalinya, atau tambah manual.</p>
      </div>
    );
  }

  const section = (title: string, desc: string | null, list: RadarHit[]) =>
    list.length > 0 && (
      <section>
        <h3 className="px-1 text-[13px] font-extrabold text-slate-900 dark:text-white">{title}</h3>
        {desc && <p className="px-1 text-[12px] text-slate-500 dark:text-slate-400">{desc}</p>}
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-3xl bg-slate-50 dark:divide-slate-800 dark:bg-slate-800/60">
          {list.map((h) => {
            const on = picked.has(h.id);
            const next = nextCharge(h.anchorDate, h.cycle, today);
            return (
              <li key={h.id}>
                <button type="button" onClick={() => toggle(h.id)} aria-pressed={on} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 transition-colors', on ? 'bg-emerald-500 text-white ring-emerald-500' : 'ring-slate-300 dark:ring-slate-600')}>{on && <Check size={14} strokeWidth={3} />}</span>
                  <SubLogo name={h.name} domain={h.domain} color={h.color} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{h.name}</span>
                    <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{h.dates.length}× bayar · berikutnya ±{fmtShort(next)}</span>
                  </span>
                  <span className="whitespace-nowrap text-right text-[14px] font-extrabold tabular-nums text-slate-900 dark:text-white">{formatIDR(h.amount)}<span className="text-[11px] font-semibold text-slate-400">{CYCLE_SHORT[h.cycle]}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      {section('Pasti langganan', null, hits.filter((h) => h.confidence === 'pasti'))}
      {section('Mungkin langganan', 'Bayar berulang dengan nominal mirip — centang yang memang langganan.', hits.filter((h) => h.confidence === 'mungkin'))}
      <button type="button" onClick={save} disabled={busy || !chosen.length} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-emerald-600">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {chosen.length ? `Simpan ${chosen.length} · ±${formatIDR(Math.round(total))}/bln` : 'Pilih langganan dulu'}
      </button>
      <p className="px-1 text-center text-[11px] text-slate-400">Harga diambil dari pembayaran terakhir. Bisa diubah kapan saja.</p>
    </div>
  );
}
