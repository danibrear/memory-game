import {
  faCheck,
  faEraser,
  faFillDrip,
  faPaintBrush,
  faPlus,
  faRainbow,
  faRotateLeft,
  faTableCells,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChoiceGroup,
  GameShell,
  getGame,
  KitButton,
  KitDialog,
  type Choice,
} from "~/components/game/GameKit";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/color";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Color Game - Games by DaniB" },
    {
      name: "description",
      content:
        "Pick a color and paint pixel art! Drag to draw, fill big areas, or use the rainbow brush.",
    },
  ];
}

const PALETTE = [
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#facc15", light: true },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Sky", hex: "#38bdf8" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Purple", hex: "#8b5cf6" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Peach", hex: "#fdba8c", light: true },
  { name: "Brown", hex: "#92400e" },
  { name: "Black", hex: "#1f2937" },
  { name: "White", hex: "#ffffff", light: true },
];

/** Palette indices the rainbow brush cycles through, in rainbow order. */
const RAINBOW_ORDER = [0, 1, 2, 4, 6, 7, 8, 9];

const SIZES = [4, 6, 8, 10, 12, 16];
const DEFAULT_SIZE = 8;
const EMPTY = -1;
const MAX_UNDO = 40;
const STORAGE_KEY = "color-game-state-v2";

type Tool = "brush" | "rainbow" | "fill" | "eraser";

const TOOLS: Choice<Tool>[] = [
  { value: "brush", label: "Brush", icon: faPaintBrush },
  { value: "rainbow", label: "Rainbow", icon: faRainbow },
  { value: "fill", label: "Fill", icon: faFillDrip },
  { value: "eraser", label: "Eraser", icon: faEraser },
];

const blank = (size: number) => new Array<number>(size * size).fill(EMPTY);

function floodFill(
  cells: number[],
  size: number,
  start: number,
  value: number,
): number[] {
  const target = cells[start];
  if (target === value) return cells;
  const next = cells.slice();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (next[i] !== target) continue;
    next[i] = value;
    const row = Math.floor(i / size);
    const col = i % size;
    if (row > 0) stack.push(i - size);
    if (row < size - 1) stack.push(i + size);
    if (col > 0) stack.push(i - 1);
    if (col < size - 1) stack.push(i + 1);
  }
  return next;
}

function cellFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  const cell = el instanceof HTMLElement ? el.closest<HTMLElement>("[data-cell]") : null;
  return cell ? Number(cell.dataset.cell) : null;
}

