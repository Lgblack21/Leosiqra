"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, ExternalLink, Gem, ImagePlus, Loader2, Lock, Minus, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { imageFileToBase64 } from '@/lib/quick/ai';
import type { ExchangeRates } from '@/lib/services/exchangeRateService';
import { collectibleService } from '@/lib/services/collectibleService';
import { COLLECTIBLE_CONDITIONS, fmtForeign, marketImage, priceIdr, tcgImage, variantLabel, type Collectible, type CollectibleCondition, type SteamLink, type TcgCard } from '@/lib/collectibles';

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 13);
const group = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '');
type Step = { k: 'pick' } | { k: 'search' } | { k: 'steam' } | { k: 'form'; card?: TcgCard };

export function CollectibleEditor({ item, rates, steam, startSteam, onDone }: { item?: Collectible | null; rates: ExchangeRates; steam?: SteamLink | null; startSteam?: boolean; onDone: (msg: string) => void }) {
  const [step, setStep] = useState<Step>(item ? { k: 'form' } : startSteam ? { k: 'steam' } : { k: 'pick' });
  if (step.k === 'pick') return <KindPicker steamLinked={Boolean(steam)} onPick={(k) => setStep(k === 'pokemon' ? { k: 'search' } : k === 'steam' ? { k: 'steam' } : { k: 'form' })} />;
  if (step.k === 'steam') return <SteamImport steam={steam ?? null} onBack={startSteam ? undefined : () => setStep({ k: 'pick' })} onDone={onDone} />;
  if (step.k === 'search') return <PokemonSearch rates={rates} onBack={() => setStep({ k: 'pick' })} onPick={(card) => setStep({ k: 'form', card })} />;
  return <CollectibleForm item={item} card={step.card} rates={rates} onBack={item ? undefined : () => setStep(step.card ? { k: 'search' } : { k: 'pick' })} onDone={onDone} />;
}

