"use client";

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, CalendarDays, Coins, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryService, type Category } from '@/lib/services/categoryService';
import { budgetService, type Budget } from '@/lib/services/budgetService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { currencyService, type Currency } from '@/lib/services/currencyService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { budgetRealization, currentBudgetPeriod, formatBudgetPeriod, inBudgetPeriod } from '@/lib/budget';
import { useBudgetStartDay } from '@/lib/useBudgetStartDay';
import { categoryVisual, useCategoryStyles, useCategoryKinds, setCategoryKind, setCategoryStyle, CATEGORY_COLORS, CATEGORY_ICONS, type CategoryStyle } from '@/lib/categoryEmoji';
import { CATEGORY_TEMPLATE, DEFAULT_CATEGORY_GROUPS } from '@/lib/defaultCategories';
import { useFeedback } from '@/components/ui/Feedback';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';

// Query kategori/mata uang disaring di klien berdasarkan userId — wajib uid asli.
const uid = () => auth.currentUser?.uid ?? '';

// Kategori & Anggaran + Mata uang, ditampilkan di dalam panel Pengaturan
// (menggantikan halaman /membership/nama-akun & /membership/budget).
// Model data tetap sama: kategori = grup `category` dengan baris-baris
// `subCategory` (tabel categories), anggaran = tabel budgets per kategori.
// Jenis kategori (Pengeluaran/Pemasukan) disimpan di akun ($.prefs.categoryKinds);
// kategori lama yang belum punya jenis ditebak dari anggaran, transaksi, atau
// namanya (lihat kindOf).

export type Kind = 'pengeluaran' | 'pemasukan';

const INCOME_WORDS = ['pemasukan', 'gaji', 'bonus', 'thr', 'freelance', 'pendapatan', 'hadiah', 'dividen', 'bunga', 'komisi', 'penjualan', 'income', 'cashback', 'refund', 'upah', 'honor'];
const INCOME_SUGGESTIONS = CATEGORY_TEMPLATE.filter((t) => t.kind === 'pemasukan').map((t) => t.category);
const EXPENSE_SUGGESTIONS = CATEGORY_TEMPLATE.filter((t) => t.kind === 'pengeluaran').map((t) => t.category);

// Bulanan mengikuti awal periode anggaran (prefs.budgetStartDay); tahunan = tahun kalender.
const inPeriod = (t: Transaction, period: Budget['period'], now: Date, startDay: number) => {
  if (period === 'yearly') return new Date(t.date).getFullYear() === now.getFullYear();
  return inBudgetPeriod(t.date, currentBudgetPeriod(startDay, now));
};

export interface CategoryRow {
  name: string;
  kind: Kind;
  subs: Category[];
  spent: number; // periode anggaran (bulan ini, atau tahun ini untuk anggaran tahunan)
  budget: Budget | null;
}

