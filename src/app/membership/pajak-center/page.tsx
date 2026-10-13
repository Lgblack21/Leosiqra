"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronDown, ExternalLink, FileSpreadsheet, MessageCircle, Minus, Plus, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStoredValue } from '@/lib/hooks/useStoredValue';
import { useModal } from '@/context/ModalContext';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { accountService, type Account } from '@/lib/services/accountService';
import { itemService, type Item } from '@/lib/services/itemService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';

// Asisten SPT Tahunan PPh Orang Pribadi. Membaca catatan Leosiqra (pemasukan,
// rekening, investasi, barang, hutang-piutang) lalu menyusun perkiraan:
//   bruto per jenis penghasilan → neto (biaya jabatan / norma) → PKP → PPh
//   Pasal 17 → dikurangi kredit pajak (bukti potong) → kurang/lebih bayar/nihil.
// Plus daftar harta & utang untuk lampiran, dan langkah lapor di Coretax.
// SEMUA angka = perkiraan pembanding, bukan pengganti perhitungan resmi DJP.
// Pengaturan disimpan di perangkat ini (localStorage), tidak ada tabel baru.

// ===== Aturan (UU HPP; PTKP PMK 101/2016; biaya jabatan PMK 250/2008) =====
const PTKP_BASE = 54_000_000;
const PTKP_KAWIN = 4_500_000;
const PTKP_TANGGUNGAN = 4_500_000;
const MAX_TANGGUNGAN = 3;
const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX = 6_000_000;
const UMKM_RATE = 0.005; // PP 55/2022, final
const UMKM_BEBAS = 500_000_000; // omzet OP s.d. Rp500 jt/tahun tidak dikenai PPh (UU HPP)
const BRACKETS = [
  { upTo: 60_000_000, rate: 0.05 },
  { upTo: 250_000_000, rate: 0.15 },
  { upTo: 500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];
const pph17 = (pkp: number) => {
  let left = pkp;
  let prev = 0;
  const rows: { from: number; to: number; rate: number; base: number; tax: number }[] = [];
  for (const b of BRACKETS) {
    if (left <= 0) break;
    const base = Math.min(left, b.upTo - prev);
    rows.push({ from: prev, to: b.upTo, rate: b.rate, base, tax: base * b.rate });
    left -= base;
    prev = b.upTo;
  }
  return { total: rows.reduce((s, r) => s + r.tax, 0), rows };
};

// ===== Jenis penghasilan =====
type Kind = 'kerja' | 'bebas' | 'usaha' | 'bunga' | 'sewa' | 'dividen' | 'hadiah' | 'bukan';
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'kerja', label: 'Gaji / pekerjaan', hint: 'Gaji, THR, bonus, tunjangan dari pemberi kerja' },
  { id: 'bebas', label: 'Freelance / pekerjaan bebas', hint: 'Jasa, honor, proyek — dihitung dengan norma (NPPN)' },
  { id: 'usaha', label: 'Usaha (UMKM)', hint: 'Jualan/usaha — PPh final 0,5% (PP 55/2022)' },
  { id: 'bunga', label: 'Bunga deposito/tabungan', hint: 'Final, sudah dipotong bank' },
  { id: 'sewa', label: 'Sewa tanah/bangunan', hint: 'Final 10% dari bruto' },
  { id: 'dividen', label: 'Dividen', hint: 'Final 10% / bebas bila diinvestasikan kembali' },
  { id: 'hadiah', label: 'Hadiah / undian', hint: 'Final 25%, dipotong pemberi hadiah' },
  { id: 'bukan', label: 'Bukan objek pajak', hint: 'Kiriman keluarga, hibah, pengembalian, transfer' },
];
const guessKind = (cat: string): Kind => {
  const c = cat.toLowerCase();
  if (/gaji|salary|thr|bonus|tunjangan|lembur|insentif|pensiun/.test(c)) return 'kerja';
  if (/freelance|proyek|project|jasa|honor|komisi|fee|desain|konsultan/.test(c)) return 'bebas';
  if (/usaha|jualan|penjualan|toko|omzet|dagang|bisnis/.test(c)) return 'usaha';
  if (/bunga|deposito|interest/.test(c)) return 'bunga';
  if (/sewa|kos|kontrak/.test(c)) return 'sewa';
  if (/dividen/.test(c)) return 'dividen';
  if (/hadiah|undian|giveaway/.test(c)) return 'hadiah';
  return 'bukan';
};

