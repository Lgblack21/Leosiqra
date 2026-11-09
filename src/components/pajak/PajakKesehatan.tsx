'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HeartPulse, Info, ShieldCheck } from 'lucide-react';
import { healthService, POLICY_KINDS, PERIODS, type HealthSummary } from '@/lib/health';

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// Rekap kesehatan setahun untuk persiapan SPT. Biaya kesehatan & premi asuransi pribadi TIDAK
// mengurangi PPh orang pribadi — rekap ini untuk catatan; polis bernilai tunai masuk daftar harta.
export function PajakKesehatan({ year }: { year: number }) {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    healthService
      .summary(String(year))
      .then((d) => alive && (setData(d), setFailed(false)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [year]);

  if (failed) return null;
  const costs = data?.costs.total ?? 0;
  const premi = data?.costs.bySub.find((s) => s.sub === 'Asuransi')?.total ?? 0;
  const cair = (data?.claims ?? [])
    .filter((c) => c.status === 'cair' && (c.paid_at ?? '').startsWith(String(year)))
    .reduce((s, c) => s + (Number(c.approved_amount ?? c.amount) || 0), 0);
  const policies = data?.policies ?? [];
  const cashValueKinds = new Set(['jiwa', 'lainnya']);

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <HeartPulse size={18} />
        </div>
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Kesehatan & Asuransi {year}</h4>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
          <p className="fs-10 font-black uppercase tracking-widest text-slate-400">Biaya kesehatan setahun</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{data ? rp(costs) : '…'}</p>
          <div className="mt-3 space-y-1.5">
            {(data?.costs.bySub ?? []).map((s) => (
              <div key={s.sub} className="flex justify-between fs-13">
                <span className="text-slate-500">{s.sub === 'Asuransi' ? 'Premi asuransi' : s.sub}</span>
                <span className="font-bold text-slate-800">{rp(s.total)}</span>
              </div>
            ))}
            {data && data.costs.bySub.length === 0 && (
              <p className="fs-13 text-slate-400">Belum ada biaya kesehatan tercatat.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
          <p className="fs-10 font-black uppercase tracking-widest text-slate-400">Klaim asuransi cair</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{data ? rp(cair) : '…'}</p>
          <p className="mt-3 fs-13 leading-relaxed text-slate-500">
            Biaya bersih setelah klaim (di luar premi):{' '}
            <span className="font-bold text-slate-800">{data ? rp(Math.max(0, costs - premi - cair)) : '…'}</span>
          </p>
          <p className="mt-1 fs-12 text-slate-400">Klaim/penggantian biaya dari asuransi bukan objek PPh.</p>
        </div>

        <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
          <p className="fs-10 font-black uppercase tracking-widest text-slate-400">Polis tercatat</p>
          <div className="mt-2 space-y-2">
            {policies.length === 0 && <p className="fs-13 text-slate-400">Belum ada polis di Sehatku.</p>}
            {policies.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-500" />
                <div className="min-w-0 fs-13">
                  <p className="truncate font-bold text-slate-800">
                    {p.insurer_name}
                    {p.product ? ` · ${p.product}` : ''}
                  </p>
                  <p className="text-slate-500">
                    {POLICY_KINDS.find((k) => k.id === p.kind)?.label ?? p.kind}
                    {p.premium
                      ? ` · premi ${rp(p.premium)} (${PERIODS.find((x) => x.id === p.period)?.label.toLowerCase() ?? p.period})`
                      : ''}
                  </p>
                  {cashValueKinds.has(p.kind) && (
                    <p className="fs-11.5 font-semibold text-amber-600">
                      Kalau punya nilai tunai, masukkan ke Daftar Harta SPT.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link href="/membership/sehat#asuransi" className="mt-3 inline-block fs-12 font-bold text-indigo-600">
            Kelola di Sehatku ›
          </Link>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[24px] bg-amber-50 p-5 fs-13 leading-relaxed text-amber-900">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          Biaya berobat dan premi asuransi pribadi <strong>tidak mengurangi pajak penghasilan</strong> di SPT orang
          pribadi — rekap ini untuk catatanmu. Polis asuransi jiwa / unit link yang punya <strong>nilai tunai</strong>{' '}
          dilaporkan di daftar harta sebesar nilai tunainya (lihat laporan tahunan dari perusahaan asuransi). Asuransi
          kesehatan murni tanpa nilai tunai tidak perlu dicantumkan.
        </p>
      </div>
    </div>
  );
}
