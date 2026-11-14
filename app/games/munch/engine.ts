// ─── Munch Bunch: pure game logic (no DOM) ───────────────────────────────────
//
// A picture is made of cubes. Munchies wait in queues; the player sends one to
// a munch spot, and it eats cubes of its own color, but only cubes with
// nothing left beneath them in their column. If every spot holds a Munchy that
// can't reach its color, the round is stuck.

import { isColorKey, PICTURES, type ColorKey, type Picture } from "./levels";

export const BASE_SLOTS = 5;
export const QUEUE_COLUMNS = 4;
/** Time between bites for one Munchy. */
export const EAT_MS = 85;
/** Flight time of a cube from the board into a Munchy's mouth. */
export const FLY_MS = 430;
/** How long a fully-blocked board must stay blocked before we call it stuck. */
const STUCK_GRACE_MS = 900;

export interface Cell {
  x: number;
  y: number;
  c: ColorKey;
  /** 0 = on the board, 1 = flying to a Munchy, 2 = eaten */
  state: 0 | 1 | 2;
  /** Cubes beneath this one in its column (0 = bottom of the column). */
  depth: number;
}

export type MunchyMode = "idle" | "eating" | "waiting";

export interface Munchy {
  id: number;
  c: ColorKey;
  cap: number;
  /** Bites not yet started. */
  left: number;
  /** Cubes currently flying toward this Munchy. */
  pending: number;
  eaten: number;
  cooldown: number;
  mode: MunchyMode;
  done: boolean;
}

export interface Flight {
  cell: Cell;
  munchy: Munchy;
  t: number;
  rot: number;
}

export interface Run {
  index: number;
  picture: Picture;
  rows: number;
  cols: number;
  grid: (Cell | null)[][];
  cells: Cell[];
  total: number;
  gone: number;
  queues: Munchy[][];
  slots: (Munchy | null)[];
  flights: Flight[];
  extraUsed: boolean;
  everFull: boolean;
  stuckMs: number;
  startedAt: number;
}

export function pictureFor(index: number): Picture {
  return PICTURES[index % PICTURES.length];
}

/** 0 on the first pass through the pictures, 1 on the second, and so on. */
export function loopFor(index: number): number {
  return Math.floor(index / PICTURES.length);
}

export function levelTitle(index: number): string {
  const loop = loopFor(index);
  return pictureFor(index).name + (loop ? " " + "★".repeat(Math.min(loop, 3)) : "");
}

export function buildRun(index: number, now: number): Run {
  const picture = pictureFor(index);
  const loop = loopFor(index);
  const rows = picture.art.length;
  const cols = Math.max(...picture.art.map((r) => r.length));

  const grid: (Cell | null)[][] = [];
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      const ch = picture.art[y][x] ?? ".";
      if (isColorKey(ch)) {
        const cell: Cell = { x, y, c: ch, state: 0, depth: 0 };
        grid[y][x] = cell;
        cells.push(cell);
      } else {
        grid[y][x] = null;
      }
    }
  }
  for (let x = 0; x < cols; x++) {
    let d = 0;
    for (let y = rows - 1; y >= 0; y--) {
      const cell = grid[y][x];
      if (cell) cell.depth = d++;
    }
  }

  // Split each color into Munchies. Later levels get more, smaller Munchies and
  // a messier queue order, which is what makes them harder.
  const byColor = new Map<ColorKey, Cell[]>();
  for (const cell of cells) {
    const list = byColor.get(cell.c) ?? [];
    list.push(cell);
    byColor.set(cell.c, list);
  }
  const ramp = Math.min(index, 16);
  const target = Math.min(32, 9 + ramp * 1.5 + loop * 4);
  const avg = Math.max(3, cells.length / target);
  const noise = 1.2 + ramp * 0.38 + loop * 1.5;

  const keyed: { munchy: Munchy; key: number }[] = [];
  let id = 0;
  for (const [c, list] of byColor) {
    const sorted = list
      .map((cell) => ({ cell, k: cell.depth + Math.random() * 0.6 }))
      .sort((a, b) => a.k - b.k)
      .map((e) => e.cell);
    const n = Math.max(1, Math.round(sorted.length / avg));
    let at = 0;
    for (let k = 0; k < n; k++) {
      const remain = sorted.length - at;
      const slotsLeft = n - k;
      let size =
        k === n - 1
          ? remain
          : Math.max(1, Math.round((remain / slotsLeft) * (0.75 + Math.random() * 0.5)));
      size = Math.min(size, remain - (slotsLeft - 1));
      const chunk = sorted.slice(at, at + size);
      at += size;
      const meanDepth = chunk.reduce((s, cell) => s + cell.depth, 0) / chunk.length;
      keyed.push({
        key: meanDepth + (Math.random() - 0.5) * noise,
        munchy: {
          id: id++, c, cap: size, left: size, pending: 0, eaten: 0,
          cooldown: 0, mode: "idle", done: false,
        },
      });
    }
  }
  keyed.sort((a, b) => a.key - b.key);

  const queues: Munchy[][] = Array.from({ length: QUEUE_COLUMNS }, () => []);
  keyed.forEach(({ munchy }, k) => queues[k % QUEUE_COLUMNS].push(munchy));

  return {
    index, picture, rows, cols, grid, cells, total: cells.length, gone: 0, queues,
    slots: Array(BASE_SLOTS).fill(null), flights: [], extraUsed: false,
    everFull: false, stuckMs: 0, startedAt: now,
  };
}

