// ─── Tower Defense: canvas sprites & renderer ─────────────────────────────────
//
// All art is drawn procedurally with the Canvas 2D API so it scales crisply to
// any cell size / device pixel ratio. Coordinates passed to the draw helpers
// are in pixels; `s` is the size of one grid cell in pixels.

import {
  COLS,
  ENEMIES,
  HEAL_AURA_RANGE,
  ROWS,
  TERRAIN,
  TOWERS,
  type Cell,
  type EnemyType,
  type EntryDef,
  type MapDef,
  type Terrain,
  type ThemeId,
  type TowerType,
} from "./config";
import { coverageOutline, createGame, isGate, rangeAt, towerRange } from "./engine";
import type { Bolt, Enemy, Game, Level, Particle, Projectile, Tower } from "./engine";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ─── Small utilities ──────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function shadeHex(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

interface Theme {
  groundA: string;
  groundB: string;
  vignette: string;
  tuft: string;
  flowers: [string, string] | null;
  pathEdge: string;
  path: string;
  pathLight: string;
  pathPebble: string;
  water: string;
  waterDeep: string;
  foam: string;
  rockTop: string;
  rockMid: string;
  rockDark: string;
  /** Snow on top of rocks. */
  rockCap: string | null;
  hillTop: string;
  hillSide: string;
  cobble: string;
  cobbleStone: string;
}

const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    groundA: "#7ccf5e",
    groundB: "#73c556",
    vignette: "rgba(20,60,10,0.22)",
    tuft: "rgba(40,110,30,0.55)",
    flowers: ["#fff7d6", "#ffd84d"],
    pathEdge: "#a47d4a",
    path: "#e2c38b",
    pathLight: "rgba(244,224,180,0.6)",
    pathPebble: "rgba(140,100,55,0.45)",
    water: "#4fb7ee",
    waterDeep: "#2f8fd0",
    foam: "rgba(255,255,255,0.75)",
    rockTop: "#c9ccd2",
    rockMid: "#9aa0aa",
    rockDark: "#5d636e",
    rockCap: null,
    hillTop: "#a6e37f",
    hillSide: "#4c9a3c",
    cobble: "#a8a29e",
    cobbleStone: "#d6d3d1",
  },
  river: {
    groundA: "#68c877",
    groundB: "#5fbe6e",
    vignette: "rgba(10,60,40,0.24)",
    tuft: "rgba(25,105,60,0.55)",
    flowers: ["#ffffff", "#f9a8d4"],
    pathEdge: "#9c7a4c",
    path: "#dcc08e",
    pathLight: "rgba(240,224,186,0.6)",
    pathPebble: "rgba(130,96,56,0.45)",
    water: "#3fa9e6",
    waterDeep: "#2380c2",
    foam: "rgba(255,255,255,0.8)",
    rockTop: "#cfd3d8",
    rockMid: "#9199a3",
    rockDark: "#566069",
    rockCap: null,
    hillTop: "#98e08d",
    hillSide: "#3f9150",
    cobble: "#a8a29e",
    cobbleStone: "#d6d3d1",
  },
  canyon: {
    groundA: "#e6c583",
    groundB: "#dfbc78",
    vignette: "rgba(110,60,10,0.2)",
    tuft: "rgba(150,105,45,0.55)",
    flowers: null,
    pathEdge: "#b98852",
    path: "#f3dfb2",
    pathLight: "rgba(255,244,214,0.6)",
    pathPebble: "rgba(150,100,50,0.45)",
    water: "#4fb7ee",
    waterDeep: "#2f8fd0",
    foam: "rgba(255,255,255,0.75)",
    rockTop: "#e59a66",
    rockMid: "#c0703f",
    rockDark: "#7c4526",
    rockCap: null,
    hillTop: "#f6dda4",
    hillSide: "#b98a4a",
    cobble: "#b9a58a",
    cobbleStone: "#e2d3bb",
  },
  frost: {
    groundA: "#eaf4fb",
    groundB: "#dfedf7",
    vignette: "rgba(60,100,150,0.2)",
    tuft: "rgba(140,175,205,0.7)",
    flowers: null,
    pathEdge: "#9db2c8",
    path: "#c9d8e6",
    pathLight: "rgba(255,255,255,0.55)",
    pathPebble: "rgba(110,135,160,0.4)",
    water: "#8fd3f0",
    waterDeep: "#56aede",
    foam: "rgba(255,255,255,0.95)",
    rockTop: "#aab4c2",
    rockMid: "#7c8797",
    rockDark: "#4c5564",
    rockCap: "#ffffff",
    hillTop: "#ffffff",
    hillSide: "#a9c3da",
    cobble: "#9aa8b8",
    cobbleStone: "#cdd7e2",
  },
  island: {
    groundA: "#8fd46b",
    groundB: "#86ca62",
    vignette: "rgba(10,70,60,0.2)",
    tuft: "rgba(40,120,40,0.55)",
    flowers: ["#fff7d6", "#fb7185"],
    pathEdge: "#b39356",
    path: "#eed9a4",
    pathLight: "rgba(255,243,205,0.6)",
    pathPebble: "rgba(150,115,60,0.45)",
    water: "#35c3e8",
    waterDeep: "#1596c4",
    foam: "rgba(255,255,255,0.85)",
    rockTop: "#d2d5da",
    rockMid: "#9aa0aa",
    rockDark: "#5d636e",
    rockCap: null,
    hillTop: "#b5ea8a",
    hillSide: "#4f9f3e",
    cobble: "#a8a29e",
    cobbleStone: "#d6d3d1",
  },
};

// ─── Terrain tiles ────────────────────────────────────────────────────────────

/** A yes/no for each of a cell's four sides (used for shores and bridges). */
interface Shore {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

const cellSeed = (r: number, c: number) => r * 131 + c * 17 + 7;

function drawWaterTile(ctx: Ctx, x: number, y: number, s: number, th: Theme, land: Shore, seed: number) {
  ctx.fillStyle = th.water;
  ctx.fillRect(x - 0.5, y - 0.5, s + 1, s + 1);
  // The bank casts a shadow on the far (top) edge.
  if (land.n) {
    const g = ctx.createLinearGradient(0, y, 0, y + s * 0.3);
    g.addColorStop(0, th.waterDeep);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s * 0.3);
  }
  // Little wave marks
  const rnd = mulberry32(seed);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    const wx = x + s * (0.2 + rnd() * 0.5);
    const wy = y + s * (0.3 + rnd() * 0.5);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + s * 0.08, wy - s * 0.05, wx + s * 0.16, wy);
    ctx.stroke();
  }
  // Foam where water meets land
  ctx.strokeStyle = th.foam;
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  const m = s * 0.05;
  ctx.beginPath();
  if (land.n) {
    ctx.moveTo(x + m, y + m);
    ctx.lineTo(x + s - m, y + m);
  }
  if (land.s) {
    ctx.moveTo(x + m, y + s - m);
    ctx.lineTo(x + s - m, y + s - m);
  }
  if (land.w) {
    ctx.moveTo(x + m, y + m);
    ctx.lineTo(x + m, y + s - m);
  }
  if (land.e) {
    ctx.moveTo(x + s - m, y + m);
    ctx.lineTo(x + s - m, y + s - m);
  }
  ctx.stroke();
}

function drawHillTile(ctx: Ctx, x: number, y: number, s: number, th: Theme) {
  shadow(ctx, x + s / 2, y + s * 0.95, s * 0.46, s * 0.1, 0.2);
  ctx.fillStyle = th.hillSide;
  ctx.beginPath();
  ctx.roundRect(x + s * 0.04, y + s * 0.12, s * 0.92, s * 0.84, s * 0.2);
  ctx.fill();
  ctx.fillStyle = th.hillTop;
  ctx.beginPath();
  ctx.roundRect(x + s * 0.04, y + s * 0.02, s * 0.92, s * 0.82, s * 0.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.roundRect(x + s * 0.1, y + s * 0.08, s * 0.8, s * 0.7, s * 0.16);
  ctx.stroke();
  // Double chevron: "higher ground"
  ctx.strokeStyle = th.hillSide;
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const oy of [0.36, 0.52]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.34, y + s * (oy + 0.1));
    ctx.lineTo(x + s * 0.5, y + s * oy);
    ctx.lineTo(x + s * 0.66, y + s * (oy + 0.1));
    ctx.stroke();
  }
}

