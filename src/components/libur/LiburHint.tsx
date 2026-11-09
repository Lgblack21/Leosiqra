'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { hariKerjaSebelum, isAkhirPekan, isHariKerja, liburPada, liburStore } from '@/lib/hariLibur';
import { muatHariLibur } from '@/lib/hariLiburApi';
import { cn } from '@/lib/utils';

const fmt = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

// Peringatan kecil di transaksi rutin: jatuh tempo di tanggal merah / akhir pekan → bank bisa tutup,
// sarankan hari kerja sebelumnya.
export function LiburHint({ date, className }: { date: Date; className?: string }) {
  useSyncExternalStore(liburStore.subscribe, liburStore.versi, () => 0);
  useEffect(() => {
    void muatHariLibur();
  }, []);
  if (isHariKerja(date)) return null;
  const libur = liburPada(date);
  const alasan = libur.length ? libur[0].nama : isAkhirPekan(date) ? 'akhir pekan' : 'hari libur';
  return (
    <p
      className={cn(
        'rounded-xl bg-amber-50 px-2.5 py-1.5 fs-11.5 font-semibold leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
        className,
      )}
    >
      📅 Jatuh di {libur.length ? 'tanggal merah' : 'akhir pekan'} ({alasan}). Transfer/bayar paling aman{' '}
      {fmt(hariKerjaSebelum(date))}.
    </p>
  );
}
