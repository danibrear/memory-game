import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAppleWhole,
  faArrowsRotate,
  faBolt,
  faCarrot,
  faCat,
  faCrown,
  faDog,
  faDove,
  faDragon,
  faFeather,
  faFish,
  faFrog,
  faGem,
  faGhost,
  faGrip,
  faHandshake,
  faHeart,
  faHippo,
  faIceCream,
  faLeaf,
  faMoon,
  faMusic,
  faPlay,
  faRocket,
  faSnowflake,
  faStar,
  faSun,
  faTrophy,
  faUser,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import shuffle from "lodash/shuffle";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Banner,
  ChoiceGroup,
  GameShell,
  getGame,
  KitButton,
  Panel,
  StartScreen,
  StatPill,
  Stars,
  Stepper,
  WinScreen,
  type BannerTone,
} from "~/components/game/GameKit";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/match";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Match Game - Games by DaniB" },
    {
      name: "description",
      content:
        "Flip cards to find matching pairs. Play solo or take turns with a friend!",
    },
  ];
}

/** 24 pictures — enough for the largest (7×7) board. */
const CARDS: { icon: IconDefinition; color: string }[] = [
  { icon: faStar, color: "#f59e0b" },
  { icon: faHeart, color: "#e11d48" },
  { icon: faRocket, color: "#2563eb" },
  { icon: faCat, color: "#ea580c" },
  { icon: faFrog, color: "#16a34a" },
  { icon: faMoon, color: "#7c3aed" },
  { icon: faSun, color: "#eab308" },
  { icon: faFish, color: "#0891b2" },
  { icon: faDragon, color: "#dc2626" },
  { icon: faGhost, color: "#64748b" },
  { icon: faIceCream, color: "#db2777" },
  { icon: faCrown, color: "#ca8a04" },
  { icon: faDog, color: "#a16207" },
  { icon: faSnowflake, color: "#0ea5e9" },
  { icon: faLeaf, color: "#65a30d" },
  { icon: faGem, color: "#9333ea" },
  { icon: faMusic, color: "#4f46e5" },
  { icon: faBolt, color: "#f97316" },
  { icon: faDove, color: "#0284c7" },
  { icon: faAppleWhole, color: "#b91c1c" },
  { icon: faHippo, color: "#6d28d9" },
  { icon: faCarrot, color: "#ea580c" },
  { icon: faFeather, color: "#0d9488" },
  { icon: faHandshake, color: "#c2410c" },
];

const PLAYER_ICONS = { 1: faCat, 2: faDog } as const;

const STORAGE_KEY = "match-game-state";
const EMPTY_CELL_VALUE = -1;
const MIN_SIZE = 2;
const MAX_SIZE = 7;

type Phase = "START" | "ACTIVE" | "FINISHED";
type PlayerId = 1 | 2;
/** 0 = matched before player tracking existed (older saves) */
type Owner = 0 | PlayerId;

function buildBoard(size: number): number[] {
  const pairs = Math.floor((size * size) / 2);
  const pieces = shuffle(Array.from({ length: pairs }, (_, i) => i + 1));
  const deck = shuffle([...pieces, ...pieces]);
  if (size % 2 === 1) {
    // keep the spare square in the very middle
    const mid = Math.floor((size * size) / 2);
    deck.splice(mid, 0, EMPTY_CELL_VALUE);
  }
  return deck;
}

function soloStars(pairs: number, tries: number): number {
  if (tries <= Math.ceil(pairs * 1.5)) return 3;
  if (tries <= Math.ceil(pairs * 2.3)) return 2;
  return 1;
}

