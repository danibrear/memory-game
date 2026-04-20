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

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE = 50;
const GAP = 3;
const STRIDE = CELL_SIZE + GAP;
const STROKE_W = 40;
const STORAGE_KEY = "arrows-best-v2";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
  "#3b82f6", "#f43f5e",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right";
type GameState  = "START" | "PLAYING" | "WON";
type Difficulty = "easy" | "medium" | "hard";
type AnimKind   = "escaping" | "bouncing" | "blocked";

// seq increments each trigger so the same kind can re-fire
interface AnimEntry { kind: AnimKind; seq: number }

interface Arrow {
  id: string;
  cells: [number, number][]; // [row,col][], tail-first, head-last
  direction: Direction;
  color: string;
}

interface BestScores { easy?: number; medium?: number; hard?: number }

const CONFIGS: Record<Difficulty, { gridSize: number; count: number; label: string }> = {
  easy:   { gridSize: 5, count: 5,  label: "Easy"   },
  medium: { gridSize: 6, count: 8,  label: "Medium"  },
  hard:   { gridSize: 7, count: 11, label: "Hard"    },
};

// ─── Direction helpers ─────────────────────────────────────────────────────────

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

// ─── Easing ────────────────────────────────────────────────────────────────────

function easeInCubic(t: number) { return t * t * t; }

// spring: 0→1→1→slight-overshoot→0
function springOut(t: number): number {
  if (t < 0.35) return t / 0.35;
  if (t < 0.65) return 1;
  if (t < 0.82) return 1 - ((t - 0.65) / 0.17) * 1.18;
  return -0.18 + ((t - 0.82) / 0.18) * 0.18;
}

// ─── Game logic ────────────────────────────────────────────────────────────────

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

// ─── Puzzle generation ─────────────────────────────────────────────────────────

