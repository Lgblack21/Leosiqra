"use client";

import { useState } from 'react';
import {
  Compass,
  Play,
  LayoutDashboard,
  TrendingUp,
  ArrowUpDown,
  Wallet,
  Target,
  UserCircle,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { ProductTour, TourStep } from '@/components/tour/ProductTour';
import type { DemoKind } from '@/components/tour/FeatureDemo';

interface GuideItem {
  name: string;
  desc: string;
}

interface GuideSection {
  id?: string;
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle: string;
  items: GuideItem[];
}

// `id` harus sama dengan id grup di src/lib/navigation.ts — tur di bawah
// menyorot elemen [data-tour="sidebar-group-<id>"] di Sidebar.
const sections: GuideSection[] = [
  {
    id: 'primary',
    icon: LayoutDashboard,
    color: 'bg-indigo-600',
    title: 'Menu Utama',
    subtitle: 'Selalu ada di paling atas sidebar',
    items: [
      { name: 'Ringkasan', desc: 'Pengeluaran hari ini, catatan hari ini, ke mana uangmu bulan ini (per kategori + budget), transaksi terbaru, dan kartu fitur: saldo bersih, tabungan, investasi, tagihan kartu, hutang, pajak. Ganti bulan lewat kalender di bagian Pengeluaran.' },
      { name: 'AI Leosiqra', desc: 'Asisten AI yang sudah tahu seluruh data keuanganmu (transaksi, rekening, investasi, hutang) — tanya apa saja soal kondisi finansialmu, atau soal harga pasar terkini, dalam Bahasa Indonesia.' },
    ],
  },
  {
    id: 'transaksi',
    icon: ArrowUpDown,
    color: 'bg-emerald-600',
    title: 'Transaksi',
    subtitle: 'Catat setiap uang masuk & keluar',
    items: [
      { name: 'Catat Transaksi', desc: 'Form input transaksi harian versi lengkap: pilih jenis (pemasukan/pengeluaran), rekening, kategori, mata uang, dan catatan.' },
      { name: 'Riwayat Transaksi', desc: 'Riwayat semua transaksi dalam satu bulan, bisa dicari & difilter per periode. Ringkasan atas menampilkan total pemasukan, pengeluaran, dan Saldo Bersih (total saldo semua rekening saat ini).' },
      { name: 'Transfer & Top Up', desc: 'Catat perpindahan dana antar rekening kamu sendiri (top up e-wallet dari rekening bank, transfer antar rekening) — otomatis tercatat sebagai pengeluaran di sumber dan pemasukan di tujuan.' },
      { name: 'Transaksi Rutin', desc: 'Jadwalkan transaksi yang berulang otomatis (langganan bulanan, gaji rutin, cicilan) — cukup diatur sekali, sistem yang catat setiap periodenya.' },
    ],
  },
  {
    id: 'aset',
    icon: Wallet,
    color: 'bg-slate-700',
    title: 'Rekening & Aset',
    subtitle: 'Tempat uangmu disimpan',
    items: [
      { name: 'Rekening', desc: 'Daftar semua akun keuangan kamu (bank, e-wallet, cash, kartu kredit) beserta saldo & mata uang masing-masing. Ketuk satu rekening untuk lihat uang masuk/keluar bulan ini dan transaksi terakhirnya; untuk kartu kredit & paylater ada limit, terpakai, sisa limit, dan tagihan + jatuh tempo. Urutan rekening bisa diatur lewat tombol Atur urutan.' },
      { name: 'Tabungan', desc: 'Catat setoran ke tujuan tabungan tertentu (dana darurat, liburan, dll) dari rekening manapun — total tersimpan otomatis dijumlah lintas rekening/mata uang.' },
    ],
  },
  {
    id: 'investasi',
    icon: TrendingUp,
    color: 'bg-blue-600',
    title: 'Investasi',
    subtitle: 'Kelola posisi investasi per jenis aset',
    items: [
      { name: 'Ringkasan Portofolio', desc: 'Ringkasan portofolio investasi lintas jenis (saham, deposito, lainnya) dalam satu halaman — total dana yang ditanam, nilai saat ini, dan estimasi keuntungan.' },
      { name: 'Saham', desc: 'Catat pembelian/penjualan saham: kode saham, bursa, jumlah lembar, harga per lembar. Sistem hitung otomatis untung/rugi dan nilai portofolio saat ini.' },
      { name: 'Deposito', desc: 'Catat penempatan deposito dengan bunga & tenor — sistem otomatis proyeksikan hasil akhir jatuh tempo dan mencatatnya sebagai baris terpisah agar mudah dipantau.' },
      { name: 'Investasi Lainnya', desc: 'Untuk aset di luar saham/deposito: emas, kripto, reksadana, dll. Catat kuantitas dan harga per satuan, bisa juga catat mode "Jual" untuk melepas sebagian/seluruh posisi.' },
      { name: 'Data Pasar', desc: 'Pantau harga live kripto (BTC, ETH, SOL, dll), emas, dan kurs mata uang dunia — sumber data yang sama dipakai asisten AI Leosiqra saat kamu bertanya soal harga pasar.' },
    ],
  },
  {
    id: 'perencanaan',
    icon: Target,
    color: 'bg-rose-600',
    title: 'Perencanaan & Laporan',
    subtitle: 'Atur target, pantau kewajiban, dan siapkan laporan',
    items: [
      { name: 'Kategori & Anggaran', desc: 'Di Pengaturan → Kategori & Anggaran: tetapkan anggaran per kategori (bulanan atau tahunan). Leosiqra membandingkannya otomatis dengan transaksi riil supaya kamu tahu kapan mendekati/melewati batas.' },
      { name: 'Hutang & Piutang', desc: 'Catat siapa berutang ke kamu (Piutang) dan ke siapa kamu berutang (Hutang) — termasuk kartu kredit/paylater. Bisa hitung otomatis bunga & cicilan per bulan, dan tandai lunas begitu selesai.' },
      { name: 'Laporan Tahunan', desc: 'Laporan tahunan resmi: perbandingan pemasukan-pengeluaran per bulan dalam satu tahun, dan rincian anggaran tahunan. Cocok untuk evaluasi akhir tahun.' },
      { name: 'Pajak Center', desc: 'Bantu siapkan data untuk SPT Tahunan: daftar harta (saldo rekening + investasi), daftar utang/piutang, dan penghasilan neto setahun — semua dihitung otomatis dari transaksi yang sudah kamu catat.' },
    ],
  },
  {
    id: 'akun',
    icon: UserCircle,
    color: 'bg-purple-600',
    title: 'Akun & Bantuan',
    subtitle: 'Profil, pengaturan data, dan bantuan',
    items: [
      { name: 'Profil & Keamanan', desc: 'Data pribadi (nama, foto, WhatsApp), keamanan (ganti password, 2FA), dan ringkasan saldo semua rekening ("Active Banks").' },
      { name: 'Pengaturan', desc: 'Ikon ⚙️ atau foto profil di menu kiri: kategori & subkategori, anggaran, mata uang, notifikasi, keamanan, paket, dan aplikasi terhubung.' },
      { name: 'Panduan', desc: 'Halaman yang sedang kamu baca ini — penjelasan lengkap semua fitur, plus tombol tur interaktif di bawah.' },
      { name: 'Saran & Kritik', desc: 'Kirim saran, kritik, laporan masalah, atau pujian langsung ke tim Leosiqra — lengkap dengan riwayat dan balasan dari kami.' },
      { name: 'Hubungi Kami', desc: 'Ajukan upgrade ke paket PRO, lihat instruksi pembayaran (transfer bank/QRIS), dan konfirmasi pembayaran yang sudah dilakukan.' },
    ],
  },
];

const extras: GuideSection[] = [
  {
    icon: Smartphone,
    color: 'bg-orange-600',
    title: 'Input Cepat',
    subtitle: 'Halaman ringan untuk dipasang di layar utama HP',
    items: [
      { name: 'Input Cepat (/input-cepat)', desc: 'Halaman terpisah yang ringan, dirancang untuk di-"Add to Home Screen" di HP — buka, pilih rekening (lengkap dengan saldo & logo), isi nominal, simpan. Cocok untuk catat pengeluaran on-the-go tanpa buka aplikasi penuh.' },
    ],
  },
];

const allSections = [...sections, ...extras];

// Peraga & langkah cara pakai per grup menu sidebar (id = GuideSection.id).
const SECTION_DEMO: Record<string, { demo: DemoKind; how: string[] }> = {
  primary: { demo: 'dashboard', how: ['Buka Dashboard untuk ringkasan bulan ini', 'Ganti bulan lewat kalender di kanan atas', 'Tanya apa saja di AI Leosiqra'] },
  transaksi: { demo: 'input', how: ['Buka Catat Transaksi atau tombol Tambah transaksi di menu samping', 'Pilih rekening, kategori & isi nominal', 'Simpan — saldo rekening ter-update otomatis'] },
  aset: { demo: 'rekening', how: ['Tambah rekening bank, e-wallet, tunai, atau kartu', 'Isi saldo saat ini sekali saja', 'Saldo berubah sendiri setiap kamu mencatat'] },
  investasi: { demo: 'investasi', how: ['Pilih jenis: Saham, Deposito, atau Lainnya', 'Catat jumlah & harga beli', 'Nilai & keuntungan dihitung otomatis'] },
  perencanaan: { demo: 'budget', how: ['Pasang anggaran per kategori di Pengaturan → Kategori & Anggaran', 'Catat utang/piutang & cicilannya', 'Lihat Laporan Tahunan & Pajak Center'] },
  akun: { demo: 'profil', how: ['Lengkapi profil & foto', 'Aktifkan verifikasi 2 langkah', 'Atur kategori, anggaran & mata uang di Pengaturan'] },
};

const buildTourSteps = (): TourStep[] => {
  const steps: TourStep[] = [
    {
      title: 'Selamat Datang di Leosiqra 👋',
      content: 'Ini tur singkat mengenalkan navigasi utama aplikasi. Klik "Lanjut" untuk mulai, atau "Lewati Tur" kapan saja.',
      demo: 'menu',
      how: ['Menu kiri: Keuangan (Ringkasan, Transaksi, Laporan, Rekening) & Fitur', '"Semua fitur" membuka daftar lengkap', 'Tombol "Tambah transaksi" (atau tekan N) selalu siap'],
    },
  ];
  for (const section of sections) {
    const extra = section.id ? SECTION_DEMO[section.id] : undefined;
    steps.push({
      // Menu samping kini 2 grup: Keuangan (menu utama & transaksi) dan Fitur (sisanya).
      target: `[data-tour="sidebar-group-${section.id === 'primary' || section.id === 'transaksi' ? 'keuangan' : 'fitur'}"]`,
      title: `Menu: ${section.title}`,
      content: `${section.subtitle}. Berisi: ${section.items.map((i) => i.name).join(', ')}.`,
      ...extra,
    });
  }
  steps.push({
    title: 'Selesai! 🎉',
    content: 'Sekarang kamu sudah kenal semua bagian utama Leosiqra. Pasang juga aplikasinya di HP supaya mencatat bisa dari mana saja.',
    demo: 'install',
    how: ['Leosiqra — aplikasi lengkap di HP', 'Input Cepat — khusus catat kilat dari layar utama', 'Ulangi tur ini kapan saja lewat tombol "Mulai Tur"'],
    link: { href: '/install', label: '📱 Pasang di HP' },
  });
  return steps;
};

export default function PanduanPage() {
  const [tourActive, setTourActive] = useState(false);
  const tourSteps = buildTourSteps();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      <ProductTour steps={tourSteps} isActive={tourActive} onFinish={() => setTourActive(false)} />

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[24px] md:rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden shadow-xl shadow-emerald-600/20">
        <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest">
            <Compass size={14} /> Panduan Leosiqra
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
            Apa itu Leosiqra?
          </h1>
          <p className="text-sm md:text-base font-medium text-indigo-100 leading-relaxed">
            Leosiqra adalah dashboard keuangan pribadi: satu tempat untuk mencatat transaksi harian,
            memantau saldo semua rekening (bank, e-wallet, kartu kredit) lintas mata uang, mengelola
            investasi & tabungan, menyiapkan data pajak tahunan, dan bertanya ke asisten AI yang sudah
            paham kondisi keuanganmu. Halaman ini menjelaskan setiap fitur secara detail — atau kalau
            mau langsung praktik, klik tombol tur di bawah.
          </p>
          <button
            onClick={() => setTourActive(true)}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-emerald-700 font-black text-sm shadow-xl hover:bg-emerald-50 transition-all active:scale-95"
          >
            <Play size={16} className="fill-indigo-700" /> Mulai Tur
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {allSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="bg-white rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm overflow-hidden"
            >
              <div className="p-6 md:p-8 flex items-center gap-4 border-b border-slate-50 bg-slate-50/30">
                <div className={`w-11 h-11 rounded-xl ${section.color} text-white flex items-center justify-center shrink-0`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{section.title}</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {section.subtitle}
                  </p>
                </div>
              </div>
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item) => (
                  <div key={item.name} className="bg-slate-50/60 border border-slate-100 rounded-2xl p-5">
                    <h3 className="text-sm font-black text-slate-900 mb-1.5">{item.name}</h3>
                    <p className="text-[12px] font-medium text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
