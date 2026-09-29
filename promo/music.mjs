// Musik latar sintetis (bebas hak cipta, beda tiap hari): pad akor, arpeggio,
// bass, drum, plus whoosh di tiap transisi dan "boom" di CTA. Output WAV stereo.
import { writeFileSync } from "node:fs";
import { makeRng } from "./plan.mjs";

const SR = 44100;
const PROGRESSIONS = [
  [[0, "M"], [7, "M"], [9, "m"], [5, "M"]],
  [[9, "m"], [5, "M"], [0, "M"], [7, "M"]],
  [[0, "M"], [9, "m"], [5, "M"], [7, "M"]],
  [[0, "m"], [8, "M"], [3, "M"], [10, "M"]],
  [[2, "m"], [7, "M"], [0, "M"], [0, "M"]],
  [[5, "M"], [7, "M"], [4, "m"], [9, "m"]],
];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export const renderMusic = ({ duration, music, transitions, ctaAt, outPath }) => {
  const rng = makeRng(music.seed);
  const n = Math.ceil((duration + 0.5) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / music.bpm;
  const bar = beat * 4;
  const prog = PROGRESSIONS[music.progression % PROGRESSIONS.length];
  const base = 48 + music.root; // C3 + root
  const pattern = music.pattern % 4;

  const add = (buf, i, v) => {
    if (i >= 0 && i < n) buf[i] += v;
  };
  const both = (i, v, pan = 0) => {
    add(L, i, v * (1 - Math.max(0, pan)));
    add(R, i, v * (1 + Math.min(0, pan)));
  };

  // Kurva sidechain: volume pad/bass turun sesaat setelah tiap kick.
  const kickTimes = [];
  for (let t = 0; t < duration; t += beat) {
    const beatIdx = Math.round(t / beat) % 4;
    if (pattern === 1 && beatIdx % 2 === 1) continue; // kick di 1 & 3 saja
    kickTimes.push(t);
  }
  const duck = (t) => {
    let g = 1;
    for (const k of kickTimes) {
      const d = t - k;
      if (d >= 0 && d < 0.3) g = Math.min(g, 0.45 + 0.55 * (d / 0.3));
    }
    return g;
  };

  // Pad akor (saw aditif, sedikit detune kiri/kanan) + filter low-pass satu kutub.
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    const [off, q] = prog[barIdx % prog.length];
    const notes = [0, q === "M" ? 4 : 3, 7, 12].map((iv) => base + 12 + off + iv);
    const inBar = (t % bar) / bar;
    const env = Math.min(1, inBar * 6) * (0.85 + 0.15 * Math.cos(inBar * Math.PI * 2));
    let sL = 0;
    let sR = 0;
    for (const m of notes) {
      const f = hz(m);
      for (let h = 1; h <= 5; h++) {
        sL += Math.sin(2 * Math.PI * f * 1.002 * h * t) / h;
        sR += Math.sin(2 * Math.PI * f * 0.998 * h * t) / h;
      }
    }
    const intro = Math.min(1, t / (bar * 0.75));
    const cutoff = 0.04 + 0.1 * intro; // filter "terbuka" pelan di awal
    lpL += cutoff * (sL - lpL);
    lpR += cutoff * (sR - lpR);
    const g = 0.035 * env * duck(t);
    L[i] += lpL * g;
    R[i] += lpR * g;
  }

  // Arpeggio / pluck (seperdelapan ketukan).
  const step = beat / 2;
  for (let t = bar / 2; t < duration; t += step) {
    const barIdx = Math.floor(t / bar);
    const [off, q] = prog[barIdx % prog.length];
    const tones = [0, q === "M" ? 4 : 3, 7, 12, q === "M" ? 16 : 15];
    const k = Math.round(t / step);
    if (pattern === 2 && k % 3 === 2) continue;
    const m = base + 24 + off + tones[(k * (pattern + 1) + rng.int(0, 1)) % tones.length];
    const f = hz(m);
    const len = Math.floor(0.35 * SR);
    const i0 = Math.floor(t * SR);
    const pan = k % 2 ? 0.35 : -0.35;
    for (let j = 0; j < len; j++) {
      const tt = j / SR;
      const v = (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(6 * Math.PI * f * tt)) * Math.exp(-tt * 9) * 0.06;
      both(i0 + j, v, pan);
    }
  }

  // Bass.
  for (let t = 0; t < duration; t += beat) {
    const beatIdx = Math.round(t / beat) % 4;
    const offbeat = pattern === 3;
    if (!offbeat && beatIdx % 2 === 1) continue;
    const start = offbeat ? t + beat / 2 : t;
    const barIdx = Math.floor(start / bar);
    const f = hz(base - 12 + prog[barIdx % prog.length][0]);
    const len = Math.floor(beat * 0.9 * SR);
    const i0 = Math.floor(start * SR);
    for (let j = 0; j < len; j++) {
      const tt = j / SR;
      const v = Math.sin(2 * Math.PI * f * tt) * Math.min(1, tt * 60) * Math.exp(-tt * 2.5) * 0.16 * duck(start + tt);
      both(i0 + j, v);
    }
  }

  // Drum: kick, snare/clap, hi-hat. Masuk setelah 1 bar intro.
  const drumsFrom = bar;
  for (const k of kickTimes) {
    if (k < drumsFrom) continue;
    const i0 = Math.floor(k * SR);
    for (let j = 0; j < 0.3 * SR; j++) {
      const tt = j / SR;
      const f = 45 + 90 * Math.exp(-tt * 30);
      both(i0 + j, Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 9) * 0.35);
    }
  }
  for (let t = drumsFrom + beat; t < duration; t += beat * 2) {
    const i0 = Math.floor(t * SR);
    let prev = 0;
    for (let j = 0; j < 0.18 * SR; j++) {
      const tt = j / SR;
      const noise = rng.next() * 2 - 1;
      const hp = noise - prev;
      prev = noise;
      both(i0 + j, (hp * 0.5 + noise * 0.5) * Math.exp(-tt * 22) * 0.12);
    }
  }
  const hatStep = pattern === 0 ? beat / 4 : beat / 2;
  for (let t = drumsFrom; t < duration; t += hatStep) {
    const i0 = Math.floor(t * SR);
    const accent = Math.round(t / hatStep) % 2 ? 0.6 : 1;
    let prev = 0;
    for (let j = 0; j < 0.05 * SR; j++) {
      const noise = rng.next() * 2 - 1;
      const hp = noise - prev;
      prev = noise;
      both(i0 + j, hp * Math.exp(-(j / SR) * 80) * 0.035 * accent, 0.2);
    }
  }

  // Whoosh transisi (noise dengan sapuan filter) + boom di CTA.
  for (const tr of transitions) {
    const len = Math.floor(0.55 * SR);
    const i0 = Math.floor((tr - 0.35) * SR);
    let lp = 0;
    for (let j = 0; j < len; j++) {
      const x = j / len;
      const amp = Math.sin(Math.PI * x) ** 2;
      const c = 0.02 + 0.5 * Math.sin(Math.PI * x);
      lp += c * (rng.next() * 2 - 1 - lp);
      both(i0 + j, lp * amp * 0.22, (x - 0.5) * 0.8);
    }
  }
  if (ctaAt) {
    const i0 = Math.floor(ctaAt * SR);
    for (let j = 0; j < 1.2 * SR; j++) {
      const tt = j / SR;
      both(i0 + j, Math.sin(2 * Math.PI * (38 + 40 * Math.exp(-tt * 8)) * tt) * Math.exp(-tt * 3) * 0.4);
    }
  }

  // Fade in/out + normalisasi.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (duration - t) / 1.5));
    L[i] *= g;
    R[i] *= g;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  const data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
  }
  writeFileSync(outPath, data);
};
