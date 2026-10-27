"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, ChevronRight } from 'lucide-react';

// Banner di Ringkasan (web) & Beranda (HP): hanya muncul kalau ada usulan
// transaksi (email/Slack) yang menunggu ditinjau. Gagal/fitur belum aktif =
// diam (tidak tampil).
export function InboxBanner({ href = '/membership/kotak-masuk' }: { href?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/member/inbox', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: unknown[] } | null) => { if (active) setCount(d?.items?.length ?? 0); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!count) return null;
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[22px] bg-rose-50 px-4 py-3.5 ring-1 ring-rose-100 transition-colors hover:bg-rose-100/70 dark:bg-rose-500/10 dark:ring-rose-500/20">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 ring-1 ring-rose-100 dark:bg-slate-900 dark:ring-rose-500/20"><Inbox size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">{count} usulan transaksi menunggu</span>
        <span className="block text-[13px] text-slate-500 dark:text-slate-400">Tinjau di Kotak Masuk sebelum tercatat.</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </Link>
  );
}
