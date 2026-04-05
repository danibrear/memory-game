import { Box, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "./+types/towerdefense";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tower Defense - Games by DaniB" },
    { name: "description", content: "Stop the waves of enemies!" },
  ];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROWS = 11;
const COLS = 20;
const ENTRY: [number, number] = [5, 0];
const EXIT: [number, number] = [5, 19];
const MAX_LIVES = 20;
const START_GOLD = 150;
const TOTAL_WAVES = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

type EnemyType =
  | "normal"
  | "fast"
  | "tank"
  | "swarm"
  | "boss"
  | "healer"
  | "armored";
type TowerType = "basic" | "sniper" | "splash";
type Tool = TowerType | "sell";
type Phase = "build" | "wave" | "gameover" | "win";

interface EnemyTypeDef {
  emoji: string;
  color: string;
  hpMult: number;
  speedMult: number;
  rewardMult: number;
  armor: number;
  regen: number; // fraction of maxHp per second
  sizeMult: number;
}

const ENEMY_TYPES: Record<EnemyType, EnemyTypeDef> = {
  normal: {
    emoji: "👾",
    color: "#4ade80",
    hpMult: 1,
    speedMult: 1,
    rewardMult: 1,
    armor: 0,
    regen: 0,
    sizeMult: 1,
  },
  fast: {
    emoji: "⚡",
    color: "#38bdf8",
    hpMult: 0.5,
    speedMult: 1.8,
    rewardMult: 0.8,
    armor: 0,
    regen: 0,
    sizeMult: 0.8,
  },
  tank: {
    emoji: "🛡️",
    color: "#a78bfa",
    hpMult: 3,
    speedMult: 0.6,
    rewardMult: 2,
    armor: 0,
    regen: 0,
    sizeMult: 1.2,
  },
  swarm: {
    emoji: "🐜",
    color: "#fb923c",
    hpMult: 0.3,
    speedMult: 1.5,
    rewardMult: 0.4,
    armor: 0,
    regen: 0,
    sizeMult: 0.7,
  },
  boss: {
    emoji: "👹",
    color: "#f43f5e",
    hpMult: 8,
    speedMult: 0.5,
    rewardMult: 5,
    armor: 15,
    regen: 0,
    sizeMult: 1.4,
  },
  healer: {
    emoji: "💚",
    color: "#34d399",
    hpMult: 1.5,
    speedMult: 0.9,
    rewardMult: 1.5,
    armor: 0,
    regen: 0.03,
    sizeMult: 1,
  },
  armored: {
    emoji: "🔩",
    color: "#94a3b8",
    hpMult: 1.5,
    speedMult: 0.8,
    rewardMult: 1.5,
    armor: 20,
    regen: 0,
    sizeMult: 1,
  },
};

interface TowerDef {
  label: string;
  emoji: string;
  color: string;
  cost: number;
  upgCost: number;
  dmg: number;
  range: number;
  rate: number; // shots/sec
  splash: boolean;
}

const DEFS: Record<TowerType, TowerDef> = {
  basic: {
    label: "Basic",
    emoji: "🗼",
    color: "#3b82f6",
    cost: 50,
    upgCost: 40,
    dmg: 30,
    range: 3,
    rate: 1.5,
    splash: false,
  },
  sniper: {
    label: "Sniper",
    emoji: "🎯",
    color: "#8b5cf6",
    cost: 100,
    upgCost: 80,
    dmg: 100,
    range: 6,
    rate: 0.5,
    splash: false,
  },
  splash: {
    label: "Splash",
    emoji: "💣",
    color: "#ef4444",
    cost: 75,
    upgCost: 60,
    dmg: 20,
    range: 2.5,
    rate: 2.0,
    splash: true,
  },
};

interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number; // sec between spawns within this group
}

interface WaveDef {
  groups: WaveGroup[];
  baseHp: number;
  baseSpeed: number;
  baseReward: number;
}

