// ─── Sneaky Eggs: world, pets and tuning ─────────────────────────────────────
//
// Everything a parent might want to tweak lives here: how fast the Grumbles
// are, what eggs hatch into, what upgrades cost.

export const WORLD_W = 960;
export const BIOME_H = 640;
export const HOME_H = 580;
export const BIOME_COUNT = 5;
/** y grows downward. Home sits at the bottom, the farthest biome at the top. */
export const HOME_TOP = BIOME_H * BIOME_COUNT;
export const WORLD_H = HOME_TOP + HOME_H;
export const CENTER_X = WORLD_W / 2;
export const GATE_W = 210;

export const PLAYER_R = 16;
export const GUARD_R = 40;
export const PICKUP_DIST = 38;
export const EGG_RESPAWN = 5;
export const PAD_COUNT = 4;
/** Each tap on a hatching egg knocks this many seconds off. */
export const TAP_BOOST = 0.6;
export const SHINY_CHANCE = 0.05;
export const SHINY_MULT = 3;
/** Selling a pet pays this many seconds of its income. */
export const SELL_SECONDS = 20;
/** Delivering an egg pays this many seconds of the pet's income up front. */
export const DELIVERY_SECONDS = 6;
export const FUSE_COUNT = 3;

export const biomeTop = (i: number) => (BIOME_COUNT - 1 - i) * BIOME_H;
export const biomeBottom = (i: number) => biomeTop(i) + BIOME_H;
/** Which biome a y position is in; -1 means home. */
export const biomeAt = (y: number) =>
  y >= HOME_TOP ? -1 : Math.max(0, BIOME_COUNT - 1 - Math.floor(y / BIOME_H));

/* ---------- Rarity ---------- */

export type Rarity = 0 | 1 | 2 | 3;

export interface RarityInfo {
  name: string;
  color: string;
  dark: string;
  /** Seconds to hatch. */
  hatch: number;
  /** Coin multiplier on top of the biome's. */
  mult: number;
}

export const RARITIES: RarityInfo[] = [
  { name: "Common", color: "#94a3b8", dark: "#64748b", hatch: 3, mult: 1 },
  { name: "Rare", color: "#38bdf8", dark: "#0284c7", hatch: 5, mult: 3 },
  { name: "Epic", color: "#c084fc", dark: "#9333ea", hatch: 8, mult: 9 },
  { name: "Legendary", color: "#fbbf24", dark: "#d97706", hatch: 12, mult: 30 },
];

/** Egg odds. Luck (and the golden nest) shifts weight toward rarer eggs. */
export function rarityWeights(luck: number): number[] {
  const l = Math.min(7, Math.max(0, luck));
  return [62 - 7 * l, 27 + 3 * l, 9 + 2.5 * l, 2 + 1.5 * l];
}
export const GOLDEN_NEST_LUCK = 2;

/* ---------- Pet looks ---------- */

export interface Look {
  body: string;
  belly: string;
  accent: string;
  shape?: "round" | "tall" | "wide";
  ears?: "none" | "round" | "pointy" | "long" | "floppy" | "horns" | "tuft" | "unihorn";
  tail?: "none" | "puff" | "long" | "fish" | "flame" | "star";
  back?: "none" | "wings" | "shell" | "mane" | "fluff";
  pattern?: "none" | "stripes" | "spots" | "sprinkles" | "stars" | "mask";
  hat?: "none" | "crown" | "halo" | "scarf" | "flower" | "bow";
  face?: "smile" | "beak" | "fang" | "cat";
  cheeks?: string;
}

export interface PetDef {
  id: string;
  name: string;
  biome: number;
  rarity: Rarity;
  look: Look;
}

/* ---------- Biomes ---------- */

export type DecorKind =
  | "flower" | "tuft" | "shell" | "starfish" | "snowdot" | "icepatch"
  | "sprinkle" | "swirl" | "star" | "crater";
export type SolidKind =
  | "tree" | "bush" | "palm" | "rock" | "pine" | "snowpile"
  | "lollipop" | "gumdrop" | "crystal" | "moonrock";

export interface Biome {
  id: string;
  name: string;
  ground: string;
  ground2: string;
  path: string;
  fence: string;
  /** Text colour that reads on this ground. */
  ink: string;
  /** Coin multiplier for pets from here. */
  mult: number;
  /** Sneaker level needed to open the gate. */
  speedReq: number;
  /** Grumble speed as a share of the player's speed at `speedReq`. */
  guardRatio: number;
  /** Seconds between grabbing an egg and the Grumble getting up. */
  wake: number;
  guard: Look;
  egg: { base: string; spot: string };
  decor: DecorKind[];
  solids: SolidKind[];
}

