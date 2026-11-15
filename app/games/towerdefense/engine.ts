// ─── Tower Defense: simulation (pure, framework-free) ─────────────────────────
//
// Everything is in "cell units": (x, y) = (col, row) of a cell's centre.
// Ground enemies follow a flow field (distance-to-castle per cell), so players
// can build mazes at any time and every enemy re-routes on its next step.
// Each map adds terrain on top of that: water and rocks shape the walkable
// space, roads can't be built on, hilltops stretch a tower's range, rocks hide
// enemies from towers that need a line of sight, and rubble can be bought out
// of the way.

import {
  ABILITIES,
  ALARM_HASTE,
  COLS,
  DIFFICULTIES,
  ENEMIES,
  HEAL_AURA_RANGE,
  HILL_RANGE_BONUS,
  MAX_HASTE,
  MIN_ARMOR_DAMAGE,
  ROWS,
  SELL_REFUND,
  TERRAIN,
  TESLA_FALLOFF,
  TESLA_JUMP_RANGE,
  TOTAL_WAVES,
  TOWERS,
  earlyCallBonus,
  meteorDamage,
  parseMap,
  waveClearBonus,
  waveDef,
  type Cell,
  type Difficulty,
  type EnemyType,
  type EntryDef,
  type MapDef,
  type MapEventDef,
  type Targeting,
  type Terrain,
  type TowerLevel,
  type TowerType,
} from "./config";

export type Phase = "build" | "wave" | "gameover" | "win";
export type Level = 0 | 1 | 2;

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  /** Cell the enemy is walking toward. */
  nr: number;
  nc: number;
  /** Last cell centre reached (off the board while still walking in). */
  cr: number;
  cc: number;
  dirX: number;
  dirY: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  armor: number;
  slowUntil: number;
  slowFactor: number;
  hitFlash: number;
  /** Random phase so enemies don't bounce in lock-step. */
  seed: number;
  /** Flyers ignore the maze and head straight for (tx, ty). */
  flying: boolean;
  tx: number;
  ty: number;
  /** Wave-scaled base stats, kept so a splitter can size its children. */
  baseHp: number;
  baseSpeed: number;
  baseReward: number;
  /** Shades: true while a Beacon's light is on them. */
  revealed: boolean;
  burnUntil: number;
  burnDps: number;
  /** Frozen solid until this time, and can't be frozen again until the second. */
  stunUntil: number;
  stunImmuneUntil: number;
  /** Countdown to the next jam pulse / escort spawn. */
  abilityTimer: number;
  /** Speed multiplier that grows each time the maze is opened up mid-wave. */
  haste: number;
  /** Game time it appeared (for the pop out of the portal). */
  born: number;
}

export interface Tower {
  id: number;
  r: number;
  c: number;
  type: TowerType;
  level: Level;
  cooldown: number;
  angle: number;
  recoil: number; // 0..1, decays after each shot
  flash: number; // muzzle flash timer
  spent: number;
  targeting: Targeting;
  /** Built on a hilltop (extra range). */
  onHill: boolean;
  /** Nothing in range can block this tower's view, so sight checks are skipped. */
  clearView: boolean;
  /** Final form chosen at level 3 (index into the tower's `specs`). */
  spec: 0 | 1 | null;
  /** Switched off by a Jinx until this time. */
  jamUntil: number;
  /** Bonuses from Beacons in reach (0.2 = +20%). */
  buffRate: number;
  buffRange: number;
  /** Inside a Lighthouse: can't be jammed. */
  shielded: boolean;
  /** Waves started when this was built (mines pay from the wave after). */
  builtWave: number;
  /** Game time it was built, and last upgraded (for the pop-in and the cheer). */
  born: number;
  pulse: number;
}

export interface Projectile {
  id: number;
  kind: "blaster" | "frost" | "bomb";
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  targetId: number;
  speed: number;
  /** For lobbed bombs: progress 0..1 and total flight seconds. */
  t: number;
  flight: number;
  height: number;
  stats: TowerLevel;
  level: Level;
  trail: { x: number; y: number }[];
}

export interface Bolt {
  kind: "sniper" | "tesla";
  pts: { x: number; y: number }[];
  life: number;
  maxLife: number;
  level: Level;
}

export type ParticleKind = "spark" | "smoke" | "ring" | "shard" | "text" | "blob" | "coin" | "star" | "puff";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  text?: string;
}

export type Sfx =
  | "blaster"
  | "sniper"
  | "bomb"
  | "boom"
  | "frost"
  | "tesla"
  | "pop"
  | "leak"
  | "place"
  | "upgrade"
  | "sell"
  | "clear"
  | "portal"
  | "jam"
  | "meteor"
  | "freeze"
  | "event"
  | "spec"
  | "coin"
  | "error"
  | "waveStart"
  | "waveClear"
  | "lose"
  | "win";

export interface Banner {
  text: string;
  sub?: string;
  /** A heads-up about what's coming, shown on its own line. */
  note?: string;
  life: number;
  maxLife: number;
}

export interface SpawnEntry {
  type: EnemyType;
  wave: number; // 0-based wave index the enemy belongs to
  delay: number;
  /** Index into `game.entries` of the portal it comes out of. */
  entry: number;
}

export interface Route {
  /** Index into `game.entries`. */
  entry: number;
  cells: Cell[];
  /** False while the portal is still shut (drawn as a faint preview). */
  open: boolean;
}

/** A meteor on its way down. */
export interface Strike {
  x: number;
  y: number;
  /** Seconds until it lands, and the full fall time. */
  t: number;
  total: number;
}

export interface Game {
  map: MapDef;
  difficulty: Difficulty;
  phase: Phase;
  time: number;
  /** Live terrain: starts as the map's and changes when rubble is cleared. */
  terrain: Terrain[][];
  entries: EntryDef[];
  exits: Cell[];
  /** Cells ground enemies can't walk through (terrain or a tower). */
  blocked: boolean[][];
  /** Cells that block a tower's line of sight. */
  opaque: boolean[][];
  dist: number[][];
  /** One walking route per portal (for drawing). */
  routes: Route[];
  routeVersion: number;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  bolts: Bolt[];
  particles: Particle[];
  gold: number;
  lives: number;
  maxLives: number;
  /** Number of waves started so far (next wave index). */
  wave: number;
  /** Playing on past the last scripted wave. */
  endless: boolean;
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  /** Rotates which portal the next enemy comes out of. */
  spawnTurn: number;
  /** Enemy types the player has already met this game. */
  seen: EnemyType[];
  /** Map changes still to come, soonest first. */
  events: MapEventDef[];
  /** Seconds until each ability is ready again. */
  cooldowns: { meteor: number; freeze: number };
  strikes: Strike[];
  /** Kill-gold bonus from a Bounty Board (0.3 = +30%). */
  bounty: number;
  /** Fades out after a Cold Snap (for the screen tint). */
  frost: number;
  shake: number;
  /** Game time an enemy last reached a castle (the castle flinches). */
  hurtAt: number;
  banner: Banner | null;
  sfx: Sfx[];
  nextId: number;
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

const inBounds = (r: number, c: number) =>
  r >= 0 && r < ROWS && c >= 0 && c < COLS;

// ─── Path finding (flow field) ────────────────────────────────────────────────

export function computeDist(blocked: boolean[][], exits: Cell[]): number[][] {
  const dist = Array.from({ length: ROWS }, () =>
    Array<number>(COLS).fill(Infinity),
  );
  const q: [number, number][] = [];
  for (const e of exits) {
    dist[e.r][e.c] = 0;
    q.push([e.r, e.c]);
  }
  for (let h = 0; h < q.length; h++) {
    const [r, c] = q[h];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || blocked[nr][nc]) continue;
      if (dist[nr][nc] !== Infinity) continue;
      dist[nr][nc] = dist[r][c] + 1;
      q.push([nr, nc]);
    }
  }
  return dist;
}

