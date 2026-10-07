// Mesin riset pertumbuhan leosiqra.com — SEMUA angka dari pengukuran nyata, tidak ada yang dikarang.
//
//   node growth.mjs audit            → audit tiap URL di sitemap (status, title, deskripsi, h1, canonical, schema, kata, kecepatan)
//   node growth.mjs keywords         → ide kata kunci dari Google Suggest (id-ID) + celah vs. halaman yang sudah ada
//   node growth.mjs speed            → skor PageSpeed mobile untuk beranda (kalau API publik mau menjawab)
//   node growth.mjs all              → ketiganya + ringkasan; ditulis juga ke state/growth-latest.json
//
// Dibaca routine "CEO Pertumbuhan" (lihat GROWTH_ROUTINE.md). Tidak mengirim apa pun ke luar selain permintaan baca.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE_URL || "https://www.leosiqra.com";
const WORKERS_DEV = "https://membersite-leosiqra.leowendry.workers.dev";   // cadangan bila proteksi bot menantang IP datacenter
const UA = "Mozilla/5.0 (compatible; LeosiqraGrowthBot/1.0; +https://www.leosiqra.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, opt = {}) => {
  const t0 = Date.now();
  let res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "id-ID,id;q=0.9" }, redirect: "follow", ...opt });
  const challenged = res.status === 403 && (res.headers.get("content-type") || "").includes("text/html");
  if (challenged && url.startsWith(SITE)) {
    res = await fetch(url.replace(SITE, WORKERS_DEV), { headers: { "user-agent": UA }, redirect: "follow", ...opt });
  }
  const text = await res.text();
  return { status: res.status, ms: Date.now() - t0, bytes: Buffer.byteLength(text), text, url: res.url };
};

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const meta = (h, re) => (h.match(re) || [])[1]?.replace(/&amp;/g, "&").trim() || "";

