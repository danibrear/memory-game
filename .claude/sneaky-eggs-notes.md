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

### The house ad (rebuilt Nov 15: FanScout branding, watch-time rewards, more placements)
Dani's brief: the ad named FanScout but looked nothing like it; make opening it
worth more than a hatch; and show FanScout to players as much as we can.

- **Looks like FanScout.** `games/eggs/fanscout.ts` holds the winged-F mark (one
  SVG path, from FanScout's `public/fanscout-logo-simple.svg`), the brand colours
  (`brand` in FanScout's `src/theme/palette.ts`: green `#81c04d` on the
  near-black slab `#0f1923`, app-icon green `#6eae5c`) and four slides of copy
  taken from its share card and landing page. The card is set in Inter, heavy
  and tight, like the FanScout wordmark. `components/eggs/FanScoutAd.tsx` draws
  it (`FanScoutMark`, `FanScoutTile`, `FanScoutAd`).
- **The longer you watch, the more you get.** One reward per 5-second slide
  (`AD_REWARDS` in config), all collected with one button:
  5s Quick Hatch (pads hatch now, then 4x faster for 2 min), 10s Double Coins
  (3 min, shares the shooting-star `frenzy` timer), 15s Lucky Nests (+2 nest
  luck and +3 Sparkle Charm levels on hatch rolls for 3 min), 20s Mystery Prize
  (a power-up if the pocket is empty, 2 or 5 stars, or 3 minutes of coins).
  Closing early keeps whatever is already unlocked. Only time with the tab
  visible counts. 60s between ads (`AD_COOLDOWN`), counted from collecting.
  `claimAd(g, seconds)` in the engine pays out; boosts top up, never stack.
  The three timers are saved (`SavedGame.boosts`).
- **Tapping through** (`fanscoutapp.com` pill on the card) pays 3 stars once a
  day (`AD_VISIT_STARS`, `adVisit`). The link is `fanscoutUrl(placement)`:
  `fanscoutapp.com/?utm_source=sneaky-eggs&utm_medium=house-ad&utm_campaign=<placement>`,
  so FanScout's own analytics can count arrivals per placement. It used to go
  to the App Store listing; swap it back in `fanscout.ts` if that is preferred.
- **Where FanScout shows up** (placements: `hud`, `sign`, `shop`, `title`,
  `title-strip`):
  1. HUD button, bottom left, always there in Sneaky style: "Free boosts" /
     "Hatch now" when ready, a countdown while cooling down. Running boosts show
     as green timers above it.
  2. A FanScout sign by the home gate (`BILLBOARD`, solid seed -3,
     `drawBillboard`). It glows and says "FREE BOOSTS!" when the ad is ready and
     counts down otherwise. Walk into it or tap it. Declining quiets walk-ins
     for 20s.
  3. A "Free boosts" row at the top of the Shop.
  4. Title screen: "Double it" next to the away-coins banner (5s, doubles the
     coins your pets earned while away, `AD_AWAY_MULT`), and a "From the maker
     of this game" strip that links to FanScout.
- **Cozy style stays ad-free**: no button, no offers; the sign is there but only
  shows the tagline.
- Counts live in `g.stats.adsOpened / adsDone / adsClicked / adSeconds /
  adRewards` in this device's save only. The game still sends nothing anywhere;
  the only signal that leaves is the `utm_` tag on the link when someone taps
  through. Two trophies: Fan Favorite (5 boosts), Superfan (50).
- The site's welcome note used to say the games are "not affiliated with any
  company". With FanScout this visible that line was dropped (Nov 15); the
  note now only says the games are free, saved in the browser and never tracked.

### Sharing
- "Tell a friend" on the title screen and "Brag" on jackpot hatches use the
  share sheet where there is one, otherwise copy a line and the link
  (`SHARE_URL`) to the clipboard.

### Trophies
- 93 now (two for FanScout boosts, Nov 15). New: grove eggs, Power Eggs, levels, power-ups, freezes, being sent
  home, courier deliveries, rebirths.

### Checked with bots
- A crude bot that steers around awake Grumbles, at exactly the required speed
  with none of the new upgrades, gets Common and Epic eggs from the path nests
  home through every land 8 times out of 8. Grove nests, Legendary eggs and
  the ancient nest fail a good share of the time without ZOOM, and are close to
  certain with ZOOM plus two levels each of Quick Hands and Strong Arms.
- Cozy style still completes the book (bot: about 8 minutes; the level bonus
  and courier make it a little quicker than before).

## Mini games (Nov 15): three striped tents

Dani's brief: mini games for special rewards (she suggested mazes and tag with
an NPC). This is the first batch of three, to see whether Elliot likes them
before more are built. No new currency: each game has its own prize.

