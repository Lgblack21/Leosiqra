import { toAppUrl } from "@/lib/appUrl";

// Aplikasi HP: notifikasi pengingat bernominal (URL Worker `/input-cepat?teks=<judul> <nominal>`)
// dibuka sebagai sheet Tambah Transaksi di /app — bukan halaman web Input Cepat.
// Permintaan disimpan di modul ini sampai layout tab (pemilik sheet) siap, karena
// ketukan notifikasi saat app baru dibuka bisa datang sebelum layout terpasang.
export type TxPrefill = { amount: number; note: string; key: number };

const EVENT = "leosiqra:tx-prefill";
let pending: TxPrefill | null = null;
let hostMounted = false;

export function parseQuickInputUrl(url: string): { amount: number; note: string } | null {
  if (!url.startsWith("/input-cepat")) return null;
  const teks = new URLSearchParams(url.split("?")[1] ?? "").get("teks")?.trim() ?? "";
  const m = /^(.*\S)\s+(\d{1,15})$/.exec(teks);
  const amount = m ? Number(m[2]) : 0;
  if (!m || !Number.isSafeInteger(amount) || amount <= 0) return null;
  return { amount, note: m[1].slice(0, 200) };
}

export function takeTxPrefill(): TxPrefill | null {
  const p = pending;
  pending = null;
  return p;
}

// Dipanggil layout tab /app (yang memegang AddTransactionSheet).
export function bindTxPrefillHost(onPrefill: () => void) {
  hostMounted = true;
  window.addEventListener(EVENT, onPrefill);
  return () => {
    hostMounted = false;
    window.removeEventListener(EVENT, onPrefill);
  };
}

// Buka URL notifikasi di aplikasi HP (ketuk push native & daftar notifikasi /app).
export function openAppNotificationUrl(url: string, push: (href: string) => void) {
  const target = toAppUrl(url);
  const prefill = parseQuickInputUrl(target);
  if (prefill) {
    pending = { ...prefill, key: Date.now() };
    if (hostMounted) window.dispatchEvent(new Event(EVENT));
    else push("/app"); // mis. sedang di Asisten — layout tab mengambil `pending` saat terpasang
    return;
  }
  // Input Cepat tanpa nominal terbaca membaca ?teks= saat dimuat → navigasi penuh.
  if (target.startsWith("/input-cepat")) window.location.href = target;
  else push(target);
}
