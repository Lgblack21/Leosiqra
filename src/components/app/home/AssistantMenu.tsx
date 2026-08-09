"use client";

import { useRouter } from "next/navigation";
import { Bot, MessageCircle, ScanLine, Mic } from "lucide-react";

const ITEMS = [
  { icon: Bot, label: "Assistant", href: "/app/assistant/chat" },
  { icon: MessageCircle, label: "Chat", href: "/app/assistant/chat" },
  { icon: ScanLine, label: "AI Scan", href: "/app/assistant/scan" },
  { icon: Mic, label: "Voice", href: "/app/assistant/voice" },
] as const;

export function AssistantMenu() {
  const router = useRouter();

  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h2 className="text-sm font-black text-slate-900 dark:text-white mb-4">Assistant</h2>
      <div className="grid grid-cols-4 gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
