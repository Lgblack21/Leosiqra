"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Search, Trash2, ListOrdered, Download, Plus, X, Copy, CheckCircle2, Tag, Wallet, Repeat, Check, GitBranch, Hash } from 'lucide-react';
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
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { FilterPopover, OptionRow } from '@/components/transactions/FilterPopover';
import { TxDetailModal } from '@/components/transactions/TxDetailModal';
import { RecurringDrawer } from '@/components/transactions/RecurringDrawer';
import { quickTxService } from '@/lib/services/quickTxService';
import { placeService, type Place } from '@/lib/services/connectService';
import { TX_SOURCES, txSourceOf, txTags, type TxSource } from '@/lib/txSource';

// Riwayat transaksi gaya baru (mengikuti pola Oyenza): cari, periode, jenis,
// filter kategori/rekening (popover), urutan, panel transaksi rutin, mode
// Pilih (hapus / ubah kategori massal), detail transaksi sebagai popup, dan
// animasi halus di semua perpindahan. Data tetap realtime; hapus membalik
// saldo di server (atomik); duplikat lewat quick-transaction (atomik).

// bulan-x / tahun-x = bulan atau tahun tertentu (dari tautan Laporan), memakai selectedDate.
type Period = 'bulan' | '30' | '90' | 'tahun' | 'semua' | 'hari' | 'bulan-x' | 'tahun-x';
type Kind = 'semua' | 'pengeluaran' | 'pemasukan' | 'transfer';
type Sort = 'terbaru' | 'terbesar' | 'terkecil';

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
const SORTS: { id: Sort; label: string }[] = [
  { id: 'terbaru', label: 'Terbaru' },
  { id: 'terbesar', label: 'Terbesar' },
  { id: 'terkecil', label: 'Terkecil' },
];
const PAGE = 150;

const rangeOf = (period: Period, day: Date): { start?: Date; end?: Date } => {
  const now = new Date();
  if (period === 'hari') return { start: new Date(day.getFullYear(), day.getMonth(), day.getDate()), end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999) };
  if (period === 'bulan') return { start: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (period === '30') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) };
  if (period === '90') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89) };
  if (period === 'tahun') return { start: new Date(now.getFullYear(), 0, 1) };
  if (period === 'bulan-x') return { start: new Date(day.getFullYear(), day.getMonth(), 1), end: new Date(day.getFullYear(), day.getMonth() + 1, 0, 23, 59, 59, 999) };
  if (period === 'tahun-x') return { start: new Date(day.getFullYear(), 0, 1), end: new Date(day.getFullYear(), 11, 31, 23, 59, 59, 999) };
  return {};
};

const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const isTransfer = (t: Transaction) => t.type === 'transfer' || t.type === 'topup';
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
// Sel CSV aman untuk spreadsheet (nilai berawalan = + - @ diberi apostrof).
const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

// Chip dengan "pil" hitam yang meluncur ke chip aktif (shared layout).
function ChipGroup<T extends string>({ id, items, value, onChange }: { id: string; items: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <LayoutGroup id={id}>
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn('relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200', active ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
          >
            {active && <motion.span layoutId={`chip-${id}`} className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{it.label}</span>
          </button>
        );
      })}
    </LayoutGroup>
  );
}

