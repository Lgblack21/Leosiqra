"use client";

import { motion } from "framer-motion";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// Entrance halus dipakai di tiap tab (Home/Wallet/Statistik/Profil) — cuma
// transform+opacity (GPU-composited), durasi pendek, biar kerasa "hidup"
// tanpa bikin HP lag. Reusable supaya tiap halaman gak nulis ulang props
// framer-motion yang sama.
export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
}

// Wrapper container — dipasangkan dengan StaggerItem di tiap child. Cap
// stagger di masing-masing pemakaian (lihat guardrail di plan) supaya list
// panjang tetap langsung tappable, gak nunggu animasi kelar dulu.
export function StaggerList({ children, className }: StaggerListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
