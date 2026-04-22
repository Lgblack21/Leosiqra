"use client";

import { useState } from 'react';
import { ChevronDown, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { accountService } from '@/lib/services/accountService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { useRef } from 'react';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const CardModal = ({ isOpen, onClose, userId }: CardModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Credit Card',
    logoUrl: '',
    currency: 'IDR',
    initialBalance: '', 
    baseValue: ''
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

  const handleCreate = async () => {
    if (!userId || !formData.name) return;
    setLoading(true);
    try {
      const initialBal = parseFloat(formData.initialBalance) || 0;
      const isCard = formData.type === 'Credit Card' || formData.type === 'kartu';
      await accountService.createAccount({
        userId: userId,
        name: formData.name,
        type: formData.type,
        logoUrl: formData.logoUrl,
        currency: formData.currency,
        initialBalance: initialBal,
        balance: isCard ? 0 : initialBal, // Cards start with 0 bill/balance, others start with initialBal
        baseValue: parseFloat(formData.baseValue) || 0
      });
      setFormData({ name: '', type: 'Credit Card', logoUrl: '', currency: 'IDR', initialBalance: '', baseValue: '' });
      onClose();
    } catch (error) {
      console.error("Error creating card/account:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Tambah Kartu Baru"
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nama Rekening */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Rekening</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Contoh: BCA Platinum"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-rose-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
            />
          </div>

          {/* Jenis Rekening - SELECT DROPDOWN */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis Rekening</label>
            <div className="relative">
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-rose-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="Bank Account">Bank Account</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Cash">Cash</option>
                <option value="Investment Account">Investment Account</option>
                <option value="Credit Card">Credit Card</option>
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="col-span-full space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Logo Kartu</label>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="text-slate-300" size={20} />
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-4 px-4 text-xs font-bold text-slate-600 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} />
                    {formData.logoUrl ? 'Ganti Logo' : 'Upload Logo'}
                  </>
                )}
              </button>
            </div>
          </div>

          <CurrencySelect 
            label="Mata Uang"
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
          />

          {/* Saldo Sekarang / Awal */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-emerald-500">Saldo Sekarang</label>
            <input 
              type="number" 
              value={formData.initialBalance}
              onChange={(e) => setFormData({...formData, initialBalance: e.target.value})}
              placeholder="0"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
            />
          </div>

          {/* Nilai Base */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-blue-500">Nilai Base</label>
            <input 
              type="number" 
              value={formData.baseValue}
              onChange={(e) => setFormData({...formData, baseValue: e.target.value})}
              placeholder="0"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
            />
          </div>
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading || !formData.name}
          className="w-full bg-rose-600 disabled:bg-slate-300 text-white px-6 py-4 rounded-xl text-xs font-black shadow-lg shadow-rose-100 disabled:shadow-none transition-all mt-6 flex items-center justify-center gap-2"
        >
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={16} />
              Simpan Kartu Baru
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
