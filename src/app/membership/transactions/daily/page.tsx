"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Download, Plus, ChevronDown, Tags, Wallet, CalendarDays, X, Paperclip, Hash, SlidersHorizontal } from 'lucide-react';
import { useTags } from '@/lib/useTags';
import { TagPicker, TagChip } from '@/components/tags/TagPicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DatePicker } from '@/components/ui/DatePicker';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { accountService, Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, isIncomingTransaction, isInvestmentFlow, formatIDR, formatMoney, toLocalDateString } from '@/lib/utils';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { usePrimaryAdd } from '@/lib/useRecordingPrefs';
import { attachmentService } from '@/lib/services/attachmentService';
import { HeaderSlot } from '@/components/Header';

// Riwayat transaksi: semua transaksi dikelompokkan per hari, dengan filter
// periode, jenis, kategori, dompet, pencarian, dan ekspor CSV.
// Catatan Hutang/Piutang (type "debt") bukan arus kas — dampak kasnya sudah
// punya baris pemasukan/pengeluaran sendiri, jadi tidak ditampilkan di sini
// (halaman Hutang & Piutang yang menampilkannya).

type Period = 'bulan' | '30' | '90' | 'tahun' | 'semua' | 'tanggal';
type Kind = 'semua' | 'pengeluaran' | 'pemasukan' | 'transfer';
type Sort = 'terbaru' | 'terlama' | 'terbesar';

const PERIODS: { id: Exclude<Period, 'tanggal'>; label: string }[] = [
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
  { id: 'transfer', label: 'Transfer & pindah dana' },
];
const PAGE = 60;

