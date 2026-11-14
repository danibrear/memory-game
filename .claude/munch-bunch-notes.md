# Munch Bunch — feature notes

Original take on the "Food Hunt" style color-clearing puzzle. Route: `/munch`.

## How it plays
- A pixel picture is made of glossy cubes. Munchies wait in 4 queue columns; tapping a
  column sends its front Munchy to one of 5 munch spots.
- A Munchy eats cubes of its color, one at a time, but only cubes with nothing left
  beneath them in their column ("from the bottom up").
- If every spot holds a Munchy that can't reach its color, the round is stuck.
  One "Extra Spot" per level adds a 6th spot.
- Stars: 3, minus 1 for ever filling every spot, minus 1 for using the Extra Spot.

## Files
- `app/games/munch/levels.ts` — palette + 22 pixel pictures (letter grids). Adding a
  picture is one entry; order is roughly easy → hard.
- `app/games/munch/engine.ts` — pure logic (`buildRun`, `dispatch`, `step`, `starsFor`).
  Munchy sizes and queue "messiness" ramp with level index (capped at 16), then get a
  bump each time the player loops through all pictures (★ suffix on the name).
- `app/games/munch/render.ts` — cached glossy cube sprites, board + flying-cube drawing.
- `app/games/munch/audio.ts` — WebAudio blips, no assets.
- `app/routes/munch.tsx` — UI built on the shared Game Kit (`GameShell`, `StartScreen`,
  `WinScreen`, `KitDialog`, `KitButton`, `StatPill`, `Stars`).
- `app/game-kit.css` — `mb-*` section (Munchy critters are pure CSS).

## State
- Mutable run state lives in a ref; the rAF loop calls `step()` and only re-renders
  React when something visible changes (`ev.dirty`).
- Storage key `munch-bunch` (via `~/storage`): `{ level, muted, stars: { [levelIndex]: best } }`.

## Motion (added 2026-11-14)
- The picture builds itself for the first `BUILD_MS` of a level: `drawBoard`
  takes `sinceStartMs` and pops cubes in from the bottom row up.
- Sending a Munchy: `sendFrom` records where that column's Munchies are
  (`pendingSend`), and a layout effect then hops the sent one along an arc to
  its spot (`hopFrames`, `HOP_MS`) and slides the rest of the queue forward.
  Every Munchy on screen registers in `munchyEls` via `trackEl(id)`.
- The first bite lands about 590ms after a send (160ms cooldown + 430ms
  flight), so keep the hop shorter than that.

## Ideas
- Level-select screen with picture thumbnails and best stars.
- Let kids draw their own picture in the Color Game and play it here.
