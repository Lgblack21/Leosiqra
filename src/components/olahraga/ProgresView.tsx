'use client';

import { useMemo, useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import type { Timbangan } from '@/lib/olahraga/api';
import { cn } from '@/lib/utils';

// Tab Progres: catat timbangan + grafik berat vs target. FREE: riwayat 7 hari terakhir (server membatasi).

const fmt = (n: number, d = 1) => n.toLocaleString('id-ID', { maximumFractionDigits: d });
const card = 'rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';
const input =
  'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 fs-15 font-semibold text-slate-900 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

function Grafik({ data, goal }: { data: Timbangan[]; goal: number | null }) {
  const pts = [...data].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length < 2) {
    return (
      <p className="py-10 text-center fs-13 text-slate-500 dark:text-slate-400">
        Grafik muncul setelah ada 2 catatan timbangan.
      </p>
    );
  }
  const W = 600;
  const H = 200;
  const pad = 28;
  const kgs = pts.map((p) => p.kg).concat(goal ? [goal] : []);
  const lo = Math.floor(Math.min(...kgs) - 1);
  const hi = Math.ceil(Math.max(...kgs) + 1);
  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts[pts.length - 1].date);
  const x = (d: string) => pad + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - pad * 2);
  const y = (kg: number) => pad + ((hi - kg) / Math.max(1, hi - lo)) * (H - pad * 2);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grafik berat badan">
      {goal ? (
        <g>
          <line
            x1={pad}
            x2={W - pad}
            y1={y(goal)}
            y2={y(goal)}
            className="stroke-emerald-400"
            strokeDasharray="6 6"
            strokeWidth={2}
          />
          <text
            x={W - pad}
            y={y(goal) - 6}
            textAnchor="end"
            className="fill-emerald-600 dark:fill-emerald-400"
            fontSize={12}
            fontWeight={700}
          >
            target {fmt(goal)} kg
          </text>
        </g>
      ) : null}
      <path
        d={line}
        fill="none"
        className="stroke-slate-900 dark:stroke-white"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.kg)}
          r={4}
          className="fill-white stroke-slate-900 dark:fill-slate-900 dark:stroke-white"
          strokeWidth={2}
        />
      ))}
      <text x={pad} y={H - 6} fontSize={11} className="fill-slate-400">
        {pts[0].date.split('-').reverse().slice(0, 2).join('/')}
      </text>
      <text x={W - pad} y={H - 6} textAnchor="end" fontSize={11} className="fill-slate-400">
        {pts[pts.length - 1].date.split('-').reverse().slice(0, 2).join('/')}
      </text>
    </svg>
  );
}

export function ProgresView({
  weights,
  goal,
  today,
  historyDays,
  onSave,
  onDelete,
}: {
  weights: Timbangan[];
  goal: number | null;
  today: string;
  historyDays: number | null;
  onSave: (w: Timbangan) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
}) {
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [waist, setWaist] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useMemo(() => [...weights].sort((a, b) => (a.date < b.date ? -1 : 1))[0], [weights]);
  const last = weights[0];

  const save = async () => {
    const k = Number(kg.replace(',', '.'));
    const w = waist.trim() ? Number(waist.replace(',', '.')) : null;
    if (!Number.isFinite(k) || k < 25 || k > 400) return setErr('Berat 25–400 kg.');
    if (w !== null && (!Number.isFinite(w) || w < 40 || w > 250)) return setErr('Lingkar perut 40–250 cm.');
    setErr('');
    setBusy(true);
    try {
      await onSave({ date, kg: Math.round(k * 10) / 10, waist_cm: w === null ? null : Math.round(w * 10) / 10 });
      setKg('');
      setWaist('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="fs-15 font-black text-slate-900 dark:text-white">Catat timbangan</p>
        <p className="fs-12 text-slate-500 dark:text-slate-400">
          Timbang di jam yang sama (pagi, setelah ke toilet) 1–2× seminggu. Naik-turun harian itu normal.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input
            type="date"
            className={input}
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Tanggal"
          />
          <input
            className={input}
            inputMode="decimal"
            placeholder="Berat (kg)"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
          <input
            className={input}
            inputMode="decimal"
            placeholder="Perut (cm)"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
          <button
            type="button"
            onClick={save}
            disabled={busy || !kg}
            className="h-12 rounded-full bg-slate-950 fs-14 font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        {err ? <p className="mt-2 fs-13 font-semibold text-rose-600">{err}</p> : null}
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="fs-15 font-black text-slate-900 dark:text-white">Perjalanan beratmu</p>
          {first && last && first.date !== last.date ? (
            <p
              className={cn(
                'fs-13 font-bold',
                last.kg < first.kg ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {last.kg < first.kg ? '−' : last.kg > first.kg ? '+' : '±'}
              {fmt(Math.abs(last.kg - first.kg))} kg
            </p>
          ) : null}
        </div>
        <Grafik data={weights} goal={goal} />
        {historyDays ? (
          <p className="mt-2 flex items-center gap-1.5 fs-12 text-slate-500 dark:text-slate-400">
            <Lock size={13} /> Akun Gratis melihat {historyDays} hari terakhir. Semua riwayat tetap tersimpan — buka
            dengan PRO.
          </p>
        ) : null}
      </div>

      {weights.length ? (
        <ul className={cn(card, 'divide-y divide-slate-100 p-0 dark:divide-slate-800')}>
          {weights.map((w) => (
            <li key={w.date} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="fs-14 font-bold text-slate-900 dark:text-white">{fmt(w.kg)} kg</p>
                <p className="fs-12 text-slate-500 dark:text-slate-400">
                  {new Date(`${w.date}T00:00:00`).toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {w.waist_cm ? ` · perut ${fmt(w.waist_cm)} cm` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Hapus catatan ${w.date}`}
                onClick={() => onDelete(w.date)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
