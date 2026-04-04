import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/quadra";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Cascade - Games by DaniB" },
    { name: "description", content: "Tetris with chain reactions!" },
  ];
}

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const TICK_MS_START = 800;
const TICK_MS_MIN = 150;
const TICK_SPEEDUP = 40; // ms faster per level
const LINES_PER_LEVEL = 5;
const CASCADE_DELAY = 200; // ms between cascade steps

type Cell = number | null; // null = empty, number = color index
type Board = Cell[][];

// 7 standard tetrominoes – each rotation is a list of [row, col] offsets
const COLORS = [
  "hsl(185, 90%, 50%)", // I - cyan
  "hsl(50, 95%, 55%)", // O - yellow
  "hsl(280, 70%, 55%)", // T - purple
  "hsl(140, 70%, 50%)", // S - green
  "hsl(0, 80%, 55%)", // Z - red
  "hsl(220, 80%, 55%)", // J - blue
  "hsl(25, 90%, 55%)", // L - orange
];

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

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece(): Piece {
  return {
    shape: Math.floor(Math.random() * SHAPES.length),
    rotation: 0,
    row: 0,
    col: Math.floor(COLS / 2),
  };
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

function lockPiece(board: Board, p: Piece): Board {
  const next = board.map((row) => [...row]);
  for (const [r, c] of getCells(p)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      next[r][c] = p.shape;
    }
  }
  return next;
}

/** Clear full lines and return [newBoard, linesCleared] */
function clearLines(board: Board): [Board, number] {
  const kept = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  const empties = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return [[...empties, ...kept], cleared];
}

/** Find connected groups of same-color blocks using flood fill */
function findGroups(board: Board): [number, number][][] {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups: [number, number][][] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === null || visited[r][c]) continue;
      const color = board[r][c];
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
            board[nr][nc] === color
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

/** Quadra gravity: connected same-color groups fall as rigid units */
function applyGravity(board: Board): Board {
  const next = board.map((row) => [...row]);
  let changed = true;

  while (changed) {
    changed = false;
    const groups = findGroups(next);

    for (const group of groups) {
      // Check if every cell in the group can move down by 1
      const canFall = group.every(([r, c]) => {
        const below = r + 1;
        if (below >= ROWS) return false;
        if (next[below][c] === null) return true;
        // Cell below is occupied — but is it part of the same group?
        return group.some(([gr, gc]) => gr === below && gc === c);
      });

      if (canFall) {
        // Remove group from current positions (bottom-up to avoid overwrite)
        const color = next[group[0][0]][group[0][1]];
        const sorted = [...group].sort((a, b) => b[0] - a[0]); // bottom first
        for (const [r, c] of sorted) {
          next[r][c] = null;
        }
        // Place group one row down
        for (const [r, c] of sorted) {
          next[r + 1][c] = color;
        }
        changed = true;
        break; // restart since board changed
      }
    }
  }

  return next;
}

/** Run cascade: clear lines → gravity → repeat. Returns [board, totalLines, chainLength] */
function cascade(board: Board): [Board, number, number] {
  let totalLines = 0;
  let chain = 0;
  let current = board;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [cleared, lines] = clearLines(current);
    if (lines === 0) break;
    totalLines += lines;
    chain++;
    current = applyGravity(cleared);
  }

  return [current, totalLines, chain];
}

function getGhostRow(board: Board, piece: Piece): number {
  let ghost = { ...piece };
  while (isValid(board, { ...ghost, row: ghost.row + 1 })) {
    ghost.row++;
  }
  return ghost.row;
}

// --- Scoring ---
function scoreLines(lines: number, chain: number, level: number): number {
  const base = [0, 100, 300, 500, 800][Math.min(lines, 4)];
  const chainBonus = chain > 1 ? chain * 200 : 0;
  return (base + chainBonus) * (level + 1);
}

// --- Game State ---
type GameState = "START" | "ACTIVE" | "PAUSED" | "CASCADING" | "OVER";

const STORAGE_KEY = "quadra-game-state";

interface SavedState {
  board: Board;
  score: number;
  level: number;
  totalLines: number;
  currentPiece: Piece;
  nextPiece: Piece;
}

// --- Components ---

