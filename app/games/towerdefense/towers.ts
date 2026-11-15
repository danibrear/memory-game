// ─── Tower Defense: the tower characters ──────────────────────────────────────
//
// Every tower is a little character standing on a stone pad. They stay
// upright (only their weapons swing round), watch what they're shooting at,
// blink, doze off when nothing is happening, cheer when upgraded and go
// cross-eyed when a Jinx switches them off.
//
// Coordinates: each draw function works around (0, 0) = the centre of the
// tower's cell, with `s` = one cell in pixels. Feet stand at y = FEET.

import { TOWERS, type TowerType } from "./config";
import type { Level } from "./engine";
import {
  INK,
  TAU,
  blinking,
  blobPath,
  cel,
  cheeks,
  circle,
  drawEyes,
  drawMouth,
  easeOutBack,
  ink,
  mulberry32,
  shadeHex,
  shadow,
  starPath,
  type Ctx,
  type Mood,
} from "./art";

export interface TowerPose {
  angle: number;
  recoil: number;
  flash: number;
  /** Seconds since it last fired (towers with nothing to do look around, then nod off). */
  idle?: number;
  /** Switched off by a Jinx. */
  jammed?: boolean;
  /** Seconds since it was built (for the pop-in). */
  age?: number;
  /** Seconds since its last upgrade (for the little cheer). */
  cheer?: number;
  /** Anything that differs per tower, so they don't all blink together. */
  seed?: number;
}

interface Face {
  mood: Mood;
  lookX: number;
  lookY: number;
  blink: boolean;
  time: number;
}

type Spec = 0 | 1 | null;

/** Where the characters' feet touch the pad, as a fraction of a cell below centre. */
const FEET = 0.27;

const BASE_COLORS: Record<Level, { top: string; side: string }> = {
  0: { top: "#b8b2ad", side: "#807973" },
  1: { top: "#d5dde8", side: "#6f7f95" },
  2: { top: "#fcd34d", side: "#c2710c" },
};

/** Final forms stand on their own pads: dark steel or white marble. */
const SPEC_COLORS: [{ top: string; side: string; pip: string }, { top: string; side: string; pip: string }] = [
  { top: "#4b5563", side: "#1f2937", pip: "#f87171" },
  { top: "#e3eaf4", side: "#8494ab", pip: "#38bdf8" },
];

// ─── Entry point ──────────────────────────────────────────────────────────────

export function drawTower(
  ctx: Ctx,
  type: TowerType,
  level: Level,
  pose: TowerPose,
  x: number,
  y: number,
  s: number,
  time: number,
  spec: Spec = null,
) {
  const def = TOWERS[type];
  const seed = pose.seed ?? 0;
  const age = pose.age ?? 9;
  const cheer = pose.cheer ?? 9;
  const idle = pose.idle ?? 0;

  padSprite(ctx, x, y, s, level, spec, def.color);

  // How it feels and where it's looking
  const firing = pose.flash > 0 || pose.recoil > 0.3;
  const mood: Mood = pose.jammed
    ? "dizzy"
    : cheer < 0.7
      ? "happy"
      : firing
        ? "focus"
        : idle > 9 && def.role === "attack"
          ? "sleepy"
          : "calm";
  const wander = idle > 2.5 || def.role !== "attack";
  const face: Face = {
    mood,
    lookX: pose.jammed ? 0 : wander ? Math.sin(time * 0.7 + seed) * 0.8 : Math.cos(pose.angle),
    lookY: pose.jammed ? 0 : wander ? Math.cos(time * 0.53 + seed * 2) * 0.45 : Math.sin(pose.angle),
    blink: blinking(time, seed),
    time,
  };

  // Squash and stretch, always about the feet
  let sx = 1;
  let sy = 1;
  let hop = 0;
  if (age < 0.4) {
    const k = easeOutBack(age / 0.4);
    sx *= k;
    sy *= k;
  }
  if (cheer < 0.6) {
    const p = cheer / 0.6;
    hop = Math.sin(p * Math.PI) * s * 0.14;
    sy *= 1 + Math.sin(p * TAU) * 0.1;
    sx *= 1 - Math.sin(p * TAU) * 0.07;
  }
  const breathe = mood === "sleepy" ? Math.sin(time * 1.3 + seed) * 0.03 : Math.sin(time * 2.2 + seed) * 0.016;
  sy *= 1 + breathe - pose.recoil * 0.06;
  sx *= 1 - breathe + pose.recoil * 0.05;
  // Characters fill most of their pad; final forms are a touch bigger still.
  const size = spec !== null ? 1.2 : 1.13;
  sx *= size;
  sy *= size;

  ctx.save();
  ctx.translate(x, y + s * FEET - hop);
  ctx.scale(sx, sy);
  ctx.translate(0, -s * FEET);
  switch (type) {
    case "blaster":
      drawBlaster(ctx, s, level, spec, pose, face);
      break;
    case "frost":
      drawFrost(ctx, s, level, spec, pose, face);
      break;
    case "bomb":
      drawBomber(ctx, s, level, spec, pose, face);
      break;
    case "sniper":
      drawSniper(ctx, s, level, spec, pose, face);
      break;
    case "tesla":
      drawTesla(ctx, s, level, spec, pose, face);
      break;
    case "beacon":
      drawBeacon(ctx, s, level, spec, face);
      break;
    case "mine":
      drawMine(ctx, s, level, spec, face, seed);
      break;
  }
  ctx.restore();

  if (mood === "sleepy") drawZzz(ctx, x + s * 0.18, y - s * 0.3, s, time + seed);
  if (mood === "dizzy") drawDizzyStars(ctx, x, y - s * 0.42, s, time);

  drawPips(ctx, x, y, s, level, spec);
}

// ─── Pad, pips and little extras ──────────────────────────────────────────────

/**
 * Pads never change, so each kind is painted once into a small off-screen
 * canvas and stamped from there. With a board full of towers that saves a
 * good share of the drawing every frame.
 */
