"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, X } from "lucide-react";
import { openAppNotificationUrl } from "@/lib/txPrefill";
import { PUSH_EVENT, type ForegroundPush } from "@/lib/nativePush";

// Android tidak menampilkan notifikasi FCM saat aplikasi sedang dibuka — pesan
// itu dikirim ke JS (pushNotificationReceived). Banner ini yang menampilkannya;
// ketuk = buka tujuan notifikasi (sama seperti mengetuk notifikasi sistem).
export function PushBanner() {
  const router = useRouter();
  const [msg, setMsg] = useState<(ForegroundPush & { key: number }) | null>(null);

  useEffect(() => {
    const onPush = (e: Event) => setMsg({ ...(e as CustomEvent<ForegroundPush>).detail, key: Date.now() });
    window.addEventListener(PUSH_EVENT, onPush);
    return () => window.removeEventListener(PUSH_EVENT, onPush);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 7000);
    return () => window.clearTimeout(t);
  }, [msg]);

  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key={msg.key}
          initial={{ y: -90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => { if (info.offset.y < -30) setMsg(null); }}
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-[90] mx-auto max-w-md"
        >
          <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <button
              type="button"
              onClick={() => { const url = msg.url; setMsg(null); if (url) openAppNotificationUrl(url, router.push); }}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><BellRing size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-extrabold text-slate-900 dark:text-white">{msg.title}</span>
                {msg.body && <span className="mt-0.5 block line-clamp-2 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">{msg.body}</span>}
              </span>
            </button>
            <button type="button" onClick={() => setMsg(null)} aria-label="Tutup" className="shrink-0 rounded-lg p-1 text-slate-400">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
