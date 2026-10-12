"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Archive, Check, Copy, Crown, Link2, Loader2, LogOut, Pencil, Plus, Trash2, Users, Wallet, X,
} from "lucide-react";
import {
  sharedWalletService,
  type SharedTx,
  type SharedTxType,
  type SharedWalletDetail,
  type SharedWalletLimits,
  type SharedWalletRole,
  type SharedWalletSummary,
} from "@/lib/services/sharedWalletService";
import { cn, formatIDR, toLocalDateString } from "@/lib/utils";

const ROLE_LABEL: Record<SharedWalletRole, string> = { owner: "Pemilik", editor: "Editor", viewer: "Pengamat" };
const ROLE_TONE: Record<SharedWalletRole, string> = {
  owner: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  editor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  viewer: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const ACTIVITY_LABEL: Record<string, string> = {
  wallet_create: "membuat dompet",
  wallet_rename: "mengganti nama dompet",
  wallet_archive: "mengarsipkan dompet",
  wallet_unarchive: "membuka arsip dompet",
  tx_create: "mencatat transaksi",
  tx_update: "mengubah transaksi",
  tx_delete: "menghapus transaksi",
  budget_set: "mengatur budget",
  budget_delete: "menghapus budget",
  invite_create: "membuat undangan",
  invite_revoke: "mencabut undangan",
  member_join: "bergabung",
  member_leave: "keluar dari dompet",
  member_remove: "mengeluarkan anggota",
  role_change: "mengubah peran anggota",
  owner_transfer: "menyerahkan kepemilikan",
};

const card = "rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200";

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

// "1.250.000" / "1250000" → 1250000; selain digit dibuang (rupiah utuh).
const parseRupiah = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  return digits ? Number(digits) : 0;
};
const formatInput = (value: string) => {
  const n = parseRupiah(value);
  return n ? n.toLocaleString("id-ID") : "";
};

