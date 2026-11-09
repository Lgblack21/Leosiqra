'use client';

import { useState } from 'react';
import { AKTIVITAS, KONDISI, type Alat, type FitProfile, type KondisiKey, type Pengalaman } from '@/lib/olahraga/types';
import { cn } from '@/lib/utils';

// Profil tubuh Olahragaku. Diisi sekali (bisa diubah); isian awal dari Sehatku › Cek kalau ada.

const field =
  'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 fs-15 font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-500/20';
const label = 'mb-1.5 block fs-13 font-bold text-slate-700 dark:text-slate-200';

function Pilih<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; sub?: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cn(
            'rounded-2xl border px-4 py-3 text-left transition-colors',
            value === o.key
              ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100 dark:border-emerald-500 dark:bg-emerald-500/10 dark:ring-emerald-500/20'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
          )}
        >
          <span className="block fs-14 font-bold text-slate-900 dark:text-white">{o.label}</span>
          {o.sub ? <span className="block fs-12 text-slate-500 dark:text-slate-400">{o.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};

export function ProfilForm({
  initial,
  fromCheck,
  onSave,
  onCancel,
}: {
  initial: Partial<FitProfile>;
  fromCheck?: string;
  onSave: (p: FitProfile) => Promise<void>;
  onCancel?: () => void;
}) {
  const year = new Date().getFullYear();
  const [sex, setSex] = useState<'l' | 'p'>(initial.sex ?? 'l');
  const [birth, setBirth] = useState(initial.birthYear ? String(initial.birthYear) : '');
  const [height, setHeight] = useState(initial.heightCm ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(initial.weightKg ? String(initial.weightKg) : '');
  const [waist, setWaist] = useState(initial.waistCm ? String(initial.waistCm) : '');
  const [goal, setGoal] = useState(initial.goalKg ? String(initial.goalKg) : '');
  const [activity, setActivity] = useState<FitProfile['activity']>(initial.activity ?? 'duduk');
  const [conditions, setConditions] = useState<KondisiKey[]>(initial.conditions ?? []);
  const [equipment, setEquipment] = useState<Alat>(initial.equipment ?? 'tanpa');
  const [experience, setExperience] = useState<Pengalaman>(initial.experience ?? 'belum');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const b = num(birth);
    const h = num(height);
    const w = num(weight);
    const wa = num(waist);
    const g = num(goal);
    if (!b || !Number.isInteger(b) || b < year - 100 || b > year - 10)
      return setErr('Tahun lahir belum benar (umur 10–100 tahun).');
    if (!h || h < 100 || h > 250) return setErr('Tinggi badan 100–250 cm.');
    if (!w || w < 25 || w > 400) return setErr('Berat badan 25–400 kg.');
    if (waist.trim() && (!wa || wa < 40 || wa > 250)) return setErr('Lingkar perut 40–250 cm (atau kosongkan).');
    if (goal.trim() && (!g || g < 25 || g > 400)) return setErr('Berat target 25–400 kg (atau kosongkan).');
    setErr('');
    setBusy(true);
    try {
      await onSave({
        sex,
        birthYear: b,
        heightCm: h,
        weightKg: w,
        waistCm: wa,
        activity,
        goalKg: g,
        conditions,
        equipment,
        experience,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: KondisiKey) => setConditions((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <div className="space-y-6">
      {fromCheck ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 fs-13 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          Sebagian sudah diisi dari cek status gizi di Sehatku ({fromCheck.split('-').reverse().join('/')}). Periksa
          lagi ya, terutama berat badan.
        </p>
      ) : null}

      <section>
        <span className={label}>Jenis kelamin</span>
        <Pilih
          value={sex}
          onChange={setSex}
          options={[
            { key: 'l', label: 'Laki-laki' },
            { key: 'p', label: 'Perempuan' },
          ]}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label>
          <span className={label}>Tahun lahir</span>
          <input
            className={field}
            inputMode="numeric"
            placeholder="1995"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
          />
        </label>
        <label>
          <span className={label}>Tinggi (cm)</span>
          <input
            className={field}
            inputMode="decimal"
            placeholder="165"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </label>
        <label>
          <span className={label}>Berat sekarang (kg)</span>
          <input
            className={field}
            inputMode="decimal"
            placeholder="80"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label>
          <span className={label}>Berat target (kg)</span>
          <input
            className={field}
            inputMode="decimal"
            placeholder="Opsional"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label>
          <span className={label}>Lingkar perut (cm)</span>
          <input
            className={field}
            inputMode="decimal"
            placeholder="Opsional"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
        </label>
      </section>

      <section>
        <span className={label}>Seberapa aktif kamu sehari-hari?</span>
        <Pilih
          value={activity}
          onChange={setActivity}
          options={AKTIVITAS.map((a) => ({ key: a.key, label: a.label, sub: a.sub }))}
        />
      </section>

      <section>
        <span className={label}>Kondisi kesehatan (centang yang sesuai)</span>
        <p className="-mt-1 mb-2 fs-12 text-slate-500 dark:text-slate-400">
          Dipakai untuk menyaring metode yang tidak aman untukmu. Tidak dibagikan ke siapa pun.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {KONDISI.map((k) => {
            const on = conditions.includes(k.key);
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => toggle(k.key)}
                aria-pressed={on}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border px-4 py-3 text-left fs-13 font-semibold',
                  on
                    ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border fs-12',
                    on ? 'border-rose-400 bg-rose-400 text-white' : 'border-slate-300 dark:border-slate-600',
                  )}
                  aria-hidden
                >
                  {on ? '✓' : ''}
                </span>
                {k.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <span className={label}>Pengalaman diet / olahraga</span>
        <Pilih
          value={experience}
          onChange={setExperience}
          options={[
            { key: 'belum', label: 'Baru mau mulai', sub: 'Belum pernah diet atau olahraga rutin' },
            { key: 'pernah', label: 'Pernah', sub: 'Pernah coba tapi berhenti' },
            { key: 'rutin', label: 'Sudah rutin', sub: 'Terbiasa puasa / olahraga ≥ 3 bulan' },
          ]}
        />
      </section>

      <section>
        <span className={label}>Alat olahraga yang ada</span>
        <Pilih
          value={equipment}
          onChange={setEquipment}
          options={[
            { key: 'tanpa', label: 'Tanpa alat', sub: 'Di rumah saja' },
            { key: 'dumbbell', label: 'Dumbbell / karet', sub: 'Alat sederhana di rumah' },
            { key: 'gym', label: 'Ke gym', sub: 'Ada akses gym' },
          ]}
        />
      </section>

      {err ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {err}
        </p>
      ) : null}

      <div className="flex gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-full bg-slate-100 fs-15 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Batal
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="h-12 flex-[2] rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 fs-15 font-black text-slate-950 shadow-sm disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : 'Simpan & hitung'}
        </button>
      </div>
    </div>
  );
}
