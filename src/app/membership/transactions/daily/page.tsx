"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Download, Plus, ChevronDown, Tags, Wallet, CalendarDays, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DatePicker } from '@/components/ui/DatePicker';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { accountService, Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, isIncomingTransaction, formatIDR, formatMoney, toLocalDateString } from '@/lib/utils';
import { categoryVisual } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { useModal } from '@/context/ModalContext';

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
const PAGE = 150;

const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const isIncoming = (t: Transaction) => isIncomingTransaction(t) || (t.type === 'topup' && Boolean(t.subCategory?.includes('Masuk')));
// Transfer/top up, setor tabungan & beli investasi: memindah uang sendiri, bukan belanja.
const isMove = (t: Transaction) => t.type !== 'pemasukan' && t.type !== 'pengeluaran';
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<Period>('bulan');
  const [pickedDate, setPickedDate] = useState(() => new Date());
  const [kind, setKind] = useState<Kind>('semua');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [sort, setSort] = useState<Sort>('terbaru');
  const [shown, setShown] = useState(PAGE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();

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
  }, [period, pickedDate, kind, category, accountId, sort, searchQuery]);

  // Tautan dari Laporan/Rekening: ?kategori=…&rekening=…&periode=bulan|tahun|semua
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kat = params.get('kategori');
    const per = params.get('periode');
    const rek = params.get('rekening');
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
      if (kind === 'pengeluaran' && t.type !== 'pengeluaran') return false;
      if (kind === 'pemasukan' && t.type !== 'pemasukan') return false;
      if (kind === 'transfer' && !isMove(t)) return false;
      if (category && t.category !== category) return false;
      if (accountId && t.accountId !== accountId) return false;
      if (q) {
        const hay = [t.note, t.category, t.subCategory, accountName.get(t.accountId)].filter(Boolean).join(' ').toLowerCase();
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
  }, [transactions, period, pickedDate, kind, category, accountId, searchQuery, sort, accountName]);

  const totalOut = useMemo(() => filtered.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + idr(t), 0), [filtered]);
  const totalIn = useMemo(() => filtered.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + idr(t), 0), [filtered]);

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
        out: items.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + idr(t), 0),
        in: items.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + idr(t), 0),
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
    const header = ['Tanggal', 'Jam dicatat', 'Jenis', 'Judul', 'Kategori', 'Sub kategori', 'Rekening', 'Mata uang', 'Nominal', 'Nominal IDR'];
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
  const hasFilter = kind !== 'semua' || category || accountId || searchQuery || period !== 'bulan';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Judul + aksi */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Transaksi</h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {loading ? 'Memuat…' : `${filtered.length} transaksi · keluar ${formatIDR(totalOut)}${totalIn > 0 ? ` · masuk ${formatIDR(totalIn)}` : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
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
            onClick={() => openModal('harian')}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)] hover:brightness-110"
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah transaksi
          </button>
        </div>
      </div>

      {/* Cari + periode */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-[380px] shrink-0">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, kategori, rekening, atau jumlah"
              aria-label="Cari transaksi"
              className="w-full rounded-full bg-white py-2.5 pl-11 pr-4 text-[14px] text-slate-800 ring-1 ring-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Jenis + kategori + dompet + tanggal + urutan */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0">
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
                    <li key={t.id} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3.5 px-4 py-3 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-5 md:px-5">
                      <span className={cn('flex h-11 w-11 items-center justify-center rounded-full text-[20px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-slate-900">{titleOf(t)}</p>
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
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t.id}
                          aria-label="Hapus transaksi"
                          className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-rose-500 disabled:opacity-50 md:hidden"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
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
