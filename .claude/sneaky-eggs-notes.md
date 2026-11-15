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

**Trophies (71).** Data-driven in `achievements.ts`: each is a number to reach
read straight off the game. Banners queue one at a time. Old saves get whatever
they've already earned in one quiet "welcome back" lump.

**Missions.** Three small goals at a time ("Bring 5 eggs home", "Catch 3
glitterbugs"), listed in `MISSIONS` in config. Finishing one pays coins and deals
a new one; every 5th pays 2 bonus stars. The one nearest to done shows under the
star chip; all three are at the top of the Trophies menu. Only goals the player
can do right now are dealt (no dash missions before Zoom Dash is bought).

**Style.** 9 hats and 8 trails (Shop → Hats / Trails). The hat shows on the
title screen too. Wardrobe bows and scarves are always red (`dressed()` in config).

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

## Third pass (Nov 14): timers, heavy eggs and hatch rolls

Asked for by Dani for her brother: more to earn, more luck in the hatch, and
real cost for going after the valuable eggs. All of it is the default "Sneaky"
game style; "Cozy" on the title screen turns the three costs off (see below).

- **Ripening.** An egg that appears in a nest has to ripen before it can be
  picked up: Common 0s, Rare 6s, Epic 14s, Legendary 26s (`RIPEN_TIME`). The
  nest shows a small pale egg with a countdown ring and the seconds left. Eggs
  already in the world when a game loads are ripe. A toast and chime announce
  Epic and Legendary eggs turning ripe, naming the land if you're elsewhere.
  Mystery Eggs never need ripening.
- **Lifting.** Rare and better eggs take a moment to lift (`GRAB_TIME`, measured
  in multiples of that land's Grumble `wake` time so the squeeze is the same in
  every land: Rare 0.25, Epic 0.5, Legendary 0.9). The Grumble starts waking the
  moment lifting begins, and it will come for you even though you aren't holding
  the egg yet. Step away and the progress drains back. A ring fills around the
  nest while lifting.
- **Weight.** Each carried egg slows you: Rare 3%, Epic 7%, Legendary 12%
  (`EGG_WEIGHT`), capped at 35% (`MAX_WEIGHT`). The Speed chip in the HUD turns
  into an orange "Heavy −N%" while it applies.
- **Three new upgrades** that fight those costs (4 levels each): Quick Hands
  (`hands`, lifting down to 40%), Strong Arms (`arms`, weight down to nothing),
  Sun Lamp (`ripen`, countdowns down to 40%).
- **Hatch rolls.** Every hatch rolls a variant and a size, replacing the old
  shiny yes/no. Variants (`VARIANTS`): Shiny x3, Golden x8 (solid gold),
  Rainbow x25 (cycles colours). Chances hang off the Sparkle Charm: Shiny is
  `shinyChance`, Golden a fifth of that, Rainbow a twenty-fifth. Sizes
  (`SIZES`): Big x1.5 (20%), Huge x2.5 (8%), Titanic x5 (2%), drawn bigger in
  the pen. Golden, Rainbow, Huge and Titanic hatches get the full "Jackpot!"
  reveal even when the pet isn't new. Fusing keeps the best variant and the best
  size of the three; selling and fusing use up the weakest ones first.
- **Pet Book** tracks the best variant found for each pet and shows totals for
  Shiny, Golden and Rainbow out of 25. `book[id]` is now 1 + best variant.
- **Map** shows every nest in each opened land: a tick if the egg is ready, the
  seconds left if it's ripening, a dashed outline if the nest is empty.
- **Trophies** (78 now): Heavy Lifting, Nerves of Steel, Solid Gold, Gold Rush,
  Over the Rainbow, That's Huge!, Absolute Unit.
- **Cozy style** (`Save.cozy`, `createGame(..., { cozy })`): eggs are always
  ripe, lift instantly and weigh nothing. Hatch rolls and the new trophies
  still work. Default is Sneaky.
- One-time tips (`g.flags.toldRipen` / `toldGrab` / `toldHeavy`) explain each
  new rule the first time it comes up.
- Being bumped while lifting (no egg in hand) says "Too slow! The Grumble shooed
  you off the nest." instead of "took the egg back".

### How hard it is (bot, runs straight home, no hesitation)
Numbers are the closest the Grumble gets, in px. X = caught.
- Common: unchanged, always safe.
- Side nests: Rare 150–185, Epic 105–150, Legendary 50–100 with no new upgrades.
  A person who hesitates half a second will find Legendary tight.
- Golden nest (behind the Grumble, best eggs): Rare 8–33; Epic is caught or a
  hair from it; Legendary is caught. ZOOM alone rescues Epic; Legendary wants
  ZOOM plus a couple of levels of Quick Hands and Strong Arms, or all four of
  each (gap 4–28).
- A full run still finishes in both styles (bot: 12–17 min Sneaky, ~12 Cozy).

### Saves
- Old pets `{ id, shiny }` load as variant 1; new ones save `{ id, v?, s? }`.
- `up.hands/arms/ripen` and `stats.legendEggs` default to 0.
- `Save.cozy` defaults to false.

## Fourth pass (Nov 14): groves, mini-Grumbles, powers, levels, idle loop

Dani's brief: not just "up and up"; go sideways for better eggs; waits for
certain eggs; mini-Grumbles; a catch sends you back to the start; taking an egg
wakes every Grumble; equippable eggs that freeze or slow Grumbles; power-ups
that confuse them; levels; an ad for FanScout that hatches eggs faster; make it
easy to pass on to friends; and (follow-up) make it more of an idle game.

### The world is wider
- `WORLD_W` 960 -> 1680. The middle 960 is the old land; past `WING_X` on each
  side is a **grove** (shadier ground, a line of stepping stones at the edge).
- Each land has 5 nests now: the two path nests, the golden nest, and two
  **grove nests** far out to the sides (`far: true`, +2 luck).
- One **ancient nest** per land, deep in a grove (`ancientSpot`). It lays that
  land's **Power Egg** on a long timer (`ANCIENT_TIME`: 2/3/4/5/6 minutes,
  shortened by Sun Lamp). The timer shows on the nest and on the Map, and is
  saved. A new game starts each one half-grown.
