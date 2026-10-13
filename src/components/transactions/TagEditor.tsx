"use client";

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Plus, X } from 'lucide-react';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { normalizeTag, txTags } from '@/lib/txSource';
import { useFeedback } from '@/components/ui/Feedback';

// Tag bebas di satu transaksi (mis. #liburan-bali, #kantor). Tersimpan langsung.
export function TagEditor({ tx, suggestions = [] }: { tx: Transaction; suggestions?: string[] }) {
  const { toast } = useFeedback();
  const [tags, setTags] = useState<string[]>(() => txTags(tx));
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');

  const save = async (next: string[]) => {
    const prev = tags;
    setTags(next);
    try {
      await transactionService.updateTransaction(tx.id!, { tags: next });
    } catch (e) {
      setTags(prev);
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan tag.');
    }
  };
  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t || tags.includes(t) || tags.length >= 8) return;
    void save([...tags, t]);
    setText('');
  };
  const sugg = suggestions.filter((s) => !tags.includes(s) && (!text || s.includes(normalizeTag(text)))).slice(0, 6);

  return (
    <div className="rounded-2xl bg-slate-50/80 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Hash size={15} /> Tag</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AnimatePresence initial={false}>
          {tags.map((t) => (
            <motion.span key={t} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              #{t}
              <button type="button" aria-label={`Hapus tag ${t}`} onClick={() => save(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-indigo-100"><X size={11} /></button>
            </motion.span>
          ))}
        </AnimatePresence>
        {adding ? (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
              if (e.key === 'Escape') { setAdding(false); setText(''); }
            }}
            onBlur={() => { if (text) add(text); setAdding(false); }}
            placeholder="liburan-bali"
            aria-label="Tag baru"
            className="w-32 rounded-full bg-white px-3 py-1 text-xs outline-none ring-1 ring-indigo-200"
          />
        ) : tags.length < 8 && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"><Plus size={11} /> Tag</button>
        )}
      </div>
      {adding && sugg.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sugg.map((s) => <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); add(s); }} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200 hover:text-slate-900">#{s}</button>)}
        </div>
      )}
    </div>
  );
}
