import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
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
