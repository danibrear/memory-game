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

export type Rarity = 0 | 1 | 2 | 3 | 4;
/** Rarities that can come out of an egg. Mythic (4) only comes from fusing. */
export const EGG_RARITIES: Rarity[] = [0, 1, 2, 3];
export const MYTHIC: Rarity = 4;

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
  { name: "Mythic", color: "#fb7185", dark: "#e11d48", hatch: 16, mult: 150 },
];

/** Egg odds. Luck (and the golden nest) shifts weight toward rarer eggs. */
export function rarityWeights(luck: number): number[] {
  const l = Math.min(7, Math.max(0, luck));
  return [62 - 7 * l, 27 + 3 * l, 9 + 2.5 * l, 2 + 1.5 * l];
}
export const GOLDEN_NEST_LUCK = 2;

/* ---------- Pet looks ---------- */

export type HatId =
  | "none" | "crown" | "halo" | "scarf" | "flower" | "bow"
  | "party" | "tophat" | "propeller" | "wizard";

export interface Look {
  body: string;
  belly: string;
  accent: string;
  shape?: "round" | "tall" | "wide";
  ears?: "none" | "round" | "pointy" | "long" | "floppy" | "horns" | "tuft" | "unihorn";
  tail?: "none" | "puff" | "long" | "fish" | "flame" | "star";
  back?: "none" | "wings" | "shell" | "mane" | "fluff";
  pattern?: "none" | "stripes" | "spots" | "sprinkles" | "stars" | "mask";
  hat?: HatId;
  /** Colour for a bow or scarf (defaults to the accent colour). */
  hatColor?: string;
  /** Glow colour behind the critter (Mythic pets). */
  aura?: string;
  face?: "smile" | "beak" | "fang" | "cat";
  cheeks?: string;
}

