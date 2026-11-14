import { Box } from "@mui/material";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/quadra";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Cascade - Games by DaniB" },
    {
      name: "description",
      content: "Drop blocks, clear lines, and set off chain reactions!",
    },
  ];
}

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const TICK_MS_START = 800;
const TICK_MS_MIN = 150;
const TICK_SPEEDUP = 40; // ms faster per level
const LINES_PER_LEVEL = 5;

/** Grace period after a piece touches down before it locks. */
const LOCK_DELAY_MS = 500;
/** How many times moving/rotating can extend the lock delay. */
const MAX_LOCK_RESETS = 15;
/**
 * Brief input lockout after a new piece appears, so a key meant for the
 * piece that just locked (or a held/auto-repeating key) doesn't act on the
 * new one.
 */
const SPAWN_GRACE_MS = 150;

/** Must match the `cascade-clear` animation duration in app.css. */
const CLEAR_ANIM_MS = 280;
/** Time between each one-row gravity step during a cascade. */
const FALL_STEP_MS = 45;
/** Pause after blocks settle before checking for the next chain link. */
const CHAIN_PAUSE_MS = 140;

/** Hold-to-repeat timing for on-screen buttons. */
const DAS_MS = 170;
const ARR_MS = 55;

const QUEUE_PREVIEW = 3;
const SPAWN_COL = 4;
const DANGER_ROWS = 4;

type Cell = { color: number; pieceId: number } | null;
type Board = Cell[][];

interface PieceColor {
  base: string;
  light: string;
  dark: string;
}

// I, O, T, S, Z, J, L
const PIECE_COLORS: PieceColor[] = [
  { base: "#22d3ee", light: "#a5f3fc", dark: "#0e7490" },
  { base: "#facc15", light: "#fef08a", dark: "#a16207" },
  { base: "#a855f7", light: "#e9d5ff", dark: "#6b21a8" },
  { base: "#4ade80", light: "#bbf7d0", dark: "#15803d" },
  { base: "#f43f5e", light: "#fecdd3", dark: "#9f1239" },
  { base: "#3b82f6", light: "#bfdbfe", dark: "#1e40af" },
  { base: "#fb923c", light: "#fed7aa", dark: "#c2410c" },
];

const CLEAR_LABELS = ["", "Single", "Double", "Triple", "Quad!", "Mega!"];

// Shapes: offsets from pivot [row, col], 4 rotations each
type Shape = [number, number][][];

