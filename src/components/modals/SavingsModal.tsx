"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, Save, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { savingsService } from '@/lib/services/savingsService';
import { accountService, Account } from '@/lib/services/accountService';
import { CurrencySelect } from '@/components/CurrencySelect';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency } from '@/lib/utils';

interface SavingsModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SAVING_GOALS = ['Dana Darurat', 'Liburan', 'Pendidikan', 'Properti', 'Kendaraan', 'Bisnis', 'Lainnya'];

export const SavingsModal = ({ userId, isOpen, onClose }: SavingsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    description: '',
    subCategory: '',
    amount: '',
    category: 'Dana Darurat',
    fromAccount: '',
    toGoal: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'IDR'
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

  const handleCreate = async () => {
    if (!userId || !formData.description || !formData.amount) return;
    setLoading(true);
    
    try {
      const selectedDate = new Date(formData.date);
      const displayDate = selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      
      await savingsService.createSaving({
        userId,
        description: formData.description,
        subCategory: formData.subCategory,
        amount: parseFloat(formData.amount),
        amountIDR: convertedAmount || parseFloat(formData.amount),
        currency: formData.currency,
        category: formData.category,
        fromAccount: formData.fromAccount || 'General',
        toGoal: formData.toGoal || formData.category,
        date: selectedDate,
        displayDate: displayDate
      });
      onClose();
      setFormData({ 
        description: '', subCategory: '', amount: '', category: 'Dana Darurat', fromAccount: '', 
        toGoal: '', date: new Date().toISOString().split('T')[0], 
        currency: 'IDR' 
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Catat Setoran Tabungan" maxWidth="max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Deskripsi</label>
          <input type="text" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))}
            placeholder="Setoran Dana Darurat..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Goal / Kategori</label>
            <div className="relative">
              <select value={formData.category} onChange={e => setFormData(p => ({...p, category: e.target.value}))}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer">
                {SAVING_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sub Kategori</label>
            <input type="text" value={formData.subCategory} onChange={e => setFormData(p => ({...p, subCategory: e.target.value}))}
              placeholder="Opsional" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))}
                placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 pl-11 pr-5 text-sm font-bold text-slate-700 transition-all" />
            </div>
          </div>
          <CurrencySelect 
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
            label="Mata Uang"
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
                  ≈ {formatCurrency(convertedAmount, 'IDR')}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-slate-400 italic">Live Rate</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Dari Rekening</label>
            <div className="relative">
              <select 
                value={formData.fromAccount}
                onChange={e => setFormData(p => ({...p, fromAccount: e.target.value}))}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="">Pilih Rekening</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
            <input type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Ke Goal (Tujuan)</label>
          <input type="text" value={formData.toGoal} onChange={e => setFormData(p => ({...p, toGoal: e.target.value}))}
            placeholder="Ketik tujuan spesifik (opsional)..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.description || !formData.amount}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Setoran
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
