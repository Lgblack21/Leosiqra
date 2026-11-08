import { rp, short, type Metrics } from '@/lib/kanvas/data';

// Template Kanvas v2: tiap papan = bab-bab berisi kartu ringkas yang dijawab lewat panel.
// Isi bersifat panduan umum, bukan nasihat keuangan pribadi. Acuan angka ditulis sebagai pedoman
// umum (bukan kutipan) kecuali sumbernya bisa dipastikan. Id kartu = kunci jawaban tersimpan —
// JANGAN diganti setelah rilis.

export type Ctx = { m: Metrics; n: Record<string, number>; a: Record<string, string>; done: Record<string, true> };
export type Calc = { value: string; note?: string; tone?: 'good' | 'warn' | 'bad' };
export type Status = 'aman' | 'waspada' | 'bahaya';
export type Unit = 'rp' | 'bulan' | 'tahun' | 'persen' | 'kali';
export type Link = { href: string; label: string };

export type Card =
  | {
      kind: 'data';
      id: string;
      label: string;
      desc: string;
      value: (m: Metrics) => number | null;
      needsMonth?: boolean;
      link?: Link;
    }
  | { kind: 'tanya'; id: string; q: string; why: string; options: string[]; link?: Link }
  | {
      kind: 'cek';
      id: string;
      label: string;
      desc: string;
      ref: string;
      calc: (m: Metrics) => { text: string; status: Status } | null;
      link?: Link;
    }
  | { kind: 'tugas'; id: string; label: string; why: string; link?: Link }
  | { kind: 'angka'; id: string; label: string; unit: Unit; why?: string; suggest?: (m: Metrics) => number | null }
  | { kind: 'hitung'; id: string; label: string; calc: (c: Ctx) => Calc | null }
  | { kind: 'info'; id: string; label: string; text: string; source?: string };

export type Color = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'teal';
export type Chapter = { id: string; title: string; emoji: string; cards: Card[] };
export type TableKind = 'aruskas' | 'neraca' | 'utang';
export type Saran = { text: string; href?: string; card?: string };
export type TemplateId = 'nikah' | 'darurat' | 'rumah' | 'pensiun' | 'pendidikan' | 'lunas-utang' | 'usaha' | 'kosong';
export type Template = {
  id: TemplateId;
  title: string;
  emoji: string;
  tagline: string;
  color: Color;
  start: string; // teks lingkaran "Mulai"
  finalTitle: string;
  chapters: Chapter[];
  tables?: { id: string; kind: TableKind; after: string }[];
  goal?: (c: Ctx) => Calc | null;
  saran?: (c: Ctx) => Saran[];
};

