import {
  Button,
  Dialog,
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

export default function Memory() {
  const [gameState, setGameState] = useState<"START" | "ACTIVE" | "RESTORED">(
    "START",
  );

  const darkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [cellColors, setCellColors] = useState<number[]>([]);

  const [difficulty, setDifficulty] = useState<number>(3);

  const [restoring, setRestoring] = useState<boolean>(true);

  const theme = useTheme();

  const getGameStateJson = () => {
    return {
      gameState,
      cells: difficulty,
      cellColors,
    };
  };

  useEffect(() => {
    const state = getStoredData("color-game-state");
    if (state && state.gameState === "ACTIVE") {
      setGameState(state.gameState);
      setDifficulty(state.cells);
      setCellColors(state.cellColors);
    }
  }, []);

  useEffect(() => {
    if (restoring) return;
    setStoredData("color-game-state", getGameStateJson());
  }, [cellColors, restoring]);

  const handleClickCell = (index: number) => {
    setRestoring(false);
    if (gameState !== "ACTIVE") return;
    setCellColors((prevColors) => {
      const newColors = [...prevColors];
      newColors[index] = (newColors[index] + 1) % COLORS.length;
      return newColors;
    });
  };

  const handleSetDifficulty = (newDifficulty: number) => {
    setDifficulty(newDifficulty);
    setGameState("ACTIVE");
    setCellColors(new Array(newDifficulty * newDifficulty).fill(0));
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
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <MenuItem key={level} value={level}>
                  {level} x {level}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
        </Dialog>
      );
    }
    const cells = new Array(difficulty * difficulty).fill(0);
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
          {cells.map((_, index) => {
            const bgColor = darkMode ? "#333" : "#fff";
            const cellColor =
              cellColors[index] > 0 ? COLORS[cellColors[index]] : bgColor;
            return (
              <div
                key={index}
                className={`cell ${gameState === "ACTIVE" ? "clickable" : ""}`}
                onClick={() => handleClickCell(index)}
                style={{
                  width: "100%",
                  backgroundColor: cellColor,
                  paddingBottom: "100%",
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
                  }}></div>
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
            setCellColors(new Array(difficulty * difficulty).fill(0));
          }}>
          Reset
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setGameState("START");
            setCellColors(new Array(difficulty * difficulty).fill(0));
          }}>
          Change size
        </Button>
      </Stack>
    </div>
  );
}
