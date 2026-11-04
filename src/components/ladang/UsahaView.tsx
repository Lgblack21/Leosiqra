"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, Link2, Loader2, MessageCircle, Plus, Shuffle, Sparkles, Store, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { shopService, catalogText, prettyWa, type Shop, type ShopIdea, type ShopProduct } from '@/lib/services/shopService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { isCreditAccountType } from '@/lib/creditCard';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// Ladangku › Usaha (Usahaku): AI menyusun 3 rencana usaha dari "aku bisa …" →
// simpan jadi usaha → produk & kontak → katalog siap sebar (teks WA, gambar PNG,
// tautan pesan wa.me) → catat penjualan (pemasukan + saldo, atomik di server).
// Tahap: Rencana → Katalog → Promosi → Jualan. Tidak ada halaman publik.

const STARTERS = ['Masakan rumahan', 'Desain', 'Les privat', 'Preloved', 'Kerajinan', 'Foto', 'Top up game'];
const STAGES = ['Rencana', 'Katalog', 'Promosi', 'Jualan'] as const;
const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);
const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) => (n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n));
export const stageOf = (s: Shop, sales: number) => (sales > 0 ? 3 : s.promotedAt ? 2 : s.contactWa && s.products.length ? 1 : 0);

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
    : current ? <ShopDetail shop={current} sales={salesBy.get(current.id) ?? []} onToast={onToast} onDeleted={() => { setSheet(null); onToast('Usaha dihapus. Penjualan yang tercatat tetap ada di transaksi.'); }} /> : null;
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
          <ul className="grid gap-3 md:grid-cols-2">
            {shops.map((s) => {
              const sales = salesBy.get(s.id) ?? [];
              const month = sales.filter((t) => monthKey(t.date) === now);
              const st = stageOf(s, sales.length);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setSheet({ k: 'shop', id: s.id })} className={cn(card, 'block w-full p-4 text-left transition-transform active:scale-[0.99]')}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-[24px] dark:bg-violet-500/15">{s.emoji || '🌱'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-extrabold text-slate-900 dark:text-white">{s.name}</span>
                        <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{s.tagline || `${s.products.length} produk`}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{short(month.reduce((x, t) => x + amt(t), 0))}</span>
                        <span className="block text-[11px] text-slate-400">{month.length} jualan bulan ini</span>
                      </span>
                    </span>
                    <StageBar stage={st} className="mt-3" />
                  </button>
                </li>
              );
            })}
          </ul>
          {shops.length < 5 && <button type="button" onClick={() => setSheet({ k: 'ideas' })} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-50 py-3 text-[13px] font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300"><Plus size={15} /> Usaha baru</button>}
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
function ShopDetail({ shop, sales, onToast, onDeleted }: { shop: Shop; sales: Transaction[]; onToast: (m: string) => void; onDeleted: () => void }) {
  const [section, setSection] = useState<'' | 'kontak' | 'produk' | 'jual'>(shop.contactWa ? '' : 'kontak');
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

      <section className="rounded-3xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
        <div className="flex items-baseline justify-between gap-2">
          <div><p className="text-[12px] font-semibold text-emerald-800/70 dark:text-emerald-300/70">Bulan ini</p><p className="text-[26px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{formatIDR(Math.round(monthTotal))}</p></div>
          <p className="text-[12px] font-semibold text-emerald-800/70 dark:text-emerald-300/70">{month.length} penjualan · total {sales.length}</p>
        </div>
        {section === 'jual' ? <SaleForm shop={shop} onDone={(m) => { setSection(''); onToast(m); }} onCancel={() => setSection('')} /> : (
          <button type="button" onClick={() => setSection('jual')} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-3 text-[14px] font-bold text-white hover:bg-emerald-700"><Plus size={16} /> Catat penjualan</button>
        )}
      </section>

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
            {shop.linkUrl && <a href={shop.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400"><Link2 size={13} /> {shop.linkUrl.replace(/^https:\/\//, '').slice(0, 50)}</a>}
          </div>
        )}
      </section>

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Produk & harga</p>
          {section !== 'produk' && <button type="button" onClick={() => setSection('produk')} className="text-[12px] font-bold text-violet-600 dark:text-violet-300">Ubah</button>}
        </div>
        {section === 'produk' ? <ProductsForm shop={shop} onDone={(m) => { setSection(''); onToast(m); }} onCancel={() => setSection('')} /> : (
          <ul className="mt-1.5 space-y-1">{shop.products.map((p) => <li key={p.name} className="flex justify-between gap-3 text-[13px]"><span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{p.name}{p.unit && <span className="text-slate-400"> · {p.unit}</span>}</span><span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{formatIDR(p.price)}</span></li>)}</ul>
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

      <details className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <summary className="cursor-pointer text-[14px] font-extrabold text-slate-900 dark:text-white">Rencananya</summary>
        <div className="mt-3"><PlanCard idea={shop} /></div>
      </details>

      <button type="button" onClick={remove} className={cn('flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-[13px] font-bold', confirmDel ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')}><Trash2 size={14} /> {confirmDel ? 'Yakin hapus usaha ini?' : 'Hapus usaha'}</button>
    </div>
  );
}

const fieldCls = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[14px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-violet-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
const labelCls = 'mb-1 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';

function FormButtons({ busy, onSave, onCancel, label = 'Simpan' }: { busy: boolean; onSave: () => void; onCancel?: () => void; label?: string }) {
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
  const [link, setLink] = useState(shop.linkUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try { await shopService.update(shop.id, { contactWa: wa.trim(), paymentNote: pay.trim(), area: area.trim(), linkUrl: link.trim() }); onDone('Kontak disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <label className="block"><span className={labelCls}>Nomor WhatsApp (untuk pembeli)</span><input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="0812-3456-7890" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Cara bayar</span><input value={pay} onChange={(e) => setPay(e.target.value)} maxLength={120} placeholder="QRIS / transfer BCA" className={fieldCls} /><span className="mt-1 block px-1 text-[11px] text-slate-400">Jangan pernah tulis PIN, password, atau OTP.</span></label>
      <label className="block"><span className={labelCls}>Area layanan</span><input value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} placeholder="Jakarta Selatan / online" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Toko online (opsional)</span><input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://shopee.co.id/tokomu" className={fieldCls} /><span className="mt-1 block px-1 text-[11px] text-slate-400">Shopee, Tokopedia, Linktree, atau websitemu — tautan publik, bukan tautan editor.</span></label>
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

function ProductsForm({ shop, onDone, onCancel }: { shop: Shop; onDone: (m: string) => void; onCancel: () => void }) {
  const [list, setList] = useState(shop.products.map((p) => ({ ...p, price: String(p.price) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i: number, k: 'name' | 'price' | 'unit', v: string) => setList((l) => l.map((p, j) => (j === i ? { ...p, [k]: k === 'price' ? v.replace(/\D/g, '').slice(0, 10) : v } : p)));
  const save = async () => {
    const products = list.map((p) => ({ name: p.name.trim(), price: Number(p.price || '0'), unit: p.unit.trim() })).filter((p) => p.name);
    setBusy(true);
    try { await shopService.update(shop.id, { products }); onDone('Produk disimpan.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      {list.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_96px_28px] gap-1.5 sm:grid-cols-[1fr_110px_100px_28px]">
          <input value={p.name} onChange={(e) => set(i, 'name', e.target.value)} maxLength={80} placeholder="Nama produk" aria-label="Nama produk" className={cn(fieldCls, 'px-3 py-2')} />
          <input value={p.price ? Number(p.price).toLocaleString('id-ID') : ''} onChange={(e) => set(i, 'price', e.target.value)} inputMode="numeric" placeholder="Harga" aria-label="Harga" className={cn(fieldCls, 'px-3 py-2 tabular-nums')} />
          <input value={p.unit} onChange={(e) => set(i, 'unit', e.target.value)} maxLength={24} placeholder="per …" aria-label="Satuan" className={cn(fieldCls, 'hidden px-3 py-2 sm:block')} />
          <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Hapus produk" className="flex items-center justify-center text-slate-400 hover:text-rose-500"><X size={16} /></button>
        </div>
      ))}
      {list.length < 20 && <button type="button" onClick={() => setList((l) => [...l, { name: '', price: '', unit: '' }])} className="flex items-center gap-1 text-[12px] font-bold text-violet-600 dark:text-violet-300"><Plus size={14} /> Tambah produk</button>}
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

function SaleForm({ shop, onDone, onCancel }: { shop: Shop; onDone: (m: string) => void; onCancel: () => void }) {
  const [product, setProduct] = useState(shop.products[0]?.name ?? '');
  const [qty, setQty] = useState(1);
  const unitPrice = shop.products.find((p) => p.name === product)?.price ?? 0;
  const [amount, setAmount] = useState(String(unitPrice));
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    accountService.getUserAccounts('').then((list) => {
      const ok = list.filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name }));
      setAccounts(ok);
      if (ok[0]) setAccountId(ok[0].id);
    }).catch(() => setAccounts([]));
  }, []);
  const choose = (name: string, q = qty) => {
    setProduct(name);
    const p = shop.products.find((x) => x.name === name)?.price ?? 0;
    if (p) setAmount(String(p * q));
  };
  const save = async () => {
    const n = Number(amount || '0');
    if (n < 1) { setError('Isi nominalnya.'); return; }
    if (!accountId) { setError('Pilih rekening.'); return; }
    setBusy(true);
    setError('');
    try { await shopService.sale(shop.id, { requestId, amount: n, qty, product, accountId, date }); onDone(`Penjualan ${formatIDR(n)} tercatat & masuk rekening.`); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      {shop.products.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{[...shop.products.map((p) => p.name), ''].map((n) => <button key={n || 'lain'} type="button" onClick={() => (n ? choose(n) : setProduct(''))} className={cn('rounded-full px-3 py-1.5 text-[12px] font-bold', product === n ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>{n || 'Lainnya'}</button>)}</div>
      )}
      <div className="grid grid-cols-[88px_1fr] gap-2">
        <label className="block"><span className={labelCls}>Jumlah</span><input type="number" min={1} max={9999} value={qty} onChange={(e) => { const q = Math.max(1, Math.min(9999, Number(e.target.value) || 1)); setQty(q); if (product) choose(product, q); }} className={cn(fieldCls, 'bg-white dark:bg-slate-900')} /></label>
        <label className="block"><span className={labelCls}>Total diterima</span><span className={cn(fieldCls, 'flex items-center gap-1.5 bg-white dark:bg-slate-900')}><span className="text-slate-400">Rp</span><input value={amount ? Number(amount).toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" aria-label="Total diterima" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" /></span></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={labelCls}>Masuk ke</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accounts === null} className={cn(fieldCls, 'bg-white dark:bg-slate-900')}>{(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="block"><span className={labelCls}>Tanggal</span><input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={cn(fieldCls, 'bg-white dark:bg-slate-900')} /></label>
      </div>
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} label="Catat penjualan" />
      <p className="text-center text-[11px] text-emerald-800/60 dark:text-emerald-300/60">Masuk sebagai pemasukan Usaha & Freelance › Penjualan.</p>
    </div>
  );
}

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

