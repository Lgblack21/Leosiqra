'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  ImagePlus,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wand2,
  X,
  FileBarChart,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  shopService,
  catalogText,
  groupProducts,
  prettyWa,
  websiteBrief,
  PABRIK_AI_URL,
  type Shop,
  type ShopIdea,
  type ShopProduct,
} from '@/lib/services/shopService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { AiMcpCard } from './AiMcpCard';
import { HookSection } from './HookSection';
import { CatalogImage } from './CatalogImage';
import { kindOf } from '@/lib/usaha/jenis';
import { TeamManager } from './TeamManager';
import { usePlan } from '@/lib/usePlan';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Leosiqra tidak meng-host halaman publik; website dibuat user sendiri, lalu AI bisa membaca daftar harganya.

const STARTERS = ['Masakan rumahan', 'Desain', 'Les privat', 'Preloved', 'Kerajinan', 'Foto', 'Top up game'];
const STAGES = ['Rencana', 'Katalog', 'Online', 'Jualan'] as const;
const PRODUCTS_MAX = 120; // = SHOP_PRODUCTS_MAX di Worker
// Toko dibuka di layar Usahaku (Beranda · Kasir · Stok · Laporan); #kasir langsung ke kasir.
export const usahakuHref = (variant: 'web' | 'app', id: string, tab?: 'kasir' | 'laporan' | 'stok') =>
  `${variant === 'app' ? '/app' : '/membership'}/usahaku?id=${encodeURIComponent(id)}${tab ? `#${tab}` : ''}`;
