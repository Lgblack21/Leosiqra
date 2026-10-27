"use client";

import { useEffect } from "react";
import { captureSignupSource, captureReferralCode } from "@/lib/signupSource";

// Dipasang sekali di root layout: catat sumber kunjungan pertama (UTM/referrer)
// dan kode referral (?ref=) sebelum pengunjung sempat pindah ke halaman daftar.
export function SignupSourceCatcher() {
  useEffect(() => {
    captureSignupSource();
    captureReferralCode();
  }, []);
  return null;
}
