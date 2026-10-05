"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Layar pembuka bermerek untuk mode aplikasi (/app) dan Input Cepat — selalu
// terang (tidak ikut dark mode) supaya tiap kali app dibuka yang terlihat
// pertama adalah logo Leosiqra, bukan layar kosong/gelap. Tampil minimal
// sebentar supaya animasinya terlihat, dan dibatasi maksimal supaya tidak
// menggantung kalau jaringan lambat.
const MIN_VISIBLE_MS = 1100;
const MAX_VISIBLE_MS = 6000;

interface BrandSplashProps {
  /** true kalau konten di belakangnya sudah siap ditampilkan. */
  ready: boolean;
  /** Label kecil di bawah nama, mis. "Input Cepat". */
  badge?: string;
  /** Sapaan personal, mis. nama depan user. */
  greetingName?: string | null;
}

export function BrandSplash({ ready, badge, greetingName }: BrandSplashProps) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceHide, setForceHide] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const maxTimer = setTimeout(() => setForceHide(true), MAX_VISIBLE_MS);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  const visible = !forceHide && !(minElapsed && ready);
  const firstName = greetingName?.trim().split(/\s+/)[0] || null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="brand-splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(170deg, #FFFFFF 0%, #F9F8F6 55%, #F1EEE8 100%)", colorScheme: "light" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          aria-label="Memuat Leosiqra"
          role="status"
        >
          {/* Aksen warna merek: biru logo & emas */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 18%, rgba(30,64,175,0.12), transparent 42%), radial-gradient(circle at 85% 82%, rgba(202,138,4,0.14), transparent 46%)",
            }}
          />

          <div className="relative flex flex-col items-center px-6 text-center">
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0.7, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="absolute -inset-4 rounded-[44px] blur-2xl"
                style={{ background: "linear-gradient(135deg, rgba(30,64,175,0.28), rgba(202,138,4,0.28))" }}
                animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.96, 1.04, 0.96] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- harus tampil di HTML statis sebelum JS jalan */}
              <img
                src="/images/Logo-new.png"
                alt="Leosiqra"
                width={128}
                height={128}
                className="relative h-32 w-32 rounded-[34px] object-cover shadow-[0_24px_60px_-18px_rgba(15,23,42,0.55)] ring-1 ring-white/70"
              />
            </motion.div>

            <motion.h1
              className="font-serif text-[34px] font-black tracking-tight text-slate-900"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            >
              Leosiqra
            </motion.h1>
            <motion.p
              className="mt-1 text-[11px] font-black uppercase tracking-[0.32em] text-amber-700/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              Catatan Keuangan
            </motion.p>

            {badge && (
              <motion.span
                className="mt-4 rounded-full bg-indigo-600 px-3.5 py-1 text-xs font-black text-white shadow-lg shadow-indigo-200"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                ⚡ {badge}
              </motion.span>
            )}

            <AnimatePresence mode="wait">
              {firstName && (
                <motion.p
                  key={firstName}
                  className="mt-5 text-base font-bold text-slate-600"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  Halo, {firstName} 👋
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              className="mt-8 flex gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: i === 1 ? "#ca8a04" : "#1e40af" }}
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