const STEPS = [
  { id: 'akun', title: 'Akun Coretax aktif', desc: 'Login coretaxdjp.pajak.go.id pakai NIK (NIK = NPWP). Pastikan email & HP masih aktif.' },
  { id: 'a1', title: 'Bukti potong dari kantor', desc: 'Minta bukti potong PPh 21 (A1) — biasanya juga muncul otomatis di Coretax.' },
  { id: 'lain', title: 'Bukti potong lain', desc: 'Bukti potong PPh 23/final dari klien, bank, atau penyelenggara hadiah.' },
  { id: 'harta', title: 'Cek daftar harta & utang', desc: 'Pakai daftar di bawah. Harta dilaporkan dengan harga perolehan.' },
  { id: 'keluarga', title: 'Susunan keluarga', desc: 'Pasangan dan tanggungan (maks. 3) sesuai KK.' },
  { id: 'bayar', title: 'Bayar kalau kurang bayar', desc: 'Buat kode billing di Coretax lalu bayar sebelum SPT dikirim.' },
  { id: 'kirim', title: 'Isi & kirim SPT', desc: 'Isi SPT Tahunan PPh OP di Coretax, tanda tangani, dapatkan BPE.' },
];

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const short = (n: number) => (Math.abs(n) >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace('.', ',')} M` : Math.abs(n) >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace('.', ',')} jt` : rp(n));
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const num = (v: string | null | undefined) => Math.max(0, Number(String(v ?? '').replace(/\D/g, '')) || 0);
const parseJSON = <T,>(v: string | null, fb: T): T => {
  try {
    return v ? { ...fb, ...JSON.parse(v) } : fb;
  } catch {
    return fb;
  }
};
const card = 'rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]';

