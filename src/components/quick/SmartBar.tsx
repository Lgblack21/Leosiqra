"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Camera, Sparkles, Loader2, Square, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { parseQuickText, type ParseContext, type QuickDraft } from "@/lib/quick/parse";
import { aiParse, imageFileToBase64 } from "@/lib/quick/ai";
import { startSpeech, speechSupport, type SpeechSession } from "@/lib/speech";

export type DraftSource = "text" | "voice" | "scan";

interface Props {
  ctx: ParseContext;
  onDraft: (draft: QuickDraft, source: DraftSource, info?: string) => void;
  className?: string;
}

type Status = { kind: "idle" } | { kind: "listening" } | { kind: "thinking"; label: string } | { kind: "error"; msg: string };

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;

// Bar "ketik pintar" + mic + kamera. Semua jalur menghasilkan QuickDraft yang
// diisi ke form oleh pemanggil — tidak ada yang langsung tersimpan, user
// selalu melihat & mengonfirmasi dulu.
export function SmartBar({ ctx, onDraft, className }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [canSpeak, setCanSpeak] = useState(false);
  const sessionRef = useRef<SpeechSession | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => { setCanSpeak(speechSupport() !== null); }, []);
  useEffect(() => () => sessionRef.current?.stop(), []);

  const preview = useMemo(() => (text.trim() ? parseQuickText(text, ctx) : null), [text, ctx]);
  const accountName = (id?: string) => ctx.accounts.find((a) => a.id === id)?.name;
  const busy = status.kind === "listening" || status.kind === "thinking";

  const applyText = () => {
    if (!text.trim() || busy) return;
    lightTap();
    onDraft(parseQuickText(text, ctx), "text");
    setText("");
  };

  // Suara: AI dulu (paham kalimat bebas), parser lokal melengkapi field yang
  // kosong — dan jadi cadangan penuh kalau AI gagal/limit/offline.
  const finishVoice = async (spoken: string) => {
    sessionRef.current = null;
    const said = spoken.trim();
    if (!said) { setStatus({ kind: "idle" }); return; }
    setText(said);
    setStatus({ kind: "thinking", label: "AI membaca ucapanmu…" });
    const local = parseQuickText(said, ctxRef.current);
    try {
      const ai = await aiParse({ text: said });
      const { confidence, ...fields } = ai;
      onDraft({ ...local, ...defined(fields) }, "voice", confidence === "low" ? "AI kurang yakin — cek lagi isinya." : undefined);
    } catch {
      onDraft(local, "voice", "AI sedang tidak tersedia — diisi dari teks ucapan.");
    }
    setText("");
    setStatus({ kind: "idle" });
  };

  const toggleMic = async () => {
    lightTap();
    if (status.kind === "listening") { sessionRef.current?.stop(); return; }
    if (busy) return;
    setText("");
    setStatus({ kind: "listening" });
    const session = await startSpeech({
      onPartial: (t) => setText(t),
      onEnd: (t) => { void finishVoice(t); },
      onError: (msg) => { sessionRef.current = null; setStatus({ kind: "error", msg }); },
    });
    if (session) sessionRef.current = session;
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: "thinking", label: "AI membaca struk…" });
    try {
      const imageBase64 = await imageFileToBase64(file);
      const ai = await aiParse({ imageBase64 });
      const { confidence, ...fields } = ai;
      onDraft(defined(fields), "scan", confidence === "low" ? "Struk kurang jelas — cek lagi nominal & kategorinya." : undefined);
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error && e.message ? e.message : "Gagal membaca struk." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const chips = preview
    ? [
        preview.amount ? new Intl.NumberFormat("id-ID").format(preview.amount) : null,
        preview.type === "pemasukan" ? "Pemasukan" : preview.type === "pengeluaran" ? "Pengeluaran" : null,
        preview.category ? `${preview.category}${preview.subCategory ? ` › ${preview.subCategory}` : ""}` : null,
        accountName(preview.accountId) ?? null,
        preview.date ? (preview.date === ctx.today ? null : preview.date.split("-").reverse().slice(0, 2).join("/")) : null,
      ].filter(Boolean) as string[]
    : [];

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-white dark:bg-slate-900 pl-4 pr-1.5 py-1.5 transition-colors",
          status.kind === "listening" ? "border-rose-300 ring-4 ring-rose-500/10" : "border-slate-200 dark:border-slate-700 focus-within:border-indigo-400"
        )}
      >
        <Sparkles size={16} className="shrink-0 text-indigo-500" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyText(); } }}
          readOnly={busy}
          placeholder={status.kind === "listening" ? "Mendengarkan… bicara sekarang" : "Ketik: 25rb kopi bca kemarin"}
          aria-label="Ketik pintar"
          enterKeyHint="done"
          className="flex-1 min-w-0 bg-transparent py-2 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-medium outline-none"
        />
        {text.trim() && !busy ? (
          <button type="button" onClick={applyText} aria-label="Isi form" className="shrink-0 h-10 px-3 rounded-xl bg-indigo-600 text-white flex items-center gap-1 text-xs font-black">
            Isi <CornerDownLeft size={13} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { lightTap(); fileRef.current?.click(); }}
              disabled={busy}
              aria-label="Scan struk"
              className="shrink-0 w-10 h-10 rounded-xl text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-40"
            >
              <Camera size={18} />
            </button>
            {canSpeak && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={status.kind === "thinking"}
                aria-label={status.kind === "listening" ? "Berhenti" : "Input suara"}
                className={cn(
                  "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors disabled:opacity-40",
                  status.kind === "listening" ? "bg-rose-500 animate-pulse" : "bg-indigo-600"
                )}
              >
                {status.kind === "listening" ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
              </button>
            )}
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>

      {status.kind === "thinking" && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
          <Loader2 size={12} className="animate-spin" /> {status.label}
        </p>
      )}
      {status.kind === "error" && <p className="px-1 text-[11px] font-bold text-rose-500">{status.msg}</p>}
      {status.kind === "idle" && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black text-indigo-600 dark:text-indigo-300">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}
