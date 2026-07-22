"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoImage } from "@/components/ui/LogoImage";

// Splash tetap tampil minimal sekian lama supaya animasinya sempat terlihat
// (kalau auth-check-nya kebetulan super cepat/cache), tapi dibatasi maksimal
// supaya tidak menggantung selamanya kalau network lambat/gagal.
const MIN_VISIBLE_MS = 1300;
const MAX_VISIBLE_MS = 4000;

interface SplashScreenProps {
  ready: boolean;
  userName?: string | null;
  userPhoto?: string | null;
}

// Splash foto+nama user — muncul tiap Input Cepat dibuka dari awal (app
// ditutup lalu dibuka lagi = mount baru = authState balik ke "loading").
// Untuk kasus app dibiarkan lama di background lalu dibuka lagi tanpa
// benar-benar ditutup, StaleReloadGuard sudah force-reload otomatis setelah
// idle >30 menit, jadi splash ini ikut muncul lagi lewat mount baru itu juga.
//
// Sengaja tanpa logo/nama Leosiqra sama sekali — cuma foto & nama user.
// Sebelum profilnya kebaca, avatar-nya fallback ke ikon silhouette netral
// (bukan logo brand) supaya tetap konsisten "punya user", bukan "punya app".
export function SplashScreen({ ready, userName, userPhoto }: SplashScreenProps) {
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
  const firstName = userName?.trim().split(/\s+/)[0] || null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <div
            className="absolute inset-0 opacity-70 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 20%, rgba(99,102,241,0.10), transparent 45%), radial-gradient(circle at 82% 80%, rgba(124,58,237,0.08), transparent 50%)",
            }}
          />

          <div className="relative flex flex-col items-center px-6 text-center">
            <motion.div
              layout
              className="relative mb-7 w-24 h-24"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="absolute inset-0 rounded-full bg-indigo-500/15 blur-xl"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.3, 0.6] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative w-24 h-24 rounded-full ring-4 ring-white shadow-[0_20px_50px_-15px_rgba(79,70,229,0.35)] overflow-hidden bg-gradient-to-br from-indigo-100 to-violet-100">
                {userPhoto ? (
                  <LogoImage
                    src={userPhoto}
                    alt={userName || "Profil"}
                    fallbackText={(firstName || "U").slice(0, 1).toUpperCase()}
                    className="w-24 h-24 object-cover"
                  />
                ) : firstName ? (
                  <div className="w-24 h-24 flex items-center justify-center text-3xl font-black text-indigo-600">
                    {firstName.slice(0, 1).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center text-indigo-300">
                    <User size={40} strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {firstName ? (
                <motion.div
                  key="personalized"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 [text-wrap:balance]">
                    Halo, <span className="text-gradient">{firstName}</span>
                  </h1>
                </motion.div>
              ) : (
                <motion.div
                  key="generic"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
                >
                  <p className="text-sm font-medium text-slate-400">
                    Menyiapkan akun kamu&hellip;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

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
