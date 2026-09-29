"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, MessageCircleReply, Send } from "lucide-react";
import { feedbackService, FEEDBACK_MAX_CHARS, type FeedbackCategory, type FeedbackItem } from "@/lib/services/feedbackService";
import { cn } from "@/lib/utils";

export const CATEGORIES: { id: FeedbackCategory; emoji: string; label: string; hint: string; placeholder: string }[] = [
  { id: "saran", emoji: "💡", label: "Saran", hint: "Ide fitur atau perbaikan", placeholder: "Contoh: tambahkan ekspor laporan bulanan ke PDF…" },
  { id: "kritik", emoji: "🗣️", label: "Kritik", hint: "Yang kurang nyaman", placeholder: "Contoh: tombol simpan di form transaksi susah ditemukan…" },
  { id: "masalah", emoji: "🐞", label: "Masalah", hint: "Ada yang error / tidak jalan", placeholder: "Ceritakan apa yang terjadi dan langkahnya — mis. saat mencatat transfer, saldo tujuan tidak bertambah…" },
  { id: "pujian", emoji: "❤️", label: "Pujian", hint: "Yang kamu suka", placeholder: "Contoh: input cepat pakai suara sangat membantu!" },
];

const MOODS = [
  { v: 1, e: "😞", t: "Kecewa" },
  { v: 2, e: "😕", t: "Kurang" },
  { v: 3, e: "😐", t: "Biasa" },
  { v: 4, e: "🙂", t: "Puas" },
  { v: 5, e: "😍", t: "Suka banget" },
];

const STATUS_LABEL: Record<FeedbackItem["status"], { text: string; tone: string }> = {
  baru: { text: "Terkirim", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  dibaca: { text: "Sudah dibaca", tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  selesai: { text: "Ditindaklanjuti", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
};

// Halaman asal (hanya dari leosiqra.com sendiri) — konteks untuk tim saat membaca.
const sameOriginReferrerPath = () => {
  try {
    const r = document.referrer ? new URL(document.referrer) : null;
    return r && r.origin === window.location.origin ? r.pathname : undefined;
  } catch {
    return undefined;
  }
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

// Formulir saran & kritik + riwayat masukan (dengan balasan admin).
// Dipakai halaman web (/membership/saran) dan aplikasi HP (/app/saran).
export function FeedbackPanel({ platform }: { platform: "web" | "app" }) {
  const reduce = useReducedMotion();
  const [category, setCategory] = useState<FeedbackCategory>("saran");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState<FeedbackItem[] | null>(null);

  const load = useCallback(() => {
    feedbackService.mine().then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  const cat = CATEGORIES.find((c) => c.id === category)!;
  const tooShort = message.trim().length < 5;

  const submit = async () => {
    if (tooShort || sending) return;
    setSending(true);
    setError("");
    try {
      await feedbackService.send({ category, rating, message: message.trim(), platform, page: sameOriginReferrerPath() });
      setSent(true);
      setMessage("");
      setRating(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim. Coba lagi ya.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <motion.span
                initial={reduce ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 12 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              >
                <Check size={30} strokeWidth={3} />
              </motion.span>
              <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Terima kasih! 🙏</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Masukanmu sudah kami terima dan akan dibaca tim Leosiqra. Balasan kami akan muncul di riwayat di bawah.
              </p>
              <button type="button" onClick={() => setSent(false)} className="mt-5 rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Kirim masukan lain
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <p className="mb-2.5 text-xs font-black uppercase tracking-widest text-slate-400">Jenis masukan</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      aria-pressed={category === c.id}
                      className={cn(
                        "relative rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98]",
                        category === c.id
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10"
                          : "border-slate-100 bg-white hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900"
                      )}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="mt-1 block text-sm font-black text-slate-900 dark:text-white">{c.label}</span>
                      <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">{c.hint}</span>
                      {category === c.id && (
                        <motion.span layoutId={`fb-check-${platform}`} className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-black uppercase tracking-widest text-slate-400">
                  Seberapa puas kamu dengan Leosiqra? <span className="normal-case tracking-normal text-slate-300">(opsional)</span>
                </p>
                <div className="flex gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      onClick={() => setRating(rating === m.v ? null : m.v)}
                      aria-label={m.t}
                      aria-pressed={rating === m.v}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all",
                        rating === m.v ? "scale-105 bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-500/10" : "bg-slate-50 opacity-70 hover:opacity-100 dark:bg-slate-800"
                      )}
                    >
                      <span className={cn("text-2xl transition-transform", rating === m.v && "scale-110")}>{m.e}</span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{m.t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor={`fb-msg-${platform}`} className="mb-2.5 block text-xs font-black uppercase tracking-widest text-slate-400">
                  Ceritakan {cat.label.toLowerCase()}mu
                </label>
                <textarea
                  id={`fb-msg-${platform}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX_CHARS))}
                  rows={5}
                  placeholder={cat.placeholder}
                  className="w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[15px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-500/10"
                />
                <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>{tooShort && message.length > 0 ? "Minimal 5 karakter" : "Masukanmu dibaca langsung oleh tim kami"}</span>
                  <span className={cn(message.length > FEEDBACK_MAX_CHARS * 0.9 && "text-amber-500")}>{message.length}/{FEEDBACK_MAX_CHARS}</span>
                </div>
              </div>

              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={tooShort || sending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.99] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Mengirim…" : "Kirim masukan"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <section>
        <h2 className="mb-3 px-1 text-sm font-black text-slate-900 dark:text-white">Riwayat masukanmu</h2>
        {items === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
            Belum ada masukan. Masukan pertamamu akan muncul di sini.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => {
              const c = CATEGORIES.find((x) => x.id === it.category);
              const st = STATUS_LABEL[it.status] ?? STATUS_LABEL.baru;
              return (
                <motion.li
                  key={it.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                  className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {c?.emoji} {c?.label} {it.rating ? `· ${MOODS[it.rating - 1]?.e}` : ""}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black", st.tone)}>{st.text}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{it.message}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{fmtDate(it.created_at)}</p>
                  {it.admin_reply && (
                    <div className="mt-3 rounded-2xl bg-indigo-50 p-3.5 dark:bg-indigo-500/10">
                      <p className="flex items-center gap-1.5 text-[11px] font-black text-indigo-700 dark:text-indigo-300">
                        <MessageCircleReply size={13} /> Balasan tim Leosiqra{it.replied_at ? ` · ${fmtDate(it.replied_at)}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">{it.admin_reply}</p>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
