import {
  faArrowRight,
  faPlay,
  faRotateLeft,
  faStar,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, Chip, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/arrows";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Arrow Escape - Games by DaniB" },
    { name: "description", content: "Tap arrows that can escape to the outside. Clear the board!" },
  ];
}

// ─── Constants & metrics ──────────────────────────────────────────────────────

const STORAGE_KEY = "arrows-best-v2";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
  "#3b82f6", "#f43f5e",
];

interface Metrics { cellSize: number; gap: number; stride: number; strokeW: number }

// Shrinks cells so the board always fits ~340 px (mobile-first)
function computeMetrics(gridSize: number): Metrics {
  const gap = 2;
  const target = 340;
  const cellSize = Math.max(14, Math.floor((target - (gridSize - 1) * gap) / gridSize));
  return { cellSize, gap, stride: cellSize + gap, strokeW: Math.floor(cellSize * 0.76) };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right";
type GameState  = "START" | "PLAYING" | "WON";
type Difficulty = "easy" | "medium" | "hard";
type AnimKind   = "escaping" | "bouncing" | "blocked";

interface AnimEntry { kind: AnimKind; seq: number }

interface Arrow {
  id: string;
  cells: [number, number][]; // tail-first, head-last
  direction: Direction;
  color: string;
}

interface BestScores { easy?: number; medium?: number; hard?: number }

const CONFIGS: Record<Difficulty, { gridSize: number; count: number; label: string; maxLen: number }> = {
  easy:   { gridSize: 10, count: 25,  label: "Easy",   maxLen: 4 },
  medium: { gridSize: 14, count: 50,  label: "Medium",  maxLen: 3 },
  hard:   { gridSize: 18, count: 100, label: "Hard",    maxLen: 3 },
};

// ─── Direction helpers ────────────────────────────────────────────────────────

const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down", down: "up", left: "right", right: "left",
};
const ALL_DIRS: Direction[] = ["up", "down", "left", "right"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getExitDir(cells: [number, number][]): Direction {
  const n = cells.length;
  const [r1, c1] = cells[n - 2];
  const [r2, c2] = cells[n - 1];
  if (r2 > r1) return "down";
  if (r2 < r1) return "up";
  if (c2 > c1) return "right";
  return "left";
}

// ─── Easing ───────────────────────────────────────────────────────────────────

function easeInCubic(t: number) { return t * t * t; }

function springOut(t: number): number {
  if (t < 0.35) return t / 0.35;
  if (t < 0.65) return 1;
  if (t < 0.82) return 1 - ((t - 0.65) / 0.17) * 1.18;
  return -0.18 + ((t - 0.82) / 0.18) * 0.18;
}

// ─── Game logic ───────────────────────────────────────────────────────────────

function canEscape(arrow: Arrow, all: Arrow[], gridSize: number): boolean {
  const occupied = new Set<string>();
  for (const a of all) {
    if (a.id === arrow.id) continue;
    for (const [r, c] of a.cells) occupied.add(`${r},${c}`);
  }
  const [hr, hc] = arrow.cells[arrow.cells.length - 1];
  const [dr, dc] = DELTA[arrow.direction];
  let r = hr + dr, c = hc + dc;
  while (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
    if (occupied.has(`${r},${c}`)) return false;
    r += dr; c += dc;
  }
  return true;
}

function getBlocker(arrow: Arrow, all: Arrow[], gridSize: number): Arrow | null {
  const cellMap = new Map<string, Arrow>();
  for (const a of all) {
    if (a.id === arrow.id) continue;
    for (const [r, c] of a.cells) cellMap.set(`${r},${c}`, a);
  }
  const [hr, hc] = arrow.cells[arrow.cells.length - 1];
  const [dr, dc] = DELTA[arrow.direction];
  let r = hr + dr, c = hc + dc;
  while (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
    const found = cellMap.get(`${r},${c}`);
    if (found) return found;
    r += dr; c += dc;
  }
  return null;
}

// Only used for small puzzles — large ones always use the guaranteed builder
function isSolvable(arrows: Arrow[], gridSize: number): boolean {
  let calls = 0;
  function solve(rem: Arrow[]): boolean | null {
    if (++calls > 50000) return null;
    if (rem.length === 0) return true;
    for (const a of rem) {
      if (canEscape(a, rem, gridSize)) {
        const res = solve(rem.filter((x) => x.id !== a.id));
        if (res === true) return true;
        if (res === null) return null;
      }
    }
    return false;
  }
  return solve(arrows) === true;
}

// ─── Puzzle generation ────────────────────────────────────────────────────────

function randomWalk(
  sr: number, sc: number,
  occupied: Set<string>,
  gridSize: number,
  maxLen: number,
): [number, number][] {
  const cells: [number, number][] = [[sr, sc]];
  const cellSet = new Set<string>([`${sr},${sc}`]);
  const target = 2 + Math.floor(Math.random() * (maxLen - 1));
  let curDir: Direction = ALL_DIRS[Math.floor(Math.random() * 4)];

  while (cells.length < target) {
    const [cr, cc] = cells[cells.length - 1];
    const options: Direction[] = Math.random() < 0.55
      ? [curDir, ...shuffle(ALL_DIRS.filter((d) => d !== curDir && d !== OPPOSITE[curDir]))]
      : shuffle(ALL_DIRS.filter((d) => d !== OPPOSITE[curDir]));

    let moved = false;
    for (const dir of options) {
      const [dr, dc] = DELTA[dir];
      const nr = cr + dr, nc = cc + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize
          && !occupied.has(key) && !cellSet.has(key)) {
        cells.push([nr, nc]);
        cellSet.add(key);
        curDir = dir;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return cells;
}

function generatePuzzle(difficulty: Difficulty): Arrow[] {
  const { gridSize, count, maxLen } = CONFIGS[difficulty];

  // For large puzzles the DFS is intractable — jump straight to guaranteed builder
  if (count > 15) return buildGuaranteedPuzzle(difficulty);

  for (let attempt = 0; attempt < 80; attempt++) {
    const occupied = new Set<string>();
    const arrows: Arrow[] = [];
    const starts = shuffle(
      Array.from({ length: gridSize * gridSize }, (_, i) =>
        [Math.floor(i / gridSize), i % gridSize] as [number, number])
    );
    for (const [sr, sc] of starts) {
      if (arrows.length >= count) break;
      if (occupied.has(`${sr},${sc}`)) continue;
      const cells = randomWalk(sr, sc, occupied, gridSize, maxLen);
      if (cells.length < 2) continue;
      const arrow: Arrow = {
        id: `a${arrows.length}`,
        cells,
        direction: getExitDir(cells),
        color: COLORS[arrows.length % COLORS.length],
      };
      arrows.push(arrow);
      cells.forEach(([r, c]) => occupied.add(`${r},${c}`));
    }
    if (arrows.length >= count && isSolvable(arrows, gridSize)) return arrows;
  }

  return buildGuaranteedPuzzle(difficulty);
}

// Reverse construction: each arrow is escapable when placed, so removing in
// reverse-insertion order is always a valid solution.
function buildGuaranteedPuzzle(difficulty: Difficulty): Arrow[] {
  const { gridSize, count, maxLen } = CONFIGS[difficulty];
  const placed: Arrow[] = [];
  const occupied = new Set<string>();

  for (let i = 0; i < count * 20 && placed.length < count; i++) {
    const sr = Math.floor(Math.random() * gridSize);
    const sc = Math.floor(Math.random() * gridSize);
    if (occupied.has(`${sr},${sc}`)) continue;
    const cells = randomWalk(sr, sc, occupied, gridSize, maxLen);
    if (cells.length < 2) continue;
    const arrow: Arrow = {
      id: `a${placed.length}`,
      cells,
      direction: getExitDir(cells),
      color: COLORS[placed.length % COLORS.length],
    };
    if (canEscape(arrow, [...placed, arrow], gridSize)) {
      placed.push(arrow);
      cells.forEach(([r, c]) => occupied.add(`${r},${c}`));
    }
  }
  return placed;
}

// ─── SVG helpers (metrics-aware) ─────────────────────────────────────────────

function buildSvgPath(cells: [number, number][], m: Metrics): string {
  const cx = (c: number) => c * m.stride + m.cellSize / 2;
  const cy = (r: number) => r * m.stride + m.cellSize / 2;
  const [[r0, c0], ...rest] = cells;
  let d = `M ${cx(c0)},${cy(r0)}`;
  for (const [r, c] of rest) d += ` L ${cx(c)},${cy(r)}`;
  return d;
}

function buildArrowhead(cells: [number, number][], dir: Direction, m: Metrics): string {
  const [hr, hc] = cells[cells.length - 1];
  const x = hc * m.stride + m.cellSize / 2;
  const y = hr * m.stride + m.cellSize / 2;
  const s = m.strokeW * 0.5;
  switch (dir) {
    case "right": return `${x+s},${y} ${x-s*.55},${y-s*.72} ${x-s*.55},${y+s*.72}`;
    case "left":  return `${x-s},${y} ${x+s*.55},${y-s*.72} ${x+s*.55},${y+s*.72}`;
    case "down":  return `${x},${y+s} ${x-s*.72},${y-s*.55} ${x+s*.72},${y-s*.55}`;
    case "up":    return `${x},${y-s} ${x-s*.72},${y+s*.55} ${x+s*.72},${y+s*.55}`;
  }
}

// ─── ArrowG ───────────────────────────────────────────────────────────────────

interface ArrowGProps {
  arrow: Arrow;
  anim: AnimEntry | null;
  metrics: Metrics;
  onAnimEnd: (id: string) => void;
  onClick: () => void;
}

function ArrowG({ arrow, anim, metrics: m, onAnimEnd, onClick }: ArrowGProps) {
  const { id, cells, direction, color } = arrow;
  const pathD   = buildSvgPath(cells, m);
  const headPts = buildArrowhead(cells, direction, m);
  const pathLen = (cells.length - 1) * m.stride;

  const groupRef  = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGPathElement>(null);
  const bodyRef   = useRef<SVGPathElement>(null);
  const hlRef     = useRef<SVGPathElement>(null);
  const headRef   = useRef<SVGPolygonElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (groupRef.current) {
      groupRef.current.style.transform = "";
      groupRef.current.style.filter    = "";
    }
    [shadowRef, bodyRef, hlRef].forEach(ref => {
      if (ref.current) {
        ref.current.style.strokeDasharray  = "";
        ref.current.style.strokeDashoffset = "";
      }
    });
    if (headRef.current) {
      headRef.current.style.transform = "";
      headRef.current.style.opacity   = "";
    }

    if (!anim) return;

    const { kind } = anim;
    const [dr, dc] = DELTA[direction];
    const start    = performance.now();

    if (kind === "escaping") {
      const TOTAL = 520;
      [shadowRef, bodyRef, hlRef].forEach(ref => {
        if (ref.current) ref.current.style.strokeDasharray = `${pathLen}`;
      });

      const tick = (now: number) => {
        const t    = Math.min((now - start) / TOTAL, 1);
        const ease = easeInCubic(t);

        const offset = `${-ease * pathLen}`;
        [shadowRef, bodyRef, hlRef].forEach(ref => {
          if (ref.current) ref.current.style.strokeDashoffset = offset;
        });

        if (headRef.current) {
          headRef.current.style.transform =
            `translate(${dc * ease * m.stride * 1.8}px,${dr * ease * m.stride * 1.8}px)`;
          headRef.current.style.opacity = `${1 - ease}`;
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onAnimEnd(id);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    if (kind === "bouncing") {
      const DUR = 540;
      const tick = (now: number) => {
        const t      = Math.min((now - start) / DUR, 1);
        const factor = springOut(t);
        if (groupRef.current) {
          groupRef.current.style.transform =
            `translate(${dc * factor * 28}px,${dr * factor * 28}px)`;
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          if (groupRef.current) groupRef.current.style.transform = "";
          onAnimEnd(id);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    if (kind === "blocked") {
      const DUR = 460;
      const tick = (now: number) => {
        const t     = Math.min((now - start) / DUR, 1);
        const pulse = Math.sin(t * Math.PI);
        if (groupRef.current) {
          groupRef.current.style.filter =
            `brightness(${1 + pulse * 1.1}) drop-shadow(0 0 ${pulse * 14}px white)`;
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          if (groupRef.current) groupRef.current.style.filter = "";
          onAnimEnd(id);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim?.seq]);

  return (
    <g ref={groupRef} onClick={onClick} style={{ cursor: "pointer" }}>
      <path ref={shadowRef} d={pathD} fill="none" stroke="rgba(0,0,0,0.32)"
        strokeWidth={m.strokeW + 4} strokeLinecap="round" strokeLinejoin="round"
        transform="translate(2,3)" />
      <path ref={bodyRef} d={pathD} fill="none" stroke={color}
        strokeWidth={m.strokeW} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={hlRef} d={pathD} fill="none" stroke="rgba(255,255,255,0.2)"
        strokeWidth={m.strokeW * 0.42} strokeLinecap="round" strokeLinejoin="round" />
      <polygon ref={headRef} points={headPts} fill="rgba(0,0,0,0.38)" />
      <path d={pathD} fill="none" stroke="transparent"
        strokeWidth={m.strokeW + 18} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArrowsGame() {
  const [gameState, setGameState]   = useState<GameState>("START");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [arrows, setArrows]         = useState<Arrow[]>([]);
  const [gridSize, setGridSize]     = useState(14);
  const [metrics, setMetrics]       = useState<Metrics>(() => computeMetrics(14));
  const [moves, setMoves]           = useState(0);
  const [bestScores, setBestScores] = useState<BestScores>({});
  const [animMap, setAnimMap]       = useState<Map<string, AnimEntry>>(new Map());

  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY);
    if (stored) setBestScores(stored);
  }, []);

  const startGame = useCallback((diff: Difficulty) => {
    const cfg = CONFIGS[diff];
    const m   = computeMetrics(cfg.gridSize);
    const puzzle = generatePuzzle(diff);
    setArrows(puzzle);
    setGridSize(cfg.gridSize);
    setMetrics(m);
    setMoves(0);
    setAnimMap(new Map());
    setGameState("PLAYING");
    setDifficulty(diff);
  }, []);

  const handleAnimEnd = useCallback((arrowId: string) => {
    setAnimMap((prev) => {
      const m = new Map(prev);
      const entry = m.get(arrowId);
      if (entry?.kind === "escaping") {
        setArrows((prev) => {
          const next = prev.filter((a) => a.id !== arrowId);
          if (next.length === 0) {
            setGameState("WON");
            setMoves((mv) => {
              setBestScores((bs) => {
                const updated = { ...bs };
                if (updated[difficulty] === undefined || mv < updated[difficulty]!) {
                  updated[difficulty] = mv;
                  setStoredData(STORAGE_KEY, updated);
                }
                return updated;
              });
              return mv;
            });
          }
          return next;
        });
      }
      m.delete(arrowId);
      return m;
    });
  }, [difficulty]);

  const handleArrowClick = useCallback((arrow: Arrow) => {
    if (animMap.has(arrow.id)) return;
    const nextSeq = (animMap.get(arrow.id)?.seq ?? 0) + 1;

    if (canEscape(arrow, arrows, gridSize)) {
      setMoves((m) => m + 1);
      setAnimMap((prev) =>
        new Map(prev).set(arrow.id, { kind: "escaping", seq: nextSeq })
      );
    } else {
      setAnimMap((prev) =>
        new Map(prev).set(arrow.id, { kind: "bouncing", seq: nextSeq })
      );
      const blocker = getBlocker(arrow, arrows, gridSize);
      if (blocker && !animMap.has(blocker.id)) {
        const bSeq = (animMap.get(blocker.id)?.seq ?? 0) + 1;
        setAnimMap((prev) =>
          new Map(prev).set(blocker.id, { kind: "blocked", seq: bSeq })
        );
      }
    }
  }, [animMap, arrows, gridSize]);

  const svgSize = gridSize * metrics.stride - metrics.gap;

  return (
    <Container maxWidth="sm" sx={{ py: 3, textAlign: "center" }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900, mb: 0.5,
          background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
        Arrow Escape
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Tap arrows that can slide out. Clear the board!
      </Typography>

      {/* ── START ── */}
      {gameState === "START" && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, mt: 4 }}>
          <Box sx={{
            width: 110, height: 110, borderRadius: "50%",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.8rem", boxShadow: "0 8px 32px #06b6d444",
          }}>
            <FontAwesomeIcon icon={faArrowRight} style={{ color: "white" }} />
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
            {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => {
              const cfg  = CONFIGS[diff];
              const best = bestScores[diff];
              const grad = diff === "easy"
                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : diff === "medium"
                  ? "linear-gradient(135deg,#f97316,#ea580c)"
                  : "linear-gradient(135deg,#ef4444,#dc2626)";
              const shadow = diff === "easy" ? "#22c55e44" : diff === "medium" ? "#f9731644" : "#ef444444";
              return (
                <Box key={diff} onClick={() => startGame(diff)} sx={{
                  background: grad, borderRadius: 3, p: 3, cursor: "pointer",
                  minWidth: 110, boxShadow: `0 6px 20px ${shadow}`,
                  transition: "transform 0.15s ease",
                  "&:hover": { transform: "translateY(-4px)" },
                  "&:active": { transform: "scale(0.96)" },
                }}>
                  <Typography variant="h6" sx={{ color: "white", fontWeight: 800, mb: 0.5 }}>
                    {cfg.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)" }}>
                    {cfg.count} arrows · {cfg.gridSize}×{cfg.gridSize}
                  </Typography>
                  {best !== undefined && (
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.95)", display: "block", mt: 0.5 }}>
                      <FontAwesomeIcon icon={faTrophy} style={{ marginRight: 4 }} />
                      Best: {best}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── PLAYING ── */}
      {gameState === "PLAYING" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, px: 1 }}>
            <Chip label={`${arrows.length} left`} size="small" sx={{ fontWeight: 700 }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Moves: {moves}</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="outlined"
                onClick={() => startGame(difficulty)}
                startIcon={<FontAwesomeIcon icon={faRotateLeft} />}
                sx={{ minWidth: 0, px: 1.5, fontSize: "0.75rem" }}>
                New
              </Button>
              <Button size="small" variant="outlined"
                onClick={() => setGameState("START")}
                sx={{ minWidth: 0, px: 1.5, fontSize: "0.75rem" }}>
                Menu
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "center", mb: 2, overflowX: "auto" }}>
            <Box sx={{
              background: "rgba(255,255,255,0.04)",
              border: "2px solid rgba(255,255,255,0.1)",
              borderRadius: 2,
              p: `${metrics.gap}px`,
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <svg width={svgSize} height={svgSize} style={{ display: "block", overflow: "visible" }}>
                <defs>
                  <clipPath id="board-clip">
                    <rect
                      x={-metrics.strokeW} y={-metrics.strokeW}
                      width={svgSize + metrics.strokeW * 2}
                      height={svgSize + metrics.strokeW * 2}
                    />
                  </clipPath>
                </defs>
                {Array.from({ length: gridSize }).map((_, r) =>
                  Array.from({ length: gridSize }).map((_, c) => (
                    <rect
                      key={`${r}-${c}`}
                      x={c * metrics.stride} y={r * metrics.stride}
                      width={metrics.cellSize} height={metrics.cellSize}
                      rx={3}
                      fill="rgba(255,255,255,0.04)"
                      stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                    />
                  ))
                )}
                <g clipPath="url(#board-clip)">
                  {arrows.map((arrow) => (
                    <ArrowG
                      key={arrow.id}
                      arrow={arrow}
                      anim={animMap.get(arrow.id) ?? null}
                      metrics={metrics}
                      onAnimEnd={handleAnimEnd}
                      onClick={() => handleArrowClick(arrow)}
                    />
                  ))}
                </g>
              </svg>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── WON ── */}
      {gameState === "WON" && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, mt: 4 }}>
          <Box sx={{
            fontSize: "4rem",
            animation: "bounce 0.6s ease infinite alternate",
            "@keyframes bounce": {
              from: { transform: "translateY(0)" },
              to:   { transform: "translateY(-14px)" },
            },
          }}>🎉</Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Board Cleared!</Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Chip icon={<FontAwesomeIcon icon={faStar} />}
              label={`${moves} moves`} color="primary"
              sx={{ fontWeight: 700, fontSize: "1rem", py: 2.5, px: 1 }} />
            {bestScores[difficulty] !== undefined && (
              <Chip icon={<FontAwesomeIcon icon={faTrophy} />}
                label={`Best: ${bestScores[difficulty]}`} color="success"
                sx={{ fontWeight: 700, fontSize: "1rem", py: 2.5, px: 1 }} />
            )}
          </Box>
          {bestScores[difficulty] === moves && (
            <Typography variant="body1" sx={{ color: "#eab308", fontWeight: 700 }}>
              New best score!
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="contained" size="large"
              startIcon={<FontAwesomeIcon icon={faPlay} />}
              onClick={() => startGame(difficulty)}
              sx={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", fontWeight: 700 }}>
              Play Again
            </Button>
            <Button variant="outlined" size="large" onClick={() => setGameState("START")}>
              Menu
            </Button>
          </Box>
        </Box>
      )}
    </Container>
  );
}
