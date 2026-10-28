"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountService, Account } from '@/lib/services/accountService';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { savingsGoalService, SavingsGoal } from '@/lib/services/savingsGoalService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { AccountModal } from '@/components/modals/AccountModal';
import { isCreditAccountType, computeCreditUsage, getCardCycle } from '@/lib/creditCard';
import { getCardGradientClass } from '@/lib/cardColors';
import { useModal } from '@/context/ModalContext';
import { cn, formatIDR, formatMoney } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { HeaderSlot } from '@/components/Header';
import { AccountDetail } from '@/components/rekening/AccountDetail';

// Rekening & dompet: total saldo, daftar rekening kas (bank, e-wallet,
// tunai, investasi), tumpukan kartu kredit dengan jatuh tempo terdekat,
// dan target tabungan. Ketuk rekening/kartu → detail (AccountDetail);
// "Atur urutan" mengganti urutan yang dipakai semua daftar rekening. Halaman
// Kartu Saya dilebur ke sini (2026-10-28). Rumus saldo & tagihan sama dengan Ringkasan
// (balance dikonversi ke IDR; kartu kredit lewat lib/creditCard.ts).

const TYPE_LABEL: Record<string, string> = {
  'Bank Account': 'Bank',
  'E-Wallet': 'E-wallet',
  Cash: 'Tunai',
  'Investment Account': 'Rekening investasi',
  'Credit Card': 'Kartu kredit',
};
const TYPE_EMOJI: Record<string, { emoji: string; tile: string }> = {
  'Bank Account': { emoji: '🏦', tile: 'bg-blue-50' },
  'E-Wallet': { emoji: '📱', tile: 'bg-sky-50' },
  Cash: { emoji: '💵', tile: 'bg-emerald-50' },
  'Investment Account': { emoji: '📈', tile: 'bg-violet-50' },
  'Credit Card': { emoji: '💳', tile: 'bg-rose-50' },
};
const HIDE_KEY = 'leosiqra-hide-balance';
const short = (n: number) =>
  Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
  : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);
const dueText = (dueDate: string) => {
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
};