/** Pick the next cell downhill in the flow field, preferring to go straight. */
function nextCell(
  dist: number[][],
  r: number,
  c: number,
  dr: number,
  dc: number,
): [number, number] {
  let best: [number, number] | null = null;
  let bestScore = Infinity;
  for (const [ddr, ddc] of DIRS) {
    const nr = r + ddr;
    const nc = c + ddc;
    if (!inBounds(nr, nc)) continue;
    const d = dist[nr][nc];
    if (d === Infinity) continue;
    // Tie-break toward the current heading so routes look natural.
    const score = d - (ddr === dr && ddc === dc ? 0.1 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = [nr, nc];
    }
  }
  return best ?? [r, c];
}

function traceRoute(dist: number[][], entry: EntryDef): Cell[] {
  const route: Cell[] = [];
  if (dist[entry.r][entry.c] === Infinity) return route;
  let r = entry.r;
  let c = entry.c;
  let dr = entry.dr;
  let dc = entry.dc;
  route.push({ r, c });
  for (let guard = 0; guard < ROWS * COLS && dist[r][c] > 0; guard++) {
    const [nr, nc] = nextCell(dist, r, c, dr, dc);
    if (nr === r && nc === c) break;
    dr = nr - r;
    dc = nc - c;
    r = nr;
    c = nc;
    route.push({ r, c });
  }
  return route;
}

/** Portals that send enemies in the given (1-based) wave. */
const openEntries = (g: Game, waveNumber: number) =>
  g.entries.map((_, i) => i).filter((i) => g.entries[i].fromWave <= waveNumber);

function refreshRoute(g: Game) {
  g.dist = computeDist(g.blocked, g.exits);
  // A portal shows as open as soon as the *next* wave will use it.
  g.routes = g.entries.map((entry, i) => ({
    entry: i,
    cells: traceRoute(g.dist, entry),
    open: entry.fromWave <= g.wave + 1,
  }));
  g.routeVersion++;
}

// ─── Line of sight ────────────────────────────────────────────────────────────

/** True when nothing tall sits between two points. */
export function hasSight(g: Game, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) / 0.12);
  for (let i = 1; i < n; i++) {
    const r = Math.round(y0 + (dy * i) / n);
    const c = Math.round(x0 + (dx * i) / n);
    if (g.opaque[r]?.[c]) return false;
  }
  return true;
}

function viewIsClear(g: Game, r: number, c: number, range: number): boolean {
  const reach = Math.ceil(range) + 1;
  for (let rr = r - reach; rr <= r + reach; rr++) {
    for (let cc = c - reach; cc <= c + reach; cc++) {
      if (g.opaque[rr]?.[cc]) return false;
    }
  }
  return true;
}

/**
 * Outline of what a tower at (cx, cy) can actually hit, as points in cell
 * units. Towers that fire over obstacles (or have nothing in the way) get a
 * plain circle; the rest get the circle with rock shadows cut out of it.
 */
export function coverageOutline(
  g: Game,
  cx: number,
  cy: number,
  range: number,
  needsSight: boolean,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const clear = !needsSight || viewIsClear(g, Math.round(cy), Math.round(cx), range);
  const rays = clear ? 72 : 180;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let d = range;
    if (!clear) {
      for (let t = 0.1; t < range; t += 0.1) {
        if (g.opaque[Math.round(cy + uy * t)]?.[Math.round(cx + ux * t)]) {
          d = Math.max(0, t - 0.1);
          break;
        }
      }
    }
    pts.push({ x: cx + ux * d, y: cy + uy * d });
  }
  return pts;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function createGame(map: MapDef, difficulty: Difficulty): Game {
  const parsed = parseMap(map);
  const diff = DIFFICULTIES[difficulty];
  const g: Game = {
    map,
    difficulty,
    phase: "build",
    time: 0,
    terrain: parsed.terrain,
    entries: parsed.entries,
    exits: parsed.exits,
    blocked: parsed.terrain.map((row) => row.map((t) => !TERRAIN[t].walk)),
    opaque: parsed.terrain.map((row) => row.map((t) => TERRAIN[t].blocksSight)),
    dist: [],
    routes: [],
    routeVersion: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    bolts: [],
    particles: [],
    gold: Math.round((map.startGold * diff.gold) / 5) * 5,
    lives: diff.lives,
    maxLives: diff.lives,
    wave: 0,
    endless: false,
    spawnQueue: [],
    spawnTimer: 0,
    spawnTurn: 0,
    seen: [],
    events: [...(map.events ?? [])].sort((a, b) => a.wave - b.wave),
    cooldowns: { meteor: 0, freeze: 0 },
    strikes: [],
    bounty: 0,
    frost: 0,
    shake: 0,
    hurtAt: -99,
    banner: null,
    sfx: [],
    nextId: 1,
  };
  refreshRoute(g);
  return g;
}

export const towerStats = (t: Pick<Tower, "type" | "level"> & { spec?: 0 | 1 | null }): TowerLevel =>
  t.spec != null ? TOWERS[t.type].specs[t.spec] : TOWERS[t.type].levels[t.level];

/** Best Beacon bonuses reaching a cell. Bonuses from several Beacons don't add up. */
export function auraAt(g: Game, r: number, c: number): { rate: number; range: number; shield: boolean } {
  const out = { rate: 0, range: 0, shield: false };
  for (const b of g.towers) {
    const aura = towerStats(b).aura;
    if (!aura || (b.r === r && b.c === c)) continue;
    if (Math.hypot(b.c - c, b.r - r) > towerRange(b) + 0.01) continue;
    out.rate = Math.max(out.rate, aura.rate);
    out.range = Math.max(out.range, aura.range);
    out.shield = out.shield || !!aura.shield;
  }
  return out;
}

/** Range of a new level-1 tower on the given cell (hilltops and Beacons add reach). */
export function rangeAt(g: Game, type: TowerType, level: Level, r: number, c: number) {
  const base = TOWERS[type].levels[level].range * (g.terrain[r]?.[c] === "hill" ? HILL_RANGE_BONUS : 1);
  return TOWERS[type].role === "attack" ? base * (1 + auraAt(g, r, c).range) : base;
}

