"use client";

import { LeoMascot } from '@/components/mascot/LeoMascot';
import type { StoryMood } from '@/lib/stories';

// Stiker Leo sesuai mood (gratis, SVG orisinal): Badai → sedih, Mendung → tertidur,
// Berawan → biasa, Cerah → senang, Pelangi → senang + kilau.
export function MoodLeo({ mood, size = 140, className }: { mood: StoryMood | null; size?: number; className?: string }) {
  const props =
    mood === 1 ? { mood: 'sad' as const } :
    mood === 2 ? { mood: 'idle' as const, activity: 'sleep' as const } :
    mood === 4 || mood === 5 ? { mood: 'happy' as const } :
    { mood: 'idle' as const };
  return <LeoMascot {...props} size={size} stayAwake={mood !== 2} className={className} />;
}
