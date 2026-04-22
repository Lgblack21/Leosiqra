"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { db } from '@/lib/cf-client';

interface BudgetModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetModal = ({ userId, isOpen, onClose }: BudgetModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'pengeluaran' as Budget['type'],
    category: '',
    amount: '',
    period: 'monthly' as Budget['period']
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || !isOpen) return;
    const q = query(collection(db, 'categories'), where('userId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      const names = snap.docs.map(doc => doc.data().category as string);
      const uniqueNames = Array.from(new Set(names));
      setAvailableCategories(uniqueNames);
    });
    return () => unsub();
  }, [userId, isOpen]);

  const handleCreate = async () => {
    if (!userId || !formData.category || !formData.amount) return;
    setLoading(true);
    try {
      await budgetService.createBudget({
        userId,
        type: formData.type,
        category: formData.category,
        amount: parseFloat(formData.amount),
        period: formData.period
      });
      onClose();
      setFormData({ type: 'pengeluaran', category: '', amount: '', period: 'monthly' });
    } catch (error) {
      console.error("Error creating budget:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Set Budget Limit Baru"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipe</label>
            <div className="relative">
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as Budget['type']})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-6 text-sm font-bold text-slate-700 transition-all cursor-pointer capitalize"
              >
                <option value="pengeluaran">Pengeluaran</option>
                <option value="pemasukan">Pemasukan</option>
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kategori Budget</label>
            <div className="relative">
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-6 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="">Pilih Kategori</option>
                {availableCategories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal Limit</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input 
                type="number" 
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0"
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 pl-14 pr-6 text-sm font-bold text-slate-700 transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Periode</label>
            <div className="relative">
              <select 
                value={formData.period}
                onChange={(e) => setFormData({...formData, period: e.target.value as 'monthly' | 'yearly'})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-6 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading || !formData.category || !formData.amount}
          className="w-full bg-indigo-600 disabled:bg-slate-300 flex items-center justify-center gap-3 py-4 rounded-xl text-sm font-black text-white transition-all shadow-xl shadow-indigo-100 mt-6"
        >
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Budget
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

