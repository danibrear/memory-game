# Hole Drop — hole.io-style overhaul

Rebuilt from scratch (Nov 2026). The old Phaser + Matter version is gone; this is
plain Canvas 2D, same module layout as Tower Defense.

## Files
- `app/games/hole/config.ts` — all tuning: camera tilt/perspective, city grid,
  size levels (`LEVEL_MASS`), object kinds (size → fit radius → points), skins,
  rival names/colors, modes, solo star thresholds.
- `app/games/hole/world.ts` — seeded city generator: 7 block types (downtown,
  office, shops, plaza, park, parking, houses), sidewalks, roads with traffic.
- `app/games/hole/engine.ts` — simulation: hole movement, AI rivals, holes eating
  holes, objects tipping in, people panicking, respawns, camera.
- `app/games/hole/render.ts` — 2.5D renderer (oblique projection + perspective
  lean), shadows, hole clipping for the falling effect, LOD batching for far-away
  small objects.
- `app/games/hole/audio.ts` — WebAudio synth sfx (no audio files).
- `app/routes/hole.tsx` — menu (name, 9 skins incl. rainbow, 3 modes), HUD,
  countdown, toasts, pause, results with confetti.

## Gameplay
- Classic: 2:00 vs 7 AI holes, ranked by points. Bigger holes (1.2x) can gobble
  smaller ones; the victim respawns in ~2.6s at half size but keeps its points.
- Solo: 2:00 alone, stars at 25/50/80% of the city eaten.
- Chill: no timer, no rivals, ends when the city is empty (or "I'm done!").
- An object fits when `fit * 1.05 <= hole radius`. Too-big things wobble and show 🔒.
- Arrow at the screen edge points to food when nothing edible is nearby.

## Kid-friendliness knobs
- Rival speed: `h.skill` in `createGame` (0.72–0.90) and the 16% "distracted"
  roll in `thinkAI`. Rivals chase the player at 0.45x interest.
- Growth speed: `LEVEL_MASS` and `valueFor` in config.
- A perfect bot ends Classic around 11k vs the best rival ~4k, so a kid playing
  at half speed is competitive for 1st.

## Controls
Mouse = hole follows the cursor (hole.io desktop style); touch = floating
joystick anywhere; arrows/WASD; Esc/P pauses.
Last-used control wins (`inputModeRef`): pressing an arrow switches to keys and
the resting cursor is ignored (no arrow held = hole stops); moving the mouse
more than ~4px switches back to mouse steering.

## Storage keys
`hole-settings` (name, skin, mode, muted), `hole-best-v2` (best per mode).
The old `hole-drop-best` key is no longer read.

## Perf
Renderer culls to the view and batches small far objects into a few fills.
The route lowers canvas resolution automatically if frames run slow.

## Smoothness (jitter fix)
- Loop advances by the real frame time in ≤1/60s sub-steps (no fixed-step
  accumulator, which ran 0 or 2 steps on some frames and stuttered at speed).
- Camera is locked to the player; it only glides for big jumps (respawn).
  The old lagging camera also fed back into mouse steering and pumped the speed.
- HUD lives in `HudView` behind a tiny store (`useSyncExternalStore`) and only
  re-renders when a shown value changes, so the page around the canvas no longer
  re-renders 10x/second.
- Phaser isn't needed: the bottleneck was frame timing, not drawing speed.

## Hole.io polish pass
- Growth is mostly discrete now (22% creep inside a level, big jump on level-up)
  and the radius is a spring (`h.rv`), so size-ups pop with a little overshoot.
- "NEW FOOD UNLOCKED" card when the player first fits a new kind (`unlock`
  event, `kindMinFit` per city, labels in `UNLOCK_LABELS`).
- Objects topple: things hanging over the rim lean in (`o.pull`), big ones
  balance on the rim for a beat (`falling.teeter`), then tip toward the hole
  center while sinking (render foreshortens height via `View.hs/zb`).
- Rim pulses as things drop in (`h.pulse`).
- Contact shadows under buildings/vehicles, lit gradient faces on tall
  buildings, soft vignette, intro camera swoop during the 3-2-1.
- Gobble feed on the left, podium on the Classic results screen.
- Solo stars lowered to 20/40/65%.
