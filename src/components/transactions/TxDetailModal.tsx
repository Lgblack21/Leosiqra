"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, MapPin, MessageCircle, Pencil, Trash2, X, ChevronRight, Lock } from 'lucide-react';
import { cn, formatMoney, isIncomingTransaction } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import type { Place } from '@/lib/services/connectService';
import { txSourceLabel, txSourceOf } from '@/lib/txSource';
import { useFeedback } from '@/components/ui/Feedback';
import { TagEditor } from '@/components/transactions/TagEditor';

// Detail satu transaksi sebagai popup. "Ubah" hanya untuk field yang tidak
// memengaruhi saldo (catatan, kategori, subkategori, tanggal) — mengubah
// nominal/rekening lewat PUT tidak menyesuaikan saldo, jadi untuk itu user
// diarahkan menghapus lalu mencatat ulang (hapus sudah membalik saldo).
export function TxDetailModal({
  tx,
  accountName,
  categoryLabel,
  categories,
  place,
  onClose,
  onDelete,
  onDuplicate,
  onAsk,
  knownTags = [],
}: {
  tx: Transaction | null;
  accountName: (id?: string) => string;
  categoryLabel: (t: Transaction) => string;
  categories: string[];
  place?: Place;
  onClose: () => void;
  onDelete: (t: Transaction) => void;
  onDuplicate?: (t: Transaction) => void;
  onAsk: (t: Transaction) => void;
  knownTags?: string[];
}) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [sub, setSub] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Kembali ke mode lihat setiap kali transaksi yang dibuka berganti.
  const [lastId, setLastId] = useState<string | undefined>(undefined);
  if (tx?.id !== lastId) {
    setLastId(tx?.id);
    setEditing(false);
  }

  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tx, onClose]);

  const startEdit = () => {
    if (!tx) return;
    setNote(tx.note || '');
    setCategory(categoryLabel(tx));
    setSub(tx.subCategory || '');
    setDate(new Date(tx.date).toLocaleDateString('sv-SE'));
    setEditing(true);
  };

  const save = async () => {
    if (!tx?.id) return;
    setSaving(true);
    try {
      const old = new Date(tx.date);
      const [y, m, d] = date.split('-').map(Number);
      const newDate = new Date(y, m - 1, d, old.getHours(), old.getMinutes(), old.getSeconds());
      await transactionService.updateTransaction(tx.id, {
        note: note.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(sub.trim() ? { subCategory: sub.trim() } : {}),
        ...(date && !Number.isNaN(newDate.getTime()) && newDate.toDateString() !== old.toDateString() ? { date: newDate, displayDate: newDate.toISOString() } : {}),
      });
      toast.success('Perubahan tersimpan.');
      setEditing(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  const incoming = tx ? isIncomingTransaction(tx) : false;
  const transfer = tx ? tx.type === 'transfer' || tx.type === 'topup' : false;
  const field = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white';

  return (
    <AnimatePresence>
      {tx && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Detail transaksi">
          <motion.div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
          >
            <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-500 shadow-sm hover:text-slate-900">
              <X size={18} />
            </button>

            <div className="flex flex-col items-center bg-gradient-to-b from-indigo-50/70 to-white px-6 pb-4 pt-7 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">{transfer ? '🔁' : categoryEmoji(categoryLabel(tx))}</span>
              <p className="mt-3 text-base font-bold text-slate-900">{tx.note || tx.subCategory || categoryLabel(tx)}</p>
              <p className={cn('mt-0.5 text-[34px] font-extrabold leading-tight tracking-tight tabular-nums', transfer ? 'text-slate-700' : incoming ? 'text-emerald-600' : 'text-slate-900')}>
                <span className="mr-1 align-top text-base font-bold text-slate-400">{incoming ? '+' : '−'}</span>
                {formatMoney(tx.amount, tx.currency)}
              </p>
              <p className="text-sm text-slate-500">
                {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(tx.date))} · {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(tx.createdAt))}
              </p>
              {!editing && (
                <div className="mt-4 grid w-full grid-cols-2 gap-2">
                  <button type="button" onClick={startEdit} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                    <Pencil size={14} /> Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate?.(tx)}
                    disabled={!onDuplicate || transfer}
                    title={transfer ? 'Transfer tidak bisa diduplikat dari sini' : undefined}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    <Copy size={14} /> Duplikat
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3 px-5 pb-5">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Catatan</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={field} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Kategori</span>
                      <input list="tx-cat-list" value={category} onChange={(e) => setCategory(e.target.value)} className={field} />
                      <datalist id="tx-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Subkategori</span>
                      <input value={sub} onChange={(e) => setSub(e.target.value)} className={field} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Tanggal</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
                  </label>
                  <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <Lock size={13} className="mt-0.5 shrink-0" />
                    Nominal & rekening dikunci supaya saldo tetap benar. Mau ganti? Hapus transaksi ini (saldo dikembalikan) lalu catat ulang.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(false)} className="rounded-full bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200">Batal</button>
                    <button type="button" onClick={save} disabled={saving} className="rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2 px-4 pb-5">
                  <div className="divide-y divide-slate-100 rounded-2xl bg-slate-50/80">
                    {[
                      [transfer ? 'Dari' : incoming ? 'Masuk ke' : 'Dari', accountName(tx.accountId)],
                      ...(transfer && tx.targetAccountId ? [['Ke', accountName(tx.targetAccountId)]] : []),
                      ['Kategori', `${categoryEmoji(categoryLabel(tx))} ${categoryLabel(tx)}`],
                      ...(tx.subCategory ? [['Subkategori', tx.subCategory]] : []),
                      ['Dicatat dari', `${txSourceLabel(txSourceOf(tx)).emoji} ${txSourceLabel(txSourceOf(tx)).label}`],
                      ...(tx.currency && tx.currency !== 'IDR' ? [['Setara rupiah', formatMoney(Number(tx.amountIDR) || 0, 'IDR')]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="text-slate-500">{k}</span>
                        <span className="truncate font-semibold text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>

                  {tx.id && <TagEditor key={tx.id} tx={tx} suggestions={knownTags} />}

                  {place ? (
                    <Link href="/membership/peta" className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 text-sm hover:bg-slate-100">
                      <span className="flex items-center gap-2 text-slate-500"><MapPin size={15} /> Tempat</span>
                      <span className="flex items-center gap-1 truncate font-semibold text-slate-800">{place.name || 'Lihat di peta'} <ChevronRight size={14} className="text-slate-400" /></span>
                    </Link>
                  ) : null}

                  <button type="button" onClick={() => onAsk(tx)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-100">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-500 shadow-sm"><MessageCircle size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">Tanya Leo soal ini</span>
                      <span className="block text-xs text-slate-500">Tulis pertanyaanmu, Leo jawab</span>
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>

                  <button type="button" onClick={() => onDelete(tx)} className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">
                    <Trash2 size={15} /> Hapus transaksi
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
