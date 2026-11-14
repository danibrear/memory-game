import {
  faArrowRight,
  faArrowsRotate,
  faBrain,
  faCheck,
  faCrown,
  faEye,
  faHandPointer,
  faMedal,
  faPlay,
  faStar,
  faTrophy,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Banner,
  CountUp,
  GameShell,
  getGame,
  KitButton,
  Panel,
  StartScreen,
  StatPill,
  Stars,
  Stepper,
  useDealIn,
  WinScreen,
} from "~/components/game/GameKit";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memory Game - Games by DaniB" },
    {
      name: "description",
      content: "Watch the tiles light up, remember them, then find them all!",
    },
  ];
}

const STORAGE_KEY = "memory-game-state";
const BEST_KEY = "memory-game-best";
const MIN_SIZE = 2;
const MAX_SIZE = 15;
const COUNT_STEP_MS = 700;
/** Pause between the last tile and the win screen; the victory wave fills it. */
const WIN_DELAY_MS = 700;
const WAVE_SPREAD_MS = 240;

type Phase = "START" | "COUNTDOWN" | "SHOWING" | "ACTIVE" | "ENDED";

const LEVELS: { max: number; label: string; color: string }[] = [
  { max: 2, label: "Tiny", color: "#0ea5e9" },
  { max: 4, label: "Easy", color: "#16a34a" },
  { max: 6, label: "Medium", color: "#d97706" },
  { max: 8, label: "Hard", color: "#dc2626" },
  { max: 10, label: "Expert", color: "#9333ea" },
  { max: Infinity, label: "Genius", color: "#db2777" },
];
const levelFor = (size: number) => LEVELS.find((l) => size <= l.max)!;

/** How long the tiles stay lit, scaled to the board. */
const showTimeFor = (size: number) =>
  Math.min(4500, Math.max(1600, 1300 + size * 230));

function pickTargets(size: number): number[] {
  const picks = new Set<number>();
  while (picks.size < size) picks.add(Math.floor(Math.random() * size * size));
  return [...picks];
}

function starsFor(size: number, mistakes: number): number {
  if (mistakes === 0) return 3;
  if (mistakes <= Math.max(1, Math.floor(size / 3))) return 2;
  return 1;
}

