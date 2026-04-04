import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "./+types/bubblepop";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bubble Pop - Games by DaniB" },
    { name: "description", content: "Pop the bubbles before they fly away!" },
  ];
}

const EMOJIS = [
  "🌟", "🦋", "🐸", "🦄", "🌈", "🎈", "🍭", "🐙",
  "🌸", "🍓", "🦊", "🐼", "💫", "🌺", "🐝", "🍦",
  "🎵", "🎀", "🐬", "🌙",
];

const COLORS = [
  "rgba(255, 182, 193, 0.65)",
  "rgba(173, 216, 230, 0.65)",
  "rgba(152, 251, 152, 0.65)",
  "rgba(255, 255, 153, 0.65)",
  "rgba(221, 160, 221, 0.65)",
  "rgba(255, 218, 100, 0.65)",
  "rgba(135, 206, 250, 0.65)",
];

const MAX_MISSES = 5;
let uid = 0;

type Bubble = {
  id: number;
  x: number;
  emoji: string;
  size: number;
  duration: number;
  color: string;
};

type PopEffect = {
  id: number;
  x: number;
  y: number;
  emoji: string;
  size: number;
};

function spawnBubble(): Bubble {
  return {
    id: uid++,
    x: 5 + Math.random() * 82,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    size: 64 + Math.floor(Math.random() * 36),
    duration: 4.5 + Math.random() * 3.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export default function BubblePop() {
  const [phase, setPhase] = useState<"start" | "playing" | "gameover">("start");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pops, setPops] = useState<PopEffect[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);

  const scoreRef = useRef(0);
  const missesRef = useRef(0);
  const phaseRef = useRef<"start" | "playing" | "gameover">("start");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSpawning = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    // Start at 1400ms, speed up to 500ms as score climbs
    const interval = Math.max(500, 1400 - scoreRef.current * 25);
    timerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      setBubbles((prev) => [...prev, spawnBubble()]);
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

  useEffect(() => () => stopSpawning(), [stopSpawning]);

  const handlePop = useCallback(
    (bubble: Bubble, e: React.MouseEvent | React.TouchEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setBubbles((prev) => prev.filter((b) => b.id !== bubble.id));

      const popId = uid++;
      setPops((prev) => [
        ...prev,
        { id: popId, x: rect.left, y: rect.top, emoji: bubble.emoji, size: bubble.size },
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

  const encouragement =
    score >= 25 ? "🏆 Bubble Master!" :
    score >= 15 ? "⭐ Amazing!" :
    score >= 8  ? "Great job!" :
                  "Nice try!";

  return (
    <Box>
      {/* ── Start screen ── */}
      {phase === "start" && (
        <Container maxWidth="sm" sx={{ textAlign: "center", pt: 6 }}>
          <Typography sx={{ fontSize: "5rem", lineHeight: 1, mb: 1 }}>🫧</Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>
            Bubble Pop!
          </Typography>
          <Typography variant="body1" sx={{ mb: 1, opacity: 0.7 }}>
            Tap the bubbles before they fly away!
          </Typography>
          <Typography variant="body2" sx={{ mb: 5, opacity: 0.45 }}>
            Don't let {MAX_MISSES} escape!
          </Typography>
          <button
            className="btn"
            onClick={startGame}
            style={{ fontSize: "1.25rem", padding: "16px 48px" }}>
            Let's Pop! 🫧
          </button>
        </Container>
      )}

      {/* ── Game Over screen ── */}
      {phase === "gameover" && (
        <Container maxWidth="sm" sx={{ textAlign: "center", pt: 6 }}>
          <div className="cooking-celebration">
            <div className="cooking-stars">💥 🫧 💥</div>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
              {encouragement}
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
            <button
              className="btn"
              onClick={startGame}
              style={{ fontSize: "1.1rem", padding: "14px 40px" }}>
              Play Again! 🫧
            </button>
          </div>
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
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              ⭐ {score}
            </Typography>
            <Typography sx={{ fontSize: "1.4rem", letterSpacing: 2 }}>
              {"❤️".repeat(Math.max(0, MAX_MISSES - misses))}
              {"🖤".repeat(Math.min(misses, MAX_MISSES))}
            </Typography>
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
                className="bubblepop-bubble"
                style={{
                  left: `${bubble.x}%`,
                  width: bubble.size,
                  height: bubble.size,
                  background: bubble.color,
                  animationDuration: `${bubble.duration}s`,
                  fontSize: bubble.size * 0.46,
                }}
                onClick={(e) => handlePop(bubble, e)}
                onAnimationEnd={() => handleEscape(bubble.id)}>
                {bubble.emoji}
              </div>
            ))}
          </Box>
        </Box>
      )}

      {/* Pop effects — fixed overlay, outside the play field */}
      {pops.map((pop) => (
        <div
          key={pop.id}
          className="bubblepop-pop"
          style={{
            left: pop.x,
            top: pop.y,
            width: pop.size,
            height: pop.size,
            fontSize: pop.size * 0.46,
          }}>
          {pop.emoji}
        </div>
      ))}
    </Box>
  );
}
