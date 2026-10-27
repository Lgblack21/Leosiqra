"use client";

import { useId } from 'react';

// Koin Leo: koin logam berwarna Leosiqra (indigo → violet) dengan tepi bergerigi,
// bingkai timbul, dan cetakan singa yang bentuknya sama dengan maskot/avatar
// (surai 12 bulatan, telinga, wajah — lihat LeoAvatarSvg), dicetak monokrom
// seperti relief di koin asli. Satu SVG, tajam di ukuran berapa pun.

const MANE = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return [50 + Math.cos(a) * 19, 52 + Math.sin(a) * 19] as const;
});
const REEDS = Array.from({ length: 60 }, (_, i) => (i / 60) * 360);

export function LeoCoin({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  // Di ukuran kecil detail halus (gerigi, titik bingkai) hanya jadi noda —
  // dihilangkan supaya singanya tetap terbaca.
  const small = size < 30;
  const g = (n: string) => `${n}-${id}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a5b4fc" />
          <stop offset="0.35" stopColor="#6366f1" />
          <stop offset="0.7" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#3b0f9e" />
        </linearGradient>
        <linearGradient id={g('bevel')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c7d2fe" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <radialGradient id={g('field')} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#8b8cf8" />
          <stop offset="0.55" stopColor="#5b4ff0" />
          <stop offset="1" stopColor="#4c1fd0" />
        </radialGradient>
        <linearGradient id={g('relief')} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#eef2ff" />
          <stop offset="1" stopColor="#a5b4fc" />
        </linearGradient>
        <linearGradient id={g('shine')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={g('clip')}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>

      {/* bayangan & badan koin */}
      <circle cx="50" cy="53" r="48" fill="#1e1b4b" opacity="0.28" />
      <circle cx="50" cy="50" r="48" fill={`url(#${g('rim')})`} />
      {/* gerigi tepi */}
      {!small && (
        <g stroke="#312e81" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round">
          {REEDS.map((d) => (
            <line key={d} x1="50" y1="3.2" x2="50" y2="7" transform={`rotate(${d} 50 50)`} />
          ))}
        </g>
      )}
      {/* bingkai timbul */}
      <circle cx="50" cy="50" r={small ? 43 : 40.5} fill={`url(#${g('bevel')})`} />
      <circle cx="50" cy="50" r={small ? 40 : 37.5} fill={`url(#${g('field')})`} />
      {!small && <circle cx="50" cy="50" r="35" fill="none" stroke="#c7d2fe" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="0.1 2.6" strokeLinecap="round" />}

      {/* cetakan singa (bentuk sama dengan maskot), relief monokrom */}
      <g transform="translate(0 0.6)" opacity="0.35">
        {MANE.map(([x, y], i) => <circle key={i} cx={x} cy={y + 1.4} r="8" fill="#1e1b4b" />)}
        <circle cx="50" cy="53.4" r="16.5" fill="#1e1b4b" />
      </g>
      <g fill={`url(#${g('relief')})`}>
        {MANE.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" />)}
      </g>
      <g fill="#eef2ff">
        <circle cx="38" cy="37" r="5" />
        <circle cx="62" cy="37" r="5" />
        <circle cx="50" cy="52" r="16.5" />
      </g>
      <circle cx="50" cy="52" r="16.5" fill="none" stroke="#818cf8" strokeOpacity="0.7" strokeWidth="1" />
      <g fill="#312e81">
        <circle cx="43.6" cy="50" r={small ? 2.8 : 2.2} />
        <circle cx="56.4" cy="50" r={small ? 2.8 : 2.2} />
        <path d={small ? 'M46.6 55 h6.8 l-3.4 3.4 Z' : 'M47.2 55.2 h5.6 l-2.8 2.9 Z'} />
      </g>
      <path d="M50 58.2 q-2.2 3 -4.4 1.5 M50 58.2 q2.2 3 4.4 1.5" fill="none" stroke="#312e81" strokeWidth={small ? 1.8 : 1.2} strokeLinecap="round" />

      {/* kilau logam */}
      <g clipPath={`url(#${g('clip')})`}>
        <path d="M-10 30 L35 -10 L58 -10 L-10 52 Z" fill={`url(#${g('shine')})`} />
      </g>
      <circle cx="50" cy="50" r="47.4" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}
