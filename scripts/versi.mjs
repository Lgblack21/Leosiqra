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
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const [th, bl, hr] = tanggal.split('-').map(Number);
const log = readFileSync(logPath, 'utf8');
const anchor = '<!-- rilis-baru -->';
const peta = '<!-- peta-baru -->';
for (const a of [anchor, peta]) {
  if (!log.includes(a)) {
    console.error(`CHANGELOG.md tidak punya penanda ${a}`);
    process.exit(1);
  }
}
const judul = ringkasan.join(' ').trim();
if (!judul) console.warn('Tanpa ringkasan — isi judul versi di CHANGELOG.md (tampil di Riwayat versi aplikasi).');
// Satu baris kosong antar-entri; judul ikut tampil di halaman Riwayat versi.
const entri = `${anchor}\n\n## ${baru} — ${tanggal} — ${judul || '(judul singkat)'}\n\n- (tulis perubahan yang terasa user di sini)\n`;
const baris = `| ${baru} | ${hr} ${BULAN[bl - 1]} ${th} | ${judul || '(judul singkat)'} |\n${peta}`;
writeFileSync(logPath, log.replace(`${anchor}\n`, entri).replace(peta, baris));

console.log(`Versi ${pkg.version} → ${baru}. Lengkapi catatan ${baru} di CHANGELOG.md, lalu commit.`);
