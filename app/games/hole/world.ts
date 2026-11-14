// ─── Hole Drop: city generation ───────────────────────────────────────────────

import {
  BLOCK,
  BUILDING_COLORS,
  CAR_COLORS,
  GLASS_COLORS,
  HAIR_COLORS,
  HOUSE_WALLS,
  KINDS,
  ROAD,
  ROOF_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  UMBRELLA_COLORS,
  WALK,
  fitFor,
  valueFor,
  type Kind,
} from "./config";

export type BlockType = "downtown" | "office" | "shops" | "houses" | "park" | "parking" | "plaza";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Block extends Rect {
  type: BlockType;
  /** Lot = block minus sidewalks. */
  lot: Rect;
  seed: number;
}

export interface World {
  n: number;
  size: number;
  blocks: Block[];
}

export type Motion =
  | { type: "none" }
  | { type: "car"; axis: "x" | "y"; dir: 1 | -1; speed: number; lane: number }
  | { type: "ring"; block: Block; s: number; dir: 1 | -1; speed: number }
  | { type: "wander"; area: Rect; tx: number; ty: number; speed: number; pause: number };

export interface Falling {
  holeId: number;
  depth: number;
  vz: number;
  g: number;
  tilt: number;
}

export interface Obj {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  fit: number;
  value: number;
  c1: string;
  c2: string;
  c3: string;
  seed: number;
  motion: Motion;
  /** Walk / bob animation phase. */
  anim: number;
  panic: number;
  wobble: number;
  falling: Falling | null;
  dead: boolean;
}

// ─── RNG ──────────────────────────────────────────────────────────────────────

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const range = (r: Rand, a: number, b: number) => a + r() * (b - a);

// ─── Object factory ───────────────────────────────────────────────────────────

let nextId = 1;

export function makeObj(
  kind: Kind,
  x: number,
  y: number,
  r: Rand,
  opts: Partial<Pick<Obj, "w" | "d" | "h" | "c1" | "c2" | "c3" | "motion">> = {},
): Obj {
  const spec = KINDS[kind];
  const w = opts.w ?? spec.w;
  const d = opts.d ?? spec.d;
  const h = opts.h ?? spec.h;
  const fit = fitFor(kind, w, d);
  const colors = defaultColors(kind, r);
  return {
    id: nextId++,
    kind,
    x,
    y,
    w,
    d,
    h,
    fit,
    value: valueFor(kind, fit, h),
    c1: opts.c1 ?? colors[0],
    c2: opts.c2 ?? colors[1],
    c3: opts.c3 ?? colors[2],
    seed: r(),
    motion: opts.motion ?? { type: "none" },
    anim: r() * 10,
    panic: 0,
    wobble: 0,
    falling: null,
    dead: false,
  };
}

function defaultColors(kind: Kind, r: Rand): [string, string, string] {
  switch (kind) {
    case "person":
      return [pick(r, SHIRT_COLORS), pick(r, SKIN_TONES), pick(r, HAIR_COLORS)];
    case "car":
    case "van":
      return [pick(r, CAR_COLORS), "#bfe9ff", "#1f2937"];
    case "bus":
      return [pick(r, ["#facc15", "#ef4444", "#3b82f6", "#22c55e"]), "#bfe9ff", "#1f2937"];
    case "cart":
      return [pick(r, ["#f8fafc", "#fde68a", "#fecaca"]), pick(r, UMBRELLA_COLORS), "#f8fafc"];
    case "umbrella":
      return [pick(r, UMBRELLA_COLORS), "#f8fafc", "#e2e8f0"];
    case "house":
      return [pick(r, HOUSE_WALLS), pick(r, ROOF_COLORS), "#7c4a2d"];
    case "shop":
      return [pick(r, BUILDING_COLORS), pick(r, UMBRELLA_COLORS), "#f8fafc"];
    case "office":
    case "tower":
      return [pick(r, BUILDING_COLORS), "#dbeafe", "#94a3b8"];
    case "skyscraper":
      return [pick(r, GLASS_COLORS), "#e0f2fe", "#64748b"];
    case "flower":
      return ["#c2410c", pick(r, ["#f472b6", "#facc15", "#f87171", "#a78bfa", "#fb923c"]), "#22c55e"];
    case "ball":
      return [pick(r, ["#ef4444", "#3b82f6", "#facc15", "#22c55e"]), "#f8fafc", "#f8fafc"];
    case "tree":
    case "bigtree":
      return [pick(r, ["#4ade80", "#22c55e", "#65d26e", "#86d84a"]), "#8b5a2b", "#fde047"];
    case "pine":
      return [pick(r, ["#16a34a", "#15803d", "#22a35a"]), "#7c4a2d", "#fff"];
    case "bush":
      return [pick(r, ["#4ade80", "#22c55e", "#65c25a"]), pick(r, ["#f472b6", "#fde047", "#fff", "#4ade80"]), "#fff"];
    case "bench":
      return ["#b7793f", "#475569", "#fff"];
    case "lamp":
      return ["#475569", "#fde68a", "#fff"];
    case "hydrant":
      return ["#ef4444", "#fca5a5", "#fff"];
    case "cone":
      return ["#fb923c", "#f8fafc", "#fff"];
    case "trash":
      return ["#16a34a", "#166534", "#fff"];
    case "mailbox":
      return ["#2563eb", "#1e40af", "#fff"];
    case "fountain":
      return ["#e2e8f0", "#7dd3fc", "#cbd5e1"];
  }
}

