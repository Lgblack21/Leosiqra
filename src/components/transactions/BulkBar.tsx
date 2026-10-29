"use client";

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck, Loader2, Tags, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCategoryData } from '@/components/settings/CategoryBudgetViews';
import { categoryVisual } from '@/lib/categoryEmoji';
import { cn, formatIDR, isInvestmentFlow } from '@/lib/utils';

// Mode Pilih di halaman Transaksi: bar aksi melayang di bawah layar (di atas
// tab bar HP) + lembar "Pindahkan ke kategori". Logika hapus/ubah ada di
// halaman; komponen ini hanya tampilan.

const short = (n: number) =>
  n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);

export function BulkActionBar({
  open,
  count,
  total,
  out,
  inn,
  busy,
  onSelectAll,
  onCategory,
  categoryDisabledReason,
  onDelete,
  onClose,
}: {
  open: boolean;
  count: number;
  total: number;
  out: number;
  inn: number;
  busy: string | null;
  onSelectAll: () => void;
  onCategory: () => void;
  categoryDisabledReason: string | null;
  onDelete: () => void;
  onClose: () => void;
}) {
  const allSelected = count > 0 && count === total;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-3 md:bottom-6 md:left-[84px] lg:left-72 print:hidden"
        >
          <div role="toolbar" aria-label="Aksi transaksi terpilih" className="pointer-events-auto flex w-full max-w-2xl items-center gap-1.5 rounded-[22px] bg-[#0f172a] p-1.5 pl-4 text-white shadow-[0_24px_50px_-18px_rgba(15,23,42,0.75)] ring-1 ring-white/10">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold leading-tight">
                {count > 0 ? `${count} dipilih` : 'Ketuk transaksi untuk memilih'}
              </p>
              {count > 0 && (
                <p className="truncate text-[12px] text-white/60 tabular-nums">
                  {out > 0 && <>keluar <span className="font-semibold text-white">{short(out)}</span></>}
                  {out > 0 && inn > 0 && ' · '}
                  {inn > 0 && <>masuk <span className="font-semibold text-emerald-300">{short(inn)}</span></>}
                  {out === 0 && inn === 0 && 'transfer & pindah dana'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onSelectAll}
              disabled={Boolean(busy)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
            >
              <CheckCheck size={16} /> <span className="hidden sm:inline">{allSelected ? 'Batal semua' : `Semua ${total}`}</span>
            </button>
            <button
              type="button"
              onClick={onCategory}
              disabled={count === 0 || Boolean(busy) || Boolean(categoryDisabledReason)}
              title={categoryDisabledReason ?? 'Pindahkan ke kategori lain'}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[13px] font-semibold hover:bg-white/15 disabled:opacity-40"
            >
              <Tags size={16} /> <span className="hidden sm:inline">Kategori</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={count === 0 || Boolean(busy)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500 px-3 py-2 text-[13px] font-bold hover:bg-rose-600 disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              <span className="hidden sm:inline">{busy ?? 'Hapus'}</span>
            </button>
            <button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Keluar dari mode pilih" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-40">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Lembar pilih kategori — hanya kategori sejenis (pengeluaran/pemasukan) dengan
// transaksi terpilih. Dipasang hanya saat dibuka supaya data kategori tidak
// dimuat percuma.
export function BulkCategorySheet({
  kind,
  count,
  current,
  onClose,
  onPick,
}: {
  kind: 'pengeluaran' | 'pemasukan';
  count: number;
  current: string | null;
  onClose: () => void;
  onPick: (category: string) => Promise<void>;
}) {
  const { rows, loading } = useCategoryData();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Kategori investasi (Investasi/Saham/Deposito) disembunyikan: memindah
  // belanja ke sana membuatnya terhitung beli investasi (isInvestmentFlow).
  const list = rows.filter((r) => r.kind === kind && !isInvestmentFlow({ type: kind, category: r.name }));

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await onPick(picked);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Pindahkan ${count} transaksi`} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-[13px] text-slate-500">
          Pilih kategori {kind === 'pemasukan' ? 'pemasukan' : 'pengeluaran'} baru. Nominal & saldo tidak berubah — hanya kategorinya.
        </p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 py-6 text-center text-[14px] text-slate-500">Belum ada kategori {kind}.</p>
        ) : (
          <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {list.map((r) => {
              const v = categoryVisual(r.name, kind);
              const active = picked === r.name;
              const same = current === r.name;
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setPicked(r.name)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-[18px] px-2 py-3 text-center ring-1 transition-all',
                    active ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'bg-white ring-slate-200 hover:bg-slate-50'
                  )}
                >
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl text-[22px]', v.tile)} aria-hidden>{v.emoji}</span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-800">{r.name}</span>
                  {same && <span className="text-[10px] font-semibold text-slate-400">sekarang</span>}
                  {active && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><Check size={13} /></span>}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!picked || saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Tags size={16} />}
          {picked ? `Pindahkan ke ${picked}` : 'Pilih kategori'}
        </button>
      </div>
    </Modal>
  );
}
