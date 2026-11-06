"use client";

import { useReducedMotion } from 'framer-motion';
import { LeoMascot, type LeoActivity, type LeoMood } from '@/components/mascot/LeoMascot';
import type { FocusKind } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

// "Bukit Fokus" — Leo duduk di puncak bukit, di bawah langit yang ikut jam perangkat.
// Matahari/bulan berjalan di lengkung langit mengikuti progres sesi (0 → 1), jadi waktu
// fokus terlihat dari langit. Tiga lapis:
//   1. langit (CSS gradien seluruh bidang) + lengkung & bintang (SVG "meet", selalu utuh)
//   2. bukit belakang (SVG "slice", menempel bawah & memenuhi lebar)
//   3. Leo (diletakkan dengan container query, cocok dengan skala "slice") + bukit depan,
//      rumput, barang sesuai jenis fokus, kunang-kunang (malam) / kupu-kupu (siang).
type Sky = 'pagi' | 'siang' | 'sore' | 'malam';
const skyOf = (h: number): Sky => (h >= 5 && h < 10 ? 'pagi' : h >= 10 && h < 15 ? 'siang' : h >= 15 && h < 18 ? 'sore' : 'malam');
const SKY_BG: Record<Sky, string> = {
  pagi: 'linear-gradient(180deg,#FFE4D1 0%,#FBD3E9 45%,#CFE6FF 100%)',
  siang: 'linear-gradient(180deg,#9BD3FF 0%,#C9E8FF 55%,#EAF6FF 100%)',
  sore: 'linear-gradient(180deg,#FFB38A 0%,#F7A1C4 45%,#B9A6FF 100%)',
  malam: 'linear-gradient(180deg,#0F1235 0%,#211C55 50%,#3A2C7A 100%)',
};
const HILL: Record<Sky, { back: string; mid: string; front: string; grass: string }> = {
  pagi: { back: '#BFE6C7', mid: '#93D7A6', front: '#6CC488', grass: '#4FAE6F' },
  siang: { back: '#B6E7BE', mid: '#86D39B', front: '#5DBF7E', grass: '#43A866' },
  sore: { back: '#D7B9E6', mid: '#A9C98E', front: '#86B874', grass: '#6A9E5C' },
  malam: { back: '#2A2F66', mid: '#232A5A', front: '#1B224C', grass: '#2C3A78' },
};
// Bintang tetap (tidak acak per render → tidak berkedip saat render ulang).
const STARS = [[30, 30], [62, 70], [96, 22], [140, 52], [178, 18], [226, 40], [262, 16], [300, 58], [334, 26], [370, 64], [20, 104], [388, 112], [118, 96], [286, 98]];

// Lapis bukit: viewBox sangat lebar (-800…1200 × 250, "slice" menempel bawah) → praktis selalu
// diskalakan menurut TINGGI (H/250 per satuan), jadi di layar lebar bukit tidak naik menutupi langit.
// Bagian tengah (0…400) = komposisi utama. S = skala yang sama dalam satuan container query.
const S = 'max(0.05cqw, 0.4cqh)';
const VB = '-800 0 2000 250';