// ─── City layout ──────────────────────────────────────────────────────────────

export function worldSize(n: number) {
  return n * BLOCK + ROAD;
}

export function generateCity(n: number, seed: number): { world: World; objs: Obj[] } {
  const r = rng(seed);
  const size = worldSize(n);
  const blocks: Block[] = [];
  const objs: Obj[] = [];
  const mid = (n - 1) / 2;

  const types: BlockType[][] = [];
  for (let j = 0; j < n; j++) {
    types.push([]);
    for (let i = 0; i < n; i++) {
      const dist = Math.hypot(i - mid, j - mid) / Math.max(1, mid);
      let t: BlockType;
      const roll = r();
      if (dist < 0.32) t = roll < 0.75 ? "downtown" : "office";
      else if (dist < 0.62) t = roll < 0.28 ? "office" : roll < 0.5 ? "shops" : roll < 0.68 ? "plaza" : roll < 0.84 ? "park" : "parking";
      else t = roll < 0.5 ? "houses" : roll < 0.7 ? "park" : roll < 0.85 ? "parking" : "shops";
      types[j].push(t);
    }
  }
  // Small cities still want a little downtown in the middle.
  if (n <= 6) types[Math.floor(mid)][Math.floor(mid)] = "downtown";

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * BLOCK + ROAD;
      const y = j * BLOCK + ROAD;
      const w = BLOCK - ROAD;
      const lot: Rect = { x: x + WALK, y: y + WALK, w: w - WALK * 2, h: w - WALK * 2 };
      const block: Block = { x, y, w, h: w, type: types[j][i], lot, seed: r() };
      blocks.push(block);
      fillBlock(block, r, objs);
      fillSidewalks(block, r, objs);
    }
  }

  fillRoads(n, size, r, objs);
  return { world: { n, size, blocks }, objs };
}

function addPeople(objs: Obj[], r: Rand, count: number, area: Rect) {
  for (let k = 0; k < count; k++) {
    const x = range(r, area.x, area.x + area.w);
    const y = range(r, area.y, area.y + area.h);
    objs.push(
      makeObj("person", x, y, r, {
        motion: { type: "wander", area, tx: x, ty: y, speed: range(r, 18, 34), pause: r() * 2 },
      }),
    );
  }
}

export function ringPerimeter(b: Block) {
  return 2 * (b.w - WALK) + 2 * (b.h - WALK);
}

/** Position on the sidewalk loop around a block for perimeter distance s. */
export function ringPos(b: Block, s: number): [number, number] {
  const inset = WALK / 2;
  const w = b.w - WALK;
  const h = b.h - WALK;
  const P = 2 * (w + h);
  let t = ((s % P) + P) % P;
  const x0 = b.x + inset;
  const y0 = b.y + inset;
  if (t < w) return [x0 + t, y0];
  t -= w;
  if (t < h) return [x0 + w, y0 + t];
  t -= h;
  if (t < w) return [x0 + w - t, y0 + h];
  t -= w;
  return [x0, y0 + h - t];
}

