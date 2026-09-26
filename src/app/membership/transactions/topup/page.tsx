"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Trash2,
  ArrowLeftRight,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { formatIDR, formatMoney } from '@/lib/utils';
import { useModal } from '@/context/ModalContext';
import { useFeedback } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';

export default function TopUpPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          const list = snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Transaction;
          })
          // Filter: hanya tampilkan sisi "keluar" dari transfer/topup untuk
          // menghindari duplikasi — sisi "Keluar" & "Masuk" transfer internal
          // sama-sama tersimpan dengan type "transfer" (lihat TopUpModal), jadi
          // exclude eksplisit dari subCategory-nya "Masuk", bukan cuma dari type.
          .filter(t =>
            (t.category === 'Top Up' || t.category === 'Transfer') &&
            (t.type === 'pengeluaran' || t.type === 'topup' || t.type === 'transfer') &&
            !t.subCategory?.includes('Masuk')
          );
          setTransactions(list);
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else {
        setTransactions([]);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
      if (unsubAccRef.current) unsubAccRef.current();
    };
  }, [selectedMonth, selectedYear]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(t =>
      (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  // Ringkasan digabung lintas rekening, jadi pakai amountIDR (sudah
  // dikonversi saat transaksi disimpan), bukan .amount mentah.
  const totalAmount = useMemo(() => transactions.reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0), [transactions]);
  const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return;
    // Backend menghapus kedua sisi transfer internal (Keluar & Masuk) dan
    // membalikkan saldo keduanya dalam satu batch. Top Up ke wallet eksternal
    // tersimpan sebagai pengeluaran biasa — cuma saldo sumber yang kembali.
    const isInternal = tx.type === 'transfer' || tx.type === 'topup';
    const ok = await confirm({
      title: 'Hapus transfer ini?',
      message: isInternal
        ? `${getAccountName(tx.accountId || '')} dan ${getAccountName(tx.targetAccountId || '')} akan kembali ke saldo sebelum transfer ini. Tindakan ini tidak bisa dibatalkan.`
        : `Saldo ${getAccountName(tx.accountId || '')} akan dikembalikan. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(tx.id);
    try {
      await transactionService.deleteTransaction(tx);
      toast.success('Transfer dihapus dan saldo dikembalikan.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth));

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1400px] pb-12">
      <PageHeader
        icon={<ArrowLeftRight size={22} />}
        title="Transfer & Top Up"
        subtitle={`Perpindahan dana antar rekening sendiri · ${periodLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker
              value={{ month: selectedMonth, year: selectedYear }}
              onChange={({ month, year }) => {
                setSelectedMonth(month);
                setSelectedYear(year);
              }}
            />
            <button
              onClick={() => openModal('topup_transfer')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-control text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Transfer baru
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <StatCard
          label="Total Dipindahkan"
          icon={<ArrowLeftRight size={12} className="text-indigo-500" />}
          value={formatIDR(totalAmount)}
          loading={loading}
          caption={`${transactions.length} transfer`}
        />
        <StatCard
          label="Rata-rata per Transfer"
          icon={<ArrowLeftRight size={12} className="text-slate-500" />}
          value={formatIDR(avgAmount)}
          loading={loading}
          caption="Periode ini"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100">
          <div className="relative w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari catatan transfer..."
              aria-label="Cari transfer"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-control text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-5 md:p-8">
            {searchQuery ? (
              <EmptyState title="Tidak ada yang cocok" description="Coba kata kunci lain." icon={<Search size={24} />} />
            ) : (
              <EmptyState
                title="Belum ada transfer di periode ini"
                description="Klik “Transfer baru” untuk mencatat top up e-wallet atau pindah dana antar rekening."
                icon={<ArrowLeftRight size={24} />}
              />
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((trx) => (
              <li key={trx.id} className="group px-4 md:px-6 py-3.5 flex items-center gap-3 md:gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="hidden sm:block w-24 shrink-0">
                  <p className="text-sm font-bold text-slate-900">{formatDate(trx.date)}</p>
                  <p className="text-caption text-slate-400">{formatTime(trx.createdAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 min-w-0">
                    <span className="truncate">{getAccountName(trx.accountId || '')}</span>
                    <ArrowRight size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{getAccountName(trx.targetAccountId || '')}</span>
                  </div>
                  <p className="text-caption text-slate-400 truncate">
                    <span className="sm:hidden">{formatDate(trx.date)} · </span>
                    {trx.category}{trx.note ? ` · ${trx.note}` : ''}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">{formatMoney(trx.amount, trx.currency)}</p>
                <button
                  onClick={() => handleDelete(trx)}
                  disabled={deletingId === trx.id}
                  aria-label="Hapus riwayat transfer"
                  className="p-2 -mr-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
