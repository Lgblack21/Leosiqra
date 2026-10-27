"use client";

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pause, Play, Pencil, Trash2, CalendarClock, Sparkles } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { savingsGoalService, type SavingsGoal } from '@/lib/services/savingsGoalService';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { RecurringModal } from '@/components/modals/RecurringModal';
import { useFeedback } from '@/components/ui/Feedback';
import { auth } from '@/lib/cf-client';

// Query recurring disaring di klien berdasarkan userId — wajib uid asli.
const uid = () => auth.currentUser?.uid ?? '';

// Panel Pengaturan → Target. Target = transaksi rutin bertipe Tabungan dengan
// nominal target (payload_json.targetAmount); progres dari setoran tabungan
// per kategori (GET /api/member/savings-goals). Tambah/ubah memakai
// RecurringModal yang sama dengan halaman Transaksi Rutin — tidak ada logika
// uang baru di sini. Menghapus target hanya menghapus jadwalnya; riwayat
// setoran tetap ada.

// goal = salah satu SAVING_GOALS (kategori tabungan yang dipakai modal & laporan).
const SUGGESTIONS: { name: string; goal: string; emoji: string; target: number }[] = [
  { name: 'Dana darurat', goal: 'Dana Darurat', emoji: '🛟', target: 15_000_000 },
  { name: 'Liburan', goal: 'Liburan', emoji: '🏝️', target: 8_000_000 },
  { name: 'Gadget baru', goal: 'Lainnya', emoji: '📱', target: 6_000_000 },
  { name: 'DP rumah', goal: 'Properti', emoji: '🏡', target: 100_000_000 },
  { name: 'Kendaraan', goal: 'Kendaraan', emoji: '🛵', target: 25_000_000 },
  { name: 'Pendidikan', goal: 'Pendidikan', emoji: '🎓', target: 20_000_000 },
];

const PER_MONTH: Record<SavingsGoal['interval'], number> = { Harian: 30, Mingguan: 52 / 12, Bulanan: 1, Tahunan: 1 / 12 };
const shortDate = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(d));

// Perkiraan bulan sampai target tercapai dari setoran rutin.
const monthsLeft = (g: SavingsGoal) => {
  if (!g.targetAmount || g.status === 'PAUSED') return null;
  const remaining = g.targetAmount - g.currentTotal;
  if (remaining <= 0) return 0;
  const monthly = g.monthlyAmount * PER_MONTH[g.interval];
  return monthly > 0 ? Math.ceil(remaining / monthly) : null;
};

function Ring({ pct, done }: { pct: number; done: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e0e7ff" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={done ? '#10b981' : 'url(#target-grad)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} />
        <defs>
          <linearGradient id="target-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className={cn('text-[13px] font-extrabold tabular-nums', done ? 'text-emerald-600' : 'text-slate-800')}>{done ? '🎉' : `${Math.round(pct)}%`}</span>
    </span>
  );
}

