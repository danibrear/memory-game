# Animation sweep (2026-11-14)

A read-through of every game looking for moments that happen with no motion.
Items describe how things were at the time of the sweep.

## Status

**Built 2026-11-14 (batches 1 and 2):**
- Shared: number bump (`useBump`, `<Bump>`, on by default in `StatPill`),
  `<CountUp>` on win screens, `useDealIn` board deal-in, win-screen stagger.
- Deal-in: Match cards, Memory tiles, Ball Sort tubes; Munch Bunch picture
  builds itself cube by cube (`drawBoard`'s `sinceStartMs`).
- Munch Bunch: Munchy hops from its queue to its spot; the queue slides forward.
- Match and Memory: victory wave between the last find and the win screen.
- Color: fill bucket ripples outward from the tapped cell.
- Also picked up along the way: Match 2-player score and "left" count bump,
  Ball Sort moves/sorted bump and moves count-up, Bubble Pop game-over count-up.

**Still open:** everything else below (shared items 4 and 5, landing page,
Color eraser/undo/rainbow, Match sparkle and crown, Bubble Pop countdown,
Ball Sort undo arc, Arrow Escape, Cascade, Munch Bunch cube puff,
Tower Defense, Hole Drop podium).

## Shared (one change improves several games)

Files: `app/components/game/GameKit.tsx`, `app/game-kit.css`

1. **Number bump on `StatPill`.** Values change with no motion (only a color
   transition). Bubble Pop's score is the one exception (`bp-bump`, keyed span).
   Affects Memory, Match, Munch Bunch, Bubble Pop.
2. **`WinScreen` stagger + count-up.** Stars, icon and confetti animate, but the
   stat pills and buttons arrive in one block with the parent's `dgRise`, and
   numbers (tries, accuracy, score) show their final value immediately.
3. **Board deal-in.** A shared staggered entrance class. Boards appear fully
   formed in Match, Memory, Ball Sort (tubes) and Munch Bunch (picture).
4. **Page transitions.** No route transitions. React Router's `viewTransition`
   on links plus a `view-transition-name` on `GameIconTile` would morph the
   landing card's icon into the start-screen hero (both already use
   `GameIconTile`). Falls back to an instant cut where unsupported.
5. **Small controls.** `Stepper` value has no tick, `ChoiceGroup` has no sliding
   thumb (background transition only), `KitDialog` uses MUI's default fade.

## Landing page (`app/routes/landing.tsx`)

- Game cards have hover motion but no entrance; switching the category filter
  swaps the grid instantly.
- "Surprise me" navigates instantly (`navigate(randomGame().path)`), in the hero
  and the nav bar. A short shuffle across tiles first would sell it.
- NEW ribbon is static.

## Per game

### Color Game (`routes/color.tsx`, `cg-*`)
- Fill bucket: every filled cell pops at the same moment (`cgPop`). Ripple
  outward from the tapped cell with a per-cell delay.
- Eraser: cells just vanish (element is re-keyed, no exit animation).
- Undo and New Picture: instant swap of the whole grid.
- Rainbow brush: same pop as the normal brush; could leave a sparkle.

### Match Game (`routes/match.tsx`, `mg-*`)
- No deal-in; Restart reshuffles instantly.
- A match is a scale pop only (`mgMatch`). Room for a sparkle burst and the
  picture on the card wiggling.
- 2-player score number and avatar don't react to a point.
- Last pair: 900ms pause then a hard cut to the win screen. A wave through all
  cards would fill it.
- Winner card on the results screen swaps in a crown with no motion.

### Memory Game (`routes/memory.tsx`, `mm-*`)
- No deal-in for the tile grid.
- All target tiles light at once; a quick ripple would be prettier (keep the
  total reveal time the same so difficulty doesn't change).
- Found counter and mistakes pill don't bump.
- Last tile: 700ms pause then a hard cut to the win screen.

### Bubble Pop (`routes/bubblepop.tsx`, `styles/bubblepop.css`)
- Already the most animated game. Only gap: play starts the instant you press
  Play, with no 3-2-1 (Memory has one, `mm-countdown`).

### Ball Sort (`routes/ballsort.tsx`, `styles/ballsort.css`)
- Tubes and balls have no entrance at level start.
- Undo snaps back (`handleUndo` sets the tubes directly) while forward moves fly
  in an arc (`ballsortFlyArc`). Reverse arc on undo.

### Arrow Escape (`routes/arrows.tsx`)
- Well covered (escape, bounce, blocked glow, hint, exit burst, pop-in).
- Mistakes pill changes color but doesn't bump; cleared counter is static.
- Level buttons on the start screen have no entrance.

### Cascade (`routes/quadra.tsx`, `cascade-*` in `app.css`)
- Score, Level and Lines values are static text.
- Next queue snaps when a piece is taken; could slide up.
- Game over is only the overlay card; the stack doesn't react.
- Chain x3+ burst and screen flash (already in `cascade-polish-notes.md`).

### Munch Bunch (`routes/munch.tsx`, `games/munch/*`, `mb-*`)
- A sent Munchy pops into its spot (`mb-popin`) rather than travelling there
  from its queue column.
- The queue's next Munchy becomes the front one instantly.
- The picture is drawn fully formed at level start (`drawBoard`).
- An eaten cube turns into its ghost with no puff.

### Tower Defense (`routes/towerdefense.tsx`, `games/towerdefense/*`)
- Canvas is well covered (particles, recoil, muzzle flash, shake, float text,
  wave banners).
- Win / Game Over card has no entrance, no confetti, no stars.
- Gold, lives and wave values in the HUD are static.

### Hole Drop (`routes/hole.tsx`, `games/hole/*`)
- Fully covered (particles, floaters, shake, toasts, unlock card, confetti).
- Only gap: the Classic podium is static; blocks could rise 3rd, 2nd, 1st.
- Has uncommitted work in progress as of this sweep, so leave it for last.

## Suggested order

1. Shared items 1 to 3 (one pass, lifts most games).
2. Munch Bunch hop + queue slide, Match and Memory finish waves, Color fill ripple.
3. Tower Defense results card, Cascade numbers and game over.
4. Landing entrance, Surprise me shuffle, page transitions.

## Ground rules for the build

- Animate `transform` and `opacity` only, so boards stay smooth on phones.
- Every new animation needs a `prefers-reduced-motion` fallback. The Game Kit
  shell already shortens all animations inside `.dg-shell`; Arrow Escape, Tower
  Defense, Hole Drop and the landing page have no reduced-motion handling yet.
- Don't lengthen the wait before a player can act again.
