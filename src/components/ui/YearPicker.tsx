"use client";

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface YearPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const YearPicker = ({ value, onChange, className }: YearPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-2.5 border border-slate-100 transition-all cursor-pointer relative overflow-hidden group min-w-[140px]"
      >
        <Calendar size={14} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
        <span className="text-xs font-black text-slate-700">Tahun {value}</span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ml-auto ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 p-3 bg-white border border-slate-100 rounded-[20px] shadow-2xl z-[100] min-w-[240px]"
          >
            <div className="grid grid-cols-3 gap-2">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => {
                    onChange(y);
                    setIsOpen(false);
                  }}
                  className={`py-3 px-2 rounded-xl text-[11px] font-black transition-all ${
                    value === y 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105' 
                    : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
