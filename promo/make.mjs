// Bikin 1 video promo harian (1080x1920, untuk Reels & Shorts) lalu kirim ke Telegram.
//
//   node make.mjs            → render + kirim ke Telegram (kalau token ada)
//   node make.mjs --no-send  → render saja (hasil di promo/out/)
//
// Env: PROMO_SECRET (+ PROMO_API_URL) → naskah AI & kiriman Telegram lewat
//      Worker Leosiqra; atau langsung: OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN +
//      TELEGRAM_CHAT_ID. Tanpa AI → naskah cadangan. PROMO_SEED (opsional),
//      FFMPEG_PATH (default "ffmpeg"), PYTHON (default "python3").
//      OPENAI_API_KEY → suara manusia (tanpa ini: edge-tts). DEMO_EMAIL +
//      DEMO_PASSWORD → rekaman aplikasi asli untuk scene "device" (tanpa ini:
//      ilustrasi).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildPlan, SHOT_TO_SCREEN } from "./plan.mjs";
import { promoFetch } from "./api.mjs";
import { renderMusic } from "./music.mjs";
import { synthesizeVoice } from "./voice.mjs";
import { recordClips } from "./record.mjs";
import { buildLessons, fetchPlaybook } from "./lessons.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "out");
const STATE = join(DIR, "state");
const HISTORY = join(STATE, "history.json");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FPS = 30;
const SEND = !process.argv.includes("--no-send");

// Durasi minimum tiap tipe scene (detik) — animasinya butuh waktu segini.
const MIN_DUR = { hook: 2, number: 3, list: 3.4, mythfact: 3.6, quiz: 4.2, phone: 3.4, device: 4.2, cta: 3.4 };
const CLIP_MAX_RATE = 1.7; // rekaman boleh dipercepat sampai segini
const LEAD = 0.25; // voice mulai sedikit setelah scene masuk

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… gagal:\n${(r.stderr || "").slice(-1500)}`);
  return r;
};

const audioDuration = (file) => {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || "");
  if (!m) throw new Error(`durasi ${file} tidak terbaca`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};

// Riwayat disimpan di Worker (R2) kalau PROMO_SECRET ada — mesin pembuat video
// (GitHub Actions / Claude Code routine) selalu mulai bersih tiap hari.
const loadHistory = async () => {
  if (process.env.PROMO_SECRET) {
    const res = await promoFetch("/api/promo/history");
    if (res.ok) return (await res.json()).items ?? [];
    log(`riwayat dari Worker gagal (${res.status}), pakai lokal`);
  }
  try {
    return JSON.parse(readFileSync(HISTORY, "utf8"));
  } catch {
    return [];
  }
};

const saveHistory = async (items) => {
  const trimmed = items.slice(-365);
  writeFileSync(HISTORY, JSON.stringify(trimmed, null, 2));
  if (process.env.PROMO_SECRET) {
    const res = await promoFetch("/api/promo/history", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: trimmed }),
    });
    if (!res.ok) log(`simpan riwayat ke Worker gagal (${res.status})`);
  }
};

const fontsHref = (font) => {
  const fam = [...new Set([font.head, font.body])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;700;800;900`);
  // Archivo Black & DM Serif Display cuma punya 1 bobot.
  const fixed = fam.map((f) => (/Archivo\+Black|DM\+Serif\+Display/.test(f) ? f.replace(/:wght@[\d;]+/, "") : f));
  return `https://fonts.googleapis.com/css2?${fixed.join("&")}&family=Noto+Color+Emoji&display=block`;
};

// Kirim ke Telegram: lewat Worker Leosiqra (PROMO_SECRET — token bot tetap di
// Cloudflare) atau langsung ke Bot API (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
const telegramTarget = () => {
  if (process.env.PROMO_SECRET) {
    return { kind: "worker" };
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) return { kind: "direct" };
  return null;
};

