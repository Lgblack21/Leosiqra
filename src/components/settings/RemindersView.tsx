'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlarmClock, Plus, Trash2, Repeat, Loader2, BellOff, BellRing, X, Check } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { reminderService, type Reminder, type ReminderRepeat } from '@/lib/services/reminderService';
import { getExistingSubscription, isPushSupported, subscribeToPush } from '@/lib/pushNotifications';
import { isNativeApp } from '@/lib/pwaInstall';
import { nativePushStatus } from '@/lib/nativePush';
import { NumberInput } from '@/components/ui/NumberInput';
import { useFeedback } from '@/components/ui/Feedback';

// Pengaturan → Pengingat. Dikirim sebagai notifikasi push oleh cron Worker
// (±10 menit dari waktunya). Kalau ada nominal, mengetuk notifikasi membuka
// Input Cepat yang sudah terisi — tetap dicek & disimpan user sendiri.
// Dipakai juga di /app/notifikasi (tanpa openNotifications): varian dark: hanya
// aktif di /app; di aplikasi native (tanpa web push) pengingat tampil di Notifikasi.

const REPEATS: { id: ReminderRepeat; label: string }[] = [
  { id: 'none', label: 'Sekali' },
  { id: 'weekly', label: 'Tiap minggu' },
  { id: 'monthly', label: 'Tiap bulan' },
];

