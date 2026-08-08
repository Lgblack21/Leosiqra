"use client";

import { useState } from "react";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { Fab } from "@/components/app/Fab";
import { AddTransactionSheet } from "@/components/app/AddTransactionSheet";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {children}
      <Fab onClick={() => setIsAddOpen(true)} />
      <BottomTabBar />
      <AddTransactionSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
