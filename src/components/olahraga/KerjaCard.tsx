'use client';

import { useState } from 'react';
import { Bell, BellOff, Briefcase, Plus, Settings2, Trash2 } from 'lucide-react';
import { SheetShell } from '@/components/sehat/AsuransiSheets';
import { saveKerja, setShiftHari } from '@/lib/olahraga/api';
import { jendelaHari, jendelaShiftDefault, type FitKerja, type Plan, type Shift } from '@/lib/olahraga/program';
import { cn } from '@/lib/utils';

// Jam kerja: normal atau shift (maks 4). Tiap hari member memilih shift → jendela makan, menu harian, dan pengingat
// mengikuti shift itu. Default jendela buka 1 jam sebelum shift mulai (bisa diubah per shift).

const CONTOH: Shift[] = [
  { id: 'pagi', label: 'Pagi', mulai: '05:00', selesai: '15:00', jendela: null },
  { id: 'sore', label: 'Sore', mulai: '15:00', selesai: '01:00', jendela: null },
  { id: 'malam', label: 'Malam', mulai: '19:00', selesai: '05:00', jendela: null },
];
const JAM = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const JAM30 = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);
const input =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-2 fs-14 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const tutupJam = (mulai: string, makan: number) =>
  `${String((Number(mulai.slice(0, 2)) + makan) % 24).padStart(2, '0')}.00`;

