"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Download, Plus, ChevronDown, Tags, Wallet, CalendarDays, X, Paperclip, Hash, SlidersHorizontal, Check, CircleCheck } from 'lucide-react';
import { useTags } from '@/lib/useTags';
import { TagPicker, TagChip } from '@/components/tags/TagPicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DatePicker } from '@/components/ui/DatePicker';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { accountService, Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges, notifyCollectionChanged } from '@/lib/cf-firestore';
import { cn, isIncomingTransaction, isInvestmentFlow, formatIDR, formatMoney, toLocalDateString } from '@/lib/utils';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { usePrimaryAdd } from '@/lib/useRecordingPrefs';
import { attachmentService } from '@/lib/services/attachmentService';
import { HeaderSlot } from '@/components/Header';
import { BulkActionBar, BulkCategorySheet } from '@/components/transactions/BulkBar';

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
  { id: 'transfer', label: 'Transfer' },
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

// Chip filter ringkas (permintaan Bos: filter jangan makan ruang).
const chip = (active: boolean) =>
  cn(
    'shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors whitespace-nowrap',
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
  // Mode Pilih: pilih banyak transaksi → pindah kategori / hapus sekaligus.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [catSheet, setCatSheet] = useState(false);
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

  // Tautan dari Laporan/Rekening: ?kategori=…&rekening=…&periode=bulan|tahun|semua|tanggal=YYYY-MM-DD|jenis=transfer
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kat = params.get('kategori');
    const per = params.get('periode');
    const rek = params.get('rekening');
    const tg = params.get('tag');
    // Dari kalender Laporan: ?tanggal=YYYY-MM-DD → filter satu hari.
    const tgl = params.get('tanggal');
    // Halaman Transfer & Top Up lama → ?jenis=transfer.
    if (params.get('jenis') === 'transfer') setKind('transfer');
    if (tgl && /^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      const [y, m, d] = tgl.split('-').map(Number);
      setPickedDate(new Date(y, m - 1, d));
      setPeriod('tanggal');
      return;
    }
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

  // Pilihan hanya untuk yang sedang terlihat di filter — ganti filter = yang
  // tersembunyi dilepas, supaya tidak ada yang ikut terhapus tanpa terlihat.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(filtered.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !bulkBusy && !catSheet) exitSelect(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const toggle = (id?: string) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleMany = (items: Transaction[]) => {
    const ids = items.map((t) => t.id).filter((id): id is string => Boolean(id));
    setSelected((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) if (all) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectedTx = useMemo(() => filtered.filter((t) => t.id && selected.has(t.id)), [filtered, selected]);
  const selOut = selectedTx.filter(isSpend).reduce((s, t) => s + idr(t), 0);
  const selIn = selectedTx.filter(isEarn).reduce((s, t) => s + idr(t), 0);
  const catKind: 'pengeluaran' | 'pemasukan' | null =
    selectedTx.length > 0 && selectedTx.every(isSpend) ? 'pengeluaran' : selectedTx.length > 0 && selectedTx.every(isEarn) ? 'pemasukan' : null;
  const catReason = selectedTx.length === 0 ? null : catKind ? null : 'Pilih hanya pengeluaran atau hanya pemasukan untuk pindah kategori (transfer & investasi tidak bisa).';

  // Hapus satu per satu lewat endpoint yang sama dengan hapus biasa (saldo
  // dibalik di server). Transfer ikut menghapus pasangannya — id yang sudah
  // terhapus dilewati supaya saldo tidak dibalik dua kali.
  const bulkDelete = async () => {
    const list = selectedTx;
    if (list.length === 0) return;
    const transfers = list.filter((t) => t.type === 'transfer' || t.type === 'topup').length;
    const ok = await confirm({
      title: `Hapus ${list.length} transaksi?`,
      message: `Saldo rekening terkait dikembalikan${transfers > 0 ? '; transfer ikut menghapus sisi pasangannya' : ''}. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: `Hapus ${list.length}`,
      danger: true,
    });
    if (!ok) return;
    const gone = new Set<string>();
    let done = 0;
    try {
      for (const t of list) {
        if (!t.id || gone.has(t.id)) continue;
        setBulkBusy(`${done + 1}/${list.length}`);
        const ids = await transactionService.deleteTransaction(t);
        gone.add(t.id);
        ids.forEach((id) => gone.add(id));
        done++;
      }
      toast.success(`${gone.size} transaksi dihapus.`);
      exitSelect();
    } catch (e) {
      console.error(e);
      toast.error(`Berhenti setelah ${gone.size} transaksi terhapus — ${e instanceof Error && e.message ? e.message : 'coba lagi'}.`);
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkCategory = async (category: string) => {
    const list = selectedTx.filter((t) => t.id && t.category !== category);
    let done = 0;
    try {
      for (const t of list) {
        await transactionService.updateTransaction(t.id!, { category });
        done++;
        setTransactions((all) => all.map((x) => (x.id === t.id ? { ...x, category } : x)));
      }
      toast.success(`${selectedTx.length} transaksi dipindah ke ${category}.`);
      setCatSheet(false);
      exitSelect();
    } catch (e) {
      console.error(e);
      toast.error(`Baru ${done} dari ${list.length} yang dipindah. Silakan coba lagi.`);
    } finally {
      notifyCollectionChanged('transactions');
    }
  };

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

  const periodLabel = period === 'tanggal'
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(pickedDate)
    : PERIODS.find((p) => p.id === period)?.label ?? 'Bulan ini';

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      {/* Judul + aksi */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Transaksi</h1>
          <p className="text-[13px] text-slate-500">{loading ? 'Memuat…' : `${filtered.length} transaksi · ${periodLabel.toLowerCase()}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            disabled={filtered.length === 0}
            aria-pressed={selectMode}
            aria-label={selectMode ? 'Selesai memilih' : 'Pilih transaksi'}
            className={cn('flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold ring-1 transition-colors disabled:opacity-40 md:px-3.5', selectMode ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
          >
            {selectMode ? <Check size={15} /> : <CircleCheck size={15} />} <span className="hidden md:inline">{selectMode ? 'Selesai' : 'Pilih'}</span>
          </button>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={15} /> Ekspor CSV
            </button>
            <button
              type="button"
              onClick={primaryAdd}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)] hover:brightness-110"
            >
              <Plus size={15} strokeWidth={2.6} /> Tambah transaksi
            </button>
          </div>
          <HeaderSlot />
        </div>
      </div>

      {/* Ringkasan: satu kartu tipis tiga kolom */}
      {!loading && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-[18px] bg-white py-2.5 ring-1 ring-slate-100">
          {[
            { label: 'Keluar', value: totalOut, cls: 'text-slate-900', sign: '' },
            { label: 'Masuk', value: totalIn, cls: 'text-emerald-600', sign: '' },
            { label: 'Selisih', value: totalIn - totalOut, cls: totalIn - totalOut >= 0 ? 'text-slate-900' : 'text-rose-600', sign: totalIn - totalOut >= 0 ? '+' : '−' },
          ].map((x) => (
            <div key={x.label} className="min-w-0 px-3 md:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{x.label}</p>
              <p className={cn('truncate text-[14px] font-bold tabular-nums md:text-[16px]', x.cls)}>{x.sign}<Amount value={x.value} /></p>
            </div>
          ))}
        </div>
      )}
      {!loading && totalMove > 0 && kind === 'semua' && (
        <p className="-mt-2 hidden px-1 text-[12px] text-slate-400 md:block">{totalMove} transfer & pindah dana (termasuk beli/jual investasi) tidak dihitung di atas.</p>
      )}

      {/* Cari + filter (HP: dilipat di balik tombol Filter) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 md:max-w-[340px]">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, kategori, rekening, nominal"
              aria-label="Cari transaksi"
              className="w-full rounded-full bg-white py-2 pl-9 pr-4 text-[13px] text-slate-800 ring-1 ring-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn('relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold ring-1 md:hidden', showFilters ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200')}
          >
            <SlidersHorizontal size={15} /> Filter
            {activeFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] text-white">{activeFilters}</span>}
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <div className="flex shrink-0 rounded-full bg-slate-200/60 p-0.5">
              {KINDS.map((k) => (
                <button key={k.id} type="button" onClick={() => setKind(k.id)} title={k.id === 'transfer' ? 'Transfer, tabungan & beli/jual investasi' : undefined} className={cn('rounded-full px-3 py-1 text-[13px] font-semibold transition-colors', kind === k.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cn('-mx-4 items-center gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:px-0', showFilters ? 'flex' : 'hidden md:flex')}>
          {/* Jenis (HP saja; di desktop ada segmented di atas) */}
          <div className="flex shrink-0 rounded-full bg-slate-200/60 p-0.5 md:hidden">
            {KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} className={cn('rounded-full px-3 py-1 text-[13px] font-semibold', kind === k.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                {k.label}
              </button>
            ))}
          </div>
          <label className={cn(chip(period !== 'bulan'), 'relative flex items-center gap-1.5 pr-7')}>
            <CalendarDays size={14} />
            <span>{periodLabel}</span>
            <ChevronDown size={13} className="absolute right-2.5" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              aria-label="Periode"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="tanggal">Tanggal tertentu…</option>
            </select>
          </label>
          {period === 'tanggal' && (
            <div className="flex shrink-0 items-center gap-1">
              <DatePicker value={pickedDate} onChange={setPickedDate} />
              <button type="button" onClick={() => setPeriod('bulan')} aria-label="Hapus filter tanggal" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>
          )}
          <label className={cn(chip(Boolean(category)), 'relative flex items-center gap-1.5 pr-7')}>
            <Tags size={14} />
            <span className="max-w-[130px] truncate">{category || 'Kategori'}</span>
            <ChevronDown size={13} className="absolute right-2.5" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter kategori" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="">Semua kategori</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={cn(chip(Boolean(accountId)), 'relative flex items-center gap-1.5 pr-7')}>
            <Wallet size={14} />
            <span className="max-w-[130px] truncate">{accountId ? accountName.get(accountId) ?? 'Rekening' : 'Rekening'}</span>
            <ChevronDown size={13} className="absolute right-2.5" />
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Filter rekening" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="">Semua rekening</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {(tagsPref.enabled || tagOptions.length > 0) && (
            <label className={cn(chip(Boolean(tag)), 'relative flex items-center gap-1.5 pr-7')}>
              <Hash size={14} />
              <span className="max-w-[130px] truncate">{tag || 'Tag'}</span>
              <ChevronDown size={13} className="absolute right-2.5" />
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter tag" className="absolute inset-0 cursor-pointer opacity-0">
                <option value="">Semua tag</option>
                {tagOptions.map((x) => <option key={x} value={x}>#{x}</option>)}
              </select>
            </label>
          )}
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setKind('semua'); setCategory(''); setAccountId(''); setTag(''); setSearchQuery(''); setPeriod('bulan'); }}
              className="shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Reset
            </button>
          )}
          <label className="relative ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 pr-7 text-[13px] font-semibold text-slate-600 hover:bg-slate-100">
            {sort === 'terbaru' ? 'Terbaru' : sort === 'terlama' ? 'Terlama' : 'Terbesar'}
            <ChevronDown size={13} className="absolute right-2.5" />
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
        <div className={cn('space-y-5', selectMode && 'pb-24')}>
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-1.5 flex items-center justify-between px-2">
                {selectMode ? (
                  <button type="button" onClick={() => toggleMany(g.items)} className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800">
                    {(() => {
                      const n = g.items.filter((t) => t.id && selected.has(t.id)).length;
                      return (
                        <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 transition-colors', n === g.items.length ? 'bg-indigo-600 text-white ring-indigo-600' : n > 0 ? 'bg-indigo-100 ring-indigo-400' : 'ring-slate-300')}>
                          {n === g.items.length && <Check size={11} strokeWidth={3} />}
                          {n > 0 && n < g.items.length && <span className="h-0.5 w-2 rounded bg-indigo-600" />}
                        </span>
                      );
                    })()}
                    {g.label}
                  </button>
                ) : (
                  <h2 className="text-[13px] font-semibold text-slate-500">{g.label}</h2>
                )}
                {sort !== 'terbesar' && (
                  <p className="text-[12px] font-semibold tabular-nums text-slate-400">
                    {g.in > 0 && <span className="mr-3 text-emerald-600">+{formatIDR(g.in)}</span>}
                    {g.out > 0 && <span>−{formatIDR(g.out)}</span>}
                  </p>
                )}
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-100">
                {g.items.map((t) => {
                  const incoming = isIncoming(t);
                  const move = isMove(t);
                  const v = categoryVisual(t.category, t.type);
                  const isSel = Boolean(t.id && selected.has(t.id));
                  return (
                    <li
                      key={t.id}
                      onClick={(e) => {
                        if (selectMode) { if (!(e.target as HTMLElement).closest('a')) toggle(t.id); return; }
                        if (!(e.target as HTMLElement).closest('button,a,input')) setActionId((v) => (v === t.id ? null : t.id ?? null));
                      }}
                      className={cn(
                        'group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5 transition-colors md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-5 md:px-5',
                        selectMode ? (isSel ? 'bg-indigo-50/80' : 'hover:bg-slate-50') : 'md:cursor-default'
                      )}
                    >
                      {selectMode ? (
                        <span className={cn('relative flex h-9 w-9 items-center justify-center rounded-full text-[17px] transition-all duration-200', isSel ? 'scale-105 bg-indigo-600 text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.8)]' : cn(v.tile, 'ring-2 ring-slate-200'))} aria-hidden>
                          {isSel ? <Check size={18} strokeWidth={3} /> : <span className="opacity-60">{v.emoji}</span>}
                        </span>
                      ) : (
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-[17px]', v.tile)} aria-hidden>{v.emoji}</span>
                      )}
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-slate-900">
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
                        <p className="truncate text-[12px] text-slate-500">
                          {sort === 'terbesar' ? `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date))} · ` : ''}
                          {timeOf(t)}
                          <span className="md:hidden">{[t.category, accountName.get(t.accountId)].filter(Boolean).map((s) => ` · ${s}`).join('')}</span>
                        </p>
                      </div>
                      <p className="hidden truncate text-[13px] text-slate-500 md:block">{t.subCategory && t.subCategory !== titleOf(t) ? `${t.category} · ${t.subCategory}` : t.category}</p>
                      <p className="hidden truncate text-[13px] text-slate-500 md:block">{accountName.get(t.accountId) ?? '—'}</p>
                      <div className="text-right">
                        <p className={cn('whitespace-nowrap text-[14px] font-semibold tabular-nums', incoming ? 'text-emerald-600' : move ? 'text-slate-500' : 'text-slate-900')}>
                          {incoming ? '+' : '−'}{formatMoney(Number(t.amount) || 0, t.currency)}
                        </p>
                        {t.currency && t.currency !== 'IDR' && <p className="text-[12px] text-slate-400 tabular-nums">≈ {formatIDR(idr(t))}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id || selectMode}
                        aria-label="Hapus transaksi"
                        className="hidden rounded-lg p-2 text-slate-300 disabled:invisible transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 md:block md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                      {((t.tags?.length ?? 0) > 0 || tagEditId === t.id) && (
                        <div className="col-span-full -mt-1 flex flex-wrap items-center gap-1.5 pl-[48px] md:pl-[56px]">
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
                      {!selectMode && actionId === t.id && tagEditId !== t.id && (
                        <div className="col-span-full flex gap-2 pl-[48px] md:hidden">
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
              className="w-full rounded-full bg-white py-2.5 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Tampilkan lebih banyak ({filtered.length - shown} lagi)
            </button>
          )}
        </div>
      )}
      <BulkActionBar
        open={selectMode}
        count={selectedTx.length}
        total={filtered.length}
        out={selOut}
        inn={selIn}
        busy={bulkBusy ? `Menghapus ${bulkBusy}` : null}
        onSelectAll={() => setSelected(selectedTx.length === filtered.length ? new Set() : new Set(filtered.map((t) => t.id).filter((id): id is string => Boolean(id))))}
        onCategory={() => setCatSheet(true)}
        categoryDisabledReason={catReason}
        onDelete={() => void bulkDelete()}
        onClose={exitSelect}
      />
      {catSheet && catKind && (
        <BulkCategorySheet
          kind={catKind}
          count={selectedTx.length}
          current={selectedTx.every((t) => t.category === selectedTx[0]?.category) ? selectedTx[0]?.category ?? null : null}
          onClose={() => setCatSheet(false)}
          onPick={bulkCategory}
        />
      )}
    </div>
  );
}
