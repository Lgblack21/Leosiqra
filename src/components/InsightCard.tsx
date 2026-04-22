import { cn } from '@/lib/utils';

export const InsightCard = ({ title, value, subtitle, icon: Icon, colorClass }: { title: string, value: string, subtitle: string, icon: any, colorClass: string }) => (
  <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex gap-4 items-start transition-all hover:shadow-md group">
    <div className={cn("mt-1 p-3 rounded-2xl transition-transform group-hover:scale-110", colorClass)}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <p className="text-lg font-bold text-slate-900 mb-0.5">{value}</p>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
      </div>
    </div>
  </div>
);
