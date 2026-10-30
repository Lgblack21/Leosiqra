"use client";

import { useState } from "react";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { Fab } from "@/components/app/Fab";
import { AddTransactionSheet } from "@/components/app/AddTransactionSheet";
import { useCategoryTemplateSync } from "@/lib/categoryTemplateSync";
import DevNoticeBanner from "@/components/DevNoticeBanner";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  useCategoryTemplateSync();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {children}
      <Fab onClick={() => setIsAddOpen(true)} isOpen={isAddOpen} />
      <DevNoticeBanner variant="app" saranHref="/app/saran" />
      <BottomTabBar />
      <AddTransactionSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
