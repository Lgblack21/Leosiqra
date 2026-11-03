import { Capacitor } from "@capacitor/core";
import { cloudflareApi } from "@/lib/cloudflare-api";

// Push aplikasi native (Android, via Firebase Cloud Messaging). Dipanggil
// AppShell setiap sesi login terdeteksi: minta izin sekali (kalau ditolak tidak
// ditanya lagi — bisa dinyalakan dari pengaturan HP), daftar ke FCM, kirim
// token ke Worker (diikat ke sesi login ini). Ganti akun tanpa menutup app →
// register() lagi supaya token pindah ke sesi baru. Ketuk notifikasi → openUrl.
// iOS belum: butuh Firebase Messaging di app iOS (APNs wajib HTTP/2, Worker
// tidak bisa kirim langsung) — dilewati di sini sampai itu dibuat.
// Push yang masuk saat aplikasi sedang dibuka (Android tidak menampilkannya
// sendiri) → event ini → PushBanner + daftar notifikasi dimuat ulang.
export const PUSH_EVENT = "leosiqra:push";
export type ForegroundPush = { title: string; body: string; url: string | null };

let listeners: Promise<void> | null = null;
let registeredFor: string | null = null;
let openUrlHandler: (url: string) => void = () => undefined;

const pushAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("PushNotifications");

const addListenersOnce = () => {
  listeners ??= (async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", ({ value }) => {
      void cloudflareApi("/api/member/native-push-token", {
        method: "POST",
        json: { token: value, platform: Capacitor.getPlatform() },
      }).catch((error) => console.warn("Gagal mendaftarkan token push:", error));
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("Pendaftaran push native gagal:", error);
    });
    await PushNotifications.addListener("pushNotificationReceived", (n) => {
      const url = (n.data as { url?: unknown } | undefined)?.url;
      const detail: ForegroundPush = {
        title: n.title || "Leosiqra",
        body: n.body || "",
        url: typeof url === "string" && url.startsWith("/") ? url : null,
      };
      window.dispatchEvent(new CustomEvent<ForegroundPush>(PUSH_EVENT, { detail }));
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = (notification.data as { url?: unknown } | undefined)?.url;
      if (typeof url === "string" && url.startsWith("/")) openUrlHandler(url);
    });
  })();
  return listeners;
};

// force: AppShell baru dipasang (masuk /app lagi setelah logout/login) → sesi
// bisa baru walau user sama, jadi token harus diikat ulang ke sesi ini.
export async function initNativePush(userId: string, openUrl: (url: string) => void, force = false) {
  openUrlHandler = openUrl;
  if (!userId || (!force && registeredFor === userId) || !pushAvailable()) return; // APK lama: plugin belum ada
  registeredFor = userId;
  try {
    await addListenersOnce();
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;
    await PushNotifications.register();
  } catch (error) {
    registeredFor = null; // coba lagi di pembukaan berikutnya
    console.warn("Push native tidak aktif:", error);
  }
}

// Status untuk teks di layar Pengingat: "unavailable" = iOS / APK lama tanpa plugin.
export async function nativePushStatus(): Promise<"granted" | "denied" | "prompt" | "unavailable"> {
  if (!pushAvailable()) return "unavailable";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch {
    return "unavailable";
  }
}
