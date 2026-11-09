'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { db, auth } from '@/lib/cf-client';
import { categoryVisual, useCategoryKinds, useCategoryStyles } from '@/lib/categoryEmoji';
import { lightTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

type CategoryRow = { id: string; category: string; subCategory: string };

interface CategoryGridProps {
  type: 'pengeluaran' | 'pemasukan';
  value: string;
  subValue: string;
  onChange: (category: string, subCategory: string) => void;
  // Riwayat transaksi untuk mengurutkan kategori yang paling sering dipakai.
  history: { type: string; category: string }[];
  /** "row": satu baris ikon bulat yang bisa digeser (sheet Tambah Transaksi);
   * "Lainnya" membuka semua kategori sebagai petak. */
  layout?: 'grid' | 'row';
  /** Warna cincin kategori terpilih (ikut jenis transaksi). */
  activeRing?: string;
  /** Opsional: buka/tutup daftar penuh dari luar (mis. pil kategori di panel atas). */
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}

const COLLAPSED = 7; // 2 baris × 4, petak ke-8 = "Lainnya"

// Pemilih kategori satu ketukan untuk sheet Tambah Transaksi di app HP: petak
// ikon, yang paling sering dipakai di depan. Data & aturan jenis sama dengan
// CategorySelect (nama kategori sebagai nilai, jenis berlawanan disembunyikan).
export function CategoryGrid({
  type,
  value,
  subValue,
  onChange,
  history,
  layout = 'grid',
  activeRing = 'ring-indigo-500',
  expanded: expandedProp,
  onExpandedChange,
}: CategoryGridProps) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [innerExpanded, setInnerExpanded] = useState(false);
  const expanded = expandedProp ?? innerExpanded;
  const setExpanded = (next: boolean | ((v: boolean) => boolean)) => {
    const v = typeof next === 'function' ? next(expanded) : next;
    if (onExpandedChange) onExpandedChange(v);
    else setInnerExpanded(v);
  };
  const [subFor, setSubFor] = useState<string | null>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const kinds = useCategoryKinds();
  useCategoryStyles(); // gambar ulang saat ikon pilihan user dimuat

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoryRow)),
      () => undefined,
    );
  }, []);

  const subOptions = (name: string) =>
    Array.from(
      new Set(
        rows
          .filter((r) => r.category === name)
          .flatMap((r) => (r.subCategory || '').split(','))
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

  const names = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
    const shown = unique.filter((n) => n === value || !kinds[n] || kinds[n] === type);
    const freq = new Map<string, number>();
    for (const t of history) if (t.type === type) freq.set(t.category, (freq.get(t.category) ?? 0) + 1);
    return shown.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b, 'id'));
  }, [rows, kinds, type, history, value]);

  // Baris ringkas: geser sampai kategori terpilih terlihat (mis. baru dipilih dari "Lainnya").
  useEffect(() => {
    if (layout !== 'row' || expanded) return;
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && el) row.scrollTo({ left: Math.max(0, el.offsetLeft - 12), behavior: 'smooth' });
  }, [value, expanded, layout]);
  // Ganti jenis Keluar/Masuk → tutup pilihan sub yang terbuka.
  useEffect(() => setSubFor(null), [type]);
  // Pilihan sub bisa jatuh di bawah keypad — gulir sampai terlihat.
  useEffect(() => {
    if (subFor) subRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [subFor]);

  let visible = expanded ? names : names.slice(0, COLLAPSED);
  // Kategori terpilih (mis. dari ketik pintar) selalu terlihat.
  if (!expanded && value && names.includes(value) && !visible.includes(value))
    visible = [...visible.slice(0, COLLAPSED - 1), value];
  const hasMore = names.length > COLLAPSED;

  const pick = (name: string) => {
    lightTap();
    const subs = subOptions(name);
    if (subs.length > 1) {
      setSubFor(subFor === name ? null : name);
      if (value !== name) onChange(name, '');
      return;
    }
    setSubFor(null);
    setExpanded(false); // kembali ringkas; yang terpilih tetap terlihat
    onChange(name, subs[0] ?? '');
  };

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs font-medium text-slate-400 dark:text-slate-500">Memuat kategori…</p>;
  }
  if (names.length === 0) {
    return (
      <p className="py-6 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
        Belum ada kategori {type === 'pemasukan' ? 'pemasukan' : 'pengeluaran'}.
      </p>
    );
  }

  const subs = subFor ? subOptions(subFor) : [];
  const subPills = (
    <>
      {subFor && subs.length > 0 && (
        <div
          ref={subRef}
          className={cn('flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 scroll-mb-4', layout === 'row' && 'px-4')}
        >
          {subs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                lightTap();
                onChange(subFor, s);
                setSubFor(null);
                setExpanded(false);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 fs-12 font-bold',
                value === subFor && subValue === s
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (layout === 'row') {
    // Ringkas: satu baris geser, yang terpilih ditaruh paling depan kalau tidak kelihatan.
    const ROW = 7;
    let rowNames = names.slice(0, ROW);
    if (value && names.includes(value) && !rowNames.includes(value)) rowNames = [value, ...rowNames.slice(0, ROW - 1)];
    const list = expanded ? names : rowNames;
    const tileBtn = (name: string) => {
      const active = value === name;
      const { emoji, tile } = categoryVisual(name, type);
      return (
        <button
          key={name}
          type="button"
          onClick={() => pick(name)}
          aria-pressed={active}
          className={cn(
            'flex flex-col items-center gap-1.5 active:scale-95 transition-transform',
            expanded ? 'py-1' : 'w-[68px] shrink-0 snap-start',
          )}
        >
          <span
            className={cn(
              'flex h-[50px] w-[50px] items-center justify-center rounded-full fsh-23 transition-all duration-200 dark:bg-slate-800',
              tile,
              active &&
                cn('ring-2 ring-offset-[3px] ring-offset-white dark:ring-offset-slate-900 scale-110', activeRing),
            )}
          >
            {emoji}
          </span>
          <span
            className={cn(
              'w-full truncate px-0.5 text-center fs-11.5 leading-tight',
              active ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-500 dark:text-slate-400',
            )}
          >
            {name}
          </span>
        </button>
      );
    };
    const moreBtn = names.length > ROW && (
      <button
        type="button"
        onClick={() => {
          lightTap();
          setExpanded((v) => !v);
        }}
        className={cn(
          'flex flex-col items-center gap-1.5 active:scale-95 transition-transform',
          expanded ? 'py-1' : 'w-[68px] shrink-0 snap-start',
        )}
      >
        <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-slate-100 text-lg font-black text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {expanded ? '−' : '•••'}
        </span>
        <span className="fs-11.5 font-semibold text-slate-500 dark:text-slate-400">
          {expanded ? 'Ringkas' : 'Lainnya'}
        </span>
      </button>
    );
    return (
      <div className="space-y-2">
        {expanded ? (
          <div className="grid grid-cols-4 gap-x-1 gap-y-3 px-3 pt-1">
            {list.map(tileBtn)}
            {moreBtn}
          </div>
        ) : (
          <div ref={rowRef} className="relative flex gap-1 overflow-x-auto no-scrollbar snap-x px-3 pt-2 pb-1">
            {list.map(tileBtn)}
            {moreBtn}
          </div>
        )}
        {subPills}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-x-1 gap-y-2">
        {visible.map((name) => {
          const active = value === name;
          const { emoji, tile } = categoryVisual(name, type);
          return (
            <button
              key={name}
              type="button"
              onClick={() => pick(name)}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 active:scale-95 transition-transform"
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-2xl fsh-22 transition-all dark:bg-slate-800',
                  tile,
                  active
                    ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105'
                    : 'opacity-90',
                )}
              >
                {emoji}
              </span>
              <span
                className={cn(
                  'w-full truncate px-0.5 text-center fs-11 leading-tight',
                  active
                    ? 'font-black text-indigo-600 dark:text-indigo-400'
                    : 'font-semibold text-slate-600 dark:text-slate-300',
                )}
              >
                {name}
              </span>
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => {
              lightTap();
              setExpanded((v) => !v);
            }}
            className="flex flex-col items-center gap-1 rounded-2xl py-1.5 active:scale-95 transition-transform"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {expanded ? '−' : '⋯'}
            </span>
            <span className="fs-11 font-semibold text-slate-500 dark:text-slate-400">
              {expanded ? 'Ringkas' : 'Lainnya'}
            </span>
          </button>
        )}
      </div>

      {subFor && subs.length > 0 && (
        <div ref={subRef} className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 scroll-mb-4">
          {subs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                lightTap();
                onChange(subFor, s);
                setSubFor(null);
                setExpanded(false);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 fs-12 font-bold',
                value === subFor && subValue === s
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {value && subValue && !subFor && (
        <p className="text-center fs-11 font-bold text-indigo-600 dark:text-indigo-400">
          {value} › {subValue}
        </p>
      )}
    </div>
  );
}
