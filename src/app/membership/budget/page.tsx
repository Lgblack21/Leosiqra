"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Loader2, PencilLine, Plus, X } from 'lucide-react';
import { useCategoryData, type CategoryRow } from '@/components/settings/CategoryBudgetViews';
import { budgetService } from '@/lib/services/budgetService';
import { useBudgetStartDay } from '@/lib/useBudgetStartDay';
import { currentBudgetPeriod, formatBudgetPeriod } from '@/lib/budget';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { openSettings } from '@/lib/settingsPanel';
import { auth } from '@/lib/cf-client';
import { useFeedback } from '@/components/ui/Feedback';
import { HeaderSlot } from '@/components/Header';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatIDR, isInvestmentFlow } from '@/lib/utils';

// Anggaran: halaman sendiri (dibuka dari Laporan/Ringkasan, tidak di menu
// samping). Periode bulanan mengikuti awal periode anggaran (budgetStartDay).
// Penanda di tiap bar = seberapa jauh periode sudah berjalan; "terlalu cepat"
// = kalau laju belanja sekarang diteruskan, akhir periode melewati anggaran.
// Mode Ubah: semua nominal anggaran bulanan diedit di tempat lalu disimpan
// sekaligus (kosong = hapus anggaran). Data & realisasi dari useCategoryData
// (sama dengan Pengaturan → Kategori & Anggaran).

const short = (n: number) =>
  Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);
const digits = (s: string) => s.replace(/[^\d]/g, '');

