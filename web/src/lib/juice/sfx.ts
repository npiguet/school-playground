// Synthesised WebAudio sound effects (decision 17): no audio files, no external
// requests. Short (<= 600ms), quiet (peak gain 0.25). `unlockAudio` must run from
// a user gesture (iOS Safari requirement); `renderSfx` is the pure scheduling
// function, testable against any `BaseAudioContext` (including a plain stub).
import { audioSettings } from '../audio/store.svelte';

export type Sfx = 'tap' | 'seal' | 'unroll' | 'chime' | 'growth' | 'hmpf' | 'laurel';

type Ctx = BaseAudioContext;

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(
  ctx: Ctx,
  at: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.2,
  glideTo?: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(ctx: Ctx, at: number, dur: number, gain = 0.15) {
  const frameCount = Math.max(1, Math.round(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, at);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
}

export function renderSfx(name: Sfx, ctx: Ctx, at: number): void {
  switch (name) {
    case 'tap':
      tone(ctx, at, 660, 0.06, 'sine', 0.12);
      break;
    case 'seal': // wax crack
      noise(ctx, at, 0.12, 0.2);
      tone(ctx, at + 0.05, 220, 0.18, 'triangle', 0.15, 110);
      break;
    case 'unroll': // paper slide
      noise(ctx, at, 0.35, 0.08);
      tone(ctx, at, 330, 0.35, 'sine', 0.06, 440);
      break;
    case 'chime': // C-E-G
      [523, 659, 784].forEach((f, i) => tone(ctx, at + i * 0.09, f, 0.35, 'sine', 0.18));
      break;
    case 'growth':
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(ctx, at + i * 0.11, f, 0.5, 'triangle', 0.2));
      break;
    case 'hmpf': // Éris, displeased
      tone(ctx, at, 180, 0.22, 'sawtooth', 0.1, 120);
      break;
    case 'laurel':
      [784, 988].forEach((f, i) => tone(ctx, at + i * 0.12, f, 0.3, 'sine', 0.15));
      break;
  }
}

export function playSfx(name: Sfx): void {
  if (audioSettings.sfx.muted || !ctx) return;
  try {
    renderSfx(name, ctx, ctx.currentTime);
  } catch {
    // Ignore - sound is a convenience, never blocking.
  }
}
