"use client";

import { useState, useEffect } from 'react';
import { 
  Landmark,
  TrendingDown,
  PiggyBank,
  FolderOpen
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { categoryService, Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useRef } from 'react';
import { currencyService, Currency } from '@/lib/services/currencyService';
import { subscribeUserProfile, updateUserProfile, UserProfile } from '@/lib/services/userService';
import { 
  Globe, 
  Plus, 
  Trash2, 
  FileUp, 
  X,
  CreditCard,
  Coins
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useModal } from '@/context/ModalContext';

export default function NamaAkunPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const { openModal } = useModal();
  
  // Modal states (keep only what's necessary, move currency to global)

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubCurRef = useRef<(() => void) | null>(null);
  const unsubProfRef = useRef<(() => void) | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (user && profile && loading) {
        setLoading(false);
    }
  }, [profile, user, loading]);

  // handleAddCurrency moved to CurrencyModal.tsx

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

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n');
      
      for (const line of lines) {
        const [code, name, symbol] = line.split(',').map(s => s.trim());
        if (code && name) {
          await currencyService.addCurrency({
            userId: user.uid,
            code: code.toUpperCase(),
            name,
            symbol: symbol || '$'
          });
        }
      }
      alert("Impor berhasil!");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Nama Akun Transaksi</h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-400 mt-2 max-w-xl">
            Konfigurasi kategori dan subkategori ledger untuk pelaporan keuangan yang lebih terperinci.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN (1/4) */}
        <div className="space-y-6">
          {/* Wawasan Mingguan Banner */}
          <div className="relative h-[240px] rounded-[20px] md:rounded-[32px] overflow-hidden group shadow-xl shadow-blue-50">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
              style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1611974714658-403482794406?q=80&w=600&auto=format&fit=crop")' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-lg font-black text-white">Wawasan Mingguan</h3>
              <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest leading-relaxed">Analisis otomatis siap untuk diperiksa.</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (3/4) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* 1. Ledger Categories */}
          <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-50 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-indigo-600 rounded-full" />
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Daftar Kategori / Subkategori Ledger</h2>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[600px] md:min-w-0">
                <thead className="bg-[#e9eff2]">
                  <tr>
                    <th className="px-5 md:px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kategori</th>
                    <th className="px-5 md:px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Subkategori</th>
                    <th className="px-5 md:px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {categories.length === 0 ? (
                    <tr><td colSpan={3} className="p-10 text-center text-sm text-slate-400 font-bold">Data ledger kosong</td></tr>
                  ) : categories.map((row) => (
                    <tr key={row.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 md:px-10 py-5">
                        <p className="text-sm font-black text-slate-900">{row.category}</p>
                      </td>
                      <td className="px-5 md:px-10 py-5">
                        <p className="text-sm font-bold text-slate-500 italic font-serif tracking-tight">{row.subCategory}</p>
                      </td>
                      <td className="px-5 md:px-10 py-5 text-right">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black tracking-widest uppercase ${
                          row.status === 'VERIFIED' ? 'bg-blue-50 text-blue-500' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {row.status === 'VERIFIED' ? 'Terverifikasi' : 'Tertunda'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <input 
                      type="file" 
                      id="csv-import" 
                      className="hidden" 
                      accept=".csv"
                      onChange={handleCSVImport}
                    />
                    <label 
                      htmlFor="csv-import"
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <FileUp size={14} /> Import CSV
                    </label>
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
                            curr.id && handleDeleteCurrency(curr.id);
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
                    {curr.isDefault && (
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
            < Landmark size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Ledger</p>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{categories.length} Akun</p>
          </div>
        </div>
        <div className="bg-[#f0f5f7] p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-white flex items-center gap-5 shadow-sm">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-rose-400 shrink-0">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pengeluaran Tersinkron</p>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Rp 0</p>
          </div>
        </div>
        <div className="bg-[#555555] p-5 md:p-8 rounded-[20px] md:rounded-[28px] flex items-center gap-5 shadow-xl shadow-slate-200">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white/60 shrink-0">
            <PiggyBank size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Penggunaan Akun</p>
            <p className="text-lg md:text-xl font-black text-white tracking-tight">System Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
