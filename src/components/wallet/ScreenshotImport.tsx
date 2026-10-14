"use client";

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImageIcon, Loader2, X } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { imageFileToBase64 } from '@/lib/quick/ai';
import { accountService, type Account } from '@/lib/services/accountService';
import { investmentService } from '@/lib/services/investmentService';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { useFeedback } from '@/components/ui/Feedback';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Impor screenshot (Kekayaan): Leo membaca saldo & aset dari screenshot
// aplikasi bank/e-wallet/sekuritas. Tiap baris ditinjau: perbarui saldo
// dompet yang sudah ada, tambah dompet baru, tambah investasi, atau lewati.
// Tidak ada yang tersimpan sebelum "Simpan".

type Item = { name: string; kind: string; amount: number; currency: string };
type Choice = { action: 'update' | 'wallet' | 'invest' | 'skip'; accountId?: string };
const KIND_LABEL: Record<string, string> = { bank: 'Bank', ewallet: 'E-wallet', saham: 'Saham', reksadana: 'Reksa dana', emas: 'Emas', kripto: 'Kripto', deposito: 'Deposito', lainnya: 'Lainnya' };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function ScreenshotImport({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const { toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [saving, setSaving] = useState(false);
  const wallets = accounts.filter((a) => a.type !== 'Credit Card');

  const guess = (it: Item): Choice => {
    if (it.kind === 'bank' || it.kind === 'ewallet') {
      const m = wallets.find((a) => norm(it.name).includes(norm(a.name)) || norm(a.name).includes(norm(it.name).slice(0, 4)));
      return m ? { action: 'update', accountId: m.id } : { action: 'wallet' };
    }
    return { action: 'invest' };
  };

  const read = async (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const r = await cloudflareApi<{ items: Item[] }>('/api/member/ai/parse-screenshot', { method: 'POST', json: { imageBase64: await imageFileToBase64(file, 1600, 0.85) } });
      setItems(r.items);
      setChoices(r.items.map(guess));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Screenshot tidak terbaca.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    let n = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const c = choices[i];
        if (c.action === 'update' && c.accountId) {
          await accountService.updateAccount(c.accountId, { balance: it.amount });
          n++;
        } else if (c.action === 'wallet') {
          const type = it.kind === 'ewallet' ? 'E-Wallet' : 'Bank Account';
          const logo = matchIndonesianInstitutionLogo(it.name, type);
          await accountService.createAccount({ userId: '', name: it.name, type, currency: it.currency, balance: it.amount, initialBalance: it.amount, baseValue: 0, creditLimit: 0, ...(logo ? { logoUrl: logo } : {}) });
          n++;
        } else if (c.action === 'invest') {
          await investmentService.createInvestment({
            userId: '', name: it.name, type: it.kind === 'saham' ? 'Saham' : it.kind === 'deposito' ? 'Deposito' : 'Lainnya', platform: 'Impor screenshot',
            amountInvested: it.amount, currentValue: it.amount, returnPercentage: 0, currency: it.currency, category: KIND_LABEL[it.kind], dateInvested: new Date(), status: 'Active',
          });
          n++;
        }
      }
      toast.success(`${n} data tersimpan ke Kekayaan`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sebagian gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Impor screenshot">
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-lg font-extrabold text-slate-900">Impor dari screenshot</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <AnimatePresence mode="wait">
            {!items ? (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 text-center">
                {busy ? (
                  <>
                    {preview && <img src={preview} alt="" className="max-h-56 rounded-2xl shadow" />}
                    <LeoMascot mood="watch" size={80} />
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 size={15} className="animate-spin" /> Leo membaca saldonya…</p>
                  </>
                ) : (
                  <>
                    <LeoMascot mood="idle" size={90} />
                    <p className="mt-2 font-bold text-slate-900">Screenshot halaman saldo atau portofolio</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">Dari aplikasi bank, e-wallet, sekuritas, atau kripto. Leo membaca nama & nilainya — kamu cek dulu sebelum disimpan. Gambar tidak disimpan.</p>
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-5 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"><ImageIcon size={16} /> Pilih screenshot</button>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
              </motion.div>
            ) : (
              <motion.ul key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                {items.map((it, i) => (
                  <li key={i} className="rounded-2xl bg-slate-50 p-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0"><span className="block truncate font-bold text-slate-900">{it.name}</span><span className="text-xs text-slate-500">{KIND_LABEL[it.kind]}</span></span>
                      <span className="shrink-0 font-extrabold text-slate-900 tabular-nums">{formatMoney(it.amount, it.currency)}</span>
                    </div>
                    <select
                      aria-label={`Simpan ${it.name} sebagai`}
                      value={choices[i].action === 'update' ? `u:${choices[i].accountId}` : choices[i].action}
                      onChange={(e) => {
                        const v = e.target.value;
                        setChoices((cur) => cur.map((c, j) => (j !== i ? c : v.startsWith('u:') ? { action: 'update', accountId: v.slice(2) } : { action: v as Choice['action'] })));
                      }}
                      className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                    >
                      {wallets.map((a) => <option key={a.id} value={`u:${a.id}`}>Perbarui saldo {a.name} ({formatMoney(a.balance, a.currency)})</option>)}
                      <option value="wallet">Tambah sebagai dompet baru</option>
                      <option value="invest">Tambah sebagai investasi</option>
                      <option value="skip">Lewati</option>
                    </select>
                  </li>
                ))}
                <p className="pt-1 text-xs text-slate-500">“Perbarui saldo” mengganti saldo dompet itu langsung (tanpa transaksi). Cek angkanya dulu ya.</p>
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        {items && (
          <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
            <button type="button" onClick={() => { setItems(null); setPreview(null); }} className="h-12 rounded-full bg-slate-100 px-5 text-sm font-bold text-slate-700">Ulangi</button>
            <button type="button" onClick={save} disabled={saving || choices.every((c) => c.action === 'skip')} className={cn('flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-bold text-white disabled:opacity-50')}>
              <Check size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
