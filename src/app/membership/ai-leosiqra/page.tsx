"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, LineChart, MessageCircleHeart, RotateCcw, ShieldCheck, TrendingDown } from 'lucide-react';
import { AiChat, AiOrb } from '@/components/ai/AiChat';
import { insightService, UserInsight } from '@/lib/services/insightService';
import { cn } from '@/lib/utils';

const TRAITS = [
  { icon: ShieldCheck, text: 'Terhubung ke catatan keuanganmu', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: LineChart, text: 'Data pasar real-time (kripto, emas, kurs)', tone: 'text-sky-600 bg-sky-50' },
  { icon: MessageCircleHeart, text: 'Ngobrol santai, gak kaku', tone: 'text-fuchsia-600 bg-fuchsia-50' },
];

export default function AILeosiqraPage() {
  const [insights, setInsights] = useState<UserInsight[]>([]);

  // Insight proaktif (anomali kategori, proyeksi budget, tren) dihitung backend.
  useEffect(() => {
    insightService.getUserInsights().then(setInsights).catch(() => setInsights([]));
  }, []);

  return (
    <div className="mx-auto grid h-[calc(100dvh-140px)] min-h-[560px] max-w-[1400px] gap-6 lg:grid-cols-[300px_1fr]">
      {/* Panel samping (desktop) */}
      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto pb-2 lg:flex">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-6 text-white shadow-xl shadow-indigo-900/20">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-2xl" aria-hidden />
          <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-indigo-500/30 blur-2xl" aria-hidden />
          <div className="relative">
            <AiOrb size={56} />
            <h1 className="mt-4 text-2xl font-black">AI Leosiqra</h1>
            <p className="mt-1 text-sm leading-relaxed text-indigo-100/80">Teman ngobrol soal duit — tanya pengeluaran, budget, tabungan, investasi, sampai harga emas.</p>
          </div>
        </div>
        <div className="space-y-2 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
          {TRAITS.map((t) => (
            <div key={t.text} className="flex items-center gap-3">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', t.tone)}><t.icon size={15} /></span>
              <span className="text-[12px] font-bold text-slate-600">{t.text}</span>
            </div>
          ))}
        </div>
        {insights.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Insight buat kamu</p>
            {insights.slice(0, 4).map((ins) => (
              <div key={ins.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest', ins.severity === 'warning' ? 'text-amber-600' : 'text-sky-600')}>
                  {ins.severity === 'warning' ? <AlertTriangle size={12} /> : <TrendingDown size={12} />}
                  {ins.type === 'anomaly' ? 'Anomali' : ins.type === 'budget_pace' ? 'Proyeksi budget' : 'Tren bulanan'}
                </p>
                <p className="mt-1.5 text-sm font-black text-slate-900">{ins.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{ins.body}</p>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Chat */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-gradient-to-b from-white to-slate-50/80 shadow-sm">
        <AiChat
          variant="web"
          renderHeader={({ reset, hasMessages, thinking }) => (
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/80 px-5 py-4 backdrop-blur md:px-8">
              <div className="flex items-center gap-3">
                <AiOrb size={40} thinking={thinking} />
                <div>
                  <p className="text-sm font-black text-slate-900">Leosiqra</p>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    {thinking ? 'lagi ngetik…' : 'Online · terhubung ke datamu'}
                  </p>
                </div>
              </div>
              {hasMessages && (
                <button
                  type="button"
                  onClick={() => { if (confirm('Mulai obrolan baru? Riwayat chat ini akan dihapus.')) reset(); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <RotateCcw size={14} /> Obrolan baru
                </button>
              )}
            </div>
          )}
        />
      </section>
    </div>
  );
}