const fmtDay = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T00:00:00`));
const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Token undangan dari tautan (#gabung=…) atau kode yang ditempel.
const extractToken = (value: string) => {
  const m = value.match(/gabung=([A-Za-z0-9_-]+)/);
  return (m ? m[1] : value).trim();
};

// Dompet Bersama — dipakai web (/membership/dompet-bersama) dan aplikasi HP
// (/app/dompet-bersama) dengan kode yang sama (keputusan Bos #4).
export function SharedWalletPanel({ platform }: { platform: "web" | "app" }) {
  const [items, setItems] = useState<SharedWalletSummary[] | null>(null);
  const [limits, setLimits] = useState<SharedWalletLimits | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async () => {
    try {
      const r = await sharedWalletService.list();
      setItems(r.items);
      setLimits(r.limits);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Gagal memuat dompet bersama.");
    }
  }, []);

  const join = useCallback(
    async (raw: string) => {
      const token = extractToken(raw);
      if (!token) return;
      setError("");
      try {
        const r = await sharedWalletService.join(token);
        setNotice(r.alreadyMember ? "Kamu sudah jadi anggota dompet ini." : "Berhasil bergabung ke dompet bersama!");
        await loadList();
        setSelected(r.walletId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal bergabung.");
      }
    },
    [loadList]
  );

  useEffect(() => {
    // Tautan undangan membawa token di fragmen (#gabung=…) supaya tidak
    // terkirim ke server/log sebagai bagian URL; hapus dari address bar segera.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("gabung=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async sekali saat halaman dibuka dari tautan undangan
      void join(hash);
    } else {
      void loadList();
    }
  }, [join, loadList]);

  if (selected) {
    return (
      <WalletDetail
        walletId={selected}
        platform={platform}
        onBack={() => {
          setSelected(null);
          setNotice("");
          void loadList();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className={cn(card, "text-center")}>
          <Users className="mx-auto text-indigo-500" />
          <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">Belum ada dompet bersama</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Catat uang belanja keluarga, kas kos, atau patungan bareng teman. Data pribadimu tetap terpisah dan tidak terlihat anggota lain.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((w) => (
            <button key={w.id} type="button" onClick={() => setSelected(w.id)} className={cn(card, "flex w-full items-center gap-3 text-left")}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Wallet size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{w.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ROLE_TONE[w.role])}>{ROLE_LABEL[w.role]}</span>
                  {w.archived_at && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">Arsip</span>}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{w.member_count} anggota</span>
              </span>
              <span className={cn("text-sm font-black", w.balance < 0 ? "text-rose-600" : "text-slate-900 dark:text-white")}>{formatIDR(w.balance)}</span>
            </button>
          ))}
        </div>
      )}

      <CreateWallet limits={limits} onCreated={async (id) => { await loadList(); setSelected(id); }} />
      <JoinWallet onJoin={join} />
    </div>
  );
}

function CreateWallet({ limits, onCreated }: { limits: SharedWalletLimits | null; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = limits ? limits.ownedActive >= limits.wallets : false;

  const submit = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await sharedWalletService.create(name.trim());
      setName("");
      onCreated(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat dompet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Buat dompet bersama</p>
      {limits && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Paket {limits.plan}: {limits.ownedActive}/{limits.wallets} dompet aktif, maks {limits.members} anggota per dompet.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <input className={inputCls} placeholder="Mis. Belanja Rumah, Kas Kos" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={full} />
        <button type="button" className={btnPrimary} onClick={submit} disabled={busy || full || name.trim().length < 2}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Buat
        </button>
      </div>
      {full && <p className="mt-2 text-xs text-amber-600">Batas dompet untuk paketmu sudah tercapai. Arsipkan dompet lama atau upgrade ke PRO.</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function JoinWallet({ onJoin }: { onJoin: (raw: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Punya undangan?</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Tempel tautan atau kode undangan dari pemilik dompet.</p>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} placeholder="Tautan / kode undangan" value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || !value.trim()}
          onClick={async () => {
            setBusy(true);
            await onJoin(value);
            setBusy(false);
            setValue("");
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Gabung
        </button>
      </div>
    </div>
  );
}

function WalletDetail({ walletId, platform, onBack }: { walletId: string; platform: "web" | "app"; onBack: () => void }) {
  const [detail, setDetail] = useState<SharedWalletDetail | null>(null);
  const [txs, setTxs] = useState<SharedTx[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await sharedWalletService.detail(walletId);
      setDetail(d);
      setTxs(await sharedWalletService.transactions(walletId, d.month));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat dompet.");
    }
  }, [walletId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async data dompet saat dibuka
    void load();
    // Anggota lain bisa mencatat kapan saja — segarkan saat tab/app kembali aktif.
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // reload=false untuk aksi yang meninggalkan dompet (keluar/hapus) — detailnya sudah 404.
  const run = async (fn: () => Promise<unknown>, after?: () => void, reload = true) => {
    setError("");
    try {
      await fn();
      after?.();
      if (reload) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal. Coba lagi.");
    }
  };

  if (!detail) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className={btnGhost}><ArrowLeft size={14} /> Kembali</button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>}
      </div>
    );
  }

  const { wallet } = detail;
  const canWrite = wallet.role !== "viewer" && !wallet.archived_at;
  const isOwner = wallet.role === "owner";
  const categories = Array.from(new Set([...(txs ?? []).map((t) => t.category), ...detail.budgets.map((b) => b.category)])).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className={btnGhost}><ArrowLeft size={14} /> Semua dompet</button>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", ROLE_TONE[wallet.role])}>Kamu: {ROLE_LABEL[wallet.role]}</span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-5 text-white shadow-lg shadow-indigo-600/20">
        <p className="text-sm font-bold text-indigo-100">{wallet.name}{wallet.archived_at ? " · Arsip" : ""}</p>
        <p className="mt-1 text-3xl font-black">{formatIDR(detail.balance)}</p>
        <p className="mt-1 text-xs text-indigo-100">Saldo bersama · {detail.members.length} anggota</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white/15 px-3 py-2">Masuk bulan ini<br /><b className="text-sm">{formatIDR(detail.income)}</b></div>
          <div className="rounded-xl bg-white/15 px-3 py-2">Keluar bulan ini<br /><b className="text-sm">{formatIDR(detail.expense)}</b></div>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
      {wallet.role === "viewer" && <p className="text-xs text-slate-500 dark:text-slate-400">Kamu Pengamat: bisa melihat semua catatan, tapi tidak bisa mencatat atau mengubah.</p>}

      <TransactionsSection walletId={walletId} txs={txs} me={wallet.me} isOwner={isOwner} canWrite={canWrite} categories={categories} run={run} />
      <BudgetSection detail={detail} canWrite={canWrite} run={run} />
      <MembersSection detail={detail} platform={platform} run={run} onLeft={onBack} />
      {isOwner && <SettingsSection detail={detail} run={run} onDeleted={onBack} />}

      {detail.activity.length > 0 && (
        <div className={card}>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Aktivitas terbaru</p>
          <ul className="mt-2 space-y-1.5">
            {detail.activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span><b>{a.actor_name}</b> {ACTIVITY_LABEL[a.action] ?? a.action}</span>
                <span className="shrink-0 text-slate-400">{fmtWhen(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type RunFn = (fn: () => Promise<unknown>, after?: () => void, reload?: boolean) => Promise<void>;

function TransactionsSection({
  walletId, txs, me, isOwner, canWrite, categories, run,
}: { walletId: string; txs: SharedTx[] | null; me: string; isOwner: boolean; canWrite: boolean; categories: string[]; run: RunFn }) {
  const [type, setType] = useState<SharedTxType>("pengeluaran");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => toLocalDateString());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Satu id per niat mencatat — dipakai ulang kalau request gagal lalu dicoba lagi.
  const requestId = useRef(newRequestId());

  const reset = () => {
    setAmount(""); setCategory(""); setNote(""); setEditing(null); setType("pengeluaran");
    setDate(toLocalDateString());
    requestId.current = newRequestId();
  };

  const submit = async () => {
    const value = parseRupiah(amount);
    if (!value || !category.trim() || busy) return;
    setBusy(true);
    const input = { type, amount: value, category: category.trim(), note: note.trim(), date };
    await run(
      () => (editing ? sharedWalletService.updateTransaction(walletId, editing, input) : sharedWalletService.addTransaction(walletId, input, requestId.current)),
      reset
    );
    setBusy(false);
  };

  const canEdit = (t: SharedTx) => canWrite && (isOwner || t.created_by === me);

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Transaksi bulan ini</p>
      {canWrite && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <div className="grid grid-cols-2 gap-2">
            {(["pengeluaran", "pemasukan"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("rounded-xl py-2 text-xs font-bold", type === t ? (t === "pengeluaran" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300")}>
                {t === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}
              </button>
            ))}
          </div>
          <input className={inputCls} inputMode="numeric" placeholder="Nominal (Rp)" value={amount} onChange={(e) => setAmount(formatInput(e.target.value))} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} list={`sw-cat-${walletId}`} placeholder="Kategori" maxLength={40} value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <datalist id={`sw-cat-${walletId}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <input className={inputCls} placeholder="Catatan (opsional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className={cn(btnPrimary, "flex-1")} onClick={submit} disabled={busy || !parseRupiah(amount) || !category.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {editing ? "Simpan perubahan" : "Catat"}
            </button>
            {editing && <button type="button" className={btnGhost} onClick={reset}><X size={14} /> Batal</button>}
          </div>
        </div>
      )}

      {txs === null ? (
        <div className="flex justify-center py-6 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : txs.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Belum ada transaksi bulan ini.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {txs.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t.category}{t.note ? ` · ${t.note}` : ""}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{fmtDay(t.date)} · {t.created_by_name}</p>
              </div>
              <span className={cn("text-sm font-bold", t.type === "pemasukan" ? "text-emerald-600" : "text-rose-600")}>
                {t.type === "pemasukan" ? "+" : "−"}{formatIDR(t.amount)}
              </span>
              {canEdit(t) && (
                <span className="flex gap-1">
                  <button type="button" aria-label="Ubah" className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600"
                    onClick={() => { setEditing(t.id); setType(t.type); setAmount(t.amount.toLocaleString("id-ID")); setCategory(t.category); setNote(t.note ?? ""); setDate(t.date); }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" aria-label="Hapus" className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                    onClick={() => { if (window.confirm("Hapus transaksi ini dari dompet bersama?")) void run(() => sharedWalletService.deleteTransaction(walletId, t.id)); }}>
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BudgetSection({ detail, canWrite, run }: { detail: SharedWalletDetail; canWrite: boolean; run: RunFn }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  if (!canWrite && detail.budgets.length === 0) return null;
  const id = detail.wallet.id;
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Budget bulanan</p>
      <ul className="mt-2 space-y-3">
        {detail.budgets.map((b) => {
          const pct = Math.min(100, Math.round((b.spent / b.amount) * 100));
          return (
            <li key={b.category}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{b.category}</span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  {formatIDR(b.spent)} / {formatIDR(b.amount)}
                  {canWrite && (
                    <button type="button" aria-label="Hapus budget" className="p-1 text-slate-400 hover:text-rose-600"
                      onClick={() => void run(() => sharedWalletService.setBudget(id, b.category, 0))}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={cn("h-full rounded-full", b.spent > b.amount ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {canWrite && (
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="Kategori" maxLength={40} value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className={inputCls} inputMode="numeric" placeholder="Rp" value={amount} onChange={(e) => setAmount(formatInput(e.target.value))} />
          <button type="button" className={btnPrimary} disabled={!category.trim() || !parseRupiah(amount)}
            onClick={() => void run(() => sharedWalletService.setBudget(id, category.trim(), parseRupiah(amount)), () => { setCategory(""); setAmount(""); })}>
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function MembersSection({ detail, platform, run, onLeft }: { detail: SharedWalletDetail; platform: "web" | "app"; run: RunFn; onLeft: () => void }) {
  const { wallet } = detail;
  const isOwner = wallet.role === "owner";
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const full = detail.members.length >= detail.memberLimit;

  const createInvite = () =>
    run(async () => {
      const r = await sharedWalletService.createInvite(wallet.id, inviteRole, 1);
      const path = platform === "app" ? "/app/dompet-bersama" : "/membership/dompet-bersama";
      setLink(`${window.location.origin}${path}#gabung=${r.token}`);
      setCopied(false);
    });

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Anggota ({detail.members.length}/{detail.memberLimit})</p>
      <ul className="mt-2 space-y-2">
        {detail.members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {m.role === "owner" ? <Crown size={14} /> : m.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{m.display_name}{m.user_id === wallet.me ? " (kamu)" : ""}</span>
            {isOwner && m.user_id !== wallet.me ? (
              <>
                <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={m.role}
                  onChange={(e) => {
                    const role = e.target.value as SharedWalletRole;
                    if (role === "owner" && !window.confirm(`Serahkan kepemilikan ke ${m.display_name}? Kamu akan menjadi Editor.`)) return;
                    void run(() => sharedWalletService.setMemberRole(wallet.id, m.user_id, role));
                  }}>
                  <option value="editor">Editor</option>
                  <option value="viewer">Pengamat</option>
                  <option value="owner">Jadikan pemilik</option>
                </select>
                <button type="button" aria-label="Keluarkan" className="p-1 text-slate-400 hover:text-rose-600"
                  onClick={() => { if (window.confirm(`Keluarkan ${m.display_name} dari dompet?`)) void run(() => sharedWalletService.removeMember(wallet.id, m.user_id)); }}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ROLE_TONE[m.role])}>{ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && !wallet.archived_at && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Undang anggota</p>
          {full ? (
            <p className="text-xs text-amber-600">Dompet sudah penuh untuk paketmu.</p>
          ) : (
            <div className="flex gap-2">
              <select className={inputCls} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}>
                <option value="editor">Editor — bisa mencatat</option>
                <option value="viewer">Pengamat — hanya melihat</option>
              </select>
              <button type="button" className={btnPrimary} onClick={() => void createInvite()}><Link2 size={16} /> Buat tautan</button>
            </div>
          )}
          {link && (
            <div className="rounded-xl bg-indigo-50 p-3 text-xs dark:bg-indigo-500/10">
              <p className="break-all font-mono text-indigo-800 dark:text-indigo-200">{link}</p>
              <button type="button" className={cn(btnGhost, "mt-2")}
                onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* salin manual */ } }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Tersalin" : "Salin tautan"}
              </button>
              <p className="mt-2 text-indigo-700/80 dark:text-indigo-300/80">Berlaku 7 hari, sekali pakai. Tautan hanya ditampilkan sekarang — kirim lewat WhatsApp ke orang yang kamu percaya.</p>
            </div>
          )}
          {detail.invites.length > 0 && (
            <ul className="space-y-1">
              {detail.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Undangan {ROLE_LABEL[i.role]} · s.d. {fmtWhen(i.expires_at)}</span>
                  <button type="button" className="font-bold text-rose-600" onClick={() => void run(() => sharedWalletService.revokeInvite(wallet.id, i.id))}>Cabut</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isOwner && (
        <button type="button" className={cn(btnGhost, "mt-4 text-rose-600")}
          onClick={() => { if (window.confirm("Keluar dari dompet bersama ini? Catatan yang sudah kamu buat tetap ada.")) void run(() => sharedWalletService.removeMember(wallet.id, wallet.me), onLeft, false); }}>
          <LogOut size={14} /> Keluar dari dompet
        </button>
      )}
    </div>
  );
}

function SettingsSection({ detail, run, onDeleted }: { detail: SharedWalletDetail; run: RunFn; onDeleted: () => void }) {
  const { wallet } = detail;
  const [name, setName] = useState(wallet.name);
  const solo = detail.members.length === 1;
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900 dark:text-white">Pengaturan dompet</p>
      <div className="mt-2 flex gap-2">
        <input className={inputCls} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className={btnGhost} disabled={name.trim().length < 2 || name.trim() === wallet.name}
          onClick={() => void run(() => sharedWalletService.update(wallet.id, { name: name.trim() }))}>
          Simpan
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={() => void run(() => sharedWalletService.update(wallet.id, { archived: !wallet.archived_at }))}>
          <Archive size={14} /> {wallet.archived_at ? "Buka arsip" : "Arsipkan"}
        </button>
        {solo && (
          <button type="button" className={cn(btnGhost, "text-rose-600")}
            onClick={() => { if (window.confirm("Hapus permanen dompet ini beserta semua catatannya?")) void run(() => sharedWalletService.remove(wallet.id), onDeleted, false); }}>
            <Trash2 size={14} /> Hapus dompet
          </button>
        )}
      </div>
      {!solo && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Dompet yang masih punya anggota lain tidak bisa dihapus — arsipkan, atau keluarkan anggota dulu.</p>}
    </div>
  );
}