export interface PetDef {
  id: string;
  name: string;
  biome: number;
  rarity: Rarity;
  look: Look;
  /** One friendly line for the Pet Book. */
  blurb: string;
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
    look: { body: "#fdf0d8", belly: "#ffffff", accent: "#f9a8d4", ears: "long", tail: "puff", cheeks: "#fda4af" },
    blurb: "Hops in zigzags and nibbles four-leaf clovers for luck." },
  { id: "honey-cub", name: "Honey Cub", biome: 0, rarity: 1,
    look: { body: "#fbbf24", belly: "#fef3c7", accent: "#78350f", ears: "round", back: "wings", pattern: "stripes", cheeks: "#fb923c" },
    blurb: "Half bear, half bee. Buzzes when it's happy." },
  { id: "petal-fox", name: "Petal Fox", biome: 0, rarity: 2,
    look: { body: "#fb7185", belly: "#ffe4e6", accent: "#be123c", ears: "pointy", tail: "long", hat: "flower", face: "cat", cheeks: "#fecdd3" },
    blurb: "Leaves a trail of flower petals wherever it trots." },
  { id: "sunny-lion", name: "Sunny Lion", biome: 0, rarity: 3,
    look: { body: "#fcd34d", belly: "#fef9c3", accent: "#ea580c", ears: "round", tail: "long", back: "mane", hat: "crown", face: "cat", cheeks: "#fdba74" },
    blurb: "Its mane glows like the sun. Roars only in whispers." },

  { id: "bloom-stag", name: "Bloom Stag", biome: 0, rarity: 4,
    look: { body: "#86efac", belly: "#f0fdf4", accent: "#ec4899", ears: "horns", tail: "puff", back: "mane", pattern: "spots", hat: "flower", face: "cat", cheeks: "#f9a8d4", aura: "#f472b6" },
    blurb: "Flowers bloom under every step it takes." },

  // Coral Beach
  { id: "puddle-pup", name: "Puddle Pup", biome: 1, rarity: 0,
    look: { body: "#7dd3fc", belly: "#e0f2fe", accent: "#0369a1", ears: "floppy", tail: "long", pattern: "spots", cheeks: "#f9a8d4" },
    blurb: "Never met a puddle it didn't want to splash in." },
  { id: "shelly", name: "Shelly", biome: 1, rarity: 1,
    look: { body: "#5eead4", belly: "#ccfbf1", accent: "#0f766e", ears: "none", back: "shell", shape: "wide", cheeks: "#fda4af" },
    blurb: "Slow and steady. Keeps snacks inside its shell." },
  { id: "mer-kitty", name: "Mer-Kitty", biome: 1, rarity: 2,
    look: { body: "#f0abfc", belly: "#fae8ff", accent: "#a21caf", ears: "pointy", tail: "fish", hat: "bow", face: "cat", cheeks: "#f9a8d4" },
    blurb: "A kitty that actually LOVES bath time." },
  { id: "tide-dragon", name: "Tide Dragon", biome: 1, rarity: 3,
    look: { body: "#22d3ee", belly: "#cffafe", accent: "#0e7490", ears: "horns", tail: "long", back: "wings", pattern: "spots", face: "fang", hat: "crown", cheeks: "#a5f3fc" },
    blurb: "Makes little waves by wiggling its tail." },

  { id: "pearl-narwhal", name: "Pearl Narwhal", biome: 1, rarity: 4,
    look: { body: "#e0f2fe", belly: "#ffffff", accent: "#06b6d4", ears: "unihorn", tail: "fish", pattern: "stars", hat: "halo", cheeks: "#f9a8d4", aura: "#22d3ee" },
    blurb: "Its horn shines like moonlight on the sea." },

  // Frosty Peak
  { id: "snow-puff", name: "Snow Puff", biome: 2, rarity: 0,
    look: { body: "#475569", belly: "#f8fafc", accent: "#f59e0b", ears: "none", shape: "tall", face: "beak", cheeks: "#fda4af" },
    blurb: "Slides on its tummy to get everywhere faster." },
  { id: "frosty-fox", name: "Frosty Fox", biome: 2, rarity: 1,
    look: { body: "#dbeafe", belly: "#ffffff", accent: "#3b82f6", ears: "pointy", tail: "long", hat: "scarf", face: "cat", cheeks: "#fbcfe8" },
    blurb: "Wears a scarf even though it never gets cold." },
  { id: "aurora-owl", name: "Aurora Owl", biome: 2, rarity: 2,
    look: { body: "#a78bfa", belly: "#ede9fe", accent: "#2dd4bf", ears: "tuft", back: "wings", pattern: "spots", face: "beak", cheeks: "#f0abfc" },
    blurb: "Its feathers shimmer like the northern lights." },
  { id: "blizzard-yeti", name: "Blizzard Yeti", biome: 2, rarity: 3,
    look: { body: "#f1f5f9", belly: "#bae6fd", accent: "#0ea5e9", ears: "horns", shape: "wide", back: "fluff", face: "fang", hat: "crown", cheeks: "#fda4af" },
    blurb: "Big, fluffy, and gives the warmest hugs." },

  { id: "frost-phoenix", name: "Frost Phoenix", biome: 2, rarity: 4,
    look: { body: "#bae6fd", belly: "#f0f9ff", accent: "#6366f1", ears: "tuft", tail: "flame", back: "wings", pattern: "stars", face: "beak", hat: "crown", cheeks: "#c7d2fe", aura: "#818cf8" },
    blurb: "A bird made of snowflakes that never melt." },

  // Candy Canyon
  { id: "gummy-cub", name: "Gummy Cub", biome: 3, rarity: 0,
    look: { body: "#f87171", belly: "#fecaca", accent: "#b91c1c", ears: "round", cheeks: "#fee2e2" },
    blurb: "Bouncy, squishy, and smells like cherries." },
  { id: "sprinkle-pup", name: "Sprinkle Pup", biome: 3, rarity: 1,
    look: { body: "#f9a8d4", belly: "#fce7f3", accent: "#db2777", ears: "floppy", tail: "puff", pattern: "sprinkles", cheeks: "#fb7185" },
    blurb: "Shakes off sprinkles instead of water." },
  { id: "lolli-cat", name: "Lolli Cat", biome: 3, rarity: 2,
    look: { body: "#86efac", belly: "#f0fdf4", accent: "#ec4899", ears: "pointy", tail: "long", pattern: "stripes", hat: "bow", face: "cat", cheeks: "#f9a8d4" },
    blurb: "Purrs in swirls. Slightly sticky paws." },
  { id: "sugar-unicorn", name: "Sugar Unicorn", biome: 3, rarity: 3,
    look: { body: "#fdf4ff", belly: "#ffffff", accent: "#e879f9", ears: "unihorn", tail: "star", back: "mane", pattern: "sprinkles", cheeks: "#f9a8d4" },
    blurb: "Sneezes glitter. Says excuse me every time." },

  { id: "bubblegum-king", name: "Bubblegum King", biome: 3, rarity: 4,
    look: { body: "#f472b6", belly: "#fdf2f8", accent: "#7c3aed", shape: "wide", ears: "round", tail: "puff", back: "fluff", pattern: "sprinkles", hat: "crown", cheeks: "#fbcfe8", aura: "#c084fc" },
    blurb: "Blows the biggest bubbles in the whole canyon." },

  // Starry Space
  { id: "moon-mouse", name: "Moon Mouse", biome: 4, rarity: 0,
    look: { body: "#cbd5e1", belly: "#f8fafc", accent: "#f472b6", ears: "round", tail: "long", cheeks: "#f9a8d4" },
    blurb: "Thinks the moon is made of cheese. Might be right." },
  { id: "comet-cat", name: "Comet Cat", biome: 4, rarity: 1,
    look: { body: "#6366f1", belly: "#c7d2fe", accent: "#f97316", ears: "pointy", tail: "flame", face: "cat", cheeks: "#a5b4fc" },
    blurb: "Chases its own fiery tail across the sky." },
  { id: "nebula-bunny", name: "Nebula Bunny", biome: 4, rarity: 2,
    look: { body: "#c084fc", belly: "#f3e8ff", accent: "#22d3ee", ears: "long", tail: "puff", pattern: "stars", hat: "halo", cheeks: "#f0abfc" },
    blurb: "Hops from star to star without a sound." },
  { id: "galaxy-dragon", name: "Galaxy Dragon", biome: 4, rarity: 3,
    look: { body: "#4338ca", belly: "#a5b4fc", accent: "#f0abfc", ears: "horns", tail: "star", back: "wings", pattern: "stars", face: "fang", hat: "crown", cheeks: "#818cf8" },
    blurb: "Keeps a pocket full of baby stars." },
  { id: "nova-kitty", name: "Nova Kitty", biome: 4, rarity: 4,
    look: { body: "#1e1b4b", belly: "#4338ca", accent: "#fde047", ears: "pointy", tail: "star", pattern: "stars", hat: "halo", face: "cat", cheeks: "#a5b4fc", aura: "#fde047" },
    blurb: "Born when a star went POP. Purrs like thunder." },
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
/** A look with a wardrobe hat on. Bows and scarves get a cheerful red, whatever the fur. */
export const dressed = (look: Look, hat: HatId | undefined): Look =>
  hat && hat !== "none" ? { ...look, hat, hatColor: "#f43f5e" } : look;

