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

interface DebtModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DebtModal = ({ userId, isOpen, onClose }: DebtModalProps) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    debtType: 'hutang' as 'hutang' | 'piutang',
    paymentStatus: 'belum' as 'lunas' | 'belum',
    amount: '',
    currency: 'IDR',
    lenderName: '',
    note: '',
    accountId: '',
    installmentTenor: '',
    monthlyInterest: '',
    totalInterest: '',
    totalDebt: '',
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
      const isLunas = formData.paymentStatus === 'lunas';
      const isHutang = formData.debtType === 'hutang';

      // Save the debt/piutang record
      await transactionService.createTransaction({
        userId,
        type: 'debt',
        amount,
        amountIDR: convertedAmount || amount,
        currency: formData.currency,
        category: isHutang ? 'Hutang' : 'Piutang',
        subCategory: isHutang ? 'Hutang' : 'Piutang',
        lenderName: formData.lenderName,
        note: formData.note,
        accountId: formData.accountId || 'General',
        installmentTenor: parseInt(formData.installmentTenor) || 0,
        monthlyInterest: parseFloat(formData.monthlyInterest) || 0,
        totalInterest: parseFloat(formData.totalInterest) || 0,
        totalDebt: parseFloat(formData.totalDebt) || 0,
        date: selectedDate,
        displayDate,
        status: isLunas ? 'VERIFIED' : 'PENDING',
        paymentStatus: formData.paymentStatus
      });

      // If Lunas: also record financial impact immediately
      if (isLunas) {
        const financeType = isHutang ? 'pengeluaran' : 'pemasukan';
        await transactionService.createTransaction({
          userId,
          type: financeType,
          amount,
          amountIDR: convertedAmount || amount,
          currency: formData.currency,
          category: isHutang ? 'Hutang' : 'Piutang',
          subCategory: `${isHutang ? 'Hutang' : 'Piutang'} Lunas`,
          accountId: formData.accountId || 'General',
          date: selectedDate,
          displayDate,
          note: `[Lunas] ${isHutang ? 'Hutang' : 'Piutang'} ${formData.lenderName ? `ke/dari ${formData.lenderName}` : ''} - ${formData.note || ''}`.trim(),
          status: 'VERIFIED'
        });
        await updateMemberTotals(userId, financeType, amount);
      }

      onClose();
      setFormData({ 
        debtType: 'hutang', paymentStatus: 'belum', amount: '', currency: 'IDR', lenderName: '', note: '', accountId: '', 
        installmentTenor: '', monthlyInterest: '', totalInterest: '', totalDebt: '', 
        date: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Catat Hutang / Piutang" maxWidth="max-w-xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
        {/* Tipe */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipe</label>
          <div className="grid grid-cols-2 gap-3">
            {(['hutang', 'piutang'] as const).map(type => (
              <button key={type} type="button" onClick={() => setFormData(p => ({...p, debtType: type}))}
                className={`py-3.5 rounded-2xl text-sm font-black capitalize transition-all ${
                  formData.debtType === type
                    ? type === 'hutang' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >{type}</button>
            ))}
          </div>
        </div>

        {/* Status Pembayaran */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status Pembayaran</label>
          <div className="grid grid-cols-2 gap-3">
            {(['belum', 'lunas'] as const).map(s => (
              <button key={s} type="button" onClick={() => setFormData(p => ({...p, paymentStatus: s}))}
                className={`py-3.5 rounded-2xl text-sm font-black capitalize transition-all ${
                  formData.paymentStatus === s
                    ? s === 'lunas' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-700 text-white shadow-lg shadow-slate-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s === 'lunas' ? '✓ Lunas' : '⏳ Belum Lunas'}
              </button>
            ))}
          </div>
          {formData.paymentStatus === 'lunas' && (
            <p className="text-[10px] font-bold text-emerald-600 pl-1 mt-1">
              ✓ {formData.debtType === 'hutang' ? 'Pengeluaran' : 'Pemasukan'} akan otomatis tercatat saat disimpan.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal Pokok</label>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pemberi / Penerima</label>
            <input type="text" value={formData.lenderName} onChange={e => setFormData(p => ({...p, lenderName: e.target.value}))}
              placeholder="Nama orang/bank..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rekening Terkait</label>
            <div className="relative">
              <select 
                value={formData.accountId}
                onChange={e => setFormData(p => ({...p, accountId: e.target.value}))}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="">Pilih Rekening</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tenor (Bln)</label>
            <input type="number" value={formData.installmentTenor} onChange={e => setFormData(p => ({...p, installmentTenor: e.target.value}))}
              placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bunga / Bln</label>
            <input type="number" value={formData.monthlyInterest} onChange={e => setFormData(p => ({...p, monthlyInterest: e.target.value}))}
              placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
           <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Total Bunga</label>
            <input type="number" value={formData.totalInterest} onChange={e => setFormData(p => ({...p, totalInterest: e.target.value}))}
              placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Total Hutang</label>
            <input type="number" value={formData.totalDebt} onChange={e => setFormData(p => ({...p, totalDebt: e.target.value}))}
              placeholder="Nominal + Total Bunga" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
           <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
            <input type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Deskripsi / Catatan</label>
          <textarea 
            rows={2}
            value={formData.note} 
            onChange={e => setFormData(p => ({...p, note: e.target.value}))}
            placeholder="Keterangan tambahan..." 
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all resize-none" 
          />
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.amount}
          className="w-full bg-black disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-slate-200 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Catatan
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
