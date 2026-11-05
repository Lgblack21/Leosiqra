"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Download, ExternalLink, Globe, Link2, Loader2, MessageCircle, Plus, Shuffle, Sparkles, Store, Trash2, Wand2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { shopService, catalogText, groupProducts, prettyWa, websiteBrief, PABRIK_AI_URL, type Shop, type ShopIdea, type ShopProduct } from '@/lib/services/shopService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { KASIR_THEME } from './kasirTheme';

// Ladangku › Usaha (Usahaku): AI menyusun 3 rencana usaha dari "aku bisa …" →
// simpan jadi usaha → produk & kontak → katalog siap sebar (teks WA, gambar PNG,
// tautan pesan wa.me) → catat penjualan (pemasukan + saldo, atomik di server).
// Tahap: Rencana → Katalog → Online → Jualan. Leosiqra tidak meng-host halaman publik;
// website dibuat user sendiri (brief → Pabrik.AI), lalu AI bisa membaca daftar harganya.

const STARTERS = ['Masakan rumahan', 'Desain', 'Les privat', 'Preloved', 'Kerajinan', 'Foto', 'Top up game'];
const STAGES = ['Rencana', 'Katalog', 'Online', 'Jualan'] as const;
const PRODUCTS_MAX = 120; // = SHOP_PRODUCTS_MAX di Worker
export const kasirHref = (variant: 'web' | 'app', id: string) => `${variant === 'app' ? '/app' : '/membership'}/ladang/kasir?id=${encodeURIComponent(id)}`;
export const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);
export const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
export const short = (n: number) => (n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n));
export const stageOf = (s: Shop, sales: number) => (sales > 0 ? 3 : s.promotedAt || s.linkUrl ? 2 : s.contactWa && s.products.length ? 1 : 0);

