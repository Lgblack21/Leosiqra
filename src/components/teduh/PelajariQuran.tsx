'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { loadSurah, loadTafsir, type SurahMeta, type TafsirSurah } from '@/lib/teduh/quran';
import { catatan } from '@/lib/teduh/renungan';
import { CatatanPribadi, LembarTab } from '@/components/teduh/ui';
import { cn } from '@/lib/utils';

type Tab = 'tafsir' | 'kata' | 'catatan';
type Kata = { ar: string; latin: string; arti: string };

// Kata per kata: API publik quran.com (arti per kata berbahasa Inggris — terjemahan per kata
// berbahasa Indonesia belum tersedia di sumbernya). Disimpan di memori selama sesi.
const kataCache = new Map<string, Promise<Kata[]>>();
const loadKata = (k: string) => {
  let p = kataCache.get(k);
  if (!p) {
    p = fetch(
      `https://api.quran.com/api/v4/verses/by_key/${k}?words=true&word_translation_language=en&word_fields=text_uthmani`,
    )
      .then((r) => {
        if (!r.ok) throw new Error('Kata per kata belum bisa dimuat.');
        return r.json();
      })
      .then(
        (d: {
          verse?: {
            words?: {
              char_type_name?: string;
              text_uthmani?: string;
              transliteration?: { text?: string | null };
              translation?: { text?: string | null };
            }[];
          };
        }) =>
          (d.verse?.words ?? [])
            .filter((w) => w.char_type_name === 'word')
            .map((w) => ({
              ar: w.text_uthmani ?? '',
              latin: w.transliteration?.text ?? '',
              arti: w.translation?.text ?? '',
            })),
      );
    p.catch(() => kataCache.delete(k));
    kataCache.set(k, p);
  }
  return p;
};

// "Pelajari" satu ayat: tafsir ringkas (Al-Mukhtasar), kata per kata, dan catatan pribadi.
export function PelajariQuran({
  meta,
  a,
  arabClass,
  onClose,
}: {
  meta: SurahMeta;
  a: number;
  arabClass: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('tafsir');
  const k = `${meta.n}:${a}`;
  const [ayat, setAyat] = useState<[string, string] | null>(null);
  const [tafsir, setTafsir] = useState<TafsirSurah | null>(null);
  const [kata, setKata] = useState<Kata[] | null>(null);
  const [err, setErr] = useState<{ tafsir?: string; kata?: string }>({});
  const store = useSyncExternalStore(catatan.subscribe, catatan.snapshot, () => null);
  useEffect(() => {
    let alive = true;
    loadSurah(meta.n)
      .then((d) => alive && setAyat([d.ayat[a - 1]?.[0] ?? '', (d.ayat[a - 1]?.[1] ?? '').replace(/\[\d+\]/g, '')]))
      .catch(() => {});
    loadTafsir(meta.n)
      .then((t) => alive && setTafsir(t))
      .catch((e) => alive && setErr((x) => ({ ...x, tafsir: e instanceof Error ? e.message : 'Gagal memuat.' })));
    return () => {
      alive = false;
    };
  }, [meta.n, a]);
  useEffect(() => {
    if (tab !== 'kata' || kata) return;
    let alive = true;
    loadKata(k)
      .then((w) => alive && setKata(w))
      .catch((e) => alive && setErr((x) => ({ ...x, kata: e instanceof Error ? e.message : 'Gagal memuat.' })));
    return () => {
      alive = false;
    };
  }, [tab, k, kata]);

  return (
    <LembarTab
      judul={`${meta.latin} ${k}`}
      nada="islam"
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      tabs={[
        { id: 'tafsir', label: 'Tafsir' },
        { id: 'kata', label: 'Kata per kata' },
        { id: 'catatan', label: 'Catatanku' },
      ]}
    >
      {tab === 'tafsir' ? (
        <div className="space-y-3">
          {ayat ? (
            <div className="rounded-2xl bg-emerald-50/60 p-4 dark:bg-emerald-500/5">
              <p dir="rtl" lang="ar" className={cn('text-center fsh-26 leading-[2.1]', arabClass)}>
                {ayat[0]}
              </p>
              <p className="mt-2 text-center fs-13.5 leading-relaxed text-slate-600 dark:text-slate-300">{ayat[1]}</p>
            </div>
          ) : null}
          <p className="fs-11.5 font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Tafsir ringkas · Al-Mukhtasar
          </p>
          {tafsir ? (
            <>
              <p className="fs-15 leading-relaxed text-slate-800 dark:text-slate-100">{tafsir.tafsir[a - 1]}</p>
              <p className="fs-11.5 leading-relaxed text-slate-400">
                {tafsir.sumber.nama}, dari{' '}
                <a href={tafsir.sumber.url} target="_blank" rel="noreferrer" className="underline">
                  QuranEnc.com
                </a>{' '}
                — tanpa diubah. Salinan{' '}
                {new Date(tafsir.sumber.salinan).toLocaleDateString('id-ID', { dateStyle: 'long' })} (QuranEnc tidak
                memberi nomor versi untuk karya ini).
              </p>
            </>
          ) : (
            <p className="py-6 text-center fs-13 text-slate-400">{err.tafsir ?? 'Memuat tafsir…'}</p>
          )}
        </div>
      ) : null}
      {tab === 'kata' ? (
        kata ? (
          <div>
            <div dir="rtl" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {kata.map((w, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-2xl bg-slate-50 px-2 py-3 text-center ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700"
                >
                  <span lang="ar" className={cn('fsh-24 leading-[1.8]', arabClass)}>
                    {w.ar}
                  </span>
                  <span dir="ltr" className="mt-1 fs-12 italic text-emerald-700 dark:text-emerald-300">
                    {w.latin}
                  </span>
                  <span dir="ltr" className="fs-12 leading-snug text-slate-600 dark:text-slate-300">
                    {w.arti}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 fs-11.5 leading-relaxed text-slate-400">
              Arti per kata dalam bahasa Inggris (sumber: Quran.com) — terjemahan per kata berbahasa Indonesia belum
              tersedia di sumbernya. Untuk makna utuh, ikuti terjemahan Kemenag & tafsir.
            </p>
          </div>
        ) : (
          <p className="py-8 text-center fs-13 text-slate-400">{err.kata ?? 'Memuat kata per kata…'}</p>
        )
      ) : null}
      {tab === 'catatan' ? (
        <div className="space-y-2">
          <p className="fs-13.5 text-slate-600 dark:text-slate-300">
            Apa yang kamu pelajari dari ayat ini? Tulis untuk dirimu sendiri.
          </p>
          <CatatanPribadi
            nilai={store?.ayat[`q:${k}`] ?? ''}
            onSimpan={(v) => catatan.setAyat(`q:${k}`, v)}
            placeholder="Mis. Aku ingin lebih rutin bersedekah walau sedikit…"
          />
        </div>
      ) : null}
    </LembarTab>
  );
}
