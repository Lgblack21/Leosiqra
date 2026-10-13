"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeftRight, ChevronRight, CreditCard, Eye, EyeOff, Pencil, Plus, Trash2, X, Receipt,
} from 'lucide-react';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { savingsGoalService, type SavingsGoal } from '@/lib/services/savingsGoalService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { AccountModal } from '@/components/modals/AccountModal';
import { isCreditAccountType, computeCreditUsage, getCardCycle } from '@/lib/creditCard';
import { useModal } from '@/context/ModalContext';
import { cn, formatIDR, formatMoney, isIncomingTransaction } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';

// Dompet gaya baru (pola Oyenza): total saldo (bisa disembunyikan), daftar
// dompet, tumpukan kartu kredit + jatuh tempo, target tabungan. Klik dompet →
// panel ringkasan + transaksinya; klik kartu → panel tagihan kartu. Tambah /
// ubah / hapus memakai AccountModal & API yang sudah ada.

const HIDE_KEY = 'leo-wallet-hide:v1';
const TYPE_LABEL: Record<string, string> = { 'Bank Account': 'Bank', 'E-Wallet': 'E-wallet', Cash: 'Tunai', 'Investment Account': 'Rekening investasi', 'Credit Card': 'Kartu kredit' };
const CARD_GRADS = ['from-sky-600 to-blue-700', 'from-amber-500 to-orange-600', 'from-teal-600 to-emerald-700', 'from-violet-600 to-indigo-700', 'from-rose-500 to-pink-600', 'from-slate-700 to-slate-900'];
const fmtDue = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
};

const AccLogo = ({ acc, size = 40 }: { acc: Account; size?: number }) => <AccountLogo acc={acc} size={size} />;

