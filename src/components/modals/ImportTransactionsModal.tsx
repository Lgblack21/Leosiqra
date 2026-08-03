"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { accountService, Account } from '@/lib/services/accountService';
import { transactionImportService, ImportRow } from '@/lib/services/transactionImportService';
import { parseCsv, parseIndoNumber, parseFlexibleDate } from '@/lib/csvImport';
import { formatCurrency, toLocalDateString } from '@/lib/utils';

interface ImportTransactionsModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

type AmountMode = 'single' | 'debit_credit';

export const ImportTransactionsModal = ({ userId, isOpen, onClose }: ImportTransactionsModalProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);

  const [dateCol, setDateCol] = useState('');
  const [noteCol, setNoteCol] = useState('');
  const [amountMode, setAmountMode] = useState<AmountMode>('single');
  const [amountCol, setAmountCol] = useState('');
  const [debitCol, setDebitCol] = useState('');
  const [creditCol, setCreditCol] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) {
      setFileName(''); setHeaders([]); setDataRows([]); setError(''); setResult(null);
      setDateCol(''); setNoteCol(''); setAmountCol(''); setDebitCol(''); setCreditCol('');
      setAmountMode('single');
    }
  }, [isOpen]);

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setError('File tidak berisi data (minimal harus ada baris header + 1 baris transaksi).');
        return;
      }
      const [headerRow, ...rest] = rows;
      setHeaders(headerRow.map((h) => h.trim()));
      setDataRows(rest);

      // Tebak kolom otomatis dari nama header — user tetap bisa koreksi manual.
      const guess = (needles: string[]) =>
        headerRow.find((h) => needles.some((n) => h.toLowerCase().includes(n))) || '';
      setDateCol(guess(['tanggal', 'date', 'tgl']));
      setNoteCol(guess(['keterangan', 'deskripsi', 'description', 'remark', 'uraian']));
      setAmountCol(guess(['nominal', 'amount', 'jumlah']));
      setDebitCol(guess(['debit', 'keluar', 'withdrawal']));
      setCreditCol(guess(['kredit', 'credit', 'masuk', 'deposit']));
    } catch (e) {
      console.error(e);
      setError('Gagal membaca file. Pastikan formatnya CSV.');
    }
  };

  const colIndex = (col: string) => headers.indexOf(col);

  const parsedRows: (ImportRow & { rawDate: string })[] = (() => {
    if (!dateCol || (!amountCol && amountMode === 'single') || (amountMode === 'debit_credit' && !debitCol && !creditCol)) {
      return [];
    }
    const dIdx = colIndex(dateCol);
    const nIdx = colIndex(noteCol);
    const aIdx = colIndex(amountCol);
    const debIdx = colIndex(debitCol);
    const credIdx = colIndex(creditCol);

    return dataRows.map((r) => {
      const rawDate = r[dIdx] ?? '';
      const date = parseFlexibleDate(rawDate);
      const note = nIdx >= 0 ? (r[nIdx] ?? '').trim() : '';

      let amount = 0;
      let type: 'pemasukan' | 'pengeluaran' = 'pengeluaran';
      if (amountMode === 'single') {
        const raw = parseIndoNumber(r[aIdx] ?? '0');
        amount = Math.abs(raw);
        type = raw >= 0 ? 'pemasukan' : 'pengeluaran';
      } else {
        const debit = debIdx >= 0 ? parseIndoNumber(r[debIdx] ?? '0') : 0;
        const credit = credIdx >= 0 ? parseIndoNumber(r[credIdx] ?? '0') : 0;
        if (Math.abs(credit) > 0) {
          amount = Math.abs(credit);
          type = 'pemasukan';
        } else {
          amount = Math.abs(debit);
          type = 'pengeluaran';
        }
      }

      return {
        rawDate,
        date: date ? toLocalDateString(date) : '',
        note,
        amount,
        type,
      };
    });
  })();

  const validRows = parsedRows.filter((r) => r.date && r.amount > 0);
  const invalidCount = parsedRows.length - validRows.length;
  const mappingReady = dateCol && (amountMode === 'single' ? amountCol : (debitCol || creditCol));

  const handleImport = async () => {
    if (!accountId || validRows.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const account = accounts.find((a) => a.id === accountId);
      const res = await transactionImportService.importTransactions(
        accountId,
        account?.currency || 'IDR',
        validRows.map(({ rawDate, ...row }) => { void rawDate; return row; })
      );
      setResult(res);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Gagal mengimpor mutasi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Impor Mutasi (CSV)" maxWidth="max-w-3xl">
      <div className="space-y-5 px-1">
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs font-medium text-indigo-700 leading-relaxed">
          Impor ini hanya menambahkan riwayat transaksi untuk laporan/analisis — <strong>tidak mengubah saldo rekening</strong> (saldo tetap kamu kelola manual seperti biasa). Cocok untuk mengisi histori dari mutasi bank/e-wallet yang di-export sebagai CSV.
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">{error}</div>
        )}

        {result ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-2">
            <Check className="mx-auto text-emerald-600" size={32} />
            <p className="text-sm font-black text-emerald-700">{result.inserted} transaksi berhasil diimpor</p>
            <p className="text-xs font-medium text-emerald-600">{result.skipped} baris dilewati (duplikat atau tidak valid) dari total {result.total} baris.</p>
            <button onClick={onClose} className="mt-3 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-all">
              Selesai
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">1. Pilih Rekening Tujuan</label>
              <div className="relative">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
                >
                  <option value="">Pilih Rekening</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">2. Upload File CSV Mutasi</label>
              <label className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-500">{fileName || 'Klik untuk pilih file .csv'}</span>
              </label>
              <p className="text-[10px] font-medium text-slate-400 pl-1">
                Export mutasi dari aplikasi bank/e-wallet kamu sebagai CSV, lalu upload di sini.
              </p>
            </div>

            {headers.length > 0 && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">3. Pemetaan Kolom</label>

                <div className="grid grid-cols-2 gap-4">
                  <ColumnSelect label="Kolom Tanggal" value={dateCol} onChange={setDateCol} headers={headers} />
                  <ColumnSelect label="Kolom Keterangan" value={noteCol} onChange={setNoteCol} headers={headers} allowEmpty />
                </div>

                <div className="flex gap-2">
                  {(['single', 'debit_credit'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAmountMode(m)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        amountMode === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                      }`}
                    >
                      {m === 'single' ? 'Satu Kolom Nominal (+/-)' : 'Kolom Debit & Kredit Terpisah'}
                    </button>
                  ))}
                </div>

                {amountMode === 'single' ? (
                  <ColumnSelect label="Kolom Nominal" value={amountCol} onChange={setAmountCol} headers={headers} />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <ColumnSelect label="Kolom Debit (Keluar)" value={debitCol} onChange={setDebitCol} headers={headers} allowEmpty />
                    <ColumnSelect label="Kolom Kredit (Masuk)" value={creditCol} onChange={setCreditCol} headers={headers} allowEmpty />
                  </div>
                )}
              </div>
            )}

            {mappingReady && parsedRows.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">4. Preview (10 baris pertama)</label>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                      <AlertTriangle size={12} /> {invalidCount} baris tidak valid akan dilewati
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 font-black text-slate-400 uppercase text-[9px]">Tanggal</th>
                        <th className="px-3 py-2 font-black text-slate-400 uppercase text-[9px]">Keterangan</th>
                        <th className="px-3 py-2 font-black text-slate-400 uppercase text-[9px] text-right">Nominal</th>
                        <th className="px-3 py-2 font-black text-slate-400 uppercase text-[9px] text-center">Tipe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className={!r.date || r.amount <= 0 ? 'bg-rose-50/50' : ''}>
                          <td className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap">{r.date || `"${r.rawDate}" (gagal parse)`}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{r.note || '-'}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(r.amount, accounts.find(a => a.id === accountId)?.currency || 'IDR')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${r.type === 'pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                              {r.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] font-medium text-slate-400 pl-1">
                  Total {parsedRows.length} baris terbaca, {validRows.length} siap diimpor.
                </p>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={loading || !accountId || validRows.length === 0}
              className="w-full bg-indigo-600 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all mt-2 shadow-xl shadow-indigo-100"
            >
              <FileSpreadsheet size={18} />
              {loading ? 'Mengimpor...' : `Impor ${validRows.length} Transaksi`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

const ColumnSelect = ({ label, value, onChange, headers, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; headers: string[]; allowEmpty?: boolean }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
      >
        {allowEmpty && <option value="">(Tidak ada)</option>}
        {!allowEmpty && !value && <option value="">Pilih kolom...</option>}
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
    </div>
  </div>
);