### How it works
- A **striped tent** stands at Home (Hide and Seek), in Sunny Meadow (Tag with
  Zip) and on Coral Beach (Sleepy Steps), each just beside the path. Walk into
  one and a card asks "Play?". Not while carrying eggs.
- The main game **pauses** and the mini game takes over the canvas in its own
  small arena (no camera; tall on upright screens, wide on sideways ones). Same
  joystick and arrow keys. The X at the top right leaves without a result.
- Every game ends with **no medal, bronze, silver or gold**, shown as 0 to 3
  stars. The best medal hangs on the tent's roof and shows on the Map.
- **Practice is free, prizes are on a timer.** Each tent's prize comes back on
  a real-time timer like the gift chest (`prizeMs`: 15 minutes for Tag and Hide
  and Seek, 10 for Sleepy Steps). The tent shows "Prize!" or the countdown.
  Playing while it refills pays a small coin tip. A game with no medal never
  uses up the prize.
- **Cozy style** can't lose: no clock in Sleepy Steps or Hide and Seek, a slower
  Zip who never dashes, and always at least bronze.

### The three games
- **Tag with Zip** (Zip is a teal critter in a red scarf, `ZIP_LOOK`). 25
  seconds of you chasing him: every tag is a star and he gets faster each time,
  and after two tags he starts sidestepping. Then 20 seconds of him chasing
  you: three hearts, and he winds up ("!") and dashes. Score = tags + hearts
  left. Prize: **Zoomies**, 20% faster running for 3, 6 or 10 minutes. The first
  gold also wins the **Zip's Zoom** trail, which can't be bought.
- **Sleepy Steps.** Red light, green light: tiptoe to the giant egg while the
  Grumble sleeps, stop when it wiggles ("Careful..."), and be still when the
  eye opens ("FREEZE!"). Some wiggles are false alarms. Seen moving = back to
  the start (Cozy: back a few steps). Medal by time. Prize: 1, 2 or 3 **Lucky
  Dice**.
