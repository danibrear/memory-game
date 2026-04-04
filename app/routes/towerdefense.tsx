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
const TOTAL_WAVES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type TowerType = "basic" | "sniper" | "splash";
type Tool = TowerType | "sell";
type Phase = "build" | "wave" | "gameover" | "win";

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
  basic:  { label: "Basic",  emoji: "🗼", color: "#3b82f6", cost: 50,  upgCost: 40,  dmg: 30,  range: 3,   rate: 1.5, splash: false },
  sniper: { label: "Sniper", emoji: "🎯", color: "#8b5cf6", cost: 100, upgCost: 80,  dmg: 100, range: 6,   rate: 0.5, splash: false },
  splash: { label: "Splash", emoji: "💣", color: "#ef4444", cost: 75,  upgCost: 60,  dmg: 20,  range: 2.5, rate: 2.0, splash: true  },
};

interface WaveDef {
  count: number;
  hp: number;
  speed: number; // path nodes/sec
  reward: number;
  interval: number; // sec between spawns
}

const WAVES: WaveDef[] = [
  { count: 6,  hp: 60,   speed: 2.0, reward: 8,  interval: 1.2  },
  { count: 8,  hp: 90,   speed: 2.2, reward: 10, interval: 1.0  },
  { count: 10, hp: 130,  speed: 2.5, reward: 12, interval: 0.9  },
  { count: 12, hp: 190,  speed: 2.7, reward: 14, interval: 0.8  },
  { count: 14, hp: 270,  speed: 3.0, reward: 15, interval: 0.75 },
  { count: 15, hp: 380,  speed: 3.2, reward: 18, interval: 0.65 },
  { count: 18, hp: 530,  speed: 3.4, reward: 20, interval: 0.6  },
  { count: 20, hp: 750,  speed: 3.6, reward: 25, interval: 0.55 },
  { count: 22, hp: 1050, speed: 3.8, reward: 30, interval: 0.5  },
  { count: 25, hp: 1500, speed: 4.0, reward: 40, interval: 0.45 },
];

interface Enemy {
  id: number;
  progress: number; // float index along path
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
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
  spawnLeft: number;
  spawnTimer: number;
  nextEId: number;
  nextTId: number;
}

// ─── Pure helpers (defined outside component) ─────────────────────────────────

function findPath(grid: boolean[][]): [number, number][] | null {
  const [sr, sc] = ENTRY;
  const [er, ec] = EXIT;
  const queue: [[number, number], [number, number][]][] = [[[sr, sc], [[sr, sc]]]];
  const seen = new Set<string>([`${sr},${sc}`]);
  while (queue.length) {
    const [[r, c], path] = queue.shift()!;
    if (r === er && c === ec) return path;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as [number, number][]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k) || grid[nr][nc]) continue;
      seen.add(k);
      queue.push([[nr, nc], [...path, [nr, nc]]]);
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

function initState(): GState {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]);
  return {
    phase: "build", grid,
    towers: [], enemies: [],
    path: findPath(grid),
    gold: START_GOLD, lives: MAX_LIVES,
    wave: 0, spawnLeft: 0, spawnTimer: 0,
    nextEId: 0, nextTId: 0,
  };
}

