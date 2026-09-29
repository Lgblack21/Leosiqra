"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check, Sparkles, Plus, ShieldCheck, Mic, ScanLine, Wallet, Building2, CreditCard, Repeat, CalendarClock,
  ChevronRight, PiggyBank, Target, TrendingUp, HandCoins, FileText, Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Peraga mini "cara pakai" untuk tiap langkah tur. Setiap adegan berputar
// terus (loop) dan cukup kecil untuk kartu tur; tetap diam & terbaca saat
// pengguna memilih "kurangi gerakan" di perangkatnya.
export type DemoKind =
  | "dashboard" | "input" | "rekening" | "kartu" | "investasi" | "tabungan" | "budget" | "hutang"
  | "rutin" | "laporan" | "pajak" | "ai" | "kategori" | "profil" | "menu" | "tambah-cepat"
  | "transaksi" | "statistik" | "scan" | "voice" | "install" | "selamat";

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// Siklus berulang: `tick` naik tiap `ms`, dipakai adegan untuk menentukan fase.
function useCycle(phases: number, ms = 1100) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setTick((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms, reduce]);
  return reduce ? phases - 1 : tick % phases;
}

function Count({ to, active, format = rp }: { to: number; active: boolean; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    if (!active) {
      const r = requestAnimationFrame(() => setV(0));
      return () => cancelAnimationFrame(r);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, to, reduce]);
  return <>{format(v)}</>;
}

const Frame = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/60 p-3.5 ring-1 ring-slate-100", className)}>
    {children}
  </div>
);

const Pop = ({ show, children, className, delay = 0 }: { show: boolean; children: React.ReactNode; className?: string; delay?: number }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 24, delay }}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

const Row = ({ icon: Icon, tone, label, value, sub }: { icon: React.ElementType; tone: string; label: string; value: React.ReactNode; sub?: string }) => (
  <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm">
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone)}><Icon size={14} /></span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[11px] font-bold text-slate-800">{label}</span>
      {sub && <span className="block truncate text-[9px] text-slate-400">{sub}</span>}
    </span>
    <span className="shrink-0 text-[11px] font-black tabular-nums text-slate-800">{value}</span>
  </div>
);

function Dashboard() {
  const f = useCycle(4, 1300);
  return (
    <Frame>
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 p-3 text-white">
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">Saldo bersih</p>
        <p className="text-lg font-black tabular-nums"><Count to={12_475_000} active={f >= 1} /></p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          ["Masuk", 8_500_000, "text-emerald-600"],
          ["Keluar", 3_210_000, "text-rose-500"],
          ["Tabungan", 1_500_000, "text-indigo-600"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl bg-white p-2 shadow-sm">
            <p className="text-[8px] font-bold uppercase text-slate-400">{l as string}</p>
            <p className={cn("text-[10px] font-black tabular-nums", c as string)}><Count to={v as number} active={f >= 1} format={(n) => (n / 1e6).toFixed(1).replace(".", ",") + " jt"} /></p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Input() {
  const text = "25rb kopi gopay";
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % (text.length + 14);
      setN(Math.min(i, text.length));
    }, 130);
    return () => clearInterval(t);
  }, [reduce]);
  const done = n >= text.length;
  return (
    <Frame>
      <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-white px-2.5 py-2">
        <Sparkles size={13} className="text-indigo-500" />
        <span className="text-xs font-bold text-slate-800">{text.slice(0, n)}<span className="ml-px inline-block h-3 w-px animate-pulse bg-indigo-500 align-middle" /></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Rp 25.000", "Makanan › Kopi", "GoPay", "Hari ini"].map((c, i) => (
          <Pop key={c} show={done} delay={i * 0.08} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100">{c}</Pop>
        ))}
      </div>
      <Pop show={done} delay={0.45} className="absolute inset-x-3.5 bottom-3 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"><Check size={11} strokeWidth={3} /></span>
        Tersimpan · saldo GoPay ter-update
      </Pop>
    </Frame>
  );
}

