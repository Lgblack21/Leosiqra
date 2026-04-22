"use client";

import { useState, useEffect } from 'react';

interface LogoImageProps {
  src: string | undefined | null;
  alt: string;
  fallbackText: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const LogoImage = ({ src, alt, fallbackText, className, fallbackIcon }: LogoImageProps) => {
  const [error, setError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    // Smart Resolver for Google Image Search Links
    // Example: https://www.google.com/imgres?q=logo%20bca&imgurl=https%3A%2F%2Fwww.bca.co.id%2F-...
    if (src.includes('google.com/imgres') || src.includes('imgurl=')) {
      try {
        const urlObj = new URL(src);
        const imgUrl = urlObj.searchParams.get('imgurl');
        if (imgUrl) {
          setResolvedSrc(decodeURIComponent(imgUrl));
          setError(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse Google Image URL:", e);
      }
    }

    setResolvedSrc(src);
    setError(false);
  }, [src]);

  if (!resolvedSrc || error) {
    return (
      <div className={`${className} bg-slate-50 text-slate-400 flex items-center justify-center text-[8px] font-black overflow-hidden`}>
        {fallbackIcon || fallbackText}
      </div>
    );
  }

  return (
    <img 
      src={resolvedSrc} 
      alt={alt} 
      className={className}
      onError={() => {
        console.warn(`Failed to load image: ${resolvedSrc}`);
        setError(true);
      }}
      referrerPolicy="no-referrer"
    />
  );
};
