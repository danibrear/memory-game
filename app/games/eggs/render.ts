// ─── Sneaky Eggs: Canvas 2D drawing ─────────────────────────────────────────
//
// Pets, the player and the Grumbles all come from one little critter drawer
// (`drawPet`), so every creature shares the same chunky, friendly look.

import {
  BILLBOARD,
  GUARD_HP,
  BIOME_COUNT,
  BIOMES,
  CENTER_X,
  CHEST,
  CHEST_MS,
  GATE_W,
  HOME_TOP,
  HUT,
  LOLLIPOP_COOLDOWN,
  LOLLIPOP_NEAR,
  PAD_Y,
  PEN,
  RARITIES,
  GLOW,
  COMMON,
  UNCOMMON,
  RARE,
  EPIC,
  LEGENDARY,
  MYTHIC,
  UFO,
  WORLD_H,
  WORLD_W,
  biomeAt,
  biomeBottom,
  biomeTop,
  nightAmount,
  padX,
  petById,
  MEDAL_COLORS,
  MINI_DOOR_R,
  MINI_R,
  MINIS,
  POWERUPS,
  SIZES,
  WING_X,
  ZIP_LOOK,
  powerEggById,
  type MiniDef,
  type DecorKind,
  type PowerupId,
  type Look,
  type Point,
  type Rarity,
  type SolidKind,
  DEFAULT_PAINT,
  PLOTS,
  BUILDING_IDS,
  fmtCountdown,
  paintColor,
  type BuildingId,
  type HousePaint,
} from "./config";
import {
  buildBlock,
  jobFor,
  jobLeft,
  jobProgress,
  readyToCollect,
  stockOf,
  type Ancient,
  type Bug,
  type Decor,
  type Game,
  type Guard,
  type Job,
  type Mini,
  type Mystery,
  type Particle,
  type Pickup,
  type Popup,
  type ShootingStar,
  type Solid,
} from "./engine";
import { FANSCOUT, FANSCOUT_MARK, FS } from "./fanscout";

/** Starry Space, where the star picture hangs. */
const SPACE = BIOMES.findIndex((b) => b.id === "space");

/* ---------- Hatch variants ---------- */

function hslHex(h: number, sat: number, lit: number): string {
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lit - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Hue (0-360), saturation and lightness (0-1) of a #rrggbb colour. */
function hexHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lit = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, lit];
  const sat = d / (1 - Math.abs(2 * lit - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hue * 60 + 360) % 360, sat, lit];
}

const glowLooks = new WeakMap<Look, Look>();

/**
 * A Glow pet wears its own special colours, the way a shiny does: every colour
 * swings to the far side of the colour wheel and turns neon, on a dark outline.
 */
function glowLook(look: Look): Look {
  let out = glowLooks.get(look);
  if (!out) {
    const swing = (hex: string, lit: number) => {
      const [h, s] = hexHsl(hex);
      // Greys have no hue of their own, so give them an electric blue.
      return hslHex(s < 0.12 ? 190 : (h + 150) % 360, 1, lit);
    };
    out = {
      ...look,
      body: swing(look.body, 0.6),
      belly: swing(look.body, 0.9),
      accent: swing(look.accent, 0.42),
      cheeks: swing(look.accent, 0.78),
      aura: swing(look.body, 0.7),
    };
    glowLooks.set(look, out);
  }
  return out;
}

/**
 * Recolour a critter for its hatch variant: Golden is solid gold, Rainbow slowly
 * cycles through every colour, Glow is its special neon colouring. Plain and
 * Shiny keep their own colours.
 */
export function variantLook(look: Look, variant: number, t = 0, seed = 0): Look {
  if (variant === GLOW) return glowLook(look);
  if (variant === 2) {
    return { ...look, body: "#fbbf24", belly: "#fef3c7", accent: "#d97706", cheeks: "#fb923c", aura: look.aura ?? "rgba(253, 224, 71, 0.5)" };
  }
  if (variant >= 3) {
    // Step the hue so the colour cache stays small.
    const hue = (Math.floor(t * 12) * 5 + seed * 47) % 360;
    return {
      ...look,
      body: hslHex(hue, 0.85, 0.68),
      belly: "#ffffff",
      accent: hslHex((hue + 150) % 360, 0.9, 0.6),
      cheeks: hslHex((hue + 300) % 360, 0.9, 0.75),
      aura: `hsla(${(hue + 60) % 360}, 95%, 75%, 0.6)`,
    };
  }
  return look;
}

/** A ring that fills clockwise from the top. */
export function progressRing(ctx: Ctx, x: number, y: number, r: number, k: number, color: string, width = 5) {
  ctx.lineCap = "round";
  ctx.lineWidth = width + 3;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, Math.min(1, k)));
  ctx.stroke();
  ctx.lineCap = "butt";
}

export const TAU = Math.PI * 2;
export const FONT = '"Fredoka", "Inter", system-ui, sans-serif';
export const HOME_GROUND = "#a8e083";
export const HOME_GROUND_2 = "#97d472";
export const HOME_PATH = "#f3e2ad";

