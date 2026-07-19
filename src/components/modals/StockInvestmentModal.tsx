"use client";

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Save, ChevronDown, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { updateMemberTotals } from '@/lib/services/userService';
import { addTransaction } from '@/lib/services/transactionService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency } from '@/lib/utils';

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
    dateInvested: new Date().toISOString().split('T')[0]
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
          dateInvested: editData.dateInvested.toISOString().split('T')[0]
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
          dateInvested: new Date().toISOString().split('T')[0]
        });
      } else {
        setFormData({ 
          stockCode: '', logoUrl: '', exchangeCode: 'IDX', currency: 'IDR', sharesCount: '', 
          pricePerShare: '', currentValue: '', transactionType: 'Beli', category: 'Saham', 
          accountId: '', platform: '', dateInvested: new Date().toISOString().split('T')[0] 
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
    setError('');
    setLoading(true);

    const shares = parseFloat(formData.sharesCount) || 0;
    const price = parseFloat(formData.pricePerShare) || 0;
    const invested = shares * price;
    const current = parseFloat(formData.currentValue) || invested;
    // Kalau kurs gagal dikonversi, jangan kirim angka mentah sebagai IDR
    // final — biarkan backend menghitung ulang lewat kurs server-side.
    const canConvert =
      formData.currency === 'IDR' ||
      Boolean(rates && rates[formData.currency] && rates['IDR']);

    try {
      const isSell = formData.transactionType === 'Jual' && !!initialData?.id;

      if (isSell && initialData) {
        // Jual: baris beli asli dipertahankan sebagai cost basis, baris baru
        // dibuat untuk realisasi jualnya (untung/rugi dihitung proporsional).
        const originalShares = Number(initialData.sharesCount) || 0;
        const originalInvested = Number(initialData.amountInvested) || 0;
        const costBasisPerShare = originalShares > 0 ? originalInvested / originalShares : 0;
        const soldShares = shares;
        const costBasisSold = costBasisPerShare * soldShares;
        const proceeds = invested; // shares * harga jual
        const remainingShares = Math.max(0, originalShares - soldShares);
        const remainingInvested = costBasisPerShare * remainingShares;
        const ratio = originalInvested > 0 ? remainingInvested / originalInvested : 0;

        await investmentService.updateInvestment(initialData.id!, {
          sharesCount: remainingShares,
          amountInvested: remainingInvested,
          amountIDR: typeof initialData.amountIDR === 'number' ? initialData.amountIDR * ratio : undefined,
          currentValue: (initialData.currentValue || 0) * ratio,
          currentValueIDR: typeof initialData.currentValueIDR === 'number' ? initialData.currentValueIDR * ratio : undefined,
          status: remainingShares > 0 ? 'Active' : 'Closed',
        });

        const finalInvestmentId = await investmentService.createInvestment({
          userId,
          name: initialData.stockCode || initialData.name,
          type: 'Saham',
          stockCode: (initialData.stockCode || '').toUpperCase(),
          exchangeCode: (initialData.exchangeCode || 'IDX').toUpperCase(),
          logoUrl: initialData.logoUrl,
          sharesCount: soldShares,
          pricePerShare: price,
          transactionType: 'Jual',
          category: formData.category,
          accountId: formData.accountId || 'General',
          platform: initialData.platform,
          amountInvested: costBasisSold,
          amountIDR: canConvert ? costBasisSold * (convertedAmount / (invested || 1)) : undefined,
          currentValue: proceeds,
          currentValueIDR: canConvert ? convertedAmount : undefined,
          returnPercentage: costBasisSold > 0 ? ((proceeds - costBasisSold) / costBasisSold) * 100 : 0,
          currency: formData.currency,
          dateInvested: new Date(formData.dateInvested),
          status: 'Closed',
          relatedInvestmentId: initialData.id
        });

        try {
          const realizedPnl = proceeds - costBasisSold;
          await updateMemberTotals(userId, 'pemasukan', proceeds);
          await updateMemberTotals(userId, 'investasi', -costBasisSold);

          if (formData.accountId) {
            await accountService.updateAccountBalance(formData.accountId, proceeds);
          }

          await addTransaction({
            userId, type: 'pemasukan', amount: proceeds,
            amountIDR: canConvert ? convertedAmount : undefined,
            category: 'Investasi', subCategory: `Jual Saham ${formData.stockCode}`,
            accountId: formData.accountId || 'General',
            date: new Date(formData.dateInvested),
            note: `[Baru] Penjualan ${soldShares} lembar saham ${formData.stockCode} @ ${formData.pricePerShare} (${realizedPnl >= 0 ? 'Untung' : 'Rugi'} ${formatCurrency(Math.abs(realizedPnl), formData.currency)})`,
            status: 'VERIFIED',
            relatedId: finalInvestmentId,
            relatedType: 'investasi'
          });
        } catch (syncErr) {
          console.error('Posisi saham tersimpan, tapi gagal sinkronisasi ringkasan/saldo:', syncErr);
        }

        onClose();
        setFormData({
          stockCode: '', logoUrl: '', exchangeCode: 'IDX', currency: 'IDR', sharesCount: '',
          pricePerShare: '', currentValue: '', transactionType: 'Beli', category: 'Saham',
          accountId: '', platform: '', dateInvested: new Date().toISOString().split('T')[0]
        });
        return;
      }

      const investmentPayload: Omit<Investment, 'id' | 'createdAt'> = {
        userId,
        name: formData.stockCode,
        type: 'Saham',
        stockCode: formData.stockCode.toUpperCase(),
        exchangeCode: formData.exchangeCode.toUpperCase(),
        logoUrl: formData.logoUrl,
        sharesCount: shares,
        pricePerShare: price,
        transactionType: formData.transactionType,
        category: formData.category,
        accountId: formData.accountId || 'General',
        platform: formData.platform,
        amountInvested: invested,
        amountIDR: canConvert ? convertedAmount : undefined,
        currentValue: current,
        currentValueIDR: canConvert ? (formData.currency === 'IDR' ? current : (current * (convertedAmount / (invested || 1)))) : undefined,
        returnPercentage: invested > 0 ? ((current - invested) / invested) * 100 : 0,
        currency: formData.currency,
        dateInvested: new Date(formData.dateInvested),
        status: 'Active'
      };

      // Penyimpanan inti, aman untuk retry kalau gagal.
      let finalInvestmentId = editData?.id || '';
      if (editData?.id) {
        await investmentService.updateInvestment(editData.id, investmentPayload);
      } else {
        finalInvestmentId = await investmentService.createInvestment(investmentPayload);
      }

      // Sinkronisasi lanjutan bersifat non-fatal — posisinya sendiri sudah
      // tersimpan, jangan sampai gagal di sini memicu submit ulang (posisi dobel).
      try {
        if (editData) {
          const oldInvested = Number(editData.amountInvested) || 0;
          const oldType = editData.transactionType || 'Beli';
          const isOldSell = oldType === 'Jual';
          const oldFinanceType = isOldSell ? 'pemasukan' : 'pengeluaran';
          await updateMemberTotals(userId, oldFinanceType, -oldInvested);
          await updateMemberTotals(userId, 'investasi', isOldSell ? oldInvested : -oldInvested);
        }

        await updateMemberTotals(userId, 'pengeluaran', invested);
        await updateMemberTotals(userId, 'investasi', invested);

        if (formData.accountId) {
          await accountService.updateAccountBalance(formData.accountId, -invested);
        }

        await addTransaction({
          userId, type: 'pengeluaran', amount: invested,
          amountIDR: canConvert ? convertedAmount : undefined,
          category: 'Investasi', subCategory: `Beli Saham ${formData.stockCode}`,
          accountId: formData.accountId || 'General',
          date: new Date(formData.dateInvested),
          note: `${editData ? '[Update]' : '[Baru]'} Pembelian ${formData.sharesCount} lembar saham ${formData.stockCode} @ ${formData.pricePerShare}`,
          status: 'VERIFIED',
          relatedId: finalInvestmentId,
          relatedType: 'investasi'
        });
      } catch (syncErr) {
        console.error('Posisi saham tersimpan, tapi gagal sinkronisasi ringkasan/saldo:', syncErr);
      }

      onClose();
      // Reset form
      setFormData({
        stockCode: '', logoUrl: '', exchangeCode: 'IDX', currency: 'IDR', sharesCount: '',
        pricePerShare: '', currentValue: '', transactionType: 'Beli', category: 'Saham',
        accountId: '', platform: '', dateInvested: new Date().toISOString().split('T')[0]
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
              disabled={!!initialData}
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
            <input type="text" value={formData.stockCode} onChange={e => setFormData(p => ({...p, stockCode: e.target.value.toUpperCase()}))}
              disabled={!!initialData}
              placeholder="BBCA, TLKM..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
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
            <input type="number" value={formData.pricePerShare} onChange={e => setFormData(p => ({...p, pricePerShare: e.target.value}))}
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
            <input type="number" value={formData.currentValue} onChange={e => setFormData(p => ({...p, currentValue: e.target.value}))}
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
