"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn, formatIDR, isIncomingTransaction } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import type { Account } from '@/lib/services/accountService';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Popup "Lihat harinya" dari Laporan: semua transaksi satu hari, dicek satu
// per satu. Centang = kategorinya sudah benar; ketuk baris = ganti kategori.
// Status "sudah dicek" disimpan di perangkat ini (localStorage) — tidak
// mengubah data transaksi kecuali kategorinya memang diganti.

const KEY = 'leo-reviewed:v1';
const loadReviewed = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
};
const saveReviewed = (s: Set<string>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s].slice(-3000)));
  } catch {}
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;

export function DayReviewModal({
  date,
  transactions,
  accounts,
  onShift,
  onClose,
}: {
  date: Date;
  transactions: Transaction[];
  accounts: Account[];
  onShift: (delta: number) => void;
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const [reviewed, setReviewed] = useState<Set<string>>(() => (typeof window === 'undefined' ? new Set() : loadReviewed()));
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});

  const list = useMemo(
    () => transactions.filter((t) => t.type !== 'debt' && t.id && sameDay(new Date(t.date), date)).sort((a, b) => toIdr(b) - toIdr(a)),
    [transactions, date]
  );
  const todo = list.filter((t) => !reviewed.has(t.id!));
  const done = list.filter((t) => reviewed.has(t.id!));
  const isToday = sameDay(date, new Date());
  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onShift(-1);
      if (e.key === 'ArrowRight' && !isToday) onShift(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onShift, isToday]);

  const mark = (ids: string[], on: boolean) => {
    setReviewed((cur) => {
      const next = new Set(cur);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      saveReviewed(next);
      return next;
    });
  };

  const changeCategory = async (t: Transaction, category: string) => {
    if (!t.id || category === (override[t.id] ?? t.category)) return setOpen(null);
    setSaving(t.id);
    try {
      await transactionService.updateTransaction(t.id, { category });
      setOverride((o) => ({ ...o, [t.id!]: category }));
      mark([t.id], true);
      toast.success(`Kategori diganti ke ${category}`);
      setOpen(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengganti kategori.');
    } finally {
      setSaving(null);
    }
  };

  // Pilihan kategori mengikuti jenis transaksinya (pengeluaran ≠ pemasukan).
  const catsByType = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    transactions.forEach((t) => t.category && (m[t.type] ??= new Set()).add(t.category));
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()])) as Record<string, string[]>;
  }, [transactions]);

  const pct = list.length ? done.length / list.length : 0;

  const Row = ({ t, checked }: { t: Transaction; checked: boolean }) => {
    const cat = override[t.id!] ?? t.category;
    const inc = isIncomingTransaction(t);
    return (
      <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }} className="border-b border-slate-100 last:border-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <button type="button" onClick={() => setOpen(open === t.id ? null : t.id!)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open === t.id}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">{categoryEmoji(cat)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-slate-800">{t.note || cat}</span>
              <span className="block truncate text-xs text-slate-500">{cat}{accName(t.accountId) ? ` · ${accName(t.accountId)}` : ''}</span>
            </span>
            <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', inc ? 'text-emerald-600' : 'text-slate-800')}>{inc ? '+' : '−'}{formatIDR(toIdr(t))}</span>
          </button>
          <button
            type="button"
            onClick={() => { mark([t.id!], !checked); if (open === t.id) setOpen(null); }}
            aria-label={checked ? 'Batalkan cek' : 'Tandai sudah benar'}
            className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors', checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400')}
          >
            <AnimatePresence>{checked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={15} strokeWidth={3} /></motion.span>}</AnimatePresence>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open === t.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-1.5 px-3 pb-3 pl-16">
                {(catsByType[t.type] ?? []).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={saving === t.id}
                    onClick={() => changeCategory(t, c)}
                    className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50', c === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  >
                    {categoryEmoji(c)} {c}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.li>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Transaksi hari ini">
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex h-[min(860px,92dvh)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center gap-2 px-5 pt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={date.toDateString()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="flex-1 text-lg font-extrabold capitalize text-slate-900">
              {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}
            </motion.p>
          </AnimatePresence>
          <button type="button" onClick={() => onShift(-1)} aria-label="Hari sebelumnya" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => onShift(1)} disabled={isToday} aria-label="Hari berikutnya" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronRight size={18} /></button>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
        </div>

        {list.length > 0 && (
          <div className="flex items-center gap-3 px-5 pt-4">
            <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0 -rotate-90">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <motion.circle cx="14" cy="14" r="11" fill="none" stroke={pct === 1 ? '#10b981' : '#6366f1'} strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 11} animate={{ strokeDashoffset: 2 * Math.PI * 11 * (1 - pct) }} transition={{ duration: 0.4 }} />
            </svg>
            <span>
              <span className="block text-sm font-bold text-slate-800">{done.length} dari {list.length} sudah dicek</span>
              <span className="block text-xs text-slate-500">Cek kategorinya. Centang yang sudah benar, ketuk untuk mengubah.</span>
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {list.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl bg-slate-50 px-6 py-10 text-center">
              <LeoMascot mood="idle" size={80} />
              <p className="mt-2 font-bold text-slate-900">Tidak ada transaksi</p>
              <p className="text-sm text-slate-500">Hari ini kosong — hemat, atau ada yang belum dicatat?</p>
            </div>
          ) : (
            <LayoutGroup>
              <AnimatePresence initial={false}>
                {todo.length === 0 && (
                  <motion.div key="done-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mb-4 flex flex-col items-center rounded-3xl bg-slate-50 px-6 py-6 text-center">
                    <LeoMascot mood="happy" size={72} />
                    <p className="mt-1 font-bold text-slate-900">Semua sudah dicek</p>
                    <p className="text-sm text-slate-500">Kategori hari ini sudah benar semua.</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {todo.length > 0 && (
                <ul className="overflow-hidden rounded-3xl bg-slate-50">
                  <AnimatePresence initial={false}>{todo.map((t) => <Row key={t.id} t={t} checked={false} />)}</AnimatePresence>
                </ul>
              )}
              {done.length > 0 && (
                <>
                  <p className="px-2 pb-2 pt-5 text-sm font-semibold text-slate-500">Sudah dicek · {done.length}</p>
                  <ul className="overflow-hidden rounded-3xl bg-slate-50">
                    <AnimatePresence initial={false}>{done.map((t) => <Row key={t.id} t={t} checked />)}</AnimatePresence>
                  </ul>
                </>
              )}
            </LayoutGroup>
          )}
        </div>

        <AnimatePresence>
          {todo.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="px-5 pb-5 pt-2">
              <button type="button" onClick={() => { mark(todo.map((t) => t.id!), true); setOpen(null); }} className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                Semua sudah benar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