function drawRoadTile(ctx: Ctx, x: number, y: number, s: number, th: Theme, water: Shore, seed: number) {
  const across = water.n || water.s; // water above/below: the deck runs left to right
  const along = water.e || water.w;
  if (across || along) {
    // Wooden bridge
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    if (!across) ctx.rotate(Math.PI / 2);
    const half = s / 2 + 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(-half, s * 0.38, half * 2, s * 0.1);
    ctx.fillStyle = "#c08a52";
    ctx.fillRect(-half, -s * 0.4, half * 2, s * 0.8);
    ctx.strokeStyle = "rgba(90,55,25,0.55)";
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const px = -half + (i * (half * 2)) / 4;
      ctx.moveTo(px, -s * 0.4);
      ctx.lineTo(px, s * 0.4);
    }
    ctx.stroke();
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(-half, -s * 0.46, half * 2, s * 0.1);
    ctx.fillRect(-half, s * 0.36, half * 2, s * 0.1);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-half, -s * 0.46, half * 2, s * 0.03);
    ctx.restore();
    return;
  }
  // Cobblestones
  ctx.fillStyle = th.cobble;
  ctx.beginPath();
  ctx.roundRect(x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94, s * 0.12);
  ctx.fill();
  const rnd = mulberry32(seed);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const px = x + s * (0.2 + i * 0.3 + (rnd() - 0.5) * 0.06 + (j % 2) * 0.05);
      const py = y + s * (0.2 + j * 0.3 + (rnd() - 0.5) * 0.06);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(px, py + s * 0.02, s * 0.12, s * 0.1, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = th.cobbleStone;
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.12, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function boulder(ctx: Ctx, cx: number, cy: number, rad: number, th: Theme, rnd: () => number, snow: boolean) {
  const pts: [number, number][] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.3;
    const rr = rad * (0.82 + rnd() * 0.3);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]);
  }
  const trace = (scale: number, ox: number, oy: number) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const qx = cx + (px - cx) * scale + ox;
      const qy = cy + (py - cy) * scale + oy;
      if (i === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    });
    ctx.closePath();
  };
  shadow(ctx, cx, cy + rad * 0.8, rad * 1.05, rad * 0.3, 0.25);
  ctx.lineJoin = "round";
  trace(1, 0, 0);
  ctx.fillStyle = th.rockMid;
  ctx.fill();
  ctx.strokeStyle = th.rockDark;
  ctx.lineWidth = Math.max(1, rad * 0.12);
  ctx.stroke();
  // Lit top face
  trace(0.62, -rad * 0.14, -rad * 0.2);
  ctx.fillStyle = snow && th.rockCap ? th.rockCap : th.rockTop;
  ctx.fill();
  // Crack
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = Math.max(1, rad * 0.07);
  ctx.beginPath();
  ctx.moveTo(cx + rad * 0.15, cy + rad * 0.1);
  ctx.lineTo(cx + rad * 0.4, cy + rad * 0.5);
  ctx.stroke();
}

function drawRockTile(ctx: Ctx, x: number, y: number, s: number, th: Theme, seed: number) {
  // Dark footing so a row of rocks reads as one solid wall.
  ctx.fillStyle = th.rockDark;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x - 0.5, y - 0.5, s + 1, s + 1);
  ctx.globalAlpha = 1;
  const rnd = mulberry32(seed);
  boulder(ctx, x + s * 0.7, y + s * 0.34, s * 0.24, th, rnd, false);
  boulder(ctx, x + s * 0.45, y + s * 0.5, s * 0.4, th, rnd, true);
}

function drawRubbleTile(ctx: Ctx, x: number, y: number, s: number, seed: number) {
  const rnd = mulberry32(seed);
  const stones: Theme = { ...THEMES.meadow, rockTop: "#cfc7ba", rockMid: "#978c7d", rockDark: "#5f564b" };
  shadow(ctx, x + s / 2, y + s * 0.8, s * 0.44, s * 0.14, 0.22);
  // Splintered planks
  ctx.strokeStyle = "#7a5230";
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.16, y + s * 0.74);
  ctx.lineTo(x + s * 0.8, y + s * 0.3);
  ctx.moveTo(x + s * 0.22, y + s * 0.28);
  ctx.lineTo(x + s * 0.84, y + s * 0.72);
  ctx.stroke();
  boulder(ctx, x + s * 0.34, y + s * 0.56, s * 0.2, stones, rnd, false);
  boulder(ctx, x + s * 0.66, y + s * 0.6, s * 0.17, stones, rnd, false);
  boulder(ctx, x + s * 0.5, y + s * 0.38, s * 0.19, stones, rnd, false);
}

// ─── Board (cached to an offscreen canvas) ────────────────────────────────────

function drawGround(ctx: Ctx, terrain: Terrain[][], th: Theme, s: number) {
  const w = COLS * s;
  const h = ROWS * s;
  const rnd = mulberry32(1337);
  const isWater = (r: number, c: number) => terrain[r]?.[c] === "water";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? th.groundA : th.groundB;
      ctx.fillRect(c * s, r * s, s, s);
    }
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  vg.addColorStop(0, "rgba(255,255,255,0)");
  vg.addColorStop(1, th.vignette);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Decorations: tufts, flowers, pebbles (open ground only)
  for (let i = 0; i < COLS * ROWS * 0.9; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const kind = rnd();
    const pick = rnd();
    if (terrain[Math.floor(y / s)]?.[Math.floor(x / s)] !== "grass") continue;
    if (kind < 0.6) {
      ctx.strokeStyle = th.tuft;
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.lineCap = "round";
      const t = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(x - t, y - t);
      ctx.lineTo(x, y + t * 0.4);
      ctx.lineTo(x + t, y - t);
      ctx.moveTo(x, y + t * 0.4);
      ctx.lineTo(x, y - t * 1.2);
      ctx.stroke();
    } else if (kind < 0.8 && th.flowers) {
      const col = pick < 0.5 ? th.flowers[0] : th.flowers[1];
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * TAU;
        circle(ctx, x + Math.cos(a) * s * 0.035, y + Math.sin(a) * s * 0.035, s * 0.03, col);
      }
      circle(ctx, x, y, s * 0.025, "#f59e0b");
    } else {
      circle(ctx, x, y + s * 0.01, s * 0.045, "rgba(0,0,0,0.15)");
      circle(ctx, x, y, s * 0.04, "#c9c3b5");
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = terrain[r][c];
      if (t === "water") {
        // Off-board counts as water so lakes run off the edge of the map.
        const land = (rr: number, cc: number) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && !isWater(rr, cc);
        drawWaterTile(
          ctx,
          c * s,
          r * s,
          s,
          th,
          { n: land(r - 1, c), e: land(r, c + 1), s: land(r + 1, c), w: land(r, c - 1) },
          cellSeed(r, c),
        );
      } else if (t === "hill") {
        drawHillTile(ctx, c * s, r * s, s, th);
      }
    }
  }
}

