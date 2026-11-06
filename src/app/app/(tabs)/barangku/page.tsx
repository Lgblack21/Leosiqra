"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FadeIn } from "@/components/app/FadeIn";
import { BarangkuView } from "@/components/barangku/BarangkuView";

export default function AppBarangkuPage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Barangku</h1>
      </FadeIn>
      <BarangkuView variant="app" />
    </div>
  );
}
