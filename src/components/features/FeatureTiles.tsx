"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Plus } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { useFeatures, type FeatureId } from '@/lib/features';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { recurringService, recurringPerMonth, type RecurringTransaction } from '@/lib/services/recurringService';
import { sharedWalletService, type SharedWalletSummary } from '@/lib/services/sharedWalletService';
import { savingsGoalService, type SavingsGoal } from '@/lib/services/savingsGoalService';
import { useStreak } from '@/components/streak/CloseDay';
import { focusService, type FocusSession } from '@/lib/services/focusService';
import { itemService, type Item } from '@/lib/services/itemService';

export type TileStat = { value: string; sub?: string; progress?: number };

// "Fitur kamu" — satu kotak per fitur yang aktif, masing-masing dengan angka
// hidup. Angka yang sudah dihitung Dashboard dikirim lewat `base`; sisanya
// (rutin, dompet bersama, target tabungan, streak) dimuat di sini. Semua baca saja.
export function FeatureTiles({ base, className, limit, narrow }: { base: Partial<Record<FeatureId, TileStat>>; className?: string; limit?: number; narrow?: boolean }) {
  const { enabled, isOn } = useFeatures();
  const { data: streak } = useStreak();
  const [recurring, setRecurring] = useState<RecurringTransaction[] | null>(null);
  const [wallets, setWallets] = useState<SharedWalletSummary[] | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [focus, setFocus] = useState<{ today: string; items: FocusSession[] } | null>(null);

  useEffect(() => {
    if (isOn('rutin')) {
      cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me')
        .then((r) => (r.user?.id ? recurringService.getUserRecurring(r.user.id) : []))
        .then(setRecurring)
        .catch(() => setRecurring([]));
    }
    if (isOn('dompet-bersama')) sharedWalletService.list().then((r) => setWallets(r.items)).catch(() => setWallets([]));
    if (isOn('barang') || isOn('koleksi')) itemService.list().then(setItems).catch(() => setItems(null));
    if (isOn('fokus')) focusService.list().then(setFocus).catch(() => setFocus(null));
    if (isOn('tabungan')) savingsGoalService.getUserSavingsGoals().then(setGoals).catch(() => setGoals([]));
    // isOn berubah identitas tiap render; cukup muat ulang saat daftar fitur aktif berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled.map((f) => f.id).join(',')]);

  const stats: Partial<Record<FeatureId, TileStat>> = { ...base };

  if (streak) {
    stats.streak = {
      value: `${streak.streak} hari`,
      sub: streak.todayKind ? 'Hari ini sudah ditutup ✓' : `Minggu ini ${streak.week.closed}/${streak.week.target} · ${streak.coins} koin`,
    };
  }
  if (focus) {
    const t = focus.items.filter((x) => x.day === focus.today);
    stats.fokus = { value: `${t.reduce((s, x) => s + x.minutes, 0)} menit`, sub: t.length ? `${t.length} sesi hari ini` : 'Hari ini belum ada sesi' };
  }
  {
    const n = new Date();
    const end = new Date(n.getFullYear() + 1, 0, 1);
    const left = Math.floor((+end - +n) / 864e5);
    const start = new Date(n.getFullYear(), 0, 1);
    const pct = Math.round(((+n - +start) / (+end - +start)) * 100);
    stats.jurnal = { value: `${left} hari lagi`, sub: `menuju ${n.getFullYear() + 1} · ${pct}% tahun ini`, progress: pct };
  }
  if (items) {
    for (const k of ['barang', 'koleksi'] as const) {
      const list = items.filter((i) => i.kind === k);
      stats[k] = list.length ? { value: formatIDR(list.reduce((s, i) => s + i.current_value, 0)), sub: `${list.length} ${k}` } : { value: 'Belum ada', sub: `Tambah ${k}` };
    }
  }
  stats.peta = { value: 'Buka peta', sub: 'Tempat belanjamu' };
  stats.kanvas = { value: 'Lihat aliran', sub: 'Uang masuk → rekening → keluar' };
  if (recurring) {
    const active = recurring.filter((r) => r.status === 'ACTIVE' && r.type !== 'Tabungan');
    const next = [...active].sort((a, b) => +new Date(a.nextDate) - +new Date(b.nextDate))[0];
    const monthly = active
      .filter((r) => r.type === 'Pengeluaran')
      .reduce((s, r) => s + recurringPerMonth(r), 0);
    stats.rutin = active.length
      ? {
          value: `${formatIDR(monthly)}/bln`,
          sub: next ? `${next.name} · ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(next.nextDate))}` : `${active.length} aktif`,
        }
      : { value: 'Belum ada', sub: 'Tambah Netflix, listrik, cicilan…' };
  }
  if (wallets) {
    const active = wallets.filter((w) => !w.archived_at);
    stats['dompet-bersama'] = active.length
      ? { value: formatIDR(active.reduce((s, w) => s + (Number(w.balance) || 0), 0)), sub: `${active.length} dompet · ${active.reduce((s, w) => s + w.member_count, 0)} anggota` }
      : { value: 'Belum ada', sub: 'Ajak keluarga patungan' };
  }
  if (goals) {
    const withTarget = goals.filter((g) => g.targetAmount && g.targetAmount > 0);
    const top = withTarget.sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0))[0];
    if (top) {
      stats.tabungan = {
        value: `${Math.round(top.progressPercent ?? 0)}%`,
        sub: `${top.name} · ${formatIDR(top.currentTotal)} dari ${formatIDR(top.targetAmount ?? 0)}`,
        progress: top.progressPercent ?? 0,
      };
    }
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Fitur kamu</h2>
        <Link href="/membership/fitur" className="text-sm font-bold text-indigo-600 hover:underline">Atur fitur</Link>
      </div>
      <div className={cn('grid grid-cols-2 gap-3', !narrow && 'md:grid-cols-3')}>
        {(limit ? enabled.slice(0, limit) : enabled).map((f) => {
          const st = stats[f.id];
          return (
            <Link
              key={f.id}
              href={f.href}
              className="group flex min-h-[120px] flex-col rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(49,46,129,0.35)]"
            >
              <div className="flex items-center gap-2">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', f.tone)}><f.icon size={15} /></span>
                <span className="truncate text-[13px] font-semibold text-slate-500">{f.label}</span>
              </div>
              <p className="mt-3 truncate text-lg font-extrabold tracking-tight text-slate-900 tabular-nums">{st?.value ?? 'Buka'}</p>
              {typeof st?.progress === 'number' && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, st.progress)}%` }} />
                </div>
              )}
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{st?.sub ?? f.description}</p>
            </Link>
          );
        })}
        <Link
          href="/membership/fitur"
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 p-4 text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">{limit && enabled.length > limit ? <LayoutGrid size={17} /> : <Plus size={18} />}</span>
          <span className="text-sm font-bold">{limit && enabled.length > limit ? `Semua fitur (${enabled.length})` : 'Tambah fitur'}</span>
        </Link>
      </div>
    </div>
  );
}

