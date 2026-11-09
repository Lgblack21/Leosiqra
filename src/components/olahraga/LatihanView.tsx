'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { SheetShell } from '@/components/sehat/AsuransiSheets';
import { deleteWorkout, saveWorkout, type FitData } from '@/lib/olahraga/api';
import { GERAKAN, GERAKAN_BY_KEY } from '@/lib/olahraga/gerakan';
import { gerakanAman, hariKe, latihanHariIni, perkiraanLatihan, type LatihanItem } from '@/lib/olahraga/program';
import type { Gerakan, GerakanKategori } from '@/lib/olahraga/types';
import { cn } from '@/lib/utils';

// Tab Latihan: latihan hari ini dari program aktif, catat latihan bebas, riwayat, dan perpustakaan gerakan.
// Perpustakaan & catat latihan boleh untuk semua akun; latihan terjadwal butuh program (PRO + koin).

const card = 'rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';
const SATUAN = { ulang: '×', detik: ' detik', menit: ' menit' } as const;
const dosis = (g: Gerakan, it: { set: number; jumlah: number }) =>
  g.satuan === 'menit' && it.set === 1 ? `${it.jumlah} menit` : `${it.set} set × ${it.jumlah}${SATUAN[g.satuan]}`;
const KATEGORI: { key: GerakanKategori | 'semua'; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'kardio', label: 'Kardio' },
  { key: 'kekuatan', label: 'Kekuatan' },
  { key: 'kelenturan', label: 'Peregangan' },
];

function GerakanBaris({ it }: { it: LatihanItem }) {
  const g = GERAKAN_BY_KEY[it.key];
  const [open, setOpen] = useState(false);
  if (!g) return null;
  return (
    <li className="rounded-2xl bg-slate-50 dark:bg-slate-800/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-[24px] leading-none">{g.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block fs-14 font-bold text-slate-900 dark:text-white">{g.nama}</span>
          <span className="block fs-12 text-slate-500 dark:text-slate-400">{dosis(g, it)}</span>
        </span>
        <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <ol className="list-decimal space-y-1 pl-5 fs-13 leading-relaxed text-slate-700 dark:text-slate-300">
            {g.cara.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <p className="mt-2 fs-12 italic text-slate-500 dark:text-slate-400">{g.tips}</p>
        </div>
      ) : null}
    </li>
  );
}