function drawRoutes(ctx: Ctx, g: Game, th: Theme, s: number) {
  const lines = g.routes
    .filter((route) => route.cells.length)
    .map((route) => {
      const entry = g.entries[route.entry];
      const pts = route.cells.map((p) => ({ x: (p.c + 0.5) * s, y: (p.r + 0.5) * s }));
      // Lead-in from off the board
      pts.unshift({ x: (entry.c - entry.dc + 0.5) * s, y: (entry.r - entry.dr + 0.5) * s });
      return { pts, open: route.open };
    });
  const trace = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const open = lines.filter((l) => l.open);
  // Layer by layer so routes that share cells blend into one road.
  const layers: [string, number, number][] = [
    ["rgba(0,0,0,0.15)", 0.86, 0.05],
    [th.pathEdge, 0.82, 0],
    [th.path, 0.68, 0],
    [th.pathLight, 0.28, 0],
  ];
  for (const [color, width, dy] of layers) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * width;
    for (const l of open) {
      ctx.save();
      ctx.translate(0, s * dy);
      trace(l.pts);
      ctx.stroke();
      ctx.restore();
    }
  }
  const prnd = mulberry32(42);
  for (const route of g.routes) {
    if (!route.open) continue;
    for (const p of route.cells) {
      for (let i = 0; i < 2; i++) {
        const px = (p.c + 0.5 + (prnd() - 0.5) * 0.5) * s;
        const py = (p.r + 0.5 + (prnd() - 0.5) * 0.5) * s;
        circle(ctx, px, py, s * (0.02 + prnd() * 0.025), th.pathPebble);
      }
    }
  }
  // Portals that haven't opened yet: a dotted hint of where enemies will walk.
  ctx.save();
  ctx.setLineDash([s * 0.12, s * 0.26]);
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.strokeStyle = "rgba(88,28,135,0.45)";
  for (const l of lines) {
    if (l.open) continue;
    trace(l.pts);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacles(ctx: Ctx, g: Game, th: Theme, s: number) {
  const isWater = (r: number, c: number) => g.terrain[r]?.[c] === "water";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = g.terrain[r][c];
      if (t === "road" && !isGate(g, r, c)) {
        drawRoadTile(
          ctx,
          c * s,
          r * s,
          s,
          th,
          { n: isWater(r - 1, c), e: isWater(r, c + 1), s: isWater(r + 1, c), w: isWater(r, c - 1) },
          cellSeed(r, c),
        );
      } else if (t === "rubble") {
        drawRubbleTile(ctx, c * s, r * s, s, cellSeed(r, c));
      } else if (t === "rock") {
        drawRockTile(ctx, c * s, r * s, s, th, cellSeed(r, c));
      }
    }
  }
}

export function drawBoard(ctx: Ctx, g: Game, s: number) {
  const th = THEMES[g.map.theme];
  drawGround(ctx, g.terrain, th, s);
  drawRoutes(ctx, g, th, s);
  drawObstacles(ctx, g, th, s);
}

/** A small static picture of a map for the map picker. */
export function drawMapThumb(ctx: Ctx, map: MapDef, s: number) {
  const g = createGame(map, "normal");
  drawBoard(ctx, g, s);
  g.entries.forEach((entry, i) => drawPortal(ctx, s, 0.4, entry, g.routes[i]?.open ?? true));
  for (const exit of g.exits) drawCastle(ctx, s, 0, 1, 1, exit);
}

/** One terrain tile on a patch of ground, for the field guide. */
export function drawTerrainSwatch(ctx: Ctx, terrain: Terrain, size: number) {
  const th = THEMES.meadow;
  ctx.fillStyle = th.groundA;
  ctx.fillRect(0, 0, size, size);
  const all: Shore = { n: true, e: true, s: true, w: true };
  switch (terrain) {
    case "water":
      drawWaterTile(ctx, 0, 0, size, th, all, 5);
      break;
    case "hill":
      drawHillTile(ctx, 0, 0, size, th);
      break;
    case "road":
      drawRoadTile(ctx, 0, 0, size, th, { n: false, e: false, s: false, w: false }, 5);
      break;
    case "rock":
      drawRockTile(ctx, 0, 0, size, th, 5);
      break;
    case "rubble":
      drawRubbleTile(ctx, 0, 0, size, 5);
      break;
    default:
      ctx.fillStyle = th.groundB;
      ctx.fillRect(size / 2, 0, size / 2, size / 2);
      ctx.fillRect(0, size / 2, size / 2, size / 2);
  }
}

/** Faint outlines on every cell a tower could go, shown while building. */
export function drawGridOverlay(ctx: Ctx, g: Game, s: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!TERRAIN[g.terrain[r][c]].build || g.blocked[r][c] || isGate(g, r, c)) continue;
      ctx.roundRect(c * s + 1.5, r * s + 1.5, s - 3, s - 3, s * 0.12);
    }
  }
  ctx.stroke();
}

/** Moving glints on the water, drawn every frame over the cached board. */
function drawWaterShimmer(ctx: Ctx, g: Game, s: number, now: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = "round";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.terrain[r][c] !== "water") continue;
      const phase = (now * 0.35 + ((r * 7 + c * 13) % 10) / 10) % 1;
      const wx = (c + 0.15 + phase * 0.5) * s;
      const wy = (r + 0.3 + ((r * 3 + c * 5) % 5) * 0.1) * s;
      ctx.globalAlpha = Math.sin(phase * Math.PI);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + s * 0.09, wy - s * 0.05, wx + s * 0.18, wy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─── Portals & castles ────────────────────────────────────────────────────────

export function drawPortal(ctx: Ctx, s: number, time: number, entry: EntryDef, open: boolean) {
  const edge = entry.dr !== 0 || entry.dc !== 0;
  const x = (entry.c + 0.5 - entry.dc * 0.45) * s;
  const y = (entry.r + 0.5 - entry.dr * 0.45) * s;
  // Stand tall on the left/right edges, lie wide on the top/bottom ones.
  const rx = s * (entry.dr !== 0 ? 0.62 : edge ? 0.42 : 0.46);
  const ry = s * (entry.dr !== 0 ? 0.42 : edge ? 0.62 : 0.46);
  ctx.save();
  // Stone frame
  ctx.fillStyle = "#57534e";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry) * 0.9);
  if (open) {
    grad.addColorStop(0, "#f5d0fe");
    grad.addColorStop(0.35, "#a855f7");
    grad.addColorStop(1, "#3b0764");
  } else {
    grad.addColorStop(0, "#6b7280");
    grad.addColorStop(1, "#1f2937");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.78, ry * 0.84, 0, 0, TAU);
  ctx.fill();
  if (open) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a0 = time * 2.5 + (i * TAU) / 3;
      const k = 0.3 + i * 0.18;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * k, ry * k, 0, a0, a0 + 1.6);
      ctx.stroke();
    }
  } else if (s >= 22) {
    // Shut for now: say when it opens.
    const label = `Wave ${entry.fromWave}`;
    const fs = Math.max(9, s * 0.26);
    const lx = (entry.c + 0.5 + entry.dc * 0.55) * s;
    const ly = (entry.r + 0.5 + entry.dr * 0.55) * s;
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width + fs * 0.9;
    const px = Math.max(tw / 2 + 2, Math.min(COLS * s - tw / 2 - 2, lx));
    ctx.fillStyle = "rgba(17,24,39,0.82)";
    ctx.beginPath();
    ctx.roundRect(px - tw / 2, ly - fs * 0.8, tw, fs * 1.6, fs * 0.8);
    ctx.fill();
    ctx.fillStyle = "#e9d5ff";
    ctx.fillText(label, px, ly + fs * 0.05);
  }
  ctx.restore();
}

