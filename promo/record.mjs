// Rekam aplikasi Leosiqra ASLI (UI mobile /app) dari akun demo untuk scene
// "device" — dipakai stage.html sebagai layar di mockup HP 3D, bukan ilustrasi.
//
//   node record.mjs <plan.json> <out_dir>
// Env: DEMO_EMAIL + DEMO_PASSWORD (atau promo/.demo.env), DEMO_APP_URL
//      (default https://www.leosiqra.com; workers.dev otomatis kalau ditantang).
// Menulis <out_dir>/clips/<i>.webm + <out_dir>/clips.json {"<i>": {file, start}}.
// Scene yang gagal direkam dilewati — make.mjs memakai ilustrasi sebagai cadangan.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

// Rekaman video Playwright selalu 1x (deviceScaleFactor diabaikan), jadi
// halaman dirender di viewport 2x lalu di-zoom CSS 2x: tata letak tetap HP
// 390x844, tapi piksel rekamannya 780x1688 — tajam di mockup ±600px.
const W = 390;
const H = 844;
const SCALE = 2;

// Shot yang bisa direkam → apa yang dilakukan "jari" di layar. Hanya fitur yang
// ada di content.mjs FEATURES. Scan struk & suara butuh kamera/mikrofon asli,
// jadi tetap ilustrasi (scene "phone").
export const SHOTS = {
  quick: { feature: "quick", path: "/input-cepat" },
  home: { feature: "stats", path: "/app" },
  stats: { feature: "stats", path: "/app/statistics" },
  budget: { feature: "budget", path: "/app/budget" },
  savings: { feature: "savings", path: "/app/savings" },
  ai: { feature: "ai", path: "/app/assistant/chat" },
  transactions: { feature: "quick", path: "/app/transactions" },
  wallet: { feature: "stats", path: "/app/wallet" },
  recurring: { feature: "recurring", path: "/app/recurring" },
};

// Placeholder aplikasi ada yang menyebut merek bank — jangan sampai tampil di
// video (aturan: tanpa merek lain). Diganti hanya di browser perekam.
const BRANDS = /\b(bca|bri|bni|mandiri|gopay|ovo|dana|shopee\w*|jago|seabank|blu)\b/i;

const INIT = `
(() => {
  try {
    localStorage.setItem("leosiqra_app_tour_done", "1");
    for (const v of ["leosiqra", "input-cepat"]) localStorage.setItem("leosiqra:install-ad-dismissed:" + v, String(Date.now()));
  } catch {}
  const css = document.createElement("style");
  css.textContent = "html{zoom:${SCALE}} ::-webkit-scrollbar{display:none} *{scrollbar-width:none} .__tap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(99,102,241,.9);pointer-events:none;animation:__tap .55s ease-out forwards}@keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}";
  const add = () => document.head && document.head.appendChild(css);
  add() || document.addEventListener("DOMContentLoaded", add);
  // Lingkaran sentuhan supaya penonton lihat apa yang ditekan.
  addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.className = "__tap"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }, true);
  const fix = () => document.querySelectorAll("input[placeholder],textarea[placeholder]").forEach((el) => {
    if (${BRANDS}.test(el.placeholder)) el.placeholder = "Ketik: kopi susu 25rb";
  });
  new MutationObserver(fix).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["placeholder"] });
})();
`;

const readDemoEnv = () => {
  const file = join(import.meta.dirname, ".demo.env");
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
};

const pause = (page, ms) => page.waitForTimeout(ms);

// Scroll halus (bukan lompat) — beberapa wheel kecil berjeda.
const glide = async (page, dy, ms = 1800) => {
  await page.mouse.move((W * SCALE) / 2, H * SCALE * 0.6);
  const steps = Math.max(8, Math.round(ms / 45));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, (dy * SCALE) / steps);
    await pause(page, ms / steps);
  }
};

const tapText = async (page, text, opts = {}) => {
  const el = page.getByText(text, { exact: opts.exact ?? true }).first();
  await el.waitFor({ state: "visible", timeout: 8000 });
  await el.click();
};

