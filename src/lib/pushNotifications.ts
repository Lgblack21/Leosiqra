import { cloudflareApi } from "@/lib/cloudflare-api";

// "BASE64URL_STRING" -> Uint8Array, format yang diminta PushManager.subscribe
// buat applicationServerKey (VAPID public key).
const urlBase64ToUint8Array = (base64Url: string) => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
};

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const isIos = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandaloneDisplay = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    // Properti lama khusus Safari iOS — belum ada tipe standar di lib.dom.
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

// iOS Safari cuma bisa terima Web Push kalau situsnya sudah di-"Add to Home
// Screen" (berjalan sebagai PWA standalone) — tab Safari biasa tidak bisa.
export const isIosNeedsInstall = () => isIos() && !isStandaloneDisplay();

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
};

export const subscribeToPush = async (): Promise<void> => {
  if (!isPushSupported()) {
    throw new Error("Browser ini tidak mendukung notifikasi push.");
  }
  if (isIosNeedsInstall()) {
    throw new Error("Tambahkan Leosiqra ke Home Screen dulu sebelum mengaktifkan notifikasi.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { publicKey } = await cloudflareApi<{ publicKey: string }>("/api/vapid-public-key");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  await cloudflareApi("/api/member/push-subscription", {
    method: "POST",
    json: {
      endpoint: json.endpoint,
      keys: json.keys,
    },
  });
};

export const unsubscribeFromPush = async (): Promise<void> => {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  try {
    await cloudflareApi("/api/member/push-subscription", {
      method: "DELETE",
      json: { endpoint: subscription.endpoint },
    });
  } finally {
    await subscription.unsubscribe();
  }
};
