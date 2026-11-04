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
// Kalau file punya `hashtags`, ejaannya ikut dicek (kesalahan/hashtag-typo-aturuang:
// "#atururang" lolos review manual 2×): format #huruf-kecil tanpa spasi, tanpa
// dobel, dan hashtag yang BEDA 1–2 huruf dari daftar baku = typo (error).
// Hashtag baru di luar daftar hanya peringatan — baca ulang ejaannya.
// Keluar 1 kalau ada yang lewat batas (revisi dulu, jangan simpan draft).
import { readFileSync } from "node:fs";
import { FALLBACK_SCRIPTS } from "./content.mjs";

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

// Daftar baku: hashtag naskah cadangan content.mjs + yang sudah dipakai ≥ 2 video
// terkirim (Tower konten/*, per 2026-11-04). Tambah di sini kalau hashtag baru
// sudah jadi langganan, supaya typo-nya ikut tertangkap.
export const HASHTAG_BAKU = [...new Set([
  ...FALLBACK_SCRIPTS.flatMap((s) => s.hashtags ?? []),
  "#leosiqra", "#aturuang", "#keuanganpribadi", "#tipshemat", "#literasikeuangan", "#tipskeuangan",
  "#nabung", "#catatankeuangan", "#catatkeuangan", "#aplikasikeuangan", "#cicilan", "#budgeting",
  "#kuiskeuangan", "#gajian", "#anakmuda", "#anakkos", "#tanggaltua", "#mitosfakta", "#levelup",
  "#challenge", "#tabungan", "#investasi", "#shorts",
].map((h) => h.toLowerCase()))];

export const editDistance = (a, b) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

export const checkHashtags = (tags, baku = HASHTAG_BAKU) => {
  const errors = [];
  const warnings = [];
  const seen = new Set();
  for (const raw of tags) {
    const h = String(raw ?? "").trim();
    if (!/^#[a-z0-9_]+$/.test(h)) {
      errors.push(`hashtag "${h}": harus # + huruf kecil/angka tanpa spasi`);
      continue;
    }
    if (seen.has(h)) errors.push(`hashtag ${h} dobel`);
    seen.add(h);
    if (baku.includes(h)) continue;
    // Beda 1 huruf dari hashtag baku, atau 2 huruf pada hashtag panjang (≥ 8) yang
    // panjangnya hampir sama = hampir pasti salah ketik. Tambahan di depan/belakang
    // (#keuanganku) & sisipan kata (#mitosvsfakta) bukan typo. Diuji ke semua
    // hashtag video terkirim: #jajan/#gajian & #mitosvsfakta tidak tertangkap.
    const mirip = baku.find((b) => {
      if (h.startsWith(b) || b.startsWith(h)) return false;
      const d = editDistance(h, b);
      return d === 1 || (d === 2 && h.length >= 9 && Math.abs(h.length - b.length) <= 1);
    });
    if (mirip) errors.push(`hashtag ${h} mirip ${mirip} — salah ketik?`);
    else warnings.push(`hashtag ${h} di luar daftar baku — baca ulang ejaannya`);
  }
  if (tags.length < 5 || tags.length > 8) warnings.push(`jumlah hashtag ${tags.length} (ROUTINE: 5–8)`);
  return { errors, warnings };
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
  const tags = Array.isArray(raw?.hashtags) ? raw.hashtags : Array.isArray(raw?.script?.hashtags) ? raw.script.hashtags : null;
  if (tags) {
    const t = checkHashtags(tags);
    r.errors.push(...t.errors);
    r.warnings.push(...t.warnings);
  }
  for (const w of r.warnings) console.log(`⚠️  ${w}`);
  for (const e of r.errors) console.log(`❌ ${e}`);
  console.log(r.errors.length ? `GAGAL — total ${r.total}/${total} kata. Revisi dulu.` : `✓ lolos — total ${r.total}/${total} kata.`);
  process.exit(r.errors.length ? 1 : 0);
}
