"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Mic, Square, Sparkles } from "lucide-react";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { TransactionReviewForm, ParsedTransactionSuggestion } from "@/components/app/assistant/TransactionReviewForm";
import { lightTap } from "@/lib/haptics";

type VoiceState = "idle" | "listening" | "transcribed" | "processing" | "ready" | "error";

const WAVE_DELAYS = [0, 0.12, 0.24, 0.12, 0];

// Dekoratif, bukan audio-reactive asli (plugin speech-recognition cuma
// ngasih transcript teks, gak ada level amplitudo) — lihat catatan di
// globals.css. Cukup buat kesan "lagi dengerin", bukan visualisasi asli.
function WaveformBars() {
  return (
    <div className="flex items-center gap-1.5 h-8">
      {WAVE_DELAYS.map((delay, i) => (
        <span
          key={i}
          className="w-1.5 h-8 rounded-full bg-white animate-voice-wave"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

export default function AssistantVoicePage() {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [suggestion, setSuggestion] = useState<ParsedTransactionSuggestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const transcriptRef = useRef("");

  useEffect(() => {
    return () => {
      SpeechRecognition.removeAllListeners();
    };
  }, []);

  const startListening = async () => {
    lightTap();
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setErrorMsg("Perangkat ini tidak mendukung pengenalan suara.");
        setState("error");
        return;
      }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") {
        setErrorMsg("Izin mikrofon/pengenalan suara dibutuhkan untuk fitur ini.");
        setState("error");
        return;
      }

      transcriptRef.current = "";
      setTranscript("");
      setState("listening");

      await SpeechRecognition.addListener("partialResults", (data: { matches?: string[] }) => {
        const latest = data.matches?.[0];
        if (latest) {
          transcriptRef.current = latest;
          setTranscript(latest);
        }
      });

      await SpeechRecognition.start({
        language: "id-ID",
        partialResults: true,
        popup: false,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Gagal memulai pengenalan suara.");
      setState("error");
    }
  };

  const stopListening = async () => {
    lightTap();
    try {
      await SpeechRecognition.stop();
      await SpeechRecognition.removeAllListeners();
    } catch {
      // abaikan — tetap lanjut ke transcript yang sudah terkumpul
    }
    setState(transcriptRef.current.trim() ? "transcribed" : "idle");
  };

  const process = async () => {
    if (!transcriptRef.current.trim()) return;
    setState("processing");
    try {
      const result = await cloudflareApi<{ ok: boolean; suggestion?: ParsedTransactionSuggestion; error?: string }>(
        "/api/member/ai/parse-transaction",
        { method: "POST", json: { text: transcriptRef.current.trim() } }
      );
      if (result.ok && result.suggestion) {
        setSuggestion(result.suggestion);
        setState("ready");
      } else {
        setErrorMsg(result.error || "AI tidak bisa membaca transaksi dari ucapan ini.");
        setState("error");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "AI tidak bisa membaca transaksi dari ucapan ini.");
      setState("error");
    }
  };

  const reset = () => {
    transcriptRef.current = "";
    setTranscript("");
    setState("idle");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-100 bg-white shrink-0">
        <button type="button" onClick={() => router.back()} className="p-1.5 -ml-1.5 text-slate-500">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-sm font-black text-slate-900">Voice</h1>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {state === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-32 h-32 rounded-full bg-indigo-200/60 blur-xl animate-ambient-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Mic size={32} />
              </div>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-6">Catat via Suara</h2>
            <p className="text-sm font-medium text-slate-400 mt-1.5 max-w-xs">
              Contoh: &quot;Beli kopi lima puluh ribu pakai Cash&quot;
            </p>
            <motion.button
              type="button"
              onClick={startListening}
              whileTap={{ scale: 0.92 }}
              className="mt-8 w-20 h-20 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center"
            >
              <Mic size={28} />
            </motion.button>
            <div className="flex flex-wrap gap-2 justify-center mt-10 max-w-xs">
              {["Beli kopi 25rb", "Gajian 5jt", "Bayar listrik 200rb"].map((hint) => (
                <span
                  key={hint}
                  className="text-[11px] font-bold text-slate-400 bg-white border border-slate-100 rounded-full px-3 py-1.5"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        )}

        {state === "listening" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-32 h-32 rounded-full bg-rose-300/50 blur-xl animate-ambient-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center">
                <WaveformBars />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-6 uppercase tracking-widest">Mendengarkan...</p>
            <p className="text-base font-bold text-slate-900 mt-3 max-w-xs min-h-[3lh]">
              {transcript || "Silakan bicara..."}
            </p>
            <motion.button
              type="button"
              onClick={stopListening}
              whileTap={{ scale: 0.92 }}
              className="mt-8 w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center"
            >
              <Square size={22} />
            </motion.button>
          </div>
        )}

        {state === "transcribed" && (
          <div className="space-y-5 pt-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasil Ucapan</label>
              <p className="text-base font-bold text-slate-900 mt-2">{transcript}</p>
            </div>
            <button
              type="button"
              onClick={process}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> Proses dengan AI
            </button>
            <button type="button" onClick={reset} className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-sm">
              Ulangi
            </button>
          </div>
        )}

        {state === "processing" && (
          <div className="flex flex-col items-center pt-16">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-400 mt-4">Memproses...</p>
          </div>
        )}

        {state === "ready" && suggestion && (
          <TransactionReviewForm suggestion={suggestion} onSaved={() => router.push("/app")} />
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600">
              {errorMsg}
            </div>
            <button type="button" onClick={reset} className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm">
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestion(null);
                setState("ready");
              }}
              className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm"
            >
              Isi Manual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
