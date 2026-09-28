import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { Reveal } from '@/components/landing/Reveal';

export interface GuideFaq {
  q: string;
  a: string;
}

// Kerangka halaman panduan publik (target pencarian Google): satu H1 berisi
// kata kunci, artikel yang benar-benar menjawab, FAQ + JSON-LD FAQPage, dan
// ajakan mencoba aplikasi. Server component — isinya ikut ter-render di HTML
// statis supaya bisa dibaca crawler tanpa menjalankan JavaScript.
export function GuideLayout({
  eyebrow,
  title,
  lead,
  updated,
  children,
  faq,
  related,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  updated: string;
  children: React.ReactNode;
  faq: GuideFaq[];
  related: { href: string; label: string };
}) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar />

      <header className="relative overflow-hidden px-5 pb-12 pt-36 sm:px-6 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">{lead}</p>
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-400">
            <CalendarDays size={15} /> Diperbarui {updated}
          </p>
        </div>
      </header>

      <main className="relative flex-1 px-5 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <article className="guide-body lp-card rounded-[28px] p-7 text-[16px] leading-relaxed text-slate-600 sm:p-10">
            {children}
          </article>

          <Reveal className="flex flex-col items-start justify-between gap-5 rounded-[28px] bg-gradient-to-br from-[#0f172a] via-indigo-700 to-violet-600 p-7 text-white sm:flex-row sm:items-center sm:p-9">
            <div>
              <p className="font-serif text-2xl">Catat keuangan tanpa ribet</p>
              <p className="mt-1 text-sm text-indigo-100/90">Gratis 14 hari · Android, iPhone &amp; web · Bahasa Indonesia</p>
            </div>
            <Link href="/auth/register" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-700 transition-transform hover:-translate-y-0.5">
              Coba Leosiqra <ArrowRight size={16} />
            </Link>
          </Reveal>

          <section aria-labelledby="faq-h" className="lp-card rounded-[28px] p-7 sm:p-10">
            <h2 id="faq-h" className="font-serif text-3xl">Pertanyaan yang sering ditanyakan</h2>
            <div className="mt-6 divide-y divide-slate-100">
              {faq.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
                    <span className="mr-2 inline-block text-indigo-500 transition-transform group-open:rotate-45">+</span>
                    {f.q}
                  </summary>
                  <p className="mt-3 pl-5 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="text-center text-sm text-slate-500">
            Baca juga:{' '}
            <Link href={related.href} className="font-bold text-indigo-600 hover:underline">{related.label}</Link>
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