export function drawCastle(ctx: Ctx, s: number, time: number, lives: number, maxLives: number, exit: Cell) {
  const cx = (exit.c + 0.5) * s;
  const base = (exit.r + 0.5) * s + s * 0.42;
  const w = s * 0.92;
  const h = s * 0.8;
  const left = cx - w / 2;
  const top = base - h;

  shadow(ctx, cx, base, w * 0.6, s * 0.12);
  // Side towers
  const towerW = w * 0.3;
  const drawTowerBlock = (x: number) => {
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(x, top - s * 0.12, towerW, h + s * 0.12);
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(x + towerW * 0.75, top - s * 0.12, towerW * 0.25, h + s * 0.12);
    // crenellations
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(x + (i * towerW) / 3 + towerW * 0.04, top - s * 0.22, towerW / 3 - towerW * 0.08, s * 0.1);
    }
    // roof
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.03, top - s * 0.22);
    ctx.lineTo(x + towerW / 2, top - s * 0.52);
    ctx.lineTo(x + towerW + s * 0.03, top - s * 0.22);
    ctx.closePath();
    ctx.fill();
  };
  // Wall
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(left, top + s * 0.08, w, h - s * 0.08);
  ctx.fillStyle = "#b5bac2";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(left + (i * w) / 4 + s * 0.02, top - s * 0.02, w / 4 - s * 0.04, s * 0.1);
  }
  drawTowerBlock(left - towerW * 0.15);
  drawTowerBlock(left + w - towerW * 0.85);
  // Door
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.16, base);
  ctx.lineTo(cx - w * 0.16, base - h * 0.42);
  ctx.arc(cx, base - h * 0.42, w * 0.16, Math.PI, 0);
  ctx.lineTo(cx + w * 0.16, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  // Flag
  const fx = cx;
  const fy = top - s * 0.25;
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(fx, top + s * 0.05);
  ctx.lineTo(fx, fy - s * 0.25);
  ctx.stroke();
  const wave = Math.sin(time * 5) * s * 0.03;
  ctx.fillStyle = lives / maxLives > 0.35 ? "#ef4444" : "#7f1d1d";
  ctx.beginPath();
  ctx.moveTo(fx, fy - s * 0.25);
  ctx.quadraticCurveTo(fx + s * 0.15, fy - s * 0.2 + wave, fx + s * 0.3, fy - s * 0.17);
  ctx.quadraticCurveTo(fx + s * 0.15, fy - s * 0.1 - wave, fx, fy - s * 0.05);
  ctx.closePath();
  ctx.fill();
}

// ─── Towers ───────────────────────────────────────────────────────────────────

const BASE_COLORS: Record<Level, { top: string; side: string; rim: string }> = {
  0: { top: "#a8a29e", side: "#78716c", rim: "#57534e" },
  1: { top: "#cbd5e1", side: "#64748b", rim: "#475569" },
  2: { top: "#fcd34d", side: "#b45309", rim: "#92400e" },
};

export interface TowerPose {
  angle: number;
  recoil: number;
  flash: number;
}

export function drawTower(
  ctx: Ctx,
  type: TowerType,
  level: Level,
  pose: TowerPose,
  x: number,
  y: number,
  s: number,
  time: number,
) {
  const def = TOWERS[type];
  const bc = BASE_COLORS[level];
  const half = s * 0.4;

  // Platform
  shadow(ctx, x, y + s * 0.3, s * 0.42, s * 0.14);
  ctx.fillStyle = bc.side;
  ctx.beginPath();
  ctx.roundRect(x - half, y - half + s * 0.08, half * 2, half * 2, s * 0.14);
  ctx.fill();
  ctx.fillStyle = bc.top;
  ctx.beginPath();
  ctx.roundRect(x - half, y - half, half * 2, half * 2 - s * 0.02, s * 0.14);
  ctx.fill();
  // Bricks / bevel
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.roundRect(x - half * 0.78, y - half * 0.78, half * 1.56, half * 1.56, s * 0.1);
  ctx.stroke();
  // Tower-colour ring
  circle(ctx, x, y, s * 0.27, bc.rim);
  circle(ctx, x, y, s * 0.24, shadeHex(def.color, -0.35));

  // Level pips
  for (let i = 0; i <= level; i++) {
    const px = x + (i - level / 2) * s * 0.13;
    const py = y + half + s * 0.02;
    circle(ctx, px, py, s * 0.055, "#78350f");
    circle(ctx, px, py, s * 0.04, "#fde047");
  }

  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case "blaster":
      drawBlaster(ctx, def.color, level, pose, s);
      break;
    case "sniper":
      drawSniper(ctx, def.color, level, pose, s);
      break;
    case "bomb":
      drawBomber(ctx, def.color, level, pose, s);
      break;
    case "frost":
      drawFrost(ctx, level, pose, s, time);
      break;
    case "tesla":
      drawTesla(ctx, level, pose, s, time);
      break;
  }
  ctx.restore();
}

function turretHead(ctx: Ctx, r: number, color: string) {
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, shadeHex(color, 0.55));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, shadeHex(color, -0.35));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -0.5);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
}

function barrel(ctx: Ctx, x0: number, y: number, len: number, w: number, color: string, tip?: string) {
  ctx.fillStyle = shadeHex(color, -0.45);
  ctx.beginPath();
  ctx.roundRect(x0, y - w / 2, len, w, w * 0.3);
  ctx.fill();
  ctx.fillStyle = shadeHex(color, -0.15);
  ctx.fillRect(x0, y - w / 2 + w * 0.15, len, w * 0.3);
  ctx.fillStyle = tip ?? shadeHex(color, -0.6);
  ctx.fillRect(x0 + len - w * 0.7, y - w * 0.6, w * 0.7, w * 1.2);
}

function muzzleFlash(ctx: Ctx, x: number, y: number, size: number, flash: number) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, flash / 0.05);
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const r = i % 2 === 0 ? size : size * 0.45;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  circle(ctx, x, y, size * 0.4, "#ffffff");
  ctx.restore();
}

function drawBlaster(ctx: Ctx, color: string, level: Level, p: TowerPose, s: number) {
  ctx.rotate(p.angle);
  const kick = -p.recoil * s * 0.08;
  const len = s * (0.36 + level * 0.03);
  const bw = s * (0.11 + level * 0.015);
  const tip = level === 2 ? "#f59e0b" : undefined;
  if (level === 0) {
    barrel(ctx, kick, 0, len, bw, color, tip);
  } else {
    barrel(ctx, kick, -s * 0.075, len, bw, color, tip);
    barrel(ctx, kick, s * 0.075, len, bw, color, tip);
  }
  turretHead(ctx, s * 0.2, color);
  // Visor
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(s * 0.06, 0, s * 0.05, s * 0.1, 0, 0, TAU);
  ctx.fill();
  if (level === 2) {
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, TAU);
    ctx.stroke();
  }
  muzzleFlash(ctx, len + kick + s * 0.04, 0, s * 0.13, p.flash);
}

function drawSniper(ctx: Ctx, color: string, level: Level, p: TowerPose, s: number) {
  ctx.rotate(p.angle);
  const kick = -p.recoil * s * 0.12;
  const len = s * (0.5 + level * 0.04);
  barrel(ctx, kick, 0, len, s * 0.075, color, level === 2 ? "#f59e0b" : undefined);
  // Muzzle brake
  ctx.fillStyle = shadeHex(color, -0.6);
  ctx.fillRect(kick + len - s * 0.04, -s * 0.06, s * 0.06, s * 0.12);
  // Body
  const grad = ctx.createLinearGradient(0, -s * 0.15, 0, s * 0.15);
  grad.addColorStop(0, shadeHex(color, 0.45));
  grad.addColorStop(1, shadeHex(color, -0.3));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-s * 0.2, -s * 0.15, s * 0.36, s * 0.3, s * 0.08);
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -0.5);
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  // Scope
  ctx.fillStyle = level === 2 ? "#f59e0b" : "#1f2937";
  ctx.beginPath();
  ctx.roundRect(-s * 0.04, -s * 0.2, s * 0.24, s * 0.08, s * 0.04);
  ctx.fill();
  circle(ctx, s * 0.2, -s * 0.16, s * 0.035, "#67e8f9");
  if (level >= 1) {
    ctx.fillStyle = shadeHex(color, -0.4);
    ctx.fillRect(-s * 0.22, -s * 0.05, s * 0.04, s * 0.1);
  }
  muzzleFlash(ctx, len + kick + s * 0.05, 0, s * 0.12, p.flash);
}

