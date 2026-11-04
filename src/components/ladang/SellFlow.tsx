"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, CloudCheck, Copy, ExternalLink, ImagePlus, Loader2, Search, Share2, Sparkles, Wallet, X } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { itemService, listingService, type ItemAppraisal, type Listing } from '@/lib/services/itemService';
import { imageFileToBase64 } from '@/lib/quick/ai';
import { accountService } from '@/lib/services/accountService';
import { addTransaction } from '@/lib/services/transactionService';
import { isCreditAccountType } from '@/lib/creditCard';
import type { Item } from '@/lib/itemValue';

// Ladangku: jual satu barang — foto (opsional; AI mengenali barang & menilai
// kondisi) + detail → AI menaksir harga dari iklan barang yang sama di web +
// menulis iklan → OTOMATIS tersimpan di "Sedang dijual" (listings) → salin/
// bagikan → "Sudah laku" (iklan & barang Barangku terjual + pemasukan, atomik).

const CONDITIONS = ['Seperti baru', 'Bagus', 'Ada pemakaian', 'Perlu servis'] as const;
const SOURCES = ['OLX', 'Tokopedia', 'Shopee', 'Facebook Marketplace', 'Carousell', 'Bukalapak'];
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 13);
const group = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '');
type PriceKey = 'quick_sale' | 'price_fair' | 'price_high';
const PRICE_OPTS: { key: PriceKey; label: string; hint: string }[] = [
  { key: 'quick_sale', label: 'Cepat laku', hint: '1–3 hari' },
  { key: 'price_fair', label: 'Wajar', hint: 'harga pasaran' },
  { key: 'price_high', label: 'Kalau sabar', hint: 'tunggu pembeli' },
];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

const pickFor = (a: ItemAppraisal, price?: number): PriceKey => (PRICE_OPTS.find((o) => a[o.key] === price)?.key ?? 'price_fair');

