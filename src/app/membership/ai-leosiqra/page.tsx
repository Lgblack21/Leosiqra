"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  RefreshCw,
  Copy,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Check,
  Bot,
  User,
  LineChart
} from 'lucide-react';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService } from '@/lib/services/accountService';
import { transactionService } from '@/lib/services/transactionService';
import { investmentService } from '@/lib/services/investmentService';
import { savingsService } from '@/lib/services/savingsService';
import { budgetService } from '@/lib/services/budgetService';
import { aiChatService, ChatMessage as Message } from '@/lib/services/aiChatService';
import { insightService, UserInsight } from '@/lib/services/insightService';
import { InsightCard } from '@/components/InsightCard';

const QUICK_PROMPTS = [
  "Berapa total saldo saya di semua rekening?",
  "Bagaimana harga Bitcoin & emas hari ini?",
  "Apakah pengeluaran saya bulan ini sudah aman?",
  "Berapa sisa target tabungan Dana Darurat saya?",
];

const CAPABILITIES = [
  { icon: TrendingUp, label: 'Analisis Investasi', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: LineChart, label: 'Data Pasar Real-Time', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Target, label: 'Strategi Anggaran', color: 'text-violet-600', bg: 'bg-violet-50' },
];

// Simple markdown-like formatter — dipakai bersama oleh pesan biasa & typewriter.
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatText = (text: string) => {
  const safeText = escapeHtml(typeof text === 'string' ? text : '');
  return safeText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
};