function fillSidewalks(b: Block, r: Rand, objs: Obj[]) {
  const edge = 5;
  // Lamps + street furniture along each side, at the curb.
  const sides: [number, number, number, number][] = [
    [b.x, b.y + edge, 1, 0],
    [b.x, b.y + b.h - edge, 1, 0],
    [b.x + edge, b.y, 0, 1],
    [b.x + b.w - edge, b.y, 0, 1],
  ];
  for (const [sx, sy, dx, dy] of sides) {
    for (let t = 55; t < b.w - 30; t += 120) {
      objs.push(makeObj("lamp", sx + dx * t, sy + dy * t, r));
    }
    const extras = 1 + Math.floor(r() * 3);
    for (let k = 0; k < extras; k++) {
      const t = range(r, 25, b.w - 25);
      const kind = pick(r, ["trash", "hydrant", "mailbox", "flower", "bench"] as const);
      const o = makeObj(kind, sx + dx * t, sy + dy * t, r);
      if (kind === "bench" && dy === 1) {
        o.w = KINDS.bench.d;
        o.d = KINDS.bench.w;
      }
      objs.push(o);
    }
  }
  // People strolling around the block.
  const walkers = 3 + Math.floor(r() * 4);
  const P = ringPerimeter(b);
  for (let k = 0; k < walkers; k++) {
    const s = r() * P;
    const [x, y] = ringPos(b, s);
    objs.push(
      makeObj("person", x, y, r, {
        motion: { type: "ring", block: b, s, dir: r() < 0.5 ? 1 : -1, speed: range(r, 20, 34) },
      }),
    );
  }
}

function fillRoads(n: number, size: number, r: Rand, objs: Obj[]) {
  for (let i = 0; i <= n; i++) {
    const c = i * BLOCK;
    for (const axis of ["x", "y"] as const) {
      for (const dir of [1, -1] as const) {
        const lane = c + (dir === 1 ? ROAD * 0.7 : ROAD * 0.3);
        const count = 2 + Math.floor(r() * 2);
        for (let k = 0; k < count; k++) {
          const along = range(r, 60, size - 60);
          const roll = r();
          const kind: Kind = roll < 0.08 ? "bus" : roll < 0.22 ? "van" : "car";
          const spec = KINDS[kind];
          const w = axis === "x" ? spec.w : spec.d;
          const d = axis === "x" ? spec.d : spec.w;
          const x = axis === "x" ? along : lane;
          const y = axis === "x" ? lane : along;
          objs.push(
            makeObj(kind, x, y, r, {
              w,
              d,
              motion: { type: "car", axis, dir, speed: kind === "bus" ? range(r, 45, 60) : range(r, 60, 95), lane },
            }),
          );
        }
      }
      // Occasional road work cones.
      if (r() < 0.35) {
        const along = range(r, 120, size - 120);
        for (let k = 0; k < 4; k++) {
          const a = along + k * 22;
          const off = c + ROAD * 0.5;
          objs.push(makeObj("cone", axis === "x" ? a : off, axis === "x" ? off : a, r));
        }
      }
    }
  }
}