export const BIOMES: Biome[] = [
  {
    id: "meadow",
    name: "Sunny Meadow",
    ground: "#93d66f",
    ground2: "#7fc75c",
    path: "#f3e2ad",
    fence: "#b7814a",
    ink: "#27500f",
    mult: 1,
    speedReq: 0,
    guardRatio: 0.7,
    wake: 1.0,
    guard: { body: "#5f9a52", belly: "#cdeab0", accent: "#31572c", shape: "wide", ears: "horns", back: "fluff", face: "fang", cheeks: "#f9a8d4" },
    egg: { base: "#fff8e6", spot: "#7fc75c" },
    decor: ["flower", "tuft"],
    solids: ["tree", "bush"],
  },
  {
    id: "beach",
    name: "Coral Beach",
    ground: "#f7e3aa",
    ground2: "#ecd28e",
    path: "#fff5d6",
    fence: "#c98f5a",
    ink: "#7a4a12",
    mult: 5,
    speedReq: 3,
    guardRatio: 0.78,
    wake: 0.85,
    guard: { body: "#f2765d", belly: "#ffd6c9", accent: "#a8321d", shape: "wide", ears: "horns", back: "shell", face: "fang", cheeks: "#fecaca" },
    egg: { base: "#e3fafc", spot: "#ff8a65" },
    decor: ["shell", "starfish"],
    solids: ["palm", "rock"],
  },
  {
    id: "frost",
    name: "Frosty Peak",
    ground: "#e8f4fc",
    ground2: "#d0e6f5",
    path: "#ffffff",
    fence: "#8fb4d1",
    ink: "#1e4d74",
    mult: 25,
    speedReq: 6,
    guardRatio: 0.84,
    wake: 0.7,
    guard: { body: "#7fb2e5", belly: "#e0f2fe", accent: "#27598c", shape: "wide", ears: "horns", back: "fluff", face: "fang", cheeks: "#bfdbfe" },
    egg: { base: "#f0f9ff", spot: "#60a5fa" },
    decor: ["snowdot", "icepatch"],
    solids: ["pine", "snowpile"],
  },
  {
    id: "candy",
    name: "Candy Canyon",
    ground: "#ffd4e5",
    ground2: "#ffbdd7",
    path: "#fff1cc",
    fence: "#e879a9",
    ink: "#8a1c50",
    mult: 120,
    speedReq: 10,
    guardRatio: 0.9,
    wake: 0.55,
    guard: { body: "#c47be0", belly: "#f3d9ff", accent: "#6b21a8", shape: "wide", ears: "horns", back: "fluff", face: "fang", pattern: "sprinkles", cheeks: "#f9a8d4" },
    egg: { base: "#fff0f6", spot: "#ff7eb6" },
    decor: ["sprinkle", "swirl"],
    solids: ["lollipop", "gumdrop"],
  },
  {
    id: "space",
    name: "Starry Space",
    ground: "#2c2559",
    ground2: "#231d49",
    path: "#463b82",
    fence: "#7c6fd6",
    ink: "#e0e7ff",
    mult: 600,
    speedReq: 14,
    guardRatio: 0.94,
    wake: 0.45,
    guard: { body: "#5b50c9", belly: "#c7d2fe", accent: "#1e1b4b", shape: "wide", ears: "horns", back: "fluff", face: "fang", pattern: "stars", cheeks: "#a5b4fc" },
    egg: { base: "#3730a3", spot: "#a5b4fc" },
    decor: ["star", "crater"],
    solids: ["crystal", "moonrock"],
  },
];

/* ---------- Pets: one per biome and rarity ---------- */

