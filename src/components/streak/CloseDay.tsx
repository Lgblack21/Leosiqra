"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Flame, Moon, Plus, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';
import { cn, formatIDR, isIncomingTransaction } from '@/lib/utils';
import { streakService, type StreakSummary } from '@/lib/services/streakService';
import { quickTxService } from '@/lib/services/quickTxService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { isCreditAccountType } from '@/lib/creditCard';
import type { Transaction } from '@/lib/services/transactionService';
import type { Account } from '@/lib/services/accountService';

// "Tutup hari": tiap malam user mengecek catatan hari ini, menambah jajan tunai
// yang kelupaan, lalu menutup harinya (streak + koin). Kalau migrasi dc_* belum
// ada di server, kartunya tidak tampil sama sekali.

const QUICK_CASH = [
  { label: 'Parkir', amount: 5000, category: 'Transportasi', sub: 'Parkir' },
  { label: 'Jajan', amount: 25000, category: 'Makanan', sub: 'Jajan' },
  { label: 'Bensin', amount: 50000, category: 'Transportasi', sub: 'Bensin' },
  { label: 'Makan', amount: 30000, category: 'Makanan', sub: 'Makan' },
];

const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const sameLocalDay = (d: Date, ref: Date) =>
  d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
const dayLabel = (d: Date) => new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

export function useStreak() {
  const [data, setData] = useState<StreakSummary | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(() => {
    streakService
      .get()
      .then((d) => {
        setData(d);
        setUnavailable(false);
      })
      .catch(() => setUnavailable(true));
  }, []);
  useEffect(() => {
    load();
    return subscribeToCollectionChanges('streak', load);
  }, [load]);
  return { data, unavailable, setData };
}

export function CloseDayCard({ transactions, accounts, className }: { transactions: Transaction[]; accounts: Account[]; className?: string }) {
  const { data, unavailable, setData } = useStreak();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const today = transactions.filter((t) => t.type !== 'debt' && sameLocalDay(new Date(t.date), now));
  const out = today.filter((t) => !isIncomingTransaction(t));
  const outTotal = out.reduce((s, t) => s + toIdr(t), 0);

  if (unavailable) return null;
  const closed = Boolean(data?.todayKind);

  return (
    <div className={cn('flex flex-col rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400">Hari ini · {dayLabel(now)}</p>
        {data && (
          <Link href="/membership/streak" className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600 hover:bg-orange-100">
            <Flame size={13} /> {data.streak} hari
          </Link>
        )}
      </div>

      {closed ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={16} /></span>
            Hari ini sudah ditutup
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {out.length > 0 ? `${out.length} pembayaran · ${formatIDR(outTotal)}.` : 'Tanpa pengeluaran hari ini.'} Sampai besok! 🌙
          </p>
          <Link href="/membership/streak" className="mt-auto flex items-center gap-1 pt-4 text-sm font-bold text-indigo-600">
            Lihat kalender streak <ChevronRight size={15} />
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-lg font-extrabold text-slate-900">
            {out.length > 0 ? `${out.length} pembayaran · ${formatIDR(outTotal)}` : 'Belum ada pembayaran hari ini'}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {out.length > 0 ? 'Sudah lengkap? Cek dan tutup harimu.' : 'Nggak belanja, atau bayar tunai? Tutup hari ini sekali ketuk.'}
          </p>
          {out.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {out.slice(0, 3).map((t, i) => (
                <li key={t.id || i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-600">{t.note || t.category}</span>
                  <span className="shrink-0 font-bold text-rose-500 tabular-nums">−{formatIDR(toIdr(t))}</span>
                </li>
              ))}
              {out.length > 3 && <li className="text-xs text-slate-400">+{out.length - 3} lagi</li>}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <Moon size={15} /> {out.length > 0 ? 'Cek & tutup hari ini' : 'Nggak belanja hari ini'}
          </button>
        </>
      )}

      <CloseDayDialog open={open} onClose={() => setOpen(false)} today={today} accounts={accounts} onClosed={setData} />
    </div>
  );
}

export function CloseDayDialog({
  open,
  onClose,
  today,
  accounts,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  today: Transaction[];
  accounts: Account[];
  onClosed?: (s: StreakSummary) => void;
}) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [done, setDone] = useState<StreakSummary | null>(null);

  // Jajan tunai masuk ke rekening tunai; kalau tidak ada, rekening pertama non-kartu kredit.
  const cashAccount =
    accounts.find((a) => a.type === 'Cash') ?? accounts.find((a) => !isCreditAccountType(a.type)) ?? null;

  const addCash = async (q: (typeof QUICK_CASH)[number]) => {
    if (!cashAccount || busy) return;
    setBusy(q.label);
    try {
      const res = await quickTxService.create({ type: 'pengeluaran', amount: q.amount, accountId: cashAccount.id!, category: q.category, subCategory: q.sub, note: q.label });
      setAdded((cur) => [...cur, { id: res.id, label: q.label, amount: q.amount }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mencatat. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const undo = async (id: string) => {
    setBusy(id);
    try {
      await quickTxService.undo(id);
      setAdded((cur) => cur.filter((a) => a.id !== id));
    } catch {
      toast.error('Gagal membatalkan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const closeDay = async () => {
    setBusy('close');
    try {
      const s = await streakService.close();
      setDone(s);
      onClosed?.(s);
      setTimeout(() => {
        onClose();
        setDone(null);
        setAdded([]);
      }, 2200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menutup hari. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const out = today.filter((t) => !isIncomingTransaction(t));
  const now = new Date();

  return (
    <Modal isOpen={open} onClose={onClose} title={`Tutup ${dayLabel(now)}`} maxWidth="max-w-lg">
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <LeoMascot mood="happy" size={120} />
          <p className="mt-2 text-xl font-extrabold text-slate-900">Hari ini ditutup! 🎉</p>
          <p className="mt-1 text-sm text-slate-500">
            Streak <b className="text-orange-600">{done.streak} hari</b> · +3 koin · minggu ini {done.week.closed}/{done.week.target}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm text-slate-500">Ini yang tercatat hari ini. Ada yang kelupaan?</p>
            {out.length === 0 && added.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-500">Belum ada transaksi hari ini</div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {out.map((t, i) => (
                  <li key={t.id || i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {t.note || t.category} <span className="text-slate-400">· {t.category}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-bold text-rose-500 tabular-nums">−{formatIDR(toIdr(t))}</span>
                      {t.id && added.some((a) => a.id === t.id) && (
                        <button type="button" onClick={() => undo(t.id!)} disabled={busy !== null} aria-label={`Batalkan ${t.note || t.category}`} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Undo2 size={14} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {added
                  .filter((a) => !out.some((t) => t.id === a.id))
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="text-slate-700">{a.label} <span className="text-slate-400">· tunai</span></span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-rose-500 tabular-nums">−{formatIDR(a.amount)}</span>
                        <button type="button" onClick={() => undo(a.id)} disabled={busy !== null} aria-label={`Batalkan ${a.label}`} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Undo2 size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {cashAccount && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Bayar tunai? <span className="font-normal text-slate-400">— dicatat ke {cashAccount.name}</span></p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CASH.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => addCash(q)}
                    disabled={busy !== null}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50',
                      busy === q.label && 'animate-pulse'
                    )}
                  >
                    <Plus size={14} /> {q.label} {formatIDR(q.amount)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={closeDay}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            <Moon size={15} /> {out.length + added.length > 0 ? 'Tutup hari ini' : 'Nggak belanja hari ini'}
          </button>
        </div>
      )}
    </Modal>
  );
}
