"use client";

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { computeCreditUsage, getCardCycle, isCreditAccountType } from '@/lib/creditCard';
import { categoryVisual } from '@/lib/categoryEmoji';
import { cn, formatMoney, isIncomingTransaction } from '@/lib/utils';

// Detail satu rekening (pindahan dari halaman Kartu Saya yang dihapus):
// saldo atau limit kartu, siklus tagihan kartu kredit, arus masuk/keluar bulan
// ini, dan transaksi terakhir. Nominal dalam mata uang rekening itu sendiri.
// Catatan Hutang/Piutang (type "debt") bukan arus kas, jadi tidak ikut.

const isIn = (t: Transaction) => isIncomingTransaction(t) || (t.type === 'topup' && Boolean(t.subCategory?.includes('Masuk')));
const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
};

export function AccountDetail({
  account,
  transactions,
  hidden,
  deleting,
  onClose,
  onEdit,
  onDelete,
}: {
  account: Account | null;
  transactions: Transaction[];
  hidden: boolean;
  deleting: boolean;
  onClose: () => void;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) {
  const acc = account;
  const cur = acc?.currency || 'IDR';
  const money = (n: number) => (hidden ? '••••••' : formatMoney(n, cur));

  const own = acc ? transactions.filter((t) => t.accountId === acc.id && t.type !== 'debt') : [];
  const now = new Date();
  const thisMonth = own.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthIn = thisMonth.filter(isIn).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const monthOut = thisMonth.filter((t) => !isIn(t)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const recent = [...own]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const credit = acc && isCreditAccountType(acc.type);
  const usage = acc && credit ? computeCreditUsage(acc, transactions) : null;
  const cycle = acc && credit ? getCardCycle(acc, transactions) : null;
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(now);

  return (
    <Modal isOpen={Boolean(acc)} onClose={onClose} title={acc?.name ?? 'Rekening'} maxWidth="max-w-lg">
      {acc && (
        <div className="space-y-5">
          {/* Saldo / limit */}
          {usage ? (
            <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-slate-50 p-4 text-center">
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Terpakai</p>
                <p className="mt-0.5 truncate text-[15px] font-extrabold text-rose-600 tabular-nums">{money(usage.used)}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Sisa limit</p>
                <p className="mt-0.5 truncate text-[15px] font-extrabold text-emerald-600 tabular-nums">{usage.limit > 0 ? money(usage.remaining) : '—'}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Limit</p>
                <p className="mt-0.5 truncate text-[15px] font-extrabold text-slate-900 tabular-nums">{usage.limit > 0 ? money(usage.limit) : '—'}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] bg-slate-50 p-4">
              <p className="text-[13px] font-semibold text-slate-500">Saldo saat ini</p>
              <p className={cn('mt-0.5 text-[30px] font-extrabold tracking-tight tabular-nums', (acc.balance || 0) < 0 ? 'text-rose-600' : 'text-slate-900')}>{money(acc.balance || 0)}</p>
            </div>
          )}

          {/* Siklus tagihan kartu */}
          {credit && (
            cycle ? (
              <div className={cn('rounded-[20px] p-4 ring-1', cycle.overdue ? 'bg-rose-50 ring-rose-100' : 'bg-white ring-slate-200')}>
                <p className="flex items-center gap-2 text-[13px] font-bold text-slate-700"><CalendarClock size={15} /> Tagihan</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-slate-500">Tagihan tercetak</p>
                    <p className="font-bold text-slate-900 tabular-nums">{cycle.amountDue > 0 ? money(cycle.amountDue) : 'Lunas'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Minimum bayar</p>
                    <p className="font-bold text-slate-900 tabular-nums">{cycle.amountDue > 0 ? money(cycle.minPayment) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Jatuh tempo</p>
                    <p className={cn('font-bold', cycle.overdue ? 'text-rose-600' : 'text-slate-900')}>
                      {fmtDate(cycle.dueDate)}
                      {cycle.amountDue > 0 && <span className="font-medium"> · {cycle.overdue ? `lewat ${Math.abs(cycle.daysUntilDue)} hari` : cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hari lagi`}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cetak berikutnya</p>
                    <p className="font-bold text-slate-900">{fmtDate(cycle.nextStatementDate)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => onEdit(acc)} className="w-full rounded-[20px] bg-amber-50 p-4 text-left text-[13px] text-amber-900 ring-1 ring-amber-100">
                Atur tanggal cetak & jatuh tempo kartu ini supaya Leosiqra bisa menghitung tagihan dan mengingatkanmu. <span className="font-bold">Atur sekarang →</span>
              </button>
            )
          )}

          {/* Arus bulan ini */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-emerald-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700"><ArrowDownLeft size={14} /> Masuk {monthName}</p>
              <p className="mt-0.5 truncate text-[16px] font-extrabold text-emerald-700 tabular-nums">{money(monthIn)}</p>
            </div>
            <div className="rounded-[18px] bg-rose-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-700"><ArrowUpRight size={14} /> Keluar {monthName}</p>
              <p className="mt-0.5 truncate text-[16px] font-extrabold text-rose-700 tabular-nums">{money(monthOut)}</p>
            </div>
          </div>

          {/* Transaksi terakhir */}
          <div>
            <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">Transaksi terakhir</p>
            {recent.length === 0 ? (
              <p className="rounded-[18px] bg-slate-50 py-6 text-center text-[14px] text-slate-500">Belum ada transaksi di rekening ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((t) => {
                  const v = categoryVisual(t.category, t.type);
                  const incoming = isIn(t);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-slate-900">{t.note || t.subCategory || t.category}</span>
                        <span className="block truncate text-[12px] text-slate-500">
                          {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date))} · {t.category}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-[14px] font-bold tabular-nums', incoming ? 'text-emerald-600' : 'text-slate-900')}>
                        {incoming ? '+' : '−'}{money(Number(t.amount) || 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href={`/membership/transactions/daily?rekening=${encodeURIComponent(acc.id ?? '')}&periode=semua`}
              className="mt-2 flex items-center justify-center gap-1 rounded-full bg-slate-100 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-200"
            >
              Semua transaksi {acc.name} <ChevronRight size={16} />
            </Link>
          </div>

          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => onEdit(acc)} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-[14px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              <Edit2 size={15} /> Ubah
            </button>
            <button type="button" onClick={() => onDelete(acc)} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-50 py-2.5 text-[14px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50">
              <Trash2 size={15} /> Hapus
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
