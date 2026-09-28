"use client";

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Save, ChevronDown, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { NumberInput } from '@/components/ui/NumberInput';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency, toLocalDateString } from '@/lib/utils';
import { StockCombobox } from '@/components/StockPicker';
import { StockSearchResult } from '@/lib/services/investmentService';

interface StockInvestmentModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  editData?: Investment; // Use this for editing
  initialData?: Investment; // Keep this for selling mode
}

export const StockInvestmentModal = ({ userId, isOpen, onClose, editData, initialData }: StockInvestmentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    stockCode: '',
    logoUrl: '',
    exchangeCode: 'IDX',
    currency: 'IDR',
    sharesCount: '',
    pricePerShare: '',
    currentValue: '',
    transactionType: 'Beli',
    category: 'Saham',
    accountId: '',
    platform: '',
    dateInvested: toLocalDateString()
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, logoUrl: url }));
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Gagal mengunggah logo.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      setError('');
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      exchangeRateService.getLatestRates().then(setRates).catch(console.error);

      if (editData) {
        setFormData({
          stockCode: editData.stockCode || editData.name || '',
          logoUrl: editData.logoUrl || '',
          exchangeCode: editData.exchangeCode || 'IDX',
          currency: editData.currency || 'IDR',
          sharesCount: editData.sharesCount?.toString() || '',
          pricePerShare: editData.pricePerShare?.toString() || '',
          currentValue: editData.currentValue?.toString() || '',
          transactionType: editData.transactionType || 'Beli',
          category: editData.category || 'Saham',
          accountId: editData.accountId || '',
          platform: editData.platform || '',
          dateInvested: toLocalDateString(editData.dateInvested)
        });
      } else if (initialData) {
        setFormData({
          stockCode: initialData.stockCode || initialData.name || '',
          logoUrl: initialData.logoUrl || '',
          exchangeCode: initialData.exchangeCode || 'IDX',
          currency: initialData.currency || 'IDR',
          sharesCount: initialData.sharesCount?.toString() || '',
          pricePerShare: '', // User will input sell price
          currentValue: '',
          transactionType: 'Jual',
          category: 'Saham',
          accountId: initialData.accountId || '',
          platform: initialData.platform || '',
          dateInvested: toLocalDateString()
        });
      } else {
        setFormData({ 
          stockCode: '', logoUrl: '', exchangeCode: 'IDX', currency: 'IDR', sharesCount: '', 
          pricePerShare: '', currentValue: '', transactionType: 'Beli', category: 'Saham', 
          accountId: '', platform: '', dateInvested: toLocalDateString() 
        });
      }
    }
  }, [isOpen, userId, editData, initialData]);

  useEffect(() => {
    const shares = parseFloat(formData.sharesCount) || 0;
    const price = parseFloat(formData.pricePerShare) || 0;
    const invested = shares * price;
    
    if (invested && formData.currency && rates) {
      if (formData.currency === 'IDR') {
        setConvertedAmount(invested);
      } else {
        const idrValue = exchangeRateService.convert(invested, formData.currency, 'IDR', rates);
        setConvertedAmount(idrValue);
      }
    } else {
      setConvertedAmount(0);
    }
  }, [formData.sharesCount, formData.pricePerShare, formData.currency, rates]);

  const handleCreate = async () => {
    if (!userId || !formData.stockCode || !formData.sharesCount || !formData.pricePerShare) return;
    if (!formData.accountId) {
      setError('Pilih rekening sumber/tujuan dana dulu.');
      return;
    }
    setError('');
    setLoading(true);
    const shares = parseFloat(formData.sharesCount) || 0;
    const price = parseFloat(formData.pricePerShare) || 0;

    try {
      // Semua jalur disimpan server dalam satu batch atomik (posisi + transaksi
      // tertaut + saldo + ringkasan) — dulu 4–6 request terpisah dari browser,
      // dan edit memotong saldo lagi tanpa mengembalikan potongan lama.
      if (initialData?.id && formData.transactionType === 'Jual') {
        await investmentService.sell(initialData.id, {
          quantity: shares,
          price,
          accountId: formData.accountId,
          date: formData.dateInvested,
        });
      } else if (editData && editData.transactionType === 'Jual') {
        setError('Catatan penjualan tidak bisa diedit. Hapus catatan ini (posisi asal dipulihkan), lalu jual ulang.');
        return;
      } else {
        const position = {
          type: 'Saham' as const,
          transactionType: 'Beli',
          name: formData.stockCode,
          stockCode: formData.stockCode,
          exchangeCode: formData.exchangeCode,
          sharesCount: shares,
          pricePerShare: price,
          currentValue: parseFloat(formData.currentValue) || undefined,
          currency: formData.currency,
          platform: formData.platform,
          logoUrl: formData.logoUrl,
          category: formData.category,
          accountId: formData.accountId,
          dateInvested: formData.dateInvested,
        };
        if (editData?.id) await investmentService.rebook(editData.id, position);
        else await investmentService.entry(position);
      }

      onClose();
      setFormData({
        stockCode: '', logoUrl: '', exchangeCode: 'IDX', currency: 'IDR', sharesCount: '',
        pricePerShare: '', currentValue: '', transactionType: 'Beli', category: 'Saham',
        accountId: '', platform: '', dateInvested: toLocalDateString()
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Gagal menyimpan posisi saham. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Edit Posisi Saham" : (initialData ? "Jual Posisi Saham" : "Tambah Posisi Saham")} maxWidth="max-w-lg">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {/* Tipe Transaksi Dropdown */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipe Transaksi</label>
          <div className="relative">
            <select 
              value={formData.transactionType}
              onChange={e => setFormData(p => ({...p, transactionType: e.target.value}))}
              // Jual hanya lewat tombol Jual pada posisi (menghitung modal &
              // untung/rugi dari posisi asal) — form baru selalu Beli.
              disabled
              className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer disabled:opacity-60"
            >
              <option value="Beli">Beli (Pengeluaran)</option>
              <option value="Jual">Jual (Pemasukan)</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kode Saham</label>
            <StockCombobox
              value={formData.stockCode}
              onChange={val => setFormData(p => ({...p, stockCode: val}))}
              onSelect={(stock: StockSearchResult) => setFormData(p => ({
                ...p,
                stockCode: stock.symbol,
                exchangeCode: stock.exchangeCode || p.exchangeCode,
                logoUrl: stock.logoUrl || p.logoUrl,
              }))}
              disabled={!!initialData}
              placeholder="Cari BBCA, TLKM, AAPL..."
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 pl-4 pr-9 text-sm font-bold text-slate-700 transition-all disabled:opacity-60"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Icon/Logo</label>
            <div className={`flex items-center gap-3 ${initialData ? 'opacity-60 grayscale' : ''}`}>
              <div className="relative w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                {formData.logoUrl ? (
                  <Image src={formData.logoUrl} alt="Logo Preview" fill className="object-contain" />
                ) : (
                  <ImageIcon className="text-slate-300" size={16} />
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                disabled={!!initialData}
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!initialData}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-[10px] font-black text-slate-600 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={12} />
                    ...
                  </>
                ) : (
                  <>
                    <ImageIcon size={12} />
                    {formData.logoUrl ? 'Ganti' : 'Upload'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kode Bursa</label>
            <input type="text" value={formData.exchangeCode} onChange={e => setFormData(p => ({...p, exchangeCode: e.target.value.toUpperCase()}))}
              disabled={!!initialData}
              placeholder="IDX, NYSE..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
          </div>
          <CurrencySelect 
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
            label="Mata Uang"
            className={initialData ? 'opacity-60 grayscale' : ''}
          />
        </div>

        {/* Conversion Display */}
        {formData.currency !== 'IDR' && formData.sharesCount && formData.pricePerShare && (
          <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <RefreshCw size={14} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Total Terkonversi (IDR)</p>
                <p className="text-sm font-black text-slate-900 leading-none">
                  ~ {formatCurrency(convertedAmount, 'IDR')}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-slate-400 italic">Live Rate</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Lembar (Qty)</label>
            <input type="number" value={formData.sharesCount} onChange={e => setFormData(p => ({...p, sharesCount: e.target.value}))}
              placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {formData.transactionType === 'Jual' ? 'Harga Jual / Lembar' : 'Harga Beli / Lembar'}
            </label>
            <NumberInput value={formData.pricePerShare} onChange={val => setFormData(p => ({...p, pricePerShare: val}))}
              placeholder={formData.transactionType === 'Jual' ? '9000' : '8000'} className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rekening / RDN</label>
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
                disabled={!!initialData}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer disabled:opacity-60"
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Platform Broker</label>
            <input type="text" value={formData.platform} onChange={e => setFormData(p => ({...p, platform: e.target.value}))}
              disabled={!!initialData}
              placeholder="Stockbit, Ajaib..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valuasi Saat Ini (Estimasi)</label>
            <NumberInput value={formData.currentValue} onChange={val => setFormData(p => ({...p, currentValue: val}))}
              placeholder="Opsional" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
            <input type="date" value={formData.dateInvested} onChange={e => setFormData(p => ({...p, dateInvested: e.target.value}))}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.stockCode || !formData.sharesCount || !formData.pricePerShare}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              {formData.transactionType === 'Jual' ? 'Konfirmasi Penjualan Saham' : 'Simpan Posisi Saham'}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
