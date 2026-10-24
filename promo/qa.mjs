// Gerbang mutu video: tidak ada video cacat yang dikirim ke Bos / diposting.
//   layoutQA  — sebelum render: teks keluar bingkai, teks saling tumpuk, gambar rusak (sampel beberapa waktu per scene)
//   videoQA   — setelah render: resolusi, durasi, audio, loudness, layar hitam, video beku, hening di tengah
// Temuan "berat" membatalkan video (make.mjs berhenti, tidak ada yang terkirim). "peringatan" hanya dicatat.
// PROMO_QA_WARN=1 menurunkan semua temuan berat jadi peringatan (darurat saja).
import { spawnSync } from "node:child_process";

const W = 1080, H = 1920;
const pct = (n) => Math.round(n * 100);

export async function layoutQA(page, plan) {
  const issues = [];
  const times = [];
  plan.scenes.forEach((s, idx) => {
    for (const k of [0.35, 0.65, 0.92]) times.push([s, Math.min(plan.total - 0.05, s.start + s.dur * k), idx]);
  });
  for (const [scene, t, idx] of times) {
    await page.evaluate((x) => window.renderAt(x), t);
    const found = await page.evaluate(({ W, H, idx }) => {
      const out = [], boxes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const text = n.textContent.trim();
        if (!text || !n.parentElement) continue;
        const own = n.parentElement.closest("#scenes > .scene");
        if (own && [...own.parentElement.children].indexOf(own) !== idx) continue; // scene lain (sedang transisi/tersembunyi)
        let el = n.parentElement, vis = true;
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.6) { vis = false; break; }
        }
        if (!vis) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const b = r.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        boxes.push({ text: text.slice(0, 40), x: b.left, y: b.top, r: b.right, b: b.bottom, el });
      }
      for (const b of boxes) {
        const out_x = Math.max(0, -b.x) + Math.max(0, b.r - W), out_y = Math.max(0, -b.y) + Math.max(0, b.b - H);
        if (out_x > 6 || out_y > 6) out.push({ kind: "keluar-bingkai", text: b.text, detail: `${Math.round(out_x)}px x, ${Math.round(out_y)}px y` });
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], c = boxes[j];
        if (a.el === c.el || a.el.contains(c.el) || c.el.contains(a.el)) continue;
        const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x), oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
        if (ox <= 0 || oy <= 0) continue;
        const small = Math.min((a.r - a.x) * (a.b - a.y), (c.r - c.x) * (c.b - c.y));
        if ((ox * oy) / small > 0.3) out.push({ kind: "teks-bertumpuk", text: `${a.text} ⇄ ${c.text}`, detail: `${Math.round(((ox * oy) / small) * 100)}%` });
      }
      for (const img of document.images) {
        // Sama seperti teks: abaikan gambar milik scene lain (rekaman scene yang
        // belum tampil belum dimuat → dulu jadi positif palsu "gambar rusak").
        const own = img.closest("#scenes > .scene");
        if (own && [...own.parentElement.children].indexOf(own) !== idx) continue;
        let vis = true;
        for (let e = img; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.6) { vis = false; break; }
        }
        if (!vis) continue;
        const b = img.getBoundingClientRect();
        if (b.width > 8 && b.height > 8 && (!img.complete || img.naturalWidth === 0)) out.push({ kind: "gambar-rusak", text: (img.getAttribute("src") || "").slice(0, 50), detail: "" });
      }
      return out;
    }, { W, H, idx });
    for (const f of found) issues.push({ level: "berat", ...f, scene: scene.type || scene.shot || "?", t: +t.toFixed(2) });
  }
  // Satu masalah yang sama di banyak sampel cukup dilaporkan sekali.
  const seen = new Set();
  return issues.filter((i) => { const k = `${i.kind}|${i.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const ff = (bin, args) => spawnSync(bin, ["-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

export function videoQA(bin, video, plan) {
  const issues = [];
  const add = (level, kind, detail) => issues.push({ level, kind, detail });
  const probe = ff(bin, ["-i", video]).stderr || "";
  const size = probe.match(/Video:.*?(\d{3,4})x(\d{3,4})/);
  if (!size || +size[1] !== W || +size[2] !== H) add("berat", "resolusi", `harus ${W}x${H}, dapat ${size ? `${size[1]}x${size[2]}` : "tidak terbaca"}`);
  if (!/Audio:/.test(probe)) add("berat", "tanpa-audio", "trek audio tidak ada");
  const dur = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0;
  if (Math.abs(secs - plan.total) > 0.5) add("berat", "durasi", `rencana ${plan.total.toFixed(1)} dtk, hasil ${secs.toFixed(1)} dtk`);
  if (secs > 60) add("berat", "durasi", `${secs.toFixed(0)} dtk — melebihi batas Shorts/Reels 60 dtk`);

  const r = ff(bin, ["-i", video, "-vf", "blackdetect=d=0.4:pic_th=0.98,freezedetect=n=0.003:d=2.5", "-af", "ebur128=peak=true,silencedetect=n=-45dB:d=1.5", "-f", "null", "-"]).stderr || "";
  const black = [...r.matchAll(/black_start:([\d.]+).*?black_duration:([\d.]+)/g)];
  for (const b of black) add("berat", "layar-hitam", `${(+b[1]).toFixed(1)} dtk selama ${(+b[2]).toFixed(1)} dtk`);
  const freeze = [...r.matchAll(/freeze_duration: ([\d.]+)/g)];
  for (const f of freeze) add(+f[1] > 4.5 ? "berat" : "peringatan", "video-beku", `diam ${(+f[1]).toFixed(1)} dtk`);
  const lufs = [...r.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  if (lufs) { const v = +lufs[1]; if (v < -19 || v > -10) add("berat", "loudness", `${v} LUFS (target ≈ -14)`); }
  else add("peringatan", "loudness", "tidak terukur");
  const peak = [...r.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop();
  if (peak && +peak[1] > -0.5) add("berat", "audio-clipping", `puncak ${peak[1]} dBFS`);
  const sil = [...r.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_duration: ([\d.]+)/g)];
  for (const s of sil) add(+s[2] > 3 ? "berat" : "peringatan", "hening", `${(+s[1]).toFixed(1)} dtk selama ${(+s[2]).toFixed(1)} dtk`);
  return issues;
}

export function verdict(issues) {
  const soft = process.env.PROMO_QA_WARN === "1";
  const heavy = issues.filter((i) => i.level === "berat" && !soft);
  return { ok: heavy.length === 0, heavy, warnings: issues.filter((i) => !heavy.includes(i)) };
}

export const describe = (i) => `${i.level === "berat" ? "✖" : "⚠"} ${i.kind}${i.text ? ` “${i.text}”` : ""}${i.detail ? ` (${i.detail})` : ""}${i.t != null ? ` @${i.t}s` : ""}`;
