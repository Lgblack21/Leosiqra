"use client";

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { useModal } from '@/context/ModalContext';
import { useFeedback } from '@/components/ui/Feedback';

// Panel geser dari kanan: semua transaksi rutin + saklar aktif/jeda.
export function RecurringDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { openModal } = useModal();
  const { toast } = useFeedback();
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me')
      .then((r) => (r.user?.id ? recurringService.getUserRecurring(r.user.id) : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const unsub = subscribeToCollectionChanges('recurring', load);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      unsub();
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load, onClose]);

  const toggle = async (r: RecurringTransaction) => {
    if (!r.id) return;
    const next = r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setBusy(r.id);
    setItems((cur) => cur?.map((x) => (x.id === r.id ? { ...x, status: next } : x)) ?? cur);
    try {
      await recurringService.updateRecurring(r.id, { status: next });
    } catch {
      toast.error('Gagal mengubah status.');
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Transaksi rutin">
          <motion.div className="absolute inset-0 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-white shadow-2xl sm:m-3 sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <div>
                <p className="text-lg font-extrabold text-slate-900">Transaksi rutin</p>
                <p className="text-xs text-slate-500">Tercatat otomatis sesuai jadwalnya</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Tutup panel" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {items === null ? (
                <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-50" />)}</div>
              ) : items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">Belum ada transaksi rutin.</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-3 py-2.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">{categoryEmoji(r.category || r.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{r.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {r.type === 'Pemasukan' ? '+' : '−'}{formatIDR(r.amount)} · {r.interval} · berikutnya {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(r.nextDate))}
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.status === 'ACTIVE'}
                        aria-label={`${r.status === 'ACTIVE' ? 'Jeda' : 'Aktifkan'} ${r.name}`}
                        disabled={busy === r.id}
                        onClick={() => toggle(r)}
                        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300', r.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300')}
                      >
                        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', r.status === 'ACTIVE' ? 'right-0.5' : 'left-0.5')} />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openModal('recurring');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Plus size={16} /> Tambah transaksi rutin
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
