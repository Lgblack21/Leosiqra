"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, ChevronRight } from 'lucide-react';

// Banner di Ringkasan: hanya muncul kalau ada usulan transaksi dari email
// yang menunggu ditinjau. Gagal/fitur belum aktif = diam (tidak tampil).
export function InboxBanner() {
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
    <Link href="/membership/kotak-masuk" className="flex items-center gap-3 rounded-[22px] bg-rose-50 px-4 py-3.5 ring-1 ring-rose-100 transition-colors hover:bg-rose-100/70">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 ring-1 ring-rose-100"><Inbox size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-900">{count} usulan transaksi dari email</span>
        <span className="block text-[13px] text-slate-500">Tinjau di Kotak Masuk sebelum tercatat.</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </Link>
  );
}
