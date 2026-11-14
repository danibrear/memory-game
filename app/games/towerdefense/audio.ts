// ─── Tower Defense: tiny WebAudio synth for sound effects ─────────────────────
// No audio files needed: every effect is synthesised on the fly.

import type { Sfx } from "./engine";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayed: Partial<Record<Sfx, number>> = {};

/** Minimum gap between repeats of the same sound so big fights don't get noisy. */
const MIN_GAP: Partial<Record<Sfx, number>> = {
  blaster: 0.07,
  frost: 0.09,
  tesla: 0.08,
  sniper: 0.05,
  bomb: 0.08,
  boom: 0.06,
  pop: 0.04,
  jam: 0.4,
};

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(
  freq: number,
  dur: number,
  opts: {
    type?: OscillatorType;
    to?: number;
    vol?: number;
    delay?: number;
  } = {},
) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  gain.gain.setValueAtTime(opts.vol ?? 0.2, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { vol?: number; freq?: number; delay?: number } = {}) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.freq ?? 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(opts.vol ?? 0.3, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export function playSfx(sfx: Sfx) {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[sfx] ?? 0;
  if (now - (lastPlayed[sfx] ?? -1) < gap) return;
  lastPlayed[sfx] = now;

  switch (sfx) {
    case "blaster":
      tone(880, 0.07, { to: 440, vol: 0.06 });
      break;
    case "sniper":
      tone(1400, 0.12, { type: "sawtooth", to: 200, vol: 0.08 });
      noise(0.08, { vol: 0.12, freq: 3000 });
      break;
    case "bomb":
      tone(180, 0.12, { type: "triangle", to: 90, vol: 0.18 });
      break;
    case "boom":
      noise(0.35, { vol: 0.35, freq: 700 });
      tone(120, 0.3, { type: "sine", to: 40, vol: 0.3 });
      break;
    case "frost":
      tone(1800, 0.1, { type: "sine", to: 2600, vol: 0.06 });
      break;
    case "tesla":
      tone(220, 0.12, { type: "sawtooth", to: 900, vol: 0.06 });
      noise(0.1, { vol: 0.08, freq: 5000 });
      break;
    case "pop":
      tone(520 + Math.random() * 200, 0.08, { type: "sine", to: 1100, vol: 0.14 });
      break;
    case "leak":
      tone(300, 0.25, { type: "square", to: 120, vol: 0.12 });
      break;
    case "place":
      tone(330, 0.06, { type: "triangle", vol: 0.2 });
      tone(495, 0.09, { type: "triangle", vol: 0.2, delay: 0.06 });
      break;
    case "upgrade":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, { type: "triangle", vol: 0.16, delay: i * 0.06 }));
      break;
    case "sell":
      tone(988, 0.06, { type: "square", vol: 0.08 });
      tone(1319, 0.12, { type: "square", vol: 0.08, delay: 0.06 });
      break;
    case "clear":
      noise(0.3, { vol: 0.3, freq: 900 });
      tone(160, 0.22, { type: "triangle", to: 70, vol: 0.22 });
      tone(660, 0.1, { type: "triangle", vol: 0.12, delay: 0.16 });
      break;
    case "portal":
      [196, 233, 277, 370].forEach((f, i) => tone(f, 0.28, { type: "sawtooth", vol: 0.07, delay: i * 0.11 }));
      tone(90, 0.6, { type: "sine", to: 180, vol: 0.2 });
      break;
    case "jam":
      tone(900, 0.25, { type: "sawtooth", to: 90, vol: 0.09 });
      noise(0.2, { vol: 0.12, freq: 6000 });
      break;
    case "meteor":
      tone(1600, 0.65, { type: "sine", to: 180, vol: 0.12 });
      break;
    case "freeze":
      [2093, 1568, 1319, 1047].forEach((f, i) => tone(f, 0.3, { type: "sine", vol: 0.1, delay: i * 0.07 }));
      noise(0.5, { vol: 0.1, freq: 7000 });
      break;
    case "event":
      noise(0.9, { vol: 0.32, freq: 500 });
      tone(70, 0.9, { type: "sine", to: 45, vol: 0.3 });
      break;
    case "spec":
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, { type: "triangle", vol: 0.16, delay: i * 0.07 }));
      break;
    case "coin":
      tone(1319, 0.07, { type: "square", vol: 0.07 });
      tone(1760, 0.14, { type: "square", vol: 0.07, delay: 0.07 });
      break;
    case "error":
      tone(160, 0.14, { type: "square", vol: 0.1 });
      break;
    case "waveStart":
      [392, 523, 659].forEach((f, i) => tone(f, 0.14, { type: "square", vol: 0.08, delay: i * 0.09 }));
      break;
    case "waveClear":
      [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, 0.14, { type: "triangle", vol: 0.15, delay: i * 0.08 }));
      break;
    case "lose":
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, { type: "triangle", vol: 0.18, delay: i * 0.18 }));
      break;
    case "win":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
        tone(f, 0.18, { type: "triangle", vol: 0.18, delay: i * 0.12 }),
      );
      break;
  }
}
