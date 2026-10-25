import type { Metadata } from "next";

// Layar izin OAuth Leosiqra MCP (tahap 3) — dibuka dari claude.ai/ChatGPT saat
// member memasang connector. Tidak untuk diindeks mesin pencari.
export const metadata: Metadata = {
  title: "Izinkan Aplikasi AI · Leosiqra",
  description: "Izinkan aplikasi AI membaca atau mencatat keuangan di akun Leosiqra kamu.",
  robots: { index: false, follow: false },
};

export default function IzinkanAiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
