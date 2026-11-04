"use client";

import { useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { imageFileToBase64 } from '@/lib/quick/ai';
import { itemService } from '@/lib/services/itemService';
import { addMonths, CATEGORY_META, ITEM_CATEGORIES, itemCurrentValue, type Item, type ItemCategory, type ItemStatus, type ItemValueMode } from '@/lib/itemValue';

// Form tambah/ubah barang (Barangku) — satu halaman, dipakai web (Modal) &
// app HP (BottomSheet). Kelas dark: untuk /app; web memakai .web-dark.

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 13);
const group = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '');

const VALUE_MODES: { id: ItemValueMode; label: string; desc: string }[] = [
  { id: 'auto', label: 'Otomatis', desc: 'Turun mengikuti umur barang' },
  { id: 'tetap', label: 'Tetap', desc: 'Sama dengan harga beli' },
  { id: 'manual', label: 'Isi sendiri', desc: 'Harga pasaran menurutmu' },
];

// Preset: dari tombol cepat (nama+kategori) atau "Jadikan barang" dari transaksi (+harga, tanggal, catatan).
export type EditorPreset = { name?: string; category?: ItemCategory; price?: number; purchaseDate?: string; note?: string };

export function ItemEditor({ item, preset, onDone, onCancel }: { item?: Item | null; preset?: EditorPreset | null; onDone: (msg: string) => void; onCancel?: () => void }) {
  const today = toLocalDateString();
  const [name, setName] = useState(item?.name ?? preset?.name ?? '');
  const [brand, setBrand] = useState(item?.brand ?? '');
  const [variant, setVariant] = useState(item?.variant ?? '');
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? preset?.category ?? 'Elektronik');
  const [price, setPrice] = useState(item ? String(Math.round(item.purchasePrice)) : preset?.price ? String(Math.round(preset.price)) : '');
  const [purchaseDate, setPurchaseDate] = useState(item?.purchaseDate ?? preset?.purchaseDate ?? today);
  const [warranty, setWarranty] = useState(item?.warrantyUntil ?? '');
  const [mode, setMode] = useState<ItemValueMode>(item?.valueMode ?? (preset?.category === 'Jam & perhiasan' ? 'tetap' : 'auto'));
  const [manual, setManual] = useState(item?.manualValue != null ? String(Math.round(item.manualValue)) : '');
  const [note, setNote] = useState(item?.note ?? preset?.note ?? '');
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const userTouchedMode = useRef(Boolean(item));
  const userTouchedCategory = useRef(Boolean(item) || Boolean(preset?.category));
  const [scanning, setScanning] = useState(false);
  const [aiNote, setAiNote] = useState('');

  // Jam & perhiasan biasanya tidak turun nilainya → default "Tetap" (kecuali user sudah memilih sendiri).
  const chooseCategory = (c: ItemCategory, byUser = true) => {
    if (byUser) userTouchedCategory.current = true;
    setCategory(c);
    if (!userTouchedMode.current) setMode(CATEGORY_META[c].rate > 0 ? 'auto' : 'tetap');
  };

  const priceNum = Number(price || '0');
  const estimate = useMemo(
    () => itemCurrentValue({ category, purchasePrice: priceNum, purchaseDate, createdAt: item?.createdAt ?? new Date().toISOString(), valueMode: mode, manualValue: Number(manual || '0') }),
    [category, priceNum, purchaseDate, item?.createdAt, mode, manual]
  );
  const dropPct = priceNum > 0 ? Math.round((1 - estimate / priceNum) * 100) : 0;

  const existingPhoto = item?.hasPhoto && !photoRemoved ? itemService.photoUrl(item) : null;
  const shownPhoto = photo?.preview ?? existingPhoto;

  // AI isi otomatis: hanya mengisi kolom yang masih kosong / belum diubah user.
  const runScan = async (base64: string) => {
    setScanning(true);
    setError('');
    setAiNote('');
    try {
      const s = await itemService.scan(base64);
      const filled: string[] = [];
      if (!name.trim() && s.name) { setName(s.name); filled.push('nama'); }
      if (!brand.trim() && s.brand) { setBrand(s.brand); filled.push('merek'); }
      if (!variant.trim() && s.variant) { setVariant(s.variant); filled.push('varian'); }
      if (!userTouchedCategory.current && s.category) { chooseCategory(s.category, false); filled.push('kategori'); }
      if (!price && s.price) { setPrice(String(s.price)); filled.push('harga'); }
      const date = s.purchase_date ?? purchaseDate;
      if (s.purchase_date) { setPurchaseDate(s.purchase_date); filled.push('tanggal beli'); }
      if (!warranty && s.warranty_months) { setWarranty(addMonths(date || today, s.warranty_months)); filled.push('garansi'); }
      if (s.photo_kind === 'struk') setPhoto(null); // foto struk bukan foto barang
      setAiNote(
        filled.length === 0
          ? 'AI tidak menemukan info baru dari foto ini.'
          : `AI mengisi ${filled.join(', ')}${s.confidence === 'low' ? ' (kurang yakin)' : ''} — cek lagi sebelum simpan.${s.photo_kind === 'struk' ? ' Foto struk tidak dipakai sebagai foto barang.' : ''}`
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'AI gagal membaca foto. Isi manual dulu ya.');
    } finally {
      setScanning(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    let base64 = '';
    try {
      base64 = await imageFileToBase64(file, 1280, 0.82);
      setPhoto({ base64, preview: `data:image/jpeg;base64,${base64}` });
      setPhotoRemoved(false);
    } catch {
      setError('Foto tidak bisa dibaca. Coba foto lain.');
      return;
    }
    // Barang baru tanpa nama → langsung coba kenali dari foto.
    if (!item && !name.trim()) void runScan(base64);
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    if (mode === 'manual' && !manual) { setError('Isi nilai sekarang, atau pilih Otomatis.'); return; }
    setBusy(true);
    setError('');
    const input = {
      name: name.trim(),
      brand: brand.trim(),
      variant: variant.trim(),
      category,
      purchasePrice: priceNum,
      purchaseDate: purchaseDate || null,
      warrantyUntil: warranty || null,
      valueMode: mode,
      manualValue: mode === 'manual' ? Number(manual || '0') : null,
      note: note.trim(),
    };
    let id = item?.id;
    try {
      if (id) await itemService.update(id, input);
      else id = await itemService.create(input);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan barang.');
      setBusy(false);
      return;
    }
    try {
      if (photo) await itemService.setPhoto(id, photo.base64);
      else if (photoRemoved && item?.hasPhoto) await itemService.removePhoto(id);
    } catch (e) {
      setBusy(false);
      onDone(`Barang tersimpan, tapi foto gagal diunggah${e instanceof Error && e.message ? `: ${e.message}` : '.'}`);
      return;
    }
    setBusy(false);
    onDone(item ? 'Perubahan disimpan.' : `${input.name} masuk Barangku.`);
  };

  const setStatus = async (status: ItemStatus) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await itemService.update(item.id, { status });
      onDone(status === 'aktif' ? 'Barang aktif lagi.' : status === 'terjual' ? 'Ditandai terjual — tidak dihitung di kekayaan.' : 'Ditandai hilang — tidak dihitung di kekayaan.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal mengubah status.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await itemService.remove(item.id);
      onDone('Barang dihapus.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };

  const label = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';
  const input = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  const chip = (on: boolean) =>
    cn('rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors', on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700');
  const Icon = CATEGORY_META[category].icon;

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      {/* Foto + nama */}
      <div className="flex gap-4">
        <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800">
          {shownPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto privat dari API (cookie), bukan aset statis
            <img src={shownPhoto} alt={name || 'Foto barang'} className="h-full w-full object-cover" />
          ) : (
            <span className={cn('flex h-full w-full items-center justify-center', CATEGORY_META[category].tone)}><Icon size={38} strokeWidth={1.6} /></span>
          )}
          {shownPhoto && (
            <button type="button" onClick={() => { setPhoto(null); setPhotoRemoved(true); }} aria-label="Hapus foto" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama barang, mis. iPhone 15" aria-label="Nama barang" maxLength={80} className={cn(input, 'text-[16px] font-bold')} autoFocus={!item} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => camRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
              <Camera size={15} /> Kamera
            </button>
            <button type="button" onClick={() => galRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
              <ImagePlus size={15} /> Galeri
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {(scanning || aiNote || photo) && (
        <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2.5 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          {scanning ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <Sparkles size={15} className="shrink-0" />}
          <span className="min-w-0 flex-1">{scanning ? 'AI sedang mengenali barang…' : aiNote || 'Foto barang atau struknya bisa dibaca AI untuk mengisi form.'}</span>
          {!scanning && photo && (
            <button type="button" onClick={() => void runScan(photo.base64)} className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700">
              {aiNote ? 'Ulangi' : 'Isi otomatis'}
            </button>
          )}
        </div>
      )}

      {/* Kategori */}
      <div>
        <span className={label}>Kategori</span>
        <div className="grid grid-cols-4 gap-2">
          {ITEM_CATEGORIES.map((c) => {
            const M = CATEGORY_META[c];
            const on = c === category;
            return (
              <button key={c} type="button" onClick={() => chooseCategory(c)} aria-pressed={on} className={cn('flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-center ring-2 transition-colors', on ? 'bg-white ring-indigo-500 dark:bg-slate-900' : 'bg-slate-50 ring-transparent hover:bg-slate-100 dark:bg-slate-800/60')}>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', M.tone)}><M.icon size={18} /></span>
                <span className={cn('text-[11px] font-bold leading-tight', on ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{c}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-slate-400">{CATEGORY_META[category].hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={label}>Merek</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Apple, Honda…" maxLength={60} className={input} /></label>
        <label className="block"><span className={label}>Varian</span><input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="128 GB, 2024…" maxLength={60} className={input} /></label>
      </div>

      {/* Harga & tanggal */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Harga beli</span>
          <span className={cn(input, 'flex items-center gap-1.5 focus-within:bg-white focus-within:ring-indigo-500 dark:focus-within:bg-slate-900')}>
            <span className="text-slate-400">Rp</span>
            <input value={group(price)} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label="Harga beli" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
          </span>
        </label>
        <label className="block"><span className={label}>Dibeli</span><input type="date" value={purchaseDate} max={today} onChange={(e) => setPurchaseDate(e.target.value)} className={input} /></label>
      </div>

      {/* Garansi */}
      <div>
        <span className={label}>Garansi sampai</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setWarranty('')} className={chip(!warranty)}>Tidak ada</button>
          {[[12, '1 tahun'], [24, '2 tahun']].map(([m, l]) => {
            const v = addMonths(purchaseDate || today, m as number);
            return <button key={l} type="button" onClick={() => setWarranty(v)} className={chip(warranty === v)}>{l}</button>;
          })}
          <input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} aria-label="Tanggal garansi habis" className={cn(input, 'w-auto flex-1 py-2 text-[13px]')} />
        </div>
        {warranty && <p className="mt-1.5 px-1 text-[11px] text-slate-400">Diingatkan 30 & 7 hari sebelum garansi habis.</p>}
      </div>

      {/* Nilai sekarang */}
      <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">Nilai sekarang</span>
          <span className="text-[20px] font-extrabold tabular-nums text-slate-900 dark:text-white">{formatIDR(estimate)}</span>
        </div>
        {mode === 'auto' && priceNum > 0 && (
          <p className="text-right text-[11px] text-slate-400">{dropPct > 0 ? `≈ turun ${dropPct}% dari harga beli` : 'Masih seharga belinya'}</p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 dark:bg-slate-900">
          {VALUE_MODES.map((v) => (
            <button key={v.id} type="button" onClick={() => { userTouchedMode.current = true; setMode(v.id); }} aria-pressed={mode === v.id} className={cn('rounded-xl px-2 py-2 text-[12px] font-bold', mode === v.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400')}>
              {v.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-slate-400">{VALUE_MODES.find((v) => v.id === mode)?.desc}. Ikut dihitung di Kekayaan bersih.</p>
        {mode === 'manual' && (
          <span className={cn(input, 'mt-2 flex items-center gap-1.5 bg-white focus-within:ring-indigo-500 dark:bg-slate-900')}>
            <span className="text-slate-400">Rp</span>
            <input value={group(manual)} onChange={(e) => setManual(digits(e.target.value))} inputMode="numeric" placeholder="Harga kalau dijual sekarang" aria-label="Nilai sekarang" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
          </span>
        )}
      </div>

      <label className="block"><span className={label}>Catatan</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="No. seri, toko, lokasi simpan… (opsional)" className={cn(input, 'resize-none')} /></label>

      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-5 py-3.5 text-[14px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Batal</button>}
        <button type="button" onClick={save} disabled={busy || !name.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {item ? 'Simpan perubahan' : 'Simpan barang'}
        </button>
      </div>

      {item && (
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            {item.status === 'aktif' ? (
              <>
                <button type="button" onClick={() => setStatus('terjual')} disabled={busy} className={chip(false)}>Tandai terjual</button>
                <button type="button" onClick={() => setStatus('hilang')} disabled={busy} className={chip(false)}>Tandai hilang / rusak</button>
              </>
            ) : (
              <button type="button" onClick={() => setStatus('aktif')} disabled={busy} className={chip(false)}>Kembalikan ke aktif</button>
            )}
            <button type="button" onClick={remove} disabled={busy} className={cn('ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold', confirmDelete ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')}>
              <Trash2 size={13} /> {confirmDelete ? 'Yakin hapus?' : 'Hapus'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