export const towerRange = (t: Tower) =>
  towerStats(t).range * (t.onHill ? HILL_RANGE_BONUS : 1) * (1 + t.buffRange);

/** Whether rocks get in this tower's way. */
export const needsSight = (t: Pick<Tower, "type" | "level" | "spec">) =>
  TOWERS[t.type].needsSight && !towerStats(t).overRocks;

export const upgradeCost = (t: Tower): number | null =>
  t.level < 2 ? TOWERS[t.type].levels[t.level + 1].cost : null;

/** True once a tower is at level 3 and hasn't picked its final form yet. */
export const canSpecialize = (t: Tower) => t.level === 2 && t.spec === null;

/** Gold a Gold Mine pays each wave. */
export const mineIncome = (g: Game) => g.towers.reduce((sum, t) => sum + (towerStats(t).income ?? 0), 0);

export const sellValue = (t: Tower) => Math.floor(t.spent * SELL_REFUND);

export const towerAt = (g: Game, r: number, c: number) =>
  g.towers.find((t) => t.r === r && t.c === c) ?? null;

export const isGate = (g: Game, r: number, c: number) =>
  g.entries.some((e) => e.r === r && e.c === c) || g.exits.some((e) => e.r === r && e.c === c);

const updateView = (g: Game, t: Tower) => {
  t.clearView = !needsSight(t) || viewIsClear(g, t.r, t.c, towerRange(t));
};

/** Re-work every tower's Beacon bonuses. Call after anything is built, sold or upgraded. */
function refreshAuras(g: Game) {
  // Beacons first: their reach decides everything else.
  for (const t of g.towers) {
    if (TOWERS[t.type].role === "attack") continue;
    t.buffRate = 0;
    t.buffRange = 0;
  }
  let bounty = 0;
  for (const t of g.towers) {
    const aura = auraAt(g, t.r, t.c);
    t.shielded = aura.shield || !!towerStats(t).aura?.shield;
    if (TOWERS[t.type].role === "attack") {
      t.buffRate = aura.rate;
      t.buffRange = aura.range;
    }
    bounty = Math.max(bounty, towerStats(t).bounty ?? 0);
    updateView(g, t);
  }
  g.bounty = bounty;
}

// ─── Scheduled map changes ────────────────────────────────────────────────────

/**
 * Would every portal still have a way through after each change still to
 * come? `extra` is a tower the player is thinking of adding. Returns the
 * event that would cut the path, or null when all is well.
 */
function futureBlock(g: Game, extra: Cell | null): MapEventDef | null {
  if (!g.events.length) return null;
  const terrain = g.terrain.map((row) => row.slice());
  for (const ev of g.events) {
    for (const cell of ev.cells) terrain[cell.r][cell.c] = ev.to;
    const blocked = terrain.map((row) => row.map((t) => !TERRAIN[t].walk));
    // Towers standing on tiles that stop being buildable will be gone by then.
    for (const t of g.towers) if (TERRAIN[terrain[t.r][t.c]].build) blocked[t.r][t.c] = true;
    if (extra && TERRAIN[terrain[extra.r][extra.c]].build) blocked[extra.r][extra.c] = true;
    const dist = computeDist(blocked, g.exits);
    if (g.entries.some((entry) => dist[entry.r][entry.c] === Infinity)) return ev;
  }
  return null;
}

function applyEvent(g: Game, ev: MapEventDef) {
  const to = TERRAIN[ev.to];
  let refund = 0;
  for (const { r, c } of ev.cells) {
    g.terrain[r][c] = ev.to;
    g.blocked[r][c] = !to.walk;
    g.opaque[r][c] = to.blocksSight;
    const idx = g.towers.findIndex((t) => t.r === r && t.c === c);
    if (idx !== -1) {
      if (to.build) {
        g.blocked[r][c] = true;
      } else {
        // Lost to the map, not to a mistake: the player gets everything back.
        refund += g.towers[idx].spent;
        floatText(g, c, r - 0.2, `+${g.towers[idx].spent}`, "#fde047");
        g.towers.splice(idx, 1);
      }
    }
    if (ev.kind === "flood") {
      g.particles.push(ring(c, r, "#bae6fd", 0.7, 0.5));
      burst(g, c, r, 3, "#e0f2fe", 0.07, 2.4, "blob");
    } else {
      burst(g, c, r, 12, "#a8a29e", 0.1, 3.6, "shard");
      burst(g, c, r, 8, "#d6d3d1", 0.16, 1.6, "smoke");
    }
  }
  g.gold += refund;
  refreshAuras(g);
  refreshRoute(g);

  // Anyone whose next step just vanished turns back, or is swept away if
  // there's nowhere left to stand.
  g.enemies = g.enemies.filter((e) => {
    if (e.flying || g.dist[e.nr]?.[e.nc] !== Infinity) return true;
    if (g.dist[e.cr]?.[e.cc] !== undefined && g.dist[e.cr][e.cc] !== Infinity) {
      const { nr, nc } = e;
      e.nr = e.cr;
      e.nc = e.cc;
      e.cr = nr;
      e.cc = nc;
      return true;
    }
    burst(g, e.x, e.y, 8, "#e0f2fe", 0.08, 2.5, "blob");
    return false;
  });
  g.shake = Math.max(g.shake, 0.3);
  g.sfx.push("event");
}

/** The next change the battlefield has in store, if any. */
export const nextEvent = (g: Game): MapEventDef | null => g.events[0] ?? null;

// ─── Player actions ───────────────────────────────────────────────────────────

export type PlaceResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canPlace(
  g: Game,
  type: TowerType,
  r: number,
  c: number,
): PlaceResult {
  if (g.phase === "gameover" || g.phase === "win")
    return { ok: false, reason: "Game over" };
  if (!inBounds(r, c)) return { ok: false, reason: "Off the map" };
  if (isGate(g, r, c)) return { ok: false, reason: "Can't build on the gates" };
  const terrain = TERRAIN[g.terrain[r][c]];
  if (!terrain.build) return { ok: false, reason: terrain.noBuild };
  if (g.blocked[r][c]) return { ok: false, reason: "Spot taken" };
  const limit = TOWERS[type].limit;
  if (limit && g.towers.filter((t) => t.type === type).length >= limit)
    return { ok: false, reason: `Only ${limit} ${TOWERS[type].name}s allowed` };
  if (g.gold < TOWERS[type].levels[0].cost)
    return { ok: false, reason: "Not enough gold" };
  for (const e of g.enemies) {
    if (e.flying) continue;
    const onCell =
      (e.nr === r && e.nc === c) ||
      (e.cr === r && e.cc === c) ||
      (Math.round(e.y) === r && Math.round(e.x) === c);
    if (onCell) return { ok: false, reason: "An enemy is in the way" };
  }
  g.blocked[r][c] = true;
  const dist = computeDist(g.blocked, g.exits);
  g.blocked[r][c] = false;
  // Every portal needs a way through, even the ones that haven't opened yet.
  for (const entry of g.entries) {
    if (dist[entry.r][entry.c] === Infinity)
      return { ok: false, reason: "That would block the path!" };
  }
  for (const e of g.enemies) {
    if (!e.flying && dist[e.nr][e.nc] === Infinity)
      return { ok: false, reason: "That would trap an enemy!" };
  }
  const cut = futureBlock(g, { r, c });
  if (cut)
    return {
      ok: false,
      reason: `The ${cut.kind === "flood" ? "flood" : "rockslide"} on wave ${cut.wave} would cut the path!`,
    };
  return { ok: true };
}