export const PETS: PetDef[] = [
  // Sunny Meadow
  { id: "clover-bun", name: "Clover Bun", biome: 0, rarity: 0,
    look: { body: "#fdf0d8", belly: "#ffffff", accent: "#f9a8d4", ears: "long", tail: "puff", cheeks: "#fda4af" } },
  { id: "honey-cub", name: "Honey Cub", biome: 0, rarity: 1,
    look: { body: "#fbbf24", belly: "#fef3c7", accent: "#78350f", ears: "round", back: "wings", pattern: "stripes", cheeks: "#fb923c" } },
  { id: "petal-fox", name: "Petal Fox", biome: 0, rarity: 2,
    look: { body: "#fb7185", belly: "#ffe4e6", accent: "#be123c", ears: "pointy", tail: "long", hat: "flower", face: "cat", cheeks: "#fecdd3" } },
  { id: "sunny-lion", name: "Sunny Lion", biome: 0, rarity: 3,
    look: { body: "#fcd34d", belly: "#fef9c3", accent: "#ea580c", ears: "round", tail: "long", back: "mane", hat: "crown", face: "cat", cheeks: "#fdba74" } },

  // Coral Beach
  { id: "puddle-pup", name: "Puddle Pup", biome: 1, rarity: 0,
    look: { body: "#7dd3fc", belly: "#e0f2fe", accent: "#0369a1", ears: "floppy", tail: "long", pattern: "spots", cheeks: "#f9a8d4" } },
  { id: "shelly", name: "Shelly", biome: 1, rarity: 1,
    look: { body: "#5eead4", belly: "#ccfbf1", accent: "#0f766e", ears: "none", back: "shell", shape: "wide", cheeks: "#fda4af" } },
  { id: "mer-kitty", name: "Mer-Kitty", biome: 1, rarity: 2,
    look: { body: "#f0abfc", belly: "#fae8ff", accent: "#a21caf", ears: "pointy", tail: "fish", hat: "bow", face: "cat", cheeks: "#f9a8d4" } },
  { id: "tide-dragon", name: "Tide Dragon", biome: 1, rarity: 3,
    look: { body: "#22d3ee", belly: "#cffafe", accent: "#0e7490", ears: "horns", tail: "long", back: "wings", pattern: "spots", face: "fang", hat: "crown", cheeks: "#a5f3fc" } },

  // Frosty Peak
  { id: "snow-puff", name: "Snow Puff", biome: 2, rarity: 0,
    look: { body: "#475569", belly: "#f8fafc", accent: "#f59e0b", ears: "none", shape: "tall", face: "beak", cheeks: "#fda4af" } },
  { id: "frosty-fox", name: "Frosty Fox", biome: 2, rarity: 1,
    look: { body: "#dbeafe", belly: "#ffffff", accent: "#3b82f6", ears: "pointy", tail: "long", hat: "scarf", face: "cat", cheeks: "#fbcfe8" } },
  { id: "aurora-owl", name: "Aurora Owl", biome: 2, rarity: 2,
    look: { body: "#a78bfa", belly: "#ede9fe", accent: "#2dd4bf", ears: "tuft", back: "wings", pattern: "spots", face: "beak", cheeks: "#f0abfc" } },
  { id: "blizzard-yeti", name: "Blizzard Yeti", biome: 2, rarity: 3,
    look: { body: "#f1f5f9", belly: "#bae6fd", accent: "#0ea5e9", ears: "horns", shape: "wide", back: "fluff", face: "fang", hat: "crown", cheeks: "#fda4af" } },

  // Candy Canyon
  { id: "gummy-cub", name: "Gummy Cub", biome: 3, rarity: 0,
    look: { body: "#f87171", belly: "#fecaca", accent: "#b91c1c", ears: "round", cheeks: "#fee2e2" } },
  { id: "sprinkle-pup", name: "Sprinkle Pup", biome: 3, rarity: 1,
    look: { body: "#f9a8d4", belly: "#fce7f3", accent: "#db2777", ears: "floppy", tail: "puff", pattern: "sprinkles", cheeks: "#fb7185" } },
  { id: "lolli-cat", name: "Lolli Cat", biome: 3, rarity: 2,
    look: { body: "#86efac", belly: "#f0fdf4", accent: "#ec4899", ears: "pointy", tail: "long", pattern: "stripes", hat: "bow", face: "cat", cheeks: "#f9a8d4" } },
  { id: "sugar-unicorn", name: "Sugar Unicorn", biome: 3, rarity: 3,
    look: { body: "#fdf4ff", belly: "#ffffff", accent: "#e879f9", ears: "unihorn", tail: "star", back: "mane", pattern: "sprinkles", cheeks: "#f9a8d4" } },

  // Starry Space
  { id: "moon-mouse", name: "Moon Mouse", biome: 4, rarity: 0,
    look: { body: "#cbd5e1", belly: "#f8fafc", accent: "#f472b6", ears: "round", tail: "long", cheeks: "#f9a8d4" } },
  { id: "comet-cat", name: "Comet Cat", biome: 4, rarity: 1,
    look: { body: "#6366f1", belly: "#c7d2fe", accent: "#f97316", ears: "pointy", tail: "flame", face: "cat", cheeks: "#a5b4fc" } },
  { id: "nebula-bunny", name: "Nebula Bunny", biome: 4, rarity: 2,
    look: { body: "#c084fc", belly: "#f3e8ff", accent: "#22d3ee", ears: "long", tail: "puff", pattern: "stars", hat: "halo", cheeks: "#f0abfc" } },
  { id: "galaxy-dragon", name: "Galaxy Dragon", biome: 4, rarity: 3,
    look: { body: "#4338ca", belly: "#a5b4fc", accent: "#f0abfc", ears: "horns", tail: "star", back: "wings", pattern: "stars", face: "fang", hat: "crown", cheeks: "#818cf8" } },
];

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
export const petById = (id: string): PetDef | undefined => PET_BY_ID.get(id);
export const petFor = (biome: number, rarity: Rarity): PetDef =>
  PETS.find((p) => p.biome === biome && p.rarity === rarity) ?? PETS[0];

