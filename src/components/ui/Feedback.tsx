"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pengganti alert()/confirm() bawaan browser: toast di pojok (gak ngeblok
// UI) dan dialog konfirmasi yang bisa di-await:
//   const { toast, confirm } = useFeedback();
//   toast.error('Gagal menyimpan');
//   if (!(await confirm({ title: 'Hapus?', danger: true }))) return;

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback harus dipakai di dalam <FeedbackProvider>');
  return ctx;
}

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: AlertTriangle, className: 'text-rose-500' },
  info: { icon: Info, className: 'text-indigo-500' },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(0);
  // Fokus awal ke tombol Batal, bukan aksi — Enter gak boleh langsung
  // menjalankan aksi destruktif (hapus) tanpa sengaja.
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const [api] = useState<FeedbackApi>(() => ({
    toast: {
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    },
    confirm: (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
  }));

  const settle = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {/* Toasts */}
      <div aria-live="polite" className="fixed z-[70] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 flex flex-col gap-2 sm:w-96 pointer-events-none print:hidden">
        {toasts.map((t) => {
          const { icon: Icon, className } = toneStyles[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto animate-in flex items-start gap-3 bg-white border border-slate-100 shadow-xl rounded-card px-4 py-3"
            >
              <Icon size={18} className={cn('shrink-0 mt-0.5', className)} />
              <p className="flex-1 text-sm font-medium text-slate-700">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi" className="text-slate-300 hover:text-slate-500 shrink-0">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Dialog konfirmasi */}
      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in" onClick={() => settle(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm bg-white rounded-card shadow-2xl p-6 animate-in"
          >
            <h2 id="confirm-title" className="text-base font-black text-slate-900">{pending.title}</h2>
            {pending.message && <p className="mt-2 text-sm text-slate-500">{pending.message}</p>}
            <div className="mt-6 flex gap-2 justify-end">
              <button
                ref={cancelBtnRef}
                onClick={() => settle(false)}
                className="px-4 py-2.5 rounded-control text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {pending.cancelLabel ?? 'Batal'}
              </button>
              <button
                onClick={() => settle(true)}
                className={cn(
                  'px-4 py-2.5 rounded-control text-sm font-bold text-white transition-colors',
                  pending.danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'
                )}
              >
                {pending.confirmLabel ?? 'Ya, lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