function Rekening() {
  const f = useCycle(5, 900);
  const rows: [string, string, number, React.ElementType, string][] = [
    ["BCA", "Bank", 8_200_000, Building2, "bg-blue-50 text-blue-600"],
    ["GoPay", "E-wallet", 475_000, Wallet, "bg-sky-50 text-sky-600"],
    ["Dompet", "Tunai", 350_000, Wallet, "bg-emerald-50 text-emerald-600"],
  ];
  return (
    <Frame>
      <div className="space-y-1.5">
        {rows.map(([l, s, v, I, t], i) => (
          <Pop key={l} show={f > i} className="">
            <Row icon={I} tone={t} label={l} sub={s} value={rp(v)} />
          </Pop>
        ))}
      </div>
      <Pop show={f >= 4} className="absolute bottom-3 right-3.5 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black text-white">Total {rp(9_025_000)}</Pop>
    </Frame>
  );
}

function Kartu() {
  const f = useCycle(3, 1400);
  return (
    <Frame>
      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-indigo-900 p-3 text-white">
        <div className="flex items-center justify-between text-[9px] font-bold opacity-80"><span>BCA Visa</span><CreditCard size={13} /></div>
        <p className="mt-3 text-[9px] opacity-70">Terpakai dari limit Rp 20 jt</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
          <motion.div className="h-full rounded-full bg-amber-300" animate={{ width: f >= 1 ? "38%" : "0%" }} transition={{ duration: 0.9 }} />
        </div>
      </div>
      <Pop show={f >= 2} className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">
        <CalendarClock size={13} /> Jatuh tempo 5 Okt · minimum Rp 760.000
      </Pop>
    </Frame>
  );
}

