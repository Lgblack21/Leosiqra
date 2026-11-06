"use client";

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, Power, Trash2, UserRound, Wand2 } from 'lucide-react';
import { teamService, type TeamMember, STAFF_USERNAME_RE, normStaffUsername } from '@/lib/services/staffService';
import { accountService } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import type { Shop } from '@/lib/services/shopService';
import { cn } from '@/lib/utils';
import { fieldCls, labelCls } from './UsahaView';

// Akun tim hanya membuka kasir usaha terpilih; rekening tujuan dikunci, tanpa akses keuangan lain.

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'toko';
const genPassword = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => a[b % a.length]).join(''); };
const ago = (iso: string | null) => {
  if (!iso) return 'belum pernah masuk';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `masuk ${Math.max(1, m)} menit lalu` : m < 1440 ? `masuk ${Math.round(m / 60)} jam lalu` : `masuk ${new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' })}`;
};

export function TeamManager({ shops, onToast }: { shops: Shop[]; onToast: (m: string) => void }) {
  const [data, setData] = useState<{ items: TeamMember[]; limit: number; plan: string } | null>(null);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => teamService.list().then((r) => { setData(r); setError(''); }).catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat tim.')), []);
  useEffect(() => {
    void load();
    accountService.getUserAccounts('').then((list) => setAccounts(list.filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name })))).catch(() => undefined);
  }, [load]);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? '(usaha dihapus)';
  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/tim` : 'https://www.leosiqra.com/tim';

  if (error && !data) return <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">{error}</p>;
  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
  const full = data.items.length >= data.limit;

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-slate-50 px-3.5 py-3 text-[12px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Anggota tim login di <b>{loginUrl.replace(/^https?:\/\//, '')}</b> (atau halaman login biasa) dengan username & sandi dari kamu. Mereka hanya bisa membuka kasir usaha yang kamu pilih dan melihat penjualan hari ini — <b>tanpa saldo, rekening, atau keuangan lainmu</b>. Penjualan masuk ke rekening yang kamu kunci dan tercatat &ldquo;oleh &lt;nama&gt;&rdquo;.
      </p>
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}

      <ul className="space-y-2">
        {data.items.map((m) => (
          <li key={m.id} className={cn('rounded-2xl ring-1 ring-slate-100 p-3 dark:ring-slate-800', m.disabled && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/15"><UserRound size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-extrabold text-slate-900 dark:text-white">{m.name} {m.disabled && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">nonaktif</span>}</span>
                <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{m.username} · Kasir · {ago(m.last_login_at)}</span>
                <span className="block truncate text-[11px] text-slate-400">{m.shop_ids.map(shopName).join(', ')} → {accName(m.account_id)}</span>
              </span>
              <button type="button" onClick={() => setEditing(editing === m.id ? null : m.id)} className="shrink-0 text-[12px] font-bold text-violet-600 dark:text-violet-300">{editing === m.id ? 'Tutup' : 'Atur'}</button>
            </div>
            {editing === m.id && <MemberEdit m={m} shops={shops} accounts={accounts} onDone={(msg) => { setEditing(null); onToast(msg); void load(); }} onError={setError} />}
          </li>
        ))}
      </ul>

      {adding ? (
        <MemberForm shops={shops} accounts={accounts} loginUrl={loginUrl} onToast={onToast} onDone={() => { setAdding(false); void load(); }} onCancel={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} disabled={full || !shops.length} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 py-3 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-40"><Plus size={15} /> Tambah anggota tim <span className="font-semibold text-white/70">({data.items.length}/{data.limit})</span></button>
      )}
      {full && <p className="text-center text-[11px] text-slate-400">Batas paket {data.plan === 'PRO' ? 'PRO' : 'FREE'}: {data.limit} akun tim.{data.plan !== 'PRO' ? ' PRO bisa sampai 5.' : ''}</p>}
    </div>
  );
}

function ShopPicker({ shops, value, onChange }: { shops: Shop[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {shops.map((s) => { const on = value.includes(s.id); return <button key={s.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])} aria-pressed={on} className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold', on ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{on && <Check size={12} />}{s.emoji} {s.name}</button>; })}
    </div>
  );
}

function MemberForm({ shops, accounts, loginUrl, onToast, onDone, onCancel }: { shops: Shop[]; accounts: { id: string; name: string }[]; loginUrl: string; onToast: (m: string) => void; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState(`${slug(shops[0]?.name ?? 'toko')}-`);
  const [password, setPassword] = useState(genPassword);
  const [shopIds, setShopIds] = useState<string[]>(shops.length === 1 ? [shops[0].id] : []);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<string | null>(null);
  const validUser = STAFF_USERNAME_RE.test(normStaffUsername(username));

  const save = async () => {
    if (!name.trim()) { setError('Isi nama anggota.'); return; }
    if (!validUser) { setError('Username harus berbentuk toko-nama, mis. cxa-rina.'); return; }
    if (password.length < 8) { setError('Sandi minimal 8 karakter.'); return; }
    if (!shopIds.length) { setError('Pilih minimal satu usaha.'); return; }
    if (!accountId && !accounts[0]) { setError('Pilih rekening tujuan.'); return; }
    setBusy(true);
    setError('');
    try {
      await teamService.create({ name: name.trim(), username, password, shopIds, accountId: accountId || accounts[0].id });
      setMade(`Login Leosiqra Tim\n${loginUrl}\nUsername: ${normStaffUsername(username)}\nSandi: ${password}\n\nSetelah masuk, ganti sandi lewat ikon kunci.`);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal membuat akun.'); }
    setBusy(false);
  };

  if (made) {
    return (
      <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
        <p className="text-[13px] font-extrabold text-emerald-900 dark:text-emerald-200">Akun tim dibuat ✓</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-[12px] text-slate-700 dark:bg-slate-900 dark:text-slate-200">{made}</pre>
        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/70">Sandi ini hanya tampil sekarang. Kirim ke anggotamu lewat jalur pribadi (bukan grup).</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigator.clipboard.writeText(made).then(() => onToast('Info login tersalin.'), () => onToast('Tidak bisa menyalin otomatis.'))} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[12px] font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200"><Copy size={13} /> Salin info login</button>
          <button type="button" onClick={onDone} className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2.5 text-[12px] font-bold text-white"><Check size={13} /> Selesai</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl ring-1 ring-violet-200 p-3 dark:ring-violet-500/30">
      <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Anggota tim baru</p>
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <label className="block"><span className={labelCls}>Nama</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="mis. Rina" className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Username (toko-nama)</span><input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))} maxLength={31} autoCapitalize="none" placeholder="cxa-rina" className={cn(fieldCls, username.length > 3 && !validUser && 'ring-rose-300')} /></label>
      <label className="block"><span className={labelCls}>Sandi awal</span>
        <span className="flex gap-2"><input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={100} className={cn(fieldCls, 'font-mono')} /><button type="button" onClick={() => setPassword(genPassword())} aria-label="Buat sandi acak" className="shrink-0 rounded-2xl bg-slate-100 px-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Wand2 size={15} /></button></span>
      </label>
      <div><span className={labelCls}>Boleh membuka kasir</span><ShopPicker shops={shops} value={shopIds} onChange={setShopIds} /></div>
      <label className="block"><span className={labelCls}>Penjualan masuk ke rekening (dikunci)</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Batal</button>
        <button type="button" onClick={save} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 dark:bg-violet-600">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Buat akun</button>
      </div>
    </div>
  );
}

function MemberEdit({ m, shops, accounts, onDone, onError }: { m: TeamMember; shops: Shop[]; accounts: { id: string; name: string }[]; onDone: (msg: string) => void; onError: (e: string) => void }) {
  const [shopIds, setShopIds] = useState(m.shop_ids);
  const [accountId, setAccountId] = useState(m.account_id ?? accounts[0]?.id ?? '');
  const [newPw, setNewPw] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, msg: string) => { setBusy(true); try { await fn(); onDone(msg); } catch (e) { onError(e instanceof Error && e.message ? e.message : 'Gagal.'); setBusy(false); } };
  const btn = 'flex items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold disabled:opacity-40';
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div><span className={labelCls}>Boleh membuka kasir</span><ShopPicker shops={shops} value={shopIds} onChange={setShopIds} /></div>
      <label className="block"><span className={labelCls}>Rekening tujuan</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <button type="button" disabled={busy || !shopIds.length} onClick={() => run(() => teamService.update(m.id, { shopIds, accountId }), 'Akses tim disimpan.')} className={cn(btn, 'w-full bg-slate-900 text-white dark:bg-violet-600')}><Check size={13} /> Simpan akses</button>
      {newPw !== null ? (
        <div className="flex gap-2"><input value={newPw} onChange={(e) => setNewPw(e.target.value)} className={cn(fieldCls, 'py-2 font-mono text-[12px]')} aria-label="Sandi baru" /><button type="button" disabled={busy || newPw.length < 8} onClick={() => run(() => teamService.update(m.id, { password: newPw }), `Sandi ${m.name} direset: ${newPw} — kirim lewat jalur pribadi.`)} className={cn(btn, 'shrink-0 bg-violet-600 px-4 text-white')}>Reset</button></div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setNewPw(genPassword())} className={cn(btn, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}><KeyRound size={13} /> Reset sandi</button>
        <button type="button" disabled={busy} onClick={() => run(() => teamService.update(m.id, { disabled: !m.disabled }), m.disabled ? `${m.name} diaktifkan.` : `${m.name} dinonaktifkan & dikeluarkan.`)} className={cn(btn, 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}><Power size={13} /> {m.disabled ? 'Aktifkan' : 'Nonaktifkan'}</button>
        <button type="button" disabled={busy} onClick={() => (confirmDel ? run(() => teamService.remove(m.id), `Akun ${m.name} dihapus. Penjualannya tetap tercatat.`) : setConfirmDel(true))} className={cn(btn, confirmDel ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300')}><Trash2 size={13} /> {confirmDel ? 'Yakin?' : 'Hapus'}</button>
      </div>
    </div>
  );
}
