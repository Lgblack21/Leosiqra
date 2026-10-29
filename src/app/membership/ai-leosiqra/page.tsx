"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, LineChart, RotateCcw, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { AiChat, AiOrb } from '@/components/ai/AiChat';
import { HeaderSlot } from '@/components/Header';
import { insightService, UserInsight } from '@/lib/services/insightService';
import { cn } from '@/lib/utils';

// AI Leosiqra = ngobrol dengan Leo. Kolom utama chat; di desktop panel kanan
// berisi insight proaktif dari backend (anomali, proyeksi budget, tren).
const INSIGHT_LABEL: Record<string, string> = { anomaly: 'Anomali', budget_pace: 'Proyeksi anggaran', trend: 'Tren bulanan' };

export default function AILeosiqraPage() {
  const [insights, setInsights] = useState<UserInsight[]>([]);

  useEffect(() => {
    insightService.getUserInsights().then(setInsights).catch(() => setInsights([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <AiChat
        variant="web"
        renderHeader={({ reset, hasMessages, thinking }) => (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AiOrb size={44} thinking={thinking} />
              <div className="min-w-0">
                <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 md:text-[30px]">AI Leo</h1>
                <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {thinking ? 'Leo lagi mikir…' : <>Terhubung ke <span className="hidden sm:inline">catatan keuangan</span><span className="sm:hidden">data</span>mu</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasMessages && (
                <button
                  type="button"
                  onClick={() => { if (confirm('Mulai obrolan baru? Riwayat chat ini akan dihapus.')) reset(); }}
                  aria-label="Obrolan baru"
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <RotateCcw size={15} /> <span className="hidden sm:inline">Obrolan baru</span>
                </button>
              )}
              <HeaderSlot />
            </div>
          </div>
        )}
        layout={(header, chat) => (
          <div className="flex h-[calc(100dvh-148px)] min-h-[520px] flex-col md:h-[calc(100dvh-96px)]">
            {header}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-100">{chat}</section>
              <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:flex">
                <div className="space-y-2 rounded-[20px] bg-white p-3.5 ring-1 ring-slate-100">
                  {[
                    { icon: ShieldCheck, text: 'Baca catatan keuanganmu', tone: 'text-emerald-600 bg-emerald-50' },
                    { icon: LineChart, text: 'Harga kripto, emas & kurs terbaru', tone: 'text-sky-600 bg-sky-50' },
                  ].map((t) => (
                    <p key={t.text} className="flex items-center gap-2.5 text-[12px] font-semibold text-slate-600">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', t.tone)}><t.icon size={14} /></span>
                      {t.text}
                    </p>
                  ))}
                </div>
                {insights.length > 0 && (
                  <div>
                    <p className="mb-1.5 px-1 text-[12px] font-bold text-slate-500">Insight buat kamu</p>
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
                      {insights.slice(0, 5).map((ins) => (
                        <li key={ins.id} className="px-3.5 py-2.5">
                          <p className={cn('flex items-center gap-1 text-[11px] font-bold', ins.severity === 'warning' ? 'text-amber-600' : 'text-sky-600')}>
                            {ins.severity === 'warning' ? <AlertTriangle size={12} /> : ins.type === 'trend' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {INSIGHT_LABEL[ins.type] ?? 'Insight'}
                          </p>
                          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-900">{ins.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500" title={ins.body}>{ins.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      />
    </div>
  );
}