export default function BudgetPage() {
  useCategoryStyles();
  const { rows, loading } = useCategoryData();
  const { day: startDay } = useBudgetStartDay();
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  // "Hari ini" mengikuti jam perangkat (static export: belum diketahui saat build).
  useEffect(() => setNow(new Date()), []);

  const period = useMemo(() => currentBudgetPeriod(startDay, now ?? new Date()), [startDay, now]);
  const totalDays = Math.round((period.end.getTime() - period.start.getTime()) / 86400e3);
  const elapsedDays = now ? Math.min(totalDays, Math.max(1, Math.floor((now.getTime() - period.start.getTime()) / 86400e3) + 1)) : 1;
  const timePct = elapsedDays / totalDays;
  const daysLeft = totalDays - elapsedDays;

  const expense = rows.filter((r) => r.kind === 'pengeluaran' && !isInvestmentFlow({ type: 'pengeluaran', category: r.name }));
  const monthly = expense.filter((r) => r.budget && r.budget.period === 'monthly' && r.budget.amount > 0);
  const yearly = expense.filter((r) => r.budget && r.budget.period === 'yearly' && r.budget.amount > 0);
  const unbudgeted = expense.filter((r) => !r.budget || r.budget.amount <= 0).sort((a, b) => b.spent - a.spent);
  const budgetTotal = monthly.reduce((s, r) => s + (r.budget?.amount ?? 0), 0);
  const used = monthly.reduce((s, r) => s + r.spent, 0);
  const outside = unbudgeted.reduce((s, r) => s + r.spent, 0);
  const projected = Math.round((used / elapsedDays) * totalDays);
  const left = budgetTotal - used;
  const status = budgetTotal === 0 ? null : used > budgetTotal ? 'over' : projected > budgetTotal ? 'fast' : used / budgetTotal > 0.85 ? 'tight' : 'ok';

  const pace = (r: CategoryRow) => {
    const amount = r.budget?.amount ?? 0;
    if (!amount) return null;
    if (r.spent > amount) return 'over';
    if (r.budget?.period === 'monthly' && (r.spent / elapsedDays) * totalDays > amount) return 'fast';
    return 'ok';
  };

  const startEdit = () => {
    setDraft(Object.fromEntries(expense.map((r) => [r.name, r.budget?.amount ? String(Math.round(r.budget.amount)) : ''])));
    setEditing(true);
  };
  const changed = expense.filter((r) => {
    if (!(r.name in draft)) return false;
    const next = Number(digits(draft[r.name]) || 0);
    return next !== Math.round(r.budget?.amount ?? 0);
  });
  const saveAll = async () => {
    setSaving(true);
    let done = 0;
    try {
      for (const r of changed) {
        const value = Number(digits(draft[r.name]) || 0);
        if (!value && r.budget?.id) await budgetService.deleteBudget(r.budget.id);
        else if (value && r.budget?.id) await budgetService.updateBudget(r.budget.id, { amount: value });
        else if (value) await budgetService.createBudget({ userId: auth.currentUser?.uid ?? 'session', type: 'pengeluaran', category: r.name, amount: value, period: 'monthly' });
        done++;
      }
      toast.success(done ? `${done} anggaran disimpan.` : 'Tidak ada perubahan.');
      setEditing(false);
    } catch (e) {
      console.error(e);
      toast.error(`Baru ${done} dari ${changed.length} yang tersimpan. Coba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  // Fungsi render (bukan komponen) supaya input tidak di-mount ulang dan kehilangan fokus tiap ketikan.
  const amountInput = (r: CategoryRow) => (
    <label className="flex w-36 shrink-0 items-center gap-1 rounded-xl bg-slate-50 px-2.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 md:w-44">
      <span className="text-[12px] text-slate-400">Rp</span>
      <input
        inputMode="numeric"
        value={draft[r.name] ? Number(digits(draft[r.name])).toLocaleString('id-ID') : ''}
        onChange={(e) => setDraft((d) => ({ ...d, [r.name]: digits(e.target.value) }))}
        placeholder="Tanpa anggaran"
        aria-label={`Anggaran ${r.name}`}
        className="w-full bg-transparent py-2 text-right text-[14px] font-semibold text-slate-900 outline-none placeholder:text-[12px] placeholder:font-normal placeholder:text-slate-400"
      />
    </label>
  );

  const bar = (value: number, total: number, over: boolean) => (
    <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full', over ? 'bg-rose-500' : value / total > 0.85 ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
      <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-700/70" style={{ left: `${timePct * 100}%` }} />
    </div>
  );

  return (
    <div className={cn('mx-auto max-w-4xl space-y-6 pb-12', editing && 'pb-28')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Anggaran</h1>
          <p className="text-[13px] text-slate-500">{formatBudgetPeriod(period)} · sisa {daysLeft} hari</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openSettings('periode')} aria-label="Awal periode anggaran" className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <CalendarDays size={15} /> <span className="hidden sm:inline">Awal periode</span>
          </button>
          {!editing && (
            <button type="button" onClick={startEdit} disabled={loading} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-40">
              <PencilLine size={15} /> <span className="hidden sm:inline">Ubah anggaran</span>
            </button>
          )}
          <HeaderSlot />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-36 rounded-[24px]" /><Skeleton className="h-64 rounded-[24px]" /></div>
      ) : (
        <>
          {/* Kartu utama */}
          {budgetTotal > 0 ? (
            <section className={cn('relative overflow-hidden rounded-[24px] p-5 text-white md:p-6', status === 'over' ? 'bg-gradient-to-br from-rose-500 to-pink-600' : status === 'fast' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-indigo-600 to-violet-600')}>
              <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">{left >= 0 ? 'Sisa anggaran' : 'Lewat anggaran'}</p>
                  <p className="text-[30px] font-extrabold leading-tight tabular-nums md:text-[34px]">{formatIDR(Math.abs(left))}</p>
                  <p className="text-[13px] text-white/85">
                    Terpakai {short(used)} dari {short(budgetTotal)}
                    {daysLeft > 0 && left > 0 ? ` · ±${short(Math.round(left / Math.max(1, daysLeft)))}/hari sampai akhir periode` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">
                  {status === 'over' ? '🔥 Lewat' : status === 'fast' ? '⚡ Terlalu cepat' : status === 'tight' ? '⚠️ Hampir habis' : '✅ Aman'}
                </span>
              </div>
              <div className="relative mt-4 h-3 rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (used / budgetTotal) * 100)}%` }} />
                <span aria-hidden className="absolute -top-1.5 h-6 w-1 rounded-full bg-slate-900/60" style={{ left: `${timePct * 100}%` }} />
              </div>
              <div className="relative mt-2 flex flex-wrap justify-between gap-x-4 text-[12px] text-white/80">
                <span>Hari ke-{elapsedDays} dari {totalDays} (penanda)</span>
                <span>Perkiraan akhir periode {short(projected)}</span>
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] bg-white p-6 text-center ring-1 ring-slate-100">
              <p className="text-[15px] font-bold text-slate-900">Belum ada anggaran bulanan</p>
              <p className="mt-1 text-[13px] text-slate-500">Tentukan batas belanja per kategori supaya Leosiqra bisa memberi tahu kalau mulai boros.</p>
              {!editing && (
                <button type="button" onClick={startEdit} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white"><Plus size={15} /> Atur anggaran</button>
              )}
            </section>
          )}

          {/* Per kategori */}
          {(monthly.length > 0 || yearly.length > 0) && (
            <section>
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Per kategori</h2>
              <p className="text-[12px] text-slate-500">Garis tegak = seberapa jauh periode sudah berjalan.</p>
              <ul className="mt-3 divide-y divide-slate-100 rounded-[20px] bg-white ring-1 ring-slate-100">
                {[...monthly, ...yearly]
                  .sort((a, b) => b.spent / (b.budget?.amount || 1) - a.spent / (a.budget?.amount || 1))
                  .map((r) => {
                    const v = categoryVisual(r.name, 'pengeluaran');
                    const amount = r.budget?.amount ?? 0;
                    const p = pace(r);
                    return (
                      <li key={r.name} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]', v.tile)} aria-hidden>{v.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[14px] font-semibold text-slate-900">
                              {r.name}{r.budget?.period === 'yearly' && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">tahunan</span>}
                            </p>
                            {!editing && (
                              <span className={cn('shrink-0 text-[13px] font-bold', p === 'over' ? 'text-rose-600' : p === 'fast' ? 'text-amber-600' : 'text-slate-700')}>
                                {p === 'over' ? `Lewat ${short(r.spent - amount)}` : `Sisa ${short(amount - r.spent)}`}
                                {p === 'fast' && <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px]">terlalu cepat</span>}
                              </span>
                            )}
                          </div>
                          {!editing && bar(r.spent, amount, p === 'over')}
                          <p className="mt-1 text-[12px] tabular-nums text-slate-500">{formatIDR(r.spent)}{!editing && ` / ${formatIDR(amount)}`}</p>
                        </div>
                        {editing && amountInput(r)}
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          {/* Belum ada anggaran */}
          {unbudgeted.length > 0 && (
            <section>
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Belum ada anggaran</h2>
              <p className="text-[12px] text-slate-500">{outside > 0 ? `${short(outside)} belanja periode ini belum dibatasi.` : 'Kategori pengeluaran tanpa batas.'}</p>
              <ul className="mt-3 divide-y divide-slate-100 rounded-[20px] bg-white ring-1 ring-slate-100">
                {unbudgeted.map((r) => {
                  const v = categoryVisual(r.name, 'pengeluaran');
                  return (
                    <li key={r.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900">{r.name}</p>
                      {editing ? (
                        amountInput(r)
                      ) : (
                        <>
                          <span className="text-[13px] font-semibold tabular-nums text-slate-600">{formatIDR(r.spent)}</span>
                          <button type="button" onClick={startEdit} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-100">Atur</button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <p className="px-1 text-[12px] text-slate-400">
            &ldquo;Terlalu cepat&rdquo; = kalau belanja terus seperti sekarang, kategori itu melewati anggarannya di akhir periode. Ikon, subkategori, dan kategori baru diatur di{' '}
            <button type="button" onClick={() => openSettings('kategori')} className="font-semibold text-indigo-600 hover:underline">Pengaturan → Kategori & Anggaran</button>.
          </p>
        </>
      )}

      {/* Bar simpan mode Ubah */}
      {editing && (
        <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-3 md:bottom-6 md:left-[84px] lg:left-72 print:hidden">
          <div className="flex w-full max-w-xl items-center gap-2 rounded-[22px] bg-[#0f172a] p-1.5 pl-4 text-white shadow-[0_24px_50px_-18px_rgba(15,23,42,0.75)]">
            <p className="min-w-0 flex-1 text-[13px] font-semibold">{changed.length ? `${changed.length} anggaran diubah` : 'Ketik nominal; kosongkan untuk menghapus'}</p>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/10"><X size={15} /> Batal</button>
            <button type="button" onClick={() => void saveAll()} disabled={saving || changed.length === 0} className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-[13px] font-bold disabled:opacity-40">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
