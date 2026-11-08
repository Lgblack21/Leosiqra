'use client';

import { Check, ChevronRight, Lock, Trash2 } from 'lucide-react';
import { rp, type Metrics } from '@/lib/kanvas/data';
import {
  cardState,
  chapterProgress,
  type Card,
  type CardState,
  type Chapter,
  type Color,
  type Saran,
  type StateLike,
  type TableKind,
  type Template,
  type Ctx,
  type Calc,
} from '@/lib/kanvas/templates';
import type { CanvasState, NoteColor } from '@/lib/kanvas/service';
import { cn } from '@/lib/utils';

export const COLORS: Record<Color, { head: string; stroke: string }> = {
  indigo: { head: 'from-indigo-500 to-violet-500', stroke: '#6366f1' },
  emerald: { head: 'from-emerald-500 to-teal-500', stroke: '#10b981' },
  amber: { head: 'from-amber-400 to-orange-500', stroke: '#f59e0b' },
  rose: { head: 'from-rose-500 to-pink-500', stroke: '#f43f5e' },
  sky: { head: 'from-sky-500 to-cyan-500', stroke: '#0ea5e9' },
  violet: { head: 'from-violet-500 to-fuchsia-500', stroke: '#8b5cf6' },
  teal: { head: 'from-teal-500 to-emerald-500', stroke: '#14b8a6' },
};

export const KIND_LABEL: Record<Card['kind'], string> = {
  data: 'Dari catatanmu',
  tanya: 'Tanya',
  cek: 'Cek keuangan',
  tugas: 'Tugas',
  angka: 'Isi angka',
  hitung: 'Hitungan',
  info: 'Perlu tahu',
};

export const STATUS_PILL: Record<'aman' | 'waspada' | 'bahaya', { label: string; cls: string }> = {
  aman: { label: 'Aman', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  waspada: { label: 'Waspada', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  bahaya: { label: 'Perlu perhatian', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
};
export const TONE_CLS: Record<NonNullable<Calc['tone']>, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
};

export const fmtNum = (v: number, unit: string) =>
  unit === 'rp'
    ? rp(v)
    : `${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${{ bulan: 'bulan', tahun: 'tahun', persen: '%', kali: '×' }[unit] ?? ''}`.trim();

export const cardTitle = (c: Card) => (c.kind === 'tanya' ? c.q : c.kind === 'info' ? c.label : c.label);

function StatusLine({ card, st, s, m, c }: { card: Card; st: CardState; s: StateLike; m: Metrics; c: Ctx }) {
  if (st === 'answered') {
    const text =
      card.kind === 'tanya' ? s.answers[card.id] : card.kind === 'angka' ? fmtNum(s.nums[card.id], card.unit) : 'Sudah';
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <Check size={11} strokeWidth={3.5} className="text-white" />
        </span>
        <span className="line-clamp-2">{text}</span>
      </span>
    );
  }
  if (st === 'skipped') return <span className="text-[12px] text-slate-400">Dilewati dulu</span>;
  if (card.kind === 'data') {
    if (st === 'waiting')
      return <span className="text-[12px] text-slate-400">{m.ready ? `Siap ${m.readyLabel}` : 'Memuat…'}</span>;
    return (
      <span className="text-[16px] font-black tracking-tight text-slate-900 dark:text-white">
        {rp(card.value(m) ?? 0)}
      </span>
    );
  }
  if (card.kind === 'cek') {
    const r = card.calc(m);
    if (!r) return <span className="text-[12px] text-slate-400">{m.ready ? `Siap ${m.readyLabel}` : 'Memuat…'}</span>;
    return (
      <span className="block space-y-1">
        <span className="block text-[12px] text-slate-500 dark:text-slate-400">{r.text}</span>
        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_PILL[r.status].cls)}>
          {STATUS_PILL[r.status].label}
        </span>
      </span>
    );
  }
  if (card.kind === 'hitung') {
    const r = card.calc(c);
    return r ? (
      <span className={cn('text-[15px] font-black', r.tone ? TONE_CLS[r.tone] : 'text-slate-900 dark:text-white')}>
        {r.value}
      </span>
    ) : (
      <span className="text-[12px] text-slate-400">Menunggu angka</span>
    );
  }
  if (card.kind === 'info') return <span className="line-clamp-2 text-[12px] text-slate-500">{card.text}</span>;
  return <span className="text-[12px] text-slate-400">Belum dijawab</span>;
}

function Ring({ got, total, done }: { got: number; total: number; done: boolean }) {
  const r = 15;
  const len = 2 * Math.PI * r;
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={done ? 'stroke-indigo-500' : 'stroke-indigo-400'}
          strokeDasharray={`${total ? (got / total) * len : 0} ${len}`}
        />
      </svg>
      <span className="text-[10.5px] font-black tabular-nums text-slate-700 dark:text-slate-200">
        {got}/{total}
      </span>
    </span>
  );
}