export const kasirHref = (variant: 'web' | 'app', id: string) => usahakuHref(variant, id, 'kasir');
export const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);
export const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
/** Ringkas: Rp45 rb, Rp1,2 jt, −Rp125 rb (minus ikut diringkas supaya tidak terpotong). */
export const short = (n: number): string => {
  if (n < 0) return `−${short(-n)}`;
  if (n >= 999_500) return `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  return n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);
};
export const stageOf = (s: Shop, sales: number) =>
  sales > 0 ? 3 : s.promotedAt || s.linkUrl ? 2 : s.contactWa && s.products.length ? 1 : 0;

export function UsahaView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<{ k: 'ideas' } | { k: 'tim' } | { k: 'shop'; id: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      shopService
        .list()
        .then((r) => {
          if (alive) {
            setShops(r);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) {
            setShops((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat usaha.');
          }
        });
    const loadTx = () =>
      transactionService
        .getUserTransactions('session')
        .then((v) => alive && setTx(v))
        .catch(() => undefined);
    void load();
    void loadTx();
    const u1 = subscribeToCollectionChanges('shops', load);
    const u2 = subscribeToCollectionChanges('transactions', loadTx);
    // AI-mu menyimpan lewat MCP di tab lain → muat ulang saat kembali ke tab ini.
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      alive = false;
      u1();
      u2();
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  // Penjualan per usaha (pemasukan) — dipakai untuk tahap toko & rincian, bukan untuk angka di daftar.
  const salesBy = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of tx) {
      if (t.relatedType !== 'shop' || !t.relatedId || t.type !== 'pemasukan') continue;
      m.set(t.relatedId, [...(m.get(t.relatedId) ?? []), t]);
    }
    return m;
  }, [tx]);

  const app = variant === 'app';
  const current = sheet?.k === 'shop' ? shops?.find((s) => s.id === sheet.id) : undefined;
  const body =
    sheet?.k === 'tim' ? (
      <TeamManager shops={shops ?? []} onToast={onToast} />
    ) : sheet?.k === 'ideas' ? (
      <IdeaFlow
        onSaved={(id, name) => {
          setSheet({ k: 'shop', id });
          onToast(`${name} tersimpan. Lengkapi kontak supaya katalognya siap.`);
        }}
        onToast={onToast}
        onLeave={() => setSheet(null)}
      />
    ) : current ? (
      <ShopDetail
        shop={current}
        sales={salesBy.get(current.id) ?? []}
        kasirLink={kasirHref(variant, current.id)}
        onToast={onToast}
        onLeave={() => setSheet(null)}
        onDeleted={() => {
          setSheet(null);
          onToast('Usaha dihapus. Penjualan yang tercatat tetap ada di transaksi.');
        }}
      />
    ) : null;
  const title = sheet?.k === 'tim' ? 'Tim' : sheet?.k === 'ideas' ? 'Usaha baru' : (current?.name ?? '');

  if (shops === null) return <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}
      {shops.length === 0 ? (
        <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#7c3aed_0%,#4c1d95_35%,#0b1220_80%)] p-5 text-white md:p-6">
          <Store
            aria-hidden
            size={150}
            strokeWidth={1}
            className="pointer-events-none absolute -bottom-8 -right-6 text-violet-300/10"
          />
          <p className="fs-13 font-semibold text-white/60">Usahaku</p>
          <p className="mt-1 fsh-24 font-extrabold leading-tight md:fsh-28">Punya keahlian? Jadikan usaha sampingan.</p>
          <p className="mt-2 max-w-md fs-13 text-white/70">
            Ceritakan apa yang bisa kamu kerjakan — AI-mu sendiri (Claude/ChatGPT) menyusun rencana lengkap: produk &
            harga, modal, langkah minggu ini, dan di mana cari pembeli.
          </p>
          <button
            type="button"
            onClick={() => setSheet({ k: 'ideas' })}
            className="relative mt-4 flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 fs-13 font-bold text-slate-900 hover:bg-white/90"
          >
            <Sparkles size={15} /> Cari ide usaha
          </button>
        </section>
      ) : (
        <>
          {/* Daftar toko: sengaja tanpa angka uang — angka ada di dalam tiap toko (Ringkasan & Laporan). */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="fs-12 font-bold uppercase tracking-[0.14em] text-slate-400">Toko kamu</p>
              <p className="fs-13 text-slate-500 dark:text-slate-400">
                {shops.length} dari 5 toko · pilih toko untuk membuka kasir, biaya, stok, dan laporannya
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setSheet({ k: 'tim' })}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 fs-13 font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
              >
                <Users size={15} /> Tim
              </button>
              {shops.length < 5 && (
                <button
                  type="button"
                  onClick={() => setSheet({ k: 'ideas' })}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 fs-13 font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <Plus size={15} /> Buat toko
                </button>
              )}
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shops.map((s) => {
              const st = stageOf(s, (salesBy.get(s.id)?.length ?? 0) + (s.book.month ? 1 : 0));
              const kind = kindOf(s.kind);
              const nextStep = !s.contactWa
                ? 'Isi nomor WhatsApp'
                : !s.products.length
                  ? 'Isi katalog produk'
                  : st < 2
                    ? 'Tempel website atau sebar katalog'
                    : 'Catat penjualan pertama';
              return (
                <li
                  key={s.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-none dark:hover:ring-slate-700"
                >
                  <Link href={usahakuHref(variant, s.id)} className="flex flex-1 flex-col p-4 md:p-5">
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 fsh-26 ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                        <CatalogImage
                          src={s.style.logoUrl}
                          alt={`Logo ${s.name}`}
                          fallback={s.emoji || kind?.emoji || '🏪'}
                          className="h-full w-full bg-white p-1"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate fs-17 font-extrabold tracking-tight text-slate-900 dark:text-white">{s.name}</span>
                        <span className="block truncate fs-12 text-slate-500 dark:text-slate-400">
                          {[kind?.label, s.tagline].filter(Boolean).join(' · ') || 'Usaha'}
                        </span>
                      </span>
                      <ArrowRight
                        size={18}
                        className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-200"
                      />
                    </div>
                    <span className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 fs-11 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {s.products.length} produk
                      </span>
                      {s.bookOn ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 fs-11 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Buku usaha aktif
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 fs-11 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Buku usaha belum aktif
                        </span>
                      )}
                      {s.lowStock > 0 && (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 fs-11 font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                          {s.lowStock} stok menipis
                        </span>
                      )}
                    </span>
                  </Link>
                  {st < 3 && (
                    <button
                      type="button"
                      onClick={() => setSheet({ k: 'shop', id: s.id })}
                      className="flex w-full flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
                    >
                      <StageBar stage={st} className="w-full sm:flex-1" />
                      <span className="shrink-0 fs-11 font-bold text-violet-600 dark:text-violet-300">{nextStep} →</span>
                    </button>
                  )}
                </li>
              );
            })}
            {shops.length < 5 && (
              <li>
                <button
                  type="button"
                  onClick={() => setSheet({ k: 'ideas' })}
                  className="flex h-full min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-4 fs-13 font-bold text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                    <Plus size={20} />
                  </span>
                  Buat toko baru
                </button>
              </li>
            )}
          </ul>
        </>
      )}
      {app ? (
        <BottomSheet isOpen={Boolean(sheet)} onClose={() => setSheet(null)} title={title}>
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{body}</div>
        </BottomSheet>
      ) : (
        <Modal isOpen={Boolean(sheet)} onClose={() => setSheet(null)} title={title} maxWidth="max-w-xl">
          {body}
        </Modal>
      )}
    </div>
  );
}

function StageBar({ stage, className }: { stage: number; className?: string }) {
  return (
    <span className={cn('grid grid-cols-4 gap-1.5', className)} aria-label={`Tahap: ${STAGES[stage]}`}>
      {STAGES.map((s, i) => (
        <span key={s}>
          <span
            className={cn('block h-1.5 rounded-full', i <= stage ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')}
          />
          <span
            className={cn(
              'mt-1 block truncate fs-10 font-semibold',
              i <= stage ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400',
            )}
          >
            {s}
          </span>
        </span>
      ))}
    </span>
  );
}

// ── Ide usaha: disusun AI MILIK PENGGUNA (MCP create_shop), bukan AI Leosiqra ──
function IdeaFlow({
  onSaved,
  onToast,
  onLeave,
}: {
  onSaved: (id: string, name: string) => void;
  onToast: (m: string) => void;
  onLeave: () => void;
}) {
  const [text, setText] = useState('');
  const [direct, setDirect] = useState(false);
  if (direct) return <DirectShopForm onBack={() => setDirect(false)} onSaved={onSaved} />;
  const story = text.trim();
  const prompt = `Pakai Leosiqra (MCP). Aku mau mulai usaha sampingan. Ceritaku: "${story || '[tulis keahlian / barang yang bisa kamu jual]'}".
Susun 3 rencana usaha kecil yang realistis & legal di Indonesia, SEMUA di bidang yang aku sebut: nama usaha, produk + harga Rupiah, modal awal, perkiraan pendapatan per bulan, 3 langkah minggu ini, siapa pembelinya & di mana mencarinya. Setelah aku memilih satu, simpan dengan create_shop (sertakan products dan plan).`;
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 fsh-24 dark:bg-violet-500/15">
          💡
        </span>
        <div>
          <p className="fs-16 font-extrabold text-slate-900 dark:text-white">
            Apa yang bisa kamu kerjakan, buat, atau jual?
          </p>
          <p className="fs-12 text-slate-500 dark:text-slate-400">
            Pakai kata-katamu sendiri: &ldquo;aku jago bikin kue kering&rdquo;, &ldquo;bisa desain di Canva&rdquo;.
          </p>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={300}
        autoFocus
        placeholder="Aku bisa…"
        className="w-full resize-none rounded-2xl bg-slate-100 px-4 py-3 fs-15 font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-violet-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
      />
      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() =>
              setText((t) => (t.trim() ? `${t.trim()}, ${s.toLowerCase()}` : `Aku bisa ${s.toLowerCase()}`))
            }
            className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {s}
          </button>
        ))}
      </div>
      <AiMcpCard
        title="Minta ide ke AI-mu"
        desc="AI-mu menyusun 3 rencana usaha dari ceritamu, lalu menyimpannya ke Usahaku setelah kamu pilih."
        prompt={prompt}
        onLeave={onLeave}
        onToast={onToast}
      />
      <button
        type="button"
        onClick={() => setDirect(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-100 hover:bg-slate-100 dark:bg-slate-800/60 dark:ring-slate-800"
      >
        <span>
          <span className="block fs-14 font-extrabold text-slate-900 dark:text-white">Sudah punya usaha?</span>
          <span className="block fs-12 text-slate-500 dark:text-slate-400">Daftarkan langsung — tanpa AI.</span>
        </span>
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
    if (!name.trim()) {
      setError('Isi nama usahamu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(
        await shopService.create({ name: name.trim(), emoji, tagline: tagline.trim(), products: [] }),
        name.trim(),
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 fs-13 font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"
      >
        <ArrowLeft size={15} /> Minta ide ke AI-mu
      </button>
      <p className="fs-16 font-extrabold text-slate-900 dark:text-white">Daftarkan usahamu</p>
      {error && (
        <p role="alert" className="fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Nama usaha</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          maxLength={40}
          autoFocus
          placeholder="mis. Toko Kue Leosiqra"
          className={fieldCls}
        />
      </label>
      <div>
        <span className={labelCls}>Ikon</span>
        <div className="flex flex-wrap gap-1.5">
          {SHOP_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl fsh-20',
                emoji === e ? 'bg-violet-600 ring-2 ring-violet-300' : 'bg-slate-100 dark:bg-slate-800',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className={labelCls}>Jualan apa? (opsional)</span>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={80}
          placeholder="mis. Kue kering & bolu rumahan"
          className={fieldCls}
        />
      </label>
      <FormButtons busy={busy} onSave={save} label="Simpan usaha" />
      <p className="text-center fs-11 text-slate-400">
        Setelah disimpan: isi WhatsApp & katalog — atau minta AI-mu mengambil harga dari websitemu.
      </p>
    </div>
  );
}

function PlanCard({
  idea,
}: {
  idea: {
    name: string;
    emoji?: string;
    tagline?: string;
    description?: string;
    products: ShopProduct[];
    plan?: ShopIdea['plan'];
  };
}) {
  const p = idea.plan;
  const label = 'fs-11 font-bold uppercase tracking-wide text-slate-400';
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 fsh-28 dark:bg-violet-500/15">
          {idea.emoji || '🌱'}
        </span>
        <div className="min-w-0">
          <p className="fsh-20 font-extrabold leading-tight text-slate-900 dark:text-white">{idea.name}</p>
          {idea.tagline && <p className="fs-13 text-slate-500 dark:text-slate-400">{idea.tagline}</p>}
        </div>
      </div>
      {idea.description && <p className="fs-14 text-slate-700 dark:text-slate-200">{idea.description}</p>}
      <div>
        <p className={label}>Yang dijual</p>
        <ul className="mt-1.5 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100 dark:divide-slate-800 dark:ring-slate-800">
          {idea.products.map((x) => (
            <li key={x.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">{x.name}</span>
                {x.unit && <span className="fs-11 text-slate-500 dark:text-slate-400">{x.unit}</span>}
              </span>
              <span className="shrink-0 fs-14 font-extrabold tabular-nums text-slate-900 dark:text-white">
                {formatIDR(x.price)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {p && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Modal awal', p.modal != null ? short(p.modal) : '—'],
              ['Waktu', p.waktu || '—'],
              ['Per bulan', p.perBulan ? `${short(p.perBulan[0])}–${short(p.perBulan[1]).replace('Rp', '')}` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                <p className="fs-11 text-slate-500 dark:text-slate-400">{k}</p>
                <p className="fs-13 font-extrabold text-slate-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>
          {p.alasan.length > 0 && (
            <div>
              <p className={label}>Kenapa cocok buatmu</p>
              <ul className="mt-1.5 space-y-1.5">
                {p.alasan.map((a) => (
                  <li key={a} className="flex gap-2 fs-13 text-slate-700 dark:text-slate-200">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.langkah.length > 0 && (
            <div>
              <p className={label}>Minggu ini</p>
              <ol className="mt-1.5 space-y-1.5">
                {p.langkah.map((a, k) => (
                  <li key={a} className="flex gap-2 fs-13 text-slate-700 dark:text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 fs-11 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {k + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(p.pembeli || p.cariDi) && (
            <p className="fs-13 text-slate-600 dark:text-slate-300">
              {p.pembeli && (
                <>
                  <b>Pembeli:</b> {p.pembeli}
                  <br />
                </>
              )}
              {p.cariDi && (
                <>
                  <b>Cari pembeli di:</b> {p.cariDi}
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Detail usaha ─────────────────────────────────────────────────────────────
// Kelola usaha (kontak, produk, katalog, website). kasirLink = tombol ke halaman kasir;
// tanpa kasirLink (dibuka DARI kasir) ringkasan penjualan disembunyikan.
export function ShopDetail({
  shop,
  sales,
  kasirLink,
  onToast,
  onDeleted,
  onLeave,
}: {
  shop: Shop;
  sales: Transaction[];
  kasirLink?: string;
  onToast: (m: string) => void;
  onDeleted: () => void;
  onLeave?: () => void;
}) {
  const [section, setSection] = useState<'' | 'kontak' | 'produk' | 'web'>(shop.contactWa ? '' : 'kontak');
  const [confirmDel, setConfirmDel] = useState(false);
  const now = toLocalDateString().slice(0, 7);
  const month = sales.filter((t) => monthKey(t.date) === now);
  const monthTotal = month.reduce((x, t) => x + amt(t), 0);
  const stage = stageOf(shop, sales.length);
  const text = catalogText(shop, formatIDR);
  const orderUrl = shop.contactWa
    ? `https://wa.me/${shop.contactWa}?text=${encodeURIComponent(`Halo ${shop.name}, mau pesan`)}`
    : '';

  const markPromoted = () => {
    if (!shop.promotedAt) void shopService.update(shop.id, { promoted: true }).catch(() => undefined);
  };
  const copy = async (s: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(s);
      onToast(msg);
      markPromoted();
    } catch {
      onToast('Tidak bisa menyalin otomatis — salin manual ya.');
    }
  };
  const downloadImage = async () => {
    try {
      const blob = await catalogImage(shop);
      const file = new File([blob], `${shop.name.replace(/[^\w-]+/g, '-')}-katalog.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: shop.name });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      markPromoted();
    } catch {
      /* dibatalkan */
    }
  };
  const remove = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    try {
      await shopService.remove(shop.id);
      onDeleted();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  };
  const ready = Boolean(shop.contactWa && shop.products.length);
  const btn =
    'flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="space-y-4">
      <StageBar stage={stage} />

      {kasirLink && (
        <section className="rounded-3xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="fs-12 font-semibold text-emerald-800/70 dark:text-emerald-300/70">Bulan ini</p>
              <p className="fsh-26 font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatIDR(Math.round(monthTotal))}
              </p>
            </div>
            <p className="fs-12 font-semibold text-emerald-800/70 dark:text-emerald-300/70">
              {month.length} penjualan · total {sales.length}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={kasirLink}
              className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-3 fs-14 font-bold text-white hover:bg-emerald-700"
            >
              <Store size={16} /> Buka kasir
            </Link>
            <Link
              href={kasirLink.replace(/#kasir$/, '#laporan')}
              className="flex items-center justify-center gap-1.5 rounded-full bg-white py-3 fs-14 font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/30"
            >
              <FileBarChart size={16} /> Laporan & unduh
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Kontak & pembayaran</p>
          {section !== 'kontak' && (
            <button
              type="button"
              onClick={() => setSection('kontak')}
              className="fs-12 font-bold text-violet-600 dark:text-violet-300"
            >
              Ubah
            </button>
          )}
        </div>
        {section === 'kontak' ? (
          <ContactForm
            shop={shop}
            onDone={(m) => {
              setSection('');
              onToast(m);
            }}
            onCancel={shop.contactWa ? () => setSection('') : undefined}
          />
        ) : (
          <div className="mt-1 fs-13 text-slate-600 dark:text-slate-300">
            <p>WhatsApp {prettyWa(shop.contactWa)}</p>
            {shop.paymentNote && <p className="text-slate-500 dark:text-slate-400">Bayar: {shop.paymentNote}</p>}
            {shop.area && <p className="text-slate-500 dark:text-slate-400">Area: {shop.area}</p>}
          </div>
        )}
      </section>

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Produk & harga</p>
          {section !== 'produk' && (
            <button
              type="button"
              onClick={() => setSection('produk')}
              className="fs-12 font-bold text-violet-600 dark:text-violet-300"
            >
              Ubah
            </button>
          )}
        </div>
        {section === 'produk' ? (
          <ProductsForm
            shop={shop}
            onDone={(m) => {
              setSection('');
              onToast(m);
            }}
            onCancel={() => setSection('')}
          />
        ) : (
          <ProductList products={shop.products} />
        )}
      </section>

      <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Katalog siap sebar</p>
        {!ready ? (
          <p className="mt-1 fs-12 text-slate-500 dark:text-slate-400">
            Isi nomor WhatsApp & minimal satu produk dulu.
          </p>
        ) : (
          <>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 font-sans fs-12 leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              {text}
            </pre>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copy(text, 'Katalog tersalin — tempel di WA, status, atau grup.')}
                className={btn}
              >
                <Copy size={14} /> Salin teks
              </button>
              <button type="button" onClick={downloadImage} className={btn}>
                <Download size={14} /> Gambar katalog
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={markPromoted}
                className={btn}
              >
                <MessageCircle size={14} /> Kirim ke WA
              </a>
              <button
                type="button"
                onClick={() => copy(orderUrl, 'Tautan pesan tersalin — taruh di bio IG/TikTok.')}
                className={btn}
              >
                <Link2 size={14} /> Tautan pesan
              </button>
            </div>
          </>
        )}
      </section>

      <WebsiteSection
        shop={shop}
        editing={section === 'web'}
        setEditing={(v) => setSection(v ? 'web' : '')}
        onToast={onToast}
        onLeave={onLeave}
      />
      <HookSection shop={shop} onToast={onToast} onLeave={onLeave} />

      <details className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
        <summary className="cursor-pointer fs-14 font-extrabold text-slate-900 dark:text-white">Rencananya</summary>
        <div className="mt-3">
          <PlanCard idea={shop} />
        </div>
      </details>

      <button
        type="button"
        onClick={remove}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-full py-3 fs-13 font-bold',
          confirmDel ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
        )}
      >
        <Trash2 size={14} /> {confirmDel ? 'Yakin hapus usaha ini?' : 'Hapus usaha'}
      </button>
    </div>
  );
}

export const fieldCls =
  'w-full rounded-2xl bg-slate-100 px-4 py-3 fs-14 font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-violet-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
export const labelCls = 'mb-1 block fs-12 font-semibold text-slate-500 dark:text-slate-400';

export function FormButtons({
  busy,
  onSave,
  onCancel,
  label = 'Simpan',
}: {
  busy: boolean;
  onSave: () => void;
  onCancel?: () => void;
  label?: string;
}) {
  return (
    <div className="flex gap-2">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-slate-100 px-4 py-2.5 fs-13 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <X size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 fs-13 font-bold text-white disabled:opacity-40 dark:bg-violet-600"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {label}
      </button>
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
    try {
      await shopService.update(shop.id, { contactWa: wa.trim(), paymentNote: pay.trim(), area: area.trim() });
      onDone('Kontak disimpan.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-3">
      {error && (
        <p role="alert" className="fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Nomor WhatsApp (untuk pembeli)</span>
        <input
          value={wa}
          onChange={(e) => setWa(e.target.value)}
          inputMode="tel"
          placeholder="0812-3456-7890"
          className={fieldCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Cara bayar</span>
        <input
          value={pay}
          onChange={(e) => setPay(e.target.value)}
          maxLength={120}
          placeholder="QRIS / transfer BCA"
          className={fieldCls}
        />
        <span className="mt-1 block px-1 fs-11 text-slate-400">Jangan pernah tulis PIN, password, atau OTP.</span>
      </label>
      <label className="block">
        <span className={labelCls}>Area layanan</span>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          maxLength={60}
          placeholder="Jakarta Selatan / online"
          className={fieldCls}
        />
      </label>
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

// ── Website: bikin sendiri di Pabrik.AI (brief dari Usahaku) atau tempel situs yang
// sudah ada → AI MILIK PENGGUNA membaca semua halaman produk/game & menyimpan
// katalog lewat MCP set_shop_products (tidak memakai AI Leosiqra).
function WebsiteSection({
  shop,
  editing,
  setEditing,
  onToast,
  onLeave,
}: {
  shop: Shop;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onToast: (m: string) => void;
  onLeave?: () => void;
}) {
  const [link, setLink] = useState(shop.linkUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showBrief, setShowBrief] = useState(false);
  const brief = websiteBrief(shop, formatIDR);
  const btn =
    'flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
  const url = (shop.linkUrl && !editing ? shop.linkUrl : link).trim();

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      onToast('Brief tersalin — tempel di Pabrik.AI.');
    } catch {
      setShowBrief(true);
      onToast('Tidak bisa menyalin otomatis — salin manual dari kotak brief.');
    }
  };
  const saveLink = async () => {
    setBusy(true);
    setError('');
    try {
      await shopService.update(shop.id, { linkUrl: link.trim() });
      setEditing(false);
      onToast(link.trim() ? 'Tautan website disimpan.' : 'Tautan website dihapus.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };
  const prompt = `Pakai Leosiqra (MCP) dan alat baca web-mu. Buka ${url || '[tautan website tokoku]'} beserta SEMUA halaman produk & kategori di domain itu. Kumpulkan setiap produk/varian dan harganya (Rupiah), kelompokkan per kategori yang dipakai website itu. Tunjukkan ringkasannya ke aku dulu. ${
    shop.products.length
      ? `Katalogku sudah berisi ${shop.products.length} produk: panggil sync_shop_catalog untuk shop_id ${shop.id} dengan seluruh daftar itu (apply: false) untuk pratinjau tambah/hapus/harga, tunjukkan ke aku, lalu apply: true setelah aku setuju.`
      : `Setelah aku setuju, simpan dengan set_shop_products untuk shop_id ${shop.id} (mode replace, group = nama kategori, maks 120 produk).`
  }`;

  return (
    <section className="rounded-3xl ring-1 ring-slate-100 p-4 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 fs-14 font-extrabold text-slate-900 dark:text-white">
          <Globe size={16} className="text-violet-500" /> Website
        </p>
        {shop.linkUrl && !editing && (
          <button
            type="button"
            onClick={() => {
              setLink(shop.linkUrl ?? '');
              setEditing(true);
            }}
            className="fs-12 font-bold text-violet-600 dark:text-violet-300"
          >
            Ubah
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}

      {shop.linkUrl && !editing ? (
        <a
          href={shop.linkUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-2 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 fs-13 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="min-w-0 flex-1 truncate">{shop.linkUrl.replace(/^https:\/\//, '')}</span>
          <ExternalLink size={14} className="shrink-0" />
        </a>
      ) : (
        <>
          {!shop.linkUrl && (
            <div className="mt-2 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 dark:from-violet-500/10 dark:to-fuchsia-500/10">
              <p className="fs-13 font-bold text-slate-900 dark:text-white">Belum punya website?</p>
              <p className="mt-0.5 fs-12 text-slate-600 dark:text-slate-300">
                Salin brief tokomu, tempel di Pabrik.AI, dan website jadi dalam beberapa menit. Leosiqra tidak ikut
                mengelola situsnya.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button type="button" onClick={copyBrief} className={cn(btn, 'bg-white dark:bg-slate-900')}>
                  <Copy size={14} /> Salin brief
                </button>
                <a
                  href={PABRIK_AI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 fs-13 font-bold text-white hover:bg-violet-700"
                >
                  <Wand2 size={14} /> Buka Pabrik.AI
                </a>
              </div>
              <button
                type="button"
                onClick={() => setShowBrief((v) => !v)}
                className="mt-2 fs-11 font-bold text-violet-600 dark:text-violet-300"
              >
                {showBrief ? 'Sembunyikan brief' : 'Lihat isi brief'}
              </button>
              {showBrief && (
                <pre className="mt-1.5 max-h-48 select-all overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/80 [overflow-wrap:anywhere] p-2.5 font-sans fs-11 leading-relaxed text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                  {brief}
                </pre>
              )}
            </div>
          )}
          <label className="mt-3 block">
            <span className={labelCls}>{shop.linkUrl ? 'Tautan website' : 'Sudah punya? Tempel tautannya'}</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              inputMode="url"
              placeholder="https://tokomu.vantis.app"
              className={fieldCls}
            />
            <span className="mt-1 block px-1 fs-11 text-slate-400">
              Website, Shopee, Tokopedia, atau Linktree — tautan publik, bukan tautan editor.
            </span>
          </label>
          <div className="mt-2">
            <FormButtons
              busy={busy}
              onSave={saveLink}
              onCancel={
                shop.linkUrl
                  ? () => {
                      setEditing(false);
                      setError('');
                    }
                  : undefined
              }
              label="Simpan tautan"
            />
          </div>
        </>
      )}

      {url && (
        <AiMcpCard
          className="mt-3"
          title={shop.products.length ? 'Baca ulang website pakai AI-mu' : 'Ambil daftar harga pakai AI-mu'}
          desc={
            shop.products.length
              ? 'AI-mu membaca ulang website ini, menunjukkan produk baru/terhapus & harga berubah, lalu menyamakan katalog setelah kamu setuju.'
              : 'AI-mu membuka website ini & semua halaman produknya, lalu mengisi katalog kasir per kategori.'
          }
          prompt={prompt}
          onLeave={onLeave}
          onToast={onToast}
        />
      )}
    </section>
  );
}

function ProductList({ products }: { products: ShopProduct[] }) {
  const groups = groupProducts(products);
  const headed = groups.length > 1 || Boolean(groups[0]?.group);
  return (
    <div className="mt-1.5 max-h-72 space-y-2 overflow-y-auto">
      {groups.map(({ group, items }) => (
        <div key={group || 'lain'}>
          {headed && (
            <p className="sticky top-0 flex items-center gap-1.5 bg-white py-1 dark:bg-slate-900 fs-11 font-bold uppercase tracking-wide text-slate-400">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md fs-9 normal-case',
                  toneOf(group || 'Lainnya'),
                )}
              >
                {initials(group || 'Lainnya')}
              </span>
              {group || 'Lainnya'} <span className="font-semibold normal-case">· {items.length}</span>
            </p>
          )}
          <ul className="space-y-1">
            {items.map(({ p, i }) => (
              <li key={i} className="flex justify-between gap-3 fs-13">
                <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                  {p.name}
                  {p.unit && <span className="text-slate-400"> · {p.unit}</span>}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatIDR(p.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProductsForm({ shop, onDone, onCancel }: { shop: Shop; onDone: (m: string) => void; onCancel: () => void }) {
  const [list, setList] = useState(
    shop.products.map((p) => ({
      ...p,
      price: String(p.price),
      group: p.group ?? '',
      resellerPrice: p.resellerPrice ? String(p.resellerPrice) : '',
      cost: '', // harga modal manual (PRO) — dimuat dari /costs, disimpan terpisah dari katalog
      costKey: `${p.group ?? ''}|${p.name}`,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPro = usePlan();
  // Harga modal: manual (bisa diubah) + perkiraan dari resep (placeholder). null = belum dimuat/tidak aktif.
  const [costs, setCosts] = useState<{ ready: boolean; recipe: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!isPro) return;
    let alive = true;
    shopService
      .costs(shop.id)
      .then((c) => {
        if (!alive) return;
        setCosts({ ready: c.ready, recipe: c.recipe });
        setList((l) => l.map((p) => (c.manual[p.costKey] !== undefined ? { ...p, cost: String(Math.round(c.manual[p.costKey])) } : p)));
      })
      .catch(() => alive && setCosts(null));
    return () => {
      alive = false;
    };
  }, [isPro, shop.id]);
  const set = (i: number, k: 'name' | 'price' | 'unit' | 'group' | 'resellerPrice' | 'cost', v: string) =>
    setList((l) =>
      l.map((p, j) =>
        j === i
          ? { ...p, [k]: k === 'price' || k === 'resellerPrice' || k === 'cost' ? v.replace(/\D/g, '').slice(0, 10) : v }
          : p,
      ),
    );
  const groups = [...new Set(list.map((p) => p.group.trim()).filter(Boolean))];
  // Foto produk: diunggah ke Cloudinary (sama seperti logo toko), yang disimpan cuma tautannya.
  const [photoAt, setPhotoAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const pickPhoto = (i: number) => {
    setPhotoAt(i);
    photoInput.current?.click();
  };
  const uploadPhoto = async (file: File) => {
    const i = photoAt;
    if (i === null) return;
    setUploading(i);
    setError('');
    try {
      const url = await uploadToCloudinary(file);
      setList((l) => l.map((p, j) => (j === i ? { ...p, image: url } : p)));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Foto gagal diunggah.');
    } finally {
      setUploading(null);
    }
  };
  const save = async () => {
    const products = list
      .map((p) => ({
        name: p.name.trim(),
        price: Number(p.price || '0'),
        unit: p.unit.trim(),
        ...(p.group.trim() ? { group: p.group.trim() } : {}),
        ...(Number(p.resellerPrice) > 0 ? { resellerPrice: Number(p.resellerPrice) } : {}),
        ...(p.image ? { image: p.image } : {}),
      }))
      .filter((p) => p.name);
    setBusy(true);
    try {
      await shopService.update(shop.id, { products });
      // Harga modal (PRO) disimpan terpisah — tidak ikut katalog yang dilihat tim. Kosong = hapus.
      if (isPro && costs?.ready) {
        const entries = list
          .filter((p) => p.name.trim())
          .map((p) => ({ key: `${p.group.trim()}|${p.name.trim()}`, cost: p.cost === '' ? null : Number(p.cost) }));
        try {
          if (entries.length) await shopService.saveCosts(shop.id, entries);
        } catch (e) {
          onDone(`Produk disimpan, tapi harga modal gagal: ${e instanceof Error ? e.message : 'coba lagi'}.`);
          return;
        }
      }
      onDone('Produk disimpan.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-2">
      {error && (
        <p role="alert" className="fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <input
        ref={photoInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void uploadPhoto(f);
        }}
      />
      <p className="fs-11 text-slate-500 dark:text-slate-400">Ketuk kotak foto untuk menambah gambar produk — tampil di kartu kasir.</p>
      <datalist id={`grp-${shop.id}`}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {list.map((p, i) => (
          <div key={i} className="space-y-1.5 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50">
            <div className="grid grid-cols-[40px_1fr_96px_28px] gap-1.5 sm:grid-cols-[40px_1fr_110px_28px]">
              <span className="relative">
                <button
                  type="button"
                  onClick={() => pickPhoto(i)}
                  disabled={uploading !== null}
                  aria-label={p.image ? `Ganti foto ${p.name || 'produk'}` : `Tambah foto ${p.name || 'produk'}`}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-400 border border-dashed border-slate-300 hover:border-violet-400 hover:text-violet-600 dark:border-slate-600 dark:bg-slate-900"
                >
                  {uploading === i ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : p.image ? (
                    <CatalogImage src={p.image} alt="" fallback={<ImagePlus size={16} />} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                </button>
                {p.image && uploading !== i && (
                  <button
                    type="button"
                    onClick={() => setList((l) => l.map((x, j) => (j === i ? { ...x, image: undefined } : x)))}
                    aria-label="Hapus foto"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
              <input
                value={p.name}
                onChange={(e) => set(i, 'name', e.target.value)}
                maxLength={80}
                placeholder="Nama produk"
                aria-label="Nama produk"
                className={cn(fieldCls, 'px-3 py-2')}
              />
              <input
                value={p.price ? Number(p.price).toLocaleString('id-ID') : ''}
                onChange={(e) => set(i, 'price', e.target.value)}
                inputMode="numeric"
                placeholder="Harga"
                aria-label="Harga"
                className={cn(fieldCls, 'px-3 py-2 tabular-nums')}
              />
              <button
                type="button"
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}
                aria-label="Hapus produk"
                className="flex items-center justify-center text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pr-[34px] sm:grid-cols-4">
              <input
                value={p.group}
                onChange={(e) => set(i, 'group', e.target.value)}
                list={`grp-${shop.id}`}
                maxLength={40}
                placeholder="Kategori, mis. Minuman"
                aria-label="Kategori"
                className={cn(fieldCls, 'px-3 py-1.5 fs-12')}
              />
              <input
                value={p.unit}
                onChange={(e) => set(i, 'unit', e.target.value)}
                maxLength={24}
                placeholder="Satuan (opsional)"
                aria-label="Satuan"
                className={cn(fieldCls, 'px-3 py-1.5 fs-12')}
              />
              <input
                value={p.resellerPrice ? Number(p.resellerPrice).toLocaleString('id-ID') : ''}
                onChange={(e) => set(i, 'resellerPrice', e.target.value)}
                inputMode="numeric"
                placeholder="Harga reseller"
                aria-label="Harga reseller (opsional)"
                className={cn(fieldCls, 'px-3 py-1.5 fs-12 tabular-nums')}
              />
              {isPro && costs?.ready ? (
                <input
                  value={p.cost ? Number(p.cost).toLocaleString('id-ID') : ''}
                  onChange={(e) => set(i, 'cost', e.target.value)}
                  inputMode="numeric"
                  placeholder={
                    costs.recipe[`${p.group.trim()}|${p.name.trim()}`] !== undefined
                      ? `Modal ≈ ${formatIDR(Math.round(costs.recipe[`${p.group.trim()}|${p.name.trim()}`]))} (resep)`
                      : 'Harga modal'
                  }
                  aria-label="Harga modal per satuan (opsional)"
                  title="Modal per satuan. Kosongkan untuk pakai hitungan resep (kalau ada)."
                  className={cn(fieldCls, 'px-3 py-1.5 fs-12 tabular-nums')}
                />
              ) : (
                <input
                  disabled
                  placeholder={isPro === false ? 'Harga modal · PRO' : isPro && costs && !costs.ready ? 'Modal · segera' : 'Harga modal'}
                  aria-label="Harga modal (PRO)"
                  className={cn(fieldCls, 'px-3 py-1.5 fs-12 opacity-60')}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {list.length < PRODUCTS_MAX && (
        <button
          type="button"
          onClick={() =>
            setList((l) => [
              ...l,
              { name: '', price: '', unit: '', group: l[l.length - 1]?.group ?? '', resellerPrice: '', cost: '', costKey: '' },
            ])
          }
          className="flex items-center gap-1 fs-12 font-bold text-violet-600 dark:text-violet-300"
        >
          <Plus size={14} /> Tambah produk
        </button>
      )}
      <FormButtons busy={busy} onSave={save} onCancel={onCancel} />
    </div>
  );
}

// Warna avatar kategori (kelas literal untuk Tailwind).
const GROUP_TONES = [
  'bg-orange-100 text-orange-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-lime-100 text-lime-700',
  'bg-indigo-100 text-indigo-700',
];
export const toneOf = (g: string) =>
  GROUP_TONES[[...g].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % GROUP_TONES.length];
export const initials = (g: string) =>
  g
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '•';
export const productLabel = (p: ShopProduct) => (p.group ? `${p.group} · ${p.name}` : p.name).slice(0, 80);

// Gambar katalog 1080×1350 (canvas di HP — tanpa server, tanpa halaman publik).
async function catalogImage(s: Shop): Promise<Blob> {
  const W = 1080,
    H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4c1d95');
  bg.addColorStop(1, '#0b1220');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const font = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const fit = (text: string, max: number) => {
    let t = text;
    while (g.measureText(t).width > max && t.length > 3) t = `${t.slice(0, -2)}…`;
    return t;
  };
  g.fillStyle = '#fff';
  g.font = font(400, 120);
  g.fillText(s.emoji || '🌱', 80, 200);
  g.font = font(800, 84);
  g.fillText(fit(s.name, W - 160), 80, 330);
  if (s.tagline) {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = font(500, 40);
    g.fillText(fit(s.tagline, W - 160), 80, 395);
  }
  let y = 500;
  for (const p of s.products.slice(0, 7)) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.roundRect(60, y - 62, W - 120, 104, 28);
    g.fill();
    g.fillStyle = '#fff';
    g.font = font(700, 40);
    g.fillText(fit(p.name, 620), 100, y);
    if (p.unit) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = font(500, 26);
      g.fillText(fit(p.unit, 600), 100, y + 30);
    }
    g.fillStyle = '#6ee7b7';
    g.font = font(800, 42);
    g.textAlign = 'right';
    g.fillText(formatIDR(p.price), W - 100, y + 12);
    g.textAlign = 'left';
    y += 124;
  }
  g.fillStyle = '#22c55e';
  g.beginPath();
  g.roundRect(60, H - 230, W - 120, 120, 60);
  g.fill();
  g.fillStyle = '#fff';
  g.font = font(800, 44);
  g.textAlign = 'center';
  g.fillText(`Pesan via WA ${prettyWa(s.contactWa)}`, W / 2, H - 155);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = font(500, 28);
  g.fillText(
    [s.paymentNote && `Bayar: ${s.paymentNote}`, s.area].filter(Boolean).join(' · ').slice(0, 70),
    W / 2,
    H - 50,
  );
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
