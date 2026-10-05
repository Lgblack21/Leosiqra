"use client";

import { BrandSplash } from "@/components/app/BrandSplash";

interface SplashScreenProps {
  ready: boolean;
  userName?: string | null;
  userPhoto?: string | null;
}

// Splash Input Cepat — memakai layar pembuka bermerek yang sama dengan mode
// aplikasi (logo Leosiqra, selalu terang) + label "Input Cepat" dan sapaan
// nama user. Muncul tiap Input Cepat dibuka dari awal (mount baru); setelah
// idle lama, StaleReloadGuard me-reload halaman sehingga splash ini muncul lagi.
export function SplashScreen({ ready, userName }: SplashScreenProps) {
  return <BrandSplash ready={ready} badge="Input Cepat" greetingName={userName} />;
}
