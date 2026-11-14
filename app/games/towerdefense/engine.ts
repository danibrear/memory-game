// ─── Tower Defense: simulation (pure, framework-free) ─────────────────────────
//
// Everything is in "cell units": (x, y) = (col, row) of a cell's centre.
// Enemies follow a flow field (distance-to-exit per cell), so players can
// build mazes at any time and every enemy re-routes on its next step.

import {
  COLS,
  ENEMIES,
  ENTRY,
  EXIT,
  HEAL_AURA_RANGE,
  MAX_LIVES,
  MIN_ARMOR_DAMAGE,
  ROWS,
  SELL_REFUND,
  START_GOLD,
  TESLA_FALLOFF,
  TESLA_JUMP_RANGE,
  TOTAL_WAVES,
  TOWERS,
  WAVES,
  earlyCallBonus,
  waveClearBonus,
  type EnemyType,
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
  /** Last cell centre reached (col -1 = still walking in from off-board). */
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

export type ParticleKind = "spark" | "smoke" | "ring" | "shard" | "text" | "blob";

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
  | "error"
  | "waveStart"
  | "waveClear"
  | "lose"
  | "win";

export interface Banner {
  text: string;
  sub?: string;
  life: number;
  maxLife: number;
}

export interface SpawnEntry {
  type: EnemyType;
  wave: number; // 0-based wave index the enemy belongs to
  delay: number;
}

export interface Game {
  phase: Phase;
  time: number;
  blocked: boolean[][];
  dist: number[][];
  /** Cells from the entry to the exit along the current route (for drawing). */
  route: { r: number; c: number }[];
  routeVersion: number;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  bolts: Bolt[];
  particles: Particle[];
  gold: number;
  lives: number;
  /** Number of waves started so far (next wave index). */
  wave: number;
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  shake: number;
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

export function computeDist(blocked: boolean[][]): number[][] {
  const dist = Array.from({ length: ROWS }, () =>
    Array<number>(COLS).fill(Infinity),
  );
  dist[EXIT.r][EXIT.c] = 0;
  const q: [number, number][] = [[EXIT.r, EXIT.c]];
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

function traceRoute(dist: number[][]): { r: number; c: number }[] {
  const route: { r: number; c: number }[] = [];
  if (dist[ENTRY.r][ENTRY.c] === Infinity) return route;
  let r: number = ENTRY.r;
  let c: number = ENTRY.c;
  let dr = 0;
  let dc = 1;
  route.push({ r, c });
  for (let guard = 0; guard < ROWS * COLS && dist[r][c] > 0; guard++) {
    const [nr, nc] = nextCell(dist, r, c, dr, dc);
    dr = nr - r;
    dc = nc - c;
    r = nr;
    c = nc;
    route.push({ r, c });
  }
  return route;
}

function refreshRoute(g: Game) {
  g.dist = computeDist(g.blocked);
  g.route = traceRoute(g.dist);
  g.routeVersion++;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function createGame(): Game {
  const blocked = Array.from({ length: ROWS }, () =>
    Array<boolean>(COLS).fill(false),
  );
  const g: Game = {
    phase: "build",
    time: 0,
    blocked,
    dist: [],
    route: [],
    routeVersion: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    bolts: [],
    particles: [],
    gold: START_GOLD,
    lives: MAX_LIVES,
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    shake: 0,
    banner: null,
    sfx: [],
    nextId: 1,
  };
  refreshRoute(g);
  return g;
}

export const towerStats = (t: Pick<Tower, "type" | "level">) =>
  TOWERS[t.type].levels[t.level];

export const upgradeCost = (t: Tower): number | null =>
  t.level < 2 ? TOWERS[t.type].levels[t.level + 1].cost : null;

export const sellValue = (t: Tower) => Math.floor(t.spent * SELL_REFUND);

export const towerAt = (g: Game, r: number, c: number) =>
  g.towers.find((t) => t.r === r && t.c === c) ?? null;

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
  if ((r === ENTRY.r && c === ENTRY.c) || (r === EXIT.r && c === EXIT.c))
    return { ok: false, reason: "Can't build on the gates" };
  if (g.blocked[r][c]) return { ok: false, reason: "Spot taken" };
  if (g.gold < TOWERS[type].levels[0].cost)
    return { ok: false, reason: "Not enough gold" };
  for (const e of g.enemies) {
    const onCell =
      (e.nr === r && e.nc === c) ||
      (e.cr === r && e.cc === c) ||
      (Math.round(e.y) === r && Math.round(e.x) === c);
    if (onCell) return { ok: false, reason: "An enemy is in the way" };
  }
  g.blocked[r][c] = true;
  const dist = computeDist(g.blocked);
  g.blocked[r][c] = false;
  if (dist[ENTRY.r][ENTRY.c] === Infinity)
    return { ok: false, reason: "That would block the path!" };
  for (const e of g.enemies) {
    if (dist[e.nr][e.nc] === Infinity)
      return { ok: false, reason: "That would trap an enemy!" };
  }
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
  g.towers.push({
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
  });
  refreshRoute(g);
  burst(g, c, r, 10, "#e7d6b0", 0.05, 2.2, "smoke");
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
  burst(g, t.c, t.r, 18, "#fde047", 0.07, 4, "spark");
  g.particles.push(ring(t.c, t.r, "#fde047", 0.9, 0.45));
  g.sfx.push("upgrade");
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
  refreshRoute(g);
  floatText(g, t.c, t.r - 0.2, `+${value}`, "#fde047");
  burst(g, t.c, t.r, 10, "#e7d6b0", 0.05, 2.2, "smoke");
  g.sfx.push("sell");
  return true;
}

export const canCallWave = (g: Game) =>
  g.wave < TOTAL_WAVES &&
  (g.phase === "build" || (g.phase === "wave" && g.spawnQueue.length === 0));

export function startWave(g: Game) {
  if (!canCallWave(g)) return;
  const early = g.phase === "wave";
  const def = WAVES[g.wave];
  def.groups.forEach((group, gi) => {
    for (let i = 0; i < group.count; i++) {
      const first = gi === 0 && i === 0;
      g.spawnQueue.push({
        type: group.type,
        wave: g.wave,
        delay: first ? 0.3 : i === 0 ? group.interval + 0.5 : group.interval,
      });
    }
  });
  g.spawnTimer = g.spawnQueue[0]?.delay ?? 0;
  g.wave++;
  g.phase = "wave";
  if (early) {
    const bonus = earlyCallBonus(g.wave);
    g.gold += bonus;
    g.banner = banner(`Wave ${g.wave}`, `Early call bonus +${bonus} gold`);
  } else {
    g.banner = banner(`Wave ${g.wave}`, g.wave === TOTAL_WAVES ? "Final wave!" : undefined);
  }
  g.sfx.push("waveStart");
}

// ─── Effects helpers ──────────────────────────────────────────────────────────

function banner(text: string, sub?: string): Banner {
  return { text, sub, life: 2, maxLife: 2 };
}

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
      gravity: kind === "blob" || kind === "shard" ? 6 : 0,
    });
  }
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
  (g.dist[e.nr]?.[e.nc] ?? 99) + Math.hypot(e.nc - e.x, e.nr - e.y);

