"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Camera, Sparkles, Loader2, Square, CornerDownLeft, ClipboardPaste, Keyboard } from "lucide-react";
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
  // Cara catat utama dari Pengaturan: 'suara' langsung mendengarkan, 'foto'
  // menampilkan tombol kamera besar (pemilih file butuh ketukan user).
  autoStart?: 'suara' | 'foto' | 'tempel';
  // Teks dari Shortcut iPhone (?teks=, mis. hasil dikte atau isi SMS bank):
  // dibaca AI seperti ucapan, hasilnya tetap dicek user sebelum disimpan.
  initialText?: string;
  /** "tiles": tiga tombol besar Suara / Foto struk / Ketik (sheet Tambah
   * Transaksi app HP). Bawaan: satu bar ketik + ikon mic & kamera. */
  layout?: "bar" | "tiles";
}

type Status = { kind: "idle" } | { kind: "listening" } | { kind: "thinking"; label: string } | { kind: "error"; msg: string };

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;

// Bar "ketik pintar" + mic + kamera. Semua jalur menghasilkan QuickDraft yang
// diisi ke form oleh pemanggil — tidak ada yang langsung tersimpan, user
// selalu melihat & mengonfirmasi dulu.
export function SmartBar({ ctx, onDraft, className, autoStart, initialText, layout = "bar" }: Props) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [canSpeak, setCanSpeak] = useState(false);
  const sessionRef = useRef<SpeechSession | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => { setCanSpeak(speechSupport() !== null); }, []);
  useEffect(() => () => sessionRef.current?.stop(), []);
  const autoStarted = useRef(false);

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
  const finishVoice = async (spoken: string, source: DraftSource = "voice") => {
    sessionRef.current = null;
    const said = spoken.trim();
    if (!said) { setStatus({ kind: "idle" }); return; }
    setText(said);
    setStatus({ kind: "thinking", label: "AI membaca ucapanmu…" });
    const local = parseQuickText(said, ctxRef.current);
    try {
      const ai = await aiParse({ text: said });
      const { confidence, ...fields } = ai;
      onDraft({ ...local, ...defined(fields) }, source, confidence === "low" ? "AI kurang yakin — cek lagi isinya." : undefined);
    } catch {
      onDraft(local, source, "AI sedang tidak tersedia — diisi dari teks saja.");
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

  useEffect(() => {
    if (!initialText || autoStarted.current) return;
    autoStarted.current = true;
    void finishVoice(initialText.slice(0, 500), "text");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  // Tangkapan layar yang disalin Shortcut ke clipboard (butuh ketukan user).
  const pasteImage = async () => {
    lightTap();
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return void onPhoto(new File([await item.getType(type)], "layar.png", { type }));
      }
      setStatus({ kind: "error", msg: "Clipboard tidak berisi gambar. Jalankan lagi shortcut-nya." });
    } catch {
      setStatus({ kind: "error", msg: "Izin membaca clipboard ditolak — pakai tombol kamera untuk memilih gambar." });
    }
  };

  useEffect(() => {
    if (autoStart !== 'suara' || !canSpeak || autoStarted.current) return;
    autoStarted.current = true;
    void toggleMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, canSpeak]);

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

  if (layout === "tiles") {
    const listening = status.kind === "listening";
    const tile = "flex flex-col items-center justify-center gap-2 rounded-[22px] py-5 text-[14px] font-extrabold transition-transform active:scale-[0.97] disabled:opacity-40";
    return (
      <div className={cn("space-y-3", className)}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        {listening || status.kind === "thinking" ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-slate-50 px-4 py-6 text-center dark:bg-slate-800/60">
            {listening ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-label="Berhenti"
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-300/50"
              >
                <span aria-hidden className="absolute inset-0 rounded-full"><span className="mic-wave" /><span className="mic-wave" /></span>
                <Square size={22} fill="currentColor" className="relative" />
              </button>
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Loader2 size={30} className="animate-spin" />
              </span>
            )}
            <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">
              {listening ? "Mendengarkan… ketuk untuk selesai" : status.kind === "thinking" ? status.label : ""}
            </p>
            {text && <p className="max-w-full text-[13px] font-semibold text-slate-500 dark:text-slate-400">&ldquo;{text}&rdquo;</p>}
          </div>
        ) : typing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900">
              <Sparkles size={16} className="shrink-0 text-indigo-500" />
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyText(); } }}
                placeholder="mis. 25rb kopi bca kemarin"
                aria-label="Ketik pintar"
                enterKeyHint="done"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white"
              />
              <button type="button" onClick={applyText} disabled={!text.trim()} className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 text-xs font-black text-white disabled:opacity-40">
                Isi <CornerDownLeft size={13} />
              </button>
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">{c}</span>
                ))}
              </div>
            )}
            <button type="button" onClick={() => { lightTap(); setTyping(false); setText(""); }} className="w-full py-2 text-[12px] font-bold text-slate-400">
              Kembali ke pilihan
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <button type="button" onClick={toggleMic} disabled={!canSpeak} className={cn(tile, "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300")}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white"><Mic size={22} /></span>
                Suara
              </button>
              <button type="button" onClick={() => { lightTap(); fileRef.current?.click(); }} className={cn(tile, "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300")}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white"><Camera size={22} /></span>
                Foto struk
              </button>
              <button type="button" onClick={() => { lightTap(); setTyping(true); }} className={cn(tile, "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white"><Keyboard size={22} /></span>
                Ketik
              </button>
            </div>
            <p className="px-2 text-center text-[12px] font-medium text-slate-400 dark:text-slate-500">
              {canSpeak ? "Contoh: “makan siang 35 ribu pakai BCA”. Hasilnya dicek dulu sebelum disimpan." : "Suara tidak didukung di perangkat ini — pakai foto struk atau ketik."}
            </p>
          </>
        )}
        {status.kind === "error" && <p className="px-1 text-center text-[12px] font-bold text-rose-500">{status.msg}</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {autoStart === "tempel" && status.kind === "idle" && (
        <button
          type="button"
          onClick={() => void pasteImage()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 active:scale-[0.99]"
        >
          <ClipboardPaste size={18} /> Tempel tangkapan layar
        </button>
      )}
      {autoStart === "foto" && status.kind === "idle" && (
        <button
          type="button"
          onClick={() => { lightTap(); fileRef.current?.click(); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 active:scale-[0.99]"
        >
          <Camera size={18} /> Foto struk sekarang
        </button>
      )}
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
                  "relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors disabled:opacity-40",
                  status.kind === "listening" ? "bg-rose-500" : "bg-indigo-600"
                )}
              >
                {status.kind === "listening" && (
                  <span aria-hidden className="absolute inset-0 rounded-xl">
                    <span className="mic-wave" />
                    <span className="mic-wave" />
                  </span>
                )}
                <span className="relative">{status.kind === "listening" ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}</span>
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
