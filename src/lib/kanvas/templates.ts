import { rp, short, type Metrics } from '@/lib/kanvas/data';

// Template Kanvas. Isi bersifat panduan umum, bukan nasihat keuangan pribadi; angka acuan regulasi
// diberi sumber singkat. Id kartu/item dipakai sebagai kunci jawaban tersimpan — JANGAN diganti
// setelah rilis (jawaban user lama akan hilang dari kartunya).

export type Ctx = { m: Metrics; n: Record<string, number>; done: Record<string, true> };
export type Calc = { value: string; note?: string; tone?: 'good' | 'warn' | 'bad' };
export type Unit = 'rp' | 'bulan' | 'tahun' | 'persen' | 'kali';

export type Card =
  | { kind: 'data'; id: string; label: string; get: (m: Metrics) => string; note?: (m: Metrics) => string }
  | { kind: 'tanya'; id: string; q: string; hint?: string }
  | { kind: 'angka'; id: string; label: string; unit: Unit; hint?: string; suggest?: (m: Metrics) => number | null }
  | { kind: 'hitung'; id: string; label: string; calc: (c: Ctx) => Calc | null }
  | { kind: 'cek'; id: string; title: string; items: { id: string; text: string }[] }
  | { kind: 'tugas'; id: string; title: string; items: { id: string; text: string }[] }
  | { kind: 'tabel'; id: string; table: 'neraca' | 'aruskas' | 'utang' }
  | { kind: 'info'; id: string; text: string; source?: string };

export type Chapter = { id: string; title: string; emoji: string; color: Color; cards: Card[] };
export type Color = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'teal';
export type Template = {
  id: TemplateId;
  title: string;
  emoji: string;
  tagline: string;
  color: Color;
  chapters: Chapter[];
  goal?: (c: Ctx) => Calc | null; // ringkasan utama di kartu akhir
};
export type TemplateId = 'nikah' | 'darurat' | 'rumah' | 'pensiun' | 'pendidikan' | 'lunas-utang' | 'usaha' | 'kosong';

