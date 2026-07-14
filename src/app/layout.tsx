import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Leosiqra | Dashboard Finansial Pribadi Premium",
  description: "Dashboard Finansial Pribadi Premium untuk pengelolaan keuangan yang lebih baik.",
  icons: {
    icon: "/images/Logo-new.png",
    apple: "/images/Logo-new.png",
  },
};

import MaintenanceGuard from "@/components/MaintenanceGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${serifDisplay.variable} ${jakarta.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">
        <MaintenanceGuard>
          {children}
        </MaintenanceGuard>
      </body>
    </html>
  );
}
