import type { Metadata } from "next";

// Metadata terpisah supaya saat "Add to Home Screen" di iPhone, ikonnya membuka
// halaman ini dalam mode standalone (tanpa address bar) dengan judul "Input Cepat".
export const metadata: Metadata = {
  title: "Input Cepat · Leosiqra",
  description: "Catat transaksi harian dengan cepat dari layar utama iPhone.",
  appleWebApp: {
    capable: true,
    title: "Input Cepat",
    statusBarStyle: "default",
  },
};

export default function InputCepatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
