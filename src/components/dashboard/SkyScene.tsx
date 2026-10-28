"use client";

// Pemandangan kartu sapaan Ringkasan: langit ikut jam perangkat — matahari
// melintas dari pagi ke sore, bulan & bintang di malam hari, awan dan burung
// di siang hari, siluet kota (jendela menyala saat malam) dengan hutan di
// depannya. Semua SVG/CSS tanpa gambar dan tanpa filter blur (blur di bawah
// overlay bikin kedipan hitam di Chrome Android). Animasi mati kalau
// prefers-reduced-motion (lihat .sky-* di globals.css).
export type SkyPeriod = 'morning' | 'day' | 'evening' | 'night';

export const skyPeriod = (hour: number): SkyPeriod =>
  hour < 4 || hour >= 19 ? 'night' : hour < 11 ? 'morning' : hour < 15 ? 'day' : 'evening';

const PALETTE: Record<SkyPeriod, { hills: string; city: string; forestBack: string; forestFront: string; window: string; windowOn: number }> = {
  morning: { hills: '#c7d2fe', city: '#7c83e6', forestBack: '#3d8f6d', forestFront: '#256b4e', window: '#e0e7ff', windowOn: 0.12 },
  day: { hills: '#ddd6fe', city: '#8b6be8', forestBack: '#368a66', forestFront: '#1f6447', window: '#ede9fe', windowOn: 0.1 },
  evening: { hills: '#fda4af', city: '#6d2a8a', forestBack: '#4a1f55', forestFront: '#2c1238', window: '#fde68a', windowOn: 0.45 },
  night: { hills: '#2e2a78', city: '#1b1946', forestBack: '#0d1532', forestFront: '#070c20', window: '#fde68a', windowOn: 0.8 },
};

// Gedung: [x, lebar, tinggi]. Tetap (bukan acak) supaya tidak berubah tiap render.
const BUILDINGS: [number, number, number][] = [
  [10, 46, 96], [60, 38, 140], [102, 56, 112], [162, 34, 178], [200, 60, 124], [264, 44, 92], [312, 52, 158],
  [368, 40, 206], [412, 64, 134], [480, 36, 104], [520, 58, 172], [582, 42, 120], [628, 60, 150], [692, 38, 98],
  [734, 54, 188], [792, 46, 128], [842, 62, 110], [908, 40, 164], [952, 56, 136], [1012, 36, 94], [1052, 58, 146],
  [1114, 44, 118], [1160, 40, 90],
];
const GROUND = 330;

// Pohon: [x, skala, jenis] — 0 cemara, 1 rindang.
const TREES_BACK: [number, number, 0 | 1][] = Array.from({ length: 34 }, (_, i) => [i * 36 + ((i * 17) % 13), 0.8 + ((i * 7) % 5) * 0.1, (i % 3 === 0 ? 1 : 0) as 0 | 1]);
const TREES_FRONT: [number, number, 0 | 1][] = Array.from({ length: 22 }, (_, i) => [i * 56 + ((i * 23) % 19) - 10, 1 + ((i * 5) % 4) * 0.15, (i % 2 === 0 ? 0 : 1) as 0 | 1]);

const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 37 + (i * i * 13) % 29) % 100, y: (i * 23 + (i * 7) % 17) % 58, r: i % 5 === 0 ? 1.6 : 1, d: (i % 7) * 0.6 }));

const Tree = ({ x, s, kind, base, color }: { x: number; s: number; kind: 0 | 1; base: number; color: string }) =>
  kind === 0 ? (
    <path d={`M${x} ${base - 46 * s} L${x + 15 * s} ${base} L${x - 15 * s} ${base} Z M${x} ${base - 66 * s} L${x + 11 * s} ${base - 30 * s} L${x - 11 * s} ${base - 30 * s} Z`} fill={color} />
  ) : (
    <g fill={color}>
      <rect x={x - 2.5 * s} y={base - 16 * s} width={5 * s} height={16 * s} />
      <circle cx={x} cy={base - 30 * s} r={17 * s} />
      <circle cx={x - 11 * s} cy={base - 20 * s} r={11 * s} />
      <circle cx={x + 11 * s} cy={base - 21 * s} r={12 * s} />
    </g>
  );

