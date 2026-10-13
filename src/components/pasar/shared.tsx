"use client";

// Tipe & helper bersama untuk halaman Pasar & belajar (data dari /api/member/pasar).

export type SbnOffer = {
  seri: string;
  jenis: string;
  tenors: { label: string; tahun: number | null; kupon: number; minimal: boolean }[];
  mulai: string | null;
  akhir: string | null;
  minBeli: number | null;
  sourceUrl: string;
  sourceName: string;
};
export type PasarFeed = {
  biRate: { rate: number; date: string; history: { date: string; rate: number }[]; via?: { name: string; url: string } } | null;
  lps: { umum: number; bpr: number; valas: number; periode: string } | null;
  usdIdr: number | null;
  goldGramIdr: number | null;
  sbnOffers: SbnOffer[];
  sources: { name: string; url: string; at: string }[];
  fetchedAt: string;
};
export type PasarNews = { id: string; url: string; source: string; topic: string; title: string; summary: string; published_at: string };

export const SBN_TAX = 0.1; // PPh final kupon SBN (PP 91/2021)
export const DEPO_TAX = 0.2; // PPh final bunga deposito
export const DEPO_TAX_FREE = 7_500_000; // simpanan s.d. Rp7,5 jt tidak dipotong

export const pct = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
export const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const rpShort = (n: number) => (n >= 1e9 ? `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M` : n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : rp(n));
export const fmtDate = (d: string | Date, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('id-ID', o).format(typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d);
export const daysTo = (iso: string | null) => (iso ? Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 864e5) : null);
export const offerOpen = (o: SbnOffer) => {
  const now = Date.now();
  const a = o.mulai ? new Date(`${o.mulai}T00:00:00`).getTime() : null;
  const b = o.akhir ? new Date(`${o.akhir}T23:59:59`).getTime() : null;
  return (a === null || a <= now) && (b === null || b >= now);
};
export const kuponRange = (o: SbnOffer) => {
  const ks = o.tenors.map((t) => t.kupon);
  const lo = Math.min(...ks);
  const hi = Math.max(...ks);
  return lo === hi ? pct(lo) : `${pct(lo).replace('%', '')}–${pct(hi)}`;
};
export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
// Bunga/kupon bersih setelah pajak selama `months` bulan (bunga sederhana).
export const netReturn = (amount: number, rate: number, months: number, kind: 'sbn' | 'depo') => {
  const gross = (amount * (rate / 100) * months) / 12;
  const tax = kind === 'sbn' ? SBN_TAX : amount <= DEPO_TAX_FREE ? 0 : DEPO_TAX;
  return gross * (1 - tax);
};

export const card = 'rounded-[24px] bg-slate-100/70';
export const SourceLink = ({ url, name }: { url: string; name?: string }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">{(name ?? domainOf(url))[0]}</span>
    {domainOf(url)}
  </a>
);

export const TOPIC_EMOJI: Record<string, string> = { SBN: '🏛️', 'Suku bunga': '🏦', Deposito: '🔒', Emas: '🪙', Rupiah: '💱', BBM: '⛽', Pajak: '🧾', Kripto: '₿', Saham: '📈' };
