// ─── Sneaky Eggs: world, pets and tuning ─────────────────────────────────────
//
// Everything a parent might want to tweak lives here: how fast the Grumbles
// are, what eggs hatch into, what upgrades cost.

export const WORLD_W = 1680;
export const BIOME_H = 640;
export const HOME_H = 580;
export const BIOME_COUNT = 8;
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

/* ---------- Valuable eggs cost time ---------- */
// Indexed by egg rarity: Common, Uncommon, Rare, Epic, Legendary, Mythic.

/** Seconds a freshly laid egg needs before it can be picked up. */
export const RIPEN_TIME = [0, 2, 6, 14, 26, 45];
/**
 * How long you must stand at the nest to lift the egg, as a multiple of that
 * land's Grumble wake time. The Grumble starts waking the moment you begin.
 */
export const GRAB_TIME = [0, 0.1, 0.25, 0.5, 0.9, 1.2];
/** Share of your speed each carried egg takes away. */
export const EGG_WEIGHT = [0, 0.01, 0.03, 0.07, 0.12, 0.18];
/** However many heavy eggs you carry, you never lose more speed than this. */
export const MAX_WEIGHT = 0.35;
/** Selling a pet pays this many seconds of its income. */
export const SELL_SECONDS = 20;
/** Delivering an egg pays this many seconds of the pet's income up front. */
export const DELIVERY_SECONDS = 6;
/** How many of the same pet it takes to fuse one of the next rarity. */
export const FUSE_COUNT = 4;

export const biomeTop = (i: number) => (BIOME_COUNT - 1 - i) * BIOME_H;
export const biomeBottom = (i: number) => biomeTop(i) + BIOME_H;
/** Which biome a y position is in; -1 means home. */
export const biomeAt = (y: number) =>
  y >= HOME_TOP ? -1 : Math.max(0, BIOME_COUNT - 1 - Math.floor(y / BIOME_H));

/* ---------- Rarity ---------- */

export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
export const COMMON: Rarity = 0;
export const UNCOMMON: Rarity = 1;
export const RARE: Rarity = 2;
export const EPIC: Rarity = 3;
export const LEGENDARY: Rarity = 4;
export const MYTHIC: Rarity = 5;
/** Every rarity, lowest first. All of them can come out of an egg; Mythic eggs are extremely rare. */
export const ALL_RARITIES: Rarity[] = [0, 1, 2, 3, 4, 5];

export interface RarityInfo {
  name: string;
  color: string;
  dark: string;
  /** Seconds to hatch. */
  hatch: number;
  /** Coin multiplier on top of the biome's. */
  mult: number;
}

// Fusing takes four pets, so each step up is worth about four of the step below
// only at the top; lower down a fuse trades a little income for three free pen spots.
export const RARITIES: RarityInfo[] = [
  { name: "Common", color: "#94a3b8", dark: "#64748b", hatch: 3, mult: 1 },
  { name: "Uncommon", color: "#4ade80", dark: "#16a34a", hatch: 4, mult: 2 },
  { name: "Rare", color: "#38bdf8", dark: "#0284c7", hatch: 5, mult: 4 },
  { name: "Epic", color: "#c084fc", dark: "#9333ea", hatch: 8, mult: 12 },
  { name: "Legendary", color: "#fbbf24", dark: "#d97706", hatch: 12, mult: 40 },
  { name: "Mythic", color: "#fb7185", dark: "#e11d48", hatch: 20, mult: 200 },
];

/**
 * Egg odds, lowest rarity first. Luck (clover, golden and grove nests, night,
 * a buddy) shifts weight toward rarer eggs. With no luck at all a Legendary is
 * under 1 egg in 100 and a Mythic about 1 in 5,000; at full luck they are about
 * 1 in 17 and 1 in 400.
 */
export function rarityWeights(luck: number): number[] {
  const l = Math.min(7, Math.max(0, luck));
  return [60 - 7 * l, 26 + 1.5 * l, 10 + 2.5 * l, 3 + 1.6 * l, 0.8 + 0.7 * l, 0.02 + 0.033 * l];
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
  | "sprinkle" | "swirl" | "star" | "crater"
  | "leaf" | "mushroom" | "ember" | "crack" | "wisp" | "arc";
export type SolidKind =
  | "tree" | "bush" | "palm" | "rock" | "pine" | "snowpile"
  | "lollipop" | "gumdrop" | "crystal" | "moonrock"
  | "pumpkin" | "deadtree" | "volcano" | "obsidian" | "cloud" | "pillar";

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
  /**
   * How well this Grumble guesses where you're running: 0 only ever chases you,
   * 1 runs to exactly the right spot to block your way to the gate.
   */
  cunning: number;
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
    cunning: 0.25,
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
    cunning: 0.3,
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
    cunning: 0.35,
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
    cunning: 0.4,
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
    cunning: 0.45,
    guard: { body: "#5b50c9", belly: "#c7d2fe", accent: "#1e1b4b", shape: "wide", ears: "horns", back: "fluff", face: "fang", pattern: "stars", cheeks: "#a5b4fc" },
    egg: { base: "#3730a3", spot: "#a5b4fc" },
    decor: ["star", "crater"],
    solids: ["crystal", "moonrock"],
  },
  // The three lands past Starry Space (added November 2026). Their gates sit at
  // sneaker levels 18, 22 and 26, so a player who had maxed the old sneakers
  // walks straight into Spooky Hollow.
  {
    id: "spooky",
    name: "Spooky Hollow",
    ground: "#8b7bb5",
    ground2: "#7868a3",
    path: "#d8cdee",
    fence: "#4a3d73",
    ink: "#241846",
    mult: 3_000,
    speedReq: 18,
    guardRatio: 0.955,
    wake: 0.4,
    // As sharp at cutting you off as Starry Space, the highest that has been play-tested.
    cunning: 0.45,
    guard: { body: "#4a3a70", belly: "#c4b5fd", accent: "#1c1233", shape: "wide", ears: "horns", back: "wings", face: "fang", pattern: "spots", cheeks: "#a78bfa" },
    egg: { base: "#f3e8ff", spot: "#f97316" },
    decor: ["leaf", "mushroom"],
    solids: ["pumpkin", "deadtree"],
  },
  {
    id: "lava",
    name: "Lava Lagoon",
    ground: "#8a3b24",
    ground2: "#76301c",
    path: "#f3c796",
    fence: "#3f1408",
    ink: "#ffedd5",
    mult: 15_000,
    speedReq: 22,
    guardRatio: 0.97,
    wake: 0.36,
    // As sharp at cutting you off as Starry Space, the highest that has been play-tested.
    cunning: 0.45,
    guard: { body: "#dc2626", belly: "#fed7aa", accent: "#7f1d1d", shape: "wide", ears: "horns", back: "shell", tail: "flame", face: "fang", cheeks: "#fdba74" },
    egg: { base: "#ffedd5", spot: "#dc2626" },
    decor: ["ember", "crack"],
    solids: ["volcano", "obsidian"],
  },
  {
    id: "cloud",
    name: "Cloud Kingdom",
    ground: "#9bd0ff",
    ground2: "#86c2f7",
    path: "#ffffff",
    fence: "#f0b429",
    ink: "#173b78",
    mult: 75_000,
    speedReq: 26,
    guardRatio: 0.985,
    wake: 0.32,
    // As sharp at cutting you off as Starry Space, the highest that has been play-tested.
    cunning: 0.45,
    guard: { body: "#64748b", belly: "#e2e8f0", accent: "#facc15", shape: "wide", ears: "horns", back: "fluff", face: "fang", pattern: "stripes", cheeks: "#fde68a" },
    egg: { base: "#ffffff", spot: "#f472b6" },
    decor: ["wisp", "arc"],
    solids: ["cloud", "pillar"],
  },
];
/** Rebirth opens once Starry Space does, as it always has; the newer lands are a bonus on top. */
export const REBIRTH_LAND = 4;

