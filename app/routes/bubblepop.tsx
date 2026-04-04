import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
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
  faPuzzlePiece,
  faRocket,
  faSnowflake,
  faStar,
  faSun,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "./+types/bubblepop";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bubble Pop - Games by DaniB" },
    { name: "description", content: "Pop the bubbles before they fly away!" },
  ];
}

const BUBBLE_ICONS: IconDefinition[] = [
  faStar, faHeart, faBolt, faCrown, faFire, faMusic, faGem, faRocket,
  faDragon, faBrain, faSnowflake, faSun, faMoon, faLeaf, faDice, faFrog,
  faCat, faDog, faDove, faFish, faFeather, faGamepad, faBullseye, faPuzzlePiece,
];

// Color by taps remaining (1 = almost popped, higher = tougher)
const TAP_COLORS: Record<number, string> = {
  1: "rgba(34,  197, 94,  0.72)", // green  — 1 tap left
  2: "rgba(59,  130, 246, 0.72)", // blue   — 2 taps left
  3: "rgba(239, 68,  68,  0.72)", // red    — 3 taps left
  4: "rgba(168, 85,  247, 0.72)", // purple — 4 taps left
  5: "rgba(249, 115, 22,  0.72)", // orange — 5 taps left
};

function tapColor(tapsRemaining: number): string {
  return TAP_COLORS[Math.min(tapsRemaining, 5)] ?? TAP_COLORS[5];
}

const MAX_MISSES = 5;
const HITBOX_BONUS = 22; // extra px around bubble in easy mode
let uid = 0;

type Bubble = {
  id: number;
  x: number;
  icon: IconDefinition;
  size: number;
  duration: number;
  tapsRequired: number;
  tapsRemaining: number;
};

type PopEffect = {
  id: number;
  x: number;
  y: number;
  icon: IconDefinition;
  size: number;
};

function spawnBubble(score: number, easy: boolean): Bubble {
  const maxTaps = score < 6 ? 1 : score < 15 ? 2 : score < 25 ? 3 : score < 40 ? 4 : 5;
  const tapsRequired = 1 + Math.floor(Math.random() * maxTaps);
  const baseDuration = 4.5 + Math.random() * 3.5;
  return {
    id: uid++,
    x: 5 + Math.random() * 82,
    icon: BUBBLE_ICONS[Math.floor(Math.random() * BUBBLE_ICONS.length)],
    size: 64 + Math.floor(Math.random() * 36),
    duration: easy ? baseDuration * 1.8 : baseDuration,
    tapsRequired,
    tapsRemaining: tapsRequired,
  };
}

