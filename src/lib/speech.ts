// Pengenalan suara lintas platform. Plugin @capacitor-community/speech-recognition
// hanya punya implementasi native (di web semua method melempar "not
// implemented"), jadi di browser/PWA pakai Web Speech API bawaan browser
// (Chrome Android, Safari iOS 14.5+). Dipakai Input Cepat & asisten Voice.
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
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

// Batas waktu sesi native (ms): tanpa suara/aktivitas, total maksimal, dan
// jeda menunggu hasil final setelah recognizer berhenti.
const NATIVE_IDLE_MS = 8000;
const NATIVE_MAX_MS = 60000;
const NATIVE_GRACE_MS = 800;

export const startSpeech = async (cb: SpeechCallbacks, lang = 'id-ID'): Promise<SpeechSession | null> => {
  const support = speechSupport();
  if (!support) {
    cb.onError('Perangkat/browser ini belum mendukung input suara. Pakai ketik pintar saja.');
    return null;
  }

  if (support === 'native') {
    // Plugin v7 di Android: stop() TIDAK pernah resolve (call.resolve tidak
    // dipanggil di Java) dan error setelah start (mis. tidak ada suara) tidak
    // sampai ke JS karena call start sudah resolve. Jadi akhir sesi jangan
    // ditunggu dari promise stop() — pakai event 'listeningState' + timer
    // pengaman, dan pastikan onEnd terpanggil tepat sekali.
    let latest = '';
    let done = false;
    let started = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let capTimer: ReturnType<typeof setTimeout> | undefined;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const handles: PluginListenerHandle[] = [];
    // Lepas listener milik sesi ini saja — removeAllListeners() di akhir sesi
    // bisa ikut mencabut listener sesi baru yang sudah dimulai.
    const removeOwnListeners = () => {
      handles.splice(0).forEach((h) => { h.remove().catch(() => {}); });
    };
    const clearTimers = () => {
      clearTimeout(idleTimer);
      clearTimeout(capTimer);
      clearTimeout(graceTimer);
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      removeOwnListeners();
      cb.onEnd(latest);
    };
    // Hasil final Android datang lewat 'partialResults' sesaat SETELAH
    // 'stopped', jadi beri jeda singkat sebelum menutup sesi.
    const finishSoon = (ms: number) => {
      if (done) return;
      clearTimeout(graceTimer);
      graceTimer = setTimeout(finish, ms);
    };
    const bumpIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        NativeSpeech.stop().catch(() => {});
        finishSoon(NATIVE_GRACE_MS);
      }, NATIVE_IDLE_MS);
    };
    try {
      const { available } = await NativeSpeech.available();
      if (!available) throw new Error('Perangkat ini tidak mendukung pengenalan suara.');
      const perm = await NativeSpeech.requestPermissions();
      if (perm.speechRecognition !== 'granted') throw new Error('Izin mikrofon dibutuhkan untuk input suara.');
      // Bersihkan sisa sesi sebelumnya (listener lama / recognizer yang masih
      // jalan). stop() sengaja tidak di-await — di Android tidak pernah resolve.
      await NativeSpeech.removeAllListeners().catch(() => {});
      NativeSpeech.stop().catch(() => {});
      handles.push(await NativeSpeech.addListener('partialResults', (data: { matches?: string[] }) => {
        if (done) return;
        const text = data.matches?.[0];
        if (text) { latest = text; cb.onPartial(text); }
        bumpIdle();
      }));
      handles.push(await NativeSpeech.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
        if (done) return;
        // 'stopped' hanya berarti kalau sesi INI sudah 'started' — abaikan
        // event susulan dari stop() pembersih di atas.
        if (data.status === 'started') { started = true; bumpIdle(); }
        else if (started) finishSoon(NATIVE_GRACE_MS);
      }));
      bumpIdle();
      capTimer = setTimeout(() => {
        NativeSpeech.stop().catch(() => {});
        finishSoon(NATIVE_GRACE_MS);
      }, NATIVE_MAX_MS);
      await NativeSpeech.start({ language: lang, partialResults: true, popup: false });
    } catch (e) {
      done = true;
      clearTimers();
      removeOwnListeners();
      cb.onError(e instanceof Error ? e.message : 'Gagal memulai input suara.');
      return null;
    }
    return {
      stop: () => {
        if (done) return;
        NativeSpeech.stop().catch(() => {});
        finishSoon(NATIVE_GRACE_MS);
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
