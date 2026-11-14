// ─── Tower Defense: static game configuration ─────────────────────────────────

export const ROWS = 11;
export const COLS = 20;
/** Fraction of everything spent on a tower that comes back when selling. */
export const SELL_REFUND = 0.7;
/** Flat-armor hits can never be reduced below this fraction of base damage. */
export const MIN_ARMOR_DAMAGE = 0.25;
/** Towers built on a hilltop see this much further. */
export const HILL_RANGE_BONUS = 1.25;
/**
 * Selling a tower (or clearing rubble) while enemies are on the board makes
 * every walker this much faster, for good. It stops the old trick of opening
 * and closing a maze to march a wave back and forth forever.
 */
export const ALARM_HASTE = 0.2;
export const MAX_HASTE = 3;

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

export type Difficulty = "easy" | "normal" | "hard" | "brutal";

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
    hp: 0.75,
    speed: 0.95,
    lives: 25,
    gold: 1.2,
  },
  normal: {
    name: "Normal",
    blurb: "The real thing. 20 lives.",
    hp: 1.15,
    speed: 1,
    lives: 20,
    gold: 1,
  },
  hard: {
    name: "Hard",
    blurb: "Tougher, faster enemies and only 10 lives.",
    hp: 1.45,
    speed: 1.08,
    lives: 10,
    gold: 0.9,
  },
  brutal: {
    name: "Brutal",
    blurb: "Much tougher enemies, less gold and 3 lives. Every leak hurts.",
    hp: 1.75,
    speed: 1.12,
    lives: 3,
    gold: 0.85,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard", "brutal"];

/** Stars for a win: 3 for a near-perfect defence, 2 for keeping half your lives. */
export function starsFor(lives: number, maxLives: number): 1 | 2 | 3 {
  const kept = lives / maxLives;
  return kept >= 0.9 ? 3 : kept >= 0.5 ? 2 : 1;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export type ThemeId = "meadow" | "river" | "canyon" | "frost" | "island" | "shore" | "ash";

/** A scheduled change to the battlefield. It happens as the given wave starts. */
export interface MapEventDef {
  /** 1-based wave the change arrives with. */
  wave: number;
  kind: "flood" | "slide";
  /** Shown in the warning banner, e.g. "The tide comes in". */
  label: string;
  /** What the tiles turn into. */
  to: Terrain;
  cells: Cell[];
}

/** Every cell in a rectangle, corners included. */
function rect(r0: number, c0: number, r1: number, c1: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.push({ r, c });
  return cells;
}

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
  /** Floods, rockslides and other changes, in wave order. */
  events?: MapEventDef[];
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
  {
    id: "tidewater",
    name: "Tidewater",
    blurb: "The sea keeps rising. On waves 8, 16 and 24 it swallows more of the beach, and any towers on it.",
    tip: "Drowned towers are refunded in full, but your maze must still work once the water arrives.",
    skulls: 3,
    theme: "shore",
    startGold: 200,
    rubbleCost: 70,
    rows: [
      "....................",
      "..^.......#......^..",
      "A..................X",
      "......#.............",
      "..........^.........",
      "....................",
      "...#..........#.....",
      "....................",
      ".......^............",
      "....................",
      "~~~~~~~~~~~~~~~~~~~~",
    ],
    events: [
      { wave: 8, kind: "flood", label: "The tide comes in", to: "water", cells: rect(8, 0, 9, 19) },
      { wave: 16, kind: "flood", label: "The tide rises again", to: "water", cells: rect(6, 0, 7, 19) },
      { wave: 24, kind: "flood", label: "High tide", to: "water", cells: rect(5, 0, 5, 19) },
    ],
  },
  {
    id: "rockslide",
    name: "Rockslide Pass",
    blurb: "A long winding pass that keeps getting shorter. Rockslides break the walls on waves 7, 14 and 21.",
    tip: "You can plug the first gap with towers. The last two leave bare road you can't build on.",
    skulls: 3,
    theme: "ash",
    startGold: 200,
    rubbleCost: 70,
    rows: [
      "####################",
      "A.................^#",
      "..................^#",
      "################..##",
      "#^................##",
      "#.................##",
      "#..#################",
      "#.................^#",
      "#..................X",
      "####################",
      "####################",
    ],
    events: [
      { wave: 7, kind: "slide", label: "A rockslide opens the first wall", to: "grass", cells: rect(3, 8, 3, 9) },
      { wave: 14, kind: "slide", label: "The second wall gives way", to: "road", cells: rect(6, 10, 6, 11) },
      { wave: 21, kind: "slide", label: "The first wall crumbles again", to: "road", cells: rect(3, 12, 3, 13) },
    ],
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
  | "mini"
  | "shade"
  | "charger"
  | "jammer"
  | "emperor";

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
  /** Towers can't target it unless a Beacon (or a Marksman) reveals it. */
  stealth?: boolean;
  /** Immune to slows and freezes. */
  unstoppable?: boolean;
  /** Can be slowed but never frozen solid. */
  noStun?: boolean;
  /** Extra speed gained as health drops (0.9 = up to +90% when nearly dead). */
  enrage?: number;
  /** Sends out a pulse that switches off nearby towers. */
  jam?: { every: number; radius: number; duration: number };
  /** Keeps producing escorts while it's alive. They carry no gold and have half health. */
  spawns?: { type: EnemyType; every: number; count: number };
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
    trait: "Huge, armored, costs 5 lives and keeps hatching Bitties.",
    body: "#ff5a6e",
    shade: "#a3142b",
    hpMult: 8,
    speedMult: 0.5,
    rewardMult: 5,
    armor: 15,
    healAura: 0,
    radius: 0.46,
    livesCost: 5,
    noStun: true,
    spawns: { type: "swarm", every: 5, count: 2 },
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
  shade: {
    name: "Shade",
    trait: "Invisible to towers unless a Beacon lights it up.",
    body: "#8b7fe8",
    shade: "#3b2f8f",
    hpMult: 0.9,
    speedMult: 1.15,
    rewardMult: 1.4,
    armor: 0,
    healAura: 0,
    radius: 0.28,
    livesCost: 1,
    stealth: true,
  },
  charger: {
    name: "Rager",
    trait: "Can't be slowed, and runs faster the more it's hurt.",
    body: "#e5484d",
    shade: "#7a1418",
    hpMult: 1.4,
    speedMult: 0.95,
    rewardMult: 1.4,
    armor: 0,
    healAura: 0,
    radius: 0.31,
    livesCost: 1,
    unstoppable: true,
    enrage: 0.7,
  },
  jammer: {
    name: "Jinx",
    trait: "Its pulse switches off nearby towers. Outrange it or shield them.",
    body: "#64748b",
    shade: "#1e293b",
    hpMult: 2.4,
    speedMult: 0.75,
    rewardMult: 2.2,
    armor: 0,
    healAura: 0,
    radius: 0.34,
    livesCost: 2,
    jam: { every: 4.5, radius: 2.3, duration: 2.4 },
  },
  emperor: {
    name: "Gloop Emperor",
    trait: "The last boss. If it reaches the castle, the battle is lost.",
    body: "#9333ea",
    shade: "#3b0764",
    hpMult: 18,
    speedMult: 0.42,
    rewardMult: 20,
    armor: 25,
    healAura: 0,
    radius: 0.58,
    livesCost: 99,
    noStun: true,
    spawns: { type: "armored", every: 7, count: 1 },
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
  "shade",
  "charger",
  "jammer",
  "boss",
  "emperor",
];

export const HEAL_AURA_RANGE = 1.6;

// ─── Towers ───────────────────────────────────────────────────────────────────

export type TowerType = "blaster" | "sniper" | "bomb" | "frost" | "tesla" | "beacon" | "mine";

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
  /** Overrides whether this tower's shots ignore armor. */
  pierce?: boolean;
  /** Shoots over rocks even though the base tower can't. */
  overRocks?: boolean;
  /** Can target Shades without a Beacon. */
  seesStealth?: boolean;
  /** Sets enemies alight: damage per second (ignores armor) and for how long. */
  burn?: number;
  burnDur?: number;
  /** Freezes enemies solid for this many seconds. */
  stun?: number;
  /** Beacon: bonuses for towers inside its light (0.2 = +20%). `range` is the light's radius. */
  aura?: { rate: number; range: number; shield?: boolean };
  /** Gold Mine: gold paid out each time a wave starts. */
  income?: number;
  /** Gold Mine: bonus on all gold from kills (0.3 = +30%). Doesn't stack. */
  bounty?: number;
}

/** One of the two final forms a level-3 tower can be turned into. */
export interface TowerSpec extends TowerLevel {
  name: string;
  blurb: string;
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
  /** Attack towers shoot. Support and income buildings never do. */
  role: "attack" | "support" | "income";
  /** At most this many may stand at once. */
  limit?: number;
  levels: [TowerLevel, TowerLevel, TowerLevel];
  /** Pick one at level 3. The choice is permanent. */
  specs: [TowerSpec, TowerSpec];
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
    role: "attack",
    levels: [
      { cost: 50, dmg: 15, range: 2.8, rate: 3 },
      { cost: 45, dmg: 25, range: 3.1, rate: 3.5 },
      { cost: 90, dmg: 38, range: 3.4, rate: 4.5 },
    ],
    specs: [
      { name: "Gatling", blurb: "A storm of bullets. Shreds anything without armor.", cost: 230, dmg: 34, range: 3.6, rate: 10 },
      { name: "Railgun", blurb: "Slower, heavier slugs that punch straight through armor.", cost: 260, dmg: 150, range: 4.2, rate: 2.2, pierce: true },
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
    role: "attack",
    levels: [
      { cost: 110, dmg: 80, range: 6, rate: 0.45 },
      { cost: 100, dmg: 150, range: 6.8, rate: 0.5 },
      { cost: 180, dmg: 300, range: 7.5, rate: 0.55 },
    ],
    specs: [
      { name: "Deadeye", blurb: "One enormous shot at a time, across the whole map and over rocks.", cost: 340, dmg: 1300, range: 9.5, rate: 0.4, overRocks: true },
      { name: "Marksman", blurb: "Fires three times as fast and can pick out Shades on its own.", cost: 320, dmg: 280, range: 7.5, rate: 1.5, seesStealth: true },
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
    role: "attack",
    levels: [
      { cost: 75, dmg: 38, range: 3.2, rate: 0.9, splash: 1.0 },
      { cost: 70, dmg: 60, range: 3.4, rate: 1.0, splash: 1.2 },
      { cost: 130, dmg: 95, range: 3.7, rate: 1.2, splash: 1.45 },
    ],
    specs: [
      { name: "Big Bertha", blurb: "Huge shells with a huge blast.", cost: 300, dmg: 260, range: 4.4, rate: 1, splash: 2.2 },
      { name: "Inferno", blurb: "Firebombs. The burn ignores armor and keeps ticking.", cost: 280, dmg: 110, range: 3.9, rate: 1.4, splash: 1.6, burn: 70, burnDur: 4 },
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
    role: "attack",
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
    specs: [
      { name: "Blizzard", blurb: "A wide, heavy slow over everything nearby.", cost: 240, dmg: 35, range: 3.6, rate: 2.2, slow: 0.32, slowDur: 3, splash: 1.9 },
      { name: "Deep Freeze", blurb: "Freezes enemies solid for a moment. Bosses only slow down.", cost: 260, dmg: 70, range: 3.4, rate: 1.3, slow: 0.4, slowDur: 2.5, splash: 0.9, stun: 1.1 },
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
    role: "attack",
    levels: [
      { cost: 120, dmg: 24, range: 2.6, rate: 1.0, chains: 3 },
      { cost: 100, dmg: 34, range: 2.8, rate: 1.2, chains: 4 },
      { cost: 170, dmg: 50, range: 3.1, rate: 1.4, chains: 6 },
    ],
    specs: [
      { name: "Storm Coil", blurb: "Lightning that leaps through ten enemies.", cost: 330, dmg: 80, range: 3.5, rate: 1.7, chains: 10 },
      { name: "Arc Lance", blurb: "All that power in one armor-piercing bolt.", cost: 330, dmg: 480, range: 3.6, rate: 1.1, chains: 1, pierce: true },
    ],
  },
  beacon: {
    name: "Beacon",
    tagline: "Reveals Shades and speeds up towers in its light",
    color: "#10b981",
    accent: "#a7f3d0",
    projSpeed: 0,
    turnSpeed: 0,
    pierce: false,
    needsSight: false,
    hitsAir: false,
    role: "support",
    levels: [
      { cost: 130, dmg: 0, range: 2.3, rate: 0, aura: { rate: 0.1, range: 0 } },
      { cost: 110, dmg: 0, range: 2.7, rate: 0, aura: { rate: 0.15, range: 0.1 } },
      { cost: 180, dmg: 0, range: 3.1, rate: 0, aura: { rate: 0.22, range: 0.15 } },
    ],
    specs: [
      { name: "War Horn", blurb: "Towers in its light fire much faster.", cost: 300, dmg: 0, range: 3.3, rate: 0, aura: { rate: 0.45, range: 0.15 } },
      { name: "Lighthouse", blurb: "A far wider light, longer reach, and Jinxes can't switch off anything inside it.", cost: 280, dmg: 0, range: 5, rate: 0, aura: { rate: 0.22, range: 0.3, shield: true } },
    ],
  },
  mine: {
    name: "Gold Mine",
    tagline: "Pays gold every wave. Up to 3",
    color: "#b45309",
    accent: "#fde68a",
    projSpeed: 0,
    turnSpeed: 0,
    pierce: false,
    needsSight: false,
    hitsAir: false,
    role: "income",
    limit: 3,
    levels: [
      { cost: 150, dmg: 0, range: 0, rate: 0, income: 30 },
      { cost: 130, dmg: 0, range: 0, rate: 0, income: 60 },
      { cost: 220, dmg: 0, range: 0, rate: 0, income: 105 },
    ],
    specs: [
      { name: "Vault", blurb: "Twice the gold every wave.", cost: 350, dmg: 0, range: 0, rate: 0, income: 210 },
      { name: "Bounty Board", blurb: "Every enemy you defeat is worth 30% more. One board is enough.", cost: 300, dmg: 0, range: 0, rate: 0, income: 105, bounty: 0.3 },
    ],
  },
};

export const TOWER_ORDER: TowerType[] = [
  "blaster",
  "frost",
  "bomb",
  "sniper",
  "tesla",
  "beacon",
  "mine",
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

// ─── Abilities ────────────────────────────────────────────────────────────────

export type AbilityId = "meteor" | "freeze";

export const ABILITIES = {
  meteor: {
    name: "Meteor",
    hint: "Pick a spot. A meteor lands there a moment later and hits everything, even Shades and flyers.",
    cooldown: 40,
    radius: 1.8,
    delay: 0.7,
  },
  freeze: {
    name: "Cold Snap",
    hint: "Slows every enemy on the map to a crawl for a few seconds. Ragers shrug it off.",
    cooldown: 55,
    slow: 0.25,
    duration: 4,
  },
} as const;

export const ABILITY_ORDER: AbilityId[] = ["meteor", "freeze"];

/** Meteor damage grows with the wave so it stays useful (it ignores armor). */
export const meteorDamage = (waveNumber: number) => 200 + 45 * waveNumber;

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

// [health, speed, gold per kill] then the groups, in the order they march in.
const wave = (baseHp: number, baseSpeed: number, baseReward: number, ...groups: [EnemyType, number, number][]): WaveDef => ({
  groups: groups.map(([type, count, interval]) => ({ type, count, interval })),
  baseHp,
  baseSpeed,
  baseReward,
});

export const WAVES: WaveDef[] = [
  /*  1 */ wave(60, 2.0, 8, ["normal", 6, 1.2]),
  /*  2 */ wave(85, 2.1, 9, ["normal", 8, 1.0]),
  /*  3 */ wave(120, 2.2, 10, ["normal", 5, 1.0], ["fast", 4, 0.7]),
  /*  4 */ wave(125, 2.3, 10, ["normal", 4, 1.0], ["flyer", 5, 0.9]),
  /*  5 */ wave(170, 2.3, 12, ["normal", 6, 1.0], ["tank", 2, 2.0]),
  /*  6 */ wave(205, 2.4, 10, ["swarm", 16, 0.4]),
  /*  7 */ wave(245, 2.5, 11, ["splitter", 4, 1.4], ["fast", 5, 0.6]),
  /*  8 */ wave(310, 2.5, 13, ["normal", 6, 0.9], ["shade", 5, 1.0]),
  /*  9 */ wave(380, 2.6, 13, ["armored", 5, 1.2], ["normal", 6, 0.9]),
  /* 10 */ wave(470, 2.6, 15, ["normal", 8, 0.8], ["boss", 1, 2.0]),
  /* 11 */ wave(590, 2.7, 15, ["fast", 6, 0.6], ["flyer", 8, 0.7]),
  /* 12 */ wave(680, 2.7, 17, ["charger", 5, 1.1], ["healer", 3, 1.0]),
  /* 13 */ wave(780, 2.8, 18, ["tank", 5, 1.5], ["healer", 3, 1.0]),
  /* 14 */ wave(900, 2.8, 16, ["shade", 8, 0.8], ["swarm", 14, 0.3]),
  /* 15 */ wave(1080, 2.9, 20, ["jammer", 2, 3.0], ["armored", 6, 1.0]),
  /* 16 */ wave(1300, 2.9, 17, ["swarm", 22, 0.3], ["flyer", 8, 0.6], ["tank", 2, 1.5]),
  /* 17 */ wave(1560, 3.0, 21, ["armored", 7, 1.0], ["splitter", 4, 1.2]),
  /* 18 */ wave(1870, 3.0, 21, ["charger", 6, 0.9], ["flyer", 8, 0.6], ["shade", 4, 0.8]),
  /* 19 */ wave(2240, 3.1, 25, ["jammer", 3, 2.5], ["tank", 4, 1.2], ["healer", 4, 0.8]),
  /* 20 */ wave(2690, 3.2, 30, ["armored", 6, 0.6], ["boss", 2, 3.0], ["healer", 4, 0.6]),
  /* 21 */ wave(3200, 3.2, 26, ["fast", 10, 0.4], ["flyer", 12, 0.5], ["shade", 6, 0.7]),
  /* 22 */ wave(3850, 3.25, 30, ["splitter", 6, 1.0], ["armored", 6, 0.8], ["jammer", 2, 2.5]),
  /* 23 */ wave(4650, 3.3, 32, ["tank", 6, 1.1], ["healer", 5, 0.8], ["charger", 6, 0.9]),
  /* 24 */ wave(5550, 3.3, 26, ["swarm", 30, 0.22], ["shade", 8, 0.6], ["flyer", 8, 0.5]),
  /* 25 */ wave(6700, 3.35, 36, ["boss", 2, 3.0], ["jammer", 3, 2.0], ["armored", 6, 0.7]),
  /* 26 */ wave(8000, 3.4, 36, ["charger", 8, 0.8], ["splitter", 6, 0.9], ["healer", 4, 0.7]),
  /* 27 */ wave(9650, 3.4, 32, ["flyer", 14, 0.45], ["shade", 10, 0.55], ["fast", 10, 0.4]),
  /* 28 */ wave(11550, 3.45, 40, ["tank", 6, 1.0], ["armored", 8, 0.6], ["jammer", 3, 2.0], ["healer", 5, 0.7]),
  /* 29 */ wave(13850, 3.5, 44, ["boss", 3, 3.0], ["charger", 6, 0.8], ["splitter", 6, 0.9]),
  /* 30 */ wave(16650, 3.5, 50, ["armored", 6, 0.6], ["jammer", 2, 2.0], ["healer", 4, 0.6], ["boss", 2, 3.0], ["emperor", 1, 4.0]),
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
  { type: "shade", count: 9, interval: 0.6 },
  { type: "charger", count: 7, interval: 0.8 },
  { type: "jammer", count: 3, interval: 2 },
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
  const last = WAVES[WAVES.length - 1];
  const wave: WaveDef = {
    groups,
    baseHp: Math.round(last.baseHp * Math.pow(1.12, k)),
    baseSpeed: Math.min(4.4, last.baseSpeed + k * 0.03),
    baseReward: last.baseReward + k,
  };
  endlessCache.set(index, wave);
  return wave;
}

/** Gold for clearing the board after the given (1-based) wave number. */
export const waveClearBonus = (waveNumber: number) => 25 + waveNumber * 5;
/** Gold for calling the next wave before the current one is finished. */
export const earlyCallBonus = (waveNumber: number) => 10 + waveNumber * 2;
