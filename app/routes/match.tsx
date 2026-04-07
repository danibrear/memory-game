import {
  faArrowsRotate,
  faCopy,
  faGrip,
  faPlay,
  faRepeat,
  faStar,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Typography, useMediaQuery } from "@mui/material";
import shuffle from "lodash/shuffle";
import { useEffect, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Match Game - Games by DaniB" },
    {
      name: "description",
      content:
        "Take turns finding matching pairs! The player with the most matches wins.",
    },
  ];
}

const storageKey = "match-game-state";

const EMPTY_CELL_VALUE = -1;

export default function Match() {
  const [gameState, setGameState] = useState<
    "START" | "ACTIVE" | "RESTORED" | "FINISHED"
  >("START");

  const [cellValues, setCellValues] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<number>(4);
  const [restoring, setRestoring] = useState<boolean>(true);

  const [player1Score, setPlayer1Score] = useState<number>(0);
  const [player2Score, setPlayer2Score] = useState<number>(0);

  const [turn, setTurn] = useState<1 | 2>(1);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [revealedCells, setRevealedCells] = useState<number[]>([]);
  const isDark = useMediaQuery("(prefers-color-scheme: dark)");

  const getGameStateJson = () => ({
    gameState,
    cells: difficulty,
    cellValues,
    player1Score,
    player2Score,
    turn,
    revealedCells,
    selectedCells,
  });

  const resetState = () => {
    setRevealedCells([]);
    setSelectedCells([]);
    setTurn(1);
    setRestoring(false);
    setPlayer1Score(0);
    setPlayer2Score(0);
  };

  const buildBoard = (size: number) => {
    const newSize = Math.floor((size * size) / 2);
    const pieces = new Array(newSize).fill(0).map((_, i) => i + 1);
    const doublePieces = pieces.concat(pieces);
    let shuffled = shuffle(doublePieces);
    for (let i = 0; i < 5; i++) {
      shuffled = shuffle(shuffled);
    }
    const odd = size % 2 === 1 ? [EMPTY_CELL_VALUE] : [];
    const half1 = shuffled.slice(0, Math.floor(shuffled.length / 2));
    const half2 = shuffled.slice(Math.floor(shuffled.length / 2));
    return [...shuffle(half1), ...odd, ...shuffle(half2)];
  };

  useEffect(() => {
    const state = getStoredData(storageKey);
    if (state && state.gameState === "ACTIVE") {
      setGameState(state.gameState);
      setDifficulty(state.cells);
      setCellValues(state.cellValues);
      setPlayer1Score(state.player1Score);
      setPlayer2Score(state.player2Score);
      setTurn(state.turn);
      setRevealedCells(state.revealedCells);
      setSelectedCells(state.selectedCells);
      setRestoring(false);
    }
  }, []);

  useEffect(() => {
    if (restoring) return;
    setStoredData(storageKey, getGameStateJson());
  }, [
    cellValues,
    restoring,
    revealedCells,
    selectedCells,
    player1Score,
    player2Score,
    turn,
    gameState,
  ]);

  const handleClickCell = (index: number) => {
    if (gameState !== "ACTIVE") return;
    if (
      selectedCells.length < 2 &&
      !selectedCells.includes(index) &&
      !revealedCells.includes(index)
    ) {
      const newSelected = [...selectedCells, index];
      setSelectedCells(newSelected);
      if (newSelected.length === 2) {
        const [firstIndex, secondIndex] = newSelected;
        if (cellValues[firstIndex] === cellValues[secondIndex]) {
          setRevealedCells((revealed) => [
            ...revealed,
            firstIndex,
            secondIndex,
          ]);
          if (
            (difficulty % 2 === 1 &&
              revealedCells.length + 3 === cellValues.length) ||
            (difficulty % 2 === 0 &&
              revealedCells.length + 2 === cellValues.length)
          ) {
            setGameState("FINISHED");
          }
          if (turn === 1) {
            setPlayer1Score((score) => score + 1);
          } else {
            setPlayer2Score((score) => score + 1);
          }
          setSelectedCells([]);
        } else {
          setTurn(turn === 1 ? 2 : 1);
          setTimeout(() => {
            setSelectedCells([]);
          }, 1000);
        }
      }
      setStoredData(storageKey, getGameStateJson());
    }
  };

  const handleSetDifficulty = (newDifficulty: number) => {
    setDifficulty(newDifficulty);
    setGameState("ACTIVE");
    setCellValues(buildBoard(newDifficulty));
    resetState();
  };

  const handleRestart = () => {
    setCellValues(buildBoard(difficulty));
    resetState();
    setGameState("ACTIVE");
  };

  // ── Start screen ──
  if (gameState === "START") {
    return (
      <Box sx={{ minHeight: "calc(100dvh - 64px)" }}>
        <Container maxWidth="xs" sx={{ textAlign: "center", pt: 6, pb: 4 }}>
          <Box sx={{ fontSize: "4rem", mb: 1, color: "#6366f1" }}>
            <FontAwesomeIcon icon={faCopy} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
            Match Game
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.6 }}>
            Take turns finding matching pairs of cells. The player with the most
            matches wins!
          </Typography>

          <Box
            sx={{
              background: "rgba(99,102,241,0.08)",
              border: "1.5px solid rgba(99,102,241,0.2)",
              borderRadius: 4,
              p: 3,
              mb: 4,
            }}>
            <Typography
              variant="overline"
              sx={{ opacity: 0.55, letterSpacing: 2 }}>
              Grid Size
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mt: 1,
                mb: 1,
                justifyContent: "center",
              }}>
              <button
                className="icon-btn"
                onClick={() => setDifficulty((d) => Math.max(2, d - 1))}>
                −
              </button>
              <Typography variant="h4" sx={{ fontWeight: 700, minWidth: 80 }}>
                {difficulty}×{difficulty}
              </Typography>
              <button
                className="icon-btn"
                onClick={() => setDifficulty((d) => Math.min(7, d + 1))}>
                +
              </button>
            </Box>
            <Typography variant="caption" sx={{ opacity: 0.45 }}>
              {Math.floor((difficulty * difficulty) / 2)} pairs to find
            </Typography>
          </Box>

          <button
            className="btn"
            onClick={() => handleSetDifficulty(difficulty)}
            style={{ fontSize: "1.2rem", padding: "14px 48px" }}>
            <FontAwesomeIcon icon={faPlay} /> Start!
          </button>
        </Container>
      </Box>
    );
  }

  // ── Finished screen ──
  if (gameState === "FINISHED") {
    const isTie = player1Score === player2Score;
    const winner = player1Score > player2Score ? 1 : 2;
    return (
      <Box sx={{ minHeight: "calc(100dvh - 64px)" }}>
        <Container
          maxWidth="sm"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
            textAlign: "center",
          }}>
          <div className="match-win">
            <div className="match-win-icon">
              <FontAwesomeIcon icon={isTie ? faStar : faTrophy} />
            </div>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
              {isTie ? "It's a Tie!" : `Player ${winner} Wins!`}
            </Typography>

            <div className="match-scores-final">
              <div
                className={`match-score-card match-p1 ${!isTie && winner === 1 ? "match-score-winner" : ""}`}>
                <Typography variant="overline" sx={{ opacity: 0.6 }}>
                  Player 1
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800 }}>
                  {player1Score}
                </Typography>
              </div>
              <Typography
                variant="h5"
                sx={{ opacity: 0.3, alignSelf: "center" }}>
                vs
              </Typography>
              <div
                className={`match-score-card match-p2 ${!isTie && winner === 2 ? "match-score-winner" : ""}`}>
                <Typography variant="overline" sx={{ opacity: 0.6 }}>
                  Player 2
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800 }}>
                  {player2Score}
                </Typography>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                marginTop: 24,
              }}>
              <button className="btn" onClick={handleRestart}>
                <FontAwesomeIcon icon={faRepeat} /> Play Again
              </button>
              <button className="btn" onClick={() => setGameState("START")}>
                <FontAwesomeIcon icon={faGrip} /> Change Size
              </button>
            </div>
          </div>
        </Container>
      </Box>
    );
  }

  // ── Active game ──
  return (
    <Box sx={{ minHeight: "calc(100dvh - 64px)" }}>
      <Container maxWidth="md" sx={{ textAlign: "center", py: 2 }}>
        {/* Header */}
        <div className="match-header">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            <FontAwesomeIcon icon={faCopy} /> Match Game
          </Typography>
        </div>

        {/* Scores */}
        <div className="match-scoreboard">
          <div
            className={`match-player match-p1 ${turn === 1 ? "match-player-active" : ""}`}>
            <Typography variant="overline" sx={{ opacity: 0.7, lineHeight: 1 }}>
              Player 1
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {player1Score}
            </Typography>
          </div>
          <div className="match-turn-indicator">
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              Turn
            </Typography>
            <div
              className={`match-turn-dot ${turn === 1 ? "match-p1" : "match-p2"}`}
            />
          </div>
          <div
            className={`match-player match-p2 ${turn === 2 ? "match-player-active" : ""}`}>
            <Typography variant="overline" sx={{ opacity: 0.7, lineHeight: 1 }}>
              Player 2
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {player2Score}
            </Typography>
          </div>
        </div>

        {/* Actions */}
        <div className="match-actions">
          <button
            className="btn"
            onClick={handleRestart}
            style={{ fontSize: "0.85rem" }}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Restart
          </button>
          <button
            className="btn"
            onClick={() => setGameState("START")}
            style={{ fontSize: "0.85rem" }}>
            <FontAwesomeIcon icon={faGrip} /> Change Size
          </button>
        </div>

        {/* Board */}
        <div
          className="match-board"
          style={{
            gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
            gap: `${Math.max(6 - Math.floor(difficulty / 3), 3)}px`,
          }}>
          {cellValues.map((value, index) => {
            if (value === EMPTY_CELL_VALUE) {
              return (
                <div key={index} className="match-cell match-cell-empty" />
              );
            }
            const isRevealed =
              selectedCells.includes(index) || revealedCells.includes(index);
            const isMatched = revealedCells.includes(index);
            return (
              <button
                key={index}
                className={`match-cell ${isRevealed ? "match-cell-revealed" : "match-cell-hidden"} ${isMatched ? "match-cell-matched" : ""}`}
                onClick={() => handleClickCell(index)}
                style={
                  isRevealed
                    ? {
                        backgroundColor: isDark
                          ? `hsl(${(value * 137.5) % 360}, 55%, 35%)`
                          : `hsl(${(value * 137.5) % 360}, 65%, 75%)`,
                        borderColor: isDark
                          ? `hsl(${(value * 137.5) % 360}, 50%, 50%)`
                          : `hsl(${(value * 137.5) % 360}, 55%, 55%)`,
                      }
                    : undefined
                }>
                <span
                  className={`match-cell-face ${isRevealed ? "match-face-show" : ""}`}>
                  {isRevealed ? value : "?"}
                </span>
              </button>
            );
          })}
        </div>
      </Container>
    </Box>
  );
}
