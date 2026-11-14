// ─── Sneaky Eggs: simulation (no drawing, no DOM) ───────────────────────────

import {
  BIOME_COUNT,
  BIOME_H,
  BIOMES,
  CENTER_X,
  DELIVER_Y,
  DELIVERY_SECONDS,
  EGG_RESPAWN,
  FUSE_COUNT,
  GATE_W,
  GOLDEN_NEST_LUCK,
  GUARD_POST,
  GUARD_R,
  HOME_TOP,
  HUT,
  PAD_COUNT,
  PAD_Y,
  PEN,
  PETS,
  PICKUP_DIST,
  PLAYER_R,
  PLAYER_START,
  RARITIES,
  SELL_SECONDS,
  SHINY_CHANCE,
  TAP_BOOST,
  WORLD_H,
  WORLD_W,
  basketSize,
  biomeAt,
  biomeBottom,
  biomeTop,
  fmtCoins,
  guardSpeed,
  nestSpots,
  padX,
  penSize,
  petById,
  petFor,
  petRate,
  playerSpeed,
  rarityWeights,
  upgradeCost,
  type DecorKind,
  type PetDef,
  type Point,
  type Rarity,
  type SolidKind,
  type UpgradeId,
} from "./config";

/* ---------- Types ---------- */

export interface Input {
  x: number;
  y: number;
}

export interface EggInfo {
  biome: number;
  rarity: Rarity;
}

export interface Nest {
  biome: number;
  x: number;
  y: number;
  golden: boolean;
  egg: Rarity | null;
  respawn: number;
  /** Seconds since the egg appeared, for the pop-in. */
  age: number;
}

export type GuardState = "sleep" | "waking" | "chase" | "huff" | "return";

export interface Guard {
  biome: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  state: GuardState;
  t: number;
  flip: boolean;
  walkT: number;
}

export interface Pad {
  egg: EggInfo | null;
  left: number;
  total: number;
  wobble: number;
  reserved: boolean;
  blocked: boolean;
}

export interface Pet {
  uid: number;
  id: string;
  shiny: boolean;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  hop: number;
  flip: boolean;
  payT: number;
  age: number;
}

export interface Solid {
  x: number;
  y: number;
  r: number;
  kind: SolidKind;
  seed: number;
}

export interface Decor {
  x: number;
  y: number;
  kind: DecorKind;
  s: number;
  seed: number;
}

export interface Flight {
  egg: EggInfo;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  pad: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "dot" | "star";
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

export interface Upgrades {
  speed: number;
  pen: number;
  luck: number;
  basket: number;
}

export interface Player {
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  walkT: number;
  stun: number;
  kx: number;
  ky: number;
  carry: EggInfo[];
}

export interface Stats {
  eggs: number;
  caught: number;
  fused: number;
}

export type BlockReason = "gate" | "hands" | "pads" | "pen";

export type GameEvent =
  | { type: "pickup"; rarity: Rarity }
  | { type: "wake"; biome: number }
  | { type: "caught" }
  | { type: "deliver"; coins: number }
  | { type: "hatch"; petId: string; isNew: boolean; shiny: boolean; fused: boolean }
  | { type: "biome"; biome: number }
  | { type: "blocked"; reason: BlockReason; biome: number }
  | { type: "tap" }
  | { type: "complete" };

export interface Game {
  time: number;
  player: Player;
  nests: Nest[];
  guards: Guard[];
  pads: Pad[];
  pets: Pet[];
  solids: Solid[];
  decor: Decor[];
  flights: Flight[];
  particles: Particle[];
  popups: Popup[];
  coins: number;
  up: Upgrades;
  /** Pet id -> 1 (found) or 2 (found a shiny one). */
  book: Record<string, number>;
  stats: Stats;
  biome: number;
  events: GameEvent[];
  nextUid: number;
  hintAt: Record<string, number>;
  completeSent: boolean;
}

/** The part of a save file the engine owns. */
export interface SavedGame {
  coins: number;
  up: Upgrades;
  pets: { id: string; shiny?: boolean }[];
  book: Record<string, number>;
  pads: ({ biome: number; rarity: Rarity; left: number } | null)[];
  stats: Stats;
}

/* ---------- Helpers ---------- */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(luck: number): Rarity {
  const w = rarityWeights(luck);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i as Rarity;
  }
  return 0;
}

