// ─── Sneaky Eggs: simulation (no drawing, no DOM) ───────────────────────────

import { ACHIEVEMENTS } from "./achievements";
import {
  BIOME_COUNT,
  BIOME_H,
  BIOMES,
  BUG_RESPAWN,
  BUGS_PER_LAND,
  CENTER_X,
  CHEST,
  CHEST_MS,
  DASH_BOOST,
  DECOR_BONUS,
  DASH_TIME,
  DELIVER_Y,
  DELIVERY_SECONDS,
  ALARM_SPEED,
  ALERT_TIME,
  FEATHER_BONUS,
  courierEvery,
  feathersFor,
  ANCIENT_GRAB,
  ANCIENT_TIME,
  ANCIENT_WEIGHT,
  CLOCK_ANCIENT_SKIP,
  CLOVER_LUCK,
  DIZZY_TIME,
  EGG_RESPAWN,
  EGG_WEIGHT,
  FAR_NEST_LUCK,
  FEATHER_CD,
  FREEZE_CD,
  FREEZE_TIME,
  LEVEL_COIN_BONUS,
  MAX_LEVEL,
  MINI_CHASE,
  MINI_LANE,
  MINI_LEASH,
  MINI_PATROL,
  MINI_R,
  MINI_SEE,
  POWERUP_EVERY,
  POWERUP_IDS,
  POWERUP_LIFE,
  POWER_EGGS,
  SNAIL_SLOW,
  STAR_EGG_COINS,
  ancientSpot,
  equipSlots,
  powerEggById,
  xpNeed,
  type PowerEggId,
  type PowerupId,
  FRENZY_TIME,
  FUSE_COUNT,
  GATE_W,
  GOLDEN_BUG_CHANCE,
  GOLDEN_NEST_LUCK,
  GRAB_TIME,
  GUARD_POST,
  GUARD_R,
  HATS,
  HOME_DECOR,
  HOME_TOP,
  HUT,
  IDLE_SLEEP_AFTER,
  MAX_WEIGHT,
  MISSION_STREAK,
  MISSION_STREAK_STARS,
  MISSIONS,
  MYSTERY_EVERY,
  MYSTERY_LIFETIME,
  NIGHT_LUCK,
  NIGHT_WAKE_BONUS,
  PAD_COUNT,
  PAD_Y,
  PAT_COOLDOWN,
  PEN,
  PETS,
  PICKUP_DIST,
  PLAYER_R,
  PLAYER_START,
  RARITIES,
  RIPEN_TIME,
  SECRET_STAR_REWARD,
  SELL_SECONDS,
  SUGAR_RUSH_BOOST,
  SUGAR_RUSH_TIME,
  TAP_BOOST,
  TRAILS,
  UFO,
  VARIANTS,
  WORLD_H,
  WORLD_W,
  armsScale,
  basketSize,
  biomeAt,
  biomeBottom,
  biomeTop,
  dashCooldown,
  fmtCoins,
  guardSpeed,
  handsScale,
  hatchScale,
  nestSpots,
  nightAmount,
  padX,
  penSize,
  petById,
  petFor,
  petRate,
  playerSpeed,
  rarityWeights,
  ripenScale,
  rollSize,
  rollVariant,
  sockBonus,
  travelPoint,
  treatsMult,
  upgradeCost,
  DICE_CONSOLATION,
  DICE_MAX,
  HAPPY_COINS,
  MINI_BUFF_TIME,
  MINI_DICE,
  MINI_DOOR_R,
  MINI_TIP_SECONDS,
  MINIS,
  SIZES,
  ZOOMIES_BOOST,
  miniById,
  type DecorKind,
  type HatId,
  type HomeDecorId,
  type Medal,
  type MiniId,
  type MissionKind,
  type PetDef,
  type Point,
  type Rarity,
  type SolidKind,
  type TrailId,
  type UpgradeId,
} from "./config";

/* ---------- Types ---------- */

export interface Input {
  x: number;
  y: number;
}

export interface EggInfo {
  biome: number;
  rarity: Rarity;
  /** Set when this is a Power Egg from an ancient nest. */
  power?: PowerEggId;
  /** It came from a grove nest. */
  far?: boolean;
}

/** The slow nest deep in each land's grove that lays a Power Egg. */
export interface Ancient {
  biome: number;
  x: number;
  y: number;
  /** Seconds until the egg is ready, and what the countdown started at. */
  left: number;
  total: number;
  grab: number;
  power: PowerEggId;
}

/** A little Grumble that paces a lane at the edge of a grove. */
export interface Mini {
  biome: number;
  side: -1 | 1;
  x: number;
  y: number;
  dir: -1 | 1;
  state: "patrol" | "chase" | "return";
  flip: boolean;
  walkT: number;
}

/** A power-up lying in a grove. */
export interface Pickup {
  kind: PowerupId;
  biome: number;
  x: number;
  y: number;
  left: number;
  age: number;
}

export interface Nest {
  biome: number;
  x: number;
  y: number;
  golden: boolean;
  egg: Rarity | null;
  respawn: number;
  /** Seconds since the egg appeared, for the pop-in. */
  age: number;
  /** Seconds until the egg is ripe enough to pick up, and what that started at. */
  ripen: number;
  ripenTotal: number;
  /** 0–1: how far along the player is in lifting it. */
  grab: number;
  /** A grove nest, far off to the side: better eggs. */
  far: boolean;
}

export type GuardState = "sleep" | "waking" | "alert" | "chase" | "huff" | "return";

export interface Guard {
  biome: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  state: GuardState;
  t: number;
  flip: boolean;
  walkT: number;
  /** Closest the Grumble got during this chase. */
  minGap: number;
  /** Counts down after a friendly pat (for the happy wiggle). */
  pat: number;
}

export interface Pad {
  egg: EggInfo | null;
  left: number;
  total: number;
  wobble: number;
  reserved: boolean;
  blocked: boolean;
}

export interface Pet {
  uid: number;
  id: string;
  /** Hatch rolls: variant (0 plain, 1 Shiny, 2 Golden, 3 Rainbow) and size tier (0–3). */
  v: number;
  s: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  hop: number;
  flip: boolean;
  payT: number;
  age: number;
  patCd: number;
  /** Counts down while the pet is extra happy (just patted). */
  joy: number;
}

export interface Solid {
  x: number;
  y: number;
  r: number;
  kind: SolidKind;
  /** 0–1 picks colours; -1 is the hut and -2 the gift chest. */
  seed: number;
}

export interface Decor {
  x: number;
  y: number;
  kind: DecorKind;
  s: number;
  seed: number;
}

export interface Flight {
  egg: EggInfo;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  pad: number;
}

export type ParticleKind = "dot" | "star" | "heart" | "ring";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: ParticleKind;
  /** Downward pull. Trails float (0), bursts fall. */
  grav: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

/** A glitterbug: flutters around a land and bursts into coins when caught. */
export interface Bug {
  biome: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  alive: boolean;
  respawn: number;
  hue: number;
  golden: boolean;
}

export interface Mystery {
  biome: number;
  x: number;
  y: number;
  rarity: Rarity;
  left: number;
  age: number;
  grab: number;
}

export interface ShootingStar {
  t: number;
  dur: number;
  seed: number;
  caught: boolean;
}

export interface Mission {
  kind: MissionKind;
  target: number;
  /** The stat's value when the mission was handed out. */
  start: number;
  /** Counts down after it's done, until a fresh mission takes its place. */
  doneT: number;
}

export type Upgrades = Record<UpgradeId, number>;

export interface Player {
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  walkT: number;
  stun: number;
  kx: number;
  ky: number;
  carry: EggInfo[];
  /** Last direction walked, for the buddy to trail behind. */
  dirX: number;
  dirY: number;
  dashT: number;
  dashCd: number;
  rushT: number;
  idleT: number;
  asleep: boolean;
  trailT: number;
  /** True while standing at a nest lifting an egg. That is enough to bring the Grumble. */
  grabbing: boolean;
}

export interface Stats {
  eggs: number;
  caught: number;
  fused: number;
  taps: number;
  pats: number;
  shinies: number;
  golden: number;
  night: number;
  mystery: number;
  bugs: number;
  chests: number;
  dashes: number;
  escapes: number;
  close: number;
  maxCarry: number;
  wishes: number;
  grumblePats: number;
  knocks: number;
  sugar: number;
  coconuts: number;
  snowmen: number;
  chimes: number;
  travels: number;
  missions: number;
  /** Legendary eggs carried home. */
  legendEggs: number;
  /** Power-ups used, freezes cast, and times a Grumble sent you home. */
  powerups: number;
  freezes: number;
  sentHome: number;
  /** Eggs carried home from the grove nests. */
  farEggs: number;
  /** House-ad counts, kept on this device only. */
  adsOpened: number;
  adsDone: number;
  adsClicked: number;
  shares: number;
  rebirths: number;
  /** Eggs the courier has brought home. */
  couriered: number;
  /** Mini games played, tent prizes won, and Lucky Dice rolled. */
  minis: number;
  prizes: number;
  diceUsed: number;
  /** Every coin ever earned. */
  earned: number;
}

const ZERO_STATS: Stats = {
  eggs: 0, caught: 0, fused: 0, taps: 0, pats: 0, shinies: 0, golden: 0, night: 0,
  mystery: 0, bugs: 0, chests: 0, dashes: 0, escapes: 0, close: 0, maxCarry: 0,
  wishes: 0, grumblePats: 0, knocks: 0, sugar: 0, coconuts: 0, snowmen: 0, chimes: 0,
  travels: 0, missions: 0, legendEggs: 0, earned: 0,
  powerups: 0, freezes: 0, sentHome: 0, farEggs: 0,
  adsOpened: 0, adsDone: 0, adsClicked: 0, shares: 0, rebirths: 0, couriered: 0,
  minis: 0, prizes: 0, diceUsed: 0,
};

const ZERO_UPGRADES: Upgrades = {
  speed: 0, pen: 0, luck: 0, basket: 0, dash: 0, warm: 0, socks: 0, treats: 0, sparkle: 0,
  hands: 0, arms: 0, ripen: 0, courier: 0, jar: 0,
};

export type BlockReason =
  | "gate" | "hands" | "pads" | "pen" | "chest" | "travel" | "ripening" | "ancient" | "holding" | "door";

export type GameEvent =
  | { type: "pickup"; rarity: Rarity; mystery: boolean }
  | { type: "wake"; biome: number }
  | { type: "caught"; eggs: number; home: boolean }
  | { type: "level"; level: number; stars: number }
  | { type: "alarm" }
  | { type: "mini" }
  | { type: "shield" }
  | { type: "feather" }
  | { type: "gotPower"; kind: PowerupId }
  | { type: "power"; kind: PowerupId }
  | { type: "powerHint" }
  | { type: "powerEgg"; id: PowerEggId; isNew: boolean }
  | { type: "freeze" }
  | { type: "ancientReady"; biome: number }
  | { type: "courier"; rarity: Rarity }
  | { type: "rebirth"; feathers: number }
  | { type: "door"; id: MiniId }
  | { type: "dice"; petId: string; v: number; s: number; better: boolean; coins: number }
  | { type: "buffEnd"; kind: "zoom" | "happy" }
  | { type: "escape"; close: boolean }
  | { type: "deliver"; coins: number }
  | { type: "hatch"; petId: string; isNew: boolean; v: number; s: number; fused: boolean }
  | { type: "grab"; rarity: Rarity }
  | { type: "ripe"; biome: number; rarity: Rarity }
  | { type: "biome"; biome: number }
  | { type: "blocked"; reason: BlockReason; biome: number; seconds: number }
  | { type: "tap" }
  | { type: "complete" }
  | { type: "achievement"; id: string }
  | { type: "catchup"; count: number; stars: number }
  | { type: "pat"; coins: number }
  | { type: "grumblePat" }
  | { type: "knock"; coins: number }
  | { type: "chest"; coins: number }
  | { type: "mystery"; biome: number }
  | { type: "mysteryGone" }
  | { type: "night" }
  | { type: "day" }
  | { type: "wish"; coins: number }
  | { type: "sugar" }
  | { type: "coconut"; coins: number }
  | { type: "chime"; note: number }
  | { type: "boing" }
  | { type: "rustle" }
  | { type: "snow" }
  | { type: "secret"; count: number }
  | { type: "taxi" }
  | { type: "sleepy" }
  | { type: "dash" }
  | { type: "travel"; biome: number }
  | { type: "bug"; coins: number; golden: boolean }
  | { type: "frenzy" }
  | { type: "mission"; kind: MissionKind; target: number; coins: number; stars: number };

