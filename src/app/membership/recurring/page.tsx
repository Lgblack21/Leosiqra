"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pause, Play, Pencil, Trash2, CalendarClock, PiggyBank, ArrowRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { INTERVAL_LABEL, PER_MONTH, type RecurringInterval } from '@/lib/recurringIntervals';
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal';
import { useFeedback } from '@/components/ui/Feedback';

// Halaman Transaksi berulang: ringkasan per bulan, yang jatuh tempo 7 hari ke
// depan, lalu semua jadwal sebagai kartu. Tambah/ubah memakai form yang sama
// dengan Pengaturan → Transaksi rutin. Jadwal tabungan diubah dari Tabungan.

type Filter = 'semua' | 'Pengeluaran' | 'Pemasukan' | 'Tabungan' | 'jeda';

const PRESETS: { name: string; type: 'Pengeluaran' | 'Pemasukan'; emoji: string }[] = [
  { name: 'Gaji', type: 'Pemasukan', emoji: '💼' },
  { name: 'Kos / sewa', type: 'Pengeluaran', emoji: '🏠' },
  { name: 'Listrik & air', type: 'Pengeluaran', emoji: '💡' },
  { name: 'Internet', type: 'Pengeluaran', emoji: '📶' },
  { name: 'Netflix', type: 'Pengeluaran', emoji: '🎬' },
  { name: 'Cicilan', type: 'Pengeluaran', emoji: '🧾' },
];

