"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
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

// Rekening & dompet: total saldo, daftar rekening kas (bank, e-wallet,
// tunai, investasi), tumpukan kartu kredit dengan jatuh tempo terdekat,
// dan target tabungan. Rumus saldo & tagihan sama dengan Ringkasan
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

  const handleDelete = async (id: string, name: string) => {
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
  const openCreate = () => { setEditingAccount(null); setIsModalOpen(true); };

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">
      {/* Judul + aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Rekening</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openModal('topup_transfer')}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <ArrowLeftRight size={16} /> Transfer
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)] hover:brightness-110"
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah rekening
          </button>
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
          <Link href="/membership/cards" className="mt-2 inline-flex items-center gap-2 text-[15px] text-slate-600 hover:text-slate-900">
            <CreditCard size={17} className="text-slate-400" />
            Tagihan kartu {hidden ? '••••' : short(cardsUsedIdr)} · {nearest.cycle!.overdue ? 'lewat jatuh tempo' : 'jatuh tempo'} {dueText(nearest.cycle!.dueDate)}
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
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
          <Link href="/membership/transactions/daily" className="text-[14px] font-bold text-indigo-600 hover:underline">Riwayat transaksi</Link>
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
            {cashAccounts.map((acc) => {
              const v = TYPE_EMOJI[acc.type] ?? { emoji: '🏦', tile: 'bg-slate-100' };
              const bal = acc.balance || 0;
              return (
                <li key={acc.id} className="group flex items-center gap-3.5 px-4 py-3 md:px-5">
                  <Link href={`/membership/transactions/daily?rekening=${encodeURIComponent(acc.id ?? '')}&periode=semua`} className="flex min-w-0 flex-1 items-center gap-3.5">
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
                  </Link>
                  <div className="flex items-center md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }} aria-label={`Ubah ${acc.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => acc.id && handleDelete(acc.id, acc.name)} disabled={deletingId === acc.id} aria-label={`Hapus ${acc.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Kartu kredit: tumpukan kartu */}
      {cardInfo.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Kartu kredit</h2>
            <Link href="/membership/cards" className="text-[14px] font-bold text-indigo-600 hover:underline">Lihat semua</Link>
          </div>
          <div className="mx-auto max-w-xl">
            {cardInfo.map(({ acc, usage, cycle }, i) => {
              const chip = cycle && cycle.amountDue > 0
                ? cycle.overdue
                  ? `Lewat ${Math.abs(cycle.daysUntilDue)} hari`
                  : `${dueText(cycle.dueDate)} · ${cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hari lagi`}`
                : usage.used > 0 ? `Terpakai ${short(usage.used)}` : 'Lunas';
              const urgent = cycle && cycle.amountDue > 0 && (cycle.overdue || cycle.daysUntilDue <= 5);
              return (
                <Link
                  key={acc.id}
                  href="/membership/cards"
                  className={cn('relative flex items-center gap-3 rounded-t-[22px] px-5 pb-8 pt-4 text-white shadow-[0_-6px_16px_-10px_rgba(15,23,42,0.5)]', getCardGradientClass(acc.cardColor, acc.type), i > 0 && '-mt-5')}
                  style={{ zIndex: i + 1 }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90">
                    <LogoImage
                      src={acc.logoUrl}
                      alt={acc.name}
                      fallbackText={acc.name.substring(0, 3).toUpperCase()}
                      fallbackIcon={<CreditCard size={18} className="text-slate-700" />}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[18px] font-bold">{acc.name}</span>
                  <span className={cn('shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold', urgent ? 'bg-white text-rose-600' : 'bg-white/20')}>{chip}</span>
                </Link>
              );
            })}
            <Link href="/membership/cards" className="relative -mt-5 flex items-center gap-3 rounded-[22px] bg-white px-5 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-100" style={{ zIndex: cardInfo.length + 1 }}>
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
            </Link>
          </div>
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