function randomWalk(
  sr: number, sc: number,
  occupied: Set<string>,
  gridSize: number,
): [number, number][] {
  const cells: [number, number][] = [[sr, sc]];
  const cellSet = new Set<string>([`${sr},${sc}`]);
  const target = 3 + Math.floor(Math.random() * (Math.min(6, gridSize) - 2));
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
  const { gridSize, count } = CONFIGS[difficulty];

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
      const cells = randomWalk(sr, sc, occupied, gridSize);
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

// Reverse construction: each arrow is escapable when placed, so
// removing in reverse-insertion order is always a valid solution.
function buildGuaranteedPuzzle(difficulty: Difficulty): Arrow[] {
  const { gridSize, count } = CONFIGS[difficulty];
  const placed: Arrow[] = [];
  const occupied = new Set<string>();

  for (let i = 0; i < count * 8 && placed.length < count; i++) {
    const sr = Math.floor(Math.random() * gridSize);
    const sc = Math.floor(Math.random() * gridSize);
    if (occupied.has(`${sr},${sc}`)) continue;
    const cells = randomWalk(sr, sc, occupied, gridSize);
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

// ─── SVG helpers ───────────────────────────────────────────────────────────────

function cx(col: number) { return col * STRIDE + CELL_SIZE / 2; }
function cy(row: number) { return row * STRIDE + CELL_SIZE / 2; }

function buildSvgPath(cells: [number, number][]): string {
  const [[r0, c0], ...rest] = cells;
  let d = `M ${cx(c0)},${cy(r0)}`;
  for (const [r, c] of rest) d += ` L ${cx(c)},${cy(r)}`;
  return d;
}

function buildArrowhead(cells: [number, number][], dir: Direction): string {
  const [hr, hc] = cells[cells.length - 1];
  const x = cx(hc), y = cy(hr);
  const s = STROKE_W * 0.5;
  switch (dir) {
    case "right": return `${x + s},${y} ${x - s * 0.55},${y - s * 0.72} ${x - s * 0.55},${y + s * 0.72}`;
    case "left":  return `${x - s},${y} ${x + s * 0.55},${y - s * 0.72} ${x + s * 0.55},${y + s * 0.72}`;
    case "down":  return `${x},${y + s} ${x - s * 0.72},${y - s * 0.55} ${x + s * 0.72},${y - s * 0.55}`;
    case "up":    return `${x},${y - s} ${x - s * 0.72},${y + s * 0.55} ${x + s * 0.72},${y + s * 0.55}`;
  }
}

// ─── ArrowG component — animates via direct DOM refs + rAF ────────────────────

interface ArrowGProps {
  arrow: Arrow;
  anim: AnimEntry | null;
  gridSize: number;
  onAnimEnd: (id: string) => void;
  onClick: () => void;
}

function ArrowG({ arrow, anim, gridSize, onAnimEnd, onClick }: ArrowGProps) {
  const { id, cells, direction, color } = arrow;
  const pathD   = buildSvgPath(cells);
  const headPts = buildArrowhead(cells, direction);

  const groupRef = useRef<SVGGElement>(null);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (groupRef.current) {
      groupRef.current.style.transform = "";
      groupRef.current.style.filter    = "";
    }

    if (!anim) return;

    const { kind } = anim;
    const [dr, dc] = DELTA[direction];
    const start    = performance.now();

    if (kind === "escaping") {
      // Translate the entire group in the exit direction.
      // A clipPath on the parent SVG clips the tail as it exits, making the whole
      // arrow look like it slides out — arrowhead naturally leads the way.
      const TOTAL = 460;
      const dist  = (gridSize + 1) * STRIDE; // enough to clear any arrow off the board

      const tick = (now: number) => {
        const t    = Math.min((now - start) / TOTAL, 1);
        const ease = easeInCubic(t);
        if (groupRef.current) {
          groupRef.current.style.transform =
            `translate(${dc * ease * dist}px,${dr * ease * dist}px)`;
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
          const bright = 1 + pulse * 1.1;
          const glow   = pulse * 14;
          groupRef.current.style.filter =
            `brightness(${bright}) drop-shadow(0 0 ${glow}px white)`;
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
      <path d={pathD} fill="none" stroke="rgba(0,0,0,0.32)"
        strokeWidth={STROKE_W + 4} strokeLinecap="round" strokeLinejoin="round"
        transform="translate(2,3)" />
      <path d={pathD} fill="none" stroke={color}
        strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke="rgba(255,255,255,0.2)"
        strokeWidth={STROKE_W * 0.42} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={headPts} fill="rgba(0,0,0,0.38)" />
      <path d={pathD} fill="none" stroke="transparent"
        strokeWidth={STROKE_W + 18} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ArrowsGame() {
  const [gameState, setGameState]   = useState<GameState>("START");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [arrows, setArrows]         = useState<Arrow[]>([]);
  const [gridSize, setGridSize]     = useState(6);
  const [moves, setMoves]           = useState(0);
  const [bestScores, setBestScores] = useState<BestScores>({});
  const [animMap, setAnimMap]       = useState<Map<string, AnimEntry>>(new Map());

  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY);
    if (stored) setBestScores(stored);
  }, []);

  const startGame = useCallback((diff: Difficulty) => {
    const puzzle = generatePuzzle(diff);
    setArrows(puzzle);
    setGridSize(CONFIGS[diff].gridSize);
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
        // Remove arrow from state; check win
        setArrows((prev) => {
          const next = prev.filter((a) => a.id !== arrowId);
          if (next.length === 0) {
            setGameState("WON");
            setMoves((m) => {
              setBestScores((bs) => {
                const updated = { ...bs };
                if (updated[difficulty] === undefined || m < updated[difficulty]!) {
                  updated[difficulty] = m;
                  setStoredData(STORAGE_KEY, updated);
                }
                return updated;
              });
              return m;
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
    // Ignore clicks while this arrow is already animating
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

  const svgSize = gridSize * STRIDE - GAP;

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

          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <Box sx={{
              background: "rgba(255,255,255,0.04)",
              border: "2px solid rgba(255,255,255,0.1)",
              borderRadius: 2,
              p: `${GAP}px`,
              overflow: "hidden",
            }}>
              <svg width={svgSize} height={svgSize} style={{ display: "block", overflow: "visible" }}>
                <defs>
                  {/* Clips escaping arrows at the board boundary so the tail disappears as it follows the head out */}
                  <clipPath id="board-clip">
                    <rect x={-STROKE_W} y={-STROKE_W} width={svgSize + STROKE_W * 2} height={svgSize + STROKE_W * 2} />
                  </clipPath>
                </defs>
                {/* Grid cells */}
                {Array.from({ length: gridSize }).map((_, r) =>
                  Array.from({ length: gridSize }).map((_, c) => (
                    <rect
                      key={`${r}-${c}`}
                      x={c * STRIDE} y={r * STRIDE}
                      width={CELL_SIZE} height={CELL_SIZE}
                      rx={5}
                      fill="rgba(255,255,255,0.04)"
                      stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                    />
                  ))
                )}
                {/* Arrows clipped to board so escaping tails vanish at the boundary */}
                <g clipPath="url(#board-clip)">
                  {arrows.map((arrow) => (
                    <ArrowG
                      key={arrow.id}
                      arrow={arrow}
                      anim={animMap.get(arrow.id) ?? null}
                      gridSize={gridSize}
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
            <Chip
              icon={<FontAwesomeIcon icon={faStar} />}
              label={`${moves} moves`} color="primary"
              sx={{ fontWeight: 700, fontSize: "1rem", py: 2.5, px: 1 }}
            />
            {bestScores[difficulty] !== undefined && (
              <Chip
                icon={<FontAwesomeIcon icon={faTrophy} />}
                label={`Best: ${bestScores[difficulty]}`} color="success"
                sx={{ fontWeight: 700, fontSize: "1rem", py: 2.5, px: 1 }}
              />
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
