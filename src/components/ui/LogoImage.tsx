"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';

interface LogoImageProps {
  src: string | undefined | null;
  alt: string;
  fallbackText: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const LogoImage = ({ src, alt, fallbackText, className, fallbackIcon }: LogoImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
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

    return src;
  }, [src]);
  const hasError = !!resolvedSrc && failedSrc === resolvedSrc;

  if (!resolvedSrc || hasError) {
    return (
      <div className={`${className} bg-slate-50 text-slate-400 flex items-center justify-center text-[8px] font-black overflow-hidden`}>
        {fallbackIcon || fallbackText}
      </div>
    );
  }

  return (
    <Image 
      src={resolvedSrc} 
      alt={alt} 
      width={96}
      height={96}
      unoptimized
      className={className}
      onError={() => {
        console.warn(`Failed to load image: ${resolvedSrc}`);
        setFailedSrc(resolvedSrc);
      }}
      referrerPolicy="no-referrer"
    />
  );
};
