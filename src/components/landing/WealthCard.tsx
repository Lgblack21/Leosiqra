"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { CountUp } from "./CountUp";

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// Garis pertumbuhan (koordinat viewBox 320×110) — digambar pelan saat tampil.
const LINE = "M0,92 C28,88 40,70 64,72 C92,74 100,54 128,50 C156,46 166,60 192,48 C220,36 232,20 260,24 C284,27 300,12 320,8";

const ROWS = [
  { name: "BCA Platinum", tag: "Rekening", value: 145_494_000 },
  { name: "Deposito BCA", tag: "Jatuh tempo 10 Agu", value: 350_000_000 },
  { name: "BBCA · 1.200 lembar", tag: "+8,3%", value: 11_880_000, up: true },
];

// Kartu "kekayaan" hitam-kaca di hero. Miring 3D mengikuti kursor (desktop).
export function WealthCard() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-11, 11]), { stiffness: 120, damping: 18 });
  const glowX = useTransform(mx, [-0.5, 0.5], ["15%", "85%"]);
  const glowY = useTransform(my, [-0.5, 0.5], ["10%", "90%"]);

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); };

  return (
    <div className="relative [perspective:1400px]" onPointerMove={onMove} onPointerLeave={reset} ref={ref}>
      <motion.div
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="lux-card relative rounded-[28px] p-6 sm:p-7 overflow-hidden"
      >
        {/* Kilau mengikuti kursor */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[28px] opacity-60"
          style={{ background: useTransform([glowX, glowY], ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, rgba(214,182,126,0.16), transparent 60%)`) }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--lux-muted)]">Total kekayaan</p>
            <p className="mt-2 whitespace-nowrap font-serif text-[1.75rem] min-[400px]:text-[2rem] sm:text-[2.5rem] leading-none text-[var(--lux-ivory)] tabular-nums">
              <CountUp to={1_284_500_000} format={rupiah} />
            </p>
            <p className="mt-2 text-xs font-bold text-emerald-400/90">▲ 12,4% tahun ini</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--lux-line)] px-2.5 py-1 text-[10px] font-bold text-[var(--lux-gold)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lux-gold)] animate-pulse" /> Live
          </div>
        </div>

        <div className="relative mt-5">
        <svg viewBox="0 0 320 110" preserveAspectRatio="none" className="block w-full h-24 sm:h-28 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="lux-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d6b67e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#d6b67e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lux-stroke" x1="0" x2="1">
              <stop offset="0%" stopColor="#9c7641" />
              <stop offset="100%" stopColor="#f3e3c3" />
            </linearGradient>
          </defs>
          <motion.path
            d={`${LINE} L320,110 L0,110 Z`}
            fill="url(#lux-area)"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.9 }}
          />
          <motion.path
            d={LINE}
            fill="none"
            stroke="url(#lux-stroke)"
            strokeWidth={2.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </svg>
        {/* Titik ujung sebagai elemen HTML supaya tetap bulat walau SVG diregangkan. */}
        <motion.span
          aria-hidden
          className="absolute right-0 top-[7%] h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#f3e3c3] shadow-[0_0_16px_4px_rgba(243,227,195,0.45)]"
          initial={reduce ? false : { scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 2.3, type: "spring" }}
        />
        </div>

        <ul className="relative mt-4 divide-y divide-[var(--lux-line)]">
          {ROWS.map((r, i) => (
            <motion.li
              key={r.name}
              className="flex items-center justify-between py-3"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1 + i * 0.15, duration: 0.6 }}
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--lux-ivory)]">{r.name}</span>
                <span className={r.up ? "block text-[11px] text-emerald-400/90" : "block text-[11px] text-[var(--lux-muted)]"}>{r.tag}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-[var(--lux-ivory)]">{rupiah(r.value)}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
