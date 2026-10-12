"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Maximize2, RotateCcw, X } from 'lucide-react';
import { AiChat } from '@/components/ai/AiChat';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Tanya Leo sebagai popup (dibuka dari kolom Tanya Leo di Ringkasan & pill di
// sidebar) — user tetap di halaman yang sama. Riwayat chat sama dengan
// halaman AI penuh (disimpan server); "Buka penuh" pindah ke halamannya.
export function AiChatModal({ open, onClose, prompt }: { open: boolean; onClose: () => void; prompt?: string }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Tanya Leo">
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-[min(82vh,760px)] sm:rounded-[28px]"
      >
        <AiChat
          variant="web"
          initialPrompt={prompt}
          renderHeader={({ reset, hasMessages, thinking }) => (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 md:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <LeoMascot mood={thinking ? 'watch' : 'idle'} size={44} />
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-slate-900">Tanya Leo</p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {thinking ? 'lagi mikir…' : 'Paham catatan keuanganmu'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {hasMessages && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Mulai obrolan baru? Riwayat chat ini akan dihapus.')) reset();
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  >
                    <RotateCcw size={14} /> <span className="hidden sm:inline">Obrolan baru</span>
                  </button>
                )}
                <Link href="/membership/ai-leosiqra" onClick={onClose} aria-label="Buka halaman penuh" title="Buka halaman penuh" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <Maximize2 size={16} />
                </Link>
                <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
        />
      </motion.div>
    </div>
  );
}