- **Hide and Seek.** Your own pets hide behind bushes, trees, rocks, hay bales
  and barrels and lean out now and then. Push into a spot for a moment to look
  (a ring fills, so brushing past doesn't count); an empty one costs 3 seconds.
  Two rounds: 4 pets, then 6. Bronze for round one, silver for both, gold with
  12 seconds to spare. Prize: **happy pets**, double coins for 3, 6 or 10
  minutes. Players with few pets get stand-ins.

### Lucky Dice
- Held up to 9 (`DICE_MAX`); a purple chip on the HUD and a "Roll" button on
  every row of My Pets.
- A roll re-rolls one pet's variant and size twice each and keeps the best. It
  never gets worse. A pet smaller than Huge always grows at least one size;
  otherwise a roll that changes nothing pays 90 seconds of that pet's income.
- The dice goes to the best pet of that kind that is still below Huge, then to
  the best one left to improve.

### How hard they are (bots, Sneaky style, 200 runs each)
- Tag: a slow, wobbly "small child" bot gets bronze about 9 times in 10; an
  average bot bronze, sometimes silver; a good one silver or gold.
- Sleepy Steps: a bot that stops at the wiggle finishes in about 13 seconds,
  half silver and half gold. A bot that only stops once the eye is open is
  always caught: the wiggle is the cue. `STEPS_TUNING.grace` is the knob.
- Hide and Seek: trying every spot gets bronze; watching for peeks gets silver
  or gold.
- Cozy: every bot gets at least bronze, usually silver or gold.

### Where it lives
- `minigames.ts`: the three simulations (`createMini`, `stepMini`). No drawing.
- `minigamesRender.ts`: the arenas and their HUD (`renderMini`).
- `engine.ts`, "Mini games" section: the tents (`knock`), `prizeWait`,
  `finishMini` (hands out the prize), `rollDice`.
- `render.ts`: `drawTent`, and the first-time "New game!" pointer.
- `config.ts`, "Mini games" section: `MINIS` (where each tent stands, its text
  and prize timer), `MINI_BUFF_TIME`, `MINI_DICE`, and `TAG_TUNING`,
  `STEPS_TUNING`, `SEEK_TUNING` for every difficulty number.
- Saves: `medals`, `prizeAt`, `dice`, `zoomT`, `happyT` and three counters, all
  optional, so older saves load with nothing won yet.
- Trophies: 8 new (99 in all).
- In dev builds the running mini game is on `window.__eggsMini`.

### Checked
- A script drove the game logic: tents clear of scenery, knocking, prizes and
  timers, medals, dice, old saves and a save round trip.
- Played in Chrome on the dev server with scripted key presses: all three
  games start to finish, wide and tall arenas, every result card, the dice
  roll, the Map and the Shop. Not tried with a real finger, and not in Safari
  on an iPad.

### Fast follows (not built)
Burrow Maze, Egg Catch, Nest Shuffle, Crystal Chimes, Pet Race, Saucer Dodge;
a pet that hatches only from mini games; a Glow variant above Rainbow.
## Home town pass (Nov 15): a house that grows, and special buildings

Dani's brief: let players customize their home more; upgrade the look and feel
of the house; add special buildings that take time to upgrade, like existing
idle games. Sits on `main` at `225a86b`, on top of the mini games. It does not
include the stealth pass or the FanScout ad pass (neither was on GitHub or in
the Mac repo at the time).

Everything here runs on **real time** (`Date.now()`, like the gift chest), so a
build keeps going while a menu is open and while the game is closed, and
finishes on the next load.

### The house
- Five tiers where the hut stands: Little Hut, Cozy Cottage (4K coins, 1 min),
  Farmhouse (150K, 10 min), Grand Manor (5M, 1 h), Castle (150M, 4 h).
  `HOUSE_TIERS` in config. Each tier adds to all coin income (+10/20/35/50%)
  and opens more buildings and higher building levels.
- **Paint** (stars, like hats): 6 wall colours, 6 roof colours and 6 toppers
  (flag, weather vane, heart, star, fairy lights). `WALL_PAINTS`, `ROOF_PAINTS`,
  `TOPPERS`. Bought once, switched freely. Windows light up at night.
- The hut's collision circle and the "knock knock" secret are unchanged.

### Special buildings (7, five levels each)
Plots sit down either side of home (`PLOTS`). Prices are `BUILD_COST[level] *
price`, times are `BUILD_TIME` (20s, 5m, 30m, 2h, 6h). A building can only reach
`level` when the house tier is at least `houseNeeded(id, level)`: its own
`needHouse`, or `level - 1` if that is higher.

| Building | Opens at | What it does (level 1 to 5) |
| --- | --- | --- |
| Windmill | Hut | Saves up 15/25/35/50/70% of pet income for up to 0.5/1/2/4/8 h. Walk into it or tap it to collect. |
| Treat Bakery | Hut | A cupcake every 10/8/6/5/4 min (holds 1/1/2/2/3). Eating one adds 30/40/50/60/80 s of double coins (stacks to `FRENZY_MAX`, 5 min). |
| Wishing Well | Cottage | A star every 30/24/18/12/8 min, holds 2/3/4/6/8. |
| Builder's Workshop | Cottage | 2 builders (3 at level 5); builds 0/10/20/30/40% faster. |
| Pet Barn | Farmhouse | +2/4/6/8/10 pet spaces on top of the pen upgrade (`penCap`). |
| Hatchery | Farmhouse | Eggs hatch 10/20/30/40/50% faster, on top of Warm Nests (`hatchTime`). |
| Sparkle Tower | Manor | 15/30/50/75/100% better odds of Shiny, Golden and Rainbow. |

### Builders
- One builder to start (`WORKSHOP_BUILDERS`). Each build holds a builder until
  it is done. `buildBlock(g, site)` says why something can't start: `max`,
  `working`, `house`, `builder`, `coins`.
- **Tap the site** to hurry it: each tap takes off 2 s, or 0.3% of the whole
  build if that is more (`BUILD_TAP_*`). **Finish now** costs 1 star per 15
  minutes left (`RUSH_SECONDS_PER_STAR`).
- **Cozy style:** builds take a fifth of the time (`COZY_BUILD_SCALE`).

### The town is never wiped (Dani's rule, Nov 15)
A six-hour build must never be lost, so nothing in the game takes the town away:
- **A Grumble's catch** costs the eggs in your arms and sends you home. It
  never touches `g.town`.
- **Rebirth** resets coins, upgrades and pets. The house, the buildings, builds
  still running and the paint all stay.
- **"Start over"** on the title screen keeps the town too. `startOverSave` in
  the engine builds the fresh save and carries the old town across; the
  confirmation says "Your house and buildings stay." With no town to keep it
  clears the save exactly as before.
- The script that checks the engine catches the player with a build running,
  rebirths, and starts over, and compares the town before and after each.

Anything added later that resets progress should leave `g.town` alone too.

### Where things are
- `config.ts`: the "Home town" section at the end (every number above).
- `engine.ts`: `Town`, `Job`, `Producer`; `startBuild`, `tapBuild`, `rushBuild`,
  `tickTown` (finishes builds and runs the timers; called every 0.25 s from
  `step`, once a second from the Home menu, and once on load), `collectFrom`,
  `readyToCollect`, `pickPaint`, `penCap`, `hatchTime`. `tapWorld` handles taps
  on the house, a building or an empty plot. Buildings are solid once there is
  something on the plot (checked in `movePlayer`, separate from the shared
  `solids` list).
- `render.ts`: `drawHouseArt`, `drawBuildingArt`, `drawSite`, `drawHouse`,
  `drawTownPaths`, and `paintHouseIcon` / `paintBuildingIcon` for the menus.
  A new building rises out of the ground as its build goes on.
- `app/components/eggs/HomeMenu.tsx`: the Shop's Home section, now three pages
  (House, Buildings, Decor). The old decorations list moved to Decor.
- `eggs.tsx`: a builder chip on the HUD (top right) with the soonest build's
  countdown, or "Ready at home!" when something can be collected and the player
  is out in the lands. Tapping a building or plot opens the Shop on that row.
- Trophies: 12 new (111 in all with the mini games).
- The Lucky Dice re-roll gets the Sparkle Tower's better odds, and the
  Windmill ignores the short boosts (a frenzy, happy pets) when it works out
  what to save up.

### Saves
- `SavedGame.town` is optional; a save without it loads as a hut and empty
  plots. `loadTown` drops unknown buildings, silly levels, stray jobs and
  paints that aren't owned, and restarts a timer whose clock went backwards.
- Six new `stats` counters default to 0: `built`, `hammers`, `millRuns`,
  `cakes`, `wellStars`, `paints`.
- `savedRate` (away earnings) includes the house bonus.

### Checked
- A script drove the engine through builds, the one-builder rule, house
  requirements, tapping, rushing, save and load with a build still running,
  finishing on load, an old save with no town, a deliberately broken town,
  the Windmill's cap, cupcakes, stars, the Barn, the Hatchery and paint.
- In headless Chrome at 390x844 and 820x1180 with touch on: tapped a plot,
  built from the menu, bought paint, tapped a site to hurry it, collected from
  the menu and by walking into a building. No console errors.
- `npm run typecheck` and `npm run build` pass.
- Not tested in real Safari on an iPad. Prices and times are first guesses and
  have not been played through by a person.

### Ideas
- Let Golden Feathers buy a permanent builder or shorter builds.
- A second look for each building at level 5, and seasonal paint.
- Pets wandering out of the pen to visit the buildings.

## Cut-off pass: Grumbles that guess where you're going (November 15, 2026)
Dani's brief: escaping should be a little harder. The Grumble only ever ran at
where the player is; in certain cases it should work out that the player is
heading for the gate and cut them off.

### What it does
- A chasing Grumble watches the player's heading. Carry an egg within about 40
  degrees of straight at the land's gate for `CUT_READ` (0.45s) and it stops
  running at the player and runs to block the way instead ("Aha!" over its
  head, a sparkle, a two-note sound, and a one-time tip).
- The block point is the nearest spot on the player's straight line to the gate
  that the Grumble can reach first (`cutOffPoint` in `engine.ts`). If there is
  no such spot (the player is already past it), it just chases as before.
- Each land has a `cunning` (0 to 1): the Grumble aims that share of the way
  from the player to the block point. Meadow 0.25, Beach 0.3, Peak 0.35,
  Canyon 0.4, Space 0.45. 0 switches the behaviour off for that land.
- Ways out, on purpose: turn away and it keeps heading for the wrong spot for
  about a third of a second before chasing again (`CUT_FORGET`); come at the
  gate from the side instead of straight on; ZOOM (it judges speed without the
  dash); and it never blocks within `CUT_KEEP` (130px) of the gate or plans
  when it is within `CUT_NEAR` (60px) of the player.
- Cozy style never does this. Mini-Grumbles, Dizzy Candy and FREEZE are
  unchanged.

### What it changes (bots, at exactly the required speed)
Three bots: one that runs straight for the gate, one that sidesteps well but
assumes the Grumble runs straight at it, and one that looks ahead knowing
exactly how the Grumble thinks.
- Path nests and the golden nest: identical to before for all three bots, any
  rarity, including the run home through the lower lands. In those cases the
  Grumble starts behind the player's line and can't get in front.
- Grove nests and ancient nests (the Grumble starts between the player and the
  gate): Common eggs are unchanged. Rare and better get tighter. With no
  upgrades the sidestepping bot's ancient-nest run goes from 12/12, 12/12,
  12/12, 8/12, 2/12 (Meadow to Space) to 12/12, 12/12, 0/12, 1/12, 0/12, and
  grove Legendary in Frosty Peak from 11/12 to 7/12.
- With ZOOM 2, Quick Hands 2 and Strong Arms 2 the same bot gets every grove
  egg home exactly as before. Ancient nests stay 12/12 through Candy Canyon
  (though the closest approach there drops from 70px to 1px) and go from 12/12
  to 7/12 in Starry Space.
- The look-ahead bot, no upgrades (4 runs each): grove Epic 4/4 in every land,
  as before; grove Legendary 4, 4, 4, 2, 2 (was 4 everywhere); ancient nest
  4, 2, 0, 0, 0 (was 4, 4, 4, 4, 1). So the Power Egg run without ZOOM is the
  one place this bites hard. Lower `cunning` if that is too much.

### Knobs (config.ts)
`cunning` per land, and `CUT_READ`, `CUT_FORGET`, `CUT_AIM`, `CUT_KEEP`,
`CUT_NEAR`. Lowering `CUT_AIM` makes the Grumble block on any move toward the
gate, not just a straight run; at 0.3 with cunning 0.5+ even the look-ahead bot
lost most grove runs in the last three lands, so treat that one with care.

### Notes
- `Guard` gained `read`, `cut`, `cutX`, `cutY`, `aha`. None of it is saved.
- New event `cutoff`; new sound `sfx.aha()`; new tip flag `toldCutoff`.
- `player.dirX/dirY` is not a unit vector on keyboard diagonals (it comes out
  0.7 long), so `chaseAim` normalises it. The same quirk makes a no-finger ZOOM
  after a diagonal key run coast at 70% speed; not changed here.

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
- `app/games/eggs/minigames.ts`, `minigamesRender.ts` — the three mini games.
- `app/routes/eggs.tsx` — screens, HUD, dock, input, game loop.
- `app/components/eggs/Menus.tsx` — Shop, Pets, Pet Book, Trophies and Map.
- `app/styles/eggs.css` — `se-*` styles, loaded through the route's `links`.
- `KitDialog` has an optional `className` so menus can be roomier on phones.

## Kid-friendliness knobs (all in config.ts)
- `guardRatio` / `wake` per land: how fast each Grumble is next to a player with
  exactly the required sneakers, and how long it takes to get up. Lower ratio or
  longer wake = easier.
- `cunning` per land: how well that Grumble cuts you off at the gate. 0 = it
  only ever chases, the way it used to.
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

## Polish pass (Nov 15): lollipops explain themselves, UI cleanups
**Lollipops.** They always gave a Sugar Rush (+35% speed for 4s, `SUGAR_RUSH_*`),
but nothing said so. Now:
- A ready lollipop has a soft glow and twinkles; walk within `LOLLIPOP_NEAR` (170px)
  and a speed-bolt badge pops up above it (`drawLollipop` in `render.ts`).
- A used one fades, and its colour sweeps back round like a clock over
  `LOLLIPOP_COOLDOWN` (12s).
- The first time you walk up to one, a tip says "Bump a sparkly lollipop for a
  burst of speed!" (flag `tipLolly`; existing saves see it once too).
- While the rush lasts, the Speed chip turns into a pink "Sugar rush!" chip.
- The "Sugar Rush" trophy is still a secret one.

**UI.**
- The land's name and a trophy banner used to land on the same spot (the name was
  hidden under "Hello, Coral Beach"). They now take turns: the name first, then
  the trophy. A name is skipped if a trophy is already showing.
