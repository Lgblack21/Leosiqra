// Pengenalan suara lintas platform. Plugin @capacitor-community/speech-recognition
// hanya punya implementasi native (di web semua method melempar "not
// implemented"), jadi di browser/PWA pakai Web Speech API bawaan browser
// (Chrome Android, Safari iOS 14.5+). Dipakai Input Cepat & asisten Voice.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';

export interface SpeechCallbacks {
  /** Transkrip sementara/terbaru selama bicara. */
  onPartial: (text: string) => void;
  /** Sesi selesai (berhenti sendiri atau dihentikan) — teks final. */
  onEnd: (text: string) => void;
  onError: (message: string) => void;
}

export interface SpeechSession {
  stop: () => void;
}

interface WebRecognitionResult { 0: { transcript: string }; isFinal: boolean }
interface WebRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<WebRecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type WebRecognitionCtor = new () => WebRecognition;
let activeWebRec: WebRecognition | null = null;

const webCtor = (): WebRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupport = (): 'native' | 'web' | null => {
  if (Capacitor.isNativePlatform()) return 'native';
  return webCtor() ? 'web' : null;
};

const WEB_ERRORS: Record<string, string> = {
  'not-allowed': 'Izin mikrofon ditolak. Aktifkan di pengaturan browser.',
  'service-not-allowed': 'Pengenalan suara tidak diizinkan di mode ini. Coba buka di browser.',
  'no-speech': 'Tidak terdengar suara. Coba lagi lebih dekat ke mikrofon.',
  'audio-capture': 'Mikrofon tidak ditemukan.',
  network: 'Pengenalan suara butuh koneksi internet.',
};

// Pesan error Android (teks dari plugin) → bahasa awam. null = bukan error
// (mis. tidak ada kata yang dikenali) → sesi selesai dengan teks kosong.
const NATIVE_ERRORS: [RegExp, string | null][] = [
  [/no match|didn't understand/i, null],
  [/no speech input/i, 'Tidak terdengar suara. Coba lagi lebih dekat ke mikrofon.'],
  [/permission/i, 'Izin mikrofon dibutuhkan untuk input suara.'],
  [/network/i, 'Pengenalan suara butuh koneksi internet.'],
  [/audio recording/i, 'Mikrofon sedang dipakai aplikasi lain.'],
];
const nativeErrorText = (raw: string): string | null => {
  for (const [re, msg] of NATIVE_ERRORS) if (re.test(raw)) return msg;
  return `Input suara gagal (${raw || 'tidak diketahui'}). Coba lagi.`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const startSpeech = async (cb: SpeechCallbacks, lang = 'id-ID'): Promise<SpeechSession | null> => {
  const support = speechSupport();
  if (!support) {
    cb.onError('Perangkat/browser ini belum mendukung input suara. Pakai ketik pintar saja.');
    return null;
  }

  if (support === 'native') {
    // Plugin @capacitor-community/speech-recognition 7 di Android:
    // - stop() tidak pernah resolve;
    // - dengan partialResults:true, call start() langsung resolve sehingga error
    //   recognizer berikutnya (busy/no match/client error) DIBUANG diam-diam —
    //   di HP terlihat "mic nyala tapi tidak merekam" pada rekaman kedua.
    // Karena itu dipakai mode partialResults:false: start() baru resolve saat
    // hasil final ada (matches) atau reject dengan pesan error, tiap sesi punya
    // promise sendiri. Teks muncul setelah selesai bicara (bukan per kata).
    try {
      const { available } = await NativeSpeech.available();
      if (!available) throw new Error('Perangkat ini tidak mendukung pengenalan suara.');
      const perm = await NativeSpeech.requestPermissions();
      if (perm.speechRecognition !== 'granted') throw new Error('Izin mikrofon dibutuhkan untuk input suara.');
    } catch (e) {
      cb.onError(e instanceof Error ? e.message : 'Gagal memulai input suara.');
      return null;
    }
    let done = false;
    let latest = '';
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    // Pengaman: sesi tidak boleh menggantung lebih dari 30 detik.
    const capTimer = setTimeout(() => {
      NativeSpeech.stop().catch(() => {});
      stopTimer = setTimeout(() => finish(latest), 2500);
    }, 30000);
    const finish = (text: string) => {
      if (done) return;
      done = true;
      clearTimeout(capTimer);
      clearTimeout(stopTimer);
      cb.onEnd(text);
    };
    const fail = (message: string) => {
      if (done) return;
      done = true;
      clearTimeout(capTimer);
      clearTimeout(stopTimer);
      cb.onError(message);
    };
    // Sisa sesi lama (listener/recognizer) dibersihkan dulu; stop() tidak di-await.
    await NativeSpeech.removeAllListeners().catch(() => {});
    NativeSpeech.stop().catch(() => {});
    const run = async (attempt: number): Promise<void> => {
      try {
        const res = await NativeSpeech.start({ language: lang, partialResults: false, popup: false, maxResults: 1 });
        const text = (res?.matches?.[0] ?? '').trim();
        if (text) { latest = text; cb.onPartial(text); }
        finish(text);
      } catch (e) {
        if (done) return;
        const raw = e instanceof Error ? e.message : String(e ?? '');
        // Recognizer Android kadang masih "sibuk" sesaat setelah sesi sebelumnya — coba sekali lagi.
        if (attempt === 0 && /busy|client side/i.test(raw)) { await sleep(450); if (!done) return run(1); return; }
        const msg = nativeErrorText(raw);
        if (msg === null) finish(''); else fail(msg);
      }
    };
    void run(0);
    return {
      stop: () => {
        if (done) return;
        // Android lalu mengirim hasil final lewat promise start(); kalau tidak datang, selesai sendiri.
        NativeSpeech.stop().catch(() => {});
        clearTimeout(stopTimer);
        stopTimer = setTimeout(() => finish(latest), 2500);
      },
    };
  }

  // Web Speech API: hanya boleh ada satu sesi aktif. Sesi lama yang belum
  // benar-benar lepas di-abort dulu; 'aborted' yang bukan karena kita sendiri
  // dilaporkan sebagai error (dulu diabaikan → mic tampak nyala tapi diam).
  if (activeWebRec) { try { activeWebRec.abort(); } catch { /* sudah berhenti */ } activeWebRec = null; }
  const Ctor = webCtor()!;
  const rec = new Ctor();
  activeWebRec = rec;
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  let interim = '';
  let failed = false;
  let stoppedByUs = false;
  let ended = false;
  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    cb.onPartial(`${finalText}${interim}`.trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'aborted' && stoppedByUs) return;
    if (e.error === 'no-speech' && (finalText || interim)) return;
    failed = true;
    cb.onError(e.error === 'aborted' ? 'Mikrofon belum siap. Tekan mic sekali lagi.' : WEB_ERRORS[e.error] ?? `Input suara gagal (${e.error}). Coba lagi.`);
  };
  rec.onend = () => {
    if (ended) return;
    ended = true;
    if (activeWebRec === rec) activeWebRec = null;
    if (!failed) cb.onEnd(`${finalText}${interim}`.trim());
  };
  try {
    rec.start();
  } catch {
    if (activeWebRec === rec) activeWebRec = null;
    cb.onError('Gagal memulai input suara.');
    return null;
  }
  return { stop: () => { stoppedByUs = true; try { rec.stop(); } catch { /* sudah berhenti */ } } };
};
