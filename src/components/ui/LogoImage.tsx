"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { LOGO_DOMAINS } from '@/lib/indonesianBanks';

interface LogoImageProps {
  src: string | undefined | null;
  alt: string;
  fallbackText: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const LogoImage = ({ src, alt, fallbackText, className, fallbackIcon }: LogoImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Cadangan untuk src tertentu (mis. /logos/x.png gagal → /api/logo?d=x).
  const [fallback, setFallback] = useState<{ of: string; src: string } | null>(null);
  const resolvedSrc = useMemo(() => {
    if (!src) return null;

    // Smart Resolver for Google Image Search Links
    // Example: https://www.google.com/imgres?q=logo%20bca&imgurl=https%3A%2F%2Fwww.bca.co.id%2F-...
    if (src.includes('google.com/imgres') || src.includes('imgurl=')) {
      try {
        const urlObj = new URL(src);
        const imgUrl = urlObj.searchParams.get('imgurl');
        if (imgUrl) {
          return decodeURIComponent(imgUrl);
        }
      } catch (e) {
        console.error("Failed to parse Google Image URL:", e);
      }
    }

    // Favicon Google (s2) mengirim ikon GLOBE pengganti kalau situsnya tidak
    // punya favicon — gambarnya valid jadi onError tidak pernah jalan dan globe
    // tampil sebagai "logo". Pakai endpoint faviconV2 TANPA fallback_opts: kalau
    // tidak ada ikon, responsnya error → fallback kita yang tampil. Berlaku juga
    // untuk logo_url lama yang tersimpan dengan alamat s2.
    if (src.includes('google.com/s2/favicons')) {
      try {
        const u = new URL(src);
        const domain = u.searchParams.get('domain');
        const size = u.searchParams.get('sz') || '128';
        // Bank/e-wallet di daftar kita → ikon aplikasi HD yang diunduh saat
        // deploy (public/logos, scripts/fetch-logos.mjs); kalau tidak ada,
        // cadangannya logo lewat Worker /api/logo (lihat onError).
        if (domain && LOGO_DOMAINS.has(domain.toLowerCase())) return `/logos/${domain.toLowerCase()}.png`;
        if (domain) return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent(`https://${domain}`)}&size=${size}`;
      } catch {
        // URL tidak valid — pakai apa adanya.
      }
    }

    return src;
  }, [src]);
  const hasError = !!resolvedSrc && failedSrc === resolvedSrc;
  const shownSrc = resolvedSrc && fallback?.of === resolvedSrc ? fallback.src : resolvedSrc;
  const fallbackSrc = fallback?.of === resolvedSrc ? fallback.src : null;

  if (!resolvedSrc || hasError) {
    return (
      <div className={`${className} bg-slate-50 text-slate-400 flex items-center justify-center text-[8px] font-black overflow-hidden`}>
        {fallbackIcon || fallbackText}
      </div>
    );
  }

  return (
    <Image 
      src={shownSrc ?? ''} 
      alt={alt} 
      width={96}
      height={96}
      unoptimized
      className={className}
      onLoad={(e) => {
        // Ikon 16px dari layanan favicon = ikon bawaan/terlalu kecil → anggap gagal.
        if (resolvedSrc.includes('gstatic.com/faviconV2') && e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 16) setFailedSrc(resolvedSrc);
      }}
      onError={() => {
        // /logos/<domain>.png belum ada → coba Worker /api/logo dulu sebelum huruf.
        const local = /^\/logos\/([a-z0-9.-]+)\.png$/.exec(resolvedSrc);
        if (local && fallbackSrc !== `/api/logo?d=${local[1]}`) { setFallback({ of: resolvedSrc, src: `/api/logo?d=${local[1]}` }); return; }
        console.warn(`Failed to load image: ${shownSrc}`);
        setFailedSrc(resolvedSrc);
      }}
      referrerPolicy="no-referrer"
    />
  );
};
