import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/ballsort";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ball Sort - Games by DaniB" },
    { name: "description", content: "Sort the colored balls into tubes!" },
  ];
}

type GameState = "START" | "ACTIVE" | "WON";

// Color palette — bright, kid-friendly, distinguishable
const BALL_COLORS = [
  { name: "Red", hsl: "hsl(0, 80%, 55%)" },
  { name: "Blue", hsl: "hsl(220, 80%, 55%)" },
  { name: "Green", hsl: "hsl(140, 70%, 45%)" },
  { name: "Yellow", hsl: "hsl(50, 90%, 55%)" },
  { name: "Purple", hsl: "hsl(280, 70%, 55%)" },
  { name: "Orange", hsl: "hsl(25, 90%, 55%)" },
  { name: "Pink", hsl: "hsl(330, 80%, 65%)" },
  { name: "Cyan", hsl: "hsl(185, 80%, 45%)" },
  { name: "Lime", hsl: "hsl(80, 75%, 50%)" },
  { name: "Brown", hsl: "hsl(20, 50%, 40%)" },
];

const TUBE_CAPACITY = 4;
const MIN_COLORS = 2;
const MAX_COLORS = 10;
const MIN_EXTRA_TUBES = 1;
const MAX_EXTRA_TUBES = 4;

type Tube = number[]; // array of color indices, index 0 = bottom

function generatePuzzle(numColors: number, extraTubes: number): Tube[] {
  // Create balls: TUBE_CAPACITY of each color
  const balls: number[] = [];
  for (let c = 0; c < numColors; c++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) {
      balls.push(c);
    }
  }

  // Fisher-Yates shuffle
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }

  // Fill tubes
  const tubes: Tube[] = [];
  for (let t = 0; t < numColors; t++) {
    tubes.push(balls.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY));
  }

  // Add empty tubes
  for (let t = 0; t < extraTubes; t++) {
    tubes.push([]);
  }

  return tubes;
}

function isSolved(tubes: Tube[]): boolean {
  return tubes.every(
    (tube) =>
      tube.length === 0 ||
      (tube.length === TUBE_CAPACITY && tube.every((b) => b === tube[0])),
  );
}

/** Get the count of top balls that share the same color */
function getTopGroup(tube: Tube): { color: number; count: number } {
  if (tube.length === 0) return { color: -1, count: 0 };
  const topColor = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === topColor) count++;
    else break;
  }
  return { color: topColor, count };
}

/** Calculate how many balls can move from source to dest */
function getMovableCount(source: Tube, dest: Tube): number {
  const { count } = getTopGroup(source);
  if (count === 0) return 0;

  const destSpace = TUBE_CAPACITY - dest.length;
  if (destSpace === 0) return 0;

  // Move as many of the top group as will fit
  return Math.min(count, destSpace);
}

/** BFS solver: find minimum moves using same-color-only rules */
function solvePuzzle(initialTubes: Tube[]): number | null {
  if (isSolved(initialTubes)) return 0;

  const MAX_VISITED = 300_000;

  function serialize(tubes: Tube[]): string {
    return tubes
      .map((t) => t.join(","))
      .sort()
      .join("|");
  }

  const visited = new Set<string>();
  visited.add(serialize(initialTubes));

  let current: Tube[][] = [initialTubes.map((t) => [...t])];
  let moves = 0;

  while (current.length > 0 && visited.size < MAX_VISITED) {
    moves++;
    const next: Tube[][] = [];

    for (const tubes of current) {
      for (let src = 0; src < tubes.length; src++) {
        const srcTube = tubes[src];
        if (srcTube.length === 0) continue;

        const { color, count } = getTopGroup(srcTube);

        // Skip if source tube is already complete
        if (count === TUBE_CAPACITY) continue;

        for (let dst = 0; dst < tubes.length; dst++) {
          if (src === dst) continue;
          const dstTube = tubes[dst];

          // Only same-color or empty destination
          if (dstTube.length > 0 && dstTube[dstTube.length - 1] !== color)
            continue;

          const space = TUBE_CAPACITY - dstTube.length;
          if (space === 0) continue;

          // Skip moving entire single-color stack to empty tube (pointless)
          if (dstTube.length === 0 && count === srcTube.length) continue;

          const movable = Math.min(count, space);

          const nextTubes = tubes.map((t) => [...t]);
          const balls = nextTubes[src].splice(
            nextTubes[src].length - movable,
            movable,
          );
          nextTubes[dst].push(...balls);

          if (isSolved(nextTubes)) return moves;

          const key = serialize(nextTubes);
          if (!visited.has(key)) {
            visited.add(key);
            next.push(nextTubes);
          }
        }
      }
    }

    current = next;
  }

  return null;
}

