'use client';

import { AlertTriangle, BookOpen, Flame, Pencil, Ruler, Scale, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import type { ProgramAktif } from '@/lib/olahraga/api';
import { hitung } from '@/lib/olahraga/hitung';
import { METODE_BY_KEY } from '@/lib/olahraga/metode';
import { PROGRAM_HARI, hariKe, latihanHariIni } from '@/lib/olahraga/program';
import type { FitProfile } from '@/lib/olahraga/types';
import { KONDISI } from '@/lib/olahraga/types';
import { cn } from '@/lib/utils';

// Tab Program: angka tubuh (rumus tetap) + ajakan memilih metode. Program AI menyusul (PRO + koin).

const fmt = (n: number, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const card = 'rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';

const KATEGORI_WARNA: Record<string, string> = {
  Kurus: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  Normal: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Gemuk: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Obesitas: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

function Angka({ icon: Icon, label, value, sub }: { icon: typeof Scale; label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 fs-12 font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon size={15} /> {label}
      </div>
      <p className="mt-2 fsh-24 font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
      {sub ? <p className="mt-1 fs-12 leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

function ProgramAktifCard({
  program,
  today,
  onEnd,
  onLatihan,
}: {
  program: ProgramAktif;
  today: string;
  onEnd: () => Promise<void>;
  onLatihan: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const m = METODE_BY_KEY[program.diet_key];
  const hari = hariKe(program.start, today);
  const plan = program.plan;
  const h = plan ? latihanHariIni(plan, hari) : null;
  return (
    <div className="space-y-4 rounded-[28px] bg-slate-950 p-5 text-white shadow-sm md:p-6 dark:ring-1 dark:ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="fs-12 font-black uppercase tracking-wider text-lime-300">
            Programmu · {m?.nama ?? program.diet_key}
          </p>
          <p className="mt-1 fsh-24 font-black tracking-tight">
            Hari {Math.max(1, hari)} dari {PROGRAM_HARI}
            {h ? <span className="ml-2 fs-14 font-bold text-white/60">Minggu {h.minggu.ke}</span> : null}
          </p>
        </div>
        <span className="text-[34px] leading-none">{m?.emoji}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300"
          style={{ width: `${Math.min(100, (Math.max(1, hari) / PROGRAM_HARI) * 100)}%` }}
        />
      </div>
      {plan?.ringkasan ? <p className="fs-14 leading-relaxed text-white/80">{plan.ringkasan}</p> : null}
      {plan?.jendela ? (
        <p className="fs-13 font-semibold text-lime-200">
          Jendela makan {plan.jendela.mulai.replace(':', '.')} · {plan.jendela.makan} jam makan, {plan.jendela.puasa}{' '}
          jam puasa
        </p>
      ) : null}
      <p className="fs-13 text-white/70">
        Target {plan?.targetKalori.toLocaleString('id-ID')} kkal · protein {plan?.proteinG.min}–{plan?.proteinG.max} g
        per hari
      </p>
      {h ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="fs-12 font-black uppercase tracking-wide text-white/60">Fokus minggu ini</p>
            <p className="mt-1 fs-14 font-bold">{h.minggu.fokus}</p>
            <ul className="mt-2 space-y-1 fs-13 text-white/80">
              {h.minggu.tips.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="fs-12 font-black uppercase tracking-wide text-white/60">
              Contoh menu hari ini · {h.menu.nama}
            </p>
            <ul className="mt-2 space-y-1.5 fs-13">
              {h.menu.makan.map((x) => (
                <li key={x.jam + x.isi} className="flex gap-2">
                  <span className="w-11 shrink-0 font-black text-lime-300">{x.jam}</span>
                  <span className="text-white/85">{x.isi}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {plan?.aturanMakan.length ? (
        <ul className="space-y-1 fs-13 text-white/80">
          {plan.aturanMakan.map((t) => (
            <li key={t}>✓ {t}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLatihan}
          className="h-11 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 px-5 fs-14 font-black text-slate-950"
        >
          {h?.latihan.gerakan.length ? `Latihan hari ini: ${h.latihan.judul}` : 'Hari ini istirahat aktif'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('Hentikan program ini? Koin tidak dikembalikan, catatanmu tetap tersimpan.')) return;
            setBusy(true);
            try {
              await onEnd();
            } finally {
              setBusy(false);
            }
          }}
          className="h-11 rounded-full bg-white/10 px-5 fs-13 font-bold text-white/80 hover:bg-white/15"
        >
          Hentikan program
        </button>
      </div>
    </div>
  );
}

export function ProgramView({
  profile,
  pro,
  program,
  today,
  onEdit,
  onPilihMetode,
  onEnd,
  onLatihan,
}: {
  profile: FitProfile;
  pro: boolean;
  program: ProgramAktif | null;
  today: string;
  onEdit: () => void;
  onPilihMetode: () => void;
  onEnd: () => Promise<void>;
  onLatihan: () => void;
}) {
  const h = hitung(profile);
  const dokter = profile.conditions.some(
    (c) => c === 'jantung' || c === 'pingsan' || c === 'diabetes_obat' || c === 'ginjal',
  );
  const kondisiLabel = KONDISI.filter((k) => profile.conditions.includes(k.key)).map((k) => k.label.split(' / ')[0]);

  return (
    <div className="space-y-4">
      <div className={cn(card, 'flex items-start justify-between gap-3')}>
        <div className="min-w-0">
          <p className="fs-13 text-slate-500 dark:text-slate-400">
            {profile.sex === 'l' ? 'Laki-laki' : 'Perempuan'} · {h.umur} tahun · {fmt(profile.heightCm)} cm
          </p>
          <p className="mt-1 fsh-28 font-black tracking-tight text-slate-900 dark:text-white">
            {fmt(profile.weightKg, 1)} kg
            {profile.goalKg ? (
              <span className="ml-2 fs-15 font-bold text-slate-500 dark:text-slate-400">
                → target {fmt(profile.goalKg, 1)} kg
              </span>
            ) : null}
          </p>
          {kondisiLabel.length ? (
            <p className="mt-1 truncate fs-12 text-slate-500 dark:text-slate-400">Kondisi: {kondisiLabel.join(', ')}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 fs-13 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Pencil size={14} /> Ubah
        </button>
      </div>

      {dokter ? (
        <div className="flex gap-3 rounded-[24px] bg-amber-50 p-4 fs-13 leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Dengan kondisi yang kamu centang, <b>bicarakan dulu rencana diet & olahragamu dengan dokter</b>. Angka di
            bawah hanya perkiraan umum.
          </p>
        </div>
      ) : null}

      {program ? <ProgramAktifCard program={program} today={today} onEnd={onEnd} onLatihan={onLatihan} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={card}>
          <div className="flex items-center gap-2 fs-12 font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Scale size={15} /> IMT
          </div>
          <p className="mt-2 flex items-center gap-2 fsh-24 font-black tracking-tight text-slate-900 dark:text-white">
            {h.imt ? fmt(h.imt, 1) : '–'}
            {h.kategori ? (
              <span className={cn('rounded-full px-2.5 py-0.5 fs-12 font-bold', KATEGORI_WARNA[h.kategori])}>
                {h.kategori}
              </span>
            ) : null}
          </p>
          <p className="mt-1 fs-12 leading-relaxed text-slate-500 dark:text-slate-400">
            Berat normal untuk tinggimu: {fmt(h.beratNormal.min, 1)}–{fmt(h.beratNormal.max, 1)} kg (patokan Kemenkes).
          </p>
        </div>
        <Angka
          icon={Flame}
          label="Kalori harian"
          value={`${fmt(h.targetKalori)} kkal`}
          sub={
            h.tanpaDefisit ??
            (h.turun
              ? `Kebutuhanmu ±${fmt(h.tdee)} kkal, dikurangi ${fmt(h.defisit)} kkal supaya berat turun pelan & aman.`
              : `Kebutuhanmu ±${fmt(h.tdee)} kkal/hari untuk menjaga berat. Isi berat target kalau mau turun.`)
          }
        />
        <Angka
          icon={Target}
          label="Perkiraan capai target"
          value={h.perkiraanMinggu ? `${h.perkiraanMinggu.min}–${h.perkiraanMinggu.max} minggu` : '–'}
          sub={
            h.perkiraanMinggu
              ? 'Kalau konsisten. Tiap orang berbeda — yang penting turun pelan dan bertahan.'
              : 'Isi berat target yang lebih rendah dari berat sekarang.'
          }
        />
        <Angka
          icon={Sparkles}
          label="Protein harian"
          value={`${fmt(h.proteinG.min)}–${fmt(h.proteinG.max)} g`}
          sub="Telur, tempe, tahu, ikan, ayam — bantu kenyang lebih lama & menjaga otot."
        />
        <Angka
          icon={Ruler}
          label="Lingkar perut"
          value={profile.waistCm ? `${fmt(profile.waistCm)} cm` : '–'}
          sub={
            h.perutBerisiko === null
              ? 'Ukur sejajar pusar. Lemak perut lebih jujur dari IMT.'
              : h.perutBerisiko
                ? `Di atas batas sehat (${profile.sex === 'l' ? '90' : '80'} cm) — risiko gula darah & jantung lebih tinggi.`
                : 'Masih di bawah batas berisiko. Pertahankan!'
          }
        />
        <Angka
          icon={Flame}
          label="BMR"
          value={`${fmt(h.bmr)} kkal`}
          sub="Energi yang dipakai tubuhmu saat istirahat total."
        />
      </div>

      {h.dibatasi ? (
        <p className="rounded-[20px] bg-slate-100 px-4 py-3 fs-13 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {h.dibatasi}
        </p>
      ) : null}

      {program ? null : (
        <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-lime-400 p-6 text-slate-950 shadow-sm">
          <p className="fs-12 font-black uppercase tracking-wider opacity-70">Langkah berikutnya</p>
          <p className="mt-1 fsh-22 font-black leading-tight">Pilih metode diet yang cocok untukmu</p>
          <p className="mt-2 max-w-xl fs-14 leading-relaxed">
            Ada 20 metode — dari Isi Piringku sampai jendela makan. Baca penjelasannya, jawab beberapa pertanyaan, dan
            Leo bilang cocok atau tidak.{' '}
            {pro
              ? 'Setelah cocok, Leo menyusun program 4 minggu (menu & latihan harian) untuk tubuhmu.'
              : 'Mengikuti program butuh PRO + koin; membaca semua metode gratis.'}
          </p>
          <button
            type="button"
            onClick={onPilihMetode}
            className="mt-4 flex h-12 items-center gap-2 rounded-full bg-slate-950 px-5 fs-14 font-black text-white"
          >
            <BookOpen size={17} /> Lihat metode diet
          </button>
        </div>
      )}
    </div>
  );
}
