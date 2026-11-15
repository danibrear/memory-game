// ─── Sneaky Eggs: mini games (simulation only: no drawing, no DOM) ───────────
//
// Three short games that live behind the striped tents: Tag with Zip, Sleepy
// Steps and Hide and Seek. Each one is its own little arena with its own
// state, stepped with the same joystick input as the main game. The main game
// is paused while one is running; `finishMini` in engine.ts hands out the
// prize afterwards. Every tuning number is in config.ts.

import {
  MINI_SPEED,
  PETS,
  PLAYER_R,
  SEEK_TUNING,
  STEPS_TUNING,
  TAG_TUNING,
  type Look,
  type Medal,
  type MiniId,
  type Point,
} from "./config";
import { burst, popup, puff, pushOut, updateFx, type Input, type Particle, type Popup } from "./engine";

/* ---------- Shared ---------- */

export type MiniEvent =
  | { type: "count" }
  | { type: "go" }
  /** Something good: tagged Zip, found a pet, reached the egg. */
  | { type: "score" }
  /** Something bad: Zip tagged you, the Grumble saw you. */
  | { type: "ouch" }
  /** A warning: Zip is winding up, the Grumble is stirring. */
  | { type: "tell" }
  | { type: "whoosh" }
  | { type: "round" }
  | { type: "awake" }
  | { type: "asleep" }
  | { type: "peek" }
  | { type: "miss" }
  | { type: "tick" }
  | { type: "done"; medal: Medal };

export interface Actor {
  x: number;
  y: number;
  flip: boolean;
  walkT: number;
  moving: boolean;
}

export interface MiniPlayer extends Actor {
  stun: number;
  /** Seconds of "can't be tagged" left; the player flickers while it lasts. */
  blink: number;
  kx: number;
  ky: number;
}

export interface Circle extends Point {
  r: number;
}

export type PropKind = "bush" | "tree" | "rock" | "hay" | "barrel" | "palm";

export interface Prop extends Circle {
  kind: PropKind;
  seed: number;
  /** 0–1 wobble after being bumped. */
  wob: number;
}

interface Base {
  id: MiniId;
  /** Arena size, in its own pixels. */
  w: number;
  h: number;
  cozy: boolean;
  /** "ready" counts 3-2-1, "play" is the game, "done" lingers for the cheer. */
  phase: "ready" | "play" | "done";
  readyT: number;
  /** Seconds played, and seconds since it ended. */
  time: number;
  doneT: number;
  player: MiniPlayer;
  particles: Particle[];
  popups: Popup[];
  events: MiniEvent[];
  /** Big words in the middle of the screen, and how long they stay. */
  banner: string;
  bannerT: number;
  medal: Medal;
  /** One line for the result card. */
  summary: string;
}

