// ─── Hole Drop: tiny WebAudio synth (no audio files) ─────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const lastPlayed: Record<string, number> = {};

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.32;
}

function gap(key: string, seconds: number) {
  if (!ctx) return false;
  const now = ctx.currentTime;
  if (now - (lastPlayed[key] ?? -1) < seconds) return false;
  lastPlayed[key] = now;
  return true;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; to?: number; vol?: number; delay?: number } = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur: number, opts: { vol?: number; freq?: number; delay?: number } = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.freq ?? 600;
  const gain = ctx.createGain();
  gain.gain.value = opts.vol ?? 0.2;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

const semis = (n: number) => Math.pow(2, n / 12);

/** Player swallowed something. Small things blip, big things thump; combos climb in pitch. */
export function sfxEat(fit: number, combo: number) {
  if (!gap("eat", 0.035)) return;
  const climb = semis(Math.min(14, (combo - 1) * 0.7));
  if (fit < 16) {
    tone(620 * climb, 0.09, { type: "triangle", to: 980 * climb, vol: 0.16 });
  } else if (fit < 45) {
    tone(300 * climb, 0.16, { type: "triangle", to: 620 * climb, vol: 0.2 });
    tone(150, 0.12, { type: "sine", to: 90, vol: 0.16 });
  } else {
    tone(110, 0.45, { type: "sine", to: 45, vol: 0.32 });
    tone(220 * climb, 0.25, { type: "triangle", to: 440 * climb, vol: 0.16, delay: 0.05 });
    noise(0.4, { vol: 0.18, freq: 400 });
  }
}

export function sfxRumble() {
  if (!gap("rumble", 0.25)) return;
  noise(0.6, { vol: 0.16, freq: 220 });
}

export function sfxLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: "square", vol: 0.09, delay: i * 0.07 }));
  tone(1047, 0.4, { type: "triangle", vol: 0.14, delay: 0.28 });
}

export function sfxGobble() {
  tone(500, 0.3, { type: "sawtooth", to: 90, vol: 0.14 });
  [784, 988, 1175].forEach((f, i) => tone(f, 0.14, { type: "square", vol: 0.08, delay: 0.25 + i * 0.08 }));
}

export function sfxGotEaten() {
  [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.22, { type: "triangle", vol: 0.16, delay: i * 0.22 }));
}

export function sfxTick(final: boolean) {
  tone(final ? 1100 : 760, 0.09, { type: "square", vol: 0.08 });
}

export function sfxGo() {
  [523, 659, 784].forEach((f) => tone(f, 0.45, { type: "triangle", vol: 0.12 }));
  tone(1047, 0.5, { type: "square", vol: 0.06, delay: 0.05 });
}

export function sfxFinish(win: boolean) {
  const notes = win ? [523, 659, 784, 1047, 784, 1047] : [523, 659, 784, 659];
  notes.forEach((f, i) => tone(f, 0.2, { type: "square", vol: 0.08, delay: i * 0.12 }));
  tone(win ? 1319 : 523, 0.6, { type: "triangle", vol: 0.14, delay: notes.length * 0.12 });
}
