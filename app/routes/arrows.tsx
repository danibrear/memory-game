import {
  faArrowLeft,
  faClock,
  faForward,
  faLightbulb,
  faPlay,
  faRotateLeft,
  faStar,
  faTrophy,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, ButtonBase, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import { DISPLAY_FONT } from "~/theme";
import type { Route } from "./+types/arrows";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Arrow Escape - Games by DaniB" },
    { name: "description", content: "Tap arrows that can escape to the outside. Clear the board!" },
  ];
}

// ─── Constants & theme ────────────────────────────────────────────────────────

const STORAGE_KEY = "arrows-best-v3";

/** Candy palette tuned to pop on the dark board. */
const COLORS = [
  "#ff5d73", "#ffa23a", "#ffd43b", "#3ddc84", "#22d3ee",
  "#6d8bff", "#b26bff", "#ff6bcb", "#2ee6b8", "#ff8a5b",
];

const BOARD_BG = "linear-gradient(160deg, #2a1d5e 0%, #1b1440 55%, #140f2e 100%)";
const CARD_BG = "linear-gradient(100deg, #140f2e 0%, #23124a 55%, #3a1145 100%)";
const MUTED = "rgba(255,255,255,0.66)";
const MAX_BOARD = 560;

/** Darken (amt < 0) or lighten (amt > 0) a hex color. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.round(Math.min(255, Math.max(0, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Chunky "game button": solid face with a darker ledge underneath (matches landing). */
const chunkySx = (face: string, ledge: string) =>
  ({
    textTransform: "none",
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: "1.05rem",
    borderRadius: "16px",
    px: 2.5,
    py: 1.1,
    gap: 1,
    color: "white",
    background: face,
    boxShadow: `0 5px 0 ${ledge}, 0 10px 20px rgba(0,0,0,0.22)`,
    transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.15s ease",
    "&:hover": { filter: "brightness(1.08)" },
    "&:active": { transform: "translateY(4px)", boxShadow: `0 1px 0 ${ledge}` },
    "&.Mui-disabled": { opacity: 0.5, color: "white" },
  }) as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right";
type GameState = "START" | "PLAYING" | "WON";
type Difficulty = "easy" | "medium" | "hard";
type AnimKind = "escaping" | "bouncing" | "blocked" | "hint";

interface AnimEntry { kind: AnimKind; seq: number; dist?: number }

interface Arrow {
  id: string;
  cells: [number, number][]; // tail-first, head-last
  direction: Direction;
  color: string;
}

interface BestEntry { time?: number; stars?: number }
type BestScores = Partial<Record<Difficulty, BestEntry>>;

interface Metrics { cellSize: number; gap: number; stride: number; strokeW: number; pad: number }

interface Burst { id: number; x: number; y: number; color: string; delay: number }

const CONFIGS: Record<Difficulty, {
  gridSize: number; count: number; label: string; maxLen: number;
  face: string; ledge: string; blurb: string;
}> = {
  easy:   { gridSize: 10, count: 25,  label: "Easy",   maxLen: 4, face: "linear-gradient(180deg,#4ade80,#16a34a)", ledge: "#166534", blurb: "Warm up" },
  medium: { gridSize: 14, count: 50,  label: "Medium", maxLen: 3, face: "linear-gradient(180deg,#fcd34d,#d97706)", ledge: "#92400e", blurb: "Think ahead" },
  hard:   { gridSize: 18, count: 100, label: "Hard",   maxLen: 3, face: "linear-gradient(180deg,#fb7185,#dc2626)", ledge: "#991b1b", blurb: "Brain buster" },
};
const ORDER: Difficulty[] = ["easy", "medium", "hard"];

/** Fit the board (grid + half-cell padding) into the available width. */
function computeMetrics(gridSize: number, width: number): Metrics {
  const w = Math.min(MAX_BOARD, Math.max(240, width));
  const gap = 2;
  const stride = Math.max(14, Math.floor((w + gap) / (gridSize + 1)));
  const cellSize = stride - gap;
  return { cellSize, gap, stride, strokeW: Math.max(6, cellSize * 0.44), pad: stride / 2 };
}

function boardPx(gridSize: number, m: Metrics) {
  return gridSize * m.stride - m.gap + m.pad * 2;
}