const padCache = new Map<string, HTMLCanvasElement>();

function padSprite(ctx: Ctx, x: number, y: number, s: number, level: Level, spec: Spec, color: string) {
  if (typeof document === "undefined") return drawPad(ctx, x, y, s, level, spec, color);
  const m = ctx.getTransform();
  // Device pixels per unit. Anything rotated or skewed just draws directly.
  const scale = m.b === 0 && m.c === 0 && m.a === m.d ? m.a : 0;
  if (scale <= 0) return drawPad(ctx, x, y, s, level, spec, color);
  const key = `${level}|${spec}|${color}|${s}|${scale}`;
  const size = s * 1.1;
  let sprite = padCache.get(key);
  if (!sprite) {
    if (padCache.size > 80) padCache.clear();
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = Math.ceil(size * scale);
    const sctx = sprite.getContext("2d");
    if (!sctx) return drawPad(ctx, x, y, s, level, spec, color);
    sctx.scale(scale, scale);
    drawPad(sctx, size / 2, size / 2, s, level, spec, color);
    padCache.set(key, sprite);
  }
  ctx.drawImage(sprite, x - size / 2, y - size / 2, sprite.width / scale, sprite.height / scale);
}

function drawPad(ctx: Ctx, x: number, y: number, s: number, level: Level, spec: Spec, color: string) {
  const bc = spec !== null ? SPEC_COLORS[spec] : BASE_COLORS[level];
  const half = s * 0.41;
  const rad = s * 0.15;
  shadow(ctx, x, y + s * 0.4, s * 0.45, s * 0.1, 0.2);
  // Side wall
  ctx.beginPath();
  ctx.roundRect(x - half, y - half + s * 0.12, half * 2, half * 2 - s * 0.04, rad);
  ctx.fillStyle = bc.side;
  ctx.fill();
  ink(ctx, s, 0.8);
  // Top
  ctx.beginPath();
  ctx.roundRect(x - half, y - half, half * 2, half * 2 - s * 0.12, rad);
  ctx.fillStyle = bc.top;
  ctx.fill();
  ink(ctx, s, 0.8);
  // Bevel (final forms get a ring in the tower's own colour)
  ctx.beginPath();
  ctx.roundRect(x - half * 0.76, y - half * 0.78, half * 1.52, half * 1.3, s * 0.1);
  ctx.strokeStyle = spec !== null ? color : "rgba(255,255,255,0.3)";
  ctx.lineWidth = Math.max(1, s * (spec !== null ? 0.04 : 0.024));
  ctx.stroke();
}

function drawPips(ctx: Ctx, x: number, y: number, s: number, level: Level, spec: Spec) {
  for (let i = 0; i <= level; i++) {
    const px = x + (i - level / 2) * s * 0.14;
    const py = y + s * 0.4;
    if (spec !== null) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = INK;
      ctx.fillRect(-s * 0.058, -s * 0.058, s * 0.116, s * 0.116);
      ctx.fillStyle = SPEC_COLORS[spec].pip;
      ctx.fillRect(-s * 0.038, -s * 0.038, s * 0.076, s * 0.076);
      ctx.restore();
    } else {
      circle(ctx, px, py, s * 0.058, INK);
      circle(ctx, px, py, s * 0.04, "#fde047");
    }
  }
}

function drawZzz(ctx: Ctx, x: number, y: number, s: number, time: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const p = (time * 0.45 + i / 3) % 1;
    const fs = s * (0.14 + p * 0.14);
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.95;
    ctx.font = `900 ${fs}px Fredoka, Inter, system-ui, sans-serif`;
    const zx = x + p * s * 0.22 + Math.sin(p * 6 + i) * s * 0.03;
    const zy = y - p * s * 0.4;
    ctx.lineWidth = Math.max(2, fs * 0.28);
    ctx.strokeStyle = INK;
    ctx.strokeText("z", zx, zy);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("z", zx, zy);
  }
  ctx.restore();
}

function drawDizzyStars(ctx: Ctx, x: number, y: number, s: number, time: number) {
  for (let i = 0; i < 3; i++) {
    const a = time * 4 + (i * TAU) / 3;
    const sx = x + Math.cos(a) * s * 0.22;
    const sy = y + Math.sin(a) * s * 0.07;
    starPath(ctx, sx, sy, s * 0.07, a);
    ctx.fillStyle = "#fde047";
    ctx.fill();
    ink(ctx, s, 0.55);
  }
}

function feet(ctx: Ctx, s: number, color: string, spread = 0.1) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * spread, s * (FEET - 0.015), s * 0.075, s * 0.045, 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ink(ctx, s, 0.8);
  }
}

function muzzleFlash(ctx: Ctx, x: number, y: number, size: number, flash: number, color = "#fde047") {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, flash / 0.05);
  starPath(ctx, x, y, size, 0);
  ctx.fillStyle = color;
  ctx.fill();
  circle(ctx, x, y, size * 0.42, "#ffffff");
  ctx.restore();
}

/** A gun barrel along +x from x0, with a highlight stripe, a tip and the ink outline. */
function barrel(ctx: Ctx, s: number, x0: number, y: number, len: number, w: number, color: string, tip?: string) {
  ctx.beginPath();
  ctx.roundRect(x0, y - w / 2, len, w, w * 0.3);
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, s, 0.8);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x0 + w * 0.2, y - w * 0.3, len - w * 0.5, w * 0.2);
  ctx.beginPath();
  ctx.roundRect(x0 + len - w * 0.55, y - w * 0.64, w * 0.6, w * 1.28, w * 0.2);
  ctx.fillStyle = tip ?? shadeHex(color, -0.35);
  ctx.fill();
  ink(ctx, s, 0.8);
}

