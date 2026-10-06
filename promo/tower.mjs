// Dokumen untuk DB LGBLACK Tower, dihitung PASTI dari data Worker (riwayat,
// antrean posting, statistik member) — routine tinggal menulisnya lewat tool
// ArtifactData (url Tower di TEAMS.md). Tidak ada angka karangan.
//
//   node tower.mjs metrik            → JSON untuk metrik/ringkas
//   node tower.mjs videos [n]        → [{id, data}] untuk koleksi konten (n terakhir, default 7)
//   node tower.mjs status <stage> "<label>" → JSON untuk status/hari-ini (stage 0..4)
//   node tower.mjs kb                → JSON untuk kb/leosiqra (FEATURES + OFFER)
import { promoFetch } from "./api.mjs";
import { FEATURES, OFFER } from "./content.mjs";

const getJson = async (path) => {
  const res = await promoFetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
};
const wibDate = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const RATING = { 1: "🔥", 2: "👍", 3: "👎" };
const SCORE = { 1: 2, 2: 1, 3: -2 };

const sumMetric = (items, platform, key) =>
  items.reduce((n, it) => n + Number(it.metrics?.[platform]?.[key] ?? 0), 0);

export const buildMetrik = (history, queue, stats) => {
  const rated = history.filter((h) => SCORE[h.rating] !== undefined);
  const byFormat = new Map();
  for (const h of rated) {
    const key = h.format || "lainnya";
    const f = byFormat.get(key) || { name: key, sum: 0, n: 0 };
    f.sum += SCORE[h.rating];
    f.n += 1;
    byFormat.set(key, f);
  }
  const week = queue.filter((q) => q.status === "terposting" && Date.now() - Date.parse(q.postAt) < 7 * 86400e3);
  const views = (p) => sumMetric(week, p, "views");
  const likes = (p) => sumMetric(week, p, "likes");
  return {
    updatedAt: Date.now(),
    videos: history.length,
    rated: rated.length,
    fire: rated.filter((h) => h.rating === 1).length,
    ok: rated.filter((h) => h.rating === 2).length,
    bad: rated.filter((h) => h.rating === 3).length,
    formats: [...byFormat.values()].map((f) => ({ name: f.name, avg: +(f.sum / f.n).toFixed(2), n: f.n })).sort((a, b) => b.avg - a.avg),
    posts: { ig: queue.filter((q) => q.ig?.id).length, yt: queue.filter((q) => q.yt?.id).length },
    views7d: views("ig") + views("yt"),
    likes7d: likes("ig") + likes("yt"),
    platform: { ig: { views: views("ig"), likes: likes("ig") }, yt: { views: views("yt"), likes: likes("yt") } },
    members: stats?.members ?? null,
    lastVideo: history.at(-1) ? { hook: history.at(-1).hook, date: history.at(-1).date, rating: history.at(-1).rating ?? null } : null,
  };
};

export const buildVideos = (history, queue, n = 7) =>
  history.slice(-n).reverse().map((h) => {
    const q = queue.find((x) => x.id === h.id) || {};
    const status = q.status === "terposting" ? "terposting" : q.status === "terjadwal" ? "terjadwal" : q.status === "batal" ? "batal" : "terkirim";
    const m = q.metrics || h.metrics || {};
    return {
      id: h.id || `${h.date}-${h.seed}`,
      data: {
        kind: "video",
        createdAt: Date.parse(h.date) || Date.now(),
        date: h.date,
        hook: h.hook || h.topic,
        format: h.format,
        topic: h.topic,
        voice: h.voice || null,
        style: h.kind || null,
        rating: h.rating ?? null,
        ratingLabel: RATING[h.rating] || null,
        note: h.note || null,
        status,
        postAt: q.postAt ? new Date(q.postAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : null,
        igUrl: q.ig?.url || h.igUrl || null,
        ytUrl: q.yt?.url || h.ytUrl || null,
        metrics: m.ig || m.yt ? { views: Number(m.ig?.views ?? 0) + Number(m.yt?.views ?? 0), likes: Number(m.ig?.likes ?? 0) + Number(m.yt?.likes ?? 0), comments: Number(m.ig?.comments ?? 0) + Number(m.yt?.comments ?? 0) } : null,
        by: "Tim Konten",
      },
    };
  });

if (process.argv[1] === import.meta.filename) {
  const [cmd, a, b] = process.argv.slice(2);
  let out;
  if (cmd === "metrik" || cmd === "videos") {
    const [hist, queue, stats] = await Promise.all([
      getJson("/api/promo/history").then((d) => d.items ?? []),
      getJson("/api/promo/queue").then((d) => d.items ?? []).catch(() => []),
      getJson("/api/promo/stats").catch(() => null),
    ]);
    out = cmd === "metrik" ? buildMetrik(hist, queue, stats) : buildVideos(hist, queue, Number(a) || 7);
  } else if (cmd === "status") {
    const stage = Number(a);
    if (!Number.isInteger(stage) || stage < -1 || stage > 4) throw new Error("stage harus -1..4");
    out = { date: wibDate(), stage, label: String(b || "").slice(0, 80), updatedAt: Date.now() };
  } else if (cmd === "kb") {
    out = { features: FEATURES.map((f) => [f.name, f.fact]), offer: OFFER, updatedAt: Date.now() };
  } else {
    console.error("pakai: node tower.mjs metrik | videos [n] | status <stage> <label> | kb");
    process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
}
