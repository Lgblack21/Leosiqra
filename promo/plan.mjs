// Menyusun rencana video hari ini: format & topik (tidak mengulang riwayat),
// naskah (AI, dengan cadangan naskah bawaan), dan gaya visual/musik acak.
import { FORMATS, FORMAT_ORDER, FEATURES, FALLBACK_SCRIPTS, FALLBACK_CAPTION_TAIL, OFFER, HANDLES } from "./content.mjs";

// RNG ber-seed (mulberry32) — seed dicetak di log supaya video bisa dibuat ulang persis.
export const makeRng = (seed) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
};

export const PALETTES = [
  { name: "indigo", bg1: "#1e1b4b", bg2: "#4338ca", accent: "#a5b4fc", pop: "#facc15", text: "#ffffff", card: "#ffffff", ink: "#0f172a" },
  { name: "emerald", bg1: "#022c22", bg2: "#047857", accent: "#6ee7b7", pop: "#fde047", text: "#ffffff", card: "#ffffff", ink: "#052e16" },
  { name: "sunset", bg1: "#4c0519", bg2: "#ea580c", accent: "#fdba74", pop: "#fef08a", text: "#ffffff", card: "#fff7ed", ink: "#431407" },
  { name: "ocean", bg1: "#082f49", bg2: "#0891b2", accent: "#67e8f9", pop: "#f0abfc", text: "#ffffff", card: "#ffffff", ink: "#083344" },
  { name: "grape", bg1: "#2e1065", bg2: "#c026d3", accent: "#f5d0fe", pop: "#fde047", text: "#ffffff", card: "#ffffff", ink: "#3b0764" },
  { name: "midnight", bg1: "#020617", bg2: "#1e293b", accent: "#38bdf8", pop: "#a3e635", text: "#f8fafc", card: "#0f172a", ink: "#f8fafc" },
  { name: "cream", bg1: "#fef3c7", bg2: "#fde68a", accent: "#b45309", pop: "#dc2626", text: "#1c1917", card: "#ffffff", ink: "#1c1917" },
  { name: "mint", bg1: "#ecfdf5", bg2: "#a7f3d0", accent: "#047857", pop: "#7c3aed", text: "#064e3b", card: "#ffffff", ink: "#064e3b" },
  { name: "neon", bg1: "#09090b", bg2: "#18181b", accent: "#22d3ee", pop: "#f472b6", text: "#fafafa", card: "#18181b", ink: "#fafafa" },
  { name: "rose", bg1: "#fff1f2", bg2: "#fecdd3", accent: "#be123c", pop: "#4f46e5", text: "#4c0519", card: "#ffffff", ink: "#4c0519" },
];
export const BACKGROUNDS = ["blobs", "grid", "rays", "dots", "waves"];
export const FONTS = [
  { head: "Plus Jakarta Sans", body: "Plus Jakarta Sans", weight: 800 },
  { head: "Bricolage Grotesque", body: "Plus Jakarta Sans", weight: 800 },
  { head: "Space Grotesk", body: "Inter", weight: 700 },
  { head: "Poppins", body: "Poppins", weight: 800 },
  { head: "Archivo Black", body: "Inter", weight: 400 },
  { head: "DM Serif Display", body: "Plus Jakarta Sans", weight: 400 },
];
export const TRANSITIONS = ["slide", "zoom", "wipe", "flip", "blur"];
export const SUBTITLE_STYLES = ["pill", "karaoke", "bold"];
const SCREENS = ["quick", "scan", "voice", "ai", "savings", "budget", "debt", "level", "stats", "market", "recurring", "tax"];
const SCENE_TYPES = ["hook", "number", "list", "mythfact", "quiz", "phone", "cta"];

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const words = (s) => clip(s, 400).split(" ").filter(Boolean).length;

