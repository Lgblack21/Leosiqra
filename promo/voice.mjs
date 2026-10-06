// Voice-over per scene dengan suara manusia (OpenAI gpt-4o-mini-tts) + waktu
// tiap kata untuk subtitle. OpenAI TTS tidak memberi timestamp, jadi audio
// ditranskripsi balik (whisper-1, granularitas kata) lalu dicocokkan ke teks
// `say` asli — ejaan subtitle tetap persis naskah.
//
// Tanpa OPENAI_API_KEY (atau kalau OpenAI gagal) → cadangan edge-tts (tts.py).
// Keluaran sama dengan tts.py: <out>/scene-<i>.mp3 + <out>/voice.json
//   [{"file": "scene-0.mp3", "words": [[mulai, selesai, "kata"], ...]}, ...]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const viaEdge = (planPath, out) => {
  const r = spawnSync(process.env.PYTHON || "python3", [join(import.meta.dirname, "tts.py"), planPath, out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`tts.py gagal:\n${(r.stderr || "").slice(-1500)}`);
  return "edge:id-ID-GadisNeural";
};

// Mengembalikan nama suara yang dipakai (dicatat di riwayat untuk belajar).
export const synthesizeVoice = async (planPath, out, log = console.log) => {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (!process.env.OPENAI_API_KEY) {
    log("OPENAI_API_KEY tidak ada — suara cadangan edge-tts.");
    return viaEdge(planPath, out);
  }
  const voice = OPENAI_VOICES.includes(plan.style.voice) ? plan.style.voice : OPENAI_VOICES[0];
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
          mp3 = await speak(text, voice, MOOD[scene.type]);
          heard = await transcribeWords(mp3, text);
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          log(`OpenAI scene ${i} gagal (${error.message}), coba lagi…`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      const name = `scene-${i}.mp3`;
      writeFileSync(join(out, name), mp3);
      result.push({ file: name, words: alignWords(text, heard) });
    }
    writeFileSync(join(out, "voice.json"), JSON.stringify(result));
    return `openai:${voice}`;
  } catch (error) {
    log(`Suara OpenAI gagal (${error.message}) — pakai cadangan edge-tts.`);
    return viaEdge(planPath, out);
  }
};