function drawBomber(ctx: Ctx, color: string, level: Level, p: TowerPose, s: number) {
  ctx.rotate(p.angle);
  const kick = -p.recoil * s * 0.07;
  const len = s * (0.4 + level * 0.025);
  const bw = s * (0.19 + level * 0.025);
  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.roundRect(kick, -bw / 2, len, bw, bw * 0.25);
  ctx.fill();
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(kick, -bw / 2 + bw * 0.12, len, bw * 0.22);
  ctx.fillStyle = level === 2 ? "#f59e0b" : "#1f2937";
  ctx.beginPath();
  ctx.roundRect(kick + len - s * 0.08, -bw / 2 - s * 0.03, s * 0.08, bw + s * 0.06, s * 0.03);
  ctx.fill();
  circle(ctx, kick + len - s * 0.02, 0, bw * 0.3, "#111827");
  turretHead(ctx, s * 0.22, color);
  // Bands
  ctx.strokeStyle = level >= 1 ? "#fde047" : shadeHex(color, -0.4);
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.13, 0, TAU);
  ctx.stroke();
  circle(ctx, 0, 0, s * 0.05, shadeHex(color, -0.4));
  if (p.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.flash / 0.05) * 0.8;
    circle(ctx, kick + len + s * 0.05, 0, s * 0.12, "#a8a29e");
    ctx.restore();
  }
}

function crystal(ctx: Ctx, x: number, y: number, w: number, h: number, glow: number) {
  const grad = ctx.createLinearGradient(x - w, y - h, x + w, y + h);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, "#a5f3fc");
  grad.addColorStop(1, "#0891b2");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y - h * 0.2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w, y - h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0e7490";
  ctx.lineWidth = Math.max(1, w * 0.12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - w * 0.35, y - h * 0.2);
  ctx.lineTo(x, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow;
    circle(ctx, x, y, w * 1.6, "rgba(207,250,254,0.8)");
    ctx.restore();
  }
}

function drawFrost(ctx: Ctx, level: Level, p: TowerPose, s: number, time: number) {
  // Frosty pad
  circle(ctx, 0, 0, s * 0.2, "#ecfeff");
  circle(ctx, 0, 0, s * 0.15, "#a5f3fc");
  const bob = Math.sin(time * 2.5) * s * 0.035;
  const glow = Math.min(1, p.flash / 0.05) * 0.7;
  // Orbiting shards
  const orbit = level === 0 ? 0 : level === 1 ? 2 : 3;
  for (let i = 0; i < orbit; i++) {
    const a = time * 1.6 + (i * TAU) / orbit;
    const ox = Math.cos(a) * s * 0.25;
    const oy = Math.sin(a) * s * 0.13 - s * 0.05;
    crystal(ctx, ox, oy, s * 0.045, s * 0.08, 0);
  }
  const size = 1 + level * 0.15;
  crystal(ctx, 0, -s * 0.1 + bob, s * 0.1 * size, s * 0.2 * size, glow);
  if (level === 2) {
    ctx.strokeStyle = "rgba(253,224,71,0.9)";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.2, 0, TAU);
    ctx.stroke();
  }
}