export interface Game {
  time: number;
  /** Cozy mode: eggs are always ripe, lift instantly and weigh nothing. */
  cozy: boolean;
  /** Time of day, in seconds. Starts each session in the morning. */
  clock: number;
  night: boolean;
  player: Player;
  nests: Nest[];
  guards: Guard[];
  pads: Pad[];
  pets: Pet[];
  solids: Solid[];
  decor: Decor[];
  /** Per-solid wobble (0–1) and special cooldown, same order as `solids`. */
  wob: Float32Array;
  cool: Float32Array;
  flights: Flight[];
  particles: Particle[];
  popups: Popup[];
  bugs: Bug[];
  mystery: Mystery | null;
  mysteryIn: number;
  shoot: ShootingStar | null;
  shootIn: number;
  coins: number;
  stars: number;
  up: Upgrades;
  /** Pet id -> 1 (found), 2 (Shiny found), 3 (Golden found), 4 (Rainbow found). */
  book: Record<string, number>;
  stats: Stats;
  /** Unlocked achievement ids. */
  ach: Record<string, number>;
  hats: HatId[];
  trails: TrailId[];
  hat: HatId;
  trail: TrailId;
  /** Decorations placed around the home. */
  home: HomeDecorId[];
  /** Seconds of double coins left (from catching a shooting star). */
  frenzy: number;
  missions: Mission[];
  /** Lands whose hidden star has been found. */
  secrets: number[];
  secretSpots: Point[];
  /** uid of the pet that follows the player, or 0. */
  buddy: number;
  /** One-off things that happened (secrets, mostly). */
  flags: Record<string, number>;
  /** Golden Feathers from rebirths, and the coins earned since the last one. */
  feathers: number;
  runEarned: number;
  courierT: number;
  /** Player level and the XP gathered toward the next one. */
  level: number;
  xp: number;
  /** Power Eggs owned, and the ones being worn. */
  powerEggs: PowerEggId[];
  equipped: PowerEggId[];
  /** The power-up in your pocket. */
  held: PowerupId | null;
  ancients: Ancient[];
  minis: Mini[];
  pickups: Pickup[];
  pickupIn: number;
  /** Seconds left of frozen or confused Grumbles, and the cooldowns. */
  freezeT: number;
  freezeCd: number;
  confuseT: number;
  featherCd: number;
  /** Mini games: best medal per tent, and when each tent's prize was last won (ms since 1970). */
  medals: Record<MiniId, Medal>;
  prizeAt: Record<MiniId, number>;
  /** Lucky Dice in your pocket. */
  dice: number;
  /** Seconds of Zoomies (faster running) and happy pets (double coins) left. */
  zoomT: number;
  happyT: number;
  /** A moment's peace after knocking on a tent, so the question doesn't pop straight back up. */
  doorCd: number;
  /** When the gift chest was last opened (ms since 1970). */
  lastChest: number;
  chestAnim: number;
  ufoCd: number;
  biome: number;
  events: GameEvent[];
  nextUid: number;
  hintAt: Record<string, number>;
  completeSent: boolean;
  achT: number;
  /** Recently rung crystals, for the Crystal Song secret. */
  rung: { idx: number; at: number }[];
}

/** The part of a save file the engine owns. Newer fields are optional so old saves load. */
export interface SavedGame {
  coins: number;
  up: Partial<Upgrades>;
  pets: { id: string; shiny?: boolean; v?: number; s?: number }[];
  book: Record<string, number>;
  pads: ({ biome: number; rarity: Rarity; left: number } | null)[];
  stats: Partial<Stats>;
  stars?: number;
  ach?: string[];
  hats?: HatId[];
  trails?: TrailId[];
  hat?: HatId;
  trail?: TrailId;
  home?: HomeDecorId[];
  missions?: { kind: MissionKind; target: number; progress: number }[];
  secrets?: number[];
  /** Index into `pets` of the buddy, or -1. */
  buddy?: number;
  flags?: Record<string, number>;
  feathers?: number;
  runEarned?: number;
  level?: number;
  xp?: number;
  powerEggs?: string[];
  equipped?: string[];
  held?: string | null;
  /** Seconds left on each land's ancient nest. */
  ancients?: number[];
  lastChest?: number;
  medals?: Record<string, number>;
  prizeAt?: Record<string, number>;
  dice?: number;
  zoomT?: number;
  happyT?: number;
}

/* ---------- Helpers ---------- */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(luck: number): Rarity {
  const w = rarityWeights(luck);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i as Rarity;
  }
  return 0;
}

function emit(g: Game, ev: GameEvent) {
  g.events.push(ev);
}

/** Emit a "you can't do that" nudge at most once every few seconds. */
function hint(g: Game, reason: BlockReason, biome = -1, seconds = 0) {
  if (g.time - (g.hintAt[reason] ?? -99) < 2.6) return;
  g.hintAt[reason] = g.time;
  emit(g, { type: "blocked", reason, biome, seconds });
}

export function burst(
  g: { particles: Particle[] },
  x: number,
  y: number,
  color: string,
  n: number,
  kind: ParticleKind = "dot",
  speed = 150,
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.65);
    const max = 0.45 + Math.random() * 0.4;
    g.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      life: max, max, color,
      size: kind === "dot" ? rand(3, 6) : rand(5, 9),
      kind,
      grav: kind === "heart" ? -40 : 260,
    });
  }
}

/** Slow floaty bits that rise from a point (hearts, sparkles). */
export function puff(g: { particles: Particle[] }, x: number, y: number, color: string, n: number, kind: ParticleKind) {
  for (let i = 0; i < n; i++) {
    const max = 0.7 + Math.random() * 0.5;
    g.particles.push({
      x: x + rand(-14, 14),
      y: y + rand(-6, 6),
      vx: rand(-22, 22),
      vy: rand(-70, -35),
      life: max, max, color,
      size: rand(6, 10),
      kind,
      grav: -10,
    });
  }
}

export function popup(g: { popups: Popup[] }, x: number, y: number, text: string, color: string, big = false) {
  const max = big ? 1.5 : 1.1;
  g.popups.push({ x, y, text, color, life: max, max, big });
}

function earn(g: Game, coins: number) {
  g.coins += coins;
  g.stats.earned += coins;
  g.runEarned += coins;
}

const penPoint = (): Point => ({
  x: rand(PEN.x0 + 34, PEN.x1 - 34),
  y: rand(PEN.y0 + 30, PEN.y1 - 16),
});

function makePet(g: Game, id: string, v: number, s: number, at?: Point): Pet {
  const spot = at ?? penPoint();
  const target = penPoint();
  return {
    uid: g.nextUid++,
    id, v, s,
    x: spot.x, y: spot.y,
    tx: at ? target.x : spot.x,
    ty: at ? target.y : spot.y,
    wait: at ? 0.5 : rand(0, 2.5),
    hop: Math.random() * 6,
    flip: Math.random() < 0.5,
    payT: rand(0.4, 3),
    age: at ? 0 : 9,
    patCd: 0,
    joy: 0,
  };
}

/* ---------- World ---------- */

const SOLID_R: Record<SolidKind, number> = {
  tree: 26, bush: 20, palm: 22, rock: 22, pine: 24, snowpile: 22,
  lollipop: 18, gumdrop: 22, crystal: 20, moonrock: 24,
};

interface World {
  solids: Solid[];
  decor: Decor[];
  secrets: Point[];
}

function buildWorld(): World {
  const solids: Solid[] = [];
  const decor: Decor[] = [];
  const secrets: Point[] = [];

  for (let i = 0; i < BIOME_COUNT; i++) {
    const rng = mulberry32(4201 + i * 977);
    const top = biomeTop(i);
    const keepClear: (Point & { r: number })[] = [
      { x: GUARD_POST.x, y: top + GUARD_POST.dy, r: 135 },
      ...nestSpots(i).map((n) => ({ x: n.x, y: n.y, r: 105 })),
      { ...ancientSpot(i), r: 110 },
    ];
    if (i === BIOME_COUNT - 1) keepClear.push({ x: UFO.x, y: UFO.y, r: 90 });
    const mine: Solid[] = [];
    for (let tries = 0; tries < 700 && mine.length < 22; tries++) {
      const kind = BIOMES[i].solids[Math.floor(rng() * BIOMES[i].solids.length)];
      const r = SOLID_R[kind];
      const x = 46 + rng() * (WORLD_W - 92);
      const y = top + 76 + rng() * (BIOME_H - 152);
      // Keep the middle path wide open so little players never get snagged.
      if (Math.abs(x - CENTER_X) < 128 + r) continue;
      // ...and the lanes the mini-Grumbles pace along.
      if (Math.abs(Math.abs(x - CENTER_X) - MINI_LANE) < 46 + r) continue;
      if (keepClear.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r)) continue;
      if (mine.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r + 44)) continue;
      mine.push({ x, y, r, kind, seed: rng() });
    }
    // The mini-game tents were added later: rather than reshuffle a world players
    // already know, anything that would stand on one is simply left out.
    solids.push(
      ...mine.filter((s) => !MINIS.some((d) => Math.hypot(d.x - s.x, d.y - s.y) < s.r + MINI_DOOR_R + 44)),
    );

    for (let k = 0; k < 76; k++) {
      const kind = BIOMES[i].decor[Math.floor(rng() * BIOMES[i].decor.length)];
      decor.push({
        x: 20 + rng() * (WORLD_W - 40),
        y: top + 26 + rng() * (BIOME_H - 52),
        kind,
        s: 0.75 + rng() * 0.6,
        seed: rng(),
      });
    }

    // One hidden star per land, tucked into a far corner.
    const corners: Point[] = [
      { x: 64, y: top + 92 },
      { x: WORLD_W - 64, y: top + 92 },
      { x: 64, y: top + BIOME_H - 96 },
      { x: WORLD_W - 64, y: top + BIOME_H - 96 },
    ];
    const start = Math.floor(rng() * corners.length);
    let spot = corners[start];
    for (let k = 0; k < corners.length; k++) {
      const c = corners[(start + k) % corners.length];
      if (!mine.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < s.r + 34)) {
        spot = c;
        break;
      }
    }
    secrets.push(spot);
  }

  // Home: flowers around the edges; the hut and the gift chest are solid.
  const rng = mulberry32(90210);
  for (let k = 0; k < 30; k++) {
    const x = 20 + rng() * (WORLD_W - 40);
    const y = HOME_TOP + 30 + rng() * (WORLD_H - HOME_TOP - 50);
    const inPen = x > PEN.x0 - 20 && x < PEN.x1 + 20 && y > PEN.y0 - 20 && y < PEN.y1 + 20;
    const onPads = Math.abs(y - PAD_Y) < 60 && Math.abs(x - CENTER_X) < 280;
    const onChest = Math.hypot(x - CHEST.x, y - CHEST.y) < 60;
    if (inPen || onPads || onChest) continue;
    decor.push({ x, y, kind: rng() < 0.6 ? "flower" : "tuft", s: 0.75 + rng() * 0.6, seed: rng() });
  }
  solids.push({ x: HUT.x, y: HUT.y, r: HUT.r, kind: "bush", seed: -1 });
  solids.push({ x: CHEST.x, y: CHEST.y, r: CHEST.r, kind: "rock", seed: -2 });

  solids.sort((a, b) => a.y - b.y);
  return { solids, decor, secrets };
}

let WORLD: World | null = null;

/** A free spot in a land's side areas (for bugs and mystery eggs). */
function openSpot(g: Game, biome: number, lowerHalf: boolean): Point {
  const top = biomeTop(biome);
  for (let tries = 0; tries < 40; tries++) {
    const x = rand(90, WORLD_W - 90);
    const y = lowerHalf ? rand(top + 370, top + BIOME_H - 110) : rand(top + 70, top + BIOME_H - 80);
    if (Math.abs(x - CENTER_X) < 110) continue;
    if (g.solids.some((s) => Math.abs(s.y - y) < 90 && Math.hypot(s.x - x, s.y - y) < s.r + 40)) continue;
    if (g.nests.some((n) => n.biome === biome && Math.hypot(n.x - x, n.y - y) < 90)) continue;
    if (MINIS.some((d) => Math.hypot(d.x - x, d.y - y) < MINI_DOOR_R + 70)) continue;
    return { x, y };
  }
  return { x: CENTER_X + (Math.random() < 0.5 ? -200 : 200), y: top + BIOME_H - 150 };
}

/* ---------- Missions ---------- */

export const missionProgress = (g: Game, m: Mission) =>
  Math.max(0, Math.min(m.target, g.stats[m.kind] - m.start));

function newMission(g: Game): Mission {
  const active = g.missions.map((m) => m.kind);
  const pool = MISSIONS.filter((d) => {
    if (active.includes(d.kind)) return false;
    // Only hand out goals the player can actually do right now.
    if (d.kind === "dashes") return g.up.dash > 0;
    if (d.kind === "pats") return g.pets.length > 0;
    if (d.kind === "taps" || d.kind === "bugs") return g.stats.eggs > 0;
    return true;
  });
  const def = pick(pool.length ? pool : MISSIONS.filter((d) => !active.includes(d.kind)));
  return { kind: def.kind, target: pick(def.amounts), start: g.stats[def.kind], doneT: 0 };
}

