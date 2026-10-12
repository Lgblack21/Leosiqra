"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { weeklyInsightService, type WeeklyInsight } from "@/lib/services/insightService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";

// Insight mingguan AI Leosiqra (dihitung Worker dari 7 hari terakhir). Dipakai di
// Beranda aplikasi HP (target "app") dan Dashboard web (target "web") — CTA
// mengarah ke halaman yang sesuai untuk masing-masing.
const TONE = {
  warning: { icon: AlertTriangle, box: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  positive: { icon: Sparkles, box: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  info: { icon: Lightbulb, box: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
} as const;

const WATCH = ["transactions", "savings"] as const;

export function WeeklyInsights({ target, className }: { target: "web" | "app"; className?: string }) {
  const [items, setItems] = useState<WeeklyInsight[]>([]);

  useEffect(() => {
    const load = () =>
      weeklyInsightService
        .getWeeklyInsights()
        .then(setItems)
        .catch(() => {
          /* pelengkap — gagal muat (mis. Worker lama) cukup disembunyikan */
        });
    load();
    const unsubs = WATCH.map((c) => subscribeToCollectionChanges(c, load));
    return () => unsubs.forEach((u) => u());
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={cn("rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-sm font-black text-slate-900 dark:text-white">Insight Mingguan</h2>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">7 hari terakhir</span>
      </div>
      <div className={cn("grid gap-2", target === "web" && "md:grid-cols-3")}>
        {items.map((item) => {
          const tone = TONE[item.tone] ?? TONE.info;
          const Icon = tone.icon;
          return (
            <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", tone.box)}>
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{item.body}</p>
                <Link
                  href={target === "app" ? item.cta.app : item.cta.web}
                  className="inline-flex items-center gap-0.5 mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                >
                  {item.cta.label} <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
