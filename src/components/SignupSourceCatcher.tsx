"use client";

import { useEffect } from "react";
import { captureSignupSource } from "@/lib/signupSource";

// Dipasang sekali di root layout: catat sumber kunjungan pertama (UTM/referrer)
// sebelum pengunjung sempat pindah ke halaman daftar.
export function SignupSourceCatcher() {
  useEffect(() => {
    captureSignupSource();
  }, []);
  return null;
}