/* ---------- Pets: one per biome and rarity ---------- */

export const PETS: PetDef[] = [
  // Sunny Meadow
  { id: "clover-bun", name: "Clover Bun", biome: 0, rarity: 0,
    look: { body: "#fdf0d8", belly: "#ffffff", accent: "#f9a8d4", ears: "long", tail: "puff", cheeks: "#fda4af" },
    blurb: "Hops in zigzags and nibbles four-leaf clovers for luck." },
  { id: "dandy-duckling", name: "Dandy Duckling", biome: 0, rarity: 1,
    look: { body: "#fde68a", belly: "#fffbeb", accent: "#f97316", ears: "tuft", tail: "puff", face: "beak", cheeks: "#fdba74" },
    blurb: "Waddles in a straight line. Mostly." },
  { id: "honey-cub", name: "Honey Cub", biome: 0, rarity: 2,
    look: { body: "#fbbf24", belly: "#fef3c7", accent: "#78350f", ears: "round", back: "wings", pattern: "stripes", cheeks: "#fb923c" },
    blurb: "Half bear, half bee. Buzzes when it's happy." },
  { id: "petal-fox", name: "Petal Fox", biome: 0, rarity: 3,
    look: { body: "#fb7185", belly: "#ffe4e6", accent: "#be123c", ears: "pointy", tail: "long", hat: "flower", face: "cat", cheeks: "#fecdd3" },
    blurb: "Leaves a trail of flower petals wherever it trots." },
  { id: "sunny-lion", name: "Sunny Lion", biome: 0, rarity: 4,
    look: { body: "#fcd34d", belly: "#fef9c3", accent: "#ea580c", ears: "round", tail: "long", back: "mane", hat: "crown", face: "cat", cheeks: "#fdba74" },
    blurb: "Its mane glows like the sun. Roars only in whispers." },

  { id: "bloom-stag", name: "Bloom Stag", biome: 0, rarity: 5,
    look: { body: "#86efac", belly: "#f0fdf4", accent: "#ec4899", ears: "horns", tail: "puff", back: "mane", pattern: "spots", hat: "flower", face: "cat", cheeks: "#f9a8d4", aura: "#f472b6" },
    blurb: "Flowers bloom under every step it takes." },

  // Coral Beach
  { id: "puddle-pup", name: "Puddle Pup", biome: 1, rarity: 0,
    look: { body: "#7dd3fc", belly: "#e0f2fe", accent: "#0369a1", ears: "floppy", tail: "long", pattern: "spots", cheeks: "#f9a8d4" },
    blurb: "Never met a puddle it didn't want to splash in." },
  { id: "sandy-crab", name: "Sandy Crab", biome: 1, rarity: 1,
    look: { body: "#fb923c", belly: "#ffedd5", accent: "#c2410c", shape: "wide", ears: "tuft", pattern: "spots", cheeks: "#fecaca" },
    blurb: "Walks sideways and waves at everybody." },
  { id: "shelly", name: "Shelly", biome: 1, rarity: 2,
    look: { body: "#5eead4", belly: "#ccfbf1", accent: "#0f766e", ears: "none", back: "shell", shape: "wide", cheeks: "#fda4af" },
    blurb: "Slow and steady. Keeps snacks inside its shell." },
  { id: "mer-kitty", name: "Mer-Kitty", biome: 1, rarity: 3,
    look: { body: "#f0abfc", belly: "#fae8ff", accent: "#a21caf", ears: "pointy", tail: "fish", hat: "bow", face: "cat", cheeks: "#f9a8d4" },
    blurb: "A kitty that actually LOVES bath time." },
  { id: "tide-dragon", name: "Tide Dragon", biome: 1, rarity: 4,
    look: { body: "#22d3ee", belly: "#cffafe", accent: "#0e7490", ears: "horns", tail: "long", back: "wings", pattern: "spots", face: "fang", hat: "crown", cheeks: "#a5f3fc" },
    blurb: "Makes little waves by wiggling its tail." },

  { id: "pearl-narwhal", name: "Pearl Narwhal", biome: 1, rarity: 5,
    look: { body: "#e0f2fe", belly: "#ffffff", accent: "#06b6d4", ears: "unihorn", tail: "fish", pattern: "stars", hat: "halo", cheeks: "#f9a8d4", aura: "#22d3ee" },
    blurb: "Its horn shines like moonlight on the sea." },

  // Frosty Peak
  { id: "snow-puff", name: "Snow Puff", biome: 2, rarity: 0,
    look: { body: "#475569", belly: "#f8fafc", accent: "#f59e0b", ears: "none", shape: "tall", face: "beak", cheeks: "#fda4af" },
    blurb: "Slides on its tummy to get everywhere faster." },
  { id: "mitten-kitten", name: "Mitten Kitten", biome: 2, rarity: 1,
    look: { body: "#fecdd3", belly: "#fff1f2", accent: "#e11d48", ears: "pointy", tail: "puff", hat: "scarf", hatColor: "#34d399", face: "cat", cheeks: "#fda4af" },
    blurb: "Has four mittens and has lost three of them." },
  { id: "frosty-fox", name: "Frosty Fox", biome: 2, rarity: 2,
    look: { body: "#dbeafe", belly: "#ffffff", accent: "#3b82f6", ears: "pointy", tail: "long", hat: "scarf", face: "cat", cheeks: "#fbcfe8" },
    blurb: "Wears a scarf even though it never gets cold." },
  { id: "aurora-owl", name: "Aurora Owl", biome: 2, rarity: 3,
    look: { body: "#a78bfa", belly: "#ede9fe", accent: "#2dd4bf", ears: "tuft", back: "wings", pattern: "spots", face: "beak", cheeks: "#f0abfc" },
    blurb: "Its feathers shimmer like the northern lights." },
  { id: "blizzard-yeti", name: "Blizzard Yeti", biome: 2, rarity: 4,
    look: { body: "#f1f5f9", belly: "#bae6fd", accent: "#0ea5e9", ears: "horns", shape: "wide", back: "fluff", face: "fang", hat: "crown", cheeks: "#fda4af" },
    blurb: "Big, fluffy, and gives the warmest hugs." },

  { id: "frost-phoenix", name: "Frost Phoenix", biome: 2, rarity: 5,
    look: { body: "#bae6fd", belly: "#f0f9ff", accent: "#6366f1", ears: "tuft", tail: "flame", back: "wings", pattern: "stars", face: "beak", hat: "crown", cheeks: "#c7d2fe", aura: "#818cf8" },
    blurb: "A bird made of snowflakes that never melt." },

  // Candy Canyon
  { id: "gummy-cub", name: "Gummy Cub", biome: 3, rarity: 0,
    look: { body: "#f87171", belly: "#fecaca", accent: "#b91c1c", ears: "round", cheeks: "#fee2e2" },
    blurb: "Bouncy, squishy, and smells like cherries." },
  { id: "jelly-bunny", name: "Jelly Bunny", biome: 3, rarity: 1,
    look: { body: "#a78bfa", belly: "#ede9fe", accent: "#6d28d9", ears: "long", tail: "puff", pattern: "spots", cheeks: "#f0abfc" },
    blurb: "Wobbles when it hops. Grape flavour." },
  { id: "sprinkle-pup", name: "Sprinkle Pup", biome: 3, rarity: 2,
    look: { body: "#f9a8d4", belly: "#fce7f3", accent: "#db2777", ears: "floppy", tail: "puff", pattern: "sprinkles", cheeks: "#fb7185" },
    blurb: "Shakes off sprinkles instead of water." },
  { id: "lolli-cat", name: "Lolli Cat", biome: 3, rarity: 3,
    look: { body: "#86efac", belly: "#f0fdf4", accent: "#ec4899", ears: "pointy", tail: "long", pattern: "stripes", hat: "bow", face: "cat", cheeks: "#f9a8d4" },
    blurb: "Purrs in swirls. Slightly sticky paws." },
  { id: "sugar-unicorn", name: "Sugar Unicorn", biome: 3, rarity: 4,
    look: { body: "#fdf4ff", belly: "#ffffff", accent: "#e879f9", ears: "unihorn", tail: "star", back: "mane", pattern: "sprinkles", cheeks: "#f9a8d4" },
    blurb: "Sneezes glitter. Says excuse me every time." },

  { id: "bubblegum-king", name: "Bubblegum King", biome: 3, rarity: 5,
    look: { body: "#f472b6", belly: "#fdf2f8", accent: "#7c3aed", shape: "wide", ears: "round", tail: "puff", back: "fluff", pattern: "sprinkles", hat: "crown", cheeks: "#fbcfe8", aura: "#c084fc" },
    blurb: "Blows the biggest bubbles in the whole canyon." },

  // Starry Space
  { id: "moon-mouse", name: "Moon Mouse", biome: 4, rarity: 0,
    look: { body: "#cbd5e1", belly: "#f8fafc", accent: "#f472b6", ears: "round", tail: "long", cheeks: "#f9a8d4" },
    blurb: "Thinks the moon is made of cheese. Might be right." },
  { id: "rocket-pup", name: "Rocket Pup", biome: 4, rarity: 1,
    look: { body: "#e2e8f0", belly: "#f8fafc", accent: "#ef4444", ears: "floppy", tail: "flame", hat: "propeller", cheeks: "#fca5a5" },
    blurb: "Wags its tail so fast it lifts off." },
  { id: "comet-cat", name: "Comet Cat", biome: 4, rarity: 2,
    look: { body: "#6366f1", belly: "#c7d2fe", accent: "#f97316", ears: "pointy", tail: "flame", face: "cat", cheeks: "#a5b4fc" },
    blurb: "Chases its own fiery tail across the sky." },
  { id: "nebula-bunny", name: "Nebula Bunny", biome: 4, rarity: 3,
    look: { body: "#c084fc", belly: "#f3e8ff", accent: "#22d3ee", ears: "long", tail: "puff", pattern: "stars", hat: "halo", cheeks: "#f0abfc" },
    blurb: "Hops from star to star without a sound." },
  { id: "galaxy-dragon", name: "Galaxy Dragon", biome: 4, rarity: 4,
    look: { body: "#4338ca", belly: "#a5b4fc", accent: "#f0abfc", ears: "horns", tail: "star", back: "wings", pattern: "stars", face: "fang", hat: "crown", cheeks: "#818cf8" },
    blurb: "Keeps a pocket full of baby stars." },
  { id: "nova-kitty", name: "Nova Kitty", biome: 4, rarity: 5,
    look: { body: "#1e1b4b", belly: "#4338ca", accent: "#fde047", ears: "pointy", tail: "star", pattern: "stars", hat: "halo", face: "cat", cheeks: "#a5b4fc", aura: "#fde047" },
    blurb: "Born when a star went POP. Purrs like thunder." },

  // Spooky Hollow
  { id: "boo-bunny", name: "Boo Bunny", biome: 5, rarity: 0,
    look: { body: "#f5f3ff", belly: "#ffffff", accent: "#8b5cf6", ears: "long", tail: "puff", cheeks: "#ddd6fe" },
    blurb: "Says BOO, then says sorry." },
  { id: "pumpkin-pup", name: "Pumpkin Pup", biome: 5, rarity: 1,
    look: { body: "#fb923c", belly: "#ffedd5", accent: "#15803d", ears: "floppy", tail: "puff", pattern: "stripes", cheeks: "#fdba74" },
    blurb: "Smells like pie. Glows a little at night." },
  { id: "batty-cat", name: "Batty Cat", biome: 5, rarity: 2,
    look: { body: "#6d5aa8", belly: "#ddd6fe", accent: "#2e1065", ears: "pointy", tail: "long", back: "wings", face: "cat", cheeks: "#c4b5fd" },
    blurb: "Naps upside down. Lands on its feet anyway." },
  { id: "candle-owl", name: "Candle Owl", biome: 5, rarity: 3,
    look: { body: "#fef3c7", belly: "#fffbeb", accent: "#f97316", ears: "tuft", tail: "flame", back: "wings", face: "beak", hat: "wizard", cheeks: "#fdba74" },
    blurb: "Reads spooky stories by the light of its own tail." },
  { id: "midnight-wolf", name: "Midnight Wolf", biome: 5, rarity: 4,
    look: { body: "#312e81", belly: "#a5b4fc", accent: "#f97316", ears: "pointy", tail: "long", back: "mane", pattern: "stars", face: "fang", hat: "crown", cheeks: "#818cf8" },
    blurb: "Howls so softly it sounds like a lullaby." },
  { id: "wisp-queen", name: "Wisp Queen", biome: 5, rarity: 5,
    look: { body: "#c4b5fd", belly: "#f5f3ff", accent: "#22d3ee", shape: "tall", ears: "tuft", tail: "flame", back: "wings", pattern: "stars", hat: "crown", cheeks: "#a5f3fc", aura: "#a78bfa" },
    blurb: "A friendly ghost light who rules the whole hollow." },

  // Lava Lagoon
  { id: "cinder-chick", name: "Cinder Chick", biome: 6, rarity: 0,
    look: { body: "#fca5a5", belly: "#fee2e2", accent: "#b91c1c", ears: "tuft", tail: "flame", face: "beak", cheeks: "#fdba74" },
    blurb: "Hatched warm and stays warm. Great for cold toes." },
  { id: "magma-mole", name: "Magma Mole", biome: 6, rarity: 1,
    look: { body: "#78350f", belly: "#fdba74", accent: "#f97316", shape: "wide", ears: "round", pattern: "spots", cheeks: "#fb923c" },
    blurb: "Digs cosy tunnels and warms them up for friends." },
  { id: "ember-fox", name: "Ember Fox", biome: 6, rarity: 2,
    look: { body: "#f97316", belly: "#ffedd5", accent: "#7c2d12", ears: "pointy", tail: "flame", hat: "scarf", hatColor: "#facc15", face: "cat", cheeks: "#fde68a" },
    blurb: "Its tail flickers when it is excited, so, always." },
  { id: "smoky-salamander", name: "Smoky Salamander", biome: 6, rarity: 3,
    look: { body: "#475569", belly: "#fb923c", accent: "#ef4444", ears: "none", tail: "long", pattern: "stripes", face: "smile", hat: "tophat", cheeks: "#fca5a5" },
    blurb: "Blows smoke rings shaped like hearts." },
  { id: "volcano-rex", name: "Volcano Rex", biome: 6, rarity: 4,
    look: { body: "#b91c1c", belly: "#fde68a", accent: "#450a0a", shape: "wide", ears: "horns", tail: "flame", back: "shell", face: "fang", hat: "crown", cheeks: "#fdba74" },
    blurb: "Stomps very loudly and apologises very quietly." },
  { id: "inferno-kirin", name: "Inferno Kirin", biome: 6, rarity: 5,
    look: { body: "#fde047", belly: "#fffbeb", accent: "#dc2626", ears: "unihorn", tail: "flame", back: "mane", pattern: "stripes", hat: "halo", face: "cat", cheeks: "#fdba74", aura: "#fb923c" },
    blurb: "Runs across lava without singeing a single hoof." },

  // Cloud Kingdom
  { id: "cloud-lamb", name: "Cloud Lamb", biome: 7, rarity: 0,
    look: { body: "#ffffff", belly: "#f1f5f9", accent: "#93c5fd", ears: "floppy", tail: "puff", back: "fluff", cheeks: "#fbcfe8" },
    blurb: "So fluffy it floats a little when it sneezes." },
  { id: "breeze-birdie", name: "Breeze Birdie", biome: 7, rarity: 1,
    look: { body: "#7dd3fc", belly: "#f0f9ff", accent: "#f59e0b", ears: "tuft", back: "wings", face: "beak", cheeks: "#fda4af" },
    blurb: "Whistles the wind's favourite song." },
  { id: "sunbeam-cub", name: "Sunbeam Cub", biome: 7, rarity: 2,
    look: { body: "#fde68a", belly: "#fffbeb", accent: "#f59e0b", ears: "round", tail: "puff", back: "mane", hat: "halo", cheeks: "#fdba74" },
    blurb: "Finds the one sunny spot on any cloud and naps in it." },
  { id: "prism-pegasus", name: "Prism Pegasus", biome: 7, rarity: 3,
    look: { body: "#f5d0fe", belly: "#ffffff", accent: "#38bdf8", ears: "pointy", tail: "star", back: "wings", pattern: "stars", hat: "bow", hatColor: "#f472b6", cheeks: "#fbcfe8" },
    blurb: "Leaves a tiny rainbow every time it lands." },
  { id: "thunder-griffin", name: "Thunder Griffin", biome: 7, rarity: 4,
    look: { body: "#fbbf24", belly: "#f8fafc", accent: "#1d4ed8", ears: "tuft", tail: "long", back: "wings", pattern: "stripes", face: "beak", hat: "crown", cheeks: "#fde68a" },
    blurb: "Claps its wings to make thunder, then giggles." },
  { id: "sky-emperor", name: "Sky Emperor", biome: 7, rarity: 5,
    look: { body: "#bfdbfe", belly: "#ffffff", accent: "#f59e0b", shape: "tall", ears: "horns", tail: "star", back: "wings", pattern: "stars", face: "fang", hat: "crown", cheeks: "#fde68a", aura: "#fde047" },
    blurb: "A cloud dragon who keeps the sunrise in its pocket." },
];

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
export const petById = (id: string): PetDef | undefined => PET_BY_ID.get(id);
export const petFor = (biome: number, rarity: Rarity): PetDef =>
  PETS.find((p) => p.biome === biome && p.rarity === rarity) ?? PETS[0];

