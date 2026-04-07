import {
  faCircle,
  faLayerGroup,
  faPlay,
  faRotate,
  faTrophy,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Typography } from "@mui/material";
import type PhaserType from "phaser";
import { useEffect, useRef, useState } from "react";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/hole";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hole Drop - Games by DaniB" },
    {
      name: "description",
      content:
        "Move the hole to swallow objects. Grow bigger and clear stacked towers or random shapes.",
    },
  ];
}

type Mode = "STACKS" | "SHAPES";
type Phase = "START" | "PLAYING" | "FINISHED";
type PieceKind = "box" | "cylinder" | "diamond";
type PropType = "building" | "car" | "food" | "tree" | "crate";

const STORAGE_KEY = "hole-drop-best";
const BASE_RADIUS = 36;
const MAX_RADIUS = 126;
const PALETTE = [
  "#f97316",
  "#10b981",
  "#f43f5e",
  "#06b6d4",
  "#f59e0b",
  "#8b5cf6",
  "#84cc16",
  "#ef4444",
  "#0ea5e9",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shadeHex(hex: string, amount: number): number {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((value & 0xff) + amount, 0, 255);
  return (r << 16) | (g << 8) | b;
}

type StatsPayload = {
  score: number;
  remaining: number;
  holeSize: number;
  elapsed: number;
  debug?: {
    nx: number;
    ny: number;
    keyInput: boolean;
    dragInput: boolean;
    touchDevice: boolean;
  };
};

type FinishPayload = {
  score: number;
  elapsed: number;
};

type SpawnPoint = {
  x: number;
  y: number;
  size: number;
  minHoleRadius: number;
  propType: PropType;
};

type IslandArea = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type CityArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PieceObj = {
  container: PhaserType.GameObjects.Container;
  lockRing: PhaserType.GameObjects.Ellipse;
  body: MatterJS.BodyType;
  size: number;
  minHoleRadius: number;
  kind: PieceKind;
  propType: PropType;
  baseX: number;
  baseY: number;
  wobble: number;
  rotSpeed: number;
  captured: boolean;
  depth: number;
  lipCatchMs: number;
  lipCatchTotalMs: number;
  jamNudgeCooldownMs: number;
};

type WorldProp = {
  x: number; // normalized -1..1 across island width
  y: number; // normalized -1..1 across island height
  type: PropType;
  size: "s" | "m" | "l" | "xl";
};

type WorldFile = {
  name: string;
  props: WorldProp[];
};

function randomPieceSize() {
  const roll = Math.random();
  if (roll < 0.5) return 16 + Math.random() * 10;
  if (roll < 0.82) return 26 + Math.random() * 12;
  return 38 + Math.random() * 20;
}

function sizeFromBucket(bucket: WorldProp["size"]) {
  if (bucket === "s") return 14 + Math.random() * 6;
  if (bucket === "m") return 22 + Math.random() * 8;
  if (bucket === "l") return 34 + Math.random() * 14;
  return 52 + Math.random() * 18;
}

function kindForPropType(propType: PropType): PieceKind {
  if (propType === "car") return "box";
  if (propType === "food") return pick<PieceKind>(["cylinder", "diamond"]);
  if (propType === "tree") return "cylinder";
  if (propType === "building") return "box";
  return pick<PieceKind>(["box", "cylinder", "diamond"]);
}

function propColor(propType: PropType) {
  if (propType === "car")
    return pick(["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"]);
  if (propType === "food")
    return pick(["#fb7185", "#f97316", "#facc15", "#84cc16"]);
  if (propType === "tree") return pick(["#16a34a", "#22c55e", "#15803d"]);
  if (propType === "building")
    return pick(["#94a3b8", "#64748b", "#475569", "#a3a3a3"]);
  return pick(PALETTE);
}

function worldPropsToSpawnPoints(
  world: WorldFile,
  island: IslandArea,
  width: number,
  height: number,
): SpawnPoint[] {
  return world.props.map((prop) => {
    const x = clamp(island.cx + prop.x * island.rx * 0.92, 50, width - 50);
    const y = clamp(island.cy + prop.y * island.ry * 0.9, 50, height - 50);
    const size = sizeFromBucket(prop.size);
    const baseMin = minHoleRadiusForSize(size);
    const typeBoost =
      prop.type === "building" ? 6 : prop.type === "car" ? 2 : 0;
    return {
      x,
      y,
      size,
      minHoleRadius: baseMin + typeBoost,
      propType: prop.type,
    };
  });
}

function worldPropsToSpawnPointsInCity(
  world: WorldFile,
  city: CityArea,
  width: number,
  height: number,
): SpawnPoint[] {
  return world.props.map((prop) => {
    const x = clamp(city.x + ((prop.x + 1) / 2) * city.width, 50, width - 50);
    const y = clamp(city.y + ((prop.y + 1) / 2) * city.height, 50, height - 50);
    const size = sizeFromBucket(prop.size);
    const baseMin = minHoleRadiusForSize(size);
    const typeBoost =
      prop.type === "building" ? 7 : prop.type === "car" ? 2 : 0;
    return {
      x,
      y,
      size,
      minHoleRadius: baseMin + typeBoost,
      propType: prop.type,
    };
  });
}

function minHoleRadiusForSize(size: number) {
  // Keep progression but allow more early-game pieces to be swallowable.
  return Math.max(15, size * 0.72 + 5);
}

function withDensityVariance(
  points: SpawnPoint[],
  density: number,
  width: number,
  height: number,
): SpawnPoint[] {
  if (points.length === 0) return points;

  const factor = clamp(density / 4, 0.5, 2.2);
  const kept: SpawnPoint[] = [];

  if (factor < 1) {
    const keepProb = factor * (0.86 + Math.random() * 0.2);
    for (const pt of points) {
      if (Math.random() <= keepProb) kept.push(pt);
    }
  } else {
    kept.push(...points);
  }

  const extraFactor = Math.max(0, factor - 1);
  const extraCount = Math.floor(
    points.length * extraFactor * (0.75 + Math.random() * 0.55),
  );

  for (let i = 0; i < extraCount; i++) {
    const base = pick(points);
    const size = clamp(base.size * (0.82 + Math.random() * 0.35), 12, 72);
    const jitter = 12 + density * 2;
    const x = clamp(base.x + (Math.random() * 2 - 1) * jitter, 40, width - 40);
    const y = clamp(base.y + (Math.random() * 2 - 1) * jitter, 40, height - 40);
    const typeBoost =
      base.propType === "building" ? 6 : base.propType === "car" ? 2 : 0;
    kept.push({
      x,
      y,
      size,
      minHoleRadius: minHoleRadiusForSize(size) + typeBoost,
      propType: base.propType,
    });
  }

  return kept;
}

function stackSpawnPoints(
  width: number,
  height: number,
  density: number,
  island: IslandArea,
): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  const pileCount = density * 11 + 42;

  for (let pile = 0; pile < pileCount; pile++) {
    const angle = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random());
    const baseX = island.cx + Math.cos(angle) * island.rx * radial * 0.92;
    const baseY = island.cy + Math.sin(angle) * island.ry * radial * 0.9;
    const stackHeight = 2 + Math.floor(Math.random() * (density <= 4 ? 3 : 4));

    for (let i = 0; i < stackHeight; i++) {
      const size = randomPieceSize();
      points.push({
        x: clamp(baseX + (Math.random() * 12 - 6), 50, width - 50),
        y: clamp(baseY - i * (size * 0.78), 50, height - 50),
        size,
        minHoleRadius: minHoleRadiusForSize(size),
        propType: pick<PropType>(["crate", "food", "tree"]),
      });
    }
  }

  return points;
}