export function SellFlow({ item, listing, onDone }: { item?: Item | null; listing?: Listing | null; onDone: (msg: string) => void }) {
  const saved = listing?.appraisal;
  const [step, setStep] = useState<'form' | 'search' | 'result' | 'sold'>(saved ? 'result' : 'form');
  const [name, setName] = useState(listing?.name ?? (item ? [item.brand, item.name].filter(Boolean).join(' ') : ''));
  const [variant, setVariant] = useState(listing?.variant ?? item?.variant ?? '');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>(((CONDITIONS as readonly string[]).includes(listing?.condition ?? '') ? listing!.condition : 'Bagus') as (typeof CONDITIONS)[number]);
  const [completeness, setCompleteness] = useState(listing?.completeness ?? '');
  const [minus, setMinus] = useState(listing?.minus ?? '');
  const [area, setArea] = useState(() => { if (listing?.area) return listing.area; try { return localStorage.getItem('leosiqra-ladang-area') ?? ''; } catch { return ''; } });
  const [error, setError] = useState('');
  const [result, setResult] = useState<ItemAppraisal | null>(saved ?? null);
  const [pick, setPick] = useState<PriceKey>(saved ? pickFor(saved, listing?.price) : 'price_fair');
  const [title, setTitle] = useState(listing?.title ?? '');
  const [desc, setDesc] = useState(listing?.description ?? '');
  const [copied, setCopied] = useState(false);
  const [listingId, setListingId] = useState<string | null>(listing?.id ?? null);
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [scanNote, setScanNote] = useState('');
  const [scanning, setScanning] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const existingPhoto = listing ? listingService.photoUrl(listing) : item?.hasPhoto ? itemService.photoUrl(item) : null;

  // Foto → AI mengenali barang (isi nama/varian yang masih kosong). Foto yang sama ikut ke taksiran.
  const pickFile = async (file?: File) => {
    if (!file) return;
    let base64: string;
    try { base64 = await imageFileToBase64(file, 1280, 0.8); } catch { setError('Foto tidak bisa dibaca.'); return; }
    setPhoto({ base64, preview: `data:image/jpeg;base64,${base64}` });
    setError('');
    setScanning(true);
    setScanNote('');
    try {
      const s = await itemService.scan(base64);
      const full = [s.brand, s.name].filter(Boolean).join(' ');
      if (!name.trim() && full) setName(full);
      if (!variant.trim() && s.variant) setVariant(s.variant);
      setScanNote(full ? `AI mengenali: ${full}${s.variant ? ` · ${s.variant}` : ''}` : '');
    } catch { /* nama bisa diketik manual */ } finally { setScanning(false); }
  };

  // Ubah harga/judul/deskripsi → tersimpan otomatis ke iklan (jeda 800 ms).
  const firstSave = useRef(true);
  useEffect(() => {
    if (!listingId || !result || step !== 'result') return;
    if (firstSave.current) { firstSave.current = false; return; }
    const t = window.setTimeout(() => { void listingService.update(listingId, { price: result[pick], title, description: desc }).catch(() => undefined); }, 800);
    return () => window.clearTimeout(t);
  }, [listingId, result, pick, title, desc, step]);

  const run = async () => {
    if (name.trim().length < 2) { setError('Isi nama barangnya dulu.'); return; }
    setError('');
    setStep('search');
    try { localStorage.setItem('leosiqra-ladang-area', area.trim()); } catch { /* abaikan */ }
    try {
      const { appraisal: r, listingId: lid } = await itemService.appraise({ itemId: item?.id ?? listing?.itemId, listingId: listingId ?? undefined, imageBase64: photo?.base64, name: name.trim(), variant: variant.trim(), condition, completeness: completeness.trim(), minus: minus.trim(), area: area.trim() });
      firstSave.current = true;
      setResult(r);
      setTitle(r.title);
      setDesc(r.description);
      setPick('price_fair');
      if (lid) setListingId(lid);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Taksir harga gagal. Coba lagi sebentar.');
      setStep('form');
    }
  };

  const price = result ? result[pick] : 0;
  const adText = `${title}\n\nHarga: ${formatIDR(price)}${pick === 'price_high' ? ' (nego)' : ''}\n\n${desc}${area.trim() ? `\n\nLokasi: ${area.trim()} (COD/kirim)` : ''}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(adText); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setError('Tidak bisa menyalin otomatis — pilih teksnya lalu salin manual.'); }
  };
  const share = async () => {
    try { await navigator.share({ title, text: adText }); } catch { /* dibatalkan */ }
  };

  const label = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';
  const input = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-emerald-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  const chip = (on: boolean) => cn('rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors', on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700');

  if (step === 'search') return <Searching name={name.trim()} />;
  if (step === 'sold' && result) return <SoldForm item={item} listingId={listingId} name={name.trim()} defaultPrice={price} onBack={() => setStep('result')} onDone={onDone} />;

  if (step === 'result' && result) {
    const span = Math.max(1, result.price_high - result.price_low);
    const pos = (n: number) => `${Math.min(100, Math.max(0, ((n - result.price_low) / span) * 100))}%`;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setStep('form')} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Ubah detail</button>
        {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        {listingId && <p className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CloudCheck size={15} /> Tersimpan di &ldquo;Sedang dijual&rdquo; — perubahan harga & iklan ikut tersimpan.</p>}

        <section className="web-keep relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_0%_0%,#065f46_0%,#0b1220_65%)] p-5 text-white">
          <p className="text-[12px] font-semibold text-white/60">Pasaran bekas {name.trim()}</p>
          <p className="mt-1 text-[30px] font-extrabold leading-none tabular-nums">{formatIDR(result.price_fair)}</p>
          <p className="mt-1 text-[12px] text-white/60 tabular-nums">rentang {formatIDR(result.price_low)} – {formatIDR(result.price_high)}</p>
          <div className="relative mt-5 h-2 rounded-full bg-gradient-to-r from-amber-300 via-emerald-400 to-sky-400">
            {(['quick_sale', 'price_fair', 'price_high'] as PriceKey[]).map((k) => (
              <span key={k} className={cn('absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b1220] transition-transform', pick === k ? 'scale-125 bg-white' : 'bg-white/60')} style={{ left: pos(result[k]) }} />
            ))}
          </div>
          {result.basis && <p className="mt-4 text-[12px] leading-relaxed text-white/70">{result.basis}</p>}
          {result.seen && <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-emerald-200"><Camera size={13} className="mt-0.5 shrink-0" />{result.seen}</p>}
          {!result.web && <p className="mt-2 text-[11px] text-amber-300">Pencarian iklan sedang mati — ini perkiraan kasar AI.</p>}
        </section>

        <div>
          <span className={label}>Pasang harga</span>
          <div className="grid grid-cols-3 gap-2">
            {PRICE_OPTS.map((o) => (
              <button key={o.key} type="button" onClick={() => setPick(o.key)} className={cn('rounded-2xl px-2 py-2.5 text-left ring-1 transition-colors', pick === o.key ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800')}>
                <span className="block text-[11px] font-bold opacity-80">{o.label}</span>
                <span className="block text-[13px] font-extrabold tabular-nums">{formatIDR(result[o.key])}</span>
                <span className="block text-[10px] opacity-70">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {result.comparables.length > 0 && (
          <div>
            <span className={label}>Iklan pembanding di internet</span>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-100 dark:divide-slate-800 dark:ring-slate-800">
              {result.comparables.map((c) => (
                <li key={c.url}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">{c.title}</span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{host(c.url)}</span>
                    </span>
                    {c.price != null && <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{formatIDR(c.price)}</span>}
                    <ExternalLink size={14} className="shrink-0 text-slate-300" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <span className={label}>Iklan siap pasang</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} aria-label="Judul iklan" className={cn(input, 'font-bold')} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={7} maxLength={1500} aria-label="Deskripsi iklan" className={cn(input, 'resize-y text-[14px] font-medium leading-relaxed')} />
          {result.tips && <p className="flex gap-1.5 px-1 text-[12px] text-slate-500 dark:text-slate-400"><Sparkles size={13} className="mt-0.5 shrink-0 text-amber-500" />{result.tips}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white hover:bg-slate-800 dark:bg-emerald-600">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Tersalin' : 'Salin iklan'}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <button type="button" onClick={share} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-3 text-[14px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Share2 size={16} /> Bagikan</button>
            ) : (
              <a href={`https://www.olx.co.id/post`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-3 text-[14px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><ExternalLink size={16} /> Pasang di OLX</a>
            )}
          </div>
        </div>

        <button type="button" onClick={() => setStep('sold')} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 py-3.5 text-[14px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Wallet size={16} /> Sudah laku? Catat hasilnya
        </button>
        <p className="text-center text-[11px] text-slate-400">Taksiran AI dari iklan publik — bukan jaminan laku.{result.remaining != null ? ` Sisa taksir hari ini: ${result.remaining}×` : ''}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-slate-300 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          {photo || existingPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal / foto privat dari API
            <img src={photo?.preview ?? existingPhoto ?? ''} alt="Foto barang" className="h-full w-full object-cover" />
          ) : <Camera size={26} />}
          {scanning && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 size={20} className="animate-spin" /></span>}
          {photo && !scanning && <button type="button" onClick={() => { setPhoto(null); setScanNote(''); }} aria-label="Hapus foto" className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X size={12} /></button>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-900 dark:text-white">{scanning ? 'AI melihat fotomu…' : scanNote || 'Foto barangnya biar AI menilai kondisinya'}</span>
          <span className="mt-1.5 flex gap-1.5">
            <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-bold text-white dark:bg-emerald-600"><Camera size={13} /> Foto</button>
            <button type="button" onClick={() => galRef.current?.click()} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"><ImagePlus size={13} /> Galeri</button>
          </span>
        </span>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <label className="block"><span className={label}>Nama barang</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Sony A6000, iPhone 12, Vario 125" maxLength={100} className={cn(input, 'font-bold')} autoFocus={!item} /></label>
      <label className="block"><span className={label}>Varian / tipe</span><input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Lensa kit 16-50mm, 128 GB, 2021…" maxLength={100} className={input} /></label>
      <div>
        <span className={label}>Kondisi</span>
        <div className="flex flex-wrap gap-1.5">{CONDITIONS.map((c) => <button key={c} type="button" onClick={() => setCondition(c)} className={chip(condition === c)}>{c}</button>)}</div>
      </div>
      <label className="block"><span className={label}>Kelengkapan</span><input value={completeness} onChange={(e) => setCompleteness(e.target.value)} placeholder="Dus, charger, nota, 2 baterai…" maxLength={200} className={input} /></label>
      <label className="block"><span className={label}>Minus (jujur bikin cepat laku)</span><input value={minus} onChange={(e) => setMinus(e.target.value)} placeholder="Lecet tipis di layar, baterai 80%…" maxLength={200} className={input} /></label>
      <label className="block"><span className={label}>Kota / area COD</span><input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Jakarta Selatan" maxLength={60} className={input} /></label>
      <button type="button" onClick={run} disabled={name.trim().length < 2 || scanning} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
        <Search size={17} /> Taksir harga & tulis iklan
      </button>
      <p className="text-center text-[11px] text-slate-400">AI mencari iklan barang yang sama di OLX, Tokopedia, Shopee, dll. Maks 5× per hari.</p>
    </div>
  );
}