/* ---------- Hatch rolls: every pet gets a variant and a size ---------- */

export interface Variant {
  name: string;
  mult: number;
  color: string;
}

/** Index 0 is a plain pet. Each step up is rarer and earns more. Saved by index, so only ever add to the end. */
export const VARIANTS: Variant[] = [
  { name: "", mult: 1, color: "#94a3b8" },
  { name: "Shiny", mult: 3, color: "#facc15" },
  { name: "Golden", mult: 8, color: "#f59e0b" },
  { name: "Rainbow", mult: 25, color: "#e879f9" },
  // Glow: the pet in its own special colours, lit up like a night light. The rarest roll.
  { name: "Glow", mult: 60, color: "#22d3ee" },
];
export const GLOW = 4;

export interface SizeTier {
  name: string;
  mult: number;
  /** How much bigger it is drawn. */
  scale: number;
  /** Chance of rolling this size. */
  chance: number;
}

export const SIZES: SizeTier[] = [
  { name: "", mult: 1, scale: 1, chance: 0.7 },
  { name: "Big", mult: 1.5, scale: 1.2, chance: 0.2 },
  { name: "Huge", mult: 2.5, scale: 1.45, chance: 0.08 },
  { name: "Titanic", mult: 5, scale: 1.8, chance: 0.02 },
];

