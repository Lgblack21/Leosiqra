"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud, FolderOpen, Loader2, Check, ChevronDown, ChevronRight, Lock, Download, FileSpreadsheet, Zap, Mail, Hash,
  Smartphone, Undo2, AlertTriangle, SlidersHorizontal, X,
} from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionImportService, type ImportBatch, type ImportRow } from '@/lib/services/transactionImportService';
import { notifyCollectionChanged, subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { extractPdfText } from '@/lib/pdfText';
import { parseBcaStatementText } from '@/lib/bcaStatementParser';
import {
  tableFromCsv, tableFromXlsx, guessMapping, mappingReady, rowsFromTable, chunkText, imageToJpegBase64, IMPORT_CSV_TEMPLATE,
  type ColumnMapping, type ParsedRow, type Table,
} from '@/lib/importParsers';
import { AccountPicker } from '@/components/app/AccountPicker';
import { TxTypeToggle } from '@/components/app/TxTypeToggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { CategorySelect } from '@/components/CategorySelect';
import { useFeedback } from '@/components/ui/Feedback';

// Impor mutasi bank/e-wallet. CSV & Excel dibaca di browser, PDF BCA dengan
// parser sendiri, PDF lain & tangkapan layar dibaca AI (kuota harian). Semua
// baris DITINJAU dulu; yang tersimpan hanya yang dicentang. Impor = riwayat:
// saldo rekening tidak berubah. Tiap impor bisa dibatalkan dari Riwayat.

type Template = 'auto' | 'bca' | 'ai';
type Draft = ImportRow & { key: number; include: boolean; duplicate: boolean };

const TEMPLATES: { id: Template; label: string; desc: string }[] = [
  { id: 'auto', label: 'Deteksi otomatis', desc: 'CSV/Excel dibaca langsung, PDF BCA dengan pembaca khusus, sisanya AI' },
  { id: 'bca', label: 'BCA (e-statement PDF)', desc: 'Rekening koran BCA dari KlikBCA/myBCA' },
  { id: 'ai', label: 'Bank lain (dibaca AI)', desc: 'PDF & tangkapan layar aplikasi bank apa pun' },
];
const MAX_ROWS = 1000;
const dateShort = (ymd: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(`${ymd}T00:00:00`));
const dateTime = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

function DraftRow({ draft, currency, onChange }: { draft: Draft; currency?: string; onChange: (patch: Partial<Draft>) => void }) {
  const [open, setOpen] = useState(false);
  const incoming = draft.type === 'pemasukan';
  return (
    <li className={cn('rounded-[18px] bg-white ring-1 ring-slate-100', !draft.include && 'opacity-60')}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => onChange({ include: !draft.include })}
          aria-label={draft.include ? 'Jangan simpan baris ini' : 'Simpan baris ini'}
          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1', draft.include ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white ring-slate-300')}
        >
          {draft.include && <Check size={15} strokeWidth={3} />}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-slate-900">{draft.note || 'Tanpa keterangan'}</span>
            <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
              {dateShort(draft.date)}
              {draft.category && <span>· {draft.category}</span>}
              {draft.duplicate && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-700">Sudah ada</span>}
            </span>
          </span>
          <span className={cn('whitespace-nowrap text-[14px] font-bold tabular-nums', incoming ? 'text-emerald-600' : 'text-slate-900')}>
            {incoming ? '+' : '−'}{formatMoney(draft.amount, currency)}
          </span>
          <ChevronDown size={16} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <TxTypeToggle value={draft.type} onChange={(type) => onChange({ type, category: null, sub_category: null })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl bg-slate-50 px-4 py-2">
              <span className="text-[12px] font-semibold text-slate-500">Nominal{currency ? ` (${currency})` : ''}</span>
              <NumberInput value={String(draft.amount)} onChange={(v) => onChange({ amount: Number(v || '0') })} className="w-full bg-transparent text-[18px] font-bold tabular-nums text-slate-900 outline-none" />
            </label>
            <label className="block rounded-2xl bg-slate-50 px-4 py-2">
              <span className="text-[12px] font-semibold text-slate-500">Tanggal</span>
              <input type="date" value={draft.date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} className="w-full bg-transparent text-[16px] font-semibold text-slate-900 outline-none" />
            </label>
          </div>
          <input value={draft.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Keterangan" className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-[15px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400" />
          <CategorySelect
            label="Kategori (kosong = Impor Mutasi)"
            value={draft.category ?? ''}
            type={incoming ? 'income' : 'expense'}
            onChange={(category) => onChange({ category })}
            onSubCategoryChange={(sub_category) => onChange({ sub_category })}
            subValue={draft.sub_category ?? ''}
            showBadge={false}
          />
        </div>
      )}
    </li>
  );
}