export function TargetView() {
  const { toast, confirm } = useFeedback();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [modal, setModal] = useState<{ open: boolean; data: RecurringTransaction | null }>({ open: false, data: null });
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    savingsGoalService.getUserSavingsGoals().then(setGoals).catch(() => setGoals([]));
  }, []);
  useEffect(() => {
    load();
    const unsubs = [subscribeToCollectionChanges('recurring', load), subscribeToCollectionChanges('savings', load)];
    return () => unsubs.forEach((u) => u());
  }, [load]);

  const fullRecord = async (id: string) => (await recurringService.getUserRecurring(uid())).find((r) => r.id === id) ?? null;

  const openNew = (name = '', targetAmount?: number, goal = '') =>
    setModal({
      open: true,
      data: name
        ? { userId: uid(), name, type: 'Tabungan', category: goal, accountId: '', amount: 0, interval: 'Bulanan', nextDate: new Date(), status: 'ACTIVE', createdAt: new Date(), targetAmount }
        : null,
    });
  const edit = async (g: SavingsGoal) => {
    const rec = await fullRecord(g.id).catch(() => null);
    if (!rec) return toast.error('Target tidak ditemukan. Coba muat ulang.');
    setModal({ open: true, data: rec });
  };
  const togglePause = async (g: SavingsGoal) => {
    setBusy(g.id);
    try {
      await recurringService.updateRecurring(g.id, { status: g.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' });
      toast.success(g.status === 'PAUSED' ? `Setoran ${g.name} dilanjutkan.` : `Setoran ${g.name} dijeda.`);
      load();
    } catch {
      toast.error('Gagal mengubah status target.');
    } finally {
      setBusy('');
    }
  };
  const remove = async (g: SavingsGoal) => {
    const ok = await confirm({ title: `Hapus target "${g.name}"?`, message: 'Setoran otomatisnya berhenti. Riwayat setoran & saldo tabungan tetap ada.', confirmLabel: 'Hapus target', danger: true });
    if (!ok) return;
    setBusy(g.id);
    try {
      await recurringService.deleteRecurring(g.id);
      toast.success('Target dihapus.');
      load();
    } catch {
      toast.error('Gagal menghapus target.');
    } finally {
      setBusy('');
    }
  };

  const withTarget = (goals ?? []).filter((g) => g.targetAmount);
  const saved = (goals ?? []).reduce((s, g) => s + Math.max(0, g.currentTotal), 0);
  const aim = withTarget.reduce((s, g) => s + (g.targetAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
        <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 text-[110px] leading-none opacity-15">🎯</span>
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-white/80">Terkumpul untuk target</p>
            <p className="mt-0.5 text-[26px] font-extrabold tabular-nums">{formatIDR(saved)}</p>
            <p className="text-[12px] text-white/75">{goals?.length ?? 0} target{aim > 0 ? ` · tujuan ${formatIDR(aim)}` : ''}</p>
          </div>
          <button type="button" onClick={() => openNew()} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-[13px] font-bold backdrop-blur hover:bg-white/30">
            <Plus size={15} strokeWidth={2.6} /> Target
          </button>
        </div>
      </div>

      {goals === null ? (
        <p className="py-8 text-center text-[14px] text-slate-400">Memuat…</p>
      ) : goals.length === 0 ? (
        <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"><Sparkles size={16} className="text-indigo-500" /> Mulai dari salah satu ini</p>
          <p className="text-[13px] text-slate-500">Leosiqra menyetor otomatis tiap periode dan menghitung kapan targetmu tercapai.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUGGESTIONS.map((sg) => (
              <button key={sg.name} type="button" onClick={() => openNew(sg.name, sg.target, sg.goal)} className="flex flex-col items-start gap-1 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-indigo-200">
                <span className="text-[24px]" aria-hidden>{sg.emoji}</span>
                <span className="text-[14px] font-semibold text-slate-900">{sg.name}</span>
                <span className="text-[12px] text-slate-500">± {formatIDR(sg.target)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = g.targetAmount ? (g.currentTotal / g.targetAmount) * 100 : 0;
            const done = Boolean(g.targetAmount) && pct >= 100;
            const left = monthsLeft(g);
            return (
              <li key={g.id} className={cn('rounded-[22px] bg-white p-4 ring-1', done ? 'ring-emerald-200' : 'ring-slate-200/70')}>
                <div className="flex items-center gap-4">
                  {g.targetAmount ? <Ring pct={pct} done={done} /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-[26px]">🐷</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[16px] font-bold text-slate-900">{g.name}</p>
                      {g.status === 'PAUSED' && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Dijeda</span>}
                    </div>
                    <p className="text-[14px] tabular-nums text-slate-700">
                      {formatIDR(g.currentTotal)}{g.targetAmount ? <span className="text-slate-400"> / {formatIDR(g.targetAmount)}</span> : ' terkumpul'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {done ? 'Target tercapai — hebat!' : left === null ? 'Atur nominal target untuk perkiraan' : left === 0 ? 'Hampir sampai' : `± ${left} bulan lagi`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-slate-500">
                    <CalendarClock size={14} className="shrink-0" />
                    <span className="truncate">{formatIDR(g.monthlyAmount)}/{g.interval.toLowerCase()} · berikutnya {shortDate(g.nextDate)}</span>
                  </span>
                  <button type="button" onClick={() => void edit(g)} disabled={busy === g.id} aria-label={`Ubah ${g.name}`} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-50"><Pencil size={14} /></button>
                  <button type="button" onClick={() => void togglePause(g)} disabled={busy === g.id} aria-label={g.status === 'PAUSED' ? `Lanjutkan ${g.name}` : `Jeda ${g.name}`} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                    {g.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button type="button" onClick={() => void remove(g)} disabled={busy === g.id} aria-label={`Hapus ${g.name}`} className="rounded-full bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 disabled:opacity-50"><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 text-[12px] leading-relaxed text-slate-500">
        Target memakai jadwal setoran otomatis ke Tabungan (sama dengan Transaksi Rutin bertipe Tabungan). Menjeda/menghapus target tidak mengubah saldo yang sudah tersimpan.
      </p>

      <RecurringModal userId={uid() || 'session'} isOpen={modal.open} onClose={() => { setModal({ open: false, data: null }); load(); }} initialData={modal.data} initialType="Tabungan" />
    </div>
  );
}
