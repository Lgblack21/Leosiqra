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
import { CreditCardHub } from '@/components/rekening/CreditCardHub';
import { CreditCardForm } from '@/components/rekening/CreditCardForm';

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
// Warna segmen komposisi kas (urutan = urutan rekening).
const SEG = ['#818cf8', '#2dd4bf', '#fbbf24', '#f472b6', '#38bdf8', '#a78bfa', '#a3e635', '#fb923c'];
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
  // Pusat kartu kredit: undefined = tertutup, string/null = terbuka (kartu awal).
  const [hub, setHub] = useState<{ id: string | null; n: number } | undefined>(undefined);
  // Form khusus kartu kredit: undefined = tertutup, null = kartu baru.
  const [cardForm, setCardForm] = useState<Account | null | undefined>(undefined);

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
  const openEdit = (a: Account) => {
    if (isCreditAccountType(a.type)) setCardForm(a);
    else { setEditingAccount(a); setIsModalOpen(true); }
  };
  const openHub = (id: string | null | undefined) => setHub((h) => ({ id: id ?? null, n: (h?.n ?? 0) + 1 }));

  // Komposisi kas: porsi saldo positif tiap rekening (untuk bar di kartu atas).
  const positive = cashAccounts.map((a) => Math.max(0, toIDR(a.balance || 0, a.currency)));
  const positiveTotal = positive.reduce((s, n) => s + n, 0);
  const share = (i: number) => (positiveTotal > 0 ? positive[i] / positiveTotal : 0);
  const pctText = (x: number) => (x > 0 && x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Judul + aksi */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Rekening</h1>
          <p className="text-[13px] text-slate-500">
            {cashAccounts.length} rekening{cards.length > 0 && ` · ${cards.length} kartu kredit`}
            {Object.keys(fxRates).length > 0 && accounts.some((a) => a.currency && a.currency !== 'IDR') && ' · dikonversi ke IDR'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('topup_transfer')}
            aria-label="Transfer antar rekening"
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <ArrowLeftRight size={15} /> <span className="hidden sm:inline">Transfer</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            aria-label="Tambah rekening"
            className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-slate-800"
          >
            <Plus size={15} strokeWidth={2.6} /> <span className="hidden sm:inline">Tambah</span>
          </button>
          <HeaderSlot />
        </div>
      </div>

      {/* Kartu saldo + komposisi kas */}
      {loading ? (
        <Skeleton className="h-44 rounded-[24px]" />
      ) : (
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-5 text-white md:p-6">
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-2xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal-400/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-white/60">{cards.length > 0 ? 'Saldo bersih' : 'Total saldo'}</p>
              <p className={cn('mt-0.5 truncate text-[30px] font-extrabold leading-tight tracking-tight tabular-nums md:text-[34px]', totalSaldo < 0 && 'text-rose-300')} title={formatIDR(totalSaldo)}>
                {hidden ? 'Rp ••••••' : formatIDR(totalSaldo)}
              </p>
              {cards.length > 0 && (
                <p className="text-[13px] text-white/70 tabular-nums">
                  Kas {hidden ? '••••' : short(cashTotal)} · tagihan kartu {hidden ? '••••' : short(cardsUsedIdr)}
                </p>
              )}
            </div>
            <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="shrink-0 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/15">
              {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {positiveTotal > 0 && (
            <div className="relative mt-4">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
                {cashAccounts.map((a, i) => share(i) > 0 && (
                  <span key={a.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${share(i) * 100}%`, background: SEG[i % SEG.length] }} title={`${a.name} ${pctText(share(i))}`} />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {cashAccounts.map((a, i) => share(i) > 0 && (
                  <button key={a.id} type="button" onClick={() => setDetailId(a.id ?? null)} className="flex items-center gap-1.5 text-[12px] text-white/75 hover:text-white">
                    <span className="h-2 w-2 rounded-full" style={{ background: SEG[i % SEG.length] }} />
                    {a.name}{!hidden && <span className="font-semibold text-white tabular-nums">{pctText(share(i))}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nearest && (
            <button type="button" onClick={() => openHub(nearest.acc.id)} className="relative mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2 text-left hover:bg-white/15">
              <CreditCard size={16} className="shrink-0 text-white/70" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                <span className="font-semibold text-white">{nearest.acc.name}</span> · {hidden ? '••••' : short(nearest.cycle!.amountDue)} {nearest.cycle!.overdue ? 'lewat jatuh tempo' : 'jatuh tempo'} {dueText(nearest.cycle!.dueDate)}
              </span>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', nearest.cycle!.overdue || nearest.cycle!.daysUntilDue <= 5 ? 'bg-rose-500 text-white' : 'bg-white/15 text-white')}>
                {nearest.cycle!.overdue ? `lewat ${Math.abs(nearest.cycle!.daysUntilDue)} hr` : nearest.cycle!.daysUntilDue === 0 ? 'hari ini' : `${nearest.cycle!.daysUntilDue} hari`}
              </span>
            </button>
          )}
        </section>
      )}

      {showSecurityBanner && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-indigo-50/70 py-2 pl-3 pr-1.5 ring-1 ring-indigo-100">
          <ShieldCheck size={16} className="shrink-0 text-indigo-600" />
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-600">
            <span className="font-semibold text-slate-800">Tanpa akses ke bank.</span> Saldo di sini murni dari catatan yang kamu input sendiri.
          </p>
          <button onClick={dismissSecurityBanner} aria-label="Tutup" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Rekening kas */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Rekeningmu</h2>
          {cashAccounts.length > 1 && (
            <button type="button" onClick={() => setReordering((r) => !r)} className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold', reordering ? 'bg-slate-900 text-white' : 'text-indigo-600 hover:bg-indigo-50')}>
              <ArrowUpDown size={13} /> {reordering ? 'Selesai' : 'Atur urutan'}
            </button>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
        ) : cashAccounts.length === 0 ? (
          <div className="rounded-[20px] bg-white p-6 text-center ring-1 ring-slate-100">
            <p className="text-[15px] font-semibold text-slate-900">Belum ada rekening</p>
            <p className="mt-1 text-[13px] text-slate-500">Tambahkan bank, e-wallet, atau uang tunai pertamamu untuk mulai mencatat.</p>
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white">
              <Plus size={15} /> Tambah rekening
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
            {cashAccounts.map((acc, i) => {
              const v = TYPE_EMOJI[acc.type] ?? { emoji: '🏦', tile: 'bg-slate-100' };
              const bal = acc.balance || 0;
              const body = (
                <>
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[18px]', v.tile)}>
                    <LogoImage
                      src={acc.logoUrl}
                      alt={acc.name}
                      fallbackText={acc.name.substring(0, 3).toUpperCase()}
                      fallbackIcon={<span aria-hidden className={cn('flex h-full w-full items-center justify-center text-[18px]', v.tile)}>{v.emoji}</span>}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{acc.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-[12px] text-slate-500">
                      {share(i) > 0 && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEG[i % SEG.length] }} />}
                      {TYPE_LABEL[acc.type] ?? acc.type}{acc.currency && acc.currency !== 'IDR' ? ` · ${acc.currency}` : ''}
                      {share(i) > 0 && !hidden && ` · ${pctText(share(i))} kas`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('whitespace-nowrap text-[14px] font-bold tabular-nums', bal < 0 ? 'text-rose-600' : 'text-slate-900')}>{money(bal, acc.currency)}</p>
                    {acc.currency && acc.currency !== 'IDR' && !hidden && <p className="text-[11px] text-slate-400 tabular-nums">≈ {formatIDR(toIDR(bal, acc.currency))}</p>}
                  </div>
                </>
              );
              return (
                <li key={acc.id}>
                  {reordering ? (
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      {body}
                      <div className="flex flex-col">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${acc.name}`} className="rounded-lg p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronUp size={17} /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === cashAccounts.length - 1} aria-label={`Turunkan ${acc.name}`} className="rounded-lg p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronDown size={17} /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDetailId(acc.id ?? null)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                      {body}
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Kartu kredit — kartu mini */}
      {cardInfo.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Kartu kredit</h2>
            <button type="button" onClick={() => openHub(null)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50">
              Tagihan {hidden ? '••••' : short(cardsUsedIdr)} · Kelola <ChevronRight size={14} />
            </button>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
            {cardInfo.map(({ acc, usage, cycle }) => {
              const chip = cycle && cycle.amountDue > 0
                ? cycle.overdue
                  ? `Lewat ${Math.abs(cycle.daysUntilDue)} hari`
                  : `${dueText(cycle.dueDate)} · ${cycle.daysUntilDue === 0 ? 'hari ini' : `${cycle.daysUntilDue} hr lagi`}`
                : usage.used > 0 ? 'Belum ditagih' : 'Lunas';
              const urgent = cycle && cycle.amountDue > 0 && (cycle.overdue || cycle.daysUntilDue <= 5);
              const pct = usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => openHub(acc.id)}
                  className={cn(
                    'relative flex h-[136px] w-[78%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[20px] p-4 text-left text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.6)] transition-transform hover:-translate-y-0.5 sm:w-[300px] md:w-auto',
                    getCardGradientClass(acc.cardColor, acc.type)
                  )}
                >
                  <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/15" />
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15" />
                  <div className="relative flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/95">
                      <LogoImage
                        src={acc.logoUrl}
                        alt={acc.name}
                        fallbackText={acc.name.substring(0, 3).toUpperCase()}
                        fallbackIcon={<CreditCard size={14} className="text-slate-700" />}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{acc.name}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', urgent ? 'bg-white text-rose-600' : 'bg-white/20')}>{chip}</span>
                  </div>
                  <div className="relative">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">Terpakai</p>
                        <p className="truncate text-[18px] font-extrabold leading-tight tabular-nums">{money(usage.used, acc.currency)}</p>
                      </div>
                      {usage.limit > 0 && (
                        <p className="shrink-0 text-right text-[11px] text-white/75">sisa <span className="font-bold text-white tabular-nums">{hidden ? '••••' : short(usage.remaining)}</span></p>
                      )}
                    </div>
                    {usage.limit > 0 && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/25">
                        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-rose-300' : 'bg-white')} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Target tabungan — cincin progres */}
      {goalsWithTarget.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Target</h2>
            <Link href="/membership/tabungan" className="text-[12px] font-bold text-indigo-600 hover:underline">Lihat semua</Link>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {goalsWithTarget.slice(0, 6).map((g, i) => {
              const pct = Math.max(0, Math.min(100, g.progressPercent ?? (g.currentTotal / (g.targetAmount || 1)) * 100));
              const color = SEG[i % SEG.length];
              return (
                <li key={g.id}>
                  <Link href="/membership/tabungan" className="flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-2.5 ring-1 ring-slate-100 hover:bg-slate-50">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
                        <circle cx="22" cy="22" r="19" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        <circle cx="22" cy="22" r="19" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 119.4} 119.4`} />
                      </svg>
                      <span className="text-[11px] font-bold tabular-nums text-slate-700">{Math.round(pct)}%</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{g.name}</p>
                      <p className="text-[12px] text-slate-500 tabular-nums">{hidden ? '••••' : `${short(g.currentTotal)} dari ${short(g.targetAmount || 0)}`}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hub && (
        <CreditCardHub
          key={hub.n}
          open
          accounts={accounts}
          transactions={transactions}
          hidden={hidden}
          totalIdr={cardsUsedIdr}
          initialId={hub.id}
          onClose={() => setHub(undefined)}
          onEdit={(a) => { setHub(undefined); setCardForm(a); }}
          onAdd={() => { setHub(undefined); setCardForm(null); }}
        />
      )}

      <AccountDetail
        account={accounts.find((a) => a.id === detailId) ?? null}
        transactions={transactions}
        hidden={hidden}
        deleting={deletingId === detailId}
        onClose={() => setDetailId(null)}
        onEdit={(a) => { setDetailId(null); openEdit(a); }}
        onDelete={(a) => void handleDelete(a)}
      />

      {uid && (
        <CreditCardForm
          isOpen={cardForm !== undefined}
          onClose={() => setCardForm(undefined)}
          userId={uid}
          initialData={cardForm ?? null}
        />
      )}

      {uid && (
        <AccountModal
          userId={uid}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingAccount(null); }}
          initialData={editingAccount}
          onCreditCard={() => { setIsModalOpen(false); setCardForm(null); }}
          existingTypes={Array.from(new Set(accounts.map((a) => a.type).filter(Boolean)))}
        />
      )}
    </div>
  );
}
