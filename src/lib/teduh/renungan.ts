// Renungan harian Teduh — ayat hari ini + bahan renungan + satu langkah kecil untuk keuangan.
// Teks kitab & tafsir diambil dari sumbernya (tanpa diubah); bahan renungan di bawah ini tulisan tim
// Leosiqra (bukan tafsir) — sengaja berupa pertanyaan & ajakan, bukan pengajaran doktrin.
// Catatan pribadi hanya disimpan di perangkat (UU PDP: data keyakinan = data pribadi spesifik).

export type BahanRenungan = { renung: string[]; langkah: { teks: string; href?: string; app?: string }[] };

const B = (renung: string[], langkah: BahanRenungan['langkah']): BahanRenungan => ({ renung, langkah });

/** Bahan per id tema (tema Al-Qur'an & Alkitab memakai id yang sebagian sama). */
export const BAHAN: Record<string, BahanRenungan> = {
  rezeki: B(
    [
      'Rezeki apa yang hari ini sering terlupa untuk disyukuri — kesehatan, waktu, orang-orang di sekitarmu?',
      'Kalau rezeki sudah diatur, bagian mana yang menjadi tugasmu hari ini: berusaha, mengatur, atau berbagi?',
      'Apa satu kekhawatiran soal uang yang bisa kamu serahkan, lalu fokus pada langkah yang bisa kamu kerjakan?',
    ],
    [
      { teks: 'Catat pemasukan hari ini, sekecil apa pun.', href: '/input-cepat?teks=Pemasukan' },
      { teks: 'Lihat ke mana uangmu mengalir bulan ini.', href: '/membership/laporan', app: '/app/statistics' },
    ],
  ),
  syukur: B(
    [
      'Sebutkan tiga hal yang kamu miliki hari ini yang dulu pernah kamu doakan.',
      'Bagaimana rasa syukur bisa terlihat dari cara kamu memakai uang minggu ini?',
      'Siapa yang perlu kamu ucapkan terima kasih hari ini?',
    ],
    [{ teks: 'Tulis satu kalimat syukur di catatan renungan di bawah.' }],
  ),
  sedekah: B(
    [
      'Kepada siapa bantuan kecilmu paling berarti minggu ini?',
      'Apakah memberi sudah menjadi rencana di anggaranmu, atau masih menunggu sisa?',
      'Apa yang membuatmu ragu untuk memberi — dan apakah keraguan itu beralasan?',
    ],
    [
      { teks: 'Sisihkan pos sedekah di anggaran bulan ini.', href: '/membership/budget', app: '/app/budget' },
      { teks: 'Catat sedekah yang sudah kamu berikan.', href: '/input-cepat?teks=Sedekah' },
    ],
  ),
  memberi: B(
    [
      'Apakah memberi sudah menjadi bagian pertama dari rencanamu, atau masih dari sisa?',
      'Siapa di sekitarmu yang sedang membutuhkan bantuan — bukan hanya uang, tapi juga waktu dan perhatian?',
      'Bagaimana memberi dengan sukacita bisa mengubah caramu memandang uang?',
    ],
    [
      { teks: 'Sisihkan pos persembahan di anggaran bulan ini.', href: '/membership/budget', app: '/app/budget' },
      { teks: 'Catat persembahan yang sudah kamu berikan.', href: '/input-cepat?teks=Persembahan' },
    ],
  ),
  utang: B(
    [
      'Adakah janji atau utang yang perlu kamu selesaikan, atau sekadar kamu kabari?',
      'Apakah ada orang yang berutang padamu yang perlu diberi kelonggaran?',
      'Kebiasaan apa yang paling sering membuatmu berutang — dan apa satu langkah untuk menguranginya?',
    ],
    [
      { teks: 'Tinjau daftar utang & piutangmu.', href: '/membership/kekayaan', app: '/app/debts' },
      { teks: 'Tulis tanggal jatuh tempo terdekat agar tidak terlewat.' },
    ],
  ),
  hemat: B(
    [
      'Pengeluaran mana minggu ini yang terasa perlu, dan mana yang sekadar ingin?',
      'Apakah ada barang yang kamu beli tapi jarang dipakai?',
      'Bagaimana hidup sederhana bisa memberi ruang untuk hal yang lebih penting?',
    ],
    [
      { teks: 'Cek sisa anggaran per kategori bulan ini.', href: '/membership/budget', app: '/app/budget' },
      { teks: 'Tunda satu pembelian keinginan selama 24 jam.' },
    ],
  ),
  cukup: B(
    [
      'Kapan terakhir kamu merasa cukup — dan apa yang membuatnya terasa begitu?',
      'Apakah membandingkan diri dengan orang lain memengaruhi belanjamu akhir-akhir ini?',
      'Apa satu hal yang bisa kamu lepaskan supaya hati lebih ringan?',
    ],
    [
      { teks: 'Cek sisa anggaran per kategori bulan ini.', href: '/membership/budget', app: '/app/budget' },
      { teks: 'Tunda satu pembelian keinginan selama 24 jam.' },
    ],
  ),
  rencana: B(
    [
      'Rencana apa yang sedang kamu kerjakan dengan tekun, sedikit demi sedikit?',
      'Apakah tabunganmu sudah punya tujuan yang jelas?',
      'Nasihat siapa yang perlu kamu dengar sebelum mengambil keputusan besar?',
    ],
    [
      { teks: 'Tambahkan atau cek target tabunganmu.', href: '/membership/tabungan', app: '/app/savings' },
      { teks: 'Tulis satu tujuan keuangan untuk 3 bulan ke depan.' },
    ],
  ),
  tenang: B(
    [
      'Apa yang sedang membuatmu cemas soal uang? Tulis, lalu pisahkan mana yang bisa kamu kendalikan.',
      'Kesulitan apa di masa lalu yang ternyata bisa kamu lewati?',
      'Siapa yang bisa kamu ajak bicara saat beban terasa berat?',
    ],
    [
      { teks: 'Ambil jeda napas satu menit di bawah.' },
      {
        teks: 'Lihat dana darurat & tabunganmu — mungkin kamu lebih siap dari yang kamu kira.',
        href: '/membership/tabungan',
        app: '/app/savings',
      },
    ],
  ),
  kerja: B(
    [
      'Pekerjaan apa hari ini yang bisa kamu kerjakan dengan sepenuh hati, walau tidak dilihat orang?',
      'Bagaimana kamu menjaga keseimbangan antara bekerja dan beristirahat?',
      'Apa keterampilan yang ingin kamu kembangkan untuk masa depanmu?',
    ],
    [{ teks: 'Catat pemasukan hari ini, sekecil apa pun.', href: '/input-cepat?teks=Pemasukan' }],
  ),
  harta: B(
    [
      'Harta mana yang paling menyita perhatianmu — dan apakah sepadan?',
      'Bagaimana kamu ingin hartamu diingat: dikumpulkan, atau dipakai untuk kebaikan?',
      'Adakah cara mendapat atau memakai uang yang perlu kamu tinjau ulang?',
    ],
    [{ teks: 'Lihat ringkasan kekayaan bersihmu.', href: '/membership/kekayaan', app: '/app/wallet' }],
  ),
};
const UMUM: BahanRenungan = B(
  ['Apa satu hal dari bacaan ini yang ingin kamu bawa sepanjang hari?'],
  [{ teks: 'Tulis satu kalimat syukur di catatan renungan di bawah.' }],
);
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400_000);
/** Bahan untuk tema & tanggal tertentu: pertanyaan & langkah bergilir tiap hari. */
export function bahanHariIni(temaId: string, d = new Date()) {
  const b = BAHAN[temaId] ?? UMUM;
  const n = dayNumber(d);
  return { renung: b.renung[n % b.renung.length], langkah: b.langkah[n % b.langkah.length] };
}

