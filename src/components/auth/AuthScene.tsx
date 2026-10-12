"use client";

import { useEffect, useState } from "react";

// Latar "langit kota" untuk halaman masuk/daftar. Warna langit mengikuti jam
// perangkat (pagi, siang, sore, malam): malam ada bintang, bulan, dan lampu
// jendela gedung. Siluet kota digambar dari pola tetap (bukan acak) supaya
// hasil render sama di server dan browser.
export type DayPart = "pagi" | "siang" | "sore" | "malam";

export const dayPartOf = (hour: number): DayPart =>
  hour >= 5 && hour < 10 ? "pagi" : hour >= 10 && hour < 15 ? "siang" : hour >= 15 && hour < 18 ? "sore" : "malam";

export const greetingOf = (part: DayPart) =>
  part === "pagi" ? "Selamat pagi" : part === "siang" ? "Selamat siang" : part === "sore" ? "Selamat sore" : "Selamat malam";

export function useDayPart() {
  // Default "sore" untuk render statis; diganti jam asli setelah dimuat.
  const [part, setPart] = useState<DayPart>("sore");
  useEffect(() => {
    const update = () => setPart(dayPartOf(new Date().getHours()));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);
  return part;
}

const SKY: Record<DayPart, { top: string; mid: string; bottom: string; far: string; near: string; glow: string }> = {
  pagi: { top: "#7DD3FC", mid: "#C4B5FD", bottom: "#FED7AA", far: "#A5A1E8", near: "#6D5BD0", glow: "#FFF1D6" },
  siang: { top: "#3B82F6", mid: "#818CF8", bottom: "#E0E7FF", far: "#8B93E8", near: "#4F46E5", glow: "#FFFFFF" },
  sore: { top: "#4338CA", mid: "#A855F7", bottom: "#FDBA74", far: "#7C5CC4", near: "#3B2A7A", glow: "#FFD8A8" },
  malam: { top: "#0F0B2E", mid: "#2E1F6B", bottom: "#5B3FA8", far: "#2A2266", near: "#140F38", glow: "#C7B8FF" },
};

// Gedung: [x, lebar, tinggi] dalam koordinat 0..1000 × tinggi 300.
const FAR = [[0, 60, 120], [55, 45, 170], [95, 70, 135], [160, 40, 210], [196, 80, 150], [270, 50, 190], [315, 90, 125], [400, 45, 230], [440, 70, 160], [505, 55, 200], [555, 85, 140], [635, 40, 250], [670, 75, 175], [740, 60, 140], [795, 50, 215], [840, 90, 155], [925, 75, 185]];
const NEAR = [[0, 85, 90], [80, 55, 140], [130, 95, 100], [220, 50, 170], [265, 70, 120], [330, 110, 85], [435, 60, 150], [490, 45, 195], [530, 90, 115], [615, 55, 160], [665, 100, 95], [760, 65, 180], [820, 85, 125], [900, 50, 155], [945, 60, 105]];

function Skyline({ part }: { part: DayPart }) {
  const s = SKY[part];
  const night = part === "malam";
  return (
    <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[46%] w-full" aria-hidden>
      {FAR.map(([x, w, h], i) => (
        <g key={`f${i}`}>
          <rect x={x} y={300 - h} width={w} height={h} rx="3" fill={s.far} opacity="0.75" />
          {i % 3 === 0 && <rect x={x + w / 2 - 1.5} y={300 - h - 22} width="3" height="22" fill={s.far} opacity="0.75" />}
        </g>
      ))}
      {NEAR.map(([x, w, h], i) => (
        <g key={`n${i}`}>
          <rect x={x} y={300 - h} width={w} height={h} rx="4" fill={s.near} />
          {night &&
            Array.from({ length: Math.floor(h / 26) }, (_, r) =>
              Array.from({ length: Math.max(1, Math.floor(w / 22)) }, (_, c) =>
                (r * 7 + c * 3 + i) % 3 === 0 ? (
                  <rect
                    key={`${r}-${c}`}
                    x={x + 8 + c * 20}
                    y={300 - h + 12 + r * 24}
                    width="8"
                    height="10"
                    rx="1.5"
                    fill="#FDE68A"
                    className="auth-window"
                    style={{ animationDelay: `${((r + c + i) % 6) * 0.9}s` }}
                  />
                ) : null,
              ),
            )}
        </g>
      ))}
      {/* Pohon di kaki kota */}
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={`t${i}`} cx={i * 48 + (i % 2) * 14} cy={296 - (i % 3) * 4} r={18 + (i % 4) * 4} fill={s.near} opacity="0.9" />
      ))}
    </svg>
  );
}

export function AuthScene({ part, className = "", children }: { part: DayPart; className?: string; children?: React.ReactNode }) {
  const s = SKY[part];
  const night = part === "malam";
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(180deg, ${s.top} 0%, ${s.mid} 55%, ${s.bottom} 100%)`, transition: "background 1s ease" }}
    >
      {/* Matahari / bulan */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: night ? 70 : 120,
          height: night ? 70 : 120,
          right: part === "pagi" ? "70%" : "14%",
          top: part === "siang" ? "12%" : part === "malam" ? "14%" : "38%",
          background: night ? "radial-gradient(circle at 35% 35%, #FFFBEB, #E9D5FF)" : `radial-gradient(circle, ${s.glow} 0%, ${s.glow}AA 40%, transparent 70%)`,
          boxShadow: night ? "0 0 60px 10px rgba(199,184,255,.35)" : undefined,
        }}
        aria-hidden
      />
      {night &&
        Array.from({ length: 36 }, (_, i) => (
          <span
            key={i}
            className="auth-star absolute rounded-full bg-white"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 50}%`, width: i % 5 ? 2 : 3, height: i % 5 ? 2 : 3, animationDelay: `${(i % 7) * 0.45}s` }}
            aria-hidden
          />
        ))}
      {!night &&
        [0, 1, 2].map((i) => (
          <div key={i} className="auth-cloud pointer-events-none absolute" style={{ top: `${12 + i * 13}%`, left: 0, width: "100%", animationDuration: `${70 + i * 25}s`, animationDelay: `${-i * 22}s` }} aria-hidden>
            <div className="h-8 w-40 rounded-full bg-white/50 blur-[2px]" style={{ transform: `scale(${1 - i * 0.2})` }} />
          </div>
        ))}
      <Skyline part={part} />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
