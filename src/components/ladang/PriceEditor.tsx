'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Minus, Plus, Search, X } from 'lucide-react';
import { shopService, groupProducts, type Shop } from '@/lib/services/shopService';
import { cn, formatIDR } from '@/lib/utils';
import { fieldCls, labelCls } from './UsahaView';
import { AiMcpCard } from './AiMcpCard';

// Naik/turun massal X% dibulatkan ke Rp100 terdekat (opsional). Simpan sekali.
const ago = (iso?: string) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1
    ? 'baru saja'
    : m < 60
      ? `${m} menit lalu`
      : m < 1440
        ? `${Math.round(m / 60)} jam lalu`
        : new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export function PriceEditor({
  shop,
  onDone,
  onToast,
  onLeave,
}: {
  shop: Shop;
  onDone: (m: string) => void;
  onToast: (m: string) => void;
  onLeave: () => void;
}) {
  const [prices, setPrices] = useState<number[]>(() => shop.products.map((p) => p.price));
  const [query, setQuery] = useState('');
  const [pct, setPct] = useState('5');
  const [round, setRound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => groupProducts(shop.products), [shop.products]);
  const visible = (i: number) =>
    !q || `${shop.products[i].group ?? ''} ${shop.products[i].name}`.toLowerCase().includes(q);
  const changed = prices.filter((v, i) => v !== shop.products[i].price).length;
  const [via, setVia] = useState<'manual' | 'ai'>('manual');
  const [aiMode, setAiMode] = useState<'katalog' | 'harga'>('katalog');
  const site = shop.linkUrl ? ` ${shop.linkUrl}` : ' [tautan website]';
  const catalogPrompt = `Pakai Leosiqra (MCP): baca ulang website tokoku${site} dan samakan katalog usahaku "${shop.name}" (shop_id ${shop.id}).
1) Panggil get_shop untuk katalog yang sekarang.
2) Buka website itu & SEMUA halaman produk/kategorinya, kumpulkan seluruh produk + harga Rupiah per kategori.
3) Panggil sync_shop_catalog dengan seluruh daftar itu (apply: false) untuk PRATINJAU.
4) Tunjukkan ke aku: produk yang akan DITAMBAH, DIHAPUS, dan harga yang berubah.
5) Setelah aku setuju, panggil sync_shop_catalog lagi dengan apply: true.`;
  const aiPrompt = `Pakai Leosiqra (MCP): perbarui HARGA katalog usahaku "${shop.name}" (shop_id ${shop.id}) sesuai website tokoku${shop.linkUrl ? ` ${shop.linkUrl}` : ' [tautan website]'}.
1) Panggil get_shop untuk daftar produk yang sudah ada (i, group, name, price).
2) Buka website itu & semua halaman produk/kategorinya, baca harga terbaru.
3) Cocokkan HANYA dengan produk yang sudah ada — JANGAN menambah produk baru.
4) Panggil update_shop_prices dengan [{ i, price }] untuk yang harganya berubah saja.
5) Laporkan ringkas: berapa yang naik/turun dan produk yang tidak ketemu.`;

  const bulk = (dir: 1 | -1) => {
    const f = Number(pct.replace(',', '.'));
    if (!Number.isFinite(f) || f <= 0 || f > 90) {
      setError('Isi persen 0,1–90.');
      return;
    }
    setError('');
    setPrices((ps) =>
      ps.map((v, i) => {
        if (!visible(i)) return v;
        const n = v * (1 + (dir * f) / 100);
        return Math.max(1, round ? Math.round(n / 100) * 100 : Math.round(n));
      }),
    );
  };
  const save = async () => {
    if (prices.some((v) => !v || v < 1)) {
      setError('Ada harga yang kosong.');
      return;
    }
    if (!changed) {
      onDone('Tidak ada harga yang diubah.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await shopService.update(shop.id, { products: shop.products.map((p, i) => ({ ...p, price: prices[i] })) });
      onDone(`${changed} harga diperbarui.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };

  const seg = (on: boolean) =>
    cn(
      'flex-1 rounded-full py-2 fs-12 font-bold transition-colors',
      on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400',
    );
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setVia('manual')}
          aria-pressed={via === 'manual'}
          className={seg(via === 'manual')}
        >
          Ubah manual
        </button>
        <button type="button" onClick={() => setVia('ai')} aria-pressed={via === 'ai'} className={seg(via === 'ai')}>
          Baca ulang website
        </button>
      </div>
      {via === 'ai' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['katalog', 'Cek katalog', 'Tambah produk baru, hapus yang sudah tidak ada, update harga'],
                ['harga', 'Cek harga', 'Hanya update harga produk yang sudah ada'],
              ] as const
            ).map(([id, t, d]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAiMode(id)}
                aria-pressed={aiMode === id}
                className={cn(
                  'rounded-2xl p-3 text-left ring-1 transition',
                  aiMode === id
                    ? 'bg-violet-50 ring-2 ring-violet-500 dark:bg-violet-500/10'
                    : 'bg-white ring-slate-100 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800',
                )}
              >
                <span className="block fs-13 font-extrabold text-slate-900 dark:text-white">{t}</span>
                <span className="mt-0.5 block fs-11 leading-snug text-slate-500 dark:text-slate-400">{d}</span>
              </button>
            ))}
          </div>
          {aiMode === 'katalog' ? (
            <AiMcpCard
              key="katalog"
              title="Baca ulang website & samakan katalog"
              desc="AI-mu membaca ulang seluruh website, menunjukkan produk yang akan ditambah/dihapus & harga yang berubah, lalu menyimpan setelah kamu setuju. Penjualan lama tidak terpengaruh."
              prompt={catalogPrompt}
              onLeave={onLeave}
              onToast={onToast}
            />
          ) : (
            <AiMcpCard
              key="harga"
              title="Perbarui harga dari website"
              desc="AI-mu membaca harga terbaru di websitemu, lalu HANYA mengubah harga produk yang sudah ada di katalog — tidak menambah produk baru."
              prompt={aiPrompt}
              onLeave={onLeave}
              onToast={onToast}
            />
          )}
          <p className="px-1 fs-11 text-slate-500 dark:text-slate-400">
            Mau berjalan sendiri tiap hari? Jadwalkan perintah ini di fitur tugas terjadwal aplikasi AI-mu (kalau
            tersedia), atau pakai sambungan website otomatis di Kelola › Sambungkan website.
          </p>
          {shop.catalogSyncedAt && (
            <p className="rounded-2xl bg-sky-50 px-3 py-2 fs-12 font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
              Terakhir diperbarui otomatis: {ago(shop.catalogSyncedAt)}
            </p>
          )}
        </>
      ) : (
        <>
          {shop.catalogSyncedAt && (
            <p className="rounded-2xl bg-sky-50 px-3 py-2 fs-12 font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
              🌐 Harga diperbarui otomatis dari website: {ago(shop.catalogSyncedAt)}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 px-3 py-2 fs-12 font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk…"
              aria-label="Cari produk"
              className="min-w-0 flex-1 bg-transparent fs-13 font-semibold text-slate-900 outline-none dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Hapus pencarian"
                className="text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className={labelCls}>Ubah massal {q ? '(hasil pencarian)' : '(semua produk)'}</span>
            <div className="flex items-center gap-2">
              <span className="flex w-24 items-center gap-1 rounded-xl bg-white px-2.5 py-2 dark:bg-slate-900">
                <input
                  value={pct}
                  onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
                  inputMode="decimal"
                  aria-label="Persen"
                  className="w-full min-w-0 bg-transparent fs-13 font-bold tabular-nums outline-none dark:text-white"
                />
                %
              </span>
              <button
                type="button"
                onClick={() => bulk(1)}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-rose-50 py-2 fs-12 font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <Plus size={13} /> Naikkan
              </button>
              <button
                type="button"
                onClick={() => bulk(-1)}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-50 py-2 fs-12 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <Minus size={13} /> Turunkan
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 fs-11 font-semibold text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={round}
                onChange={(e) => setRound(e.target.checked)}
                className="accent-violet-600"
              />{' '}
              Bulatkan ke Rp100 terdekat
            </label>
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {groups.map(({ group, items }) => {
              const shown = items.filter(({ i }) => visible(i));
              if (!shown.length) return null;
              return (
                <div key={group || 'lain'}>
                  {(groups.length > 1 || group) && (
                    <p className="mb-1 px-1 fs-11 font-bold uppercase tracking-wide text-slate-400">
                      {group || 'Lainnya'}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {shown.map(({ p, i }) => {
                      const diff = prices[i] - p.price;
                      return (
                        <li key={i} className="flex items-center gap-2 rounded-xl px-1 py-1">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate fs-13 font-bold text-slate-800 dark:text-slate-100">
                              {p.name}
                            </span>
                            {diff !== 0 && (
                              <span
                                className={cn(
                                  'block fs-11 font-semibold',
                                  diff > 0 ? 'text-rose-600' : 'text-emerald-600',
                                )}
                              >
                                {formatIDR(p.price)} → {diff > 0 ? '+' : ''}
                                {formatIDR(diff)}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              fieldCls,
                              'flex w-32 shrink-0 items-center gap-1 px-2.5 py-2',
                              diff !== 0 && 'ring-amber-400',
                            )}
                          >
                            <span className="fs-11 text-slate-400">Rp</span>
                            <input
                              value={prices[i] ? prices[i].toLocaleString('id-ID') : ''}
                              onChange={(e) => {
                                const v = Number(e.target.value.replace(/\D/g, '').slice(0, 10));
                                setPrices((ps) => ps.map((x, j) => (j === i ? v : x)));
                              }}
                              inputMode="numeric"
                              aria-label={`Harga ${p.name}`}
                              className="w-full min-w-0 bg-transparent text-right fs-13 font-bold tabular-nums outline-none"
                            />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 fs-14 font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-violet-600"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan
            {changed ? ` ${changed} perubahan` : ''}
          </button>
        </>
      )}
    </div>
  );
}
