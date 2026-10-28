"use client";

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Hash, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags, tagStyle, TAG_COLORS, TAG_COLOR_KEYS } from '@/lib/useTags';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { TagChip } from '@/components/tags/TagPicker';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Tag. Tag = label bebas di luar kategori (mis. liburan
// Bali, klien A) yang bisa dipasang ke transaksi lalu dipakai menyaring
// Riwayat. Mematikan tag hanya menyembunyikan pilihannya; label di transaksi tetap.

export function TagsView({ openHref }: { openHref: (href: string) => void }) {
  const { toast, confirm } = useFeedback();
  const { tags, save } = useTags();
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState(TAG_COLOR_KEYS[0]);
  const [busy, setBusy] = useState(false);
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    transactionService.getUserTransactions('session').then(setTxs).catch(() => setTxs([]));
  }, []);
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) for (const n of t.tags ?? []) m.set(n.toLowerCase(), (m.get(n.toLowerCase()) ?? 0) + 1);
    return m;
  }, [txs]);

  const run = async (next: typeof tags, ok?: string) => {
    setBusy(true);
    try {
      await save(next);
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan tag.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name) return;
    if (tags.list.some((t) => t.name.toLowerCase() === name.toLowerCase())) return toast.error('Tag itu sudah ada.');
    if (await run({ ...tags, list: [...tags.list, { name, color }] }, `#${name} ditambahkan.`)) {
      setDraft('');
      setColor(TAG_COLOR_KEYS[(TAG_COLOR_KEYS.indexOf(color) + 1) % TAG_COLOR_KEYS.length]);
    }
  };
  const recolor = (name: string) => {
    const cur = tags.list.find((t) => t.name === name)?.color ?? 'slate';
    const nextColor = TAG_COLOR_KEYS[(TAG_COLOR_KEYS.indexOf(cur) + 1) % TAG_COLOR_KEYS.length];
    void run({ ...tags, list: tags.list.map((t) => (t.name === name ? { ...t, color: nextColor } : t)) });
  };
  const remove = async (name: string) => {
    const n = usage.get(name.toLowerCase()) ?? 0;
    const ok = await confirm({
      title: `Hapus #${name}?`,
      message: n ? `${n} transaksi masih memakai label ini — labelnya tetap tersimpan di transaksi, hanya hilang dari daftar pilihan.` : 'Tag ini belum dipakai transaksi mana pun.',
      confirmLabel: 'Hapus tag',
      danger: true,
    });
    if (ok) void run({ ...tags, list: tags.list.filter((t) => t.name !== name) }, `#${name} dihapus.`);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void run({ ...tags, enabled: !tags.enabled }, tags.enabled ? 'Tag dimatikan — label lama tetap tersimpan.' : 'Tag aktif di form transaksi.')}
        disabled={busy}
        aria-pressed={tags.enabled}
        className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left transition', tags.enabled ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white' : 'bg-slate-50 ring-1 ring-slate-200')}
      >
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tags.enabled ? 'bg-white/20' : 'bg-white text-indigo-600')}><Hash size={22} strokeWidth={2.6} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">{tags.enabled ? 'Tag aktif' : 'Pakai tag'}</span>
          <span className={cn('block text-[13px]', tags.enabled ? 'text-white/80' : 'text-slate-500')}>Label bebas di luar kategori — mis. liburan Bali, klien A, kantor.</span>
        </span>
        <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', tags.enabled ? 'bg-white/35' : 'bg-slate-300')}>
          <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', tags.enabled ? 'left-6' : 'left-1')} />
        </span>
      </button>

      {!tags.enabled ? (
        <div className="rounded-[22px] border-2 border-dashed border-slate-200 p-5">
          <p className="text-[14px] font-semibold text-slate-800">Contoh pemakaian</p>
          <div className="mt-3 space-y-2">
            {[
              { t: 'Tiket pesawat', c: 'Transportasi', tags: [{ n: 'liburan bali', c: 'teal' }] },
              { t: 'Makan siang', c: 'Makanan & Minuman', tags: [{ n: 'klien A', c: 'violet' }, { n: 'reimburse', c: 'amber' }] },
            ].map((x) => (
              <div key={x.t} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-slate-900">{x.t}</span>
                  <span className="block text-[12px] text-slate-500">{x.c}</span>
                </span>
                <span className="flex flex-wrap justify-end gap-1">{x.tags.map((g) => <TagChip key={g.n} name={g.n} color={g.c} />)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-slate-500">Lalu saring Riwayat per tag untuk melihat total satu acara atau satu klien.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 24))}
                  onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
                  placeholder="nama tag, mis. liburan bali"
                  className="w-full rounded-full border border-slate-200 bg-white py-3 pl-9 pr-4 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <button type="button" onClick={() => void add()} disabled={!draft.trim() || busy} aria-label="Tambah tag" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:bg-slate-300">
                <Plus size={20} strokeWidth={2.6} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {TAG_COLOR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setColor(k)} aria-label={`Warna ${k}`} className={cn('h-6 w-6 rounded-full transition', TAG_COLORS[k].dot, color === k ? 'ring-2 ring-slate-900 ring-offset-2' : 'opacity-70 hover:opacity-100')} />
              ))}
            </div>
          </div>

          {tags.list.length === 0 ? (
            <p className="px-1 py-4 text-center text-[14px] text-slate-500">Belum ada tag. Buat yang pertama di atas, atau langsung dari form transaksi.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200/70">
              {tags.list.map((t) => {
                const n = usage.get(t.name.toLowerCase()) ?? 0;
                return (
                  <li key={t.name} className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => recolor(t.name)} aria-label={`Ganti warna ${t.name}`} title="Ketuk untuk ganti warna" className={cn('h-5 w-5 shrink-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-slate-200', tagStyle(t.color).dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-slate-900">#{t.name}</span>
                      <span className="block text-[12px] text-slate-500">{n ? `${n} transaksi` : 'Belum dipakai'}</span>
                    </span>
                    {n > 0 && (
                      <button type="button" onClick={() => openHref(`/membership/transactions/daily?tag=${encodeURIComponent(t.name)}`)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-50">
                        Lihat <ArrowRight size={13} />
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(t.name)} aria-label={`Hapus ${t.name}`} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-1 text-[12px] text-slate-500">Maks 5 tag per transaksi, 40 tag per akun. Ketuk titik warna untuk mengganti warnanya.</p>
        </>
      )}
    </div>
  );
}
