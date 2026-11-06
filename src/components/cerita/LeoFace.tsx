import type { StoryMood } from '@/lib/stories';

// Wajah Leo statis & ringan (tanpa animasi/listener) untuk kotak kalender & daftar —
// ekspresi ikut mood cuaca: Badai sedih, Mendung mengantuk, Berawan biasa, Cerah senang, Pelangi sangat senang.
export function LeoFace({ mood, className }: { mood: StoryMood | null; className?: string }) {
  const ink = '#3B1D0A';
  const nose = '#6B2A12';
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="52" r="40" fill="#E8590C" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.cos(a) * 33} cy={52 + Math.sin(a) * 33} r="13" fill={i % 2 ? '#F59E0B' : '#FBBF24'} />;
      })}
      <circle cx="28" cy="27" r="8" fill="#F8D29A" /><circle cx="28" cy="28" r="4" fill="#F9A8A4" />
      <circle cx="72" cy="27" r="8" fill="#F8D29A" /><circle cx="72" cy="28" r="4" fill="#F9A8A4" />
      <circle cx="50" cy="55" r="27" fill="#FCE3B8" />
      <ellipse cx="33" cy="64" rx="5" ry="3" fill="#FB7185" opacity={mood && mood >= 4 ? 0.6 : 0.3} />
      <ellipse cx="67" cy="64" rx="5" ry="3" fill="#FB7185" opacity={mood && mood >= 4 ? 0.6 : 0.3} />
      {/* Mata */}
      {mood && mood >= 4 ? (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none"><path d="M34 52 Q39 46 44 52" /><path d="M56 52 Q61 46 66 52" /></g>
      ) : mood === 2 ? (
        <g stroke={ink} strokeWidth="2.6" strokeLinecap="round" fill="none"><path d="M34 51 Q39 55 44 51" /><path d="M56 51 Q61 55 66 51" /></g>
      ) : (
        <g fill={ink}><ellipse cx="39" cy="51" rx="3.6" ry={mood === 1 ? 3.4 : 4.5} /><ellipse cx="61" cy="51" rx="3.6" ry={mood === 1 ? 3.4 : 4.5} /><circle cx="38" cy="49" r="1.3" fill="#fff" /><circle cx="60" cy="49" r="1.3" fill="#fff" /></g>
      )}
      {mood === 1 && <g stroke={ink} strokeWidth="2" strokeLinecap="round"><path d="M33 43 L43 40" /><path d="M67 43 L57 40" /></g>}
      {/* Moncong & mulut */}
      <ellipse cx="45" cy="66" rx="7" ry="5.5" fill="#FFF6E6" /><ellipse cx="55" cy="66" rx="7" ry="5.5" fill="#FFF6E6" />
      <path d="M45 59 Q50 56 55 59 Q53 63 50 63.5 Q47 63 45 59 Z" fill={nose} />
      {mood === 5 || mood === 4 ? (
        <g><path d="M43 69 Q50 79 57 69 Z" fill={nose} /><ellipse cx="50" cy="74" rx="3.5" ry="2" fill="#FB7185" /></g>
      ) : mood === 1 ? (
        <path d="M44 73 Q50 68 56 73" stroke={nose} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      ) : mood === 2 ? (
        <ellipse cx="50" cy="71" rx="2.6" ry="3" fill={nose} />
      ) : (
        <path d="M50 63.5 V67 M44 69 Q47 72 50 68.5 Q53 72 56 69" stroke={nose} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {mood === 5 && <g fill="#FDE047"><path d="M86 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" /><path d="M12 76 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" /></g>}
      {mood === 2 && <text x="76" y="24" fontSize="14" fontWeight="800" fill="#6366F1" fontFamily="system-ui, sans-serif">z</text>}
    </svg>
  );
}