/* ---------- Upgrades ---------- */

export type UpgradeId =
  | "speed" | "basket" | "pen" | "luck"
  | "dash" | "warm" | "socks" | "treats" | "sparkle";

export const UPGRADE_IDS: UpgradeId[] = [
  "speed", "dash", "basket", "pen", "treats", "warm", "luck", "sparkle", "socks",
];

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

const COSTS: Record<UpgradeId, number[]> = {
  speed: SPEED_COSTS,
  pen: [80, 900, 12_000, 150_000, 2_000_000, 20_000_000],
  luck: [250, 4_000, 60_000, 800_000, 10_000_000],
  basket: [400, 100_000],
  // Zoom Dash: the first level unlocks the button, the rest shorten the wait.
  dash: [150, 6_000, 180_000, 6_000_000],
  // Warm Nests: eggs hatch faster.
  warm: [120, 2_500, 50_000, 1_000_000, 15_000_000],
  // Tiptoe Socks: Grumbles take longer to wake.
  socks: [300, 8_000, 200_000, 6_000_000],
  // Pet Treats: every pet earns more.
  treats: [500, 3_000, 20_000, 120_000, 800_000, 5_000_000, 30_000_000, 150_000_000],
  // Sparkle Charm: more shiny pets.
  sparkle: [1_000, 15_000, 250_000, 4_000_000, 40_000_000],
};

