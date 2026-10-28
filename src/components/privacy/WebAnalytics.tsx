"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { analyticsEnabled } from '@/lib/analyticsPref';

// Cloudflare Web Analytics: hitung kunjungan & asal pengunjung tanpa cookie.
// Token ini publik (terlihat di kode situs). Tidak dimuat kalau user
// mematikan "Statistik pemakaian" di perangkat ini.
export function WebAnalytics() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(analyticsEnabled()), []);
  if (!on) return null;
  return <Script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "f151ddbac01c422d8285df6e6f2e3410"}' strategy="afterInteractive" />;
}
