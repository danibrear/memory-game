// ─── Sneaky Eggs: achievements ──────────────────────────────────────────────
//
// Each one is a number to reach. `progress` reads it straight off the game, so
// adding an achievement is one entry here and nothing else. Stars earned here
// are what hats and trails cost.

import {
  BIOMES,
  HOME_DECOR,
  PETS,
  UPGRADE_IDS,
  maxLevel,
  penSize,
  type Rarity,
} from "./config";
import type { Game } from "./engine";

export type AchKind =
  | "egg" | "pet" | "land" | "fuse" | "coin" | "skill" | "care" | "style" | "upgrade" | "secret";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  kind: AchKind;
  stars: number;
  target: number;
  progress: (g: Game) => number;
  /** Hidden until earned: shows as "???" in the list. */
  secret?: boolean;
}

const foundOfRarity = (g: Game, r: Rarity) =>
  PETS.filter((p) => p.rarity === r && g.book[p.id]).length;
const foundInLand = (g: Game, biome: number) =>
  PETS.filter((p) => p.biome === biome && p.rarity < 4 && g.book[p.id]).length;
const bookRegular = (g: Game) => PETS.filter((p) => p.rarity < 4 && g.book[p.id]).length;
const shinyKinds = (g: Game) => PETS.filter((p) => g.book[p.id] === 2).length;
const flag = (g: Game, key: string) => (g.flags[key] ? 1 : 0);
const maxedUpgrades = (g: Game) => UPGRADE_IDS.filter((id) => g.up[id] >= maxLevel(id)).length;

const LAND_BADGES = ["Meadow Expert", "Beach Expert", "Peak Expert", "Canyon Expert", "Space Expert"];