const pad = (n: number) => String(n).padStart(2, '0');
// Date → nilai <input type="datetime-local"> (waktu lokal perangkat).
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (days: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
};
const QUICK = [
  { label: 'Nanti malam 20.00', make: () => at(0, 20) },
  { label: 'Besok 09.00', make: () => at(1, 9) },
  {
    label: 'Tgl 1 bulan depan',
    make: () => {
      const d = at(0, 9);
      d.setMonth(d.getMonth() + 1, 1);
      return d;
    },
  },
];
const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const relative = (iso: string) => {
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (mins < 1) return 'sebentar lagi';
  if (mins < 60) return `${mins} menit lagi`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lagi`;
  return `${Math.round(hours / 24)} hari lagi`;
};

function ReminderForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() =>
    toLocalInput(QUICK[0].make().getTime() > Date.now() ? QUICK[0].make() : QUICK[1].make()),
  );
  const [amount, setAmount] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    const due = new Date(when);
    if (!title.trim()) return setError('Isi nama pengingatnya dulu.');
    if (Number.isNaN(due.getTime())) return setError('Tanggal & waktu belum benar.');
    if (due.getTime() < Date.now()) return setError('Waktunya sudah lewat — pilih waktu yang akan datang.');
    setSaving(true);
    try {
      await reminderService.create({
        title: title.trim(),
        amount: Number(amount) > 0 ? Number(amount) : null,
        dueAt: due.toISOString(),
        repeat,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan pengingat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[24px] bg-white p-4 ring-2 ring-indigo-200 dark:bg-slate-900 dark:ring-indigo-500/40">
      <div className="flex items-center justify-between">
        <p className="fs-15 font-bold text-slate-900 dark:text-white">Pengingat baru</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Tutup form"
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 80))}
        placeholder="Bayar kos, perpanjang STNK, kirim ke ortu…"
        aria-label="Nama pengingat"
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 fs-15 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
      />
      <div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setWhen(toLocalInput(q.make()))}
              className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {q.label}
            </button>
          ))}
        </div>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Tanggal & waktu"
          className="mt-2 w-full rounded-2xl bg-slate-50 px-4 py-3 fs-15 font-semibold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:[color-scheme:dark]"
        />
      </div>
      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {REPEATS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRepeat(r.id)}
            className={cn(
              'flex-1 rounded-xl py-2 fs-13 font-semibold',
              repeat === r.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <label className="block rounded-2xl bg-slate-50 px-4 py-2 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <span className="fs-12 font-semibold text-slate-500 dark:text-slate-400">Nominal (opsional)</span>
        <span className="flex items-center gap-1.5">
          <span className="fs-15 font-semibold text-slate-400">Rp</span>
          <NumberInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
            aria-label="Nominal"
            className="w-full bg-transparent fs-18 font-bold tabular-nums text-slate-900 outline-none dark:text-white"
          />
        </span>
      </label>
      <p className="px-1 fs-12 leading-snug text-slate-500 dark:text-slate-400">
        Kalau diisi, notifikasinya langsung membuka Input Cepat dengan nominal ini — tinggal cek lalu simpan.
      </p>
      {error && <p className="px-1 fs-13 font-semibold text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 fs-15 font-bold text-white disabled:opacity-50 dark:bg-indigo-600"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan pengingat
      </button>
    </div>
  );
}

export function RemindersView({ openNotifications }: { openNotifications?: () => void }) {
  const { confirm } = useFeedback();
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState('');
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  // Aplikasi native: status izin push FCM (null = bukan native / belum dicek).
  const [native, setNative] = useState<Awaited<ReturnType<typeof nativePushStatus>> | null>(null);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(() => {
    reminderService
      .list()
      .then((list) => {
        setItems(list);
        setError('');
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : 'Gagal memuat pengingat.');
      });
  }, []);
  useEffect(() => {
    load();
    if (isNativeApp()) void nativePushStatus().then(setNative);
    if (!isPushSupported()) setPushOn(false);
    else
      getExistingSubscription()
        .then((s) => setPushOn(Boolean(s)))
        .catch(() => setPushOn(false));
  }, [load]);

  const toggle = async (r: Reminder) => {
    setBusy(r.id);
    try {
      await reminderService.update(r.id, { active: !r.active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah pengingat.');
    } finally {
      setBusy('');
    }
  };
  const remove = async (r: Reminder) => {
    const ok = await confirm({
      title: 'Hapus pengingat?',
      message: `"${r.title}" tidak akan diingatkan lagi.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    setBusy(r.id);
    try {
      await reminderService.remove(r.id);
      load();
    } finally {
      setBusy('');
    }
  };

  // Tanpa openNotifications (/app): nyalakan push langsung di sini.
  const enablePush = async () => {
    if (openNotifications) return openNotifications();
    setEnabling(true);
    try {
      await subscribeToPush();
      setPushOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyalakan notifikasi.');
    } finally {
      setEnabling(false);
    }
  };

  const upcoming = (items ?? []).filter((r) => r.active);
  const done = (items ?? []).filter((r) => !r.active);
  const next = upcoming[0];

  return (
    <div className="space-y-4">
      {native && !openNotifications ? (
        native === 'granted' ? null : (
          <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 p-3 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20">
            <BellRing size={18} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="fs-13 leading-snug text-indigo-900 dark:text-indigo-200">
              Saat waktunya, pengingat muncul di tab <b>Notifikasi</b> (lonceng di Beranda).{' '}
              {native === 'unavailable'
                ? 'Pop-up di HP butuh versi aplikasi terbaru.'
                : 'Supaya juga muncul sebagai pop-up, izinkan notifikasi Leosiqra di Pengaturan HP.'}
            </span>
          </div>
        )
      ) : (
        pushOn === false && (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={enabling}
            className="flex w-full items-start gap-3 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200 disabled:opacity-60 dark:bg-amber-500/10 dark:ring-amber-500/30"
          >
            {enabling ? (
              <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-600" />
            ) : (
              <BellOff size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className="fs-13 leading-snug text-amber-900 dark:text-amber-200">
              <b>Notifikasi push belum aktif di perangkat ini.</b> Pengingat tetap tersimpan &amp; muncul di Notifikasi,
              tapi tidak muncul sebagai pop-up. Ketuk untuk menyalakan.
            </span>
          </button>
        )
      )}

      {next && !adding && (
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
          <AlarmClock size={90} className="absolute -right-4 -top-3 text-white/10" />
          <p className="fs-12 font-semibold uppercase tracking-wider text-white/70">
            Berikutnya · {relative(next.dueAt)}
          </p>
          <p className="mt-1 fsh-20 font-extrabold leading-tight">{next.title}</p>
          <p className="mt-1 fs-14 text-white/85">
            {fmtWhen(next.dueAt)}
            {next.amount ? ` · ${formatMoney(next.amount, 'IDR')}` : ''}
          </p>
        </div>
      )}

      {adding ? (
        <ReminderForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 fs-15 font-bold text-white dark:bg-indigo-600"
        >
          <Plus size={17} /> Tambah pengingat
        </button>
      )}

      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-14 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="py-6 text-center fs-14 text-slate-400 dark:text-slate-500">Memuat…</p>
      ) : items.length === 0 && !error ? (
        <div className="rounded-[22px] border-2 border-dashed border-slate-200 px-5 py-8 text-center dark:border-slate-700">
          <AlarmClock size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-2 fs-15 font-semibold text-slate-800 dark:text-slate-100">Belum ada pengingat</p>
          <p className="mt-0.5 fs-13 text-slate-500 dark:text-slate-400">
            Tagihan bulanan, jatuh tempo, atau hal kecil yang sering lupa.
          </p>
        </div>
      ) : (
        [
          { label: 'Akan datang', list: upcoming },
          { label: 'Selesai & dijeda', list: done },
        ].map((g) =>
          g.list.length ? (
            <div key={g.label}>
              <p className="px-1 pb-2 fs-14 text-slate-500 dark:text-slate-400">{g.label}</p>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
                {g.list.map((r) => (
                  <li key={r.id} className={cn('flex items-center gap-3 px-4 py-3', !r.active && 'opacity-60')}>
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                        r.active
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                      )}
                    >
                      {r.repeat === 'none' ? <AlarmClock size={18} /> : <Repeat size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate fs-15 font-semibold text-slate-900 dark:text-white">
                        {r.title}
                      </span>
                      <span className="block fs-12 text-slate-500 dark:text-slate-400">
                        {fmtWhen(r.dueAt)}
                        {r.repeat !== 'none' && ` · ${REPEATS.find((x) => x.id === r.repeat)?.label.toLowerCase()}`}
                        {r.amount ? ` · ${formatMoney(r.amount, 'IDR')}` : ''}
                      </span>
                    </span>
                    {(r.active || r.repeat !== 'none') && (
                      <button
                        type="button"
                        onClick={() => void toggle(r)}
                        disabled={busy === r.id}
                        className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {r.active ? 'Jeda' : 'Lanjut'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(r)}
                      disabled={busy === r.id}
                      aria-label={`Hapus ${r.title}`}
                      className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )
      )}
    </div>
  );
}