export async function sitemapUrls() {
  const r = await get(`${SITE}/sitemap.xml`);
  if (r.status !== 200) return [];
  return [...r.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

export async function auditPage(url) {
  const r = await get(url);
  const h = r.text, issues = [];
  const title = meta(h, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = meta(h, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || meta(h, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canonical = meta(h, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const h1 = [...h.matchAll(/<h1[\s\S]*?<\/h1>/gi)].length;
  const h2 = [...h.matchAll(/<h2[\s\S]*?<\/h2>/gi)].length;
  const og = /property=["']og:title["']/i.test(h) && /property=["']og:image["']/i.test(h);
  const ld = [...h.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)].map((m) => m[1]);
  const words = strip(h).split(" ").filter(Boolean).length;
  const imgs = [...h.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt=["'][^"']+["']/i.test(t)).length;
  const links = [...h.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const internal = links.filter((l) => l.startsWith("/") || l.includes("leosiqra.com")).length;
  if (r.status !== 200) issues.push(`HTTP ${r.status}`);
  if (!title) issues.push("title kosong"); else if (title.length > 65) issues.push(`title ${title.length} karakter (>65, terpotong di Google)`); else if (title.length < 25) issues.push(`title pendek (${title.length})`);
  if (!desc) issues.push("meta description kosong"); else if (desc.length > 160) issues.push(`description ${desc.length} karakter (>160)`); else if (desc.length < 70) issues.push(`description pendek (${desc.length})`);
  if (!canonical) issues.push("tanpa canonical");
  if (h1 !== 1) issues.push(`jumlah h1 = ${h1} (idealnya 1)`);
  if (!og) issues.push("Open Graph (title/image) tidak lengkap");
  if (!ld.length) issues.push("tanpa schema JSON-LD");
  if (words < 300 && !/auth|privacy|terms|hubungi/.test(url)) issues.push(`isi tipis (${words} kata)`);
  if (noAlt) issues.push(`${noAlt} gambar tanpa alt`);
  if (r.ms > 1500) issues.push(`respons lambat (${r.ms} ms)`);
  return { url, status: r.status, ms: r.ms, kb: Math.round(r.bytes / 1024), title, titleLen: title.length, descLen: desc.length, h1, h2, words, schema: [...new Set(ld)], internalLinks: internal, issues };
}

export async function audit() {
  const urls = await sitemapUrls();
  const pages = [];
  for (const u of urls) { try { pages.push(await auditPage(u)); } catch (e) { pages.push({ url: u, status: 0, issues: [`gagal diambil: ${e.message}`] }); } await sleep(250); }
  const robots = await get(`${SITE}/robots.txt`).catch(() => ({ status: 0, text: "" }));
  const issueCount = pages.reduce((n, p) => n + (p.issues?.length || 0), 0);
  return { checkedAt: new Date().toISOString(), pages: pages.length, urls, robots: { status: robots.status, sitemapListed: /sitemap:/i.test(robots.text || "") }, issueCount, results: pages };
}

// ---- kata kunci ---------------------------------------------------------------------------
const SEEDS = [
  "aplikasi catatan keuangan", "catatan keuangan pribadi", "catatan keuangan harian", "cara mengatur keuangan gaji", "cara menabung", "dana darurat",
  "aplikasi budgeting", "cara melunasi hutang", "aplikasi pencatat pengeluaran", "cara mencatat pengeluaran", "lapor spt tahunan", "aplikasi keuangan gratis",
];
const MODIFIERS = ["", " cara", " contoh", " untuk", " gratis", " terbaik", " tips"];

async function suggest(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=id&gl=id&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) return [];
  const j = await res.json().catch(() => null);
  return Array.isArray(j?.[1]) ? j[1] : [];
}

const slugWords = (s) => s.toLowerCase().replace(/https?:\/\/[^/]+/, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const STOP = new Set(["yang", "dan", "untuk", "dengan", "dari", "ada", "apa", "cara", "aplikasi"]);

export async function keywords(existingUrls) {
  const urls = existingUrls || (await sitemapUrls());
  const covered = urls.map((u) => new Set(slugWords(u)));
  const seen = new Map();
  for (const seed of SEEDS) {
    for (const mod of MODIFIERS.slice(0, 3)) {
      try { for (const s of await suggest(seed + mod)) if (!seen.has(s)) seen.set(s, seed); } catch { /* lewati */ }
      await sleep(180);
    }
  }
  const list = [...seen.keys()].map((kw) => {
    const w = slugWords(kw).filter((x) => !STOP.has(x));
    const cover = Math.max(0, ...covered.map((set) => (w.length ? w.filter((x) => set.has(x)).length / w.length : 0)));
    const intent = /^(cara|bagaimana|apa|kenapa|mengapa|tips|contoh|rumus)/.test(kw) ? "informasi" : /(aplikasi|app|download|gratis|terbaik)/.test(kw) ? "komersial" : "umum";
    return { keyword: kw, seed: seen.get(kw), intent, coverage: +cover.toFixed(2), words: kw.split(" ").length };
  });
  const gaps = list.filter((k) => k.coverage < .5 && k.words >= 3).sort((a, b) => (b.intent === "informasi") - (a.intent === "informasi") || a.coverage - b.coverage || b.words - a.words);
  return { checkedAt: new Date().toISOString(), total: list.length, gaps: gaps.length, top: gaps.slice(0, 25), all: list };
}

export async function speed() {
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(SITE + "/")}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json(), c = j.lighthouseResult?.categories || {}, a = j.lighthouseResult?.audits || {};
    const sc = (k) => (c[k]?.score != null ? Math.round(c[k].score * 100) : null);
    return { ok: true, performance: sc("performance"), seo: sc("seo"), accessibility: sc("accessibility"), bestPractices: sc("best-practices"), lcp: a["largest-contentful-paint"]?.displayValue, cls: a["cumulative-layout-shift"]?.displayValue, tbt: a["total-blocking-time"]?.displayValue };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function all() {
  const a = await audit();
  const k = await keywords(a.urls);
  const s = await speed();
  const topIssues = a.results.flatMap((p) => (p.issues || []).map((i) => ({ url: p.url, issue: i }))).slice(0, 30);
  const out = { checkedAt: new Date().toISOString(), site: SITE, summary: { pages: a.pages, issues: a.issueCount, keywordIdeas: k.total, contentGaps: k.gaps, speed: s.ok ? { performance: s.performance, seo: s.seo, lcp: s.lcp } : null }, audit: a, keywords: k, speed: s, topIssues };
  fs.mkdirSync(path.join(HERE, "state"), { recursive: true });
  fs.writeFileSync(path.join(HERE, "state", "growth-latest.json"), JSON.stringify(out, null, 2));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || "all";
  const fn = { audit, keywords: () => keywords(), speed, all }[cmd];
  if (!fn) { console.error("perintah: audit | keywords | speed | all"); process.exit(2); }
  fn().then((r) => console.log(JSON.stringify(cmd === "all" ? { summary: r.summary, topIssues: r.topIssues, topKeywordGaps: r.keywords.top.slice(0, 12), speed: r.speed } : r, null, 2))).catch((e) => { console.error(e); process.exit(1); });
}