function emit(g: Game, ev: GameEvent) {
  g.events.push(ev);
}

/** Emit an event at most once every few seconds (for "you can't do that" nudges). */
function hint(g: Game, reason: BlockReason, biome = -1) {
  if (g.time - (g.hintAt[reason] ?? -99) < 2.6) return;
  g.hintAt[reason] = g.time;
  emit(g, { type: "blocked", reason, biome });
}

function burst(g: Game, x: number, y: number, color: string, n: number, kind: Particle["kind"] = "dot", speed = 150) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.65);
    const max = 0.45 + Math.random() * 0.4;
    g.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      life: max, max, color,
      size: kind === "star" ? rand(5, 9) : rand(3, 6),
      kind,
    });
  }
}

function popup(g: Game, x: number, y: number, text: string, color: string, big = false) {
  const max = big ? 1.5 : 1.1;
  g.popups.push({ x, y, text, color, life: max, max, big });
}

const penPoint = (): Point => ({
  x: rand(PEN.x0 + 34, PEN.x1 - 34),
  y: rand(PEN.y0 + 30, PEN.y1 - 16),
});

function makePet(g: Game, id: string, shiny: boolean, at?: Point): Pet {
  const spot = at ?? penPoint();
  const target = penPoint();
  return {
    uid: g.nextUid++,
    id, shiny,
    x: spot.x, y: spot.y,
    tx: at ? target.x : spot.x,
    ty: at ? target.y : spot.y,
    wait: at ? 0.5 : rand(0, 2.5),
    hop: Math.random() * 6,
    flip: Math.random() < 0.5,
    payT: rand(0.4, 3),
    age: at ? 0 : 9,
  };
}

/* ---------- World ---------- */

const SOLID_R: Record<SolidKind, number> = {
  tree: 26, bush: 20, palm: 22, rock: 22, pine: 24, snowpile: 22,
  lollipop: 18, gumdrop: 22, crystal: 20, moonrock: 24,
};

function buildWorld(): { solids: Solid[]; decor: Decor[] } {
  const solids: Solid[] = [];
  const decor: Decor[] = [];

  for (let i = 0; i < BIOME_COUNT; i++) {
    const rng = mulberry32(4201 + i * 977);
    const top = biomeTop(i);
    const keepClear: (Point & { r: number })[] = [
      { x: GUARD_POST.x, y: top + GUARD_POST.dy, r: 135 },
      ...nestSpots(i).map((n) => ({ x: n.x, y: n.y, r: 105 })),
    ];
    const mine: Solid[] = [];
    for (let tries = 0; tries < 400 && mine.length < 12; tries++) {
      const kind = BIOMES[i].solids[Math.floor(rng() * BIOMES[i].solids.length)];
      const r = SOLID_R[kind];
      const x = 46 + rng() * (WORLD_W - 92);
      const y = top + 76 + rng() * (BIOME_H - 152);
      // Keep the middle path wide open so little players never get snagged.
      if (Math.abs(x - CENTER_X) < 128 + r) continue;
      if (keepClear.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r)) continue;
      if (mine.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r + 44)) continue;
      mine.push({ x, y, r, kind, seed: rng() });
    }
    solids.push(...mine);

    for (let k = 0; k < 44; k++) {
      const kind = BIOMES[i].decor[Math.floor(rng() * BIOMES[i].decor.length)];
      decor.push({
        x: 20 + rng() * (WORLD_W - 40),
        y: top + 26 + rng() * (BIOME_H - 52),
        kind,
        s: 0.75 + rng() * 0.6,
        seed: rng(),
      });
    }
  }

  // Home: flowers around the edges, nothing solid but the hut.
  const rng = mulberry32(90210);
  for (let k = 0; k < 30; k++) {
    const x = 20 + rng() * (WORLD_W - 40);
    const y = HOME_TOP + 30 + rng() * (WORLD_H - HOME_TOP - 50);
    const inPen = x > PEN.x0 - 20 && x < PEN.x1 + 20 && y > PEN.y0 - 20 && y < PEN.y1 + 20;
    const onPads = Math.abs(y - PAD_Y) < 60 && Math.abs(x - CENTER_X) < 280;
    if (inPen || onPads) continue;
    decor.push({ x, y, kind: rng() < 0.6 ? "flower" : "tuft", s: 0.75 + rng() * 0.6, seed: rng() });
  }
  solids.push({ x: HUT.x, y: HUT.y, r: HUT.r, kind: "bush", seed: -1 });

  solids.sort((a, b) => a.y - b.y);
  return { solids, decor };
}

