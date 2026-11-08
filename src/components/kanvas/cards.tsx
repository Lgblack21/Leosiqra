'use client';

import { useState } from 'react';
import { Check, GripHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { rp, type Metrics } from '@/lib/kanvas/data';
import type { Card, Chapter, Color, Ctx, Template, Unit } from '@/lib/kanvas/templates';
import type { CanvasState, NoteColor } from '@/lib/kanvas/service';
import { cn } from '@/lib/utils';

export const COLORS: Record<Color, { head: string; ring: string; dot: string; stroke: string }> = {
  indigo: {
    head: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-200 dark:ring-indigo-500/30',
    dot: 'bg-indigo-500',
    stroke: '#6366f1',
  },
  emerald: {
    head: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-200 dark:ring-emerald-500/30',
    dot: 'bg-emerald-500',
    stroke: '#10b981',
  },
  amber: {
    head: 'from-amber-400 to-orange-500',
    ring: 'ring-amber-200 dark:ring-amber-500/30',
    dot: 'bg-amber-500',
    stroke: '#f59e0b',
  },
  rose: {
    head: 'from-rose-500 to-pink-500',
    ring: 'ring-rose-200 dark:ring-rose-500/30',
    dot: 'bg-rose-500',
    stroke: '#f43f5e',
  },
  sky: {
    head: 'from-sky-500 to-cyan-500',
    ring: 'ring-sky-200 dark:ring-sky-500/30',
    dot: 'bg-sky-500',
    stroke: '#0ea5e9',
  },
  violet: {
    head: 'from-violet-500 to-fuchsia-500',
    ring: 'ring-violet-200 dark:ring-violet-500/30',
    dot: 'bg-violet-500',
    stroke: '#8b5cf6',
  },
  teal: {
    head: 'from-teal-500 to-emerald-500',
    ring: 'ring-teal-200 dark:ring-teal-500/30',
    dot: 'bg-teal-500',
    stroke: '#14b8a6',
  },
};

const CHIP: Record<Card['kind'], { label: string; cls: string }> = {
  data: { label: 'Dari catatanmu', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  tanya: { label: 'Tanya', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  angka: { label: 'Isi angka', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  hitung: { label: 'Hitungan', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  cek: { label: 'Cek dulu', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  tugas: { label: 'Tugas', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  tabel: { label: 'Tabel', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  info: { label: 'Perlu tahu', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const UNIT_LABEL: Record<Unit, string> = { rp: 'Rp', bulan: 'bulan', tahun: 'tahun', persen: '%', kali: '×' };
const fmtNum = (v: number, unit: Unit) =>
  unit === 'rp' ? Math.round(v).toLocaleString('id-ID') : v.toLocaleString('id-ID', { maximumFractionDigits: 2 });

export type Edit = {
  answer: (id: string, v: string) => void;
  toggle: (id: string) => void;
  num: (id: string, v: number | null) => void;
};

function NumberField({
  card,
  value,
  m,
  edit,
}: {
  card: Extract<Card, { kind: 'angka' }>;
  value: number | undefined;
  m: Metrics;
  edit: Edit;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? '' : fmtNum(value, card.unit));
  const suggest = value === undefined ? card.suggest?.(m) : null;
  const commit = (raw: string) => {
    setDraft(null);
    const clean =
      card.unit === 'rp'
        ? raw.replace(/\D/g, '')
        : raw
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^\d.]/g, '');
    const v = Number(clean);
    edit.num(card.id, clean && Number.isFinite(v) ? v : null);
  };
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-sky-400 dark:bg-slate-800/70 dark:ring-slate-700">
        {card.unit === 'rp' ? <span className="text-[13px] font-bold text-slate-400">Rp</span> : null}
        <input
          inputMode={card.unit === 'rp' ? 'numeric' : 'decimal'}
          aria-label={card.label}
          value={shown}
          placeholder="0"
          onChange={(e) => {
            const raw = e.target.value;
            if (card.unit === 'rp') {
              const d = raw.replace(/\D/g, '').slice(0, 15);
              setDraft(d ? Number(d).toLocaleString('id-ID') : '');
            } else setDraft(raw.replace(/[^\d.,]/g, '').slice(0, 8));
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] font-bold text-slate-900 outline-none dark:text-white"
        />
        {card.unit !== 'rp' ? (
          <span className="text-[13px] font-bold text-slate-400">{UNIT_LABEL[card.unit]}</span>
        ) : null}
      </div>
      {suggest ? (
        <button
          type="button"
          onClick={() => edit.num(card.id, suggest)}
          className="mt-1.5 text-[12px] font-bold text-sky-600 dark:text-sky-400"
        >
          Pakai saran: {card.unit === 'rp' ? rp(suggest) : `${fmtNum(suggest, card.unit)} ${UNIT_LABEL[card.unit]}`}
        </button>
      ) : null}
    </div>
  );
}

function AutoText({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 1000))}
      placeholder={placeholder}
      rows={Math.min(8, Math.max(2, value.split('\n').length + Math.floor(value.length / 34)))}
      className="w-full resize-none rounded-xl bg-amber-50/60 px-3 py-2 text-[13.5px] leading-relaxed text-slate-800 outline-none ring-1 ring-amber-100 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-300 dark:bg-amber-500/5 dark:text-slate-100 dark:ring-amber-500/20"
    />
  );
}

function Row({ l, v, b, tone }: { l: string; v: number; b?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3 py-1 text-[12.5px]',
        b && 'mt-1 border-t border-slate-200 pt-1.5 font-black dark:border-slate-700',
      )}
    >
      <span className={b ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}>{l}</span>
      <span
        className={cn(
          'tabular-nums font-bold',
          tone === 'neg' ? 'text-rose-600' : tone === 'pos' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {rp(v)}
      </span>
    </div>
  );
}

function Table({ kind, c }: { kind: 'neraca' | 'aruskas' | 'utang'; c: Ctx }) {
  const m = c.m;
  const p = (k: string) => (Number.isFinite(c.n[k]) ? c.n[k] : 0);
  if (kind === 'utang')
    return (
      <div>
        <p className="mb-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Daftar utang</p>
        {m.debts.length ? (
          m.debts.slice(0, 8).map((d, i) => <Row key={i} l={d.name} v={d.remaining} tone="neg" />)
        ) : (
          <p className="text-[12.5px] text-slate-500">Tidak ada utang tercatat 🎉</p>
        )}
        {m.debts.length ? <Row l="Total" v={m.liabilities} b tone="neg" /> : null}
      </div>
    );
  if (kind === 'neraca') {
    const assets = m.assets + p('n-partner-savings');
    return (
      <div>
        <p className="mb-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Neraca keluarga</p>
        <Row l="Kas & rekening" v={m.cash} />
        <Row l="Tabungan" v={m.savings} />
        <Row l="Investasi" v={m.investments} />
        {m.piutang ? <Row l="Piutang" v={m.piutang} /> : null}
        {m.goods ? <Row l="Barang & koleksi" v={m.goods} /> : null}
        {p('n-partner-savings') ? <Row l="Tabungan pasangan" v={p('n-partner-savings')} /> : null}
        <Row l="Total aset" v={assets} b />
        <Row l="Tagihan kartu" v={m.cards} tone="neg" />
        <Row l="Utang" v={m.hutang} tone="neg" />
        <Row l="Harta bersih" v={assets - m.liabilities} b tone={assets - m.liabilities >= 0 ? 'pos' : 'neg'} />
      </div>
    );
  }
  const inc = m.incomeAvg + p('n-partner-income');
  return (
    <div>
      <p className="mb-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Arus kas keluarga / bulan</p>
      <Row l="Pemasukanmu" v={m.incomeAvg} />
      {p('n-partner-income') ? <Row l="Pemasukan pasangan" v={p('n-partner-income')} /> : null}
      <Row l="Pengeluaranmu (rata-rata)" v={m.expenseAvg} tone="neg" />
      <Row l="Sisa" v={inc - m.expenseAvg} b tone={inc - m.expenseAvg >= 0 ? 'pos' : 'neg'} />
      <p className="mt-1 text-[11px] text-slate-400">Pengeluaran pasangan belum tercatat di sini.</p>
    </div>
  );
}

function SubCard({ card, c, state, edit }: { card: Card; c: Ctx; state: CanvasState; edit: Edit }) {
  const chip = CHIP[card.kind];
  const head = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
        chip.cls,
      )}
    >
      {card.kind === 'cek' || (card.kind === 'info' && card.source) ? <ShieldCheck size={11} /> : null}
      {card.kind === 'info' && card.source ? card.source : chip.label}
    </span>
  );
  let body: React.ReactNode = null;
  if (card.kind === 'data') {
    body = (
      <>
        <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
        <p className="text-[20px] font-black tracking-tight text-slate-900 dark:text-white">
          {c.m.ready ? card.get(c.m) : '…'}
        </p>
        {c.m.ready && card.note?.(c.m) ? <p className="text-[11.5px] text-slate-400">{card.note(c.m)}</p> : null}
      </>
    );
  } else if (card.kind === 'tanya') {
    body = (
      <>
        <p className="text-[13.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">{card.q}</p>
        <AutoText
          value={state.answers[card.id] ?? ''}
          onChange={(v) => edit.answer(card.id, v)}
          placeholder="Tulis jawabanmu…"
        />
      </>
    );
  } else if (card.kind === 'angka') {
    body = (
      <>
        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{card.label}</p>
        {card.hint ? <p className="-mt-1 text-[11.5px] text-slate-400">{card.hint}</p> : null}
        <NumberField card={card} value={state.nums[card.id]} m={c.m} edit={edit} />
      </>
    );
  } else if (card.kind === 'hitung') {
    const r = card.calc(c);
    body = (
      <>
        <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
        {r ? (
          <>
            <p
              className={cn(
                'text-[19px] font-black tracking-tight',
                r.tone === 'good'
                  ? 'text-emerald-600'
                  : r.tone === 'warn'
                    ? 'text-amber-600'
                    : r.tone === 'bad'
                      ? 'text-rose-600'
                      : 'text-slate-900 dark:text-white',
              )}
            >
              {r.value}
            </p>
            {r.note ? <p className="text-[11.5px] text-slate-500">{r.note}</p> : null}
          </>
        ) : (
          <p className="text-[12.5px] italic text-slate-400">Isi angka di atas, hasilnya muncul di sini.</p>
        )}
      </>
    );
  } else if (card.kind === 'cek' || card.kind === 'tugas') {
    body = (
      <>
        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{card.title}</p>
        <div className="space-y-1">
          {card.items.map((it) => {
            const key = `${card.id}.${it.id}`;
            const on = Boolean(state.done[key]);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => edit.toggle(key)}
                className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ring-1',
                    on
                      ? card.kind === 'cek'
                        ? 'bg-rose-500 ring-rose-500'
                        : 'bg-violet-500 ring-violet-500'
                      : 'bg-white ring-slate-300 dark:bg-slate-900 dark:ring-slate-600',
                  )}
                >
                  {on ? <Check size={13} strokeWidth={3} className="text-white" /> : null}
                </span>
                <span
                  className={cn(
                    'text-[13px] leading-snug',
                    on ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200',
                  )}
                >
                  {it.text}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (card.kind === 'tabel') {
    body = <Table kind={card.table} c={c} />;
  } else {
    body = <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">{card.text}</p>;
  }
  return (
    <div
      className={cn(
        'space-y-1.5 rounded-2xl p-3',
        card.kind === 'info'
          ? 'bg-slate-50 dark:bg-slate-800/50'
          : 'bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800',
      )}
    >
      {head}
      {body}
    </div>
  );
}

export function ChapterNode({
  ch,
  index,
  c,
  state,
  edit,
  stat,
}: {
  ch: Chapter;
  index: number;
  c: Ctx;
  state: CanvasState;
  edit: Edit;
  stat: { got: number; total: number };
}) {
  const col = COLORS[ch.color];
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] bg-slate-50/95 shadow-[0_10px_30px_-12px_rgba(15,23,42,.25)] ring-1 dark:bg-slate-900/95',
        col.ring,
      )}
    >
      <div
        data-handle={ch.id}
        className={cn(
          'flex cursor-grab items-center gap-2 bg-gradient-to-r px-4 py-3 text-white active:cursor-grabbing',
          col.head,
        )}
      >
        <span className="text-[20px] leading-none">{ch.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">Bab {index + 1}</p>
          <p className="truncate text-[15px] font-black leading-tight">{ch.title}</p>
        </div>
        {stat.total ? (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-black tabular-nums">
            {stat.got}/{stat.total}
          </span>
        ) : null}
        <GripHorizontal size={16} className="opacity-70" />
      </div>
      <div className="space-y-2 p-2.5">
        {ch.cards.map((card) => (
          <SubCard key={card.id} card={card} c={c} state={state} edit={edit} />
        ))}
      </div>
    </div>
  );
}

export function FinalNode({ t, c, pct }: { t: Template; c: Ctx; pct: number }) {
  const g = t.goal?.(c) ?? null;
  return (
    <div
      data-handle="akhir"
      className="cursor-grab overflow-hidden rounded-[26px] bg-slate-950 p-5 text-white shadow-[0_18px_40px_-14px_rgba(15,23,42,.55)] active:cursor-grabbing"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Rencanamu</p>
      <p className="mt-0.5 text-[20px] font-black leading-tight">
        {t.emoji} {t.title}
      </p>
      {g ? (
        <div className="mt-3 rounded-2xl bg-white/10 p-3">
          <p
            className={cn(
              'text-[22px] font-black tracking-tight',
              g.tone === 'bad' ? 'text-rose-300' : g.tone === 'warn' ? 'text-amber-300' : 'text-emerald-300',
            )}
          >
            {g.value}
          </p>
          {g.note ? <p className="text-[12px] text-white/70">{g.note}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-white/60">
          Isi angka di bab-bab sebelumnya, ringkasannya muncul di sini.
        </p>
      )}
      <div className="mt-4">
        <div className="flex justify-between text-[12px] font-bold text-white/70">
          <span>Langkah selesai</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
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
