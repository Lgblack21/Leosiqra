"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Leo — maskot singa Leosiqra. Digambar langsung sebagai SVG (tanpa aset
// gambar) supaya ringan, tajam di semua ukuran, dan ekspresinya bisa
// dianimasikan dari state halaman:
// Kaki depan "berpegangan" di tepi atas kartu form (cy≈182).
//   idle  : bernapas, berkedip, surai bergoyang, telinga sesekali berkedut
//   watch : matanya mengikuti ketikan (lookX 0..1, kiri → kanan)
//   hide  : kedua kaki depan menutup mata (saat mengetik password)
//   peek  : satu kaki turun, mengintip (password ditampilkan)
//   happy : melompat kecil, mata ^^, mulut terbuka, ada kilau
//   sad   : kepala miring, mata sayu, alis turun
// Plus perilaku sendiri (tanpa diatur halaman), hanya saat mood "idle":
//   - melambai sekali waktu halaman dibuka
//   - mata mengikuti kursor / sentuhan
//   - didiamkan 15 dtk → mengantuk, 22 dtk → tertidur (zzz); bangun saat ada aktivitas
//   - di-tap / diklik → kaget lalu ketawa (pasang `interactive`)
export type LeoMood = "idle" | "watch" | "hide" | "peek" | "happy" | "sad";

const C = {
  maneBack: "#E8590C",
  mane: "#F59E0B",
  maneLight: "#FBBF24",
  face: "#FCE3B8",
  muzzle: "#FFF6E6",
  ear: "#F8D29A",
  earIn: "#F9A8A4",
  ink: "#3B1D0A",
  nose: "#6B2A12",
  paw: "#F8CF8E",
  pawLine: "#D9973F",
  blush: "#FB7185",
};

const spring = { type: "spring" as const, stiffness: 260, damping: 20 };