function shapeSpawnPoints(
  width: number,
  height: number,
  density: number,
  island: IslandArea,
): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  const templates = [
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ];
  const clusterCount = density * 8 + 28;

  for (let i = 0; i < clusterCount; i++) {
    const pattern = pick(templates);
    const size = randomPieceSize();
    const angle = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random());
    const originX = island.cx + Math.cos(angle) * island.rx * radial * 0.9;
    const originY = island.cy + Math.sin(angle) * island.ry * radial * 0.86;

    for (const [gx, gy] of pattern) {
      const x = originX + gx * (size + 4) + (Math.random() * 4 - 2);
      const y = originY + gy * (size + 4) + (Math.random() * 4 - 2);
      if (x > 22 && x < width - 22 && y > 22 && y < height - 22) {
        points.push({
          x,
          y,
          size,
          minHoleRadius: minHoleRadiusForSize(size),
          propType: pick<PropType>(["food", "crate", "car"]),
        });
      }
    }
  }

  return points;
}

function citySpawnPoints(
  width: number,
  height: number,
  density: number,
  city: CityArea,
): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  const margin = 32;
  const minX = city.x + margin;
  const maxX = city.x + city.width - margin;
  const minY = city.y + margin;
  const maxY = city.y + city.height - margin;

  const verticalRoads: number[] = [];
  const horizontalRoads: number[] = [];

  let xCursor = minX + 80 + Math.random() * 50;
  while (xCursor < maxX - 80) {
    verticalRoads.push(xCursor);
    xCursor += 110 + Math.random() * 130;
  }

  let yCursor = minY + 80 + Math.random() * 50;
  while (yCursor < maxY - 80) {
    horizontalRoads.push(yCursor);
    yCursor += 110 + Math.random() * 130;
  }

  const nearRoad = (x: number, y: number, laneHalf = 17) => {
    const v = verticalRoads.some((rx) => Math.abs(x - rx) <= laneHalf);
    const h = horizontalRoads.some((ry) => Math.abs(y - ry) <= laneHalf);
    return v || h;
  };

  const startX = city.x + city.width * 0.5;
  const startY = city.y + city.height * 0.52;
  const starterRadius = 165;

  const roadIntersections = Math.max(
    1,
    verticalRoads.length * horizontalRoads.length,
  );
  const districtCount = Math.max(
    6,
    Math.floor(density * 2.2 + roadIntersections * 0.55),
  );

  for (let d = 0; d < districtCount; d++) {
    const centerX = minX + Math.random() * (maxX - minX);
    const centerY = minY + Math.random() * (maxY - minY);
    if (nearRoad(centerX, centerY, 22)) continue;

    const spread = 45 + Math.random() * 95;
    const buildingCount = 6 + Math.floor(Math.random() * 12) + density;

    for (let i = 0; i < buildingCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.62) * spread;
      const x = clamp(centerX + Math.cos(angle) * radius, minX, maxX);
      const y = clamp(centerY + Math.sin(angle) * radius, minY, maxY);
      if (nearRoad(x, y, 20)) continue;
      const distFromStart = Math.hypot(x - startX, y - startY);
      if (distFromStart < starterRadius && Math.random() < 0.72) continue;

      // Wide, non-uniform distribution: mostly medium, some huge towers.
      const roll = Math.random();
      const size =
        roll < 0.46
          ? 26 + Math.random() * 22
          : roll < 0.84
            ? 42 + Math.random() * 32
            : roll < 0.96
              ? 68 + Math.random() * 24
              : 88 + Math.random() * 16;
      points.push({
        x,
        y,
        size: clamp(size, 24, 104),
        minHoleRadius: minHoleRadiusForSize(size) + 4 + size * 0.08,
        propType: "building",
      });

      // Decorate building districts with non-road props.
      if (Math.random() < 0.34) {
        const decoType = pick<PropType>(["crate", "tree", "food"]);
        const decoSize = clamp(size * (0.28 + Math.random() * 0.32), 14, 38);
        const decoX = clamp(x + (Math.random() * 2 - 1) * 24, minX, maxX);
        const decoY = clamp(y + (Math.random() * 2 - 1) * 24, minY, maxY);
        if (!nearRoad(decoX, decoY, 14)) {
          points.push({
            x: decoX,
            y: decoY,
            size: decoSize,
            minHoleRadius: minHoleRadiusForSize(decoSize),
            propType: decoType,
          });
        }
      }
    }
  }

  // Cars spawn directly on lane centers to read as road traffic.
  const carCount = Math.max(18, density * 18 + Math.floor(Math.random() * 24));
  for (let i = 0; i < carCount; i++) {
    const useVertical = Math.random() < 0.5 || horizontalRoads.length === 0;
    if (useVertical && verticalRoads.length > 0) {
      const roadX = pick(verticalRoads);
      const carX = clamp(roadX + (Math.random() * 2 - 1) * 6, minX, maxX);
      const carY = minY + Math.random() * (maxY - minY);
      const size = 18 + Math.random() * 12;
      points.push({
        x: carX,
        y: carY,
        size,
        minHoleRadius: minHoleRadiusForSize(size) + 2,
        propType: "car",
      });
    } else if (horizontalRoads.length > 0) {
      const roadY = pick(horizontalRoads);
      const carY = clamp(roadY + (Math.random() * 2 - 1) * 6, minY, maxY);
      const carX = minX + Math.random() * (maxX - minX);
      const size = 18 + Math.random() * 12;
      points.push({
        x: carX,
        y: carY,
        size,
        minHoleRadius: minHoleRadiusForSize(size) + 2,
        propType: "car",
      });
    }
  }

  // Ensure a fair early game near the spawn area with guaranteed swallowable props.
  const easyCount = 14 + density * 2;
  for (let i = 0; i < easyCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 26 + Math.random() * (starterRadius * 0.72);
    let x = clamp(startX + Math.cos(angle) * radius, minX, maxX);
    let y = clamp(startY + Math.sin(angle) * radius, minY, maxY);

    const easyType =
      Math.random() < 0.52 ? "car" : pick<PropType>(["food", "crate"]);
    if (easyType === "car") {
      // Snap starter cars to the closest road lane so cars still read as road traffic.
      const nearestVX =
        verticalRoads.length > 0
          ? verticalRoads.reduce(
              (best, road) =>
                Math.abs(road - x) < Math.abs(best - x) ? road : best,
              verticalRoads[0],
            )
          : x;
      const nearestHY =
        horizontalRoads.length > 0
          ? horizontalRoads.reduce(
              (best, road) =>
                Math.abs(road - y) < Math.abs(best - y) ? road : best,
              horizontalRoads[0],
            )
          : y;
      if (Math.abs(nearestVX - x) < Math.abs(nearestHY - y)) {
        x = clamp(nearestVX + (Math.random() * 2 - 1) * 5, minX, maxX);
      } else {
        y = clamp(nearestHY + (Math.random() * 2 - 1) * 5, minY, maxY);
      }
    }

    const size =
      easyType === "car" ? 16 + Math.random() * 9 : 13 + Math.random() * 8;
    points.push({
      x,
      y,
      size,
      minHoleRadius: Math.max(BASE_RADIUS - 6, minHoleRadiusForSize(size) - 6),
      propType: easyType,
    });
  }

  return points;
}

