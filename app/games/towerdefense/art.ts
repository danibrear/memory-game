// ─── Tower Defense: shared drawing kit ────────────────────────────────────────
//
// Small helpers every sprite uses so the whole game reads as one hand-drawn
// family: a dark ink outline, flat "cel" shading (one shadow, one highlight)
// and big expressive eyes. Nothing here uses gradients, which keeps a busy
// board cheap to draw on a tablet.

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

/** Outline colour for every character. */
export const INK = "#232a3d";

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU);
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.fill();
}

const shadeCache = new Map<string, string>();

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shadeHex(hex: string, amt: number) {
  const key = hex + amt;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  const out = `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  shadeCache.set(key, out);
  return out;
}

/** Stroke the current path with the house outline. `k` scales the weight. */
export function ink(ctx: Ctx, s: number, k = 1, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.25, s * 0.042 * k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Fill a shape the cartoon way: flat colour, a darker crescent low on the
 * right, a soft highlight high on the left, then the ink outline.
 * `path` must begin and build the path each time it is called.
 */
export function cel(
  ctx: Ctx,
  path: () => void,
  color: string,
  s: number,
  o: { cx?: number; cy?: number; w?: number; h?: number; outline?: number; shine?: boolean; ink?: string } = {},
) {
  const w = o.w ?? s * 0.5;
  const h = o.h ?? s * 0.5;
  const cx = o.cx ?? 0;
  const cy = o.cy ?? 0;
  path();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Shadow: everything outside a big circle pushed up and to the left.
  ctx.fillStyle = shadeHex(color, -0.2);
  ctx.beginPath();
  ctx.rect(cx - w, cy - h, w * 2, h * 2);
  ctx.ellipse(cx - w * 0.14, cy - h * 0.2, w * 0.56, h * 0.6, 0, 0, TAU, true);
  ctx.fill("evenodd");
  if (o.shine !== false) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.2, cy - h * 0.26, w * 0.16, h * 0.09, -0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  path();
  ink(ctx, s, o.outline ?? 1, o.ink);
}

/** A soft, bottom-heavy blob: the basic body shape. */
export function blobPath(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + h * 0.18);
  ctx.bezierCurveTo(cx - w * 0.56, cy - h * 0.66, cx + w * 0.56, cy - h * 0.66, cx + w / 2, cy + h * 0.18);
  ctx.quadraticCurveTo(cx + w * 0.5, cy + h / 2, cx, cy + h / 2);
  ctx.quadraticCurveTo(cx - w * 0.5, cy + h / 2, cx - w / 2, cy + h * 0.18);
  ctx.closePath();
}

// ─── Faces ────────────────────────────────────────────────────────────────────

export type Mood =
  | "calm"
  | "angry"
  | "focus"
  | "worried"
  | "hurt"
  | "dizzy"
  | "happy"
  | "sleepy";

export interface EyeOpts {
  /** Centre of the face. */
  x: number;
  y: number;
  /** Radius of one eye. */
  r: number;
  /** Distance from the centre to each eye. */
  spread: number;
  lookX?: number;
  lookY?: number;
  mood?: Mood;
  blink?: boolean;
  time?: number;
  /** Eye and pupil colours (for glowing or robot eyes). */
  white?: string;
  pupil?: string;
  /** Draw no outline round the eye (for eyes that glow in the dark). */
  bare?: boolean;
}

/** True for a short moment every few seconds, at a rhythm set by `seed`. */
export const blinking = (time: number, seed: number) => (time * 0.9 + seed * 1.7) % 3.4 < 0.13;

export function drawEyes(ctx: Ctx, o: EyeOpts) {
  const mood = o.mood ?? "calm";
  const lookX = o.lookX ?? 0;
  const lookY = o.lookY ?? 0;
  const r = o.r;
  const lw = Math.max(1, r * 0.42);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const ex = o.x + side * o.spread + lookX * r * 0.3;
    const ey = o.y + lookY * r * 0.25;
    ctx.strokeStyle = o.bare ? (o.white ?? "#ffffff") : INK;
    ctx.lineWidth = lw;
    if (mood === "hurt") {
      // > <
      ctx.beginPath();
      ctx.moveTo(ex + side * r * 0.7, ey - r * 0.7);
      ctx.lineTo(ex - side * r * 0.5, ey);
      ctx.lineTo(ex + side * r * 0.7, ey + r * 0.7);
      ctx.stroke();
      continue;
    }
    if (mood === "happy") {
      ctx.beginPath();
      ctx.arc(ex, ey + r * 0.35, r * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    if (mood === "sleepy" || o.blink) {
      ctx.beginPath();
      ctx.arc(ex, ey - r * 0.35, r * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    if (mood === "dizzy") {
      // A little spiral that keeps turning
      const spin = (o.time ?? 0) * 7 * side;
      ctx.lineWidth = Math.max(1, r * 0.3);
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = spin + (i / 14) * Math.PI * 3.2;
        const rr = (i / 14) * r;
        const px = ex + Math.cos(a) * rr;
        const py = ey + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      continue;
    }
    // Open eye
    ctx.fillStyle = o.white ?? "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, TAU);
    ctx.fill();
    if (!o.bare) {
      ctx.lineWidth = Math.max(1, r * 0.26);
      ctx.stroke();
    }
    const pr = r * (mood === "worried" ? 0.42 : 0.62);
    const px = ex + lookX * (r - pr) * 0.85;
    const py = ey + lookY * (r - pr) * 0.85;
    if (!o.bare) {
      circle(ctx, px, py, pr, o.pupil ?? INK);
      circle(ctx, px - pr * 0.35, py - pr * 0.4, pr * 0.36, "#ffffff");
    }
    // Brows carry most of the feeling
    if (mood === "angry" || mood === "focus" || mood === "worried") {
      const inner = mood === "worried" ? -1.75 : mood === "angry" ? -0.75 : -1.05;
      const outer = mood === "worried" ? -1.05 : mood === "angry" ? -1.75 : -1.5;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath();
      ctx.moveTo(ex - side * r * 1.05, ey + r * inner);
      ctx.lineTo(ex + side * r * 1.05, ey + r * outer);
      ctx.stroke();
    }
  }
}

export type MouthKind = "smile" | "grin" | "open" | "o" | "flat" | "frown" | "grit";

export function drawMouth(ctx: Ctx, x: number, y: number, w: number, kind: MouthKind, color = INK) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, w * 0.2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (kind) {
    case "smile":
      ctx.beginPath();
      ctx.arc(x, y - w * 0.3, w * 0.55, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      break;
    case "grin":
    case "open": {
      // Open, happy mouth with a tongue
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y - w * 0.1);
      ctx.quadraticCurveTo(x, y + w * (kind === "open" ? 0.95 : 0.6), x + w * 0.5, y - w * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.ellipse(x, y + w * (kind === "open" ? 0.3 : 0.16), w * 0.2, w * 0.13, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "o":
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.22, w * 0.28, 0, 0, TAU);
      ctx.fill();
      break;
    case "flat":
      ctx.beginPath();
      ctx.moveTo(x - w * 0.35, y);
      ctx.lineTo(x + w * 0.35, y);
      ctx.stroke();
      break;
    case "frown":
      ctx.beginPath();
      ctx.arc(x, y + w * 0.45, w * 0.5, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    case "grit": {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(x - w * 0.5, y - w * 0.2, w, w * 0.42, w * 0.12);
      ctx.fill();
      ctx.lineWidth = Math.max(1, w * 0.11);
      ctx.stroke();
      ctx.beginPath();
      for (const t of [-0.17, 0.17]) {
        ctx.moveTo(x + t * w, y - w * 0.2);
        ctx.lineTo(x + t * w, y + w * 0.22);
      }
      ctx.stroke();
      break;
    }
  }
}

/** Rosy cheeks. */
export function cheeks(ctx: Ctx, x: number, y: number, spread: number, r: number, color = "rgba(251,113,133,0.55)") {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * spread, y, r, r * 0.65, 0, 0, TAU);
    ctx.fill();
  }
}

/** A five-pointed star centred on (x, y). */
export function starPath(ctx: Ctx, x: number, y: number, r: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Overshooting ease for things that pop into place. */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = Math.min(1, Math.max(0, t)) - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};