function starsFor(mistakes: number) {
  return mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Direction helpers ────────────────────────────────────────────────────────

const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down", down: "up", left: "right", right: "left",
};
const ANGLE: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 };
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

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
function easeOutBack(t: number) {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
/** Zippy launch: moves immediately, then accelerates. */
const launch = (t: number) => 0.7 * t * t + 0.3 * t;

// ─── Game logic ───────────────────────────────────────────────────────────────

/** Walks from the arrow's head toward the edge. Returns what it hits (if anything). */
function scanPath(arrow: Arrow, all: Arrow[], gridSize: number): { blocker: Arrow | null; dist: number } {
  const cellMap = new Map<string, Arrow>();
  for (const a of all) {
    if (a.id === arrow.id) continue;
    for (const [r, c] of a.cells) cellMap.set(`${r},${c}`, a);
  }
  const [hr, hc] = arrow.cells[arrow.cells.length - 1];
  const [dr, dc] = DELTA[arrow.direction];
  let r = hr + dr, c = hc + dc, dist = 1;
  while (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
    const found = cellMap.get(`${r},${c}`);
    if (found) return { blocker: found, dist };
    r += dr; c += dc; dist++;
  }
  return { blocker: null, dist };
}

function canEscape(arrow: Arrow, all: Arrow[], gridSize: number): boolean {
  return scanPath(arrow, all, gridSize).blocker === null;
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
      arrows.push({
        id: `a${arrows.length}`,
        cells,
        direction: getExitDir(cells),
        color: COLORS[arrows.length % COLORS.length],
      });
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

// ─── Geometry ─────────────────────────────────────────────────────────────────

const center = (rc: number, m: Metrics) => m.pad + rc * m.stride + m.cellSize / 2;

/** Px from the head's center to just past the board edge in the exit direction. */
function distToEdge(arrow: Arrow, gridSize: number, m: Metrics) {
  const [hr, hc] = arrow.cells[arrow.cells.length - 1];
  const steps = { right: gridSize - 1 - hc, left: hc, down: gridSize - 1 - hr, up: hr }[arrow.direction];
  return steps * m.stride + m.cellSize / 2 + m.pad;
}

/**
 * The body path continues in a straight line past the head so the arrow can
 * "snake" out along its own track by sliding a dash window forward.
 */
function buildTrackPath(arrow: Arrow, ext: number, m: Metrics): string {
  const pts = arrow.cells.map(([r, c]) => [center(c, m), center(r, m)] as const);
  const [hx, hy] = pts[pts.length - 1];
  const [dr, dc] = DELTA[arrow.direction];
  return (
    `M ${pts[0][0]},${pts[0][1]}` +
    pts.slice(1).map(([x, y]) => ` L ${x},${y}`).join("") +
    ` L ${hx + dc * ext},${hy + dr * ext}`
  );
}

// ─── ArrowG ───────────────────────────────────────────────────────────────────

interface ArrowGProps {
  arrow: Arrow;
  anim: AnimEntry | null;
  metrics: Metrics;
  gridSize: number;
  popDelay: number;
  onAnimEnd: (id: string, kind: AnimKind, seq: number) => void;
  onClick: () => void;
}

function ArrowG({ arrow, anim, metrics: m, gridSize, popDelay, onAnimEnd, onClick }: ArrowGProps) {
  const { id, cells, direction, color } = arrow;
  const ledgeColor = shade(color, -0.38);
  const pathLen = (cells.length - 1) * m.stride;
  const ext = gridSize * m.stride + m.pad * 4;
  const d = buildTrackPath(arrow, ext, m);
  const dash = `${pathLen} ${pathLen + ext * 2}`;
  const ledge = Math.max(2, m.cellSize * 0.13);

  const [hr, hc] = cells[cells.length - 1];
  const hx = center(hc, m), hy = center(hr, m);
  const hw = m.cellSize * 0.84;   // head width
  const hl = m.cellSize * 0.5;    // tip distance past center
  const hb = m.cellSize * 0.08;   // base distance behind center
  const headPts = `${hl},0 ${-hb},${-hw / 2} ${-hb},${hw / 2}`;
  const headJoin = Math.max(1.5, m.cellSize * 0.1);

  const fxRef = useRef<SVGGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const headRef = useRef<SVGGElement>(null);
  const rafRef = useRef(0);

  const [dr, dc] = DELTA[direction];
  const setSlide = useCallback((x: number) => {
    for (const p of pathRefs.current) if (p) p.style.strokeDashoffset = `${-x}`;
    headRef.current?.setAttribute("transform", `translate(${dc * x},${dr * x})`);
  }, [dc, dr]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    setSlide(0);
    if (fxRef.current) fxRef.current.style.filter = "";
    if (!anim) return;

    const { kind, seq } = anim;
    const start = performance.now();
    const run = (dur: number, step: (t: number) => void) => {
      const tick = (now: number) => {
        const t = Math.min((now - start) / dur, 1);
        step(t);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else onAnimEnd(id, kind, seq);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (kind === "escaping") {
      const travel = distToEdge(arrow, gridSize, m) + pathLen + m.strokeW;
      run(Math.min(640, 240 + travel * 0.9), (t) => setSlide(launch(t) * travel));
    }

    if (kind === "bouncing") {
      // Slide forward until it bumps the blocker, then spring back.
      const gapPx = Math.max(0, ((anim.dist ?? 1) - 1) * m.stride) + m.stride * 0.28;
      const out = 90 + Math.min(160, gapPx * 0.6);
      const back = 300;
      run(out + back, (t) => {
        const ms = t * (out + back);
        const x = ms < out ? gapPx * easeOutQuad(ms / out) : gapPx * (1 - easeOutBack((ms - out) / back));
        setSlide(x);
        const glow = ms < out ? ms / out : 1 - (ms - out) / back;
        if (fxRef.current) fxRef.current.style.filter = `drop-shadow(0 0 ${glow * 6}px #ff4d6d)`;
      });
    }

    if (kind === "blocked") {
      run(520, (t) => {
        const p = Math.sin(t * Math.PI);
        if (fxRef.current) {
          fxRef.current.style.filter = `brightness(${1 + p * 0.5}) drop-shadow(0 0 ${p * 10}px #ff4d6d)`;
        }
      });
    }

    if (kind === "hint") {
      run(1800, (t) => {
        const p = Math.abs(Math.sin(t * Math.PI * 3));
        if (fxRef.current) {
          fxRef.current.style.filter = `brightness(${1 + p * 0.35}) drop-shadow(0 0 ${p * 12}px #fff7a8)`;
        }
      });
    }

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim?.seq, anim?.kind]);

  const strokeProps = {
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dash,
    pointerEvents: "none" as const,
  };
  const setPath = (i: number) => (el: SVGPathElement | null) => { pathRefs.current[i] = el; };
  const escaping = anim?.kind === "escaping";

  return (
    <g className="arrow-pop" style={{ animationDelay: `${popDelay}ms` }}>
      <g
        ref={fxRef}
        onClick={onClick}
        style={{ cursor: escaping ? "default" : "pointer", pointerEvents: escaping ? "none" : "auto" }}>
        {/* ledge (3D underside) */}
        <path ref={setPath(0)} d={d} {...strokeProps} stroke={ledgeColor}
          strokeWidth={m.strokeW} transform={`translate(0,${ledge})`} />
        {/* body */}
        <path ref={setPath(1)} d={d} {...strokeProps} stroke={color} strokeWidth={m.strokeW} />
        {/* glossy highlight */}
        <path ref={setPath(2)} d={d} {...strokeProps} stroke="rgba(255,255,255,0.38)"
          strokeWidth={m.strokeW * 0.26} transform={`translate(0,${-m.strokeW * 0.16})`} />
        {/* head */}
        <g ref={headRef} pointerEvents="none">
          <polygon points={headPts} fill={ledgeColor} stroke={ledgeColor} strokeWidth={headJoin}
            strokeLinejoin="round" transform={`translate(${hx},${hy + ledge}) rotate(${ANGLE[direction]})`} />
          <polygon points={headPts} fill={color} stroke={color} strokeWidth={headJoin}
            strokeLinejoin="round" transform={`translate(${hx},${hy}) rotate(${ANGLE[direction]})`} />
        </g>
        {/* fat invisible hit area for small fingers */}
        <path className="arrow-hit" d={buildTrackPath(arrow, 0, m)} fill="none" stroke="transparent" pointerEvents="stroke"
          strokeWidth={Math.max(m.strokeW + 14, m.cellSize)} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

const boardSx = {
  "& .arrow-pop": {
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: "arrowPop 420ms cubic-bezier(.2,1.5,.45,1) both",
  },
  "@keyframes arrowPop": {
    from: { transform: "scale(0.2)", opacity: 0 },
    to: { transform: "scale(1)", opacity: 1 },
  },
  "& .burst": {
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: "burst 480ms ease-out both",
  },
  "@keyframes burst": {
    from: { transform: "scale(0.2)", opacity: 0.95 },
    to: { transform: "scale(1.6)", opacity: 0 },
  },
} as const;

interface BoardSvgProps {
  arrows: Arrow[];
  gridSize: number;
  metrics: Metrics;
  animMap: Map<string, AnimEntry>;
  bursts?: Burst[];
  total: number;
  onAnimEnd: (id: string, kind: AnimKind, seq: number) => void;
  onArrowClick: (a: Arrow) => void;
}

function BoardSvg({ arrows, gridSize, metrics: m, animMap, bursts = [], total, onAnimEnd, onArrowClick }: BoardSvgProps) {
  const size = boardPx(gridSize, m);
  const radius = Math.max(14, m.stride * 0.9);
  const clipId = useMemo(() => `board-clip-${Math.random().toString(36).slice(2, 8)}`, []);
  const step = Math.min(14, 650 / Math.max(1, total));
  const dotR = Math.max(1.4, m.cellSize * 0.08);

  return (
    <Box component="svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      sx={{ display: "block", touchAction: "manipulation", ...boardSx }}>
      <defs>
        <clipPath id={clipId}>
          <rect width={size} height={size} rx={radius} />
        </clipPath>
        <radialGradient id={`${clipId}-glow`} cx="30%" cy="15%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={size} height={size} fill={`url(#${clipId}-glow)`} />
        {Array.from({ length: gridSize * gridSize }, (_, i) => {
          const r = Math.floor(i / gridSize), c = i % gridSize;
          return <circle key={i} cx={center(c, m)} cy={center(r, m)} r={dotR} fill="rgba(255,255,255,0.16)" />;
        })}
        {arrows.map((arrow, i) => (
          <ArrowG
            key={arrow.id}
            arrow={arrow}
            anim={animMap.get(arrow.id) ?? null}
            metrics={m}
            gridSize={gridSize}
            popDelay={Math.round(i * step)}
            onAnimEnd={onAnimEnd}
            onClick={() => onArrowClick(arrow)}
          />
        ))}
        {bursts.map((b) => (
          <circle key={b.id} className="burst" cx={b.x} cy={b.y} r={m.cellSize * 0.7}
            fill="none" stroke={b.color} strokeWidth={Math.max(2, m.cellSize * 0.16)}
            style={{ animationDelay: `${b.delay}ms` }} />
        ))}
      </g>
    </Box>
  );
}

// ─── Start-screen demo (plays itself) ─────────────────────────────────────────

const DEMO_GRID = 6;
const DEMO_ARROWS: Arrow[] = [
  { id: "d0", cells: [[1, 0], [1, 1], [1, 2]], direction: "right", color: COLORS[4] },
  { id: "d1", cells: [[4, 1], [3, 1], [2, 1]], direction: "up", color: COLORS[0] },
  { id: "d2", cells: [[5, 3], [5, 4], [4, 4], [3, 4]], direction: "up", color: COLORS[2] },
  { id: "d3", cells: [[3, 2], [4, 2], [4, 3]], direction: "right", color: COLORS[6] },
  { id: "d4", cells: [[2, 5], [3, 5], [4, 5]], direction: "down", color: COLORS[3] },
  { id: "d5", cells: [[0, 3], [0, 4]], direction: "right", color: COLORS[7] },
];

function DemoBoard({ size }: { size: number }) {
  const m = useMemo(() => computeMetrics(DEMO_GRID, size), [size]);
  const [arrows, setArrows] = useState(DEMO_ARROWS);
  const [animMap, setAnimMap] = useState<Map<string, AnimEntry>>(new Map());
  const [round, setRound] = useState(0);
  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;
  const seq = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      const cur = arrowsRef.current;
      if (cur.length === 0) {
        setRound((r) => r + 1);
        setArrows(DEMO_ARROWS);
        return;
      }
      const next = cur.find((a) => canEscape(a, cur, DEMO_GRID));
      if (next) setAnimMap(new Map([[next.id, { kind: "escaping", seq: ++seq.current }]]));
    }, 1100);
    return () => clearInterval(t);
  }, []);

  const onEnd = useCallback((id: string, kind: AnimKind) => {
    if (kind === "escaping") setArrows((cur) => cur.filter((a) => a.id !== id));
    setAnimMap(new Map());
  }, []);

  return (
    <Box key={round} sx={{ borderRadius: "20px", background: BOARD_BG, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.35)", pointerEvents: "none" }}>
      <BoardSvg arrows={arrows} gridSize={DEMO_GRID} metrics={m} animMap={animMap}
        total={DEMO_ARROWS.length} onAnimEnd={onEnd} onArrowClick={() => {}} />
    </Box>
  );
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Stars({ count, size = 18, animate = false }: { count: number; size?: number; animate?: boolean }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
      {[0, 1, 2].map((i) => (
        <Box key={i} sx={{
          fontSize: size,
          color: i < count ? "#ffd43b" : "rgba(255,255,255,0.22)",
          filter: i < count ? "drop-shadow(0 2px 0 #b45309)" : "none",
          ...(animate && {
            animation: `starPop 480ms cubic-bezier(.2,1.6,.4,1) ${200 + i * 180}ms both`,
            "@keyframes starPop": {
              from: { transform: "scale(0) rotate(-40deg)", opacity: 0 },
              to: { transform: "scale(1) rotate(0)", opacity: 1 },
            },
          }),
          ...(animate && i === 1 && { fontSize: size * 1.25 }),
        }}>
          <FontAwesomeIcon icon={faStar} />
        </Box>
      ))}
    </Box>
  );
}

function Pill({ icon, children, tone = "rgba(255,255,255,0.1)" }: {
  icon?: typeof faStar; children: React.ReactNode; tone?: string;
}) {
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", gap: 0.75,
      px: 1.25, py: 0.5, borderRadius: "999px", background: tone,
      color: "white", fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "0.9rem",
      fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
    }}>
      {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: "0.8em", opacity: 0.85 }} />}
      {children}
    </Box>
  );
}

