"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { lightTap } from "@/lib/haptics";
import { useNotifications } from "@/components/notifications/NotificationList";

// Lonceng di Beranda /app → /app/notifikasi. Angka belum dibaca dimuat saat
// Beranda dibuka & saat aplikasi aktif lagi (tanpa polling).
export function NotificationButton() {
  const { unread } = useNotifications();
  return (
    <Link
      href="/app/notifikasi"
      onClick={lightTap}
      aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
    >
      <Bell size={16} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-50 dark:ring-slate-950">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
