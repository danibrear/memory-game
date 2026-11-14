import {
  faArrowsRotate,
  faFlask,
  faMagnifyingGlassPlus,
  faPlay,
  faRepeat,
  faRotateLeft,
  faShuffle,
  faStar,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import { useRemoteConfig } from "~/utils/useRemoteConfig";
import ballsortStyles from "~/styles/ballsort.css?url";
import type { Route } from "./+types/ballsort";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: ballsortStyles },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ball Sort - Games by DaniB" },
    { name: "description", content: "Sort the colored balls into tubes!" },
  ];
}

type GameState = "START" | "ACTIVE" | "WON";
type Tube = number[]; // array of color indices, index 0 = bottom

function generatePuzzle(
  numColors: number,
  extraTubes: number,
  tubeCapacity: number,
): Tube[] {
  const balls: number[] = [];
  for (let c = 0; c < numColors; c++) {
    for (let i = 0; i < tubeCapacity; i++) balls.push(c);
  }
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  const tubes: Tube[] = [];
  for (let t = 0; t < numColors; t++) {
    tubes.push(balls.slice(t * tubeCapacity, (t + 1) * tubeCapacity));
  }
  for (let t = 0; t < extraTubes; t++) tubes.push([]);
  return tubes;
}

function isSolved(tubes: Tube[], tubeCapacity: number): boolean {
  return tubes.every(
    (tube) =>
      tube.length === 0 ||
      (tube.length === tubeCapacity && tube.every((b) => b === tube[0])),
  );
}

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

function getMovableCount(
  source: Tube,
  dest: Tube,
  tubeCapacity: number,
): number {
  const { count } = getTopGroup(source);
  if (count === 0) return 0;
  const destSpace = tubeCapacity - dest.length;
  if (destSpace === 0) return 0;
  return Math.min(count, destSpace);
}

