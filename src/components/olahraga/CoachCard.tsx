'use client';

import { useState } from 'react';
import { MessageCircle, RefreshCw, Send, Sparkles, Star, UtensilsCrossed } from 'lucide-react';
import { mintaEvaluasi, mintaMenu, tanyaCoach, type CoachItem, type FitData } from '@/lib/olahraga/api';
import { senin } from '@/lib/olahraga/program';
import { cn } from '@/lib/utils';

// Coach Leo (PRO, program aktif): menu harian (gratis 1×/hari selama program), evaluasi mingguan (koin),
// tanya coach (jatah gratis per hari, lalu koin). Semua dipotong & dikembalikan di Worker.

const card = 'rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';
const btn = 'flex h-11 items-center justify-center gap-1.5 rounded-full px-5 fs-14 font-black disabled:opacity-60';
const rp = (n: number) => n.toLocaleString('id-ID');

export function CoachCard({
  data,
  onChanged,
  onToast,
}: {
  data: FitData;
  onChanged: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const menu = data.coach.find(
    (c): c is Extract<CoachItem, { kind: 'menu' }> => c.kind === 'menu' && c.date === data.today,
  );
  const evalMinggu = data.coach.find(
    (c): c is Extract<CoachItem, { kind: 'eval' }> => c.kind === 'eval' && c.date === senin(data.today),
  );
  const evalLalu = data.coach.find((c): c is Extract<CoachItem, { kind: 'eval' }> => c.kind === 'eval');
  const asks = data.coach
    .filter((c): c is Extract<CoachItem, { kind: 'ask' }> => c.kind === 'ask' && c.date === data.today)
    .reverse();
  const sisaGratis = Math.max(0, data.prices.ask_free - asks.length);
  const [busy, setBusy] = useState<'menu' | 'ulang' | 'eval' | 'ask' | ''>('');
  const [q, setQ] = useState('');
  const [evalId] = useState(() => crypto.randomUUID());
  const [askId, setAskId] = useState(() => crypto.randomUUID());

  const run = async (what: typeof busy, fn: () => Promise<unknown>, ok: string) => {
    setBusy(what);
    try {
      await fn();
      onToast(ok);
      await onChanged();
      return true;
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal. Coba lagi.');
      return false;
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={18} className="text-emerald-600" />
          <p className="fs-15 font-black text-slate-900 dark:text-white">Arahan makan hari ini</p>
        </div>
        {menu ? (
          <div className="mt-3 space-y-3">
            {menu.result.pesan ? (
              <p className="fs-14 leading-relaxed text-slate-700 dark:text-slate-300">{menu.result.pesan}</p>
            ) : null}
            <ul className="space-y-2">
              {menu.result.makan.map((m) => (
                <li key={m.jam + m.isi} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/60">
                  <span className="w-12 shrink-0 fs-13 font-black text-emerald-700 dark:text-emerald-400">{m.jam}</span>
                  <span className="flex-1 fs-14 text-slate-700 dark:text-slate-300">{m.isi}</span>
                  <span className="shrink-0 text-right fs-12 text-slate-500 dark:text-slate-400">
                    ±{m.kkal} kkal
                    <br />
                    {m.protein} g prot
                  </span>
                </li>
              ))}
            </ul>
            {menu.result.tips.length ? (
              <ul className="space-y-1 fs-13 text-slate-600 dark:text-slate-300">
                {menu.result.tips.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('ulang', () => mintaMenu(true), 'Menu baru siap.')}
              className={cn(btn, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}
            >
              <RefreshCw size={15} />{' '}
              {busy === 'ulang' ? 'Menyusun…' : `Susun ulang (${rp(data.prices.menu_ulang)} koin)`}
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="fs-13 text-slate-500 dark:text-slate-400">
              Leo menyusun menu sisa hari ini sesuai shift, jendela makan, target, dan yang sudah kamu catat. Gratis 1×
              sehari selama program.
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('menu', () => mintaMenu(false), 'Arahan makan hari ini siap.')}
              className={cn(btn, 'mt-3 bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-950')}
            >
              <Sparkles size={15} /> {busy === 'menu' ? 'Leo menyusun…' : 'Susun menu hari ini'}
            </button>
          </div>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber-500" />
          <p className="fs-15 font-black text-slate-900 dark:text-white">Evaluasi mingguan</p>
        </div>
        {evalMinggu || evalLalu ? (
          <div className="mt-3 space-y-3">
            {(() => {
              const e = (evalMinggu ?? evalLalu)!;
              return (
                <>
                  <p className="fs-13 text-slate-500 dark:text-slate-400">
                    {evalMinggu ? 'Minggu ini' : `Minggu ${e.date.split('-').reverse().slice(0, 2).join('/')}`} · skor{' '}
                    <b className="fs-16 text-slate-900 dark:text-white">{e.result.skor}/10</b>
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
                      <p className="fs-12 font-black text-emerald-800 dark:text-emerald-300">Sudah bagus</p>
                      <ul className="mt-1 space-y-1 fs-13 text-emerald-900 dark:text-emerald-200">
                        {e.result.bagus.map((t) => (
                          <li key={t}>✓ {t}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
                      <p className="fs-12 font-black text-amber-800 dark:text-amber-300">Perbaiki</p>
                      <ul className="mt-1 space-y-1 fs-13 text-amber-900 dark:text-amber-200">
                        {e.result.perbaiki.map((t) => (
                          <li key={t}>→ {t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {e.result.mingguDepan ? (
                    <p className="fs-14 text-slate-700 dark:text-slate-300">{e.result.mingguDepan}</p>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : (
          <p className="mt-2 fs-13 text-slate-500 dark:text-slate-400">
            Leo membaca catatan makan, latihan, dan timbanganmu 7 hari terakhir, lalu memberi skor & saran konkret.
          </p>
        )}
        {!evalMinggu ? (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('eval', () => mintaEvaluasi(evalId), 'Evaluasi minggu ini siap.')}
            className={cn(btn, 'mt-3 bg-slate-950 text-white dark:bg-white dark:text-slate-900')}
          >
            {busy === 'eval' ? 'Leo menilai…' : `Evaluasi minggu ini (${rp(data.prices.eval)} koin)`}
          </button>
        ) : null}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-sky-600" />
          <p className="fs-15 font-black text-slate-900 dark:text-white">Tanya coach</p>
          <span className="ml-auto fs-12 text-slate-500 dark:text-slate-400">
            {sisaGratis ? `${sisaGratis} gratis lagi hari ini` : `${rp(data.prices.ask)} koin / pertanyaan`}
          </span>
        </div>
        {asks.length ? (
          <ul className="mt-3 space-y-3">
            {asks.map((a) => (
              <li key={a.id} className="space-y-1.5">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 fs-14 text-white dark:bg-white dark:text-slate-900">
                  {a.q}
                </p>
                <p className="max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 fs-14 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                  {a.result.jawaban}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={300}
            placeholder="Mis. boleh minum kopi saat puasa?"
            className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 fs-14 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="button"
            aria-label="Kirim pertanyaan"
            disabled={!!busy || q.trim().length < 3}
            onClick={async () => {
              const ok = await run('ask', () => tanyaCoach(askId, q.trim()), 'Leo sudah menjawab.');
              if (ok) {
                setQ('');
                setAskId(crypto.randomUUID());
              }
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white disabled:opacity-50"
          >
            {busy === 'ask' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-2 fs-11 text-slate-400">
          Saran umum, bukan diagnosis. Untuk gejala atau obat, tanyakan dokter.
        </p>
      </div>
    </div>
  );
}
