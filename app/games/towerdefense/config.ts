// ─── Tower Defense: static game configuration ─────────────────────────────────

export const ROWS = 11;
export const COLS = 20;
/** Fraction of everything spent on a tower that comes back when selling. */
export const SELL_REFUND = 0.7;
/** Flat-armor hits can never be reduced below this fraction of base damage. */
export const MIN_ARMOR_DAMAGE = 0.25;
/** Towers built on a hilltop see this much further. */
export const HILL_RANGE_BONUS = 1.25;

// ─── Terrain ──────────────────────────────────────────────────────────────────

export type Terrain = "grass" | "hill" | "road" | "water" | "rock" | "rubble";

export interface TerrainDef {
  name: string;
  /** Ground enemies can walk here. */
  walk: boolean;
  /** Towers can be built here. */
  build: boolean;
  /** Blocks the view of towers that need a clear line of sight. */
  blocksSight: boolean;
  /** Shown when the player tries to build here. */
  noBuild: string;
  /** One-line explanation for the field guide. */
  hint: string;
}

export const TERRAIN: Record<Terrain, TerrainDef> = {
  grass: {
    name: "Open ground",
    walk: true,
    build: true,
    blocksSight: false,
    noBuild: "",
    hint: "Build anywhere. Enemies walk around your towers.",
  },
  hill: {
    name: "Hilltop",
    walk: true,
    build: true,
    blocksSight: false,
    noBuild: "",
    hint: "Towers built here get +25% range.",
  },
  road: {
    name: "Road & bridges",
    walk: true,
    build: false,
    blocksSight: false,
    noBuild: "Can't build on the road",
    hint: "Enemies can cross, but you can't build on it.",
  },
  water: {
    name: "Water",
    walk: false,
    build: false,
    blocksSight: false,
    noBuild: "Can't build on water",
    hint: "Nobody walks or builds here, but towers can shoot across.",
  },
  rock: {
    name: "Rocks",
    walk: false,
    build: false,
    blocksSight: true,
    noBuild: "Rocks are in the way",
    hint: "Solid walls. Blasters, Frost and Snipers can't see past them.",
  },
  rubble: {
    name: "Rubble",
    walk: false,
    build: false,
    blocksSight: true,
    noBuild: "Tap the rubble to clear it first",
    hint: "Pay gold to clear it. That opens new ground (and maybe a shortcut!).",
  },
};

// ─── Difficulty ───────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "normal" | "hard";

export interface DifficultyDef {
  name: string;
  blurb: string;
  /** Enemy health multiplier. */
  hp: number;
  /** Enemy speed multiplier. */
  speed: number;
  lives: number;
  /** Starting gold multiplier. */
  gold: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    name: "Easy",
    blurb: "Weaker enemies, 25 lives and extra starting gold.",
    hp: 0.7,
    speed: 0.95,
    lives: 25,
    gold: 1.2,
  },
  normal: {
    name: "Normal",
    blurb: "The real thing. 20 lives.",
    hp: 1,
    speed: 1,
    lives: 20,
    gold: 1,
  },
  hard: {
    name: "Hard",
    blurb: "Tougher, faster enemies and only 10 lives.",
    hp: 1.3,
    speed: 1.08,
    lives: 10,
    gold: 0.9,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];