// Satu sumber data untuk daftar & detail: kategori, anggaran, transaksi.
export function useCategoryData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const kinds = useCategoryKinds();
  const { day: startDay } = useBudgetStartDay();

  useEffect(() => {
    let active = true;
    const loadCats = () => categoryService.getUserCategories(uid()).then((c) => active && setCategories(c)).catch(console.error);
    const loadBudgets = () => budgetService.getUserBudgets('session').then((b) => active && setBudgets(b)).catch(console.error);
    const loadTrx = () => transactionService.getUserTransactions('session').then((t) => active && setTransactions(t)).catch(console.error);
    Promise.all([loadBudgets(), loadTrx()]).finally(() => active && setLoading(false));
    const unsubAuth = onAuthStateChanged(auth, (u) => { if (u) void loadCats(); });
    const unsubs = [
      subscribeToCollectionChanges('categories', loadCats),
      subscribeToCollectionChanges('budgets', loadBudgets),
      subscribeToCollectionChanges('transactions', loadTrx),
    ];
    return () => { active = false; unsubAuth(); unsubs.forEach((u) => u()); };
  }, []);

  const rows = useMemo(() => {
    const now = new Date();
    const groups = new Map<string, Category[]>();
    for (const c of categories) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
    // Kategori yang belum ada di daftar tapi dipakai transaksi bulan ini / punya anggaran ikut tampil.
    for (const t of transactions) if ((t.type === 'pengeluaran' || t.type === 'pemasukan') && t.category && inPeriod(t, 'monthly', now, startDay) && !groups.has(t.category)) groups.set(t.category, []);
    for (const b of budgets) if (!groups.has(b.category)) groups.set(b.category, []);

    const savedKind = (name: string) => kinds[name] ?? Object.entries(kinds).find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1];
    const kindOf = (name: string): Kind => {
      const lower = name.toLowerCase();
      const budget = budgets.find((b) => b.category.toLowerCase() === lower);
      if (budget) return budget.type;
      const saved = savedKind(name);
      if (saved) return saved;
      let inc = 0;
      let out = 0;
      for (const t of transactions) {
        if ((t.category || '').toLowerCase() !== lower) continue;
        if (t.type === 'pemasukan') inc++;
        else if (t.type === 'pengeluaran') out++;
      }
      if (inc || out) return inc > out ? 'pemasukan' : 'pengeluaran';
      return INCOME_WORDS.some((w) => lower.includes(w)) ? 'pemasukan' : 'pengeluaran';
    };

    return [...groups.entries()].map(([name, subs]): CategoryRow => {
      const kind = kindOf(name);
      const budget = budgets.find((b) => b.category.toLowerCase() === name.toLowerCase() && b.type === kind) ?? null;
      const period = budget?.period ?? 'monthly';
      const periodTx = transactions.filter((t) => inPeriod(t, period, now, startDay));
      const spent = budgetRealization({ id: '', userId: '', type: kind, category: name, amount: budget?.amount ?? 0, period, createdAt: now }, periodTx).total;
      return { name, kind, subs: [...subs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), spent, budget };
    }).sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || b.spent - a.spent || a.name.localeCompare(b.name, 'id'));
  }, [categories, budgets, transactions, kinds, startDay]);

  return { rows, loading };
}

