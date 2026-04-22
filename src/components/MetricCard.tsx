import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export const MetricCard = ({ title, value, type, icon: Icon }: { title: string, value: string, type?: 'positive' | 'negative' | 'neutral', icon: LucideIcon }) => (
  <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center justify-between mb-4">
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
        type === 'positive' ? "bg-emerald-50 text-emerald-600" : 
        type === 'negative' ? "bg-rose-50 text-rose-600" : 
        "bg-indigo-50 text-indigo-600"
      )}>
        <Icon size={24} />
      </div>
      {type === 'positive' && <ArrowUpRight size={18} className="text-emerald-500 opacity-50" />}
      {type === 'negative' && <ArrowDownRight size={18} className="text-rose-500 opacity-50" />}
    </div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{title}</p>
    <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
  </div>
);
