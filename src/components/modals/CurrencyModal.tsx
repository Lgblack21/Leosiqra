"use client";

import { useState, useEffect } from 'react';
import { currencyService } from '@/lib/services/currencyService';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Modal } from '@/components/ui/Modal';

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CurrencyModal = ({ isOpen, onClose }: CurrencyModalProps) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: ''
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!user || !formData.code || !formData.name) return;
    setLoading(true);
    try {
      await currencyService.addCurrency({
        userId: user.uid,
        code: formData.code.toUpperCase(),
        name: formData.name,
        symbol: formData.symbol || '$'
      });
      onClose();
      setFormData({ code: '', name: '', symbol: '' });
    } catch (error) {
      console.error("Add currency error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Tambah Mata Uang Dunia"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kode (ISO)</label>
            <input 
              type="text" 
              maxLength={3}
              placeholder="IDR"
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value})}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Simbol</label>
            <input 
              type="text" 
              placeholder="Rp"
              value={formData.symbol}
              onChange={(e) => setFormData({...formData, symbol: e.target.value})}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Lengkap</label>
          <input 
            type="text" 
            placeholder="Indonesian Rupiah"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
          />
        </div>
        <button 
          onClick={handleSubmit}
          disabled={loading || !formData.code || !formData.name}
          className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? 'Menyimpan...' : 'Simpan Mata Uang'}
        </button>
      </div>
    </Modal>
  );
};
