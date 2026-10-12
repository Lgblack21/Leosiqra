"use client";

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { itemService, type Item, type ItemInput, type ItemKind } from '@/lib/services/itemService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { Modal } from '@/components/ui/Modal';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Halaman Barang & Koleksi (satu komponen, beda `kind`). Nilai sekarang diisi
// user sendiri; garansi diingatkan kalau tinggal sedikit. Total nilainya ikut
// dihitung di Kekayaan.

export interface ItemCategory { name: string; emoji: string }

const monthsUntil = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  const n = new Date();
  return (d.getFullYear() - n.getFullYear()) * 12 + (d.getMonth() - n.getMonth()) + (d.getDate() >= n.getDate() ? 0 : -1);
};

export function ItemsPage({ kind, title, intro, categories }: { kind: ItemKind; title: string; intro: string; categories: ItemCategory[] }) {
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<Item[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);

  const load = useCallback(() => {
    itemService
      .list(kind)
      .then((r) => {
        setItems(r);
        setUnavailable(false);
      })
      .catch(() => {
        setItems([]);
        setUnavailable(true);
      });
  }, [kind]);
  useEffect(() => {
    load();
    return subscribeToCollectionChanges('items', load);
  }, [load]);

  const emojiOf = (cat?: string | null) => categories.find((c) => c.name === cat)?.emoji ?? (kind === 'barang' ? '📦' : '🃏');
  const list = (items ?? []).filter((i) => !query.trim() || `${i.name} ${i.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const totalValue = (items ?? []).reduce((s, i) => s + i.current_value, 0);
  const totalPrice = (items ?? []).reduce((s, i) => s + i.purchase_price, 0);
  const soonWarranty = (items ?? []).filter((i) => i.warranty_until && monthsUntil(i.warranty_until) >= 0 && monthsUntil(i.warranty_until) <= 2);

  const remove = async (item: Item) => {
    const ok = await confirm({ title: `Hapus ${item.name}?`, message: 'Data barang ini akan dihapus permanen.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try {
      await itemService.remove(item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  };

  if (unavailable) {
    return (
      <div className="mx-auto max-w-xl rounded-[24px] border border-slate-100 bg-white p-8 text-center">
        <LeoMascot mood="sad" size={110} className="mx-auto" />
        <p className="mt-3 font-bold text-slate-900">{title} belum aktif</p>
        <p className="mt-1 text-sm text-slate-500">Fitur ini sedang disiapkan. Coba lagi nanti ya.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{intro}</p>
        </div>
        <div className="flex gap-2">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Cari ${kind}`} className="w-44 rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
          </label>
          <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
            <Plus size={15} /> Tambah {kind}
          </button>
        </div>
      </div>

      {items === null ? (
        <div className="h-40 animate-pulse rounded-[24px] bg-white" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-[28px] border border-slate-100 bg-white p-10 text-center shadow-sm">
          <LeoMascot mood="idle" size={100} interactive />
          <p className="mt-3 text-lg font-bold text-slate-900">Catat {kind} yang kamu punya</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">Isi harga belinya dan taksiran nilai sekarang. Nilainya ikut dihitung di Kekayaan.</p>
          <button type="button" onClick={() => setEditing('new')} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
            <Plus size={15} /> Tambah {kind}
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">Nilai sekarang</p>
              <p className="text-xl font-extrabold text-slate-900 tabular-nums">{formatIDR(totalValue)}</p>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">Harga beli total</p>
              <p className="text-xl font-extrabold text-slate-900 tabular-nums">{formatIDR(totalPrice)}</p>
              {totalPrice > 0 && (
                <p className={cn('text-xs font-bold', totalValue >= totalPrice ? 'text-emerald-600' : 'text-rose-500')}>
                  {totalValue >= totalPrice ? 'Naik' : 'Turun'} {Math.abs(Math.round(((totalValue - totalPrice) / totalPrice) * 100))}%
                </p>
              )}
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">Jumlah</p>
              <p className="text-xl font-extrabold text-slate-900">{items.length} {kind}</p>
              {soonWarranty.length > 0 && <p className="text-xs font-bold text-amber-600">{soonWarranty.length} garansi segera habis</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => {
              const diff = i.purchase_price > 0 ? Math.round(((i.current_value - i.purchase_price) / i.purchase_price) * 100) : null;
              const wm = i.warranty_until ? monthsUntil(i.warranty_until) : null;
              return (
                <div key={i.id} className="group flex flex-col rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-2xl">{emojiOf(i.category)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{i.name}</p>
                      <p className="text-xs text-slate-400">{i.category ?? 'Tanpa kategori'}{i.purchase_date ? ` · beli ${new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(`${i.purchase_date}T12:00:00`))}` : ''}</p>
                    </div>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => setEditing(i)} aria-label={`Ubah ${i.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                      <button type="button" onClick={() => remove(i)} aria-label={`Hapus ${i.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="mt-3 text-lg font-extrabold text-slate-900 tabular-nums">{formatIDR(i.current_value)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                    {diff !== null && (
                      <span className={cn('rounded-full px-2 py-0.5', diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
                        {diff >= 0 ? '+' : ''}{diff}% dari {formatIDR(i.purchase_price)}
                      </span>
                    )}
                    {wm !== null && (
                      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5', wm < 0 ? 'bg-slate-100 text-slate-500' : wm <= 2 ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600')}>
                        <ShieldCheck size={11} /> {wm < 0 ? 'Garansi habis' : wm === 0 ? 'Garansi habis bulan ini' : `Garansi ${wm} bln lagi`}
                      </span>
                    )}
                    {i.for_sale === 1 && <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-600"><Tag size={11} /> Mau dijual</span>}
                  </div>
                  {i.note && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{i.note}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <ItemModal
          kind={kind}
          item={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ItemModal({ kind, item, categories, onClose, onSaved }: { kind: ItemKind; item: Item | null; categories: ItemCategory[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? categories[0]?.name ?? '');
  const [price, setPrice] = useState(item?.purchase_price ? String(item.purchase_price) : '');
  const [value, setValue] = useState(item?.current_value ? String(item.current_value) : '');
  const [bought, setBought] = useState(item?.purchase_date ?? '');
  const [warranty, setWarranty] = useState(item?.warranty_until ?? '');
  const [forSale, setForSale] = useState(item?.for_sale === 1);
  const [note, setNote] = useState(item?.note ?? '');
  const [saving, setSaving] = useState(false);
  const num = (s: string) => Number(s.replace(/\D/g, '')) || 0;
  const money = (s: string) => (s ? num(s).toLocaleString('id-ID') : '');

  const save = async () => {
    if (!name.trim()) return toast.error('Nama wajib diisi.');
    setSaving(true);
    const data: ItemInput = {
      name: name.trim(),
      category: category || null,
      purchase_price: num(price),
      current_value: value ? num(value) : num(price),
      purchase_date: bought || null,
      warranty_until: kind === 'barang' ? warranty || null : null,
      for_sale: forSale,
      note: note.trim() || null,
    };
    try {
      if (item) await itemService.update(item.id, data);
      else await itemService.create(kind, data);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white';
  const label = 'mb-1.5 block text-xs font-semibold text-slate-500';

  return (
    <Modal isOpen onClose={onClose} title={item ? `Ubah ${kind}` : `Tambah ${kind}`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <span className={label}>Nama</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={kind === 'barang' ? 'Mis. iPhone 15, Honda Beat' : 'Mis. Nike Dunk Low, Kartu Pikachu'} className={field} autoFocus />
        </div>
        <div>
          <span className={label}>Kategori</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button key={c.name} type="button" onClick={() => setCategory(c.name)} className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', category === c.name ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Harga beli</span>
            <input inputMode="numeric" value={money(price)} onChange={(e) => setPrice(e.target.value)} placeholder="Rp 0" className={field} />
          </label>
          <label>
            <span className={label}>Nilai sekarang (taksiran)</span>
            <input inputMode="numeric" value={money(value)} onChange={(e) => setValue(e.target.value)} placeholder="Sama dengan harga beli" className={field} />
          </label>
          <label>
            <span className={label}>Tanggal beli</span>
            <input type="date" value={bought} onChange={(e) => setBought(e.target.value)} className={field} />
          </label>
          {kind === 'barang' && (
            <label>
              <span className={label}>Garansi sampai</span>
              <input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} className={field} />
            </label>
          )}
        </div>
        <label>
          <span className={label}>Catatan</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Mis. nomor seri, warna, kondisi" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
          Mau dijual (muncul di Cuan)
        </label>
        <button type="button" onClick={save} disabled={saving} className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </Modal>
  );
}
