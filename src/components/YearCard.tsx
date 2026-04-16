import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export const YearCard = ({ year, income, expense, isActive, onClick }: { year: string, income: string, expense: string, isActive?: boolean, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "p-6 rounded-[32px] border transition-all cursor-pointer group relative overflow-hidden",
      isActive 
        ? "bg-white border-indigo-600 shadow-xl shadow-indigo-100 ring-1 ring-indigo-600" 
        : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
    )}
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          isActive ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400 group-hover:text-indigo-500"
        )}>
          <Calendar size={20} />
        </div>
        <span className={cn("text-xl font-black transition-colors", isActive ? "text-slate-900" : "text-slate-400")}>{year}</span>
      </div>
      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />}
    </div>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Income</span>
        <span className="text-sm font-black text-emerald-600">+{income}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expense</span>
        <span className="text-sm font-black text-rose-600">-{expense}</span>
      </div>
    </div>
  </div>
);