export function placeTower(
  g: Game,
  type: TowerType,
  r: number,
  c: number,
): PlaceResult {
  const check = canPlace(g, type, r, c);
  if (!check.ok) {
    g.sfx.push("error");
    return check;
  }
  const cost = TOWERS[type].levels[0].cost;
  g.gold -= cost;
  g.blocked[r][c] = true;
  const tower: Tower = {
    id: g.nextId++,
    r,
    c,
    type,
    level: 0,
    cooldown: 0.2,
    angle: -Math.PI / 2,
    recoil: 0,
    flash: 0,
    spent: cost,
    targeting: "first",
    onHill: g.terrain[r][c] === "hill",
    clearView: true,
    spec: null,
    jamUntil: 0,
    buffRate: 0,
    buffRange: 0,
    shielded: false,
    builtWave: g.wave,
    born: g.time,
    pulse: -99,
  };
  g.towers.push(tower);
  refreshAuras(g);
  refreshRoute(g);
  burst(g, c, r, 10, "#e7d6b0", 0.05, 2.2, "smoke");
  if (tower.onHill) floatText(g, c, r - 0.3, "+25% range", "#bbf7d0");
  g.sfx.push("place");
  return { ok: true };
}

export function upgradeTower(g: Game, id: number): boolean {
  const t = g.towers.find((t) => t.id === id);
  if (!t) return false;
  const cost = upgradeCost(t);
  if (cost === null || g.gold < cost) {
    g.sfx.push("error");
    return false;
  }
  g.gold -= cost;
  t.spent += cost;
  t.level = (t.level + 1) as Level;
  t.pulse = g.time;
  refreshAuras(g);
  burst(g, t.c, t.r, 18, "#fde047", 0.07, 4, "spark");
  g.particles.push(ring(t.c, t.r, "#fde047", 0.9, 0.45));
  g.sfx.push("upgrade");
  return true;
}

/** Turn a level-3 tower into one of its two final forms. There's no going back. */
export function chooseSpec(g: Game, id: number, spec: 0 | 1): boolean {
  const t = g.towers.find((t) => t.id === id);
  if (!t || !canSpecialize(t)) return false;
  const cost = TOWERS[t.type].specs[spec].cost;
  if (g.gold < cost) {
    g.sfx.push("error");
    return false;
  }
  g.gold -= cost;
  t.spent += cost;
  t.spec = spec;
  t.pulse = g.time;
  refreshAuras(g);
  burst(g, t.c, t.r, 26, TOWERS[t.type].accent, 0.08, 4.5, "spark");
  g.particles.push(ring(t.c, t.r, "#ffffff", 1.2, 0.55));
  g.particles.push(ring(t.c, t.r, TOWERS[t.type].color, 0.8, 0.4));
  floatText(g, t.c, t.r - 0.4, TOWERS[t.type].specs[spec].name, "#ffffff");
  g.sfx.push("spec");
  return true;
}

export function sellTower(g: Game, id: number): boolean {
  const idx = g.towers.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  const t = g.towers[idx];
  const value = sellValue(t);
  g.gold += value;
  g.towers.splice(idx, 1);
  g.blocked[t.r][t.c] = false;
  refreshAuras(g);
  refreshRoute(g);
  alarm(g);
  floatText(g, t.c, t.r - 0.2, `+${value}`, "#fde047");
  burst(g, t.c, t.r, 10, "#e7d6b0", 0.05, 2.2, "smoke");
  g.sfx.push("sell");
  return true;
}

/** Opening the maze while enemies are inside it spooks them into running faster. */
function alarm(g: Game) {
  let any = false;
  for (const e of g.enemies) {
    if (e.flying || e.hp <= 0) continue;
    e.haste = Math.min(MAX_HASTE, e.haste + ALARM_HASTE);
    floatText(g, e.x, e.y - 0.5, "!", "#f87171");
    any = true;
  }
  if (any && !g.banner) g.banner = banner("", undefined, 2.2, "The path opened up: enemies run faster!");
}

export function setTargeting(g: Game, id: number, targeting: Targeting): boolean {
  const t = g.towers.find((t) => t.id === id);
  if (!t) return false;
  t.targeting = targeting;
  return true;
}

/** Pay to remove a rubble pile, turning it into open ground. */
export function clearRubble(g: Game, r: number, c: number): PlaceResult {
  if (g.phase === "gameover" || g.phase === "win")
    return { ok: false, reason: "Game over" };
  if (g.terrain[r]?.[c] !== "rubble") return { ok: false, reason: "Nothing to clear here" };
  if (g.gold < g.map.rubbleCost) {
    g.sfx.push("error");
    return { ok: false, reason: "Not enough gold" };
  }
  g.gold -= g.map.rubbleCost;
  g.terrain[r][c] = "grass";
  g.blocked[r][c] = false;
  g.opaque[r][c] = false;
  refreshAuras(g);
  refreshRoute(g);
  alarm(g);
  burst(g, c, r, 16, "#a8a29e", 0.1, 3.4, "shard");
  burst(g, c, r, 10, "#d6d3d1", 0.14, 1.6, "smoke");
  g.particles.push(ring(c, r, "#ffffff", 0.8, 0.35));
  g.shake = Math.max(g.shake, 0.12);
  g.sfx.push("clear");
  return { ok: true };
}

export const canCallWave = (g: Game) =>
  (g.endless || g.wave < TOTAL_WAVES) &&
  (g.phase === "build" || (g.phase === "wave" && g.spawnQueue.length === 0));

