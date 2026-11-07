'use client';

import { useState } from 'react';
import { BookOpen, Flame, Search } from 'lucide-react';
import { MoodLeo } from './MoodLeo';
import { LeoFace } from './LeoFace';
import { longDate, moodOf, storyImageUrl, type StoryYear } from '@/lib/stories';

// Kumpulan: hari beruntun, jumlah halaman, cari, daftar per bulan (gambar kecil + potongan tulisan).
export function KumpulanView({
  data,
  onOpen,
  onWrite,
}: {
  data: StoryYear | null;
  onOpen: (date: string) => void;
  onWrite: () => void;
}) {
  const [q, setQ] = useState('');
  const items = (data?.items ?? []).filter(
    (i) => !q.trim() || (i.text ?? '').toLowerCase().includes(q.trim().toLowerCase()),
  );
  const groups = new Map<string, typeof items>();
  for (const i of items) {
    const k = new Date(`${i.date}T00:00:00Z`).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return (
    <div className="space-y-3 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-3.5 py-2 text-[13px] font-bold text-white shadow-sm">
          <Flame size={15} /> {data?.streak ?? 0} hari beruntun
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-bold text-slate-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
          <BookOpen size={15} /> {data?.total ?? 0} halaman
        </span>
        <label className="relative ml-auto w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari di ceritamu"
            aria-label="Cari di ceritamu"
            className="w-full rounded-full bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none ring-1 ring-slate-100 focus:ring-indigo-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
          />
        </label>
      </div>
      {!items.length ? (
        <div className="flex flex-col items-center rounded-[28px] bg-white px-6 py-10 text-center ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <MoodLeo mood={3} size={110} />
          <p className="mt-2 text-[16px] font-bold text-slate-900 dark:text-white">
            {q ? 'Tidak ketemu' : 'Belum ada cerita tahun ini'}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-slate-500">
            {q ? 'Coba kata lain.' : 'Satu kalimat tiap hari sudah cukup — Leo yang simpan.'}
          </p>
          {!q && (
            <button
              type="button"
              onClick={onWrite}
              className="mt-4 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-bold text-white dark:bg-white dark:text-slate-900"
            >
              Tulis cerita hari ini
            </button>
          )}
        </div>
      ) : (
        [...groups].map(([month, list]) => (
          <section key={month}>
            <p className="mb-1.5 px-1 text-[13px] font-bold text-slate-500">{month}</p>
            <ul className="space-y-2">
              {list.map((i) => {
                const m = moodOf(i.mood);
                const img = i.has_ai
                  ? storyImageUrl(i.date, 'ai', i.updated_at)
                  : i.has_photo
                    ? storyImageUrl(i.date, 'photo', i.updated_at)
                    : null;
                return (
                  <li key={i.date}>
                    <button
                      type="button"
                      onClick={() => onOpen(i.date)}
                      className="flex w-full items-center gap-3 rounded-[22px] bg-white p-2.5 text-left ring-1 ring-slate-100 transition-shadow hover:shadow-md dark:bg-slate-900 dark:ring-slate-800"
                    >
                      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element -- gambar privat dari API
                          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <LeoFace mood={i.mood} className="h-12 w-12" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-slate-900 dark:text-white">
                          {longDate(i.date)}
                        </span>
                        <span className="block truncate text-[13px] text-slate-500">{i.text || 'Tanpa tulisan'}</span>
                      </span>
                      {m && (
                        <span className="shrink-0 text-[20px]" title={m.label} aria-label={m.label}>
                          {m.emoji}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
