"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, PencilLine, Plus, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LogoImage } from '@/components/ui/LogoImage';
import { useFeedback } from '@/components/ui/Feedback';
import { accountService, type Account } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import { institutionDomain, matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { cn, formatMoney } from '@/lib/utils';

// Pemilih "Tambah akun" di halaman Kekayaan: cari / saring, ketuk satu →
// form Rekening (AccountModal) terbuka dengan nama, jenis & logo terisi.
// Investasi & kripto sengaja tidak di sini — dicatat di Investasiku, bukan
// sebagai rekening. Kalau bank itu SUDAH ada di rekening user: layar "tautkan"
// (atur fungsi belanja/nabung + pasang logo) atau tetap tambah rekening lain
// di bank yang sama.

export type AccountPick = { name: string; type: string; logoUrl?: string; purpose?: Purpose } | 'kartu' | 'manual';
type Purpose = 'belanja' | 'nabung';
type Item = { name: string; type: 'Bank Account' | 'E-Wallet' | 'Cash'; emoji?: string; hint?: string };

const BANKS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'BTN', 'CIMB Niaga', 'Permata', 'Danamon', 'OCBC', 'Bank Jago', 'Jenius', 'SeaBank', 'blu', 'Allo Bank', 'Krom', 'Maybank', 'DBS', 'UOB', 'HSBC', 'Citibank', 'Standard Chartered', 'Bank Mega', 'Sinarmas', 'Panin', 'BJB'];
const WALLETS = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Flip', 'PayPal', 'Wise', 'Revolut'];
const ITEMS: Item[] = [
  ...BANKS.map((name) => ({ name, type: 'Bank Account' as const })),
  ...WALLETS.map((name) => ({ name, type: 'E-Wallet' as const })),
  { name: 'Tunai', type: 'Cash', emoji: '💵', hint: 'Uang di dompet' },
];
const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'Bank Account', label: 'Bank' },
  { id: 'E-Wallet', label: 'E-wallet & bayar' },
] as const;
const SECTION: Record<Item['type'], string> = { 'Bank Account': 'Bank', 'E-Wallet': 'E-wallet & pembayaran', Cash: 'Tunai' };
const accountDomain = (a: Account) => {
  const m = /[?&](?:domain|d)=([^&]+)/.exec(a.logoUrl ?? '');
  return m ? decodeURIComponent(m[1]).toLowerCase() : institutionDomain(a.name, a.type);
};
const sameInstitution = (i: Item, a: Account) =>
  !isCreditAccountType(a.type) && (i.type === 'Cash' ? a.type === 'Cash' : Boolean(accountDomain(a)) && accountDomain(a) === institutionDomain(i.name, i.type));