// ── Catatan pribadi (renungan per hari & catatan per ayat), hanya di perangkat ──
const KEY = 'leosiqra-teduh-catatan';
type Store = { hari: Record<string, string>; ayat: Record<string, string> };
const subs = new Set<() => void>();
let cache: { raw: string | null; val: Store } = { raw: null, val: { hari: {}, ayat: {} } };
const read = (): Store => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.val;
  }
  if (raw !== cache.raw) {
    let val: Store = { hari: {}, ayat: {} };
    try {
      const v = JSON.parse(raw ?? 'null');
      if (v && typeof v === 'object')
        val = {
          hari: v.hari && typeof v.hari === 'object' ? v.hari : {},
          ayat: v.ayat && typeof v.ayat === 'object' ? v.ayat : {},
        };
    } catch {
      /* rusak */
    }
    cache = { raw, val };
  }
  return cache.val;
};
const write = (s: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* penuh / diblokir */
  }
  subs.forEach((l) => l());
};
export const catatan = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  snapshot: read,
  setHari(tanggal: string, teks: string) {
    const s = read();
    const hari = { ...s.hari };
    if (teks.trim()) hari[tanggal] = teks.slice(0, 2000);
    else delete hari[tanggal];
    write({ ...s, hari });
  },
  setAyat(k: string, teks: string) {
    const s = read();
    const ayat = { ...s.ayat };
    if (teks.trim()) ayat[k] = teks.slice(0, 2000);
    else delete ayat[k];
    write({ ...s, ayat });
  },
};