function IconChunky({ icon, label, onClick, face = "#3b2a7a", ledge = "#1f1547" }: {
  icon: typeof faStar; label: string; onClick: () => void; face?: string; ledge?: string;
}) {
  return (
    <ButtonBase aria-label={label} title={label} onClick={onClick} sx={{
      ...chunkySx(face, ledge), px: 0, py: 0, width: 42, height: 42, borderRadius: "14px", fontSize: "1rem",
      boxShadow: `0 4px 0 ${ledge}`,
    }}>
      <FontAwesomeIcon icon={icon} />
    </ButtonBase>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 600,
    dur: 1400 + Math.random() * 1200,
    color: COLORS[i % COLORS.length],
    rot: Math.random() * 360,
    w: 6 + Math.random() * 6,
  })), []);
  return (
    <Box aria-hidden sx={{
      position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
      "@keyframes fall": {
        from: { transform: "translateY(-20px) rotate(0deg)", opacity: 1 },
        to: { transform: "translateY(110%) rotate(540deg)", opacity: 0.2 },
      },
    }}>
      {pieces.map((p, i) => (
        <Box key={i} sx={{
          position: "absolute", top: 0, left: `${p.left}%`, width: p.w, height: p.w * 0.45,
          background: p.color, borderRadius: "2px", transform: `rotate(${p.rot}deg)`,
          animation: `fall ${p.dur}ms ease-in ${p.delay}ms both`,
        }} />
      ))}
    </Box>
  );
}

