'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles, Trash2, Wallet, X } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { imageFileToBase64 } from '@/lib/quick/ai';
import {
  mealPhotoUrl,
  mealService,
  newRequestId,
  nowTimeWIB,
  SLOTS,
  slotForTime,
  type Meal,
  type MealAnalysis,
  type MealDay,
  type MealItem,
  type MealSlot,
} from '@/lib/meals';
import { cn, formatIDR } from '@/lib/utils';

export type SheetState = { mode: 'new'; file?: File } | { mode: 'edit'; meal: Meal };

const numOrNull = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
};
const toStr = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 10) / 10));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-[14px] font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300 dark:bg-slate-800 dark:text-slate-100';

export function MealSheet({
  state,
  date,
  today,
  day,
  onClose,
  onSaved,
}: {
  state: SheetState;
  date: string;
  today: string;
  day: MealDay | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const reduce = useReducedMotion();
  const editing = state.mode === 'edit' ? state.meal : null;
  const file = state.mode === 'new' ? state.file : undefined;
  const requestId = useRef(newRequestId());
  const [preview, setPreview] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(Boolean(file));
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initTime = editing?.time ?? (date === today ? nowTimeWIB() : '12:00');
  const [name, setName] = useState(editing?.name ?? '');
  const [time, setTime] = useState(initTime);
  const [slot, setSlot] = useState<MealSlot>(editing?.slot ?? slotForTime(initTime));
  const [kcal, setKcal] = useState(toStr(editing?.kcal));
  const [protein, setProtein] = useState(toStr(editing?.protein));
  const [carbs, setCarbs] = useState(toStr(editing?.carbs));
  const [fat, setFat] = useState(toStr(editing?.fat));
  const [note, setNote] = useState(editing?.note ?? '');
  const [items, setItems] = useState<MealItem[]>(editing?.items ?? []);
  const [price, setPrice] = useState('');
  const accounts = day?.accounts ?? [];
  const [record, setRecord] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const apply = (a: MealAnalysis) => {
    setAnalysis(a);
    setName(a.name);
    setItems(a.items);
    setKcal(toStr(a.kcal));
    setProtein(toStr(a.protein));
    setCarbs(toStr(a.carbs));
    setFat(toStr(a.fat));
    if (a.price_estimate && !editing) {
      setPrice(String(a.price_estimate));
      setRecord(accounts.length > 0);
    }
  };
  // Tanpa foto (atau AI salah tebak): ketik menunya, Leo hitung gizinya.
  const [textBusy, setTextBusy] = useState(false);
  const analyzeText = async () => {
    const t = name.trim();
    if (t.length < 3 || textBusy) return;
    setTextBusy(true);
    setError('');
    try {
      apply(await mealService.analyze({ text: [t, note.trim()].filter(Boolean).join(' — ') }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Leo belum bisa menghitung. Coba lagi.');
    } finally {
      setTextBusy(false);
    }
  };

  // Foto baru: perkecil → pratinjau → minta Leo menaksir. Gagal → tetap bisa isi manual.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const b64 = await imageFileToBase64(file, 1280, 0.8);
        if (cancelled) return;
        setPhotoB64(b64);
        setPreview(`data:image/jpeg;base64,${b64}`);
        const a = await mealService.analyze({ imageBase64: b64 });
        if (cancelled) return;
        apply(a);
      } catch (e) {
        if (!cancelled) setError(`${e instanceof Error ? e.message : 'Analisis gagal.'} Kamu tetap bisa isi manual.`);
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali per foto
  }, [file]);

  const priceNum = Number(price.replace(/\D/g, '')) || 0;
  const save = async () => {
    if (!name.trim()) {
      setError('Isi nama makanannya dulu.');
      return;
    }
    if (record && priceNum > 0 && !accountId) {
      setError('Pilih rekening untuk pengeluarannya.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await mealService.update(editing.id, {
          name: name.trim(),
          slot,
          time,
          kcal: numOrNull(kcal),
          protein: numOrNull(protein),
          carbs: numOrNull(carbs),
          fat: numOrNull(fat),
          note: note.trim() || null,
          ...(analysis ? { items, score: analysis.score, tip: analysis.tip || null, ai: true } : {}),
        });
        onSaved('Catatan makan diperbarui.');
      } else {
        const res = await mealService.create({
          request_id: requestId.current,
          date,
          time,
          slot,
          name: name.trim(),
          items,
          kcal: numOrNull(kcal),
          protein: numOrNull(protein),
          carbs: numOrNull(carbs),
          fat: numOrNull(fat),
          score: analysis?.score ?? null,
          tip: analysis?.tip || null,
          price: priceNum || null,
          record_expense: record && priceNum > 0,
          account_id: record && priceNum > 0 ? accountId : null,
          note: note.trim() || null,
          photoBase64: photoB64,
          ai: Boolean(analysis),
        });
        onSaved(res.tx_id ? `Tersimpan · ${formatIDR(priceNum)} dicatat sebagai pengeluaran.` : 'Makanan tersimpan.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await mealService.remove(editing.id);
      onSaved(r.tx_kept ? 'Dihapus. Pengeluarannya tetap ada di Transaksi.' : 'Catatan makan dihapus.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
      setSaving(false);
    }
  };

  const img = preview ?? (editing?.has_photo ? mealPhotoUrl(editing.id, editing.updated_at) : null);
  const score = analysis?.score ?? editing?.score ?? null;
  const tip = analysis?.tip || editing?.tip || '';

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Ubah catatan makan' : 'Tambah makanan'}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-[480px] sm:rounded-[28px] dark:bg-slate-900"
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[17px] font-black text-slate-900 dark:text-white">
            {editing ? 'Ubah makanan' : 'Tambah makanan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {img || analyzing ? (
            <div className="relative flex items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 dark:from-orange-500/10 dark:to-rose-500/10">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal / foto pribadi lewat API
                <img
                  src={img}
                  alt=""
                  className="h-28 w-28 shrink-0 -rotate-3 rounded-full border-[5px] border-white object-cover shadow-xl dark:border-slate-800"
                />
              ) : (
                <span className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-white/70 dark:bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                {analyzing ? (
                  <div className="flex items-center gap-2 text-[14px] font-bold text-orange-700 dark:text-orange-300">
                    <LeoBadge topic="makan" size={30} thinking />
                    Leo lagi ngenalin makananmu…
                  </div>
                ) : analysis ? (
                  <>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-orange-600/80 dark:text-orange-300/80">
                      Kata Leo {analysis.emoji}
                    </div>
                    <div className="text-[17px] font-black leading-tight text-slate-900 dark:text-white">
                      {analysis.name}
                    </div>
                    <div className="mt-1 text-[13px] font-bold text-slate-600 dark:text-slate-300">
                      ±{analysis.kcal} kkal
                    </div>
                  </>
                ) : (
                  <div className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Foto makanan</div>
                )}
                {score ? (
                  <div className="mt-1.5 flex items-center gap-1" aria-label={`Keseimbangan gizi ${score} dari 5`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1.5 w-5 rounded-full',
                          i <= score ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700',
                        )}
                      />
                    ))}
                    <span className="ml-1 text-[11px] font-semibold text-slate-500">gizi seimbang</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {analysis?.charged ? (
            <p
              className={cn(
                'rounded-full px-3 py-1 text-center text-[11.5px] font-bold',
                analysis.charged === 'coin'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
              )}
            >
              {analysis.charged === 'coin'
                ? `−${analysis.price ?? 200} koin dipakai untuk analisis ini`
                : 'Pakai jatah analisis gratis hari ini'}
            </p>
          ) : null}
          {tip ? (
            <p className="flex gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-amber-500" /> {tip}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Makan apa?">
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !analysis && void analyzeText()}
                maxLength={60}
                placeholder="mis. Nasi goreng telur + es teh manis"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void analyzeText()}
                disabled={name.trim().length < 3 || textBusy || analyzing}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 text-[13px] font-bold text-white shadow-md shadow-rose-500/20 disabled:opacity-40"
              >
                {textBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                <span className="whitespace-nowrap">{analysis ? 'Hitung ulang' : 'Hitung pakai Leo'}</span>
              </button>
            </div>
            {!analysis && !img ? (
              <span className="mt-1 block text-[11.5px] text-slate-400">
                Ketik menunya, Leo hitung kalori, protein, karbo & lemaknya.
              </span>
            ) : null}
          </Field>

          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Waktu makan
            </span>
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlot(s.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors',
                    slot === s.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Jam makan"
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-bold text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {items.length ? (
            <div className="rounded-2xl ring-1 ring-slate-100 dark:ring-slate-800">
              {items.map((it, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]',
                    i && 'border-t border-slate-100 dark:border-slate-800',
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{it.name}</span>
                    {it.portion ? <span className="text-slate-400"> · {it.portion}</span> : null}
                  </span>
                  <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300">
                    {it.kcal != null ? `${Math.round(it.kcal)} kkal` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-4 gap-2">
            <Field label="Kkal">
              <input
                inputMode="decimal"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="Protein">
              <input
                inputMode="decimal"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="g"
                className={inputCls}
              />
            </Field>
            <Field label="Karbo">
              <input
                inputMode="decimal"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="g"
                className={inputCls}
              />
            </Field>
            <Field label="Lemak">
              <input
                inputMode="decimal"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="g"
                className={inputCls}
              />
            </Field>
          </div>

          {editing ? (
            editing.price ? (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <Wallet size={16} /> {formatIDR(editing.price)}
                {editing.recorded ? ' · tercatat sebagai pengeluaran (ubah di Transaksi)' : ''}
              </p>
            ) : null
          ) : (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
              <Field label={analysis?.price_estimate ? 'Harga (perkiraan Leo, ubah kalau beda)' : 'Harga (opsional)'}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    inputMode="numeric"
                    value={priceNum ? new Intl.NumberFormat('id-ID').format(priceNum) : ''}
                    onChange={(e) => {
                      setPrice(e.target.value.replace(/\D/g, '').slice(0, 10));
                      if (!e.target.value) setRecord(false);
                    }}
                    placeholder="0 (masak sendiri)"
                    className={cn(inputCls, 'bg-white pl-10 dark:bg-slate-900')}
                  />
                </div>
              </Field>
              {priceNum > 0 ? (
                accounts.length ? (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={record}
                        onChange={(e) => setRecord(e.target.checked)}
                        className="h-5 w-5 accent-orange-500"
                      />
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                        Catat {formatIDR(priceNum)} sebagai pengeluaran
                        <span className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                          Kategori Makanan & Minuman
                        </span>
                      </span>
                    </label>
                    {record ? (
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        aria-label="Rekening"
                        className={cn(inputCls, 'bg-white dark:bg-slate-900')}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Tambah rekening Rupiah dulu supaya harganya bisa dicatat sebagai pengeluaran.
                  </p>
                )
              ) : null}
            </div>
          )}

          <Field label="Catatan (opsional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="mis. makan bareng tim"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 dark:border-slate-800">
          {editing ? (
            confirmDelete ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="flex h-12 items-center gap-1.5 rounded-2xl bg-rose-600 px-4 text-[14px] font-bold text-white"
              >
                <Trash2 size={16} /> Yakin hapus
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Hapus"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <Trash2 size={18} />
              </button>
            )
          ) : null}
          <button
            type="button"
            disabled={saving || analyzing}
            onClick={() => void save()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-[15px] font-bold text-white shadow-lg shadow-rose-500/25 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {editing
              ? 'Simpan perubahan'
              : record && priceNum > 0
                ? `Simpan & catat ${formatIDR(priceNum)}`
                : 'Simpan makanan'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
