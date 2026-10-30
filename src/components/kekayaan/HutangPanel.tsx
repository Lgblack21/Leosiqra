"use client";

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, Plus, Scale, Search, Trash2 } from 'lucide-react';
import { useModal } from '@/context/ModalContext';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { NumberInput } from '@/components/ui/NumberInput';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { accountService, Account } from '@/lib/services/accountService';
import { updateMemberTotals } from '@/lib/services/userService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useFeedback } from '@/components/ui/Feedback';

const STATUS_OPTIONS = ['Belum lunas', 'Lunas', 'Semua'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

// Panel Hutang & Piutang di halaman Kekayaan (#hutang; dulu /membership/transactions/debt).
// Tampilan kartu (2026-10-30): neraca hutang vs piutang + progres pelunasan.
// Logika uang (cicilan, lunas, hapus) tidak berubah.
export default function HutangPanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  // Default "Belum lunas" = semua catatan yang masih punya sisa, dari bulan
  // mana pun. Dulu halaman ini cuma memuat catatan yang DIBUAT di bulan
  // terpilih, jadi hutang bulan lalu yang belum lunas tidak kelihatan dan
  // user harus mundur bulan dulu untuk membayarnya.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Belum lunas');
  const { confirm, toast } = useFeedback();
  const { openModal } = useModal();
  const reduce = useReducedMotion();
  const [typeFilter, setTypeFilter] = useState<'Semua' | 'Hutang' | 'Piutang'>('Semua');

  // Cicilan/pelunasan (transaksi pemasukan/pengeluaran yang terhubung ke
  // catatan hutang/piutang via relatedId) — diambil all-time (bukan per bulan
  // seperti `transactions` di atas) supaya sisa tagihan tetap akurat walau
  // pembayarannya terjadi di bulan yang berbeda dari saat hutang dicatat.
  const [debtPayments, setDebtPayments] = useState<Transaction[]>([]);
  const [payingDebt, setPayingDebt] = useState<Transaction | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payingLoading, setPayingLoading] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubPaymentsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('type', '==', 'debt'),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Transaction;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });

        const qPayments = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('relatedType', '==', 'debt')
        );
        if (unsubPaymentsRef.current) unsubPaymentsRef.current();
        unsubPaymentsRef.current = onSnapshot(qPayments, (snap) => {
          setDebtPayments(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Transaction;
          }));
        }, (err) => console.error(err));
      } else {
        setTransactions([]);
        setAccounts([]);
        setDebtPayments([]);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
      if (unsubAccRef.current) unsubAccRef.current();
      if (unsubPaymentsRef.current) unsubPaymentsRef.current();
    };
  }, []);

  // Total sudah dibayar per catatan hutang/piutang (dikelompokkan lewat relatedId).
  const paidByDebtId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of debtPayments) {
      if (!p.relatedId) continue;
      map.set(p.relatedId, (map.get(p.relatedId) || 0) + (Number(p.amount) || 0));
    }
    return map;
  }, [debtPayments]);

  const getRemaining = (trx: Transaction) => {
    if (trx.paymentStatus === 'lunas' || !trx.id) return 0;
    const paid = paidByDebtId.get(trx.id) || 0;
    return Math.max(0, trx.amount - paid);
  };

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  const inSelectedMonth = (t: Transaction) =>
    t.date.getMonth() === selectedMonth && t.date.getFullYear() === selectedYear;

  const filtered = useMemo(() => {
    const byStatus = transactions.filter((t) => {
      if (statusFilter === 'Belum lunas') return getRemaining(t) > 0;
      if (statusFilter === 'Lunas') return getRemaining(t) <= 0 && inSelectedMonth(t);
      return inSelectedMonth(t);
    });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(t =>
      (t.note || '').toLowerCase().includes(q) ||
      (t.lenderName || '').toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, searchQuery, statusFilter, selectedMonth, selectedYear, paidByDebtId]);

  // Ringkasan digabung lintas rekening, jadi pakai amountIDR (sudah
  // dikonversi saat transaksi disimpan), bukan .amount mentah.
  // SISA yang belum dibayar (setelah cicilan), lintas semua bulan, dalam IDR.
  // Sisa dihitung di mata uang asli catatan lalu dikonversi pakai rasio
  // amountIDR/amount yang tersimpan saat catatan dibuat.
  const remainingIdr = (t: Transaction) => {
    const remaining = getRemaining(t);
    if (remaining <= 0) return 0;
    const ratio = t.amount > 0 && Number(t.amountIDR) > 0 ? Number(t.amountIDR) / t.amount : 1;
    return remaining * ratio;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totalHutang = useMemo(() => transactions.filter(t => t.category === 'Hutang').reduce((s, t) => s + remainingIdr(t), 0), [transactions, paidByDebtId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totalPiutang = useMemo(() => transactions.filter(t => t.category === 'Piutang').reduce((s, t) => s + remainingIdr(t), 0), [transactions, paidByDebtId]);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace('Rp', '').trim();
  const formatAmount = (n: number, currency: string | undefined) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency || 'IDR', minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency || ''} ${formatRp(n)}`.trim();
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  // Melunasi SISA tagihan (bukan nominal awal) — kalau sudah ada cicilan
  // sebelumnya, cuma sisanya yang perlu dilunasi sekarang.
  const handleMarkLunas = async (trx: Transaction) => {
    if (!trx.id || !user || settlingId) return;
    const remaining = getRemaining(trx);
    if (remaining <= 0) return;
    const ok = await confirm({
      title: `Tandai ${trx.category.toLowerCase()} ini lunas?`,
      message: `Sisa ${formatAmount(remaining, trx.currency)} dicatat sebagai transaksi baru dan saldo rekening disesuaikan.`,
      confirmLabel: 'Tandai lunas',
    });
    if (!ok) return;
    setError('');
    setSettlingId(trx.id);
    try {
      const isHutang = trx.category === 'Hutang';
      const financeType = isHutang ? 'pengeluaran' : 'pemasukan';

      // 1. Update debt record to lunas
      await transactionService.updateTransaction(trx.id, { status: 'VERIFIED', paymentStatus: 'lunas' });

      // 2. Create financial transaction entry
      await transactionService.createTransaction({
        userId: trx.userId,
        type: financeType,
        amount: remaining,
        currency: trx.currency || 'IDR',
        category: trx.category,
        subCategory: `${trx.category} Lunas`,
        accountId: trx.accountId,
        date: new Date(),
        displayDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        note: `[Lunas] ${trx.category} ${trx.lenderName ? `ke/dari ${trx.lenderName}` : ''} - ${trx.note || ''}`.trim(),
        status: 'VERIFIED',
        relatedId: trx.id,
        relatedType: 'debt'
      });

      // 3. Sync balance
      await updateMemberTotals(user.uid, financeType, remaining);
      if (trx.accountId && trx.accountId !== 'General') {
        const balanceChange = financeType === 'pemasukan' ? remaining : -remaining;
        await accountService.updateAccountBalance(trx.accountId, balanceChange);
      }
      toast.success(`${trx.category} ${trx.lenderName ? `${trx.lenderName} ` : ''}ditandai lunas.`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menandai lunas. Silakan coba lagi.');
    } finally {
      setSettlingId(null);
    }
  };

  // Bayar sebagian (cicilan) — dicatat sebagai transaksi terhubung (relatedId)
  // ke catatan hutang/piutangnya, supaya sisa tagihan bisa dihitung akumulatif.
  // Begitu totalnya mencapai/melebihi nominal awal, otomatis ditandai Lunas.
  const handlePartialPayment = async () => {
    if (!payingDebt?.id || !user) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    setError('');
    setPayingLoading(true);
    try {
      const trx = payingDebt;
      const trxId = trx.id;
      if (!trxId) return;
      const isHutang = trx.category === 'Hutang';
      const financeType = isHutang ? 'pengeluaran' : 'pemasukan';
      const remaining = getRemaining(trx);
      const paidNow = Math.min(amount, remaining);

      await transactionService.createTransaction({
        userId: trx.userId,
        type: financeType,
        amount: paidNow,
        currency: trx.currency || 'IDR',
        category: trx.category,
        subCategory: `${trx.category} Cicilan`,
        accountId: trx.accountId,
        date: new Date(),
        displayDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        note: `[Cicilan] ${trx.category} ${trx.lenderName ? `ke/dari ${trx.lenderName}` : ''} - ${trx.note || ''}`.trim(),
        status: 'VERIFIED',
        relatedId: trxId,
        relatedType: 'debt'
      });

      await updateMemberTotals(user.uid, financeType, paidNow);
      if (trx.accountId && trx.accountId !== 'General') {
        const balanceChange = financeType === 'pemasukan' ? paidNow : -paidNow;
        await accountService.updateAccountBalance(trx.accountId, balanceChange);
      }

      // Sisa setelah cicilan ini <= 0 berarti lunas.
      if (remaining - paidNow <= 0) {
        await transactionService.updateTransaction(trxId, { status: 'VERIFIED', paymentStatus: 'lunas' });
      }

      setPayingDebt(null);
      setPayAmount('');
      toast.success(
        remaining - paidNow <= 0
          ? `Cicilan ${formatAmount(paidNow, trx.currency)} tersimpan — ${trx.category.toLowerCase()} ini lunas.`
          : `Cicilan ${formatAmount(paidNow, trx.currency)} tersimpan. Sisa ${formatAmount(remaining - paidNow, trx.currency)}.`
      );
    } catch (e) {
      console.error(e);
      toast.error('Gagal mencatat cicilan. Silakan coba lagi.');
    } finally {
      setPayingLoading(false);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return;
    const ok = await confirm({
      title: 'Hapus catatan hutang/piutang ini?',
      message: 'Catatan cicilan/pelunasan yang sudah tercatat tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    setError('');
    setDeletingId(tx.id);
    try {
      await transactionService.deleteTransaction(tx);
      toast.success('Catatan dihapus.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus catatan. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth));
  const shown = typeFilter === 'Semua' ? filtered : filtered.filter((t) => t.category === typeFilter);
  // Progres pelunasan semua catatan yang masih berjalan (dalam IDR).
  const openDebts = transactions.filter((t) => getRemaining(t) > 0);
  const ratioOf = (t: Transaction) => (t.amount > 0 && Number(t.amountIDR) > 0 ? Number(t.amountIDR) / t.amount : 1);
  const openOriginal = (cat: string) => openDebts.filter((t) => t.category === cat).reduce((s, t) => s + t.amount * ratioOf(t), 0);
  const paidPct = (remaining: number, original: number) => (original > 0 ? Math.max(0, Math.min(100, ((original - remaining) / original) * 100)) : 0);
  const net = totalPiutang - totalHutang;
  const counts = { Semua: filtered.length, Hutang: filtered.filter((t) => t.category === 'Hutang').length, Piutang: filtered.filter((t) => t.category === 'Piutang').length };
  const pay = payingDebt ? { remaining: getRemaining(payingDebt), isHutang: payingDebt.category === 'Hutang' } : null;
  const payNum = parseFloat(payAmount) || 0;

  return (
    <div className="mb-12 max-w-[1400px] space-y-5">
      {/* Neraca hutang vs piutang */}
      <section className="relative overflow-hidden rounded-[32px] bg-[#0b1220] p-5 text-white md:p-7">
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">Hutang & Piutang</h2>
            <p className="text-[13px] text-white/60">Yang harus kamu bayar dan yang masih ditagih ke orang lain.</p>
          </div>
          <button type="button" onClick={() => openModal('hutang_piutang')} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-900 hover:bg-white/90">
            <Plus size={15} strokeWidth={2.6} /> Catat baru
          </button>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-[1fr_auto_1fr] md:items-stretch md:gap-3">
          {([
            { cat: 'Hutang', label: 'Harus kamu bayar', total: totalHutang, n: openDebts.filter((t) => t.category === 'Hutang').length, color: 'text-rose-300', bar: 'bg-rose-400', icon: ArrowUpRight },
            null,
            { cat: 'Piutang', label: 'Masih ditagih', total: totalPiutang, n: openDebts.filter((t) => t.category === 'Piutang').length, color: 'text-emerald-300', bar: 'bg-emerald-400', icon: ArrowDownLeft },
          ] as const).map((b, i) => b === null ? (
            <div key="net" className="order-last col-span-2 flex flex-row items-center justify-center gap-2 rounded-2xl px-3 py-1 md:order-none md:col-span-1 md:flex-col md:py-0">
              <Scale size={18} className="text-white/40" />
              <span className="text-center">
                <span className="block text-[11px] text-white/50">Selisih</span>
                <span className={cn('block text-[15px] font-extrabold tabular-nums', net >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{net >= 0 ? '+' : '−'}Rp {formatRp(Math.abs(net))}</span>
              </span>
            </div>
          ) : (
            <button key={b.cat} type="button" onClick={() => setTypeFilter(typeFilter === b.cat ? 'Semua' : b.cat)} aria-pressed={typeFilter === b.cat} className={cn('min-w-0 rounded-[22px] bg-white/[0.06] p-3.5 text-left ring-1 transition hover:bg-white/10 md:p-4', typeFilter === b.cat ? 'ring-white/60' : 'ring-white/10')}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/60"><b.icon size={14} className={b.color} /> {b.cat}<span className="hidden md:inline"> · {b.label}</span></p>
              <p key={b.total} className={cn('mt-1 truncate text-[19px] font-extrabold tabular-nums md:text-[30px]', b.color)}>Rp {formatRp(b.total)}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${paidPct(b.total, openOriginal(b.cat))}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className={cn('h-full rounded-full', b.bar)} />
              </div>
              <p className="mt-1.5 text-[11px] text-white/50">{b.n === 0 ? 'Tidak ada yang berjalan' : `${b.n} catatan · ${Math.round(paidPct(b.total, openOriginal(b.cat)))}% sudah ${b.cat === 'Hutang' ? 'dibayar' : 'kembali'}`}</p>
            </button>
          ))}
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600">{error}</div>}

      {/* Saring */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <LayoutGroup id="debt-type">
          <div role="tablist" aria-label="Jenis" className="flex shrink-0 gap-1 rounded-full bg-slate-100 p-1">
            {(['Semua', 'Hutang', 'Piutang'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={typeFilter === t} onClick={() => setTypeFilter(t)} className={cn('relative flex-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold md:flex-none', typeFilter === t ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                {typeFilter === t && <motion.span layoutId={reduce ? undefined : 'debt-type-pill'} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{t} <span className="text-[11px] text-slate-400">{counts[t]}</span></span>
              </button>
            ))}
          </div>
        </LayoutGroup>
        <SegmentedControl ariaLabel="Filter status pelunasan" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} className="shrink-0 self-start md:self-auto" />
        {statusFilter !== 'Belum lunas' && (
          <MonthPicker value={{ month: selectedMonth, year: selectedYear }} onChange={({ month, year }) => { setSelectedMonth(month); setSelectedYear(year); }} />
        )}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama atau catatan…" className="w-full rounded-full bg-white py-2.5 pl-10 pr-4 text-[14px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
      </div>
      <p className="px-1 text-[12px] text-slate-500">{statusFilter === 'Belum lunas' ? 'Semua yang belum lunas, dari bulan mana pun' : `Periode ${periodLabel}`}</p>

      {/* Daftar */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 animate-pulse rounded-[26px] bg-white" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-[26px] bg-white p-8 ring-1 ring-slate-100">
          <EmptyState
            title={statusFilter === 'Belum lunas' ? 'Tidak ada yang belum lunas 🎉' : 'Belum ada catatan di bulan ini'}
            description={statusFilter === 'Belum lunas' ? 'Semua hutang dan piutang sudah beres.' : 'Ganti bulan atau pilih filter lain.'}
            icon={<Banknote size={24} />}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {shown.map((trx, i) => {
              const isHutang = trx.category === 'Hutang';
              const remaining = getRemaining(trx);
              const lunas = remaining <= 0;
              const pct = lunas ? 100 : paidPct(remaining, trx.amount);
              const who = trx.lenderName || trx.note || trx.category;
              return (
                <motion.article
                  key={trx.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
                  className={cn('relative flex flex-col overflow-hidden rounded-[26px] bg-white p-4 ring-1 md:p-5', lunas ? 'ring-emerald-100' : 'ring-slate-100')}
                >
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', isHutang ? 'bg-rose-400' : 'bg-emerald-400')} />
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[16px] font-extrabold', isHutang ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>{who.trim()[0]?.toUpperCase() ?? '?'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-bold text-slate-900">{who}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={cn('rounded-full px-2 py-0.5 font-bold', isHutang ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700')}>{isHutang ? 'Kamu berhutang' : 'Kamu meminjamkan'}</span>
                        {trx.subCategory && trx.subCategory !== trx.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{trx.subCategory}</span>}
                        {trx.currency && trx.currency !== 'IDR' && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{trx.currency}</span>}
                      </div>
                    </div>
                    {lunas ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={13} /> Lunas</span>
                    ) : (
                      <button type="button" onClick={() => trx.id && handleDelete(trx)} disabled={deletingId === trx.id} aria-label={`Hapus catatan ${who}`} className="shrink-0 rounded-full p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={15} /></button>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-slate-500">{lunas ? 'Total' : 'Sisa'}</p>
                      <p className={cn('text-[24px] font-extrabold leading-tight tabular-nums', lunas ? 'text-slate-400 line-through decoration-2' : isHutang ? 'text-rose-600' : 'text-emerald-600')}>{formatAmount(lunas ? trx.amount : remaining, trx.currency)}</p>
                    </div>
                    {!lunas && remaining < trx.amount && <p className="text-right text-[12px] text-slate-500">dari {formatAmount(trx.amount, trx.currency)}</p>}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} className={cn('h-full rounded-full', lunas ? 'bg-emerald-400' : isHutang ? 'bg-rose-400' : 'bg-emerald-400')} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">{lunas ? 'Sudah beres' : pct > 0 ? `${Math.floor(pct)}% sudah ${isHutang ? 'dibayar' : 'kembali'}` : `Belum ada ${isHutang ? 'pembayaran' : 'yang kembali'}`}</p>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl bg-slate-50 p-3 text-[12px]">
                    <div><dt className="text-slate-400">Sejak</dt><dd className="font-semibold text-slate-700">{formatDate(trx.date)}</dd></div>
                    <div><dt className="text-slate-400">Rekening</dt><dd className="truncate font-semibold text-slate-700">{getAccountName(trx.accountId || '')}</dd></div>
                    {trx.installmentTenor ? <div><dt className="text-slate-400">Cicilan</dt><dd className="font-semibold text-slate-700">≈ {formatAmount((trx.totalDebt || trx.amount) / trx.installmentTenor, trx.currency)}/bln · {trx.installmentTenor} bln</dd></div> : null}
                    {trx.totalInterest ? <div><dt className="text-slate-400">Total bunga</dt><dd className="font-semibold text-slate-700">{formatAmount(trx.totalInterest, trx.currency)}</dd></div> : null}
                    {trx.lenderName && trx.note && trx.note !== trx.lenderName ? <div className="col-span-2"><dt className="text-slate-400">Catatan</dt><dd className="font-semibold text-slate-700">{trx.note}</dd></div> : null}
                  </dl>

                  {!lunas ? (
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => { setPayingDebt(trx); setPayAmount(''); }} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold text-white', isHutang ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700')}>
                        <Banknote size={15} /> {isHutang ? 'Bayar cicilan' : 'Terima cicilan'}
                      </button>
                      <button type="button" onClick={() => handleMarkLunas(trx)} disabled={settlingId === trx.id} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                        <CheckCircle2 size={15} /> {settlingId === trx.id ? 'Menyimpan…' : 'Lunas'}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => trx.id && handleDelete(trx)} disabled={deletingId === trx.id} className="mt-3 self-start text-[12px] font-semibold text-slate-400 hover:text-rose-600 disabled:opacity-50">Hapus catatan</button>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      {!loading && shown.length > 0 && <p className="px-1 text-[12px] text-slate-400">Menampilkan {shown.length} catatan · {statusFilter === 'Belum lunas' ? 'semua bulan' : periodLabel}</p>}

      <Modal
        isOpen={!!payingDebt}
        onClose={() => { setPayingDebt(null); setPayAmount(''); }}
        title={pay?.isHutang === false ? 'Terima cicilan' : 'Bayar cicilan'}
        maxWidth="max-w-sm"
      >
        {payingDebt && pay && (
          <div className="space-y-4">
            <div className={cn('rounded-2xl p-4', pay.isHutang ? 'bg-rose-50' : 'bg-emerald-50')}>
              <p className="text-[14px] font-bold text-slate-900">{payingDebt.lenderName || payingDebt.note || payingDebt.category}</p>
              <p className="mt-0.5 text-[12px] text-slate-600">Sisa {formatAmount(pay.remaining, payingDebt.currency)} dari {formatAmount(payingDebt.amount, payingDebt.currency)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-slate-300" style={{ width: `${paidPct(pay.remaining, payingDebt.amount)}%` }}>
                </div>
              </div>
              {payNum > 0 && (
                <p className="mt-1.5 text-[12px] font-semibold text-slate-700">
                  Setelah ini: {payNum >= pay.remaining ? 'lunas ✓' : `sisa ${formatAmount(pay.remaining - payNum, payingDebt.currency)}`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="pl-1 text-[12px] font-semibold text-slate-500">{pay.isHutang ? 'Dibayar sekarang' : 'Diterima sekarang'}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{payingDebt.currency || 'Rp'}</span>
                <NumberInput value={payAmount} onChange={setPayAmount} placeholder="0" className="w-full rounded-xl border-none bg-slate-50 py-3.5 pl-14 pr-4 text-sm font-bold text-slate-700 transition-all focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="flex gap-1.5">
                {[0.25, 0.5, 1].map((f) => (
                  <button key={f} type="button" onClick={() => setPayAmount(String(Math.round(pay.remaining * f)))} className="flex-1 rounded-full bg-slate-100 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">{f === 1 ? 'Semua sisa' : `${f * 100}%`}</button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handlePartialPayment}
              disabled={payingLoading || !payAmount || payNum <= 0}
              className="w-full rounded-full bg-slate-900 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:bg-slate-300"
            >
              {payingLoading ? 'Menyimpan…' : pay.isHutang ? 'Simpan pembayaran' : 'Simpan penerimaan'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
