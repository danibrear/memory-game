import type { Route } from "./+types/home";
import { useEffect, useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const [gameState, setGameState] = useState<
    "START" | "ACTIVE" | "SHOWING" | "ENDED"
  >("START");
  const [correctCells, setCorrectCells] = useState<Set<number>>(new Set());
  const [incorrectCells, setIncorrectCells] = useState<Set<number>>(new Set());
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());

  const [difficulty, setDifficulty] = useState<number>(3);

  useEffect(() => {
    if (correctCells.size === selectedCells.size && correctCells.size > 0) {
      setGameState("ENDED");
    }
  }, [correctCells, selectedCells]);

  useEffect(() => {
    setCorrectCells(new Set());
    setIncorrectCells(new Set());
    setSelectedCells(new Set());
  }, [difficulty]);

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

  const handleStartGame = () => {
    const newCorrectCells = new Set<number>();
    const totalCells = difficulty * difficulty;
    while (newCorrectCells.size < difficulty) {
      const randomIndex = Math.floor(Math.random() * totalCells);
      newCorrectCells.add(randomIndex);
    }
    setCorrectCells(new Set());
    setIncorrectCells(new Set());
    setSelectedCells(newCorrectCells);
    setGameState("SHOWING");
    setTimeout(() => {
      setGameState("ACTIVE");
    }, 2000);
  };

  const renderGameBoard = () => {
    const cells = new Array(difficulty * difficulty).fill(0);

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${difficulty}, 1fr)`,
          gap: "10px",
          maxWidth: "60vh",
          margin: "20px auto",
          width: "90%",
        }}>
        {cells.map((_, index) => {
          const isCorrect = correctCells.has(index);
          const isIncorrect = incorrectCells.has(index);
          const isSelected = selectedCells.has(index);
          const isShowing = gameState === "SHOWING" && isSelected;
          return (
            <div
              key={index}
              className={`cell ${gameState === "ACTIVE" ? "clickable" : ""}`}
              onClick={() => handleClickCell(index)}
              style={{
                width: "100%",
                paddingBottom: "100%",
                backgroundColor: isCorrect
                  ? "green"
                  : isIncorrect
                    ? "red"
                    : isShowing
                      ? "blue"
                      : "lightgray",

                transform:
                  isCorrect || isIncorrect || isShowing
                    ? "rotateY(180deg)"
                    : "rotateY(0deg)",
                border: "1px solid rgba(0,0,0,.5)",
                boxShadow: "0 2px 5px rgba(0,0,0,.333)",
                position: "relative",
                borderRadius: "10%",
                transition: "all 0.25s ease",
                cursor: gameState === "ACTIVE" ? "pointer" : "not-allowed",
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
    );
  };

  const renderGameStatus = () => {
    if (gameState !== "ENDED") {
      return null;
    }
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "10px",
          marginBottom: "10px",
          position: "fixed",
          width: "100%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -100%)",
          zIndex: 1000,
        }}>
        <p
          className="alert alert-info mb-4"
          style={{
            boxShadow: "0 2px 10px rgba(0,0,0,.8)",
            animation: "slideUp 0.333s ease-out",
          }}>
          You got all the correct cells and made {incorrectCells.size}{" "}
          {incorrectCells.size === 1 ? "mistake" : "mistakes"}.
          <br />
          <button
            style={{ marginTop: "5px", width: "100%" }}
            onClick={() => {
              setGameState("START");
            }}
            className="btn">
            Done
          </button>
        </p>
      </div>
    );
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        minHeight: "100vh",
        position: "relative",
      }}>
      <div>
        <p>Difficulty {difficulty}</p>
        <input
          type="range"
          min={2}
          max={20}
          disabled={gameState !== "START" && gameState !== "ENDED"}
          value={difficulty}
          onChange={(e) => {
            setGameState("START");
            setDifficulty(parseInt(e.target.value));
          }}
        />
      </div>
      <div>
        <button
          disabled={gameState !== "START"}
          onClick={handleStartGame}
          className="btn">
          Play
        </button>
      </div>
      {renderGameStatus()}

      {renderGameBoard()}
      {gameState === "ENDED" && (
        <div
          style={{
            height: "100vh",
            width: "100vw",
            position: "fixed",
            top: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.25)",
            animation: "fadeIn 0.3s ease forwards",
            zIndex: 999,
          }}></div>
      )}
    </div>
  );
}
