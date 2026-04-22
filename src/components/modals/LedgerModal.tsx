"use client";

import { useState } from 'react';
import { Save, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { categoryService } from '@/lib/services/categoryService';
import { auth } from '@/lib/firebase';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const LedgerModal = ({ isOpen, onClose, userId }: LedgerModalProps) => {
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
  });

  const handleCreate = async () => {
    if (!userId || !formData.category || !formData.subCategory) return;
    try {
      await categoryService.createCategory({
        userId: userId,
        category: formData.category,
        subCategory: formData.subCategory,
        status: 'VERIFIED'
      });
      onClose();
      setFormData({ category: '', subCategory: '' });
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Konfigurasi Ledger Baru"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kategori Utama</label>
          <input 
            type="text" 
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            placeholder="Contoh: Kebutuhan Hiburan"
            className="w-full bg-[#e9f0f4] border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-4 px-5 text-sm font-bold text-slate-700 transition-all"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subkategori Spesifik</label>
          <input 
            type="text" 
            value={formData.subCategory}
            onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
            placeholder="Contoh: Bensin Kendaraan"
            className="w-full bg-[#e9f0f4] border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-4 px-5 text-sm font-bold text-slate-700 transition-all"
          />
        </div>
        <button 
          onClick={handleCreate}
          disabled={!formData.category || !formData.subCategory}
          className="w-full bg-slate-900 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-black transition-all mt-6 shadow-xl shadow-slate-200"
        >
          <Save size={16} />
          Simpan Konfigurasi
        </button>
      </div>
    </Modal>
  );
};
