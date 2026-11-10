'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { shopService, type Shop, type ShopChannels } from '@/lib/services/shopService';
import { shopBookService, type ShopAccount } from '@/lib/services/shopBookService';
import { ACCOUNT_KINDS, CHANNEL_SUGGEST, SHOP_KINDS, accountEmoji, channelsOf, kindOf } from '@/lib/usaha/jenis';
import { cn, formatIDR } from '@/lib/utils';
import { fieldCls, labelCls } from '@/components/ladang/UsahaView';
import { LogoToko } from './LogoToko';

const money = (v: string) => Number(v.replace(/\D/g, '').slice(0, 11) || '0');

// ⚙️ Pengaturan Usahaku: jenis toko, jalur jualan, kas usaha. (Katalog, kontak, tim, website = ShopDetail di bawahnya.)
export function PengaturanUsaha({
  shop,
  accounts,
  onToast,
}: {
  shop: Shop;
  accounts: ShopAccount[] | null;
  onToast: (m: string) => void;
}) {
  return (
    <div className="space-y-5">
      <LogoToko shop={shop} onToast={onToast} />
      <JenisToko shop={shop} onToast={onToast} />
      <JalurJualan shop={shop} onToast={onToast} />
      {accounts && <KasUsaha shop={shop} accounts={accounts} onToast={onToast} />}
    </div>
  );
}

const box = 'rounded-3xl p-4 ring-1 ring-slate-100 dark:ring-slate-800';
const title = 'fs-14 font-extrabold text-slate-900 dark:text-white';

