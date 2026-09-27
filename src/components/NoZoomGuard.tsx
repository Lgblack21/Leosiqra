"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { isStandaloneDisplay } from "@/lib/pushNotifications";

// Mode aplikasi (PWA ter-install, app native Capacitor, atau tampilan mobile
// /app & /input-cepat) dikunci supaya tidak bisa di-zoom — tidak ter-zoom
// sendiri saat input difokus (iOS memperbesar input < 16px) dan tidak
// ter-pinch/double-tap tak sengaja. Versi web biasa di browser tetap bisa
// di-zoom (aksesibilitas).
const APP_ROUTES = /^\/(app|input-cepat)(\/|$)/;
const LOCKED_VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

export function NoZoomGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const locked = Capacitor.isNativePlatform() || isStandaloneDisplay() || APP_ROUTES.test(pathname ?? "");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const html = document.documentElement;
    if (!locked || !meta) return;

    const original = meta.getAttribute("content") ?? "";
    meta.setAttribute("content", LOCKED_VIEWPORT);
    html.classList.add("no-zoom");

    // Safari iOS mengabaikan user-scalable=no di tab biasa — cegah pinch lewat event.
    const blockGesture = (e: Event) => e.preventDefault();
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });

    return () => {
      meta.setAttribute("content", original);
      html.classList.remove("no-zoom");
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, [pathname]);

  return null;
}
