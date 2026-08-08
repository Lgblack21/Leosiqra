import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.leosiqra.app",
  appName: "Leosiqra",
  webDir: "out",
  server: {
    // App is an online-only finance tracker (live session/API required), so
    // the native shell loads the deployed site directly instead of bundling
    // a local build — web updates then ship without an app-store resubmit.
    // Points at /app specifically — the lean mobile-app UI (Phase 1:
    // onboarding + home + add transaction), not the full web dashboard
    // under /membership that the browser/PWA still uses.
    url: "https://www.leosiqra.com/app",
    cleartext: false,
    // Without this, Capacitor's WebView blocks/ejects navigation to any
    // host other than the server.url origin — breaking the in-app
    // "Login with Google" OAuth redirect flow.
    allowNavigation: ["accounts.google.com", "*.googleusercontent.com"],
  },
  plugins: {
    // launchAutoHide: false — splash TETAP nempel (bukan ilang otomatis
    // setelah durasi tetap) sampai src/app/app/layout.tsx manggil
    // SplashScreen.hide() persis pas sesi user siap & /app mau ditampilkan.
    // Ini penting karena app-nya muat /app dari server jarak jauh, bukan
    // bundle lokal — durasi loadingnya gak tetap/gak bisa ditebak.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