function drawTesla(ctx: Ctx, level: Level, p: TowerPose, s: number, time: number) {
  const rings = 3 + level;
  const copper = level === 2 ? "#fbbf24" : "#d97706";
  // Pole
  ctx.fillStyle = "#44403c";
  ctx.fillRect(-s * 0.035, -s * 0.32, s * 0.07, s * 0.36);
  // Coils
  for (let i = 0; i < rings; i++) {
    const ry = s * 0.08 - i * s * (0.24 / rings);
    const rw = s * (0.19 - i * 0.022);
    ctx.fillStyle = shadeHex(copper, -0.35);
    ctx.beginPath();
    ctx.ellipse(0, ry + s * 0.02, rw, rw * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = copper;
    ctx.beginPath();
    ctx.ellipse(0, ry, rw, rw * 0.38, 0, 0, TAU);
    ctx.fill();
  }
  // Orb
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  const orbR = s * (0.1 + level * 0.015);
  const oy = -s * 0.32;
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.25 + Math.min(1, p.flash / 0.05) * 0.4;
  circle(ctx, 0, oy, orbR * 2, "#fef08a");
  ctx.restore();
  const grad = ctx.createRadialGradient(-orbR * 0.3, oy - orbR * 0.3, 0, 0, oy, orbR);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.5, "#fde047");
  grad.addColorStop(1, "#ca8a04");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, oy, orbR, 0, TAU);
  ctx.fill();
  // Idle crackle
  const rnd = mulberry32(Math.floor(time * 12));
  if (rnd() < 0.6) {
    ctx.strokeStyle = "rgba(254,249,195,0.9)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    const a = rnd() * TAU;
    let px = Math.cos(a) * orbR;
    let py = oy + Math.sin(a) * orbR;
    ctx.moveTo(px, py);
    for (let i = 0; i < 3; i++) {
      px += Math.cos(a) * s * 0.05 + (rnd() - 0.5) * s * 0.06;
      py += Math.sin(a) * s * 0.05 + (rnd() - 0.5) * s * 0.06;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

/** How far above the ground flying enemies are drawn, in cells. */
const FLY_HEIGHT = 0.3;

function bodyPath(ctx: Ctx, type: EnemyType, r: number, squash: number) {
  const rx = r * squash;
  const ry = r / squash;
  ctx.beginPath();
  switch (type) {
    case "tank":
      ctx.roundRect(-rx, -ry, rx * 2, ry * 2, r * 0.45);
      break;
    case "swarm":
      ctx.ellipse(0, 0, rx * 1.1, ry * 0.85, 0, 0, TAU);
      break;
    case "flyer":
      ctx.ellipse(0, 0, rx, ry * 0.92, 0, 0, TAU);
      break;
    case "splitter":
      ctx.roundRect(-rx * 1.12, -ry * 0.95, rx * 2.24, ry * 1.9, r * 0.8);
      break;
    case "fast":
      ctx.moveTo(-rx, ry * 0.3);
      ctx.quadraticCurveTo(-rx, -ry, 0, -ry);
      ctx.quadraticCurveTo(rx, -ry, rx, ry * 0.3);
      ctx.quadraticCurveTo(rx * 0.8, ry, 0, ry);
      ctx.quadraticCurveTo(-rx * 0.8, ry, -rx, ry * 0.3);
      break;
    default: {
      // Blob with a flat-ish bottom
      ctx.moveTo(-rx, ry * 0.35);
      ctx.bezierCurveTo(-rx * 1.05, -ry * 1.25, rx * 1.05, -ry * 1.25, rx, ry * 0.35);
      ctx.quadraticCurveTo(rx * 0.9, ry, 0, ry);
      ctx.quadraticCurveTo(-rx * 0.9, ry, -rx, ry * 0.35);
    }
  }
  ctx.closePath();
}

function eyes(
  ctx: Ctx,
  r: number,
  lookX: number,
  lookY: number,
  opts: { size?: number; angry?: boolean; y?: number; spread?: number },
) {
  const size = r * (opts.size ?? 0.27);
  const spread = r * (opts.spread ?? 0.36);
  const ey = r * (opts.y ?? -0.18);
  for (const side of [-1, 1]) {
    const ex = side * spread + lookX * r * 0.12;
    const yy = ey + lookY * r * 0.08;
    circle(ctx, ex, yy, size, "#ffffff");
    circle(ctx, ex + lookX * size * 0.35, yy + lookY * size * 0.35, size * 0.55, "#111827");
    circle(ctx, ex + lookX * size * 0.35 - size * 0.18, yy + lookY * size * 0.35 - size * 0.2, size * 0.18, "#ffffff");
    if (opts.angry) {
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex - side * size * 1.1, yy - size * 1.35);
      ctx.lineTo(ex + side * size * 0.9, yy - size * 0.85);
      ctx.stroke();
    }
  }
}

export function drawEnemySprite(
  ctx: Ctx,
  type: EnemyType,
  x: number,
  y: number,
  s: number,
  time: number,
  opts: {
    dirX?: number;
    dirY?: number;
    seed?: number;
    speed?: number;
    hitFlash?: number;
    slowed?: boolean;
  } = {},
) {
  const def = ENEMIES[type];
  const r = def.radius * s;
  const dirX = opts.dirX ?? 1;
  const dirY = opts.dirY ?? 0;
  const phase = time * (opts.speed ?? 2) * 3.2 + (opts.seed ?? 0);
  const flying = !!def.flying;
  const hop = flying ? 0 : Math.abs(Math.sin(phase)) * r * 0.22;
  const squash = flying ? 1 : 1 + Math.cos(phase * 2) * 0.07;
  // Flyers hover above the ground and bob gently.
  const lift = flying ? s * FLY_HEIGHT + Math.sin(time * 5 + (opts.seed ?? 0)) * s * 0.04 : 0;

  // Healer aura (under everything)
  if (def.healAura) {
    const pulse = (time * 0.8 + (opts.seed ?? 0)) % 1;
    ctx.save();
    ctx.strokeStyle = `rgba(94,234,212,${0.55 * (1 - pulse)})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, HEAL_AURA_RANGE * s * pulse, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  if (flying) shadow(ctx, x, y + r * 0.9, r * 0.7, r * 0.22, 0.16);
  else shadow(ctx, x, y + r * 0.85, r * 0.85 * (1 - hop / (r * 0.6)), r * 0.28);

  ctx.save();
  ctx.translate(x, y - hop - lift);

  // Speed streaks for fast enemies
  if (type === "fast") {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const ox = -dirX * r * 1.2;
      const oy = -dirY * r * 1.2 + i * r * 0.35 * Math.abs(dirX) ;
      const ox2 = ox + i * r * 0.35 * Math.abs(dirY);
      ctx.beginPath();
      ctx.moveTo(ox2, oy);
      ctx.lineTo(ox2 - dirX * r * 0.7, oy - dirY * r * 0.7);
      ctx.stroke();
    }
  }

  // Ears / horns / antennae behind the body
  if (type === "fast") {
    ctx.fillStyle = def.shade;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.25, -r * 0.7);
      ctx.lineTo(side * r * 0.75, -r * 1.25);
      ctx.lineTo(side * r * 0.7, -r * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === "tank") {
    ctx.fillStyle = "#f5f5f4";
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.45, -r * 0.8);
      ctx.quadraticCurveTo(side * r * 1.15, -r * 1.0, side * r * 0.95, -r * 1.45);
      ctx.quadraticCurveTo(side * r * 0.85, -r * 1.05, side * r * 0.2, -r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (type === "flyer") {
    const flap = Math.sin(time * 22 + (opts.seed ?? 0) * 3);
    ctx.fillStyle = "#fce7f3";
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.lineJoin = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.5, -r * 0.1);
      ctx.quadraticCurveTo(side * r * 1.4, -r * (1.3 + flap * 0.7), side * r * 2.1, -r * (0.2 + flap * 0.9));
      ctx.quadraticCurveTo(side * r * 1.5, r * (0.1 - flap * 0.2), side * r * 1.1, r * 0.45);
      ctx.quadraticCurveTo(side * r * 0.8, r * 0.2, side * r * 0.5, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (type === "swarm") {
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = "round";
    const wig = Math.sin(phase * 2) * r * 0.15;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, -r * 0.6);
      ctx.quadraticCurveTo(side * r * 0.5, -r * 1.2, side * r * 0.75 + wig, -r * 1.35);
      ctx.stroke();
      circle(ctx, side * r * 0.75 + wig, -r * 1.35, r * 0.16, def.shade);
      // legs
      for (let l = -1; l <= 1; l++) {
        const kick = Math.sin(phase * 3 + l) * r * 0.12;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.8, l * r * 0.35);
        ctx.lineTo(side * r * 1.25, l * r * 0.35 + r * 0.3 + kick);
        ctx.stroke();
      }
    }
  }

  // Body
  bodyPath(ctx, type, r, squash);
  const grad = ctx.createRadialGradient(-r * 0.4, -r * 0.5, r * 0.1, 0, 0, r * 1.2);
  grad.addColorStop(0, shadeHex(def.body, 0.5));
  grad.addColorStop(0.55, def.body);
  grad.addColorStop(1, def.shade);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = def.shade;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.stroke();
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.18, r * 0.11, -0.6, 0, TAU);
  ctx.fill();

  // Type-specific features on top of the body
  const lookX = dirX;
  const lookY = dirY;
  switch (type) {
    case "normal":
      eyes(ctx, r, lookX, lookY, {});
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(lookX * r * 0.1, r * 0.15, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case "fast":
      eyes(ctx, r, lookX, lookY, { angry: true, size: 0.25 });
      break;
    case "swarm":
      eyes(ctx, r, lookX, lookY, { size: 0.3, spread: 0.38, y: -0.1 });
      break;
    case "mini":
      eyes(ctx, r, lookX, lookY, { size: 0.3, y: -0.1 });
      break;
    case "flyer":
      eyes(ctx, r, lookX, lookY, { size: 0.26, y: -0.12 });
      // Beak
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(-r * 0.15 + lookX * r * 0.15, r * 0.2);
      ctx.lineTo(r * 0.15 + lookX * r * 0.15, r * 0.2);
      ctx.lineTo(lookX * r * 0.22, r * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    case "splitter":
      // Two blobs squashed into one: a seam down the middle, eyes wide apart.
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.setLineDash([r * 0.16, r * 0.14]);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(0, r * 0.85);
      ctx.stroke();
      ctx.setLineDash([]);
      eyes(ctx, r, lookX, lookY, { size: 0.2, spread: 0.56, y: -0.15 });
      ctx.strokeStyle = "#4d5a0c";
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.lineCap = "round";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 0.56, r * 0.2, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      break;
    case "tank":
      eyes(ctx, r, lookX, lookY, { angry: true, size: 0.22, y: -0.3 });
      // Teeth
      ctx.fillStyle = "#3b0764";
      ctx.beginPath();
      ctx.roundRect(-r * 0.4, r * 0.15, r * 0.8, r * 0.3, r * 0.1);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.36 + i * r * 0.2, r * 0.15);
        ctx.lineTo(-r * 0.26 + i * r * 0.2, r * 0.3);
        ctx.lineTo(-r * 0.16 + i * r * 0.2, r * 0.15);
        ctx.fill();
      }
      break;
    case "healer":
      eyes(ctx, r, lookX, lookY, { size: 0.24, y: -0.3 });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-r * 0.09, r * 0.02, r * 0.18, r * 0.5);
      ctx.fillRect(-r * 0.25, r * 0.18, r * 0.5, r * 0.18);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-r * 0.055, r * 0.06, r * 0.11, r * 0.42);
      ctx.fillRect(-r * 0.21, r * 0.215, r * 0.42, r * 0.11);
      break;
    case "armored": {
      eyes(ctx, r, lookX, lookY, { size: 0.2, y: -0.05, spread: 0.3 });
      // Helmet
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, r * 0.98, Math.PI, 0);
      ctx.lineTo(r * 0.98, -r * 0.2);
      ctx.lineTo(-r * 0.98, -r * 0.2);
      ctx.closePath();
      const hg = ctx.createLinearGradient(0, -r, 0, 0);
      hg.addColorStop(0, "#f1f5f9");
      hg.addColorStop(1, "#64748b");
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();
      ctx.restore();
      // Plume
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.05, r * 0.14, r * 0.3, 0, 0, TAU);
      ctx.fill();
      // Rivets
      for (const rx of [-0.6, 0, 0.6]) circle(ctx, rx * r, -r * 0.4, r * 0.07, "#334155");
      break;
    }
    case "boss": {
      eyes(ctx, r, lookX, lookY, { angry: true, size: 0.22, y: -0.2 });
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(lookX * r * 0.08, r * 0.2, r * 0.28, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-r * 0.2 + lookX * r * 0.08, r * 0.2, r * 0.12, r * 0.1);
      ctx.fillRect(r * 0.08 + lookX * r * 0.08, r * 0.2, r * 0.12, r * 0.1);
      // Crown
      const cy = -r * 0.85;
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, cy + r * 0.2);
      ctx.lineTo(-r * 0.55, cy - r * 0.3);
      ctx.lineTo(-r * 0.25, cy - r * 0.05);
      ctx.lineTo(0, cy - r * 0.45);
      ctx.lineTo(r * 0.25, cy - r * 0.05);
      ctx.lineTo(r * 0.55, cy - r * 0.3);
      ctx.lineTo(r * 0.5, cy + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      circle(ctx, 0, cy, r * 0.08, "#3b82f6");
      circle(ctx, -r * 0.3, cy + r * 0.05, r * 0.06, "#ef4444");
      circle(ctx, r * 0.3, cy + r * 0.05, r * 0.06, "#22c55e");
      break;
    }
  }

  // Frozen tint
  if (opts.slowed) {
    bodyPath(ctx, type, r, squash);
    ctx.fillStyle = "rgba(165,243,252,0.45)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const [fx, fy] of [[-0.5, 0.4], [0.55, 0.1], [0.1, 0.6]] as const) {
      ctx.save();
      ctx.translate(fx * r, fy * r);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.08, -r * 0.08, r * 0.16, r * 0.16);
      ctx.restore();
    }
  }
  // Hit flash
  if (opts.hitFlash && opts.hitFlash > 0) {
    bodyPath(ctx, type, r, squash);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, opts.hitFlash * 10)})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx: Ctx, e: Enemy, s: number, time: number) {
  const x = (e.x + 0.5) * s;
  const y = (e.y + 0.5) * s;
  drawEnemySprite(ctx, e.type, x, y, s, time, {
    dirX: e.dirX,
    dirY: e.dirY,
    seed: e.seed,
    speed: e.speed,
    hitFlash: e.hitFlash,
    slowed: e.slowUntil > time,
  });
  // Health bar
  if (e.hp < e.maxHp) {
    const r = ENEMIES[e.type].radius * s;
    const w = Math.max(s * 0.5, r * 1.8);
    const h = Math.max(3, s * 0.08);
    const bx = x - w / 2;
    const by =
      y -
      r * 1.25 -
      h -
      (e.type === "boss" || e.type === "armored" || e.type === "tank" ? r * 0.35 : 0) -
      (e.flying ? s * FLY_HEIGHT + r * 0.6 : 0);
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(17,24,39,0.75)";
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, w + 2, h + 2, h);
    ctx.fill();
    ctx.fillStyle = pct > 0.6 ? "#22c55e" : pct > 0.3 ? "#eab308" : "#ef4444";
    ctx.beginPath();
    ctx.roundRect(bx, by, w * pct, h, h);
    ctx.fill();
    if (e.armor > 0) {
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(bx - h, by + h / 2, h * 0.9, 0, TAU);
      ctx.fill();
    }
  }
}

// ─── Projectiles, bolts & particles ───────────────────────────────────────────

function drawProjectile(ctx: Ctx, p: Projectile, s: number, time: number) {
  const x = (p.x + 0.5) * s;
  const y = (p.y + 0.5) * s;
  if (p.kind === "bomb") {
    shadow(ctx, x, y, s * 0.12 * (1 - p.height * 0.25), s * 0.05, 0.25);
    const by = y - p.height * s;
    const r = s * (0.11 + p.level * 0.015);
    circle(ctx, x, by, r, "#1f2937");
    circle(ctx, x - r * 0.35, by - r * 0.35, r * 0.3, "rgba(255,255,255,0.45)");
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, by - r * 0.6);
    ctx.lineTo(x + r * 0.8, by - r * 1.1);
    ctx.stroke();
    const flick = 0.6 + 0.4 * Math.sin(time * 40);
    circle(ctx, x + r * 0.8, by - r * 1.1, r * 0.35 * flick, "#fde047");
    return;
  }

  const color = p.kind === "frost" ? "#67e8f9" : "#60a5fa";
  // Trail
  if (p.trail.length > 1) {
    ctx.lineCap = "round";
    for (let i = 1; i < p.trail.length; i++) {
      const a = p.trail[i - 1];
      const b = p.trail[i];
      ctx.strokeStyle = color;
      ctx.globalAlpha = (i / p.trail.length) * 0.6;
      ctx.lineWidth = s * 0.08 * (i / p.trail.length);
      ctx.beginPath();
      ctx.moveTo((a.x + 0.5) * s, (a.y + 0.5) * s);
      ctx.lineTo((b.x + 0.5) * s, (b.y + 0.5) * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (p.kind === "frost") {
    const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = "#cffafe";
    ctx.strokeStyle = "#0891b2";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(s * 0.16, 0);
    ctx.lineTo(0, -s * 0.06);
    ctx.lineTo(-s * 0.1, 0);
    ctx.lineTo(0, s * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    const r = s * (0.08 + p.level * 0.015);
    ctx.save();
    ctx.globalAlpha = 0.45;
    circle(ctx, x, y, r * 1.9, color);
    ctx.restore();
    circle(ctx, x, y, r, "#dbeafe");
    circle(ctx, x, y, r * 0.55, "#ffffff");
  }
}

function jagged(pts: { x: number; y: number }[], s: number, rnd: () => number) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segs = Math.max(3, Math.round(len * 5));
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      const off = k === 0 ? 0 : (rnd() - 0.5) * 0.28;
      out.push({ x: (a.x + dx * t + nx * off + 0.5) * s, y: (a.y + dy * t + ny * off + 0.5) * s });
    }
  }
  const last = pts[pts.length - 1];
  out.push({ x: (last.x + 0.5) * s, y: (last.y + 0.5) * s });
  return out;
}

function drawBolt(ctx: Ctx, b: Bolt, s: number, time: number) {
  const a = Math.max(0, b.life / b.maxLife);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (b.kind === "sniper") {
    const [p0, p1] = b.pts;
    const x0 = (p0.x + 0.5) * s;
    const y0 = (p0.y + 0.5) * s;
    const x1 = (p1.x + 0.5) * s;
    const y1 = (p1.y + 0.5) * s;
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = b.level === 2 ? "#f0abfc" : "#a78bfa";
    ctx.lineWidth = s * (0.16 + b.level * 0.03) * a;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, s * 0.045 * a);
    ctx.stroke();
  } else {
    const rnd = mulberry32(Math.floor(time * 60) + b.pts.length * 7);
    const pts = jagged(b.pts, s, rnd);
    const trace = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    };
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = s * 0.13;
    trace();
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#fefce8";
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    trace();
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticle(ctx: Ctx, p: Particle, s: number) {
  const a = Math.max(0, p.life / p.maxLife);
  const x = (p.x + 0.5) * s;
  const y = (p.y + 0.5) * s;
  ctx.globalAlpha = a;
  switch (p.kind) {
    case "spark": {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * s * 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - p.vx * s * 0.04, y - p.vy * s * 0.04);
      ctx.stroke();
      break;
    }
    case "smoke":
      ctx.globalAlpha = a * 0.5;
      circle(ctx, x, y, p.size * s * (1.6 - a), p.color);
      break;
    case "blob":
      circle(ctx, x, y, p.size * s * (0.4 + a * 0.6), p.color);
      break;
    case "shard":
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.life * 10);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * s * 0.5, -p.size * s * 0.5, p.size * s, p.size * s);
      ctx.restore();
      break;
    case "ring": {
      const t = 1 - a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, s * 0.08 * a);
      ctx.beginPath();
      ctx.arc(x, y, p.size * s * (0.3 + 0.7 * Math.sqrt(t)), 0, TAU);
      ctx.stroke();
      break;
    }
    case "text": {
      const fs = Math.max(11, p.size * s);
      ctx.font = `900 ${fs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, fs * 0.22);
      ctx.strokeStyle = "rgba(17,24,39,0.85)";
      ctx.strokeText(p.text ?? "", x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text ?? "", x, y);
      break;
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

/** The area a tower can hit: a circle, minus anything hidden behind rocks. */
export function drawCoverage(ctx: Ctx, pts: { x: number; y: number }[], s: number, ok = true) {
  if (!pts.length) return;
  ctx.save();
  ctx.fillStyle = ok ? "rgba(255,255,255,0.16)" : "rgba(239,68,68,0.16)";
  ctx.strokeStyle = ok ? "rgba(255,255,255,0.85)" : "rgba(239,68,68,0.85)";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.lineJoin = "round";
  ctx.setLineDash([s * 0.18, s * 0.12]);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const px = (p.x + 0.5) * s;
    const py = (p.y + 0.5) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHillBadge(ctx: Ctx, x: number, y: number, s: number) {
  circle(ctx, x, y, s * 0.13, "#14532d");
  circle(ctx, x, y, s * 0.105, "#4ade80");
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.05, y + s * 0.025);
  ctx.lineTo(x, y - s * 0.035);
  ctx.lineTo(x + s * 0.05, y + s * 0.025);
  ctx.stroke();
}

function drawRubbleTags(ctx: Ctx, g: Game, s: number) {
  if (s < 24) return;
  const fs = Math.max(9, s * 0.24);
  ctx.save();
  ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = String(g.map.rubbleCost);
  const w = ctx.measureText(label).width + fs * 1.5;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.terrain[r][c] !== "rubble") continue;
      const cx = (c + 0.5) * s;
      const cy = (r + 0.9) * s;
      ctx.fillStyle = "rgba(17,24,39,0.82)";
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - fs * 0.7, w, fs * 1.4, fs * 0.7);
      ctx.fill();
      circle(ctx, cx - w / 2 + fs * 0.65, cy, fs * 0.36, "#f59e0b");
      ctx.fillStyle = "#fde68a";
      ctx.fillText(label, cx + fs * 0.35, cy + fs * 0.05);
    }
  }
  ctx.restore();
}

