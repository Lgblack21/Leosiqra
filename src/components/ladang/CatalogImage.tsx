'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Gambar dari tautan https pengguna: referrer dimatikan; gagal dimuat → isi cadangan (inisial/emoji).
export function CatalogImage({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- gambar dari situs pengguna, static export tanpa optimizer
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={cn('object-contain', className)}
    />
  );
}
