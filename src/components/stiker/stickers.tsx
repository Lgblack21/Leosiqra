'use client';

import type { ReactNode } from 'react';
import type { StoryStats } from '@/lib/storyStats';
import { LeoFace } from '@/components/cerita/LeoFace';
import { categoryVisual } from '@/lib/categoryEmoji';

// Stiker Cerita — desain Leosiqra sendiri. Tiap stiker = komponen mandiri berlebar dasar `w`
// (px) yang diskalakan editor. `hide` = sembunyikan nominal (yang tampil hanya jumlah & persen).

export type StickerCtx = { s: StoryStats; hide: boolean };
export type StickerDef = {
  id: string;
  name: string;
  group: StickerGroup;
  w: number;
  render: (c: StickerCtx) => ReactNode;
};
export type StickerGroup = 'Angka' | 'Grafik' | 'Leo' | 'Gaya' | 'Label';
export const STICKER_GROUPS: StickerGroup[] = ['Angka', 'Grafik', 'Leo', 'Gaya', 'Label'];

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const short = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
    : n >= 1e6
      ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`
      : n >= 1e3
        ? `${Math.round(n / 1e3)}rb`
        : `${Math.round(n)}`;
const money = (c: StickerCtx, n: number, compact = false) => (c.hide ? 'Rp•••' : compact ? `Rp${short(n)}` : rp(n));
const emoji = (cat: string) => categoryVisual(cat, 'pengeluaran').emoji;
const range = (s: StoryStats) =>
  s.past ? 'BULAN LALU' : s.range === 'hari' ? 'HARI INI' : s.range === 'minggu' ? 'MINGGU INI' : 'BULAN INI';
const changeText = (s: StoryStats) =>
  s.changePct === null
    ? 'data pertama'
    : s.changePct === 0
      ? 'sama persis'
      : `${s.changePct > 0 ? '▲' : '▼'} ${Math.abs(s.changePct)}%`;
const prevName = (s: StoryStats) =>
  s.past ? 'bulan sebelumnya' : s.range === 'hari' ? 'kemarin' : s.range === 'minggu' ? 'minggu lalu' : 'bulan lalu';
const leoLine = (s: StoryStats) => {
  if (s.verdict === 'kosong') return `Belum keluar sepeser pun ${s.shortLabel}. Dompetku bangga!`;
  if (s.verdict === 'hemat')
    return `${s.shortLabel[0].toUpperCase()}${s.shortLabel.slice(1)} lebih hemat dari biasanya. Lanjutkan!`;
  if (s.verdict === 'boros') return `Wah, ${s.shortLabel} agak ngebut. Besok rem dikit ya?`;
  return `${s.count} catatan ${s.shortLabel}, semua tercatat rapi.`;
};
const verdictWord = { hemat: 'HEMAT', pas: 'AMAN', boros: 'NGEBUT', kosong: 'NOL!' } as const;
const verdictMood = { hemat: 5, pas: 4, boros: 2, kosong: 5 } as const;
const topCat = (s: StoryStats) => s.categories[0];

const GRAD = 'linear-gradient(135deg,#FDBA74 0%,#F472B6 50%,#A78BFA 100%)';

export const STICKERS: StickerDef[] = [
  // ── Angka ──────────────────────────────────────────────────────────────
  {
    id: 'besar',
    name: 'Angka besar',
    group: 'Angka',
    w: 300,
    render: (c) => {
      const text = c.hide ? `${c.s.count}×` : money(c, c.s.total, true);
      // Teks gradasi lewat SVG (background-clip:text tidak ikut saat diekspor ke gambar).
      const fs = Math.min(64, 300 / Math.max(3, text.length * 0.62));
      return (
        <div className="text-center" style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.35))' }}>
          <div className="fs-13 font-extrabold tracking-[0.3em] text-white">{range(c.s)}</div>
          <svg viewBox="0 0 300 76" className="mt-1 w-full">
            <defs>
              <linearGradient id="besar-g" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#FFF7ED" />
                <stop offset=".45" stopColor="#FDE68A" />
                <stop offset="1" stopColor="#FBCFE8" />
              </linearGradient>
            </defs>
            <text
              x="150"
              y="60"
              textAnchor="middle"
              fontSize={fs}
              fontWeight="900"
              fill="url(#besar-g)"
              stroke="#BE185D"
              strokeWidth="2.5"
              paintOrder="stroke"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif', letterSpacing: '-0.02em' }}
            >
              {text}
            </text>
          </svg>
          <div className="fs-12 font-bold text-white">{c.hide ? 'kali bayar' : `${c.s.count} pembayaran`}</div>
        </div>
      );
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    group: 'Angka',
    w: 280,
    render: (c) => (
      <div
        className="rounded-[22px] border-2 border-fuchsia-400/70 bg-black/55 px-5 py-4 text-center"
        style={{ boxShadow: '0 0 18px #e879f9, inset 0 0 14px #e879f988' }}
      >
        <div
          className="fs-11 font-bold uppercase tracking-[0.35em] text-cyan-200"
          style={{ textShadow: '0 0 8px #22d3ee' }}
        >
          keluar {c.s.shortLabel}
        </div>
        <div
          className="mt-1 fsh-40 font-black leading-none text-fuchsia-100"
          style={{ textShadow: '0 0 6px #f0abfc, 0 0 18px #e879f9, 0 0 34px #c026d3' }}
        >
          {c.hide ? `${c.s.count}x` : money(c, c.s.total, true)}
        </div>
      </div>
    ),
  },
  {
    id: 'papan',
    name: 'Papan skor',
    group: 'Angka',
    w: 290,
    render: (c) => {
      const txt = (c.hide ? String(c.s.count).padStart(3, '0') : short(c.s.total)).toUpperCase().slice(0, 6);
      return (
        <div className="rounded-2xl bg-[#111827] p-3 shadow-xl ring-4 ring-[#374151]">
          <div className="mb-2 flex justify-between fs-9 font-bold tracking-[0.25em] text-amber-300">
            <span>LEO·SKOR</span>
            <span>{range(c.s)}</span>
          </div>
          <div className="flex justify-center gap-1">
            {(c.hide ? '' : 'Rp')
              .split('')
              .concat(txt.split(''))
              .map((ch, i) => (
                <span
                  key={i}
                  className="relative flex h-12 w-8 items-center justify-center overflow-hidden rounded-md bg-[#1f2937] font-mono fsh-28 font-black text-amber-200"
                >
                  {ch}
                  <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />
                </span>
              ))}
          </div>
          <div className="mt-2 text-center fs-9 font-bold tracking-[0.2em] text-white/50">
            {c.hide ? 'JUMLAH BAYAR' : `${c.s.count} PEMBAYARAN`}
          </div>
        </div>
      );
    },
  },
  {
    id: 'tiket',
    name: 'Tiket',
    group: 'Angka',
    w: 320,
    render: (c) => (
      <div className="flex overflow-hidden rounded-xl shadow-xl" style={{ background: '#FFF7ED' }}>
        <div className="flex-1 border-r-2 border-dashed border-orange-300 p-3.5">
          <div className="fs-9 font-black tracking-[0.3em] text-orange-500">LEOSIQRA · TIKET {range(c.s)}</div>
          <div className="mt-1 font-serif fsh-30 leading-none text-slate-900">{money(c, c.s.total, true)}</div>
          <div className="mt-1.5 fs-10 font-semibold text-slate-500">{c.s.label}</div>
        </div>
        <div className="flex w-[78px] flex-col items-center justify-center bg-orange-500 text-white">
          <div className="fs-9 font-bold tracking-widest">ADMIT</div>
          <div className="fsh-30 font-black leading-none">{c.s.count}</div>
          <div className="fs-9 font-bold tracking-widest">TRANSAKSI</div>
        </div>
      </div>
    ),
  },
  {
    id: 'kalender',
    name: 'Kalender sobek',
    group: 'Angka',
    w: 170,
    render: (c) => (
      <div className="overflow-hidden rounded-2xl bg-white text-center shadow-xl">
        <div className="bg-rose-500 py-1.5 fs-11 font-black uppercase tracking-[0.25em] text-white">
          {c.s.now.toLocaleDateString('id-ID', { month: 'short' })}
        </div>
        <div className="pt-1 font-serif fsh-64 leading-none text-slate-900">{c.s.now.getDate()}</div>
        <div className="pb-2 fs-11 font-bold text-slate-500">
          {c.s.now.toLocaleDateString('id-ID', { weekday: 'long' })}
        </div>
        <div className="border-t-2 border-dotted border-slate-200 py-2 fs-15 font-black text-rose-600">
          {money(c, c.s.total, true)}
        </div>
      </div>
    ),
  },
  {
    id: 'koran',
    name: 'Koran',
    group: 'Angka',
    w: 320,
    render: (c) => (
      <div className="bg-[#F5F0E6] p-3.5 text-[#1c1917] shadow-xl" style={{ transform: 'rotate(-1.5deg)' }}>
        <div className="flex items-end justify-between border-b-4 border-double border-[#1c1917] pb-1">
          <span className="font-serif fsh-22 leading-none">Harian Leo</span>
          <span className="fs-8 font-bold">{c.s.label}</span>
        </div>
        <div className="mt-2 font-serif fsh-21 leading-tight">
          {c.s.verdict === 'kosong'
            ? 'GEMPAR! Dompet Utuh Seharian Penuh'
            : c.s.verdict === 'hemat'
              ? `Pengeluaran ${c.s.shortLabel} Turun, Warga Bersorak`
              : c.s.verdict === 'boros'
                ? `Belanja ${c.s.shortLabel} Melonjak, Leo Angkat Bicara`
                : `${c.s.count} Transaksi Tercatat Rapi ${c.s.shortLabel}`}
        </div>
        <div className="mt-1.5 fs-10 leading-snug text-[#44403c]">
          Total {money(c, c.s.total)}
          {topCat(c.s) ? `, terbanyak untuk ${topCat(c.s).name.toLowerCase()} (${topCat(c.s).pct}%)` : ''}.{' '}
          {changeText(c.s)} dibanding {prevName(c.s)}.
        </div>
      </div>
    ),
  },
  // ── Grafik ─────────────────────────────────────────────────────────────
  {
    id: 'batang',
    name: 'Batang',
    group: 'Grafik',
    w: 300,
    render: (c) => {
      const max = Math.max(1, ...c.s.bars.map((b) => b.total));
      return (
        <div className="rounded-[22px] bg-white/90 p-4 shadow-xl backdrop-blur">
          <div className="flex items-baseline justify-between">
            <span className="fs-11 font-black tracking-[0.2em] text-slate-500">
              {c.s.range === 'bulan' ? 'PER MINGGU' : '7 HARI'}
            </span>
            <span className="fs-14 font-black text-slate-900">{money(c, c.s.total, true)}</span>
          </div>
          <div className="mt-3 flex h-24 items-end gap-2">
            {c.s.bars.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg rounded-b-sm"
                  style={{ height: `${Math.max(6, (b.total / max) * 80)}px`, background: b.current ? GRAD : '#E2E8F0' }}
                />
                <span className={`fs-9 font-bold ${b.current ? 'text-pink-600' : 'text-slate-400'}`}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
  {
    id: 'donut',
    name: 'Donat kategori',
    group: 'Grafik',
    w: 300,
    render: (c) => {
      const cols = ['#F97316', '#EC4899', '#8B5CF6', '#06B6D4', '#94A3B8'];
      const cats = c.s.categories.slice(0, 4);
      const rest = c.s.categories.slice(4).reduce((s, x) => s + x.pct, 0);
      const parts = rest > 0 ? [...cats, { name: 'Lainnya', pct: rest, total: 0 }] : cats;
      let acc = 0;
      const stops = parts.map((p, i) => `${cols[i]} ${acc}% ${(acc += p.pct)}%`).join(',');
      return (
        <div className="flex items-center gap-3 rounded-[22px] bg-slate-950/80 p-4 text-white shadow-xl">
          <div
            className="relative h-24 w-24 shrink-0 rounded-full"
            style={{ background: parts.length ? `conic-gradient(${stops},#334155 ${acc}% 100%)` : '#334155' }}
          >
            <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-slate-950 text-center">
              <span className="fs-16 font-black leading-none">{c.s.categories.length}</span>
              <span className="fs-8 font-bold text-white/60">kategori</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {parts.length === 0 && <div className="fs-12 text-white/70">Belum ada belanja</div>}
            {parts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5 fs-11">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cols[i] }} />
                <span className="truncate font-semibold">{p.name}</span>
                <span className="ml-auto font-black">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
  {
    id: 'podium',
    name: 'Podium',
    group: 'Grafik',
    w: 300,
    render: (c) => {
      const top = c.s.categories.slice(0, 3);
      const order = [top[1], top[0], top[2]];
      const h = [56, 80, 40];
      const col = ['#CBD5E1', '#FBBF24', '#FDBA74'];
      const rank = [2, 1, 3];
      return (
        <div className="rounded-[22px] bg-white/90 px-4 pb-3 pt-3 shadow-xl">
          <div className="text-center fs-11 font-black tracking-[0.2em] text-slate-500">JUARA BELANJA</div>
          <div className="mt-2 flex items-end justify-center gap-2">
            {order.map((t, i) => (
              <div key={i} className="flex w-20 flex-col items-center">
                <span className="fsh-24">{t ? emoji(t.name) : '·'}</span>
                <span className="w-full truncate text-center fs-9 font-bold text-slate-600">{t?.name ?? '-'}</span>
                <div
                  className="mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 fs-18 font-black text-white"
                  style={{ height: h[i], background: col[i] }}
                >
                  {rank[i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
  {
    id: 'speedo',
    name: 'Speedometer',
    group: 'Grafik',
    w: 240,
    render: (c) => {
      const pct = c.s.changePct === null ? 0 : Math.max(-100, Math.min(100, c.s.changePct));
      const angle = -90 + ((pct + 100) / 200) * 180;
      return (
        <div className="rounded-[22px] bg-slate-950/85 p-4 text-center text-white shadow-xl">
          <svg viewBox="0 0 200 110" className="mx-auto w-full">
            <defs>
              <linearGradient id="spd" x1="0" x2="1">
                <stop offset="0" stopColor="#34D399" />
                <stop offset=".5" stopColor="#FBBF24" />
                <stop offset="1" stopColor="#F43F5E" />
              </linearGradient>
            </defs>
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#spd)"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <g transform={`rotate(${angle} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="34" stroke="white" strokeWidth="5" strokeLinecap="round" />
            </g>
            <circle cx="100" cy="100" r="9" fill="white" />
          </svg>
          <div className="-mt-1 fsh-22 font-black">{changeText(c.s)}</div>
          <div className="fs-10 font-semibold text-white/60">dibanding {prevName(c.s)}</div>
        </div>
      );
    },
  },
  {
    id: 'tanpa-jajan',
    name: 'Hari tanpa belanja',
    group: 'Grafik',
    w: 280,
    render: (c) => (
      <div className="rounded-[22px] bg-emerald-500 p-4 text-white shadow-xl">
        <div className="fs-11 font-black tracking-[0.2em] text-white/80">HARI TANPA BELANJA</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="fsh-40 font-black leading-none">{c.s.noSpendDays}</span>
          <span className="fs-13 font-bold">dari {c.s.daysInRange} hari</span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: Math.min(c.s.daysInRange, 31) }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < c.s.noSpendDays ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>
      </div>
    ),
  },
  // ── Leo ────────────────────────────────────────────────────────────────
  {
    id: 'leo-bilang',
    name: 'Leo bilang',
    group: 'Leo',
    w: 300,
    render: (c) => (
      <div className="flex items-end gap-1">
        <LeoFace mood={verdictMood[c.s.verdict]} className="h-20 w-20 shrink-0 drop-shadow-lg" />
        <div className="relative mb-6 rounded-[20px] rounded-bl-md bg-white px-3.5 py-2.5 fs-13 font-bold leading-snug text-slate-900 shadow-xl">
          {leoLine(c.s)}
        </div>
      </div>
    ),
  },
  {
    id: 'leo-papan',
    name: 'Leo pegang papan',
    group: 'Leo',
    w: 220,
    render: (c) => (
      <div className="flex flex-col items-center">
        <LeoFace mood={verdictMood[c.s.verdict]} className="relative z-10 -mb-3 h-20 w-20 drop-shadow-lg" />
        <div
          className="w-full rounded-xl border-4 border-amber-700 bg-amber-100 px-3 py-2 text-center shadow-xl"
          style={{ transform: 'rotate(-3deg)' }}
        >
          <div className="fs-10 font-black tracking-[0.2em] text-amber-800">{range(c.s)}</div>
          <div className="fsh-26 font-black leading-tight text-amber-950">{money(c, c.s.total, true)}</div>
        </div>
      </div>
    ),
  },
  {
    id: 'leo-cap',
    name: 'Cap Leosiqra',
    group: 'Leo',
    w: 130,
    render: () => (
      <div className="relative aspect-square w-full drop-shadow-lg">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
          <defs>
            <path id="capc" d="M60 60 m-45 0 a45 45 0 1 1 90 0 a45 45 0 1 1 -90 0" />
          </defs>
          <circle cx="60" cy="60" r="58" fill="#0F172A" />
          <circle cx="60" cy="60" r="53" fill="none" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="3 3" />
          <text fill="#FDE68A" fontSize="11" fontWeight="800" letterSpacing="2.6">
            <textPath href="#capc">LEOSIQRA · CATAT BARENG LEO ·</textPath>
          </text>
        </svg>
        <LeoFace mood={5} className="absolute left-1/2 top-1/2 h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2" />
      </div>
    ),
  },
  {
    id: 'leo-mood',
    name: 'Meteran mood',
    group: 'Leo',
    w: 300,
    render: (c) => {
      const pick = c.s.verdict === 'boros' ? 1 : c.s.verdict === 'pas' ? 3 : 4;
      return (
        <div className="rounded-[22px] bg-white/90 p-3 shadow-xl">
          <div className="text-center fs-11 font-black tracking-[0.2em] text-slate-500">MOOD DOMPET {range(c.s)}</div>
          <div className="mt-1.5 flex justify-between">
            {[1, 2, 3, 4, 5].map((m, i) => (
              <div
                key={m}
                className={`rounded-full p-0.5 ${i === pick ? 'bg-gradient-to-br from-amber-300 to-pink-400' : 'opacity-35'}`}
              >
                <LeoFace mood={m as 1 | 2 | 3 | 4 | 5} className="h-11 w-11" />
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
  {
    id: 'polaroid',
    name: 'Polaroid Leo',
    group: 'Leo',
    w: 180,
    render: (c) => (
      <div className="bg-white p-2.5 pb-3 shadow-xl" style={{ transform: 'rotate(4deg)' }}>
        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-amber-100 to-pink-100">
          <LeoFace mood={verdictMood[c.s.verdict]} className="h-24 w-24" />
        </div>
        <div className="mt-2 text-center font-serif fs-15 text-slate-800">
          {c.hide ? `${c.s.count} catatan` : money(c, c.s.total, true)}
        </div>
        <div className="text-center fs-9 text-slate-500">{c.s.label}</div>
      </div>
    ),
  },
  // ── Gaya ───────────────────────────────────────────────────────────────
  {
    id: 'struk',
    name: 'Struk',
    group: 'Gaya',
    w: 250,
    render: (c) => {
      const teeth = (flip: boolean) => (
        <svg
          viewBox="0 0 250 10"
          preserveAspectRatio="none"
          className="block h-[10px] w-full"
          style={flip ? { transform: 'scaleY(-1)' } : undefined}
        >
          <path
            d={`M0 10 ${Array.from({ length: 25 }, (_, i) => `L${i * 10 + 5} 0 L${i * 10 + 10} 10`).join(' ')} Z`}
            fill="#FFFDF7"
          />
        </svg>
      );
      const items = c.s.items.slice(0, 5);
      const line = <div className="my-1.5 border-t-2 border-dashed border-slate-300" />;
      const now = c.s.now;
      return (
        <div
          className="relative font-mono fs-10.5 text-slate-800"
          style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.3))', transform: 'rotate(-2deg)' }}
        >
          {teeth(false)}
          <div className="bg-[#FFFDF7] px-4 pb-2 pt-1">
            <div className="text-center">
              <div className="fs-15 font-black tracking-[0.25em]">LEOSIQRA</div>
              <div className="fs-9 tracking-widest text-slate-500">STRUK {range(c.s)}</div>
              <div className="fs-9 text-slate-500">
                {c.s.label}
                {c.s.range === 'hari'
                  ? ` · ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </div>
            </div>
            {line}
            {items.length === 0 && <div className="text-center text-slate-500">— belum ada belanja —</div>}
            {items.map((it, i) => (
              <div key={i} className="flex justify-between gap-2 leading-[1.45]">
                <span className="truncate">
                  {String(i + 1).padStart(2, '0')} {it.note}
                </span>
                <span className="shrink-0">{c.hide ? '•••' : short(it.amount)}</span>
              </div>
            ))}
            {c.s.count > items.length && <div className="text-slate-500">+{c.s.count - items.length} lainnya</div>}
            {line}
            <div className="flex justify-between">
              <span>JUMLAH</span>
              <span>{c.s.count} trx</span>
            </div>
            <div className="flex justify-between fs-14 font-black">
              <span>TOTAL</span>
              <span>{money(c, c.s.total)}</span>
            </div>
            {topCat(c.s) && (
              <div className="flex justify-between text-slate-500">
                <span>TERBANYAK</span>
                <span className="truncate pl-2">{topCat(c.s).name}</span>
              </div>
            )}
            {line}
            <div className="mx-auto flex h-8 w-[85%] items-stretch justify-between">
              {Array.from({ length: 34 }, (_, i) => (
                <span key={i} className="bg-slate-900" style={{ width: [1, 2, 1, 3, 1, 2][(i * 7 + c.s.count) % 6] }} />
              ))}
            </div>
            <div className="mt-1 text-center fs-9 tracking-widest text-slate-500">TERIMA KASIH SUDAH MENCATAT</div>
            <div className="absolute -right-5 top-5 flex h-[58px] w-[58px] rotate-[14deg] bg-[#FFFDF7]/70 flex-col items-center justify-center rounded-full border-[3px] border-pink-500/80 text-pink-600/90">
              <LeoFace mood={verdictMood[c.s.verdict]} className="h-6 w-6" />
              <span className="fs-8 font-black tracking-wider">TERCATAT</span>
            </div>
          </div>
          {teeth(true)}
        </div>
      );
    },
  },
  {
    id: 'nota',
    name: 'Nota warung',
    group: 'Gaya',
    w: 260,
    render: (c) => (
      <div
        className="relative bg-[#FEFCE8] px-4 pb-3 pt-4 shadow-xl"
        style={{
          backgroundImage: 'repeating-linear-gradient(#FEFCE8 0 21px,#BFDBFE 21px 22px)',
          transform: 'rotate(-2deg)',
        }}
      >
        <div className="absolute inset-y-0 left-6 w-px bg-rose-300" />
        <div className="pl-4 font-serif fs-16 italic leading-[22px] text-slate-800">
          <div className="font-bold not-italic">Nota {c.s.shortLabel}</div>
          {c.s.items.slice(0, 4).map((it, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate">{it.note}</span>
              {!c.hide && <span>{short(it.amount)}</span>}
            </div>
          ))}
          {c.s.items.length === 0 && <div>— masih kosong —</div>}
          <div className="flex justify-between font-bold not-italic">
            <span>Total</span>
            <span>{money(c, c.s.total, true)}</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'chat',
    name: 'Chat dari Leo',
    group: 'Gaya',
    w: 300,
    render: (c) => (
      <div className="space-y-1.5">
        <div
          className="flex items-center gap-1.5 fs-10 font-bold text-white/90"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
        >
          <LeoFace mood={4} className="h-5 w-5" /> Leo · baru saja
        </div>
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-white px-3 py-2 fs-13 text-slate-900 shadow-lg">
          Bos, keluar {c.s.shortLabel} {money(c, c.s.total)} dari {c.s.count} transaksi.
        </div>
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-white px-3 py-2 fs-13 text-slate-900 shadow-lg">
          {leoLine(c.s)} <span className="fs-10 text-sky-500">✓✓</span>
        </div>
      </div>
    ),
  },
  {
    id: 'boarding',
    name: 'Boarding pass',
    group: 'Gaya',
    w: 330,
    render: (c) => {
      const to = topCat(c.s);
      const code =
        (to?.name ?? 'NOL')
          .replace(/[^A-Za-z]/g, '')
          .slice(0, 3)
          .toUpperCase() || 'NOL';
      return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between bg-sky-600 px-3.5 py-1.5 fs-10 font-black tracking-[0.2em] text-white">
            <span>LEO AIR · BOARDING PASS</span>
            <span>✈</span>
          </div>
          <div className="flex items-center justify-between px-3.5 pt-2">
            <div>
              <div className="fsh-30 font-black leading-none text-slate-900">DMP</div>
              <div className="fs-9 font-bold text-slate-500">Dompet</div>
            </div>
            <div className="fs-18 text-sky-500">— ✈ —</div>
            <div className="text-right">
              <div className="fsh-30 font-black leading-none text-slate-900">{code}</div>
              <div className="max-w-[90px] truncate fs-9 font-bold text-slate-500">
                {to?.name ?? 'Belum ke mana-mana'}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-dashed border-slate-300 px-3.5 py-2 fs-9 font-bold text-slate-500">
            <div>
              TOTAL<div className="fs-12 font-black text-slate-900">{money(c, c.s.total, true)}</div>
            </div>
            <div>
              FLIGHT<div className="fs-12 font-black text-slate-900">{c.s.count} trx</div>
            </div>
            <div>
              GATE<div className="fs-12 font-black text-slate-900">{c.s.range.toUpperCase()}</div>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'game',
    name: 'Game HUD',
    group: 'Gaya',
    w: 300,
    render: (c) => {
      const hp = c.s.verdict === 'kosong' ? 100 : c.s.verdict === 'hemat' ? 82 : c.s.verdict === 'pas' ? 58 : 24;
      return (
        <div className="rounded-lg border-4 border-black bg-[#1E1B4B] p-3 font-mono text-white shadow-[6px_6px_0_#000]">
          <div className="flex justify-between fs-12 font-black">
            <span className="text-lime-300">DOMPET</span>
            <span>LV.{Math.min(99, c.s.count)}</span>
          </div>
          <div className="mt-1.5 h-4 border-2 border-white bg-black">
            <div
              className="h-full"
              style={{ width: `${hp}%`, background: hp > 50 ? '#84CC16' : hp > 30 ? '#FACC15' : '#EF4444' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between fs-11">
            <span>HP {hp}/100</span>
            <span className="text-amber-300">-{c.hide ? '???' : short(c.s.total)}</span>
          </div>
          <div className="mt-1 fs-11 text-pink-300">
            COMBO x{c.s.count} {c.s.verdict === 'boros' ? '· CRITICAL HIT!' : '· NICE!'}
          </div>
        </div>
      );
    },
  },
  {
    id: 'kartu',
    name: 'Kartu member',
    group: 'Gaya',
    w: 320,
    render: (c) => (
      <div
        className="relative aspect-[1.586] overflow-hidden rounded-2xl p-4 text-white shadow-2xl"
        style={{ background: 'linear-gradient(135deg,#1E293B,#4C1D95 60%,#BE185D)' }}
      >
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="fs-13 font-black tracking-widest">LEOSIQRA</span>
          <LeoFace mood={5} className="h-8 w-8" />
        </div>
        <div className="mt-4 h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500" />
        <div className="mt-3 font-mono fs-17 tracking-[0.18em]">•••• •••• {String(c.s.count).padStart(4, '0')}</div>
        <div className="mt-2 flex justify-between fs-9 font-bold text-white/70">
          <span>
            KELUAR {range(c.s)}
            <div className="fs-14 text-white">{money(c, c.s.total, true)}</div>
          </span>
          <span className="text-right">
            BERLAKU
            <div className="fs-14 text-white">
              {c.s.now.toLocaleDateString('id-ID', { month: '2-digit', year: '2-digit' })}
            </div>
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'sticky',
    name: 'Sticky note',
    group: 'Gaya',
    w: 190,
    render: (c) => (
      <div className="relative bg-[#FDE047] p-4 pt-5 shadow-xl" style={{ transform: 'rotate(3deg)' }}>
        <span className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[-4deg] bg-white/60" />
        <div className="font-serif fs-17 italic leading-snug text-slate-900">
          {c.s.verdict === 'boros'
            ? 'Pengingat buat diri sendiri: rem dikit ya!'
            : c.s.verdict === 'kosong'
              ? 'Hari ini: nol rupiah. Bangga!'
              : 'Catat terus, biar nggak kaget di akhir bulan.'}
        </div>
        <div className="mt-2 text-right fs-13 font-black text-slate-800">{money(c, c.s.total, true)}</div>
      </div>
    ),
  },
  // ── Label ──────────────────────────────────────────────────────────────
  {
    id: 'stempel',
    name: 'Stempel penilaian',
    group: 'Label',
    w: 170,
    render: (c) => {
      const col = c.s.verdict === 'boros' ? '#E11D48' : c.s.verdict === 'pas' ? '#2563EB' : '#059669';
      return (
        <svg viewBox="0 0 160 160" className="w-full" style={{ transform: 'rotate(-12deg)' }}>
          <path
            d={
              Array.from({ length: 24 }, (_, i) => {
                const a = (i / 24) * Math.PI * 2;
                const r = i % 2 ? 70 : 78;
                return `${i ? 'L' : 'M'}${80 + Math.cos(a) * r} ${80 + Math.sin(a) * r}`;
              }).join(' ') + 'Z'
            }
            fill={col}
          />
          <circle cx="80" cy="80" r="58" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 4" />
          <text x="80" y="86" textAnchor="middle" fill="white" fontSize="28" fontWeight="900">
            {verdictWord[c.s.verdict]}
          </text>
          <text x="80" y="108" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" opacity=".85">
            {c.s.shortLabel.toUpperCase()}
          </text>
        </svg>
      );
    },
  },
  {
    id: 'chip-tanggal',
    name: 'Tanggal & jam',
    group: 'Label',
    w: 230,
    render: (c) => (
      <div className="mx-auto flex w-fit items-center gap-2 whitespace-nowrap rounded-full bg-black/55 px-3.5 py-2 fs-13 font-bold text-white">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        {c.s.range === 'hari'
          ? `${c.s.label} · ${c.s.now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
          : c.s.label}
      </div>
    ),
  },
  {
    id: 'chip-transaksi',
    name: 'Jumlah transaksi',
    group: 'Label',
    w: 200,
    render: (c) => (
      <div
        className="flex w-fit items-center gap-2 rounded-full px-4 py-2 fs-14 font-black text-slate-950 shadow-lg"
        style={{ background: GRAD }}
      >
        🧾 {c.s.count} transaksi {c.s.shortLabel}
      </div>
    ),
  },
  {
    id: 'chip-kategori',
    name: 'Kategori teratas',
    group: 'Label',
    w: 240,
    render: (c) => {
      const t = topCat(c.s);
      return (
        <div className="flex w-fit items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-lg">
          <span className="fsh-26">{t ? emoji(t.name) : '✨'}</span>
          <div>
            <div className="fs-9 font-black tracking-[0.2em] text-slate-400">PALING BANYAK</div>
            <div className="fs-14 font-black text-slate-900">{t ? `${t.name} · ${t.pct}%` : 'Belum ada'}</div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'chip-terbesar',
    name: 'Belanja terbesar',
    group: 'Label',
    w: 260,
    render: (c) => (
      <div className="w-fit rounded-2xl bg-slate-950/80 px-3.5 py-2 text-white shadow-lg">
        <div className="fs-9 font-black tracking-[0.2em] text-amber-300">BELANJA TERBESAR</div>
        <div className="fs-14 font-black">
          {c.s.biggest
            ? `${emoji(c.s.biggest.category)} ${c.s.biggest.note}${c.hide ? '' : ` · ${short(c.s.biggest.amount)}`}`
            : 'Belum ada'}
        </div>
      </div>
    ),
  },
];

export const stickerById = (id: string) => STICKERS.find((s) => s.id === id);
