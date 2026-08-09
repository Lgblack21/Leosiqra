"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapacitorApp } from "@capacitor/app";
import { auth } from "@/lib/cf-client";
import { onAuthStateChanged } from "@/lib/cf-auth";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

// Native splash (drawable/splash.png) cuma nyala sekilas selama Android/iOS
// nyiapin Activity — begitu WebView aktif dia langsung ilang, dan APK ini
// muat /app dari server jarak jauh (server.url), jadi ada jeda kosong putih
// sebelum kontennya beneran nongol. launchAutoHide di-set false di
// capacitor.config.ts supaya splash TETAP nempel sampai baris ini yang
// nyuruh dia ilang — persis pas /app siap ditampilkan, bukan tebak-tebakan
// durasi tetap.
const hideSplash = () => {
  if (Capacitor.isNativePlatform()) {
    SplashScreen.hide();
  }
};

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Tanpa ini, tombol back hardware Android langsung nutup app (keluar ke
  // launcher) dari halaman manapun di /app/* — dikonfirmasi langsung lewat
  // emulator. Daftar listener sekali di root, baca pathname via ref supaya
  // gak perlu re-attach tiap ganti rute.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener("backButton", () => {
      if (pathnameRef.current === "/app") {
        CapacitorApp.minimizeApp();
      } else {
        router.back();
      }
    });
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pakai onAuthStateChanged (bukan panggil /api/auth/me langsung) supaya
  // auth.currentUser terisi — CategorySelect/CurrencySelect yang dipakai di
  // Add Transaction sheet & onboarding butuh itu untuk query data user
  // (lihat pola yang sama di src/app/input-cepat/page.tsx).
  useEffect(() => {
    // Jaring pengaman — kalau karena sebab apa pun cek sesi gak pernah
    // selesai (network macet, dll), splash jangan nyangkut permanen; blank
    // putih masih lebih baik daripada splash yang gak bisa hilang.
    const safetyTimer = setTimeout(hideSplash, 8000);

    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(safetyTimer);
      if (!user) {
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        hideSplash();
        return;
      }
      setLoading(false);
      hideSplash();
    });
    return () => {
      unsub();
      clearTimeout(safetyTimer);
    };
  }, [router, pathname]);

  // Sama seperti membership/layout.tsx — tanpa spinner biar transisi dari
  // tombol login/splash terasa instan.
  if (loading) return null;

  return (
    <ThemeProvider>
      <ThemedShell>{children}</ThemedShell>
    </ThemeProvider>
  );
}

// Kelas .dark diterapkan di div pembungkus ini, bukan <html> root — supaya
// dark mode terisolasi penuh dari /membership/* yang berbagi root layout,
// tanpa perlu menyentuh file itu sama sekali.
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return <div className={resolvedTheme === "dark" ? "dark" : ""}>{children}</div>;
}