function Sheet({ open, onClose, title, children, side = 'right' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; side?: 'right' | 'center' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={side === 'right' ? { x: '100%' } : { opacity: 0, y: 30 }}
            animate={side === 'right' ? { x: 0 } : { opacity: 1, y: 0 }}
            exit={side === 'right' ? { x: '100%' } : { opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl sm:m-3 sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <p className="text-lg font-extrabold text-slate-900">{title}</p>
              <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function RekeningPage() {
  return (
    <Suspense fallback={null}>
      <DompetInner />
    </Suspense>
  );
}

function DompetInner() {
  // ?panel=kartu (dari tautan lama /membership/cards) langsung membuka panel kartu.
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();
  const [uid, setUid] = useState('');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [modal, setModal] = useState<{ open: boolean; account: Account | null; type?: Account['type'] }>({ open: false, account: null });
  const [walletId, setWalletId] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(() => params.get('panel') === 'kartu');

  const load = useCallback(() => {
    accountService.getUserAccounts('session').then(setAccounts).catch(() => setAccounts([]));
  }, []);
  useEffect(() => {
    load();
    const loadTx = () => transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
    const loadGoals = () => savingsGoalService.getUserSavingsGoals().then(setGoals).catch(() => {});
    const loadSav = () => savingsService.getUserSavings('session').then(setSavings).catch(() => {});
    loadTx();
    loadGoals();
    loadSav();
    exchangeRateService.getLatestRates().then(setFx).catch(() => {});
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me').then((r) => setUid(r.user?.id ?? '')).catch(() => {});
    const subs = [
      subscribeToCollectionChanges('accounts', load),
      subscribeToCollectionChanges('transactions', () => { loadTx(); load(); }),
      subscribeToCollectionChanges('savings', () => { loadSav(); loadGoals(); load(); }),
      subscribeToCollectionChanges('recurring', loadGoals),
    ];
    return () => subs.forEach((u) => u());
  }, [load]);

  const toIdr = (n: number, cur?: string) => exchangeRateService.convert(n || 0, cur || 'IDR', 'IDR', fx);
  const money = (n: number, cur?: string) => (hidden ? 'Rp •••' : formatMoney(n, cur));
  const toggleHidden = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        /* abaikan */
      }
      return !h;
    });

  const list = accounts ?? [];
  const wallets = list.filter((a) => !isCreditAccountType(a.type));
  const cards = list.filter((a) => isCreditAccountType(a.type));
  // Sama dengan "Saldo bersih" di Ringkasan: total kolom balance semua rekening (IDR).
  const total = list.reduce((s, a) => s + toIdr(a.balance, a.currency), 0);
  const cash = wallets.reduce((s, a) => s + toIdr(a.balance, a.currency), 0);
  const saved = savings.reduce((s, x) => s + (x.transactionType === 'Penarikan' ? -1 : 1) * (Number(x.amountIDR) || x.amount), 0);

  const cardInfo = useMemo(
    () =>
      cards.map((c, i) => ({
        acc: c,
        used: toIdr(computeCreditUsage(c).used, c.currency),
        limit: c.creditLimit || 0,
        cycle: getCardCycle(c, transactions),
        grad: CARD_GRADS[i % CARD_GRADS.length],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards.map((c) => `${c.id}:${c.balance}`).join(), transactions, fx]
  );
  const cardTotal = cardInfo.reduce((s, c) => s + c.used, 0);
  const dueSoon = cardInfo.filter((c) => c.cycle && c.cycle.amountDue > 0).sort((a, b) => a.cycle!.daysUntilDue - b.cycle!.daysUntilDue);
  const nearest = dueSoon[0];

  const wallet = list.find((a) => a.id === walletId) ?? null;
  const walletTx = wallet ? transactions.filter((t) => t.type !== 'debt' && (t.accountId === wallet.id || t.targetAccountId === wallet.id)).sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 40) : [];

  const remove = async (acc: Account) => {
    const ok = await confirm({ title: `Hapus ${acc.name}?`, message: 'Rekening hanya bisa dihapus kalau belum punya transaksi. Tindakan ini tidak bisa dibatalkan.', confirmLabel: 'Hapus', danger: true });
    if (!ok || !acc.id) return;
    try {
      await accountService.deleteAccount(acc.id);
      setWalletId(null);
      toast.success(`${acc.name} dihapus.`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal menghapus rekening.');
    }
  };

  const card = 'rounded-[26px] bg-white p-5 ring-1 ring-slate-100 md:p-6';
  const btn = 'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors';

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <h1 className="sr-only">Dompet</h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => openModal('topup_transfer')} className={cn(btn, 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50')}>
          <ArrowLeftRight size={14} /> Transfer
        </button>
        <button type="button" onClick={() => setModal({ open: true, account: null })} className={cn(btn, 'bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800')}>
          <Plus size={15} /> Tambah dompet
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          {/* Total saldo */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              Total saldo
              <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </p>
            {accounts === null ? <Skeleton className="mt-2 h-11 w-56" /> : (
              <p className={cn('text-[38px] font-extrabold leading-tight tracking-tight tabular-nums', total < 0 ? 'text-rose-500' : 'text-slate-900')}>
                {hidden ? 'Rp •••••' : <AnimatedNumber value={total} format={formatIDR} />}
              </p>
            )}
            <p className="text-sm text-slate-500">
              {money(cash)} di dompet{saved > 0 ? <> · {money(saved)} di tabungan</> : null}
            </p>
            {cardTotal > 0 && (
              <button type="button" onClick={() => setCardsOpen(true)} className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
                <CreditCard size={14} /> Tagihan kartu {money(cardTotal)}{nearest ? ` · jatuh tempo ${fmtDue(nearest.cycle!.dueDate)}` : ''} <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Dompetmu */}
          <div>
            <p className="mb-2 px-1 font-bold text-slate-900">Dompetmu</p>
            {accounts === null ? (
              <Skeleton className="h-40 rounded-[22px]" />
            ) : wallets.length === 0 ? (
              <button type="button" onClick={() => setModal({ open: true, account: null })} className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-slate-200 py-8 text-sm font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
                <Plus size={16} /> Tambah dompet pertama
              </button>
            ) : (
              <ul className="overflow-hidden rounded-[22px] bg-slate-100/70">
                {wallets.map((a, i) => (
                  <motion.li key={a.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="border-b border-white last:border-b-0">
                    <button type="button" onClick={() => setWalletId(a.id!)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white">
                      <AccLogo acc={a} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{a.name}{i === 0 && <span className="ml-1 text-amber-500">★</span>}</span>
                        <span className="text-xs text-slate-400">{TYPE_LABEL[a.type] ?? a.type}{a.currency && a.currency !== 'IDR' ? ` · ${a.currency}` : ''}</span>
                      </span>
                      <span className="text-right">
                        <span className={cn('block text-sm font-bold tabular-nums', a.balance < 0 ? 'text-rose-500' : 'text-slate-900')}>{money(a.balance, a.currency)}</span>
                        {a.currency && a.currency !== 'IDR' && !hidden && <span className="text-xs text-slate-400">≈ {formatIDR(toIdr(a.balance, a.currency))}</span>}
                      </span>
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Kartu kredit */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-bold text-slate-900">Kartu kredit</p>
              {cards.length > 0 && <button type="button" onClick={() => setCardsOpen(true)} className="text-[13px] font-bold text-slate-600 hover:text-slate-900">Lihat semua</button>}
            </div>
            {cards.length === 0 ? (
              <button type="button" onClick={() => openModal('kartu')} className="flex w-full items-center gap-3 rounded-[22px] bg-slate-100/70 px-4 py-4 text-left hover:bg-slate-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm"><CreditCard size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">Punya kartu kredit?</span>
                  <span className="block text-xs text-slate-500">Simpan tagihan dan jatuh tempo tiap kartu.</span>
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ) : (
              <button type="button" onClick={() => setCardsOpen(true)} className="block w-full text-left">
                <div className="relative">
                  {cardInfo.map((c, i) => (
                    <motion.div
                      key={c.acc.id}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      whileHover={{ y: -3 }}
                      className={cn('relative flex items-center gap-3 rounded-t-[22px] bg-gradient-to-br px-4 pb-6 pt-3.5 text-white shadow-md', c.grad, i > 0 && '-mt-3')}
                      style={c.acc.cardColor ? { background: c.acc.cardColor } : undefined}
                    >
                      <AccLogo acc={c.acc} size={28} />
                      <span className="flex-1 truncate text-[15px] font-bold">{c.acc.name}</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', c.cycle && c.cycle.amountDue > 0 ? (c.cycle.overdue ? 'bg-rose-500 text-white' : c.cycle.daysUntilDue <= 3 ? 'bg-white text-slate-900' : 'bg-white/20') : 'bg-white/20')}>
                        {c.cycle && c.cycle.amountDue > 0 ? (c.cycle.overdue ? 'Lewat jatuh tempo' : `${fmtDue(c.cycle.dueDate)} · ${c.cycle.daysUntilDue} hari lagi`) : c.used > 0 ? `${money(c.used)} terpakai` : 'Lunas'}
                      </span>
                    </motion.div>
                  ))}
                  <div className="-mt-3 flex items-center justify-between rounded-[22px] bg-white px-4 py-3.5 ring-1 ring-slate-100">
                    <span>
                      <span className="block text-xs text-slate-500">Tagihan kartu</span>
                      <span className="text-base font-extrabold text-slate-900 tabular-nums">{money(cardTotal)}</span>
                    </span>
                    {nearest && (
                      <span className="text-right text-xs">
                        <span className="block text-slate-500">{nearest.acc.name}</span>
                        <span className="font-bold text-amber-600">{money(nearest.cycle!.amountDue)} · {fmtDue(nearest.cycle!.dueDate)}</span>
                      </span>
                    )}
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Target */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-bold text-slate-900">Target</p>
              <Link href="/membership/tabungan" className="text-[13px] font-bold text-slate-600 hover:text-slate-900">Lihat semua</Link>
            </div>
            {goals.filter((g) => g.targetAmount).length === 0 ? (
              <Link href="/membership/tabungan" className="flex items-center gap-3 rounded-[22px] bg-slate-100/70 px-4 py-4 hover:bg-slate-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">🎯</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">Belum ada target</span>
                  <span className="block text-xs text-slate-500">Buat target untuk rumah, kendaraan, liburan, atau dana darurat.</span>
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
            ) : (
              <ul className="overflow-hidden rounded-[22px] bg-slate-100/70">
                {goals.filter((g) => g.targetAmount).map((g, i) => (
                  <li key={g.id} className="border-b border-white last:border-b-0">
                    <Link href="/membership/tabungan" className="flex items-center gap-3 px-4 py-3 hover:bg-white">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">{categoryEmoji(g.category || g.name) === '💸' ? '🎯' : categoryEmoji(g.category || g.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{g.name}</span>
                          <span className="text-xs font-bold text-slate-500">{Math.round(g.progressPercent ?? 0)}%</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white">
                          <motion.span className="block h-full rounded-full bg-indigo-500" initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(100, g.progressPercent ?? 0)}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} />
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">{money(g.currentTotal)} dari {money(g.targetAmount ?? 0)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Panel dompet */}
      <Sheet open={Boolean(wallet)} onClose={() => setWalletId(null)} title={wallet?.name ?? ''}>
        {wallet && (
          <>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <AccLogo acc={wallet} size={44} />
                <span>
                  <span className="block text-2xl font-extrabold text-slate-900 tabular-nums">
                    {isCreditAccountType(wallet.type) ? money(computeCreditUsage(wallet).used, wallet.currency) : money(wallet.balance, wallet.currency)}
                  </span>
                  <span className="text-xs text-slate-500">{isCreditAccountType(wallet.type) ? `Terpakai · limit ${money(wallet.creditLimit || 0, wallet.currency)}` : `Saldo saat ini · ${TYPE_LABEL[wallet.type] ?? wallet.type}`}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => { setWalletId(null); setModal({ open: true, account: wallet }); }} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><Pencil size={13} /> Ubah</button>
                <button type="button" onClick={() => { setWalletId(null); openModal('topup_transfer'); }} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><ArrowLeftRight size={13} /> Transfer</button>
                <button type="button" onClick={() => remove(wallet)} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[13px] font-bold text-rose-600 ring-1 ring-slate-200 hover:bg-rose-50"><Trash2 size={13} /> Hapus</button>
              </div>
            </div>
            {isCreditAccountType(wallet.type) && (() => {
              const used = computeCreditUsage(wallet).used;
              const limit = wallet.creditLimit || 0;
              const cyc = getCardCycle(wallet, transactions);
              return (
                <div className="mt-3 space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-100">
                  {limit > 0 && (
                    <div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Terpakai {Math.round((used / limit) * 100)}%</span><span className="font-semibold text-slate-700">Sisa limit {money(limit - used, wallet.currency)}</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <motion.div className={cn('h-full rounded-full', used / limit > 0.9 ? 'bg-rose-500' : used / limit > 0.7 ? 'bg-amber-500' : 'bg-indigo-500')} initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(100, (used / limit) * 100)}%` }} transition={{ duration: 0.7 }} />
                      </div>
                    </div>
                  )}
                  {cyc ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-slate-500">Tagihan periode ini</p><p className={cn('font-bold tabular-nums', cyc.overdue ? 'text-rose-500' : 'text-slate-900')}>{money(cyc.amountDue, wallet.currency)}</p></div>
                      <div><p className="text-xs text-slate-500">Minimum bayar</p><p className="font-bold tabular-nums text-slate-900">{money(cyc.minPayment, wallet.currency)}</p></div>
                      <div><p className="text-xs text-slate-500">Tanggal cetak</p><p className="font-semibold text-slate-800">{fmtDue(cyc.statementDate)} · berikutnya {fmtDue(cyc.nextStatementDate)}</p></div>
                      <div><p className="text-xs text-slate-500">Jatuh tempo</p><p className={cn('font-semibold', cyc.overdue ? 'text-rose-500' : 'text-slate-800')}>{fmtDue(cyc.dueDate)} · {cyc.amountDue <= 0 ? 'lunas' : cyc.overdue ? `telat ${Math.abs(cyc.daysUntilDue)} hari` : `${cyc.daysUntilDue} hari lagi`}</p></div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Atur tanggal cetak & jatuh tempo lewat <b>Ubah</b> supaya tagihan & minimum bayar dihitung otomatis.</p>
                  )}
                  <button type="button" onClick={() => { setWalletId(null); openModal('topup_transfer'); }} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800">
                    <Receipt size={14} /> Bayar tagihan
                  </button>
                </div>
              );
            })()}
            <div className="mb-1 mt-4 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Transaksi</p>
              <Link href={`/membership/transactions/daily?period=semua`} className="text-xs font-bold text-slate-500 hover:text-slate-900">Lihat di Transaksi</Link>
            </div>
            {walletTx.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada transaksi di dompet ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {walletTx.map((t, i) => {
                  const incoming = t.targetAccountId === wallet.id && t.accountId !== wallet.id ? true : isIncomingTransaction(t);
                  return (
                    <motion.li key={t.id} initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">{t.type === 'transfer' || t.type === 'topup' ? '🔁' : categoryEmoji(t.category)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{t.note || t.category}</span>
                        <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t.createdAt || t.date))} · {t.category}</span>
                      </span>
                      <span className={cn('text-sm font-bold tabular-nums', incoming ? 'text-emerald-600' : 'text-slate-900')}>{incoming ? '+' : '−'} {money(t.amount, t.currency)}</span>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Sheet>

      {/* Panel kartu kredit */}
      <Sheet open={cardsOpen} onClose={() => setCardsOpen(false)} title="Kartu kredit">
        <p className="text-xs text-slate-500">Tagihan kartu</p>
        <p className="text-[30px] font-extrabold tracking-tight text-slate-900 tabular-nums">{money(cardTotal)}</p>
        {nearest && <p className="text-xs text-slate-500">Terdekat: {nearest.acc.name}, {fmtDue(nearest.cycle!.dueDate)} ({nearest.cycle!.daysUntilDue} hari lagi)</p>}
        <div className="mt-4">
          {cardInfo.map((c, i) => (
            <motion.button
              type="button"
              key={c.acc.id}
              onClick={() => { setCardsOpen(false); setWalletId(c.acc.id!); }}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 26 }}
              whileHover={{ y: -4 }}
              className={cn('relative block w-full rounded-[22px] bg-gradient-to-br px-4 pb-8 pt-4 text-left text-white shadow-lg', c.grad, i > 0 && '-mt-6')}
              style={c.acc.cardColor ? { background: c.acc.cardColor } : undefined}
            >
              <span className="flex items-center gap-2">
                <AccLogo acc={c.acc} size={26} />
                <span className="flex-1 truncate font-bold">{c.acc.name}</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{c.cycle && c.cycle.amountDue > 0 ? `${fmtDue(c.cycle.dueDate)} · ${c.cycle.daysUntilDue} hari lagi` : 'Lunas'}</span>
              </span>
              {i === cardInfo.length - 1 && (
                <span className="mt-6 block">
                  <span className="block text-xs text-white/70">Total terpakai</span>
                  <span className="text-xl font-extrabold tabular-nums">{money(c.used)}</span>
                  {c.limit > 0 && <span className="ml-2 text-xs text-white/70">dari limit {money(c.limit)}</span>}
                </span>
              )}
            </motion.button>
          ))}
          <p className="mt-2 text-center text-xs text-slate-400">Ketuk kartu untuk membukanya</p>
        </div>

        {cardInfo.length > 1 && (() => {
          const best = [...cardInfo].filter((c) => c.limit > 0).sort((a, b) => (b.limit - b.used) - (a.limit - a.used))[0];
          return best ? (
            <div className="mt-4 rounded-2xl bg-indigo-50 p-3.5 text-sm text-indigo-900">
              <p className="font-bold">✨ Paling longgar dipakai hari ini</p>
              <p className="text-indigo-800/80">{best.acc.name} masih punya sisa limit {money(best.limit - best.used)}.</p>
            </div>
          ) : null;
        })()}

        <p className="mb-1 mt-5 text-sm font-bold text-slate-900">Jatuh tempo 30 hari ke depan</p>
        {dueSoon.filter((c) => c.cycle!.daysUntilDue <= 30).length === 0 ? (
          <p className="py-3 text-sm text-slate-500">Tidak ada tagihan yang jatuh tempo.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dueSoon.filter((c) => c.cycle!.daysUntilDue <= 30).map((c) => {
              const [y, m, d] = c.cycle!.dueDate.split('-').map(Number);
              const dt = new Date(y, m - 1, d);
              return (
                <li key={c.acc.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-slate-50 leading-none">
                    <span className="text-base font-extrabold text-slate-900">{d}</span>
                    <span className="text-[10px] text-slate-400">{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(dt)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{c.acc.name} jatuh tempo</span>
                    <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(dt)}</span>
                  </span>
                  <span className={cn('text-sm font-bold tabular-nums', c.cycle!.overdue ? 'text-rose-500' : 'text-slate-900')}>{money(c.cycle!.amountDue, c.acc.currency)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={() => { setCardsOpen(false); openModal('kartu'); }} className="mt-4 flex w-full items-center justify-center gap-1 rounded-full bg-slate-100 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200"><Plus size={14} /> Tambah kartu</button>
      </Sheet>

      {uid && (
        <AccountModal
          userId={uid}
          isOpen={modal.open}
          onClose={() => setModal({ open: false, account: null })}
          initialData={modal.account}
          initialType={modal.type}
          title={modal.account ? 'Ubah dompet' : 'Tambah dompet'}
          existingTypes={Array.from(new Set(list.map((a) => a.type).filter(Boolean)))}
        />
      )}
    </div>
  );
}