// Efek ketik halus untuk jawaban AI yang baru datang — memberi kesan "hidup"
// tanpa perlu streaming sungguhan dari backend.
const TypewriterText = ({ text, animate }: { text: string; animate: boolean }) => {
  const [display, setDisplay] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setDisplay(text);
      return;
    }
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplay(text);
      return;
    }

    setDisplay('');
    let i = 0;
    const chunk = Math.max(1, Math.round(text.length / 120));
    const interval = setInterval(() => {
      i += chunk;
      setDisplay(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 12);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <span dangerouslySetInnerHTML={{ __html: formatText(display) }} />;
};

export default function AILeosiqraPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Halo! Saya **Leosiqra**, asisten AI Anda \n\nSaya sedang menganalisis data keuangan Anda agar dapat memberikan bantuan yang lebih akurat...',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [freshReplyIndex, setFreshReplyIndex] = useState<number | null>(null);
  const [financeContext, setFinanceContext] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [insights, setInsights] = useState<UserInsight[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toDate = (value: unknown): Date => {
    if (value instanceof Date) return value;
    if (isRecord(value) && typeof value.toDate === 'function') {
      const maybeDate = value.toDate();
      if (maybeDate instanceof Date) {
        return maybeDate;
      }
    }
    const parsed = new Date(typeof value === 'string' || typeof value === 'number' ? value : Date.now());
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const normalizeMessage = (msg: Partial<Message> | unknown): Message => {
    const source = isRecord(msg) ? msg : {};
    const role: Message['role'] = source.role === 'user' ? 'user' : 'model';
    const text =
      typeof source.text === 'string'
        ? source.text
        : (typeof source.content === 'string' ? source.content : '');
    const rawTime = source.timestamp ?? source.createdAt ?? source.updatedAt;
    const timestamp = toDate(rawTime);

    return {
      role,
      text,
      timestamp
    };
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsub();
  }, []);

  // Load Chat History
  useEffect(() => {
    if (!userId) return;
    const loadChatHistory = async () => {
      try {
        const history = await aiChatService.getUserChat(userId);
        if (history && history.length > 0) {
          setMessages(history);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };
    loadChatHistory();
  }, [userId]);

  // Data ini hanya dipakai untuk indikator "Finansial Terhubung" di header —
  // konteks data sesungguhnya untuk AI dibangun & dijaga di backend (aman,
  // tidak bisa dimanipulasi dari browser).
  useEffect(() => {
    if (!userId) return;

    const loadFinancialData = async () => {
      try {
        const [accounts, transactions, investments, savings, budgets] = await Promise.all([
          accountService.getUserAccounts(userId),
          transactionService.getUserTransactions(userId),
          investmentService.getUserInvestments(userId),
          savingsService.getUserSavings(userId),
          budgetService.getUserBudgets(userId)
        ]);

        const hasData =
          accounts.length + transactions.length + investments.length + savings.length + budgets.length > 0;
        setFinanceContext(hasData ? 'ready' : 'empty');
      } catch (error) {
        console.error("Error checking financial context:", error);
        setFinanceContext('empty');
      } finally {
        setDataLoading(false);
      }
    };

    loadFinancialData();
  }, [userId]);

  // Insight proaktif: anomali kategori, proyeksi budget, tren bulanan — dihitung
  // di backend dari data transaksi/budget yang sudah ada (lihat computeUserInsights).
  useEffect(() => {
    if (!userId) return;
    insightService.getUserInsights().then(setInsights).catch((error) => {
      console.error('Error loading insights:', error);
      setInsights([]);
    });
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: text.trim(), timestamp: new Date() };
    const tempMessages = [...messages, userMsg];
    setMessages(tempMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await cloudflareApi<{ answer?: string }>('/api/member/ai/chat', {
        method: 'POST',
        json: { prompt: text.trim() },
      });
      const response = result.answer || 'Maaf, AI belum bisa memberi jawaban saat ini.';

      const newMessages = [...tempMessages, {
        role: 'model' as const,
        text: response,
        timestamp: new Date()
      }];
      setFreshReplyIndex(newMessages.length - 1);
      setMessages(newMessages);
      if (userId) aiChatService.saveUserChat(userId, newMessages);
    } catch (e: unknown) {
      console.error("AI Error:", e);
      const friendlyMessage =
        'Maaf ya, Leosiqra sedang mengalami sedikit kendala teknis saat berpikir. Silakan coba kirim ulang pertanyaan Anda dalam beberapa saat.';

      const errorMessages = [...tempMessages, {
        role: 'model' as const,
        text: friendlyMessage,
        timestamp: new Date()
      }];
      setFreshReplyIndex(errorMessages.length - 1);
      setMessages(errorMessages);
      if (userId) aiChatService.saveUserChat(userId, errorMessages);
    } finally {
      setLoading(false);
    }
  };

  // Update initial message after data is loaded (Only if there is no history!)
  useEffect(() => {
    if (!dataLoading && financeContext) {
      setMessages(prev => {
        if (prev.length === 1 && prev[0].role === 'model' && prev[0].text.includes('menganalisis data')) {
          return [{
            ...prev[0],
            text: 'Halo! Saya **Leosiqra**, asisten AI Anda \n\nSaya sudah terhubung dengan data keuangan Anda dan data pasar real-time. Anda bisa bertanya tentang saldo rekening, performa investasi, harga kripto/emas terbaru, atau apa saja lainnya. Apa yang ingin Anda ketahui?'
          }];
        }
        return prev;
      });
    }
  }, [dataLoading, financeContext]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearChat = async () => {
    const defaultMsg: Message = {
      role: 'model',
      text: 'Chat direset. Halo lagi! Ada yang bisa saya bantu? ',
      timestamp: new Date()
    };
    setMessages([defaultMsg]);
    setFreshReplyIndex(null);
    if (userId) {
      await aiChatService.clearUserChat(userId);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-20">

      {/* Header */}
      <div className="relative bg-gradient-to-br from-white to-indigo-50/40 p-5 md:p-8 lg:p-10 rounded-[20px] md:rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="hero-aurora" aria-hidden />
        <div className="relative flex flex-col lg:flex-row justify-between gap-6 lg:gap-10">
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full w-fit">
              <Sparkles size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Powered by OpenRouter AI</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0 animate-floaty">
                <Sparkles size={26} />
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-[1.2]">
                AI Leosiqra <br className="hidden md:block" />
                <span className="text-gradient">Asisten Cerdas Anda</span>
              </h1>
            </div>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              Tanya apa saja — keuangan pribadi, investasi, data pasar real-time, atau topik umum lainnya. Leosiqra selalu fokus pada data akun Anda sendiri.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {[
              {
                icon: dataLoading ? RefreshCw : Check,
                label: dataLoading ? 'Menyinkronkan Data...' : 'Finansial Terhubung',
                color: dataLoading ? 'text-blue-600' : 'text-emerald-600',
                bg: dataLoading ? 'bg-blue-50' : 'bg-emerald-50',
                animate: dataLoading ? 'animate-spin' : ''
              },
              ...CAPABILITIES,
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 bg-white/70 backdrop-blur rounded-2xl border border-slate-100 min-w-[200px] shadow-sm">
                <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                  <item.icon size={14} className={'animate' in item ? item.animate : ''} />
                </div>
                <span className="text-[11px] font-bold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insight Proaktif */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Insight Proaktif</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                title={insight.type === 'anomaly' ? 'Anomali Pengeluaran' : insight.type === 'budget_pace' ? 'Proyeksi Budget' : 'Tren Bulanan'}
                value={insight.title}
                subtitle={insight.body}
                icon={insight.severity === 'warning' ? AlertTriangle : TrendingDown}
                colorClass={insight.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sidebar: Quick Prompts */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Pertanyaan Cepat</h3>
          <div className="space-y-3">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button key={i} onClick={() => sendMessage(prompt)} disabled={loading}
                className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/30 hover:-translate-y-0.5 hover:shadow-md transition-all text-[11px] font-bold text-slate-700 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 group">
                <div className="flex items-start gap-2">
                  <ArrowRight size={12} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
                  {prompt}
                </div>
              </button>
            ))}
          </div>

          <button onClick={clearChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all uppercase tracking-widest">
            <RefreshCw size={12} />
            Reset Chat
          </button>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-[20px] md:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden" style={{ minHeight: '600px' }}>

          {/* Chat Header */}
          <div className="p-4 md:p-6 border-b border-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Leosiqra</h2>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-slate-400">Online</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar" style={{ maxHeight: '480px' }}>
            <AnimatePresence initial={false}>
              {messages.map((rawMsg, idx) => {
                const msg = normalizeMessage(rawMsg);
                const isFresh = idx === freshReplyIndex && msg.role === 'model';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white'}`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`max-w-[80%] space-y-1 group ${msg.role === 'user' ? 'items-end' : ''}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-slate-900 text-white rounded-tr-sm'
                          : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100'
                      }`}>
                        {msg.role === 'model' ? (
                          <TypewriterText text={msg.text} animate={isFresh} />
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                        )}
                      </div>
                      <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[9px] font-medium text-slate-300">
                          {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'model' && (
                          <button onClick={() => handleCopy(msg.text, idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-slate-700">
                            {copied === idx ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Loading indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-4">
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 border-t border-slate-50">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder={'Tanya Leosiqra sesuatu...'}
                disabled={loading}
                className="flex-1 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-2xl py-4 px-5 text-sm font-medium text-slate-700 placeholder:text-slate-300 disabled:opacity-50 outline-none transition-all"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="w-12 h-12 my-auto bg-gradient-to-br from-emerald-600 to-teal-700 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all active:scale-95 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                <Send size={16} />
              </button>
            </div>
            <p className="text-[9px] font-medium text-slate-300 mt-3 text-center">
              Leosiqra dapat membuat kesalahan. Verifikasi informasi penting sebelum mengambil keputusan keuangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