export default function Memory() {
  const game = getGame("memory");

  const [phase, setPhase] = useState<Phase>("START");
  const [size, setSize] = useState(3);
  const [targets, setTargets] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [count, setCount] = useState(3);
  const [best, setBest] = useState(0);
  const [loaded, setLoaded] = useState(false);
  /** Bumped for every fresh board so the tiles deal in. */
  const [dealId, setDealId] = useState(0);
  /** True between the last tile and the win screen: found tiles do a wave. */
  const [winning, setWinning] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  useDealIn(gridRef, dealId, { cols: size, maxTotal: 420 });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** Countdown → light up the tiles → hand over to the player. */
  const playReveal = (boardSize: number) => {
    clearTimers();
    setCount(3);
    setPhase("COUNTDOWN");
    later(() => setCount(2), COUNT_STEP_MS);
    later(() => setCount(1), COUNT_STEP_MS * 2);
    later(() => setPhase("SHOWING"), COUNT_STEP_MS * 3);
    later(() => setPhase("ACTIVE"), COUNT_STEP_MS * 3 + showTimeFor(boardSize));
  };

  const startRound = (boardSize = size) => {
    setSize(boardSize);
    setTargets(pickTargets(boardSize));
    setFound([]);
    setWrong([]);
    setWinning(false);
    setDealId((d) => d + 1);
    playReveal(boardSize);
  };

  // Restore (understands the older save format too)
  useEffect(() => {
    const savedBest = getStoredData(BEST_KEY);
    if (typeof savedBest === "number") setBest(savedBest);

    const s = getStoredData(STORAGE_KEY);
    const savedTargets: number[] | undefined = s?.selectedCells;
    if (s && Array.isArray(savedTargets) && savedTargets.length > 0) {
      const d = Number(s.difficulty) || 3;
      setSize(d);
      setTargets(savedTargets);
      setFound(s.correctCells ?? []);
      setWrong(s.incorrectCells ?? []);
      if (s.gameState === "ACTIVE") setPhase("ACTIVE");
      else if (["INTRO", "COUNTDOWN", "SHOWING"].includes(s.gameState)) {
        // Interrupted while memorising — show the tiles again
        setFound([]);
        setWrong([]);
        playReveal(d);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (phase === "START" || phase === "ENDED") {
      clearStoredData(STORAGE_KEY);
      return;
    }
    setStoredData(STORAGE_KEY, {
      gameState: phase,
      difficulty: size,
      selectedCells: targets,
      correctCells: found,
      incorrectCells: wrong,
    });
  }, [loaded, phase, size, targets, found, wrong]);

  const handleTap = (index: number) => {
    if (phase !== "ACTIVE") return;
    if (found.includes(index) || wrong.includes(index)) return;

    if (targets.includes(index)) {
      const nextFound = [...found, index];
      setFound(nextFound);
      if (nextFound.length === targets.length) {
        if (size > best) {
          setBest(size);
          setStoredData(BEST_KEY, size);
        }
        setWinning(true);
        later(() => setPhase("ENDED"), WIN_DELAY_MS);
      }
    } else {
      setWrong((w) => [...w, index]);
    }
  };

  const level = levelFor(size);

  // ── Start ──
  if (phase === "START") {
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle="Watch the tiles light up, remember where they were, then tap them all!">
          <Panel label="Board size">
            <Stepper
              label="board size"
              value={size}
              min={MIN_SIZE}
              max={MAX_SIZE}
              onChange={setSize}>
              {size}×{size}
              <span
                className="dg-label"
                style={{ color: level.color, letterSpacing: "0.1em" }}>
                {level.label}
              </span>
            </Stepper>
            <input
              type="range"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={size}
              aria-label="Board size"
              onChange={(e) => setSize(parseInt(e.target.value, 10))}
              style={{ accentColor: game.colors.to }}
            />
            <span className="dg-caption">
              Remember <strong>{size}</strong> glowing tiles
            </span>
          </Panel>
          {best > 0 && (
            <StatPill icon={faCrown} color="#f59e0b">
              Best: {best}×{best}
            </StatPill>
          )}
          <KitButton size="lg" icon={faPlay} onClick={() => startRound()}>
            Play!
          </KitButton>
        </StartScreen>
      </GameShell>
    );
  }

  // ── Ended ──
  if (phase === "ENDED") {
    const mistakes = wrong.length;
    const stars = starsFor(size, mistakes);
    const accuracy = Math.round((found.length / (found.length + mistakes)) * 100);
    const title = stars === 3 ? "Perfect!" : stars === 2 ? "Great job!" : "You did it!";
    return (
      <GameShell game={game}>
        <WinScreen
          icon={stars === 3 ? faTrophy : stars === 2 ? faMedal : faBrain}
          iconColor={stars === 1 ? game.colors.to : undefined}
          title={title}
          subtitle={
            <>
              Found all <strong>{size}</strong> tiles on the {size}×{size} board.
            </>
          }>
          <Stars count={stars} />
          <div className="dg-row">
            <StatPill
              icon={faXmark}
              color="#dc2626"
              dim={mistakes === 0}
              label="Mistakes">
              <CountUp value={mistakes} /> {mistakes === 1 ? "miss" : "misses"}
            </StatPill>
            <StatPill icon={faCheck} color="#16a34a" label="Accuracy">
              <CountUp value={accuracy} />%
            </StatPill>
          </div>
          <div className="dg-row" style={{ marginTop: 8 }}>
            <KitButton
              variant="neutral"
              icon={faArrowsRotate}
              onClick={() => startRound()}>
              Play Again
            </KitButton>
            {size < MAX_SIZE && (
              <KitButton iconEnd={faArrowRight} onClick={() => startRound(size + 1)}>
                Next Level
              </KitButton>
            )}
          </div>
        </WinScreen>
      </GameShell>
    );
  }

  // ── Playing ──
  const gap = size <= 5 ? 9 : size <= 8 ? 6 : size <= 11 ? 4 : 3;
  const iconSize = `calc(min(92vw, 60vh, 600px) / ${size} * 0.4)`;
  const showMs = showTimeFor(size);
  const waveStep = WAVE_SPREAD_MS / Math.max(1, 2 * (size - 1));

  return (
    <GameShell game={game}>
      <div className="dg-hud" style={{ maxWidth: 600 }}>
        <StatPill icon={faStar} color="#f59e0b" label="Tiles found">
          {found.length} / {size}
        </StatPill>
        {phase === "COUNTDOWN" && (
          <Banner tone="soft" key="ready">
            Get ready…
          </Banner>
        )}
        {phase === "SHOWING" && (
          <Banner tone="gold" icon={faEye} key="show">
            Remember!
          </Banner>
        )}
        {phase === "ACTIVE" && (
          <Banner icon={faHandPointer} key="go">
            Your turn!
          </Banner>
        )}
        <StatPill
          icon={faXmark}
          color="#dc2626"
          dim={wrong.length === 0}
          label="Mistakes">
          {wrong.length}
        </StatPill>
      </div>

      <div className={`mm-timer ${phase === "SHOWING" ? "is-on" : ""}`}>
        {phase === "SHOWING" && (
          <i style={{ "--ms": `${showMs}ms` } as CSSProperties} />
        )}
      </div>

      <div className="dg-tray">
        {phase === "COUNTDOWN" && (
          <div className="mm-countdown" aria-live="assertive">
            <span key={count}>{count}</span>
          </div>
        )}
        <div
          ref={gridRef}
          className={winning ? "mm-grid is-winning" : "mm-grid"}
          style={
            {
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              gap: `${gap}px`,
              "--mm-icon": iconSize,
            } as CSSProperties
          }>
          {Array.from({ length: size * size }, (_, index) => {
            const isFound = found.includes(index);
            const isWrong = wrong.includes(index);
            const isLit = phase === "SHOWING" && targets.includes(index);
            const clickable = phase === "ACTIVE" && !isFound && !isWrong;
            return (
              <button
                key={index}
                type="button"
                className={[
                  "mm-tile",
                  (isFound || isWrong) && "is-flipped",
                  isFound && "is-good",
                  isWrong && "is-bad",
                  isLit && "is-lit",
                  clickable && "is-clickable",
                ]
                  .filter(Boolean)
                  .join(" ")}
                tabIndex={clickable ? 0 : -1}
                style={
                  isFound
                    ? ({
                        // Victory wave runs corner to corner
                        "--wave": `${Math.round((Math.floor(index / size) + (index % size)) * waveStep)}ms`,
                      } as CSSProperties)
                    : undefined
                }
                aria-label={
                  isFound ? "Found" : isWrong ? "Miss" : isLit ? "Lit tile" : "Tile"
                }
                onClick={() => handleTap(index)}>
                <span className="mm-tile-inner">
                  <span className="mm-face mm-down">
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                  <span
                    className={`mm-face mm-up ${isWrong ? "mm-up--bad" : "mm-up--good"}`}>
                    <FontAwesomeIcon icon={isWrong ? faXmark : faCheck} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dg-row" style={{ marginTop: 22 }}>
        <KitButton
          variant="neutral"
          size="sm"
          icon={faArrowsRotate}
          onClick={() => {
            clearTimers();
            setWinning(false);
            setPhase("START");
          }}>
          Quit
        </KitButton>
      </div>
    </GameShell>
  );
}
