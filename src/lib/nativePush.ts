import { Capacitor } from "@capacitor/core";
import { cloudflareApi } from "@/lib/cloudflare-api";

// Push aplikasi native (Android, via Firebase Cloud Messaging). Dipanggil
// AppShell setelah login: minta izin sekali (kalau ditolak tidak ditanya lagi —
// bisa dinyalakan dari pengaturan HP), daftar ke FCM, kirim token ke Worker
// (diikat ke sesi login ini). Ketuk notifikasi → buka url dari server.
// iOS belum: butuh Firebase Messaging di app iOS (APNs wajib HTTP/2, Worker
// tidak bisa kirim langsung) — dilewati di sini sampai itu dibuat.
let started = false;

export async function initNativePush(openUrl: (url: string) => void) {
  if (started || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  if (!Capacitor.isPluginAvailable("PushNotifications")) return; // APK lama (belum build ulang)
  started = true;
  try {
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
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = (notification.data as { url?: unknown } | undefined)?.url;
      if (typeof url === "string" && url.startsWith("/")) openUrl(url);
    });

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;
    await PushNotifications.register();
  } catch (error) {
    console.warn("Push native tidak aktif:", error);
  }
}

// Status untuk teks di layar Pengingat: "unavailable" = iOS / APK lama tanpa plugin.
export async function nativePushStatus(): Promise<"granted" | "denied" | "prompt" | "unavailable"> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("PushNotifications")) {
    return "unavailable";
  }
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch {
    return "unavailable";
  }
}
