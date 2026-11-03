"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapacitorApp } from "@capacitor/app";
import { auth } from "@/lib/cf-client";
import { onAuthStateChanged } from "@/lib/cf-auth";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AppTour } from "@/components/app/AppTour";
import { reportAppOpened } from "@/lib/appUsage";
import { BrandSplash } from "@/components/app/BrandSplash";
import { initNativePush } from "@/lib/nativePush";
import { toAppUrl } from "@/lib/appUrl";

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

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  // Sekali per pemasangan AppShell: daftar ulang token push walau user sama
  // (logout → /mulai → login lagi = sesi baru).
  const pushBoundRef = useRef(false);
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

  // Layar pembuka web (BrandSplash, terang + logo) sudah tampil begitu halaman
  // ini ter-render, jadi splash native (yang versi dark-mode-nya gelap) cukup
  // sampai di sini — tidak perlu menunggu cek sesi selesai.
  useEffect(() => {
    hideSplash();
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
        router.replace(`/mulai?next=${encodeURIComponent(pathname)}`);
        hideSplash();
        return;
      }
      reportAppOpened("leosiqra");
      // Android: izin & token push (sekali per buka app). Ketuk notifikasi →
      // /input-cepat butuh navigasi penuh (membaca ?teks= saat dimuat).
      const forcePush = !pushBoundRef.current;
      pushBoundRef.current = true;
      void initNativePush(user.uid, (url) => {
        const target = toAppUrl(url);
        if (target.startsWith("/input-cepat")) window.location.href = target;
        else router.push(target);
      }, forcePush);
      setUserName(user.displayName ?? null);
      setLoading(false);
      hideSplash();
    });
    return () => {
      unsub();
      clearTimeout(safetyTimer);
    };
  }, [router, pathname]);

  return (
    <>
      <BrandSplash ready={!loading} greetingName={userName} />
      {!loading && (
        <ThemeProvider>
          <ThemedShell>{children}</ThemedShell>
        </ThemeProvider>
      )}
    </>
  );
}

// Kelas .dark diterapkan di div pembungkus ini, bukan <html> root — supaya
// dark mode terisolasi penuh dari /membership/* yang berbagi root layout,
// tanpa perlu menyentuh file itu sama sekali.
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <div className={resolvedTheme === "dark" ? "dark" : ""}>
      {children}
      <AppTour />
    </div>
  );
}
