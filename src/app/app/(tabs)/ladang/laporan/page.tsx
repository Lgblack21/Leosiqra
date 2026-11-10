'use client';

import { useEffect } from 'react';

// Tautan lama app HP Ladangku › Usahaku › laporan (?id=) → layar Usahaku.
export default function AppLegacyUsahaLaporanPage() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    window.location.replace(`/app/usahaku${id ? `?id=${encodeURIComponent(id)}#laporan` : ''}`);
  }, []);
  return null;
}
