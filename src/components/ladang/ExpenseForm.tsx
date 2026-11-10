'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { accountService } from '@/lib/services/accountService';
import { SHOP_EXPENSE_KINDS, type Shop, type ShopExpenseInput } from '@/lib/services/shopService';
import { fmtQty, type StockMaterial } from '@/lib/services/stockService';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { parseQty } from './StockView';
import { fieldCls, labelCls } from './UsahaView';

// Masuk sebagai pengeluaran "Biaya Usaha" tertaut ke usaha — omzet tidak berkurang. Akun tim: rekening & tanggal dikunci.

// Pilihan umum untuk semua jenis usaha; bahan/barang stok toko ini tampil lebih dulu.
const QUICK: { label: string; kind: (typeof SHOP_EXPENSE_KINDS)[number] }[] = [
  { label: 'Bahan baku', kind: 'Bahan & Stok' },
  { label: 'Stok barang', kind: 'Bahan & Stok' },
  { label: 'Kemasan', kind: 'Kemasan' },
  { label: 'Ongkir', kind: 'Ongkir' },
  { label: 'Sewa tempat', kind: 'Sewa' },
  { label: 'Listrik & air', kind: 'Listrik & Air' },
  { label: 'Pulsa & internet', kind: 'Operasional' },
  { label: 'Gaji / upah', kind: 'Gaji' },
  { label: 'Iklan & promosi', kind: 'Iklan & Promosi' },
];
const ACC_KEY = 'leosiqra-usaha-biaya-acc';

