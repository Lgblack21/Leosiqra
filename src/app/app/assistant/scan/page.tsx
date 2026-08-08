"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera as CameraIcon, RotateCcw, Sparkles } from "lucide-react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { TransactionReviewForm, ParsedTransactionSuggestion } from "@/components/app/assistant/TransactionReviewForm";

type ScanState = "idle" | "captured" | "processing" | "ready" | "error";

export default function AssistantScanPage() {
  const router = useRouter();
  const [state, setState] = useState<ScanState>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ParsedTransactionSuggestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const capture = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        quality: 70,
        width: 1024,
      });
      if (!photo.base64String) return;
      setPhotoBase64(photo.base64String);
      setPhotoDataUrl(`data:image/jpeg;base64,${photo.base64String}`);
      setState("captured");
    } catch {
      // User membatalkan kamera — tetap di state idle, bukan error.
    }
  };

  const process = async () => {
    if (!photoBase64) return;
    setState("processing");
    try {
      const result = await cloudflareApi<{ ok: boolean; suggestion?: ParsedTransactionSuggestion; error?: string }>(
        "/api/member/ai/parse-transaction",
        { method: "POST", json: { imageBase64: photoBase64 } }
      );
      if (result.ok && result.suggestion) {
        setSuggestion(result.suggestion);
        setState("ready");
      } else {
        setErrorMsg(result.error || "AI tidak bisa membaca struk ini.");
        setState("error");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "AI tidak bisa membaca struk ini.");
      setState("error");
    }
  };

  const retake = () => {
    setPhotoDataUrl(null);
    setPhotoBase64(null);
    setState("idle");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-100 bg-white shrink-0">
        <button type="button" onClick={() => router.back()} className="p-1.5 -ml-1.5 text-slate-500">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-sm font-black text-slate-900">AI Scan</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {state === "idle" && (
          <div className="flex flex-col items-center text-center pt-12">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <CameraIcon size={32} />
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-5">Foto Struk / Nota</h2>
            <p className="text-sm font-medium text-slate-400 mt-1.5 max-w-xs">
              AI bakal baca nominal, kategori, dan catatan dari foto struk kamu.
            </p>
            <button
              type="button"
              onClick={capture}
              className="mt-8 w-full max-w-xs py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
            >
              Ambil Foto Struk
            </button>
          </div>
        )}

        {(state === "captured" || state === "processing") && photoDataUrl && (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoDataUrl} alt="Struk" className="w-full max-w-sm rounded-3xl border border-slate-100 shadow-sm" />
            <div className="w-full max-w-sm mt-5 space-y-3">
              <button
                type="button"
                onClick={process}
                disabled={state === "processing"}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                {state === "processing" ? "Memproses..." : "Proses dengan AI"}
              </button>
              <button
                type="button"
                onClick={retake}
                disabled={state === "processing"}
                className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RotateCcw size={14} /> Ambil Ulang
              </button>
            </div>
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
            <button
              type="button"
              onClick={retake}
              className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm"
            >
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
