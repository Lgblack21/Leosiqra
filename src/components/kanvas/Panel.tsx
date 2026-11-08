'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { rp } from '@/lib/kanvas/data';
import {
  cardState,
  chapterProgress,
  skipKey,
  type Card,
  type Chapter,
  type Ctx,
  type StateLike,
} from '@/lib/kanvas/templates';
import { KIND_LABEL, STATUS_PILL, TONE_CLS, babColor, cardTitle, fmtNum } from '@/components/kanvas/cards';
import { cn } from '@/lib/utils';

export type PanelActions = {
  answer: (id: string, v: string | null) => void;
  toggle: (id: string, on: boolean) => void;
  num: (id: string, v: number | null) => void;
  skip: (id: string, on: boolean) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  href: (h: string) => string;
};

function NumberInput({
  card,
  value,
  act,
  suggest,
}: {
  card: Extract<Card, { kind: 'angka' }>;
  value?: number;
  act: PanelActions;
  suggest: number | null;
}) {
  const [draft, setDraft] = useState(
    value === undefined
      ? ''
      : card.unit === 'rp'
        ? Math.round(value).toLocaleString('id-ID')
        : String(value).replace('.', ','),
  );
  const commit = () => {
    const clean =
      card.unit === 'rp'
        ? draft.replace(/\D/g, '')
        : draft
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^\d.]/g, '');
    const v = Number(clean);
    act.num(card.id, clean && Number.isFinite(v) ? v : null);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 dark:bg-slate-900 dark:ring-slate-700">
        {card.unit === 'rp' ? <span className="text-[15px] font-bold text-slate-400">Rp</span> : null}
        <input
          inputMode={card.unit === 'rp' ? 'numeric' : 'decimal'}
          aria-label={card.label}
          value={draft}
          placeholder="0"
          onChange={(e) => {
            const raw = e.target.value;
            if (card.unit === 'rp') {
              const d = raw.replace(/\D/g, '').slice(0, 15);
              setDraft(d ? Number(d).toLocaleString('id-ID') : '');
            } else setDraft(raw.replace(/[^\d.,]/g, '').slice(0, 8));
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-12 min-w-0 flex-1 bg-transparent text-[18px] font-black text-slate-900 outline-none dark:text-white"
        />
        {card.unit !== 'rp' ? (
          <span className="text-[15px] font-bold text-slate-400">
            {{ bulan: 'bulan', tahun: 'tahun', persen: '%', kali: '×' }[card.unit]}
          </span>
        ) : null}
      </div>
      {suggest !== null && value === undefined ? (
        <button
          type="button"
          onClick={() => {
            setDraft(card.unit === 'rp' ? Math.round(suggest).toLocaleString('id-ID') : String(suggest));
            act.num(card.id, suggest);
          }}
          className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400"
        >
          Pakai saran: {fmtNum(suggest, card.unit)}
        </button>
      ) : null}
    </div>
  );
}

