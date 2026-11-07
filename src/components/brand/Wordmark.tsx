import { cn } from '@/lib/utils';

// Nama "Leosiqra" beranimasi (CSS saja, globals.css › .wm-*): huruf naik satu per satu saat
// muncul, kilau gradien lewat berkala, huruf bergelombang saat disorot. Mati kalau
// prefers-reduced-motion. Teks utuh tetap terbaca screen reader (aria-label).
export function Wordmark({ text = 'Leosiqra', className }: { text?: string; className?: string }) {
  return (
    <span className={cn('wm relative inline-block whitespace-nowrap', className)} aria-label={text} role="text">
      <span aria-hidden className="wm-base">
        {[...text].map((ch, i) => (
          <span key={i} className="wm-letter" style={{ '--i': i } as React.CSSProperties}>
            {ch}
          </span>
        ))}
      </span>
      <span aria-hidden className="wm-sheen">
        {text}
      </span>
    </span>
  );
}
