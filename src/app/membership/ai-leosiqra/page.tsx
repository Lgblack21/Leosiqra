"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send,
  RefreshCw, 
  Copy,
  ArrowRight,
  TrendingUp,
  LineChart,
  Target,
  Check,
  Bot,
  User
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService } from '@/lib/services/accountService';
import { transactionService } from '@/lib/services/transactionService';
import { investmentService } from '@/lib/services/investmentService';
import { savingsService } from '@/lib/services/savingsService';
import { budgetService } from '@/lib/services/budgetService';
import { aiChatService, ChatMessage as Message } from '@/lib/services/aiChatService';
import { formatCurrency } from '@/lib/utils';



const SYSTEM_CONTEXT_BASE = `Kamu adalah Leosiqra, asisten keuangan AI yang cerdas dan ramah untuk aplikasi Finlytics. Kamu membantu pengguna dengan:
- Analisis keuangan pribadi (pemasukan, pengeluaran, tabungan)
- Strategi investasi (saham, deposito, emas, kripto)
- Perencanaan anggaran dan penghematan
- Tips manajemen hutang dan piutang
- Perencanaan keuangan jangka panjang (dana darurat, pensiun)

Konteks Keuangan Pengguna Saat Ini:
{FINANCE_CONTEXT}

Berikan jawaban yang jelas, praktis, dan dalam Bahasa Indonesia. Gunakan angka dan contoh konkret berdasarkan data di atas bila perlu. Jika pengguna bertanya tentang data yang tidak ada di konteks, sampaikan dengan jujur. Jangan memberikan saran investasi yang menjanjikan keuntungan pasti.`;

const QUICK_PROMPTS = [
  "Berapa total saldo saya di semua rekening?",
  "Bagaimana perkembangan investasi saham saya?",
  "Apakah pengeluaran saya bulan ini sudah aman?",
  "Berapa sisa target tabungan Dana Darurat saya?",
];

