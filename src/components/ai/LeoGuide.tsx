'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { AiOrb } from '@/components/ai/AiChat';
import { AiMarkdown } from '@/components/ai/AiMarkdown';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { LEO_GUIDES, type LeoAccessory, type LeoGuideTopic } from '@/lib/leoGuides';
import { cn } from '@/lib/utils';

// Aksesori Leo per halaman, digambar di atas AiOrb (koordinat viewBox 120×120 yang sama).
function Accessory({ kind }: { kind: LeoAccessory }) {
  switch (kind) {
    case 'chef':
      return (
        <g>
          <path
            d="M34 34 Q24 18 38 12 Q42 0 56 4 Q64 -2 72 6 Q88 2 88 18 Q96 26 86 34 Z"
            fill="#fff"
            stroke="#E2E8F0"
            strokeWidth="2"
          />
          <rect x="36" y="28" width="48" height="11" rx="4" fill="#fff" stroke="#E2E8F0" strokeWidth="2" />
          <path d="M48 30 V37 M60 30 V37 M72 30 V37" stroke="#F1F5F9" strokeWidth="2" />
        </g>
      );
    case 'nurse':
      return (
        <g>
          <path d="M32 30 Q32 10 60 8 Q88 10 88 30 Z" fill="#fff" stroke="#E2E8F0" strokeWidth="2" />
          <rect x="55" y="13" width="10" height="14" rx="2" fill="#F43F5E" />
          <rect x="53" y="15" width="14" height="10" rx="2" fill="#F43F5E" />
        </g>
      );
    case 'beret':
      return (
        <g>
          <ellipse cx="58" cy="22" rx="32" ry="12" fill="#EC4899" />
          <ellipse cx="58" cy="26" rx="26" ry="5" fill="#BE185D" opacity="0.35" />
          <circle cx="58" cy="10" r="4" fill="#BE185D" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path
            d="M20 64 Q18 12 60 12 Q102 12 100 64"
            stroke="#334155"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="10" y="52" width="16" height="26" rx="7" fill="#6366F1" />
          <rect x="94" y="52" width="16" height="26" rx="7" fill="#6366F1" />
        </g>
      );
    case 'sprout':
      return (
        <g>
          <path d="M60 24 V6" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="50" cy="8" rx="10" ry="6" fill="#22C55E" transform="rotate(-25 50 8)" />
          <ellipse cx="70" cy="6" rx="10" ry="6" fill="#4ADE80" transform="rotate(25 70 6)" />
        </g>
      );
    case 'glasses':
      return (
        <g>
          <circle cx="48" cy="60" r="11" fill="rgba(255,255,255,0.18)" stroke="#0F172A" strokeWidth="3" />
          <circle cx="72" cy="60" r="11" fill="rgba(255,255,255,0.18)" stroke="#0F172A" strokeWidth="3" />
          <path d="M59 60 H61 M37 58 L28 55 M83 58 L92 55" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}

export function LeoBadge({
  topic,
  size = 44,
  thinking = false,
}: {
  topic: LeoGuideTopic;
  size?: number;
  thinking?: boolean;
}) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <AiOrb size={size} thinking={thinking} />
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="pointer-events-none absolute inset-0 overflow-visible"
        aria-hidden
      >
        <Accessory kind={LEO_GUIDES[topic].accessory} />
      </svg>
    </span>
  );
}

type Msg = { role: 'user' | 'leo'; text: string };

// Tombol Leo (pojok kanan atas halaman fitur) + popup: materi singkat, pertanyaan sesuai
// halaman, dan obrolan langsung dengan Leo tanpa pindah halaman.
export function LeoGuide({ topic, className }: { topic: LeoGuideTopic; className?: string }) {
  const guide = LEO_GUIDES[topic];
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs, thinking, reduce]);

  const ask = useCallback(
    async (text: string) => {
      const prompt = text.trim().slice(0, 2000);
      if (!prompt || thinking) return;
      setInput('');
      setMsgs((m) => [...m, { role: 'user', text: prompt }]);
      setThinking(true);
      try {
        const r = await cloudflareApi<{ answer?: string }>('/api/member/ai/chat', {
          method: 'POST',
          json: { prompt, page: topic },
        });
        setMsgs((m) => [
          ...m,
          { role: 'leo', text: r.answer || 'Hmm, aku belum dapat jawabannya. Coba tanya lagi ya.' },
        ]);
      } catch (e) {
        const raw = e instanceof Error ? e.message : '';
        setMsgs((m) => [
          ...m,
          {
            role: 'leo',
            text: /batas|kuota|terlalu|gangguan|AI/i.test(raw)
              ? raw
              : 'Waduh, aku lagi ada kendala. Coba kirim ulang sebentar lagi ya.',
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, topic],
  );

  const asked = new Set(msgs.filter((m) => m.role === 'user').map((m) => m.text));
  const suggestions = guide.questions.filter((q) => !asked.has(q));

  const panel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Tutup"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Tanya ${guide.name}`}
            className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[min(720px,90dvh)] sm:max-w-[440px] sm:rounded-[28px] dark:bg-slate-900"
            initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className={cn('relative shrink-0 bg-gradient-to-br px-5 pb-5 pt-6 text-white', guide.accent)}>
              <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15" aria-hidden />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
              >
                <X size={18} />
              </button>
              <div className="relative flex items-center gap-3">
                <motion.span
                  animate={reduce ? undefined : { y: [0, -3, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <LeoBadge topic={topic} size={60} thinking={thinking} />
                </motion.span>
                <div className="min-w-0 pr-8">
                  <div className="text-[17px] font-black leading-tight">{guide.name}</div>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/90">{guide.greeting}</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {msgs.length === 0 ? (
                <div>
                  <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Materi singkat
                  </div>
                  <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
                    {guide.facts.map((f) => (
                      <div
                        key={f.title}
                        className="w-[220px] shrink-0 snap-start rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 dark:bg-slate-800/70 dark:ring-slate-800"
                      >
                        <div className="text-xl">{f.emoji}</div>
                        <div className="mt-1 text-[13px] font-bold text-slate-800 dark:text-slate-100">{f.title}</div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {f.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                msgs.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-[13px] text-white dark:bg-indigo-600">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2">
                      <LeoBadge topic={topic} size={28} />
                      <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700 ring-1 ring-slate-100 dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-800">
                        <AiMarkdown text={m.text} />
                      </div>
                    </div>
                  ),
                )
              )}
              {thinking ? (
                <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
                  <LeoBadge topic={topic} size={28} thinking /> Leo lagi mikir…
                </div>
              ) : null}

              {suggestions.length ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Sparkles size={12} /> {msgs.length ? 'Tanya lagi' : 'Tanya Leo'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={thinking}
                        onClick={() => void ask(q)}
                        className="rounded-full bg-white px-3 py-1.5 text-left text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <form
              className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 dark:border-slate-800 dark:bg-slate-900"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
                placeholder="Tanya apa aja ke Leo…"
                maxLength={2000}
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl bg-slate-100 px-3.5 py-2.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                aria-label="Kirim"
                disabled={!input.trim() || thinking}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-40 dark:bg-indigo-600"
              >
                <ArrowUp size={18} />
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Tanya ${guide.name}`}
        className={cn(
          'rounded-full ring-2 ring-white transition-transform hover:scale-105 dark:ring-slate-800',
          className,
        )}
      >
        <LeoBadge topic={topic} size={44} />
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
