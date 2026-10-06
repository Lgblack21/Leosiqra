// Voice-over per scene dengan suara manusia (OpenAI gpt-4o-mini-tts) + waktu
// tiap kata untuk subtitle. OpenAI TTS tidak memberi timestamp, jadi audio
// ditranskripsi balik (whisper-1, granularitas kata) lalu dicocokkan ke teks
// `say` asli — ejaan subtitle tetap persis naskah.
//
// Key OpenRouter (OPENROUTER_API_KEY, atau OPENAI_API_KEY berawalan "sk-or-")
// → model openai/gpt-audio-mini lewat OpenRouter (streaming audio); waktu kata
// dihitung dari rentang bicara (silencedetect) dibagi menurut panjang kata.
// Tanpa key (atau kalau semuanya gagal) → cadangan edge-tts (tts.py).
// Keluaran sama dengan tts.py: <out>/scene-<i>.mp3 + <out>/voice.json
//   [{"file": "scene-0.mp3", "words": [[mulai, selesai, "kata"], ...]}, ...]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export const OPENAI_VOICES = ["coral", "nova", "shimmer", "sage", "ballad", "ash"];
const TTS_MODEL = process.env.PROMO_TTS_MODEL || "gpt-4o-mini-tts";

// Arahan gaya bicara — inti "biar kayak orang beneran, bukan suara Google".
const INSTRUCTIONS = (mood) =>
  [
    "Bicara dalam Bahasa Indonesia sehari-hari seperti kreator konten muda Jakarta yang lagi ngobrol ke teman lewat video pendek.",
    "Hangat, santai, percaya diri, ada senyum di suara. Intonasi naik-turun alami, jeda singkat sebelum poin penting, tekan kata kunci.",
    "Jangan terdengar seperti iklan radio, pembaca berita, atau robot. Tempo agak cepat tapi jelas.",
    "Lafalkan kata Indonesia dengan logat Indonesia asli (bukan logat Inggris). 'Leosiqra' dibaca 'le-o-si-kra'.",
    mood ? `Suasana scene ini: ${mood}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

const MOOD = {
  hook: "bikin penasaran, sedikit dramatis, langsung menarik perhatian",
  number: "kaget campur antusias waktu menyebut angka",
  list: "jelas dan bertenaga, tiap poin terdengar berguna",
  mythfact: "awalnya ragu, lalu meluruskan dengan yakin",
  quiz: "main tebak-tebakan, seru",
  phone: "menunjukkan fitur dengan bangga, kasual",
  device: "menunjukkan fitur dengan bangga, kasual",
  cta: "ramah dan mengajak, tidak memaksa",
};

const openai = async (path, init) => {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });
  if (!res.ok) throw new Error(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
};

const speak = async (text, voice, mood) => {
  const res = await openai("audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, voice, input: text, instructions: INSTRUCTIONS(mood), response_format: "mp3" }),
  });
  return Buffer.from(await res.arrayBuffer());
};

const transcribeWords = async (mp3, text) => {
  const form = new FormData();
  form.append("file", new Blob([mp3], { type: "audio/mpeg" }), "scene.mp3");
  form.append("model", "whisper-1");
  form.append("language", "id");
  form.append("prompt", text);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await openai("audio/transcriptions", { method: "POST", body: form });
  const data = await res.json();
  return (data.words || []).map((w) => ({ start: w.start, end: w.end, text: String(w.word || "") }));
};

// Petakan kata naskah ke garis waktu transkrip. Jumlah kata sama → 1:1;
// beda (angka ditulis lain, kata disambung, dll.) → interpolasi menurut
// posisi huruf, jadi tiap kata naskah tetap dapat waktu yang masuk akal.
export const alignWords = (say, heard) => {
  const tokens = say.split(/\s+/).filter(Boolean);
  if (!tokens.length || !heard.length) return [];
  if (tokens.length === heard.length) return tokens.map((t, i) => [+heard[i].start.toFixed(3), +heard[i].end.toFixed(3), t]);
  // Garis waktu kumulatif dari transkrip: (proporsi huruf → detik).
  const hLen = heard.map((w) => Math.max(1, w.text.trim().length));
  const hTotal = hLen.reduce((a, b) => a + b, 0);
  const knots = [];
  let acc = 0;
  heard.forEach((w, i) => {
    knots.push([acc / hTotal, w.start]);
    acc += hLen[i];
    knots.push([acc / hTotal, w.end]);
  });
  const at = (f) => {
    for (let i = 1; i < knots.length; i++) {
      if (f <= knots[i][0]) {
        const [f0, t0] = knots[i - 1];
        const [f1, t1] = knots[i];
        return f1 === f0 ? t1 : t0 + ((f - f0) / (f1 - f0)) * (t1 - t0);
      }
    }
    return knots.at(-1)[1];
  };
  const tLen = tokens.map((t) => t.length);
  const tTotal = tLen.reduce((a, b) => a + b, 0);
  let pos = 0;
  return tokens.map((t, i) => {
    const s = at(pos / tTotal);
    pos += tLen[i];
    const e = at(pos / tTotal);
    return [+s.toFixed(3), +Math.max(s + 0.08, e).toFixed(3), t];
  });
};

// ── OpenRouter: openai/gpt-audio-mini, audio keluar lewat SSE (pcm16 24 kHz) ──
const OR_MODEL = process.env.PROMO_OR_AUDIO_MODEL || "openai/gpt-audio-mini";
// Suara yang tersedia di model audio chat; suara khusus gpt-4o-mini-tts dipetakan.
const OR_VOICE = { coral: "nova", nova: "nova", shimmer: "shimmer", sage: "shimmer", ballad: "fable", ash: "echo" };

export const openRouterKey = () =>
  process.env.OPENROUTER_API_KEY || (String(process.env.OPENAI_API_KEY || "").startsWith("sk-or-") ? process.env.OPENAI_API_KEY : "");

const letters = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
// Kemiripan kasar transkrip vs naskah (0..1) — menangkap model yang "ngobrol"
// alih-alih membacakan teks.
export const similarity = (a, b) => {
  const x = letters(a), y = letters(b);
  if (!x || !y) return 0;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 2; i++) { const g = s.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const gx = grams(x), gy = grams(y);
  let common = 0;
  for (const [g, n] of gx) common += Math.min(n, gy.get(g) || 0);
  return (2 * common) / (Math.max(1, x.length - 2) + Math.max(1, y.length - 2));
};

export const pcmToMp3 = (pcm) => {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame", "-q:a", "2", "-f", "mp3", "pipe:1"], { input: pcm, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg pcm→mp3 gagal: ${String(r.stderr).slice(-300)}`);
  return r.stdout;
};

