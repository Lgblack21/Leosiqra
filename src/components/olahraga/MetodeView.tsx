'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Lock, XCircle } from 'lucide-react';
import { SheetShell } from '@/components/sehat/AsuransiSheets';
import { METODE, METODE_BY_KEY } from '@/lib/olahraga/metode';
import { startProgram, type ProgramAktif } from '@/lib/olahraga/api';
import { PROGRAM_PRICE } from '@/lib/olahraga/program';
import { nilaiKuis, statusMetode, type JawabanSanggup } from '@/lib/olahraga/rules';
import type { FitProfile, Kelompok, Metode, MetodeKey } from '@/lib/olahraga/types';
import { openSettings } from '@/lib/settingsPanel';
import { cn } from '@/lib/utils';

// Tab Metode: 20 metode diet. Semua orang boleh membaca + menjawab pertanyaan (aturan, tanpa AI).
// Mengikuti metode (program 4 minggu disusun AI) = PRO + koin — rilis berikutnya.

const KELOMPOK: { key: Kelompok | 'semua'; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'tanpa-hitung', label: 'Tanpa hitung kalori' },
  { key: 'hitung-kalori', label: 'Hitung kalori' },
  { key: 'puasa', label: 'Jendela makan / puasa' },
  { key: 'pola-makan', label: 'Pola makan' },
];
const TINGKAT_LABEL = { pemula: 'Pemula', menengah: 'Menengah', lanjut: 'Lanjut' } as const;
const TINGKAT_WARNA = {
  pemula: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  menengah: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  lanjut: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
} as const;

// Alternatif yang benar-benar boleh untuk profil ini: alternatif bawaan dulu, lalu metode sekelompok, lalu
// metode pemula lain — supaya metode terkunci tidak menyarankan metode yang juga terkunci.
function saranUntuk(m: Metode, profile: FitProfile | null): MetodeKey[] {
  if (!profile) return [...m.alternatif];
  const urut = [
    ...m.alternatif,
    ...METODE.filter((x) => x.kelompok === m.kelompok).map((x) => x.key),
    ...METODE.filter((x) => x.tingkat === 'pemula').map((x) => x.key),
  ];
  return [...new Set(urut)].filter((k) => k !== m.key && statusMetode(k, profile).boleh).slice(0, 2);
}

