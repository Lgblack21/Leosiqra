import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Permukaan dasar semua kartu di /membership — satu radius, border, dan
// shadow yang sama supaya halaman gak lagi campur [20px]/[24px]/[32px].
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-white rounded-card border border-slate-100 shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ title, icon, action, className }: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-4', className)}>
      <div className="flex items-center gap-2 text-label font-bold text-slate-500 uppercase">
        {icon}
        {title}
      </div>
      {action}
    </div>
  );
}