export type Ctx = CanvasRenderingContext2D;

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

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function starPath(ctx: Ctx, x: number, y: number, r: number, points = 5, inner = 0.45, rot = -Math.PI / 2) {
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

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function label(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, stroke?: string, weight = 700) {
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

export function shadow(ctx: Ctx, x: number, y: number, rx: number, alpha = 0.18) {
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

  // Mythic glow.
  if (look.aura) {
    const pulse = 0.8 + 0.2 * Math.sin(t * 3 + seed);
    const glow = ctx.createRadialGradient(0, cy, 0.1, 0, cy, 0.9);
    glow.addColorStop(0, look.aura);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.6 * pulse;
    ctx.fillStyle = glow;
    ellipse(ctx, 0, cy, 0.9, 0.9);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

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
    ctx.fillStyle = look.hatColor ?? look.accent;
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
      ctx.fillStyle = look.hatColor ?? look.accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + s * 0.12, by - 0.07);
        ctx.lineTo(bx + s * 0.12, by + 0.07);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = shade(look.hatColor ?? look.accent, 0.35);
      ellipse(ctx, bx, by, 0.035, 0.035);
      ctx.fill();
      break;
    }
    case "party":
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.moveTo(-0.12, top + 0.07);
      ctx.lineTo(0, top - 0.26);
      ctx.lineTo(0.12, top + 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 0.035;
      for (const k of [0.0, -0.11]) {
        ctx.beginPath();
        ctx.moveTo(-0.1 - k * 0.33, top + k);
        ctx.lineTo(0.1 + k * 0.33, top + k - 0.03);
        ctx.stroke();
      }
      ctx.fillStyle = "#38bdf8";
      ellipse(ctx, 0, top - 0.27, 0.045, 0.045);
      ctx.fill();
      break;
    case "tophat":
      ctx.fillStyle = "#1f2937";
      ellipse(ctx, 0, top + 0.055, 0.2, 0.045);
      ctx.fill();
      roundRect(ctx, -0.125, top - 0.22, 0.25, 0.28, 0.03);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-0.125, top - 0.03, 0.25, 0.055);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(-0.095, top - 0.2, 0.04, 0.16);
      break;
    case "propeller": {
      const colors = ["#ef4444", "#facc15", "#38bdf8", "#4ade80"];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, top + 0.08);
        ctx.arc(0, top + 0.08, 0.19, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = "#475569";
      ctx.fillRect(-0.012, top - 0.2, 0.024, 0.1);
      const spin = Math.cos(t * 22 + seed);
      ctx.fillStyle = "#f97316";
      ellipse(ctx, 0, top - 0.2, 0.17 * Math.abs(spin) + 0.02, 0.028);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ellipse(ctx, 0, top - 0.2, 0.03, 0.03);
      ctx.fill();
      break;
    }
    case "wizard":
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.moveTo(-0.15, top + 0.07);
      ctx.quadraticCurveTo(-0.04, top - 0.16, 0.08, top - 0.36);
      ctx.quadraticCurveTo(0.08, top - 0.12, 0.15, top + 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#5b21b6";
      ellipse(ctx, 0, top + 0.07, 0.22, 0.045);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      starPath(ctx, 0.0, top - 0.08, 0.045, 5, 0.5);
      ctx.fill();
      starPath(ctx, 0.06, top - 0.24, 0.025, 5, 0.5);
      ctx.fill();
      break;
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
  // How loudly the egg glows: nothing for Common, a hint for Uncommon, more from there.
  const glowK = [0, 0.5, 1, 2, 3, 4.2][rarity] ?? 0;

  ctx.save();
  ctx.translate(x, y);

  if (glowK > 0) {
    // Glow so special eggs catch the eye from across the screen.
    const pulse = 0.75 + 0.25 * Math.sin(t * 4);
    const glow = ctx.createRadialGradient(0, -h * 0.5, h * 0.15, 0, -h * 0.5, h * (0.75 + glowK * 0.12));
    glow.addColorStop(0, info.color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = Math.min(0.75, 0.28 + glowK * 0.1) * pulse;
    ctx.fillStyle = glow;
    ellipse(ctx, 0, -h * 0.5, h * (0.75 + glowK * 0.12), h * (0.75 + glowK * 0.12));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (rarity >= LEGENDARY) {
    // Spinning rays: gold for Legendary, a double ring of rose and violet for Mythic.
    const rings = rarity === MYTHIC ? [["rgba(251, 113, 133, 0.42)", 0.8, 1.15], ["rgba(167, 139, 250, 0.38)", -1.3, 0.85]] : [["rgba(253, 224, 71, 0.4)", 0.8, 0.95]];
    for (const [color, spin, reach] of rings as [string, number, number][]) {
      ctx.save();
      ctx.translate(0, -h * 0.5);
      ctx.rotate(t * spin);
      ctx.fillStyle = color;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(TAU / 8);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-h * 0.1, -h * reach);
        ctx.lineTo(h * 0.1, -h * reach);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  ctx.rotate(tilt);
  const base = [b.egg.base, "#dcfce7", "#dbeafe", "#ede9fe", "#fde68a", "#4c1d95"][rarity] ?? b.egg.base;
  const edge = rarity === LEGENDARY ? "#f59e0b" : rarity === MYTHIC ? "#1e1b4b" : shade(base, -0.22);
  const grad = ctx.createRadialGradient(-w * 0.35, -h * 0.68, h * 0.05, 0, -h * 0.45, h * 0.75);
  grad.addColorStop(0, rarity === MYTHIC ? "#f0abfc" : "#ffffff");
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, edge);
  ctx.fillStyle = grad;
  eggPath(ctx, w, h);
  ctx.fill();

  ctx.save();
  eggPath(ctx, w, h);
  ctx.clip();
  if (rarity === COMMON) {
    ctx.fillStyle = b.egg.spot;
    for (const [sx, sy, r] of [[-0.5, -0.3, 0.13], [0.45, -0.55, 0.11], [0.1, -0.2, 0.09], [-0.2, -0.75, 0.08]]) {
      ellipse(ctx, sx * w, sy * h, r * h, r * h);
      ctx.fill();
    }
  } else if (rarity === UNCOMMON) {
    // A green band with a row of dots.
    ctx.fillStyle = info.color;
    ctx.fillRect(-w, -h * 0.52, w * 2, h * 0.16);
    ctx.fillStyle = "#ffffff";
    for (const sx of [-0.6, -0.2, 0.2, 0.6]) {
      ellipse(ctx, sx * w, -h * 0.44, h * 0.035, h * 0.035);
      ctx.fill();
    }
    ctx.fillStyle = info.dark;
    for (const [sx, sy] of [[-0.35, -0.2], [0.35, -0.2], [0, -0.74]]) {
      ellipse(ctx, sx * w, sy * h, h * 0.05, h * 0.05);
      ctx.fill();
    }
  } else if (rarity === RARE) {
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
  } else if (rarity === EPIC) {
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
  } else if (rarity === LEGENDARY) {
    const colors = ["#f87171", "#fb923c", "#4ade80", "#38bdf8", "#a78bfa"];
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-w, -h * 0.62 + i * h * 0.065, w * 2, h * 0.07);
    });
    ctx.fillStyle = "#ffffff";
    starPath(ctx, 0, -h * 0.17, h * 0.1, 5, 0.5);
    ctx.fill();
  } else {
    // Mythic: a night-sky egg with a swirl of stars that twinkle.
    ctx.strokeStyle = info.color;
    ctx.lineWidth = h * 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * TAU * 1.35 + t * 0.6;
      const rr = (i / 20) * w * 0.95;
      const px = Math.cos(a) * rr;
      const py = -h * 0.45 + Math.sin(a) * rr * 1.25;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    [[-0.5, -0.72, 0.07], [0.5, -0.6, 0.09], [-0.4, -0.2, 0.08], [0.3, -0.18, 0.06], [0, -0.82, 0.05]].forEach(([sx, sy, r], i) => {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5 + i * 1.7);
      ctx.fillStyle = i % 2 ? "#fde047" : "#ffffff";
      starPath(ctx, sx * w, sy * h, r * h, 4, 0.4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = rarity === MYTHIC ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.55)";
  ellipse(ctx, -w * 0.42, -h * 0.68, w * 0.2, h * 0.11, -0.5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = shade(rarity === COMMON ? b.egg.spot : info.dark, -0.2);
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
    case "leaf": {
      // A fallen autumn leaf.
      ctx.rotate(d.seed * 6.28);
      ctx.fillStyle = pick(["#f97316", "#fbbf24", "#dc2626", "#a16207"]);
      ctx.beginPath();
      ctx.moveTo(-8 * s, 0);
      ctx.quadraticCurveTo(0, -7 * s, 8 * s, 0);
      ctx.quadraticCurveTo(0, 7 * s, -8 * s, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(60, 30, 10, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7 * s, 0);
      ctx.lineTo(7 * s, 0);
      ctx.stroke();
      break;
    }
    case "mushroom": {
      // A little glowing toadstool.
      const cap = pick(["#22d3ee", "#a3e635", "#f0abfc"]);
      ctx.globalAlpha = 0.22 + 0.14 * Math.sin(t * 2 + d.seed * 20);
      ctx.fillStyle = cap;
      ellipse(ctx, 0, -4 * s, 14 * s, 9 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f5f3ff";
      roundRect(ctx, -2.2 * s, -7 * s, 4.4 * s, 8 * s, 2);
      ctx.fill();
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.arc(0, -7 * s, 7 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ellipse(ctx, -2.6 * s, -10 * s, 1.4 * s, 1.4 * s);
      ctx.fill();
      break;
    }
    case "ember": {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + d.seed * 30);
      ctx.globalAlpha = 0.35 + 0.5 * k;
      ctx.fillStyle = pick(["#fde047", "#fb923c", "#f97316"]);
      ellipse(ctx, 0, -k * 4 * s, 3 * s, 3 * s);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ellipse(ctx, 0, -k * 4 * s, 8 * s, 8 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "crack": {
      // A glowing crack in the rock.
      ctx.rotate(d.seed * 3.14);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pts: [number, number][] = [[-16, 2], [-7, -3], [0, 3], [8, -2], [16, 1]];
      for (const [w, c] of [[6, "rgba(69, 10, 10, 0.5)"], [2.6, "#fb923c"], [1, "#fde047"]] as [number, string][]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
        ctx.stroke();
      }
      break;
    }
    case "wisp": {
      // A thin streak of cloud drifting by.
      const dx = Math.sin(t * 0.5 + d.seed * 10) * 6;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const [ox, oy, rx, ry] of [[-8, 0, 9, 4.5], [2, -2, 11, 6], [12, 1, 8, 4]]) {
        ellipse(ctx, (ox + dx) * s, oy * s, rx * s, ry * s);
        ctx.fill();
      }
      break;
    }
    case "arc": {
      // A tiny rainbow.
      ctx.lineWidth = 2.2 * s;
      ["#f87171", "#fbbf24", "#4ade80", "#60a5fa"].forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, (11 - i * 2.3) * s, Math.PI, 0);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      break;
    }
  }
  ctx.restore();
}

export function drawSolid(ctx: Ctx, s: Solid, wob = 0) {
  const r = s.r;
  shadow(ctx, s.x, s.y + r * 0.3, r * 1.1, 0.2);
  ctx.save();
  ctx.translate(s.x, s.y);
  if (wob > 0) ctx.rotate(Math.sin(wob * 20) * wob * 0.13);
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
    case "pumpkin": {
      const face = s.seed > 0.45;
      ctx.fillStyle = "#3f6212";
      roundRect(ctx, -3, -r * 1.55, 6, r * 0.4, 2);
      ctx.fill();
      for (const [dx, rx, c] of [[-r * 0.5, r * 0.6, "#ea580c"], [r * 0.5, r * 0.6, "#ea580c"], [0, r * 0.72, "#fb923c"]] as [number, number, string][]) {
        ctx.fillStyle = c;
        ellipse(ctx, dx, -r * 0.62, rx, r * 0.7);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ellipse(ctx, -r * 0.3, -r * 0.95, r * 0.2, r * 0.13, -0.4);
      ctx.fill();
      if (face) {
        // A friendly jack-o'-lantern.
        ctx.fillStyle = "#fde047";
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sx * r * 0.42, -r * 0.62);
          ctx.lineTo(sx * r * 0.14, -r * 0.62);
          ctx.lineTo(sx * r * 0.28, -r * 0.92);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, -r * 0.5, r * 0.38, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "deadtree": {
      // A bare, twisty tree with a couple of glowing eyes in the hollow.
      ctx.strokeStyle = "#3b2f5c";
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.2, -r * 1.1, r * 0.1, -r * 1.9);
      ctx.stroke();
      ctx.lineWidth = r * 0.22;
      for (const [x0, y0, x1, y1, x2, y2] of [
        [0, -r * 1.2, -r * 0.7, -r * 1.5, -r * 1.0, -r * 2.3],
        [0.05 * r, -r * 1.5, r * 0.8, -r * 1.7, r * 1.05, -r * 2.5],
        [0.1 * r, -r * 1.9, -r * 0.1, -r * 2.4, -r * 0.35, -r * 2.8],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x1, y1, x2, y2);
        ctx.stroke();
      }
      ctx.fillStyle = "#1c1233";
      ellipse(ctx, -r * 0.03, -r * 0.75, r * 0.2, r * 0.26);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ellipse(ctx, -r * 0.1, -r * 0.78, 1.8, 1.8);
      ctx.fill();
      ellipse(ctx, r * 0.05, -r * 0.78, 1.8, 1.8);
      ctx.fill();
      break;
    }
    case "volcano": {
      // A baby volcano with a pool of lava at the top.
      const g1 = ctx.createLinearGradient(0, -r * 1.6, 0, 0);
      g1.addColorStop(0, "#57201a");
      g1.addColorStop(1, "#2b0f0c");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 0);
      ctx.lineTo(-r * 0.4, -r * 1.55);
      ctx.lineTo(r * 0.4, -r * 1.55);
      ctx.lineTo(r * 1.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fb923c";
      ellipse(ctx, 0, -r * 1.55, r * 0.4, r * 0.14);
      ctx.fill();
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = r * 0.16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 1.5);
      ctx.quadraticCurveTo(-r * 0.4, -r * 1.0, -r * 0.3, -r * 0.55);
      ctx.moveTo(r * 0.2, -r * 1.5);
      ctx.quadraticCurveTo(r * 0.45, -r * 1.15, r * 0.4, -r * 0.85);
      ctx.stroke();
      ctx.fillStyle = "#fde047";
      ellipse(ctx, 0, -r * 1.56, r * 0.2, r * 0.07);
      ctx.fill();
      break;
    }
    case "obsidian": {
      // Glassy black shards with a hot edge.
      [[-r * 0.5, r * 1.2, -0.35], [r * 0.5, r * 1.0, 0.4], [0, r * 1.9, 0.05]].forEach(([dx, h, rot]) => {
        ctx.save();
        ctx.translate(dx, 0);
        ctx.rotate(rot);
        ctx.fillStyle = "#1f1235";
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, 0);
        ctx.lineTo(-r * 0.2, -h * 0.8);
        ctx.lineTo(r * 0.05, -h);
        ctx.lineTo(r * 0.34, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(251, 113, 133, 0.55)";
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, 0);
        ctx.lineTo(-r * 0.2, -h * 0.8);
        ctx.lineTo(r * 0.05, -h);
        ctx.lineTo(-r * 0.08, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      break;
    }
    case "cloud": {
      // A puffy cloud resting on the ground.
      ctx.fillStyle = "#e6f1ff";
      ellipse(ctx, 0, -r * 0.2, r * 1.2, r * 0.42);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy, rr] of [[-r * 0.7, -r * 0.5, r * 0.55], [r * 0.65, -r * 0.5, r * 0.6], [-r * 0.1, -r * 0.95, r * 0.72], [r * 0.3, -r * 0.6, r * 0.6]]) {
        ellipse(ctx, dx, dy, rr, rr);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(147, 197, 253, 0.35)";
      ellipse(ctx, 0, -r * 0.18, r * 1.0, r * 0.2);
      ctx.fill();
      break;
    }
    case "pillar": {
      // A marble column with gold trim.
      const gp = ctx.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
      gp.addColorStop(0, "#e2e8f0");
      gp.addColorStop(0.5, "#ffffff");
      gp.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = gp;
      roundRect(ctx, -r * 0.45, -r * 2.3, r * 0.9, r * 2.3, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
      ctx.lineWidth = 1.5;
      for (const dx of [-0.18, 0.18]) {
        ctx.beginPath();
        ctx.moveTo(dx * r, -r * 2.1);
        ctx.lineTo(dx * r, -r * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = "#f0b429";
      roundRect(ctx, -r * 0.65, -r * 2.5, r * 1.3, r * 0.3, 4);
      ctx.fill();
      roundRect(ctx, -r * 0.65, -r * 0.22, r * 1.3, r * 0.3, 4);
      ctx.fill();
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

/* ---------- The FanScout sign ---------- */

let markPath: Path2D | null = null;

/** FanScout's winged-F mark, centred on (x, y). */
function drawFanScoutMark(ctx: Ctx, x: number, y: number, size: number, color: string) {
  markPath ??= new Path2D(FANSCOUT_MARK);
  const k = size / 372;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.translate(-70, -70);
  ctx.fillStyle = color;
  ctx.fill(markPath);
  ctx.restore();
}

/** A little billboard by the home gate, in FanScout's colours. It lights up when boosts are ready. */
function drawBillboard(ctx: Ctx, g: Game, t: number, wob = 0) {
  const { x, y, w, h } = BILLBOARD;
  const ready = !g.cozy && g.adCd <= 0;
  const top = -34 - h;
  shadow(ctx, x, y + 6, w * 0.5, 0.18);
  ctx.save();
  ctx.translate(x, y);
  if (wob > 0) ctx.rotate(Math.sin(wob * 20) * wob * 0.035);

  // Posts.
  ctx.fillStyle = "#9a6a3a";
  roundRect(ctx, -w / 2 + 18, -44, 10, 50, 4);
  ctx.fill();
  roundRect(ctx, w / 2 - 28, -44, 10, 50, 4);
  ctx.fill();

  // A glow behind the board when there is something to collect, and at night.
  if (ready || g.night) {
    const pulse = ready ? 0.5 + 0.5 * Math.sin(t * 3) : 0.35;
    const glow = ctx.createRadialGradient(0, top + h / 2, 10, 0, top + h / 2, w * 0.78);
    glow.addColorStop(0, `rgba(129, 192, 77, ${0.3 + 0.3 * pulse})`);
    glow.addColorStop(1, "rgba(129, 192, 77, 0)");
    ctx.fillStyle = glow;
    ellipse(ctx, 0, top + h / 2, w * 0.78, h * 1.05);
    ctx.fill();
  }

  // The board: FanScout's near-black slab with a green edge.
  ctx.fillStyle = FS.green;
  roundRect(ctx, -w / 2 - 3, top - 3, w + 6, h + 6, 15);
  ctx.fill();
  ctx.fillStyle = FS.slab;
  roundRect(ctx, -w / 2, top, w, h, 12);
  ctx.fill();

  // App icon and wordmark.
  ctx.fillStyle = "#6eae5c";
  roundRect(ctx, -w / 2 + 11, top + 10, 30, 30, 8);
  ctx.fill();
  drawFanScoutMark(ctx, -w / 2 + 26, top + 25, 23, "#ffffff");
  ctx.font = '800 18px "Inter", "Roboto", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(FANSCOUT.name, -w / 2 + 47, top + 26);

  // Bottom line: the offer, the wait, or just the tagline.
  if (ready) {
    const s = 1 + Math.sin(t * 5) * 0.04;
    ctx.save();
    ctx.translate(0, top + h - 20);
    ctx.scale(s, s);
    ctx.fillStyle = FS.green;
    roundRect(ctx, -w / 2 + 12, -12, w - 24, 24, 12);
    ctx.fill();
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = FS.slab;
    ctx.fillText("FREE BOOSTS!", 0, 1);
    ctx.restore();
  } else {
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = FS.greenLight;
    const wait = Math.ceil(g.adCd);
    ctx.fillText(
      g.cozy || wait <= 0
        ? "Find your fans."
        : `Boosts in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`,
      0,
      top + h - 19,
    );
  }
  ctx.restore();
}

/**
 * A Candy Canyon lollipop that shows what it's for. Bumping one gives a Sugar Rush, so a
 * ready one glows and twinkles, and grows a little speed badge as you walk up to it. A
 * used one fades, and its colour sweeps back round like a clock while it recharges.
 * `cool` is the seconds left before it works again; `near` is 0 far away and 1 beside it.
 */
function drawLollipop(ctx: Ctx, s: Solid, wob: number, cool: number, near: number, t: number) {
  const r = s.r;
  const headY = -r * 2.6;
  const ready = cool <= 0;
  const tilt = wob > 0 ? Math.sin(wob * 20) * wob * 0.13 : 0;
  // A slow breath, each lollipop on its own beat.
  const pulse = (Math.sin(t * 2.6 + s.seed * 40) + 1) / 2;

  if (ready) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(tilt);
    const glowR = r * (1.85 + 0.25 * pulse);
    const glow = ctx.createRadialGradient(0, headY, r * 0.9, 0, headY, glowR);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.5 + 0.2 * pulse})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ellipse(ctx, 0, headY, glowR, glowR);
    ctx.fill();
    ctx.restore();
  }

  drawSolid(ctx, s, wob);

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(tilt);
  if (ready) {
    sparkles(ctx, 0, headY + r * 1.5, r * 3.3, t, s.seed * 40);
    if (near > 0.02) {
      // The speed badge: the same bolt as the Speed chip, bobbing just above the candy.
      const pop = Math.min(1, near * 2.4);
      const by = headY - r * (2.15 + 0.12 * Math.sin(t * 4 + s.seed * 40));
      const br = r * 0.9 * (0.6 + 0.4 * pop);
      ctx.globalAlpha = pop;
      ctx.fillStyle = "rgba(20, 16, 50, 0.2)";
      ellipse(ctx, 0, by + 3, br, br);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ellipse(ctx, 0, by, br, br);
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(br * 0.16, by - br * 0.66);
      ctx.lineTo(-br * 0.42, by + br * 0.1);
      ctx.lineTo(-br * 0.04, by + br * 0.1);
      ctx.lineTo(-br * 0.18, by + br * 0.66);
      ctx.lineTo(br * 0.42, by - br * 0.14);
      ctx.lineTo(br * 0.04, by - br * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // Washed out where it hasn't recharged yet; the wedge shrinks clockwise as it comes back.
    const left = Math.min(1, cool / LOLLIPOP_COOLDOWN);
    ctx.fillStyle = "rgba(255, 244, 250, 0.74)";
    ctx.beginPath();
    ctx.moveTo(0, headY);
    ctx.arc(0, headY, r * 1.07, -Math.PI / 2 + (1 - left) * TAU, -Math.PI / 2 + TAU);
    ctx.closePath();
    ctx.fill();
  }
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

const BALLOON_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"];

function drawBalloons(ctx: Ctx, t: number) {
  const x0 = CENTER_X - 74;
  const x1 = CENTER_X + 74;
  const base = PEN.y0 - 6;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = Math.PI * (1 - k);
    const sway = Math.sin(t * 1.8 + i) * 2;
    const x = (x0 + x1) / 2 + Math.cos(a) * 74 + sway;
    const y = base - 26 - Math.sin(a) * 70;
    ctx.strokeStyle = "rgba(80, 60, 30, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo((x0 + x1) / 2 + Math.cos(a) * 74, base - 4 - Math.sin(a) * 40);
    ctx.stroke();
    ctx.fillStyle = BALLOON_COLORS[i % BALLOON_COLORS.length];
    ellipse(ctx, x, y, 11, 13.5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ellipse(ctx, x - 3.5, y - 5, 3, 4.5, -0.4);
    ctx.fill();
  }
}

function drawFountain(ctx: Ctx, x: number, y: number, t: number) {
  shadow(ctx, x, y + 6, 44, 0.18);
  ctx.fillStyle = "#94a3b8";
  ellipse(ctx, x, y, 42, 16);
  ctx.fill();
  ctx.fillStyle = "#7dd3fc";
  ellipse(ctx, x, y - 3, 36, 12);
  ctx.fill();
  ctx.fillStyle = "#cbd5e1";
  roundRect(ctx, x - 6, y - 40, 12, 40, 4);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ellipse(ctx, x, y - 40, 16, 6);
  ctx.fill();
  // Water arcs.
  ctx.strokeStyle = "rgba(186, 230, 253, 0.95)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 44);
    ctx.quadraticCurveTo(x + s * 16, y - 76 - Math.sin(t * 4) * 3, x + s * 26, y - 8);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.3 + i * 0.25) % 1;
    ctx.globalAlpha = 1 - ph;
    ellipse(ctx, x + Math.sin(i * 2.4) * 22, y - 10 - ph * 22, 2.4, 2.4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSlide(ctx: Ctx, x: number, y: number) {
  shadow(ctx, x + 6, y + 6, 46, 0.18);
  // Ladder.
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 34, y);
  ctx.lineTo(x - 26, y - 62);
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x - 14, y - 62);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 33 + i * 1.6, y - i * 12.5);
    ctx.lineTo(x - 19.5 + i * 1.1, y - i * 12.5);
    ctx.stroke();
  }
  // Chute, one stripe per colour.
  const stripes = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8"];
  ctx.lineWidth = 5;
  stripes.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 64 + i * 4.6);
    ctx.quadraticCurveTo(x + 14, y - 58 + i * 4.6, x + 44, y - 12 + i * 3);
    ctx.stroke();
  });
  ctx.fillStyle = "#a16207";
  roundRect(ctx, x - 32, y - 70, 22, 8, 3);
  ctx.fill();
}

function drawRainbow(ctx: Ctx, x: number, y: number, t: number) {
  const bands = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa"];
  ctx.lineWidth = 6;
  bands.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(x, y - 6, 50 - i * 6, Math.PI, 0);
    ctx.stroke();
  });
  // A fluffy cloud at each foot.
  for (const s of [-1, 1]) {
    const cx = x + s * 36;
    const bob = Math.sin(t * 1.5 + s) * 1.5;
    ctx.fillStyle = "#ffffff";
    for (const [dx, dy, r] of [[-11, 0, 10], [0, -6, 13], [12, 0, 10], [0, 3, 11]]) {
      ellipse(ctx, cx + dx, y - 6 + dy + bob, r, r * 0.85);
      ctx.fill();
    }
  }
}

const GOLD_LOOK: Look = {
  body: "#fbbf24", belly: "#fde68a", accent: "#b45309",
  ears: "pointy", tail: "long", face: "cat",
};

function drawStatue(ctx: Ctx, x: number, y: number, t: number) {
  shadow(ctx, x, y + 6, 34, 0.2);
  ctx.fillStyle = "#94a3b8";
  roundRect(ctx, x - 28, y - 16, 56, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#cbd5e1";
  roundRect(ctx, x - 22, y - 26, 44, 14, 4);
  ctx.fill();
  drawPet(ctx, GOLD_LOOK, x, y - 24, 46, { mood: "happy" });
  ctx.fillStyle = "#fffbeb";
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.6 + i * 2.1));
    starPath(ctx, x + [-24, 22, 4][i], y - [50, 62, 82][i], 5, 4, 0.35);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function heartPath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

/** The gift chest at home: glows and bounces when it's ready to open. */
function drawChest(ctx: Ctx, g: Game, t: number) {
  const { x, y, r } = CHEST;
  const wait = Math.max(0, g.lastChest + CHEST_MS - Date.now());
  const ready = wait <= 0;
  const open = g.chestAnim > 0;
  const hop = ready && !open ? Math.abs(Math.sin(t * 4)) * 5 : 0;
  shadow(ctx, x, y + 10, r * 1.15, 0.2);
  ctx.save();
  ctx.translate(x, y - hop);
  if (ready || open) {
    const glow = ctx.createRadialGradient(0, -20, 6, 0, -20, 80);
    glow.addColorStop(0, "rgba(253, 224, 71, 0.75)");
    glow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = glow;
    ellipse(ctx, 0, -20, 80, 80);
    ctx.fill();
  }
  // Box.
  ctx.fillStyle = ready || open ? "#c2410c" : "#9a7b5c";
  roundRect(ctx, -r, -r * 0.75, r * 2, r * 1.05, 7);
  ctx.fill();
  ctx.fillStyle = ready || open ? "#fbbf24" : "#cbb89b";
  ctx.fillRect(-r, -r * 0.42, r * 2, 6);
  ctx.fillRect(-5, -r * 0.75, 10, r * 1.05);
  // Lid.
  ctx.save();
  ctx.translate(-r, -r * 0.75);
  if (open) ctx.rotate(-0.95);
  ctx.fillStyle = ready || open ? "#ea580c" : "#b0926e";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r, -r * 0.95, r * 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ready || open ? "#fde047" : "#d8c7ac";
  ctx.fillRect(r - 5, -r * 0.5, 10, r * 0.5);
  ctx.restore();
  if (!open) {
    ctx.fillStyle = ready ? "#fde047" : "#e7dcc8";
    roundRect(ctx, -7, -r * 0.55, 14, 16, 4);
    ctx.fill();
  }
  ctx.restore();

  if (ready && !open) {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 2));
      ctx.fillStyle = "#fef9c3";
      starPath(ctx, x + [-36, 34, 6][i], y - [44, 52, 74][i] - hop, 6, 4, 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    label(ctx, "Gift!", x, y - 78 - hop, 17, "#ffffff", "#ea580c");
  } else if (!ready && !open) {
    const secs = Math.ceil(wait / 1000);
    label(ctx, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, x, y - 60, 15, "#ffffff", "#7c6a55");
  }
}

function drawUfo(ctx: Ctx, t: number, resting: boolean) {
  const { x, y } = UFO;
  const hover = Math.sin(t * 2.2) * 5;
  // Beam.
  if (!resting) {
    const beam = ctx.createLinearGradient(0, y - 40, 0, y + 14);
    beam.addColorStop(0, "rgba(165, 243, 252, 0.55)");
    beam.addColorStop(1, "rgba(165, 243, 252, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 44 + hover);
    ctx.lineTo(x + 14, y - 44 + hover);
    ctx.lineTo(x + 34, y + 14);
    ctx.lineTo(x - 34, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  shadow(ctx, x, y + 12, 30, 0.25);
  ctx.save();
  ctx.translate(x, y - 56 + hover);
  ctx.fillStyle = "#a5f3fc";
  ctx.beginPath();
  ctx.arc(0, -4, 17, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ellipse(ctx, -6, -12, 5, 3, -0.5);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ellipse(ctx, 0, 0, 38, 11);
  ctx.fill();
  ctx.fillStyle = "#cbd5e1";
  ellipse(ctx, 0, -3, 38, 9);
  ctx.fill();
  const lights = ["#f87171", "#fde047", "#4ade80", "#38bdf8", "#f0abfc"];
  lights.forEach((c, i) => {
    ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 5 + i));
    ctx.fillStyle = c;
    ellipse(ctx, -26 + i * 13, -1, 3.2, 3.2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSecretStar(ctx: Ctx, at: Point, t: number, near: number) {
  const pulse = 0.6 + 0.4 * Math.sin(t * 5);
  ctx.save();
  ctx.globalAlpha = Math.min(1, near * 1.6);
  const glow = ctx.createRadialGradient(at.x, at.y - 12, 2, at.x, at.y - 12, 34);
  glow.addColorStop(0, "rgba(253, 224, 71, 0.8)");
  glow.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = glow;
  ellipse(ctx, at.x, at.y - 12, 34, 34);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 2;
  starPath(ctx, at.x, at.y - 12 - Math.sin(t * 3) * 3, 11 + pulse * 2, 5, 0.48, -Math.PI / 2 + Math.sin(t * 2) * 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A glitterbug: a round little bug with a glowing tail and two wings. */
function drawBug(ctx: Ctx, bug: Bug, t: number) {
  const flutter = Math.sin(bug.t * 9) * 5;
  const x = bug.x + Math.sin(bug.t * 2.3) * 6;
  const y = bug.y - 22 + flutter;
  shadow(ctx, bug.x, bug.y + 2, 8, 0.14);
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, "rgba(253, 224, 71, 0.75)");
  glow.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = glow;
  ellipse(ctx, x, y, 20, 20);
  ctx.fill();
  const flap = Math.abs(Math.sin(t * 26 + bug.hue * 10));
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ellipse(ctx, x - 6, y - 5, 7, 2 + flap * 5, -0.5);
  ctx.fill();
  ellipse(ctx, x + 6, y - 5, 7, 2 + flap * 5, 0.5);
  ctx.fill();
  ctx.fillStyle = "#f59e0b";
  ellipse(ctx, x, y, 6.5, 5.5);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ellipse(ctx, x, y + 2, 4.5, 3.5);
  ctx.fill();
  if (bug.golden) {
    // The rare golden one wears a spinning star.
    ctx.fillStyle = "#fef08a";
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    starPath(ctx, x, y - 16, 8, 5, 0.48, t * 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#2b2240";
  ellipse(ctx, x - 2.2, y - 2.2, 1.1, 1.1);
  ctx.fill();
  ellipse(ctx, x + 2.2, y - 2.2, 1.1, 1.1);
  ctx.fill();
}

function drawMystery(ctx: Ctx, m: Mystery, t: number) {
  const fade = Math.min(1, m.age / 0.5) * Math.min(1, m.left / 3);
  // A tall beam of light so it can be spotted from far away.
  const beam = ctx.createLinearGradient(0, m.y - 420, 0, m.y);
  beam.addColorStop(0, "rgba(192, 132, 252, 0)");
  beam.addColorStop(1, `rgba(216, 180, 254, ${0.6 * fade})`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(m.x - 10, m.y - 420);
  ctx.lineTo(m.x + 10, m.y - 420);
  ctx.lineTo(m.x + 30, m.y);
  ctx.lineTo(m.x - 30, m.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = fade;
  drawNest(ctx, m.x, m.y, true, t);
  const bob = Math.sin(t * 3) * 3;
  const wobble = m.grab > 0 ? Math.sin(t * 34) * 0.16 * (0.4 + m.grab) : Math.sin(t * 2.4) * 0.1;
  drawEgg(ctx, m.biome, m.rarity, m.x, m.y + 2 + bob, 44, t, wobble);
  ctx.globalAlpha = 1;
  if (m.left < 12) {
    label(ctx, `${Math.ceil(m.left)}`, m.x, m.y - 66, 18, "#ffffff", "#9333ea");
  } else {
    label(ctx, "?", m.x, m.y - 66 + bob, 22, "#ffffff", "#9333ea");
  }
}

/** A little star picture in the sky above Starry Space: the letter E and a heart. */
function drawConstellation(ctx: Ctx, t: number) {
  const ox = 60;
  const oy = biomeTop(SPACE) + 190;
  const e: [number, number][] = [[40, 0], [0, 0], [0, 32], [30, 32], [0, 32], [0, 64], [40, 64]];
  const heart: [number, number][] = [[78, 18], [66, 4], [56, 18], [78, 44], [100, 18], [90, 4], [78, 18]];
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(199, 210, 254, 0.28)";
  for (const shape of [e, heart]) {
    ctx.beginPath();
    shape.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x, oy + y) : ctx.moveTo(ox + x, oy + y)));
    ctx.stroke();
  }
  [...e, ...heart].forEach(([x, y], i) => {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.4 + i * 0.9));
    ctx.fillStyle = i >= e.length ? "#fda4af" : "#fef9c3";
    starPath(ctx, ox + x, oy + y, 4.2, 4, 0.36);
    ctx.fill();
  });
  ctx.restore();
}

/** Where the shooting star is on screen right now (also used for tapping it). */
export function shootingStarAt(star: ShootingStar, w: number, h: number): Point {
  const k = star.t / star.dur;
  const fromLeft = star.seed < 0.5;
  const x0 = fromLeft ? w * 0.05 : w * 0.95;
  const x1 = fromLeft ? w * 0.9 : w * 0.1;
  const y0 = h * (0.14 + (star.seed % 0.5) * 0.3);
  return { x: x0 + (x1 - x0) * k, y: y0 + h * 0.22 * k };
}

function drawShootingStar(ctx: Ctx, star: ShootingStar, w: number, h: number) {
  const at = shootingStarAt(star, w, h);
  const back = shootingStarAt({ ...star, t: Math.max(0, star.t - 0.28) }, w, h);
  const fade = Math.min(1, star.t / 0.3, (star.dur - star.t) / 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  const tail = ctx.createLinearGradient(back.x, back.y, at.x, at.y);
  tail.addColorStop(0, "rgba(255,255,255,0)");
  tail.addColorStop(1, "rgba(254, 249, 195, 0.95)");
  ctx.strokeStyle = tail;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(back.x, back.y);
  ctx.lineTo(at.x, at.y);
  ctx.stroke();
  const glow = ctx.createRadialGradient(at.x, at.y, 2, at.x, at.y, 34);
  glow.addColorStop(0, "rgba(254, 249, 195, 0.9)");
  glow.addColorStop(1, "rgba(254, 249, 195, 0)");
  ctx.fillStyle = glow;
  ellipse(ctx, at.x, at.y, 34, 34);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  starPath(ctx, at.x, at.y, 14, 5, 0.48, star.t * 5);
  ctx.fill();
  ctx.restore();
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
  drawTownPaths(ctx);
  // Pet pen: soft straw floor with a fence around the back and sides.
  ctx.fillStyle = "#e9d7a0";
  roundRect(ctx, PEN.x0 - 14, PEN.y0 - 10, PEN.x1 - PEN.x0 + 28, PEN.y1 - PEN.y0 + 26, 28);
  ctx.fill();
  ctx.fillStyle = "#f3e5b5";
  roundRect(ctx, PEN.x0 + 6, PEN.y0 + 8, PEN.x1 - PEN.x0 - 12, PEN.y1 - PEN.y0 - 10, 22);
  ctx.fill();
  drawFenceRun(ctx, PEN.x0 - 14, CENTER_X - 70, PEN.y0 - 4, "#d9a066");
  drawFenceRun(ctx, CENTER_X + 70, PEN.x1 + 14, PEN.y0 - 4, "#d9a066");

  if (g.home.includes("garden")) {
    // A ring of flowers around the outside of the pen.
    for (let i = 0; i < 34; i++) {
      const k = i / 34;
      const side = i % 3;
      const x = side === 0 ? PEN.x0 - 34 : side === 1 ? PEN.x1 + 34 : PEN.x0 + k * (PEN.x1 - PEN.x0);
      const y = side === 2 ? PEN.y1 + 44 : PEN.y0 + 10 + ((i * 37) % 190);
      drawDecor(ctx, { x, y, kind: "flower", s: 1.15 + (i % 4) * 0.12, seed: ((i * 0.618) % 1) }, t);
    }
  }

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

/* ---------- Mini-game tents ---------- */

/** The little critter that peeks out of each tent, so you can tell them apart at a glance. */
function tentMascot(id: MiniDef["id"]): { look: Look; mood: Mood } {
  if (id === "tag") return { look: ZIP_LOOK, mood: "happy" };
  if (id === "steps") return { look: BIOMES[1].guard, mood: "sleep" };
  return { look: petById("clover-bun")?.look ?? ZIP_LOOK, mood: "normal" };
}

/**
 * A striped tent standing at (x, y). `wait` is the seconds until its prize is
 * back (0 = ready) and `medal` the best medal won there so far.
 */
export function drawTent(ctx: Ctx, def: MiniDef, x: number, y: number, t: number, wait: number, medal: number, ink = "#27500f") {
  const r = MINI_DOOR_R;
  const ready = wait <= 0;
  const hop = ready ? Math.abs(Math.sin(t * 3.2)) * 3 : 0;
  shadow(ctx, x, y + r * 0.42, r * 1.35, 0.22);
  ctx.save();
  ctx.translate(x, y - hop);

  if (ready) {
    const glow = ctx.createRadialGradient(0, -r, 8, 0, -r, r * 2.6);
    glow.addColorStop(0, "rgba(253, 224, 71, 0.55)");
    glow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = glow;
    ellipse(ctx, 0, -r, r * 2.6, r * 2.6);
    ctx.fill();
  }

  // Walls: stripes of the tent's colour and cream.
  const wallW = r * 1.9;
  const wallTop = -r * 1.05;
  const wallH = r * 1.45;
  ctx.save();
  roundRect(ctx, -wallW / 2, wallTop, wallW, wallH, 7);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? def.color : "#fff7e6";
    ctx.fillRect(-wallW / 2 + (i * wallW) / 6, wallTop, wallW / 6 + 1, wallH);
  }
  ctx.fillStyle = "rgba(20, 16, 50, 0.1)";
  ctx.fillRect(-wallW / 2, wallTop, wallW, 7);
  ctx.restore();

  // The doorway, with whoever runs the tent peeking out.
  ctx.fillStyle = "#3b2a4a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, wallTop + wallH);
  ctx.lineTo(-r * 0.42, -r * 0.2);
  ctx.quadraticCurveTo(0, -r * 0.95, r * 0.42, -r * 0.2);
  ctx.lineTo(r * 0.42, wallTop + wallH);
  ctx.closePath();
  ctx.fill();
  const mascot = tentMascot(def.id);
  drawPet(ctx, mascot.look, 0, wallTop + wallH + 2, r * 0.82, { t, mood: mascot.mood, seed: def.x });

  // Roof: a striped cone with a scalloped edge.
  const roofY = wallTop + 2;
  const tipY = -r * 2.35;
  const half = r * 1.28;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-half, roofY);
  ctx.quadraticCurveTo(-half * 0.35, roofY - r * 0.75, 0, tipY);
  ctx.quadraticCurveTo(half * 0.35, roofY - r * 0.75, half, roofY);
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#fff7e6" : def.color;
    ctx.beginPath();
    ctx.moveTo(0, tipY - 4);
    ctx.lineTo(-half + (i * half * 2) / 6, roofY + 2);
    ctx.lineTo(-half + ((i + 1) * half * 2) / 6, roofY + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ellipse(ctx, -half * 0.3, roofY - r * 0.6, r * 0.2, r * 0.42, 0.5);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#fff7e6" : shade(def.color, -0.12);
    ellipse(ctx, -half + ((i + 0.5) * half * 2) / 6, roofY + 1, half / 6, 5);
    ctx.fill();
  }

  // A pennant on top.
  ctx.strokeStyle = "#8a5a33";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, tipY + 2);
  ctx.lineTo(0, tipY - 20);
  ctx.stroke();
  const wave = Math.sin(t * 5 + def.x) * 3;
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.moveTo(0, tipY - 20);
  ctx.quadraticCurveTo(9, tipY - 18 + wave, 18, tipY - 14 + wave * 0.6);
  ctx.quadraticCurveTo(9, tipY - 11 + wave, 0, tipY - 9);
  ctx.closePath();
  ctx.fill();

  // The best medal won here hangs on the roof.
  if (medal > 0) {
    const mx = r * 0.78;
    const my = roofY - r * 0.42;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(mx - 6, my - 2);
    ctx.lineTo(mx - 9, my + 15);
    ctx.lineTo(mx, my + 10);
    ctx.lineTo(mx + 9, my + 15);
    ctx.lineTo(mx + 6, my - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MEDAL_COLORS[medal];
    ellipse(ctx, mx, my, 10, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    starPath(ctx, mx, my, 5.5, 5, 0.5);
    ctx.fill();
  }
  ctx.restore();

  label(ctx, def.name, x, y + r * 0.86, 13, ink, "rgba(255,255,255,0.75)", 600);
  const top = y - r * 2.35 - 36 - hop;
  if (ready) {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 2));
      ctx.fillStyle = "#fef9c3";
      starPath(ctx, x + [-40, 38, 8][i], top + [22, 14, -16][i], 6, 4, 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    label(ctx, "Prize!", x, top, 17, "#ffffff", def.color);
  } else {
    label(ctx, `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`, x, top + 4, 15, "#ffffff", "#7c6a55");
  }
}

/* ---------- Home town: the house, special buildings and building sites ---------- */
//
// Every piece is drawn standing on the origin: (0, 0) is the middle of its
// front doorstep and up is negative y. The same drawings make the menu icons.

/** Like `shade`, but hands back a hex colour so it can be shaded again. */
function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (t - c) * a);
  const out = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${out.toString(16).padStart(6, "0")}`;
}

/** A wall with a soft outline. (x, y) is the top-left corner. */
function wall(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, r = 7) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** A filled outline from a list of corners. */
function poly(ctx: Ctx, pts: number[], color: string, outline = true) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
    else ctx.lineTo(pts[i], pts[i + 1]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (!outline) return;
  ctx.lineJoin = "round";
  ctx.strokeStyle = shade(color, -0.28);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** A pointed roof sitting on `baseY`, with a stripe of light down one side. */
function gable(ctx: Ctx, cx: number, baseY: number, halfW: number, height: number, color: string) {
  poly(ctx, [cx - halfW, baseY, cx, baseY - height, cx + halfW, baseY], color);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.72, baseY - 4);
  ctx.lineTo(cx - halfW * 0.1, baseY - height * 0.82);
  ctx.lineTo(cx - halfW * 0.3, baseY - 4);
  ctx.closePath();
  ctx.fill();
}

/** A window: white frame, glass that glows at night. (x, y) is its middle. */
function pane(ctx: Ctx, x: number, y: number, w: number, h: number, lit: boolean, round = false) {
  ctx.fillStyle = "#ffffff";
  if (round) ellipse(ctx, x, y, w / 2 + 2.5, h / 2 + 2.5);
  else roundRect(ctx, x - w / 2 - 2.5, y - h / 2 - 2.5, w + 5, h + 5, 4);
  ctx.fill();
  ctx.fillStyle = lit ? "#fde68a" : "#bae6fd";
  if (round) ellipse(ctx, x, y, w / 2, h / 2);
  else roundRect(ctx, x - w / 2, y - h / 2, w, h, 2.5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(x - 0.9, y - h / 2, 1.8, h);
  ctx.fillRect(x - w / 2, y - 0.9, w, 1.8);
}

/** A front door with a rounded top, standing on y. */
function door(ctx: Ctx, x: number, y: number, w: number, h: number, color = "#9a6a3a") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h + w / 2);
  ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fcd34d";
  ellipse(ctx, x + w * 0.24, y - h * 0.42, 2.2, 2.2);
  ctx.fill();
}

function chimney(ctx: Ctx, x: number, top: number, bottom: number, t: number, smoke = true) {
  wall(ctx, x - 8, top, 16, bottom - top, "#c98b6b", 2);
  ctx.fillStyle = "#a86c4e";
  roundRect(ctx, x - 10.5, top - 4, 21, 7, 2);
  ctx.fill();
  if (!smoke) return;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3) % 1;
    ctx.globalAlpha = (1 - ph) * 0.75;
    ctx.fillStyle = "#ffffff";
    ellipse(ctx, x + Math.sin(ph * 5 + i) * 5 + ph * 8, top - 8 - ph * 34, 4 + ph * 6, 4 + ph * 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function flowerBox(ctx: Ctx, x: number, y: number, w: number) {
  ctx.fillStyle = "#16a34a";
  roundRect(ctx, x - w / 2, y - 4, w, 6, 3);
  ctx.fill();
  const colors = ["#f43f5e", "#facc15", "#f472b6"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    ellipse(ctx, x + (i - 1) * (w * 0.32), y - 5, 3, 3);
    ctx.fill();
  }
}

function pennant(ctx: Ctx, x: number, y: number, t: number, color: string, pole = 22) {
  ctx.strokeStyle = "#8a6a45";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - pole);
  ctx.stroke();
  const wave = Math.sin(t * 5 + x) * 2.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - pole);
  ctx.quadraticCurveTo(x + 9, y - pole + 1 + wave, x + 18, y - pole + 6 - wave);
  ctx.quadraticCurveTo(x + 9, y - pole + 9 + wave, x, y - pole + 11);
  ctx.closePath();
  ctx.fill();
}

/** The thing on top of the house. `peak` is the tip of the roof, `eave` the line along its bottom edge. */
function drawTopper(ctx: Ctx, id: string, peak: Point, eave: [number, number, number, number], t: number) {
  const { x, y } = peak;
  switch (id) {
    case "flag":
      pennant(ctx, x, y + 2, t, "#f43f5e", 26);
      break;
    case "vane": {
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x, y - 20);
      ctx.stroke();
      const turn = Math.cos(t * 0.9);
      ctx.save();
      ctx.translate(x, y - 20);
      ctx.scale(turn || 0.01, 1);
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(-15, -2);
      ctx.lineTo(6, -2);
      ctx.lineTo(6, -6);
      ctx.lineTo(16, 0);
      ctx.lineTo(6, 6);
      ctx.lineTo(6, 2);
      ctx.lineTo(-15, 2);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fbbf24";
      ellipse(ctx, x, y - 20, 3.2, 3.2);
      ctx.fill();
      break;
    }
    case "heart": {
      const beat = 1 + Math.abs(Math.sin(t * 2.4)) * 0.14;
      ctx.fillStyle = "#fb7185";
      heartPath(ctx, x, y - 12, 9 * beat);
      ctx.fill();
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      break;
    }
    case "star": {
      ctx.fillStyle = "#fde047";
      starPath(ctx, x, y - 12, 12, 5, 0.5, -Math.PI / 2 + Math.sin(t * 1.4) * 0.2);
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = "#fffbeb";
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3));
      starPath(ctx, x + 15, y - 22, 4, 4, 0.35);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "lights": {
      const [x0, y0, x1, y1] = eave;
      const sag = 9;
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
      ctx.stroke();
      const colors = ["#f43f5e", "#facc15", "#22c55e", "#38bdf8", "#a855f7"];
      const n = Math.max(5, Math.round(Math.abs(x1 - x0) / 17));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const bx = x0 + (x1 - x0) * k;
        const by = y0 + (y1 - y0) * k + sag * 4 * k * (1 - k) + 2;
        const on = Math.sin(t * 3 + i * 1.7) > -0.3;
        ctx.globalAlpha = on ? 1 : 0.45;
        ctx.fillStyle = colors[i % colors.length];
        ellipse(ctx, bx, by, 3.4, 3.4);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

/** How tall each house stands, for placing clocks and scaffolding over it. */
const HOUSE_HEIGHT = [112, 136, 164, 158, 178];
const HOUSE_HALF_W = [66, 76, 88, 106, 108];

/** The player's house at one of its five sizes, in their colours. */
function drawHouseArt(ctx: Ctx, tier: number, paint: HousePaint, t: number, lit: boolean) {
  const wallC = paintColor("wall", paint.wall);
  const roofC = paintColor("roof", paint.roof);
  let peak: Point = { x: 0, y: -110 };
  let eave: [number, number, number, number] = [-60, -70, 60, -70];
  ctx.lineJoin = "round";

  if (tier <= 0) {
    // Little Hut: one room and a round thatch roof.
    wall(ctx, -52, -72, 104, 72, wallC, 10);
    ctx.fillStyle = roofC;
    ctx.beginPath();
    ctx.moveTo(-66, -66);
    ctx.quadraticCurveTo(0, -156, 66, -66);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(roofC, -0.28);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ellipse(ctx, -18, -100, 17, 7, -0.5);
    ctx.fill();
    door(ctx, 0, 0, 28, 44);
    pane(ctx, 32, -42, 17, 17, lit, true);
    peak = { x: 0, y: -111 };
    eave = [-60, -68, 60, -68];
  } else if (tier === 1) {
    // Cozy Cottage: chimney, shutters and flower boxes.
    chimney(ctx, 40, -128, -84, t);
    wall(ctx, -62, -78, 124, 78, wallC, 8);
    gable(ctx, 0, -74, 78, 60, roofC);
    door(ctx, 0, 0, 28, 46);
    for (const s of [-1, 1]) {
      ctx.fillStyle = roofC;
      roundRect(ctx, s * 38 - 17, -58, 7, 24, 2);
      ctx.fill();
      roundRect(ctx, s * 38 + 10, -58, 7, 24, 2);
      ctx.fill();
      pane(ctx, s * 38, -46, 18, 20, lit);
      flowerBox(ctx, s * 38, -30, 26);
    }
    pane(ctx, 0, -96, 13, 13, lit, true);
    peak = { x: 0, y: -134 };
    eave = [-72, -76, 72, -76];
  } else if (tier === 2) {
    // Farmhouse: two floors, a side room and a porch.
    chimney(ctx, -40, -160, -118, t);
    wall(ctx, 30, -70, 58, 70, tint(wallC, -0.05), 6);
    poly(ctx, [24, -66, 36, -92, 92, -92, 94, -66], roofC);
    pane(ctx, 60, -38, 18, 20, lit);
    flowerBox(ctx, 60, -22, 26);
    wall(ctx, -74, -112, 110, 112, wallC, 8);
    gable(ctx, -19, -108, 68, 54, roofC);
    for (const x of [-48, 10]) pane(ctx, x, -84, 17, 20, lit);
    pane(ctx, -48, -34, 17, 20, lit);
    pane(ctx, -19, -130, 12, 12, lit, true);
    door(ctx, 8, 0, 28, 46);
    // Porch.
    poly(ctx, [-14, -52, 30, -52, 36, -44, -20, -44], roofC);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-15, -44, 4, 44);
    ctx.fillRect(27, -44, 4, 44);
    peak = { x: -19, y: -162 };
    eave = [-82, -110, 44, -110];
  } else if (tier === 3) {
    // Grand Manor: wide, with columns and a balcony.
    chimney(ctx, -62, -150, -112, t);
    chimney(ctx, 62, -150, -112, t, false);
    wall(ctx, -98, -104, 196, 104, wallC, 8);
    poly(ctx, [-106, -100, -78, -142, 78, -142, 106, -100], roofC);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-72, -138, 56, 6);
    for (const s of [-1, 1]) {
      for (const x of [44, 76]) {
        pane(ctx, s * x, -78, 15, 20, lit);
        pane(ctx, s * x, -32, 15, 22, lit);
      }
    }
    // The middle steps forward under its own little roof.
    wall(ctx, -30, -112, 60, 112, tint(wallC, 0.25), 6);
    gable(ctx, 0, -110, 38, 38, roofC);
    pane(ctx, 0, -124, 12, 12, lit, true);
    pane(ctx, 0, -82, 20, 20, lit);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-24, -62);
    ctx.lineTo(24, -62);
    for (let x = -20; x <= 20; x += 8) {
      ctx.moveTo(x, -62);
      ctx.lineTo(x, -70);
    }
    ctx.stroke();
    door(ctx, 0, 0, 26, 48);
    ctx.fillStyle = "#ffffff";
    for (const x of [-25, 20]) {
      roundRect(ctx, x, -60, 5, 60, 2);
      ctx.fill();
    }
    peak = { x: 0, y: -148 };
    eave = [-102, -102, 102, -102];
  } else {
    // Castle: a keep between two towers.
    const stone = tint(wallC, -0.06);
    for (const s of [-1, 1]) {
      wall(ctx, s * 80 - 24, -130, 48, 130, stone, 6);
      ctx.fillStyle = stone;
      for (let k = -1; k <= 1; k++) {
        roundRect(ctx, s * 80 + k * 17 - 6, -140, 12, 14, 2);
        ctx.fill();
        ctx.strokeStyle = shade(stone, -0.3);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      gable(ctx, s * 80, -138, 30, 40, roofC);
      pennant(ctx, s * 80, -176, t + s, roofC, 16);
      pane(ctx, s * 80, -96, 10, 22, lit);
      pane(ctx, s * 80, -46, 10, 22, lit);
    }
    wall(ctx, -58, -104, 116, 104, wallC, 6);
    ctx.fillStyle = wallC;
    for (let x = -52; x <= 40; x += 23) {
      roundRect(ctx, x, -116, 13, 16, 2);
      ctx.fill();
      ctx.strokeStyle = shade(wallC, -0.3);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // A banner over the gate.
    poly(ctx, [-13, -100, 13, -100, 13, -66, 0, -56, -13, -66], roofC);
    ctx.fillStyle = "#fde047";
    starPath(ctx, 0, -80, 7);
    ctx.fill();
    for (const x of [-38, 38]) pane(ctx, x, -70, 12, 24, lit);
    door(ctx, 0, 0, 40, 52, "#7c5a3a");
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const x of [-10, 0, 10]) {
      ctx.moveTo(x, -4);
      ctx.lineTo(x, -44);
    }
    ctx.stroke();
    // A turret in the middle for the topper to sit on.
    wall(ctx, -17, -140, 34, 30, tint(wallC, 0.2), 4);
    gable(ctx, 0, -138, 24, 32, roofC);
    pane(ctx, 0, -126, 9, 11, lit, true);
    peak = { x: 0, y: -170 };
    eave = [-56, -104, 56, -104];
  }
  drawTopper(ctx, paint.top, peak, eave, t);
}

/** A cupcake with a cherry, sitting on (x, y). */
function cupcake(ctx: Ctx, x: number, y: number, s: number) {
  poly(ctx, [x - 9 * s, y - 12 * s, x + 9 * s, y - 12 * s, x + 6.5 * s, y, x - 6.5 * s, y], "#fbbf24", false);
  ctx.fillStyle = "#fff1f7";
  ellipse(ctx, x, y - 14 * s, 11 * s, 6.5 * s);
  ctx.fill();
  ellipse(ctx, x, y - 20 * s, 7.5 * s, 5.5 * s);
  ctx.fill();
  ctx.fillStyle = "#f472b6";
  ellipse(ctx, x - 4 * s, y - 15 * s, 1.6 * s, 1.6 * s);
  ctx.fill();
  ellipse(ctx, x + 5 * s, y - 13 * s, 1.6 * s, 1.6 * s);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ellipse(ctx, x, y - 26 * s, 3.4 * s, 3.4 * s);
  ctx.fill();
}

function cog(ctx: Ctx, x: number, y: number, r: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(TAU / 8);
    roundRect(ctx, -r * 0.2, -r * 1.22, r * 0.4, r * 0.5, 1.5);
    ctx.fill();
  }
  ellipse(ctx, 0, 0, r, r);
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = shade(color, -0.35);
  ellipse(ctx, 0, 0, r * 0.36, r * 0.36);
  ctx.fill();
  ctx.restore();
}

/** How tall each building stands at level 1 size. */
const BUILDING_HEIGHT: Record<BuildingId, number> = {
  mill: 150, bakery: 108, well: 106, workshop: 112, barn: 118, hatchery: 96, sparkle: 168,
};

/** One of the special buildings at a level from 1 to 5. Higher levels add trimmings. */
function drawBuildingArt(ctx: Ctx, id: BuildingId, lv: number, t: number, lit: boolean) {
  ctx.lineJoin = "round";
  const fancy = lv >= 3;
  const gold = lv >= 5;
  switch (id) {
    case "mill": {
      poly(ctx, [-30, 0, -20, -94, 20, -94, 30, 0], "#fdf2d8");
      ctx.fillStyle = "rgba(180,140,80,0.22)";
      ctx.fillRect(-26, -34, 52, 4);
      ctx.fillRect(-23, -64, 46, 4);
      door(ctx, 0, 0, 20, 30);
      pane(ctx, 0, -50, 12, 12, lit, true);
      ctx.fillStyle = "#ef6f6c";
      ctx.beginPath();
      ctx.moveTo(-26, -92);
      ctx.quadraticCurveTo(0, -134, 26, -92);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade("#ef6f6c", -0.28);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Sails: the better the mill, the faster they turn.
      ctx.save();
      ctx.translate(0, -96);
      ctx.rotate(t * (0.5 + 0.22 * lv));
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        ctx.strokeStyle = "#8a6a45";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -52);
        ctx.stroke();
        ctx.fillStyle = fancy ? "#fde68a" : "#fff7e6";
        roundRect(ctx, 2, -52, 14, 36, 2);
        ctx.fill();
        ctx.strokeStyle = "#b08d57";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2, -40);
        ctx.lineTo(16, -40);
        ctx.moveTo(2, -28);
        ctx.lineTo(16, -28);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = gold ? "#fbbf24" : "#8a6a45";
      ellipse(ctx, 0, -96, 6, 6);
      ctx.fill();
      if (fancy) {
        // Sacks of flour by the door.
        for (const x of [-38, 34]) {
          ctx.fillStyle = "#e7d3a8";
          ellipse(ctx, x, -9, 10, 11);
          ctx.fill();
          ctx.strokeStyle = "#b08d57";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
      break;
    }
    case "bakery": {
      chimney(ctx, 30, -98, -62, t);
      wall(ctx, -50, -64, 100, 64, "#fde2ec", 8);
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.moveTo(-56, -60);
      ctx.quadraticCurveTo(0, -92, 56, -60);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade("#f472b6", -0.28);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      cupcake(ctx, -6, -78, 1.15);
      // Shop window and door.
      pane(ctx, -22, -24, 34, 26, lit);
      cupcake(ctx, -30, -13, 0.42);
      cupcake(ctx, -14, -13, 0.42);
      door(ctx, 26, 0, 24, 40, "#c2748f");
      // Striped awning with a scalloped edge.
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : gold ? "#fbbf24" : "#fb7185";
        ctx.beginPath();
        ctx.moveTo(-56 + i * 14, -62);
        ctx.lineTo(-42 + i * 14, -62);
        ctx.lineTo(-42 + i * 14, -50);
        ctx.arc(-49 + i * 14, -50, 7, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      }
      if (fancy) {
        const colors = ["#38bdf8", "#facc15", "#4ade80", "#a855f7"];
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = colors[i % 4];
          const bx = -45 + i * 15;
          ctx.beginPath();
          ctx.moveTo(bx - 5, -41);
          ctx.lineTo(bx + 5, -41);
          ctx.lineTo(bx, -33);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case "well": {
      // Posts and a little roof, then the stone ring in front.
      ctx.fillStyle = "#a16207";
      ctx.fillRect(-29, -80, 6, 58);
      ctx.fillRect(23, -80, 6, 58);
      ctx.fillRect(-28, -70, 56, 5);
      gable(ctx, 0, -78, 42, 26, gold ? "#f5b301" : "#4f86c6");
      const dip = Math.sin(t * 1.3) * 5;
      ctx.strokeStyle = "#d6c3a1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -66);
      ctx.lineTo(0, -48 + dip);
      ctx.stroke();
      poly(ctx, [-8, -48 + dip, 8, -48 + dip, 6, -36 + dip, -6, -36 + dip], "#b45309");
      ctx.fillStyle = "#9aa3b2";
      ellipse(ctx, 0, -6, 36, 13);
      ctx.fill();
      wall(ctx, -36, -30, 72, 26, "#b9c0cc", 5);
      ctx.strokeStyle = "rgba(71,85,105,0.35)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-36, -17);
      ctx.lineTo(36, -17);
      for (const x of [-18, 6, 26]) {
        ctx.moveTo(x, -30);
        ctx.lineTo(x, -17);
      }
      for (const x of [-26, -4, 16]) {
        ctx.moveTo(x, -17);
        ctx.lineTo(x, -5);
      }
      ctx.stroke();
      ctx.fillStyle = "#9aa3b2";
      ellipse(ctx, 0, -30, 36, 11);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ellipse(ctx, 0, -30, 29, 7.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ellipse(ctx, -9 + Math.sin(t * 2) * 3, -31, 7, 1.6);
      ctx.fill();
      // Wishes twinkling up out of the water.
      for (let i = 0; i < 1 + Math.ceil(lv / 2); i++) {
        const ph = (t * 0.4 + i * 0.37) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = "#fef08a";
        starPath(ctx, Math.sin(i * 2.6 + ph * 3) * 16, -36 - ph * 30, 4.5, 4, 0.35);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (fancy) for (const x of [-44, 44]) flowerBox(ctx, x, 0, 20);
      break;
    }
    case "workshop": {
      wall(ctx, -50, -62, 100, 62, "#dcae74", 5);
      ctx.strokeStyle = "rgba(124,74,18,0.28)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = -34; x <= 34; x += 17) {
        ctx.moveTo(x, -60);
        ctx.lineTo(x, -2);
      }
      ctx.stroke();
      poly(ctx, [-60, -58, 60, -78, 60, -66, -60, -46], "#7c5a3a");
      // Big open doorway with the tools hung up inside.
      ctx.fillStyle = "#5b3b1e";
      roundRect(ctx, -30, -42, 44, 42, 5);
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-20, -32);
      ctx.lineTo(-20, -14);
      ctx.moveTo(-8, -32);
      ctx.lineTo(-8, -18);
      ctx.moveTo(4, -32);
      ctx.lineTo(4, -12);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      roundRect(ctx, -26, -36, 12, 7, 2);
      ctx.fill();
      pane(ctx, 32, -30, 14, 16, lit);
      cog(ctx, 22, -88, 13, t * 0.8, gold ? "#fbbf24" : "#94a3b8");
      if (fancy) cog(ctx, 42, -76, 8, -t * 1.3 + 0.4, "#cbd5e1");
      // A crate and some planks outside.
      wall(ctx, -66, -18, 20, 18, "#c08a4a", 2);
      ctx.fillStyle = "#e3b987";
      roundRect(ctx, 50, -8, 26, 5, 2);
      ctx.fill();
      roundRect(ctx, 53, -14, 26, 5, 2);
      ctx.fill();
      break;
    }
    case "barn": {
      if (fancy) {
        // A silo round the side.
        wall(ctx, 44, -96, 30, 96, "#cbd5e1", 4);
        ctx.fillStyle = gold ? "#fbbf24" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(59, -96, 15, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      }
      wall(ctx, -52, -58, 104, 58, "#e5484d", 5);
      poly(ctx, [-60, -54, -48, -84, -22, -104, 22, -104, 48, -84, 60, -54], "#b4353a");
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-60, -54);
      ctx.lineTo(-48, -84);
      ctx.lineTo(-22, -104);
      ctx.lineTo(22, -104);
      ctx.lineTo(48, -84);
      ctx.lineTo(60, -54);
      ctx.stroke();
      pane(ctx, 0, -76, 16, 16, lit, true);
      // Big double door with a white cross.
      ctx.fillStyle = "#c93a40";
      roundRect(ctx, -24, -44, 48, 44, 3);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-24, -44);
      ctx.lineTo(24, 0);
      ctx.moveTo(24, -44);
      ctx.lineTo(-24, 0);
      ctx.moveTo(0, -44);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // Hay bale.
      ctx.fillStyle = "#facc15";
      roundRect(ctx, -74, -16, 22, 16, 4);
      ctx.fill();
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      break;
    }
    case "hatchery": {
      // A warm glass dome with an egg inside.
      const warm = 0.5 + 0.5 * Math.sin(t * 2.2);
      const glow = ctx.createRadialGradient(0, -34, 4, 0, -34, 58);
      glow.addColorStop(0, `rgba(253, 186, 116, ${0.5 + 0.3 * warm})`);
      glow.addColorStop(1, "rgba(253, 186, 116, 0)");
      ctx.fillStyle = glow;
      ellipse(ctx, 0, -34, 58, 58);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ellipse(ctx, 0, -18, 26, 7);
      ctx.fill();
      const eggs = fancy ? [-17, 0, 17] : [0];
      eggs.forEach((ex, i) => {
        const big = ex === 0 ? 1 : 0.7;
        ctx.save();
        ctx.translate(ex, -20);
        ctx.rotate(Math.sin(t * 5 + i * 2) * 0.09);
        ctx.fillStyle = "#fffaf0";
        ctx.beginPath();
        ctx.ellipse(0, -15 * big, 11 * big, 15 * big, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#d6b98a";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = ["#86efac", "#f9a8d4", "#93c5fd"][i % 3];
        ellipse(ctx, -3 * big, -18 * big, 3 * big, 3 * big);
        ctx.fill();
        ellipse(ctx, 4 * big, -10 * big, 2.2 * big, 2.2 * big);
        ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = "rgba(186, 230, 253, 0.42)";
      ctx.beginPath();
      ctx.ellipse(0, -18, 46, 64, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(0, -18, 34, 52, 0, Math.PI * 1.15, Math.PI * 1.4);
      ctx.stroke();
      wall(ctx, -54, -20, 108, 20, gold ? "#fbbf24" : "#34d399", 8);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(ctx, -46, -16, 92, 4, 2);
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      heartPath(ctx, 0, -92 - warm * 3, 6);
      ctx.fill();
      break;
    }
    case "sparkle": {
      wall(ctx, -22, -100, 44, 100, "#ddd0fb", 6);
      door(ctx, 0, 0, 18, 28, "#7c3aed");
      ctx.fillStyle = lit ? "#fde68a" : "#fef9c3";
      starPath(ctx, 0, -48, 7);
      ctx.fill();
      starPath(ctx, 0, -76, 5.5);
      ctx.fill();
      wall(ctx, -32, -108, 64, 12, "#c4b5fd", 5);
      gable(ctx, 0, -106, 34, 46, gold ? "#f5b301" : "#8b5cf6");
      // The star on top, and sparkles that circle it.
      const pulse = 1 + Math.sin(t * 3) * 0.12;
      const halo = ctx.createRadialGradient(0, -160, 2, 0, -160, 26);
      halo.addColorStop(0, "rgba(253, 224, 71, 0.8)");
      halo.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = halo;
      ellipse(ctx, 0, -160, 26, 26);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      starPath(ctx, 0, -160, 12 * pulse, 5, 0.5, -Math.PI / 2 + t * 0.6);
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const colors = ["#f0abfc", "#a5f3fc", "#fef08a", "#fda4af"];
      for (let i = 0; i < lv + 2; i++) {
        const a = t * 1.1 + (i / (lv + 2)) * TAU;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i);
        ctx.fillStyle = colors[i % colors.length];
        starPath(ctx, Math.cos(a) * 36, -112 + Math.sin(a) * 15 - (i % 3) * 20, 4.5, 4, 0.35);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

/** Five little stars under a building: gold ones for the levels it has. */
function drawLevelPips(ctx: Ctx, x: number, y: number, lv: number) {
  ctx.fillStyle = "rgba(20, 16, 50, 0.55)";
  roundRect(ctx, x - 31, y - 8, 62, 16, 8);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < lv ? "#fde047" : "rgba(255,255,255,0.28)";
    starPath(ctx, x - 22 + i * 11, y + 0.5, 4.8);
    ctx.fill();
  }
}

function drawScaffold(ctx: Ctx, halfW: number, height: number) {
  ctx.strokeStyle = "#b9814a";
  ctx.lineCap = "round";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  for (const x of [-halfW, halfW]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, -height);
  }
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(185,129,74,0.85)";
  ctx.beginPath();
  ctx.moveTo(-halfW, -height * 0.34);
  ctx.lineTo(halfW, -height * 0.66);
  ctx.moveTo(halfW, -height * 0.34);
  ctx.lineTo(-halfW, -height * 0.66);
  ctx.stroke();
  ctx.fillStyle = "#e3b987";
  for (const k of [0.34, 0.66, 1]) {
    roundRect(ctx, -halfW - 7, -height * k - 3, halfW * 2 + 14, 6, 3);
    ctx.fill();
    ctx.strokeStyle = "#b9814a";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

const BUILDER_LOOK: Look = {
  body: "#b7793f", belly: "#fde6b3", accent: "#7c4a12",
  ears: "round", tail: "none", face: "smile", cheeks: "#fda4af",
};

/** A little beaver in a hard hat, hammering away. */
function drawBuilder(ctx: Ctx, x: number, y: number, t: number, flip: boolean) {
  const size = 36;
  const hop = Math.abs(Math.sin(t * 6 + x)) * 5;
  shadow(ctx, x, y + 1, 13, 0.16);
  drawPet(ctx, BUILDER_LOOK, x, y - hop, size, { t, flip, mood: "happy", seed: x });
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x, y - hop - size * 0.72, size * 0.27, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, x - size * 0.34, y - hop - size * 0.74, size * 0.68, 4, 2);
  ctx.fill();
  // Hammer.
  const dir = flip ? -1 : 1;
  ctx.save();
  ctx.translate(x + dir * size * 0.42, y - hop - size * 0.4);
  ctx.rotate(dir * (-0.9 + Math.abs(Math.sin(t * 6 + x)) * 1.1));
  ctx.fillStyle = "#8a6a45";
  roundRect(ctx, -1.5, -17, 3, 18, 1.5);
  ctx.fill();
  ctx.fillStyle = "#64748b";
  roundRect(ctx, -6, -21, 12, 6, 2);
  ctx.fill();
  ctx.restore();
}

/** The clock over a building site: time left and a bar that fills. */
function drawBuildClock(ctx: Ctx, x: number, y: number, job: Job, now: number, t: number) {
  const left = jobLeft(job, now);
  const text = fmtCountdown(left);
  const w = Math.max(64, text.length * 10 + 30);
  const bob = Math.sin(t * 3) * 2;
  ctx.fillStyle = "rgba(20, 16, 50, 0.82)";
  roundRect(ctx, x - w / 2, y - 15 + bob, w, 34, 12);
  ctx.fill();
  label(ctx, text, x, y - 2 + bob, 17, "#ffffff");
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, x - w / 2 + 8, y + 9 + bob, w - 16, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = "#4ade80";
  roundRect(ctx, x - w / 2 + 8, y + 9 + bob, Math.max(5, (w - 16) * jobProgress(job, now)), 5, 2.5);
  ctx.fill();
}

type BubbleKind = "coin" | "cake" | "star";

/** "Come and get it": a bobbing bubble over a building with something to collect. */
function drawBubble(ctx: Ctx, x: number, y: number, kind: BubbleKind, count: number, t: number) {
  const bob = Math.abs(Math.sin(t * 3.2)) * 7;
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.fillStyle = "rgba(20, 16, 50, 0.18)";
  ellipse(ctx, 0, 3, 23, 23);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ellipse(ctx, 0, 0, 22, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, 19);
  ctx.lineTo(0, 31);
  ctx.lineTo(7, 19);
  ctx.closePath();
  ctx.fill();
  if (kind === "coin") {
    ctx.fillStyle = "#f59e0b";
    ellipse(ctx, 0, 0, 13, 13);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ellipse(ctx, 0, 0, 10, 10);
    ctx.fill();
    ctx.fillStyle = "#fff7c2";
    ellipse(ctx, -3.5, -4, 3.2, 2.2, -0.6);
    ctx.fill();
  } else if (kind === "cake") {
    cupcake(ctx, 0, 13, 0.88);
  } else {
    ctx.fillStyle = "#fbbf24";
    starPath(ctx, 0, 0, 14);
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (count > 1) {
    ctx.fillStyle = "#ef4444";
    ellipse(ctx, 17, -15, 10, 10);
    ctx.fill();
    label(ctx, String(count), 17, -14.5, 13, "#ffffff");
  }
  ctx.restore();
}

/** An empty plot: a patch of earth and a signpost. */
function drawPlot(ctx: Ctx, x: number, y: number, state: "locked" | "open" | "go", t: number) {
  ctx.fillStyle = "rgba(201, 168, 110, 0.55)";
  ellipse(ctx, x, y + 6, 52, 22);
  ctx.fill();
  ctx.setLineDash([9, 8]);
  ctx.strokeStyle = state === "locked" ? "rgba(120, 96, 60, 0.4)" : "rgba(120, 96, 60, 0.75)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  const hop = state === "go" ? Math.abs(Math.sin(t * 4 + x)) * 6 : 0;
  ctx.fillStyle = "#8a6a45";
  roundRect(ctx, x - 2.5, y - 26, 5, 30, 2);
  ctx.fill();
  const board = state === "locked" ? "#cbd5e1" : state === "go" ? "#4ade80" : "#fde9c4";
  ctx.fillStyle = board;
  roundRect(ctx, x - 17, y - 50 - hop, 34, 27, 6);
  ctx.fill();
  ctx.strokeStyle = shade(board, -0.35);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (state === "locked") {
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y - 39, 4.5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    roundRect(ctx, x - 7, y - 39, 14, 11, 2.5);
    ctx.fill();
  } else {
    label(ctx, "+", x, y - 36 - hop, 26, state === "go" ? "#ffffff" : "#a16207");
  }
}

/** One plot in the town: empty, being built, or a finished building with its bubble. */
function drawSite(ctx: Ctx, g: Game, id: BuildingId, t: number, now: number) {
  const { x, y } = PLOTS[id];
  const lv = g.town.lv[id];
  const job = jobFor(g, id);
  if (lv < 1 && !job) {
    const block = buildBlock(g, id);
    drawPlot(ctx, x, y, block === "house" ? "locked" : block === "ok" ? "go" : "open", t);
    return;
  }
  const ground = y + 20;
  const shown = Math.max(1, lv);
  const s = 0.86 + 0.045 * shown;
  const height = BUILDING_HEIGHT[id] * s;
  ctx.fillStyle = "rgba(201, 168, 110, 0.5)";
  ellipse(ctx, x, ground - 2, 62, 20);
  ctx.fill();
  shadow(ctx, x, ground, 52, 0.16);
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(s, s);
  if (lv < 1 && job) {
    // A new building rises out of the ground as the work goes on.
    const k = jobProgress(job, now);
    ctx.globalAlpha = 0.35;
    drawBuildingArt(ctx, id, 1, t, false);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-90, -BUILDING_HEIGHT[id] * k - 2, 180, BUILDING_HEIGHT[id] * k + 12);
    ctx.clip();
    drawBuildingArt(ctx, id, 1, t, g.night);
    ctx.restore();
  } else {
    drawBuildingArt(ctx, id, lv, t, g.night);
  }
  if (job) drawScaffold(ctx, 58, Math.min(BUILDING_HEIGHT[id], 112));
  ctx.restore();
  if (lv > 0) drawLevelPips(ctx, x, ground + 15, lv);
  if (job) {
    drawBuilder(ctx, x - 62 * s, ground + 6, t, false);
    drawBuildClock(ctx, x, ground - height - 26, job, now, t);
    return;
  }
  if (readyToCollect(g, id)) {
    const kind: BubbleKind = id === "mill" ? "coin" : id === "bakery" ? "cake" : "star";
    drawBubble(ctx, x, ground - height - 30, kind, id === "mill" ? 1 : stockOf(g, id), t);
  }
}

/** The house where the hut used to be, whatever size it has grown to. */
function drawHouse(ctx: Ctx, g: Game, wob: number, t: number, now: number) {
  const { x, y, r } = HUT;
  const ground = y + r * 0.55;
  const tier = g.town.house;
  shadow(ctx, x, ground - 3, HOUSE_HALF_W[tier] * 1.12, 0.2);
  ctx.save();
  ctx.translate(x, ground);
  if (wob > 0) ctx.scale(1 + Math.sin(wob * 18) * wob * 0.05, 1 - Math.sin(wob * 18) * wob * 0.05);
  drawHouseArt(ctx, tier, g.town.paint, t, g.night);
  const job = jobFor(g, "house");
  if (job) drawScaffold(ctx, HOUSE_HALF_W[tier] + 4, HOUSE_HEIGHT[tier] * 0.78);
  ctx.restore();
  if (job) {
    drawBuilder(ctx, x - HOUSE_HALF_W[tier] - 20, ground + 8, t, false);
    drawBuilder(ctx, x + HOUSE_HALF_W[tier] + 20, ground + 8, t + 0.4, true);
    drawBuildClock(ctx, x, ground - HOUSE_HEIGHT[tier] - 34, job, now, t);
  }
}

/** Paths out to the building plots, so the town reads as one place. */
function drawTownPaths(ctx: Ctx) {
  const laneY = HOME_TOP + 270;
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = HOME_PATH;
  roundRect(ctx, PLOTS.well.x + 40, laneY - 21, PLOTS.workshop.x - PLOTS.well.x - 80, 42, 21);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  const hubs: [BuildingId, BuildingId[]][] = [
    ["well", ["mill", "barn", "hatchery"]],
    ["workshop", ["bakery", "sparkle"]],
  ];
  for (const [hub, spokes] of hubs) {
    const a = PLOTS[hub];
    for (const id of spokes) {
      const b = PLOTS[id];
      const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 34) - 2);
      for (let i = 1; i <= steps; i++) {
        const k = (i + 0.6) / (steps + 2.2);
        ellipse(ctx, a.x + (b.x - a.x) * k + (i % 2 ? 5 : -5), a.y + (b.y - a.y) * k + 14, 11, 6.5);
        ctx.fill();
      }
    }
  }
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

function guardMood(gd: Guard, confused = false): Mood {
  if (gd.state === "sleep") return gd.pat > 0 ? "happy" : "sleep";
  if (confused || gd.state === "bonk" || gd.state === "out") return "dizzy";
  if (gd.state === "chase") return "angry";
  return "normal";
}

/** The side groves: a shadier floor with a row of stepping stones marking the edge. */
function drawGroves(ctx: Ctx, x0: number, x1: number, y0: number, y1: number) {
  for (let b = 0; b < BIOME_COUNT; b++) {
    const top = Math.max(y0, biomeTop(b));
    const bot = Math.min(y1, biomeBottom(b));
    if (bot <= top) continue;
    for (const side of [-1, 1]) {
      const edge = CENTER_X + side * WING_X;
      const from = side < 0 ? Math.max(x0, 0) : Math.max(x0, edge);
      const to = side < 0 ? Math.min(x1, edge) : Math.min(x1, WORLD_W);
      if (to <= from) continue;
      ctx.fillStyle = "rgba(20, 30, 60, 0.09)";
      ctx.fillRect(from, top, to - from, bot - top);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let y = biomeTop(b) + 40; y < biomeBottom(b) - 20; y += 46) {
        if (y < y0 - 20 || y > y1 + 20) continue;
        ellipse(ctx, edge, y, 9, 5);
        ctx.fill();
      }
    }
  }
}

/** A power-up's little picture, used in the world and on its button. */
export function drawPowerup(ctx: Ctx, kind: PowerupId, x: number, y: number, r: number, t = 0) {
  const color = POWERUPS[kind].color;
  ctx.save();
  ctx.translate(x, y);
  if (kind === "dizzy") {
    // A swirly lollipop.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-r * 0.09, r * 0.2, r * 0.18, r * 0.95);
    ctx.fillStyle = color;
    ellipse(ctx, 0, -r * 0.15, r * 0.62, r * 0.62);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    for (let a = 0; a < 9; a += 0.3) {
      const rr = (a / 9) * r * 0.5;
      const px = Math.cos(a + t * 3) * rr;
      const py = -r * 0.15 + Math.sin(a + t * 3) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (kind === "bubble") {
    ctx.fillStyle = "rgba(125, 211, 252, 0.45)";
    ellipse(ctx, 0, 0, r * 0.75, r * 0.75);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.12;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ellipse(ctx, -r * 0.28, -r * 0.3, r * 0.18, r * 0.11, -0.6);
    ctx.fill();
  } else {
    // An hourglass.
    ctx.fillStyle = "#92400e";
    ctx.fillRect(-r * 0.55, -r * 0.8, r * 1.1, r * 0.16);
    ctx.fillRect(-r * 0.55, r * 0.64, r * 1.1, r * 0.16);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.64);
    ctx.lineTo(r * 0.45, -r * 0.64);
    ctx.lineTo(0, 0);
    ctx.lineTo(r * 0.45, r * 0.64);
    ctx.lineTo(-r * 0.45, r * 0.64);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.64);
    ctx.lineTo(r * 0.3, r * 0.64);
    ctx.lineTo(0, r * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx: Ctx, pk: Pickup, t: number) {
  const fade = Math.min(1, pk.age / 0.4) * Math.min(1, pk.left / 4);
  const bob = Math.sin(t * 3 + pk.x) * 4;
  ctx.globalAlpha = fade;
  shadow(ctx, pk.x, pk.y + 4, 16, 0.16);
  ctx.fillStyle = POWERUPS[pk.kind].color;
  ctx.globalAlpha = fade * (0.22 + 0.1 * Math.sin(t * 4));
  ellipse(ctx, pk.x, pk.y - 22 + bob, 30, 30);
  ctx.fill();
  ctx.globalAlpha = fade;
  drawPowerup(ctx, pk.kind, pk.x, pk.y - 22 + bob, 22, t);
  ctx.globalAlpha = 1;
}

/** A Power Egg: a pearly egg wearing its power's colour as a band and a glow. */
export function drawPowerEgg(
  ctx: Ctx,
  color: string,
  x: number,
  y: number,
  size: number,
  t = 0,
  tilt = 0,
  glow = true,
) {
  const w = size * 0.38;
  if (glow) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 4);
    ellipse(ctx, x, y - size * 0.45, size * 0.75, size * 0.75);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = "#fdf4ff";
  ellipse(ctx, 0, -size * 0.46, w, size * 0.5);
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeStyle = shade(color, -0.35);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-w * 0.94, -size * 0.52, w * 1.88, size * 0.16);
  ctx.fillStyle = "#ffffff";
  starPath(ctx, 0, -size * 0.44, size * 0.1, 5, 0.45);
  ctx.fill();
  ellipse(ctx, -w * 0.4, -size * 0.74, w * 0.22, size * 0.08, -0.5);
  ctx.fill();
  ctx.restore();
}

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}`;
};

function drawAncient(ctx: Ctx, a: Ancient, t: number) {
  const def = powerEggById(a.power);
  const color = def?.color ?? "#ffffff";
  // Standing stones around a big nest.
  for (let k = 0; k < 5; k++) {
    const ang = Math.PI + (k / 4) * Math.PI;
    const sx = a.x + Math.cos(ang) * 58;
    const sy = a.y + Math.sin(ang) * 26 - 4;
    ctx.fillStyle = "#94a3b8";
    roundRect(ctx, sx - 9, sy - 30, 18, 34, 7);
    ctx.fill();
    ctx.fillStyle = color;
    ellipse(ctx, sx, sy - 18, 3.5, 3.5);
    ctx.fill();
  }
  drawNest(ctx, a.x, a.y, true, t);
  if (a.left > 0) {
    const grown = a.total > 0 ? 1 - a.left / a.total : 1;
    ctx.globalAlpha = 0.4 + 0.4 * grown;
    drawPowerEgg(ctx, color, a.x, a.y + 2, 26 + 16 * grown, t);
    ctx.globalAlpha = 1;
    const cy = a.y - 74;
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    roundRect(ctx, a.x - 30, cy - 15, 60, 30, 15);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, a.x - 26, cy + 9, Math.max(4, 52 * grown), 3, 2);
    ctx.fill();
    label(ctx, fmtClock(a.left), a.x, cy - 1, 15, "#ffffff");
  } else {
    const wobble = a.grab > 0 ? Math.sin(t * 34) * 0.16 * (0.4 + a.grab) : Math.sin(t * 2.2) * 0.08;
    drawPowerEgg(ctx, color, a.x, a.y + 2 + Math.sin(t * 3) * 2 - a.grab * 6, 46, t, wobble);
    if (def) label(ctx, def.name, a.x, a.y - 78, 14, "#ffffff", shade(color, -0.45));
  }
}

function drawMini(ctx: Ctx, g: Game, m: Mini, t: number) {
  const look = BIOMES[m.biome].guard;
  const frozen = g.freezeT > 0;
  const confused = g.confuseT > 0;
  const stomp = frozen ? 0 : Math.abs(Math.sin(m.walkT * 9)) * (m.state === "chase" ? 5 : 2.5);
  shadow(ctx, m.x, m.y + 3, MINI_R * 0.9, 0.2);
  drawPet(ctx, look, m.x, m.y + 3 - stomp, MINI_R * 2.1, {
    t: frozen ? 0 : t,
    flip: m.flip,
    mood: confused ? "dizzy" : m.state === "chase" ? "angry" : "normal",
    seed: m.biome * 7 + m.side,
  });
  if (frozen) drawIce(ctx, m.x, m.y - MINI_R, MINI_R * 1.25);
  else if (confused && m.state === "chase") drawSwirl(ctx, m.x, m.y - MINI_R * 2.6, 9, t);
  else if (m.state === "chase") label(ctx, "!", m.x, m.y - MINI_R * 2.7, 20, "#ffffff", "#ef4444");
}

function drawIce(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.5;
    const px = x + Math.cos(a) * r * (k % 2 ? 1 : 0.86);
    const py = y + Math.sin(a) * r * (k % 2 ? 0.92 : 1.05);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A little heart centred on (x, y), about 2r wide, with a white edge so it reads on any ground. */
function heart(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.95);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.25, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.95);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSwirl(ctx: Ctx, x: number, y: number, r: number, t: number) {
  for (let k = 0; k < 3; k++) {
    const a = t * 6 + (k / 3) * TAU;
    ctx.fillStyle = k % 2 ? "#e879f9" : "#fde047";
    starPath(ctx, x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 0.6, r * 0.6, 5, 0.5);
    ctx.fill();
  }
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
  const now = Date.now();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-v.camX, -v.camY);

  drawGround(ctx, x0, x1, y0, y1);
  drawGroves(ctx, x0, x1, y0, y1);
  for (const d of g.decor) if (seen(d.y, 30)) drawDecor(ctx, d, t);
  if (seen(HOME_TOP + 280, 420)) drawHome(ctx, g, t);
  for (const n of g.nests) if (seen(n.y, 60)) drawNest(ctx, n.x, n.y, n.golden, t);

  const items: Drawable[] = [];

  for (const a of g.ancients) if (seen(a.y, 140)) items.push({ y: a.y + 1, draw: () => drawAncient(ctx, a, t) });
  for (const m of g.minis) if (seen(m.y, 90)) items.push({ y: m.y, draw: () => drawMini(ctx, g, m, t) });
  for (const pk of g.pickups) if (seen(pk.y, 80)) items.push({ y: pk.y, draw: () => drawPickup(ctx, pk, t) });

  g.solids.forEach((s, i) => {
    if (!seen(s.y, 160)) return;
    if (s.seed === -1) items.push({ y: s.y, draw: () => drawHouse(ctx, g, g.wob[i], t, now) });
    else if (s.seed === -2) items.push({ y: s.y, draw: () => drawChest(ctx, g, t) });
    else if (s.seed === -3) items.push({ y: s.y, draw: () => drawBillboard(ctx, g, t, g.wob[i]) });
    else if (s.kind === "lollipop") {
      const near = 1 - Math.min(1, Math.hypot(s.x - g.player.x, s.y - g.player.y) / LOLLIPOP_NEAR);
      items.push({ y: s.y, draw: () => drawLollipop(ctx, s, g.wob[i], g.cool[i], near, t) });
    } else items.push({ y: s.y, draw: () => drawSolid(ctx, s, g.wob[i]) });
  });

  for (const d of MINIS) {
    if (!seen(d.y, 200)) continue;
    const wait = Math.max(0, Math.ceil((g.prizeAt[d.id] + d.prizeMs - now) / 1000));
    const ink = d.biome < 0 ? "#27500f" : BIOMES[d.biome].ink;
    items.push({ y: d.y, draw: () => drawTent(ctx, d, d.x, d.y, t, wait, g.medals[d.id], ink) });
  }

  if (seen(UFO.y, 160)) items.push({ y: UFO.y, draw: () => drawUfo(ctx, t, g.ufoCd > 0) });
  for (let b = 0; b < BIOME_COUNT; b++) {
    const spot = g.secretSpots[b];
    if (g.secrets.includes(b) || !seen(spot.y, 40)) continue;
    // Only twinkles when you wander close, so it stays a discovery.
    const near = 1 - Math.min(1, Math.hypot(spot.x - g.player.x, spot.y - g.player.y) / 280);
    if (near > 0) items.push({ y: spot.y, draw: () => drawSecretStar(ctx, spot, t, near) });
  }
  for (const bug of g.bugs) {
    if (bug.alive && g.up.speed >= BIOMES[bug.biome].speedReq && seen(bug.y, 60)) {
      items.push({ y: bug.y + 20, draw: () => drawBug(ctx, bug, t) });
    }
  }
  const mystery = g.mystery;
  if (mystery && seen(mystery.y, 500)) items.push({ y: mystery.y + 2, draw: () => drawMystery(ctx, mystery, t) });
  if (seen(biomeTop(SPACE) + 220, 200)) drawConstellation(ctx, t);

  // The special buildings down either side of home.
  if (seen(HOME_TOP + 300, 460)) {
    for (const id of BUILDING_IDS) items.push({ y: PLOTS[id].y, draw: () => drawSite(ctx, g, id, t, now) });
  }

  // Home decorations.
  if (seen(PEN.y0 + 80, 320)) {
    if (g.home.includes("balloons")) items.push({ y: PEN.y0 - 2, draw: () => drawBalloons(ctx, t) });
    if (g.home.includes("fountain")) items.push({ y: HOME_TOP + 430, draw: () => drawFountain(ctx, CENTER_X - 412, HOME_TOP + 430, t) });
    if (g.home.includes("slide")) items.push({ y: HOME_TOP + 540, draw: () => drawSlide(ctx, CENTER_X - 410, HOME_TOP + 540) });
    if (g.home.includes("rainbow")) items.push({ y: HOME_TOP + 430, draw: () => drawRainbow(ctx, CENTER_X + 410, HOME_TOP + 430, t) });
    if (g.home.includes("statue")) items.push({ y: HOME_TOP + 540, draw: () => drawStatue(ctx, CENTER_X + 410, HOME_TOP + 540, t) });
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
        const color = RARITIES[rarity].color;
        if (n.ripen > 0) {
          // Still growing: a small, pale egg and a clock that runs down.
          const grown = n.ripenTotal > 0 ? 1 - n.ripen / n.ripenTotal : 1;
          ctx.globalAlpha = 0.55 + 0.3 * grown;
          drawEgg(ctx, n.biome, rarity, n.x, n.y + 2, 38 * pop * s * (0.5 + 0.45 * grown), t, 0);
          ctx.globalAlpha = 1;
          const cy = n.y - 58;
          ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
          ctx.beginPath();
          ctx.arc(n.x, cy, 17, 0, Math.PI * 2);
          ctx.fill();
          progressRing(ctx, n.x, cy, 17, grown, color, 4);
          label(ctx, `${Math.ceil(n.ripen)}`, n.x, cy + 1, 15, "#ffffff");
          return;
        }
        const bob = n.grab > 0 ? 0 : Math.sin(t * 3 + n.x) * 1.5;
        // While it's being lifted the egg wobbles harder and harder.
        const wobble = n.grab > 0 ? Math.sin(t * 34) * 0.16 * (0.4 + n.grab) : Math.sin(t * 2 + n.y) * 0.06;
        drawEgg(ctx, n.biome, rarity, n.x, n.y + 2 + bob - n.grab * 6, 38 * pop * s, t, wobble);
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
        // Knocked out: it flops over on its side until it comes round.
        const out = gd.state === "out";
        ctx.save();
        ctx.translate(gd.x + shakeX, gd.y + 6 - stomp);
        if (out) {
          ctx.translate(0, -18);
          ctx.rotate((gd.flip ? -1 : 1) * 1.25);
          ctx.translate(0, 30);
        } else if (gd.state === "bonk") {
          ctx.rotate(Math.sin(t * 26) * 0.07);
        }
        drawPet(ctx, look, 0, 0, 96 * breathing, {
          t,
          flip: gd.flip,
          mood: guardMood(gd, g.confuseT > 0 && gd.state === "chase"),
          seed: gd.biome,
        });
        ctx.restore();
        if (out || gd.state === "bonk") drawSwirl(ctx, gd.x, gd.y - (out ? 66 : 112), 12, t);
        // Hearts, once it is up and about or has lost one.
        if (gd.state !== "sleep" && gd.state !== "waking" && !out) {
          for (let k = 0; k < GUARD_HP; k++) {
            heart(ctx, gd.x + (k - (GUARD_HP - 1) / 2) * 20, gd.y - 138, 8, k < gd.hp ? "#f43f5e" : "rgba(15, 23, 42, 0.35)");
          }
        }
        if (g.freezeT > 0 && gd.state !== "sleep") drawIce(ctx, gd.x, gd.y - 40, 62);
        else if (g.confuseT > 0 && gd.state === "chase") drawSwirl(ctx, gd.x, gd.y - 112, 12, t);
        else if (gd.state === "alert") label(ctx, "?", gd.x, gd.y - 116, 26, "#ffffff", "#f59e0b");
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

  for (const pet of g.pets) {
    const def = petById(pet.id);
    if (!def || !seen(pet.y, 90)) continue;
    items.push({
      y: pet.y,
      draw: () => {
        const born = Math.min(1, pet.age / 0.45);
        const pop = born < 1 ? 0.3 + born * 0.7 + Math.sin(born * Math.PI) * 0.3 : 1;
        const hopping = pet.wait <= 0 || pet.joy > 0;
        const hopY = hopping ? Math.abs(Math.sin(pet.hop)) * (pet.joy > 0 ? 10 : 6) : 0;
        const size = (34 + def.rarity * 4) * pop * SIZES[pet.s].scale;
        shadow(ctx, pet.x, pet.y + 1, size * 0.4, 0.16);
        if (pet.v === GLOW) {
          // A Glow pet throws a pool of its own light on the ground, brighter at night.
          const pool = ctx.createRadialGradient(pet.x, pet.y, 2, pet.x, pet.y, size * 1.5);
          pool.addColorStop(0, variantLook(def.look, GLOW).aura ?? "#67e8f9");
          pool.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = (g.night ? 0.6 : 0.34) * (0.85 + 0.15 * Math.sin(t * 3 + pet.uid));
          ctx.fillStyle = pool;
          ellipse(ctx, pet.x, pet.y, size * 1.5, size * 0.75);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        drawPet(ctx, variantLook(def.look, pet.v, t, pet.uid), pet.x, pet.y - hopY, size, {
          t,
          flip: pet.flip,
          seed: pet.uid,
          mood: born < 1 || pet.joy > 0 || g.happyT > 0 ? "happy" : "normal",
        });
        if (pet.v > 0) sparkles(ctx, pet.x, pet.y - hopY, size, t, pet.uid);
      },
    });
  }
  if (seen(PEN.y0, 300)) {
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
      const big = g.flags.giant ? 1.5 : 1;
      const bob = p.moving ? Math.abs(Math.sin(p.walkT * 11)) * 5 : 0;
      const lean = p.moving ? Math.sin(p.walkT * 11) * 0.05 : 0;
      const mood: Mood =
        p.stun > 0 ? "dizzy" : p.asleep ? "sleep" : p.carry.length || p.dashT > 0 ? "happy" : "normal";
      shadow(ctx, p.x, p.y + 2, 17 * big, 0.22);
      ctx.save();
      ctx.translate(p.x, p.y - bob);
      ctx.rotate(lean + (p.stun > 0 ? Math.sin(t * 30) * 0.12 : 0) + (p.dashT > 0 ? (p.flip ? -0.16 : 0.16) : 0));
      if (p.asleep) ctx.scale(1.06, 0.92);
      drawPet(ctx, playerLook, 0, 0, 46 * big, { t, flip: p.flip, mood, seed: 3 });
      ctx.restore();
      if (p.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const a = t * 7 + (k / 3) * TAU;
          ctx.fillStyle = "#fde047";
          starPath(ctx, p.x + Math.cos(a) * 20 * big, p.y - 52 * big + Math.sin(a) * 6, 6, 5, 0.5);
          ctx.fill();
        }
      }
      if (p.asleep) {
        const ph = (t * 0.6) % 1;
        for (let k = 0; k < 3; k++) {
          const q = (ph + k / 3) % 1;
          ctx.globalAlpha = 1 - q;
          label(ctx, "z", p.x + 18 + q * 20, p.y - 50 * big - q * 34, 12 + q * 10, "#ffffff", "#475569");
        }
        ctx.globalAlpha = 1;
      }
      p.carry.forEach((egg, k) => {
        const sway = Math.sin(p.walkT * 11 + k) * (p.moving ? 0.12 : 0.03);
        const ex = p.x + sway * 20;
        const ey = p.y - bob - 44 * big - k * 22;
        const power = egg.power ? powerEggById(egg.power) : undefined;
        if (power) drawPowerEgg(ctx, power.color, ex, ey, 32, t, sway);
        else drawEgg(ctx, egg.biome, egg.rarity, ex, ey, 30, t, sway);
      });
      if (g.held === "bubble") {
        ctx.strokeStyle = "rgba(125, 211, 252, 0.9)";
        ctx.fillStyle = "rgba(186, 230, 253, 0.2)";
        ctx.lineWidth = 3;
        ellipse(ctx, p.x, p.y - 22 * big, 34 * big, 36 * big);
        ctx.fill();
        ctx.stroke();
      }
    },
  });

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // Lifting an egg: a ring that fills up around the nest, drawn over everything
  // so the player standing on the nest never hides it.
  for (const n of g.nests) {
    if (n.egg !== null && n.grab > 0) progressRing(ctx, n.x, n.y - 18, 42, n.grab, RARITIES[n.egg].color, 7);
  }
  for (const a of g.ancients) {
    if (a.grab > 0) progressRing(ctx, a.x, a.y - 20, 46, a.grab, powerEggById(a.power)?.color ?? "#ffffff", 7);
  }
  if (mystery && mystery.grab > 0) {
    progressRing(ctx, mystery.x, mystery.y - 18, 44, mystery.grab, RARITIES[mystery.rarity].color, 7);
  }

  // Eggs flying to their pads.
  for (const f of g.flights) {
    const k = Math.max(0, Math.min(1, f.t / f.dur));
    const e = k * k * (3 - 2 * k);
    const x = f.x0 + (f.x1 - f.x0) * e;
    const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 70;
    drawEgg(ctx, f.egg.biome, f.egg.rarity, x, y + 14, 34, t, k * TAU);
  }

  drawParticles(ctx, g.particles);
  drawPopups(ctx, g.popups);

  ctx.restore();

  // ── Night ──
  const night = nightAmount(g.clock);
  const px = (p.x - v.camX) * scale + w / 2;
  const py = (p.y - 24 - v.camY) * scale + h / 2;
  if (night > 0) {
    // Dark blue everywhere except a soft pool of light around the player.
    const lamp = ctx.createRadialGradient(px, py, 40 * scale, px, py, 330 * scale);
    lamp.addColorStop(0, `rgba(16, 20, 72, ${0.1 * night})`);
    lamp.addColorStop(1, `rgba(16, 20, 72, ${0.56 * night})`);
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);
    // Fireflies.
    for (let i = 0; i < 14; i++) {
      const fx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const fy = ((Math.sin(i * 78.233) * 12543.123) % 1 + 1) % 1;
      const x = fx * w + Math.sin(t * 0.7 + i) * 26;
      const y = fy * h + Math.cos(t * 0.9 + i * 2) * 20;
      const blink = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i * 1.3));
      ctx.globalAlpha = night * blink;
      ctx.fillStyle = "rgba(253, 240, 138, 0.35)";
      ellipse(ctx, x, y, 7, 7);
      ctx.fill();
      ctx.fillStyle = "#fef9c3";
      ellipse(ctx, x, y, 2.4, 2.4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (g.shoot && !g.shoot.caught) drawShootingStar(ctx, g.shoot, w, h);

  // ── Screen-space helpers ──
  // Bigger pointers on tablets, to match the bigger HUD there.
  const ui = Math.min(w, h) >= 700 ? 1.4 : 1;
  const bounce = Math.sin(t * 6) * 5;
  const padsOnScreen = PAD_Y < y1 - 40;
  if (p.carry.length && !padsOnScreen) {
    arrow(ctx, w / 2, h - (ui > 1 ? 180 : 124) + bounce, Math.PI / 2, "Home", ui);
  } else if (showHints && !p.carry.length && g.biome < 0 && g.pads.every((pad) => !pad.egg)) {
    arrow(ctx, w / 2, h * 0.36 - bounce, -Math.PI / 2, "Find an egg", ui);
  }

  // Until they've knocked on one, point players at the tent in the land they're in.
  const tent = MINIS.find((d) => d.biome === g.biome);
  if (tent && !g.flags.miniSeen && !p.carry.length && !showHints) {
    const tx = (tent.x - v.camX) * scale + w / 2;
    const ty = (tent.y - 50 - v.camY) * scale + h / 2;
    if (tx < 30 || tx > w - 30 || ty < 90 || ty > h - 110) {
      const ang = Math.atan2(ty - h / 2, tx - w / 2);
      const rad = Math.min(w, h) * 0.3;
      ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(t * 4));
      arrow(ctx, w / 2 + Math.cos(ang) * rad, h / 2 + Math.sin(ang) * rad, ang, "New game!", ui, tent.color);
      ctx.globalAlpha = 1;
    }
  }

  const m = g.mystery;
  if (m) {
    const mx = (m.x - v.camX) * scale + w / 2;
    const my = (m.y - v.camY) * scale + h / 2;
    const off = mx < 0 || mx > w || my < 70 || my > h - 100;
    if (off) {
      const ang = Math.atan2(my - h / 2, mx - w / 2);
      const rad = Math.min(w, h) * 0.3;
      ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 4));
      arrow(ctx, w / 2 + Math.cos(ang) * rad, h / 2 + Math.sin(ang) * rad, ang, `Mystery egg ${Math.ceil(m.left)}s`, ui, "#a855f7");
      ctx.globalAlpha = 1;
    }
  }

  if (joy) drawJoystick(ctx, joy);
}

