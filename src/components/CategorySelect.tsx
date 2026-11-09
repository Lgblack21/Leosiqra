'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { db, auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { categoryVisual, useCategoryKinds, useCategoryStyles } from '@/lib/categoryEmoji';

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
  /** Sub-kategori terpilih, ditampilkan di tombol (mis. hasil isi otomatis). */
  subValue?: string;
  /** Versi ringkas (form catat transaksi). */
  size?: 'md' | 'sm';
}

export const CategorySelect = ({
  label,
  value,
  type,
  onChange,
  onSubCategoryChange,
  showBadge = true,
  subValue,
  size = 'md',
}: CategorySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // auth.currentUser baru terisi setelah /api/auth/me selesai — saat halaman baru dibuka
    // komponen ini bisa mount lebih dulu dan daftarnya kosong selamanya. Tunggu user dulu.
    let unsub: (() => void) | undefined;
    let alive = true;
    const start = (uid: string) => {
      if (!alive || unsub) return;
      const q = query(collection(db, 'categories'), where('userId', '==', uid));
      unsub = onSnapshot(
        q,
        (snap) => {
          setCategories(
            snap.docs.map(
              (doc) =>
                ({
                  id: doc.id,
                  ...doc.data(),
                }) as CategoryData,
            ),
          );
        },
        (err) => {
          if (err.code !== 'permission-denied') {
            console.warn('[CategorySelect] Error listening to categories:', err);
          }
        },
      );
    };
    if (auth.currentUser) start(auth.currentUser.uid);
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) start(user.uid);
    });
    return () => {
      alive = false;
      unsubAuth();
      unsub?.();
    };
  }, []);

  // Satu entri per nama kategori. Kategori yang jenisnya tersimpan berlawanan
  // (mis. Gaji saat mencatat pengeluaran) disembunyikan; yang belum punya
  // jenis atau sedang terpilih tetap tampil.
  const kinds = useCategoryKinds();
  useCategoryStyles(); // gambar ulang saat ikon kategori pilihan user dimuat
  const wantKind = type === 'income' ? 'pemasukan' : 'pengeluaran';
  const uniqueMainCategories = Array.from(new Map(categories.map((c) => [c.category, c])).values()).filter(
    (c) => c.category === value || !kinds[c.category] || kinds[c.category] === wantKind,
  );

  // Sub-kategori bisa berasal dari beberapa baris kategori dengan nama yang sama,
  // atau (data lama) satu baris dengan sub-kategori digabung tanda koma. Kumpulkan
  // semua opsi unik supaya user bisa MEMILIH satu, bukan menerima gabungan mentah.
  const getSubCategoryOptions = (categoryName: string) => {
    const options = categories
      .filter((c) => c.category === categoryName)
      .flatMap((c) => c.subCategory.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(options));
  };

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // `value` menyimpan NAMA kategori (bukan id) agar konsisten dengan data yang
  // dikirim ke transaksi/laporan lain, yang membandingkan berdasarkan nama.
  const selectedCategory = categories.find((c) => c.category === value);

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
    <div className={cn('flex-1', size === 'sm' ? 'space-y-1.5' : 'space-y-2')} ref={containerRef}>
      <label
        className={
          size === 'sm'
            ? 'block fs-12 font-semibold text-slate-500'
            : 'fs-10 font-black text-slate-400 uppercase tracking-widest pl-1'
        }
      >
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            setExpandedCategory(null);
          }}
          className={cn(
            'w-full bg-slate-50 border border-slate-200 text-slate-900 flex items-center justify-between transition-all hover:border-slate-300',
            size === 'sm' ? 'rounded-xl bg-white px-3.5 py-2.5' : 'rounded-2xl px-5 py-4',
            isOpen && 'border-indigo-600 bg-white ring-4 ring-indigo-500/5 shadow-lg',
          )}
        >
          <span
            className={cn(
              'min-w-0 truncate font-bold',
              size === 'sm' ? 'fs-13.5 font-semibold' : 'text-sm',
              !selectedCategory && 'text-slate-400',
            )}
          >
            {size === 'sm' && selectedCategory ? (
              <span className="mr-1.5">{categoryVisual(selectedCategory.category, wantKind).emoji}</span>
            ) : null}
            {selectedCategory ? selectedCategory.category : size === 'sm' ? 'Pilih' : 'Pilih Kategori'}
            {selectedCategory && subValue && subValue !== selectedCategory.category && (
              <span className="font-medium text-slate-400"> · {subValue}</span>
            )}
          </span>
          <ChevronDown
            size={size === 'sm' ? 16 : 18}
            className={cn(
              'shrink-0 text-slate-400 transition-transform duration-300',
              isOpen && 'rotate-180 text-indigo-600',
            )}
          />
        </button>

        {isOpen && size === 'sm' && (
          <div className="mt-1.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="custom-scrollbar max-h-64 overflow-y-auto">
              {expandedCategory ? (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedCategory(null)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left fs-12.5 font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronDown size={14} className="rotate-90 text-slate-400" />
                    <span className="text-base leading-none">{categoryVisual(expandedCategory, wantKind).emoji}</span>
                    {expandedCategory}
                  </button>
                  <div className="my-1 h-px bg-slate-100" />
                  {getSubCategoryOptions(expandedCategory).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => handleSelectSubCategory(expandedCategory, sub)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl py-2 pl-9 pr-2.5 text-left fs-13 transition-colors',
                        value === expandedCategory && subValue === sub
                          ? 'bg-slate-900 font-semibold text-white'
                          : 'font-medium text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {sub}
                      {value === expandedCategory && subValue === sub && <Check size={14} />}
                    </button>
                  ))}
                </>
              ) : uniqueMainCategories.length === 0 ? (
                <p className="px-3 py-4 text-center fs-12.5 text-slate-400">Belum ada kategori.</p>
              ) : (
                uniqueMainCategories.map((cat) => {
                  const subOptions = getSubCategoryOptions(cat.category);
                  const vis = categoryVisual(cat.category, wantKind);
                  const active = value === cat.category;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors',
                        active ? 'bg-slate-100' : 'hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg fs-16', vis.tile)}
                      >
                        {vis.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate fs-13 font-semibold text-slate-800">{cat.category}</span>
                        {subOptions.length > 0 && (
                          <span className="block truncate fs-11 text-slate-400">
                            {subOptions.length === 1 ? subOptions[0] : `${subOptions.length} sub kategori`}
                          </span>
                        )}
                      </span>
                      {subOptions.length > 1 ? (
                        <ChevronDown size={15} className="-rotate-90 shrink-0 text-slate-300" />
                      ) : active ? (
                        <Check size={15} className="shrink-0 text-slate-900" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {isOpen && size !== 'sm' && (
          <div className="absolute top-full left-0 w-full mt-3 p-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {expandedCategory ? (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedCategory(null)}
                    className="w-full flex items-center gap-2 px-4 py-2 fs-10 font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    <ChevronDown size={12} className="rotate-90" /> Kembali
                  </button>
                  <p className="px-4 pt-1 pb-2 fs-10 font-black text-slate-400 uppercase tracking-widest">
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
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left group',
                        value === cat.category
                          ? 'bg-indigo-50 text-indigo-600 font-black'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium',
                      )}
                    >
                      <div>
                        <p className="font-bold">{cat.category}</p>
                        {subOptions.length === 1 && <p className="fs-10 text-slate-400 mt-0.5">{subOptions[0]}</p>}
                        {subOptions.length > 1 && (
                          <p className="fs-10 text-slate-400 mt-0.5">{subOptions.length} sub kategori</p>
                        )}
                      </div>
                      {subOptions.length > 1 ? (
                        <ChevronDown
                          size={16}
                          className="-rotate-90 text-slate-300 group-hover:text-indigo-600 shrink-0"
                        />
                      ) : (
                        value === cat.category && <Check size={16} className="text-indigo-600 shrink-0" />
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
          <span
            className={cn(
              'px-3 py-1 rounded-full fs-10 font-black uppercase tracking-widest',
              type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
            )}
          >
            {type}
          </span>
        </div>
      )}
    </div>
  );
};
