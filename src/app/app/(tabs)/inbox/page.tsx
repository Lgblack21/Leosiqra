"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { FadeIn } from "@/components/app/FadeIn";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { InboxControls, useInbox } from "@/components/inbox/InboxControls";
import { InboxItemCard } from "@/components/inbox/InboxItemCard";

// Kotak Masuk versi HP: usulan transaksi dari email pembayaran & pesan
// Slack — sama dengan /membership/kotak-masuk (data & endpoint yang sama).
// Layout /app tidak memasang FeedbackProvider — halaman ini membawanya sendiri.
function AppInbox() {
  const inbox = useInbox();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const load = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    load();
    return subscribeToCollectionChanges("accounts", load);
  }, []);

  const items = inbox.data?.items ?? [];
  const done = (id: string) => inbox.setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));

  return (
    <div className="max-w-md md:max-w-2xl mx-auto px-5 md:px-8 pt-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Kotak Masuk</h1>
      </FadeIn>
      <p className="text-[13px] text-slate-500 dark:text-slate-400">Usulan transaksi dari email & Slack. Tidak ada yang tercatat sebelum kamu menekan Simpan.</p>

      <InboxControls inbox={inbox} />

      {inbox.data && (
        items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[22px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-6 py-10 text-center">
            <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">Kotak Masuk kosong</p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Usulan baru muncul di sini setelah email atau pesan Slack dibaca.</p>
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

export default function AppInboxPage() {
  return (
    <FeedbackProvider>
      <AppInbox />
    </FeedbackProvider>
  );
}
