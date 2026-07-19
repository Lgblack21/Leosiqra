"use client";

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: Date;
  onChange: (value: Date) => void;
  className?: string;
}

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Dropdown kalender kustom (bukan <input type="date"> native) — gaya sama
// dengan MonthPicker/YearPicker, supaya tampilannya konsisten dengan desain
// aplikasi alih-alih kalender bawaan OS/browser.
export const DatePicker = ({ value, onChange, className }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!isOpen) {
      setViewMonth(value.getMonth());
      setViewYear(value.getFullYear());
    }
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
    onChange(new Date());
    setIsOpen(false);
  };

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  const selectDay = (day: number, month: number, year: number) => {
    onChange(new Date(year, month, day));
    setIsOpen(false);
  };

  // Grid 6 minggu (42 sel): tanggal bulan sebelum/sesudah ditampilkan pudar,
  // tetap bisa diklik untuk pindah bulan sekaligus pilih tanggalnya.
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; month: number; year: number; inCurrentMonth: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    const d = new Date(viewYear, viewMonth - 1, day);
    cells.push({ day, month: d.getMonth(), year: d.getFullYear(), inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, month: viewMonth, year: viewYear, inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const idx = cells.length - (firstWeekday + daysInMonth);
    const d = new Date(viewYear, viewMonth + 1, idx + 1);
    cells.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), inCurrentMonth: false });
    if (cells.length >= 42) break;
  }

  const today = new Date();

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-2.5 border border-slate-100 transition-all cursor-pointer relative overflow-hidden group w-full"
      >
        <Calendar size={14} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
        <span className="text-xs font-black text-slate-700">
          {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(value)}
        </span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ml-auto ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 p-3 bg-white border border-slate-100 rounded-[20px] shadow-2xl z-[100] min-w-[280px]"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-slate-900">
                {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth))}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map(w => (
                <span key={w} className="text-center text-[9px] font-black text-slate-400 uppercase py-1">{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                const cellDate = new Date(c.year, c.month, c.day);
                const isSelected = isSameDay(cellDate, value);
                const isToday = isSameDay(cellDate, today);
                return (
                  <button
                    key={i}
                    onClick={() => selectDay(c.day, c.month, c.year)}
                    className={cn(
                      'py-2 rounded-lg text-[11px] font-bold transition-all',
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 font-black'
                        : c.inCurrentMonth
                          ? 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                          : 'text-slate-300 hover:bg-slate-50',
                      isToday && !isSelected && 'ring-1 ring-inset ring-indigo-300'
                    )}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToToday}
              className="w-full mt-3 py-2 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-colors uppercase tracking-widest"
            >
              Hari Ini
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
