import {
  faArrowUp,
  faBolt,
  faBrain,
  faCheck,
  faEye,
  faMedal,
  faQuestion,
  faStar,
  faTrophy,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memory Game - Games by DaniB" },
    { name: "description", content: "Remember the highlighted cells and find them all!" },
  ];
}

export default function Memory() {
  const [gameState, setGameState] = useState<
    "START" | "ACTIVE" | "INTRO" | "SHOWING" | "ENDED"
  >("START");
  const [correctCells, setCorrectCells] = useState<Set<number>>(new Set());
  const [incorrectCells, setIncorrectCells] = useState<Set<number>>(new Set());
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
  const [difficulty, setDifficulty] = useState<number>(3);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getGameStateJson = () => ({
    gameState,
    correctCells: Array.from(correctCells),
    incorrectCells: Array.from(incorrectCells),
    selectedCells: Array.from(selectedCells),
    difficulty,
  });

  useEffect(() => {
    if (gameState !== "ACTIVE") return;
    if (correctCells.size === selectedCells.size && correctCells.size > 0) {
      setGameState("ENDED");
      clearStoredData("memory-game-state");
    } else {
      setStoredData("memory-game-state", getGameStateJson());
    }
  }, [correctCells, gameState, selectedCells, incorrectCells]);

  useEffect(() => {
    setIsLoading(true);
    const storedData = getStoredData("memory-game-state");
    if (storedData) {
      setGameState(storedData.gameState);
      setCorrectCells(new Set(storedData.correctCells));
      setIncorrectCells(new Set(storedData.incorrectCells));
      setSelectedCells(new Set(storedData.selectedCells));
      setDifficulty(storedData.difficulty);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (gameState === "ENDED") {
      clearStoredData("memory-game-state");
    } else if (!isLoading) {
      setStoredData("memory-game-state", getGameStateJson());
    }
  }, [gameState, isLoading]);

  useEffect(() => {
    if (gameState !== "START" || isLoading) return;
    setCorrectCells(new Set());
    setIncorrectCells(new Set());
    setSelectedCells(new Set());
  }, [difficulty, isLoading]);

  const handleClickCell = (index: number) => {
    if (gameState !== "ACTIVE") return;
    if (selectedCells.has(index)) {
      setCorrectCells((s) => {
        s.add(index);
        return new Set(s);
      });
    } else {
      setIncorrectCells((s) => {
        s.add(index);
        return new Set(s);
      });
    }
  };

  const handleStartGame = (d = difficulty) => {
    const newCorrectCells = new Set<number>();
    const totalCells = d * d;
    while (newCorrectCells.size < d) {
      const randomIndex = Math.floor(Math.random() * totalCells);
      newCorrectCells.add(randomIndex);
    }
    setCorrectCells(new Set());
    setIncorrectCells(new Set());
    setSelectedCells(newCorrectCells);
    setGameState("INTRO");
    setTimeout(() => setGameState("SHOWING"), 2000);
    setTimeout(() => setGameState("ACTIVE"), 4000);
  };

  const accuracy =
    correctCells.size + incorrectCells.size > 0
      ? Math.round((correctCells.size / (correctCells.size + incorrectCells.size)) * 100)
      : 100;

  const DIFFICULTY_LABELS: Record<number, string> = {
    2: "Tiny", 3: "Easy", 4: "Easy", 5: "Medium",
    6: "Medium", 7: "Hard", 8: "Hard", 9: "Expert", 10: "Expert",
  };
  const diffLabel = DIFFICULTY_LABELS[difficulty] ?? (difficulty >= 11 ? "Insane" : "Easy");

  const diffColor =
    difficulty <= 4 ? "#22c55e" : difficulty <= 6 ? "#f59e0b" : difficulty <= 8 ? "#ef4444" : "#a855f7";

  const endIcon = incorrectCells.size === 0 ? faTrophy : accuracy >= 80 ? faMedal : faBrain;
  const endTitle =
    incorrectCells.size === 0 ? "Perfect!" : accuracy >= 80 ? "Well done!" : "Nice try!";
  const endSubtitle =
    incorrectCells.size === 0
      ? "Flawless memory!"
      : accuracy >= 80
      ? `${accuracy}% accuracy — great job!`
      : `${accuracy}% accuracy — keep practising!`;

  return (
    <Box sx={{ minHeight: "calc(100dvh - 64px)" }}>

      {/* ── Start screen ── */}
      {gameState === "START" && (
        <Container maxWidth="xs" sx={{ textAlign: "center", pt: 6, pb: 4 }}>
          <Box sx={{ fontSize: "4rem", mb: 1, color: "#6366f1" }}>
            <FontAwesomeIcon icon={faBrain} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
            Memory Game
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.6 }}>
            Watch the grid, remember the glowing cells, then find them all!
          </Typography>

          <Box
            sx={{
              background: "rgba(99,102,241,0.08)",
              border: "1.5px solid rgba(99,102,241,0.2)",
              borderRadius: 4,
              p: 3,
              mb: 4,
            }}>
            <Typography variant="overline" sx={{ opacity: 0.55, letterSpacing: 2 }}>
              Difficulty
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, mb: 2, justifyContent: "center" }}>
              <button className="icon-btn" onClick={() => setDifficulty((d) => Math.max(2, d - 1))}>
                −
              </button>
              <Box sx={{ textAlign: "center", minWidth: 80 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                  {difficulty}×{difficulty}
                </Typography>
                <Typography variant="caption" sx={{ color: diffColor, fontWeight: 700, letterSpacing: 1 }}>
                  {diffLabel}
                </Typography>
              </Box>
              <button className="icon-btn" onClick={() => setDifficulty((d) => Math.min(15, d + 1))}>
                +
              </button>
            </Box>
            <input
              type="range"
              min={2}
              max={15}
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
            <Typography variant="caption" sx={{ opacity: 0.45, display: "block", mt: 0.5 }}>
              Find {difficulty} cells in a {difficulty}×{difficulty} grid
            </Typography>
          </Box>

          <button className="btn" onClick={() => handleStartGame()} style={{ fontSize: "1.2rem", padding: "14px 48px" }}>
            Play!&nbsp;&nbsp;<FontAwesomeIcon icon={faBrain} />
          </button>
        </Container>
      )}

      {/* ── Ended screen ── */}
      {gameState === "ENDED" && (
        <Container maxWidth="xs" sx={{ textAlign: "center", pt: 6, pb: 4 }}>
          <Box sx={{
            fontSize: "3.5rem",
            mb: 2,
            color: incorrectCells.size === 0 ? "#f59e0b" : accuracy >= 80 ? "#6366f1" : "#64748b",
            animation: "bounceIn 0.5s ease",
          }}>
            <FontAwesomeIcon icon={endIcon} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
            {endTitle}
          </Typography>
          <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
            Found all <strong>{difficulty}</strong> cells
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, mb: 1 }}>
            {Array.from({ length: difficulty }, (_, i) => (
              <FontAwesomeIcon
                key={i}
                icon={faStar}
                style={{
                  color: i < correctCells.size ? "#f59e0b" : "#e2e8f0",
                  fontSize: "1rem",
                  transition: "color 0.2s",
                }}
              />
            ))}
          </Box>
          <Typography variant="body2" sx={{ mb: 4, opacity: 0.5 }}>
            {endSubtitle}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={() => handleStartGame()} style={{ fontSize: "1rem", padding: "12px 32px" }}>
              Play Again
            </button>
            <button
              className="btn"
              onClick={() => {
                const next = Math.min(15, difficulty + 1);
                setDifficulty(next);
                handleStartGame(next);
              }}
              style={{ fontSize: "1rem", padding: "12px 32px", background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
              Level Up&nbsp;&nbsp;<FontAwesomeIcon icon={faArrowUp} />
            </button>
          </Box>
        </Container>
      )}

      {/* ── Active / Showing / Intro ── */}
      {(gameState === "ACTIVE" || gameState === "SHOWING" || gameState === "INTRO") && (
        <Box>
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
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: 1 }}>
              <FontAwesomeIcon icon={faStar} style={{ color: "#f59e0b" }} />
              {correctCells.size} / {difficulty}
            </Typography>

            {gameState === "SHOWING" && (
              <Box sx={{
                px: 2, py: 0.5, borderRadius: 99,
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                color: "white", fontWeight: 700, fontSize: "0.85rem",
                display: "flex", alignItems: "center", gap: 1,
                animation: "fadeIn 0.3s ease",
              }}>
                <FontAwesomeIcon icon={faEye} />
                Remember these!
              </Box>
            )}
            {gameState === "INTRO" && (
              <Box sx={{
                px: 2, py: 0.5, borderRadius: 99,
                background: "rgba(99,102,241,0.15)",
                fontWeight: 700, fontSize: "0.85rem",
                display: "flex", alignItems: "center", gap: 1,
              }}>
                <FontAwesomeIcon icon={faBolt} />
                Get ready…
              </Box>
            )}

            <Typography sx={{
              fontWeight: 700, fontSize: "0.95rem",
              opacity: incorrectCells.size > 0 ? 1 : 0.3,
              display: "flex", alignItems: "center", gap: 1,
              color: incorrectCells.size > 0 ? "#ef4444" : "inherit",
            }}>
              <FontAwesomeIcon icon={faXmark} />
              {incorrectCells.size}
            </Typography>
          </Box>

          {/* Grid */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 2, pb: 3, px: 2 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
                gap: `${Math.max(6 - Math.floor(difficulty / 4), 2)}px`,
                width: "min(90vw, 70vh)",
              }}>
              {Array.from({ length: difficulty * difficulty }, (_, index) => {
                const isCorrect = correctCells.has(index);
                const isIncorrect = incorrectCells.has(index);
                const isShowing = gameState === "SHOWING" && selectedCells.has(index);
                const isClickable = gameState === "ACTIVE" && !isCorrect && !isIncorrect;

                const cardClass = [
                  "memory-card",
                  isShowing ? "memory-card--showing" : "",
                  isCorrect ? "memory-card--correct" : "",
                  isIncorrect ? "memory-card--incorrect" : "",
                  isClickable ? "memory-card--clickable" : "",
                ].filter(Boolean).join(" ");

                return (
                  <div key={index} className={cardClass} onClick={() => handleClickCell(index)}
                    style={{ paddingBottom: "100%", position: "relative" }}>
                    <div className="memory-card__face memory-card__back">
                      {(isShowing || isCorrect) && <FontAwesomeIcon icon={faCheck} />}
                      {isIncorrect && <FontAwesomeIcon icon={faXmark} />}
                    </div>
                    <div className="memory-card__face memory-card__front">
                      <FontAwesomeIcon icon={faQuestion} />
                    </div>
                  </div>
                );
              })}
            </Box>

            {gameState === "ACTIVE" && (
              <Box sx={{ mt: 3, textAlign: "center" }}>
                <button onClick={() => setGameState("START")} className="btn btn-sm"
                  style={{ opacity: 0.6, fontSize: "0.8rem", padding: "6px 20px" }}>
                  Restart
                </button>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