export function FocusScene({ now, kind, mood, activity, lookX, music, focusing, progress = 0, className }: {
  now: Date;
  kind: FocusKind;
  mood: LeoMood;
  activity: LeoActivity | null;
  lookX: number;
  music: boolean;
  focusing: boolean;
  progress?: number;
  className?: string;
  fill?: boolean;
}) {
  const reduce = useReducedMotion();
  const sky = skyOf(now.getHours());
  const night = sky === 'malam';
  const hill = HILL[sky];
  // Lengkung matahari: setengah lingkaran pusat (200,190) jari-jari 150 (viewBox 400×200).
  const p = Math.min(1, Math.max(0, progress));
  const ang = Math.PI * (1 - p);
  const sx = 200 + 150 * Math.cos(ang);
  const sy = 190 - 150 * Math.sin(ang);

  return (
    <div className={cn('relative h-full w-full overflow-hidden [container-type:size]', className)} style={{ background: SKY_BG[sky] }}>
      {/* 1. Langit: bintang + lengkung perjalanan matahari/bulan */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMin meet" className="absolute inset-x-0 top-0 h-[78%] w-full" aria-hidden>
        <defs>
          <radialGradient id="fs-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={night ? '#FEF3C7' : '#FFF7AE'} stopOpacity="0.75" />
            <stop offset="1" stopColor={night ? '#FEF3C7' : '#FFF7AE'} stopOpacity="0" />
          </radialGradient>
        </defs>
        {night && STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 1.1 : 1.7} fill="#FFFFFF" className={reduce ? undefined : 'focus-twinkle'} style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
        ))}
        {!night && (
          <g className={reduce ? undefined : 'focus-cloud'} fill="#FFFFFF" opacity="0.85">
            <ellipse cx="70" cy="60" rx="26" ry="9" /><ellipse cx="86" cy="54" rx="16" ry="10" />
            <ellipse cx="320" cy="44" rx="22" ry="8" /><ellipse cx="334" cy="39" rx="13" ry="8" />
          </g>
        )}
        <path d="M50 190 A150 150 0 0 1 350 190" fill="none" stroke={night ? '#FFFFFF' : '#FFFFFF'} strokeOpacity={night ? 0.22 : 0.55} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        {p > 0 && <path d="M50 190 A150 150 0 0 1 350 190" pathLength={1} fill="none" stroke={night ? '#FDE68A' : '#FFFFFF'} strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${p} 1`} />}
        <circle cx={sx} cy={sy} r="30" fill="url(#fs-glow)" />
        {night ? (
          <path d={`M${sx + 4} ${sy - 13} a13 13 0 1 0 9 22 a11 11 0 1 1 -9 -22 Z`} fill="#FEF3C7" />
        ) : (
          <circle cx={sx} cy={sy} r="12" fill={sky === 'sore' ? '#FFD19A' : '#FFE066'} />
        )}
      </svg>

      {/* 2. Bukit belakang */}
      <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M-800 200 Q-640 168 -480 196 T-160 188 T60 186 Q110 150 160 196 T400 178 T720 190 T1040 182 T1200 194 L1200 260 L-800 260 Z" fill={hill.back} />
        <path d="M-800 222 Q-600 196 -400 214 T0 210 Q90 186 200 204 T440 198 T800 212 T1200 206 L1200 260 L-800 260 Z" fill={hill.mid} />
      </svg>

      {/* 3. Leo di puncak bukit depan */}
      {/* Ukuran Leo hanya ikut TINGGI (0.4cqh/satuan) supaya di layar lebar tidak raksasa & menabrak timer;
          posisi kaki tetap di puncak bukit depan (y≈196 pada skala slice S). */}
      <div className="absolute" style={{ left: '50cqw', top: `calc(100cqh - 54 * ${S} - 34.4cqh)`, width: '41.6cqh', transform: 'translateX(-50%)' }}>
        <LeoMascot mood={mood} activity={activity} lookX={lookX} size={140} headphones music={music} stayAwake className="h-auto w-full" />
      </div>
      <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d="M-800 236 Q-400 226 -40 232 Q80 210 200 196 Q320 210 440 232 Q800 226 1200 236 L1200 260 L-800 260 Z" fill={hill.front} />
        <ellipse cx="200" cy="200" rx="56" ry="6" fill="#FFFFFF" opacity={night ? 0.08 : 0.25} />
        {/* Rumput & bunga */}
        {[[120, 214], [146, 207], [262, 208], [292, 215], [330, 224], [80, 226]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y} q-2 -7 -5 -9 M${x} ${y} q1 -8 0 -11 M${x} ${y} q3 -6 6 -8`} stroke={hill.grass} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ))}
        {!night && [[108, 220, '#F472B6'], [300, 218, '#FDE047'], [276, 226, '#FFFFFF']].map(([x, y, c], i) => (
          <g key={`f${i}`}><circle cx={x as number} cy={y as number} r="2.6" fill={c as string} /><circle cx={x as number} cy={y as number} r="1" fill="#F59E0B" /></g>
        ))}
        <KindProp kind={kind} night={night} />
        {/* Kunang-kunang (malam, lebih ramai saat fokus) / kupu-kupu (siang) */}
        {!reduce && night && [[90, 170], [130, 150], [270, 160], [320, 140], [350, 182], [56, 150], ...(focusing ? [[230, 130], [170, 120]] : [])].map(([x, y], i) => (
          <circle key={`ff${i}`} cx={x} cy={y} r="1.8" fill="#FDE68A" className="focus-firefly" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
        {!reduce && !night && [[96, 150, '#F472B6'], [312, 132, '#A78BFA']].map(([x, y, c], i) => (
          <g key={`b${i}`} className="focus-butterfly" style={{ animationDelay: `${i * 1.6}s`, transformOrigin: `${x}px ${y}px` }}>
            <path d={`M${x} ${y} q-6 -6 -8 0 q2 5 8 0 q6 -6 8 0 q-2 5 -8 0`} fill={c as string} className="focus-wing" style={{ transformOrigin: `${x}px ${y}px` }} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function KindProp({ kind, night }: { kind: FocusKind; night: boolean }) {
  const shade = night ? 0.85 : 1;
  if (kind === 'kerja') {
    // Laptop terbuka di samping Leo.
    return (
      <g opacity={shade}>
        <path d="M128 192 h34 l-3 -22 h-28 Z" fill="#CBD5E1" />
        <path d="M133 188 h24 l-2 -15 h-20 Z" fill={night ? '#818CF8' : '#E0E7FF'} />
        <path d="M122 194 h46 l-4 5 h-38 Z" fill="#94A3B8" />
      </g>
    );
  }
  if (kind === 'baca') {
    // Tumpukan buku + satu terbuka.
    return (
      <g opacity={shade}>
        <rect x="124" y="190" width="34" height="7" rx="1.5" fill="#F472B6" />
        <rect x="127" y="183" width="30" height="7" rx="1.5" fill="#60A5FA" />
        <path d="M262 196 q10 -6 20 0 q10 -6 20 0 l-2 4 q-9 -5 -18 0 q-9 -5 -18 0 Z" fill="#7C3AED" />
        <path d="M264 195 q9 -6 18 -1 v4 q-9 -4 -17 1 Z M300 195 q-9 -6 -18 -1 v4 q9 -4 17 1 Z" fill="#FFFFFF" />
      </g>
    );
  }
  if (kind === 'usaha') {
    // Kalkulator + koin (sentuhan Leosiqra).
    return (
      <g opacity={shade}>
        <rect x="128" y="180" width="24" height="18" rx="3" fill="#334155" />
        <rect x="131" y="183" width="18" height="4" rx="1" fill="#A7F3D0" />
        {[0, 1, 2].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={132 + c * 6} y={190 + r * 4} width="4" height="2.4" rx="0.8" fill="#94A3B8" />))}
        {[0, 1, 2].map((i) => <ellipse key={i} cx="276" cy={198 - i * 3.5} rx="8" ry="3" fill={i === 2 ? '#FBBF24' : '#F59E0B'} stroke="#B45309" strokeWidth="0.8" />)}
      </g>
    );
  }
  // belajar / lainnya: buku tulis + pensil
  return (
    <g opacity={shade}>
      <path d="M122 196 l8 -12 h30 l-6 12 Z" fill="#FFFFFF" stroke="#C7D2FE" strokeWidth="1" />
      {[0, 1, 2].map((i) => <path key={i} d={`M${130 - i} ${188 + i * 3} h22`} stroke="#C7D2FE" strokeWidth="1" />)}
      <path d="M150 198 L168 186" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <path d="M168 186 l3 -2" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}