export default function Hole() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PhaserType.Game | null>(null);
  const currentRunRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("START");
  const [mode, setMode] = useState<Mode>("STACKS");
  const [density, setDensity] = useState<number>(4);
  const [score, setScore] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [holeSize, setHoleSize] = useState<number>(BASE_RADIUS);
  const [elapsed, setElapsed] = useState<number>(0);
  const [best, setBest] = useState<number>(0);
  const [isTouchHint, setIsTouchHint] = useState<boolean>(false);
  const [debugInput, setDebugInput] = useState<
    | {
        nx: number;
        ny: number;
        keyInput: boolean;
        dragInput: boolean;
        touchDevice: boolean;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const saved = getStoredData(STORAGE_KEY);
    if (typeof saved === "number" && Number.isFinite(saved)) {
      setBest(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const sync = () => setIsTouchHint(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const destroyGame = () => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
  };

  const startRound = () => {
    currentRunRef.current += 1;
    setScore(0);
    setElapsed(0);
    setHoleSize(BASE_RADIUS);
    setRemaining(0);
    setPhase("PLAYING");
  };

  useEffect(() => {
    if (phase !== "PLAYING" || !mountRef.current) {
      destroyGame();
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const phaserModule = await import("phaser");
      const PhaserLib = (phaserModule.default ??
        phaserModule) as typeof import("phaser");
      if (cancelled || !mountRef.current) return;

      type ScenePiece = PieceObj;
      const selectedMode = mode;
      const selectedDensity = density;
      const onStats = (payload: StatsPayload) => {
        if (cancelled) return;
        setScore(payload.score);
        setRemaining(payload.remaining);
        setHoleSize(payload.holeSize);
        setElapsed(payload.elapsed);
        setDebugInput(payload.debug);
      };
      const onFinish = (payload: FinishPayload) => {
        if (cancelled) return;
        setScore(payload.score);
        setRemaining(0);
        setElapsed(payload.elapsed);
        if (payload.score > best) {
          setBest(payload.score);
          setStoredData(STORAGE_KEY, payload.score);
        }
        setPhase("FINISHED");
      };

      class HoleScene extends PhaserLib.Scene {
        private mode: Mode = selectedMode;
        private density = selectedDensity;
        private onStats: (payload: StatsPayload) => void = onStats;
        private onFinish: (payload: FinishPayload) => void = onFinish;

        private pieces: ScenePiece[] = [];
        private scoreCount = 0;
        private startMs = 0;
        private lastSwallowMs = 0;
        private assistLevel = 0;
        private lastUi = 0;
        private completed = false;

        private worldWidth = 0;
        private worldHeight = 0;
        private camTargetX = 0;
        private camTargetY = 0;
        private lastHoleWorldX = 0;
        private lastHoleWorldY = 0;
        private inputX = 0;
        private inputY = 0;
        private isTouchDevice = false;
        private touchActive = false;
        private touchStartX = 0;
        private touchStartY = 0;
        private touchVecX = 0;
        private touchVecY = 0;
        private cursorKeys?: PhaserType.Types.Input.Keyboard.CursorKeys;
        private wasdKeys?: {
          W: PhaserType.Input.Keyboard.Key;
          A: PhaserType.Input.Keyboard.Key;
          S: PhaserType.Input.Keyboard.Key;
          D: PhaserType.Input.Keyboard.Key;
        };
        private touchBase?: PhaserType.GameObjects.Ellipse;
        private touchKnob?: PhaserType.GameObjects.Ellipse;
        private holeRadius = BASE_RADIUS;
        private worldLayer!: PhaserType.GameObjects.Container;
        private pieceLayer!: PhaserType.GameObjects.Container;
        private worldTiltY = 0.8;

        private holeShadow!: PhaserType.GameObjects.Ellipse;
        private holeCore!: PhaserType.GameObjects.Ellipse;
        private holeRim!: PhaserType.GameObjects.Ellipse;

        private ensureCitySpriteTextures() {
          const mk = (
            key: string,
            w: number,
            h: number,
            painter: (g: PhaserType.GameObjects.Graphics) => void,
          ) => {
            if (this.textures.exists(key)) return;
            const g = this.add.graphics();
            painter(g);
            g.generateTexture(key, w, h);
            g.destroy();
          };

          mk("city-building-a", 64, 64, (g) => {
            g.fillStyle(0x64748b, 1).fillRoundedRect(8, 8, 48, 48, 6);
            g.fillStyle(0x94a3b8, 1).fillRect(12, 12, 40, 8);
            g.fillStyle(0xe2e8f0, 0.8);
            for (let y = 24; y <= 46; y += 10) {
              for (let x = 16; x <= 44; x += 10) {
                g.fillRect(x, y, 5, 5);
              }
            }
          });

          mk("city-building-b", 64, 64, (g) => {
            g.fillStyle(0x475569, 1).fillRoundedRect(10, 6, 44, 52, 5);
            g.fillStyle(0xcbd5e1, 0.9).fillRect(14, 10, 36, 6);
            g.fillStyle(0xe2e8f0, 0.86);
            for (let y = 20; y <= 50; y += 8) {
              g.fillRect(18, y, 5, 4);
              g.fillRect(29, y, 5, 4);
              g.fillRect(40, y, 5, 4);
            }
          });

          mk("city-building-c", 64, 64, (g) => {
            g.fillStyle(0x334155, 1).fillRoundedRect(8, 12, 48, 44, 4);
            g.fillStyle(0x94a3b8, 1).fillRect(12, 8, 40, 7);
            g.fillStyle(0xdbeafe, 0.84);
            for (let x = 14; x <= 46; x += 8) {
              g.fillRect(x, 22, 4, 26);
            }
            g.fillStyle(0x111827, 0.18).fillRect(10, 48, 44, 6);
          });

          mk("city-car", 64, 32, (g) => {
            g.fillStyle(0xef4444, 1).fillRoundedRect(6, 10, 52, 14, 6);
            g.fillStyle(0xdbeafe, 0.95).fillRoundedRect(18, 12, 20, 8, 3);
            g.fillStyle(0x111827, 1)
              .fillCircle(16, 24, 4)
              .fillCircle(48, 24, 4);
          });

          mk("city-tree", 48, 64, (g) => {
            g.fillStyle(0x7c5a3a, 1).fillRect(22, 32, 4, 22);
            g.fillStyle(0x22c55e, 1).fillCircle(24, 22, 14);
            g.fillStyle(0x16a34a, 0.9)
              .fillCircle(17, 26, 10)
              .fillCircle(31, 26, 10);
          });

          mk("city-food", 48, 48, (g) => {
            g.fillStyle(0xf97316, 1).fillCircle(24, 24, 14);
            g.fillStyle(0x84cc16, 1).fillCircle(24, 12, 5);
          });

          mk("city-crate", 48, 48, (g) => {
            g.fillStyle(0xa16207, 1).fillRoundedRect(8, 8, 32, 32, 4);
            g.lineStyle(3, 0xf59e0b, 0.8)
              .lineBetween(12, 12, 36, 36)
              .lineBetween(36, 12, 12, 36);
          });
        }

        private buildPieces(spawnPoints: SpawnPoint[]) {
          this.pieces.forEach((p) => {
            this.matter.world.remove(p.body);
            p.container.destroy();
          });
          this.pieces = spawnPoints.map((pt) => {
            const kind = kindForPropType(pt.propType);
            const pieceVisual = this.makePiece(
              pt.x,
              pt.y,
              pt.size,
              kind,
              propColor(pt.propType),
              pt.propType,
            );
            return {
              container: pieceVisual.container,
              lockRing: pieceVisual.lockRing,
              body: pieceVisual.body,
              size: pt.size,
              minHoleRadius: pt.minHoleRadius,
              kind,
              propType: pt.propType,
              baseX: pt.x,
              baseY: pt.y,
              wobble: Math.random() * 5,
              rotSpeed: (Math.random() - 0.5) * 2,
              captured: false,
              depth: 0,
              lipCatchMs: 0,
              lipCatchTotalMs: 0,
              jamNudgeCooldownMs: 0,
            };
          });
        }

        create() {
          const width = this.scale.width;
          const height = this.scale.height;
          this.worldWidth = Math.max(Math.floor(width * 4.8), 3600);
          this.worldHeight = Math.max(Math.floor(height * 4.2), 2800);

          const cam = this.cameras.main;
          cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
          cam.setZoom(1.22);

          this.startMs = this.time.now;
          this.lastSwallowMs = this.startMs;
          this.assistLevel = 0;
          this.isTouchDevice = this.sys.game.device.input.touch;
          this.inputX = width * 0.5;
          this.inputY = height * 0.5;
          this.camTargetX = this.worldWidth * 0.5;
          this.camTargetY = this.worldHeight * 0.52;
          cam.centerOn(this.camTargetX, this.camTargetY);
          this.lastHoleWorldX = this.camTargetX;
          this.lastHoleWorldY = this.camTargetY;

          this.cursorKeys = this.input.keyboard?.createCursorKeys();
          this.wasdKeys = this.input.keyboard?.addKeys(
            "W,A,S,D",
          ) as HoleScene["wasdKeys"];
          this.input.keyboard?.addCapture([
            PhaserLib.Input.Keyboard.KeyCodes.UP,
            PhaserLib.Input.Keyboard.KeyCodes.DOWN,
            PhaserLib.Input.Keyboard.KeyCodes.LEFT,
            PhaserLib.Input.Keyboard.KeyCodes.RIGHT,
            PhaserLib.Input.Keyboard.KeyCodes.W,
            PhaserLib.Input.Keyboard.KeyCodes.A,
            PhaserLib.Input.Keyboard.KeyCodes.S,
            PhaserLib.Input.Keyboard.KeyCodes.D,
          ]);

          this.worldLayer = this.add.container(0, 0);
          this.worldLayer.setScale(1, this.worldTiltY);
          this.worldLayer.setDepth(20);

          this.pieceLayer = this.add.container(0, 0);
          this.pieceLayer.setScale(1, this.worldTiltY);
          this.pieceLayer.setDepth(40);

          // Keep playable layouts inside the area the centered hole can actually reach.
          const layoutPad = 34;
          const reachMinX = width * 0.5 + layoutPad;
          const reachMaxX = this.worldWidth - width * 0.5 - layoutPad;
          const reachMinY = height * 0.5 + layoutPad;
          const reachMaxY = this.worldHeight - height * 0.5 - layoutPad;
          const reachW = Math.max(240, reachMaxX - reachMinX);
          const reachH = Math.max(220, reachMaxY - reachMinY);

          const island: IslandArea = {
            cx: reachMinX + reachW * 0.5,
            cy: reachMinY + reachH * 0.52,
            rx: Math.max(140, reachW * 0.47),
            ry: Math.max(120, reachH * 0.43),
          };

          const city: CityArea = {
            x: reachMinX + reachW * 0.06,
            y: reachMinY + reachH * 0.08,
            width: reachW * 0.88,
            height: reachH * 0.82,
          };

          const ocean = this.add.rectangle(
            this.worldWidth / 2,
            this.worldHeight / 2,
            this.worldWidth,
            this.worldHeight,
            0x0a3854,
            1,
          );
          ocean.setDepth(-10);

          // Strong world-space guides in the water so motion is easy to perceive.
          for (let x = 0; x < this.worldWidth; x += 80) {
            this.worldLayer.add(
              this.add.rectangle(
                x,
                this.worldHeight / 2,
                2,
                this.worldHeight,
                0x7dd3fc,
                x % 320 === 0 ? 0.2 : 0.1,
              ),
            );
          }
          for (let y = 0; y < this.worldHeight; y += 80) {
            this.worldLayer.add(
              this.add.rectangle(
                this.worldWidth / 2,
                y,
                this.worldWidth,
                2,
                0x7dd3fc,
                y % 320 === 0 ? 0.2 : 0.1,
              ),
            );
          }

          if (this.mode === "STACKS") {
            this.ensureCitySpriteTextures();
            const cityPad = 22;
            const cityBase = this.add.rectangle(
              city.x + city.width / 2,
              city.y + city.height / 2,
              city.width,
              city.height,
              0x334155,
              0.96,
            );
            this.worldLayer.add(cityBase);

            for (
              let x = city.x + cityPad;
              x < city.x + city.width - cityPad;
              x += 120
            ) {
              this.worldLayer.add(
                this.add.rectangle(
                  x,
                  city.y + city.height / 2,
                  22,
                  city.height - cityPad * 2,
                  0x111827,
                  0.85,
                ),
              );
            }
            for (
              let y = city.y + cityPad;
              y < city.y + city.height - cityPad;
              y += 120
            ) {
              this.worldLayer.add(
                this.add.rectangle(
                  city.x + city.width / 2,
                  y,
                  city.width - cityPad * 2,
                  22,
                  0x111827,
                  0.85,
                ),
              );
            }

            for (
              let x = city.x + cityPad;
              x < city.x + city.width - cityPad;
              x += 24
            ) {
              this.worldLayer.add(
                this.add.rectangle(
                  x,
                  city.y + city.height / 2,
                  1,
                  city.height - cityPad * 2,
                  0x93c5fd,
                  0.08,
                ),
              );
            }
            for (
              let y = city.y + cityPad;
              y < city.y + city.height - cityPad;
              y += 24
            ) {
              this.worldLayer.add(
                this.add.rectangle(
                  city.x + city.width / 2,
                  y,
                  city.width - cityPad * 2,
                  1,
                  0x93c5fd,
                  0.08,
                ),
              );
            }
          } else {
            const ground = this.add.rectangle(
              island.cx,
              island.cy,
              island.rx * 2,
              island.ry * 2,
              0x1f5e2c,
              0.95,
            );
            const beach = this.add.ellipse(
              island.cx,
              island.cy,
              island.rx * 2.08,
              island.ry * 2.06,
              0xd1a663,
              0.42,
            );
            const islandEdge = this.add.ellipse(
              island.cx,
              island.cy,
              island.rx * 2.02,
              island.ry * 2.0,
              0xc9f5b8,
              0.12,
            );
            this.worldLayer.add(beach);
            this.worldLayer.add(ground);
            this.worldLayer.add(islandEdge);

            const minX = island.cx - island.rx;
            const maxX = island.cx + island.rx;
            const minY = island.cy - island.ry;
            const maxY = island.cy + island.ry;

            for (let x = minX; x < maxX; x += 28) {
              const major = Math.abs((x - minX) % 112) < 0.5;
              this.worldLayer.add(
                this.add.rectangle(
                  x,
                  island.cy,
                  major ? 2 : 1,
                  island.ry * 2,
                  major ? 0xb7f4d0 : 0xd6f7be,
                  major ? 0.2 : 0.11,
                ),
              );
            }

            for (let y = minY; y < maxY; y += 28) {
              const major = Math.abs((y - minY) % 112) < 0.5;
              this.worldLayer.add(
                this.add.rectangle(
                  island.cx,
                  y,
                  island.rx * 2,
                  major ? 2 : 1,
                  major ? 0xb7f4d0 : 0xd6f7be,
                  major ? 0.18 : 0.1,
                ),
              );
            }
          }

          this.holeShadow = this.add.ellipse(
            width * 0.5,
            height * 0.5 + 10,
            this.holeRadius * 2.2,
            this.holeRadius * 0.9,
            0x000000,
            0.24,
          );
          this.holeShadow.setScrollFactor(0);
          this.holeShadow.setDepth(30);
          this.holeRim = this.add.ellipse(
            width * 0.5,
            height * 0.5,
            this.holeRadius * 2.02,
            this.holeRadius * 1.56,
            0x7ed1ff,
            0.2,
          );
          this.holeRim.setScrollFactor(0);
          this.holeRim.setDepth(31);
          this.holeCore = this.add.ellipse(
            width * 0.5,
            height * 0.5 + 1,
            this.holeRadius * 1.92,
            this.holeRadius * 1.4,
            0x000000,
            0.98,
          );
          this.holeCore.setScrollFactor(0);
          this.holeCore.setDepth(32);

          this.touchBase = this.add.ellipse(0, 0, 72, 72, 0xb6efff, 0.24);
          this.touchBase.setScrollFactor(0);
          this.touchBase.setVisible(false);

          this.touchKnob = this.add.ellipse(0, 0, 34, 34, 0xe8fbff, 0.8);
          this.touchKnob.setStrokeStyle(2, 0x74c9ff, 0.9);
          this.touchKnob.setScrollFactor(0);
          this.touchKnob.setVisible(false);

          const fallbackSpawnPoints =
            this.mode === "STACKS"
              ? citySpawnPoints(
                  this.worldWidth,
                  this.worldHeight,
                  this.density,
                  city,
                )
              : shapeSpawnPoints(
                  this.worldWidth,
                  this.worldHeight,
                  this.density,
                  island,
                );
          this.buildPieces(fallbackSpawnPoints);

          const worldName =
            this.mode === "STACKS" ? "city-demo" : "island-demo";
          void fetch(`/assets/hole/worlds/${worldName}.json`)
            .then((res) => (res.ok ? res.json() : null))
            .then((world: WorldFile | null) => {
              if (this.mode === "STACKS") {
                // STACKS now uses procedural city generation for per-run randomness.
                return;
              }
              if (
                !world ||
                !Array.isArray(world.props) ||
                world.props.length === 0
              ) {
                return;
              }
              const fromWorld = worldPropsToSpawnPoints(
                world,
                island,
                this.worldWidth,
                this.worldHeight,
              );
              const densityAdjusted = withDensityVariance(
                fromWorld,
                this.density,
                this.worldWidth,
                this.worldHeight,
              );
              if (densityAdjusted.length > 0) {
                this.buildPieces(densityAdjusted);
                this.onStats({
                  score: this.scoreCount,
                  remaining: densityAdjusted.length,
                  holeSize: Math.round(this.holeRadius),
                  elapsed: Math.round((this.time.now - this.startMs) / 1000),
                });
              }
            })
            .catch(() => {
              // Keep fallback-generated props if map JSON fails to load.
            });

          this.onStats({
            score: 0,
            remaining: this.pieces.length,
            holeSize: BASE_RADIUS,
            elapsed: 0,
            debug: {
              nx: 0,
              ny: 0,
              keyInput: false,
              dragInput: false,
              touchDevice: this.isTouchDevice,
            },
          });

          this.input.on("pointerdown", (pointer: PhaserType.Input.Pointer) => {
            this.touchActive = true;
            this.touchStartX = pointer.x;
            this.touchStartY = pointer.y;
            this.touchVecX = 0;
            this.touchVecY = 0;
            if (this.isTouchDevice) {
              this.touchBase
                ?.setPosition(pointer.x, pointer.y)
                .setVisible(true);
              this.touchKnob
                ?.setPosition(pointer.x, pointer.y)
                .setVisible(true);
            }
          });

          this.input.on("pointermove", (pointer: PhaserType.Input.Pointer) => {
            if (!this.touchActive || !pointer.isDown) return;
            const dx = pointer.x - this.touchStartX;
            const dy = pointer.y - this.touchStartY;
            const len = Math.hypot(dx, dy);
            const maxLen = 68;
            const norm = len > 0 ? Math.min(1, maxLen / len) : 0;
            const clampedX = dx * norm;
            const clampedY = dy * norm;

            this.touchVecX = maxLen > 0 ? clampedX / maxLen : 0;
            this.touchVecY = maxLen > 0 ? clampedY / maxLen : 0;
            if (this.isTouchDevice) {
              this.touchKnob?.setPosition(
                this.touchStartX + clampedX,
                this.touchStartY + clampedY,
              );
            }
          });

          this.input.on("pointerup", () => {
            this.touchActive = false;
            this.touchVecX = 0;
            this.touchVecY = 0;
            if (this.isTouchDevice) {
              this.touchBase?.setVisible(false);
              this.touchKnob?.setVisible(false);
            }
          });

          this.scale.on("resize", () => {
            this.holeShadow.x = this.scale.width * 0.5;
            this.holeShadow.y = this.scale.height * 0.5 + 10;
            this.holeRim.x = this.scale.width * 0.5;
            this.holeRim.y = this.scale.height * 0.5;
            this.holeCore.x = this.scale.width * 0.5;
            this.holeCore.y = this.scale.height * 0.5 + 1;
          });
        }

        private makePiece(
          x: number,
          y: number,
          size: number,
          kind: PieceKind,
          hex: string,
          propType: PropType,
        ) {
          const densityByType =
            propType === "car"
              ? 0.00075
              : propType === "food"
                ? 0.00065
                : propType === "crate"
                  ? 0.00105
                  : propType === "tree"
                    ? 0.0012
                    : 0.0019;
          const body = this.matter.add.circle(x, y, Math.max(8, size * 0.34), {
            isStatic: false,
            density: densityByType,
            frictionAir: 0.12,
            friction: 0.24,
            restitution: 0.08,
          });

          if (this.mode === "STACKS") {
            const lockRing = this.add.ellipse(
              0,
              -size * 0.1,
              size * 0.98,
              size * 0.68,
              0xff6b6b,
              0.2,
            );
            lockRing.setStrokeStyle(Math.max(1, size * 0.04), 0xff8a8a, 0.95);
            lockRing.setVisible(false);

            const shadow = this.add.ellipse(
              0,
              size * 0.38,
              size * 0.98,
              size * 0.44,
              0x000000,
              0.2,
            );

            const key =
              propType === "building"
                ? pick([
                    "city-building-a",
                    "city-building-b",
                    "city-building-c",
                  ])
                : `city-${propType}`;
            const sprite = this.textures.exists(key)
              ? this.add.image(0, -size * 0.06, key)
              : this.add.rectangle(
                  0,
                  -size * 0.06,
                  size * 0.88,
                  size * 0.7,
                  0x94a3b8,
                  0.98,
                );

            if ("setDisplaySize" in sprite) {
              if (propType === "building") {
                const widthScale = 0.68 + Math.random() * 0.66;
                const heightScale = 0.88 + Math.random() * 1.0;
                sprite.setDisplaySize(size * widthScale, size * heightScale);

                if (sprite instanceof PhaserLib.GameObjects.Image) {
                  sprite.setTint(
                    pick([0x9ca3af, 0x94a3b8, 0x64748b, 0x6b7280, 0xa3a3a3]),
                  );
                } else if (sprite instanceof PhaserLib.GameObjects.Rectangle) {
                  sprite.setFillStyle(
                    pick([0x8f9ca8, 0x8a98a5, 0x74808c, 0x9aa4af]),
                    0.98,
                  );
                }
              } else if (propType === "car") {
                sprite.setDisplaySize(size * 1.02, size * 0.56);
              } else if (propType === "tree") {
                sprite.setDisplaySize(size * 0.82, size * 1.0);
              } else {
                sprite.setDisplaySize(size * 0.8, size * 0.8);
              }
            }

            const c = this.add.container(x, y, [shadow, sprite, lockRing]);
            this.pieceLayer.add(c);
            c.setDepth(y);
            return { container: c, lockRing, body };
          }

          const color = shadeHex(hex, 10);
          const darker = shadeHex(hex, -40);
          const rim = shadeHex(hex, 55);

          const shadow = this.add.ellipse(
            0,
            size * 0.45,
            size * 0.95,
            size * 0.42,
            0x000000,
            0.2,
          );
          let side: PhaserType.GameObjects.Shape;
          let top: PhaserType.GameObjects.Shape;

          if (kind === "cylinder") {
            side = this.add.ellipse(
              0,
              size * 0.1,
              size * 0.92,
              size * 0.74,
              darker,
              0.98,
            );
            top = this.add.ellipse(
              0,
              -size * 0.12,
              size * 0.88,
              size * 0.56,
              color,
              1,
            );
          } else if (kind === "diamond") {
            side = this.add.polygon(
              0,
              size * 0.08,
              [
                0,
                -size * 0.28,
                size * 0.44,
                0,
                0,
                size * 0.46,
                -size * 0.44,
                0,
              ],
              darker,
              0.98,
            );
            top = this.add.polygon(
              0,
              -size * 0.12,
              [0, -size * 0.26, size * 0.4, 0, 0, size * 0.42, -size * 0.4, 0],
              color,
              1,
            );
          } else {
            side = this.add.rectangle(
              0,
              size * 0.16,
              size * 0.9,
              size * 0.7,
              darker,
              1,
            );
            top = this.add.rectangle(
              0,
              -size * 0.08,
              size * 0.84,
              size * 0.62,
              color,
              1,
            );
          }

          top.setStrokeStyle(Math.max(1, size * 0.045), rim, 0.75);

          if (propType === "car") {
            const windshield = this.add.rectangle(
              0,
              -size * 0.18,
              size * 0.34,
              size * 0.18,
              0xe2f3ff,
              0.9,
            );
            const lockRing = this.add.ellipse(
              0,
              -size * 0.1,
              size * 0.98,
              size * 0.68,
              0xff6b6b,
              0.2,
            );
            lockRing.setStrokeStyle(Math.max(1, size * 0.04), 0xff8a8a, 0.95);
            lockRing.setVisible(false);
            const c = this.add.container(x, y, [
              shadow,
              side,
              top,
              windshield,
              lockRing,
            ]);
            this.pieceLayer.add(c);
            c.setDepth(y);
            return { container: c, lockRing, body };
          }

          if (propType === "tree") {
            const crown = this.add.ellipse(
              0,
              -size * 0.38,
              size * 0.72,
              size * 0.5,
              0x22c55e,
              0.96,
            );
            const lockRing = this.add.ellipse(
              0,
              -size * 0.1,
              size * 0.98,
              size * 0.68,
              0xff6b6b,
              0.2,
            );
            lockRing.setStrokeStyle(Math.max(1, size * 0.04), 0xff8a8a, 0.95);
            lockRing.setVisible(false);
            const c = this.add.container(x, y, [
              shadow,
              side,
              top,
              crown,
              lockRing,
            ]);
            this.pieceLayer.add(c);
            c.setDepth(y);
            return { container: c, lockRing, body };
          }

          const lockRing = this.add.ellipse(
            0,
            -size * 0.1,
            size * 0.98,
            size * 0.68,
            0xff6b6b,
            0.2,
          );
          lockRing.setStrokeStyle(Math.max(1, size * 0.04), 0xff8a8a, 0.95);
          lockRing.setVisible(false);

          const c = this.add.container(x, y, [shadow, side, top, lockRing]);
          this.pieceLayer.add(c);
          c.setDepth(y);
          return { container: c, lockRing, body };
        }

        update(_time: number, deltaMs: number) {
          if (this.completed) return;

          const cam = this.cameras.main;
          const viewCenterX = this.scale.width * 0.5;
          const viewCenterY = this.scale.height * 0.5;

          const dt = Math.min(deltaMs / 1000, 0.042);
          const keyLeft =
            !!this.cursorKeys?.left?.isDown || !!this.wasdKeys?.A?.isDown;
          const keyRight =
            !!this.cursorKeys?.right?.isDown || !!this.wasdKeys?.D?.isDown;
          const keyUp =
            !!this.cursorKeys?.up?.isDown || !!this.wasdKeys?.W?.isDown;
          const keyDown =
            !!this.cursorKeys?.down?.isDown || !!this.wasdKeys?.S?.isDown;
          const hasKeyInput = keyLeft || keyRight || keyUp || keyDown;

          let nx = 0;
          let ny = 0;

          if (keyLeft) nx -= 1;
          if (keyRight) nx += 1;
          if (keyUp) ny -= 1;
          if (keyDown) ny += 1;

          if (nx === 0 && ny === 0 && this.touchActive) {
            nx = this.touchVecX;
            ny = this.touchVecY;
          }

          const hasDragInput =
            this.touchActive &&
            (Math.abs(this.touchVecX) > 0.01 ||
              Math.abs(this.touchVecY) > 0.01);

          if (nx !== 0 || ny !== 0) {
            const mag = Math.hypot(nx, ny);
            nx /= mag;
            ny /= mag;
          }

          // Hole.io style zoom: close when small, wider view as the hole grows.
          const growthT = clamp(
            (this.holeRadius - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS),
            0,
            1,
          );
          const targetZoom = 1.22 - growthT * 0.52;
          cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 3.6);

          const travelSpeed = 520 + this.holeRadius * 1.35;
          this.camTargetX += nx * travelSpeed * dt;
          this.camTargetY += ny * travelSpeed * dt * 0.82;

          const halfW = (this.scale.width * 0.5) / cam.zoom;
          const halfH = (this.scale.height * 0.5) / cam.zoom;
          this.camTargetX = clamp(
            this.camTargetX,
            halfW,
            this.worldWidth - halfW,
          );
          this.camTargetY = clamp(
            this.camTargetY,
            halfH,
            this.worldHeight - halfH,
          );

          cam.scrollX +=
            (this.camTargetX - (cam.scrollX + halfW)) * Math.min(1, dt * 7.2);
          cam.scrollY +=
            (this.camTargetY - (cam.scrollY + halfH)) * Math.min(1, dt * 7.2);

          const holeRenderX = cam.scrollX + viewCenterX;
          const holeRenderY = cam.scrollY + viewCenterY;
          const holeWorldYBase = (holeRenderY + 34) / this.worldTiltY;
          const holeVelX =
            (holeRenderX - this.lastHoleWorldX) / Math.max(dt, 0.001);
          const holeVelY =
            (holeWorldYBase - this.lastHoleWorldY) / Math.max(dt, 0.001);
          const holeSpeed = Math.hypot(holeVelX, holeVelY);
          const holeMoveNX = holeSpeed > 0.001 ? holeVelX / holeSpeed : 0;
          const holeMoveNY = holeSpeed > 0.001 ? holeVelY / holeSpeed : 0;

          // Invisible adaptive assist: ramps in after sustained no-swallow streaks.
          const noSwallowMs = this.time.now - this.lastSwallowMs;
          const assistTarget = clamp((noSwallowMs - 11000) / 9000, 0, 1);
          this.assistLevel +=
            (assistTarget - this.assistLevel) * Math.min(1, dt * 2.1);
          const activeCaptureCount = this.pieces.reduce(
            (n, p) => n + (p.captured ? 1 : 0),
            0,
          );

          let swallowedNow = 0;
          const survivors: ScenePiece[] = [];

          for (const piece of this.pieces) {
            if (!piece.captured) {
              this.matter.body.setStatic(piece.body, false);

              // Soft anchor toward spawn point so pieces can still jostle each other.
              const toBaseX = piece.baseX - piece.body.position.x;
              const toBaseY = piece.baseY - piece.body.position.y;
              const springK =
                0.000028 + Math.min(0.000032, piece.size / 240000);
              this.matter.body.applyForce(piece.body, piece.body.position, {
                x: toBaseX * springK,
                y: toBaseY * springK,
              });
              this.matter.body.setVelocity(piece.body, {
                x: piece.body.velocity.x * 0.92,
                y: piece.body.velocity.y * 0.92,
              });
              this.matter.body.setAngularVelocity(
                piece.body,
                piece.body.angularVelocity * 0.45,
              );
              piece.jamNudgeCooldownMs = Math.max(
                0,
                piece.jamNudgeCooldownMs - deltaMs,
              );

              piece.container.x = piece.body.position.x;
              piece.container.y = piece.body.position.y;
              piece.container.rotation = piece.body.angle * 0.42;
              piece.container.setDepth(piece.container.y);

              const pieceRenderX = piece.container.x;
              const pieceRenderY = piece.container.y * this.worldTiltY;
              const dx = pieceRenderX - holeRenderX;
              const dy = pieceRenderY - holeRenderY;
              const dist = Math.hypot(dx, dy);
              const assistedHoleRadius =
                this.holeRadius + this.assistLevel * 12;
              const captureRadius = Math.max(
                11,
                this.holeRadius * 0.82 -
                  piece.size * 0.18 +
                  this.assistLevel * 8,
              );
              const canSwallowBySize =
                assistedHoleRadius >= piece.minHoleRadius;
              const baseMobility =
                piece.propType === "car"
                  ? 1.55
                  : piece.propType === "food"
                    ? 1.22
                    : piece.propType === "crate"
                      ? 0.98
                      : piece.propType === "tree"
                        ? 0.86
                        : 0.62;
              const sizeMobility = clamp(
                42 / Math.max(12, piece.size),
                0.46,
                1.34,
              );
              const mobility = baseMobility * sizeMobility;
              piece.container.alpha = canSwallowBySize
                ? 1
                : 0.56 + this.assistLevel * 0.16;
              piece.lockRing.setVisible(!canSwallowBySize);

              // Hole.io-like rim influence: nearby crowd gets stirred and pushed.
              const toHoleWX = holeRenderX - piece.body.position.x;
              const toHoleWY = holeWorldYBase - piece.body.position.y;
              const distWorld = Math.max(1, Math.hypot(toHoleWX, toHoleWY));
              const nearRadius = this.holeRadius * 2.35 + piece.size * 0.8;
              if (distWorld < nearRadius) {
                const nX = toHoleWX / distWorld;
                const nY = toHoleWY / distWorld;
                const tX = -nY;
                const tY = nX;
                const nearFactor = 1 - distWorld / nearRadius;
                if (canSwallowBySize) {
                  const swirlSign = piece.wobble > 2.5 ? 1 : -1;
                  const crowdBoost = 1 + activeCaptureCount * 0.11;
                  this.matter.body.applyForce(piece.body, piece.body.position, {
                    x:
                      (nX * 0.000038 + tX * 0.000018 * swirlSign) *
                      nearFactor *
                      crowdBoost *
                      mobility,
                    y:
                      (nY * 0.000038 + tY * 0.000018 * swirlSign) *
                      nearFactor *
                      crowdBoost *
                      mobility,
                  });
                } else if (distWorld < nearRadius * 0.72) {
                  this.matter.body.applyForce(piece.body, piece.body.position, {
                    x: -nX * 0.000045 * nearFactor * mobility,
                    y: -nY * 0.000045 * nearFactor * mobility,
                  });
                }
              }

              // Traffic-jam release: fast hole movement nudges slow pieces near the rim.
              if (
                holeSpeed > 135 &&
                distWorld < nearRadius * 0.96 &&
                !piece.captured &&
                piece.jamNudgeCooldownMs <= 0
              ) {
                const pieceSpeed = Math.hypot(
                  piece.body.velocity.x,
                  piece.body.velocity.y,
                );
                if (
                  pieceSpeed <
                  1.25 + (piece.propType === "building" ? 0.2 : 0)
                ) {
                  const movePower =
                    (0.26 + clamp((holeSpeed - 135) / 420, 0, 1) * 0.42) *
                    mobility;
                  const slideX = -holeMoveNY;
                  const slideY = holeMoveNX;
                  this.matter.body.setVelocity(piece.body, {
                    x:
                      piece.body.velocity.x +
                      holeMoveNX * movePower +
                      slideX * movePower * 0.35,
                    y:
                      piece.body.velocity.y +
                      holeMoveNY * movePower +
                      slideY * movePower * 0.35,
                  });
                  piece.jamNudgeCooldownMs = 120 + Math.random() * 140;
                }
              }

              if (dist <= captureRadius && canSwallowBySize) {
                piece.captured = true;
                piece.lockRing.setVisible(false);
                this.lastSwallowMs = this.time.now;
                const lipCatchMs =
                  piece.size >= 26
                    ? 130 + Math.random() * Math.min(170, piece.size * 2.4)
                    : 0;
                piece.lipCatchMs = lipCatchMs;
                piece.lipCatchTotalMs = lipCatchMs;
                this.matter.body.setStatic(piece.body, false);
                const holeWorldY = (holeRenderY + 34) / this.worldTiltY;
                const capToHoleX = holeRenderX - piece.baseX;
                const capToHoleY = holeWorldY - piece.baseY;
                const capDist = Math.max(1, Math.hypot(capToHoleX, capToHoleY));
                const capDirX = capToHoleX / capDist;
                const capDirY = capToHoleY / capDist;
                this.matter.body.setVelocity(piece.body, {
                  x: capDirX * 0.8 + (Math.random() - 0.5) * 0.2,
                  y: capDirY * 0.8 + (Math.random() - 0.5) * 0.2,
                });
                const captureTargetAngle =
                  Math.atan2(capDirY, capDirX) + Math.PI / 2;
                const captureDelta = Math.atan2(
                  Math.sin(captureTargetAngle - piece.body.angle),
                  Math.cos(captureTargetAngle - piece.body.angle),
                );
                this.matter.body.setAngularVelocity(
                  piece.body,
                  captureDelta * 0.22,
                );

                // Crowd shock: nearby pieces get nudged when multiple captures happen.
                const shockRadius = Math.max(44, piece.size * 2.8);
                for (const other of this.pieces) {
                  if (other === piece || other.captured) continue;
                  const odx = other.body.position.x - piece.body.position.x;
                  const ody = other.body.position.y - piece.body.position.y;
                  const od = Math.hypot(odx, ody);
                  if (od < 1 || od > shockRadius) continue;
                  const otherBaseMobility =
                    other.propType === "car"
                      ? 1.5
                      : other.propType === "food"
                        ? 1.2
                        : other.propType === "crate"
                          ? 0.98
                          : other.propType === "tree"
                            ? 0.86
                            : 0.62;
                  const otherSizeMobility = clamp(
                    42 / Math.max(12, other.size),
                    0.46,
                    1.34,
                  );
                  const otherMobility = otherBaseMobility * otherSizeMobility;
                  const falloff = 1 - od / shockRadius;
                  const push =
                    0.18 *
                    falloff *
                    (1 + Math.min(2.2, activeCaptureCount * 0.22)) *
                    otherMobility;
                  this.matter.body.setVelocity(other.body, {
                    x: other.body.velocity.x + (odx / od) * push,
                    y: other.body.velocity.y + (ody / od) * push,
                  });
                }
              }
            } else {
              const holeWorldX = holeRenderX;
              const holeWorldY = holeWorldYBase;
              const bodyX = piece.body.position.x;
              const bodyY = piece.body.position.y;
              const toHoleX = holeWorldX - bodyX;
              const toHoleY = holeWorldY - bodyY;
              const distToHole = Math.max(1, Math.hypot(toHoleX, toHoleY));
              const dirX = toHoleX / distToHole;
              const dirY = toHoleY / distToHole;

              const rimRadius = this.holeRadius * 0.95;
              const rimPenetration = clamp(
                (rimRadius + piece.size * 0.34 - distToHole) /
                  Math.max(12, piece.size * 1.08),
                0,
                1,
              );
              const tipFactor = Math.pow(rimPenetration, 1.2);
              const lipActive = piece.lipCatchMs > 0;
              if (lipActive) {
                piece.lipCatchMs = Math.max(0, piece.lipCatchMs - deltaMs);
              }
              const lipRatio =
                piece.lipCatchTotalMs > 0
                  ? piece.lipCatchMs / piece.lipCatchTotalMs
                  : 0;
              const lipStrength = lipActive ? 1 - lipRatio : 1;

              piece.depth = Math.min(
                1,
                piece.depth +
                  dt *
                    (lipActive
                      ? 0.1 + tipFactor * 0.24 + lipStrength * 0.1
                      : 0.34 +
                        this.holeRadius / 520 +
                        tipFactor * 0.8 +
                        piece.depth * 0.42),
              );
              // Keep captured pieces above the hole so the sink animation is visible.
              piece.container.setDepth(3000 - piece.depth * 1000);

              // Use damped inward velocity to avoid shaking and read as falling into the hole.
              const tanX = -dirY;
              const tanY = dirX;
              if (lipActive) {
                const lipRadius = this.holeRadius * 0.88;
                const rimTargetX = holeWorldX - dirX * lipRadius;
                const rimTargetY = holeWorldY - dirY * lipRadius;
                const toRimX = rimTargetX - bodyX;
                const toRimY = rimTargetY - bodyY;
                const toRimDist = Math.max(1, Math.hypot(toRimX, toRimY));
                const rimDirX = toRimX / toRimDist;
                const rimDirY = toRimY / toRimDist;
                const tangentialSign = piece.wobble > 2.5 ? 1 : -1;
                const rimSpeed = 0.22 + lipStrength * 0.46;
                const tangentSpeed = 0.07 + lipStrength * 0.13;
                const lipBlend = 0.9;
                this.matter.body.setVelocity(piece.body, {
                  x:
                    piece.body.velocity.x * lipBlend +
                    (rimDirX * rimSpeed +
                      tanX * tangentSpeed * tangentialSign) *
                      (1 - lipBlend),
                  y:
                    piece.body.velocity.y * lipBlend +
                    (rimDirY * rimSpeed +
                      tanY * tangentSpeed * tangentialSign) *
                      (1 - lipBlend),
                });
              } else {
                const targetSpeed =
                  0.44 +
                  clamp(this.holeRadius / 300, 0.06, 0.46) +
                  tipFactor * 0.96 +
                  tipFactor * tipFactor * 0.6;
                const velBlend = 0.86 - tipFactor * 0.22;
                this.matter.body.setVelocity(piece.body, {
                  x:
                    piece.body.velocity.x * velBlend +
                    dirX * targetSpeed * (1 - velBlend),
                  y:
                    piece.body.velocity.y * velBlend +
                    dirY * targetSpeed * (1 - velBlend),
                });
              }

              const targetAngle = Math.atan2(dirY, dirX) + Math.PI / 2;
              const angleDelta = Math.atan2(
                Math.sin(targetAngle - piece.body.angle),
                Math.cos(targetAngle - piece.body.angle),
              );
              const alignStrength = lipActive
                ? clamp(0.18 + lipStrength * 0.34, 0.18, 0.52)
                : clamp(0.08 + tipFactor * 0.46, 0.08, 0.5);
              this.matter.body.setAngularVelocity(
                piece.body,
                piece.body.angularVelocity * (lipActive ? 0.34 : 0.42) +
                  angleDelta * alignStrength,
              );

              piece.container.x = piece.body.position.x;
              piece.container.y = piece.body.position.y;
              piece.container.rotation = piece.body.angle;
              const scale = 1 - piece.depth * 0.95;
              piece.container.setScale(scale);
              piece.container.alpha = 1 - piece.depth * 0.98;
            }

            if (piece.depth >= 1) {
              this.matter.world.remove(piece.body);
              piece.container.destroy();
              swallowedNow += 1;
            } else {
              survivors.push(piece);
            }
          }

          this.pieces = survivors;
          this.lastHoleWorldX = holeRenderX;
          this.lastHoleWorldY = holeWorldYBase;

          if (swallowedNow > 0) {
            this.scoreCount += swallowedNow;
            // Fade assist quickly after progress resumes.
            this.assistLevel *= 0.45;
            this.holeRadius = clamp(
              BASE_RADIUS + this.scoreCount * 0.68,
              BASE_RADIUS,
              MAX_RADIUS,
            );
          }

          this.holeShadow.x = viewCenterX;
          this.holeShadow.y = viewCenterY + 10;
          this.holeShadow.setDisplaySize(
            this.holeRadius * 2.24,
            this.holeRadius * 0.92,
          );

          this.holeRim.x = viewCenterX;
          this.holeRim.y = viewCenterY;
          this.holeRim.setDisplaySize(
            this.holeRadius * 2.08,
            this.holeRadius * 1.58,
          );

          this.holeCore.x = viewCenterX;
          this.holeCore.y = viewCenterY + 1;
          this.holeCore.setDisplaySize(
            this.holeRadius * 1.95,
            this.holeRadius * 1.42,
          );

          if (this.time.now - this.lastUi > 120 || swallowedNow > 0) {
            this.lastUi = this.time.now;
            this.onStats({
              score: this.scoreCount,
              remaining: this.pieces.length,
              holeSize: Math.round(this.holeRadius),
              elapsed: Math.round((this.time.now - this.startMs) / 1000),
              debug: {
                nx: Math.round(nx * 100) / 100,
                ny: Math.round(ny * 100) / 100,
                keyInput: hasKeyInput,
                dragInput: hasDragInput,
                touchDevice: this.isTouchDevice,
              },
            });
          }

          if (this.pieces.length === 0) {
            this.completed = true;
            this.onFinish({
              score: this.scoreCount,
              elapsed: Math.round((this.time.now - this.startMs) / 1000),
            });
          }
        }
      }

      const mount = mountRef.current;
      destroyGame();
      gameRef.current = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        width: mount.clientWidth,
        height: mount.clientHeight,
        parent: mount,
        transparent: true,
        backgroundColor: "#04101f",
        scale: {
          mode: PhaserLib.Scale.RESIZE,
          autoCenter: PhaserLib.Scale.CENTER_BOTH,
        },
        physics: {
          default: "matter",
          matter: {
            gravity: { x: 0, y: 0 },
          },
        },
        scene: [HoleScene],
      });
    };

    boot();

    return () => {
      cancelled = true;
      destroyGame();
    };
  }, [phase, mode, density, currentRunRef.current, best]);

  const modeLabel = mode === "STACKS" ? "Stacked Towers" : "Random Shapes";

  return (
    <Box className="hole-wrap">
      <Container maxWidth="md" sx={{ py: 1 }}>
        {phase !== "PLAYING" && (
          <Box className="hole-panel" sx={{ textAlign: "center", mb: 2 }}>
            <Box className="hole-panel-icon">
              <FontAwesomeIcon
                icon={phase === "FINISHED" ? faTrophy : faCircle}
              />
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                mb: 1,
                color: "#eef9ff",
                textShadow: "0 2px 12px rgba(125,211,252,0.3)",
              }}>
              Hole Drop
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "rgba(232,247,255,0.9)", mb: 3, lineHeight: 1.6 }}>
              Use arrow keys or WASD on desktop. On mobile, touch and drag like
              a joystick. Swallow everything to grow.
            </Typography>

            <Box className="hole-mode-toggle" sx={{ mb: 2 }}>
              <button
                className={`icon-btn ${mode === "STACKS" ? "hole-toggle-active" : ""}`}
                onClick={() => setMode("STACKS")}
                type="button">
                <FontAwesomeIcon icon={faLayerGroup} />
              </button>
              <button
                className={`icon-btn ${mode === "SHAPES" ? "hole-toggle-active" : ""}`}
                onClick={() => setMode("SHAPES")}
                type="button">
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </button>
            </Box>
            <Typography
              variant="caption"
              sx={{ display: "block", color: "rgba(173,220,242,0.95)", mb: 2 }}>
              Spawn mode: {modeLabel}
            </Typography>

            <Box sx={{ maxWidth: 360, mx: "auto", mb: 3 }}>
              <Typography
                variant="overline"
                sx={{ color: "rgba(218,242,255,0.92)", letterSpacing: 1.4 }}>
                Density: {density}
              </Typography>
              <input
                type="range"
                min={2}
                max={7}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
            </Box>

            {phase === "FINISHED" && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: "#f4fbff",
                    textShadow: "0 1px 8px rgba(255,255,255,0.22)",
                  }}>
                  Board Cleared in {elapsed}s
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(205,232,247,0.92)" }}>
                  Swallowed: {score} items | Best: {best}
                </Typography>
              </Box>
            )}

            <button
              className="btn"
              style={{ fontSize: "1.05rem", padding: "14px 40px" }}
              onClick={startRound}
              type="button">
              <FontAwesomeIcon
                icon={phase === "FINISHED" ? faRotate : faPlay}
              />{" "}
              {phase === "FINISHED" ? "Play Again" : "Start Round"}
            </button>
          </Box>
        )}

        <Box className="hole-hud">
          <Typography
            variant="body1"
            sx={{ fontWeight: 800, color: "#f3fbff" }}>
            Score: {score}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(216,241,255,0.95)", fontWeight: 600 }}>
            Left: {remaining}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(216,241,255,0.95)", fontWeight: 600 }}>
            Size: {holeSize}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(216,241,255,0.95)", fontWeight: 600 }}>
            Time: {elapsed}s
          </Typography>
          <Typography
            variant="caption"
            sx={{
              gridColumn: { xs: "1 / -1", sm: "1 / -1" },
              color: "#d6f2ff",
              fontWeight: 700,
              letterSpacing: 0.4,
              background: "rgba(7,26,44,0.72)",
              border: "1px solid rgba(125,211,252,0.35)",
              borderRadius: 99,
              py: 0.4,
              px: 1.2,
              justifySelf: "center",
            }}>
            Controls:{" "}
            {isTouchHint ? "Touch + drag joystick" : "Arrow keys / WASD"}
          </Typography>
        </Box>

        <Box ref={mountRef} className="hole-arena hole-game-mount" />
      </Container>
    </Box>
  );
}
