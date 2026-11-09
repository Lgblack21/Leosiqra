'use client';

import { useRef, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { GERAKAN } from '@/lib/olahraga/gerakan';

// Admin › Olahragaku: buat ilustrasi 40 gerakan × 4 frame lewat model gambar (sama dengan Cerita), disimpan di R2.
// Satu permintaan per gambar, berurutan; yang sudah ada dilewati. Perkiraan biaya ±Rp650 per gambar.
const FRAMES = 4;

export default function AdminOlahragaPage() {
  const [jalan, setJalan] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const stop = useRef(false);
  const total = GERAKAN.length * FRAMES;

  const mulai = async (ulangSemua: boolean) => {
    if (
      !window.confirm(
        `Buat ilustrasi untuk ${GERAKAN.length} gerakan × ${FRAMES} frame${ulangSemua ? ' (TIMPA yang sudah ada)' : ' (lewati yang sudah ada)'}? Perkiraan biaya maks ±Rp${((total * 650) / 1000).toFixed(0)} rb.`,
      )
    )
      return;
    setJalan(true);
    stop.current = false;
    setDone(0);
    setLog([]);
    let n = 0;
    for (const g of GERAKAN) {
      for (let f = 0; f < FRAMES; f++) {
        if (stop.current) {
          setLog((l) => [`Dihentikan.`, ...l]);
          setJalan(false);
          return;
        }
        try {
          const r = await cloudflareApi<{ skipped?: boolean }>('/api/admin/fit/gerakan-gambar', {
            method: 'POST',
            json: { key: g.key, frame: f, skip_existing: !ulangSemua },
          });
          setLog((l) => [`${r.skipped ? '⏭' : '✅'} ${g.nama} · frame ${f + 1}`, ...l].slice(0, 200));
        } catch (e) {
          setLog((l) =>
            [`❌ ${g.nama} · frame ${f + 1}: ${e instanceof Error ? e.message : 'gagal'}`, ...l].slice(0, 200),
          );
          if (e instanceof Error && /Saldo AI/.test(e.message)) {
            stop.current = true;
          }
        }
        n++;
        setDone(n);
      }
    }
    setJalan(false);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Olahragaku · Ilustrasi gerakan"
        description="Gambar 4 frame per gerakan, disimpan di R2. SAAT INI TIDAK DITAMPILKAN ke member: hasil uji 10-11 tidak konsisten antar frame & ada variasi gerakan yang salah. Member melihat video YouTube yang dikurasi."
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={jalan}
          onClick={() => mulai(false)}
          className="h-11 rounded-full bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50"
        >
          Buat yang belum ada
        </button>
        <button
          type="button"
          disabled={jalan}
          onClick={() => mulai(true)}
          className="h-11 rounded-full bg-slate-200 px-5 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          Buat ulang semua
        </button>
        {jalan ? (
          <button
            type="button"
            onClick={() => (stop.current = true)}
            className="h-11 rounded-full bg-rose-100 px-5 text-sm font-bold text-rose-700"
          >
            Hentikan
          </button>
        ) : null}
      </div>
      <div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {done} / {total} gambar
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {GERAKAN.map((g) => (
          <div key={g.key} className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/fit/gerakan/${g.key}/0?v=${done}`}
              alt={g.nama}
              className="aspect-square w-full rounded-xl bg-slate-100 object-cover"
            />
            <p className="mt-1 truncate text-xs font-bold text-slate-700">{g.nama}</p>
          </div>
        ))}
      </div>
      <ul className="max-h-80 overflow-auto rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-600">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
