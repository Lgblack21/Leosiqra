"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, Keyboard, Loader2, Mic, ScanLine, Square, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { quickTxService } from '@/lib/services/quickTxService';
import { useQuickContext } from '@/lib/quick/useQuickContext';
import { parseQuickText, type QuickDraft } from '@/lib/quick/parse';
import { aiParse, imageFileToBase64 } from '@/lib/quick/ai';
import { startSpeech, speechSupport, type SpeechSession } from '@/lib/speech';
import { isCreditAccountType } from '@/lib/creditCard';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { useFeedback } from '@/components/ui/Feedback';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Catat cepat langsung di web (tanpa pindah ke Input Cepat / aplikasi HP):
//   scan  → foto/unggah struk, AI membaca toko, total, tanggal
//   voice → bicara ("kopi 25rb pakai gopay"), AI menuliskannya
//   text  → ketik satu kalimat
// Semuanya berakhir di form tinjau; tidak ada yang tersimpan sebelum "Simpan".

export type CaptureMode = 'scan' | 'voice' | 'text';
type Stage = { kind: 'input' } | { kind: 'thinking'; label: string } | { kind: 'review'; draft: QuickDraft; note?: string };

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export function QuickCaptureModal({ mode: initialMode, onClose }: { mode: CaptureMode; onClose: () => void }) {
  const { toast } = useFeedback();
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [stage, setStage] = useState<Stage>({ kind: 'input' });
  const [uid, setUid] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { ctx } = useQuickContext(uid, accounts, transactions);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [typed, setTyped] = useState('');
  const session = useRef<SpeechSession | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const canSpeak = typeof window !== 'undefined' && speechSupport() !== null;

  useEffect(() => {
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me').then((r) => setUid(r.user?.id ?? '')).catch(() => {});
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // close stabil secara perilaku
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    session.current?.stop();
    onClose();
  };

  const toReview = (draft: QuickDraft, note?: string) => setStage({ kind: 'review', draft, note });

  // --- Struk
  const onPhoto = async (file?: File) => {
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));
    setStage({ kind: 'thinking', label: 'AI membaca struk…' });
    try {
      const ai = await aiParse({ imageBase64: await imageFileToBase64(file) });
      const { confidence, ...fields } = ai;
      toReview(defined(fields), confidence === 'low' ? 'Struk kurang jelas — cek lagi nominal & kategorinya.' : undefined);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal membaca struk.');
      setStage({ kind: 'input' });
    }
  };

  // --- Suara
  const finishVoice = async (text: string) => {
    session.current = null;
    setListening(false);
    const said = text.trim();
    if (!said) return;
    setStage({ kind: 'thinking', label: 'AI membaca ucapanmu…' });
    const local = parseQuickText(said, ctx);
    try {
      const ai = await aiParse({ text: said });
      const { confidence, ...fields } = ai;
      toReview({ ...local, ...defined(fields) }, confidence === 'low' ? 'AI kurang yakin — cek lagi isinya.' : undefined);
    } catch {
      toReview(local, 'AI sedang tidak tersedia — diisi dari teks ucapan.');
    }
  };
  const toggleMic = async () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setError('');
    setSpoken('');
    setListening(true);
    const s = await startSpeech({
      onPartial: setSpoken,
      onEnd: (t) => void finishVoice(t),
      onError: (msg) => {
        session.current = null;
        setListening(false);
        setError(msg);
      },
    });
    if (s) session.current = s;
    else setListening(false);
  };

  // --- Ketik
  const fromText = () => {
    if (!typed.trim()) return;
    toReview(parseQuickText(typed, ctx));
  };

  const switchMode = (m: CaptureMode) => {
    session.current?.stop();
    setListening(false);
    setError('');
    setPreview(null);
    setStage({ kind: 'input' });
    setMode(m);
  };

  const title = stage.kind === 'review' ? 'Tinjau transaksi' : mode === 'scan' ? 'Scan struk' : mode === 'voice' ? 'Catat pakai suara' : 'Ketik transaksi';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex max-h-[92dvh] min-h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-lg font-extrabold text-slate-900">{title}</p>
          <button type="button" onClick={close} aria-label="Tutup" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:text-slate-900"><X size={18} /></button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {stage.kind === 'review' ? (
              <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col">
                <ReviewForm
                  draft={stage.draft}
                  hint={stage.note}
                  accounts={accounts}
                  categories={[...new Set(ctx.categories.map((c) => c.category))]}
                  preview={preview}
                  onBack={() => switchMode(mode)}
                  onSaved={(label) => {
                    toast.success(`Tersimpan · ${label}`);
                    close();
                  }}
                  source={mode === 'scan' ? 'struk' : mode === 'voice' ? 'suara' : 'ketik'}
                />
              </motion.div>
            ) : stage.kind === 'thinking' ? (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                {preview && <img src={preview} alt="Struk" className="max-h-56 rounded-2xl object-contain shadow" />}
                <LeoMascot mood="watch" size={90} />
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 size={16} className="animate-spin" /> {stage.label}</p>
              </motion.div>
            ) : mode === 'scan' ? (
              <motion.div key="scan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col">
                <button
                  type="button"
                  onClick={() => camRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void onPhoto(e.dataTransfer.files?.[0]); }}
                  className="group flex flex-1 items-center justify-center rounded-[24px] bg-slate-100/80 p-8 transition-colors hover:bg-slate-100"
                >
                  <span className="flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-slate-300 transition-transform group-hover:scale-[1.02]">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"><Camera size={24} /></span>
                    <span className="text-xs font-semibold text-slate-500">Ketuk, atau seret foto ke sini</span>
                  </span>
                </button>
                <p className="mt-3 text-center text-xs text-slate-500">AI membaca nama toko, total, dan tanggal. Kamu meninjau semuanya sebelum disimpan.</p>
                {error && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-600">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => galRef.current?.click()} aria-label="Pilih dari galeri" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><ImageIcon size={18} /></button>
                  <button type="button" onClick={() => camRef.current?.click()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"><Camera size={16} /> Ambil foto</button>
                </div>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
                <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              </motion.div>
            ) : mode === 'voice' ? (
              <motion.div key="voice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-base font-bold text-slate-900">Sebutkan saja pengeluaranmu.</p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">Contoh: “kopi 28 ribu tunai, parkir 5 ribu pakai GoPay”.</p>
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!canSpeak}
                  aria-label={listening ? 'Berhenti merekam' : 'Mulai merekam'}
                  className={cn('relative mt-8 flex h-28 w-28 items-center justify-center rounded-full text-white shadow-xl transition-colors disabled:opacity-40', listening ? 'bg-rose-500' : 'bg-slate-900 hover:bg-slate-800')}
                >
                  {listening && [0, 1].map((i) => (
                    <motion.span key={i} className="absolute inset-0 rounded-full bg-rose-400" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8 }} />
                  ))}
                  <span className="relative">{listening ? <Square size={30} fill="currentColor" /> : <Mic size={36} />}</span>
                </button>
                <p className="mt-6 min-h-[48px] max-w-sm text-lg font-semibold text-slate-800">{spoken || (listening ? 'Mendengarkan…' : canSpeak ? 'Ketuk lingkaran, lalu bicara' : 'Browser ini belum mendukung input suara')}</p>
                {error && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
              </motion.div>
            ) : (
              <motion.div key="text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col">
                <p className="text-sm text-slate-500">Tulis satu kalimat, mis. “makan siang 35rb pakai BCA”.</p>
                <textarea
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fromText(); } }}
                  rows={4}
                  placeholder="bensin 50rb, kopi 25 ribu gopay…"
                  className="mt-3 w-full flex-1 resize-none rounded-2xl bg-slate-50 px-4 py-3 text-base outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-indigo-300"
                />
                <button type="button" onClick={fromText} disabled={!typed.trim()} className="mt-4 h-12 rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40">Lanjut</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {stage.kind === 'input' && (
          <div className="flex justify-center gap-1 border-t border-slate-100 px-5 py-3">
            {([['scan', 'Struk', ScanLine], ['voice', 'Suara', Mic], ['text', 'Ketik', Keyboard]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" onClick={() => switchMode(m)} className={cn('flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors', mode === m ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ReviewForm({ draft, hint, accounts, categories, preview, onBack, onSaved, source }: {
  draft: QuickDraft;
  hint?: string;
  accounts: Account[];
  categories: string[];
  preview: string | null;
  onBack: () => void;
  onSaved: (label: string) => void;
  source: 'struk' | 'suara' | 'ketik';
}) {
  const { toast } = useFeedback();
  const fallback = useMemo(() => accounts.find((a) => !isCreditAccountType(a.type))?.id ?? accounts[0]?.id ?? '', [accounts]);
  const [type, setType] = useState<'pengeluaran' | 'pemasukan'>(draft.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const [amount, setAmount] = useState(draft.amount ? String(Math.round(draft.amount)) : '');
  const [category, setCategory] = useState(draft.category ?? '');
  const [accountId, setAccountId] = useState(draft.accountId ?? '');
  const [note, setNote] = useState(draft.note ?? '');
  const [date, setDate] = useState(draft.date ?? '');
  const [saving, setSaving] = useState(false);
  const num = Number(amount.replace(/\D/g, '')) || 0;
  const acc = accountId || fallback;

  const save = async () => {
    if (!num || !acc || !category.trim()) return toast.error('Lengkapi nominal, kategori, dan rekening.');
    setSaving(true);
    try {
      const r = await quickTxService.create({ type, amount: num, accountId: acc, category: category.trim(), subCategory: draft.subCategory, note: note.trim(), ...(date ? { date } : {}), source });
      onSaved(`${note.trim() || category} ${formatIDR(num)} · ${r.matchedAccount}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-indigo-300';
  return (
    <div className="flex flex-1 flex-col gap-3">
      {hint && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{hint}</p>}
      {preview && <img src={preview} alt="Struk" className="mx-auto max-h-32 rounded-xl object-contain" />}
      <div className="flex rounded-full bg-slate-100 p-1">
        {(['pengeluaran', 'pemasukan'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={cn('flex-1 rounded-full py-2 text-[13px] font-bold transition-colors', type === t ? (t === 'pengeluaran' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white') : 'text-slate-500')}>
            {t === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan'}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 focus-within:bg-white focus-within:ring-indigo-300">
        <span className="text-sm font-bold text-slate-400">Rp</span>
        <input inputMode="numeric" value={num ? num.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="Nominal" className="w-full bg-transparent text-2xl font-extrabold text-slate-900 outline-none tabular-nums" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block pl-1 text-xs font-semibold text-slate-500">Kategori</span>
          <input list="qc-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Makanan" className={field} />
          <datalist id="qc-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>
          <span className="mb-1 block pl-1 text-xs font-semibold text-slate-500">Rekening</span>
          <select value={acc} onChange={(e) => setAccountId(e.target.value)} className={field}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <label>
        <span className="mb-1 block pl-1 text-xs font-semibold text-slate-500">Catatan</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nama toko / keterangan" className={field} />
      </label>
      <label>
        <span className="mb-1 block pl-1 text-xs font-semibold text-slate-500">Tanggal <span className="font-normal text-slate-400">(kosong = hari ini)</span></span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      {category && <p className="pl-1 text-xs text-slate-400">{categoryEmoji(category)} {category}</p>}
      <div className="mt-auto flex gap-2 pt-2">
        <button type="button" onClick={onBack} className="h-12 rounded-full bg-slate-100 px-5 text-sm font-bold text-slate-700 hover:bg-slate-200">Ulangi</button>
        <button type="button" onClick={save} disabled={saving} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          <Check size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