function damage(e: Enemy, amount: number, pierce: boolean) {
  const dealt = pierce
    ? amount
    : Math.max(amount * MIN_ARMOR_DAMAGE, amount - e.armor);
  e.hp -= dealt;
  e.hitFlash = 0.09;
}

function findTarget(g: Game, t: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestLeft = Infinity;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - t.c, e.y - t.r);
    if (d > range + ENEMIES[e.type].radius * 0.5) continue;
    const left = progressLeft(g, e);
    if (left < bestLeft) {
      bestLeft = left;
      best = e;
    }
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
      damage(target, stats.dmg, def.pierce);
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
      let dmg = stats.dmg;
      damage(target, dmg, false);
      let last = target;
      for (let i = 1; i < (stats.chains ?? 1); i++) {
        let next: Enemy | null = null;
        let nd = TESLA_JUMP_RANGE;
        for (const e of g.enemies) {
          if (hit.has(e.id) || e.hp <= 0) continue;
          const d = Math.hypot(e.x - last.x, e.y - last.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        if (!next) break;
        dmg *= TESLA_FALLOFF;
        damage(next, dmg, false);
        hit.add(next.id);
        pts.push({ x: next.x, y: next.y });
        last = next;
      }
      g.bolts.push({ kind: "tesla", pts, life: 0.18, maxLife: 0.18, level: t.level });
      for (const p of pts.slice(1)) burst(g, p.x, p.y, 4, "#fef08a", 0.04, 3, "spark");
      break;
    }
  }
  g.sfx.push(t.type);
}