export function AddAccountPicker({ isOpen, onClose, onPick }: { isOpen: boolean; onClose: () => void; onPick: (p: AccountPick) => void }) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('semua');
  const { toast } = useFeedback();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkFor, setLinkFor] = useState<Item | null>(null);
  const [purposes, setPurposes] = useState<Record<string, Purpose>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    accountService.getUserAccounts('session').then(setAccounts).catch(() => setAccounts([]));
  }, [isOpen]);
  const owned = (i: Item) => accounts.filter((a) => sameInstitution(i, a));

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ITEMS.filter((i) => (filter === 'semua' || i.type === filter) && (!term || i.name.toLowerCase().includes(term)));
  }, [q, filter]);
  const groups = (['Bank Account', 'E-Wallet', 'Cash'] as const).map((t) => ({ t, items: shown.filter((i) => i.type === t) })).filter((g) => g.items.length);
  const resetAll = () => { setQ(''); setFilter('semua'); setLinkFor(null); setPurposes({}); setSavedIds([]); };
  const close = () => { resetAll(); onClose(); };
  const pick = (p: AccountPick) => { resetAll(); onPick(p); };
  const choose = (i: Item, logo: string | null) => {
    const mine = owned(i);
    if (mine.length) {
      setLinkFor(i);
      setPurposes(Object.fromEntries(mine.map((a) => [a.id!, a.purpose ?? 'belanja'])));
      return;
    }
    pick({ name: i.name, type: i.type, logoUrl: logo ?? undefined });
  };
  const link = async (a: Account, logo: string | null) => {
    if (!a.id) return;
    setSavingId(a.id);
    try {
      await accountService.updateAccount(a.id, { purpose: purposes[a.id] ?? 'belanja', ...(!a.logoUrl && logo ? { logoUrl: logo } : {}) });
      setSavedIds((s) => [...s, a.id!]);
      setAccounts((list) => list.map((x) => (x.id === a.id ? { ...x, purpose: purposes[a.id!], logoUrl: x.logoUrl || logo || undefined } : x)));
      toast.success(`${a.name} ditautkan untuk ${purposes[a.id] === 'nabung' ? 'nabung' : 'belanja'}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan. Coba lagi.');
    } finally {
      setSavingId(null);
    }
  };
  const linkLogo = linkFor ? matchIndonesianInstitutionLogo(linkFor.name, linkFor.type) : null;

  return (
    <Modal isOpen={isOpen} onClose={close} title={linkFor ? `Tautkan ${linkFor.name}` : 'Tambah akun'} maxWidth="max-w-2xl">
      {linkFor ? (
        <motion.div key="link" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <button type="button" onClick={() => setLinkFor(null)} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200"><ArrowLeft size={14} /> Pilih lain</button>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.45)] ring-1 ring-slate-100">
              {linkFor.emoji ? <span className="text-[36px]">{linkFor.emoji}</span> : <LogoImage src={linkLogo} alt={linkFor.name} fallbackText={linkFor.name.slice(0, 3).toUpperCase()} className="h-full w-full object-contain p-2" />}
            </span>
            <p className="text-[14px] text-slate-500">Kamu sudah punya {owned(linkFor).length} rekening {linkFor.name}. Atur fungsinya, atau tambah rekening {linkFor.name} lain.</p>
          </div>
          <ul className="space-y-2">
            {owned(linkFor).map((a) => {
              const p = purposes[a.id!] ?? 'belanja';
              const saved = savedIds.includes(a.id!);
              return (
                <li key={a.id} className="rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-100">
                      <LogoImage src={a.logoUrl || linkLogo} alt={a.name} fallbackText={a.name.slice(0, 3).toUpperCase()} className="h-full w-full object-contain p-0.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-slate-900">{a.name}</span>
                      <span className="block text-[12px] tabular-nums text-slate-500">{formatMoney(Number(a.balance) || 0, a.currency || 'IDR')}{a.purpose ? ` · sekarang: ${a.purpose}` : ''}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex flex-1 gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
                      {([['belanja', '🛒 Belanja'], ['nabung', '🐷 Nabung']] as const).map(([v, t]) => (
                        <button key={v} type="button" onClick={() => { setPurposes((s) => ({ ...s, [a.id!]: v })); setSavedIds((s) => s.filter((x) => x !== a.id)); }} aria-pressed={p === v} className={cn('flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors', p === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700')}>{t}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => link(a, linkLogo)} disabled={savingId === a.id || saved} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold', saved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800')}>
                      {savingId === a.id ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
                      {saved ? 'Tertaut' : 'Tautkan'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => pick({ name: linkFor.name, type: linkFor.type, logoUrl: linkLogo ?? undefined })} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-slate-300 py-3 text-[14px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50">
            <Plus size={16} /> Tambah rekening {linkFor.name} lain
          </button>
        </motion.div>
      ) : (
      <div className="space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bank atau e-wallet…" aria-label="Cari bank atau e-wallet" className="w-full rounded-full bg-slate-100 py-3 pl-11 pr-10 text-[15px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200"><X size={15} /></button>}
        </div>

        <LayoutGroup id="acc-pick-filter">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold', filter === f.id ? 'text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100')}>
                {filter === f.id && <motion.span layoutId={reduce ? undefined : 'acc-pick-pill'} className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Pintasan khusus */}
        {!q && filter === 'semua' && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pick('kartu')} className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 p-3 text-left text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-[20px] transition-transform group-hover:scale-110">💳</span>
              <span><span className="block text-[14px] font-bold">Kartu kredit</span><span className="block text-[11px] text-white/60">Limit & jatuh tempo</span></span>
            </button>
            <button type="button" onClick={() => pick('manual')} className="group flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-200 hover:bg-slate-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition-transform group-hover:scale-110"><PencilLine size={18} /></span>
              <span><span className="block text-[14px] font-bold text-slate-900">Isi manual</span><span className="block text-[11px] text-slate-500">Bank lain, dompet, dll</span></span>
            </button>
          </div>
        )}

        <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {groups.map((g) => (
              <motion.section key={g.t} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
                <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{SECTION[g.t]}</p>
                <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                  {g.items.map((i, idx) => {
                    const logo = matchIndonesianInstitutionLogo(i.name, i.type);
                    return (
                      <motion.button
                        key={i.name}
                        type="button"
                        onClick={() => choose(i, logo)}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx, 12) * 0.015 }}
                        whileTap={reduce ? undefined : { scale: 0.94 }}
                        className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center hover:bg-slate-50"
                      >
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.35)] ring-1 ring-slate-100 transition-transform group-hover:-translate-y-0.5">
                          {i.emoji ? <span className="text-[26px]">{i.emoji}</span> : (
                            <LogoImage src={logo} alt={i.name} fallbackText={i.name.slice(0, 3).toUpperCase()} className="h-full w-full object-contain p-1.5" />
                          )}
                        </span>
                        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-slate-700">{i.name}</span>
                        {owned(i).length > 0 && <span className="-mt-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">✓ Sudah ada</span>}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
          {groups.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[14px] font-semibold text-slate-800">“{q}” belum ada di daftar</p>
              <button type="button" onClick={() => pick({ name: q.trim(), type: 'Bank Account' })} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-slate-800">Tambah “{q.trim()}” manual</button>
            </div>
          )}
        </div>
      </div>
      )}
    </Modal>
  );
}