export function startWave(g: Game) {
  if (!canCallWave(g)) return;
  const early = g.phase === "wave";
  const def = waveDef(g.wave);

  // Gold Mines pay out, except the ones built since the last wave began.
  let paid = 0;
  for (const t of g.towers) {
    const income = towerStats(t).income;
    if (!income || t.builtWave >= g.wave) continue;
    paid += income;
    floatText(g, t.c, t.r - 0.3, `+${income}`, "#fde047");
  }
  if (paid) {
    g.gold += paid;
    g.sfx.push("coin");
  }

  // The battlefield changes before the wave walks in.
  const arriving = g.events.filter((ev) => ev.wave <= g.wave + 1);
  g.events = g.events.filter((ev) => ev.wave > g.wave + 1);
  for (const ev of arriving) applyEvent(g, ev);

  const open = openEntries(g, g.wave + 1);
  def.groups.forEach((group, gi) => {
    for (let i = 0; i < group.count; i++) {
      const first = gi === 0 && i === 0;
      g.spawnQueue.push({
        type: group.type,
        wave: g.wave,
        delay: first ? 0.3 : i === 0 ? group.interval + 0.5 : group.interval,
        entry: open[g.spawnTurn++ % open.length],
      });
    }
  });
  g.spawnTimer = g.spawnQueue[0]?.delay ?? 0;
  g.wave++;
  g.phase = "wave";

  // Introduce any enemy the player hasn't met yet.
  const fresh = def.groups.map((gr) => gr.type).filter((t) => !g.seen.includes(t));
  for (const t of fresh) if (!g.seen.includes(t)) g.seen.push(t);
  const intro = g.wave > 1 && fresh.length ? ENEMIES[fresh[0]] : null;

  let sub: string | undefined;
  if (early) {
    const bonus = earlyCallBonus(g.wave);
    g.gold += bonus;
    sub = `Early call bonus +${bonus} gold`;
  } else if (!g.endless && g.wave === TOTAL_WAVES) {
    sub = "Final wave!";
  }
  if (intro) sub = `New enemy: ${intro.name}. ${intro.trait}`;
  g.banner = banner(
    `Wave ${g.wave}`,
    sub,
    intro || arriving.length ? 3.6 : 2,
    arriving.length ? `${arriving[0].label}!` : undefined,
  );
  // A portal that opens next wave lights up now as a warning.
  refreshRoute(g);
  g.sfx.push("waveStart");
}

/** Carry on after victory: waves keep coming and keep getting harder. */
export function continueEndless(g: Game) {
  if (g.phase !== "win") return;
  g.endless = true;
  g.phase = "build";
  g.banner = banner("Endless mode", "How long can you last?", 2.6);
  refreshRoute(g);
}

// ─── Effects helpers ──────────────────────────────────────────────────────────

function banner(text: string, sub?: string, life = 2, note?: string): Banner {
  return { text, sub, note, life, maxLife: life };
}

/** Enemy types in the given (0-based) wave that the player hasn't met yet. */
const unseenIn = (g: Game, waveIndex: number) => [
  ...new Set(waveDef(waveIndex).groups.map((gr) => gr.type).filter((t) => !g.seen.includes(t))),
];

function ring(x: number, y: number, color: string, size: number, life: number): Particle {
  return { kind: "ring", x, y, vx: 0, vy: 0, life, maxLife: life, size, color, gravity: 0 };
}

function burst(
  g: Game,
  x: number,
  y: number,
  n: number,
  color: string,
  size: number,
  speed: number,
  kind: ParticleKind,
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    const life = 0.3 + Math.random() * 0.35;
    g.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity: kind === "blob" || kind === "shard" ? 6 : kind === "star" ? 3 : 0,
    });
  }
}

