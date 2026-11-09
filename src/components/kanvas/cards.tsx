'use client';

import { Check, ChevronRight, Lock, Trash2 } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { rp, type Metrics } from '@/lib/kanvas/data';
import {
  cardState,
  chapterProgress,
  counts,
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
      <span className="flex items-center gap-1.5 fs-12.5 font-semibold text-slate-700 dark:text-slate-200">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <Check size={11} strokeWidth={3.5} className="text-white" />
        </span>
        <span className="line-clamp-2">{text}</span>
      </span>
    );
  }
  if (st === 'skipped') return <span className="fs-12 text-slate-400">Dilewati dulu</span>;
  if (card.kind === 'data') {
    if (st === 'waiting')
      return <span className="fs-12 text-slate-400">{m.ready ? `Siap ${m.readyLabel}` : 'Memuat…'}</span>;
    return (
      <span className="fs-16 font-black tracking-tight text-slate-900 dark:text-white">{rp(card.value(m) ?? 0)}</span>
    );
  }
  if (card.kind === 'cek') {
    const r = card.calc(m);
    if (!r) return <span className="fs-12 text-slate-400">{m.ready ? `Siap ${m.readyLabel}` : 'Memuat…'}</span>;
    return (
      <span className="block space-y-1">
        <span className="block fs-12 text-slate-500 dark:text-slate-400">{r.text}</span>
        <span className={cn('inline-block rounded-full px-2 py-0.5 fs-11 font-bold', STATUS_PILL[r.status].cls)}>
          {STATUS_PILL[r.status].label}
        </span>
      </span>
    );
  }
  if (card.kind === 'hitung') {
    const r = card.calc(c);
    return r ? (
      <span className={cn('fs-15 font-black', r.tone ? TONE_CLS[r.tone] : 'text-slate-900 dark:text-white')}>
        {r.value}
      </span>
    ) : (
      <span className="fs-12 text-slate-400">Menunggu angka</span>
    );
  }
  if (card.kind === 'info') return <span className="line-clamp-2 fs-12 text-slate-500">{card.text}</span>;
  return <span className="fs-12 text-slate-400">Belum dijawab</span>;
}

// Warna per bab (berurutan) — tiap bab punya identitas sendiri di papan.
export const BAB_COLORS: Color[] = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal'];
export const babColor = (i: number) => COLORS[BAB_COLORS[i % BAB_COLORS.length]];