function Atur({
  kerja,
  makan,
  onClose,
  onSaved,
}: {
  kerja: FitKerja;
  makan: number | null;
  onClose: () => void;
  onSaved: (k: FitKerja) => void;
}) {
  const [mode, setMode] = useState(kerja.mode);
  const [shifts, setShifts] = useState<Shift[]>(kerja.shifts.length ? kerja.shifts : CONTOH);
  const [ingatkan, setIngatkan] = useState(kerja.ingatkan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ubah = (i: number, p: Partial<Shift>) => setShifts((l) => l.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const simpan = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await saveKerja({ mode, shifts, hari: kerja.hari, ingatkan });
      onSaved(r.kerja);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SheetShell
      title="Jam kerja"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={simpan}
          disabled={busy}
          className="h-12 w-full rounded-full bg-slate-950 fs-15 font-black text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      }
    >
      <div className="space-y-4 px-5 pb-6">
        <div className="grid grid-cols-2 gap-2">
          {(['normal', 'shift'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left',
                mode === m
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <span className="block fs-14 font-bold text-slate-900 dark:text-white">
                {m === 'normal' ? 'Jam kerja biasa' : 'Kerja shift'}
              </span>
              <span className="block fs-12 text-slate-500 dark:text-slate-400">
                {m === 'normal' ? 'Jendela makan sama tiap hari' : 'Jendela makan ikut shift hari itu'}
              </span>
            </button>
          ))}
        </div>
        {mode === 'shift' ? (
          <div className="space-y-3">
            {shifts.map((s, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <input
                    className={cn(input, 'flex-1')}
                    value={s.label}
                    maxLength={20}
                    onChange={(e) => ubah(i, { label: e.target.value })}
                    aria-label="Nama shift"
                  />
                  <button
                    type="button"
                    aria-label="Hapus shift"
                    onClick={() => setShifts((l) => l.filter((_, j) => j !== i))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="fs-11 font-bold text-slate-500">
                    Mulai kerja
                    <select className={input} value={s.mulai} onChange={(e) => ubah(i, { mulai: e.target.value })}>
                      {(JAM30.includes(s.mulai) ? JAM30 : [s.mulai, ...JAM30]).map((j) => (
                        <option key={j} value={j}>
                          {j.replace(':', '.')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fs-11 font-bold text-slate-500">
                    Selesai
                    <select className={input} value={s.selesai} onChange={(e) => ubah(i, { selesai: e.target.value })}>
                      {(JAM30.includes(s.selesai) ? JAM30 : [s.selesai, ...JAM30]).map((j) => (
                        <option key={j} value={j}>
                          {j.replace(':', '.')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fs-11 font-bold text-slate-500">
                    Jendela buka
                    <select
                      className={input}
                      value={s.jendela ?? ''}
                      onChange={(e) => ubah(i, { jendela: e.target.value || null })}
                    >
                      <option value="">Otomatis ({jendelaShiftDefault(s).replace(':', '.')})</option>
                      {JAM.map((j) => (
                        <option key={j} value={j}>
                          {j.replace(':', '.')}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {makan ? (
                  <p className="mt-1.5 fs-12 text-slate-500 dark:text-slate-400">
                    Jendela makan {(s.jendela ?? jendelaShiftDefault(s)).replace(':', '.')}–
                    {tutupJam(s.jendela ?? jendelaShiftDefault(s), makan)}
                  </p>
                ) : null}
              </div>
            ))}
            {shifts.length < 4 ? (
              <button
                type="button"
                onClick={() =>
                  setShifts((l) => [
                    ...l,
                    {
                      id: `s${Date.now() % 100000}`,
                      label: `Shift ${l.length + 1}`,
                      mulai: '08:00',
                      selesai: '17:00',
                      jendela: null,
                    },
                  ])
                }
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 fs-13 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                <Plus size={16} /> Tambah shift
              </button>
            ) : null}
            <p className="fs-12 text-slate-500 dark:text-slate-400">
              Otomatis = buka 1 jam sebelum shift mulai, supaya makan utama sebelum berangkat dan tidak makan berat
              menjelang tidur.
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setIngatkan((v) => !v)}
          aria-pressed={ingatkan}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left dark:border-slate-700"
        >
          {ingatkan ? (
            <Bell size={18} className="text-emerald-600" />
          ) : (
            <BellOff size={18} className="text-slate-400" />
          )}
          <span className="flex-1">
            <span className="block fs-14 font-bold text-slate-900 dark:text-white">Ingatkan jendela makan</span>
            <span className="block fs-12 text-slate-500 dark:text-slate-400">
              Notifikasi saat jendela buka & 1 jam sebelum tutup
            </span>
          </span>
          <span className={cn('fs-12 font-black', ingatkan ? 'text-emerald-600' : 'text-slate-400')}>
            {ingatkan ? 'ON' : 'OFF'}
          </span>
        </button>
        {err ? <p className="fs-13 font-semibold text-rose-600">{err}</p> : null}
      </div>
    </SheetShell>
  );
}

export function KerjaCard({
  kerja,
  plan,
  today,
  onChanged,
  onToast,
}: {
  kerja: FitKerja;
  plan: Plan | null;
  today: string;
  onChanged: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const [atur, setAtur] = useState(false);
  const [busy, setBusy] = useState('');
  const pilihan = kerja.hari[today] ?? null;
  const j = plan ? jendelaHari(plan, kerja, today) : null;
  const pilih = async (id: string | null) => {
    setBusy(id ?? 'libur');
    try {
      await setShiftHari(today, id);
      await onChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan shift.');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase size={18} className="text-slate-500" />
          <p className="fs-15 font-black text-slate-900 dark:text-white">
            {kerja.mode === 'shift' ? 'Hari ini kamu shift apa?' : 'Jam kerja'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAtur(true)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Settings2 size={14} /> Atur
        </button>
      </div>
      {kerja.mode === 'shift' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {kerja.shifts.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!!busy}
              onClick={() => pilih(s.id)}
              aria-pressed={pilihan === s.id}
              className={cn(
                'rounded-2xl px-4 py-2 text-left disabled:opacity-60',
                pilihan === s.id
                  ? 'bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-950'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              <span className="block fs-14 font-black">{s.label}</span>
              <span className="block fs-11 opacity-75">
                {s.mulai.replace(':', '.')}–{s.selesai.replace(':', '.')}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => pilih(null)}
            aria-pressed={!pilihan}
            className={cn(
              'rounded-2xl px-4 py-2 fs-14 font-black disabled:opacity-60',
              !pilihan
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
            )}
          >
            Libur / biasa
          </button>
        </div>
      ) : (
        <p className="mt-1 fs-13 text-slate-500 dark:text-slate-400">
          Kerja shift? Atur jam shift-mu supaya jendela makan, menu harian, dan pengingat ikut menyesuaikan.
        </p>
      )}
      {j ? (
        <p className="mt-3 fs-13 font-semibold text-emerald-700 dark:text-emerald-400">
          Jendela makan hari ini: {j.mulai.replace(':', '.')}–{tutupJam(j.mulai, j.makan)}
        </p>
      ) : null}
      {atur ? (
        <Atur
          kerja={kerja}
          makan={plan?.jendela?.makan ?? null}
          onClose={() => setAtur(false)}
          onSaved={async () => {
            setAtur(false);
            onToast('Jam kerja tersimpan.');
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