// Pemilih ikon & warna (muncul saat lingkaran ikon kategori diketuk).
function IconPicker({ value, onPick, onClose }: { value: CategoryStyle; onPick: (s: CategoryStyle) => void; onClose: () => void }) {
  const [style, setStyle] = useState<CategoryStyle>(value);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/30 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label="Pilih ikon & warna" className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pb-2">
          <span className={cn('flex h-20 w-20 items-center justify-center rounded-[26px] text-[38px]', CATEGORY_COLORS[style.color]?.tile)} aria-hidden>{style.emoji}</span>
        </div>
        <p className="px-1 pb-2 text-[14px] text-slate-500">Warna</p>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(CATEGORY_COLORS).map(([key, c]) => (
            <button key={key} type="button" aria-label={`Warna ${key}`} onClick={() => setStyle((s) => ({ ...s, color: key }))}
              className={cn('h-10 w-10 rounded-full ring-offset-2 transition', c.swatch, style.color === key ? 'ring-2 ring-slate-900' : 'hover:scale-105')} />
          ))}
        </div>
        <p className="px-1 pb-2 pt-4 text-[14px] text-slate-500">Ikon</p>
        <div className="grid grid-cols-6 gap-1.5">
          {CATEGORY_ICONS.map((emoji) => (
            <button key={emoji} type="button" aria-label={`Ikon ${emoji}`} onClick={() => setStyle((s) => ({ ...s, emoji }))}
              className={cn('flex aspect-square items-center justify-center rounded-2xl text-[26px]', style.emoji === emoji ? 'bg-slate-100 ring-2 ring-slate-900' : 'hover:bg-slate-50')}>
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-slate-100 py-3 text-[15px] font-semibold text-slate-700">Batal</button>
          <button type="button" onClick={() => { onPick(style); onClose(); }} className="flex-1 rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white">Pakai</button>
        </div>
      </div>
    </div>
  );
}

// Warna bawaan untuk pemilih: tebak dari tile bawaan kategori (mis. bg-orange-50 → orange).
const defaultStyle = (name: string, kind: Kind): CategoryStyle => {
  const v = categoryVisual(name, kind);
  const color = Object.keys(CATEGORY_COLORS).find((k) => v.tile.includes(`-${k}-`)) ?? (v.tile.includes('emerald') ? 'green' : v.tile.includes('rose') ? 'red' : v.tile.includes('yellow') ? 'amber' : 'slate');
  return { emoji: name.trim() ? v.emoji : '✨', color };
};

const AvatarButton = ({ emoji, tile, onClick }: { emoji: string; tile: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="Ganti ikon & warna" className={cn('group relative flex h-20 w-20 items-center justify-center rounded-[26px] text-[38px] shadow-[inset_0_-4px_0_rgba(15,23,42,0.06)] transition hover:scale-105', tile)}>
    <span aria-hidden>{emoji}</span>
    <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow ring-1 ring-slate-200">Ubah</span>
  </button>
);

// Cincin persen anggaran (pengganti bar tipis) — warna ikut status.
function BudgetRing({ pct, over }: { pct: number; over: boolean }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const shown = Math.min(100, pct);
  const color = over ? '#f43f5e' : pct >= 80 ? '#f59e0b' : '#6366f1';
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center" aria-label={`${Math.round(pct)}% anggaran terpakai`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(shown / 100) * c} ${c}`} />
      </svg>
      <span className={cn('text-[11px] font-bold tabular-nums', over ? 'text-rose-600' : 'text-slate-700')}>{Math.round(pct)}%</span>
    </span>
  );
}

export function KategoriListView({ rows, loading, onOpen, onAdd }: { rows: CategoryRow[]; loading: boolean; onOpen: (name: string) => void; onAdd: (kind: Kind) => void }) {
  const { day: startDay } = useBudgetStartDay();
  const periodText = startDay === 1 ? 'bulan ini' : `periode ${formatBudgetPeriod(currentBudgetPeriod(startDay))}`;
  useCategoryStyles();
  const [tab, setTab] = useState<Kind>('pengeluaran');
  const list = rows.filter((r) => r.kind === tab);
  const isOut = tab === 'pengeluaran';
  const total = list.reduce((s, r) => s + r.spent, 0);
  const budgeted = list.filter((r) => r.budget && r.budget.period === 'monthly');
  const budgetTotal = budgeted.reduce((s, r) => s + (r.budget?.amount ?? 0), 0);
  const budgetUsed = budgeted.reduce((s, r) => s + r.spent, 0);
  const overall = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-[20px] bg-slate-100 p-1.5">
        {(['pengeluaran', 'pemasukan'] as Kind[]).map((k) => {
          const Icon = k === 'pengeluaran' ? ArrowDownRight : ArrowUpRight;
          const on = tab === k;
          return (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('flex items-center justify-center gap-2 rounded-[15px] py-2.5 text-[14px] font-semibold capitalize transition-colors', on ? (k === 'pengeluaran' ? 'bg-white text-indigo-700 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : 'text-slate-500 hover:text-slate-700')}>
              <Icon size={16} strokeWidth={2.4} /> {k}
            </button>
          );
        })}
      </div>

      <div className={cn('relative overflow-hidden rounded-[24px] p-5 text-white', isOut ? 'bg-gradient-to-br from-indigo-600 to-violet-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600')}>
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/80">{isOut ? 'Pengeluaran' : 'Pemasukan'} {periodText}</p>
            <p className="mt-0.5 truncate text-[26px] font-extrabold tabular-nums">{formatIDR(total)}</p>
            <p className="text-[12px] text-white/75">{list.length} kategori{isOut && budgetTotal > 0 ? ` · anggaran ${formatIDR(budgetTotal)}` : ''}</p>
          </div>
          <button type="button" onClick={() => onAdd(tab)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-[13px] font-bold hover:bg-white/30">
            <Plus size={15} strokeWidth={2.6} /> Kategori
          </button>
        </div>
        {isOut && budgetTotal > 0 && (
          <div className="relative mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className={cn('h-full rounded-full', overall > 100 ? 'bg-rose-300' : 'bg-white')} style={{ width: `${Math.min(100, overall)}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-white/80">{Math.round(overall)}% anggaran terpakai</p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-[14px] text-slate-400">Memuat…</p>
      ) : list.length === 0 ? (
        <p className="rounded-[22px] bg-slate-50 py-8 text-center text-[14px] text-slate-500">Belum ada kategori {tab}.</p>
      ) : (
        <ul className="grid gap-2.5">
          {list.map((r) => {
            const v = categoryVisual(r.name, r.kind);
            const amount = r.budget?.amount ?? 0;
            const pct = amount > 0 ? (r.spent / amount) * 100 : 0;
            const over = amount > 0 && r.spent > amount && r.kind === 'pengeluaran';
            return (
              <li key={r.name}>
                <button type="button" onClick={() => onOpen(r.name)} className={cn('flex w-full items-center gap-3 rounded-[20px] bg-white p-3 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md', over ? 'ring-rose-200' : 'ring-slate-200/70')}>
                  <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[23px]', v.tile)} aria-hidden>{v.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-900">{r.name}</span>
                    <span className={cn('block truncate text-[13px] tabular-nums', over ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                      {formatIDR(r.spent)}{amount > 0 ? ` / ${formatIDR(amount)}${r.budget?.period === 'yearly' ? ' thn' : ''}` : ''}
                    </span>
                  </span>
                  {r.kind === 'pengeluaran' ? (
                    amount > 0 ? <BudgetRing pct={pct} over={over} /> : <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">Atur anggaran</span>
                  ) : (
                    <span className="shrink-0 text-[12px] text-slate-400">{r.subs.length} sub</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-center gap-2 px-1 text-[12px] text-slate-500">
        <CalendarDays size={14} />
        {startDay === 1
          ? 'Anggaran bulanan dihitung per bulan kalender (tanggal 1 sampai akhir bulan).'
          : `Anggaran bulanan dihitung mulai tanggal ${startDay} tiap bulan (periode sekarang ${formatBudgetPeriod(currentBudgetPeriod(startDay))}).`}
      </p>
      {isOut && (
        <a href="/membership/budget" className="flex items-center justify-between rounded-[18px] bg-indigo-50 px-4 py-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100">
          Lihat halaman Anggaran — sisa, laju belanja & ubah semua sekaligus <span aria-hidden>→</span>
        </a>
      )}
    </div>
  );
}

export function KategoriDetailView({ row, onDone }: { row: CategoryRow; onDone: () => void }) {
  const { day: startDay } = useBudgetStartDay();
  const { toast, confirm } = useFeedback();
  const [amount, setAmount] = useState(row.budget ? String(Math.round(row.budget.amount)) : '');
  const [period, setPeriod] = useState<Budget['period']>(row.budget?.period ?? 'monthly');
  const [newSub, setNewSub] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  useCategoryStyles();
  const v = categoryVisual(row.name, row.kind);
  const pickStyle = (style: CategoryStyle) => {
    setCategoryStyle(row.name, style).catch(() => toast.error('Gagal menyimpan ikon. Coba lagi.'));
  };

  const saveBudget = async () => {
    const value = Number(amount.replace(/[^\d]/g, ''));
    setBusy(true);
    try {
      if (!value) {
        if (row.budget?.id) await budgetService.deleteBudget(row.budget.id);
        toast.success('Anggaran dihapus.');
      } else if (row.budget?.id) {
        await budgetService.updateBudget(row.budget.id, { amount: value, period });
        toast.success('Anggaran disimpan.');
      } else {
        await budgetService.createBudget({ userId: uid(), type: row.kind, category: row.name, amount: value, period });
        toast.success('Anggaran disimpan.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan anggaran. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const addSub = async () => {
    const names = newSub.split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    try {
      for (const subCategory of names) {
        if (row.subs.some((s) => s.subCategory.toLowerCase() === subCategory.toLowerCase())) continue;
        await categoryService.createCategory({ userId: uid(), category: row.name, subCategory, status: 'VERIFIED' });
      }
      setNewSub('');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menambah subkategori.');
    } finally {
      setBusy(false);
    }
  };

  const removeSub = async (c: Category) => {
    if (!c.id) return;
    const ok = await confirm({ title: `Hapus subkategori "${c.subCategory}"?`, message: 'Transaksi lama yang memakainya tetap ada.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try { await categoryService.deleteCategory(c.id); } catch (e) { console.error(e); toast.error('Gagal menghapus subkategori.'); }
  };

  const removeGroup = async () => {
    const ok = await confirm({
      title: `Hapus kategori "${row.name}"?`,
      message: `${row.subs.length} subkategori${row.budget ? ' dan anggarannya' : ''} ikut dihapus. Transaksi lama tetap ada.`,
      confirmLabel: 'Hapus kategori',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      for (const c of row.subs) if (c.id) await categoryService.deleteCategory(c.id);
      if (row.budget?.id) await budgetService.deleteBudget(row.budget.id);
      setCategoryStyle(row.name, null).catch(() => undefined);
      toast.success('Kategori dihapus.');
      onDone();
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus. Sebagian mungkin masih tersisa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <AvatarButton emoji={v.emoji} tile={v.tile} onClick={() => setPicking(true)} />
        {picking && <IconPicker value={defaultStyle(row.name, row.kind)} onPick={pickStyle} onClose={() => setPicking(false)} />}
        <p className="text-[20px] font-bold text-slate-900">{row.name}</p>
        <p className="flex items-center gap-2 text-[14px] text-slate-500">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', row.kind === 'pemasukan' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700')}>{row.kind === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</span>
          {formatIDR(row.spent)} {row.budget?.period === 'yearly' ? 'tahun ini' : startDay === 1 ? 'bulan ini' : 'periode ini'}
        </p>
      </div>

      {row.kind === 'pengeluaran' && (
        <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
          <p className="text-[14px] font-semibold text-slate-700">Anggaran</p>
          <div className="flex rounded-full bg-slate-200/60 p-1">
            {(['monthly', 'yearly'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={cn('flex-1 rounded-full py-1.5 text-[13px] font-semibold', period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                {p === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400">
            <span className="text-[15px] text-slate-400">Rp</span>
            <input
              inputMode="numeric"
              value={amount ? Number(amount.replace(/[^\d]/g, '') || 0).toLocaleString('id-ID') : ''}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Tanpa anggaran"
              aria-label="Jumlah anggaran"
              className="w-full bg-transparent py-3 text-[16px] font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          <button type="button" onClick={saveBudget} disabled={busy} className="w-full rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white disabled:opacity-60">
            Simpan anggaran
          </button>
          <p className="text-[12px] text-slate-500">Kosongkan lalu simpan untuk menghapus anggaran.</p>
        </div>
      )}

      <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
        <p className="text-[14px] font-semibold text-slate-700">Subkategori</p>
        {row.subs.length === 0 ? (
          <p className="text-[13px] text-slate-500">Belum ada subkategori. Tambahkan supaya muncul di form pencatatan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {row.subs.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3.5 pr-1.5 text-[14px] text-slate-800 ring-1 ring-slate-200">
                {c.subCategory}
                <button type="button" onClick={() => removeSub(c)} aria-label={`Hapus ${c.subCategory}`} className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addSub(); }}
            placeholder="Subkategori baru (pisahkan dengan koma)"
            aria-label="Subkategori baru"
            className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-2.5 text-[14px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="button" onClick={addSub} disabled={busy || !newSub.trim()} className="rounded-2xl bg-slate-900 px-4 text-[14px] font-bold text-white disabled:opacity-40">Tambah</button>
        </div>
      </div>

      {row.subs.length > 0 || row.budget ? (
        <button type="button" onClick={removeGroup} disabled={busy} className="flex w-full items-center justify-center gap-2 py-2 text-[14px] font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50">
          <Trash2 size={15} /> Hapus kategori
        </button>
      ) : null}
    </div>
  );
}

export function KategoriBaruView({ initialKind, existing, onDone }: { initialKind: Kind; existing: string[]; onDone: (name: string) => void }) {
  const { toast } = useFeedback();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [name, setName] = useState('');
  const [subs, setSubs] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<CategoryStyle | null>(null);
  const [picking, setPicking] = useState(false);
  const exists = existing.some((e) => e.toLowerCase() === name.trim().toLowerCase());
  const suggestions = (kind === 'pemasukan' ? INCOME_SUGGESTIONS : EXPENSE_SUGGESTIONS)
    .filter((s) => !existing.some((e) => e.toLowerCase() === s.toLowerCase()));
  const auto = defaultStyle(name, kind);
  const shown = picked ?? auto;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || exists) return;
    const subList = subs.split(',').map((s) => s.trim()).filter(Boolean);
    const preset = DEFAULT_CATEGORY_GROUPS.find((g) => g.category.toLowerCase() === trimmed.toLowerCase());
    const finalSubs = subList.length ? subList : preset?.subs ?? ['Umum'];
    setBusy(true);
    try {
      for (const subCategory of finalSubs) await categoryService.createCategory({ userId: uid(), category: trimmed, subCategory, status: 'VERIFIED' });
      const value = Number(amount.replace(/[^\d]/g, ''));
      if (value > 0) await budgetService.createBudget({ userId: uid(), type: kind, category: trimmed, amount: value, period: 'monthly' });
      await setCategoryKind(trimmed, kind).catch(() => undefined);
      const templ = CATEGORY_TEMPLATE.find((t) => t.category.toLowerCase() === trimmed.toLowerCase());
      const style = picked ?? (templ ? { emoji: templ.emoji, color: templ.color } : null);
      if (style) await setCategoryStyle(trimmed, style).catch(() => toast.error('Kategori tersimpan, tapi ikonnya gagal disimpan.'));
      toast.success(`Kategori ${trimmed} ditambahkan.`);
      onDone(trimmed);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menambah kategori. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-[22px] bg-slate-50 p-4">
        <div className="flex justify-center">
          <AvatarButton emoji={shown.emoji} tile={CATEGORY_COLORS[shown.color]?.tile ?? 'bg-slate-100'} onClick={() => setPicking(true)} />
          {picking && <IconPicker value={shown} onPick={setPicked} onClose={() => setPicking(false)} />}
        </div>
        <div className="flex rounded-full bg-slate-200/60 p-1">
          {(['pengeluaran', 'pemasukan'] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn('flex-1 rounded-full py-2 text-[14px] font-semibold capitalize', kind === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{k}</button>
          ))}
        </div>
        <label className="block">
          <span className="px-1 text-[13px] text-slate-500">Nama kategori</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kopi" className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-[16px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400" />
          {exists && <span className="mt-1 block px-1 text-[12px] text-rose-600">Kategori ini sudah ada.</span>}
        </label>
        <label className="block">
          <span className="px-1 text-[13px] text-slate-500">Subkategori (opsional, pisahkan koma)</span>
          <input value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="mis. Kopi susu, Kopi hitam" className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400" />
        </label>
        {kind === 'pengeluaran' && (
          <label className="block">
            <span className="px-1 text-[13px] text-slate-500">Anggaran bulanan (opsional)</span>
            <div className="mt-1 flex items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400">
              <span className="text-[15px] text-slate-400">Rp</span>
              <input inputMode="numeric" value={amount ? Number(amount).toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" className="w-full bg-transparent py-3 text-[15px] outline-none" />
            </div>
          </label>
        )}
      </div>
      {suggestions.length > 0 && (
        <div>
          <p className="px-1 pb-2 text-[13px] text-slate-500">Saran</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-[14px] text-slate-800 hover:bg-slate-200">
                <span aria-hidden>{categoryVisual(s, kind).emoji}</span> {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={save} disabled={busy || !name.trim() || exists} className="w-full rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white disabled:bg-slate-100 disabled:text-slate-400">
        Tambah kategori
      </button>
    </div>
  );
}

export function MataUangView({ onAdd }: { onAdd: () => void }) {
  const { toast, confirm } = useFeedback();
  const [list, setList] = useState<Currency[] | null>(null);
  useEffect(() => {
    let unsubCur: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubCur?.();
      unsubCur = u ? currencyService.getUserCurrencies(u.uid, (c) => setList(c)) : undefined;
    });
    return () => { unsubAuth(); unsubCur?.(); };
  }, []);

  const remove = async (c: Currency) => {
    if (!c.id) return;
    const ok = await confirm({ title: `Hapus ${c.code}?`, message: 'Rekening & transaksi yang sudah memakai mata uang ini tidak berubah.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try { await currencyService.deleteCurrency(c.id); setList((l) => l?.filter((x) => x.id !== c.id) ?? l); } catch (e) { console.error(e); toast.error('Gagal menghapus mata uang.'); }
  };

  return (
    <div className="space-y-4">
      <p className="px-1 text-[14px] text-slate-500">Mata uang yang bisa dipakai di rekening & transaksi. Semua laporan tetap dihitung dalam Rupiah.</p>
      <ul className="divide-y divide-slate-200/60 overflow-hidden rounded-[22px] bg-slate-50">
        <li className="flex items-center gap-4 px-5 py-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[16px] font-semibold text-slate-700">Rp</span>
          <span className="flex-1"><span className="block text-[16px] text-slate-900">Rupiah Indonesia</span><span className="text-[13px] text-slate-500">IDR · mata uang utama</span></span>
        </li>
        {list === null ? (
          <li className="px-5 py-4 text-[14px] text-slate-400">Memuat…</li>
        ) : (
          list.filter((c) => c.code !== 'IDR').map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[15px] font-semibold text-slate-700">{c.symbol || <Coins size={18} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[16px] text-slate-900">{c.name}</span><span className="text-[13px] text-slate-500">{c.code}</span></span>
              <button type="button" onClick={() => remove(c)} aria-label={`Hapus ${c.code}`} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={16} /></button>
            </li>
          ))
        )}
      </ul>
      <button type="button" onClick={onAdd} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white">
        <Plus size={17} /> Tambah mata uang
      </button>
    </div>
  );
}

// Daftar ↔ detail ↔ tambah dalam satu komponen supaya data dimuat sekali
// (dan hanya saat bagian ini dibuka).
export function KategoriSection({ view, go }: { view: 'kategori' | 'kategori-detail' | 'kategori-baru'; go: (v: 'kategori' | 'kategori-detail' | 'kategori-baru') => void }) {
  const { rows, loading } = useCategoryData();
  const [selected, setSelected] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<Kind>('pengeluaran');
  const row = rows.find((r) => r.name === selected);

  if (view === 'kategori-baru') {
    return <KategoriBaruView initialKind={newKind} existing={rows.map((r) => r.name)} onDone={(name) => { setSelected(name); go('kategori-detail'); }} />;
  }
  if (view === 'kategori-detail' && row) {
    return <KategoriDetailView key={`${row.name}-${row.budget?.id ?? ''}`} row={row} onDone={() => go('kategori')} />;
  }
  return <KategoriListView rows={rows} loading={loading} onOpen={(name) => { setSelected(name); go('kategori-detail'); }} onAdd={(k) => { setNewKind(k); go('kategori-baru'); }} />;
}
