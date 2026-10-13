"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { budgetService, type Budget } from '@/lib/services/budgetService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { categoryService } from '@/lib/services/categoryService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { budgetRealization } from '@/lib/budget';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Anggaran gaya baru (pola Oyenza): sisa anggaran + per hari + perkiraan akhir
// periode, per kategori dengan penanda hari ini & status "Terlalu cepat",
// daftar "Belum ada anggaran", popup ubah anggaran per kategori, dan panel
// "Kategori & anggaran" (Pengeluaran/Pemasukan). Data: tabel budgets yang ada.

type Kind = Budget['type'];
const short = (n: number) => (Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toFixed(2).replace('.', ',')} jt` : Math.abs(n) >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : `Rp${Math.round(n)}`);
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const capOf = (b: Budget) => (b.period === 'yearly' ? b.amount / 12 : b.amount);
const HIDE_KEY = 'leo-budget-hide:v1';

export default function BudgetPage() {
  const reduce = useReducedMotion();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [all, setAll] = useState<Transaction[]>([]);
  const [userCats, setUserCats] = useState<string[]>([]);
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [edit, setEdit] = useState<{ category: string; type: Kind; budget?: Budget } | null>(null);
  const [manage, setManage] = useState(false);
  const [info, setInfo] = useState(false);

  const load = useCallback(() => {
    budgetService.getUserBudgets('session').then(setBudgets).catch(() => setBudgets([]));
  }, []);
  useEffect(() => {
    load();
    const loadTx = () => transactionService.getUserTransactions('session').then(setAll).catch(() => {});
    loadTx();
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me')
      .then((r) => (r.user?.id ? categoryService.getUserCategories(r.user.id) : []))
      .then((cs) => setUserCats([...new Set(cs.map((c) => c.category).filter(Boolean))]))
      .catch(() => {});
    const a = subscribeToCollectionChanges('budgets', load);
    const b = subscribeToCollectionChanges('transactions', loadTx);
    return () => {
      a();
      b();
    };
  }, [load]);

  const toggleHidden = () => {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        /* abaikan */
      }
      return !h;
    });
  };

  const isCurrent = month === now.getMonth() && year === now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const elapsed = isCurrent ? now.getDate() : daysInMonth;
  const daysLeft = isCurrent ? daysInMonth - now.getDate() + 1 : 0;
  const dayFrac = elapsed / daysInMonth;
  const shift = (d: number) => {
    const x = new Date(year, month + d, 1);
    setMonth(x.getMonth());
    setYear(x.getFullYear());
  };
  const monthTx = useMemo(() => all.filter((t) => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === month; }), [all, month, year]);

  const r = useMemo(() => {
    const list = budgets ?? [];
    const exp = list.filter((b) => b.type === 'pengeluaran');
    const inc = list.filter((b) => b.type === 'pemasukan');
    const rows = exp
      .map((b) => {
        const spent = budgetRealization(b, monthTx).total;
        const cap = capOf(b);
        const projected = elapsed > 0 ? (spent / elapsed) * daysInMonth : spent;
        const full = cap > 0 && spent >= cap * 0.999 && spent <= cap;
        return { b, spent, cap, full, over: spent > cap, fast: !full && spent <= cap && projected > cap * 1.0001 && isCurrent, frac: cap > 0 ? spent / cap : 0 };
      })
      .sort((x, y) => (y.over ? 1e9 : y.frac) - (x.over ? 1e9 : x.frac) || y.spent - x.spent);
    const budgeted = new Set(exp.map((b) => b.category.toLowerCase()));
    const spendByCat = new Map<string, number>();
    for (const t of monthTx) {
      if (t.type !== 'pengeluaran' || isInvestmentCategory(t.category)) continue;
      spendByCat.set(t.category || 'Lainnya', (spendByCat.get(t.category || 'Lainnya') ?? 0) + toIdr(t));
    }
    const unbudgeted = [...spendByCat.entries()].filter(([c]) => !budgeted.has(c.toLowerCase())).sort((x, y) => y[1] - x[1]);
    const cap = rows.reduce((s, x) => s + x.cap, 0);
    const spent = rows.reduce((s, x) => s + x.spent, 0);
    const outside = unbudgeted.reduce((s, [, v]) => s + v, 0);
    const totalSpent = spent + outside;
    const projected = elapsed > 0 ? (totalSpent / elapsed) * daysInMonth : totalSpent;
    const incomeRows = inc.map((b) => ({ b, ...budgetRealization(b, monthTx) }));
    return { rows, unbudgeted, cap, spent, outside, left: cap - spent, projected, incomeRows, spendByCat };
  }, [budgets, monthTx, elapsed, daysInMonth, isCurrent]);

  const periodLabel = `1 – ${daysInMonth} ${new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month, 1))}`;
  const card = 'rounded-[26px] bg-white p-5 ring-1 ring-slate-100 md:p-6';
  const money = (n: number) => (hidden ? 'Rp •••' : formatIDR(n));
  const loading = budgets === null;
  const status = r.left < 0 ? 'over' : r.cap > 0 && r.spent / r.cap > dayFrac + 0.1 ? 'fast' : 'ok';

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <h1 className="sr-only">Anggaran</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={periodLabel} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} className="text-sm text-slate-500">
              {periodLabel}{isCurrent ? <> · sisa <b className="text-slate-800">{daysLeft} hari</b></> : ''}
            </motion.p>
          </AnimatePresence>
          <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label="Bulan berikutnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setInfo(true)} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <CalendarDays size={14} /> Periode anggaran
          </button>
          <button type="button" onClick={() => setManage(true)} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-slate-800">
            <Pencil size={14} /> Ubah anggaran
          </button>
        </div>
      </div>

      <motion.div key={`${year}-${month}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {/* Sisa anggaran */}
          <div className={card}>
            {loading ? <Skeleton className="h-32" /> : r.cap === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <LeoMascot mood="idle" size={96} interactive />
                <p className="mt-2 font-bold text-slate-900">Belum ada anggaran</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">Atur anggaran bulanan di kategorimu untuk melihat kondisinya.</p>
                <button type="button" onClick={() => setManage(true)} className="mt-4 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Atur anggaran</button>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  {r.left < 0 ? 'Lewat anggaran' : 'Sisa anggaran'}
                  <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </p>
                <p className={cn('text-[38px] font-extrabold leading-tight tracking-tight tabular-nums', r.left < 0 ? 'text-rose-500' : 'text-slate-900')}>
                  {hidden ? 'Rp •••' : <AnimatedNumber value={Math.abs(r.left)} format={formatIDR} />}
                </p>
                <p className="text-sm text-slate-600">
                  {isCurrent && r.left > 0 ? <>{hidden ? 'Rp •••' : short(r.left / daysLeft)} per hari sampai {daysInMonth} {new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(year, month, 1))}</> : r.left < 0 ? 'Rem dulu belanja yang tidak mendesak.' : 'Periode ini sudah berakhir.'}
                </p>
                {r.outside > 0 && <p className="text-sm text-slate-400">{hidden ? 'Rp •••' : short(r.outside)} di luar anggaran</p>}
                <div className="relative mt-4 h-3 rounded-full bg-slate-100">
                  <motion.div
                    className={cn('h-full rounded-full', status === 'over' ? 'bg-rose-500' : status === 'fast' ? 'bg-amber-500' : 'bg-slate-900')}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${Math.min(100, (r.spent / r.cap) * 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                  {isCurrent && <div className="absolute -top-1 h-5 w-0.5 rounded-full bg-slate-500" style={{ left: `${dayFrac * 100}%` }} title="Hari ini" />}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Terpakai {money(r.spent)} dari {money(r.cap)}{isCurrent ? <> · perkiraan <b className={r.projected > r.cap ? 'text-amber-600' : 'text-slate-700'}>{hidden ? 'Rp •••' : short(r.projected)}</b> di akhir periode</> : ''}
                </p>
              </>
            )}
          </div>

          {/* Per kategori */}
          {r.rows.length > 0 && (
            <div className={card}>
              <p className="font-bold text-slate-900">Per kategori</p>
              <p className="mb-3 text-xs text-slate-400">Penanda menunjukkan seberapa jauh periode sudah berjalan</p>
              <ul className="space-y-1">
                {r.rows.map((x, i) => (
                  <motion.li key={x.b.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <button type="button" onClick={() => setEdit({ category: x.b.category, type: 'pengeluaran', budget: x.b })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-lg">{categoryEmoji(x.b.category)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{x.b.category}</span>
                          <span className={cn('shrink-0 text-xs font-bold', x.over ? 'text-rose-500' : 'text-slate-700')}>{x.over ? `Lewat ${short(x.spent - x.cap)}` : x.full ? 'Habis' : `Sisa ${short(x.cap - x.spent)}`}</span>
                        </span>
                        <span className="relative mt-1.5 block h-2 rounded-full bg-slate-100">
                          <motion.span
                            className={cn('block h-full rounded-full', x.over ? 'bg-rose-500' : x.fast ? 'bg-amber-500' : 'bg-slate-900')}
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${Math.min(100, x.frac * 100)}%` }}
                            transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                          />
                          {isCurrent && <span className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-slate-400" style={{ left: `${dayFrac * 100}%` }} />}
                        </span>
                        <span className={cn('mt-1 block text-xs', x.over || x.fast ? 'text-amber-600' : 'text-slate-400')}>
                          {formatIDR(x.spent)} / {formatIDR(x.cap)}{x.b.period === 'yearly' ? ' (tahunan ÷ 12)' : ''}{x.fast ? ' · Terlalu cepat' : ''}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Belum ada anggaran */}
          <div className={cn(card, 'self-start')}>
            <p className="font-bold text-slate-900">Belum ada anggaran</p>
            <p className="mb-2 text-xs text-slate-400">Pengeluaran bulan ini tanpa batas. Ketuk untuk mengatur.</p>
            {r.unbudgeted.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Semua pengeluaran sudah punya anggaran. 👍</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {r.unbudgeted.map(([c, v], i) => (
                  <motion.li key={c} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <button type="button" onClick={() => setEdit({ category: c, type: 'pengeluaran' })} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-slate-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">{categoryEmoji(c)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{c}</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{formatIDR(v)}</span>
                      <Plus size={15} className="text-slate-300" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">“Terlalu cepat” artinya kalau belanja terus seperti ini, kategori itu akan melebihi anggarannya di akhir periode.</p>
          </div>

          {/* Target pemasukan */}
          {r.incomeRows.length > 0 && (
            <div className={card}>
              <p className="mb-2 font-bold text-slate-900">Target pemasukan</p>
              <ul className="space-y-3">
                {r.incomeRows.map((x) => (
                  <li key={x.b.id}>
                    <button type="button" onClick={() => setEdit({ category: x.b.category, type: 'pemasukan', budget: x.b })} className="w-full text-left">
                      <span className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-slate-800">{categoryEmoji(x.b.category)} {x.b.category}</span>
                        <span className="font-bold text-emerald-600 tabular-nums">{short(x.total)} <span className="font-normal text-slate-400">/ {short(capOf(x.b))}</span></span>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-100">
                        <motion.span className="block h-full rounded-full bg-emerald-500" initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(100, x.percentage)}%` }} transition={{ duration: 0.7 }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>

      <BudgetEditModal edit={edit} onClose={() => setEdit(null)} onSaved={load} spentThisMonth={edit ? r.spendByCat.get(edit.category) ?? 0 : 0} />
      <ManageBudgetsModal
        open={manage}
        onClose={() => setManage(false)}
        budgets={budgets ?? []}
        categories={userCats}
        spend={r.spendByCat}
        monthTx={monthTx}
        onEdit={(e) => setEdit(e)}
      />

      <AnimatePresence>
        {info && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Periode anggaran">
            <motion.div className="absolute inset-0 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInfo(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="relative w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><CalendarDays size={20} /></span>
              <p className="mt-3 text-lg font-extrabold text-slate-900">Anggaran dimulai tanggal 1</p>
              <p className="mt-1 text-sm text-slate-500">Anggaran dihitung per bulan kalender (tanggal 1 sampai akhir bulan). Anggaran tahunan dibagi 12 supaya sebanding tiap bulan.</p>
              <button type="button" onClick={() => setInfo(false)} className="mt-5 w-full rounded-full bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800">Mengerti</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Popup ubah / atur anggaran satu kategori.
function BudgetEditModal({ edit, onClose, onSaved, spentThisMonth }: { edit: { category: string; type: Kind; budget?: Budget } | null; onClose: () => void; onSaved: () => void; spentThisMonth: number }) {
  const { toast, confirm } = useFeedback();
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<Budget['period']>('monthly');
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState('');
  const key = edit ? `${edit.type}-${edit.category}-${edit.budget?.id ?? 'new'}` : '';
  if (key !== lastKey) {
    setLastKey(key);
    setAmount(edit?.budget ? String(Math.round(edit.budget.amount)) : '');
    setPeriod(edit?.budget?.period ?? 'monthly');
  }
  const num = Number(amount.replace(/\D/g, '')) || 0;

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      if (edit.budget?.id) {
        if (num <= 0) await budgetService.deleteBudget(edit.budget.id);
        else await budgetService.updateBudget(edit.budget.id, { amount: num, period });
      } else if (num > 0) {
        await budgetService.createBudget({ userId: '', type: edit.type, category: edit.category, amount: num, period });
      }
      toast.success(num > 0 ? 'Anggaran tersimpan.' : 'Anggaran dihapus.');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!edit?.budget?.id) return;
    const ok = await confirm({ title: `Hapus anggaran ${edit.category}?`, message: 'Transaksinya tidak terhapus — hanya batas anggarannya.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try {
      await budgetService.deleteBudget(edit.budget.id);
      onSaved();
      onClose();
    } catch {
      toast.error('Gagal menghapus anggaran.');
    }
  };

  return (
    <AnimatePresence>
      {edit && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Ubah anggaran kategori">
          <motion.div className="absolute inset-0 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 360, damping: 32 }} className="relative w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">{edit.budget ? 'Ubah anggaran' : 'Atur anggaran'}</p>
              <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-4 flex flex-col items-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-3xl">{categoryEmoji(edit.category)}</span>
              <p className="mt-2 font-bold text-slate-900">{edit.category}</p>
              <p className="text-xs text-slate-400">{edit.type === 'pemasukan' ? 'Target pemasukan' : 'Batas pengeluaran'} · bulan ini {formatIDR(spentThisMonth)}</p>
            </div>
            <div className="mt-4 flex rounded-full bg-slate-100 p-1">
              {(['monthly', 'yearly'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPeriod(p)} className={cn('flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors', period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                  {p === 'monthly' ? 'Bulanan' : 'Tahunan'}
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Anggaran {period === 'monthly' ? 'bulanan' : 'tahunan'}</span>
              <span className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 focus-within:ring-indigo-300">
                <span className="text-sm font-bold text-slate-400">Rp</span>
                <input autoFocus inputMode="numeric" value={num ? num.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none tabular-nums" />
              </span>
            </label>
            <p className="mt-1.5 text-xs text-slate-400">Isi 0 untuk menghapus anggaran.</p>
            <div className="mt-4 flex gap-2">
              {edit.budget && (
                <button type="button" onClick={remove} aria-label="Hapus anggaran" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 size={18} /></button>
              )}
              <button type="button" onClick={save} disabled={saving || (!edit.budget && num <= 0)} className="h-12 flex-1 rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                {saving ? 'Menyimpan…' : 'Simpan perubahan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Panel "Kategori & anggaran": semua kategori per jenis, bar terpakai vs anggaran.
function ManageBudgetsModal({ open, onClose, budgets, categories, spend, monthTx, onEdit }: {
  open: boolean;
  onClose: () => void;
  budgets: Budget[];
  categories: string[];
  spend: Map<string, number>;
  monthTx: Transaction[];
  onEdit: (e: { category: string; type: Kind; budget?: Budget }) => void;
}) {
  const [tab, setTab] = useState<Kind>('pengeluaran');
  const incomeByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthTx) if (t.type === 'pemasukan') m.set(t.category || 'Lainnya', (m.get(t.category || 'Lainnya') ?? 0) + toIdr(t));
    return m;
  }, [monthTx]);
  const used = tab === 'pengeluaran' ? spend : incomeByCat;
  const names = useMemo(() => {
    const set = new Map<string, string>();
    const add = (c?: string) => { if (c && !set.has(c.toLowerCase())) set.set(c.toLowerCase(), c); };
    budgets.filter((b) => b.type === tab).forEach((b) => add(b.category));
    [...used.keys()].forEach(add);
    if (tab === 'pengeluaran') categories.forEach(add);
    return [...set.values()];
  }, [budgets, used, categories, tab]);
  const rows = names
    .map((c) => ({ c, b: budgets.find((x) => x.type === tab && x.category.toLowerCase() === c.toLowerCase()), v: used.get(c) ?? 0 }))
    .sort((x, y) => Number(Boolean(y.b)) - Number(Boolean(x.b)) || y.v - x.v);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Kategori dan anggaran">
          <motion.div className="absolute inset-0 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} className="relative flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between px-5 pt-5">
              <p className="text-lg font-extrabold text-slate-900">Kategori & anggaran</p>
              <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="px-5 pt-3">
              <LayoutGroup id="mb-tab">
                <div className="flex rounded-full bg-slate-100 p-1">
                  {(['pengeluaran', 'pemasukan'] as Kind[]).map((k) => (
                    <button key={k} type="button" onClick={() => setTab(k)} className={cn('relative flex-1 rounded-full py-1.5 text-[13px] font-semibold', tab === k ? 'text-slate-900' : 'text-slate-500')}>
                      {tab === k && <motion.span layoutId="mb-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                      <span className="relative">{k === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan'}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </div>
            <ul className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
              {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Belum ada kategori.</li>}
              {rows.map(({ c, b, v }) => {
                const cap = b ? capOf(b) : 0;
                const over = b && v > cap;
                return (
                  <li key={c}>
                    <button type="button" onClick={() => onEdit({ category: c, type: tab, budget: b })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-slate-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-lg">{categoryEmoji(c)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{c}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <span className={cn('block h-full rounded-full', !b ? 'bg-slate-300' : over ? 'bg-rose-500' : tab === 'pemasukan' ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${b ? Math.min(100, (v / Math.max(1, cap)) * 100) : 0}%` }} />
                        </span>
                        <span className="mt-0.5 flex justify-between text-xs text-slate-400">
                          <span>{formatIDR(v)}</span>
                          <span className={b ? 'font-semibold text-slate-600' : ''}>{b ? `${formatIDR(cap)}${b.period === 'yearly' ? '/bln' : ''}` : 'Tanpa anggaran'}</span>
                        </span>
                      </span>
                      <ChevronRight size={15} className="text-slate-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
