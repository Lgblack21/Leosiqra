"use client";

import { useState, useEffect } from 'react';
import { Save, ChevronDown, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NumberInput } from '@/components/ui/NumberInput';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { CategorySelect } from '@/components/CategorySelect';
import { CurrencySelect } from '@/components/CurrencySelect';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency, getCurrencySymbol, toLocalDateString } from '@/lib/utils';

interface DepositModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  editData?: Investment;
}

export const DepositModal = ({ userId, isOpen, onClose, editData }: DepositModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    name: '',
    platform: '',
    currency: 'IDR',
    amountInvested: '',
    durationMonths: '',
    returnPercentage: '',
    taxPercentage: '',
    transactionType: 'Penempatan',
    category: '',
    accountId: '',
    dateInvested: toLocalDateString(),
    targetDate: toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Default tomorrow
    maturityAction: 'cairkan' as 'cairkan' | 'aro_bunga' | 'aro_full'
  });

  useEffect(() => {
    if (isOpen && userId) {
      setError('');
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      exchangeRateService.getLatestRates().then(setRates).catch(console.error);

      if (editData) {
        setFormData({
          name: editData.name,
          platform: editData.platform || '',
          currency: editData.currency || 'IDR',
          amountInvested: editData.amountInvested.toString(),
          durationMonths: '', // irrelevant now
          returnPercentage: editData.returnPercentage.toString(),
          taxPercentage: editData.taxPercentage?.toString() || '',
          transactionType: editData.transactionType || 'Penempatan',
          category: editData.category || '',
          accountId: editData.accountId || '',
          dateInvested: toLocalDateString(editData.dateInvested),
          targetDate: editData.targetDate ? toLocalDateString(editData.targetDate) : toLocalDateString(),
          maturityAction: (editData.maturityAction as 'cairkan' | 'aro_bunga' | 'aro_full') || 'cairkan'
        });
      } else {
        // Reset to initial
        setFormData({
          name: '', platform: '', currency: 'IDR', amountInvested: '', durationMonths: '', returnPercentage: '', taxPercentage: '', transactionType: 'Penempatan', category: '', accountId: '', dateInvested: toLocalDateString(),
          targetDate: toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
          maturityAction: 'cairkan'
        });
      }
    }
  }, [isOpen, userId, editData]);

  useEffect(() => {
    if (formData.amountInvested && formData.currency && rates) {
      const amount = parseFloat(formData.amountInvested);
      if (formData.currency === 'IDR') {
        setConvertedAmount(amount);
      } else {
        const idrValue = exchangeRateService.convert(amount, formData.currency, 'IDR', rates);
        setConvertedAmount(idrValue);
      }
    } else {
      setConvertedAmount(0);
    }
  }, [formData.amountInvested, formData.currency, rates]);

  const calculateDays = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleCreate = async () => {
    if (!userId || !formData.name || !formData.amountInvested) return;
    if (!formData.accountId) {
      setError('Pilih rekening sumber/tujuan dana dulu.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Server menghitung bunga bersih (tarif, pajak, lama hari) dan menyimpan
      // posisi + transaksi tertaut + saldo + ringkasan dalam satu batch atomik.
      // Edit membalikkan efek lama & menerapkan yang baru sekaligus.
      const position = {
        type: 'Deposito' as const,
        transactionType: formData.transactionType,
        name: formData.name,
        platform: formData.platform,
        currency: formData.currency,
        amountInvested: parseFloat(formData.amountInvested) || 0,
        returnPercentage: parseFloat(formData.returnPercentage) || 0,
        taxPercentage: parseFloat(formData.taxPercentage) || 0,
        category: formData.category,
        accountId: formData.accountId,
        dateInvested: formData.dateInvested,
        targetDate: formData.targetDate,
        maturityAction: formData.transactionType === 'Penempatan' ? (formData.maturityAction as 'cairkan' | 'aro_bunga' | 'aro_full') : undefined,
      };
      if (editData?.id) await investmentService.rebook(editData.id, position);
      else await investmentService.entry(position);

      onClose();
      const initialTargetDate = toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
      setFormData({
        name: '', platform: '', currency: 'IDR', amountInvested: '', durationMonths: '', returnPercentage: '', taxPercentage: '', transactionType: 'Penempatan', category: '', accountId: '', dateInvested: toLocalDateString(),
        targetDate: initialTargetDate,
        maturityAction: 'cairkan'
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Gagal menyimpan deposito. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Edit Deposito" : "Buka Deposito Baru"} maxWidth="max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Deposito</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))}
              placeholder="Deposito Fleksi..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bank / Institusi</label>
            <input type="text" value={formData.platform} onChange={e => setFormData(p => ({...p, platform: e.target.value}))}
              placeholder="BCA, Mandiri..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{getCurrencySymbol(formData.currency)}</span>
              <NumberInput value={formData.amountInvested} onChange={val => setFormData(p => ({...p, amountInvested: val}))}
                placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-slate-700 transition-all" />
            </div>
          </div>
          <CurrencySelect 
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
            label="Mata Uang"
          />
        </div>

        {/* Conversion Display */}
        {formData.currency !== 'IDR' && formData.amountInvested && (
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

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Durasi</label>
            <div className="relative">
              <input type="text" readOnly 
                value={`${calculateDays(formData.dateInvested, formData.targetDate)} Hari`}
                className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-500 cursor-not-allowed" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bunga %</label>
            <input type="number" step="0.01" value={formData.returnPercentage} onChange={e => setFormData(p => ({...p, returnPercentage: e.target.value}))}
              placeholder="5.5" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pajak %</label>
            <input type="number" step="0.01" value={formData.taxPercentage} onChange={e => setFormData(p => ({...p, taxPercentage: e.target.value}))}
              placeholder="20" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal Penempatan</label>
            <input type="date" value={formData.dateInvested} onChange={e => setFormData(p => ({...p, dateInvested: e.target.value}))}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-indigo-500">Tanggal Jatuh Tempo</label>
            <input type="date" value={formData.targetDate} onChange={e => setFormData(p => ({...p, targetDate: e.target.value}))}
              className="w-full bg-indigo-50/50 border-indigo-100 border focus:ring-2 focus:ring-indigo-100 rounded-xl py-3 px-4 text-sm font-bold text-indigo-700 transition-all" />
          </div>
        </div>
        {/* Rekening & Tipe Transaksi */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rekening / Sumber</label>
            <div className="relative">
              <select
                value={formData.accountId}
                onChange={e => {
                  const selectedAccount = accounts.find(acc => acc.id === e.target.value);
                  setFormData(p => ({
                    ...p,
                    accountId: e.target.value,
                    // Ikuti mata uang rekening yang dipilih.
                    currency: selectedAccount?.currency || p.currency,
                  }));
                }}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
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
            {editData ? (
              <>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipe Transaksi</label>
                <div className="relative">
                  <select
                    value={formData.transactionType}
                    onChange={e => setFormData(p => ({...p, transactionType: e.target.value}))}
                    className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
                  >
                    <option value="Penempatan">Penempatan</option>
                    <option value="Penarikan">Penarikan</option>
                    <option value="Bunga">Bunga</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </>
            ) : (
              <>
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest pl-1">Perlakuan Saat Jatuh Tempo</label>
                <div className="relative">
                  <select
                    value={formData.maturityAction}
                    onChange={e => setFormData(p => ({...p, maturityAction: e.target.value as typeof p.maturityAction}))}
                    className="w-full appearance-none bg-emerald-50/50 border border-emerald-100 focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-emerald-700 transition-all cursor-pointer"
                  >
                    <option value="cairkan">Cairkan Semua (Pokok + Bunga)</option>
                    <option value="aro_bunga">ARO - Bunga Cair, Pokok Diperpanjang</option>
                    <option value="aro_full">ARO - Pokok + Bunga Diperpanjang</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                </div>
              </>
            )}
          </div>
        </div>

        {editData && formData.transactionType === 'Penempatan' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest pl-1">Perlakuan Saat Jatuh Tempo</label>
            <div className="relative">
              <select
                value={formData.maturityAction}
                onChange={e => setFormData(p => ({...p, maturityAction: e.target.value as typeof p.maturityAction}))}
                className="w-full appearance-none bg-emerald-50/50 border border-emerald-100 focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-emerald-700 transition-all cursor-pointer"
              >
                <option value="cairkan">Cairkan Semua (Pokok + Bunga)</option>
                <option value="aro_bunga">ARO - Bunga Cair, Pokok Diperpanjang</option>
                <option value="aro_full">ARO - Pokok + Bunga Diperpanjang</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <CategorySelect 
              label="Kategori Deposito"
              value={formData.category}
              type="expense"
              onChange={(val: string) => setFormData(p => ({...p, category: val}))}
              showBadge={false}
            />
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.name || !formData.amountInvested}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Deposito
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
