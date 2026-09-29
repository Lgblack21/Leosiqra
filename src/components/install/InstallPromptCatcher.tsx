"use client";

import { useEffect } from "react";
import { startInstallPromptCapture } from "@/lib/pwaInstall";

// Dipasang sekali di root layout supaya event install dari browser tidak
// terlewat sebelum halaman /install (atau Input Cepat) sempat dibuka.
export function InstallPromptCatcher() {
  useEffect(() => {
    startInstallPromptCapture();
  }, []);
  return null;
}
