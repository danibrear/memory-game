// ─── Hole Drop: tuning + static data ──────────────────────────────────────────

/** Ground plane squash (camera tilt). 1 = straight down. */
export const TILT = 0.78;
/** How much world height lifts things up the screen. */
export const HK = 0.82;
/** Perspective lean per unit of height * zoom (tall things lean away from center). */
export const PERSP = 0.0005;
export const MAX_LEAN = 0.35;

/** City grid. Roads run every BLOCK units; each road is ROAD wide. */
export const BLOCK = 460;
export const ROAD = 92;
export const WALK = 20;

// ─── Growth ───────────────────────────────────────────────────────────────────

export const BASE_R = 22;
export const R_GROWTH = 1.25;
/** Mass needed to reach each size level (index 0 = size 1). */
export const LEVEL_MASS = [0, 20, 60, 150, 320, 640, 1200, 2200, 3800, 6500, 11000];
export const MAX_LEVEL = LEVEL_MASS.length;

const rAt = (i: number) => BASE_R * Math.pow(R_GROWTH, i);

export interface LevelInfo {
  level: number;
  progress: number;
  radius: number;
}

export function levelInfo(mass: number): LevelInfo {
  let i = 0;
  while (i < LEVEL_MASS.length - 1 && mass >= LEVEL_MASS[i + 1]) i++;
  if (i === LEVEL_MASS.length - 1) {
    const top = LEVEL_MASS[i];
    return { level: i + 1, progress: 1, radius: rAt(i) * Math.sqrt(Math.max(1, mass / top)) };
  }
  const lo = LEVEL_MASS[i];
  const hi = LEVEL_MASS[i + 1];
  const p = Math.min(1, Math.max(0, (mass - lo) / (hi - lo)));
  // Mostly discrete, like hole.io: a little creep inside a level, then a big jump on level-up.
  return { level: i + 1, progress: p, radius: rAt(i) + (rAt(i + 1) - rAt(i)) * p * 0.22 };
}

/** An object fits in a hole when its fit radius * FIT_MARGIN <= hole radius. */
export const FIT_MARGIN = 1.05;

// ─── Objects ──────────────────────────────────────────────────────────────────

export type Kind =
  | "person"
  | "cone"
  | "hydrant"
  | "trash"
  | "flower"
  | "ball"
  | "mailbox"
  | "bench"
  | "lamp"
  | "bush"
  | "umbrella"
  | "tree"
  | "pine"
  | "cart"
  | "car"
  | "bigtree"
  | "van"
  | "bus"
  | "house"
  | "fountain"
  | "shop"
  | "office"
  | "tower"
  | "skyscraper";

export interface KindSpec {
  w: number;
  d: number;
  h: number;
  /** Override for the fit radius (default derived from footprint). */
  fit?: number;
  value?: number;
  round?: boolean;
}

export const KINDS: Record<Kind, KindSpec> = {
  person: { w: 8, d: 8, h: 20, fit: 6, value: 1, round: true },
  cone: { w: 8, d: 8, h: 12, value: 1, round: true },
  hydrant: { w: 8, d: 8, h: 13, value: 1, round: true },
  trash: { w: 11, d: 11, h: 16, round: true },
  flower: { w: 11, d: 11, h: 14, round: true },
  ball: { w: 9, d: 9, h: 9, value: 1, round: true },
  mailbox: { w: 9, d: 9, h: 16 },
  bench: { w: 28, d: 10, h: 12 },
  lamp: { w: 8, d: 8, h: 52, fit: 9, value: 2, round: true },
  bush: { w: 20, d: 20, h: 16, round: true },
  umbrella: { w: 26, d: 26, h: 30, round: true },
  tree: { w: 30, d: 30, h: 58, round: true },
  pine: { w: 28, d: 28, h: 64, round: true },
  cart: { w: 34, d: 20, h: 32 },
  car: { w: 46, d: 24, h: 20 },
  bigtree: { w: 48, d: 48, h: 92, round: true },
  van: { w: 56, d: 28, h: 30 },
  bus: { w: 100, d: 32, h: 36 },
  house: { w: 76, d: 64, h: 48 },
  fountain: { w: 80, d: 80, h: 26, round: true },
  shop: { w: 110, d: 76, h: 66 },
  office: { w: 135, d: 125, h: 170 },
  tower: { w: 145, d: 145, h: 260 },
  skyscraper: { w: 150, d: 150, h: 380 },
};

export function fitFor(kind: Kind, w: number, d: number): number {
  const s = KINDS[kind];
  if (s.fit !== undefined) return s.fit;
  return Math.max(5, (Math.hypot(w, d) / 2) * 0.95);
}