/** The lowest cube still on the board in each column, grouped by color. */
export function exposedByColor(run: Run): Map<ColorKey, Cell[]> {
  const out = new Map<ColorKey, Cell[]>();
  for (let x = 0; x < run.cols; x++) {
    for (let y = run.rows - 1; y >= 0; y--) {
      const cell = run.grid[y][x];
      if (cell && cell.state === 0) {
        const list = out.get(cell.c) ?? [];
        list.push(cell);
        out.set(cell.c, list);
        break;
      }
    }
  }
  const mid = run.cols / 2;
  for (const list of out.values()) {
    list.sort((a, b) => b.y - a.y || Math.abs(a.x - mid) - Math.abs(b.x - mid));
  }
  return out;
}

export type DispatchResult = "sent" | "full" | "empty";

export function dispatch(run: Run, column: number): DispatchResult {
  const queue = run.queues[column];
  if (!queue?.length) return "empty";
  const free = run.slots.indexOf(null);
  if (free < 0) return "full";
  const munchy = queue.shift()!;
  munchy.cooldown = 160;
  run.slots[free] = munchy;
  if (run.slots.every(Boolean)) run.everFull = true;
  return "sent";
}

export function addExtraSlot(run: Run): boolean {
  if (run.extraUsed) return false;
  run.extraUsed = true;
  run.slots.push(null);
  run.stuckMs = 0;
  return true;
}

export function freeSlot(run: Run, munchy: Munchy) {
  const k = run.slots.indexOf(munchy);
  if (k >= 0) run.slots[k] = null;
}

export interface StepEvents {
  /** Something visible changed (mode, count, finished Munchy). */
  dirty: boolean;
  bites: number;
  /** Munchies that just swallowed a cube (one entry per bite). */
  bitten: Munchy[];
  finished: Munchy[];
  outcome: "won" | "stuck" | null;
}

export function step(run: Run, dt: number): StepEvents {
  const ev: StepEvents = { dirty: false, bites: 0, bitten: [], finished: [], outcome: null };
  const exposed = exposedByColor(run);
  let busy = false;
  let full = true;
  let anyDone = false;

  const setMode = (m: Munchy, mode: MunchyMode) => {
    if (m.mode !== mode) {
      m.mode = mode;
      ev.dirty = true;
    }
  };

  for (const m of run.slots) {
    if (!m) {
      full = false;
      continue;
    }
    if (m.done) {
      anyDone = true;
      continue;
    }
    if (m.left > 0) {
      const list = exposed.get(m.c);
      if (list?.length) {
        busy = true;
        setMode(m, "eating");
        m.cooldown -= dt;
        if (m.cooldown <= 0) {
          const cell = list.shift()!;
          cell.state = 1;
          m.left--;
          m.pending++;
          m.cooldown = EAT_MS;
          run.flights.push({ cell, munchy: m, t: 0, rot: (Math.random() - 0.5) * 6 });
        }
      } else if (m.pending === 0) {
        setMode(m, "waiting");
      } else {
        busy = true;
      }
    } else {
      busy = true;
    }
  }

  for (let i = run.flights.length - 1; i >= 0; i--) {
    const f = run.flights[i];
    f.t += dt;
    if (f.t < FLY_MS) continue;
    run.flights.splice(i, 1);
    f.cell.state = 2;
    run.gone++;
    f.munchy.pending--;
    f.munchy.eaten++;
    ev.bites++;
    ev.bitten.push(f.munchy);
    ev.dirty = true;
    if (f.munchy.left === 0 && f.munchy.pending === 0) {
      f.munchy.done = true;
      ev.finished.push(f.munchy);
    }
  }

  if (run.gone === run.total && run.flights.length === 0) {
    ev.outcome = "won";
  } else if (full && !busy && !anyDone && run.flights.length === 0) {
    run.stuckMs += dt;
    if (run.stuckMs > STUCK_GRACE_MS) ev.outcome = "stuck";
  } else {
    run.stuckMs = 0;
  }
  return ev;
}

/** 3 stars, minus one for ever filling every spot and one for the extra spot. */
export function starsFor(run: Run): number {
  return Math.max(1, 3 - (run.everFull ? 1 : 0) - (run.extraUsed ? 1 : 0));
}
