import type { FitProfile, KondisiKey, MetodeKey, Tingkat } from './types';

// Olahragaku — aturan keamanan metode diet (rancangan bagian 3). Murni (tanpa fetch/DOM) supaya
// dipakai juga oleh Worker saat memulai program: klien bukan batas kepercayaan.

// Harus sama dengan `tingkat` di metode.ts (Worker tidak perlu memuat teks metode yang panjang).
export const TINGKAT: Record<MetodeKey, Tingkat> = {
  'isi-piringku': 'pemula',
  'porsi-tangan': 'pemula',
  'makan-sadar': 'pemula',
  'kurangi-gula': 'pemula',
  'minim-olahan': 'pemula',
  'defisit-seimbang': 'pemula',
  'tinggi-protein': 'menengah',
  'volume-eating': 'pemula',
  'rendah-karbo': 'menengah',
  'jendela-12-12': 'pemula',
  'jendela-14-10': 'pemula',
  'jendela-16-8': 'menengah',
  'jendela-18-6': 'lanjut',
  'jendela-20-4': 'lanjut',
  'puasa-5-2': 'lanjut',
  omad: 'lanjut',
  mediterania: 'pemula',
  dash: 'pemula',
  nabati: 'menengah',
  keto: 'lanjut',
};

const PUASA_PANJANG: MetodeKey[] = ['jendela-16-8', 'jendela-18-6', 'jendela-20-4', 'omad', 'puasa-5-2'];
const TANPA_DEFISIT_OK: MetodeKey[] = ['isi-piringku', 'makan-sadar'];
const AMAN_GANGGUAN_MAKAN: MetodeKey[] = ['isi-piringku', 'makan-sadar', 'porsi-tangan'];

// Kunci per kondisi: metode yang TIDAK boleh dipilih + alasan.
const KUNCI: Partial<Record<KondisiKey, { metode: MetodeKey[]; alasan: string }>> = {
  diabetes_obat: {
    metode: [...PUASA_PANJANG, 'keto'],
    alasan:
      'Puasa panjang atau sangat rendah karbo bisa membuat gula darah turun terlalu rendah kalau kamu pakai obat diabetes/insulin.',
  },
  ginjal: {
    metode: ['tinggi-protein', 'keto'],
    alasan: 'Asupan protein/lemak tinggi bisa membebani ginjal — atur bersama dokter.',
  },
  maag: {
    metode: ['jendela-18-6', 'jendela-20-4', 'omad', 'puasa-5-2'],
    alasan: 'Perut kosong terlalu lama sering memicu kambuhnya maag/GERD.',
  },
};

// Peringatan (boleh dipilih, tapi sarankan cek dokter dulu).
const PERINGATAN: Partial<Record<KondisiKey, { metode: MetodeKey[] | 'semua'; teks: string }>> = {
  jantung: { metode: 'semua', teks: 'Ada riwayat jantung: konsultasikan rencana diet & olahraga ke dokter dulu.' },
  pingsan: { metode: 'semua', teks: 'Pernah pingsan saat olahraga: cek ke dokter sebelum mulai program.' },
  diabetes_obat: {
    metode: ['rendah-karbo', 'jendela-14-10', 'defisit-seimbang'],
    teks: 'Pakai obat diabetes: dosis obat mungkin perlu disesuaikan saat pola makan berubah — bicarakan dengan dokter.',
  },
  diabetes: {
    metode: [...PUASA_PANJANG, 'keto', 'rendah-karbo'],
    teks: 'Gula darah tinggi: pantau gula darahmu dan konsultasikan ke dokter kalau sering lemas atau pusing.',
  },
  tensi: {
    metode: ['keto'],
    teks: 'Tekanan darah tinggi: DASH biasanya lebih cocok; keto sebaiknya dengan saran dokter.',
  },
};

export type StatusMetode = {
  boleh: boolean;
  alasan: string[]; // kenapa dikunci
  peringatan: string[]; // boleh, tapi baca dulu
};

export function statusMetode(
  key: MetodeKey,
  p: Pick<FitProfile, 'conditions' | 'experience' | 'birthYear'>,
  today = new Date(),
): StatusMetode {
  const umur = today.getFullYear() - p.birthYear;
  const kond = new Set(p.conditions);
  const alasan: string[] = [];
  const peringatan: string[] = [];

  if (kond.has('hamil') || umur < 18) {
    if (!TANPA_DEFISIT_OK.includes(key))
      alasan.push(
        kond.has('hamil')
          ? 'Saat hamil/menyusui, pilih pola makan seimbang tanpa mengurangi kalori atau berpuasa.'
          : 'Di bawah 18 tahun, pilih pola makan seimbang — bukan diet atau puasa.',
      );
  }
  if (kond.has('gangguan_makan') && !AMAN_GANGGUAN_MAKAN.includes(key))
    alasan.push(
      'Dengan riwayat gangguan makan, metode hitung kalori atau puasa bisa memicu kambuh. Pilih yang lebih lembut.',
    );
  for (const k of kond) {
    const r = KUNCI[k];
    if (r && r.metode.includes(key)) alasan.push(r.alasan);
    const w = PERINGATAN[k];
    if (w && (w.metode === 'semua' || w.metode.includes(key))) peringatan.push(w.teks);
  }
  if (TINGKAT[key] === 'lanjut') {
    if (umur >= 65) alasan.push('Metode tingkat lanjut tidak disarankan di atas 65 tahun.');
    else if (p.experience !== 'rutin')
      alasan.push('Ini metode tingkat lanjut. Mulai dari metode pemula/menengah dulu; terbuka kalau kamu sudah rutin.');
  }
  return { boleh: alasan.length === 0, alasan: [...new Set(alasan)], peringatan: [...new Set(peringatan)] };
}

// ── Kuis setelah membaca ───────────────────────────────────────────────────────
export type JawabanSanggup = 'ya' | 'mungkin' | 'tidak';
export type HasilKuis = 'cocok' | 'catatan' | 'belum';

export function nilaiKuis(
  pertanyaan: { id: string; jenis: 'sanggup' | 'paham'; inti?: boolean; benar?: number }[],
  jawaban: Record<string, JawabanSanggup | number | undefined>,
): { hasil: HasilKuis; salahPaham: string[]; tidakInti: string[] } {
  const salahPaham: string[] = [];
  const tidakInti: string[] = [];
  let ada: 'cocok' | 'catatan' = 'cocok';
  for (const q of pertanyaan) {
    const j = jawaban[q.id];
    if (q.jenis === 'paham') {
      if (j !== q.benar) salahPaham.push(q.id);
    } else if (j === 'tidak') {
      if (q.inti) tidakInti.push(q.id);
      else ada = 'catatan';
    } else if (j === 'mungkin') ada = 'catatan';
  }
  return { hasil: tidakInti.length ? 'belum' : ada, salahPaham, tidakInti };
}