export function valueFor(kind: Kind, fit: number, h: number): number {
  const s = KINDS[kind];
  if (s.value !== undefined) return s.value;
  return Math.max(1, Math.round((fit * fit * 0.6 + fit * h * 0.25) / 60));
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

export const CAR_COLORS = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#f97316", "#a855f7", "#f8fafc", "#ec4899", "#14b8a6"];
export const SHIRT_COLORS = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#f8fafc"];
export const SKIN_TONES = ["#f9d3b4", "#e8b48f", "#c68863", "#8d5a3b", "#5c3a24"];
export const HAIR_COLORS = ["#2b1d14", "#5a3a1e", "#a0652f", "#e5c07b", "#1f1f1f", "#b4472a"];
export const BUILDING_COLORS = ["#7dd3fc", "#fda4af", "#c4b5fd", "#fde68a", "#86efac", "#fdba74", "#a5f3fc", "#f9a8d4", "#e2e8f0"];
export const GLASS_COLORS = ["#38bdf8", "#22d3ee", "#818cf8", "#2dd4bf", "#60a5fa"];
export const HOUSE_WALLS = ["#fff7ed", "#fef3c7", "#e0f2fe", "#fce7f3", "#ecfccb", "#ede9fe"];
export const ROOF_COLORS = ["#ef4444", "#2563eb", "#9a3412", "#16a34a", "#7c3aed", "#0f766e"];
export const UMBRELLA_COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#ec4899"];

// ─── Holes, skins, rivals ─────────────────────────────────────────────────────

export interface Skin {
  id: string;
  name: string;
  color: string;
  rainbow?: boolean;
}

export const SKINS: Skin[] = [
  { id: "aqua", name: "Aqua", color: "#22d3ee" },
  { id: "pink", name: "Bubblegum", color: "#f472b6" },
  { id: "lime", name: "Lime", color: "#a3e635" },
  { id: "orange", name: "Tangerine", color: "#fb923c" },
  { id: "purple", name: "Grape", color: "#a78bfa" },
  { id: "yellow", name: "Sunny", color: "#facc15" },
  { id: "red", name: "Cherry", color: "#f87171" },
  { id: "blue", name: "Ocean", color: "#60a5fa" },
  { id: "rainbow", name: "Rainbow", color: "#ffffff", rainbow: true },
];

export const RIVAL_NAMES = [
  "Sir Gobbles",
  "Munchkin",
  "Turbo",
  "Pickle",
  "Nugget",
  "Waffles",
  "Sprinkles",
  "Jellybean",
  "Noodle",
  "Taco",
  "Captain Chomp",
  "Biscuit",
  "Zippy",
  "Meatball",
];

export const RIVAL_COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fb923c", "#a78bfa", "#facc15", "#f87171", "#60a5fa", "#34d399", "#e879f9"];

// ─── Modes ────────────────────────────────────────────────────────────────────

export type ModeId = "classic" | "solo" | "chill";

export interface ModeDef {
  id: ModeId;
  name: string;
  emoji: string;
  blurb: string;
  /** Seconds; 0 = no timer. */
  duration: number;
  rivals: number;
  blocks: number;
  respawnSmall: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  classic: {
    id: "classic",
    name: "Classic",
    emoji: "🏆",
    blurb: "Out-eat 7 other holes in 2 minutes!",
    duration: 120,
    rivals: 7,
    blocks: 8,
    respawnSmall: true,
  },
  solo: {
    id: "solo",
    name: "Solo",
    emoji: "⏱️",
    blurb: "Gobble as much of the city as you can in 2 minutes.",
    duration: 120,
    rivals: 0,
    blocks: 6,
    respawnSmall: false,
  },
  chill: {
    id: "chill",
    name: "Chill",
    emoji: "🌈",
    blurb: "No timer, no rivals. Eat the whole city!",
    duration: 0,
    rivals: 0,
    blocks: 5,
    respawnSmall: false,
  },
};

/** Friendly names for the "Now you can eat…" announcement, biggest first. */
export const UNLOCK_LABELS: Partial<Record<Kind, { emoji: string; label: string }>> = {
  skyscraper: { emoji: "🌆", label: "Skyscrapers" },
  tower: { emoji: "🏙️", label: "Towers" },
  office: { emoji: "🏢", label: "Office buildings" },
  shop: { emoji: "🏪", label: "Shops" },
  house: { emoji: "🏠", label: "Houses" },
  fountain: { emoji: "⛲", label: "Fountains" },
  bus: { emoji: "🚌", label: "Buses" },
  bigtree: { emoji: "🌳", label: "Big trees" },
  van: { emoji: "🚐", label: "Vans" },
  car: { emoji: "🚗", label: "Cars" },
  cart: { emoji: "🌭", label: "Food carts" },
  pine: { emoji: "🌲", label: "Pine trees" },
  tree: { emoji: "🌳", label: "Trees" },
  umbrella: { emoji: "⛱️", label: "Umbrellas" },
  bench: { emoji: "🪑", label: "Benches" },
};

/** Solo stars: fraction of the city eaten. */
export const SOLO_STARS = [0.2, 0.4, 0.65];
