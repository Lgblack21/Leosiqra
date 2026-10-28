// Tema musiman maskot Leo (Pengaturan → Tema musiman). Ditentukan dari
// tanggal WIB. Rentang Ramadan–Lebaran perkiraan (hisab), cukup untuk hiasan.
export type Season = 'lebaran' | 'merdeka' | 'halloween' | 'natal';

const LEBARAN: [string, string][] = [
  ['2027-02-08', '2027-03-17'],
  ['2028-01-28', '2028-03-05'],
  ['2029-01-16', '2029-02-22'],
];

export const SEASON_INFO: Record<Season, { label: string; desc: string; deco: string[] }> = {
  lebaran: { label: 'Ramadan & Lebaran', desc: 'Leo pakai peci, kartu Ringkasan berhias bulan sabit & ketupat.', deco: ['🌙', '✨', '🕌'] },
  merdeka: { label: 'Bulan Kemerdekaan', desc: 'Agustus: Leo pakai ikat kepala merah putih, ada bendera kecil berkibar.', deco: ['🇮🇩', '🎉', '⭐'] },
  halloween: { label: 'Halloween', desc: 'Oktober: Leo pakai topi penyihir, kartu Ringkasan dihiasi kelelawar & labu.', deco: ['🦇', '🎃', '🕸️'] },
  natal: { label: 'Natal & Tahun Baru', desc: 'Desember: Leo pakai topi Santa, kartu Ringkasan bersalju.', deco: ['❄️', '🎄', '✨'] },
};

export function currentSeason(now = new Date()): Season | null {
  const wib = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  if (LEBARAN.some(([a, b]) => wib >= a && wib <= b)) return 'lebaran';
  const month = Number(wib.slice(5, 7));
  if (month === 8) return 'merdeka';
  if (month === 10) return 'halloween';
  if (month === 12) return 'natal';
  return null;
}