function solvePuzzle(
  initialTubes: Tube[],
  tubeCapacity: number,
): number | null {
  if (isSolved(initialTubes, tubeCapacity)) return 0;

  const MAX_VISITED = 50_000;

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
        if (count === tubeCapacity) continue;

        for (let dst = 0; dst < tubes.length; dst++) {
          if (src === dst) continue;
          const dstTube = tubes[dst];
          if (dstTube.length > 0 && dstTube[dstTube.length - 1] !== color)
            continue;
          const space = tubeCapacity - dstTube.length;
          if (space === 0) continue;
          if (dstTube.length === 0 && count === srcTube.length) continue;

          const movable = Math.min(count, space);
          const nextTubes = tubes.map((t) => [...t]);
          const balls = nextTubes[src].splice(
            nextTubes[src].length - movable,
            movable,
          );
          nextTubes[dst].push(...balls);

          if (isSolved(nextTubes, tubeCapacity)) return moves;

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

type BallColor = { name: string; hsl: string };

function ballStyle(color: BallColor | undefined): React.CSSProperties {
  return { "--ball": color?.hsl ?? "#888" } as React.CSSProperties;
}

const SPARKLES = [
  { sx: "-26px", sy: "-30px" },
  { sx: "24px", sy: "-34px" },
  { sx: "-32px", sy: "-6px" },
  { sx: "30px", sy: "-10px" },
  { sx: "0px", sy: "-42px" },
  { sx: "-14px", sy: "-44px" },
];

function StartScreen({
  numColors,
  extraTubes,
  ballColors,
  minColors,
  maxColors,
  minExtraTubes,
  maxExtraTubes,
  onStart,
  onChangeColors,
  onChangeExtra,
}: {
  numColors: number;
  extraTubes: number;
  ballColors: BallColor[];
  minColors: number;
  maxColors: number;
  minExtraTubes: number;
  maxExtraTubes: number;
  onStart: () => void;
  onChangeColors: (n: number) => void;
  onChangeExtra: (n: number) => void;
}) {
  return (
    <Container maxWidth="sm">
      <Typography
        variant="h3"
        component="h1"
        className="ballsort-title"
        sx={{ textAlign: "center", mt: 2, mb: 3 }}>
        <span className="ballsort-title-icon">
          <FontAwesomeIcon icon={faFlask} />
        </span>
        Ball Sort
      </Typography>

      <div className="ballsort-panel">
        <div className="ballsort-config-row">
          <span className="ballsort-config-label">Colors</span>
          <div className="ballsort-config-controls">
            <button
              className="ballsort-btn ballsort-btn-round"
              disabled={numColors <= minColors}
              aria-label="Fewer colors"
              onClick={() => onChangeColors(numColors - 1)}>
              −
            </button>
            <span className="ballsort-config-value">{numColors}</span>
            <button
              className="ballsort-btn ballsort-btn-round"
              disabled={numColors >= maxColors}
              aria-label="More colors"
              onClick={() => onChangeColors(numColors + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="ballsort-color-preview">
          {ballColors.slice(0, numColors).map((c, i) => (
            <div
              key={c.name}
              className="ballsort-ball ballsort-ball-small"
              style={{
                ...ballStyle(c),
                animationDelay: `${i * 30}ms`,
              }}
              title={c.name}
            />
          ))}
        </div>

        <div className="ballsort-divider" />

        <div className="ballsort-config-row">
          <span className="ballsort-config-label">Empty Tubes</span>
          <div className="ballsort-config-controls">
            <button
              className="ballsort-btn ballsort-btn-round"
              disabled={extraTubes <= minExtraTubes}
              aria-label="Fewer empty tubes"
              onClick={() => onChangeExtra(extraTubes - 1)}>
              −
            </button>
            <span className="ballsort-config-value">{extraTubes}</span>
            <button
              className="ballsort-btn ballsort-btn-round"
              disabled={extraTubes >= maxExtraTubes}
              aria-label="More empty tubes"
              onClick={() => onChangeExtra(extraTubes + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="ballsort-hint">
          {numColors + extraTubes} tubes · fewer empty tubes = harder
        </div>

        <button
          className="ballsort-btn ballsort-btn-primary"
          style={{ marginTop: 22, width: "100%" }}
          onClick={onStart}>
          <FontAwesomeIcon icon={faPlay} /> Play
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
  isComplete,
  isShaking,
  landedCount,
  landedKey,
  tubeCapacity,
  ballColors,
  hiddenTopCount,
  tubeRef,
  onClick,
}: {
  tube: Tube;
  index: number;
  isSelected: boolean;
  highlightCount: number;
  canReceive: boolean;
  isComplete: boolean;
  isShaking: boolean;
  landedCount: number;
  landedKey: number;
  tubeCapacity: number;
  ballColors: BallColor[];
  hiddenTopCount: number;
  tubeRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}) {
  const visibleCount = tube.length - hiddenTopCount;
  const classes = [
    "ballsort-tube",
    isSelected && "ballsort-tube-selected",
    canReceive && "ballsort-tube-receivable",
    isComplete && "ballsort-tube-complete",
    isShaking && "ballsort-tube-shake",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={tubeRef}
      className={classes}
      onClick={onClick}
      aria-label={`Tube ${index + 1}${isComplete ? ", complete" : ""}`}
      aria-pressed={isSelected}>
      {isComplete && (
        <>
          <span className="ballsort-cap" aria-hidden />
          {SPARKLES.map((s, si) => (
            <span
              key={si}
              className="ballsort-sparkle"
              aria-hidden
              style={
                { "--si": si, "--sx": s.sx, "--sy": s.sy } as React.CSSProperties
              }
            />
          ))}
        </>
      )}
      <div className="ballsort-tube-inner">
        {Array.from({ length: tubeCapacity }).map((_, slotIdx) => {
          const ball = slotIdx < visibleCount ? tube[slotIdx] : undefined;
          const isLifted =
            isSelected &&
            ball != null &&
            slotIdx >= visibleCount - highlightCount;
          const isLanded =
            ball != null &&
            landedCount > 0 &&
            slotIdx >= tube.length - landedCount;
          const classes = [
            "ballsort-slot",
            ball != null && "ballsort-ball",
            isLifted && "ballsort-ball-lifted",
            isLanded && "ballsort-ball-landed",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={isLanded ? `${slotIdx}-${landedKey}` : slotIdx}
              className={classes}
              style={ball != null ? ballStyle(ballColors[ball]) : undefined}
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
  tubeCapacity,
  ballColors,
  savedState,
  onWin,
  onSave,
  onRestart,
  onNewGame,
}: {
  initialTubes: Tube[];
  numColors: number;
  optimalMoves: number | null;
  tubeCapacity: number;
  ballColors: BallColor[];
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
  const [sizeIdx, setSizeIdx] = useState(1); // 0=S, 1=M, 2=L, 3=XL, 4=XXL
  const sizeLabels = ["Small", "Medium", "Large", "X-Large", "XXL"];
  const sizeClass = [
    "ballsort-size-s",
    "ballsort-size-m",
    "ballsort-size-l",
    "ballsort-size-xl",
    "ballsort-size-xxl",
  ][sizeIdx];

  // Animation state
  type FlyingBall = {
    color: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    peakY: number;
    size: number;
  };
  const [flyingBalls, setFlyingBalls] = useState<FlyingBall[]>([]);
  const [animSrc, setAnimSrc] = useState<number | null>(null);
  const [animCount, setAnimCount] = useState(0);
  const [landed, setLanded] = useState<{ tube: number; count: number }>({
    tube: -1,
    count: 0,
  });
  const [shakeTube, setShakeTube] = useState<number | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = flyingBalls.length > 0;
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  const FLY_MS = 420;
  const FLY_STAGGER_MS = 45;

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  const triggerShake = useCallback((index: number) => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShakeTube(index);
    shakeTimer.current = setTimeout(() => setShakeTube(null), 360);
  }, []);

  useEffect(() => {
    if (moveCount > 0 && isSolved(tubes, tubeCapacity)) {
      onWin(moveCount);
    }
  }, [tubes, moveCount, tubeCapacity, onWin]);

  const selectedGroup = useMemo(() => {
    if (selectedTube === null) return { color: -1, count: 0 };
    return getTopGroup(tubes[selectedTube]);
  }, [selectedTube, tubes]);

  const handleTubeClick = useCallback(
    (index: number) => {
      if (animating) return;
      if (selectedTube === null) {
        if (tubes[index].length === 0) {
          triggerShake(index);
          return;
        }
        setSelectedTube(index);
      } else if (selectedTube === index) {
        setSelectedTube(null);
      } else {
        const movable = getMovableCount(
          tubes[selectedTube],
          tubes[index],
          tubeCapacity,
        );
        if (movable > 0) {
          // Calculate positions for flying balls
          const srcEl = tubeRefs.current[selectedTube];
          const dstEl = tubeRefs.current[index];
          const gridEl = gridRef.current;
          if (srcEl && dstEl && gridEl) {
            const gridRect = gridEl.getBoundingClientRect();
            const srcSlots = srcEl.querySelectorAll(".ballsort-slot");
            const dstSlots = dstEl.querySelectorAll(".ballsort-slot");
            // slots are rendered in DOM order 0..cap-1, displayed column-reverse
            // Source: top balls are at indices tube.length-1 down to tube.length-movable
            // Dest: landing slots are at dest.length up to dest.length+movable-1
            const destLen = tubes[index].length;
            const srcLen = tubes[selectedTube].length;
            const ballSize = srcSlots[0]?.getBoundingClientRect().width ?? 46;

            const balls: FlyingBall[] = [];
            for (let b = 0; b < movable; b++) {
              const srcSlotIdx = srcLen - 1 - b; // top ball first
              const dstSlotIdx = destLen + b;
              const srcSlot = srcSlots[srcSlotIdx];
              const dstSlot = dstSlots[dstSlotIdx];
              if (srcSlot && dstSlot) {
                const sr = srcSlot.getBoundingClientRect();
                const dr = dstSlot.getBoundingClientRect();
                const startY = sr.top - gridRect.top;
                const endY = dr.top - gridRect.top;
                // Arc over the top of whichever tube is taller on screen
                const srcTop = srcEl.getBoundingClientRect().top - gridRect.top;
                const dstTop = dstEl.getBoundingClientRect().top - gridRect.top;
                const peakY =
                  Math.min(startY, srcTop, dstTop) - ballSize * 0.5;
                balls.push({
                  color: tubes[selectedTube][srcSlotIdx],
                  startX: sr.left - gridRect.left,
                  startY,
                  endX: dr.left - gridRect.left,
                  endY,
                  peakY,
                  size: ballSize,
                });
              }
            }

            if (balls.length > 0) {
              setAnimSrc(selectedTube);
              setAnimCount(movable);
              setFlyingBalls(balls);

              // After animation, commit the move
              setTimeout(() => {
                const newHistory = [...history, tubes.map((t) => [...t])];
                const next = tubes.map((t) => [...t]);
                const moved = next[selectedTube].splice(
                  next[selectedTube].length - movable,
                  movable,
                );
                next[index].push(...moved);
                const newMoveCount = moveCount + 1;
                setHistory(newHistory);
                setTubes(next);
                setMoveCount(newMoveCount);
                setFlyingBalls([]);
                setAnimSrc(null);
                setAnimCount(0);
                setLanded({ tube: index, count: movable });
                onSave({
                  tubes: next,
                  moveCount: newMoveCount,
                  history: newHistory,
                });
              }, FLY_MS + FLY_STAGGER_MS * (balls.length - 1));
              setSelectedTube(null);
              return;
            }
          }

          // Fallback: no DOM refs, instant move
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
          setLanded({ tube: index, count: movable });
        } else {
          triggerShake(index);
        }
        setSelectedTube(null);
      }
    },
    [
      selectedTube,
      tubes,
      history,
      moveCount,
      tubeCapacity,
      onSave,
      animating,
      triggerShake,
    ],
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
    setLanded({ tube: -1, count: 0 });
    onSave({ tubes: prevTubes, moveCount: newMoveCount, history: newHistory });
  }, [history, moveCount, onSave]);

  const completedCount = useMemo(
    () =>
      tubes.filter(
        (t) => t.length === tubeCapacity && t.every((b) => b === t[0]),
      ).length,
    [tubes, tubeCapacity],
  );

  return (
    <Container maxWidth="md" sx={{ textAlign: "center" }}>
      <div className="ballsort-header">
        <Typography
          variant="h4"
          component="h1"
          className="ballsort-title"
          sx={{ mt: 1 }}>
          <span className="ballsort-title-icon">
            <FontAwesomeIcon icon={faFlask} />
          </span>
          Ball Sort
        </Typography>
        <div className="ballsort-hud">
          <span className="ballsort-pill">
            <span className="ballsort-pill-label">Moves</span>
            <span className="ballsort-pill-value">{moveCount}</span>
          </span>
          <span className="ballsort-pill">
            <span className="ballsort-pill-label">Sorted</span>
            <span className="ballsort-pill-value">
              {completedCount}/{numColors}
            </span>
          </span>
          <span className="ballsort-pill">
            <span className="ballsort-pill-label">Best</span>
            <span
              className={`ballsort-pill-value ${optimalMoves == null ? "ballsort-pill-pending" : ""}`}>
              {optimalMoves ?? "—"}
            </span>
          </span>
        </div>
      </div>

      <div className="ballsort-actions">
        <button
          className="ballsort-btn"
          onClick={handleUndo}
          disabled={history.length === 0 || animating}>
          <FontAwesomeIcon icon={faRotateLeft} /> Undo
        </button>
        <button className="ballsort-btn" onClick={onRestart}>
          <FontAwesomeIcon icon={faArrowsRotate} /> Restart
        </button>
        <button className="ballsort-btn" onClick={onNewGame}>
          <FontAwesomeIcon icon={faShuffle} /> New Game
        </button>
        <button
          className="ballsort-btn"
          onClick={() => setSizeIdx((s) => (s + 1) % sizeLabels.length)}>
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} /> {sizeLabels[sizeIdx]}
        </button>
      </div>

      <div
        ref={gridRef}
        className={`ballsort-grid ${sizeClass} ${tubes.length > 7 ? "ballsort-grid-compact" : ""}`}
        style={
          {
            position: "relative",
            "--bs-cols":
              tubes.length <= 7 ? tubes.length : Math.ceil(tubes.length / 2),
          } as React.CSSProperties
        }>
        {flyingBalls.map((fb, i) => (
          <div
            key={i}
            className="ballsort-ball ballsort-flying-ball"
            style={
              {
                ...ballStyle(ballColors[fb.color]),
                width: fb.size,
                height: fb.size,
                left: fb.startX,
                top: fb.startY,
                "--fly-end-x": `${fb.endX - fb.startX}px`,
                "--fly-end-y": `${fb.endY - fb.startY}px`,
                "--fly-peak-y": `${fb.peakY - fb.startY}px`,
                "--fly-ms": `${FLY_MS}ms`,
                "--fly-delay": `${i * FLY_STAGGER_MS}ms`,
              } as React.CSSProperties
            }
          />
        ))}
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
                  getMovableCount(tubes[selectedTube], tube, tubeCapacity) > 0;
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
                    isComplete={
                      tube.length === tubeCapacity &&
                      tube.every((b) => b === tube[0])
                    }
                    isShaking={shakeTube === i}
                    landedCount={landed.tube === i ? landed.count : 0}
                    landedKey={moveCount}
                    tubeCapacity={tubeCapacity}
                    ballColors={ballColors}
                    hiddenTopCount={animSrc === i ? animCount : 0}
                    tubeRef={(el) => {
                      tubeRefs.current[i] = el;
                    }}
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
  const isPerfect = optimalMoves != null && moveCount === optimalMoves;
  const stars = isPerfect
    ? 3
    : optimalMoves != null && moveCount <= Math.ceil(optimalMoves * 1.5)
      ? 2
      : 1;
  const headline = isPerfect ? "Perfect!" : stars === 2 ? "Great job!" : "You did it!";
  return (
    <Container
      maxWidth="sm"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
      }}>
      <div className="ballsort-panel ballsort-win">
        <div className="ballsort-win-confetti" aria-hidden>
          {Array.from({ length: 8 }).map((_, ci) => (
            <span
              key={ci}
              className="ballsort-confetti-piece"
              style={{ "--ci": ci } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="ballsort-win-trophy">
          <FontAwesomeIcon icon={faTrophy} />
        </div>
        <Typography variant="h3" className="ballsort-title" sx={{ mb: 1 }}>
          {headline}
        </Typography>
        <div className="ballsort-win-stars" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((si) => (
            <FontAwesomeIcon
              key={si}
              icon={faStar}
              className={si < stars ? "ballsort-star-lit" : "ballsort-star-dim"}
            />
          ))}
        </div>
        <Typography
          variant="h5"
          className="ballsort-title"
          sx={{ opacity: 0.9, mb: 0.5 }}>
          {moveCount} moves
        </Typography>
        {optimalMoves != null && !isPerfect && (
          <Typography variant="body2" sx={{ opacity: 0.65 }}>
            Can you do it in {optimalMoves}?
          </Typography>
        )}
        <div className="ballsort-win-buttons">
          <button
            className="ballsort-btn ballsort-btn-primary"
            onClick={onPlayAgain}>
            <FontAwesomeIcon icon={faRepeat} /> Play Again
          </button>
          <button className="ballsort-btn" onClick={onNewGame}>
            <FontAwesomeIcon icon={faFlask} /> Change Setup
          </button>
        </div>
      </div>
    </Container>
  );
}

const STORAGE_KEY = "ballsort-game-state";

export default function BallSort() {
  const config = useRemoteConfig();
  const {
    colors: ballColors,
    tubeCapacity,
    minColors,
    maxColors,
    minExtraTubes,
    maxExtraTubes,
  } = config.ballSort;

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
    const puzzle = generatePuzzle(numColors, extraTubes, tubeCapacity);
    setInitialTubes(puzzle);
    setOptimalMoves(null);
    setMoveCount(0);
    setSavedGameState(undefined);
    setGameState("ACTIVE");
    setStoredData(STORAGE_KEY, {
      numColors,
      extraTubes,
      initialTubes: puzzle,
      optimalMoves: null,
      gameState: "ACTIVE",
    });
    // Solve in background so it doesn't block the UI
    setTimeout(() => {
      const optimal = solvePuzzle(puzzle, tubeCapacity);
      setOptimalMoves(optimal);
      setStoredData(STORAGE_KEY, {
        numColors,
        extraTubes,
        initialTubes: puzzle,
        optimalMoves: optimal,
        gameState: "ACTIVE",
      });
    }, 50);
  }, [numColors, extraTubes, tubeCapacity]);

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
    <Box className="ballsort-wrap">
      {gameState === "START" && (
        <StartScreen
          numColors={numColors}
          extraTubes={extraTubes}
          ballColors={ballColors}
          minColors={minColors}
          maxColors={maxColors}
          minExtraTubes={minExtraTubes}
          maxExtraTubes={maxExtraTubes}
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
          tubeCapacity={tubeCapacity}
          ballColors={ballColors}
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
