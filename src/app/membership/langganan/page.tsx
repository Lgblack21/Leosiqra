"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Pause, Plus } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { useModal } from '@/context/ModalContext';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { recurringService, recurringPerMonth, type RecurringTransaction } from '@/lib/services/recurringService';
import { ServiceLogo } from '@/components/subscriptions/ServiceLogo';
import { SubscriptionScan } from '@/components/subscriptions/SubscriptionScan';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Skeleton } from '@/components/ui/Skeleton';

// Langganan = transaksi rutin bertipe Pengeluaran (Netflix, listrik, cicilan…).
// Halaman ini merangkum totalnya per bulan + kalender tagihan, dan "Cek
// langganan" mencari pembayaran berulang di transaksi 4 bulan terakhir yang
// belum dijadikan transaksi rutin. Menambah tetap lewat form Transaksi Rutin.

const perMonth = recurringPerMonth;
const norm = (s: string) => s.toLowerCase().replace(/\d+/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Tanggal-tanggal jatuh tempo sebuah langganan di bulan (y, m).
const dueDaysIn = (r: RecurringTransaction, y: number, m: number) => {
  const next = new Date(r.nextDate);
  const days = new Date(y, m + 1, 0).getDate();
  if (r.interval === 'Bulanan') return [Math.min(next.getDate(), days)];
  if (r.interval === 'Tahunan') return next.getMonth() === m ? [next.getDate()] : [];
  if (r.interval === '3 Bulanan') {
    const dm = y * 12 + m - (next.getFullYear() * 12 + next.getMonth());
    return dm >= 0 && dm % 3 === 0 ? [Math.min(next.getDate(), days)] : [];
  }
  if (r.interval === 'Mingguan') {
    const out: number[] = [];
    const start = new Date(y, m, 1).getTime();
    const step = 7 * 864e5;
    let t = next.getTime() - Math.ceil((next.getTime() - start) / step) * step;
    for (; t < start + days * 864e5; t += step) if (t >= start) out.push(new Date(t).getDate());
    return out;
  }
  return [];
};

export default function LanggananPage() {
  const { openModal } = useModal();
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let uid = '';
    const load = () =>
      (uid ? Promise.resolve(uid) : cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me').then((r) => (uid = r.user?.id ?? '')))
        .then((id) => (id ? recurringService.getUserRecurring(id) : []))
        .then(setItems)
        .catch(() => setItems([]));
    load();
    transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
    return subscribeToCollectionChanges('recurring', load);
  }, []);

  const subs = (items ?? []).filter((r) => r.type === 'Pengeluaran');
  const active = subs.filter((r) => r.status === 'ACTIVE');
  const monthly = active.reduce((s, r) => s + perMonth(r), 0);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const dueMap = new Map<number, RecurringTransaction[]>();
  for (const r of active) for (const d of dueDaysIn(r, y, m)) dueMap.set(d, [...(dueMap.get(d) ?? []), r]);
  const upcoming = [...active].sort((a, b) => +new Date(a.nextDate) - +new Date(b.nextDate));
  const daysUntil = (d: Date) => Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);

  // Deteksi pembayaran berulang: label sama (tanpa angka) di >= 2 bulan berbeda,
  // nominal mirip (±15% dari median), belum ada transaksi rutin bernama serupa.
  const suggestions = useMemo(() => {
    const since = Date.now() - 120 * 864e5;
    const known = subs.map((r) => norm(r.name)).filter(Boolean);
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (t.type !== 'pengeluaran' || isInvestmentCategory(t.category) || +new Date(t.date) < since) continue;
      const key = norm(t.note || '');
      if (key.length < 3) continue;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const out: { key: string; label: string; category: string; accountId: string; amount: number; months: number; day: number }[] = [];
    for (const [key, list] of groups) {
      const months = new Set(list.map((t) => `${new Date(t.date).getFullYear()}-${new Date(t.date).getMonth()}`));
      if (months.size < 2) continue;
      if (known.some((k) => k.includes(key) || key.includes(k))) continue;
      const amounts = list.map((t) => Number(t.amountIDR) || Number(t.amount) || 0).sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)];
      if (!median || amounts.some((a) => Math.abs(a - median) / median > 0.15)) continue;
      const last = [...list].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
      out.push({ key, label: last.note || key, category: last.category, accountId: last.accountId || '', amount: median, months: months.size, day: new Date(last.date).getDate() });
    }
    return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
    // subs diturunkan dari items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, items]);

  const addFromSuggestion = (s: (typeof suggestions)[number]) => {
    const next = new Date(y, m, s.day);
    if (next < now) next.setMonth(next.getMonth() + 1);
    openModal('langganan', {
      prefill: { name: s.label, type: 'Pengeluaran', category: s.category, accountId: s.accountId, amount: s.amount, interval: 'Bulanan', nextDate: next, status: 'ACTIVE' },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Langganan</h1>
          <p className="text-sm text-slate-500">Netflix, Spotify, listrik, internet, cicilan — semua tagihan rutinmu dalam satu tempat.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/membership/recurring" className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200">Pemasukan rutin</Link>
          <button type="button" onClick={() => openModal('langganan')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
            <Plus size={15} /> Tambah langganan
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-500">Total per bulan</p>
          {items === null ? <Skeleton className="mt-2 h-10 w-44" /> : <p className="text-[32px] font-extrabold tracking-tight text-slate-900 tabular-nums">{formatIDR(monthly)}</p>}
          <p className="text-sm text-slate-500">{active.length} langganan aktif · {formatIDR(monthly * 12)} per tahun</p>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => <span key={w} className="text-[11px] font-semibold text-slate-400">{w}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const due = dueMap.get(i + 1);
              return (
                <span
                  key={i}
                  title={due?.map((r) => `${r.name} ${formatIDR(r.amount)}`).join('\n')}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-full text-xs font-bold',
                    due ? 'bg-indigo-600 text-white' : 'text-slate-500',
                    i + 1 === now.getDate() && !due && 'ring-2 ring-slate-800'
                  )}
                >
                  {i + 1}
                  {due && due.length > 1 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] text-slate-900">{due.length}</span>}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">Bulatan ungu = ada tagihan di tanggal itu.</p>
        </div>

        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-3">
          <p className="mb-3 flex items-center gap-2 font-bold text-slate-900"><CalendarClock size={17} className="text-indigo-600" /> Berikutnya</p>
          {items === null ? (
            <Skeleton className="h-40" />
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <LeoMascot mood="idle" size={90} />
              <p className="mt-2 font-bold text-slate-900">Belum ada langganan</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Tambahkan Netflix, Spotify, pulsa, internet, atau listrik, dan lihat berapa semuanya tiap bulan.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...upcoming, ...subs.filter((r) => r.status !== 'ACTIVE')].map((r) => {
                const dd = daysUntil(r.nextDate);
                const paused = r.status !== 'ACTIVE';
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => openModal('langganan', { initial: r })} className={cn('-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-slate-50', paused && 'opacity-50')}>
                    {r.service ? <ServiceLogo service={r.service} name={r.name} size={40} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-lg">{categoryEmoji(r.category || r.name)}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{r.name}</span>
                      <span className="text-xs text-slate-400">
                        {r.interval === '3 Bulanan' ? 'Tiap 3 bulan' : r.interval}{r.autoRecord === false ? ' · pengingat' : ''} · {paused ? <span className="inline-flex items-center gap-0.5"><Pause size={10} /> dijeda</span> : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(r.nextDate))}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-extrabold text-slate-900 tabular-nums">{formatIDR(r.amount)}</span>
                      {!paused && (
                        <span className={cn('text-xs font-semibold', dd <= 3 ? 'text-amber-600' : 'text-slate-400')}>
                          {dd < 0 ? 'lewat' : dd === 0 ? 'hari ini' : dd === 1 ? 'besok' : `${dd} hari lagi`}
                        </span>
                      )}
                    </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Cek langganan — Leo memeriksa kalender 30 hari */}
      <SubscriptionScan
        transactions={transactions}
        subs={subs}
        patterns={suggestions}
        onAdd={(prefill) => openModal('langganan', { prefill })}
        onAddPattern={addFromSuggestion}
      />
    </div>
  );
}
