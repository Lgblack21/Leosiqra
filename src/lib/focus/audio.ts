"use client";

// Musik & suasana untuk "Fokus bareng Leo" — DIBUAT LANGSUNG di browser (Web Audio),
// bukan file lagu: 100% bebas royalti, tanpa unduhan, tanpa server.
//   lofi  : piano elektrik (akor jazz ii–V–I), bass, drum lembut ber-swing, desis piringan hitam
//   hujan : rintik (noise tersaring) + tetes acak + gemuruh rendah
//   ombak : brown noise dengan naik-turun pelan seperti ombak
//   noise : brown noise lembut (penutup suara sekitar)
// Browser hanya mengizinkan suara setelah ada sentuhan/klik → play() dipanggil dari tombol.

export type FocusTrack = "lofi" | "hujan" | "ombak" | "noise";
export const FOCUS_TRACKS: { id: FocusTrack; label: string; desc: string; emoji: string }[] = [
  { id: "lofi", label: "Lo-fi", desc: "Piano santai & beat pelan", emoji: "🎹" },
  { id: "hujan", label: "Hujan", desc: "Rintik hujan di jendela", emoji: "🌧️" },
  { id: "ombak", label: "Ombak", desc: "Deburan pantai pelan", emoji: "🌊" },
  { id: "noise", label: "Noise", desc: "Brown noise penutup bising", emoji: "🌫️" },
];

type Stopper = () => void;
type Listener = () => void;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Progresi 8 birama (Dm9–G13–Cmaj9–Am9 / Fmaj9–Em7–Dm9–G13), voicing di oktaf tengah.
const PROGRESSION: { root: number; notes: number[] }[] = [
  { root: 38, notes: [53, 57, 60, 64] }, // Dm9
  { root: 43, notes: [53, 59, 64, 65] }, // G13
  { root: 36, notes: [52, 55, 59, 62] }, // Cmaj9
  { root: 45, notes: [55, 60, 64, 67] }, // Am9
  { root: 41, notes: [52, 57, 60, 64] }, // Fmaj9
  { root: 40, notes: [50, 55, 59, 62] }, // Em7
  { root: 38, notes: [53, 57, 60, 64] }, // Dm9
  { root: 43, notes: [53, 59, 64, 65] }, // G13
];
const PENTA = [69, 72, 74, 76, 79, 81]; // melodi tipis di atas akor (A minor pentatonik)

class FocusAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopTrack: Stopper | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private brownBuf: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private chimeTimers = new Set<ReturnType<typeof setTimeout>>();
  private _track: FocusTrack | null = null;
  private _volume = 0.6;

  get track() { return this._track; }
  get playing() { return this._track !== null; }
  get volume() { return this._volume; }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((fn) => fn()); }

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private noise(ctx: AudioContext) {
    if (!this.noiseBuf) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    return this.noiseBuf;
  }
  private brown(ctx: AudioContext) {
    if (!this.brownBuf) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
      this.brownBuf = b;
    }
    return this.brownBuf;
  }
  private loopSource(ctx: AudioContext, buf: AudioBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    // Mulai dari titik acak supaya sambungan loop tidak terdengar berulang.
    src.start(ctx.currentTime, Math.random() * buf.duration);
    return src;
  }

  /** Mulai (atau ganti) suasana. Harus dipanggil dari sentuhan/klik pertama kali. */
  play(track: FocusTrack, volume = this._volume) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._track === track && this.stopTrack) {
      this.setVolume(this._volume);
      return;
    }
    this.fadeOutCurrent();
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    bus.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    const stop = track === "lofi" ? this.lofi(ctx, bus) : track === "hujan" ? this.rain(ctx, bus) : track === "ombak" ? this.waves(ctx, bus) : this.brownNoise(ctx, bus);
    this.stopTrack = () => {
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => { stop(); bus.disconnect(); }, 900);
    };
    this._track = track;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.curve(this._volume), ctx.currentTime, 0.3);
    this.emit();
  }

  private fadeOutCurrent() {
    if (this.stopTrack) {
      this.stopTrack();
      this.stopTrack = null;
    }
  }

  stop() {
    this.fadeOutCurrent();
    this._track = null;
    this.emit();
  }

  private curve = (v: number) => Math.pow(v, 1.6) * 0.9;
  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master && this._track) this.master.gain.setTargetAtTime(this.curve(this._volume), this.ctx.currentTime, 0.15);
    this.emit();
  }

  /** Bunyi lonceng lembut (akhir sesi). delaySec > 0 = dijadwalkan (tetap tepat waktu walau tab di belakang). */
  chime(delaySec = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = ctx.createGain();
    out.gain.value = 0.32;
    out.connect(ctx.destination);
    const t0 = ctx.currentTime + Math.max(0, delaySec);
    [[76, 0], [83, 0.32], [88, 0.64]].forEach(([n, d]) => {
      [1, 2.76, 5.4].forEach((ratio, k) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = midi(n) * ratio;
        g.gain.setValueAtTime(0, t0 + d);
        g.gain.linearRampToValueAtTime(0.35 / (k + 1), t0 + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 2.4 / (k + 1));
        o.connect(g).connect(out);
        o.start(t0 + d);
        o.stop(t0 + d + 2.6);
      });
    });
    const timer = setTimeout(() => { out.disconnect(); this.chimeTimers.delete(timer); }, (delaySec + 4) * 1000);
    this.chimeTimers.add(timer);
    return () => { clearTimeout(timer); this.chimeTimers.delete(timer); out.disconnect(); };
  }

  // ── Lo-fi ────────────────────────────────────────────────────────────────
  private lofi(ctx: AudioContext, bus: GainNode): Stopper {
    const bpm = 72;
    const beat = 60 / bpm;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    tone.Q.value = 0.4;
    tone.connect(bus);
    // Wow & flutter: cutoff bergoyang pelan seperti kaset.
    const wobble = ctx.createOscillator();
    const wobbleAmt = ctx.createGain();
    wobble.frequency.value = 0.18;
    wobbleAmt.gain.value = 350;
    wobble.connect(wobbleAmt).connect(tone.frequency);
    wobble.start();

    // Desis & klik piringan hitam.
    const hiss = this.loopSource(ctx, this.noise(ctx));
    const hissF = ctx.createBiquadFilter();
    hissF.type = "bandpass";
    hissF.frequency.value = 5000;
    hissF.Q.value = 0.6;
    const hissG = ctx.createGain();
    hissG.gain.value = 0.012;
    hiss.connect(hissF).connect(hissG).connect(bus);

    const ep = (freq: number, t: number, dur: number, vel: number) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.015);
      g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      const c = ctx.createOscillator();
      const cg = ctx.createGain();
      a.type = "sine"; a.frequency.value = freq;
      b.type = "triangle"; b.frequency.value = freq; b.detune.value = 6;
      c.type = "sine"; c.frequency.value = freq * 2; cg.gain.value = 0.18;
      a.connect(g); b.connect(g); c.connect(cg).connect(g);
      g.connect(tone);
      [a, b, c].forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
    };
    const bass = (freq: number, t: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const kick = (t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.35);
    };
    const noiseHit = (t: number, freq: number, dur: number, vol: number, type: BiquadFilterType) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise(ctx);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus);
      s.start(t, Math.random());
      s.stop(t + dur + 0.02);
    };

    let bar = 0;
    let next = ctx.currentTime + 0.15;
    const scheduleBar = (t: number) => {
      const chord = PROGRESSION[bar % PROGRESSION.length];
      // Akor dipetik sedikit berurutan (strum) supaya terdengar dimainkan manusia.
      chord.notes.forEach((n, i) => ep(midi(n), t + i * 0.025 + Math.random() * 0.01, beat * 3.6, 0.07));
      if (Math.random() < 0.5) chord.notes.forEach((n, i) => ep(midi(n), t + beat * 2.5 + i * 0.02, beat * 1.4, 0.045));
      bass(midi(chord.root), t, beat * 1.8);
      bass(midi(chord.root + (Math.random() < 0.5 ? 7 : 12)), t + beat * 2, beat * 1.6);
      // Melodi tipis, tidak selalu ada.
      if (bar % 2 === 1 && Math.random() < 0.7) {
        const steps = [0.5, 1.5, 2, 3].filter(() => Math.random() < 0.55);
        steps.forEach((s) => ep(midi(PENTA[Math.floor(Math.random() * PENTA.length)]), t + s * beat, beat * 1.2, 0.035));
      }
      // Drum: kick 1 & 3 (kadang 3+), snare/clap 2 & 4, hat 8-an ber-swing.
      kick(t);
      kick(t + beat * 2.5 * (Math.random() < 0.35 ? 1 : 0.8));
      noiseHit(t + beat, 1800, 0.18, 0.12, "bandpass");
      noiseHit(t + beat * 3, 1800, 0.18, 0.12, "bandpass");
      for (let i = 0; i < 8; i++) {
        const swing = i % 2 ? beat * 0.08 : 0;
        noiseHit(t + i * (beat / 2) + swing, 8000, 0.035, i % 2 ? 0.025 : 0.04, "highpass");
      }
      // Klik piringan hitam sesekali.
      for (let i = 0; i < 3; i++) if (Math.random() < 0.6) noiseHit(t + Math.random() * beat * 4, 3000, 0.006, 0.06, "highpass");
      bar += 1;
    };
    const tick = () => {
      // Tab di belakang: setInterval diperlambat browser → jadwalkan lebih jauh ke depan.
      const ahead = typeof document !== "undefined" && document.hidden ? 3 : 0.4;
      while (next < ctx.currentTime + ahead) {
        scheduleBar(next);
        next += beat * 4;
      }
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => {
      clearInterval(iv);
      try { wobble.stop(); hiss.stop(); } catch { /* sudah berhenti */ }
      tone.disconnect();
      hissG.disconnect();
    };
  }

  // ── Hujan ────────────────────────────────────────────────────────────────
  private rain(ctx: AudioContext, bus: GainNode): Stopper {
    const src = this.loopSource(ctx, this.noise(ctx));
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    src.connect(hp).connect(lp).connect(g).connect(bus);
    // Gemuruh rendah.
    const rumble = this.loopSource(ctx, this.brown(ctx));
    const rl = ctx.createBiquadFilter();
    rl.type = "lowpass";
    rl.frequency.value = 180;
    const rg = ctx.createGain();
    rg.gain.value = 0.35;
    rumble.connect(rl).connect(rg).connect(bus);
    // Intensitas naik-turun pelan.
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    // Tetes di kaca: semburan noise pendek dengan nada acak.
    let next = ctx.currentTime;
    const drop = (t: number) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise(ctx);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800 + Math.random() * 3500;
      f.Q.value = 8;
      const dg = ctx.createGain();
      const v = 0.05 + Math.random() * 0.12;
      dg.gain.setValueAtTime(v, t);
      dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
      s.connect(f).connect(dg).connect(bus);
      s.start(t, Math.random());
      s.stop(t + 0.15);
    };
    const tick = () => {
      const ahead = typeof document !== "undefined" && document.hidden ? 3 : 0.4;
      while (next < ctx.currentTime + ahead) {
        drop(next);
        next += -Math.log(1 - Math.random()) / 9; // ~9 tetes/detik, acak (Poisson)
      }
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => {
      clearInterval(iv);
      try { src.stop(); rumble.stop(); lfo.stop(); } catch { /* sudah berhenti */ }
      g.disconnect();
      rg.disconnect();
    };
  }

  // ── Ombak ────────────────────────────────────────────────────────────────
  private waves(ctx: AudioContext, bus: GainNode): Stopper {
    const src = this.loopSource(ctx, this.brown(ctx));
    const spray = this.loopSource(ctx, this.noise(ctx));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.34;
    src.connect(lp).connect(g).connect(bus);
    const sf = ctx.createBiquadFilter();
    sf.type = "bandpass";
    sf.frequency.value = 2500;
    sf.Q.value = 0.5;
    const sg = ctx.createGain();
    sg.gain.value = 0.026;
    spray.connect(sf).connect(sg).connect(bus);
    // Dua LFO lambat berbeda periode → ombak tidak terdengar seragam.
    const mk = (hz: number, amt: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      const a = ctx.createGain();
      o.frequency.value = hz;
      a.gain.value = amt;
      o.connect(a).connect(target);
      o.start();
      return o;
    };
    const l1 = mk(0.075, 0.22, g.gain);
    const l2 = mk(0.031, 0.1, g.gain);
    const l3 = mk(0.075, 500, lp.frequency);
    const l4 = mk(0.075, 0.025, sg.gain);
    return () => {
      [src, spray, l1, l2, l3, l4].forEach((n) => { try { n.stop(); } catch { /* sudah berhenti */ } });
      g.disconnect();
      sg.disconnect();
    };
  }

  // ── Brown noise ──────────────────────────────────────────────────────────
  private brownNoise(ctx: AudioContext, bus: GainNode): Stopper {
    const src = this.loopSource(ctx, this.brown(ctx));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.55;
    src.connect(lp).connect(g).connect(bus);
    return () => {
      try { src.stop(); } catch { /* sudah berhenti */ }
      g.disconnect();
    };
  }
}

// Satu mesin untuk seluruh aplikasi (pindah tab Fokus/Tenang/Rekap tidak memutus musik).
export const focusAudio = new FocusAudioEngine();