const ACTIONS = {
  async quick(page, ctx) {
    const box = page.getByLabel("Ketik pintar");
    await box.waitFor({ timeout: 15000 });
    await pause(page, 900);
    await box.click();
    await box.pressSequentially("kopi susu 25rb", { delay: 120 });
    await pause(page, 500);
    await page.getByLabel("Isi form").click();
    await pause(page, 1300);
    const saved = page.waitForResponse((r) => r.url().includes("/api/member/quick-transaction") && r.request().method() === "POST", { timeout: 10000 });
    await page.getByRole("button", { name: /Simpan Pengeluaran/ }).click();
    const res = await saved;
    await pause(page, 2000);
    // Bersihkan: transaksi rekaman dihapus lagi (saldo dikembalikan) supaya
    // data demo tidak menumpuk "kopi susu" tiap hari.
    const id = (await res.json().catch(() => ({}))).id;
    if (id) ctx.cleanup.push(`/api/member/transactions/${id}?reverse=1`);
  },
  async home(page) {
    await pause(page, 1600);
    await glide(page, 520, 2400);
    await pause(page, 900);
  },
  async stats(page) {
    await pause(page, 1500);
    await tapText(page, "Pemasukan");
    await pause(page, 1500);
    await tapText(page, "Pengeluaran");
    await pause(page, 1200);
    await glide(page, 300, 1500);
  },
  async budget(page) {
    await pause(page, 1600);
    await glide(page, 380, 2200);
    await pause(page, 800);
  },
  async savings(page) {
    await pause(page, 1600);
    await glide(page, 300, 2000);
    await pause(page, 800);
  },
  async ai(page) {
    await pause(page, 1000);
    await tapText(page, "Aku boros di mana?", { exact: false });
    // Tunggu jawaban AI mengalir (pakai data akun demo).
    await pause(page, 9000);
    await glide(page, 400, 1800);
    await pause(page, 1200);
  },
  async transactions(page) {
    await pause(page, 1300);
    await tapText(page, "Keluar");
    await pause(page, 1300);
    await tapText(page, "Semua");
    await pause(page, 600);
    await glide(page, 450, 2000);
  },
  async wallet(page) {
    await pause(page, 1500);
    await glide(page, 250, 1500);
    await pause(page, 1000);
  },
  async recurring(page) {
    await pause(page, 1500);
    await glide(page, 420, 2200);
    await pause(page, 800);
  },
};

const login = async (base, email, password) => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const res = await ctx.request.post(`${base}/api/auth/login`, { data: { email, password }, headers: { origin: base } });
  if (!res.ok()) {
    await browser.close();
    throw new Error(`login demo ${res.status()}`);
  }
  const state = await ctx.storageState();
  await browser.close();
  return state;
};

const pickBase = async () => {
  const bases = [...new Set([process.env.DEMO_APP_URL || "https://www.leosiqra.com", "https://membersite-leosiqra.leowendry.workers.dev"])];
  for (const base of bases) {
    const r = await fetch(`${base}/health`).catch(() => null);
    if (r && r.ok && (r.headers.get("content-type") || "").includes("json")) return base;
  }
  return bases[0];
};

export const recordClips = async (planPath, out, log = console.log) => {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const jobs = plan.scenes.map((s, i) => [i, s]).filter(([, s]) => s.type === "device" && ACTIONS[s.shot]);
  const result = {};
  if (!jobs.length) return result;
  const env = readDemoEnv();
  const email = process.env.DEMO_EMAIL || env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD || env.DEMO_PASSWORD;
  if (!email || !password) {
    log("DEMO_EMAIL/DEMO_PASSWORD tidak ada — scene device pakai ilustrasi.");
    return result;
  }
  const base = await pickBase();
  const state = await login(base, email, password);
  const dir = join(out, "clips");
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  for (const [i, scene] of jobs) {
    const ctx = await browser.newContext({
      storageState: state,
      viewport: { width: W * SCALE, height: H * SCALE },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
      ignoreHTTPSErrors: true,
      recordVideo: { dir, size: { width: W * SCALE, height: H * SCALE } },
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const t0 = Date.now();
    const job = { cleanup: [] };
    try {
      await page.goto(`${base}${SHOTS[scene.shot].path}`, { waitUntil: "networkidle", timeout: 30000 });
      if (/\/auth\/login|\/onboarding/.test(page.url())) throw new Error(`diarahkan ke ${page.url()}`);
      // Klip mulai setelah splash "Memuat Leosiqra" hilang.
      await page.getByLabel("Memuat Leosiqra").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
      await pause(page, 250);
      const start = (Date.now() - t0) / 1000;
      await ACTIONS[scene.shot](page, job);
      const video = page.video();
      await ctx.close();
      const file = `${i}.webm`;
      renameSync(await video.path(), join(dir, file));
      result[i] = { file: `clips/${file}`, start: Math.max(0, start - 0.1) };
      log(`rekam scene ${i} (${scene.shot}) ✓`);
    } catch (error) {
      log(`rekam scene ${i} (${scene.shot}) gagal: ${error.message.split("\n")[0]}`);
      await ctx.close().catch(() => {});
    }
    for (const path of job.cleanup) {
      const r = await fetch(`${base}${path}`, { method: "DELETE", headers: { cookie: state.cookies.map((c) => `${c.name}=${c.value}`).join("; "), origin: base } }).catch(() => null);
      if (!r || !r.ok) log(`bersih-bersih ${path} gagal (${r?.status})`);
    }
  }
  await browser.close();
  writeFileSync(join(out, "clips.json"), JSON.stringify(result));
  return result;
};

if (process.argv[1] === import.meta.filename) {
  recordClips(process.argv[2], process.argv[3]).then((r) => console.log(JSON.stringify(r)), (e) => {
    console.error(e.message);
    process.exit(1);
  });
}
