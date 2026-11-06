"use client";

import { StaffApp } from '@/components/tim/StaffApp';

// Akun tim Usahaku (kasir) — login username "toko-nama", sesi terpisah dari pemilik.
export default function TimPage() {
  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <StaffApp />
    </div>
  );
}
