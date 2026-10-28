"use client";

import { useCallback, useEffect, useState } from 'react';
import { Camera, Mic, Bell, Image as ImageIcon, Loader2, Check, ShieldCheck, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isPushSupported } from '@/lib/pushNotifications';

// ===== Izin =====
// Status izin browser untuk perangkat ini (Permissions API). Mengizinkan
// kamera/mikrofon memicu dialog browser; notifikasi diarahkan ke Notifikasi
// supaya langganan push ikut dibuat. "Diblokir" hanya bisa dibuka dari
// pengaturan situs di browser — Leosiqra tidak bisa membukanya sendiri.
type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const queryPerm = async (name: 'camera' | 'microphone' | 'notifications'): Promise<PermState> => {
  if (name === 'notifications') {
    if (!isPushSupported() || typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission === 'default' ? 'prompt' : (Notification.permission as PermState);
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const r = await navigator.permissions.query({ name: name as PermissionName });
    return r.state as PermState;
  } catch {
    return 'prompt'; // Safari lama: tidak bisa ditanya, anggap belum diminta
  }
};

const STATE_LABEL: Record<PermState, { text: string; cls: string }> = {
  granted: { text: 'Diizinkan', cls: 'bg-emerald-50 text-emerald-700' },
  denied: { text: 'Diblokir', cls: 'bg-rose-50 text-rose-700' },
  prompt: { text: 'Belum diminta', cls: 'bg-slate-100 text-slate-600' },
  unsupported: { text: 'Tidak didukung', cls: 'bg-slate-100 text-slate-400' },
};

export function PermissionsView({ openNotifications }: { openNotifications: () => void }) {
  const [states, setStates] = useState<Record<'camera' | 'microphone' | 'notifications', PermState> | null>(null);
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    const [camera, microphone, notifications] = await Promise.all([queryPerm('camera'), queryPerm('microphone'), queryPerm('notifications')]);
    setStates({ camera, microphone, notifications });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const ask = async (kind: 'camera' | 'microphone') => {
    setBusy(kind);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ditolak — status di bawah ikut berubah */
    } finally {
      setBusy('');
      void refresh();
    }
  };

  const rows = [
    { key: 'camera' as const, icon: Camera, title: 'Kamera', desc: 'Foto struk & scan untuk dibaca AI.', onAsk: () => void ask('camera') },
    { key: 'microphone' as const, icon: Mic, title: 'Mikrofon', desc: 'Mencatat transaksi dengan suara.', onAsk: () => void ask('microphone') },
    { key: 'notifications' as const, icon: Bell, title: 'Notifikasi', desc: 'Pengingat, ringkasan & wawasan.', onAsk: openNotifications },
  ];

  return (
    <div className="space-y-4">
      <p className="px-1 text-[14px] text-slate-500">Izin di perangkat & browser ini. Leosiqra hanya meminta saat fiturnya kamu pakai.</p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200">
        {rows.map((r) => {
          const st = states?.[r.key];
          return (
            <li key={r.key} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><r.icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-slate-900">{r.title}</span>
                <span className="block text-[12px] text-slate-500">{r.desc}</span>
              </span>
              {!st ? (
                <Loader2 size={16} className="animate-spin text-slate-400" />
              ) : st === 'prompt' ? (
                <button type="button" onClick={r.onAsk} disabled={busy === r.key} className="rounded-full bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
                  {busy === r.key ? 'Menunggu…' : 'Izinkan'}
                </button>
              ) : (
                <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', STATE_LABEL[st].cls)}>{STATE_LABEL[st].text}</span>
              )}
            </li>
          );
        })}
        <li className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><ImageIcon size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-slate-900">Foto & file</span>
            <span className="block text-[12px] text-slate-500">Tidak perlu izin — kamu sendiri yang memilih file saat impor atau melampirkan struk.</span>
          </span>
        </li>
      </ul>
      {states && Object.values(states).includes('denied') && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-900">
          <Lock size={15} className="mt-0.5 shrink-0" /> Izin yang diblokir hanya bisa dibuka dari browser: ketuk ikon gembok di samping alamat situs → Izin situs. Di aplikasi HP: Pengaturan HP → Aplikasi → Leosiqra → Izin.
        </p>
      )}
    </div>
  );
}

