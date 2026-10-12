"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Chip filter yang membuka panel kecil (popover) dengan animasi halus.
// Klik di luar / Escape menutup. Latar halaman sedikit meredup saat terbuka.
export function FilterPopover({
  label,
  icon,
  active,
  title,
  children,
  align = 'left',
  width = 300,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  title: string;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
          active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
        )}
      >
        {icon}
        {label}
        <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label={title}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{ width, transformOrigin: align === 'left' ? 'top left' : 'top right' }}
              className={cn('absolute top-full z-50 mt-2 max-h-[60vh] overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-slate-100', align === 'left' ? 'left-0' : 'right-0')}
            >
              <p className="px-4 pb-1 pt-3.5 text-sm font-bold text-slate-900">{title}</p>
              <div className="max-h-[calc(60vh-44px)] overflow-y-auto px-2 pb-2">{children(() => setOpen(false))}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Baris pilihan di dalam popover: lingkaran centang (multi) atau radio (tunggal).
export function OptionRow({ selected, onClick, children, kind = 'check' }: { selected: boolean; onClick: () => void; children: React.ReactNode; kind?: 'check' | 'radio' }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
          selected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
        )}
      >
        <motion.span
          initial={false}
          animate={{ scale: selected ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
          className={cn('block rounded-full bg-white', kind === 'radio' ? 'h-2 w-2' : 'h-1.5 w-1.5')}
        />
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
