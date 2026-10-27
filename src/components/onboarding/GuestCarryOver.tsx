'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Loader2, ReceiptText } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { subscribeToPush } from '@/lib/pushNotifications';
import { clearGuest, loadGuest, saveGuest, type GuestOnboarding } from '@/lib/guestOnboarding';
import { cn, formatIDR } from '@/lib/utils';

interface AccountRow {
  id: string;
  name: string;
  currency?: string;
}

// Langkah terakhir setup akun bagi yang datang dari /mulai: simpan pilihan
// (tujuan, cara mencatat, pengingat) ke akun, tawarkan catatan pertama untuk
// DISIMPAN (bukan otomatis — user lihat nominal & rekeningnya dulu), dan
// aktifkan notifikasi lewat tombol (izin notifikasi butuh ketukan user).
// Catatan dicatat lewat /api/member/quick-transaction (saldo ikut berubah,
// atomik di Worker); begitu sukses, catatan dihapus dari browser supaya tidak
// bisa tercatat dua kali.
export function GuestCarryOver({ onDone, dark = false }: { onDone: () => void; dark?: boolean }) {
  const [guest, setGuest] = useState<GuestOnboarding | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'skipped'>('idle');
  const [noteError, setNoteError] = useState('');
  const [pushState, setPushState] = useState<'idle' | 'working' | 'on'>('idle');
  const [pushError, setPushError] = useState('');
  // onDone disimpan di ref supaya efek pembuka (PUT preferensi) jalan sekali saja.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const g = loadGuest();
    if (!g) {
      doneRef.current();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data tamu baru bisa dibaca dari localStorage setelah hydrate
    setGuest(g);
    // Pilihan dari /mulai → akun. Gagal pun tidak menghalangi masuk.
    cloudflareApi('/api/member/preferences', {
      method: 'PUT',
      json: { goals: g.goals, inputMode: g.inputMode, reminder: g.reminder },
    }).catch((e) => console.error('Simpan preferensi gagal:', e));
    if (g.note) {
      cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/accounts')
        .then((res) => {
          const rows = res.items
            .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? ''), currency: typeof r.currency === 'string' ? r.currency : 'IDR' }))
            // Nominal di /mulai dibaca sebagai rupiah — hanya tawarkan rekening IDR.
            .filter((r) => r.id && (r.currency ?? 'IDR') === 'IDR');
          setAccounts(rows);
          if (rows[0]) setAccountId(rows[0].id);
        })
        .catch(() => setAccounts([]));
    }
  }, []);

  if (!guest) return null;
  const note = guest.note;

  const saveNote = async () => {
    if (!note || !accountId || noteState === 'saving' || noteState === 'saved') return;
    setNoteState('saving');
    setNoteError('');
    try {
      await cloudflareApi('/api/member/quick-transaction', {
        method: 'POST',
        json: {
          type: note.type,
          amount: note.amount,
          account_id: accountId,
          category: note.category,
          sub_category: note.subCategory,
          note: note.note,
        },
      });
      const rest = { ...guest, note: null };
      saveGuest(rest);
      setGuest(rest);
      setNoteState('saved');
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Gagal menyimpan catatan.');
      setNoteState('idle');
    }
  };

  const enablePush = async () => {
    setPushState('working');
    setPushError('');
    try {
      await subscribeToPush();
      setPushState('on');
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Gagal mengaktifkan notifikasi.');
      setPushState('idle');
    }
  };

  const finish = () => {
    clearGuest();
    doneRef.current();
  };

  const card = cn('rounded-[22px] p-5', dark ? 'bg-slate-900' : 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]');
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const strong = dark ? 'text-white' : 'text-slate-900';

  return (
    <div className="space-y-4">
      {note && noteState !== 'skipped' && (
        <div className={card}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ReceiptText size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[15px] font-bold', strong)}>
                {noteState === 'saved' ? 'Catatan pertama tersimpan' : 'Simpan catatan pertamamu?'}
              </p>
              <p className={cn('mt-0.5 text-[14px]', muted)}>
                {note.note} · {note.type === 'pemasukan' ? '+' : '−'}
                {formatIDR(note.amount)}
              </p>
            </div>
            {noteState === 'saved' && <Check size={20} className="shrink-0 text-emerald-500" />}
          </div>
          {noteState !== 'saved' &&
            (accounts === null ? (
              <p className={cn('mt-4 flex items-center gap-2 text-[13px]', muted)}>
                <Loader2 size={14} className="animate-spin" /> Memuat rekening…
              </p>
            ) : accounts.length === 0 ? (
              <p className={cn('mt-4 text-[13px]', muted)}>
                Belum ada rekening rupiah. Catatan ini bisa kamu tambahkan nanti lewat tombol + di aplikasi.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className={cn('block text-[13px] font-semibold', muted)}>
                  Ke rekening
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={cn(
                      'mt-1.5 block w-full rounded-xl border px-3 py-2.5 text-[15px] font-semibold outline-none',
                      dark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'
                    )}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
                {noteError && <p className="text-[13px] font-semibold text-rose-500">{noteError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={noteState === 'saving'}
                    className="flex h-10 items-center gap-2 rounded-full bg-indigo-600 px-5 text-[14px] font-bold text-white disabled:opacity-60"
                  >
                    {noteState === 'saving' && <Loader2 size={14} className="animate-spin" />}
                    Simpan
                  </button>
                  <button type="button" onClick={() => setNoteState('skipped')} className={cn('h-10 px-4 text-[14px] font-semibold', muted)}>
                    Tidak usah
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {guest.reminder.on && (
        <div className={card}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Bell size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[15px] font-bold', strong)}>Pengingat jam {guest.reminder.time}</p>
              <p className={cn('mt-0.5 text-[14px]', muted)}>
                {pushState === 'on' ? 'Notifikasi aktif di perangkat ini.' : 'Izinkan notifikasi supaya pengingatnya sampai ke perangkat ini.'}
              </p>
            </div>
            {pushState === 'on' && <Check size={20} className="shrink-0 text-emerald-500" />}
          </div>
          {pushState !== 'on' && (
            <div className="mt-4">
              {pushError && <p className="mb-2 text-[13px] font-semibold text-rose-500">{pushError}</p>}
              <button
                type="button"
                onClick={enablePush}
                disabled={pushState === 'working'}
                className={cn('flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-bold disabled:opacity-60', dark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white')}
              >
                {pushState === 'working' && <Loader2 size={14} className="animate-spin" />}
                Aktifkan notifikasi
              </button>
              <p className={cn('mt-2 text-[12px]', muted)}>Bisa diatur ulang kapan saja di Profil → Notifikasi.</p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={finish}
        disabled={noteState === 'saving'}
        className="h-12 w-full rounded-full bg-indigo-600 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
      >
        Masuk ke Leosiqra
      </button>
    </div>
  );
}