export default function RekeningPage() {
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [showSecurityBanner, setShowSecurityBanner] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    try {
      setShowSecurityBanner(localStorage.getItem('rekening-security-banner-dismissed') !== '1');
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch { /* storage diblokir: pakai bawaan */ }
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
  }, []);

  // Data diambil ulang tiap ada perubahan rekening/transaksi/tabungan di mana pun
  // (modal tambah transaksi, transfer, AccountModal, dll).
  useEffect(() => {
    let active = true;
    const loadAccounts = () =>
      accountService
        .getUserAccounts('session')
        .then((a) => active && setAccounts(a))
        .catch(console.error)
        .finally(() => active && setLoading(false));
    const loadTrx = () => transactionService.getUserTransactions('session').then((t) => active && setTransactions(t)).catch(console.error);
    const loadGoals = () => savingsGoalService.getUserSavingsGoals().then((g) => active && setGoals(g)).catch(() => active && setGoals([]));
    loadAccounts();
    loadTrx();
    loadGoals();
    const unsubs = [
      subscribeToCollectionChanges('accounts', loadAccounts),
      subscribeToCollectionChanges('transactions', () => { loadTrx(); loadAccounts(); }),
      subscribeToCollectionChanges('savings', loadGoals),
    ];
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, []);

  const dismissSecurityBanner = () => {
    setShowSecurityBanner(false);
    try { localStorage.setItem('rekening-security-banner-dismissed', '1'); } catch { /* abaikan */ }
  };
  const toggleHidden = () => {
    setHidden((h) => {
      try { localStorage.setItem(HIDE_KEY, h ? '0' : '1'); } catch { /* abaikan */ }
      return !h;
    });
  };
  const money = (n: number, currency?: string) => (hidden ? 'Rp ••••••' : formatMoney(n, currency));

  const handleDelete = async (acc: Account) => {
    const id = acc.id;
    const name = acc.name;
    if (!id) return;
    const ok = await confirm({
      title: `Hapus rekening ${name}?`,
      message: 'Rekening hanya bisa dihapus kalau belum punya transaksi. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus rekening',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await accountService.deleteAccount(id);
      setDetailId(null);
      toast.success(`Rekening ${name} dihapus.`);
    } catch (e) {
      console.error(e);
      // Backend membalas 409 dengan alasan yang jelas kalau rekening masih
      // dipakai transaksi — tampilkan apa adanya.
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal menghapus rekening. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const toIDR = (amount: number, currency: string | undefined) => exchangeRateService.convert(amount, currency || 'IDR', 'IDR', fxRates);
  const sorted = useMemo(() => [...accounts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [accounts]);
  const cashAccounts = sorted.filter((a) => !isCreditAccountType(a.type));
  const cards = sorted.filter((a) => isCreditAccountType(a.type));

  // Sama dengan "Saldo bersih" di Ringkasan: total kolom balance semua rekening (IDR).
  const totalSaldo = accounts.reduce((s, a) => s + toIDR(a.balance || 0, a.currency), 0);
  const cashTotal = cashAccounts.reduce((s, a) => s + toIDR(a.balance || 0, a.currency), 0);

  // Kartu kredit: terpakai (dari transaksi) & siklus tagihan.
  const cardInfo = useMemo(
    () =>
      cards.map((acc) => ({
        acc,
        usage: computeCreditUsage(acc, transactions),
        cycle: getCardCycle(acc, transactions),
      })),
    [cards, transactions]
  );
  const cardsUsedIdr = cardInfo.reduce((s, c) => s + toIDR(c.usage.used, c.acc.currency), 0);
  const nearest = [...cardInfo]
    .filter((c) => c.cycle && c.cycle.amountDue > 0)
    .sort((a, b) => (a.cycle!.daysUntilDue) - (b.cycle!.daysUntilDue))[0];

  const goalsWithTarget = goals.filter((g) => g.targetAmount && g.targetAmount > 0);

  // Urutan rekening kas (kartu kredit tetap di belakang, urutannya sendiri).
  // Optimis: sortOrder lokal langsung diganti, lalu disimpan ke server.
  const move = (index: number, dir: -1 | 1) => {
    const next = [...cashAccounts];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    const ids = [...next, ...cards].map((a) => a.id).filter((id): id is string => Boolean(id));
    setAccounts((list) => list.map((a) => ({ ...a, sortOrder: a.id ? ids.indexOf(a.id) : a.sortOrder })));
    accountService.reorderAccounts(ids).catch((e) => {
      console.error('Gagal menyimpan urutan rekening:', e);
      toast.error('Gagal menyimpan urutan baru. Silakan coba lagi.');
      accountService.getUserAccounts('session').then(setAccounts).catch(console.error);
    });
  };
  const openCreate = () => { setEditingAccount(null); setIsModalOpen(true); };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Judul + aksi */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Rekening</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('topup_transfer')}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <ArrowLeftRight size={16} /> <span className="hidden sm:inline">Transfer</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)] hover:brightness-110"
          >
            <Plus size={16} strokeWidth={2.6} /> <span className="hidden sm:inline">Tambah rekening</span>
          </button>
          <HeaderSlot />
        </div>
      </div>

      {/* Total saldo */}
      <section>
        <p className="text-[15px] font-semibold text-slate-500">{cards.length > 0 ? 'Saldo bersih (kas − tagihan kartu)' : 'Total saldo'}</p>
        {loading ? (
          <Skeleton className="mt-2 h-14 w-72" />
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <p className={cn('text-[44px] font-extrabold leading-none tracking-tight tabular-nums md:text-[56px]', totalSaldo < 0 ? 'text-rose-600' : 'text-slate-900')}>
              {hidden ? 'Rp ••••••' : formatIDR(totalSaldo)}
            </p>
            <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        )}
        <p className="mt-3 text-[15px] text-slate-500">
          {cashAccounts.length} rekening{cards.length > 0 && ` · ${cards.length} kartu kredit`}
          {cards.length > 0 && !hidden && ` · kas ${short(cashTotal)}`}
          {Object.keys(fxRates).length > 0 && accounts.some((a) => a.currency && a.currency !== 'IDR') && ' · dikonversi ke IDR'}
        </p>
        {nearest && (
          <button type="button" onClick={() => setDetailId(nearest.acc.id ?? null)} className="mt-2 inline-flex items-center gap-2 text-[15px] text-slate-600 hover:text-slate-900">
            <CreditCard size={17} className="text-slate-400" />
            Tagihan kartu {hidden ? '••••' : short(cardsUsedIdr)} · {nearest.cycle!.overdue ? 'lewat jatuh tempo' : 'jatuh tempo'} {dueText(nearest.cycle!.dueDate)}
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        )}
      </section>

      {showSecurityBanner && (
        <div className="relative flex items-start gap-3 rounded-[20px] bg-indigo-50/70 p-4 pr-10 ring-1 ring-indigo-100">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-indigo-600" />
          <p className="text-[14px] text-slate-600">
            <span className="font-semibold text-slate-900">Leosiqra tidak pernah meminta akses ke bank kamu.</span>{' '}
            Tidak ada username, password, atau PIN bank — saldo di sini murni dari catatan yang kamu input sendiri.
          </p>
          <button onClick={dismissSecurityBanner} aria-label="Tutup" className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Rekening kas */}
      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Rekeningmu</h2>
          {cashAccounts.length > 1 && (
            <button type="button" onClick={() => setReordering((r) => !r)} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold', reordering ? 'bg-slate-900 text-white' : 'text-indigo-600 hover:bg-indigo-50')}>
              <ArrowUpDown size={14} /> {reordering ? 'Selesai' : 'Atur urutan'}
            </button>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : cashAccounts.length === 0 ? (
          <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-100">
            <p className="text-[15px] font-semibold text-slate-900">Belum ada rekening</p>
            <p className="mt-1 text-[14px] text-slate-500">Tambahkan bank, e-wallet, atau uang tunai pertamamu untuk mulai mencatat.</p>
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-[14px] font-bold text-white">
              <Plus size={16} /> Tambah rekening
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-100">
            {cashAccounts.map((acc, i) => {
              const v = TYPE_EMOJI[acc.type] ?? { emoji: '🏦', tile: 'bg-slate-100' };
              const bal = acc.balance || 0;
              const body = (
                <>
                  <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-[22px]', v.tile)}>
                    <LogoImage
                      src={acc.logoUrl}
                      alt={acc.name}
                      fallbackText={acc.name.substring(0, 3).toUpperCase()}
                      fallbackIcon={<span aria-hidden className={cn('flex h-full w-full items-center justify-center text-[22px]', v.tile)}>{v.emoji}</span>}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-slate-900">{acc.name}</p>
                    <p className="truncate text-[13px] text-slate-500">{TYPE_LABEL[acc.type] ?? acc.type}{acc.currency && acc.currency !== 'IDR' ? ` · ${acc.currency}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('whitespace-nowrap text-[16px] font-bold tabular-nums', bal < 0 ? 'text-rose-600' : 'text-slate-900')}>{money(bal, acc.currency)}</p>
                    {acc.currency && acc.currency !== 'IDR' && !hidden && <p className="text-[12px] text-slate-400 tabular-nums">≈ {formatIDR(toIDR(bal, acc.currency))}</p>}
                  </div>
                </>
              );
              return (
                <li key={acc.id}>
                  {reordering ? (
                    <div className="flex items-center gap-3.5 px-4 py-3 md:px-5">
                      {body}
                      <div className="flex flex-col">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${acc.name}`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronUp size={18} /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === cashAccounts.length - 1} aria-label={`Turunkan ${acc.name}`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronDown size={18} /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDetailId(acc.id ?? null)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-slate-50 md:px-5">
                      {body}
                      <ChevronRight size={17} className="shrink-0 text-slate-300" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Kartu kredit bergaya kartu fisik */}
      {cardInfo.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Kartu kredit</h2>
            <span className="text-[13px] text-slate-400">Ketuk kartu untuk detail tagihan</span>
          </div>
          {/* Kartu fisik: di HP digeser ke samping, di desktop dua kolom */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            {cardInfo.map(({ acc, usage, cycle }) => {
              const chip = cycle && cycle.amountDue > 0
                ? cycle.overdue
                  ? `Lewat ${Math.abs(cycle.daysUntilDue)} hari`
                  : `${dueText(cycle.dueDate)} · ${cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hari lagi`}`
                : usage.used > 0 ? 'Belum ada tagihan' : 'Lunas';
              const urgent = cycle && cycle.amountDue > 0 && (cycle.overdue || cycle.daysUntilDue <= 5);
              const pct = usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setDetailId(acc.id ?? null)}
                  className={cn(
                    'relative flex aspect-[1.586/1] w-[85%] shrink-0 snap-center flex-col justify-between overflow-hidden rounded-[22px] p-5 text-left text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.6)] transition-transform hover:-translate-y-0.5 sm:w-[360px] md:w-auto',
                    getCardGradientClass(acc.cardColor, acc.type)
                  )}
                >
                  {/* Kilau & lingkaran dekorasi */}
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10" />
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95">
                        <LogoImage
                          src={acc.logoUrl}
                          alt={acc.name}
                          fallbackText={acc.name.substring(0, 3).toUpperCase()}
                          fallbackIcon={<CreditCard size={17} className="text-slate-700" />}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className="truncate text-[17px] font-bold tracking-tight">{acc.name}</span>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold', urgent ? 'bg-white text-rose-600' : 'bg-white/25')}>{chip}</span>
                  </div>

                  <div className="relative flex items-center gap-3">
                    {/* Chip EMV */}
                    <svg width="42" height="32" viewBox="0 0 42 32" aria-hidden className="drop-shadow-sm">
                      <rect x="0.5" y="0.5" width="41" height="31" rx="6" fill="#f5d27a" stroke="#d4a943" />
                      <path d="M14 1v30M28 1v30M1 11h13M28 11h13M1 21h13M28 21h13M14 16h14" stroke="#c99a35" strokeWidth="1.2" fill="none" />
                    </svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M8.5 7.5a6.5 6.5 0 0 1 0 9M12 5a10 10 0 0 1 0 14M5 10a2.5 2.5 0 0 1 0 4" />
                    </svg>
                    <span className="ml-auto font-mono text-[14px] tracking-[0.2em] text-white/80">•••• •••• ••••</span>
                  </div>

                  <div className="relative">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Terpakai</p>
                        <p className="truncate text-[22px] font-extrabold leading-tight tabular-nums">{money(usage.used, acc.currency)}</p>
                      </div>
                      {usage.limit > 0 && (
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Sisa limit</p>
                          <p className="text-[14px] font-bold tabular-nums">{hidden ? '••••' : short(usage.remaining)}</p>
                        </div>
                      )}
                    </div>
                    {usage.limit > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
                        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-rose-300' : 'bg-white')} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setDetailId((nearest ?? cardInfo[0]).acc.id ?? null)} className="mt-3 flex w-full items-center gap-3 rounded-[22px] bg-white px-5 py-4 text-left ring-1 ring-slate-100 hover:bg-slate-50">
            <div className="flex-1">
              <p className="text-[13px] text-slate-500">Tagihan kartu</p>
              <p className="text-[20px] font-extrabold tracking-tight text-slate-900 tabular-nums">{hidden ? 'Rp ••••••' : formatIDR(cardsUsedIdr)}</p>
            </div>
            {nearest && (
              <div className="text-right">
                <p className="text-[13px] text-slate-500">{nearest.acc.name}</p>
                <p className="text-[14px] font-semibold text-amber-600">{hidden ? '••••' : short(nearest.cycle!.amountDue)} · {dueText(nearest.cycle!.dueDate)}</p>
              </div>
            )}
            <ChevronRight size={18} className="text-slate-300" />
          </button>
        </section>
      )}

      {/* Target tabungan */}
      {goalsWithTarget.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Target</h2>
            <Link href="/membership/tabungan" className="text-[14px] font-bold text-indigo-600 hover:underline">Lihat semua</Link>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-100">
            {goalsWithTarget.slice(0, 5).map((g, i) => {
              const pct = Math.max(0, Math.min(100, g.progressPercent ?? (g.currentTotal / (g.targetAmount || 1)) * 100));
              return (
                <li key={g.id}>
                  <Link href="/membership/tabungan" className="flex items-center gap-3.5 px-4 py-4 hover:bg-slate-50 md:px-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50 text-[22px]" aria-hidden>🎯</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[16px] font-semibold text-slate-900">{g.name}</p>
                        <span className="text-[13px] font-semibold text-slate-500">{Math.round(pct)}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full', ['bg-indigo-600', 'bg-teal-500', 'bg-pink-500', 'bg-amber-500'][i % 4])} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <p className="mt-1 text-[13px] text-slate-500">{hidden ? '••••' : `${short(g.currentTotal)} dari ${short(g.targetAmount || 0)}`}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AccountDetail
        account={accounts.find((a) => a.id === detailId) ?? null}
        transactions={transactions}
        hidden={hidden}
        deleting={deletingId === detailId}
        onClose={() => setDetailId(null)}
        onEdit={(a) => { setDetailId(null); setEditingAccount(a); setIsModalOpen(true); }}
        onDelete={(a) => void handleDelete(a)}
      />

      {uid && (
        <AccountModal
          userId={uid}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingAccount(null); }}
          initialData={editingAccount}
          existingTypes={Array.from(new Set(accounts.map((a) => a.type).filter(Boolean)))}
        />
      )}
    </div>
  );
}
