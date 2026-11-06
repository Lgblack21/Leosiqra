"use client";

import { useReducedMotion } from 'framer-motion';
import { LeoMascot, type LeoActivity, type LeoMood } from '@/components/mascot/LeoMascot';
import type { FocusKind } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

// Kamar belajar Leo (SVG orisinal). Tiga lapis: ruangan (belakang) → Leo → meja & barang
// (depan) — kaki Leo bertumpu di tepi meja. Langit jendela & lampu ikut jam perangkat,
// jam dinding menunjukkan jam sungguhan, barang di meja ikut jenis fokus.
type Sky = 'pagi' | 'siang' | 'sore' | 'malam';
const skyOf = (h: number): Sky => (h >= 5 && h < 10 ? 'pagi' : h >= 10 && h < 15 ? 'siang' : h >= 15 && h < 18 ? 'sore' : 'malam');
const SKY: Record<Sky, [string, string]> = {
  pagi: ['#BAE6FD', '#FDE68A'],
  siang: ['#7DD3FC', '#E0F2FE'],
  sore: ['#FB923C', '#FDE68A'],
  malam: ['#1E1B4B', '#4338CA'],
};

// fill = isi tinggi induk (layar penuh): bidang 16:10 diletakkan di tengah ruang yang ada
// (container query) supaya Leo & meja tidak gepeng di ukuran layar apa pun.
export function FocusScene({ now, kind, mood, activity, lookX, music, focusing, className, fill = false }: {
  now: Date;
  kind: FocusKind;
  mood: LeoMood;
  activity: LeoActivity | null;
  lookX: number;
  music: boolean;
  focusing: boolean;
  className?: string;
  fill?: boolean;
}) {
  const reduce = useReducedMotion();
  const sky = skyOf(now.getHours());
  const night = sky === 'malam';
  const [top, bottom] = SKY[sky];
  const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
  const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;

  const bg = night ? 'bg-gradient-to-b from-[#232046] to-[#2e2a5c]' : 'bg-gradient-to-b from-[#F1EEFF] to-[#E9E4FF]';
  if (fill) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden [container-type:size]', bg, className)}>
        <div className="absolute left-1/2 top-1/2 aspect-[16/10] -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(100cqw, 160cqh)' }}>
          <FocusScene now={now} kind={kind} mood={mood} activity={activity} lookX={lookX} music={music} focusing={focusing} className="!bg-none !bg-transparent" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn('relative aspect-[16/10] w-full overflow-hidden', bg, className)}>
      {/* Ruangan */}
      <svg viewBox="0 0 400 250" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
          <radialGradient id="fs-lamp" cx="0.5" cy="0" r="1">
            <stop offset="0" stopColor="#FEF3C7" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FEF3C7" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Jendela */}
        <rect x="34" y="28" width="104" height="92" rx="10" fill={night ? '#3B3768' : '#FFFFFF'} />
        <rect x="40" y="34" width="92" height="80" rx="6" fill="url(#fs-sky)" />
        {night ? (
          <g>
            <path d="M112 50 a12 12 0 1 0 8 20 a10 10 0 1 1 -8 -20 Z" fill="#FEF3C7" />
            {[[54, 46], [70, 62], [96, 44], [60, 96], [104, 92], [84, 80]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.7} fill="#FFFFFF" className={reduce ? undefined : 'focus-twinkle'} style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
          </g>
        ) : (
          <g>
            <circle cx={sky === 'sore' ? 104 : 110} cy={sky === 'sore' ? 86 : 54} r="11" fill={sky === 'sore' ? '#FDBA74' : '#FDE047'} />
            <g className={reduce ? undefined : 'focus-cloud'}>
              <ellipse cx="66" cy="74" rx="16" ry="7" fill="#FFFFFF" opacity="0.9" />
              <ellipse cx="78" cy="70" rx="11" ry="8" fill="#FFFFFF" opacity="0.9" />
            </g>
          </g>
        )}
        <path d="M86 34 V114 M40 74 H132" stroke={night ? '#3B3768' : '#FFFFFF'} strokeWidth="5" />
        <rect x="28" y="118" width="116" height="6" rx="3" fill={night ? '#3B3768' : '#DDD6FE'} />
        {/* Tanaman di ambang jendela */}
        <path d="M54 118 q-4 -14 4 -24 M56 118 q6 -12 -2 -22 M58 118 q10 -10 14 -20" stroke="#16A34A" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="48" y="108" width="20" height="12" rx="3" fill="#F8FAFC" />

        {/* Jam dinding (jam sungguhan) */}
        <circle cx="206" cy="48" r="20" fill="#FFFFFF" stroke={night ? '#4C4884' : '#DDD6FE'} strokeWidth="3" />
        {[0, 90, 180, 270].map((d) => (
          <circle key={d} cx={206 + 14 * Math.sin((d * Math.PI) / 180)} cy={48 - 14 * Math.cos((d * Math.PI) / 180)} r="1.3" fill="#94A3B8" />
        ))}
        <line x1="206" y1="48" x2="206" y2="37" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${hourDeg} 206 48)`} />
        <line x1="206" y1="48" x2="206" y2="32" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${minDeg} 206 48)`} />
        <circle cx="206" cy="48" r="2" fill="#F43F5E" />

        {/* Rak buku */}
        <rect x="282" y="78" width="96" height="5" rx="2.5" fill={night ? '#4C4884' : '#C4B5FD'} />
        {[['#F472B6', 288, 22], ['#60A5FA', 297, 26], ['#FBBF24', 306, 20], ['#34D399', 314, 24]].map(([c, x, h], i) => (
          <rect key={i} x={x as number} y={78 - (h as number)} width="8" height={h as number} rx="1.5" fill={c as string} opacity={night ? 0.8 : 1} />
        ))}
        <path d="M352 78 q-2 -14 6 -20 q8 6 6 20 Z" fill="#22C55E" opacity={night ? 0.8 : 1} />
        <rect x="348" y="68" width="16" height="10" rx="2" fill="#F8FAFC" />

        {/* Cahaya lampu meja (malam / sedang fokus) */}
        {(night || focusing) && <path d="M302 112 L250 190 L352 190 Z" fill="url(#fs-lamp)" opacity={night ? 0.9 : 0.45} className={reduce ? undefined : 'focus-lamp'} />}
      </svg>

      {/* Leo — kaki bertumpu di tepi meja */}
      <div className="absolute left-1/2 top-[27%] w-[33%] -translate-x-1/2">
        <LeoMascot mood={mood} activity={activity} lookX={lookX} size={140} headphones music={music} stayAwake className="h-auto w-full" />
      </div>

      {/* Meja & barang (depan Leo) */}
      <svg viewBox="0 0 400 250" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <path d="M34 190 H366 L378 210 H22 Z" fill={night ? '#5B5694' : '#DCD6FA'} />
        <rect x="22" y="210" width="356" height="9" rx="2" fill={night ? '#4C4884' : '#C9C1F5'} />
        <rect x="44" y="219" width="10" height="40" fill={night ? '#423E78' : '#C9C1F5'} />
        <rect x="346" y="219" width="10" height="40" fill={night ? '#423E78' : '#C9C1F5'} />

        {/* Gelas + uap */}
        <rect x="70" y="174" width="22" height="24" rx="5" fill="#FFFFFF" />
        <rect x="70" y="182" width="22" height="5" fill="#A5B4FC" />
        <path d="M92 180 q8 0 8 7 q0 7 -8 7" stroke="#FFFFFF" strokeWidth="3" fill="none" />
        {!reduce && (
          <g className="focus-steam" stroke={night ? '#C7D2FE' : '#A5B4FC'} strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M77 168 q-4 -6 0 -12 q4 -6 0 -12" />
            <path d="M85 168 q-4 -6 0 -12 q4 -6 0 -12" style={{ animationDelay: '0.9s' }} />
          </g>
        )}

        {/* Lampu meja */}
        <path d="M318 196 h28" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
        <path d="M332 196 L326 140 L304 118" stroke="#1E293B" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M290 104 q14 -8 26 8 l-18 14 q-12 -6 -8 -22 Z" fill="#1E293B" />
        <circle cx="302" cy="120" r="3" fill={night || focusing ? '#FEF3C7' : '#64748B'} />

        {/* Barang di meja sesuai jenis fokus */}
        <KindProp kind={kind} />
      </svg>
    </div>
  );
}

