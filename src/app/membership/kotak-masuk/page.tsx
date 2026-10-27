"use client";

import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { InboxControls, useInbox } from '@/components/inbox/InboxControls';
import { InboxItemCard } from '@/components/inbox/InboxItemCard';

// Kotak Masuk (web): usulan transaksi dari email pembayaran & pesan Slack.

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
            <p className="max-w-sm text-[14px] text-slate-500">Usulan baru muncul di sini setelah Leosiqra membaca email pembayaran atau pesan Slack (otomatis, atau tekan Periksa sekarang).</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => <InboxItemCard key={item.id} item={item} accounts={accounts} onDone={done} />)}
          </ul>
        )
      )}
    </div>
  );
}