// Normalisasi + validasi naskah (dari AI atau cadangan). Lempar error kalau
// tidak layak — pemanggil akan pakai cadangan.
export const normalizeScript = (raw) => {
  if (!raw || !Array.isArray(raw.scenes)) throw new Error("naskah tanpa scenes");
  const scenes = [];
  for (const s of raw.scenes) {
    if (!SCENE_TYPES.includes(s?.type)) continue;
    const base = { type: s.type, say: clip(s.say, 260), emoji: clip(s.emoji, 8) };
    if (!base.say || words(base.say) > 32) throw new Error(`say kosong/terlalu panjang: ${base.say}`);
    if (s.type === "hook" || s.type === "cta") scenes.push({ ...base, text: clip(s.text, 60) });
    else if (s.type === "number") {
      const to = Number(s.to);
      if (!Number.isFinite(to) || to <= 0 || to > 1e13) throw new Error("angka tidak valid");
      scenes.push({ ...base, label: clip(s.label, 40), prefix: clip(s.prefix, 6), suffix: clip(s.suffix, 14), to: Math.round(to) });
    } else if (s.type === "list") {
      const items = (Array.isArray(s.items) ? s.items : []).map((i) => clip(i, 42)).filter(Boolean).slice(0, 4);
      if (items.length < 2) throw new Error("list kurang item");
      scenes.push({ ...base, title: clip(s.title, 40), items });
    } else if (s.type === "mythfact") {
      if (!s.myth || !s.fact) throw new Error("mitos/fakta kosong");
      scenes.push({ ...base, myth: clip(s.myth, 60), fact: clip(s.fact, 60) });
    } else if (s.type === "quiz") {
      const options = (Array.isArray(s.options) ? s.options : []).map((o) => clip(o, 32)).filter(Boolean).slice(0, 3);
      const answer = Number(s.answer);
      if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new Error("kuis tidak valid");
      scenes.push({ ...base, question: clip(s.question, 70), options, answer });
    } else if (s.type === "phone") {
      scenes.push({ ...base, screen: SCREENS.includes(s.screen) ? s.screen : "quick", text: clip(s.text, 40) });
    }
  }
  if (scenes.length < 3 || scenes.length > 7) throw new Error(`jumlah scene ${scenes.length}`);
  if (scenes[0].type !== "hook") scenes.unshift({ type: "hook", text: clip(raw.title || "Keuanganmu", 60), say: "", emoji: "💸" });
  if (scenes[scenes.length - 1].type !== "cta") {
    scenes.push({ type: "cta", text: "Coba gratis 14 hari", say: "Coba gratis empat belas hari. Follow untuk tips berikutnya!", emoji: "" });
  }
  const total = scenes.reduce((n, s) => n + words(s.say), 0);
  if (total > 95) throw new Error(`narasi terlalu panjang (${total} kata)`);
  const hashtags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h) => "#" + String(h).replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter((h) => h.length > 2)
    .slice(0, 8);
  if (!hashtags.includes("#leosiqra")) hashtags.push("#leosiqra");
  return { scenes: scenes.filter((s) => s.say || s.type === "hook"), caption: clip(raw.caption, 600), hashtags };
};

const SYSTEM_PROMPT = `Kamu content creator TikTok/Reels/Shorts untuk Leosiqra, aplikasi pencatat & pengatur keuangan pribadi berbahasa Indonesia.
Tulis naskah video vertikal 15–25 detik yang bikin orang berhenti scroll: hook kuat di 2 detik pertama, bahasa santai anak muda Indonesia (boleh "gue/kamu", jangan terlalu baku), padat, tidak klise.

ATURAN KETAT:
- Hanya sebut fitur Leosiqra dari daftar FITUR yang diberikan, jangan mengarang fitur/harga/angka pengguna.
- Penawaran resmi: "${OFFER}"
- Angka hitung-hitungan harus BENAR secara matematika.
- Field "say" = kalimat yang DIUCAPKAN voice-over: tulis angka dengan kata atau bentuk yang enak diucapkan (mis. "dua puluh lima ribu", bukan "Rp25.000"), maks 25 kata per scene, total semua say maks 75 kata.
- Field teks di layar (text/label/items/...) pendek & punchy, boleh pakai angka.
- 4 sampai 6 scene. Scene pertama "hook", scene terakhir "cta" (ajak coba gratis + follow).

TIPE SCENE (pilih yang cocok, variasikan):
{"type":"hook","text":"maks 6 kata","emoji":"1 emoji","say":"..."}
{"type":"number","label":"mis. Setahun jadi","prefix":"Rp","to":9125000,"suffix":"","say":"..."}
{"type":"list","title":"judul pendek","items":["2-4 poin, maks 5 kata"],"say":"..."}
{"type":"mythfact","myth":"...","fact":"...","say":"..."}
{"type":"quiz","question":"...","options":["2-3 opsi pendek"],"answer":0,"say":"pertanyaan lalu jawabannya"}
{"type":"phone","screen":"${SCREENS.join("|")}","text":"maks 4 kata","say":"..."}
{"type":"cta","text":"maks 5 kata","say":"..."}

Balas HANYA JSON: {"title":"...","scenes":[...],"caption":"caption IG/YouTube 1-3 kalimat + emoji, ajakan komentar/simpan","hashtags":["5-7 hashtag relevan tanpa spasi"]}`;

