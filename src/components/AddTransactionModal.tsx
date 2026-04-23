"use client";

import { useState, useEffect } from 'react';
import { X, Save, TrendingUp, TrendingDown, ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Input } from './Input';
import { CategorySelect } from './CategorySelect';
import { CurrencySelect } from './CurrencySelect';
import { transactionService, TransactionType } from '@/lib/services/transactionService';
import { updateMemberTotals } from '@/lib/services/userService';
import { accountService, Account } from '@/lib/services/accountService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency } from '@/lib/utils';

interface AddTransactionModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AddTransactionModal = ({ userId, isOpen, onClose }: AddTransactionModalProps) => {
  const [type, setType] = useState<TransactionType>('pemasukan');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    note: '',
    currency: 'IDR',
    amount: '',
    category: '',
    subCategory: '',
    accountId: '',
    installmentTenor: '',
    monthlyInterest: '',
    totalInterest: ''
  });

  useEffect(() => {
    if (isOpen && userId) {
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      exchangeRateService.getLatestRates().then(setRates).catch(console.error);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (formData.amount && formData.currency && rates) {
      const amount = parseFloat(formData.amount);
      if (formData.currency === 'IDR') {
        setConvertedAmount(amount);
      } else {
        const idrValue = exchangeRateService.convert(amount, formData.currency, 'IDR', rates);
        setConvertedAmount(idrValue);
      }
    } else {
      setConvertedAmount(0);
    }
  }, [formData.amount, formData.currency, rates]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amountNum = parseFloat(formData.amount);
      await transactionService.createTransaction({
        userId,
        type: type === 'pemasukan' || type === 'pengeluaran' ? type : 'pemasukan',
        amount: amountNum,
        amountIDR: convertedAmount || amountNum,
        category: formData.category,
        subCategory: formData.subCategory,
        currency: formData.currency,
        accountId: formData.accountId || 'General',
        installmentTenor: parseInt(formData.installmentTenor) || 0,
        monthlyInterest: parseFloat(formData.monthlyInterest) || 0,
        totalInterest: parseFloat(formData.totalInterest) || 0,
        date: new Date(formData.date),
        note: formData.note,
        status: 'VERIFIED'
      });
      
      await updateMemberTotals(userId, type, amountNum);
      
      // Update Account Balance
      if (formData.accountId) {
        const balanceChange = type === 'pemasukan' ? amountNum : -amountNum;
        await accountService.updateAccountBalance(formData.accountId, balanceChange);
      }

      onClose();
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        note: '',
        currency: 'IDR',
        amount: '',
        category: '',
        subCategory: '',
        accountId: '',
        installmentTenor: '',
        monthlyInterest: '',
        totalInterest: ''
      });
    } catch (err) {
      console.error('Error adding transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'pemasukan', label: 'Income', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'pengeluaran', label: 'Expense', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white border border-slate-100 rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-8 border-b border-slate-50">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Tambah Transaksi Harian</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            {types.map((t) => {
              const Icon = t.icon;
              const isActive = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id as TransactionType)}
                  className={cn(
                    "flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all",
                    isActive 
                      ? t.id === 'pemasukan' ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-rose-500 bg-rose-50 text-rose-600"
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-400"
                  )}
                >
                  <Icon size={20} />
                  <span className="text-sm font-black uppercase tracking-widest">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 mt-1 transition-all"
                required
              />
            </div>
            <Input 
              label="Deskripsi" 
              placeholder="Contoh: Makan Siang Kantor" 
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CurrencySelect 
              label="Mata Uang"
              value={formData.currency}
              onChange={(val) => setFormData({...formData, currency: val})}
            />
            <Input 
              label="Nominal" 
              placeholder="0" 
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>
          
          {/* Conversion Display */}
          {formData.currency !== 'IDR' && formData.amount && (
            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                  <RefreshCw size={14} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Terkonversi ke IDR</p>
                  <p className="text-sm font-black text-slate-900 leading-none">
                    ~ {formatCurrency(convertedAmount, 'IDR')}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-400 italic">Live Rate</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CategorySelect 
              label="Kategori Utama" 
              value={formData.category} 
              type={type === 'pemasukan' ? 'income' : 'expense'} 
              onChange={(val) => setFormData(prev => ({...prev, category: val}))}
              onSubCategoryChange={(sub) => setFormData(prev => ({...prev, subCategory: sub}))}
            />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sub Kategori</label>
              <input
                type="text"
                placeholder="Otomatis dari kategori..."
                value={formData.subCategory}
                onChange={(e) => setFormData(prev => ({...prev, subCategory: e.target.value}))}
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rekening / Wallet</label>
            <div className="relative mt-1">
              <select 
                value={formData.accountId}
                onChange={(e) => setFormData({...formData, accountId: e.target.value})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 cursor-pointer transition-all"
              >
                <option value="">Pilih Rekening</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-50">
            <Input 
              label="Tenor (Bln)" 
              placeholder="0" 
              type="number"
              value={formData.installmentTenor}
              onChange={(e) => setFormData({...formData, installmentTenor: e.target.value})}
            />
            <Input 
              label="Bunga / Bln" 
              placeholder="0" 
              type="number"
              value={formData.monthlyInterest}
              onChange={(e) => setFormData({...formData, monthlyInterest: e.target.value})}
            />
            <Input 
              label="Total Bunga" 
              placeholder="0" 
              type="number"
              value={formData.totalInterest}
              onChange={(e) => setFormData({...formData, totalInterest: e.target.value})}
            />
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-50">
            <Button variant="secondary" className="flex-1 font-bold h-14 rounded-2xl" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button className="flex-1 font-bold h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100" isLoading={loading}>
              <Save size={18} className="mr-3" /> Simpan Transaksi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

