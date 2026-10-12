"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, MessageCircle, Pencil, Sparkles, Store, Tag } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { itemService, type Item } from '@/lib/services/itemService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Cuan: bantu nambah pemasukan dari yang sudah kamu punya —
// jual barang nganggur, tagih piutang dengan sopan, dan minta ide dari Leo.
// "Cuan bulan ini" = pemasukan di luar gaji. Target disimpan per perangkat.

const TARGET_KEY = 'leo-cuan-target:v1';
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const fmtDate = (d: Date | string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

export default function CuanPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [target, setTarget] = useState(() => {
    if (typeof window === 'undefined') return 1_000_000;
    try {
      return Number(localStorage.getItem(TARGET_KEY)) || 1_000_000;
    } catch {
      return 1_000_000;
    }
  });
  const [editTarget, setEditTarget] = useState(false);
  const [skill, setSkill] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setTransactions).catch(() => setTransactions([]));
    const loadItems = () => itemService.list('barang').then(setItems).catch(() => setItems([]));
    load();
    loadItems();
    const a = subscribeToCollectionChanges('transactions', load);
    const b = subscribeToCollectionChanges('items', loadItems);
    return () => {
      a();
      b();
    };
  }, []);

  const saveTarget = (v: number) => {
    setTarget(v);
    try {
      localStorage.setItem(TARGET_KEY, String(v));
    } catch {
      /* storage diblokir */
    }
  };

  const now = new Date();
  const cuan = useMemo(() => {
    const list = (transactions ?? []).filter((t) => {
      const d = new Date(t.date);
      return t.type === 'pemasukan' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && !/gaji|salary/i.test(t.category || '');
    });
    return { total: list.reduce((s, t) => s + toIdr(t), 0), list };
    // `now` hanya tanggal hari ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const piutang = (transactions ?? []).filter((t) => t.type === 'debt' && t.category === 'Piutang' && t.paymentStatus !== 'lunas');
  const forSale = items.filter((i) => i.for_sale === 1);
  const idle = items.filter((i) => i.for_sale !== 1 && i.current_value > 0).slice(0, 3);
  const pct = target > 0 ? Math.min(100, (cuan.total / target) * 100) : 0;

  const copyAd = async (i: Item) => {
    const text = `Dijual: ${i.name}${i.category ? ` (${i.category})` : ''}\n${i.note ? `${i.note}\n` : ''}Harga: ${formatIDR(i.current_value)} (bisa nego)\nMinat? Chat aja ya 🙏`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error('Gagal menyalin. Coba lagi.');
    }
  };

  const waLink = (t: Transaction) => {
    const name = t.lenderName?.trim() || 'kamu';
    const msg = `Halo ${name} 👋\nMau ngingetin soal pinjaman ${formatIDR(toIdr(t))} tanggal ${fmtDate(t.date)}${t.note ? ` (${t.note})` : ''}. Kalau sudah ada rezekinya, boleh ditransfer ya. Makasih banyak! 🙏`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const askIdeas = () => {
    const q = `Kasih aku 5 ide cuan sampingan yang realistis dari keahlianku: ${skill.trim()}. Sertakan perkiraan modal, cara mulai minggu ini, dan kisaran harga jasanya.`;
    router.push(`/membership/ai-leosiqra?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      {/* Cuan bulan ini */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white shadow-xl shadow-emerald-600/20 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/85">Cuan bulan ini</p>
            <p className="text-[38px] font-extrabold leading-tight tracking-tight tabular-nums">{transactions === null ? '…' : formatIDR(cuan.total)}</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/85">
              {editTarget ? (
                <input
                  autoFocus
                  inputMode="numeric"
                  defaultValue={target.toLocaleString('id-ID')}
                  onBlur={(e) => {
                    saveTarget(Number(e.target.value.replace(/\D/g, '')) || target);
                    setEditTarget(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="w-36 rounded-xl bg-white/20 px-2 py-1 font-bold text-white outline-none"
                />
              ) : (
                <>
                  dari target <b>{formatIDR(target)}</b>
                  <button type="button" onClick={() => setEditTarget(true)} aria-label="Ubah target" className="rounded-lg p-1 hover:bg-white/15"><Pencil size={13} /></button>
                </>
              )}
            </div>
            <div className="mt-3 h-2.5 max-w-sm overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/75">Pemasukan di luar gaji: freelance, jualan, bonus, dan lainnya.</p>
          </div>
          <LeoMascot mood={pct >= 100 ? 'happy' : 'idle'} size={130} interactive className="hidden shrink-0 sm:block" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Jual barang */}
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
          <p className="flex items-center gap-2 font-bold text-slate-900"><Tag size={17} className="text-violet-600" /> Jual barang</p>
          <p className="mb-3 text-sm text-slate-500">Barang nganggur jadi uang. Tandai “mau dijual” di halaman Barang.</p>
          {forSale.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Belum ada barang yang mau dijual.
              {idle.length > 0 && (
                <p className="mt-1">
                  Mungkin: {idle.map((i) => `${i.name} (±${formatIDR(i.current_value)})`).join(', ')}.
                </p>
              )}
              <Link href="/membership/barang" className="mt-2 inline-block font-bold text-indigo-600 hover:underline">Buka Barang →</Link>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">Potensi {formatIDR(forSale.reduce((s, i) => s + i.current_value, 0))}</p>
              <ul className="space-y-2">
                {forSale.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{i.name}</span>
                      <span className="text-xs text-slate-400">{formatIDR(i.current_value)}</span>
                    </span>
                    <button type="button" onClick={() => copyAd(i)} className="flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-violet-600 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50">
                      {copied === i.id ? <><Check size={12} /> Tersalin</> : <><Copy size={12} /> Salin teks iklan</>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Tagih */}
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
          <p className="flex items-center gap-2 font-bold text-slate-900"><MessageCircle size={17} className="text-emerald-600" /> Tagih</p>
          <p className="mb-3 text-sm text-slate-500">Ingatkan teman dengan sopan lewat WhatsApp.</p>
          {piutang.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Tidak ada piutang yang belum lunas. 🎉
              <Link href="/membership/transactions/debt" className="mt-2 block font-bold text-indigo-600 hover:underline">Catat piutang →</Link>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">Total {formatIDR(piutang.reduce((s, t) => s + toIdr(t), 0))}</p>
              <ul className="space-y-2">
                {piutang.map((t, idx) => (
                  <li key={t.id || idx} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{t.lenderName || 'Tanpa nama'}</span>
                      <span className="text-xs text-slate-400">{formatIDR(toIdr(t))} · {fmtDate(t.date)}</span>
                    </span>
                    <a href={waLink(t)} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">
                      <MessageCircle size={12} /> Ingatkan
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">WhatsApp terbuka dengan pesan siap kirim — kamu pilih kontaknya sendiri.</p>
            </>
          )}
        </div>
      </div>

      {/* Ide cuan */}
      <div className="rounded-[26px] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 md:p-6">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Store size={17} className="text-indigo-600" /> Ide cuan dari keahlianmu</p>
        <p className="mb-3 text-sm text-slate-500">Tulis yang kamu bisa — desain, masak, ngajar, edit video — Leo kasih ide yang bisa dimulai minggu ini.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (skill.trim()) askIdeas();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={120} placeholder="Mis. desain grafis dan bisa bahasa Inggris" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400" />
          <button type="submit" disabled={!skill.trim()} className={cn('inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50')}>
            <Sparkles size={15} /> Minta ide ke Leo
          </button>
        </form>
      </div>

      {cuan.list.length > 0 && (
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="mb-2 font-bold text-slate-900">Cuan yang masuk bulan ini</p>
          <ul className="divide-y divide-slate-100">
            {cuan.list.map((t, i) => (
              <li key={t.id || i} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-700">{t.note || t.category} <span className="text-slate-400">· {t.category}</span></span>
                <span className="font-extrabold text-emerald-600 tabular-nums">+{formatIDR(toIdr(t))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
