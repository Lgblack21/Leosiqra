// Membangun data Al-Qur'an untuk Teduh dari sumber resmi (TANPA mengubah teks):
//   data/teduh/quran/tanzil-uthmani-1.1.xml          — teks Arab Tanzil (CC BY 3.0, wajib verbatim + catatan hak cipta);
//                                                     basmalah pembuka surah ada di atribut `bismillah` (bukan bagian ayat 1)
//   data/teduh/quran/tanzil-quran-data.xml           — metadata surah Tanzil
//   data/teduh/quran/quranenc-indonesian_affairs-*.csv — terjemahan Kemenag via QuranEnc (tanpa diubah, cantumkan versi)
// Keluaran: public/teduh/quran/surah.json + s1.json … s114.json. Jalankan: node scripts/teduh/build-quran.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'data/teduh/quran';
const OUT = 'public/teduh/quran';
mkdirSync(OUT, { recursive: true });

const raw = readFileSync(`${SRC}/tanzil-uthmani-1.1.xml`, 'utf8');
const unxml = (v) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const ayat = [];
const basmalah = new Map();
for (const sm of raw.matchAll(/<sura index="(\d+)"[^>]*>([\s\S]*?)<\/sura>/g)) {
  for (const am of sm[2].matchAll(/<aya index="(\d+)" text="([^"]*)"(?: bismillah="([^"]*)")?\s*\/>/g)) {
    ayat.push({ s: Number(sm[1]), a: Number(am[1]), text: unxml(am[2]) });
    if (am[3]) basmalah.set(Number(sm[1]), unxml(am[3]));
  }
}
const tanzilNotice = (/<!--([\s\S]*?)-->/.exec(raw) || [])[1].trim();
if (ayat.length !== 6236) throw new Error(`Jumlah ayat Tanzil ${ayat.length}, harus 6236`);

// CSV sederhana (kolom berkutip, koma di dalam kutip).
const csv = readFileSync(`${SRC}/quranenc-indonesian_affairs-v1.0.1.csv`, 'utf8');
const rows = [];
{
  let row = [],
    cur = '',
    q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) {
      if (c === '"' && csv[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
}
const quranencNotice = rows[0][0].trim();
const version = (/\((v[^)]+)\)/.exec(quranencNotice) || [])[1] || 'tidak diketahui';
const tr = new Map();
for (const r of rows)
  if (/^\d+$/.test(r[0] ?? '') && r.length >= 4) tr.set(`${r[1]}:${r[2]}`, { t: r[3], f: r[4] || '' });
if (tr.size !== 6236) throw new Error(`Jumlah terjemahan ${tr.size}, harus 6236`);

const meta = readFileSync(`${SRC}/tanzil-quran-data.xml`, 'utf8');
const suras = [
  ...meta.matchAll(
    /<sura index="(\d+)" ayas="(\d+)" start="(\d+)" name="([^"]+)" tname="([^"]+)" ename="([^"]+)" type="(\w+)"/g,
  ),
].map((m) => ({
  n: Number(m[1]),
  ayat: Number(m[2]),
  start: Number(m[3]),
  ar: m[4],
  latin: m[5],
  en: m[6],
  type: m[7] === 'Meccan' ? 'Makkiyah' : 'Madaniyah',
}));
if (suras.length !== 114) throw new Error('Metadata surah harus 114');

const sources = {
  arab: {
    nama: 'Tanzil Quran Text (Uthmani, Version 1.1)',
    url: 'https://tanzil.net',
    lisensi: 'CC BY 3.0 — tanpa diubah',
    catatan: tanzilNotice,
  },
  terjemahan: {
    nama: 'Terjemahan Bahasa Indonesia — Kementerian Agama RI',
    versi: version,
    url: 'https://quranenc.com/en/browse/indonesian_affairs',
    catatan: quranencNotice,
  },
};
writeFileSync(`${OUT}/surah.json`, JSON.stringify({ sources, surah: suras }));
for (const s of suras) {
  const list = ayat.filter((x) => x.s === s.n);
  if (list.length !== s.ayat) throw new Error(`Surah ${s.n}: ${list.length} ayat, metadata ${s.ayat}`);
  writeFileSync(
    `${OUT}/s${s.n}.json`,
    JSON.stringify({
      n: s.n,
      basmalah: basmalah.get(s.n) ?? null,
      sources,
      ayat: list.map((x) => {
        const t = tr.get(`${x.s}:${x.a}`);
        return [x.text, t.t, t.f];
      }),
    }),
  );
}
console.log(`Teduh: 114 surah, 6236 ayat, terjemahan ${version} → ${OUT}`);
