# Sneaky Eggs — feature notes

Original take on the "grab an egg from a guarded nest, run it home, hatch a pet"
loop that tops the Roblox charts (Nov 2026). Route: `/eggs`. All characters, names
and art are our own.

## How it plays
- Top-down world, one tall strip: Home at the bottom, then five lands going up
  (Sunny Meadow, Coral Beach, Frosty Peak, Candy Canyon, Starry Space).
- Each land has three nests and a sleeping Grumble. Touch a nest to grab its egg;
  the Grumble wakes after a short delay and chases you while you hold an egg in
  its land. If it catches you, the egg goes back and you're dizzy for a second.
  Nothing is ever lost — there is no fail state.
- Carry the egg past the gate and home: it flies to a nest pad and hatches after
  3–12s (tap it to hurry it up). Pets live in the pen and earn coins every second.
- One pet per land and rarity (5 × 4 = 20). Egg rarity is visible on the egg.
  The golden nest behind each Grumble rolls with +2 luck.
- Fuse 3 of the same pet into the next rarity up. Shiny pets (5%) earn 3×.
- Coins buy: Speedy Sneakers (gates open at Speed 3 / 6 / 10 / 14), Egg Basket
  (carry 2, then 3), Bigger Pen (8 → 20 pets), Lucky Clover (better egg odds).
- Finding all 20 shows the "Pet Master" win screen; you can keep playing.
- Pets keep earning at half speed for up to 10 minutes while you're away.

## Files
- `app/games/eggs/config.ts` — every tuning number: lands (colors, Grumble speed
  ratio and wake delay), the 20 pets and their looks, rarity odds, upgrade prices,
  world layout.
- `app/games/eggs/engine.ts` — pure simulation (`createGame`, `step`, `buy`,
  `fuse`, `sell`, `tapAt`, `toSave`). Emits events the route turns into sounds
  and messages.
- `app/games/eggs/render.ts` — Canvas 2D. `drawPet` draws every creature (pets,
  the player, Grumbles) from a `Look`, so a new pet is one config entry, no art.
  `paintPetIcon` / `paintEggIcon` reuse it for the menus.
- `app/games/eggs/audio.ts` — WebAudio blips, no assets.
- `app/routes/eggs.tsx` — screens on the shared Game Kit, HUD, dock, Shop / Pets /
  Pet Book dialogs, new-pet card, input (drag anywhere = joystick, arrows/WASD).
- `app/styles/eggs.css` — `se-*` styles, loaded through the route's `links`.
- `KitDialog` gained an optional `className` so menus can be roomier on phones.

## Kid-friendliness knobs (all in config.ts)
- `guardRatio` / `wake` per land: how fast each Grumble is next to a player with
  exactly the required sneakers, and how long it takes to get up. Lower ratio or
  longer wake = easier.
- `SPEED_COSTS`, `PEN_COSTS`, `LUCK_COSTS`, `BASKET_COSTS`: pacing.
- `rarityWeights`, `SHINY_CHANCE`, `FUSE_COUNT`, `TAP_BOOST`.

## iPad and touch
- Drag anywhere to steer; the newest finger always takes the joystick, so a
  missed finger-lift can never leave the player running on their own. A second
  finger can tap eggs while the first one steers.
- The stage blocks page scroll, pinch zoom, text selection and (best effort)
  Safari's edge swipe-back while playing; menu buttons use
  `touch-action: manipulation` so fast taps don't double-tap zoom.
- Tablets (shortest side 700px+) get a bigger joystick, HUD, dock and pointers.
- Stage height falls back to `vh` where `dvh` isn't supported (older iPadOS).
- The canvas drops resolution a notch if frames run slow.
- Sound resumes after iOS "interrupts" the audio (call, app switch).
- Tested with emulated touch in Chrome at 820x1180 and 1180x820. Not yet tested
  in real Safari on an iPad.

## Checked with bots (Nov 2026 numbers)
- Running straight from any nest to the gate at the required speed is always
  safe (closest approach 50+ px in every land). Dawdling ~1.5s gets you caught
  from the golden nest, and from any nest in the later lands.
- A bot that never stops opens Coral Beach in under a minute, Starry Space around
  minute 10, and fills the whole Pet Book in 15–18 minutes with ~90 eggs. Expect
  a child to take roughly three times that.

## State
- Storage key `sneaky-eggs` (via `~/storage`): `{ game, skin, muted, lastSeen }`
  where `game` is `SavedGame` (coins, upgrades, pets, book, eggs on pads, stats).
- Saved every ~5s while playing, after every purchase/fuse/sell, and when the tab
  is hidden.

## Ideas
- Name your pets; let a favorite pet follow you around.
- Seasonal lands (the catalog of looks makes a new land ~40 lines of config).
- Second player on the same keyboard racing for the same nests.