- Messages (`.se-notes`) hang from the bottom of the HUD instead of a fixed
  `top`, so they stay clear of it however tall it gets. A tip with nothing above
  it moves up into the top spot and covers less of the field.
- HUD chips wrap. With Golden Feathers plus a couple of boosts they ran off the
  right edge of a phone.
- Title screen: for a returning player "Keep Playing" is right under the mascots
  (it was below the fold on an iPad). First-time players still read the rules and
  pick a style first.
- The Shop keeps one size across its tabs (`.se-shop`), so the tabs don't jump
  under a finger. Tab widths follow their words, so "Upgrades" isn't squeezed.
- Scrolling lists fade out at the bottom edge instead of being cut mid-row.
- Progress-bar counts ("14 / 18") are readable: the fill no longer runs to the
  game's darkest green.

Checked in headless Chrome at 390x844 and 1024x768 with touch, including a real
bump with the keyboard. Not tried in real Safari on an iPad.

## State
- Storage key `sneaky-eggs`, read and written through the save vault
  (`app/games/eggs/saves.ts`; see `.claude/save-safety-notes.md` for versions,
  restore points and how to change the shape of a save):
  `{ game, skin, muted, music, giant, cozy, lastSeen, v, build }` where `game` is `SavedGame`
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

## Noah's pass (November 15, 2026)

