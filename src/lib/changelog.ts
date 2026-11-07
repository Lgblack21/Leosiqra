import { readFileSync } from 'node:fs';
import path from 'node:path';

// Riwayat versi untuk halaman Riwayat versi (web & app HP). Dibaca dari CHANGELOG.md saat build
// (static export), jadi catatan rilis cukup ditulis sekali di file itu.

export type ChangelogEntry = {
  version: string;
  major: number;
  date: string; // YYYY-MM-DD
  title: string;
  intro: string[]; // paragraf sebelum daftar poin
  items: string[]; // satu poin per elemen (baris lanjutan sudah digabung)
};

const HEADING = /^## (\d+)\.(\d+)\.(\d+) — (\d{4}-\d{2}-\d{2})(?: — (.+))?$/;

export function parseChangelog(md: string): ChangelogEntry[] {
  const start = md.indexOf('<!-- rilis-baru -->');
  const lines = (start >= 0 ? md.slice(start) : md).split('\n');
  const out: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  for (const line of lines) {
    const h = HEADING.exec(line.trim());
    if (h) {
      cur = {
        version: `${h[1]}.${h[2]}.${h[3]}`,
        major: Number(h[1]),
        date: h[4],
        title: h[5]?.trim() || `Versi ${h[1]}.${h[2]}.${h[3]}`,
        intro: [],
        items: [],
      };
      out.push(cur);
      continue;
    }
    if (!cur || !line.trim() || line.startsWith('<!--')) continue;
    if (/^- /.test(line)) cur.items.push(line.slice(2).trim());
    else if (/^\s{2,}\S/.test(line) && cur.items.length) cur.items[cur.items.length - 1] += ` ${line.trim()}`;
    else cur.intro.push(line.trim());
  }
  return out;
}

export function readChangelog(): ChangelogEntry[] {
  try {
    return parseChangelog(readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8'));
  } catch {
    return [];
  }
}