export default function Match() {
  const game = getGame("match");

  const [phase, setPhase] = useState<Phase>("START");
  const [size, setSize] = useState(4);
  const [players, setPlayers] = useState<1 | 2>(2);
  const [cellValues, setCellValues] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matchedBy, setMatchedBy] = useState<Record<number, Owner>>({});
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [turn, setTurn] = useState<PlayerId>(1);
  const [tries, setTries] = useState(0);
  const [shaking, setShaking] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ id: number; text: string; tone: BannerTone } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const showFlash = (text: string, tone: BannerTone) => {
    const id = Date.now();
    setFlash({ id, text, tone });
    later(() => setFlash((f) => (f?.id === id ? null : f)), 1300);
  };

  // Restore an in-progress game (also understands the older save format)
  useEffect(() => {
    const s = getStoredData(STORAGE_KEY);
    if (s && s.gameState === "ACTIVE" && Array.isArray(s.cellValues)) {
      setSize(s.cells);
      setCellValues(s.cellValues);
      setPlayers(s.players === 1 ? 1 : 2);
      setScores({ 1: s.player1Score ?? 0, 2: s.player2Score ?? 0 });
      setTurn(s.turn === 2 ? 2 : 1);
      setTries(s.tries ?? 0);
      const owners: Record<number, Owner> = {};
      if (s.matchedBy && typeof s.matchedBy === "object") {
        Object.assign(owners, s.matchedBy);
      } else if (Array.isArray(s.revealedCells)) {
        s.revealedCells.forEach((i: number) => (owners[i] = 0));
      }
      setMatchedBy(owners);
      // A half-finished turn can't be resumed mid-animation — keep only a single pick
      setSelected(Array.isArray(s.selectedCells) && s.selectedCells.length === 1 ? s.selectedCells : []);
      setPhase("ACTIVE");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setStoredData(STORAGE_KEY, {
      gameState: phase,
      cells: size,
      cellValues,
      players,
      player1Score: scores[1],
      player2Score: scores[2],
      turn,
      tries,
      matchedBy,
      revealedCells: Object.keys(matchedBy).map(Number),
      selectedCells: selected.length === 1 ? selected : [],
    });
  }, [loaded, phase, size, cellValues, players, scores, turn, tries, matchedBy, selected]);

  const totalPairs = Math.floor((size * size) / 2);
  const matchedPairs = Object.keys(matchedBy).length / 2;
  const busy = selected.length >= 2;

  const startGame = (newSize = size) => {
    clearTimers();
    setSize(newSize);
    setCellValues(buildBoard(newSize));
    setSelected([]);
    setMatchedBy({});
    setScores({ 1: 0, 2: 0 });
    setTurn(1);
    setTries(0);
    setShaking([]);
    setFlash(null);
    setPhase("ACTIVE");
  };

  const handleFlip = (index: number) => {
    if (phase !== "ACTIVE" || busy) return;
    if (selected.includes(index) || index in matchedBy) return;
    if (cellValues[index] === EMPTY_CELL_VALUE) return;

    const next = [...selected, index];
    setSelected(next);
    if (next.length < 2) return;

    const [a, b] = next;
    const who = turn;
    setTries((t) => t + 1);

    if (cellValues[a] === cellValues[b]) {
      later(() => {
        setMatchedBy((m) => ({ ...m, [a]: who, [b]: who }));
        setScores((s) => ({ ...s, [who]: s[who] + 1 }));
        setSelected([]);
        const done = matchedPairs + 1 >= totalPairs;
        if (done) {
          later(() => setPhase("FINISHED"), 900);
        } else {
          showFlash(players === 2 ? "Match! Go again!" : "Match!", "good");
        }
      }, 450);
    } else {
      later(() => setShaking([a, b]), 650);
      later(() => {
        setShaking([]);
        setSelected([]);
        if (players === 2) {
          const other: PlayerId = who === 1 ? 2 : 1;
          setTurn(other);
          showFlash(`Player ${other}'s turn`, other === 1 ? "p1" : "p2");
        }
      }, 1250);
    }
  };

  // ── Start ──
  if (phase === "START") {
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle="Flip two cards at a time and find all the matching pairs!">
          <Panel label="Players">
            <ChoiceGroup
              label="Number of players"
              value={players}
              onChange={setPlayers}
              options={[
                { value: 1, label: "Solo", icon: faUser },
                { value: 2, label: "2 Players", icon: faUserGroup },
              ]}
            />
            <span className="dg-label" style={{ marginTop: 6 }}>
              Board size
            </span>
            <Stepper
              label="board size"
              value={size}
              min={MIN_SIZE}
              max={MAX_SIZE}
              onChange={setSize}>
              {size}×{size}
            </Stepper>
            <span className="dg-caption">
              {totalPairs} {totalPairs === 1 ? "pair" : "pairs"} to find
            </span>
          </Panel>
          <KitButton size="lg" icon={faPlay} onClick={() => startGame()}>
            Play!
          </KitButton>
        </StartScreen>
      </GameShell>
    );
  }

  // ── Finished ──
  if (phase === "FINISHED") {
    const tie = scores[1] === scores[2];
    const winner: PlayerId = scores[1] > scores[2] ? 1 : 2;
    return (
      <GameShell game={game}>
        {players === 2 ? (
          <WinScreen
            icon={tie ? faHandshake : faTrophy}
            title={tie ? "It's a tie!" : `Player ${winner} wins!`}
            subtitle={tie ? "Great teamwork — nobody beat anybody!" : "What a memory!"}>
            <div className="mg-final">
              {([1, 2] as const).map((p) => (
                <div
                  key={p}
                  className={`mg-player mg-player--p${p} ${!tie && winner === p ? "is-winner" : ""}`}>
                  <span className="mg-avatar">
                    <FontAwesomeIcon icon={!tie && winner === p ? faCrown : PLAYER_ICONS[p]} />
                  </span>
                  <span className="mg-player-name">Player {p}</span>
                  <span className="mg-player-score">{scores[p]}</span>
                </div>
              ))}
            </div>
            <Actions onAgain={() => startGame()} onMenu={() => setPhase("START")} />
          </WinScreen>
        ) : (
          <WinScreen
            icon={faTrophy}
            title="You did it!"
            subtitle={
              <>
                Found all <strong>{totalPairs}</strong> pairs in{" "}
                <strong>{tries}</strong> tries.
              </>
            }>
            <Stars count={soloStars(totalPairs, tries)} />
            <Actions onAgain={() => startGame()} onMenu={() => setPhase("START")} />
          </WinScreen>
        )}
      </GameShell>
    );
  }

  // ── Playing ──
  const iconSize = `calc(min(92vw, 58vh, 600px) / ${size} * 0.42)`;
  const gap = size <= 4 ? 10 : size <= 5 ? 8 : 6;

  return (
    <GameShell game={game}>
      {players === 2 ? (
        <div className="mg-score">
          {([1, 2] as const).map((p) => (
            <div
              key={p}
              className={`mg-player mg-player--p${p} ${turn === p ? "is-turn" : ""}`}
              style={{ gridColumn: p === 1 ? 1 : 3, gridRow: 1 }}>
              <span className="mg-avatar">
                <FontAwesomeIcon icon={PLAYER_ICONS[p]} />
              </span>
              <span>
                <div className="mg-player-name">Player {p}</div>
                <div className="mg-player-score">{scores[p]}</div>
              </span>
            </div>
          ))}
          <div className="mg-mid" style={{ gridColumn: 2, gridRow: 1 }}>
            {totalPairs - matchedPairs}
            <small>left</small>
          </div>
        </div>
      ) : (
        <div className="dg-hud" style={{ maxWidth: 600 }}>
          <StatPill icon={faStar} color="#f59e0b" label="Pairs found">
            {matchedPairs} / {totalPairs}
          </StatPill>
          <StatPill icon={faArrowsRotate} label="Tries">
            {tries} tries
          </StatPill>
        </div>
      )}

      <div className="mg-status">
        {flash ? (
          <Banner key={flash.id} tone={flash.tone}>
            {flash.text}
          </Banner>
        ) : players === 2 ? (
          <Banner key={`turn-${turn}`} tone={turn === 1 ? "p1" : "p2"} icon={PLAYER_ICONS[turn]}>
            Player {turn}, pick two cards
          </Banner>
        ) : (
          <Banner tone="soft">Find the pairs!</Banner>
        )}
      </div>

      <div className="dg-tray">
        <div
          className="mg-board"
          style={
            {
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              gap: `${gap}px`,
              "--mg-icon": iconSize,
            } as CSSProperties
          }>
          {cellValues.map((value, index) => {
            if (value === EMPTY_CELL_VALUE) {
              return <div key={index} className="mg-card mg-card--empty" aria-hidden />;
            }
            const card = CARDS[(value - 1) % CARDS.length];
            const owner = matchedBy[index];
            const isMatched = owner !== undefined;
            const isUp = isMatched || selected.includes(index);
            const ownerColor =
              owner === 1 ? "var(--dg-p1)" : owner === 2 ? "var(--dg-p2)" : undefined;
            return (
              <button
                key={index}
                type="button"
                className={[
                  "mg-card",
                  isUp && "is-up",
                  isMatched && "is-matched",
                  shaking.includes(index) && "is-shake",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={isUp || busy}
                onClick={() => handleFlip(index)}
                aria-label={isUp ? "Card face up" : "Face-down card"}
                style={
                  {
                    "--card-c": card.color,
                    ...(ownerColor ? { "--owner": ownerColor } : {}),
                  } as CSSProperties
                }>
                <span className="mg-card-inner">
                  <span className="mg-face mg-back">
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                  <span className="mg-face mg-front">
                    <FontAwesomeIcon icon={card.icon} />
                    {isMatched && players === 2 && ownerColor && <span className="mg-owner" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dg-row" style={{ marginTop: 22 }}>
        <KitButton variant="neutral" size="sm" icon={faArrowsRotate} onClick={() => startGame()}>
          Restart
        </KitButton>
        <KitButton variant="neutral" size="sm" icon={faGrip} onClick={() => { clearTimers(); setPhase("START"); }}>
          Change Setup
        </KitButton>
      </div>
    </GameShell>
  );
}

function Actions({ onAgain, onMenu }: { onAgain: () => void; onMenu: () => void }) {
  return (
    <div className="dg-row" style={{ marginTop: 8 }}>
      <KitButton variant="neutral" icon={faGrip} onClick={onMenu}>
        Change Setup
      </KitButton>
      <KitButton icon={faArrowsRotate} onClick={onAgain}>
        Play Again
      </KitButton>
    </div>
  );
}
