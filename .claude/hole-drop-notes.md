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

## Storage keys
`hole-settings` (name, skin, mode, muted), `hole-best-v2` (best per mode).
The old `hole-drop-best` key is no longer read.

## Perf
Renderer culls to the view and batches small far objects into a few fills.
The route lowers canvas resolution automatically if frames run slow.