export function SkyScene({ now }: { now: Date | null }) {
  const h = now ? now.getHours() + now.getMinutes() / 60 : 12;
  const period = skyPeriod(Math.floor(h));
  const pal = PALETTE[period];
  const night = period === 'night';

  // Matahari 05.00–19.00, bulan 19.00–05.00, melintas busur. Desktop: di
  // tengah kartu (antara angka besar di kiri dan Leo di kanan). HP (kartu
  // tinggi, teks lebar): busur kecil di pojok kanan atas supaya tidak di
  // belakang angka.
  const sunP = Math.min(1, Math.max(0, (h - 5) / 14));
  const moonP = Math.min(1, Math.max(0, ((h - 19 + 24) % 24) / 10));
  const p = night ? moonP : sunP;
  const arc = Math.sin(Math.PI * p);
  const pos = {
    '--l': `${36 + p * 44}%`,
    '--t': `${52 - arc * 40}%`,
    '--lm': `${66 + p * 24}%`,
    '--tm': `${78 - arc * 40}px`,
  } as React.CSSProperties;
  const sunColor = period === 'evening' ? ['#fff7ed', '#fdba74', '#fb7185'] : ['#fffbeb', '#fde68a', '#fbbf24'];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Bintang & bintang jatuh */}
      {night && (
        <>
          {STARS.map((st, i) => (
            <span key={i} className="sky-twinkle absolute rounded-full bg-white" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.r * 2, height: st.r * 2, animationDelay: `${st.d}s` }} />
          ))}
          <span className="sky-shoot absolute left-[18%] top-[8%] h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent to-white" />
        </>
      )}

      {/* Matahari / bulan */}
      <div className="absolute left-[var(--lm)] top-[var(--tm)] -translate-x-1/2 -translate-y-1/2 scale-75 md:left-[var(--l)] md:top-[var(--t)] md:scale-100" style={pos}>
        {night ? (
          <div className="sky-float relative h-16 w-16 md:h-20 md:w-20">
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(254,243,199,0.28),transparent_68%)]" />
            <svg viewBox="0 0 80 80" className="relative h-full w-full">
              <defs>
                <mask id="moonCut">
                  <rect width="80" height="80" fill="white" />
                  <circle cx="54" cy="30" r="27" fill="black" />
                </mask>
              </defs>
              <circle cx="40" cy="40" r="30" fill="#fef3c7" mask="url(#moonCut)" />
              <circle cx="27" cy="48" r="3.5" fill="#fde68a" mask="url(#moonCut)" />
              <circle cx="22" cy="34" r="2.2" fill="#fde68a" mask="url(#moonCut)" />
            </svg>
          </div>
        ) : (
          <div className="relative h-16 w-16 md:h-20 md:w-20">
            <div className="absolute -inset-10 rounded-full" style={{ background: `radial-gradient(circle, ${sunColor[1]}66, transparent 66%)` }} />
            <svg viewBox="-60 -60 120 120" className="sky-spin absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)]">
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x="-2" y="-58" width="4" height="14" rx="2" fill={sunColor[1]} opacity="0.75" transform={`rotate(${i * 30})`} />
              ))}
            </svg>
            <div className="sky-pulse absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 38% 35%, ${sunColor[0]}, ${sunColor[1]} 55%, ${sunColor[2]})` }} />
          </div>
        )}
      </div>

      {/* Awan & burung (siang) */}
      {!night && (
        <>
          {[{ t: 34, s: 1, d: 0, dur: 70 }, { t: 92, s: 0.7, d: -28, dur: 90 }, { t: 10, s: 0.55, d: -55, dur: 110 }].map((c, i) => (
            <div key={i} className="sky-cloud absolute left-0" style={{ top: c.t, animationDuration: `${c.dur}s`, animationDelay: `${c.d}s` }}>
              <svg width={150 * c.s} height={50 * c.s} viewBox="0 0 150 50">
                <g fill="white" opacity={period === 'evening' ? 0.3 : 0.42}>
                  <ellipse cx="45" cy="34" rx="40" ry="14" />
                  <ellipse cx="78" cy="24" rx="30" ry="20" />
                  <ellipse cx="108" cy="34" rx="36" ry="13" />
                </g>
              </svg>
            </div>
          ))}
          {period === 'morning' && (
            <div className="sky-birds absolute left-0 top-[18%]">
              <svg width="90" height="30" viewBox="0 0 90 30" fill="none" stroke="#312e81" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
                <path className="sky-flap" d="M4 12 q6 -7 12 0 q6 -7 12 0" />
                <path className="sky-flap" style={{ animationDelay: '0.25s' }} d="M40 20 q5 -6 10 0 q5 -6 10 0" />
                <path className="sky-flap" style={{ animationDelay: '0.5s' }} d="M66 8 q4 -5 8 0 q4 -5 8 0" />
              </svg>
            </div>
          )}
        </>
      )}

      {/* Bukit jauh, kota, hutan */}
      <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[58%] w-full md:h-[70%]">
        <path d={`M0 ${GROUND - 40} C 180 ${GROUND - 110}, 330 ${GROUND - 40}, 520 ${GROUND - 90} S 860 ${GROUND - 30}, 1020 ${GROUND - 95} S 1160 ${GROUND - 60}, 1200 ${GROUND - 70} V400 H0 Z`} fill={pal.hills} opacity={night ? 0.7 : 0.45} />
        <g fill={pal.city} opacity={night ? 1 : 0.75}>
          {BUILDINGS.map(([x, w, hgt], i) => (
            <g key={i}>
              <rect x={x} y={GROUND - hgt} width={w} height={hgt + 70} rx="2" />
              {i % 4 === 1 && <rect x={x + w / 2 - 1.5} y={GROUND - hgt - 26} width="3" height="26" />}
              {i % 4 === 1 && night && <circle className="sky-blink" cx={x + w / 2} cy={GROUND - hgt - 27} r="3" fill="#f87171" />}
            </g>
          ))}
        </g>
        <g fill={pal.window}>
          {BUILDINGS.flatMap(([x, w, hgt], i) =>
            Array.from({ length: Math.floor(hgt / 26) }, (_, r) =>
              Array.from({ length: Math.floor(w / 16) }, (_, c) => {
                const on = ((i * 7 + r * 3 + c * 5) % 10) / 10 < pal.windowOn;
                return on ? <rect key={`${i}-${r}-${c}`} x={x + 6 + c * 16} y={GROUND - hgt + 10 + r * 26} width="7" height="10" rx="1" className={(i + r + c) % 9 === 0 ? 'sky-window' : undefined} /> : null;
              })
            )
          )}
        </g>
        <path d={`M0 ${GROUND + 6} C 200 ${GROUND - 14}, 420 ${GROUND + 18}, 640 ${GROUND - 4} S 1000 ${GROUND + 16}, 1200 ${GROUND - 6} V400 H0 Z`} fill={pal.forestBack} />
        {TREES_BACK.map(([x, s, k], i) => <Tree key={i} x={x} s={s} kind={k} base={GROUND + 12} color={pal.forestBack} />)}
        <path d={`M0 ${GROUND + 44} C 260 ${GROUND + 22}, 520 ${GROUND + 56}, 760 ${GROUND + 34} S 1080 ${GROUND + 50}, 1200 ${GROUND + 30} V400 H0 Z`} fill={pal.forestFront} />
        {TREES_FRONT.map(([x, s, k], i) => <Tree key={i} x={x} s={s} kind={k} base={GROUND + 52} color={pal.forestFront} />)}
      </svg>
    </div>
  );
}