function KindProp({ kind }: { kind: FocusKind }) {
  if (kind === 'kerja') {
    // Laptop menghadap Leo (punggung layar terlihat).
    return (
      <g>
        <path d="M166 164 H234 L238 198 H162 Z" fill="#CBD5E1" />
        <path d="M170 168 H230 L233 194 H167 Z" fill="#E2E8F0" />
        <path d="M200 176 a6 6 0 1 1 -0.1 0" fill="#A5B4FC" />
        <rect x="150" y="196" width="100" height="6" rx="3" fill="#94A3B8" />
      </g>
    );
  }
  if (kind === 'baca') {
    return (
      <g>
        <path d="M156 200 Q178 186 200 196 Q222 186 244 200 L240 208 Q220 196 200 206 Q180 196 160 208 Z" fill="#7C3AED" />
        <path d="M160 198 Q180 184 200 194 V204 Q180 194 162 205 Z" fill="#FFFFFF" />
        <path d="M240 198 Q220 184 200 194 V204 Q220 194 238 205 Z" fill="#F8FAFC" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${170 + i} ${195 - i * 3} q12 -6 24 -1`} stroke="#CBD5E1" strokeWidth="1.4" fill="none" />)}
        {[0, 1, 2].map((i) => <path key={`r${i}`} d={`M${206} ${194 - i * 3} q12 -5 24 1`} stroke="#CBD5E1" strokeWidth="1.4" fill="none" />)}
      </g>
    );
  }
  if (kind === 'usaha') {
    // Kalkulator + nota (Leosiqra banget).
    return (
      <g>
        <rect x="150" y="186" width="34" height="22" rx="4" fill="#334155" />
        <rect x="154" y="189" width="26" height="6" rx="1.5" fill="#A7F3D0" />
        {[0, 1, 2].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={155 + c * 9} y={198 + r * 5} width="6" height="3" rx="1" fill="#94A3B8" />))}
        <path d="M206 184 h40 v26 l-5 -3 l-5 3 l-5 -3 l-5 3 l-5 -3 l-5 3 l-5 -3 l-5 3 Z" fill="#FFFFFF" />
        {[0, 1, 2].map((i) => <rect key={i} x="212" y={190 + i * 5} width={i === 2 ? 18 : 28} height="2" rx="1" fill={i === 2 ? '#10B981' : '#CBD5E1'} />)}
      </g>
    );
  }
  // belajar / lainnya: buku tulis terbuka + pensil
  return (
    <g>
      <path d="M150 192 H250 L256 210 H144 Z" fill="#6366F1" />
      <path d="M154 190 H198 L200 207 H150 Z" fill="#FFFFFF" />
      <path d="M202 190 H246 L250 207 H200 Z" fill="#FFFFFF" />
      {[0, 1, 2].map((i) => <path key={i} d={`M${158 - i} ${195 + i * 4} h36`} stroke="#C7D2FE" strokeWidth="1.3" />)}
      {[0, 1, 2].map((i) => <path key={`b${i}`} d={`M${206} ${195 + i * 4} h${i === 2 ? 22 : 36}`} stroke="#C7D2FE" strokeWidth="1.3" />)}
      <path d="M222 206 L252 186" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
      <path d="M252 186 l4 -3" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}
