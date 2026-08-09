"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, BarChart3, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string | null;
}

// Semua tab sekarang fungsional. href: null tetap didukung (render sebagai
// <button disabled>, bukan <Link>) untuk tab masa depan yang belum siap —
// biar gak ada tap yang nyasar ke rute yang belum ada.
const TABS: TabItem[] = [
  { key: "home", label: "Home", icon: Home, href: "/app" },
  { key: "statistics", label: "Statistik", icon: BarChart3, href: "/app/statistics" },
  { key: "wallet", label: "Wallet", icon: Wallet, href: "/app/wallet" },
  { key: "profile", label: "Profil", icon: User, href: "/app/profile" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href !== null && pathname === tab.href;
          const itemClass = cn(
            "flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors",
            active ? "text-indigo-600" : "text-slate-300 cursor-default"
          );

          if (!tab.href) {
            return (
              <button key={tab.key} type="button" disabled aria-disabled className={itemClass}>
                <Icon size={20} strokeWidth={2} />
                {tab.label}
              </button>
            );
          }

          return (
            <Link key={tab.key} href={tab.href} onClick={lightTap} className={itemClass}>
              <motion.span
                animate={{ scale: active ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex items-center justify-center"
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </motion.span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