function updateMissions(g: Game, dt: number) {
  for (let i = 0; i < g.missions.length; i++) {
    const m = g.missions[i];
    if (m.doneT > 0) {
      m.doneT -= dt;
      if (m.doneT <= 0) {
        g.missions.splice(i, 1);
        g.missions.splice(i, 0, newMission(g));
      }
      continue;
    }
    if (missionProgress(g, m) < m.target) continue;
    m.doneT = 2.5;
    g.stats.missions++;
    const coins = Math.max(30, Math.round(totalRate(g) * 40));
    const stars = g.stats.missions % MISSION_STREAK === 0 ? MISSION_STREAK_STARS : 0;
    earn(g, coins);
    g.stars += stars;
    addXp(g, 20);
    emit(g, { type: "mission", kind: m.kind, target: m.target, coins, stars });
  }
}

/* ---------- Create / save ---------- */

export interface CreateOptions {
  /** The title-screen secret: a much bigger player. */
  giant?: boolean;
  /** Turn off ripening timers, grab time and egg weight (for little players). */
  cozy?: boolean;
  /** Clock to use for the gift chest (tests pass a fake one). */
  now?: number;
}

export function createGame(saved?: SavedGame | null, opts: CreateOptions = {}): Game {
  WORLD ??= buildWorld();
  const g: Game = {
    time: 0,
    cozy: Boolean(opts.cozy),
    clock: 0,
    night: false,
    player: {
      x: PLAYER_START.x, y: PLAYER_START.y,
      flip: false, moving: false, walkT: 0, stun: 0, kx: 0, ky: 0, carry: [],
      dirX: 0, dirY: -1, dashT: 0, dashCd: 0, rushT: 0, idleT: 0, asleep: false, trailT: 0,
      grabbing: false,
    },
    nests: [],
    guards: [],
    pads: Array.from({ length: PAD_COUNT }, () => ({
      egg: null, left: 0, total: 1, wobble: 0, reserved: false, blocked: false,
    })),
    pets: [],
    solids: WORLD.solids,
    decor: WORLD.decor,
    wob: new Float32Array(WORLD.solids.length),
    cool: new Float32Array(WORLD.solids.length),
    flights: [],
    particles: [],
    popups: [],
    bugs: [],
    mystery: null,
    mysteryIn: rand(45, 70),
    shoot: null,
    shootIn: 6,
    coins: 0,
    stars: 0,
    up: { ...ZERO_UPGRADES },
    book: {},
    stats: { ...ZERO_STATS },
    ach: {},
    hats: ["none"],
    trails: ["none"],
    hat: "none",
    trail: "none",
    home: [],
    frenzy: 0,
    missions: [],
    secrets: [],
    secretSpots: WORLD.secrets,
    buddy: 0,
    flags: {},
    feathers: 0,
    runEarned: 0,
    courierT: 30,
    level: 1,
    xp: 0,
    powerEggs: [],
    equipped: [],
    held: null,
    ancients: [],
    minis: [],
    pickups: [],
    pickupIn: 20,
    freezeT: 0,
    freezeCd: 0,
    confuseT: 0,
    featherCd: 0,
    medals: { tag: 0, steps: 0, seek: 0 },
    prizeAt: { tag: 0, steps: 0, seek: 0 },
    dice: 0,
    zoomT: 0,
    happyT: 0,
    doorCd: 0,
    lastChest: 0,
    chestAnim: 0,
    ufoCd: 0,
    biome: -1,
    events: [],
    nextUid: 1,
    hintAt: {},
    completeSent: false,
    achT: 0,
    rung: [],
  };

  if (saved) {
    g.coins = Math.max(0, Number(saved.coins) || 0);
    g.up = { ...g.up, ...saved.up };
    g.book = { ...saved.book };
    g.stats = { ...g.stats, ...saved.stats };
    // Saves from before coins were counted: start the tally from what's in the bank.
    if (!saved.stats?.earned) g.stats.earned = g.coins;
    for (const p of saved.pets ?? []) {
      if (!petById(p.id)) continue;
      const v = clamp(Math.floor(p.v ?? (p.shiny ? 1 : 0)), 0, VARIANTS.length - 1);
      const size = clamp(Math.floor(p.s ?? 0), 0, 3);
      g.pets.push(makePet(g, p.id, v, size));
    }
    (saved.pads ?? []).forEach((s, i) => {
      if (!s || i >= PAD_COUNT) return;
      const total = RARITIES[s.rarity].hatch * hatchScale(g.up.warm);
      g.pads[i].egg = { biome: s.biome, rarity: s.rarity };
      g.pads[i].total = total;
      g.pads[i].left = clamp(s.left, 0, total);
    });
    g.stars = Math.max(0, Number(saved.stars) || 0);
    for (const id of saved.ach ?? []) g.ach[id] = 1;
    if (saved.hats?.length) g.hats = Array.from(new Set<HatId>(["none", ...saved.hats]));
    if (saved.trails?.length) g.trails = Array.from(new Set<TrailId>(["none", ...saved.trails]));
    if (saved.hat && g.hats.includes(saved.hat)) g.hat = saved.hat;
    if (saved.trail && g.trails.includes(saved.trail)) g.trail = saved.trail;
    g.secrets = (saved.secrets ?? []).filter((b) => b >= 0 && b < BIOME_COUNT);
    g.home = (saved.home ?? []).filter((id) => HOME_DECOR.some((d) => d.id === id));
    for (const m of saved.missions ?? []) {
      if (!MISSIONS.some((d) => d.kind === m.kind) || g.missions.length >= 3) continue;
      g.missions.push({ kind: m.kind, target: m.target, start: g.stats[m.kind] - (m.progress || 0), doneT: 0 });
    }
    g.flags = { ...saved.flags };
    g.feathers = Math.max(0, Math.floor(saved.feathers ?? 0));
    // Saves from before rebirth existed count everything earned so far.
    g.runEarned = Math.max(0, saved.runEarned ?? saved.stats?.earned ?? 0);
    g.level = clamp(Math.floor(saved.level ?? 1), 1, MAX_LEVEL);
    g.xp = Math.max(0, saved.xp ?? 0);
    g.powerEggs = (saved.powerEggs ?? []).filter((id): id is PowerEggId => Boolean(powerEggById(id)));
    g.equipped = (saved.equipped ?? [])
      .filter((id): id is PowerEggId => g.powerEggs.includes(id as PowerEggId))
      .slice(0, equipSlots(g.level));
    g.held = POWERUP_IDS.includes(saved.held as PowerupId) ? (saved.held as PowerupId) : null;
    g.lastChest = Number(saved.lastChest) || 0;
    for (const m of MINIS) {
      g.medals[m.id] = clamp(Math.floor(Number(saved.medals?.[m.id]) || 0), 0, 3) as Medal;
      g.prizeAt[m.id] = Number(saved.prizeAt?.[m.id]) || 0;
    }
    g.dice = clamp(Math.floor(Number(saved.dice) || 0), 0, DICE_MAX);
    g.zoomT = Math.max(0, Number(saved.zoomT) || 0);
    g.happyT = Math.max(0, Number(saved.happyT) || 0);
    const buddy = saved.buddy ?? -1;
    if (buddy >= 0 && buddy < g.pets.length) g.buddy = g.pets[buddy].uid;
    g.completeSent = PETS.every((p) => p.rarity === 4 || g.book[p.id]);
  }
  if (opts.giant) g.flags.giant = 1;
  // A brand-new player's first mission is the simplest one there is.
  if (!saved) g.missions.push({ kind: "eggs", target: 3, start: 0, doneT: 0 });
  while (g.missions.length < 3) g.missions.push(newMission(g));

  for (let i = 0; i < BIOME_COUNT; i++) {
    const top = biomeTop(i);
    for (const spot of nestSpots(i)) {
      g.nests.push({
        biome: i,
        x: spot.x,
        y: spot.y,
        golden: spot.golden,
        // A brand-new player always finds friendly Common eggs first.
        egg:
          !saved && i === 0 && !spot.golden && !spot.far
            ? 0
            : rollRarity(g.up.luck + (spot.golden ? GOLDEN_NEST_LUCK : 0) + (spot.far ? FAR_NEST_LUCK : 0)),
        respawn: 0,
        age: 9,
        ripen: 0,
        ripenTotal: 0,
        grab: 0,
        far: spot.far,
      });
    }
    const total = ancientTime(g, i);
    g.ancients.push({
      biome: i,
      ...ancientSpot(i),
      // A new game starts with the first one half-grown so it's found early.
      left: clamp(saved?.ancients?.[i] ?? total * 0.5, 0, total),
      total,
      grab: 0,
      power: POWER_EGGS[i].id,
    });
    for (const side of [-1, 1] as const) {
      g.minis.push({
        biome: i,
        side,
        x: CENTER_X + side * MINI_LANE,
        y: top + (side < 0 ? 160 : BIOME_H - 160),
        dir: side < 0 ? 1 : -1,
        state: "patrol",
        flip: false,
        walkT: 0,
      });
    }
    g.guards.push({
      biome: i,
      x: GUARD_POST.x, y: top + GUARD_POST.dy,
      homeX: GUARD_POST.x, homeY: top + GUARD_POST.dy,
      state: "sleep", t: 0, flip: false, walkT: 0, minGap: Infinity, pat: 0,
    });
    for (let k = 0; k < BUGS_PER_LAND; k++) {
      const at = openSpot(g, i, false);
      g.bugs.push({
        biome: i, x: at.x, y: at.y, tx: at.x, ty: at.y,
        t: Math.random() * 10, alive: true, respawn: 0, hue: Math.random(), golden: false,
      });
    }
  }

  // Anything a returning player has already earned unlocks quietly, in one go.
  if (saved) {
    let count = 0;
    let stars = 0;
    for (const a of ACHIEVEMENTS) {
      if (g.ach[a.id] || a.progress(g) < a.target) continue;
      g.ach[a.id] = 1;
      g.stars += a.stars;
      count++;
      stars += a.stars;
    }
    if (count) emit(g, { type: "catchup", count, stars });
  }
  return g;
}

export function toSave(g: Game): SavedGame {
  return {
    coins: Math.floor(g.coins),
    up: { ...g.up },
    pets: g.pets.map((p) => ({ id: p.id, ...(p.v ? { v: p.v } : {}), ...(p.s ? { s: p.s } : {}) })),
    book: { ...g.book },
    pads: g.pads.map((p) =>
      p.egg ? { biome: p.egg.biome, rarity: p.egg.rarity, left: Math.max(0, p.left) } : null,
    ),
    stats: { ...g.stats, earned: Math.floor(g.stats.earned) },
    stars: g.stars,
    ach: Object.keys(g.ach),
    hats: [...g.hats],
    trails: [...g.trails],
    hat: g.hat,
    trail: g.trail,
    home: [...g.home],
    missions: g.missions
      .filter((m) => m.doneT <= 0)
      .map((m) => ({ kind: m.kind, target: m.target, progress: missionProgress(g, m) })),
    secrets: [...g.secrets],
    buddy: g.pets.findIndex((p) => p.uid === g.buddy),
    flags: { ...g.flags },
    feathers: g.feathers,
    runEarned: Math.floor(g.runEarned),
    level: g.level,
    xp: g.xp,
    powerEggs: [...g.powerEggs],
    equipped: [...g.equipped],
    held: g.held,
    ancients: g.ancients.map((a) => Math.ceil(a.left)),
    lastChest: g.lastChest,
    medals: { ...g.medals },
    prizeAt: { ...g.prizeAt },
    dice: g.dice,
    zoomT: Math.ceil(g.zoomT),
    happyT: Math.ceil(g.happyT),
  };
}

/* ---------- Queries ---------- */

/** Everything that multiplies coins: treats, home decorations, happy pets, and a lucky-star frenzy. */
export function coinMult(g: Game): number {
  return (
    treatsMult(g.up.treats) *
    (1 + DECOR_BONUS * g.home.length) *
    (1 + LEVEL_COIN_BONUS * (g.level - 1)) *
    (1 + FEATHER_BONUS * g.feathers) *
    (hasPower(g, "star") ? STAR_EGG_COINS : 1) *
    (g.happyT > 0 ? HAPPY_COINS : 1) *
    (g.frenzy > 0 ? 2 : 1)
  );
}

export function totalRate(g: Game): number {
  let sum = 0;
  for (const p of g.pets) {
    const def = petById(p.id);
    if (def) sum += petRate(def, p.v, p.s);
  }
  return sum * coinMult(g);
}

/** Coins per second for a saved pet list, for "while you were away" earnings. */
export function savedRate(saved: SavedGame): number {
  let sum = 0;
  for (const p of saved.pets ?? []) {
    const def = petById(p.id);
    if (def) sum += petRate(def, p.v ?? (p.shiny ? 1 : 0), p.s ?? 0);
  }
  return (
    sum *
    treatsMult(saved.up?.treats ?? 0) *
    (1 + DECOR_BONUS * (saved.home?.length ?? 0)) *
    (1 + LEVEL_COIN_BONUS * ((saved.level ?? 1) - 1)) *
    (1 + FEATHER_BONUS * (saved.feathers ?? 0)) *
    ((saved.equipped ?? []).includes("star") ? STAR_EGG_COINS : 1)
  );
}