let WORLD: { solids: Solid[]; decor: Decor[] } | null = null;

/* ---------- Create / save ---------- */

export function createGame(saved?: SavedGame | null): Game {
  WORLD ??= buildWorld();
  const g: Game = {
    time: 0,
    player: {
      x: PLAYER_START.x, y: PLAYER_START.y,
      flip: false, moving: false, walkT: 0, stun: 0, kx: 0, ky: 0, carry: [],
    },
    nests: [],
    guards: [],
    pads: Array.from({ length: PAD_COUNT }, () => ({
      egg: null, left: 0, total: 1, wobble: 0, reserved: false, blocked: false,
    })),
    pets: [],
    solids: WORLD.solids,
    decor: WORLD.decor,
    flights: [],
    particles: [],
    popups: [],
    coins: 0,
    up: { speed: 0, pen: 0, luck: 0, basket: 0 },
    book: {},
    stats: { eggs: 0, caught: 0, fused: 0 },
    biome: -1,
    events: [],
    nextUid: 1,
    hintAt: {},
    completeSent: false,
  };

  if (saved) {
    g.coins = Math.max(0, Number(saved.coins) || 0);
    g.up = { ...g.up, ...saved.up };
    g.book = { ...saved.book };
    g.stats = { ...g.stats, ...saved.stats };
    for (const p of saved.pets ?? []) {
      if (petById(p.id)) g.pets.push(makePet(g, p.id, Boolean(p.shiny)));
    }
    (saved.pads ?? []).forEach((s, i) => {
      if (!s || i >= PAD_COUNT) return;
      const total = RARITIES[s.rarity].hatch;
      g.pads[i].egg = { biome: s.biome, rarity: s.rarity };
      g.pads[i].total = total;
      g.pads[i].left = clamp(s.left, 0, total);
    });
    g.completeSent = PETS.every((p) => g.book[p.id]);
  }

  for (let i = 0; i < BIOME_COUNT; i++) {
    const top = biomeTop(i);
    for (const spot of nestSpots(i)) {
      g.nests.push({
        biome: i,
        x: spot.x,
        y: spot.y,
        golden: spot.golden,
        // A brand-new player always finds friendly Common eggs first.
        egg: !saved && i === 0 && !spot.golden ? 0 : rollRarity(g.up.luck + (spot.golden ? GOLDEN_NEST_LUCK : 0)),
        respawn: 0,
        age: 9,
      });
    }
    g.guards.push({
      biome: i,
      x: GUARD_POST.x, y: top + GUARD_POST.dy,
      homeX: GUARD_POST.x, homeY: top + GUARD_POST.dy,
      state: "sleep", t: 0, flip: false, walkT: 0,
    });
  }
  return g;
}

export function toSave(g: Game): SavedGame {
  return {
    coins: Math.floor(g.coins),
    up: { ...g.up },
    pets: g.pets.map((p) => (p.shiny ? { id: p.id, shiny: true } : { id: p.id })),
    book: { ...g.book },
    pads: g.pads.map((p) =>
      p.egg ? { biome: p.egg.biome, rarity: p.egg.rarity, left: Math.max(0, p.left) } : null,
    ),
    stats: { ...g.stats },
  };
}

/* ---------- Queries ---------- */

export function totalRate(g: Game): number {
  let sum = 0;
  for (const p of g.pets) {
    const def = petById(p.id);
    if (def) sum += petRate(def, p.shiny);
  }
  return sum;
}

