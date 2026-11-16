'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { investmentService, type PriceRefresh } from '@/lib/services/investmentService';
import { notifyCollectionChanged } from '@/lib/cf-firestore';
import { NumberInput } from '@/components/ui/NumberInput';
import { cn, formatIDR } from '@/lib/utils';

// Nilai emas, saham & kripto ikut harga pasar (3.42). Dipanggil saat halaman investasi dibuka — server sendiri
// yang membatasi (paling sering tiap 3 jam; tombol perbarui tiap 10 menit). Emas: harga dunia per gram (perkiraan)
// atau harga buyback Antam yang diisi sendiri.
const jam = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
const tglPendek = (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${ymd}T00:00:00`));

export function NilaiOtomatis({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const [info, setInfo] = useState<PriceRefresh | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [harga, setHarga] = useState('');
  const [error, setError] = useState('');

  const apply = (r: PriceRefresh) => {
    setInfo(r);
    if (r.updated > 0) notifyCollectionChanged('investments');
  };
  useEffect(() => {
    let alive = true;
    investmentService
      .refreshPrices()
      .then((r) => alive && apply(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const perbarui = async () => {
    setBusy(true);
    try {
      apply(await investmentService.refreshPrices(true));
    } catch {
      /* diam — coba lagi nanti */
    } finally {
      setBusy(false);
    }
  };
  const simpan = async (price: number | null) => {
    setBusy(true);
    setError('');
    try {
      apply(await investmentService.setGoldBuyback(price));
      setEdit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  if (!info) return null;
  const g = info.gold;
  const dark = tone === 'dark';
  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 fs-12', dark ? 'text-white/60' : 'text-slate-500')}>
        <span>Nilai emas, saham & kripto ikut harga pasar{info.at ? ` · diperbarui ${jam(info.at)}` : ''}</span>
        <button
          type="button"
          onClick={perbarui}
          disabled={busy}
          aria-label="Perbarui nilai sekarang"
          className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold disabled:opacity-50', dark ? 'text-white/80 hover:bg-white/10' : 'text-indigo-600 hover:bg-indigo-50')}
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Perbarui
        </button>
      </div>
      {(g.count > 0 || g.buyback) && (
        <div className={cn('rounded-2xl p-3 fs-12', dark ? 'bg-white/10 text-white/80' : 'bg-amber-50 text-amber-900')}>
          {!edit ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1">
                🥇 Emas dihitung{' '}
                {g.source === 'buyback' && g.buyback ? (
                  <>
                    pakai <b>harga buyback Antam {formatIDR(g.buyback.price)}/gram</b> (kamu isi {tglPendek(g.buyback.date)})
                  </>
                ) : g.perGram ? (
                  <>
                    pakai <b>harga emas dunia {formatIDR(g.perGram)}/gram</b> — perkiraan, bisa beda dari harga Antam
                  </>
                ) : (
                  'dari harga terakhir — harga emas dunia sedang tidak tersedia'
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setHarga(g.buyback ? String(g.buyback.price) : '');
                  setEdit(true);
                }}
                className={cn('rounded-full px-3 py-1 font-bold', dark ? 'bg-white/15 text-white' : 'bg-white text-amber-800 ring-1 ring-amber-200')}
              >
                {g.buyback ? 'Ubah harga Antam' : 'Pakai harga buyback Antam'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold">Harga buyback Antam hari ini (per gram)</p>
              <p className={dark ? 'text-white/60' : 'text-amber-800/80'}>
                Lihat di logammulia.com atau butik Antam. Harga ini dipakai untuk semua emasmu sampai kamu ubah lagi.
              </p>
              <div className="flex gap-2">
                <NumberInput
                  value={harga}
                  onChange={setHarga}
                  placeholder="mis. 2.150.000"
                  className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-white px-3 fs-14 font-bold text-slate-900 ring-1 ring-amber-200 focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  disabled={busy || !(Number(harga) > 0)}
                  onClick={() => simpan(Number(harga))}
                  className="flex h-10 items-center gap-1 rounded-xl bg-amber-500 px-4 font-bold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan
                </button>
              </div>
              {error && <p className="font-semibold text-rose-600">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEdit(false)} className="font-semibold opacity-70">
                  Batal
                </button>
                {g.buyback && (
                  <button type="button" disabled={busy} onClick={() => simpan(null)} className="font-semibold text-rose-600">
                    Kembali ke harga emas dunia
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
