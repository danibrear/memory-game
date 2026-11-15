// ─── Tower Defense: canvas sprites & renderer ─────────────────────────────────
//
// All art is drawn procedurally with the Canvas 2D API so it scales crisply to
// any cell size / device pixel ratio. Coordinates passed to the draw helpers
// are in pixels; `s` is the size of one grid cell in pixels.

import {
  ABILITIES,
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
import { coverageOutline, createGame, isGate, needsSight, rangeAt, towerRange, towerStats } from "./engine";
import type { Bolt, Enemy, Game, Level, Particle, Projectile, Tower } from "./engine";

import {
  INK,
  TAU,
  blinking,
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
import { drawTower, type TowerPose } from "./towers";

export { drawTower, type TowerPose };

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
  shore: {
    groundA: "#f2dfa8",
    groundB: "#ecd69a",
    vignette: "rgba(120,90,20,0.16)",
    tuft: "rgba(120,150,70,0.6)",
    flowers: ["#ffffff", "#fda4af"],
    pathEdge: "#c9a35e",
    path: "#fbeecb",
    pathLight: "rgba(255,250,230,0.6)",
    pathPebble: "rgba(160,120,60,0.4)",
    water: "#2bb5d6",
    waterDeep: "#1588b0",
    foam: "rgba(255,255,255,0.9)",
    rockTop: "#cdd2d8",
    rockMid: "#8f98a3",
    rockDark: "#525b66",
    rockCap: null,
    hillTop: "#fff3cf",
    hillSide: "#c79a52",
    cobble: "#b9a58a",
    cobbleStone: "#e2d3bb",
  },
  ash: {
    groundA: "#655c57",
    groundB: "#5d5450",
    vignette: "rgba(20,8,6,0.32)",
    tuft: "rgba(35,28,25,0.6)",
    flowers: null,
    pathEdge: "#8a6a45",
    path: "#dcc09a",
    pathLight: "rgba(246,230,204,0.55)",
    pathPebble: "rgba(110,80,50,0.45)",
    water: "#f97316",
    waterDeep: "#c2410c",
    foam: "rgba(254,215,170,0.9)",
    rockTop: "#a17a68",
    rockMid: "#6b473b",
    rockDark: "#2b1a16",
    rockCap: null,
    hillTop: "#c4b2a5",
    hillSide: "#4a3a33",
    cobble: "#7a6a60",
    cobbleStone: "#b3a296",
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
  const breathe = open ? 1 + Math.sin(time * 3) * 0.03 : 1;
  ctx.save();
  // Stone ring
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = "#78716c";
  ctx.fill();
  ink(ctx, s, 1);
  // Chunky stones around the ring
  ctx.strokeStyle = "rgba(35,42,61,0.45)";
  ctx.lineWidth = Math.max(1, s * 0.025);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * rx * 0.8, y + Math.sin(a) * ry * 0.84);
    ctx.lineTo(x + Math.cos(a) * rx * 0.98, y + Math.sin(a) * ry * 0.98);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.9, ry * 0.92, 0, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
  // The swirl: flat rings of colour, no gradient
  const rings = open ? ["#3b0764", "#7e22ce", "#a855f7", "#e9d5ff"] : ["#1f2937", "#374151", "#4b5563"];
  rings.forEach((color, i) => {
    const k = (1 - i * 0.26) * (i === 0 ? 1 : breathe);
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.78 * k, ry * 0.84 * k, 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    if (i === 0) ink(ctx, s, 0.8);
  });
  if (open) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a0 = time * 2.5 + (i * TAU) / 3;
      const k = 0.3 + i * 0.18;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * k, ry * k, 0, a0, a0 + 1.6);
      ctx.stroke();
    }
    // Sparkles drifting up out of it
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.6 + i / 3) % 1;
      const a = i * 2.4 + Math.floor(time * 0.6 + i / 3) * 1.3;
      ctx.globalAlpha = Math.sin(t * Math.PI);
      starPath(ctx, x + Math.cos(a) * rx * 0.75, y - ry * (0.2 + t * 0.95), s * (0.05 + 0.03 * Math.sin(t * Math.PI)), time * 2 + i);
      ctx.fillStyle = "#f5d0fe";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