function DetailGerakan({ g, aman, onClose }: { g: Gerakan; aman: boolean; onClose: () => void }) {
  return (
    <SheetShell title={`${g.emoji} ${g.nama}`} onClose={onClose}>
      <div className="space-y-4 px-5 pb-6">
        <p className="fs-13 text-slate-500 dark:text-slate-400">
          {g.otot} · {g.lowImpact ? 'tanpa lompatan' : 'ada benturan'}
          {g.duduk ? ' · bisa sambil duduk' : ''} · dosis pemula {dosis(g, g.bawaan)}
        </p>
        {!aman ? (
          <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 fs-13 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Gerakan ini belum disarankan untuk profilmu (alat, kondisi, atau tingkat). Pilih yang bertanda aman dulu.
          </p>
        ) : null}
        <ol className="list-decimal space-y-1.5 pl-5 fs-15 leading-relaxed text-slate-700 dark:text-slate-300">
          {g.cara.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <p className="rounded-2xl bg-emerald-50 p-3 fs-13 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          {g.tips}
        </p>
        <p className="fs-12 text-slate-400">Berhenti kalau nyeri dada, pusing berat, atau sesak yang tidak biasa.</p>
      </div>
    </SheetShell>
  );
}

export function LatihanView({
  data,
  onChanged,
  onToast,
  onPilihMetode,
}: {
  data: FitData;
  onChanged: () => Promise<void>;
  onToast: (m: string) => void;
  onPilihMetode: () => void;
}) {
  const aman = useMemo(() => (data.profile ? gerakanAman(GERAKAN, data.profile) : GERAKAN), [data.profile]);
  const amanSet = useMemo(() => new Set(aman.map((g) => g.key)), [aman]);
  const kg = data.profile?.weightKg ?? 70;
  const prog = data.program;
  const hari = prog ? hariKe(prog.start, data.today) : 0;
  const hariIni = prog?.plan ? latihanHariIni(prog.plan, hari) : null;
  const sudah = prog ? data.workouts.some((w) => w.program_id === prog.id && w.date === data.today) : false;
  const [busy, setBusy] = useState(false);
  const [pilih, setPilih] = useState(aman.find((g) => g.key === 'jalan-kaki')?.key ?? aman[0]?.key ?? '');
  const [set, setSet] = useState('1');
  const [jumlah, setJumlah] = useState('15');
  const [kat, setKat] = useState<GerakanKategori | 'semua'>('semua');
  const [detail, setDetail] = useState<Gerakan | null>(null);

  const catat = async (items: LatihanItem[], programId?: string) => {
    setBusy(true);
    try {
      const r = await saveWorkout({ id: crypto.randomUUID(), date: data.today, items, programId });
      onToast(`Latihan tercatat: ±${r.minutes} menit, ±${r.kcal} kkal.`);
      await onChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal mencatat latihan.');
    } finally {
      setBusy(false);
    }
  };
  const g = GERAKAN_BY_KEY[pilih];

  return (
    <div className="space-y-4">
      {prog && hariIni ? (
        <div className={card}>
          <p className="fs-12 font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Hari {hari} dari 28 · Minggu {hariIni.minggu.ke}
          </p>
          <p className="mt-1 fsh-22 font-black tracking-tight text-slate-900 dark:text-white">
            {hariIni.latihan.judul}
          </p>
          {hariIni.latihan.gerakan.length ? (
            <>
              <p className="fs-13 text-slate-500 dark:text-slate-400">
                ±{perkiraanLatihan(hariIni.latihan.gerakan, GERAKAN_BY_KEY, kg).menit} menit · ±
                {perkiraanLatihan(hariIni.latihan.gerakan, GERAKAN_BY_KEY, kg).kkal} kkal. Ketuk gerakan untuk lihat
                caranya.
              </p>
              <ul className="mt-3 space-y-2">
                {hariIni.latihan.gerakan.map((it) => (
                  <GerakanBaris key={it.key} it={it} />
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || sudah}
                onClick={() => catat(hariIni.latihan.gerakan, prog.id)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 fs-15 font-black text-slate-950 disabled:opacity-60"
              >
                <Check size={18} />{' '}
                {sudah ? 'Latihan hari ini sudah tercatat' : busy ? 'Menyimpan…' : 'Selesai — catat latihan'}
              </button>
            </>
          ) : (
            <p className="mt-1 fs-14 leading-relaxed text-slate-600 dark:text-slate-300">
              Hari ini istirahat. Tetap bergerak ringan — jalan santai 10–20 menit sudah bagus. Catat di bawah kalau
              kamu melakukannya.
            </p>
          )}
        </div>
      ) : (
        <div className={cn(card, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
          <div>
            <p className="fs-15 font-black text-slate-900 dark:text-white">Belum ada program latihan</p>
            <p className="fs-13 text-slate-500 dark:text-slate-400">
              Pilih metode diet, lalu Leo menyusun latihan harian 4 minggu sesuai tubuh & alatmu.
            </p>
          </div>
          <button
            type="button"
            onClick={onPilihMetode}
            className="h-11 shrink-0 rounded-full bg-slate-950 px-5 fs-14 font-black text-white dark:bg-white dark:text-slate-900"
          >
            Pilih metode
          </button>
        </div>
      )}

      <div className={card}>
        <p className="fs-15 font-black text-slate-900 dark:text-white">Catat latihan lain</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            value={pilih}
            onChange={(e) => {
              setPilih(e.target.value);
              const b = GERAKAN_BY_KEY[e.target.value]?.bawaan;
              if (b) {
                setSet(String(b.set));
                setJumlah(String(b.jumlah));
              }
            }}
            className="col-span-2 h-12 rounded-2xl border border-slate-200 bg-white px-3 fs-14 font-semibold text-slate-900 sm:col-span-1 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            aria-label="Gerakan"
          >
            {aman.map((x) => (
              <option key={x.key} value={x.key}>
                {x.emoji} {x.nama}
              </option>
            ))}
          </select>
          <input
            className="h-12 rounded-2xl border border-slate-200 bg-white px-3 fs-14 font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            inputMode="numeric"
            value={set}
            onChange={(e) => setSet(e.target.value)}
            aria-label="Set"
            placeholder="Set"
          />
          <input
            className="h-12 rounded-2xl border border-slate-200 bg-white px-3 fs-14 font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            inputMode="numeric"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            aria-label={
              g
                ? g.satuan === 'ulang'
                  ? 'Ulangan per set'
                  : g.satuan === 'detik'
                    ? 'Detik per set'
                    : 'Menit'
                : 'Jumlah'
            }
            placeholder={g?.satuan === 'ulang' ? 'Ulangan' : g?.satuan === 'detik' ? 'Detik' : 'Menit'}
          />
          <button
            type="button"
            disabled={busy || !g}
            onClick={() => catat([{ key: pilih, set: Number(set) || 1, jumlah: Number(jumlah) || 1 }])}
            className="col-span-2 flex h-12 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-5 fs-14 font-black text-white disabled:opacity-50 sm:col-span-1 dark:bg-white dark:text-slate-900"
          >
            <Plus size={16} /> Catat
          </button>
        </div>
        {g ? (
          <p className="mt-2 fs-12 text-slate-500 dark:text-slate-400">
            Satuan: {g.satuan === 'ulang' ? 'set × ulangan' : g.satuan === 'detik' ? 'set × detik' : 'set × menit'}.
            Dosis pemula {dosis(g, g.bawaan)}.
          </p>
        ) : null}
      </div>

      {data.workouts.length ? (
        <div className={card}>
          <p className="fs-15 font-black text-slate-900 dark:text-white">Riwayat latihan</p>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {data.workouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate fs-14 font-bold text-slate-900 dark:text-white">
                    {w.items.map((it) => GERAKAN_BY_KEY[it.key]?.nama ?? it.key).join(', ')}
                  </p>
                  <p className="fs-12 text-slate-500 dark:text-slate-400">
                    {new Date(`${w.date}T00:00:00`).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {w.minutes ? ` · ±${w.minutes} menit` : ''}
                    {w.kcal ? ` · ±${w.kcal} kkal` : ''}
                    {w.kind === 'program' ? ' · program' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Hapus catatan latihan"
                  onClick={async () => {
                    await deleteWorkout(w.id).catch(() => undefined);
                    await onChanged();
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          {data.historyDays ? (
            <p className="mt-2 fs-12 text-slate-500 dark:text-slate-400">
              Akun Gratis melihat {data.historyDays} hari terakhir.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="fs-16 font-black text-slate-900 dark:text-white">Perpustakaan gerakan</p>
          <p className="fs-12 text-slate-500 dark:text-slate-400">{aman.length} aman untukmu</p>
        </div>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {KATEGORI.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKat(k.key)}
              aria-pressed={kat === k.key}
              className={cn(
                'h-10 shrink-0 rounded-full px-4 fs-13 font-bold',
                kat === k.key
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {GERAKAN.filter((x) => kat === 'semua' || x.kategori === kat).map((x) => {
            const ok = amanSet.has(x.key);
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => setDetail(x)}
                className={cn(
                  'flex flex-col rounded-[22px] bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800',
                  !ok && 'opacity-55',
                )}
              >
                <span className="text-[30px] leading-none">{x.emoji}</span>
                <span className="mt-2 fs-14 font-black leading-tight text-slate-900 dark:text-white">{x.nama}</span>
                <span className="mt-1 fs-12 text-slate-500 dark:text-slate-400">{x.otot}</span>
                <span className="mt-2 flex flex-wrap gap-1">
                  {x.duduk ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 fs-11 font-bold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
                      Duduk
                    </span>
                  ) : null}
                  {ok ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 fs-11 font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Aman untukmu
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 fs-12 text-slate-400 dark:text-slate-500">
          Ilustrasi gerakan menyusul. Mulai pelan, berhenti kalau nyeri dada, pusing berat, atau sesak tidak biasa.
        </p>
      </div>

      {detail ? <DetailGerakan g={detail} aman={amanSet.has(detail.key)} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