/** Coins per second for one pet, before upgrades and decorations. */
export const petRate = (def: PetDef, variant = 0, size = 0) =>
  BIOMES[def.biome].mult * RARITIES[def.rarity].mult * VARIANTS[variant].mult * SIZES[size].mult;

/** "Huge Golden Honey Cub" */
export const traitName = (def: PetDef, variant = 0, size = 0) =>
  [SIZES[size].name, VARIANTS[variant].name, def.name].filter(Boolean).join(" ");

/** A hatch worth stopping the game to show off. */
export const isJackpot = (variant: number, size: number) => variant >= 2 || size >= 2;

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
  | "dash" | "warm" | "socks" | "treats" | "sparkle"
  | "hands" | "arms" | "ripen"
  | "courier" | "jar";

export const UPGRADE_IDS: UpgradeId[] = [
  "speed", "dash", "hands", "arms", "basket", "pen", "treats", "courier", "jar", "warm", "ripen", "luck", "sparkle", "socks",
];

/** Sneakers add 16 to your speed per level up to level 18, and a gentler 6 after that. */
export const playerSpeed = (level: number) => 190 + 16 * Math.min(level, 18) + 6 * Math.max(0, level - 18);
export const guardSpeed = (biome: number) =>
  playerSpeed(BIOMES[biome].speedReq) * BIOMES[biome].guardRatio;

// Sneaker prices. Gates open at levels 3, 6, 10, 14, 18, 22 and 26, so each
// group below is "what it costs to reach the next land".
const SPEED_COSTS = [
  20, 40, 80,
  300, 800, 2_000,
  6_000, 15_000, 35_000, 80_000,
  200_000, 500_000, 1_200_000, 3_000_000,
  6_000_000, 12_000_000, 25_000_000, 50_000_000,
  150_000_000, 400_000_000, 1_000_000_000, 2_500_000_000,
  6_000_000_000, 15_000_000_000, 40_000_000_000, 100_000_000_000,
  250_000_000_000, 600_000_000_000,
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
  // Quick Hands: lift valuable eggs faster.
  hands: [600, 12_000, 300_000, 8_000_000],
  // Strong Arms: heavy eggs slow you less.
  arms: [900, 20_000, 500_000, 12_000_000],
  // Sunny Nests: eggs ripen sooner.
  ripen: [1_500, 40_000, 1_000_000, 25_000_000],
  // Egg Courier: a little bird that brings eggs home by itself.
  courier: [2_500, 30_000, 400_000, 5_000_000, 60_000_000],
  // Coin Jar: pets keep earning for longer, and more, while you're away.
  jar: [1_000, 15_000, 250_000, 4_000_000, 50_000_000],
};
/** Seconds between the courier's deliveries. */
export const courierEvery = (level: number) => [Infinity, 60, 45, 30, 20, 12][Math.min(level, 5)];
/** How long pets keep earning while the game is closed, and at what share of full speed. */
export const awayCap = (level: number) => [600, 1800, 3600, 7200, 14_400, 28_800][Math.min(level, 5)];
export const awayShare = (level: number) => [0.5, 0.6, 0.7, 0.8, 0.9, 1][Math.min(level, 5)];