interface SpawnEntry {
  type: EnemyType;
  delay: number; // seconds before spawning this enemy
}

const WAVES: WaveDef[] = [
  // 1 – Intro
  {
    groups: [{ type: "normal", count: 6, interval: 1.2 }],
    baseHp: 60,
    baseSpeed: 2.0,
    baseReward: 8,
  },
  // 2 – More normals
  {
    groups: [{ type: "normal", count: 8, interval: 1.0 }],
    baseHp: 80,
    baseSpeed: 2.1,
    baseReward: 9,
  },
  // 3 – Introduce fast
  {
    groups: [
      { type: "normal", count: 5, interval: 1.0 },
      { type: "fast", count: 4, interval: 0.7 },
    ],
    baseHp: 100,
    baseSpeed: 2.2,
    baseReward: 10,
  },
  // 4 – Fast rush
  {
    groups: [{ type: "fast", count: 8, interval: 0.6 }],
    baseHp: 90,
    baseSpeed: 2.3,
    baseReward: 10,
  },
  // 5 – Introduce tanks
  {
    groups: [
      { type: "normal", count: 5, interval: 1.0 },
      { type: "tank", count: 2, interval: 2.0 },
    ],
    baseHp: 120,
    baseSpeed: 2.3,
    baseReward: 12,
  },
  // 6 – Introduce swarm
  {
    groups: [{ type: "swarm", count: 15, interval: 0.4 }],
    baseHp: 130,
    baseSpeed: 2.4,
    baseReward: 10,
  },
  // 7 – Swarm + fast
  {
    groups: [
      { type: "swarm", count: 10, interval: 0.4 },
      { type: "fast", count: 5, interval: 0.6 },
    ],
    baseHp: 150,
    baseSpeed: 2.5,
    baseReward: 11,
  },
  // 8 – Introduce armored
  {
    groups: [
      { type: "armored", count: 5, interval: 1.2 },
      { type: "normal", count: 5, interval: 0.9 },
    ],
    baseHp: 180,
    baseSpeed: 2.5,
    baseReward: 13,
  },
  // 9 – Fast + armored
  {
    groups: [
      { type: "fast", count: 6, interval: 0.6 },
      { type: "armored", count: 4, interval: 1.0 },
    ],
    baseHp: 210,
    baseSpeed: 2.6,
    baseReward: 14,
  },
  // 10 – First boss!
  {
    groups: [
      { type: "normal", count: 8, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
    ],
    baseHp: 250,
    baseSpeed: 2.6,
    baseReward: 15,
  },
  // 11 – Introduce healer
  {
    groups: [
      { type: "healer", count: 4, interval: 1.0 },
      { type: "normal", count: 8, interval: 0.8 },
    ],
    baseHp: 300,
    baseSpeed: 2.7,
    baseReward: 16,
  },
  // 12 – Tank parade
  {
    groups: [
      { type: "tank", count: 5, interval: 1.5 },
      { type: "healer", count: 3, interval: 1.0 },
    ],
    baseHp: 350,
    baseSpeed: 2.7,
    baseReward: 18,
  },
  // 13 – Big swarm
  {
    groups: [
      { type: "swarm", count: 20, interval: 0.3 },
      { type: "fast", count: 6, interval: 0.5 },
    ],
    baseHp: 380,
    baseSpeed: 2.8,
    baseReward: 15,
  },
  // 14 – Armored + tank
  {
    groups: [
      { type: "armored", count: 8, interval: 1.0 },
      { type: "tank", count: 4, interval: 1.5 },
    ],
    baseHp: 420,
    baseSpeed: 2.8,
    baseReward: 20,
  },
  // 15 – Boss + escort
  {
    groups: [
      { type: "armored", count: 6, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
      { type: "healer", count: 4, interval: 0.8 },
    ],
    baseHp: 480,
    baseSpeed: 2.9,
    baseReward: 22,
  },
  // 16 – Mixed assault
  {
    groups: [
      { type: "fast", count: 6, interval: 0.5 },
      { type: "normal", count: 6, interval: 0.7 },
      { type: "armored", count: 4, interval: 1.0 },
    ],
    baseHp: 550,
    baseSpeed: 3.0,
    baseReward: 22,
  },
  // 17 – Healer heavy
  {
    groups: [
      { type: "healer", count: 6, interval: 0.8 },
      { type: "tank", count: 4, interval: 1.2 },
      { type: "healer", count: 4, interval: 0.8 },
    ],
    baseHp: 620,
    baseSpeed: 3.0,
    baseReward: 25,
  },
  // 18 – Swarm flood
  {
    groups: [
      { type: "swarm", count: 25, interval: 0.25 },
      { type: "fast", count: 8, interval: 0.4 },
    ],
    baseHp: 700,
    baseSpeed: 3.1,
    baseReward: 20,
  },
  // 19 – Hard mixed
  {
    groups: [
      { type: "tank", count: 4, interval: 1.2 },
      { type: "armored", count: 6, interval: 0.8 },
      { type: "healer", count: 4, interval: 0.8 },
      { type: "fast", count: 8, interval: 0.4 },
    ],
    baseHp: 800,
    baseSpeed: 3.2,
    baseReward: 28,
  },
  // 20 – Final boss rush
  {
    groups: [
      { type: "armored", count: 8, interval: 0.6 },
      { type: "boss", count: 2, interval: 3.0 },
      { type: "healer", count: 6, interval: 0.6 },
      { type: "tank", count: 4, interval: 1.0 },
    ],
    baseHp: 1000,
    baseSpeed: 3.3,
    baseReward: 35,
  },
];

interface Enemy {
  id: number;
  type: EnemyType;
  progress: number; // float index along path
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  armor: number;
  regen: number; // fraction of maxHp per second
}

interface Tower {
  id: number;
  row: number;
  col: number;
  type: TowerType;
  level: 1 | 2;
  cooldown: number; // sec until next shot
}

interface GState {
  phase: Phase;
  grid: boolean[][];
  towers: Tower[];
  enemies: Enemy[];
  path: [number, number][] | null;
  gold: number;
  lives: number;
  wave: number;
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  nextEId: number;
  nextTId: number;
}

interface ShotHit {
  row: number;
  col: number;
  dmg: number;
}

interface ShotEvent {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  type: TowerType;
  splash: boolean;
  hits: ShotHit[];
}

interface VisProjectile {
  id: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  type: TowerType;
  splash: boolean;
  born: number;
  duration: number;
}

interface VisDamageNum {
  id: number;
  row: number;
  col: number;
  dmg: number;
  born: number;
  color: string;
}

let visId = 0;

// ─── Pure helpers (defined outside component) ─────────────────────────────────

function findPath(grid: boolean[][]): [number, number][] | null {
  const [sr, sc] = ENTRY;
  const [er, ec] = EXIT;
  const queue: [[number, number], [number, number][]][] = [
    [[sr, sc], [[sr, sc]]],
  ];
  const seen = new Set<string>([`${sr},${sc}`]);
  while (queue.length) {
    const [[r, c], path] = queue.shift()!;
    if (r === er && c === ec) return path;
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as [number, number][]) {
      const nr = r + dr,
        nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k) || grid[nr][nc]) continue;
      seen.add(k);
      queue.push([
        [nr, nc],
        [...path, [nr, nc]],
      ]);
    }
  }
  return null;
}

