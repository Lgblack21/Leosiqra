"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Target,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Wallet,
  PiggyBank,
  Briefcase
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { Transaction } from '@/lib/services/transactionService';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { BudgetModal } from '@/components/modals/BudgetModal';

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);

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
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Budget;
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

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(num);
  };

  const getBudgetsByType = (type: Budget['type']) => budgets.filter(b => b.type === type);

  const calculateRealisasi = (budget: Budget) => {
    const total = transactions
      .filter(t => t.category.toLowerCase() === budget.category.toLowerCase())
      .reduce((sum, t) => sum + t.amount, 0);
    const percentage = budget.amount > 0 ? (total / budget.amount) * 100 : 0;
    const isOver = percentage > 100;
    return { total, percentage, isOver };
  };

  const getTypeStyle = (type: Budget['type']) => {
    switch (type) {
      case 'pemasukan': return { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <TrendingUp size={20} className="text-emerald-500" /> };
      case 'pengeluaran': return { color: 'text-rose-600', bg: 'bg-rose-50', icon: <Wallet size={20} className="text-rose-500" /> };
    }
  };

  const renderBudgetSection = (title: string, type: Budget['type']) => {
    const items = getBudgetsByType(type);
    if (items.length === 0) return null;
    const style = getTypeStyle(type);

    return (
      <div className="bg-white p-6 md:p-8 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bg}`}>
            {style.icon}
          </div>
          <h3 className={`text-lg font-black ${style.color} uppercase tracking-tight`}>{title}</h3>
        </div>

        <div className="space-y-4">
          {items.map(b => {
            const { total, percentage, isOver } = calculateRealisasi(b);
            const barColor = type === 'pengeluaran' ? (isOver ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-indigo-500';

            return (
              <div key={b.id} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl group flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{b.category}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Realisasi: {formatRp(total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{formatRp(b.amount)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Target Bulanan</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className={isOver && type === 'pengeluaran' ? 'text-rose-500' : 'text-slate-500'}>
                      {percentage.toFixed(0)}%
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <button onClick={() => { if(b.id) budgetService.deleteBudget(b.id) }} className="text-rose-500 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${barColor} rounded-full transition-all duration-1000`} 
                      style={{ width: `${Math.min(percentage, 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="max-w-2xl">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Budget & Target</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest leading-relaxed">
            Kelola target alokasi Pemasukan, Pengeluaran, Tabungan & Investasi per bulan.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker 
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {renderBudgetSection('🎯 Target Pemasukan', 'pemasukan')}
        {renderBudgetSection('🛒 Batas Pengeluaran', 'pengeluaran')}
      </div>

      {!loading && budgets.length === 0 && (
        <div className="bg-white p-12 rounded-[24px] border border-slate-50 flex items-center justify-center">
           <EmptyState 
             title="Belum ada target bulanan" 
             description="Set budget untuk mengontrol keuangan dari setiap kategori."
             icon={<Target size={24} />}
           />
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
