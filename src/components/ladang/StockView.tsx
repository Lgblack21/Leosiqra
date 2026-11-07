'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Wallet,
  Archive,
  ArchiveRestore,
  Check,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  History,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { groupProducts, type Shop } from '@/lib/services/shopService';
import {
  MOVE_LABEL,
  STOCK_UNITS,
  fmtQty,
  isLow,
  stockService,
  type StockData,
  type StockMaterial,
} from '@/lib/services/stockService';
import { cn, formatIDR } from '@/lib/utils';
import { fieldCls, labelCls } from './UsahaView';
import { lineKey } from './KasirView';

// Pembelian dicatat lewat "Biaya" supaya uang & stok sejalan; resep produk mengurangi stok otomatis saat terjual di kasir.

/** "30,25" / "30.25" / "1.910,5" / "1.500" (ribuan) / "1.000.000" → angka. */
export const parseQty = (v: string) => {
  const t = v.trim();
  if (!t) return NaN;
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  // Tanpa koma: titik dengan kelompok 3 angka = pemisah ribuan (gaya Indonesia), selain itu desimal.
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
};
const qtyCls = cn(fieldCls, 'tabular-nums');

/** Jalur API stok: pemilik (/api/member/…) atau akun tim (/api/staff/…, terbatas). */
export type StockApi = Pick<typeof stockService, 'get' | 'addMaterial' | 'move' | 'revert'> &
  Partial<Pick<typeof stockService, 'updateMaterial' | 'setRecipe'>>;
const StockCtx = createContext<{ api: StockApi; staff: boolean; actor?: string; onBuy?: (m: StockMaterial) => void }>({
  api: stockService,
  staff: false,
});
const useStock = () => useContext(StockCtx);
const ownerOnly = () => {
  throw new Error('Hanya pemilik usaha yang bisa mengubah ini.');
};
const tabCls = (on: boolean) =>
  cn(
    'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold transition-colors',
    on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400',
  );

/** onBuy: "Beli" di tiap bahan → buka Catat pengeluaran dengan bahan itu terpilih (uang & stok sejalan). */
export function StockView({
  shop,
  data,
  reload,
  onToast,
  api = stockService,
  staff = false,
  actor,
  onBuy,
}: {
  shop: Shop;
  data: StockData | null;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
  api?: StockApi;
  staff?: boolean;
  actor?: string;
  onBuy?: (m: StockMaterial) => void;
}) {
  const ctx = useMemo(() => ({ api, staff, actor, onBuy }), [api, staff, actor, onBuy]);
  return (
    <StockCtx.Provider value={ctx}>
      <StockTabs shop={shop} data={data} reload={reload} onToast={onToast} />
    </StockCtx.Provider>
  );
}

function StockTabs({
  shop,
  data,
  reload,
  onToast,
}: {
  shop: Shop;
  data: StockData | null;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const [tab, setTab] = useState<'bahan' | 'resep' | 'riwayat'>('bahan');
  if (!data)
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  const active = data.materials.filter((m) => !m.archived_at);
  const low = active.filter(isLow);
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" onClick={() => setTab('bahan')} className={tabCls(tab === 'bahan')}>
          <Package size={14} /> Daftar
          {low.length > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{low.length}</span>
          )}
        </button>
        <button type="button" onClick={() => setTab('resep')} className={tabCls(tab === 'resep')}>
          <FlaskConical size={14} /> Per produk
        </button>
        <button type="button" onClick={() => setTab('riwayat')} className={tabCls(tab === 'riwayat')}>
          <History size={14} /> Riwayat
        </button>
      </div>
      {tab === 'bahan' && <MaterialsTab shop={shop} data={data} reload={reload} onToast={onToast} />}
      {tab === 'resep' && <RecipesTab shop={shop} data={data} reload={reload} onToast={onToast} />}
      {tab === 'riwayat' && <HistoryTab shop={shop} data={data} reload={reload} onToast={onToast} />}
    </div>
  );
}