/** Runs `weapon` either behind or in front of `body`, depending on which way it points. */
function layered(angle: number, weapon: () => void, body: () => void) {
  if (Math.sin(angle) < -0.3) {
    weapon();
    body();
  } else {
    body();
    weapon();
  }
}

// ─── Blaster: a small blue robot with a screen for a face ─────────────────────

function ledEyes(ctx: Ctx, cx: number, cy: number, size: number, spread: number, color: string, f: Face) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const ex = cx + side * spread + f.lookX * size * 0.5;
    const ey = cy + f.lookY * size * 0.4;
    if (f.mood === "dizzy") {
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.6, ey - size * 0.6);
      ctx.lineTo(ex + size * 0.6, ey + size * 0.6);
      ctx.moveTo(ex + size * 0.6, ey - size * 0.6);
      ctx.lineTo(ex - size * 0.6, ey + size * 0.6);
      ctx.stroke();
    } else if (f.mood === "happy") {
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.7, ey + size * 0.4);
      ctx.lineTo(ex, ey - size * 0.5);
      ctx.lineTo(ex + size * 0.7, ey + size * 0.4);
      ctx.stroke();
    } else if (f.mood === "sleepy" || f.blink) {
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.6, ey + size * 0.2);
      ctx.lineTo(ex + size * 0.6, ey + size * 0.2);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(ex, ey);
      // Focused eyes tilt inward, like a frown.
      if (f.mood === "focus") ctx.rotate(side * -0.45);
      ctx.beginPath();
      ctx.roundRect(-size * 0.5, -size * (f.mood === "focus" ? 0.55 : 0.85), size, size * (f.mood === "focus" ? 1.1 : 1.7), size * 0.45);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBlaster(ctx: Ctx, s: number, level: Level, spec: Spec, pose: TowerPose, f: Face) {
  const blue = "#3b82f6";
  const steel = "#64748b";
  const led = spec === 0 ? "#fca5a5" : spec === 1 ? "#fdba74" : "#67e8f9";

  const weapon = () => {
    ctx.save();
    ctx.translate(0, s * 0.05);
    ctx.rotate(pose.angle);
    const kick = -pose.recoil * s * 0.07;
    let tipX = s * 0.44;
    if (spec === 0) {
      // Gatling: a bundle of barrels that spins while it fires
      const spin = pose.recoil > 0.02 ? f.time * 30 : 0;
      for (let i = 0; i < 3; i++) {
        const off = Math.sin(spin + (i * TAU) / 3) * s * 0.075;
        barrel(ctx, s, s * 0.1 + kick, off, s * 0.33, s * 0.075, steel, "#ef4444");
      }
      ctx.beginPath();
      ctx.roundRect(s * 0.12 + kick, -s * 0.125, s * 0.09, s * 0.25, s * 0.03);
      ctx.fillStyle = "#334155";
      ctx.fill();
      ink(ctx, s, 0.8);
    } else if (spec === 1) {
      // Railgun: two long rails with a charge glowing between them
      tipX = s * 0.56;
      ctx.fillStyle = "rgba(103,232,249,0.85)";
      ctx.fillRect(s * 0.12 + kick, -s * 0.03, s * 0.42, s * 0.06);
      barrel(ctx, s, s * 0.08 + kick, -s * 0.07, s * 0.47, s * 0.06, steel, "#f59e0b");
      barrel(ctx, s, s * 0.08 + kick, s * 0.07, s * 0.47, s * 0.06, steel, "#f59e0b");
      for (const cx of [0.2, 0.32]) {
        ctx.beginPath();
        ctx.roundRect(s * cx + kick, -s * 0.115, s * 0.05, s * 0.23, s * 0.02);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ink(ctx, s, 0.7);
      }
    } else {
      const tip = level === 2 ? "#f59e0b" : undefined;
      const len = s * (0.32 + level * 0.02);
      tipX = s * 0.1 + len + s * 0.03;
      if (level === 0) {
        barrel(ctx, s, s * 0.1 + kick, 0, len, s * 0.12, steel, tip);
      } else {
        barrel(ctx, s, s * 0.1 + kick, -s * 0.07, len, s * 0.1, steel, tip);
        barrel(ctx, s, s * 0.1 + kick, s * 0.07, len, s * 0.1, steel, tip);
      }
    }
    muzzleFlash(ctx, tipX + kick + s * 0.05, 0, s * 0.14, pose.flash, spec === 1 ? "#67e8f9" : "#fde047");
    ctx.restore();
  };

  const body = () => {
    feet(ctx, s, "#1e3a8a");
    // Antenna
    const sway = Math.sin(f.time * 3) * s * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.22);
    ctx.quadraticCurveTo(sway * 0.5, -s * 0.3, sway, -s * 0.37);
    ink(ctx, s, 0.9);
    if (level === 2 || spec !== null) {
      starPath(ctx, sway, -s * 0.39, s * 0.065);
      ctx.fillStyle = "#fde047";
      ctx.fill();
      ink(ctx, s, 0.6);
    } else {
      circle(ctx, sway, -s * 0.385, s * 0.05, INK);
      circle(ctx, sway, -s * 0.385, s * 0.032, level === 1 ? "#fde047" : "#f87171");
    }
    // Ear bolts
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.2 - s * 0.035, -s * 0.13, s * 0.07, s * 0.12, s * 0.025);
      ctx.fillStyle = steel;
      ctx.fill();
      ink(ctx, s, 0.8);
    }
    // Body
    cel(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-s * 0.2, -s * 0.24, s * 0.4, s * 0.47, s * 0.15);
      },
      blue,
      s,
      { cy: 0, w: s * 0.42, h: s * 0.5 },
    );
    // Screen face
    ctx.beginPath();
    ctx.roundRect(-s * 0.145, -s * 0.185, s * 0.29, s * 0.2, s * 0.07);
    ctx.fillStyle = "#101828";
    ctx.fill();
    ink(ctx, s, 0.7);
    ledEyes(ctx, 0, -s * 0.085, s * 0.04, s * 0.065, led, f);
    // Chest panel
    ctx.beginPath();
    ctx.roundRect(-s * 0.085, s * 0.06, s * 0.17, s * 0.09, s * 0.03);
    ctx.fillStyle = "#bfdbfe";
    ctx.fill();
    ink(ctx, s, 0.6);
    circle(ctx, -s * 0.04, s * 0.105, s * 0.02, "#ef4444");
    circle(ctx, s * 0.04, s * 0.105, s * 0.02, "#22c55e");
    if (spec === 0) {
      // Headband
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-s * 0.2, -s * 0.235, s * 0.4, s * 0.045);
    }
  };

  layered(pose.angle, weapon, body);
}

