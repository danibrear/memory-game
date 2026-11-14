// ─── Hole Drop: game simulation ───────────────────────────────────────────────

import {
  BASE_R,
  BLOCK,
  FIT_MARGIN,
  MODES,
  RIVAL_COLORS,
  RIVAL_NAMES,
  ROAD,
  TILT,
  levelInfo,
  type Kind,
  type ModeId,
} from "./config";
import { generateCity, ringPerimeter, ringPos, rng, spawnWalker, type Obj, type World } from "./world";

export interface Hole {
  id: number;
  name: string;
  color: string;
  rainbow: boolean;
  isPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Displayed radius (springs toward the size for its mass). */
  r: number;
  rv: number;
  /** 0..1 flash on the rim each time something drops in. */
  pulse: number;
  /** Object kinds this hole has grown big enough to eat (player announcements). */
  unlocked: Set<Kind>;
  mass: number;
  score: number;
  level: number;
  progress: number;
  alive: boolean;
  respawnT: number;
  invulnT: number;
  combo: number;
  lastEatT: number;
  eatenCount: number;
  gobbles: number;
  // AI
  tx: number;
  ty: number;
  think: number;
  skill: number;
}

export type GameEvent =
  | { type: "eat"; holeId: number; value: number; fit: number; combo: number; x: number; y: number }
  | { type: "fall"; holeId: number; fit: number }
  | { type: "levelup"; holeId: number; level: number }
  | { type: "unlock"; holeId: number; kinds: Kind[] }
  | { type: "gobble"; eaterId: number; victimId: number }
  | { type: "respawn"; holeId: number }
  | { type: "tick"; secondsLeft: number }
  | { type: "go" }
  | { type: "over" };

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "dust" | "bit";
}

export interface Floater {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface Ring {
  holeId: number;
  t: number;
  color: string;
}

export type Phase = "countdown" | "playing" | "over";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shake: number;
}

export interface Game {
  mode: ModeId;
  demo: boolean;
  world: World;
  objs: Obj[];
  holes: Hole[];
  player: Hole;
  phase: Phase;
  countdown: number;
  time: number;
  duration: number;
  totalValue: number;
  totalCount: number;
  eatenValue: number;
  particles: Particle[];
  floaters: Floater[];
  rings: Ring[];
  events: GameEvent[];
  cam: Camera;
  /** Nearest edible thing, for the "food is this way" arrow. */
  hint: { x: number; y: number } | null;
  hintT: number;
  rand: () => number;
  respawnT: number;
  smallTarget: number;
  lastTick: number;
  clearedAt: number | null;
  /** Smallest fit radius of each kind in this city (for unlock announcements). */
  kindMinFit: Map<Kind, number>;
}

export interface Input {
  /** Desired direction, magnitude 0..1. */
  x: number;
  y: number;
}

export interface NewGameOpts {
  mode: ModeId;
  name: string;
  color: string;
  rainbow: boolean;
  demo?: boolean;
  seed?: number;
}

const isSmall = (o: Obj) => o.kind === "person";

export function createGame(opts: NewGameOpts): Game {
  const def = MODES[opts.mode];
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rand = rng(seed ^ 0x9e3779b9);
  const { world, objs } = generateCity(def.blocks, seed);

  const holes: Hole[] = [];
  const spawns = spawnPoints(world, def.rivals + 1, rand);
  const player = makeHole(0, opts.name || "You", opts.color, opts.rainbow, true, spawns[0][0], spawns[0][1]);
  holes.push(player);

  const names = shuffle([...RIVAL_NAMES], rand);
  const colors = shuffle(
    RIVAL_COLORS.filter((c) => c.toLowerCase() !== opts.color.toLowerCase()),
    rand,
  );
  for (let i = 0; i < def.rivals; i++) {
    const h = makeHole(i + 1, names[i % names.length], colors[i % colors.length], false, false, spawns[i + 1][0], spawns[i + 1][1]);
    // A spread of skill so there is always someone beatable and someone to chase.
    h.skill = 0.72 + (i / Math.max(1, def.rivals - 1)) * 0.18;
    holes.push(h);
  }

  let totalValue = 0;
  const kindMinFit = new Map<Kind, number>();
  for (const o of objs) {
    totalValue += o.value;
    kindMinFit.set(o.kind, Math.min(kindMinFit.get(o.kind) ?? Infinity, o.fit));
  }
  // Whatever the player can already eat at the start isn't news.
  for (const [k, f] of kindMinFit) if (f * FIT_MARGIN <= player.r) player.unlocked.add(k);

  return {
    mode: opts.mode,
    demo: !!opts.demo,
    world,
    objs,
    holes,
    player,
    phase: opts.demo ? "playing" : "countdown",
    countdown: 3.2,
    time: 0,
    duration: def.duration,
    totalValue,
    totalCount: objs.length,
    eatenValue: 0,
    particles: [],
    floaters: [],
    rings: [],
    events: [],
    cam: { x: player.x, y: player.y, zoom: 0.5, shake: 0 },
    hint: null,
    hintT: 0,
    rand,
    respawnT: 0,
    smallTarget: objs.filter(isSmall).length,
    lastTick: -1,
    clearedAt: null,
    kindMinFit,
  };
}

