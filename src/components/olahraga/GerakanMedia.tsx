'use client';

import { useEffect, useState } from 'react';
import { Play, PlayCircle } from 'lucide-react';
import { frameGerakan, gambarGerakan } from '@/lib/olahraga/gambar';
import { VIDEO_GERAKAN } from '@/lib/olahraga/video';
import type { Gerakan } from '@/lib/olahraga/types';
import { cn } from '@/lib/utils';

// Media gerakan: video YouTube yang dikurasi per gerakan (src/lib/olahraga/video.ts, diverifikasi oEmbed).
// Hemat kuota: yang dimuat dulu hanya thumbnail; pemutar (youtube-nocookie) baru dimuat saat diketuk.
// Belum ada video yang cocok → tombol cari di YouTube.
// Ilustrasi: gerakan yang framenya lolos cek visual diputar sebagai animasi (ANIMASI_GERAKAN); sisanya gambar posisi
// awal (diam) karena frame lanjutannya salah peraga (mis. plank lutut tergambar plank penuh).

export const youtubeUrl = (g: Pick<Gerakan, 'nama' | 'duduk'>) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${g.nama.replace(/\s*\(.*\)/, '')} ${g.duduk ? 'duduk di kursi ' : ''}cara pemula`)}`;

export function GerakanMedia({ g, className }: { g: Gerakan; className?: string }) {
  const v = VIDEO_GERAKAN[g.key] ?? null;
  const [main, setMain] = useState(false);
  const gambar = gambarGerakan(g.key);
  const frames = frameGerakan(g.key);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % frames.length), 850);
    return () => window.clearInterval(t);
  }, [frames.length]);
  return (
    <div className={cn('space-y-2', className)}>
      {frames.length >= 2 ? (
        <figure className="space-y-1.5">
          <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl bg-[#f6efe2]">
            {frames.map((src, n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={n === 0 ? `Ilustrasi gerakan ${g.nama}` : ''}
                width={240}
                height={240}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                  n === i ? 'opacity-100' : 'opacity-0',
                )}
              />
            ))}
          </div>
          <figcaption className="text-center fs-12 text-slate-500 dark:text-slate-400">
            Ilustrasi gerakan{v ? ' · detailnya di video' : ''}
          </figcaption>
        </figure>
      ) : gambar ? (
        <figure className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gambar}
            alt={`Posisi awal ${g.nama}`}
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-2xl bg-[#f6efe2] object-cover"
          />
          <figcaption className="fs-12 text-slate-500 dark:text-slate-400">
            Posisi awal. Lihat videonya untuk gerakan lengkap.
          </figcaption>
        </figure>
      ) : null}
      {v ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900">
          {main ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={v.judul}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setMain(true)}
              className="group absolute inset-0"
              aria-label={`Putar video ${g.nama}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover opacity-90"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition-transform group-hover:scale-105">
                  <Play size={26} fill="currentColor" />
                </span>
              </span>
            </button>
          )}
        </div>
      ) : null}
      {v ? (
        <p className="fs-11 text-slate-400">
          Video: {v.kanal}
          {v.bahasa === 'en' ? ' · bahasa Inggris (lihat gerakannya)' : ''}
        </p>
      ) : (
        <a
          href={youtubeUrl(g)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-50 px-4 fs-13 font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <PlayCircle size={17} /> Cari video di YouTube
        </a>
      )}
    </div>
  );
}