function enemyXY(enemy: Enemy, path: [number, number][]): [number, number] {
  const maxI = path.length - 1;
  const i = Math.min(Math.floor(enemy.progress), maxI - 1);
  const f = enemy.progress - Math.floor(enemy.progress);
  const [r0, c0] = path[i];
  const [r1, c1] = path[Math.min(i + 1, maxI)];
  return [r0 + (r1 - r0) * f, c0 + (c1 - c0) * f];
}

function buildSpawnQueue(wave: WaveDef): SpawnEntry[] {
  const queue: SpawnEntry[] = [];
  for (let gi = 0; gi < wave.groups.length; gi++) {
    const group = wave.groups[gi];
    for (let i = 0; i < group.count; i++) {
      const isFirst = queue.length === 0;
      const isGroupStart = i === 0 && gi > 0;
      queue.push({
        type: group.type,
        delay: isFirst
          ? 0
          : isGroupStart
            ? group.interval + 0.5
            : group.interval,
      });
    }
  }
  return queue;
}

function initState(): GState {
  const grid = Array.from(
    { length: ROWS },
    () => Array(COLS).fill(false) as boolean[],
  );
  return {
    phase: "build",
    grid,
    towers: [],
    enemies: [],
    path: findPath(grid),
    gold: START_GOLD,
    lives: MAX_LIVES,
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    nextEId: 0,
    nextTId: 0,
  };
}

