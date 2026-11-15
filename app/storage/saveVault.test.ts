import { describe, expect, it } from "vitest";
import { createVault, KEEP, type StorageLike, type VaultConfig } from "./saveVault";

interface Toy {
  score: number;
  name: string;
}

const MAIN = "memory-game-storage-toy";
const POINTS = `${MAIN}-backups`;
const BROKEN = `${MAIN}-broken`;
const DAY = 24 * 60 * 60 * 1000;

function memory(limitChars = Infinity) {
  const items = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => {
      let used = v.length;
      for (const [key, value] of items) if (key !== k) used += value.length;
      if (used > limitChars) throw new Error("QuotaExceededError");
      items.set(k, v);
    },
    removeItem: (k) => void items.delete(k),
  };
  return { items, storage };
}

function setup(over: Partial<VaultConfig<Toy, number>> = {}, limitChars = Infinity) {
  const mem = memory(limitChars);
  const clock = { t: new Date(2026, 10, 15, 9, 0).getTime() };
  const cfg: VaultConfig<Toy, number> = {
    key: "toy",
    version: 1,
    migrations: {},
    fromRaw: (raw) => ({ score: Number(raw.score) || 0, name: String(raw.name ?? "") }),
    check: (s) => {
      if (s.score < 0) throw new Error("negative score");
    },
    hasProgress: (s) => s.score > 0,
    summarize: (s) => s.score,
    build: "b1",
    now: () => clock.t,
    ...over,
  };
  return { ...mem, clock, cfg, vault: createVault(cfg, mem.storage) };
}

