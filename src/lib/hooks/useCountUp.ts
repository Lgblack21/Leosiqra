import { useEffect, useRef, useState } from 'react';

/**
 * Menghitung nilai dari angka sebelumnya menuju target dengan easing halus,
 * dan langsung melompat ke nilai akhir jika user memilih prefers-reduced-motion.
 */
export const useCountUp = (target: number, duration = 900) => {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      // Nilai awal state sudah sama dengan target (useState(target)), jadi
      // render pertama tidak perlu animasi — cukup catat baseline-nya.
      firstRun.current = false;
      fromRef.current = target;
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      fromRef.current = target;
      const raf = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(raf);
    }

    const from = fromRef.current;
    const to = target;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
};
