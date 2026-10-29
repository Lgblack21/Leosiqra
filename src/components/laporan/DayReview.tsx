"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { useCategoryData } from '@/components/settings/CategoryBudgetViews';
import { categoryVisual } from '@/lib/categoryEmoji';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';
import { cn, formatMoney, isIncomingTransaction, isInvestmentFlow, toLocalDateString } from '@/lib/utils';

// "Cek hari" dari kalender Laporan: semua transaksi satu hari (kecuali catatan
// hutang), centang yang kategorinya sudah benar, ketuk untuk mengganti
// kategori. Tanda "sudah dicek" = payload_json.reviewed di server (sinkron
// antar perangkat), tidak mengubah nominal/saldo.

const isIn = (t: Transaction) => isIncomingTransaction(t) || (t.type === 'topup' && Boolean(t.subCategory?.includes('Masuk')));
const canRecategorize = (t: Transaction) => (t.type === 'pengeluaran' || t.type === 'pemasukan') && !isInvestmentFlow(t);
const CONFETTI = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7'];

// Posisi konfeti acak-semu tapi tetap (dihitung sekali, bukan saat render).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const PIECES = Array.from({ length: 34 }, (_, i) => ({
  x: (rnd(i, 1) - 0.5) * 520,
  y: -(140 + rnd(i, 2) * 260),
  r: rnd(i, 3) * 540 - 270,
  c: CONFETTI[i % CONFETTI.length],
  w: 6 + rnd(i, 4) * 6,
  d: rnd(i, 5) * 0.15,
  round: i % 3 === 0,
}));

