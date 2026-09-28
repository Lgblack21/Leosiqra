"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Mic, Camera, Sparkles, Check } from "lucide-react";

// Contoh kalimat & hasil bacaannya — sama dengan yang dikenali "ketik pintar"
// di aplikasi (nominal, kategori, rekening, tanggal).
const DEMOS = [
  { text: "25rb kopi bca kemarin", amount: "25.000", cat: "Makanan › Kopi", acc: "BCA Blue", date: "Kemarin", type: "Pengeluaran" },
  { text: "gajian lima juta ke platinum", amount: "5.000.000", cat: "Gaji", acc: "BCA Platinum", date: "Hari ini", type: "Pemasukan" },
  { text: "bensin 50rb pakai cash", amount: "50.000", cat: "Transport › Bensin", acc: "Cash", date: "Hari ini", type: "Pengeluaran" },
];

// Mockup HP yang "mengetik" sendiri lalu mengisi form — memperlihatkan fitur
// khas Input Cepat tanpa video. Berhenti di demo pertama kalau "kurangi gerakan".
export function QuickInputShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-120px" });
  const reduce = useReducedMotion();
  const [demo, setDemo] = useState(0);
  const [typed, setTyped] = useState(reduce ? DEMOS[0].text : "");
  const [filled, setFilled] = useState(Boolean(reduce));

  useEffect(() => {
    if (!inView || reduce) return;
    const d = DEMOS[demo];
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const type = () => {
      i += 1;
      setTyped(d.text.slice(0, i));
      if (i < d.text.length) t = setTimeout(type, 55 + Math.random() * 60);
      else t = setTimeout(() => { setFilled(true); t = setTimeout(() => setDemo((x) => (x + 1) % DEMOS.length), 2600); }, 450);
    };
    // Reset di callback timer (bukan sinkron di effect) lalu mulai mengetik.
    t = setTimeout(() => { setTyped(""); setFilled(false); t = setTimeout(type, 350); }, 150);
    return () => clearTimeout(t);
  }, [demo, inView, reduce]);

  const d = DEMOS[demo];
  const income = d.type === "Pemasukan";

  return (
    <div ref={ref} className="relative mx-auto w-[290px] sm:w-[320px]">
      <div aria-hidden className="absolute -inset-10 rounded-[60px] bg-[radial-gradient(closest-side,rgba(214,182,126,0.22),transparent)] blur-2xl" />
      <div className="relative rounded-[46px] border border-white/10 bg-[#0d0f14] p-2.5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[38px] bg-[#f7f5f0] px-4 pb-6 pt-9 text-slate-900">
          <div aria-hidden className="absolute left-1/2 top-2.5 h-5 w-24 -translate-x-1/2 rounded-full bg-[#0d0f14]" />
          <p className="text-[13px] font-black">Input Cepat</p>
          <p className="text-[10px] font-bold text-slate-400">Halo, Leo</p>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white px-3 py-2.5 shadow-sm">
            <Sparkles size={14} className="shrink-0 text-indigo-500" />
            <span className="min-h-[18px] flex-1 truncate text-[12px] font-bold">
              {typed}
              {!filled && <span className="ml-px inline-block h-3.5 w-[1.5px] translate-y-0.5 animate-pulse bg-indigo-500" />}
            </span>
            <Camera size={14} className="shrink-0 text-slate-400" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Mic size={13} /></span>
          </div>

          <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-sm">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-[10px] font-black">
              <span className={`rounded-lg py-1.5 text-center transition-colors duration-500 ${filled && !income ? "bg-rose-500 text-white" : "text-slate-400"}`}>Pengeluaran</span>
              <span className={`rounded-lg py-1.5 text-center transition-colors duration-500 ${filled && income ? "bg-emerald-500 text-white" : "text-slate-400"}`}>Pemasukan</span>
            </div>
            <div className="mt-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nominal</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={filled ? d.amount : "0"}
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`text-2xl font-black tabular-nums ${filled ? (income ? "text-emerald-600" : "text-rose-600") : "text-slate-200"}`}
                >
                  <span className="mr-1 text-sm text-slate-300">IDR</span>{filled ? d.amount : "0"}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {([["Rekening", d.acc], ["Kategori", d.cat], ["Tanggal", d.date]] as const).map(([k, v], i) => (
              <div key={k} className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-[11px] shadow-sm">
                <span className="font-bold text-slate-400">{k}</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={filled ? v : "-"}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: filled ? 0.12 * (i + 1) : 0 }}
                    className={`font-black ${filled ? "text-slate-800" : "text-slate-300"}`}
                  >
                    {filled ? v : "—"}
                  </motion.span>
                </AnimatePresence>
              </div>
            ))}
          </div>

          <motion.div
            animate={{ scale: filled ? [1, 1.04, 1] : 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className={`mt-4 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[12px] font-black text-white transition-colors duration-500 ${filled ? (income ? "bg-emerald-500" : "bg-rose-500") : "bg-slate-300"}`}
          >
            <Check size={14} /> Simpan {filled ? d.type : ""}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
