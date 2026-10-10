// Chiptune sound effects and the soundtrack (see music.ts), all synthesized with WebAudio.
import { SONGS, hits, midiFreq, noteMidi, parseBar, relativePitch } from './music';
import type { Song, SongId } from './music';

interface MusicPlayer {
  song: Song;
  bus: GainNode;
  echo: DelayNode;
  bar: number;
  step: number;
  next: number; // audio time of the next step
}

export type SfxName = 'click' | 'hover' | 'build' | 'error' | 'collect' | 'coin' | 'event' | 'alert' | 'done' | 'demolish';

const MAX_VOICES = 18;
// shortest gap between two plays of the same effect, in seconds
const MIN_GAP: Partial<Record<SfxName, number>> = { hover: 0.04, click: 0.03, collect: 0.12, coin: 0.15, build: 0.08, done: 0.2, demolish: 0.15, alert: 0.5, event: 0.3, error: 0.12 };

class SoundSystem {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxVolume = 0.6;
  private musicVolume = 0.35;
  private musicTimer = 0;
  private songId: SongId | null = 'menu';
  private player: MusicPlayer | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private pulse12: PeriodicWave | null = null;
  private pulse25: PeriodicWave | null = null;
  // a cap on simultaneous effect voices, and a minimum gap per effect, so a busy city never turns into noise
  private voices = 0;
  private lastPlayed: Partial<Record<SfxName, number>> = {};