// ─── Frost: a round snow sprite with a crystal on its head ────────────────────

function crystal(ctx: Ctx, s: number, x: number, y: number, w: number, h: number, glow: number, dark = false) {
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow;
    circle(ctx, x, y, w * 1.9, "rgba(207,250,254,0.85)");
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y - h * 0.2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w, y - h * 0.2);
  ctx.closePath();
  ctx.fillStyle = dark ? "#38bdf8" : "#7dd3fc";
  ctx.fill();
  ink(ctx, s, 0.75, "#0e7490");
  // Facets
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - w, y - h * 0.2);
  ctx.lineTo(x - w * 0.1, y - h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(8,145,178,0.35)";
  ctx.beginPath();
  ctx.moveTo(x + w, y - h * 0.2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w * 0.1, y - h * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawFrost(ctx: Ctx, s: number, level: Level, spec: Spec, pose: TowerPose, f: Face) {
  const glow = Math.min(1, pose.flash / 0.05) * 0.75;
  const bob = Math.sin(f.time * 2.5) * s * 0.02;
  const snow = spec === 1 ? "#cfe9ff" : "#eef9ff";

  // Shards circling behind
  const orbit = spec !== null ? 4 : level === 0 ? 0 : level + 1;
  const behind: number[] = [];
  const front: number[] = [];
  for (let i = 0; i < orbit; i++) {
    const a = f.time * 1.6 + (i * TAU) / orbit;
    (Math.sin(a) < 0 ? behind : front).push(a);
  }
  const shard = (a: number) =>
    crystal(ctx, s, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.09 - s * 0.02, s * 0.04, s * 0.075, 0, spec === 1);
  behind.forEach(shard);

  feet(ctx, s, "#7dd3fc", 0.11);
  cel(ctx, () => blobPath(ctx, 0, s * 0.02, s * 0.48, s * 0.46), snow, s, { cy: s * 0.02, w: s * 0.5, h: s * 0.5 });

  // Scarf, with a tail that flutters
  const flap = Math.sin(f.time * 5) * s * 0.025;
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.12);
  ctx.quadraticCurveTo(s * 0.27, s * 0.14 + flap, s * 0.3, s * 0.24 + flap);
  ctx.lineTo(s * 0.21, s * 0.25 + flap);
  ctx.quadraticCurveTo(s * 0.2, s * 0.18, s * 0.1, s * 0.17);
  ctx.closePath();
  ctx.fillStyle = spec === 1 ? "#1d4ed8" : "#0891b2";
  ctx.fill();
  ink(ctx, s, 0.7);
  ctx.beginPath();
  ctx.moveTo(-s * 0.225, s * 0.085);
  ctx.quadraticCurveTo(0, s * 0.17, s * 0.225, s * 0.085);
  ctx.lineTo(s * 0.2, s * 0.165);
  ctx.quadraticCurveTo(0, s * 0.24, -s * 0.2, s * 0.165);
  ctx.closePath();
  ctx.fillStyle = spec === 1 ? "#2563eb" : "#06b6d4";
  ctx.fill();
  ink(ctx, s, 0.7);

  // Face
  cheeks(ctx, 0, s * 0.02, s * 0.15, s * 0.04, "rgba(125,211,252,0.9)");
  drawEyes(ctx, { x: 0, y: -s * 0.05, r: s * 0.05, spread: s * 0.085, ...f });
  drawMouth(ctx, f.lookX * s * 0.02, s * 0.045, s * 0.08, pose.flash > 0 ? "o" : f.mood === "happy" ? "grin" : "smile");

  // Crystal crown
  if (spec === 1) {
    // Deep Freeze: three icicles
    for (const [ox, k] of [[-0.11, 0.75], [0.11, 0.75], [0, 1.1]] as const) {
      crystal(ctx, s, ox * s, -s * 0.29 + bob, s * 0.06 * k, s * 0.13 * k, glow, true);
    }
  } else {
    const size = spec === 0 ? 1.45 : 1 + level * 0.14;
    crystal(ctx, s, 0, -s * 0.31 + bob, s * 0.075 * size, s * 0.13 * size, glow);
  }
  if (spec === 0) {
    // Blizzard: snow whirling round its head
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 7; i++) {
      const a = f.time * 3 + (i * TAU) / 7;
      const rad = s * (0.3 + 0.04 * Math.sin(f.time * 2 + i));
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, -s * 0.12 + Math.sin(a) * rad * 0.42, s * 0.022, 0, TAU);
      ctx.fill();
    }
  }
  front.forEach(shard);
}

// ─── Bomber: a stout red gunner in a helmet, with a mortar ────────────────────

