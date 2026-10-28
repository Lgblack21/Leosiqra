"use client";

import { useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud, CalendarRange, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMPORT_CSV_TEMPLATE } from '@/lib/importParsers';

// Pengaturan → Impor / ekspor CSV. Ekspor memakai GET /api/member/transactions/
// export.csv?from=&to= (maks 5.000 transaksi terbaru di rentang itu). Impor
// CSV memakai alur Impor mutasi (per rekening, ditinjau dulu, tidak mengubah saldo).

const wib = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const shift = (ymd: string, months: number) => {
  const [y, m] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
};

type Preset = { id: string; label: string; range: () => [string, string] | [null, null] };
const PRESETS: Preset[] = [
  { id: 'bulan', label: 'Bulan ini', range: () => [shift(wib(), 0), wib()] },
  { id: '3bulan', label: '3 bulan', range: () => [shift(wib(), -2), wib()] },
  { id: 'tahun', label: 'Tahun ini', range: () => [`${wib().slice(0, 4)}-01-01`, wib()] },
  { id: 'semua', label: 'Semua', range: () => [null, null] },
];

const COLUMNS = ['Tanggal', 'Jenis', 'Kategori', 'Subkategori', 'Rekening', 'Rekening tujuan', 'Nominal', 'Mata uang', 'Nominal IDR', 'Catatan'];

export function CsvView({ openImport }: { openImport: () => void }) {
  const [preset, setPreset] = useState('bulan');
  const [[from, to], setRange] = useState<[string | null, string | null]>(PRESETS[0].range());
  const invalid = !!(from && to && from > to);
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const href = `/api/member/transactions/export.csv${qs.toString() ? `?${qs}` : ''}`;

  const pick = (p: Preset) => {
    setPreset(p.id);
    setRange(p.range());
  };
  const setDate = (i: 0 | 1, v: string) => {
    setPreset('');
    setRange((cur) => (i === 0 ? [v || null, cur[1]] : [cur[0], v || null]));
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="flex items-center gap-2 px-1 text-[14px] text-slate-500"><Download size={15} /> Ekspor</p>
        <div className="space-y-4 rounded-[22px] bg-white p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1', preset === p.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['Dari', 'Sampai'] as const).map((label, i) => (
              <label key={label} className="block rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><CalendarRange size={12} /> {label}</span>
                <input
                  type="date"
                  value={(i === 0 ? from : to) ?? ''}
                  onChange={(e) => setDate(i as 0 | 1, e.target.value)}
                  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 outline-none"
                  aria-label={`Tanggal ${label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>
          {invalid && <p className="text-[13px] font-semibold text-rose-600">Tanggal &quot;Dari&quot; harus sebelum &quot;Sampai&quot;.</p>}
          <a
            href={invalid ? undefined : href}
            aria-disabled={invalid}
            className={cn('flex items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white', invalid && 'pointer-events-none opacity-40')}
          >
            <Download size={16} /> Unduh CSV
          </a>
          <p className="text-[12px] leading-relaxed text-slate-500">
            {from || to ? `${from ?? 'Awal'} s/d ${to ?? 'hari ini'}` : 'Semua transaksi'} · maks. 5.000 transaksi terbaru. Kolom: {COLUMNS.join(', ')}. Bisa dibuka di Excel/Google Sheets.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <p className="flex items-center gap-2 px-1 text-[14px] text-slate-500"><UploadCloud size={15} /> Impor</p>
        <div className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200">
          <p className="text-[14px] leading-snug text-slate-600">
            Kolom yang dikenali: <b>Tanggal</b>, <b>Keterangan</b>, dan <b>Nominal</b> (minus = keluar) — atau <b>Debit/Kredit</b>, atau Nominal + kolom <b>Jenis</b> (masuk/keluar). Kolom lain bisa dipetakan manual.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openImport} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-[15px] font-bold text-white">
              <UploadCloud size={16} /> Impor CSV / Excel <ArrowRight size={15} />
            </button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(IMPORT_CSV_TEMPLATE)}`}
              download="template-impor-leosiqra.csv"
              className="flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-[14px] font-semibold text-slate-700"
            >
              <FileSpreadsheet size={15} /> Template
            </a>
          </div>
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" /> Satu file = satu rekening. Baris dicek dobel & ditinjau dulu; impor tidak mengubah saldo dan bisa dibatalkan. Dari Money Manager, Money Lover, dll: ekspor ke CSV/Excel, lalu impor per dompet.
          </p>
        </div>
      </section>
    </div>
  );
}