/** Stars for a win: 3 for a near-perfect defence, 2 for keeping half your lives. */
export function starsFor(lives: number, maxLives: number): 1 | 2 | 3 {
  const kept = lives / maxLives;
  return kept >= 0.9 ? 3 : kept >= 0.5 ? 2 : 1;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export type ThemeId = "meadow" | "river" | "canyon" | "frost" | "island";

export interface MapDef {
  id: string;
  name: string;
  blurb: string;
  /** A strategy nudge shown on the map card. */
  tip: string;
  /** 1 = gentle, 3 = brutal. */
  skulls: 1 | 2 | 3;
  theme: ThemeId;
  startGold: number;
  rubbleCost: number;
  /**
   * 11 rows of 20 characters:
   *   .  open ground      ^  hilltop        =  road / bridge
   *   ~  water            #  rocks          %  rubble (clearable)
   *   A B C  enemy portals                  X Y  castles
   */
  rows: string[];
  /** Portals that stay shut until the given (1-based) wave. */
  lateEntries?: Record<string, number>;
}

export const MAPS: MapDef[] = [
  {
    id: "meadow",
    name: "Green Meadow",
    blurb: "Wide open grass with a pond in the middle. Build any maze you like.",
    tip: "The hilltops near the middle reach most of the field.",
    skulls: 1,
    theme: "meadow",
    startGold: 150,
    rubbleCost: 50,
    rows: [
      "....................",
      "....^.........##....",
      "...........~~.......",
      "..........~~~~......",
      ".....^....~~~~......",
      "A..........~~......X",
      ".....#..............",
      "....##........^.....",
      "...............%%...",
      "....................",
      "....................",
    ],
  },
  {
    id: "bridges",
    name: "Twin Bridges",
    blurb: "A river cuts the field in two. Two bridges and a shallow ford cross it.",
    tip: "Plug the ford with hilltop towers and the enemy has to take a bridge.",
    skulls: 2,
    theme: "river",
    startGold: 160,
    rubbleCost: 60,
    rows: [
      ".........~~.........",
      "....^....~~.........",
      ".........==......#..",
      "...#.....~~.........",
      ".........~~....^....",
      "A........^^........X",
      ".........~~.........",
      "....%....~~...#.....",
      ".........==.........",
      "..^......~~.........",
      ".........~~.........",
    ],
  },
  {
    id: "canyon",
    name: "Stone Canyon",
    blurb: "Tight corridors between rock walls. There isn't much room to build.",
    tip: "Rocks block the view. Bombers and Teslas can still fire over them.",
    skulls: 2,
    theme: "canyon",
    startGold: 170,
    rubbleCost: 70,
    rows: [
      "####################",
      "A......#.....^.....#",
      ".......#...........#",
      "####...#...#####...#",
      "#^.%...#...#...#...#",
      "####.......#.^.%...#",
      "#......#...#...#...#",
      "#..^...#...#####...#",
      "#......#............",
      "########...........X",
      "####################",
    ],
  },
  {
    id: "fork",
    name: "Frozen Fork",
    blurb: "Two portals, one castle and a frozen lake. The second portal opens on wave 5.",
    tip: "The island in the lake can't be reached on foot. It's a perfect tower spot.",
    skulls: 3,
    theme: "frost",
    startGold: 190,
    rubbleCost: 70,
    rows: [
      "....................",
      "......#.........^...",
      "A.....#.............",
      "......#....~~~......",
      "..^.......~~~~~.....",
      "####......~~^~~....X",
      "..........~~~~~.....",
      "......#....~~~......",
      "B.....#.............",
      "......#.........^...",
      "....................",
    ],
    lateEntries: { B: 5 },
  },
  {
    id: "island",
    name: "Castle Island",
    blurb: "Your castle sits inside a moat with four bridges. Enemies come from both sides.",
    tip: "Wall off the near bridges and the enemy has to march all the way round.",
    skulls: 3,
    theme: "island",
    startGold: 220,
    rubbleCost: 80,
    rows: [
      "....................",
      "..^..............^..",
      "....~~~~~==~~~~~....",
      "....~..........~....",
      "....~..#....#..~....",
      "A...=....X.....=...B",
      "....~..#....#..~....",
      "....~..........~....",
      "....~~~~~==~~~~~....",
      "..^..............^..",
      "....................",
    ],
    lateEntries: { B: 4 },
  },
];

export const getMap = (id: string): MapDef => MAPS.find((m) => m.id === id) ?? MAPS[0];

export interface Cell {
  r: number;
  c: number;
}

export interface EntryDef extends Cell {
  key: string;
  /** First (1-based) wave this portal sends enemies. */
  fromWave: number;
  /** Direction enemies walk as they come in (0,0 for a portal away from the edge). */
  dr: number;
  dc: number;
}

export interface ParsedMap {
  terrain: Terrain[][];
  entries: EntryDef[];
  exits: Cell[];
}

const TERRAIN_CHARS: Record<string, Terrain> = {
  ".": "grass",
  "^": "hill",
  "=": "road",
  "~": "water",
  "#": "rock",
  "%": "rubble",
};

export function parseMap(map: MapDef): ParsedMap {
  if (map.rows.length !== ROWS || map.rows.some((row) => row.length !== COLS)) {
    throw new Error(`Map "${map.id}" must be ${ROWS} rows of ${COLS} characters`);
  }
  const terrain: Terrain[][] = [];
  const entries: EntryDef[] = [];
  const exits: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Terrain[] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = map.rows[r][c];
      if (ch === "X" || ch === "Y") {
        exits.push({ r, c });
        row.push("road");
      } else if (ch >= "A" && ch <= "C") {
        // Enemies walk in from whichever edge the portal sits on.
        const [dr, dc] = c === 0 ? [0, 1] : c === COLS - 1 ? [0, -1] : r === 0 ? [1, 0] : r === ROWS - 1 ? [-1, 0] : [0, 0];
        entries.push({ r, c, key: ch, fromWave: map.lateEntries?.[ch] ?? 1, dr, dc });
        row.push("road");
      } else {
        const t = TERRAIN_CHARS[ch];
        if (!t) throw new Error(`Map "${map.id}" has an unknown tile "${ch}"`);
        row.push(t);
      }
    }
    terrain.push(row);
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  if (!entries.length || !exits.length) throw new Error(`Map "${map.id}" needs a portal and a castle`);
  return { terrain, entries, exits };
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

export type EnemyType =
  | "normal"
  | "fast"
  | "tank"
  | "swarm"
  | "boss"
  | "healer"
  | "armored"
  | "flyer"
  | "splitter"
  | "mini";

export interface EnemyDef {
  name: string;
  /** What makes this enemy special, in a few words. */
  trait: string;
  body: string; // main body colour
  shade: string; // darker shade for outlines / shading
  hpMult: number;
  speedMult: number;
  rewardMult: number;
  armor: number;
  /** Fraction of max HP healed per second for itself and nearby allies. */
  healAura: number;
  /** Body radius in cells. */
  radius: number;
  /** Lives lost when this enemy reaches the castle. */
  livesCost: number;
  /** Flies in a straight line to the castle, over mazes, water and rocks. */
  flying?: boolean;
  /** Bursts into smaller enemies when defeated. */
  split?: { into: EnemyType; count: number };
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  normal: {
    name: "Gloop",
    trait: "Nothing special. There are just a lot of them.",
    body: "#6fd36a",
    shade: "#2f8a3a",
    hpMult: 1,
    speedMult: 1,
    rewardMult: 1,
    armor: 0,
    healAura: 0,
    radius: 0.3,
    livesCost: 1,
  },
  fast: {
    name: "Zippy",
    trait: "Quick but fragile.",
    body: "#4cc3ff",
    shade: "#1f6fb3",
    hpMult: 0.5,
    speedMult: 1.8,
    rewardMult: 0.8,
    armor: 0,
    healAura: 0,
    radius: 0.25,
    livesCost: 1,
  },
  tank: {
    name: "Brute",
    trait: "Slow with lots of health. Costs 2 lives.",
    body: "#a17ef2",
    shade: "#5b3cb0",
    hpMult: 3,
    speedMult: 0.6,
    rewardMult: 2,
    armor: 0,
    healAura: 0,
    radius: 0.38,
    livesCost: 2,
  },
  swarm: {
    name: "Bitty",
    trait: "Tiny, fast and arrives in a crowd.",
    body: "#ff9f43",
    shade: "#c2571a",
    hpMult: 0.3,
    speedMult: 1.5,
    rewardMult: 0.4,
    armor: 0,
    healAura: 0,
    radius: 0.2,
    livesCost: 1,
  },
  boss: {
    name: "Gloop King",
    trait: "Huge, armored and costs 5 lives.",
    body: "#ff5a6e",
    shade: "#a3142b",
    hpMult: 8,
    speedMult: 0.5,
    rewardMult: 5,
    armor: 15,
    healAura: 0,
    radius: 0.46,
    livesCost: 5,
  },
  healer: {
    name: "Medic",
    trait: "Heals every enemy close to it.",
    body: "#5eead4",
    shade: "#0f8f7f",
    hpMult: 1.5,
    speedMult: 0.9,
    rewardMult: 1.5,
    armor: 0,
    healAura: 0.03,
    radius: 0.3,
    livesCost: 1,
  },
  armored: {
    name: "Knight",
    trait: "Armor shrugs off weak hits. Snipers pierce it.",
    body: "#b8c4d6",
    shade: "#5b6b82",
    hpMult: 1.5,
    speedMult: 0.8,
    rewardMult: 1.5,
    armor: 20,
    healAura: 0,
    radius: 0.31,
    livesCost: 1,
  },
  flyer: {
    name: "Flutter",
    trait: "Flies straight over your maze. Bombers can't hit it.",
    body: "#f9a8d4",
    shade: "#be185d",
    hpMult: 0.7,
    speedMult: 1.1,
    rewardMult: 1.2,
    armor: 0,
    healAura: 0,
    radius: 0.26,
    livesCost: 1,
    flying: true,
  },
  splitter: {
    name: "Blobble",
    trait: "Bursts into two Blips when popped.",
    body: "#d4e157",
    shade: "#7a8a12",
    hpMult: 1.7,
    speedMult: 0.85,
    rewardMult: 1,
    armor: 0,
    healAura: 0,
    radius: 0.36,
    livesCost: 2,
    split: { into: "mini", count: 2 },
  },
  mini: {
    name: "Blip",
    trait: "What's left of a Blobble. Small and speedy.",
    body: "#e6ee7a",
    shade: "#8a9a1c",
    hpMult: 0.55,
    speedMult: 1.35,
    rewardMult: 0.3,
    armor: 0,
    healAura: 0,
    radius: 0.21,
    livesCost: 1,
  },
};

/** Order used by the field guide. */
export const ENEMY_ORDER: EnemyType[] = [
  "normal",
  "fast",
  "swarm",
  "tank",
  "armored",
  "healer",
  "flyer",
  "splitter",
  "boss",
];

export const HEAL_AURA_RANGE = 1.6;

// ─── Towers ───────────────────────────────────────────────────────────────────

export type TowerType = "blaster" | "sniper" | "bomb" | "frost" | "tesla";

export interface TowerLevel {
  /** Build cost for level 1, upgrade cost for levels 2–3. */
  cost: number;
  dmg: number;
  range: number; // cells
  rate: number; // shots per second
  splash?: number; // explosion radius in cells
  slow?: number; // speed multiplier while slowed (0.6 = 40% slower)
  slowDur?: number; // seconds
  chains?: number; // enemies hit per tesla zap
}

export interface TowerDef {
  name: string;
  tagline: string;
  color: string;
  accent: string;
  /** Projectile speed in cells / sec (0 = instant hit). */
  projSpeed: number;
  /** Turret turn speed in radians / sec. */
  turnSpeed: number;
  /** Ignores enemy armor. */
  pierce: boolean;
  /** Can't shoot at enemies hidden behind rocks or rubble. */
  needsSight: boolean;
  /** Can target flying enemies. */
  hitsAir: boolean;
  levels: [TowerLevel, TowerLevel, TowerLevel];
}

export const TOWERS: Record<TowerType, TowerDef> = {
  blaster: {
    name: "Blaster",
    tagline: "Rapid-fire all-rounder",
    color: "#3b82f6",
    accent: "#93c5fd",
    projSpeed: 13,
    turnSpeed: 10,
    pierce: false,
    needsSight: true,
    hitsAir: true,
    levels: [
      { cost: 50, dmg: 15, range: 2.8, rate: 3 },
      { cost: 45, dmg: 25, range: 3.1, rate: 3.5 },
      { cost: 90, dmg: 38, range: 3.4, rate: 4.5 },
    ],
  },
  sniper: {
    name: "Sniper",
    tagline: "Huge range, pierces armor",
    color: "#8b5cf6",
    accent: "#ddd6fe",
    projSpeed: 0,
    turnSpeed: 5,
    pierce: true,
    needsSight: true,
    hitsAir: true,
    levels: [
      { cost: 110, dmg: 80, range: 6, rate: 0.45 },
      { cost: 100, dmg: 150, range: 6.8, rate: 0.5 },
      { cost: 180, dmg: 300, range: 7.5, rate: 0.55 },
    ],
  },
  bomb: {
    name: "Bomber",
    tagline: "Lobs bombs over rocks. Ground only",
    color: "#ef4444",
    accent: "#fdba74",
    projSpeed: 0, // lobbed: fixed flight time
    turnSpeed: 6,
    pierce: false,
    needsSight: false,
    hitsAir: false,
    levels: [
      { cost: 75, dmg: 38, range: 3.2, rate: 0.9, splash: 1.0 },
      { cost: 70, dmg: 60, range: 3.4, rate: 1.0, splash: 1.2 },
      { cost: 130, dmg: 95, range: 3.7, rate: 1.2, splash: 1.45 },
    ],
  },
  frost: {
    name: "Frost",
    tagline: "Slows enemies down",
    color: "#06b6d4",
    accent: "#cffafe",
    projSpeed: 10,
    turnSpeed: 8,
    pierce: false,
    needsSight: true,
    hitsAir: true,
    levels: [
      { cost: 60, dmg: 6, range: 2.6, rate: 1.5, slow: 0.6, slowDur: 1.5 },
      { cost: 55, dmg: 11, range: 2.9, rate: 1.7, slow: 0.5, slowDur: 2 },
      {
        cost: 100,
        dmg: 18,
        range: 3.2,
        rate: 2,
        slow: 0.4,
        slowDur: 2.5,
        splash: 0.9,
      },
    ],
  },
  tesla: {
    name: "Tesla",
    tagline: "Lightning arcs over rocks and chains",
    color: "#eab308",
    accent: "#fef08a",
    projSpeed: 0,
    turnSpeed: 0,
    pierce: false,
    needsSight: false,
    hitsAir: true,
    levels: [
      { cost: 120, dmg: 24, range: 2.6, rate: 1.0, chains: 3 },
      { cost: 100, dmg: 34, range: 2.8, rate: 1.2, chains: 4 },
      { cost: 170, dmg: 50, range: 3.1, rate: 1.4, chains: 6 },
    ],
  },
};

export const TOWER_ORDER: TowerType[] = [
  "blaster",
  "frost",
  "bomb",
  "sniper",
  "tesla",
];

export const TESLA_JUMP_RANGE = 1.8;
export const TESLA_FALLOFF = 0.85;

/** Which enemy in range a tower shoots at. */
export type Targeting = "first" | "last" | "strong" | "close";

export const TARGETING_ORDER: Targeting[] = ["first", "last", "strong", "close"];

export const TARGETING: Record<Targeting, { label: string; hint: string }> = {
  first: { label: "First", hint: "The enemy closest to your castle" },
  last: { label: "Last", hint: "The enemy furthest from your castle" },
  strong: { label: "Strong", hint: "The enemy with the most health" },
  close: { label: "Close", hint: "The enemy nearest to this tower" },
};

// ─── Waves ────────────────────────────────────────────────────────────────────

export interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number; // seconds between spawns in this group
}

