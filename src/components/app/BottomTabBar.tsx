"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, ListOrdered, Wallet, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  /** Rute lain yang membuat tab ini aktif (halaman di dalam menu tab tsb). */
  also?: string[];
}

// 4 tab + tombol + (Fab) di tengah — kolom ke-3 sengaja kosong untuk Fab.
const LEFT: TabItem[] = [
  { key: "home", label: "Beranda", icon: Home, href: "/app" },
  { key: "transactions", label: "Transaksi", icon: ListOrdered, href: "/app/transactions" },
];
const RIGHT: TabItem[] = [
  { key: "assets", label: "Aset", icon: Wallet, href: "/app/wallet" },
  { key: "more", label: "Lainnya", icon: LayoutGrid, href: "/app/more", also: ["/app/statistics", "/app/profile", "/app/debts", "/app/savings", "/app/cards", "/app/budget", "/app/recurring", "/app/investments"] },
];

function Tab({ tab, pathname }: { tab: TabItem; pathname: string }) {
  const Icon = tab.icon;
  const active =
    tab.href === "/app"
      ? pathname === "/app"
      : pathname.startsWith(tab.href) || Boolean(tab.also?.some((p) => pathname.startsWith(p)));
  return (
    <Link
      href={tab.href}
      onClick={lightTap}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors",
        active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
      )}
    >
      {/* Pil latar ikon aktif meluncur antar tab (shared layout). */}
      <span className="relative flex h-8 w-14 items-center justify-center">
        {active && (
          <motion.span
            layoutId="tab-pill"
            className="absolute inset-0 rounded-full bg-indigo-50 dark:bg-indigo-500/15"
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
          />
        )}
        <motion.span
          animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="relative flex items-center justify-center"
        >
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        </motion.span>
      </span>
      {tab.label}
    </Link>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {LEFT.map((t) => <Tab key={t.key} tab={t} pathname={pathname} />)}
        <span aria-hidden />
        {RIGHT.map((t) => <Tab key={t.key} tab={t} pathname={pathname} />)}
      </div>
    </nav>
  );
}
