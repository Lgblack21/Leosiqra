'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileCheck2, Phone, Plus, Search, ShieldCheck, Wallet } from 'lucide-react';
import {
  ClaimSheet,
  CostSheet,
  InsurerSheet,
  InsurerTile,
  PaySheet,
  PolicySheet,
} from '@/components/sehat/AsuransiSheets';
import {
  CLAIM_STEPS,
  daysUntil,
  healthService,
  PERIODS,
  POLICY_KINDS,
  type Claim,
  type HealthSummary,
  type Policy,
} from '@/lib/health';
import { INSURERS, insurerByKey, prettyPhone, telHref, type Insurer } from '@/lib/insurers';
import { wibToday } from '@/lib/stories';
import { cn, formatIDR } from '@/lib/utils';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const num = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
const short = (n: number) =>
  n >= 1_000_000_000
    ? `Rp${(n / 1e9).toFixed(1).replace('.', ',')} M`
    : n >= 1_000_000
      ? `Rp${(n / 1e6).toFixed(1).replace('.', ',')} jt`
      : n >= 1000
        ? `Rp${num(n / 1000)} rb`
        : `Rp${num(n)}`;
const dmy = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${BULAN[m - 1]} ${y}`;
};
const mask = (no: string | null) => (no ? `•••• ${no.replace(/\s/g, '').slice(-4)}` : '•••• ••••');

type Sheet =
  | { t: 'cost' }
  | { t: 'policy'; policy?: Policy | null; preset?: Insurer | null }
  | { t: 'pay'; policy: Policy }
  | { t: 'claim'; claim?: Claim | null }
  | { t: 'insurer'; insurer: Insurer };

const dueText = (due: string, today: string) => {
  const d = daysUntil(due, today);
  return d < 0 ? `Lewat ${-d} hari` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`;
};

function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        <h2 className="text-[18px] font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {sub ? <p className="text-[12px] text-slate-500 dark:text-slate-400">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}
const addBtn =
  'inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900';

