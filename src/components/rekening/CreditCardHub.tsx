"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, CreditCard, Loader2, Pencil, Plus, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LogoImage } from '@/components/ui/LogoImage';
import { useFeedback } from '@/components/ui/Feedback';
import { accountService, type Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { cardFlowsFromTransactions, computeCreditUsage, getCardCycle, isCreditAccountType } from '@/lib/creditCard';
import { clampCycleDay, daysBetween, dueDateFor, lastStatementDate } from '@/lib/creditCycle';
import { getCardGradientClass } from '@/lib/cardColors';
import { categoryVisual } from '@/lib/categoryEmoji';
import { cn, formatMoney, toLocalDateString } from '@/lib/utils';

// Pusat kartu kredit (dibuka dari Rekening): pilih kartu di carousel, lihat
// tagihan tercetak + jatuh tempo, catat "Sudah bayar" (transfer atomik dari
// rekening kas lewat accountService.payCreditCard), belanja siklus berjalan,
// jadwal cetak/jatuh tempo 30 hari ke depan, dan kartu paling longgar dipakai
// hari ini. Semua angka siklus dari lib/creditCard.ts + lib/creditCycle.ts
// (sumber yang sama dengan Ringkasan & cron pengingat).

const pad = (n: number) => String(n).padStart(2, '0');
const ymdAdd = (ymd: string, months: number, day?: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, day ?? d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (ymd: string, opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', opt).format(toDate(ymd));
const short = (n: number) =>
  Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
  : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatMoney(n, 'IDR');
const localYmd = (d: Date | string) => (d instanceof Date ? toLocalDateString(d) : toLocalDateString(new Date(d)));
const newRef = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function NetworkMark({ network }: { network?: string }) {
  if (network === 'visa') return <span className="text-[20px] font-black italic tracking-tight">VISA</span>;
  if (network === 'mastercard')
    return (
      <span className="flex" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#eb001b]" />
        <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#f79e1b]/90" />
      </span>
    );
  if (network === 'jcb') return <span className="text-[16px] font-black tracking-wide">JCB</span>;
  if (network === 'amex') return <span className="rounded bg-white/20 px-1.5 text-[13px] font-black tracking-wider">AMEX</span>;
  if (network === 'gpn') return <span className="text-[14px] font-black tracking-wider">GPN</span>;
  return null;
}

type Info = { acc: Account; usage: ReturnType<typeof computeCreditUsage>; cycle: ReturnType<typeof getCardCycle> };

export function CreditCardHub({
  open,
  accounts,
  transactions,
  hidden,
  totalIdr,
  initialId,
  onClose,
  onEdit,
  onAdd,
}: {
  open: boolean;
  accounts: Account[];
  transactions: Transaction[];
  hidden: boolean;
  /** Total terpakai semua kartu dalam IDR (sudah dikonversi kurs oleh halaman). */
  totalIdr: number;
  initialId: string | null;
  onClose: () => void;
  onEdit: (a: Account) => void;
  onAdd: () => void;
}) {
  const { toast } = useFeedback();
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(toLocalDateString()), [open]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [paying, setPaying] = useState<{ ref: string } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payFrom, setPayFrom] = useState('');
  const [payDate, setPayDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [paidPop, setPaidPop] = useState(false);

  const day = today ?? '2000-01-01';
  const money = (n: number, cur?: string) => (hidden ? '••••••' : formatMoney(n, cur || 'IDR'));
  const cards: Info[] = useMemo(
    () =>
      accounts
        .filter((a) => isCreditAccountType(a.type))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((acc) => ({ acc, usage: computeCreditUsage(acc), cycle: getCardCycle(acc, transactions, day) })),
    [accounts, transactions, day]
  );
  const cash = accounts.filter((a) => !isCreditAccountType(a.type));
  const sel = cards.find((c) => c.acc.id === selectedId) ?? cards[0];
  const nearest = [...cards].filter((c) => c.cycle && c.cycle.amountDue > 0).sort((a, b) => a.cycle!.daysUntilDue - b.cycle!.daysUntilDue)[0];

  // Kartu paling longgar: belanja hari ini masuk tagihan yang dicetak
  // berikutnya (atau hari ini kalau hari ini tanggal cetak), lalu dibayar di
  // jatuh tempo tagihan itu — makin jauh, makin longgar.
  const roomiest = useMemo(() => {
    if (!today) return null;
    let best: { acc: Account; due: string; days: number } | null = null;
    for (const { acc } of cards) {
      const sd = clampCycleDay(acc.statementDay);
      const dd = clampCycleDay(acc.dueDay);
      if (!sd || !dd) continue;
      const last = lastStatementDate(today, sd);
      const bill = last === today ? today : ymdAdd(last, 1, sd);
      const due = dueDateFor(bill, dd);
      const days = daysBetween(today, due);
      if (!best || days > best.days) best = { acc, due, days };
    }
    return best;
  }, [cards, today]);

  // Jadwal 30 hari ke depan: tanggal cetak & jatuh tempo semua kartu.
  const upcoming = useMemo(() => {
    if (!today) return [];
    const end = ymdAdd(today, 0, Number(today.slice(8)) + 30);
    const list: { date: string; kind: 'cetak' | 'tempo' | 'lewat'; info: Info; amount?: number }[] = [];
    for (const info of cards) {
      const { acc, cycle } = info;
      const sd = clampCycleDay(acc.statementDay);
      const dd = clampCycleDay(acc.dueDay);
      if (!sd || !dd) continue;
      if (cycle?.overdue) list.push({ date: cycle.dueDate, kind: 'lewat', info, amount: cycle.amountDue });
      for (let k = -1; k <= 2; k++) {
        const stmt = ymdAdd(today, k, sd);
        if (stmt >= today && stmt <= end) list.push({ date: stmt, kind: 'cetak', info });
        const due = dueDateFor(stmt, dd);
        if (due >= today && due <= end) {
          const isCurrent = cycle && due === cycle.dueDate;
          list.push({ date: due, kind: 'tempo', info, amount: isCurrent ? cycle.amountDue : undefined });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'tempo' ? -1 : 1));
  }, [cards, today]);

  const cycleSpend = useMemo(() => {
    if (!sel?.acc.id || !today) return [];
    const from = sel.cycle?.statementDate ?? ymdAdd(today, 0, Number(today.slice(8)) - 30);
    return transactions
      .filter((t) => t.accountId === sel.acc.id && t.type === 'pengeluaran' && localYmd(t.date) > from)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sel, transactions, today]);
  const unbilled = useMemo(() => {
    if (!sel?.acc.id || !sel.cycle) return null;
    const stmt = sel.cycle.statementDate;
    return cardFlowsFromTransactions(sel.acc.id, transactions)
      .filter((f) => f.date > stmt && f.delta > 0)
      .reduce((s, f) => s + f.delta, 0);
  }, [sel, transactions]);

  const startPay = () => {
    if (!sel) return;
    const suggested = sel.cycle && sel.cycle.amountDue > 0 ? sel.cycle.amountDue : sel.usage.used;
    const sameCur = cash.filter((a) => (a.currency || 'IDR') === (sel.acc.currency || 'IDR'));
    setPayAmount(suggested > 0 ? String(Math.round(suggested)) : '');
    setPayFrom(sameCur[0]?.id ?? '');
    setPayDate(toLocalDateString());
    setPaying({ ref: newRef() });
  };
  const submitPay = async () => {
    if (!sel?.acc.id || !paying) return;
    const amount = Number(payAmount.replace(/[^\d]/g, ''));
    if (!amount || !payFrom || !payDate) return;
    setSaving(true);
    try {
      await accountService.payCreditCard(sel.acc.id, { fromAccountId: payFrom, amount, date: payDate, ref: paying.ref });
      setPaying(null);
      setPaidPop(true);
      setTimeout(() => setPaidPop(false), 1600);
      toast.success(`Pembayaran ${sel.acc.name} ${formatMoney(amount, sel.acc.currency || 'IDR')} dicatat.`);
    } catch (e) {
      console.error(e);
      // ref tetap sama → coba lagi tidak membayar dua kali.
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal mencatat pembayaran. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };
  const select = (id: string | undefined) => {
    if (!id || saving) return;
    setSelectedId(id);
    setPaying(null);
  };

  const card = (info: Info) => {
    const { acc, usage, cycle } = info;
    const active = info === sel;
    const chip = cycle && cycle.amountDue > 0
      ? cycle.overdue ? `Lewat ${Math.abs(cycle.daysUntilDue)} hari` : `${fmt(cycle.dueDate, { day: 'numeric', month: 'short' })} · ${cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hr lagi`}`
      : usage.used > 0 ? 'Belum ditagih' : 'Lunas';
    const urgent = cycle && cycle.amountDue > 0 && (cycle.overdue || cycle.daysUntilDue <= 5);
    return (
      <button
        key={acc.id}
        type="button"
        onClick={() => select(acc.id)}
        aria-pressed={active}
        aria-label={`Kartu ${acc.name}`}
        className={cn(
          'relative flex aspect-[1.586/1] w-[80%] shrink-0 snap-center flex-col justify-between overflow-hidden rounded-[20px] p-4 text-left text-white transition-all duration-300 sm:w-[320px]',
          getCardGradientClass(acc.cardColor, acc.type),
          active ? 'scale-100 shadow-[0_22px_40px_-18px_rgba(15,23,42,0.7)]' : 'scale-[0.92] opacity-55 hover:opacity-80'
        )}
      >
        <span aria-hidden className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/15" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20" />
        <div className="relative flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95">
            <LogoImage src={acc.logoUrl} alt={acc.name} fallbackText={acc.name.substring(0, 3).toUpperCase()} fallbackIcon={<CreditCard size={15} className="text-slate-700" />} className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{acc.name}</span>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', urgent ? 'bg-white text-rose-600' : 'bg-white/20')}>{chip}</span>
        </div>
        <div className="relative flex items-center gap-3">
          <svg width="36" height="27" viewBox="0 0 42 32" aria-hidden>
            <rect x="0.5" y="0.5" width="41" height="31" rx="6" fill="#f5d27a" stroke="#d4a943" />
            <path d="M14 1v30M28 1v30M1 11h13M28 11h13M1 21h13M28 21h13M14 16h14" stroke="#c99a35" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="font-mono text-[15px] tracking-[0.22em] text-white/90">•••• {acc.cardLast4 || '····'}</span>
        </div>
        <div className="relative flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{cycle && cycle.amountDue > 0 ? `Tagihan ${fmt(cycle.statementDate, { month: 'short' })}` : 'Terpakai'}</p>
            <p className="truncate text-[19px] font-extrabold leading-tight tabular-nums">{money(cycle && cycle.amountDue > 0 ? cycle.amountDue : usage.used, acc.currency)}</p>
          </div>
          <NetworkMark network={acc.cardNetwork} />
        </div>
      </button>
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Kartu kredit" maxWidth="max-w-2xl">
      {cards.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[15px] font-semibold text-slate-900">Belum ada kartu kredit</p>
          <p className="mt-1 text-[13px] text-slate-500">Tambahkan kartu supaya tagihan & jatuh temponya terpantau.</p>
          <button type="button" onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-bold text-white"><Plus size={15} /> Tambah kartu</button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Ringkasan */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Total tagihan kartu</p>
              <p className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 tabular-nums">{hidden ? 'Rp ••••••' : formatMoney(totalIdr, 'IDR')}</p>
              {nearest && (
                <p className="truncate text-[13px] text-slate-500">
                  Terdekat: <span className="font-semibold text-slate-700">{nearest.acc.name}</span> · {fmt(nearest.cycle!.dueDate, { day: 'numeric', month: 'short' })}
                  {nearest.cycle!.overdue ? ' (lewat)' : ` (${nearest.cycle!.daysUntilDue === 0 ? 'hari ini' : `${nearest.cycle!.daysUntilDue} hari lagi`})`}
                </p>
              )}
            </div>
            <button type="button" onClick={onAdd} aria-label="Tambah kartu" className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-200">
              <Plus size={15} /> <span className="hidden sm:inline">Tambah kartu</span>
            </button>
          </div>

          {/* Carousel kartu */}
          <div>
            <div className="-mx-6 flex snap-x snap-mandatory items-center gap-1 overflow-x-auto px-[10%] py-1 no-scrollbar sm:px-6">
              {cards.map(card)}
            </div>
            {cards.length > 1 && (
              <div className="mt-2 flex justify-center gap-1.5">
                {cards.map((c) => (
                  <button key={c.acc.id} type="button" onClick={() => select(c.acc.id)} aria-label={`Pilih ${c.acc.name}`} className={cn('h-1.5 rounded-full transition-all', c === sel ? 'w-5 bg-slate-900' : 'w-1.5 bg-slate-300')} />
                ))}
              </div>
            )}
          </div>

          {/* Tiket kartu terpilih */}
          {sel && (
            <section className="relative overflow-hidden rounded-[22px] bg-slate-50 ring-1 ring-slate-100">
              <AnimatePresence mode="wait" initial={false}>
                {paying ? (
                  <motion.div key="pay" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPaying(null)} disabled={saving} aria-label="Kembali" className="rounded-full p-1.5 text-slate-500 hover:bg-white"><ArrowLeft size={17} /></button>
                      <p className="text-[15px] font-bold text-slate-900">Bayar tagihan {sel.acc.name}</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[12px] font-semibold text-slate-500">Nominal</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          sel.cycle && sel.cycle.amountDue > 0 ? { label: 'Tagihan', v: sel.cycle.amountDue } : null,
                          sel.cycle && sel.cycle.minPayment > 0 && sel.cycle.minPayment < sel.cycle.amountDue ? { label: 'Minimum', v: sel.cycle.minPayment } : null,
                          sel.usage.used > 0 && (!sel.cycle || Math.round(sel.usage.used) !== Math.round(sel.cycle.amountDue)) ? { label: 'Semua terpakai', v: sel.usage.used } : null,
                        ].filter((x): x is { label: string; v: number } => Boolean(x)).map((o) => (
                          <button key={o.label} type="button" onClick={() => setPayAmount(String(Math.round(o.v)))} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1', Number(payAmount) === Math.round(o.v) ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200')}>
                            {o.label} · {short(o.v)}
                          </button>
                        ))}
                      </div>
                      <label className="mt-2 flex items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400">
                        <span className="text-[14px] text-slate-400">Rp</span>
                        <input
                          inputMode="numeric"
                          value={payAmount ? Number(payAmount).toLocaleString('id-ID') : ''}
                          onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="0"
                          aria-label="Nominal pembayaran"
                          className="w-full bg-transparent py-2.5 text-[17px] font-bold text-slate-900 outline-none"
                        />
                      </label>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[12px] font-semibold text-slate-500">Dibayar dari</p>
                      {cash.filter((a) => (a.currency || 'IDR') === (sel.acc.currency || 'IDR')).length === 0 ? (
                        <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800">Belum ada rekening kas dengan mata uang {sel.acc.currency || 'IDR'}.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {cash.filter((a) => (a.currency || 'IDR') === (sel.acc.currency || 'IDR')).map((a) => (
                            <button key={a.id} type="button" onClick={() => setPayFrom(a.id ?? '')} className={cn('rounded-2xl px-3 py-2 text-left ring-1', payFrom === a.id ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'bg-white ring-slate-200')}>
                              <span className="block truncate text-[13px] font-semibold text-slate-900">{a.name}</span>
                              <span className={cn('block truncate text-[11px] tabular-nums', (a.balance || 0) < Number(payAmount || 0) ? 'text-rose-500' : 'text-slate-500')}>{money(a.balance || 0, a.currency)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2 ring-1 ring-slate-200">
                      <span className="text-[13px] font-semibold text-slate-500">Tanggal bayar</span>
                      <input type="date" value={payDate} max={today ?? undefined} onChange={(e) => setPayDate(e.target.value)} className="bg-transparent text-[14px] font-semibold text-slate-900 outline-none" />
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitPay()}
                      disabled={saving || !Number(payAmount) || !payFrom || !payDate}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      {Number(payAmount) ? `Bayar ${formatMoney(Number(payAmount), sel.acc.currency || 'IDR')}` : 'Isi nominal'}
                    </button>
                    <p className="text-center text-[11px] text-slate-400">Dicatat sebagai transfer: saldo rekening berkurang, tagihan kartu berkurang. Bukan pengeluaran baru.</p>
                  </motion.div>
                ) : (
                  <motion.div key={`info-${sel.acc.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }}>
                    <div className="p-4">
                      {sel.cycle ? (
                        <>
                          <p className="text-[12px] font-semibold text-slate-500">Tagihan {fmt(sel.cycle.statementDate, { month: 'long' })} · dicetak {fmt(sel.cycle.statementDate, { day: 'numeric', month: 'short' })}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-[26px] font-extrabold tracking-tight text-slate-900 tabular-nums">{sel.cycle.amountDue > 0 ? money(sel.cycle.amountDue, sel.acc.currency) : 'Lunas'}</p>
                            <AnimatePresence>
                              {paidPop && (
                                <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                                  <Check size={16} strokeWidth={3} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                            Jatuh tempo {fmt(sel.cycle.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}
                            {sel.cycle.amountDue > 0 && (
                              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', sel.cycle.overdue ? 'bg-rose-100 text-rose-700' : sel.cycle.daysUntilDue <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600')}>
                                {sel.cycle.overdue ? `lewat ${Math.abs(sel.cycle.daysUntilDue)} hari` : sel.cycle.daysUntilDue === 0 ? 'hari ini' : `${sel.cycle.daysUntilDue} hari lagi`}
                              </span>
                            )}
                            {sel.cycle.amountDue > 0 && sel.cycle.minPayment > 0 && <span className="text-[12px]">min. {hidden ? '••••' : short(sel.cycle.minPayment)}</span>}
                          </p>
                        </>
                      ) : (
                        <button type="button" onClick={() => onEdit(sel.acc)} className="w-full rounded-2xl bg-amber-50 p-3 text-left text-[13px] text-amber-900 ring-1 ring-amber-100">
                          Atur tanggal cetak & jatuh tempo supaya tagihan dan pengingatnya jalan. <span className="font-bold">Atur →</span>
                        </button>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={startPay} disabled={cash.length === 0} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-[13px] font-bold text-white disabled:opacity-40">
                          <Check size={15} strokeWidth={3} /> Sudah bayar
                        </button>
                        <button type="button" onClick={() => onEdit(sel.acc)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                          <Pencil size={14} /> Ubah kartu
                        </button>
                      </div>
                    </div>
                    {/* Garis sobek tiket */}
                    <div aria-hidden className="relative h-4">
                      <span className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-white" />
                      <span className="absolute -right-2 top-0 h-4 w-4 rounded-full bg-white" />
                      <span className="absolute inset-x-4 top-2 border-t-2 border-dashed border-slate-200" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-1">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500">Belum ditagih</p>
                        <p className="truncate text-[14px] font-bold text-slate-900 tabular-nums">{unbilled === null ? '—' : hidden ? '••••' : short(unbilled)}</p>
                        {sel.cycle && <p className="text-[11px] text-slate-400">cetak {fmt(sel.cycle.nextStatementDate, { day: 'numeric', month: 'short' })}</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500">Total terpakai</p>
                        <p className="truncate text-[14px] font-bold text-slate-900 tabular-nums">{hidden ? '••••' : short(sel.usage.used)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500">Sisa limit</p>
                        <p className="truncate text-[14px] font-bold text-emerald-600 tabular-nums">{sel.usage.limit > 0 ? (hidden ? '••••' : short(sel.usage.remaining)) : '—'}</p>
                      </div>
                      {sel.usage.limit > 0 && (
                        <div className="col-span-3 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className={cn('h-full rounded-full', sel.usage.used / sel.usage.limit >= 0.9 ? 'bg-rose-500' : 'bg-indigo-500')} style={{ width: `${Math.max(2, Math.min(100, (sel.usage.used / sel.usage.limit) * 100))}%` }} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Paling longgar */}
          {roomiest && roomiest.days > 0 && (
            <div className="flex items-start gap-3 rounded-[20px] bg-gradient-to-br from-indigo-50 to-violet-50 p-3.5 ring-1 ring-indigo-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[18px]" aria-hidden>🦁</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[13px] font-bold text-indigo-900"><Sparkles size={13} /> Paling longgar dipakai hari ini</p>
                <p className="text-[13px] text-slate-700">
                  Belanja pakai <span className="font-semibold">{roomiest.acc.name}</span> hari ini, bayarnya {fmt(roomiest.due, { day: 'numeric', month: 'short' })} — <span className="font-semibold">{roomiest.days} hari lagi</span>.
                </p>
                <p className="text-[11px] text-slate-500">Kalau tagihan sebelumnya dibayar penuh.</p>
              </div>
            </div>
          )}

          {/* Belanja siklus ini */}
          {sel && (
            <section>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h3 className="text-[15px] font-bold text-slate-900">Belanja {sel.cycle ? 'siklus ini' : '30 hari terakhir'}</h3>
                <Link href={`/membership/transactions/daily?rekening=${encodeURIComponent(sel.acc.id ?? '')}&periode=semua`} className="flex items-center gap-0.5 text-[12px] font-bold text-indigo-600 hover:underline">
                  Semua <ChevronRight size={14} />
                </Link>
              </div>
              {cycleSpend.length === 0 ? (
                <p className="rounded-[18px] bg-slate-50 py-5 text-center text-[13px] text-slate-500">Belum ada belanja di kartu ini{sel.cycle ? ' sejak tanggal cetak' : ''}.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-[18px] bg-white ring-1 ring-slate-100">
                  {cycleSpend.slice(0, 8).map((t) => {
                    const v = categoryVisual(t.category, t.type);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-3.5 py-2">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]', v.tile)} aria-hidden>{v.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-slate-900">{t.note || t.subCategory || t.category}</span>
                          <span className="block truncate text-[11px] text-slate-500">{fmt(localYmd(t.date), { day: 'numeric', month: 'short' })} · {t.category}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-bold text-slate-900 tabular-nums">−{money(Number(t.amount) || 0, t.currency)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {cycleSpend.length > 8 && <p className="mt-1 text-center text-[11px] text-slate-400">+{cycleSpend.length - 8} transaksi lain</p>}
            </section>
          )}

          {/* 30 hari ke depan */}
          {upcoming.length > 0 && (
            <section>
              <h3 className="mb-2 text-[15px] font-bold text-slate-900">30 hari ke depan</h3>
              <ol className="relative space-y-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:rounded-full before:bg-slate-200">
                {upcoming.map((e, i) => (
                  <li key={`${e.info.acc.id}-${e.kind}-${e.date}-${i}`} className="relative">
                    <span
                      aria-hidden
                      className={cn('absolute -left-5 top-1.5 h-3 w-3 rounded-full ring-4 ring-white', e.kind === 'cetak' ? 'bg-slate-300' : e.kind === 'lewat' ? 'bg-rose-500' : 'bg-amber-500')}
                    />
                    <button type="button" onClick={() => select(e.info.acc.id)} className="flex w-full items-center gap-3 text-left">
                      <span className="w-14 shrink-0 text-[12px] font-bold text-slate-500">{fmt(e.date, { day: 'numeric', month: 'short' })}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-900">
                          {e.kind === 'cetak' ? `Tagihan ${e.info.acc.name} dicetak` : e.kind === 'lewat' ? `${e.info.acc.name} lewat jatuh tempo` : `${e.info.acc.name} jatuh tempo`}
                        </span>
                        <span className="block text-[11px] text-slate-400">{fmt(e.date, { weekday: 'long' })}</span>
                      </span>
                      {e.amount !== undefined && e.amount > 0 && <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', e.kind === 'lewat' ? 'text-rose-600' : 'text-slate-900')}>{hidden ? '••••' : short(e.amount)}</span>}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
