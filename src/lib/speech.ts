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
}
type WebRecognitionCtor = new () => WebRecognition;

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

export const startSpeech = async (cb: SpeechCallbacks, lang = 'id-ID'): Promise<SpeechSession | null> => {
  const support = speechSupport();
  if (!support) {
    cb.onError('Perangkat/browser ini belum mendukung input suara. Pakai ketik pintar saja.');
    return null;
  }

  if (support === 'native') {
    let latest = '';
    try {
      const { available } = await NativeSpeech.available();
      if (!available) throw new Error('Perangkat ini tidak mendukung pengenalan suara.');
      const perm = await NativeSpeech.requestPermissions();
      if (perm.speechRecognition !== 'granted') throw new Error('Izin mikrofon dibutuhkan untuk input suara.');
      await NativeSpeech.addListener('partialResults', (data: { matches?: string[] }) => {
        const text = data.matches?.[0];
        if (text) { latest = text; cb.onPartial(text); }
      });
      await NativeSpeech.start({ language: lang, partialResults: true, popup: false });
    } catch (e) {
      cb.onError(e instanceof Error ? e.message : 'Gagal memulai input suara.');
      return null;
    }
    return {
      stop: () => {
        NativeSpeech.stop()
          .catch(() => {})
          .finally(() => {
            NativeSpeech.removeAllListeners().catch(() => {});
            cb.onEnd(latest);
          });
      },
    };
  }

  const Ctor = webCtor()!;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  let interim = '';
  let failed = false;
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
    if (e.error === 'aborted') return;
    failed = true;
    cb.onError(WEB_ERRORS[e.error] ?? 'Input suara gagal. Coba lagi.');
  };
  rec.onend = () => {
    if (!failed) cb.onEnd(`${finalText}${interim}`.trim());
  };
  try {
    rec.start();
  } catch {
    cb.onError('Gagal memulai input suara.');
    return null;
  }
  return { stop: () => rec.stop() };
};