function impact(g: Game, p: Projectile) {
  const target = g.enemies.find((e) => e.id === p.targetId && e.hp > 0);
  switch (p.kind) {
    case "blaster": {
      if (target) damage(target, p.stats.dmg, false);
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
        e.slowFactor = Math.min(
          e.slowUntil > g.time ? e.slowFactor : 1,
          p.stats.slow ?? 1,
        );
        e.slowUntil = g.time + (p.stats.slowDur ?? 1);
      }
      burst(g, p.x, p.y, 7, "#cffafe", 0.06, 2.6, "shard");
      if (p.stats.splash) g.particles.push(ring(p.x, p.y, "#a5f3fc", p.stats.splash, 0.3));
      break;
    }
    case "bomb": {
      const radius = p.stats.splash ?? 1;
      for (const e of g.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d <= radius + ENEMIES[e.type].radius * 0.5) {
          damage(e, p.stats.dmg * (d < radius * 0.5 ? 1 : 0.7), false);
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
  collectKills(g);
  updateEffects(g, dt);

  if (g.phase === "wave" && g.spawnQueue.length === 0 && g.enemies.length === 0) {
    if (g.wave >= TOTAL_WAVES) {
      g.phase = "win";
      g.sfx.push("win");
    } else {
      const bonus = waveClearBonus(g.wave);
      g.gold += bonus;
      g.phase = "build";
      g.banner = banner("Wave cleared!", `+${bonus} gold`);
      g.sfx.push("waveClear");
    }
  }
}

function spawnEnemy(g: Game, entry: SpawnEntry) {
  const wave = WAVES[entry.wave];
  const def = ENEMIES[entry.type];
  const hp = Math.round(wave.baseHp * def.hpMult);
  g.enemies.push({
    id: g.nextId++,
    type: entry.type,
    x: ENTRY.c - 0.9,
    y: ENTRY.r,
    cr: ENTRY.r,
    cc: ENTRY.c - 1,
    nr: ENTRY.r,
    nc: ENTRY.c,
    dirX: 1,
    dirY: 0,
    hp,
    maxHp: hp,
    speed: wave.baseSpeed * def.speedMult,
    reward: Math.round(wave.baseReward * def.rewardMult),
    armor: def.armor,
    slowUntil: 0,
    slowFactor: 1,
    hitFlash: 0,
    seed: Math.random() * 10,
  });
}

function updateEnemies(g: Game, dt: number) {
  // Healer auras
  for (const h of g.enemies) {
    const aura = ENEMIES[h.type].healAura;
    if (!aura) continue;
    for (const e of g.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) <= HEAL_AURA_RANGE) {
        e.hp = Math.min(e.maxHp, e.hp + aura * e.maxHp * dt);
      }
    }
  }

  const escaped = new Set<number>();
  for (const e of g.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    const slowed = e.slowUntil > g.time;
    let move = e.speed * (slowed ? e.slowFactor : 1) * dt;
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
        if (e.cr === EXIT.r && e.cc === EXIT.c) {
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
      g.lives -= ENEMIES[e.type].livesCost;
      floatText(g, EXIT.c, EXIT.r - 0.5, `-${ENEMIES[e.type].livesCost}`, "#f87171");
    }
    g.enemies = g.enemies.filter((e) => !escaped.has(e.id));
    g.shake = Math.max(g.shake, 0.2);
    g.sfx.push("leak");
  }
}

function updateTowers(g: Game, dt: number) {
  for (const t of g.towers) {
    const def = TOWERS[t.type];
    const stats = towerStats(t);
    t.cooldown -= dt;
    t.recoil = Math.max(0, t.recoil - dt * 6);
    t.flash = Math.max(0, t.flash - dt);

    const target = findTarget(g, t, stats.range);
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
      t.cooldown = 1 / stats.rate;
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

function collectKills(g: Game) {
  if (!g.enemies.some((e) => e.hp <= 0)) return;
  const alive: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.hp > 0) {
      alive.push(e);
      continue;
    }
    const def = ENEMIES[e.type];
    g.gold += e.reward;
    burst(g, e.x, e.y, 10 + Math.round(def.radius * 20), def.body, 0.1, 3, "blob");
    g.particles.push(ring(e.x, e.y, "#ffffff", def.radius * 1.6, 0.25));
    floatText(g, e.x, e.y - 0.3, `+${e.reward}`, "#fde047");
    if (e.type === "boss") g.shake = Math.max(g.shake, 0.3);
    g.sfx.push("pop");
  }
  g.enemies = alive;
}

function updateEffects(g: Game, dt: number) {
  g.shake = Math.max(0, g.shake - dt);
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
  if (g.particles.length > 400) g.particles.splice(0, g.particles.length - 400);
}