export function Panel({
  ch,
  index,
  card,
  s,
  c,
  act,
  hasNext,
  step,
}: {
  ch: Chapter;
  index: number;
  card: Card;
  s: StateLike;
  c: Ctx;
  act: PanelActions;
  hasNext: boolean;
  step: { i: number; n: number };
}) {
  const st = cardState(card, s, c.m);
  const bab = chapterProgress(ch, s, c.m);
  const skipped = st === 'skipped';
  const answered = st === 'answered';
  const link = 'link' in card ? card.link : undefined;
  const secondary =
    answered || skipped ? (
      <button
        type="button"
        onClick={() => {
          if (card.kind === 'tanya') act.answer(card.id, null);
          else if (card.kind === 'tugas') act.toggle(card.id, false);
          else if (card.kind === 'angka') act.num(card.id, null);
          act.skip(card.id, false);
        }}
        className="w-full py-3 text-[15px] font-bold text-slate-700 dark:text-slate-200"
      >
        Batalkan jawabanku
      </button>
    ) : card.kind !== 'info' && card.kind !== 'hitung' ? (
      <button
        type="button"
        onClick={() => act.skip(card.id, true)}
        className="w-full py-3 text-[15px] font-bold text-slate-700 dark:text-slate-200"
      >
        Lewati dulu
      </button>
    ) : null;

  return (
    <div className="flex h-full flex-col">
      <div className={cn('bg-gradient-to-br px-5 pb-3 pt-4 text-white', babColor(index).head)}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-[20px]">
            {ch.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white/75">Bab {index + 1}</p>
            <p className="truncate text-[16px] font-black leading-tight">{ch.title}</p>
          </div>
          <button
            type="button"
            aria-label="Kartu sebelumnya"
            onClick={act.prev}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Kartu selanjutnya"
            onClick={act.next}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            aria-label="Tutup"
            onClick={act.close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {Array.from({ length: step.n }, (_, k) => (
            <span key={k} className={cn('h-1.5 flex-1 rounded-full', k < step.i ? 'bg-white' : 'bg-white/25')} />
          ))}
          <span className="ml-1.5 text-[11.5px] font-bold text-white/85">
            {KIND_LABEL[card.kind]} · {step.i}/{step.n}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {bab.done ? (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
            <LeoBadge topic="investasi" size={44} />
            <div>
              <p className="text-[15px] font-black text-slate-900 dark:text-white">
                Bab {index + 1} selesai: {ch.title.toLowerCase()}
              </p>
              <p className="text-[12.5px] text-slate-600 dark:text-slate-300">
                Jawabannya sudah ada di kanvas, dan tabelnya terisi dari situ.
              </p>
            </div>
          </div>
        ) : card.kind === 'tanya' || card.kind === 'tugas' || card.kind === 'angka' ? (
          <LeoBadge topic="investasi" size={44} />
        ) : null}

        {card.kind === 'data' ? (
          <>
            <p className="text-[14px] text-slate-500">{card.label}</p>
            <p className="text-[24px] font-black tracking-tight text-slate-900 dark:text-white">
              {skipped
                ? 'Dilewati dulu'
                : st === 'auto'
                  ? rp(card.value(c.m) ?? 0)
                  : c.m.ready
                    ? `Siap ${c.m.readyLabel}`
                    : 'Memuat…'}
            </p>
            <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">{card.desc}</p>
            {st === 'waiting' && c.m.ready ? (
              <p className="text-[13px] text-slate-500">
                Rata-rata butuh minimal satu bulan penuh catatan. Lanjutkan mencatat, angkanya terisi otomatis.
              </p>
            ) : null}
          </>
        ) : card.kind === 'cek' ? (
          (() => {
            const r = card.calc(c.m);
            return (
              <>
                <p className="text-[19px] font-black leading-snug text-slate-900 dark:text-white">{card.label}</p>
                {r ? (
                  <>
                    <p className="text-[15px] text-slate-600 dark:text-slate-300">{r.text}</p>
                    <span
                      className={cn(
                        'inline-block rounded-full px-3 py-1 text-[12.5px] font-bold',
                        STATUS_PILL[r.status].cls,
                      )}
                    >
                      {STATUS_PILL[r.status].label}
                    </span>
                  </>
                ) : (
                  <p className="text-[15px] text-slate-500">
                    {skipped ? 'Dilewati dulu' : c.m.ready ? `Siap ${c.m.readyLabel}` : 'Memuat…'}
                  </p>
                )}
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">{card.desc}</p>
                <p className="border-l-2 border-slate-200 pl-3 text-[13px] leading-relaxed text-slate-500 dark:border-slate-700">
                  {card.ref}
                </p>
              </>
            );
          })()
        ) : card.kind === 'hitung' ? (
          (() => {
            const r = card.calc(c);
            return (
              <>
                <p className="text-[18px] font-black text-slate-900 dark:text-white">{card.label}</p>
                {r ? (
                  <>
                    <p
                      className={cn(
                        'text-[28px] font-black',
                        r.tone ? TONE_CLS[r.tone] : 'text-slate-900 dark:text-white',
                      )}
                    >
                      {r.value}
                    </p>
                    {r.note ? <p className="text-[14px] text-slate-500">{r.note}</p> : null}
                  </>
                ) : (
                  <p className="text-[14px] text-slate-500">Isi kartu angka di bab ini, hasilnya muncul di sini.</p>
                )}
              </>
            );
          })()
        ) : card.kind === 'info' ? (
          <>
            <p className="text-[18px] font-black text-slate-900 dark:text-white">{card.label}</p>
            <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{card.text}</p>
            {card.source ? <p className="text-[12.5px] font-bold text-slate-400">Sumber: {card.source}</p> : null}
          </>
        ) : (
          <>
            <p className="text-[19px] font-black leading-snug text-slate-900 dark:text-white">{cardTitle(card)}</p>
            {card.kind === 'tanya' || card.kind === 'tugas' ? (
              <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">{card.why}</p>
            ) : card.why ? (
              <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">{card.why}</p>
            ) : null}
            {card.kind === 'tanya' ? (
              <div className="space-y-2">
                {card.options.map((o) => {
                  const on = s.answers[card.id] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => {
                        const first = !answered;
                        act.answer(card.id, o);
                        act.skip(card.id, false);
                        // Jawaban pertama → lanjut otomatis ke kartu berikutnya yang belum selesai.
                        if (first && hasNext) setTimeout(act.next, 450);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition',
                        on
                          ? 'bg-white ring-2 ring-slate-900 dark:bg-slate-900 dark:ring-white'
                          : 'bg-slate-50 ring-1 ring-transparent hover:ring-slate-200 dark:bg-slate-900/60 dark:hover:ring-slate-700',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2',
                          on ? 'ring-slate-900 dark:ring-white' : 'ring-slate-300 dark:ring-slate-600',
                        )}
                      >
                        {on ? <span className="h-3 w-3 rounded-full bg-slate-900 dark:bg-white" /> : null}
                      </span>
                      <span className="text-slate-800 dark:text-slate-100">{o}</span>
                    </button>
                  );
                })}
              </div>
            ) : card.kind === 'tugas' ? (
              <button
                type="button"
                onClick={() => {
                  const first = !answered;
                  act.toggle(card.id, true);
                  act.skip(card.id, false);
                  if (first && hasNext) setTimeout(act.next, 450);
                }}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold',
                  answered
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
                )}
              >
                {answered ? (
                  <>
                    <Check size={18} strokeWidth={3} /> Sudah
                  </>
                ) : (
                  'Sudah'
                )}
              </button>
            ) : (
              <NumberInput
                key={card.id}
                card={card}
                value={s.nums[card.id]}
                act={act}
                suggest={card.suggest?.(c.m) ?? null}
              />
            )}
          </>
        )}

        {link ? (
          <Link
            href={act.href(link.href)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-[14.5px] font-bold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {link.label} <ExternalLink size={15} />
          </Link>
        ) : null}
      </div>
      <div className="border-t border-slate-100 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 dark:border-slate-800">
        {secondary}
        {hasNext && (answered || skipped || st === 'auto' || card.kind === 'info' || card.kind === 'hitung') ? (
          <button
            type="button"
            onClick={act.next}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 text-[15px] font-bold text-white dark:bg-white dark:text-slate-900"
          >
            Kartu berikutnya <ArrowRight size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { skipKey };