/* ---------- Rebirth ---------- */

/** Each Golden Feather adds this much to all coin income, forever. */
export const FEATHER_BONUS = 0.1;
/** Golden Feathers a rebirth would pay for the coins earned since the last one. */
export const feathersFor = (runEarned: number) => Math.floor(Math.pow(Math.max(0, runEarned) / 1_000_000, 0.4));

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
export const handsScale = (level: number) => [1, 0.82, 0.66, 0.52, 0.4][Math.min(level, 4)];
export const armsScale = (level: number) => [1, 0.75, 0.5, 0.25, 0][Math.min(level, 4)];
export const ripenScale = (level: number) => [1, 0.85, 0.7, 0.55, 0.4][Math.min(level, 4)];

/**
 * Roll a hatch variant. Golden is 5x rarer than Shiny, Rainbow 5x rarer again,
 * and Glow 3x rarer than Rainbow: about 1 hatch in 1,500 with no Sparkle Charm
 * and 1 in 375 with all of it.
 */
export function rollVariant(sparkleLevel: number, boost = 1): number {
  const shiny = Math.min(0.9, shinyChance(sparkleLevel) * boost);
  const r = Math.random();
  if (r < shiny / 75) return GLOW;
  if (r < shiny / 25) return 3;
  if (r < shiny / 5) return 2;
  return r < shiny ? 1 : 0;
}

export function rollSize(): number {
  let r = Math.random();
  for (let i = SIZES.length - 1; i > 0; i--) {
    if (r < SIZES[i].chance) return i;
    r -= SIZES[i].chance;
  }
  return 0;
}

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
  | "none" | "sparkle" | "leaf" | "snow" | "heart" | "bubble" | "star" | "fire" | "rainbow" | "zip";

export interface TrailDef {
  id: TrailId;
  name: string;
  cost: number;
  shape: "dot" | "star" | "heart" | "ring";
  colors: string[];
  /** Can't be bought: this says how it is won instead. */
  prize?: string;
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
  { id: "zip", name: "Zip's Zoom", cost: Infinity, shape: "star", colors: ["#2dd4bf", "#99f6e4", "#ffffff"], prize: "Gold in Tag" },
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
/** A bumped lollipop needs this long to grow its sparkle back. */
export const LOLLIPOP_COOLDOWN = 12;
/** How close you have to walk before a lollipop shows its speed badge (and the one-time tip). */
export const LOLLIPOP_NEAR = 170;
export const SECRET_STAR_REWARD = 3;
export const IDLE_SLEEP_AFTER = 25;

/* ---------- Layout ---------- */

export interface Point {
  x: number;
  y: number;
}

/** Where things sit inside a biome, relative to its top edge. */
export const GUARD_POST = { x: CENTER_X, dy: 220 };
/** Half the width of the middle of a land. Past it, left and right, are the side groves. */
export const WING_X = 480;
const NEST_SPOTS: { dx: number; dy: number; golden: boolean; far?: boolean }[] = [
  { dx: -245, dy: 305, golden: false },
  { dx: 245, dy: 305, golden: false },
  // The golden nest (better eggs) hides up behind the Grumble, off the path.
  { dx: -172, dy: 104, golden: true },
  // Grove nests: a long way off to the sides, past the mini-Grumbles, with better eggs.
  { dx: -625, dy: 440, golden: false, far: true },
  { dx: 655, dy: 175, golden: false, far: true },
];
/** Nest positions in world space. The golden and grove nests swap sides each biome. */
export const nestSpots = (biome: number): (Point & { golden: boolean; far: boolean })[] =>
  NEST_SPOTS.map((n) => ({
    x: CENTER_X + ((n.golden || n.far) && biome % 2 === 1 ? -n.dx : n.dx),
    y: biomeTop(biome) + n.dy,
    golden: n.golden,
    far: Boolean(n.far),
  }));
export const FAR_NEST_LUCK = 2;

/* ---------- Ancient nests and Power Eggs ---------- */

export type PowerEggId = "clover" | "snail" | "frost" | "feather" | "star" | "ghost" | "magma" | "cloud";
export interface PowerEggDef {
  id: PowerEggId;
  /** The land whose ancient nest lays it. */
  biome: number;
  name: string;
  desc: string;
  color: string;
}
export const POWER_EGGS: PowerEggDef[] = [
  { id: "clover", biome: 0, name: "Clover Egg", desc: "+2 luck on every nest.", color: "#22c55e" },
  { id: "snail", biome: 1, name: "Snail Egg", desc: "Every Grumble moves 25% slower.", color: "#f97316" },
  { id: "frost", biome: 2, name: "Frost Egg", desc: "Adds a FREEZE button that stops every Grumble for 3 seconds.", color: "#38bdf8" },
  { id: "feather", biome: 3, name: "Feather Egg", desc: "Once every 90 seconds, getting caught doesn't send you home.", color: "#ec4899" },
  { id: "star", biome: 4, name: "Star Egg", desc: "Your pets earn 50% more coins.", color: "#a855f7" },
  { id: "ghost", biome: 5, name: "Ghost Egg", desc: "You are extra quiet: every Grumble takes half a second longer to wake.", color: "#8b5cf6" },
  { id: "magma", biome: 6, name: "Magma Egg", desc: "Eggs on your pads hatch twice as fast.", color: "#ef4444" },
  { id: "cloud", biome: 7, name: "Cloud Egg", desc: "The eggs you carry are light as air and never slow you down.", color: "#eab308" },
];
export const GHOST_WAKE = 0.5;
export const MAGMA_HATCH = 2;
export const powerEggById = (id: string) => POWER_EGGS.find((e) => e.id === id);
/** One ancient nest per land, deep in a side grove. */
export const ancientSpot = (biome: number): Point => ({
  x: CENTER_X + (biome % 2 === 0 ? 748 : -748),
  y: biomeTop(biome) + 330,
});
/** Seconds an ancient nest takes to lay its Power Egg, per land. */
export const ANCIENT_TIME = [120, 180, 240, 300, 360, 420, 480, 540];
/** Lifting a Power Egg, in Grumble wake times, and how much it slows you. */
export const ANCIENT_GRAB = 1.2;
export const ANCIENT_WEIGHT = 0.15;
export const CLOVER_LUCK = 2;
export const SNAIL_SLOW = 0.75;
export const STAR_EGG_COINS = 1.5;
export const FREEZE_TIME = 3;
export const FREEZE_CD = 40;
export const FEATHER_CD = 90;
/** How many Power Eggs you can wear at once. */
export const equipSlots = (level: number) => (level >= 12 ? 3 : level >= 7 ? 2 : level >= 3 ? 1 : 0);
export const SLOT_LEVELS = [3, 7, 12];

/* ---------- Mini-Grumbles ---------- */

export const MINI_R = 24;
/** They pace up and down this far either side of the path. */
export const MINI_LANE = 452;
export const MINI_SEE = 190;
export const MINI_LEASH = 380;
/** Pace and chase speed, as a share of the land's big Grumble. */
export const MINI_PATROL = 0.42;
export const MINI_CHASE = 0.88;
/** Grabbing an egg wakes every Grumble; this long they stay on the lookout. */
export const ALERT_TIME = 20;
/** A Grumble never chases slower than this share of your own top speed. */
export const ALARM_SPEED = 0.6;

/* ---------- Cutting you off at the gate ---------- */
// A Grumble that sees you carrying an egg straight for the gate stops running
// at you and runs to block your way instead. Each land's `cunning` says how
// good its guess is. Cozy style never does this.

/** Seconds of running straight at the gate before a Grumble works out where you're going. */
export const CUT_READ = 0.45;
/** Seconds of heading somewhere else before it stops believing it. Half of this is how long a fake-out fools it. */
export const CUT_FORGET = 0.7;
/** How squarely you must be aimed at the gate to give yourself away (1 = dead on, 0.75 is about 40 degrees either side). */
export const CUT_AIM = 0.75;
/** It never blocks closer to the gate than this, so it can't just stand in the gateway. */
export const CUT_KEEP = 130;
/** Once it is this close to you it forgets the plan and just grabs for you. */
export const CUT_NEAR = 60;

/* ---------- Grumbles bonk their heads ---------- */
// A Grumble that runs into scenery while chasing you loses a heart. At zero
// it is knocked out for a while, then shuffles home with all its hearts back.

export const GUARD_HP = 3;
/** Seconds a Grumble sees stars after a bonk, and how long before the next bonk can count. */
export const BONK_STUN = 0.7;
export const BONK_GRACE = 1.3;
/** Seconds a Grumble stays knocked out. */
export const KNOCKOUT_TIME = 8;
/** A knockout pays this many seconds of your pets' income, and some XP. */
export const KNOCKOUT_SECONDS = 30;
export const KNOCKOUT_XP = 15;
/** Share of a Grumble's size that bumps into scenery (the rest squeezes past). */
export const GUARD_BODY = 0.6;

/* ---------- Power-ups you find lying around ---------- */

export type PowerupId = "dizzy" | "bubble" | "clock";
export const POWERUPS: Record<PowerupId, { name: string; desc: string; color: string }> = {
  dizzy: { name: "Dizzy Candy", desc: "Grumbles wander around confused for 6 seconds.", color: "#e879f9" },
  bubble: { name: "Bubble Shield", desc: "Pops by itself to save you from one catch.", color: "#38bdf8" },
  clock: { name: "Hourglass", desc: "Every egg ripens right now.", color: "#facc15" },
};
export const POWERUP_IDS = Object.keys(POWERUPS) as PowerupId[];
export const DIZZY_TIME = 6;
export const POWERUP_EVERY = [25, 45];
export const POWERUP_LIFE = 70;
export const CLOCK_ANCIENT_SKIP = 60;

/* ---------- Levels ---------- */

export const MAX_LEVEL = 50;
/** XP needed to get from this level to the next. */
export const xpNeed = (level: number) => Math.round(30 * Math.pow(level, 1.5));
/** Every level adds this much to all coin income. */
export const LEVEL_COIN_BONUS = 0.02;
const LEVEL_TITLES = ["Egg Rookie", "Nest Ninja", "Grumble Dodger", "Grove Explorer", "Egg Master", "Shadow Sneak", "Legend of the Lands"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor(level / 5))];

