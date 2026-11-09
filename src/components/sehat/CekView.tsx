'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck2, ExternalLink, Gift, MessageCircle, Pencil, Syringe, Trash2, UserRound } from 'lucide-react';
import { Field, inputCls, MoneyInput, PrimaryButton, SheetShell } from '@/components/sehat/AsuransiSheets';
import {
  ageOf,
  appliesTo,
  bmiClass,
  bmiOf,
  CHECK_ITEMS,
  checkService,
  CKG_SOURCE,
  nextDueOf,
  RESULT_FIELDS,
  VACCINES,
  type CheckItem,
  type CheckRecord,
  type ChecksData,
  type HealthProfile,
  type ResultField,
  type Sex,
} from '@/lib/healthChecks';
import { daysUntil } from '@/lib/health';
import { newRequestId } from '@/lib/meals';
import { wibToday } from '@/lib/stories';
import { cn, formatIDR } from '@/lib/utils';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${BULAN[m - 1]} ${y}`;
};
type Status = 'none' | 'ok' | 'soon' | 'late';
const statusOf = (last: CheckRecord | undefined, today: string): { s: Status; next?: string } => {
  if (!last) return { s: 'none' };
  const next = nextDueOf(last.date);
  const d = daysUntil(next, today);
  return { s: d < 0 ? 'late' : d <= 30 ? 'soon' : 'ok', next };
};
const STATUS_STYLE: Record<Status, { bar: string; chip: string; label: (next?: string) => string }> = {
  none: {
    bar: 'bg-slate-200 dark:bg-slate-700',
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    label: () => 'Belum dicatat',
  },
  ok: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    label: (n) => `Aman · lagi ${n ? dmy(n) : ''}`,
  },
  soon: {
    bar: 'bg-amber-400',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: (n) => `Segera · ${n ? dmy(n) : ''}`,
  },
  late: {
    bar: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    label: () => 'Lewat setahun',
  },
};

function ProfileSheet({
  profile,
  today,
  onClose,
  onSaved,
}: {
  profile: HealthProfile | null;
  today: string;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [year, setYear] = useState(profile ? String(profile.birthYear) : '');
  const [sex, setSex] = useState<Sex | ''>(profile?.sex ?? '');
  const [catin, setCatin] = useState(Boolean(profile?.catin));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const y = Number(year);
    if (!(y >= 1900 && y <= Number(today.slice(0, 4))) || !sex) return setErr('Isi tahun lahir dan jenis kelamin.');
    setBusy(true);
    try {
      await checkService.saveProfile({ birthYear: y, sex, catin });
      onSaved('Profil tersimpan — daftar cek disesuaikan.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <SheetShell
      title="Sesuaikan daftar cekmu"
      onClose={onClose}
      footer={
        <PrimaryButton busy={busy} onClick={() => void save()}>
          Simpan
        </PrimaryButton>
      }
    >
      {err ? <p className="rounded-2xl bg-rose-50 px-3.5 py-2.5 fs-13 font-semibold text-rose-700">{err}</p> : null}
      <Field label="Tahun lahir">
        <input
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="mis. 1995"
          className={inputCls}
        />
      </Field>
      <div>
        <span className="mb-1 block fs-11 font-bold uppercase tracking-widest text-slate-400">Jenis kelamin</span>
        <div className="flex gap-2">
          {(
            [
              ['p', 'Perempuan'],
              ['l', 'Laki-laki'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setSex(v)}
              className={cn(
                'flex-1 rounded-xl py-2.5 fs-14 font-bold',
                sex === v
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
        <input
          type="checkbox"
          checked={catin}
          onChange={(e) => setCatin(e.target.checked)}
          className="h-5 w-5 accent-teal-600"
        />
        <span className="fs-13 font-semibold text-slate-700 dark:text-slate-200">
          Saya calon pengantin
          <span className="block fs-11.5 font-medium text-slate-500">
            Menampilkan pemeriksaan khusus calon pengantin.
          </span>
        </span>
      </label>
      <p className="fs-12 text-slate-500">
        Dipakai hanya untuk menyaring daftar cek sesuai usia & jenis kelamin. Hanya kamu yang melihatnya.
      </p>
    </SheetShell>
  );
}

// Grafik tren kecil per angka hasil: titik terlama di kiri, nilai terakhir disorot.
function TrendChart({ field, points }: { field: ResultField; points: { date: string; v: number }[] }) {
  if (!points.length) return null;
  const W = 280;
  const H = 64;
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  const y = (v: number) => H - 8 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 16);
  const x = (i: number) => (points.length === 1 ? W / 2 : 10 + (i * (W - 20)) / (points.length - 1));
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const diff = prev ? Math.round((last.v - prev.v) * 10) / 10 : null;
  const fmt = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <div className="flex items-baseline justify-between">
        <span className="fs-12 font-bold text-slate-500">{field.label}</span>
        <span className="fs-13 font-black text-slate-800 dark:text-slate-100">
          {fmt(last.v)} <span className="fs-11 font-semibold text-slate-400">{field.unit}</span>
          {diff !== null && diff !== 0 ? (
            <span className="ml-1.5 fs-11 font-bold text-slate-500">
              {diff > 0 ? '▲' : '▼'} {fmt(Math.abs(diff))}
            </span>
          ) : null}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-16 w-full" role="img" aria-label={`Tren ${field.label}`}>
        {points.length > 1 ? (
          <polyline
            points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke="#0d9488"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.v)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? '#0d9488' : '#99f6e4'}
          >
            <title>{`${dmy(p.date)}: ${fmt(p.v)} ${field.unit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between fs-10.5 text-slate-400">
        <span>{dmy(points[0].date)}</span>
        {points.length > 1 ? <span>{dmy(last.date)}</span> : null}
      </div>
    </div>
  );
}

