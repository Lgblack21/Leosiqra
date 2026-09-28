"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  challengeProgressLabel,
  levelProgress,
  sortChallenges,
  type GamificationData,
} from "@/lib/services/gamificationService";

// Isi panel Challenge (dipakai BottomSheet mobile & Modal web): kartu level +
// progres XP, lalu daftar challenge — yang hampir selesai paling atas.
export function ChallengeList({ data }: { data: GamificationData }) {
  const reduce = useReducedMotion();
  if (!data.level || !data.challenges) return null;
  const { level } = data;
  const xp = data.xp ?? 0;
  const pct = levelProgress(xp, level);
  const list = sortChallenges(data.challenges);
  const doneCount = list.filter((c) => c.done).length;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-5 text-white">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Star size={16} fill="currentColor" className="text-amber-300" />
            <span className="text-lg font-black leading-none">{level.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-100">Level {level.level}</p>
            <p className="text-xl font-black">{level.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black tabular-nums">{xp}</p>
            <p className="text-[11px] font-bold text-indigo-100">XP</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-200"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-indigo-100">
            {level.nextXp === null
              ? "Level tertinggi tercapai — kamu Legenda!"
              : `${level.nextXp - xp} XP lagi ke Lv ${level.level + 1} · ${level.nextName}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-black text-slate-900 dark:text-white">Challenge</p>
        <p className="text-xs font-bold text-slate-400">{doneCount}/{list.length} selesai</p>
      </div>

      <ul className="space-y-2.5">
        {list.map((c, i) => (
          <motion.li
            key={c.id}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.35 }}
            className={cn(
              "rounded-2xl border p-3.5",
              c.done
                ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  c.done ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                )}
              >
                {c.done ? <Check size={17} strokeWidth={3} /> : <Trophy size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm font-bold", c.done ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white")}>
                    {c.label}
                  </p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black", c.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300")}>
                    +{c.xp} XP
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                {!c.done && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.progress / c.target) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{challengeProgressLabel(c)}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