// ── Bahan ─────────────────────────────────────────────────────────────────────
function MaterialsTab({
  shop,
  data,
  reload,
  onToast,
}: {
  shop: Shop;
  data: StockData;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const { api, staff } = useStock();
  const [adding, setAdding] = useState(data.materials.length === 0);
  const [open, setOpen] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = data.materials.filter((m) => !m.archived_at);
  const archived = data.materials.filter((m) => m.archived_at);
  const sorted = [...active].sort((a, b) => Number(isLow(b)) - Number(isLow(a)));
  return (
    <div className="space-y-2.5">
      {active.length > 0 && active.some(isLow) && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0" />{' '}
          <span>
            {active.filter(isLow).length} stok hampir habis —{' '}
            {staff ? (
              <>
                kabari pemilik, atau catat pembelian lewat <b>Catat pengeluaran</b>.
              </>
            ) : (
              <>
                catat pembelian lewat tombol <b>Biaya</b> supaya uang & stok sejalan.
              </>
            )}
          </span>
        </p>
      )}
      {sorted.map((m) => (
        <MaterialCard
          key={m.id}
          shop={shop}
          m={m}
          open={open === m.id}
          toggle={() => setOpen(open === m.id ? null : m.id)}
          reload={reload}
          onToast={onToast}
        />
      ))}
      {adding ? (
        <AddMaterial
          shop={shop}
          onDone={async (msg) => {
            setAdding(false);
            await reload();
            onToast(msg);
          }}
          onCancel={active.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 py-3 text-[13px] font-bold text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400"
        >
          <Plus size={15} /> Tambah bahan / barang
        </button>
      )}
      {!staff && archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-[12px] font-bold text-slate-400 hover:text-slate-600"
          >
            {showArchived ? 'Sembunyikan' : 'Lihat'} arsip ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1.5">
              {archived.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-500 dark:bg-slate-800/50"
                >
                  <span className="truncate">
                    {m.name} · {fmtQty(m.stock)} {m.unit}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await (api.updateMaterial ?? ownerOnly)(shop.id, m.id, { archived: false });
                        await reload();
                        onToast(`${m.name} aktif lagi.`);
                      } catch (e) {
                        onToast(e instanceof Error ? e.message : 'Gagal.');
                      }
                    }}
                    className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-violet-600"
                  >
                    <ArchiveRestore size={13} /> Aktifkan
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StockBar({ m }: { m: StockMaterial }) {
  const min = m.min_stock ?? 0;
  const full = Math.max(min * 3, m.stock, 1);
  const pct = Math.max(0, Math.min(100, (m.stock / full) * 100));
  const tone = m.stock <= 0 ? 'bg-rose-500' : isLow(m) ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className="relative block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <span className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${pct}%` }} />
      {min > 0 && (
        <span
          className="absolute inset-y-0 w-0.5 bg-slate-400/70"
          style={{ left: `${Math.min(100, (min / full) * 100)}%` }}
        />
      )}
    </span>
  );
}

function MaterialCard({
  shop,
  m,
  open,
  toggle,
  reload,
  onToast,
}: {
  shop: Shop;
  m: StockMaterial;
  open: boolean;
  toggle: () => void;
  reload: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const { staff, onBuy } = useStock();
  const [mode, setMode] = useState<'masuk' | 'pakai' | 'opname' | 'edit'>('pakai');
  const low = isLow(m);
  return (
    <div
      className={cn(
        'rounded-2xl bg-white ring-1 dark:bg-slate-900',
        low ? 'ring-amber-200 dark:ring-amber-500/30' : 'ring-slate-100 dark:ring-slate-800',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-extrabold text-slate-900 dark:text-white">{m.name}</span>
            <span
              className={cn(
                'shrink-0 text-[15px] font-extrabold tabular-nums',
                m.stock <= 0 ? 'text-rose-600' : low ? 'text-amber-600' : 'text-slate-900 dark:text-white',
              )}
            >
              {fmtQty(m.stock)} <span className="text-[11px] font-bold text-slate-400">{m.unit}</span>
            </span>
          </span>
          <span className="mt-1.5 block">
            <StockBar m={m} />
          </span>
          <span className="mt-1 flex justify-between gap-2 text-[11px] text-slate-400">
            <span>{m.min_stock != null ? `Minimum ${fmtQty(m.min_stock)} ${m.unit}` : 'Tanpa batas minimum'}</span>
            {m.avg_cost != null && (
              <span className="tabular-nums">
                ≈ {formatIDR(m.avg_cost)}/{m.unit}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={16} className={cn('shrink-0 text-slate-300 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-slate-100 px-3.5 pb-3.5 pt-3 dark:border-slate-800">
          {onBuy && (
            <button
              type="button"
              onClick={() => onBuy(m)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 py-2.5 text-[12px] font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <Wallet size={14} /> Beli {m.name} — catat pengeluaran & stok masuk
            </button>
          )}
          <div className={cn('grid gap-1.5', staff ? 'grid-cols-3' : 'grid-cols-4')}>
            {(
              [
                ['pakai', 'Pakai', Minus],
                ['masuk', 'Masuk', Plus],
                ['opname', 'Hitung', ClipboardCheck],
                ['edit', 'Ubah', Pencil],
              ] as const
            )
              .filter(([k]) => !staff || k !== 'edit')
              .map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  aria-pressed={mode === k}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold',
                    mode === k
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
          </div>
          {mode === 'edit' ? (
            <EditMaterial
              key="edit"
              shop={shop}
              m={m}
              onDone={async (msg) => {
                await reload();
                onToast(msg);
                toggle();
              }}
            />
          ) : (
            <MoveForm
              key={mode}
              shop={shop}
              m={m}
              kind={mode}
              onDone={async (msg) => {
                await reload();
                onToast(msg);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MoveForm({
  shop,
  m,
  kind,
  onDone,
}: {
  shop: Shop;
  m: StockMaterial;
  kind: 'masuk' | 'pakai' | 'opname';
  onDone: (msg: string) => Promise<void>;
}) {
  const { api, staff } = useStock();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const n = parseQty(qty);
  const hint =
    kind === 'opname'
      ? 'Isi jumlah hasil hitung fisik — stok diganti ke angka ini, selisihnya tercatat.'
      : kind === 'masuk'
        ? `Stok masuk tanpa uang keluar (mis. sisa, retur, hadiah). Beli pakai uang → catat lewat ${staff ? 'Catat pengeluaran' : 'Biaya'}.`
        : 'Bahan terpakai di luar penjualan (uji coba, rusak, tumpah, sampel).';
  const save = async () => {
    if (!Number.isFinite(n) || n < 0 || (kind !== 'opname' && n === 0)) {
      setError('Isi jumlahnya.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.move(shop.id, { requestId, materialId: m.id, kind, qty: n, note: note.trim() || undefined });
      setRequestId(crypto.randomUUID());
      setQty('');
      setNote('');
      await onDone(
        kind === 'opname'
          ? `Stok ${m.name} disetel ke ${fmtQty(n)} ${m.unit} (selisih ${n - m.stock >= 0 ? '+' : '−'}${fmtQty(Math.abs(n - m.stock))}).`
          : `${m.name} ${kind === 'masuk' ? '+' : '−'}${fmtQty(n)} ${m.unit}.`,
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
    }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, '').slice(0, 14))}
            inputMode="decimal"
            placeholder={kind === 'opname' ? `Hasil hitung (sekarang ${fmtQty(m.stock)})` : 'Jumlah'}
            aria-label="Jumlah"
            className={cn(qtyCls, 'pr-14')}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">
            {m.unit}
          </span>
        </span>
        <button
          type="button"
          onClick={save}
          disabled={busy || !qty}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-violet-600 px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan
        </button>
      </div>
      {kind !== 'opname' && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={80}
          placeholder="Catatan (opsional)"
          className={cn(fieldCls, 'py-2.5 text-[13px]')}
        />
      )}
      {kind === 'opname' && Number.isFinite(n) && qty && (
        <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          Selisih:{' '}
          <span className={n - m.stock < 0 ? 'text-rose-600' : 'text-emerald-600'}>
            {n - m.stock >= 0 ? '+' : '−'}
            {fmtQty(Math.abs(n - m.stock))} {m.unit}
          </span>
        </p>
      )}
    </div>
  );
}

function UnitPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const custom = !(STOCK_UNITS as readonly string[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STOCK_UNITS.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          aria-pressed={value === u}
          className={cn(
            'rounded-full px-3 py-1.5 text-[12px] font-bold',
            value === u
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {u}
        </button>
      ))}
      <input
        value={custom ? value : ''}
        onChange={(e) => onChange(e.target.value.replace(/\s+/g, ' ').slice(0, 12))}
        placeholder="lainnya…"
        aria-label="Satuan lain"
        className={cn(
          'w-24 rounded-full px-3 py-1.5 text-[12px] font-bold outline-none ring-2',
          custom && value
            ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900'
            : 'bg-slate-100 text-slate-600 ring-transparent focus:ring-violet-500 dark:bg-slate-800 dark:text-slate-300',
        )}
      />
    </div>
  );
}

function AddMaterial({
  shop,
  onDone,
  onCancel,
}: {
  shop: Shop;
  onDone: (msg: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const { api } = useStock();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [stock, setStock] = useState('');
  const [min, setMin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const s = stock ? parseQty(stock) : 0;
    const mn = min ? parseQty(min) : null;
    if (!name.trim()) {
      setError('Isi nama bahan.');
      return;
    }
    if (!Number.isFinite(s) || s < 0 || (mn !== null && (!Number.isFinite(mn) || mn < 0))) {
      setError('Angka stok tidak valid.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addMaterial(shop.id, { name: name.trim(), unit, stock: s, min: mn });
      await onDone(`${name.trim()} ditambahkan.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl bg-violet-50/60 p-3.5 ring-1 ring-violet-100 dark:bg-violet-500/5 dark:ring-violet-500/20">
      <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">Bahan / barang baru</p>
      <p className="-mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Bahan baku yang diolah (tepung, kopi, kain) atau barang yang dijual apa adanya (mi instan, kaos).
      </p>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Nama</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="mis. Tepung terigu, Kopi bubuk, Kaos hitam L, Kemasan"
          className={fieldCls}
        />
      </label>
      <div>
        <span className={labelCls}>Satuan</span>
        <UnitPicker value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Stok sekarang</span>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="0"
            className={qtyCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Ingatkan di bawah</span>
          <input
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="opsional"
            className={qtyCls}
          />
        </label>
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
        </button>
      </div>
    </div>
  );
}

function EditMaterial({ shop, m, onDone }: { shop: Shop; m: StockMaterial; onDone: (msg: string) => Promise<void> }) {
  const { api } = useStock();
  const [name, setName] = useState(m.name);
  const [unit, setUnit] = useState(m.unit);
  const [min, setMin] = useState(m.min_stock != null ? String(m.min_stock).replace('.', ',') : '');
  const [stock, setStock] = useState(String(m.stock).replace('.', ','));
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (input: Parameters<typeof stockService.updateMaterial>[2], msg: string) => {
    setBusy(true);
    setError('');
    try {
      await (api.updateMaterial ?? ownerOnly)(shop.id, m.id, input);
      await onDone(msg);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  const mn = min ? parseQty(min) : null;
  const st = parseQty(stock);
  const stockChanged = Number.isFinite(st) && Math.abs(st - m.stock) > 1e-9;
  const infoChanged = name.trim() !== m.name || unit !== m.unit || mn !== m.min_stock;
  // Stok diubah manual = dicatat sebagai hitung fisik (selisih tercatat di Riwayat), bukan ditimpa diam-diam.
  const save = async () => {
    if (!Number.isFinite(st) || st < 0) {
      setError('Jumlah stok tidak valid.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (infoChanged) await (api.updateMaterial ?? ownerOnly)(shop.id, m.id, { name: name.trim(), unit, min: mn });
      if (stockChanged)
        await api.move(shop.id, { requestId, materialId: m.id, kind: 'opname', qty: st, note: 'Diubah manual' });
      await onDone(
        stockChanged
          ? `Stok ${name.trim()} jadi ${fmtQty(st)} ${unit} (selisih ${st - m.stock >= 0 ? '+' : '−'}${fmtQty(Math.abs(st - m.stock))}).`
          : 'Bahan disimpan.',
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2.5">
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Nama</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          aria-label="Nama bahan"
          className={fieldCls}
        />
      </label>
      <div>
        <span className={labelCls}>Satuan</span>
        <UnitPicker value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Stok sekarang</span>
          <span className="relative block">
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/[^\d.,]/g, '').slice(0, 14))}
              inputMode="decimal"
              aria-label="Stok sekarang"
              className={cn(qtyCls, 'pr-12', stockChanged && 'ring-amber-400')}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">
              {unit}
            </span>
          </span>
        </label>
        <label className="block">
          <span className={labelCls}>Ingatkan di bawah</span>
          <input
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="tanpa batas"
            aria-label="Batas minimum"
            className={qtyCls}
          />
        </label>
      </div>
      {stockChanged && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Stok {fmtQty(m.stock)} → {fmtQty(st)} {unit} (selisih{' '}
          <span className={st - m.stock < 0 ? 'text-rose-600' : 'text-emerald-700'}>
            {st - m.stock >= 0 ? '+' : '−'}
            {fmtQty(Math.abs(st - m.stock))}
          </span>
          ). Tercatat di Riwayat sebagai &ldquo;Diubah manual&rdquo;.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ archived: true }, `${m.name} diarsipkan (riwayat tetap ada).`)}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <Archive size={14} /> Arsipkan
        </button>
        <button
          type="button"
          disabled={
            busy ||
            !name.trim() ||
            !stock ||
            (!infoChanged && !stockChanged) ||
            (mn !== null && (!Number.isFinite(mn) || mn < 0))
          }
          onClick={save}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan
        </button>
      </div>
    </div>
  );
}

// ── Resep produk ──────────────────────────────────────────────────────────────
function RecipesTab({
  shop,
  data,
  reload,
  onToast,
}: {
  shop: Shop;
  data: StockData;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const { staff } = useStock();
  const [edit, setEdit] = useState<string | null>(null);
  const active = data.materials.filter((m) => !m.archived_at);
  const byId = useMemo(() => new Map(data.materials.map((m) => [m.id, m])), [data.materials]);
  const recipeOf = useMemo(() => new Map(data.recipes.map((r) => [r.product_key, r.items])), [data.recipes]);
  const groups = groupProducts(shop.products);
  if (!shop.products.length)
    return (
      <p className="rounded-2xl bg-slate-50 p-5 text-center text-[13px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        Isi katalog produk dulu, lalu atur bahan per produk di sini.
      </p>
    );
  if (!active.length)
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-slate-50 p-5 text-center text-[13px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          Tambahkan bahan atau barang dulu di tab <b>Daftar</b> — atau pakai tombol di bawah untuk toko barang jadi.
        </p>
        {!staff && <OneToOne shop={shop} data={data} reload={reload} onToast={onToast} />}
      </div>
    );
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Isi apa yang terpakai untuk <b>1 produk</b> — mis. 1 Nasi goreng = 200 gram beras + 1 telur, atau 1 Kaos L = 1
        pcs Kaos L. Setiap terjual di kasir (kamu atau tim), stoknya berkurang otomatis; modal & untung per produk
        dihitung dari harga beli rata-rata.
      </p>
      {staff ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          Diatur oleh pemilik usaha — kamu bisa melihat saja.
        </p>
      ) : (
        <OneToOne shop={shop} data={data} reload={reload} onToast={onToast} />
      )}
      {groups.map((g) => (
        <div key={g.group || '_'} className="space-y-1.5">
          {g.group && <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.group}</p>}
          {g.items.map(({ p }) => {
            const key = lineKey(p);
            const items = recipeOf.get(key) ?? [];
            const cost = items.every((i) => byId.get(i.m)?.avg_cost != null)
              ? items.reduce((a, i) => a + i.q * (byId.get(i.m)?.avg_cost ?? 0), 0)
              : null;
            const open = edit === key;
            return (
              <div
                key={key}
                className="rounded-2xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"
              >
                <button
                  type="button"
                  disabled={staff}
                  onClick={() => setEdit(open ? null : key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:cursor-default"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatIDR(p.price)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-slate-500 dark:text-slate-400">
                      {items.length ? (
                        items
                          .map((i) => `${byId.get(i.m)?.name ?? '?'} ${fmtQty(i.q)}${byId.get(i.m)?.unit ?? ''}`)
                          .join(' · ')
                      ) : (
                        <span className="text-amber-600">Belum diatur — stok tidak berkurang saat terjual</span>
                      )}
                    </span>
                    {items.length > 0 && cost != null && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">
                        Modal ≈ {formatIDR(Math.round(cost))} · untung ≈{' '}
                        <span className={p.price - cost >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatIDR(Math.round(p.price - cost))}
                        </span>
                      </span>
                    )}
                  </span>
                  {!staff && (
                    <ChevronRight
                      size={16}
                      className={cn('shrink-0 text-slate-300 transition-transform', open && 'rotate-90')}
                    />
                  )}
                </button>
                {open && !staff && (
                  <RecipeEditor
                    shop={shop}
                    productKey={key}
                    initial={items}
                    materials={active}
                    onDone={async (msg) => {
                      await reload();
                      setEdit(null);
                      onToast(msg);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Toko barang jadi (kelontong, baju, aksesoris): tiap produk katalog = 1 barang stok.
function OneToOne({
  shop,
  data,
  reload,
  onToast,
}: {
  shop: Shop;
  data: StockData;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const { api } = useStock();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const has = new Set(data.recipes.map((r) => r.product_key));
  const todo = shop.products.filter((p) => !has.has(lineKey(p)));
  const room = 100 - data.materials.length;
  if (!todo.length) return null;
  const run = async () => {
    setBusy(true);
    let done = 0;
    const byName = new Map(data.materials.filter((m) => !m.archived_at).map((m) => [m.name.toLowerCase(), m.id]));
    try {
      for (const p of todo.slice(0, Math.max(0, room))) {
        const name = (
          p.group && !p.name.toLowerCase().includes(p.group.toLowerCase()) ? `${p.group} ${p.name}` : p.name
        ).slice(0, 60);
        let id = byName.get(name.toLowerCase());
        if (!id) {
          id = (await api.addMaterial(shop.id, { name, unit: 'pcs', stock: 0, min: null })).id;
          byName.set(name.toLowerCase(), id);
        }
        await (api.setRecipe ?? ownerOnly)(shop.id, lineKey(p), [{ materialId: id, qty: 1 }]);
        done += 1;
      }
      onToast(`${done} produk jadi barang stok. Isi jumlahnya lewat Daftar › Hitung.`);
    } catch (e) {
      onToast(e instanceof Error && e.message ? `${done} selesai, lalu gagal: ${e.message}` : 'Gagal.');
    }
    await reload();
    setBusy(false);
    setAsk(false);
  };
  return (
    <div className="rounded-2xl bg-sky-50 p-3.5 ring-1 ring-sky-100 dark:bg-sky-500/10 dark:ring-sky-500/20">
      <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">Jual barang jadi?</p>
      <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">
        Untuk toko kelontong, baju, aksesoris, dll: tiap produk dijadikan 1 barang stok (1 terjual = stok −1).{' '}
        {todo.length} produk belum punya aturan stok
        {todo.length > room ? ` — maksimal ${Math.max(0, room)} sekaligus` : ''}.
      </p>
      {ask ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => setAsk(false)}
            disabled={busy}
            className="rounded-full bg-white px-4 py-2 text-[12px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || room <= 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sky-600 py-2 text-[12px] font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Ya, buat{' '}
            {Math.min(todo.length, Math.max(0, room))} barang stok
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsk(true)}
          className="mt-2.5 rounded-full bg-sky-600 px-4 py-2 text-[12px] font-bold text-white"
        >
          Jadikan stok 1:1
        </button>
      )}
    </div>
  );
}

function RecipeEditor({
  shop,
  productKey,
  initial,
  materials,
  onDone,
}: {
  shop: Shop;
  productKey: string;
  initial: { m: string; q: number }[];
  materials: StockMaterial[];
  onDone: (msg: string) => Promise<void>;
}) {
  const { api } = useStock();
  const [rows, setRows] = useState<{ m: string; q: string }[]>(() =>
    initial.length
      ? initial.map((i) => ({ m: i.m, q: String(i.q).replace('.', ',') }))
      : [{ m: materials[0]?.id ?? '', q: '1' }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unitOf = (id: string) => materials.find((x) => x.id === id)?.unit ?? '';
  const save = async (clear = false) => {
    const items = clear ? [] : rows.filter((r) => r.m).map((r) => ({ materialId: r.m, qty: parseQty(r.q) }));
    if (items.some((i) => !Number.isFinite(i.qty) || i.qty <= 0)) {
      setError('Isi jumlah tiap bahan (lebih dari 0).');
      return;
    }
    if (new Set(items.map((i) => i.materialId)).size !== items.length) {
      setError('Ada bahan yang dipilih dua kali.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await (api.setRecipe ?? ownerOnly)(shop.id, productKey, items);
      await onDone(
        clear || !items.length ? 'Aturan stok dihapus.' : 'Tersimpan — stok berkurang otomatis saat terjual.',
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 border-t border-slate-100 px-3.5 pb-3.5 pt-3 dark:border-slate-800">
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.m}
            onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, m: e.target.value } : x)))}
            aria-label="Bahan"
            className={cn(fieldCls, 'min-w-0 flex-1 py-2.5 text-[13px]')}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="relative w-28 shrink-0">
            <input
              value={r.q}
              onChange={(e) =>
                setRows(rows.map((x, k) => (k === i ? { ...x, q: e.target.value.replace(/[^\d.,]/g, '') } : x)))
              }
              inputMode="decimal"
              aria-label="Jumlah per produk"
              className={cn(qtyCls, 'py-2.5 pr-9 text-[13px]')}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
              {unitOf(r.m)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, k) => k !== i))}
            aria-label="Hapus bahan"
            className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      {rows.length < 15 && (
        <button
          type="button"
          onClick={() =>
            setRows([
              ...rows,
              { m: materials.find((m) => !rows.some((r) => r.m === m.id))?.id ?? materials[0]?.id ?? '', q: '1' },
            ])
          }
          className="flex items-center gap-1 text-[12px] font-bold text-violet-600 dark:text-violet-300"
        >
          <Plus size={14} /> Bahan lain
        </button>
      )}
      <div className="flex gap-2 pt-1">
        {initial.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save(true)}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <Trash2 size={14} /> Hapus
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => save()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-violet-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan
        </button>
      </div>
    </div>
  );
}

// ── Riwayat ───────────────────────────────────────────────────────────────────
const MANUAL_KINDS = new Set(['awal', 'masuk', 'pakai', 'opname']);
function HistoryTab({
  shop,
  data,
  reload,
  onToast,
}: {
  shop: Shop;
  data: StockData;
  reload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const { api, staff, actor } = useStock();
  const byId = new Map(data.materials.map((m) => [m.id, m]));
  const [filter, setFilter] = useState('');
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  // Catatan manual yang belum dibatalkan; tim hanya miliknya sendiri hari ini (server juga memeriksa).
  // Sudah ada hitung fisik sesudahnya → tidak bisa dibatalkan (betulkan lewat Ubah), sama dengan aturan server.
  const coveredByOpname = (x: StockData['moves'][number]) =>
    data.moves.some(
      (o) =>
        o.id !== x.id &&
        o.material_id === x.material_id &&
        o.kind === 'opname' &&
        !o.reverted_at &&
        o.created_at > x.created_at,
    );
  const canUndo = (x: StockData['moves'][number]) =>
    !x.reverted_at &&
    !x.linked &&
    MANUAL_KINDS.has(x.kind) &&
    !coveredByOpname(x) &&
    (!staff || (x.by_name === actor && x.date === today));
  const undo = async (x: StockData['moves'][number]) => {
    setBusy(true);
    try {
      await api.revert(shop.id, x.id);
      await reload();
      onToast(
        `Dibatalkan — stok ${byId.get(x.material_id)?.name ?? ''} kembali ${x.qty < 0 ? '+' : '−'}${fmtQty(Math.abs(x.qty))}.`,
      );
    } catch (e) {
      onToast(e instanceof Error && e.message ? e.message : 'Gagal membatalkan.');
    }
    setBusy(false);
    setAsk(null);
  };
  const list = data.moves.filter((x) => !filter || x.material_id === filter);
  if (!data.moves.length)
    return (
      <p className="rounded-2xl bg-slate-50 p-5 text-center text-[13px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        Belum ada riwayat stok.
      </p>
    );
  return (
    <div className="space-y-2">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Saring bahan"
        className={cn(fieldCls, 'py-2.5 text-[13px]')}
      >
        <option value="">Semua bahan</option>
        {data.materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-white px-3.5 ring-1 ring-slate-100 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        {list.map((x) => {
          const m = byId.get(x.material_id);
          const out = x.qty < 0;
          return (
            <li
              key={x.id}
              className={cn('flex items-center justify-between gap-3 py-2.5', x.reverted_at && 'opacity-50')}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  {m?.name ?? 'Bahan'} · <span className="text-slate-500">{MOVE_LABEL[x.kind] ?? x.kind}</span>
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {new Date(x.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  {x.by_name ? ` · oleh ${x.by_name}` : ''}
                  {x.note ? ` · ${x.note}` : ''}
                  {x.cost ? ` · ${formatIDR(x.cost)}` : ''}
                  {x.reverted_at ? ' · dibatalkan' : ''}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    'text-[13px] font-extrabold tabular-nums',
                    x.reverted_at ? 'text-slate-400 line-through' : out ? 'text-rose-600' : 'text-emerald-600',
                  )}
                >
                  {out ? '−' : '+'}
                  {fmtQty(Math.abs(x.qty))} {m?.unit ?? ''}
                </span>
                {canUndo(x) &&
                  (ask === x.id ? (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setAsk(null)}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Tidak
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => undo(x)}
                        className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white"
                      >
                        {busy && <Loader2 size={11} className="animate-spin" />} Ya, batalkan
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAsk(x.id)}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600"
                    >
                      Batalkan
                    </button>
                  ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