const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
// Nominal kartu ringkasan: ringkas di HP (kartu sempit), lengkap di desktop.
const Amount = ({ value }: { value: number }) => (
  <>
    <span className="md:hidden">{Math.abs(value) >= 1e6 ? `Rp${(Math.abs(value) / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : formatIDR(Math.abs(value))}</span>
    <span className="hidden md:inline">{formatIDR(Math.abs(value))}</span>
  </>
);
const isIncoming = (t: Transaction) => isIncomingTransaction(t) || (t.type === 'topup' && Boolean(t.subCategory?.includes('Masuk')));
// Transfer/top up, setor tabungan & beli/jual investasi: memindah uang sendiri,
// bukan belanja/penghasilan (investasi lewat isInvestmentFlow, sama dengan Worker).
const isMove = (t: Transaction) => (t.type !== 'pemasukan' && t.type !== 'pengeluaran') || isInvestmentFlow(t);
const isSpend = (t: Transaction) => t.type === 'pengeluaran' && !isMove(t);
const isEarn = (t: Transaction) => t.type === 'pemasukan' && !isMove(t);
const titleOf = (t: Transaction) => t.note || t.subCategory || t.category || 'Transaksi';
const dayKey = (d: Date) => toLocalDateString(d);

// Sel CSV: kutip ganda di-escape; teks yang diawali = + - @ diberi ' supaya
// tidak dieksekusi sebagai rumus saat dibuka di Excel/Sheets.
const csvCell = (v: string | number) => {
  if (typeof v === 'number') return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

const chip = (active: boolean) =>
  cn(
    'shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors whitespace-nowrap',
    active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
  );

export default function DailyTransactionLogPage() {
  // Ikon/warna kategori pilihan user (Pengaturan → Kategori & Anggaran).
  useCategoryStyles();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // transaksi → id foto struk pertama (ikon 📎). Gagal/belum aktif = tanpa ikon.
  const [attachments, setAttachments] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const load = () =>
      attachmentService
        .list()
        .then((items) => {
          const map = new Map<string, string>();
          for (const a of items) if (!map.has(a.transaction_id)) map.set(a.transaction_id, a.id);
          setAttachments(map);
        })
        .catch(() => undefined);
    load();
    return subscribeToCollectionChanges('transactions', load);
  }, []);
  const [period, setPeriod] = useState<Period>('bulan');
  const [pickedDate, setPickedDate] = useState(() => new Date());
  const [kind, setKind] = useState<Kind>('semua');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tag, setTag] = useState('');
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  // HP: filter dilipat & aksi baris muncul saat baris diketuk.
  const [showFilters, setShowFilters] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const { tags: tagsPref, colorOf } = useTags();
  const [sort, setSort] = useState<Sort>('terbaru');
  const [shown, setShown] = useState(PAGE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();
  const primaryAdd = usePrimaryAdd();

  useEffect(() => {
    let active = true;
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((all) => active && setTransactions(all.filter((t) => t.type !== 'debt')))
        .catch(console.error)
        .finally(() => active && setLoading(false));
    const loadAccounts = () => accountService.getUserAccounts('session').then((a) => active && setAccounts(a)).catch(console.error);
    load();
    loadAccounts();
    const unsubTrx = subscribeToCollectionChanges('transactions', load);
    const unsubAcc = subscribeToCollectionChanges('accounts', loadAccounts);
    return () => {
      active = false;
      unsubTrx();
      unsubAcc();
    };
  }, []);

  // Daftar baru tiap filter berubah → mulai lagi dari halaman pertama.
  useEffect(() => {
    setShown(PAGE);
  }, [period, pickedDate, kind, category, accountId, tag, sort, searchQuery]);

  // Tautan dari Laporan/Rekening: ?kategori=…&rekening=…&periode=bulan|tahun|semua
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kat = params.get('kategori');
    const per = params.get('periode');
    const rek = params.get('rekening');
    const tg = params.get('tag');
    if (tg) {
      setTag(tg);
      if (!per) setPeriod('semua');
    }
    if (kat) setCategory(kat);
    if (rek) setAccountId(rek);
    if (per === 'bulan' || per === 'tahun' || per === 'semua' || per === '30' || per === '90') setPeriod(per === 'tahun' ? 'tahun' : per);
  }, []);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryOptions = useMemo(
    () => [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [transactions]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const from =
      period === 'bulan' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      : period === '30' ? startOfToday - 29 * 86400e3
      : period === '90' ? startOfToday - 89 * 86400e3
      : period === 'tahun' ? new Date(now.getFullYear(), 0, 1).getTime()
      : -Infinity;
    const picked = dayKey(pickedDate);
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/[^\d]/g, '');

    const list = transactions.filter((t) => {
      const d = new Date(t.date);
      if (period === 'tanggal' ? dayKey(d) !== picked : d.getTime() < from) return false;
      if (kind === 'pengeluaran' && !isSpend(t)) return false;
      if (kind === 'pemasukan' && !isEarn(t)) return false;
      if (kind === 'transfer' && !isMove(t)) return false;
      if (category && t.category !== category) return false;
      if (accountId && t.accountId !== accountId) return false;
      if (tag && !(t.tags ?? []).some((x) => x.toLowerCase() === tag.toLowerCase())) return false;
      if (q) {
        const hay = [t.note, t.category, t.subCategory, accountName.get(t.accountId), ...(t.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
        const amountHit = qDigits.length >= 3 && String(Math.round(Number(t.amount) || 0)).includes(qDigits);
        if (!hay.includes(q) && !amountHit) return false;
      }
      return true;
    });

    const time = (t: Transaction) => new Date(t.date).getTime();
    const created = (t: Transaction) => new Date(t.createdAt).getTime() || 0;
    if (sort === 'terbesar') list.sort((a, b) => idr(b) - idr(a));
    else if (sort === 'terlama') list.sort((a, b) => time(a) - time(b) || created(a) - created(b));
    else list.sort((a, b) => time(b) - time(a) || created(b) - created(a));
    return list;
  }, [transactions, period, pickedDate, kind, category, accountId, tag, searchQuery, sort, accountName]);
  const tagOptions = useMemo(
    () => [...new Set([...tagsPref.list.map((x) => x.name), ...transactions.flatMap((t) => t.tags ?? [])])].sort((a, b) => a.localeCompare(b, 'id')),
    [transactions, tagsPref.list]
  );
  const setTxTags = async (t: Transaction, next: string[]) => {
    if (!t.id) return;
    const before = t.tags ?? [];
    setTransactions((list) => list.map((x) => (x.id === t.id ? { ...x, tags: next } : x)));
    try {
      await transactionService.updateTransaction(t.id, { tags: next });
    } catch {
      setTransactions((list) => list.map((x) => (x.id === t.id ? { ...x, tags: before } : x)));
    }
  };

  const totalOut = useMemo(() => filtered.filter(isSpend).reduce((s, t) => s + idr(t), 0), [filtered]);
  const totalIn = useMemo(() => filtered.filter(isEarn).reduce((s, t) => s + idr(t), 0), [filtered]);
  const totalMove = useMemo(() => filtered.filter(isMove).length, [filtered]);

  // Dikelompokkan per hari (urutan "terbesar" tidak dikelompokkan supaya urutannya tetap terlihat).
  const groups = useMemo(() => {
    const visible = filtered.slice(0, shown);
    if (sort === 'terbesar') return [{ key: 'all', label: 'Nominal terbesar', items: visible, out: 0, in: 0 }];
    const map = new Map<string, Transaction[]>();
    for (const t of visible) {
      const k = dayKey(new Date(t.date));
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86400e3));
    return [...map.entries()].map(([key, items]) => {
      const [y, m, d] = key.split('-').map(Number);
      const label =
        key === today ? 'Hari ini'
        : key === yesterday ? 'Kemarin'
        : new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
      return {
        key,
        label,
        items,
        out: items.filter(isSpend).reduce((s, t) => s + idr(t), 0),
        in: items.filter(isEarn).reduce((s, t) => s + idr(t), 0),
      };
    });
  }, [filtered, shown, sort]);

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

  const exportCsv = () => {
    const header = ['Tanggal', 'Jam dicatat', 'Jenis', 'Judul', 'Kategori', 'Sub kategori', 'Rekening', 'Mata uang', 'Nominal', 'Nominal IDR', 'Tag'];
    const rows = filtered.map((t) => {
      const created = new Date(t.createdAt);
      return [
        dayKey(new Date(t.date)),
        Number.isNaN(created.getTime()) ? '' : created.toTimeString().slice(0, 5),
        t.type,
        t.note || '',
        t.category || '',
        t.subCategory || '',
        accountName.get(t.accountId) || '',
        t.currency || 'IDR',
        Number(t.amount) || 0,
        idr(t),
        (t.tags ?? []).join(', '),
      ];
    });
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `leosiqra-transaksi-${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const timeOf = (t: Transaction) => {
    const c = new Date(t.createdAt);
    return Number.isNaN(c.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(c);
  };
  const hasFilter = kind !== 'semua' || category || accountId || tag || searchQuery || period !== 'bulan';
  const activeFilters = [kind !== 'semua', category, accountId, tag, period !== 'bulan', sort !== 'terbaru'].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Judul + aksi */}
      <div className="flex items-start justify-between gap-4 md:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Transaksi</h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {loading
              ? 'Memuat…'
              : `${filtered.length} transaksi · ${period === 'tanggal' ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(pickedDate) : PERIODS.find((p) => p.id === period)?.label.toLowerCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={16} /> Ekspor CSV
          </button>
          <button
            type="button"
            onClick={primaryAdd}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)] hover:brightness-110"
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah transaksi
          </button>
        </div>
          <HeaderSlot />
        </div>
      </div>

      {/* Ringkasan periode & filter yang sedang dipakai */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          <div className="min-w-0 rounded-[20px] bg-white p-3.5 ring-1 ring-slate-100 md:p-5">
            <p className="text-[12px] font-semibold text-slate-500 md:text-[13px]">Keluar</p>
            <p className="mt-1 truncate text-[15px] font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[22px]"><Amount value={totalOut} /></p>
          </div>
          <div className="min-w-0 rounded-[20px] bg-white p-3.5 ring-1 ring-slate-100 md:p-5">
            <p className="text-[12px] font-semibold text-slate-500 md:text-[13px]">Masuk</p>
            <p className="mt-1 truncate text-[15px] font-extrabold tracking-tight text-emerald-600 tabular-nums md:text-[22px]"><Amount value={totalIn} /></p>
          </div>
          <div className="min-w-0 rounded-[20px] bg-white p-3.5 ring-1 ring-slate-100 md:p-5">
            <p className="text-[12px] font-semibold text-slate-500 md:text-[13px]">Selisih</p>
            <p className={cn('mt-1 truncate text-[15px] font-extrabold tracking-tight tabular-nums md:text-[22px]', totalIn - totalOut >= 0 ? 'text-slate-900' : 'text-rose-600')}>
              {totalIn - totalOut >= 0 ? '+' : '−'}<Amount value={totalIn - totalOut} />
            </p>
            {totalMove > 0 && <p className="hidden truncate text-[12px] text-slate-400 md:block">{totalMove} transfer & pindah dana tidak dihitung</p>}
          </div>
        </div>
      )}

      {/* Cari + periode */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:w-[380px] lg:flex-none">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi"
                aria-label="Cari transaksi"
                className="w-full rounded-full bg-white py-2.5 pl-11 pr-4 text-[14px] text-slate-800 ring-1 ring-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cn('relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold ring-1 md:hidden', showFilters ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200')}
            >
              <SlidersHorizontal size={16} /> Filter
              {activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] text-white">{activeFilters}</span>}
            </button>
          </div>
          <div className={cn('-mx-4 gap-2 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0', showFilters ? 'flex' : 'hidden md:flex')}>
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Jenis + kategori + dompet + tanggal + urutan */}
        <div className={cn('-mx-4 items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0', showFilters ? 'flex' : 'hidden md:flex')}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>
          ))}
          <label className={cn(chip(Boolean(category)), 'relative flex items-center gap-2 pr-8')}>
            <Tags size={15} />
            <span className="max-w-[140px] truncate">{category || 'Kategori'}</span>
            <ChevronDown size={14} className="absolute right-3" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter kategori" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="">Semua kategori</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={cn(chip(Boolean(accountId)), 'relative flex items-center gap-2 pr-8')}>
            <Wallet size={15} />
            <span className="max-w-[140px] truncate">{accountId ? accountName.get(accountId) ?? 'Rekening' : 'Rekening'}</span>
            <ChevronDown size={14} className="absolute right-3" />
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Filter rekening" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="">Semua rekening</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {(tagsPref.enabled || tagOptions.length > 0) && (
            <label className={cn(chip(Boolean(tag)), 'relative flex items-center gap-2 pr-8')}>
              <Hash size={15} />
              <span className="max-w-[140px] truncate">{tag || 'Tag'}</span>
              <ChevronDown size={14} className="absolute right-3" />
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter tag" className="absolute inset-0 cursor-pointer opacity-0">
                <option value="">Semua tag</option>
                {tagOptions.map((x) => <option key={x} value={x}>#{x}</option>)}
              </select>
            </label>
          )}
          {period === 'tanggal' ? (
            <div className="flex shrink-0 items-center gap-1">
              <DatePicker value={pickedDate} onChange={setPickedDate} />
              <button type="button" onClick={() => setPeriod('bulan')} aria-label="Hapus filter tanggal" className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setPeriod('tanggal')} className={cn(chip(false), 'flex items-center gap-2')}>
              <CalendarDays size={15} /> Tanggal tertentu
            </button>
          )}
          <label className="relative ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 pr-8 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {sort === 'terbaru' ? 'Terbaru' : sort === 'terlama' ? 'Terlama' : 'Terbesar'}
            <ChevronDown size={14} className="absolute right-3" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
              <option value="terbesar">Nominal terbesar</option>
            </select>
          </label>
        </div>
      </div>

      {/* Daftar per hari */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] bg-white p-6 ring-1 ring-slate-100 md:p-10">
          {hasFilter ? (
            <EmptyState title="Tidak ada yang cocok" description="Coba ubah periode, filter, atau kata kunci." icon={<Search size={24} />} />
          ) : (
            <EmptyState title="Belum ada transaksi bulan ini" description="Catat transaksi pertama lewat tombol Tambah transaksi." icon={<Plus size={24} />} />
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex items-baseline justify-between px-2">
                <h2 className="text-[15px] font-semibold text-slate-600">{g.label}</h2>
                {sort !== 'terbesar' && (
                  <p className="text-[14px] font-semibold tabular-nums text-slate-500">
                    {g.in > 0 && <span className="mr-3 text-emerald-600">+{formatIDR(g.in)}</span>}
                    {g.out > 0 && <span>−{formatIDR(g.out)}</span>}
                  </p>
                )}
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-100">
                {g.items.map((t) => {
                  const incoming = isIncoming(t);
                  const move = isMove(t);
                  const v = categoryVisual(t.category, t.type);
                  return (
                    <li
                      key={t.id}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest('button,a,input')) setActionId((v) => (v === t.id ? null : t.id ?? null)); }}
                      className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3.5 px-4 py-3 md:cursor-default md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-5 md:px-5"
                    >
                      <span className={cn('flex h-11 w-11 items-center justify-center rounded-full text-[20px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                          <span className="truncate">{titleOf(t)}</span>
                          {tagsPref.enabled && t.id && !t.tags?.length && tagEditId !== t.id && (
                            <button type="button" onClick={() => setTagEditId(t.id!)} aria-label="Tambah tag" title="Tambah tag" className="hidden shrink-0 rounded-md p-0.5 text-slate-300 hover:bg-slate-100 hover:text-indigo-600 md:inline-block md:opacity-0 md:group-hover:opacity-100 focus:opacity-100">
                              <Hash size={14} />
                            </button>
                          )}
                          {t.id && attachments.has(t.id) && (
                            <a
                              href={attachmentService.url(attachments.get(t.id)!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Lihat foto struk"
                              title="Lihat foto struk"
                              className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            >
                              <Paperclip size={14} />
                            </a>
                          )}
                        </p>
                        <p className="truncate text-[13px] text-slate-500">
                          {sort === 'terbesar' ? `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date))} · ` : ''}
                          {timeOf(t)}
                          <span className="md:hidden">{[t.category, accountName.get(t.accountId)].filter(Boolean).map((s) => ` · ${s}`).join('')}</span>
                        </p>
                      </div>
                      <p className="hidden truncate text-[14px] text-slate-500 md:block">{t.subCategory && t.subCategory !== titleOf(t) ? `${t.category} · ${t.subCategory}` : t.category}</p>
                      <p className="hidden truncate text-[14px] text-slate-500 md:block">{accountName.get(t.accountId) ?? '—'}</p>
                      <div className="text-right">
                        <p className={cn('whitespace-nowrap text-[15px] font-bold tabular-nums', incoming ? 'text-emerald-600' : move ? 'text-slate-500' : 'text-slate-900')}>
                          {incoming ? '+' : '−'}{formatMoney(Number(t.amount) || 0, t.currency)}
                        </p>
                        {t.currency && t.currency !== 'IDR' && <p className="text-[12px] text-slate-400 tabular-nums">≈ {formatIDR(idr(t))}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                        aria-label="Hapus transaksi"
                        className="hidden rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 md:block md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                      {((t.tags?.length ?? 0) > 0 || tagEditId === t.id) && (
                        <div className="col-span-full -mt-1 flex flex-wrap items-center gap-1.5 pl-[58px] md:pl-[64px]">
                          {tagEditId === t.id ? (
                            <>
                              <TagPicker value={t.tags ?? []} onChange={(next) => void setTxTags(t, next)} />
                              <button type="button" onClick={() => setTagEditId(null)} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-50">Selesai</button>
                            </>
                          ) : (
                            <>
                              {(t.tags ?? []).map((x) => (
                                <button key={x} type="button" onClick={() => setTag(x)} title={`Saring #${x}`}><TagChip name={x} color={colorOf(x)} /></button>
                              ))}
                              {tagsPref.enabled && t.id && (
                                <button type="button" onClick={() => setTagEditId(t.id!)} className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-indigo-600 md:inline-flex md:opacity-0 md:group-hover:opacity-100 focus:opacity-100">
                                  <Hash size={10} /> Ubah
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {actionId === t.id && tagEditId !== t.id && (
                        <div className="col-span-full flex gap-2 pl-[58px] md:hidden">
                          {tagsPref.enabled && (
                            <button type="button" onClick={() => { setTagEditId(t.id!); setActionId(null); }} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-slate-700">
                              <Hash size={14} /> Tag
                            </button>
                          )}
                          <button type="button" onClick={() => handleDelete(t)} disabled={deletingId === t.id} className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-2 text-[13px] font-semibold text-rose-600 disabled:opacity-50">
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {filtered.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full rounded-full bg-white py-3 text-[14px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Tampilkan lebih banyak ({filtered.length - shown} lagi)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
