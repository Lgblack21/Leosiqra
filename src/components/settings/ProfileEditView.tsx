"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useFeedback } from '@/components/ui/Feedback';
import { LeoAvatarSvg, UserAvatar, AVATAR_FURS, AVATAR_BGS, AVATAR_ACCS, DEFAULT_AVATAR, type AvatarConfig } from '@/components/profile/LeoAvatar';

// Ubah profil (panel Pengaturan): avatar singa Leo yang bisa didandani,
// atau foto sendiri; plus nama & username. Satu-satunya tempat mengubah
// nama/foto/username (halaman Profil lama hanya untuk kontak & keamanan). Nama & foto lewat /api/member/profile,
// pilihan avatar lewat /api/member/preferences ($.prefs.avatar).

export const PROFILE_UPDATED_EVENT = 'leosiqra:profile-updated';

export function ProfileEditView({
  initialName,
  initialPhoto,
  initialAvatar,
  onSaved,
}: {
  initialName: string;
  initialPhoto: string | null;
  initialAvatar: AvatarConfig | null;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [cfg, setCfg] = useState<AvatarConfig>(initialAvatar ?? (initialPhoto ? { ...DEFAULT_AVATAR, mode: 'photo' } : DEFAULT_AVATAR));
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Username tidak ada di /api/auth/me — ambil dari profil.
  useEffect(() => {
    let active = true;
    cloudflareApi<{ item?: { username?: string | null } | null }>('/api/member/profile')
      .then((r) => {
        if (!active) return;
        const u = r.item?.username ?? '';
        setUsername(u);
        setInitialUsername(u);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const usernameValid = username === '' || /^[a-z0-9_.]{3,20}$/.test(username);
  const dirty =
    username !== initialUsername ||
    name.trim() !== initialName.trim() ||
    photo !== initialPhoto ||
    JSON.stringify(cfg) !== JSON.stringify(initialAvatar ?? (initialPhoto ? { ...DEFAULT_AVATAR, mode: 'photo' } : DEFAULT_AVATAR));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar (JPG/PNG).');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setPhoto(url);
      setCfg((c) => ({ ...c, mode: 'photo' }));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Nama tidak boleh kosong.');
      return;
    }
    if (!usernameValid) {
      setUsernameError('Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.');
      return;
    }
    if (cfg.mode === 'photo' && !photo) {
      toast.error('Unggah foto dulu, atau pilih avatar Leo.');
      return;
    }
    setSaving(true);
    try {
      const profilePatch: Record<string, string> = {};
      if (trimmed !== initialName.trim()) profilePatch.name = trimmed;
      if (photo && photo !== initialPhoto) profilePatch.photoURL = photo;
      if (username !== initialUsername) profilePatch.username = username;
      if (Object.keys(profilePatch).length) await cloudflareApi('/api/member/profile', { method: 'PATCH', json: profilePatch });
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { avatar: cfg } });
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      toast.success('Profil disimpan.');
      onSaved();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '';
      // Server membalas pesan jelas untuk username dipakai/tidak valid.
      if (/username/i.test(msg)) setUsernameError(msg);
      else toast.error('Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const leo = cfg.mode === 'leo';
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 pt-1">
        <UserAvatar avatar={cfg} photoURL={photo} name={name} size={128} />
        <div className="flex rounded-full bg-slate-100 p-1">
          <button type="button" onClick={() => setCfg((c) => ({ ...c, mode: 'leo' }))} className={cn('rounded-full px-5 py-2 text-[14px] font-semibold', leo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
            Avatar Leo
          </button>
          <button type="button" onClick={() => (photo ? setCfg((c) => ({ ...c, mode: 'photo' })) : fileRef.current?.click())} className={cn('rounded-full px-5 py-2 text-[14px] font-semibold', !leo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
            Foto sendiri
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
      </div>

      {leo ? (
        <>
          <section>
            <p className="px-1 pb-2.5 text-[15px] text-slate-500">Bulu</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(AVATAR_FURS).map(([key, f]) => (
                <button key={key} type="button" aria-label={`Bulu ${f.label}`} onClick={() => setCfg((c) => ({ ...c, fur: key }))}
                  className={cn('h-12 w-12 rounded-full ring-1 ring-slate-200 ring-offset-2', cfg.fur === key && 'ring-2 ring-slate-900')} style={{ background: f.swatch }} />
              ))}
            </div>
          </section>
          <section>
            <p className="px-1 pb-2.5 text-[15px] text-slate-500">Aksesori</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {AVATAR_ACCS.map((a) => (
                <button key={a.key} type="button" onClick={() => setCfg((c) => ({ ...c, acc: a.key }))}
                  className={cn('flex flex-col items-center gap-2 rounded-[20px] bg-slate-50 px-2 py-3 text-[13px] ring-1 transition-colors', cfg.acc === a.key ? 'font-semibold text-slate-900 ring-2 ring-slate-900' : 'text-slate-500 ring-transparent hover:bg-slate-100')}>
                  <LeoAvatarSvg config={{ ...cfg, acc: a.key }} className="h-14 w-14" />
                  {a.label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="px-1 pb-2.5 text-[15px] text-slate-500">Latar</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(AVATAR_BGS).map(([key, color]) => (
                <button key={key} type="button" aria-label={`Latar ${key}`} onClick={() => setCfg((c) => ({ ...c, bg: key }))}
                  className={cn('h-12 w-12 rounded-full ring-1 ring-slate-200 ring-offset-2', cfg.bg === key && 'ring-2 ring-slate-900')} style={{ background: color }} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="flex items-center gap-4 rounded-[22px] bg-slate-50 p-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {photo ? <Image src={photo} alt="Foto profil" fill unoptimized className="object-cover" /> : <Camera size={22} className="text-slate-400" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-slate-900">{photo ? 'Foto profilmu' : 'Belum ada foto'}</p>
            <p className="text-[13px] text-slate-500">JPG/PNG, otomatis dikecilkan.</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {photo ? 'Ganti' : 'Unggah'}
          </button>
        </section>
      )}

      <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
        <label className="block">
          <span className="px-1 text-[14px] text-slate-500">Nama</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nama kamu" className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[16px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400" />
        </label>
        <label className="block">
          <span className="px-1 text-[14px] text-slate-500">Username</span>
          <span className={cn('mt-1.5 flex items-center gap-2 rounded-2xl bg-white px-4 ring-1 focus-within:ring-2', usernameError || !usernameValid ? 'ring-rose-300 focus-within:ring-rose-400' : 'ring-slate-200 focus-within:ring-indigo-400')}>
            <AtSign size={17} className="shrink-0 text-slate-400" />
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s+/g, '')); setUsernameError(''); }}
              maxLength={20}
              placeholder="Pilih username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent py-3 text-[16px] outline-none"
            />
          </span>
          <span className={cn('mt-1.5 block px-1 text-[13px]', usernameError || !usernameValid ? 'text-rose-600' : 'text-slate-500')}>
            {usernameError || (!usernameValid ? '3–20 karakter: huruf kecil, angka, titik, atau garis bawah.' : 'Bisa dipakai untuk masuk selain email.')}
          </span>
        </label>
      </div>

      <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-white via-white to-white/0 px-6 pt-4">
        <button type="button" onClick={save} disabled={!dirty || saving || uploading} className="w-full rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white disabled:bg-slate-100 disabled:text-slate-400">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