function StartScreen({
  numColors,
  extraTubes,
  onStart,
  onChangeColors,
  onChangeExtra,
}: {
  numColors: number;
  extraTubes: number;
  onStart: () => void;
  onChangeColors: (n: number) => void;
  onChangeExtra: (n: number) => void;
}) {
  return (
    <Container maxWidth="sm">
      <Typography variant="h4" sx={{ textAlign: "center", mb: 3 }}>
        🧪 Ball Sort Puzzle
      </Typography>

      <div className="ballsort-config">
        <div className="ballsort-config-row">
          <Typography variant="h6">Colors</Typography>
          <div className="ballsort-config-controls">
            <button
              className="icon-btn"
              disabled={numColors <= MIN_COLORS}
              onClick={() => onChangeColors(numColors - 1)}>
              −
            </button>
            <Typography
              variant="h5"
              sx={{ minWidth: 40, textAlign: "center", fontWeight: 700 }}>
              {numColors}
            </Typography>
            <button
              className="icon-btn"
              disabled={numColors >= MAX_COLORS}
              onClick={() => onChangeColors(numColors + 1)}>
              +
            </button>
          </div>
        </div>

        {/* Preview colors */}
        <div className="ballsort-color-preview">
          {BALL_COLORS.slice(0, numColors).map((c, i) => (
            <div
              key={i}
              className="ballsort-ball-small"
              style={{ backgroundColor: c.hsl }}
              title={c.name}
            />
          ))}
        </div>

        <div className="ballsort-config-row" style={{ marginTop: 16 }}>
          <Typography variant="h6">Extra Tubes</Typography>
          <div className="ballsort-config-controls">
            <button
              className="icon-btn"
              disabled={extraTubes <= MIN_EXTRA_TUBES}
              onClick={() => onChangeExtra(extraTubes - 1)}>
              −
            </button>
            <Typography
              variant="h5"
              sx={{ minWidth: 40, textAlign: "center", fontWeight: 700 }}>
              {extraTubes}
            </Typography>
            <button
              className="icon-btn"
              disabled={extraTubes >= MAX_EXTRA_TUBES}
              onClick={() => onChangeExtra(extraTubes + 1)}>
              +
            </button>
          </div>
        </div>

        <Typography
          variant="body2"
          sx={{ opacity: 0.6, textAlign: "center", mt: 1 }}>
          {numColors} filled tubes + {extraTubes} empty ={" "}
          {numColors + extraTubes} total
        </Typography>

        <button
          className="btn"
          style={{ marginTop: 24, width: "100%" }}
          onClick={onStart}>
          Start! 🎮
        </button>
      </div>
    </Container>
  );
}

function TubeComponent({
  tube,
  index,
  isSelected,
  highlightCount,
  canReceive,
  onClick,
}: {
  tube: Tube;
  index: number;
  isSelected: boolean;
  highlightCount: number;
  canReceive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`ballsort-tube ${isSelected ? "ballsort-tube-selected" : ""} ${canReceive ? "ballsort-tube-receivable" : ""}`}
      onClick={onClick}
      aria-label={`Tube ${index + 1}`}>
      <div className="ballsort-tube-inner">
        {Array.from({ length: TUBE_CAPACITY }).map((_, slotIdx) => {
          const ball = tube[slotIdx];
          const isHighlighted =
            isSelected && slotIdx >= tube.length - highlightCount;
          return (
            <div
              key={slotIdx}
              className={`ballsort-slot ${ball != null ? "ballsort-ball" : ""} ${isHighlighted ? "ballsort-ball-highlighted" : ""}`}
              style={
                ball != null
                  ? { backgroundColor: BALL_COLORS[ball]?.hsl }
                  : undefined
              }
            />
          );
        })}
      </div>
    </button>
  );
}

