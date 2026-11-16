'use client';

import { useState } from 'react';
import { Check, ImagePlus, Loader2, Lock, ShieldCheck, Trash2, Undo2, X } from 'lucide-react';
import type { Shop } from '@/lib/services/shopService';
import { JENIS_JAMINAN, shopLoanService, type Loan } from '@/lib/services/shopLoanService';
import { fotoKeBase64 } from '@/lib/fotoKecil';
import { cn, formatIDR } from '@/lib/utils';
import { fieldCls, labelCls } from '@/components/ladang/UsahaView';

// Jaminan pinjaman (opsional): jenis, keterangan, perkiraan nilai, 1–3 foto PRIVAT (R2), tanda dikembalikan.
// Rancangan: docs/rancangan/usahaku-anggota-jaminan-tim.md bagian 4.
export const JAMINAN_FOTO_MAX = 3;
export const jenisLabel = (id: string) => JENIS_JAMINAN.find(([k]) => k === id)?.[1] ?? 'Lainnya';
export type JaminanDraft = { on: boolean; jenis: string; ket: string; nilai: number; photos: string[] };
export const jaminanKosong = (): JaminanDraft => ({ on: false, jenis: 'bpkb_motor', ket: '', nilai: 0, photos: [] });

const money = (v: string) => Number(v.replace(/\D/g, '').slice(0, 11) || '0');

