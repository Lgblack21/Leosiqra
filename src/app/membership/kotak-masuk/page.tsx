"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardPaste, Inbox, Smartphone, Trash2 } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { inboxService, type InboxDraft } from '@/lib/services/connectService';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { quickTxService } from '@/lib/services/quickTxService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { useQuickContext } from '@/lib/quick/useQuickContext';
import { parseQuickText, type ParseContext } from '@/lib/quick/parse';
import { isCreditAccountType } from '@/lib/creditCard';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Kotak masuk: draf transaksi dari Shortcuts (iPhone/Android) atau teks yang
// ditempel (SMS / notifikasi bank). Tidak ada yang tersimpan sebagai transaksi
// sampai user menekan "Simpan" di tiap draf.

export default function KotakMasukPage() {
  const { toast } = useFeedback();
  const [uid, setUid] = useState('');
  const [drafts, setDrafts] = useState<InboxDraft[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const { ctx } = useQuickContext(uid, accounts, transactions);

  const load = useCallback(() => {
    inboxService
      .list()
      .then((d) => {
        setDrafts(d);
        setUnavailable(false);
      })
      .catch(() => {
        setDrafts([]);
        setUnavailable(true);
      });
  }, []);

  useEffect(() => {
    load();
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me').then((r) => setUid(r.user?.id ?? '')).catch(() => {});
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
    return subscribeToCollectionChanges('inbox', load);
  }, [load]);

  const addPaste = async () => {
    if (!paste.trim()) return;
    setBusy(true);
    try {
      const n = await inboxService.paste(paste);
      setPaste('');
      toast.success(`${n} draf masuk. Tinjau lalu simpan.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah draf.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <div>
        <h1 className="sr-only">Kotak masuk</h1>
        <p className="mt-0.5 text-sm text-slate-500">Draf dari Shortcuts dan teks yang kamu tempel. Tidak ada yang tersimpan sampai kamu menyimpannya.</p>
      </div>

      {unavailable ? (
        <div className="rounded-[24px] border border-slate-100 bg-white p-8 text-center">
          <LeoMascot mood="sad" size={100} className="mx-auto" />
          <p className="mt-3 font-bold text-slate-900">Kotak masuk belum aktif</p>
        </div>
      ) : (
        <>
          <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
            <p className="flex items-center gap-2 font-bold text-slate-900"><ClipboardPaste size={17} className="text-indigo-600" /> Tempel SMS / notifikasi bank</p>
            <p className="mb-3 text-sm text-slate-500">Satu transaksi per baris. Mis. “Transaksi QRIS Rp 35.000 di KOPI KENANGAN” atau “parkir 5rb”.</p>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={3}
              maxLength={6000}
              placeholder={'kopi 28rb gopay\nbensin 50 ribu\nTransfer masuk Rp 750.000 dari BUDI'}
              className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Link href="/membership/aplikasi-terhubung" className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
                <Smartphone size={14} /> Kirim langsung dari HP lewat Shortcuts
              </Link>
              <button type="button" onClick={addPaste} disabled={busy || !paste.trim()} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                {busy ? 'Menambah…' : 'Masukkan ke kotak'}
              </button>
            </div>
          </div>

          {drafts === null ? (
            <div className="h-32 animate-pulse rounded-[24px] bg-white" />
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center rounded-[26px] border border-slate-100 bg-white p-10 text-center">
              <Inbox size={28} className="text-slate-300" />
              <p className="mt-2 font-bold text-slate-900">Kotak masuk kosong</p>
              <p className="mt-1 text-sm text-slate-500">Tempel teks di atas, atau atur Shortcuts supaya draf masuk sendiri.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-500">{drafts.length} draf menunggu ditinjau</p>
              {drafts.map((d) => (
                <DraftCard key={`${d.id}-${ctx.categories.length}-${accounts.length}`} draft={d} ctx={ctx} accounts={accounts} onDone={load} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DraftCard({ draft, ctx, accounts, onDone }: { draft: InboxDraft; ctx: ParseContext; accounts: Account[]; onDone: () => void }) {
  const { toast } = useFeedback();
  const parsed = useMemo(() => parseQuickText(draft.raw_text, ctx), [draft.raw_text, ctx]);
  const fallbackAccount = accounts.find((a) => !isCreditAccountType(a.type))?.id ?? accounts[0]?.id ?? '';
  const [type, setType] = useState<'pengeluaran' | 'pemasukan'>(parsed.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const [amount, setAmount] = useState(parsed.amount ? String(parsed.amount) : '');
  // Pemasukan tanpa kategori (mis. "Transfer masuk …") diberi kategori umum supaya bisa langsung disimpan.
  const [category, setCategory] = useState(parsed.category ?? (parsed.type === 'pemasukan' ? 'Pemasukan Lain' : ''));
  const [accountId, setAccountId] = useState(parsed.accountId ?? fallbackAccount);
  const [busy, setBusy] = useState(false);
  const categories = useMemo(() => [...new Set([...ctx.categories.map((c) => c.category), ...(parsed.category ? [parsed.category] : [])])].filter(Boolean), [ctx.categories, parsed.category]);
  const num = Number(amount.replace(/\D/g, '')) || 0;

  const save = async () => {
    if (!num || !accountId || !category.trim()) return toast.error('Lengkapi nominal, kategori, dan rekening.');
    setBusy(true);
    try {
      await quickTxService.create({ type, amount: num, accountId, category, subCategory: parsed.subCategory, note: parsed.note || draft.raw_text.slice(0, 120), date: parsed.date });
      await inboxService.remove(draft.id);
      toast.success('Tersimpan jadi transaksi.');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    setBusy(true);
    try {
      await inboxService.remove(draft.id);
      onDone();
    } catch {
      toast.error('Gagal membuang draf.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white';
  return (
    <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-700">“{draft.raw_text}”</p>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
          {draft.source === 'shortcut' ? 'Shortcuts' : 'Tempel'} · {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(draft.created_at))}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-slate-100 p-0.5">
          {(['pengeluaran', 'pemasukan'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold', type === t ? (t === 'pengeluaran' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white') : 'text-slate-500')}>
              {t === 'pengeluaran' ? 'Keluar' : 'Masuk'}
            </button>
          ))}
        </div>
        <input inputMode="numeric" value={num ? num.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="Nominal" aria-label="Nominal" className={cn(field, 'w-32 font-bold')} />
        <input list={`cat-${draft.id}`} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategori" aria-label="Kategori" className={cn(field, 'w-36')} />
        <datalist id={`cat-${draft.id}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Rekening" className={cn(field, 'w-36')}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={discard} disabled={busy} aria-label="Buang draf" className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={16} /></button>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Check size={14} /> Simpan {num ? formatIDR(num) : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
