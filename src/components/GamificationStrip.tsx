"use client";

import { useEffect, useState } from 'react';
import { Flame, Award, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gamificationService, GamificationData } from '@/lib/services/gamificationService';

export const GamificationStrip = () => {
  const [data, setData] = useState<GamificationData | null>(null);

  useEffect(() => {
    gamificationService.getUserGamification().then(setData).catch((error) => {
      console.error('Error loading gamification data:', error);
    });
  }, []);

  if (!data) return null;
  if (data.streakDays === 0 && data.surplusStreakMonths === 0 && !data.badges.some((b) => b.unlocked)) {
    return null;
  }

  return (
    <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-50 text-orange-600">
          <Flame size={18} />
          <span className="text-sm font-black">{data.streakDays} hari</span>
        </div>
        {data.surplusStreakMonths > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-600">
            <TrendingUp size={16} />
            <span className="text-sm font-black">{data.surplusStreakMonths} bulan hemat</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
        {data.badges.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all",
              badge.unlocked
                ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                : "bg-slate-50 border-slate-100 text-slate-300"
            )}
          >
            <Award size={12} />
            {badge.label}
          </div>
        ))}
      </div>
    </div>
  );
};