function drawBomber(ctx: Ctx, s: number, level: Level, spec: Spec, pose: TowerPose, f: Face) {
  const red = "#ef4444";

  const weapon = () => {
    ctx.save();
    ctx.translate(0, s * 0.06);
    ctx.rotate(pose.angle);
    const kick = -pose.recoil * s * 0.08;
    const len = s * (spec === 0 ? 0.44 : 0.34 + level * 0.02);
    const bw = s * (spec === 0 ? 0.27 : 0.19 + level * 0.02);
    const tube = spec === 1 ? "#7c2d12" : "#475569";
    const x0 = s * 0.08 + kick;
    ctx.beginPath();
    ctx.roundRect(x0, -bw / 2, len, bw, bw * 0.28);
    ctx.fillStyle = tube;
    ctx.fill();
    ink(ctx, s, 0.85);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x0 + bw * 0.15, -bw * 0.32, len - bw * 0.4, bw * 0.16);
    // Muzzle ring and the dark hole
    ctx.beginPath();
    ctx.roundRect(x0 + len - s * 0.075, -bw / 2 - s * 0.025, s * 0.085, bw + s * 0.05, s * 0.03);
    ctx.fillStyle = level === 2 || spec !== null ? "#f59e0b" : "#1f2937";
    ctx.fill();
    ink(ctx, s, 0.8);
    if (spec === 0) {
      for (const rx of [0.16, 0.3]) circle(ctx, x0 + s * rx, -bw * 0.27, s * 0.022, "#cbd5e1");
    }
    if (spec === 1) {
      // Inferno: a pilot flame that never goes out
      const fl = 0.8 + 0.3 * Math.sin(f.time * 20);
      ctx.beginPath();
      ctx.moveTo(x0 + len, -bw * 0.25);
      ctx.quadraticCurveTo(x0 + len + s * 0.2 * fl, 0, x0 + len, bw * 0.25);
      ctx.closePath();
      ctx.fillStyle = "#fb923c";
      ctx.fill();
      circle(ctx, x0 + len + s * 0.03, 0, bw * 0.14, "#fde047");
    }
    if (pose.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pose.flash / 0.05) * 0.85;
      circle(ctx, x0 + len + s * 0.07, 0, s * 0.13, "#e7e5e4");
      circle(ctx, x0 + len + s * 0.13, -s * 0.06, s * 0.08, "#d6d3d1");
      ctx.restore();
    }
    ctx.restore();
  };

  const body = () => {
    feet(ctx, s, "#7f1d1d", 0.12);
    cel(ctx, () => blobPath(ctx, 0, s * 0.02, s * 0.5, s * 0.46), red, s, { cy: s * 0.02, w: s * 0.5, h: s * 0.5 });
    // Face
    cheeks(ctx, 0, s * 0.08, s * 0.16, s * 0.04, "rgba(254,202,202,0.8)");
    drawEyes(ctx, {
      x: 0,
      y: s * 0.02,
      r: s * 0.05,
      spread: s * 0.09,
      ...f,
      mood: f.mood === "calm" ? "focus" : f.mood, // always looks like it means business
    });
    drawMouth(ctx, f.lookX * s * 0.02, s * 0.125, s * 0.09, f.mood === "happy" ? "grin" : pose.flash > 0 ? "open" : "flat");
    if (spec === 1) {
      // Inferno: hair on fire
      for (const [fx, fh, col] of [[-0.11, 0.2, "#f97316"], [0.1, 0.19, "#f97316"], [0, 0.28, "#fb923c"], [0, 0.17, "#fde047"]] as const) {
        const fl = Math.sin(f.time * 14 + fx * 20) * s * 0.02;
        ctx.beginPath();
        ctx.moveTo((fx - 0.085) * s, -s * 0.13);
        ctx.quadraticCurveTo((fx - 0.05) * s + fl, -s * (0.13 + fh * 0.7), fx * s + fl * 1.5, -s * (0.13 + fh));
        ctx.quadraticCurveTo((fx + 0.07) * s, -s * (0.13 + fh * 0.6), (fx + 0.085) * s, -s * 0.13);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        if (col !== "#fde047") ink(ctx, s, 0.6, "#9a3412");
      }
      return;
    }
    // Helmet
    const helmet = spec === 0 ? "#64748b" : "#6b8f3c";
    ctx.beginPath();
    ctx.moveTo(-s * 0.235, -s * 0.07);
    ctx.bezierCurveTo(-s * 0.25, -s * 0.34, s * 0.25, -s * 0.34, s * 0.235, -s * 0.07);
    ctx.closePath();
    ctx.fillStyle = helmet;
    ctx.fill();
    ink(ctx, s, 0.9);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.09, -s * 0.2, s * 0.06, s * 0.03, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-s * 0.27, -s * 0.095, s * 0.54, s * 0.055, s * 0.027);
    ctx.fillStyle = shadeHex(helmet, -0.2);
    ctx.fill();
    ink(ctx, s, 0.8);
    if (level >= 1 || spec === 0) {
      // A stripe, then a star for the top rank
      ctx.fillStyle = "#fde047";
      ctx.fillRect(-s * 0.03, -s * 0.265, s * 0.06, s * 0.17);
    }
    if (level === 2 || spec === 0) {
      starPath(ctx, 0, -s * 0.18, s * 0.07);
      ctx.fillStyle = spec === 0 ? "#f8fafc" : "#fde047";
      ctx.fill();
      ink(ctx, s, 0.6);
    }
    if (spec === 0) {
      // Big Bertha: a spike on top
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, -s * 0.27);
      ctx.lineTo(0, -s * 0.41);
      ctx.lineTo(s * 0.04, -s * 0.27);
      ctx.closePath();
      ctx.fillStyle = "#cbd5e1";
      ctx.fill();
      ink(ctx, s, 0.7);
    }
  };

  layered(pose.angle, weapon, body);
}

// ─── Sniper: a hooded marksman with glowing eyes ──────────────────────────────

