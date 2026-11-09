// Ayat terkait (referensi silang) untuk fitur "Pelajari" Alkitab:
//   data/teduh/alkitab/openbible-cross-references-<tanggal>.txt.gz — OpenBible.info, CC BY 4.0.
// Hanya rujukan (kitab/pasal/ayat), bukan teks Alkitab. Diambil 6 rujukan dengan suara terbanyak per ayat.
// Keluaran: public/teduh/silang/b1.json … b66.json ({ "pasal:ayat": ["kitab.pasal.ayat[-ayatAkhir]", …] }).
// Jalankan: node scripts/teduh/build-silang.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const SRC = 'data/teduh/alkitab';
const OUT = 'public/teduh/silang';
const OSIS =
  'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(
    ' ',
  );
if (OSIS.length !== 66) throw new Error('Daftar kitab harus 66');
const id = new Map(OSIS.map((b, i) => [b, i + 1]));
const ref = (s) => {
  const m = /^(\w+)\.(\d+)\.(\d+)$/.exec(s);
  if (!m || !id.has(m[1])) return null;
  return { b: id.get(m[1]), c: Number(m[2]), v: Number(m[3]) };
};
mkdirSync(OUT, { recursive: true });
const file = readdirSync(SRC).find((f) => f.startsWith('openbible-cross-references-'));
const lines = gunzipSync(readFileSync(`${SRC}/${file}`))
  .toString('utf8')
  .split('\n')
  .slice(1);
const per = new Map(); // b → Map("c:v" → [{to, votes}])
for (const line of lines) {
  const [from, to, votes] = line.split('\t');
  if (!from || !to) continue;
  const f = ref(from);
  const [a, z] = to.split('-');
  const t = ref(a);
  const e = z ? ref(z) : null;
  const n = Number(votes);
  if (!f || !t || !(n >= 3)) continue;
  const out = `${t.b}.${t.c}.${t.v}${e && e.b === t.b && e.c === t.c && e.v > t.v ? `-${e.v}` : ''}`;
  if (!per.has(f.b)) per.set(f.b, new Map());
  const m = per.get(f.b);
  const k = `${f.c}:${f.v}`;
  if (!m.has(k)) m.set(k, []);
  m.get(k).push({ out, n });
}
let total = 0;
for (let b = 1; b <= 66; b++) {
  const m = per.get(b) ?? new Map();
  const obj = {};
  for (const [k, list] of m) {
    obj[k] = list
      .sort((x, y) => y.n - x.n)
      .slice(0, 6)
      .map((x) => x.out);
    total += obj[k].length;
  }
  writeFileSync(`${OUT}/b${b}.json`, JSON.stringify(obj));
}
console.log(`Referensi silang: ${total} rujukan untuk 66 kitab (${file})`);
