import { useEffect, useState } from "react";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/memory";

import { faCircleInfo, faHeart } from "@fortawesome/free-solid-svg-icons";
import { faAdd } from "@fortawesome/free-solid-svg-icons/faAdd";
import { faSubtract } from "@fortawesome/free-solid-svg-icons/faSubtract";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Memory Game by DaniB" },
    { name: "description", content: "Welcome to React Router!" },
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

  const getGameStateJson = () => {
    return {
      gameState,
      correctCells: Array.from(correctCells),
      incorrectCells: Array.from(incorrectCells),
      selectedCells: Array.from(selectedCells),
      difficulty,
    };
  };

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
    setGameState("INTRO");

    setTimeout(() => {
      setGameState("SHOWING");
    }, 2000);
    setTimeout(() => {
      setGameState("ACTIVE");
    }, 4000);
  };

  const renderGameBoard = () => {
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
            const isCorrect = correctCells.has(index);
            const isIncorrect = incorrectCells.has(index);
            const isSelected = selectedCells.has(index);
            const isShowing = gameState === "SHOWING" && isSelected;
            const isActive = gameState !== "START";
            const isCorrectClass = isCorrect && isActive ? "correct" : "";
            const isIncorrectClass = isIncorrect && isActive ? "incorrect" : "";
            const isShowingClass = isShowing ? "showing" : "";
            return (
              <div
                key={index}
                className={`cell ${gameState === "ACTIVE" ? "clickable" : ""} ${isCorrectClass} ${isIncorrectClass} ${isShowingClass}`}
                onClick={() => handleClickCell(index)}
                style={{
                  width: "100%",
                  paddingBottom: "100%",
                  transform:
                    (isCorrect || isIncorrect || isShowing) &&
                    gameState !== "START"
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
          {gameState === "INTRO" && (
            <div
              className="modal"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
                width: "90%",
                maxWidth: "400px",
                gap: "10px",
                display: "flex",
                flexDirection: "column",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(0,0,0,.8)",
                animation: "fadeIn .333s ease forwards",
              }}>
              <div
                style={{
                  gap: "10px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                <FontAwesomeIcon
                  icon={faCircleInfo}
                  style={{
                    fontSize: "2rem",
                  }}
                />
                <h6
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}>
                  Remember these cells!
                </h6>
              </div>
            </div>
          )}
          {gameState === "START" && (
            <div
              className="modal"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
                width: "90%",
                maxWidth: "400px",
                gap: "10px",
                display: "flex",
                flexDirection: "column",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(0,0,0,.8)",
                animation: "fadeIn .333s ease forwards",
              }}>
              <div
                style={{
                  paddingBottom: "10px",
                  marginBottom: "10px",
                  borderBottom: "1px solid rgba(0,0,0,.1)",
                }}>
                <h6
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: "10px",
                  }}>
                  Find all green cells
                </h6>
                <p
                  style={{
                    marginBottom: "5px",
                    textAlign: "center",
                  }}>
                  Difficulty: <strong>{difficulty}</strong>
                </p>
                <div>
                  <input
                    type="range"
                    min={2}
                    max={15}
                    style={{
                      width: "100%",
                    }}
                    disabled={gameState !== "START"}
                    value={difficulty}
                    onChange={(e) => {
                      setGameState("START");
                      setDifficulty(parseInt(e.target.value));
                    }}
                  />
                  <div
                    style={{
                      display: "flex",

                      gap: "5px",
                    }}>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setDifficulty((d) => Math.max(2, d - 1));
                      }}>
                      <FontAwesomeIcon icon={faSubtract} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setDifficulty((d) => Math.min(15, d + 1));
                      }}>
                      <FontAwesomeIcon icon={faAdd} />
                    </button>
                  </div>
                </div>
              </div>
              <button
                style={{
                  opacity: 0,
                  transform: "translateY(50px)",
                  animation: "slideUp .5s 0.1s ease forwards",
                }}
                disabled={gameState !== "START"}
                onClick={handleStartGame}
                className="btn">
                Play
              </button>

              <div
                style={{
                  textAlign: "center",
                  marginTop: "10px",
                  opacity: 0,
                  animation: "slideUp .666s 0.5s ease forwards",
                }}>
                <small
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    window.open("https://db.rocks", "_blank");
                  }}>
                  Made with{" "}
                  <FontAwesomeIcon
                    icon={faHeart}
                    bounce
                    style={{
                      color: "red",
                      fontSize: "1rem",
                    }}
                  />{" "}
                  by{" "}
                  <a
                    href="https://db.rocks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                    style={{
                      fontSize: ".9rem",
                      fontWeight: "bold",
                    }}>
                    Dani
                  </a>
                </small>
              </div>
            </div>
          )}
        </div>
        {(gameState === "ACTIVE" || gameState === "SHOWING") && (
          <div
            className="alert alert-info"
            style={{ marginTop: "10px", textAlign: "center" }}>
            <p>
              Found:{" "}
              <strong>
                {correctCells.size} / {difficulty}
              </strong>
            </p>
            <p style={{ marginTop: "5px" }}>
              <strong>{incorrectCells.size}</strong>{" "}
              {incorrectCells.size === 1 ? "mistake" : "mistakes"}
            </p>
            <button
              onClick={() => setGameState("START")}
              className="btn btn-sm mt-4">
              Restart
            </button>
          </div>
        )}
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
            Play Again
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
        minHeight: "80vh",
        position: "relative",
      }}>
      {renderGameStatus()}

      {renderGameBoard()}
      {(gameState === "ENDED" ||
        gameState === "START" ||
        gameState === "INTRO") && (
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