/** Coins per second for a saved pet list, for "while you were away" earnings. */
export function savedRate(saved: SavedGame): number {
  let sum = 0;
  for (const p of saved.pets ?? []) {
    const def = petById(p.id);
    if (def) sum += petRate(def, Boolean(p.shiny));
  }
  return sum;
}

export const bookCount = (book: Record<string, number>) =>
  PETS.reduce((n, p) => n + (book[p.id] ? 1 : 0), 0);

export const penIsFull = (g: Game) => g.pets.length >= penSize(g.up.pen);

export function countOf(g: Game, id: string): number {
  let n = 0;
  for (const p of g.pets) if (p.id === id) n++;
  return n;
}

export function canFuse(g: Game, id: string): boolean {
  const def = petById(id);
  return Boolean(def) && def!.rarity < 3 && countOf(g, id) >= FUSE_COUNT;
}

export const anyFusable = (g: Game) => PETS.some((p) => canFuse(g, p.id));

const freePads = (g: Game) => g.pads.filter((p) => !p.egg && !p.reserved).length;

/* ---------- Actions ---------- */

export function buy(g: Game, id: UpgradeId): boolean {
  const cost = upgradeCost(id, g.up[id]);
  if (cost === null || g.coins < cost) return false;
  g.coins -= cost;
  g.up[id] += 1;
  return true;
}

function register(g: Game, def: PetDef, shiny: boolean, fused: boolean) {
  const isNew = !g.book[def.id];
  g.book[def.id] = Math.max(g.book[def.id] ?? 0, shiny ? 2 : 1);
  emit(g, { type: "hatch", petId: def.id, isNew, shiny, fused });
  if (!g.completeSent && PETS.every((p) => g.book[p.id])) {
    g.completeSent = true;
    emit(g, { type: "complete" });
  }
}

/** Merge three of the same pet into one of the next rarity. */
export function fuse(g: Game, id: string): PetDef | null {
  const def = petById(id);
  if (!def || !canFuse(g, id)) return null;
  // Use shiny ones first so the sparkle carries over.
  const group = g.pets.filter((p) => p.id === id).sort((a, b) => Number(b.shiny) - Number(a.shiny));
  const used = group.slice(0, FUSE_COUNT);
  const shiny = used.some((p) => p.shiny);
  const at = {
    x: used.reduce((s, p) => s + p.x, 0) / used.length,
    y: used.reduce((s, p) => s + p.y, 0) / used.length,
  };
  g.pets = g.pets.filter((p) => !used.includes(p));
  const next = petFor(def.biome, (def.rarity + 1) as Rarity);
  const pet = makePet(g, next.id, shiny);
  pet.x = at.x;
  pet.y = at.y;
  pet.age = 0;
  g.pets.push(pet);
  g.stats.fused++;
  burst(g, at.x, at.y - 20, RARITIES[next.rarity].color, 22, "star", 220);
  register(g, next, shiny, true);
  return next;
}

/** Sell one pet of a kind (plain ones first). Returns the coins earned. */
export function sell(g: Game, id: string): number {
  const def = petById(id);
  if (!def) return 0;
  const group = g.pets.filter((p) => p.id === id).sort((a, b) => Number(a.shiny) - Number(b.shiny));
  const pet = group[0];
  if (!pet) return 0;
  g.pets = g.pets.filter((p) => p !== pet);
  const coins = Math.round(petRate(def, pet.shiny) * SELL_SECONDS);
  g.coins += coins;
  burst(g, pet.x, pet.y - 16, "#fbbf24", 10, "dot", 120);
  return coins;
}

/** A tap on the play field. Returns true when it hit a hatching egg. */
export function tapAt(g: Game, x: number, y: number): boolean {
  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i];
    if (!pad.egg) continue;
    if (Math.hypot(padX(i) - x, PAD_Y - 14 - y) > 50) continue;
    if (pad.blocked) {
      hint(g, "pen");
    } else {
      pad.left -= TAP_BOOST;
      emit(g, { type: "tap" });
    }
    pad.wobble = 1;
    burst(g, padX(i), PAD_Y - 22, "#ffffff", 4, "dot", 90);
    return true;
  }
  return false;
}