/** Coins that jump out of a beaten enemy, a puff of dust and a few stars. */
function loot(g: Game, x: number, y: number, gold: number, size: number) {
  const coins = gold <= 0 ? 0 : Math.min(6, 1 + Math.floor(gold / 25));
  for (let i = 0; i < coins; i++) {
    const life = 0.55 + Math.random() * 0.25;
    g.particles.push({
      kind: "coin",
      x,
      y,
      vx: (Math.random() - 0.5) * 3.2,
      vy: -(2.6 + Math.random() * 2.2),
      life,
      maxLife: life,
      size: 0.1,
      color: "#facc15",
      gravity: 11,
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    g.particles.push({
      kind: "puff",
      x: x + Math.cos(a) * size * 0.5,
      y: y + Math.sin(a) * size * 0.4,
      vx: Math.cos(a) * 0.8,
      vy: Math.sin(a) * 0.5 - 0.5,
      life: 0.45,
      maxLife: 0.45,
      size: size * (0.7 + Math.random() * 0.4),
      color: "#ffffff",
      gravity: 0,
    });
  }
  burst(g, x, y, 4, "#fff7ad", 0.11, 3.4, "star");
}

function floatText(g: Game, x: number, y: number, text: string, color: string) {
  g.particles.push({
    kind: "text",
    x,
    y,
    vx: 0,
    vy: -1.1,
    life: 0.9,
    maxLife: 0.9,
    size: 0.36,
    color,
    gravity: 0,
    text,
  });
}

// ─── Combat ───────────────────────────────────────────────────────────────────

/** Lower = closer to the castle. */
const progressLeft = (g: Game, e: Enemy) =>
  e.flying
    ? Math.hypot(e.tx - e.x, e.ty - e.y)
    : (g.dist[e.nr]?.[e.nc] ?? 99) + Math.hypot(e.nc - e.x, e.nr - e.y);

function damage(e: Enemy, amount: number, pierce: boolean) {
  const dealt = pierce
    ? amount
    : Math.max(amount * MIN_ARMOR_DAMAGE, amount - e.armor);
  e.hp -= dealt;
  e.hitFlash = 0.09;
}

/** Shades can only be aimed at while something is lighting them up. */
const hidden = (e: Enemy) => !!ENEMIES[e.type].stealth && !e.revealed;

function findTarget(g: Game, t: Tower): Enemy | null {
  const def = TOWERS[t.type];
  const range = towerRange(t);
  const seesStealth = !!towerStats(t).seesStealth;
  let best: Enemy | null = null;
  let bestKey = Infinity;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    if (e.flying && !def.hitsAir) continue;
    if (!seesStealth && hidden(e)) continue;
    const d = Math.hypot(e.x - t.c, e.y - t.r);
    if (d > range + ENEMIES[e.type].radius * 0.5) continue;
    // Lower key wins.
    let key: number;
    switch (t.targeting) {
      case "last":
        key = -progressLeft(g, e);
        break;
      case "strong":
        key = -e.hp * 1000 + progressLeft(g, e);
        break;
      case "close":
        key = d;
        break;
      default:
        key = progressLeft(g, e);
    }
    if (key >= bestKey) continue;
    // Flyers are up above the rocks, so everything can see them.
    if (!t.clearView && !e.flying && !hasSight(g, t.c, t.r, e.x, e.y)) continue;
    bestKey = key;
    best = e;
  }
  return best;
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function fire(g: Game, t: Tower, target: Enemy) {
  const def = TOWERS[t.type];
  const stats = towerStats(t);
  const mx = t.c + Math.cos(t.angle) * 0.42;
  const my = t.r + Math.sin(t.angle) * 0.42;
  t.recoil = 1;
  t.flash = 0.07;

  switch (t.type) {
    case "blaster":
    case "frost": {
      g.projectiles.push({
        id: g.nextId++,
        kind: t.type,
        x: mx,
        y: my,
        sx: mx,
        sy: my,
        tx: target.x,
        ty: target.y,
        targetId: target.id,
        speed: def.projSpeed,
        t: 0,
        flight: 0,
        height: 0,
        stats,
        level: t.level,
        trail: [],
      });
      break;
    }
    case "bomb": {
      const dist = Math.hypot(target.x - mx, target.y - my);
      g.projectiles.push({
        id: g.nextId++,
        kind: "bomb",
        x: mx,
        y: my,
        sx: mx,
        sy: my,
        tx: target.x,
        ty: target.y,
        targetId: target.id,
        speed: 0,
        t: 0,
        flight: 0.45 + dist * 0.07,
        height: 0,
        stats,
        level: t.level,
        trail: [],
      });
      break;
    }
    case "sniper": {
      damage(target, stats.dmg, stats.pierce ?? def.pierce);
      g.bolts.push({
        kind: "sniper",
        pts: [
          { x: mx, y: my },
          { x: target.x, y: target.y },
        ],
        life: 0.22,
        maxLife: 0.22,
        level: t.level,
      });
      burst(g, target.x, target.y, 8, "#ede9fe", 0.05, 4, "spark");
      g.particles.push(ring(target.x, target.y, "#c4b5fd", 0.45, 0.25));
      break;
    }
    case "tesla": {
      const hit = new Set<number>([target.id]);
      const pts = [{ x: t.c, y: t.r - 0.32 }, { x: target.x, y: target.y }];
      const pierce = stats.pierce ?? def.pierce;
      let dmg = stats.dmg;
      damage(target, dmg, pierce);
      let last = target;
      for (let i = 1; i < (stats.chains ?? 1); i++) {
        let next: Enemy | null = null;
        let nd = TESLA_JUMP_RANGE;
        for (const e of g.enemies) {
          if (hit.has(e.id) || e.hp <= 0 || hidden(e)) continue;
          const d = Math.hypot(e.x - last.x, e.y - last.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        if (!next) break;
        dmg *= TESLA_FALLOFF;
        damage(next, dmg, pierce);
        hit.add(next.id);
        pts.push({ x: next.x, y: next.y });
        last = next;
      }
      g.bolts.push({ kind: "tesla", pts, life: 0.18, maxLife: 0.18, level: t.level });
      for (const p of pts.slice(1)) burst(g, p.x, p.y, 4, "#fef08a", 0.04, 3, "spark");
      break;
    }
  }
  if (t.type !== "beacon" && t.type !== "mine") g.sfx.push(t.type);
}

/** Slow an enemy down. The strongest slow wins; Ragers ignore it. */
function chill(g: Game, e: Enemy, factor: number, duration: number) {
  if (ENEMIES[e.type].unstoppable) return;
  e.slowFactor = Math.min(e.slowUntil > g.time ? e.slowFactor : 1, factor);
  e.slowUntil = Math.max(e.slowUntil, g.time + duration);
}

function impact(g: Game, p: Projectile) {
  const target = g.enemies.find((e) => e.id === p.targetId && e.hp > 0);
  switch (p.kind) {
    case "blaster": {
      if (target) damage(target, p.stats.dmg, !!p.stats.pierce);
      burst(g, p.x, p.y, 5, "#bfdbfe", 0.045, 3, "spark");
      break;
    }
    case "frost": {
      const victims = p.stats.splash
        ? g.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= p.stats.splash!)
        : target
          ? [target]
          : [];
      for (const e of victims) {
        damage(e, p.stats.dmg, false);
        chill(g, e, p.stats.slow ?? 1, p.stats.slowDur ?? 1);
        const def = ENEMIES[e.type];
        if (p.stats.stun && !def.unstoppable && !def.noStun && g.time >= e.stunImmuneUntil) {
          e.stunUntil = g.time + p.stats.stun;
          // A short grace period, or a few of these would hold a wave forever.
          e.stunImmuneUntil = e.stunUntil + 3;
        }
      }
      burst(g, p.x, p.y, 7, "#cffafe", 0.06, 2.6, "shard");
      if (p.stats.splash) g.particles.push(ring(p.x, p.y, "#a5f3fc", p.stats.splash, 0.3));
      break;
    }
    case "bomb": {
      const radius = p.stats.splash ?? 1;
      for (const e of g.enemies) {
        if (e.flying) continue; // explosions on the ground don't reach the sky
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d <= radius + ENEMIES[e.type].radius * 0.5) {
          damage(e, p.stats.dmg * (d < radius * 0.5 ? 1 : 0.7), false);
          if (p.stats.burn) {
            e.burnDps = Math.max(e.burnUntil > g.time ? e.burnDps : 0, p.stats.burn);
            e.burnUntil = g.time + (p.stats.burnDur ?? 3);
          }
        }
      }
      g.particles.push(ring(p.x, p.y, "#fff7ed", radius, 0.3));
      burst(g, p.x, p.y, 14, "#fb923c", 0.09, 3.5, "spark");
      burst(g, p.x, p.y, 8, "#57534e", 0.16, 1.2, "smoke");
      g.shake = Math.max(g.shake, 0.12 + p.level * 0.03);
      g.sfx.push("boom");
      break;
    }
  }
}

// ─── Main step ────────────────────────────────────────────────────────────────

export function step(g: Game, dt: number) {
  if (g.phase === "gameover" || g.phase === "win") {
    updateEffects(g, dt);
    return;
  }
  g.time += dt;

  // Spawning
  if (g.spawnQueue.length) {
    g.spawnTimer -= dt;
    while (g.spawnQueue.length && g.spawnTimer <= 0) {
      const entry = g.spawnQueue.shift()!;
      spawnEnemy(g, entry);
      g.spawnTimer += g.spawnQueue[0]?.delay ?? 0;
    }
  }

  updateEnemies(g, dt);
  if (g.lives <= 0) {
    g.lives = 0;
    g.phase = "gameover";
    g.sfx.push("lose");
    return;
  }

  updateTowers(g, dt);
  updateProjectiles(g, dt);
  updateAbilities(g, dt);
  collectKills(g);
  updateEffects(g, dt);

  if (g.phase === "wave" && g.spawnQueue.length === 0 && g.enemies.length === 0) {
    if (!g.endless && g.wave >= TOTAL_WAVES) {
      g.phase = "win";
      g.sfx.push("win");
    } else {
      const bonus = waveClearBonus(g.wave);
      g.gold += bonus;
      g.phase = "build";
      // Warn about whatever the next wave brings, most disruptive first.
      const opening = g.entries.some((e) => e.fromWave === g.wave + 1);
      const coming = g.events.find((ev) => ev.wave === g.wave + 1);
      const fresh = g.endless || g.wave >= TOTAL_WAVES ? [] : unseenIn(g, g.wave);
      const note = coming
        ? `Next wave: ${coming.label.toLowerCase()}!`
        : opening
          ? "A new portal is opening!"
          : fresh.length
            ? `Coming next: ${ENEMIES[fresh[0]].name}. ${ENEMIES[fresh[0]].trait}`
            : undefined;
      g.banner = banner("Wave cleared!", `+${bonus} gold`, note ? 4 : 2, note);
      g.sfx.push(opening || coming ? "portal" : "waveClear");
    }
  }
}

function spawnEnemy(g: Game, entry: SpawnEntry) {
  const wave = waveDef(entry.wave);
  const def = ENEMIES[entry.type];
  const diff = DIFFICULTIES[g.difficulty];
  const portal = g.entries[entry.entry] ?? g.entries[0];
  const baseHp = wave.baseHp * diff.hp;
  const baseSpeed = wave.baseSpeed * diff.speed;
  const hp = Math.max(1, Math.round(baseHp * def.hpMult));
  const x = portal.c - portal.dc * 0.9;
  const y = portal.r - portal.dr * 0.9;

  // Flyers pick the nearest castle and never look back.
  let tx = portal.c;
  let ty = portal.r;
  if (def.flying) {
    let near = Infinity;
    for (const exit of g.exits) {
      const d = Math.hypot(exit.c - x, exit.r - y);
      if (d < near) {
        near = d;
        tx = exit.c;
        ty = exit.r;
      }
    }
  }
  const len = Math.hypot(tx - x, ty - y) || 1;

  g.enemies.push({
    id: g.nextId++,
    type: entry.type,
    x,
    y,
    cr: portal.r - portal.dr,
    cc: portal.c - portal.dc,
    nr: portal.r,
    nc: portal.c,
    dirX: def.flying ? (tx - x) / len : portal.dc,
    dirY: def.flying ? (ty - y) / len : portal.dr,
    hp,
    maxHp: hp,
    speed: baseSpeed * def.speedMult,
    reward: Math.round(wave.baseReward * def.rewardMult),
    armor: def.armor,
    slowUntil: 0,
    slowFactor: 1,
    hitFlash: 0,
    seed: Math.random() * 10,
    flying: !!def.flying,
    tx,
    ty,
    baseHp,
    baseSpeed,
    baseReward: wave.baseReward,
    revealed: false,
    burnUntil: 0,
    burnDps: 0,
    stunUntil: 0,
    stunImmuneUntil: 0,
    abilityTimer: abilityDelay(entry.type),
    haste: 1,
    born: g.time,
  });
}

/** First pulse / spawn comes a little sooner and at a slightly random moment. */
function abilityDelay(type: EnemyType) {
  const def = ENEMIES[type];
  const every = def.jam?.every ?? def.spawns?.every ?? 0;
  return every * (0.5 + Math.random() * 0.5);
}

/**
 * A new ground enemy that starts where `parent` is and carries on along the
 * same path. `back` staggers siblings so they don't overlap.
 */
function offspring(g: Game, parent: Enemy, type: EnemyType, back: number, paysGold: boolean): Enemy {
  const def = ENEMIES[type];
  // Escorts (the ones that carry no gold) are half-strength copies.
  const hp = Math.max(1, Math.round(parent.baseHp * def.hpMult * (paysGold ? 1 : 0.5)));
  return {
    ...parent,
    id: g.nextId++,
    type,
    x: parent.x - parent.dirX * back,
    y: parent.y - parent.dirY * back,
    hp,
    maxHp: hp,
    speed: parent.baseSpeed * def.speedMult * (1 - back * 0.3),
    reward: paysGold ? Math.max(1, Math.round(parent.baseReward * def.rewardMult)) : 0,
    armor: def.armor,
    hitFlash: 0,
    seed: Math.random() * 10,
    flying: !!def.flying,
    revealed: false,
    burnUntil: 0,
    burnDps: 0,
    stunUntil: 0,
    stunImmuneUntil: 0,
    abilityTimer: abilityDelay(type),
    born: g.time,
  };
}

/** The smaller enemies a splitter leaves behind. */
function spawnChildren(g: Game, parent: Enemy): Enemy[] {
  const split = ENEMIES[parent.type].split;
  if (!split) return [];
  const kids: Enemy[] = [];
  for (let i = 0; i < split.count; i++) kids.push(offspring(g, parent, split.into, 0.28 * i, true));
  return kids;
}

function updateEnemies(g: Game, dt: number) {
  // Healer auras. Standing near several Medics is no better than standing near
  // one, so a crowd of them can't make a boss unkillable.
  const healers = g.enemies.filter((h) => ENEMIES[h.type].healAura > 0);
  if (healers.length) {
    for (const e of g.enemies) {
      if (e.hp >= e.maxHp) continue;
      let aura = 0;
      for (const h of healers) {
        if (Math.hypot(e.x - h.x, e.y - h.y) <= HEAL_AURA_RANGE) {
          aura = Math.max(aura, ENEMIES[h.type].healAura);
        }
      }
      if (aura) e.hp = Math.min(e.maxHp, e.hp + aura * e.maxHp * dt);
    }
  }

  // Beacons light up Shades.
  const lights = g.towers.filter((t) => towerStats(t).aura);
  const hatched: Enemy[] = [];

  const escaped = new Set<number>();
  for (const e of g.enemies) {
    if (e.hp <= 0) continue; // already beaten this step (burning): don't let it limp home
    const def = ENEMIES[e.type];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (def.stealth) {
      e.revealed = lights.some((t) => Math.hypot(e.x - t.c, e.y - t.r) <= towerRange(t));
    }
    if (e.burnUntil > g.time) e.hp -= e.burnDps * dt;

    // Special moves on a timer
    if (def.jam || def.spawns) {
      e.abilityTimer -= dt;
      if (e.abilityTimer <= 0) {
        if (def.jam) {
          e.abilityTimer = def.jam.every;
          let hit = false;
          for (const t of g.towers) {
            if (t.shielded || Math.hypot(t.c - e.x, t.r - e.y) > def.jam.radius) continue;
            t.jamUntil = g.time + def.jam.duration;
            hit = true;
          }
          g.particles.push(ring(e.x, e.y, "#fde047", def.jam.radius, 0.45));
          if (hit) g.sfx.push("jam");
        } else if (def.spawns && !e.flying) {
          e.abilityTimer = def.spawns.every;
          for (let i = 0; i < def.spawns.count; i++) {
            hatched.push(offspring(g, e, def.spawns.type, 0.2 * i, false));
          }
          g.particles.push(ring(e.x, e.y, ENEMIES[def.spawns.type].body, 0.7, 0.3));
        }
      }
    }

    const slowed = e.slowUntil > g.time;
    const rage = def.enrage ? 1 + def.enrage * (1 - Math.max(0, e.hp) / e.maxHp) : 1;
    let move = e.stunUntil > g.time ? 0 : e.speed * (slowed ? e.slowFactor : 1) * rage * e.haste * dt;

    if (e.flying) {
      const dx = e.tx - e.x;
      const dy = e.ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= move + 0.05) {
        escaped.add(e.id);
      } else {
        e.dirX = dx / d;
        e.dirY = dy / d;
        e.x += e.dirX * move;
        e.y += e.dirY * move;
      }
      continue;
    }

    while (move > 0) {
      const dx = e.nc - e.x;
      const dy = e.nr - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        e.x = e.nc;
        e.y = e.nr;
        move -= d;
        const dr = e.nr - e.cr;
        const dc = e.nc - e.cc;
        e.cr = e.nr;
        e.cc = e.nc;
        if (g.dist[e.cr][e.cc] === 0) {
          escaped.add(e.id);
          break;
        }
        const [nr, nc] = nextCell(g.dist, e.cr, e.cc, dr, dc);
        if (nr === e.cr && nc === e.cc) break; // no route (shouldn't happen)
        e.nr = nr;
        e.nc = nc;
      } else {
        e.dirX = dx / d;
        e.dirY = dy / d;
        e.x += e.dirX * move;
        e.y += e.dirY * move;
        move = 0;
      }
    }
  }

  if (escaped.size) {
    for (const e of g.enemies) {
      if (!escaped.has(e.id)) continue;
      const cost = ENEMIES[e.type].livesCost;
      g.lives -= cost;
      floatText(g, e.x, e.y - 0.5, `-${cost}`, "#f87171");
    }
    g.enemies = g.enemies.filter((e) => !escaped.has(e.id));
    g.shake = Math.max(g.shake, 0.2);
    g.hurtAt = g.time;
    g.sfx.push("leak");
  }
  if (hatched.length) g.enemies.push(...hatched);
}

