"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Trash2, Pencil, Info } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CategorySelect } from "@/components/CategorySelect";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { notifyCollectionChanged } from "@/lib/cf-firestore";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import type { Account } from "@/lib/services/accountService";
import { cn, formatMoney, formatIDR, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { txKind, txTitle } from "./txDisplay";

interface Props {
  tx: Transaction | null;
  accounts: Account[];
  onClose: () => void;
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500";

export function TransactionDetailSheet({ tx, accounts, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!tx) return;
    setEditing(false);
    setConfirmDelete(false);
    setError("");
    setCategory(tx.category || "");
    setSubCategory(tx.subCategory || "");
    setNote(tx.note || "");
    setDate(toLocalDateString(new Date(tx.date)));
  }, [tx]);

  if (!tx) return <BottomSheet isOpen={false} onClose={onClose}>{null}</BottomSheet>;

  const kind = txKind(tx);
  const accountName = (id?: string) =>
    id === "Wallet" ? "E-Wallet luar" : accounts.find((a) => a.id === id)?.name || "Rekening terhapus";
  // Baris yang ditautkan ke fitur lain (cicilan hutang, penempatan deposito,
  // setoran tabungan) dikelola dari halaman asalnya — mengubah/menghapusnya di
  // sini bisa membuat data fitur itu tidak sinkron.
  const linked = Boolean(tx.relatedType);
  const isTransfer = kind === "transfer";
  const canEdit = !linked && !isTransfer;
  const canDelete = !linked;

  const handleSave = async () => {
    if (!tx.id) return;
    setBusy(true);
    setError("");
    try {
      await cloudflareApi(`/api/member/transactions/${tx.id}`, {
        method: "PUT",
        json: {
          ...(category ? { category } : {}),
          sub_category: subCategory,
          note: note.trim(),
          date,
          display_date: date,
        },
      });
      notifyCollectionChanged("transactions");
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan perubahan.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      lightTap();
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await transactionService.deleteTransaction(tx);
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menghapus transaksi.");
      setBusy(false);
    }
  };

  const Icon = kind === "in" ? ArrowUpCircle : kind === "out" ? ArrowDownCircle : ArrowLeftRight;
  const tone =
    kind === "in" ? "text-emerald-600 dark:text-emerald-400" : kind === "out" ? "text-rose-500 dark:text-rose-400" : "text-indigo-600 dark:text-indigo-400";

  return (
    <BottomSheet isOpen={Boolean(tx)} onClose={onClose} title={editing ? "Ubah Transaksi" : "Detail Transaksi"}>
      <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="text-center py-2">
          <span className={cn("inline-flex w-12 h-12 rounded-2xl items-center justify-center bg-slate-50 dark:bg-slate-800", tone)}>
            <Icon size={22} />
          </span>
          <p className={cn("mt-3 text-3xl font-black tabular-nums", tone)}>
            {kind === "in" ? "+" : kind === "out" ? "−" : ""}
            {formatMoney(tx.amount, tx.currency || "IDR")}
          </p>
          {tx.currency && tx.currency !== "IDR" && (
            <p className="text-xs font-bold text-slate-400 tabular-nums">≈ {formatIDR(Number(tx.amountIDR) || 0)}</p>
          )}
          <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">{txTitle(tx)}</p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>
        )}

        {editing ? (
          <div className="space-y-3">
            <CategorySelect
              label="Kategori"
              value={category}
              type={kind === "in" ? "income" : "expense"}
              onChange={setCategory}
              onSubCategoryChange={setSubCategory}
              showBadge={false}
            />
            <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Tanggal" />
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan" className={inputClass} aria-label="Catatan" />
            <p className="text-[11px] text-slate-400 px-1">Nominal & rekening tidak bisa diubah di sini — hapus lalu catat ulang supaya saldo tetap benar.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-black text-slate-600 dark:text-slate-300">
                Batal
              </button>
              <button type="button" onClick={handleSave} disabled={busy || !date} className="py-3.5 rounded-2xl bg-indigo-600 text-sm font-black text-white disabled:opacity-40">
                {busy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <dl className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {[
                ["Tanggal", new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(tx.date))],
                ["Kategori", [tx.category, tx.subCategory].filter(Boolean).join(" · ") || "—"],
                isTransfer
                  ? ["Rekening", `${accountName(tx.accountId)}${tx.targetAccountId ? ` → ${accountName(tx.targetAccountId)}` : ""}`]
                  : ["Rekening", accountName(tx.accountId)],
                ["Catatan", tx.note || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-slate-400 font-bold shrink-0">{k}</dt>
                  <dd className="text-slate-800 dark:text-slate-100 font-bold text-right break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>

            {(linked || isTransfer) && (
              <p className="flex gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <Info size={14} className="shrink-0 mt-px" />
                {linked
                  ? "Transaksi ini bagian dari fitur lain (hutang, tabungan, atau investasi). Kelola dari halaman fitur tersebut."
                  : "Transfer tidak bisa diubah. Menghapusnya ikut menghapus sisi pasangannya dan mengembalikan saldo kedua rekening."}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { lightTap(); setEditing(true); }}
                disabled={!canEdit}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-black text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                <Pencil size={15} /> Ubah
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || busy}
                className={cn(
                  "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black disabled:opacity-40 transition-colors",
                  confirmDelete ? "bg-rose-500 text-white" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                <Trash2 size={15} /> {busy ? "Menghapus..." : confirmDelete ? "Yakin hapus?" : "Hapus"}
              </button>
            </div>
            {confirmDelete && (
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                {isTransfer ? "Kedua sisi transfer dihapus & saldo kedua rekening dikembalikan." : "Saldo rekening akan dikembalikan."} Tap lagi untuk menghapus.
              </p>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
