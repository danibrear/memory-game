// ─── Sneaky Eggs: tiny WebAudio synth (no audio files) ──────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const VOLUME = 0.3;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    }
    // iOS parks the context as "interrupted" after a call or an app switch.
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
  } catch {
    // No sound on this device; the game plays fine without it.
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : VOLUME;
}

function noise(dur: number, opts: { vol?: number; from?: number; to?: number; delay?: number } = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(opts.from ?? 800, t0);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.value = opts.vol ?? 0.2;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

interface ToneOpts {
  type?: OscillatorType;
  to?: number;
  vol?: number;
  delay?: number;
}

function tone(freq: number, dur: number, opts: ToneOpts = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const NOTE = (semis: number) => 523.25 * Math.pow(2, semis / 12);
const CHIME = [0, 2, 4, 7, 9, 12];

export const sfx = {
  pickup(rarity: number) {
    tone(NOTE(0 + rarity * 2), 0.09, { type: "triangle", vol: 0.22 });
    tone(NOTE(7 + rarity * 2), 0.14, { type: "triangle", vol: 0.22, delay: 0.07 });
  },
  powerup() {
    [7, 12, 19].forEach((n, i) => tone(NOTE(n), 0.12, { type: "square", vol: 0.1, delay: i * 0.06 }));
  },
  freeze() {
    tone(1800, 0.5, { type: "sine", vol: 0.14, to: 500 });
    tone(2400, 0.35, { type: "triangle", vol: 0.08, to: 900, delay: 0.05 });
  },
  pop() {
    tone(500, 0.08, { type: "square", vol: 0.14, to: 1400 });
  },
  /** Starting to lift a heavy egg. */
  grab() {
    tone(220, 0.28, { type: "triangle", vol: 0.12, to: 440 });
  },
  /** A rare egg just finished ripening. */
  ripe() {
    tone(NOTE(12), 0.12, { type: "sine", vol: 0.14 });
    tone(NOTE(19), 0.24, { type: "sine", vol: 0.14, delay: 0.1 });
  },
  /** A Golden, Rainbow, Huge or Titanic hatch. */
  jackpot() {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
      tone(NOTE(s), 0.26, { type: "triangle", vol: 0.2, delay: 0.5 + i * 0.07 }),
    );
    tone(NOTE(31), 0.6, { type: "sine", vol: 0.14, delay: 1.0 });
  },
  wake() {
    tone(880, 0.09, { type: "square", vol: 0.1 });
    tone(880, 0.09, { type: "square", vol: 0.1, delay: 0.13 });
    tone(150, 0.5, { type: "sawtooth", to: 90, vol: 0.14, delay: 0.3 });
  },
  caught() {
    tone(300, 0.12, { type: "square", vol: 0.14, to: 160 });
    tone(520, 0.4, { type: "triangle", vol: 0.18, to: 180, delay: 0.1 });
  },
  escape(close: boolean) {
    tone(NOTE(7), 0.08, { type: "triangle", vol: 0.14 });
    tone(NOTE(12), 0.14, { type: "triangle", vol: 0.14, delay: 0.07 });
    if (close) tone(NOTE(19), 0.2, { type: "triangle", vol: 0.14, delay: 0.16 });
  },
  deliver() {
    tone(NOTE(4), 0.1, { type: "triangle", vol: 0.2 });
    tone(NOTE(9), 0.1, { type: "triangle", vol: 0.2, delay: 0.09 });
    tone(NOTE(16), 0.2, { type: "triangle", vol: 0.2, delay: 0.18 });
  },
  tap() {
    tone(700 + Math.random() * 300, 0.05, { type: "square", vol: 0.07, to: 400 });
  },
  hatch(rarity: number) {
    tone(240, 0.07, { type: "square", vol: 0.12, to: 120 });
    const steps = [0, 4, 7, 12, 16, 19].slice(0, 3 + rarity);
    steps.forEach((s, i) => tone(NOTE(s), 0.22, { type: "triangle", vol: 0.2, delay: 0.08 + i * 0.085 }));
  },
  buy() {
    tone(NOTE(12), 0.08, { type: "square", vol: 0.1 });
    tone(NOTE(19), 0.2, { type: "square", vol: 0.1, delay: 0.08 });
  },
  gate() {
    [0, 4, 7, 12].forEach((s, i) => tone(NOTE(s), 0.25, { type: "triangle", vol: 0.22, delay: i * 0.12 }));
  },
  fuse() {
    tone(260, 0.4, { type: "sine", vol: 0.2, to: 1040 });
    [12, 16, 19, 24].forEach((s, i) => tone(NOTE(s), 0.22, { type: "triangle", vol: 0.18, delay: 0.38 + i * 0.07 }));
  },
  sell() {
    tone(NOTE(7), 0.08, { type: "triangle", vol: 0.18 });
    tone(NOTE(12), 0.14, { type: "triangle", vol: 0.18, delay: 0.07 });
  },
  nope() {
    tone(170, 0.16, { type: "square", vol: 0.08, to: 120 });
  },
  win() {
    [0, 4, 7, 12, 7, 12, 16, 24].forEach((s, i) => tone(NOTE(s), 0.3, { type: "triangle", vol: 0.22, delay: i * 0.13 }));
  },
  achievement() {
    [7, 12, 16, 19].forEach((s, i) => tone(NOTE(s), 0.2, { type: "triangle", vol: 0.2, delay: i * 0.08 }));
    tone(NOTE(24), 0.45, { type: "sine", vol: 0.16, delay: 0.34 });
  },
  mission() {
    [4, 9, 12, 16].forEach((s, i) => tone(NOTE(s), 0.16, { type: "triangle", vol: 0.18, delay: i * 0.07 }));
  },
  pat() {
    tone(900, 0.07, { type: "sine", vol: 0.16, to: 1400 });
    tone(1300, 0.09, { type: "sine", vol: 0.14, to: 1700, delay: 0.08 });
  },
  purr() {
    for (let i = 0; i < 6; i++) tone(70 + (i % 2) * 8, 0.07, { type: "sawtooth", vol: 0.1, delay: i * 0.07 });
  },
  knock() {
    tone(180, 0.06, { type: "square", vol: 0.16, to: 110 });
    tone(180, 0.06, { type: "square", vol: 0.16, to: 110, delay: 0.16 });
  },
  chest() {
    noise(0.25, { vol: 0.14, from: 500, to: 2500 });
    [0, 4, 7, 12, 16].forEach((s, i) => tone(NOTE(s), 0.2, { type: "triangle", vol: 0.2, delay: 0.1 + i * 0.07 }));
  },
  coins() {
    tone(NOTE(16), 0.06, { type: "square", vol: 0.08 });
    tone(NOTE(21), 0.12, { type: "square", vol: 0.08, delay: 0.06 });
  },
  mystery() {
    [12, 11, 12, 16, 19].forEach((s, i) => tone(NOTE(s), 0.22, { type: "sine", vol: 0.16, delay: i * 0.1 }));
  },
  night() {
    tone(NOTE(-5), 0.5, { type: "sine", vol: 0.14 });
    tone(NOTE(-8), 0.7, { type: "sine", vol: 0.14, delay: 0.4 });
  },
  day() {
    [0, 4, 7].forEach((s, i) => tone(NOTE(s), 0.25, { type: "sine", vol: 0.14, delay: i * 0.14 }));
  },
  wish() {
    [24, 19, 16, 12, 16, 19, 24].forEach((s, i) => tone(NOTE(s), 0.16, { type: "sine", vol: 0.14, delay: i * 0.06 }));
  },
  sugar() {
    [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(NOTE(s), 0.08, { type: "square", vol: 0.08, delay: i * 0.04 }));
  },
  bonk() {
    tone(220, 0.1, { type: "square", vol: 0.14, to: 90 });
    tone(NOTE(9), 0.12, { type: "triangle", vol: 0.14, delay: 0.14 });
  },
  chime(note: number) {
    const s = CHIME[note % CHIME.length];
    tone(NOTE(s + 12), 0.7, { type: "sine", vol: 0.16 });
    tone(NOTE(s + 24), 0.5, { type: "sine", vol: 0.06 });
  },
  boing() {
    tone(160, 0.22, { type: "sine", vol: 0.2, to: 520 });
  },
  rustle() {
    noise(0.14, { vol: 0.08, from: 2400, to: 1200 });
  },
  snow() {
    noise(0.18, { vol: 0.08, from: 900, to: 400 });
  },
  secret() {
    [0, 7, 12, 19, 24, 31].forEach((s, i) => tone(NOTE(s), 0.3, { type: "sine", vol: 0.16, delay: i * 0.09 }));
  },
  taxi() {
    tone(300, 0.7, { type: "sine", vol: 0.16, to: 1500 });
    tone(310, 0.7, { type: "triangle", vol: 0.1, to: 1560 });
  },
  dash() {
    noise(0.28, { vol: 0.16, from: 600, to: 3200 });
  },
  zzz() {
    tone(200, 0.5, { type: "sine", vol: 0.1, to: 130 });
  },
  poof() {
    noise(0.2, { vol: 0.12, from: 1500, to: 500 });
    tone(NOTE(12), 0.14, { type: "sine", vol: 0.12, delay: 0.05 });
  },
  /** Mini games: the 3-2-1 beeps, and the higher one for "Go!". */
  count() {
    tone(NOTE(0), 0.12, { type: "square", vol: 0.1 });
  },
  go() {
    tone(NOTE(12), 0.3, { type: "square", vol: 0.12 });
  },
  /** A pet peeking out of its hiding place, or Zip having a laugh. */
  giggle() {
    tone(1200, 0.06, { type: "sine", vol: 0.1, to: 1500 });
    tone(1400, 0.06, { type: "sine", vol: 0.1, to: 1700, delay: 0.08 });
    tone(1250, 0.07, { type: "sine", vol: 0.1, to: 1550, delay: 0.16 });
  },
  /** Something is about to happen: Zip winding up, the Grumble stirring. */
  warn() {
    tone(440, 0.1, { type: "triangle", vol: 0.14 });
    tone(587, 0.14, { type: "triangle", vol: 0.14, delay: 0.1 });
  },
  /** A medal: one note for bronze, a little fanfare for gold. */
  medal(n: number) {
    [0, 4, 7, 12, 16, 19, 24].slice(0, 2 + n * 2).forEach((semis, i) =>
      tone(NOTE(semis), 0.26, { type: "triangle", vol: 0.2, delay: i * 0.1 }),
    );
  },
  dice() {
    for (let i = 0; i < 5; i++) tone(500 + Math.random() * 700, 0.04, { type: "square", vol: 0.08, delay: i * 0.06 });
  },
};

/* ---------- Music: a soft looping tune that changes with the land ---------- */

interface Tune {
  root: number;
  scale: number[];
  bpm: number;
}

const MAJOR = [0, 2, 4, 7, 9];
const MINOR = [0, 3, 5, 7, 10];
// Index 0 is home; 1–5 are the lands, bottom to top.
const TUNES: Tune[] = [
  { root: 261.63, scale: MAJOR, bpm: 96 },
  { root: 293.66, scale: MAJOR, bpm: 104 },
  { root: 349.23, scale: MAJOR, bpm: 110 },
  { root: 329.63, scale: MINOR, bpm: 100 },
  { root: 392.0, scale: MAJOR, bpm: 116 },
  { root: 220.0, scale: MINOR, bpm: 92 },
];
// Bars of eight steps; numbers are scale steps, -1 is a rest.
const BARS = [
  [0, 2, 4, 2, 3, 4, 5, -1],
  [4, 3, 2, 3, 4, -1, 2, -1],
  [0, -1, 2, 4, 5, 4, 2, 0],
  [5, 4, 2, 4, 3, 2, 0, -1],
  [2, 2, 4, -1, 5, 7, 5, 4],
];

let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicGain: GainNode | null = null;
let nextStep = 0;
let stepIdx = 0;
let bar = BARS[0];
let tune = TUNES[0];
let sleepy = false;

function musicNote(freq: number, at: number, dur: number, vol: number, type: OscillatorType) {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(musicGain);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

const degree = (t: Tune, step: number) =>
  t.root * Math.pow(2, (t.scale[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

function scheduleMusic() {
  if (!ctx || !master || !musicOn) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
  }
  if (ctx.state !== "running") return;
  if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
  const stepDur = 60 / (tune.bpm * (sleepy ? 0.78 : 1)) / 2;
  while (nextStep < ctx.currentTime + 0.35) {
    const i = stepIdx % 8;
    if (i === 0) bar = BARS[Math.floor(Math.random() * BARS.length)];
    const s = bar[i];
    if (s >= 0) musicNote(degree(tune, s) * (sleepy ? 1 : 2), nextStep, stepDur * 1.7, sleepy ? 0.05 : 0.06, "triangle");
    if (i === 0) musicNote(tune.root / 2, nextStep, stepDur * 3.6, 0.09, "sine");
    if (i === 4) musicNote((tune.root / 2) * Math.pow(2, 7 / 12), nextStep, stepDur * 3.2, 0.07, "sine");
    nextStep += stepDur;
    stepIdx++;
  }
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (on && !musicTimer) {
    musicTimer = setInterval(scheduleMusic, 120);
  } else if (!on && musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

/** Pick the tune for where the player is (-1 = home) and whether it's night. */
export function setMusicMood(biome: number, night: boolean) {
  tune = TUNES[Math.max(0, Math.min(TUNES.length - 1, biome + 1))];
  sleepy = night;
}