// Lingkaran centang (mode Pilih / hover).
function SelectDot({ on, show, onClick, label }: { on: boolean; show: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
        on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white',
        show || on ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0 md:group-hover:pointer-events-auto md:group-hover:scale-100 md:group-hover:opacity-100'
      )}
    >
      {on && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

export default function DailyTransactionLogPage() {
  // useSearchParams butuh Suspense di static export.
  return (
    <Suspense fallback={null}>
      <TransactionsInner />
    </Suspense>
  );
}

function TransactionsInner() {
  const reduce = useReducedMotion();
  // Tautan dari Laporan: ?date=YYYY-MM-DD (satu hari) dan ?category=Nama.
  const params = useSearchParams();
  const linkDate = params.get('date');
  const linkCat = params.get('category');
  const linkPeriod = params.get('period');
  // ?month=YYYY-MM atau ?year=YYYY → rentang bulan/tahun tertentu.
  const linkMonth = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : null;
  const linkYear = /^\d{4}$/.test(params.get('year') ?? '') ? Number(params.get('year')) : null;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<Period>(() => (linkDate && /^\d{4}-\d{2}-\d{2}$/.test(linkDate) ? 'hari' : linkMonth ? 'bulan-x' : linkYear ? 'tahun-x' : linkPeriod === 'tahun' || linkPeriod === 'semua' ? linkPeriod : 'bulan'));
  const [selectedDate, setSelectedDate] = useState(() => {
    if (linkMonth) {
      const [y, m] = linkMonth.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    if (linkYear) return new Date(linkYear, 0, 1);
    if (linkDate && /^\d{4}-\d{2}-\d{2}$/.test(linkDate)) {
      const [y, m, d] = linkDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [kind, setKind] = useState<Kind>('semua');
  const [catFilter, setCatFilter] = useState<string[]>(() => (linkCat ? [linkCat.slice(0, 80)] : []));
  // ?account=<id> (mis. dari detail kartu kredit di Dompet).
  const [accFilter, setAccFilter] = useState<string[]>(() => (params.get('account') ? [params.get('account')!.slice(0, 80)] : []));
  const [srcFilter, setSrcFilter] = useState<TxSource[]>([]);
  // ?tag=xxx (mis. dari halaman Perjalanan).
  const [tagFilter, setTagFilter] = useState<string[]>(() => (params.get('tag') ? [params.get('tag')!.slice(0, 24)] : []));
  const [sort, setSort] = useState<Sort>('terbaru');
  const [shown, setShown] = useState(PAGE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { toast, confirm } = useFeedback();
  const { openModal } = useModal();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubCatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    placeService.list().then(setPlaces).catch(() => {});
  }, []);

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

  const deleteMessage = (tx: Transaction) =>
    // Sesuai handleDeleteTransaction di worker: pemasukan/pengeluaran &
    // transfer dibalikkan saldonya; transfer ikut menghapus sisi pasangannya.
    tx.type === 'transfer' || tx.type === 'topup'
      ? 'Kedua sisi transfer (keluar & masuk) ikut dihapus dan saldo kedua rekening dikembalikan. Tindakan ini tidak bisa dibatalkan.'
      : tx.type === 'pemasukan' || tx.type === 'pengeluaran'
        ? 'Saldo rekening terkait akan dikembalikan. Tindakan ini tidak bisa dibatalkan.'
        : 'Catatan ini dihapus tanpa mengubah saldo rekening. Tindakan ini tidak bisa dibatalkan.';

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return;
    const ok = await confirm({ title: 'Hapus transaksi ini?', message: deleteMessage(tx), confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    setDeletingId(tx.id);
    try {
      await transactionService.deleteTransaction(tx);
      setDetail(null);
      toast.success('Transaksi dihapus.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  // Duplikat = catat ulang hari ini dengan isi yang sama (transaksi + saldo atomik).
  const handleDuplicate = async (tx: Transaction) => {
    if (tx.type !== 'pemasukan' && tx.type !== 'pengeluaran') return;
    if (!tx.accountId) return toast.error('Transaksi ini tidak punya rekening.');
    try {
      await quickTxService.create({ type: tx.type, amount: Number(tx.amount) || 0, accountId: tx.accountId, category: categoryLabel(tx), subCategory: tx.subCategory, note: tx.note, source: 'duplikat' });
      setDetail(null);
      toast.success('Diduplikat untuk hari ini.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menduplikat.');
    }
  };

  const categoryOptions = useMemo(() => [...new Set(transactions.map(categoryLabel))].sort(), [transactions, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = transactions.filter((t) => {
      if (kind === 'transfer' && !isTransfer(t)) return false;
      if ((kind === 'pemasukan' || kind === 'pengeluaran') && t.type !== kind) return false;
      if (catFilter.length && !catFilter.includes(categoryLabel(t))) return false;
      if (accFilter.length && !accFilter.includes(t.accountId || '')) return false;
      if (srcFilter.length && !srcFilter.includes(txSourceOf(t))) return false;
      if (tagFilter.length && !txTags(t).some((x) => tagFilter.includes(x))) return false;
      if (!q) return true;
      return `${t.note || ''} ${txTags(t).map((x) => '#' + x).join(' ')} ${categoryLabel(t)} ${t.subCategory || ''} ${accountName(t.accountId)} ${Math.round(t.amount)}`.toLowerCase().includes(q);
    });
    if (sort === 'terbesar') return [...list].sort((a, b) => toIdr(b) - toIdr(a));
    if (sort === 'terkecil') return [...list].sort((a, b) => toIdr(a) - toIdr(b));
    return list;
  }, [transactions, kind, catFilter, accFilter, srcFilter, tagFilter, searchQuery, sort, categories, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const masuk = filtered.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);
  const keluar = filtered.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + toIdr(t), 0);

  // Terbaru → dikelompokkan per hari; Terbesar/Terkecil → satu daftar.
  const groups = useMemo(() => {
    const rows = filtered.slice(0, shown);
    if (sort !== 'terbaru') return [{ key: 'all', date: null as Date | null, items: rows, out: 0, in: 0 }];
    const out: { key: string; date: Date | null; items: Transaction[]; out: number; in: number }[] = [];
    for (const t of rows) {
      const d = new Date(t.date);
      const key = dayKey(d);
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
  }, [filtered, shown, sort]);

  const toggleOne = (id?: string) => {
    if (!id) return;
    if (!selectMode) setSelectMode(true);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleDay = (items: Transaction[]) => {
    if (!selectMode) setSelectMode(true);
    const ids = items.map((t) => t.id!).filter(Boolean);
    setSelected((cur) => {
      const next = new Set(cur);
      const all = ids.every((id) => next.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  };
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const selectedTx = filtered.filter((t) => t.id && selected.has(t.id));

  const bulkDelete = async () => {
    if (!selectedTx.length) return;
    const ok = await confirm({
      title: `Hapus ${selectedTx.length} transaksi?`,
      message: 'Saldo rekening terkait dikembalikan. Transfer ikut menghapus sisi pasangannya. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus semua',
      danger: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    let done = 0;
    const gone = new Set<string>();
    for (const t of selectedTx) {
      if (!t.id || gone.has(t.id)) continue;
      try {
        const r = await transactionService.deleteTransaction(t);
        done++;
        r.forEach((id) => gone.add(id));
      } catch {
        // sisi transfer pasangan yang sudah ikut terhapus → abaikan
      }
    }
    setBulkBusy(false);
    exitSelect();
    toast.success(`${done} transaksi dihapus.`);
  };

  const bulkCategory = async (category: string) => {
    if (!selectedTx.length) return;
    setBulkBusy(true);
    let done = 0;
    for (const t of selectedTx) {
      if (!t.id || isTransfer(t)) continue;
      try {
        await transactionService.updateTransaction(t.id, { category });
        done++;
      } catch {
        /* lanjut ke berikutnya */
      }
    }
    setBulkBusy(false);
    exitSelect();
    toast.success(`Kategori ${done} transaksi diubah ke ${category}.`);
  };

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
    toast.success(`CSV siap · ${filtered.length} transaksi`);
  };

  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
  const dayTitle = (d: Date) =>
    sameDay(d, today) ? 'Hari ini' : sameDay(d, yesterday) ? 'Kemarin' : new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
  const hasFilter = kind !== 'semua' || catFilter.length > 0 || accFilter.length > 0 || srcFilter.length > 0 || tagFilter.length > 0 || searchQuery.trim() !== '';
  const sourceCounts = useMemo(() => {
    const m = new Map<TxSource, number>();
    for (const t of transactions) m.set(txSourceOf(t), (m.get(txSourceOf(t)) ?? 0) + 1);
    return m;
  }, [transactions]);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) for (const x of txTags(t)) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);
  const resetFilter = () => {
    setTagFilter([]);
    setKind('semua');
    setCatFilter([]);
    setAccFilter([]);
    setSrcFilter([]);
    setSearchQuery('');
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const listKey = `${period}|${kind}|${catFilter.join()}|${accFilter.join()}|${srcFilter.join()}|${tagFilter.join()}|${sort}|${searchQuery.trim()}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-28">
      <h1 className="sr-only">Riwayat transaksi</h1>

      {/* Ringkasan + aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {loading ? 'Memuat…' : (
            <>
              <b className="text-slate-800">{filtered.length}</b> transaksi · keluar <b className="text-rose-500 tabular-nums"><AnimatedNumber value={keluar} format={formatIDR} /></b>
              {masuk > 0 && <> · masuk <b className="text-emerald-600 tabular-nums"><AnimatedNumber value={masuk} format={formatIDR} /></b></>}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={cn('flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors', selectMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}
          >
            {selectMode ? <><Check size={15} /> Selesai</> : <><CheckCircle2 size={15} /> Pilih</>}
          </button>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-50">
            <Download size={15} /> <span className="hidden sm:inline">Ekspor</span> CSV
          </button>
          <button type="button" onClick={() => openModal('harian')} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-slate-800">
            <Plus size={16} /> <span className="hidden sm:inline">Tambah transaksi</span>
          </button>
        </div>
      </div>

      {/* Cari + periode */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full md:w-[420px] md:shrink-0">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari catatan, kategori, rekening, atau jumlah"
            aria-label="Cari transaksi"
            className="w-full rounded-full bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none ring-1 ring-transparent transition-all placeholder:text-slate-400 focus:bg-white focus:ring-indigo-300"
          />
        </label>
        <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto py-0.5">
          {(period === 'bulan-x' || period === 'tahun-x') && (
            <button type="button" onClick={() => { setPeriod('bulan'); setSelectedDate(new Date()); setShown(PAGE); }} className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-[13px] font-semibold text-white" title="Kembali ke bulan ini">
              {period === 'bulan-x' ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(selectedDate) : selectedDate.getFullYear()} <X size={13} />
            </button>
          )}
          <ChipGroup id="period" items={PERIODS} value={period === 'hari' || period === 'bulan-x' || period === 'tahun-x' ? null : period} onChange={(p) => { setPeriod(p); setShown(PAGE); }} />
          <span className={cn('flex shrink-0 items-center rounded-full text-[13px] font-semibold transition-colors [&_button]:!py-1 [&_button]:!text-[12px]', period === 'hari' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}>
            <span className="[&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!shadow-none">
              <DatePicker value={selectedDate} onChange={(d) => { setSelectedDate(d); setPeriod('hari'); setShown(PAGE); }} />
            </span>
          </span>
        </div>
      </div>

      {/* Jenis + filter */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5 md:flex-wrap md:overflow-visible">
        <ChipGroup id="kind" items={KINDS} value={kind} onChange={setKind} />
        <FilterPopover title="Kategori" icon={<Tag size={13} />} label={catFilter.length ? `Kategori · ${catFilter.length}` : 'Kategori'} active={catFilter.length > 0}>
          {() => categoryOptions.length === 0 ? <p className="px-3 py-3 text-sm text-slate-500">Belum ada kategori.</p> : categoryOptions.map((c) => (
            <OptionRow key={c} selected={catFilter.includes(c)} onClick={() => setCatFilter((cur) => toggleIn(cur, c))}>
              {categoryEmoji(c)}&nbsp;&nbsp;{c}
            </OptionRow>
          ))}
        </FilterPopover>
        <FilterPopover title="Rekening" icon={<Wallet size={13} />} label={accFilter.length ? `Rekening · ${accFilter.length}` : 'Rekening'} active={accFilter.length > 0}>
          {() => accounts.map((a) => (
            <OptionRow key={a.id} selected={accFilter.includes(a.id!)} onClick={() => setAccFilter((cur) => toggleIn(cur, a.id!))}>
              {a.name} <span className="text-slate-400">· {a.type}</span>
            </OptionRow>
          ))}
        </FilterPopover>
        <FilterPopover title="Sumber" icon={<GitBranch size={13} />} label={srcFilter.length ? `Sumber · ${srcFilter.length}` : 'Sumber'} active={srcFilter.length > 0} width={260}>
          {() => TX_SOURCES.map((src) => (
            <OptionRow key={src.id} selected={srcFilter.includes(src.id)} onClick={() => setSrcFilter((cur) => (cur.includes(src.id) ? cur.filter((x) => x !== src.id) : [...cur, src.id]))}>
              {src.emoji}&nbsp;&nbsp;{src.label} <span className="text-slate-400">· {sourceCounts.get(src.id) ?? 0}</span>
            </OptionRow>
          ))}
        </FilterPopover>
        {tagCounts.length > 0 && (
          <FilterPopover title="Tag" icon={<Hash size={13} />} label={tagFilter.length ? `Tag · ${tagFilter.length}` : 'Tag'} active={tagFilter.length > 0} width={240}>
            {() => tagCounts.map(([tg, n]) => (
              <OptionRow key={tg} selected={tagFilter.includes(tg)} onClick={() => setTagFilter((cur) => toggleIn(cur, tg))}>
                #{tg} <span className="text-slate-400">· {n}</span>
              </OptionRow>
            ))}
          </FilterPopover>
        )}
        <button type="button" onClick={() => setRecurringOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200">
          <Repeat size={13} /> Transaksi berulang
        </button>
        <AnimatePresence>
          {hasFilter && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={resetFilter}
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-500 hover:text-slate-900"
            >
              <X size={14} /> Hapus filter
            </motion.button>
          )}
        </AnimatePresence>
        <span className="ml-auto shrink-0 pl-2">
          <FilterPopover title="Urutkan" label={SORTS.find((s) => s.id === sort)?.label} active={sort !== 'terbaru'} width={220} align="right">
            {(close) => SORTS.map((s) => (
              <OptionRow key={s.id} kind="radio" selected={sort === s.id} onClick={() => { setSort(s.id); close(); }}>{s.label}</OptionRow>
            ))}
          </FilterPopover>
        </span>
      </div>

      {/* Bar mode Pilih */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-indigo-50 px-4 py-2.5 text-sm">
              <span className="text-indigo-900">
                {selected.size ? <><b>{selected.size}</b> dipilih</> : 'Ketuk transaksi, atau tanggalnya untuk memilih sehari penuh.'}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSelected(new Set(filtered.map((t) => t.id!).filter(Boolean)))} className="rounded-full px-3 py-1.5 font-bold text-indigo-700 hover:bg-white">
                  Pilih semua {filtered.length}
                </button>
                <FilterPopover title="Ubah kategori ke…" label="Ubah kategori" align="right" width={240}>
                  {(close) => categoryOptions.map((c) => (
                    <OptionRow key={c} kind="radio" selected={false} onClick={() => { close(); void bulkCategory(c); }}>{categoryEmoji(c)}&nbsp;&nbsp;{c}</OptionRow>
                  ))}
                </FilterPopover>
                <button type="button" onClick={bulkDelete} disabled={!selected.size || bulkBusy} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-bold text-rose-600 hover:bg-white disabled:opacity-40">
                  <Trash2 size={14} /> Hapus
                </button>
                <button type="button" onClick={exitSelect} className="rounded-full px-3 py-1.5 font-bold text-slate-500 hover:bg-white">Batal</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daftar */}
      {loading ? (
        <div className="space-y-2 rounded-[24px] bg-white p-5 ring-1 ring-slate-100">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-white p-8 ring-1 ring-slate-100">
          {hasFilter ? (
            <EmptyState title="Tidak ada yang cocok" description="Coba ganti saringan atau kata kunci." icon={<Search size={24} />} />
          ) : (
            <EmptyState title="Belum ada transaksi" description="Catat transaksi pertamamu lewat suara, struk, atau tombol Tambah transaksi." icon={<ListOrdered size={24} />} />
          )}
        </motion.div>
      ) : (
        <motion.div key={listKey} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
          {groups.map((g, gi) => {
            const daySelected = g.items.length > 0 && g.items.every((t) => t.id && selected.has(t.id));
            return (
              <section key={g.key}>
                {g.date && (
                  <div className="group mb-1.5 flex items-center justify-between gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <SelectDot on={daySelected} show={selectMode} onClick={() => toggleDay(g.items)} label={`Pilih semua transaksi ${dayTitle(g.date)}`} />
                      <h2 className="text-sm font-bold text-slate-700 first-letter:uppercase">{dayTitle(g.date)}</h2>
                    </div>
                    <span className="text-xs font-bold tabular-nums">
                      {g.in > 0 && <span className="mr-2 text-emerald-600">+{formatIDR(g.in)}</span>}
                      {g.out > 0 && <span className="text-slate-500">−{formatIDR(g.out)}</span>}
                    </span>
                  </div>
                )}
                <ul className="overflow-hidden rounded-[22px] bg-slate-100/70">
                  {g.items.map((t, i) => {
                    const incoming = isIncomingTransaction(t);
                    const cat = categoryLabel(t);
                    const on = Boolean(t.id && selected.has(t.id));
                    return (
                      <motion.li
                        key={t.id}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: Math.min(gi * 0.04 + i * 0.015, 0.3) }}
                        onClick={() => (selectMode ? toggleOne(t.id) : setDetail(t))}
                        className={cn(
                          'group grid cursor-pointer grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 border-b border-white px-3 py-2.5 transition-colors duration-150 last:border-b-0 md:grid-cols-[auto_auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]',
                          on ? 'bg-indigo-50' : 'hover:bg-white'
                        )}
                      >
                        <SelectDot on={on} show={selectMode} onClick={() => toggleOne(t.id)} label={`Pilih ${t.note || cat}`} />
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">{isTransfer(t) ? '🔁' : categoryEmoji(cat)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">{t.note || t.subCategory || cat}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {txTags(t).slice(0, 2).map((x) => <span key={x} className="mr-1 rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-600">#{x}</span>)}
                            {formatTime(t.createdAt)}<span className="md:hidden"> · {cat} · {accountName(t.accountId)}</span>
                          </span>
                        </span>
                        <span className="hidden truncate text-sm text-slate-500 md:block">{cat}</span>
                        <span className="hidden truncate text-sm text-slate-500 md:block">{accountName(t.accountId)}</span>
                        <span className={cn('whitespace-nowrap text-right text-sm font-bold tabular-nums', isTransfer(t) ? 'text-slate-500' : incoming ? 'text-emerald-600' : 'text-slate-900')}>
                          {incoming ? '+' : '−'} {formatMoney(t.amount, t.currency)}
                        </span>
                        <span className={cn('flex items-center gap-0.5 transition-opacity duration-150', selectMode ? 'pointer-events-none opacity-0' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100')}>
                          {(t.type === 'pemasukan' || t.type === 'pengeluaran') && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); void handleDuplicate(t); }} aria-label="Duplikat transaksi" title="Duplikat ke hari ini" className="hidden rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:block">
                              <Copy size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleDelete(t); }}
                            disabled={deletingId === t.id}
                            aria-label="Hapus transaksi"
                            className="rounded-full p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-full bg-white py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              Muat lebih banyak ({filtered.length - shown} lagi)
            </button>
          )}
        </motion.div>
      )}

      <TxDetailModal
        knownTags={tagCounts.map(([x]) => x)}
        tx={detail}
        accountName={accountName}
        categoryLabel={categoryLabel}
        categories={categoryOptions}
        place={places.find((p) => p.transaction_id === detail?.id)}
        onClose={() => setDetail(null)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onAsk={(t) => {
          setDetail(null);
          openModal('ai_chat', { prompt: `Tolong bahas transaksi "${t.note || categoryLabel(t)}" sebesar ${formatMoney(t.amount, t.currency)} tanggal ${new Date(t.date).toLocaleDateString('id-ID')} (${categoryLabel(t)}, ${accountName(t.accountId)}). Wajar nggak dibanding kebiasaanku, dan ada saran hematnya?` });
        }}
      />
      <RecurringDrawer open={recurringOpen} onClose={() => setRecurringOpen(false)} />
    </div>
  );
}