/* ---------- Step ---------- */

function pushOut(p: Point, cx: number, cy: number, r: number): boolean {
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 0.001) {
    p.y = cy + r;
    return true;
  }
  p.x = cx + (dx / d) * r;
  p.y = cy + (dy / d) * r;
  return true;
}

function movePlayer(g: Game, dt: number, input: Input) {
  const p = g.player;
  p.stun = Math.max(0, p.stun - dt);

  let mx = input.x;
  let my = input.y;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  const sp = playerSpeed(g.up.speed);
  let vx = 0;
  let vy = 0;
  if (p.stun <= 0 && mag > 0.08) {
    vx = mx * sp;
    vy = my * sp;
    p.moving = true;
    if (Math.abs(mx) > 0.15) p.flip = mx < 0;
    p.walkT += dt * (sp / 190) * Math.min(1, mag);
  } else {
    p.moving = false;
  }
  vx += p.kx;
  vy += p.ky;
  const decay = Math.exp(-5.5 * dt);
  p.kx *= decay;
  p.ky *= decay;

  const prevX = p.x;
  const prevY = p.y;
  const next: Point = {
    x: clamp(p.x + vx * dt, PLAYER_R + 16, WORLD_W - PLAYER_R - 16),
    y: clamp(p.y + vy * dt, PLAYER_R + 20, WORLD_H - PLAYER_R - 16),
  };

  for (const s of g.solids) {
    if (Math.abs(s.y - next.y) > 110) continue;
    pushOut(next, s.x, s.y, s.r + PLAYER_R);
  }
  for (const gd of g.guards) {
    if (gd.state === "sleep") pushOut(next, gd.x, gd.y, GUARD_R + PLAYER_R);
  }

  // Fences between areas, each with one gate in the middle.
  const half = GATE_W / 2 - PLAYER_R;
  for (let i = 0; i < BIOME_COUNT; i++) {
    const line = biomeBottom(i);
    const open = g.up.speed >= BIOMES[i].speedReq;
    if (open && Math.abs(prevY - line) < PLAYER_R && Math.abs(prevX - CENTER_X) <= half + 0.01) {
      // Standing in the gateway: the posts keep you between them.
      next.x = clamp(next.x, CENTER_X - half, CENTER_X + half);
      continue;
    }
    const touches = (prevY - line) * (next.y - line) <= 0 || Math.abs(next.y - line) < PLAYER_R;
    if (!touches) continue;
    const inGap = Math.abs(next.x - CENTER_X) < half;
    if (inGap && open) continue;
    next.y = prevY >= line ? Math.max(next.y, line + PLAYER_R) : Math.min(next.y, line - PLAYER_R);
    if (inGap && !open && vy < 0) hint(g, "gate", i);
  }

  p.x = next.x;
  p.y = next.y;

  const here = biomeAt(p.y);
  if (here !== g.biome) {
    g.biome = here;
    emit(g, { type: "biome", biome: here });
  }
}

function tryPickup(g: Game) {
  const p = g.player;
  if (p.stun > 0 || g.biome < 0) return;
  for (const n of g.nests) {
    if (n.egg === null || n.biome !== g.biome || n.age < 0.25) continue;
    if (dist(p, n) > PICKUP_DIST) continue;
    if (p.carry.length >= basketSize(g.up.basket)) {
      hint(g, "hands");
      continue;
    }
    if (freePads(g) <= p.carry.length) {
      hint(g, "pads");
      continue;
    }
    p.carry.push({ biome: n.biome, rarity: n.egg });
    emit(g, { type: "pickup", rarity: n.egg });
    burst(g, n.x, n.y - 14, RARITIES[n.egg].color, 8, "star", 130);
    n.egg = null;
    n.respawn = EGG_RESPAWN;

    const gd = g.guards[n.biome];
    if (gd.state !== "chase" && gd.state !== "waking") {
      const wake = BIOMES[n.biome].wake;
      gd.t = gd.state === "sleep" ? wake : wake * 0.5;
      gd.state = "waking";
      emit(g, { type: "wake", biome: n.biome });
    }
  }
}