export function LeoMascot({
  mood = "idle",
  lookX = 0.5,
  size = 160,
  className,
  interactive = false,
}: {
  mood?: LeoMood;
  lookX?: number;
  size?: number;
  className?: string;
  interactive?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [waving, setWaving] = useState(!reduce);
  const [boop, setBoop] = useState(false);
  const [sleep, setSleep] = useState<0 | 1 | 2>(0); // 0 bangun, 1 ngantuk, 2 tidur
  const idle = mood === "idle" && !boop;

  // Lambaian pembuka.
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setWaving(false), 1700);
    return () => clearTimeout(t);
  }, [reduce]);

  // Mata mengikuti kursor + timer kantuk. Aktivitas apa pun membangunkan Leo.
  useEffect(() => {
    let drowsy: ReturnType<typeof setTimeout>;
    let asleep: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(drowsy);
      clearTimeout(asleep);
      setSleep(0);
      if (reduce) return;
      drowsy = setTimeout(() => setSleep(1), 15000);
      asleep = setTimeout(() => setSleep(2), 22000);
    };
    const onMove = (e: PointerEvent) => {
      arm();
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const dy = (e.clientY - (r.top + r.height * 0.45)) / (window.innerHeight / 2);
      setGaze({ x: Math.max(-1, Math.min(1, dx * 1.6)), y: Math.max(-1, Math.min(1, dy * 1.6)) });
    };
    arm();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("keydown", arm);
    window.addEventListener("scroll", arm, { passive: true });
    return () => {
      clearTimeout(drowsy);
      clearTimeout(asleep);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("scroll", arm);
    };
  }, [reduce]);

  const onBoop = () => {
    if (boop) return;
    setBoop(true);
    setTimeout(() => setBoop(false), 1300);
  };

  const sleeping = idle && sleep === 2;
  const drowsy = idle && sleep === 1;
  const watching = mood === "watch";
  // Pupil: ikut ketikan saat "watch", ikut kursor saat idle.
  const px = watching ? (Math.min(1, Math.max(0, lookX)) - 0.5) * 7 : idle ? gaze.x * 4.5 : 0;
  const py = watching ? 2.5 : idle ? gaze.y * 3 : 0;
  const happy = mood === "happy" || boop;
  const sad = mood === "sad";

  // Posisi kaki: istirahat di bawah dagu, naik menutup mata, atau mengintip.
  const pawL = mood === "hide" || mood === "peek" ? { x: 12, y: -76 } : { x: 0, y: 0 };
  const pawR =
    mood === "hide"
      ? { x: -12, y: -76 }
      : mood === "peek"
        ? { x: -6, y: -38 }
        : waving && mood === "idle"
          ? { x: 22, y: -62, rotate: [0, -22, 16, -22, 16, -8, 0] }
          : { x: 0, y: 0, rotate: 0 };

  const body = boop
    ? { y: [0, 6, -14, 0], scaleY: [1, 0.86, 1.06, 1], scaleX: [1, 1.1, 0.96, 1], rotate: 0, transition: { duration: 0.7, ease: "easeOut" as const } }
    : happy
    ? { y: [0, -16, 0, -6, 0], rotate: 0, transition: { duration: 0.9, ease: "easeOut" as const } }
    : sleeping
      ? { y: 5, rotate: 6, transition: { duration: 1.6, ease: "easeInOut" as const } }
    : sad
      ? { y: 4, rotate: -7, transition: spring }
      : { y: 0, rotate: 0, transition: spring };

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 220 230"
      width={size}
      height={(size * 230) / 220}
      className={className}
      role="img"
      aria-label={`Leo si singa sedang ${happy ? "senang" : sad ? "sedih" : sleeping ? "tidur" : mood === "hide" ? "menutup mata" : mood === "peek" ? "mengintip" : "memperhatikan"}`}
      style={{ overflow: "visible", cursor: interactive ? "pointer" : undefined, pointerEvents: interactive ? "auto" : undefined }}
      onClick={interactive ? onBoop : undefined}
    >
      <motion.g animate={body} style={{ originX: "50%", originY: "90%" }}>
        <g className={reduce ? undefined : "leo-breathe"}>
          {/* Surai */}
          <g className={reduce ? undefined : "leo-mane"}>
            <circle cx="110" cy="108" r="74" fill={C.maneBack} />
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return (
                <circle
                  key={i}
                  cx={110 + Math.cos(a) * 62}
                  cy={108 + Math.sin(a) * 62}
                  r="25"
                  fill={i % 2 ? C.mane : C.maneLight}
                />
              );
            })}
          </g>

          {/* Telinga */}
          <g className={reduce ? undefined : "leo-ear-l"}>
            <circle cx="68" cy="62" r="15" fill={C.ear} />
            <circle cx="68" cy="63" r="7.5" fill={C.earIn} />
          </g>
          <g className={reduce ? undefined : "leo-ear-r"}>
            <circle cx="152" cy="62" r="15" fill={C.ear} />
            <circle cx="152" cy="63" r="7.5" fill={C.earIn} />
          </g>

          {/* Wajah */}
          <circle cx="110" cy="114" r="52" fill={C.face} />
          <ellipse cx="110" cy="152" rx="34" ry="12" fill="#F6D29F" opacity="0.45" />

          {/* Pipi merona */}
          <motion.ellipse cx="76" cy="128" rx="9" ry="5.5" fill={C.blush} animate={{ opacity: happy ? 0.55 : 0.28 }} />
          <motion.ellipse cx="144" cy="128" rx="9" ry="5.5" fill={C.blush} animate={{ opacity: happy ? 0.55 : 0.28 }} />

          {/* Alis (muncul saat sedih) */}
          <motion.g animate={{ opacity: sad ? 1 : 0 }}>
            <path d="M78 95 L96 88" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
            <path d="M142 95 L124 88" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
          </motion.g>

          {/* Mata */}
          {happy ? (
            <g stroke={C.ink} strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M80 106 Q88 96 96 106" />
              <path d="M124 106 Q132 96 140 106" />
            </g>
          ) : sleeping ? (
            <g stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
              <path d="M80 104 Q88 111 96 104" />
              <path d="M124 104 Q132 111 140 104" />
            </g>
          ) : drowsy ? (
            <g>
              {[88, 132].map((cx) => (
                <g key={cx}>
                  <ellipse cx={cx} cy="106" rx="7.5" ry="5" fill={C.ink} />
                  <path d={`M${cx - 9} 103 H${cx + 9}`} stroke={C.face} strokeWidth="5" />
                  <path d={`M${cx - 8} 104.5 Q${cx} 102 ${cx + 8} 104.5`} stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                </g>
              ))}
            </g>
          ) : (
            <g className={reduce || mood === "hide" ? undefined : "leo-blink"}>
              {[88, 132].map((cx) => (
                <motion.g key={cx} animate={{ x: px, y: py + (sad ? 3 : 0) }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                  <ellipse cx={cx} cy="104" rx="7.5" ry={sad ? 7 : 9.5} fill={C.ink} />
                  <circle cx={cx - 2.4} cy="100" r="2.8" fill="#fff" />
                  <circle cx={cx + 2.6} cy="108" r="1.3" fill="#fff" />
                </motion.g>
              ))}
            </g>
          )}

          {/* Moncong, hidung, mulut */}
          <ellipse cx="101" cy="132" rx="12" ry="9.5" fill={C.muzzle} />
          <ellipse cx="119" cy="132" rx="12" ry="9.5" fill={C.muzzle} />
          {[95, 99, 121, 125].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 134 : 131} r="1.2" fill="#D9A066" />
          ))}
          <path d="M102 120 Q110 115 118 120 Q115 127 110 128 Q105 127 102 120 Z" fill={C.nose} />
          {happy ? (
            <g>
              <path d="M98 136 Q110 154 122 136 Z" fill={C.nose} />
              <ellipse cx="110" cy="146" rx="6" ry="3.5" fill="#FB7185" />
            </g>
          ) : sleeping ? (
            <ellipse cx="110" cy="139" rx="3.5" ry="3" fill={C.nose} />
          ) : drowsy ? (
            <motion.ellipse cx="110" cy="140" rx="5" fill={C.nose} animate={{ ry: [2, 7, 7, 2] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }} />
          ) : sad ? (
            <path d="M100 142 Q110 135 120 142" stroke={C.nose} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M110 128 V134 M100 136 Q105 141 110 135 Q115 141 120 136" stroke={C.nose} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </g>

        {/* Kaki depan — di atas wajah supaya bisa menutup mata */}
        {[
          { cx: 76, pos: pawL },
          { cx: 144, pos: pawR },
        ].map(({ cx, pos }) => (
          <motion.g
            key={cx}
            animate={pos}
            transition={reduce ? { duration: 0 } : "rotate" in pos && Array.isArray(pos.rotate) ? { ...spring, rotate: { duration: 1.4, ease: "easeInOut" } } : spring}
            style={{ transformBox: "fill-box", transformOrigin: "50% 80%" }}
          >
            <ellipse cx={cx} cy="182" rx="22" ry="17" fill={C.paw} stroke="#E4A95A" strokeWidth="1.5" />
            <path d={`M${cx - 8} 174 v8 M${cx} 172 v10 M${cx + 8} 174 v8`} stroke={C.pawLine} strokeWidth="2.2" strokeLinecap="round" />
          </motion.g>
        ))}

        {/* Zzz saat tidur */}
        {sleeping && !reduce && (
          <g fill="#6366F1" fontFamily="system-ui, sans-serif" fontWeight="800">
            {[0, 1, 2].map((i) => (
              <motion.text
                key={i}
                x={160}
                y={70}
                fontSize={14 + i * 4}
                initial={{ opacity: 0, x: 160, y: 70 }}
                animate={{ opacity: [0, 1, 0], x: [160, 172 + i * 6, 184 + i * 8], y: [70, 50 - i * 6, 26 - i * 10] }}
                transition={{ duration: 2.6, delay: i * 0.8, repeat: Infinity }}
              >
                z
              </motion.text>
            ))}
          </g>
        )}

        {/* Kilau saat senang */}
        {happy && !reduce && (
          <g>
            {[
              [36, 40, 0],
              [186, 46, 0.12],
              [196, 120, 0.24],
              [26, 118, 0.18],
            ].map(([x, y, d], i) => (
              <motion.path
                key={i}
                d={`M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z`}
                fill="#FDE047"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 1.1, delay: d }}
                style={{ originX: `${x}px`, originY: `${y}px` }}
              />
            ))}
          </g>
        )}
      </motion.g>
    </motion.svg>
  );
}
