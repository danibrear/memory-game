import { describe, expect, it } from "vitest";
import type { StorageLike } from "~/storage/saveVault";
import { createGame, toSave } from "./engine";
import pass1 from "./fixtures/pass1-first-release.json";
import pass1b from "./fixtures/pass1-trophies-mythics.json";
import pass2 from "./fixtures/pass2-missions-decor.json";
import pass4 from "./fixtures/pass4-groves-levels-idle.json";
import pass5 from "./fixtures/pass5-minigames.json";
import pass6 from "./fixtures/pass6-home-town.json";
import pass7 from "./fixtures/pass7-save-vault-fanscout.json";
import { RARE } from "./config";
import { createEggsVault, DEFAULT_SAVE, SAVE_VERSION, summarize, type Save } from "./saves";

/**
 * One saved game per past version of Sneaky Eggs. Each was written by that
 * version's own `toSave` (checked out from git history), with some progress
 * filled in: coins, seven pets, upgrades, a hatching egg.
 *
 * When the shape of a save changes, add a fixture written by the version
 * before the change. These files are never edited afterwards.
 */
const FIXTURES: [string, unknown][] = [
  ["first release (7c61ba0)", pass1],
  ["trophies and Mythics (b27f55b)", pass1b],
  ["missions and decorations (50af70c)", pass2],
  ["groves, levels and idle (d4982a0)", pass4],
  ["mini games (225a86b)", pass5],
  ["home town (3b4af8a)", pass6],
  // The last version before Uncommon was added, and the first fixture stamped with a version (1).
  ["save vault and the FanScout ad (b8baf62)", pass7],
];

const MAIN = "memory-game-storage-sneaky-eggs";

function memory() {
  const items = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  };
  return { items, storage };
}

