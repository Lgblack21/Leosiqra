'use client';

import { useEffect } from 'react';

// Tautan lama Ladangku › Usahaku › Kasir (?id=) → layar Usahaku tab Kasir.
export default function KasirPage() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    window.location.replace(`/membership/usahaku${id ? `?id=${encodeURIComponent(id)}#kasir` : ''}`);
  }, []);
  return null;
}