export function ChapterNode({
  ch,
  index,
  s,
  c,
  selected,
  onOpen,
}: {
  ch: Chapter;
  index: number;
  s: StateLike;
  c: Ctx;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const p = chapterProgress(ch, s, c.m);
  return (
    <div
      className={cn(
        'rounded-[24px] p-2.5 ring-1 transition-colors',
        p.done
          ? 'bg-indigo-50/90 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30'
          : 'bg-slate-100/80 ring-slate-200 dark:bg-slate-900/80 dark:ring-slate-800',
      )}
    >
      <div
        data-handle={ch.id}
        className="flex cursor-grab items-center gap-2 px-1.5 pb-2.5 pt-1 active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-slate-400">
            Bab {index + 1} <span className="ml-0.5">{ch.emoji}</span>
          </p>
          <p className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">{ch.title}</p>
        </div>
        <Ring got={p.got} total={p.total} done={p.done} />
      </div>
      <div className="space-y-2">
        {ch.cards.map((card) => {
          const st = cardState(card, s, c.m);
          return (
            <button
              key={card.id}
              type="button"
              data-card={card.id}
              onClick={() => onOpen(card.id)}
              className={cn(
                'block w-full rounded-2xl bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,.06)] ring-1 transition hover:ring-slate-300 dark:bg-slate-950 dark:hover:ring-slate-600',
                selected === card.id
                  ? 'ring-2 ring-indigo-500 dark:ring-indigo-400'
                  : 'ring-slate-200/80 dark:ring-slate-800',
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {card.kind === 'data' && st === 'auto' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ) : null}
                {KIND_LABEL[card.kind]}
              </span>
              <span className="mt-1 block text-[13.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">
                {cardTitle(card)}
              </span>
              <span className="mt-1.5 block">
                <StatusLine card={card} st={st} s={s} m={c.m} c={c} />
              </span>
            </button>
          );
        })}
      </div>
      {p.done ? (
        <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
          <Check size={12} strokeWidth={3} /> Bab selesai
        </span>
      ) : null}
    </div>
  );
}

function Row({ l, v, b, tone }: { l: string; v: number | null; b?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3 border-t border-slate-100 py-2 text-[13px] dark:border-slate-800',
        b && 'font-black',
      )}
    >
      <span className={b ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>{l}</span>
      <span
        className={cn(
          'font-bold tabular-nums',
          v === null
            ? 'text-slate-300'
            : tone === 'neg'
              ? 'text-rose-600'
              : tone === 'pos'
                ? 'text-emerald-600'
                : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {v === null ? '—' : rp(v)}
      </span>
    </div>
  );
}

export function TableNode({ kind, m, a }: { kind: TableKind; m: Metrics; a: Record<string, string> }) {
  const has = m.ready && m.months > 0;
  const title = kind === 'aruskas' ? 'Arus Kas Keluarga' : kind === 'neraca' ? 'Neraca Keluarga' : 'Daftar Utang';
  const sub =
    kind === 'aruskas'
      ? has
        ? `Rata-rata ${m.months} bulan penuh terakhir`
        : 'Terisi setelah sebulan penuh catatan'
      : 'Hari ini, dari Kekayaan';
  return (
    <div
      data-handle={`tbl-${kind}`}
      className="cursor-grab rounded-[22px] bg-white p-4 shadow-[0_10px_30px_-14px_rgba(15,23,42,.3)] ring-1 ring-slate-200 active:cursor-grabbing dark:bg-slate-950 dark:ring-slate-800"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tabel</p>
      <p className="text-[17px] font-black text-slate-900 dark:text-white">{title}</p>
      <p className="mb-1.5 text-[12px] text-slate-400">{sub}</p>
      {kind === 'aruskas' ? (
        <>
          <Row l="Pemasukan" v={has ? m.incomeAvg : null} />
          <Row l="Kebutuhan" v={has ? m.split.kebutuhan : null} tone="neg" />
          <Row l="Cicilan" v={has ? m.split.cicilan : null} tone="neg" />
          <Row l="Investasi" v={has ? m.split.investasi : null} />
          <Row
            l={a['nk-bantu'] === 'Ada' ? 'Sosial (termasuk bantuan keluarga)' : 'Sosial'}
            v={has ? m.split.sosial : null}
            tone="neg"
          />
          <Row
            l="Sisa"
            v={has ? m.incomeAvg - m.split.kebutuhan - m.split.cicilan - m.split.investasi - m.split.sosial : null}
            b
            tone="pos"
          />
        </>
      ) : kind === 'neraca' ? (
        <>
          <Row l="Aset" v={m.ready ? m.assets : null} />
          <Row l="Utang jangka pendek (kartu kredit)" v={m.ready ? m.cards : null} tone="neg" />
          <Row l="Utang lainnya" v={m.ready ? m.hutang : null} tone="neg" />
          <Row l="Kekayaan bersih" v={m.ready ? m.net : null} b tone={m.net >= 0 ? 'pos' : 'neg'} />
        </>
      ) : m.debts.length ? (
        <>
          {m.debts.slice(0, 8).map((d, i) => (
            <Row key={i} l={d.name} v={d.remaining} tone="neg" />
          ))}
          <Row l="Total" v={m.liabilities} b tone="neg" />
        </>
      ) : (
        <p className="border-t border-slate-100 pt-2 text-[13px] text-slate-500 dark:border-slate-800">
          Tidak ada utang tercatat 🎉
        </p>
      )}
    </div>
  );
}

export function StartNode({ text }: { text: string }) {
  const chars = text.split('');
  return (
    <div data-handle="mulai" className="relative h-[108px] w-[108px] cursor-grab active:cursor-grabbing">
      <svg viewBox="0 0 108 108" className="absolute inset-0 animate-[spin_24s_linear_infinite]">
        {chars.map((ch, i) => (
          <text
            key={i}
            x="54"
            y="10"
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-black dark:fill-slate-400"
            transform={`rotate(${(i * 360) / chars.length} 54 54)`}
          >
            {ch}
          </text>
        ))}
      </svg>
      <span className="absolute inset-[26px] flex items-center justify-center rounded-full bg-slate-900 text-[24px] text-white shadow-lg dark:bg-white dark:text-slate-900">
        ↓
      </span>
    </div>
  );
}

export function FinalNode({
  t,
  c,
  prog,
  saran,
  onSaran,
}: {
  t: Template;
  c: Ctx;
  prog: { got: number; total: number; babDone: number; babTotal: number };
  saran: Saran[];
  onSaran: (s: Saran) => void;
}) {
  const unlocked = prog.babDone === prog.babTotal;
  const g = t.goal?.(c) ?? null;
  return (
    <div
      data-handle="akhir"
      className="cursor-grab rounded-[24px] bg-white p-5 shadow-[0_18px_40px_-16px_rgba(15,23,42,.35)] ring-1 ring-slate-200 active:cursor-grabbing dark:bg-slate-950 dark:ring-slate-800"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {unlocked ? <Check size={12} strokeWidth={3} className="text-emerald-500" /> : <Lock size={11} />} Selesai
      </p>
      <p className="mt-0.5 text-[19px] font-black text-slate-900 dark:text-white">
        {t.emoji} {t.finalTitle}
      </p>
      <p className="text-[12.5px] text-slate-500">
        {unlocked ? 'Semua bab selesai — ini langkah berikutnya.' : `Terbuka setelah ${prog.babTotal} bab selesai`}
      </p>
      {g ? (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          <p className={cn('text-[19px] font-black', g.tone ? TONE_CLS[g.tone] : 'text-slate-900 dark:text-white')}>
            {g.value}
          </p>
          {g.note ? <p className="text-[12px] text-slate-500">{g.note}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${prog.total ? (prog.got / prog.total) * 100 : 0}%` }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-slate-500">
        {prog.babDone} dari {prog.babTotal} bab · {prog.got} dari {prog.total} kartu
      </p>
      {saran.length ? (
        <div className="mt-3 space-y-1.5">
          {saran.slice(0, 6).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSaran(s)}
              className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="flex-1">{s.text}</span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Hitungan ini perkiraan untuk membantu merencanakan, bukan nasihat keuangan pribadi.
      </p>
    </div>
  );
}

export const NOTE_BG: Record<NoteColor, string> = {
  kuning: 'bg-amber-100 dark:bg-amber-300/90',
  hijau: 'bg-emerald-100 dark:bg-emerald-300/90',
  biru: 'bg-sky-100 dark:bg-sky-300/90',
  pink: 'bg-pink-100 dark:bg-pink-300/90',
  ungu: 'bg-violet-100 dark:bg-violet-300/90',
};

export function NoteNode({
  note,
  onText,
  onColor,
  onDelete,
}: {
  note: CanvasState['notes'][number];
  onText: (v: string) => void;
  onColor: (c: NoteColor) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'rotate-[-1deg] rounded-2xl p-2.5 shadow-[0_10px_24px_-12px_rgba(15,23,42,.45)]',
        NOTE_BG[note.color],
      )}
    >
      <div data-handle={note.id} className="flex cursor-grab items-center gap-1.5 pb-1.5 active:cursor-grabbing">
        {(Object.keys(NOTE_BG) as NoteColor[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={`Warna ${k}`}
            onClick={() => onColor(k)}
            className={cn(
              'h-4 w-4 rounded-full ring-1 ring-black/10',
              NOTE_BG[k],
              note.color === k && 'ring-2 ring-slate-700',
            )}
          />
        ))}
        <span className="flex-1" />
        <button
          type="button"
          aria-label="Hapus catatan"
          onClick={onDelete}
          className="rounded-md p-1 text-slate-600 hover:bg-black/5"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <textarea
        value={note.text}
        onChange={(e) => onText(e.target.value.slice(0, 300))}
        placeholder="Tulis catatan…"
        rows={Math.min(8, Math.max(3, note.text.split('\n').length + Math.floor(note.text.length / 26)))}
        className="w-full resize-none bg-transparent text-[14px] font-semibold leading-snug text-slate-800 outline-none placeholder:text-slate-500"
      />
    </div>
  );
}
