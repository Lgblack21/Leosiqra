'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Flag, History, Rocket, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_BUILD, APP_VERSION } from '@/lib/version';
import type { ChangelogEntry } from '@/lib/changelog';

const ERA: Record<number, { name: string; desc: string; dot: string; chip: string }> = {
  3: {
    name: 'Leosiqra 3',
    desc: 'Tampilan baru, app HP makin lengkap, dan ekosistem usaha',
    dot: 'bg-indigo-500',
    chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  2: {
    name: 'Leosiqra 2',
    desc: 'Pindah ke Cloudflare, otomatisasi, dan aplikasi HP pertama',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  1: {
    name: 'Leosiqra 1',
    desc: 'Awal mula',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
};
const eraOf = (major: number) =>
  ERA[major] ?? {
    name: `Leosiqra ${major}`,
    desc: '',
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  };

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${BULAN[m - 1] ?? ''} ${y}`;
};

// Markdown kecil dari CHANGELOG: **tebal** dan `kode` saja.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i} className="font-semibold text-slate-900 dark:text-white">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith('`') ? (
          <code
            key={i}
            className="rounded bg-slate-100 px-1 py-px font-mono text-[0.85em] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const isMilestone = (v: string) => /\.0\.0$/.test(v);

export function VersionHistory({ entries, variant }: { entries: ChangelogEntry[]; variant: 'web' | 'app' }) {
  const majors = useMemo(() => [...new Set(entries.map((e) => e.major))], [entries]);
  const [era, setEra] = useState<number | 'all'>('all');
  const [open, setOpen] = useState<Set<string>>(() => new Set(entries.slice(0, 3).map((e) => e.version)));
  const current = entries.find((e) => e.version === APP_VERSION) ?? entries[0];
  const first = entries[entries.length - 1];
  const shown = era === 'all' ? entries : entries.filter((e) => e.major === era);
  const toggle = (v: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  const app = variant === 'app';

  return (
    <div className={cn('mx-auto pb-16', app ? 'max-w-md space-y-5 px-5 pt-6' : 'max-w-3xl space-y-6')}>
      {app ? (
        <Link
          href="/app/profile"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400"
        >
          <ArrowLeft size={16} /> Profil
        </Link>
      ) : null}

      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-xl shadow-indigo-600/20',
          app ? 'rounded-[24px] p-5' : 'rounded-[24px] p-6 md:rounded-[32px] md:p-9',
        )}
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-indigo-100">
            <History size={16} /> Riwayat versi
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h1 className={cn('font-black tracking-tight', app ? 'text-4xl' : 'text-4xl md:text-5xl')}>
              v{APP_VERSION}
            </h1>
            {APP_BUILD ? (
              <span className="mb-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold">
                build {APP_BUILD}
              </span>
            ) : null}
          </div>
          {current ? (
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-indigo-100">
              Versi kamu sekarang · {current.title} · {tgl(current.date)}
            </p>
          ) : null}
          {first ? (
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { n: entries.length, l: 'versi' },
                { n: majors.length, l: 'generasi' },
                { n: tgl(first.date).replace(/^\d+ /, ''), l: 'versi pertama' },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/12 px-2 py-2.5 backdrop-blur">
                  <div className="text-[15px] font-black leading-tight">{s.n}</div>
                  <div className="text-[11px] font-medium text-indigo-100">{s.l}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pilih generasi">
        {(['all', ...majors] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={era === m}
            onClick={() => setEra(m)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              era === m
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800',
            )}
          >
            {m === 'all' ? 'Semua' : eraOf(m).name}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
          Riwayat versi belum tersedia.
        </p>
      ) : null}

      <ol className="relative">
        {shown.map((e, i) => {
          const meta = eraOf(e.major);
          const eraStart = i === 0 || shown[i - 1].major !== e.major;
          const expanded = open.has(e.version);
          const isCurrent = e.version === current?.version;
          const milestone = isMilestone(e.version);
          const last = i === shown.length - 1;
          return (
            <Fragment key={e.version}>
              {eraStart ? (
                <li className={cn('list-none', i > 0 && 'pt-4')}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={cn(
                        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold',
                        meta.chip,
                      )}
                    >
                      {meta.name}
                    </span>
                    {meta.desc ? (
                      <span className="truncate text-[12px] text-slate-500 dark:text-slate-400">{meta.desc}</span>
                    ) : null}
                  </div>
                </li>
              ) : null}
              <li className="relative list-none pb-3 pl-8">
                {!last ? (
                  <span
                    className="absolute left-[11px] top-6 -bottom-0 w-px bg-slate-200 dark:bg-slate-800"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'absolute left-0 top-3 flex h-[23px] w-[23px] items-center justify-center rounded-full ring-4 ring-slate-50 dark:ring-slate-950',
                    milestone ? meta.dot : 'bg-white ring-slate-50 dark:bg-slate-900',
                  )}
                  aria-hidden
                >
                  {milestone ? (
                    e.version === first?.version ? (
                      <Flag size={12} className="text-white" />
                    ) : (
                      <Rocket size={12} className="text-white" />
                    )
                  ) : (
                    <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                  )}
                </span>
                <div
                  className={cn(
                    'rounded-2xl bg-white ring-1 transition-shadow dark:bg-slate-900',
                    isCurrent
                      ? 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/10 dark:ring-indigo-500'
                      : 'ring-slate-200 dark:ring-slate-800',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(e.version)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={cn(
                            'font-black tracking-tight text-slate-900 dark:text-white',
                            milestone ? 'text-[17px]' : 'text-[15px]',
                          )}
                        >
                          v{e.version}
                        </span>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            <Sparkles size={11} /> Versi kamu
                          </span>
                        ) : null}
                        <span className="text-[12px] text-slate-400 dark:text-slate-500">{tgl(e.date)}</span>
                      </div>
                      <div className="mt-0.5 text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                        {e.title}
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={cn(
                        'mt-1 shrink-0 text-slate-400 transition-transform duration-200',
                        expanded && 'rotate-180',
                      )}
                    />
                  </button>
                  {expanded && (e.intro.length > 0 || e.items.length > 0) ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
                      {e.intro.map((p, k) => (
                        <p key={k} className="mb-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                          <Inline text={p} />
                        </p>
                      ))}
                      <ul className="space-y-2">
                        {e.items.map((it, k) => (
                          <li
                            key={k}
                            className="relative pl-4 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
                          >
                            <span
                              className={cn('absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full', meta.dot)}
                              aria-hidden
                            />
                            <Inline text={it} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