// ===== Ingatan asisten =====
// $.prefs.aiMemory — dibaca Tanya Leo di setiap obrolan (lihat aiMemoryBlock
// di Worker). Maks 600 karakter per kolom.
type Memory = { style: string; learned: string; about: string };
const FIELDS: { key: keyof Memory; label: string; hint: string }[] = [
  { key: 'style', label: 'Gaya jawaban', hint: 'mis. Jawab singkat pakai poin, panggil aku Bos' },
  { key: 'learned', label: 'Yang perlu Leo ingat', hint: 'mis. Gojek & Grab itu Transportasi. Kos dibayar tiap tanggal 5.' },
  { key: 'about', label: 'Tentang kamu', hint: 'mis. Gajian tanggal 25, lagi nabung DP rumah, freelance desain' },
];
const MAX = 600;

export function AssistantMemoryView() {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [saved, setSaved] = useState<Memory | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    cloudflareApi<{ item?: { aiMemory?: Partial<Memory> } }>('/api/member/preferences', { cache: 'no-store' })
      .then((r) => {
        const m = { style: r.item?.aiMemory?.style ?? '', learned: r.item?.aiMemory?.learned ?? '', about: r.item?.aiMemory?.about ?? '' };
        setMemory(m);
        setSaved(m);
      })
      .catch(() => setMsg({ ok: false, text: 'Gagal memuat ingatan asisten.' }));
  }, []);

  const dirty = !!memory && !!saved && FIELDS.some((f) => memory[f.key] !== saved[f.key]);
  const save = async () => {
    if (!memory) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await cloudflareApi<{ item: { aiMemory: Memory } }>('/api/member/preferences', { method: 'PUT', json: { aiMemory: memory } });
      setMemory(r.item.aiMemory);
      setSaved(r.item.aiMemory);
      setMsg({ ok: true, text: 'Tersimpan — dipakai mulai pesan berikutnya.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally {
      setSaving(false);
    }
  };

  if (!memory) return <p className="py-6 text-center text-[14px] text-slate-400">{msg?.text ?? 'Memuat…'}</p>;
  return (
    <div className="space-y-4">
      <p className="px-1 text-[14px] leading-snug text-slate-500">Catatan yang dibaca <b>Tanya Leo</b> di setiap obrolan, supaya kamu tidak perlu mengulang. Kosongkan kapan saja.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="flex items-center justify-between px-1 text-[13px] font-semibold text-slate-600">
            {f.label}
            <span className={cn('text-[11px] font-normal tabular-nums', memory[f.key].length > MAX - 50 ? 'text-amber-600' : 'text-slate-400')}>{memory[f.key].length}/{MAX}</span>
          </span>
          <textarea
            value={memory[f.key]}
            onChange={(e) => setMemory({ ...memory, [f.key]: e.target.value.slice(0, MAX) })}
            rows={3}
            placeholder={f.hint}
            className="mt-1 w-full resize-none rounded-2xl bg-slate-50 p-3 text-[14px] text-slate-800 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300"
          />
        </label>
      ))}
      {msg && <p className={cn('px-1 text-[13px] font-semibold', msg.ok ? 'text-emerald-600' : 'text-rose-600')}>{msg.text}</p>}
      <button type="button" onClick={() => void save()} disabled={!dirty || saving} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white disabled:opacity-40">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan
      </button>
      <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Hanya dikirim ke AI saat kamu bertanya di Tanya Leo, bersama data keuanganmu seperti biasa. Jangan tulis kata sandi, PIN, atau nomor kartu.
      </p>
    </div>
  );
}
