"use client";

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pause, Play, Trash2, PiggyBank, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { INTERVAL_LABEL, PER_MONTH, type RecurringInterval } from '@/lib/recurringIntervals';
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Transaksi rutin. Pemasukan/Pengeluaran yang dicatat
// otomatis tiap jatuh tempo. Setoran tabungan otomatis dikelola di Target.

const shortDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
const daysUntil = (d: Date) => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};
const whenLabel = (d: Date) => {
  const n = daysUntil(d);
  if (n <= 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  if (n < 7) return `${n} hari lagi`;
  return shortDate(d);
};

export function RecurringView({ openTarget }: { openTarget: () => void }) {
  useCategoryStyles();
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [modal, setModal] = useState<{ open: boolean; item: RecurringTransaction | null }>({ open: false, item: null });
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    recurringService.listMine().then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => setAccounts([]));
    return subscribeToCollectionChanges('recurring', load);
  }, [load]);

  const currencyOf = (id: string) => accounts.find((a) => a.id === id)?.currency || 'IDR';
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const list = (items ?? []).filter((r) => r.type !== 'Tabungan').sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
  const savingsCount = (items ?? []).filter((r) => r.type === 'Tabungan' && Number(r.amount) > 0).length;
  // Ringkasan per bulan hanya untuk rekening IDR (mata uang lain tidak dijumlah mentah).
  const monthly = (kind: string) => list
    .filter((r) => r.type === kind && r.status !== 'PAUSED' && currencyOf(r.accountId) === 'IDR')
    .reduce((s, r) => s + Number(r.amount) * (PER_MONTH[r.interval] ?? 1), 0);
  const inMonth = monthly('Pemasukan');
  const outMonth = monthly('Pengeluaran');

  const togglePause = async (r: RecurringTransaction) => {
    if (!r.id) return;
    setBusy(r.id);
    try {
      await recurringService.updateRecurring(r.id, { status: r.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' });
      toast.success(r.status === 'PAUSED' ? `${r.name} jalan lagi.` : `${r.name} dijeda.`);
      load();
    } catch {
      toast.error('Gagal mengubah status.');
    } finally {
      setBusy('');
    }
  };
  const remove = async (r: RecurringTransaction) => {
    if (!r.id) return;
    const ok = await confirm({ title: `Hapus "${r.name}"?`, message: 'Jadwalnya berhenti. Transaksi yang sudah tercatat tetap ada.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    setBusy(r.id);
    try {
      await recurringService.deleteRecurring(r.id);
      toast.success('Transaksi rutin dihapus.');
      load();
    } catch {
      toast.error('Gagal menghapus.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[20px] bg-emerald-50 p-4">
          <p className="text-[12px] text-emerald-700">Masuk / bulan</p>
          <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-emerald-700">+{formatCurrency(Math.round(inMonth), 'IDR')}</p>
        </div>
        <div className="rounded-[20px] bg-rose-50 p-4">
          <p className="text-[12px] text-rose-700">Keluar / bulan</p>
          <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-rose-700">−{formatCurrency(Math.round(outMonth), 'IDR')}</p>
        </div>
      </div>

      {items === null ? (
        <p className="py-8 text-center text-[14px] text-slate-400">Memuat…</p>
      ) : list.length === 0 ? (
        <div className="rounded-[22px] border-2 border-dashed border-slate-200 px-5 py-8 text-center">
          <p className="text-[28px]" aria-hidden>🔁</p>
          <p className="mt-1 text-[15px] font-semibold text-slate-900">Belum ada transaksi rutin</p>
          <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-slate-500">Gaji, langganan, kos, atau cicilan — catat sekali, Leosiqra yang mencatat tiap jatuh tempo.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200/70">
          {list.map((r) => {
            const income = r.type === 'Pemasukan';
            const paused = r.status === 'PAUSED';
            const v = categoryVisual(r.category, income ? 'pemasukan' : 'pengeluaran');
            const next = new Date(r.nextDate);
            return (
              <li key={r.id} className={cn('flex items-center gap-3 px-4 py-3', paused && 'opacity-60')}>
                <button type="button" onClick={() => setModal({ open: true, item: r })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[20px]', v.tile)} aria-hidden>{v.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-900">{r.name}</span>
                      {paused && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Dijeda</span>}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {INTERVAL_LABEL[r.interval as RecurringInterval] ?? r.interval} · {accountName(r.accountId)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn('block text-[15px] font-bold tabular-nums', income ? 'text-emerald-600' : 'text-slate-900')}>{income ? '+' : '−'}{formatCurrency(Number(r.amount), currencyOf(r.accountId))}</span>
                    <span className="block text-[12px] text-slate-500">{paused ? '—' : whenLabel(next)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button type="button" onClick={() => void togglePause(r)} disabled={busy === r.id} aria-label={paused ? `Lanjutkan ${r.name}` : `Jeda ${r.name}`} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                    {paused ? <Play size={15} /> : <Pause size={15} />}
                  </button>
                  <button type="button" onClick={() => void remove(r)} disabled={busy === r.id} aria-label={`Hapus ${r.name}`} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {savingsCount > 0 && (
        <button type="button" onClick={openTarget} className="flex w-full items-center gap-3 rounded-[20px] bg-slate-50 px-4 py-3 text-left hover:bg-slate-100">
          <PiggyBank size={18} className="shrink-0 text-indigo-600" />
          <span className="flex-1 text-[14px] text-slate-700">{savingsCount} setoran tabungan otomatis ada di <b>Target</b></span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      )}

      <button type="button" onClick={() => setModal({ open: true, item: null })} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800">
        <Plus size={17} strokeWidth={2.6} /> Tambah transaksi rutin
      </button>

      <RecurringFormModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} onSaved={load} />
    </div>
  );
}