export const bookCount = (book: Record<string, number>) =>
  PETS.reduce((n, p) => n + (book[p.id] ? 1 : 0), 0);

export const penIsFull = (g: Game) => g.pets.length >= penSize(g.up.pen);

export function countOf(g: Game, id: string): number {
  let n = 0;
  for (const p of g.pets) if (p.id === id) n++;
  return n;
}

export function canFuse(g: Game, id: string): boolean {
  const def = petById(id);
  return Boolean(def) && def!.rarity < 4 && countOf(g, id) >= FUSE_COUNT;
}

export const anyFusable = (g: Game) => PETS.some((p) => canFuse(g, p.id));

const freePads = (g: Game) => g.pads.filter((p) => !p.egg && !p.reserved).length;

export const buddyPet = (g: Game): Pet | undefined =>
  g.buddy ? g.pets.find((p) => p.uid === g.buddy) : undefined;

/** Luck for a nest right now: clover + golden nest + moonlight + a buddy at your side. */
export function luckFor(g: Game, golden: boolean, far = false): number {
  return (
    g.up.luck +
    (far ? FAR_NEST_LUCK : 0) +
    (hasPower(g, "clover") ? CLOVER_LUCK : 0) +
    (golden ? GOLDEN_NEST_LUCK : 0) +
    (g.night ? NIGHT_LUCK : 0) +
    (g.buddy ? 1 : 0)
  );
}

/** Seconds until the gift chest can be opened again (0 = ready). */
export function chestWait(g: Game, now = Date.now()): number {
  return Math.max(0, Math.ceil((g.lastChest + CHEST_MS - now) / 1000));
}

export const lockedCount = (g: Game) => ACHIEVEMENTS.length - Object.keys(g.ach).length;

/* ---------- Actions ---------- */

export function buy(g: Game, id: UpgradeId): boolean {
  const cost = upgradeCost(id, g.up[id]);
  if (cost === null || g.coins < cost) return false;
  g.coins -= cost;
  g.up[id] += 1;
  checkAchievements(g);
  return true;
}

export function buyHat(g: Game, id: HatId): boolean {
  const def = HATS.find((h) => h.id === id);
  if (!def || g.hats.includes(id) || g.stars < def.cost) return false;
  g.stars -= def.cost;
  g.hats.push(id);
  g.hat = id;
  checkAchievements(g);
  return true;
}

export function buyTrail(g: Game, id: TrailId): boolean {
  const def = TRAILS.find((t) => t.id === id);
  if (!def || g.trails.includes(id) || g.stars < def.cost) return false;
  g.stars -= def.cost;
  g.trails.push(id);
  g.trail = id;
  checkAchievements(g);
  return true;
}

export function buyDecor(g: Game, id: HomeDecorId): boolean {
  const def = HOME_DECOR.find((d) => d.id === id);
  if (!def || g.home.includes(id) || g.coins < def.cost) return false;
  g.coins -= def.cost;
  g.home.push(id);
  checkAchievements(g);
  return true;
}

export function wearHat(g: Game, id: HatId) {
  if (g.hats.includes(id)) g.hat = id;
}

export function pickTrail(g: Game, id: TrailId) {
  if (g.trails.includes(id)) g.trail = id;
}

/** Pick which kind of pet walks with you (the shiniest one of that kind), or none. */
export function setBuddy(g: Game, petId: string | null) {
  const old = buddyPet(g);
  if (old) {
    // The old buddy pops back into the pen.
    const home = penPoint();
    burst(g, old.x, old.y - 16, "#ffffff", 8, "star", 110);
    old.x = home.x;
    old.y = home.y;
    old.tx = home.x;
    old.ty = home.y;
    old.age = 0;
  }
  g.buddy = 0;
  if (!petId) return;
  const group = g.pets.filter((p) => p.id === petId).sort((a, b) => strength(b) - strength(a));
  const pet = group[0];
  if (!pet) return;
  g.buddy = pet.uid;
  pet.x = g.player.x - 30;
  pet.y = g.player.y + 10;
  pet.age = 0;
  g.flags.buddy = 1;
  burst(g, pet.x, pet.y - 16, "#fda4af", 8, "heart", 90);
  checkAchievements(g);
}

/** How good a pet's hatch rolls are, for picking the best or weakest of a kind. */
const strength = (p: Pet) => VARIANTS[p.v].mult * (1 + p.s);

function register(g: Game, def: PetDef, v: number, size: number, fused: boolean) {
  const isNew = !g.book[def.id];
  g.book[def.id] = Math.max(g.book[def.id] ?? 0, 1 + v);
  if (v >= 1 && !fused) g.stats.shinies++;
  if (v >= 2) g.flags.golden = 1;
  if (v >= 3) g.flags.rainbow = 1;
  if (size >= 2) g.flags.huge = 1;
  if (size >= 3) g.flags.titanic = 1;
  addXp(g, isNew ? 25 : 3);
  emit(g, { type: "hatch", petId: def.id, isNew, v, s: size, fused });
  if (!g.completeSent && PETS.every((p) => p.rarity === 4 || g.book[p.id])) {
    g.completeSent = true;
    emit(g, { type: "complete" });
  }
}

/** Merge three of the same pet into one of the next rarity. The best variant and size carry over. */
export function fuse(g: Game, id: string): PetDef | null {
  const def = petById(id);
  if (!def || !canFuse(g, id)) return null;
  // Use the weakest three, and keep the buddy out of it if we can.
  const group = g.pets
    .filter((p) => p.id === id)
    .sort((a, b) => Number(a.uid === g.buddy) - Number(b.uid === g.buddy) || strength(a) - strength(b));
  const used = group.slice(0, FUSE_COUNT);
  const v = Math.max(...used.map((p) => p.v));
  const size = Math.max(...used.map((p) => p.s));
  const inPen = used.filter((p) => p.uid !== g.buddy);
  const src = inPen.length ? inPen : used;
  const at = {
    x: src.reduce((sum, p) => sum + p.x, 0) / src.length,
    y: src.reduce((sum, p) => sum + p.y, 0) / src.length,
  };
  if (used.some((p) => p.uid === g.buddy)) g.buddy = 0;
  g.pets = g.pets.filter((p) => !used.includes(p));
  const next = petFor(def.biome, (def.rarity + 1) as Rarity);
  const pet = makePet(g, next.id, v, size);
  pet.x = at.x;
  pet.y = at.y;
  pet.age = 0;
  g.pets.push(pet);
  g.stats.fused++;
  burst(g, at.x, at.y - 20, RARITIES[next.rarity].color, 22, "star", 220);
  register(g, next, v, size, true);
  checkAchievements(g);
  return next;
}

/** Sell one pet of a kind: the weakest one, and never the buddy if another will do. */
export function sell(g: Game, id: string): number {
  const def = petById(id);
  if (!def) return 0;
  const group = g.pets
    .filter((p) => p.id === id)
    .sort((a, b) => Number(a.uid === g.buddy) - Number(b.uid === g.buddy) || strength(a) - strength(b));
  const pet = group[0];
  if (!pet) return 0;
  if (pet.uid === g.buddy) g.buddy = 0;
  g.pets = g.pets.filter((p) => p !== pet);
  const coins = Math.round(petRate(def, pet.v, pet.s) * coinMult(g) * SELL_SECONDS);
  earn(g, coins);
  burst(g, pet.x, pet.y - 16, "#fbbf24", 10, "dot", 120);
  return coins;
}

/** What selling one of this kind would pay right now (the weakest one goes first). */
export function sellPrice(g: Game, id: string): number {
  const def = petById(id);
  const group = g.pets
    .filter((p) => p.id === id)
    .sort((a, b) => Number(a.uid === g.buddy) - Number(b.uid === g.buddy) || strength(a) - strength(b));
  return def && group[0] ? Math.round(petRate(def, group[0].v, group[0].s) * coinMult(g) * SELL_SECONDS) : 0;
}

/** A finger landing on the play field. Returns true when it hit a hatching egg. */
export function tapAt(g: Game, x: number, y: number): boolean {
  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i];
    if (!pad.egg) continue;
    if (Math.hypot(padX(i) - x, PAD_Y - 14 - y) > 50) continue;
    if (pad.blocked) {
      hint(g, "pen");
    } else {
      pad.left -= TAP_BOOST;
      g.stats.taps++;
      emit(g, { type: "tap" });
    }
    pad.wobble = 1;
    burst(g, padX(i), PAD_Y - 22, "#ffffff", 4, "dot", 90);
    return true;
  }
  return false;
}

/** A quick tap (not a drag) on the world: pat a pet or a snoozing Grumble. */
export function tapWorld(g: Game, x: number, y: number): boolean {
  let best: Pet | null = null;
  let bestD = 38;
  for (const pet of g.pets) {
    const d = Math.hypot(pet.x - x, pet.y - 18 - y);
    if (d < bestD) {
      bestD = d;
      best = pet;
    }
  }
  if (best) {
    const def = petById(best.id);
    let coins = 0;
    if (best.patCd <= 0 && def) {
      best.patCd = PAT_COOLDOWN;
      coins = Math.max(1, Math.round(petRate(def, best.v, best.s) * coinMult(g) * 2));
      earn(g, coins);
      g.stats.pats++;
      popup(g, best.x, best.y - 56, `+${fmtCoins(coins)}`, "#f59e0b", true);
      puff(g, best.x, best.y - 30, "#fb7185", 5, "heart");
    } else {
      puff(g, best.x, best.y - 30, "#fda4af", 2, "heart");
    }
    best.joy = 1.3;
    best.wait = Math.max(best.wait, 1);
    emit(g, { type: "pat", coins });
    return true;
  }

  for (const gd of g.guards) {
    if (gd.state !== "sleep") continue;
    if (Math.hypot(gd.x - x, gd.y - 40 - y) > 56) continue;
    gd.pat = 1.4;
    g.stats.grumblePats++;
    puff(g, gd.x, gd.y - 80, "#fb7185", 4, "heart");
    emit(g, { type: "grumblePat" });
    return true;
  }
  return false;
}

/** A burst of speed, once Zoom Dash is bought. */
export function dash(g: Game): boolean {
  const p = g.player;
  if (g.up.dash < 1 || p.dashCd > 0 || p.stun > 0) return false;
  p.dashT = DASH_TIME;
  p.dashCd = dashCooldown(g.up.dash);
  p.asleep = false;
  p.idleT = 0;
  g.stats.dashes++;
  emit(g, { type: "dash" });
  return true;
}

/** Hop to a land's gate (or home) with the map. Not while carrying eggs. */
export function travel(g: Game, biome: number): boolean {
  const p = g.player;
  if (biome >= 0 && g.up.speed < BIOMES[biome].speedReq) return false;
  if (p.carry.length) {
    hint(g, "travel");
    return false;
  }
  burst(g, p.x, p.y - 20, "#ffffff", 14, "star", 160);
  const to = travelPoint(biome);
  p.x = to.x;
  p.y = to.y;
  p.kx = 0;
  p.ky = 0;
  p.stun = 0;
  burst(g, p.x, p.y - 20, "#fde68a", 14, "star", 160);
  const pal = buddyPet(g);
  if (pal) {
    pal.x = p.x - 30;
    pal.y = p.y + 12;
  }
  g.stats.travels++;
  g.biome = biomeAt(p.y);
  emit(g, { type: "travel", biome });
  emit(g, { type: "biome", biome: g.biome });
  return true;
}

/** Tap a shooting star: a handful of coins now, and double coins for a while. */
export function wish(g: Game): boolean {
  if (!g.shoot || g.shoot.caught) return false;
  g.shoot.caught = true;
  const coins = Math.max(25, Math.round(totalRate(g) * 20));
  earn(g, coins);
  g.stats.wishes++;
  g.frenzy = FRENZY_TIME;
  const p = g.player;
  popup(g, p.x, p.y - 80, "Double coins!", "#a855f7", true);
  puff(g, p.x, p.y - 40, "#fde047", 8, "star");
  emit(g, { type: "wish", coins });
  emit(g, { type: "frenzy" });
  return true;
}

/** Remember a one-off secret that lives outside the engine (title screen, HUD). */
export function setFlag(g: Game, key: string) {
  if (g.flags[key]) return;
  g.flags[key] = 1;
  checkAchievements(g);
}

export function checkAchievements(g: Game) {
  for (const a of ACHIEVEMENTS) {
    if (g.ach[a.id] || a.progress(g) < a.target) continue;
    g.ach[a.id] = 1;
    g.stars += a.stars;
    addXp(g, 10 * a.stars);
    emit(g, { type: "achievement", id: a.id });
  }
}

/* ---------- Step ---------- */

export function pushOut(p: Point, cx: number, cy: number, r: number): boolean {
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 0.001) {
    p.y = cy + r;
    return true;
  }
  p.x = cx + (dx / d) * r;
  p.y = cy + (dy / d) * r;
  return true;
}

