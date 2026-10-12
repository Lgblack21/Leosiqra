"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Trash2, ListOrdered, Download, Plus, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { Account } from '@/lib/services/accountService';
import type { Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn, isIncomingTransaction, formatIDR, formatMoney } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { useModal } from '@/context/ModalContext';
import { Skeleton } from '@/components/ui/Skeleton';

// Riwayat transaksi gaya baru: pilih periode (atau satu tanggal), saring per
// jenis/kategori/rekening, cari, lalu daftar dikelompokkan per hari. Data
// tetap realtime dari koleksi transactions; hapus membalik saldo seperti dulu.

type Period = 'bulan' | '30' | '90' | 'tahun' | 'semua' | 'hari';
type Kind = 'semua' | 'pengeluaran' | 'pemasukan' | 'transfer';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'bulan', label: 'Bulan ini' },
  { id: '30', label: '30 hari' },
  { id: '90', label: '90 hari' },
  { id: 'tahun', label: 'Tahun ini' },
  { id: 'semua', label: 'Semua waktu' },
];
const KINDS: { id: Kind; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'pengeluaran', label: 'Pengeluaran' },
  { id: 'pemasukan', label: 'Pemasukan' },
  { id: 'transfer', label: 'Transfer' },
];
const PAGE = 150;

const rangeOf = (period: Period, day: Date): { start?: Date; end?: Date } => {
  const now = new Date();
  if (period === 'hari') return { start: new Date(day.getFullYear(), day.getMonth(), day.getDate()), end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999) };
  if (period === 'bulan') return { start: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (period === '30') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) };
  if (period === '90') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89) };
  if (period === 'tahun') return { start: new Date(now.getFullYear(), 0, 1) };
  return {};
};