export function drawCastle(
  ctx: Ctx,
  s: number,
  time: number,
  lives: number,
  maxLives: number,
  exit: Cell,
  /** Seconds since an enemy last got in (for the flinch). */
  sinceHit = 99,
) {
  const cx = (exit.c + 0.5) * s;
  const base = (exit.r + 0.5) * s + s * 0.42;
  const w = s * 0.94;
  const h = s * 0.8;
  const frac = maxLives > 0 ? lives / maxLives : 1;
  const hit = sinceHit < 0.45;
  const mood: Mood = hit ? "hurt" : frac <= 0.35 ? "worried" : "happy";
  // Flinch when something gets in, otherwise breathe very gently.
  const flinch = hit ? Math.sin((sinceHit / 0.45) * Math.PI) : 0;
  const sx = 1 + flinch * 0.1 + Math.sin(time * 2) * 0.008;
  const sy = 1 - flinch * 0.12 - Math.sin(time * 2) * 0.008;

  shadow(ctx, cx, base, w * 0.62, s * 0.12);
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(sx, sy);
  if (hit) ctx.translate(Math.sin(sinceHit * 70) * s * 0.02, 0);

  const stone = frac <= 0.35 ? "#c4c8d0" : "#dfe3ea";
  const towerW = w * 0.32;
  const roof = frac <= 0.35 ? "#3b5fb8" : "#3b82f6";

  const sideTower = (side: number) => {
    const x = side * (w / 2 - towerW * 0.42) - towerW / 2;
    const top = -h - s * 0.1;
    // Crenellated block
    cel(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(x, top, towerW, h + s * 0.1, [s * 0.03, s * 0.03, s * 0.04, s * 0.04]);
      },
      shadeHex(stone, -0.12),
      s,
      { cx: x + towerW / 2, cy: top + h / 2, w: towerW, h: h, outline: 0.9, shine: false },
    );
    // Roof
    cel(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.05, top + s * 0.02);
        ctx.quadraticCurveTo(x + towerW / 2, top - s * 0.12, x + towerW / 2, top - s * 0.34);
        ctx.quadraticCurveTo(x + towerW / 2, top - s * 0.12, x + towerW + s * 0.05, top + s * 0.02);
        ctx.closePath();
      },
      roof,
      s,
      { cx: x + towerW / 2, cy: top - s * 0.14, w: towerW * 0.9, h: s * 0.3, outline: 0.9, shine: false },
    );
    // Arrow slit
    ctx.beginPath();
    ctx.roundRect(x + towerW / 2 - s * 0.025, top + h * 0.3, s * 0.05, s * 0.15, s * 0.025);
    ctx.fillStyle = INK;
    ctx.fill();
  };

  // Keep: the wall with battlements
  cel(
    ctx,
    () => {
      const l = -w * 0.34;
      const r = w * 0.34;
      const top = -h * 0.86;
      const notch = s * 0.07;
      const step = (r - l) / 5;
      ctx.beginPath();
      ctx.moveTo(l, 0);
      ctx.lineTo(l, top);
      for (let i = 0; i < 5; i++) {
        const x0 = l + i * step;
        if (i % 2 === 0) {
          ctx.lineTo(x0, top - notch);
          ctx.lineTo(x0 + step, top - notch);
          ctx.lineTo(x0 + step, top);
        } else {
          ctx.lineTo(x0 + step, top);
        }
      }
      ctx.lineTo(r, 0);
      ctx.closePath();
    },
    stone,
    s,
    { cx: 0, cy: -h * 0.45, w: w * 0.6, h: h * 0.9, outline: 0.9, shine: false },
  );
  sideTower(-1);
  sideTower(1);

  // A few bricks
  ctx.strokeStyle = "rgba(35,42,61,0.22)";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [bx, by] of [
    [-0.2, -0.74],
    [0.12, -0.7],
    [-0.24, -0.16],
    [0.2, -0.2],
  ]) {
    ctx.moveTo(bx * w, by * h);
    ctx.lineTo((bx + 0.09) * w, by * h);
  }
  ctx.stroke();

  // Face: the gate is its mouth
  const doorW = w * 0.15;
  const doorH = h * (hit ? 0.3 : mood === "worried" ? 0.22 : 0.26);
  ctx.beginPath();
  ctx.moveTo(-doorW, 0);
  ctx.lineTo(-doorW, -doorH);
  ctx.arc(0, -doorH, doorW, Math.PI, 0);
  ctx.lineTo(doorW, 0);
  ctx.closePath();
  ctx.fillStyle = "#7c2d12";
  ctx.fill();
  ink(ctx, s, 0.85);
  // Portcullis teeth
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath();
  for (const k of [-0.5, 0, 0.5]) {
    ctx.moveTo(k * doorW, -doorH - doorW * (k === 0 ? 0.95 : 0.8));
    ctx.lineTo(k * doorW, -doorH * 0.45);
  }
  ctx.stroke();
  cheeks(ctx, 0, -h * 0.42, w * 0.25, s * 0.045);
  drawEyes(ctx, {
    x: 0,
    y: -h * 0.58,
    r: s * 0.095,
    spread: w * 0.135,
    lookX: Math.sin(time * 0.7) * 0.5,
    lookY: 0.1,
    mood,
    blink: blinking(time, exit.c + exit.r),
    time,
  });
  if (mood === "worried") {
    // Cracks once things look bad
    ctx.strokeStyle = "rgba(35,42,61,0.55)";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.2, -h * 0.84);
    ctx.lineTo(w * 0.15, -h * 0.72);
    ctx.lineTo(w * 0.22, -h * 0.64);
    ctx.moveTo(-w * 0.27, -h * 0.4);
    ctx.lineTo(-w * 0.22, -h * 0.3);
    ctx.stroke();
  }

  // Flag
  const fy = -h * 0.86 - s * 0.07;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.25, s * 0.035);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(0, fy - s * 0.4);
  ctx.stroke();
  const wave = Math.sin(time * 5) * s * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, fy - s * 0.4);
  ctx.quadraticCurveTo(s * 0.14, fy - s * 0.36 + wave, s * 0.3, fy - s * 0.31 - wave * 0.5);
  ctx.quadraticCurveTo(s * 0.14, fy - s * 0.24 - wave, 0, fy - s * 0.2);
  ctx.closePath();
  ctx.fillStyle = frac > 0.35 ? "#ef4444" : "#991b1b";
  ctx.fill();
  ink(ctx, s, 0.75);
  ctx.restore();
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
      return;
    case "swarm":
      ctx.ellipse(0, 0, rx * 1.1, ry * 0.85, 0, 0, TAU);
      return;
    case "flyer":
      ctx.ellipse(0, 0, rx, ry * 0.92, 0, 0, TAU);
      return;
    case "shade": {
      // Ghost: domed head, ragged hem
      ctx.moveTo(-rx, ry);
      ctx.bezierCurveTo(-rx * 1.1, -ry * 1.5, rx * 1.1, -ry * 1.5, rx, ry);
      ctx.quadraticCurveTo(rx * 0.75, ry * 0.55, rx * 0.5, ry);
      ctx.quadraticCurveTo(rx * 0.25, ry * 1.35, 0, ry);
      ctx.quadraticCurveTo(-rx * 0.25, ry * 0.55, -rx * 0.5, ry);
      ctx.quadraticCurveTo(-rx * 0.75, ry * 1.35, -rx, ry);
      break;
    }
    case "jammer":
      ctx.roundRect(-rx * 0.95, -ry * 0.85, rx * 1.9, ry * 1.8, r * 0.32);
      return;
    case "splitter":
      ctx.roundRect(-rx * 1.12, -ry * 0.95, rx * 2.24, ry * 1.9, r * 0.8);
      return;
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

