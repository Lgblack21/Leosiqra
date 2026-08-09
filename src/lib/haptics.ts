import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// No-op di browser/PWA — cuma kerasa di device native. Dibungkus di sini
// supaya tiap pemanggil gak perlu cek Capacitor.isNativePlatform() sendiri.
export const lightTap = () => {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light });
  }
};