function KindPicker({ steamLinked, onPick }: { steamLinked: boolean; onPick: (k: 'pokemon' | 'lainnya' | 'steam') => void }) {
  const opt = (k: 'pokemon' | 'lainnya' | 'steam', title: string, desc: string, icon: React.ReactNode, tone: string, soon = false) => (
    <button key={k} type="button" disabled={soon} onClick={() => onPick(k)} className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors', soon ? 'cursor-not-allowed bg-slate-50 ring-slate-100 dark:bg-slate-800/40 dark:ring-slate-800' : 'bg-white ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800')}>
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-1.5 text-[15px] font-bold', soon ? 'text-slate-400' : 'text-slate-900 dark:text-white')}>{title}{soon && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Segera</span>}</span>
        <span className="block text-[12px] text-slate-500 dark:text-slate-400">{desc}</span>
      </span>
      {!soon && <ChevronRight size={18} className="shrink-0 text-slate-300" />}
    </button>
  );
  return (
    <div className="space-y-2">
      {opt('pokemon', 'Kartu Pokémon', 'Cari kartunya — foto & harga pasar otomatis, dalam Rupiah', <span className="text-[22px]">⚡</span>, 'bg-yellow-50 dark:bg-yellow-500/15')}
      {opt('lainnya', 'Koleksi lain', 'Sneakers, figur, LEGO, koin, perangko… nilainya kamu isi', <Gem size={22} />, 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300')}
      {opt('steam', 'Item Steam (CS2)', steamLinked ? 'Sudah terhubung — sinkron ulang inventaris & harga' : 'Impor inventaris publik CS2 — skin, case, stiker + harga pasar', <span className="text-[20px]">🎮</span>, 'bg-slate-100 dark:bg-slate-800')}
    </div>
  );
}

function SteamImport({ steam, onBack, onDone }: { steam: SteamLink | null; onBack?: () => void; onDone: (msg: string) => void }) {
  const [profile, setProfile] = useState('');
  const [busy, setBusy] = useState<'' | 'sync' | 'unlink'>('');
  const [error, setError] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const run = async (useSaved: boolean) => {
    if (busy) return;
    const p = profile.trim();
    if (!useSaved && !p) { setError('Tempel tautan profil Steam kamu dulu.'); return; }
    setBusy('sync');
    setError('');
    try {
      const r = await collectibleService.steamImport(useSaved ? undefined : p);
      const parts = [r.added && `${r.added} baru`, r.updated && `${r.updated} diperbarui`, r.removed && `${r.removed} sudah tidak ada`].filter(Boolean).join(', ');
      const pending = r.total - r.priced;
      onDone(r.total === 0 ? 'Inventaris CS2 terbaca, tapi belum ada item yang bisa dijual di pasar.' : `Steam tersinkron: ${r.total} item${parts ? ` (${parts})` : ''}.${pending > 0 ? ` Harga ${pending} item menyusul.` : ''}${r.truncated ? ' Sebagian tidak masuk (batas 2.000 koleksi).' : ''}`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Impor gagal. Coba lagi sebentar.');
      setBusy('');
    }
  };
  const unlink = async () => {
    if (!confirmUnlink) { setConfirmUnlink(true); return; }
    setBusy('unlink');
    try { await collectibleService.steamUnlink(); onDone('Steam diputus. Item Steam dihapus dari Koleksiku.'); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memutus.'); setBusy(''); }
  };
  const synced = steam?.syncedAt ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(steam.syncedAt)) : null;
  return (
    <div className="space-y-4">
      {onBack && <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Jenis koleksi</button>}
      <div className="web-keep relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] p-4 text-white">
        <p className="text-[15px] font-extrabold">🎮 Inventaris CS2 → Koleksiku</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/70">Item yang bisa dijual (skin, case, stiker) masuk otomatis dengan gambar & harga pasar dalam Rupiah. Sinkron ulang kapan saja — yang sudah terjual ikut terhapus.</p>
      </div>
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      {steam ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">Terhubung ke Steam</p>
            <p className="mt-0.5 break-all text-[12px] text-slate-500 dark:text-slate-400">ID {steam.id}{synced ? ` · sinkron terakhir ${synced}` : ''}</p>
          </div>
          <button type="button" onClick={() => run(true)} disabled={Boolean(busy)} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600">
            {busy === 'sync' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={17} />} Sinkron ulang sekarang
          </button>
          <button type="button" onClick={unlink} disabled={Boolean(busy)} className={cn('flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-[13px] font-bold', confirmUnlink ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')}>
            {busy === 'unlink' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {confirmUnlink ? 'Yakin? Semua item Steam dihapus' : 'Putuskan Steam'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400">Tautan profil Steam</span>
            <input autoFocus value={profile} onChange={(e) => setProfile(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(false); }} placeholder="steamcommunity.com/id/namamu" aria-label="Tautan profil Steam" maxLength={200} className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900" />
            <span className="mt-1 block px-1 text-[11px] text-slate-400">Bisa juga Steam ID 17 digit (7656119…). Tanpa login, tanpa kata sandi.</span>
          </label>
          <p className="flex gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <span>Inventaris harus <b>Publik</b>: Steam → Profil → Edit Profil → Pengaturan Privasi → Inventaris → Publik.{' '}
              <a href="https://steamcommunity.com/my/edit/settings" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold underline">Buka <ExternalLink size={11} /></a>
            </span>
          </p>
          <button type="button" onClick={() => run(false)} disabled={Boolean(busy) || !profile.trim()} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {busy ? 'Membaca inventaris…' : 'Impor inventaris'}
          </button>
        </div>
      )}
      <p className="px-1 text-[11px] text-slate-400">Harga: median penjualan Skinport (cadangan: Steam Market), USD → Rupiah. Perkiraan, bukan tawaran jual.</p>
    </div>
  );
}

function PokemonSearch({ rates, onBack, onPick }: { rates: ExchangeRates; onBack: () => void; onPick: (c: TcgCard) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TcgCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const my = ++seq.current;
    const t = window.setTimeout(() => {
      setBusy(true);
      setError('');
      collectibleService
        .searchPokemon(term)
        .then((r) => { if (my === seq.current) setItems(r); })
        .catch((e) => { if (my === seq.current) setError(e instanceof Error ? e.message : 'Pencarian gagal.'); })
        .finally(() => { if (my === seq.current) setBusy(false); });
    }, 450);
    return () => window.clearTimeout(t);
  }, [q]);
  const best = (c: TcgCard) => Object.values(c.prices).sort((a, b) => b.price - a.price)[0];
  const shown = q.trim().length < 2 ? null : items;
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Jenis koleksi</button>
      <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
        {busy ? <Loader2 size={17} className="shrink-0 animate-spin text-slate-400" /> : <Search size={17} className="shrink-0 text-slate-400" />}
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Charizard, Pikachu 58/102…" aria-label="Cari kartu Pokémon" className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white" />
      </label>
      {error && <p className="px-1 text-[13px] font-semibold text-rose-600">{error}</p>}
      {!shown ? (
        <p className="px-1 text-[12px] text-slate-500 dark:text-slate-400">Ketik nama kartu (bahasa Inggris). Tambah nomor untuk mempersempit, mis. “Pikachu 58”. Data & harga: TCGdex (TCGplayer/Cardmarket).</p>
      ) : shown.length === 0 && !busy ? (
        <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">Kartu tidak ditemukan. Coba ejaan Inggris, mis. “Charizard”.</p>
      ) : (
        <ul className="max-h-[56vh] space-y-1 overflow-y-auto pr-1">
          {shown.map((c) => {
            const p = best(c);
            const idr = p ? priceIdr(p.price, p.currency, rates) : null;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onPick(c)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element -- gambar kartu dari CDN TCGdex */}
                  <img src={tcgImage(c.image) ?? ''} alt="" loading="lazy" className="h-[76px] w-[54px] shrink-0 rounded-md bg-slate-100 object-cover shadow-sm dark:bg-slate-800" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-slate-900 dark:text-white">{c.name}</span>
                    <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{[c.set, c.number && `#${c.number}`, c.rarity].filter(Boolean).join(' · ')}</span>
                    <span className="mt-0.5 block text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{p ? `${idr != null ? formatIDR(Math.round(idr)) : fmtForeign(p.price, p.currency)} · harga pasar` : <span className="font-semibold text-slate-400">Belum ada harga pasar</span>}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CollectibleForm({ item, card, rates, onBack, onDone }: { item?: Collectible | null; card?: TcgCard; rates: ExchangeRates; onBack?: () => void; onDone: (msg: string) => void }) {
  const isPokemon = item ? item.kind === 'pokemon' : Boolean(card);
  const isSteam = item?.kind === 'steam';
  const isMarket = isPokemon || isSteam;
  const variants = card ? Object.entries(card.prices) : [];
  const [variant, setVariant] = useState<string | null>(item?.variant ?? variants.sort((a, b) => b[1].price - a[1].price)[0]?.[0] ?? null);
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(item?.quantity ?? 1);
  const [price, setPrice] = useState(item ? String(Math.round(item.purchasePrice)) : '');
  const [manual, setManual] = useState(item?.manualValue != null ? String(Math.round(item.manualValue)) : '');
  const [condition, setCondition] = useState<CollectibleCondition | null>(item?.condition ?? null);
  const [grade, setGrade] = useState(item?.grade ?? '');
  const [acquired, setAcquired] = useState(item?.acquiredDate ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const title = card?.name ?? item?.name ?? '';
  const sub = card ? [card.set, card.number && `#${card.number}`].filter(Boolean).join(' · ') : item && isPokemon ? [item.setName, item.number && `#${item.number}`].filter(Boolean).join(' · ') : isSteam ? item?.setName ?? 'Item CS2' : '';
  const img = card ? tcgImage(card.image, 'high') : item && isMarket ? marketImage(item, 'high') : photo?.preview ?? (item?.hasPhoto ? collectibleService.photoUrl(item) : null);
  const chosen = card && variant ? card.prices[variant] : undefined;
  const unitMarket = chosen ? priceIdr(chosen.price, chosen.currency, rates) : item && isMarket && item.marketPrice != null && item.marketCurrency ? priceIdr(item.marketPrice, item.marketCurrency, rates) : null;
  const unitValue = isMarket ? unitMarket ?? Number(price || '0') : manual ? Number(manual) : Number(price || '0');
  const gain = (unitValue - Number(price || '0')) * qty;

  const pickFile = async (file?: File) => {
    if (!file) return;
    try {
      const base64 = await imageFileToBase64(file, 1280, 0.82);
      setPhoto({ base64, preview: `data:image/jpeg;base64,${base64}` });
    } catch { setError('Foto tidak bisa dibaca.'); }
  };

  const save = async () => {
    if (busy) return;
    if (!isMarket && !name.trim()) { setError('Isi nama koleksinya.'); return; }
    setBusy(true);
    setError('');
    const input = {
      ...(isMarket ? {} : { name: name.trim(), manualValue: manual ? Number(manual) : null }),
      variant: isPokemon ? variant : undefined,
      ...(isSteam ? {} : { quantity: qty }), // jumlah item Steam mengikuti inventaris
      purchasePrice: Number(price || '0'),
      condition,
      grade: grade.trim(),
      acquiredDate: acquired || null,
      note: note.trim(),
    };
    let id = item?.id;
    try {
      if (id) await collectibleService.update(id, input);
      else id = await collectibleService.create({ ...input, kind: isPokemon ? 'pokemon' : 'lainnya', ...(card ? { refId: card.id } : {}) });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
      return;
    }
    if (photo && !isMarket) {
      try { await collectibleService.setPhoto(id, photo.base64); } catch (e) { setBusy(false); onDone(`Tersimpan, tapi foto gagal diunggah${e instanceof Error && e.message ? `: ${e.message}` : '.'}`); return; }
    }
    setBusy(false);
    onDone(item ? 'Perubahan disimpan.' : `${title || name.trim()} masuk Koleksiku.`);
  };

  const remove = async () => {
    if (!item) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try { await collectibleService.remove(item.id); onDone('Koleksi dihapus.'); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus.'); setBusy(false); }
  };

  const label = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';
  const input = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  const chip = (on: boolean) => cn('rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors', on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700');

  return (
    <div className="space-y-4">
      {onBack && <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> {card ? 'Cari kartu lain' : 'Jenis koleksi'}</button>}
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      <div className="flex gap-4">
        <div className={cn('relative shrink-0 overflow-hidden', isPokemon ? 'h-[140px] w-[100px] rounded-xl bg-slate-100 shadow-md dark:bg-slate-800' : isSteam ? 'web-keep h-[112px] w-[112px] rounded-3xl bg-[radial-gradient(circle_at_50%_40%,#334155_0%,#0f172a_75%)] p-2' : 'h-[112px] w-[112px] rounded-3xl bg-slate-100 dark:bg-slate-800')}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element -- kartu TCGdex / ikon Steam / foto privat dari API
            <img src={img} alt={title} className={cn('h-full w-full', isSteam ? 'object-contain' : 'object-cover')} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-violet-500"><Gem size={36} strokeWidth={1.5} /></span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          {isMarket ? (
            <>
              <p className="break-words text-[18px] font-extrabold leading-tight text-slate-900 dark:text-white">{title}</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{sub}{(card?.rarity ?? item?.rarity) ? ` · ${card?.rarity ?? item?.rarity}` : ''}</p>
            </>
          ) : (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama, mis. Jordan 1 Chicago" aria-label="Nama koleksi" maxLength={80} className={cn(input, 'font-bold')} autoFocus={!item} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => camRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Camera size={15} /> Kamera</button>
                <button type="button" onClick={() => galRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><ImagePlus size={15} /> Galeri</button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            </>
          )}
        </div>
      </div>

      {card && variants.length > 0 && (
        <div>
          <span className={label}>Cetakan</span>
          <div className="flex flex-wrap gap-1.5">
            {variants.map(([k, p]) => {
              const idr = priceIdr(p.price, p.currency, rates);
              return (
                <button key={k} type="button" onClick={() => setVariant(k)} className={cn(chip(variant === k), 'flex flex-col items-start rounded-2xl px-3 py-2 text-left')}>
                  <span>{variantLabel(k)}</span>
                  <span className="text-[11px] font-semibold opacity-70">{idr != null ? formatIDR(Math.round(idr)) : fmtForeign(p.price, p.currency)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {isSteam ? (
          <div>
            <span className={label}>Jumlah</span>
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-extrabold tabular-nums text-slate-900 dark:bg-slate-800 dark:text-white">{qty} <span className="text-[11px] font-semibold text-slate-400">dari inventaris</span></p>
          </div>
        ) : (
        <div>
          <span className={label}>Jumlah</span>
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
            <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Kurangi" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"><Minus size={16} /></button>
            <span className="text-[17px] font-extrabold tabular-nums text-slate-900 dark:text-white">{qty}</span>
            <button type="button" onClick={() => setQty((n) => Math.min(9999, n + 1))} aria-label="Tambah" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"><Plus size={16} /></button>
          </div>
        </div>
        )}
        <label className="block">
          <span className={label}>Harga beli / item</span>
          <span className={cn(input, 'flex items-center gap-1.5 focus-within:bg-white focus-within:ring-indigo-500 dark:focus-within:bg-slate-900')}>
            <span className="text-slate-400">Rp</span>
            <input value={group(price)} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label="Harga beli per item" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
          </span>
        </label>
      </div>

      {!isMarket && (
        <label className="block">
          <span className={label}>Nilai pasar sekarang / item</span>
          <span className={cn(input, 'flex items-center gap-1.5 focus-within:bg-white focus-within:ring-indigo-500 dark:focus-within:bg-slate-900')}>
            <span className="text-slate-400">Rp</span>
            <input value={group(manual)} onChange={(e) => setManual(digits(e.target.value))} inputMode="numeric" placeholder="Kosongkan = sama dengan harga beli" aria-label="Nilai sekarang per item" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
          </span>
          <span className="mt-1 block px-1 text-[11px] text-slate-400">Cek harga jual terbaru di marketplace, lalu perbarui di sini sesekali.</span>
        </label>
      )}

      <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">Nilai sekarang{qty > 1 ? ` (${qty}×)` : ''}</span>
          <span className="text-[20px] font-extrabold tabular-nums text-slate-900 dark:text-white">{formatIDR(Math.round(unitValue * qty))}</span>
        </div>
        {Number(price || '0') > 0 && (
          <p className={cn('text-right text-[12px] font-bold tabular-nums', gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {gain >= 0 ? '+' : '−'}{formatIDR(Math.round(Math.abs(gain)))} dari harga beli
          </p>
        )}
        {isPokemon && <p className="mt-1 text-[11px] text-slate-400">Harga pasar TCGplayer/Cardmarket, dikonversi ke Rupiah & diperbarui otomatis.</p>}
        {isSteam && <p className="mt-1 text-[11px] text-slate-400">{item?.marketPrice != null ? 'Median penjualan Skinport/Steam Market, dikonversi ke Rupiah & diperbarui otomatis.' : 'Harga pasar sedang diambil — muncul setelah pembaruan berikutnya.'}</p>}
      </div>

      {!isSteam && (
      <div>
        <span className={label}>Kondisi</span>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTIBLE_CONDITIONS.map((c) => <button key={c} type="button" onClick={() => setCondition(condition === c ? null : c)} className={chip(condition === c)}>{c}</button>)}
        </div>
      </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!isSteam && <label className="block"><span className={label}>Grade</span><input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={30} placeholder="mis. PSA 10" className={input} /></label>}
        <label className={cn('block', isSteam && 'col-span-2')}><span className={label}>Didapat</span><input type="date" value={acquired} max={toLocalDateString()} onChange={(e) => setAcquired(e.target.value)} className={input} /></label>
      </div>
      <label className="block"><span className={label}>Catatan</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Tempat beli, sleeve, lokasi simpan… (opsional)" className={cn(input, 'resize-none')} /></label>

      <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {item ? 'Simpan perubahan' : 'Simpan ke Koleksiku'}
      </button>
      {item && (
        <button type="button" onClick={remove} disabled={busy} className={cn('flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-[13px] font-bold', confirmDelete ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')}>
          <Trash2 size={14} /> {confirmDelete ? 'Yakin hapus koleksi ini?' : 'Hapus dari Koleksiku'}
        </button>
      )}
      {item && isSteam && <p className="text-center text-[11px] text-slate-400">Item yang dihapus muncul lagi saat sinkron Steam kalau masih ada di inventaris.</p>}
    </div>
  );
}