const CHIP: Record<Card['kind'], string> = {
  data: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  tanya: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  cek: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  tugas: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  angka: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  hitung: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function Ring({ got, total }: { got: number; total: number }) {
  const r = 15;
  const len = 2 * Math.PI * r;
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-white/25" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="stroke-white transition-all duration-500"
          strokeDasharray={`${total ? (got / total) * len : 0} ${len}`}
        />
      </svg>
      <span className="fs-11 font-black tabular-nums text-white">
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
  const col = babColor(index);
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[26px] bg-white shadow-[0_14px_36px_-18px_rgba(15,23,42,.35)] ring-1 transition-shadow dark:bg-slate-900',
        p.done ? 'ring-2 ring-emerald-400/70' : 'ring-slate-200/80 dark:ring-slate-800',
      )}
    >
      <div
        data-handle={ch.id}
        className={cn(
          'flex cursor-grab items-center gap-3 bg-gradient-to-br px-4 py-3.5 text-white active:cursor-grabbing',
          col.head,
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 fsh-20 backdrop-blur">
          {ch.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="fs-10.5 font-black uppercase tracking-[0.2em] text-white/75">Bab {index + 1}</p>
          <p className="truncate fs-16 font-black leading-tight">{ch.title}</p>
        </div>
        <Ring got={p.got} total={p.total} />
      </div>
      <div className="space-y-2 bg-slate-50/70 p-2.5 dark:bg-slate-950/40">
        {ch.cards.map((card) => {
          const st = cardState(card, s, c.m);
          const done = st === 'answered' || st === 'auto';
          return (
            <button
              key={card.id}
              type="button"
              data-card={card.id}
              onClick={() => onOpen(card.id)}
              className={cn(
                'relative block w-full rounded-2xl bg-white p-3 pl-3.5 text-left ring-1 transition hover:-translate-y-px hover:shadow-md dark:bg-slate-900',
                selected === card.id
                  ? 'shadow-md ring-2 ring-slate-900 dark:ring-white'
                  : 'ring-slate-200/80 dark:ring-slate-800',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('rounded-full px-2 py-0.5 fs-10.5 font-bold', CHIP[card.kind])}>
                  {KIND_LABEL[card.kind]}
                </span>
                {card.kind === 'data' && st === 'auto' ? (
                  <span className="fs-10.5 font-semibold text-emerald-600 dark:text-emerald-400">● terisi</span>
                ) : null}
                <span className="flex-1" />
                {done ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                    <Check size={12} strokeWidth={3.5} className="text-white" />
                  </span>
                ) : st === 'skipped' ? (
                  <span className="h-5 w-5 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600" />
                ) : counts(card) ? (
                  <span className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                ) : null}
              </span>
              <span className="mt-1.5 block fs-13.5 font-bold leading-snug text-slate-800 dark:text-slate-100">
                {cardTitle(card)}
              </span>
              <span className="mt-1.5 block">
                <StatusLine card={card} st={st} s={s} m={c.m} c={c} />
              </span>
            </button>
          );
        })}
        {p.done ? (
          <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-2 fs-12 font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Check size={14} strokeWidth={3} /> Bab {index + 1} selesai
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Row({ l, v, b, tone }: { l: string; v: number | null; b?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3 border-t border-slate-100 py-2 fs-13 dark:border-slate-800',
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
      <p className="fs-10 font-black uppercase tracking-[0.18em] text-slate-400">Tabel</p>
      <p className="fs-17 font-black text-slate-900 dark:text-white">{title}</p>
      <p className="mb-1.5 fs-12 text-slate-400">{sub}</p>
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
        <p className="border-t border-slate-100 pt-2 fs-13 text-slate-500 dark:border-slate-800">
          Tidak ada utang tercatat 🎉
        </p>
      )}
    </div>
  );
}

export function StartNode({ t, prog }: { t: Template; prog: { got: number; total: number } }) {
  return (
    <div
      data-handle="mulai"
      className="w-[220px] cursor-grab rounded-[26px] bg-white p-4 text-center shadow-[0_14px_36px_-18px_rgba(15,23,42,.35)] ring-1 ring-slate-200/80 active:cursor-grabbing dark:bg-slate-900 dark:ring-slate-800"
    >
      <div className="flex justify-center">
        <LeoBadge topic="investasi" size={64} />
      </div>
      <p className="mt-2 fs-10.5 font-black uppercase tracking-[0.2em] text-slate-400">Mulai di sini</p>
      <p className="fs-16 font-black text-slate-900 dark:text-white">
        {t.emoji} {t.title}
      </p>
      <p className="mt-0.5 fs-12 text-slate-500">
        {t.chapters.length} bab · {prog.total} kartu · ±{Math.max(3, Math.round(prog.total * 0.4))} menit
      </p>
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
  const pctDone = prog.total ? Math.round((prog.got / prog.total) * 100) : 0;
  return (
    <div
      data-handle="akhir"
      className="cursor-grab overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_24px_50px_-18px_rgba(15,23,42,.6)] ring-1 ring-white/10 active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl fsh-22',
            unlocked ? 'bg-emerald-400/20' : 'bg-white/10',
          )}
        >
          {unlocked ? t.emoji : <Lock size={18} className="text-white/70" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="fs-10.5 font-black uppercase tracking-[0.2em] text-amber-300">
            {unlocked ? 'Siap dijalankan' : 'Hasil akhir'}
          </p>
          <p className="truncate fs-19 font-black">{t.finalTitle}</p>
        </div>
        <span className="fsh-22 font-black tabular-nums text-white/90">{pctDone}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-emerald-400 transition-all duration-500"
          style={{ width: `${pctDone}%` }}
        />
      </div>
      <p className="mt-1.5 fs-12 text-white/55">
        {prog.babDone} dari {prog.babTotal} bab selesai · {prog.got} dari {prog.total} kartu
        {unlocked ? '' : ` · terbuka penuh setelah ${prog.babTotal} bab selesai`}
      </p>
      {g ? (
        <div className="mt-3 rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10">
          <p
            className={cn(
              'fsh-20 font-black',
              g.tone === 'bad' ? 'text-rose-300' : g.tone === 'warn' ? 'text-amber-300' : 'text-emerald-300',
            )}
          >
            {g.value}
          </p>
          {g.note ? <p className="fs-12 text-white/60">{g.note}</p> : null}
        </div>
      ) : null}
      {saran.length ? (
        <div className="mt-3">
          <p className="mb-1.5 fs-11 font-black uppercase tracking-[0.18em] text-white/45">Langkah berikutnya</p>
          <div className="space-y-1.5">
            {saran.slice(0, 6).map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSaran(s)}
                className="flex w-full items-center gap-2.5 rounded-2xl bg-white/[.07] px-3 py-2.5 text-left fs-13 font-semibold text-white/90 ring-1 ring-white/10 transition hover:bg-white/[.12]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 fs-11 font-black">
                  {i + 1}
                </span>
                <span className="flex-1">{s.text}</span>
                <ChevronRight size={16} className="shrink-0 text-white/40" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-3 fs-11 leading-relaxed text-white/35">
        Perkiraan untuk membantu merencanakan, bukan nasihat keuangan pribadi.
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
        className="w-full resize-none bg-transparent fs-14 font-semibold leading-snug text-slate-800 outline-none placeholder:text-slate-500"
      />
    </div>
  );
}