function Investasi() {
  const f = useCycle(3, 1500);
  const d = "M0,58 C20,54 30,40 50,44 C70,48 80,30 100,28 C120,26 130,34 150,22 C170,12 185,10 200,6";
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500">Portofolio</p>
        <Pop show={f >= 2} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">+6,4%</Pop>
      </div>
      <p className="text-base font-black text-slate-800 tabular-nums"><Count to={37_670_000} active={f >= 1} /></p>
      <svg viewBox="0 0 200 64" className="mt-1 h-16 w-full" preserveAspectRatio="none">
        <motion.path d={d} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" animate={{ pathLength: f >= 1 ? 1 : 0 }} transition={{ duration: 1.2 }} />
      </svg>
      <div className="flex gap-1.5">{["Saham", "Emas", "Deposito"].map((t) => <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500 shadow-sm">{t}</span>)}</div>
    </Frame>
  );
}

function Tabungan() {
  const f = useCycle(4, 1100);
  const pct = [0.35, 0.35, 0.6, 0.6][f];
  return (
    <Frame className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#e0e7ff" strokeWidth="4" />
          <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" animate={{ strokeDashoffset: 1 - pct }} transition={{ duration: 0.8 }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-indigo-700">{Math.round(pct * 100)}%</span>
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-black text-slate-800"><PiggyBank size={14} className="text-rose-500" /> Dana Darurat</p>
        <p className="text-[10px] text-slate-500">Target Rp 20 jt</p>
        <Pop show={f >= 2} className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">+ Setor Rp 5 jt</Pop>
      </div>
    </Frame>
  );
}

function Budget() {
  const f = useCycle(3, 1300);
  const rows: [string, number][] = [["Makanan", 72], ["Transportasi", 45], ["Hiburan", 96]];
  return (
    <Frame>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><Target size={12} /> Budget bulan ini</p>
      <div className="space-y-2.5">
        {rows.map(([l, p], i) => (
          <div key={l}>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-700"><span>{l}</span><span className={p > 90 && f >= 1 ? "text-rose-500" : ""}>{f >= 1 ? p : 0}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <motion.div className={cn("h-full rounded-full", p > 90 ? "bg-rose-500" : p > 70 ? "bg-amber-400" : "bg-emerald-500")} animate={{ width: f >= 1 ? `${p}%` : "0%" }} transition={{ duration: 0.9, delay: i * 0.12 }} />
            </div>
          </div>
        ))}
      </div>
      <Pop show={f >= 2} className="absolute bottom-2.5 right-3 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-600">Hiburan hampir habis!</Pop>
    </Frame>
  );
}

function Hutang() {
  const f = useCycle(4, 1200);
  const left = f >= 2 ? 2_000_000 : 3_000_000;
  return (
    <Frame>
      <Row icon={HandCoins} tone="bg-orange-50 text-orange-600" label="Kredivo · Paylater" sub="Sisa utang" value={rp(left)} />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <motion.div className="h-full rounded-full bg-orange-400" animate={{ width: `${(left / 3_000_000) * 100}%` }} transition={{ duration: 0.8 }} />
      </div>
      <Pop show={f >= 1} className="mt-2.5 flex items-center justify-between rounded-xl bg-white px-2.5 py-2 text-[10px] font-bold shadow-sm">
        <span className="text-slate-600">Bayar cicilan dari BCA</span><span className="text-rose-500">− Rp 1.000.000</span>
      </Pop>
      <Pop show={f >= 3} className="absolute bottom-3 left-3.5 text-[10px] font-bold text-emerald-600">Sisa & saldo BCA ter-update otomatis ✓</Pop>
    </Frame>
  );
}

function Rutin() {
  const f = useCycle(4, 1000);
  const rows: [string, string, string][] = [["Gaji", "25 tiap bulan", "+ Rp 8,5 jt"], ["Netflix", "6 tiap bulan", "− Rp 186 rb"], ["IndiHome", "5 tiap bulan", "− Rp 385 rb"]];
  return (
    <Frame>
      <div className="space-y-1.5">
        {rows.map(([l, s, v], i) => (
          <div key={l} className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600"><Repeat size={13} /></span>
            <span className="flex-1"><span className="block text-[11px] font-bold text-slate-800">{l}</span><span className="block text-[9px] text-slate-400">{s}</span></span>
            <span className="text-[10px] font-black text-slate-700">{v}</span>
            <motion.span animate={{ scale: f > i ? 1 : 0 }} className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={10} strokeWidth={3} /></motion.span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Laporan() {
  const f = useCycle(3, 1400);
  const bars = [42, 55, 48, 70, 62, 85];
  return (
    <Frame>
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><FileText size={12} /> Laporan tahunan</p>
      <div className="mt-2 flex h-24 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-400" animate={{ height: f >= 1 ? `${h}%` : "4%" }} transition={{ duration: 0.8, delay: i * 0.07 }} />
            <span className="text-[8px] font-bold text-slate-400">{["Jul", "Agu", "Sep", "Okt", "Nov", "Des"][i]}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Pajak() {
  const f = useCycle(5, 900);
  const rows: [string, string][] = [["Penghasilan neto", "Rp 96 jt"], ["PTKP (K/1)", "Rp 63 jt"], ["PKP", "Rp 33 jt"]];
  return (
    <Frame>
      <div className="space-y-1.5">
        {rows.map(([l, v], i) => (
          <Pop key={l} show={f > i} className="flex justify-between rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold shadow-sm">
            <span className="text-slate-500">{l}</span><span className="text-slate-800">{v}</span>
          </Pop>
        ))}
      </div>
      <Pop show={f >= 4} className="absolute inset-x-3.5 bottom-3 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white">
        <span>PPh terutang</span><span className="text-emerald-300">Rp 1.650.000</span>
      </Pop>
    </Frame>
  );
}

function Ai() {
  const f = useCycle(4, 1200);
  return (
    <Frame className="space-y-2">
      <Pop show={f >= 0} className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white">Aku boros di mana bulan ini?</Pop>
      <Pop show={f === 1} className="flex w-fit gap-1 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
        {[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />)}
      </Pop>
      <Pop show={f >= 2} className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[11px] leading-snug text-slate-700 shadow-sm">
        <span className="mb-0.5 flex items-center gap-1 text-[9px] font-black text-violet-600"><Sparkles size={10} /> AI Leosiqra</span>
        Pengeluaran <b>Hiburan</b> naik 49% dari rata-rata — terbesar dari langganan & nonton.
      </Pop>
    </Frame>
  );
}

function Kategori() {
  const f = useCycle(5, 800);
  const chips = ["Makan", "Jajan & Kopi", "Bensin", "Listrik"];
  return (
    <Frame>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><Tags size={12} /> Kategori & sub-kategori</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => <Pop key={c} show={f > i} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">{c}</Pop>)}
        <span className="flex items-center gap-1 rounded-full border border-dashed border-indigo-300 px-2.5 py-1 text-[10px] font-bold text-indigo-600"><Plus size={11} /> Tambah</span>
      </div>
    </Frame>
  );
}

function Profil() {
  const f = useCycle(3, 1300);
  return (
    <Frame className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white">RP</span>
        <span className="flex-1 text-[11px] font-bold text-slate-800">Rina Pratama</span>
      </div>
      <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm">
        <ShieldCheck size={16} className={f >= 1 ? "text-emerald-500" : "text-slate-300"} />
        <span className="flex-1 text-[11px] font-bold text-slate-800">Verifikasi 2 langkah</span>
        <span className={cn("relative h-5 w-9 rounded-full transition-colors", f >= 1 ? "bg-emerald-500" : "bg-slate-200")}>
          <motion.span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" animate={{ left: f >= 1 ? 18 : 2 }} />
        </span>
      </div>
      <Pop show={f >= 2} className="text-center text-[10px] font-bold text-emerald-600">Akun lebih aman ✓</Pop>
    </Frame>
  );
}

function Menu() {
  const f = useCycle(4, 900);
  const items: [string, React.ElementType][] = [["Transaksi", FileText], ["Rekening & Aset", Building2], ["Investasi", TrendingUp], ["Perencanaan", Target]];
  return (
    <Frame className="space-y-1">
      {items.map(([l, I], i) => (
        <div key={l} className={cn("relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors", f === i ? "text-indigo-700" : "text-slate-500")}>
          {f === i && <motion.span layoutId="demo-menu" className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-indigo-100" />}
          <I size={13} className="relative" /><span className="relative flex-1">{l}</span><ChevronRight size={12} className="relative" />
        </div>
      ))}
    </Frame>
  );
}

function TambahCepat() {
  const f = useCycle(3, 1200);
  return (
    <Frame>
      <div className="flex justify-end">
        <motion.span animate={{ scale: f === 1 ? 0.92 : 1 }} className="flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 text-[10px] font-bold text-white"><Plus size={12} /> Tambah Cepat</motion.span>
      </div>
      <Pop show={f >= 1} className="ml-auto mt-2 w-44 space-y-0.5 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-100">
        {["Pengeluaran", "Pemasukan", "Transfer", "Setor tabungan"].map((t, i) => (
          <p key={t} className={cn("rounded-lg px-2 py-1 text-[10px] font-bold", i === 0 && f >= 2 ? "bg-indigo-50 text-indigo-700" : "text-slate-600")}>{t}</p>
        ))}
      </Pop>
    </Frame>
  );
}

function Transaksi() {
  const f = useCycle(5, 800);
  const rows: [string, string, string, string][] = [["Kopi", "Makanan · GoPay", "− 25.000", "text-rose-500"], ["Gaji", "Pemasukan · BCA", "+ 8.500.000", "text-emerald-600"], ["Bensin", "Transportasi · Tunai", "− 50.000", "text-rose-500"]];
  return (
    <Frame className="space-y-1.5">
      {rows.map(([l, s, v, c], i) => (
        <Pop key={l} show={f > i} className="flex items-center justify-between rounded-xl bg-white px-2.5 py-2 shadow-sm">
          <span><span className="block text-[11px] font-bold text-slate-800">{l}</span><span className="block text-[9px] text-slate-400">{s}</span></span>
          <span className={cn("text-[11px] font-black", c)}>{v}</span>
        </Pop>
      ))}
    </Frame>
  );
}

function Statistik() {
  const f = useCycle(3, 1300);
  const rows: [string, number, string][] = [["Tagihan", 92, "bg-blue-500"], ["Makanan", 60, "bg-orange-500"], ["Belanja", 42, "bg-emerald-500"], ["Hiburan", 25, "bg-pink-500"]];
  return (
    <Frame className="space-y-2">
      {rows.map(([l, w, c], i) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-14 text-right text-[10px] font-bold text-slate-500">{l}</span>
          <motion.div className={cn("h-3.5 rounded-md", c)} animate={{ width: f >= 1 ? `${w * 0.7}%` : "2%" }} transition={{ duration: 0.8, delay: i * 0.1 }} />
        </div>
      ))}
    </Frame>
  );
}

function Scan() {
  const f = useCycle(3, 1400);
  return (
    <Frame className="flex items-center gap-3">
      <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-white p-2 shadow-sm">
        {[70, 55, 80, 50, 65].map((w, i) => <div key={i} className="mb-1.5 h-1.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} />)}
        <div className="mt-2 h-2 w-3/4 rounded-full bg-slate-400" />
        {f === 1 && <motion.div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,.7)]" initial={{ top: 4 }} animate={{ top: 120 }} transition={{ duration: 1.1 }} />}
      </div>
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700"><ScanLine size={14} className="text-sky-500" /> Foto struk</p>
        <Pop show={f >= 2} className="rounded-xl bg-white px-2.5 py-2 shadow-sm">
          <span className="block text-[9px] text-slate-400">Terbaca · Belanja</span><span className="block text-sm font-black text-slate-800">Rp 128.500</span>
        </Pop>
      </div>
    </Frame>
  );
}

function Voice() {
  const f = useCycle(3, 1400);
  return (
    <Frame className="flex flex-col items-center justify-center gap-2">
      <div className="relative flex h-14 w-14 items-center justify-center">
        {f < 2 && [0, 1].map((i) => <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-pink-300" animate={{ scale: [1, 1.8], opacity: [0.8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.6 }} />)}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-white"><Mic size={20} /></span>
      </div>
      <p className="text-[11px] font-bold text-slate-700">{f >= 1 ? "“makan siang 35 ribu”" : "Mendengarkan…"}</p>
      <Pop show={f >= 2} className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-indigo-700 shadow-sm">Rp 35.000 · Makanan</Pop>
    </Frame>
  );
}

function InstallDemo() {
  const f = useCycle(3, 1100);
  return (
    <Frame className="flex items-center justify-center gap-5 bg-gradient-to-b from-indigo-300 via-violet-300 to-rose-200">
      {[["/images/Logo-new.png", "Leosiqra"], ["/images/input-cepat-192.png", "Input Cepat"]].map(([src, name], i) => (
        <motion.div key={name} animate={{ scale: f > i ? 1 : 0, rotate: f > i ? 0 : -10 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="flex flex-col items-center gap-1">
          <span className="relative block h-14 w-14 overflow-hidden rounded-[16px] bg-white shadow-lg"><Image src={src} alt="" fill sizes="56px" className="object-cover" /></span>
          <span className="text-[10px] font-bold text-white drop-shadow">{name}</span>
        </motion.div>
      ))}
    </Frame>
  );
}

function Selamat() {
  const f = useCycle(2, 1400);
  return (
    <Frame className="flex flex-col items-center justify-center">
      <motion.span animate={{ scale: f ? 1.1 : 1, rotate: f ? 8 : -8 }} className="text-4xl">🎉</motion.span>
      <p className="mt-2 text-xs font-black text-slate-800">Siap mencatat!</p>
      <p className="text-[10px] text-slate-500">Mulai dari transaksi pertamamu hari ini</p>
    </Frame>
  );
}

const SCENES: Record<DemoKind, () => React.ReactElement> = {
  dashboard: Dashboard, input: Input, rekening: Rekening, kartu: Kartu, investasi: Investasi, tabungan: Tabungan,
  budget: Budget, hutang: Hutang, rutin: Rutin, laporan: Laporan, pajak: Pajak, ai: Ai, kategori: Kategori,
  profil: Profil, menu: Menu, "tambah-cepat": TambahCepat, transaksi: Transaksi, statistik: Statistik,
  scan: Scan, voice: Voice, install: InstallDemo, selamat: Selamat,
};

export function FeatureDemo({ kind }: { kind: DemoKind }) {
  const Scene = SCENES[kind];
  // key = kind → adegan mulai dari awal setiap pindah langkah tur.
  return <div aria-hidden><Scene key={kind} /></div>;
}

// Daftar "cara pakai" singkat di bawah peraga.
export function HowTo({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-slate-600">
          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[9px] font-black text-indigo-600">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
