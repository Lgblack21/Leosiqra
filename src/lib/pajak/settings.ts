import { cloudflareApi } from '@/lib/cloudflare-api';

// Setelan Pajak Center per tahun pajak. Disimpan di akun (GET/PUT /api/member/tax/settings, migrasi
// 0043). Bila tabel belum ada (ready:false / 503) → disimpan di perangkat (localStorage) sebagai cadangan.

export const DOKUMEN = [
  { key: 'npwp', label: 'NPWP / NIK sudah aktif sebagai NPWP' },
  { key: 'coretax', label: 'Bisa masuk Coretax DJP (akun & kata sandi)' },
  { key: 'efin', label: 'Kode otorisasi / sertifikat elektronik di Coretax' },
  { key: 'a1', label: 'Bukti potong PPh 21 (A1) dari kantor', karyawan: true },
  { key: 'setoran', label: 'Bukti setor PPh final UMKM tiap bulan', usaha: true },
  { key: 'harta', label: 'Daftar harta per 31 Desember (rekening, investasi, kendaraan, rumah)' },
  { key: 'utang', label: 'Daftar utang per 31 Desember' },
  { key: 'rekening', label: 'Saldo rekening & e-wallet per 31 Desember' },
  { key: 'zakat', label: 'Bukti setor zakat ke BAZNAS/LAZ resmi (kalau ada)' },
] as const;
export type DokKey = (typeof DOKUMEN)[number]['key'];

export type TaxSettings = {
  status: 'TK' | 'K';
  tanggungan: number;
  karyawan: boolean;
  gajiBruto: number | null; // null = otomatis dari transaksi kategori Gaji
  iuranPensiun: number;
  pph21Dipotong: number;
  usahaMode: 'final' | 'pembukuan' | 'tidak';
  umkmMulai: number | null;
  omzetManual: Record<string, number>; // '01'..'12' → menimpa omzet otomatis bulan itu
  umkmSetor: Record<string, { paid: boolean; date?: string }>;
  zakat: number | null; // null = saran otomatis dari transaksi berkata "zakat"
  penghasilanLain: number;
  sptLapor: boolean;
  sptTanggal: string | null;
  dokumen: Partial<Record<DokKey, boolean>>;
};

export const DEFAULT_SETTINGS: TaxSettings = {
  status: 'TK',
  tanggungan: 0,
  karyawan: true,
  gajiBruto: null,
  iuranPensiun: 0,
  pph21Dipotong: 0,
  usahaMode: 'tidak',
  umkmMulai: null,
  omzetManual: {},
  umkmSetor: {},
  zakat: null,
  penghasilanLain: 0,
  sptLapor: false,
  sptTanggal: null,
  dokumen: {},
};

const localKey = (year: number) => `leosiqra-pajak-${year}`;
const readLocal = (year: number): Partial<TaxSettings> | null => {
  try {
    const raw = window.localStorage.getItem(localKey(year));
    if (raw) return JSON.parse(raw) as Partial<TaxSettings>;
    // Setelan versi lama Pajak Center (sebelum 3.25.0).
    const st = window.localStorage.getItem('pajak-center-marital-status');
    const dep = window.localStorage.getItem('pajak-center-dependents');
    const pph = window.localStorage.getItem(`pajak-center-pph21-${year}`);
    if (st || dep || pph)
      return {
        status: st === 'K' ? 'K' : 'TK',
        tanggungan: Math.min(3, Math.max(0, Number(dep) || 0)),
        pph21Dipotong: Math.max(0, Number(pph) || 0),
      };
  } catch {
    /* storage diblokir */
  }
  return null;
};
const writeLocal = (year: number, s: TaxSettings) => {
  try {
    window.localStorage.setItem(localKey(year), JSON.stringify(s));
  } catch {
    /* storage diblokir */
  }
};

export type LoadResult = { settings: TaxSettings; where: 'akun' | 'perangkat'; fresh: boolean };
export async function loadTaxSettings(year: number): Promise<LoadResult> {
  try {
    const r = await cloudflareApi<{ ready: boolean; settings: Partial<TaxSettings> | null }>(
      `/api/member/tax/settings?year=${year}`,
    );
    if (r.ready) {
      if (r.settings) return { settings: { ...DEFAULT_SETTINGS, ...r.settings }, where: 'akun', fresh: false };
      // Belum ada di akun → bawa setelan lama di perangkat (sekali), lalu simpan ke akun saat diubah.
      const local = readLocal(year);
      return { settings: { ...DEFAULT_SETTINGS, ...(local ?? {}) }, where: 'akun', fresh: !local };
    }
  } catch {
    /* jaringan / server → pakai perangkat */
  }
  const local = readLocal(year);
  return { settings: { ...DEFAULT_SETTINGS, ...(local ?? {}) }, where: 'perangkat', fresh: !local };
}

export async function saveTaxSettings(year: number, s: TaxSettings): Promise<'akun' | 'perangkat'> {
  writeLocal(year, s);
  try {
    await cloudflareApi(`/api/member/tax/settings?year=${year}`, { method: 'PUT', json: { settings: s } });
    return 'akun';
  } catch {
    return 'perangkat';
  }
}
