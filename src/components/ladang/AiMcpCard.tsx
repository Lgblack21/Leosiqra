"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Bot, Check, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { notifyCollectionChanged } from '@/lib/cf-firestore';
import { openSettings } from '@/lib/settingsPanel';
import { useMcpStatus } from '@/lib/mcpStatus';
import { cn } from '@/lib/utils';

// Usahaku memakai AI MILIK PENGGUNA (Claude/ChatGPT lewat MCP Leosiqra), bukan AI
// Leosiqra: kartu ini memberi langkahnya — hubungkan AI, salin perintah, buka AI,
// lalu muat ulang data setelah AI-nya menyimpan lewat tool MCP.

export function AiMcpCard({ title, desc, prompt, onLeave, onToast, className }: { title: string; desc: string; prompt: string; onLeave?: () => void; onToast: (m: string) => void; className?: string }) {
  const app = (usePathname() ?? '').startsWith('/app');
  const [copied, setCopied] = useState(false);
  const mcp = useMcpStatus();
  const copy = () => navigator.clipboard.writeText(prompt).then(
    () => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); onToast('Perintah tersalin — tempel di Claude/ChatGPT yang sudah terhubung ke Leosiqra.'); },
    () => onToast('Tidak bisa menyalin otomatis — salin manual dari kotak perintah.'),
  );
  const connect = () => { onLeave?.(); window.setTimeout(() => openSettings('app-mcp'), 150); };
  const step = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-extrabold text-white';
  const btn = 'flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-bold';

  return (
    <div className={cn('rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-3.5 dark:from-violet-500/10 dark:to-sky-500/10', className)}>
      <p className="flex items-center gap-1.5 text-[14px] font-extrabold text-slate-900 dark:text-white"><Bot size={16} className="text-violet-600" /> {title}</p>
      <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">{desc}</p>
      <ol className="mt-3 space-y-2.5 text-[12px] text-slate-700 dark:text-slate-200">
        {mcp.state === 'write' ? (
          <li className="flex items-center gap-2 rounded-xl bg-emerald-50 px-2.5 py-2 dark:bg-emerald-500/10"><CheckCircle2 size={18} className="shrink-0 text-emerald-600" /><span className="min-w-0 flex-1 text-emerald-900 dark:text-emerald-200"><b>AI tersambung</b>{mcp.names.length ? `: ${mcp.names.join(', ')}` : ''} · izin mengubah aktif</span>
            {app ? <Link href="/app/profile" onClick={onLeave} className="shrink-0 font-bold text-emerald-700 underline dark:text-emerald-300">Atur</Link> : <button type="button" onClick={connect} className="shrink-0 font-bold text-emerald-700 underline dark:text-emerald-300">Atur</button>}
          </li>
        ) : mcp.state === 'read' ? (
          <li className="flex items-start gap-2 rounded-xl bg-amber-50 px-2.5 py-2 dark:bg-amber-500/10"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" /><span className="min-w-0 flex-1 text-amber-900 dark:text-amber-200"><b>Tersambung, tapi izin baca saja</b>{mcp.names.length ? ` (${mcp.names.join(', ')})` : ''} — sambungkan ulang & centang izin mengubah supaya AI bisa menyimpan.</span>
            {app ? <Link href="/app/profile" onClick={onLeave} className="shrink-0 font-bold text-amber-700 underline dark:text-amber-300">Atur</Link> : <button type="button" onClick={connect} className="shrink-0 font-bold text-amber-700 underline dark:text-amber-300">Atur</button>}
          </li>
        ) : (
          <li className="flex items-center gap-2"><span className={step}>1</span><span className="min-w-0 flex-1">Hubungkan Claude/ChatGPT ke Leosiqra (sekali saja).</span>
            {app ? <Link href="/app/profile" onClick={onLeave} className="shrink-0 font-bold text-violet-700 underline dark:text-violet-300">Hubungkan</Link> : <button type="button" onClick={connect} className="shrink-0 font-bold text-violet-700 underline dark:text-violet-300">Hubungkan</button>}
          </li>
        )}
        <li className="flex items-start gap-2"><span className={step}>2</span><span className="min-w-0 flex-1">Salin perintah ini, tempel di AI-mu:
          <span className="mt-1.5 block max-h-28 select-all overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/80 p-2.5 text-[11px] leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:bg-slate-900/60 dark:text-slate-300">{prompt}</span></span>
        </li>
        <li className="flex items-center gap-2"><span className={step}>3</span><span className="min-w-0 flex-1">Setelah AI-mu menyimpan, muat ulang di sini.</span></li>
      </ol>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className={cn(btn, 'bg-violet-600 text-white hover:bg-violet-700')}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Tersalin' : 'Salin perintah'}</button>
        <button type="button" onClick={() => { notifyCollectionChanged('shops'); onToast('Data usaha dimuat ulang.'); }} className={cn(btn, 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200')}><RefreshCw size={13} /> Muat ulang</button>
        <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200')}><ExternalLink size={13} /> Buka Claude</a>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200')}><ExternalLink size={13} /> Buka ChatGPT</a>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Gratis — tidak memakai kuota AI Leosiqra. Saat menghubungkan, centang izin mengubah.</p>
    </div>
  );
}
