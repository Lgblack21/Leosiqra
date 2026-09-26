"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ListOrdered,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { Account } from '@/lib/services/accountService';
import type { Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { cn, isIncomingTransaction, formatIDR, formatMoney } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DailyTransactionLogPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { toast, confirm } = useFeedback();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubCatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Fetch accounts for lookup & Saldo Bersih (total saldo semua rekening saat ini)
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, balance: Number(d.balance) || 0 } as Account;
          }));
        });

        // Fetch categories for lookup
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        if (unsubCatRef.current) unsubCatRef.current();
        unsubCatRef.current = onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        });

        const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('date', '>=', startOfDay),
          where('date', '<=', endOfDay),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          // Catatan Hutang/Piutang (type "debt") bukan arus kas — bahkan yang
          // sudah "lunas" punya baris pemasukan/pengeluaran TERPISAH yang
          // dibuat DebtModal untuk dampak kasnya. Ikut menampilkan baris
          // "debt" itu sendiri di sini bikin kelihatan seperti transaksi
          // dobel (mis. "beli motor" + catatan cicilan motor yang sama,
          // sama-sama nongol merah minus padahal cuma satu yang benar-benar
          // memotong saldo). Halaman Hutang & Piutang sudah menampilkan baris
          // ini dengan benar (tanpa tanda +/- yang menyesatkan).
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Transaction;
          }).filter(t => t.type !== 'debt'));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else {
        setTransactions([]);
        setAccounts([]);
        setCategories([]);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
      if (unsubAccRef.current) unsubAccRef.current();
      if (unsubCatRef.current) unsubCatRef.current();
    };
  }, [selectedDate]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '-';
  };

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return;
    const ok = await confirm({
      title: 'Hapus transaksi ini?',
      // Sesuai handleDeleteTransaction di worker: pemasukan/pengeluaran &
      // transfer dibalikkan saldonya; transfer ikut menghapus sisi pasangannya.
      message: tx.type === 'transfer' || tx.type === 'topup'
        ? 'Kedua sisi transfer (keluar & masuk) ikut dihapus dan saldo kedua rekening dikembalikan. Tindakan ini tidak bisa dibatalkan.'
        : tx.type === 'pemasukan' || tx.type === 'pengeluaran'
          ? 'Saldo rekening terkait akan dikembalikan. Tindakan ini tidak bisa dibatalkan.'
          : 'Catatan ini dihapus tanpa mengubah saldo rekening. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(tx.id);
    try {
      await transactionService.deleteTransaction(tx);
      toast.success('Transaksi dihapus.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(t =>
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.note || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  // Ringkasan bulanan digabung lintas rekening, jadi pakai amountIDR
  // (sudah dikonversi saat transaksi disimpan), bukan .amount mentah.
  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0), [transactions]);

  // Saldo Bersih = total saldo semua rekening saat ini (bukan net arus kas
  // periode yang dipilih) — sama seperti "Total Saldo" di halaman Profile,
  // jadi tidak berubah walau ganti bulan di MonthPicker.
  const saldoBersih = useMemo(
    () => accounts.reduce((s, a) => s + exchangeRateService.convert(a.balance || 0, a.currency || 'IDR', 'IDR', fxRates), 0),
    [accounts, fxRates]
  );

  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
  const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate);

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1400px] pb-12">
      <PageHeader
        icon={<ListOrdered size={22} />}
        title="Riwayat Transaksi"
        subtitle={`Transaksi pada ${dateLabel}`}
        actions={<DatePicker value={selectedDate} onChange={setSelectedDate} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatCard
          label="Pemasukan"
          icon={<TrendingUp size={12} className="text-emerald-500" />}
          value={formatIDR(totalPemasukan)}
          valueClassName="text-emerald-600"
          loading={loading}
          caption={`${transactions.filter(t => t.type === 'pemasukan').length} transaksi`}
        />
        <StatCard
          label="Pengeluaran"
          icon={<TrendingDown size={12} className="text-rose-500" />}
          value={formatIDR(totalPengeluaran)}
          valueClassName="text-rose-500"
          loading={loading}
          caption={`${transactions.filter(t => t.type === 'pengeluaran').length} transaksi`}
        />
        <StatCard
          label="Saldo Bersih"
          icon={<Wallet size={12} className="text-slate-500" />}
          value={formatIDR(saldoBersih)}
          valueClassName={saldoBersih < 0 ? 'text-rose-500' : undefined}
          loading={loading}
          caption="Total saldo semua rekening saat ini"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari kategori atau catatan..."
              aria-label="Cari transaksi"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-control text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>
          {!loading && transactions.length > 0 && (
            <p className="text-caption text-slate-400">
              {filtered.length === transactions.length ? `${transactions.length} transaksi` : `${filtered.length} dari ${transactions.length} transaksi`}
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-5 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-5 md:p-8">
            {searchQuery ? (
              <EmptyState title="Tidak ada yang cocok" description="Coba kata kunci lain." icon={<Search size={24} />} />
            ) : (
              <EmptyState
                title="Belum ada transaksi di tanggal ini"
                description="Pilih tanggal lain, atau catat transaksi baru lewat tombol Tambah Cepat di kanan atas."
                icon={<ListOrdered size={24} />}
              />
            )}
          </div>
        ) : (
          <>
            {/* Mobile: list */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filtered.map((trx) => {
                const incoming = isIncomingTransaction(trx);
                return (
                  <li key={trx.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{trx.note || trx.subCategory || getCategoryName(trx.category || '')}</p>
                      <p className="text-caption text-slate-400 truncate">
                        {formatTime(trx.createdAt)} · {trx.subCategory || getCategoryName(trx.category || '')} · {getAccountName(trx.accountId || '')}
                      </p>
                    </div>
                    <p className={cn('text-sm font-black tabular-nums whitespace-nowrap', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                      {incoming ? '+' : '−'}{formatMoney(trx.amount, trx.currency)}
                    </p>
                    <button
                      onClick={() => handleDelete(trx)}
                      disabled={deletingId === trx.id}
                      aria-label="Hapus transaksi"
                      className="p-2 -mr-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: tabel */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/70">
                    <th className="px-5 py-3 text-label font-bold uppercase text-slate-400 whitespace-nowrap">Waktu</th>
                    <th className="px-5 py-3 text-label font-bold uppercase text-slate-400">Catatan</th>
                    <th className="px-5 py-3 text-label font-bold uppercase text-slate-400 whitespace-nowrap">Kategori</th>
                    <th className="px-5 py-3 text-label font-bold uppercase text-slate-400 whitespace-nowrap">Rekening</th>
                    <th className="px-5 py-3 text-label font-bold uppercase text-slate-400 text-right whitespace-nowrap">Nominal</th>
                    <th className="px-5 py-3 w-12"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((trx) => {
                    const incoming = isIncomingTransaction(trx);
                    return (
                      <tr key={trx.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{formatTime(trx.createdAt)}</p>
                          <p className="text-caption text-slate-400">{formatDate(trx.date)}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 max-w-[320px] truncate">{trx.note || '—'}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{trx.subCategory || getCategoryName(trx.category || '')}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{getAccountName(trx.accountId || '')}</td>
                        <td className={cn('px-5 py-3.5 text-right font-black tabular-nums whitespace-nowrap', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                          {incoming ? '+' : '−'}{formatMoney(trx.amount, trx.currency)}
                          {trx.currency && trx.currency !== 'IDR' && (
                            <Badge className="ml-2 align-middle">{trx.currency}</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(trx)}
                            disabled={deletingId === trx.id}
                            aria-label="Hapus transaksi"
                            className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
