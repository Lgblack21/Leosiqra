"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  Target,
  Trash2,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  ArrowDownToLine,
  Repeat
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { SavingsModal } from '@/components/modals/SavingsModal';
import { RecurringModal } from '@/components/modals/RecurringModal';
import { savingsGoalService, SavingsGoal } from '@/lib/services/savingsGoalService';
import { cn, formatCurrency } from '@/lib/utils';

export default function SavingsPage() {
  const [savings, setSavings] = useState<Saving[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'Setoran' | 'Penarikan'>('Setoran');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);

  const loadGoals = () => {
    savingsGoalService.getUserSavingsGoals().then(setGoals).catch((error) => {
      console.error('Error loading savings goals:', error);
    });
  };

  useEffect(() => {
    if (!userId) return;
    loadGoals();
  }, [userId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u?.uid || '');
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        }, (err) => {
          if (err.code !== 'permission-denied') console.error('Account listener error:', err);
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'savings'), 
          where('userId', '==', u.uid),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setSavings(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Saving;
          }));
          setLoading(false);
        }, (err) => { 
          if (err.code !== 'permission-denied') console.error(err); 
          setLoading(false); 
        });
      } else {
        setSavings([]);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
      if (unsubAccRef.current) unsubAccRef.current();
    };
  }, [selectedMonth, selectedYear]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  // Total gabungan lintas rekening harus pakai amountIDR (sudah dikonversi
  // saat setoran disimpan), bukan .amount mentah — setoran bisa dalam
  // mata uang berbeda-beda. Penarikan mengurangi total, Setoran menambah.
  const totalSaldo = useMemo(() => savings.reduce((s, item) => {
    const amt = Number(item.amountIDR) || item.amount;
    return item.transactionType === 'Penarikan' ? s - amt : s + amt;
  }, 0), [savings]);

  const filtered = useMemo(() =>
    searchQuery ? savings.filter(s => s.description.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase())) : savings,
    [savings, searchQuery]
  );

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n);
  const formatAmount = (n: number, currency: string | undefined) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency || 'IDR', minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency || ''} ${formatRp(n)}`.trim();
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);

  const handleDelete = async (item: Saving) => {
    if (!item.id) return;
    if (!confirm('Hapus setoran tabungan ini? Tindakan ini tidak bisa dibatalkan.')) return;
    setError('');
    setDeletingId(item.id);
    try {
      await savingsService.deleteSaving(item);
    } catch (e) {
      console.error(e);
      setError('Gagal menghapus setoran. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Tabungan & Dana Darurat</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Periode {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth))}
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
          <button
            onClick={() => setShowGoalModal(true)}
            className="px-5 py-3 bg-slate-50 text-slate-600 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
          >
            <Repeat size={18} />
            <span className="hidden md:inline">Goal Otomatis</span>
          </button>
          <button
            onClick={() => { setModalMode('Penarikan'); setShowModal(true); }}
            className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
          >
            <ArrowDownToLine size={18} />
            <span className="hidden md:inline">Tarik Dana</span>
          </button>
          <button
            onClick={() => { setModalMode('Setoran'); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <PlusCircle size={18} />
            <span className="hidden md:inline">Catat Setoran</span>
          </button>
        </div>
      </div>

      {/* Goal Otomatis: progress setoran rutin ke target tabungan */}
      {goals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Goal Tabungan Otomatis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <div key={goal.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">{goal.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{goal.category}</p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest shrink-0",
                    goal.status === 'PAUSED' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {goal.status === 'PAUSED' ? 'Dijeda' : `Auto/${goal.interval}`}
                  </span>
                </div>

                {goal.targetAmount ? (
                  <>
                    <div className="flex items-end justify-between">
                      <span className="text-lg font-black text-slate-900">{formatCurrency(goal.currentTotal, 'IDR')}</span>
                      <span className="text-[10px] font-bold text-slate-400">dari {formatCurrency(goal.targetAmount, 'IDR')}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(goal.progressPercent ?? 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{(goal.progressPercent ?? 0).toFixed(0)}% tercapai</p>
                  </>
                ) : (
                  <p className="text-sm font-black text-slate-900">{formatCurrency(goal.currentTotal, 'IDR')} terkumpul</p>
                )}

                <p className="text-[10px] font-medium text-slate-400 border-t border-slate-50 pt-2">
                  Setoran otomatis {formatCurrency(goal.monthlyAmount, 'IDR')} / {goal.interval.toLowerCase()}, berikutnya {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(goal.nextDate))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col justify-between h-[150px] md:h-[180px] relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tabungan</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight">Rp {formatRp(totalSaldo)}</h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-wider">{savings.length} catatan transaksi</p>
          </div>
          <TrendingUp size={48} className="absolute -right-2 -bottom-2 text-indigo-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col justify-between h-auto md:h-[180px] relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Target size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribusi Goal</p>
          </div>
          <div>
            {savings.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {[...new Set(savings.map(s => s.category))].slice(0, 4).map(cat => (
                  <span key={cat} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-widest">
                    {cat}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-300 mt-2">Belum ada data</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 md:p-2 rounded-[24px] md:rounded-3xl border border-slate-50 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari setoran tabungan..."
            className="w-full bg-slate-50/50 border-transparent rounded-xl md:rounded-2xl py-3 md:py-4 pl-5 pr-6 text-sm font-medium focus:ring-0 outline-none transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat data tabungan...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState title="Belum ada setoran" description="Catat setoran tabungan pertama Anda untuk mulai tracking tujuan keuangan." icon={<Wallet size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[820px] xl:min-w-0">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">No</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Jam</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipe</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Deskripsi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Mata Uang</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Nominal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Sub Kategori</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Dari</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Ke</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const isPenarikan = item.transactionType === 'Penarikan';
                  return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0">
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center">
                      <p className="text-xs font-bold text-slate-400">{i + 1}</p>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-500">{formatTime(item.createdAt)}</p>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <p className="text-sm font-black text-slate-900">{formatDate(item.date)}</p>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-1 w-fit",
                        isPenarikan ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {isPenarikan ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                        {isPenarikan ? 'Tarik' : 'Setor'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap font-bold text-slate-900 text-sm">{item.description}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center"><span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.currency || 'IDR'}</span></td>
                    <td className={cn("px-4 md:px-6 py-5 text-right whitespace-nowrap font-black text-sm", isPenarikan ? "text-rose-500" : "text-slate-900")}>
                      {isPenarikan ? '-' : '+'} {formatAmount(item.amount, item.currency)}
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                       <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase tracking-widest">{item.subCategory || '-'}</span>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap font-bold text-slate-600 text-xs">
                      {isPenarikan ? (item.category || '-') : getAccountName(item.fromAccount || '')}
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap font-bold text-slate-600 text-xs">
                      {isPenarikan ? getAccountName(item.fromAccount || '') : (item.toGoal || '-')}
                    </td>
                    <td className="px-5 md:px-8 py-5 text-center">
                      <button
                        onClick={() => item.id && handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && savings.length > 0 && (
          <div className="px-8 py-4 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400">{savings.length} catatan tabungan</p>
            <p className="text-[11px] font-black text-slate-600">Total: Rp {formatRp(totalSaldo)}</p>
          </div>
        )}
      </div>

      <SavingsModal
        userId={userId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialTransactionType={modalMode}
      />

      <RecurringModal
        userId={userId}
        isOpen={showGoalModal}
        onClose={() => { setShowGoalModal(false); loadGoals(); }}
        initialType="Tabungan"
      />
    </div>
  );
}