export function UsahaView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<{ k: 'ideas' } | { k: 'shop'; id: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => shopService.list().then((r) => { if (alive) { setShops(r); setError(''); } }).catch((e) => { if (alive) { setShops((p) => p ?? []); setError(e instanceof Error ? e.message : 'Gagal memuat usaha.'); } });
    const loadTx = () => transactionService.getUserTransactions('session').then((v) => alive && setTx(v)).catch(() => undefined);
    void load(); void loadTx();
    const u1 = subscribeToCollectionChanges('shops', load);
    const u2 = subscribeToCollectionChanges('transactions', loadTx);
    return () => { alive = false; u1(); u2(); };
  }, []);

  const now = toLocalDateString().slice(0, 7);
  const salesBy = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of tx) if (t.relatedType === 'shop' && t.relatedId) m.set(t.relatedId, [...(m.get(t.relatedId) ?? []), t]);
    return m;
  }, [tx]);

  const app = variant === 'app';
  const card = app ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800' : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const current = sheet?.k === 'shop' ? shops?.find((s) => s.id === sheet.id) : undefined;
  const body = sheet?.k === 'ideas'
    ? <IdeaFlow onSaved={(id, name) => { setSheet({ k: 'shop', id }); onToast(`${name} tersimpan. Lengkapi kontak supaya katalognya siap.`); }} />
    : current ? <ShopDetail shop={current} sales={salesBy.get(current.id) ?? []} kasirLink={kasirHref(variant, current.id)} onToast={onToast} onDeleted={() => { setSheet(null); onToast('Usaha dihapus. Penjualan yang tercatat tetap ada di transaksi.'); }} /> : null;
  const title = sheet?.k === 'ideas' ? 'Usaha baru' : current?.name ?? '';

  if (shops === null) return <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      {shops.length === 0 ? (
        <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#7c3aed_0%,#4c1d95_35%,#0b1220_80%)] p-5 text-white md:p-6">
          <Store aria-hidden size={150} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -right-6 text-violet-300/10" />
          <p className="text-[13px] font-semibold text-white/60">Usahaku</p>
          <p className="mt-1 text-[24px] font-extrabold leading-tight md:text-[28px]">Punya keahlian? Jadikan usaha sampingan.</p>
          <p className="mt-2 max-w-md text-[13px] text-white/70">Ceritakan apa yang bisa kamu kerjakan — AI menyusun 3 rencana lengkap: produk & harga, modal, langkah minggu ini, dan di mana cari pembeli.</p>
          <button type="button" onClick={() => setSheet({ k: 'ideas' })} className="relative mt-4 flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"><Sparkles size={15} /> Cari ide usaha</button>
        </section>
      ) : (
        <>
          {(() => {
            const all = shops.flatMap((x) => salesBy.get(x.id) ?? []);
            const mon = all.filter((t) => monthKey(t.date) === now);
            const day = all.filter((t) => toLocalDateString(new Date(t.date)) === toLocalDateString());
            return (
              <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#7c3aed_0%,#4c1d95_35%,#0b1220_80%)] p-5 text-white md:p-6">
                <Store aria-hidden size={150} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -right-6 text-violet-300/10" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white/60">Omzet usaha bulan ini</p>
                    <p className="mt-1 text-[30px] font-extrabold leading-none tabular-nums md:text-[36px]">{formatIDR(Math.round(mon.reduce((x, t) => x + amt(t), 0)))}</p>
                  </div>
                  {shops.length < 5 && <button type="button" onClick={() => setSheet({ k: 'ideas' })} className="relative flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-slate-900 hover:bg-white/90"><Plus size={14} /> Usaha baru</button>}
                </div>
                <div className="relative mt-4 grid grid-cols-3 gap-2">
                  {[['Hari ini', short(Math.round(day.reduce((x, t) => x + amt(t), 0)))], ['Transaksi bulan ini', String(mon.length)], ['Usaha', `${shops.length}/5`]].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10"><p className="truncate text-[11px] text-white/55">{k}</p><p className="text-[16px] font-extrabold tabular-nums">{v}</p></div>
                  ))}
                </div>
              </section>
            );
          })()}
          <ul className="grid gap-3 md:grid-cols-2">
            {shops.map((s) => {
              const sales = salesBy.get(s.id) ?? [];
              const month = sales.filter((t) => monthKey(t.date) === now);
              const day = sales.filter((t) => toLocalDateString(new Date(t.date)) === toLocalDateString());
              const st = stageOf(s, sales.length);
              const cats = new Set(s.products.map((p) => p.group).filter(Boolean)).size;
              const nextStep = !s.contactWa ? 'Isi nomor WhatsApp' : !s.products.length ? 'Isi katalog produk' : st < 2 ? 'Tempel website atau sebar katalog' : 'Catat penjualan pertama';
              return (
                <li key={s.id} className={cn(card, 'overflow-hidden')}>
                  <Link href={kasirHref(variant, s.id)} className="group block">
                    <div className={cn('web-keep flex items-center gap-3 px-4 py-3.5 text-white', (KASIR_THEME[s.style.theme] ?? KASIR_THEME.ungu).header)}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[22px]">{s.emoji || '🌱'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-extrabold">{s.name}</span>
                        <span className="block truncate text-[12px] text-white/65">{s.tagline || `${s.products.length} produk${cats ? ` · ${cats} kategori` : ''}`}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold transition-colors group-hover:bg-white/25"><Store size={13} /> Kasir</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-100 px-1 py-3 dark:divide-slate-800">
                      {[['Hari ini', short(Math.round(day.reduce((x, t) => x + amt(t), 0)))], ['Bulan ini', short(Math.round(month.reduce((x, t) => x + amt(t), 0)))], ['Produk', String(s.products.length)]].map(([k, v]) => (
                        <span key={k} className="px-3 text-center"><span className="block text-[11px] text-slate-400">{k}</span><span className="block text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{v}</span></span>
                      ))}
                    </div>
                  </Link>
                  {st < 3 && (
                    <button type="button" onClick={() => setSheet({ k: 'shop', id: s.id })} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <StageBar stage={st} className="flex-1" />
                      <span className="shrink-0 text-[11px] font-bold text-violet-600 dark:text-violet-300">{nextStep} →</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {app ? (
        <BottomSheet isOpen={Boolean(sheet)} onClose={() => setSheet(null)} title={title}><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{body}</div></BottomSheet>
      ) : (
        <Modal isOpen={Boolean(sheet)} onClose={() => setSheet(null)} title={title} maxWidth="max-w-xl">{body}</Modal>
      )}
    </div>
  );
}

function StageBar({ stage, className }: { stage: number; className?: string }) {
  return (
    <span className={cn('grid grid-cols-4 gap-1.5', className)} aria-label={`Tahap: ${STAGES[stage]}`}>
      {STAGES.map((s, i) => (
        <span key={s}>
          <span className={cn('block h-1.5 rounded-full', i <= stage ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />
          <span className={cn('mt-1 block text-[10px] font-semibold', i <= stage ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400')}>{s}</span>
        </span>
      ))}
    </span>
  );
}

// ── Ide usaha (AI) ───────────────────────────────────────────────────────────
function IdeaFlow({ onSaved }: { onSaved: (id: string, name: string) => void }) {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<ShopIdea[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState<'' | 'ai' | 'save'>('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [direct, setDirect] = useState(false);

  const run = async (more = false) => {
    if (text.trim().length < 4 || busy) return;
    setBusy('ai');
    setError('');
    try {
      const r = await shopService.ideas(text.trim(), more ? seen : []);
      setIdeas(r.ideas);
      setSeen((p) => [...new Set([...(more ? p : []), ...r.ideas.map((i) => i.name)])].slice(-9));
      setPick(0);
      setRemaining(r.remaining);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyusun ide.');
    } finally {
      setBusy('');
    }
  };
  const save = async (idea: ShopIdea) => {
    setBusy('save');
    try {
      const id = await shopService.create({ name: idea.name, emoji: idea.emoji, tagline: idea.tagline, description: idea.description, products: idea.products, plan: idea.plan });
      onSaved(id, idea.name);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy('');
    }
  };

  if (direct) return <DirectShopForm onBack={() => setDirect(false)} onSaved={onSaved} />;
  if (busy === 'ai') return <Thinking text={text.trim()} />;
  if (ideas) {
    const idea = ideas[pick];
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setIdeas(null)} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Ubah cerita</button>
        {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        <div role="tablist" aria-label="Pilihan ide" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {ideas.map((i, k) => <button key={i.name} type="button" role="tab" aria-selected={k === pick} onClick={() => setPick(k)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold', k === pick ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{i.emoji} {i.name}</button>)}
        </div>
        <PlanCard idea={idea} />
        <button type="button" onClick={() => save(idea)} disabled={Boolean(busy)} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-violet-600">
          {busy === 'save' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Pakai rencana ini
        </button>
        <button type="button" onClick={() => run(true)} disabled={Boolean(busy) || remaining === 0} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-[14px] font-bold text-slate-700 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"><Shuffle size={16} /> Ide lain {remaining !== null && <span className="text-[11px] font-semibold text-slate-400">(sisa {remaining}× hari ini)</span>}</button>
        <p className="text-center text-[11px] text-slate-400">Produk, harga & kontak bisa diubah setelah disimpan. Angka = perkiraan, bukan janji.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-[24px] dark:bg-violet-500/15">💡</span>
        <div>
          <p className="text-[16px] font-extrabold text-slate-900 dark:text-white">Apa yang bisa kamu kerjakan, buat, atau jual?</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">Pakai kata-katamu sendiri: &ldquo;aku jago bikin kue kering&rdquo;, &ldquo;bisa desain di Canva&rdquo;.</p>
        </div>
      </div>
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="Aku bisa…" className="w-full resize-none rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-violet-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900" />
      <div className="flex flex-wrap gap-1.5">{STARTERS.map((s) => <button key={s} type="button" onClick={() => setText((t) => (t.trim() ? `${t.trim()}, ${s.toLowerCase()}` : `Aku bisa ${s.toLowerCase()}`))} className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{s}</button>)}</div>
      <button type="button" onClick={() => run(false)} disabled={text.trim().length < 4} className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 py-3.5 text-[15px] font-bold text-white hover:bg-violet-700 disabled:opacity-40"><Sparkles size={17} /> Susun 3 rencana</button>
      <p className="text-center text-[11px] text-slate-400">Maks 5× per hari. Data keuanganmu tidak dikirim ke AI — hanya ceritamu.</p>
      <button type="button" onClick={() => setDirect(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-100 hover:bg-slate-100 dark:bg-slate-800/60 dark:ring-slate-800">
        <span><span className="block text-[14px] font-extrabold text-slate-900 dark:text-white">Sudah punya usaha?</span><span className="block text-[12px] text-slate-500 dark:text-slate-400">Daftarkan langsung tanpa AI — produk bisa diambil dari websitemu.</span></span>
        <Store size={20} className="shrink-0 text-violet-500" />
      </button>
    </div>
  );
}

// Usaha yang sudah berjalan (mis. "CXA Store") — tanpa ide AI; produk diisi manual
// atau dibaca dari website di detail usaha.
const SHOP_EMOJIS = ['🏪', '🎮', '💎', '🍰', '👕', '📱', '🎨', '📚', '🛠️', '🌿'];
function DirectShopForm({ onBack, onSaved }: { onBack: () => void; onSaved: (id: string, name: string) => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏪');
  const [tagline, setTagline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) { setError('Isi nama usahamu.'); return; }
    setBusy(true);
    setError('');
    try { onSaved(await shopService.create({ name: name.trim(), emoji, tagline: tagline.trim(), products: [] }), name.trim()); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"><ArrowLeft size={15} /> Cari ide pakai AI</button>
      <p className="text-[16px] font-extrabold text-slate-900 dark:text-white">Daftarkan usahamu</p>
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <label className="block"><span className={labelCls}>Nama usaha</span><input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={40} autoFocus placeholder="mis. Toko Kue Leosiqra" className={fieldCls} /></label>
      <div><span className={labelCls}>Ikon</span><div className="flex flex-wrap gap-1.5">{SHOP_EMOJIS.map((e) => <button key={e} type="button" onClick={() => setEmoji(e)} aria-pressed={emoji === e} className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-[20px]', emoji === e ? 'bg-violet-600 ring-2 ring-violet-300' : 'bg-slate-100 dark:bg-slate-800')}>{e}</button>)}</div></div>
      <label className="block"><span className={labelCls}>Jualan apa? (opsional)</span><input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} placeholder="mis. Kue kering & bolu rumahan" className={fieldCls} /></label>
      <FormButtons busy={busy} onSave={save} label="Simpan usaha" />
      <p className="text-center text-[11px] text-slate-400">Setelah disimpan: isi WhatsApp, lalu tempel link websitemu untuk ambil daftar harga otomatis.</p>
    </div>
  );
}

function Thinking({ text }: { text: string }) {
  const steps = ['Membaca ceritamu', 'Mengecek harga pasaran', 'Menyusun tiga rencana'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 2500); return () => window.clearInterval(t); }, [steps.length]);
  return (
    <div className="space-y-4 py-4" role="status" aria-live="polite">
      <p className="rounded-2xl bg-slate-100 px-4 py-3 text-[14px] italic text-slate-600 dark:bg-slate-800 dark:text-slate-300">&ldquo;{text}&rdquo;</p>
      <ul className="space-y-3 px-2">
        {steps.map((s, k) => (
          <li key={s} className={cn('flex items-center gap-3 text-[15px] font-bold transition-colors', k < i ? 'text-emerald-600 dark:text-emerald-400' : k === i ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600')}>
            {k < i ? <Check size={18} /> : k === i ? <Loader2 size={18} className="animate-spin" /> : <span className="h-[18px] w-[18px] rounded-full border-2 border-current" />} {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCard({ idea }: { idea: { name: string; emoji?: string; tagline?: string; description?: string; products: ShopProduct[]; plan?: ShopIdea['plan'] } }) {
  const p = idea.plan;
  const label = 'text-[11px] font-bold uppercase tracking-wide text-slate-400';
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-[28px] dark:bg-violet-500/15">{idea.emoji || '🌱'}</span>
        <div className="min-w-0">
          <p className="text-[20px] font-extrabold leading-tight text-slate-900 dark:text-white">{idea.name}</p>
          {idea.tagline && <p className="text-[13px] text-slate-500 dark:text-slate-400">{idea.tagline}</p>}
        </div>
      </div>
      {idea.description && <p className="text-[14px] text-slate-700 dark:text-slate-200">{idea.description}</p>}
      <div>
        <p className={label}>Yang dijual</p>
        <ul className="mt-1.5 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100 dark:divide-slate-800 dark:ring-slate-800">
          {idea.products.map((x) => <li key={x.name} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{x.name}</span>{x.unit && <span className="text-[11px] text-slate-500 dark:text-slate-400">{x.unit}</span>}</span><span className="shrink-0 text-[14px] font-extrabold tabular-nums text-slate-900 dark:text-white">{formatIDR(x.price)}</span></li>)}
        </ul>
      </div>
      {p && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[['Modal awal', p.modal != null ? short(p.modal) : '—'], ['Waktu', p.waktu || '—'], ['Per bulan', p.perBulan ? `${short(p.perBulan[0])}–${short(p.perBulan[1]).replace('Rp', '')}` : '—']].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"><p className="text-[11px] text-slate-500 dark:text-slate-400">{k}</p><p className="text-[13px] font-extrabold text-slate-900 dark:text-white">{v}</p></div>
            ))}
          </div>
          {p.alasan.length > 0 && <div><p className={label}>Kenapa cocok buatmu</p><ul className="mt-1.5 space-y-1.5">{p.alasan.map((a) => <li key={a} className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200"><Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />{a}</li>)}</ul></div>}
          {p.langkah.length > 0 && <div><p className={label}>Minggu ini</p><ol className="mt-1.5 space-y-1.5">{p.langkah.map((a, k) => <li key={a} className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{k + 1}</span>{a}</li>)}</ol></div>}
          {(p.pembeli || p.cariDi) && <p className="text-[13px] text-slate-600 dark:text-slate-300">{p.pembeli && <><b>Pembeli:</b> {p.pembeli}<br /></>}{p.cariDi && <><b>Cari pembeli di:</b> {p.cariDi}</>}</p>}
        </>
      )}
    </div>
  );
}

// ── Detail usaha ─────────────────────────────────────────────────────────────
// Kelola usaha (kontak, produk, katalog, website). kasirLink = tombol ke halaman kasir;
// tanpa kasirLink (dibuka DARI kasir) ringkasan penjualan disembunyikan.
export function ShopDetail({ shop, sales, kasirLink, onToast, onDeleted }: { shop: Shop; sales: Transaction[]; kasirLink?: string; onToast: (m: string) => void; onDeleted: () => void }) {
  const [section, setSection] = useState<'' | 'kontak' | 'produk' | 'web'>(shop.contactWa ? '' : 'kontak');
  const [confirmDel, setConfirmDel] = useState(false);
  const now = toLocalDateString().slice(0, 7);
  const month = sales.filter((t) => monthKey(t.date) === now);
  const monthTotal = month.reduce((x, t) => x + amt(t), 0);
  const stage = stageOf(shop, sales.length);
  const text = catalogText(shop, formatIDR);
  const orderUrl = shop.contactWa ? `https://wa.me/${shop.contactWa}?text=${encodeURIComponent(`Halo ${shop.name}, mau pesan`)}` : '';

  const markPromoted = () => { if (!shop.promotedAt) void shopService.update(shop.id, { promoted: true }).catch(() => undefined); };
  const copy = async (s: string, msg: string) => {
    try { await navigator.clipboard.writeText(s); onToast(msg); markPromoted(); } catch { onToast('Tidak bisa menyalin otomatis — salin manual ya.'); }
  };
  const downloadImage = async () => {
    try {
      const blob = await catalogImage(shop);
      const file = new File([blob], `${shop.name.replace(/[^\w-]+/g, '-')}-katalog.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: shop.name });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      markPromoted();
    } catch { /* dibatalkan */ }
  };
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    try { await shopService.remove(shop.id); onDeleted(); } catch (e) { onToast(e instanceof Error ? e.message : 'Gagal menghapus.'); }
  };
  const ready = Boolean(shop.contactWa && shop.products.length);
  const btn = 'flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="space-y-4">
      <StageBar stage={stage} />

      {kasirLink && <section className="rounded-3xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
        <div className="flex items-baseline justify-between gap-2">
          <div><p className="text-[12px] font-semibold text-emerald-800/70 dark:text-emerald-300/70">Bulan ini</p><p className="text-[26px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{formatIDR(Math.round(monthTotal))}</p></div>
          <p className="text-[12px] font-semibold text-emerald-800/70 dark:text-emerald-300/70">{month.length} penjualan · total {sales.length}</p>
        </div>
        <Link href={kasirLink} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-3 text-[14px] font-bold text-white hover:bg-emerald-700"><Store size={16} /> Buka kasir</Link>
      </section>}

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Kontak & pembayaran</p>
          {section !== 'kontak' && <button type="button" onClick={() => setSection('kontak')} className="text-[12px] font-bold text-violet-600 dark:text-violet-300">Ubah</button>}
        </div>
        {section === 'kontak' ? <ContactForm shop={shop} onDone={(m) => { setSection(''); onToast(m); }} onCancel={shop.contactWa ? () => setSection('') : undefined} /> : (
          <div className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">
            <p>WhatsApp {prettyWa(shop.contactWa)}</p>
            {shop.paymentNote && <p className="text-slate-500 dark:text-slate-400">Bayar: {shop.paymentNote}</p>}
            {shop.area && <p className="text-slate-500 dark:text-slate-400">Area: {shop.area}</p>}
          </div>
        )}
      </section>

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Produk & harga</p>
          {section !== 'produk' && <button type="button" onClick={() => setSection('produk')} className="text-[12px] font-bold text-violet-600 dark:text-violet-300">Ubah</button>}
        </div>
        {section === 'produk' ? <ProductsForm shop={shop} onDone={(m) => { setSection(''); onToast(m); }} onCancel={() => setSection('')} /> : (
          <ProductList products={shop.products} />
        )}
      </section>

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Katalog siap sebar</p>
        {!ready ? <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Isi nomor WhatsApp & minimal satu produk dulu.</p> : (
          <>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 font-sans text-[12px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{text}</pre>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy(text, 'Katalog tersalin — tempel di WA, status, atau grup.')} className={btn}><Copy size={14} /> Salin teks</button>
              <button type="button" onClick={downloadImage} className={btn}><Download size={14} /> Gambar katalog</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={markPromoted} className={btn}><MessageCircle size={14} /> Kirim ke WA</a>
              <button type="button" onClick={() => copy(orderUrl, 'Tautan pesan tersalin — taruh di bio IG/TikTok.')} className={btn}><Link2 size={14} /> Tautan pesan</button>
            </div>
          </>
        )}
      </section>

      <WebsiteSection shop={shop} editing={section === 'web'} setEditing={(v) => setSection(v ? 'web' : '')} onToast={onToast} />

      <details className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <summary className="cursor-pointer text-[14px] font-extrabold text-slate-900 dark:text-white">Rencananya</summary>
        <div className="mt-3"><PlanCard idea={shop} /></div>
      </details>

      <button type="button" onClick={remove} className={cn('flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-[13px] font-bold', confirmDel ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')}><Trash2 size={14} /> {confirmDel ? 'Yakin hapus usaha ini?' : 'Hapus usaha'}</button>
    </div>
  );
}

export const fieldCls = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[14px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-violet-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
export const labelCls = 'mb-1 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';

export function FormButtons({ busy, onSave, onCancel, label = 'Simpan' }: { busy: boolean; onSave: () => void; onCancel?: () => void; label?: string }) {
  return (
    <div className="flex gap-2">
      {onCancel && <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><X size={15} /></button>}
      <button type="button" onClick={onSave} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 dark:bg-violet-600">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {label}</button>
    </div>
  );
}

function ContactForm({ shop, onDone, onCancel }: { shop: Shop; onDone: (m: string) => void; onCancel?: () => void }) {
  const [wa, setWa] = useState(prettyWa(shop.contactWa));
  const [pay, setPay] = useState(shop.paymentNote ?? '');
  const [area, setArea] = useState(shop.area ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try { await shopService.update(shop.id, { contactWa: wa.trim(), paymentNote: pay.trim(), area: area.trim() }); onDone('Kontak disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <label className="block"><span className={labelCls}>Nomor WhatsApp (untuk pembeli)</span><input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="0812-3456-7890" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Cara bayar</span><input value={pay} onChange={(e) => setPay(e.target.value)} maxLength={120} placeholder="QRIS / transfer BCA" className={fieldCls} /><span className="mt-1 block px-1 text-[11px] text-slate-400">Jangan pernah tulis PIN, password, atau OTP.</span></label>
      <label className="block"><span className={labelCls}>Area layanan</span><input value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} placeholder="Jakarta Selatan / online" className={fieldCls} /></label>
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

// ── Website: bikin sendiri di Pabrik.AI (brief dari Usahaku) atau tempel situs yang
// sudah ada → Leosiqra mencari halaman game/produk di domain itu (tanpa AI) → user
// memilih halaman → AI membaca harga per halaman (nama halaman = kategori) → user
// memilih Ganti semua / Tambahkan.
type ScanPage = { url: string; title: string };
type ScanReport = { title: string; n: number; error?: string };
const pathOf = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };
function WebsiteSection({ shop, editing, setEditing, onToast }: { shop: Shop; editing: boolean; setEditing: (v: boolean) => void; onToast: (m: string) => void }) {
  const [link, setLink] = useState(shop.linkUrl ?? '');
  const [busy, setBusy] = useState<'' | 'save' | 'read' | 'apply'>('');
  const [error, setError] = useState('');
  const [found, setFound] = useState<{ products: ShopProduct[]; source: string; report: ScanReport[]; cut: number } | null>(null);
  const [scan, setScan] = useState<{ source: string; pages: ScanPage[]; picked: string[] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; title: string; count: number } | null>(null);
  const stopRef = useRef(false);
  const [showBrief, setShowBrief] = useState(false);
  const brief = websiteBrief(shop, formatIDR);
  const btn = 'flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief); onToast('Brief tersalin — tempel di Pabrik.AI.'); } catch { setShowBrief(true); onToast('Tidak bisa menyalin otomatis — salin manual dari kotak brief.'); }
  };
  const saveLink = async () => {
    setBusy('save');
    setError('');
    try { await shopService.update(shop.id, { linkUrl: link.trim() }); setEditing(false); onToast(link.trim() ? 'Tautan website disimpan.' : 'Tautan website dihapus.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); }
    setBusy('');
  };
  const read = async () => {
    const url = (shop.linkUrl && !editing ? shop.linkUrl : link).trim(); // kolom tampil = pakai isinya
    if (!url) { setEditing(true); setError('Tempel dulu tautan website tokomu.'); return; }
    setBusy('read');
    setError('');
    setFound(null);
    setScan(null);
    try {
      const r = await shopService.importPages(shop.id, url);
      if (r.pages.length) setScan({ source: r.source, pages: r.pages, picked: r.pages.map((p) => p.url) });
      else {
        // Tidak ada sub-halaman → baca halaman ini saja.
        const one = await shopService.importPrices(shop.id, url);
        setFound({ products: one.products, source: one.source, report: [{ title: pathOf(one.source), n: one.products.length }], cut: 0 });
      }
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal membaca website.'); }
    setBusy('');
  };
  // Baca halaman terpilih satu per satu (rate limit AI ditunggu & diulang, kuota habis = berhenti).
  const crawl = async () => {
    if (!scan) return;
    const pages = scan.pages.filter((p) => scan.picked.includes(p.url));
    if (!pages.length) return;
    setBusy('read');
    setError('');
    stopRef.current = false;
    const all: ShopProduct[] = [];
    const report: ScanReport[] = [];
    let stopMsg = '';
    for (let k = 0; k < pages.length && !stopRef.current && !stopMsg; k++) {
      const pg = pages[k];
      setProgress({ done: k, total: pages.length, title: pg.title, count: all.length });
      for (let tries = 0; ; tries++) {
        try {
          const r = await shopService.importPrices(shop.id, pg.url, pg.title);
          all.push(...r.products);
          report.push({ title: pg.title, n: r.products.length });
        } catch (e) {
          const m = e instanceof Error && e.message ? e.message : 'Gagal dibaca.';
          if (/Terlalu banyak permintaan/i.test(m) && tries < 3) { await new Promise((ok) => window.setTimeout(ok, 12000)); continue; }
          if (/Batas baca website/i.test(m)) stopMsg = m;
          report.push({ title: pg.title, n: 0, error: m });
        }
        break;
      }
    }
    const seen = new Set<string>();
    const unique = all.filter((p) => { const k = `${p.group ?? ''}|${p.name}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    setProgress(null);
    setScan(null);
    setBusy('');
    if (stopMsg) setError(`${stopMsg} Hasil yang sudah terbaca tetap bisa dipakai.`);
    if (unique.length) setFound({ products: unique.slice(0, PRODUCTS_MAX), source: scan.source, report, cut: Math.max(0, unique.length - PRODUCTS_MAX) });
    else if (!stopMsg) setError('Tidak ada harga yang terbaca dari halaman-halaman itu. Coba pilih halaman lain, atau ketik manual.');
  };
  const apply = async (mode: 'ganti' | 'tambah') => {
    if (!found) return;
    const key = (p: ShopProduct) => `${p.group ?? ''}|${p.name}`.trim().toLowerCase();
    const incoming = new Map(found.products.map((p) => [key(p), p]));
    // Tambahkan: produk lama dengan kategori+nama sama ikut harga website; sisanya ditambah di belakang.
    const products = mode === 'ganti' ? found.products : [...shop.products.map((p) => incoming.get(key(p)) ?? p), ...found.products.filter((p) => !shop.products.some((x) => key(x) === key(p)))].slice(0, PRODUCTS_MAX);
    setBusy('apply');
    try {
      await shopService.update(shop.id, { products, ...(!shop.linkUrl && link.trim() ? { linkUrl: link.trim() } : {}) });
      setFound(null);
      onToast(mode === 'ganti' ? `${products.length} produk dari website dipakai.` : `Daftar produk diperbarui (${products.length}).`);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan produk.'); }
    setBusy('');
  };

  return (
    <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[14px] font-extrabold text-slate-900 dark:text-white"><Globe size={16} className="text-violet-500" /> Website</p>
        {shop.linkUrl && !editing && <button type="button" onClick={() => { setLink(shop.linkUrl ?? ''); setEditing(true); }} className="text-[12px] font-bold text-violet-600 dark:text-violet-300">Ubah</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>}

      {(scan || progress || found) && !shop.linkUrl ? (
        <p className="mt-2 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"><Globe size={14} className="shrink-0 text-violet-500" /><span className="min-w-0 flex-1 truncate">{link.trim().replace(/^https:\/\//, '')}</span></p>
      ) : shop.linkUrl && !editing ? (
        <a href={shop.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /><span className="min-w-0 flex-1 truncate">{shop.linkUrl.replace(/^https:\/\//, '')}</span><ExternalLink size={14} className="shrink-0" />
        </a>
      ) : (
        <>
          {!shop.linkUrl && (
            <div className="mt-2 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 dark:from-violet-500/10 dark:to-fuchsia-500/10">
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">Belum punya website?</p>
              <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">Salin brief tokomu, tempel di Pabrik.AI, dan website jadi dalam beberapa menit. Leosiqra tidak ikut mengelola situsnya.</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button type="button" onClick={copyBrief} className={cn(btn, 'bg-white dark:bg-slate-900')}><Copy size={14} /> Salin brief</button>
                <a href={PABRIK_AI_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700"><Wand2 size={14} /> Buka Pabrik.AI</a>
              </div>
              <button type="button" onClick={() => setShowBrief((v) => !v)} className="mt-2 text-[11px] font-bold text-violet-600 dark:text-violet-300">{showBrief ? 'Sembunyikan brief' : 'Lihat isi brief'}</button>
              {showBrief && <pre className="mt-1.5 max-h-48 select-all overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/80 [overflow-wrap:anywhere] p-2.5 font-sans text-[11px] leading-relaxed text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">{brief}</pre>}
            </div>
          )}
          <label className="mt-3 block"><span className={labelCls}>{shop.linkUrl ? 'Tautan website' : 'Sudah punya? Tempel tautannya'}</span><input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://tokomu.vantis.app" className={fieldCls} /><span className="mt-1 block px-1 text-[11px] text-slate-400">Website, Shopee, Tokopedia, atau Linktree — tautan publik, bukan tautan editor.</span></label>
          <div className="mt-2"><FormButtons busy={busy === 'save'} onSave={saveLink} onCancel={shop.linkUrl ? () => { setEditing(false); setError(''); } : undefined} label="Simpan tautan" /></div>
        </>
      )}

      {progress ? (
        <div className="mt-3 rounded-2xl bg-violet-50 p-3 dark:bg-violet-500/10" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-[13px] font-bold text-violet-800 dark:text-violet-200"><Loader2 size={14} className="shrink-0 animate-spin" /><span className="min-w-0 flex-1 truncate">Membaca {progress.title}</span><span className="shrink-0 tabular-nums">{progress.done + 1}/{progress.total}</span></p>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white dark:bg-slate-900"><span className="block h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((progress.done + 0.5) / progress.total) * 100}%` }} /></span>
          <p className="mt-1.5 flex items-center justify-between text-[11px] text-violet-800/70 dark:text-violet-200/70"><span>{progress.count} produk terkumpul</span><button type="button" onClick={() => { stopRef.current = true; }} className="font-bold text-violet-700 underline dark:text-violet-300">Berhenti & pakai hasil</button></p>
        </div>
      ) : scan ? (
        <div className="mt-3 rounded-2xl ring-1 ring-violet-200 dark:ring-violet-500/30">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">{scan.pages.length} halaman ketemu <span className="font-semibold text-slate-400">· {hostOf(scan.source)}</span></p>
            <button type="button" onClick={() => setScan({ ...scan, picked: scan.picked.length === scan.pages.length ? [] : scan.pages.map((p) => p.url) })} className="shrink-0 text-[12px] font-bold text-violet-600 dark:text-violet-300">{scan.picked.length === scan.pages.length ? 'Kosongkan' : 'Pilih semua'}</button>
          </div>
          <p className="px-3 text-[11px] text-slate-500 dark:text-slate-400">Centang game/produk yang mau diambil harganya.</p>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto px-2">
            {scan.pages.map((pg) => {
              const on = scan.picked.includes(pg.url);
              return (
                <li key={pg.url}>
                  <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2', on ? 'bg-violet-50 dark:bg-violet-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                    <input type="checkbox" checked={on} onChange={() => setScan({ ...scan, picked: on ? scan.picked.filter((u) => u !== pg.url) : [...scan.picked, pg.url] })} className="h-4 w-4 shrink-0 accent-violet-600" />
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold', toneOf(pg.title))}>{initials(pg.title)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">{pg.title}</span><span className="block truncate text-[11px] text-slate-400">{pathOf(pg.url)}</span></span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-[auto_1fr] gap-2 p-3">
            <button type="button" onClick={() => setScan(null)} aria-label="Batal" className="rounded-full bg-slate-100 px-3.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><X size={15} /></button>
            <button type="button" onClick={crawl} disabled={!scan.picked.length} className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-40"><Sparkles size={14} /> Ambil harga {scan.picked.length} halaman</button>
          </div>
          <p className="px-3 pb-3 text-[11px] text-slate-400">1 halaman = 1 dari kuota 60 per hari. Butuh ±5–10 detik per halaman.</p>
        </div>
      ) : found ? (
        <div className="mt-3 rounded-2xl ring-1 ring-violet-200 dark:ring-violet-500/30">
          <p className="px-3 pt-3 text-[13px] font-extrabold text-slate-900 dark:text-white">{found.products.length} produk dari {found.report.filter((r) => r.n > 0).length} halaman</p>
          <p className="px-3 text-[11px] text-slate-500 dark:text-slate-400">Cek dulu harganya sebelum dipakai.{found.cut > 0 && ` ${found.cut} produk tidak muat (maks ${PRODUCTS_MAX}).`}</p>
          {found.report.some((r) => !r.n) && (
            <details className="mx-3 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <summary className="cursor-pointer font-bold">{found.report.filter((r) => !r.n).length} halaman tanpa harga</summary>
              <ul className="mt-1 space-y-0.5">{found.report.filter((r) => !r.n).map((r) => <li key={r.title}><b>{r.title}</b>{r.error ? ` — ${r.error}` : ''}</li>)}</ul>
            </details>
          )}
          <div className="px-3"><ProductList products={found.products} /></div>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 p-3">
            <button type="button" onClick={() => setFound(null)} disabled={Boolean(busy)} aria-label="Batal" className="rounded-full bg-slate-100 px-3.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><X size={15} /></button>
            <button type="button" onClick={() => apply('tambah')} disabled={Boolean(busy)} className={btn}>{busy === 'apply' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambahkan</button>
            <button type="button" onClick={() => apply('ganti')} disabled={Boolean(busy)} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 dark:bg-violet-600"><Check size={14} /> Ganti semua</button>
          </div>
          <p className="px-3 pb-3 text-[11px] text-slate-400">Tambahkan: produk dengan kategori & nama sama ikut harga website, sisanya ditambah. Ganti semua: daftar lama diganti ({shop.products.length} → {found.products.length}).</p>
        </div>
      ) : (
        <button type="button" onClick={read} disabled={Boolean(busy)} className={cn(btn, 'mt-3 w-full')}>
          {busy === 'read' ? <><Loader2 size={14} className="animate-spin" /> Mencari halaman produk…</> : <><Sparkles size={14} /> Ambil daftar harga dari website</>}
        </button>
      )}
    </section>
  );
}

// Daftar produk berkelompok per kategori (header + jumlah); tinggi dibatasi untuk katalog besar.
function ProductList({ products }: { products: ShopProduct[] }) {
  const groups = groupProducts(products);
  const headed = groups.length > 1 || Boolean(groups[0]?.group);
  return (
    <div className="mt-1.5 max-h-72 space-y-2 overflow-y-auto">
      {groups.map(({ group, items }) => (
        <div key={group || 'lain'}>
          {headed && <p className="sticky top-0 flex items-center gap-1.5 bg-white py-1 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span className={cn('flex h-5 w-5 items-center justify-center rounded-md text-[9px] normal-case', toneOf(group || 'Lainnya'))}>{initials(group || 'Lainnya')}</span>{group || 'Lainnya'} <span className="font-semibold normal-case">· {items.length}</span></p>}
          <ul className="space-y-1">{items.map(({ p, i }) => <li key={i} className="flex justify-between gap-3 text-[13px]"><span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{p.name}{p.unit && <span className="text-slate-400"> · {p.unit}</span>}</span><span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{formatIDR(p.price)}</span></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function ProductsForm({ shop, onDone, onCancel }: { shop: Shop; onDone: (m: string) => void; onCancel: () => void }) {
  const [list, setList] = useState(shop.products.map((p) => ({ ...p, price: String(p.price), group: p.group ?? '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i: number, k: 'name' | 'price' | 'unit' | 'group', v: string) => setList((l) => l.map((p, j) => (j === i ? { ...p, [k]: k === 'price' ? v.replace(/\D/g, '').slice(0, 10) : v } : p)));
  const groups = [...new Set(list.map((p) => p.group.trim()).filter(Boolean))];
  const save = async () => {
    const products = list.map((p) => ({ name: p.name.trim(), price: Number(p.price || '0'), unit: p.unit.trim(), ...(p.group.trim() ? { group: p.group.trim() } : {}) })).filter((p) => p.name);
    setBusy(true);
    try { await shopService.update(shop.id, { products }); onDone('Produk disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <datalist id={`grp-${shop.id}`}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {list.map((p, i) => (
          <div key={i} className="space-y-1.5 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50">
            <div className="grid grid-cols-[1fr_96px_28px] gap-1.5 sm:grid-cols-[1fr_110px_28px]">
              <input value={p.name} onChange={(e) => set(i, 'name', e.target.value)} maxLength={80} placeholder="Nama produk" aria-label="Nama produk" className={cn(fieldCls, 'px-3 py-2')} />
              <input value={p.price ? Number(p.price).toLocaleString('id-ID') : ''} onChange={(e) => set(i, 'price', e.target.value)} inputMode="numeric" placeholder="Harga" aria-label="Harga" className={cn(fieldCls, 'px-3 py-2 tabular-nums')} />
              <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Hapus produk" className="flex items-center justify-center text-slate-400 hover:text-rose-500"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pr-[34px]">
              <input value={p.group} onChange={(e) => set(i, 'group', e.target.value)} list={`grp-${shop.id}`} maxLength={40} placeholder="Kategori, mis. Free Fire" aria-label="Kategori" className={cn(fieldCls, 'px-3 py-1.5 text-[12px]')} />
              <input value={p.unit} onChange={(e) => set(i, 'unit', e.target.value)} maxLength={24} placeholder="Satuan (opsional)" aria-label="Satuan" className={cn(fieldCls, 'px-3 py-1.5 text-[12px]')} />
            </div>
          </div>
        ))}
      </div>
      {list.length < PRODUCTS_MAX && <button type="button" onClick={() => setList((l) => [...l, { name: '', price: '', unit: '', group: l[l.length - 1]?.group ?? '' }])} className="flex items-center gap-1 text-[12px] font-bold text-violet-600 dark:text-violet-300"><Plus size={14} /> Tambah produk</button>}
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

// Warna avatar kategori (kelas literal untuk Tailwind).
const GROUP_TONES = ['bg-orange-100 text-orange-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700', 'bg-lime-100 text-lime-700', 'bg-indigo-100 text-indigo-700'];
export const toneOf = (g: string) => GROUP_TONES[[...g].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % GROUP_TONES.length];
export const initials = (g: string) => g.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•';
export const productLabel = (p: ShopProduct) => (p.group ? `${p.group} · ${p.name}` : p.name).slice(0, 80);

// Gambar katalog 1080×1350 (canvas di HP — tanpa server, tanpa halaman publik).
async function catalogImage(s: Shop): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4c1d95'); bg.addColorStop(1, '#0b1220');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const font = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const fit = (text: string, max: number) => { let t = text; while (g.measureText(t).width > max && t.length > 3) t = `${t.slice(0, -2)}…`; return t; };
  g.fillStyle = '#fff'; g.font = font(400, 120); g.fillText(s.emoji || '🌱', 80, 200);
  g.font = font(800, 84); g.fillText(fit(s.name, W - 160), 80, 330);
  if (s.tagline) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = font(500, 40); g.fillText(fit(s.tagline, W - 160), 80, 395); }
  let y = 500;
  for (const p of s.products.slice(0, 7)) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath(); g.roundRect(60, y - 62, W - 120, 104, 28); g.fill();
    g.fillStyle = '#fff'; g.font = font(700, 40); g.fillText(fit(p.name, 620), 100, y);
    if (p.unit) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = font(500, 26); g.fillText(fit(p.unit, 600), 100, y + 30); }
    g.fillStyle = '#6ee7b7'; g.font = font(800, 42); g.textAlign = 'right'; g.fillText(formatIDR(p.price), W - 100, y + 12); g.textAlign = 'left';
    y += 124;
  }
  g.fillStyle = '#22c55e'; g.beginPath(); g.roundRect(60, H - 230, W - 120, 120, 60); g.fill();
  g.fillStyle = '#fff'; g.font = font(800, 44); g.textAlign = 'center';
  g.fillText(`Pesan via WA ${prettyWa(s.contactWa)}`, W / 2, H - 155);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = font(500, 28);
  g.fillText([s.paymentNote && `Bayar: ${s.paymentNote}`, s.area].filter(Boolean).join(' · ').slice(0, 70), W / 2, H - 50);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