export const penSize = (level: number) => PEN_SIZES[Math.min(level, PEN_SIZES.length - 1)];
export const basketSize = (level: number) => 1 + level;
/** Seconds between dashes at each Zoom Dash level (level 0 = no dash yet). */
export const dashCooldown = (level: number) => [Infinity, 8, 6.5, 5, 4][Math.min(level, 4)];
export const DASH_TIME = 0.9;
export const DASH_BOOST = 1.9;
export const hatchScale = (level: number) => [1, 0.85, 0.7, 0.55, 0.42, 0.32][Math.min(level, 5)];
export const sockBonus = (level: number) => 0.2 * level;
export const treatsMult = (level: number) => 1 + 0.25 * level;
export const shinyChance = (level: number) => SHINY_CHANCE + 0.03 * level;

export const maxLevel = (id: UpgradeId): number => COSTS[id].length;

/** Price of the next level, or null when maxed out. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  return level >= COSTS[id].length ? null : COSTS[id][level];
}

/* ---------- Hats and trails (bought with stars) ---------- */

export interface HatDef {
  id: HatId;
  name: string;
  cost: number;
}

export const HATS: HatDef[] = [
  { id: "none", name: "No hat", cost: 0 },
  { id: "bow", name: "Bow", cost: 3 },
  { id: "flower", name: "Flower", cost: 3 },
  { id: "scarf", name: "Scarf", cost: 5 },
  { id: "party", name: "Party Hat", cost: 6 },
  { id: "propeller", name: "Whirly Cap", cost: 8 },
  { id: "tophat", name: "Top Hat", cost: 10 },
  { id: "wizard", name: "Wizard Hat", cost: 12 },
  { id: "halo", name: "Halo", cost: 15 },
  { id: "crown", name: "Crown", cost: 25 },
];

export type TrailId =
  | "none" | "sparkle" | "leaf" | "snow" | "heart" | "bubble" | "star" | "fire" | "rainbow";

export interface TrailDef {
  id: TrailId;
  name: string;
  cost: number;
  shape: "dot" | "star" | "heart" | "ring";
  colors: string[];
}

