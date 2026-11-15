/**
 * Sneaky Eggs' save file: its shape, its version history, and the vault that
 * keeps restore points for it. See `~/storage/saveVault` for how the vault works.
 *
 * Changing the shape of a save:
 *  1. New fields stay optional with a default in `createGame`, as they always have.
 *     That needs no migration.
 *  2. Anything else (a renamed field, a changed meaning, a removed pet id) bumps
 *     `SAVE_VERSION` and adds a step to `MIGRATIONS`, plus a fixture in
 *     `saves.test.ts` so the old shape keeps loading.
 */
import { createVault, type PointKind, type RestorePoint, type StorageLike } from "~/storage/saveVault";
import { SKINS } from "./config";
import { createGame, type SavedGame } from "./engine";

declare const __APP_BUILD__: string | undefined;

/** Set by Vite at build time (see vite.config.ts); "dev" when running outside a build. */
export const APP_BUILD = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev";

export const SAVE_KEY = "sneaky-eggs";

/**
 * Version 0: every save written before November 15, 2026 (no `v` field).
 * Version 1: the same shape, stamped with `v` and the build that wrote it.
 */
export const SAVE_VERSION = 1;

export const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  // 0 → 1 changed nothing but the stamp, which the vault adds when it writes.
  0: (save) => save,
};

export interface Save {
  game: SavedGame | null;
  skin: string;
  muted: boolean;
  music: boolean;
  /** The title-screen secret. */
  giant: boolean;
  /** Cozy mode: no ripening timers, no lifting time, weightless eggs. */
  cozy: boolean;
  lastSeen: number;
}

export const DEFAULT_SAVE: Save = {
  game: null,
  skin: SKINS[0].id,
  muted: false,
  music: true,
  giant: false,
  cozy: false,
  lastSeen: 0,
};

/** What a restore point shows the player. */
export interface SaveSummary {
  level: number;
  pets: number;
  found: number;
  coins: number;
}

export type SavePoint = RestorePoint<SaveSummary>;

export const POINT_LABEL: Record<PointKind, string> = {
  daily: "Start of the day",
  update: "Before a game update",
  reset: "Before starting over",
  restore: "Before your last restore",
};

export function saveFromRaw(raw: Record<string, unknown>): Save {
  const { v: _v, build: _build, ...rest } = raw;
  return { ...DEFAULT_SAVE, ...(rest as Partial<Save>), game: (rest.game as SavedGame | null) ?? null };
}

/** Throws if the game could not open this save. */
export function checkSave(save: Save): void {
  const game = save.game;
  if (game === null) return;
  if (typeof game !== "object" || Array.isArray(game)) throw new Error("game is not an object");
  if (game.pets !== undefined && !Array.isArray(game.pets)) throw new Error("pets is not a list");
  if (game.pads !== undefined && !Array.isArray(game.pads)) throw new Error("pads is not a list");
  // The real test: the engine builds a game from it.
  createGame(game, { giant: save.giant, cozy: save.cozy });
}

export function summarize(save: Save): SaveSummary {
  const game = save.game;
  return {
    level: Math.max(1, Math.floor(Number(game?.level) || 1)),
    pets: game?.pets?.length ?? 0,
    found: Object.values(game?.book ?? {}).filter((n) => Number(n) > 0).length,
    coins: Math.max(0, Math.floor(Number(game?.coins) || 0)),
  };
}

export function createEggsVault(storage: StorageLike, now?: () => number) {
  return createVault<Save, SaveSummary>(
    {
      key: SAVE_KEY,
      version: SAVE_VERSION,
      migrations: MIGRATIONS,
      fromRaw: saveFromRaw,
      check: checkSave,
      hasProgress: (save) => save.game !== null,
      summarize,
      build: APP_BUILD,
      // A restored save is as old as the day it was taken; don't pay "while you were
      // away" coins for the gap.
      onRestore: (save) => ({ ...save, lastSeen: now ? now() : Date.now() }),
      now,
    },
    storage,
  );
}
