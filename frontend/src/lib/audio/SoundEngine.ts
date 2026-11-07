/**
 * Web Audio API Procedural Space BGM (4 Random Space Tracks + 1 Combat Track)
 * & Sound Effects (SFX) Synthesizer (`frontend/src/lib/audio/SoundEngine.ts`)
 */
export type BgmMode = 'SPACE' | 'COMBAT';
export type SfxType = 'LASER' | 'EXPLOSION' | 'COLLISION' | 'WARP' | 'AI_AGENT' | 'VICTORY' | 'ALARM';

export interface SpaceTrackSpec {
  id: number;
  name: string;
  tempoMs: number;
  notes: number[];
  wave: OscillatorType;
  subFreq: number;
}

export const SPACE_BGM_TRACKS: SpaceTrackSpec[] = [
  {
    id: 1,
    name: 'Track 1: Nebula Drift',
    tempoMs: 520,
    notes: [220, 277.18, 329.63, 440, 329.63, 277.18, 246.94, 329.63],
    wave: 'sine',
    subFreq: 55,
  },
  {
    id: 2,
    name: 'Track 2: Helios Horizon',
    tempoMs: 480,
    notes: [196, 246.94, 293.66, 392, 329.63, 293.66, 246.94, 196],
    wave: 'triangle',
    subFreq: 49,
  },
  {
    id: 3,
    name: 'Track 3: Cybernetic Trade Winds',
    tempoMs: 360,
    notes: [261.63, 311.13, 392, 523.25, 466.16, 392, 311.13, 261.63],
    wave: 'sine',
    subFreq: 65.41,
  },
  {
    id: 4,
    name: 'Track 4: Echoes of Chronos',
    tempoMs: 560,
    notes: [293.66, 349.23, 440, 587.33, 523.25, 440, 349.23, 293.66],
    wave: 'triangle',
    subFreq: 73.42,
  },
];

const COMBAT_TRACK: SpaceTrackSpec = {
  id: 99,
  name: '⚔️ RED ALERT: Tactical Battle',
  tempoMs: 190,
  notes: [110, 110, 146.83, 110, 164.81, 155.56, 146.83, 130.81],
  wave: 'sawtooth',
  subFreq: 55,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmEnabled = true;
  private sfxEnabled = true;
  private bgmVolume = 0.4;
  private sfxVolume = 0.7;
  private mode: BgmMode = 'SPACE';
  private currentTrack: SpaceTrackSpec = SPACE_BGM_TRACKS[0];
  private stepIdx = 0;
  private stepCountInTrack = 0;
  private timer: any = null;
  private onTrackChange?: (trackName: string) => void;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setOnTrackChange(cb: (name: string) => void) {
    this.onTrackChange = cb;
    cb(this.currentTrack.name);
  }

  public applySettings(settings: {
    bgmEnabled?: boolean;
    sfxEnabled?: boolean;
    bgmVolume?: number;
    sfxVolume?: number;
  }) {
    if (settings.bgmEnabled !== undefined) this.bgmEnabled = settings.bgmEnabled;
    if (settings.sfxEnabled !== undefined) this.sfxEnabled = settings.sfxEnabled;
    if (settings.bgmVolume !== undefined) this.bgmVolume = settings.bgmVolume;
    if (settings.sfxVolume !== undefined) this.sfxVolume = settings.sfxVolume;

    if (!this.bgmEnabled) {
      this.stopBgmLoop();
    } else if (!this.timer) {
      this.startRandomSpaceBgm();
    }
  }

  public startRandomSpaceBgm() {
    this.mode = 'SPACE';
    const randomIdx = Math.floor(Math.random() * SPACE_BGM_TRACKS.length);
    this.currentTrack = SPACE_BGM_TRACKS[randomIdx];
    this.stepIdx = 0;
    this.stepCountInTrack = 0;
    this.onTrackChange?.(this.currentTrack.name);
    this.restartLoop();
  }

  public nextRandomTrack() {
    if (this.mode === 'COMBAT') return;
    const candidates = SPACE_BGM_TRACKS.filter((t) => t.id !== this.currentTrack.id);
    this.currentTrack = candidates[Math.floor(Math.random() * candidates.length)] || SPACE_BGM_TRACKS[0];
    this.stepIdx = 0;
    this.stepCountInTrack = 0;
    this.onTrackChange?.(this.currentTrack.name);
    this.restartLoop();
  }

  public setCombatMode(inCombat: boolean) {
    const targetMode: BgmMode = inCombat ? 'COMBAT' : 'SPACE';
    if (this.mode === targetMode) return;
    this.mode = targetMode;

    if (inCombat) {
      this.currentTrack = COMBAT_TRACK;
      this.stepIdx = 0;
      this.onTrackChange?.(COMBAT_TRACK.name);
      this.playSfx('ALARM');
      this.restartLoop();
    } else {
      this.startRandomSpaceBgm();
    }
  }

  private stopBgmLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restartLoop() {
    this.stopBgmLoop();
    if (!this.bgmEnabled) return;
    this.timer = setInterval(() => this.tickBgmNote(), this.currentTrack.tempoMs);
  }

  private tickBgmNote() {
    if (!this.bgmEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freq = this.currentTrack.notes[this.stepIdx % this.currentTrack.notes.length];
    this.stepIdx++;
    this.stepCountInTrack++;

    // Rotate to another random space track every 32 notes in SPACE mode
    if (this.mode === 'SPACE' && this.stepCountInTrack >= 32) {
      this.nextRandomTrack();
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = this.currentTrack.wave;
    osc.frequency.setValueAtTime(freq, now);

    const vol = Math.max(0.01, this.bgmVolume * (this.mode === 'COMBAT' ? 0.14 : 0.1));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + (this.currentTrack.tempoMs / 1000) * 0.95);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + this.currentTrack.tempoMs / 1000);

    // Sub-bass drone every 4 steps
    if (this.stepIdx % 4 === 1) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(this.currentTrack.subFreq, now);
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(vol * 1.1, now + 0.08);
      subGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.15);
    }
  }

  public playSfx(type: SfxType) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.05, this.sfxVolume * 0.25);

    if (type === 'LASER') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'EXPLOSION' || type === 'COLLISION') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'EXPLOSION' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(type === 'EXPLOSION' ? 130 : 180, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
      gain.gain.setValueAtTime(vol * 1.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'WARP') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(1240, now + 0.65);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.72);
    } else if (type === 'AI_AGENT') {
      for (const [idx, f] of [523.25, 659.25, 783.99].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.09);
        gain.gain.setValueAtTime(vol * 0.8, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.22);
      }
    } else if (type === 'VICTORY') {
      for (const [idx, f] of [440, 554.37, 659.25, 880].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.1);
        gain.gain.setValueAtTime(vol, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      }
    } else if (type === 'ALARM') {
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(620, now + i * 0.18);
        osc.frequency.setValueAtTime(440, now + i * 0.18 + 0.09);
        gain.gain.setValueAtTime(vol, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.17);
      }
    }
  }
}

export const soundEngine = new SoundEngine();
