"use client";

import { useEffect, useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Lock,
  KeyRound,
  Monitor,
  Smartphone,
  LogOut,
  Loader2,
  Bell,
  Clock,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Download,
  Cloud,
  RefreshCw,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, type User as AuthUser } from '@/lib/cf-auth';
import { doc, setDoc, refreshAllData, getLastSyncAt, DATA_SYNCED_EVENT } from '@/lib/cf-firestore';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeUserProfile } from '@/lib/services/userService';
import { ChangePasswordModal } from '@/components/modals/ChangePasswordModal';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { McpConnectCard } from '@/components/profile/McpConnectCard';
import { Modal } from '@/components/ui/Modal';
import { useFeedback } from '@/components/ui/Feedback';
import {
  isPushSupported,
  isIosNeedsInstall,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

// Bagian akun di panel Pengaturan (dulu halaman /membership/profile):
// Kontak, Keamanan (password, 2FA, perangkat), Notifikasi, Aplikasi
// terhubung (MCP), dan Input Cepat & reset data. Logika & endpoint sama
// persis dengan halaman lama — hanya dipindah tempat & tampilannya.

export type AccountView = 'kontak' | 'keamanan' | 'notifikasi' | 'ai' | 'lainnya';

// Jam pengingat tutup hari: tiap 30 menit 18:00–23:00 (cron tiap 10 menit di Worker).
const REMINDER_TIMES = Array.from({ length: 11 }, (_, i) => `${String(18 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const RESET_CONFIRM_WORD = 'HAPUS SEMUA DATA';

interface SessionInfo {
  id: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  isPermanent: boolean;
  isCurrent: boolean;
}

const Group = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('divide-y divide-slate-200/60 overflow-hidden rounded-[22px] bg-slate-50', className)}>{children}</div>
);

const Label = ({ children }: { children: React.ReactNode }) => <p className="px-1 pb-2 pt-1 text-[14px] text-slate-500">{children}</p>;

function Toggle({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60', on ? 'bg-emerald-500' : 'bg-slate-300')}
    >
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all', on ? 'right-1' : 'left-1')} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, action, children }: { icon: React.ElementType; title: string; desc?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="space-y-2 px-5 py-4">
      <div className="flex items-center gap-4">
        <Icon size={20} className="shrink-0 text-slate-500" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-slate-900">{title}</p>
          {desc && <p className="text-[13px] leading-snug text-slate-500">{desc}</p>}
        </div>
        {action}
      </div>
      {children && <div className="space-y-2 pl-9">{children}</div>}
    </div>
  );
}

const pill = 'shrink-0 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60';

// Profil yang dibutuhkan bagian ini (email, HP, alamat, status 2FA).
function useAccountProfile() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState({ email: '', phone: '', address: '', twoFactorEnabled: false });
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      unsubProfile?.();
      if (!u) return;
      unsubProfile = subscribeUserProfile(u.uid, (data) => {
        if (!data) return;
        const extra = data as typeof data & { whatsapp?: string; phone?: string; address?: string; twoFactorEnabled?: number | boolean | null };
        setProfile({
          email: data.email || u.email || '',
          phone: extra.whatsapp || extra.phone || '',
          address: extra.address || '',
          twoFactorEnabled: Boolean(extra.twoFactorEnabled),
        });
      });
    });
    return () => { unsubAuth(); unsubProfile?.(); };
  }, []);
  return { user, profile, setProfile };
}

function KontakView() {
  const { toast } = useFeedback();
  const { user, profile, setProfile } = useAccountProfile();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Hanya kontak — nama/foto/username diubah di Ubah profil.
      await setDoc(doc(db, 'users', user.uid), { phone: profile.phone, address: profile.address, updatedAt: new Date() }, { merge: true });
      toast.success('Kontak disimpan.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };
  const input = 'mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[16px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400';
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
        <label className="block">
          <span className="flex items-center gap-1.5 px-1 text-[14px] text-slate-500"><Mail size={14} /> Email</span>
          <input value={profile.email} disabled className={cn(input, 'text-slate-400')} />
          <span className="mt-1 block px-1 text-[12px] text-slate-400">Email tidak bisa diubah.</span>
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 px-1 text-[14px] text-slate-500"><Phone size={14} /> Nomor HP</span>
          <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+62 …" inputMode="tel" className={input} />
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 px-1 text-[14px] text-slate-500"><MapPin size={14} /> Alamat</span>
          <textarea rows={3} value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="Jl. …" className={cn(input, 'resize-none')} />
        </label>
      </div>
      <button type="button" onClick={save} disabled={saving || !user} className="w-full rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white disabled:opacity-60">
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  );
}

function KeamananView() {
  const { toast, confirm } = useFeedback();
  const { user, profile, setProfile } = useAccountProfile();
  const [showPassword, setShowPassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [disablePw, setDisablePw] = useState('');
  const [disableErr, setDisableErr] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    cloudflareApi<{ items: SessionInfo[] }>('/api/member/sessions')
      .then((res) => setSessions(res.items))
      .catch(console.error)
      .finally(() => setSessionsLoading(false));
  }, []);

  const revoke = async (id: string) => {
    const ok = await confirm({ title: 'Keluarkan perangkat ini?', message: 'Perangkat tersebut harus masuk lagi untuk memakai Leosiqra.', confirmLabel: 'Keluarkan', danger: true });
    if (!ok) return;
    setRevoking(id);
    try {
      await cloudflareApi(`/api/member/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengeluarkan perangkat.');
    } finally {
      setRevoking(null);
    }
  };

  const enable2FA = async (secret: string) => {
    try {
      await cloudflareApi('/api/member/2fa', { method: 'PATCH', json: { secret } });
      setProfile((p) => ({ ...p, twoFactorEnabled: true }));
      setShow2FASetup(false);
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const disable2FA = async () => {
    if (!disablePw) { setDisableErr('Masukkan password saat ini.'); return; }
    setDisableLoading(true);
    setDisableErr('');
    try {
      await cloudflareApi('/api/member/2fa', { method: 'PATCH', json: { disable: true, currentPassword: disablePw } });
      setProfile((p) => ({ ...p, twoFactorEnabled: false }));
      setShow2FADisable(false);
      setDisablePw('');
    } catch (e) {
      setDisableErr(e instanceof Error ? e.message : 'Gagal menonaktifkan 2FA.');
    } finally {
      setDisableLoading(false);
    }
  };

  const fmt = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="space-y-4">
      <Label>Masuk & akses</Label>
      <Group>
        <Row
          icon={Lock}
          title="Kata sandi"
          desc={user?.hasPassword === false ? 'Akun ini masuk dengan Google — buat kata sandi agar bisa masuk dengan email juga.' : 'Mengganti kata sandi memutus semua koneksi AI.'}
          action={<button type="button" onClick={() => setShowPassword(true)} className={pill}>{user?.hasPassword === false ? 'Buat' : 'Ganti'}</button>}
        />
        <Row
          icon={KeyRound}
          title="Verifikasi 2 langkah"
          desc={profile.twoFactorEnabled ? 'Aktif — kode authenticator diminta tiap masuk.' : 'Belum aktif — tambahkan kode authenticator saat masuk.'}
          action={
            profile.twoFactorEnabled ? (
              <button type="button" onClick={() => setShow2FADisable(true)} className={pill}>Nonaktifkan</button>
            ) : (
              <button type="button" onClick={() => setShow2FASetup(true)} className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-[14px] font-semibold text-white">Aktifkan</button>
            )
          }
        />
      </Group>

      <Label>Perangkat yang masuk</Label>
      <Group>
        {sessionsLoading ? (
          <p className="px-5 py-4 text-[14px] text-slate-400">Memuat…</p>
        ) : sessions.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-slate-500">Tidak ada sesi aktif.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              {s.isPermanent ? <Smartphone size={20} className="shrink-0 text-slate-500" /> : <Monitor size={20} className="shrink-0 text-slate-500" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-slate-900">
                  {s.device}
                  {s.isCurrent && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Perangkat ini</span>}
                  {s.isPermanent && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Aplikasi</span>}
                </p>
                <p className="text-[13px] text-slate-500">Aktif terakhir {fmt(s.lastSeenAt)}</p>
              </div>
              {!s.isCurrent && (
                <button type="button" onClick={() => revoke(s.id)} disabled={revoking === s.id} className={cn(pill, 'flex items-center gap-1.5 hover:text-rose-600')}>
                  {revoking === s.id ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Keluarkan
                </button>
              )}
            </div>
          ))
        )}
      </Group>

      <ChangePasswordModal isOpen={showPassword} onClose={() => setShowPassword(false)} hasPassword={user?.hasPassword} />
      <TwoFactorModal isOpen={show2FASetup} onClose={() => setShow2FASetup(false)} mode="setup" email={profile.email || user?.email || ''} onVerify={enable2FA} />
      <Modal
        isOpen={show2FADisable}
        onClose={() => { setShow2FADisable(false); setDisablePw(''); setDisableErr(''); }}
        title="Nonaktifkan 2FA"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Menonaktifkan 2FA mengurangi keamanan akun. Masukkan kata sandi saat ini untuk melanjutkan.</p>
          {disableErr && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{disableErr}</p>}
          <input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Kata sandi saat ini" className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-300" />
          <button type="button" onClick={disable2FA} disabled={disableLoading} className="w-full rounded-full bg-rose-600 py-3 text-sm font-bold text-white disabled:bg-slate-300">
            {disableLoading ? 'Memproses…' : 'Nonaktifkan 2FA'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function NotifikasiView() {
  const [supported, setSupported] = useState(true);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const [reminder, setReminder] = useState<{ on: boolean; time: string } | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState('');
  const [reportOn, setReportOn] = useState(false);
  const [reportAvailable, setReportAvailable] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    setSupported(isPushSupported());
    setIosNeedsInstall(isIosNeedsInstall());
    getExistingSubscription().then((sub) => setPushOn(Boolean(sub))).catch(() => setPushOn(false));
    cloudflareApi<{ item: { reminder: { on: boolean; time: string } } }>('/api/member/preferences')
      .then((res) => setReminder(res.item.reminder))
      .catch(() => setReminder(null));
    cloudflareApi<{ enabled: boolean; available: boolean }>('/api/member/email-report')
      .then((res) => { setReportOn(res.enabled); setReportAvailable(res.available); })
      .catch(() => setReportAvailable(false))
      .finally(() => setReportLoading(false));
  }, []);

  const togglePush = async () => {
    setPushError('');
    setPushLoading(true);
    try {
      if (pushOn) { await unsubscribeFromPush(); setPushOn(false); } else { await subscribeToPush(); setPushOn(true); }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Gagal mengubah notifikasi.');
    } finally {
      setPushLoading(false);
    }
  };

  const saveReminder = async (next: { on: boolean; time: string }) => {
    setReminderError('');
    setReminderSaving(true);
    try {
      const res = await cloudflareApi<{ item: { reminder: { on: boolean; time: string } } }>('/api/member/preferences', { method: 'PUT', json: { reminder: next } });
      setReminder(res.item.reminder);
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : 'Gagal menyimpan pengingat.');
    } finally {
      setReminderSaving(false);
    }
  };

  const toggleReport = async () => {
    setReportError('');
    setReportLoading(true);
    try {
      const res = await cloudflareApi<{ enabled: boolean }>('/api/member/email-report', { method: 'PUT', json: { enabled: !reportOn } });
      setReportOn(res.enabled);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Gagal mengubah laporan bulanan.');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Pengingat & laporan</Label>
      <Group>
        <Row
          icon={Bell}
          title="Notifikasi push"
          desc="Pengingat & ringkasan ke HP atau browser ini."
          action={
            iosNeedsInstall ? <span className="text-[12px] font-semibold text-amber-600">Pasang dulu</span>
            : !supported ? <span className="text-[12px] text-slate-400">Tidak didukung</span>
            : <Toggle on={pushOn} onClick={togglePush} label="Notifikasi push" disabled={pushLoading} />
          }
        >
          {iosNeedsInstall && <p className="text-[12px] text-slate-500">Di iPhone, tambahkan Leosiqra ke Home Screen dulu: Share di Safari → &quot;Add to Home Screen&quot;, lalu buka dari ikon itu.</p>}
          {pushError && <p className="text-[12px] text-rose-600">{pushError}</p>}
        </Row>
        {reminder && (
          <Row
            icon={Clock}
            title="Pengingat tutup hari"
            desc={`Tiap malam jam ${reminder.time}; tidak dikirim kalau hari itu sudah ada catatan. Butuh notifikasi push aktif.`}
            action={<Toggle on={reminder.on} onClick={() => saveReminder({ ...reminder, on: !reminder.on })} label="Pengingat tutup hari" disabled={reminderSaving} />}
          >
            {reminder.on && (
              <select
                value={reminder.time}
                disabled={reminderSaving}
                onChange={(e) => saveReminder({ on: true, time: e.target.value })}
                aria-label="Jam pengingat"
                className="rounded-xl bg-white px-3 py-2 text-[14px] text-slate-800 ring-1 ring-slate-200"
              >
                {[...new Set([...REMINDER_TIMES, reminder.time])].sort().map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {reminderError && <p className="text-[12px] text-rose-600">{reminderError}</p>}
          </Row>
        )}
        <Row
          icon={Mail}
          title="Laporan bulanan via email"
          desc="Ringkasan pemasukan, pengeluaran & anggaran tiap awal bulan."
          action={
            !reportAvailable && !reportOn && !reportLoading ? <span className="text-[12px] text-slate-400">Segera</span>
            : <Toggle on={reportOn} onClick={toggleReport} label="Laporan bulanan via email" disabled={reportLoading} />
          }
        >
          {reportError && <p className="text-[12px] text-rose-600">{reportError}</p>}
        </Row>
      </Group>
    </div>
  );
}

function LainnyaView() {
  const { user } = useAccountProfile();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const reset = async () => {
    setError('');
    if (user?.hasPassword !== false && !pw) { setError('Masukkan kata sandi saat ini.'); return; }
    if (confirmText.trim().toUpperCase() !== RESET_CONFIRM_WORD) { setError(`Ketik persis "${RESET_CONFIRM_WORD}" untuk konfirmasi.`); return; }
    setLoading(true);
    try {
      await cloudflareApi('/api/member/reset-data', { method: 'POST', json: user?.hasPassword !== false ? { currentPassword: pw } : {} });
      setDone(true);
      // Muat ulang penuh supaya cache data di klien ikut bersih.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      setTimeout(() => { window.location.href = '/membership/dashboard'; }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mereset data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Input Cepat</Label>
      <Group>
        <a href="/input-cepat" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-100/70">
          <Smartphone size={20} className="shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium text-slate-900">Buka Input Cepat</span>
            <span className="block text-[13px] text-slate-500">Catat dari HP — tambahkan ke layar utama biar tinggal tap.</span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </a>
        <a href="/install" className="flex items-center gap-4 px-5 py-4 hover:bg-slate-100/70">
          <Download size={20} className="shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium text-slate-900">Pasang Leosiqra di HP</span>
            <span className="block text-[13px] text-slate-500">Buka langsung dari layar utama, tanpa Play Store.</span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </a>
      </Group>

      <Label>Zona berbahaya</Label>
      <div className="space-y-3 rounded-[22px] bg-rose-50 p-4">
        <p className="text-[13px] leading-relaxed text-rose-700/90">
          Menghapus permanen semua transaksi, rekening, anggaran, investasi, tabungan, kategori, mata uang, transaksi rutin, dan riwayat chat AI. Akun (login, paket, riwayat pembayaran) tidak terhapus.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[15px] font-bold text-white hover:bg-rose-700">
          <Trash2 size={16} /> Reset semua data
        </button>
      </div>

      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); setPw(''); setConfirmText(''); setError(''); setDone(false); }}
        title="Reset Semua Data"
        maxWidth="max-w-md"
      >
        {done ? (
          <p className="rounded-xl bg-emerald-50 p-5 text-center text-sm text-emerald-700">Semua data berhasil dihapus. Mengalihkan ke Ringkasan…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-xs leading-relaxed text-rose-600">Tindakan ini <strong>permanen dan tidak bisa dibatalkan</strong>. Akun login tetap ada.</p>
            </div>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
            {user?.hasPassword === false ? (
              <p className="rounded-xl bg-slate-50 p-4 text-[12px] leading-relaxed text-slate-500">Akun ini masuk pakai Google — sesi yang aktif jadi bukti identitas. Ketik frasa konfirmasi di bawah.</p>
            ) : (
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Kata sandi saat ini" className="w-full rounded-xl bg-slate-50 px-4 py-3 pr-11 text-sm ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-rose-200" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            )}
            <label className="block text-[12px] text-slate-500">
              Ketik &quot;{RESET_CONFIRM_WORD}&quot; untuk konfirmasi
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={RESET_CONFIRM_WORD} className="mt-1.5 w-full rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-rose-200" />
            </label>
            <button type="button" onClick={reset} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3.5 text-sm font-bold text-white disabled:bg-slate-300">
              {loading ? 'Menghapus…' : <><Trash2 size={16} /> Hapus semua data permanen</>}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Sinkron cloud: semua data sudah tersimpan di server saat dicatat; tombol
// ini mengambil ulang data terbaru (mis. dari app HP / Shortcut) ke layar ini.
export function CloudSyncSection() {
  const { toast } = useFeedback();
  const [last, setLast] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    const update = () => setLast(getLastSyncAt());
    update();
    window.addEventListener(DATA_SYNCED_EVENT, update);
    return () => window.removeEventListener(DATA_SYNCED_EVENT, update);
  }, []);
  const sync = async () => {
    setSyncing(true);
    try {
      await refreshAllData();
      toast.success('Data sudah yang terbaru.');
    } catch (e) {
      console.error(e);
      toast.error('Gagal sinkron — cek koneksi internet lalu coba lagi.');
    } finally {
      setSyncing(false);
    }
  };
  const fmt = (t: number) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t));
  return (
    <>
      <Label>Cloud</Label>
      <Group>
        <Row
          icon={Cloud}
          title="Sinkronkan data ke cloud"
          desc={last ? `Terakhir sinkron ${fmt(last)}` : 'Semua catatan tersimpan langsung di server.'}
          action={
            <button type="button" onClick={sync} disabled={syncing} aria-label="Sinkronkan sekarang" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60">
              <RefreshCw size={17} className={cn(syncing && 'animate-spin')} />
            </button>
          }
        />
      </Group>
    </>
  );
}

// Simpan foto struk hasil scan AI sebagai lampiran transaksi (prefs di server).
export function AttachmentPrefSection() {
  const { toast } = useFeedback();
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    cloudflareApi<{ item: { saveAttachments?: boolean } }>('/api/member/preferences')
      .then((res) => setOn(res.item.saveAttachments !== false))
      .catch(() => setOn(null));
  }, []);
  const toggle = async () => {
    if (on === null) return;
    setSaving(true);
    try {
      const res = await cloudflareApi<{ item: { saveAttachments: boolean } }>('/api/member/preferences', { method: 'PUT', json: { saveAttachments: !on } });
      setOn(res.item.saveAttachments);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Label>Preferensi</Label>
      <Group>
        <Row
          icon={Paperclip}
          title="Simpan file lampiran"
          desc="Matikan untuk membaca foto struk tanpa menyimpannya di Leosiqra."
          action={<Toggle on={Boolean(on)} onClick={toggle} label="Simpan file lampiran" disabled={on === null || saving} />}
        />
      </Group>
    </>
  );
}

export function AccountSection({ view }: { view: AccountView }) {
  switch (view) {
    case 'kontak': return <KontakView />;
    case 'keamanan': return <KeamananView />;
    case 'notifikasi': return <NotifikasiView />;
    case 'ai': return <McpConnectCard />;
    case 'lainnya': return <LainnyaView />;
  }
}