/** Sparkles, hearts and dust. Shared with the mini games. */
export function drawParticles(ctx: Ctx, particles: Particle[]) {
  for (const pt of particles) {
    ctx.globalAlpha = Math.min(1, (pt.life / pt.max) * 1.6);
    ctx.fillStyle = pt.color;
    if (pt.kind === "star") {
      starPath(ctx, pt.x, pt.y, pt.size, 4, 0.4, pt.life * 6);
      ctx.fill();
    } else if (pt.kind === "heart") {
      heartPath(ctx, pt.x, pt.y, pt.size);
      ctx.fill();
    } else if (pt.kind === "ring") {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 1.6;
      ellipse(ctx, pt.x, pt.y, pt.size, pt.size);
      ctx.stroke();
    } else {
      ellipse(ctx, pt.x, pt.y, pt.size, pt.size);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** The little "+12" and "Oops!" labels that float up and fade. */
export function drawPopups(ctx: Ctx, popups: Popup[]) {
  for (const pop of popups) {
    const k = pop.life / pop.max;
    ctx.globalAlpha = Math.min(1, k * 2.5);
    const grow = pop.big ? 1 + Math.sin(Math.min(1, (1 - k) * 5) * Math.PI) * 0.25 : 1;
    label(ctx, pop.text, pop.x, pop.y, (pop.big ? 22 : 14) * grow, pop.big ? "#ffffff" : "#fff7d6", pop.color);
  }
  ctx.globalAlpha = 1;
}

/** The on-screen thumb stick, in screen pixels. */
export function drawJoystick(ctx: Ctx, joy: Joystick) {
  if (!joy.active) return;
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

function arrow(ctx: Ctx, x: number, y: number, angle: number, text: string, size = 1, color = "#f97316") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
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
  label(ctx, text, 0, dy, 18, "#ffffff", color);
  ctx.restore();
}

/* ---------- Pictures for the menus ---------- */

/** Paint one pet centred on a small square canvas (for the book, shop, etc.). */
export function paintPetIcon(
  canvas: HTMLCanvasElement,
  look: Look,
  cssSize: number,
  mood: Mood = "normal",
  variant = 0,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  drawPet(ctx, variantLook(look, variant, 0, 4), cssSize / 2, cssSize * 0.88, cssSize * 0.72, { mood });
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

export function paintPowerEggIcon(canvas: HTMLCanvasElement, color: string, cssSize: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  drawPowerEgg(ctx, color, cssSize / 2, cssSize * 0.92, cssSize * 0.8, 0, 0, false);
}

export function paintPowerupIcon(canvas: HTMLCanvasElement, kind: PowerupId, cssSize: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  drawPowerup(ctx, kind, cssSize / 2, cssSize / 2, cssSize * 0.46);
}

function iconCtx(canvas: HTMLCanvasElement, cssSize: number): Ctx | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  return ctx;
}

/** A picture of the house at a tier, in the player's colours. */
export function paintHouseIcon(canvas: HTMLCanvasElement, tier: number, paint: HousePaint | null, cssSize: number) {
  const ctx = iconCtx(canvas, cssSize);
  if (!ctx) return;
  const k = Math.min(cssSize / (HOUSE_HALF_W[tier] * 2 + 26), cssSize / (HOUSE_HEIGHT[tier] + 46));
  ctx.translate(cssSize / 2, cssSize * 0.96);
  ctx.scale(k, k);
  drawHouseArt(ctx, tier, paint ?? DEFAULT_PAINT, 0.4, false);
}

/** A picture of a special building at a level (level 0 shows what it will look like). */
export function paintBuildingIcon(canvas: HTMLCanvasElement, id: BuildingId, level: number, cssSize: number) {
  const ctx = iconCtx(canvas, cssSize);
  if (!ctx) return;
  const k = Math.min(cssSize / 150, cssSize / (BUILDING_HEIGHT[id] + 34));
  ctx.translate(cssSize / 2, cssSize * 0.95);
  ctx.scale(k, k);
  drawBuildingArt(ctx, id, Math.max(1, level), 0.4, false);
}