// Rentang bicara [mulai, selesai] dalam detik (buang hening di depan/belakang).
export const speechSpan = (mp3) => {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", "pipe:0", "-af", "silencedetect=n=-38dB:d=0.12", "-f", "null", "-"], { input: mp3, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  const log = String(r.stderr);
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  let total = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  if (!total) total = Math.max(0, ...ends, ...starts);
  const begin = starts.length && starts[0] < 0.05 && ends.length ? ends[0] : 0;
  const last = starts.at(-1);
  const finish = last !== undefined && last > begin && (ends.length < starts.length || ends.at(-1) >= total - 0.05) ? last : total;
  return [begin, Math.max(begin + 0.2, finish)];
};

const speakOpenRouter = async (text, voice, mood) => {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${openRouterKey()}`, "x-title": "Leosiqra Promo" },
    body: JSON.stringify({
      model: OR_MODEL,
      modalities: ["text", "audio"],
      audio: { voice: OR_VOICE[voice] || "nova", format: "pcm16" },
      stream: true,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `Kamu pengisi suara (voice-over), BUKAN asisten. Tugasmu hanya MEMBACAKAN teks dari pengguna, persis kata per kata — jangan menjawab, menambah, mengurangi, atau mengomentari. ${INSTRUCTIONS(mood)}`,
        },
        { role: "user", content: `Bacakan persis:\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const chunks = [];
  let transcript = "";
  let buf = "";
  const decoder = new TextDecoder();
  for await (const part of res.body) {
    buf += decoder.decode(part, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let msg;
      try { msg = JSON.parse(data); } catch { continue; }
      if (msg.error) throw new Error(`OpenRouter: ${JSON.stringify(msg.error).slice(0, 200)}`);
      const audio = msg.choices?.[0]?.delta?.audio;
      if (audio?.data) chunks.push(Buffer.from(audio.data, "base64"));
      if (audio?.transcript) transcript += audio.transcript;
    }
  }
  const pcm = Buffer.concat(chunks);
  if (pcm.length < 24000) throw new Error("audio kosong/terlalu pendek");
  if (transcript && similarity(transcript, text) < 0.55) throw new Error(`model tidak membacakan naskah ("${transcript.slice(0, 60)}…")`);
  const mp3 = pcmToMp3(pcm);
  const [a, b] = speechSpan(mp3);
  return { mp3, heard: [{ start: a, end: b, text }] };
};

const viaEdge = (planPath, out) => {
  const r = spawnSync(process.env.PYTHON || "python3", [join(import.meta.dirname, "tts.py"), planPath, out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`tts.py gagal:\n${(r.stderr || "").slice(-1500)}`);
  return "edge:id-ID-GadisNeural";
};

// Mengembalikan nama suara yang dipakai (dicatat di riwayat untuk belajar).
export const synthesizeVoice = async (planPath, out, log = console.log) => {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const viaOR = Boolean(openRouterKey());
  if (!viaOR && !process.env.OPENAI_API_KEY) {
    log("OPENAI_API_KEY / OPENROUTER_API_KEY tidak ada — suara cadangan edge-tts.");
    return viaEdge(planPath, out);
  }
  const voice = OPENAI_VOICES.includes(plan.style.voice) ? plan.style.voice : OPENAI_VOICES[0];
  const tag = viaOR ? `openrouter:${OR_VOICE[voice] || "nova"}` : `openai:${voice}`;
  try {
    const result = [];
    for (const [i, scene] of plan.scenes.entries()) {
      const text = (scene.say || "").trim();
      if (!text) {
        result.push({ file: null, words: [] });
        continue;
      }
      let mp3;
      let heard;
      for (let attempt = 0; ; attempt++) {
        try {
          if (viaOR) ({ mp3, heard } = await speakOpenRouter(text, voice, MOOD[scene.type]));
          else {
            mp3 = await speak(text, voice, MOOD[scene.type]);
            heard = await transcribeWords(mp3, text);
          }
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          log(`${tag} scene ${i} gagal (${error.message}), coba lagi…`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      const name = `scene-${i}.mp3`;
      writeFileSync(join(out, name), mp3);
      result.push({ file: name, words: alignWords(text, heard) });
    }
    writeFileSync(join(out, "voice.json"), JSON.stringify(result));
    return tag;
  } catch (error) {
    log(`Suara ${tag} gagal (${error.message}) — pakai cadangan edge-tts.`);
    return viaEdge(planPath, out);
  }
};
