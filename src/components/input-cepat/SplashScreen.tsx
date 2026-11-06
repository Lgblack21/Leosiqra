"use client";

import { BrandSplash } from "@/components/app/BrandSplash";

interface SplashScreenProps {
  ready: boolean;
  userName?: string | null;
  userPhoto?: string | null;
}

// Muncul tiap mount baru; setelah idle lama StaleReloadGuard me-reload halaman sehingga splash muncul lagi.
export function SplashScreen({ ready, userName }: SplashScreenProps) {
  return <BrandSplash ready={ready} badge="Input Cepat" greetingName={userName} />;
}