export interface CreateMiniOptions {
  /** The play area on screen, to pick a tall or a wide arena. */
  viewW: number;
  viewH: number;
  cozy: boolean;
  /** Hide and Seek: the pets that hide (the player's own, best first). */
  hiders?: Hider[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * clamp(k, 0, 1);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const EDGE = 26;

/** A tall arena for phones and upright tablets, a wide one for sideways screens. */
export function arenaSize(viewW: number, viewH: number): { w: number; h: number } {
  return viewW / Math.max(1, viewH) > 1.15 ? { w: 900, h: 560 } : { w: 560, h: 780 };
}

function base(id: MiniId, o: CreateMiniOptions, at: Point): Base {
  const { w, h } = arenaSize(o.viewW, o.viewH);
  return {
    id, w, h,
    cozy: o.cozy,
    phase: "ready",
    readyT: 3,
    time: 0,
    doneT: 0,
    player: { x: at.x * w, y: at.y * h, flip: false, walkT: 0, moving: false, stun: 0, blink: 0, kx: 0, ky: 0 },
    particles: [],
    popups: [],
    events: [],
    banner: "",
    bannerT: 0,
    medal: 0,
    summary: "",
  };
}

function say(m: Base, text: string, seconds = 1.2) {
  m.banner = text;
  m.bannerT = seconds;
}

function finish(m: Base, medal: Medal, banner: string, summary: string) {
  if (m.phase === "done") return;
  m.phase = "done";
  m.doneT = 0;
  // Cozy style always sends you home with something.
  m.medal = m.cozy && medal < 1 ? 1 : medal;
  m.summary = summary;
  say(m, banner, 9);
  if (m.medal > 0) {
    const p = m.player;
    burst(m, p.x, p.y - 30, "#fde047", 26, "star", 260);
    puff(m, p.x, p.y - 40, "#fb7185", 6, "heart");
  }
  m.events.push({ type: "done", medal: m.medal });
}

/**
 * Walk the player with the joystick, keeping them inside the arena and out of
 * the props. With `slip`, running dead straight into a prop slides you round it
 * instead of stopping you (little players steer straight at what they want).
 */
function walk(m: Base, dt: number, input: Input, speed: number, props: Circle[], slip = false) {
  const p = m.player;
  p.stun = Math.max(0, p.stun - dt);
  p.blink = Math.max(0, p.blink - dt);
  let mx = input.x;
  let my = input.y;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  const steering = m.phase === "play" && p.stun <= 0 && mag > 0.08;
  p.moving = steering;
  let vx = p.kx;
  let vy = p.ky;
  if (steering) {
    vx += mx * speed;
    vy += my * speed;
    if (Math.abs(mx) > 0.15) p.flip = mx < 0;
    p.walkT += dt * (speed / 190) * Math.min(1, mag);
  }
  const decay = Math.exp(-5.5 * dt);
  p.kx *= decay;
  p.ky *= decay;
  p.x = clamp(p.x + vx * dt, EDGE, m.w - EDGE);
  p.y = clamp(p.y + vy * dt, EDGE + 14, m.h - EDGE);
  for (const s of props) {
    if (!pushOut(p, s.x, s.y, s.r + PLAYER_R) || !slip || !steering) continue;
    const nx = (p.x - s.x) / (s.r + PLAYER_R);
    const ny = (p.y - s.y) / (s.r + PLAYER_R);
    // How much of the push is sideways. Next to none means a head-on bump.
    const side = mx * -ny + my * nx;
    if (Math.abs(side) > 0.35 || mx * nx + my * ny > 0) continue;
    const dir = side >= 0 ? 1 : -1;
    p.x += -ny * dir * speed * dt * 0.7;
    p.y += nx * dir * speed * dt * 0.7;
    pushOut(p, s.x, s.y, s.r + PLAYER_R);
  }
}

function stepClock(m: Base, dt: number): boolean {
  m.bannerT = Math.max(0, m.bannerT - dt);
  updateFx(m, dt);
  if (m.phase === "ready") {
    const before = Math.ceil(m.readyT);
    m.readyT -= dt;
    if (m.readyT <= 0) {
      m.phase = "play";
      m.events.push({ type: "go" });
    } else if (Math.ceil(m.readyT) < before) {
      m.events.push({ type: "count" });
    }
    return false;
  }
  if (m.phase === "done") {
    m.doneT += dt;
    return false;
  }
  m.time += dt;
  return true;
}

/** The last five seconds tick. */
function countdown(m: Base, before: number, after: number) {
  if (after > 0 && after <= 5 && Math.ceil(after) < Math.ceil(before)) m.events.push({ type: "tick" });
}

/* ---------- Tag with Zip ---------- */

export const ZIP_R = 17;

export interface Zip extends Actor {
  vx: number;
  vy: number;
  /** Standing still (laughing, or catching his breath). */
  pause: number;
  /** A quick sidestep when you get close. */
  jukeT: number;
  jukeCd: number;
  jukeX: number;
  jukeY: number;
  /** Winding up for a dash, then dashing. */
  tellT: number;
  dashT: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  joy: number;
}

export interface TagState extends Base {
  id: "tag";
  props: Prop[];
  zip: Zip;
  /** 1: you chase Zip. 2: Zip chases you. */
  round: 1 | 2;
  /** Seconds left in this round, and the breather between the two. */
  left: number;
  swapT: number;
  catches: number;
  hearts: number;
}

// Nothing stands on the middle line, so running straight at Zip from the start never hits a wall.
const TAG_PROPS: [number, number, PropKind, number][] = [
  [0.22, 0.26, "bush", 22],
  [0.75, 0.24, "tree", 26],
  [0.35, 0.5, "rock", 24],
  [0.68, 0.57, "bush", 22],
  [0.24, 0.77, "tree", 26],
];

function createTag(o: CreateMiniOptions): TagState {
  const b = base("tag", o, { x: 0.5, y: 0.84 });
  return {
    ...b,
    id: "tag",
    props: TAG_PROPS.map(([x, y, kind, r], i) => ({ x: x * b.w, y: y * b.h, r, kind, seed: (i * 0.37) % 1, wob: 0 })),
    zip: {
      x: b.w * 0.5, y: b.h * 0.18, flip: false, walkT: 0, moving: false,
      vx: 0, vy: 0, pause: 0, jukeT: 0, jukeCd: 1.5, jukeX: 0, jukeY: 0,
      tellT: 0, dashT: 0, dashCd: 3, dashX: 0, dashY: 0, joy: 0,
    },
    round: 1,
    left: TAG_TUNING.catchTime,
    swapT: 0,
    catches: 0,
    hearts: TAG_TUNING.hearts,
  };
}

const zipSlow = (s: TagState) => (s.cozy ? TAG_TUNING.cozy : 1);

/** Which way Zip wants to run to get away. */
function fleeDir(s: TagState): Point {
  const z = s.zip;
  const p = s.player;
  let ax = z.x - p.x;
  let ay = z.y - p.y;
  const d = Math.hypot(ax, ay) || 1;
  ax /= d;
  ay /= d;
  // Walls push back, harder the closer he gets.
  const M = 130;
  const near = (gap: number) => (gap < M ? (M - gap) / M : 0);
  const wx = near(z.x - EDGE) - near(s.w - EDGE - z.x);
  const wy = near(z.y - EDGE) - near(s.h - EDGE - z.y);
  const squeeze = Math.min(1, Math.hypot(wx, wy));
  // When squeezed against a wall he slips sideways, toward the open middle.
  const cx = s.w / 2 - z.x;
  const cy = s.h / 2 - z.y;
  let px = -ay;
  let py = ax;
  if (px * cx + py * cy < 0) {
    px = -px;
    py = -py;
  }
  // The closer you are, the less he cares about you and the more about getting out.
  const fear = d < 260 ? 1 : 0.35;
  let dx = ax * fear + wx * 1.6 + px * squeeze * 1.5;
  let dy = ay * fear + wy * 1.6 + py * squeeze * 1.5;
  for (const o of s.props) {
    const od = dist(z, o);
    const gap = od - o.r - ZIP_R;
    if (gap < 46) {
      const k = ((46 - gap) / 46) * 1.3;
      dx += ((z.x - o.x) / (od || 1)) * k;
      dy += ((z.y - o.y) / (od || 1)) * k;
    }
  }
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function moveZip(s: TagState, vx: number, vy: number, dt: number, smooth = 9) {
  const z = s.zip;
  const k = 1 - Math.exp(-smooth * dt);
  z.vx += (vx - z.vx) * k;
  z.vy += (vy - z.vy) * k;
  z.x = clamp(z.x + z.vx * dt, EDGE, s.w - EDGE);
  z.y = clamp(z.y + z.vy * dt, EDGE + 14, s.h - EDGE);
  for (const o of s.props) pushOut(z, o.x, o.y, o.r + ZIP_R);
  const sp = Math.hypot(z.vx, z.vy);
  z.moving = sp > 20;
  if (Math.abs(z.vx) > 14) z.flip = z.vx < 0;
  if (z.moving) z.walkT += dt * (sp / 170);
}

/** The spot in the arena farthest from a point (where Zip hops to after a tag). */
function farSpot(s: TagState, from: Point): Point {
  const spots: Point[] = [
    { x: 0.16, y: 0.14 }, { x: 0.84, y: 0.14 }, { x: 0.16, y: 0.88 }, { x: 0.84, y: 0.88 },
    { x: 0.5, y: 0.12 }, { x: 0.5, y: 0.9 }, { x: 0.5, y: 0.32 }, { x: 0.5, y: 0.7 },
  ].map((q) => ({ x: q.x * s.w, y: q.y * s.h }));
  spots.sort((a, b) => dist(b, from) - dist(a, from));
  // One of the two farthest, so it isn't always the same corner.
  return spots[Math.random() < 0.65 ? 0 : 1];
}

function hop(s: TagState, to: Point) {
  const z = s.zip;
  burst(s, z.x, z.y - 20, "#99f6e4", 12, "star", 170);
  z.x = to.x;
  z.y = to.y;
  z.vx = 0;
  z.vy = 0;
  burst(s, z.x, z.y - 20, "#ffffff", 10, "star", 150);
}

function stepTag(s: TagState, dt: number, input: Input) {
  const playing = stepClock(s, dt);
  walk(s, dt, input, MINI_SPEED, s.props, true);
  const z = s.zip;
  const p = s.player;
  z.joy = Math.max(0, z.joy - dt);
  for (const o of s.props) o.wob = Math.max(0, o.wob - dt * 1.6);
  if (!playing) {
    z.moving = false;
    return;
  }

  // The breather between the two rounds.
  if (s.swapT > 0) {
    s.swapT -= dt;
    z.moving = false;
    if (s.swapT <= 0) {
      s.round = 2;
      s.left = TAG_TUNING.runTime;
      z.pause = 0.5;
      z.dashCd = TAG_TUNING.dashAfter;
      s.events.push({ type: "go" });
    }
    return;
  }

  const before = s.left;
  s.left -= dt;
  countdown(s, before, s.left);
  z.pause = Math.max(0, z.pause - dt);
  const gap = dist(z, p) - ZIP_R - PLAYER_R;

  if (s.round === 1) {
    const step = TAG_TUNING.flee[Math.min(s.catches, TAG_TUNING.flee.length - 1)];
    const speed = MINI_SPEED * step * zipSlow(s);
    z.jukeCd = Math.max(0, z.jukeCd - dt);
    if (z.pause > 0) {
      moveZip(s, 0, 0, dt);
    } else if (z.jukeT > 0) {
      z.jukeT -= dt;
      moveZip(s, z.jukeX * speed * 1.75, z.jukeY * speed * 1.75, dt, 20);
    } else {
      const dir = fleeDir(s);
      if (!s.cozy && s.catches >= TAG_TUNING.jukeAfter && gap < 70 && z.jukeCd <= 0) {
        // A sidestep, toward whichever side has more room.
        let jx = -dir.y;
        let jy = dir.x;
        if (jx * (s.w / 2 - z.x) + jy * (s.h / 2 - z.y) < 0) {
          jx = -jx;
          jy = -jy;
        }
        z.jukeX = jx * 0.85 + dir.x * 0.5;
        z.jukeY = jy * 0.85 + dir.y * 0.5;
        z.jukeT = 0.26;
        z.jukeCd = rand(2.2, 3.2);
        s.events.push({ type: "whoosh" });
      }
      moveZip(s, dir.x * speed, dir.y * speed, dt);
    }
    if (gap < -2 && z.pause <= 0.35) {
      s.catches++;
      popup(s, z.x, z.y - 60, "Tag!", "#0d9488", true);
      burst(s, z.x, z.y - 24, "#fde047", 14, "star", 200);
      hop(s, farSpot(s, p));
      z.pause = 0.9;
      z.joy = 0.9;
      z.jukeCd = 1.2;
      s.events.push({ type: "score" });
    }
    if (s.left <= 0) {
      s.swapT = 2.6;
      say(s, "Now RUN! Zip is it!", 2.6);
      hop(s, { x: s.w * 0.5, y: s.h * 0.18 });
      p.x = s.w * 0.5;
      p.y = s.h * 0.84;
      p.kx = 0;
      p.ky = 0;
      s.events.push({ type: "round" });
    }
    return;
  }

  // Round two: Zip is it.
  const k = 1 - s.left / TAG_TUNING.runTime;
  const speed = MINI_SPEED * lerp(TAG_TUNING.chase[0], TAG_TUNING.chase[1], k) * zipSlow(s);
  if (z.pause > 0) {
    moveZip(s, 0, 0, dt, 14);
  } else if (z.tellT > 0) {
    z.tellT -= dt;
    moveZip(s, 0, 0, dt, 14);
    if (z.tellT <= 0) {
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      z.dashX = dx / d;
      z.dashY = dy / d;
      z.dashT = 0.42;
      s.events.push({ type: "whoosh" });
    }
  } else if (z.dashT > 0) {
    z.dashT -= dt;
    moveZip(s, z.dashX * MINI_SPEED * 1.8, z.dashY * MINI_SPEED * 1.8, dt, 30);
    if (Math.random() < 0.5) burst(s, z.x, z.y - 14, "#99f6e4", 1, "dot", 40);
    if (z.dashT <= 0) z.pause = 0.6;
  } else {
    const dx = p.x - z.x;
    const dy = p.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    moveZip(s, (dx / d) * speed, (dy / d) * speed, dt);
    z.dashCd -= dt;
    if (!s.cozy && z.dashCd <= 0 && d > 80 && d < 300) {
      z.tellT = 0.55;
      z.dashCd = rand(TAG_TUNING.dashEvery[0], TAG_TUNING.dashEvery[1]);
      s.events.push({ type: "tell" });
    }
  }
  if (gap < -2 && p.blink <= 0) {
    s.hearts--;
    const dx = p.x - z.x;
    const dy = p.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    p.kx = (dx / d) * 420;
    p.ky = (dy / d) * 420;
    p.stun = 0.45;
    p.blink = 1.9;
    // He skips off to the far side to give you a fair start.
    hop(s, farSpot(s, p));
    z.pause = 1.3;
    z.joy = 1.3;
    z.dashT = 0;
    z.tellT = 0;
    z.dashCd = Math.max(z.dashCd, 2);
    popup(s, p.x, p.y - 64, "Tagged!", "#ef4444", true);
    burst(s, p.x, p.y - 30, "#fb7185", 10, "heart", 150);
    s.events.push({ type: "ouch" });
  }
  if (s.left <= 0 || s.hearts <= 0) {
    const score = s.catches + Math.max(0, s.hearts);
    const [bronze, silver, gold] = TAG_TUNING.medals;
    const medal: Medal = score >= gold ? 3 : score >= silver ? 2 : score >= bronze ? 1 : 0;
    const hearts = Math.max(0, s.hearts);
    finish(
      s,
      medal,
      s.hearts > 0 ? "Zip is worn out!" : "Zip got you!",
      `${s.catches} ${s.catches === 1 ? "tag" : "tags"} and ${hearts} ${hearts === 1 ? "heart" : "hearts"} left`,
    );
  }
}

/* ---------- Sleepy Steps ---------- */

export type EyeState = "sleep" | "stir" | "awake" | "huff";

export interface StepsState extends Base {
  id: "steps";
  start: Point;
  goal: Point;
  /** True when the track runs left to right (wide screens). */
  wide: boolean;
  eye: EyeState;
  eyeT: number;
  /** This wiggle is a false alarm. */
  fake: boolean;
  lastFake: boolean;
  /** How long the eye has been open. */
  openFor: number;
  /** Seconds on the clock; Infinity in Cozy style. */
  left: number;
  spotted: number;
  /** 0 at the start line, 1 at the egg. */
  progress: number;
  /** Palms and rocks off to the sides. Only for looks: nothing here is in the way. */
  scenery: Prop[];
}

export const STEPS_GOAL_R = 40;

/** Where the beach scenery stands, as a share of the arena, for tall and wide screens. */
const STEPS_SCENERY_TALL: [number, number, PropKind][] = [
  [0.14, 0.2, "palm"], [0.86, 0.3, "rock"], [0.16, 0.5, "rock"], [0.87, 0.56, "palm"],
  [0.13, 0.8, "palm"], [0.85, 0.86, "rock"],
];
const STEPS_SCENERY_WIDE: [number, number, PropKind][] = [
  [0.1, 0.24, "palm"], [0.34, 0.2, "rock"], [0.6, 0.26, "palm"], [0.9, 0.2, "rock"],
  [0.2, 0.93, "rock"], [0.5, 0.95, "palm"], [0.88, 0.92, "palm"],
];

function createSteps(o: CreateMiniOptions): StepsState {
  const size = arenaSize(o.viewW, o.viewH);
  const wide = size.w > size.h;
  const L = STEPS_TUNING.track;
  // The Grumble sits just past the egg, so the track leaves room for it at the far end.
  const start = wide ? { x: (size.w - L - 110) / 2, y: size.h * 0.6 } : { x: size.w / 2, y: size.h - 84 };
  const goal = wide ? { x: start.x + L, y: start.y } : { x: start.x, y: start.y - L };
  const b = base("steps", o, { x: start.x / size.w, y: start.y / size.h });
  return {
    ...b,
    id: "steps",
    start,
    goal,
    wide,
    eye: "sleep",
    eyeT: 2.2,
    fake: false,
    lastFake: false,
    openFor: 0,
    left: o.cozy ? Infinity : STEPS_TUNING.time,
    spotted: 0,
    progress: 0,
    scenery: (wide ? STEPS_SCENERY_WIDE : STEPS_SCENERY_TALL).map(([x, y, kind], i) => ({
      x: x * size.w,
      y: y * size.h,
      r: 22,
      kind,
      seed: (i * 0.41) % 1,
      wob: 0,
    })),
  };
}

function stepSteps(s: StepsState, dt: number, input: Input) {
  const playing = stepClock(s, dt);
  walk(s, dt, input, STEPS_TUNING.speed, []);
  if (!playing) return;
  const p = s.player;
  const T = STEPS_TUNING;
  const total = dist(s.start, s.goal) - STEPS_GOAL_R;
  s.progress = clamp(1 - (dist(p, s.goal) - STEPS_GOAL_R) / total, 0, 1);

  const before = s.left;
  s.left -= dt;
  if (Number.isFinite(s.left)) countdown(s, before, s.left);

  s.eyeT -= dt;
  switch (s.eye) {
    case "sleep":
      if (s.eyeT <= 0) {
        s.eye = "stir";
        s.eyeT = lerp(T.stir[0], T.stir[1], s.progress) * (s.cozy ? 1.5 : 1);
        s.fake = !s.cozy && !s.lastFake && Math.random() < T.fake;
        s.lastFake = s.fake;
        s.events.push({ type: "tell" });
      }
      break;
    case "stir":
      if (s.eyeT <= 0) {
        if (s.fake) {
          s.eye = "sleep";
          s.eyeT = rand(0.7, 1.4);
        } else {
          s.eye = "awake";
          s.eyeT = rand(T.awake[0], T.awake[1]);
          s.openFor = 0;
          s.events.push({ type: "awake" });
        }
      }
      break;
    case "awake":
      s.openFor += dt;
      if (p.moving && s.openFor > (s.cozy ? T.cozyGrace : T.grace)) {
        s.spotted++;
        s.eye = "huff";
        s.eyeT = 1;
        burst(s, p.x, p.y - 30, "#ffffff", 14, "dot", 180);
        if (s.cozy) {
          // The gentle version: shooed back a little way.
          const dx = s.start.x - s.goal.x;
          const dy = s.start.y - s.goal.y;
          const d = Math.hypot(dx, dy) || 1;
          const back = Math.min(T.cozyBack, dist(p, s.start));
          p.x += (dx / d) * back;
          p.y += (dy / d) * back;
        } else {
          p.x = s.start.x;
          p.y = s.start.y;
        }
        p.stun = 0.7;
        p.kx = 0;
        p.ky = 0;
        burst(s, p.x, p.y - 30, "#fde047", 12, "star", 170);
        say(s, s.cozy ? "Oops! It saw you!" : "Spotted! Back to the start!", 1.3);
        s.events.push({ type: "ouch" });
      } else if (s.eyeT <= 0) {
        s.eye = "sleep";
        s.eyeT = rand(
          lerp(T.sleepFar[0], T.sleepNear[0], s.progress),
          lerp(T.sleepFar[1], T.sleepNear[1], s.progress),
        );
        s.events.push({ type: "asleep" });
      }
      break;
    case "huff":
      if (s.eyeT <= 0) {
        s.eye = "sleep";
        s.eyeT = rand(T.sleepFar[0], T.sleepFar[1]);
        s.events.push({ type: "asleep" });
      }
      break;
  }

  if (dist(p, s.goal) < STEPS_GOAL_R + PLAYER_R) {
    const [silver, gold] = s.cozy ? [T.medals[0] * 1.5, T.medals[1] * 1.5] : T.medals;
    const medal: Medal = s.time <= gold ? 3 : s.time <= silver ? 2 : 1;
    s.events.push({ type: "score" });
    burst(s, s.goal.x, s.goal.y - 30, "#fbbf24", 30, "star", 280);
    finish(
      s,
      medal,
      "You got the giant egg!",
      `${s.time.toFixed(1)} seconds${s.spotted ? `, spotted ${s.spotted} ${s.spotted === 1 ? "time" : "times"}` : ", never spotted"}`,
    );
  } else if (s.left <= 0) {
    finish(s, 0, "Time's up!", `${Math.round(s.progress * 100)}% of the way there`);
  }
}

/* ---------- Hide and Seek ---------- */

export interface Hider {
  look: Look;
  name: string;
  variant: number;
}

export interface SeekSpot extends Prop {
  /** Index into `hiders`, or -1 when nobody is here. */
  hider: number;
  found: boolean;
  /** Looked in already. */
  checked: boolean;
  /** 0–1: how far along the player is in looking inside. */
  look: number;
  /** 0–1: how far the pet is leaning out right now. */
  peek: number;
  peekLeft: number;
  wait: number;
  /** Which side it leans out of. */
  side: -1 | 1;
  /** Seconds since the pet was found (for its happy hops). */
  age: number;
}

export interface SeekState extends Base {
  id: "seek";
  spots: SeekSpot[];
  hiders: Hider[];
  /** 0 or 1: the pets hide twice, more of them the second time. */
  round: number;
  /** How many are hiding this round, and how many of those have been found. */
  hiding: number;
  found: number;
  /** Found over both rounds, out of everyone who hid. */
  foundAll: number;
  hidAll: number;
  /** The breather while everyone hides again. */
  swapT: number;
  /** Seconds on the clock; Infinity in Cozy style. */
  left: number;
  misses: number;
}

const SEEK_LAYOUT: [number, number][] = [
  [0.18, 0.17], [0.5, 0.13], [0.82, 0.18], [0.33, 0.31], [0.68, 0.33], [0.14, 0.47],
  [0.5, 0.47], [0.86, 0.49], [0.31, 0.63], [0.69, 0.64], [0.15, 0.8], [0.85, 0.8],
];
const SEEK_KINDS: [PropKind, number][] = [["bush", 24], ["tree", 26], ["hay", 26], ["barrel", 22], ["rock", 24]];

/** Stand-ins for a player who doesn't have enough pets yet. */
export function spareHiders(): Hider[] {
  return PETS.filter((p) => p.rarity <= 1)
    .sort((a, b) => a.rarity - b.rarity || a.biome - b.biome)
    .map((p) => ({ look: p.look, name: p.name, variant: 0 }));
}

const seekRounds = (cozy: boolean) => (cozy ? SEEK_TUNING.cozyRounds : SEEK_TUNING.rounds);

/** Everyone picks a new place to hide. */
function hide(s: SeekState) {
  const n = seekRounds(s.cozy)[s.round] ?? s.hiders.length;
  const every = s.cozy ? SEEK_TUNING.cozyPeekEvery : SEEK_TUNING.peekEvery;
  const order = s.spots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Mix up who hides, too, so it isn't always the same faces.
  const who = s.hiders.map((_, i) => i);
  for (let i = who.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [who[i], who[j]] = [who[j], who[i]];
  }
  s.spots.forEach((spot) => {
    spot.hider = -1;
    spot.found = false;
    spot.checked = false;
    spot.look = 0;
    spot.peekLeft = 0;
    spot.age = 0;
  });
  s.hiding = Math.min(n, s.hiders.length, s.spots.length);
  for (let k = 0; k < s.hiding; k++) {
    const spot = s.spots[order[k]];
    spot.hider = who[k];
    spot.wait = rand(0.5, every[1]);
    spot.side = Math.random() < 0.5 ? -1 : 1;
  }
  s.found = 0;
  s.hidAll += s.hiding;
}

function createSeek(o: CreateMiniOptions): SeekState {
  const b = base("seek", o, { x: 0.5, y: 0.93 });
  const spotCount = o.cozy ? SEEK_TUNING.cozySpots : SEEK_TUNING.spots;
  const want = Math.max(...seekRounds(o.cozy));
  const pool = [...(o.hiders ?? [])];
  // Top up with stand-ins nobody in the pool looks like already.
  for (const spare of spareHiders()) {
    if (pool.length < want && !pool.some((h) => h.name === spare.name)) pool.push(spare);
  }

  const layout = [...SEEK_LAYOUT];
  // Shuffle, then keep as many places as this style uses.
  for (let i = layout.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [layout[i], layout[j]] = [layout[j], layout[i]];
  }
  const spots: SeekSpot[] = layout.slice(0, spotCount).map(([x, y], i) => {
    const [kind, r] = SEEK_KINDS[i % SEEK_KINDS.length];
    return {
      x: x * b.w + rand(-10, 10),
      y: y * b.h + rand(-8, 8),
      r, kind,
      seed: Math.random(),
      wob: 0,
      hider: -1,
      found: false,
      checked: false,
      look: 0,
      peek: 0,
      peekLeft: 0,
      wait: 1,
      side: 1,
      age: 0,
    };
  });
  spots.sort((a, c) => a.y - c.y);
  const s: SeekState = {
    ...b,
    id: "seek",
    spots,
    hiders: pool.slice(0, want),
    round: 0,
    hiding: 0,
    found: 0,
    foundAll: 0,
    hidAll: 0,
    swapT: 0,
    left: o.cozy ? Infinity : SEEK_TUNING.time,
    misses: 0,
  };
  hide(s);
  return s;
}

function stepSeek(s: SeekState, dt: number, input: Input) {
  const playing = stepClock(s, dt);
  walk(s, dt, input, MINI_SPEED, s.spots);
  const p = s.player;
  const T = SEEK_TUNING;
  for (const spot of s.spots) {
    spot.wob = Math.max(0, spot.wob - dt * 1.6);
    if (spot.found) spot.age += dt;
    // Lean out, or duck back in.
    const target = spot.peekLeft > 0 && !spot.found ? 1 : 0;
    spot.peek += (target - spot.peek) * (1 - Math.exp(-9 * dt));
  }
  if (!playing) return;

  // Everyone scampers off to hide again; the clock waits for them.
  if (s.swapT > 0) {
    s.swapT -= dt;
    if (s.swapT <= 0) {
      s.round++;
      for (const spot of s.spots) if (spot.found) burst(s, spot.x + spot.side * (spot.r + 20), spot.y - 20, "#ffffff", 8, "star", 140);
      hide(s);
      say(s, "Find them again!", 1.2);
      s.events.push({ type: "go" });
    }
    return;
  }

  const before = s.left;
  s.left -= dt;
  if (Number.isFinite(s.left)) countdown(s, before, s.left);

  const every = s.cozy ? T.cozyPeekEvery : T.peekEvery;
  for (const spot of s.spots) {
    if (spot.hider < 0 || spot.found) continue;
    if (spot.peekLeft > 0) {
      spot.peekLeft -= dt;
      continue;
    }
    spot.wait -= dt;
    if (spot.wait <= 0) {
      spot.peekLeft = s.cozy ? T.cozyPeekTime : T.peekTime;
      spot.wait = rand(every[0], every[1]);
      spot.wob = 0.5;
      s.events.push({ type: "peek" });
    }
  }

  // Looking inside takes a moment of pushing into the spot, so brushing past one is safe.
  const mag = Math.hypot(input.x, input.y);
  for (const spot of s.spots) {
    if (spot.checked) continue;
    const d = dist(p, spot);
    const into = mag > 0.25 && d > 0 ? (input.x * (spot.x - p.x) + input.y * (spot.y - p.y)) / (mag * d) : 0;
    if (d > spot.r + PLAYER_R + 6 || into < 0.55 || p.stun > 0) {
      spot.look = Math.max(0, spot.look - dt * 3);
      continue;
    }
    spot.look += dt / T.lookTime;
    spot.wob = Math.max(spot.wob, 0.35);
    if (spot.look < 1) continue;
    spot.look = 0;
    spot.checked = true;
    spot.wob = 1;
    if (spot.hider >= 0) {
      spot.found = true;
      s.found++;
      s.foundAll++;
      popup(s, spot.x, spot.y - 74, "Found you!", "#16a34a", true);
      puff(s, spot.x, spot.y - 40, "#fb7185", 6, "heart");
      burst(s, spot.x, spot.y - 30, "#fde047", 12, "star", 180);
      s.events.push({ type: "score" });
    } else {
      s.misses++;
      burst(s, spot.x, spot.y - spot.r, "#4ade80", 8, "dot", 110);
      if (s.cozy) {
        popup(s, spot.x, spot.y - 70, "Nobody here!", "#64748b", true);
      } else {
        s.left -= T.missCost;
        popup(s, spot.x, spot.y - 70, `Nobody here! -${T.missCost}s`, "#ef4444", true);
      }
      s.events.push({ type: "miss" });
    }
  }

  const rounds = seekRounds(s.cozy).length;
  if (s.found >= s.hiding) {
    if (s.round + 1 < rounds) {
      s.swapT = 2.2;
      say(s, "Found them all! They're hiding again...", 2.2);
      s.events.push({ type: "round" });
      return;
    }
    let medal: Medal;
    if (s.cozy) medal = s.time <= T.cozyMedals[1] ? 3 : s.time <= T.cozyMedals[0] ? 2 : 1;
    else medal = s.left >= T.goldLeft ? 3 : 2;
    finish(s, medal, "You found everyone!", `Found all ${s.foundAll} in ${s.time.toFixed(1)} seconds`);
  } else if (s.left <= 0) {
    // Getting through the first round is worth a bronze.
    finish(s, s.round >= 1 ? 1 : 0, "Time's up!", `Found ${s.foundAll} of ${s.hidAll}`);
  }
}

/* ---------- One front door ---------- */

export type MiniState = TagState | StepsState | SeekState;

export function createMini(id: MiniId, o: CreateMiniOptions): MiniState {
  return id === "tag" ? createTag(o) : id === "steps" ? createSteps(o) : createSeek(o);
}

export function stepMini(m: MiniState, dt: number, input: Input) {
  if (m.id === "tag") stepTag(m, dt, input);
  else if (m.id === "steps") stepSteps(m, dt, input);
  else stepSeek(m, dt, input);
}

/** Seconds left on the clock, or null when this game (or style) has none. */
export function miniClock(m: MiniState): { left: number; total: number } | null {
  if (m.id === "tag") {
    return m.swapT > 0
      ? { left: TAG_TUNING.runTime, total: TAG_TUNING.runTime }
      : { left: Math.max(0, m.left), total: m.round === 1 ? TAG_TUNING.catchTime : TAG_TUNING.runTime };
  }
  if (!Number.isFinite(m.left)) return null;
  return { left: Math.max(0, m.left), total: m.id === "steps" ? STEPS_TUNING.time : SEEK_TUNING.time };
}
