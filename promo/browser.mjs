// Peluncur Chromium yang tahan versi: kalau Playwright minta build yang belum
// terpasang (mis. headless_shell-1243 padahal yang ada 1194), pakai build lain
// yang ada di cache ms-playwright. Dulu tiap sesi routine harus symlink manual.
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  ["chromium_headless_shell-", "chrome-headless-shell-linux64/chrome-headless-shell"],
  ["chromium_headless_shell-", "chrome-linux/headless_shell"],
  ["chromium-", "chrome-linux64/chrome"],
  ["chromium-", "chrome-linux/chrome"],
];

const installed = () => {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache/ms-playwright"), "/root/.cache/ms-playwright"].filter(Boolean);
  const out = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).sort().reverse();   // versi terbaru dulu
    for (const [prefix, rel] of CANDIDATES) for (const d of dirs) if (d.startsWith(prefix)) { const p = join(root, d, rel); if (existsSync(p)) out.push(p); }
  }
  return out;
};

export const launchChromium = async (opts = {}) => {
  try {
    return await chromium.launch(opts);
  } catch (error) {
    if (!/Executable doesn't exist|browserType\.launch/i.test(String(error.message))) throw error;
    for (const executablePath of installed()) {
      try {
        const b = await chromium.launch({ ...opts, executablePath });
        console.warn(`Chromium bawaan Playwright tidak ada — pakai ${executablePath}`);
        return b;
      } catch { /* coba kandidat berikutnya */ }
    }
    throw error;
  }
};