/** The player walked into a piece of scenery. Some of it reacts. */
function bump(g: Game, idx: number) {
  const s = g.solids[idx];
  const p = g.player;
  if (g.wob[idx] > 0.2) return; // still wobbling from the last bump
  g.wob[idx] = 1;
  const land = biomeAt(s.y);
  const mult = (land < 0 ? 1 : BIOMES[land].mult) * coinMult(g);

  if (s.seed === -1) {
    // The hut: knock knock.
    g.stats.knocks++;
    let coins = 0;
    if (g.stats.knocks % 5 === 0) {
      coins = Math.max(10, Math.round(totalRate(g) * 8));
      earn(g, coins);
      popup(g, s.x, s.y - 110, `+${fmtCoins(coins)}`, "#f59e0b", true);
    }
    puff(g, s.x + 26, s.y - 100, "#fb7185", 3, "heart");
    emit(g, { type: "knock", coins });
    return;
  }
  if (s.seed === -2) {
    const wait = chestWait(g);
    if (wait > 0) {
      hint(g, "chest", -1, wait);
      return;
    }
    const coins = Math.max(40, Math.round(totalRate(g) * 120));
    earn(g, coins);
    g.stars += 1;
    g.stats.chests++;
    g.lastChest = Date.now();
    g.chestAnim = 2.2;
    popup(g, s.x, s.y - 86, `+${fmtCoins(coins)}`, "#f59e0b", true);
    burst(g, s.x, s.y - 30, "#fbbf24", 26, "dot", 240);
    burst(g, s.x, s.y - 30, "#fde047", 12, "star", 200);
    emit(g, { type: "chest", coins });
    return;
  }

  switch (s.kind) {
    case "lollipop":
      if (g.cool[idx] <= 0) {
        g.cool[idx] = 12;
        p.rushT = SUGAR_RUSH_TIME;
        g.stats.sugar++;
        popup(g, p.x, p.y - 74, "Sugar rush!", "#ec4899", true);
        burst(g, s.x, s.y - s.r * 2.4, "#f9a8d4", 10, "star", 150);
        emit(g, { type: "sugar" });
      }
      break;
    case "palm":
      if (g.cool[idx] <= 0) {
        g.cool[idx] = 18;
        const coins = Math.round(rand(8, 14) * mult);
        earn(g, coins);
        g.stats.coconuts++;
        popup(g, s.x, s.y - 70, `+${fmtCoins(coins)}`, "#f59e0b", true);
        burst(g, s.x + 6, s.y - s.r * 2, "#6b4423", 3, "dot", 80);
        emit(g, { type: "coconut", coins });
      } else {
        emit(g, { type: "rustle" });
      }
      break;
    case "tree":
    case "bush":
      burst(g, s.x, s.y - s.r * 1.4, "#4ade80", 6, "dot", 90);
      emit(g, { type: "rustle" });
      break;
    case "pine":
      burst(g, s.x, s.y - s.r * 1.6, "#ffffff", 8, "dot", 90);
      emit(g, { type: "snow" });
      break;
    case "snowpile":
      g.stats.snowmen++;
      burst(g, s.x, s.y - s.r, "#ffffff", 6, "dot", 80);
      emit(g, { type: "snow" });
      break;
    case "gumdrop": {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      p.kx = (dx / d) * 300;
      p.ky = (dy / d) * 300;
      emit(g, { type: "boing" });
      break;
    }
    case "crystal": {
      g.stats.chimes++;
      burst(g, s.x, s.y - s.r * 1.4, "#e0f2fe", 5, "star", 90);
      emit(g, { type: "chime", note: idx % 6 });
      g.rung = g.rung.filter((r) => g.time - r.at < 6 && r.idx !== idx);
      g.rung.push({ idx, at: g.time });
      if (g.rung.length >= 3 && !g.flags.song) {
        g.flags.song = 1;
        puff(g, p.x, p.y - 40, "#a5b4fc", 8, "star");
      }
      break;
    }
    default:
      break;
  }
}

function movePlayer(g: Game, dt: number, input: Input) {
  const p = g.player;
  p.stun = Math.max(0, p.stun - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.rushT = Math.max(0, p.rushT - dt);

  let mx = input.x;
  let my = input.y;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  let sp = playerSpeed(g.up.speed) * (1 - carryWeight(g));
  if (p.dashT > 0) sp *= DASH_BOOST;
  if (p.rushT > 0) sp *= SUGAR_RUSH_BOOST;
  if (g.zoomT > 0) sp *= ZOOMIES_BOOST;
  let vx = 0;
  let vy = 0;
  const steering = p.stun <= 0 && mag > 0.08;
  if (steering) {
    vx = mx * sp;
    vy = my * sp;
    p.dirX = mx / Math.max(mag, 0.001);
    p.dirY = my / Math.max(mag, 0.001);
  } else if (p.dashT > 0 && p.stun <= 0) {
    // Dashing with no finger down: keep going the way you were facing.
    vx = p.dirX * sp;
    vy = p.dirY * sp;
  }
  p.moving = vx !== 0 || vy !== 0;
  if (p.moving) {
    if (Math.abs(vx) > sp * 0.15) p.flip = vx < 0;
    p.walkT += dt * (sp / 190) * (steering ? Math.min(1, mag) : 1);
    p.idleT = 0;
    p.asleep = false;
  } else if (p.stun <= 0) {
    p.idleT += dt;
    if (!p.asleep && p.idleT > IDLE_SLEEP_AFTER) {
      p.asleep = true;
      if (!g.flags.sleepy) {
        g.flags.sleepy = 1;
        emit(g, { type: "sleepy" });
      }
    }
  }
  vx += p.kx;
  vy += p.ky;
  const decay = Math.exp(-5.5 * dt);
  p.kx *= decay;
  p.ky *= decay;

  const prevX = p.x;
  const prevY = p.y;
  const next: Point = {
    x: clamp(p.x + vx * dt, PLAYER_R + 16, WORLD_W - PLAYER_R - 16),
    y: clamp(p.y + vy * dt, PLAYER_R + 20, WORLD_H - PLAYER_R - 16),
  };

  for (let i = 0; i < g.solids.length; i++) {
    const s = g.solids[i];
    if (Math.abs(s.y - next.y) > 110) continue;
    if (pushOut(next, s.x, s.y, s.r + PLAYER_R) && p.moving) bump(g, i);
  }
  for (const gd of g.guards) {
    if (gd.state === "sleep") pushOut(next, gd.x, gd.y, GUARD_R + PLAYER_R);
  }
  for (const d of MINIS) {
    if (Math.abs(d.y - next.y) > 110) continue;
    if (pushOut(next, d.x, d.y, MINI_DOOR_R + PLAYER_R) && p.moving) knock(g, d.id);
  }

  // Fences between areas, each with one gate in the middle.
  const half = GATE_W / 2 - PLAYER_R;
  for (let i = 0; i < BIOME_COUNT; i++) {
    const line = biomeBottom(i);
    const open = g.up.speed >= BIOMES[i].speedReq;
    if (open && Math.abs(prevY - line) < PLAYER_R && Math.abs(prevX - CENTER_X) <= half + 0.01) {
      // Standing in the gateway: the posts keep you between them.
      next.x = clamp(next.x, CENTER_X - half, CENTER_X + half);
      continue;
    }
    const touches = (prevY - line) * (next.y - line) <= 0 || Math.abs(next.y - line) < PLAYER_R;
    if (!touches) continue;
    const inGap = Math.abs(next.x - CENTER_X) < half;
    if (inGap && open) continue;
    next.y = prevY >= line ? Math.max(next.y, line + PLAYER_R) : Math.min(next.y, line - PLAYER_R);
    if (inGap && !open && vy < 0) hint(g, "gate", i);
  }

  p.x = next.x;
  p.y = next.y;

  // Trails and dash streaks.
  if (p.moving) {
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = p.dashT > 0 ? 0.025 : 0.07;
      const trail = TRAILS.find((t) => t.id === g.trail);
      if (g.zoomT > 0 && p.dashT <= 0) {
        g.particles.push({
          x: p.x + rand(-8, 8), y: p.y - rand(4, 24), vx: -vx * 0.08, vy: -vy * 0.08,
          life: 0.3, max: 0.3, color: "#99f6e4", size: rand(2.5, 5), kind: "dot", grav: 0,
        });
      }
      if (p.dashT > 0 || p.rushT > 0) {
        g.particles.push({
          x: p.x + rand(-8, 8), y: p.y - rand(6, 30), vx: -vx * 0.1, vy: -vy * 0.1,
          life: 0.35, max: 0.35, color: p.rushT > 0 && p.dashT <= 0 ? "#f9a8d4" : "#ffffff",
          size: rand(3, 6), kind: "dot", grav: 0,
        });
      }
      if (trail && trail.colors.length) {
        const max = rand(0.5, 0.9);
        g.particles.push({
          x: p.x + rand(-9, 9), y: p.y - rand(2, 14), vx: rand(-14, 14), vy: rand(-26, -8),
          life: max, max, color: pick(trail.colors),
          size: trail.shape === "dot" ? rand(3.5, 6.5) : rand(5, 8.5),
          kind: trail.shape, grav: trail.id === "leaf" || trail.id === "snow" ? 30 : -8,
        });
      }
    }
  }

  const here = biomeAt(p.y);
  if (here !== g.biome) {
    g.biome = here;
    emit(g, { type: "biome", biome: here });
  }
}

function wakeGuard(g: Game, biome: number, quiet = false) {
  const gd = g.guards[biome];
  if (gd.state === "chase" || gd.state === "waking" || gd.state === "alert") return;
  const wake = BIOMES[biome].wake + sockBonus(g.up.socks) + (g.night ? NIGHT_WAKE_BONUS : 0);
  gd.t = gd.state === "sleep" ? wake : wake * 0.5;
  gd.state = "waking";
  if (!quiet) emit(g, { type: "wake", biome });
}

/** Taking an egg wakes this land's Grumble, and (outside Cozy) every other one too. */
function alarm(g: Game, biome: number) {
  wakeGuard(g, biome);
  if (g.cozy) return;
  let woke = false;
  for (let b = 0; b < BIOME_COUNT; b++) {
    if (b === biome || g.guards[b].state !== "sleep") continue;
    wakeGuard(g, b, true);
    woke = true;
  }
  if (woke) emit(g, { type: "alarm" });
}

export const hasPower = (g: Game, id: PowerEggId) => g.equipped.includes(id);

function ancientTime(g: { up: Upgrades }, biome: number): number {
  return (ANCIENT_TIME[biome] ?? 300) * ripenScale(g.up.ripen);
}

/** How fast a Grumble chases right now. */
function guardPace(g: Game, biome: number): number {
  let sp = guardSpeed(biome);
  // A Grumble from an easier land still has to be worth dodging on the run home.
  if (!g.cozy) sp = Math.max(sp, ALARM_SPEED * playerSpeed(g.up.speed));
  if (hasPower(g, "snail")) sp *= SNAIL_SLOW;
  return sp;
}

/** Where a confused Grumble thinks it's going. */
function wanderTarget(seed: number, x: number, y: number, t: number): Point {
  const a = t * 2.3 + seed * 1.7;
  return { x: x + Math.cos(a) * 120, y: y + Math.sin(a * 1.3) * 120 };
}

function canCarryMore(g: Game): boolean {
  const p = g.player;
  if (p.carry.length >= basketSize(g.up.basket)) {
    hint(g, "hands");
    return false;
  }
  if (freePads(g) <= p.carry.length) {
    hint(g, "pads");
    return false;
  }
  return true;
}

/** Share of speed lost to the eggs being carried right now. */
export function carryWeight(g: Game): number {
  if (g.cozy) return 0;
  let w = 0;
  for (const egg of g.player.carry) w += egg.power ? ANCIENT_WEIGHT : (EGG_WEIGHT[egg.rarity] ?? 0);
  return Math.min(MAX_WEIGHT, w) * armsScale(g.up.arms);
}

/**
 * Seconds it takes to lift an egg of this rarity out of its nest. It's measured
 * against how fast that land's Grumble wakes, so the squeeze feels the same in
 * every land even though the later Grumbles are much quicker.
 */
export function grabTime(g: Game, rarity: Rarity, biome: number, units?: number): number {
  if (g.cozy) return 0;
  return (units ?? GRAB_TIME[rarity] ?? 0) * BIOMES[biome].wake * handsScale(g.up.hands);
}

function ripenTime(g: Game, rarity: Rarity): number {
  return g.cozy ? 0 : (RIPEN_TIME[rarity] ?? 0) * ripenScale(g.up.ripen);
}

/**
 * Lifting an egg takes time for the valuable ones. Returns true once it's out.
 * The Grumble starts waking the moment the lifting begins.
 */
function lift(
  g: Game,
  spot: { grab: number },
  biome: number,
  rarity: Rarity,
  dt: number,
  units?: number,
): boolean {
  const need = grabTime(g, rarity, biome, units);
  if (need <= 0) return true;
  if (spot.grab <= 0) {
    wakeGuard(g, biome);
    emit(g, { type: "grab", rarity });
  }
  g.player.grabbing = true;
  spot.grab += dt / need;
  return spot.grab >= 1;
}