const appendField = (form, key, value) => {
  if (value instanceof Blob) form.append(key, value, key === "video" ? "leosiqra-promo.mp4" : "cover.jpg");
  else form.append(key, value);
};

const postTelegram = async ({ text, video }) => {
  const target = telegramTarget();
  if (!target) {
    log("Tujuan Telegram tidak dikonfigurasi — lewati pengiriman.");
    return;
  }
  if (target.kind === "worker") {
    const form = new FormData();
    form.append("text", text);
    if (video) for (const [k, v] of Object.entries(video)) appendField(form, k, v);
    const res = await promoFetch("/api/promo/telegram", { method: "POST", body: form });
    if (!res.ok) throw new Error(`Worker promo/telegram ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json().catch(() => ({}))).messageId;
  }
  const api = (m) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (video) {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("supports_streaming", "true");
    for (const [k, v] of Object.entries(video)) appendField(form, k, v);
    const res = await fetch(api("sendVideo"), { method: "POST", body: form });
    if (!res.ok) throw new Error(`Telegram sendVideo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 300)}`);
};

const escHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const sendTelegram = async (plan, videoPath, coverPath, id) => {
  const hook = plan.scenes[0]?.text || plan.topic;
  const fullCaption = `${plan.caption}\n\n${plan.hashtags.join(" ")}`;
  const text = `📋 <b>Caption</b> (tap untuk copy — sama untuk Reels &amp; Shorts):\n<pre>${escHtml(fullCaption)}</pre>\n\n📝 <b>Judul Shorts</b>:\n<pre>${escHtml(`${hook} #shorts`.slice(0, 95))}</pre>`;
  const messageId = await postTelegram({
    text,
    video: {
      id,
      video: new Blob([readFileSync(videoPath)], { type: "video/mp4" }),
      thumbnail: new Blob([readFileSync(coverPath)], { type: "image/jpeg" }),
      caption: `🎬 Video promo hari ini\n“${hook}”\n\nFormat: ${plan.formatLabel} · Topik: ${plan.topic}\n\nNilai pakai tombol di bawah, atau balas video ini dengan catatan — tim konten belajar dari situ besok.`,
      width: "1080",
      height: "1920",
      duration: String(Math.round(plan.total)),
    },
  });
  log("Terkirim ke Telegram.");
  return messageId;
};

// Rekaman → frame JPG (30 fps, lebar 600) untuk layar HP di stage.html.
// Scene device yang tidak punya rekaman diganti ilustrasi fitur yang sama.
const prepareClips = async (plan) => {
  if (!plan.scenes.some((s) => s.type === "device")) return;
  let clips = {};
  try {
    clips = await recordClips(join(OUT, "plan.json"), OUT, log);
  } catch (error) {
    log(`rekaman aplikasi gagal (${error.message.split("\n")[0]}) — pakai ilustrasi`);
  }
  plan.scenes.forEach((sc, i) => {
    if (sc.type !== "device") return;
    const c = clips[i];
    if (c) {
      const dir = join(OUT, "frames", String(i));
      mkdirSync(dir, { recursive: true });
      run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(c.start), "-i", join(OUT, c.file), "-vf", `fps=${FPS},scale=600:-2`, "-q:v", "3", join(dir, "%04d.jpg")]);
      const count = readdirSync(dir).filter((f) => f.endsWith(".jpg")).length;
      if (count > FPS) {
        sc.clip = { dir: `out/frames/${i}/`, count, fps: FPS, rate: 1 };
        return;
      }
    }
    log(`scene ${i} (${sc.shot}) tanpa rekaman → ilustrasi`);
    Object.assign(sc, { type: "phone", screen: SHOT_TO_SCREEN[sc.shot] || "quick", say: sc.say });
  });
};

const main = async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(STATE, { recursive: true });

  const history = await loadHistory();
  const seed = Number(process.env.PROMO_SEED) || Math.floor(Math.random() * 2 ** 31);
  log(`seed ${seed}, riwayat ${history.length} video`);
  const lessons = buildLessons(history, await fetchPlaybook().catch(() => null));
  const plan = await buildPlan({ seed, history, lessons });
  const { FORMATS } = await import("./content.mjs");
  plan.formatLabel = FORMATS[plan.format]?.label ?? plan.format;
  log(`format ${plan.format} · topik "${plan.topic}" · naskah ${plan.source} · gaya ${plan.style.palette.name}/${plan.style.background}/${plan.style.transition}/${plan.style.font.head}`);
  writeFileSync(join(OUT, "plan.json"), JSON.stringify(plan, null, 2));

  // 0) Rekam aplikasi asli untuk scene device (akun demo).
  await prepareClips(plan);
  writeFileSync(join(OUT, "plan.json"), JSON.stringify(plan, null, 2));

  // 1) Voice-over per scene + waktu tiap kata (OpenAI, cadangan edge-tts).
  const voiceName = await synthesizeVoice(join(OUT, "plan.json"), OUT, log);
  log(`suara ${voiceName}`);
  const voice = JSON.parse(readFileSync(join(OUT, "voice.json"), "utf8"));

  // 2) Timeline: durasi scene mengikuti panjang narasinya.
  let t = 0;
  const words = [];
  const voiceClips = [];
  plan.scenes.forEach((sc, i) => {
    const v = voice[i];
    const vDur = v.file ? audioDuration(join(OUT, v.file)) : 0;
    const lead = i === 0 ? 0.4 : LEAD;
    sc.start = +t.toFixed(3);
    sc.dur = +Math.max(MIN_DUR[sc.type] ?? 3, lead + vDur + 0.45).toFixed(3);
    if (sc.type === "cta") sc.dur += 1.2; // tahan endcard sedikit lebih lama
    if (sc.clip) {
      // Beri waktu rekaman tampil (maks 7,5 dtk), percepat sisanya.
      const clipLen = sc.clip.count / sc.clip.fps;
      sc.dur = +Math.max(sc.dur, Math.min(clipLen / 1.4 + 0.4, 7.5)).toFixed(3);
      sc.clip.rate = +Math.min(CLIP_MAX_RATE, Math.max(1, clipLen / (sc.dur - 0.3))).toFixed(3);
    }
    if (v.file) {
      voiceClips.push({ file: join(OUT, v.file), at: sc.start + lead });
      for (const [ws, we, text] of v.words) words.push({ start: +(sc.start + lead + ws).toFixed(3), end: +(sc.start + lead + we).toFixed(3), text });
    }
    t += sc.dur;
  });
  plan.total = +t.toFixed(3);
  plan.words = words;
  log(`durasi ${plan.total.toFixed(1)} dtk, ${plan.scenes.length} scene`);

  // 3) Musik + mixing (musik diredam otomatis saat ada suara, lalu loudness ±-14 LUFS).
  const musicPath = join(OUT, "music.wav");
  renderMusic({
    duration: plan.total,
    music: plan.style.music,
    transitions: plan.scenes.slice(1).map((s) => s.start),
    ctaAt: plan.scenes.at(-1).start,
    outPath: musicPath,
  });
  const audioPath = join(OUT, "audio.wav");
  const inputs = ["-i", musicPath, ...voiceClips.flatMap((c) => ["-i", c.file])];
  const delays = voiceClips.map((c, i) => `[${i + 1}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)}[v${i}]`);
  const filter = [
    ...delays,
    // apad: narasi diperpanjang dengan hening sampai akhir video — tanpa ini
    // sidechaincompress berhenti saat kata terakhir diucapkan dan ekor video
    // (endcard CTA) ikut terpotong.
    `${voiceClips.map((_, i) => `[v${i}]`).join("")}amix=inputs=${voiceClips.length}:normalize=0:duration=longest,volume=1.6,apad=whole_dur=${plan.total}[voice]`,
    `[voice]asplit=2[vk][vm]`,
    `[0:a]volume=0.32[mus]`,
    `[mus][vk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck]`,
    `[duck][vm]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,apad=whole_dur=${plan.total},atrim=0:${plan.total}[out]`,
  ].join(";");
  run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-ar", "44100", audioPath]);

  // 4) Render frame (Chromium headless) → ffmpeg.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(DIR, "stage.html")).href);
  await page.addStyleTag({ url: fontsHref(plan.style.font) }).catch((e) => log("font gagal dimuat:", e.message));
  await page.evaluate((p) => window.build(p), plan);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))));
  });
  await page.evaluate(() => window.refit());
  await page.waitForTimeout(300);

  const coverPath = join(OUT, "cover.jpg");
  const hookEnd = plan.scenes[0].start + plan.scenes[0].dur - 0.5;
  await page.evaluate((x) => window.renderAt(x), Math.min(1.6, hookEnd));
  await page.screenshot({ path: coverPath, type: "jpeg", quality: 90 });

  const videoPath = join(OUT, "leosiqra-promo.mp4");
  const ff = spawn(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", audioPath,
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-t", plan.total.toFixed(3), "-movflags", "+faststart", videoPath,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  let ffExited = false;
  const ffDone = new Promise((res, rej) =>
    ff.on("close", (code) => {
      ffExited = true;
      if (code === 0) res();
      else rej(new Error(`ffmpeg keluar ${code}`));
    })
  );
  ff.stdin.on("error", () => {}); // EPIPE kalau ffmpeg berhenti duluan — ditangani lewat ffExited

  const frames = Math.ceil(plan.total * FPS);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.renderAt(x), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (ffExited) throw new Error(`ffmpeg berhenti di frame ${f}/${frames}`);
    // Jangan menunggu "drain" selamanya kalau ffmpeg keburu keluar.
    if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), ffDone.catch(() => {})]);
    if (f % 150 === 0) log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await ffDone;
  await browser.close();
  if (!existsSync(videoPath)) throw new Error("video tidak terbentuk");
  log(`render ${frames} frame dalam ${((Date.now() - started) / 1000).toFixed(0)} dtk → ${videoPath}`);

  // 5) Simpan caption + riwayat, lalu kirim.
  writeFileSync(join(OUT, "caption.txt"), `${plan.caption}\n\n${plan.hashtags.join(" ")}\n`);
  if (!SEND) {
    log("--no-send: video tidak dikirim & riwayat tidak diubah.");
    return;
  }
  const id = `${plan.date.slice(0, 10)}-${seed.toString(36)}`;
  const tgMessageId = await sendTelegram(plan, videoPath, coverPath, id);
  history.push({
    id,
    tgMessageId,
    date: plan.date.slice(0, 10),
    format: plan.format,
    topic: plan.topic,
    hook: plan.scenes[0]?.text,
    palette: plan.style.palette.name,
    source: plan.source,
    style: `${plan.style.background}/${plan.style.transition}/${plan.style.font.head}/${plan.style.subtitle}`,
    screens: plan.scenes.filter((s) => s.type === "phone").map((s) => s.screen),
    shots: plan.scenes.filter((s) => s.clip).map((s) => s.shot),
    kind: plan.scenes.some((s) => s.clip) ? "real" : "2d",
    voice: voiceName,
    dur: Math.round(plan.total),
    seed,
  });
  await saveHistory(history);
};

main().catch(async (error) => {
  console.error(error);
  // Kabari kalau gagal, supaya tidak diam-diam tidak ada video.
  if (SEND) {
    await postTelegram({ text: `⚠️ Video promo hari ini gagal dibuat: ${escHtml(String(error.message).slice(0, 300))}` }).catch((e) =>
      console.error("Gagal mengirim pesan error:", e.message)
    );
  }
  process.exit(1);
});
