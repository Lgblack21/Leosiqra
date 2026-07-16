import type { Metadata } from "next";

// Metadata terpisah supaya saat "Add to Home Screen"/"Install app" (iPhone
// Safari maupun Android Chrome), ikonnya membuka halaman ini dalam mode
// standalone (tanpa address bar) dengan judul "Input Cepat". `manifest` dipakai
// Android/Chrome untuk mode standalone; `appleWebApp` dipakai iOS Safari.
export const metadata: Metadata = {
  title: "Input Cepat · Leosiqra",
  description: "Catat transaksi harian dengan cepat dari layar utama HP kamu.",
  manifest: "/input-cepat-manifest.json",
  appleWebApp: {
    capable: true,
    title: "Input Cepat",
    statusBarStyle: "default",
  },
};

export default function InputCepatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