/** Isian jaminan di form Pinjaman baru (foto disimpan dulu di perangkat, diunggah setelah pinjaman tercatat). */
export function JaminanInput({ value, onChange }: { value: JaminanDraft; onChange: (v: JaminanDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (p: Partial<JaminanDraft>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3 rounded-2xl ring-1 ring-slate-200 p-3 dark:ring-slate-700">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 fs-14 font-bold text-slate-800 dark:text-slate-100">
          <ShieldCheck size={17} className="text-emerald-600" /> Ada jaminan
        </span>
        <input type="checkbox" checked={value.on} onChange={(e) => set({ on: e.target.checked })} className="h-5 w-5 accent-emerald-600" />
      </label>
      {value.on && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Jenis</span>
              <select value={value.jenis} onChange={(e) => set({ jenis: e.target.value })} className={fieldCls}>
                {JENIS_JAMINAN.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Perkiraan nilai (opsional)</span>
              <input value={value.nilai ? value.nilai.toLocaleString('id-ID') : ''} onChange={(e) => set({ nilai: money(e.target.value) })} inputMode="numeric" className={cn(fieldCls, 'tabular-nums')} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Keterangan</span>
            <input value={value.ket} onChange={(e) => set({ ket: e.target.value })} maxLength={160} placeholder="Mis. BPKB Honda Beat 2019 B 1234 XYZ a.n. Siti" className={fieldCls} />
          </label>
          <div className="flex flex-wrap gap-2">
            {value.photos.map((p, i) => (
              <span key={i} className="relative h-20 w-20 overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal */}
                <img src={p} alt={`Foto jaminan ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => set({ photos: value.photos.filter((_, j) => j !== i) })} aria-label="Hapus foto" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white">
                  <X size={12} />
                </button>
              </span>
            ))}
            {value.photos.length < JAMINAN_FOTO_MAX && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 fs-11 font-bold text-slate-500 dark:border-slate-600">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                Foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setBusy(true);
                    setError('');
                    try {
                      set({ photos: [...value.photos, await fotoKeBase64(f, 1600)] });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Foto gagal diproses.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
          {error && <p className="fs-12 font-semibold text-rose-600">{error}</p>}
          <p className="flex items-start gap-1.5 fs-11 text-slate-500">
            <Lock size={12} className="mt-0.5 shrink-0" /> Maks {JAMINAN_FOTO_MAX} foto, disimpan privat (hanya kamu yang bisa membuka).
          </p>
        </>
      )}
    </div>
  );
}

/** Bagian Jaminan di detail pinjaman. */
export function JaminanSection({ shop, loan, v, onToast }: { shop: Shop; loan: Loan; v: number; onToast: (m: string) => void }) {
  const c = loan.collateral;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<JaminanDraft>(() => ({ on: true, jenis: c?.jenis ?? 'bpkb_motor', ket: c?.ket ?? '', nilai: c?.nilai ?? 0, photos: [] }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = async (label: string, f: () => Promise<void>, ok?: string) => {
    setBusy(label);
    setError('');
    try {
      await f();
      if (ok) onToast(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy('');
    }
  };
  const simpan = () =>
    run('simpan', async () => {
      if (!draft.ket.trim() && !draft.nilai) throw new Error('Isi keterangan jaminan.');
      await shopLoanService.saveCollateral(shop.id, loan.id, { jenis: draft.jenis, ket: draft.ket.trim(), nilai: draft.nilai || null });
      const start = c?.photoCount ?? 0;
      for (let i = 0; i < draft.photos.length && start + i < JAMINAN_FOTO_MAX; i++) await shopLoanService.uploadCollateralPhoto(shop.id, loan.id, start + i, draft.photos[i]);
      setEdit(false);
      setDraft((d) => ({ ...d, photos: [] }));
    }, 'Jaminan disimpan.');

  if (!c && !edit)
    return (
      <button type="button" onClick={() => setEdit(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 fs-13 font-bold text-slate-500 hover:border-slate-300 dark:border-slate-700">
        <ShieldCheck size={16} /> Tambah jaminan
      </button>
    );
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 fs-14 font-extrabold text-slate-900 dark:text-white">
          <ShieldCheck size={16} className="text-emerald-600" /> Jaminan
        </p>
        {c && (
          <span className={cn('rounded-md px-2 py-0.5 fs-11 font-bold', c.returnedAt ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-800')}>
            {c.returnedAt ? `Dikembalikan ${c.returnedAt}` : 'Masih dipegang'}
          </span>
        )}
      </div>
      {edit ? (
        <>
          <JaminanInput value={draft} onChange={(d) => setDraft({ ...d, on: true })} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEdit(false)} className="rounded-full bg-slate-100 px-4 py-2.5 fs-13 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Batal
            </button>
            <button type="button" onClick={simpan} disabled={Boolean(busy)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2.5 fs-13 font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan jaminan
            </button>
          </div>
        </>
      ) : (
        c && (
          <>
            <p className="fs-13 text-slate-700 dark:text-slate-200">
              <b>{jenisLabel(c.jenis)}</b>
              {c.ket ? ` · ${c.ket}` : ''}
              {c.nilai ? <span className="text-slate-500"> · perkiraan {formatIDR(c.nilai)}</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: c.photoCount }, (_, i) => {
                const url = shopLoanService.collateralPhotoUrl(shop.id, loan.id, i, v);
                return (
                  <span key={i} className="relative h-24 w-24 overflow-hidden rounded-xl bg-slate-100">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto privat lewat endpoint berlogin */}
                      <img src={url} alt={`Foto jaminan ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                    <button
                      type="button"
                      onClick={() => window.confirm('Hapus foto jaminan ini?') && run('hapus', () => shopLoanService.deleteCollateralPhoto(shop.id, loan.id, i))}
                      aria-label="Hapus foto jaminan"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                );
              })}
              {c.photoCount < JAMINAN_FOTO_MAX && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 fs-11 font-bold text-slate-500 dark:border-slate-600">
                  {busy === 'foto' ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                  Tambah foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void run('foto', async () => shopLoanService.uploadCollateralPhoto(shop.id, loan.id, c.photoCount, await fotoKeBase64(f, 1600)), 'Foto jaminan ditambahkan.');
                    }}
                  />
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {c.returnedAt ? (
                <button type="button" onClick={() => run('kembali', () => shopLoanService.returnCollateral(shop.id, loan.id, true))} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Undo2 size={13} /> Batalkan tanda dikembalikan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    (loan.status === 'lunas' || window.confirm('Pinjaman ini belum lunas. Yakin jaminan sudah dikembalikan?')) &&
                    run('kembali', () => shopLoanService.returnCollateral(shop.id, loan.id), 'Jaminan ditandai sudah dikembalikan.')
                  }
                  className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 fs-12 font-bold', loan.status === 'lunas' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}
                >
                  <Check size={13} /> Jaminan sudah dikembalikan
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDraft({ on: true, jenis: c.jenis, ket: c.ket, nilai: c.nilai ?? 0, photos: [] });
                  setEdit(true);
                }}
                className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Ubah
              </button>
            </div>
          </>
        )
      )}
      {error && <p role="alert" className="fs-12 font-semibold text-rose-600">{error}</p>}
      <p className="flex items-start gap-1.5 fs-11 text-slate-400">
        <Lock size={12} className="mt-0.5 shrink-0" /> Foto jaminan privat — tidak ikut Excel dan tidak terlihat akun tim.
      </p>
    </section>
  );
}
