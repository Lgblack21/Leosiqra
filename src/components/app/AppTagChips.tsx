"use client";

import { useState } from "react";
import { Hash, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { useTags, tagStyle, TAG_COLOR_KEYS, TAG_MAX_PER_TX } from "@/lib/useTags";

// Chip tag untuk aplikasi HP: pilih (maks TAG_MAX_PER_TX) + buat tag baru di
// tempat (masuk daftar tag akun lewat prefs, sama dengan TagPicker web). Tag
// lama di transaksi yang sudah dihapus dari daftar tetap tampil & bisa dilepas.
export function AppTagChips({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const { tags, save } = useTags();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const has = (n: string) => value.some((v) => v.toLowerCase() === n.toLowerCase());
  const full = value.length >= TAG_MAX_PER_TX;

  const toggle = (n: string) => {
    lightTap();
    setError("");
    if (has(n)) onChange(value.filter((v) => v.toLowerCase() !== n.toLowerCase()));
    else if (!full) onChange([...value, n]);
    else setError(`Maksimal ${TAG_MAX_PER_TX} tag per transaksi.`);
  };

  const create = async () => {
    const name = draft.replace(/\s+/g, " ").trim().slice(0, 24);
    if (!name || saving) return;
    setError("");
    const existing = tags.list.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      setSaving(true);
      try {
        await save({ enabled: true, list: [...tags.list, { name, color: TAG_COLOR_KEYS[tags.list.length % TAG_COLOR_KEYS.length] }] });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "Gagal membuat tag.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    const finalName = existing?.name ?? name;
    if (!has(finalName)) {
      if (full) setError(`Maksimal ${TAG_MAX_PER_TX} tag per transaksi.`);
      else onChange([...value, finalName]);
    }
    setDraft("");
    setAdding(false);
  };

  const names = [
    ...tags.list.map((t) => t.name),
    ...value.filter((v) => !tags.list.some((t) => t.name.toLowerCase() === v.toLowerCase())),
  ];

  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1" aria-label="Tag">
        {names.map((n) => {
          const on = has(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(n)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 transition-colors",
                on ? tagStyle(tags.list.find((t) => t.name === n)?.color).chip : "bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-700"
              )}
            >
              <Hash size={11} strokeWidth={3} /> {n}
            </button>
          );
        })}
        {adding ? (
          <form
            onSubmit={(e) => { e.preventDefault(); void create(); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white py-0.5 pl-3 pr-0.5 ring-1 ring-indigo-300 dark:bg-slate-900 dark:ring-indigo-500/50"
          >
            <Hash size={11} strokeWidth={3} className="text-indigo-500" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { if (!draft.trim()) setAdding(false); }}
              maxLength={24}
              placeholder="Nama tag"
              aria-label="Nama tag baru"
              enterKeyHint="done"
              className="w-24 bg-transparent text-[12px] font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white"
            />
            <button type="submit" disabled={!draft.trim() || saving} className="flex h-7 items-center rounded-full bg-indigo-600 px-2.5 text-[11px] font-black text-white disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Tambah"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { lightTap(); setError(""); setAdding(true); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-indigo-600 ring-1 ring-dashed ring-indigo-200 dark:text-indigo-400 dark:ring-indigo-500/40"
          >
            <Plus size={12} strokeWidth={3} /> Tag baru
          </button>
        )}
      </div>
      {error && <p className="px-1 text-[11px] font-bold text-rose-500">{error}</p>}
    </div>
  );
}