function makeHole(id: number, name: string, color: string, rainbow: boolean, isPlayer: boolean, x: number, y: number): Hole {
  return {
    id,
    name,
    color,
    rainbow,
    isPlayer,
    x,
    y,
    vx: 0,
    vy: 0,
    r: BASE_R,
    rv: 0,
    pulse: 0,
    unlocked: new Set(),
    mass: 0,
    score: 0,
    level: 1,
    progress: 0,
    alive: true,
    respawnT: 0,
    invulnT: 2,
    combo: 0,
    lastEatT: -10,
    eatenCount: 0,
    gobbles: 0,
    tx: x,
    ty: y,
    think: 0,
    skill: 1,
  };
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Intersections spread around the map, player near the middle-ish. */
function spawnPoints(world: World, count: number, r: () => number): [number, number][] {
  const n = world.n;
  const pts: [number, number][] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pts.push([i * BLOCK + ROAD / 2, j * BLOCK + ROAD / 2]);
  const inner = pts.filter(([x, y]) => x > BLOCK * 0.9 && y > BLOCK * 0.9 && x < world.size - BLOCK * 0.9 && y < world.size - BLOCK * 0.9);
  const pool = shuffle(inner.length >= count ? inner : pts, r);
  // Greedy farthest-point picking so nobody starts on top of each other.
  const chosen: [number, number][] = [pool[0]];
  while (chosen.length < count && chosen.length < pool.length) {
    let best = pool[0];
    let bestD = -1;
    for (const p of pool) {
      const d = Math.min(...chosen.map((c) => Math.hypot(c[0] - p[0], c[1] - p[1])));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    chosen.push(best);
  }
  while (chosen.length < count) chosen.push(pool[chosen.length % pool.length]);
  return chosen;
}

export function holeSpeed(h: Hole) {
  return 210 + h.r * 1.1;
}

export const fits = (o: Obj, h: Hole) => o.fit * FIT_MARGIN <= h.r;

export function ranking(g: Game): Hole[] {
  return [...g.holes].sort((a, b) => b.score - a.score || a.id - b.id);
}

export function timeLeft(g: Game) {
  return g.duration ? Math.max(0, g.duration - g.time) : 0;
}

export function cityEaten(g: Game) {
  return g.totalValue ? Math.min(1, g.eatenValue / g.totalValue) : 0;
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export function step(g: Game, dt: number, input: Input) {
  g.events.length = 0;

  if (g.phase === "countdown") {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    if (g.countdown <= 0) {
      g.phase = "playing";
      g.events.push({ type: "go" });
    } else if (Math.ceil(g.countdown) !== before) {
      g.events.push({ type: "tick", secondsLeft: Math.ceil(g.countdown) });
    }
  } else if (g.phase === "playing") {
    g.time += dt;
    if (g.duration) {
      const left = Math.ceil(g.duration - g.time);
      if (left <= 10 && left > 0 && left !== g.lastTick) {
        g.lastTick = left;
        g.events.push({ type: "tick", secondsLeft: left });
      }
      if (g.time >= g.duration) {
        g.phase = "over";
        g.events.push({ type: "over" });
      }
    }
  }

  const active = g.phase === "playing";

  updateObjects(g, dt);
  if (active) {
    for (const h of g.holes) updateHole(g, h, dt, h.isPlayer && !g.demo ? input : null);
    holeVsHole(g);
    eatObjects(g);
  }
  updateFalling(g, dt);
  updateFx(g, dt);
  respawnSmall(g, dt);
  updateHint(g, dt);
  updateCamera(g, dt);

  if (g.phase === "playing" && g.mode === "chill" && g.clearedAt === null && remainingCount(g) === 0) {
    g.clearedAt = g.time;
    g.phase = "over";
    g.events.push({ type: "over" });
  }
}

export function remainingCount(g: Game) {
  let n = 0;
  for (const o of g.objs) if (!o.dead && !o.falling) n++;
  return n;
}

// ─── Holes ────────────────────────────────────────────────────────────────────

function updateHole(g: Game, h: Hole, dt: number, input: Input | null) {
  if (!h.alive) {
    h.respawnT -= dt;
    if (h.respawnT <= 0) respawn(g, h);
    return;
  }
  h.invulnT = Math.max(0, h.invulnT - dt);

  let ix = 0;
  let iy = 0;
  if (input) {
    ix = input.x;
    iy = input.y;
  } else {
    h.think -= dt;
    if (h.think <= 0) {
      h.think = 0.35 + g.rand() * 0.4;
      thinkAI(g, h);
    }
    const dx = h.tx - h.x;
    const dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      const m = Math.min(1, d / 40);
      ix = (dx / d) * m;
      iy = (dy / d) * m;
    }
  }

  const speed = holeSpeed(h) * (input ? 1 : h.skill * 0.92);
  const tvx = ix * speed;
  const tvy = iy * speed;
  const k = Math.min(1, dt * 10);
  h.vx += (tvx - h.vx) * k;
  h.vy += (tvy - h.vy) * k;
  h.x += h.vx * dt;
  h.y += h.vy * dt;

  const pad = h.r * 0.6;
  h.x = Math.max(pad, Math.min(g.world.size - pad, h.x));
  h.y = Math.max(pad, Math.min(g.world.size - pad, h.y));

  const info = levelInfo(h.mass);
  // Springy growth with a little overshoot, so a level-up "pops" like hole.io.
  h.rv += ((info.radius - h.r) * 70 - h.rv * 10) * dt;
  h.r += h.rv * dt;
  h.pulse = Math.max(0, h.pulse - dt * 3.5);
  h.progress = info.progress;
  if (info.level > h.level) {
    h.level = info.level;
    g.events.push({ type: "levelup", holeId: h.id, level: h.level });
    g.rings.push({ holeId: h.id, t: 0, color: h.color });
  }
  if (h.isPlayer && !g.demo) {
    const fresh: Kind[] = [];
    for (const [k, f] of g.kindMinFit) {
      if (!h.unlocked.has(k) && f * FIT_MARGIN <= info.radius) {
        h.unlocked.add(k);
        fresh.push(k);
      }
    }
    if (fresh.length) g.events.push({ type: "unlock", holeId: h.id, kinds: fresh });
  }
}

function respawn(g: Game, h: Hole) {
  const spots = spawnPoints(g.world, 12, g.rand);
  let best = spots[0];
  let bestScore = -Infinity;
  for (const s of spots) {
    let danger = 0;
    for (const o of g.holes) {
      if (o === h || !o.alive) continue;
      danger += o.r / Math.max(80, Math.hypot(o.x - s[0], o.y - s[1]));
    }
    if (-danger > bestScore) {
      bestScore = -danger;
      best = s;
    }
  }
  h.x = best[0];
  h.y = best[1];
  h.tx = h.x;
  h.ty = h.y;
  h.vx = h.vy = 0;
  h.alive = true;
  h.invulnT = 3;
  const info = levelInfo(h.mass);
  h.r = info.radius * 0.6;
  h.rv = 0;
  h.level = info.level;
  g.events.push({ type: "respawn", holeId: h.id });
}

function thinkAI(g: Game, h: Hole) {
  // 1) Run from anything big enough to eat us.
  let fx = 0;
  let fy = 0;
  for (const o of g.holes) {
    if (o === h || !o.alive) continue;
    if (o.r > h.r * 1.2 && h.invulnT <= 0) {
      const dx = h.x - o.x;
      const dy = h.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = o.r + h.r + 220;
      if (d < reach) {
        const w = (1 - d / reach) * 2;
        fx += (dx / d) * w;
        fy += (dy / d) * w;
      }
    }
  }
  if (Math.hypot(fx, fy) > 0.35) {
    h.tx = h.x + fx * 300;
    h.ty = h.y + fy * 300;
    return;
  }

  // Rivals get distracted now and then so kids can keep up.
  if (!h.isPlayer && g.rand() < 0.16) {
    h.tx = h.x + (g.rand() - 0.5) * 500;
    h.ty = h.y + (g.rand() - 0.5) * 500;
    h.think = 0.6 + g.rand() * 0.8;
    return;
  }

  // 2) Find the juiciest thing nearby.
  const noisy = !h.isPlayer;
  let best: { x: number; y: number } | null = null;
  let bestScore = 0;
  const reach = 520 + h.r * 3;
  for (const o of g.objs) {
    if (o.dead || o.falling || !fits(o, h)) continue;
    const dx = o.x - h.x;
    const dy = o.y - h.y;
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const d = Math.hypot(dx, dy);
    const s = ((o.value + 0.5) / (d + 70)) * (noisy ? 0.5 + g.rand() : 1);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  for (const o of g.holes) {
    if (o === h || !o.alive || o.invulnT > 0) continue;
    if (h.r > o.r * 1.22) {
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (d > 460) continue;
      // Rivals go easier on the player.
      const s = ((o.mass * 0.5 + 20) / (d + 70)) * (o.isPlayer ? 0.45 : 1.1);
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    }
  }
  if (best) {
    h.tx = best.x;
    h.ty = best.y;
    return;
  }

  // 3) Wander somewhere new.
  const dx = h.tx - h.x;
  const dy = h.ty - h.y;
  if (Math.hypot(dx, dy) < 40) {
    h.tx = 200 + g.rand() * (g.world.size - 400);
    h.ty = 200 + g.rand() * (g.world.size - 400);
  }
}

function holeVsHole(g: Game) {
  for (const a of g.holes) {
    if (!a.alive) continue;
    for (const b of g.holes) {
      if (a === b || !b.alive || b.invulnT > 0) continue;
      if (a.r <= b.r * 1.2) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < a.r - b.r * 0.5) {
        const gain = Math.round(b.mass * 0.5 + 25);
        a.mass += gain;
        a.score += gain;
        a.gobbles++;
        b.alive = false;
        b.respawnT = 2.6;
        b.mass = Math.floor(b.mass * 0.5);
        b.combo = 0;
        g.events.push({ type: "gobble", eaterId: a.id, victimId: b.id });
        burst(g, b.x, b.y, b.color, 26, 1.4);
        g.floaters.push({ x: a.x, y: a.y, z: a.r * 0.8, text: `+${gain}`, color: a.color, life: 1.2, size: 1.5 });
        if (a.isPlayer || b.isPlayer) g.cam.shake = Math.max(g.cam.shake, 0.4);
      }
    }
  }
}

// ─── Objects ──────────────────────────────────────────────────────────────────

function updateObjects(g: Game, dt: number) {
  const size = g.world.size;
  for (const o of g.objs) {
    if (o.dead || o.falling) continue;
    o.wobble = Math.max(0, o.wobble - dt * 2.5);
    o.pull = Math.max(0, o.pull - dt * 4);
    const m = o.motion;
    if (m.type === "none") continue;

    if (m.type === "car") {
      const v = m.speed * m.dir * dt;
      if (m.axis === "x") {
        o.x += v;
        if (o.x > size - 40 || o.x < 40) flipCar(o, size);
      } else {
        o.y += v;
        if (o.y > size - 40 || o.y < 40) flipCar(o, size);
      }
      continue;
    }

    // People: panic when a hole that could eat them is close.
    const threat = nearestThreat(g, o);
    o.panic = Math.max(0, o.panic - dt);
    if (threat) o.panic = 1;
    const speedMul = o.panic > 0 ? 2.6 : 1;
    o.anim += dt * (o.panic > 0 ? 18 : 9);

    if (m.type === "ring") {
      if (threat) {
        // Pick the direction around the block that moves away from the hole.
        const [ax, ay] = ringPos(m.block, m.s + 4);
        const [bx, by] = ringPos(m.block, m.s - 4);
        const da = Math.hypot(ax - threat.x, ay - threat.y);
        const db = Math.hypot(bx - threat.x, by - threat.y);
        m.dir = da >= db ? 1 : -1;
      }
      m.s += m.speed * speedMul * m.dir * dt;
      const P = ringPerimeter(m.block);
      m.s = ((m.s % P) + P) % P;
      const [x, y] = ringPos(m.block, m.s);
      o.x = x;
      o.y = y;
    } else if (m.type === "wander") {
      if (threat) {
        const dx = o.x - threat.x;
        const dy = o.y - threat.y;
        const d = Math.hypot(dx, dy) || 1;
        m.tx = o.x + (dx / d) * 60;
        m.ty = o.y + (dy / d) * 60;
        m.pause = 0;
      }
      if (m.pause > 0) {
        m.pause -= dt;
        o.anim -= dt * 9;
        continue;
      }
      const dx = m.tx - o.x;
      const dy = m.ty - o.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        m.tx = m.area.x + g.rand() * m.area.w;
        m.ty = m.area.y + g.rand() * m.area.h;
        m.pause = g.rand() * 2.5;
      } else {
        const s = Math.min(d, m.speed * speedMul * dt);
        o.x += (dx / d) * s;
        o.y += (dy / d) * s;
      }
      o.x = Math.max(m.area.x - 30, Math.min(m.area.x + m.area.w + 30, o.x));
      o.y = Math.max(m.area.y - 30, Math.min(m.area.y + m.area.h + 30, o.y));
    }
  }
}

function flipCar(o: Obj, size: number) {
  const m = o.motion;
  if (m.type !== "car") return;
  m.dir = m.dir === 1 ? -1 : 1;
  const base = m.lane - (m.lane % BLOCK);
  m.lane = base + (m.dir === 1 ? ROAD * 0.7 : ROAD * 0.3);
  if (m.axis === "x") {
    o.y = m.lane;
    o.x = Math.max(41, Math.min(size - 41, o.x));
  } else {
    o.x = m.lane;
    o.y = Math.max(41, Math.min(size - 41, o.y));
  }
}

function nearestThreat(g: Game, o: Obj): Hole | null {
  if (g.phase !== "playing") return null;
  for (const h of g.holes) {
    if (!h.alive || !fits(o, h)) continue;
    const reach = h.r * 1.5 + 40;
    const dx = o.x - h.x;
    const dy = o.y - h.y;
    if (Math.abs(dx) < reach && Math.abs(dy) < reach && dx * dx + dy * dy < reach * reach) return h;
  }
  return null;
}

function eatObjects(g: Game) {
  for (const h of g.holes) {
    if (!h.alive) continue;
    const reachBox = h.r + 120;
    for (const o of g.objs) {
      if (o.dead || o.falling) continue;
      const dx = o.x - h.x;
      const dy = o.y - h.y;
      if (dx > reachBox || dx < -reachBox || dy > reachBox || dy < -reachBox) continue;
      const d = Math.hypot(dx, dy);
      if (d > h.r + o.fit) continue;
      if (fits(o, h)) {
        if (d < h.r - o.fit * 0.4) startFall(g, o, h, d);
        else if (d < h.r + o.fit * 0.7) {
          // Hanging over the rim: lean toward the hole before tipping in.
          const p = Math.min(1, 1 - (d - (h.r - o.fit * 0.4)) / (o.fit * 1.1));
          if (p > o.pull) {
            o.pull = p;
            o.pullX = -dx / (d || 1);
            o.pullY = -dy / (d || 1);
          }
        }
      } else if (d < h.r + o.fit * 0.3) {
        o.wobble = 1;
      }
    }
  }
}

function startFall(g: Game, o: Obj, h: Hole, d: number) {
  const fallDepth = o.h + o.fit * 0.6 + 12;
  const T = 0.42 + Math.min(0.75, o.h / 500);
  // Big things balance on the rim for a beat before they tip in.
  const overhang = Math.max(0, (d + o.fit - h.r) / o.fit);
  const teeter = o.fit > 16 ? Math.min(0.32, 0.08 + overhang * 0.3 + o.fit / 900) : 0;
  const len = d || 1;
  o.falling = {
    holeId: h.id,
    depth: 0,
    vz: 0,
    g: (2 * fallDepth) / (T * T),
    teeter,
    teeterMax: teeter,
    dx: d > 0.5 ? (h.x - o.x) / len : 0,
    dy: d > 0.5 ? (h.y - o.y) / len : 1,
  };
  o.pull = 0;
  if (o.fit > 18) {
    for (let i = 0; i < Math.min(14, 4 + o.fit / 6); i++) {
      const a = g.rand() * Math.PI * 2;
      g.particles.push({
        x: o.x + Math.cos(a) * o.fit * 0.6,
        y: o.y + Math.sin(a) * o.fit * 0.6,
        z: 2,
        vx: Math.cos(a) * 30,
        vy: Math.sin(a) * 30,
        vz: 20 + g.rand() * 30,
        life: 0.7,
        max: 0.7,
        color: "rgba(255,255,255,0.8)",
        size: 4 + o.fit / 8,
        kind: "dust",
      });
    }
  }
  g.events.push({ type: "fall", holeId: h.id, fit: o.fit });
}

function updateFalling(g: Game, dt: number) {
  let anyDead = false;
  for (const o of g.objs) {
    const f = o.falling;
    if (!f || o.dead) continue;
    const h = g.holes[f.holeId];
    if (f.teeter > 0) {
      f.teeter -= dt;
      const creep = Math.min(1, dt * 2);
      o.x += (h.x - o.x) * creep;
      o.y += (h.y - o.y) * creep;
      continue;
    }
    // Slide toward the middle of the hole while dropping.
    const pull = Math.min(1, dt * (4 + 60 / (o.fit + 10)));
    o.x += (h.x - o.x) * pull;
    o.y += (h.y - o.y) * pull;
    f.vz += f.g * dt;
    f.depth += f.vz * dt;
    if (f.depth >= o.h + o.fit * 0.6 + 12) {
      o.dead = true;
      anyDead = true;
      consume(g, o, h);
    }
  }
  if (anyDead && g.objs.length > 400) {
    let deadCount = 0;
    for (const o of g.objs) if (o.dead) deadCount++;
    if (deadCount > 200) g.objs = g.objs.filter((o) => !o.dead);
  }
}

function consume(g: Game, o: Obj, h: Hole) {
  h.combo = g.time - h.lastEatT < 0.9 ? h.combo + 1 : 1;
  h.pulse = Math.min(1, h.pulse + 0.2 + o.fit / 120);
  h.lastEatT = g.time;
  h.mass += o.value;
  h.score += o.value;
  h.eatenCount++;
  g.eatenValue += o.value;
  g.events.push({ type: "eat", holeId: h.id, value: o.value, fit: o.fit, combo: h.combo, x: o.x, y: o.y });
  if (h.isPlayer && !g.demo) {
    g.floaters.push({
      x: h.x + (g.rand() - 0.5) * h.r,
      y: h.y,
      z: h.r * 0.4,
      text: `+${o.value}`,
      color: "#ffffff",
      life: 0.9,
      size: Math.min(2, 0.9 + o.value / 60),
    });
    if (g.floaters.length > 40) g.floaters.splice(0, g.floaters.length - 40);
    if (o.fit > 40) g.cam.shake = Math.max(g.cam.shake, Math.min(0.5, o.fit / 220));
  }
  if (o.fit > 22) burst(g, h.x, h.y, o.c1, Math.min(18, 4 + o.fit / 5), 1);
}

function burst(g: Game, x: number, y: number, color: string, count: number, power: number) {
  for (let i = 0; i < count; i++) {
    const a = g.rand() * Math.PI * 2;
    const s = (40 + g.rand() * 90) * power;
    g.particles.push({
      x,
      y,
      z: 6,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      vz: 120 + g.rand() * 160 * power,
      life: 0.9,
      max: 0.9,
      color,
      size: 3 + g.rand() * 4,
      kind: "bit",
    });
  }
  if (g.particles.length > 300) g.particles.splice(0, g.particles.length - 300);
}

function updateFx(g: Game, dt: number) {
  for (const p of g.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.kind === "bit") {
      p.vz -= 500 * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    } else {
      p.vx *= 1 - dt * 2;
      p.vy *= 1 - dt * 2;
    }
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const f of g.floaters) {
    f.life -= dt;
    f.z += dt * 60;
  }
  g.floaters = g.floaters.filter((f) => f.life > 0);
  for (const r of g.rings) r.t += dt;
  g.rings = g.rings.filter((r) => r.t < 0.8);
  g.cam.shake = Math.max(0, g.cam.shake - dt * 1.5);
}