function drawSniper(ctx: Ctx, s: number, level: Level, spec: Spec, pose: TowerPose, f: Face) {
  const purple = "#8b5cf6";
  const dark = "#6d28d9";
  const eye = spec === 1 ? "#67e8f9" : "#fde047";

  const weapon = () => {
    ctx.save();
    ctx.translate(0, s * 0.07);
    ctx.rotate(pose.angle);
    const kick = -pose.recoil * s * 0.11;
    const len = s * (spec === 0 ? 0.62 : 0.48 + level * 0.035);
    const gold = level === 2 || spec !== null ? "#f59e0b" : undefined;
    if (spec === 1) {
      barrel(ctx, s, s * 0.04 + kick, -s * 0.035, len, s * 0.055, "#334155", gold);
      barrel(ctx, s, s * 0.04 + kick, s * 0.035, len, s * 0.055, "#334155", gold);
    } else {
      barrel(ctx, s, s * 0.04 + kick, 0, len, s * (spec === 0 ? 0.09 : 0.07), "#334155", gold);
    }
    // Stock
    ctx.beginPath();
    ctx.roundRect(-s * 0.02 + kick, -s * 0.06, s * 0.2, s * 0.12, s * 0.04);
    ctx.fillStyle = "#92400e";
    ctx.fill();
    ink(ctx, s, 0.8);
    // Scope with a lens that glints
    ctx.beginPath();
    ctx.roundRect(s * 0.1 + kick, -s * 0.125, s * 0.2, s * 0.065, s * 0.03);
    ctx.fillStyle = gold ?? "#1f2937";
    ctx.fill();
    ink(ctx, s, 0.7);
    circle(ctx, s * 0.3 + kick, -s * 0.093, s * 0.03, "#67e8f9");
    muzzleFlash(ctx, s * 0.04 + len + kick + s * 0.06, 0, s * 0.13, pose.flash, "#e9d5ff");
    ctx.restore();
  };

  const body = () => {
    feet(ctx, s, "#4c1d95", 0.09);
    // Cloak
    cel(ctx, () => blobPath(ctx, 0, s * 0.03, s * 0.44, s * 0.46), purple, s, { cy: s * 0.03, w: s * 0.46, h: s * 0.5 });
    if (spec === 0) {
      // Deadeye: a wide-brimmed hat with a feather
      ctx.beginPath();
      ctx.moveTo(s * 0.08, -s * 0.3);
      ctx.quadraticCurveTo(s * 0.26, -s * 0.48, s * 0.2, -s * 0.26);
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ink(ctx, s, 0.6);
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.2);
      ctx.bezierCurveTo(-s * 0.15, -s * 0.42, s * 0.15, -s * 0.42, s * 0.15, -s * 0.2);
      ctx.closePath();
      ctx.fillStyle = "#4c1d95";
      ctx.fill();
      ink(ctx, s, 0.85);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.195, s * 0.31, s * 0.06, 0, 0, TAU);
      ctx.fillStyle = "#5b21b6";
      ctx.fill();
      ink(ctx, s, 0.85);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(-s * 0.145, -s * 0.255, s * 0.29, s * 0.035);
    } else {
      // Pointed hood, tip flopping to one side
      const flop = Math.sin(f.time * 2.4) * s * 0.02;
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.03);
      ctx.bezierCurveTo(-s * 0.24, -s * 0.3, -s * 0.02, -s * 0.36, s * 0.13 + flop, -s * 0.46);
      ctx.bezierCurveTo(s * 0.12, -s * 0.34, s * 0.25, -s * 0.24, s * 0.2, -s * 0.03);
      ctx.closePath();
      ctx.fillStyle = dark;
      ctx.fill();
      ink(ctx, s, 0.9);
      if (level === 2 || spec === 1) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.17, -s * 0.07);
        ctx.bezierCurveTo(-s * 0.2, -s * 0.27, s * 0.2, -s * 0.27, s * 0.17, -s * 0.07);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.stroke();
      }
    }
    // The face is just a shadow with two bright eyes in it
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.06, s * 0.135, s * 0.11, 0, 0, TAU);
    ctx.fillStyle = "#1e1b4b";
    ctx.fill();
    ink(ctx, s, 0.7);
    // Taking aim: one eye shut
    const aiming = f.mood === "focus";
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.06, s * 0.13, s * 0.105, 0, 0, TAU);
    ctx.clip();
    if (aiming) {
      drawEyes(ctx, { x: s * 0.06, y: -s * 0.06, r: s * 0.04, spread: 0, ...f, mood: "calm", blink: false, white: eye, bare: true });
      ctx.strokeStyle = eye;
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.06);
      ctx.lineTo(-s * 0.03, -s * 0.06);
      ctx.stroke();
    } else {
      drawEyes(ctx, { x: 0, y: -s * 0.06, r: s * 0.038, spread: s * 0.06, ...f, white: eye, bare: true });
    }
    ctx.restore();
    if (spec === 1) {
      // Marksman: goggle strap
      ctx.strokeStyle = "#0e7490";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(-s * 0.19, -s * 0.08);
      ctx.lineTo(-s * 0.13, -s * 0.07);
      ctx.moveTo(s * 0.13, -s * 0.07);
      ctx.lineTo(s * 0.19, -s * 0.08);
      ctx.stroke();
    }
    // Cloak clasp
    circle(ctx, 0, s * 0.09, s * 0.035, INK);
    circle(ctx, 0, s * 0.09, s * 0.022, level >= 1 || spec !== null ? "#fbbf24" : "#c4b5fd");
  };

  layered(pose.angle, weapon, body);
}

// ─── Tesla: a cheerful ball of lightning on a copper coil ─────────────────────