function drawBanner(ctx: Ctx, g: Game, s: number) {
  const b = g.banner;
  if (!b) return;
  const t = 1 - b.life / b.maxLife;
  const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.4 : 1;
  const alpha = b.life < 0.4 ? b.life / 0.4 : 1;
  const cx = (COLS * s) / 2;
  const cy = ROWS * s * 0.3;
  const maxW = COLS * s * 0.94;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.max(26, s * 1.1);
  ctx.font = `900 ${fs}px Inter, system-ui, sans-serif`;
  ctx.lineWidth = fs * 0.16;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1e1b4b";
  ctx.strokeText(b.text, 0, 0);
  const grad = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
  grad.addColorStop(0, "#fef08a");
  grad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = grad;
  ctx.fillText(b.text, 0, 0);
  if (b.sub) {
    // Shrink long lines (enemy introductions) so they always fit the board.
    let sfs = Math.max(14, s * 0.42);
    ctx.font = `800 ${sfs}px Inter, system-ui, sans-serif`;
    const wide = ctx.measureText(b.sub).width;
    if (wide > maxW) {
      sfs *= maxW / wide;
      ctx.font = `800 ${sfs}px Inter, system-ui, sans-serif`;
    }
    ctx.lineWidth = sfs * 0.25;
    ctx.strokeText(b.sub, 0, fs * 0.75);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(b.sub, 0, fs * 0.75);
  }
  ctx.restore();
}