/* ---------- Mini games ---------- */
// Three little games behind striped tents. Anyone can play any time; each
// tent's prize comes back on a timer (real time, like the gift chest).

export type MiniId = "tag" | "steps" | "seek";
/** 0 none, 1 bronze, 2 silver, 3 gold. */
export type Medal = 0 | 1 | 2 | 3;
export const MEDAL_NAMES = ["No medal", "Bronze", "Silver", "Gold"];
export const MEDAL_COLORS = ["#94a3b8", "#cd7f32", "#cbd5e1", "#fbbf24"];

export interface MiniDef {
  id: MiniId;
  name: string;
  /** The land its tent stands in; -1 is Home. */
  biome: number;
  x: number;
  y: number;
  color: string;
  blurb: string;
  how: string[];
  /** The prize, in a few words. */
  prize: string;
  /** How long the prize takes to come back, in ms. */
  prizeMs: number;
}

export const MINI_DOOR_R = 34;
export const MINIS: MiniDef[] = [
  {
    id: "seek", name: "Hide and Seek", biome: -1,
    x: CENTER_X + 300, y: HOME_TOP + 278, color: "#22c55e",
    blurb: "Your pets are hiding. Can you find them all?",
    how: ["Watch for ears peeking out.", "Push into a hiding spot to look inside.", "Find everyone before time runs out!"],
    prize: "Happy pets: double coins",
    prizeMs: 15 * 60 * 1000,
  },
  {
    id: "tag", name: "Tag with Zip", biome: 0,
    x: CENTER_X + 215, y: biomeBottom(0) - 108, color: "#14b8a6",
    blurb: "Zip is the fastest critter in the meadow. Catch him if you can!",
    how: ["First you're it: tag Zip as many times as you can.", "Then Zip is it: run and keep your hearts!"],
    prize: "Zoomies: run faster",
    prizeMs: 15 * 60 * 1000,
  },
  {
    id: "steps", name: "Sleepy Steps", biome: 1,
    x: CENTER_X - 215, y: biomeBottom(1) - 108, color: "#f97316",
    blurb: "Tiptoe up to the giant egg while the Grumble naps.",
    how: ["Sneak forward while its eye is shut.", "Freeze when the eye opens!", "Touch the giant egg to win."],
    prize: "Lucky Dice",
    prizeMs: 10 * 60 * 1000,
  },
];
export const miniById = (id: string) => MINIS.find((m) => m.id === id);

/** Seconds of Zoomies (Tag) and happy pets (Hide and Seek) for bronze, silver and gold. */
export const MINI_BUFF_TIME = [0, 180, 360, 600];
/** Zoomies: how much faster you run. */
export const ZOOMIES_BOOST = 1.2;
/** Happy pets: every coin counts this many times. */
export const HAPPY_COINS = 2;
/** Lucky Dice from Sleepy Steps for bronze, silver and gold, and the most you can hold. */
export const MINI_DICE = [0, 1, 2, 3];
export const DICE_MAX = 9;
/** A roll that changes nothing pays this many seconds of the pet's income instead. */
export const DICE_CONSOLATION = 90;
/** Playing while the prize is still refilling pays a small tip: seconds of income per medal step. */
export const MINI_TIP_SECONDS = 8;

/** How fast you run inside a mini game (the same for everyone, whatever sneakers you own). */
export const MINI_SPEED = 190;

/** Zip, who runs the tag tent. */
export const ZIP_LOOK: Look = {
  body: "#2dd4bf", belly: "#ccfbf1", accent: "#0f766e", ears: "long", tail: "puff",
  pattern: "stripes", hat: "scarf", hatColor: "#f43f5e", cheeks: "#fda4af",
};

export const TAG_TUNING = {
  /** Seconds for each half: you chase, then Zip chases. */
  catchTime: 25,
  runTime: 20,
  hearts: 3,
  /** Zip's speed next to yours while he runs away; he speeds up with every catch. */
  flee: [0.62, 0.7, 0.78, 0.85, 0.9, 0.94, 0.97, 1],
  /** He only starts sidestepping once you've tagged him this many times. */
  jukeAfter: 2,
  /** ...and while he chases, from the start of the round to the end. */
  chase: [0.66, 0.98],
  /** Seconds between Zip's dashes. */
  dashEvery: [3.2, 4.6],
  /** No dashes for the first few seconds of his turn. */
  dashAfter: 5,
  /** Cozy style: Zip is this much slower and never dashes or jukes. */
  cozy: 0.72,
  /** Catches plus hearts left needed for bronze, silver and gold. */
  medals: [2, 6, 9],
};

