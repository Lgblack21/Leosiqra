import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const serifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const SITE_TITLE = "Leosiqra | Aplikasi Pencatat Keuangan dengan Kalkulasi Pajak SPT Otomatis";
const SITE_DESCRIPTION = "Leosiqra adalah aplikasi pencatat keuangan pribadi dengan kalkulasi pajak SPT (PPh) otomatis — rekap bulanan, kalkulasi pajak, dan portfolio investasi dalam satu dashboard bersih.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.leosiqra.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Leosiqra",
    "aplikasi pencatat keuangan",
    "aplikasi pencatat keuangan dengan kalkulasi pajak SPT",
    "aplikasi keuangan pribadi kalkulasi PPh otomatis",
    "manajemen keuangan pribadi",
    "kalkulasi pajak SPT online",
    "dashboard finansial",
    "portfolio investasi",
    "aplikasi budgeting Indonesia",
  ],
  icons: {
    icon: "/images/Logo-new.png",
    apple: "/images/Logo-new.png",
  },
  manifest: "/manifest.json",
  // Diperlukan supaya "Add to Home Screen" di iOS jadi PWA standalone yang
  // benar — Web Push di Safari cuma jalan lewat PWA yang sudah di-install
  // seperti ini, tidak bisa langsung dari tab Safari biasa.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Leosiqra",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://www.leosiqra.com",
    siteName: "Leosiqra",
    images: ["/images/Logo-new.png"],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/images/Logo-new.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Leosiqra",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  url: "https://www.leosiqra.com",
  offers: {
    "@type": "Offer",
    priceCurrency: "IDR",
    price: "0",
  },
};

import MaintenanceGuard from "@/components/MaintenanceGuard";
import StaleReloadGuard from "@/components/StaleReloadGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`h-full antialiased ${serifDisplay.variable} ${jakarta.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <StaleReloadGuard />
        <MaintenanceGuard>
          {children}
        </MaintenanceGuard>
      </body>
    </html>
  );
}
