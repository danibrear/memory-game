/**
 * A save file with a safety net.
 *
 * One game's save lives in one storage entry, as before. The vault adds what a
 * single entry can't give you:
 *
 *  - a version number and step-by-step migrations, so a change to the shape of
 *    a save is written down instead of hoped for;
 *  - restore points (the first load of each day, a load after the game was
 *    updated, before "start over", before a restore), kept in a second entry;
 *  - a save that can't be opened is copied aside and never overwritten, and
 *    the newest restore point that still opens is brought back in its place.
 *
 * Nothing here knows about any particular game, and nothing leaves the device.
 */

const PREFIX = "memory-game-storage";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PointKind = "daily" | "update" | "reset" | "restore";

/** How many restore points of each kind are kept; the oldest go first. */
export const KEEP: Record<PointKind, number> = { daily: 5, update: 3, reset: 2, restore: 1 };

/** An unreadable save larger than this isn't copied aside (it would not fit anyway). */
const MAX_BROKEN_CHARS = 400_000;

export interface RestorePoint<Sum> {
  id: string;
  /** When the point was taken (ms). */
  t: number;
  kind: PointKind;
  /** A few numbers to show the player, read from the save when the point was taken. */
  summary: Sum;
  /** The save exactly as it was stored, before any migration. */
  data: string;
}

export interface VaultConfig<S, Sum> {
  /** Storage key without the site prefix, e.g. "sneaky-eggs". */
  key: string;
  /** Current save version. A stored save with no `v` is version 0. */
  version: number;
  /** `migrations[n]` turns a version-n save into version n + 1. */
  migrations: Record<number, (save: Record<string, unknown>) => Record<string, unknown>>;
  /** Fills in defaults and gives the save its type. */
  fromRaw(raw: Record<string, unknown>): S;
  /** Throws if the game could not open this save. */
  check(save: S): void;
  /** Whether there is anything in the save worth a restore point. */
  hasProgress(save: S): boolean;
  summarize(save: S): Sum;
  /** Identifies the running build, so the first load after an update can be told apart. */
  build: string;
  /** Called on a restored save, e.g. to stop "while you were away" paying out for the gap. */
  onRestore?(save: S): S;
  now?: () => number;
}

export type LoadStatus =
  /** Nothing stored. */
  | "empty"
  | "ok"
  /** The save could not be opened; the newest restore point that could was brought back. */
  | "recovered"
  /** The save could not be opened and there was no restore point to fall back on. */
  | "broken";

export interface LoadResult<S, Sum> {
  status: LoadStatus;
  save: S | null;
  /** Set when status is "recovered". */
  from?: RestorePoint<Sum>;
}

export interface Vault<S, Sum> {
  load(): LoadResult<S, Sum>;
  /** Returns false if the device refused the write (storage full or blocked). */
  write(save: S): boolean;
  /** Newest first. */
  points(): RestorePoint<Sum>[];
  /** Swaps in a restore point, keeping the current save as a restore point of its own. */
  restore(id: string): S | null;
  /** Clears the save, keeping it as a restore point first. */
  reset(): void;
}

const dayOf = (t: number) => new Date(t).toDateString();

