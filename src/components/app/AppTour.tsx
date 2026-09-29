"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { FeatureDemo, HowTo, type DemoKind } from "@/components/tour/FeatureDemo";
import { lightTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// Tur aplikasi HP (/app): muncul sekali saat pertama membuka Beranda, bisa
// diputar ulang dari menu Lainnya (event START_APP_TOUR_EVENT).
const DONE_KEY = "leosiqra_app_tour_done";
export const START_APP_TOUR_EVENT = "leosiqra:start-app-tour";

interface Step {
  title: string;
  content: string;
  demo: DemoKind;
  how: string[];
  link?: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    title: "Selamat datang di Leosiqra 👋",
    content: "Beranda menampilkan total saldo semua rekening, plus pemasukan & pengeluaran bulan ini.",
    demo: "dashboard",
    how: ["Ketuk ikon mata untuk menyembunyikan saldo", "Geser daftar rekening untuk lihat semuanya", "Transaksi terbaru ada di bagian bawah"],
  },
  {
    title: "Catat transaksi",
    content: "Tombol + di tengah bawah membuka form catat. Ketik singkat saja — sisanya dikenali otomatis.",
    demo: "input",
    how: ["Ketuk tombol + ungu di tengah bawah", "Ketik “25rb kopi gopay” atau isi nominal", "Ketuk Simpan — bisa dibatalkan sesaat setelahnya"],
  },
  {
    title: "Foto struk",
    content: "Malas mengetik? Foto struk belanja, nominal & kategorinya dibaca otomatis.",
    demo: "scan",
    how: ["Buka Lainnya → Scan Struk (atau ikon kamera di form)", "Foto struk sampai terlihat jelas", "Periksa hasilnya, lalu simpan"],
  },
  {
    title: "Catat pakai suara",
    content: "Ucapkan transaksinya seperti ngobrol — cocok saat sedang di jalan.",
    demo: "voice",
    how: ["Ketuk ikon mikrofon di form catat", "Ucapkan: “makan siang 35 ribu”", "Cek hasilnya, lalu simpan"],
  },
  {
    title: "Aset",
    content: "Semua rekening bank, e-wallet, tunai, dan kartu kredit dengan saldonya masing-masing.",
    demo: "rekening",
    how: ["Buka tab Aset di bawah", "Ketuk + untuk menambah rekening", "Rekening dikelompokkan per jenis: tunai, bank, e-wallet"],
  },
  {
    title: "Statistik",
    content: "Lihat ke mana uangmu pergi, dikelompokkan per kategori dan per bulan.",
    demo: "statistik",
    how: ["Buka Lainnya → Statistik", "Pilih Pengeluaran atau Pemasukan", "Geser bulan dengan tombol ‹ ›"],
  },
  {
    title: "Rencanakan keuanganmu",
    content: "Budget, tabungan per tujuan, hutang & piutang, investasi, dan transaksi rutin — semua di menu Lainnya.",
    demo: "budget",
    how: ["Buka tab Lainnya", "Pasang budget per kategori", "Catat tabungan, hutang, atau investasi"],
  },
  {
    title: "Asisten AI",
    content: "Tanya apa saja soal keuanganmu, AI Leosiqra menjawab dari datamu sendiri.",
    demo: "ai",
    how: ["Buka Lainnya → Chat AI", "Ketik pertanyaan, mis. “aku boros di mana?”", "Baca jawaban & sarannya"],
  },
  {
    title: "Pasang Input Cepat juga",
    content: "Aplikasi kecil khusus mencatat kilat, ikonnya berbeda. Boleh dipasang berdampingan dengan Leosiqra.",
    demo: "install",
    how: ["Buka halaman pemasangan", "Ikuti langkah untuk HP-mu", "Catat langsung dari ikon Input Cepat"],
    link: { href: "/input-cepat?install=1", label: "⚡ Pasang Input Cepat" },
  },
];

const readDone = () => {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true; // storage diblokir — jangan paksa tur tiap kali dibuka
  }
};

export function AppTour() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* tidak tersimpan — tur bisa muncul lagi, tidak apa-apa */
    }
    setActive(false);
  }, []);

  // Otomatis sekali di Beranda (bukan di onboarding), beri jeda supaya
  // konten Beranda sempat tampil dulu.
  useEffect(() => {
    if (pathname !== "/app" || readDone()) return;
    const t = setTimeout(start, 1400);
    return () => clearTimeout(t);
  }, [pathname, start]);

  useEffect(() => {
    window.addEventListener(START_APP_TOUR_EVENT, start);
    return () => window.removeEventListener(START_APP_TOUR_EVENT, start);
  }, [start]);

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {active && s && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={s.title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-2xl dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-indigo-600" : i < step ? "w-1.5 bg-indigo-300" : "w-1.5 bg-slate-200 dark:bg-slate-700")} />
                ))}
              </div>
              <button type="button" onClick={finish} aria-label="Tutup tur" className="p-1 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{s.title}</h2>
                <p className="mb-3 mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{s.content}</p>
                <FeatureDemo kind={s.demo} />
                <p className="mb-1.5 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Cara pakai</p>
                <HowTo steps={s.how} />
                {s.link && (
                  <Link href={s.link.href} onClick={finish} className="mt-4 flex items-center justify-center rounded-2xl bg-indigo-50 py-3 text-sm font-black text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                    {s.link.label}
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" onClick={finish} className="px-2 py-2 text-xs font-bold text-slate-400">
                Lewati
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button type="button" onClick={() => { lightTap(); setStep(step - 1); }} aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { lightTap(); if (isLast) finish(); else setStep(step + 1); }}
                  className="h-11 rounded-xl bg-indigo-600 px-6 text-sm font-black text-white shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  {isLast ? "Selesai" : "Lanjut"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
