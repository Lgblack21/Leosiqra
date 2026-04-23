"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Search,
  AlertCircle,
  Banknote,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { Account } from '@/lib/services/accountService';
import { updateMemberTotals } from '@/lib/services/userService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { MonthPicker } from '@/components/ui/MonthPicker';

export default function DebtPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'transactions'), 
          where('userId', '==', u.uid),
          where('type', '==', 'debt'),
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
      } else {
        setTransactions([]);
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

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(t =>
      (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  const totalHutang = useMemo(() => transactions.filter(t => t.category === 'Hutang' && t.paymentStatus !== 'lunas').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalPiutang = useMemo(() => transactions.filter(t => t.category === 'Piutang' && t.paymentStatus !== 'lunas').reduce((s, t) => s + t.amount, 0), [transactions]);

  const handleMarkLunas = async (trx: Transaction) => {
    if (!trx.id || !user) return;
    try {
      const isHutang = trx.category === 'Hutang';
      const financeType = isHutang ? 'pengeluaran' : 'pemasukan';

      // 1. Update debt record to lunas
      await transactionService.updateTransaction(trx.id, { status: 'VERIFIED', paymentStatus: 'lunas' });

      // 2. Create financial transaction entry
      await transactionService.createTransaction({
        userId: trx.userId,
        type: financeType,
        amount: trx.amount,
        currency: trx.currency || 'IDR',
        category: trx.category,
        subCategory: `${trx.category} Lunas`,
        accountId: trx.accountId,
        date: new Date(),
        displayDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        note: `[Lunas] ${trx.category} ${trx.lenderName ? `ke/dari ${trx.lenderName}` : ''} - ${trx.note || ''}`.trim(),
        status: 'VERIFIED'
      });

      // 3. Sync balance
      await updateMemberTotals(user.uid, financeType, trx.amount);
    } catch (e) {
      console.error(e);
    }
  };

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace('Rp', '').trim();
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Hutang & Piutang</h1>
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
        </div>
      </div>

      {/* 2. Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hutang</p>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-rose-600 leading-tight">Rp {formatRp(totalHutang)}</h3>
            <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase tracking-wider">Kewajiban Belum Terbayar</p>
          </div>
          <Banknote size={48} className="absolute -right-2 -bottom-2 text-rose-50/60 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Piutang</p>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-emerald-600 leading-tight">Rp {formatRp(totalPiutang)}</h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-wider">Dana Dipinjamkan</p>
          </div>
          <Banknote size={48} className="absolute -right-2 -bottom-2 text-emerald-50/60 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* 3. Filter */}
      <div className="bg-white p-3 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="relative group">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari catatan hutang atau piutang..."
            className="w-full bg-slate-50/50 border-transparent rounded-[16px] py-3.5 pl-12 pr-6 text-sm font-medium transition-all" />
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState 
              title="Belum ada catatan"
              description="Catat hutang atau piutang Anda untuk tidak ada yang terlewat."
              icon={<Banknote size={24} />}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px] xl:min-w-0">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal Display</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Deskripsi</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Mata Uang</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Nominal</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Tipe</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Status</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Pemberi Hutang</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Tenor</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Bunga/Bln</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total Bunga</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total Hutang</th>
                    <th className="px-4 md:px-6 py-4 md:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trx) => (
                    <tr key={trx.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0">
                      <td className="px-4 md:px-6 py-4 md:py-6 whitespace-nowrap">
                        <p className="text-sm font-black text-slate-900">{formatDate(trx.date)}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 whitespace-nowrap">
                        <p className="text-sm font-bold text-slate-500">{trx.displayDate || formatDate(trx.date)}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6">
                        <p className="text-sm font-bold text-slate-700">{trx.note || '-'}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-center whitespace-nowrap">
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{trx.currency || 'IDR'}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-right whitespace-nowrap">
                        <p className="text-sm font-black text-slate-900"> {formatRp(trx.amount)}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-center whitespace-nowrap">
                        <span className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                          trx.category === 'Hutang' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {trx.category}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-center whitespace-nowrap">
                        <span className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                          trx.paymentStatus === 'lunas' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {trx.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-6 whitespace-nowrap text-sm font-bold text-slate-600">{getAccountName(trx.accountId || '')}</td>
                      <td className="px-4 md:px-6 py-4 md:py-6 whitespace-nowrap text-sm font-bold text-slate-600">{trx.lenderName || '-'}</td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-center whitespace-nowrap text-sm font-bold text-slate-600">{trx.installmentTenor || 0} bln</td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-right whitespace-nowrap text-sm font-bold text-slate-600">{formatRp(trx.monthlyInterest || 0)}</td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-right whitespace-nowrap text-sm font-bold text-slate-600">{formatRp(trx.totalInterest || 0)}</td>
                      <td className="px-4 md:px-6 py-4 md:py-6 text-right whitespace-nowrap font-black text-slate-900 text-sm">{formatRp(trx.totalDebt || 0)}</td>
                      <td className="px-5 md:px-8 py-4 md:py-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {trx.paymentStatus !== 'lunas' && (
                            <button 
                              onClick={() => handleMarkLunas(trx)}
                              title="Tandai Lunas"
                              className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button onClick={async () =>{ if (trx.id) { await transactionService.deleteTransaction(trx.id); } }} className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-8 py-5 bg-slate-50/30 border-t border-slate-50">
              <p className="text-[11px] font-bold text-slate-400">Menampilkan {filtered.length} dari {transactions.length} catatan</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

