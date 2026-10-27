"use client";

import { useEffect, useState } from 'react';
import { Inbox, Mail, Hash, Sparkles, Check, X, ChevronDown, Loader2 } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService, type Account } from '@/lib/services/accountService';
import { quickTxService } from '@/lib/services/quickTxService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { CategorySelect } from '@/components/CategorySelect';
import { NumberInput } from '@/components/ui/NumberInput';
import { TxTypeToggle, type TxType } from '@/components/app/TxTypeToggle';
import { AccountPicker } from '@/components/app/AccountPicker';
import { useFeedback } from '@/components/ui/Feedback';
import { InboxControls, useInbox, type InboxItem } from '@/components/inbox/InboxControls';

// Kotak Masuk: usulan transaksi dari email pembayaran. Tidak ada yang
// tercatat sebelum user menekan Simpan — mencegah transaksi dobel dengan
// catatan manual. Simpan = kunci usulan di server dulu (sekali saja), baru
// buat transaksi; gagal membuat → kunci dilepas lagi.

const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const senderName = (s: string | null) => (s ?? '').replace(/<[^>]*>/g, '').replace(/"/g, '').trim() || 'Email';

function ItemCard({ item, accounts, onDone }: { item: InboxItem; accounts: Account[]; onDone: (id: string) => void }) {
  const { toast } = useFeedback();
  const s = item.suggestion;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>(s?.type ?? 'pengeluaran');
  const [amount, setAmount] = useState(s?.amount ? String(s.amount) : '');
  const [accountId, setAccountId] = useState(s?.account_id && accounts.some((a) => a.id === s.account_id) ? s.account_id : accounts[0]?.id ?? '');
  const [category, setCategory] = useState(s?.category ?? '');
  const [subCategory, setSubCategory] = useState(s?.sub_category ?? '');
  const [note, setNote] = useState(s?.note ?? item.title ?? '');
  const [busy, setBusy] = useState(false);
  const fromSlack = item.source === 'slack';
  const SourceIcon = fromSlack ? Hash : Mail;

  useEffect(() => {
    // Rekening dimuat setelah kartu dibuat → pilih default saat sudah ada.
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const amountNumber = Number(amount || '0');
  const canSave = amountNumber > 0 && Boolean(account) && category.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave || !account) return;
    setBusy(true);
    try {
      await cloudflareApi(`/api/member/inbox/${item.id}/claim`, { method: 'POST' });
      try {
        const res = await quickTxService.create({
          type,
          amount: amountNumber,
          accountId: account.id ?? '',
          category,
          subCategory,
          note,
          ...(s?.date ? { date: s.date } : {}),
        });
        await cloudflareApi(`/api/member/inbox/${item.id}/link`, { method: 'POST', json: { transactionId: res.id } }).catch(() => undefined);
        toast.success('Transaksi disimpan.');
        onDone(item.id);
      } catch (e) {
        await cloudflareApi(`/api/member/inbox/${item.id}/release`, { method: 'POST' }).catch(() => undefined);
        throw e;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const ignore = async () => {
    setBusy(true);
    try {
      await cloudflareApi(`/api/member/inbox/${item.id}/ignore`, { method: 'POST' });
      onDone(item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengabaikan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-[22px] bg-white ring-1 ring-slate-100">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-4 p-4 text-left">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', s?.type === 'pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
          <SourceIcon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-slate-900">{s?.note || item.title || (fromSlack ? 'Pesan Slack' : 'Email pembayaran')}</span>
          <span className="block truncate text-[13px] text-slate-500">{senderName(item.sender)} · {shortDate(item.receivedAt)}</span>
        </span>
        <span className="text-right">
          <span className={cn('block whitespace-nowrap text-[15px] font-bold tabular-nums', s?.type === 'pemasukan' ? 'text-emerald-600' : 'text-slate-900')}>
            {s ? `${s.type === 'pemasukan' ? '+' : '−'}${formatMoney(s.amount, account?.currency)}` : '—'}
          </span>
          <span className="block text-[12px] text-slate-400">{s?.category ?? 'Belum ada kategori'}</span>
        </span>
        <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          {s && (
            <p className={cn('flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold', s.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' : s.confidence === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>
              <Sparkles size={14} /> Usulan AI dari {fromSlack ? 'pesan Slack' : 'email'} “{item.title ?? 'tanpa subjek'}” — periksa dulu sebelum disimpan.
            </p>
          )}
          <TxTypeToggle value={type} onChange={setType} />
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[12px] font-semibold text-slate-500">Nominal {account ? `(${account.currency})` : ''}</p>
            <NumberInput value={amount} onChange={setAmount} placeholder="0" className="mt-1 w-full bg-transparent text-[28px] font-bold tabular-nums text-slate-900 outline-none" />
          </div>
          <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} />
          <CategorySelect label="Kategori" value={category} type={type === 'pengeluaran' ? 'expense' : 'income'} onChange={setCategory} onSubCategoryChange={setSubCategory} subValue={subCategory} showBadge={false} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan" className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-[15px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400" />
          {s?.date && <p className="px-1 text-[13px] text-slate-500">Tanggal transaksi: {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s.date}T00:00:00`))}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={ignore} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-[14px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">
              <X size={16} /> Abaikan
            </button>
            <button type="button" onClick={save} disabled={!canSave} className="flex items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function KotakMasukPage() {
  const inbox = useInbox();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const load = () => accountService.getUserAccounts('').then(setAccounts).catch(() => setAccounts([]));
    load();
    return subscribeToCollectionChanges('accounts', load);
  }, []);

  const items = inbox.data?.items ?? [];
  const done = (id: string) => inbox.setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[38px]">Kotak Masuk</h1>
        <p className="mt-1 text-[15px] text-slate-500">Usulan transaksi dari email pembayaran & pesan Slack-mu. Simpan yang benar, abaikan sisanya — tidak ada yang tercatat tanpa persetujuanmu.</p>
      </div>

      <InboxControls inbox={inbox} />

      {inbox.data && (
        items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[24px] bg-white px-6 py-12 text-center ring-1 ring-slate-100">
            <Inbox size={32} className="text-slate-300" />
            <p className="text-[16px] font-semibold text-slate-700">Kotak Masuk kosong</p>
            <p className="max-w-sm text-[14px] text-slate-500">Usulan baru muncul di sini setelah Leosiqra membaca email pembayaran atau pesan Slack (otomatis, atau tekan Periksa email sekarang).</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => <ItemCard key={item.id} item={item} accounts={accounts} onDone={done} />)}
          </ul>
        )
      )}
    </div>
  );
}