Seven asks from Noah, relayed by Dani. All tuning numbers are in `config.ts`.

- **Uncommon tier.** Rarities are now Common, Uncommon, Rare, Epic, Legendary,
  Mythic, numbered 0 to 5 (`COMMON` ... `MYTHIC`; use the names, not numbers).
  One new Uncommon pet per land. Coin multipliers are 1, 2, 4, 12, 40, 200
  (Rare and up went up a little). Uncommon eggs are green with a dotted band,
  ripen in 2s, and take a tenth of a wake time to lift.
  **Save migration:** saves from before this numbered Rare as 1. That is save
  version 2 (`SAVE_VERSION` and `MIGRATIONS[1]` in `saves.ts`): the eggs waiting
  on the pads move up one. Pets are saved by id, so they were never affected.
  `fixtures/pass7-save-vault-fanscout.json` is the fixture from just before the
  change, and `saves.test.ts` checks the renumbering happens exactly once.
- **Fuse 4.** `FUSE_COUNT = 4`. Menus, the Pet Book and trophies read the
  number from config. Fusing is now a small income trade for three free pen
  spots until the Legendary-to-Mythic step, where it gains.
- **Rarer eggs are rarer.** `rarityWeights(luck)`: with no luck a Legendary is
  under 1 in 100 (it was 2 in 100); at full luck about 1 in 17 (it was 1 in 8).
