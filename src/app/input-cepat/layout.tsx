import type { Metadata, Viewport } from "next";

// Metadata terpisah supaya saat "Add to Home Screen"/"Install app" (iPhone
// Safari maupun Android Chrome), ikonnya membuka halaman ini dalam mode
// standalone (tanpa address bar) dengan judul "Input Cepat". `manifest` dipakai
// Android/Chrome untuk mode standalone; `appleWebApp` dipakai iOS Safari.
export const metadata: Metadata = {
  title: "Input Cepat · Leosiqra",
  description: "Catat transaksi harian dengan cepat dari layar utama HP kamu.",
  // id & scope sendiri (lihat manifest) supaya bisa terpasang berdampingan
  // dengan aplikasi utama Leosiqra tanpa saling "merebut" link di Android,
  // dan ikonnya beda supaya tidak tertukar di layar utama.
  manifest: "/input-cepat-manifest.json",
  icons: {
    icon: "/images/input-cepat-192.png",
    apple: "/images/input-cepat-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "Input Cepat",
    statusBarStyle: "default",
  },
};

// Mode aplikasi: kunci zoom sejak render pertama (lihat juga NoZoomGuard).
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function InputCepatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
