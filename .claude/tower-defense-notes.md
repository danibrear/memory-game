# Tower Defense — feature notes

Route: `/towerdefense`. A maze-building tower defense (enemies re-route around
whatever you build) that now plays out on five different battlefields.

## What it borrows from popular games

| Idea | Seen in | How it works here |
| --- | --- | --- |
| Build anywhere, enemies path around you | Fieldrunners, Desktop TD | Flow field, already in v1 |
| Maps that restrict where you build | Bloons TD 6, Kingdom Rush | Water, rocks, no-build roads and bridges |
| Line-of-sight blockers | Bloons TD 6 | Rocks and rubble hide enemies from Blaster, Frost and Sniper |
| Removable obstacles | Bloons TD 6 | Rubble: pay gold, get open ground (walkable too) |
| High ground | Rogue Tower, BTD6 "Tree Stump" | Hilltops give +25% range |
| Several entrances, some opening later | Fieldrunners, BTD6 | Portals A/B/C with `lateEntries` |
| Flying enemies that ignore the maze | Fieldrunners | Flutter: straight line to the castle, Bombers can't hit it |
| Enemies that split | Bloons | Blobble bursts into two Blips |
| Targeting priorities | Bloons TD 6 | First / Last / Strong / Close per tower |
| Stars for lives kept, difficulty levels | Kingdom Rush | 3 stars at 90% lives, 2 at 50% |
| Keep playing after you win | BTD6 freeplay | Endless mode with generated waves |

## Files

- `app/games/towerdefense/config.ts` — all data: terrain rules, difficulties,
  the five maps, enemies, towers, the 20 scripted waves and the endless wave
  generator (`waveDef(index)`).
- `app/games/towerdefense/engine.ts` — pure simulation. `createGame(map, difficulty)`,
  `step`, `placeTower`, `clearRubble`, `setTargeting`, `continueEndless`,
  `hasSight`, `coverageOutline`.
- `app/games/towerdefense/sprites.ts` — all canvas art. Themes (one palette per
  map), terrain tiles, portals, castles, enemies, `renderFrame`, plus
  `drawMapThumb` and `drawTerrainSwatch` for the menu.
- `app/games/towerdefense/audio.ts` — WebAudio blips (added `clear`, `portal`).
- `app/routes/towerdefense.tsx` — `MapSelect` (menu), `Battle` (the game),
  `TowerPanel`, `RubblePanel`. Wrapped in the Game Kit `GameShell`.
- `app/styles/towerdefense.css` — `td-*` classes for the menu, stars and result
  card, loaded through the route's `links` export.

## Adding a map

Add an entry to `MAPS` in `config.ts`: 11 rows of 20 characters.

```
.  open ground     ^  hilltop      =  road / bridge (walk, no build)
~  water           #  rocks        %  rubble (clearable)
A B C  portals (on a board edge)   X Y  castles (anywhere)
```

`lateEntries: { B: 5 }` keeps portal B shut until wave 5. `parseMap` throws if
the grid is the wrong size, and the game refuses any build that would cut a
portal off from every castle (including portals that haven't opened yet).
A road tile with water on two opposite sides is drawn as a wooden bridge.
Each map picks a `theme` (palette) from `THEMES` in `sprites.ts`.

## Rules worth remembering

- Every buildable tile is also walkable, so selling a tower can never strand an enemy.
- Flyers are always visible (they're above the rocks) and are ignored by
  placement checks and bomb blasts.
- Medic auras don't stack: several Medics heal no faster than one.
- A tower's sight check is skipped when nothing opaque is within its range
  (`clearView`), and is otherwise only run for the best candidate target.
- The cached board canvas is redrawn whenever `routeVersion` changes (tower
  placed/sold, rubble cleared, a wave starts, a portal opens).

## Balance (2026-11-14)

Tuned with headless bot playthroughs, not yet by a person:

- Easy: a bot that never builds a maze wins the first three maps.
- Normal: bots without a planned maze die around waves 17–20; a scripted
  serpentine maze with a mix of Snipers and Bombers wins Green Meadow with
  5–10 lives left.
- Hard: no bot wins. Expect to need a tight maze and good targeting.

Knobs: `DIFFICULTIES` (hp, speed, lives, gold), each wave's `baseHp`, each
map's `startGold`. Compared with v1, wave health now ramps much harder late
on (wave 20 base health 1000 → 2100) and the Sniper was toned down
(it used to out-damage everything from across the map).

## Storage

- `tower-defense` (via `~/storage`): `{ difficulty, stars: { [mapId]: { easy, normal, hard } }, endless: { [mapId]: bestWave } }`
- `td-muted` (plain localStorage): `"1"` when sound is off.

## Ideas for next passes

1. Final-tier upgrade choice: at level 3 pick one of two specialisations per
   tower (Kingdom Rush style).
2. Player abilities on a cooldown: a meteor strike and a freeze (Kingdom Rush spells).
3. A hero unit you can move around, or barracks soldiers that block the path.
4. Map events mid-battle: a bridge that collapses on wave 10, a flood that
   swallows a row, a rockslide that opens a shortcut.
5. Unlocks and a campaign order, plus a per-map challenge ("no Snipers",
   "half gold") for extra stars.
6. Camo / shielded enemies and a detector tower.
7. Phone layout: bigger cells with a pannable board, or a portrait-shaped map.
8. A map editor that saves to localStorage.