export default function AILeosiqraPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Halo! Saya **Leosiqra**, asisten keuangan AI Anda 👋\n\nSaya sedang menganalisis data keuangan Anda agar dapat memberikan bantuan yang lebih akurat...',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [financeContext, setFinanceContext] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const normalizeMessage = (msg: Partial<Message> | any): Message => {
    const role: Message['role'] = msg?.role === 'user' ? 'user' : 'model';
    const text =
      typeof msg?.text === 'string'
        ? msg.text
        : (typeof msg?.content === 'string' ? msg.content : '');
    const rawTime = msg?.timestamp ?? msg?.createdAt ?? msg?.updatedAt;
    const timestamp =
      rawTime instanceof Date
        ? rawTime
        : (rawTime?.toDate ? rawTime.toDate() : new Date(rawTime ?? Date.now()));

    return {
      role,
      text,
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
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

  useEffect(() => {
    if (!userId) return;

    const loadFinancialData = async () => {
      try {
        const [accounts, transactions, investments, savings, budgets, userProfileModule] = await Promise.all([
          accountService.getUserAccounts(userId),
          transactionService.getUserTransactions(userId),
          investmentService.getUserInvestments(userId),
          savingsService.getUserSavings(userId),
          budgetService.getUserBudgets(userId),
          import('@/lib/services/userService')
        ]);

        // Calculate actual balances using transactions
        const savingsData = await savingsService.getUserSavings(userId); // Used for total out globally if needed, though for per-account we just use transactions 
        
        let realTotalBalance = 0;
        const processedAccounts = accounts.map(acc => {
          const accTrx = transactions.filter(t => t.accountId === acc.id);
          const inTotal = accTrx.filter(t => t.type === 'pemasukan' || (t.type === 'debt' && t.category === 'Hutang')).reduce((s, t) => s + t.amount, 0);
          const outTotal = accTrx.filter(t => t.type === 'pengeluaran' || (t.type === 'debt' && t.category === 'Piutang')).reduce((s, t) => s + t.amount, 0);
          const savingsOut = savingsData.filter(s => s.fromAccount === acc.id).reduce((sum, s) => sum + s.amount, 0);
          
          const currentBalance = (acc.balance || 0) + inTotal - outTotal - savingsOut;
          if (acc.type !== 'Credit Card') {
            realTotalBalance += currentBalance;
          }
          return {
            ...acc,
            currentBalance
          };
        });
        
        const context = `
DATA KEUANGAN REAL-TIME PENGGUNA:
1. Rekening (Saldo Berjalan Real-Time):
${processedAccounts.map(a => `- ${a.name}: ${formatCurrency(a.currentBalance)} (${a.type})`).join('\n')}
Total Seluruh Saldo Tunai/Bank: ${formatCurrency(realTotalBalance)}

2. Transaksi Terakhir (10 Terakhir):
${transactions.slice(0, 10).map(t => `- [${t.type}] ${t.category}: ${formatCurrency(t.amount)} (${t.note || '-'})`).join('\n')}

3. Investasi:
${investments.map(i => `- ${i.name} (${i.type}): Invested ${formatCurrency(i.amountInvested)}, Current ${formatCurrency(i.currentValue)}`).join('\n')}

4. Tabungan & Goals:
${savings.map(s => `- ${s.description}: ${formatCurrency(s.amount)} (Goal: ${s.toGoal})`).join('\n')}

5. Budget Bulan Ini:
${budgets.map(b => `- ${b.category}: Limit ${formatCurrency(b.amount)} (${b.type})`).join('\n')}
        `;

        setFinanceContext(context);
      } catch (error) {
        console.error("Error loading financial context:", error);
      } finally {
        setDataLoading(false);
      }
    };

    loadFinancialData();
  }, [userId]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key || key === 'YOUR_GEMINI_API_KEY_HERE') {
      setApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const sendViaBackendAI = async (text: string) => {
    const result = await cloudflareApi<{ answer?: string }>('/api/member/ai/chat', {
      method: 'POST',
      json: { prompt: text.trim() },
    });
    return result.answer || 'Maaf, AI backend belum memberi jawaban.';
  };

  const sendViaGeminiWithRetry = async (text: string, historyMessages: Message[]) => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('API key missing');
    }

    const history = historyMessages
      .map((m) => normalizeMessage(m))
      .filter((m) => m.text.trim().length > 0)
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
    const systemPrompt = SYSTEM_CONTEXT_BASE.replace('{FINANCE_CONTEXT}', financeContext);

    const models = ['gemini-flash-latest', 'gemini-1.5-flash-latest'];
    let lastError: unknown = null;

    for (const modelName of models) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: modelName });
          const chat = model.startChat({
            history: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'Siap! Saya Leosiqra, asisten keuangan AI Anda. Saya sudah menganalisis data keuangan Anda dan siap membantu.' }] },
              ...history
            ]
          });
          const result = await chat.sendMessage(text.trim());
          return result.response.text();
        } catch (error: any) {
          lastError = error;
          const msg = String(error?.message || '').toLowerCase();
          const retryable = msg.includes('503') || msg.includes('overloaded') || msg.includes('demand') || msg.includes('unavailable');
          if (!retryable || attempt === 2) {
            break;
          }
          await sleep(800 * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('Gemini sementara tidak tersedia');
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: text.trim(), timestamp: new Date() };
    const tempMessages = [...messages, userMsg];
    setMessages(tempMessages);
    setInput('');
    setLoading(true);

    try {
      let response = '';
      try {
        response = await sendViaGeminiWithRetry(text, messages);
      } catch {
        // Fallback ke backend worker AI saat provider eksternal sibuk
        response = await sendViaBackendAI(text);
      }
      
      const newMessages = [...tempMessages, {
        role: 'model' as const,
        text: response,
        timestamp: new Date()
      }];
      setMessages(newMessages);
      if (userId) aiChatService.saveUserChat(userId, newMessages);
    } catch (e: any) {
      console.error("AI Error:", e);
      const errorMsg = e?.message || '';
      
      let friendlyMessage = 'Maaf ya, Leosiqra sedang mengalami sedikit kendala teknis saat berpikir. Silakan coba kirim ulang pertanyaan Anda. 🙏';
      
      if (errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('demand')) {
        friendlyMessage = 'Waduh, server pikiran Leosiqra sedang sangat sibuk melayani banyak antrean nih. Mohon beri waktu sekitar 1-2 menit untuk istirahat, lalu coba tanya lagi ya! ⏳✨';
      } else if (errorMsg.includes('API key not valid')) {
        friendlyMessage = 'Ups, API Key Gemini Bapak sepertinya belum valid atau belum diatur dengan benar di sistem pengaturannya.';
      }

      const errorMessages = [...tempMessages, {
        role: 'model' as const,
        text: friendlyMessage,
        timestamp: new Date()
      }];
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
            text: 'Halo! Saya **Leosiqra**, asisten keuangan AI Anda 👋\n\nSaya sudah selesai menganalisis data keuangan Anda. Anda bisa bertanya tentang saldo rekening, performa investasi, atau pengeluaran bulan ini. Apa yang ingin Anda ketahui?'
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
      text: 'Chat direset. Halo lagi! Ada yang bisa saya bantu? 😊',
      timestamp: new Date()
    };
    setMessages([defaultMsg]);
    if (userId) {
      await aiChatService.clearUserChat(userId);
    }
  };

  // Simple markdown-like formatter
  const formatText = (text: string) => {
    const safeText = typeof text === 'string' ? text : '';
    return safeText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1400px] mb-20">
      
      {/* Header */}
      <div className="bg-white p-5 md:p-8 lg:p-10 rounded-[20px] md:rounded-[48px] border border-slate-50 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between gap-6 lg:gap-10">
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full w-fit">
              <Sparkles size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Powered by Gemini AI</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-[1.2]">
              AI Leosiqra <br className="hidden md:block" />
              <span className="text-indigo-600">Asisten Keuangan</span>
            </h1>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              Tanya apa saja seputar keuangan pribadi, investasi, dan perencanaan anggaran Anda.
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
              { icon: TrendingUp, label: 'Analisis Investasi', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { icon: Target, label: 'Strategi Anggaran', color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-[200px]">
                <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                  <item.icon size={14} className={item.animate} />
                </div>
                <span className="text-[11px] font-bold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Key Warning */}
      {apiKeyMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={14} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800">API Key Gemini Belum Diatur</p>
            <p className="text-xs font-medium text-amber-600 mt-1">
              Buka file <code className="bg-amber-100 px-1 rounded">.env.local</code> dan ganti <code className="bg-amber-100 px-1 rounded">YOUR_GEMINI_API_KEY_HERE</code> dengan API key dari{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold">aistudio.google.com</a>
              , lalu restart server.
            </p>
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
                className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-[11px] font-bold text-slate-700 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed group">
                <div className="flex items-start gap-2">
                  <ArrowRight size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors mt-0.5 shrink-0" />
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Leosiqra</h2>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${apiKeyMissing ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-slate-400">{apiKeyMissing ? 'API key belum diatur' : 'Online'}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar" style={{ maxHeight: '480px' }}>
            {messages.map((rawMsg, idx) => {
              const msg = normalizeMessage(rawMsg);
              return (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] space-y-1 group ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-sm'
                      : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100'
                  }`}
                    dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                  />
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
              </div>
            )})}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-2xl bg-indigo-600 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-4">
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
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
                className="w-12 h-12 my-auto bg-indigo-600 disabled:bg-slate-200 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:cursor-not-allowed">
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

