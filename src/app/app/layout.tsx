import type { Viewport } from "next";
import AppShell from "@/components/app/AppShell";

// Mode aplikasi: kunci zoom sejak render pertama (lihat juga NoZoomGuard) —
// halaman tidak ter-zoom sendiri saat input difokus atau ter-pinch tak sengaja.
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