/** Tracks the width of a container so the board can fill it. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArrowsGame() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [total, setTotal] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [bestScores, setBestScores] = useState<BestScores>({});
  const [animMap, setAnimMap] = useState<Map<string, AnimEntry>>(new Map());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [boardSeq, setBoardSeq] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ time: number; stars: number; newBest: boolean } | null>(null);
  const seqRef = useRef(0);
  const burstId = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [wrapRef, wrapWidth] = useWidth<HTMLDivElement>(340);

  const { gridSize } = CONFIGS[difficulty];
  const metrics = useMemo(() => computeMetrics(gridSize, wrapWidth), [gridSize, wrapWidth]);

  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY);
    if (stored) setBestScores(stored);
  }, []);

  // Ticking clock while playing
  useEffect(() => {
    if (gameState !== "PLAYING") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [gameState]);

  const startGame = useCallback((diff: Difficulty) => {
    const puzzle = generatePuzzle(diff);
    setDifficulty(diff);
    setArrows(puzzle);
    setTotal(puzzle.length);
    setMistakes(0);
    setAnimMap(new Map());
    setBursts([]);
    setResult(null);
    setBoardSeq((s) => s + 1);
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setGameState("PLAYING");
  }, []);

  // Win detection lives in an effect so state updaters stay pure.
  useEffect(() => {
    if (gameState !== "PLAYING" || total === 0 || arrows.length > 0) return;
    const time = Date.now() - startedAt;
    const stars = starsFor(mistakes);
    const prev = bestScores[difficulty] ?? {};
    const newBest = prev.time === undefined || time < prev.time;
    const updated: BestScores = {
      ...bestScores,
      [difficulty]: {
        time: newBest ? time : prev.time,
        stars: Math.max(prev.stars ?? 0, stars),
      },
    };
    setBestScores(updated);
    setStoredData(STORAGE_KEY, updated);
    setResult({ time, stars, newBest });
    setGameState("WON");
  }, [arrows.length, gameState, total, startedAt, mistakes, bestScores, difficulty]);

  const handleAnimEnd = useCallback((arrowId: string, kind: AnimKind, seq: number) => {
    if (kind === "escaping") setArrows((prev) => prev.filter((a) => a.id !== arrowId));
    setAnimMap((prev) => {
      if (prev.get(arrowId)?.seq !== seq) return prev;
      const m = new Map(prev);
      m.delete(arrowId);
      return m;
    });
  }, []);

  /** Arrows already flying out no longer block anything — lets players chain taps. */
  const liveArrows = useMemo(
    () => arrows.filter((a) => animMap.get(a.id)?.kind !== "escaping"),
    [arrows, animMap],
  );

  const handleArrowClick = useCallback((arrow: Arrow) => {
    if (gameState !== "PLAYING") return;
    const cur = animMap.get(arrow.id)?.kind;
    if (cur === "escaping" || cur === "bouncing") return;

    const { blocker, dist } = scanPath(arrow, liveArrows, gridSize);
    if (!blocker) {
      const seq = ++seqRef.current;
      setAnimMap((prev) => new Map(prev).set(arrow.id, { kind: "escaping", seq }));

      // Ring burst where the head leaves the board, timed to the launch curve.
      const travel = distToEdge(arrow, gridSize, metrics) + (arrow.cells.length - 1) * metrics.stride + metrics.strokeW;
      const dur = Math.min(640, 240 + travel * 0.9);
      const f = Math.min(1, (distToEdge(arrow, gridSize, metrics) - metrics.pad * 0.5) / travel);
      const tAtEdge = (-0.3 + Math.sqrt(0.09 + 2.8 * f)) / 1.4;
      const [hr, hc] = arrow.cells[arrow.cells.length - 1];
      const [dr, dc] = DELTA[arrow.direction];
      const size = boardPx(gridSize, metrics);
      const edge = (v: number, dir: number) => (dir > 0 ? size - metrics.pad * 0.5 : dir < 0 ? metrics.pad * 0.5 : v);
      const id = ++burstId.current;
      setBursts((b) => [...b, {
        id,
        x: edge(center(hc, metrics), dc),
        y: edge(center(hr, metrics), dr),
        color: arrow.color,
        delay: Math.round(tAtEdge * dur),
      }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), dur + 600);
      return;
    }

    setMistakes((m) => m + 1);
    const seq = ++seqRef.current;
    setAnimMap((prev) => {
      const m = new Map(prev).set(arrow.id, { kind: "bouncing", seq, dist });
      if (m.get(blocker.id)?.kind !== "escaping") m.set(blocker.id, { kind: "blocked", seq: ++seqRef.current });
      return m;
    });
    boardRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 220, delay: 120 },
    );
    if (typeof navigator !== "undefined") navigator.vibrate?.(25);
  }, [animMap, liveArrows, gameState, gridSize, metrics]);

  const showHint = useCallback(() => {
    const candidates = liveArrows.filter((a) => !animMap.has(a.id) && canEscape(a, liveArrows, gridSize));
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pick) setAnimMap((prev) => new Map(prev).set(pick.id, { kind: "hint", seq: ++seqRef.current }));
  }, [animMap, liveArrows, gridSize]);

  const cleared = total - arrows.length;
  const elapsed = gameState === "WON" && result ? result.time : Math.max(0, now - startedAt);
  const cfg = CONFIGS[difficulty];
  const nextDiff = ORDER[ORDER.indexOf(difficulty) + 1];

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 2 } }}>
      {/* Width probe shared by every screen */}
      <Box ref={wrapRef} sx={{ width: "100%", maxWidth: MAX_BOARD, mx: "auto", height: 0 }} />

      {/* ── START ── */}
      {gameState === "START" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box sx={{
            position: "relative", overflow: "hidden", borderRadius: "28px", background: CARD_BG,
            p: { xs: 2.5, sm: 3.5 }, color: "white",
            boxShadow: "0 20px 40px rgba(20,10,50,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
            display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center", gap: 3,
          }}>
            <Box sx={{ flex: 1, textAlign: { xs: "center", sm: "left" } }}>
              <Box sx={{
                display: "inline-block", px: 1, py: 0.25, mb: 1, borderRadius: "8px",
                fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em",
                background: "rgba(255,255,255,0.12)", color: MUTED,
              }}>PUZZLE</Box>
              <Typography component="h1" sx={{
                fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: "2.3rem", sm: "2.6rem" },
                lineHeight: 1, mb: 1.25,
                background: "linear-gradient(180deg, #fff 30%, #fcd34d 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.35))",
              }}>
                Arrow Escape
              </Typography>
              <Typography sx={{ color: MUTED, fontSize: "1rem", maxWidth: 260, mx: { xs: "auto", sm: 0 } }}>
                Tap an arrow to send it flying. If something's in the way, it bounces back!
              </Typography>
            </Box>
            <DemoBoard size={Math.min(220, Math.max(180, wrapWidth * 0.55))} />
          </Box>

          <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "1.25rem", px: 0.5 }}>
            Pick a level
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: { xs: 1.25, sm: 2 } }}>
            {ORDER.map((diff) => {
              const c = CONFIGS[diff];
              const best = bestScores[diff];
              return (
                <ButtonBase key={diff} onClick={() => startGame(diff)} sx={{
                  ...chunkySx(c.face, c.ledge),
                  flexDirection: "column", alignItems: "center", gap: 0.5,
                  px: 1, py: 2, borderRadius: "20px", boxShadow: `0 6px 0 ${c.ledge}, 0 14px 24px rgba(0,0,0,0.2)`,
                  "&:hover": { filter: "brightness(1.06)", transform: "translateY(-2px)" },
                }}>
                  <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: "1.3rem", lineHeight: 1.1,
                    textShadow: "0 2px 0 rgba(0,0,0,0.2)" }}>
                    {c.label}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", opacity: 0.9, fontWeight: 600 }}>
                    {c.gridSize}×{c.gridSize} grid
                  </Typography>
                  <Box sx={{ mt: 0.75, px: 1, py: 0.5, borderRadius: "10px", background: "rgba(0,0,0,0.18)", minWidth: "80%" }}>
                    <Stars count={best?.stars ?? 0} size={14} />
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, mt: 0.25, opacity: 0.95 }}>
                      {best?.time !== undefined
                        ? <><FontAwesomeIcon icon={faTrophy} style={{ marginRight: 4 }} />{formatTime(best.time)}</>
                        : c.blurb}
                    </Typography>
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── PLAYING / WON ── */}
      {gameState !== "START" && (
        <Box sx={{ maxWidth: MAX_BOARD, mx: "auto", display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* HUD */}
          <Box sx={{
            borderRadius: "22px", background: CARD_BG, color: "white", p: 1.5,
            boxShadow: "0 12px 28px rgba(20,10,50,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <IconChunky icon={faArrowLeft} label="Back to levels" onClick={() => setGameState("START")} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.1 }}>
                  Arrow Escape
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: MUTED, fontWeight: 600 }}>
                  {cfg.label} · {cfg.gridSize}×{cfg.gridSize}
                </Typography>
              </Box>
              <Pill icon={faClock}>{formatTime(elapsed)}</Pill>
              <Pill icon={faXmark} tone={mistakes > 0 ? "rgba(255,77,109,0.28)" : undefined}>{mistakes}</Pill>
            </Box>
            <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ flex: 1, height: 12, borderRadius: 6, background: "rgba(0,0,0,0.35)", overflow: "hidden",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}>
                <Box sx={{
                  height: "100%", width: `${total ? (cleared / total) * 100 : 0}%`,
                  borderRadius: 6, transition: "width 0.3s ease",
                  background: "linear-gradient(90deg, #22d3ee, #3ddc84)",
                  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35)",
                }} />
              </Box>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "0.9rem",
                fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
                {cleared}/{total}
              </Typography>
            </Box>
          </Box>

          {/* Board */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box ref={boardRef} sx={{
              position: "relative", borderRadius: `${Math.max(14, metrics.stride * 0.9)}px`,
              background: BOARD_BG,
              boxShadow: "0 20px 40px rgba(20,10,50,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}>
              <BoardSvg
                key={boardSeq}
                arrows={arrows}
                gridSize={gridSize}
                metrics={metrics}
                animMap={animMap}
                bursts={bursts}
                total={total}
                onAnimEnd={handleAnimEnd}
                onArrowClick={handleArrowClick}
              />

              {gameState === "WON" && result && (
                <Box sx={{
                  position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden",
                  display: "grid", placeItems: "center", p: 1.5, overflowY: "auto",
                  background: "rgba(10,6,30,0.55)", backdropFilter: "blur(3px)",
                  animation: "fadeIn 300ms ease both",
                  "@keyframes fadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                }}>
                  <Confetti />
                  <Box sx={{
                    position: "relative", textAlign: "center", color: "white",
                    borderRadius: "24px", background: CARD_BG, px: 2.5, py: 2.25, width: "100%", maxWidth: 320,
                    boxShadow: "0 24px 48px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.12)",
                    animation: "cardIn 420ms cubic-bezier(.2,1.4,.4,1) both",
                    "@keyframes cardIn": {
                      from: { transform: "scale(0.7) translateY(20px)", opacity: 0 },
                      to: { transform: "scale(1) translateY(0)", opacity: 1 },
                    },
                  }}>
                    <Stars count={result.stars} size={30} animate />
                    <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: "1.6rem", mt: 0.75, lineHeight: 1.1 }}>
                      Board Cleared!
                    </Typography>
                    <Typography sx={{ color: MUTED, fontSize: "0.85rem", mb: 1.5, mt: 0.25 }}>
                      {result.stars === 3 ? "Perfect, not a single bump!" : result.stars === 2 ? "Great job! Try for zero bumps." : "You did it! Try for fewer bumps."}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mb: 1 }}>
                      <Pill icon={faClock}>{formatTime(result.time)}</Pill>
                      <Pill icon={faXmark}>{mistakes} {mistakes === 1 ? "bump" : "bumps"}</Pill>
                    </Box>
                    {result.newBest ? (
                      <Box sx={{
                        display: "inline-block", mt: 0.5, px: 1.25, py: 0.4, borderRadius: "10px",
                        fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.06em", color: "#3b2300",
                        background: "linear-gradient(135deg, #fef08a, #f59e0b)", boxShadow: "0 2px 0 #b45309",
                      }}>
                        <FontAwesomeIcon icon={faTrophy} style={{ marginRight: 6 }} />NEW BEST TIME
                      </Box>
                    ) : bestScores[difficulty]?.time !== undefined && (
                      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                        <FontAwesomeIcon icon={faTrophy} style={{ marginRight: 6 }} />
                        Best: {formatTime(bestScores[difficulty]!.time!)}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", gap: 1.25, mt: 2, justifyContent: "center", "& > button": { flex: 1, px: 1.5, fontSize: "0.95rem" } }}>
                      {nextDiff && (
                        <ButtonBase onClick={() => startGame(nextDiff)} sx={chunkySx(CONFIGS[nextDiff].face, CONFIGS[nextDiff].ledge)}>
                          <FontAwesomeIcon icon={faForward} /> {CONFIGS[nextDiff].label}
                        </ButtonBase>
                      )}
                      <ButtonBase onClick={() => startGame(difficulty)}
                        sx={chunkySx("linear-gradient(180deg,#4ade80,#16a34a)", "#166534")}>
                        <FontAwesomeIcon icon={faPlay} /> Again
                      </ButtonBase>
                    </Box>
                    <ButtonBase onClick={() => setGameState("START")} sx={{
                      mt: 1.5, fontFamily: DISPLAY_FONT, fontWeight: 600, color: MUTED, px: 1.5, py: 0.5, borderRadius: "10px",
                      "&:hover": { color: "white" },
                    }}>
                      All levels
                    </ButtonBase>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Actions */}
          {gameState === "PLAYING" && (
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", mt: 0.5 }}>
              <ButtonBase onClick={showHint} sx={chunkySx("linear-gradient(180deg,#fcd34d,#f59e0b)", "#b45309")}>
                <FontAwesomeIcon icon={faLightbulb} /> Hint
              </ButtonBase>
              <ButtonBase onClick={() => startGame(difficulty)} sx={chunkySx("linear-gradient(180deg,#8b6dff,#5b3fd6)", "#3a2596")}>
                <FontAwesomeIcon icon={faRotateLeft} /> New Board
              </ButtonBase>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
}
