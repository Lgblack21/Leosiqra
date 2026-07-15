"use client";

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  note?: string;
  icon?: LucideIcon;
  color?: string;
  bg?: string;
}

export function AdminStatCard({ label, value, note, icon: Icon, color = 'text-indigo-600', bg = 'bg-indigo-50' }: AdminStatCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className={cn("p-2 rounded-xl", bg, color)}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</h3>
      {note && <p className="text-[11px] font-medium text-slate-400">{note}</p>}
    </div>
  );
}