const SHAPES: Shape[] = [
  // I
  [
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  ],
  // O
  [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  // T
  [
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, -1],
    ],
    [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  // S
  [
    [
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
    ],
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
    ],
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  // Z
  [
    [
      [0, -1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [-1, 0],
      [0, -1],
      [0, 0],
      [1, -1],
    ],
    [
      [0, -1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [-1, 0],
      [0, -1],
      [0, 0],
      [1, -1],
    ],
  ],
  // J
  [
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, -1],
    ],
    [
      [-1, -1],
      [0, -1],
      [0, 0],
      [0, 1],
    ],
    [
      [-1, 0],
      [-1, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  // L
  [
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, -1],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [-1, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  ],
];

interface Piece {
  shape: number; // index into SHAPES
  rotation: number;
  row: number;
  col: number;
}

let nextPieceId = 1;

// --- Pure game logic ---

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function spawnPiece(shape: number): Piece {
  return { shape, rotation: 0, row: 0, col: SPAWN_COL };
}

/** 7-bag randomizer: every piece shows up once per bag, so no long droughts. */
function shuffledBag(): number[] {
  const bag = SHAPES.map((_, i) => i);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function getCells(p: Piece): [number, number][] {
  return SHAPES[p.shape][p.rotation].map(([dr, dc]) => [
    p.row + dr,
    p.col + dc,
  ]);
}

function isValid(board: Board, p: Piece): boolean {
  return getCells(p).every(
    ([r, c]) =>
      r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === null,
  );
}

function isGrounded(board: Board, p: Piece): boolean {
  return !isValid(board, { ...p, row: p.row + 1 });
}

function lockPiece(board: Board, p: Piece): [Board, number] {
  const next = board.map((row) => [...row]);
  const pieceId = nextPieceId++;
  for (const [r, c] of getCells(p)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      next[r][c] = { color: p.shape, pieceId };
    }
  }
  return [next, pieceId];
}

function findFullRows(board: Board): number[] {
  const rows: number[] = [];
  board.forEach((row, i) => {
    if (row.every((c) => c !== null)) rows.push(i);
  });
  return rows;
}

/** Empty the given rows without shifting anything — gravity does the rest. */
function clearRowsInPlace(board: Board, rows: number[]): Board {
  const set = new Set(rows);
  return board.map((row, i) =>
    set.has(i) ? Array<Cell>(COLS).fill(null) : [...row],
  );
}

/** Find connected groups by piece ID using flood fill */
function findGroups(board: Board): [number, number][][] {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups: [number, number][][] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell === null || visited[r][c]) continue;
      const pid = cell.pieceId;
      const group: [number, number][] = [];
      const stack: [number, number][] = [[r, c]];
      visited[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        group.push([cr, cc]);
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (
            nr >= 0 &&
            nr < ROWS &&
            nc >= 0 &&
            nc < COLS &&
            !visited[nr][nc] &&
            board[nr][nc] !== null &&
            board[nr][nc]!.pieceId === pid
          ) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      groups.push(group);
    }
  }
  return groups;
}

/**
 * Quadra gravity, one row at a time: every connected piece group that has
 * room underneath drops by one. Called repeatedly so the cascade is visible.
 */
function gravityStep(board: Board): [Board, boolean] {
  const next = board.map((row) => [...row]);
  const groups = findGroups(next).sort(
    (a, b) =>
      Math.max(...b.map(([r]) => r)) - Math.max(...a.map(([r]) => r)),
  );
  let moved = false;

  for (const group of groups) {
    const inGroup = new Set(group.map(([r, c]) => r * COLS + c));
    const canFall = group.every(
      ([r, c]) =>
        r + 1 < ROWS &&
        (next[r + 1][c] === null || inGroup.has((r + 1) * COLS + c)),
    );
    if (!canFall) continue;

    const cells = group.map(([r, c]) => [r, c, next[r][c]] as const);
    for (const [r, c] of cells) next[r][c] = null;
    for (const [r, c, cell] of cells) next[r + 1][c] = cell;
    moved = true;
  }

  return [next, moved];
}

function getGhostRow(board: Board, piece: Piece): number {
  const ghost = { ...piece };
  while (isValid(board, { ...ghost, row: ghost.row + 1 })) {
    ghost.row++;
  }
  return ghost.row;
}

// --- Scoring ---
function scoreFor(lines: number, chain: number, level: number): number {
  const base = [0, 100, 300, 500, 800][Math.min(lines, 4)];
  const chainBonus = chain > 1 ? chain * 200 : 0;
  return (base + chainBonus) * (level + 1);
}

// --- Game State ---
type GameState = "START" | "ACTIVE" | "PAUSED" | "CASCADING" | "OVER";

const STORAGE_KEY = "quadra-game-state";
const BEST_KEY = "quadra-best-score";

interface SavedState {
  board: Board;
  nextPieceId: number;
  score: number;
  level: number;
  totalLines: number;
  currentPiece: Piece;
  nextPiece?: Piece;
  queue?: number[];
  hold?: number | null;
  canHold?: boolean;
  bestChain?: number;
}

interface Popup {
  id: number;
  text: string;
  sub?: string;
  tone: "score" | "chain" | "level";
}

/** useState + a ref that is updated synchronously, for timer/event logic. */
function useStateRef<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(value);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref] as const;
}

// --- Rendering ---

interface DisplayCell {
  shape: number;
  id: number;
  kind: "block" | "ghost";
}

const ACTIVE_ID = -2;
const GHOST_ID = -3;

function blockStyle(
  cell: DisplayCell,
  up: boolean,
  right: boolean,
  down: boolean,
  left: boolean,
): CSSProperties {
  const G = "var(--gap)";
  const R = "var(--radius)";
  const color = PIECE_COLORS[cell.shape];
  const shape: CSSProperties = {
    top: up ? 0 : G,
    right: right ? 0 : G,
    bottom: down ? 0 : G,
    left: left ? 0 : G,
    borderRadius: `${up || left ? 0 : R} ${up || right ? 0 : R} ${down || right ? 0 : R} ${down || left ? 0 : R}`,
  };

  if (cell.kind === "ghost") {
    const w = "2px";
    return {
      ...shape,
      background: `${color.base}22`,
      borderColor: color.base,
      borderTopWidth: up ? 0 : w,
      borderRightWidth: right ? 0 : w,
      borderBottomWidth: down ? 0 : w,
      borderLeftWidth: left ? 0 : w,
    };
  }

  // Bevel only on the outside edges so a piece reads as one chunky shape.
  const shadows = [
    !up && "inset 0 var(--bevel) 0 rgba(255,255,255,0.45)",
    !down && `inset 0 calc(var(--bevel) * -1) 0 ${color.dark}`,
    !left && "inset var(--bevel) 0 0 rgba(255,255,255,0.2)",
    !right && "inset calc(var(--bevel) * -1) 0 0 rgba(0,0,0,0.18)",
  ].filter(Boolean);

  return {
    ...shape,
    "--c": color.base,
    "--cl": color.light,
    background: color.base,
    boxShadow: shadows.length ? shadows.join(", ") : "none",
  } as CSSProperties;
}