export const STEPS_TUNING = {
  /** Tiptoe speed and how far it is to the giant egg. */
  speed: 70,
  track: 480,
  /** Seconds on the clock (Cozy has no clock). */
  time: 45,
  /** How long the Grumble sleeps, at the start of the track and right next to it. */
  sleepFar: [1.0, 2.0],
  sleepNear: [0.7, 1.4],
  /** The warning wiggle before the eye opens, far and near. */
  stir: [0.75, 0.5],
  awake: [1.2, 2.4],
  /** How often a wiggle is a false alarm. */
  fake: 0.22,
  /** Seconds you have to stop after the eye opens. */
  grace: 0.16,
  cozyGrace: 0.4,
  /** Cozy style: being seen only sends you back this far. */
  cozyBack: 90,
  /** Finish in this many seconds for silver and gold. Just finishing is bronze. */
  medals: [22, 13],
};

export const SEEK_TUNING = {
  /** Places to hide. */
  spots: 12,
  /** Pets hiding in the first round and the second. */
  rounds: [4, 6],
  /** Cozy style: fewer places to look and fewer pets to find. */
  cozySpots: 9,
  cozyRounds: [3, 5],
  /** Seconds on the clock for both rounds together (Cozy has no clock). */
  time: 45,
  /** Seconds of pushing into a hiding spot it takes to look inside (so brushing past doesn't count). */
  lookTime: 0.32,
  /** Looking in an empty spot costs this many seconds (not in Cozy). */
  missCost: 3,
  /** Seconds between peeks, and how long each one lasts. */
  peekEvery: [2.6, 5.2],
  peekTime: 1.0,
  cozyPeekEvery: [1.2, 2.6],
  cozyPeekTime: 1.7,
  /** Finish round one for bronze, both for silver, both with this many seconds left for gold. */
  goldLeft: 12,
  /** Cozy has no clock: finish in this many seconds for silver and gold. */
  cozyMedals: [80, 50],
};

/* ---------- The FanScout house ad, and sharing ---------- */

// The ad only ever advertises our own app. How it looks and what it says is in
// `fanscout.ts`; what it pays out is here.

export type AdRewardId = "hatch" | "coins" | "luck" | "prize";

/**
 * The ad is a row of slides, and each finished slide unlocks one reward: the
 * longer you watch, the more you take home. `at` is seconds of watching.
 */
export const AD_REWARDS: { id: AdRewardId; at: number; name: string; desc: string }[] = [
  { id: "hatch", at: 5, name: "Quick Hatch", desc: "Hatch now, then 4x faster for 2 min" },
  { id: "coins", at: 10, name: "Double Coins", desc: "Every coin counts twice for 3 min" },
  { id: "luck", at: 15, name: "Lucky Nests", desc: "Rarer eggs, shinier pets for 3 min" },
  { id: "prize", at: 20, name: "Mystery Prize", desc: "Stars, a power-up or a pile of coins" },
];
export const adRewardById = (id: AdRewardId) => AD_REWARDS.find((r) => r.id === id)!;
/** Rewards unlocked after this many seconds of watching. */
export const adRewardsAt = (seconds: number) => AD_REWARDS.filter((r) => seconds >= r.at);
export const AD_LENGTH = AD_REWARDS[AD_REWARDS.length - 1].at;
/** Seconds each slide of the ad stays up. One reward per slide. */
export const AD_SLIDE_TIME = 5;
/** Seconds between ads, counted from collecting the rewards. */
export const AD_COOLDOWN = 60;
export const AD_HATCH_TIME = 120;
export const AD_HATCH_SPEED = 4;
export const AD_COINS_TIME = 180;
export const AD_LUCK_TIME = 180;
/** Lucky Nests: extra nest luck, and extra Sparkle Charm levels on hatch rolls. */
export const AD_LUCK = 2;
export const AD_LUCK_SPARKLE = 3;
/** Stars for tapping through to FanScout, once a day. */
export const AD_VISIT_STARS = 3;
/** Watching the ad on the title screen multiplies the coins your pets earned while you were away. */
export const AD_AWAY_MULT = 2;
/** The FanScout sign at home. Walk into it or tap it. */
export const BILLBOARD = { x: CENTER_X + 172, y: HOME_TOP + 118, r: 22, w: 140, h: 78 };
export const SHARE_URL = "https://games.db.rocks/eggs";

export const PLAYER_START: Point = { x: CENTER_X, y: HOME_TOP + 285 };
export const PAD_Y = HOME_TOP + 190;
export const padX = (i: number) => CENTER_X + (i - (PAD_COUNT - 1) / 2) * 124;
/** Carried eggs drop off once the player is this far into home. */
export const DELIVER_Y = HOME_TOP + 70;
export const PEN = { x0: CENTER_X - 330, x1: CENTER_X + 330, y0: HOME_TOP + 350, y1: HOME_TOP + 540 };
export const HUT = { x: CENTER_X - 358, y: HOME_TOP + 150, r: 58 };
export const CHEST = { x: CENTER_X + 358, y: HOME_TOP + 158, r: 34 };
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

/* ---------- Home town: a house that grows, and special buildings ---------- */
//
// Everything here runs on real time (like the gift chest), so a build keeps
// going while a menu is open and while the game is closed.

export interface HouseTier {
  name: string;
  /** Coins and seconds to build this tier from the one before. */
  cost: number;
  time: number;
  /** Share added to all coin income while you live in it. */
  coins: number;
  blurb: string;
}

export const HOUSE_TIERS: HouseTier[] = [
  { name: "Little Hut", cost: 0, time: 0, coins: 0, blurb: "Small, snug and all yours." },
  { name: "Cozy Cottage", cost: 4_000, time: 60, coins: 0.1, blurb: "A chimney, shutters and flower boxes." },
  { name: "Farmhouse", cost: 150_000, time: 600, coins: 0.2, blurb: "Two floors and a porch to sit on." },
  { name: "Grand Manor", cost: 5_000_000, time: 3600, coins: 0.35, blurb: "Columns, a balcony and far too many rooms." },
  { name: "Castle", cost: 150_000_000, time: 4 * 3600, coins: 0.5, blurb: "Towers, flags and a very big door." },
];
export const HOUSE_MAX = HOUSE_TIERS.length - 1;

export type BuildingId = "mill" | "bakery" | "well" | "workshop" | "barn" | "hatchery" | "sparkle";
/** Anything a builder can work on. */
export type SiteId = "house" | BuildingId;

export interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  /** House tier that opens its plot. */
  needHouse: number;
  /** Price next to the other buildings (the Windmill is 1). */
  price: number;
  color: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "mill", name: "Windmill", desc: "Grinds out coins by itself. Stop by to collect them.", needHouse: 0, price: 1, color: "#f59e0b" },
  { id: "bakery", name: "Treat Bakery", desc: "Bakes a cupcake now and then. Eat it for double coins.", needHouse: 0, price: 1.5, color: "#f472b6" },
  { id: "well", name: "Wishing Well", desc: "A star floats up every so often.", needHouse: 1, price: 2, color: "#38bdf8" },
  { id: "workshop", name: "Builder's Workshop", desc: "More builders, and they work faster.", needHouse: 1, price: 2.5, color: "#a16207" },
  { id: "barn", name: "Pet Barn", desc: "Room for more pets.", needHouse: 2, price: 2, color: "#ef4444" },
  { id: "hatchery", name: "Hatchery", desc: "Keeps eggs toasty so they hatch sooner.", needHouse: 2, price: 3, color: "#22c55e" },
  { id: "sparkle", name: "Sparkle Tower", desc: "More Shiny, Golden and Rainbow pets.", needHouse: 3, price: 4, color: "#a855f7" },
];
export const BUILDING_IDS = BUILDINGS.map((b) => b.id);
export const buildingById = (id: BuildingId): BuildingDef => BUILDINGS.find((b) => b.id === id) ?? BUILDINGS[0];
export const BUILDING_MAX = 5;

// Indexed by the level being built, 1 to 5.
const BUILD_COST = [0, 500, 20_000, 500_000, 12_000_000, 250_000_000];
const BUILD_TIME = [0, 20, 5 * 60, 30 * 60, 2 * 3600, 6 * 3600];

export const siteName = (site: SiteId, houseTier = 0) =>
  site === "house" ? HOUSE_TIERS[Math.min(houseTier, HOUSE_MAX)].name : buildingById(site).name;
export const siteMax = (site: SiteId) => (site === "house" ? HOUSE_MAX : BUILDING_MAX);
/** Coins to build `level` (the level you'd have afterwards). */
export const siteCost = (site: SiteId, level: number): number =>
  site === "house" ? HOUSE_TIERS[level].cost : Math.round(BUILD_COST[level] * buildingById(site).price);
/** Seconds one builder takes, before the Workshop and Cozy style speed it up. */
export const siteTime = (site: SiteId, level: number): number =>
  site === "house" ? HOUSE_TIERS[level].time : BUILD_TIME[level];
/** The house you need before a building can reach `level`: a bigger home for bigger buildings. */
export const houseNeeded = (id: BuildingId, level: number) =>
  Math.min(HOUSE_MAX, Math.max(buildingById(id).needHouse, level - 1));

/** Cozy style: builds take a fifth of the time. */
export const COZY_BUILD_SCALE = 0.2;
/** Each tap on a building site knocks off this many seconds, or this share of the whole build if that's more. */
export const BUILD_TAP_SECONDS = 2;
export const BUILD_TAP_SHARE = 0.003;
/** "Finish now" costs one star for every this-many seconds left. */
export const RUSH_SECONDS_PER_STAR = 15 * 60;

// What each building does, indexed by its level (0 = not built).
/** Windmill: this share of your pets' coins piles up in the mill, for up to this many hours. */
export const MILL_SHARE = [0, 0.15, 0.25, 0.35, 0.5, 0.7];
export const MILL_HOURS = [0, 0.5, 1, 2, 4, 8];
/** Bakery: seconds per cupcake, how many it keeps on the counter, and seconds of double coins in each. */
export const BAKE_EVERY = [Infinity, 600, 480, 360, 300, 240];
export const BAKE_HOLD = [0, 1, 1, 2, 2, 3];
export const CAKE_FRENZY = [0, 30, 40, 50, 60, 80];
/** Wishing Well: seconds per star and how many it holds. */
export const WELL_EVERY = [Infinity, 1800, 1440, 1080, 720, 480];
export const WELL_HOLD = [0, 2, 3, 4, 6, 8];
export const WORKSHOP_BUILDERS = [1, 2, 2, 2, 2, 3];
export const WORKSHOP_SPEED = [1, 1, 0.9, 0.8, 0.7, 0.6];
export const BARN_SPACE = [0, 2, 4, 6, 8, 10];
export const HATCHERY_SCALE = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
export const SPARKLE_MULT = [1, 1.15, 1.3, 1.5, 1.75, 2];
/** However many cupcakes you eat, double coins never stacks past this many seconds. */
export const FRENZY_MAX = 300;

/**
 * Where each building stands: down either side of home. The tall ones (Windmill,
 * Sparkle Tower) go where nothing stands behind them to be hidden.
 */
export const PLOTS: Record<BuildingId, Point> = {
  mill: { x: CENTER_X - 710, y: HOME_TOP + 175 },
  well: { x: CENTER_X - 555, y: HOME_TOP + 310 },
  barn: { x: CENTER_X - 710, y: HOME_TOP + 455 },
  hatchery: { x: CENTER_X - 545, y: HOME_TOP + 478 },
  bakery: { x: CENTER_X + 710, y: HOME_TOP + 175 },
  workshop: { x: CENTER_X + 555, y: HOME_TOP + 310 },
  sparkle: { x: CENTER_X + 710, y: HOME_TOP + 455 },
};
/** How much room a finished building takes up. */
export const PLOT_R = 44;

/* ---------- House paint (bought with stars, like hats) ---------- */

export type PaintSlot = "wall" | "roof" | "top";

export interface PaintDef {
  id: string;
  name: string;
  cost: number;
  /** Paint colour. Toppers leave it out. */
  color?: string;
}

export const WALL_PAINTS: PaintDef[] = [
  { id: "cream", name: "Cream", cost: 0, color: "#fde9c4" },
  { id: "sky", name: "Sky", cost: 2, color: "#bfe3fb" },
  { id: "mint", name: "Mint", cost: 2, color: "#c4f0d4" },
  { id: "blossom", name: "Blossom", cost: 3, color: "#fbcfe1" },
  { id: "lilac", name: "Lilac", cost: 3, color: "#ddd0fb" },
  { id: "sunny", name: "Sunny", cost: 4, color: "#fde68a" },
];
export const ROOF_PAINTS: PaintDef[] = [
  { id: "berry", name: "Berry", cost: 0, color: "#ef6f6c" },
  { id: "ocean", name: "Ocean", cost: 2, color: "#3b82f6" },
  { id: "forest", name: "Forest", cost: 2, color: "#22a06b" },
  { id: "grape", name: "Grape", cost: 3, color: "#8b5cf6" },
  { id: "bubblegum", name: "Bubblegum", cost: 3, color: "#ec4899" },
  { id: "gold", name: "Gold", cost: 8, color: "#f5b301" },
];
export const TOPPERS: PaintDef[] = [
  { id: "none", name: "Nothing", cost: 0 },
  { id: "flag", name: "Flag", cost: 2 },
  { id: "vane", name: "Weather Vane", cost: 3 },
  { id: "heart", name: "Heart", cost: 4 },
  { id: "star", name: "Star", cost: 5 },
  { id: "lights", name: "Fairy Lights", cost: 6 },
];
export const PAINTS: Record<PaintSlot, PaintDef[]> = { wall: WALL_PAINTS, roof: ROOF_PAINTS, top: TOPPERS };
export interface HousePaint {
  wall: string;
  roof: string;
  top: string;
}
export const DEFAULT_PAINT: HousePaint = { wall: "cream", roof: "berry", top: "none" };
export const paintColor = (slot: "wall" | "roof", id: string): string =>
  PAINTS[slot].find((p) => p.id === id)?.color ?? PAINTS[slot][0].color ?? "#ffffff";

/** "45s", "5m", "1h 30m": how long a build takes. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`;
  const m = Math.round((s % 3600) / 60);
  return m ? `${Math.floor(s / 3600)}h ${m}m` : `${Math.floor(s / 3600)}h`;
}
/** "0:45", "12:05", "3:59:12": time left on a clock. */
export function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}