export default function PajakCenterPage() {
  const { openModal } = useModal();
  const now = new Date();
  // Jan–Mar: biasanya sedang melaporkan tahun lalu.
  const [year, setYear] = useState(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear());
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [showBrackets, setShowBrackets] = useState(false);

  // Pengaturan lama dipakai ulang supaya isian member tidak hilang.
  const [sStatus, setSStatus] = useStoredValue('pajak-center-marital-status');
  const [sDep, setSDep] = useStoredValue('pajak-center-dependents');
  const [sPph21, setSPph21] = useStoredValue(`pajak-center-pph21-${year}`);
  const [sKinds, setSKinds] = useStoredValue('pajak-kinds:v1');
  const [sInput, setSInput] = useStoredValue(`pajak-input:v1:${year}`);
  const [sSteps, setSSteps] = useStoredValue(`pajak-langkah:v1:${year}`);
  const kawin = sStatus === 'K';
  const tanggungan = Math.min(MAX_TANGGUNGAN, Math.max(0, Number(sDep) || 0));
  const kindOverride = parseJSON<Record<string, Kind>>(sKinds, {});
  const input = parseJSON(sInput, { iuran: '', norma: '50', zakat: '', pph23: '', a1Bruto: '' });
  const steps = parseJSON<Record<string, boolean>>(sSteps, {});
  const setInput = (k: keyof typeof input, v: string) => setSInput(JSON.stringify({ ...input, [k]: v }));

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setAll).catch(() => setAll([]));
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    investmentService.getUserInvestments('session').then((l) => setInvestments(l.filter((i) => i.status !== 'Planned'))).catch(() => {});
    itemService.list().then(setItems).catch(() => {});
    exchangeRateService.getLatestRates().then(setFx).catch(() => {});
    return subscribeToCollectionChanges('transactions', load);
  }, []);

  // ===== Penghasilan tahun ini per kategori
  const incomeCats = useMemo(() => {
    const m = new Map<string, number>();
    (all ?? []).filter((t) => t.type === 'pemasukan' && new Date(t.date).getFullYear() === year).forEach((t) => m.set(t.category || 'Lainnya', (m.get(t.category || 'Lainnya') ?? 0) + toIdr(t)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, total, kind: kindOverride[cat] ?? guessKind(cat) }));
  }, [all, year, kindOverride]);
  const byKind = (k: Kind) => incomeCats.filter((c) => c.kind === k).reduce((s, c) => s + c.total, 0);

  // ===== Hitungan
  const brutoKerja = num(input.a1Bruto) || byKind('kerja');
  const biayaJabatan = brutoKerja > 0 ? Math.min(brutoKerja * BIAYA_JABATAN_RATE, BIAYA_JABATAN_MAX) : 0;
  const iuran = Math.min(num(input.iuran), brutoKerja);
  const netoKerja = Math.max(0, brutoKerja - biayaJabatan - iuran);
  const brutoBebas = byKind('bebas');
  const norma = Math.min(100, Math.max(0, Number(input.norma) || 0));
  const netoBebas = brutoBebas * (norma / 100);
  const zakat = num(input.zakat);
  const neto = Math.max(0, netoKerja + netoBebas - zakat);
  const ptkp = PTKP_BASE + (kawin ? PTKP_KAWIN : 0) + tanggungan * PTKP_TANGGUNGAN;
  const pkp = Math.floor(Math.max(0, neto - ptkp) / 1000) * 1000;
  const { total: terutang, rows: bracketRows } = pph17(pkp);
  const pph21 = num(sPph21);
  const pph23 = num(input.pph23);
  const kredit = pph21 + pph23;
  const hasil = terutang - kredit;
  const status: 'kurang' | 'lebih' | 'nihil' = Math.abs(hasil) < 1000 ? 'nihil' : hasil > 0 ? 'kurang' : 'lebih';
  const omzetUsaha = byKind('usaha');
  const umkmFinal = Math.max(0, omzetUsaha - UMKM_BEBAS) * UMKM_RATE;
  const finalLain = byKind('bunga') + byKind('sewa') + byKind('dividen') + byKind('hadiah');

  // ===== Harta & utang (posisi terkini)
  const toIDR = (v: number, cur?: string) => exchangeRateService.convert(v, cur || 'IDR', 'IDR', fx);
  const harta = {
    kas: accounts.filter((a) => !isCreditAccountType(a.type) && a.type !== 'Investment Account').map((a) => ({ name: a.name, sub: a.type === 'Cash' ? 'Uang tunai' : a.type === 'E-Wallet' ? 'Dompet digital' : 'Tabungan/giro', value: toIDR(Number(a.balance) || 0, a.currency) })),
    investasi: investments.map((i) => ({ name: i.name, sub: i.type || 'Investasi', value: Number(i.amountIDR) || Number(i.amountInvested) || 0 })),
    barang: items.map((i) => ({ name: i.name, sub: i.category || (i.kind === 'koleksi' ? 'Koleksi' : 'Barang'), value: Number(i.purchase_price) || 0 })),
  };
  const debts = (all ?? []).filter((t) => t.type === 'debt' && t.paymentStatus !== 'lunas');
  const piutang = debts.filter((t) => t.category === 'Piutang').map((t) => ({ name: t.lenderName || t.note || 'Piutang', sub: 'Piutang', value: toIdr(t) }));
  const utang = [
    ...accounts.filter((a) => isCreditAccountType(a.type)).map((a) => ({ name: a.name, sub: 'Kartu kredit', value: toIDR(computeCreditUsage(a).used, a.currency) })).filter((x) => x.value > 0),
    ...debts.filter((t) => t.category === 'Hutang').map((t) => ({ name: t.lenderName || t.note || 'Hutang', sub: t.subCategory || 'Utang', value: toIdr(t) })),
  ];
  const sum = (l: { value: number }[]) => l.reduce((s, x) => s + x.value, 0);
  const totalHarta = sum(harta.kas) + sum(harta.investasi) + sum(harta.barang) + sum(piutang);
  const totalUtang = sum(utang);

  // ===== Tenggat & kesiapan
  const deadline = new Date(year + 1, 2, 31);
  const daysLeft = Math.ceil((deadline.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5);
  const doneSteps = STEPS.filter((s) => steps[s.id]).length;
  const loading = all === null;

  // ===== Saran Leo (aturan sederhana dari data)
  const tips: string[] = [];
  if (year === now.getFullYear()) tips.push(`Tahun pajak ${year} masih berjalan — angka di sini baru sampai hari ini dan akan bertambah sampai Desember. Hitungan finalnya dilaporkan Jan–Mar ${year + 1}.`);
  const unknown = incomeCats.filter((c) => c.kind === 'bukan' && !kindOverride[c.cat] && c.total > 0);
  if (unknown.length) tips.push(`Ada ${unknown.length} kategori pemasukan yang Leo anggap bukan objek pajak (${unknown.slice(0, 2).map((c) => c.cat).join(', ')}${unknown.length > 2 ? ', …' : ''}). Cek lagi jenisnya di bagian Penghasilan.`);
  if (brutoKerja > 0 && pph21 === 0) tips.push('Isi PPh 21 yang sudah dipotong kantor (lihat bukti potong A1). Tanpa ini hasilnya kelihatan kurang bayar, padahal biasanya nihil.');
  if (brutoBebas > 0) tips.push(`Penghasilan freelance ${short(brutoBebas)}. Kalau omzetmu di bawah Rp4,8 M dan kamu pakai norma (NPPN), pemberitahuannya ke DJP paling lambat 3 bulan pertama tahun pajak. Norma tiap jenis jasa & kota berbeda — sesuaikan persentasenya.`);
  if (omzetUsaha > 0) tips.push(omzetUsaha <= UMKM_BEBAS ? `Omzet usaha ${short(omzetUsaha)} masih di bawah Rp500 jt — belum ada PPh final 0,5%. Tetap laporkan peredaran brutonya di SPT.` : `Omzet usaha melewati Rp500 jt: PPh final 0,5% atas kelebihannya (±${short(umkmFinal)}) disetor sendiri tiap bulan, paling lambat tanggal 15 bulan berikutnya.`);
  if (finalLain > 0) tips.push(`${short(finalLain)} penghasilan kena PPh final (bunga/sewa/dividen/hadiah). Laporkan di bagian penghasilan final — tidak ditambahkan ke PKP.`);
  if (status === 'kurang' && hasil > 0) tips.push(`Perkiraan kurang bayar ${short(hasil)}. Bayar lewat kode billing di Coretax sebelum mengirim SPT, supaya tidak kena sanksi bunga.`);
  if (status === 'lebih') tips.push('Perkiraan lebih bayar. Cek lagi angka bukti potong; kalau benar, kamu bisa minta dikembalikan (restitusi) atau dikompensasikan ke tahun depan.');
  if (harta.barang.length === 0 && totalHarta > 0) tips.push('Kendaraan, HP, atau laptop juga termasuk harta di SPT. Catat di fitur Barang supaya ikut terdaftar di sini.');
  if (incomeCats.length === 0 && !loading) tips.push(`Belum ada pemasukan tercatat di ${year}. Kalau kamu tidak berpenghasilan, SPT tetap bisa dilaporkan nihil — atau ajukan status non-efektif.`);

  const leo: { mood: LeoMood; text: string } =
    loading ? { mood: 'watch', text: 'Lagi menghitung…' }
      : status === 'nihil' ? { mood: 'happy', text: brutoKerja + brutoBebas > 0 ? 'Perkiraan SPT-mu nihil — tinggal lapor saja.' : 'Belum ada penghasilan kena pajak tercatat.' }
        : status === 'kurang' ? { mood: 'idle', text: 'Ada yang perlu dibayar. Cek angka bukti potong dulu ya.' }
          : { mood: 'happy', text: 'Sepertinya kamu lebih bayar. Cek bukti potongnya.' };

  const askLeo = () =>
    openModal('ai_chat', {
      prompt: `Bantu aku siapkan SPT Tahunan PPh orang pribadi tahun pajak ${year}. Ringkasanku (perkiraan dari Leosiqra): status PTKP ${kawin ? 'K' : 'TK'}/${tanggungan}; bruto pekerjaan ${rp(brutoKerja)}, biaya jabatan ${rp(biayaJabatan)}, iuran pensiun ${rp(iuran)}; freelance bruto ${rp(brutoBebas)} dengan norma ${norma}%; usaha UMKM ${rp(omzetUsaha)}; penghasilan final lain ${rp(finalLain)}; zakat ${rp(zakat)}; PKP ${rp(pkp)}; PPh terutang ${rp(terutang)}; PPh 21 dipotong ${rp(pph21)}, PPh 23 ${rp(pph23)}; hasil ${status} ${rp(Math.abs(hasil))}. Harta ${rp(totalHarta)}, utang ${rp(totalUtang)}. Apa yang perlu aku cek dan isi di Coretax?`,
    });

  const exportExcel = () => {
    const row = (a: string, b: string | number) => `<tr><td style="padding:6px">${a}</td><td style="padding:6px;text-align:right">${typeof b === 'number' ? Math.round(b).toLocaleString('id-ID') : b}</td></tr>`;
    const list = (title: string, l: { name: string; sub: string; value: number }[]) =>
      `<h3>${title}</h3><table border="1"><tr><th>Nama</th><th>Jenis</th><th>Nilai (Rp)</th></tr>${l.length ? l.map((x) => `<tr><td>${x.name.replace(/</g, '&lt;')}</td><td>${x.sub.replace(/</g, '&lt;')}</td><td style="text-align:right">${Math.round(x.value).toLocaleString('id-ID')}</td></tr>`).join('') : '<tr><td colspan="3">-</td></tr>'}</table>`;
    const html = `<h2>Draft SPT Tahunan PPh OP — Tahun Pajak ${year}</h2><table border="1">${[
      row('Status PTKP', `${kawin ? 'K' : 'TK'}/${tanggungan}`), row('Penghasilan bruto pekerjaan', brutoKerja), row('Biaya jabatan', biayaJabatan), row('Iuran pensiun/JHT', iuran),
      row('Penghasilan bruto pekerjaan bebas', brutoBebas), row(`Neto pekerjaan bebas (norma ${norma}%)`, netoBebas), row('Zakat/sumbangan wajib', zakat), row('Penghasilan neto', neto),
      row('PTKP', ptkp), row('PKP', pkp), row('PPh terutang (Pasal 17)', terutang), row('Kredit PPh 21', pph21), row('Kredit PPh 23', pph23),
      row(status === 'kurang' ? 'PPh kurang bayar' : status === 'lebih' ? 'PPh lebih bayar' : 'Nihil', Math.abs(hasil)), row('Peredaran bruto usaha (PP 55)', omzetUsaha), row('Penghasilan final lain', finalLain),
    ].join('')}</table>${list('Harta — kas & setara kas', harta.kas)}${list('Harta — investasi', harta.investasi)}${list('Harta — barang (harga perolehan)', harta.barang)}${list('Piutang', piutang)}${list('Utang', utang)}<p>Perkiraan dari Leosiqra — bukan pengganti perhitungan resmi di coretaxdjp.pajak.go.id</p>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Draft_SPT_${year}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasilColor = status === 'kurang' ? 'text-rose-600' : status === 'lebih' ? 'text-emerald-600' : 'text-slate-900';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-14 print:max-w-none">
      <h1 className="sr-only">Pajak</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">Asisten SPT Tahunan dari catatan keuanganmu.</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-1">
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <button key={y} type="button" onClick={() => setYear(y)} className={cn('relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors', year === y ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                {year === y && <motion.span layoutId="tax-year" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative">{y}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={askLeo} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"><MessageCircle size={15} /> Tanya Leo</button>
          <button type="button" onClick={exportExcel} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"><FileSpreadsheet size={15} /> Excel</button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Printer size={15} /> Cetak draft</button>
        </div>
      </div>

      {/* Hero hasil */}
      <section className={cn(card, 'relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/70 p-6 md:p-8 print:hidden')}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500">Perkiraan SPT tahun pajak {year}</p>
            {loading ? <Skeleton className="mt-2 h-14 w-72" /> : (
              <>
                <p className={cn('mt-1 text-[15px] font-bold', hasilColor)}>{status === 'kurang' ? 'Kurang bayar' : status === 'lebih' ? 'Lebih bayar' : 'Nihil'}</p>
                <p className={cn('flex items-start gap-1 leading-none', hasilColor)}>
                  <span className="mt-1.5 text-lg font-bold text-slate-400">Rp</span>
                  <span className="text-[48px] font-extrabold tracking-tight tabular-nums md:text-[56px]"><AnimatedNumber value={Math.abs(hasil)} format={(n) => Math.round(n).toLocaleString('id-ID')} /></span>
                </p>
              </>
            )}
            <p className="mt-2 text-sm text-slate-500">PPh terutang {rp(terutang)} − sudah dipotong {rp(kredit)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold', daysLeft < 0 ? 'bg-rose-50 text-rose-600' : daysLeft <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
                {daysLeft < 0 ? `Tenggat 31 Mar ${year + 1} sudah lewat` : `Lapor paling lambat 31 Mar ${year + 1} · ${daysLeft} hari lagi`}
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">Kesiapan {doneSteps}/{STEPS.length}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">PTKP {kawin ? 'K' : 'TK'}/{tanggungan}</span>
            </div>
          </div>
          <div className="hidden items-end gap-2 md:flex">
            <p className="mb-16 max-w-[220px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-[13px] font-semibold leading-snug text-slate-700 shadow-sm ring-1 ring-slate-100">{leo.text}</p>
            <LeoMascot mood={leo.mood} size={110} />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] print:hidden">
        <div className="min-w-0 space-y-6">
          {/* Profil */}
          <section className={cn(card, 'p-5 md:p-6')}>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Profil pajak</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-500">Status</p>
                <LayoutGroup id="tax-kawin">
                  <div className="flex rounded-full bg-slate-100 p-1">
                    {([['TK', 'Belum kawin'], ['K', 'Kawin']] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setSStatus(v)} className={cn('relative flex-1 rounded-full py-2 text-sm font-semibold', (kawin ? 'K' : 'TK') === v ? 'text-slate-900' : 'text-slate-500')}>
                        {(kawin ? 'K' : 'TK') === v && <motion.span layoutId="kawin-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" />}
                        <span className="relative">{l}</span>
                      </button>
                    ))}
                  </div>
                </LayoutGroup>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-500">Tanggungan (maks. 3)</p>
                <div className="flex items-center justify-between rounded-full bg-slate-100 p-1">
                  <button type="button" aria-label="Kurangi tanggungan" onClick={() => setSDep(String(Math.max(0, tanggungan - 1)))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm disabled:opacity-40" disabled={tanggungan === 0}><Minus size={15} /></button>
                  <span className="text-sm font-bold text-slate-900">{tanggungan} orang</span>
                  <button type="button" aria-label="Tambah tanggungan" onClick={() => setSDep(String(Math.min(MAX_TANGGUNGAN, tanggungan + 1)))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm disabled:opacity-40" disabled={tanggungan === MAX_TANGGUNGAN}><Plus size={15} /></button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">PTKP setahun {rp(ptkp)} — Rp54 jt untuk diri sendiri{kawin ? ' + Rp4,5 jt kawin' : ''}{tanggungan ? ` + ${tanggungan} × Rp4,5 jt tanggungan` : ''}.</p>
          </section>

          {/* Penghasilan */}
          <section className={cn(card, 'p-5 md:p-6')}>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Penghasilan {year}</h2>
            <p className="text-sm text-slate-500">Leo menebak jenisnya dari kategori. Ubah kalau kurang tepat — hitungan langsung menyesuaikan.</p>
            {loading ? <Skeleton className="mt-4 h-32" /> : incomeCats.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Belum ada pemasukan tercatat di {year}.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-slate-50">
                {incomeCats.map((c) => (
                  <li key={c.cat} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">{categoryEmoji(c.cat)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{c.cat}</span>
                      <span className="block truncate text-xs text-slate-400">{KINDS.find((k) => k.id === c.kind)?.hint}</span>
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{rp(c.total)}</span>
                    <label className="relative">
                      <select
                        aria-label={`Jenis penghasilan ${c.cat}`}
                        value={c.kind}
                        onChange={(e) => setSKinds(JSON.stringify({ ...kindOverride, [c.cat]: e.target.value }))}
                        className={cn('appearance-none rounded-full py-1.5 pl-3 pr-7 text-xs font-semibold outline-none', c.kind === 'bukan' ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-700 ring-1 ring-slate-200')}
                      >
                        {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Hitungan */}
          <section className={cn(card, 'p-5 md:p-6')}>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Hitungan PPh</h2>
            <p className="text-sm text-slate-500">Angka abu-abu bisa diisi dari bukti potong supaya lebih akurat.</p>
            <div className="mt-4 space-y-1 text-sm">
              {brutoKerja > 0 || byKind('kerja') > 0 ? (
                <>
                  <Line label="Penghasilan bruto pekerjaan" hint={num(input.a1Bruto) ? 'dari bukti potong A1' : 'dari catatan gaji'} value={brutoKerja} />
                  <InputLine label="Bruto di bukti potong A1 (opsional)" value={input.a1Bruto} onChange={(v) => setInput('a1Bruto', v)} />
                  <Line label="Biaya jabatan" hint="5%, maks. Rp6 jt/tahun" value={-biayaJabatan} />
                  <InputLine label="Iuran pensiun / JHT yang kamu bayar" value={input.iuran} onChange={(v) => setInput('iuran', v)} minus />
                  <Line label="Neto pekerjaan" value={netoKerja} strong />
                </>
              ) : null}
              {brutoBebas > 0 && (
                <>
                  <Line label="Bruto pekerjaan bebas" value={brutoBebas} />
                  <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                    <span className="text-slate-600">Norma (NPPN)</span>
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <input inputMode="numeric" aria-label="Persentase norma" value={input.norma} onChange={(e) => setInput('norma', e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-9 bg-transparent text-right font-semibold text-slate-900 outline-none" />%
                    </span>
                  </div>
                  <Line label="Neto pekerjaan bebas" value={netoBebas} strong />
                </>
              )}
              <InputLine label="Zakat / sumbangan keagamaan wajib (via lembaga resmi)" value={input.zakat} onChange={(v) => setInput('zakat', v)} minus />
              <Line label="Penghasilan neto" value={neto} strong />
              <Line label={`PTKP ${kawin ? 'K' : 'TK'}/${tanggungan}`} value={-ptkp} />
              <Line label="Penghasilan kena pajak (PKP)" hint="dibulatkan ke ribuan" value={pkp} strong />
              <button type="button" onClick={() => setShowBrackets((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50">
                <span className="font-semibold text-slate-800">PPh terutang (Pasal 17)</span>
                <span className="flex items-center gap-1 font-bold text-slate-900 tabular-nums">{rp(terutang)} <ChevronDown size={14} className={cn('text-slate-400 transition-transform', showBrackets && 'rotate-180')} /></span>
              </button>
              <AnimatePresence initial={false}>
                {showBrackets && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mx-3 mb-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      {bracketRows.length === 0 ? 'PKP nol — tidak ada PPh terutang.' : bracketRows.map((b) => (
                        <div key={b.from} className="flex justify-between py-0.5 tabular-nums">
                          <span>{Math.round(b.rate * 100)}% × {rp(b.base)}</span><span>{rp(b.tax)}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <InputLine label="PPh 21 dipotong kantor (A1)" value={sPph21 ?? ''} onChange={setSPph21} minus />
              <InputLine label="PPh 23 dipotong klien" value={input.pph23} onChange={(v) => setInput('pph23', v)} minus />
              <div className={cn('mt-2 flex items-center justify-between rounded-2xl px-4 py-3', status === 'kurang' ? 'bg-rose-50' : status === 'lebih' ? 'bg-emerald-50' : 'bg-slate-100')}>
                <span className={cn('font-bold', hasilColor)}>{status === 'kurang' ? 'Kurang bayar' : status === 'lebih' ? 'Lebih bayar' : 'Nihil'}</span>
                <span className={cn('text-lg font-extrabold tabular-nums', hasilColor)}>{rp(Math.abs(hasil))}</span>
              </div>
              {(omzetUsaha > 0 || finalLain > 0) && (
                <div className="mt-3 rounded-2xl bg-indigo-50/60 p-4 text-[13px] text-slate-600">
                  <p className="font-bold text-slate-800">Dilaporkan terpisah (PPh final)</p>
                  {omzetUsaha > 0 && <p className="mt-1">Peredaran bruto usaha {rp(omzetUsaha)} · PPh final 0,5% ±{rp(umkmFinal)}{omzetUsaha <= UMKM_BEBAS ? ' (masih di bawah Rp500 jt)' : ''}</p>}
                  {finalLain > 0 && <p className="mt-1">Bunga, sewa, dividen, hadiah {rp(finalLain)} — pajaknya umumnya sudah dipotong.</p>}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Saran Leo */}
          {tips.length > 0 && (
            <section className={cn(card, 'p-5')}>
              <div className="flex items-center gap-2">
                <LeoMascot mood="watch" size={40} />
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Catatan Leo</h2>
              </div>
              <ul className="mt-3 space-y-2">
                {tips.map((t, i) => (
                  <motion.li key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">{t}</motion.li>
                ))}
              </ul>
              <button type="button" onClick={askLeo} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><MessageCircle size={15} /> Tanya Leo soal SPT-ku</button>
            </section>
          )}

          {/* Langkah lapor */}
          <section className={cn(card, 'p-5')}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Langkah lapor</h2>
              <span className="text-sm font-semibold text-slate-500">{doneSteps}/{STEPS.length}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${(doneSteps / STEPS.length) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-1">
              {STEPS.map((s, i) => {
                const done = Boolean(steps[s.id]);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => setSSteps(JSON.stringify({ ...steps, [s.id]: !done }))} className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50" aria-pressed={done}>
                      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors', done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-400')}>
                        {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block text-sm font-bold', done ? 'text-slate-400 line-through' : 'text-slate-800')}>{s.title}</span>
                        <span className="block text-xs text-slate-500">{s.desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <a href="https://coretaxdjp.pajak.go.id" target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200">
              Buka Coretax DJP <ExternalLink size={14} />
            </a>
          </section>
        </div>
      </div>

      {/* Harta & utang */}
      <section className="print:hidden">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Harta & utang untuk lampiran SPT</h2>
        <p className="text-sm text-slate-500">Posisi terkini dari Leosiqra. Di SPT, harta dilaporkan per 31 Desember dengan <b>harga perolehan</b> — sesuaikan nilainya bila perlu.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AssetGroup title="Kas & setara kas" rows={harta.kas} />
          <AssetGroup title="Investasi" rows={harta.investasi} hint="nilai penempatan" />
          <AssetGroup title="Barang & kendaraan" rows={harta.barang} hint="harga beli" />
          <AssetGroup title="Piutang" rows={piutang} />
          <AssetGroup title="Utang" rows={utang} negative />
          <div className={cn(card, 'flex flex-col justify-center p-5')}>
            <p className="text-sm font-semibold text-slate-500">Harta bersih</p>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{rp(totalHarta - totalUtang)}</p>
            <p className="text-xs text-slate-500">Harta {short(totalHarta)} − utang {short(totalUtang)}</p>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-slate-400 print:hidden">
        Perkiraan pembanding dari data yang kamu catat — bukan pengganti perhitungan resmi. Aturan: UU HPP (tarif Pasal 17), PTKP PMK 101/2016, biaya jabatan PMK 250/2008, PP 55/2022.
      </p>

      {/* ===== Versi cetak ===== */}
      <div className="hidden text-[11px] leading-relaxed text-slate-800 print:block">
        <div className="mb-5 flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Image src="/images/Logo-new.png" alt="Leosiqra" width={32} height={32} />
            <span className="text-sm font-bold">Leosiqra</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">Draft SPT Tahunan PPh Orang Pribadi</p>
            <p className="text-[10px] text-slate-500">Tahun pajak {year} · dicetak {now.toLocaleDateString('id-ID')}</p>
          </div>
        </div>
        <PrintTable title="Perhitungan" rows={[
          ['Status PTKP', `${kawin ? 'K' : 'TK'}/${tanggungan}`], ['Bruto pekerjaan', rp(brutoKerja)], ['Biaya jabatan', rp(biayaJabatan)], ['Iuran pensiun/JHT', rp(iuran)],
          ['Bruto pekerjaan bebas', rp(brutoBebas)], [`Neto pekerjaan bebas (norma ${norma}%)`, rp(netoBebas)], ['Zakat', rp(zakat)], ['Penghasilan neto', rp(neto)], ['PTKP', rp(ptkp)], ['PKP', rp(pkp)],
          ['PPh terutang', rp(terutang)], ['PPh 21 dipotong', rp(pph21)], ['PPh 23 dipotong', rp(pph23)], [status === 'kurang' ? 'Kurang bayar' : status === 'lebih' ? 'Lebih bayar' : 'Nihil', rp(Math.abs(hasil))],
          ['Peredaran bruto usaha (PP 55)', rp(omzetUsaha)], ['Penghasilan final lain', rp(finalLain)],
        ]} />
        <PrintTable title="Harta" rows={[...harta.kas, ...harta.investasi, ...harta.barang, ...piutang].map((h) => [`${h.name} (${h.sub})`, rp(h.value)])} />
        <PrintTable title="Utang" rows={utang.map((h) => [`${h.name} (${h.sub})`, rp(h.value)])} />
        <p className="mt-4 text-[9px] text-slate-500">Draft pribadi dari catatan Leosiqra — bukan dokumen resmi DJP. Lapor resmi melalui coretaxdjp.pajak.go.id.</p>
      </div>
    </div>
  );
}

function Line({ label, hint, value, strong }: { label: string; hint?: string; value: number; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl px-3 py-2', strong && 'bg-slate-50')}>
      <span className={cn(strong ? 'font-semibold text-slate-800' : 'text-slate-600')}>
        {label}{hint && <span className="ml-1.5 text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={cn('tabular-nums', strong ? 'font-bold text-slate-900' : 'text-slate-700')}>{value < 0 ? '−' : ''}{rp(Math.abs(value))}</span>
    </div>
  );
}

function InputLine({ label, value, onChange, minus }: { label: string; value: string; onChange: (v: string) => void; minus?: boolean }) {
  const n = num(value);
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl px-3 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
        <span className="text-xs text-slate-400">{minus ? '−Rp' : 'Rp'}</span>
        <input inputMode="numeric" value={n ? n.toLocaleString('id-ID') : ''} placeholder="0" onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} className="w-28 bg-transparent text-right font-semibold text-slate-900 outline-none tabular-nums placeholder:text-slate-300" />
      </span>
    </label>
  );
}

function AssetGroup({ title, rows, hint, negative }: { title: string; rows: { name: string; sub: string; value: number }[]; hint?: string; negative?: boolean }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className={cn(card, 'p-5')}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold text-slate-900">{title}{hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}</p>
        <p className={cn('font-bold tabular-nums', negative ? 'text-rose-600' : 'text-slate-900')}>{rp(total)}</p>
      </div>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-400">Belum ada.</p> : (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{r.name} <span className="text-xs text-slate-400">· {r.sub}</span></span>
              <span className="shrink-0 tabular-nums text-slate-600">{rp(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrintTable({ title, rows }: { title: string; rows: (string | number)[][] }) {
  return (
    <div className="mb-4">
      <p className="mb-1 bg-slate-800 px-2 py-1 text-[11px] font-bold text-white">{title}</p>
      <table className="w-full border-collapse">
        <tbody>
          {rows.length === 0 ? <tr><td className="border border-slate-300 px-2 py-1">-</td></tr> : rows.map((r, i) => (
            <tr key={i}>
              <td className="border border-slate-300 px-2 py-1">{r[0]}</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{r[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
