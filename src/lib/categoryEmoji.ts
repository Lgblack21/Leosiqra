// Emoji kecil per kategori untuk daftar ringkas (Anggaran, Laporan, Langganan,
// Ikuti uangmu). Dicocokkan dari kata di nama kategori; default 💸.
const RULES: [RegExp, string][] = [
  [/makan|minum|kuliner|resto|jajan|snack/i, '🍜'],
  [/kopi|coffee/i, '☕'],
  [/belanja|groceri|super|mart|pasar/i, '🛒'],
  [/transport|bensin|parkir|ojek|grab|gojek|tol|kendaraan/i, '🛵'],
  [/tinggal|kos|sewa|rumah|kontrak/i, '🏠'],
  [/tagihan|listrik|air|internet|pulsa|wifi|pln/i, '🧾'],
  [/hiburan|nonton|film|game|streaming|netflix|spotify/i, '🎬'],
  [/kesehatan|obat|dokter|rumah sakit|bpjs/i, '💊'],
  [/pendidikan|sekolah|kuliah|kursus|buku/i, '📚'],
  [/pakaian|fashion|baju|sepatu/i, '👕'],
  [/hadiah|donasi|zakat|sedekah|amal/i, '🎁'],
  [/liburan|travel|wisata|hotel|tiket/i, '✈️'],
  [/anak|bayi|keluarga/i, '👨‍👩‍👧'],
  [/hewan|kucing|anjing|pet/i, '🐾'],
  [/gaji|salary/i, '💼'],
  [/freelance|proyek|usaha|bisnis|jualan/i, '🧑‍💻'],
  [/bonus|thr/i, '🎉'],
  [/investasi|saham|reksa|deposito|emas|kripto/i, '📈'],
  [/tabungan|nabung/i, '🐷'],
  [/hutang|cicilan|kredit|pinjam/i, '💳'],
];

export const categoryEmoji = (name?: string | null) => {
  if (!name) return '💸';
  for (const [re, emoji] of RULES) if (re.test(name)) return emoji;
  return '💸';
};

// Beli investasi tersimpan sebagai "pengeluaran" tapi bukan biaya hidup —
// aturan yang sama dengan Worker (insight, laporan bulanan) & Dashboard.
export const isInvestmentCategory = (category?: string | null) =>
  Boolean(category) && (/investasi/i.test(category!) || category === 'Saham' || category === 'Deposito');
