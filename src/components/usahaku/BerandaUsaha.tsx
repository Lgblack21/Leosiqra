'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Clock,
  Loader2,
  Plus,
  ReceiptText,
  Store,
  Trash2,
  Wallet,
} from 'lucide-react';
import { accountService } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import { shopService, type Shop } from '@/lib/services/shopService';
import { shopBookService, type BookEntry, type ShopBook } from '@/lib/services/shopBookService';
import { stockService, type StockMaterial } from '@/lib/services/stockService';
import { ACCOUNT_KINDS, SHOP_KINDS, accountEmoji, kindOf, payLabel } from '@/lib/usaha/jenis';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { ExpenseForm } from '@/components/ladang/ExpenseForm';
import { fieldCls, labelCls } from '@/components/ladang/UsahaView';
import { UsahaSheet } from './UsahaSheet';

const money = (v: string) => Number(v.replace(/\D/g, '').slice(0, 11) || '0');
const moneyText = (n: number) => (n ? n.toLocaleString('id-ID') : '');

// ── Aktivasi: pilih jenis toko + kas usaha pertama ────────────────────────────
export function MulaiBukuUsaha({ shop, onDone }: { shop: Shop; onDone: (m: string) => void }) {
  const [kind, setKind] = useState(shop.kind ?? '');
  const [name, setName] = useState('Kas toko');
  const [accKind, setAccKind] = useState('kas');
  const [opening, setOpening] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());

  const save = async () => {
    if (!kind) return setError('Pilih jenis usahamu dulu.');
    if (!name.trim()) return setError('Beri nama kas, mis. Kas toko.');
    setBusy(true);
    setError('');
    try {
      const k = kindOf(kind);
      await shopService.update(shop.id, { kind, ...(k ? { channels: k.channels } : {}) });
      await shopBookService.createAccount(shop.id, { name: name.trim(), kind: accKind, opening, requestId });
      onDone('Buku usaha aktif. Penjualan & biaya sekarang masuk kas usaha.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };

  return (
    <section className="space-y-5 rounded-[28px] bg-white p-5 ring-1 ring-slate-100 md:p-7 dark:bg-slate-900 dark:ring-slate-800">
      <div>
        <p className="fsh-22 font-black tracking-tight text-slate-900 dark:text-white">Pisahkan uang usaha</p>
        <p className="mt-1 fs-14 leading-relaxed text-slate-500 dark:text-slate-400">
          Sekarang penjualan {shop.name} masih masuk rekening pribadimu. Aktifkan buku usaha supaya uang usaha punya kas
          sendiri dan tidak tercampur dengan keuangan pribadi. Data lama tetap aman, tidak dipindah.
        </p>
      </div>

      <div>
        <p className="mb-2 fs-14 font-extrabold text-slate-900 dark:text-white">1. Jenis usahamu</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHOP_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={cn(
                'rounded-2xl p-3 text-left ring-1 transition-colors',
                kind === k.id
                  ? 'bg-emerald-50 ring-2 ring-emerald-500 dark:bg-emerald-500/10'
                  : 'bg-slate-50 ring-slate-100 hover:bg-white dark:bg-slate-800/60 dark:ring-slate-800',
              )}
            >
              <span className="fsh-22">{k.emoji}</span>
              <span className="mt-1 block fs-13 font-extrabold text-slate-900 dark:text-white">{k.label}</span>
              <span className="mt-0.5 block fs-11 leading-snug text-slate-500 dark:text-slate-400">{k.contoh}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 fs-14 font-extrabold text-slate-900 dark:text-white">2. Kas usaha pertama</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Nama kas</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={fieldCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Jenis</span>
            <select value={accKind} onChange={(e) => setAccKind(e.target.value)} className={fieldCls}>
              {ACCOUNT_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Saldo sekarang (opsional)</span>
            <input
              value={moneyText(opening)}
              onChange={(e) => setOpening(money(e.target.value))}
              inputMode="numeric"
              placeholder="Rp 0"
              className={cn(fieldCls, 'tabular-nums')}
            />
          </label>
        </div>
        <p className="mt-2 fs-12 text-slate-500 dark:text-slate-400">
          Kas lain (rekening bank usaha, saldo Shopee, deposit supplier) bisa ditambah nanti di ⚙️ Pengaturan.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 fs-15 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Aktifkan buku usaha
      </button>
    </section>
  );
}

// ── Beranda: ringkasan, kas, belum cair, riwayat ─────────────────────────────
type Form = { k: 'biaya' } | { k: 'setor' } | { k: 'ambil' } | { k: 'pindah' } | { k: 'cair'; entry: BookEntry };

export function BerandaUsaha({
  shop,
  book,
  variant,
  onToast,
  onOpenKasir,
}: {
  shop: Shop;
  book: ShopBook;
  variant: 'web' | 'app';
  onToast: (m: string) => void;
  onOpenKasir: () => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [materials, setMaterials] = useState<StockMaterial[]>([]);
  const kas = book.accounts.filter((a) => !a.archived);
  const totalKas = kas.reduce((a, k) => a + k.balance, 0);
  const pendingTotal = book.pending.reduce((a, e) => a + e.net, 0);
  const labaBulan = book.month.omzet - book.month.fee - book.month.biaya;
  const kind = kindOf(shop.kind);
  const accName = (id: string | null) => kas.find((a) => a.id === id)?.name ?? book.accounts.find((a) => a.id === id)?.name ?? '—';

  useEffect(() => {
    stockService
      .get(shop.id)
      .then((d) => setMaterials(d.materials.filter((m) => !m.archived_at)))
      .catch(() => setMaterials([]));
  }, [shop.id]);

  const remove = async (e: BookEntry) => {
    const what =
      e.type === 'jual' ? 'penjualan' : e.type === 'biaya' ? 'biaya' : e.type === 'setor' ? 'setoran' : e.type === 'ambil' ? 'pengambilan' : 'catatan';
    if (!window.confirm(`Hapus ${what} ${formatIDR(e.amount)}? Saldo kas${e.type === 'setor' || e.type === 'ambil' ? ' & rekening pribadi' : ''} ikut kembali.`)) return;
    try {
      await shopBookService.removeEntry(shop.id, e.id);
      onToast('Catatan dihapus, saldo dikembalikan.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  };

  const stat = (label: string, value: string, tone = 'text-slate-900 dark:text-white', hint?: string) => (
    <div className="min-w-0 rounded-3xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="truncate fs-12 font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('truncate fsh-22 font-black tabular-nums tracking-tight', tone)}>{value}</p>
      {hint && <p className="truncate fs-11 text-slate-400">{hint}</p>}
    </div>
  );
  const action = (k: Form['k'], label: string, Icon: typeof Wallet, tone: string) => (
    <button
      type="button"
      onClick={() => setForm({ k } as Form)}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 fs-12 font-bold text-slate-700 ring-1 ring-slate-100 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', tone)}>
        <Icon size={19} />
      </span>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onOpenKasir}
        className="flex w-full items-center gap-3 rounded-[26px] bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-left text-white shadow-lg shadow-emerald-600/20"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Store size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block fs-16 font-extrabold">Buka kasir</span>
          <span className="block truncate fs-12 text-white/75">Catat penjualan langsung atau marketplace</span>
        </span>
        <ArrowUpRight size={20} />
      </button>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stat('Omzet hari ini', formatIDR(book.today.omzet), undefined, `${book.today.nota} nota`)}
        {stat(
          'Laba bulan ini',
          formatIDR(labaBulan),
          labaBulan < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-300',
          'omzet − potongan − biaya',
        )}
        {stat('Total kas usaha', formatIDR(totalKas))}
        {stat('Belum cair', formatIDR(pendingTotal), pendingTotal ? 'text-orange-600' : undefined, `${book.pending.length} pesanan marketplace`)}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {action('biaya', 'Catat biaya', ReceiptText, 'bg-rose-50 text-rose-600 dark:bg-rose-500/10')}
        {action('setor', 'Setor modal', ArrowDownLeft, 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10')}
        {action('ambil', 'Ambil uang', ArrowUpRight, 'bg-amber-50 text-amber-600 dark:bg-amber-500/10')}
        {action('pindah', 'Pindah kas', ArrowLeftRight, 'bg-sky-50 text-sky-600 dark:bg-sky-500/10')}
      </div>

      <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-15 font-extrabold text-slate-900 dark:text-white">Kas usaha</p>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {kas.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="fsh-20">{accountEmoji(a.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14 font-bold text-slate-800 dark:text-slate-100">{a.name}</span>
                {a.isDefault && <span className="block fs-11 text-slate-400">Kas utama (kasir tim & website)</span>}
              </span>
              <span className={cn('fs-15 font-extrabold tabular-nums', a.balance < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white')}>
                {formatIDR(a.balance)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {book.pending.length > 0 && (
        <section className="rounded-[26px] bg-orange-50 p-4 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:ring-orange-500/20">
          <p className="flex items-center gap-1.5 fs-15 font-extrabold text-orange-900 dark:text-orange-200">
            <Clock size={16} /> Menunggu cair
          </p>
          <ul className="mt-2 space-y-2">
            {book.pending.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900">
                <span className="min-w-0 flex-1">
                  <span className="block truncate fs-13 font-bold text-slate-800 dark:text-slate-100">
                    {e.channel} · {e.product || e.note || 'Penjualan'}
                  </span>
                  <span className="block fs-11 text-slate-500">
                    {e.date} · jual {formatIDR(e.amount)} · potongan {formatIDR(e.fee)}
                  </span>
                </span>
                <span className="fs-14 font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{formatIDR(e.net)}</span>
                <button
                  type="button"
                  onClick={() => setForm({ k: 'cair', entry: e })}
                  className="rounded-full bg-emerald-600 px-3 py-1.5 fs-12 font-bold text-white hover:bg-emerald-700"
                >
                  Cair
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Riwayat entries={book.entries} accName={accName} onRemove={remove} />

      {kind && (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 fs-12 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          {kind.emoji} <b>Tips {kind.label}:</b> {kind.tip}
        </p>
      )}

      <UsahaSheet
        variant={variant}
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          form?.k === 'biaya'
            ? 'Catat biaya usaha'
            : form?.k === 'setor'
              ? 'Setor modal'
              : form?.k === 'ambil'
                ? 'Ambil uang usaha'
                : form?.k === 'pindah'
                  ? 'Pindah antar kas'
                  : 'Uang sudah cair'
        }
      >
        {form?.k === 'biaya' && (
          <ExpenseForm
            shop={shop}
            materials={materials}
            kasList={kas.map((a) => ({ id: a.id, name: a.name }))}
            onSave={(input) => shopService.expense(shop.id, { ...input, accountId: input.accountId ?? '', book: true })}
            onDone={(m) => {
              setForm(null);
              onToast(m);
            }}
            onCancel={() => setForm(null)}
          />
        )}
        {(form?.k === 'setor' || form?.k === 'ambil' || form?.k === 'pindah') && (
          <TransferForm
            shop={shop}
            direction={form.k}
            book={book}
            onDone={(m) => {
              setForm(null);
              onToast(m);
            }}
          />
        )}
        {form?.k === 'cair' && (
          <SettleForm
            shop={shop}
            entry={form.entry}
            book={book}
            onDone={(m) => {
              setForm(null);
              onToast(m);
            }}
          />
        )}
      </UsahaSheet>
    </div>
  );
}

const ENTRY_LABEL: Record<string, string> = {
  jual: 'Jual',
  biaya: 'Biaya',
  setor: 'Setor modal',
  ambil: 'Ambil uang',
  pindah: 'Pindah kas',
  saldo_awal: 'Saldo awal',
};
function Riwayat({
  entries,
  accName,
  onRemove,
}: {
  entries: BookEntry[];
  accName: (id: string | null) => string;
  onRemove: (e: BookEntry) => void;
}) {
  const list = entries.filter((e) => !(e.type === 'saldo_awal' && e.amount === 0)).slice(0, 40);
  if (!list.length)
    return (
      <p className="rounded-[26px] border-2 border-dashed border-slate-200 p-6 text-center fs-13 text-slate-400 dark:border-slate-800">
        Belum ada catatan bulan ini. Mulai dari kasir.
      </p>
    );
  return (
    <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="fs-15 font-extrabold text-slate-900 dark:text-white">Riwayat bulan ini</p>
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((e) => {
          const plus = e.type === 'jual' || e.type === 'setor' || e.type === 'saldo_awal';
          const neutral = e.type === 'pindah';
          const detail = [
            e.date,
            e.type === 'jual' ? [e.channel, e.channelType === 'langsung' ? payLabel(e.payMethod) : '', e.reseller ? 'reseller' : ''] : [],
            e.type === 'biaya' ? e.category : '',
            e.type === 'pindah' ? `${accName(e.accountId)} → ${accName(e.toAccountId)}` : e.accountId ? accName(e.accountId) : '',
            e.byName ? `oleh ${e.byName}` : '',
          ]
            .flat()
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 fs-10 font-bold',
                      e.type === 'jual'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : e.type === 'biaya'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {ENTRY_LABEL[e.type] ?? e.type}
                  </span>
                  {e.status === 'menunggu' && (
                    <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 fs-10 font-bold text-orange-700">belum cair</span>
                  )}
                  <span className="truncate fs-13 font-semibold text-slate-800 dark:text-slate-100">
                    {e.product || e.note || e.buyer || ENTRY_LABEL[e.type]}
                  </span>
                </span>
                <span className="block truncate fs-11 text-slate-400">{detail}</span>
                {e.fee > 0 && (
                  <span className="block truncate fs-11 text-orange-600">
                    Potongan {formatIDR(e.fee)}
                    {e.fees.length ? ` (${e.fees.map((f) => f.label).join(', ')})` : ''} · diterima {formatIDR(e.net)}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'shrink-0 fs-14 font-extrabold tabular-nums',
                  neutral ? 'text-slate-600 dark:text-slate-300' : plus ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600',
                )}
              >
                {neutral ? '' : plus ? '+' : '−'}
                {formatIDR(e.amount)}
              </span>
              {e.type !== 'saldo_awal' && (
                <button
                  type="button"
                  onClick={() => onRemove(e)}
                  aria-label="Hapus catatan"
                  className="shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Setor modal / ambil uang / pindah kas ────────────────────────────────────
function TransferForm({
  shop,
  direction,
  book,
  onDone,
}: {
  shop: Shop;
  direction: 'setor' | 'ambil' | 'pindah';
  book: ShopBook;
  onDone: (m: string) => void;
}) {
  const kas = book.accounts.filter((a) => !a.archived);
  const [amount, setAmount] = useState(0);
  const [kasId, setKasId] = useState(kas.find((a) => a.isDefault)?.id ?? kas[0]?.id ?? '');
  const [toId, setToId] = useState(kas.find((a) => a.id !== kasId)?.id ?? '');
  const [personal, setPersonal] = useState<{ id: string; name: string; balance: number }[] | null>(null);
  const [personalId, setPersonalId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (direction === 'pindah') return;
    accountService
      .getUserAccounts('')
      .then((list) => {
        const ok = list
          .filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR')
          .map((a) => ({ id: String(a.id), name: a.name, balance: Number(a.balance) || 0 }));
        setPersonal(ok);
        setPersonalId(ok[0]?.id ?? '');
      })
      .catch(() => setPersonal([]));
  }, [direction]);

  const fromKas = kas.find((a) => a.id === kasId);
  const save = async () => {
    if (amount < 1) return setError('Isi nominalnya.');
    if (!kasId) return setError('Pilih kas usaha.');
    if (direction === 'pindah' && (!toId || toId === kasId)) return setError('Pilih kas tujuan yang berbeda.');
    if (direction !== 'pindah' && !personalId) return setError('Pilih rekening pribadi.');
    setBusy(true);
    setError('');
    try {
      await shopBookService.transfer(shop.id, {
        direction,
        amount,
        shopAccountId: kasId,
        toAccountId: direction === 'pindah' ? toId : undefined,
        personalAccountId: direction === 'pindah' ? undefined : personalId,
        note: note.trim() || undefined,
        date,
        requestId,
      });
      onDone(
        direction === 'setor'
          ? `Modal ${formatIDR(amount)} masuk kas usaha.`
          : direction === 'ambil'
            ? `${formatIDR(amount)} diambil ke rekening pribadi.`
            : `${formatIDR(amount)} dipindah antar kas.`,
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };

  const kasSelect = (label: string, value: string, set: (v: string) => void, except?: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className={fieldCls}>
        {kas
          .filter((a) => a.id !== except)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {accountEmoji(a.kind)} {a.name} · {formatIDR(a.balance)}
            </option>
          ))}
      </select>
    </label>
  );
  const personalSelect = (label: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select value={personalId} onChange={(e) => setPersonalId(e.target.value)} disabled={!personal?.length} className={fieldCls}>
        {personal === null ? (
          <option>Memuat…</option>
        ) : personal.length ? (
          personal.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatIDR(a.balance)}
            </option>
          ))
        ) : (
          <option value="">Belum ada rekening Rupiah</option>
        )}
      </select>
    </label>
  );

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-slate-50 px-3 py-2.5 fs-12 leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        {direction === 'setor'
          ? 'Uang pribadi dipakai untuk usaha. Di keuangan pribadi tercatat sebagai transfer keluar, bukan pengeluaran.'
          : direction === 'ambil'
            ? 'Uang usaha diambil untuk pribadi (prive). Di keuangan pribadi tercatat sebagai transfer masuk, bukan pemasukan.'
            : 'Mis. tarik saldo Shopee ke rekening usaha, atau isi deposit supplier dari kas.'}
      </p>
      {direction === 'setor' && (
        <>
          {personalSelect('Dari rekening pribadi')}
          {kasSelect('Ke kas usaha', kasId, setKasId)}
        </>
      )}
      {direction === 'ambil' && (
        <>
          {kasSelect('Dari kas usaha', kasId, setKasId)}
          {personalSelect('Ke rekening pribadi')}
        </>
      )}
      {direction === 'pindah' && (
        <>
          {kasSelect('Dari kas', kasId, (v) => {
            setKasId(v);
            if (v === toId) setToId(kas.find((a) => a.id !== v)?.id ?? '');
          })}
          {kas.length < 2 ? (
            <p className="fs-12 text-amber-700">Tambah kas kedua dulu di ⚙️ Pengaturan.</p>
          ) : (
            kasSelect('Ke kas', toId, setToId, kasId)
          )}
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Nominal</span>
          <input
            value={moneyText(amount)}
            onChange={(e) => setAmount(money(e.target.value))}
            inputMode="numeric"
            placeholder="Rp"
            className={cn(fieldCls, 'tabular-nums')}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Tanggal</span>
          <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
        </label>
      </div>
      {direction !== 'setor' && fromKas && amount > fromKas.balance && (
        <p className="fs-12 font-semibold text-amber-700">Saldo {fromKas.name} cuma {formatIDR(fromKas.balance)} — kas akan minus.</p>
      )}
      <label className="block">
        <span className={labelCls}>Catatan (opsional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} className={fieldCls} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 fs-14 font-extrabold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan
      </button>
    </div>
  );
}

// ── Marketplace cair: pilih kas, sesuaikan nominal cair kalau beda ──────────
function SettleForm({ shop, entry, book, onDone }: { shop: Shop; entry: BookEntry; book: ShopBook; onDone: (m: string) => void }) {
  const kas = useMemo(() => book.accounts.filter((a) => !a.archived), [book.accounts]);
  const preferred = kas.find((a) => a.kind === 'marketplace' && entry.channel && a.name.toLowerCase().includes(entry.channel.toLowerCase()));
  const [kasId, setKasId] = useState(preferred?.id ?? kas.find((a) => a.isDefault)?.id ?? kas[0]?.id ?? '');
  const [net, setNet] = useState(entry.net);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (net > entry.amount) return setError('Uang cair tidak boleh lebih besar dari harga jual.');
    setBusy(true);
    setError('');
    try {
      await shopBookService.settle(shop.id, entry.id, { accountId: kasId, net });
      onDone(`${formatIDR(net)} masuk kas usaha.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
    }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-slate-50 px-3 py-2.5 fs-13 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        <b>{entry.channel}</b> · {entry.product || entry.note || 'Penjualan'}
        <br />
        Harga jual {formatIDR(entry.amount)} · perkiraan potongan {formatIDR(entry.fee)}
      </p>
      <label className="block">
        <span className={labelCls}>Masuk ke kas</span>
        <select value={kasId} onChange={(e) => setKasId(e.target.value)} className={fieldCls}>
          {kas.map((a) => (
            <option key={a.id} value={a.id}>
              {accountEmoji(a.kind)} {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Uang yang benar-benar cair</span>
        <input
          value={moneyText(net)}
          onChange={(e) => setNet(money(e.target.value))}
          inputMode="numeric"
          className={cn(fieldCls, 'tabular-nums')}
        />
      </label>
      {net !== entry.net && net <= entry.amount && (
        <p className="fs-12 text-slate-500">Potongan jadi {formatIDR(entry.amount - net)} (selisih dari perkiraan dicatat otomatis).</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy || !kasId}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 fs-14 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tandai sudah cair
      </button>
    </div>
  );
}
