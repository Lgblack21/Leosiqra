'use client';

import { useEffect } from 'react';

// Tautan lama app HP Ladangku › Usahaku › kasir (?id=) → layar Usahaku.
export default function AppLegacyUsahaKasirPage() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    window.location.replace(`/app/usahaku${id ? `?id=${encodeURIComponent(id)}#kasir` : ''}`);
  }, []);
  return null;
}