function MappingPanel({ table, mapping, onChange }: { table: Table; mapping: ColumnMapping; onChange: (m: ColumnMapping) => void }) {
  const select = (label: string, key: 'date' | 'note' | 'amount' | 'debit' | 'credit') => (
    <label className="block">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <select value={mapping[key]} onChange={(e) => onChange({ ...mapping, [key]: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-[14px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400">
        <option value="">— tidak ada —</option>
        {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );
  return (
    <div className="space-y-3 rounded-[20px] bg-slate-50 p-4">
      <p className="text-[13px] text-slate-600">Cocokkan kolom file dengan data transaksi. Contoh baris pertama: <span className="font-mono text-[12px]">{(table.rows[0] ?? []).slice(0, 5).join(' | ')}</span></p>
      <div className="grid gap-3 sm:grid-cols-2">
        {select('Tanggal', 'date')}
        {select('Keterangan', 'note')}
      </div>
      <div className="flex gap-2">
        {(['single', 'debit_credit'] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => onChange({ ...mapping, mode })} className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1', mapping.mode === mode ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
            {mode === 'single' ? 'Satu kolom nominal (+/−)' : 'Kolom debit & kredit'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mapping.mode === 'single' ? select('Nominal', 'amount') : (<>{select('Debit (keluar)', 'debit')}{select('Kredit (masuk)', 'credit')}</>)}
      </div>
    </div>
  );
}

function OtherWay({ href, icon: Icon, title, desc, download }: { href: string; icon: React.ElementType; title: string; desc: string; download?: string }) {
  return (
    <a href={href} download={download} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
        <span className="block text-[13px] text-slate-500">{desc}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-300" />
    </a>
  );
}

export default function ImporPage() {
  const { toast, confirm } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [template, setTemplate] = useState<Template>('auto');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ImportBatch[] | null>(null);
  const [undoing, setUndoing] = useState('');

  useEffect(() => {
    const load = () =>
      accountService
        .getUserAccounts('')
        .then((list) => {
          setAccounts(list);
          setAccountId((cur) => cur || list[0]?.id || '');
        })
        .catch(() => setAccounts([]));
    load();
    return subscribeToCollectionChanges('accounts', load);
  }, []);

  const loadHistory = useCallback(() => {
    transactionImportService.history().then(setHistory).catch(() => setHistory([]));
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const account = accounts.find((a) => a.id === accountId);

  // Baris hasil baca → draf tinjauan; yang sudah ada di rekening tidak dicentang.
  const applyRows = useCallback(async (parsed: ParsedRow[], forAccount: string) => {
    const valid = parsed.filter((r) => r.date && r.amount > 0);
    if (!valid.length) {
      setDrafts(null);
      setError('Tidak ada baris transaksi yang terbaca. Cek pemetaan kolom, atau coba template lain.');
      return;
    }
    if (valid.length > MAX_ROWS) toast.info(`File berisi ${valid.length} baris — hanya ${MAX_ROWS} pertama yang ditampilkan.`);
    const list = valid.slice(0, MAX_ROWS);
    let dup = new Set<number>();
    if (forAccount) dup = await transactionImportService.findDuplicates(forAccount, list).catch(() => new Set<number>());
    setError('');
    setDrafts(list.map((r, i) => ({ ...r, key: i, include: !dup.has(i), duplicate: dup.has(i), category: null, sub_category: null })));
  }, [toast]);

  // Ganti rekening saat meninjau → cek dobel ulang terhadap rekening baru.
  useEffect(() => {
    if (!accountId || !drafts?.length) return;
    let alive = true;
    transactionImportService
      .findDuplicates(accountId, drafts)
      .then((dup) => {
        if (alive) setDrafts((cur) => cur?.map((d, i) => ({ ...d, duplicate: dup.has(i), include: dup.has(i) ? false : d.duplicate ? true : d.include })) ?? cur);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat rekening berubah
  }, [accountId]);

  const reset = () => {
    setFileName('');
    setTable(null);
    setMapping(null);
    setShowMapping(false);
    setDrafts(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const readFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!accountId) {
      setError('Tambahkan rekening dulu di menu Rekening, lalu pilih rekening pemilik mutasi ini.');
      return;
    }
    reset();
    const first = files[0];
    setFileName(files.length > 1 ? `${files.length} gambar` : first.name);
    const ext = extOf(first.name);
    try {
      if (ext === 'csv' || first.type === 'text/csv') {
        setReading('Membaca CSV…');
        const t = tableFromCsv(await first.text());
        await loadTable(t);
      } else if (ext === 'xlsx') {
        setReading('Membaca Excel…');
        await loadTable(await tableFromXlsx(first));
      } else if (ext === 'xls') {
        setError('Format XLS lama belum didukung. Buka file-nya lalu simpan ulang sebagai XLSX atau CSV.');
      } else if (ext === 'pdf' || first.type === 'application/pdf') {
        setReading('Membaca PDF…');
        const text = await extractPdfText(first);
        if (template !== 'ai') {
          const bca = parseBcaStatementText(text);
          if (bca.length) {
            await applyRows(bca.map(({ date, note, amount, type }) => ({ date, note, amount, type })), accountId);
            return;
          }
          if (template === 'bca') {
            setError('Tidak ada transaksi BCA yang terbaca. Pastikan ini e-statement BCA, atau pilih "Bank lain (dibaca AI)".');
            return;
          }
        }
        const chunks = chunkText(text);
        if (!chunks.length || text.replace(/\s/g, '').length < 40) {
          setError('PDF ini tidak berisi teks (mungkin hasil scan). Coba unggah tangkapan layarnya.');
          return;
        }
        const rows: ParsedRow[] = [];
        for (let i = 0; i < chunks.length; i++) {
          setReading(chunks.length > 1 ? `AI membaca bagian ${i + 1} dari ${chunks.length}…` : 'AI membaca mutasi…');
          rows.push(...(await transactionImportService.readWithAi({ text: chunks[i] })));
        }
        await applyRows(rows, accountId);
      } else if (first.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext)) {
        const rows: ParsedRow[] = [];
        const images = files.filter((f) => f.type.startsWith('image/')).slice(0, 10);
        for (let i = 0; i < images.length; i++) {
          setReading(images.length > 1 ? `AI membaca gambar ${i + 1} dari ${images.length}…` : 'AI membaca tangkapan layar…');
          rows.push(...(await transactionImportService.readWithAi({ imageBase64: await imageToJpegBase64(images[i]) })));
        }
        await applyRows(rows, accountId);
      } else {
        setError('Format belum didukung. Pakai PDF, XLSX, CSV, atau gambar (PNG/JPG).');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca file.');
    } finally {
      setReading('');
    }
  };

  async function loadTable(t: Table) {
    if (!t.rows.length) {
      setError('File tidak berisi baris data.');
      return;
    }
    const m = guessMapping(t.headers);
    setTable(t);
    setMapping(m);
    if (!mappingReady(m)) {
      setShowMapping(true);
      setError('Kolom tanggal/nominal tidak terdeteksi otomatis — pilih kolomnya di bawah.');
      return;
    }
    await applyRows(rowsFromTable(t, m), accountId);
  }

  const changeMapping = async (m: ColumnMapping) => {
    setMapping(m);
    if (table && mappingReady(m)) await applyRows(rowsFromTable(table, m), accountId);
  };

  const patchDraft = (key: number, patch: Partial<Draft>) => setDrafts((cur) => cur?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? cur);
  const chosen = drafts?.filter((d) => d.include && d.amount > 0) ?? [];
  const totalIn = chosen.filter((d) => d.type === 'pemasukan').reduce((s, d) => s + d.amount, 0);
  const totalOut = chosen.filter((d) => d.type === 'pengeluaran').reduce((s, d) => s + d.amount, 0);
  const duplicateCount = drafts?.filter((d) => d.duplicate).length ?? 0;
  const allChosen = Boolean(drafts?.length) && drafts!.every((d) => d.include);

  const save = async () => {
    if (!chosen.length || !accountId) return;
    setSaving(true);
    try {
      const res = await transactionImportService.importTransactions(
        accountId,
        chosen.map(({ date, note, amount, type, category, sub_category }) => ({ date, note, amount, type, category, sub_category })),
        fileName
      );
      toast.success(`${res.inserted} transaksi disimpan${res.skipped ? `, ${res.skipped} dilewati (sudah ada/tidak valid)` : ''}.`);
      notifyCollectionChanged('transactions');
      reset();
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan impor.');
    } finally {
      setSaving(false);
    }
  };

  const undo = async (batch: ImportBatch) => {
    const ok = await confirm({
      title: 'Batalkan impor ini?',
      message: `${batch.rows_count} transaksi dari "${batch.name ?? 'Impor mutasi'}" akan dihapus. Saldo rekening tidak berubah.`,
      confirmLabel: 'Batalkan impor',
      danger: true,
    });
    if (!ok) return;
    setUndoing(batch.id);
    try {
      const r = await transactionImportService.undo(batch.id);
      toast.success(`${r.deleted} transaksi impor dihapus.`);
      notifyCollectionChanged('transactions');
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membatalkan impor.');
    } finally {
      setUndoing('');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[38px]">Impor</h1>
        <p className="mt-1 text-[15px] text-slate-500">Masukkan mutasi bank & e-wallet, lalu tinjau setiap baris sebelum disimpan.</p>
      </div>

      <section className="space-y-4 rounded-[26px] bg-white p-4 ring-1 ring-slate-100 sm:p-6">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Impor mutasi</h2>
          <p className="text-[14px] text-slate-500">Pilih rekening pemilik mutasi ini, lalu taruh file-nya.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Rekening" />
          <label className="block">
            <span className="pl-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Template bank/penyedia</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value as Template)} className="mt-1 w-full rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] font-semibold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400">
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="mt-1 block pl-1 text-[12px] text-slate-500">{TEMPLATES.find((t) => t.id === template)?.desc}</span>
          </label>
        </div>

        {!drafts && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void readFiles(Array.from(e.dataTransfer.files)); }}
            className={cn('flex flex-col items-center gap-3 rounded-[22px] border-2 border-dashed px-5 py-10 text-center transition-colors', dragging ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-slate-50')}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-100">
              {reading ? <Loader2 size={28} className="animate-spin text-indigo-600" /> : <UploadCloud size={28} />}
            </span>
            <p className="text-[18px] font-bold text-slate-900">{reading || 'Taruh file mutasi di sini'}</p>
            {!reading && (
              <>
                <p className="max-w-lg text-[14px] leading-relaxed text-slate-500">
                  CSV & Excel dibaca langsung di perangkatmu. PDF bank lain & tangkapan layar aplikasi bank dibaca AI (maks. 40 halaman/gambar per hari). Kamu meninjau setiap baris sebelum ada yang disimpan.
                </p>
                <p className="flex max-w-lg items-start gap-1.5 text-[13px] text-slate-500">
                  <Lock size={14} className="mt-0.5 shrink-0 text-emerald-600" /> File tidak disimpan di server — hanya baris yang kamu pilih yang tercatat. Impor tidak mengubah saldo rekening.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['PDF', 'XLSX', 'CSV', 'Tangkapan layar'].map((f) => <span key={f} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200">{f}</span>)}
                </div>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-[15px] font-bold text-white hover:bg-indigo-600">
                  <FolderOpen size={17} /> Pilih file
                </button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.pdf,image/*,text/csv,application/pdf"
              className="hidden"
              onChange={(e) => void readFiles(Array.from(e.target.files ?? []))}
            />
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {table && mapping && (drafts || showMapping) && (
          <div className="space-y-2">
            <button type="button" onClick={() => setShowMapping((v) => !v)} className="flex items-center gap-2 text-[13px] font-semibold text-indigo-600">
              <SlidersHorizontal size={14} /> {showMapping ? 'Tutup pemetaan kolom' : 'Kolom salah? Atur pemetaan kolom'}
            </button>
            {showMapping && <MappingPanel table={table} mapping={mapping} onChange={(m) => void changeMapping(m)} />}
          </div>
        )}

        {drafts && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] text-slate-600">
                <span className="font-semibold text-slate-900">{fileName}</span> · {drafts.length} baris{duplicateCount ? ` · ${duplicateCount} sudah ada (tidak dicentang)` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDrafts((cur) => cur?.map((d) => ({ ...d, include: !allChosen })) ?? cur)} className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">
                  {allChosen ? 'Kosongkan semua' : 'Pilih semua'}
                </button>
                <button type="button" onClick={reset} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">
                  <X size={14} /> Ganti file
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {drafts.map((d) => <DraftRow key={d.key} draft={d} currency={account?.currency} onChange={(p) => patchDraft(d.key, p)} />)}
            </ul>
            {/* fixed (bukan sticky): pembungkus layout memakai overflow-x-hidden. Offset kiri = lebar sidebar. */}
            <div className="h-20" aria-hidden />
            <div className="fixed inset-x-0 bottom-[84px] z-30 px-4 md:bottom-5 md:left-[84px] lg:left-72">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-[22px] bg-slate-900 p-3 pl-5 text-white shadow-2xl">
              <span className="min-w-0 flex-1 text-[13px] leading-tight">
                <span className="block font-semibold">{chosen.length} dari {drafts.length} baris dipilih</span>
                <span className="text-slate-300">
                  Masuk {formatMoney(totalIn, account?.currency)} · Keluar {formatMoney(totalOut, account?.currency)}
                </span>
              </span>
              <button type="button" onClick={() => void save()} disabled={!chosen.length || saving} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-bold text-slate-900 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan {chosen.length}
              </button>
            </div>
            </div>
          </div>
        )}
      </section>


      <section className="space-y-3 rounded-[26px] bg-white p-4 ring-1 ring-slate-100 sm:p-6">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Riwayat</h2>
          <p className="text-[14px] text-slate-500">Setiap impor bisa dibatalkan.</p>
        </div>
        {history === null ? (
          <p className="py-6 text-center text-[14px] text-slate-400">Memuat…</p>
        ) : history.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[16px] font-semibold text-slate-800">Belum ada riwayat impor</p>
            <p className="text-[14px] text-slate-500">Impor terbaru akan muncul di sini.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><FileSpreadsheet size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-slate-900">{b.name ?? 'Impor mutasi'}</span>
                  <span className="block text-[13px] text-slate-500">
                    {b.account_name ?? 'Rekening'} · {b.rows_count} transaksi · {dateShort(b.first_date)}–{dateShort(b.last_date)} · {dateTime(b.created_at)}
                  </span>
                </span>
                <button type="button" onClick={() => void undo(b)} disabled={undoing === b.id} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60">
                  {undoing === b.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Batalkan
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[26px] bg-white ring-1 ring-slate-100">
        <h2 className="px-4 pt-5 text-[18px] font-bold text-slate-900 sm:px-5">Cara lain memasukkan data</h2>
        <div className="divide-y divide-slate-100 pb-2">
          <OtherWay href="/api/member/transactions/export.csv" icon={Download} title="Ekspor CSV" desc="Unduh semua transaksimu (bisa dibuka di Excel/Sheets)" />
          <OtherWay href={`data:text/csv;charset=utf-8,${encodeURIComponent(IMPORT_CSV_TEMPLATE)}`} download="template-impor-leosiqra.csv" icon={FileSpreadsheet} title="Template CSV" desc="Isi kolom Tanggal, Keterangan, Nominal (minus = keluar), lalu impor di atas" />
          <OtherWay href="/input-cepat" icon={Zap} title="Scan struk & suara" desc="Foto struk atau ucapkan transaksinya — AI yang mengisi" />
          <OtherWay href="/membership/aplikasi?app=gmail" icon={Mail} title="Gmail" desc="Email pembayaran jadi usulan di Kotak Masuk" />
          <OtherWay href="/membership/aplikasi?app=slack" icon={Hash} title="Slack" desc="Ketik pengeluaran di channel, jadi usulan transaksi" />
          <OtherWay href="/panduan/shortcut-ios" icon={Smartphone} title="Shortcut iPhone" desc="Catat lewat Siri, Back Tap & Action Button" />
        </div>
      </section>
    </div>
  );
}
