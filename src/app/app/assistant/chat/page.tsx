"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, Bot, User, RefreshCw } from "lucide-react";
import { auth } from "@/lib/cf-client";
import { onAuthStateChanged } from "@/lib/cf-auth";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { aiChatService, ChatMessage as Message } from "@/lib/services/aiChatService";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatText = (text: string) => {
  const safeText = escapeHtml(typeof text === "string" ? text : "");
  return safeText
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (isRecord(value) && typeof value.toDate === "function") {
    const maybeDate = (value.toDate as () => unknown)();
    if (maybeDate instanceof Date) return maybeDate;
  }
  const parsed = new Date(typeof value === "string" || typeof value === "number" ? value : Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeMessage = (msg: Partial<Message> | unknown): Message => {
  const source = isRecord(msg) ? msg : {};
  const role: Message["role"] = source.role === "user" ? "user" : "model";
  const text =
    typeof source.text === "string" ? source.text : typeof source.content === "string" ? source.content : "";
  const timestamp = toDate(source.timestamp ?? source.createdAt ?? source.updatedAt);
  return { role, text, timestamp };
};

export default function AssistantChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Halo! Saya asisten AI Leosiqra. Tanya apa saja soal keuangan kamu.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) return;
    aiChatService
      .getUserChat(userId)
      .then((history) => {
        if (history && history.length > 0) setMessages(history);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim(), timestamp: new Date() };
    const tempMessages = [...messages, userMsg];
    setMessages(tempMessages);
    setInput("");
    setLoading(true);
    try {
      const result = await cloudflareApi<{ answer?: string }>("/api/member/ai/chat", {
        method: "POST",
        json: { prompt: text.trim() },
      });
      const response = result.answer || "Maaf, AI belum bisa memberi jawaban saat ini.";
      const newMessages = [...tempMessages, { role: "model" as const, text: response, timestamp: new Date() }];
      setMessages(newMessages);
      if (userId) aiChatService.saveUserChat(userId, newMessages);
    } catch {
      const friendlyMessage =
        "Maaf ya, lagi ada kendala teknis. Silakan coba kirim ulang pertanyaan Anda dalam beberapa saat.";
      const errorMessages = [...tempMessages, { role: "model" as const, text: friendlyMessage, timestamp: new Date() }];
      setMessages(errorMessages);
      if (userId) aiChatService.saveUserChat(userId, errorMessages);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    const defaultMsg: Message = { role: "model", text: "Chat direset. Ada yang bisa saya bantu?", timestamp: new Date() };
    setMessages([defaultMsg]);
    if (userId) await aiChatService.clearUserChat(userId);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()} className="p-1.5 -ml-1.5 text-slate-500">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-sm font-black text-slate-900">Chat AI</h1>
        </div>
        <button type="button" onClick={clearChat} className="p-1.5 text-slate-400">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar">
        {messages.map((rawMsg, idx) => {
          const msg = normalizeMessage(rawMsg);
          return (
            <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user" ? "bg-slate-900 text-white" : "bg-indigo-600 text-white"
                }`}
              >
                {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
              </div>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-sm"
                    : "bg-white text-slate-800 rounded-tl-sm border border-slate-100"
                }`}
                dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
              />
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3.5">
              <div className="flex gap-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white pb-[calc(env(safe-area-inset-bottom)+16px)] shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Tanya sesuatu..."
            disabled={loading}
            className="flex-1 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-2xl py-3.5 px-4 text-sm font-medium text-slate-700 placeholder:text-slate-300 disabled:opacity-50 outline-none"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-11 h-11 shrink-0 bg-indigo-600 disabled:bg-slate-200 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