const callAi = async ({ format, topic, avoidHooks }) => {
  const f = FORMATS[format];
  const user = [
    `FORMAT: ${f.label} — ${f.guide}`,
    `TOPIK: ${topic}`,
    `FITUR (hanya boleh ini):\n${FEATURES.map((x) => `- ${x.name} [screen: ${x.id}]: ${x.fact}`).join("\n")}`,
    avoidHooks.length ? `JANGAN mirip hook lama ini:\n${avoidHooks.map((h) => `- ${h}`).join("\n")}` : "",
    `Handle: Instagram ${HANDLES.instagram}, YouTube ${HANDLES.youtube}. Hari ini: ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  let content;
  if (process.env.PROMO_SECRET) {
    // Lewat Worker Leosiqra (memakai key OpenRouter yang dipasang di sana).
    const res = await fetch(`${process.env.PROMO_API_URL || "https://www.leosiqra.com"}/api/promo/script`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-promo-secret": process.env.PROMO_SECRET },
      body: JSON.stringify({ system: SYSTEM_PROMPT, user }),
    });
    if (!res.ok) throw new Error(`Worker promo/script ${res.status}: ${(await res.text()).slice(0, 200)}`);
    content = (await res.json()).content ?? "";
  } else if (process.env.OPENROUTER_API_KEY) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "x-title": "Leosiqra Promo" },
      body: JSON.stringify({
        models: ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"],
        route: "fallback",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        temperature: 1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    content = (await res.json()).choices?.[0]?.message?.content ?? "";
  } else {
    throw new Error("PROMO_SECRET / OPENROUTER_API_KEY tidak ada");
  }
  return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
};

export const buildPlan = async ({ seed, history }) => {
  const rng = makeRng(seed);
  const recent = history.slice(-60);
  const lastFormat = recent.at(-1)?.format;
  const format = FORMAT_ORDER[(FORMAT_ORDER.indexOf(lastFormat) + 1) % FORMAT_ORDER.length] || rng.pick(FORMAT_ORDER);
  const usedTopics = new Set(recent.map((h) => h.topic));
  const fresh = FORMATS[format].topics.filter((t) => !usedTopics.has(t));
  const topic = rng.pick(fresh.length ? fresh : FORMATS[format].topics);

  let script;
  let source = "ai";
  try {
    // PROMO_SCRIPT_FILE: pakai naskah dari file (uji tampilan tanpa memanggil AI).
    const raw = process.env.PROMO_SCRIPT_FILE
      ? JSON.parse((await import("node:fs")).readFileSync(process.env.PROMO_SCRIPT_FILE, "utf8"))
      : await callAi({ format, topic, avoidHooks: recent.slice(-10).map((h) => h.hook).filter(Boolean) });
    script = normalizeScript(raw);
  } catch (error) {
    console.warn("Naskah AI gagal, pakai cadangan:", error.message);
    source = "fallback";
    const usedFallback = new Set(recent.filter((h) => h.source === "fallback").map((h) => h.topic));
    const pool = FALLBACK_SCRIPTS.filter((s) => !usedFallback.has(s.topic));
    const fb = rng.pick(pool.length ? pool : FALLBACK_SCRIPTS);
    script = normalizeScript(fb);
    script.format = fb.format;
    script.topic = fb.topic;
  }

  const palette = rng.pick(PALETTES.filter((p) => p.name !== recent.at(-1)?.palette));
  const style = {
    palette,
    background: rng.pick(BACKGROUNDS),
    font: rng.pick(FONTS),
    transition: rng.pick(TRANSITIONS),
    subtitle: rng.pick(SUBTITLE_STYLES),
    voiceRate: rng.pick(["+6%", "+8%", "+10%", "+12%"]),
    music: {
      bpm: rng.int(92, 124),
      root: rng.int(0, 11),
      progression: rng.int(0, 5),
      pattern: rng.int(0, 3),
      seed: rng.int(1, 1e9),
    },
  };

  return {
    seed,
    date: new Date().toISOString(),
    format: script.format || format,
    topic: script.topic || topic,
    source,
    scenes: script.scenes,
    caption: (script.caption || "") + FALLBACK_CAPTION_TAIL,
    hashtags: script.hashtags,
    style,
  };
};
