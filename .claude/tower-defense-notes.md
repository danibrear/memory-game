# Tower Defense — feature notes

Route: `/towerdefense`. A maze-building tower defense (enemies re-route around
whatever you build) played over 30 waves on seven battlefields.

## What it borrows from popular games

| Idea | Seen in | How it works here |
| --- | --- | --- |
| Build anywhere, enemies path around you | Fieldrunners, Desktop TD | Flow field |
| Maps that restrict where you build | Bloons TD 6, Kingdom Rush | Water, rocks, no-build roads and bridges |
| Line-of-sight blockers | Bloons TD 6 | Rocks and rubble hide enemies from Blaster, Frost and Sniper |
| Removable obstacles | Bloons TD 6 | Rubble: pay gold, get open ground (walkable too) |
| High ground | Rogue Tower | Hilltops give +25% range |
| Several entrances, some opening later | Fieldrunners, BTD6 | Portals A/B/C with `lateEntries` |
| Flying enemies that ignore the maze | Fieldrunners | Flutter |
| Enemies that split | Bloons | Blobble → two Blips |
| Targeting priorities | Bloons TD 6 | First / Last / Strong / Close per tower |
| Stars for lives kept, difficulty levels | Kingdom Rush | 3 stars at 90% lives, 2 at 50% |
| Freeplay after winning | BTD6 | Endless mode with generated waves |
| Pick one of two top-tier upgrades | Kingdom Rush | Final forms at level 3 (pass 2) |
| Hidden enemies that need detection | BTD6 camo + Monkey Village | Shade + Beacon (pass 2) |
| Support aura building | BTD6 Monkey Village | Beacon: fire rate, range, jam shield (pass 2) |
| Income building | BTD6 Banana Farm | Gold Mine, max 3 (pass 2) |
| Player spells on cooldown | Kingdom Rush | Meteor and Cold Snap (pass 2) |
| Map that changes as you play | Rogue Tower, Terrorformer TD | Timed floods and rockslides (pass 2) |

## Files

- `app/games/towerdefense/config.ts` — all data: terrain, difficulties, maps
  (and their timed events), enemies, towers with their two final forms,
  abilities, the 30 scripted waves and the endless generator (`waveDef`).
- `app/games/towerdefense/engine.ts` — pure simulation. Main entry points:
  `createGame`, `step`, `placeTower`, `upgradeTower`, `chooseSpec`, `sellTower`,
  `clearRubble`, `setTargeting`, `castMeteor`, `castFreeze`, `continueEndless`.
- `app/games/towerdefense/sprites.ts` — all canvas art and `renderFrame`.
- `app/games/towerdefense/audio.ts` — WebAudio blips.
- `app/routes/towerdefense.tsx` — `MapSelect`, `Battle`, `TowerPanel`, `RubblePanel`.
- `app/styles/towerdefense.css` — `td-*` classes (menu, abilities, final-form chooser).

## Adding a map

Add an entry to `MAPS` in `config.ts`: 11 rows of 20 characters.

```
.  open ground     ^  hilltop      =  road / bridge (walk, no build)
~  water           #  rocks        %  rubble (clearable)
A B C  portals (on a board edge)   X Y  castles (anywhere)
```

- `lateEntries: { B: 5 }` keeps portal B shut until wave 5.
- `events: [{ wave, kind: "flood" | "slide", label, to, cells }]` turns tiles
  into another terrain as that wave starts. `rect(r0, c0, r1, c1)` builds the
  cell list. Towers on tiles that stop being buildable are refunded in full.
- Pick a `theme` from `THEMES` in `sprites.ts`.

## Rules worth remembering

- Every buildable tile is walkable, so selling a tower never strands an enemy.
- A build is refused if it would cut any portal off from every castle, now
  **or after any event still to come** (`futureBlock`). That is what keeps a
  flood from ever sealing the map.
- Selling a tower or clearing rubble while walkers are alive gives them all
  +20% speed for good (`ALARM_HASTE`). It kills the "juggling" exploit of
  opening and closing a maze to march a wave back and forth.
- Beacon bonuses don't stack: a tower takes the best rate, best range and any
  shield from the Beacons that reach it (`auraAt`, `refreshAuras`).
- Shades can only be targeted inside a Beacon's light (or by a Marksman).
  Splash damage, burn and the meteor hit them regardless.
