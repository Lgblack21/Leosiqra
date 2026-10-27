// Ikon emoji + warna latar untuk baris transaksi, ditebak dari nama kategori
// (kategori user bebas diketik, jadi dicocokkan lewat kata kunci, bukan nama persis).

const RULES: { keys: string[]; emoji: string; tile: string }[] = [
  { keys: ['kopi', 'coffee', 'cafe'], emoji: '☕', tile: 'bg-amber-50' },
  { keys: ['makan', 'minum', 'kuliner', 'resto', 'jajan', 'snack'], emoji: '🍛', tile: 'bg-orange-50' },
  { keys: ['transport', 'ojek', 'bensin', 'bbm', 'parkir', 'tol', 'grab', 'gojek', 'kendaraan'], emoji: '🛵', tile: 'bg-indigo-50' },
  { keys: ['belanja', 'groceries', 'supermarket', 'shopping', 'pakaian', 'fashion'], emoji: '🛒', tile: 'bg-emerald-50' },
  { keys: ['listrik', 'pln', 'air', 'pdam', 'internet', 'wifi', 'pulsa', 'tagihan', 'langganan'], emoji: '💡', tile: 'bg-yellow-50' },
  { keys: ['hiburan', 'film', 'netflix', 'spotify', 'game', 'nonton', 'liburan', 'wisata'], emoji: '🎬', tile: 'bg-violet-50' },
  { keys: ['rumah', 'sewa', 'kos', 'kontrakan', 'tempat tinggal'], emoji: '🏠', tile: 'bg-sky-50' },
  { keys: ['cicilan', 'kredit', 'angsuran', 'hutang', 'pinjaman'], emoji: '📆', tile: 'bg-rose-50' },
  { keys: ['kesehatan', 'obat', 'dokter', 'rumah sakit', 'apotek', 'bpjs'], emoji: '💊', tile: 'bg-teal-50' },
  { keys: ['pendidikan', 'sekolah', 'kursus', 'buku', 'kuliah'], emoji: '📚', tile: 'bg-blue-50' },
  { keys: ['anak', 'keluarga', 'orang tua'], emoji: '👨‍👩‍👧', tile: 'bg-pink-50' },
  { keys: ['donasi', 'sedekah', 'zakat', 'infaq', 'amal'], emoji: '🤲', tile: 'bg-emerald-50' },
  { keys: ['asuransi'], emoji: '🛡️', tile: 'bg-slate-100' },
  { keys: ['gaji', 'salary', 'upah'], emoji: '💼', tile: 'bg-emerald-50' },
  { keys: ['bonus', 'thr', 'hadiah'], emoji: '🎁', tile: 'bg-pink-50' },
  { keys: ['investasi', 'saham', 'reksa', 'deposito', 'emas', 'dividen', 'bunga'], emoji: '📈', tile: 'bg-violet-50' },
  { keys: ['tabungan', 'nabung'], emoji: '🐷', tile: 'bg-pink-50' },
  { keys: ['transfer', 'top up', 'topup'], emoji: '🔁', tile: 'bg-slate-100' },
  { keys: ['usaha', 'bisnis', 'freelance', 'penjualan', 'pendapatan'], emoji: '💰', tile: 'bg-emerald-50' },
];

export function categoryVisual(category?: string, type?: string): { emoji: string; tile: string } {
  const text = (category || '').toLowerCase();
  const hit = RULES.find((r) => r.keys.some((k) => text.includes(k)));
  if (hit) return { emoji: hit.emoji, tile: hit.tile };
  if (type === 'transfer' || type === 'topup') return { emoji: '🔁', tile: 'bg-slate-100' };
  if (type === 'pemasukan') return { emoji: '💰', tile: 'bg-emerald-50' };
  return { emoji: '🧾', tile: 'bg-slate-100' };
}
