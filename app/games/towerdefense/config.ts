// ─── Tower Defense: static game configuration ─────────────────────────────────

export const ROWS = 11;
export const COLS = 20;
export const ENTRY = { r: 5, c: 0 } as const;
export const EXIT = { r: 5, c: 19 } as const;
export const MAX_LIVES = 20;
export const START_GOLD = 150;
/** Fraction of everything spent on a tower that comes back when selling. */
export const SELL_REFUND = 0.7;
/** Flat-armor hits can never be reduced below this fraction of base damage. */
export const MIN_ARMOR_DAMAGE = 0.25;

// ─── Enemies ──────────────────────────────────────────────────────────────────

export type EnemyType =
  | "normal"
  | "fast"
  | "tank"
  | "swarm"
  | "boss"
  | "healer"
  | "armored";

export interface EnemyDef {
  name: string;
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
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  normal: {
    name: "Gloop",
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
};

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
    levels: [
      { cost: 100, dmg: 90, range: 6, rate: 0.6 },
      { cost: 90, dmg: 170, range: 6.8, rate: 0.7 },
      { cost: 160, dmg: 320, range: 7.5, rate: 0.8 },
    ],
  },
  bomb: {
    name: "Bomber",
    tagline: "Explodes on groups",
    color: "#ef4444",
    accent: "#fdba74",
    projSpeed: 0, // lobbed: fixed flight time
    turnSpeed: 6,
    pierce: false,
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
    tagline: "Lightning chains between foes",
    color: "#eab308",
    accent: "#fef08a",
    projSpeed: 0,
    turnSpeed: 0,
    pierce: false,
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
  { groups: [{ type: "normal", count: 8, interval: 1.0 }], baseHp: 80, baseSpeed: 2.1, baseReward: 9 },
  {
    groups: [
      { type: "normal", count: 5, interval: 1.0 },
      { type: "fast", count: 4, interval: 0.7 },
    ],
    baseHp: 100, baseSpeed: 2.2, baseReward: 10,
  },
  { groups: [{ type: "fast", count: 8, interval: 0.6 }], baseHp: 90, baseSpeed: 2.3, baseReward: 10 },
  {
    groups: [
      { type: "normal", count: 5, interval: 1.0 },
      { type: "tank", count: 2, interval: 2.0 },
    ],
    baseHp: 120, baseSpeed: 2.3, baseReward: 12,
  },
  { groups: [{ type: "swarm", count: 15, interval: 0.4 }], baseHp: 130, baseSpeed: 2.4, baseReward: 10 },
  {
    groups: [
      { type: "swarm", count: 10, interval: 0.4 },
      { type: "fast", count: 5, interval: 0.6 },
    ],
    baseHp: 150, baseSpeed: 2.5, baseReward: 11,
  },
  {
    groups: [
      { type: "armored", count: 5, interval: 1.2 },
      { type: "normal", count: 5, interval: 0.9 },
    ],
    baseHp: 180, baseSpeed: 2.5, baseReward: 13,
  },
  {
    groups: [
      { type: "fast", count: 6, interval: 0.6 },
      { type: "armored", count: 4, interval: 1.0 },
    ],
    baseHp: 210, baseSpeed: 2.6, baseReward: 14,
  },
  {
    groups: [
      { type: "normal", count: 8, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
    ],
    baseHp: 250, baseSpeed: 2.6, baseReward: 15,
  },
  {
    groups: [
      { type: "healer", count: 4, interval: 1.0 },
      { type: "normal", count: 8, interval: 0.8 },
    ],
    baseHp: 300, baseSpeed: 2.7, baseReward: 16,
  },
  {
    groups: [
      { type: "tank", count: 5, interval: 1.5 },
      { type: "healer", count: 3, interval: 1.0 },
    ],
    baseHp: 350, baseSpeed: 2.7, baseReward: 18,
  },
  {
    groups: [
      { type: "swarm", count: 20, interval: 0.3 },
      { type: "fast", count: 6, interval: 0.5 },
    ],
    baseHp: 380, baseSpeed: 2.8, baseReward: 15,
  },
  {
    groups: [
      { type: "armored", count: 8, interval: 1.0 },
      { type: "tank", count: 4, interval: 1.5 },
    ],
    baseHp: 420, baseSpeed: 2.8, baseReward: 20,
  },
  {
    groups: [
      { type: "armored", count: 6, interval: 0.8 },
      { type: "boss", count: 1, interval: 2.0 },
      { type: "healer", count: 4, interval: 0.8 },
    ],
    baseHp: 480, baseSpeed: 2.9, baseReward: 22,
  },
  {
    groups: [
      { type: "fast", count: 6, interval: 0.5 },
      { type: "normal", count: 6, interval: 0.7 },
      { type: "armored", count: 4, interval: 1.0 },
    ],
    baseHp: 550, baseSpeed: 3.0, baseReward: 22,
  },
  {
    groups: [
      { type: "healer", count: 6, interval: 0.8 },
      { type: "tank", count: 4, interval: 1.2 },
      { type: "healer", count: 4, interval: 0.8 },
    ],
    baseHp: 620, baseSpeed: 3.0, baseReward: 25,
  },
  {
    groups: [
      { type: "swarm", count: 25, interval: 0.25 },
      { type: "fast", count: 8, interval: 0.4 },
    ],
    baseHp: 700, baseSpeed: 3.1, baseReward: 20,
  },
  {
    groups: [
      { type: "tank", count: 4, interval: 1.2 },
      { type: "armored", count: 6, interval: 0.8 },
      { type: "healer", count: 4, interval: 0.8 },
      { type: "fast", count: 8, interval: 0.4 },
    ],
    baseHp: 800, baseSpeed: 3.2, baseReward: 28,
  },
  {
    groups: [
      { type: "armored", count: 8, interval: 0.6 },
      { type: "boss", count: 2, interval: 3.0 },
      { type: "healer", count: 6, interval: 0.6 },
      { type: "tank", count: 4, interval: 1.0 },
    ],
    baseHp: 1000, baseSpeed: 3.3, baseReward: 35,
  },
];

export const TOTAL_WAVES = WAVES.length;

/** Gold for clearing the board after the given (1-based) wave number. */
export const waveClearBonus = (waveNumber: number) => 25 + waveNumber * 5;
/** Gold for calling the next wave before the current one is finished. */
export const earlyCallBonus = (waveNumber: number) => 10 + waveNumber * 2;
