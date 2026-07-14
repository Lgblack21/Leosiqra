"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { db, auth } from '@/lib/cf-client';

interface CategoryData {
  id: string;
  category: string;
  subCategory: string;
}

interface CategorySelectProps {
  label: string;
  value: string;
  type: 'income' | 'expense';
  onChange: (categoryId: string) => void;
  onSubCategoryChange?: (subCategory: string) => void;
  showBadge?: boolean;
}

export const CategorySelect = ({ label, value, type, onChange, onSubCategoryChange, showBadge = true }: CategorySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, 
      (snap) => {
        setCategories(snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CategoryData)));
      },
      (err) => {
        if (err.code !== 'permission-denied') {
          console.warn("[CategorySelect] Error listening to categories:", err);
        }
      }
    );

    return () => unsub();
  }, []);

  // Group categories by main category name - show unique main category names
  const uniqueMainCategories = Array.from(
    new Map(categories.map(c => [c.category, c])).values()
  );

  // Sub-kategori bisa berasal dari beberapa baris kategori dengan nama yang sama,
  // atau (data lama) satu baris dengan sub-kategori digabung tanda koma. Kumpulkan
  // semua opsi unik supaya user bisa MEMILIH satu, bukan menerima gabungan mentah.
  const getSubCategoryOptions = (categoryName: string) => {
    const options = categories
      .filter(c => c.category === categoryName)
      .flatMap(c => c.subCategory.split(','))
      .map(s => s.trim())
      .filter(Boolean);
    return Array.from(new Set(options));
  };

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // `value` menyimpan NAMA kategori (bukan id) agar konsisten dengan data yang
  // dikirim ke transaksi/laporan lain, yang membandingkan berdasarkan nama.
  const selectedCategory = categories.find(c => c.category === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCategory = (cat: CategoryData) => {
    const subOptions = getSubCategoryOptions(cat.category);
    if (subOptions.length > 1) {
      // Ada lebih dari satu sub-kategori: minta user memilih salah satu dulu.
      setExpandedCategory(cat.category);
      return;
    }
    onChange(cat.category);
    if (onSubCategoryChange) {
      onSubCategoryChange(subOptions[0] ?? cat.subCategory.trim());
    }
    setIsOpen(false);
    setExpandedCategory(null);
  };

  const handleSelectSubCategory = (categoryName: string, subCategory: string) => {
    onChange(categoryName);
    if (onSubCategoryChange) {
      onSubCategoryChange(subCategory);
    }
    setIsOpen(false);
    setExpandedCategory(null);
  };

  return (
    <div className="flex-1 space-y-2" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            setExpandedCategory(null);
          }}
          className={cn(
            "w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 flex items-center justify-between transition-all hover:border-slate-300",
            isOpen && "border-indigo-600 bg-white ring-4 ring-indigo-500/5 shadow-lg"
          )}
        >
          <span className={cn("text-sm font-bold", !selectedCategory && "text-slate-400")}>
            {selectedCategory ? selectedCategory.category : 'Pilih Kategori'}
          </span>
          <ChevronDown 
            size={18} 
            className={cn("text-slate-400 transition-transform duration-300", isOpen && "rotate-180 text-indigo-600")} 
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-3 p-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {expandedCategory ? (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedCategory(null)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    <ChevronDown size={12} className="rotate-90" /> Kembali
                  </button>
                  <p className="px-4 pt-1 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {expandedCategory} — pilih sub kategori
                  </p>
                  {getSubCategoryOptions(expandedCategory).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => handleSelectSubCategory(expandedCategory, sub)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                    >
                      {sub}
                    </button>
                  ))}
                </>
              ) : (
                uniqueMainCategories.map((cat) => {
                  const subOptions = getSubCategoryOptions(cat.category);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left group",
                        value === cat.category
                          ? "bg-indigo-50 text-indigo-600 font-black"
                          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                      )}
                    >
                      <div>
                        <p className="font-bold">{cat.category}</p>
                        {subOptions.length === 1 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{subOptions[0]}</p>
                        )}
                        {subOptions.length > 1 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{subOptions.length} sub kategori</p>
                        )}
                      </div>
                      {subOptions.length > 1 ? (
                        <ChevronDown size={16} className="-rotate-90 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                      ) : value === cat.category && (
                        <Check size={16} className="text-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {showBadge && (
        <div className="flex gap-2 p-1">
          <span className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
            type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {type}
          </span>
        </div>
      )}
    </div>
  );
};

