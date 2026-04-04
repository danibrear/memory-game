/**
 * Set this to your S3 file URL to enable remote configuration.
 * Leave empty to always use the built-in defaults (offline-safe).
 *
 * Example S3 URL: "https://my-bucket.s3.amazonaws.com/games-config.json"
 *
 * The JSON file should match the GameConfig shape below.
 * Any keys you omit fall back to the built-in defaults, so you only
 * need to include the sections you want to override.
 */
export const REMOTE_CONFIG_URL =
  "https://danibs-games-config.s3.us-east-2.amazonaws.com/games-config.json";

export type BallColor = { name: string; hsl: string };

export type BallSortConfig = {
  /** Color palette available in the game. Index order determines ball colors. */
  colors: BallColor[];
  /** How many balls fit in each tube. */
  tubeCapacity: number;
  /** Minimum number of colors the player can choose. */
  minColors: number;
  /** Maximum number of colors the player can choose (must be ≤ colors.length). */
  maxColors: number;
  /** Minimum number of extra empty tubes. */
  minExtraTubes: number;
  /** Maximum number of extra empty tubes. */
  maxExtraTubes: number;
};

export type GameConfig = {
  ballSort: BallSortConfig;
};

export const DEFAULT_CONFIG: GameConfig = {
  ballSort: {
    colors: [
      { name: "Red", hsl: "hsl(0, 80%, 55%)" },
      { name: "Blue", hsl: "hsl(220, 80%, 55%)" },
      { name: "Green", hsl: "hsl(140, 70%, 45%)" },
      { name: "Yellow", hsl: "hsl(50, 90%, 55%)" },
      { name: "Purple", hsl: "hsl(280, 70%, 55%)" },
      { name: "Orange", hsl: "hsl(25, 90%, 55%)" },
      { name: "Pink", hsl: "hsl(330, 80%, 65%)" },
      { name: "Cyan", hsl: "hsl(185, 80%, 45%)" },
      { name: "Lime", hsl: "hsl(80, 75%, 50%)" },
      { name: "Brown", hsl: "hsl(20, 50%, 40%)" },
    ],
    tubeCapacity: 4,
    minColors: 2,
    maxColors: 10,
    minExtraTubes: 1,
    maxExtraTubes: 4,
  },
};

type RemoteConfig = {
  ballSort?: Partial<BallSortConfig>;
};

function mergeConfig(remote: RemoteConfig): GameConfig {
  return {
    ballSort: { ...DEFAULT_CONFIG.ballSort, ...remote.ballSort },
  };
}

// Module-level cache so all components share one fetch.
let cached: GameConfig | null = null;
let pending: Promise<GameConfig> | null = null;

export function loadConfig(): Promise<GameConfig> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  if (!REMOTE_CONFIG_URL) {
    cached = DEFAULT_CONFIG;
    return Promise.resolve(cached);
  }

  console.log("Fetching remote config from", REMOTE_CONFIG_URL);

  pending = fetch(REMOTE_CONFIG_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<RemoteConfig>;
    })
    .then((remote) => {
      cached = mergeConfig(remote);
      return cached;
    })
    .catch(() => {
      // Offline or fetch failed — fall back to defaults silently.
      cached = DEFAULT_CONFIG;
      return cached;
    })
    .finally(() => {
      pending = null;
    }) as Promise<GameConfig>;

  return pending;
}
