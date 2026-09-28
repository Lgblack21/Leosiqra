"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, ListOrdered, CreditCard, TrendingUp, PiggyBank, FileText, Search, Bell, Plus,
  ArrowUpRight, ArrowDownRight, Download, Check,
} from "lucide-react";
import { CountUp } from "./CountUp";

// Tur animasi "mode desktop": jendela aplikasi yang berpindah sendiri antar
// layar utama, dengan kursor yang bergerak & meng-klik menu sidebar. Semua
// tampilan dibangun dari kode (bukan screenshot) memakai warna & komponen
// yang sama dengan dashboard asli, jadi tajam di semua ukuran dan konsisten.

const W = 1120; // ukuran desain jendela; diskalakan mengikuti lebar container
const H = 680;
const SIDEBAR_W = 216;
const DURATION = 5200; // ms per layar

const SCREENS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, title: "Dashboard Bulanan" },
  { key: "transaksi", label: "Transaksi", icon: ListOrdered, title: "Data Transaksi" },
  { key: "kartu", label: "Rekening & Kartu", icon: CreditCard, title: "Kartu Saya" },
  { key: "investasi", label: "Investasi", icon: TrendingUp, title: "Portofolio Investasi" },
  { key: "tabungan", label: "Tabungan & Budget", icon: PiggyBank, title: "Tabungan & Budget" },
  { key: "pajak", label: "Pajak Center", icon: FileText, title: "Pajak Center" },
] as const;
type ScreenKey = (typeof SCREENS)[number]["key"];

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const ease = [0.16, 1, 0.3, 1] as const;

// ---------------------------------------------------------------- layar-layar

function Bar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay, ease }} />
    </div>
  );
}