function JenisToko({ shop, onToast }: { shop: Shop; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (id: string) => {
    if (id === shop.kind) return;
    setBusy(true);
    try {
      await shopService.update(shop.id, { kind: id });
      onToast(`Jenis usaha: ${kindOf(id)?.label ?? id}.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };
  return (
    <section className={box}>
      <p className={title}>Jenis usaha</p>
      <p className="mb-2 fs-12 text-slate-500 dark:text-slate-400">Menentukan tips, jalur jualan bawaan, dan tab Stok.</p>
      <div className="flex flex-wrap gap-1.5">
        {SHOP_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            disabled={busy}
            onClick={() => pick(k.id)}
            aria-pressed={shop.kind === k.id}
            className={cn(
              'rounded-full px-3 py-1.5 fs-12 font-bold',
              shop.kind === k.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {k.emoji} {k.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function JalurJualan({ shop, onToast }: { shop: Shop; onToast: (m: string) => void }) {
  const [ch, setCh] = useState<ShopChannels>(() => channelsOf(shop));
  const [custom, setCustom] = useState({ langsung: '', marketplace: '' });
  const [busy, setBusy] = useState(false);
  const toggle = (t: keyof ShopChannels, name: string) =>
    setCh((c) => ({ ...c, [t]: c[t].includes(name) ? c[t].filter((x) => x !== name) : [...c[t], name].slice(0, 12) }));
  const save = async () => {
    setBusy(true);
    try {
      await shopService.update(shop.id, { channels: ch });
      onToast('Jalur jualan tersimpan.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };
  const group = (t: keyof ShopChannels, label: string, hint: string) => {
    const all = [...new Set([...CHANNEL_SUGGEST[t], ...ch[t]])];
    return (
      <div>
        <p className="fs-13 font-bold text-slate-800 dark:text-slate-100">{label}</p>
        <p className="mb-1.5 fs-11 text-slate-500 dark:text-slate-400">{hint}</p>
        <div className="flex flex-wrap gap-1.5">
          {all.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggle(t, n)}
              aria-pressed={ch[t].includes(n)}
              className={cn(
                'rounded-full px-3 py-1.5 fs-12 font-bold',
                ch[t].includes(n)
                  ? t === 'langsung'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input
            value={custom[t]}
            onChange={(e) => setCustom({ ...custom, [t]: e.target.value })}
            maxLength={24}
            placeholder="Tambah lain…"
            className={cn(fieldCls, 'px-3 py-2 fs-13')}
          />
          <button
            type="button"
            disabled={!custom[t].trim()}
            onClick={() => {
              const n = custom[t].trim();
              if (n && !ch[t].includes(n)) setCh((c) => ({ ...c, [t]: [...c[t], n].slice(0, 12) }));
              setCustom({ ...custom, [t]: '' });
            }}
            aria-label="Tambah jalur"
            className="rounded-full bg-slate-900 px-3 text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    );
  };
  return (
    <section className={cn(box, 'space-y-4')}>
      <p className={title}>Jalur jualan</p>
      {group('langsung', 'Langsung (tanpa biaya)', 'IG, WA, offline, website — uang langsung masuk kas.')}
      {group('marketplace', 'Marketplace / e-commerce (ada biaya)', 'Biaya admin diisi sendiri tiap penjualan. Kosongkan kalau tidak jualan di marketplace.')}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 fs-14 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan jalur jualan
      </button>
    </section>
  );
}

function KasUsaha({ shop, accounts, onToast }: { shop: Shop; accounts: ShopAccount[]; onToast: (m: string) => void }) {
  const kas = accounts.filter((a) => !a.archived);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('bank');
  const [opening, setOpening] = useState(0);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState('');
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      onToast(ok);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
    setBusy('');
  };
  return (
    <section className={box}>
      <p className={title}>Kas usaha</p>
      <p className="mb-2 fs-12 text-slate-500 dark:text-slate-400">
        Kas utama ★ dipakai kasir tim & penjualan dari website. Saldo hanya berubah lewat penjualan, biaya, setor, ambil,
        atau pindah kas.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {kas.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-2.5">
            <span className="fsh-20">{accountEmoji(a.kind)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate fs-14 font-bold text-slate-800 dark:text-slate-100">{a.name}</span>
              <span className="block fs-12 tabular-nums text-slate-500">{formatIDR(a.balance)}</span>
            </span>
            <button
              type="button"
              disabled={a.isDefault || busy !== ''}
              onClick={() => run(`d${a.id}`, () => shopBookService.updateAccount(shop.id, a.id, { isDefault: true }), `${a.name} jadi kas utama.`)}
              aria-label={a.isDefault ? 'Kas utama' : `Jadikan ${a.name} kas utama`}
              className={cn('rounded-full p-2', a.isDefault ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500')}
            >
              <Star size={16} fill={a.isDefault ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              disabled={busy !== ''}
              onClick={() => {
                const n = window.prompt('Nama kas', a.name)?.trim();
                if (n && n !== a.name) void run(`r${a.id}`, () => shopBookService.updateAccount(shop.id, a.id, { name: n }), 'Nama kas diubah.');
              }}
              className="rounded-full px-2 py-1 fs-12 font-bold text-violet-600 hover:bg-violet-50"
            >
              Ubah
            </button>
            {kas.length > 1 && (
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => {
                  if (window.confirm(`Hapus kas ${a.name}? Saldo harus nol dulu.`))
                    void run(`x${a.id}`, () => shopBookService.removeAccount(shop.id, a.id), 'Kas dihapus.');
                }}
                aria-label={`Hapus ${a.name}`}
                className="rounded-full p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <p className="fs-13 font-bold text-slate-800 dark:text-slate-100">Kas baru</p>
            <button type="button" onClick={() => setAdding(false)} aria-label="Tutup" className="text-slate-400">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className={labelCls}>Nama</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="mis. BCA Usaha" className={fieldCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Jenis</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldCls}>
                {ACCOUNT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.emoji} {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Saldo sekarang</span>
              <input
                value={opening ? opening.toLocaleString('id-ID') : ''}
                onChange={(e) => setOpening(money(e.target.value))}
                inputMode="numeric"
                placeholder="Rp 0"
                className={cn(fieldCls, 'tabular-nums')}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!name.trim() || busy !== ''}
            onClick={() =>
              run(
                'add',
                async () => {
                  await shopBookService.createAccount(shop.id, { name: name.trim(), kind, opening, requestId });
                  setAdding(false);
                  setName('');
                  setOpening(0);
                  setRequestId(crypto.randomUUID());
                },
                'Kas baru ditambahkan.',
              )
            }
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 fs-13 font-bold text-white disabled:opacity-50"
          >
            {busy === 'add' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Tambah kas
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 fs-13 font-bold text-emerald-700 dark:text-emerald-300"
        >
          <Plus size={14} /> Tambah kas (bank usaha, saldo marketplace, deposit supplier)
        </button>
      )}
    </section>
  );
}
