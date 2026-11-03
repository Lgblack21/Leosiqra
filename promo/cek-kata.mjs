#!/usr/bin/env node
// Cek jumlah kata naskah/shot list SEBELUM draft disimpan (Sesi 1 & Sesi 2).
// Dibuat karena jumlah kata selama ini ditaksir manual dan berulang kali lolos
// batas (kesalahan/shotlist-lewat-batas-kata). Hitungannya sama dengan
// plan.mjs (pisah spasi), plus peringatan untuk angka berdigit di `say`:
// "50" dihitung 1 kata tapi diucapkan "lima puluh" (2 kata) — tulis dengan kata.
//
// Pakai:
//   node promo/cek-kata.mjs <file.json>        # atau: ... | node promo/cek-kata.mjs -
//   node promo/cek-kata.mjs <file.json> --total 52   # batas total lebih ketat
// File boleh berisi { scenes: [...] }, { script: { scenes } }, { shots: [...] },
// atau langsung array scene. Scene = { type, text?, say? }.
// Batas bawaan = ROUTINE.md: hook ≤ 6 kata, say ≤ 25 kata/scene, total say ≤ 75.
// Keluar 1 kalau ada yang lewat batas (revisi dulu, jangan simpan draft).
import { readFileSync } from "node:fs";

export const countWords = (s) => String(s ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

export const findScenes = (raw) => {
  if (Array.isArray(raw)) return raw;
  for (const c of [raw?.scenes, raw?.script?.scenes, raw?.shots, raw?.concept?.scenes]) if (Array.isArray(c)) return c;
  return null;
};

export const checkScenes = (scenes, { hook = 6, scene = 25, total = 75 } = {}) => {
  const errors = [];
  const warnings = [];
  let sum = 0;
  scenes.forEach((s, i) => {
    const label = `scene ${i + 1}${s?.type ? ` (${s.type})` : ""}`;
    const n = countWords(s?.say);
    sum += n;
    if (n > scene) errors.push(`${label}: say ${n} kata > ${scene}`);
    if (/\d/.test(String(s?.say ?? ""))) warnings.push(`${label}: say berisi angka berdigit — tulis dengan kata (hitungan lisan lebih panjang)`);
    if (s?.type === "hook") {
      const h = countWords(s.text);
      if (h > hook) errors.push(`${label}: teks hook ${h} kata > ${hook}`);
    }
  });
  if (sum > total) errors.push(`total say ${sum} kata > ${total}`);
  return { total: sum, errors, warnings };
};

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--total");
  const ti = args.indexOf("--total");
  const total = ti >= 0 ? Number(args[ti + 1]) : 75;
  if (!file || !Number.isInteger(total) || total <= 0) {
    console.error("Pakai: node promo/cek-kata.mjs <file.json|-> [--total N]");
    process.exit(2);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8"));
  } catch (e) {
    console.error(`JSON tidak terbaca: ${e.message}`);
    process.exit(2);
  }
  const scenes = findScenes(raw);
  if (!scenes) {
    console.error("Tidak ada scenes/shots di file.");
    process.exit(2);
  }
  const r = checkScenes(scenes, { total });
  for (const w of r.warnings) console.log(`⚠️  ${w}`);
  for (const e of r.errors) console.log(`❌ ${e}`);
  console.log(r.errors.length ? `GAGAL — total ${r.total}/${total} kata. Revisi dulu.` : `✓ lolos — total ${r.total}/${total} kata.`);
  process.exit(r.errors.length ? 1 : 0);
}
