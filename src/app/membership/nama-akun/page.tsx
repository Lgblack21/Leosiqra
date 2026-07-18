"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Landmark,
  Tags,
  PiggyBank,
  PlusCircle
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Category, categoryService } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { currencyService, Currency } from '@/lib/services/currencyService';
import { subscribeUserProfile, UserProfile } from '@/lib/services/userService';
import { LedgerModal } from '@/components/modals/LedgerModal';
import { useModal } from '@/context/ModalContext';
import {
  Globe,
  Trash2,
  X
} from 'lucide-react';

export default function NamaAkunPage() {
  const { openModal, activeModal } = useModal();
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  const unsubRef = useRef<(() => void) | null>(null);
  const unsubCurRef = useRef<(() => void) | null>(null);
  const unsubProfRef = useRef<(() => void) | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined);
  const [categoryError, setCategoryError] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Ledger Categories Listener
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({
            ...doc.data(), id: doc.id
          } as Category)));
          setLoading(false);
        });

        // User Profile Listener
        if (unsubProfRef.current) unsubProfRef.current();
        unsubProfRef.current = subscribeUserProfile(u.uid, (prof) => {
          setProfile(prof);
        });

        // Currencies Listener
        if (unsubCurRef.current) unsubCurRef.current();
        unsubCurRef.current = currencyService.getUserCurrencies(u.uid, (data) => {
          setCurrencies(data);
        });

      } else { 
        setCategories([]); 
        setCurrencies([]);
        setLoading(false); 
      }
    });
    return () => { 
      unsub(); 
      if (unsubRef.current) unsubRef.current(); 
      if (unsubCurRef.current) unsubCurRef.current();
      if (unsubProfRef.current) unsubProfRef.current();
    };
  }, []);

  // Muat ulang daftar mata uang begitu modal "Tambah Mata Uang" ditutup, supaya
  // currency yang baru dipilih langsung muncul tanpa perlu reload halaman.
  const prevModalRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevModalRef.current === 'currency' && activeModal !== 'currency' && user) {
      if (unsubCurRef.current) unsubCurRef.current();
      unsubCurRef.current = currencyService.getUserCurrencies(user.uid, (data) => {
        setCurrencies(data);
      });
    }
    prevModalRef.current = activeModal;
  }, [activeModal, user]);

  useEffect(() => {
    if (user && profile && loading) {
        setLoading(false);
    }
  }, [profile, user, loading]);

  // handleAddCurrency moved to CurrencyModal.tsx

  const handleAddCategory = () => {
    setPresetCategory(undefined);
    setIsLedgerModalOpen(true);
  };

  const handleAddSubcategory = (categoryName: string) => {
    setPresetCategory(categoryName);
    setIsLedgerModalOpen(true);
  };

  const handleDeleteSubcategory = async (row: Category) => {
    if (!row.id) return;
    if (!confirm(`Hapus subkategori "${row.subCategory}" dari "${row.category}"?`)) return;
    setCategoryError('');
    setDeletingCategoryId(row.id);
    try {
      await categoryService.deleteCategory(row.id);
    } catch (e) {
      console.error(e);
      setCategoryError('Gagal menghapus subkategori. Silakan coba lagi.');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleDeleteCategoryGroup = async (categoryName: string, rows: Category[]) => {
    if (!confirm(`Hapus kategori "${categoryName}" beserta ${rows.length} subkategori di dalamnya?`)) return;
    setCategoryError('');
    try {
      for (const row of rows) {
        if (row.id) await categoryService.deleteCategory(row.id);
      }
    } catch (e) {
      console.error(e);
      setCategoryError('Gagal menghapus kategori. Sebagian subkategori mungkin masih tersisa.');
    }
  };

  const handleDeleteCurrency = async (id: string) => {
    if (confirm("Hapus mata uang ini?")) {
      await currencyService.deleteCurrency(id);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Hapus ${selectedIds.length} mata uang yang dipilih?`)) {
      setLoading(true);
      try {
        for (const id of selectedIds) {
          await currencyService.deleteCurrency(id);
        }
        setSelectedIds([]);
        setIsSelectMode(false);
        alert("Berhasil menghapus mata uang.");
      } catch (error) {
        console.error("Bulk delete failed:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === currencies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currencies.map(c => c.id || ''));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Kelompokkan tiap baris kategori (satu row = satu subkategori) berdasarkan
  // nama kategori induk, supaya nama kategori tidak berulang di tiap baris
  // dan subkategori bisa dikelola satu-satu. Backend sudah ORDER BY sort_order,
  // jadi urutan dari server ini yang jadi urutan tampil default.
  const groupedCategories = categories.reduce<Record<string, Category[]>>((acc, row) => {
    const key = row.category || '(Tanpa Nama)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  // State lokal terpisah untuk urutan tampil per grup — diselaraskan dari data
  // server tiap kali berubah, tapi diupdate optimis (instan) saat drag-drop
  // supaya urutan baru langsung kelihatan sebelum request simpan selesai.
  const [localOrder, setLocalOrder] = useState<Record<string, Category[]>>({});
  useEffect(() => {
    setLocalOrder(groupedCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const categoryGroups = Object.entries(localOrder);
  const totalSubcategories = categories.length;

  const handleReorderGroup = (categoryName: string, newRows: Category[]) => {
    setLocalOrder(prev => ({ ...prev, [categoryName]: newRows }));
    const ids = newRows.map(r => r.id).filter((id): id is string => Boolean(id));
    categoryService.reorderCategories(ids).catch(e => {
      console.error('Gagal menyimpan urutan kategori:', e);
      setCategoryError('Gagal menyimpan urutan baru. Silakan coba lagi.');
    });
  };

  // Drag-and-drop native (bukan framer-motion Reorder) — chip-nya wrap ke
  // banyak baris, dan Reorder cuma menghitung posisi di satu sumbu lurus
  // sehingga tampilannya kacau begitu ada baris yang membungkus.
  const handleChipDrop = (categoryName: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const rows = localOrder[categoryName] || [];
    const fromIndex = rows.findIndex(r => r.id === draggedId);
    const toIndex = rows.findIndex(r => r.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const newRows = [...rows];
    const [moved] = newRows.splice(fromIndex, 1);
    newRows.splice(toIndex, 0, moved);
    handleReorderGroup(categoryName, newRows);
    setDraggedId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Nama Akun Transaksi</h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-400 mt-2 max-w-xl">
            Kelola kategori, subkategori, dan mata uang di sini — daftar inilah yang muncul sebagai pilihan setiap kali Anda mencatat transaksi, budget, atau recurring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-8">

          {/* 1. Ledger Categories */}
          <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-indigo-600 rounded-full" />
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Daftar Kategori Transaksi</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sumber pilihan kategori di semua form transaksi</p>
                </div>
              </div>
              <button
                onClick={handleAddCategory}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all w-fit"
              >
                <PlusCircle size={14} /> Tambah Kategori
              </button>
            </div>

            {categoryError && (
              <div className="mx-6 md:mx-8 mt-6 bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
                {categoryError}
              </div>
            )}

            <div className="p-6 md:p-8">
              {categoryGroups.length === 0 ? (
                <EmptyState
                  title="Belum ada kategori"
                  description="Tambah kategori pertama Anda agar bisa dipilih saat mencatat transaksi, budget, atau recurring."
                  icon={<Tags size={24} />}
                />
              ) : (
                <div className="space-y-4">
                  {categoryGroups.map(([categoryName, rows]) => (
                    <div key={categoryName} className="bg-slate-50/60 border border-slate-100 rounded-2xl p-5 md:p-6">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">{categoryName}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAddSubcategory(categoryName)}
                            title="Tambah subkategori"
                            className="p-2 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors"
                          >
                            <PlusCircle size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryGroup(categoryName, rows)}
                            title="Hapus seluruh kategori"
                            className="p-2 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rows.map((row) => (
                          <span
                            key={row.id}
                            draggable
                            onDragStart={() => row.id && setDraggedId(row.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => row.id && handleChipDrop(categoryName, row.id)}
                            onDragEnd={() => setDraggedId(null)}
                            className={cn(
                              "inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 cursor-grab active:cursor-grabbing transition-opacity",
                              draggedId === row.id && "opacity-40"
                            )}
                          >
                            {row.subCategory}
                            <button
                              onClick={() => handleDeleteSubcategory(row)}
                              disabled={deletingCategoryId === row.id}
                              title="Hapus subkategori ini"
                              className="p-1 rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-50"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Currency Categories Card */}
          <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 bg-indigo-50/20">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Kategori Mata Uang Dunia</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sistem Dinamis Terintegrasi</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isSelectMode ? (
                  <>
                    <button
                      onClick={() => openModal('currency')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                    >
                      <PlusCircle size={14} /> Tambah Mata Uang
                    </button>
                    <button
                      onClick={() => setIsSelectMode(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                    >
                      Pilih
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                    <button 
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      <input 
                        type="checkbox" 
                        readOnly
                        checked={selectedIds.length === currencies.length && currencies.length > 0}
                        className="w-3 h-3 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Pilih Semua
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      disabled={selectedIds.length === 0}
                      className="p-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Hapus Terpilih"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedIds([]);
                      }}
                      className="p-2 bg-slate-50 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all"
                      title="Batal"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currencies.map((curr) => (
                  <div 
                    key={curr.id} 
                    onClick={() => isSelectMode && curr.id && toggleSelect(curr.id)}
                    className={`relative group p-5 rounded-2xl border transition-all flex flex-col gap-3 cursor-pointer ${
                      isSelectMode 
                        ? (selectedIds.includes(curr.id || '') 
                            ? 'bg-indigo-50 border-indigo-200' 
                            : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm')
                        : 'bg-slate-50 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-500 font-bold text-lg">
                        {curr.symbol}
                      </div>

                      {isSelectMode ? (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedIds.includes(curr.id || '')
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-white border-slate-300'
                        }`}>
                          {selectedIds.includes(curr.id || '') && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (curr.id) {
                              void handleDeleteCurrency(curr.id);
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{curr.name}</p>
                      <h4 className="text-xl font-black text-slate-900">{curr.code}</h4>
                    </div>
                    {Boolean(curr.isDefault) && (
                      <span className="absolute bottom-4 right-4 text-[7px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">Default</span>
                    )}
                  </div>
                ))}

                {currencies.length === 0 && (
                  <div className="col-span-full py-12 text-center">
                    <EmptyState 
                      title="Mata uang belum diatur"
                      description="Simpan daftar mata uang Anda untuk digunakan di seluruh aplikasi."
                      icon={<Globe size={24} />}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Local modal removed - now using global CurrencyModal via openModal('currency') */}

      </div>

      {/* BOTTOM SECTION - 3 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#f0f5f7] p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-white flex items-center gap-5 shadow-sm">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Kategori</p>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{categoryGroups.length} Kategori</p>
          </div>
        </div>
        <div className="bg-[#f0f5f7] p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-white flex items-center gap-5 shadow-sm">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-400 shrink-0">
            <Tags size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Subkategori</p>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{totalSubcategories} Subkategori</p>
          </div>
        </div>
        <div className="bg-[#555555] p-5 md:p-8 rounded-[20px] md:rounded-[28px] flex items-center gap-5 shadow-xl shadow-slate-200">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white/60 shrink-0">
            <PiggyBank size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Mata Uang Tersimpan</p>
            <p className="text-lg md:text-xl font-black text-white tracking-tight">{currencies.length} Mata Uang</p>
          </div>
        </div>
      </div>

      {user && (
        <LedgerModal
          userId={user.uid}
          isOpen={isLedgerModalOpen}
          onClose={() => { setIsLedgerModalOpen(false); setPresetCategory(undefined); }}
          presetCategory={presetCategory}
        />
      )}
    </div>
  );
}

