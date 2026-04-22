"use client";

import { useState, useEffect, useRef } from 'react';
import { Save, ChevronDown, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { CategorySelect } from '@/components/CategorySelect';
import { updateMemberTotals } from '@/lib/services/userService';
import { addTransaction } from '@/lib/services/transactionService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { formatCurrency } from '@/lib/utils';

interface OtherInvestmentModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  editData?: Investment;
  initialData?: any; // For selling mode
}

export const OtherInvestmentModal = ({ userId, isOpen, onClose, editData, initialData }: OtherInvestmentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    currency: 'IDR',
    quantity: '',
    unit: '',
    pricePerUnit: '',
    currentValue: '',
    transactionType: 'Pembelian',
    category: '',
    accountId: '',
    platform: '',
    assetType: 'Emas',
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
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      exchangeRateService.getLatestRates().then(setRates).catch(console.error);
      
      if (editData) {
        setFormData({
          name: editData.name,
          logoUrl: editData.logoUrl || '',
          currency: editData.currency || 'IDR',
          quantity: editData.quantity?.toString() || '',
          unit: editData.unit || '',
          pricePerUnit: editData.pricePerUnit?.toString() || '',
          currentValue: editData.currentValue?.toString() || '',
          transactionType: editData.transactionType || 'Pembelian',
          category: editData.category || '',
          accountId: editData.accountId || '',
          platform: editData.platform || '',
          assetType: 'Emas', // default or custom
          dateInvested: editData.dateInvested.toISOString().split('T')[0]
        });
      } else if (initialData) {
        setFormData({
          name: initialData.name,
          logoUrl: initialData.logoUrl || '',
          currency: initialData.currency || 'IDR',
          quantity: initialData.quantity?.toString() || '',
          unit: initialData.unit || '',
          pricePerUnit: initialData.pricePerUnit?.toString() || '', // Tampil harga beli awal, bisa diedit
          currentValue: '',
          transactionType: 'Penjualan',
          category: initialData.category || '',
          accountId: initialData.accountId || '',
          platform: initialData.platform || '',
          assetType: 'Emas', // default or custom
          dateInvested: new Date().toISOString().split('T')[0]
        });
      } else {
        setFormData({ name: '', logoUrl: '', currency: 'IDR', quantity: '', unit: '', pricePerUnit: '', currentValue: '', transactionType: 'Pembelian', category: '', accountId: '', platform: '', assetType: 'Emas', dateInvested: new Date().toISOString().split('T')[0] });
      }
    }
  }, [isOpen, userId, editData, initialData]);

  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.pricePerUnit) || 0;
    const invested = qty * price;
    
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
  }, [formData.quantity, formData.pricePerUnit, formData.currency, rates]);

  const handleCreate = async () => {
    if (!userId || !formData.name || !formData.quantity || !formData.pricePerUnit) return;
    setLoading(true);
    
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.pricePerUnit) || 0;
    const invested = qty * price;
    const current = parseFloat(formData.currentValue) || invested;
    
    try {
      const investmentPayload: any = {
        userId, name: formData.name, type: 'Lainnya',
        platform: formData.platform || formData.assetType,
        amountInvested: invested, 
        amountIDR: convertedAmount || invested,
        currentValue: current,
        currentValueIDR: formData.currency === 'IDR' ? current : (current * (convertedAmount / (invested || 1))),
        returnPercentage: invested > 0 ? ((current - invested) / invested) * 100 : 0,
        currency: formData.currency, 
        logoUrl: formData.logoUrl,
        quantity: qty,
        unit: formData.unit,
        pricePerUnit: price,
        transactionType: formData.transactionType,
        category: formData.category,
        accountId: formData.accountId || 'General',
        dateInvested: new Date(formData.dateInvested), status: 'Active'
      };

      // Financial Sync Logic (Handle both New and Edit)
      const currentInvested = invested;
      const currentType = formData.transactionType;

      if (editData) {
        // 1. REVERT OLD IMPACT
        const oldInvested = editData.amountInvested;
        const oldType = editData.transactionType || 'Pembelian';
        
        // Revert member totals
        if (oldType === 'Pembelian') {
          await updateMemberTotals(userId, 'pengeluaran', -oldInvested);
          await updateMemberTotals(userId, 'investasi', -oldInvested);
        } else if (oldType === 'Penjualan') {
          await updateMemberTotals(userId, 'pemasukan', -oldInvested);
          await updateMemberTotals(userId, 'investasi', oldInvested);
        }
      }

      // 2. APPLY NEW IMPACT
      const financeType = currentType === 'Pembelian' ? 'pengeluaran' : 'pemasukan';
      await updateMemberTotals(userId, financeType, currentInvested);
      
      if (currentType === 'Pembelian') await updateMemberTotals(userId, 'investasi', currentInvested);
      if (currentType === 'Penjualan') await updateMemberTotals(userId, 'investasi', -currentInvested);

      // Update Account Balance
      if (formData.accountId) {
        const balanceChange = currentType === 'Penjualan' ? currentInvested : -currentInvested;
        await accountService.updateAccountBalance(formData.accountId, balanceChange);
      }

      let finalInvestmentId = editData?.id || initialData?.id || '';
      
      if (editData?.id) {
        await investmentService.updateInvestment(editData.id, investmentPayload);
      } else if (initialData?.id) {
        // Mode JUAL: Update record yang ada alih-alih buat baru
        await investmentService.updateInvestment(initialData.id, investmentPayload);
      } else {
        finalInvestmentId = await investmentService.createInvestment(investmentPayload);
      }

      // 3. Create Update-Tracking Transaction
      await addTransaction({
        userId, type: financeType, amount: currentInvested,
        amountIDR: convertedAmount || currentInvested,
        category: 'Investasi', subCategory: `Lainnya - ${currentType}`,
        accountId: formData.accountId || 'General',
        date: new Date(formData.dateInvested),
        note: `${editData ? '[Update]' : '[Baru]'} ${currentType} ${formData.name}`,
        status: 'VERIFIED',
        relatedId: finalInvestmentId,
        relatedType: 'investasi'
      });
      
      onClose();
      setFormData({ name: '', logoUrl: '', currency: 'IDR', quantity: '', unit: '', pricePerUnit: '', currentValue: '', transactionType: 'Pembelian', category: '', accountId: '', platform: '', assetType: 'Emas', dateInvested: new Date().toISOString().split('T')[0] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Edit Aset Investasi" : (initialData ? "Jual Aset Investasi" : "Tambah Aset Investasi")} maxWidth="max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Judul / Produk Investasi</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))}
              disabled={!!initialData}
              placeholder="Emas Antam 50gr, BTC..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Logo Produk (Opsional)</label>
            <div className={`flex items-center gap-3 ${initialData ? 'opacity-60 grayscale' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="text-slate-300" size={16} />
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={!!initialData} />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!initialData}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-[10px] font-black text-slate-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="animate-spin" size={12} /> : <ImageIcon size={12} />}
                {uploading ? '...' : (formData.logoUrl ? 'Ganti' : 'Upload Logo')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kuantitas</label>
            <input type="number" value={formData.quantity} onChange={e => setFormData(p => ({...p, quantity: e.target.value}))}
              placeholder="0" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Satuan</label>
            <input type="text" value={formData.unit} onChange={e => setFormData(p => ({...p, unit: e.target.value}))}
              disabled={!!initialData}
              placeholder="Gram, Lot, Koin..." className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{initialData ? "Harga Jual / Satuan" : "Harga Beli / Satuan"}</label>
            <input type="number" value={formData.pricePerUnit} onChange={e => setFormData(p => ({...p, pricePerUnit: e.target.value}))}
              placeholder="Rp" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all" />
          </div>
          <div>
            <CurrencySelect 
              value={formData.currency}
              onChange={(val) => setFormData({...formData, currency: val})}
              label="Mata Uang"
            />
          </div>
        </div>

        {/* Conversion Display */}
        {formData.currency !== 'IDR' && formData.quantity && formData.pricePerUnit && (
          <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <RefreshCw size={14} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Total Terkonversi (IDR)</p>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rekening / Sumber</label>
            <div className="relative">
              <select 
                value={formData.accountId}
                onChange={e => setFormData(p => ({...p, accountId: e.target.value}))}
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Platform</label>
            <input type="text" value={formData.platform} onChange={e => setFormData(p => ({...p, platform: e.target.value}))}
              disabled={!!initialData}
              placeholder="Pegadaian, Indodax, dll" className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
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
               disabled={!!initialData}
               className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all disabled:opacity-60" />
           </div>
        </div>

        {/* Tipe Transaksi & Kategori */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipe Transaksi</label>
            <div className="relative">
              <select 
                value={formData.transactionType}
                onChange={e => setFormData(p => ({...p, transactionType: e.target.value}))}
                disabled={!!initialData}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer disabled:opacity-60"
              >
                <option value="Pembelian">Pembelian (Pengeluaran)</option>
                <option value="Penjualan">Penjualan (Pemasukan)</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className={`space-y-2 ${initialData ? 'opacity-60 pointer-events-none' : ''}`}>
            <CategorySelect 
              label="Kategori Investasi"
              value={formData.category}
              type={formData.transactionType === 'Penjualan' ? 'income' : 'expense'}
              onChange={(val: string) => setFormData(p => ({...p, category: val}))}
              showBadge={false}
            />
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading || !formData.name || !formData.quantity || !formData.pricePerUnit}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-xl text-sm font-black transition-all mt-6 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Transaksi
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
