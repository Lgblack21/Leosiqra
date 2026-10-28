"use client";

import { useState } from 'react';
import { Plus, Check, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags, tagStyle, TAG_COLOR_KEYS, TAG_MAX_PER_TX } from '@/lib/useTags';
import { useFeedback } from '@/components/ui/Feedback';

export function TagChip({ name, color, className }: { name: string; color?: string; className?: string }) {
  const st = tagStyle(color);
  return (
    <span className={cn('inline-flex max-w-[160px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', st.chip, className)}>
      <Hash size={10} strokeWidth={3} className="shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

// Pilih tag untuk satu transaksi (maks TAG_MAX_PER_TX). Tag baru bisa dibuat
// langsung di sini — otomatis masuk daftar tag akun.
export function TagPicker({ value, onChange, className }: { value: string[]; onChange: (next: string[]) => void; className?: string }) {
  const { tags, save } = useTags();
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const has = (n: string) => value.some((v) => v.toLowerCase() === n.toLowerCase());
  const full = value.length >= TAG_MAX_PER_TX;

  const toggle = (n: string) => {
    if (has(n)) onChange(value.filter((v) => v.toLowerCase() !== n.toLowerCase()));
    else if (!full) onChange([...value, n]);
    else toast.error(`Maksimal ${TAG_MAX_PER_TX} tag per transaksi.`);
  };

  const create = async () => {
    const name = draft.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!name) return;
    const existing = tags.list.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      try {
        await save({ ...tags, list: [...tags.list, { name, color: TAG_COLOR_KEYS[tags.list.length % TAG_COLOR_KEYS.length] }] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal membuat tag.');
        return;
      }
    }
    if (!has(existing?.name ?? name) && !full) onChange([...value, existing?.name ?? name]);
    setDraft('');
    setAdding(false);
  };

  // Tag lama di transaksi yang sudah dihapus dari daftar tetap tampil & bisa dilepas.
  const names = [...tags.list.map((t) => t.name), ...value.filter((v) => !tags.list.some((t) => t.name.toLowerCase() === v.toLowerCase()))];

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {names.map((n) => {
        const on = has(n);
        const st = tagStyle(tags.list.find((t) => t.name === n)?.color);
        return (
          <button key={n} type="button" onClick={() => toggle(n)} aria-pressed={on} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 transition', on ? st.chip : 'bg-white text-slate-500 ring-slate-200 hover:text-slate-700')}>
            {on ? <Check size={12} strokeWidth={3} /> : <Hash size={11} strokeWidth={3} />}
            {n}
          </button>
        );
      })}
      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-white py-0.5 pl-2.5 pr-0.5 ring-1 ring-indigo-300">
          <Hash size={11} className="text-indigo-500" />
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 24))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void create(); }
              if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); }
            }}
            placeholder="tag baru"
            className="w-24 bg-transparent text-[12px] outline-none"
          />
          <button type="button" onClick={() => void create()} aria-label="Simpan tag" className="rounded-full bg-indigo-600 p-1 text-white"><Check size={12} strokeWidth={3} /></button>
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[12px] font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
          <Plus size={12} /> Tag
        </button>
      )}
    </div>
  );
}