describe("saveVault", () => {
  it("reports an empty store and writes a stamped save", () => {
    const { vault, items } = setup();
    expect(vault.load()).toEqual({ status: "empty", save: null });
    expect(vault.write({ score: 3, name: "a" })).toBe(true);
    expect(JSON.parse(items.get(MAIN)!)).toEqual({ score: 3, name: "a", v: 1, build: "b1" });
  });

  it("takes one restore point on the first load of each day", () => {
    const { vault, clock } = setup();
    vault.write({ score: 3, name: "a" });
    expect(vault.load().status).toBe("ok");
    expect(vault.points().map((p) => p.kind)).toEqual(["daily"]);

    // Same day, more progress: no second point.
    clock.t += 60_000;
    vault.write({ score: 9, name: "a" });
    vault.load();
    expect(vault.points()).toHaveLength(1);
    expect(vault.points()[0].summary).toBe(3);

    // Next day: a new point holding yesterday's last save.
    clock.t += DAY;
    vault.load();
    expect(vault.points().map((p) => p.summary)).toEqual([9, 3]);
  });

  it("takes no point for a save with nothing in it", () => {
    const { vault } = setup();
    vault.write({ score: 0, name: "a" });
    vault.load();
    expect(vault.points()).toEqual([]);
  });

  it("takes a point when the game was updated since the save was written", () => {
    const first = setup();
    first.vault.write({ score: 3, name: "a" });
    first.vault.load();

    // A new build opens the same storage later the same day, after more play.
    first.items.set(MAIN, JSON.stringify({ score: 5, name: "a", v: 1, build: "b1" }));
    const next = createVault({ ...first.cfg, build: "b2" }, first.storage);
    next.load();
    expect(next.points().map((p) => [p.kind, p.summary])).toEqual([
      ["update", 5],
      ["daily", 3],
    ]);
  });

  it("treats a save from before the vault as version 0 and keeps a point of it", () => {
    const { vault, items } = setup({
      version: 2,
      migrations: {
        0: (s) => ({ ...s, name: "migrated" }),
        1: (s) => ({ ...s, score: Number(s.score) * 10 }),
      },
    });
    const old = JSON.stringify({ score: 4 });
    items.set(MAIN, old);
    const found = vault.load();
    expect(found.save).toEqual({ score: 40, name: "migrated" });
    // The point holds the save exactly as it was found, not the migrated one.
    expect(vault.points()[0].data).toBe(old);
  });

  it("runs only the migrations a save still needs", () => {
    const { vault, items } = setup({
      version: 2,
      migrations: {
        0: (s) => ({ ...s, name: "migrated" }),
        1: (s) => ({ ...s, score: Number(s.score) * 10 }),
      },
    });
    items.set(MAIN, JSON.stringify({ score: 4, name: "kept", v: 1 }));
    expect(vault.load().save).toEqual({ score: 40, name: "kept" });
  });

  it("keeps only the newest few points of each kind", () => {
    const { vault, clock } = setup();
    for (let day = 0; day < KEEP.daily + 4; day++) {
      vault.write({ score: day + 1, name: "a" });
      vault.load();
      clock.t += DAY;
    }
    const points = vault.points();
    expect(points).toHaveLength(KEEP.daily);
    expect(points[0].summary).toBe(KEEP.daily + 4);
    expect(points.every((p, i) => i === 0 || points[i - 1].t > p.t)).toBe(true);
  });

  it("brings back the newest point that opens when the save can't be read", () => {
    const { vault, items, clock } = setup();
    vault.write({ score: 7, name: "good" });
    vault.load();
    clock.t += DAY;

    items.set(MAIN, '{"score": 12, "na');
    const found = vault.load();
    expect(found.status).toBe("recovered");
    expect(found.save).toEqual({ score: 7, name: "good" });
    expect(found.from?.summary).toBe(7);
    // The unreadable text is kept, and the recovered save is now the stored one.
    expect(JSON.parse(items.get(BROKEN)!).raw).toBe('{"score": 12, "na');
    expect(JSON.parse(items.get(MAIN)!).score).toBe(7);
  });

  it("recovers when the save parses but the game can't open it", () => {
    const { vault, items, clock } = setup();
    vault.write({ score: 7, name: "good" });
    vault.load();
    clock.t += DAY;
    items.set(MAIN, JSON.stringify({ score: -1, name: "bad", v: 1, build: "b1" }));
    expect(vault.load().status).toBe("recovered");
  });

  it("skips points that don't open either", () => {
    const { vault, items, clock } = setup();
    vault.write({ score: 7, name: "good" });
    vault.load();
    clock.t += DAY;
    const stored = JSON.parse(items.get(POINTS)!);
    stored.points.unshift({ id: "x", t: clock.t, kind: "daily", summary: 0, data: "not json" });
    items.set(POINTS, JSON.stringify(stored));
    items.set(MAIN, "[]");
    const found = vault.load();
    expect(found.status).toBe("recovered");
    expect(found.save?.score).toBe(7);
  });

  it("says so, and keeps a copy, when nothing can be recovered", () => {
    const { vault, items } = setup();
    items.set(MAIN, "definitely not a save");
    expect(vault.load()).toEqual({ status: "broken", save: null });
    expect(JSON.parse(items.get(BROKEN)!).raw).toBe("definitely not a save");
    // The stored text is untouched until the player actually starts a new game.
    expect(items.get(MAIN)).toBe("definitely not a save");
  });

  it("keeps the save as a point when starting over, and can bring it back", () => {
    const { vault, items, clock } = setup();
    vault.write({ score: 7, name: "a" });
    vault.load();
    clock.t += 60_000;
    vault.write({ score: 20, name: "a" });
    vault.reset();
    expect(items.has(MAIN)).toBe(false);
    expect(vault.load().status).toBe("empty");

    const [reset] = vault.points();
    expect([reset.kind, reset.summary]).toEqual(["reset", 20]);
    expect(vault.restore(reset.id)).toEqual({ score: 20, name: "a" });
    expect(JSON.parse(items.get(MAIN)!).score).toBe(20);
  });

  it("keeps the current save as a point when restoring, so a restore can be undone", () => {
    const { vault, clock } = setup();
    vault.write({ score: 7, name: "a" });
    vault.load();
    clock.t += 60_000;
    vault.write({ score: 30, name: "a" });

    const daily = vault.points()[0];
    expect(vault.restore(daily.id)?.score).toBe(7);
    const undo = vault.points().find((p) => p.kind === "restore");
    expect(undo?.summary).toBe(30);
    expect(vault.restore(undo!.id)?.score).toBe(30);
  });

  it("passes a restored save through onRestore", () => {
    const { vault } = setup({ onRestore: (s) => ({ ...s, name: "restored" }) });
    vault.write({ score: 7, name: "a" });
    vault.load();
    expect(vault.restore(vault.points()[0].id)?.name).toBe("restored");
  });

  it("returns null for a point that doesn't exist", () => {
    const { vault } = setup();
    expect(vault.restore("nope")).toBeNull();
  });

  it("lets go of the oldest points when the device runs out of room", () => {
    const save = { score: 1, name: "x".repeat(300) };
    const { vault, clock } = setup({}, 1500);
    for (let day = 0; day < 4; day++) {
      vault.write({ ...save, score: day + 1 });
      vault.load();
      clock.t += DAY;
    }
    const points = vault.points();
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThan(4);
    expect(points[0].summary).toBe(4);
  });

  it("reports a write the device refused", () => {
    const { vault } = setup({}, 10);
    expect(vault.write({ score: 1, name: "a" })).toBe(false);
  });

  it("survives a damaged list of points", () => {
    const { vault, items } = setup();
    items.set(POINTS, "{{{");
    vault.write({ score: 2, name: "a" });
    expect(vault.load().status).toBe("ok");
    expect(vault.points()).toHaveLength(1);
  });
});
