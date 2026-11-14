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

export const sfx = {
  pickup(rarity: number) {
    tone(NOTE(0 + rarity * 2), 0.09, { type: "triangle", vol: 0.22 });
    tone(NOTE(7 + rarity * 2), 0.14, { type: "triangle", vol: 0.22, delay: 0.07 });
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
};
