# Save safety net (step 1 of cloud save)

Built November 15, 2026. The full plan (save code, opt-in cloud backup, play on
any device) is in the project doc `claude/cloud-save-plan.md`. This is step 1:
everything stays on the device, and nothing about the site's wording changes.

## What it protects against
- **A game update that mishandles an old save.** Saves now carry a version, and
  a saved game from every past pass is loaded in a test.
- **A save that can't be read.** It is copied aside, never overwritten, and the
  newest restore point that still opens is brought back. Before, the game
  quietly started fresh and the next autosave wrote over the old save.
- **"Start over" by mistake.** The cleared game is kept as a restore point.
- **A bad day.** The first load of each day keeps a copy of the save as it was.

It does **not** protect against the browser's storage being cleared (by the
player, or by Safari after seven days of Safari use without a visit). Restore
points live in the same storage. That is what step 2 (cloud backup) is for.

## Files
- `app/storage/saveVault.ts`: the vault. Knows nothing about any game, so
  another game can use it by writing its own small config.
- `app/games/eggs/saves.ts`: Sneaky Eggs' `Save` type, `SAVE_VERSION`,
  `MIGRATIONS`, the check (the engine must be able to build a game from the
  save) and the summary shown on a restore point.
- `app/routes/eggs.tsx`: loads through the vault, writes through it, and has
  the "Saved games" dialog and the save notes on the title screen.
- `app/styles/eggs.css`: `.se-save` and `.se-save-note`. The dialog reuses the
  shop's `.se-menu`, `.se-list` and `.se-row`.
- `vite.config.ts`: defines `__APP_BUILD__` (Amplify's `AWS_COMMIT_ID`, else the
  build time, else "dev").
- Tests: `app/storage/saveVault.test.ts`, `app/games/eggs/saves.test.ts`,
  fixtures in `app/games/eggs/fixtures/`. Run with `npm test`.

## Storage entries
All in `localStorage`, all prefixed `memory-game-storage-`:
- `sneaky-eggs`: the save, same flat shape as before plus `v` and `build`. Old
  code can still read it, so rolling a deploy back is safe.
- `sneaky-eggs-backups`: `{ points: [{ id, t, kind, summary, data }] }`. `data`
  is the save text exactly as it was found, before any migration.
- `sneaky-eggs-broken`: `{ t, build, raw }`, the last save that couldn't be
  opened. Nothing reads it; it is there for debugging.

## Restore points
| Kind | Taken when | Kept |
|---|---|---|
| `daily` | The first load of a day | 5 |
| `update` | A later load the same day, if the build changed | 3 |
| `reset` | "Start over" | 2 |
| `restore` | Just before a restore, so it can be undone | 1 |

A point is only taken when there is a game in the save, and not when the save
is identical to the newest point. If the device runs out of room, the oldest
points are dropped first. A restored save has `lastSeen` set to now, so
"while you were away" coins aren't paid for the gap.

## Changing the shape of a save
1. A new optional field with a default in `createGame` needs nothing.
2. Anything else: bump `SAVE_VERSION`, add a step to `MIGRATIONS`
   (`MIGRATIONS[n]` turns version n into n + 1), and add a fixture written by
   the version before the change to `saves.test.ts`. Fixtures are never edited.

The six fixtures were written by each past version's own `toSave` (checked out
from git: `7c61ba0`, `b27f55b`, `50af70c`, `d4982a0`, `225a86b`, `3b4af8a`) with
some progress filled in.

"Start over" keeps the house and buildings (`startOverSave`), so after it the
save holds a town-only game. The game as it was before is the `reset` point.

## What the player sees
- "Saved games" on the title screen once there is at least one restore point.
  Each row shows the day, level, pets, coins, the time and why it was taken.
  "Go back" asks once more before swapping.
- "Start over" now says the game can be brought back from Saved games.
- A note on the title screen after a recovery, a failed load, a restore, or a
  start over.

## Not done here
- Asking the browser for persistent storage (`navigator.storage.persist()`):
  Firefox shows a permission prompt for it, which would confuse a child.
- Export to a file. Step 2's save code covers moving a save between devices.