function tryPickup(g: Game, dt: number) {
  const p = g.player;
  p.grabbing = false;
  const busy = p.stun > 0 || g.biome < 0;
  for (const n of g.nests) {
    const here =
      !busy && n.egg !== null && n.biome === g.biome && n.age >= 0.25 && dist(p, n) <= PICKUP_DIST;
    if (!here || n.egg === null) {
      // Step away and the egg settles back into the nest.
      if (n.grab > 0) n.grab = Math.max(0, n.grab - dt * 2);
      continue;
    }
    if (n.ripen > 0) {
      hint(g, "ripening", n.biome, Math.ceil(n.ripen));
      continue;
    }
    if (!canCarryMore(g)) continue;
    if (!lift(g, n, n.biome, n.egg, dt)) continue;
    p.carry.push({ biome: n.biome, rarity: n.egg, ...(n.far ? { far: true } : {}) });
    if (n.golden) g.stats.golden++;
    emit(g, { type: "pickup", rarity: n.egg, mystery: false });
    burst(g, n.x, n.y - 14, RARITIES[n.egg].color, 8, "star", 130);
    n.egg = null;
    n.grab = 0;
    n.respawn = EGG_RESPAWN;
    alarm(g, n.biome);
  }

  for (const a of g.ancients) {
    const here = !busy && a.biome === g.biome && dist(p, a) <= PICKUP_DIST + 4;
    if (!here) {
      if (a.grab > 0) a.grab = Math.max(0, a.grab - dt * 2);
      continue;
    }
    if (a.left > 0) {
      hint(g, "ancient", a.biome, Math.ceil(a.left));
      continue;
    }
    if (!canCarryMore(g) || !lift(g, a, a.biome, 3, dt, ANCIENT_GRAB)) continue;
    p.carry.push({ biome: a.biome, rarity: 3, power: a.power });
    emit(g, { type: "pickup", rarity: 3, mystery: true });
    burst(g, a.x, a.y - 14, "#ffffff", 22, "star", 210);
    a.grab = 0;
    a.total = ancientTime(g, a.biome);
    a.left = a.total;
    alarm(g, a.biome);
  }

  const m = g.mystery;
  if (!m) return;
  const here = !busy && m.biome === g.biome && m.age > 0.4 && dist(p, m) < PICKUP_DIST + 4;
  if (!here) {
    if (m.grab > 0) m.grab = Math.max(0, m.grab - dt * 2);
    return;
  }
  if (!canCarryMore(g) || !lift(g, m, m.biome, m.rarity, dt)) return;
  p.carry.push({ biome: m.biome, rarity: m.rarity });
  g.stats.mystery++;
  emit(g, { type: "pickup", rarity: m.rarity, mystery: true });
  burst(g, m.x, m.y - 14, RARITIES[m.rarity].color, 18, "star", 190);
  g.mystery = null;
  g.mysteryIn = rand(MYSTERY_EVERY[0], MYSTERY_EVERY[1]);
  alarm(g, m.biome);
}

function walkToward(
  gd: { x: number; y: number; flip: boolean; walkT: number },
  x: number,
  y: number,
  speed: number,
  dt: number,
): number {
  const dx = x - gd.x;
  const dy = y - gd.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return 0;
  const stepLen = Math.min(d, speed * dt);
  gd.x += (dx / d) * stepLen;
  gd.y += (dy / d) * stepLen;
  if (Math.abs(dx) > 4) gd.flip = dx < 0;
  gd.walkT += dt * (speed / 150);
  return d - stepLen;
}

function updateGuard(g: Game, gd: Guard, dt: number) {
  const p = g.player;
  const here = g.biome === gd.biome;
  const hasEgg = p.carry.length > 0;
  const hot = here && (hasEgg || p.grabbing);
  gd.pat = Math.max(0, gd.pat - dt);
  // Frozen solid: nothing happens until it thaws.
  if (g.freezeT > 0 && gd.state !== "sleep") return;

  switch (gd.state) {
    case "sleep":
      return;
    case "waking":
      gd.t -= dt;
      if (gd.t <= 0) {
        if (hot) {
          gd.state = "chase";
          gd.minGap = Infinity;
        } else if (!g.cozy && hasEgg) {
          // Awake and watching its land for whoever has the egg.
          gd.state = "alert";
          gd.t = ALERT_TIME;
        } else {
          gd.state = "return";
        }
      }
      return;
    case "alert":
      gd.t -= dt;
      if (hot) {
        // Spotted! A short beat, then it comes.
        gd.state = "waking";
        gd.t = 0.35;
      } else if (gd.t <= 0 || !hasEgg) {
        gd.state = "return";
      }
      return;
    case "chase": {
      if (!hot) {
        if (hasEgg) {
          // Got away with the egg.
          const close = gd.minGap < 34;
          g.stats.escapes++;
          if (close) g.stats.close++;
          emit(g, { type: "escape", close });
        }
        gd.state = "huff";
        gd.t = 0.6;
        return;
      }
      const sp = guardPace(g, gd.biome);
      if (g.confuseT > 0) {
        const w = wanderTarget(gd.biome, gd.x, gd.y, g.time);
        walkToward(gd, w.x, w.y, sp * 0.6, dt);
      } else {
        walkToward(gd, p.x, p.y, sp, dt);
      }
      const top = biomeTop(gd.biome);
      gd.x = clamp(gd.x, GUARD_R + 10, WORLD_W - GUARD_R - 10);
      gd.y = clamp(gd.y, top + GUARD_R + 10, top + BIOME_H - GUARD_R - 14);
      const gap = dist(gd, p) - GUARD_R - PLAYER_R;
      gd.minGap = Math.min(gd.minGap, gap);
      if (p.stun <= 0 && gap < -4 && g.confuseT <= 0) caught(g, gd, gd.biome);
      return;
    }
    case "huff":
      gd.t -= dt;
      if (gd.t <= 0) gd.state = "return";
      return;
    case "return":
      if (walkToward(gd, gd.homeX, gd.homeY, guardSpeed(gd.biome) * 0.8, dt) < 1) {
        gd.x = gd.homeX;
        gd.y = gd.homeY;
        gd.state = "sleep";
        // If the player is standing on the bed, nudge them off it.
        pushOut(p, gd.x, gd.y, GUARD_R + PLAYER_R);
      }
      return;
  }
}

function updateMini(g: Game, m: Mini, dt: number) {
  if (g.freezeT > 0) return;
  const p = g.player;
  const top = biomeTop(m.biome);
  const laneX = CENTER_X + m.side * MINI_LANE;
  const y0 = top + 110;
  const y1 = top + BIOME_H - 110;
  const pace = guardPace(g, m.biome);
  const hot = !g.cozy && g.biome === m.biome && p.stun <= 0 && (p.carry.length > 0 || p.grabbing);
  const d = dist(m, p);

  if (m.state === "chase") {
    if (!hot || d > MINI_LEASH) {
      m.state = "return";
    } else if (g.confuseT > 0) {
      const w = wanderTarget(m.biome * 3 + m.side, m.x, m.y, g.time);
      walkToward(m, w.x, w.y, pace * MINI_CHASE * 0.6, dt);
    } else {
      walkToward(m, p.x, p.y, pace * MINI_CHASE, dt);
      if (d - MINI_R - PLAYER_R < -3) caught(g, m, m.biome);
    }
    m.x = clamp(m.x, MINI_R + 8, WORLD_W - MINI_R - 8);
    m.y = clamp(m.y, top + MINI_R + 8, top + BIOME_H - MINI_R - 12);
    return;
  }
  if (hot && d < MINI_SEE && g.confuseT <= 0) {
    m.state = "chase";
    emit(g, { type: "mini" });
    return;
  }
  if (m.state === "return") {
    if (walkToward(m, laneX, clamp(m.y, y0, y1), pace * MINI_PATROL * 1.5, dt) < 2) m.state = "patrol";
    return;
  }
  m.y += m.dir * pace * MINI_PATROL * dt;
  m.walkT += dt * 0.9;
  m.flip = m.side > 0;
  if (m.y >= y1) {
    m.y = y1;
    m.dir = -1;
  } else if (m.y <= y0) {
    m.y = y0;
    m.dir = 1;
  }
}

/** Every Grumble in a land gives up the chase for a moment. */
function calmLand(g: Game, biome: number, huff: number) {
  const gd = g.guards[biome];
  if (gd && gd.state !== "sleep" && gd.state !== "return") {
    gd.state = "huff";
    gd.t = huff;
  }
  for (const m of g.minis) if (m.biome === biome && m.state === "chase") m.state = "return";
}

function caught(g: Game, from: Point, biome: number) {
  const p = g.player;
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  p.dashT = 0;

  // A Bubble Shield pops instead, and you keep everything.
  if (g.held === "bubble") {
    g.held = null;
    g.stats.powerups++;
    p.kx = (dx / d) * 520;
    p.ky = (dy / d) * 520;
    p.stun = 0.3;
    burst(g, p.x, p.y - 30, "#7dd3fc", 22, "dot", 240);
    popup(g, p.x, p.y - 70, "Pop!", "#0ea5e9", true);
    calmLand(g, biome, 1.8);
    emit(g, { type: "shield" });
    return;
  }

  const eggs = p.carry.length;
  for (const egg of p.carry) {
    burst(g, p.x, p.y - 40, RARITIES[egg.rarity].color, 8, "dot", 160);
    // A Power Egg rolls back to its ancient nest and is ready again in a moment.
    if (egg.power) {
      const a = g.ancients[egg.biome];
      if (a) a.left = Math.min(a.left, 5);
    }
  }
  p.carry = [];
  burst(g, p.x, p.y - 30, "#fde047", 10, "star", 170);
  // The eggs roll back to their nests.
  for (const n of g.nests) {
    if (n.biome === biome && n.egg === null) n.respawn = Math.min(n.respawn, 0.9);
  }
  g.stats.caught++;

  const feather = hasPower(g, "feather") && g.featherCd <= 0;
  if (g.cozy || feather) {
    // The gentle version: a bump and a dizzy second, right where you stand.
    p.kx = (dx / d) * 430;
    p.ky = (dy / d) * 430;
    p.stun = 0.9;
    popup(g, p.x, p.y - 70, "Oops!", "#ef4444", true);
    calmLand(g, biome, 0.8);
    if (feather && !g.cozy) {
      g.featherCd = FEATHER_CD;
      emit(g, { type: "feather" });
    }
    emit(g, { type: "caught", eggs, home: false });
    return;
  }

  // Sent all the way back to the start.
  burst(g, p.x, p.y - 30, "#ffffff", 16, "dot", 200);
  p.x = PLAYER_START.x;
  p.y = PLAYER_START.y;
  p.kx = 0;
  p.ky = 0;
  p.stun = 0.8;
  g.biome = -1;
  g.stats.sentHome++;
  for (let b = 0; b < BIOME_COUNT; b++) calmLand(g, b, 0.5);
  burst(g, p.x, p.y - 30, "#fde047", 18, "star", 200);
  popup(g, p.x, p.y - 70, "Back to the start!", "#ef4444", true);
  emit(g, { type: "biome", biome: -1 });
  emit(g, { type: "caught", eggs, home: true });
}

function deliver(g: Game) {
  const p = g.player;
  if (!p.carry.length || p.y < DELIVER_Y) return;
  const left: EggInfo[] = [];
  let sent = 0;
  p.carry.forEach((egg, k) => {
    if (egg.power) {
      grantPowerEgg(g, egg.power);
      return;
    }
    const idx = g.pads.findIndex((pad) => !pad.egg && !pad.reserved);
    if (idx < 0) {
      left.push(egg);
      return;
    }
    g.pads[idx].reserved = true;
    sent++;
    g.flights.push({
      egg,
      x0: p.x, y0: p.y - 52 - k * 20,
      x1: padX(idx), y1: PAD_Y - 14,
      t: -k * 0.12,
      dur: 0.5,
      pad: idx,
    });
  });
  g.stats.maxCarry = Math.max(g.stats.maxCarry, sent);
  p.carry = left;
}

function updateFlights(g: Game, dt: number) {
  for (let i = g.flights.length - 1; i >= 0; i--) {
    const f = g.flights[i];
    f.t += dt;
    if (f.t < f.dur) continue;
    g.flights.splice(i, 1);
    const pad = g.pads[f.pad];
    const total = RARITIES[f.egg.rarity].hatch * hatchScale(g.up.warm);
    pad.egg = f.egg;
    pad.total = total;
    pad.left = total;
    pad.reserved = false;
    pad.blocked = false;
    pad.wobble = 1;
    const def = petFor(f.egg.biome, f.egg.rarity);
    const coins = Math.round(petRate(def) * coinMult(g) * DELIVERY_SECONDS);
    earn(g, coins);
    g.stats.eggs++;
    addXp(g, 5 * (f.egg.rarity + 1) * (f.egg.biome + 1));
    if (f.egg.rarity >= 3) g.stats.legendEggs++;
    if (f.egg.far) g.stats.farEggs++;
    if (g.night) g.stats.night++;
    popup(g, f.x1, f.y1 - 44, `+${fmtCoins(coins)}`, "#f59e0b", true);
    burst(g, f.x1, f.y1, "#fde68a", 8, "dot", 110);
    emit(g, { type: "deliver", coins });
  }
}

