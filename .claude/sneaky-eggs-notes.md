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
- 25 pets: one per land and rarity (Common, Rare, Epic, Legendary) hatch from
  eggs; each land also has a Mythic that only comes from fusing 3 Legendaries.
  Egg rarity is visible on the egg. The golden nest behind each Grumble rolls
  with +2 luck. Shiny pets (5% and up) earn 3×.
- Fuse 3 of the same pet into the next rarity up.
- Finding all 20 egg pets shows the "Pet Master" win screen; you keep playing.
- Pets keep earning at half speed for up to 10 minutes while you're away.

## Second pass (Nov 14): everything added on top
**Two currencies.** Coins buy upgrades and home decorations. Stars come from
trophies, the gift chest, hidden stars and golden glitterbugs, and buy hats and
trails.

**Upgrades (9):** Speedy Sneakers, Zoom Dash (a ZOOM button / Space key: 0.9s
burst, cooldown shrinks per level), Egg Basket, Bigger Pen, Pet Treats (+25%
coins per level), Warm Nests (faster hatching), Lucky Clover, Sparkle Charm
(more shinies), Tiptoe Socks (Grumbles wake slower).

**Trophies (69).** Data-driven in `achievements.ts`: each is a number to reach
read straight off the game. Banners queue one at a time. Old saves get whatever
they've already earned in one quiet "welcome back" lump.

**Style.** 9 hats and 8 trails (Shop → Hats / Trails). The hat shows on the
title screen too.

**Home decorations (6).** Garden, balloon arch, fountain, slide, rainbow, golden
statue. Each adds +5% coins.

**Pets.** Tap a pet to pat it (hearts, a few coins, 6s cooldown each). Tap the
heart on a row in Pets to make that kind your buddy: it follows you around and
gives +1 luck. Tap a pet in the Pet Book for its card and how to get it.

**World.**
- Day and night (270s cycle, ~80s of night): lantern glow, fireflies, +1 luck,
  Grumbles wake 0.3s slower.
- Shooting stars at night: tap one for double coins for 30s.
- Glitterbugs flutter in every open land and burst into coins when caught; about
  1 in 12 is golden and worth a star.
- Mystery Eggs: every couple of minutes an Epic or Legendary egg appears in an
  open land for 50s, with a light beam and a compass arrow.
- Gift chest at home: coins and a star every 5 minutes of real time.
- Map (top-right, once Coral Beach is open): hop to any open land's gate. Not
  while carrying eggs.
- Scenery reacts when bumped: lollipops give a Sugar Rush, palms drop coconut
  coins, gumdrops bounce you, crystals chime, trees and snowmen rustle.
- Soft music loop that changes key and tempo per land (toggle on the title
  screen; the HUD mute button silences everything).

**Secrets** (most have a hidden trophy):
- A hidden star in a far corner of every land (+3 stars each).
- Pat a sleeping Grumble.
- Knock on the hut (walk into it) — every 5th knock pays coins.
- A flying saucer at the very top of Starry Space carries you (and your eggs) home.
- Stand still for 25s and you fall asleep.
- Ring three different crystals in a row.
- Tap the coin counter 10 times.
- Tickle the character on the title screen 7 times for Big Sneak mode.
- A star picture in Starry Space: the letter E and a heart, for Elliot. It is in
  `drawConstellation` in `render.ts` if you ever want to change or remove it.

## Files
- `app/games/eggs/config.ts` — every tuning number: lands, the 25 pets and their
  looks and blurbs, rarity odds, upgrade prices, hats, trails, decorations,
  day length, event timers, world layout.
- `app/games/eggs/achievements.ts` — the trophy list.
- `app/games/eggs/engine.ts` — pure simulation (`createGame`, `step`, and the
  actions: `buy`, `fuse`, `sell`, `dash`, `travel`, `wish`, `tapAt`, `tapWorld`,
  `setBuddy`, `buyHat`, `buyTrail`, `buyDecor`, `toSave`). Emits events the
  route turns into sounds and messages.
- `app/games/eggs/render.ts` — Canvas 2D. `drawPet` draws every creature (pets,
  the player, Grumbles, the statue) from a `Look`, so a new pet is one config
  entry, no art. `paintPetIcon` / `paintEggIcon` reuse it for the menus.
- `app/games/eggs/audio.ts` — WebAudio blips and the music loop, no assets.
- `app/routes/eggs.tsx` — screens, HUD, dock, input, game loop.
- `app/components/eggs/Menus.tsx` — Shop, Pets, Pet Book, Trophies and Map.
- `app/styles/eggs.css` — `se-*` styles, loaded through the route's `links`.
- `KitDialog` has an optional `className` so menus can be roomier on phones.

## Kid-friendliness knobs (all in config.ts)
- `guardRatio` / `wake` per land: how fast each Grumble is next to a player with
  exactly the required sneakers, and how long it takes to get up. Lower ratio or
  longer wake = easier.
- `COSTS` (all upgrade prices), `HOME_DECOR`, hat and trail star prices.
- `rarityWeights`, `SHINY_CHANCE`, `FUSE_COUNT`, `TAP_BOOST`, `CHEST_MS`,
  `MYSTERY_EVERY`, `DAY_LENGTH`.

## iPad and touch
- Drag anywhere to steer; the newest finger always takes the joystick, so a
  missed finger-lift can never leave the player running on their own. A second
  finger can tap eggs or ZOOM while the first one steers.
- A quick touch that doesn't travel is a tap (pat a pet, catch a star); eggs on
  the pads react the instant a finger lands.
- The stage blocks page scroll, pinch zoom, text selection and (best effort)
  Safari's edge swipe-back while playing; menu buttons use
  `touch-action: manipulation` so fast taps don't double-tap zoom.
- Tablets (shortest side 700px+) get a bigger joystick, HUD, dock, ZOOM button
  and pointers.
- Stage height falls back to `vh` where `dvh` isn't supported (older iPadOS).
- The canvas drops resolution a notch if frames run slow.
- Sound resumes after iOS "interrupts" the audio (call, app switch).
- Tested with emulated touch in Chrome at 820x1180 and 1180x820. Not yet tested
  in real Safari on an iPad.

## Checked with bots
- Running straight from any nest to the gate at the required speed is always
  safe (closest approach 50+ px in every land). Dawdling ~1.5s gets you caught
  from the golden nest, and from any nest in the later lands.
- A bot that never stops and buys everything it can opens Coral Beach in under a
  minute and Starry Space around minute 10. Expect a child to take roughly three
  times that; Mythics, trophies and decorations stretch well beyond.

## State
- Storage key `sneaky-eggs` (via `~/storage`):
  `{ game, skin, muted, music, giant, lastSeen }` where `game` is `SavedGame`.
  Every field added in the second pass is optional, so first-pass saves load.
- Saved every ~5s while playing, after every menu action, and when the tab is
  hidden.
- In dev builds only, the live game is on `window.__eggs` for poking at.

## Ideas
- Name your pets.
- Daily missions ("bring home 5 eggs today").
- Seasonal lands (the catalog of looks makes a new land ~40 lines of config).
- Second player on the same keyboard racing for the same nests.
