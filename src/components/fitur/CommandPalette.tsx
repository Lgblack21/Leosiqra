'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { GOALS, TONE, markSeen, searchFitur, toneOf } from '@/lib/fiturCatalog';
import { cn } from '@/lib/utils';

// Ctrl/⌘ + K dari halaman mana saja (web): cari fitur lalu Enter untuk membuka.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) markSeen(pathname);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
        setSel(0);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname]);

  if (!open) return null;
  const list = searchFitur(q).slice(0, 8);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search size={19} className="text-slate-400" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(list.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter' && list[sel]) go(list[sel].href);
            }}
            placeholder="Cari fitur… (pajak, cicilan, nikah, kasir)"
            className="h-14 min-w-0 flex-1 bg-transparent fs-15.5 font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 fs-11 font-bold text-slate-500 dark:bg-slate-800">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {list.length ? (
            list.map((f, i) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(f.href)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left',
                    sel === i ? 'bg-slate-100 dark:bg-slate-800' : '',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                      TONE[toneOf(f)].tile,
                    )}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block fs-14 font-bold text-slate-900 dark:text-white">{f.label}</span>
                    <span className="block truncate fs-12 text-slate-500">
                      {GOALS.find((g) => g.id === f.goal)?.label} · {f.sub}
                    </span>
                  </span>
                  {sel === i ? <CornerDownLeft size={15} className="text-slate-400" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center fs-13.5 text-slate-500">Tidak ada fitur yang cocok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
