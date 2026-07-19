"use client";

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  className?: string;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(2000, i, 1))
);

// Dropdown kustom (bukan <input type="month"> native) supaya tampilannya konsisten
// dengan desain aplikasi, bukan kalender bawaan OS/browser — lihat juga YearPicker
// yang dipakai sebagai referensi gaya.
export const MonthPicker = ({ value, onChange, className }: MonthPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(value.year);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!isOpen) setDisplayYear(value.year);
    setIsOpen(o => !o);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToToday = () => {
    const today = new Date();
    onChange({ month: today.getMonth(), year: today.getFullYear() });
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-2.5 border border-slate-100 transition-all cursor-pointer relative overflow-hidden group w-full"
      >
        <Calendar size={14} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
        <span className="text-xs font-black text-slate-700">
          {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(value.year, value.month))}
        </span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ml-auto ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 p-3 bg-white border border-slate-100 rounded-[20px] shadow-2xl z-[100] min-w-[260px]"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                onClick={() => setDisplayYear(y => y - 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-slate-900">{displayYear}</span>
              <button
                onClick={() => setDisplayYear(y => y + 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MONTH_LABELS.map((label, m) => {
                const isSelected = value.month === m && value.year === displayYear;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      onChange({ month: m, year: displayYear });
                      setIsOpen(false);
                    }}
                    className={`py-3 px-2 rounded-xl text-[11px] font-black capitalize transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105'
                        : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToToday}
              className="w-full mt-3 py-2 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-colors uppercase tracking-widest"
            >
              Bulan Ini
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
