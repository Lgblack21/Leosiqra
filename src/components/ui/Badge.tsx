import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-500',
  success: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-rose-50 text-rose-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
};

export function Badge({ tone = 'neutral', className, children }: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-label font-bold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}