export interface WaveDef {
  groups: WaveGroup[];
  baseHp: number;
  baseSpeed: number; // cells / sec
  baseReward: number;
}

export const WAVES: WaveDef[] = [
  { groups: [{ type: "normal", count: 6, interval: 1.2 }], baseHp: 60, baseSpeed: 2.0, baseReward: 8 },
  { groups: [{ type: "normal", count: 8, interval: 1.0 }], baseHp: 85, baseSpeed: 2.1, baseReward: 9 },
  {
    groups: [
      { type: "normal", count: 5, interval: 1.0 },
      { type: "fast", count: 4, interval: 0.7 },
    ],
    baseHp: 120, baseSpeed: 2.2, baseReward: 10,
  },
  {
    groups: [
      { type: "normal", count: 4, interval: 1.0 },
      { type: "flyer", count: 5, interval: 0.9 },
    ],
    baseHp: 125, baseSpeed: 2.3, baseReward: 10,
  },
  {
    groups: [
      { type: "normal", count: 6, interval: 1.0 },
      { type: "tank", count: 2, interval: 2.0 },
    ],
    baseHp: 170, baseSpeed: 2.3, baseReward: 12,
  },
  { groups: [{ type: "swarm", count: 16, interval: 0.4 }], baseHp: 205, baseSpeed: 2.4, baseReward: 10 },
  {
    groups: [
      { type: "splitter", count: 4, interval: 1.4 },
      { type: "fast", count: 5, interval: 0.6 },
    ],
    baseHp: 245, baseSpeed: 2.5, baseReward: 11,
  },
  {
    groups: [
      { type: "armored", count: 5, interval: 1.2 },
      { type: "normal", count: 6, interval: 0.9 },
    ],
    baseHp: 310, baseSpeed: 2.5, baseReward: 13,
  },
  {
    groups: [
      { type: "fast", count: 6, interval: 0.6 },
      { type: "flyer", count: 8, interval: 0.7 },
    ],
    baseHp: 380, baseSpeed: 2.6, baseReward: 13,
  },
  {
    groups: [
      { type: "normal", count: 8, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
    ],
    baseHp: 470, baseSpeed: 2.6, baseReward: 15,
  },
  {
    groups: [
      { type: "healer", count: 4, interval: 1.0 },
      { type: "normal", count: 8, interval: 0.8 },
    ],
    baseHp: 590, baseSpeed: 2.7, baseReward: 16,
  },
  {
    groups: [
      { type: "tank", count: 5, interval: 1.5 },
      { type: "healer", count: 3, interval: 1.0 },
    ],
    baseHp: 715, baseSpeed: 2.7, baseReward: 18,
  },
  {
    groups: [
      { type: "swarm", count: 22, interval: 0.3 },
      { type: "flyer", count: 8, interval: 0.6 },
      { type: "tank", count: 2, interval: 1.5 },
    ],
    baseHp: 830, baseSpeed: 2.8, baseReward: 15,
  },
  {
    groups: [
      { type: "armored", count: 7, interval: 1.0 },
      { type: "splitter", count: 4, interval: 1.2 },
    ],
    baseHp: 955, baseSpeed: 2.8, baseReward: 19,
  },
  {
    groups: [
      { type: "armored", count: 6, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
      { type: "healer", count: 4, interval: 0.8 },
    ],
    baseHp: 1050, baseSpeed: 2.9, baseReward: 22,
  },
  {
    groups: [
      { type: "fast", count: 8, interval: 0.5 },
      { type: "flyer", count: 10, interval: 0.6 },
      { type: "armored", count: 6, interval: 1.0 },
    ],
    baseHp: 1220, baseSpeed: 3.0, baseReward: 21,
  },
  {
    groups: [
      { type: "healer", count: 4, interval: 0.8 },
      { type: "tank", count: 4, interval: 1.2 },
      { type: "splitter", count: 4, interval: 1.0 },
    ],
    baseHp: 1400, baseSpeed: 3.0, baseReward: 24,
  },
  {
    groups: [
      { type: "swarm", count: 25, interval: 0.25 },
      { type: "fast", count: 10, interval: 0.4 },
      { type: "flyer", count: 10, interval: 0.5 },
    ],
    baseHp: 1620, baseSpeed: 3.1, baseReward: 20,
  },
  {
    groups: [
      { type: "tank", count: 4, interval: 1.2 },
      { type: "armored", count: 6, interval: 0.8 },
      { type: "healer", count: 4, interval: 0.8 },
      { type: "flyer", count: 8, interval: 0.5 },
    ],
    baseHp: 1900, baseSpeed: 3.2, baseReward: 27,
  },
  {
    groups: [
      { type: "armored", count: 6, interval: 0.6 },
      { type: "boss", count: 2, interval: 3.0 },
      { type: "healer", count: 4, interval: 0.6 },
      { type: "tank", count: 2, interval: 1.0 },
      { type: "splitter", count: 4, interval: 0.9 },
    ],
    baseHp: 2100, baseSpeed: 3.3, baseReward: 34,
  },
];

export const TOTAL_WAVES = WAVES.length;

// Endless mode: waves after the last scripted one are generated. The same wave
// number always produces the same wave, so the "next wave" preview is honest.

const ENDLESS_POOL: WaveGroup[] = [
  { type: "normal", count: 10, interval: 0.7 },
  { type: "fast", count: 10, interval: 0.45 },
  { type: "tank", count: 5, interval: 1.1 },
  { type: "swarm", count: 24, interval: 0.25 },
  { type: "healer", count: 5, interval: 0.8 },
  { type: "armored", count: 8, interval: 0.7 },
  { type: "flyer", count: 9, interval: 0.5 },
  { type: "splitter", count: 6, interval: 0.9 },
];

function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const endlessCache = new Map<number, WaveDef>();

/** The wave at a 0-based index: scripted first, then generated forever. */
export function waveDef(index: number): WaveDef {
  if (index < WAVES.length) return WAVES[index];
  const cached = endlessCache.get(index);
  if (cached) return cached;
  const k = index - WAVES.length + 1; // 1, 2, 3 …
  const rnd = seeded(index * 7919 + 13);
  const pool = [...ENDLESS_POOL];
  const groups: WaveGroup[] = [];
  const picks = 3 + (k % 2);
  for (let i = 0; i < picks && pool.length; i++) {
    const [g] = pool.splice(Math.floor(rnd() * pool.length), 1);
    groups.push({ ...g, count: Math.round(g.count * (1 + k * 0.06)) });
  }
  if (k % 5 === 0) groups.push({ type: "boss", count: 1 + Math.floor(k / 5), interval: 2.5 });
  const wave: WaveDef = {
    groups,
    baseHp: Math.round(WAVES[WAVES.length - 1].baseHp * Math.pow(1.12, k)),
    baseSpeed: Math.min(4.2, 3.3 + k * 0.03),
    baseReward: 34 + k,
  };
  endlessCache.set(index, wave);
  return wave;
}

/** Gold for clearing the board after the given (1-based) wave number. */
export const waveClearBonus = (waveNumber: number) => 25 + waveNumber * 5;
/** Gold for calling the next wave before the current one is finished. */
export const earlyCallBonus = (waveNumber: number) => 10 + waveNumber * 2;
