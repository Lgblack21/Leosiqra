"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, Copy, Sparkles } from "lucide-react";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { aiChatService } from "@/lib/services/aiChatService";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "model"; text: string; at: Date; fresh?: boolean };

export const SUGGESTIONS: { emoji: string; label: string; prompt: string }[] = [
  { emoji: "🔥", label: "Aku boros di mana?", prompt: "Bulan ini aku paling boros di kategori apa? Bandingin sama biasanya dong." },
  { emoji: "📅", label: "Cukup sampai akhir bulan?", prompt: "Dengan pengeluaranku sekarang, uangku cukup gak sampai akhir bulan?" },
  { emoji: "💰", label: "Total saldo semua rekening", prompt: "Total saldoku di semua rekening berapa?" },
  { emoji: "🎯", label: "Cek budget", prompt: "Budget mana yang udah mau habis bulan ini?" },
  { emoji: "📈", label: "Harga emas & Bitcoin", prompt: "Harga emas per gram sama Bitcoin hari ini berapa?" },
  { emoji: "🧾", label: "Tagihan minggu depan", prompt: "Ada tagihan atau transaksi rutin apa aja dalam 2 minggu ke depan?" },
];

const FOLLOW_UPS = ["Jelasin lebih detail dong", "Kasih 3 tips hemat buat aku", "Bandingin sama bulan lalu"];
const MAX_CHARS = 2000;

// Orb animasi — "wajah" AI Leosiqra.
export function AiOrb({ size = 40, thinking = false }: { size?: number; thinking?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#6366f1,#a855f7,#ec4899,#22d3ee,#6366f1)] blur-[1px]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: thinking ? 1.6 : 6, repeat: Infinity, ease: "linear" }}
      />
      <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-indigo-600 to-violet-700" />
      <Sparkles size={size * 0.42} className="relative text-white" />
    </span>
  );
}

const toMsg = (m: { role: string; text: string; timestamp: Date }): Msg => ({ role: m.role === "user" ? "user" : "model", text: m.text, at: m.timestamp });

// Panel chat AI Leosiqra — dipakai halaman web & aplikasi HP.
export type AiChatHeaderCtx = { reset: () => void; hasMessages: boolean; thinking: boolean };

export function AiChat({ variant, renderHeader }: { variant: "web" | "app"; renderHeader?: (ctx: AiChatHeaderCtx) => React.ReactNode }) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    aiChatService
      .getUserChat("session")
      .then((h) => setMessages((h ?? []).map(toMsg)))
      .catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, thinking, reduce]);

  // Tinggi kolom ketik mengikuti isi (maks ±5 baris).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim().slice(0, MAX_CHARS);
      if (!prompt || thinking) return;
      setInput("");
      setMessages((cur) => [...(cur ?? []), { role: "user", text: prompt, at: new Date() }]);
      setThinking(true);
      try {
        // Riwayat disimpan server (termasuk jawaban) — browser tidak menyimpan ulang.
        const r = await cloudflareApi<{ answer?: string }>("/api/member/ai/chat", { method: "POST", json: { prompt } });
        setMessages((cur) => [...(cur ?? []), { role: "model", text: r.answer || "Hmm, aku belum dapat jawabannya. Coba tanya lagi ya.", at: new Date(), fresh: true }]);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        const msg = /terlalu banyak/i.test(raw)
          ? "Pelan-pelan dulu ya 😅 kamu kirim banyak pesan barusan. Coba lagi sebentar lagi."
          : /kuota|AI Leosiqra|gangguan/i.test(raw)
            ? raw
            : "Waduh, aku lagi ada kendala nih. Coba kirim ulang sebentar lagi ya.";
        setMessages((cur) => [...(cur ?? []), { role: "model", text: msg, at: new Date(), fresh: true }]);
      } finally {
        setThinking(false);
      }
    },
    [thinking]
  );

  const reset = useCallback(async () => {
    setMessages([]);
    try {
      await aiChatService.clearUserChat("session");
    } catch {
      /* gagal hapus di server — tampilan tetap bersih, riwayat lama muncul lagi saat dibuka ulang */
    }
  }, []);

  const copy = (text: string, i: number) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const empty = messages !== null && messages.length === 0;
  const lastModelIdx = messages ? messages.map((m) => m.role).lastIndexOf("model") : -1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {renderHeader?.({ reset, hasMessages: Boolean(messages && messages.length), thinking })}
      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto", variant === "web" ? "px-5 py-6 md:px-8" : "px-4 py-5")}>
        {messages === null ? (
          <div className="flex h-full items-center justify-center"><AiOrb size={48} thinking /></div>
        ) : empty ? (
          <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-xl flex-col items-center pt-4 text-center md:pt-10">
            <AiOrb size={72} />
            <h2 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">Hai! Aku Leosiqra 👋</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Aku udah nyambung ke catatan keuanganmu dan data pasar terbaru. Tanya aja santai — soal pengeluaran, budget, tabungan, investasi, atau apa pun.
            </p>
            <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  type="button"
                  onClick={() => send(s.prompt)}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="text-lg">{s.emoji}</span> {s.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className={cn("mx-auto space-y-5", variant === "web" && "max-w-3xl")}>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={cn("flex gap-3", m.role === "user" && "justify-end")}
                >
                  {m.role === "model" && <AiOrb size={32} />}
                  <div className={cn("group max-w-[85%] md:max-w-[78%]", m.role === "user" && "flex flex-col items-end")}>
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 text-[14.5px] leading-relaxed",
                        m.role === "user"
                          ? "rounded-br-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20"
                          : "rounded-tl-lg border border-slate-100 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      )}
                    >
                      {m.role === "model" ? <AiMarkdown text={m.text} /> : <span className="whitespace-pre-wrap">{m.text}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-[10px] font-semibold text-slate-400">
                      {m.at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {m.role === "model" && (
                        <button type="button" onClick={() => copy(m.text, i)} aria-label="Salin jawaban" className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          {copied === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                    {i === lastModelIdx && i === messages.length - 1 && !thinking && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {FOLLOW_UPS.map((f) => (
                          <button key={f} type="button" onClick={() => send(f)} className="rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1.5 text-[12px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                <AiOrb size={32} thinking />
                <div className="flex items-center gap-2 rounded-3xl rounded-tl-lg border border-slate-100 bg-white px-4 py-3 text-[13px] font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  Leosiqra lagi mikir
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-indigo-400" animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <div className={cn("shrink-0 border-t border-slate-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90", variant === "web" ? "px-5 py-4 md:px-8" : "px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3")}>
        <div className={cn("mx-auto", variant === "web" && "max-w-3xl")}>
          {!empty && messages !== null && variant === "app" && (
            <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button key={s.label} type="button" disabled={thinking} onClick={() => send(s.prompt)} className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-white p-1.5 pl-4 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-indigo-500/10">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && variant === "web") {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Tanya apa aja soal keuanganmu…"
              aria-label="Pesan untuk Leosiqra"
              className="max-h-[140px] min-h-[24px] flex-1 resize-none bg-transparent py-2.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              aria-label="Kirim"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-90 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
            >
              <ArrowUp size={18} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
            {variant === "web" ? "Enter untuk kirim · Shift+Enter baris baru · " : ""}AI bisa keliru — cek lagi sebelum ambil keputusan penting.
          </p>
        </div>
      </div>
    </div>
  );
}
