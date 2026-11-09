import { isHariKerja } from '@/lib/hariLibur';

// Aturan pajak orang pribadi yang dipakai Pajak Center. SEMUA angka resmi ada di sini supaya mudah
// diperbarui bila aturan berubah. Ini estimasi — bukan pengganti konsultan pajak / Coretax DJP.
//
// - PTKP: PMK 101/PMK.010/2016 — TK Rp54 jt, kawin +Rp4,5 jt, tiap tanggungan +Rp4,5 jt (maks 3).
// - Tarif Pasal 17 UU HPP (UU 7/2021), berlaku sejak tahun pajak 2022.
// - Biaya jabatan karyawan: 5% penghasilan bruto, maks Rp6 jt setahun (PMK 250/PMK.03/2008).
// - Zakat lewat BAZNAS/LAZ resmi = pengurang penghasilan bruto (PP 60/2010).
// - PPh final UMKM 0,5% dari omzet (PP 55/2022): WP orang pribadi tidak dikenai pajak atas omzet
//   s.d. Rp500 jt setahun; berlaku bila omzet setahun ≤ Rp4,8 M; jangka waktu terbatas (7 tahun pajak
//   untuk orang pribadi). Setor paling lambat tanggal 15 bulan berikutnya.
// - SPT Tahunan orang pribadi: paling lambat 3 bulan setelah akhir tahun pajak (31 Maret).
// - Jatuh tempo pada hari libur → hari kerja berikutnya.

export const PTKP_BASE = { TK: 54_000_000, K: 58_500_000 } as const;
export const PTKP_PER_TANGGUNGAN = 4_500_000;
export const MAX_TANGGUNGAN = 3;
export const TAX_BRACKETS = [
  { min: 0, max: 60_000_000, rate: 0.05 },
  { min: 60_000_000, max: 250_000_000, rate: 0.15 },
  { min: 250_000_000, max: 500_000_000, rate: 0.25 },
  { min: 500_000_000, max: 5_000_000_000, rate: 0.3 },
  { min: 5_000_000_000, max: Infinity, rate: 0.35 },
] as const;
export const BIAYA_JABATAN_RATE = 0.05;
export const BIAYA_JABATAN_MAKS = 6_000_000;
export const UMKM_RATE = 0.005;
export const UMKM_BEBAS = 500_000_000;
export const UMKM_BATAS_OMZET = 4_800_000_000;
export const UMKM_TAHUN_MAKS = 7;

export type Bracket = { min: number; max: number; rate: number; kena: number; pajak: number };
export function pphPasal17(pkp: number): { total: number; lapisan: Bracket[] } {
  if (pkp <= 0) return { total: 0, lapisan: [] };
  const lapisan: Bracket[] = [];
  let total = 0;
  for (const b of TAX_BRACKETS) {
    if (pkp <= b.min) break;
    const kena = Math.min(pkp, b.max) - b.min;
    const pajak = Math.floor(kena * b.rate);
    lapisan.push({ ...b, kena, pajak });
    total += pajak;
  }
  return { total, lapisan };
}

export const ptkpOf = (status: 'TK' | 'K', tanggungan: number) =>
  PTKP_BASE[status] + Math.min(MAX_TANGGUNGAN, Math.max(0, tanggungan)) * PTKP_PER_TANGGUNGAN;

/** PKP dibulatkan ke bawah ribuan penuh. */
export const pkpOf = (neto: number, ptkp: number) => Math.floor(Math.max(0, neto - ptkp) / 1000) * 1000;

export type UmkmBulan = { bulan: number; omzet: number; kumulatif: number; kenaPajak: number; pph: number };
/** PPh final UMKM per bulan: 0,5% atas bagian omzet yang melewati Rp500 jt kumulatif dalam setahun. */
export function umkmPerBulan(omzet: number[]): UmkmBulan[] {
  let kum = 0;
  return omzet.map((o, i) => {
    const sebelum = kum;
    kum += Math.max(0, o);
    const kenaPajak = Math.max(0, kum - Math.max(UMKM_BEBAS, sebelum));
    return { bulan: i + 1, omzet: Math.max(0, o), kumulatif: kum, kenaPajak, pph: Math.floor(kenaPajak * UMKM_RATE) };
  });
}