function hatch(g: Game, i: number) {
  const pad = g.pads[i];
  if (!pad.egg) return;
  const def = petFor(pad.egg.biome, pad.egg.rarity);
  const v = rollVariant(g.up.sparkle);
  const size = rollSize();
  const at = { x: padX(i), y: PAD_Y };
  g.pets.push(makePet(g, def.id, v, size, at));
  const info = RARITIES[def.rarity];
  burst(g, at.x, at.y - 24, BIOMES[def.biome].egg.base, 10, "dot", 190);
  burst(g, at.x, at.y - 24, info.color, 8 + def.rarity * 6, "star", 200 + def.rarity * 30);
  pad.egg = null;
  pad.blocked = false;
  if (v >= 2 || size >= 2) burst(g, at.x, at.y - 30, VARIANTS[Math.max(1, v)].color, 26, "star", 260);
  register(g, def, v, size, false);
}

function updatePads(g: Game, dt: number) {
  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i];
    pad.wobble = Math.max(0, pad.wobble - dt * 3);
    if (!pad.egg) continue;
    if (pad.left > 0) pad.left -= dt;
    if (pad.left > 0) continue;
    if (penIsFull(g)) {
      if (!pad.blocked) {
        pad.blocked = true;
        hint(g, "pen");
      }
      continue;
    }
    hatch(g, i);
  }
}

function updatePets(g: Game, dt: number) {
  const p = g.player;
  const nearHome = p.y > HOME_TOP - 420;
  const treats = coinMult(g);
  let rate = 0;
  for (const pet of g.pets) {
    const def = petById(pet.id);
    if (!def) continue;
    const r = petRate(def, pet.v, pet.s) * treats;
    rate += r;
    pet.age += dt;
    pet.patCd = Math.max(0, pet.patCd - dt);
    pet.joy = Math.max(0, pet.joy - dt);

    if (pet.uid === g.buddy) {
      // Trot along a little behind the player.
      const tx = p.x - p.dirX * 46;
      const ty = p.y - p.dirY * 46 + 6;
      const dx = tx - pet.x;
      const dy = ty - pet.y;
      const d = Math.hypot(dx, dy);
      if (d > 520) {
        pet.x = tx;
        pet.y = ty;
      } else if (d > 6) {
        const stepLen = Math.min(d, Math.max(60, d * 5) * dt);
        pet.x += (dx / d) * stepLen;
        pet.y += (dy / d) * stepLen;
        if (Math.abs(dx) > 3) pet.flip = dx < 0;
        pet.hop += dt * 12;
        pet.wait = 0;
      } else {
        pet.wait = 1;
      }
    } else if (pet.wait > 0) {
      pet.wait -= dt;
      if (pet.wait <= 0) {
        const t = penPoint();
        pet.tx = t.x;
        pet.ty = t.y;
      }
    } else {
      const dx = pet.tx - pet.x;
      const dy = pet.ty - pet.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        pet.wait = rand(0.8, 3.4);
      } else {
        const stepLen = Math.min(d, 52 * dt);
        pet.x += (dx / d) * stepLen;
        pet.y += (dy / d) * stepLen;
        if (Math.abs(dx) > 2) pet.flip = dx < 0;
        pet.hop += dt * 10;
      }
    }
    if (pet.joy > 0) pet.hop += dt * 14;
    else if (g.happyT > 0 && nearHome && Math.random() < dt * 0.25) {
      // Happy pets (from Hide and Seek) can't keep still.
      pet.joy = 0.8;
      puff(g, pet.x, pet.y - 30, "#fb7185", 1, "heart");
    }

    pet.payT -= dt;
    if (pet.payT <= 0) {
      pet.payT += 3;
      if (nearHome || pet.uid === g.buddy) popup(g, pet.x, pet.y - 46, `+${fmtCoins(r * 3)}`, "#d97706");
    }
  }
  earn(g, rate * dt);
}

function updateNests(g: Game, dt: number) {
  for (const n of g.nests) {
    n.age += dt;
    if (n.egg !== null) {
      if (n.ripen > 0) {
        n.ripen -= dt;
        if (n.ripen <= 0) {
          n.ripen = 0;
          burst(g, n.x, n.y - 16, RARITIES[n.egg].color, 10, "star", 120);
          emit(g, { type: "ripe", biome: n.biome, rarity: n.egg });
        }
      }
      continue;
    }
    n.respawn -= dt;
    if (n.respawn <= 0) {
      n.egg = rollRarity(luckFor(g, n.golden, n.far));
      n.age = 0;
      n.grab = 0;
      n.ripenTotal = ripenTime(g, n.egg);
      n.ripen = n.ripenTotal;
    }
  }
}

function landOpen(g: Game, biome: number) {
  return g.up.speed >= BIOMES[biome].speedReq;
}

function updateBugs(g: Game, dt: number) {
  const p = g.player;
  const sp = playerSpeed(g.up.speed);
  for (const b of g.bugs) {
    if (!landOpen(g, b.biome)) continue;
    if (!b.alive) {
      b.respawn -= dt;
      if (b.respawn <= 0) {
        const at = openSpot(g, b.biome, false);
        b.x = at.x;
        b.y = at.y;
        b.tx = at.x;
        b.ty = at.y;
        b.alive = true;
        b.golden = Math.random() < GOLDEN_BUG_CHANCE;
      }
      continue;
    }
    // Only bother simulating the ones near the player.
    if (Math.abs(b.y - p.y) > 900) continue;
    b.t += dt;
    const top = biomeTop(b.biome);
    const dPlayer = dist(b, p);
    if (dPlayer < 30) {
      const coins = Math.round(rand(6, 12) * BIOMES[b.biome].mult * coinMult(g) * (b.golden ? 5 : 1));
      earn(g, coins);
      g.stats.bugs++;
      if (b.golden) {
        g.stars += 1;
        g.flags.goldbug = 1;
        popup(g, b.x, b.y - 60, "+1 star", "#a855f7", true);
      }
      popup(g, b.x, b.y - 36, `+${fmtCoins(coins)}`, "#f59e0b", true);
      burst(g, b.x, b.y - 16, "#fde047", b.golden ? 24 : 12, "star", 170);
      emit(g, { type: "bug", coins, golden: b.golden });
      b.alive = false;
      b.respawn = BUG_RESPAWN;
      continue;
    }
    let speed = 58;
    if (dPlayer < 120) {
      // Flutter away, but never quite fast enough to escape.
      const dx = (b.x - p.x) / (dPlayer || 1);
      const dy = (b.y - p.y) / (dPlayer || 1);
      b.tx = b.x + dx * 140;
      b.ty = b.y + dy * 140;
      speed = sp * 0.55;
    } else if (Math.hypot(b.tx - b.x, b.ty - b.y) < 8) {
      b.tx = b.x + rand(-150, 150);
      b.ty = b.y + rand(-110, 110);
    }
    b.tx = clamp(b.tx, 50, WORLD_W - 50);
    b.ty = clamp(b.ty, top + 50, top + BIOME_H - 50);
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const stepLen = Math.min(d, speed * dt);
      b.x += (dx / d) * stepLen;
      b.y += (dy / d) * stepLen;
    }
  }
}

function updateWorldEvents(g: Game, dt: number) {
  const p = g.player;

  // Day and night.
  g.clock += dt;
  const night = nightAmount(g.clock) > 0.5;
  if (night !== g.night) {
    g.night = night;
    emit(g, { type: night ? "night" : "day" });
    g.shootIn = rand(5, 10);
  }
  if (g.shoot) {
    g.shoot.t += dt;
    if (g.shoot.t >= g.shoot.dur) g.shoot = null;
  } else if (g.night) {
    g.shootIn -= dt;
    if (g.shootIn <= 0) {
      g.shoot = { t: 0, dur: 3.2, seed: Math.random(), caught: false };
      g.shootIn = rand(14, 24);
    }
  }

  // Mystery eggs.
  if (g.mystery) {
    g.mystery.age += dt;
    g.mystery.left -= dt;
    if (g.mystery.left <= 0) {
      burst(g, g.mystery.x, g.mystery.y - 14, "#ffffff", 10, "star", 120);
      g.mystery = null;
      g.mysteryIn = rand(MYSTERY_EVERY[0], MYSTERY_EVERY[1]);
      emit(g, { type: "mysteryGone" });
    }
  } else if (g.stats.eggs >= 3) {
    g.mysteryIn -= dt;
    if (g.mysteryIn <= 0) {
      const open = BIOMES.map((_, i) => i).filter((i) => landOpen(g, i));
      const biome = pick(open);
      const at = openSpot(g, biome, true);
      g.mystery = {
        biome, x: at.x, y: at.y,
        rarity: Math.random() < 0.4 ? 3 : 2,
        left: MYSTERY_LIFETIME, age: 0, grab: 0,
      };
      emit(g, { type: "mystery", biome });
    }
  }

  // Hidden stars.
  if (g.biome >= 0 && !g.secrets.includes(g.biome)) {
    const s = g.secretSpots[g.biome];
    if (dist(p, s) < 30) {
      g.secrets.push(g.biome);
      g.stars += SECRET_STAR_REWARD;
      popup(g, s.x, s.y - 50, `+${SECRET_STAR_REWARD} stars`, "#a855f7", true);
      burst(g, s.x, s.y - 12, "#fde047", 24, "star", 220);
      emit(g, { type: "secret", count: g.secrets.length });
    }
  }

  // The flying saucer at the top of the world.
  g.ufoCd = Math.max(0, g.ufoCd - dt);
  if (g.biome === BIOME_COUNT - 1 && g.ufoCd <= 0 && dist(p, UFO) < UFO.r) {
    burst(g, p.x, p.y - 20, "#a5f3fc", 20, "star", 200);
    p.x = PLAYER_START.x;
    p.y = PLAYER_START.y - 60;
    p.kx = 0;
    p.ky = 0;
    g.ufoCd = 4;
    g.flags.taxi = 1;
    burst(g, p.x, p.y - 20, "#a5f3fc", 20, "star", 200);
    const pal = buddyPet(g);
    if (pal) {
      pal.x = p.x - 30;
      pal.y = p.y + 12;
    }
    g.biome = -1;
    emit(g, { type: "taxi" });
    emit(g, { type: "biome", biome: -1 });
  }

  g.chestAnim = Math.max(0, g.chestAnim - dt);
  g.frenzy = Math.max(0, g.frenzy - dt);
  for (let i = 0; i < g.wob.length; i++) {
    if (g.wob[i] > 0) g.wob[i] = Math.max(0, g.wob[i] - dt * 1.6);
    if (g.cool[i] > 0) g.cool[i] = Math.max(0, g.cool[i] - dt);
  }
}

export function updateFx(g: { particles: Particle[]; popups: Popup[] }, dt: number) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= 1 - 1.8 * dt;
  }
  if (g.particles.length > 400) g.particles.splice(0, g.particles.length - 400);
  for (let i = g.popups.length - 1; i >= 0; i--) {
    const p = g.popups[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.popups.splice(i, 1);
      continue;
    }
    p.y -= (p.big ? 46 : 30) * dt;
  }
  if (g.popups.length > 60) g.popups.splice(0, g.popups.length - 60);
}

/* ---------- Levels ---------- */

export function addXp(g: Game, amount: number) {
  if (g.level >= MAX_LEVEL || amount <= 0) return;
  g.xp += Math.round(amount);
  while (g.level < MAX_LEVEL && g.xp >= xpNeed(g.level)) {
    g.xp -= xpNeed(g.level);
    g.level++;
    const stars = g.level % 5 === 0 ? 5 : 1;
    g.stars += stars;
    emit(g, { type: "level", level: g.level, stars });
  }
}

/* ---------- Power Eggs ---------- */

function grantPowerEgg(g: Game, id: PowerEggId) {
  const p = g.player;
  const def = powerEggById(id);
  const isNew = !g.powerEggs.includes(id);
  if (isNew) {
    g.powerEggs.push(id);
    // Put it straight on if there's a free slot.
    if (g.equipped.length < equipSlots(g.level)) g.equipped.push(id);
    addXp(g, 100);
  } else {
    g.stars += 5;
    addXp(g, 150);
    popup(g, p.x, p.y - 80, "+5 stars", "#f59e0b", true);
  }
  burst(g, p.x, p.y - 40, def?.color ?? "#ffffff", 26, "star", 260);
  emit(g, { type: "powerEgg", id, isNew });
}

/** Put a Power Egg on, or take it off. False if there's no free slot. */
export function equip(g: Game, id: PowerEggId): boolean {
  if (!g.powerEggs.includes(id)) return false;
  if (g.equipped.includes(id)) {
    g.equipped = g.equipped.filter((e) => e !== id);
    return true;
  }
  if (g.equipped.length >= equipSlots(g.level)) return false;
  g.equipped.push(id);
  return true;
}