describe("Sneaky Eggs saves", () => {
  describe.each(FIXTURES)("a save from %s", (_name, fixture) => {
    const text = JSON.stringify(fixture);
    const old = fixture as Save;

    it("opens with everything the player had", () => {
      const { items, storage } = memory();
      items.set(MAIN, text);
      const found = createEggsVault(storage).load();

      expect(found.status).toBe("ok");
      const save = found.save!;
      expect(save.skin).toBe(old.skin);
      expect(save.game!.coins).toBe(54321);

      const g = createGame(save.game, { giant: save.giant, cozy: save.cozy });
      expect(g.coins).toBe(54321);
      expect(g.pets.map((p) => p.id)).toEqual(old.game!.pets.map((p) => p.id));
      // The first pet was the special one: Shiny in the oldest saves, Golden and Big later.
      expect(g.pets[0].v).toBeGreaterThan(0);
      expect(g.book).toEqual(old.game!.book);
      // Every fixture so far has a Rare egg hatching, saved when Rare was numbered 1.
      expect(g.pads[0].egg).toEqual({ biome: 0, rarity: RARE });
      for (const [id, level] of Object.entries(old.game!.up)) {
        expect(g.up[id as keyof typeof g.up]).toBe(level);
      }
      expect(g.level).toBe(old.game!.level ?? 1);
      // Opening a save can pay stars for trophies its progress has already earned.
      expect(g.stars).toBeGreaterThanOrEqual(old.game!.stars ?? 0);
      expect(g.feathers).toBe(old.game!.feathers ?? 0);
      expect(g.home).toEqual(old.game!.home ?? []);
      expect(g.town.house).toBe(old.game!.town?.house ?? 0);
    });

    it("is kept as a restore point exactly as it was found", () => {
      const { items, storage } = memory();
      items.set(MAIN, text);
      const vault = createEggsVault(storage);
      vault.load();
      const [point] = vault.points();
      expect(point.data).toBe(text);
      expect(point.summary).toMatchObject({ pets: 7, found: 7, coins: 54321 });
    });

    it("writes back in the current version without losing anything", () => {
      const { items, storage } = memory();
      items.set(MAIN, text);
      const vault = createEggsVault(storage);
      const save = vault.load().save!;
      const g = createGame(save.game);
      vault.write({ ...save, game: toSave(g) });

      const stored = JSON.parse(items.get(MAIN)!);
      expect(stored.v).toBe(SAVE_VERSION);
      expect(stored.build).toBe("test-build");
      const again = createEggsVault(storage).load();
      expect(again.status).toBe("ok");
      expect(summarize(again.save!)).toEqual(summarize(save));
    });
  });

  it("renumbers egg rarities once, for saves from before Uncommon existed", () => {
    const { items, storage } = memory();
    items.set(MAIN, JSON.stringify(pass7));
    const vault = createEggsVault(storage);
    const save = vault.load().save!;
    expect(save.game!.pads[0]).toMatchObject({ rarity: RARE });

    // Written back at the current version, it must not move a second time.
    vault.write(save);
    const again = createEggsVault(storage).load().save!;
    expect(again.game!.pads[0]).toMatchObject({ rarity: RARE });
  });

  it("fills in settings an old save never had", () => {
    const { items, storage } = memory();
    items.set(MAIN, JSON.stringify(pass1));
    const save = createEggsVault(storage).load().save!;
    expect(save.music).toBe(DEFAULT_SAVE.music);
    expect(save.cozy).toBe(false);
    expect(save.giant).toBe(false);
  });

  it("opens a settings-only save (no game started yet) without taking a point", () => {
    const { items, storage } = memory();
    items.set(MAIN, JSON.stringify({ ...DEFAULT_SAVE, skin: "x", muted: true }));
    const vault = createEggsVault(storage);
    const found = vault.load();
    expect(found.status).toBe("ok");
    expect(found.save!.muted).toBe(true);
    expect(vault.points()).toEqual([]);
  });

  it("skips pets it no longer knows instead of failing", () => {
    const { items, storage } = memory();
    const save = structuredClone(pass5) as Save;
    save.game!.pets.push({ id: "a-pet-that-was-removed" });
    items.set(MAIN, JSON.stringify(save));
    const found = createEggsVault(storage).load();
    expect(found.status).toBe("ok");
    expect(createGame(found.save!.game).pets).toHaveLength(7);
  });

  it("falls back to a restore point when the save is damaged", () => {
    const { items, storage } = memory();
    let t = new Date(2026, 10, 14, 18, 0).getTime();
    const vault = createEggsVault(storage, () => t);
    items.set(MAIN, JSON.stringify(pass5));
    vault.load();

    t += 24 * 60 * 60 * 1000;
    const damaged = structuredClone(pass5) as unknown as { game: { pets: unknown } };
    damaged.game.pets = "oops";
    items.set(MAIN, JSON.stringify(damaged));

    const found = vault.load();
    expect(found.status).toBe("recovered");
    expect(found.save!.game!.pets).toHaveLength(7);
    // Away earnings are not paid for the time since the point was taken.
    expect(found.save!.lastSeen).toBe(t);
  });

  it("refuses a save whose egg pads make no sense", () => {
    const { items, storage } = memory();
    const damaged = structuredClone(pass5) as unknown as { game: { pads: unknown[] } };
    damaged.game.pads[0] = { biome: 0, rarity: 99, left: 5 };
    items.set(MAIN, JSON.stringify(damaged));
    expect(createEggsVault(storage).load().status).toBe("broken");
  });

  it("keeps the game when starting over, and brings it back on request", () => {
    const { items, storage } = memory();
    items.set(MAIN, JSON.stringify(pass5));
    const vault = createEggsVault(storage);
    vault.load();
    vault.write({ ...(pass5 as Save), lastSeen: 5 });
    vault.reset();
    expect(vault.load().status).toBe("empty");

    const point = vault.points().find((p) => p.kind === "reset")!;
    const back = vault.restore(point.id)!;
    expect(back.game!.pets).toHaveLength(7);
    expect(back.game!.coins).toBe(54321);
  });
});
