#!/usr/bin/env node
// Naikkan versi Leosiqra: package.json + package-lock.json + kerangka catatan di CHANGELOG.md.
//
//   npm run versi -- patch "Perbaikan saldo transfer valas"
//   npm run versi -- minor "Fitur Cerita Hari Ini"
//   npm run versi -- major "Tampilan baru seluruh aplikasi"
//
// Aturan memilih jenis ada di bagian atas CHANGELOG.md. Script ini TIDAK commit, tag,
// atau deploy — tag vX.Y.Z dibuat workflow "Deploy main" setelah versi itu live.
import { readFileSync, writeFileSync } from 'node:fs';

const [jenis, ...ringkasan] = process.argv.slice(2);
if (!['patch', 'minor', 'major'].includes(jenis)) {
  console.error('Pakai: npm run versi -- patch|minor|major "ringkasan singkat"');
  process.exit(1);
}

const pkgPath = new URL('../package.json', import.meta.url);
const lockPath = new URL('../package-lock.json', import.meta.url);
const logPath = new URL('../CHANGELOG.md', import.meta.url);

const pkgText = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgText);
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!m) {
  console.error(`Versi sekarang tidak berformat X.Y.Z: ${pkg.version}`);
  process.exit(1);
}
let [maj, min, pat] = m.slice(1).map(Number);
if (jenis === 'major') [maj, min, pat] = [maj + 1, 0, 0];
else if (jenis === 'minor') [min, pat] = [min + 1, 0];
else pat += 1;
const baru = `${maj}.${min}.${pat}`;

// Ganti hanya baris "version" teratas supaya format file lain tidak berubah.
writeFileSync(pkgPath, pkgText.replace(`"version": "${pkg.version}"`, `"version": "${baru}"`));
const lock = readFileSync(lockPath, 'utf8');
const lockNew = lock
  .replace(new RegExp(`^(  "version": )"${pkg.version}"`, 'm'), `$1"${baru}"`)
  .replace(new RegExp(`^(      "version": )"${pkg.version}"`, 'm'), `$1"${baru}"`);
writeFileSync(lockPath, lockNew);

const tanggal = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const log = readFileSync(logPath, 'utf8');
const anchor = '<!-- rilis-baru -->';
if (!log.includes(anchor)) {
  console.error(`CHANGELOG.md tidak punya penanda ${anchor}`);
  process.exit(1);
}
const judul = ringkasan.join(' ').trim();
const entri = `${anchor}\n\n## ${baru} — ${tanggal}${judul ? ` — ${judul}` : ''}\n\n- (tulis perubahan yang terasa user di sini)\n`;
writeFileSync(logPath, log.replace(anchor, entri));

console.log(`Versi ${pkg.version} → ${baru}. Lengkapi catatan ${baru} di CHANGELOG.md, lalu commit.`);