function walkToward(gd: Guard, x: number, y: number, speed: number, dt: number): number {
  const dx = x - gd.x;
  const dy = y - gd.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return 0;
  const stepLen = Math.min(d, speed * dt);
  gd.x += (dx / d) * stepLen;
  gd.y += (dy / d) * stepLen;
  if (Math.abs(dx) > 4) gd.flip = dx < 0;
  gd.walkT += dt * (speed / 150);
  return d - stepLen;
}

function updateGuard(g: Game, gd: Guard, dt: number) {
  const p = g.player;
  const here = g.biome === gd.biome;
  const hasEgg = p.carry.length > 0;

  switch (gd.state) {
    case "sleep":
      return;
    case "waking":
      gd.t -= dt;
      if (gd.t <= 0) gd.state = here && hasEgg ? "chase" : "return";
      return;
    case "chase": {
      if (!here || !hasEgg) {
        gd.state = "huff";
        gd.t = 0.6;
        return;
      }
      walkToward(gd, p.x, p.y, guardSpeed(gd.biome), dt);
      const top = biomeTop(gd.biome);
      gd.x = clamp(gd.x, GUARD_R + 10, WORLD_W - GUARD_R - 10);
      gd.y = clamp(gd.y, top + GUARD_R + 10, top + BIOME_H - GUARD_R - 14);
      if (p.stun <= 0 && dist(gd, p) < GUARD_R + PLAYER_R - 4) caught(g, gd);
      return;
    }
    case "huff":
      gd.t -= dt;
      if (gd.t <= 0) gd.state = "return";
      return;
    case "return":
      if (walkToward(gd, gd.homeX, gd.homeY, guardSpeed(gd.biome) * 0.8, dt) < 1) {
        gd.x = gd.homeX;
        gd.y = gd.homeY;
        gd.state = "sleep";
        // If the player is standing on the bed, nudge them off it.
        pushOut(p, gd.x, gd.y, GUARD_R + PLAYER_R);
      }
      return;
  }
}

function caught(g: Game, gd: Guard) {
  const p = g.player;
  const dx = p.x - gd.x;
  const dy = p.y - gd.y;
  const d = Math.hypot(dx, dy) || 1;
  p.kx = (dx / d) * 430;
  p.ky = (dy / d) * 430;
  p.stun = 0.9;
  for (const egg of p.carry) burst(g, p.x, p.y - 40, RARITIES[egg.rarity].color, 8, "dot", 160);
  p.carry = [];
  burst(g, p.x, p.y - 30, "#fde047", 10, "star", 170);
  popup(g, p.x, p.y - 70, "Oops!", "#ef4444", true);
  // The eggs roll back to their nests.
  for (const n of g.nests) {
    if (n.biome === gd.biome && n.egg === null) n.respawn = Math.min(n.respawn, 0.9);
  }
  gd.state = "huff";
  gd.t = 0.8;
  g.stats.caught++;
  emit(g, { type: "caught" });
}

function deliver(g: Game) {
  const p = g.player;
  if (!p.carry.length || p.y < DELIVER_Y) return;
  const left: EggInfo[] = [];
  p.carry.forEach((egg, k) => {
    const idx = g.pads.findIndex((pad) => !pad.egg && !pad.reserved);
    if (idx < 0) {
      left.push(egg);
      return;
    }
    g.pads[idx].reserved = true;
    g.flights.push({
      egg,
      x0: p.x, y0: p.y - 52 - k * 20,
      x1: padX(idx), y1: PAD_Y - 14,
      t: -k * 0.12,
      dur: 0.5,
      pad: idx,
    });
  });
  p.carry = left;
}