/** How the enemy being drawn right now is feeling (set by drawEnemySprite). */
const FACE = { hurt: false, scared: false, frozen: false, blink: false, time: 0 };

function eyes(
  ctx: Ctx,
  r: number,
  lookX: number,
  lookY: number,
  opts: { size?: number; angry?: boolean; y?: number; spread?: number },
) {
  const mood: Mood = FACE.hurt ? "hurt" : FACE.scared ? "worried" : opts.angry ? "angry" : "calm";
  drawEyes(ctx, {
    x: lookX * r * 0.1,
    y: r * (opts.y ?? -0.18) + lookY * r * 0.06,
    r: r * (opts.size ?? 0.27) * 1.08,
    spread: r * (opts.spread ?? 0.36),
    lookX,
    lookY,
    mood,
    // Frozen solid: eyes stuck wide open.
    blink: FACE.blink && !FACE.frozen,
    time: FACE.time,
  });
}

/** Sizes are drawn a little larger than the hit radius so faces stay readable. */
const ENEMY_SCALE = 1.12;

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
    /** A Shade nothing is lighting up: drawn as a faint outline. */
    hidden?: boolean;
    burning?: boolean;
    frozen?: boolean;
    /** 0..1, how worked up a Rager is. */
    rage?: number;
    /** Health left, 0..1. Nearly beaten enemies look worried. */
    hpFrac?: number;
    /** Seconds since it came out of the portal (for the pop-in). */
    age?: number;
  } = {},
) {
  const def = ENEMIES[type];
  const r = def.radius * s * ENEMY_SCALE;
  FACE.hurt = (opts.hitFlash ?? 0) > 0.045;
  FACE.scared = (opts.hpFrac ?? 1) < 0.35 && type !== "boss" && type !== "emperor" && type !== "charger";
  FACE.frozen = !!opts.frozen;
  FACE.blink = blinking(time, opts.seed ?? 0);
  FACE.time = time;
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
  if (opts.hidden) ctx.globalAlpha = 0.3;
  ctx.translate(x, y - hop - lift);
  if (opts.age !== undefined && opts.age < 0.3) {
    const pop = easeOutBack(opts.age / 0.3);
    ctx.scale(pop, pop);
  }

  // A Rager's temper shows as a growing red glow.
  if (opts.rage && opts.rage > 0.05) {
    const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * (1.5 + opts.rage));
    glow.addColorStop(0, `rgba(248,113,113,${0.55 * opts.rage})`);
    glow.addColorStop(1, "rgba(248,113,113,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.5 + opts.rage), 0, TAU);
    ctx.fill();
  }

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
  } else if (type === "charger") {
    // Flame mohawk and forward horns
    const flick = Math.sin(time * 18 + (opts.seed ?? 0));
    for (const [fx, fh, col] of [[-0.3, 1.5, "#f97316"], [0.05, 1.85, "#fb923c"], [0.4, 1.45, "#f97316"], [0.05, 1.45, "#fde047"]] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo((fx - 0.22) * r, -r * 0.6);
      ctx.quadraticCurveTo((fx - 0.1 + flick * 0.08) * r, -r * fh * 0.8, (fx + flick * 0.12) * r, -r * fh);
      ctx.quadraticCurveTo((fx + 0.16) * r, -r * fh * 0.75, (fx + 0.22) * r, -r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#fef3c7";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.55, -r * 0.55);
      ctx.quadraticCurveTo(side * r * 1.25, -r * 0.75, side * r * 1.2, -r * 1.15);
      ctx.quadraticCurveTo(side * r * 0.95, -r * 0.75, side * r * 0.35, -r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (type === "jammer") {
    // Antenna with a blinking tip
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(0, -r * 1.5);
    ctx.stroke();
    const blink = 0.5 + 0.5 * Math.sin(time * 9 + (opts.seed ?? 0));
    ctx.save();
    ctx.globalAlpha *= 0.35 + 0.4 * blink;
    circle(ctx, 0, -r * 1.55, r * 0.34, "#fde047");
    ctx.restore();
    circle(ctx, 0, -r * 1.55, r * 0.17, "#facc15");
  } else if (type === "emperor") {
    // A ruff of dark spikes
    ctx.fillStyle = def.shade;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + ((i + 0.5) / 7) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * r * 0.9, Math.sin(a - 0.2) * r * 0.9);
      ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4);
      ctx.lineTo(Math.cos(a + 0.2) * r * 0.9, Math.sin(a + 0.2) * r * 0.9);
      ctx.closePath();
      ctx.fill();
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

  // Little feet that take turns (ghosts, bugs and flyers go without)
  if (!flying && type !== "shade" && type !== "swarm") {
    for (const side of [-1, 1]) {
      const step = Math.max(0, Math.sin(phase + (side > 0 ? Math.PI : 0)));
      ctx.beginPath();
      ctx.ellipse(side * r * 0.42, r * (0.92 - step * 0.22) / squash, r * 0.3, r * 0.17, 0, 0, TAU);
      ctx.fillStyle = def.shade;
      ctx.fill();
      ink(ctx, s, 0.75);
    }
  }

  // Body: flat colour, one shadow, one highlight, ink outline
  cel(ctx, () => bodyPath(ctx, type, r, squash), def.body, s, { w: r * 2.3, h: r * 2.3, outline: 0.95 });

  // Type-specific features on top of the body
  const lookX = dirX;
  const lookY = dirY;
  switch (type) {
    case "normal":
      cheeks(ctx, lookX * r * 0.1, r * 0.2, r * 0.62, r * 0.15);
      eyes(ctx, r, lookX, lookY, {});
      drawMouth(ctx, lookX * r * 0.12, r * 0.38, r * 0.42, FACE.hurt ? "o" : FACE.scared ? "frown" : "grin");
      break;
    case "fast":
      eyes(ctx, r, lookX, lookY, { angry: true, size: 0.25 });
      drawMouth(ctx, lookX * r * 0.12, r * 0.4, r * 0.36, FACE.hurt ? "o" : "grit");
      break;
    case "swarm":
      eyes(ctx, r, lookX, lookY, { size: 0.3, spread: 0.38, y: -0.1 });
      drawMouth(ctx, lookX * r * 0.1, r * 0.42, r * 0.3, FACE.hurt ? "o" : "smile");
      break;
    case "mini":
      cheeks(ctx, lookX * r * 0.1, r * 0.25, r * 0.62, r * 0.15);
      eyes(ctx, r, lookX, lookY, { size: 0.3, y: -0.1 });
      drawMouth(ctx, lookX * r * 0.1, r * 0.42, r * 0.34, FACE.hurt || FACE.scared ? "o" : "grin");
      break;
    case "shade":
      // Blank glowing eyes and a small round mouth
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(side * r * 0.34 + lookX * r * 0.1, -r * 0.25 + lookY * r * 0.06, r * 0.17, r * 0.24, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = def.shade;
      ctx.beginPath();
      ctx.ellipse(lookX * r * 0.1, r * 0.25, r * 0.13, r * 0.17, 0, 0, TAU);
      ctx.fill();
      break;
    case "charger":
      eyes(ctx, r, lookX, lookY, { angry: true, size: 0.24, y: -0.15 });
      // Gritted teeth
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#450a0a";
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath();
      ctx.roundRect(-r * 0.38 + lookX * r * 0.08, r * 0.2, r * 0.76, r * 0.26, r * 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      for (const tx of [-0.19, 0, 0.19]) {
        ctx.moveTo(tx * r + lookX * r * 0.08, r * 0.2);
        ctx.lineTo(tx * r + lookX * r * 0.08, r * 0.46);
      }
      ctx.stroke();
      break;
    case "jammer": {
      // Dark visor with two lit eyes and a lightning bolt on the chest
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(-r * 0.7, -r * 0.5, r * 1.4, r * 0.5, r * 0.2);
      ctx.fill();
      const lit = 0.6 + 0.4 * Math.sin(time * 9 + (opts.seed ?? 0));
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.globalAlpha *= lit;
        circle(ctx, side * r * 0.3 + lookX * r * 0.1, -r * 0.25, r * 0.13, "#fde047");
        ctx.restore();
      }
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.moveTo(r * 0.12, r * 0.1);
      ctx.lineTo(-r * 0.2, r * 0.45);
      ctx.lineTo(-r * 0.02, r * 0.45);
      ctx.lineTo(-r * 0.14, r * 0.78);
      ctx.lineTo(r * 0.22, r * 0.36);
      ctx.lineTo(r * 0.03, r * 0.36);
      ctx.closePath();
      ctx.fill();
      break;
    }
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
      cheeks(ctx, lookX * r * 0.1, -r * 0.05, r * 0.66, r * 0.13);
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
    case "boss":
    case "emperor": {
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

  // Nearly beaten: a bead of sweat
  if (FACE.scared && !opts.frozen) {
    const fall = (time * 1.4 + (opts.seed ?? 0)) % 1;
    ctx.save();
    ctx.globalAlpha *= 1 - fall * 0.6;
    ctx.translate(r * 0.85, -r * 0.75 + fall * r * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.26);
    ctx.quadraticCurveTo(r * 0.2, r * 0.05, 0, r * 0.14);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.05, 0, -r * 0.26);
    ctx.fillStyle = "#7dd3fc";
    ctx.fill();
    ink(ctx, s, 0.5);
    ctx.restore();
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
  // On fire
  if (opts.burning) {
    for (let i = 0; i < 3; i++) {
      const ph = time * 9 + i * 2.1 + (opts.seed ?? 0);
      const fx = (i - 1) * r * 0.5 + Math.sin(ph) * r * 0.1;
      const fh = r * (0.55 + 0.25 * Math.sin(ph * 1.7));
      ctx.fillStyle = i === 1 ? "#fde047" : "#fb923c";
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.2, -r * 0.55);
      ctx.quadraticCurveTo(fx - r * 0.05, -r * 0.55 - fh * 0.6, fx, -r * 0.55 - fh);
      ctx.quadraticCurveTo(fx + r * 0.22, -r * 0.55 - fh * 0.5, fx + r * 0.2, -r * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Frozen solid: a block of ice around it
  if (opts.frozen) {
    ctx.fillStyle = "rgba(186,230,253,0.55)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.roundRect(-r * 1.15, -r * 1.2, r * 2.3, r * 2.35, r * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.7);
    ctx.lineTo(-r * 0.3, -r * 0.95);
    ctx.moveTo(r * 0.4, r * 0.8);
    ctx.lineTo(r * 0.85, r * 0.45);
    ctx.stroke();
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
  const def = ENEMIES[e.type];
  const x = (e.x + 0.5) * s;
  const y = (e.y + 0.5) * s;
  drawEnemySprite(ctx, e.type, x, y, s, time, {
    dirX: e.dirX,
    dirY: e.dirY,
    seed: e.seed,
    speed: e.speed,
    hitFlash: e.hitFlash,
    slowed: e.slowUntil > time,
    hidden: !!def.stealth && !e.revealed,
    burning: e.burnUntil > time,
    frozen: e.stunUntil > time,
    rage: def.enrage ? 1 - Math.max(0, e.hp) / e.maxHp : 0,
    hpFrac: Math.max(0, e.hp) / e.maxHp,
    age: time - e.born,
  });
  // Health bar
  if (e.hp < e.maxHp && !(def.stealth && !e.revealed)) {
    const r = ENEMIES[e.type].radius * s * ENEMY_SCALE;
    const w = Math.max(s * 0.5, r * 1.8);
    const h = Math.max(3, s * 0.08);
    const bx = x - w / 2;
    const by =
      y -
      r * 1.25 -
      h -
      (e.type === "boss" || e.type === "emperor" || e.type === "armored" || e.type === "tank" || e.type === "charger" ? r * 0.35 : 0) -
      (e.type === "jammer" ? r * 0.7 : 0) -
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
    case "coin": {
      // A little gold coin, spinning as it arcs up and drops
      const rad = Math.max(2.5, p.size * s);
      ctx.globalAlpha = Math.min(1, a * 3);
      ctx.beginPath();
      ctx.ellipse(x, y, rad * (0.35 + 0.65 * Math.abs(Math.cos(p.life * 14 + p.vx))), rad, 0, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.stroke();
      break;
    }
    case "star":
      starPath(ctx, x, y, p.size * s * (0.5 + a * 0.7), p.life * 6);
      ctx.fillStyle = p.color;
      ctx.fill();
      break;
    case "puff":
      // Cartoon dust cloud: grows as it fades
      ctx.globalAlpha = a * 0.75;
      circle(ctx, x, y, p.size * s * (0.35 + (1 - a) * 0.55), p.color);
      break;
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

/** Tiles a flood or rockslide is going to change, with the wave it happens on. */
function drawEventMarkers(ctx: Ctx, g: Game, s: number, now: number) {
  g.events.forEach((ev, i) => {
    const next = i === 0;
    const flood = ev.kind === "flood";
    const pulse = next ? 0.75 + 0.25 * Math.sin(now * 3) : 0.5;
    ctx.save();
    ctx.fillStyle = flood ? `rgba(14,116,144,${0.2 * pulse})` : `rgba(234,88,12,${0.28 * pulse})`;
    ctx.strokeStyle = flood ? `rgba(224,242,254,${0.75 * pulse})` : `rgba(254,215,170,${0.9 * pulse})`;
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.setLineDash([s * 0.16, s * 0.12]);
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    for (const { r, c } of ev.cells) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    const x = minC * s;
    const y = minR * s;
    const w = (maxC - minC + 1) * s;
    const h = (maxR - minR + 1) * s;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    // Label
    const label = `${flood ? "Floods" : "Collapses"} on wave ${ev.wave}`;
    const short = `W${ev.wave}`;
    const fs = Math.max(9, s * 0.27);
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = ctx.measureText(label).width + fs * 1.2 <= w ? label : short;
    const tw = ctx.measureText(text).width + fs * 1.1;
    const cx = Math.max(tw / 2 + 2, Math.min(COLS * s - tw / 2 - 2, x + w / 2));
    // Rockslide labels sit just above the wall so they don't hide it.
    const cy = flood ? y + h - fs * 0.95 : Math.max(fs, y - fs * 0.2);
    ctx.globalAlpha = next ? 1 : 0.7;
    ctx.fillStyle = "rgba(17,24,39,0.85)";
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - fs * 0.75, tw, fs * 1.5, fs * 0.75);
    ctx.fill();
    ctx.fillStyle = flood ? "#bae6fd" : "#fed7aa";
    ctx.fillText(text, cx, cy + fs * 0.05);
    ctx.restore();
  });
}

/** A soft pool of light under every Beacon so you can see what it covers. */
function drawBeaconLight(ctx: Ctx, g: Game, s: number, strong: boolean) {
  for (const t of g.towers) {
    if (!towerStats(t).aura) continue;
    const x = (t.c + 0.5) * s;
    const y = (t.r + 0.5) * s;
    const rad = towerRange(t) * s;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    glow.addColorStop(0, "rgba(254,240,138,0.16)");
    glow.addColorStop(1, "rgba(254,240,138,0.03)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(254,240,138,${strong ? 0.7 : 0.3})`;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    ctx.restore();
  }
}

/** A tower a Jinx has switched off: dimmed, with a crackle of static. */
function drawJammed(ctx: Ctx, x: number, y: number, s: number, now: number) {
  ctx.save();
  const rnd = mulberry32(Math.floor(now * 10) + Math.round(x * 7 + y * 13));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // One crackle of static across the tower, drawn ink-then-yellow so it reads on any colour
  const pts: [number, number][] = [];
  let px = x + (rnd() - 0.5) * s * 0.5;
  let py = y - s * 0.3;
  for (let i = 0; i < 5; i++) {
    pts.push([px, py]);
    px += (rnd() - 0.5) * s * 0.34;
    py += s * 0.15;
  }
  for (const [color, width] of [
    [INK, 0.085],
    ["#fde047", 0.045],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * width);
    ctx.beginPath();
    pts.forEach(([qx, qy], i) => (i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawStrike(ctx: Ctx, strike: { x: number; y: number; t: number; total: number }, s: number) {
  const x = (strike.x + 0.5) * s;
  const y = (strike.y + 0.5) * s;
  const p = 1 - Math.max(0, strike.t) / strike.total; // 0 → 1 as it falls
  drawAim(ctx, strike.x, strike.y, s, 0.35 + 0.5 * p);
  // The rock itself, coming in from the top right
  const mx = x + (1 - p) * s * 3.2;
  const my = y - (1 - p) * s * 7;
  ctx.save();
  ctx.lineCap = "round";
  const tail = ctx.createLinearGradient(mx, my, mx + s * 1.1, my - s * 2.4);
  tail.addColorStop(0, "rgba(251,146,60,0.9)");
  tail.addColorStop(1, "rgba(251,146,60,0)");
  ctx.strokeStyle = tail;
  ctx.lineWidth = s * 0.34;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(mx + s * 1.1, my - s * 2.4);
  ctx.stroke();
  circle(ctx, mx, my, s * 0.3, "#fb923c");
  circle(ctx, mx, my, s * 0.22, "#44403c");
  circle(ctx, mx - s * 0.07, my - s * 0.07, s * 0.07, "#78716c");
  ctx.restore();
}

/** Where a meteor will land: a ring the size of its blast. */
function drawAim(ctx: Ctx, cx: number, cy: number, s: number, strength = 0.6) {
  const x = (cx + 0.5) * s;
  const y = (cy + 0.5) * s;
  const rad = ABILITIES.meteor.radius * s;
  ctx.save();
  ctx.fillStyle = `rgba(239,68,68,${0.22 * strength})`;
  ctx.strokeStyle = `rgba(254,202,202,${0.5 + 0.5 * strength})`;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.25, y);
  ctx.lineTo(x + s * 0.25, y);
  ctx.moveTo(x, y - s * 0.25);
  ctx.lineTo(x, y + s * 0.25);
  ctx.stroke();
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
  if (b.note) {
    let nfs = Math.max(13, s * 0.4);
    ctx.font = `800 ${nfs}px Inter, system-ui, sans-serif`;
    const wide = ctx.measureText(b.note).width;
    if (wide > maxW) {
      nfs *= maxW / wide;
      ctx.font = `800 ${nfs}px Inter, system-ui, sans-serif`;
    }
    const ny = fs * (b.sub ? 1.3 : 0.8);
    ctx.lineWidth = nfs * 0.28;
    ctx.strokeStyle = "#451a03";
    ctx.strokeText(b.note, 0, ny);
    ctx.fillStyle = "#fde68a";
    ctx.fillText(b.note, 0, ny);
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
  /** Where the player is about to drop a meteor (cell units), if they're aiming one. */
  aim: { x: number; y: number } | null;
}

// ─── Tower sprite cache ───────────────────────────────────────────────────────
//
// The tower characters are the most detailed things on the board, and a late
// maze can have dozens of them. Each tower therefore keeps its own small
// off-screen picture, which is only repainted when the tower visibly changes:
// it turns, fires, changes mood, or its idle animation ticks over (20 times a
// second, staggered so the towers don't all repaint on the same frame).
// Everything else on the board still animates on every frame.

const TOWER_FPS = 20;
/**
 * How much room each character needs around its cell centre, in cells:
 * [to each side, above, below]. Long barrels need width, lighthouses height.
 */
const SPRITE_BOX: Record<TowerType, [number, number, number]> = {
  blaster: [1.0, 0.95, 0.9],
  frost: [0.65, 0.95, 0.62],
  bomb: [0.95, 0.95, 0.88],
  sniper: [1.08, 0.95, 1.0],
  tesla: [0.65, 0.95, 0.62],
  beacon: [0.78, 1.22, 0.62],
  mine: [0.6, 0.8, 0.62],
};
const AIM_STEP = TAU / 72;

const towerSprites = new Map<number, { canvas: HTMLCanvasElement; key: string }>();
const spareCanvases: HTMLCanvasElement[] = [];

function drawTowerCached(ctx: Ctx, t: Tower, x: number, y: number, s: number, time: number) {
  const age = time - t.born;
  const cheer = time - t.pulse;
  const idle = Math.max(0, -t.cooldown);
  const jammed = t.jamUntil > time;
  const m = typeof document === "undefined" ? null : ctx.getTransform();
  const scale = m && m.b === 0 && m.c === 0 && m.a === m.d ? m.a : 0;
  // Popping in or cheering: those are quick, bouncy moves, so draw them live.
  if (!m || scale <= 0 || age < 0.45 || cheer < 0.75) {
    drawTower(
      ctx,
      t.type,
      t.level,
      { angle: t.angle, recoil: t.recoil, flash: t.flash, idle, jammed, age, cheer, seed: t.id },
      x,
      y,
      s,
      time + t.id,
      t.spec,
    );
    return;
  }

  // Round the pose off to what you can actually see.
  const aim = Math.round(t.angle / AIM_STEP);
  const recoil = t.recoil > 0.6 ? 1 : t.recoil > 0.15 ? 0.5 : 0;
  const flash = t.flash > 0.02 ? 0.06 : 0;
  const rest = idle > 9 ? 10 : idle > 2.5 ? 3 : 0;
  const phase = (t.id * 0.618) % 1;
  const tick = Math.floor((time + t.id) * TOWER_FPS + phase);
  // Keep the picture pixel-sharp wherever the cell centre lands.
  const px = x * scale;
  const py = y * scale;
  const fx = Math.round((px - Math.floor(px)) * 4) / 4;
  const fy = Math.round((py - Math.floor(py)) * 4) / 4;
  const key = `${t.type}|${t.level}|${t.spec}|${s}|${scale}|${aim}|${recoil}|${flash}|${rest}|${jammed ? 1 : 0}|${tick}|${fx}|${fy}`;

  const [side, above, below] = SPRITE_BOX[t.type];
  const ox = Math.ceil(side * s * scale);
  const oy = Math.ceil(above * s * scale);
  const w = ox * 2 + 1;
  const h = oy + Math.ceil(below * s * scale) + 1;
  let sprite = towerSprites.get(t.id);
  if (!sprite) {
    sprite = { canvas: spareCanvases.pop() ?? document.createElement("canvas"), key: "" };
    towerSprites.set(t.id, sprite);
  }
  if (sprite.key !== key) {
    const canvas = sprite.canvas;
    const sctx = canvas.getContext("2d");
    if (!sctx) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    } else {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, w, h);
    }
    sctx.setTransform(scale, 0, 0, scale, ox + fx, oy + fy);
    drawTower(
      sctx,
      t.type,
      t.level,
      { angle: aim * AIM_STEP, recoil, flash, idle: rest, jammed, age: 9, cheer: 9, seed: t.id },
      0,
      0,
      s,
      (tick - phase) / TOWER_FPS,
      t.spec,
    );
    sprite.key = key;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sprite.canvas, Math.floor(px) + m.e - ox, Math.floor(py) + m.f - oy);
  ctx.restore();
}

/** Hand back the pictures of towers that have been sold, ready for the next one. */
function pruneTowerSprites(g: Game) {
  if (towerSprites.size <= g.towers.length) return;
  const alive = new Set(g.towers.map((t) => t.id));
  for (const [id, sprite] of towerSprites) {
    if (alive.has(id)) continue;
    towerSprites.delete(id);
    if (spareCanvases.length < 24) spareCanvases.push(sprite.canvas);
  }
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
  if (g.events.length) drawEventMarkers(ctx, g, s, now);
  if (o.showGrid) drawGridOverlay(ctx, g, s);
  g.entries.forEach((entry, i) => drawPortal(ctx, s, now, entry, g.routes[i]?.open ?? true));
  drawBeaconLight(ctx, g, s, o.showGrid);

  // Selection highlight & reach (under towers)
  if (o.selected && towerRange(o.selected) > 0) {
    const t = o.selected;
    drawCoverage(ctx, coverageOutline(g, t.c, t.r, towerRange(t), needsSight(t)), s);
  }
  if (o.hover && o.ghost) {
    const { r, c } = o.hover;
    const range = rangeAt(g, o.ghost.type, 0, r, c);
    if (range > 0) {
      drawCoverage(ctx, coverageOutline(g, c, r, range, TOWERS[o.ghost.type].needsSight), s, o.ghost.ok);
    }
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

  // Back row first, so a tall character overlaps the one behind it.
  const towers = g.towers.length > 1 ? [...g.towers].sort((a, b) => a.r - b.r) : g.towers;
  for (const t of towers) {
    const x = (t.c + 0.5) * s;
    const y = (t.r + 0.5) * s;
    drawTowerCached(ctx, t, x, y, s, time);
    if (t.onHill) drawHillBadge(ctx, x + s * 0.32, y - s * 0.32, s);
    if (t.jamUntil > time) drawJammed(ctx, x, y, s, now);
  }
  pruneTowerSprites(g);
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

  for (const exit of g.exits) drawCastle(ctx, s, now, g.lives, g.maxLives, exit, time - g.hurtAt);
  for (const e of enemies) if (e.flying) drawEnemy(ctx, e, s, time);

  for (const p of g.projectiles) drawProjectile(ctx, p, s, time);
  for (const b of g.bolts) drawBolt(ctx, b, s, time);
  for (const strike of g.strikes) drawStrike(ctx, strike, s);
  for (const p of g.particles) drawParticle(ctx, p, s);
  if (o.aim) drawAim(ctx, o.aim.x, o.aim.y, s);
  if (g.frost > 0) {
    ctx.fillStyle = `rgba(186,230,253,${0.3 * g.frost})`;
    ctx.fillRect(0, 0, COLS * s, ROWS * s);
  }

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
