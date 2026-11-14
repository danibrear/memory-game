// ─── Sneaky Eggs: Canvas 2D drawing ─────────────────────────────────────────
//
// Pets, the player and the Grumbles all come from one little critter drawer
// (`drawPet`), so every creature shares the same chunky, friendly look.

import {
  BIOME_COUNT,
  BIOMES,
  CENTER_X,
  GATE_W,
  HOME_TOP,
  HUT,
  PAD_Y,
  PEN,
  RARITIES,
  WORLD_H,
  WORLD_W,
  biomeAt,
  biomeBottom,
  biomeTop,
  padX,
  petById,
  type DecorKind,
  type Look,
  type Point,
  type Rarity,
  type SolidKind,
} from "./config";
import type { Decor, Game, Guard, Solid } from "./engine";

const TAU = Math.PI * 2;
const FONT = '"Fredoka", "Inter", system-ui, sans-serif';
const HOME_GROUND = "#a8e083";
const HOME_GROUND_2 = "#97d472";
const HOME_PATH = "#f3e2ad";

type Ctx = CanvasRenderingContext2D;

/* ---------- Colour helpers ---------- */

const shadeCache = new Map<string, string>();

/** Mix a hex colour toward white (amt > 0) or black (amt < 0). */
export function shade(hex: string, amt: number): string {
  const key = `${hex}|${amt}`;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  const r = Math.round(((n >> 16) & 255) + (t - ((n >> 16) & 255)) * a);
  const g = Math.round(((n >> 8) & 255) + (t - ((n >> 8) & 255)) * a);
  const b = Math.round((n & 255) + (t - (n & 255)) * a);
  const out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

function starPath(ctx: Ctx, x: number, y: number, r: number, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function label(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, stroke?: string, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, alpha = 0.18) {
  ctx.fillStyle = `rgba(20, 16, 50, ${alpha})`;
  ellipse(ctx, x, y, rx, rx * 0.36);
  ctx.fill();
}

/* ---------- Critters ---------- */

export type Mood = "normal" | "sleep" | "angry" | "dizzy" | "happy";

export interface PetOpts {
  /** Seconds, for blinking and idle wiggle. */
  t?: number;
  flip?: boolean;
  mood?: Mood;
  /** Per-critter offset so a crowd doesn't blink in unison. */
  seed?: number;
}

const SPRINKLE_COLORS = ["#f43f5e", "#38bdf8", "#facc15", "#4ade80", "#a855f7", "#fb923c"];

/**
 * Draw a critter standing at (x, y) — the point between its feet.
 * `size` is roughly its height in pixels.
 */
export function drawPet(ctx: Ctx, look: Look, x: number, y: number, size: number, opts: PetOpts = {}) {
  const t = opts.t ?? 0;
  const seed = opts.seed ?? 0;
  const mood = opts.mood ?? "normal";
  const shape = look.shape ?? "round";
  const rx = shape === "wide" ? 0.48 : shape === "tall" ? 0.34 : 0.4;
  const ry = shape === "tall" ? 0.46 : 0.4;
  const cy = -(ry + 0.03);
  const top = cy - ry;
  const dark = shade(look.body, -0.3);
  const line = shade(look.body, -0.45);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(opts.flip ? -size : size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Tail (drawn behind, on the trailing side).
  switch (look.tail ?? "none") {
    case "puff":
      ctx.fillStyle = look.belly;
      ellipse(ctx, -rx - 0.02, -0.2, 0.12, 0.12);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 0.02;
      ctx.stroke();
      break;
    case "long": {
      const sway = Math.sin(t * 3 + seed) * 0.04;
      ctx.strokeStyle = look.body;
      ctx.lineWidth = 0.11;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.75, -0.16);
      ctx.quadraticCurveTo(-rx - 0.3, -0.14, -rx - 0.2 + sway, -0.5);
      ctx.stroke();
      ctx.fillStyle = look.accent;
      ellipse(ctx, -rx - 0.2 + sway, -0.52, 0.075, 0.075);
      ctx.fill();
      break;
    }
    case "fish":
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.8, -0.2);
      ctx.quadraticCurveTo(-rx - 0.2, -0.42, -rx - 0.3, -0.5);
      ctx.quadraticCurveTo(-rx - 0.18, -0.24, -rx - 0.32, -0.02);
      ctx.quadraticCurveTo(-rx - 0.16, -0.06, -rx * 0.8, -0.2);
      ctx.fill();
      break;
    case "flame": {
      const f = 1 + Math.sin(t * 12 + seed) * 0.08;
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.7, -0.14);
      ctx.quadraticCurveTo(-rx - 0.34 * f, -0.12, -rx - 0.26 * f, -0.56 * f);
      ctx.quadraticCurveTo(-rx - 0.1, -0.32, -rx * 0.7, -0.3);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(-rx * 0.7, -0.16);
      ctx.quadraticCurveTo(-rx - 0.2 * f, -0.16, -rx - 0.17 * f, -0.4 * f);
      ctx.quadraticCurveTo(-rx - 0.06, -0.28, -rx * 0.7, -0.26);
      ctx.fill();
      break;
    }
    case "star":
      ctx.strokeStyle = look.body;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.75, -0.16);
      ctx.quadraticCurveTo(-rx - 0.24, -0.16, -rx - 0.2, -0.42);
      ctx.stroke();
      ctx.fillStyle = look.accent;
      starPath(ctx, -rx - 0.2, -0.5, 0.13, 5, 0.5, -Math.PI / 2 + Math.sin(t * 2 + seed) * 0.3);
      ctx.fill();
      break;
    default:
      break;
  }

  // Things on the back.
  switch (look.back ?? "none") {
    case "wings": {
      const flap = Math.sin(t * 7 + seed) * 0.12;
      ctx.fillStyle = shade(look.accent, 0.35);
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.025;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * rx * 0.82, cy - 0.06);
        ctx.rotate(s * (-0.5 + flap));
        ellipse(ctx, s * 0.17, -0.06, 0.2, 0.12, s * -0.3);
        ctx.fill();
        ctx.stroke();
        ellipse(ctx, s * 0.14, 0.06, 0.14, 0.085, s * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "shell":
      ctx.fillStyle = look.accent;
      ellipse(ctx, 0, cy - 0.02, rx + 0.1, ry + 0.07);
      ctx.fill();
      ctx.fillStyle = shade(look.accent, 0.25);
      for (const [sx, sy] of [[-0.42, -0.1], [0.42, -0.1], [-0.3, -0.34], [0.3, -0.34], [0, -0.44]]) {
        ellipse(ctx, sx * (rx / 0.48), cy + sy, 0.06, 0.05);
        ctx.fill();
      }
      break;
    case "mane": {
      ctx.fillStyle = look.accent;
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        ellipse(ctx, Math.cos(a) * (rx + 0.03), cy - 0.04 + Math.sin(a) * (ry + 0.03), 0.12, 0.12);
        ctx.fill();
      }
      break;
    }
    case "fluff": {
      ctx.fillStyle = shade(look.body, 0.18);
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        ellipse(ctx, Math.cos(a) * (rx + 0.01), cy + Math.sin(a) * (ry + 0.01), 0.1, 0.1);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }

  // Ears.
  const ears = look.ears ?? "none";
  ctx.strokeStyle = line;
  ctx.lineWidth = 0.022;
  if (ears === "round") {
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.body;
      ellipse(ctx, s * rx * 0.68, top + 0.1, 0.13, 0.13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = look.cheeks ?? look.accent;
      ellipse(ctx, s * rx * 0.68, top + 0.1, 0.07, 0.07);
      ctx.fill();
    }
  } else if (ears === "pointy" || ears === "tuft" || ears === "unihorn") {
    const h = ears === "tuft" ? 0.17 : ears === "unihorn" ? 0.15 : 0.22;
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.body;
      ctx.beginPath();
      ctx.moveTo(s * rx * 0.3, top + 0.12);
      ctx.lineTo(s * rx * 0.78, top - h + 0.08);
      ctx.lineTo(s * rx * 0.95, top + 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = look.cheeks ?? look.accent;
      ctx.beginPath();
      ctx.moveTo(s * rx * 0.5, top + 0.13);
      ctx.lineTo(s * rx * 0.76, top - h + 0.17);
      ctx.lineTo(s * rx * 0.86, top + 0.2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (ears === "long") {
    const flop = Math.sin(t * 2.4 + seed) * 0.05;
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.body;
      ellipse(ctx, s * rx * 0.45, top - 0.1, 0.085, 0.25, s * (0.16 + flop));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = look.accent;
      ellipse(ctx, s * rx * 0.45, top - 0.1, 0.04, 0.17, s * (0.16 + flop));
      ctx.fill();
    }
  } else if (ears === "horns") {
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#fff4cf";
      ctx.beginPath();
      ctx.moveTo(s * rx * 0.38, top + 0.1);
      ctx.quadraticCurveTo(s * rx * 0.62, top - 0.2, s * rx * 0.98, top - 0.14);
      ctx.quadraticCurveTo(s * rx * 0.8, top - 0.02, s * rx * 0.78, top + 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#d9b25c";
      ctx.stroke();
    }
    ctx.strokeStyle = line;
  }

  // Feet.
  ctx.fillStyle = dark;
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 0.17, -0.035, 0.11, 0.06);
    ctx.fill();
  }

  // Body.
  const grad = ctx.createRadialGradient(-rx * 0.35, cy - ry * 0.45, 0.04, 0, cy, rx * 1.35);
  grad.addColorStop(0, shade(look.body, 0.3));
  grad.addColorStop(0.55, look.body);
  grad.addColorStop(1, shade(look.body, -0.18));
  ctx.fillStyle = grad;
  ellipse(ctx, 0, cy, rx, ry);
  ctx.fill();

  ctx.save();
  ellipse(ctx, 0, cy, rx, ry);
  ctx.clip();

  ctx.fillStyle = look.belly;
  ellipse(ctx, 0, cy + ry * 0.62, rx * 0.66, ry * 0.62);
  ctx.fill();

  switch (look.pattern ?? "none") {
    case "stripes":
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.055;
      for (const off of [-0.26, 0, 0.26]) {
        ctx.beginPath();
        ctx.moveTo(off * (rx / 0.4), top - 0.02);
        ctx.lineTo(off * (rx / 0.4) * 0.9, top + 0.15 - Math.abs(off) * 0.12);
        ctx.stroke();
      }
      break;
    case "spots":
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = 0.45;
      for (const [sx, sy, r] of [[-0.7, -0.1, 0.07], [0.72, 0.05, 0.08], [0.45, -0.62, 0.06], [-0.4, -0.7, 0.05], [-0.8, 0.45, 0.06]]) {
        ellipse(ctx, sx * rx, cy + sy * ry, r, r);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    case "sprinkles":
      ctx.lineWidth = 0.03;
      [[-0.66, -0.3, 0.5], [0.62, -0.42, -0.7], [0.74, 0.14, 0.3], [-0.76, 0.2, -0.4], [0.2, -0.82, 1.2], [-0.3, -0.78, -1]].forEach(([sx, sy, rot], i) => {
        ctx.strokeStyle = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(sx * rx - Math.cos(rot) * 0.035, cy + sy * ry - Math.sin(rot) * 0.035);
        ctx.lineTo(sx * rx + Math.cos(rot) * 0.035, cy + sy * ry + Math.sin(rot) * 0.035);
        ctx.stroke();
      });
      break;
    case "stars":
      ctx.fillStyle = "#fef9c3";
      [[-0.68, -0.25, 0.05], [0.66, -0.4, 0.06], [0.74, 0.2, 0.04], [-0.74, 0.3, 0.045], [0.15, -0.8, 0.04]].forEach(([sx, sy, r], i) => {
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3 + i * 1.7 + seed);
        starPath(ctx, sx * rx, cy + sy * ry, r, 4, 0.4);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      break;
    case "mask":
      ctx.fillStyle = look.accent;
      ctx.globalAlpha = 0.85;
      for (const s of [-1, 1]) {
        ellipse(ctx, s * 0.16, cy - 0.07, 0.13, 0.095, s * 0.25);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    default:
      break;
  }

  // Soft highlight.
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ellipse(ctx, -rx * 0.42, cy - ry * 0.55, rx * 0.26, ry * 0.15, -0.5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = line;
  ctx.lineWidth = 0.024;
  ellipse(ctx, 0, cy, rx, ry);
  ctx.stroke();

  // Scarf sits over the body.
  if (look.hat === "scarf") {
    ctx.fillStyle = look.accent;
    roundRect(ctx, -rx * 0.86, cy + ry * 0.34, rx * 1.72, 0.1, 0.05);
    ctx.fill();
    roundRect(ctx, rx * 0.3, cy + ry * 0.4, 0.1, 0.2, 0.04);
    ctx.fill();
  }

  // Unicorn horn sits in front of the ears.
  if (ears === "unihorn") {
    ctx.fillStyle = "#fcd34d";
    ctx.beginPath();
    ctx.moveTo(-0.06, top + 0.06);
    ctx.lineTo(0, top - 0.26);
    ctx.lineTo(0.06, top + 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 0.018;
    for (const k of [0.02, -0.07, -0.15]) {
      ctx.beginPath();
      ctx.moveTo(-0.05 - k * 0.15, top + k);
      ctx.lineTo(0.05 + k * 0.15, top + k - 0.04);
      ctx.stroke();
    }
  }
  if (ears === "floppy") {
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.accent;
      ellipse(ctx, s * (rx + 0.01), cy - 0.1, 0.09, 0.2, s * -0.2);
      ctx.fill();
    }
  }

  // Face.
  const eyeY = cy - 0.07;
  const blink = mood === "normal" && (t * 0.33 + seed * 0.37) % 1 > 0.96;
  ctx.strokeStyle = "#2b2240";
  ctx.fillStyle = "#2b2240";
  ctx.lineWidth = 0.032;
  for (const s of [-1, 1]) {
    const ex = s * 0.16;
    if (mood === "sleep" || blink) {
      ctx.beginPath();
      ctx.arc(ex, eyeY - 0.02, 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (mood === "happy") {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.03, 0.05, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (mood === "dizzy") {
      ctx.beginPath();
      ctx.moveTo(ex - 0.04, eyeY - 0.04);
      ctx.lineTo(ex + 0.04, eyeY + 0.04);
      ctx.moveTo(ex + 0.04, eyeY - 0.04);
      ctx.lineTo(ex - 0.04, eyeY + 0.04);
      ctx.stroke();
    } else {
      if (look.pattern === "mask" || isDark(look.body)) {
        ctx.fillStyle = "#ffffff";
        ellipse(ctx, ex, eyeY, 0.062, 0.075);
        ctx.fill();
        ctx.fillStyle = "#2b2240";
      }
      ellipse(ctx, ex, eyeY, 0.045, 0.058);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ellipse(ctx, ex + 0.015, eyeY - 0.022, 0.017, 0.017);
      ctx.fill();
      ctx.fillStyle = "#2b2240";
      if (mood === "angry") {
        ctx.beginPath();
        ctx.moveTo(ex - s * 0.09, eyeY - 0.12);
        ctx.lineTo(ex + s * 0.04, eyeY - 0.065);
        ctx.stroke();
      }
    }
  }

  if (look.cheeks) {
    ctx.fillStyle = look.cheeks;
    ctx.globalAlpha = 0.75;
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 0.27, cy + 0.035, 0.052, 0.036);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const mouthY = cy + 0.04;
  const face = look.face ?? "smile";
  ctx.lineWidth = 0.026;
  if (face === "beak") {
    ctx.fillStyle = look.accent;
    ctx.beginPath();
    ctx.moveTo(-0.055, mouthY - 0.035);
    ctx.lineTo(0.055, mouthY - 0.035);
    ctx.lineTo(0, mouthY + 0.045);
    ctx.closePath();
    ctx.fill();
  } else if (mood === "angry") {
    ctx.fillStyle = "#3a1f35";
    ellipse(ctx, 0, mouthY + 0.035, 0.085, 0.06);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.065, mouthY - 0.012);
      ctx.lineTo(s * 0.03, mouthY - 0.012);
      ctx.lineTo(s * 0.047, mouthY + 0.04);
      ctx.closePath();
      ctx.fill();
    }
  } else if (mood === "dizzy") {
    ctx.beginPath();
    ctx.moveTo(-0.06, mouthY + 0.02);
    ctx.quadraticCurveTo(-0.03, mouthY - 0.01, 0, mouthY + 0.02);
    ctx.quadraticCurveTo(0.03, mouthY + 0.05, 0.06, mouthY + 0.02);
    ctx.stroke();
  } else if (face === "cat") {
    ctx.beginPath();
    ctx.arc(-0.035, mouthY, 0.035, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.035, mouthY, 0.035, 0, Math.PI);
    ctx.stroke();
    ctx.fillStyle = look.accent;
    ellipse(ctx, 0, mouthY - 0.012, 0.022, 0.016);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, mouthY - 0.012, 0.05, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    if (face === "fang") {
      ctx.fillStyle = "#ffffff";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.045, mouthY + 0.012);
        ctx.lineTo(s * 0.012, mouthY + 0.03);
        ctx.lineTo(s * 0.03, mouthY + 0.07);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Hats.
  switch (look.hat ?? "none") {
    case "crown":
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(-0.13, top + 0.07);
      ctx.lineTo(-0.15, top - 0.1);
      ctx.lineTo(-0.065, top - 0.03);
      ctx.lineTo(0, top - 0.15);
      ctx.lineTo(0.065, top - 0.03);
      ctx.lineTo(0.15, top - 0.1);
      ctx.lineTo(0.13, top + 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ellipse(ctx, 0, top - 0.005, 0.026, 0.026);
      ctx.fill();
      break;
    case "halo":
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 0.04;
      ellipse(ctx, 0, top - 0.3 + Math.sin(t * 2.5 + seed) * 0.015, 0.17, 0.05);
      ctx.stroke();
      break;
    case "flower": {
      const fx = -rx * 0.55;
      const fy = top + 0.07;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ellipse(ctx, fx + Math.cos(a) * 0.055, fy + Math.sin(a) * 0.055, 0.045, 0.045);
        ctx.fill();
      }
      ctx.fillStyle = "#facc15";
      ellipse(ctx, fx, fy, 0.04, 0.04);
      ctx.fill();
      break;
    }
    case "bow": {
      const bx = rx * 0.5;
      const by = top + 0.06;
      ctx.fillStyle = look.accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + s * 0.12, by - 0.07);
        ctx.lineTo(bx + s * 0.12, by + 0.07);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = shade(look.accent, 0.35);
      ellipse(ctx, bx, by, 0.035, 0.035);
      ctx.fill();
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 110;
}

/** Twinkles around a shiny pet. */
function sparkles(ctx: Ctx, x: number, y: number, size: number, t: number, seed: number) {
  for (let i = 0; i < 4; i++) {
    const ph = t * 2.2 + seed + i * 1.6;
    const a = ph * 0.9 + i * 1.57;
    const k = (Math.sin(ph * 2) + 1) / 2;
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.fillStyle = i % 2 ? "#fde047" : "#ffffff";
    starPath(ctx, x + Math.cos(a) * size * 0.56, y - size * 0.45 + Math.sin(a) * size * 0.5, size * (0.07 + 0.06 * k), 4, 0.35);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- Eggs ---------- */

function eggPath(ctx: Ctx, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.6, -h, w, -h * 0.66, w, -h * 0.36);
  ctx.bezierCurveTo(w, -h * 0.14, w * 0.62, 0, 0, 0);
  ctx.bezierCurveTo(-w * 0.62, 0, -w, -h * 0.14, -w, -h * 0.36);
  ctx.bezierCurveTo(-w, -h * 0.66, -w * 0.6, -h, 0, -h);
  ctx.closePath();
}

/** Draw an egg resting at (x, y). `size` is its height. */
export function drawEgg(ctx: Ctx, biome: number, rarity: Rarity, x: number, y: number, size: number, t = 0, tilt = 0) {
  const b = BIOMES[biome] ?? BIOMES[0];
  const info = RARITIES[rarity];
  const w = size * 0.38;
  const h = size;

  ctx.save();
  ctx.translate(x, y);

  if (rarity >= 1) {
    // Glow so special eggs catch the eye from across the screen.
    const pulse = 0.75 + 0.25 * Math.sin(t * 4);
    const glow = ctx.createRadialGradient(0, -h * 0.5, h * 0.15, 0, -h * 0.5, h * (0.75 + rarity * 0.12));
    glow.addColorStop(0, info.color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = (0.28 + rarity * 0.1) * pulse;
    ctx.fillStyle = glow;
    ellipse(ctx, 0, -h * 0.5, h * (0.75 + rarity * 0.12), h * (0.75 + rarity * 0.12));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (rarity === 3) {
    ctx.save();
    ctx.translate(0, -h * 0.5);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = "rgba(253, 224, 71, 0.4)";
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-h * 0.1, -h * 0.95);
      ctx.lineTo(h * 0.1, -h * 0.95);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.rotate(tilt);
  const base = rarity === 0 ? b.egg.base : rarity === 1 ? "#dbeafe" : rarity === 2 ? "#ede9fe" : "#fde68a";
  const grad = ctx.createRadialGradient(-w * 0.35, -h * 0.68, h * 0.05, 0, -h * 0.45, h * 0.75);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, shade(rarity === 3 ? "#f59e0b" : base, rarity === 3 ? 0 : -0.22));
  ctx.fillStyle = grad;
  eggPath(ctx, w, h);
  ctx.fill();

  ctx.save();
  eggPath(ctx, w, h);
  ctx.clip();
  if (rarity === 0) {
    ctx.fillStyle = b.egg.spot;
    for (const [sx, sy, r] of [[-0.5, -0.3, 0.13], [0.45, -0.55, 0.11], [0.1, -0.2, 0.09], [-0.2, -0.75, 0.08]]) {
      ellipse(ctx, sx * w, sy * h, r * h, r * h);
      ctx.fill();
    }
  } else if (rarity === 1) {
    ctx.strokeStyle = info.color;
    ctx.lineWidth = h * 0.09;
    ctx.lineJoin = "round";
    for (const yy of [-0.3, -0.62]) {
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const px = (i / 3) * w * 1.1;
        const py = yy * h + (i % 2 === 0 ? -1 : 1) * h * 0.06;
        if (i === -3) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (rarity === 2) {
    ctx.fillStyle = info.color;
    ctx.fillRect(-w, -h * 0.5, w * 2, h * 0.2);
    ctx.fillStyle = info.dark;
    for (const [sx, sy, r] of [[-0.45, -0.72, 0.1], [0.4, -0.7, 0.08], [0, -0.16, 0.1]]) {
      starPath(ctx, sx * w, sy * h, r * h, 5, 0.5);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    for (const sx of [-0.55, 0, 0.55]) {
      starPath(ctx, sx * w, -h * 0.4, h * 0.055, 4, 0.4);
      ctx.fill();
    }
  } else {
    const colors = ["#f87171", "#fb923c", "#4ade80", "#38bdf8", "#a78bfa"];
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-w, -h * 0.62 + i * h * 0.065, w * 2, h * 0.07);
    });
    ctx.fillStyle = "#ffffff";
    starPath(ctx, 0, -h * 0.17, h * 0.1, 5, 0.5);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ellipse(ctx, -w * 0.42, -h * 0.68, w * 0.2, h * 0.11, -0.5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = shade(rarity === 0 ? b.egg.spot : info.dark, -0.2);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, size * 0.035);
  eggPath(ctx, w, h);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------- Scenery ---------- */

const FLOWER_COLORS = ["#fb7185", "#f472b6", "#ffffff", "#fde047", "#c084fc", "#fb923c"];

function drawDecor(ctx: Ctx, d: Decor, t: number) {
  const s = d.s;
  const pick = <T,>(arr: T[]) => arr[Math.floor(d.seed * arr.length) % arr.length];
  ctx.save();
  ctx.translate(d.x, d.y);
  switch (d.kind as DecorKind) {
    case "flower": {
      ctx.fillStyle = pick(FLOWER_COLORS);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + d.seed * 6;
        ellipse(ctx, Math.cos(a) * 5 * s, Math.sin(a) * 5 * s, 4 * s, 4 * s);
        ctx.fill();
      }
      ctx.fillStyle = "#f59e0b";
      ellipse(ctx, 0, 0, 3.2 * s, 3.2 * s);
      ctx.fill();
      break;
    }
    case "tuft":
      ctx.strokeStyle = "rgba(40, 110, 30, 0.45)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      for (const dx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(dx * s * 0.5, 4);
        ctx.quadraticCurveTo(dx * s * 0.7, -4 * s, dx * s * 1.3, -9 * s);
        ctx.stroke();
      }
      break;
    case "shell":
      ctx.rotate(d.seed * 6);
      ctx.fillStyle = pick(["#fecdd3", "#fff7ed", "#fbcfe8"]);
      ctx.beginPath();
      ctx.moveTo(0, 6 * s);
      ctx.arc(0, 0, 8 * s, Math.PI * 1.1, Math.PI * 1.9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(190, 110, 90, 0.5)";
      ctx.lineWidth = 1;
      for (const a of [1.3, 1.5, 1.7]) {
        ctx.beginPath();
        ctx.moveTo(0, 6 * s);
        ctx.lineTo(Math.cos(Math.PI * a) * 8 * s, Math.sin(Math.PI * a) * 8 * s);
        ctx.stroke();
      }
      break;
    case "starfish":
      ctx.fillStyle = pick(["#fb923c", "#f87171", "#f472b6"]);
      starPath(ctx, 0, 0, 9 * s, 5, 0.48, d.seed * 6);
      ctx.fill();
      break;
    case "snowdot":
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const [dx, dy, r] of [[0, 0, 5], [9, 3, 3], [-7, 5, 3.5]]) {
        ellipse(ctx, dx * s, dy * s, r * s, r * s * 0.7);
        ctx.fill();
      }
      break;
    case "icepatch":
      ctx.fillStyle = "rgba(147, 197, 253, 0.45)";
      ellipse(ctx, 0, 0, 22 * s, 9 * s, d.seed * 0.6 - 0.3);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8 * s, -2 * s);
      ctx.lineTo(2 * s, -4 * s);
      ctx.stroke();
      break;
    case "sprinkle":
      ctx.rotate(d.seed * 6);
      ctx.strokeStyle = pick(SPRINKLE_COLORS);
      ctx.lineWidth = 4.5 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5 * s, 0);
      ctx.lineTo(5 * s, 0);
      ctx.stroke();
      break;
    case "swirl":
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let a = 0; a < 9; a += 0.3) {
        const r = a * 1.5 * s;
        const px = Math.cos(a + d.seed * 6) * r;
        const py = Math.sin(a + d.seed * 6) * r * 0.7;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    case "star":
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + d.seed * 20));
      ctx.fillStyle = pick(["#ffffff", "#fde68a", "#c7d2fe"]);
      starPath(ctx, 0, 0, 5.5 * s, 4, 0.32);
      ctx.fill();
      break;
    case "crater":
      ctx.fillStyle = "rgba(10, 8, 40, 0.38)";
      ellipse(ctx, 0, 0, 18 * s, 8 * s);
      ctx.fill();
      ctx.strokeStyle = "rgba(165, 180, 252, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * s, 8 * s, 0, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawSolid(ctx: Ctx, s: Solid) {
  const r = s.r;
  shadow(ctx, s.x, s.y + r * 0.3, r * 1.1, 0.2);
  ctx.save();
  ctx.translate(s.x, s.y);
  switch (s.kind as SolidKind) {
    case "tree": {
      ctx.fillStyle = "#8a5a33";
      roundRect(ctx, -6, -r * 0.9, 12, r * 1.2, 4);
      ctx.fill();
      const greens = ["#3f9b46", "#4fb357", "#63c768"];
      [[-r * 0.5, -r * 1.25, r * 0.78], [r * 0.5, -r * 1.3, r * 0.76], [0, -r * 1.85, r * 0.86]].forEach(([dx, dy, rr], i) => {
        ctx.fillStyle = greens[i];
        ellipse(ctx, dx, dy, rr, rr);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ellipse(ctx, -r * 0.25, -r * 2.15, r * 0.3, r * 0.2, -0.4);
      ctx.fill();
      break;
    }
    case "bush":
      [[-r * 0.55, -r * 0.3, r * 0.62, "#4aa851"], [r * 0.55, -r * 0.34, r * 0.62, "#4aa851"], [0, -r * 0.7, r * 0.74, "#5fc266"]].forEach(([dx, dy, rr, c]) => {
        ctx.fillStyle = c as string;
        ellipse(ctx, dx as number, dy as number, rr as number, rr as number);
        ctx.fill();
      });
      ctx.fillStyle = "#f43f5e";
      for (const [dx, dy] of [[-r * 0.5, -r * 0.5], [r * 0.3, -r * 0.85], [r * 0.6, -r * 0.3]]) {
        ellipse(ctx, dx, dy, 3.2, 3.2);
        ctx.fill();
      }
      break;
    case "palm": {
      ctx.strokeStyle = "#a0703c";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-8, -r * 1.2, 6, -r * 2.2);
      ctx.stroke();
      ctx.fillStyle = "#34a853";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        ctx.save();
        ctx.translate(6, -r * 2.2);
        ctx.rotate(a);
        ellipse(ctx, r * 0.7, 0, r * 0.75, r * 0.22);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#6b4423";
      ellipse(ctx, 2, -r * 2.05, 4.5, 4.5);
      ctx.fill();
      ellipse(ctx, 11, -r * 2.05, 4.5, 4.5);
      ctx.fill();
      break;
    }
    case "rock":
    case "moonrock": {
      const moon = s.kind === "moonrock";
      ctx.fillStyle = moon ? "#6e66a8" : "#9aa3ad";
      ctx.beginPath();
      ctx.moveTo(-r, 2);
      ctx.quadraticCurveTo(-r * 1.05, -r * 0.9, -r * 0.3, -r * 1.15);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.35, r * 0.95, -r * 0.5);
      ctx.quadraticCurveTo(r * 1.2, 2, r * 0.6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = moon ? "#8f87c9" : "#c3cad2";
      ellipse(ctx, -r * 0.25, -r * 0.8, r * 0.36, r * 0.18, -0.4);
      ctx.fill();
      if (moon) {
        ctx.fillStyle = "rgba(30, 20, 80, 0.35)";
        ellipse(ctx, r * 0.35, -r * 0.45, r * 0.2, r * 0.12);
        ctx.fill();
        ellipse(ctx, -r * 0.45, -r * 0.3, r * 0.13, r * 0.08);
        ctx.fill();
      }
      break;
    }
    case "pine":
      ctx.fillStyle = "#7a5230";
      roundRect(ctx, -5, -r * 0.5, 10, r * 0.7, 3);
      ctx.fill();
      [[0, r * 1.05], [-r * 0.75, r * 0.9], [-r * 1.45, r * 0.72]].forEach(([dy, w]) => {
        ctx.fillStyle = "#2f8f6b";
        ctx.beginPath();
        ctx.moveTo(-w, -r * 0.4 + dy);
        ctx.lineTo(0, -r * 1.5 + dy);
        ctx.lineTo(w, -r * 0.4 + dy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, -r * 1.02 + dy);
        ctx.lineTo(0, -r * 1.5 + dy);
        ctx.lineTo(w * 0.42, -r * 1.02 + dy);
        ctx.quadraticCurveTo(w * 0.2, -r * 0.86 + dy, 0, -r * 1.0 + dy);
        ctx.quadraticCurveTo(-w * 0.2, -r * 0.86 + dy, -w * 0.42, -r * 1.02 + dy);
        ctx.fill();
      });
      break;
    case "snowpile":
      // A little snowman.
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#b9d6ea";
      ctx.lineWidth = 2;
      ellipse(ctx, 0, -r * 0.6, r * 0.95, r * 0.85);
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, 0, -r * 1.75, r * 0.66, r * 0.62);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ellipse(ctx, -r * 0.24, -r * 1.86, 2.6, 2.6);
      ctx.fill();
      ellipse(ctx, r * 0.24, -r * 1.86, 2.6, 2.6);
      ctx.fill();
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.72);
      ctx.lineTo(r * 0.5, -r * 1.62);
      ctx.lineTo(0, -r * 1.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      roundRect(ctx, -r * 0.62, -r * 1.3, r * 1.24, r * 0.22, 4);
      ctx.fill();
      break;
    case "lollipop": {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r * 2.2);
      ctx.stroke();
      const cyy = -r * 2.6;
      const colors = s.seed > 0.5 ? ["#f43f5e", "#ffffff"] : ["#38bdf8", "#fef08a"];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = colors[i % 2];
        ctx.beginPath();
        ctx.moveTo(0, cyy);
        ctx.arc(0, cyy, r * 1.05, (i / 8) * TAU, ((i + 1) / 8) * TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ellipse(ctx, -r * 0.35, cyy - r * 0.4, r * 0.3, r * 0.17, -0.5);
      ctx.fill();
      break;
    }
    case "gumdrop": {
      const c = ["#22c55e", "#f97316", "#a855f7", "#ef4444"][Math.floor(s.seed * 4) % 4];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-r, 2);
      ctx.quadraticCurveTo(-r * 0.95, -r * 1.5, 0, -r * 1.5);
      ctx.quadraticCurveTo(r * 0.95, -r * 1.5, r, 2);
      ctx.quadraticCurveTo(0, 8, -r, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      for (const [dx, dy] of [[-0.5, -0.5], [0.3, -0.9], [0.55, -0.3], [-0.1, -0.2], [-0.25, -1.15]]) {
        ellipse(ctx, dx * r, dy * r, 2, 2);
        ctx.fill();
      }
      break;
    }
    case "crystal": {
      const c = ["#67e8f9", "#f0abfc", "#a5b4fc"][Math.floor(s.seed * 3) % 3];
      [[-r * 0.5, r * 1.1, -0.3], [r * 0.5, r * 1.3, 0.3], [0, r * 2, 0]].forEach(([dx, h, rot]) => {
        ctx.save();
        ctx.translate(dx, 0);
        ctx.rotate(rot);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(-r * 0.36, 0);
        ctx.lineTo(-r * 0.36, -h * 0.72);
        ctx.lineTo(0, -h);
        ctx.lineTo(r * 0.36, -h * 0.72);
        ctx.lineTo(r * 0.36, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.moveTo(-r * 0.36, 0);
        ctx.lineTo(-r * 0.36, -h * 0.72);
        ctx.lineTo(0, -h);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      break;
    }
  }
  ctx.restore();
}

function drawHut(ctx: Ctx) {
  const { x, y, r } = HUT;
  shadow(ctx, x, y + r * 0.5, r * 1.25, 0.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fde9c4";
  roundRect(ctx, -r * 0.9, -r * 0.7, r * 1.8, r * 1.25, 10);
  ctx.fill();
  ctx.strokeStyle = "#c79a5b";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#ef6f6c";
  ctx.beginPath();
  ctx.moveTo(-r * 1.15, -r * 0.6);
  ctx.quadraticCurveTo(0, -r * 2.1, r * 1.15, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ellipse(ctx, -r * 0.3, -r * 1.2, r * 0.3, r * 0.12, -0.5);
  ctx.fill();
  ctx.fillStyle = "#9a6a3a";
  roundRect(ctx, -r * 0.24, -r * 0.2, r * 0.48, r * 0.75, 12);
  ctx.fill();
  ctx.fillStyle = "#fcd34d";
  ellipse(ctx, r * 0.12, r * 0.2, 3, 3);
  ctx.fill();
  ctx.fillStyle = "#bae6fd";
  ellipse(ctx, r * 0.55, -r * 0.18, r * 0.16, r * 0.16);
  ctx.fill();
  ctx.strokeStyle = "#c79a5b";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawFenceRun(ctx: Ctx, x0: number, x1: number, y: number, color: string) {
  if (x1 <= x0) return;
  const dark = shade(color, -0.28);
  ctx.fillStyle = color;
  roundRect(ctx, x0, y - 20, x1 - x0, 6, 3);
  ctx.fill();
  roundRect(ctx, x0, y - 9, x1 - x0, 6, 3);
  ctx.fill();
  const n = Math.max(1, Math.round((x1 - x0) / 42));
  for (let i = 0; i <= n; i++) {
    const px = x0 + ((x1 - x0) * i) / n;
    ctx.fillStyle = dark;
    roundRect(ctx, px - 4, y - 27, 8, 31, 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, px - 4, y - 27, 5, 31, 3);
    ctx.fill();
  }
}

/** The fence across the bottom of a biome, with its gate. */
function drawGate(ctx: Ctx, biome: number, speedLevel: number, x0: number, x1: number, t: number) {
  const b = BIOMES[biome];
  const y = biomeBottom(biome);
  const gx0 = CENTER_X - GATE_W / 2;
  const gx1 = CENTER_X + GATE_W / 2;
  drawFenceRun(ctx, Math.max(x0 - 40, 0), gx0, y, b.fence);
  drawFenceRun(ctx, gx1, Math.min(x1 + 40, WORLD_W), y, b.fence);

  const open = speedLevel >= b.speedReq;
  const dark = shade(b.fence, -0.3);

  if (!open) {
    // Bars across the gateway.
    ctx.fillStyle = b.fence;
    for (let i = 1; i < 6; i++) {
      const px = gx0 + ((gx1 - gx0) * i) / 6;
      roundRect(ctx, px - 4, y - 48, 8, 52, 3);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    roundRect(ctx, gx0, y - 40, gx1 - gx0, 7, 3);
    ctx.fill();
    roundRect(ctx, gx0, y - 14, gx1 - gx0, 7, 3);
    ctx.fill();
  }

  // Gate posts and the name banner.
  for (const px of [gx0, gx1]) {
    ctx.fillStyle = dark;
    roundRect(ctx, px - 9, y - 78, 18, 84, 6);
    ctx.fill();
    ctx.fillStyle = b.fence;
    roundRect(ctx, px - 9, y - 78, 12, 84, 6);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ellipse(ctx, px, y - 82, 9, 9);
    ctx.fill();
  }
  const bob = open ? Math.sin(t * 2 + biome) * 1.5 : 0;
  ctx.fillStyle = open ? "#ffffff" : "#fee2e2";
  roundRect(ctx, gx0 + 6, y - 112 + bob, gx1 - gx0 - 12, 32, 12);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.stroke();
  label(ctx, b.name, CENTER_X, y - 95.5 + bob, 17, shade(b.fence, -0.55));

  if (!open) {
    // Padlock + what you need.
    const ly = y - 24;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(CENTER_X - 48, ly - 12, 9, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    roundRect(ctx, CENTER_X - 62, ly - 12, 28, 24, 6);
    ctx.fill();
    ctx.fillStyle = "#92400e";
    ellipse(ctx, CENTER_X - 48, ly - 1, 3.5, 3.5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    roundRect(ctx, CENTER_X - 28, ly - 13, 96, 26, 13);
    ctx.fill();
    label(ctx, `Speed ${b.speedReq}`, CENTER_X + 20, ly + 0.5, 16, "#b91c1c");
  }
}

function drawNest(ctx: Ctx, x: number, y: number, golden: boolean, t: number) {
  const straw = golden ? "#fbbf24" : "#c99a4e";
  const dark = golden ? "#b45309" : "#8a6230";
  ctx.fillStyle = dark;
  ellipse(ctx, x, y + 3, 34, 15);
  ctx.fill();
  ctx.fillStyle = straw;
  ellipse(ctx, x, y, 34, 14);
  ctx.fill();
  ctx.fillStyle = dark;
  ellipse(ctx, x, y - 1, 23, 8);
  ctx.fill();
  ctx.strokeStyle = shade(straw, 0.3);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 26, y + Math.sin(a) * 9);
    ctx.lineTo(x + Math.cos(a + 0.5) * 33, y + Math.sin(a + 0.5) * 12);
    ctx.stroke();
  }
  if (golden) {
    ctx.fillStyle = "#fef9c3";
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.4 + i * 2));
      starPath(ctx, x + [-36, 34, 4][i], y + [-10, -14, 18][i], 5, 4, 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- Ground ---------- */

interface Patch {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
let patches: Patch[] | null = null;

function groundPatches(): Patch[] {
  if (patches) return patches;
  patches = [];
  let a = 7331;
  const rng = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 70; i++) {
    patches.push({
      x: rng() * WORLD_W,
      y: rng() * WORLD_H,
      rx: 50 + rng() * 90,
      ry: 22 + rng() * 34,
    });
  }
  return patches;
}

function drawGround(ctx: Ctx, x0: number, x1: number, y0: number, y1: number) {
  for (let i = 0; i < BIOME_COUNT; i++) {
    const top = biomeTop(i);
    const bottom = biomeBottom(i);
    if (bottom < y0 || top > y1) continue;
    ctx.fillStyle = BIOMES[i].ground;
    ctx.fillRect(x0 - 2, top, x1 - x0 + 4, bottom - top + 1);
  }
  if (WORLD_H > y0 && HOME_TOP < y1) {
    ctx.fillStyle = HOME_GROUND;
    ctx.fillRect(x0 - 2, HOME_TOP, x1 - x0 + 4, y1 - HOME_TOP + 4);
  }
  if (y0 < 0) {
    ctx.fillStyle = BIOMES[BIOME_COUNT - 1].ground2;
    ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, -y0 + 2);
  }

  // Big soft blotches so the ground isn't one flat colour.
  for (const p of groundPatches()) {
    if (p.y + p.ry < y0 || p.y - p.ry > y1) continue;
    const top = p.y - p.ry;
    const bottom = p.y + p.ry;
    const b = biomeAt(p.y);
    const home = b < 0;
    // Skip blotches that would straddle two areas.
    if (home ? top < HOME_TOP || bottom > WORLD_H : top < biomeTop(b) || bottom > biomeBottom(b)) continue;
    ctx.fillStyle = home ? HOME_GROUND_2 : BIOMES[b].ground2;
    ellipse(ctx, p.x, p.y, p.rx, p.ry);
    ctx.fill();
  }

  // The path up the middle.
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < BIOME_COUNT; i++) {
    const top = biomeTop(i);
    const bottom = biomeBottom(i);
    if (bottom < y0 || top > y1) continue;
    ctx.fillStyle = BIOMES[i].path;
    if (i === BIOME_COUNT - 1) {
      // The far end of the path rounds off below the last Grumble.
      ctx.save();
      ctx.beginPath();
      ctx.rect(CENTER_X - 62, top, 124, bottom - top);
      ctx.clip();
      roundRect(ctx, CENTER_X - 62, top + 300, 124, bottom - top, 60);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillRect(CENTER_X - 62, top, 124, bottom - top);
    }
  }
  ctx.globalAlpha = 1;
  if (HOME_TOP < y1) {
    ctx.fillStyle = HOME_PATH;
    ctx.globalAlpha = 0.8;
    roundRect(ctx, CENTER_X - 62, HOME_TOP - 40, 124, PAD_Y - HOME_TOP + 100, 60);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Shade whatever lies beyond the edge of the world.
  ctx.fillStyle = "rgba(20, 14, 50, 0.22)";
  if (x0 < 0) ctx.fillRect(x0 - 2, y0 - 2, -x0 + 2, y1 - y0 + 4);
  if (x1 > WORLD_W) ctx.fillRect(WORLD_W, y0 - 2, x1 - WORLD_W + 2, y1 - y0 + 4);
}

function drawHome(ctx: Ctx, g: Game, t: number) {
  // Pet pen: soft straw floor with a fence around the back and sides.
  ctx.fillStyle = "#e9d7a0";
  roundRect(ctx, PEN.x0 - 14, PEN.y0 - 10, PEN.x1 - PEN.x0 + 28, PEN.y1 - PEN.y0 + 26, 28);
  ctx.fill();
  ctx.fillStyle = "#f3e5b5";
  roundRect(ctx, PEN.x0 + 6, PEN.y0 + 8, PEN.x1 - PEN.x0 - 12, PEN.y1 - PEN.y0 - 10, 22);
  ctx.fill();
  drawFenceRun(ctx, PEN.x0 - 14, CENTER_X - 70, PEN.y0 - 4, "#d9a066");
  drawFenceRun(ctx, CENTER_X + 70, PEN.x1 + 14, PEN.y0 - 4, "#d9a066");

  // Egg pads.
  for (let i = 0; i < g.pads.length; i++) {
    const x = padX(i);
    drawNest(ctx, x, PAD_Y, false, t);
  }

  // Painted-on labels, so they never get clipped at the edge of a phone.
  ctx.globalAlpha = 0.5;
  label(ctx, "PET PEN", CENTER_X, PEN.y0 + 26, 15, "#8a6a2b", undefined, 600);
  ctx.globalAlpha = 1;
}

/* ---------- View ---------- */

export interface View {
  w: number;
  h: number;
  scale: number;
  camX: number;
  camY: number;
}

export function computeView(g: Game, w: number, h: number): View {
  const scale = Math.max(0.58, Math.min(1.4, Math.min(w / 500, h / 640)));
  const visW = w / scale;
  const visH = h / scale;
  const camX = visW >= WORLD_W ? WORLD_W / 2 : Math.max(visW / 2, Math.min(WORLD_W - visW / 2, g.player.x));
  const camY = visH >= WORLD_H ? WORLD_H / 2 : Math.max(visH / 2, Math.min(WORLD_H - visH / 2, g.player.y - visH * 0.04));
  return { w, h, scale, camX, camY };
}

export function screenToWorld(v: View, sx: number, sy: number): Point {
  return {
    x: (sx - v.w / 2) / v.scale + v.camX,
    y: (sy - v.h / 2) / v.scale + v.camY,
  };
}

export interface Joystick {
  active: boolean;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  /** How far the knob can travel, in px. */
  r: number;
}

interface Drawable {
  y: number;
  draw: () => void;
}

function guardMood(gd: Guard): Mood {
  if (gd.state === "sleep") return "sleep";
  if (gd.state === "chase") return "angry";
  return "normal";
}

export function render(
  ctx: Ctx,
  g: Game,
  v: View,
  dpr: number,
  t: number,
  joy: Joystick | null,
  playerLook: Look,
  showHints: boolean,
) {
  const { w, h, scale } = v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const visW = w / scale;
  const visH = h / scale;
  const x0 = v.camX - visW / 2;
  const x1 = v.camX + visW / 2;
  const y0 = v.camY - visH / 2;
  const y1 = v.camY + visH / 2;
  const seen = (y: number, pad = 120) => y > y0 - pad && y < y1 + pad;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-v.camX, -v.camY);

  drawGround(ctx, x0, x1, y0, y1);
  for (const d of g.decor) if (seen(d.y, 30)) drawDecor(ctx, d, t);
  if (seen(HOME_TOP + 280, 420)) drawHome(ctx, g, t);
  for (const n of g.nests) if (seen(n.y, 60)) drawNest(ctx, n.x, n.y, n.golden, t);

  const items: Drawable[] = [];

  for (const s of g.solids) {
    if (!seen(s.y, 160)) continue;
    if (s.seed < 0) items.push({ y: s.y, draw: () => drawHut(ctx) });
    else items.push({ y: s.y, draw: () => drawSolid(ctx, s) });
  }

  for (let i = 0; i < BIOME_COUNT; i++) {
    const line = biomeBottom(i);
    if (seen(line, 140)) items.push({ y: line, draw: () => drawGate(ctx, i, g.up.speed, x0, x1, t) });
  }

  for (const n of g.nests) {
    if (n.egg === null || !seen(n.y, 80)) continue;
    const rarity = n.egg;
    items.push({
      y: n.y + 1,
      draw: () => {
        const pop = Math.min(1, n.age / 0.3);
        const s = 1 + Math.sin(pop * Math.PI) * 0.25;
        const bob = Math.sin(t * 3 + n.x) * 1.5;
        drawEgg(ctx, n.biome, rarity, n.x, n.y + 2 + bob, 38 * pop * s, t, Math.sin(t * 2 + n.y) * 0.06);
      },
    });
  }

  for (const gd of g.guards) {
    if (!seen(gd.y, 160)) continue;
    items.push({
      y: gd.y,
      draw: () => {
        const look = BIOMES[gd.biome].guard;
        const breathing = gd.state === "sleep" ? 1 + Math.sin(t * 2) * 0.025 : 1;
        const stomp = gd.state === "chase" || gd.state === "return" ? Math.abs(Math.sin(gd.walkT * 9)) * 6 : 0;
        const shakeX = gd.state === "waking" ? Math.sin(t * 40) * 2.5 : 0;
        shadow(ctx, gd.x, gd.y + 6, 44, 0.22);
        drawPet(ctx, look, gd.x + shakeX, gd.y + 6 - stomp, 96 * breathing, {
          t,
          flip: gd.flip,
          mood: guardMood(gd),
          seed: gd.biome,
        });
        if (gd.state === "sleep") {
          const ph = (t * 0.6) % 1;
          for (let k = 0; k < 3; k++) {
            const p = (ph + k / 3) % 1;
            ctx.globalAlpha = 1 - p;
            label(ctx, "z", gd.x + 34 + p * 26, gd.y - 84 - p * 40, 14 + p * 12, BIOMES[gd.biome].ink, undefined, 700);
          }
          ctx.globalAlpha = 1;
        } else if (gd.state === "waking") {
          ctx.fillStyle = "#ef4444";
          ellipse(ctx, gd.x, gd.y - 118, 17, 17);
          ctx.fill();
          label(ctx, "!", gd.x, gd.y - 117, 24, "#ffffff");
        } else if (gd.state === "huff") {
          label(ctx, "hmph!", gd.x, gd.y - 112, 17, "#ffffff", "#475569");
        }
      },
    });
  }

  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i];
    if (!pad.egg || !seen(PAD_Y, 100)) continue;
    const egg = pad.egg;
    const x = padX(i);
    items.push({
      y: PAD_Y + 1,
      draw: () => {
        const done = 1 - Math.max(0, pad.left) / pad.total;
        const rattle = pad.blocked ? 0 : Math.sin(t * (10 + done * 22) + i) * (0.03 + done * 0.1);
        const tilt = rattle + Math.sin(t * 30) * pad.wobble * 0.22;
        drawEgg(ctx, egg.biome, egg.rarity, x, PAD_Y + 3, 44 * (1 + pad.wobble * 0.12), t, tilt);
        // Hatch progress bar.
        ctx.fillStyle = "rgba(60, 40, 10, 0.3)";
        roundRect(ctx, x - 30, PAD_Y + 22, 60, 9, 5);
        ctx.fill();
        ctx.fillStyle = pad.blocked ? "#ef4444" : RARITIES[egg.rarity].color;
        roundRect(ctx, x - 28, PAD_Y + 24, Math.max(5, 56 * done), 5, 3);
        ctx.fill();
        if (pad.blocked) {
          label(ctx, "Pen full!", x, PAD_Y - 62, 15, "#ffffff", "#dc2626");
        } else if (showHints) {
          const bounce = Math.abs(Math.sin(t * 5)) * 5;
          label(ctx, "Tap!", x, PAD_Y - 62 - bounce, 17, "#ffffff", "#f97316");
        }
      },
    });
  }

  if (seen(PEN.y0, 300)) {
    for (const pet of g.pets) {
      const def = petById(pet.id);
      if (!def) continue;
      items.push({
        y: pet.y,
        draw: () => {
          const born = Math.min(1, pet.age / 0.45);
          const pop = born < 1 ? 0.3 + born * 0.7 + Math.sin(born * Math.PI) * 0.3 : 1;
          const hopY = pet.wait > 0 ? 0 : Math.abs(Math.sin(pet.hop)) * 6;
          const size = (34 + def.rarity * 4) * pop;
          shadow(ctx, pet.x, pet.y + 1, size * 0.4, 0.16);
          drawPet(ctx, def.look, pet.x, pet.y - hopY, size, { t, flip: pet.flip, seed: pet.uid, mood: born < 1 ? "happy" : "normal" });
          if (pet.shiny) sparkles(ctx, pet.x, pet.y - hopY, size, t, pet.uid);
        },
      });
    }
    // Front rail of the pen overlaps the pets standing behind it.
    items.push({
      y: PEN.y1 + 16,
      draw: () => drawFenceRun(ctx, PEN.x0 - 14, PEN.x1 + 14, PEN.y1 + 22, "#d9a066"),
    });
  }

  const p = g.player;
  items.push({
    y: p.y,
    draw: () => {
      const bob = p.moving ? Math.abs(Math.sin(p.walkT * 11)) * 5 : 0;
      const lean = p.moving ? Math.sin(p.walkT * 11) * 0.05 : 0;
      shadow(ctx, p.x, p.y + 2, 17, 0.22);
      ctx.save();
      ctx.translate(p.x, p.y - bob);
      ctx.rotate(lean + (p.stun > 0 ? Math.sin(t * 30) * 0.12 : 0));
      drawPet(ctx, playerLook, 0, 0, 46, { t, flip: p.flip, mood: p.stun > 0 ? "dizzy" : p.carry.length ? "happy" : "normal", seed: 3 });
      ctx.restore();
      if (p.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const a = t * 7 + (k / 3) * TAU;
          ctx.fillStyle = "#fde047";
          starPath(ctx, p.x + Math.cos(a) * 20, p.y - 52 + Math.sin(a) * 6, 6, 5, 0.5);
          ctx.fill();
        }
      }
      p.carry.forEach((egg, k) => {
        const sway = Math.sin(p.walkT * 11 + k) * (p.moving ? 0.12 : 0.03);
        drawEgg(ctx, egg.biome, egg.rarity, p.x + sway * 20, p.y - bob - 44 - k * 22, 30, t, sway);
      });
    },
  });

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // Eggs flying to their pads.
  for (const f of g.flights) {
    const k = Math.max(0, Math.min(1, f.t / f.dur));
    const e = k * k * (3 - 2 * k);
    const x = f.x0 + (f.x1 - f.x0) * e;
    const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 70;
    drawEgg(ctx, f.egg.biome, f.egg.rarity, x, y + 14, 34, t, k * TAU);
  }

  for (const pt of g.particles) {
    ctx.globalAlpha = Math.min(1, (pt.life / pt.max) * 1.6);
    ctx.fillStyle = pt.color;
    if (pt.kind === "star") {
      starPath(ctx, pt.x, pt.y, pt.size, 4, 0.4, pt.life * 6);
      ctx.fill();
    } else {
      ellipse(ctx, pt.x, pt.y, pt.size, pt.size);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const pop of g.popups) {
    const k = pop.life / pop.max;
    ctx.globalAlpha = Math.min(1, k * 2.5);
    const grow = pop.big ? 1 + Math.sin(Math.min(1, (1 - k) * 5) * Math.PI) * 0.25 : 1;
    label(ctx, pop.text, pop.x, pop.y, (pop.big ? 22 : 14) * grow, pop.big ? "#ffffff" : "#fff7d6", pop.color);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // ── Screen-space helpers ──
  // Bigger pointers on tablets, to match the bigger HUD there.
  const ui = Math.min(w, h) >= 700 ? 1.4 : 1;
  const bounce = Math.sin(t * 6) * 5;
  const padsOnScreen = PAD_Y < y1 - 40;
  if (p.carry.length && !padsOnScreen) {
    arrow(ctx, w / 2, h - (ui > 1 ? 180 : 124) + bounce, Math.PI / 2, "Home", ui);
  } else if (showHints && !p.carry.length && g.biome < 0 && g.pads.every((pad) => !pad.egg)) {
    arrow(ctx, w / 2, (ui > 1 ? 130 : 96) - bounce, -Math.PI / 2, "Find an egg", ui);
  }

  if (joy?.active) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ellipse(ctx, joy.ox, joy.oy, joy.r + 2, joy.r + 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ellipse(ctx, joy.ox + joy.dx, joy.oy + joy.dy, joy.r * 0.45, joy.r * 0.45);
    ctx.fill();
    ctx.strokeStyle = "rgba(30, 20, 60, 0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function arrow(ctx: Ctx, x: number, y: number, angle: number, text: string, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-6, -18);
  ctx.lineTo(-6, 18);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  const dy = Math.sin(angle) > 0 ? -32 : 34;
  label(ctx, text, 0, dy, 18, "#ffffff", "#f97316");
  ctx.restore();
}

/* ---------- Pictures for the menus ---------- */

/** Paint one pet centred on a small square canvas (for the book, shop, etc.). */
export function paintPetIcon(canvas: HTMLCanvasElement, look: Look, cssSize: number, mood: Mood = "normal") {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  drawPet(ctx, look, cssSize / 2, cssSize * 0.88, cssSize * 0.72, { mood });
}

export function paintEggIcon(canvas: HTMLCanvasElement, biome: number, rarity: Rarity, cssSize: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  drawEgg(ctx, biome, rarity, cssSize / 2, cssSize * 0.86, cssSize * 0.7);
}
