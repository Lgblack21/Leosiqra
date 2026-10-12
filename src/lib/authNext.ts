import { isStandaloneDisplay } from '@/lib/pushNotifications';
import { isNativeApp } from '@/lib/pwaInstall';

// Tujuan setelah masuk/daftar. Cuma terima tree /app atau /input-cepat —
// mencegah open redirect kalau `next` diisi sembarangan (mis. URL eksternal).
export const sanitizeNext = (value: string | null): string | null =>
  value && /^\/(app|input-cepat)(\/|\?|$)/.test(value) ? value : null;

// Tanpa ?next=: PWA terpasang & aplikasi native (Capacitor) tetap ke UI
// mobile /app, bukan dashboard web.
export const resolveNext = (raw: string | null): string | null =>
  sanitizeNext(raw) ?? (isStandaloneDisplay() || isNativeApp() ? '/app' : null);

// Bawa `next` saat pindah antara halaman masuk ↔ daftar.
export const withNext = (path: string, next: string | null) =>
  next ? `${path}?next=${encodeURIComponent(next)}` : path;
