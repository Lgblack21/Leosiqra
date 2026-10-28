"use client";

import { Monitor, Sun, Moon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';

// Pengaturan → Mode gelap. Disimpan per perangkat (localStorage, sama dengan
// aplikasi HP). Web masih bertahap — lihat lib/webTheme.ts.
const MODES: { id: ThemeMode; label: string; desc: string; icon: React.ElementType; preview: string }[] = [
  { id: 'system', label: 'Ikuti perangkat', desc: 'Terang di siang hari, gelap kalau HP/laptop-mu sedang mode gelap.', icon: Monitor, preview: 'bg-gradient-to-br from-[#f5f6fa] from-50% to-[#0b1020] to-50%' },
  { id: 'light', label: 'Terang', desc: 'Selalu terang.', icon: Sun, preview: 'bg-[#f5f6fa]' },
  { id: 'dark', label: 'Gelap', desc: 'Lebih nyaman di malam hari & hemat baterai layar OLED.', icon: Moon, preview: 'bg-[#0b1020]' },
];

export const THEME_LABEL: Record<ThemeMode, string> = { system: 'Ikuti perangkat', light: 'Terang', dark: 'Gelap' };

export function AppearanceView() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const on = theme === m.id;
          return (
            <button key={m.id} type="button" onClick={() => setTheme(m.id)} aria-pressed={on} className={cn('rounded-[20px] p-2 text-left ring-1 transition', on ? 'ring-2 ring-indigo-500' : 'ring-slate-200 hover:ring-slate-300')}>
              <span className={cn('relative block h-20 overflow-hidden rounded-[14px] ring-1 ring-black/5', m.preview)}>
                <span className="absolute left-2 top-2 h-2 w-8 rounded-full bg-white/70" />
                <span className="absolute left-2 top-6 h-8 w-12 rounded-lg bg-indigo-500/80" />
                {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><Check size={12} strokeWidth={3} /></span>}
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-slate-900"><m.icon size={14} /> {m.label}</span>
            </button>
          );
        })}
      </div>
      <p className="px-1 text-[13px] leading-snug text-slate-500">{MODES.find((m) => m.id === theme)?.desc}</p>
      <div className="rounded-2xl bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-500 ring-1 ring-slate-200">
        Mode gelap web masih bertahap: menu samping, panel Pengaturan & halaman Ringkasan sudah gelap; halaman lain menyusul. Aplikasi HP sudah gelap sepenuhnya. Pilihan disimpan di perangkat ini.
      </div>
    </div>
  );
}