export type SptInput = {
  status: 'TK' | 'K';
  tanggungan: number;
  karyawan: boolean;
  brutoGaji: number;
  iuranPensiun: number;
  pph21Dipotong: number;
  usahaMode: 'final' | 'pembukuan' | 'tidak';
  omzetSetahun: number;
  biayaUsaha: number;
  penghasilanLain: number;
  zakat: number;
};
export function hitungSpt(x: SptInput) {
  const brutoGaji = x.karyawan ? Math.max(0, x.brutoGaji) : 0;
  const biayaJabatan = Math.min(BIAYA_JABATAN_MAKS, Math.floor(brutoGaji * BIAYA_JABATAN_RATE));
  const iuran = x.karyawan ? Math.min(Math.max(0, x.iuranPensiun), brutoGaji) : 0;
  const netoGaji = Math.max(0, brutoGaji - biayaJabatan - iuran);
  // Usaha dengan PPh final 0,5% TIDAK ikut tarif progresif (sudah final). Pembukuan → laba usaha masuk.
  const netoUsaha = x.usahaMode === 'pembukuan' ? x.omzetSetahun - x.biayaUsaha : 0;
  const lain = Math.max(0, x.penghasilanLain);
  const zakat = Math.max(0, x.zakat);
  const netoSebelumZakat = netoGaji + netoUsaha + lain;
  const neto = Math.max(0, netoSebelumZakat - zakat);
  const ptkp = ptkpOf(x.status, x.tanggungan);
  const pkp = pkpOf(neto, ptkp);
  const { total: pphTerutang, lapisan } = pphPasal17(pkp);
  const kredit = Math.max(0, x.pph21Dipotong);
  const selisih = pphTerutang - kredit; // + kurang bayar, − lebih bayar
  return {
    brutoGaji,
    biayaJabatan,
    iuran,
    netoGaji,
    netoUsaha,
    lain,
    zakat,
    netoSebelumZakat,
    neto,
    ptkp,
    pkp,
    pphTerutang,
    lapisan,
    kredit,
    selisih,
    status: selisih > 0 ? ('kurang' as const) : selisih < 0 ? ('lebih' as const) : ('nihil' as const),
  };
}

// ── Kalender pajak
const pad = (n: number) => String(n).padStart(2, '0');
export const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Geser ke hari kerja berikutnya bila jatuh di akhir pekan / tanggal merah. */
export function hariKerjaBerikut(y: number, m: number, d: number) {
  const x = new Date(y, m - 1, d);
  for (let i = 0; i < 20 && !isHariKerja(x); i++) x.setDate(x.getDate() + 1);
  return x;
}
export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export type Tenggat = {
  key: string;
  date: Date;
  title: string;
  sub: string;
  kind: 'spt' | 'umkm' | 'dokumen';
  done: boolean;
  amount?: number;
};
/** Tenggat untuk tahun pajak `year`: setor UMKM tiap bulan (bila mode final), bukti potong A1, SPT Tahunan. */
export function tenggatTahun(
  year: number,
  opt: { karyawan: boolean; umkm: UmkmBulan[] | null; setor: Record<string, { paid: boolean }>; sptLapor: boolean },
): Tenggat[] {
  const out: Tenggat[] = [];
  if (opt.umkm) {
    for (const b of opt.umkm) {
      if (b.omzet <= 0) continue;
      const due = b.bulan === 12 ? hariKerjaBerikut(year + 1, 1, 15) : hariKerjaBerikut(year, b.bulan + 1, 15);
      const key = pad(b.bulan);
      out.push({
        key: `umkm-${key}`,
        date: due,
        title: `Setor PPh final UMKM masa ${NAMA_BULAN[b.bulan - 1]}`,
        sub:
          b.pph > 0
            ? 'Bayar lewat kode billing; bukti setor dianggap sudah lapor.'
            : 'Omzet masih di bawah Rp500 jt — tidak ada setoran.',
        kind: 'umkm',
        done: b.pph <= 0 || opt.setor[key]?.paid === true,
        amount: b.pph,
      });
    }
  }
  if (opt.karyawan)
    out.push({
      key: 'a1',
      date: hariKerjaBerikut(year + 1, 1, 31),
      title: 'Minta bukti potong PPh 21 (A1) dari kantor',
      sub: 'Pemberi kerja wajib memberikannya paling lambat sebulan setelah akhir tahun.',
      kind: 'dokumen',
      done: false,
    });
  out.push({
    key: 'spt',
    date: hariKerjaBerikut(year + 1, 3, 31),
    title: `Lapor SPT Tahunan ${year}`,
    sub: 'Lewat Coretax DJP (coretaxdjp.pajak.go.id).',
    kind: 'spt',
    done: opt.sptLapor,
  });
  return out.sort((a, b) => +a.date - +b.date);
}

export const sisaHari = (d: Date, now = new Date()) => {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((+d - +a) / 86400e3);
};