const dayStart = (d: Date) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };
const daysUntil = (d: Date) => Math.round((dayStart(d).getTime() - dayStart(new Date()).getTime()) / 86_400_000);
const shortDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
const weekday = (d: Date) => new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
const relative = (d: Date) => {
  const n = daysUntil(d);
  if (n <= 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  if (n < 7) return `${n} hari lagi`;
  return shortDate(d);
};

export default function RecurringPage() {
  useCategoryStyles();
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<Filter>('semua');
  const [modal, setModal] = useState<{ open: boolean; item: RecurringTransaction | null }>({ open: false, item: null });
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    // Target tanpa setoran otomatis (nominal 0) bukan jadwal — dikelola di Tabungan.
    recurringService.listMine().then((list) => setItems(list.filter((t) => !(t.type === 'Tabungan' && t.amount <= 0)))).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => setAccounts([]));
    return subscribeToCollectionChanges('recurring', load);
  }, [load]);

  const currencyOf = (id: string) => accounts.find((a) => a.id === id)?.currency || 'IDR';
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const all = useMemo(() => [...(items ?? [])].sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime()), [items]);
  const active = all.filter((r) => r.status !== 'PAUSED');

  // Per bulan — hanya rekening IDR (mata uang lain tidak dijumlah mentah).
  const perMonth = (type: string) => active
    .filter((r) => r.type === type && currencyOf(r.accountId) === 'IDR')
    .reduce((s, r) => s + r.amount * (PER_MONTH[r.interval] ?? 1), 0);
  const inM = perMonth('Pemasukan');
  const outM = perMonth('Pengeluaran');
  const saveM = perMonth('Tabungan');
  const hasForeign = active.some((r) => currencyOf(r.accountId) !== 'IDR');

  const soon = active.filter((r) => daysUntil(r.nextDate) <= 7);
  const counts: Record<Filter, number> = {
    semua: all.length,
    Pengeluaran: all.filter((r) => r.type === 'Pengeluaran').length,
    Pemasukan: all.filter((r) => r.type === 'Pemasukan').length,
    Tabungan: all.filter((r) => r.type === 'Tabungan').length,
    jeda: all.filter((r) => r.status === 'PAUSED').length,
  };
  const shown = all.filter((r) => (filter === 'semua' ? true : filter === 'jeda' ? r.status === 'PAUSED' : r.type === filter));

  const openNew = (preset?: (typeof PRESETS)[number]) =>
    setModal({
      open: true,
      item: preset
        ? { userId: '', name: preset.name, type: preset.type, category: '', accountId: '', amount: 0, interval: 'Bulanan', nextDate: new Date(), status: 'ACTIVE', createdAt: new Date() }
        : null,
    });

  const togglePause = async (r: RecurringTransaction) => {
    if (!r.id) return;
    setBusy(r.id);
    try {
      await recurringService.updateRecurring(r.id, { status: r.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' });
      toast.success(r.status === 'PAUSED' ? `${r.name} jalan lagi.` : `${r.name} dijeda — tidak dicatat sampai dilanjutkan.`);
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
      toast.success('Jadwal dihapus.');
      load();
    } catch {
      toast.error('Gagal menghapus.');
    } finally {
      setBusy('');
    }
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'semua', label: 'Semua' },
    { id: 'Pengeluaran', label: 'Uang keluar' },
    { id: 'Pemasukan', label: 'Uang masuk' },
    { id: 'Tabungan', label: 'Tabungan' },
    { id: 'jeda', label: 'Dijeda' },
  ];

  return (
    <div className="mx-auto mb-12 max-w-[1200px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Transaksi berulang</h1>
          <p className="text-[14px] text-slate-500">Dicatat otomatis tiap jatuh tempo — saldo rekening ikut berubah.</p>
        </div>
        <button type="button" onClick={() => openNew()} className="flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">
          <Plus size={16} strokeWidth={2.5} /> Tambah jadwal
        </button>
      </div>

      {/* Ringkasan per bulan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Masuk / bulan', value: inM, sign: '+', cls: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Keluar / bulan', value: outM, sign: '−', cls: 'text-rose-700', bg: 'bg-rose-50' },
          { label: 'Ke tabungan / bulan', value: saveM, sign: '', cls: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Sisa / bulan', value: inM - outM - saveM, sign: inM - outM - saveM < 0 ? '−' : '', cls: inM - outM - saveM < 0 ? 'text-rose-700' : 'text-slate-900', bg: 'bg-white ring-1 ring-slate-200/70', abs: true },
        ].map((t) => (
          <div key={t.label} className={cn('rounded-[22px] p-4 md:p-5', t.bg)}>
            <p className="text-[13px] text-slate-600">{t.label}</p>
            <p className={cn('mt-1 text-[20px] font-extrabold tabular-nums md:text-[22px]', t.cls)}>
              {t.sign}{formatCurrency(Math.round(t.abs ? Math.abs(t.value) : t.value), 'IDR')}
            </p>
          </div>
        ))}
      </div>
      {hasForeign && <p className="-mt-3 px-1 text-[12px] text-slate-500">Jadwal di rekening non-IDR tidak dijumlahkan di ringkasan.</p>}

      {/* 7 hari ke depan */}
      {soon.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold text-slate-900"><CalendarClock size={18} className="text-indigo-600" /> 7 hari ke depan</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {soon.map((r) => {
              const income = r.type === 'Pemasukan';
              return (
                <div key={r.id} className="flex min-w-[220px] shrink-0 items-center gap-3 rounded-[20px] bg-white p-3 pr-4 ring-1 ring-slate-200/70">
                  <span className={cn('flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none', daysUntil(r.nextDate) <= 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700')}>
                    <span className="text-[10px] uppercase">{weekday(r.nextDate)}</span>
                    <span className="text-[17px] font-extrabold">{r.nextDate.getDate()}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">{r.name}</span>
                    <span className={cn('block text-[13px] font-bold tabular-nums', income ? 'text-emerald-600' : r.type === 'Tabungan' ? 'text-indigo-600' : 'text-slate-700')}>
                      {income ? '+' : '−'}{formatCurrency(r.amount, currencyOf(r.accountId))}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter */}
      {all.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.filter((f) => f.id === 'semua' || counts[f.id] > 0).map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px] transition', filter === f.id ? 'bg-slate-900 font-semibold text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {f.label}
            <span className={cn('rounded-full px-1.5 text-[12px] tabular-nums', filter === f.id ? 'bg-white/20' : 'bg-slate-100')}>{counts[f.id]}</span>
          </button>
        ))}
      </div>}

      {items === null ? (
        <p className="py-12 text-center text-[14px] text-slate-400">Memuat…</p>
      ) : all.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-slate-200 bg-white/60 p-6 text-center md:p-10">
          <p className="text-[32px]" aria-hidden>🔁</p>
          <p className="mt-1 text-[17px] font-bold text-slate-900">Belum ada transaksi berulang</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[14px] text-slate-500">Catat sekali, Leosiqra yang mencatat tiap jatuh tempo. Mulai dari salah satu ini:</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" onClick={() => openNew(p)} className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[14px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-300">
                <span aria-hidden>{p.emoji}</span> {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-slate-500">Tidak ada jadwal di filter ini.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => {
            const income = r.type === 'Pemasukan';
            const saving = r.type === 'Tabungan';
            const paused = r.status === 'PAUSED';
            const v = saving ? { emoji: '🐷', tile: 'bg-indigo-50' } : categoryVisual(r.category, income ? 'pemasukan' : 'pengeluaran');
            const n = daysUntil(r.nextDate);
            return (
              <div key={r.id} className={cn('flex flex-col rounded-[24px] bg-white p-4 ring-1 ring-slate-200/70 transition', paused && 'bg-slate-50')}>
                <div className="flex items-start gap-3">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[20px]', v.tile, paused && 'grayscale')} aria-hidden>{v.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-slate-900">{r.name}</p>
                    <p className="truncate text-[12px] text-slate-500">{saving ? `Tabungan · ${r.category}` : r.category || 'Tanpa kategori'}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', paused ? 'bg-amber-50 text-amber-700' : n <= 0 ? 'bg-indigo-600 text-white' : n <= 7 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600')}>
                    {paused ? 'Dijeda' : relative(r.nextDate)}
                  </span>
                </div>
                <p className={cn('mt-3 text-[22px] font-extrabold tabular-nums', paused ? 'text-slate-400' : income ? 'text-emerald-600' : saving ? 'text-indigo-600' : 'text-slate-900')}>
                  {income ? '+' : '−'}{formatCurrency(r.amount, currencyOf(r.accountId))}
                </p>
                <p className="text-[12px] text-slate-500">
                  {INTERVAL_LABEL[r.interval as RecurringInterval] ?? r.interval} · {income ? 'ke' : 'dari'} {accountName(r.accountId)}
                </p>
                <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3">
                  {saving ? (
                    <Link href="/membership/tabungan" className="flex flex-1 items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">
                      <PiggyBank size={15} /> Atur di Tabungan <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setModal({ open: true, item: r })} className="flex flex-1 items-center gap-1.5 text-[13px] font-semibold text-slate-700 hover:text-indigo-600">
                      <Pencil size={14} /> Ubah
                    </button>
                  )}
                  <button type="button" onClick={() => void togglePause(r)} disabled={busy === r.id} aria-label={paused ? `Lanjutkan ${r.name}` : `Jeda ${r.name}`} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                    {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Lanjut' : 'Jeda'}
                  </button>
                  <button type="button" onClick={() => void remove(r)} disabled={busy === r.id} aria-label={`Hapus ${r.name}`} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => openNew()} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-slate-200 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Plus size={20} /></span>
            <span className="text-[14px] font-semibold">Tambah jadwal</span>
          </button>
        </div>
      )}

      <RecurringFormModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} onSaved={load} />
    </div>
  );
}
