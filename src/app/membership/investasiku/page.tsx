"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Info, Minus, Plus, ShieldCheck } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Investasiku: simulasi "kalau uangmu ditaruh di sini, jadi berapa?" untuk
// produk aman yang umum di Indonesia. Bunga/imbal hasil di sini PERKIRAAN dan
// bisa diubah user — selalu cek penawaran resmi terbaru sebelum berinvestasi.
// Bunga dihitung sederhana (tidak diputar ulang), pajak dipotong dari bunganya.

type Product = { id: string; name: string; desc: string; rate: number; tax: number; color: string; note: string };

const DEFAULT_PRODUCTS: Product[] = [
  { id: 'sbn', name: 'SBN ritel', desc: 'ORI / SBR / Sukuk Tabungan — dijamin negara', rate: 6.5, tax: 10, color: '#16a34a', note: 'Kupon dibayar tiap bulan. Pajak 10% dari kupon.' },
  { id: 'rdpu', name: 'Reksa dana pasar uang', desc: 'Risiko rendah, bisa dicairkan kapan saja', rate: 4.5, tax: 0, color: '#6366f1', note: 'Imbal hasil tidak dijamin. Keuntungan reksa dana bukan objek pajak bagi investor.' },
  { id: 'depo', name: 'Deposito bank', desc: 'Dijamin LPS sampai batas tertentu', rate: 3.5, tax: 20, color: '#f59e0b', note: 'Pajak 20% dari bunga. Pencairan sebelum jatuh tempo bisa kena penalti.' },
  { id: 'tab', name: 'Tabungan biasa', desc: 'Pembanding: uang diam di rekening', rate: 0.5, tax: 20, color: '#94a3b8', note: 'Bunga tabungan umumnya sangat kecil.' },
];
const DURATIONS = [
  { months: 1, label: '1 bln' },
  { months: 3, label: '3 bln' },
  { months: 6, label: '6 bln' },
  { months: 12, label: '1 thn' },
  { months: 24, label: '2 thn' },
  { months: 36, label: '3 thn' },
];
const STEPS = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];

const netGain = (amount: number, p: Product, months: number) => amount * (p.rate / 100) * (months / 12) * (1 - p.tax / 100);
const short = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} M` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} jt` : `${Math.round(n / 1e3)} rb`).replace('.', ',');