export default function BubblePop() {
  const [phase, setPhase] = useState<"start" | "playing" | "gameover">("start");
  const [easyMode, setEasyMode] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pops, setPops] = useState<PopEffect[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);

  const scoreRef = useRef(0);
  const missesRef = useRef(0);
  const phaseRef = useRef<"start" | "playing" | "gameover">("start");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const easyModeRef = useRef(false);

  const stopSpawning = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    const easy = easyModeRef.current;
    const base = easy ? 1800 : 1400;
    const floor = easy ? 750 : 500;
    const interval = Math.max(floor, base - scoreRef.current * 25);
    timerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      setBubbles((prev) => [...prev, spawnBubble(scoreRef.current, easyModeRef.current)]);
      scheduleNext();
    }, interval);
  }, []);

  const endGame = useCallback(() => {
    stopSpawning();
    phaseRef.current = "gameover";
    setPhase("gameover");
    setBubbles([]);
    setPops([]);
  }, [stopSpawning]);

  const startGame = useCallback(() => {
    stopSpawning();
    uid = 0;
    scoreRef.current = 0;
    missesRef.current = 0;
    phaseRef.current = "playing";
    setScore(0);
    setMisses(0);
    setBubbles([]);
    setPops([]);
    setPhase("playing");
    scheduleNext();
  }, [stopSpawning, scheduleNext]);

  // Sync easyMode state → ref before game starts
  const handleStartGame = useCallback(() => {
    easyModeRef.current = easyMode;
    startGame();
  }, [easyMode, startGame]);

  useEffect(() => () => stopSpawning(), [stopSpawning]);

  const handlePop = useCallback(
    (bubble: Bubble, e: React.MouseEvent | React.TouchEvent) => {
      if (bubble.tapsRemaining > 1) {
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === bubble.id ? { ...b, tapsRemaining: b.tapsRemaining - 1 } : b,
          ),
        );
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setBubbles((prev) => prev.filter((b) => b.id !== bubble.id));

      const popId = uid++;
      setPops((prev) => [
        ...prev,
        { id: popId, x: rect.left, y: rect.top, icon: bubble.icon, size: bubble.size },
      ]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== popId)), 400);

      scoreRef.current++;
      setScore(scoreRef.current);
    },
    [],
  );

  const handleEscape = useCallback(
    (id: number) => {
      if (phaseRef.current !== "playing") return;
      setBubbles((prev) => prev.filter((b) => b.id !== id));
      missesRef.current = Math.min(missesRef.current + 1, MAX_MISSES);
      setMisses(missesRef.current);
      if (missesRef.current >= MAX_MISSES) endGame();
    },
    [endGame],
  );

  const encouragementIcon = score >= 25 ? faTrophy : score >= 15 ? faMedal : faStar;
  const encouragementText =
    score >= 25 ? "Bubble Master!" : score >= 15 ? "Amazing!" : score >= 8 ? "Great job!" : "Nice try!";

  const hitboxBonus = easyMode ? HITBOX_BONUS : 0;

  return (
    <Box>
      {/* ── Start screen ── */}
      {phase === "start" && (
        <Container maxWidth="sm" sx={{ textAlign: "center", pt: 6 }}>
          <Box sx={{ fontSize: "4rem", color: "#6366f1", mb: 1 }}>
            <FontAwesomeIcon icon={faBullseye} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>
            Bubble Pop!
          </Typography>
          <Typography variant="body1" sx={{ mb: 1, opacity: 0.7 }}>
            Tap the bubbles before they fly away!
          </Typography>
          <Typography variant="body2" sx={{ mb: 4, opacity: 0.45 }}>
            Don't let {MAX_MISSES} escape!
          </Typography>

          {/* Difficulty toggle */}
          <Box sx={{ display: "inline-flex", borderRadius: 99, overflow: "hidden", border: "2px solid", borderColor: "divider", mb: 4 }}>
            {(["normal", "easy"] as const).map((mode) => {
              const active = (mode === "easy") === easyMode;
              return (
                <Box
                  key={mode}
                  component="button"
                  onClick={() => setEasyMode(mode === "easy")}
                  sx={{
                    px: 3, py: 1.25,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    display: "flex", alignItems: "center", gap: 1,
                    background: active ? "linear-gradient(135deg,#6366f1,#a855f7)" : "transparent",
                    color: active ? "white" : "text.secondary",
                    transition: "all 0.2s",
                  }}>
                  <FontAwesomeIcon icon={mode === "easy" ? faFeather : faBolt} />
                  {mode === "easy" ? "Easy" : "Normal"}
                </Box>
              );
            })}
          </Box>

          {easyMode && (
            <Typography variant="body2" sx={{ mb: 3, opacity: 0.55, display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
              <FontAwesomeIcon icon={faFeather} />
              Slower bubbles &amp; bigger tap areas
            </Typography>
          )}

          <Box>
            <button className="btn" onClick={handleStartGame} style={{ fontSize: "1.25rem", padding: "16px 48px" }}>
              Let&apos;s Pop!&nbsp;&nbsp;<FontAwesomeIcon icon={faBullseye} />
            </button>
          </Box>
        </Container>
      )}

      {/* ── Game Over screen ── */}
      {phase === "gameover" && (
        <Container maxWidth="sm" sx={{ textAlign: "center", pt: 6 }}>
          <Box sx={{ fontSize: "3.5rem", color: "#f59e0b", mb: 2, animation: "bounceIn 0.5s ease" }}>
            <FontAwesomeIcon icon={encouragementIcon} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
            {encouragementText}
          </Typography>
          <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
            You popped <strong>{score}</strong> bubble{score !== 1 ? "s" : ""}!
          </Typography>
          <Typography variant="body2" sx={{ mb: 5, opacity: 0.45 }}>
            {score >= 25
              ? "You're a popping pro!"
              : score >= 8
              ? "Can you beat your score?"
              : "Keep practising — you've got this!"}
          </Typography>
          <button className="btn" onClick={handleStartGame} style={{ fontSize: "1.1rem", padding: "14px 40px" }}>
            Play Again!&nbsp;&nbsp;<FontAwesomeIcon icon={faBullseye} />
          </button>
        </Container>
      )}

      {/* ── Playing ── */}
      {phase === "playing" && (
        <Box sx={{ position: "relative", userSelect: "none" }}>
          {/* HUD */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 3,
              py: 1.5,
              position: "sticky",
              top: 0,
              zIndex: 10,
              bgcolor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}>
            <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <FontAwesomeIcon icon={faStar} style={{ color: "#f59e0b" }} />
              {score}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, fontSize: "1.3rem" }}>
              {Array.from({ length: MAX_MISSES }, (_, i) => (
                <FontAwesomeIcon
                  key={i}
                  icon={i < MAX_MISSES - misses ? faHeart : faHeartCrack}
                  style={{
                    color: i < MAX_MISSES - misses ? "#ef4444" : "#94a3b8",
                    fontSize: "1.3rem",
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Play field */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: "calc(100dvh - 120px)",
              overflow: "hidden",
            }}>
            {bubbles.map((bubble) => (
              <div
                key={bubble.id}
                className="bubblepop-hitbox"
                style={{
                  left: `calc(${bubble.x}% - ${hitboxBonus}px)`,
                  bottom: -(bubble.size + hitboxBonus * 2 + 20),
                  width: bubble.size + hitboxBonus * 2,
                  height: bubble.size + hitboxBonus * 2,
                  animationDuration: `${bubble.duration}s`,
                }}
                onClick={(e) => handlePop(bubble, e)}
                onAnimationEnd={() => handleEscape(bubble.id)}>
                <div
                  className="bubblepop-bubble"
                  style={{
                    position: "absolute",
                    top: hitboxBonus,
                    left: hitboxBonus,
                    width: bubble.size,
                    height: bubble.size,
                    background: tapColor(bubble.tapsRemaining),
                    transition: "background 0.2s ease",
                    fontSize: bubble.size * 0.44,
                  }}>
                  <FontAwesomeIcon icon={bubble.icon} style={{ color: "rgba(255,255,255,0.9)", pointerEvents: "none" }} />
                </div>
              </div>
            ))}
          </Box>
        </Box>
      )}

      {/* Pop effects — fixed overlay */}
      {pops.map((pop) => (
        <div
          key={pop.id}
          className="bubblepop-pop"
          style={{
            left: pop.x,
            top: pop.y,
            width: pop.size,
            height: pop.size,
            fontSize: pop.size * 0.44,
          }}>
          <FontAwesomeIcon icon={pop.icon} style={{ color: "rgba(255,255,255,0.9)" }} />
        </div>
      ))}
    </Box>
  );
}
