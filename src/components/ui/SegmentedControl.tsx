import { cn } from '@/lib/utils';

// Pilihan filter berbentuk chip — semua opsi kelihatan sekaligus (gak
// perlu buka dropdown), scroll horizontal kalau layar sempit.
export function SegmentedControl<T extends string>({ options, value, onChange, className, ariaLabel }: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1 p-1 bg-slate-100 rounded-control overflow-x-auto custom-scrollbar', className)}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={opt === value}
          onClick={() => onChange(opt)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors',
            opt === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