function BoardDisplay({
  board,
  piece,
  ghostRow,
  cascading,
}: {
  board: Board;
  piece: Piece | null;
  ghostRow: number | null;
  cascading: boolean;
}) {
  // Build display grid
  const display = board.map((row) => [...row]);

  // Ghost piece
  if (piece && ghostRow !== null && !cascading) {
    const ghostCells = getCells({ ...piece, row: ghostRow });
    for (const [r, c] of ghostCells) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && display[r][c] === null) {
        display[r][c] = -1; // ghost marker
      }
    }
  }

  // Active piece
  if (piece && !cascading) {
    for (const [r, c] of getCells(piece)) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        display[r][c] = piece.shape;
      }
    }
  }

  const ghostColor = piece ? COLORS[piece.shape] : undefined;

  return (
    <div className="quadra-board">
      {display.map((row, ri) => (
        <div key={ri} className="quadra-row">
          {row.map((cell, ci) => (
            <div
              key={ci}
              className={`quadra-cell ${cell !== null && cell >= 0 ? "quadra-cell-filled" : ""} ${cell === -1 ? "quadra-cell-ghost" : ""}`}
              style={
                cell !== null && cell >= 0
                  ? { backgroundColor: COLORS[cell] }
                  : cell === -1 && ghostColor
                    ? ({ "--ghost-color": ghostColor } as React.CSSProperties)
                    : undefined
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function NextPieceDisplay({ piece }: { piece: Piece }) {
  const cells = SHAPES[piece.shape][0];
  // Find bounding box
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  const grid: Cell[][] = Array.from({ length: h }, () => Array(w).fill(null));
  for (const [r, c] of cells) {
    grid[r - minR][c - minC] = piece.shape;
  }

  return (
    <div className="quadra-next">
      <Typography variant="body2" sx={{ mb: 0.5, opacity: 0.6 }}>
        Next
      </Typography>
      <div className="quadra-next-grid">
        {grid.map((row, ri) => (
          <div key={ri} className="quadra-row">
            {row.map((cell, ci) => (
              <div
                key={ci}
                className={`quadra-cell quadra-cell-small ${cell !== null ? "quadra-cell-filled" : ""}`}
                style={
                  cell !== null ? { backgroundColor: COLORS[cell] } : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GameScreen() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece>(randomPiece);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [gameState, setGameState] = useState<GameState>("ACTIVE");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [chain, setChain] = useState(0);
  const [showChain, setShowChain] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval>>(null);
  const cascadeRef = useRef<ReturnType<typeof setTimeout>>(null);
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const nextPieceRef = useRef(nextPiece);
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);
  const totalLinesRef = useRef(totalLines);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  boardRef.current = board;
  pieceRef.current = piece;
  nextPieceRef.current = nextPiece;
  gameStateRef.current = gameState;
  scoreRef.current = score;
  levelRef.current = level;
  totalLinesRef.current = totalLines;

  // Save to localStorage
  const saveState = useCallback(() => {
    setStoredData(STORAGE_KEY, {
      board: boardRef.current,
      score: scoreRef.current,
      level: levelRef.current,
      totalLines: totalLinesRef.current,
      currentPiece: pieceRef.current,
      nextPiece: nextPieceRef.current,
    } satisfies SavedState);
  }, []);

  // Restore from localStorage
  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY) as SavedState | null;
    if (stored?.board && stored.currentPiece) {
      setBoard(stored.board);
      setPiece(stored.currentPiece);
      setNextPiece(stored.nextPiece);
      setScore(stored.score ?? 0);
      setLevel(stored.level ?? 0);
      setTotalLines(stored.totalLines ?? 0);
    }
    setIsLoaded(true);
  }, []);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === "ACTIVE") {
      setGameState("PAUSED");
    } else if (gameStateRef.current === "PAUSED") {
      setGameState("ACTIVE");
    }
  }, []);

  const tickMs = Math.max(TICK_MS_MIN, TICK_MS_START - level * TICK_SPEEDUP);

  const spawnNext = useCallback(() => {
    const np = nextPieceRef.current;
    if (!isValid(boardRef.current, np)) {
      setGameState("OVER");
      clearStoredData(STORAGE_KEY);
      return;
    }
    setPiece(np);
    const fresh = randomPiece();
    setNextPiece(fresh);
  }, []);

  const runCascade = useCallback(
    (lockedBoard: Board) => {
      setGameState("CASCADING");

      // Step through cascade with delays for visual feedback
      let current = lockedBoard;
      let totalClearedLines = 0;
      let chainLen = 0;

      function step() {
        const [afterClear, lines] = clearLines(current);
        if (lines === 0) {
          // Cascade done
          setBoard(current);
          setGameState("ACTIVE");
          if (chainLen > 0) {
            const pts = scoreLines(
              totalClearedLines,
              chainLen,
              levelRef.current,
            );
            setScore((s) => s + pts);
            setTotalLines((t) => {
              const newTotal = t + totalClearedLines;
              const newLevel = Math.floor(newTotal / LINES_PER_LEVEL);
              setLevel(newLevel);
              return newTotal;
            });
            if (chainLen > 1) {
              setChain(chainLen);
              setShowChain(true);
              setTimeout(() => setShowChain(false), 1500);
            }
          }
          spawnNext();
          return;
        }

        totalClearedLines += lines;
        chainLen++;

        // Show cleared board briefly, then apply gravity
        setBoard(afterClear);
        cascadeRef.current = setTimeout(() => {
          current = applyGravity(afterClear);
          setBoard(current);
          // Check for more clears after gravity
          cascadeRef.current = setTimeout(step, CASCADE_DELAY);
        }, CASCADE_DELAY);
      }

      step();
    },
    [spawnNext],
  );

  const lockAndCascade = useCallback(() => {
    const locked = lockPiece(boardRef.current, pieceRef.current);
    setBoard(locked);
    runCascade(locked);
    saveState();
  }, [runCascade, saveState]);

  // Move piece down by 1; lock if can't
  const tick = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    const p = pieceRef.current;
    const moved = { ...p, row: p.row + 1 };
    if (isValid(boardRef.current, moved)) {
      setPiece(moved);
    } else {
      lockAndCascade();
    }
  }, [lockAndCascade]);

  // Game loop
  useEffect(() => {
    if (gameState !== "ACTIVE" || !isLoaded) return;
    tickRef.current = setInterval(tick, tickMs);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [gameState, tickMs, tick, isLoaded]);

  // Cleanup cascade on unmount
  useEffect(() => {
    return () => {
      if (cascadeRef.current) clearTimeout(cascadeRef.current);
    };
  }, []);

  const moveLeft = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    const moved = { ...pieceRef.current, col: pieceRef.current.col - 1 };
    if (isValid(boardRef.current, moved)) setPiece(moved);
  }, []);

  const moveRight = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    const moved = { ...pieceRef.current, col: pieceRef.current.col + 1 };
    if (isValid(boardRef.current, moved)) setPiece(moved);
  }, []);

  const rotate = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    const p = pieceRef.current;
    const rotated = { ...p, rotation: (p.rotation + 1) % 4 };
    // Try basic rotation, then wall kicks
    if (isValid(boardRef.current, rotated)) {
      setPiece(rotated);
      return;
    }
    for (const kick of [-1, 1, -2, 2]) {
      const kicked = { ...rotated, col: rotated.col + kick };
      if (isValid(boardRef.current, kicked)) {
        setPiece(kicked);
        return;
      }
    }
  }, []);

  const softDrop = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    const moved = { ...pieceRef.current, row: pieceRef.current.row + 1 };
    if (isValid(boardRef.current, moved)) {
      setPiece(moved);
      setScore((s) => s + 1);
    }
  }, []);

  const hardDrop = useCallback(() => {
    if (gameStateRef.current !== "ACTIVE") return;
    let p = { ...pieceRef.current };
    let dropped = 0;
    while (isValid(boardRef.current, { ...p, row: p.row + 1 })) {
      p.row++;
      dropped++;
    }
    setPiece(p);
    pieceRef.current = p;
    setScore((s) => s + dropped * 2);
    lockAndCascade();
  }, [lockAndCascade]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (gameStateRef.current !== "ACTIVE") return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveLeft();
          break;
        case "ArrowRight":
          e.preventDefault();
          moveRight();
          break;
        case "ArrowUp":
          e.preventDefault();
          rotate();
          break;
        case "ArrowDown":
          e.preventDefault();
          softDrop();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveLeft, moveRight, rotate, softDrop, hardDrop, togglePause]);

  // Touch controls on board (swipe gestures)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== "ACTIVE") return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || gameStateRef.current !== "ACTIVE") return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < 15 && absDy < 15 && dt < 300) {
        rotate();
      } else if (absDy > absDx && dy > 40) {
        hardDrop();
      } else if (absDx > absDy) {
        if (dx < -30) moveLeft();
        else if (dx > 30) moveRight();
      }
    },
    [rotate, hardDrop, moveLeft, moveRight],
  );

  // Hold-to-repeat for mobile buttons
  const holdRef = useRef<ReturnType<typeof setInterval>>(null);
  const startHold = useCallback((action: () => void) => {
    action();
    const id = setInterval(action, 100);
    holdRef.current = id;
  }, []);
  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const ghostRow =
    gameState === "ACTIVE" || gameState === "PAUSED"
      ? getGhostRow(board, piece)
      : null;

  if (!isLoaded) return null;

  if (gameState === "OVER") {
    return (
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        <div className="cooking-celebration">
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
            Game Over!
          </Typography>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Score: {score.toLocaleString()}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1, opacity: 0.7 }}>
            Level {level} · {totalLines} lines
          </Typography>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 16,
            }}>
            <button
              className="btn"
              onClick={() => {
                setBoard(emptyBoard());
                setPiece(randomPiece());
                setNextPiece(randomPiece());
                setScore(0);
                setLevel(0);
                setTotalLines(0);
                setGameState("ACTIVE");
              }}>
              Play Again! 🔁
            </button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div
      className="quadra-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>
      <div className="quadra-sidebar">
        <NextPieceDisplay piece={nextPiece} />
        <div className="quadra-stats">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {score.toLocaleString()}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            Score
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
            {level}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            Level
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
            {totalLines}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            Lines
          </Typography>
        </div>
      </div>

      <div className="quadra-board-wrapper">
        <BoardDisplay
          board={board}
          piece={piece}
          ghostRow={ghostRow}
          cascading={gameState === "CASCADING"}
        />
        {gameState === "PAUSED" && (
          <div className="quadra-pause-overlay" onClick={togglePause}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              ⏸️ Paused
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.6, mt: 1 }}>
              Tap or press Esc to resume
            </Typography>
          </div>
        )}
        {showChain && (
          <div className="quadra-chain-popup">
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {chain}x Chain! ⚡
            </Typography>
          </div>
        )}
      </div>

      <div className="quadra-controls">
        <div className="quadra-ctrl-row">
          <button
            className="quadra-ctrl-btn"
            onTouchStart={() => startHold(moveLeft)}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            onClick={moveLeft}>
            ◀
          </button>
          <button
            className="quadra-ctrl-btn quadra-ctrl-drop"
            onTouchStart={() => startHold(hardDrop)}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            onClick={hardDrop}>
            ⏬ Drop
          </button>
          <button
            className="quadra-ctrl-btn"
            onTouchStart={() => startHold(moveRight)}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            onClick={moveRight}>
            ▶
          </button>
        </div>
        <div className="quadra-ctrl-row">
          <button
            className="quadra-ctrl-btn"
            onTouchStart={() => startHold(softDrop)}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            onClick={softDrop}>
            ▼
          </button>
          <button
            className="quadra-ctrl-btn quadra-ctrl-rotate"
            onClick={rotate}>
            ↻ Rotate
          </button>
          <button
            className="quadra-ctrl-btn quadra-ctrl-pause"
            onClick={togglePause}>
            {gameState === "PAUSED" ? "▶" : "⏸"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Quadra() {
  return (
    <Box sx={{ pb: 2 }}>
      <Container
        maxWidth="sm"
        sx={{ textAlign: "center", mb: 1, px: { xs: 1, sm: 2 } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          🧱 Cascade
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.5, mb: 1 }}>
          Clear lines → blocks fall → chain reactions!
        </Typography>
      </Container>
      <GameScreen />
    </Box>
  );
}
