"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Pencil } from 'lucide-react';
import { cn, formatMoney, isIncomingTransaction } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import type { CardCycle } from '@/lib/creditCycle';
import { AccountLogo } from '@/components/ui/AccountLogo';

// Detail satu kartu kredit di panel "Kartu kredit": tagihan & jatuh tempo,
// Sudah bayar / Ubah kartu, belum ditagih vs total terpakai, limit, dan
// histori "Belanja siklus ini" (transaksi kartu sejak tanggal cetak terakhir;
// tanpa siklus = 30 hari terakhir).

const fmt = (d: string | Date, opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', opt).format(typeof d === 'string' ? new Date(`${d}T00:00:00`) : d);

export function CardDetail({ card, used, cycle, transactions, onPay, onEdit }: {
  card: Account;
  used: number;
  cycle: CardCycle | null;
  transactions: Transaction[];
  onPay: () => void;
  onEdit: () => void;
}) {
  const cur = card.currency || 'IDR';
  const money = (n: number) => formatMoney(n, cur);
  const limit = card.creditLimit || 0;
  const billed = cycle ? Math.max(0, cycle.amountDue) : 0;
  const unbilled = Math.max(0, used - billed);
  const [openedAt] = useState(() => Date.now());
  const since = cycle ? new Date(`${cycle.statementDate}T23:59:59`) : new Date(openedAt - 30 * 864e5);
  const history = transactions
    .filter((t) => t.accountId === card.id && t.type !== 'debt' && new Date(t.date) > since)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const spent = history.filter((t) => !isIncomingTransaction(t)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <div>
      {/* Kartu */}
      <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative mx-auto aspect-[1.6] w-full max-w-[340px] overflow-hidden rounded-2xl p-4 text-white shadow-xl" style={{ background: card.cardColor || 'linear-gradient(135deg,#1e3a8a,#2563eb)' }}>
        <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-2">
            <AccountLogo acc={card} size={26} />
            <span className="flex-1 truncate text-sm font-bold">{card.name}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cycle && cycle.amountDue > 0 ? (cycle.overdue ? 'bg-rose-500' : 'bg-white text-slate-900') : 'bg-white/20')}>
              {cycle && cycle.amountDue > 0 ? (cycle.overdue ? 'Lewat jatuh tempo' : `${fmt(cycle.dueDate, { day: 'numeric', month: 'short' })} · ${cycle.daysUntilDue} hari lagi`) : 'Lunas'}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
            {card.last4 && <span className="font-mono text-sm tracking-[0.2em]">•••• {card.last4}</span>}
          </div>
          <div className="mt-auto flex items-end justify-between">
            <span>
              <span className="block text-[10px] text-white/70">Total terpakai</span>
              <span className="text-lg font-extrabold tabular-nums">{money(used)}</span>
            </span>
            {card.network && <span className="text-sm font-extrabold italic">{card.network.toUpperCase()}</span>}
          </div>
        </div>
      </motion.div>

      {/* Tagihan & aksi */}
      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        {cycle ? (
          <>
            <p className="text-sm text-slate-500">Tagihan {fmt(cycle.statementDate, { month: 'long' })}</p>
            <p className="mt-0.5 flex items-start gap-1 leading-none text-slate-900">
              <span className="mt-1 text-sm font-bold text-slate-400">Rp</span>
              <span className="text-[30px] font-extrabold tracking-tight tabular-nums">{Math.round(billed).toLocaleString('id-ID')}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              Jatuh tempo {fmt(cycle.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}
              {billed > 0 && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', cycle.overdue ? 'bg-rose-50 text-rose-600' : cycle.daysUntilDue <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-200 text-slate-600')}>
                  {cycle.overdue ? `telat ${Math.abs(cycle.daysUntilDue)} hari` : cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hari lagi`}
                </span>
              )}
              {billed <= 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">lunas</span>}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Atur tanggal cetak & jatuh tempo lewat <b>Ubah kartu</b> supaya tagihan dihitung otomatis.</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onPay} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"><Check size={15} /> Sudah bayar</button>
          <button type="button" onClick={onEdit} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-200/70 py-3 text-sm font-bold text-slate-800 hover:bg-slate-200"><Pencil size={14} /> Ubah kartu</button>
        </div>
      </div>

      {/* Belum ditagih / total / limit */}
      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Belum ditagih</p>
            <p className="font-extrabold text-slate-900 tabular-nums">{money(cycle ? unbilled : used)}</p>
            {cycle && <p className="text-xs text-slate-500">Dicetak {fmt(cycle.nextStatementDate, { day: 'numeric', month: 'short' })}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-500">Total terpakai</p>
            <p className="font-extrabold text-slate-900 tabular-nums">{money(used)}</p>
          </div>
        </div>
        {limit > 0 && (
          <div className="mt-4 border-t border-slate-200/70 pt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
              <motion.div className={cn('h-full rounded-full', used / limit > 0.9 ? 'bg-rose-500' : used / limit > 0.7 ? 'bg-amber-500' : 'bg-indigo-500')} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (used / limit) * 100)}%` }} transition={{ duration: 0.7 }} />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-slate-500">Terpakai {money(used)} dari {money(limit)}</span>
              <span className="font-bold text-slate-800">Sisa {money(Math.max(0, limit - used))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Histori */}
      <div className="mb-1 mt-5 flex items-center justify-between px-1">
        <p className="text-sm font-bold text-slate-900">
          {cycle ? 'Belanja siklus ini' : 'Belanja 30 hari terakhir'}
          {spent > 0 && <span className="ml-1.5 font-normal text-slate-400">· {money(spent)}</span>}
        </p>
        <Link href={`/membership/transactions/daily?account=${encodeURIComponent(card.id ?? '')}&period=semua`} className="text-[13px] font-bold text-slate-600 hover:text-slate-900">Semua transaksi</Link>
      </div>
      {history.length === 0 ? (
        <p className="rounded-3xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Belum ada transaksi di siklus ini.</p>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-slate-50">
          {history.map((t, i) => {
            const inc = isIncomingTransaction(t);
            const d = new Date(t.date);
            return (
              <motion.li key={t.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg">{inc ? '💳' : categoryEmoji(t.category)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{inc ? 'Pembayaran tagihan' : t.note || t.category}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {fmt(d, { day: 'numeric', month: 'short' })}, {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {inc ? 'Transfer' : t.category} · {card.name}{card.last4 ? ` ••${card.last4}` : ''}
                  </span>
                </span>
                <span className={cn('shrink-0 text-sm font-bold tabular-nums', inc ? 'text-emerald-600' : 'text-slate-900')}>{inc ? '+' : '−'}{money(Number(t.amount) || 0)}</span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