function fillBlock(b: Block, r: Rand, objs: Obj[]) {
  const L = b.lot;
  const cx = L.x + L.w / 2;
  const cy = L.y + L.h / 2;

  switch (b.type) {
    case "downtown": {
      const cell = L.w / 2;
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 2; gx++) {
          const x = L.x + cell * gx + cell / 2;
          const y = L.y + cell * gy + cell / 2;
          const roll = r();
          const kind: Kind = roll < 0.4 ? "skyscraper" : roll < 0.8 ? "tower" : "office";
          const s = Math.min(cell - 18, KINDS[kind].w) - r() * 18;
          const h = KINDS[kind].h * range(r, 0.8, 1.15);
          objs.push(makeObj(kind, x, y, r, { w: s, d: s - r() * 12, h }));
        }
      }
      addPeople(objs, r, 3, { x: L.x + L.w / 2 - 8, y: L.y, w: 16, h: L.h });
      break;
    }
    case "office": {
      const twoUp = r() < 0.5;
      if (twoUp) {
        for (let k = 0; k < 2; k++) {
          const x = L.x + L.w * (k === 0 ? 0.27 : 0.73);
          objs.push(makeObj("office", x, cy - 30, r, { w: 135, d: 150, h: range(r, 130, 200) }));
          objs.push(makeObj("tree", x, L.y + L.h - 30, r));
        }
        objs.push(makeObj("bench", cx, L.y + L.h - 28, r));
      } else {
        objs.push(makeObj("tower", L.x + 90, L.y + 90, r, { w: 140, d: 140, h: range(r, 200, 280) }));
        objs.push(makeObj("shop", L.x + L.w - 70, L.y + 60, r, { w: 110, d: 90 }));
        objs.push(makeObj("office", L.x + L.w - 75, L.y + L.h - 85, r, { w: 120, d: 110, h: range(r, 110, 160) }));
        objs.push(makeObj("tree", L.x + 40, L.y + L.h - 40, r));
        objs.push(makeObj("tree", L.x + 120, L.y + L.h - 40, r));
        objs.push(makeObj("bush", L.x + 80, L.y + L.h - 40, r));
      }
      addPeople(objs, r, 4, { x: L.x, y: L.y + L.h - 60, w: L.w, h: 50 });
      break;
    }
    case "shops": {
      for (let k = 0; k < 3; k++) {
        const w = L.w / 3 - 8;
        objs.push(
          makeObj("shop", L.x + (L.w / 3) * k + L.w / 6, L.y + 46, r, { w, d: 84, h: range(r, 52, 80) }),
        );
      }
      for (let k = 0; k < 4; k++) {
        objs.push(makeObj("umbrella", L.x + 40 + k * 80 + range(r, -8, 8), cy + 40 + range(r, -10, 10), r));
      }
      objs.push(makeObj("cart", L.x + 60, L.y + L.h - 40, r));
      objs.push(makeObj("cart", L.x + L.w - 60, L.y + L.h - 40, r));
      objs.push(makeObj("tree", cx, L.y + L.h - 36, r));
      objs.push(makeObj("bench", cx - 60, cy + 4, r));
      objs.push(makeObj("bench", cx + 60, cy + 4, r));
      addPeople(objs, r, 9, { x: L.x + 10, y: cy - 20, w: L.w - 20, h: L.h / 2 });
      break;
    }
    case "plaza": {
      objs.push(makeObj("fountain", cx, cy, r));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        objs.push(makeObj("tree", cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, r));
        objs.push(makeObj("bench", cx + Math.cos(a + 0.5) * 80, cy + Math.sin(a + 0.5) * 80, r));
      }
      for (let k = 0; k < 3; k++) objs.push(makeObj("umbrella", range(r, L.x + 30, L.x + L.w - 30), L.y + 30, r));
      objs.push(makeObj("cart", L.x + 40, cy, r));
      objs.push(makeObj("cart", L.x + L.w - 40, cy, r));
      for (let k = 0; k < 6; k++) objs.push(makeObj("flower", range(r, L.x + 20, L.x + L.w - 20), L.y + L.h - 20, r));
      addPeople(objs, r, 12, L);
      break;
    }
    case "park": {
      const pathW = 26;
      objs.push(makeObj("fountain", cx, cy, r, { w: 64, d: 64 }));
      const quads: Rect[] = [
        { x: L.x + 8, y: L.y + 8, w: L.w / 2 - pathW / 2 - 16, h: L.h / 2 - pathW / 2 - 16 },
        { x: cx + pathW / 2 + 8, y: L.y + 8, w: L.w / 2 - pathW / 2 - 16, h: L.h / 2 - pathW / 2 - 16 },
        { x: L.x + 8, y: cy + pathW / 2 + 8, w: L.w / 2 - pathW / 2 - 16, h: L.h / 2 - pathW / 2 - 16 },
        { x: cx + pathW / 2 + 8, y: cy + pathW / 2 + 8, w: L.w / 2 - pathW / 2 - 16, h: L.h / 2 - pathW / 2 - 16 },
      ];
      for (const q of quads) {
        const trees = 2 + Math.floor(r() * 2);
        for (let k = 0; k < trees; k++) {
          const kind = pick(r, ["tree", "tree", "pine", "bigtree"] as const);
          const pad = KINDS[kind].w / 2;
          objs.push(makeObj(kind, range(r, q.x + pad, q.x + q.w - pad), range(r, q.y + pad, q.y + q.h - pad), r));
        }
        for (let k = 0; k < 3; k++) objs.push(makeObj("bush", range(r, q.x + 10, q.x + q.w - 10), range(r, q.y + 10, q.y + q.h - 10), r));
        for (let k = 0; k < 2; k++) objs.push(makeObj("flower", range(r, q.x + 10, q.x + q.w - 10), range(r, q.y + 10, q.y + q.h - 10), r));
        if (r() < 0.6) objs.push(makeObj("ball", range(r, q.x + 10, q.x + q.w - 10), range(r, q.y + 10, q.y + q.h - 10), r));
      }
      objs.push(makeObj("bench", cx - 70, cy - pathW / 2 - 10, r));
      objs.push(makeObj("bench", cx + 70, cy + pathW / 2 + 10, r));
      objs.push(makeObj("trash", cx + 40, cy - pathW / 2 - 8, r));
      addPeople(objs, r, 5, { x: L.x, y: cy - pathW / 2, w: L.w, h: pathW });
      addPeople(objs, r, 5, { x: cx - pathW / 2, y: L.y, w: pathW, h: L.h });
      addPeople(objs, r, 4, L);
      break;
    }
    case "parking": {
      // Two rows of stalls facing a center aisle, cars parked nose-in (vertical).
      const stalls = 7;
      const sw = L.w / stalls;
      for (const rowY of [L.y + 42, L.y + L.h - 42]) {
        for (let k = 0; k < stalls; k++) {
          if (r() < 0.25) continue;
          const kind: Kind = r() < 0.15 ? "van" : "car";
          const spec = KINDS[kind];
          objs.push(makeObj(kind, L.x + sw * k + sw / 2, rowY, r, { w: spec.d, d: spec.w }));
        }
      }
      if (r() < 0.6) objs.push(makeObj("bus", cx, cy, r));
      else {
        objs.push(makeObj("car", cx - 50, cy, r));
        objs.push(makeObj("cone", cx + 40, cy, r));
        objs.push(makeObj("cone", cx + 70, cy, r));
      }
      addPeople(objs, r, 4, { x: L.x, y: cy - 30, w: L.w, h: 60 });
      break;
    }
    case "houses": {
      const cell = L.w / 2;
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 2; gx++) {
          const x0 = L.x + cell * gx;
          const y0 = L.y + cell * gy;
          const hx = x0 + cell / 2 + range(r, -10, 10);
          const hy = y0 + cell * 0.42;
          objs.push(makeObj("house", hx, hy, r, { w: range(r, 66, 84), d: range(r, 56, 66), h: range(r, 42, 54) }));
          objs.push(makeObj(pick(r, ["tree", "pine", "bigtree"] as const), x0 + 30, y0 + 34, r));
          objs.push(makeObj("bush", x0 + cell - 26, y0 + 24, r));
          objs.push(makeObj("bush", x0 + cell - 26, y0 + cell - 28, r));
          objs.push(makeObj("mailbox", x0 + 22, y0 + cell - 18, r));
          objs.push(makeObj("flower", hx - 24, y0 + cell - 30, r));
          objs.push(makeObj("flower", hx + 24, y0 + cell - 30, r));
          if (r() < 0.5) objs.push(makeObj("ball", x0 + range(r, 30, cell - 30), y0 + cell - 22, r));
          if (r() < 0.5) {
            objs.push(makeObj("car", x0 + cell - 30, y0 + cell * 0.55, r, { w: KINDS.car.d, d: KINDS.car.w }));
          }
          addPeople(objs, r, 1, { x: x0 + 10, y: y0 + cell - 40, w: cell - 20, h: 30 });
        }
      }
      break;
    }
  }
}

/** Respawn a stroller somewhere on a random block's sidewalk. */
export function spawnWalker(world: World, r: Rand): Obj {
  const b = world.blocks[Math.floor(r() * world.blocks.length)];
  const s = r() * ringPerimeter(b);
  const [x, y] = ringPos(b, s);
  return makeObj("person", x, y, r, {
    motion: { type: "ring", block: b, s, dir: r() < 0.5 ? 1 : -1, speed: range(r, 20, 34) },
  });
}
