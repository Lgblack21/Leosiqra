// Direktori asuransi Sehatku › Asuransi. Kontak & tautan dibaca dari situs resmi masing-masing
// pada `readAt` (sumber = `source`). Yang belum bisa dibaca otomatis (situs menolak / butuh
// JavaScript) hanya berisi nama + situs resmi (`verified: false`) — user mengisi call center &
// cara klaim sendiri di polisnya. Perbarui berkala; jangan tambah angka tanpa sumber.

export type InsurerFact = { label: string; value: string; note?: string };
export type Insurer = {
  key: string;
  name: string;
  initials: string;
  color: string; // warna tile inisial (bukan logo perusahaan)
  tags: string[];
  website: string;
  phone?: string;
  phoneNote?: string;
  whatsapp?: string;
  whatsappNote?: string;
  email?: string;
  hours?: string;
  claimUrl?: string;
  hospitalsUrl?: string;
  facts?: InsurerFact[];
  notes?: string[];
  source?: string;
  readAt?: string;
  readNote?: string; // pengganti kalimat sumber default
  verified: boolean;
};

const READ = '2026-11-07';

export const INSURERS: Insurer[] = [
  {
    key: 'bpjs',
    name: 'BPJS Kesehatan',
    initials: 'JKN',
    color: 'bg-emerald-600',
    tags: ['Kesehatan', 'Sosial'],
    website: 'https://www.bpjs-kesehatan.go.id',
    phone: '165',
    phoneNote: 'Care Center',
    whatsapp: '08118165165',
    whatsappNote: 'PANDAWA (layanan administrasi)',
    facts: [
      { label: 'Iuran mandiri Kelas I', value: 'Rp150.000', note: 'per orang per bulan · Perpres 64/2020' },
      { label: 'Iuran mandiri Kelas II', value: 'Rp100.000', note: 'per orang per bulan · Perpres 64/2020' },
      {
        label: 'Iuran mandiri Kelas III',
        value: 'Rp35.000',
        note: 'dibayar peserta (iuran penuh Rp42.000, sisanya dibantu pemerintah) · Perpres 64/2020',
      },
      { label: 'Batas bayar iuran', value: 'Tanggal 10', note: 'setiap bulan' },
    ],
    notes: [
      'Berobat dimulai di FKTP tempat terdaftar (puskesmas/klinik/dokter keluarga). Kalau perlu, FKTP memberi rujukan ke rumah sakit.',
      'Di fasilitas kesehatan mitra, peserta aktif tidak mengajukan klaim — layanan sesuai hak dijamin langsung.',
      'Administrasi kepesertaan (daftar, ubah data, pindah kelas, aktifkan kembali) bisa lewat aplikasi Mobile JKN atau PANDAWA.',
    ],
    source: 'https://www.bpjs-kesehatan.go.id',
    readNote:
      'Disusun dari Perpres 64/2020 dan informasi layanan resmi BPJS Kesehatan. Cek angka terbaru di bpjs-kesehatan.go.id atau Mobile JKN.',
    readAt: READ,
    verified: true,
  },
  {
    key: 'allianz',
    name: 'Allianz Indonesia',
    initials: 'AZ',
    color: 'bg-blue-700',
    tags: ['Jiwa', 'Kesehatan', 'Umum'],
    website: 'https://www.allianz.co.id',
    phone: '1500136',
    phoneNote: 'Allianz Care (polis jiwa & kesehatan)',
    claimUrl: 'https://www.allianz.co.id/layanan/klaim.html',
    source: 'https://www.allianz.co.id/layanan/hubungi-kami.html',
    readAt: READ,
    verified: true,
  },
  {
    key: 'astralife',
    name: 'Astra Life',
    initials: 'AL',
    color: 'bg-sky-600',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.astralife.co.id',
    phone: '1500282',
    phoneNote: 'Contact Center · Senin–Minggu 24 jam',
    whatsapp: '089521500282',
    whatsappNote: 'Senin–Jumat 08.00–19.00 WIB, khusus informasi produk',
    claimUrl: 'https://www.astralife.co.id/layanan-klaim/',
    hospitalsUrl: 'https://www.astralife.co.id/rumah-sakit/',
    source: 'https://www.astralife.co.id/kontak/',
    readAt: READ,
    verified: true,
  },
  {
    key: 'avrist',
    name: 'Avrist Assurance',
    initials: 'AV',
    color: 'bg-violet-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.avrist.com',
    phone: '02157898188',
    phoneNote: 'Layanan Nasabah',
    hours: 'Senin–Jumat 08.00–17.00 WIB',
    claimUrl: 'https://www.avrist.com/klaim-layanan/klaim',
    source: 'https://www.avrist.com/hubungi-kami',
    readAt: READ,
    verified: true,
  },
  {
    key: 'axamandiri',
    name: 'AXA Mandiri',
    initials: 'AM',
    color: 'bg-indigo-800',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.axa-mandiri.co.id',
    phone: '1500803',
    phoneNote: 'Call Centre',
    whatsapp: '08158153313',
    whatsappNote: 'Pengajuan klaim',
    email: 'customer@axa-mandiri.co.id',
    claimUrl: 'https://www.axa-mandiri.co.id/pengajuan-klaim',
    source: 'https://www.axa-mandiri.co.id/hubungi-kami',
    readAt: READ,
    verified: true,
  },
  {
    key: 'equity',
    name: 'Equity Life Indonesia',
    initials: 'EQ',
    color: 'bg-green-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.equity.co.id',
    phone: '1500079',
    whatsapp: '08891500079',
    email: 'contact.center@equity.id',
    hours: 'Senin–Jumat 08.30–17.00 WIB',
    source: 'https://www.equity.co.id',
    readAt: READ,
    verified: true,
  },
  {
    key: 'fwd',
    name: 'FWD Insurance Indonesia',
    initials: 'FWD',
    color: 'bg-orange-500',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.fwd.co.id',
    phone: '1500525',
    whatsapp: '081119984109',
    source: 'https://www.fwd.co.id/id/',
    readAt: READ,
    verified: true,
  },
  {
    key: 'generali',
    name: 'Generali Indonesia',
    initials: 'GI',
    color: 'bg-red-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.generali.co.id',
    phone: '0211500037',
    phoneNote: 'Generali Care',
    whatsapp: '085813150037',
    whatsappNote: 'WA Jane',
    email: 'care@generali.co.id',
    hours: 'Senin–Jumat 08.00–17.00 WIB',
    claimUrl: 'https://www.generali.co.id/id/klaim-asuransi',
    hospitalsUrl: 'https://www.generali.co.id/id/rumah-sakit',
    source: 'https://www.generali.co.id/id/hubungi-kami',
    readAt: READ,
    verified: true,
  },
  {
    key: 'manulife',
    name: 'Manulife Indonesia',
    initials: 'MLI',
    color: 'bg-emerald-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.manulife.co.id',
    phone: '02125557777',
    phoneNote: 'Contact Center',
    hours: 'Senin–Jumat 08.00–17.00 WIB',
    claimUrl: 'https://www.manulife.co.id/id/layanan/layanan-klaim.html',
    source: 'https://www.manulife.co.id/id/hubungi-kami.html',
    readAt: READ,
    verified: true,
  },
  {
    key: 'prudential',
    name: 'Prudential Indonesia',
    initials: 'PRU',
    color: 'bg-rose-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.prudential.co.id',
    phone: '1500085',
    phoneNote: 'Customer Line',
    claimUrl: 'https://www.prudential.co.id/id/claims-and-services/',
    source: 'https://www.prudential.co.id/id/about-us/hubungi-kami/',
    readAt: READ,
    verified: true,
  },
  // Situs belum bisa dibaca otomatis — isi call center & cara klaim dari kartu polismu.
  {
    key: 'aia',
    name: 'AIA Indonesia',
    initials: 'AIA',
    color: 'bg-red-600',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.aia.co.id',
    verified: false,
  },
  {
    key: 'bnilife',
    name: 'BNI Life',
    initials: 'BNI',
    color: 'bg-orange-600',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.bni-life.co.id',
    verified: false,
  },
  {
    key: 'brilife',
    name: 'BRI Life',
    initials: 'BRI',
    color: 'bg-blue-600',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.brilife.co.id',
    verified: false,
  },
  {
    key: 'chubb',
    name: 'Chubb Life Indonesia',
    initials: 'CL',
    color: 'bg-slate-900',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.chubb.com/id-id/',
    verified: false,
  },
  {
    key: 'greateastern',
    name: 'Great Eastern Life Indonesia',
    initials: 'GE',
    color: 'bg-red-800',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.greateasternlife.com/id/id.html',
    verified: false,
  },
  {
    key: 'inhealth',
    name: 'Mandiri Inhealth',
    initials: 'IH',
    color: 'bg-sky-800',
    tags: ['Kesehatan'],
    website: 'https://www.inhealth.co.id',
    verified: false,
  },
  {
    key: 'msig',
    name: 'MSIG Life',
    initials: 'MS',
    color: 'bg-rose-600',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.msiglife.co.id',
    verified: false,
  },
  {
    key: 'panin',
    name: 'Panin Dai-ichi Life',
    initials: 'PD',
    color: 'bg-cyan-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.panindai-ichilife.co.id',
    verified: false,
  },
  {
    key: 'sequis',
    name: 'Sequis',
    initials: 'SQ',
    color: 'bg-teal-700',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.sequis.co.id',
    verified: false,
  },
  {
    key: 'sinarmas',
    name: 'Asuransi Sinar Mas',
    initials: 'SM',
    color: 'bg-red-500',
    tags: ['Umum', 'Kesehatan'],
    website: 'https://www.sinarmas.co.id',
    verified: false,
  },
  {
    key: 'sunlife',
    name: 'Sun Life Indonesia',
    initials: 'SL',
    color: 'bg-amber-500',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.sunlife.co.id',
    verified: false,
  },
  {
    key: 'tokiomarine',
    name: 'Tokio Marine Life Indonesia',
    initials: 'TM',
    color: 'bg-blue-900',
    tags: ['Jiwa', 'Kesehatan'],
    website: 'https://www.tokiomarine-life.co.id',
    verified: false,
  },
  {
    key: 'zurich',
    name: 'Zurich Indonesia',
    initials: 'ZI',
    color: 'bg-blue-800',
    tags: ['Jiwa', 'Umum'],
    website: 'https://www.zurich.co.id',
    verified: false,
  },
];

export const insurerByKey = (key: string | null | undefined) => INSURERS.find((i) => i.key === key) ?? null;
export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
export const waHref = (n: string) => `https://wa.me/${n.replace(/\D/g, '').replace(/^0/, '62')}`;
export const prettyPhone = (n: string) => {
  const d = n.replace(/\D/g, '');
  if (/^1500\d{3}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (/^021\d+$/.test(d)) return `(021) ${d.slice(3, 7)} ${d.slice(7)}`.trim();
  if (/^08\d+$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`.trim();
  return n;
};