export const ACHIEVEMENTS: Achievement[] = [
  // Eggs
  { id: "egg-1", name: "Egg-cellent Start", desc: "Bring your first egg home.", kind: "egg", stars: 1, target: 1, progress: (g) => g.stats.eggs },
  { id: "egg-10", name: "Egg Runner", desc: "Bring 10 eggs home.", kind: "egg", stars: 2, target: 10, progress: (g) => g.stats.eggs },
  { id: "egg-50", name: "Egg Express", desc: "Bring 50 eggs home.", kind: "egg", stars: 3, target: 50, progress: (g) => g.stats.eggs },
  { id: "egg-200", name: "Egg Legend", desc: "Bring 200 eggs home.", kind: "egg", stars: 5, target: 200, progress: (g) => g.stats.eggs },
  { id: "egg-1000", name: "Egg-finity", desc: "Bring 1,000 eggs home.", kind: "egg", stars: 8, target: 1000, progress: (g) => g.stats.eggs },
  { id: "golden-10", name: "Golden Touch", desc: "Take 10 eggs from golden nests.", kind: "egg", stars: 3, target: 10, progress: (g) => g.stats.golden },
  { id: "triple", name: "Triple Scoop", desc: "Bring 3 eggs home in one trip.", kind: "egg", stars: 3, target: 3, progress: (g) => g.stats.maxCarry },
  { id: "mystery-1", name: "Mystery Solved", desc: "Grab a Mystery Egg.", kind: "egg", stars: 2, target: 1, progress: (g) => g.stats.mystery },
  { id: "mystery-5", name: "Mystery Master", desc: "Grab 5 Mystery Eggs.", kind: "egg", stars: 4, target: 5, progress: (g) => g.stats.mystery },
  { id: "night-10", name: "Night Owl", desc: "Bring 10 eggs home at night.", kind: "egg", stars: 3, target: 10, progress: (g) => g.stats.night },
  { id: "taps-300", name: "Tap Tap Tap", desc: "Tap hatching eggs 300 times.", kind: "egg", stars: 2, target: 300, progress: (g) => g.stats.taps },

  // Pets
  { id: "rare-1", name: "Ooh, Rare!", desc: "Find a Rare pet.", kind: "pet", stars: 1, target: 1, progress: (g) => foundOfRarity(g, 1) },
  { id: "epic-1", name: "Epic Find", desc: "Find an Epic pet.", kind: "pet", stars: 2, target: 1, progress: (g) => foundOfRarity(g, 2) },
  { id: "legend-1", name: "Legendary!", desc: "Find a Legendary pet.", kind: "pet", stars: 3, target: 1, progress: (g) => foundOfRarity(g, 3) },
  { id: "mythic-1", name: "Myth Maker", desc: "Fuse 3 Legendary pets into a Mythic.", kind: "pet", stars: 5, target: 1, progress: (g) => foundOfRarity(g, 4) },
  { id: "shiny-1", name: "So Shiny", desc: "Hatch a shiny pet.", kind: "pet", stars: 2, target: 1, progress: (g) => g.stats.shinies },
  { id: "shiny-kinds-8", name: "Sparkle Collector", desc: "Find shiny versions of 8 different pets.", kind: "pet", stars: 5, target: 8, progress: shinyKinds },
  { id: "book-10", name: "Halfway There", desc: "Find 10 different pets.", kind: "pet", stars: 2, target: 10, progress: bookRegular },
  { id: "book-20", name: "Pet Master", desc: "Find all 20 pets that hatch from eggs.", kind: "pet", stars: 6, target: 20, progress: bookRegular },
  { id: "book-25", name: "Mythic Master", desc: "Find all 5 Mythic pets.", kind: "pet", stars: 10, target: 5, progress: (g) => foundOfRarity(g, 4) },
  ...BIOMES.map((b, i): Achievement => ({
    id: `land-${b.id}`,
    name: LAND_BADGES[i],
    desc: `Find all 4 egg pets from ${b.name}.`,
    kind: "pet",
    stars: 3,
    target: 4,
    progress: (g) => foundInLand(g, i),
  })),
  { id: "pen-full", name: "Full House", desc: "Fill the biggest pen with 20 pets.", kind: "pet", stars: 4, target: 20, progress: (g) => (penSize(g.up.pen) >= 20 ? g.pets.length : Math.min(19, g.pets.length)) },

  // Lands
  ...BIOMES.slice(1).map((b): Achievement => ({
    id: `open-${b.id}`,
    name: `Hello, ${b.name}`,
    desc: `Open the gate to ${b.name}.`,
    kind: "land",
    stars: 2,
    target: b.speedReq,
    progress: (g) => g.up.speed,
  })),
  { id: "travel-5", name: "Frequent Flyer", desc: "Use the map 5 times.", kind: "land", stars: 1, target: 5, progress: (g) => g.stats.travels },

  // Fusing
  { id: "fuse-1", name: "Abracadabra", desc: "Fuse 3 pets into a rarer one.", kind: "fuse", stars: 1, target: 1, progress: (g) => g.stats.fused },
  { id: "fuse-10", name: "Fusion Fan", desc: "Do 10 fusions.", kind: "fuse", stars: 3, target: 10, progress: (g) => g.stats.fused },
  { id: "fuse-50", name: "Fusion Wizard", desc: "Do 50 fusions.", kind: "fuse", stars: 5, target: 50, progress: (g) => g.stats.fused },

  // Coins
  { id: "coins-1k", name: "Piggy Bank", desc: "Earn 1,000 coins in total.", kind: "coin", stars: 1, target: 1_000, progress: (g) => g.stats.earned },
  { id: "coins-1m", name: "Treasure Chest", desc: "Earn 1 million coins in total.", kind: "coin", stars: 3, target: 1_000_000, progress: (g) => g.stats.earned },
  { id: "coins-1b", name: "Dragon's Hoard", desc: "Earn 1 billion coins in total.", kind: "coin", stars: 5, target: 1_000_000_000, progress: (g) => g.stats.earned },
  { id: "bugs-10", name: "Bug Catcher", desc: "Catch 10 glitterbugs.", kind: "coin", stars: 2, target: 10, progress: (g) => g.stats.bugs },
  { id: "bugs-100", name: "Bug Whisperer", desc: "Catch 100 glitterbugs.", kind: "coin", stars: 4, target: 100, progress: (g) => g.stats.bugs },
  { id: "chest-1", name: "Surprise!", desc: "Open the gift chest at home.", kind: "coin", stars: 1, target: 1, progress: (g) => g.stats.chests },
  { id: "chest-10", name: "Gift Getter", desc: "Open the gift chest 10 times.", kind: "coin", stars: 3, target: 10, progress: (g) => g.stats.chests },

  // Skill
  { id: "caught-1", name: "Oopsie", desc: "Get caught by a Grumble. It happens!", kind: "skill", stars: 1, target: 1, progress: (g) => g.stats.caught },
  { id: "escape-25", name: "Slippery", desc: "Escape a chasing Grumble 25 times.", kind: "skill", stars: 3, target: 25, progress: (g) => g.stats.escapes },
  { id: "close-1", name: "By a Whisker", desc: "Escape with a Grumble right behind you.", kind: "skill", stars: 2, target: 1, progress: (g) => g.stats.close },
  { id: "dash-25", name: "Zoom Zoom", desc: "Use Zoom Dash 25 times.", kind: "skill", stars: 2, target: 25, progress: (g) => g.stats.dashes },

  // Care
  { id: "pat-1", name: "Aww", desc: "Pet one of your pets.", kind: "care", stars: 1, target: 1, progress: (g) => g.stats.pats },
  { id: "pat-100", name: "Best Friend", desc: "Pet your pets 100 times.", kind: "care", stars: 3, target: 100, progress: (g) => g.stats.pats },
  { id: "buddy", name: "Buddies", desc: "Pick a pet to follow you around.", kind: "care", stars: 1, target: 1, progress: (g) => flag(g, "buddy") },

  // Style
  { id: "hat-1", name: "Fancy", desc: "Buy a hat with your stars.", kind: "style", stars: 1, target: 2, progress: (g) => g.hats.length },
  { id: "trail-1", name: "Trailblazer", desc: "Buy a trail with your stars.", kind: "style", stars: 1, target: 2, progress: (g) => g.trails.length },
  { id: "hat-all", name: "Hat Collector", desc: "Own every hat.", kind: "style", stars: 5, target: 10, progress: (g) => g.hats.length },

  // Home
  { id: "decor-1", name: "Decorator", desc: "Place a decoration at home.", kind: "style", stars: 1, target: 1, progress: (g) => g.home.length },
  { id: "decor-all", name: "Home Sweet Home", desc: "Place every home decoration.", kind: "style", stars: 6, target: HOME_DECOR.length, progress: (g) => g.home.length },

  // Upgrades
  { id: "up-speed", name: "Fastest Feet", desc: "Max out your Speedy Sneakers.", kind: "upgrade", stars: 5, target: maxLevel("speed"), progress: (g) => g.up.speed },
  { id: "up-3", name: "Fully Loaded", desc: "Max out 3 different upgrades.", kind: "upgrade", stars: 4, target: 3, progress: maxedUpgrades },
  { id: "up-all", name: "Maxed Out", desc: "Max out every upgrade.", kind: "upgrade", stars: 10, target: UPGRADE_IDS.length, progress: maxedUpgrades },

  // Secrets
  { id: "secret-stars", name: "Explorer", desc: "Find the hidden star in every land.", kind: "secret", stars: 5, target: 5, progress: (g) => g.secrets.length },
  { id: "whisperer", name: "Grumble Whisperer", desc: "Gently pat a sleeping Grumble 5 times.", kind: "secret", stars: 2, target: 5, progress: (g) => g.stats.grumblePats, secret: true },
  { id: "knock", name: "Knock Knock", desc: "Knock on the little house 5 times.", kind: "secret", stars: 2, target: 5, progress: (g) => g.stats.knocks, secret: true },
  { id: "taxi", name: "Space Taxi", desc: "Find the flying saucer and ride it home.", kind: "secret", stars: 3, target: 1, progress: (g) => flag(g, "taxi"), secret: true },
  { id: "sleepy", name: "Sleepyhead", desc: "Stand still until you fall asleep.", kind: "secret", stars: 1, target: 1, progress: (g) => flag(g, "sleepy"), secret: true },
  { id: "sugar", name: "Sugar Rush", desc: "Bump a lollipop for a burst of speed.", kind: "secret", stars: 1, target: 1, progress: (g) => g.stats.sugar, secret: true },
  { id: "coconut", name: "Bonk!", desc: "Shake a coconut out of a palm tree.", kind: "secret", stars: 1, target: 1, progress: (g) => g.stats.coconuts, secret: true },
  { id: "snow", name: "Snow Buddy", desc: "Say hello to 10 snowmen.", kind: "secret", stars: 2, target: 10, progress: (g) => g.stats.snowmen, secret: true },
  { id: "song", name: "Crystal Song", desc: "Ring 3 different crystals in a row.", kind: "secret", stars: 2, target: 1, progress: (g) => flag(g, "song"), secret: true },
  { id: "wish", name: "Star Catcher", desc: "Tap a shooting star at night.", kind: "secret", stars: 2, target: 1, progress: (g) => g.stats.wishes, secret: true },
  { id: "goldbug", name: "Golden Glitterbug", desc: "Catch a rare golden glitterbug.", kind: "secret", stars: 2, target: 1, progress: (g) => flag(g, "goldbug"), secret: true },
  { id: "kaching", name: "Ka-ching!", desc: "Tap your coins 10 times.", kind: "secret", stars: 1, target: 1, progress: (g) => flag(g, "kaching"), secret: true },
  { id: "giant", name: "Big Sneak", desc: "Tickle the title screen 7 times.", kind: "secret", stars: 1, target: 1, progress: (g) => flag(g, "giant"), secret: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export const TOTAL_STARS = ACHIEVEMENTS.reduce((n, a) => n + a.stars, 0);

/** Regular (egg) pets that have been found: the number behind the Pet Master win. */
export const regularFound = bookRegular;
