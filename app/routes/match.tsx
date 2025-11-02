import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memory Game by DaniB" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const COLORS = [
  "transparent",
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
  "lime",
];

const storageKey = "match-game-state";

export default function Match() {
  const [gameState, setGameState] = useState<
    "START" | "ACTIVE" | "RESTORED" | "FINISHED"
  >("START");

  const darkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [cellValues, setCellValues] = useState<number[]>([]);

  const [difficulty, setDifficulty] = useState<number>(3);

  const [restoring, setRestoring] = useState<boolean>(true);
  const [isConfirmingReset, setIsConfirmingReset] = useState<boolean>(false);

  const [player1Score, setPlayer1Score] = useState<number>(0);
  const [player2Score, setPlayer2Score] = useState<number>(0);

  const [turn, setTurn] = useState<1 | 2>(1);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [revealedCells, setRevealedCells] = useState<number[]>([]);

  const theme = useTheme();

  const getGameStateJson = () => {
    return {
      gameState,
      cells: difficulty,
      cellValues,
    };
  };

  const handleResetConfirm = () => {
    setCellValues(buildBoard(difficulty));
    setIsConfirmingReset(false);
    resetState();
  };
  const resetState = () => {
    setRevealedCells([]);
    setSelectedCells([]);
    setTurn(1);
    setRestoring(false);
    setIsConfirmingReset(false);
    setPlayer1Score(0);
    setPlayer2Score(0);
  };
  const buildBoard = (size: number) => {
    const newSize = Math.ceil((size * size) / 2);
    console.log("newSize", newSize);
    const pieces = new Array(newSize).fill(0).map((_, i) => i + 1);
    const doubledPieces = pieces.concat(pieces);
    const shuffledPieces = doubledPieces.sort(() => Math.random() - 0.5);
    return shuffledPieces;
  };

  useEffect(() => {
    const state = getStoredData(storageKey);
    if (state && state.gameState === "ACTIVE") {
      setGameState(state.gameState);
      setDifficulty(state.cells);
    }
  }, []);

  useEffect(() => {
    if (restoring) return;
    setStoredData(storageKey, getGameStateJson());
  }, [cellValues, restoring]);

  const handleClickCell = (index: number) => {
    if (gameState !== "ACTIVE") return;
    if (selectedCells.length < 2 && !selectedCells.includes(index)) {
      const newSelected = [...selectedCells, index];
      setSelectedCells(newSelected);
      if (newSelected.length === 2) {
        const [firstIndex, secondIndex] = newSelected;
        if (cellValues[firstIndex] === cellValues[secondIndex]) {
          // It's a match!
          setRevealedCells((revealed) => [
            ...revealed,
            firstIndex,
            secondIndex,
          ]);
          if (revealedCells.length + 2 === cellValues.length) {
            // Game over
            setGameState("FINISHED");
          }
          if (turn === 1) {
            setPlayer1Score((score) => score + 1);
          } else {
            setPlayer2Score((score) => score + 1);
          }
          setSelectedCells([]);
        } else {
          // Not a match, switch turns
          setTurn(turn === 1 ? 2 : 1);
          setTimeout(() => {
            setSelectedCells([]);
          }, 1000);
        }
        // Clear selection after a short delay
      }
    }
  };

  const handleSetDifficulty = (newDifficulty: number) => {
    setDifficulty(newDifficulty);
    setGameState("ACTIVE");
    setCellValues(buildBoard(newDifficulty));
    resetState();
  };

  const renderGameBoard = () => {
    if (gameState === "START") {
      return (
        <Dialog open={true}>
          <DialogContent>
            <Typography variant="h5" gutterBottom>
              What size grid would you like to play?
            </Typography>
            <TextField
              select
              label="Size"
              value={difficulty}
              onChange={(e) => handleSetDifficulty(Number(e.target.value))}
              fullWidth>
              {new Array(5).fill(0).map((_, i) => {
                const val = (i + 1) * 2;
                return (
                  <MenuItem key={i} value={val}>
                    {val} x {val}
                  </MenuItem>
                );
              })}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              onClick={() => {
                handleSetDifficulty(difficulty);
              }}>
              Start Game
            </Button>
          </DialogActions>
        </Dialog>
      );
    }
    return (
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          position: "relative",
          flexDirection: "column",
          width: "100%",
        }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            mb: 2,
          }}>
          <Stack direction="row" spacing={4}>
            <Typography>Player 1: {player1Score}</Typography>
            <Typography>Player 2: {player2Score}</Typography>
          </Stack>
          <Typography variant="h6" sx={{ mt: 1 }}>
            Current Turn: {turn === 1 ? "Player 1" : "Player 2"}
          </Typography>
        </Box>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
            gap: `${Math.max(5 - Math.floor(difficulty / 5), 2)}px`,
            maxWidth: "60vh",
            margin: "20px auto",
            width: "90%",
            position: "relative",
          }}>
          {cellValues.map((value, index) => {
            const bgColor = darkMode ? "#333" : "#fff";
            const backgroundColor =
              selectedCells.includes(index) || revealedCells.includes(index)
                ? `hsl(${(value * 137.5) % 360}, 70%, ${
                    darkMode ? "40%" : "80%"
                  })`
                : bgColor;
            return (
              <div
                key={index}
                className={`cell ${gameState === "ACTIVE" ? "clickable" : ""}`}
                onClick={() => handleClickCell(index)}
                style={{
                  width: "100%",

                  paddingBottom: "100%",
                  backgroundColor,
                  border: `1px solid ${darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.5)"}`,
                  boxShadow: `0 2px 5px ${darkMode ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.2)"}`,
                  position: "relative",
                  borderRadius: "10%",
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "4rem",
                  }}>
                  {selectedCells.includes(index) ||
                  revealedCells.includes(index)
                    ? value
                    : "?"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        minHeight: "80vh",
        position: "relative",
      }}>
      {renderGameBoard()}

      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Button
          variant="contained"
          onClick={() => {
            setIsConfirmingReset(true);
          }}>
          Reset
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setGameState("START");
          }}>
          Change size
        </Button>
      </Stack>
      <Dialog
        open={isConfirmingReset}
        onClose={() => setIsConfirmingReset(false)}>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Are you sure you want to reset the game? This will clear all your
            progress.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="error"
              onClick={handleResetConfirm}>
              Yes, Reset
            </Button>
            <Button
              variant="outlined"
              onClick={() => setIsConfirmingReset(false)}>
              Cancel
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <Dialog open={gameState === "FINISHED"}>
        <DialogContent>
          <Typography variant="h5" gutterBottom>
            Game Over!
          </Typography>
          <Typography variant="body1" gutterBottom>
            Final Scores:
          </Typography>
          <Typography variant="body1">
            Player 1: {player1Score} | Player 2: {player2Score}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={() => {
                setGameState("ACTIVE");
                setCellValues(buildBoard(difficulty));
                resetState();
              }}>
              Play Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setIsConfirmingReset(false);
                setGameState("START");
              }}>
              Change Size
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </div>
  );
}
