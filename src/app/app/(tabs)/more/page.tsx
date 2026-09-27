"use client";

import Link from "next/link";
import {
  BarChart3, MessageCircle, ScanLine, Mic, UserCircle, HandCoins, PiggyBank, CreditCard, Target,
  Repeat, TrendingUp, CalendarRange, ShieldCheck, Globe, ChevronRight, ExternalLink,
} from "lucide-react";
import { lightTap } from "@/lib/haptics";
import { FadeIn, StaggerList, StaggerItem } from "@/components/app/FadeIn";

interface MenuItem { label: string; desc?: string; href: string; icon: React.ElementType; color: string }

const IN_APP: MenuItem[] = [
  { label: "Statistik", href: "/app/statistics", icon: BarChart3, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" },
  { label: "Chat AI", href: "/app/assistant/chat", icon: MessageCircle, color: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" },
  { label: "Scan Struk", href: "/app/assistant/scan", icon: ScanLine, color: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" },
  { label: "Voice", href: "/app/assistant/voice", icon: Mic, color: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400" },
  { label: "Hutang & Piutang", href: "/app/debts", icon: HandCoins, color: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" },
  { label: "Tabungan", href: "/app/savings", icon: PiggyBank, color: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" },
  { label: "Kartu Kredit", href: "/app/cards", icon: CreditCard, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { label: "Budget", href: "/app/budget", icon: Target, color: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400" },
  { label: "Rutin", href: "/app/recurring", icon: Repeat, color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" },
  { label: "Investasi", href: "/app/investments", icon: TrendingUp, color: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
];

// Fitur yang belum dipindah ke aplikasi — sementara dibuka di versi web lengkap
// (tetap login dengan sesi yang sama). Pindahkan ke IN_APP begitu versi
// mobile-nya selesai.
const WEB_FEATURES: MenuItem[] = [
  { label: "Laporan Tahunan", href: "/membership/annual", icon: CalendarRange, color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  { label: "Pajak Center", href: "/membership/pajak-center", icon: ShieldCheck, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  { label: "Data Pasar", href: "/membership/market-data", icon: Globe, color: "bg-lime-50 text-lime-700 dark:bg-lime-500/10 dark:text-lime-400" },
];

export default function AppMorePage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-6">
      <FadeIn>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Lainnya</h1>
      </FadeIn>

      <StaggerList className="grid grid-cols-4 gap-3">
        {IN_APP.map(({ label, href, icon: Icon, color }) => (
          <StaggerItem key={href}>
            <Link href={href} onClick={lightTap} className="flex flex-col items-center gap-2 text-center">
              <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color}`}>
                <Icon size={22} />
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{label}</span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>

      <Link
        href="/app/profile"
        onClick={lightTap}
        className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3.5"
      >
        <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
          <UserCircle size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-900 dark:text-white">Profil & Pengaturan</span>
          <span className="block text-[11px] text-slate-400">Tema, akun, keluar</span>
        </span>
        <ChevronRight size={18} className="text-slate-300" />
      </Link>

      <section>
        <div className="flex items-baseline justify-between px-1 mb-2">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fitur lengkap</h2>
          <span className="text-[10px] font-bold text-slate-400">dibuka di versi web</span>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {WEB_FEATURES.map(({ label, desc, href, icon: Icon, color }) => (
            <a key={href} href={href} onClick={lightTap} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{label}</span>
                {desc && <span className="block text-[11px] text-slate-400 truncate">{desc}</span>}
              </span>
              <ExternalLink size={14} className="text-slate-300 shrink-0" />
            </a>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 px-1">Fitur-fitur ini sedang dipindahkan ke tampilan aplikasi.</p>
      </section>
    </div>
  );
}
