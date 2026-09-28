"use client";

import { useEffect, useState } from 'react';
import { Flame, Award, TrendingUp, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gamificationService, GamificationData, levelProgress } from '@/lib/services/gamificationService';
import { Modal } from '@/components/ui/Modal';
import { ChallengeList } from '@/components/gamification/ChallengeList';

export const GamificationStrip = () => {
  const [data, setData] = useState<GamificationData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    gamificationService.getUserGamification().then(setData).catch((error) => {
      console.error('Error loading gamification data:', error);
    });
  }, []);

  // Payload yang tidak sesuai bentuk (mis. API error yang tetap 200) tidak
  // boleh menjatuhkan seluruh Dashboard — strip ini cuma pelengkap.
  if (!data || !Array.isArray(data.badges)) return null;
  const level = data.level;
  // Tanpa data level (worker lama) strip hanya tampil kalau sudah ada pencapaian.
  if (!level && data.streakDays === 0 && data.surplusStreakMonths === 0 && !data.badges.some((b) => b.unlocked)) {
    return null;
  }
  const xp = data.xp ?? 0;

  return (
    <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {level && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex items-center gap-3 rounded-2xl bg-indigo-50 px-3.5 py-2 text-left transition-colors hover:bg-indigo-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white">
              <Star size={15} fill="currentColor" />
            </span>
            <span className="min-w-[104px]">
              <span className="block text-sm font-black text-indigo-700">Lv {level.level} · {level.name}</span>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${levelProgress(xp, level) * 100}%` }} />
              </span>
            </span>
            <ChevronRight size={16} className="text-indigo-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
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

      {level && (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Level & Challenge" maxWidth="max-w-lg">
          <ChallengeList data={data} />
        </Modal>
      )}
    </div>
  );
};
