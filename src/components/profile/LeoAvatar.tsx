import Image from 'next/image';
import { cn } from '@/lib/utils';

// Avatar profil: singa Leo bergaya (warna bulu, aksesori, latar) atau foto
// yang diunggah. Konfigurasinya disimpan di preferensi akun ($.prefs.avatar).

export type AvatarConfig = { mode: 'leo' | 'photo'; fur: string; acc: string; bg: string };
export const DEFAULT_AVATAR: AvatarConfig = { mode: 'leo', fur: 'kuning', acc: 'none', bg: 'krem' };

// [surai, wajah, telinga dalam]
export const AVATAR_FURS: Record<string, { label: string; mane: string; face: string; swatch: string }> = {
  kuning: { label: 'Kuning', mane: '#f5a623', face: '#ffe0a3', swatch: '#f5a623' },
  oranye: { label: 'Oranye', mane: '#ee7a2b', face: '#ffc98f', swatch: '#ee7a2b' },
  coklat: { label: 'Coklat', mane: '#8a5a33', face: '#d9a877', swatch: '#8a5a33' },
  abu: { label: 'Abu', mane: '#8f9bab', face: '#d9dee6', swatch: '#9aa5b3' },
  hitam: { label: 'Hitam', mane: '#2f3138', face: '#6b6f7a', swatch: '#2f3138' },
  putih: { label: 'Putih', mane: '#e8e2d6', face: '#fbf8f2', swatch: '#f4f1ea' },
};
export const AVATAR_BGS: Record<string, string> = {
  krem: '#f1e8db', peach: '#fbd8c4', kuning: '#f8e3a1', mint: '#cdebdc', biru: '#cfe1f6', ungu: '#e0d9f5', pink: '#f6d3df', navy: '#262b45',
};
export const AVATAR_ACCS: { key: string; label: string }[] = [
  { key: 'none', label: 'Tanpa' },
  { key: 'topi', label: 'Topi' },
  { key: 'kupluk', label: 'Kupluk' },
  { key: 'kacamata', label: 'Kacamata' },
  { key: 'kacamata_hitam', label: 'Kacamata hitam' },
  { key: 'headphone', label: 'Headphone' },
  { key: 'pita', label: 'Pita' },
  { key: 'bunga', label: 'Bunga' },
];

const MANE_POINTS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return [50 + Math.cos(a) * 27, 54 + Math.sin(a) * 27] as const;
});

function Accessory({ acc }: { acc: string }) {
  switch (acc) {
    case 'topi':
      return (
        <g>
          <path d="M28 33 Q50 10 72 33 Z" fill="#3b82f6" />
          <rect x="22" y="31" width="44" height="6" rx="3" fill="#2563eb" />
          <circle cx="50" cy="15" r="3" fill="#ef4444" />
        </g>
      );
    case 'kupluk':
      return (
        <g>
          <path d="M27 36 Q50 6 73 36 Z" fill="#ef4444" />
          <rect x="26" y="32" width="48" height="8" rx="4" fill="#b91c1c" />
          <circle cx="50" cy="10" r="5" fill="#fff" />
        </g>
      );
    case 'kacamata':
      return (
        <g fill="none" stroke="#3f3f46" strokeWidth="2.6">
          <circle cx="41" cy="52" r="7" />
          <circle cx="59" cy="52" r="7" />
          <path d="M48 52 h4 M34 50 l-6 -2 M66 50 l6 -2" />
        </g>
      );
    case 'kacamata_hitam':
      return (
        <g>
          <path d="M31 47 h16 l-2 9 q-6 3 -12 0 Z M53 47 h16 l-2 9 q-6 3 -12 0 Z" fill="#18181b" />
          <path d="M47 49 h6" stroke="#18181b" strokeWidth="2.5" />
        </g>
      );
    case 'headphone':
      return (
        <g>
          <path d="M24 56 Q24 24 50 24 Q76 24 76 56" fill="none" stroke="#27272a" strokeWidth="4" />
          <rect x="18" y="50" width="10" height="16" rx="4" fill="#3b82f6" />
          <rect x="72" y="50" width="10" height="16" rx="4" fill="#3b82f6" />
        </g>
      );
    case 'pita':
      return (
        <g>
          <path d="M62 30 l-9 -6 v12 Z M62 30 l9 -6 v12 Z" fill="#ec4899" />
          <circle cx="62" cy="30" r="3" fill="#be185d" />
        </g>
      );
    case 'bunga':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((d) => (
            <circle key={d} cx={66 + Math.cos((d * Math.PI) / 180) * 4} cy={30 + Math.sin((d * Math.PI) / 180) * 4} r="3.6" fill="#f9a8d4" />
          ))}
          <circle cx="66" cy="30" r="2.6" fill="#facc15" />
        </g>
      );
    default:
      return null;
  }
}

export function LeoAvatarSvg({ config, className }: { config: AvatarConfig; className?: string }) {
  const fur = AVATAR_FURS[config.fur] ?? AVATAR_FURS.kuning;
  const bg = AVATAR_BGS[config.bg] ?? AVATAR_BGS.krem;
  const dark = config.fur === 'hitam';
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Avatar singa Leo">
      <circle cx="50" cy="50" r="50" fill={bg} />
      {MANE_POINTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" fill={fur.mane} />)}
      <circle cx="33" cy="34" r="7" fill={fur.face} />
      <circle cx="67" cy="34" r="7" fill={fur.face} />
      <circle cx="50" cy="55" r="23" fill={fur.face} />
      <circle cx="41" cy="52" r="3" fill={dark ? '#f8fafc' : '#27272a'} />
      <circle cx="59" cy="52" r="3" fill={dark ? '#f8fafc' : '#27272a'} />
      <circle cx="35" cy="61" r="3.5" fill="#f9a8b8" opacity="0.7" />
      <circle cx="65" cy="61" r="3.5" fill="#f9a8b8" opacity="0.7" />
      <path d="M46 58 h8 l-4 4 Z" fill="#7c4a3a" />
      <path d="M50 62 q-3 4 -6 2 M50 62 q3 4 6 2" fill="none" stroke="#7c4a3a" strokeWidth="1.6" strokeLinecap="round" />
      <Accessory acc={config.acc} />
    </svg>
  );
}

export function UserAvatar({ avatar, photoURL, name, size = 40, className }: { avatar?: AvatarConfig | null; photoURL?: string | null; name?: string; size?: number; className?: string }) {
  const usePhoto = photoURL && (avatar?.mode === 'photo' || !avatar);
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)} style={{ width: size, height: size }}>
      {usePhoto ? (
        <Image src={photoURL} alt={name ?? 'Foto profil'} fill unoptimized className="object-cover" />
      ) : (
        <LeoAvatarSvg config={avatar && avatar.mode === 'leo' ? avatar : { ...(avatar ?? DEFAULT_AVATAR), mode: 'leo' }} className="h-full w-full" />
      )}
    </span>
  );
}
