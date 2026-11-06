"use client";

import { useEffect, useLayoutEffect, useState } from 'react';

// Halaman layar penuh (Fokus, Cerita): tinggi area isi = dari atas elemen sampai atas menu
// melayang [data-focus-dock] − 12px; gulir halaman dikunci selama muat. Lebih pendek dari
// MIN_FIT (HP landscape) → tidak dikunci. Diukur ulang saat ukuran/animasi berubah.
// Lebih pendek dari ini (HP landscape dsb.) → tidak dikunci; halaman boleh digulir.
const MIN_FIT = 340;

export function useFitHeight(ref: React.RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Menu melayang di bawah (offsetParent selalu null untuk position:fixed → cek ukuran & display).
      const dock = document.querySelector<HTMLElement>('[data-focus-dock]');
      const r = dock?.getBoundingClientRect();
      const dockTop = dock && r && r.height > 0 && getComputedStyle(dock).display !== 'none' ? r.top : window.innerHeight;
      const h = Math.floor(dockTop - top - 12);
      setHeight(h >= MIN_FIT ? h : null);
    };
    window.scrollTo(0, 0);
    calc();
    // Animasi masuk halaman (transform di induk) sempat menggeser menu melayang saat ukuran
    // pertama diambil → ukur ulang setelah animasi selesai & beberapa kali di detik pertama.
    const timers = [80, 300, 700, 1200].map((ms) => window.setTimeout(calc, ms));
    const ro = new ResizeObserver(calc);
    ro.observe(document.body);
    window.addEventListener('resize', calc);
    window.visualViewport?.addEventListener('resize', calc);
    document.addEventListener('animationend', calc, true);
    document.addEventListener('transitionend', calc, true);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
      window.removeEventListener('resize', calc);
      window.visualViewport?.removeEventListener('resize', calc);
      document.removeEventListener('animationend', calc, true);
      document.removeEventListener('transitionend', calc, true);
    };
  }, [ref]);
  // Kunci gulir halaman selama tampilan muat satu layar.
  useEffect(() => {
    if (height === null) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { html.style.overflow = prev[0]; document.body.style.overflow = prev[1]; };
  }, [height]);
  return height;
}
