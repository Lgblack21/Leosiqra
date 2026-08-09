"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, Moon, Star, Sun, Smartphone } from "lucide-react";
import { auth } from "@/lib/cf-client";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { subscribeUserProfile, UserProfile } from "@/lib/services/userService";
import { FadeIn } from "@/components/app/FadeIn";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { lightTap } from "@/lib/haptics";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Sistem", icon: Smartphone },
];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme, setTheme } = useTheme();

  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return () => unsub();
  }, [user?.uid]);

  const displayName = user?.displayName || profile?.name || "Pengguna";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await cloudflareApi("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-8 space-y-6">
      <FadeIn className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-500 p-1">
          <div className="w-full h-full rounded-[20px] bg-white dark:bg-slate-900 flex items-center justify-center text-xl font-black text-indigo-600 overflow-hidden relative">
            {user?.photoURL ? (
              <Image src={user.photoURL} alt={displayName} fill className="object-cover" sizes="80px" />
            ) : (
              initials || "U"
            )}
          </div>
        </div>
        <h1 className="text-lg font-black text-slate-900 dark:text-white mt-3">{displayName}</h1>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{user?.email}</p>
        {profile?.plan && (
          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 rounded-full px-3 py-1.5 text-[11px] font-black mt-3">
            <Star size={12} fill="currentColor" /> {profile.plan === "PRO" ? "Premium" : "Free"}
          </div>
        )}
      </FadeIn>

      <FadeIn delay={0.05}>
        <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 mb-2">Preferensi</h2>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tema</span>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    lightTap();
                    setTheme(value);
                  }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-500/20 text-rose-500 font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          <LogOut size={16} />
          {loggingOut ? "Keluar..." : "Keluar"}
        </button>
      </FadeIn>
    </div>
  );
}
