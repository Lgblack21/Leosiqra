import { cn } from '@/lib/utils';

// Judul halaman standar /membership: ikon + judul + subjudul di kiri,
// aksi (picker, tombol) di kanan; menumpuk vertikal di mobile.
export function PageHeader({ icon, title, subtitle, actions, className }: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-4 min-w-0">
        {icon && (
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