function GameScreen({
  initialTubes,
  numColors,
  optimalMoves,
  savedState,
  onWin,
  onSave,
  onRestart,
  onNewGame,
}: {
  initialTubes: Tube[];
  numColors: number;
  optimalMoves: number | null;
  savedState?: { tubes: Tube[]; moveCount: number; history: Tube[][] };
  onWin: (moves: number) => void;
  onSave: (state: {
    tubes: Tube[];
    moveCount: number;
    history: Tube[][];
  }) => void;
  onRestart: () => void;
  onNewGame: () => void;
}) {
  const [tubes, setTubes] = useState<Tube[]>(savedState?.tubes ?? initialTubes);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moveCount, setMoveCount] = useState(savedState?.moveCount ?? 0);
  const [history, setHistory] = useState<Tube[][]>(savedState?.history ?? []);

  // Check win
  useEffect(() => {
    if (moveCount > 0 && isSolved(tubes)) {
      onWin(moveCount);
    }
  }, [tubes, moveCount, onWin]);

  const selectedGroup = useMemo(() => {
    if (selectedTube === null) return { color: -1, count: 0 };
    return getTopGroup(tubes[selectedTube]);
  }, [selectedTube, tubes]);

  const handleTubeClick = useCallback(
    (index: number) => {
      if (selectedTube === null) {
        // Select a tube (only if it has balls)
        if (tubes[index].length === 0) return;
        setSelectedTube(index);
      } else if (selectedTube === index) {
        // Deselect
        setSelectedTube(null);
      } else {
        // Try to move
        const movable = getMovableCount(tubes[selectedTube], tubes[index]);
        if (movable > 0) {
          const newHistory = [...history, tubes.map((t) => [...t])];
          const next = tubes.map((t) => [...t]);
          const balls = next[selectedTube].splice(
            next[selectedTube].length - movable,
            movable,
          );
          next[index].push(...balls);
          const newMoveCount = moveCount + 1;
          setHistory(newHistory);
          setTubes(next);
          setMoveCount(newMoveCount);
          onSave({
            tubes: next,
            moveCount: newMoveCount,
            history: newHistory,
          });
        }
        setSelectedTube(null);
      }
    },
    [selectedTube, tubes, history, moveCount, onSave],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevTubes = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const newMoveCount = moveCount - 1;
    setTubes(prevTubes);
    setHistory(newHistory);
    setMoveCount(newMoveCount);
    setSelectedTube(null);
    onSave({ tubes: prevTubes, moveCount: newMoveCount, history: newHistory });
  }, [history, moveCount, onSave]);

  return (
    <Container maxWidth="md" sx={{ textAlign: "center" }}>
      <div className="ballsort-header">
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          🧪 Ball Sort
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.6 }}>
          Moves: {moveCount}
          {optimalMoves != null && ` · Best: ${optimalMoves}`}
        </Typography>
      </div>

      <div className="ballsort-actions">
        <button
          className="btn"
          onClick={handleUndo}
          disabled={history.length === 0}
          style={{ fontSize: "0.85rem" }}>
          ↩ Undo
        </button>
        <button
          className="btn"
          onClick={onRestart}
          style={{ fontSize: "0.85rem" }}>
          🔄 Restart
        </button>
        <button
          className="btn"
          onClick={onNewGame}
          style={{ fontSize: "0.85rem" }}>
          🆕 New Game
        </button>
      </div>

      <div
        className={`ballsort-grid ${tubes.length > 7 ? "ballsort-grid-compact" : ""}`}>
        {(() => {
          const n = tubes.length;
          const perRow = n <= 7 ? n : Math.ceil(n / 2);
          const rows: Tube[][] = [];
          for (let r = 0; r < n; r += perRow) {
            rows.push(tubes.slice(r, r + perRow));
          }
          return rows.map((row, ri) => (
            <div key={ri} className="ballsort-row">
              {row.map((tube, ci) => {
                const i = ri * perRow + ci;
                const canReceive =
                  selectedTube !== null &&
                  selectedTube !== i &&
                  getMovableCount(tubes[selectedTube], tube) > 0;
                return (
                  <TubeComponent
                    key={i}
                    tube={tube}
                    index={i}
                    isSelected={selectedTube === i}
                    highlightCount={
                      selectedTube === i ? selectedGroup.count : 0
                    }
                    canReceive={canReceive}
                    onClick={() => handleTubeClick(i)}
                  />
                );
              })}
            </div>
          ));
        })()}
      </div>
    </Container>
  );
}