export default function ColorGame() {
  const game = getGame("color");

  const [size, setSize] = useState(DEFAULT_SIZE);
  const [cells, setCells] = useState<number[]>(() => blank(DEFAULT_SIZE));
  const [colorIdx, setColorIdx] = useState(0);
  const [tool, setTool] = useState<Tool>("brush");
  const [history, setHistory] = useState<number[][]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [pendingSize, setPendingSize] = useState(DEFAULT_SIZE);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const strokeStart = useRef<number[] | null>(null);
  const lastCell = useRef<number | null>(null);
  const rainbowStep = useRef(0);

  // Restore the last canvas
  useEffect(() => {
    const saved = getStoredData(STORAGE_KEY);
    if (
      saved &&
      SIZES.includes(saved.size) &&
      Array.isArray(saved.cells) &&
      saved.cells.length === saved.size * saved.size
    ) {
      setSize(saved.size);
      setPendingSize(saved.size);
      setCells(saved.cells);
      if (typeof saved.colorIdx === "number" && PALETTE[saved.colorIdx]) {
        setColorIdx(saved.colorIdx);
      }
    }
    setLoaded(true);
  }, []);

  // Save after strokes finish (not on every cell mid-drag)
  useEffect(() => {
    if (!loaded || isPainting) return;
    setStoredData(STORAGE_KEY, { size, cells, colorIdx });
  }, [loaded, isPainting, size, cells, colorIdx]);

  const pushHistory = (snapshot: number[]) =>
    setHistory((h) => [...h.slice(-(MAX_UNDO - 1)), snapshot]);

  const paintCell = (index: number) => {
    if (index === lastCell.current) return;
    lastCell.current = index;
    let value = colorIdx;
    if (tool === "eraser") value = EMPTY;
    if (tool === "rainbow") {
      value = RAINBOW_ORDER[rainbowStep.current % RAINBOW_ORDER.length];
      rainbowStep.current += 1;
    }
    setCells((prev) => {
      if (prev[index] === value) return prev;
      const next = prev.slice();
      next[index] = value;
      return next;
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const index = cellFromPoint(e.clientX, e.clientY);
    if (index === null) return;
    e.preventDefault();

    if (tool === "fill") {
      const value = colorIdx;
      const next = floodFill(cellsRef.current, size, index, value);
      if (next !== cellsRef.current) {
        pushHistory(cellsRef.current);
        setCells(next);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    strokeStart.current = cellsRef.current;
    lastCell.current = null;
    setIsPainting(true);
    paintCell(index);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!strokeStart.current) return;
    const index = cellFromPoint(e.clientX, e.clientY);
    if (index !== null) paintCell(index);
  };

  const endStroke = () => {
    const before = strokeStart.current;
    strokeStart.current = null;
    lastCell.current = null;
    setIsPainting(false);
    // Only keep an undo step when the stroke actually changed something
    if (before && before !== cellsRef.current) pushHistory(before);
  };

  const handleUndo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setCells(prev);
    setHistory(history.slice(0, -1));
  };

  const handleNewCanvas = () => {
    setSize(pendingSize);
    setCells(blank(pendingSize));
    setHistory([]);
    setNewOpen(false);
  };

  const brushHex =
    tool === "eraser" ? "#94a3b8" : (PALETTE[colorIdx]?.hex ?? "#94a3b8");
  const gap = size <= 6 ? 7 : size <= 10 ? 5 : size <= 12 ? 4 : 3;
  const isEmpty = cells.every((c) => c === EMPTY);

  return (
    <GameShell game={game}>
      <div className="cg-stage">
        <div className="cg-toolbar">
          <ChoiceGroup
            label="Painting tool"
            options={TOOLS}
            value={tool}
            onChange={setTool}
          />
        </div>

        <div className="dg-tray">
          <div
            className={`cg-grid ${isPainting ? "is-painting" : ""}`}
            style={
              {
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                "--cg-gap": `${gap}px`,
                "--brush": brushHex,
              } as CSSProperties
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            role="grid"
            aria-label={`${size} by ${size} painting canvas`}>
            {cells.map((value, i) => {
              const painted = value !== EMPTY && PALETTE[value];
              return (
                <div
                  key={painted ? `${i}-${value}` : i}
                  data-cell={i}
                  role="gridcell"
                  aria-label={painted ? PALETTE[value].name : "Empty"}
                  className={`cg-cell ${painted ? "cg-cell--painted" : ""}`}
                  style={
                    painted
                      ? ({ "--c": PALETTE[value].hex } as CSSProperties)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>

        <div className="cg-palette" role="group" aria-label="Colors">
          {PALETTE.map((c, i) => {
            const selected =
              i === colorIdx && (tool === "brush" || tool === "fill");
            return (
              <button
                key={c.name}
                type="button"
                className={`cg-swatch ${c.light ? "cg-swatch--light" : ""}`}
                style={{ "--c": c.hex } as CSSProperties}
                aria-label={c.name}
                aria-pressed={selected}
                title={c.name}
                onClick={() => {
                  setColorIdx(i);
                  if (tool === "eraser" || tool === "rainbow") setTool("brush");
                }}>
                {selected && <FontAwesomeIcon icon={faCheck} />}
              </button>
            );
          })}
        </div>

        <div className="dg-row">
          <KitButton
            variant="neutral"
            icon={faRotateLeft}
            onClick={handleUndo}
            disabled={history.length === 0}>
            Undo
          </KitButton>
          <KitButton
            icon={faPlus}
            onClick={() => {
              setPendingSize(size);
              setNewOpen(true);
            }}>
            New Picture
          </KitButton>
        </div>
      </div>

      <KitDialog
        game={game}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        icon={faTableCells}
        title="New picture">
        <p className="dg-caption" style={{ margin: 0 }}>
          {isEmpty
            ? "Pick a canvas size to start painting."
            : "Pick a size. Your current picture will be cleared."}
        </p>
        <div className="cg-size-grid">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className="dg-seg-btn"
              style={{ justifyContent: "center", border: "1px solid var(--dg-border)" }}
              aria-pressed={pendingSize === s}
              onClick={() => setPendingSize(s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <div className="dg-row" style={{ marginTop: 6 }}>
          <KitButton variant="neutral" onClick={() => setNewOpen(false)}>
            Keep Painting
          </KitButton>
          <KitButton
            variant={isEmpty ? "primary" : "danger"}
            onClick={handleNewCanvas}>
            {isEmpty ? "Start" : "Clear & Start"}
          </KitButton>
        </div>
      </KitDialog>
    </GameShell>
  );
}
