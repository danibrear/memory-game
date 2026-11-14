import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowLeft,
  faArrowsRotate,
  faBolt,
  faBrain,
  faBullseye,
  faCat,
  faCrown,
  faDice,
  faDog,
  faDove,
  faDragon,
  faFeather,
  faFire,
  faFish,
  faFrog,
  faGamepad,
  faGem,
  faHeart,
  faHeartCrack,
  faLeaf,
  faMedal,
  faMoon,
  faMusic,
  faPlay,
  faPuzzlePiece,
  faRocket,
  faSnowflake,
  faStar,
  faSun,
  faTrophy,
  faVolumeHigh,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Banner,
  ChoiceGroup,
  CountUp,
  GameShell,
  getGame,
  KitButton,
  Panel,
  StartScreen,
  StatPill,
  Stars,
  WinScreen,
} from "~/components/game/GameKit";
import { getStoredData, setStoredData } from "~/storage";
import bubblepopStyles from "~/styles/bubblepop.css?url";
import type { Route } from "./+types/bubblepop";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: bubblepopStyles },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bubble Pop - Games by DaniB" },
    { name: "description", content: "Pop the bubbles before they fly away!" },
  ];
}

const game = getGame("bubblepop");

const BEST_KEY = "bubblepop-best";
const MUTE_KEY = "bubblepop-muted";

const BUBBLE_ICONS: IconDefinition[] = [
  faStar, faHeart, faBolt, faCrown, faFire, faMusic, faGem, faRocket,
  faDragon, faBrain, faSnowflake, faSun, faMoon, faLeaf, faDice, faFrog,
  faCat, faDog, faDove, faFish, faFeather, faGamepad, faBullseye, faPuzzlePiece,
];

/** Bubble tint by taps remaining (1 = one more tap, higher = tougher). */
const TAP_COLORS: Record<number, string> = {
  1: "#22c55e", // green
  2: "#3b82f6", // blue
  3: "#ef4444", // red
  4: "#a855f7", // purple
  5: "#f97316", // orange
};
const tapColor = (taps: number) => TAP_COLORS[Math.min(Math.max(taps, 1), 5)];

const MAX_MISSES = 5;
const HITBOX_BONUS = 22; // extra px around each bubble in easy mode
const COMBO_WINDOW_MS = 1000;
const MAX_COMBO = 5;

type Phase = "start" | "playing" | "gameover";

type Bubble = {
  id: number;
  x: number;
  icon: IconDefinition;
  size: number;
  duration: number;
  sway: number;
  swayDuration: number;
  tapsRequired: number;
  tapsRemaining: number;
};

type Drop = { dx: number; dy: number; size: number; dur: number; color: string };

type PopEffect = {
  id: number;
  x: number;
  y: number;
  size: number;
  tint: string;
  icon: IconDefinition;
  points: number;
  drops: Drop[];
};

let uid = 0;

function spawnBubble(popped: number, easy: boolean): Bubble {
  const maxTaps = popped < 6 ? 1 : popped < 15 ? 2 : popped < 25 ? 3 : popped < 40 ? 4 : 5;
  const tapsRequired = 1 + Math.floor(Math.random() * maxTaps);
  const baseDuration = 4.5 + Math.random() * 3.5;
  return {
    id: uid++,
    x: 4 + Math.random() * 80,
    icon: BUBBLE_ICONS[Math.floor(Math.random() * BUBBLE_ICONS.length)],
    size: 68 + Math.floor(Math.random() * 34),
    duration: easy ? baseDuration * 1.8 : baseDuration,
    sway: 8 + Math.random() * 14,
    swayDuration: 1.8 + Math.random() * 1.6,
    tapsRequired,
    tapsRemaining: tapsRequired,
  };
}

function makeDrops(size: number, tint: string): Drop[] {
  const count = 14;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = size * (0.6 + Math.random() * 0.7);
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 8 + Math.random() * (size * 0.12),
      dur: 0.45 + Math.random() * 0.25,
      color: i % 3 === 0 ? "#ffffff" : tint,
    };
  });
}