// Animasi menunggu: kaca pembesar menyapu nama-nama marketplace.
function Searching({ name }: { name: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => n + 1), 900);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center py-8 text-center" role="status" aria-live="polite">
      <div className="relative h-28 w-28">
        <span className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed border-emerald-300 dark:border-emerald-500/50" />
        <span className="absolute inset-3 animate-pulse rounded-full bg-emerald-50 dark:bg-emerald-500/10" />
        <span className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><Search size={38} className="animate-bounce" /></span>
      </div>
      <p className="mt-5 text-[16px] font-extrabold text-slate-900 dark:text-white">Mencari harga {name}…</p>
      <p className="mt-1 h-5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">Cek iklan di {SOURCES[i % SOURCES.length]}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {SOURCES.map((s, k) => <span key={s} className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors', k <= i % SOURCES.length || i >= SOURCES.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800')}>{s}</span>)}
      </div>
      <p className="mt-4 text-[11px] text-slate-400">Biasanya 10–30 detik.</p>
    </div>
  );
}

function SoldForm({ item, listingId, name, defaultPrice, onBack, onDone }: { item?: Item | null; listingId: string | null; name: string; defaultPrice: number; onBack: () => void; onDone: (msg: string) => void }) {
  const [price, setPrice] = useState(String(Math.round(defaultPrice)));
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    accountService.getUserAccounts('').then((list) => {
      const ok = list.filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name }));
      setAccounts(ok);
      if (ok[0]) setAccountId(ok[0].id);
    }).catch(() => setAccounts([]));
  }, []);
  const save = async () => {
    const n = Number(price || '0');
    if (!(n > 0)) { setError('Isi harga lakunya.'); return; }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (listingId) {
        await listingService.sold(listingId, n, accountId || null, date);
      } else if (item) {
        await itemService.sell(item.id, n, accountId || null, date);
      } else if (accountId) {
        const [y, m, d] = date.split('-').map(Number);
        await addTransaction({ type: 'pemasukan', amount: n, amountIDR: n, currency: 'IDR', category: 'Pemasukan', subCategory: 'Jual Barang', accountId, date: new Date(y, m - 1, d, 12), note: `Jual ${name}`, applyBalance: true });
      }
      onDone(accountId ? `Laku ${formatIDR(n)} — masuk ke rekening & tercatat sebagai pemasukan.` : `Laku ${formatIDR(n)} — barang ditandai terjual.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat.');
      setBusy(false);
    }
  };
  const label = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';
  const input = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent focus:bg-white focus:ring-emerald-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Kembali ke iklan</button>
      <p className="text-[18px] font-extrabold text-slate-900 dark:text-white">🎉 {name} laku!</p>
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      <label className="block">
        <span className={label}>Harga laku</span>
        <span className={cn(input, 'flex items-center gap-1.5 focus-within:bg-white focus-within:ring-emerald-500 dark:focus-within:bg-slate-900')}>
          <span className="text-slate-400">Rp</span>
          <input value={group(price)} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" aria-label="Harga laku" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
        </span>
      </label>
      <label className="block">
        <span className={label}>Uangnya masuk ke</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accounts === null} className={input}>
          {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="">{item || listingId ? 'Jangan catat pemasukan (cuma tandai terjual)' : 'Jangan catat pemasukan'}</option>
        </select>
      </label>
      <label className="block"><span className={label}>Tanggal laku</span><input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={input} /></label>
      <button type="button" onClick={save} disabled={busy || (!item && !listingId && !accountId)} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Catat hasil jual
      </button>
      <p className="text-center text-[11px] text-slate-400">{item ? 'Barang pindah ke "terjual" di Barangku (tidak dihitung lagi di kekayaan).' : 'Tercatat sebagai pemasukan kategori Pemasukan › Jual Barang.'}</p>
    </div>
  );
}
