// "Makin pintar tiap hari": rangkum rating pemilik (tombol 🔥/👍/👎 di
// Telegram) + catatan balasannya + playbook jangka panjang (R2) jadi pelajaran
// singkat yang dibaca penulis naskah berikutnya.
//
//   node lessons.mjs            → cetak & tulis out/lessons.md
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promoFetch } from "./api.mjs";

const SCORE = { 1: 2, 2: 1, 3: -2 }; // 🔥 Bagus, 👍 Oke, 👎 Kurang
const LABEL = { 1: "🔥", 2: "👍", 3: "👎" };

const durBucket = (d) => (!d ? null : d < 20 ? "<20 dtk" : d <= 28 ? "20–28 dtk" : ">28 dtk");

// Fitur (dimensi) yang dinilai → nilai dari item riwayat.
const DIMENSIONS = {
  format: (h) => h.format,
  "jenis video": (h) => (h.kind === "real" ? "rekaman aplikasi asli (3D)" : h.kind === "2d" ? "2D ilustrasi" : null),
  suara: (h) => h.voice,
  latar: (h) => String(h.style || "").split("/")[0] || null,
  palet: (h) => h.palette,
  durasi: (h) => durBucket(h.dur),
  "shot rekaman": (h) => (Array.isArray(h.shots) ? h.shots : []),
};

export const buildLessons = (history, playbook) => {
  const rated = history.filter((h) => SCORE[h.rating] !== undefined).slice(-60);
  const lines = [];
  if (playbook && Array.isArray(playbook.rules) && playbook.rules.length) {
    lines.push("Aturan tetap (playbook):", ...playbook.rules.slice(0, 15).map((r) => `- ${r}`));
  }
  if (!rated.length) {
    lines.push("Belum ada rating dari pemilik — eksplorasi format & gaya yang beragam.");
    return lines.join("\n");
  }
  const good = [];
  const bad = [];
  for (const [dim, get] of Object.entries(DIMENSIONS)) {
    const agg = new Map();
    for (const h of rated) {
      const vals = [].concat(get(h) ?? []).filter(Boolean);
      for (const v of vals) {
        const a = agg.get(v) || { n: 0, sum: 0 };
        a.n += 1;
        a.sum += SCORE[h.rating];
        agg.set(v, a);
      }
    }
    for (const [v, a] of agg) {
      if (a.n < 2) continue;
      const avg = a.sum / a.n;
      const entry = `${dim} "${v}" (rata-rata ${avg.toFixed(1)} dari ${a.n} video)`;
      if (avg >= 1.2) good.push([avg, entry]);
      else if (avg <= -0.5) bad.push([avg, entry]);
    }
  }
  good.sort((a, b) => b[0] - a[0]);
  bad.sort((a, b) => a[0] - b[0]);
  if (good.length) lines.push("Disukai pemilik — perbanyak:", ...good.slice(0, 6).map(([, e]) => `- ${e}`));
  if (bad.length) lines.push("Kurang disukai — hindari/perbaiki:", ...bad.slice(0, 6).map(([, e]) => `- ${e}`));
  const best = rated.filter((h) => h.rating === 1).slice(-3);
  if (best.length) lines.push("Hook yang dapat 🔥 (contoh nada, jangan diulang persis):", ...best.map((h) => `- "${h.hook}" (${h.format})`));
  const notes = rated.filter((h) => h.note).slice(-6);
  if (notes.length) lines.push("Catatan langsung dari pemilik (paling penting):", ...notes.map((h) => `- [${h.date} ${LABEL[h.rating]}] ${h.note}`));
  lines.push(`Total dinilai: ${rated.length} video (${rated.filter((h) => h.rating === 1).length}🔥 ${rated.filter((h) => h.rating === 2).length}👍 ${rated.filter((h) => h.rating === 3).length}👎).`);
  return lines.join("\n");
};

export const fetchPlaybook = async () => {
  if (!process.env.PROMO_SECRET) return null;
  const res = await promoFetch("/api/promo/draft?key=playbook").catch(() => null);
  return res && res.ok ? (await res.json()).data : null;
};

if (process.argv[1] === import.meta.filename) {
  const res = await promoFetch("/api/promo/history");
  if (!res.ok) throw new Error(`riwayat ${res.status}`);
  const text = buildLessons((await res.json()).items ?? [], await fetchPlaybook());
  const out = join(import.meta.dirname, "out");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "lessons.md"), `${text}\n`);
  console.log(text);
}
