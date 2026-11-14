# Cascade (Quadra) polish pass — 2026-11-14

Files: `app/routes/quadra.tsx`, `app/app.css` (section "CASCADE (QUADRA) GAME", `cascade-*` classes; old `quadra-*` classes removed).

## Feel / gameplay
- 7-bag randomizer, 3-piece Next queue, Hold (C / Shift / on-screen button, once per piece).
- Lock delay: 500ms grace after touchdown, extended by moves/rotations up to 15 times.
- Rotate both ways (↑/X and Z/Ctrl) with wall + floor kicks.
- Cascades are animated: rows flash and pop (280ms, matches CSS), then piece groups fall one row
  per 45ms step, then the board re-checks for the next chain link. Scoring is per chain step.
- Start screen, resume-from-save lands on Pause (no surprise auto-start), auto-pause when tab hidden.
- Best score persisted (`quadra-best-score`); save format is backward compatible.

## Visuals
- Dark arcade "cabinet" shell, grid playfield, joined-piece blocks with outer-edge bevels + candy tile highlight.
- Ghost piece outline, active-piece glow, lock flash, hard-drop bump, red danger pulse when stack hits top 4 rows.
- Popups: Single/Double/Triple/Quad!, Chain ×N!, Level up. Game over shows score, NEW BEST badge, level/lines/best chain.

## Mobile fixes
- Gestures now only on the board (previously tapping ◀/▶ also rotated).
- Buttons use pointer events (previously touchstart + click double-fired); hold-to-repeat with DAS on move/soft drop only.
- Drag to slide by cells, tap to rotate, flick down to hard drop.

## Ideas for later
- Sound effects (clear, chain, drop), haptics via `navigator.vibrate` on mobile.
- Chain-specific particle burst / screen flash for ×3+.
