// Tafsir ringkas untuk fitur "Pelajari" di Teduh (TANPA mengubah teks):
//   data/teduh/quran/quranenc-indonesian_mokhtasar-<tanggal>.json — Al-Mukhtaṣar fī Tafsīr al-Qur'ān al-Karīm
//   (Markaz Tafsīr li ad-Dirāsāt al-Qur'āniyyah), terjemahan Indonesia dari QuranEnc.com.
//   QuranEnc tidak mencantumkan nomor versi untuk karya ini → dicatat tanggal salinannya.
// Keluaran: public/teduh/tafsir/t1.json … t114.json ({ n, sumber, tafsir: string[] }).
// Jalankan: node scripts/teduh/build-tafsir.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const SRC = 'data/teduh/quran';
const OUT = 'public/teduh/tafsir';
mkdirSync(OUT, { recursive: true });
const file = readdirSync(SRC).find((f) => f.startsWith('quranenc-indonesian_mokhtasar-'));
const tanggal = /(\d{4}-\d{2}-\d{2})/.exec(file)[1];
const rows = JSON.parse(readFileSync(`${SRC}/${file}`, 'utf8'));
if (rows.length !== 6236) throw new Error(`Jumlah tafsir ${rows.length}, harus 6236`);
const sumber = {
  nama: "Al-Mukhtaṣar fī Tafsīr al-Qur'ān al-Karīm (Markaz Tafsīr li ad-Dirāsāt al-Qur'āniyyah), terjemahan Indonesia",
  url: 'https://quranenc.com/id/browse/indonesian_mokhtasar',
  salinan: tanggal,
};
const per = new Map();
for (const [s, a, t] of rows) {
  if (!per.has(s)) per.set(s, []);
  const list = per.get(s);
  if (list.length !== a - 1) throw new Error(`Urutan tafsir ${s}:${a} tidak berurutan`);
  list.push(t);
}
for (const [s, tafsir] of per) writeFileSync(`${OUT}/t${s}.json`, JSON.stringify({ n: s, sumber, tafsir }));
console.log(`Tafsir: ${per.size} surah, salinan ${tanggal}`);
