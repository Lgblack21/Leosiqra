'use client';

import { useEffect } from 'react';

// Tautan lama Ladangku › Usahaku › Laporan (?id=) → layar Usahaku tab Laporan.
export default function LaporanUsahaPage() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    window.location.replace(`/membership/usahaku${id ? `?id=${encodeURIComponent(id)}#laporan` : ''}`);
  }, []);
  return null;
}
