"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { AiChat, AiOrb } from "@/components/ai/AiChat";
import { lightTap } from "@/lib/haptics";

export default function AssistantChatPage() {
  const router = useRouter();
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950">
      <AiChat
        variant="app"
        renderHeader={({ reset, hasMessages, thinking }) => (
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white/90 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <button type="button" onClick={() => router.back()} aria-label="Kembali" className="p-1.5 text-slate-500 dark:text-slate-400">
              <ChevronLeft size={22} />
            </button>
            <AiOrb size={36} thinking={thinking} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 dark:text-white">AI Leosiqra</p>
              <p className="text-[11px] font-semibold text-slate-400">{thinking ? "lagi ngetik…" : "Online · terhubung ke datamu"}</p>
            </div>
            {hasMessages && (
              <button
                type="button"
                aria-label="Obrolan baru"
                onClick={() => {
                  lightTap();
                  if (confirm("Mulai obrolan baru? Riwayat chat ini akan dihapus.")) reset();
                }}
                className="rounded-full p-2 text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>
        )}
      />
    </div>
  );
}
