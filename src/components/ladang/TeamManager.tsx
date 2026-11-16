'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Copy, IdCard, KeyRound, Loader2, Plus, Power, Trash2, UserRound, Wand2 } from 'lucide-react';
import { teamService, type KasOption, type TeamList, type TeamMember, STAFF_USERNAME_RE, normStaffUsername } from '@/lib/services/staffService';
import { fotoKeBase64 } from '@/lib/fotoKecil';
import { KartuView } from '@/components/usahaku/AnggotaView';
import { accountService } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import type { Shop } from '@/lib/services/shopService';
import { cn } from '@/lib/utils';
import { fieldCls, labelCls } from './UsahaView';

// Akun tim hanya membuka usaha terpilih; uang masuk ke kas usaha yang ditentukan pemilik (per toko), tanpa akses
// keuangan lain. Jabatan: Kasir (kasir toko) atau Penagih (Tagihan hari ini usaha pinjaman). Foto + kartu staf (0049).
const JABATAN: [string, string][] = [
  ['kasir', 'Kasir'],
  ['penagih', 'Penagih'],
];
const jabatanLabel = (r: string) => JABATAN.find(([k]) => k === r)?.[1] ?? 'Kasir';

/** Pilihan kas usaha per toko yang dipilih. Toko tanpa buku usaha → pakai rekening pribadi (di bawahnya). */
function KasPicker({ shops, shopIds, options, value, onChange }: { shops: Shop[]; shopIds: string[]; options: KasOption[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const withKas = shopIds.filter((sid) => options.some((o) => o.shop_id === sid));
  if (!withKas.length) return null;
  return (
    <div className="space-y-2">
      <span className={labelCls}>Uang yang dicatat masuk ke kas usaha</span>
      {withKas.map((sid) => {
        const opts = options.filter((o) => o.shop_id === sid);
        return (
          <label key={sid} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate fs-12 font-semibold text-slate-600 dark:text-slate-300">{shops.find((s) => s.id === sid)?.name}</span>
            <select value={opts.some((o) => o.id === value[sid]) ? value[sid] : (opts.find((o) => o.is_default) ?? opts[0])?.id ?? ''} onChange={(e) => onChange({ ...value, [sid]: e.target.value })} className={cn(fieldCls, 'py-2 fs-13')}>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.is_default ? ' (kas utama)' : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
/** Peta kas yang valid untuk toko terpilih (default: kas utama) — kas yang sudah diarsip diganti, toko lain dibuang. */
const kasFor = (shopIds: string[], options: KasOption[], v: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const sid of shopIds) {
    const opts = options.filter((o) => o.shop_id === sid);
    const pick = opts.find((o) => o.id === v[sid]) ?? opts.find((o) => o.is_default) ?? opts[0];
    if (pick) out[sid] = pick.id;
  }
  return out;
};
const perluRekening = (shopIds: string[], options: KasOption[], extras: boolean) => !extras || shopIds.some((sid) => !options.some((o) => o.shop_id === sid));
function JabatanPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={labelCls}>Jabatan</span>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {JABATAN.map(([k, l]) => (
          <button key={k} type="button" onClick={() => onChange(k)} className={cn('rounded-xl py-2 fs-13 font-bold', value === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500')}>
            {l}
          </button>
        ))}
      </div>
      <p className="mt-1 fs-11 text-slate-500">
        {value === 'penagih'
          ? 'Penagih hanya melihat Tagihan hari ini di usaha pinjaman dan bisa menerima angsuran — tanpa KTP, alamat, atau jaminan.'
          : 'Kasir membuka kasir toko yang dipilih dan mencatat penjualan.'}
      </p>
    </div>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'toko';
const genPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => a[b % a.length]).join('');
};
const ago = (iso: string | null) => {
  if (!iso) return 'belum pernah masuk';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60
    ? `masuk ${Math.max(1, m)} menit lalu`
    : m < 1440
      ? `masuk ${Math.round(m / 60)} jam lalu`
      : `masuk ${new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' })}`;
};

export function TeamManager({ shops, onToast }: { shops: Shop[]; onToast: (m: string) => void }) {
  const [data, setData] = useState<TeamList | null>(null);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(
    () =>
      teamService
        .list()
        .then((r) => {
          setData(r);
          setError('');
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat tim.')),
    [],
  );
  useEffect(() => {
    void load();
    accountService
      .getUserAccounts('')
      .then((list) =>
        setAccounts(
          list
            .filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR')
            .map((a) => ({ id: String(a.id), name: a.name })),
        ),
      )
      .catch(() => undefined);
  }, [load]);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? '(usaha dihapus)';
  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/tim` : 'https://www.leosiqra.com/tim';

  if (error && !data)
    return (
      <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 fs-13 font-semibold text-amber-800">
        {error}
      </p>
    );
  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
  const full = data.items.length >= data.limit;
  const kasOptions = data.kas_options ?? [];
  const extras = Boolean(data.extras);
  const tujuan = (m: TeamMember) =>
    m.shop_ids
      .map((sid) => {
        const k = kasOptions.find((o) => o.id === m.kas?.[sid]) ?? kasOptions.find((o) => o.shop_id === sid);
        return `${shopName(sid)} → ${k ? k.name : accName(m.account_id)}`;
      })
      .join(' · ');

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-slate-50 px-3.5 py-3 fs-12 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Anggota tim login di <b>{loginUrl.replace(/^https?:\/\//, '')}</b> (atau halaman login biasa) dengan username &
        sandi dari kamu. Kasir hanya membuka kasir usaha yang kamu pilih; Penagih hanya melihat tagihan pinjaman hari
        ini — <b>tanpa saldo, rekening, atau keuangan lainmu</b>. Uang yang mereka catat masuk ke kas usaha yang kamu
        tentukan dan tercatat &ldquo;oleh &lt;nama&gt;&rdquo;.
      </p>
      {error && (
        <p role="alert" className="fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {data.items.map((m) => (
          <li
            key={m.id}
            className={cn('rounded-2xl ring-1 ring-slate-100 p-3 dark:ring-slate-800', m.disabled && 'opacity-60')}
          >
            <div className="flex items-center gap-3">
              {m.has_photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto staf privat lewat endpoint berlogin
                <img src={teamService.photoUrl(m)} alt={`Foto ${m.name}`} className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/15">
                  <UserRound size={18} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14 font-extrabold text-slate-900 dark:text-white">
                  {m.name}{' '}
                  {m.disabled && (
                    <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 fs-10 font-bold text-slate-600">
                      nonaktif
                    </span>
                  )}
                </span>
                <span className="block truncate fs-12 text-slate-500 dark:text-slate-400">
                  {m.username} · {jabatanLabel(m.role)}
                  {m.staff_no ? ` · ${m.staff_no}` : ''} · {ago(m.last_login_at)}
                </span>
                <span className="block truncate fs-11 text-slate-400">{tujuan(m)}</span>
              </span>
              <button
                type="button"
                onClick={() => setEditing(editing === m.id ? null : m.id)}
                className="shrink-0 fs-12 font-bold text-violet-600 dark:text-violet-300"
              >
                {editing === m.id ? 'Tutup' : 'Atur'}
              </button>
            </div>
            {editing === m.id && (
              <MemberEdit
                m={m}
                shops={shops}
                accounts={accounts}
                kasOptions={kasOptions}
                extras={extras}
                onDone={(msg) => {
                  setEditing(null);
                  onToast(msg);
                  void load();
                }}
                onRefresh={(msg) => {
                  onToast(msg);
                  void load();
                }}
                onError={setError}
              />
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <MemberForm
          shops={shops}
          accounts={accounts}
          kasOptions={kasOptions}
          extras={extras}
          loginUrl={loginUrl}
          onToast={onToast}
          onDone={() => {
            setAdding(false);
            void load();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={full || !shops.length}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 py-3 fs-13 font-bold text-white hover:bg-violet-700 disabled:opacity-40"
        >
          <Plus size={15} /> Tambah anggota tim{' '}
          <span className="font-semibold text-white/70">
            ({data.items.length}/{data.limit})
          </span>
        </button>
      )}
      {full && (
        <p className="text-center fs-11 text-slate-400">
          Batas paket {data.plan === 'PRO' ? 'PRO' : 'FREE'}: {data.limit} akun tim.
          {data.plan !== 'PRO' ? ' PRO bisa sampai 5.' : ''}
        </p>
      )}
    </div>
  );
}

function ShopPicker({ shops, value, onChange }: { shops: Shop[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {shops.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            aria-pressed={on}
            className={cn(
              'flex items-center gap-1 rounded-full px-3 py-1.5 fs-12 font-bold',
              on ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {on && <Check size={12} />}
            {s.emoji} {s.name}
          </button>
        );
      })}
    </div>
  );
}

function MemberForm({
  shops,
  accounts,
  kasOptions,
  extras,
  loginUrl,
  onToast,
  onDone,
  onCancel,
}: {
  shops: Shop[];
  accounts: { id: string; name: string }[];
  kasOptions: KasOption[];
  extras: boolean;
  loginUrl: string;
  onToast: (m: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState(`${slug(shops[0]?.name ?? 'toko')}-`);
  const [password, setPassword] = useState(genPassword);
  const [shopIds, setShopIds] = useState<string[]>(shops.length === 1 ? [shops[0].id] : []);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [role, setRole] = useState('kasir');
  const [kas, setKas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<string | null>(null);
  const butuhRekening = perluRekening(shopIds, kasOptions, extras);
  const validUser = STAFF_USERNAME_RE.test(normStaffUsername(username));

  const save = async () => {
    if (!name.trim()) {
      setError('Isi nama anggota.');
      return;
    }
    if (!validUser) {
      setError('Username harus berbentuk toko-nama, mis. cxa-rina.');
      return;
    }
    if (password.length < 8) {
      setError('Sandi minimal 8 karakter.');
      return;
    }
    if (!shopIds.length) {
      setError('Pilih minimal satu usaha.');
      return;
    }
    if (butuhRekening && !accountId && !accounts[0]) {
      setError('Pilih rekening tujuan.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await teamService.create({
        name: name.trim(),
        username,
        password,
        shopIds,
        accountId: butuhRekening ? accountId || accounts[0].id : '',
        ...(extras ? { role, kas: kasFor(shopIds, kasOptions, kas) } : {}),
      });
      setMade(
        `Login Leosiqra Tim\n${loginUrl}\nUsername: ${normStaffUsername(username)}\nSandi: ${password}\n\nSetelah masuk, ganti sandi lewat ikon kunci.`,
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal membuat akun.');
    }
    setBusy(false);
  };

  if (made) {
    return (
      <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
        <p className="fs-13 font-extrabold text-emerald-900 dark:text-emerald-200">Akun tim dibuat ✓</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-sans fs-12 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {made}
        </pre>
        <p className="fs-11 text-emerald-800/80 dark:text-emerald-200/70">
          Sandi ini hanya tampil sekarang. Kirim ke anggotamu lewat jalur pribadi (bukan grup).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(made).then(
                () => onToast('Info login tersalin.'),
                () => onToast('Tidak bisa menyalin otomatis.'),
              )
            }
            className="flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 fs-12 font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Copy size={13} /> Salin info login
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2.5 fs-12 font-bold text-white"
          >
            <Check size={13} /> Selesai
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl ring-1 ring-violet-200 p-3 dark:ring-violet-500/30">
      <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Anggota tim baru</p>
      {error && (
        <p role="alert" className="fs-12 font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Nama</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="mis. Rina"
          className={fieldCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Username (toko-nama)</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))}
          maxLength={31}
          autoCapitalize="none"
          placeholder="cxa-rina"
          className={cn(fieldCls, username.length > 3 && !validUser && 'ring-rose-300')}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Sandi awal</span>
        <span className="flex gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={100}
            className={cn(fieldCls, 'font-mono')}
          />
          <button
            type="button"
            onClick={() => setPassword(genPassword())}
            aria-label="Buat sandi acak"
            className="shrink-0 rounded-2xl bg-slate-100 px-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <Wand2 size={15} />
          </button>
        </span>
      </label>
      {extras && <JabatanPicker value={role} onChange={setRole} />}
      <div>
        <span className={labelCls}>Usaha yang dipegang</span>
        <ShopPicker shops={shops} value={shopIds} onChange={setShopIds} />
      </div>
      {extras && <KasPicker shops={shops} shopIds={shopIds} options={kasOptions} value={kas} onChange={setKas} />}
      {butuhRekening && (
        <label className="block">
          <span className={labelCls}>Usaha tanpa buku usaha: uang masuk ke rekening (dikunci)</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-slate-100 px-4 py-2.5 fs-13 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 fs-13 font-bold text-white disabled:opacity-40 dark:bg-violet-600"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Buat akun
        </button>
      </div>
    </div>
  );
}

function MemberEdit({
  m,
  shops,
  accounts,
  kasOptions,
  extras,
  onDone,
  onRefresh,
  onError,
}: {
  m: TeamMember;
  shops: Shop[];
  accounts: { id: string; name: string }[];
  kasOptions: KasOption[];
  extras: boolean;
  onDone: (msg: string) => void;
  /** Simpan tanpa menutup panel (foto). */
  onRefresh: (msg: string) => void;
  onError: (e: string) => void;
}) {
  const [shopIds, setShopIds] = useState(m.shop_ids);
  const [accountId, setAccountId] = useState(m.account_id ?? accounts[0]?.id ?? '');
  const [role, setRole] = useState(m.role || 'kasir');
  const [kas, setKas] = useState<Record<string, string>>(m.kas ?? {});
  const [kartu, setKartu] = useState(false);
  const butuhRekening = perluRekening(shopIds, kasOptions, extras);
  const shopKartu = shops.find((s) => m.shop_ids.includes(s.id)) ?? shops[0];
  const [newPw, setNewPw] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      onDone(msg);
    } catch (e) {
      onError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  const btn = 'flex items-center justify-center gap-1.5 rounded-full py-2 fs-12 font-bold disabled:opacity-40';
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      {extras && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          {m.has_photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto staf privat
            <img src={teamService.photoUrl(m)} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400 dark:bg-slate-900">
              <UserRound size={24} />
            </span>
          )}
          <span className="flex flex-1 flex-wrap gap-2">
            <label className={cn(btn, 'cursor-pointer bg-white px-3 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700')}>
              <Camera size={13} /> {m.has_photo ? 'Ganti foto' : 'Tambah foto'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setBusy(true);
                  void fotoKeBase64(f, 1000)
                    .then((img) => teamService.setPhoto(m.id, img))
                    .then(() => onRefresh(`Foto ${m.name} disimpan.`))
                    .catch((err) => onError(err instanceof Error && err.message ? err.message : 'Foto gagal disimpan.'))
                    .finally(() => setBusy(false));
                }}
              />
            </label>
            <button type="button" onClick={() => setKartu((v) => !v)} className={cn(btn, 'bg-slate-900 px-3 text-white dark:bg-white dark:text-slate-900')}>
              <IdCard size={13} /> {kartu ? 'Tutup kartu' : 'Kartu staf'}
            </button>
          </span>
        </div>
      )}
      {kartu && shopKartu && (
        <KartuView
          shop={shopKartu}
          data={{
            jenis: 'STAF',
            nama: m.name,
            nomor: m.staff_no ?? '—',
            baris: [
              ['Jabatan', jabatanLabel(m.role)],
              ['Usaha', m.shop_ids.map((sid) => shops.find((s) => s.id === sid)?.name).filter(Boolean).join(', ') || '—'],
            ],
            fotoUrl: m.has_photo ? teamService.photoUrl(m) : null,
          }}
          namaFile={`Kartu-Staf-${(m.staff_no ?? m.name).replace(/[^\w-]+/g, '-')}.png`}
          wa={null}
          pesanWa={`Kartu staf ${shopKartu.name} — ${m.name} (${m.staff_no ?? ''}).`}
          catatan="Kartu staf hanya memuat nama, jabatan, nomor staf, dan usaha. QR hanya berisi nomor staf."
        />
      )}
      {extras && <JabatanPicker value={role} onChange={setRole} />}
      <div>
        <span className={labelCls}>Usaha yang dipegang</span>
        <ShopPicker shops={shops} value={shopIds} onChange={setShopIds} />
      </div>
      {extras && <KasPicker shops={shops} shopIds={shopIds} options={kasOptions} value={kas} onChange={setKas} />}
      {butuhRekening && (
        <label className="block">
          <span className={labelCls}>Usaha tanpa buku usaha: rekening tujuan</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={busy || !shopIds.length}
        onClick={() =>
          run(
            () => teamService.update(m.id, { shopIds, ...(butuhRekening && accountId ? { accountId } : {}), ...(extras ? { role, kas: kasFor(shopIds, kasOptions, kas) } : {}) }),
            role !== m.role ? `Akses disimpan. ${m.name} perlu masuk ulang (jabatan berubah).` : 'Akses tim disimpan.',
          )
        }
        className={cn(btn, 'w-full bg-slate-900 text-white dark:bg-violet-600')}
      >
        <Check size={13} /> Simpan akses
      </button>
      {newPw !== null ? (
        <div className="flex gap-2">
          <input
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className={cn(fieldCls, 'py-2 font-mono fs-12')}
            aria-label="Sandi baru"
          />
          <button
            type="button"
            disabled={busy || newPw.length < 8}
            onClick={() =>
              run(
                () => teamService.update(m.id, { password: newPw }),
                `Sandi ${m.name} direset: ${newPw} — kirim lewat jalur pribadi.`,
              )
            }
            className={cn(btn, 'shrink-0 bg-violet-600 px-4 text-white')}
          >
            Reset
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setNewPw(genPassword())}
          className={cn(btn, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}
        >
          <KeyRound size={13} /> Reset sandi
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              () => teamService.update(m.id, { disabled: !m.disabled }),
              m.disabled ? `${m.name} diaktifkan.` : `${m.name} dinonaktifkan & dikeluarkan.`,
            )
          }
          className={cn(btn, 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}
        >
          <Power size={13} /> {m.disabled ? 'Aktifkan' : 'Nonaktifkan'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            confirmDel
              ? run(() => teamService.remove(m.id), `Akun ${m.name} dihapus. Penjualannya tetap tercatat.`)
              : setConfirmDel(true)
          }
          className={cn(
            btn,
            confirmDel ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
          )}
        >
          <Trash2 size={13} /> {confirmDel ? 'Yakin?' : 'Hapus'}
        </button>
      </div>
    </div>
  );
}