export default function InvestasikuPage() {
  const [amount, setAmount] = useState(10_000_000);
  const [months, setMonths] = useState(12);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [editing, setEditing] = useState(false);
  const [mine, setMine] = useState<Investment[] | null>(null);

  useEffect(() => {
    investmentService.getUserInvestments('session').then(setMine).catch(() => setMine([]));
  }, []);

  const results = products.map((p) => ({ ...p, gain: netGain(amount, p, months) })).sort((a, b) => b.gain - a.gain);
  const best = results[0];
  const depo = results.find((r) => r.id === 'depo');

  const chart = useMemo(
    () =>
      Array.from({ length: months + 1 }, (_, m) => ({
        bulan: m,
        ...Object.fromEntries(products.map((p) => [p.id, Math.round(amount + netGain(amount, p, m))])),
      })),
    [amount, months, products]
  );

  const active = (mine ?? []).filter((i) => i.status === 'Active');
  const activeTotal = active.reduce((s, i) => s + (Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Input */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-7 lg:col-span-2">
          <p className="text-center text-sm font-semibold text-slate-500">Mau taruh berapa?</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setAmount([...STEPS].reverse().find((v) => v < amount) ?? amount)} aria-label="Kurangi" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><Minus size={18} /></button>
            <label className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-400">Rp</span>
              <input
                inputMode="numeric"
                value={amount.toLocaleString('id-ID')}
                onChange={(e) => setAmount(Math.min(10_000_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
                aria-label="Jumlah uang"
                className="w-[200px] bg-transparent text-center text-[34px] font-extrabold tracking-tight text-slate-900 outline-none tabular-nums"
              />
            </label>
            <button type="button" onClick={() => setAmount(STEPS.find((v) => v > amount) ?? amount + 50_000_000)} aria-label="Tambah" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><Plus size={18} /></button>
          </div>
          <p className="mt-1 text-center text-xs text-slate-400">Ketuk angkanya untuk mengubah</p>

          <div className="mt-5 grid grid-cols-6 gap-1 rounded-2xl bg-slate-100 p-1">
            {DURATIONS.map((d) => (
              <button key={d.months} type="button" onClick={() => setMonths(d.months)} className={cn('rounded-xl py-2 text-xs font-bold', months === d.months ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-end gap-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-700">Paling besar: {best.name}</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{formatIDR(amount + best.gain)}</p>
              <p className="text-sm font-bold text-emerald-600">+{formatIDR(best.gain)} setelah pajak</p>
              {depo && best.id !== 'depo' && (
                <p className="mt-1 text-xs text-slate-500">{formatIDR(best.gain - depo.gain)} lebih banyak dari deposito.</p>
              )}
            </div>
            <LeoMascot mood="happy" size={70} interactive className="shrink-0" />
          </div>
        </div>

        {/* Grafik */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-3">
          <p className="font-bold text-slate-900">Saldo kamu nanti</p>
          <p className="text-xs text-slate-400">Simulasi {DURATIONS.find((d) => d.months === months)?.label}, sudah dipotong pajak</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="bulan" tickFormatter={(m) => (m === 0 ? 'Mulai' : `${m} bln`)} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(months / 6) - 1)} />
                <YAxis domain={['dataMin', 'dataMax']} tickFormatter={(v) => short(Number(v))} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                <Tooltip formatter={(v, n) => [formatIDR(Number(v)), products.find((p) => p.id === n)?.name ?? String(n)]} labelFormatter={(m) => (Number(m) === 0 ? 'Mulai' : `Bulan ke-${m}`)} />
                {products.map((p) => (
                  <Line key={p.id} type="monotone" dataKey={p.id} stroke={p.color} strokeWidth={p.id === best.id ? 3 : 2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Perbandingan */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-bold text-slate-900">Perbandingan</p>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-sm font-bold text-indigo-600 hover:underline">
            {editing ? 'Selesai' : 'Ubah bunga'}
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {results.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3.5">
              <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  {p.name}
                  {i === 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">Terbesar</span>}
                </p>
                <p className="text-xs text-slate-400">{p.desc} · {p.note}</p>
              </div>
              {editing ? (
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={30}
                    value={p.rate}
                    onChange={(e) => setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, rate: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } : x)))}
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-right font-bold"
                  />
                  <span className="text-slate-500">%/thn</span>
                </label>
              ) : (
                <span className="text-xs font-semibold text-slate-500">{p.rate.toLocaleString('id-ID')}%/thn{p.tax ? ` · pajak ${p.tax}%` : ''}</span>
              )}
              <span className="w-32 text-right">
                <span className="block text-sm font-extrabold text-slate-900 tabular-nums">{formatIDR(amount + p.gain)}</span>
                <span className="text-xs font-bold text-emerald-600">+{formatIDR(p.gain)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          Angka bunga di atas perkiraan untuk simulasi dan bisa kamu ubah. Selalu cek penawaran resmi terbaru (Kemenkeu, bank, atau manajer investasi) sebelum berinvestasi. Ini bukan saran investasi.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Portofolio */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="font-bold text-slate-900">Investasimu sekarang</p>
          {mine === null ? (
            <div className="mt-3 h-16 animate-pulse rounded-2xl bg-slate-50" />
          ) : active.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Sudah punya SBN, deposito, atau reksa dana? Catat supaya nilainya ikut di Kekayaan.</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{formatIDR(activeTotal)}</p>
              <p className="text-sm text-slate-500">{active.length} investasi aktif</p>
            </>
          )}
          <Link href="/membership/investment" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">
            {active.length ? 'Lihat portofolio' : 'Catat investasi'} <ArrowRight size={14} />
          </Link>
        </div>

        {/* Belajar */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="mb-3 flex items-center gap-2 font-bold text-slate-900"><ShieldCheck size={17} className="text-emerald-600" /> Belajar singkat</p>
          <ul className="space-y-3 text-sm text-slate-600">
            <li><b className="text-slate-800">Dana darurat dulu.</b> Simpan 3–6 kali pengeluaran bulanan di tempat yang mudah dicairkan sebelum investasi jangka panjang.</li>
            <li><b className="text-slate-800">Kenali risikonya.</b> SBN dijamin negara, deposito dijamin LPS sampai batas tertentu, reksa dana tidak dijamin.</li>
            <li><b className="text-slate-800">Hitung setelah pajak.</b> Bunga 4% yang kena pajak 20% sebenarnya cuma 3,2% buat kamu.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
