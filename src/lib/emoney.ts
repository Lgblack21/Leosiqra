import { Capacitor, registerPlugin } from "@capacitor/core";

// Jembatan ke plugin native "Emoney" (ios/App/App/EmoneyPlugin.swift,
// android/.../EmoneyPlugin.java). Hanya ada di aplikasi HP versi baru —
// browser/PWA tidak bisa membaca kartu (Web NFC tidak mendukung APDU).

export type EmoneyCard = "mandiri" | "tapcash";
export type EmoneyResult = { card: EmoneyCard; cardName: string; cardNumber: string; balance: number };

interface EmoneyPlugin {
  isAvailable(): Promise<{ available: boolean; enabled?: boolean }>;
  scan(): Promise<EmoneyResult>;
  cancel?(): Promise<void>;
}

const Emoney = registerPlugin<EmoneyPlugin>("Emoney");

// "web" = browser/PWA; "old-app" = aplikasi HP versi lama (belum ada plugin).
export type EmoneySupport = "ready" | "nfc-off" | "no-nfc" | "old-app" | "web";

export async function emoneySupport(): Promise<EmoneySupport> {
  if (!Capacitor.isNativePlatform()) return "web";
  if (!Capacitor.isPluginAvailable("Emoney")) return "old-app";
  try {
    const r = await Emoney.isAvailable();
    if (!r.available) return "no-nfc";
    return r.enabled === false ? "nfc-off" : "ready";
  } catch {
    return "old-app";
  }
}

export async function scanEmoney(): Promise<EmoneyResult> {
  const r = await Emoney.scan();
  const balance = Math.round(Number(r.balance));
  if (!Number.isFinite(balance) || balance < 0 || balance > 20_000_000) throw new Error("Saldo kartu tidak terbaca dengan benar. Coba tempelkan lagi.");
  return { ...r, balance };
}

export function cancelEmoneyScan() {
  void Emoney.cancel?.().catch(() => undefined);
}

// 6032 1234 5678 9012 → •••• 9012 (nomor kartu tidak pernah disimpan utuh).
export const maskCardNumber = (n: string) => (n && n.replace(/0/g, "").length ? `•••• ${n.slice(-4)}` : "");

export const EMONEY_CARDS: { id: EmoneyCard; name: string; color: string }[] = [
  { id: "mandiri", name: "Mandiri e-money", color: "from-sky-700 to-blue-900" },
  { id: "tapcash", name: "BNI TapCash", color: "from-orange-500 to-amber-600" },
];
