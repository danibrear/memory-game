import { useEffect, useState } from "react";
import { GAMES, type Game } from "~/gameCatalog";

const STORAGE_KEY = "recent-games";
const MAX_RECENT = 4;

function readRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/** Move a game to the front of the "recently played" list. */
export function recordGameVisit(game: Game): void {
  if (typeof window === "undefined") return;
  try {
    const ids = [game.id, ...readRecentIds().filter((id) => id !== game.id)];
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids.slice(0, MAX_RECENT)),
    );
  } catch {
    // Storage unavailable (private mode, quota) — recent list is a nicety only.
  }
}

/** Recently played games, newest first. Empty during SSR and first paint. */
export function useRecentGames(): Game[] {
  const [games, setGames] = useState<Game[]>([]);
  useEffect(() => {
    const ids = readRecentIds();
    setGames(
      ids
        .map((id) => GAMES.find((g) => g.id === id))
        .filter((g): g is Game => Boolean(g)),
    );
  }, []);
  return games;
}