const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const isTransfer = (t: Transaction) => t.type === 'transfer' || t.type === 'topup';
// Sel CSV aman untuk spreadsheet (nilai berawalan = + - @ diberi apostrof).
const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function DailyTransactionLogPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<Period>('bulan');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [kind, setKind] = useState<Kind>('semua');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [shown, setShown] = useState(PAGE);
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubCatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map((doc) => {
            const d = doc.data();
            return { ...d, id: doc.id, balance: Number(d.balance) || 0 } as Account;
          }));
        });

        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        if (unsubCatRef.current) unsubCatRef.current();
        unsubCatRef.current = onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category)));
        });

        const { start, end } = rangeOf(period, selectedDate);
        const constraints = [where('userId', '==', u.uid)];
        if (start) constraints.push(where('date', '>=', start));
        if (end) constraints.push(where('date', '<=', end));
        const q = query(collection(db, 'transactions'), ...constraints, orderBy('date', 'desc'));
        if (unsubRef.current) unsubRef.current();
        setLoading(true);
        unsubRef.current = onSnapshot(q, (snap) => {
          // Catatan Hutang/Piutang (type "debt") bukan arus kas — dampak kasnya
          // punya baris pemasukan/pengeluaran sendiri. Ditampilkan di halaman
          // Hutang & Piutang, bukan di sini (supaya tidak terlihat dobel).
          setTransactions(snap.docs.map((doc) => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date(),
            } as Transaction;
          }).filter((t) => t.type !== 'debt'));
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
  }, [period, selectedDate]);

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? (id || '—');
  const categoryLabel = (t: Transaction) => {
    const byId = categories.find((c) => c.id === t.category);
    return byId ? byId.category : t.category || 'Lainnya';
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

  const categoryOptions = useMemo(() => [...new Set(transactions.map(categoryLabel))].sort(), [transactions, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (kind === 'transfer' && !isTransfer(t)) return false;
      if ((kind === 'pemasukan' || kind === 'pengeluaran') && t.type !== kind) return false;
      if (categoryFilter && categoryLabel(t) !== categoryFilter) return false;
      if (accountFilter && t.accountId !== accountFilter) return false;
      if (!q) return true;
      return `${t.note || ''} ${categoryLabel(t)} ${t.subCategory || ''} ${accountName(t.accountId)} ${Math.round(t.amount)}`.toLowerCase().includes(q);
    });
  }, [transactions, kind, categoryFilter, accountFilter, searchQuery, categories, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ringkasan dari baris yang tampil (transfer tidak dihitung sebagai masuk/keluar).
  const masuk = filtered.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);
  const keluar = filtered.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + toIdr(t), 0);

  const groups = useMemo(() => {
    const out: { key: string; date: Date; items: Transaction[]; out: number; in: number }[] = [];
    for (const t of filtered.slice(0, shown)) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, date: d, items: [], out: 0, in: 0 };
        out.push(g);
      }
      g.items.push(t);
      if (t.type === 'pengeluaran') g.out += toIdr(t);
      if (t.type === 'pemasukan') g.in += toIdr(t);
    }
    return out;
  }, [filtered, shown]);

  const exportCsv = () => {
    const header = ['Tanggal', 'Jam', 'Jenis', 'Kategori', 'Subkategori', 'Catatan', 'Rekening', 'Mata uang', 'Nominal', 'Nominal (IDR)'];
    const rows = filtered.map((t) => {
      const d = new Date(t.date);
      return [
        d.toLocaleDateString('sv-SE'),
        new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        t.type, categoryLabel(t), t.subCategory, t.note, accountName(t.accountId), t.currency || 'IDR', t.amount, Math.round(toIdr(t)),
      ].map(csvCell).join(',');
    });
    const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leosiqra-transaksi-${new Date().toLocaleDateString('sv-SE')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dayTitle = (d: Date) =>
    sameDay(d, today) ? 'Hari ini' : sameDay(d, yesterday) ? 'Kemarin' : new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
  const hasFilter = kind !== 'semua' || categoryFilter || accountFilter || searchQuery.trim();
  const chip = (active: boolean) =>
    cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100');

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-12">
      <h1 className="sr-only">Riwayat transaksi</h1>

      {/* Cari + aksi */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari catatan, kategori, rekening, atau jumlah"
            aria-label="Cari transaksi"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            <Download size={15} /> Ekspor CSV
          </button>
          <button type="button" onClick={() => openModal('harian')} className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
            <Plus size={16} /> Tambah transaksi
          </button>
        </div>
      </div>

      {/* Periode */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" onClick={() => { setPeriod(p.id); setShown(PAGE); }} className={chip(period === p.id)}>{p.label}</button>
        ))}
        <span className={cn('flex shrink-0 items-center rounded-full text-sm font-semibold', period === 'hari' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
          <span className="[&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!shadow-none">
            <DatePicker value={selectedDate} onChange={(d) => { setSelectedDate(d); setPeriod('hari'); setShown(PAGE); }} />
          </span>
        </span>
      </div>

      {/* Jenis + kategori + rekening */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
        {KINDS.map((k) => (
          <button key={k.id} type="button" onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>
        ))}
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Saring kategori" className={cn(chip(Boolean(categoryFilter)), 'pr-8 outline-none')}>
          <option value="">Kategori</option>
          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="Saring rekening" className={cn(chip(Boolean(accountFilter)), 'pr-8 outline-none')}>
          <option value="">Rekening</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {hasFilter && (
          <button type="button" onClick={() => { setKind('semua'); setCategoryFilter(''); setAccountFilter(''); setSearchQuery(''); }} className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900">
            <X size={14} /> Reset
          </button>
        )}
      </div>

      {/* Ringkasan baris yang tampil */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-sm">
          <span className="text-slate-500">{filtered.length} transaksi</span>
          <span className="font-bold text-emerald-600 tabular-nums">Masuk +{formatIDR(masuk)}</span>
          <span className="font-bold text-rose-500 tabular-nums">Keluar −{formatIDR(keluar)}</span>
          <span className={cn('font-bold tabular-nums', masuk - keluar < 0 ? 'text-rose-600' : 'text-slate-800')}>Bersih {masuk - keluar < 0 ? '−' : '+'}{formatIDR(Math.abs(masuk - keluar))}</span>
        </div>
      )}

      {/* Daftar per hari */}
      {loading ? (
        <div className="space-y-2 rounded-[24px] border border-slate-100 bg-white p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-slate-100 bg-white p-8">
          {hasFilter ? (
            <EmptyState title="Tidak ada yang cocok" description="Coba ganti saringan atau kata kunci." icon={<Search size={24} />} />
          ) : (
            <EmptyState title="Belum ada transaksi" description="Catat transaksi pertamamu lewat suara, struk, atau tombol Tambah transaksi." icon={<ListOrdered size={24} />} />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-slate-700 first-letter:uppercase">{dayTitle(g.date)}</h2>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  {g.in > 0 && <span className="mr-2 text-emerald-600">+{formatIDR(g.in)}</span>}
                  {g.out > 0 && <span className="text-rose-500">−{formatIDR(g.out)}</span>}
                </span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_8px_30px_-22px_rgba(49,46,129,0.3)]">
                {g.items.map((t) => {
                  const incoming = isIncomingTransaction(t);
                  const cat = categoryLabel(t);
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-lg">{isTransfer(t) ? '🔁' : categoryEmoji(cat)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{t.note || t.subCategory || cat}</p>
                        <p className="truncate text-xs text-slate-400">
                          {formatTime(t.createdAt)} · {cat}{t.subCategory && t.subCategory !== cat ? ` · ${t.subCategory}` : ''} · {accountName(t.accountId)}
                        </p>
                      </div>
                      <p className={cn('whitespace-nowrap text-sm font-extrabold tabular-nums', isTransfer(t) ? 'text-slate-500' : incoming ? 'text-emerald-600' : 'text-rose-500')}>
                        {incoming ? '+' : '−'}{formatMoney(t.amount, t.currency)}
                      </p>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                        aria-label="Hapus transaksi"
                        className="-mr-1 rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-2xl bg-white py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              Muat lebih banyak ({filtered.length - shown} lagi)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