function updateTowers(g: Game, dt: number) {
  for (const t of g.towers) {
    const def = TOWERS[t.type];
    const stats = towerStats(t);
    t.cooldown -= dt;
    t.recoil = Math.max(0, t.recoil - dt * 6);
    t.flash = Math.max(0, t.flash - dt);
    if (def.role !== "attack" || t.jamUntil > g.time) continue;

    const target = findTarget(g, t);
    if (!target) continue;

    let aimed = true;
    if (def.turnSpeed > 0) {
      const want = Math.atan2(target.y - t.r, target.x - t.c);
      const diff = angleDiff(t.angle, want);
      const maxTurn = def.turnSpeed * dt;
      t.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
      aimed = Math.abs(diff) < 0.3;
    }
    if (t.cooldown <= 0 && aimed) {
      fire(g, t, target);
      t.cooldown = 1 / (stats.rate * (1 + t.buffRate));
    }
  }
}

function updateProjectiles(g: Game, dt: number) {
  const done = new Set<number>();
  for (const p of g.projectiles) {
    const target = g.enemies.find((e) => e.id === p.targetId && e.hp > 0);
    if (p.kind === "bomb") {
      if (target && p.t < 0.7) {
        p.tx = target.x;
        p.ty = target.y;
      }
      p.t = Math.min(1, p.t + dt / p.flight);
      p.x = p.sx + (p.tx - p.sx) * p.t;
      p.y = p.sy + (p.ty - p.sy) * p.t;
      p.height = Math.sin(p.t * Math.PI) * (0.9 + Math.hypot(p.tx - p.sx, p.ty - p.sy) * 0.15);
      if (p.t >= 1) {
        impact(g, p);
        done.add(p.id);
      }
      continue;
    }

    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (d <= move + 0.12) {
      p.x = p.tx;
      p.y = p.ty;
      impact(g, p);
      done.add(p.id);
    } else {
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
    }
  }
  if (done.size) g.projectiles = g.projectiles.filter((p) => !done.has(p.id));
}