function Confetti() {
  const pieces = PIECES;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={cn('absolute', p.round ? 'rounded-full' : 'rounded-[2px]')}
          style={{ width: p.w, height: p.round ? p.w : p.w * 1.6, background: p.c }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 320], rotate: p.r, opacity: [1, 1, 0] }}
          transition={{ duration: 1.6, delay: p.d, ease: 'easeOut', times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}

function CategoryPicker({ tx, onPick, onClose }: { tx: Transaction; onPick: (c: string) => void; onClose: () => void }) {
  const kind = tx.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran';
  const { rows, loading } = useCategoryData();
  const list = rows.filter((r) => r.kind === kind && !isInvestmentFlow({ type: kind, category: r.name }));
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-2 pt-1">
        <p className="text-[12px] font-semibold text-slate-500">Ganti kategori ke…</p>
        <button type="button" onClick={onClose} className="text-[12px] font-semibold text-slate-400 hover:text-slate-700">Batal</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {list.map((r) => {
            const v = categoryVisual(r.name, kind);
            const cur = r.name === tx.category;
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => onPick(r.name)}
                className={cn('flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold ring-1 transition-colors', cur ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
              >
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[13px]', cur ? 'bg-white/20' : v.tile)} aria-hidden>{v.emoji}</span>
                {r.name}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export function DayReview({ date, onClose, onDate }: { date: Date | null; onClose: () => void; onDate: (d: Date) => void }) {
  const reduce = useReducedMotion();
  const { toast } = useFeedback();
  const [all, setAll] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [pop, setPop] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let active = true;
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((l) => active && setAll(l.filter((t) => t.type !== 'debt')))
        .catch(console.error)
        .finally(() => active && setLoading(false));
    void load();
    accountService.getUserAccounts('session').then((a) => active && setAccounts(a)).catch(console.error);
    const unsub = subscribeToCollectionChanges('transactions', load);
    return () => { active = false; unsub(); };
  }, [date]);

  useEffect(() => {
    if (!date) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [date, onClose]);

  const key = date ? toLocalDateString(date) : '';
  const dayTx = useMemo(
    () => all.filter((t) => toLocalDateString(new Date(t.date)) === key).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [all, key]
  );
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const todo = dayTx.filter((t) => !t.reviewed);
  const done = dayTx.filter((t) => t.reviewed);
  const pct = dayTx.length ? done.length / dayTx.length : 0;
  const allDone = dayTx.length > 0 && todo.length === 0;
  const out = dayTx.filter((t) => !isIn(t) && t.type === 'pengeluaran' && !isInvestmentFlow(t)).reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
  const inn = dayTx.filter((t) => t.type === 'pemasukan' && !isInvestmentFlow(t)).reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
  const today = new Date();
  const isLastDay = date ? toLocalDateString(date) >= toLocalDateString(today) : true;

  const patch = (ids: string[], data: Partial<Transaction>) => setAll((l) => l.map((t) => (t.id && ids.includes(t.id) ? { ...t, ...data } : t)));
  const mark = async (t: Transaction, reviewed: boolean) => {
    if (!t.id || busy.has(t.id)) return;
    setBusy((b) => new Set(b).add(t.id!));
    patch([t.id], { reviewed });
    if (reviewed) { setPop(t.id); setTimeout(() => setPop((p) => (p === t.id ? null : p)), 700); }
    try {
      await transactionService.updateTransaction(t.id, { reviewed });
      if (reviewed && todo.length === 1 && todo[0].id === t.id) setCelebrate((c) => c + 1);
    } catch {
      patch([t.id], { reviewed: !reviewed });
      toast.error('Gagal menyimpan. Coba lagi.');
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(t.id!); return n; });
    }
  };
  const markAll = async () => {
    const ids = todo.map((t) => t.id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    patch(ids, { reviewed: true });
    setCelebrate((c) => c + 1);
    const failed: string[] = [];
    for (const id of ids) {
      try { await transactionService.updateTransaction(id, { reviewed: true }); } catch { failed.push(id); }
    }
    if (failed.length) { patch(failed, { reviewed: false }); toast.error(`${failed.length} transaksi gagal disimpan.`); }
  };
  const recategorize = async (t: Transaction, category: string) => {
    setEditing(null);
    if (!t.id) return;
    const before = { category: t.category, reviewed: t.reviewed };
    patch([t.id], { category, reviewed: true });
    try {
      await transactionService.updateTransaction(t.id, { category, reviewed: true });
      toast.success(`Dipindah ke ${category}.`);
    } catch {
      patch([t.id], before);
      toast.error('Gagal mengganti kategori.');
    }
  };
  const step = (dir: -1 | 1) => { if (date) onDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + dir)); };

  // Fungsi render (bukan komponen) supaya baris tidak di-mount ulang tiap render.
  const renderRow = (t: Transaction) => {
    const v = categoryVisual(t.category, t.type);
    const incoming = isIn(t);
    const move = !incoming && (t.type !== 'pengeluaran' || isInvestmentFlow(t));
    const editable = canRecategorize(t);
    return (
      <motion.li key={t.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, x: 24 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => editable && setEditing(editing === t.id ? null : t.id ?? null)} disabled={!editable} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]', v.tile)} aria-hidden>{v.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-slate-900">{t.note || t.subCategory || t.category}</span>
              <span className="block truncate text-[12px] text-slate-500">
                <span className={cn(editable && 'underline decoration-dotted underline-offset-2')}>{t.category}</span>
                {accName.get(t.accountId) ? ` · ${accName.get(t.accountId)}` : ''}
              </span>
            </span>
            <span className={cn('shrink-0 text-[14px] font-bold tabular-nums', incoming ? 'text-emerald-600' : move ? 'text-slate-400' : 'text-slate-900')}>
              {incoming ? '+' : '−'}{formatMoney(Number(t.amount) || 0, t.currency)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void mark(t, !t.reviewed)}
            aria-label={t.reviewed ? 'Tandai belum dicek' : 'Tandai sudah benar'}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center"
          >
            {pop === t.id && !reduce && (
              <motion.span className="absolute inset-0 rounded-full bg-emerald-400" initial={{ scale: 0.6, opacity: 0.6 }} animate={{ scale: 2.1, opacity: 0 }} transition={{ duration: 0.6 }} />
            )}
            <motion.span
              key={t.reviewed ? 'on' : 'off'}
              initial={reduce ? false : { scale: t.reviewed ? 0.4 : 1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 14 }}
              className={cn('relative flex h-7 w-7 items-center justify-center rounded-full transition-colors', t.reviewed ? 'bg-emerald-500 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.9)]' : 'ring-2 ring-slate-300 hover:ring-emerald-400')}
            >
              {t.reviewed && <Check size={16} strokeWidth={3} />}
            </motion.span>
          </button>
        </div>
        <AnimatePresence>{editing === t.id && <CategoryPicker tx={t} onPick={(c) => void recategorize(t, c)} onClose={() => setEditing(null)} />}</AnimatePresence>
      </motion.li>
    );
  };

  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {date && (
        <motion.div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6 print:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cek transaksi hari ini"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[28px]"
          >
            {celebrate > 0 && <Confetti key={celebrate} />}

            {/* Kepala: tanggal + navigasi */}
            <div className="flex items-center gap-2 px-5 pb-2 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cek hari</p>
                <h2 className="truncate text-[19px] font-extrabold tracking-tight text-slate-900">
                  {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}
                </h2>
              </div>
              <button type="button" onClick={() => step(-1)} aria-label="Hari sebelumnya" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => step(1)} disabled={isLastDay} aria-label="Hari berikutnya" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronRight size={18} /></button>
              <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            {/* Progres + Leo */}
            <div className="mx-5 flex items-center gap-4 rounded-[22px] bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50 p-3.5">
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
                  <circle cx="28" cy="28" r={R} fill="none" stroke="#e0e7ff" strokeWidth="6" />
                  <motion.circle
                    cx="28" cy="28" r={R} fill="none" stroke={allDone ? '#10b981' : '#6366f1'} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={C}
                    animate={{ strokeDashoffset: C * (1 - pct) }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-slate-900 tabular-nums">{done.length}/{dayTx.length}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900">
                  {loading ? 'Memuat…' : dayTx.length === 0 ? 'Tidak ada transaksi' : allDone ? 'Beres! Semua kategori sudah benar ✨' : `${todo.length} lagi perlu dicek`}
                </p>
                <p className="text-[12px] text-slate-500">
                  {out > 0 && <>keluar <b className="text-slate-700">{formatMoney(out, 'IDR')}</b></>}
                  {out > 0 && inn > 0 && ' · '}
                  {inn > 0 && <>masuk <b className="text-emerald-600">{formatMoney(inn, 'IDR')}</b></>}
                  {out === 0 && inn === 0 && 'Centang yang sudah benar, ketuk untuk ganti kategori.'}
                </p>
              </div>
              <div className="-my-4 hidden shrink-0 sm:block">
                <LeoMascot key={celebrate} mood={allDone ? 'happy' : dayTx.length === 0 ? 'idle' : 'watch'} lookX={pct} size={78} interactive />
              </div>
            </div>

            {/* Daftar */}
            <div className="min-h-[160px] flex-1 overflow-y-auto px-3 pb-3 pt-3">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
              ) : dayTx.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <LeoMascot mood="happy" size={90} />
                  <p className="text-[14px] font-semibold text-slate-700">Hari tanpa transaksi — hari hemat! 🌿</p>
                </div>
              ) : (
                <>
                  {todo.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-[20px] bg-slate-50/70 ring-1 ring-slate-100">
                      <AnimatePresence initial={false}>{todo.map(renderRow)}</AnimatePresence>
                    </ul>
                  )}
                  {done.length > 0 && (
                    <>
                      <p className="mb-1 mt-4 px-2 text-[12px] font-bold uppercase tracking-[0.1em] text-emerald-600">Sudah dicek · {done.length}</p>
                      <ul className="divide-y divide-slate-100 rounded-[20px] ring-1 ring-emerald-100">
                        <AnimatePresence initial={false}>{done.map(renderRow)}</AnimatePresence>
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Aksi */}
            <div className="border-t border-slate-100 p-4">
              {allDone || dayTx.length === 0 ? (
                <div className="flex gap-2">
                  <Link href={`/membership/transactions/daily?tanggal=${key}`} className="flex flex-1 items-center justify-center rounded-full bg-slate-100 py-3 text-[14px] font-bold text-slate-700 hover:bg-slate-200">Buka di Transaksi</Link>
                  <button type="button" onClick={() => step(1)} disabled={isLastDay} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40">
                    Hari berikutnya <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => void markAll()}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(79,70,229,0.8)]"
                >
                  <Check size={18} strokeWidth={3} /> Semua sudah benar ({todo.length})
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
