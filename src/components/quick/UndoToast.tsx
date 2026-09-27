"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Undo2, Loader2 } from "lucide-react";

export interface UndoItem {
  id: string;
  label: string;
}

interface Props {
  item: UndoItem | null;
  onUndo: (item: UndoItem) => Promise<void>;
  onDone: () => void;
  seconds?: number;
}

// Toast "Tersimpan · Batalkan" — hitung mundur, lalu hilang sendiri. Batalkan
// menghapus transaksi + membalikkan saldo secara atomik di server.
export function UndoToast({ item, onUndo, onDone, seconds = 6 }: Props) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setLeft(seconds);
    setError("");
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [item, seconds]);

  useEffect(() => {
    if (item && left <= 0 && !busy) onDone();
  }, [left, item, busy, onDone]);

  const undo = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await onUndo(item);
      onDone();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal membatalkan.");
      setLeft(4);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[60] w-[calc(100%-32px)] max-w-sm rounded-2xl bg-slate-900 text-white shadow-2xl px-4 py-3 flex items-center gap-3"
        >
          <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check size={16} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-black truncate">{error || "Tersimpan"}</span>
            <span className="block text-[11px] text-white/60 truncate">{item.label}</span>
          </span>
          <button type="button" onClick={undo} disabled={busy} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-black">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Batalkan {left > 0 && !busy ? `(${left})` : ""}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
