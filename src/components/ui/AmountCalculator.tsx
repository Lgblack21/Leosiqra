"use client";

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calculator, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRecordingPrefs } from '@/lib/useRecordingPrefs';

// Kalkulator mini untuk kolom nominal (Pengaturan → Keyboard nominal →
// Kalkulator mini). Hitung "25000+12500×2" lalu "Pakai" mengisi kolomnya.
// Ekspresi dihitung parser sendiri (tanpa eval), hasil dibulatkan 2 desimal.

const OPS: Record<string, number> = { '+': 1, '−': 1, '×': 2, '÷': 2 };

export const evaluateExpression = (expr: string): number | null => {
  const tokens = expr.match(/\d+(?:[.,]\d+)?|[+−×÷]/g);
  if (!tokens || OPS[tokens[0]] || OPS[tokens[tokens.length - 1]]) return null;
  const out: (number | string)[] = [];
  const stack: string[] = [];
  for (const t of tokens) {
    if (OPS[t]) {
      while (stack.length && OPS[stack[stack.length - 1]] >= OPS[t]) out.push(stack.pop()!);
      stack.push(t);
    } else out.push(Number(t.replace(',', '.')));
  }
  while (stack.length) out.push(stack.pop()!);
  const st: number[] = [];
  for (const x of out) {
    if (typeof x === 'number') { st.push(x); continue; }
    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) return null;
    if (x === '÷' && b === 0) return null;
    st.push(x === '+' ? a + b : x === '−' ? a - b : x === '×' ? a * b : a / b);
  }
  const r = st.length === 1 ? st[0] : null;
  return r === null || !Number.isFinite(r) ? null : Math.round(r * 100) / 100;
};

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '000', '0', ',', '+'];

export function AmountCalculatorButton({ value, onChange, className }: { value: string; onChange: (raw: string) => void; className?: string }) {
  const { amountKeypad } = useRecordingPrefs();
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  if (amountKeypad !== 'kalkulator') return null;

  const result = evaluateExpression(expr);
  const press = (k: string) => {
    setExpr((e) => {
      if (OPS[k]) {
        if (!e) return '';
        return OPS[e[e.length - 1]] ? e.slice(0, -1) + k : e + k;
      }
      if (k === ',') {
        const last = e.split(/[+−×÷]/).pop() ?? '';
        return last.includes(',') ? e : e + (last ? ',' : '0,');
      }
      return (e + k).slice(0, 40);
    });
  };
  const use = () => {
    if (result === null || result <= 0) return;
    onChange(String(result));
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setExpr(value ? String(Number(value)).replace('.', ',') : ''); setOpen(true); }}
        aria-label="Buka kalkulator"
        title="Kalkulator"
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100', className)}
      >
        <Calculator size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/40" />
            <motion.div
              role="dialog"
              aria-label="Kalkulator nominal"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative w-full rounded-t-[28px] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-[28px]"
            >
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
                <p className="min-h-[20px] truncate text-[14px] text-white/60">{expr || '0'}</p>
                <p className="truncate text-[30px] font-extrabold tabular-nums">{result === null ? '—' : fmt(result)}</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    className={cn('h-14 rounded-2xl text-[20px] font-bold active:scale-95', OPS[k] ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-900')}
                  >
                    {k}
                  </button>
                ))}
                <button type="button" onClick={() => setExpr('')} className="h-14 rounded-2xl bg-rose-50 text-[16px] font-bold text-rose-600 active:scale-95">C</button>
                <button type="button" onClick={() => setExpr((e) => e.slice(0, -1))} aria-label="Hapus satu" className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 active:scale-95"><Delete size={20} /></button>
                <button type="button" onClick={use} disabled={result === null || result <= 0} className="col-span-2 h-14 rounded-2xl bg-indigo-600 text-[16px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-400 active:scale-95">
                  Pakai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