- **The reroll cheat is closed.** Getting caught used to put a brand-new roll
  in the nest, so players took a weak egg and let the Grumble hit them until a
  good one showed up. A carried egg now remembers its nest (`EggInfo.nest`),
  and a catch sends that very egg back (`Nest.back`); it has to ripen again.
- **Mythic eggs.** Any nest can lay one, at about 1 in 5,000 with no luck and
  1 in 400 at full luck. A toast announces it ("A MYTHIC egg appeared in ...").
  It ripens for 45s, is the heaviest egg and the slowest to lift. Fusing four
  Legendaries still works. Trophy: One in a Million.
- **Glow.** A fifth hatch variant after Rainbow (`GLOW = 4`, x60 coins), three
  times rarer than Rainbow: about 1 hatch in 1,500 with no Sparkle Charm, 1 in
  375 with all of it. A Glow pet wears its own special colours (every colour
  swung to the far side of the wheel and turned neon, `glowLook` in render)
  and throws a pool of light that is brighter at night. It counts as a
  jackpot, the Pet Book tracks it, and Lucky Dice can roll it. Trophy: Night
  Light. Variants are saved by index, so only ever add to the end of `VARIANTS`.
- **Grumbles bonk.** Scenery is now solid for a chasing Grumble. Running into
  it costs one of three hearts (`GUARD_HP`), with a short daze. At zero it is
  knocked out for 8 seconds (`KNOCKOUT_TIME`), pays 30 seconds of income
  (`KNOCKOUT_SECONDS`) plus XP, then shuffles home and sleeps its hearts back.
  Hearts show over any Grumble that is up. Mini-Grumbles have one heart: one
  bonk and they give up. Home objects (hut, chest, sign) never count. Four
  trophies. This makes chases easier where there is scenery to use; the knobs
  are `GUARD_HP`, `BONK_GRACE` and `GUARD_BODY`.
