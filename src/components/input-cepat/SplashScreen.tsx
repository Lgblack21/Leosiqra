"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

// Splash tetap tampil minimal sekian lama supaya animasinya sempat terlihat
// (kalau auth-check-nya kebetulan super cepat/cache), tapi dibatasi maksimal
// supaya tidak menggantung selamanya kalau network lambat/gagal.
const MIN_VISIBLE_MS = 1300;
const MAX_VISIBLE_MS = 4000;

// Splash "Welcome to Leosiqra" — muncul tiap Input Cepat dibuka dari awal
// (app ditutup lalu dibuka lagi = mount baru = authState balik ke "loading").
// Untuk kasus app dibiarkan lama di background lalu dibuka lagi tanpa
// benar-benar ditutup, StaleReloadGuard sudah force-reload otomatis setelah
// idle >30 menit, jadi splash ini ikut muncul lagi lewat mount baru itu juga.
export function SplashScreen({ ready }: { ready: boolean }) {
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-[#161b33] to-slate-950"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 82% 80%, rgba(124,58,237,0.28), transparent 50%)",
            }}
          />

          <div className="relative flex flex-col items-center px-6 text-center">
            <motion.div
              className="relative mb-7 w-24 h-24"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="absolute inset-0 rounded-3xl bg-indigo-500/30 blur-xl"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.3, 0.6] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative w-24 h-24 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(99,102,241,0.65)] flex items-center justify-center overflow-hidden">
                <Image
                  src="/images/Logo-new.png"
                  alt="Leosiqra"
                  width={72}
                  height={72}
                  className="object-contain animate-logo-bob"
                  priority
                />
              </div>
            </motion.div>

            <motion.h1
              className="text-2xl sm:text-3xl font-serif font-black text-white [text-wrap:balance]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
            >
              Welcome to <span className="text-gradient">Leosiqra</span>
            </motion.h1>

            <motion.p
              className="mt-2 text-sm font-medium text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              Menyiapkan Input Cepat kamu&hellip;
            </motion.p>

            <motion.div
              className="mt-8 flex gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
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