function updateFlights(g: Game, dt: number) {
  for (let i = g.flights.length - 1; i >= 0; i--) {
    const f = g.flights[i];
    f.t += dt;
    if (f.t < f.dur) continue;
    g.flights.splice(i, 1);
    const pad = g.pads[f.pad];
    const total = RARITIES[f.egg.rarity].hatch;
    pad.egg = f.egg;
    pad.total = total;
    pad.left = total;
    pad.reserved = false;
    pad.blocked = false;
    pad.wobble = 1;
    const def = petFor(f.egg.biome, f.egg.rarity);
    const coins = Math.round(petRate(def) * DELIVERY_SECONDS);
    g.coins += coins;
    g.stats.eggs++;
    popup(g, f.x1, f.y1 - 44, `+${fmtCoins(coins)}`, "#f59e0b", true);
    burst(g, f.x1, f.y1, "#fde68a", 8, "dot", 110);
    emit(g, { type: "deliver", coins });
  }
}

function hatch(g: Game, i: number) {
  const pad = g.pads[i];
  if (!pad.egg) return;
  const def = petFor(pad.egg.biome, pad.egg.rarity);
  const shiny = Math.random() < SHINY_CHANCE;
  const at = { x: padX(i), y: PAD_Y };
  g.pets.push(makePet(g, def.id, shiny, at));
  const info = RARITIES[def.rarity];
  burst(g, at.x, at.y - 24, BIOMES[def.biome].egg.base, 10, "dot", 190);
  burst(g, at.x, at.y - 24, info.color, 8 + def.rarity * 6, "star", 200 + def.rarity * 30);
  pad.egg = null;
  pad.blocked = false;
  register(g, def, shiny, false);
}

function updatePads(g: Game, dt: number) {
  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i];
    pad.wobble = Math.max(0, pad.wobble - dt * 3);
    if (!pad.egg) continue;
    if (pad.left > 0) pad.left -= dt;
    if (pad.left > 0) continue;
    if (penIsFull(g)) {
      if (!pad.blocked) {
        pad.blocked = true;
        hint(g, "pen");
      }
      continue;
    }
    hatch(g, i);
  }
}

function updatePets(g: Game, dt: number) {
  const nearHome = g.player.y > HOME_TOP - 420;
  let rate = 0;
  for (const pet of g.pets) {
    const def = petById(pet.id);
    if (!def) continue;
    const r = petRate(def, pet.shiny);
    rate += r;
    pet.age += dt;

    if (pet.wait > 0) {
      pet.wait -= dt;
      if (pet.wait <= 0) {
        const t = penPoint();
        pet.tx = t.x;
        pet.ty = t.y;
      }
    } else {
      const dx = pet.tx - pet.x;
      const dy = pet.ty - pet.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        pet.wait = rand(0.8, 3.4);
      } else {
        const stepLen = Math.min(d, 52 * dt);
        pet.x += (dx / d) * stepLen;
        pet.y += (dy / d) * stepLen;
        if (Math.abs(dx) > 2) pet.flip = dx < 0;
        pet.hop += dt * 10;
      }
    }

    pet.payT -= dt;
    if (pet.payT <= 0) {
      pet.payT += 3;
      if (nearHome) popup(g, pet.x, pet.y - 46, `+${fmtCoins(r * 3)}`, "#d97706");
    }
  }
  g.coins += rate * dt;
}

function updateNests(g: Game, dt: number) {
  for (const n of g.nests) {
    n.age += dt;
    if (n.egg !== null) continue;
    n.respawn -= dt;
    if (n.respawn <= 0) {
      n.egg = rollRarity(g.up.luck + (n.golden ? GOLDEN_NEST_LUCK : 0));
      n.age = 0;
    }
  }
}

function updateFx(g: Game, dt: number) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.vx *= 1 - 1.8 * dt;
  }
  for (let i = g.popups.length - 1; i >= 0; i--) {
    const p = g.popups[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.popups.splice(i, 1);
      continue;
    }
    p.y -= (p.big ? 46 : 30) * dt;
  }
  if (g.popups.length > 60) g.popups.splice(0, g.popups.length - 60);
}

export function step(g: Game, dt: number, input: Input) {
  g.time += dt;
  movePlayer(g, dt, input);
  tryPickup(g);
  for (const gd of g.guards) updateGuard(g, gd, dt);
  deliver(g);
  updateFlights(g, dt);
  updatePads(g, dt);
  updatePets(g, dt);
  updateNests(g, dt);
  updateFx(g, dt);
}