// ── Rumus ──────────────────────────────────────────────────────────────────
export const pmt = (loan: number, ratePct: number, months: number) => {
  if (loan <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  return r === 0 ? loan / months : (loan * r) / (1 - (1 + r) ** -months);
};
export const futureValue = (now: number, ratePct: number, years: number) => now * (1 + ratePct / 100) ** years;
// Setoran bulanan agar mencapai target dalam n bulan dengan imbal hasil tahunan r%.
export const monthlyToReach = (target: number, months: number, returnPct: number) => {
  if (target <= 0) return 0;
  if (months <= 0) return target;
  const r = returnPct / 100 / 12;
  return r === 0 ? target / months : (target * r) / ((1 + r) ** months - 1);
};
const num = (c: Ctx, k: string) => (Number.isFinite(c.n[k]) ? c.n[k] : 0);
const has = (c: Ctx, ...k: string[]) => k.every((x) => Number.isFinite(c.n[x]) && c.n[x] > 0);
const months = (x: number) =>
  x >= 24 ? `${(x / 12).toLocaleString('id-ID', { maximumFractionDigits: 1 })} tahun` : `${Math.ceil(x)} bulan`;

// Kartu data yang dipakai banyak template.
const D = {
  income: {
    kind: 'data',
    id: 'd-income',
    label: 'Pemasukan rata-rata / bulan',
    get: (m) => rp(m.incomeAvg),
    note: (m) => (m.months ? `${m.months} bulan terakhir` : 'belum ada catatan bulan penuh'),
  },
  expense: {
    kind: 'data',
    id: 'd-expense',
    label: 'Pengeluaran rata-rata / bulan',
    get: (m) => rp(m.expenseAvg),
    note: (m) => (m.topExpenses[0] ? `terbesar: ${m.topExpenses[0].name} ${short(m.topExpenses[0].avg)}` : ''),
  },
  left: {
    kind: 'data',
    id: 'd-left',
    label: 'Sisa rata-rata / bulan',
    get: (m) => rp(m.leftAvg),
    note: (m) => (m.saveRate === null ? '' : `${Math.round(m.saveRate * 100)}% dari pemasukan`),
  },
  liquid: {
    kind: 'data',
    id: 'd-liquid',
    label: 'Kas + tabungan',
    get: (m) => rp(m.liquid),
    note: (m) =>
      m.emergencyMonths === null
        ? ''
        : `cukup ±${m.emergencyMonths.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan pengeluaran`,
  },
  net: {
    kind: 'data',
    id: 'd-net',
    label: 'Harta bersih',
    get: (m) => rp(m.net),
    note: (m) => `aset ${short(m.assets)} − utang ${short(m.liabilities)}`,
  },
  debt: {
    kind: 'data',
    id: 'd-debt',
    label: 'Total utang & tagihan kartu',
    get: (m) => rp(m.liabilities),
    note: (m) => (m.debts.length ? `${m.debts.length} pos utang` : 'tidak ada utang tercatat 🎉'),
  },
  invest: { kind: 'data', id: 'd-invest', label: 'Investasi', get: (m) => rp(m.investments) },
} satisfies Record<string, Card>;

const OJK: Card = {
  kind: 'info',
  id: 'i-ojk',
  text: 'Cek izin lembaga keuangan di Kontak OJK 157 (telepon) atau WhatsApp 081-157-157-157. Tawaran imbal hasil tinggi tanpa risiko = tanda bahaya.',
  source: 'OJK',
};
const LPS: Card = {
  kind: 'info',
  id: 'i-lps',
  text: 'Simpanan di bank peserta LPS dijamin sampai Rp2 miliar per nasabah per bank, selama bunganya tidak melebihi tingkat bunga penjaminan LPS.',
  source: 'LPS',
};

export const TEMPLATES: Template[] = [
  {
    id: 'nikah',
    title: 'Persiapan Nikah',
    emoji: '💍',
    tagline: 'Dari biaya acara sampai keuangan keluarga setelahnya',
    color: 'rose',
    chapters: [
      {
        id: 'b1',
        title: 'Kondisi kita sekarang',
        emoji: '🧭',
        color: 'indigo',
        cards: [
          D.income,
          D.expense,
          D.liquid,
          { kind: 'angka', id: 'n-partner-income', label: 'Pemasukan pasangan / bulan', unit: 'rp' },
          { kind: 'angka', id: 'n-partner-savings', label: 'Tabungan pasangan', unit: 'rp' },
          { kind: 'tanya', id: 'q-bawa-utang', q: 'Ada utang yang dibawa masing-masing? Sudah saling terbuka?' },
        ],
      },
      {
        id: 'b2',
        title: 'Mimpi pernikahan',
        emoji: '✨',
        color: 'rose',
        cards: [
          { kind: 'tanya', id: 'q-konsep', q: 'Konsep acara yang kalian mau? (akad saja, resepsi kecil, adat, dll.)' },
          { kind: 'angka', id: 'n-budget', label: 'Anggaran total acara', unit: 'rp' },
          { kind: 'angka', id: 'n-bulan', label: 'Berapa bulan lagi?', unit: 'bulan' },
          { kind: 'angka', id: 'n-siap', label: 'Dana yang sudah disisihkan (berdua)', unit: 'rp' },
          {
            kind: 'hitung',
            id: 'h-nabung',
            label: 'Perlu disisihkan / bulan',
            calc: (c) => {
              if (!has(c, 'n-budget', 'n-bulan')) return null;
              const need = Math.max(0, num(c, 'n-budget') - num(c, 'n-siap'));
              const per = need / num(c, 'n-bulan');
              const room = c.m.leftAvg + num(c, 'n-partner-income') * 0.3;
              return {
                value: rp(per),
                note:
                  need === 0 ? 'Dana acara sudah cukup 🎉' : `kurang ${rp(need)} · sisa bulananmu ${rp(c.m.leftAvg)}`,
                tone: need === 0 || per <= c.m.leftAvg ? 'good' : per <= room ? 'warn' : 'bad',
              };
            },
          },
        ],
      },
      {
        id: 'b3',
        title: 'Rincian biaya',
        emoji: '🧾',
        color: 'amber',
        cards: [
          {
            kind: 'tugas',
            id: 't-biaya',
            title: 'Pos biaya yang perlu dihitung',
            items: [
              { id: 'venue', text: 'Tempat / gedung' },
              { id: 'katering', text: 'Katering' },
              { id: 'busana', text: 'Busana & rias' },
              { id: 'dekor', text: 'Dekorasi' },
              { id: 'dok', text: 'Foto & video' },
              { id: 'mahar', text: 'Cincin, mahar & seserahan' },
              { id: 'undangan', text: 'Undangan & suvenir' },
              { id: 'kua', text: 'Biaya pencatatan nikah' },
            ],
          },
          {
            kind: 'info',
            id: 'i-kua',
            text: 'Nikah di KUA pada hari & jam kerja tidak dipungut biaya; di luar KUA atau di luar jam kerja dikenai PNBP Rp600.000.',
            source: 'Kemenag (PNBP biaya nikah)',
          },
          {
            kind: 'tanya',
            id: 'q-prioritas',
            q: 'Kalau anggaran harus dipotong, pos mana yang paling bisa dikurangi?',
          },
        ],
      },
      {
        id: 'b4',
        title: 'Cek sebelum bayar',
        emoji: '🛡️',
        color: 'sky',
        cards: [
          {
            kind: 'cek',
            id: 'c-vendor',
            title: 'Vendor & pembayaran',
            items: [
              { id: 'kontrak', text: 'Ada kontrak tertulis: rincian, jadwal DP & pelunasan, aturan batal' },
              { id: 'ulasan', text: 'Alamat & ulasan vendor jelas, bukan hanya akun media sosial' },
              { id: 'rek', text: 'Transfer ke rekening atas nama usaha/pemilik yang sama dengan kontrak' },
              { id: 'pinjam', text: 'Kalau pakai pinjaman: lembaganya terdaftar & berizin OJK' },
            ],
          },
          OJK,
          LPS,
        ],
      },
      {
        id: 'b5',
        title: 'Keuangan keluarga',
        emoji: '🏡',
        color: 'emerald',
        cards: [
          { kind: 'tabel', id: 'tb-neraca', table: 'neraca' },
          { kind: 'tabel', id: 'tb-arus', table: 'aruskas' },
          { kind: 'tanya', id: 'q-sistem', q: 'Sistem kelola uang: digabung, dipisah, atau sebagian digabung?' },
          { kind: 'tanya', id: 'q-peran', q: 'Siapa yang bayar tagihan rutin, siapa yang pegang tabungan?' },
        ],
      },
      {
        id: 'b6',
        title: 'Proteksi',
        emoji: '☂️',
        color: 'teal',
        cards: [
          {
            kind: 'hitung',
            id: 'h-darurat',
            label: 'Target dana darurat keluarga (6× pengeluaran)',
            calc: (c) => {
              if (!c.m.expenseAvg) return null;
              const target = c.m.expenseAvg * 6;
              const have = c.m.liquid + num(c, 'n-partner-savings');
              return { value: rp(target), note: `sudah ada ${rp(have)}`, tone: have >= target ? 'good' : 'warn' };
            },
          },
          {
            kind: 'tugas',
            id: 't-proteksi',
            title: 'Lindungi keluarga baru',
            items: [
              { id: 'bpjs', text: 'BPJS Kesehatan: pindahkan ke satu Kartu Keluarga' },
              { id: 'jiwa', text: 'Asuransi jiwa untuk pencari nafkah (kalau ada tanggungan)' },
              { id: 'waris', text: 'Perbarui ahli waris di rekening, asuransi & BPJS Ketenagakerjaan' },
            ],
          },
        ],
      },
      {
        id: 'b7',
        title: 'Setelah menikah',
        emoji: '📋',
        color: 'violet',
        cards: [
          {
            kind: 'tugas',
            id: 't-admin',
            title: 'Administrasi',
            items: [
              { id: 'kk', text: 'Urus Kartu Keluarga baru & perubahan status KTP' },
              { id: 'npwp', text: 'Tentukan pajak: satu NPWP keluarga atau masing-masing (pisah harta)' },
              { id: 'perjanjian', text: 'Diskusikan perjanjian perkawinan kalau diperlukan' },
            ],
          },
          { kind: 'tanya', id: 'q-mimpi', q: 'Tiga mimpi keuangan kalian 5 tahun ke depan?' },
        ],
      },
    ],
    goal: (c) => {
      if (!has(c, 'n-budget', 'n-bulan')) return null;
      const need = Math.max(0, num(c, 'n-budget') - num(c, 'n-siap'));
      const per = need / num(c, 'n-bulan');
      return {
        tone:
          need === 0 || per <= c.m.leftAvg
            ? 'good'
            : per <= c.m.leftAvg + num(c, 'n-partner-income') * 0.3
              ? 'warn'
              : 'bad',
        value: `${rp(per)}/bulan`,
        note: `selama ${num(c, 'n-bulan')} bulan untuk acara ${rp(num(c, 'n-budget'))}`,
      };
    },
  },
  {
    id: 'darurat',
    title: 'Dana Darurat',
    emoji: '🛟',
    tagline: 'Bantalan saat kena PHK, sakit, atau kejadian mendadak',
    color: 'teal',
    chapters: [
      {
        id: 'b1',
        title: 'Pengeluaran wajibmu',
        emoji: '🧾',
        color: 'indigo',
        cards: [
          D.expense,
          {
            kind: 'angka',
            id: 'n-wajib',
            label: 'Pengeluaran wajib / bulan',
            unit: 'rp',
            hint: 'makan, tempat tinggal, cicilan, transport, tagihan — tanpa jajan & hiburan',
            suggest: (m) => (m.expenseAvg ? Math.round((m.expenseAvg * 0.7) / 10000) * 10000 : null),
          },
        ],
      },
      {
        id: 'b2',
        title: 'Berapa yang cukup?',
        emoji: '🎯',
        color: 'rose',
        cards: [
          {
            kind: 'info',
            id: 'i-kali',
            text: 'Acuan umum: lajang 3–6×, menikah 6–9×, punya anak 9–12× pengeluaran wajib. Penghasilan tidak tetap? Pilih angka yang lebih tinggi.',
          },
          { kind: 'angka', id: 'n-kali', label: 'Target berapa kali pengeluaran?', unit: 'kali', suggest: () => 6 },
          {
            kind: 'hitung',
            id: 'h-target',
            label: 'Target dana darurat',
            calc: (c) => {
              const wajib = num(c, 'n-wajib') || c.m.expenseAvg;
              if (!wajib) return null;
              const target = wajib * (num(c, 'n-kali') || 6);
              return {
                value: rp(target),
                note: `sudah ada ${rp(c.m.liquid)} (kas + tabungan)`,
                tone: c.m.liquid >= target ? 'good' : 'warn',
              };
            },
          },
        ],
      },
      {
        id: 'b3',
        title: 'Rencana mengisi',
        emoji: '🪣',
        color: 'emerald',
        cards: [
          D.left,
          {
            kind: 'angka',
            id: 'n-setor',
            label: 'Setoran per bulan',
            unit: 'rp',
            suggest: (m) => (m.leftAvg > 0 ? Math.round((m.leftAvg * 0.5) / 10000) * 10000 : null),
          },
          {
            kind: 'hitung',
            id: 'h-lama',
            label: 'Tercapai dalam',
            calc: (c) => {
              const wajib = num(c, 'n-wajib') || c.m.expenseAvg;
              if (!wajib || !has(c, 'n-setor')) return null;
              const gap = Math.max(0, wajib * (num(c, 'n-kali') || 6) - c.m.liquid);
              if (!gap) return { value: 'Sudah tercapai 🎉', tone: 'good' };
              const n = gap / num(c, 'n-setor');
              return { value: months(n), note: `kurang ${rp(gap)}`, tone: n <= 24 ? 'good' : 'warn' };
            },
          },
        ],
      },
      {
        id: 'b4',
        title: 'Simpan di mana',
        emoji: '🏦',
        color: 'sky',
        cards: [
          {
            kind: 'cek',
            id: 'c-tempat',
            title: 'Syarat tempat dana darurat',
            items: [
              { id: 'cair', text: 'Bisa dicairkan dalam 1–2 hari kerja' },
              { id: 'pisah', text: 'Terpisah dari rekening belanja harian' },
              { id: 'aman', text: 'Bank peserta LPS, atau reksa dana pasar uang dari manajer investasi berizin OJK' },
              { id: 'bukan', text: 'Bukan saham, kripto, atau barang yang nilainya naik-turun' },
            ],
          },
          LPS,
          OJK,
        ],
      },
      {
        id: 'b5',
        title: 'Aturan pakai',
        emoji: '📜',
        color: 'violet',
        cards: [
          { kind: 'tanya', id: 'q-darurat', q: 'Apa saja yang kamu anggap darurat? (dan yang bukan)' },
          { kind: 'tanya', id: 'q-isi-ulang', q: 'Kalau terpakai, bagaimana cara mengisinya kembali?' },
        ],
      },
    ],
    goal: (c) => {
      const wajib = num(c, 'n-wajib') || c.m.expenseAvg;
      if (!wajib) return null;
      const target = wajib * (num(c, 'n-kali') || 6);
      const pct = Math.min(100, Math.round((c.m.liquid / target) * 100));
      return {
        value: `${pct}% terkumpul`,
        note: `${rp(c.m.liquid)} dari ${rp(target)}`,
        tone: pct >= 100 ? 'good' : 'warn',
      };
    },
  },
  {
    id: 'rumah',
    title: 'Beli Rumah (KPR)',
    emoji: '🏠',
    tagline: 'Hitung DP, cicilan, dan biaya yang sering terlupa',
    color: 'emerald',
    chapters: [
      {
        id: 'b1',
        title: 'Kemampuanmu',
        emoji: '🧭',
        color: 'indigo',
        cards: [
          D.income,
          D.debt,
          {
            kind: 'angka',
            id: 'n-partner-income',
            label: 'Pemasukan pasangan / bulan (kalau joint income)',
            unit: 'rp',
          },
          {
            kind: 'hitung',
            id: 'h-maks',
            label: 'Cicilan aman maksimal (±30% pemasukan)',
            calc: (c) => {
              const inc = c.m.incomeAvg + num(c, 'n-partner-income');
              if (!inc) return null;
              return { value: rp(inc * 0.3), note: 'acuan umum bank; cicilan lain ikut dihitung' };
            },
          },
        ],
      },
      {
        id: 'b2',
        title: 'Rumah incaran',
        emoji: '🏡',
        color: 'emerald',
        cards: [
          { kind: 'tanya', id: 'q-lokasi', q: 'Lokasi & tipe rumah yang dicari? Seberapa dekat ke kantor/sekolah?' },
          { kind: 'angka', id: 'n-harga', label: 'Harga rumah', unit: 'rp' },
          { kind: 'angka', id: 'n-dp', label: 'Uang muka (DP)', unit: 'persen', suggest: () => 20 },
          { kind: 'angka', id: 'n-tenor', label: 'Tenor', unit: 'tahun', suggest: () => 15 },
          {
            kind: 'angka',
            id: 'n-bunga',
            label: 'Perkiraan bunga setelah masa promo',
            unit: 'persen',
            suggest: () => 10,
          },
        ],
      },
      {
        id: 'b3',
        title: 'Hitungan KPR',
        emoji: '🧮',
        color: 'amber',
        cards: [
          {
            kind: 'hitung',
            id: 'h-dp',
            label: 'Uang muka',
            calc: (c) => (has(c, 'n-harga') ? { value: rp((num(c, 'n-harga') * (num(c, 'n-dp') || 0)) / 100) } : null),
          },
          {
            kind: 'hitung',
            id: 'h-cicilan',
            label: 'Cicilan per bulan (bunga floating)',
            calc: (c) => {
              if (!has(c, 'n-harga', 'n-tenor')) return null;
              const loan = num(c, 'n-harga') * (1 - (num(c, 'n-dp') || 0) / 100);
              const pay = pmt(loan, num(c, 'n-bunga') || 10, num(c, 'n-tenor') * 12);
              const inc = c.m.incomeAvg + num(c, 'n-partner-income');
              const ratio = inc ? pay / inc : null;
              return {
                value: rp(pay),
                note:
                  ratio === null
                    ? `pinjaman ${rp(loan)}`
                    : `${Math.round(ratio * 100)}% dari pemasukan · pinjaman ${short(loan)}`,
                tone: ratio === null ? undefined : ratio <= 0.3 ? 'good' : ratio <= 0.4 ? 'warn' : 'bad',
              };
            },
          },
          {
            kind: 'hitung',
            id: 'h-ekstra',
            label: 'Siapkan biaya tambahan (±5–10% harga)',
            calc: (c) =>
              has(c, 'n-harga')
                ? {
                    value: `${rp(num(c, 'n-harga') * 0.05)} – ${rp(num(c, 'n-harga') * 0.1)}`,
                    note: 'BPHTB, notaris/PPAT, provisi, appraisal, asuransi',
                  }
                : null,
          },
          {
            kind: 'info',
            id: 'i-promo',
            text: 'Bunga promo biasanya hanya 1–5 tahun pertama. Hitung cicilan dengan bunga floating supaya tidak kaget.',
          },
        ],
      },
      {
        id: 'b4',
        title: 'Cek legalitas',
        emoji: '🛡️',
        color: 'sky',
        cards: [
          {
            kind: 'cek',
            id: 'c-legal',
            title: 'Sebelum tanda tangan',
            items: [
              { id: 'sertif', text: 'Sertifikat jelas (SHM/SHGB) & dicek di BPN/notaris' },
              { id: 'pbg', text: 'Izin bangunan (PBG/IMB) ada' },
              { id: 'slik', text: 'Cek riwayat kreditmu sendiri di SLIK OJK (iDebKu) sebelum mengajukan' },
              { id: 'dev', text: 'Developer punya rekam jejak; pembayaran ke rekening resmi' },
            ],
          },
          OJK,
        ],
      },
      {
        id: 'b5',
        title: 'Rencana DP',
        emoji: '🪙',
        color: 'violet',
        cards: [
          D.liquid,
          { kind: 'angka', id: 'n-bulan', label: 'Target beli berapa bulan lagi?', unit: 'bulan' },
          {
            kind: 'hitung',
            id: 'h-nabung',
            label: 'Nabung DP + biaya per bulan',
            calc: (c) => {
              if (!has(c, 'n-harga', 'n-bulan')) return null;
              const need = num(c, 'n-harga') * ((num(c, 'n-dp') || 0) / 100 + 0.07) - c.m.liquid;
              if (need <= 0) return { value: 'Dana DP sudah cukup 🎉', tone: 'good' };
              const per = need / num(c, 'n-bulan');
              return { value: rp(per), note: `kurang ${rp(need)}`, tone: per <= c.m.leftAvg ? 'good' : 'warn' };
            },
          },
        ],
      },
    ],
    goal: (c) => {
      if (!has(c, 'n-harga', 'n-tenor')) return null;
      const loan = num(c, 'n-harga') * (1 - (num(c, 'n-dp') || 0) / 100);
      return {
        value: `${rp(pmt(loan, num(c, 'n-bunga') || 10, num(c, 'n-tenor') * 12))}/bulan`,
        note: `rumah ${rp(num(c, 'n-harga'))}, tenor ${num(c, 'n-tenor')} tahun`,
      };
    },
  },
  {
    id: 'pensiun',
    title: 'Pensiun',
    emoji: '🌴',
    tagline: 'Berapa yang perlu dikumpulkan supaya tetap tenang nanti',
    color: 'amber',
    chapters: [
      {
        id: 'b1',
        title: 'Hari ini',
        emoji: '🧭',
        color: 'indigo',
        cards: [
          D.expense,
          D.invest,
          { kind: 'angka', id: 'n-usia', label: 'Usiamu sekarang', unit: 'tahun' },
          { kind: 'angka', id: 'n-pensiun', label: 'Mau pensiun di usia', unit: 'tahun', suggest: () => 55 },
        ],
      },
      {
        id: 'b2',
        title: 'Gaya hidup nanti',
        emoji: '🌅',
        color: 'amber',
        cards: [
          { kind: 'tanya', id: 'q-gaya', q: 'Mau pensiun seperti apa? (tinggal di mana, kegiatan, tanggungan)' },
          {
            kind: 'angka',
            id: 'n-biaya',
            label: 'Biaya hidup / bulan (nilai hari ini)',
            unit: 'rp',
            suggest: (m) => (m.expenseAvg ? Math.round((m.expenseAvg * 0.8) / 10000) * 10000 : null),
          },
          { kind: 'angka', id: 'n-inflasi', label: 'Asumsi inflasi / tahun', unit: 'persen', suggest: () => 4 },
        ],
      },
      {
        id: 'b3',
        title: 'Dana yang dibutuhkan',
        emoji: '🧮',
        color: 'emerald',
        cards: [
          {
            kind: 'hitung',
            id: 'h-nanti',
            label: 'Biaya hidup / bulan saat pensiun',
            calc: (c) => {
              if (!has(c, 'n-usia', 'n-pensiun', 'n-biaya')) return null;
              const yrs = Math.max(0, num(c, 'n-pensiun') - num(c, 'n-usia'));
              return {
                value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 4, yrs)),
                note: `${yrs} tahun lagi, karena inflasi`,
              };
            },
          },
          {
            kind: 'hitung',
            id: 'h-dana',
            label: 'Dana pensiun (aturan 4%: 25× biaya setahun)',
            calc: (c) => {
              if (!has(c, 'n-usia', 'n-pensiun', 'n-biaya')) return null;
              const yrs = Math.max(0, num(c, 'n-pensiun') - num(c, 'n-usia'));
              return {
                value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 4, yrs) * 12 * 25),
                note: 'acuan kasar; diskusikan dengan perencana keuangan',
              };
            },
          },
        ],
      },
      {
        id: 'b4',
        title: 'Cara mengumpulkan',
        emoji: '📈',
        color: 'violet',
        cards: [
          {
            kind: 'angka',
            id: 'n-return',
            label: 'Asumsi imbal hasil investasi / tahun',
            unit: 'persen',
            suggest: () => 7,
          },
          {
            kind: 'hitung',
            id: 'h-setor',
            label: 'Investasi rutin per bulan',
            calc: (c) => {
              if (!has(c, 'n-usia', 'n-pensiun', 'n-biaya')) return null;
              const yrs = Math.max(1, num(c, 'n-pensiun') - num(c, 'n-usia'));
              const target = futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 4, yrs) * 12 * 25;
              const grown = futureValue(c.m.investments, num(c, 'n-return') || 7, yrs);
              const per = monthlyToReach(Math.max(0, target - grown), yrs * 12, num(c, 'n-return') || 7);
              return {
                value: rp(per),
                note: `investasimu sekarang tumbuh jadi ±${short(grown)}`,
                tone: per <= c.m.leftAvg ? 'good' : 'warn',
              };
            },
          },
          {
            kind: 'cek',
            id: 'c-pilar',
            title: 'Pilar dana pensiun',
            items: [
              { id: 'jht', text: 'Cek saldo JHT & Jaminan Pensiun di aplikasi JMO (BPJS Ketenagakerjaan)' },
              { id: 'dplk', text: 'Pertimbangkan DPLK / program pensiun kantor' },
              { id: 'izin', text: 'Produk investasi dari lembaga berizin OJK' },
            ],
          },
          OJK,
        ],
      },
    ],
    goal: (c) => {
      if (!has(c, 'n-usia', 'n-pensiun', 'n-biaya')) return null;
      const yrs = Math.max(0, num(c, 'n-pensiun') - num(c, 'n-usia'));
      return {
        value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 4, yrs) * 12 * 25),
        note: `target di usia ${num(c, 'n-pensiun')}`,
      };
    },
  },
  {
    id: 'pendidikan',
    title: 'Dana Pendidikan Anak',
    emoji: '🎓',
    tagline: 'Biaya sekolah naik tiap tahun — mulai lebih awal lebih ringan',
    color: 'sky',
    chapters: [
      {
        id: 'b1',
        title: 'Jenjang yang disiapkan',
        emoji: '🏫',
        color: 'indigo',
        cards: [
          { kind: 'tanya', id: 'q-jenjang', q: 'Untuk jenjang apa & sekolah/kampus mana yang diincar?' },
          { kind: 'angka', id: 'n-biaya', label: 'Biaya masuk + tahun pertama (harga hari ini)', unit: 'rp' },
          { kind: 'angka', id: 'n-tahun', label: 'Dibutuhkan berapa tahun lagi?', unit: 'tahun' },
        ],
      },
      {
        id: 'b2',
        title: 'Kenaikan biaya',
        emoji: '📈',
        color: 'amber',
        cards: [
          {
            kind: 'angka',
            id: 'n-inflasi',
            label: 'Asumsi kenaikan biaya pendidikan / tahun',
            unit: 'persen',
            suggest: () => 10,
          },
          {
            kind: 'hitung',
            id: 'h-nanti',
            label: 'Perkiraan biaya saat dibutuhkan',
            calc: (c) =>
              has(c, 'n-biaya', 'n-tahun')
                ? { value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 10, num(c, 'n-tahun'))) }
                : null,
          },
        ],
      },
      {
        id: 'b3',
        title: 'Rencana menabung',
        emoji: '🪙',
        color: 'emerald',
        cards: [
          D.left,
          { kind: 'angka', id: 'n-siap', label: 'Dana yang sudah ada', unit: 'rp' },
          { kind: 'angka', id: 'n-return', label: 'Asumsi imbal hasil / tahun', unit: 'persen', suggest: () => 6 },
          {
            kind: 'hitung',
            id: 'h-setor',
            label: 'Setoran per bulan',
            calc: (c) => {
              if (!has(c, 'n-biaya', 'n-tahun')) return null;
              const yrs = num(c, 'n-tahun');
              const target = futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 10, yrs);
              const grown = futureValue(num(c, 'n-siap'), num(c, 'n-return') || 6, yrs);
              const per = monthlyToReach(Math.max(0, target - grown), yrs * 12, num(c, 'n-return') || 6);
              return { value: rp(per), tone: per <= c.m.leftAvg ? 'good' : 'warn', note: `selama ${yrs} tahun` };
            },
          },
        ],
      },
      {
        id: 'b4',
        title: 'Cek produk',
        emoji: '🛡️',
        color: 'sky',
        cards: [
          {
            kind: 'cek',
            id: 'c-produk',
            title: 'Sebelum memilih produk',
            items: [
              { id: 'pisah', text: 'Rekening/produk khusus, terpisah dari tabungan lain' },
              { id: 'izin', text: 'Lembaga & produknya terdaftar di OJK' },
              {
                id: 'biaya',
                text: 'Paham biaya & aturan pencairan (asuransi pendidikan/unit link sering berbiaya tinggi)',
              },
            ],
          },
          OJK,
        ],
      },
    ],
    goal: (c) => {
      if (!has(c, 'n-biaya', 'n-tahun')) return null;
      return {
        value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 10, num(c, 'n-tahun'))),
        note: `dalam ${num(c, 'n-tahun')} tahun`,
      };
    },
  },
  {
    id: 'lunas-utang',
    title: 'Lunas Utang',
    emoji: '⛓️',
    tagline: 'Urutkan, bayar, dan jangan gali lubang tutup lubang',
    color: 'violet',
    chapters: [
      {
        id: 'b1',
        title: 'Peta utangmu',
        emoji: '🗺️',
        color: 'indigo',
        cards: [D.debt, { kind: 'tabel', id: 'tb-utang', table: 'utang' }, D.left],
      },
      {
        id: 'b2',
        title: 'Pilih strategi',
        emoji: '♟️',
        color: 'amber',
        cards: [
          {
            kind: 'info',
            id: 'i-strategi',
            text: 'Bola salju: lunasi yang saldonya paling kecil dulu (cepat terasa menang). Longsoran: lunasi yang bunganya paling tinggi dulu (paling hemat bunga).',
          },
          { kind: 'tanya', id: 'q-strategi', q: 'Strategi mana yang kamu pilih, dan utang mana yang pertama?' },
        ],
      },
      {
        id: 'b3',
        title: 'Rencana bayar',
        emoji: '🧮',
        color: 'emerald',
        cards: [
          {
            kind: 'angka',
            id: 'n-bayar',
            label: 'Total bisa dibayar per bulan',
            unit: 'rp',
            suggest: (m) => (m.leftAvg > 0 ? Math.round(m.leftAvg / 10000) * 10000 : null),
          },
          {
            kind: 'hitung',
            id: 'h-lunas',
            label: 'Perkiraan lunas (tanpa bunga)',
            calc: (c) => {
              if (!c.m.liabilities || !has(c, 'n-bayar')) return null;
              const n = c.m.liabilities / num(c, 'n-bayar');
              return {
                value: months(n),
                note: 'bunga membuatnya lebih lama — bayar di atas minimum',
                tone: n <= 24 ? 'good' : 'warn',
              };
            },
          },
        ],
      },
      {
        id: 'b4',
        title: 'Rem & pagar',
        emoji: '🛑',
        color: 'rose',
        cards: [
          {
            kind: 'cek',
            id: 'c-rem',
            title: 'Selama melunasi',
            items: [
              { id: 'stop', text: 'Tidak menambah utang konsumtif baru' },
              { id: 'pinjol', text: 'Hindari pinjol ilegal — cek daftar berizin di OJK' },
              { id: 'nego', text: 'Kalau berat, ajukan restrukturisasi ke pemberi pinjaman' },
              { id: 'slik', text: 'Cek SLIK OJK (iDebKu) agar tahu semua catatan kreditmu' },
            ],
          },
          OJK,
          {
            kind: 'tugas',
            id: 't-rutin',
            title: 'Kebiasaan',
            items: [
              { id: 'auto', text: 'Atur pembayaran otomatis tepat setelah gajian' },
              { id: 'catat', text: 'Catat setiap pembayaran di Leosiqra' },
            ],
          },
        ],
      },
    ],
    goal: (c) => ({
      value: rp(c.m.liabilities),
      note: c.m.liabilities ? 'sisa utang tercatat' : 'Bebas utang 🎉',
      tone: c.m.liabilities ? 'warn' : 'good',
    }),
  },
  {
    id: 'usaha',
    title: 'Mulai Usaha',
    emoji: '🏪',
    tagline: 'Modal, titik impas, dan memisahkan uang usaha',
    color: 'indigo',
    chapters: [
      {
        id: 'b1',
        title: 'Ide usaha',
        emoji: '💡',
        color: 'amber',
        cards: [
          { kind: 'tanya', id: 'q-ide', q: 'Jual apa, ke siapa, dan kenapa mereka beli darimu?' },
          { kind: 'tanya', id: 'q-uji', q: 'Bagaimana cara menguji idenya dengan modal kecil dulu?' },
        ],
      },
      {
        id: 'b2',
        title: 'Modal',
        emoji: '🧰',
        color: 'emerald',
        cards: [
          D.liquid,
          { kind: 'angka', id: 'n-modal', label: 'Modal awal (alat, stok, izin)', unit: 'rp' },
          { kind: 'angka', id: 'n-tetap', label: 'Biaya tetap / bulan (sewa, gaji, listrik)', unit: 'rp' },
          {
            kind: 'hitung',
            id: 'h-aman',
            label: 'Modal + cadangan 6 bulan biaya tetap',
            calc: (c) =>
              has(c, 'n-modal')
                ? { value: rp(num(c, 'n-modal') + num(c, 'n-tetap') * 6), note: 'jangan pakai dana darurat pribadi' }
                : null,
          },
        ],
      },
      {
        id: 'b3',
        title: 'Titik impas',
        emoji: '⚖️',
        color: 'sky',
        cards: [
          { kind: 'angka', id: 'n-harga', label: 'Harga jual per unit', unit: 'rp' },
          { kind: 'angka', id: 'n-hpp', label: 'Modal (HPP) per unit', unit: 'rp' },
          {
            kind: 'hitung',
            id: 'h-bep',
            label: 'Unit terjual per bulan agar impas',
            calc: (c) => {
              if (!has(c, 'n-harga', 'n-hpp', 'n-tetap')) return null;
              const margin = num(c, 'n-harga') - num(c, 'n-hpp');
              if (margin <= 0) return { value: 'Harga jual di bawah modal', tone: 'bad' };
              return {
                value: `${Math.ceil(num(c, 'n-tetap') / margin).toLocaleString('id-ID')} unit`,
                note: `untung kotor ${rp(margin)} per unit`,
              };
            },
          },
        ],
      },
      {
        id: 'b4',
        title: 'Rapi sejak awal',
        emoji: '🗂️',
        color: 'violet',
        cards: [
          {
            kind: 'tugas',
            id: 't-rapi',
            title: 'Langkah awal',
            items: [
              { id: 'rek', text: 'Rekening terpisah untuk usaha' },
              { id: 'nib', text: 'Daftar NIB lewat OSS (gratis)' },
              { id: 'gaji', text: 'Gaji dirimu sendiri dari usaha, jangan ambil acak' },
              { id: 'catat', text: 'Catat penjualan harian (Ladangku di Leosiqra)' },
            ],
          },
          {
            kind: 'info',
            id: 'i-pph',
            text: 'UMKM orang pribadi dengan omzet sampai Rp500 juta setahun tidak dikenai PPh final 0,5%; di atasnya ada aturan tarif & batas waktunya.',
            source: 'PP 55/2022',
          },
          OJK,
        ],
      },
    ],
    goal: (c) =>
      has(c, 'n-modal')
        ? { value: rp(num(c, 'n-modal') + num(c, 'n-tetap') * 6), note: 'modal + cadangan 6 bulan' }
        : null,
  },
  {
    id: 'kosong',
    title: 'Kanvas kosong',
    emoji: '🗒️',
    tagline: 'Mulai dari angka catatanmu, susun sendiri pakai catatan tempel',
    color: 'teal',
    chapters: [
      { id: 'b1', title: 'Dari catatanmu', emoji: '📒', color: 'indigo', cards: [D.income, D.expense, D.left, D.net] },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];

// Progres: tugas & cek dicentang + pertanyaan dijawab + angka diisi.
export function progressOf(
  t: Template,
  s: { answers: Record<string, string>; done: Record<string, true>; nums: Record<string, number> },
) {
  let total = 0;
  let got = 0;
  for (const ch of t.chapters)
    for (const c of ch.cards) {
      if (c.kind === 'tanya') {
        total++;
        if (s.answers[c.id]?.trim()) got++;
      } else if (c.kind === 'angka') {
        total++;
        if (Number.isFinite(s.nums[c.id])) got++;
      } else if (c.kind === 'cek' || c.kind === 'tugas') {
        for (const it of c.items) {
          total++;
          if (s.done[`${c.id}.${it.id}`]) got++;
        }
      }
    }
  return { total, got, pct: total ? Math.round((got / total) * 100) : 0 };
}
