import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { shuffle } from "lodash";
import { useEffect, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memory Game by DaniB" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const storageKey = "match-game-state";

const EMPTY_CELL_VALUE = -1;

export default function Match() {
  const [gameState, setGameState] = useState<
    "START" | "ACTIVE" | "RESTORED" | "FINISHED"
  >("START");

  const darkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [cellValues, setCellValues] = useState<number[]>([]);

  const [difficulty, setDifficulty] = useState<number>(4);

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
      player1Score,
      player2Score,
      turn,
      revealedCells,
      selectedCells,
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
    const half1Shuffled = shuffle(half1);
    const half2Shuffled = shuffle(half2);
    const shuffledPieces = [...half1Shuffled, ...odd, ...half2Shuffled];
    return shuffledPieces;
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
          // It's a match!
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
      setStoredData(storageKey, getGameStateJson());
    }
  };

  const handleSetDifficulty = (newDifficulty: number) => {
    setDifficulty(newDifficulty);
    setGameState("ACTIVE");
    setCellValues(buildBoard(newDifficulty));
    resetState();
  };

  const renderPlayerScores = () => {
    if (gameState !== "ACTIVE" && gameState !== "FINISHED") return null;
    return (
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
          <Chip
            color="info"
            variant="filled"
            sx={{ fontSize: "2rem", p: 3, px: 2 }}
            label={`${player1Score}`}
          />
          <Chip
            color="error"
            variant="filled"
            label={`${player2Score}`}
            sx={{ fontSize: "2rem", p: 3, px: 2 }}
          />
        </Stack>
        <Chip
          color={turn === 1 ? "info" : "error"}
          sx={{ mt: 1, fontSize: "2rem", p: 2, py: 3 }}
          label={`Player ${turn} Turn`}
        />
      </Box>
    );
  };

  const renderGameBoard = () => {
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
        {renderPlayerScores()}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
            gap: `${Math.max(5 - Math.floor(difficulty / 5), 2)}px`,
            maxWidth: "60vh",
            margin: "5px auto",
            width: "90%",
            position: "relative",
          }}>
          {cellValues.map((value, index) => {
            const bgColor = darkMode ? "#333" : "#fff";
            const isRevealed =
              selectedCells &&
              revealedCells &&
              (selectedCells.includes(index) || revealedCells.includes(index));
            const backgroundColor = isRevealed
              ? `hsl(${(value * 137.5) % 360}, 70%, ${
                  darkMode ? "40%" : "80%"
                })`
              : bgColor;

            let fontSize = "6rem";
            if (difficulty >= 8) {
              fontSize = "2rem";
            } else if (difficulty >= 5) {
              fontSize = "3rem";
            } else if (difficulty >= 4) {
              fontSize = "4rem";
            }
            if (value === EMPTY_CELL_VALUE) {
              return (
                <div
                  key={index}
                  className="cell cell-empty"
                  style={{
                    width: "100%",
                    paddingBottom: "100%",
                    position: "relative",
                    borderRadius: "10%",
                  }}
                />
              );
            }
            return (
              <div
                key={index}
                className={`cell ${gameState === "ACTIVE" ? "clickable" : ""}`}
                onClick={() => handleClickCell(index)}
                style={{
                  width: "100%",
                  transform:
                    isRevealed && gameState !== "START"
                      ? "rotateY(180deg)"
                      : "rotateY(0deg)",

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
                    fontSize,
                    transform:
                      isRevealed && gameState !== "START"
                        ? "rotateY(-180deg)"
                        : "rotateY(0deg)",
                  }}>
                  {selectedCells?.includes(index) ||
                  revealedCells?.includes(index)
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

  const renderGameOverScreen = () => {
    const color = player1Score > player2Score ? "info" : "error";
    const chipLabel =
      player1Score > player2Score ? "Player 1 Wins!" : "Player 2 Wins!";
    const isTie = player1Score === player2Score;
    return (
      <DialogContent sx={{ p: 1.5, overflow: "hidden" }}>
        <Typography variant="h4" textAlign="center" gutterBottom>
          Game Over!
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            sx={{
              display: "flex",
              flexGrow: 1,
              fontWeight: "bold",
              py: 3,
              fontSize: "2rem",
            }}
            label={`${player1Score}`}
            color="info"
          />
          <Chip
            sx={{
              display: "flex",
              flexGrow: 1,
              fontWeight: "bold",
              py: 3,
              fontSize: "2rem",
            }}
            label={`${player2Score}`}
            color="error"
          />
        </Stack>
        {!isTie && (
          <Chip
            color={color}
            sx={{
              display: "flex",
              flexGrow: 1,
              mt: 2,
              mx: 3,
              py: 3,
              fontWeight: "bold",
              fontSize: "2rem",
              animationDuration: "3s",
            }}
            className="fa-beat"
            label={chipLabel}
          />
        )}
        {isTie && (
          <Chip
            color="default"
            sx={{
              display: "flex",
              flexGrow: 1,
              mt: 2,
              py: 3,
              fontWeight: "bold",
              fontSize: "2.25rem",
            }}
            label={`It's a Tie!`}
          />
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            sx={{ whiteSpace: "nowrap" }}
            onClick={() => {
              setGameState("ACTIVE");
              setCellValues(buildBoard(difficulty));
              resetState();
            }}>
            Play Again
          </Button>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            sx={{ whiteSpace: "nowrap" }}
            onClick={() => {
              setIsConfirmingReset(false);
              setGameState("START");
            }}>
            Change Size
          </Button>
        </Stack>
      </DialogContent>
    );
  };

  const renderStartScreen = () => {
    if (gameState === "START") {
      return (
        <Dialog open={true}>
          <DialogContent>
            <Typography
              variant="h4"
              textAlign="center"
              gutterBottom
              sx={{ color: theme.palette.text.primary, fontWeight: "bold" }}>
              Match Game!
            </Typography>

            <Typography
              variant="body1"
              gutterBottom
              sx={{ color: theme.palette.text.primary, fontWeight: "bold" }}>
              Take turns finding matching pairs of cells. The player with the
              most matches at the end wins!
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography
              sx={{
                fontWeight: "bold",
                mb: 2,
                textAlign: "center",
                color: theme.palette.text.primary,
              }}
              gutterBottom>
              What size grid would you like to play?
            </Typography>
            <TextField
              select
              label="Size"
              value={difficulty}
              onChange={(e) => handleSetDifficulty(Number(e.target.value))}
              fullWidth>
              {new Array(6).fill(0).map((_, i) => {
                const val = i + 2;
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
              size="large"
              onClick={() => {
                handleSetDifficulty(difficulty);
              }}>
              Start Game
            </Button>
          </DialogActions>
        </Dialog>
      );
    }
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
      {renderStartScreen()}
      {renderGameBoard()}

      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            setIsConfirmingReset(true);
          }}>
          Reset
        </Button>
        <Button
          variant="contained"
          size="large"
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
              size="large"
              color="error"
              onClick={handleResetConfirm}>
              Yes, Reset
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => setIsConfirmingReset(false)}>
              Cancel
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <Dialog open={gameState === "FINISHED"} fullWidth maxWidth="sm">
        {renderGameOverScreen()}
      </Dialog>
    </div>
  );
}