- **Three new lands** past Starry Space: Spooky Hollow (sneakers 18), Lava
  Lagoon (22) and Cloud Kingdom (26), each with six pets, its own scenery (two
  solids and two decorations drawn in `render.ts`), a tune, mini-Grumbles, an
  ancient nest and a Power Egg: Ghost (Grumbles wake 0.5s slower), Magma (pads
  hatch twice as fast), Cloud (carried eggs weigh nothing). Sneakers now go to
  level 28; past 18 each level adds 6 speed, not 16. Old max was 18, so a
  maxed player walks straight into Spooky Hollow. Rebirth still opens with
  Starry Space (`REBIRTH_LAND`). The flying saucer moved to the top of Cloud
  Kingdom (it lives at the top of the world); the star picture stays in space.
  The world is three lands taller, so `HOME_TOP` grew; nothing saved depends
  on it.
- **Counts:** 48 pets (40 from ordinary eggs, 8 Mythic), 8 Power Eggs, 125
  trophies.
- **Checked** in Chrome at iPad and phone sizes: old save loads and its pad
  eggs migrate; a caught Uncommon egg came back as the same egg; three bonks
  knocked a Grumble out and it recovered; four Clover Buns fused into a Dandy
  Duckling. Not tuned by a long play-through, and not tried on a real iPad.

