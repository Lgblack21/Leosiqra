"use client";

import { KasirView } from "@/components/ladang/KasirView";

// Kasir versi app HP — komponen sama dengan web (KasirView).
export default function AppKasirPage() {
  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8">
      <KasirView variant="app" />
    </div>
  );
}