function Daftar({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="fs-13 font-black text-slate-900 dark:text-white">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex gap-2 fs-14 leading-relaxed text-slate-700 dark:text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({
  m,
  profile,
  pro,
  app,
  coins,
  aktif,
  onClose,
  onOpen,
  onStarted,
}: {
  m: Metode;
  profile: FitProfile | null;
  pro: boolean;
  app: boolean;
  coins: number | null;
  aktif: ProgramAktif | null;
  onClose: () => void;
  onOpen: (k: MetodeKey) => void;
  onStarted: (p: ProgramAktif) => void;
}) {
  const status = profile ? statusMetode(m.key, profile) : null;
  const saran = saranUntuk(m, profile);
  const [step, setStep] = useState<'baca' | 'tanya' | 'hasil' | 'mulai'>('baca');
  const [requestId] = useState(() => crypto.randomUUID()); // satu id per sheet → klik ganda tidak potong koin dua kali
  const [jamMulai, setJamMulai] = useState('12:00');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const kurang = coins !== null && coins < PROGRAM_PRICE;
  const mulai = async () => {
    setBusy(true);
    setErr('');
    try {
      const p = await startProgram({
        requestId,
        dietKey: m.key,
        jawaban: jawab,
        jendelaMulai: m.jendela ? jamMulai : undefined,
      });
      onStarted(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memulai program. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };
  const [jawab, setJawab] = useState<Record<string, JawabanSanggup | number>>({});
  const lengkap = m.pertanyaan.every((q) => jawab[q.id] !== undefined);
  const hasil = useMemo(
    () => (step === 'hasil' || step === 'mulai' ? nilaiKuis(m.pertanyaan, jawab) : null),
    [step, m, jawab],
  );

  return (
    <SheetShell
      title={`${m.emoji} ${m.nama}`}
      onClose={onClose}
      footer={
        step === 'baca' ? (
          <button
            type="button"
            onClick={() => setStep('tanya')}
            disabled={status ? !status.boleh : false}
            className="h-12 w-full rounded-full bg-slate-950 fs-15 font-black text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            {status && !status.boleh ? 'Tidak disarankan untukmu' : 'Sudah baca — cek kecocokanku'}
          </button>
        ) : step === 'tanya' ? (
          <button
            type="button"
            onClick={() => setStep('hasil')}
            disabled={!lengkap}
            className="h-12 w-full rounded-full bg-slate-950 fs-15 font-black text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            {lengkap ? 'Lihat hasil' : 'Jawab semua pertanyaan dulu'}
          </button>
        ) : hasil?.hasil === 'belum' ? (
          <button
            type="button"
            onClick={() => setStep('tanya')}
            className="h-12 w-full rounded-full bg-slate-100 fs-15 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Ubah jawaban
          </button>
        ) : pro && step === 'mulai' ? (
          <button
            type="button"
            onClick={mulai}
            disabled={busy || kurang}
            className="h-12 w-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 fs-15 font-black text-slate-950 disabled:opacity-60"
          >
            {busy
              ? 'Leo menyusun programmu… (±30 detik)'
              : `Bayar ${PROGRAM_PRICE.toLocaleString('id-ID')} koin & mulai`}
          </button>
        ) : pro ? (
          <button
            type="button"
            onClick={() => setStep('mulai')}
            className="h-12 w-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 fs-15 font-black text-slate-950"
          >
            Ikuti program ini — {PROGRAM_PRICE.toLocaleString('id-ID')} koin
          </button>
        ) : (
          <button
            type="button"
            onClick={app ? undefined : () => openSettings('paket')}
            disabled={app}
            className="h-12 w-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 fs-15 font-black text-slate-950 disabled:opacity-70"
          >
            {app ? 'Ikuti metode ini — khusus akun PRO' : 'Ikuti metode ini — khusus PRO'}
          </button>
        )
      }
    >
      <div className="space-y-5 px-5 pb-6">
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 fs-12 font-bold', TINGKAT_WARNA[m.tingkat])}>
            {TINGKAT_LABEL[m.tingkat]}
          </span>
          {m.hitungKalori ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 fs-12 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Hitung kalori
            </span>
          ) : null}
          {m.jendela ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 fs-12 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Puasa {m.jendela.puasa} jam · makan {m.jendela.makan} jam
            </span>
          ) : null}
        </div>

        {!profile ? (
          <p className="rounded-2xl bg-slate-100 px-4 py-3 fs-13 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Isi profil tubuhmu di tab Program supaya Leo bisa cek apakah metode ini aman untukmu.
          </p>
        ) : null}
        {status && !status.boleh ? (
          <div className="flex gap-3 rounded-2xl bg-rose-50 p-4 fs-13 leading-relaxed text-rose-900 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
            <Lock size={18} className="mt-0.5 shrink-0" />
            <div>
              {status.alasan.map((a) => (
                <p key={a}>{a}</p>
              ))}
              {saran.length ? (
                <p className="mt-2 font-semibold">Coba: {saran.map((k) => METODE_BY_KEY[k].nama).join(' atau ')}.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {status?.peringatan.length ? (
          <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 fs-13 leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              {status.peringatan.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'baca' ? (
          <>
            <div className="space-y-3">
              {m.caraKerja.map((p) => (
                <p key={p} className="fs-15 leading-relaxed text-slate-700 dark:text-slate-300">
                  {p}
                </p>
              ))}
              {m.catatan ? <p className="fs-13 italic text-slate-500 dark:text-slate-400">{m.catatan}</p> : null}
            </div>
            <div>
              <p className="fs-13 font-black text-slate-900 dark:text-white">Contoh sehari</p>
              <ol className="mt-2 space-y-2">
                {m.contohHari.map((c) => (
                  <li
                    key={c.jam + c.isi}
                    className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/60"
                  >
                    <span className="w-14 shrink-0 fs-13 font-black text-emerald-700 dark:text-emerald-400">
                      {c.jam}
                    </span>
                    <span className="fs-14 text-slate-700 dark:text-slate-300">{c.isi}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Daftar title="Kelebihan" items={m.kelebihan} />
            <Daftar title="Tantangan" items={m.tantangan} />
            <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
              <p className="fs-13 font-black text-emerald-900 dark:text-emerald-300">Hasil yang realistis</p>
              <p className="mt-1 fs-14 leading-relaxed text-emerald-900 dark:text-emerald-200">{m.hasilRealistis}</p>
            </div>
          </>
        ) : step === 'tanya' ? (
          <div className="space-y-5">
            <p className="fs-14 text-slate-600 dark:text-slate-300">
              Jawab jujur — tidak ada nilai. Leo pakai jawabanmu untuk bilang metode ini cocok atau tidak.
            </p>
            {m.pertanyaan.map((q, i) => (
              <fieldset key={q.id}>
                <legend className="fs-14 font-bold text-slate-900 dark:text-white">
                  {i + 1}. {q.teks}
                </legend>
                <div className="mt-2 grid gap-2">
                  {(q.jenis === 'sanggup'
                    ? ([
                        ['ya', 'Sanggup'],
                        ['mungkin', 'Mungkin, mau dicoba'],
                        ['tidak', 'Tidak sanggup'],
                      ] as const)
                    : q.pilihan.map((p, idx) => [idx, p] as const)
                  ).map(([val, text]) => {
                    const on = jawab[q.id] === val;
                    return (
                      <button
                        key={String(val)}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setJawab((j) => ({ ...j, [q.id]: val }))}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left fs-14 font-semibold',
                          on
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                            : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200',
                        )}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        ) : step === 'mulai' ? (
          <div className="space-y-4">
            <p className="fs-15 leading-relaxed text-slate-700 dark:text-slate-300">
              Leo menyusun <b>program 4 minggu</b> khusus untuk tubuhmu dengan metode <b>{m.nama}</b>: contoh menu tiap
              minggu, latihan harian yang naik pelan, dan tips. Target kalori & protein memakai hitunganmu di tab
              Program.
            </p>
            {m.jendela ? (
              <label className="block">
                <span className="mb-1.5 block fs-13 font-bold text-slate-700 dark:text-slate-200">
                  Jendela makanmu buka jam ({m.jendela.makan} jam makan)
                </span>
                <select
                  value={jamMulai}
                  onChange={(e) => setJamMulai(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 fs-15 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map((j) => (
                    <option key={j} value={j}>
                      {j} – {String((Number(j.slice(0, 2)) + (m.jendela?.makan ?? 8)) % 24).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="rounded-2xl bg-slate-50 p-4 fs-14 dark:bg-slate-800/60">
              <p className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Biaya program</span>
                <span>{PROGRAM_PRICE.toLocaleString('id-ID')} koin</span>
              </p>
              <p className="mt-1 flex justify-between text-slate-600 dark:text-slate-300">
                <span>Saldo koinmu</span>
                <span>{coins === null ? '–' : coins.toLocaleString('id-ID')} koin</span>
              </p>
            </div>
            {kurang ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 fs-13 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                Koinmu belum cukup. Top up koin di {app ? 'Profil › Koin' : 'Pengaturan › Koin'}, lalu kembali ke sini.
              </p>
            ) : null}
            {aktif ? (
              <p className="fs-13 text-slate-500 dark:text-slate-400">
                Program yang sedang berjalan ({METODE_BY_KEY[aktif.diet_key]?.nama ?? aktif.diet_key}) akan dihentikan
                dan diganti program ini.
              </p>
            ) : null}
            <p className="fs-12 text-slate-500 dark:text-slate-400">
              Kalau Leo gagal menyusun program, koinmu dikembalikan otomatis. Program bukan pengganti saran dokter.
            </p>
            {err ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {err}
              </p>
            ) : null}
          </div>
        ) : hasil ? (
          <div className="space-y-4">
            {hasil.hasil === 'cocok' ? (
              <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                <CheckCircle2 className="shrink-0 text-emerald-600" />
                <div>
                  <p className="fs-16 font-black text-emerald-900 dark:text-emerald-200">Cocok untukmu</p>
                  <p className="fs-14 text-emerald-900 dark:text-emerald-200">Kamu siap menjalani {m.nama}.</p>
                </div>
              </div>
            ) : hasil.hasil === 'catatan' ? (
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <AlertTriangle className="shrink-0 text-amber-600" />
                <div>
                  <p className="fs-16 font-black text-amber-900 dark:text-amber-200">Cocok, dengan catatan</p>
                  <p className="fs-14 leading-relaxed text-amber-900 dark:text-amber-200">{m.bilaMungkin}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-2xl bg-rose-50 p-4 dark:bg-rose-500/10">
                <XCircle className="shrink-0 text-rose-600" />
                <div>
                  <p className="fs-16 font-black text-rose-900 dark:text-rose-200">Belum cocok sekarang</p>
                  {m.pertanyaan
                    .filter((q) => hasil.tidakInti.includes(q.id) && q.jenis === 'sanggup')
                    .map((q) => (
                      <p key={q.id} className="fs-14 leading-relaxed text-rose-900 dark:text-rose-200">
                        {q.jenis === 'sanggup' ? q.bilaTidak : ''}
                      </p>
                    ))}
                </div>
              </div>
            )}
            {m.pertanyaan
              .filter((q) => q.jenis === 'paham' && hasil.salahPaham.includes(q.id))
              .map((q) =>
                q.jenis === 'paham' ? (
                  <div key={q.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                    <p className="fs-13 font-bold text-slate-900 dark:text-white">Biar makin paham: {q.teks}</p>
                    <p className="mt-1 fs-14 text-slate-700 dark:text-slate-300">
                      Jawabannya: <b>{q.pilihan[q.benar]}</b>. {q.penjelasan}
                    </p>
                  </div>
                ) : null,
              )}
            <div>
              <p className="fs-13 font-black text-slate-900 dark:text-white">
                {hasil.hasil === 'belum' ? 'Coba metode lain:' : 'Atau bandingkan dengan:'}
              </p>
              <div className="mt-2 grid gap-2">
                {saran.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onOpen(k)}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left dark:border-slate-700"
                  >
                    <span className="fs-14 font-bold text-slate-900 dark:text-white">
                      {METODE_BY_KEY[k].emoji} {METODE_BY_KEY[k].nama}
                    </span>
                    <ChevronRight size={18} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
            {hasil.hasil !== 'belum' && !pro ? (
              <p className="fs-13 leading-relaxed text-slate-500 dark:text-slate-400">
                Untuk mengikuti metode ini, Leo menyusun program 4 minggu sesuai tubuhmu (menu & latihan harian). Khusus
                PRO, {PROGRAM_PRICE.toLocaleString('id-ID')} koin per program.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </SheetShell>
  );
}

export function MetodeView({
  profile,
  pro,
  app,
  coins,
  aktif,
  onStarted,
}: {
  profile: FitProfile | null;
  pro: boolean;
  app: boolean;
  coins: number | null;
  aktif: ProgramAktif | null;
  onStarted: (p: ProgramAktif) => void;
}) {
  const [filter, setFilter] = useState<Kelompok | 'semua'>('semua');
  const [open, setOpen] = useState<MetodeKey | null>(null);
  const list = METODE.filter((m) => filter === 'semua' || m.kelompok === filter);

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {KELOMPOK.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setFilter(k.key)}
            aria-pressed={filter === k.key}
            className={cn(
              'h-10 shrink-0 rounded-full px-4 fs-13 font-bold',
              filter === k.key
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => {
          const st = profile ? statusMetode(m.key, profile) : null;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setOpen(m.key)}
              className={cn(
                'flex flex-col rounded-[24px] bg-white p-5 text-left shadow-sm ring-1 ring-slate-200/70 transition-transform hover:-translate-y-0.5 dark:bg-slate-900 dark:ring-slate-800',
                st && !st.boleh && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[30px] leading-none">{m.emoji}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 fs-11 font-bold', TINGKAT_WARNA[m.tingkat])}>
                  {TINGKAT_LABEL[m.tingkat]}
                </span>
              </div>
              <p className="mt-3 fs-16 font-black text-slate-900 dark:text-white">{m.nama}</p>
              <p className="mt-1 flex-1 fs-13 leading-relaxed text-slate-500 dark:text-slate-400">{m.ringkas}</p>
              {st && !st.boleh ? (
                <p className="mt-3 flex items-center gap-1.5 fs-12 font-bold text-rose-600 dark:text-rose-400">
                  <Lock size={13} /> Tidak disarankan untukmu
                </p>
              ) : st?.peringatan.length ? (
                <p className="mt-3 flex items-center gap-1.5 fs-12 font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} /> Baca catatan dulu
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="fs-12 leading-relaxed text-slate-400 dark:text-slate-500">
        Informasi umum, bukan pengganti dokter atau ahli gizi. Kalau punya kondisi kesehatan, konsultasikan dulu sebelum
        mengubah pola makan.
      </p>

      {open ? (
        <Detail
          key={open}
          m={METODE_BY_KEY[open]}
          profile={profile}
          pro={pro}
          app={app}
          coins={coins}
          aktif={aktif}
          onClose={() => setOpen(null)}
          onOpen={setOpen}
          onStarted={(p) => {
            setOpen(null);
            onStarted(p);
          }}
        />
      ) : null}
    </div>
  );
}