  // Browsers only allow audio after a user gesture, so this runs on the first click.
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    // master limiter: many effects at once never clip
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(this.ctx.destination);
    this.sfxGain.connect(limiter);
    this.musicGain.connect(limiter);
    this.applyVolumes();
    // one second of noise, shared by every drum hit
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.pulse12 = this.pulseWave(0.125);
    this.pulse25 = this.pulseWave(0.25);
    this.switchSong();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume * 0.5;
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume * 0.45;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slide = 0, out?: GainNode): void {
    const ctx = this.ctx;
    const dest = out ?? this.sfxGain;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    if (!out) {
      this.voices++;
      osc.onended = () => {
        this.voices--;
        osc.disconnect();
        g.disconnect();
      };
    }
  }

  private noise(dur: number, vol: number, when = 0, out?: GainNode): void {
    const ctx = this.ctx;
    const dest = out ?? this.sfxGain;
    if (!ctx || !dest || !this.noiseBuf) return;
    // the shared second of noise, faded out by a gain envelope (no new buffer per hit)
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = this.noiseBuf;
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.01);
    if (!out) {
      this.voices++;
      src.onended = () => {
        this.voices--;
        src.disconnect();
        g.disconnect();
      };
    }
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.05;
    if (now - (this.lastPlayed[name] ?? -1) < gap) return;
    // keep room for the sounds that matter when the voice budget is full
    if (this.voices > MAX_VOICES && name !== 'alert' && name !== 'event' && name !== 'error') return;
    this.lastPlayed[name] = now;
    switch (name) {
      case 'hover':
        this.tone(880, 0.04, 'square', 0.05);
        break;
      case 'click':
        this.tone(660, 0.06, 'square', 0.12);
        this.tone(990, 0.06, 'square', 0.08, 0.04);
        break;
      case 'build':
        this.tone(220, 0.12, 'square', 0.15, 0, 220);
        this.noise(0.12, 0.12, 0.05);
        break;
      case 'error':
        this.tone(160, 0.18, 'sawtooth', 0.12, 0, -60);
        break;
      case 'collect':
        this.tone(1200 + Math.random() * 300, 0.04, 'triangle', 0.06);
        break;
      case 'coin':
        this.tone(988, 0.07, 'square', 0.08);
        this.tone(1319, 0.12, 'square', 0.08, 0.07);
        break;
      case 'event':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, i * 0.08));
        break;
      case 'alert':
        this.tone(440, 0.2, 'sawtooth', 0.12);
        this.tone(330, 0.25, 'sawtooth', 0.12, 0.22);
        break;
      case 'done':
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.14, i * 0.07));
        break;
      case 'demolish':
        this.noise(0.3, 0.2);
        this.tone(120, 0.3, 'square', 0.1, 0, -60);
        break;
    }
  }

  // ---------- music ----------

  // Which song should play; it starts (or cross-fades in) as soon as audio is unlocked.
  setMusic(id: SongId | null): void {
    if (id === this.songId) return;
    this.songId = id;
    if (this.ctx) this.switchSong();
  }

  private pulseWave(duty: number): PeriodicWave | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(real, imag);
  }

  private switchSong(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const now = ctx.currentTime;
    // the old song fades out over its last scheduled notes
    if (this.player) {
      const old = this.player;
      old.bus.gain.cancelScheduledValues(now);
      old.bus.gain.setValueAtTime(old.bus.gain.value, now);
      old.bus.gain.linearRampToValueAtTime(0, now + 1.5);
      window.setTimeout(() => old.bus.disconnect(), 2500);
      this.player = null;
    }
    if (!this.songId) return;
    const song = SONGS[this.songId];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + 1.5);
    bus.connect(this.musicGain);
    // a little echo on the lead gives the chiptune some room
    const echo = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    echo.delayTime.value = (60 / song.bpm) * 0.75;
    feedback.gain.value = 0.3;
    wet.gain.value = song.lead.echo;
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(bus);
    this.player = { song, bus, echo, bar: 0, step: 0, next: now + 0.12 };
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const p = this.player;
    if (!ctx || !p) return;
    const stepDur = 60 / p.song.bpm / 4;
    const bars = p.song.sections.reduce((n, sec) => n + sec.lead.length, 0);
    while (p.next < ctx.currentTime + 0.25) {
      if (p.step === 0) this.scheduleBar(p, p.next, stepDur);
      p.next += stepDur;
      p.step++;
      if (p.step === 16) {
        p.step = 0;
        p.bar = (p.bar + 1) % bars;
      }
    }
  }

  // Schedules one whole bar: lead, bass, arpeggio and drums.
  private scheduleBar(p: MusicPlayer, t0: number, stepDur: number): void {
    let bar = p.bar;
    const section = p.song.sections.find((sec) => {
      if (bar < sec.lead.length) return true;
      bar -= sec.lead.length;
      return false;
    })!;
    const chord = section.chords[bar];
    const at = (step: number) => t0 + step * stepDur;
    const lead = p.song.lead;
    const wave = lead.wave === 'triangle' ? 'triangle' : lead.wave === 'pulse12' ? this.pulse12 : this.pulse25;
    for (const n of parseBar(section.lead[bar], noteMidi)) {
      this.voice(midiFreq(n.midi), at(n.step), n.len * stepDur, wave, lead.vol, p.bus, p.echo, n.len >= 4);
    }
    for (const n of parseBar(section.bass, relativePitch(chord, 36))) {
      this.voice(midiFreq(n.midi), at(n.step), n.len * stepDur, 'triangle', 0.32, p.bus);
    }
    if (section.arp) {
      for (const n of parseBar(section.arp, relativePitch(chord, 60))) {
        this.voice(midiFreq(n.midi), at(n.step), stepDur * 0.9, this.pulse12, 0.035, p.bus);
      }
    }
    for (const step of hits(section.kick)) this.kick(at(step), p.bus);
    for (const step of hits(section.snare)) this.snare(at(step), p.bus);
    for (const step of hits(section.hat)) this.hat(at(step), p.bus);
  }

  private voice(
    freq: number,
    when: number,
    dur: number,
    wave: OscillatorType | PeriodicWave | null,
    vol: number,
    out: AudioNode,
    send?: AudioNode,
    vibrato = false,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !wave) return;
    const osc = ctx.createOscillator();
    // PeriodicWave is an empty interface in the DOM types, so typeof cannot tell them apart
    if (typeof wave === 'string') osc.type = wave as OscillatorType;
    else osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(freq, when);
    const g = ctx.createGain();
    const end = when + Math.max(0.05, dur - 0.01);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.setValueAtTime(vol * 0.75, when + Math.min(0.08, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
    if (vibrato) {
      // long notes get a gentle, late vibrato
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, when);
      depth.gain.linearRampToValueAtTime(freq * 0.006, when + Math.min(0.4, dur * 0.6));
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(when);
      lfo.stop(end + 0.1);
    }
    osc.connect(g);
    g.connect(out);
    if (send) g.connect(send);
    osc.start(when);
    osc.stop(end + 0.1);
  }

  private noiseHit(when: number, dur: number, vol: number, out: AudioNode, filter: BiquadFilterType, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(when, Math.random() * 0.5);
    src.stop(when + dur + 0.02);
  }

  private kick(when: number, out: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.55, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    osc.connect(g);
    g.connect(out);
    osc.start(when);
    osc.stop(when + 0.2);
  }

  private snare(when: number, out: AudioNode): void {
    this.noiseHit(when, 0.12, 0.22, out, 'bandpass', 1900);
    this.voice(185, when, 0.05, 'triangle', 0.18, out);
  }

  private hat(when: number, out: AudioNode): void {
    this.noiseHit(when, 0.035, 0.08, out, 'highpass', 7000);
  }

  stop(): void {
    window.clearInterval(this.musicTimer);
  }
}

export const audio = new SoundSystem();
