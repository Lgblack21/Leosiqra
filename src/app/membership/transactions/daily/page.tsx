"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  TrendingUp
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { Account } from '@/lib/services/accountService';
import type { Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { MonthPicker } from '@/components/ui/MonthPicker';

export default function DailyTransactionLogPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        // Fetch categories for lookup
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'transactions'), 
          where('userId', '==', u.uid),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Transaction;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else { setTransactions([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, [selectedMonth, selectedYear]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '—';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '—';
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(t =>
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.note || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0), [transactions]);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(n).replace('Rp', '').trim();
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Transaksi Harian</h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-400 mt-2 max-w-xl">
            Lacak dan kelola aliran keuangan Anda pada periode {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth))}.
          </p>
        </div>
      </div>

      {/* 2. Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Data</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-slate-900">{loading ? '-' : transactions.length}</span>
            <span className="text-xs font-bold text-slate-400">Transaksi</span>
          </div>
          <div className="h-1 w-full bg-slate-50 rounded-full"><div className="h-full bg-slate-900 rounded-full" style={{ width: transactions.length > 0 ? '60%' : '0%' }} /></div>
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pemasukan</p>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">Rp {formatRp(totalPemasukan)}</h3>
          </div>
          <ArrowUpRight size={32} className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-100 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pengeluaran</p>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">Rp {formatRp(totalPengeluaran)}</h3>
          </div>
          <ArrowDownRight size={32} className="absolute right-5 top-1/2 -translate-y-1/2 text-rose-100 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Bersih</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-xl md:text-2xl font-black leading-tight ${totalPemasukan - totalPengeluaran >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              Rp {formatRp(totalPemasukan - totalPengeluaran)}
            </h3>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-3 rounded-[24px] md:rounded-3xl border border-slate-50 shadow-sm">
        <div className="w-full md:flex-1 relative group">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari kategori atau catatan..." 
            className="w-full bg-slate-50/50 border-transparent focus:border-blue-100 focus:bg-white rounded-[16px] md:rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium transition-all"
          />
        </div>
        <div className="w-full md:w-auto">
          <MonthPicker 
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat transaksi...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState 
              title="Belum ada transaksi"
              description="Catat pemasukan atau pengeluaran pertama Anda melalui menu Tambah Cepat di header."
              icon={<TrendingUp size={24} />}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px] xl:min-w-0">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Deskripsi</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Mata Uang</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Nominal</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Sub Kategori</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Tenor Cicilan</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Bunga Perbulan</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Total Bunga</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trx) => (
                    <tr key={trx.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <p className="text-xs md:text-sm font-black text-slate-900">{formatDate(trx.date)}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <p className="text-xs md:text-sm font-bold text-slate-700">{trx.note || '—'}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{trx.currency || 'IDR'}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right whitespace-nowrap">
                        <p className={`text-sm font-black tracking-tight ${trx.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {trx.type === 'pemasukan' ? '+' : '-'} {formatRp(trx.amount)}
                        </p>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">
                          {trx.subCategory || getCategoryName(trx.category || '')}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">{getAccountName(trx.accountId || '')}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">{trx.installmentTenor ? `${trx.installmentTenor} bln` : '—'}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">{trx.monthlyInterest ? formatRp(trx.monthlyInterest) : '—'}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">{trx.totalInterest ? formatRp(trx.totalInterest) : '—'}</span>
                      </td>
                      <td className="px-5 md:px-8 py-4 md:py-6 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={async () => {
                              if (trx.id) {
                                await transactionService.deleteTransaction(trx.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 md:px-8 py-5 md:py-6 bg-slate-50/30 flex items-center justify-between gap-4 border-t border-slate-50">
              <p className="text-[11px] font-bold text-slate-400">
                Menampilkan {filtered.length} dari {transactions.length} transaksi
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

