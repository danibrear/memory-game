# Game Kit — shared UI for the classic games

The Color, Match and Memory games share one polished UI kit so they look like
one family of casual mobile games (chunky 3D buttons, glossy tiles, confetti).

## Files
- `app/components/game/GameKit.tsx` — React building blocks:
  `GameShell`, `StartScreen`, `Panel`, `KitButton`, `Stepper`, `ChoiceGroup`,
  `StatPill`, `Banner`, `Stars`, `Confetti`, `WinScreen`, `KitDialog`, `getGame`.
- `app/game-kit.css` — all styles (imported once in `root.tsx`).
  `dg-*` = shared kit, `cg-*` = Color, `mg-*` = Match, `mm-*` = Memory.

## Motion building blocks (added 2026-11-14)
All in `GameKit.tsx`; CSS in the `dg-*` part of `game-kit.css`.
- `StatPill` pops its value whenever the text changes. Pass `bump={false}` if
  the content animates itself (Bubble Pop's score does).
- `<Bump>` wraps any other number that should pop on change (Match 2-player
  scores, Ball Sort moves). `useBump(value)` is the hook underneath.
- `<CountUp value={n} />` counts up from 0. Use it for numbers on win screens.
  It has no children, so it never triggers a `StatPill` bump while counting.
- `useDealIn(ref, dealKey, { cols })` deals a board in. Bump `dealKey` (a
  counter in state) when a fresh board starts. Pass `cols` for a diagonal wave,
  or `selector` when the items aren't direct children (Ball Sort tubes).
- `WinScreen` children rise in one after another (nth-child delays, 70ms
  apart). The icon, stars and banners keep their own entrances.
- `dgWave` keyframes + an `is-winning` class on the board give the victory
  wave; each item sets its delay with a `--wave` custom property.
- `prefersReducedMotion()` guards everything done in script.

Rule of thumb: entrances and one-off moves that share an element with CSS
animations (shake, match pop) use the Web Animations API (`el.animate`), so
removing a class later can't replay them. State-driven loops stay in CSS.

## How theming works
`GameShell` reads the game's colors from `gameCatalog.ts` and sets
`--g-from` / `--g-to` on the wrapper; every button, chip and highlight uses
those vars, so a game's look changes by editing its catalog entry.
Dialogs portal outside the shell, so `KitDialog` re-applies the vars.
Light/dark follows `prefers-color-scheme` via tokens in `.dg-vars`.

## Storage keys
- Color: `color-game-state-v2` (palette indices; the old v1 hue format is ignored)
- Match: `match-game-state` (adds `players`, `tries`, `matchedBy`; still reads old saves)
- Memory: `memory-game-state` (same shape as before) + `memory-game-best`

## Cleanup
The old `.match-*` and `.memory-card*` rules in `app/app.css` are no longer used
and can be deleted.