export function ExpenseForm({
  shop,
  onSave,
  locked,
  onDone,
  onCancel,
  materials = [],
  initialMaterialId,
  kasList,
}: {
  shop: Shop;
  /** Usaha dengan buku usaha: bayar dari kas usaha ini (bukan rekening pribadi). */
  kasList?: { id: string; name: string }[];
  /** Bahan stok usaha ini — pembelian bisa langsung menambah stok. */
  materials?: StockMaterial[];
  /** Buka dari Stok › Beli: bahan ini langsung dipilih. */
  initialMaterialId?: string;
  onSave: (input: ShopExpenseInput & { accountId?: string; date?: string }) => Promise<void>;
  /** Akun tim: rekening dikunci pemilik, tanggal hari ini. */
  locked?: { accountName: string | null };
  onDone: (m: string) => void;
  onCancel?: () => void;
}) {
  const initialMat = materials.find((m) => m.id === initialMaterialId);
  const [item, setItem] = useState(initialMat?.name ?? '');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<string>('Bahan & Stok');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [stockId, setStockId] = useState(initialMat?.id ?? '');
  const [stockQty, setStockQty] = useState('');
  const mat = materials.find((m) => m.id === stockId);

  useEffect(() => {
    if (locked) return;
    if (kasList) {
      setAccounts(kasList);
      setAccountId((cur) => (kasList.some((a) => a.id === cur) ? cur : (kasList[0]?.id ?? '')));
      return;
    }
    accountService
      .getUserAccounts('')
      .then((list) => {
        const ok = list
          .filter((a) => a.id && (a.currency || 'IDR') === 'IDR')
          .map((a) => ({ id: String(a.id), name: a.name }));
        setAccounts(ok);
        let saved = '';
        try {
          saved = localStorage.getItem(`${ACC_KEY}:${shop.id}`) ?? '';
        } catch {
          /* abaikan */
        }
        setAccountId(ok.some((a) => a.id === saved) ? saved : (ok[0]?.id ?? ''));
      })
      .catch(() => setAccounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kasList berubah identitas tiap render induk; kunci isinya saja
  }, [shop.id, locked, kasList?.map((a) => `${a.id}:${a.name}`).join('|')]);

  const value = Number(amount || '0');
  const save = async () => {
    if (!item.trim()) {
      setError('Tulis untuk apa, mis. tepung 5 kg atau ongkir.');
      return;
    }
    if (value < 1) {
      setError('Isi nominalnya.');
      return;
    }
    if (locked && !locked.accountName) {
      setError('Pemilik usaha belum menentukan rekening untuk akunmu.');
      return;
    }
    if (!locked && !accountId) {
      setError('Pilih rekening yang dipakai bayar.');
      return;
    }
    const sq = parseQty(stockQty);
    if (mat && (!Number.isFinite(sq) || sq <= 0)) {
      setError(`Isi jumlah ${mat.name} yang dibeli.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        requestId,
        amount: value,
        item: item.trim(),
        kind,
        stock: mat ? { materialId: mat.id, qty: sq } : null,
        ...(locked ? {} : { accountId, date }),
      });
      if (!locked) {
        try {
          localStorage.setItem(`${ACC_KEY}:${shop.id}`, accountId);
        } catch {
          /* abaikan */
        }
      }
      onDone(
        `Pengeluaran ${formatIDR(value)} (${item.trim()}) tercatat${mat ? ` · stok ${mat.name} +${fmtQty(sq)} ${mat.unit}` : ''}.`,
      );
      setItem('');
      setAmount('');
      setStockId('');
      setStockQty('');
      setRequestId(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat.');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 fs-12 font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </p>
      )}
      <div>
        <span className={labelCls}>Untuk apa</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {materials.slice(0, 6).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setItem(m.name);
                setKind('Bahan & Stok');
                setStockId(m.id);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 fs-12 font-bold',
                stockId === m.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300',
              )}
            >
              {m.name}
            </button>
          ))}
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setItem(q.label);
                setKind(q.kind);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 fs-12 font-bold',
                item === q.label
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          maxLength={80}
          placeholder="mis. Tepung 5 kg, kemasan 100 pcs, ongkir"
          className={fieldCls}
        />
      </div>
      <label className="block">
        <span className={labelCls}>Nominal</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 fs-14 font-bold text-slate-400">
            Rp
          </span>
          <input
            inputMode="numeric"
            value={amount ? Number(amount).toLocaleString('id-ID') : ''}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="0"
            className={cn(fieldCls, 'pl-11 fs-18 font-extrabold tabular-nums')}
          />
        </span>
      </label>
      <div>
        <span className={labelCls}>Jenis</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {SHOP_EXPENSE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                'rounded-xl px-2 py-2 fs-12 font-bold',
                kind === k
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      {materials.length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <span className={labelCls}>Masuk ke stok (opsional)</span>
          <div className="flex gap-2">
            <select
              value={stockId}
              onChange={(e) => {
                setStockId(e.target.value);
                const m = materials.find((x) => x.id === e.target.value);
                if (m && !item.trim()) setItem(m.name);
                if (m && kind === 'Lainnya') setKind('Bahan & Stok');
              }}
              aria-label="Bahan stok"
              className={cn(fieldCls, 'min-w-0 flex-1 bg-white py-2.5 fs-13 dark:bg-slate-900')}
            >
              <option value="">Tidak menambah stok</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (sisa {fmtQty(m.stock)} {m.unit})
                </option>
              ))}
            </select>
            {mat && (
              <span className="relative w-28 shrink-0">
                <input
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value.replace(/[^\d.,]/g, ''))}
                  inputMode="decimal"
                  placeholder="Jumlah"
                  aria-label="Jumlah masuk stok"
                  className={cn(fieldCls, 'bg-white py-2.5 pr-10 fs-13 tabular-nums dark:bg-slate-900')}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 fs-11 font-bold text-slate-400">
                  {mat.unit}
                </span>
              </span>
            )}
          </div>
          {mat && value > 0 && Number(parseQty(stockQty)) > 0 && (
            <p className="mt-1.5 fs-11 text-slate-500">
              ≈ {formatIDR(Math.round((value / parseQty(stockQty)) * 100) / 100)} per {mat.unit} — dipakai menghitung
              modal per produk.
            </p>
          )}
        </div>
      )}
      {locked ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 fs-13 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Dibayar dari <b>{locked.accountName ?? '—'}</b> · hari ini
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block min-w-0">
            <span className={labelCls}>{kasList ? 'Dibayar dari kas usaha' : 'Dibayar dari'}</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={!accounts?.length}
              className={fieldCls}
            >
              {accounts === null ? (
                <option>Memuat…</option>
              ) : accounts.length ? (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              ) : (
                <option value="">Belum ada rekening Rupiah</option>
              )}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Tanggal</span>
            <input
              type="date"
              value={date}
              max={toLocalDateString()}
              onChange={(e) => setDate(e.target.value)}
              className={cn(fieldCls, 'w-[150px]')}
            />
          </label>
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-slate-100 px-5 py-3 fs-14 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 py-3 fs-14 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Catat pengeluaran
        </button>
      </div>
      <p className="text-center fs-11 text-slate-400">
        {kasList
          ? `Masuk ke buku usaha sebagai biaya ${kind} — terpisah dari keuangan pribadimu.`
          : `Masuk sebagai pengeluaran Biaya Usaha › ${kind} — omzet tidak berkurang, laba bersih dihitung otomatis.`}
      </p>
    </div>
  );
}