// ─── Abilities ────────────────────────────────────────────────────────────────

/** Call down a meteor on a point (cell units). It lands after a short fall. */
export function castMeteor(g: Game, x: number, y: number): boolean {
  if (g.phase === "gameover" || g.phase === "win" || g.cooldowns.meteor > 0) return false;
  g.strikes.push({ x, y, t: ABILITIES.meteor.delay, total: ABILITIES.meteor.delay });
  g.cooldowns.meteor = ABILITIES.meteor.cooldown;
  g.sfx.push("meteor");
  return true;
}

/** Slow every enemy on the map for a few seconds. */
export function castFreeze(g: Game): boolean {
  if (g.phase === "gameover" || g.phase === "win" || g.cooldowns.freeze > 0) return false;
  for (const e of g.enemies) {
    chill(g, e, ABILITIES.freeze.slow, ABILITIES.freeze.duration);
    burst(g, e.x, e.y, 4, "#cffafe", 0.06, 2.2, "shard");
  }
  g.cooldowns.freeze = ABILITIES.freeze.cooldown;
  g.frost = 1;
  g.sfx.push("freeze");
  return true;
}

function updateAbilities(g: Game, dt: number) {
  g.cooldowns.meteor = Math.max(0, g.cooldowns.meteor - dt);
  g.cooldowns.freeze = Math.max(0, g.cooldowns.freeze - dt);
  if (!g.strikes.length) return;
  for (const strike of g.strikes) {
    strike.t -= dt;
    if (strike.t > 0) continue;
    const radius = ABILITIES.meteor.radius;
    const dmg = meteorDamage(Math.max(1, g.wave));
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - strike.x, e.y - strike.y);
      if (d <= radius + ENEMIES[e.type].radius * 0.5) damage(e, dmg * (d < radius * 0.5 ? 1 : 0.7), true);
    }
    g.particles.push(ring(strike.x, strike.y, "#fff7ed", radius, 0.45));
    g.particles.push(ring(strike.x, strike.y, "#fb923c", radius * 0.7, 0.35));
    burst(g, strike.x, strike.y, 30, "#fb923c", 0.12, 5.5, "spark");
    burst(g, strike.x, strike.y, 14, "#fde047", 0.09, 3.5, "spark");
    burst(g, strike.x, strike.y, 14, "#57534e", 0.2, 1.6, "smoke");
    g.shake = Math.max(g.shake, 0.4);
    g.sfx.push("boom");
  }
  g.strikes = g.strikes.filter((strike) => strike.t > 0);
}

function collectKills(g: Game) {
  if (!g.enemies.some((e) => e.hp <= 0)) return;
  const alive: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.hp > 0) {
      alive.push(e);
      continue;
    }
    const def = ENEMIES[e.type];
    const gold = Math.round(e.reward * (1 + g.bounty));
    g.gold += gold;
    burst(g, e.x, e.y, 6 + Math.round(def.radius * 14), def.body, 0.1, 3, "blob");
    g.particles.push(ring(e.x, e.y, "#ffffff", def.radius * 1.6, 0.25));
    loot(g, e.x, e.y, gold, def.radius);
    if (gold) floatText(g, e.x, e.y - 0.3, `+${gold}`, "#fde047");
    if (e.type === "boss" || e.type === "emperor") g.shake = Math.max(g.shake, e.type === "emperor" ? 0.6 : 0.3);
    alive.push(...spawnChildren(g, e));
    g.sfx.push("pop");
  }
  g.enemies = alive;
}

function updateEffects(g: Game, dt: number) {
  g.shake = Math.max(0, g.shake - dt);
  g.frost = Math.max(0, g.frost - dt * 0.5);
  if (g.banner) {
    g.banner.life -= dt;
    if (g.banner.life <= 0) g.banner = null;
  }
  for (const b of g.bolts) b.life -= dt;
  g.bolts = g.bolts.filter((b) => b.life > 0);
  for (const p of g.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    if (p.kind !== "text") {
      p.vx *= 1 - 3 * dt;
      p.vy *= p.gravity ? 1 : 1 - 3 * dt;
    }
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  if (g.particles.length > 450) g.particles.splice(0, g.particles.length - 450);
}