/** Coins per second for one pet. */
export const petRate = (def: PetDef, shiny = false) =>
  BIOMES[def.biome].mult * RARITIES[def.rarity].mult * (shiny ? SHINY_MULT : 1);

/* ---------- The player ---------- */

export interface Skin {
  id: string;
  name: string;
  look: Look;
}

const sneak = (body: string, belly: string, accent: string): Look => ({
  body, belly, accent, ears: "pointy", tail: "long", pattern: "mask", face: "cat", cheeks: "#fda4af",
});

export const SKINS: Skin[] = [
  { id: "slate", name: "Slate", look: sneak("#94a3b8", "#f1f5f9", "#334155") },
  { id: "peach", name: "Peach", look: sneak("#fdba74", "#fff7ed", "#9a3412") },
  { id: "berry", name: "Berry", look: sneak("#f9a8d4", "#fdf2f8", "#9d174d") },
  { id: "mint", name: "Mint", look: sneak("#6ee7b7", "#ecfdf5", "#065f46") },
  { id: "grape", name: "Grape", look: sneak("#c4b5fd", "#f5f3ff", "#5b21b6") },
  { id: "sky", name: "Sky", look: sneak("#7dd3fc", "#f0f9ff", "#075985") },
];
export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

/* ---------- Upgrades ---------- */

export type UpgradeId = "speed" | "pen" | "luck" | "basket";

export const playerSpeed = (level: number) => 190 + 16 * level;
export const guardSpeed = (biome: number) =>
  playerSpeed(BIOMES[biome].speedReq) * BIOMES[biome].guardRatio;

// Sneaker prices. Gates open at levels 3, 6, 10 and 14, so each group below
// is "what it costs to reach the next land".
const SPEED_COSTS = [
  20, 40, 80,
  300, 800, 2_000,
  6_000, 15_000, 35_000, 80_000,
  200_000, 500_000, 1_200_000, 3_000_000,
  6_000_000, 12_000_000, 25_000_000, 50_000_000,
];
const PEN_SIZES = [8, 10, 12, 14, 16, 18, 20];
const PEN_COSTS = [80, 900, 12_000, 150_000, 2_000_000, 20_000_000];
const LUCK_COSTS = [250, 4_000, 60_000, 800_000, 10_000_000];
const BASKET_COSTS = [400, 100_000];

export const penSize = (level: number) => PEN_SIZES[Math.min(level, PEN_SIZES.length - 1)];
export const basketSize = (level: number) => 1 + level;

export const maxLevel = (id: UpgradeId): number =>
  id === "speed" ? SPEED_COSTS.length
  : id === "pen" ? PEN_COSTS.length
  : id === "luck" ? LUCK_COSTS.length
  : BASKET_COSTS.length;

/** Price of the next level, or null when maxed out. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  if (level >= maxLevel(id)) return null;
  switch (id) {
    case "speed":
      return SPEED_COSTS[level];
    case "pen":
      return PEN_COSTS[level];
    case "luck":
      return LUCK_COSTS[level];
    case "basket":
      return BASKET_COSTS[level];
  }
}

/* ---------- Layout ---------- */

export interface Point {
  x: number;
  y: number;
}

/** Where things sit inside a biome, relative to its top edge. */
export const GUARD_POST = { x: CENTER_X, dy: 220 };
const NEST_SPOTS: { dx: number; dy: number; golden: boolean }[] = [
  { dx: -245, dy: 305, golden: false },
  { dx: 245, dy: 305, golden: false },
  // The golden nest (better eggs) hides up behind the Grumble, off the path.
  { dx: -172, dy: 104, golden: true },
];
/** Nest positions in world space. The golden nest swaps sides each biome. */
export const nestSpots = (biome: number): (Point & { golden: boolean })[] =>
  NEST_SPOTS.map((n) => ({
    x: CENTER_X + (n.golden && biome % 2 === 1 ? -n.dx : n.dx),
    y: biomeTop(biome) + n.dy,
    golden: n.golden,
  }));

export const PLAYER_START: Point = { x: CENTER_X, y: HOME_TOP + 285 };
export const PAD_Y = HOME_TOP + 190;
export const padX = (i: number) => CENTER_X + (i - (PAD_COUNT - 1) / 2) * 124;
/** Carried eggs drop off once the player is this far into home. */
export const DELIVER_Y = HOME_TOP + 70;
export const PEN = { x0: 150, x1: WORLD_W - 150, y0: HOME_TOP + 350, y1: HOME_TOP + 540 };
export const HUT = { x: 122, y: HOME_TOP + 150, r: 58 };

export function fmtCoins(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  const units = ["K", "M", "B", "T"];
  let v = n;
  let u = -1;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  // Floor so the label never shows more than the player has.
  const f = Math.pow(10, digits);
  return `${parseFloat((Math.floor(v * f) / f).toFixed(digits))}${units[u]}`;
}
