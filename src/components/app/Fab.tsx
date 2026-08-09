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
      whileTap={{ scale: 0.9 }}
      className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+22px)] w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300/50 flex items-center justify-center"
    >
      <motion.span
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center justify-center"
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.span>
    </motion.button>
  );
}