function BlockGrid({
  cells,
  className = "",
  clearingRows,
  lockedId,
  freshSpawn = false,
}: {
  cells: (DisplayCell | null)[][];
  className?: string;
  clearingRows?: number[];
  lockedId?: number | null;
  /** Play the drop-in animation on the active piece (just spawned). */
  freshSpawn?: boolean;
}) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const clearing = new Set(clearingRows ?? []);

  const same = (r: number, c: number, cell: DisplayCell) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const other = cells[r][c];
    return other !== null && other.id === cell.id && other.kind === cell.kind;
  };

  return (
    <div className={`cascade-grid ${className}`}>
      {cells.map((row, ri) => (
        <div
          key={ri}
          className={`cascade-row${clearing.has(ri) ? " is-clearing" : ""}`}>
          {row.map((cell, ci) => {
            if (!cell) return <div key={ci} className="cascade-cell" />;
            const up = same(ri - 1, ci, cell);
            const right = same(ri, ci + 1, cell);
            const down = same(ri + 1, ci, cell);
            const left = same(ri, ci - 1, cell);
            const classes =
              cell.kind === "ghost"
                ? "cascade-ghost"
                : `cascade-block${cell.id === ACTIVE_ID ? " is-active" : ""}${
                    freshSpawn && cell.id === ACTIVE_ID ? " is-new" : ""
                  }${
                    lockedId != null && cell.id === lockedId ? " is-locked" : ""
                  }`;
            return (
              <div key={ci} className="cascade-cell">
                <div
                  className={classes}
                  style={blockStyle(cell, up, right, down, left)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MiniPiece({ shape }: { shape: number }) {
  const offsets = SHAPES[shape][0];
  const minR = Math.min(...offsets.map(([r]) => r));
  const maxR = Math.max(...offsets.map(([r]) => r));
  const minC = Math.min(...offsets.map(([, c]) => c));
  const maxC = Math.max(...offsets.map(([, c]) => c));
  const grid: (DisplayCell | null)[][] = Array.from(
    { length: maxR - minR + 1 },
    () => Array<DisplayCell | null>(maxC - minC + 1).fill(null),
  );
  for (const [r, c] of offsets) {
    grid[r - minR][c - minC] = { shape, id: 1, kind: "block" };
  }
  return <BlockGrid cells={grid} className="cascade-mini" />;
}

/** On-screen button with hold-to-repeat, using pointer events (no double fires). */
function CtrlButton({
  onPress,
  repeat = false,
  className = "",
  label,
  children,
}: {
  onPress: () => void;
  repeat?: boolean;
  className?: string;
  label: string;
  children: ReactNode;
}) {
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    interval?: ReturnType<typeof setInterval>;
  }>({});
  const stop = useCallback(() => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.interval);
    timers.current = {};
  }, []);
  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      aria-label={label}
      className={`cascade-ctrl ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        stop();
        onPress();
        if (repeat) {
          timers.current.delay = setTimeout(() => {
            timers.current.interval = setInterval(onPress, ARR_MS);
          }, DAS_MS);
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="cascade-overlay">
      <div className="cascade-overlay-card">{children}</div>
    </div>
  );
}

function GameScreen() {
  const [board, setBoard, boardRef] = useStateRef<Board>(emptyBoard());
  const [piece, setPiece, pieceRef] = useStateRef<Piece>(spawnPiece(0));
  const [queue, setQueue, queueRef] = useStateRef<number[]>([]);
  const [hold, setHold, holdRef] = useStateRef<number | null>(null);
  const [canHold, setCanHold, canHoldRef] = useStateRef(true);
  const [gameState, setGameState, gameStateRef] =
    useStateRef<GameState>("START");
  const [score, setScore, scoreRef] = useStateRef(0);
  const [level, setLevel, levelRef] = useStateRef(0);
  const [lines, setLines, linesRef] = useStateRef(0);
  const [bestChain, setBestChain, bestChainRef] = useStateRef(0);
  const [best, setBest, bestRef] = useStateRef(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [impact, setImpact] = useState(false);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const boardElRef = useRef<HTMLDivElement>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockResetsRef = useRef(0);
  /** Lowest row the current piece has reached; reaching a new low refreshes lock resets. */
  const lowestRowRef = useRef(0);
  const spawnedAtRef = useRef(0);
  const [freshSpawn, setFreshSpawn] = useState(false);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const popupIdRef = useRef(0);
  const touchRef = useRef<{
    x0: number;
    y0: number;
    lastX: number;
    lastY: number;
    t: number;
    moved: boolean;
  } | null>(null);

  // --- Timer helpers ---
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };
  const clearLater = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  };
  const clearLockTimer = () => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = null;
  };

  const pushPopup = (p: Omit<Popup, "id">) => {
    const id = ++popupIdRef.current;
    setPopups((prev) => [...prev, { ...p, id }]);
    later(() => setPopups((prev) => prev.filter((x) => x.id !== id)), 1250);
  };

  // --- Persistence ---
  const persist = () => {
    setStoredData(STORAGE_KEY, {
      board: boardRef.current,
      nextPieceId,
      score: scoreRef.current,
      level: levelRef.current,
      totalLines: linesRef.current,
      currentPiece: pieceRef.current,
      nextPiece: spawnPiece(queueRef.current[0] ?? 0),
      queue: queueRef.current,
      hold: holdRef.current,
      canHold: canHoldRef.current,
      bestChain: bestChainRef.current,
    } satisfies SavedState);
  };

  // --- Core actions (read refs only, so stale closures are safe) ---
  const takeFromQueue = (): number => {
    let q = queueRef.current.slice();
    while (q.length <= QUEUE_PREVIEW) q = q.concat(shuffledBag());
    const shape = q.shift()!;
    while (q.length < QUEUE_PREVIEW) q = q.concat(shuffledBag());
    setQueue(q);
    return shape;
  };

  const endGame = () => {
    clearLockTimer();
    setGameState("OVER");
    clearStoredData(STORAGE_KEY);
    if (scoreRef.current > bestRef.current) {
      setBest(scoreRef.current);
      setStoredData(BEST_KEY, scoreRef.current);
      setIsNewBest(true);
    }
  };

  const spawn = (shape: number): boolean => {
    const p = spawnPiece(shape);
    lockResetsRef.current = 0;
    lowestRowRef.current = p.row;
    spawnedAtRef.current = Date.now();
    if (!isValid(boardRef.current, p)) {
      endGame();
      return false;
    }
    setPiece(p);
    setFreshSpawn(true);
    later(() => setFreshSpawn(false), 220);
    return true;
  };

  const startLockTimer = () => {
    if (lockTimerRef.current) return;
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      if (
        gameStateRef.current === "ACTIVE" &&
        isGrounded(boardRef.current, pieceRef.current)
      ) {
        lockAndCascade();
      }
    }, LOCK_DELAY_MS);
  };

  /** Commit a moved piece and manage lock delay (move-reset, capped). */
  const afterMove = (p: Piece) => {
    setPiece(p);
    // Standard rule: getting lower than ever before earns a fresh set of resets,
    // so spinning a piece on the way down doesn't use them all up.
    if (p.row > lowestRowRef.current) {
      lowestRowRef.current = p.row;
      lockResetsRef.current = 0;
    }
    const canReset = lockResetsRef.current < MAX_LOCK_RESETS;
    if (isGrounded(boardRef.current, p)) {
      if (lockTimerRef.current && canReset) {
        clearLockTimer();
        lockResetsRef.current++;
      }
      startLockTimer();
    } else if (lockTimerRef.current) {
      clearLockTimer();
      lockResetsRef.current++;
    }
  };

  const tryMove = (dc: number, dr: number): boolean => {
    if (gameStateRef.current !== "ACTIVE") return false;
    const cur = pieceRef.current;
    const moved = { ...cur, col: cur.col + dc, row: cur.row + dr };
    if (!isValid(boardRef.current, moved)) return false;
    afterMove(moved);
    return true;
  };

  const runCascade = (start: Board) => {
    setGameState("CASCADING");
    let current = start;
    let chain = 0;
    let cleared = 0;

    const finish = () => {
      setClearingRows([]);
      if (chain > 0) {
        const total = linesRef.current + cleared;
        setLines(total);
        const newLevel = Math.floor(total / LINES_PER_LEVEL);
        if (newLevel > levelRef.current) {
          setLevel(newLevel);
          pushPopup({ text: `Level ${newLevel + 1}!`, tone: "level" });
        }
        if (chain > bestChainRef.current) setBestChain(chain);
      }
      setCanHold(true);
      setGameState("ACTIVE");
      if (spawn(takeFromQueue())) persist();
    };

    const step = () => {
      const full = findFullRows(current);
      if (full.length === 0) {
        finish();
        return;
      }
      chain++;
      cleared += full.length;
      const pts = scoreFor(full.length, chain, levelRef.current);
      setScore(scoreRef.current + pts);
      pushPopup(
        chain > 1
          ? {
              text: `Chain ×${chain}!`,
              sub: `+${pts.toLocaleString()}`,
              tone: "chain",
            }
          : {
              text: CLEAR_LABELS[Math.min(full.length, CLEAR_LABELS.length - 1)],
              sub: `+${pts.toLocaleString()}`,
              tone: "score",
            },
      );
      setClearingRows(full);

      later(() => {
        setClearingRows([]);
        current = clearRowsInPlace(current, full);
        setBoard(current);
        const fall = () => {
          const [next, moved] = gravityStep(current);
          if (!moved) {
            later(step, CHAIN_PAUSE_MS);
            return;
          }
          current = next;
          setBoard(current);
          later(fall, FALL_STEP_MS);
        };
        later(fall, FALL_STEP_MS);
      }, CLEAR_ANIM_MS);
    };

    step();
  };

  const lockAndCascade = () => {
    clearLockTimer();
    lockResetsRef.current = 0;
    const [locked, id] = lockPiece(boardRef.current, pieceRef.current);
    setBoard(locked);
    setLockedId(id);
    later(() => setLockedId((cur) => (cur === id ? null : cur)), 300);
    runCascade(locked);
  };

  const inSpawnGrace = () => Date.now() - spawnedAtRef.current < SPAWN_GRACE_MS;

  const moveLeft = () => {
    if (!inSpawnGrace()) tryMove(-1, 0);
  };
  const moveRight = () => {
    if (!inSpawnGrace()) tryMove(1, 0);
  };

  const rotate = (dir: 1 | -1 = 1) => {
    if (gameStateRef.current !== "ACTIVE" || inSpawnGrace()) return;
    const p = pieceRef.current;
    const rotation = (p.rotation + dir + 4) % 4;
    // Wall / floor kicks: [colOffset, rowOffset]
    const kicks: [number, number][] = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-2, 0],
      [2, 0],
      [-1, -1],
      [1, -1],
    ];
    for (const [dc, dr] of kicks) {
      const candidate = { ...p, rotation, col: p.col + dc, row: p.row + dr };
      if (isValid(boardRef.current, candidate)) {
        afterMove(candidate);
        return;
      }
    }
  };

  const softDrop = () => {
    if (gameStateRef.current !== "ACTIVE" || inSpawnGrace()) return;
    if (tryMove(0, 1)) {
      setScore(scoreRef.current + 1);
    } else {
      lockAndCascade();
    }
  };

  const hardDrop = () => {
    if (gameStateRef.current !== "ACTIVE" || inSpawnGrace()) return;
    const p = { ...pieceRef.current };
    const target = getGhostRow(boardRef.current, p);
    const dropped = target - p.row;
    p.row = target;
    setPiece(p);
    setScore(scoreRef.current + dropped * 2);
    setImpact(true);
    later(() => setImpact(false), 180);
    lockAndCascade();
  };

  const holdPiece = () => {
    if (
      gameStateRef.current !== "ACTIVE" ||
      !canHoldRef.current ||
      inSpawnGrace()
    )
      return;
    clearLockTimer();
    const current = pieceRef.current.shape;
    const held = holdRef.current;
    setHold(current);
    setCanHold(false);
    spawn(held ?? takeFromQueue());
  };

  const tick = () => {
    if (gameStateRef.current !== "ACTIVE") return;
    if (!tryMove(0, 1)) startLockTimer();
  };

  const togglePause = () => {
    if (gameStateRef.current === "ACTIVE") {
      clearLockTimer();
      setGameState("PAUSED");
      persist();
    } else if (gameStateRef.current === "PAUSED") {
      setGameState("ACTIVE");
    }
  };

  const newGame = () => {
    clearLater();
    clearLockTimer();
    clearStoredData(STORAGE_KEY);
    nextPieceId = 1;
    setBoard(emptyBoard());
    setQueue([...shuffledBag(), ...shuffledBag()]);
    setHold(null);
    setCanHold(true);
    setScore(0);
    setLevel(0);
    setLines(0);
    setBestChain(0);
    setIsNewBest(false);
    setPopups([]);
    setClearingRows([]);
    setLockedId(null);
    setGameState("ACTIVE");
    spawn(takeFromQueue());
  };

  // Latest handlers for listeners/intervals registered once.
  const handlers = useRef({
    tick,
    moveLeft,
    moveRight,
    rotate,
    softDrop,
    hardDrop,
    holdPiece,
    togglePause,
    newGame,
    persist,
  });
  handlers.current = {
    tick,
    moveLeft,
    moveRight,
    rotate,
    softDrop,
    hardDrop,
    holdPiece,
    togglePause,
    newGame,
    persist,
  };

  // Restore saved game + best score
  useEffect(() => {
    const savedBest = getStoredData(BEST_KEY);
    if (typeof savedBest === "number") setBest(savedBest);

    const stored = getStoredData(STORAGE_KEY) as SavedState | null;
    if (stored?.board && stored.currentPiece) {
      let q =
        stored.queue && stored.queue.length > 0
          ? stored.queue
          : [stored.nextPiece?.shape ?? 0];
      while (q.length < QUEUE_PREVIEW + 1) q = q.concat(shuffledBag());
      setBoard(stored.board);
      setPiece(stored.currentPiece);
      setQueue(q);
      setHold(stored.hold ?? null);
      setCanHold(stored.canHold ?? true);
      setScore(stored.score ?? 0);
      setLevel(stored.level ?? 0);
      setLines(stored.totalLines ?? 0);
      setBestChain(stored.bestChain ?? 0);
      if (stored.nextPieceId) nextPieceId = stored.nextPieceId;
      setGameState("PAUSED");
    }
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickMs = Math.max(TICK_MS_MIN, TICK_MS_START - level * TICK_SPEEDUP);

  // Gravity loop
  useEffect(() => {
    if (!isLoaded || gameState !== "ACTIVE") return;
    const id = setInterval(() => handlers.current.tick(), tickMs);
    return () => clearInterval(id);
  }, [gameState, tickMs, isLoaded]);

  // Leaving ACTIVE cancels any pending lock
  useEffect(() => {
    if (gameState !== "ACTIVE") clearLockTimer();
  }, [gameState]);

  // Cleanup everything on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  // Auto-pause when the tab is hidden
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameStateRef.current === "ACTIVE") {
        handlers.current.togglePause();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [gameStateRef]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = handlers.current;
      const state = gameStateRef.current;
      const key = e.key;

      if (key === "Escape" || key === "p" || key === "P") {
        e.preventDefault();
        h.togglePause();
        return;
      }
      if (state === "START" || state === "OVER") {
        if ((key === "Enter" || key === " ") && !e.repeat) {
          e.preventDefault();
          h.newGame();
        }
        return;
      }
      if (state === "PAUSED") {
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          if (!e.repeat) h.togglePause();
        }
        return;
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)
      ) {
        e.preventDefault();
      }
      if (state !== "ACTIVE") return;

      switch (key) {
        case "ArrowLeft":
          h.moveLeft();
          break;
        case "ArrowRight":
          h.moveRight();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          if (!e.repeat) h.rotate(1);
          break;
        case "z":
        case "Z":
        case "Control":
          if (!e.repeat) h.rotate(-1);
          break;
        case "ArrowDown":
          h.softDrop();
          break;
        case " ":
          if (!e.repeat) h.hardDrop();
          break;
        case "c":
        case "C":
          h.holdPiece();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameStateRef]);

  // Board touch gestures: drag to slide, tap to rotate, flick down to drop
  const onTouchStart = (e: ReactTouchEvent) => {
    if (gameStateRef.current !== "ACTIVE") return;
    const t = e.touches[0];
    touchRef.current = {
      x0: t.clientX,
      y0: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      t: Date.now(),
      moved: false,
    };
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    const s = touchRef.current;
    if (!s || gameStateRef.current !== "ACTIVE") return;
    const t = e.touches[0];
    const cellPx = (boardElRef.current?.clientWidth ?? 280) / COLS;
    const totalDx = t.clientX - s.x0;
    const totalDy = t.clientY - s.y0;

    if (Math.abs(totalDx) >= Math.abs(totalDy)) {
      while (t.clientX - s.lastX >= cellPx) {
        moveRight();
        s.lastX += cellPx;
        s.moved = true;
      }
      while (s.lastX - t.clientX >= cellPx) {
        moveLeft();
        s.lastX -= cellPx;
        s.moved = true;
      }
    } else if (totalDy > 0) {
      while (t.clientY - s.lastY >= cellPx * 1.2) {
        softDrop();
        s.lastY += cellPx * 1.2;
        s.moved = true;
      }
    }
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s || gameStateRef.current !== "ACTIVE") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x0;
    const dy = t.clientY - s.y0;
    const dt = Date.now() - s.t;

    if (!s.moved && Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 280) {
      rotate(1);
    } else if (dt < 300 && dy > 70 && dy > Math.abs(dx) * 1.5) {
      hardDrop();
    }
  };

  if (!isLoaded) return null;

  // --- Build the board display ---
  const showPiece = gameState === "ACTIVE" || gameState === "PAUSED";
  const display: (DisplayCell | null)[][] = board.map((row) =>
    row.map((c) =>
      c ? { shape: c.color, id: c.pieceId, kind: "block" as const } : null,
    ),
  );
  if (showPiece) {
    const ghostRow = getGhostRow(board, piece);
    for (const [r, c] of getCells({ ...piece, row: ghostRow })) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !display[r][c]) {
        display[r][c] = { shape: piece.shape, id: GHOST_ID, kind: "ghost" };
      }
    }
    for (const [r, c] of getCells(piece)) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        display[r][c] = { shape: piece.shape, id: ACTIVE_ID, kind: "block" };
      }
    }
  }

  const danger =
    gameState !== "OVER" &&
    gameState !== "START" &&
    board.slice(0, DANGER_ROWS).some((row) => row.some(Boolean));
  const levelProgress = (lines % LINES_PER_LEVEL) / LINES_PER_LEVEL;

  return (
    <div className="cascade-shell">
      <section className="cascade-panel cascade-hold">
        <div className="cascade-panel-label">Hold</div>
        <div className={`cascade-mini-slot${canHold ? "" : " is-dim"}`}>
          {hold !== null && <MiniPiece shape={hold} />}
        </div>
      </section>

      <section className="cascade-panel cascade-stats">
        <div className="cascade-stat">
          <div className="cascade-panel-label">Score</div>
          <div className="cascade-stat-value">{score.toLocaleString()}</div>
        </div>
        <div className="cascade-stat cascade-stat-best">
          <div className="cascade-panel-label">Best</div>
          <div className="cascade-stat-value cascade-stat-small">
            {Math.max(best, score).toLocaleString()}
          </div>
        </div>
        <div className="cascade-stat">
          <div className="cascade-panel-label">Level</div>
          <div className="cascade-stat-value">{level + 1}</div>
          <div className="cascade-level-bar" aria-hidden>
            <div style={{ width: `${levelProgress * 100}%` }} />
          </div>
        </div>
        <div className="cascade-stat">
          <div className="cascade-panel-label">Lines</div>
          <div className="cascade-stat-value">{lines}</div>
        </div>
        <button
          type="button"
          className="cascade-pause-btn"
          aria-label={gameState === "PAUSED" ? "Resume" : "Pause"}
          disabled={gameState !== "ACTIVE" && gameState !== "PAUSED"}
          onClick={togglePause}>
          {gameState === "PAUSED" ? "▶" : "❚❚"}
          <span className="cascade-pause-label">
            {gameState === "PAUSED" ? "Resume" : "Pause"}
          </span>
        </button>
      </section>

      <div
        className={`cascade-board-wrap${impact ? " is-impact" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <div
          ref={boardElRef}
          className={`cascade-board${danger ? " is-danger" : ""}`}>
          <BlockGrid
            cells={display}
            freshSpawn={freshSpawn}
            clearingRows={clearingRows}
            lockedId={lockedId}
          />
        </div>

        <div className="cascade-popups" aria-live="polite">
          {popups.map((p) => (
            <div key={p.id} className={`cascade-popup tone-${p.tone}`}>
              <div className="cascade-popup-text">{p.text}</div>
              {p.sub && <div className="cascade-popup-sub">{p.sub}</div>}
            </div>
          ))}
        </div>

        {gameState === "START" && (
          <Overlay>
            <div className="cascade-overlay-title">Ready?</div>
            <div className="cascade-overlay-text">
              Clear a row and the blocks above tumble down. Line up chain
              reactions for huge points!
            </div>
            <button type="button" className="cascade-btn" onClick={newGame}>
              Play ▶
            </button>
            {best > 0 && (
              <div className="cascade-overlay-meta">
                Best: {best.toLocaleString()}
              </div>
            )}
            <div className="cascade-overlay-hint">
              <span className="only-touch">
                Drag to move · Tap to rotate · Flick down to drop
              </span>
              <span className="only-mouse">Press Enter to start</span>
            </div>
          </Overlay>
        )}

        {gameState === "PAUSED" && (
          <Overlay>
            <div className="cascade-overlay-title">Paused</div>
            <button
              type="button"
              className="cascade-btn"
              onClick={togglePause}>
              Resume ▶
            </button>
            <button
              type="button"
              className="cascade-btn cascade-btn-secondary"
              onClick={newGame}>
              New game
            </button>
          </Overlay>
        )}

        {gameState === "OVER" && (
          <Overlay>
            <div className="cascade-overlay-title">Game Over</div>
            {isNewBest && <div className="cascade-badge">New best!</div>}
            <div className="cascade-final-score">{score.toLocaleString()}</div>
            <div className="cascade-final-stats">
              <div>
                <div className="cascade-panel-label">Level</div>
                <div className="cascade-stat-value">{level + 1}</div>
              </div>
              <div>
                <div className="cascade-panel-label">Lines</div>
                <div className="cascade-stat-value">{lines}</div>
              </div>
              <div>
                <div className="cascade-panel-label">Chain</div>
                <div className="cascade-stat-value">×{bestChain}</div>
              </div>
            </div>
            <button type="button" className="cascade-btn" onClick={newGame}>
              Play again 🔁
            </button>
          </Overlay>
        )}
      </div>

      <section className="cascade-panel cascade-next">
        <div className="cascade-panel-label">Next</div>
        <div className="cascade-next-list">
          {queue.slice(0, QUEUE_PREVIEW).map((shape, i) => (
            <div key={`${i}-${shape}`} className="cascade-mini-slot">
              <MiniPiece shape={shape} />
            </div>
          ))}
        </div>
      </section>

      <section className="cascade-panel cascade-keys">
        <div className="cascade-panel-label">Controls</div>
        <ul>
          <li>
            <kbd>←</kbd>
            <kbd>→</kbd> Move
          </li>
          <li>
            <kbd>↑</kbd> Rotate
          </li>
          <li>
            <kbd>Z</kbd> Spin back
          </li>
          <li>
            <kbd>↓</kbd> Soft drop
          </li>
          <li>
            <kbd>Space</kbd> Drop
          </li>
          <li>
            <kbd>C</kbd> Hold
          </li>
          <li>
            <kbd>P</kbd> Pause
          </li>
        </ul>
      </section>

      <div className="cascade-controls">
        <CtrlButton label="Move left" repeat onPress={moveLeft}>
          ◀
        </CtrlButton>
        <CtrlButton label="Soft drop" repeat onPress={softDrop}>
          ▼
        </CtrlButton>
        <CtrlButton label="Move right" repeat onPress={moveRight}>
          ▶
        </CtrlButton>
        <CtrlButton
          label="Hold"
          className="cascade-ctrl-hold"
          onPress={holdPiece}>
          <small>Hold</small>
        </CtrlButton>
        <CtrlButton
          label="Rotate"
          className="cascade-ctrl-rotate"
          onPress={() => rotate(1)}>
          ↻
        </CtrlButton>
        <CtrlButton
          label="Drop"
          className="cascade-ctrl-drop"
          onPress={hardDrop}>
          ⤓ <small>Drop</small>
        </CtrlButton>
      </div>
    </div>
  );
}

const LOGO = "CASCADE";

export default function Quadra() {
  return (
    <Box className="cascade-page">
      <header className="cascade-header">
        <h1 className="cascade-logo" aria-label="Cascade">
          {LOGO.split("").map((ch, i) => (
            <span
              key={i}
              aria-hidden
              style={
                {
                  color: PIECE_COLORS[i % PIECE_COLORS.length].base,
                  "--i": i,
                } as CSSProperties
              }>
              {ch}
            </span>
          ))}
        </h1>
        <p className="cascade-tagline">
          Clear lines → blocks tumble → chain reactions!
        </p>
      </header>
      <GameScreen />
    </Box>
  );
}
