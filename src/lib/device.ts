import { Capacitor } from "@capacitor/core";

// Aplikasi native (Capacitor) di tablet: sisi layar terpendek ≥ 600dp (batas
// "tablet" Android). screen.width/height dalam CSS px = dp, tidak berubah saat
// layar diputar. Dipakai untuk membuka tampilan web /membership di tablet.
export function isNativeTablet(): boolean {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return false;
  return Math.min(window.screen.width, window.screen.height) >= 600;
}
