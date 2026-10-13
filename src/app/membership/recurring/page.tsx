"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Plus } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { useModal } from '@/context/ModalContext';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { recurringService, recurringPerMonth, type RecurringTransaction } from '@/lib/services/recurringService';
import { accountService, type Account } from '@/lib/services/accountService';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { Skeleton } from '@/components/ui/Skeleton';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { incomeEmoji } from '@/components/subscriptions/IncomeModal';

// Pemasukan rutin: gaji & pemasukan tetap lain yang dicatat otomatis tiap
// periodenya. Jadwal pengeluaran (Netflix, listrik, cicilan) tampil di
// Langganan; setoran tabungan otomatis tetap ditampilkan di sini.

const card = 'rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]';
const daysUntil = (d: Date) => Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
const fmt = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(d));
const intervalLabel = (i: string) => (i === '3 Bulanan' ? 'Tiap 3 bulan' : i);

export default function RecurringPage() {
  const { openModal } = useModal();
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    let uid = '';
    const load = () =>
      (uid ? Promise.resolve(uid) : cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me').then((r) => (uid = r.user?.id ?? '')))
        .then((id) => (id ? recurringService.getUserRecurring(id) : []))
        .then(setItems)
        .catch(() => setItems([]));
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    return subscribeToCollectionChanges('recurring', load);
  }, []);

  const all = items ?? [];
  const income = all.filter((r) => r.type === 'Pemasukan').sort((a, b) => Number(a.status !== 'ACTIVE') - Number(b.status !== 'ACTIVE') || +new Date(a.nextDate) - +new Date(b.nextDate));
  const saving = all.filter((r) => r.type === 'Tabungan');
  const expenseCount = all.filter((r) => r.type === 'Pengeluaran').length;
  const active = income.filter((r) => r.status === 'ACTIVE');
  const monthly = active.reduce((s, r) => s + recurringPerMonth(r), 0);
  const next = active[0];
  const acc = (id?: string) => accounts.find((a) => a.id === id);

  const Row = ({ r, onOpen }: { r: RecurringTransaction; onOpen: () => void }) => {
    const paused = r.status !== 'ACTIVE';
    const dd = daysUntil(r.nextDate);
    const a = acc(r.accountId);
    return (
      <li>
        <button type="button" onClick={onOpen} className={cn('flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 md:px-6', paused && 'opacity-50')}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xl">{r.type === 'Tabungan' ? '🐷' : incomeEmoji(r)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-slate-800">{r.name}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-slate-400">
              {a && <AccountLogo acc={a} size={14} />}
              {a?.name ?? '—'} · {intervalLabel(r.interval)}
              {r.autoRecord === false && ' · pengingat'}
              {paused && ' · dijeda'}
            </span>
          </span>
          <span className="text-right">
            <span className={cn('block text-[15px] font-extrabold tabular-nums', r.type === 'Tabungan' ? 'text-indigo-600' : 'text-emerald-600')}>
              {r.type === 'Tabungan' ? '' : '+'}{formatIDR(r.amount)}
            </span>
            {!paused && (
              <span className={cn('text-xs font-semibold', dd <= 3 ? 'text-amber-600' : 'text-slate-400')}>
                {fmt(r.nextDate)} · {dd < 0 ? 'lewat' : dd === 0 ? 'hari ini' : dd === 1 ? 'besok' : `${dd} hari lagi`}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Gaji dan pemasukan tetap lainnya, tercatat sendiri tiap tanggalnya.</p>
        <button type="button" onClick={() => openModal('pemasukan_rutin')} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800">
          <Plus size={15} /> Tambah pemasukan rutin
        </button>
      </div>

      <section className={cn(card, 'flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-white to-emerald-50/60 p-5 md:p-6')}>
        <div>
          <p className="text-sm font-semibold text-slate-500">Pemasukan rutin per bulan</p>
          {items === null ? <Skeleton className="mt-2 h-10 w-44" /> : <p className="text-[34px] font-extrabold tracking-tight text-emerald-600 tabular-nums">{formatIDR(monthly)}</p>}
          <p className="text-sm text-slate-500">
            {active.length} sumber aktif{next ? <> · berikutnya <b className="text-slate-700">{next.name}</b> {fmt(next.nextDate)}</> : ''}
          </p>
        </div>
        <LeoMascot mood={active.length ? 'happy' : 'idle'} size={84} />
      </section>

      <section className={card}>
        <p className="px-5 pb-1 pt-5 text-lg font-extrabold tracking-tight text-slate-900 md:px-6">Pemasukan</p>
        {items === null ? (
          <div className="space-y-2 p-5">{[1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : income.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <p className="font-bold text-slate-900">Belum ada pemasukan rutin</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Tambahkan gaji atau pemasukan tetap lain supaya tercatat otomatis tiap tanggal terimanya.</p>
            <button type="button" onClick={() => openModal('pemasukan_rutin')} className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
              <Plus size={15} /> Tambah gaji
            </button>
          </div>
        ) : (
          <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }} className="pb-2">
            {income.map((r) => (
              <motion.div key={r.id} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }}>
                <Row r={r} onOpen={() => openModal('pemasukan_rutin', { initial: r })} />
              </motion.div>
            ))}
          </motion.ul>
        )}
      </section>

      {saving.length > 0 && (
        <section className={card}>
          <p className="px-5 pb-1 pt-5 text-lg font-extrabold tracking-tight text-slate-900 md:px-6">Tabungan otomatis</p>
          <ul className="pb-2">
            {saving.map((r) => <Row key={r.id} r={r} onOpen={() => openModal('recurring', { prefill: r })} />)}
          </ul>
        </section>
      )}

      <Link href="/membership/langganan" className={cn(card, 'group flex items-center gap-3 p-5 transition-colors hover:bg-slate-50')}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-xl">🔁</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-slate-900">Pengeluaran rutin ada di Langganan</span>
          <span className="block text-sm text-slate-500">Netflix, listrik, internet, cicilan{expenseCount ? ` · ${expenseCount} jadwal` : ''}</span>
        </span>
        <ChevronRight size={18} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