function CheckSheet({
  item,
  records,
  accounts,
  today,
  vaccine,
  onClose,
  onSaved,
}: {
  item: { key: string; label: string; desc?: string; note?: string; minAge?: number };
  records: CheckRecord[];
  accounts: { id: string; name: string }[];
  today: string;
  vaccine?: boolean;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const rid = useRef(newRequestId());
  const [date, setDate] = useState(today);
  const [place, setPlace] = useState('');
  const [free, setFree] = useState(!vaccine);
  const [cost, setCost] = useState('');
  const [acc, setAcc] = useState(accounts[0]?.id ?? '');
  const [dose, setDose] = useState(String((records.length || 0) + 1));
  const [note, setNote] = useState('');
  const fields = useMemo(() => (vaccine ? [] : (RESULT_FIELDS[item.key] ?? [])), [vaccine, item.key]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const results = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of fields) {
      const v = Number((vals[f.key] ?? '').replace(',', '.'));
      if (vals[f.key] && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = Math.round(v * 10) / 10;
    }
    return out;
  }, [fields, vals]);
  const badField = fields.find((f) => vals[f.key] && results[f.key] === undefined);
  const bmi = item.key === 'status-gizi' ? bmiOf(results) : null;
  const history = useMemo(() => records.filter((r) => r.results && Object.keys(r.results).length).reverse(), [records]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const costNum = Number(cost.replace(/\D/g, '')) || 0;
  const save = async () => {
    if (!free && costNum && !acc) return setErr('Pilih rekening untuk biayanya.');
    if (badField)
      return setErr(`${badField.label} di luar batas wajar (${badField.min}–${badField.max} ${badField.unit}).`);
    setBusy(true);
    setErr('');
    try {
      const r = await checkService.add({
        request_id: rid.current,
        item_key: item.key,
        label: item.label,
        date,
        place,
        free,
        cost: free ? null : costNum || null,
        account_id: !free && costNum ? acc : null,
        dose: vaccine ? Number(dose) || null : null,
        note,
        ...(Object.keys(results).length ? { results } : {}),
      });
      const base = r.tx_id ? `Tercatat · ${formatIDR(costNum)} masuk ke biaya kesehatan.` : `${item.label} tercatat.`;
      onSaved(
        Object.keys(results).length && r.results_saved === false
          ? `${base} Angka hasil belum bisa disimpan, coba lagi nanti.`
          : base,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      const r = await checkService.remove(id);
      onSaved(r.tx_kept ? 'Catatan dihapus. Biayanya tetap ada di Transaksi.' : 'Catatan dihapus.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  };
  return (
    <SheetShell
      title={item.label}
      onClose={onClose}
      footer={
        <PrimaryButton busy={busy} onClick={() => void save()}>
          {vaccine ? 'Catat dosis' : 'Catat cek'}
        </PrimaryButton>
      }
    >
      {err ? <p className="rounded-2xl bg-rose-50 px-3.5 py-2.5 fs-13 font-semibold text-rose-700">{err}</p> : null}
      {item.desc ? <p className="fs-13.5 leading-relaxed text-slate-600 dark:text-slate-300">{item.desc}</p> : null}
      {!vaccine ? (
        <div className="rounded-2xl bg-teal-50 p-3.5 fs-12.5 leading-relaxed text-teal-900 dark:bg-teal-500/10 dark:text-teal-100">
          <b>Termasuk Cek Kesehatan Gratis</b> — setahun sekali di puskesmas/fasilitas kesehatan tingkat pertama.
          {item.minAge ? ` Mulai usia ${item.minAge} tahun.` : ''}
          {item.note ? ` ${item.note}` : ''}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-3.5 fs-12.5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Jadwal & jumlah dosis mengikuti anjuran dokter/tenaga kesehatanmu.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tanggal">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        {vaccine ? (
          <Field label="Dosis ke-">
            <input
              inputMode="numeric"
              value={dose}
              onChange={(e) => setDose(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className={inputCls}
            />
          </Field>
        ) : (
          <Field label="Tempat">
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={80}
              placeholder="mis. Puskesmas"
              className={inputCls}
            />
          </Field>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={free}
          onChange={(e) => setFree(e.target.checked)}
          className="h-5 w-5 accent-teal-600"
        />
        <span className="fs-13 font-bold text-slate-700 dark:text-slate-200">
          {vaccine ? 'Gratis (program pemerintah)' : 'Lewat Cek Kesehatan Gratis'}
        </span>
      </label>
      {!free ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Biaya">
            <MoneyInput value={cost} onChange={setCost} />
          </Field>
          <Field label="Dari rekening">
            {accounts.length ? (
              <select value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Rekening" className={inputCls}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block pt-2 fs-12 text-slate-500">Tambah rekening dulu.</span>
            )}
          </Field>
        </div>
      ) : null}
      {fields.length ? (
        <div>
          <div
            className={cn(
              'grid gap-2',
              fields.length === 1 ? 'grid-cols-1' : fields.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
            )}
          >
            {fields.map((f) => (
              <Field key={f.key} label={`${f.label} (${f.unit})`}>
                <input
                  inputMode="decimal"
                  value={vals[f.key] ?? ''}
                  onChange={(e) =>
                    setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) }))
                  }
                  placeholder="opsional"
                  className={inputCls}
                />
              </Field>
            ))}
          </div>
          {bmi ? (
            <p className="mt-2 fs-12.5 text-slate-600 dark:text-slate-300">
              IMT <b>{bmi.toLocaleString('id-ID')}</b> · {bmiClass(bmi)}{' '}
              <span className="text-slate-400">(klasifikasi Kemenkes untuk dewasa)</span>
            </p>
          ) : null}
          <p className="mt-1.5 fs-11.5 text-slate-400">
            Angka dicatat untuk melihat tren. Artinya untukmu, tanyakan ke tenaga kesehatan.
          </p>
        </div>
      ) : null}
      {history.length ? (
        <div className="space-y-2">
          <h3 className="fs-13 font-black text-slate-800 dark:text-slate-100">Tren hasil</h3>
          {fields.map((f) => (
            <TrendChart
              key={f.key}
              field={f}
              points={history
                .filter((r) => r.results?.[f.key] != null)
                .map((r) => ({ date: r.date, v: r.results![f.key] }))}
            />
          ))}
          {item.key === 'status-gizi' && history.some((r) => bmiOf(r.results)) ? (
            <TrendChart
              field={{ key: 'imt', label: 'IMT', unit: 'kg/m²', min: 0, max: 99 }}
              points={history.filter((r) => bmiOf(r.results)).map((r) => ({ date: r.date, v: bmiOf(r.results)! }))}
            />
          ) : null}
        </div>
      ) : null}
      <Field label="Catatan hasil (opsional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder={vaccine ? 'mis. merek vaksin' : 'mis. 120/80, normal'}
          className={inputCls}
        />
      </Field>
      {records.length ? (
        <div>
          <h3 className="mb-2 fs-13 font-black text-slate-800 dark:text-slate-100">Riwayat</h3>
          <div className="space-y-1.5">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="fs-13 font-bold text-slate-800 dark:text-slate-100">
                    {dmy(r.date)}
                    {r.dose ? ` · dosis ${r.dose}` : ''}
                  </div>
                  <div className="truncate fs-12 text-slate-500">
                    {[
                      fields
                        .filter((f) => r.results?.[f.key] != null)
                        .map((f) => `${f.label} ${r.results![f.key].toLocaleString('id-ID')}`)
                        .join(', ') || null,
                      r.place,
                      r.free ? 'gratis' : r.cost ? formatIDR(r.cost) : null,
                      r.note,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Hapus catatan"
                  onClick={() => void remove(r.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SheetShell>
  );
}

export function CekView({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<ChecksData | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<
    { t: 'profile' } | { t: 'item'; item: CheckItem } | { t: 'vaccine'; key: string; label: string } | null
  >(null);
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await checkService.load());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ambil catatan cek saat tab dibuka
    void load();
  }, [load]);
  const done = (m: string) => {
    setSheet(null);
    onToast(m);
    void load();
  };

  const today = data?.today ?? wibToday();
  const profile = data?.profile ?? null;
  const records = useMemo(() => data?.records ?? [], [data]);
  const lastOf = useMemo(() => {
    const m = new Map<string, CheckRecord>();
    for (const r of records) if (!m.has(r.item_key)) m.set(r.item_key, r);
    return m;
  }, [records]);
  const age = ageOf(profile, today);
  const items = CHECK_ITEMS.filter((i) => showAll || appliesTo(i, profile, today));
  const applicable = CHECK_ITEMS.filter((i) => appliesTo(i, profile, today));
  const doneCount = applicable.filter(
    (i) => statusOf(lastOf.get(i.key), today).s === 'ok' || statusOf(lastOf.get(i.key), today).s === 'soon',
  ).length;
  const lateCount = applicable.filter((i) => statusOf(lastOf.get(i.key), today).s === 'late').length;
  const pct = applicable.length ? doneCount / applicable.length : 0;
  const groups = [...new Set(items.map((i) => i.group))];
  const rank = { late: 0, none: 1, soon: 2, ok: 3 } as const;
  const upcoming = applicable
    .map((item) => ({ item, st: statusOf(lastOf.get(item.key), today) }))
    .sort((a, b) => rank[a.st.s] - rank[b.st.s] || (a.st.next ?? '').localeCompare(b.st.next ?? ''))
    .slice(0, 3);
  const notReady = data?.ready === false;
  const r = 46;
  const c = 2 * Math.PI * r;

  return (
    <div className="space-y-7">
      {notReady ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 fs-13 font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Catatan cek sedang disiapkan di server — info Cek Kesehatan Gratis sudah bisa dibaca.
        </p>
      ) : null}
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-600 via-emerald-500 to-lime-400 p-5 text-white shadow-xl shadow-emerald-500/20 md:p-6">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <div className="relative">
            <button
              type="button"
              onClick={() => setSheet({ t: 'profile' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 fs-12 font-bold backdrop-blur hover:bg-white/30"
            >
              <UserRound size={13} />
              {profile
                ? `${age} tahun · ${profile.sex === 'p' ? 'Perempuan' : 'Laki-laki'}${profile.catin ? ' · catin' : ''}`
                : 'Isi usia & jenis kelamin'}
              <Pencil size={11} />
            </button>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-[108px] w-[108px] shrink-0">
                <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
                  <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
                  <circle
                    cx="54"
                    cy="54"
                    r={r}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - pct)}
                    className="transition-[stroke-dashoffset] duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="fsh-26 font-black leading-none">{doneCount}</span>
                  <span className="fs-11 font-semibold text-white/85">dari {applicable.length}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="fs-18 font-black leading-tight">Rapor cek tahunanmu</div>
                <p className="mt-1 fs-13 text-white/90">
                  {doneCount === 0
                    ? 'Belum ada cek yang dicatat dalam setahun terakhir.'
                    : `${doneCount} cek masih berlaku${lateCount ? ` · ${lateCount} sudah lewat setahun` : ''}.`}
                </p>
                {!profile ? <p className="mt-1 fs-12 text-white/80">Isi usia supaya daftarnya pas untukmu.</p> : null}
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              <div className="fs-11 font-bold uppercase tracking-widest text-white/75">Berikutnya</div>
              {upcoming.map(({ item, st }) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={notReady}
                  onClick={() => setSheet({ t: 'item', item })}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-left backdrop-blur hover:bg-white/25 disabled:opacity-70"
                >
                  <span className="truncate fs-13.5 font-bold">{item.label}</span>
                  <span className="shrink-0 fs-11.5 font-semibold text-white/85">
                    {st.s === 'none' ? 'belum pernah' : st.s === 'late' ? 'lewat setahun' : st.next ? dmy(st.next) : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200/80 md:p-6 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300">
              <Gift size={20} />
            </span>
            <div>
              <h2 className="fs-16 font-black text-slate-900 dark:text-white">Cek Kesehatan Gratis (CKG)</h2>
              <p className="fs-12 text-slate-500 dark:text-slate-400">
                Setahun sekali · jadwal kamu pilih sendiri · di puskesmas
              </p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['Daftar', 'Unduh SATUSEHAT Mobile, isi biodata, pilih tanggal. Sulit? Lewat WA Chatbot Kemenkes.'],
              ['Siapkan', 'Isi kuesioner skrining mandiri. Usia 40+ disarankan puasa 8–10 jam (boleh air putih).'],
              ['Datang', 'Bawa KTP/KK, tiket dari SATUSEHAT/WA, dan Buku Kesehatan Lansia bila punya.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 fs-12 font-black text-white">
                  {i + 1}
                </span>
                <div className="mt-1.5 fs-13 font-bold text-slate-800 dark:text-slate-100">{t}</div>
                <p className="mt-0.5 fs-12 leading-relaxed text-slate-500 dark:text-slate-400">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://wa.me/6281278878812"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 fs-12.5 font-bold text-white"
            >
              <MessageCircle size={14} /> WA Chatbot 0812-7887-8812
            </a>
            <a
              href={CKG_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 fs-12.5 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ExternalLink size={14} /> Petunjuk teknis resmi
            </a>
          </div>
          <p className="mt-3 fs-11 leading-relaxed text-slate-400">
            Sumber: {CKG_SOURCE.title}, dibaca {CKG_SOURCE.readAt.split('-').reverse().join('/')}. Panduan umum — tenaga
            kesehatan bisa menyarankan pemeriksaan lain sesuai kondisimu.
          </p>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="fs-18 font-black tracking-tight text-slate-900 dark:text-white">Cek rutin</h2>
            <p className="fs-12 text-slate-500 dark:text-slate-400">
              Isi paket CKG {age !== null && age >= 60 ? 'lansia' : 'dewasa'} · tap untuk mencatat
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {showAll ? 'Sesuai profilku' : 'Tampilkan semua'}
          </button>
        </div>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-2 px-1 fs-11.5 font-bold uppercase tracking-widest text-slate-400">{g}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items
                  .filter((i) => i.group === g)
                  .map((i) => {
                    const st = statusOf(lastOf.get(i.key), today);
                    const style = STATUS_STYLE[st.s];
                    return (
                      <button
                        key={i.key}
                        type="button"
                        disabled={notReady}
                        onClick={() => setSheet({ t: 'item', item: i })}
                        className="relative flex items-center gap-3 overflow-hidden rounded-[20px] bg-white py-3.5 pl-5 pr-3.5 text-left ring-1 ring-slate-200/80 transition-shadow hover:shadow-md disabled:opacity-70 dark:bg-slate-900 dark:ring-slate-800"
                      >
                        <span className={cn('absolute inset-y-0 left-0 w-1.5', style.bar)} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">
                            {i.label}
                          </span>
                          <span className="block truncate fs-11.5 text-slate-500 dark:text-slate-400">
                            {[
                              i.minAge ? `mulai ${i.minAge} th` : null,
                              i.sex === 'p' ? 'perempuan' : null,
                              lastOf.get(i.key) ? `terakhir ${dmy(lastOf.get(i.key)!.date)}` : 'setahun sekali',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 fs-10.5 font-bold', style.chip)}>
                          {style.label(st.next)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 px-1">
          <h2 className="flex items-center gap-2 fs-18 font-black tracking-tight text-slate-900 dark:text-white">
            <Syringe size={18} className="text-teal-600" /> Kartu vaksinku
          </h2>
          <p className="fs-12 text-slate-500 dark:text-slate-400">
            Catat dosis yang sudah kamu terima · jadwal ikuti anjuran dokter
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {VACCINES.map((v) => {
            const doses = records.filter((r) => r.item_key === v.key);
            return (
              <button
                key={v.key}
                type="button"
                disabled={notReady}
                onClick={() => setSheet({ t: 'vaccine', key: v.key, label: v.label })}
                className={cn(
                  'rounded-[20px] p-3.5 text-left ring-1 transition-shadow hover:shadow-md disabled:opacity-70',
                  doses.length
                    ? 'bg-teal-50 ring-teal-200 dark:bg-teal-500/10 dark:ring-teal-500/30'
                    : 'bg-white ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800',
                )}
              >
                <div className="line-clamp-2 fs-13 font-bold leading-tight text-slate-900 dark:text-white">
                  {v.label}
                </div>
                <div
                  className={cn(
                    'mt-1.5 flex items-center gap-1 fs-11.5 font-semibold',
                    doses.length ? 'text-teal-700 dark:text-teal-300' : 'text-slate-400',
                  )}
                >
                  <CalendarCheck2 size={12} />
                  {doses.length ? `${doses.length} dosis · ${dmy(doses[0].date)}` : 'Belum dicatat'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {sheet?.t === 'profile' ? (
        <ProfileSheet profile={profile} today={today} onClose={() => setSheet(null)} onSaved={done} />
      ) : null}
      {sheet?.t === 'item' ? (
        <CheckSheet
          item={sheet.item}
          records={records.filter((r) => r.item_key === sheet.item.key)}
          accounts={data?.accounts ?? []}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={done}
        />
      ) : null}
      {sheet?.t === 'vaccine' ? (
        <CheckSheet
          item={{ key: sheet.key, label: `Vaksin ${sheet.label}` }}
          records={records.filter((r) => r.item_key === sheet.key)}
          accounts={data?.accounts ?? []}
          today={today}
          vaccine
          onClose={() => setSheet(null)}
          onSaved={done}
        />
      ) : null}
    </div>
  );
}
