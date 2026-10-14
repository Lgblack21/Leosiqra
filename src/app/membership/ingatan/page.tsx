"use client";

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Sparkles, Trash2, User } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Skeleton } from '@/components/ui/Skeleton';

// Ingatan Leo: hal-hal yang Leo ingat tentangmu untuk obrolan berikutnya.
// Leo menambah sendiri dari obrolan (ikon ✨), kamu bisa menambah & menghapus.

type Memory = { id: string; fact: string; source: 'ai' | 'user'; created_at: string };

export default function IngatanPage() {
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<Memory[] | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');

  const load = useCallback(() => {
    cloudflareApi<{ items: Memory[] }>('/api/member/memories').then((r) => setItems(r.items)).catch((e) => { setItems([]); setError(e instanceof Error ? e.message : 'Gagal memuat.'); });
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    if (!text.trim()) return;
    try {
      await cloudflareApi('/api/member/memories', { method: 'POST', json: { fact: text } });
      setText('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
  };
  const remove = async (m: Memory) => {
    setItems((cur) => cur?.filter((x) => x.id !== m.id) ?? cur);
    await cloudflareApi(`/api/member/memories/${m.id}`, { method: 'DELETE' }).catch(() => load());
  };
  const clearAll = async () => {
    if (!(await confirm({ title: 'Hapus semua ingatan Leo?', message: 'Leo akan mulai dari nol lagi.', confirmLabel: 'Hapus semua', danger: true }))) return;
    await cloudflareApi('/api/member/memories/semua', { method: 'DELETE' }).catch(() => {});
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div className="flex items-center gap-4 rounded-[24px] bg-slate-100/70 p-5">
        <LeoMascot mood="happy" size={72} />
        <div>
          <p className="font-bold text-slate-900">Yang Leo ingat tentangmu</p>
          <p className="text-sm text-slate-500">Dipakai supaya jawaban Leo makin pas. Leo menambah sendiri dari obrolan — hapus kapan saja. Data sensitif (PIN, password, nomor rekening) tidak pernah disimpan.</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder="mis. Gajian tiap tanggal 25, lagi nabung buat DP rumah" aria-label="Ingatan baru" className="min-w-0 flex-1 rounded-full bg-slate-100 px-5 py-3 text-[15px] outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300" />
        <button type="submit" disabled={!text.trim()} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-40"><Plus size={15} /> Tambah</button>
      </form>

      {error && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {items === null ? <Skeleton className="h-40 rounded-3xl" /> : items.length === 0 ? (
        <p className="rounded-[24px] bg-slate-100/70 p-6 text-center text-sm text-slate-500">Leo belum mengingat apa pun. Ngobrol saja seperti biasa — misalnya ceritakan tanggal gajian atau target tabunganmu.</p>
      ) : (
        <>
          <ul className="overflow-hidden rounded-[24px] bg-slate-100/70">
            <AnimatePresence initial={false}>
              {items.map((m) => (
                <motion.li key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 border-b border-slate-200/60 px-4 py-3.5 last:border-0">
                  <span className={m.source === 'ai' ? 'text-violet-500' : 'text-slate-400'} title={m.source === 'ai' ? 'Dicatat Leo dari obrolan' : 'Kamu yang menambahkan'}>{m.source === 'ai' ? <Sparkles size={16} /> : <User size={16} />}</span>
                  <span className="min-w-0 flex-1 text-[15px] text-slate-800">{m.fact}</span>
                  <span className="hidden text-xs text-slate-400 sm:block">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(m.created_at))}</span>
                  <button type="button" onClick={() => remove(m)} aria-label={`Hapus ${m.fact}`} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button type="button" onClick={clearAll} className="text-sm font-semibold text-rose-500 hover:underline">Hapus semua ingatan</button>
        </>
      )}
    </div>
  );
}
