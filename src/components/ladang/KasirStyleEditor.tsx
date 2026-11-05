"use client";

import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Code2, LayoutGrid, Loader2, Rows3, Grid3x3, ShieldCheck, Wand2 } from 'lucide-react';
import { shopService, groupProducts, KASIR_DEFAULT, type KasirStyle, type Shop } from '@/lib/services/shopService';
import { cn } from '@/lib/utils';
import { KASIR_THEME } from './kasirTheme';
import { AiMcpCard } from './AiMcpCard';
import { fieldCls, initials, labelCls, toneOf } from './UsahaView';
import { CustomKasirFrame, KASIR_SAMPLE_HTML } from './CustomKasirFrame';
import { CatalogImage } from './CatalogImage';

// Tampilan kasir per usaha: Bawaan (pilihan tema, tata letak, kolom, kartu, teks,
// urutan kategori) atau Bebas (HTML/CSS/JS sendiri di iframe sandbox, lihat
// CustomKasirFrame) — disimpan di shops.style_json. Bisa juga diubah AI milik
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

// onLeave: tutup popup ini dulu — panel Pengaturan (z-80) ada DI BAWAH Modal (z-88).
export function KasirStyleEditor({ shop, onDone, onToast, onLeave }: { shop: Shop; onDone: (m: string) => void; onToast: (m: string) => void; onLeave: () => void }) {
  const [initial] = useState<KasirStyle>(() => ({ ...KASIR_DEFAULT, ...shop.style }));
  const [st, setSt] = useState<KasirStyle>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewCart, setPreviewCart] = useState<Record<number, number>>({});
  const bebas = st.mode === 'bebas';
  const set = <K extends keyof KasirStyle>(k: K, v: KasirStyle[K]) => setSt((p) => ({ ...p, [k]: v }));
  const groups = groupProducts(shop.products).map((g) => g.group).filter(Boolean);
  const order = [...groups].sort((a, b) => { const r = (x: string) => { const k = st.categoryOrder.indexOf(x); return k < 0 ? 1000 + groups.indexOf(x) : k; }; return r(a) - r(b); });
  const move = (i: number, d: -1 | 1) => { const o = [...order]; [o[i], o[i + d]] = [o[i + d], o[i]]; set('categoryOrder', o); };
  const seg = (on: boolean) => cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold transition-colors', on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400');

  const imagePrompt = `Pakai Leosiqra (MCP): pasang logo toko & gambar tiap kategori untuk usahaku "${shop.name}" (shop_id ${shop.id}) lewat set_catalog_images. Pakai gambar yang memang boleh kupakai (mis. dari website tokoku${shop.linkUrl ? ` ${shop.linkUrl}` : ''}, tautan https); kalau tidak ada, buatkan ikon SVG orisinal per kategori yang serasi (data:image/svg+xml, ≤8.000 karakter). Nama kategori harus PERSIS: ${groups.length ? groups.join(', ') : '(lihat get_shop)'}. Tunjukkan daftar gambarnya dulu sebelum menyimpan.`;
  const setImage = (g: string, url: string) => setSt((p) => { const m = { ...p.categoryImages }; if (url.trim()) m[g] = url.trim(); else delete m[g]; return { ...p, categoryImages: m }; });
  const templatePrompt = `Pakai Leosiqra (MCP): rancang desain kasir BEBAS untuk usahaku "${shop.name}" (shop_id ${shop.id}). Ambil dulu katalognya dengan get_shop, lalu pasang lewat set_kasir_template (baca aturan di deskripsi tool itu: satu file HTML, data & aksi lewat window.Leosiqra, tanpa akses jaringan). Gaya yang aku mau: [tulis bebas, mis. nuansa neon gaming, kartu besar bergambar ikon game, tab per game di atas, tombol Bayar melayang].`;
  const prompt = `Pakai Leosiqra (MCP): ubah tampilan kasir usahaku "${shop.name}" (shop_id ${shop.id}) lewat set_kasir_style. Aku mau: [tulis keinginanmu, mis. tema gelap, katalog kategori (grid kotak game), header ringkas, tombol besar untuk tablet, struk di kiri, kartu ringkas 4 kolom, sambutan "Top up kilat 24 jam", Mobile Legends paling atas].`;
  const save = async () => {
    if (bebas && !st.customHtml.trim()) { setError('Isi kode desain dulu, pakai contoh, atau minta AI-mu mendesain.'); return; }
    // Kirim HANYA yang diubah di editor ini (server menggabungkan) — supaya perubahan AI-mu
    // lewat MCP saat editor terbuka tidak tertimpa.
    const changed = (Object.keys(st) as (keyof KasirStyle)[]).filter((k) => JSON.stringify(st[k]) !== JSON.stringify(initial[k]));
    if (!changed.length) { onDone('Tidak ada yang diubah.'); return; }
    const diff = Object.fromEntries(changed.map((k) => [k, st[k]])) as Partial<KasirStyle>;
    setBusy(true);
    setError('');
    try { await shopService.update(shop.id, { style: diff as KasirStyle }); onDone('Tampilan kasir disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {!shop.styleReady && <p role="alert" className="rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">Tampilan kasir sedang disiapkan di server — sementara belum bisa disimpan.</p>}
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      <div>
        <span className={labelCls}>Gaya kasir</span>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => set('mode', 'bawaan')} aria-pressed={!bebas} className={seg(!bebas)}><LayoutGrid size={14} /> Bawaan</button>
          <button type="button" onClick={() => set('mode', 'bebas')} aria-pressed={bebas} className={seg(bebas)}><Code2 size={14} /> Bebas (desain sendiri)</button>
        </div>
      </div>

      {bebas && (
        <div className="space-y-3 rounded-2xl ring-1 ring-violet-200 p-3 dark:ring-violet-500/30">
          <p className="flex items-start gap-1.5 text-[12px] text-slate-600 dark:text-slate-300"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" /> <span>Desain bebas: HTML, CSS & JavaScript sesukamu. Berjalan di kotak terisolasi — tidak bisa mengakses akun, saldo, atau internet. Struk & pembayaran tetap memakai struk Leosiqra.</span></p>
          <AiMcpCard title="Minta AI-mu mendesain" desc="AI-mu membuat desain kasir dari nol sesuai keinginanmu, lalu memasangnya." prompt={templatePrompt} onLeave={onLeave} onToast={onToast} />
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={labelCls}>Kode desain (HTML)</span>
              <button type="button" onClick={() => set('customHtml', KASIR_SAMPLE_HTML)} className="flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-300"><Wand2 size={12} /> Pakai contoh</button>
            </div>
            <textarea value={st.customHtml} onChange={(e) => set('customHtml', e.target.value.slice(0, 60000))} rows={10} spellCheck={false} placeholder="<style>…</style> <div id=app></div> <script>Leosiqra.onData(d => …)</script>" className="w-full resize-y rounded-2xl bg-slate-950 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-emerald-200 outline-none ring-2 ring-transparent placeholder:text-slate-500 focus:ring-violet-500" />
            <p className="mt-1 text-right text-[10px] text-slate-400">{st.customHtml.length.toLocaleString('id-ID')} / 60.000 karakter</p>
          </div>
          <details className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <summary className="cursor-pointer font-bold">Cara pakai data kasir di kode</summary>
            <ul className="mt-1.5 space-y-1">
              <li><code>Leosiqra.onData(d =&gt; …)</code> — d.shop, d.products [{'{'}i, name, price, unit, group{'}'}], d.cart, d.count, d.total.</li>
              <li><code>Leosiqra.add(i)</code> / <code>Leosiqra.remove(i)</code> — tambah/kurangi produk ke-i di struk.</li>
              <li><code>Leosiqra.checkout()</code> — buka struk. <code>Leosiqra.rupiah(n)</code> — format harga.</li>
              <li>Tidak ada fetch/XHR; gambar hanya https:/data:; Google Fonts boleh.</li>
            </ul>
          </details>
          {st.customHtml.trim() && (
            <div>
              <span className={labelCls}>Pratinjau (coba klik produknya)</span>
              <div className="max-h-[420px] overflow-y-auto rounded-[26px]">
                <CustomKasirFrame shop={{ ...shop, style: st }} products={shop.products} cart={previewCart} minHeight={240} title="Pratinjau desain kasir"
                  onAdd={(i) => setPreviewCart((c) => ({ ...c, [i]: (c[i] ?? 0) + 1 }))}
                  onRemove={(i) => setPreviewCart((c) => { const n = { ...c }; if (n[i] > 1) n[i] -= 1; else delete n[i]; return n; })}
                  onCheckout={() => onToast('Di kasir, tombol ini membuka struk.')} />
              </div>
            </div>
          )}
        </div>
      )}

      <details className="rounded-2xl ring-1 ring-slate-100 p-3 dark:ring-slate-800" open={Boolean(st.logoUrl || Object.keys(st.categoryImages).length)}>
        <summary className="cursor-pointer text-[13px] font-extrabold text-slate-900 dark:text-white">Logo & gambar kategori</summary>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Tempel tautan gambar https atau gambar data:image (mis. ikon SVG buatan AI-mu). Kosongkan untuk kembali ke inisial.</p>
        <label className="mt-2 flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-[20px] dark:bg-slate-800"><CatalogImage src={st.logoUrl} alt="Logo" fallback={shop.emoji || '🏪'} className="h-full w-full bg-white p-0.5" /></span>
          <input value={st.logoUrl} onChange={(e) => set('logoUrl', e.target.value.trim())} inputMode="url" placeholder="Logo toko — https://…/logo.png" aria-label="Tautan logo toko" className={cn(fieldCls, 'py-2 text-[12px]')} />
        </label>
        {groups.length > 0 && <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
          {groups.map((g) => (
            <li key={g} className="flex items-center gap-2">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[12px] font-extrabold', toneOf(g))}><CatalogImage src={st.categoryImages[g]} alt={g} fallback={initials(g)} className="h-full w-full bg-white" /></span>
              <input value={st.categoryImages[g] ?? ''} onChange={(e) => setImage(g, e.target.value)} inputMode="url" placeholder={`${g} — https://…`} aria-label={`Gambar ${g}`} className={cn(fieldCls, 'py-2 text-[12px]')} />
            </li>
          ))}
        </ul>}
        <AiMcpCard className="mt-3" title="Minta AI-mu memasang gambar" desc="AI-mu memasang gambar yang boleh dipakai, atau membuatkan ikon orisinal per kategori." prompt={imagePrompt} onLeave={onLeave} onToast={onToast} />
      </details>

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

      {!bebas && <>
      {groups.length > 0 && (
        <div>
          <span className={labelCls}>Cara jelajah</span>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button type="button" onClick={() => set('browse', 'katalog')} aria-pressed={st.browse === 'katalog'} className={seg(st.browse === 'katalog')}><Grid3x3 size={14} /> Katalog kategori</button>
            <button type="button" onClick={() => set('browse', 'gulir')} aria-pressed={st.browse === 'gulir'} className={seg(st.browse === 'gulir')}><Rows3 size={14} /> Semua produk</button>
          </div>
          <p className="mt-1 px-1 text-[11px] text-slate-400">{st.browse === 'katalog' ? 'Kotak per kategori/game → ketuk masuk daftar harga, ada tombol Kembali ke katalog.' : 'Semua produk dalam satu halaman, pilih kategori lewat chip.'}</p>
        </div>
      )}
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
      </>}
      <div className="grid grid-cols-2 gap-3">
        <div><span className={labelCls}>Header</span><div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{([['besar', 'Besar'], ['ringkas', 'Ringkas']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => set('header', v)} aria-pressed={st.header === v} className={seg(st.header === v)}>{l}</button>)}</div></div>
        <div><span className={labelCls}>Ukuran tombol</span><div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{([['normal', 'Normal'], ['besar', 'Besar']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => set('size', v)} aria-pressed={st.size === v} className={seg(st.size === v)}>{l}</button>)}</div></div>
      </div>
      <div><span className={labelCls}>Posisi struk (layar lebar)</span><div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">{([['kiri', 'Kiri'], ['kanan', 'Kanan']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => set('strukSide', v)} aria-pressed={st.strukSide === v} className={seg(st.strukSide === v)}>{l}</button>)}</div></div>
      <div>
        <span className={labelCls}>Tampilkan</span>
        <div className="divide-y divide-slate-100 rounded-2xl bg-slate-50 dark:divide-slate-800 dark:bg-slate-800/60">
          {([['showStats', 'Omzet hari ini & bulan ini'], ['showSearch', 'Kolom cari'], ['showRecent', 'Penjualan hari ini'], ['showUnit', 'Satuan produk (per pcs, dll)']] as const).filter(([k]) => !bebas || k === 'showStats' || k === 'showRecent').map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{l}</span>
              <input type="checkbox" checked={st[k]} onChange={(e) => set(k, e.target.checked)} className="h-5 w-5 accent-violet-600" />
            </label>
          ))}
        </div>
      </div>
      <label className="block"><span className={labelCls}>Teks sambutan di header</span><input value={st.greeting} onChange={(e) => set('greeting', e.target.value)} maxLength={80} placeholder="mis. Top up kilat, buka 24 jam" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Penutup struk WA</span><input value={st.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} maxLength={120} placeholder="Terima kasih sudah belanja! 🙏" className={fieldCls} /></label>

      {!bebas && order.length > 1 && (
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

      <AiMcpCard title="Atur pakai AI-mu sendiri" desc="Minta dengan bahasa biasa — AI-mu yang mengubah tampilan & katalog kasir." prompt={prompt} onLeave={onLeave} onToast={onToast} />
    </div>
  );
}
