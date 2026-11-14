// ─── Munch Bunch: tiny WebAudio synth (no audio files) ───────────────────────

let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.08, slide = 0, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  bite: () => tone(520 + Math.random() * 320, 0.05, "triangle", 0.06, 1.6),
  send: () => tone(330, 0.12, "sine", 0.1, 2.2),
  done: () => {
    tone(660, 0.08, "sine", 0.09, 1.5);
    tone(990, 0.1, "sine", 0.07, 1.3, 0.07);
  },
  nope: () => tone(180, 0.18, "square", 0.05, 0.7),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, 1, i * 0.11)),
  stuck: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, "triangle", 0.08, 0.95, i * 0.15)),
};
