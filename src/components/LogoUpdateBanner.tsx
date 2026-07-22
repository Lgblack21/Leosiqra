"use client";

import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { isStandaloneDisplay } from "@/lib/pushNotifications";

const DISMISS_KEY = "leosiqra_logo_update_banner_dismissed_v1";

// iOS & Android sama-sama "membekukan" ikon Home Screen pas pertama kali
// di-install — gak ada API buat web app maksa refresh ikon yang sudah
// terpasang. Satu-satunya jalan buat user yang sudah install duluan adalah
// kasih tau manual biar mereka hapus & pasang ulang. Cuma tampil buat user
// yang memang lagi buka versi standalone (yang sudah install), bukan yang
// masih browsing lewat tab biasa.
export default function LogoUpdateBanner() {
  // Lazy initializer (bukan effect) — `isStandaloneDisplay`/`localStorage`
  // aman dipanggil di sini karena sudah dijaga `typeof window` di dalamnya,
  // dan komponen ini "use client" jadi baris ini cuma jalan di browser.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isStandaloneDisplay()) return false;
    return localStorage.getItem(DISMISS_KEY) !== "1";
  });

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[9998] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-900/30 p-5 pr-10">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-black">Logo Leosiqra baru!</h3>
            <p className="text-[11px] font-medium text-indigo-100 leading-relaxed">
              Ikon di Home Screen kamu masih versi lama. Hapus ikonnya, lalu buka web ini lagi dan
              &quot;Add to Home Screen&quot; ulang untuk dapat logo terbaru.
            </p>
          </div>
        </div>
        <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>
    </div>
  );
}