- Jinx pulses switch towers off for 2.4s within 2.3 cells. Towers further
  away, or inside a Lighthouse, are safe.
- Ragers ignore slows and freezes and speed up as they lose health.
- Bosses hatch escorts on a timer. Escorts have half health and pay no gold,
  so stalling a boss is not a gold farm.
- Gold Mines pay when a wave starts, from the wave after they were built.
- Medic auras don't stack. Flyers are always visible and immune to bombs.
- The cached board canvas is redrawn whenever `routeVersion` changes.

## Balance (2026-11-14, pass 2)

Tuned with headless bot playthroughs, not yet by a person. The bot uses final
forms, Beacons, mines and abilities, but only builds short mazes (paths of
30–40 cells) and plays the two-portal maps and Rockslide Pass badly.

| Difficulty | Health | Lives | Bot result |
| --- | --- | --- | --- |
| Easy | ×0.75 | 25 | Wins the four open maps with 20+ lives |
| Normal | ×1.15 | 20 | Dies on waves 26–29 |
| Hard | ×1.45 | 10 | Dies on waves 12–18 |
| Brutal | ×1.75 | 3 | Dies on waves 7–18 |

Nobody, human or bot, has beaten Hard or Brutal yet, so they may need
loosening. Knobs: `DIFFICULTIES`, each wave's base health (first number in
`wave(...)`; it grows 20% a wave from wave 15), `startGold` per map, and
`ENEMIES[...].hpMult`.

## Battle screen layout (2026-11-15)

- The top bar (map, gold, lives, wave, speed, pause, sound, Start) is
  `position: sticky` just under the site nav (`HUD_TOP = NAV_HEIGHT + 8`), so
  it follows the player down to the shop. It needs every ancestor to stay
  free of `overflow: hidden/auto` (`.dg-shell` uses `overflow-x: clip`, which
  is fine). `z-index: 30` keeps it over the board's overlays (confetti is 20,
  the result card 21) and under the nav (1000).
- A 1px marker above the bar plus an `IntersectionObserver` sets `hudStuck`,
  which only deepens the bar's shadow while it floats over the board.
- On screens under 520px tall (a phone on its side) the bar is not sticky: it
  would hide too much of the board.
- Speed, pause, sound, Auto and Start sit in one flex group (`ml: auto`), so
  on a narrow screen they wrap to a second row together, right-aligned. On a
  phone the group takes the whole row and Start grows to fill it.
- The Start button is 44px tall, reads "Start", then "Start wave N" ("Wave N"
  on phones), and "Send next" during a wave. While the game is waiting on the
  player (`phase === "build"`) it gets `.td-start.is-waiting`, a ring that
  ripples out (`tdStartRing`, off under reduced motion).

## Auto-start (2026-11-15)

- The "Auto" switch sits next to Start in the top bar (key `A`), is off by
  default and is remembered on the device (`td-auto`).
- With it on, once a wave is cleared (`phase === "build"`, `wave > 0`) the game
  loop counts `AUTO_START_DELAY` (5) real seconds and then calls `startWave`.
  The count takes the play icon's place on the Start button
  (`.td-start-count`), so the button does not change width.
- The first wave never auto-starts, pausing (or the "Leave this battle?"
  dialog) holds the count, and tapping Start sends the wave straight away.
- It never sends a wave early while enemies are still on the board, and it
  keeps going in Endless mode.

## Storage

- `tower-defense` (via `~/storage`): `{ difficulty, stars: { [mapId]: { easy, normal, hard, brutal } }, endless: { [mapId]: bestWave } }`
- `td-muted` (plain localStorage): `"1"` when sound is off.
- `td-auto` (plain localStorage): `"1"` when auto-start is on.

## Ideas for next passes

1. A hero unit you move around, or barracks soldiers that block the path.
2. Campaign order with unlocks, plus per-map challenges ("no Snipers",
   "half gold") for extra stars.
3. More event kinds: a collapsing bridge, a portal that moves, lava that
   spreads.
4. Tower veterancy (kills make a tower stronger) and a per-tower kill count.
5. Phone layout: bigger cells with a pannable board.
6. A map editor that saves to localStorage.
7. Daily seeded challenge with a random map and wave mix.