// ── Rumus ──────────────────────────────────────────────────────────────────
export const pmt = (loan: number, ratePct: number, months: number) => {
  if (loan <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  return r === 0 ? loan / months : (loan * r) / (1 - (1 + r) ** -months);
};
export const futureValue = (now: number, ratePct: number, years: number) => now * (1 + ratePct / 100) ** years;
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
const pct = (x: number) => `${Math.round(x * 100)}%`;

// ── Tautan ke fitur lain ───────────────────────────────────────────────────
const L = {
  kekayaan: { href: '/membership/kekayaan', label: 'Buka Kekayaan' },
  cek: { href: '/membership/cek-keuangan', label: 'Buka Cek Keuangan' },
  sehat: { href: '/membership/sehat', label: 'Buka Sehatku' },
  rutin: { href: '/membership/recurring', label: 'Atur transaksi rutin' },
  bersama: { href: '/membership/dompet-bersama', label: 'Buka Dompet Bersama' },
  pajak: { href: '/membership/pajak-center', label: 'Buka Pajak Center' },
  transaksi: { href: '/membership/transactions', label: 'Lihat transaksi' },
} satisfies Record<string, Link>;

// ── Kartu bersama ──────────────────────────────────────────────────────────
export const CEK = {
  tabung: {
    kind: 'cek',
    id: 'c-tabung',
    label: 'Menabung rutin',
    desc: 'Pemasukan dikurangi pengeluaran (tanpa investasi), dibagi pemasukan.',
    ref: 'Pedoman umum: sisihkan minimal 10% penghasilan untuk menabung atau berinvestasi.',
    calc: (m) =>
      m.months && m.incomeAvg > 0
        ? {
            text: `${pct(m.leftAvg / m.incomeAvg)} dari pemasukan · minimal 10%`,
            status: m.leftAvg / m.incomeAvg >= 0.1 ? 'aman' : m.leftAvg >= 0 ? 'waspada' : 'bahaya',
          }
        : null,
    link: L.cek,
  },
  darurat: {
    kind: 'cek',
    id: 'c-darurat',
    label: 'Dana darurat',
    desc: 'Saldo rekening, dompet & uang elektronik (tanpa kartu kredit), tabungan, dan deposito di Kekayaan, dibagi pengeluaran sebulan.',
    ref: 'Pedoman umum: minimal 3× pengeluaran bulanan; 6× atau lebih kalau sudah berkeluarga atau penghasilan tidak tetap.',
    calc: (m) =>
      m.months && m.expenseAvg > 0
        ? {
            text: `${(m.liquid / m.expenseAvg).toLocaleString('id-ID', { maximumFractionDigits: 1 })}× pengeluaran · minimal 3×`,
            status: m.liquid / m.expenseAvg >= 3 ? 'aman' : m.liquid / m.expenseAvg >= 1 ? 'waspada' : 'bahaya',
          }
        : null,
    link: L.cek,
  },
  utang: {
    kind: 'cek',
    id: 'c-utang',
    label: 'Utang dibanding aset',
    desc: 'Utang di Kekayaan ditambah tagihan kartu kredit, dibagi semua aset di Kekayaan.',
    ref: 'Pedoman umum: total utang sebaiknya tidak lebih dari 50% total aset.',
    calc: (m) =>
      m.ready
        ? m.assets > 0
          ? {
              text: `${pct(m.liabilities / m.assets)} dari aset · maksimal 50%`,
              status: m.liabilities / m.assets <= 0.3 ? 'aman' : m.liabilities / m.assets <= 0.5 ? 'waspada' : 'bahaya',
            }
          : {
              text: m.liabilities ? 'Ada utang, belum ada aset tercatat' : 'Belum ada aset & utang tercatat',
              status: m.liabilities ? 'bahaya' : 'aman',
            }
        : null,
    link: L.cek,
  },
  cicilan: {
    kind: 'cek',
    id: 'c-cicilan',
    label: 'Cicilan dibanding pemasukan',
    desc: 'Rata-rata bayar utang & cicilan per bulan, dibagi pemasukan per bulan.',
    ref: 'Pedoman umum: total cicilan sebaiknya tidak lebih dari 30% pemasukan.',
    calc: (m) =>
      m.months && m.incomeAvg > 0
        ? {
            text: `${pct(m.split.cicilan / m.incomeAvg)} dari pemasukan · maksimal 30%`,
            status:
              m.split.cicilan / m.incomeAvg <= 0.3
                ? 'aman'
                : m.split.cicilan / m.incomeAvg <= 0.4
                  ? 'waspada'
                  : 'bahaya',
          }
        : null,
    link: L.rutin,
  },
  bersih: {
    kind: 'cek',
    id: 'c-bersih',
    label: 'Harta bersih',
    desc: 'Semua aset di Kekayaan dikurangi utang & tagihan kartu kredit.',
    ref: 'Harta bersih yang positif dan naik dari waktu ke waktu menandakan keuangan bertumbuh.',
    calc: (m) =>
      m.ready ? { text: rp(m.net), status: m.net > 0 ? 'aman' : m.net === 0 ? 'waspada' : 'bahaya' } : null,
    link: L.kekayaan,
  },
} satisfies Record<string, Card>;

const D = {
  income: {
    kind: 'data',
    id: 'd-income',
    label: 'Pemasukan sebulan',
    desc: 'Rata-rata uang masuk di bulan-bulan penuh terakhir (sampai 3 bulan).',
    value: (m) => m.incomeAvg,
    needsMonth: true,
    link: L.transaksi,
  },
  expense: {
    kind: 'data',
    id: 'd-expense',
    label: 'Pengeluaran sebulan',
    desc: 'Rata-rata semua pengeluaran di bulan-bulan penuh terakhir, di luar investasi & bayar utang.',
    value: (m) => m.expenseAvg,
    needsMonth: true,
    link: L.transaksi,
  },
  sosial: {
    kind: 'data',
    id: 'd-sosial',
    label: 'Kirim ke orang sebulan',
    desc: 'Rata-rata pengeluaran kategori Keluarga & Sosial — misalnya bantuan untuk orang tua atau gaji asisten.',
    value: (m) => m.split.sosial,
    needsMonth: true,
    link: L.transaksi,
  },
  left: {
    kind: 'data',
    id: 'd-left',
    label: 'Sisa sebulan',
    desc: 'Pemasukan dikurangi pengeluaran rata-rata.',
    value: (m) => m.leftAvg,
    needsMonth: true,
  },
  assets: {
    kind: 'data',
    id: 'd-assets',
    label: 'Aset di Kekayaan',
    desc: 'Semua yang ada di Kekayaan per hari ini: rekening, tabungan, investasi, piutang, barang & koleksi.',
    value: (m) => m.assets,
    link: L.kekayaan,
  },
  debt: {
    kind: 'data',
    id: 'd-debt',
    label: 'Utang tercatat',
    desc: 'Tagihan kartu kredit dan sisa utang di Kekayaan, per hari ini.',
    value: (m) => m.liabilities,
    link: L.kekayaan,
  },
  liquid: {
    kind: 'data',
    id: 'd-liquid',
    label: 'Dana siap pakai',
    desc: 'Rekening, dompet, uang elektronik, tabungan & deposito (tanpa kartu kredit).',
    value: (m) => m.liquid,
    link: L.kekayaan,
  },
  invest: {
    kind: 'data',
    id: 'd-invest',
    label: 'Investasi',
    desc: 'Nilai investasi di Kekayaan per hari ini.',
    value: (m) => m.investments,
    link: L.kekayaan,
  },
  net: {
    kind: 'data',
    id: 'd-net',
    label: 'Harta bersih',
    desc: 'Aset dikurangi utang & tagihan kartu.',
    value: (m) => m.net,
    link: L.kekayaan,
  },
} satisfies Record<string, Card>;

const OJK: Card = {
  kind: 'info',
  id: 'i-ojk',
  label: 'Cek izin OJK',
  text: 'Sebelum memakai produk pinjaman atau investasi, cek izinnya di Kontak OJK 157 (telepon) atau WhatsApp 081-157-157-157. Imbal hasil tinggi tanpa risiko adalah tanda bahaya.',
  source: 'OJK',
};
const LPS: Card = {
  kind: 'info',
  id: 'i-lps',
  label: 'Penjaminan LPS',
  text: 'Simpanan di bank peserta LPS dijamin sampai Rp2 miliar per nasabah per bank, selama bunganya tidak melebihi tingkat bunga penjaminan LPS.',
  source: 'LPS',
};

const ans = (c: Ctx, id: string) => c.a[id] ?? '';

export const TEMPLATES: Template[] = [
  {
    id: 'nikah',
    title: 'Persiapan Nikah',
    emoji: '💍',
    tagline: 'Tujuh bab menyiapkan keuangan sebelum menikah, berakhir di dua tabel keluarga',
    color: 'rose',
    start: 'MULAI · BERDUA ·',
    finalTitle: 'Rencana keluarga',
    chapters: [
      {
        id: 'nk1',
        title: 'Pendapatan',
        emoji: '💼',
        cards: [
          D.income,
          {
            kind: 'tanya',
            id: 'nk-kerja',
            q: 'Kalian berdua bekerja?',
            why: 'Satu atau dua penghasilan menentukan cara kalian membagi biaya rumah tangga.',
            options: ['Ya, dua-duanya', 'Salah satu dari kami'],
          },
          {
            kind: 'tanya',
            id: 'nk-terbuka',
            q: 'Sudah saling terbuka soal semua pemasukan, termasuk THR dan bonus?',
            why: 'Rencana hanya bisa berjalan kalau semua uang yang masuk terlihat oleh kalian berdua.',
            options: ['Ya', 'Belum'],
          },
        ],
      },
      {
        id: 'nk2',
        title: 'Keuangan bersama',
        emoji: '🤝',
        cards: [
          {
            kind: 'tanya',
            id: 'nk-pengatur',
            q: 'Siapa yang mengatur uang rumah tangga?',
            why: 'Dua-duanya bisa berhasil. Yang penting kalian sepakat dan sama-sama tahu kondisinya.',
            options: ['Kami berdua', 'Salah satu dari kami'],
          },
          {
            kind: 'tanya',
            id: 'nk-rekening',
            q: 'Pakai rekening bersama untuk biaya rumah?',
            why: 'Banyak pasangan tetap punya rekening masing-masing, ditambah satu rekening khusus biaya bersama.',
            options: ['Ya, satu rekening bersama', 'Belum, masing-masing dulu'],
            link: L.bersama,
          },
        ],
      },
      {
        id: 'nk3',
        title: 'Tanggungan dan rumah',
        emoji: '🏠',
        cards: [
          D.sosial,
          {
            kind: 'tanya',
            id: 'nk-bantu',
            q: 'Ada orang tua atau saudara yang kalian bantu tiap bulan?',
            why: 'Bantuan rutin masuk rencana sebagai biaya bulanan, bukan sisa uang.',
            options: ['Ada', 'Tidak ada'],
          },
          {
            kind: 'tanya',
            id: 'nk-tinggal',
            q: 'Setelah menikah, tinggal di mana?',
            why: 'Sewa atau cicilan rumah biasanya menjadi biaya bulanan terbesar.',
            options: ['Rumah sendiri', 'Sewa', 'Bersama orang tua', 'Mau beli rumah'],
          },
          {
            kind: 'tugas',
            id: 'nk-bpjs',
            label: 'Pastikan BPJS Kesehatan kalian berdua aktif',
            why: 'Jaminan kesehatan menjaga tabungan kalian saat ada biaya rumah sakit. Setelah menikah, data keluarga bisa disatukan.',
            link: L.sehat,
          },
        ],
      },
      {
        id: 'nk4',
        title: 'Pengeluaran',
        emoji: '🧾',
        cards: [D.expense, CEK.tabung, CEK.darurat],
      },
      {
        id: 'nk5',
        title: 'Aset',
        emoji: '🏦',
        cards: [
          D.assets,
          {
            kind: 'tanya',
            id: 'nk-aset-nama',
            q: 'Aset kalian atas nama siapa?',
            why: 'Ini menunjukkan apa yang dibawa masing-masing ke pernikahan.',
            options: ['Atas nama masing-masing', 'Sebagian sudah bersama', 'Belum punya aset'],
          },
          {
            kind: 'tanya',
            id: 'nk-aset-bersama',
            q: 'Setelah menikah, jadi milik bersama?',
            why: 'Tidak ada jawaban yang salah. Putuskan berdua, lalu catat kesepakatannya.',
            options: ['Ya, semuanya', 'Sebagian', 'Tidak, tetap masing-masing'],
          },
        ],
      },
      {
        id: 'nk6',
        title: 'Pajak dan pra-nikah',
        emoji: '📜',
        cards: [
          {
            kind: 'tanya',
            id: 'nk-pajak',
            q: 'Ada pajak tahunan yang perlu disiapkan, seperti PBB atau pajak kendaraan?',
            why: 'Tagihan tahunan terasa lebih ringan kalau disisihkan sedikit tiap bulan.',
            options: ['Ada', 'Tidak ada'],
            link: L.rutin,
          },
          {
            kind: 'tanya',
            id: 'nk-perjanjian',
            q: 'Mau membuat perjanjian perkawinan?',
            why: 'Perjanjian perkawinan dibuat dengan akta notaris dan bisa dibuat sebelum maupun selama pernikahan. Pertanyaan ini boleh dilewati.',
            options: ['Ya', 'Masih ragu', 'Tidak'],
          },
        ],
      },
      {
        id: 'nk7',
        title: 'Utang dan cicilan',
        emoji: '⛓️',
        cards: [
          D.debt,
          CEK.utang,
          {
            kind: 'tanya',
            id: 'nk-lunasi',
            q: 'Ada utang yang ingin dilunasi sebelum menikah?',
            why: 'Memulai tanpa utang lama membuat rencana bersama lebih longgar.',
            options: ['Ada', 'Tidak ada'],
          },
          {
            kind: 'tanya',
            id: 'nk-pinjol',
            q: 'Ada pinjaman online yang sedang berjalan?',
            why: 'Pastikan pinjaman online kalian terdaftar & berizin OJK — cek lewat Kontak OJK 157 atau WhatsApp 081-157-157-157.',
            options: ['Tidak ada', 'Ada'],
          },
        ],
      },
    ],
    tables: [
      { id: 't-aruskas', kind: 'aruskas', after: 'nk4' },
      { id: 't-neraca', kind: 'neraca', after: 'nk7' },
    ],
    saran: (c) => {
      const s: Saran[] = [];
      if (ans(c, 'nk-terbuka') === 'Belum')
        s.push({ text: 'Bicarakan soal terbuka tentang pemasukan', card: 'nk-terbuka' });
      if (ans(c, 'nk-rekening').startsWith('Belum'))
        s.push({ text: 'Bicarakan rekening bersama', href: L.bersama.href });
      if (ans(c, 'nk-bantu') === 'Ada')
        s.push({ text: 'Masukkan bantuan keluarga sebagai biaya rutin', href: L.rutin.href });
      if (ans(c, 'nk-tinggal') === 'Mau beli rumah')
        s.push({ text: 'Hitung kemampuan KPR di papan Beli Rumah', href: '/membership/kanvas?baru=rumah' });
      if (!c.done['nk-bpjs']) s.push({ text: 'Cek BPJS Kesehatan kalian berdua', card: 'nk-bpjs' });
      if (ans(c, 'nk-pajak') === 'Ada')
        s.push({ text: 'Sisihkan pajak tahunan sedikit tiap bulan', href: L.rutin.href });
      if (ans(c, 'nk-lunasi') === 'Ada')
        s.push({ text: 'Buat rencana melunasi utang sebelum menikah', href: '/membership/kanvas?baru=lunas-utang' });
      if (ans(c, 'nk-pinjol') === 'Ada')
        s.push({ text: 'Pastikan pinjaman online terdaftar di OJK', card: 'nk-pinjol' });
      const d = CEK.darurat.calc(c.m);
      if (d && d.status !== 'aman')
        s.push({ text: 'Lengkapi dana darurat sampai minimal 3× pengeluaran', href: L.cek.href });
      return s;
    },
  },
  {
    id: 'darurat',
    title: 'Dana Darurat',
    emoji: '🛟',
    tagline: 'Bantalan saat kena PHK, sakit, atau kejadian mendadak',
    color: 'teal',
    start: 'MULAI · AMAN ·',
    finalTitle: 'Rencana dana darurat',
    chapters: [
      {
        id: 'dd1',
        title: 'Pengeluaran wajib',
        emoji: '🧾',
        cards: [
          D.expense,
          {
            kind: 'angka',
            id: 'n-wajib',
            label: 'Pengeluaran wajib per bulan',
            unit: 'rp',
            why: 'Makan, tempat tinggal, cicilan, transport, tagihan — tanpa jajan & hiburan.',
            suggest: (m) => (m.expenseAvg ? Math.round((m.expenseAvg * 0.7) / 10000) * 10000 : null),
          },
        ],
      },
      {
        id: 'dd2',
        title: 'Berapa yang cukup',
        emoji: '🎯',
        cards: [
          {
            kind: 'tanya',
            id: 'dd-kondisi',
            q: 'Kondisimu sekarang?',
            why: 'Makin banyak tanggungan atau makin tidak tetap penghasilan, makin besar dana darurat yang dibutuhkan.',
            options: ['Lajang', 'Menikah', 'Menikah & punya anak', 'Penghasilan tidak tetap'],
          },
          {
            kind: 'hitung',
            id: 'h-target',
            label: 'Target dana darurat',
            calc: (c) => {
              const wajib = num(c, 'n-wajib') || c.m.expenseAvg;
              if (!wajib) return null;
              const k =
                { Lajang: 3, Menikah: 6, 'Menikah & punya anak': 9, 'Penghasilan tidak tetap': 12 }[
                  ans(c, 'dd-kondisi')
                ] ?? 6;
              const target = wajib * k;
              return {
                value: rp(target),
                note: `${k}× pengeluaran wajib · sudah ada ${rp(c.m.liquid)}`,
                tone: c.m.liquid >= target ? 'good' : 'warn',
              };
            },
          },
          CEK.darurat,
        ],
      },
      {
        id: 'dd3',
        title: 'Rencana mengisi',
        emoji: '🪣',
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
              const k =
                { Lajang: 3, Menikah: 6, 'Menikah & punya anak': 9, 'Penghasilan tidak tetap': 12 }[
                  ans(c, 'dd-kondisi')
                ] ?? 6;
              const gap = Math.max(0, wajib * k - c.m.liquid);
              if (!gap) return { value: 'Sudah tercapai 🎉', tone: 'good' };
              const n = gap / num(c, 'n-setor');
              return { value: months(n), note: `kurang ${rp(gap)}`, tone: n <= 24 ? 'good' : 'warn' };
            },
          },
          {
            kind: 'tugas',
            id: 'dd-otomatis',
            label: 'Jadwalkan setoran otomatis setelah gajian',
            why: 'Menabung di awal bulan lebih berhasil daripada menunggu sisa.',
            link: L.rutin,
          },
        ],
      },
      {
        id: 'dd4',
        title: 'Simpan di mana',
        emoji: '🏦',
        cards: [
          {
            kind: 'tugas',
            id: 'dd-pisah',
            label: 'Pisahkan dari rekening belanja harian',
            why: 'Dana yang terlihat setiap hari lebih mudah terpakai.',
          },
          {
            kind: 'tugas',
            id: 'dd-cair',
            label: 'Pilih tempat yang bisa dicairkan dalam 1–2 hari kerja',
            why: 'Tabungan atau deposito di bank peserta LPS, atau reksa dana pasar uang dari manajer investasi berizin OJK. Bukan saham atau kripto.',
          },
          LPS,
        ],
      },
    ],
    goal: (c) => {
      const wajib = num(c, 'n-wajib') || c.m.expenseAvg;
      if (!wajib) return null;
      const k =
        { Lajang: 3, Menikah: 6, 'Menikah & punya anak': 9, 'Penghasilan tidak tetap': 12 }[ans(c, 'dd-kondisi')] ?? 6;
      const p = Math.min(100, Math.round((c.m.liquid / (wajib * k)) * 100));
      return {
        value: `${p}% terkumpul`,
        note: `${rp(c.m.liquid)} dari ${rp(wajib * k)}`,
        tone: p >= 100 ? 'good' : 'warn',
      };
    },
  },
  {
    id: 'rumah',
    title: 'Beli Rumah (KPR)',
    emoji: '🏡',
    tagline: 'Hitung DP, cicilan, dan biaya yang sering terlupa',
    color: 'emerald',
    start: 'MULAI · RUMAH ·',
    finalTitle: 'Rencana rumah',
    chapters: [
      {
        id: 'kp1',
        title: 'Kemampuan',
        emoji: '🧭',
        cards: [
          D.income,
          {
            kind: 'angka',
            id: 'n-partner-income',
            label: 'Pemasukan pasangan per bulan',
            unit: 'rp',
            why: 'Isi kalau pengajuan KPR memakai penghasilan berdua (joint income).',
          },
          {
            kind: 'hitung',
            id: 'h-maks',
            label: 'Cicilan aman maksimal (±30% pemasukan)',
            calc: (c) => {
              const inc = c.m.incomeAvg + num(c, 'n-partner-income');
              return inc ? { value: rp(inc * 0.3), note: 'acuan umum bank; cicilan lain ikut dihitung' } : null;
            },
          },
          CEK.utang,
        ],
      },
      {
        id: 'kp2',
        title: 'Rumah incaran',
        emoji: '🏠',
        cards: [
          {
            kind: 'tanya',
            id: 'kp-lokasi',
            q: 'Rumah di mana yang dicari?',
            why: 'Lokasi menentukan harga, ongkos harian, dan waktu di jalan.',
            options: ['Dekat kantor', 'Dekat keluarga', 'Pinggir kota, lebih murah', 'Belum tahu'],
          },
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
        id: 'kp3',
        title: 'Hitungan KPR',
        emoji: '🧮',
        cards: [
          {
            kind: 'hitung',
            id: 'h-dp',
            label: 'Uang muka',
            calc: (c) => (has(c, 'n-harga') ? { value: rp((num(c, 'n-harga') * num(c, 'n-dp')) / 100) } : null),
          },
          {
            kind: 'hitung',
            id: 'h-cicilan',
            label: 'Cicilan per bulan (bunga floating)',
            calc: (c) => {
              if (!has(c, 'n-harga', 'n-tenor')) return null;
              const loan = num(c, 'n-harga') * (1 - num(c, 'n-dp') / 100);
              const pay = pmt(loan, num(c, 'n-bunga') || 10, num(c, 'n-tenor') * 12);
              const inc = c.m.incomeAvg + num(c, 'n-partner-income');
              const ratio = inc ? pay / inc : null;
              return {
                value: rp(pay),
                note:
                  ratio === null ? `pinjaman ${rp(loan)}` : `${pct(ratio)} dari pemasukan · pinjaman ${short(loan)}`,
                tone: ratio === null ? undefined : ratio <= 0.3 ? 'good' : ratio <= 0.4 ? 'warn' : 'bad',
              };
            },
          },
          {
            kind: 'hitung',
            id: 'h-ekstra',
            label: 'Biaya tambahan (±5–10% harga)',
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
            label: 'Bunga promo',
            text: 'Bunga promo biasanya hanya berlaku 1–5 tahun pertama. Hitung cicilan dengan bunga floating supaya tidak kaget.',
          },
        ],
      },
      {
        id: 'kp4',
        title: 'Cek legalitas',
        emoji: '🛡️',
        cards: [
          {
            kind: 'tugas',
            id: 'kp-sertif',
            label: 'Cek sertifikat (SHM/SHGB) di BPN atau lewat notaris',
            why: 'Sertifikat yang jelas melindungi uangmu dari sengketa.',
          },
          {
            kind: 'tugas',
            id: 'kp-pbg',
            label: 'Pastikan izin bangunan (PBG/IMB) ada',
            why: 'Bangunan tanpa izin bisa bermasalah saat dijual atau diagunkan.',
          },
          {
            kind: 'tugas',
            id: 'kp-slik',
            label: 'Cek riwayat kreditmu di SLIK OJK (iDebKu)',
            why: 'Bank melihat riwayat ini saat menilai pengajuan KPR.',
          },
          OJK,
        ],
      },
      {
        id: 'kp5',
        title: 'Rencana DP',
        emoji: '🪙',
        cards: [
          D.liquid,
          { kind: 'angka', id: 'n-bulan', label: 'Target beli berapa bulan lagi', unit: 'bulan' },
          {
            kind: 'hitung',
            id: 'h-nabung',
            label: 'Nabung DP + biaya per bulan',
            calc: (c) => {
              if (!has(c, 'n-harga', 'n-bulan')) return null;
              const need = num(c, 'n-harga') * (num(c, 'n-dp') / 100 + 0.07) - c.m.liquid;
              if (need <= 0) return { value: 'Dana DP sudah cukup 🎉', tone: 'good' };
              const per = need / num(c, 'n-bulan');
              return { value: rp(per), note: `kurang ${rp(need)}`, tone: per <= c.m.leftAvg ? 'good' : 'warn' };
            },
          },
        ],
      },
    ],
    tables: [{ id: 't-neraca', kind: 'neraca', after: 'kp5' }],
    goal: (c) => {
      if (!has(c, 'n-harga', 'n-tenor')) return null;
      const loan = num(c, 'n-harga') * (1 - num(c, 'n-dp') / 100);
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
    start: 'MULAI · TENANG ·',
    finalTitle: 'Rencana pensiun',
    chapters: [
      {
        id: 'ps1',
        title: 'Hari ini',
        emoji: '🧭',
        cards: [
          D.expense,
          D.invest,
          { kind: 'angka', id: 'n-usia', label: 'Usiamu sekarang', unit: 'tahun' },
          { kind: 'angka', id: 'n-pensiun', label: 'Mau pensiun di usia', unit: 'tahun', suggest: () => 55 },
        ],
      },
      {
        id: 'ps2',
        title: 'Gaya hidup nanti',
        emoji: '🌅',
        cards: [
          {
            kind: 'tanya',
            id: 'ps-gaya',
            q: 'Mau pensiun seperti apa?',
            why: 'Gaya hidup saat pensiun menentukan besar dana yang perlu disiapkan.',
            options: ['Sederhana di kampung', 'Tetap di kota', 'Masih produktif (usaha kecil)', 'Banyak jalan-jalan'],
          },
          {
            kind: 'angka',
            id: 'n-biaya',
            label: 'Biaya hidup per bulan (nilai hari ini)',
            unit: 'rp',
            suggest: (m) => (m.expenseAvg ? Math.round((m.expenseAvg * 0.8) / 10000) * 10000 : null),
          },
          { kind: 'angka', id: 'n-inflasi', label: 'Asumsi inflasi per tahun', unit: 'persen', suggest: () => 4 },
        ],
      },
      {
        id: 'ps3',
        title: 'Dana yang dibutuhkan',
        emoji: '🧮',
        cards: [
          {
            kind: 'hitung',
            id: 'h-nanti',
            label: 'Biaya hidup per bulan saat pensiun',
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
        id: 'ps4',
        title: 'Cara mengumpulkan',
        emoji: '📈',
        cards: [
          {
            kind: 'angka',
            id: 'n-return',
            label: 'Asumsi imbal hasil investasi per tahun',
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
            kind: 'tugas',
            id: 'ps-jht',
            label: 'Cek saldo JHT & Jaminan Pensiun di aplikasi JMO',
            why: 'Saldo BPJS Ketenagakerjaan adalah salah satu pilar dana pensiunmu.',
          },
          {
            kind: 'tugas',
            id: 'ps-dplk',
            label: 'Pertimbangkan DPLK atau program pensiun kantor',
            why: 'Program pensiun memaksa disiplin menabung jangka panjang.',
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
    start: 'MULAI · SEKOLAH ·',
    finalTitle: 'Rencana pendidikan',
    chapters: [
      {
        id: 'pd1',
        title: 'Jenjang',
        emoji: '🏫',
        cards: [
          {
            kind: 'tanya',
            id: 'pd-jenjang',
            q: 'Untuk jenjang apa?',
            why: 'Tiap jenjang punya waktu & besar biaya yang berbeda.',
            options: ['TK / SD', 'SMP / SMA', 'Kuliah S1', 'Kuliah luar negeri'],
          },
          { kind: 'angka', id: 'n-biaya', label: 'Biaya masuk + tahun pertama (harga hari ini)', unit: 'rp' },
          { kind: 'angka', id: 'n-tahun', label: 'Dibutuhkan berapa tahun lagi', unit: 'tahun' },
        ],
      },
      {
        id: 'pd2',
        title: 'Kenaikan biaya',
        emoji: '📈',
        cards: [
          {
            kind: 'angka',
            id: 'n-inflasi',
            label: 'Asumsi kenaikan biaya pendidikan per tahun',
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
        id: 'pd3',
        title: 'Rencana menabung',
        emoji: '🪙',
        cards: [
          D.left,
          { kind: 'angka', id: 'n-siap', label: 'Dana yang sudah ada', unit: 'rp' },
          { kind: 'angka', id: 'n-return', label: 'Asumsi imbal hasil per tahun', unit: 'persen', suggest: () => 6 },
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
        id: 'pd4',
        title: 'Cek produk',
        emoji: '🛡️',
        cards: [
          {
            kind: 'tugas',
            id: 'pd-pisah',
            label: 'Siapkan rekening/produk khusus pendidikan',
            why: 'Dana yang dipisah tidak ikut terpakai untuk kebutuhan lain.',
          },
          {
            kind: 'tugas',
            id: 'pd-biaya',
            label: 'Pahami biaya & aturan pencairan produknya',
            why: 'Asuransi pendidikan atau unit link sering punya biaya tinggi di tahun-tahun awal.',
          },
          OJK,
        ],
      },
    ],
    goal: (c) =>
      has(c, 'n-biaya', 'n-tahun')
        ? {
            value: rp(futureValue(num(c, 'n-biaya'), num(c, 'n-inflasi') || 10, num(c, 'n-tahun'))),
            note: `dalam ${num(c, 'n-tahun')} tahun`,
          }
        : null,
  },
  {
    id: 'lunas-utang',
    title: 'Lunas Utang',
    emoji: '⛓️',
    tagline: 'Urutkan, bayar, dan jangan gali lubang tutup lubang',
    color: 'violet',
    start: 'MULAI · BEBAS ·',
    finalTitle: 'Rencana bebas utang',
    chapters: [
      { id: 'lu1', title: 'Peta utang', emoji: '🗺️', cards: [D.debt, CEK.utang, D.left] },
      {
        id: 'lu2',
        title: 'Strategi',
        emoji: '♟️',
        cards: [
          {
            kind: 'info',
            id: 'i-strategi',
            label: 'Dua cara populer',
            text: 'Bola salju: lunasi yang saldonya paling kecil dulu (cepat terasa menang). Longsoran: lunasi yang bunganya paling tinggi dulu (paling hemat bunga).',
          },
          {
            kind: 'tanya',
            id: 'lu-strategi',
            q: 'Strategi mana yang kamu pilih?',
            why: 'Strategi yang cocok dengan sifatmu lebih mungkin dijalani sampai lunas.',
            options: ['Bola salju (saldo terkecil dulu)', 'Longsoran (bunga tertinggi dulu)', 'Belum tahu'],
          },
        ],
      },
      {
        id: 'lu3',
        title: 'Rencana bayar',
        emoji: '🧮',
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
          {
            kind: 'tugas',
            id: 'lu-auto',
            label: 'Atur pembayaran otomatis tepat setelah gajian',
            why: 'Uang yang dibayar duluan tidak sempat terpakai untuk hal lain.',
            link: L.rutin,
          },
        ],
      },
      {
        id: 'lu4',
        title: 'Rem & pagar',
        emoji: '🛑',
        cards: [
          {
            kind: 'tugas',
            id: 'lu-stop',
            label: 'Berhenti menambah utang konsumtif baru',
            why: 'Melunasi sambil menambah utang membuat targetnya terus mundur.',
          },
          {
            kind: 'tugas',
            id: 'lu-nego',
            label: 'Kalau berat, ajukan restrukturisasi ke pemberi pinjaman',
            why: 'Lebih baik bicara di awal daripada menunggak.',
          },
          {
            kind: 'tugas',
            id: 'lu-slik',
            label: 'Cek semua catatan kreditmu di SLIK OJK (iDebKu)',
            why: 'Supaya tidak ada utang yang terlupa.',
          },
          OJK,
        ],
      },
    ],
    tables: [{ id: 't-utang', kind: 'utang', after: 'lu1' }],
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
    start: 'MULAI · USAHA ·',
    finalTitle: 'Rencana usaha',
    chapters: [
      {
        id: 'us1',
        title: 'Ide usaha',
        emoji: '💡',
        cards: [
          {
            kind: 'tanya',
            id: 'us-ide',
            q: 'Usaha di bidang apa?',
            why: 'Ide yang jelas pembelinya lebih cepat balik modal.',
            options: ['Makanan & minuman', 'Jasa', 'Produk online', 'Titip jual / reseller'],
          },
          {
            kind: 'tanya',
            id: 'us-uji',
            q: 'Cara menguji ide dengan modal kecil?',
            why: 'Menguji kecil-kecilan mengurangi risiko modal habis.',
            options: ['Pre-order dulu', 'Jual ke teman & keluarga', 'Buka lapak online', 'Ikut bazar'],
          },
        ],
      },
      {
        id: 'us2',
        title: 'Modal',
        emoji: '🧰',
        cards: [
          D.liquid,
          { kind: 'angka', id: 'n-modal', label: 'Modal awal (alat, stok, izin)', unit: 'rp' },
          { kind: 'angka', id: 'n-tetap', label: 'Biaya tetap per bulan (sewa, gaji, listrik)', unit: 'rp' },
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
        id: 'us3',
        title: 'Titik impas',
        emoji: '⚖️',
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
        id: 'us4',
        title: 'Rapi sejak awal',
        emoji: '🗂️',
        cards: [
          {
            kind: 'tugas',
            id: 'us-rek',
            label: 'Buka rekening terpisah untuk usaha',
            why: 'Uang usaha dan uang pribadi yang tercampur membuat untung-rugi tidak terlihat.',
          },
          {
            kind: 'tugas',
            id: 'us-nib',
            label: 'Daftar NIB lewat OSS (gratis)',
            why: 'Izin dasar usaha, dibutuhkan untuk banyak kemitraan & pembiayaan.',
          },
          {
            kind: 'tugas',
            id: 'us-catat',
            label: 'Catat penjualan harian di Ladangku',
            why: 'Catatan harian membuat titik impas bisa dipantau.',
            link: { href: '/membership/ladang', label: 'Buka Ladangku' },
          },
          {
            kind: 'info',
            id: 'i-pph',
            label: 'Pajak UMKM',
            text: 'Wajib pajak orang pribadi UMKM dengan omzet sampai Rp500 juta setahun tidak dikenai PPh final 0,5% atas omzet tersebut.',
            source: 'PP 55/2022',
          },
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
    start: 'MULAI · BEBAS ·',
    finalTitle: 'Ringkasan',
    chapters: [{ id: 'ks1', title: 'Dari catatanmu', emoji: '📒', cards: [D.income, D.expense, D.left, D.net] }],
    tables: [{ id: 't-neraca', kind: 'neraca', after: 'ks1' }],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];

// ── Status kartu ───────────────────────────────────────────────────────────
// Kartu dihitung selesai kalau dijawab, dilewati, atau (data/cek) angkanya sudah tersedia.
export type CardState = 'answered' | 'skipped' | 'auto' | 'waiting' | 'open';
export type StateLike = { answers: Record<string, string>; done: Record<string, true>; nums: Record<string, number> };
export const skipKey = (id: string) => `skip.${id}`;
export const counts = (card: Card) => card.kind !== 'info' && card.kind !== 'hitung';

export function cardState(card: Card, s: StateLike, m: Metrics): CardState {
  if (card.kind === 'tanya' && s.answers[card.id]) return 'answered';
  if (card.kind === 'tugas' && s.done[card.id]) return 'answered';
  if (card.kind === 'angka' && Number.isFinite(s.nums[card.id])) return 'answered';
  if (s.done[skipKey(card.id)]) return 'skipped';
  if (card.kind === 'data') return m.ready && (!card.needsMonth || m.months > 0) ? 'auto' : 'waiting';
  if (card.kind === 'cek') return card.calc(m) ? 'auto' : 'waiting';
  return 'open';
}
export const isDone = (st: CardState) => st === 'answered' || st === 'skipped' || st === 'auto';

export function chapterProgress(ch: Chapter, s: StateLike, m: Metrics) {
  const list = ch.cards.filter(counts);
  const got = list.filter((c) => isDone(cardState(c, s, m))).length;
  return { got, total: list.length, done: got === list.length };
}
export function progressOf(t: Template, s: StateLike, m: Metrics) {
  let got = 0;
  let total = 0;
  let babDone = 0;
  for (const ch of t.chapters) {
    const p = chapterProgress(ch, s, m);
    got += p.got;
    total += p.total;
    if (p.done) babDone++;
  }
  return { got, total, babDone, babTotal: t.chapters.length, pct: total ? Math.round((got / total) * 100) : 0 };
}