export function createVault<S extends object, Sum>(
  cfg: VaultConfig<S, Sum>,
  storage: StorageLike,
): Vault<S, Sum> {
  const mainKey = `${PREFIX}-${cfg.key}`;
  const pointsKey = `${mainKey}-backups`;
  const brokenKey = `${mainKey}-broken`;
  const now = () => (cfg.now ? cfg.now() : Date.now());

  const read = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  /** Parses, migrates, fills defaults and checks. Throws if any step fails. */
  const open = (text: string): S => {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("save is not an object");
    }
    let raw = parsed as Record<string, unknown>;
    let v = Number(raw.v) || 0;
    while (v < cfg.version) {
      const step = cfg.migrations[v];
      if (step) raw = step(raw);
      v += 1;
    }
    const save = cfg.fromRaw(raw);
    cfg.check(save);
    return save;
  };

  const readPoints = (): RestorePoint<Sum>[] => {
    const text = read(pointsKey);
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as { points?: RestorePoint<Sum>[] };
      return (parsed.points ?? [])
        .filter((p) => p && typeof p.data === "string" && typeof p.t === "number")
        .sort((a, b) => b.t - a.t);
    } catch {
      return [];
    }
  };

  /** Keeps the newest few of each kind. */
  const thin = (points: RestorePoint<Sum>[]): RestorePoint<Sum>[] => {
    const seen: Record<string, number> = {};
    return [...points]
      .sort((a, b) => b.t - a.t)
      .filter((p) => {
        seen[p.kind] = (seen[p.kind] ?? 0) + 1;
        return seen[p.kind] <= (KEEP[p.kind] ?? 1);
      });
  };

  /** Stores the list; if the device is out of room, lets go of the oldest until it fits. */
  const writePoints = (points: RestorePoint<Sum>[]): void => {
    let list = thin(points);
    for (;;) {
      try {
        storage.setItem(pointsKey, JSON.stringify({ points: list }));
        return;
      } catch {
        if (!list.length) return;
        list = list.slice(0, -1);
      }
    }
  };

  const addPoint = (kind: PointKind, data: string, save: S): void => {
    const points = readPoints();
    // Opening the game twice without playing shouldn't spend two slots on one save.
    if (points[0]?.data === data) return;
    const t = now();
    points.unshift({
      id: `${t.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      t,
      kind,
      summary: cfg.summarize(save),
      data,
    });
    writePoints(points);
  };

  const stamp = (save: S): string => JSON.stringify({ ...save, v: cfg.version, build: cfg.build });

  const write = (save: S): boolean => {
    try {
      storage.setItem(mainKey, stamp(save));
      return true;
    } catch {
      return false;
    }
  };

  const setAside = (text: string): void => {
    if (text.length > MAX_BROKEN_CHARS) return;
    try {
      storage.setItem(brokenKey, JSON.stringify({ t: now(), build: cfg.build, raw: text }));
    } catch {
      // No room for the copy. The restore points are worth more than it is.
    }
  };

  const load = (): LoadResult<S, Sum> => {
    const text = read(mainKey);
    if (text === null) return { status: "empty", save: null };

    let save: S;
    try {
      save = open(text);
    } catch {
      setAside(text);
      for (const point of readPoints()) {
        try {
          const recovered = cfg.onRestore ? cfg.onRestore(open(point.data)) : open(point.data);
          write(recovered);
          return { status: "recovered", save: recovered, from: point };
        } catch {
          // That one doesn't open either; try the one before it.
        }
      }
      return { status: "broken", save: null };
    }

    if (cfg.hasProgress(save)) {
      let stored: { build?: unknown; v?: unknown } = {};
      try {
        stored = JSON.parse(text) as { build?: unknown; v?: unknown };
      } catch {
        // It opened a moment ago, so this can't happen; an empty stamp is a safe answer.
      }
      const today = dayOf(now());
      // The first load of a day always gets a point, so the daily ones cover five days of
      // play however often the game is updated. A second load the same day only gets one
      // if the game changed underneath it. (A save with no stamp predates the vault, which
      // counts as a change.)
      if (!readPoints().some((p) => p.kind === "daily" && dayOf(p.t) === today)) {
        addPoint("daily", text, save);
      } else if (stored.build !== cfg.build) {
        addPoint("update", text, save);
      }
    }
    return { status: "ok", save };
  };

  const restore = (id: string): S | null => {
    const point = readPoints().find((p) => p.id === id);
    if (!point) return null;
    let save: S;
    try {
      save = open(point.data);
    } catch {
      return null;
    }
    if (cfg.onRestore) save = cfg.onRestore(save);
    const current = read(mainKey);
    if (current !== null) {
      try {
        const cur = open(current);
        if (cfg.hasProgress(cur)) addPoint("restore", current, cur);
      } catch {
        setAside(current);
      }
    }
    if (!write(save)) return null;
    return save;
  };

  const reset = (): void => {
    const current = read(mainKey);
    if (current !== null) {
      try {
        const cur = open(current);
        if (cfg.hasProgress(cur)) addPoint("reset", current, cur);
      } catch {
        setAside(current);
      }
    }
    try {
      storage.removeItem(mainKey);
    } catch {
      // Storage is blocked; there was nothing to clear.
    }
  };

  return { load, write, points: readPoints, restore, reset };
}