// Kartu polis bergaya kartu fisik (warna perusahaan), seperti kartu kredit di Leosiqra.
function PolicyCard({
  p,
  today,
  onOpen,
  onPay,
  onInfo,
}: {
  p: Policy;
  today: string;
  onOpen: () => void;
  onPay: () => void;
  onInfo: (i: Insurer) => void;
}) {
  const ins = insurerByKey(p.insurer_key);
  const phone = p.call_center || ins?.phone;
  const soon = p.next_due ? daysUntil(p.next_due, today) <= 3 : false;
  return (
    <div className="w-[292px] shrink-0 snap-start sm:w-[320px]">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'relative block aspect-[1.62] w-full overflow-hidden rounded-[22px] p-4 text-left text-white shadow-lg transition-transform hover:-translate-y-0.5',
          ins?.color ?? 'bg-teal-600',
        )}
      >
        <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/35" aria-hidden />
        <span className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <span className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-black/10" aria-hidden />
        <span className="relative flex h-full flex-col">
          <span className="flex items-start justify-between gap-2">
            <InsurerTile insurer={ins} name={p.insurer_name} size={40} />
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">
              {POLICY_KINDS.find((k) => k.id === p.kind)?.label}
            </span>
          </span>
          <span className="mt-auto block">
            <span className="block truncate text-[16px] font-black leading-tight">{p.insurer_name}</span>
            <span className="block truncate text-[12px] text-white/80">{p.product ?? 'Polis'}</span>
            <span className="mt-1.5 block font-mono text-[13px] tracking-[0.18em] text-white/90">
              {mask(p.policy_no)}
            </span>
          </span>
          <span className="mt-2 flex items-end justify-between gap-2">
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/70">Premi</span>
              <span className="block text-[15px] font-black">
                {p.premium ? short(p.premium) : '–'}
                <span className="text-[11px] font-semibold text-white/75">
                  {' '}
                  {PERIODS.find((x) => x.id === p.period)?.label.toLowerCase()}
                </span>
              </span>
            </span>
            {p.next_due ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  soon ? 'bg-white text-rose-600' : 'bg-white/20 text-white backdrop-blur',
                )}
              >
                <CalendarClock size={11} /> {dueText(p.next_due, today)}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <div className="mt-2 flex gap-2">
        {p.premium && p.period !== 'sekali' ? (
          <button
            type="button"
            onClick={onPay}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-50 px-2 text-[13px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Wallet size={15} /> Bayar premi
          </button>
        ) : null}
        {phone ? (
          <a
            href={telHref(phone)}
            aria-label={`Telepon ${prettyPhone(phone)}`}
            className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[13px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Phone size={14} className="shrink-0" /> <span className="truncate">{prettyPhone(phone)}</span>
          </a>
        ) : null}
        {ins ? (
          <button
            type="button"
            onClick={() => onInfo(ins)}
            className="flex h-10 items-center justify-center rounded-xl bg-slate-100 px-3 text-[13px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Info
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AsuransiView({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await healthService.summary());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ambil ringkasan asuransi saat tab dibuka
    void load();
  }, [load]);
  const done = (m: string) => {
    setSheet(null);
    onToast(m);
    void load();
  };

  const today = data?.today ?? wibToday();
  const policies = useMemo(() => data?.policies ?? [], [data]);
  const claims = data?.claims ?? [];
  const accounts = data?.accounts ?? [];
  const costs = data?.costs;
  const maxMonth = Math.max(1, ...(costs?.byMonth ?? [0]));
  const thisMonth = Number(today.slice(5, 7)) - 1;
  const yearlyPremium = policies.reduce(
    (a, p) => a + (p.premium ?? 0) * (PERIODS.find((x) => x.id === p.period)?.perYear ?? 0),
    0,
  );
  const coverage = policies.reduce((a, p) => a + (p.coverage ?? 0), 0);
  const pendingClaims = claims.filter((c) => c.status === 'diajukan' || c.status === 'disetujui');
  const pendingMoney = pendingClaims.reduce((a, c) => a + (c.approved_amount ?? c.amount), 0);
  const nextDue = policies.filter((p) => p.next_due).sort((a, b) => (a.next_due! < b.next_due! ? -1 : 1))[0];
  const notReady = data?.ready === false;
  const dir = INSURERS.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-7">
      {notReady ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Polisku & klaim sedang disiapkan di server — biaya kesehatan & daftar asuransi sudah bisa dipakai.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* Ringkasan: biaya setahun + perlindungan */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-500 p-5 text-white shadow-xl shadow-emerald-500/20 md:p-6">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <div className="relative">
            <div className="text-[13px] font-semibold text-white/85">
              Biaya kesehatanmu di {data?.year ?? today.slice(0, 4)}
            </div>
            <div className="mt-1 text-[32px] font-black leading-tight tracking-tight">
              {formatIDR(costs?.total ?? 0)}
            </div>
            <div className="mt-4 flex h-20 items-end gap-1.5">
              {(costs?.byMonth ?? Array(12).fill(0)).map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <span
                      title={`${BULAN[i]}: ${formatIDR(v)}`}
                      className={cn('w-full rounded-md', i === thisMonth ? 'bg-white' : 'bg-white/35')}
                      style={{ height: `${v ? Math.max(8, (v / maxMonth) * 100) : 4}%` }}
                    />
                  </div>
                  <span className="text-[9.5px] font-semibold text-white/75">{BULAN[i][0]}</span>
                </div>
              ))}
            </div>
            {costs?.bySub.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {costs.bySub.slice(0, 6).map((s) => (
                  <span
                    key={s.sub}
                    className="rounded-full bg-white/18 px-2.5 py-1 text-[12px] font-bold backdrop-blur"
                  >
                    {s.sub} {short(s.total)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-white/85">
                Diambil dari transaksi kategori Kesehatan: obat, dokter, RS, lab, dan premi.
              </p>
            )}
            <button
              type="button"
              onClick={() => setSheet({ t: 'cost' })}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-bold text-emerald-700 shadow-lg"
            >
              <Plus size={17} /> Catat biaya kesehatan
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {[
            {
              label: 'Premi setahun',
              value: policies.length ? short(yearlyPremium) : '–',
              sub: `${policies.length} polis`,
            },
            { label: 'Total perlindungan', value: coverage ? short(coverage) : '–', sub: 'uang pertanggungan' },
            {
              label: 'Klaim belum cair',
              value: pendingClaims.length ? short(pendingMoney) : 'Rp0',
              sub: `${pendingClaims.length} klaim berjalan`,
            },
            {
              label: 'Premi berikutnya',
              value: nextDue?.next_due ? dueText(nextDue.next_due, today) : '–',
              sub: nextDue ? nextDue.insurer_name : 'belum ada jadwal',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">{s.label}</div>
              <div className="mt-0.5 truncate text-[18px] font-black text-slate-900 dark:text-white">{s.value}</div>
              <div className="truncate text-[11.5px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </section>
      </div>

      {/* Polisku: kartu asuransi yang bisa digeser */}
      <section>
        <SectionHead
          title="Polisku"
          sub="Leo ingatkan H-3 & H-1 sebelum premi jatuh tempo"
          action={
            <button type="button" disabled={notReady} onClick={() => setSheet({ t: 'policy' })} className={addBtn}>
              <Plus size={14} /> Tambah polis
            </button>
          }
        />
        {data ? (
          <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:-mx-1 md:scroll-px-1 md:px-1">
            {policies.map((p) => (
              <PolicyCard
                key={p.id}
                p={p}
                today={today}
                onOpen={() => setSheet({ t: 'policy', policy: p })}
                onPay={() => setSheet({ t: 'pay', policy: p })}
                onInfo={(i) => setSheet({ t: 'insurer', insurer: i })}
              />
            ))}
            <button
              type="button"
              disabled={notReady}
              onClick={() => setSheet({ t: 'policy' })}
              className="flex aspect-[1.62] w-[292px] shrink-0 snap-start flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-slate-300 text-center disabled:opacity-60 sm:w-[320px] dark:border-slate-700"
            >
              <ShieldCheck size={30} className="text-teal-500" />
              <span className="mt-2 text-[15px] font-bold text-slate-700 dark:text-slate-200">
                {policies.length ? 'Tambah polis lain' : 'Simpan polis pertamamu'}
              </span>
              <span className="mt-1 max-w-[220px] text-[12.5px] text-slate-500 dark:text-slate-400">
                BPJS, swasta, atau dari kantor
              </span>
            </button>
          </div>
        ) : (
          <div className="h-[180px] animate-pulse rounded-[22px] bg-slate-100 dark:bg-slate-800" />
        )}
      </section>

      {/* Klaim */}
      <section>
        <SectionHead
          title="Klaim"
          sub={
            pendingClaims.length
              ? `${pendingClaims.length} berjalan · ${short(pendingMoney)} belum cair`
              : 'Lacak reimburse sampai uangnya masuk'
          }
          action={
            <button type="button" disabled={notReady} onClick={() => setSheet({ t: 'claim' })} className={addBtn}>
              <Plus size={14} /> Catat klaim
            </button>
          }
        />
        {claims.length === 0 ? (
          <p className="rounded-[22px] bg-slate-50 px-4 py-5 text-center text-[13px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <FileCheck2 size={22} className="mx-auto mb-1.5 text-slate-400" />
            Ajukan reimburse? Catat di sini — saat cair, uangnya langsung tercatat sebagai pemasukan.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {claims.map((c) => {
              const step = c.status === 'ditolak' ? -1 : CLAIM_STEPS.findIndex((s) => s.id === c.status);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSheet({ t: 'claim', claim: c })}
                  className="w-full rounded-[22px] bg-white p-4 text-left ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{c.title}</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400">
                        {c.insurer_name ?? 'Tanpa polis'} · {dmy(c.submitted_at)}
                      </div>
                      {c.status === 'diajukan' && -daysUntil(c.submitted_at, today) >= 14 && (
                        <div className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Belum ada kabar {-daysUntil(c.submitted_at, today)} hari · hubungi asuransi
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-[14px] font-black text-slate-900 dark:text-white">
                      {short(c.approved_amount ?? c.amount)}
                    </div>
                  </div>
                  {c.status === 'ditolak' ? (
                    <span className="mt-2 inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-[11.5px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                      Ditolak
                    </span>
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5">
                      {CLAIM_STEPS.map((s, i) => (
                        <div key={s.id} className="flex flex-1 flex-col gap-1">
                          <span
                            className={cn(
                              'h-1.5 rounded-full',
                              i <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700',
                            )}
                          />
                          <span
                            className={cn(
                              'text-[10.5px] font-semibold',
                              i <= step ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400',
                            )}
                          >
                            {s.label}
                            {s.id === 'cair' && c.recorded ? ' ✓' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Daftar asuransi: grid logo */}
      <section>
        <SectionHead title="Kenali asuransinya" sub="Kontak & tautan resmi, dibaca dari situs tiap perusahaan" />
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari asuransi"
            className="w-full rounded-2xl bg-white py-2.5 pl-9 pr-3 text-[14px] text-slate-800 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {dir.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => setSheet({ t: 'insurer', insurer: i })}
              className="flex flex-col items-center rounded-[22px] bg-white px-3 py-4 text-center ring-1 ring-slate-200/80 transition-shadow hover:shadow-md dark:bg-slate-900 dark:ring-slate-800"
            >
              <InsurerTile insurer={i} name={i.name} size={52} />
              <span className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
                {i.name}
              </span>
              <span className="mt-1 text-[11.5px] font-semibold text-teal-700 dark:text-teal-300">
                {i.phone ? prettyPhone(i.phone) : 'Lihat situs resmi'}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 px-1 text-center text-[11px] text-slate-400">
          Logo milik masing-masing perusahaan, dipakai hanya untuk menandai nama perusahaannya. Leosiqra tidak
          berafiliasi dan tidak merekomendasikan produk tertentu.
        </p>
      </section>

      {sheet?.t === 'cost' ? (
        <CostSheet accounts={accounts} today={today} onClose={() => setSheet(null)} onSaved={done} />
      ) : null}
      {sheet?.t === 'policy' ? (
        <PolicySheet
          policy={sheet.policy}
          preset={sheet.preset}
          accounts={accounts}
          onClose={() => setSheet(null)}
          onSaved={done}
        />
      ) : null}
      {sheet?.t === 'pay' ? (
        <PaySheet policy={sheet.policy} accounts={accounts} onClose={() => setSheet(null)} onSaved={done} />
      ) : null}
      {sheet?.t === 'claim' ? (
        <ClaimSheet
          claim={sheet.claim}
          policies={policies}
          accounts={accounts}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={done}
        />
      ) : null}
      {sheet?.t === 'insurer' ? (
        <InsurerSheet
          insurer={sheet.insurer}
          onClose={() => setSheet(null)}
          onMine={() =>
            notReady ? onToast('Polisku sedang disiapkan di server.') : setSheet({ t: 'policy', preset: sheet.insurer })
          }
        />
      ) : null}
    </div>
  );
}