function WinScreen({
  moveCount,
  optimalMoves,
  onPlayAgain,
  onNewGame,
}: {
  moveCount: number;
  optimalMoves: number | null;
  onPlayAgain: () => void;
  onNewGame: () => void;
}) {
  return (
    <Container maxWidth="sm" sx={{ textAlign: "center" }}>
      <div className="cooking-celebration">
        <div className="cooking-stars">🎉 ⭐ 🎉</div>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          You solved it!
        </Typography>
        <Typography variant="h6" sx={{ mb: 1, opacity: 0.7 }}>
          in {moveCount} moves
        </Typography>
        {optimalMoves != null && (
          <Typography variant="body1" sx={{ mb: 2, opacity: 0.6 }}>
            {moveCount === optimalMoves
              ? "⭐ Perfect score!"
              : `Best possible: ${optimalMoves} moves`}
          </Typography>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn" onClick={onPlayAgain}>
            Play Again! 🔁
          </button>
          <button className="btn" onClick={onNewGame}>
            New Puzzle! 🧪
          </button>
        </div>
      </div>
    </Container>
  );
}

const STORAGE_KEY = "ballsort-game-state";

export default function BallSort() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [numColors, setNumColors] = useState(4);
  const [extraTubes, setExtraTubes] = useState(2);
  const [initialTubes, setInitialTubes] = useState<Tube[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [optimalMoves, setOptimalMoves] = useState<number | null>(null);
  const [savedGameState, setSavedGameState] = useState<
    { tubes: Tube[]; moveCount: number; history: Tube[][] } | undefined
  >();
  const [isLoading, setIsLoading] = useState(true);

  // Restore state
  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY);
    if (stored) {
      if (stored.numColors != null) setNumColors(stored.numColors);
      if (stored.extraTubes != null) setExtraTubes(stored.extraTubes);
      if (stored.gameState === "ACTIVE" && stored.initialTubes) {
        setInitialTubes(stored.initialTubes);
        setOptimalMoves(stored.optimalMoves ?? null);
        if (stored.currentTubes) {
          setSavedGameState({
            tubes: stored.currentTubes,
            moveCount: stored.currentMoveCount ?? 0,
            history: stored.history ?? [],
          });
        }
        setGameState("ACTIVE");
      }
    }
    setIsLoading(false);
  }, []);

  // Persist settings
  useEffect(() => {
    if (isLoading) return;
    if (gameState === "START") {
      setStoredData(STORAGE_KEY, { numColors, extraTubes, gameState: "START" });
    }
  }, [numColors, extraTubes, gameState, isLoading]);

  const handleStart = useCallback(() => {
    const puzzle = generatePuzzle(numColors, extraTubes);
    const optimal = solvePuzzle(puzzle);
    setInitialTubes(puzzle);
    setOptimalMoves(optimal);
    setMoveCount(0);
    setSavedGameState(undefined);
    setGameState("ACTIVE");
    setStoredData(STORAGE_KEY, {
      numColors,
      extraTubes,
      initialTubes: puzzle,
      optimalMoves: optimal,
      gameState: "ACTIVE",
    });
  }, [numColors, extraTubes]);

  const handleSave = useCallback(
    (state: { tubes: Tube[]; moveCount: number; history: Tube[][] }) => {
      setStoredData(STORAGE_KEY, {
        numColors,
        extraTubes,
        initialTubes,
        optimalMoves,
        currentTubes: state.tubes,
        currentMoveCount: state.moveCount,
        history: state.history,
        gameState: "ACTIVE",
      });
    },
    [numColors, extraTubes, initialTubes, optimalMoves],
  );

  const handleWin = useCallback((moves: number) => {
    setMoveCount(moves);
    setGameState("WON");
    clearStoredData(STORAGE_KEY);
  }, []);

  const handleRestart = useCallback(() => {
    handleStart();
  }, [handleStart]);

  const handleNewGame = useCallback(() => {
    setGameState("START");
    clearStoredData(STORAGE_KEY);
  }, []);

  if (isLoading) return null;

  return (
    <Box sx={{ pb: 4 }}>
      {gameState === "START" && (
        <StartScreen
          numColors={numColors}
          extraTubes={extraTubes}
          onStart={handleStart}
          onChangeColors={setNumColors}
          onChangeExtra={setExtraTubes}
        />
      )}
      {gameState === "ACTIVE" && (
        <GameScreen
          key={initialTubes.map((t) => t.join("")).join("-")}
          initialTubes={initialTubes}
          numColors={numColors}
          optimalMoves={optimalMoves}
          savedState={savedGameState}
          onWin={handleWin}
          onSave={handleSave}
          onRestart={handleRestart}
          onNewGame={handleNewGame}
        />
      )}
      {gameState === "WON" && (
        <WinScreen
          moveCount={moveCount}
          optimalMoves={optimalMoves}
          onPlayAgain={handleRestart}
          onNewGame={handleNewGame}
        />
      )}
    </Box>
  );
}
