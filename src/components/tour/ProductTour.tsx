"use client";

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStep {
  // CSS selector kalau step ini menyorot elemen nyata (mis. grup menu sidebar).
  // Kalau kosong, tampil sebagai kartu di tengah layar (dipakai untuk step
  // pembuka/penutup yang tidak menunjuk elemen tertentu).
  target?: string;
  title: string;
  content: string;
}

interface ProductTourProps {
  steps: TourStep[];
  isActive: boolean;
  onFinish: () => void;
}

// Tur satu-halaman: overlay gelap dengan "lubang" sorotan di sekitar elemen
// target (trik box-shadow raksasa, tanpa perlu SVG mask), plus kartu
// penjelasan. Kalau elemen targetnya tidak ketemu/tidak terlihat (mis. sidebar
// tersembunyi di layar mobile), otomatis jatuh ke kartu di tengah layar saja
// tanpa sorotan — tetap informatif, cuma tidak menyorot apa pun.
export const ProductTour = ({ steps, isActive, onFinish }: ProductTourProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isActive) setStepIndex(0);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const step = steps[stepIndex];
    if (!step?.target) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(step.target!);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Elemen ada di DOM tapi tak kelihatan (mis. sidebar mobile yang
      // di-translate keluar layar) — anggap tidak ketemu.
      if (r.width === 0 || r.height === 0) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setRect(r);
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const interval = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener('resize', measure);
    };
  }, [isActive, stepIndex, steps]);

  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isActive, onFinish]);

  if (!isActive) return null;
  const step = steps[stepIndex];
  if (!step) return null;
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const cardStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(rect.bottom + 16, window.innerHeight - 220),
        left: Math.min(Math.max(rect.left, 16), window.innerWidth - 336),
        zIndex: 10000,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      };

  return (
    <>
      {/* Backdrop + spotlight cutout */}
      <div className="fixed inset-0 z-[9998] transition-all duration-300" aria-hidden>
        {rect ? (
          <div
            className="fixed rounded-2xl transition-all duration-300 pointer-events-none"
            style={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.7)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900/70" />
        )}
      </div>

      {/* Ring sorotan */}
      {rect && (
        <div
          className="fixed z-[9999] rounded-2xl border-2 border-indigo-400 pointer-events-none transition-all duration-300"
          style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }}
        />
      )}

      {/* Kartu penjelasan */}
      <div
        style={cardStyle}
        className="w-[calc(100vw-32px)] max-w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
            Langkah {stepIndex + 1} / {steps.length}
          </p>
          <button onClick={onFinish} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-sm font-black text-slate-900 mb-1.5">{step.title}</h3>
        <p className="text-[12px] font-medium text-slate-500 leading-relaxed mb-5">{step.content}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onFinish}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Lewati Tur
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
            )}
            <button
              onClick={() => (isLast ? onFinish() : setStepIndex((i) => i + 1))}
              className={cn(
                'px-4 py-2 rounded-lg text-[11px] font-black text-white flex items-center gap-1.5 transition-colors',
                'bg-indigo-600 hover:bg-indigo-700'
              )}
            >
              {isLast ? 'Selesai' : 'Lanjut'}
              {!isLast && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
