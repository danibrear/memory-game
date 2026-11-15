// ─── Sneaky Eggs: achievements ──────────────────────────────────────────────
//
// Each one is a number to reach. `progress` reads it straight off the game, so
// adding an achievement is one entry here and nothing else. Stars earned here
// are what hats and trails cost.

import {
  BIOMES,
  BUILDING_IDS,
  BUILDING_MAX,
  HATS,
  HOUSE_MAX,
  HOME_DECOR,
  MINIS,
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
const shinyKinds = (g: Game) => PETS.filter((p) => (g.book[p.id] ?? 0) >= 2).length;
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
  { id: "legend-egg-1", name: "Heavy Lifting", desc: "Carry a Legendary egg all the way home.", kind: "egg", stars: 3, target: 1, progress: (g) => g.stats.legendEggs },
  { id: "legend-egg-25", name: "Nerves of Steel", desc: "Carry 25 Legendary eggs home.", kind: "egg", stars: 6, target: 25, progress: (g) => g.stats.legendEggs },
  { id: "far-10", name: "Off the Beaten Path", desc: "Bring 10 eggs home from the grove nests.", kind: "egg", stars: 3, target: 10, progress: (g) => g.stats.farEggs },
  { id: "far-100", name: "Grove Runner", desc: "Bring 100 eggs home from the grove nests.", kind: "egg", stars: 6, target: 100, progress: (g) => g.stats.farEggs },
  { id: "power-egg-1", name: "Ancient Find", desc: "Carry a Power Egg home from an ancient nest.", kind: "egg", stars: 4, target: 1, progress: (g) => g.powerEggs.length },
  { id: "power-egg-5", name: "Power Collector", desc: "Own all 5 Power Eggs.", kind: "egg", stars: 10, target: 5, progress: (g) => g.powerEggs.length },
  { id: "level-5", name: "Moving Up", desc: "Reach level 5.", kind: "skill", stars: 2, target: 5, progress: (g) => g.level },
  { id: "level-15", name: "Seasoned Sneak", desc: "Reach level 15.", kind: "skill", stars: 5, target: 15, progress: (g) => g.level },
  { id: "level-30", name: "Legend Level", desc: "Reach level 30.", kind: "skill", stars: 10, target: 30, progress: (g) => g.level },
  { id: "powerup-10", name: "Bag of Tricks", desc: "Use 10 power-ups.", kind: "skill", stars: 3, target: 10, progress: (g) => g.stats.powerups },
  { id: "freeze-10", name: "Ice Cold", desc: "Freeze the Grumbles 10 times.", kind: "skill", stars: 3, target: 10, progress: (g) => g.stats.freezes },
  { id: "sent-home-10", name: "Frequent Flyer", desc: "Get sent back to the start 10 times.", kind: "skill", stars: 2, target: 10, progress: (g) => g.stats.sentHome },
  { id: "courier-50", name: "Special Delivery", desc: "Let the courier bring home 50 eggs.", kind: "coin", stars: 4, target: 50, progress: (g) => g.stats.couriered },
  { id: "boost-5", name: "Fan Favorite", desc: "Collect 5 boosts from FanScout.", kind: "coin", stars: 2, target: 5, progress: (g) => g.stats.adRewards },
  { id: "boost-50", name: "Superfan", desc: "Collect 50 boosts from FanScout.", kind: "coin", stars: 6, target: 50, progress: (g) => g.stats.adRewards },
  { id: "rebirth-1", name: "Born Again", desc: "Rebirth for the first time.", kind: "coin", stars: 8, target: 1, progress: (g) => g.stats.rebirths },
  { id: "rebirth-5", name: "Phoenix", desc: "Rebirth 5 times.", kind: "coin", stars: 15, target: 5, progress: (g) => g.stats.rebirths },
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
  { id: "golden-kinds-5", name: "Gold Rush", desc: "Find Golden versions of 5 different pets.", kind: "pet", stars: 8, target: 5, progress: (g) => PETS.filter((p) => (g.book[p.id] ?? 0) >= 3).length },
  { id: "golden-pet", name: "Solid Gold", desc: "Hatch a Golden pet.", kind: "pet", stars: 4, target: 1, progress: (g) => flag(g, "golden") },
  { id: "rainbow-pet", name: "Over the Rainbow", desc: "Hatch a Rainbow pet.", kind: "pet", stars: 8, target: 1, progress: (g) => flag(g, "rainbow") },
  { id: "huge-pet", name: "That's Huge!", desc: "Hatch a Huge pet.", kind: "pet", stars: 3, target: 1, progress: (g) => flag(g, "huge") },
  { id: "titanic-pet", name: "Absolute Unit", desc: "Hatch a Titanic pet.", kind: "pet", stars: 6, target: 1, progress: (g) => flag(g, "titanic") },
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

  { id: "mission-5", name: "Helper", desc: "Finish 5 missions.", kind: "skill", stars: 2, target: 5, progress: (g) => g.stats.missions },
  { id: "mission-50", name: "Mission Master", desc: "Finish 50 missions.", kind: "skill", stars: 5, target: 50, progress: (g) => g.stats.missions },

  // Care
  { id: "pat-1", name: "Aww", desc: "Pet one of your pets.", kind: "care", stars: 1, target: 1, progress: (g) => g.stats.pats },
  { id: "pat-100", name: "Best Friend", desc: "Pet your pets 100 times.", kind: "care", stars: 3, target: 100, progress: (g) => g.stats.pats },
  { id: "buddy", name: "Buddies", desc: "Pick a pet to follow you around.", kind: "care", stars: 1, target: 1, progress: (g) => flag(g, "buddy") },

  // Style
  { id: "hat-1", name: "Fancy", desc: "Buy a hat with your stars.", kind: "style", stars: 1, target: 1, progress: (g) => g.hats.length - 1 },
  { id: "trail-1", name: "Trailblazer", desc: "Buy a trail with your stars.", kind: "style", stars: 1, target: 1, progress: (g) => g.trails.length - 1 },
  { id: "hat-all", name: "Hat Collector", desc: "Own every hat.", kind: "style", stars: 5, target: HATS.length - 1, progress: (g) => g.hats.length - 1 },

  // Home
  { id: "decor-1", name: "Decorator", desc: "Place a decoration at home.", kind: "style", stars: 1, target: 1, progress: (g) => g.home.length },
  { id: "decor-all", name: "Home Sweet Home", desc: "Place every home decoration.", kind: "style", stars: 6, target: HOME_DECOR.length, progress: (g) => g.home.length },

  // Upgrades
  { id: "up-speed", name: "Fastest Feet", desc: "Max out your Speedy Sneakers.", kind: "upgrade", stars: 5, target: maxLevel("speed"), progress: (g) => g.up.speed },
  { id: "up-3", name: "Fully Loaded", desc: "Max out 3 different upgrades.", kind: "upgrade", stars: 4, target: 3, progress: maxedUpgrades },
  { id: "up-all", name: "Maxed Out", desc: "Max out every upgrade.", kind: "upgrade", stars: 10, target: UPGRADE_IDS.length, progress: maxedUpgrades },

  // Mini games
  { id: "mini-1", name: "Game On", desc: "Play a mini game in one of the striped tents.", kind: "skill", stars: 1, target: 1, progress: (g) => g.stats.minis },
  { id: "mini-all", name: "Playground Pro", desc: "Win a medal in all three mini games.", kind: "skill", stars: 3, target: 3, progress: (g) => MINIS.filter((m) => g.medals[m.id] >= 1).length },
  { id: "mini-tag", name: "Faster Than Zip", desc: "Win a gold medal in Tag with Zip.", kind: "skill", stars: 3, target: 3, progress: (g) => g.medals.tag },
  { id: "mini-steps", name: "Quiet as a Mouse", desc: "Win a gold medal in Sleepy Steps.", kind: "skill", stars: 3, target: 3, progress: (g) => g.medals.steps },
  { id: "mini-seek", name: "Super Seeker", desc: "Win a gold medal in Hide and Seek.", kind: "skill", stars: 3, target: 3, progress: (g) => g.medals.seek },
  { id: "mini-gold", name: "Golden Trio", desc: "Win gold in all three mini games.", kind: "skill", stars: 6, target: 3, progress: (g) => MINIS.filter((m) => g.medals[m.id] >= 3).length },
  { id: "mini-prizes", name: "Prize Hunter", desc: "Win 10 tent prizes.", kind: "skill", stars: 3, target: 10, progress: (g) => g.stats.prizes },
  { id: "dice-5", name: "Lucky Roller", desc: "Roll 5 Lucky Dice on your pets.", kind: "pet", stars: 2, target: 5, progress: (g) => g.stats.diceUsed },
  // Home town
  { id: "build-1", name: "Home Improvement", desc: "Finish your first build at home.", kind: "upgrade", stars: 2, target: 1, progress: (g) => g.stats.built },
  { id: "build-10", name: "Busy Builder", desc: "Finish 10 builds.", kind: "upgrade", stars: 4, target: 10, progress: (g) => g.stats.built },
  { id: "build-30", name: "Master Builder", desc: "Finish 30 builds.", kind: "upgrade", stars: 8, target: 30, progress: (g) => g.stats.built },
  { id: "house-1", name: "Moving Up in the World", desc: "Turn your hut into a Cozy Cottage.", kind: "upgrade", stars: 2, target: 1, progress: (g) => g.town.house },
  { id: "house-4", name: "Home Sweet Castle", desc: "Build the Castle.", kind: "upgrade", stars: 10, target: HOUSE_MAX, progress: (g) => g.town.house },
  { id: "town-all", name: "Our Little Town", desc: "Build every special building.", kind: "upgrade", stars: 6, target: BUILDING_IDS.length, progress: (g) => BUILDING_IDS.filter((id) => g.town.lv[id] > 0).length },
  { id: "town-max", name: "Boom Town", desc: "Take every special building to level 5.", kind: "upgrade", stars: 12, target: BUILDING_IDS.length, progress: (g) => BUILDING_IDS.filter((id) => g.town.lv[id] >= BUILDING_MAX).length },
  { id: "mill-25", name: "Daily Grind", desc: "Collect coins from the Windmill 25 times.", kind: "coin", stars: 3, target: 25, progress: (g) => g.stats.millRuns },
  { id: "cake-10", name: "Sweet Tooth", desc: "Eat 10 cupcakes from the Treat Bakery.", kind: "care", stars: 3, target: 10, progress: (g) => g.stats.cakes },
  { id: "well-25", name: "Make a Wish", desc: "Pull 25 stars out of the Wishing Well.", kind: "coin", stars: 4, target: 25, progress: (g) => g.stats.wellStars },
  { id: "paint-3", name: "Fresh Coat", desc: "Buy 3 paints or toppers for your house.", kind: "style", stars: 2, target: 3, progress: (g) => g.stats.paints },
  { id: "hammer-100", name: "Tap Tap Tap", desc: "Help the builders with 100 taps.", kind: "skill", stars: 2, target: 100, progress: (g) => g.stats.hammers },

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
