"use client";

import { Calendar } from 'lucide-react';
import { useRef } from 'react';

interface MonthPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  className?: string;
}

export const MonthPicker = ({ value, onChange, className }: MonthPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // value.month is 0-11
  // We use a mid-month date to avoid timezone/edge case issues when selecting
  const dateStr = `${value.year}-${(value.month + 1).toString().padStart(2, '0')}-01`;

  const handleClick = () => {
    // Modern browsers allow calling showPicker() to open the native calendar
    const input = inputRef.current as any;
    if (!input) return;

    try {
      if ('showPicker' in input) {
        (input as any).showPicker();
      } else {
        input.click();
      }
    } catch (e) {
      input.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value; // YYYY-MM-DD
    if (!newVal) return;
    const [y, m] = newVal.split('-').map(Number);
    onChange({ month: m - 1, year: y });
  };

  return (
    <div className={`relative ${className}`}>
      <button 
        onClick={handleClick}
        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-2.5 border border-slate-100 transition-all cursor-pointer relative overflow-hidden group w-full"
      >
        <Calendar size={14} className="text-slate-500 group-hover:text-indigo-600 transition-colors pointer-events-none" />
        <span className="text-xs font-black text-slate-700 pointer-events-none">
          {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(value.year, value.month))}
        </span>
        <input 
          ref={inputRef}
          type="date" 
          value={dateStr}
          onChange={handleChange}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
        />
      </button>
    </div>
  );
};
