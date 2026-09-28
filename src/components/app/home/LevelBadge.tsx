"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Star, PartyPopper } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ChallengeList } from "@/components/gamification/ChallengeList";
import { gamificationService, type GamificationData } from "@/lib/services/gamificationService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { lightTap } from "@/lib/haptics";

// Koleksi yang memengaruhi XP — level dihitung ulang setelah salah satunya berubah.
const WATCH = ["transactions", "accounts", "savings", "investments", "budgets", "recurring"] as const;

// Level terakhir yang sudah "dirayakan" disimpan per user di perangkat ini,
// supaya animasi naik level cuma muncul sekali.
const seenKey = (uid: string) => `leosiqra:level-seen:${uid}`;
const readSeen = (uid: string) => {
  try {
    const v = localStorage.getItem(seenKey(uid));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const writeSeen = (uid: string, level: number) => {
  try {
    localStorage.setItem(seenKey(uid), String(level));
  } catch {
    /* mode privat / storage diblokir — cukup tanpa perayaan */
  }
};

export function LevelBadge() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [open, setOpen] = useState(false);
  const [levelUp, setLevelUp] = useState<{ level: number; name: string } | null>(null);
  const controls = useAnimationControls();

  const load = useCallback(() => {
    gamificationService
      .getUserGamification()
      .then((d) => {
        setData(d);
        const uid = auth.currentUser?.uid;
        if (!uid || !d.level) return;
        const seen = readSeen(uid);
        if (seen !== null && d.level.level > seen) {
          setLevelUp({ level: d.level.level, name: d.level.name });
          controls.start({ scale: [1, 1.35, 0.92, 1.08, 1], rotate: [0, -8, 8, 0, 0], transition: { duration: 0.9 } });
          lightTap();
        }
        if (seen === null || d.level.level > seen) writeSeen(uid, d.level.level);
      })
      .catch(() => {
        /* badge cuma pelengkap — gagal muat tidak boleh mengganggu Beranda */
      });
  }, [controls]);

  useEffect(() => {
    load();
    const unsubs = WATCH.map((c) => subscribeToCollectionChanges(c, load));
    return () => unsubs.forEach((u) => u());
  }, [load]);

  useEffect(() => {
    if (!levelUp) return;
    const t = setTimeout(() => setLevelUp(null), 3800);
    return () => clearTimeout(t);
  }, [levelUp]);

  const level = data?.level?.level ?? 1;

  return (
    <>
      <div className="relative">
        <motion.button
          type="button"
          animate={controls}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            lightTap();
            setOpen(true);
          }}
          aria-label={`Level ${level}, lihat challenge`}
          className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <Star size={12} fill="currentColor" /> Lvl {level}
        </motion.button>

        <AnimatePresence>
          {levelUp && (
            <motion.button
              type="button"
              onClick={() => {
                setLevelUp(null);
                setOpen(true);
              }}
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              className="absolute right-0 top-full z-20 mt-2 flex items-center gap-2 whitespace-nowrap rounded-2xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white shadow-xl"
            >
              <PartyPopper size={15} className="text-amber-300" />
              Naik ke Lv {levelUp.level} · {levelUp.name}!
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Level & Challenge">
        {data?.level ? (
          <ChallengeList data={data} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">Memuat challenge…</p>
        )}
      </BottomSheet>
    </>
  );
}
