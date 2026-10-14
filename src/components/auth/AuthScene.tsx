"use client";

import { useSeason } from "@/lib/season";

import { useLayoutEffect } from "react";

// Latar "langit kota" untuk halaman auth. Warna langit mengikuti jam perangkat
// (pagi, siang, sore, malam): malam ada bintang, bulan, dan lampu jendela.
//
// Halaman ini static export, jadi HTML awalnya tidak tahu jam pengunjung.
// Supaya tidak berkedip (sore → malam) saat F5, bagian waktu ditulis ke
// <html data-daypart> oleh script kecil yang jalan SEBELUM halaman digambar,
// dan semua perbedaan visual (warna, bulan, bintang, awan, sapaan) diatur
// CSS dari atribut itu — tidak menunggu React. Navigasi di sisi client (script
// inline tidak dijalankan ulang) ditangani useLayoutEffect, juga sebelum paint.
export type DayPart = "pagi" | "siang" | "sore" | "malam";

const DAYPART_JS =
  "(function(){var h=new Date().getHours();document.documentElement.setAttribute('data-daypart',h>=5&&h<10?'pagi':h>=10&&h<15?'siang':h>=15&&h<18?'sore':'malam')})()";

const dayPartNow = (): DayPart => {
  const h = new Date().getHours();
  return h >= 5 && h < 10 ? "pagi" : h >= 10 && h < 15 ? "siang" : h >= 15 && h < 18 ? "sore" : "malam";
};

function useDayPartAttr() {
  useLayoutEffect(() => {
    const update = () => document.documentElement.setAttribute("data-daypart", dayPartNow());
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);
}

// Sapaan sesuai waktu — keempatnya dirender, CSS menampilkan satu.
export function Greeting() {
  return (
    <>
      <span className="auth-greet" data-p="pagi">Selamat pagi</span>
      <span className="auth-greet" data-p="siang">Selamat siang</span>
      <span className="auth-greet" data-p="sore">Selamat sore</span>
      <span className="auth-greet" data-p="malam">Selamat malam</span>
    </>
  );
}

// Gedung: [x, lebar, tinggi] dalam koordinat 0..1000 × tinggi 300.
const FAR = [[0, 60, 120], [55, 45, 170], [95, 70, 135], [160, 40, 210], [196, 80, 150], [270, 50, 190], [315, 90, 125], [400, 45, 230], [440, 70, 160], [505, 55, 200], [555, 85, 140], [635, 40, 250], [670, 75, 175], [740, 60, 140], [795, 50, 215], [840, 90, 155], [925, 75, 185]];
const NEAR = [[0, 85, 90], [80, 55, 140], [130, 95, 100], [220, 50, 170], [265, 70, 120], [330, 110, 85], [435, 60, 150], [490, 45, 195], [530, 90, 115], [615, 55, 160], [665, 100, 95], [760, 65, 180], [820, 85, 125], [900, 50, 155], [945, 60, 105]];

function Skyline() {
  return (
    <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[46%] w-full" aria-hidden>
      {FAR.map(([x, w, h], i) => (
        <g key={`f${i}`} style={{ fill: "var(--sky-far)" }} opacity="0.75">
          <rect x={x} y={300 - h} width={w} height={h} rx="3" />
          {i % 3 === 0 && <rect x={x + w / 2 - 1.5} y={300 - h - 22} width="3" height="22" />}
        </g>
      ))}
      {NEAR.map(([x, w, h], i) => (
        <rect key={`n${i}`} x={x} y={300 - h} width={w} height={h} rx="4" style={{ fill: "var(--sky-near)" }} />
      ))}
      {/* Lampu jendela — hanya tampil malam (CSS) */}
      <g className="auth-night">
        {NEAR.map(([x, w, h], i) =>
          Array.from({ length: Math.floor(h / 26) }, (_, r) =>
            Array.from({ length: Math.max(1, Math.floor(w / 22)) }, (_, c) =>
              (r * 7 + c * 3 + i) % 3 === 0 ? (
                <rect
                  key={`${i}-${r}-${c}`}
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
          ),
        )}
      </g>
      {/* Pohon di kaki kota */}
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={`t${i}`} cx={i * 48 + (i % 2) * 14} cy={296 - (i % 3) * 4} r={18 + (i % 4) * 4} style={{ fill: "var(--sky-near)" }} opacity="0.9" />
      ))}
    </svg>
  );
}

export function AuthScene({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  useDayPartAttr();
  const season = useSeason();
  return (
    <div className={`auth-sky relative overflow-hidden ${className}`}>
      <script dangerouslySetInnerHTML={{ __html: DAYPART_JS }} />
      <div className="auth-sun pointer-events-none absolute rounded-full" aria-hidden />
      {season === "halloween" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="leo-bat absolute text-xl" style={{ top: `${14 + i * 12}%`, animationDelay: `${i * 3.2}s`, animationDuration: `${11 + i * 3}s` }}>🦇</span>
          ))}
          <span className="absolute right-6 top-0 text-2xl opacity-70">🕸️</span>
        </div>
      )}
      <div className="auth-moon pointer-events-none absolute rounded-full" aria-hidden />
      <div className="auth-night" aria-hidden>
        {Array.from({ length: 36 }, (_, i) => (
          <span
            key={i}
            className="auth-star absolute rounded-full bg-white"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 50}%`, width: i % 5 ? 2 : 3, height: i % 5 ? 2 : 3, animationDelay: `${(i % 7) * 0.45}s` }}
          />
        ))}
      </div>
      <div className="auth-day" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="auth-cloud pointer-events-none absolute" style={{ top: `${12 + i * 13}%`, left: 0, width: "100%", animationDuration: `${70 + i * 25}s`, animationDelay: `${-i * 22}s` }}>
            <div className="h-8 w-40 rounded-full bg-white/50 blur-[2px]" style={{ transform: `scale(${1 - i * 0.2})` }} />
          </div>
        ))}
      </div>
      <Skyline />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
