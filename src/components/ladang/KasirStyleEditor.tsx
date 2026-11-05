"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDown, ArrowUp, Bot, Check, Copy, LayoutGrid, Loader2, Rows3, Grid3x3 } from 'lucide-react';
import { shopService, groupProducts, KASIR_DEFAULT, type KasirStyle, type Shop } from '@/lib/services/shopService';
import { openSettings } from '@/lib/settingsPanel';
import { cn } from '@/lib/utils';
import { KASIR_THEME } from './kasirTheme';
import { fieldCls, labelCls } from './UsahaView';

// Tampilan kasir per usaha: pilihan terbatas (tema, tata letak, kolom, kartu, teks,
// urutan kategori) — disimpan di shops.style_json. Bisa juga diubah AI milik
// pengguna lewat MCP (tool set_kasir_style) tanpa memakai kuota AI Leosiqra.

const LAYOUTS: { id: KasirStyle['layout']; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'grid', label: 'Kartu', icon: LayoutGrid },
  { id: 'list', label: 'Daftar', icon: Rows3 },
  { id: 'compact', label: 'Ringkas', icon: Grid3x3 },
];
const CARDS: { id: KasirStyle['card']; label: string }[] = [
  { id: 'soft', label: 'Lembut' },
  { id: 'outline', label: 'Garis' },
  { id: 'solid', label: 'Timbul' },
];

export function KasirStyleEditor({ shop, onDone }: { shop: Shop; onDone: (m: string) => void }) {
  const [st, setSt] = useState<KasirStyle>({ ...KASIR_DEFAULT, ...shop.style });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const app = (usePathname() ?? '').startsWith('/app');
  const set = <K extends keyof KasirStyle>(k: K, v: KasirStyle[K]) => setSt((p) => ({ ...p, [k]: v }));
  const groups = groupProducts(shop.products).map((g) => g.group).filter(Boolean);
  const order = [...groups].sort((a, b) => { const r = (x: string) => { const k = st.categoryOrder.indexOf(x); return k < 0 ? 1000 + groups.indexOf(x) : k; }; return r(a) - r(b); });
  const move = (i: number, d: -1 | 1) => { const o = [...order]; [o[i], o[i + d]] = [o[i + d], o[i]]; set('categoryOrder', o); };
  const seg = (on: boolean) => cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold transition-colors', on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400');

  const prompt = `Pakai Leosiqra (MCP): ubah tampilan kasir usahaku "${shop.name}" (shop_id ${shop.id}) lewat set_kasir_style. Aku mau: [tulis keinginanmu, mis. tema gelap, kartu ringkas 4 kolom, sambutan "Top up kilat 24 jam", urutkan Mobile Legends paling atas].`;
  const save = async () => {
    setBusy(true);
    setError('');
    try { await shopService.update(shop.id, { style: st }); onDone('Tampilan kasir disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {!shop.styleReady && <p role="alert" className="rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">Tampilan kasir sedang disiapkan di server — sementara belum bisa disimpan.</p>}
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      {/* Pratinjau header */}
      <div className={cn('web-keep rounded-2xl p-3 text-white', (KASIR_THEME[st.theme] ?? KASIR_THEME.ungu).header)}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Kasir</p>
        <p className="text-[16px] font-extrabold">{shop.emoji || '🏪'} {shop.name}</p>
        {st.greeting && <p className="text-[11px] text-white/70">{st.greeting}</p>}
      </div>

      <div>
        <span className={labelCls}>Tema warna</span>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(KASIR_THEME).map(([id, t]) => (
            <button key={id} type="button" onClick={() => set('theme', id)} aria-pressed={st.theme === id} className={cn('flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-bold ring-1 transition', st.theme === id ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 ring-slate-100 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')}>
              <span className="h-6 w-6 rounded-full ring-2 ring-white/80" style={{ background: t.swatch }} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Tata letak produk</span>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{LAYOUTS.map((l) => <button key={l.id} type="button" onClick={() => set('layout', l.id)} aria-pressed={st.layout === l.id} className={seg(st.layout === l.id)}><l.icon size={14} /> {l.label}</button>)}</div>
      </div>
      {st.layout !== 'list' && (
        <div className="grid grid-cols-2 gap-3">
          <div><span className={labelCls}>Kolom (layar lebar)</span><div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{([2, 3, 4] as const).map((n) => <button key={n} type="button" onClick={() => set('columns', n)} aria-pressed={st.columns === n} className={seg(st.columns === n)}>{n}</button>)}</div></div>
          <div><span className={labelCls}>Gaya kartu</span><div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{CARDS.map((c) => <button key={c.id} type="button" onClick={() => set('card', c.id)} aria-pressed={st.card === c.id} className={seg(st.card === c.id)}>{c.label}</button>)}</div></div>
        </div>
      )}
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Tampilkan satuan (per pcs, dll)</span>
        <input type="checkbox" checked={st.showUnit} onChange={(e) => set('showUnit', e.target.checked)} className="h-5 w-5 accent-violet-600" />
      </label>
      <label className="block"><span className={labelCls}>Teks sambutan di header</span><input value={st.greeting} onChange={(e) => set('greeting', e.target.value)} maxLength={80} placeholder="mis. Top up kilat, buka 24 jam" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Penutup struk WA</span><input value={st.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} maxLength={120} placeholder="Terima kasih sudah belanja! 🙏" className={fieldCls} /></label>

      {order.length > 1 && (
        <div>
          <span className={labelCls}>Urutan kategori</span>
          <ul className="space-y-1.5">
            {order.map((g, i) => (
              <li key={g} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <span className="w-5 text-center text-[12px] font-bold text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{g}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${g}`} className="rounded-full p-1.5 text-slate-500 hover:bg-white disabled:opacity-30 dark:hover:bg-slate-900"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Turunkan ${g}`} className="rounded-full p-1.5 text-slate-500 hover:bg-white disabled:opacity-30 dark:hover:bg-slate-900"><ArrowDown size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={save} disabled={busy || !shop.styleReady} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-violet-600">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan tampilan</button>

      {/* Atur lewat AI milik pengguna (MCP) */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-3.5 dark:from-violet-500/10 dark:to-sky-500/10">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-900 dark:text-white"><Bot size={15} className="text-violet-600" /> Atur pakai AI-mu sendiri</p>
        <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">Hubungkan Claude atau ChatGPT-mu ke Leosiqra, lalu minta dengan bahasa biasa — AI-mu yang mengubah tampilan & katalog kasir. Tidak memakai kuota AI Leosiqra. Mengubah lewat AI khusus akun PRO.</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { navigator.clipboard.writeText(prompt).then(() => onDone('Perintah tersalin — tempel di Claude/ChatGPT yang sudah terhubung.'), () => onDone('Tidak bisa menyalin otomatis.')); }} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200"><Copy size={13} /> Salin perintah</button>
          {app
            ? <Link href="/app/profile" className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[12px] font-bold text-white hover:bg-violet-700"><Bot size={13} /> Hubungkan AI</Link>
            : <button type="button" onClick={() => openSettings('ai')} className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[12px] font-bold text-white hover:bg-violet-700"><Bot size={13} /> Hubungkan AI</button>}
        </div>
      </div>
    </div>
  );
}
