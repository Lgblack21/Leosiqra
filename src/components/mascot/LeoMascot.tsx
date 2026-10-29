"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Season } from "@/lib/season";

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
// Aktivitas santai (hanya saat mood "idle", tidak sedang di-tap):
//   eat   : pegang paha ayam, mengunyah, remah jatuh
//   play  : bola memantul di atas kepala, mata mengikuti, kaki menepuk
//   coins : lempar koin berputar, tumpukan koin di samping
//   sleep : tidur (zzz + gelembung napas)
export type LeoActivity = "eat" | "play" | "coins" | "sleep";

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
  season = null,
  activity = null,
}: {
  mood?: LeoMood;
  lookX?: number;
  size?: number;
  className?: string;
  interactive?: boolean;
  // Aksesoris musiman (lib/season.ts) — null = tanpa aksesoris.
  season?: Season | null;
  activity?: LeoActivity | null;
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

  const act = idle ? activity : null;
  const sleeping = idle && (act === "sleep" || (!act && sleep === 2));
  const drowsy = idle && !act && sleep === 1;
  const eating = act === "eat";
  const playing = act === "play";
  const coins = act === "coins";
  const loop = (duration: number) => (reduce ? { duration: 0 } : { duration, repeat: Infinity, ease: "easeInOut" as const });
  const watching = mood === "watch";
  // Pupil: ikut ketikan saat "watch", ikut kursor saat idle.
  const px = watching ? (Math.min(1, Math.max(0, lookX)) - 0.5) * 7 : idle ? gaze.x * 4.5 : 0;
  const py = watching ? 2.5 : idle ? gaze.y * 3 : 0;
  const happy = mood === "happy" || boop;
  const sad = mood === "sad";

  // Posisi kaki: istirahat di bawah dagu, naik menutup mata, atau mengintip.
  const pawL = mood === "hide" || mood === "peek" ? { x: 12, y: -76 } : playing && !reduce ? { x: 4, y: [0, -6, 0] } : { x: 0, y: 0 };
  const pawR =
    eating
      ? { x: -6, y: -22, rotate: reduce ? 0 : [0, -8, 0] }
      : playing
        ? { x: -8, y: reduce ? -30 : [-10, -58, -10], rotate: 0 }
        : coins
          ? { x: -4, y: reduce ? -34 : [-34, -44, -34], rotate: 0 }
          : mood === "hide"
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
      aria-label={`Leo si singa sedang ${eating ? "makan" : playing ? "main bola" : coins ? "main koin" : happy ? "senang" : sad ? "sedih" : sleeping ? "tidur" : mood === "hide" ? "menutup mata" : mood === "peek" ? "mengintip" : "memperhatikan"}`}
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

          {season && <SeasonAccessory season={season} />}

          {/* Pipi merona */}
          <motion.ellipse cx="76" cy="128" rx="9" ry="5.5" fill={C.blush} animate={{ opacity: happy ? 0.55 : 0.28 }} />
          <motion.ellipse cx="144" cy="128" rx="9" ry="5.5" fill={C.blush} animate={{ opacity: happy ? 0.55 : 0.28 }} />

          {/* Alis (muncul saat sedih) */}
          <motion.g animate={{ opacity: sad ? 1 : 0 }}>
            <path d="M78 95 L96 88" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
            <path d="M142 95 L124 88" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
          </motion.g>

          {/* Mata (^^ juga saat makan — keenakan) */}
          {happy || eating ? (
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
                <motion.g
                  key={cx}
                  animate={playing || coins ? { x: playing ? 0 : 3, y: reduce ? -3 : playing ? [-1, -5, -1] : [-2, -5, -2] } : { x: px, y: py + (sad ? 3 : 0) }}
                  transition={playing ? loop(1.4) : coins ? loop(1.8) : { type: "spring", stiffness: 300, damping: 24 }}
                >
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
          {eating ? (
            <motion.ellipse cx="104" cy="140" rx="6" fill={C.nose} animate={reduce ? { ry: 3 } : { ry: [1.5, 5, 1.5] }} transition={loop(0.45)} />
          ) : coins ? (
            <ellipse cx="110" cy="140" rx="4" ry="5" fill={C.nose} />
          ) : happy || playing ? (
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

        {/* Properti aktivitas (di bawah kaki supaya terlihat dipegang) */}
        {eating && (
          <motion.g animate={reduce ? undefined : { rotate: [0, -10, 0], y: [0, -3, 0] }} transition={loop(0.9)} style={{ transformBox: "fill-box", transformOrigin: "80% 90%" }}>
            <path d="M142 162 L128 146" stroke="#FFF7ED" strokeWidth="7" strokeLinecap="round" />
            <circle cx="143" cy="166" r="4.5" fill="#FFF7ED" />
            <circle cx="147" cy="161" r="4.5" fill="#FFF7ED" />
            <ellipse cx="124" cy="138" rx="15" ry="11" fill="#B45309" transform="rotate(-40 124 138)" />
            <ellipse cx="120" cy="134" rx="6" ry="3.5" fill="#F59E0B" opacity="0.75" transform="rotate(-40 120 134)" />
            <circle cx="112" cy="146" r="5" fill={C.face} />
          </motion.g>
        )}
        {eating && !reduce &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={`crumb${i}`}
              cx={100 + i * 5}
              cy={146}
              r={1.8}
              fill="#B45309"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], y: [0, 22, 34], x: [0, (i - 1) * 6, (i - 1) * 9] }}
              transition={{ duration: 1.3, delay: i * 0.4, repeat: Infinity, ease: "easeIn" }}
            />
          ))}
        {playing && (
          <motion.g animate={reduce ? { y: -30 } : { y: [0, -58, 0], x: [0, 4, 0] }} transition={reduce ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: [0.33, 0, 0.67, 1] }}>
            <motion.g animate={reduce ? undefined : { rotate: [0, 360] }} transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: "linear" }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <circle cx="146" cy="2" r="14" fill="#F43F5E" />
              <path d="M132 2 H160" stroke="#FFF" strokeWidth="3" />
              <path d="M146 -12 Q155 2 146 16" stroke="#FFF" strokeWidth="3" fill="none" />
              <circle cx="141" cy="-3" r="3" fill="#FFF" opacity="0.6" />
            </motion.g>
          </motion.g>
        )}
        {coins && (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={`stack${i}`}>
                <ellipse cx="44" cy={196 - i * 6} rx="13" ry="5" fill="#D97706" />
                <ellipse cx="44" cy={193 - i * 6} rx="13" ry="5" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
              </g>
            ))}
            <motion.g animate={reduce ? { y: -40 } : { y: [-28, -96, -28] }} transition={loop(1.8)}>
              <motion.g animate={reduce ? undefined : { scaleX: [1, 0.15, 1, 0.15, 1] }} transition={loop(0.9)} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <circle cx="146" cy="150" r="11" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
                <text x="146" y="154.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#B45309" fontFamily="system-ui, sans-serif">Rp</text>
              </motion.g>
            </motion.g>
          </g>
        )}
        {sleeping && !reduce && (
          <motion.circle cx="121" cy="125" fill="#BAE6FD" stroke="#7DD3FC" strokeWidth="1" opacity={0.85} animate={{ r: [1.5, 8, 1.5] }} transition={loop(3.2)} />
        )}

        {/* Kaki depan — di atas wajah supaya bisa menutup mata */}
        {[
          { cx: 76, pos: pawL },
          { cx: 144, pos: pawR },
        ].map(({ cx, pos }) => (
          <motion.g
            key={cx}
            animate={pos}
            transition={
              reduce
                ? { duration: 0 }
                : eating && cx === 144
                  ? { ...spring, rotate: loop(0.9) }
                  : playing
                    ? { x: spring, y: loop(1.4) }
                    : coins && cx === 144
                      ? { x: spring, y: loop(1.8) }
                      : "rotate" in pos && Array.isArray(pos.rotate)
                        ? { ...spring, rotate: { duration: 1.4, ease: "easeInOut" } }
                        : spring
            }
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

// Digambar di atas wajah (di dalam grup "bernapas", jadi ikut bergerak).
// Satu aksesoris per hari raya Indonesia (lib/season.ts).
function SeasonAccessory({ season }: { season: Season }) {
  // Peci: Ramadan & Idul Fitri, Idul Adha, hari besar Islam.
  if (season === "lebaran" || season === "iduladha" || season === "islami") {
    return (
      <g>
        <path d="M74 50 Q74 20 110 18 Q146 20 146 50 Z" fill="#1F2937" />
        <path d="M76 42 Q110 36 144 42" stroke="#D4A017" strokeWidth="2.5" fill="none" />
        <path d="M110 18 Q120 20 126 26" stroke="#374151" strokeWidth="2" fill="none" />
      </g>
    );
  }
  if (season === "natal") {
    return (
      <g>
        <path d="M70 48 Q94 -6 150 2 Q164 14 154 48 Z" fill="#DC2626" />
        <path d="M150 2 Q166 6 166 22" stroke="#DC2626" strokeWidth="10" strokeLinecap="round" fill="none" />
        <rect x="64" y="38" width="96" height="18" rx="9" fill="#FFFFFF" />
        <circle cx="167" cy="26" r="10" fill="#FFFFFF" />
      </g>
    );
  }
  if (season === "imlek") {
    // Topi bundar merah dengan pita & kancing emas.
    return (
      <g>
        <path d="M72 52 Q72 16 110 14 Q148 16 148 52 Z" fill="#DC2626" />
        <path d="M74 46 Q110 40 146 46 L146 53 Q110 47 74 53 Z" fill="#F59E0B" />
        <path d="M92 18 Q110 30 128 18" stroke="#B91C1C" strokeWidth="2" fill="none" />
        <circle cx="110" cy="13" r="6.5" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
        <path d="M112 18 Q122 34 116 46" stroke="#DC2626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (season === "nyepi") {
    // Udeng Bali: ikat kepala putih dengan simpul tegak di depan.
    return (
      <g>
        <path d="M62 72 Q110 50 158 72 L158 82 Q110 60 62 82 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
        <path d="M98 64 L110 30 L122 64 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
        <path d="M66 76 Q110 56 154 76" stroke="#D4A017" strokeWidth="1.5" fill="none" />
      </g>
    );
  }
  if (season === "waisak") {
    // Bunga teratai di atas kepala.
    return (
      <g>
        {[-26, -13, 0, 13, 26].map((dx, k) => (
          <ellipse key={k} cx={110 + dx} cy={44 - (k === 2 ? 8 : k % 2 ? 4 : 0)} rx="8" ry="16" fill={k === 2 ? "#F9A8D4" : "#FBCFE8"} stroke="#EC4899" strokeWidth="1" transform={`rotate(${dx * 1.4} ${110 + dx} 52)`} />
        ))}
        <ellipse cx="110" cy="56" rx="30" ry="6" fill="#86EFAC" stroke="#22C55E" strokeWidth="1" />
      </g>
    );
  }
  if (season === "paskah") {
    // Bando telinga kelinci.
    return (
      <g>
        <ellipse cx="88" cy="18" rx="11" ry="32" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" transform="rotate(-14 88 18)" />
        <ellipse cx="88" cy="20" rx="5.5" ry="22" fill="#FBCFE8" transform="rotate(-14 88 20)" />
        <ellipse cx="132" cy="18" rx="11" ry="32" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" transform="rotate(14 132 18)" />
        <ellipse cx="132" cy="20" rx="5.5" ry="22" fill="#FBCFE8" transform="rotate(14 132 20)" />
        <path d="M70 56 Q110 34 150 56" stroke="#F472B6" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (season === "kenaikan") {
    // Lingkar cahaya.
    return (
      <g>
        <ellipse cx="110" cy="22" rx="32" ry="8" fill="none" stroke="#FDE68A" strokeWidth="6" opacity="0.9" />
        <ellipse cx="110" cy="22" rx="32" ry="8" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      </g>
    );
  }
  if (season === "tahunbaru") {
    // Topi pesta kerucut bergaris + pompom.
    return (
      <g>
        <path d="M88 58 L116 -4 L136 54 Z" fill="#8B5CF6" />
        <path d="M95 42 L128 30 M101 28 L124 19 M107 14 L120 9" stroke="#FDE047" strokeWidth="4" strokeLinecap="round" />
        <circle cx="116" cy="-6" r="7" fill="#F472B6" />
        <path d="M86 58 Q112 50 138 54" stroke="#6D28D9" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (season === "buruh") {
    // Helm proyek kuning.
    return (
      <g>
        <path d="M70 56 Q72 12 110 10 Q148 12 150 56 Z" fill="#FACC15" />
        <path d="M104 12 h12 v40 h-12 Z" fill="#EAB308" />
        <rect x="60" y="50" width="100" height="10" rx="5" fill="#EAB308" />
        <path d="M80 30 Q90 20 100 18" stroke="#FEF9C3" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  // merdeka & pancasila: ikat kepala merah-putih (+ bendera kecil saat Agustus)
  return (
    <g>
      <path d="M58 80 Q110 60 162 80 L162 88 Q110 68 58 88 Z" fill="#DC2626" />
      <path d="M58 88 Q110 68 162 88 L162 95 Q110 75 58 95 Z" fill="#FFFFFF" />
      <path d="M160 84 L178 76 L176 90 Z" fill="#DC2626" />
      <path d="M160 88 L176 98 L170 104 Z" fill="#FFFFFF" />
      {season === "merdeka" && (
        <>
          <line x1="62" y1="88" x2="46" y2="34" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
          <rect x="46" y="34" width="24" height="8" fill="#DC2626" />
          <rect x="46" y="42" width="24" height="8" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.5" />
        </>
      )}
    </g>
  );
}
