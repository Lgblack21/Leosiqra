"use client";

import { useState, useEffect } from 'react';
import { Save, ChevronDown, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { transactionService } from '@/lib/services/transactionService';
import { accountService, Account } from '@/lib/services/accountService';
import { updateMemberTotals } from '@/lib/services/userService';
import { CurrencySelect } from '@/components/CurrencySelect';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency } from '@/lib/utils';

interface TopUpModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TopUpModal = ({ userId, isOpen, onClose }: TopUpModalProps) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    type: 'topup' as 'topup' | 'transfer',
    amount: '',
    currency: 'IDR',
    accountId: '',
    targetAccountId: '',
    note: '',
    date: new Date().toISOString().split('T')[0]
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
    if (!userId || !formData.amount) return;
    setLoading(true);
    
    try {
      const amount = parseFloat(formData.amount);
      const selectedDate = new Date(formData.date);
      const displayDate = selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const label = formData.type === 'topup' ? 'Top Up' : 'Transfer';
      const note = formData.note || `${label} ke ${accounts.find(a => a.id === formData.targetAccountId)?.name || formData.targetAccountId}`;

      // 1. Pengeluaran dari rekening sumber
      await transactionService.createTransaction({
        userId,
        type: 'pengeluaran',
        amount,
        amountIDR: convertedAmount || amount,
        currency: formData.currency,
        category: label,
        subCategory: `${label} Keluar`,
        accountId: formData.accountId || 'General',
        targetAccountId: formData.targetAccountId,
        date: selectedDate,
        displayDate,
        note: `[${label} Keluar] ${note}`,
        status: 'VERIFIED'
      });

      // 2. Pemasukan ke rekening tujuan
      if (formData.targetAccountId && formData.targetAccountId !== 'Wallet') {
        await transactionService.createTransaction({
          userId,
          type: 'pemasukan',
          amount,
          amountIDR: convertedAmount || amount,
          currency: formData.currency,
          category: label,
          subCategory: `${label} Masuk`,
          accountId: formData.targetAccountId,
          date: selectedDate,
          displayDate,
          note: `[${label} Masuk] ${note}`,
          status: 'VERIFIED'
        });
      }

      // 3. Update member totals (net 0 for transfer; net +amount for external top-up)
      await updateMemberTotals(userId, 'pengeluaran', convertedAmount || amount);
      if (formData.targetAccountId && formData.targetAccountId !== 'Wallet') {
        await updateMemberTotals(userId, 'pemasukan', convertedAmount || amount);
      }

      // 4. Update Account Balances
      if (formData.accountId) {
        await accountService.updateAccountBalance(formData.accountId, -(convertedAmount || amount));
      }
      if (formData.targetAccountId && formData.targetAccountId !== 'Wallet') {
        await accountService.updateAccountBalance(formData.targetAccountId, (convertedAmount || amount));
      }

      onClose();
      setFormData({ 
        type: 'topup', amount: '', currency: 'IDR', accountId: '', targetAccountId: '', note: '', 
        date: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer / Top Up Baru" maxWidth="max-w-lg">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis Layanan</label>
          <div className="grid grid-cols-2 gap-3">
            {(['topup', 'transfer'] as const).map(type => (
              <button key={type} onClick={() => setFormData(p => ({...p, type}))}
                className={`py-3.5 rounded-2xl text-sm font-black capitalize transition-all ${
                  formData.type === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >{type === 'topup' ? 'Top Up' : 'Transfer'}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="space-y-2 flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))}
                placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 transition-all" />
            </div>
          </div>
          <CurrencySelect 
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
            label="Mata Uang"
            className="w-1/3"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {formData.type === 'topup' ? 'Rekening Sumber' : 'Dari (Asal)'}
            </label>
            <div className="relative">
              <select 
                value={formData.accountId}
                onChange={e => setFormData(p => ({...p, accountId: e.target.value}))}
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {formData.type === 'topup' ? 'Tujuan Top Up' : 'Ke (Tujuan)'}
            </label>
            <div className="relative">
              <select 
                value={formData.targetAccountId}
                onChange={e => setFormData(p => ({...p, targetAccountId: e.target.value}))}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="">Pilih Tujuan</option>
                <option value="Wallet">Digital Wallet (OVO/Gopay/DANA)</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
          <input type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))}
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Deskripsi / Catatan</label>
          <input type="text" value={formData.note} onChange={e => setFormData(p => ({...p, note: e.target.value}))}
            placeholder="Tujuan transfer..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all" />
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.amount}
          className="w-full bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Transfer
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