/** The Frost Egg's button: every Grumble stops dead for a few seconds. */
export function freeze(g: Game): boolean {
  if (!hasPower(g, "frost") || g.freezeCd > 0) return false;
  g.freezeT = FREEZE_TIME;
  g.freezeCd = FREEZE_CD;
  g.stats.freezes++;
  emit(g, { type: "freeze" });
  return true;
}

/* ---------- Power-ups ---------- */

/** Use the power-up in your pocket. */
export function usePower(g: Game): boolean {
  const kind = g.held;
  if (!kind) return false;
  if (kind === "bubble") {
    emit(g, { type: "powerHint" });
    return false;
  }
  if (kind === "dizzy") {
    g.confuseT = DIZZY_TIME;
  } else {
    for (const n of g.nests) {
      if (n.egg !== null && n.ripen > 0) n.ripen = 0.01;
    }
    for (const a of g.ancients) a.left = Math.max(0, a.left - CLOCK_ANCIENT_SKIP);
  }
  g.held = null;
  g.stats.powerups++;
  emit(g, { type: "power", kind });
  return true;
}

/** The reward for sitting through the house ad: every egg on a pad hatches now. */
export function hatchNow(g: Game): number {
  let n = 0;
  for (const pad of g.pads) {
    if (pad.egg && pad.left > 0.05) {
      pad.left = 0.05;
      n++;
    }
  }
  return n;
}

/** Eggs still hatching, and the longest wait among them. */
export function hatchWait(g: Game): number {
  let wait = 0;
  for (const pad of g.pads) if (pad.egg && !pad.blocked) wait = Math.max(wait, pad.left);
  return wait;
}

/* ---------- Mini games: tents, prizes and Lucky Dice ---------- */

/** The player walked into a tent. The route asks whether they want to play. */
function knock(g: Game, id: MiniId) {
  if (g.doorCd > 0) return;
  if (g.player.carry.length) {
    hint(g, "door");
    return;
  }
  g.doorCd = 1.5;
  g.flags.miniSeen = 1;
  emit(g, { type: "door", id });
}

/** Seconds until a tent's prize is back (0 = ready). */
export function prizeWait(g: Game, id: MiniId, now = Date.now()): number {
  const def = miniById(id);
  if (!def) return 0;
  return Math.max(0, Math.ceil((g.prizeAt[id] + def.prizeMs - now) / 1000));
}

export interface MiniReward {
  id: MiniId;
  medal: Medal;
  /** True when this beat the best medal so far. */
  newBest: boolean;
  /** True when the tent's prize was ready and has just been won. */
  prize: boolean;
  /** Seconds of Zoomies or happy pets, Lucky Dice, or tip coins handed over. */
  zoom: number;
  happy: number;
  dice: number;
  coins: number;
  /** Zip's trail, for the first gold in Tag. */
  trail: boolean;
}

/**
 * A mini game just ended with this medal. If the tent's prize was ready it is
 * handed over and the timer starts again; otherwise the player gets a small tip.
 */
export function finishMini(g: Game, id: MiniId, medal: Medal, now = Date.now()): MiniReward {
  const r: MiniReward = {
    id, medal,
    newBest: medal > g.medals[id],
    prize: false, zoom: 0, happy: 0, dice: 0, coins: 0, trail: false,
  };
  g.stats.minis++;
  if (r.newBest) g.medals[id] = medal;
  if (medal > 0 && prizeWait(g, id, now) <= 0) {
    if (id === "tag") {
      r.zoom = MINI_BUFF_TIME[medal];
      g.zoomT = Math.max(g.zoomT, r.zoom);
    } else if (id === "seek") {
      r.happy = MINI_BUFF_TIME[medal];
      g.happyT = Math.max(g.happyT, r.happy);
    } else {
      r.dice = Math.min(MINI_DICE[medal], DICE_MAX - g.dice);
      g.dice += r.dice;
    }
    // With a pocket already full of dice the prize waits for next time.
    if (r.zoom || r.happy || r.dice) {
      r.prize = true;
      g.prizeAt[id] = now;
      g.stats.prizes++;
      addXp(g, 15 * medal);
    }
  }
  if (medal > 0 && !r.prize) {
    r.coins = Math.max(5 * medal, Math.round(totalRate(g) * MINI_TIP_SECONDS * medal));
    earn(g, r.coins);
  }
  if (id === "tag" && medal >= 3 && !g.trails.includes("zip")) {
    g.trails.push("zip");
    g.trail = "zip";
    r.trail = true;
  }
  checkAchievements(g);
  return r;
}

const rollWorth = (p: Pet) => VARIANTS[p.v].mult * SIZES[p.s].mult;

/** True when there's a pet of this kind a Lucky Dice could still improve. */
export function canRoll(g: Game, petId: string): boolean {
  return g.dice > 0 && g.pets.some((p) => p.id === petId && (p.v < VARIANTS.length - 1 || p.s < SIZES.length - 1));
}

/**
 * Roll a Lucky Dice on one pet of a kind: its variant and size are each rolled
 * twice more and the pet keeps whatever is better. It never gets worse. A roll
 * that changes nothing grows a small pet one size, or pays coins. The dice goes
 * to the best pet that is still small enough to be sure of growing, and once
 * they are all Huge, to the best one left to improve.
 */
export function rollDice(g: Game, petId: string): boolean {
  const def = petById(petId);
  if (!def || !canRoll(g, petId)) return false;
  const pet = g.pets
    .filter((p) => p.id === petId && (p.v < VARIANTS.length - 1 || p.s < SIZES.length - 1))
    .sort((a, b) => Number(b.s < 2) - Number(a.s < 2) || rollWorth(b) - rollWorth(a))[0];
  g.dice--;
  g.stats.diceUsed++;
  const v = Math.max(pet.v, rollVariant(g.up.sparkle), rollVariant(g.up.sparkle));
  let size = Math.max(pet.s, rollSize(), rollSize());
  if (v === pet.v && size === pet.s && pet.s < 2) size = pet.s + 1;
  const better = v > pet.v || size > pet.s;
  let coins = 0;
  if (better) {
    if (pet.v === 0 && v >= 1) g.stats.shinies++;
    pet.v = v;
    pet.s = size;
    pet.joy = 2;
    g.book[def.id] = Math.max(g.book[def.id] ?? 0, 1 + v);
    if (v >= 2) g.flags.golden = 1;
    if (v >= 3) g.flags.rainbow = 1;
    if (size >= 2) g.flags.huge = 1;
    if (size >= 3) g.flags.titanic = 1;
    burst(g, pet.x, pet.y - 20, VARIANTS[Math.max(1, v)].color, 20, "star", 220);
  } else {
    coins = Math.max(10, Math.round(petRate(def, pet.v, pet.s) * coinMult(g) * DICE_CONSOLATION));
    earn(g, coins);
  }
  emit(g, { type: "dice", petId, v: pet.v, s: pet.s, better, coins });
  checkAchievements(g);
  return true;
}

/* ---------- Idle: the courier and rebirth ---------- */

/** The courier bird drops an egg on a spare pad every so often, no sneaking needed. */
function updateCourier(g: Game, dt: number) {
  const every = courierEvery(g.up.courier);
  if (!Number.isFinite(every)) return;
  g.courierT -= dt;
  if (g.courierT > 0) return;
  // Always leave one pad for the eggs you carry home yourself.
  if (freePads(g) < 2) {
    g.courierT = 2;
    return;
  }
  g.courierT = every;
  const idx = g.pads.findIndex((pad) => !pad.egg && !pad.reserved);
  if (idx < 0) return;
  let biome = 0;
  for (let b = 0; b < BIOME_COUNT; b++) if (landOpen(g, b)) biome = b;
  // It isn't as picky as you are: one step less lucky.
  const rarity = rollRarity(Math.max(0, g.up.luck - 1));
  g.pads[idx].reserved = true;
  g.flights.push({
    egg: { biome, rarity },
    x0: padX(idx) + (Math.random() < 0.5 ? -260 : 260), y0: HOME_TOP - 40,
    x1: padX(idx), y1: PAD_Y - 14,
    t: 0,
    dur: 1.1,
    pad: idx,
  });
  g.stats.couriered++;
  emit(g, { type: "courier", rarity });
}

export const canRebirth = (g: Game) => g.up.speed >= BIOMES[BIOME_COUNT - 1].speedReq;
export const rebirthGain = (g: Game) => feathersFor(g.runEarned);

/**
 * Start over for Golden Feathers. Coins, upgrades, pets and eggs go; the Pet
 * Book, trophies, stars, hats, trails, decorations, level and Power Eggs stay.
 */
export function rebirth(g: Game): number {
  const gain = rebirthGain(g);
  if (!canRebirth(g) || gain < 1) return 0;
  g.feathers += gain;
  g.stats.rebirths++;
  g.coins = 0;
  g.runEarned = 0;
  g.up = { ...ZERO_UPGRADES };
  g.pets = [];
  g.buddy = 0;
  g.flights = [];
  for (const pad of g.pads) {
    pad.egg = null;
    pad.left = 0;
    pad.reserved = false;
    pad.blocked = false;
  }
  const p = g.player;
  p.carry = [];
  p.x = PLAYER_START.x;
  p.y = PLAYER_START.y;
  p.dashT = 0;
  p.dashCd = 0;
  g.biome = -1;
  for (let b = 0; b < BIOME_COUNT; b++) calmLand(g, b, 0.3);
  for (const a of g.ancients) {
    a.total = ancientTime(g, a.biome);
    a.left = Math.min(a.left, a.total);
  }
  burst(g, p.x, p.y - 30, "#fbbf24", 40, "star", 320);
  emit(g, { type: "biome", biome: -1 });
  emit(g, { type: "rebirth", feathers: gain });
  checkAchievements(g);
  return gain;
}

function updatePowers(g: Game, dt: number) {
  g.doorCd = Math.max(0, g.doorCd - dt);
  if (g.zoomT > 0) {
    g.zoomT = Math.max(0, g.zoomT - dt);
    if (g.zoomT <= 0) emit(g, { type: "buffEnd", kind: "zoom" });
  }
  if (g.happyT > 0) {
    g.happyT = Math.max(0, g.happyT - dt);
    if (g.happyT <= 0) emit(g, { type: "buffEnd", kind: "happy" });
  }
  g.freezeT = Math.max(0, g.freezeT - dt);
  g.freezeCd = Math.max(0, g.freezeCd - dt);
  g.confuseT = Math.max(0, g.confuseT - dt);
  g.featherCd = Math.max(0, g.featherCd - dt);

  for (const a of g.ancients) {
    if (a.left <= 0) continue;
    a.left -= dt;
    if (a.left <= 0) {
      a.left = 0;
      if (landOpen(g, a.biome)) emit(g, { type: "ancientReady", biome: a.biome });
    }
  }

  g.pickupIn -= dt;
  if (g.pickupIn <= 0) {
    g.pickupIn = rand(POWERUP_EVERY[0], POWERUP_EVERY[1]);
    const open: number[] = [];
    for (let b = 0; b < BIOME_COUNT; b++) if (landOpen(g, b)) open.push(b);
    if (g.pickups.length < 2 && open.length) {
      const biome = pick(open);
      const top = biomeTop(biome);
      for (let tries = 0; tries < 10; tries++) {
        const x = CENTER_X + (Math.random() < 0.5 ? -1 : 1) * rand(520, 790);
        const y = top + rand(110, BIOME_H - 110);
        if (g.solids.some((sd) => Math.hypot(sd.x - x, sd.y - y) < sd.r + 46)) continue;
        if (g.nests.some((n) => Math.hypot(n.x - x, n.y - y) < 80)) continue;
        g.pickups.push({ kind: pick(POWERUP_IDS), biome, x, y, left: POWERUP_LIFE, age: 0 });
        break;
      }
    }
  }
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    pk.left -= dt;
    pk.age += dt;
    if (pk.left <= 0) {
      g.pickups.splice(i, 1);
      continue;
    }
    if (pk.biome !== g.biome || dist(p, pk) > PLAYER_R + 24) continue;
    if (g.held) {
      hint(g, "holding");
      continue;
    }
    g.held = pk.kind;
    burst(g, pk.x, pk.y - 10, "#ffffff", 14, "star", 170);
    emit(g, { type: "gotPower", kind: pk.kind });
    g.pickups.splice(i, 1);
  }
}

export function step(g: Game, dt: number, input: Input) {
  g.time += dt;
  movePlayer(g, dt, input);
  tryPickup(g, dt);
  for (const gd of g.guards) updateGuard(g, gd, dt);
  for (const m of g.minis) updateMini(g, m, dt);
  updatePowers(g, dt);
  updateCourier(g, dt);
  deliver(g);
  updateFlights(g, dt);
  updatePads(g, dt);
  updatePets(g, dt);
  updateNests(g, dt);
  updateBugs(g, dt);
  updateWorldEvents(g, dt);
  updateMissions(g, dt);
  updateFx(g, dt);

  g.achT -= dt;
  if (g.achT <= 0) {
    g.achT = 0.5;
    checkAchievements(g);
  }
}
