"use client";

import { useState, useEffect, useRef } from 'react';
import { Target, Trash2, TrendingUp, PlusCircle } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { EmptyState } from '@/components/ui/EmptyState';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { Transaction } from '@/lib/services/transactionService';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { BudgetModal } from '@/components/modals/BudgetModal';
import { budgetRealization } from '@/lib/budget';

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubBudgetsRef = useRef<(() => void) | null>(null);
  const unsubTransRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch Budgets
        const qBudgets = query(collection(db, 'budgets'), where('userId', '==', u.uid));
        if (unsubBudgetsRef.current) unsubBudgetsRef.current();
        unsubBudgetsRef.current = onSnapshot(qBudgets, (snap) => {
          setBudgets(snap.docs.map(doc => {
            const d = doc.data();
            const row = d as { amount?: number; createdAt?: { toDate?: () => Date } | Date };
            const createdAt = row.createdAt instanceof Date
              ? row.createdAt
              : row.createdAt?.toDate?.() ?? new Date();
            return { ...d, id: doc.id, amount: Number(row.amount) || 0, createdAt } as Budget;
          }));
          setLoading(false);
        }, (err) => {
          if (err.code !== 'permission-denied') console.error('Budget listener error:', err);
          setLoading(false);
        });

        // Fetch Transactions for current month to calculate Realisasi
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
        const qTrans = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth)
        );
        if (unsubTransRef.current) unsubTransRef.current();
        unsubTransRef.current = onSnapshot(qTrans, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0 } as Transaction;
          }));
        }, (err) => {
          if (err.code !== 'permission-denied') console.error('Transaction listener error:', err);
        });
      } else {
        setBudgets([]);
        setTransactions([]);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (unsubBudgetsRef.current) unsubBudgetsRef.current();
      if (unsubTransRef.current) unsubTransRef.current();
    };
  }, [selectedMonth, selectedYear]);

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Hapus anggaran ini? Tindakan ini tidak bisa dibatalkan.')) return;
    setError('');
    setDeletingId(id);
    try {
      await budgetService.deleteBudget(id);
    } catch (e) {
      console.error(e);
      setError('Gagal menghapus anggaran. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
  // Budget tahunan ditampilkan per bulan (dibagi 12) supaya sebanding.
  const monthlyCap = (b: Budget) => (b.period === 'yearly' ? b.amount / 12 : b.amount);

  // Pengeluaran biaya hidup per kategori (tanpa pembelian investasi).
  const spendByCat = new Map<string, { name: string; total: number; count: number }>();
  for (const t of transactions) {
    if (t.type !== 'pengeluaran' || isInvestmentCategory(t.category)) continue;
    const key = (t.category || 'Lainnya').toLowerCase();
    const cur = spendByCat.get(key) ?? { name: t.category || 'Lainnya', total: 0, count: 0 };
    cur.total += toIdr(t);
    cur.count++;
    spendByCat.set(key, cur);
  }

  const expenseBudgets = budgets.filter((b) => b.type === 'pengeluaran');
  const incomeBudgets = budgets.filter((b) => b.type === 'pemasukan');
  const budgetedKeys = new Set(expenseBudgets.map((b) => b.category.toLowerCase()));
  const rows = [
    ...expenseBudgets.map((b) => {
      const spent = budgetRealization(b, transactions).total;
      const cap = monthlyCap(b);
      return { key: `b-${b.id}`, id: b.id, name: b.category, spent, cap, pct: cap > 0 ? spent / cap : 0 };
    }).sort((a, b) => b.pct - a.pct),
    ...[...spendByCat.entries()]
      .filter(([k]) => !budgetedKeys.has(k))
      .map(([k, v]) => ({ key: `u-${k}`, id: undefined as string | undefined, name: v.name, spent: v.total, cap: 0, pct: 0 }))
      .sort((a, b) => b.spent - a.spent),
  ];
  const totalCap = expenseBudgets.reduce((s, b) => s + monthlyCap(b), 0);
  const spentInBudget = rows.filter((r) => r.cap > 0).reduce((s, r) => s + r.spent, 0);
  const outside = rows.filter((r) => r.cap === 0).reduce((s, r) => s + r.spent, 0);
  const maxSpentUnbudgeted = Math.max(1, ...rows.filter((r) => r.cap === 0).map((r) => r.spent));

  const now = new Date();
  const isCurrent = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysLeft = isCurrent ? daysInMonth - now.getDate() + 1 : 0;
  const dayFrac = isCurrent ? now.getDate() / daysInMonth : 1;
  const left = totalCap - spentInBudget;
  const usedFrac = totalCap > 0 ? spentInBudget / totalCap : 0;
  const status = usedFrac > 1 ? 'over' : usedFrac > dayFrac + 0.1 ? 'fast' : 'ok';
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(selectedYear, selectedMonth));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Anggaran</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            1 – {daysInMonth} {periodLabel}{isCurrent ? ` · sisa ${daysLeft} hari` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            <PlusCircle size={15} /> Atur anggaran
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600">{error}</div>}

      {/* Ringkasan sisa anggaran */}
      {totalCap > 0 && (
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">{left >= 0 ? 'Sisa anggaran' : 'Lewat anggaran'}</p>
              <p className={cn('text-3xl font-extrabold tracking-tight tabular-nums', left < 0 ? 'text-rose-500' : 'text-slate-900')}>{formatIDR(Math.abs(left))}</p>
              <p className="mt-1 text-sm text-slate-500">
                {isCurrent && left > 0 ? `${formatIDR(left / daysLeft)}/hari untuk ${daysLeft} hari` : `Terpakai ${formatIDR(spentInBudget)} dari ${formatIDR(totalCap)}`}
                {outside > 0 && <span className="text-slate-400"> · {formatIDR(outside)} di luar anggaran</span>}
              </p>
            </div>
            <LeoMascot mood={status === 'over' ? 'sad' : 'idle'} size={84} interactive className="hidden shrink-0 sm:block" />
          </div>
          <div className="relative mt-4 h-3 rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full transition-all duration-700', status === 'over' ? 'bg-rose-500' : status === 'fast' ? 'bg-amber-400' : 'bg-slate-900')}
              style={{ width: `${Math.min(100, usedFrac * 100)}%` }}
            />
            {isCurrent && <div className="absolute -top-1 h-5 w-0.5 rounded-full bg-indigo-500" style={{ left: `${dayFrac * 100}%` }} title="Hari ini" />}
          </div>
        </div>
      )}

      {/* Ke mana uangmu */}
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
        <p className="mb-4 font-bold text-slate-900">Ke mana uangmu</p>
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-50" />
        ) : rows.length === 0 ? (
          <EmptyState title="Belum ada pengeluaran atau anggaran" description="Atur anggaran bulanan per kategori untuk melihat kondisinya." icon={<Target size={24} />} />
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => {
              const over = r.cap > 0 && r.spent > r.cap;
              const width = r.cap > 0 ? Math.min(100, (r.spent / r.cap) * 100) : (r.spent / maxSpentUnbudgeted) * 100;
              return (
                <li key={r.key} className="group flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-lg">{categoryEmoji(r.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                      <p className={cn('shrink-0 text-sm font-extrabold tabular-nums', over ? 'text-rose-500' : 'text-slate-900')}>{formatIDR(r.spent)}</p>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', over ? 'bg-rose-500' : r.cap > 0 ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-slate-300')}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{r.cap > 0 ? `dari ${formatIDR(r.cap)}${over ? ` · lewat ${formatIDR(r.spent - r.cap)}` : ` · sisa ${formatIDR(r.cap - r.spent)}`}` : 'Tanpa anggaran'}</span>
                      {r.id && (
                        <button
                          type="button"
                          onClick={() => r.id && handleDeleteBudget(r.id)}
                          disabled={deletingId === r.id}
                          aria-label={`Hapus anggaran ${r.name}`}
                          className="rounded-lg p-1 text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Target pemasukan */}
      {incomeBudgets.length > 0 && (
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="mb-4 flex items-center gap-2 font-bold text-slate-900"><TrendingUp size={17} className="text-emerald-500" /> Target pemasukan</p>
          <ul className="space-y-4">
            {incomeBudgets.map((b) => {
              const { total, percentage } = budgetRealization(b, transactions);
              return (
                <li key={b.id} className="group">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{categoryEmoji(b.category)} {b.category}</p>
                    <p className="text-sm font-extrabold text-emerald-600 tabular-nums">{formatIDR(total)} <span className="font-semibold text-slate-400">/ {formatIDR(monthlyCap(b))}</span></p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, percentage)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>{Math.round(percentage)}% tercapai</span>
                    <button type="button" onClick={() => b.id && handleDeleteBudget(b.id)} disabled={deletingId === b.id} aria-label={`Hapus target ${b.category}`} className="rounded-lg p-1 text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {user && (
        <BudgetModal
          userId={user.uid}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