function respawnSmall(g: Game, dt: number) {
  if (!MODES[g.mode].respawnSmall || g.phase !== "playing") return;
  g.respawnT -= dt;
  if (g.respawnT > 0) return;
  g.respawnT = 0.25;
  let alive = 0;
  for (const o of g.objs) if (!o.dead && isSmall(o)) alive++;
  if (alive < g.smallTarget * 0.7) {
    const o = spawnWalker(g.world, g.rand);
    // Keep fresh walkers out of view-blocking spots near holes.
    if (!g.holes.some((h) => Math.hypot(h.x - o.x, h.y - o.y) < h.r + 120)) {
      g.objs.push(o);
      g.totalValue += o.value;
    }
  }
}

function updateHint(g: Game, dt: number) {
  g.hintT -= dt;
  if (g.hintT > 0) return;
  g.hintT = 0.5;
  const p = g.player;
  if (!p.alive || g.demo) {
    g.hint = null;
    return;
  }
  let best: Obj | null = null;
  let bestD = Infinity;
  for (const o of g.objs) {
    if (o.dead || o.falling || !fits(o, p)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  // Only point the way when nothing edible is close by.
  g.hint = best && bestD > 420 + p.r * 2 ? { x: best.x, y: best.y } : null;
}

// ─── Camera ───────────────────────────────────────────────────────────────────

export function targetZoom(g: Game, viewW: number, viewH: number) {
  const p = g.player;
  const base = Math.sqrt(viewW * viewH);
  const lvl = Math.min(1, (p.level - 1) / 9);
  const screenR = base * (0.058 + 0.03 * lvl);
  return screenR / Math.max(BASE_R, p.r);
}

let viewDims = { w: 1200, h: 800 };
export function setViewSize(w: number, h: number) {
  viewDims = { w, h };
}

function updateCamera(g: Game, dt: number) {
  const target = g.player;
  // Stay locked on the hole so it never slides around the screen (that slide also fed
  // back into mouse steering and made the speed pump). Only glide for big jumps like respawns.
  const far = Math.hypot(target.x - g.cam.x, target.y - g.cam.y) > 200;
  const k = far ? Math.min(1, dt * 5) : 1;
  g.cam.x += (target.x - g.cam.x) * k;
  g.cam.y += (target.y - g.cam.y) * k;
  const z = g.demo ? targetZoom(g, viewDims.w, viewDims.h) * 0.7 : targetZoom(g, viewDims.w, viewDims.h);
  if (g.phase === "countdown" && !g.demo) {
    // Intro: start high over the city and swoop down onto your hole by "GO!".
    const t = Math.min(1, Math.max(0, 1 - (g.countdown - 0.4) / 2.6));
    const ease = t * t * (3 - 2 * t);
    g.cam.zoom = z * (0.32 + 0.68 * ease);
  } else {
    g.cam.zoom += (z - g.cam.zoom) * Math.min(1, dt * 2.5);
  }
  // Don't show much more than a strip of beach past the city edge.
  const size = g.world.size;
  const halfW = viewDims.w / 2 / g.cam.zoom;
  const halfH = viewDims.h / 2 / (g.cam.zoom * TILT);
  const edge = 140;
  g.cam.x = halfW * 2 > size + edge * 2 ? size / 2 : Math.max(halfW - edge, Math.min(size - halfW + edge, g.cam.x));
  g.cam.y = halfH * 2 > size + edge * 2 ? size / 2 : Math.max(halfH - edge, Math.min(size - halfH + edge, g.cam.y));
}
