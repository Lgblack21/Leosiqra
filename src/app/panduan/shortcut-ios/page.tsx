"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Smartphone, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { LandingFooter } from "@/components/LandingFooter";

// Halaman panduan Shortcut iOS ini sudah dipensiunkan: Shortcuts butuh file
// bertanda-tangan (tidak bisa dibuat server) dan tetap ribet dirakit manual, jadi
// diganti dengan /input-cepat — form web yang jalan di iPhone maupun Android
// tanpa app Shortcuts atau Personal API Token sama sekali. Redirect otomatis di
// sini untuk bookmark/tautan lama; tombol manual sebagai cadangan.
export default function ShortcutIosRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/input-cepat"), 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/10 flex flex-col">
      <Navbar />
      <section className="flex-1 flex items-center justify-center px-6 pt-32 pb-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mx-auto mb-6">
            <Smartphone size={28} />
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight mb-3 text-slate-900">
            Sekarang lebih gampang
          </h1>
          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
            Cara Shortcut iOS sudah diganti dengan <strong>Input Cepat</strong> — halaman web yang jalan di{" "}
            <strong>iPhone maupun Android</strong>, tanpa app Shortcuts dan tanpa token. Mengalihkan otomatis…
          </p>
          <Link
            href="/input-cepat"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5 transition-all font-black text-sm shadow-lg shadow-indigo-200"
          >
            Buka Input Cepat <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}
