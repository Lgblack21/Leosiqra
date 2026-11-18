'use client';

import { cn } from '@/lib/utils';
import { lightTap } from '@/lib/haptics';
import { NumberInput } from '@/components/ui/NumberInput';

export const inputClass =
  'w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:border-indigo-500';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block fs-12 font-semibold text-slate-500 dark:text-slate-400 mb-1.5 px-1">{label}</span>
      {children}
      {hint ? <span className="block mt-1.5 px-1 fs-11 text-slate-400">{hint}</span> : null}
    </label>
  );
}

/** Input angka desimal ("4.5", "1250000") — keyboard numerik di HP. */
export function NumberField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    // Angka besar tampil dengan pemisah ribuan (1,500,000) supaya tidak salah ketik nol; nilai tetap angka polos.
    <NumberInput
      value={value}
      onChange={onChange}
      inputMode="decimal"
      placeholder={placeholder ?? '0'}
      aria-label={ariaLabel}
      className={cn(inputClass, 'tabular-nums')}
    />
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            lightTap();
            onChange(v);
          }}
          className={cn(
            'shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border',
            value === v
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
              : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
