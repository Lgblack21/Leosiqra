// Antrean merge: item Tower yang sudah di-ACC / patch_siap tapi branch-nya
// belum masuk origin/main. Tombol ACC di Tower hanya mengubah status DB —
// tidak ada yang me-merge — jadi skrip ini yang mengingatkan Bos (lewat
// dokumen dev/antrean-merge + ringkasan Telegram yang memang sudah dikirim).
// Hanya membaca git; tidak pernah merge/push.
//
//   node merge-queue.mjs <folder-json>...   (hasil ArtifactData list dengan out_dir,
//                                             mis. <scratch>/tower/dev <scratch>/tower/seo)
//   → JSON { updatedAt, items[], text } — `text` sudah HTML Telegram (ter-escape).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const REPO_URL = "https://github.com/Lgblack21/Leosiqra";
// disetujui = Bos sudah ACC (paling mendesak); patch_siap = siap ditinjau Bos.
const WAITING = ["disetujui", "patch_siap"];
const BRANCH_RE = /^claude\/[A-Za-z0-9._\/-]{1,100}$/;

const git = (...args) => {
  try {
    return { ok: true, out: execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() };
  } catch (error) {
    return { ok: false, code: error.status, out: String(error.stdout ?? "").trim() };
  }
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMs = (v) => (typeof v === "number" ? v : Date.parse(v ?? "")) || null;

export const checkBranch = (branch, base = "origin/main") => {
  if (!BRANCH_RE.test(branch)) return { state: "branch_tidak_valid" };
  const ref = `origin/${branch}`;
  if (!git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).ok) return { state: "branch_tidak_ada" };
  if (git("merge-base", "--is-ancestor", ref, base).ok) return { state: "sudah_di_main" };
  // Commit yang sama sudah masuk main lewat cherry-pick/branch lain (patch-id sama) → bukan antrean.
  const cherry = git("cherry", base, ref);
  if (cherry.ok && cherry.out && !cherry.out.split("\n").some((l) => l.startsWith("+"))) return { state: "sudah_di_main" };
  const ahead = Number(git("rev-list", "--count", `${base}..${ref}`).out) || 0;
  // merge-tree --write-tree: exit 0 = bersih, 1 = konflik (git ≥ 2.38). Tidak menyentuh working tree.
  const tree = git("merge-tree", "--write-tree", "--name-only", "--no-messages", base, ref);
  const conflicts = tree.ok ? [] : tree.code === 1 ? [...new Set(tree.out.split("\n").slice(1).filter(Boolean))] : null;
  return { state: "belum_merge", ahead, mergeable: tree.ok, conflicts: conflicts ?? undefined, ...(conflicts === null ? { note: "merge-tree gagal (git < 2.38?)" } : {}) };
};

export const buildQueue = (docs, now = Date.now()) => {
  const items = [];
  for (const d of docs) {
    if (!WAITING.includes(d.status) || typeof d.branch !== "string") continue;
    const check = checkBranch(d.branch);
    if (check.state === "branch_tidak_valid") continue;
    const since = toMs(d.decidedAt) ?? toMs(d.createdAt);
    items.push({
      id: d.id,
      title: String(d.title ?? d.judul ?? d.id).slice(0, 140),
      status: d.status,
      branch: d.branch,
      ageDays: since ? Math.max(0, Math.round((now - since) / 86400e3)) : null,
      compare: `${REPO_URL}/compare/main...${d.branch}`,
      ...check,
    });
  }
  const rank = { disetujui: 0, patch_siap: 1 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || (b.ageDays ?? 0) - (a.ageDays ?? 0));
  const open = items.filter((it) => it.state === "belum_merge");
  const lines = open.map((it) => {
    const mark = it.mergeable ? "bersih" : `⚠️ konflik${it.conflicts?.length ? ": " + it.conflicts.slice(0, 3).join(", ") : ""}`;
    const age = it.ageDays === null ? "" : `, ${it.ageDays} hari`;
    return `• <b>${esc(it.status === "disetujui" ? "ACC" : "patch siap")}</b> ${esc(it.title)} (${esc(mark)}${age}) — <a href="${esc(it.compare)}">diff</a>`;
  });
  const stale = items.filter((it) => it.state === "sudah_di_main").map((it) => it.id);
  const missing = items.filter((it) => it.state === "branch_tidak_ada").map((it) => it.id);
  if (stale.length) lines.push(`Sudah di main (status Tower bisa diubah ke diterapkan): ${esc(stale.join(", "))}`);
  if (missing.length) lines.push(`Branch tidak ditemukan di GitHub: ${esc(missing.join(", "))}`);
  const text = open.length
    ? `🔀 <b>Antrean merge (${open.length})</b> — sudah ACC/siap tapi belum di main:\n${lines.join("\n")}`
    : lines.length ? lines.join("\n") : "";
  return { updatedAt: now, open: open.length, items, text, by: "Tim Developer & IT" };
};

export const readDocs = (dirs) =>
  dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
        return { id: basename(f, ".json"), ...(doc.data && typeof doc.data === "object" ? doc.data : doc) };
      })
  );

if (process.argv[1] === import.meta.filename) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("pakai: node merge-queue.mjs <folder-json-tower>... (jalankan dari dalam repo setelah git fetch origin)");
    process.exit(1);
  }
  // Clone routine bisa dangkal (--depth): merge-base/cherry/merge-tree lalu
  // tidak melihat riwayat bersama → branch yang sudah di main tampak
  // "belum merge, konflik" (terjadi 2026-10-28). Lengkapi riwayat dulu.
  if (git("rev-parse", "--is-shallow-repository").out === "true") {
    git("fetch", "--quiet", "--unshallow", "origin");
    if (git("rev-parse", "--is-shallow-repository").out === "true") {
      console.error("repo masih shallow (git fetch --unshallow origin gagal) — hasil antrean tidak bisa dipercaya");
      process.exit(2);
    }
  }
  console.log(JSON.stringify(buildQueue(readDocs(dirs)), null, 2));
}
