# Game Kit — shared UI for the classic games

The Color, Match and Memory games share one polished UI kit so they look like
one family of casual mobile games (chunky 3D buttons, glossy tiles, confetti).

## Files
- `app/components/game/GameKit.tsx` — React building blocks:
  `GameShell`, `StartScreen`, `Panel`, `KitButton`, `Stepper`, `ChoiceGroup`,
  `StatPill`, `Banner`, `Stars`, `Confetti`, `WinScreen`, `KitDialog`, `getGame`.
- `app/game-kit.css` — all styles (imported once in `root.tsx`).
  `dg-*` = shared kit, `cg-*` = Color, `mg-*` = Match, `mm-*` = Memory.

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