function drawTesla(ctx: Ctx, s: number, level: Level, spec: Spec, pose: TowerPose, f: Face) {
  const copper = spec === 1 ? "#94a3b8" : level === 2 || spec === 0 ? "#fbbf24" : "#ea8a2e";
  const flash = Math.min(1, pose.flash / 0.05);
  const orbR = s * (0.165 + level * 0.008);
  const oy = -s * 0.13 + Math.sin(f.time * 3) * s * 0.012;

  // Coil
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const ry = s * (0.2 - i * 0.075);
    const rw = s * (0.2 - i * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, ry, rw, rw * 0.36, 0, 0, TAU);
    ctx.fillStyle = copper;
    ctx.fill();
    ink(ctx, s, 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-rw * 0.3, ry - rw * 0.1, rw * 0.3, rw * 0.08, 0, 0, TAU);
    ctx.fill();
  }

  // Glow
  const pulse = 0.5 + 0.5 * Math.sin(f.time * 6);
  ctx.save();
  ctx.globalAlpha = 0.22 + pulse * 0.12 + flash * 0.4;
  circle(ctx, 0, oy, orbR * (1.45 + flash * 0.3), "#fef08a");
  ctx.restore();

  // Storm Coil: little sparks in orbit (behind first)
  const mini = (a: number) => {
    const mx = Math.cos(a) * s * 0.3;
    const my = oy + Math.sin(a) * s * 0.1;
    circle(ctx, mx, my, s * 0.055, INK);
    circle(ctx, mx, my, s * 0.038, "#fef9c3");
  };
  const orbits = spec === 0 ? [f.time * 3, f.time * 3 + Math.PI] : [];
  orbits.filter((a) => Math.sin(a) < 0).forEach(mini);

  if (spec === 1) {
    // Arc Lance: a steel spike through the top
    ctx.beginPath();
    ctx.moveTo(-s * 0.045, oy - orbR * 0.8);
    ctx.lineTo(0, oy - orbR - s * 0.2);
    ctx.lineTo(s * 0.045, oy - orbR * 0.8);
    ctx.closePath();
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
    ink(ctx, s, 0.8);
  }

  // The orb is the head
  cel(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(0, oy, orbR, 0, TAU);
    },
    flash > 0.3 ? "#fef9c3" : "#fde047",
    s,
    { cy: oy, w: orbR * 2.1, h: orbR * 2.1 },
  );
  cheeks(ctx, 0, oy + orbR * 0.28, orbR * 0.62, orbR * 0.17, "rgba(251,146,60,0.65)");
  const excited = pose.flash > 0 || pose.recoil > 0.3;
  drawEyes(ctx, {
    x: 0,
    y: oy - orbR * 0.08,
    r: orbR * 0.24,
    spread: orbR * 0.4,
    ...f,
    mood: spec === 1 && f.mood === "calm" ? "focus" : f.mood === "focus" && spec !== 1 ? "calm" : f.mood,
  });
  drawMouth(
    ctx,
    f.lookX * orbR * 0.1,
    oy + orbR * 0.4,
    orbR * 0.5,
    f.mood === "dizzy" ? "o" : f.mood === "sleepy" ? "flat" : excited || f.mood === "happy" ? "open" : "grin",
  );

  orbits.filter((a) => Math.sin(a) >= 0).forEach(mini);

  // Crackle
  const rnd = mulberry32(Math.floor(f.time * 12));
  if (f.mood !== "sleepy" && rnd() < 0.65) {
    ctx.strokeStyle = "#fffbeb";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.lineJoin = "round";
    ctx.beginPath();
    const a = -Math.PI * rnd();
    let px = Math.cos(a) * orbR * 1.05;
    let py = oy + Math.sin(a) * orbR * 1.05;
    ctx.moveTo(px, py);
    for (let i = 0; i < 3; i++) {
      px += Math.cos(a) * s * 0.05 + (rnd() - 0.5) * s * 0.07;
      py += Math.sin(a) * s * 0.05 + (rnd() - 0.5) * s * 0.07;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

// ─── Beacon: a little lighthouse that keeps watch ─────────────────────────────

function drawBeacon(ctx: Ctx, s: number, level: Level, spec: Spec, f: Face) {
  const tall = s * (0.24 + level * 0.02 + (spec === 1 ? 0.05 : 0));
  const lampY = -tall - s * 0.02;
  const lamp = spec === 0 ? "#fb923c" : "#fde68a";
  const stripe = spec === 0 ? "#ef4444" : "#10b981";

  // Sweeping light
  ctx.save();
  ctx.translate(0, lampY);
  ctx.rotate(f.time * 1.6);
  ctx.fillStyle = "rgba(254,240,138,0.32)";
  for (const dir of [0, Math.PI]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, s * 0.5, dir - 0.26, dir + 0.26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Striped tower
  const bw = s * 0.19;
  const tw = s * 0.12;
  const towerPath = () => {
    ctx.beginPath();
    ctx.moveTo(-bw, s * FEET);
    ctx.lineTo(-tw, -tall + s * 0.08);
    ctx.lineTo(tw, -tall + s * 0.08);
    ctx.lineTo(bw, s * FEET);
    ctx.closePath();
  };
  towerPath();
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.save();
  towerPath();
  ctx.clip();
  ctx.fillStyle = stripe;
  ctx.fillRect(-bw, s * 0.15, bw * 2, s * 0.075);
  ctx.fillRect(-bw, -tall + s * 0.08, bw * 2, s * 0.06);
  ctx.fillStyle = "rgba(15,23,42,0.12)";
  ctx.fillRect(s * 0.05, -tall, bw, s);
  ctx.restore();
  towerPath();
  ink(ctx, s, 0.9);

  // A face between the stripes
  const faceY = s * 0.04 - (tall - s * 0.24) * 0.3;
  cheeks(ctx, 0, faceY + s * 0.04, s * 0.085, s * 0.025);
  drawEyes(ctx, { x: 0, y: faceY, r: s * 0.036, spread: s * 0.058, ...f });
  drawMouth(ctx, 0, faceY + s * 0.065, s * 0.06, f.mood === "happy" ? "grin" : "smile");

  // Gallery, lamp and roof
  ctx.beginPath();
  ctx.roundRect(-tw - s * 0.045, -tall + s * 0.035, tw * 2 + s * 0.09, s * 0.055, s * 0.02);
  ctx.fillStyle = "#475569";
  ctx.fill();
  ink(ctx, s, 0.8);
  const glow = 0.75 + 0.25 * Math.sin(f.time * 4);
  ctx.save();
  ctx.globalAlpha = 0.4 * glow;
  circle(ctx, 0, lampY, s * (0.17 + level * 0.015), lamp);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, lampY, s * 0.085, 0, TAU);
  ctx.fillStyle = lamp;
  ctx.fill();
  ink(ctx, s, 0.8);
  circle(ctx, -s * 0.025, lampY - s * 0.025, s * 0.025, "#ffffff");
  ctx.beginPath();
  ctx.moveTo(-s * 0.125, lampY - s * 0.06);
  ctx.lineTo(0, lampY - s * 0.2);
  ctx.lineTo(s * 0.125, lampY - s * 0.06);
  ctx.closePath();
  ctx.fillStyle = spec === 0 ? "#b91c1c" : "#047857";
  ctx.fill();
  ink(ctx, s, 0.8);
  if (spec === 1) circle(ctx, 0, lampY - s * 0.21, s * 0.03, "#fde047");
}

// ─── Gold Mine: a mole in a hard hat, popping up with the takings ─────────────

function drawMine(ctx: Ctx, s: number, level: Level, spec: Spec, f: Face, seed: number) {
  // Tunnel mouth
  const mouth = () => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.21, s * 0.2);
    ctx.lineTo(-s * 0.21, -s * 0.06);
    ctx.arc(0, -s * 0.06, s * 0.21, Math.PI, 0);
    ctx.lineTo(s * 0.21, s * 0.2);
    ctx.closePath();
  };
  mouth();
  ctx.fillStyle = "#1c1917";
  ctx.fill();

  // The mole bobs up for a look, then ducks back down
  const peek = 0.5 + 0.5 * Math.sin(f.time * 1.3 + seed);
  const my = s * (0.1 - peek * 0.13);
  ctx.save();
  mouth();
  ctx.clip();
  cel(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(0, my, s * 0.135, s * 0.125, 0, 0, TAU);
    },
    "#9a6b45",
    s,
    { cy: my, w: s * 0.28, h: s * 0.26, shine: false },
  );
  // Snout and nose
  ctx.beginPath();
  ctx.ellipse(0, my + s * 0.05, s * 0.07, s * 0.05, 0, 0, TAU);
  ctx.fillStyle = "#e7c9a5";
  ctx.fill();
  circle(ctx, 0, my + s * 0.028, s * 0.026, "#fb7185");
  drawEyes(ctx, { x: 0, y: my - s * 0.02, r: s * 0.027, spread: s * 0.06, ...f });
  // Hard hat with a lamp
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, my - s * 0.06);
  ctx.bezierCurveTo(-s * 0.13, my - s * 0.2, s * 0.13, my - s * 0.2, s * 0.13, my - s * 0.06);
  ctx.closePath();
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ink(ctx, s, 0.8);
  ctx.save();
  ctx.globalAlpha = 0.5;
  circle(ctx, 0, my - s * 0.115, s * 0.06, "#fef9c3");
  ctx.restore();
  circle(ctx, 0, my - s * 0.115, s * 0.03, "#ffffff");
  ctx.restore();

  // Timber frame
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, s * 0.1);
  ctx.lineCap = "round";
  const frame = () => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, s * 0.2);
    ctx.lineTo(-s * 0.21, -s * 0.2);
    ctx.moveTo(s * 0.24, s * 0.2);
    ctx.lineTo(s * 0.21, -s * 0.2);
    ctx.moveTo(-s * 0.27, -s * 0.21);
    ctx.lineTo(s * 0.27, -s * 0.21);
  };
  frame();
  ctx.stroke();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = Math.max(1.5, s * 0.058);
  frame();
  ctx.stroke();

  // Gold: more of it at each level
  const nuggets: [number, number, number][] = [
    [-0.08, 0.19, 0.065],
    [0.07, 0.2, 0.06],
    [0, 0.13, 0.06],
    [-0.16, 0.22, 0.05],
    [0.16, 0.22, 0.05],
    [0.11, 0.12, 0.05],
    [-0.11, 0.12, 0.05],
  ];
  const count = spec !== null ? nuggets.length : 3 + level * 2;
  for (let i = count - 1; i >= 0; i--) {
    const [nx, ny, nr] = nuggets[i];
    ctx.beginPath();
    ctx.arc(nx * s, ny * s, nr * s, 0, TAU);
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ink(ctx, s, 0.7, "#854d0e");
    circle(ctx, nx * s - nr * s * 0.3, ny * s - nr * s * 0.3, nr * s * 0.28, "#fef9c3");
  }
  if (spec === 0) {
    // Vault: a crown on the lintel
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.25);
    ctx.lineTo(-s * 0.11, -s * 0.36);
    ctx.lineTo(-s * 0.05, -s * 0.3);
    ctx.lineTo(0, -s * 0.38);
    ctx.lineTo(s * 0.05, -s * 0.3);
    ctx.lineTo(s * 0.11, -s * 0.36);
    ctx.lineTo(s * 0.1, -s * 0.25);
    ctx.closePath();
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ink(ctx, s, 0.7);
  }
  if (spec === 1) {
    // Bounty Board: a wanted poster nailed to the frame
    ctx.beginPath();
    ctx.rect(s * 0.1, -s * 0.4, s * 0.17, s * 0.2);
    ctx.fillStyle = "#fef3c7";
    ctx.fill();
    ink(ctx, s, 0.7);
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(s * 0.13, -s * 0.37, s * 0.11, s * 0.03);
    circle(ctx, s * 0.185, -s * 0.275, s * 0.035, "#6fd36a");
  }
  // Twinkle on the gold
  const tw = (f.time * 0.9) % 1;
  const size = Math.sin((tw % 0.5) * TAU) * s * 0.075;
  if (size > 0) {
    starPath(ctx, (tw < 0.5 ? -0.08 : 0.08) * s, (tw < 0.5 ? 0.15 : 0.1) * s, size, f.time);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
}
