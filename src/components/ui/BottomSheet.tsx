"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Threshold buat swipe-to-dismiss: cukup salah satu terpenuhi (jarak geser
// jauh ATAU geseran cepat) — dua-duanya harus dipenuhi bikin dismiss terasa
// "berat"/tidak responsif di HP.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="relative w-full max-w-md bg-white rounded-t-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="shrink-0 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>

            {title && (
              <div className="px-6 pb-3 shrink-0">
                <h3 className="text-lg font-black text-slate-900">{title}</h3>
              </div>
            )}

            <div className="px-6 pb-6 overflow-y-auto custom-scrollbar flex-1">
              {children}
            </div>

            <div className="pb-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