function Dashboard() {
  const months = [42, 58, 51, 66, 60, 74, 69, 82, 77, 88, 84, 96];
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-600/20">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Saldo bersih</p>
        <p className="mt-3 text-[26px] font-black tabular-nums"><CountUp to={84_210_500} format={rp} duration={1.6} /></p>
        <p className="mt-3 text-[10px] font-bold text-emerald-100">6 rekening · 128 transaksi bulan ini</p>
      </div>
      {[
        ["Pemasukan", 18_500_000, 100, "bg-emerald-500", ArrowUpRight, "text-emerald-500"],
        ["Pengeluaran", 9_640_000, 52, "bg-rose-500", ArrowDownRight, "text-rose-500"],
      ].map(([label, v, pct, bar, Icon, ic], i) => {
        const I = Icon as React.ElementType;
        return (
          <div key={label as string} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><I size={12} className={ic as string} /> {label as string}</p>
            <p className="mt-3 text-[22px] font-black tabular-nums text-slate-900"><CountUp to={v as number} format={rp} duration={1.6} /></p>
            <div className="mt-4"><Bar pct={pct as number} color={bar as string} delay={0.2 + i * 0.1} /></div>
          </div>
        );
      })}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm @3xl:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Arus kas 12 bulan</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">+18% YoY</span>
        </div>
        <div className="mt-5 flex h-[130px] items-end gap-1.5 @3xl:h-[170px] @3xl:gap-2.5">
          {months.map((h, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <motion.div
                className={`w-full rounded-t-md ${i === months.length - 1 ? "bg-indigo-600" : "bg-indigo-100"}`}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease }}
              />
              <span className="text-[9px] font-bold text-slate-400">{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transaksi terakhir</p>
        <ul className="mt-3 space-y-3">
          {[["Kopi Kenangan", "Makanan", -25_000], ["Gaji September", "Gaji", 18_500_000], ["Netflix", "Hiburan", -186_000], ["Bensin", "Transport", -50_000]].map(([n, c, v], i) => (
            <motion.li key={n as string} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }} className="flex items-center justify-between">
              <span>
                <span className="block text-[12px] font-bold text-slate-800">{n as string}</span>
                <span className="block text-[10px] text-slate-400">{c as string}</span>
              </span>
              <span className={`text-[12px] font-black tabular-nums ${(v as number) > 0 ? "text-emerald-600" : "text-slate-700"}`}>{(v as number) > 0 ? "+" : "−"}{rp(Math.abs(v as number))}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Transaksi() {
  const rows: Array<[string, string, string, string, number]> = [
    ["28 Sep", "Kopi Kenangan", "Makanan", "Cash", -25_000],
    ["27 Sep", "Belanja bulanan", "Belanja", "BCA Blue", -1_250_000],
    ["27 Sep", "Transfer ke Cash", "Transfer", "BCA Blue", -500_000],
    ["25 Sep", "Gaji September", "Gaji", "BCA Platinum", 18_500_000],
    ["24 Sep", "Listrik PLN", "Tagihan", "BCA Blue", -412_000],
    ["22 Sep", "Makan malam", "Makanan", "Kartu BCA", -380_000],
    ["20 Sep", "Dividen BBCA", "Investasi", "RDN Ajaib", 264_000],
  ];
  const chip: Record<string, string> = { Makanan: "bg-orange-50 text-orange-600", Belanja: "bg-pink-50 text-pink-600", Transfer: "bg-indigo-50 text-indigo-600", Gaji: "bg-emerald-50 text-emerald-600", Tagihan: "bg-amber-50 text-amber-700", Investasi: "bg-sky-50 text-sky-600" };
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <div className="hidden flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-400 @3xl:flex"><Search size={13} /> Cari transaksi…</div>
        {["Semua", "Masuk", "Keluar"].map((f, i) => (
          <span key={f} className={`rounded-full px-3 py-1.5 text-[10px] font-black ${i === 0 ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-500"}`}>{f}</span>
        ))}
      </div>
      <div className="hidden grid-cols-[70px_1fr_110px_120px_130px] gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 @3xl:grid">
        <span>Tanggal</span><span>Keterangan</span><span>Kategori</span><span>Rekening</span><span className="text-right">Nominal</span>
      </div>
      <ul>
        {rows.map(([d, n, c, a, v], i) => (
          <motion.li
            key={n}
            initial={{ opacity: 0, y: -10, backgroundColor: i === 0 ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0)" }}
            animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0)" }}
            transition={{ delay: i === 0 ? 1.1 : 0.1 + i * 0.07, duration: i === 0 ? 1.6 : 0.5, ease }}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-50 px-5 py-3 @3xl:grid-cols-[70px_1fr_110px_120px_130px]"
          >
            <span className="hidden text-[11px] font-bold text-slate-400 @3xl:block">{d}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[12px] font-bold text-slate-800">{n}{i === 0 && <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[8px] font-black text-white">BARU</span>}</span>
              <span className="block text-[10px] text-slate-400 @3xl:hidden">{d} · {c} · {a}</span>
            </span>
            <span className="hidden @3xl:block"><span className={`rounded-md px-2 py-1 text-[9px] font-black ${chip[c]}`}>{c}</span></span>
            <span className="hidden text-[11px] font-bold text-slate-500 @3xl:block">{a}</span>
            <span className={`text-right text-[12px] font-black tabular-nums ${v > 0 ? "text-emerald-600" : "text-slate-800"}`}>{v > 0 ? "+" : "−"}{rp(Math.abs(v))}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Kartu() {
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-5">
      <div className="space-y-4 @3xl:col-span-2">
        <motion.div
          initial={{ rotateY: -25, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 1, ease }}
          style={{ transformPerspective: 900 }}
          className="relative h-[190px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-5 text-white shadow-xl"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="flex items-center justify-between"><span className="text-sm font-black">BCA Silver</span><CreditCard size={20} className="text-white/60" /></div>
          <p className="mt-8 text-[10px] font-bold uppercase tracking-wider text-white/60">Terpakai</p>
          <p className="text-2xl font-black tabular-nums"><CountUp to={4_250_000} format={rp} duration={1.4} /></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: "28%" }} transition={{ duration: 1.2, delay: 0.3, ease }} /></div>
          <div className="mt-2 flex justify-between text-[10px] text-white/70"><span>Sisa Rp 10.750.000</span><span>Limit Rp 15.000.000</span></div>
        </motion.div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Tagihan tercetak 15 Sep</p>
            <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">3 hari lagi</motion.span>
          </div>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900">Rp 3.980.000</p>
          <p className="text-[10px] text-slate-500">Jatuh tempo 5 Okt · minimum Rp 398.000</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm @3xl:col-span-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rekening</p>
        <ul className="mt-3 divide-y divide-slate-50">
          {[["BCA Platinum", "Bank", 145_494_000, "bg-blue-600"], ["BCA Blue", "Bank", 7_016_200, "bg-sky-500"], ["ABA USD", "Bank · USD", 9_50, "bg-rose-500"], ["GoPay", "E-Wallet", 412_000, "bg-emerald-500"], ["Cash", "Tunai", 300_000, "bg-amber-500"]].map(([n, t, v, c], i) => (
            <motion.li key={n as string} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black text-white ${c}`}>{(n as string).slice(0, 2).toUpperCase()}</span>
              <span className="flex-1"><span className="block text-[12px] font-bold text-slate-800">{n as string}</span><span className="block text-[10px] text-slate-400">{t as string}</span></span>
              <span className="text-[12px] font-black tabular-nums text-slate-800">{n === "ABA USD" ? "$9.50" : rp(v as number)}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Investasi() {
  const alloc = [["Deposito", 64, "#6366f1"], ["Saham", 22, "#10b981"], ["Emas", 14, "#f59e0b"]] as const;
  let offset = 0;
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm @3xl:col-span-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nilai portofolio</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-slate-900"><CountUp to={548_300_000} format={rp} duration={1.5} /></p>
        <p className="text-[11px] font-bold text-emerald-600">+Rp 14.820.000 (+2,78%)</p>
        <div className="mt-5 flex items-center gap-5">
          <svg viewBox="0 0 42 42" className="h-32 w-32 -rotate-90">
            <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="6" />
            {alloc.map(([label, pct, color], i) => {
              const el = (
                <motion.circle
                  key={label}
                  cx="21" cy="21" r="15.9" fill="none" stroke={color} strokeWidth="6"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeDashoffset={-offset}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.25, ease }}
                />
              );
              offset += pct;
              return el;
            })}
          </svg>
          <ul className="space-y-2 text-[11px]">
            {alloc.map(([label, pct, color]) => (
              <li key={label} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: color }} /> <span className="font-bold text-slate-700">{label}</span> <span className="text-slate-400">{pct}%</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm @3xl:col-span-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posisi aktif</p>
        <ul className="mt-3 space-y-2">
          {[["Deposito BCA", "4,5%/th · jatuh tempo 10 Agu", 350_000_000, null], ["BBCA · 1.200 lembar", "Harga live Rp 9.900", 11_880_000, 8.3], ["TLKM · 2.000 lembar", "Harga live Rp 3.140", 6_280_000, -2.1], ["Emas Antam · 50 g", "Rp 1.580.000/g", 79_000_000, 5.4]].map(([n, d, v, g], i) => (
            <motion.li key={n as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span><span className="block text-[12px] font-bold text-slate-800">{n as string}</span><span className="block text-[10px] text-slate-400">{d as string}</span></span>
              <span className="text-right"><span className="block text-[12px] font-black tabular-nums text-slate-800">{rp(v as number)}</span>{g !== null && <span className={`block text-[10px] font-black ${(g as number) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{(g as number) >= 0 ? "+" : ""}{g}%</span>}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tabungan() {
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tabungan per tujuan</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Dana Darurat", 0.72, "#10b981", "Rp 24,5 jt"], ["Liburan Jepang", 0.41, "#6366f1", "Rp 12,3 jt"], ["DP Rumah", 0.18, "#f59e0b", "Rp 36 jt"]].map(([n, p, c, v], i) => (
            <div key={n as string} className="flex flex-col items-center rounded-xl bg-slate-50 p-3 text-center">
              <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                <motion.circle cx="32" cy="32" r="26" fill="none" stroke={c as string} strokeWidth="7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: p as number }} transition={{ duration: 1.4, delay: 0.2 + i * 0.15, ease }} />
              </svg>
              <span className="mt-2 text-[11px] font-black text-slate-800">{n as string}</span>
              <span className="text-[10px] text-slate-400">{v as string} · {Math.round((p as number) * 100)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-700">
          <Check size={13} /> Setoran otomatis Dana Darurat Rp 1.000.000 tercatat hari ini
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Budget September</p>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">1 lewat batas</span>
        </div>
        <ul className="mt-4 space-y-4">
          {[["Makanan", 1_820_000, 2_000_000], ["Transport", 540_000, 800_000], ["Belanja", 1_450_000, 1_200_000], ["Hiburan", 186_000, 500_000]].map(([n, used, lim], i) => {
            const pct = Math.min(100, ((used as number) / (lim as number)) * 100);
            const over = (used as number) > (lim as number);
            return (
              <li key={n as string}>
                <div className="mb-1.5 flex justify-between text-[11px]"><span className="font-bold text-slate-700">{n as string}</span><span className={`font-bold tabular-nums ${over ? "text-rose-600" : "text-slate-500"}`}>{rp(used as number)} / {rp(lim as number)}</span></div>
                <Bar pct={pct} color={over ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"} delay={0.2 + i * 0.12} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Pajak() {
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm @3xl:col-span-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daftar harta SPT 2026</p>
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black text-white"><Download size={12} /> Ekspor PDF</span>
        </div>
        <ul className="mt-3 divide-y divide-slate-50">
          {[["Tabungan & rekening", "012", 153_222_200], ["Deposito", "013", 350_000_000], ["Saham", "034", 18_160_000], ["Logam mulia", "039", 79_000_000]].map(([n, k, v], i) => (
            <motion.li key={n as string} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex items-center justify-between py-3">
              <span className="flex items-center gap-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{k as string}</span><span className="text-[12px] font-bold text-slate-800">{n as string}</span></span>
              <span className="text-[12px] font-black tabular-nums text-slate-800">{rp(v as number)}</span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-[12px] font-black"><span>Total harta</span><span className="tabular-nums"><CountUp to={600_382_200} format={rp} duration={1.4} /></span></div>
      </div>
      <div className="space-y-4 @3xl:col-span-2">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-600/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Estimasi PPh terutang</p>
          <p className="mt-2 text-2xl font-black tabular-nums"><CountUp to={19_200_000} format={rp} duration={1.4} /></p>
          <p className="mt-1 text-[10px] text-indigo-100">5% × 60 jt + 15% × 108 jt · PTKP TK/0</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          {[["Penghasilan neto setahun", "Rp 222.000.000"], ["PTKP (TK/0)", "Rp 54.000.000"], ["Penghasilan kena pajak", "Rp 168.000.000"]].map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.12 }} className="flex justify-between py-1.5 text-[11px]"><span className="text-slate-500">{k}</span><span className="font-black tabular-nums text-slate-800">{v}</span></motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const RENDER: Record<ScreenKey, () => React.ReactElement> = {
  dashboard: Dashboard, transaksi: Transaksi, kartu: Kartu, investasi: Investasi, tabungan: Tabungan, pajak: Pajak,
};

// ---------------------------------------------------------------- jendela

// Layar panjang di mode ringkas (HP) di-scroll otomatis pelan-pelan supaya
// seluruh isinya terlihat, seolah ada yang sedang membaca.
function AutoScroll({ children, height, enabled, runKey }: { children: React.ReactNode; height: number; enabled: boolean; runKey: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setOverflow(Math.max(0, el.scrollHeight - height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, runKey]);
  return (
    <div style={{ height }} className="overflow-hidden">
      <motion.div
        ref={inner}
        key={runKey}
        initial={{ y: 0 }}
        animate={{ y: enabled && overflow > 0 ? -overflow : 0 }}
        transition={{ duration: Math.max(1, (DURATION - 2600) / 1000), delay: 1.4, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function AppShowcase() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(W);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [runId, setRunId] = useState(0); // restart progres & animasi layar saat berpindah

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layar sempit (HP): jendela ringkas tanpa sidebar, dengan tab di atas —
  // jendela desktop penuh yang diperkecil ke lebar HP tidak terbaca.
  const compact = width < 640;
  const winW = compact ? 460 : W;
  const winH = compact ? 740 : H;
  const scale = Math.min(1, width / winW);

  const go = useCallback((i: number) => { setActive(i); setRunId((r) => r + 1); }, []);

  // Otomatis pindah layar: kursor meluncur ke menu berikutnya, "klik", lalu layar berganti.
  useEffect(() => {
    if (!inView || paused || reduce) return;
    const t1 = setTimeout(() => setClicking(true), DURATION - 700);
    const t2 = setTimeout(() => { setClicking(false); go((active + 1) % SCREENS.length); }, DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active, inView, paused, reduce, go, runId]);

  const screen = SCREENS[active];
  const target = clicking ? (active + 1) % SCREENS.length : active;
  const Screen = RENDER[screen.key];
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!compact) return;
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [active, compact, reduce]);

  const screenBody = (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen.key + runId}
        initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
        transition={{ duration: 0.45, ease }}
        className="@container"
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{ height: winH * scale }} className="relative">
        <div
          className="absolute left-1/2 top-0 origin-top overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_50px_120px_-40px_rgba(30,41,59,0.45),0_0_0_1px_rgba(255,255,255,0.6)_inset]"
          style={{ width: winW, height: winH, transform: `translateX(-50%) scale(${scale})` }}
        >
          {/* Bilah jendela */}
          <div className="flex h-11 items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4">
            <span className="flex gap-1.5"><i className="h-3 w-3 rounded-full bg-[#ff5f57]" /><i className="h-3 w-3 rounded-full bg-[#febc2e]" /><i className="h-3 w-3 rounded-full bg-[#28c840]" /></span>
            <span className={`mx-auto flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ${compact ? "w-56" : "w-80"}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> leosiqra.com/{compact ? screen.key : `membership/${screen.key}`}
            </span>
          </div>

          {compact ? (
            <div style={{ height: winH - 44 }} className="flex flex-col bg-[#fafbfc]">
              <div ref={tabsRef} className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2.5">
                {SCREENS.map((s, i) => {
                  const Icon = s.icon;
                  const on = i === active;
                  return (
                    <button key={s.key} data-i={i} type="button" onClick={() => go(i)} className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${on ? "text-indigo-600" : "text-slate-500"}`}>
                      {on && <motion.span layoutId="showcase-tab" className="absolute inset-0 rounded-full bg-indigo-50 ring-1 ring-indigo-100" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                      <Icon size={14} className="relative" /> <span className="relative">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 pt-4">
                <h4 className="text-[15px] font-black text-slate-900">{screen.title}</h4>
              </div>
              <div className="px-4 pt-3">
                <AutoScroll height={winH - 44 - 54 - 44} enabled={!reduce && inView && !paused} runKey={screen.key + runId}>
                  {screenBody}
                </AutoScroll>
              </div>
            </div>
          ) : (
            <div className="flex" style={{ height: winH - 44 }}>
              {/* Sidebar */}
              <aside className="flex flex-col border-r border-slate-100 bg-slate-50/60 p-3" style={{ width: SIDEBAR_W }}>
                <div className="flex items-center gap-2 px-2 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-[11px] font-black text-white">L</span>
                  <span className="text-[13px] font-black text-slate-900">Leosiqra</span>
                </div>
                <nav className="mt-4 space-y-1">
                  {SCREENS.map((s, i) => {
                    const Icon = s.icon;
                    const on = i === active;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => go(i)}
                        className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold transition-colors ${on ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        {on && <motion.span layoutId="showcase-nav" className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                        <Icon size={15} className="relative" />
                        <span className="relative">{s.label}</span>
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-auto flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-black text-white">AD</span>
                  <span className="text-[11px] font-bold text-slate-700">Akun Demo<span className="block text-[9px] font-black text-emerald-600">PRO</span></span>
                </div>
              </aside>

              {/* Konten */}
              <div className="relative flex-1 overflow-hidden bg-[#fafbfc]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-3.5">
                  <AnimatePresence mode="wait">
                    <motion.h4 key={screen.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="text-[15px] font-black text-slate-900">
                      {screen.title}
                    </motion.h4>
                  </AnimatePresence>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400"><Bell size={14} /></span>
                    <span className="flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-[11px] font-black text-white"><Plus size={13} /> Tambah Cepat</span>
                  </div>
                </div>
                <div className="p-6">{screenBody}</div>
              </div>
            </div>
          )}

          {/* Kursor animasi — meluncur ke menu yang akan dibuka lalu "klik" (desktop). */}
          {!reduce && !compact && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 z-20"
              animate={{ x: SIDEBAR_W - 70, y: 44 + 62 + 44 + target * 42 + 14 }}
              transition={{ type: "spring", stiffness: 70, damping: 16 }}
            >
              <motion.span
                className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-indigo-500/30"
                animate={clicking ? { scale: [0.4, 1.6], opacity: [0.8, 0] } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
              />
              <svg width="20" height="22" viewBox="0 0 20 22" className="drop-shadow-md">
                <path d="M2 1l15 11.5-6.6 1.2 3.9 7-2.8 1.3-3.9-7L2 19z" fill="#0f172a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </motion.div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">Tampilan dengan data contoh.</p>

      {/* Pilihan layar + progres (juga navigasi manual) — di HP sudah ada tab di dalam jendela. */}
      {!compact && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SCREENS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              className={`relative overflow-hidden rounded-full border px-4 py-2 text-xs font-bold transition-colors ${i === active ? "border-indigo-200 bg-white text-indigo-700 shadow-sm" : "border-slate-200 bg-white/60 text-slate-500 hover:text-slate-800"}`}
            >
              {i === active && !reduce && !paused && inView && (
                <motion.span
                  key={runId}
                  className="absolute inset-y-0 left-0 bg-indigo-50"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: DURATION / 1000, ease: "linear" }}
                />
              )}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
