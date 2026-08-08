"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { auth } from "@/lib/cf-client";
import { onAuthStateChanged } from "@/lib/cf-auth";

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

  return <>{children}</>;
}