- Home is unchanged; the pen, hut, chest and decorations are placed from the
  centre.

### Grumbles
- **Mini-Grumbles**: two per land, pacing the lanes at the grove edges
  (`MINI_LANE`). They only care if you carry an egg or are lifting one, notice
  you within `MINI_SEE`, chase to `MINI_LEASH`, then go back to pacing.
- **Taking an egg wakes every Grumble** (`alarm`). The others stand "alert" on
  the path for `ALERT_TIME`, and charge after a short beat when you enter their
  land with an egg. A Grumble never chases slower than `ALARM_SPEED` (60%) of
  your own top speed, so the early ones stay worth dodging.
- **A catch sends you back to the start** and the eggs go back to their nests.
- Cozy style keeps the old rules: only the local Grumble wakes, minis never
  chase, a catch is a bump where you stand.

### Powers
- **Power Eggs** (worn, from the Shop's Powers tab; slots open at levels 3, 7,
  12): Clover (+2 luck), Snail (Grumbles 25% slower), Frost (FREEZE button:
  every Grumble stops for 3s, 40s cooldown), Feather (once per 90s a catch
  doesn't send you home), Star (+50% coins). A duplicate pays 5 stars.
- **Power-ups** appear in the groves every 25-45s (`POWERUP_EVERY`); you hold
  one at a time and tap its button: Dizzy Candy (Grumbles wander confused for
  6s and can't catch you), Hourglass (every egg ripens now, ancient nests skip
  a minute), Bubble Shield (pops by itself to cancel one catch).

### Levels
- XP from eggs carried home (more for rarer eggs and later lands), hatches, new
  pets, trophies, missions and Power Eggs. `xpNeed(level) = 30 * level^1.5`,
  cap 50. Each level: +2% coins and a star (5 stars every fifth level). The HUD
  chip fills as the XP bar. Finishing the Pet Book lands around level 9-12.

### Idle
- **Egg Courier** upgrade: a bird drops an egg on a spare pad every
  60/45/30/20/12s (one step less lucky than you; always leaves one pad free).
- **Coin Jar** upgrade: away earnings go from 50% for 10 minutes up to 100% for
  8 hours (`awayCap`, `awayShare`).
- **Rebirth** (bottom of the Upgrades tab, once Starry Space is open): coins,
  upgrades and pets reset; you gain Golden Feathers,
  `floor((coins earned this run / 1M) ^ 0.4)`, each +10% coins forever. Pet
  Book, trophies, stars, hats, trails, decorations, level and Power Eggs stay.

### The house ad
- While an egg has more than 4s left to hatch, a "Hatch now" button shows
  (Sneaky style only, never in Cozy). It opens a 5-second card for FanScout
  (`HOUSE_AD` in config: copy, link, length); finishing it hatches every egg on
  the pads. 45s between ads. The card is labelled as an ad from the maker of
  the game and links to the App Store listing.
- Counts live in `g.stats.adsOpened / adsDone / adsClicked` in this device's
  save only. Nothing is sent anywhere, in keeping with the site's "nothing is
  ever tracked" welcome note. To learn what other players do would need
  analytics, which is a decision for Dani.

### Sharing
- "Tell a friend" on the title screen and "Brag" on jackpot hatches use the
  share sheet where there is one, otherwise copy a line and the link
  (`SHARE_URL`) to the clipboard.

### Trophies
- 91 now. New: grove eggs, Power Eggs, levels, power-ups, freezes, being sent
  home, courier deliveries, rebirths.

### Checked with bots
- A crude bot that steers around awake Grumbles, at exactly the required speed
  with none of the new upgrades, gets Common and Epic eggs from the path nests
  home through every land 8 times out of 8. Grove nests, Legendary eggs and
  the ancient nest fail a good share of the time without ZOOM, and are close to
  certain with ZOOM plus two levels each of Quick Hands and Strong Arms.
- Cozy style still completes the book (bot: about 8 minutes; the level bonus
  and courier make it a little quicker than before).

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
- `RIPEN_TIME`, `GRAB_TIME`, `EGG_WEIGHT`, `MAX_WEIGHT`: the three costs on
  valuable eggs. Zero any of them to switch that rule off for everyone.

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
  `{ game, skin, muted, music, giant, cozy, lastSeen }` where `game` is `SavedGame`
  (now also `level`, `xp`, `powerEggs`, `equipped`, `held`, `ancients`, `feathers`, `runEarned`).
  Every field added in the second pass is optional, so first-pass saves load.
- Saved every ~5s while playing, after every menu action, and when the tab is
  hidden.
- In dev builds only, the live game is on `window.__eggs` for poking at.

## Ideas
- Things to spend Golden Feathers on, and an auto-fuse toggle, for the idle side.
- A friend code or shared leaderboard (needs a backend).
- Name your pets.
- Daily missions ("bring home 5 eggs today").
- Seasonal lands (the catalog of looks makes a new land ~40 lines of config).
- Second player on the same keyboard racing for the same nests.
