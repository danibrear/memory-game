import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faBrain,
  faCircle,
  faCircleDot,
  faCookieBite,
  faCopy,
  faCubes,
  faEgg,
  faFlask,
  faPaintBrush,
  faShield,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Single source of truth for every game on the site.
 * The nav menu, mobile drawer, and landing page all read from here,
 * so adding a game is one entry in GAMES (plus its route in routes.ts).
 */

export type GameCategory =
  | "arcade"
  | "puzzle"
  | "memory"
  | "strategy"
  | "creative";

export interface GameCategoryInfo {
  id: GameCategory;
  label: string;
  emoji: string;
}

export const CATEGORIES: GameCategoryInfo[] = [
  { id: "arcade", label: "Arcade", emoji: "🕹️" },
  { id: "puzzle", label: "Puzzle", emoji: "🧩" },
  { id: "memory", label: "Memory", emoji: "🧠" },
  { id: "strategy", label: "Strategy", emoji: "🛡️" },
  { id: "creative", label: "Creative", emoji: "🎨" },
];

export interface GameColors {
  /** Light end of the tile gradient */
  from: string;
  /** Dark end of the tile gradient — also used for shadows / accents */
  to: string;
}

export interface Game {
  id: string;
  name: string;
  path: string;
  description: string;
  icon: IconDefinition;
  category: GameCategory;
  colors: GameColors;
  players: string;
  isNew?: boolean;
}

export const GAMES: Game[] = [
  {
    id: "eggs",
    name: "Sneaky Eggs",
    path: "/eggs",
    description: "Sneak eggs past the sleepy Grumbles, run them home, and hatch rare pets!",
    icon: faEgg,
    category: "arcade",
    colors: { from: "#a3e635", to: "#4d7c0f" },
    players: "1 player",
    isNew: true,
  },
  {
    id: "munch",
    name: "Munch Bunch",
    path: "/munch",
    description: "Send hungry Munchies to gobble a pixel picture, one color at a time!",
    icon: faCookieBite,
    category: "puzzle",
    colors: { from: "#f0abfc", to: "#a21caf" },
    players: "1 player",
    isNew: true,
  },
  {
    id: "arrows",
    name: "Arrow Escape",
    path: "/arrows",
    description: "Tap the arrows that have a clear path out. Clear the whole board!",
    icon: faArrowRight,
    category: "puzzle",
    colors: { from: "#fcd34d", to: "#d97706" },
    players: "1 player",
    isNew: true,
  },
  {
    id: "towerdefense",
    name: "Tower Defense",
    path: "/towerdefense",
    description: "Build towers and stop the enemy waves before they break through!",
    icon: faShield,
    category: "strategy",
    colors: { from: "#fca5a5", to: "#b91c1c" },
    players: "1 player",
  },
  {
    id: "hole",
    name: "Hole Drop",
    path: "/hole",
    description: "Steer a hungry hole around the city. Gobble everything and grow the biggest!",
    icon: faCircleDot,
    category: "arcade",
    colors: { from: "#5eead4", to: "#0f766e" },
    players: "1 player",
    isNew: true,
  },
  {
    id: "quadra",
    name: "Cascade",
    path: "/quadra",
    description: "Falling blocks with chain reactions. Stack, clear, and combo!",
    icon: faCubes,
    category: "arcade",
    colors: { from: "#a5b4fc", to: "#4338ca" },
    players: "1 player",
  },
  {
    id: "bubblepop",
    name: "Bubble Pop",
    path: "/bubblepop",
    description: "Pop the bubbles before they float away. Easy mode for little ones!",
    icon: faCircle,
    category: "arcade",
    colors: { from: "#7dd3fc", to: "#0369a1" },
    players: "1 player",
  },
  {
    id: "ballsort",
    name: "Ball Sort",
    path: "/ballsort",
    description: "Sort the colored balls until every tube holds just one color.",
    icon: faFlask,
    category: "puzzle",
    colors: { from: "#86efac", to: "#15803d" },
    players: "1 player",
  },
  {
    id: "memory",
    name: "Memory Game",
    path: "/memory",
    description: "Remember the highlighted squares, then find them all again.",
    icon: faBrain,
    category: "memory",
    colors: { from: "#c4b5fd", to: "#6d28d9" },
    players: "1 player",
  },
  {
    id: "match",
    name: "Match Game",
    path: "/match",
    description: "Flip cards to find the pairs. Play solo or take turns with a friend!",
    icon: faCopy,
    category: "memory",
    colors: { from: "#fdba74", to: "#c2410c" },
    players: "1–2 players",
  },
  {
    id: "color",
    name: "Color Game",
    path: "/color",
    description: "Paint pixel pictures with a brush, fill bucket, and rainbow brush.",
    icon: faPaintBrush,
    category: "creative",
    colors: { from: "#f9a8d4", to: "#be185d" },
    players: "1 player",
  },
];

export const FEATURED_GAME: Game = GAMES.find((g) => g.isNew) ?? GAMES[0];

export function getGameByPath(pathname: string): Game | undefined {
  return GAMES.find(
    (g) => pathname === g.path || pathname.startsWith(`${g.path}/`),
  );
}

export function getCategory(id: GameCategory): GameCategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function gamesByCategory(): { category: GameCategoryInfo; games: Game[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    games: GAMES.filter((g) => g.category === category.id),
  })).filter((group) => group.games.length > 0);
}

export function randomGame(excludePath?: string): Game {
  const pool = GAMES.filter((g) => g.path !== excludePath);
  return pool[Math.floor(Math.random() * pool.length)] ?? GAMES[0];
}

export function gameGradient(game: Game, angle = 135): string {
  return `linear-gradient(${angle}deg, ${game.colors.from} 0%, ${game.colors.to} 100%)`;
}