function tickGame(g: GState, dt: number) {
  const wave = WAVES[g.wave];

  // Spawn
  if (g.spawnLeft > 0) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      g.enemies.push({
        id: g.nextEId++, progress: 0,
        hp: wave.hp, maxHp: wave.hp,
        speed: wave.speed, reward: wave.reward,
      });
      g.spawnLeft--;
      g.spawnTimer = wave.interval;
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
      g.enemies = g.enemies.filter(e => !escaped.includes(e.id));
      g.lives = Math.max(0, g.lives - escaped.length);
      if (g.lives === 0) { g.phase = "gameover"; g.enemies = []; return; }
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

    if (def.splash) {
      for (const e of g.enemies) {
        const [er, ec] = enemyXY(e, g.path);
        if (Math.hypot(ec - tower.col, er - tower.row) <= range) e.hp -= dmg;
      }
    } else {
      target.hp -= dmg;
    }

    // Collect kills
    const dead = g.enemies.filter(e => e.hp <= 0);
    for (const e of dead) g.gold += e.reward;
    g.enemies = g.enemies.filter(e => e.hp > 0);
  }

  // Wave complete?
  if (g.spawnLeft === 0 && g.enemies.length === 0) {
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
        tickGame(gRef.current, dt);
        setTick(n => n + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    lastT.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    const g = gRef.current;
    if (g.phase !== "build") return;
    if (row === ENTRY[0] && col === ENTRY[1]) return;
    if (row === EXIT[0] && col === EXIT[1]) return;

    if (tool === "sell") {
      const idx = g.towers.findIndex(t => t.row === row && t.col === col);
      if (idx !== -1) {
        const t = g.towers[idx];
        const refund = Math.floor(DEFS[t.type].cost * (t.level === 2 ? 1.5 : 0.5));
        g.towers.splice(idx, 1);
        g.grid[row][col] = false;
        g.gold += refund;
        g.path = findPath(g.grid);
        setTick(n => n + 1);
      }
      return;
    }

    if (g.grid[row][col]) {
      // Upgrade existing tower
      const t = g.towers.find(t => t.row === row && t.col === col);
      if (t && t.level === 1 && g.gold >= DEFS[t.type].upgCost) {
        g.gold -= DEFS[t.type].upgCost;
        t.level = 2;
        setTick(n => n + 1);
      }
      return;
    }

    // Place tower
    const def = DEFS[tool];
    if (g.gold < def.cost) return;
    g.grid[row][col] = true;
    const newPath = findPath(g.grid);
    if (!newPath) { g.grid[row][col] = false; return; } // would block path
    g.gold -= def.cost;
    g.path = newPath;
    g.towers.push({ id: g.nextTId++, row, col, type: tool, level: 1, cooldown: 0 });
    setTick(n => n + 1);
  }, [tool]);

  const startWave = () => {
    const g = gRef.current;
    if (g.phase !== "build" || !g.path) return;
    g.phase = "wave";
    g.spawnLeft = WAVES[g.wave].count;
    g.spawnTimer = 0;
    setTick(n => n + 1);
  };

  const reset = () => { gRef.current = initState(); setTick(n => n + 1); };

  // ── Render ──────────────────────────────────────────────────────────────────

  const g = gRef.current;

  const towerMap = new Map(g.towers.map(t => [`${t.row},${t.col}`, t]));
  const pathSet = new Set((g.path ?? []).map(([r, c]) => `${r},${c}`));
  const cs = cellSize;
  const gridW = cs * COLS;
  const gridH = cs * ROWS;

  return (
    <Box sx={{ pb: 6 }}>

      {/* HUD */}
      <Box sx={{
        display: "flex", alignItems: "center", flexWrap: "wrap",
        gap: { xs: 1.5, md: 3 }, px: 2, py: 1.5,
        bgcolor: "background.paper",
        borderBottom: "1px solid", borderColor: "divider",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>💰 {g.gold}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>❤️ {g.lives} / {MAX_LIVES}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 500, opacity: 0.7 }}>
          Wave {g.wave + 1} / {TOTAL_WAVES}
        </Typography>
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
            👾 {g.enemies.length} active · {g.spawnLeft} incoming
          </Typography>
        )}
      </Box>

      {/* Grid + enemies */}
      <Box ref={containerRef} sx={{ px: 1, pt: 2, overflowX: "auto" }}>
        <Box sx={{ position: "relative", width: gridW, height: gridH }}>

          {/* Cells */}
          <Box sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${cs}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${cs}px)`,
            border: "2px solid",
            borderColor: "divider",
            position: "absolute", inset: 0,
          }}>
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: COLS }, (_, col) => {
                const key = `${row},${col}`;
                const tower = towerMap.get(key);
                const isEntry = row === ENTRY[0] && col === ENTRY[1];
                const isExit  = row === EXIT[0]  && col === EXIT[1];
                const onPath  = pathSet.has(key) && !tower;
                const def     = tower ? DEFS[tower.type] : null;

                return (
                  <Box
                    key={key}
                    onClick={() => handleCellClick(row, col)}
                    sx={{
                      width: cs, height: cs,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: cs * 0.44,
                      position: "relative",
                      bgcolor: isEntry ? "#86efac"
                               : isExit  ? "#fca5a5"
                               : tower   ? `${def!.color}30`
                               : onPath  ? "rgba(0,0,0,0.04)"
                               : "background.paper",
                      border: "0.5px solid",
                      borderColor: tower ? def!.color + "88" : "divider",
                      cursor: g.phase === "build" ? "pointer" : "default",
                      userSelect: "none",
                      "&:hover": g.phase === "build" && !tower ? {
                        bgcolor: tool !== "sell" ? `${DEFS[tool as TowerType]?.color ?? "#ccc"}20` : "action.hover",
                      } : {},
                    }}>
                    {isEntry ? <span style={{ fontSize: cs * 0.5 }}>▶</span>
                     : isExit  ? <span style={{ fontSize: cs * 0.5 }}>🏁</span>
                     : tower   ? (
                      <>
                        {def!.emoji}
                        {tower.level === 2 && (
                          <Box sx={{
                            position: "absolute", top: 1, right: 1,
                            width: cs * 0.28, height: cs * 0.28,
                            borderRadius: "50%",
                            bgcolor: "#f59e0b",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: cs * 0.18, fontWeight: 900, color: "white",
                          }}>★</Box>
                        )}
                      </>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Box>

          {/* Enemies */}
          {g.path && g.enemies.map(enemy => {
            const [er, ec] = enemyXY(enemy, g.path!);
            const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
            const eSize = cs * 0.68;
            return (
              <Box
                key={enemy.id}
                sx={{
                  position: "absolute",
                  left: ec * cs + cs / 2 - eSize / 2,
                  top:  er * cs + cs / 2 - eSize / 2,
                  width: eSize, height: eSize,
                  borderRadius: "50%",
                  bgcolor: hpPct > 0.6 ? "#4ade80" : hpPct > 0.3 ? "#facc15" : "#f87171",
                  border: "2px solid rgba(0,0,0,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: eSize * 0.5,
                  pointerEvents: "none",
                  zIndex: 5,
                }}>
                👾
                <Box sx={{
                  position: "absolute", bottom: -3, left: 0, right: 0,
                  height: 3, bgcolor: "rgba(0,0,0,0.2)", borderRadius: 1, overflow: "hidden",
                }}>
                  <Box sx={{
                    width: `${hpPct * 100}%`, height: "100%", borderRadius: 1,
                    bgcolor: hpPct > 0.6 ? "#16a34a" : hpPct > 0.3 ? "#ca8a04" : "#dc2626",
                  }} />
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Tower picker */}
        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
          {(Object.entries(DEFS) as [TowerType, TowerDef][]).map(([type, def]) => (
            <Box
              key={type}
              onClick={() => setTool(type)}
              sx={{
                border: "2px solid",
                borderColor: tool === type ? def.color : "divider",
                borderRadius: 2, p: 1.5, minWidth: 90, cursor: "pointer",
                bgcolor: tool === type ? `${def.color}20` : "background.paper",
                opacity: g.gold < def.cost ? 0.45 : 1,
                "&:hover": { bgcolor: `${def.color}15` },
              }}>
              <Typography sx={{ fontSize: "1.6rem", textAlign: "center" }}>{def.emoji}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "center" }}>{def.label}</Typography>
              <Typography variant="caption" sx={{ display: "block", textAlign: "center", opacity: 0.6 }}>
                💰{def.cost} · ⬆️{def.upgCost}
              </Typography>
            </Box>
          ))}
          <Box
            onClick={() => setTool("sell")}
            sx={{
              border: "2px solid",
              borderColor: tool === "sell" ? "#f59e0b" : "divider",
              borderRadius: 2, p: 1.5, minWidth: 90, cursor: "pointer",
              bgcolor: tool === "sell" ? "#f59e0b20" : "background.paper",
              "&:hover": { bgcolor: "#f59e0b15" },
            }}>
            <Typography sx={{ fontSize: "1.6rem", textAlign: "center" }}>💸</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "center" }}>Sell</Typography>
            <Typography variant="caption" sx={{ display: "block", textAlign: "center", opacity: 0.6 }}>
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
            🗼 steady damage &nbsp;·&nbsp; 🎯 long range, high burst &nbsp;·&nbsp; 💣 hits all nearby enemies
          </Typography>
        </Box>
      </Box>

      {/* Game Over overlay */}
      {g.phase === "gameover" && (
        <Box sx={{
          position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }}>
          <Box sx={{ bgcolor: "background.paper", borderRadius: 4, p: 4, textAlign: "center", maxWidth: 300 }}>
            <Typography sx={{ fontSize: "3rem" }}>💀</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>Game Over</Typography>
            <Typography variant="body1" sx={{ mb: 3, opacity: 0.6 }}>
              You made it to Wave {g.wave + 1}
            </Typography>
            <button className="btn" onClick={reset}>Play Again</button>
          </Box>
        </Box>
      )}

      {/* Win overlay */}
      {g.phase === "win" && (
        <Box sx={{
          position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }}>
          <Box sx={{ bgcolor: "background.paper", borderRadius: 4, p: 4, textAlign: "center", maxWidth: 300 }}>
            <div className="cooking-stars">🏆 ⭐ 🏆</div>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>You Won!</Typography>
            <Typography variant="body1" sx={{ mb: 3, opacity: 0.6 }}>
              All {TOTAL_WAVES} waves defeated!
            </Typography>
            <button className="btn" onClick={reset}>Play Again</button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