export const TRAILS: TrailDef[] = [
  { id: "none", name: "No trail", cost: 0, shape: "dot", colors: [] },
  { id: "sparkle", name: "Sparkles", cost: 4, shape: "star", colors: ["#ffffff", "#fde68a"] },
  { id: "leaf", name: "Leaves", cost: 5, shape: "dot", colors: ["#4ade80", "#16a34a", "#a3e635"] },
  { id: "snow", name: "Snowflakes", cost: 5, shape: "star", colors: ["#ffffff", "#bae6fd"] },
  { id: "heart", name: "Hearts", cost: 8, shape: "heart", colors: ["#fb7185", "#f472b6", "#fda4af"] },
  { id: "bubble", name: "Bubbles", cost: 8, shape: "ring", colors: ["#7dd3fc", "#a5f3fc", "#ffffff"] },
  { id: "star", name: "Stardust", cost: 12, shape: "star", colors: ["#fde047", "#f0abfc", "#a5b4fc"] },
  { id: "fire", name: "Flames", cost: 15, shape: "dot", colors: ["#fb923c", "#f97316", "#fde047"] },
  { id: "rainbow", name: "Rainbow", cost: 20, shape: "dot", colors: ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa"] },
];

/* ---------- Home decorations (bought with coins) ---------- */

export type HomeDecorId = "garden" | "balloons" | "fountain" | "slide" | "rainbow" | "statue";

export interface HomeDecor {
  id: HomeDecorId;
  name: string;
  cost: number;
  desc: string;
}

export const HOME_DECOR: HomeDecor[] = [
  { id: "garden", name: "Flower Garden", cost: 2_000, desc: "Flowers all around the pen" },
  { id: "balloons", name: "Balloon Arch", cost: 25_000, desc: "A party at the pen gate" },
  { id: "fountain", name: "Splash Fountain", cost: 300_000, desc: "Pets love the sparkly water" },
  { id: "slide", name: "Rainbow Slide", cost: 3_000_000, desc: "Wheee!" },
  { id: "rainbow", name: "Rainbow", cost: 30_000_000, desc: "A rainbow over your pen" },
  { id: "statue", name: "Golden Statue", cost: 500_000_000, desc: "A statue of you, in gold" },
];
/** Each decoration makes pets a little happier: this much more coins apiece. */
export const DECOR_BONUS = 0.05;

/* ---------- Missions: three little goals that keep refreshing ---------- */

export type MissionKind = "eggs" | "bugs" | "pats" | "taps" | "golden" | "dashes" | "escapes";

export interface MissionDef {
  kind: MissionKind;
  /** How many, easiest first. One is picked at random. */
  amounts: number[];
  text: (n: number) => string;
}

export const MISSIONS: MissionDef[] = [
  { kind: "eggs", amounts: [3, 5, 8], text: (n) => `Bring ${n} eggs home` },
  { kind: "bugs", amounts: [2, 3, 5], text: (n) => `Catch ${n} glitterbugs` },
  { kind: "pats", amounts: [3, 5], text: (n) => `Pet your pets ${n} times` },
  { kind: "taps", amounts: [15, 30], text: (n) => `Tap hatching eggs ${n} times` },
  { kind: "golden", amounts: [1, 2], text: (n) => (n === 1 ? "Take an egg from a golden nest" : `Take ${n} eggs from golden nests`) },
  { kind: "dashes", amounts: [3, 5], text: (n) => `Use Zoom Dash ${n} times` },
  { kind: "escapes", amounts: [2, 4], text: (n) => `Escape a chasing Grumble ${n} times` },
];
export const missionText = (kind: MissionKind, n: number) =>
  MISSIONS.find((m) => m.kind === kind)?.text(n) ?? "";
/** Every this-many missions pays a bonus in stars. */
export const MISSION_STREAK = 5;
export const MISSION_STREAK_STARS = 2;

/* ---------- World events ---------- */

/** One full day, in seconds: mostly daylight, then dusk, night and dawn. */
export const DAY_LENGTH = 270;
const NIGHT_START = 160;
const NIGHT_END = 240;
const DUSK = 14;
/** 0 in daylight, 1 in the middle of the night, sliding between at dusk and dawn. */
export function nightAmount(clock: number): number {
  const t = ((clock % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  if (t < NIGHT_START || t >= NIGHT_END + DUSK) return 0;
  if (t < NIGHT_START + DUSK) return (t - NIGHT_START) / DUSK;
  if (t < NIGHT_END) return 1;
  return 1 - (t - NIGHT_END) / DUSK;
}
/** Extra luck while it is night ("rare eggs come out at night"). */
export const NIGHT_LUCK = 1;
/** Grumbles sleep deeper at night. */
export const NIGHT_WAKE_BONUS = 0.3;

export const BUGS_PER_LAND = 2;
/** Now and then a glitterbug is golden and worth a star. */
export const GOLDEN_BUG_CHANCE = 0.08;
/** Catching a shooting star doubles every coin for this many seconds. */
export const FRENZY_TIME = 30;
export const BUG_RESPAWN = 16;
export const MYSTERY_EVERY: [number, number] = [95, 150];
export const MYSTERY_LIFETIME = 50;
/** The gift chest refills this often (real time, so it's ready after a break). */
export const CHEST_MS = 5 * 60 * 1000;
export const PAT_COOLDOWN = 6;
export const SUGAR_RUSH_TIME = 4;
export const SUGAR_RUSH_BOOST = 1.35;
export const SECRET_STAR_REWARD = 3;
export const IDLE_SLEEP_AFTER = 25;

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
export const CHEST = { x: WORLD_W - 122, y: HOME_TOP + 158, r: 34 };
/** A little flying saucer hides at the very top of the last land. */
export const UFO = { x: CENTER_X, y: 58, r: 34 };
/** Where the map drops you in a land: just inside its gate. */
export const travelPoint = (biome: number): Point =>
  biome < 0 ? { ...PLAYER_START } : { x: CENTER_X, y: biomeBottom(biome) - 70 };

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
