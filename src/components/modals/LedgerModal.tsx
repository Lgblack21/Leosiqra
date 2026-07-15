"use client";

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { categoryService } from '@/lib/services/categoryService';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  presetCategory?: string;
}

export const LedgerModal = ({ isOpen, onClose, userId, presetCategory }: LedgerModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    category: presetCategory || '',
    subCategory: '',
  });

  useEffect(() => {
    if (isOpen) {
      setError('');
      setFormData({ category: presetCategory || '', subCategory: '' });
    }
  }, [isOpen, presetCategory]);

  const handleCreate = async () => {
    if (!userId || !formData.category || !formData.subCategory) return;
    setError('');
    setLoading(true);
    try {
      // Boleh isi beberapa sub kategori sekaligus dipisah koma — masing-masing
      // disimpan sebagai baris kategori terpisah, bukan digabung jadi satu
      // string panjang (yang membuat sub kategori tidak bisa dipilih satu-satu).
      const subCategories = formData.subCategory
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const subCategory of subCategories) {
        await categoryService.createCategory({
          userId: userId,
          category: formData.category,
          subCategory,
          status: 'VERIFIED'
        });
      }
      onClose();
      setFormData({ category: '', subCategory: '' });
    } catch (error) {
      console.error("Error creating category:", error);
      setError(error instanceof Error ? error.message : 'Gagal menyimpan kategori. Sebagian mungkin sudah tersimpan — periksa daftar kategori lalu coba lagi untuk sisanya.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={presetCategory ? `Tambah Subkategori — ${presetCategory}` : 'Konfigurasi Ledger Baru'}
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kategori Utama</label>
          <input
            type="text"
            value={formData.category}
            disabled={Boolean(presetCategory)}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            placeholder="Contoh: Kebutuhan Hiburan"
            className="w-full bg-[#e9f0f4] border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-4 px-5 text-sm font-bold text-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subkategori Spesifik</label>
          <p className="text-[10px] text-slate-400 pl-1">Bisa isi lebih dari satu, pisahkan dengan koma.</p>
          <input
            type="text"
            value={formData.subCategory}
            onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
            placeholder="Contoh: Bensin Kendaraan, Parkir, Tol"
            className="w-full bg-[#e9f0f4] border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-4 px-5 text-sm font-bold text-slate-700 transition-all"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={loading || !formData.category || !formData.subCategory}
          className="w-full bg-slate-900 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-black transition-all mt-6 shadow-xl shadow-slate-200"
        >
          <Save size={16} />
          {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </div>
    </Modal>
  );
};

