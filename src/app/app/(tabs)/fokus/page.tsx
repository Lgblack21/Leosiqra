"use client";

import { FocusApp } from "@/components/fokus/FocusApp";

// Fokus bareng Leo versi app HP — komponen sama dengan web (FocusApp), satu layar penuh.
export default function AppFokusPage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-6">
      <FocusApp variant="app" backHref="/app/more" />
    </div>
  );
}