// ─── Frame renderer ───────────────────────────────────────────────────────────

export interface RenderOpts {
  s: number;
  board: HTMLCanvasElement;
  showGrid: boolean;
  hover: Cell | null;
  ghost: { type: TowerType; ok: boolean } | null;
  selected: Tower | null;
  /** A rubble pile the player has tapped. */
  selectedCell: Cell | null;
}

export function renderFrame(ctx: Ctx, g: Game, o: RenderOpts) {
  const { s } = o;
  const time = g.time;
  const now = performance.now() / 1000;
  ctx.save();
  if (g.shake > 0) {
    const m = g.shake * s * 0.35;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  ctx.drawImage(o.board, 0, 0, COLS * s, ROWS * s);
  drawWaterShimmer(ctx, g, s, now);
  if (o.showGrid) drawGridOverlay(ctx, g, s);
  g.entries.forEach((entry, i) => drawPortal(ctx, s, now, entry, g.routes[i]?.open ?? true));

  // Selection highlight & reach (under towers)
  if (o.selected) {
    const t = o.selected;
    drawCoverage(ctx, coverageOutline(g, t.c, t.r, towerRange(t), TOWERS[t.type].needsSight), s);
  }
  if (o.hover && o.ghost) {
    const { r, c } = o.hover;
    const range = rangeAt(g, o.ghost.type, 0, r, c);
    drawCoverage(ctx, coverageOutline(g, c, r, range, TOWERS[o.ghost.type].needsSight), s, o.ghost.ok);
  }

  drawRubbleTags(ctx, g, s);
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150);
  if (o.selectedCell) {
    const { r, c } = o.selectedCell;
    ctx.save();
    ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath();
    ctx.roundRect(c * s + s * 0.04, r * s + s * 0.04, s * 0.92, s * 0.92, s * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  for (const t of g.towers) {
    const x = (t.c + 0.5) * s;
    const y = (t.r + 0.5) * s;
    drawTower(ctx, t.type, t.level, t, x, y, s, time + t.id);
    if (t.onHill) drawHillBadge(ctx, x + s * 0.32, y - s * 0.32, s);
  }
  if (o.selected) {
    const t = o.selected;
    ctx.save();
    ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath();
    ctx.roundRect(t.c * s + s * 0.04, t.r * s + s * 0.04, s * 0.92, s * 0.92, s * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  // Walkers back to front, then everything in the air on top.
  const enemies = [...g.enemies].sort((a, b) => Number(a.flying) - Number(b.flying) || a.y - b.y);
  for (const e of enemies) if (!e.flying) drawEnemy(ctx, e, s, time);

  for (const exit of g.exits) drawCastle(ctx, s, now, g.lives, g.maxLives, exit);
  for (const e of enemies) if (e.flying) drawEnemy(ctx, e, s, time);

  for (const p of g.projectiles) drawProjectile(ctx, p, s, time);
  for (const b of g.bolts) drawBolt(ctx, b, s, time);
  for (const p of g.particles) drawParticle(ctx, p, s);

  // Placement ghost
  if (o.hover && o.ghost) {
    const x = (o.hover.c + 0.5) * s;
    const y = (o.hover.r + 0.5) * s;
    ctx.save();
    ctx.globalAlpha = 0.65;
    drawTower(ctx, o.ghost.type, 0, { angle: -Math.PI / 2, recoil: 0, flash: 0 }, x, y, s, time);
    ctx.restore();
    if (!o.ghost.ok) {
      ctx.save();
      ctx.fillStyle = "rgba(239,68,68,0.35)";
      ctx.fillRect(o.hover.c * s, o.hover.r * s, s, s);
      ctx.strokeStyle = "#b91c1c";
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.lineCap = "round";
      const m = s * 0.25;
      ctx.beginPath();
      ctx.moveTo(o.hover.c * s + m, o.hover.r * s + m);
      ctx.lineTo(o.hover.c * s + s - m, o.hover.r * s + s - m);
      ctx.moveTo(o.hover.c * s + s - m, o.hover.r * s + m);
      ctx.lineTo(o.hover.c * s + m, o.hover.r * s + s - m);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBanner(ctx, g, s);
  ctx.restore();
}
