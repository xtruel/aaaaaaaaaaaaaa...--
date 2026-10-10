// Chiptune sound effects and a small looping soundtrack, all synthesized with WebAudio.

export type SfxName = 'click' | 'hover' | 'build' | 'error' | 'collect' | 'coin' | 'event' | 'alert' | 'done' | 'demolish';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxVolume = 0.6;
  private musicVolume = 0.35;
  private musicTimer = 0;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private lastCollect = 0;

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
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain.connect(this.ctx.destination);
    this.applyVolumes();
    this.startMusic();
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
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume * 0.22;
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
  }

  private noise(dur: number, vol: number, when = 0, out?: GainNode): void {
    const ctx = this.ctx;
    const dest = out ?? this.sfxGain;
    if (!ctx || !dest) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g);
    g.connect(dest);
    src.start(ctx.currentTime + when);
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
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
      case 'collect': {
        const now = this.ctx.currentTime;
        if (now - this.lastCollect < 0.12) return;
        this.lastCollect = now;
        this.tone(1200 + Math.random() * 300, 0.04, 'triangle', 0.06);
        break;
      }
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

  // A 4-bar loop in A minor: Am - F - C - G.
  private startMusic(): void {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    const roots = [220, 174.61, 261.63, 196];
    const arp = [0, 3, 7, 12, 7, 3, 0, 7];
    const major = [0, 4, 7, 12, 7, 4, 0, 7];
    const stepDur = 0.16;
    const tick = () => {
      const ctx = this.ctx;
      if (!ctx || !this.musicGain) return;
      while (this.nextNoteTime < ctx.currentTime + 0.3) {
        const bar = Math.floor(this.stepIndex / 8) % 4;
        const step = this.stepIndex % 8;
        const root = roots[bar];
        const pattern = bar === 0 ? arp : major;
        const when = this.nextNoteTime - ctx.currentTime;
        if (this.musicVolume > 0) {
          const f = root * Math.pow(2, pattern[step] / 12) * 2;
          this.tone(f, stepDur * 0.9, 'square', 0.09, when, 0, this.musicGain);
          if (step % 4 === 0) this.tone(root / 2, stepDur * 3.5, 'triangle', 0.3, when, 0, this.musicGain);
          if (step % 2 === 1) this.noise(0.03, 0.05, when, this.musicGain);
        }
        this.nextNoteTime += stepDur;
        this.stepIndex++;
      }
    };
    this.musicTimer = window.setInterval(tick, 100);
  }

  stop(): void {
    window.clearInterval(this.musicTimer);
  }
}

export const audio = new SoundSystem();
