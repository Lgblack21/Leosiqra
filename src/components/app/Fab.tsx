"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { lightTap } from "@/lib/haptics";

interface FabProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function Fab({ onClick, isOpen = false }: FabProps) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        lightTap();
        onClick();
      }}
      aria-label="Tambah Transaksi"
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className={`fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+22px)] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-950 ${isOpen ? "" : "breathe"}`}
    >
      <motion.span
        animate={{ rotate: isOpen ? 135 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 20 }}
        className="flex items-center justify-center"
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.span>
    </motion.button>
  );
}
