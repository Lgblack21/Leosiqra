"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CreditCard, 
  Wallet, 
  PiggyBank, 
  LineChart, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Building2,
  Smartphone,
  Banknote,
  Trash2,
  ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { accountService, Account } from '@/lib/services/accountService';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MyCardsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubTrxRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          const accs = snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, balance: Number(d.balance) || 0, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Account;
          });
          setAccounts(accs);
          // Auto-select first account
          if (accs.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accs[0].id!);
          }
        }, (err) => console.error(err));

        const qTrx = query(collection(db, 'transactions'), where('userId', '==', u.uid));
        if (unsubTrxRef.current) unsubTrxRef.current();
        unsubTrxRef.current = onSnapshot(qTrx, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Transaction;
          }));
        }, (err) => { console.error(err); });

        // Fetch savings for totalOut
        const qSav = query(collection(db, 'savings'), where('userId', '==', u.uid));
        const unsubSav = onSnapshot(qSav, (snap) => {
          setSavings(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Saving;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });

      } else { setAccounts([]); setTransactions([]); setSavings([]); setLoading(false); }
    });
    return () => { 
      unsub(); 
      if (unsubAccRef.current) unsubAccRef.current(); 
      if (unsubTrxRef.current) unsubTrxRef.current(); 
    };
  }, []);

  // === GLOBAL TOTALS ===
  const totalIn = useMemo(() => {
    const dailyIn = transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0);
    const debtIn = transactions.filter(t => t.type === 'debt' && t.category === 'Hutang').reduce((s, t) => s + t.amount, 0);
    return dailyIn + debtIn;
  }, [transactions]);

  const totalOut = useMemo(() => {
    const dailyOut = transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0);
    const piutangOut = transactions.filter(t => t.type === 'debt' && t.category === 'Piutang').reduce((s, t) => s + t.amount, 0);
    const savingOut = savings.reduce((s, t) => s + t.amount, 0);
    return dailyOut + piutangOut + savingOut;
  }, [transactions, savings]);

  const combinedInitial = useMemo(() => {
    return accounts
      .filter(a => a.type !== 'Credit Card' && a.type !== 'kartu')
      .reduce((s, a) => s + (a.initialBalance || 0), 0);
  }, [accounts]);

  const totalBalance = useMemo(() => {
    return combinedInitial + totalIn - totalOut;
  }, [combinedInitial, totalIn, totalOut]);

  const totalGlobalDebt = useMemo(() => {
    return transactions.filter(t => t.type === 'debt' && t.category === 'Hutang').reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  // === PER-ACCOUNT DETAIL ===
  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  // Transactions specifically for the selected account (All-time for calculations)
  const accountTransactionsAll = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(t => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // Recent transactions for display UI
  const accountTransactionsRecent = useMemo(() => {
    return [...accountTransactionsAll]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20);
  }, [accountTransactionsAll]);

  const accountTotalIn = useMemo(() => 
    accountTransactionsAll.filter(t => t.type === 'pemasukan' || (t.type === 'debt' && t.category === 'Hutang')).reduce((s, t) => s + t.amount, 0),
    [accountTransactionsAll]
  );

  const accountTotalOut = useMemo(() => 
    accountTransactionsAll.filter(t => t.type === 'pengeluaran' || (t.type === 'debt' && t.category === 'Piutang')).reduce((s, t) => s + t.amount, 0),
    [accountTransactionsAll]
  );

  const accountSavingsOut = useMemo(() => {
    if (!selectedAccountId) return 0;
    return savings.filter(s => s.fromAccount === selectedAccountId).reduce((sum, s) => sum + s.amount, 0);
  }, [savings, selectedAccountId]);

  const accountBalance = useMemo(() => {
    const acc = selectedAccount;
    if (!acc) return 0;
    return (acc.initialBalance || 0) + accountTotalIn - accountTotalOut - accountSavingsOut;
  }, [selectedAccount, accountTotalIn, accountTotalOut, accountSavingsOut]);

  // Outstanding debt (belum lunas) for selected account
  const accountDebt = useMemo(() => {
    if (!selectedAccountId) return totalGlobalDebt;
    return transactions.filter(t =>
      t.type === 'debt' &&
      t.accountId === selectedAccountId &&
      t.paymentStatus !== 'lunas'
    ).reduce((s, t) => s + t.amount, 0);
  }, [transactions, selectedAccountId, totalGlobalDebt]);

  const barData = useMemo(() => {
    const last8 = accountTransactionsRecent.slice(0, 8).reverse();
    const max = Math.max(...last8.map(t => t.amount), 1);
    return last8.map(t => Math.round((t.amount / max) * 100));
  }, [accountTransactionsRecent]);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Bank Account': return <Building2 size={18} />;
      case 'E-Wallet': return <Smartphone size={18} />;
      case 'Cash': return <Banknote size={18} />;
      case 'Investment Account': return <LineChart size={18} />;
      case 'Credit Card': return <CreditCard size={18} />;
      default: return <Wallet size={18} />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'Bank Account': return 'bg-slate-900 text-white';
      case 'E-Wallet': return 'bg-indigo-50 text-indigo-600';
      case 'Cash': return 'bg-emerald-50 text-emerald-600';
      case 'Investment Account': return 'bg-emerald-50 text-emerald-600';
      case 'Credit Card': return 'bg-rose-50 text-rose-500';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  const getCardGradient = (type: string) => {
    switch (type) {
      case 'Bank Account': return 'bg-gradient-to-br from-slate-800 to-slate-900';
      case 'E-Wallet': return 'bg-gradient-to-br from-indigo-500 to-indigo-700';
      case 'Cash': return 'bg-gradient-to-br from-emerald-500 to-emerald-700';
      case 'Credit Card': return 'bg-gradient-to-br from-rose-500 to-rose-700';
      default: return 'bg-gradient-to-br from-indigo-600 to-indigo-800';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight">Kartu Saya</h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-500 mt-1 max-w-lg leading-relaxed">
            Pantau arus kas Anda dan kelola rekening melalui menu 'Tambah Cepat' di header.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl px-6 py-3 shadow-sm text-right">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Saldo</p>
          <p className="text-xs font-black text-slate-900">{formatRp(totalBalance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Main Card Detail (selected account) */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          
          {/* Selected card hero */}
          {selectedAccount ? (
            <div className={cn("relative overflow-hidden rounded-[20px] md:rounded-[32px] p-6 md:p-10 text-white shadow-2xl", getCardGradient(selectedAccount.type))}>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10 md:mb-12">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-2">{selectedAccount.type} • {selectedAccount.currency}</p>
                    <h2 className="text-xl md:text-3xl lg:text-4xl font-black tracking-tight">{selectedAccount.name}</h2>
                    <p className="text-[10px] font-medium text-white/60 mt-1">Saldo: {formatRp(accountBalance)}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    {getTypeIcon(selectedAccount.type)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 md:gap-8 pt-6 md:pt-8 border-t border-white/10">
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Masuk</p>
                    <p className="text-sm md:text-lg font-bold">{formatRp(accountTotalIn)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Keluar</p>
                    <p className="text-sm md:text-lg font-bold">{formatRp(accountTotalOut)}</p>
                  </div>
                </div>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-white opacity-[0.03] rounded-full pointer-events-none" />
              <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] bg-white opacity-[0.05] rounded-full blur-3xl pointer-events-none" />
            </div>
          ) : (
            <div className="relative overflow-hidden bg-indigo-600 rounded-[20px] md:rounded-[32px] p-6 md:p-10 text-white shadow-2xl shadow-indigo-200">
              <div className="relative z-10">
                <p className="text-[10px] font-black text-indigo-100/60 uppercase tracking-[0.2em] mb-2">Pilih Kartu untuk Detail</p>
                <h2 className="text-2xl md:text-4xl font-black">{formatRp(totalBalance)}</h2>
              </div>
            </div>
          )}

          {/* Cash flow chart + transactions */}
          <div className="bg-white rounded-[20px] md:rounded-[32px] p-5 md:p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h3 className="text-lg font-black text-slate-900">
                {selectedAccount ? `Transaksi ${selectedAccount.name}` : 'Arus Kas (Cash Flow)'}
              </h3>
              <div className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black text-slate-400 tracking-widest uppercase">
                {accountTransactionsRecent.length} transaksi
              </div>
            </div>

            <div className="h-[140px] md:h-[180px] bg-slate-50/50 rounded-2xl p-4 md:p-6 flex items-end justify-between gap-2 md:gap-3 mb-6 md:mb-8 border border-slate-50">
              {barData.length > 0 ? barData.map((h, i) => (
                <div key={i} className={cn("flex-1 rounded-md md:rounded-lg transition-all duration-500", i === barData.length - 1 ? "bg-indigo-600 shadow-lg shadow-indigo-100" : "bg-indigo-200/60")}
                  style={{ height: `${Math.max(h, 5)}%` }} />
              )) : [40, 60, 50, 80, 55, 45].map((h, i) => (
                <div key={i} className="flex-1 rounded-md bg-slate-100" style={{ height: `${h}%` }} />
              ))}
            </div>

            {/* In/Out Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-emerald-50/30 rounded-2xl p-6 border border-emerald-50 flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
                  <ArrowDownCircle size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Uang Masuk</p>
                  <p className="text-xl font-black text-slate-900 tracking-tight">{formatRp(selectedAccount ? accountTotalIn : totalIn)}</p>
                </div>
              </div>
              <div className="bg-rose-50/30 rounded-2xl p-6 border border-rose-50 flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                  <ArrowUpCircle size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Uang Keluar</p>
                  <p className="text-xl font-black text-slate-900 tracking-tight">{formatRp(selectedAccount ? accountTotalOut : totalOut)}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions for this account */}
            {accountTransactionsRecent.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaksi Terkini</p>
                {accountTransactionsRecent.slice(0, 8).map(trx => (
                  <div key={trx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs", trx.type === 'pemasukan' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500')}>
                        {trx.type === 'pemasukan' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{trx.note || trx.category}</p>
                        <p className="text-[9px] text-slate-400">{formatDate(trx.date)}</p>
                      </div>
                    </div>
                    <p className={cn("text-sm font-black shrink-0 ml-2", trx.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-500')}>
                      {trx.type === 'pemasukan' ? '+' : '-'}{formatRp(trx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Account List */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-900">Daftar Akun</h3>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">Memuat akun...</div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <EmptyState title="Belum ada rekening" description="Tambah rekening bank melalui menu 'Tambah Cepat' di header." icon={<Wallet size={20} />} />
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((acc) => (
                <div 
                  key={acc.id} 
                  onClick={() => setSelectedAccountId(acc.id!)}
                  className={cn(
                    "bg-white rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer",
                    selectedAccountId === acc.id ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-100"
                  )}>
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${getTypeBg(acc.type)}`}>
                      {getTypeIcon(acc.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] md:text-sm font-bold text-slate-900 truncate">{acc.name}</p>
                      <p className="text-[9px] md:text-[10px] font-medium text-slate-400">{acc.type} • {acc.currency}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      if (acc.id) {
                        await accountService.deleteAccount(acc.id);
                        if (selectedAccountId === acc.id) setSelectedAccountId(null);
                      }
                    }}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Wealth Summary */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 mt-4 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <LineChart size={20} />
                </div>
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedAccount ? `Detail: ${selectedAccount.name}` : 'Informasi Saldo & Wealth'}
                </h4>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-50 transition-all hover:bg-emerald-50">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Masuk</p>
                    <p className="text-sm font-black text-emerald-600 leading-tight">
                      {formatRp(selectedAccount ? accountTotalIn : totalIn)}
                    </p>
                  </div>
                  <div className="bg-rose-50/30 rounded-2xl p-4 border border-rose-50 transition-all hover:bg-rose-50">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Tagihan Berjalan</p>
                    <p className="text-sm font-black text-rose-500 leading-tight">
                      {formatRp(selectedAccount ? accountDebt : totalGlobalDebt)}
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-50/30 rounded-2xl p-5 border border-indigo-50 transition-all hover:bg-indigo-50">
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Saldo Saat Ini</p>
                  <p className="text-base font-black text-indigo-600 leading-tight">
                    {formatRp(selectedAccount ? accountBalance : totalBalance)}
                  </p>
                </div>

              </div>

              {!selectedAccount && combinedInitial > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-50">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rasio Hutang</span>
                     <span className="text-[10px] font-black text-rose-500">{((totalGlobalDebt / combinedInitial) * 100).toFixed(0)}%</span>
                   </div>
                   <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalGlobalDebt / combinedInitial) * 100)}%` }} />
                   </div>
                </div>
              )}
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-slate-50 rounded-full opacity-50 group-hover:scale-125 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
