"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

// Hitung naik dari nilai sebelumnya ke nilai baru — motion value di-update
// langsung ke DOM lewat ref (bukan lewat re-render React tiap frame), jadi
// ringan walau nominal berubah tiap kali data ke-refetch.
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const prevValue = useRef(0);

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(0);
  }, []);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    prevValue.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span ref={ref} className={className} />;
}