/* ---------- Sound (tiny Web Audio synth, no files needed) ---------- */

let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(
  type: OscillatorType,
  from: number,
  to: number,
  duration: number,
  volume: number,
) {
  const a = getAudio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration * 0.8);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playPop(combo: number) {
  const a = getAudio();
  if (!a) return;
  // Bright "bloop" that climbs in pitch as the combo grows
  const base = 480 + Math.min(combo, 8) * 80 + Math.random() * 40;
  tone("sine", base * 1.7, base * 0.55, 0.12, 0.32);
  // Short airy click for the "pop" texture
  const len = Math.floor(a.sampleRate * 0.03);
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = a.createBufferSource();
  noise.buffer = buffer;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const ng = a.createGain();
  ng.gain.value = 0.22;
  noise.connect(hp).connect(ng).connect(a.destination);
  noise.start(a.currentTime);
}

const playBoing = () => tone("triangle", 340, 190, 0.16, 0.22);
const playMiss = () => tone("sine", 330, 140, 0.3, 0.16);

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}

/* ---------- Small pieces ---------- */

const DIFFICULTY_OPTIONS = [
  { value: "normal" as const, label: "Normal", icon: faBolt },
  { value: "easy" as const, label: "Easy", icon: faFeather },
];

function MiniBubble({ taps }: { taps: number }) {
  return (
    <span
      className="bp-bubble bp-bubble--mini"
      style={{ "--tint": tapColor(taps), "--size": "44px" } as CSSProperties}>
      <span className="bp-pips">
        {Array.from({ length: taps }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    </span>
  );
}

function Hearts({ misses }: { misses: number }) {
  return (
    <span className="dg-pill bp-hearts" aria-label={`${MAX_MISSES - misses} lives left`}>
      {Array.from({ length: MAX_MISSES }, (_, i) => {
        const lost = i >= MAX_MISSES - misses;
        return (
          <FontAwesomeIcon
            key={`${i}-${lost ? "l" : "h"}`}
            icon={lost ? faHeartCrack : faHeart}
            className={lost ? "bp-heart is-lost" : "bp-heart"}
          />
        );
      })}
    </span>
  );
}

/** Decorative background bubbles drifting up behind the real ones. */
function Ambient() {
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        "--s": `${10 + ((i * 7) % 22)}px`,
        "--d": `${9 + ((i * 5) % 8)}s`,
        "--delay": `${-((i * 1.7) % 12)}s`,
      })) as CSSProperties[],
    [],
  );
  return (
    <div className="bp-ambient" aria-hidden>
      {bits.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

/* ---------- Game ---------- */

export default function BubblePop() {
  const [phase, setPhase] = useState<Phase>("start");
  const [easyMode, setEasyMode] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pops, setPops] = useState<PopEffect[]>([]);
  const [score, setScore] = useState(0);
  const [popped, setPopped] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hurtKey, setHurtKey] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [muted, setMuted] = useState(false);

  const fieldRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("start");
  const scoreRef = useRef(0);
  const poppedRef = useRef(0);
  const missesRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const lastPopRef = useRef(0);
  const easyModeRef = useRef(false);
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  /** Source of truth for taps left, so fast double-taps never double-count. */
  const tapsLeftRef = useRef(new Map<number, number>());
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const storedBest = Number(getStoredData(BEST_KEY)) || 0;
    bestRef.current = storedBest;
    setBest(storedBest);
    const storedMute = getStoredData(MUTE_KEY) === true;
    mutedRef.current = storedMute;
    setMuted(storedMute);
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    setStoredData(MUTE_KEY, mutedRef.current);
  }, []);

  const sfx = useCallback((fn: () => void) => {
    if (!mutedRef.current) fn();
  }, []);

  const clearTimers = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    spawnTimerRef.current = null;
    comboTimerRef.current = null;
  }, []);

  const scheduleNext = useCallback(() => {
    const easy = easyModeRef.current;
    const base = easy ? 1800 : 1400;
    const floor = easy ? 750 : 500;
    const interval = Math.max(floor, base - poppedRef.current * 25);
    spawnTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      const bubble = spawnBubble(poppedRef.current, easyModeRef.current);
      tapsLeftRef.current.set(bubble.id, bubble.tapsRequired);
      setBubbles((prev) => [...prev, bubble]);
      scheduleNext();
    }, interval);
  }, []);

  const endGame = useCallback(() => {
    clearTimers();
    phaseRef.current = "gameover";
    tapsLeftRef.current.clear();
    const isBest = scoreRef.current > bestRef.current;
    if (isBest) {
      bestRef.current = scoreRef.current;
      setBest(scoreRef.current);
      setStoredData(BEST_KEY, scoreRef.current);
    }
    setNewBest(isBest);
    setBubbles([]);
    setPops([]);
    setPhase("gameover");
  }, [clearTimers]);

  const startGame = useCallback(() => {
    clearTimers();
    getAudio(); // unlock audio on this tap (required on iOS)
    uid = 0;
    easyModeRef.current = easyMode;
    phaseRef.current = "playing";
    scoreRef.current = 0;
    poppedRef.current = 0;
    missesRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    lastPopRef.current = 0;
    tapsLeftRef.current.clear();
    setScore(0);
    setPopped(0);
    setMisses(0);
    setCombo(0);
    setBestCombo(0);
    setHurtKey(0);
    setNewBest(false);
    setBubbles([]);
    setPops([]);
    setPhase("playing");
    scheduleNext();
  }, [clearTimers, scheduleNext, easyMode]);

  useEffect(() => clearTimers, [clearTimers]);

  const handlePointerDown = useCallback(
    (bubble: Bubble, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (phaseRef.current !== "playing") return;
      const left = tapsLeftRef.current.get(bubble.id);
      if (left === undefined) return;

      // Tough bubble: squish it and knock off one tap
      if (left > 1) {
        tapsLeftRef.current.set(bubble.id, left - 1);
        setBubbles((prev) =>
          prev.map((b) => (b.id === bubble.id ? { ...b, tapsRemaining: left - 1 } : b)),
        );
        sfx(playBoing);
        buzz(6);
        return;
      }

      // Pop! Work out where the bubble is right now inside the field
      tapsLeftRef.current.delete(bubble.id);
      const field = fieldRef.current;
      const visual = e.currentTarget.querySelector<HTMLElement>(".bp-bubble");
      const r = (visual ?? e.currentTarget).getBoundingClientRect();
      const f = field?.getBoundingClientRect();
      const x = r.left + r.width / 2 - (f?.left ?? 0);
      const y = r.top + r.height / 2 - (f?.top ?? 0);

      const now = performance.now();
      comboRef.current =
        now - lastPopRef.current < COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
      lastPopRef.current = now;
      const points = Math.min(comboRef.current, MAX_COMBO);
      bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
      setCombo(comboRef.current);
      setBestCombo(bestComboRef.current);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        comboRef.current = 0;
        setCombo(0);
      }, COMBO_WINDOW_MS);

      const tint = tapColor(bubble.tapsRequired);
      const popId = uid++;
      setBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
      setPops((prev) => [
        ...prev,
        {
          id: popId,
          x,
          y,
          size: bubble.size,
          tint,
          icon: bubble.icon,
          points,
          drops: makeDrops(bubble.size, tint),
        },
      ]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== popId)), 850);

      sfx(() => playPop(comboRef.current));
      buzz(12);

      scoreRef.current += points;
      poppedRef.current += 1;
      setScore(scoreRef.current);
      setPopped(poppedRef.current);
    },
    [sfx],
  );

  const handleEscape = useCallback(
    (id: number, e: React.AnimationEvent<HTMLDivElement>) => {
      // Ignore animations ending on children (e.g. the squish on a tough bubble)
      if (e.target !== e.currentTarget) return;
      if (phaseRef.current !== "playing") return;
      if (!tapsLeftRef.current.has(id)) return;
      tapsLeftRef.current.delete(id);
      setBubbles((prev) => prev.filter((b) => b.id !== id));
      missesRef.current = Math.min(missesRef.current + 1, MAX_MISSES);
      setMisses(missesRef.current);
      setHurtKey((k) => k + 1);
      comboRef.current = 0;
      setCombo(0);
      sfx(playMiss);
      buzz(30);
      if (missesRef.current >= MAX_MISSES) endGame();
    },
    [endGame, sfx],
  );

  const difficultyPicker = (
    <Panel label="Difficulty">
      <ChoiceGroup
        label="Difficulty"
        options={DIFFICULTY_OPTIONS}
        value={easyMode ? "easy" : "normal"}
        onChange={(v) => setEasyMode(v === "easy")}
      />
      <span className="dg-caption">
        {easyMode ? "Slower bubbles and bigger tap areas" : "Bubbles speed up as you pop!"}
      </span>
    </Panel>
  );

  // ── Start ──
  if (phase === "start") {
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle={
            <>
              Tap the bubbles before they float away. Don&apos;t let {MAX_MISSES} escape!
            </>
          }>
          {difficultyPicker}
          <Panel label="Tough bubbles">
            <div className="bp-legend">
              {[1, 2, 3].map((t) => (
                <div key={t} className="bp-legend-item">
                  <MiniBubble taps={t} />
                  <span className="dg-caption">
                    {t} tap{t > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
            <span className="dg-caption">Pop fast for a combo and bonus points!</span>
          </Panel>
          {best > 0 && (
            <StatPill icon={faCrown} color="#f59e0b">
              Best: {best}
            </StatPill>
          )}
          <KitButton size="lg" icon={faPlay} onClick={startGame}>
            Let&apos;s Pop!
          </KitButton>
        </StartScreen>
      </GameShell>
    );
  }

  // ── Game over ──
  if (phase === "gameover") {
    const stars = popped >= 25 ? 3 : popped >= 12 ? 2 : popped >= 1 ? 1 : 0;
    const title =
      stars === 3 ? "Bubble Master!" : stars === 2 ? "Amazing!" : stars === 1 ? "Great job!" : "Nice try!";
    return (
      <GameShell game={game}>
        <WinScreen
          icon={stars === 3 ? faTrophy : stars === 2 ? faMedal : faStar}
          iconColor={stars <= 1 ? game.colors.to : undefined}
          confetti={stars >= 2 || newBest}
          title={title}
          subtitle={
            <>
              You popped{" "}
              <strong>
                <CountUp value={popped} />
              </strong>{" "}
              bubble{popped !== 1 ? "s" : ""}!
            </>
          }>
          <Stars count={stars} />
          {newBest && (
            <Banner tone="gold" icon={faCrown}>
              New best score!
            </Banner>
          )}
          <div className="dg-row">
            <StatPill icon={faStar} color="#f59e0b" label="Score">
              <CountUp value={score} /> pts
            </StatPill>
            <StatPill icon={faFire} color="#f97316" label="Best combo">
              ×<CountUp value={bestCombo} /> combo
            </StatPill>
            {!newBest && best > 0 && (
              <StatPill icon={faCrown} color="#f59e0b" label="Best score">
                Best {best}
              </StatPill>
            )}
          </div>
          {difficultyPicker}
          <div className="dg-row" style={{ marginTop: 8 }}>
            <KitButton variant="neutral" icon={faArrowLeft} onClick={() => setPhase("start")}>
              Menu
            </KitButton>
            <KitButton icon={faArrowsRotate} onClick={startGame}>
              Play Again
            </KitButton>
          </div>
        </WinScreen>
      </GameShell>
    );
  }

  // ── Playing ──
  const hitboxBonus = easyModeRef.current ? HITBOX_BONUS : 0;

  return (
    <GameShell game={game}>
      <div className="dg-hud" style={{ maxWidth: 900 }}>
        <StatPill icon={faStar} color="#f59e0b" label="Score" bump={false}>
          <span key={score} className="bp-score">
            {score}
          </span>
        </StatPill>
        {combo >= 2 && (
          <Banner tone="gold" icon={faFire} key={combo}>
            Combo ×{Math.min(combo, MAX_COMBO)}!
          </Banner>
        )}
        <Hearts misses={misses} />
      </div>

      <div className="bp-stage">
        <div ref={fieldRef} className="bp-field">
          <Ambient />
          {hurtKey > 0 && <div key={hurtKey} className="bp-hurt" aria-hidden />}

          {bubbles.map((bubble) => {
            const box = bubble.size + hitboxBonus * 2;
            return (
              <div
                key={bubble.id}
                className="bp-hitbox"
                role="button"
                aria-label="Bubble"
                style={{
                  left: `calc(${bubble.x}% - ${hitboxBonus}px)`,
                  bottom: -box,
                  width: box,
                  height: box,
                  animationDuration: `${bubble.duration}s`,
                }}
                onPointerDown={(e) => handlePointerDown(bubble, e)}
                onAnimationEnd={(e) => handleEscape(bubble.id, e)}>
                <div
                  className="bp-sway"
                  style={
                    {
                      "--sway": `${bubble.sway}px`,
                      "--sway-d": `${bubble.swayDuration}s`,
                    } as CSSProperties
                  }>
                  <div className="bp-wobble">
                    <div
                      key={bubble.tapsRemaining}
                      className={
                        bubble.tapsRemaining < bubble.tapsRequired
                          ? "bp-bubble is-hit"
                          : "bp-bubble"
                      }
                      style={
                        {
                          "--tint": tapColor(bubble.tapsRemaining),
                          "--size": `${bubble.size}px`,
                        } as CSSProperties
                      }>
                      <FontAwesomeIcon icon={bubble.icon} className="bp-icon" />
                      {bubble.tapsRequired > 1 && (
                        <span className="bp-pips">
                          {Array.from({ length: bubble.tapsRemaining }, (_, i) => (
                            <i key={i} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {pops.map((pop) => (
            <div
              key={pop.id}
              className="bp-pop"
              style={
                {
                  left: pop.x,
                  top: pop.y,
                  "--s": `${pop.size}px`,
                  "--tint": pop.tint,
                } as CSSProperties
              }>
              <span className="bp-flash" />
              <span className="bp-ring" />
              {pop.drops.map((d, i) => (
                <i
                  key={i}
                  className="bp-drop"
                  style={
                    {
                      "--dx": `${d.dx}px`,
                      "--dy": `${d.dy}px`,
                      "--ds": `${d.size}px`,
                      "--dd": `${d.dur}s`,
                      "--c": d.color,
                    } as CSSProperties
                  }
                />
              ))}
              <span className="bp-pop-icon">
                <FontAwesomeIcon icon={pop.icon} />
              </span>
              <span className={pop.points > 1 ? "bp-points is-combo" : "bp-points"}>
                +{pop.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dg-row" style={{ marginTop: 16 }}>
        <KitButton
          variant="neutral"
          size="sm"
          icon={faArrowLeft}
          onClick={() => {
            clearTimers();
            phaseRef.current = "start";
            tapsLeftRef.current.clear();
            setBubbles([]);
            setPops([]);
            setPhase("start");
          }}>
          Quit
        </KitButton>
        <KitButton
          variant="neutral"
          size="sm"
          icon={muted ? faVolumeXmark : faVolumeHigh}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={toggleMute}>
          {muted ? "Sound off" : "Sound on"}
        </KitButton>
      </div>
    </GameShell>
  );
}