function tickGame(g: GState, dt: number, shots: ShotEvent[]) {
  const wave = WAVES[g.wave];

  // Spawn from queue
  if (g.spawnQueue.length > 0) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      const entry = g.spawnQueue.shift()!;
      const typeDef = ENEMY_TYPES[entry.type];
      g.enemies.push({
        id: g.nextEId++,
        type: entry.type,
        progress: 0,
        hp: Math.round(wave.baseHp * typeDef.hpMult),
        maxHp: Math.round(wave.baseHp * typeDef.hpMult),
        speed: wave.baseSpeed * typeDef.speedMult,
        reward: Math.round(wave.baseReward * typeDef.rewardMult),
        armor: typeDef.armor,
        regen: typeDef.regen,
      });
      if (g.spawnQueue.length > 0) {
        g.spawnTimer = g.spawnQueue[0].delay;
      }
    }
  }

  // Regen
  for (const e of g.enemies) {
    if (e.regen > 0) {
      e.hp = Math.min(e.maxHp, e.hp + e.regen * e.maxHp * dt);
    }
  }

  // Move enemies
  if (g.path) {
    const maxP = g.path.length - 1;
    const escaped: number[] = [];
    for (const e of g.enemies) {
      e.progress = Math.min(e.progress + e.speed * dt, maxP + 0.01);
      if (e.progress >= maxP) escaped.push(e.id);
    }
    if (escaped.length) {
      g.enemies = g.enemies.filter((e) => !escaped.includes(e.id));
      g.lives = Math.max(0, g.lives - escaped.length);
      if (g.lives === 0) {
        g.phase = "gameover";
        g.enemies = [];
        return;
      }
    }
  }

  // Towers fire
  for (const tower of g.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    if (!g.path) continue;

    const def = DEFS[tower.type];
    const lm = tower.level === 2 ? 2 : 1;
    const range = def.range * (tower.level === 2 ? 1.3 : 1);
    const dmg = def.dmg * lm;

    // Target: enemy furthest along path (closest to exit) within range
    let target: Enemy | null = null;
    for (const e of g.enemies) {
      const [er, ec] = enemyXY(e, g.path);
      if (Math.hypot(ec - tower.col, er - tower.row) <= range) {
        if (!target || e.progress > target.progress) target = e;
      }
    }
    if (!target) continue;

    tower.cooldown = 1 / (def.rate * lm);

    const [ter, tec] = enemyXY(target, g.path);
    const shotHits: ShotHit[] = [];

    if (def.splash) {
      for (const e of g.enemies) {
        const [er, ec] = enemyXY(e, g.path);
        if (Math.hypot(ec - tower.col, er - tower.row) <= range) {
          const d = Math.max(1, dmg - e.armor);
          e.hp -= d;
          shotHits.push({ row: er, col: ec, dmg: d });
        }
      }
    } else {
      const d = Math.max(1, dmg - target.armor);
      target.hp -= d;
      shotHits.push({ row: ter, col: tec, dmg: d });
    }

    shots.push({
      fromRow: tower.row,
      fromCol: tower.col,
      toRow: ter,
      toCol: tec,
      type: tower.type,
      splash: def.splash,
      hits: shotHits,
    });

    // Collect kills
    const dead = g.enemies.filter((e) => e.hp <= 0);
    for (const e of dead) g.gold += e.reward;
    g.enemies = g.enemies.filter((e) => e.hp > 0);
  }

  // Wave complete?
  if (g.spawnQueue.length === 0 && g.enemies.length === 0) {
    if (g.wave >= TOTAL_WAVES - 1) {
      g.phase = "win";
    } else {
      g.phase = "build";
      g.wave++;
      g.gold += 30 + g.wave * 5; // between-wave gold bonus
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TowerDefense() {
  const [tick, setTick] = useState(0);
  const [tool, setTool] = useState<Tool>("basic");
  const gRef = useRef<GState>(initState());
  const rafRef = useRef<number>(0);
  const lastT = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);
  const projRef = useRef<VisProjectile[]>([]);
  const dmgRef = useRef<VisDamageNum[]>([]);

  // Responsive cell size
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 840;
      setCellSize(Math.max(26, Math.min(44, Math.floor((w - 8) / COLS))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // RAF game loop
  useEffect(() => {
    const loop = (t: number) => {
      const dt = Math.min((t - lastT.current) / 1000, 0.1);
      lastT.current = t;
      if (gRef.current.phase === "wave") {
        const shots: ShotEvent[] = [];
        tickGame(gRef.current, dt, shots);

        const now = performance.now();

        // Convert shot events → visual projectiles + damage numbers
        for (const s of shots) {
          const duration = s.type === "sniper" ? 0.12 : s.type === "splash" ? 0.35 : 0.18;
          projRef.current.push({
            id: visId++,
            fromRow: s.fromRow,
            fromCol: s.fromCol,
            toRow: s.toRow,
            toCol: s.toCol,
            type: s.type,
            splash: s.splash,
            born: now,
            duration,
          });
          for (const h of s.hits) {
            dmgRef.current.push({
              id: visId++,
              row: h.row,
              col: h.col,
              dmg: h.dmg,
              born: now,
              color: s.type === "sniper" ? "#a78bfa" : s.type === "splash" ? "#ef4444" : "#60a5fa",
            });
          }
        }

        // Expire old visuals
        projRef.current = projRef.current.filter((p) => now - p.born < p.duration * 1000);
        dmgRef.current = dmgRef.current.filter((d) => now - d.born < 900);

        setTick((n) => n + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    lastT.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const g = gRef.current;
      if (g.phase !== "build") return;
      if (row === ENTRY[0] && col === ENTRY[1]) return;
      if (row === EXIT[0] && col === EXIT[1]) return;

      if (tool === "sell") {
        const idx = g.towers.findIndex((t) => t.row === row && t.col === col);
        if (idx !== -1) {
          const t = g.towers[idx];
          const refund = Math.floor(
            DEFS[t.type].cost * (t.level === 2 ? 1.5 : 0.5),
          );
          g.towers.splice(idx, 1);
          g.grid[row][col] = false;
          g.gold += refund;
          g.path = findPath(g.grid);
          setTick((n) => n + 1);
        }
        return;
      }

      if (g.grid[row][col]) {
        // Upgrade existing tower
        const t = g.towers.find((t) => t.row === row && t.col === col);
        if (t && t.level === 1 && g.gold >= DEFS[t.type].upgCost) {
          g.gold -= DEFS[t.type].upgCost;
          t.level = 2;
          setTick((n) => n + 1);
        }
        return;
      }

      // Place tower
      const def = DEFS[tool];
      if (g.gold < def.cost) return;
      g.grid[row][col] = true;
      const newPath = findPath(g.grid);
      if (!newPath) {
        g.grid[row][col] = false;
        return;
      } // would block path
      g.gold -= def.cost;
      g.path = newPath;
      g.towers.push({
        id: g.nextTId++,
        row,
        col,
        type: tool,
        level: 1,
        cooldown: 0,
      });
      setTick((n) => n + 1);
    },
    [tool],
  );

  const startWave = () => {
    const g = gRef.current;
    if (g.phase !== "build" || !g.path) return;
    g.phase = "wave";
    g.spawnQueue = buildSpawnQueue(WAVES[g.wave]);
    g.spawnTimer = g.spawnQueue.length > 0 ? g.spawnQueue[0].delay : 0;
    setTick((n) => n + 1);
  };

  const reset = () => {
    gRef.current = initState();
    setTick((n) => n + 1);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const g = gRef.current;

  const towerMap = new Map(g.towers.map((t) => [`${t.row},${t.col}`, t]));
  const pathSet = new Set((g.path ?? []).map(([r, c]) => `${r},${c}`));
  const cs = cellSize;
  const gridW = cs * COLS;
  const gridH = cs * ROWS;

  return (
    <Box sx={{ pb: 6 }}>
      {/* HUD */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: { xs: 1.5, md: 3 },
          px: 2,
          py: 1.5,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          💰 {g.gold}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          ❤️ {g.lives} / {MAX_LIVES}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 500, opacity: 0.7 }}>
          Wave {g.wave + 1} / {TOTAL_WAVES}
        </Typography>
        {g.phase === "build" && (
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            {WAVES[g.wave].groups.map((gr, i) => (
              <span key={i}>
                {i > 0 ? " + " : ""}
                {ENEMY_TYPES[gr.type].emoji}×{gr.count}
              </span>
            ))}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {g.phase === "build" && g.path && (
          <button className="btn" onClick={startWave}>
            ▶ Start Wave {g.wave + 1}
          </button>
        )}
        {g.phase === "build" && !g.path && (
          <Typography sx={{ color: "error.main", fontWeight: 600 }}>
            ⚠ Path blocked!
          </Typography>
        )}
        {g.phase === "wave" && (
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            👾 {g.enemies.length} active · {g.spawnQueue.length} incoming
          </Typography>
        )}
      </Box>

      {/* Grid + enemies */}
      <Box ref={containerRef} sx={{ px: 1, pt: 2, overflowX: "auto" }}>
        <Box sx={{ position: "relative", width: gridW, height: gridH }}>
          {/* Cells */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${cs}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cs}px)`,
              border: "2px solid",
              borderColor: "divider",
              position: "absolute",
              inset: 0,
            }}>
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: COLS }, (_, col) => {
                const key = `${row},${col}`;
                const tower = towerMap.get(key);
                const isEntry = row === ENTRY[0] && col === ENTRY[1];
                const isExit = row === EXIT[0] && col === EXIT[1];
                const onPath = pathSet.has(key) && !tower;
                const def = tower ? DEFS[tower.type] : null;

                return (
                  <Box
                    key={key}
                    onClick={() => handleCellClick(row, col)}
                    sx={{
                      width: cs,
                      height: cs,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: cs * 0.44,
                      position: "relative",
                      bgcolor: isEntry
                        ? "#86efac"
                        : isExit
                          ? "#fca5a5"
                          : tower
                            ? `${def!.color}30`
                            : onPath
                              ? "rgba(0,0,0,0.04)"
                              : "background.paper",
                      border: "0.5px solid",
                      borderColor: tower ? def!.color + "88" : "divider",
                      cursor: g.phase === "build" ? "pointer" : "default",
                      userSelect: "none",
                      "&:hover":
                        g.phase === "build" && !tower
                          ? {
                              bgcolor:
                                tool !== "sell"
                                  ? `${DEFS[tool as TowerType]?.color ?? "#ccc"}20`
                                  : "action.hover",
                            }
                          : {},
                    }}>
                    {isEntry ? (
                      <span style={{ fontSize: cs * 0.5 }}>▶</span>
                    ) : isExit ? (
                      <span style={{ fontSize: cs * 0.5 }}>🏁</span>
                    ) : tower ? (
                      <>
                        {def!.emoji}
                        {tower.level === 2 && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 1,
                              right: 1,
                              width: cs * 0.28,
                              height: cs * 0.28,
                              borderRadius: "50%",
                              bgcolor: "#f59e0b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: cs * 0.18,
                              fontWeight: 900,
                              color: "white",
                            }}>
                            ★
                          </Box>
                        )}
                      </>
                    ) : null}
                  </Box>
                );
              }),
            )}
          </Box>

          {/* Projectile SVG overlay */}
          <svg
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6, overflow: "visible" }}
            width={gridW}
            height={gridH}>
            {projRef.current.map((p) => {
              const now = performance.now();
              const t = Math.min(1, (now - p.born) / (p.duration * 1000));
              const x1 = (p.fromCol + 0.5) * cs;
              const y1 = (p.fromRow + 0.5) * cs;
              const x2 = (p.toCol + 0.5) * cs;
              const y2 = (p.toRow + 0.5) * cs;

              if (p.type === "sniper") {
                // Laser beam: full line, fades out
                return (
                  <line
                    key={p.id}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    opacity={1 - t}
                  />
                );
              }

              if (p.type === "splash") {
                // Arc bomb: circle travels along parabolic arc, then ring explosion
                const bx = x1 + (x2 - x1) * t;
                const by = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * cs * 1.2;
                if (t < 0.85) {
                  return (
                    <g key={p.id}>
                      <circle cx={bx} cy={by} r={cs * 0.18} fill="#ef4444" opacity={0.9} />
                      <circle cx={bx} cy={by} r={cs * 0.10} fill="#fbbf24" opacity={0.95} />
                    </g>
                  );
                }
                // Impact ring
                const boom = (t - 0.85) / 0.15;
                return (
                  <g key={p.id}>
                    <circle cx={x2} cy={y2} r={cs * 0.8 * boom} fill="none" stroke="#ef4444" strokeWidth={3} opacity={1 - boom} />
                    <circle cx={x2} cy={y2} r={cs * 0.4 * boom} fill="#fbbf24" opacity={(1 - boom) * 0.5} />
                  </g>
                );
              }

              // Basic: bullet dot travelling from tower to enemy
              const bx = x1 + (x2 - x1) * t;
              const by = y1 + (y2 - y1) * t;
              return (
                <g key={p.id}>
                  <circle cx={bx} cy={by} r={cs * 0.14} fill="#60a5fa" opacity={0.95} />
                  <circle cx={bx} cy={by} r={cs * 0.07} fill="white" opacity={0.9} />
                </g>
              );
            })}
          </svg>

          {/* Damage numbers */}
          {dmgRef.current.map((d) => {
            const now = performance.now();
            const t = Math.min(1, (now - d.born) / 900);
            const x = (d.col + 0.5) * cs;
            const y = (d.row + 0.5) * cs - t * cs * 1.4;
            return (
              <div
                key={d.id}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 8,
                  fontWeight: 900,
                  fontSize: Math.max(10, cs * 0.38),
                  color: d.color,
                  opacity: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4,
                  textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}>
                -{d.dmg}
              </div>
            );
          })}

          {/* Enemies */}
          {g.path &&
            g.enemies.map((enemy) => {
              const [er, ec] = enemyXY(enemy, g.path!);
              const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
              const typeDef = ENEMY_TYPES[enemy.type];
              const eSize = cs * 0.68 * typeDef.sizeMult;
              return (
                <Box
                  key={enemy.id}
                  sx={{
                    position: "absolute",
                    left: ec * cs + cs / 2 - eSize / 2,
                    top: er * cs + cs / 2 - eSize / 2,
                    width: eSize,
                    height: eSize,
                    borderRadius: "50%",
                    bgcolor: typeDef.color,
                    border:
                      enemy.type === "boss"
                        ? "3px solid #b91c1c"
                        : enemy.type === "armored"
                          ? "2px solid #64748b"
                          : "2px solid rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: eSize * 0.5,
                    pointerEvents: "none",
                    zIndex: 5,
                    opacity: hpPct > 0.3 ? 1 : 0.7,
                  }}>
                  {typeDef.emoji}
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: -3,
                      left: 0,
                      right: 0,
                      height: 3,
                      bgcolor: "rgba(0,0,0,0.2)",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}>
                    <Box
                      sx={{
                        width: `${hpPct * 100}%`,
                        height: "100%",
                        borderRadius: 1,
                        bgcolor:
                          hpPct > 0.6
                            ? "#16a34a"
                            : hpPct > 0.3
                              ? "#ca8a04"
                              : "#dc2626",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
        </Box>

        {/* Tower picker */}
        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
          {(Object.entries(DEFS) as [TowerType, TowerDef][]).map(
            ([type, def]) => (
              <Box
                key={type}
                onClick={() => setTool(type)}
                sx={{
                  border: "2px solid",
                  borderColor: tool === type ? def.color : "divider",
                  borderRadius: 2,
                  p: 1.5,
                  minWidth: 90,
                  cursor: "pointer",
                  bgcolor:
                    tool === type ? `${def.color}20` : "background.paper",
                  opacity: g.gold < def.cost ? 0.45 : 1,
                  "&:hover": { bgcolor: `${def.color}15` },
                }}>
                <Typography sx={{ fontSize: "1.6rem", textAlign: "center" }}>
                  {def.emoji}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, textAlign: "center" }}>
                  {def.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", textAlign: "center", opacity: 0.6 }}>
                  💰{def.cost} · ⬆️{def.upgCost}
                </Typography>
              </Box>
            ),
          )}
          <Box
            onClick={() => setTool("sell")}
            sx={{
              border: "2px solid",
              borderColor: tool === "sell" ? "#f59e0b" : "divider",
              borderRadius: 2,
              p: 1.5,
              minWidth: 90,
              cursor: "pointer",
              bgcolor: tool === "sell" ? "#f59e0b20" : "background.paper",
              "&:hover": { bgcolor: "#f59e0b15" },
            }}>
            <Typography sx={{ fontSize: "1.6rem", textAlign: "center" }}>
              💸
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, textAlign: "center" }}>
              Sell
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", textAlign: "center", opacity: 0.6 }}>
              50% back
            </Typography>
          </Box>
        </Box>

        {/* Tips */}
        <Box sx={{ mt: 1.5, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ opacity: 0.5 }}>
            Click empty cell to place · Click your own tower to upgrade (Lv★)
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.5 }}>
            🗼 steady damage &nbsp;·&nbsp; 🎯 long range, high burst
            &nbsp;·&nbsp; 💣 hits all nearby enemies
          </Typography>
        </Box>
      </Box>

      {/* Game Over overlay */}
      {g.phase === "gameover" && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}>
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 4,
              p: 4,
              textAlign: "center",
              maxWidth: 300,
            }}>
            <Typography sx={{ fontSize: "3rem" }}>💀</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
              Game Over
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, opacity: 0.6 }}>
              You made it to Wave {g.wave + 1}
            </Typography>
            <button className="btn" onClick={reset}>
              Play Again
            </button>
          </Box>
        </Box>
      )}

      {/* Win overlay */}
      {g.phase === "win" && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}>
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 4,
              p: 4,
              textAlign: "center",
              maxWidth: 300,
            }}>
            <div className="cooking-stars">🏆 ⭐ 🏆</div>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
              You Won!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, opacity: 0.6 }}>
              All {TOTAL_WAVES} waves defeated!
            </Typography>
            <button className="btn" onClick={reset}>
              Play Again
            </button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
