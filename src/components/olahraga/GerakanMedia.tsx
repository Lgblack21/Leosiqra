'use client';

import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import type { Gerakan } from '@/lib/olahraga/types';
import { cn } from '@/lib/utils';

// Ilustrasi gerakan: 4 frame (dibuat admin, disimpan di R2) diputar bergantian seperti video pendek.
// Belum ada gambar → emoji. Plus tombol pencarian YouTube (selalu tersedia, tanpa video mati).
const FRAMES = 4;

export const youtubeUrl = (g: Pick<Gerakan, 'nama' | 'duduk'>) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${g.nama.replace(/\s*\(.*\)/, '')} ${g.duduk ? 'duduk di kursi ' : ''}cara pemula`)}`;

export function GerakanMedia({ g, className }: { g: Gerakan; className?: string }) {
  const [ok, setOk] = useState<boolean[]>(() => Array(FRAMES).fill(false));
  const [gagal0, setGagal0] = useState(false);
  const [i, setI] = useState(0);
  const siap = ok.filter(Boolean).length;
  useEffect(() => {
    if (siap < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % FRAMES), 750);
    return () => window.clearInterval(t);
  }, [siap]);
  const tampil = ok[i] ? i : 0;
  return (
    <div className={cn('space-y-2', className)}>
      {!gagal0 ? (
        <div className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-[#f6efe2]">
          {Array.from({ length: FRAMES }, (_, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={n}
              src={`/api/fit/gerakan/${g.key}/${n}`}
              alt={n === 0 ? `Ilustrasi ${g.nama}` : ''}
              loading="lazy"
              onLoad={() => setOk((o) => o.map((v, j) => (j === n ? true : v)))}
              onError={() => n === 0 && setGagal0(true)}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
                n === tampil && ok[n] ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
          {!ok[0] ? (
            <span className="absolute inset-0 flex items-center justify-center text-[56px]">{g.emoji}</span>
          ) : null}
        </div>
      ) : null}
      <a
        href={youtubeUrl(g)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-50 px-4 fs-13 font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      >
        <PlayCircle size={17} /> Lihat video di YouTube
      </a>
    </div>
  );
}
