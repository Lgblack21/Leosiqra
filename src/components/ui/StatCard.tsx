import { Card, CardHeader } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  badge?: React.ReactNode;
  /** 0–100; kalau diisi, tampil progress bar di bawah nilai. */
  progress?: number;
  progressClassName?: string;
  caption?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label, icon, value, valueClassName, badge, progress, progressClassName = 'bg-slate-800',
  caption, loading, className,
}: StatCardProps) {
  return (
    <Card className={cn('p-5 md:p-6 flex flex-col', className)}>
      <CardHeader title={label} icon={icon} action={badge} />
      {loading ? (
        <Skeleton className="h-8 w-3/4 mb-5" />
      ) : (
        // key = nilainya: tiap angka berubah (mis. setelah input baru), elemen
        // di-mount ulang dan fade-in halus lewat .animate-in — perubahan
        // kelihatan tanpa loncatan kasar.
        <p
          key={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          className={cn('text-xl md:text-2xl font-black text-slate-900 tracking-tight tabular-nums mb-5 truncate animate-in', valueClassName)}
        >
          {value}
        </p>
      )}
      {(progress !== undefined || caption) && (
        <div className="mt-auto flex items-center gap-3">
          {progress !== undefined && (
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', progressClassName)}
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
              />
            </div>
          )}
          {caption && (
            <span className={cn('text-caption font-medium text-slate-400', progress !== undefined && 'whitespace-nowrap')}>{caption}</span>
          )}
        </div>
      )}
    </Card>
  );
}
