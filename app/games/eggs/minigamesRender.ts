// ─── Sneaky Eggs: drawing the mini games ────────────────────────────────────
//
// Each mini game is one small arena that fits on screen whole, so there's no
// camera. Critters, eggs, props and sparkles all come from render.ts, which
// keeps the mini games looking like the rest of the game.

import { BIOMES, ZIP_LOOK, type Look } from "./config";
import {
  STEPS_GOAL_R,
  miniClock,
  type MiniState,
  type Prop,
  type SeekState,
  type StepsState,
  type TagState,
} from "./minigames";
import {
  HOME_GROUND,
  HOME_GROUND_2,
  HOME_PATH,
  TAU,
  drawEgg,
  drawJoystick,
  drawParticles,
  drawPet,
  drawPopups,
  drawSolid,
  ellipse,
  heartPath,
  label,
  progressRing,
  roundRect,
  shade,
  shadow,
  starPath,
  variantLook,
  type Ctx,
  type Joystick,
  type Mood,
} from "./render";

interface Theme {
  ground: string;
  ground2: string;
  path: string;
  fence: string;
  ink: string;
  accent: string;
}

const THEMES: Record<MiniState["id"], Theme> = {
  tag: { ground: BIOMES[0].ground, ground2: BIOMES[0].ground2, path: BIOMES[0].path, fence: BIOMES[0].fence, ink: BIOMES[0].ink, accent: "#0d9488" },
  steps: { ground: BIOMES[1].ground, ground2: BIOMES[1].ground2, path: BIOMES[1].path, fence: BIOMES[1].fence, ink: BIOMES[1].ink, accent: "#ea580c" },
  seek: { ground: HOME_GROUND, ground2: HOME_GROUND_2, path: HOME_PATH, fence: "#d9a066", ink: "#27500f", accent: "#16a34a" },
};

interface Drawable {
  y: number;
  draw: () => void;
}

/** A steady pseudo-random number for index i, so the ground blotches don't jump around. */
const hash = (i: number, salt: number) => (((Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1) + 1) % 1;

/* ---------- Pieces ---------- */

function drawPlayer(ctx: Ctx, m: MiniState, look: Look, t: number) {
  const p = m.player;
  const bob = p.moving ? Math.abs(Math.sin(p.walkT * 11)) * 5 : 0;
  const lean = p.moving ? Math.sin(p.walkT * 11) * 0.05 : 0;
  const won = m.phase === "done" && m.medal > 0;
  const mood: Mood = p.stun > 0 ? "dizzy" : won ? "happy" : "normal";
  const cheer = won ? Math.abs(Math.sin(t * 9)) * 10 : 0;
  shadow(ctx, p.x, p.y + 2, 17, 0.22);
  // Flicker while safe from being tagged again.
  if (p.blink > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.save();
  ctx.translate(p.x, p.y - bob - cheer);
  ctx.rotate(lean + (p.stun > 0 ? Math.sin(t * 30) * 0.12 : 0));
  drawPet(ctx, look, 0, 0, 46, { t, flip: p.flip, mood, seed: 3 });
  ctx.restore();
  ctx.globalAlpha = 1;
  if (p.stun > 0) {
    for (let k = 0; k < 3; k++) {
      const a = t * 7 + (k / 3) * TAU;
      ctx.fillStyle = "#fde047";
      starPath(ctx, p.x + Math.cos(a) * 20, p.y - 52 + Math.sin(a) * 6, 6, 5, 0.5);
      ctx.fill();
    }
  }
}

/** A hay bale or a barrel: the two hiding spots that aren't already scenery in the main game. */
function drawExtraProp(ctx: Ctx, s: Prop) {
  const r = s.r;
  shadow(ctx, s.x, s.y + r * 0.3, r * 1.1, 0.2);
  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.wob > 0) ctx.rotate(Math.sin(s.wob * 20) * s.wob * 0.13);
  if (s.kind === "hay") {
    ctx.fillStyle = "#e9b949";
    roundRect(ctx, -r * 1.05, -r * 1.5, r * 2.1, r * 1.75, 9);
    ctx.fill();
    ctx.fillStyle = "#f6d67a";
    roundRect(ctx, -r * 1.05, -r * 1.5, r * 2.1, r * 0.4, 9);
    ctx.fill();
    ctx.strokeStyle = "#c28f24";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.9 + i * r * 0.38);
      ctx.lineTo(r * 0.85, -r * 0.9 + i * r * 0.38);
      ctx.stroke();
    }
    ctx.fillStyle = "#b45309";
    ctx.fillRect(-r * 0.45, -r * 1.5, 5, r * 1.75);
    ctx.fillRect(r * 0.3, -r * 1.5, 5, r * 1.75);
  } else {
    ctx.fillStyle = "#a0683a";
    roundRect(ctx, -r * 0.9, -r * 1.75, r * 1.8, r * 2, 10);
    ctx.fill();
    ctx.fillStyle = "#b97d4b";
    roundRect(ctx, -r * 0.5, -r * 1.75, r * 0.45, r * 2, 6);
    ctx.fill();
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(-r * 0.9, -r * 1.3, r * 1.8, 5);
    ctx.fillRect(-r * 0.9, -r * 0.35, r * 1.8, 5);
    ctx.fillStyle = "#8a5a33";
    ellipse(ctx, 0, -r * 1.75, r * 0.9, r * 0.24);
    ctx.fill();
  }
  ctx.restore();
}

function drawProp(ctx: Ctx, s: Prop) {
  if (s.kind === "hay" || s.kind === "barrel") drawExtraProp(ctx, s);
  else drawSolid(ctx, { x: s.x, y: s.y, r: s.r, kind: s.kind, seed: s.seed }, s.wob);
}

/** A little speech bubble with one character in it. */
function bubble(ctx: Ctx, x: number, y: number, text: string, color: string) {
  ctx.fillStyle = color;
  ellipse(ctx, x, y, 17, 17);
  ctx.fill();
  label(ctx, text, x, y + 1, 24, "#ffffff");
}

/* ---------- Tag with Zip ---------- */

function drawTag(ctx: Ctx, s: TagState, look: Look, t: number) {
  const items: Drawable[] = [];
  for (const o of s.props) items.push({ y: o.y, draw: () => drawProp(ctx, o) });

  const z = s.zip;
  const p = s.player;
  const chasing = s.round === 2 && s.swapT <= 0;
  items.push({
    y: z.y,
    draw: () => {
      const hop = z.joy > 0 ? Math.abs(Math.sin(t * 12)) * 9 : z.moving ? Math.abs(Math.sin(z.walkT * 11)) * 5 : 0;
      const shake = z.tellT > 0 ? Math.sin(t * 44) * 3 : 0;
      shadow(ctx, z.x, z.y + 2, 16, 0.22);
      ctx.save();
      ctx.translate(z.x + shake, z.y - hop);
      ctx.rotate(z.dashT > 0 || z.jukeT > 0 ? (z.flip ? -0.2 : 0.2) : z.moving ? Math.sin(z.walkT * 11) * 0.05 : 0);
      drawPet(ctx, ZIP_LOOK, 0, 0, 44, { t, flip: z.flip, mood: z.joy > 0 ? "happy" : "normal", seed: 11 });
      ctx.restore();
      if (z.tellT > 0) bubble(ctx, z.x, z.y - 66, "!", "#ef4444");
      else if (z.joy > 0 && s.phase === "play") label(ctx, s.round === 1 ? "Hee hee!" : "Gotcha!", z.x, z.y - 62, 15, "#ffffff", "#0d9488");
    },
  });
  items.push({ y: p.y, draw: () => drawPlayer(ctx, s, look, t) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // A bouncing tag over whoever is "it".
  if (s.phase === "play" && s.swapT <= 0) {
    const it = chasing ? z : p;
    const bounce = Math.abs(Math.sin(t * 5)) * 5;
    const y = it.y - (chasing ? 70 : 74) - bounce - (chasing && z.tellT > 0 ? 30 : 0);
    ctx.fillStyle = chasing ? "#ef4444" : "#f59e0b";
    roundRect(ctx, it.x - 17, y - 11, 34, 22, 9);
    ctx.fill();
    label(ctx, "IT", it.x, y + 1, 14, "#ffffff");
  }
}

/* ---------- Sleepy Steps ---------- */

function drawSteps(ctx: Ctx, s: StepsState, look: Look, t: number, theme: Theme) {
  const dx = s.goal.x - s.start.x;
  const dy = s.goal.y - s.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // The sandy path from the start line to the egg.
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = theme.path;
  ctx.lineCap = "round";
  ctx.lineWidth = 104;
  ctx.beginPath();
  ctx.moveTo(s.start.x - ux * 8, s.start.y - uy * 8);
  ctx.lineTo(s.goal.x, s.goal.y);
  ctx.stroke();
  ctx.restore();
  // Start line.
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(s.start.x - uy * 62 - ux * 26, s.start.y + ux * 62 - uy * 26);
  ctx.lineTo(s.start.x + uy * 62 - ux * 26, s.start.y - ux * 62 - uy * 26);
  ctx.stroke();
  ctx.setLineDash([]);

  // The whole place blushes when the eye is open, so "stop" can't be missed.
  if (s.phase === "play" && (s.eye === "awake" || s.eye === "stir")) {
    ctx.fillStyle = s.eye === "awake" ? "rgba(239, 68, 68, 0.16)" : `rgba(250, 204, 21, ${0.1 + 0.06 * Math.sin(t * 24)})`;
    roundRect(ctx, 0, 0, s.w, s.h, 26);
    ctx.fill();
  }

  const gx = s.goal.x + ux * 92;
  const gy = s.goal.y + uy * 62 + (s.wide ? 34 : 0);
  const items: Drawable[] = [];
  for (const prop of s.scenery) items.push({ y: prop.y, draw: () => drawProp(ctx, prop) });
  items.push({
    y: gy,
    draw: () => {
      const guard = BIOMES[1].guard;
      const asleep = s.eye === "sleep" || s.phase !== "play";
      const breathing = asleep ? 1 + Math.sin(t * 2) * 0.025 : 1;
      const shake = s.eye === "stir" && s.phase === "play" ? Math.sin(t * 40) * 3 : 0;
      const mood: Mood = s.phase === "done" ? (s.medal > 0 ? "sleep" : "angry") : asleep || s.eye === "stir" ? "sleep" : "angry";
      shadow(ctx, gx, gy + 6, 52, 0.22);
      drawPet(ctx, guard, gx + shake, gy + 6, 118 * breathing, { t, flip: s.wide, mood, seed: 1 });
      const bx = gx + (s.wide ? -6 : 58);
      const by = gy - 122;
      if (s.phase !== "play" || s.eye === "sleep") {
        const ph = (t * 0.6) % 1;
        for (let k = 0; k < 3; k++) {
          const q = (ph + k / 3) % 1;
          ctx.globalAlpha = 1 - q;
          label(ctx, "z", bx + q * 26 - 10, by + 30 - q * 40, 15 + q * 13, theme.ink, undefined, 700);
        }
        ctx.globalAlpha = 1;
      } else if (s.eye === "stir") {
        bubble(ctx, bx, by + 6, "?", "#f59e0b");
      } else if (s.eye === "awake") {
        bubble(ctx, bx, by + 6, "!", "#ef4444");
      } else {
        label(ctx, "hmph!", bx, by + 8, 18, "#ffffff", "#475569");
      }
    },
  });
  items.push({
    y: s.goal.y,
    draw: () => {
      const taken = s.phase === "done" && s.medal > 0;
      const glow = ctx.createRadialGradient(s.goal.x, s.goal.y - 24, 6, s.goal.x, s.goal.y - 24, 84);
      glow.addColorStop(0, "rgba(253, 224, 71, 0.7)");
      glow.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = glow;
      ellipse(ctx, s.goal.x, s.goal.y - 24, 84, 84);
      ctx.fill();
      shadow(ctx, s.goal.x, s.goal.y + 4, 26, 0.2);
      const hop = taken ? Math.abs(Math.sin(t * 9)) * 12 : Math.sin(t * 3) * 2;
      drawEgg(ctx, 1, 3, s.goal.x, s.goal.y + 4 - hop, STEPS_GOAL_R * 1.75, t, Math.sin(t * 2) * 0.06);
    },
  });
  items.push({ y: s.player.y, draw: () => drawPlayer(ctx, s, look, t) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

/* ---------- Hide and Seek ---------- */

function drawSeek(ctx: Ctx, s: SeekState, look: Look, t: number) {
  const items: Drawable[] = [];
  for (const spot of s.spots) {
    const hider = spot.hider >= 0 ? s.hiders[spot.hider] : undefined;
    items.push({
      y: spot.y,
      draw: () => {
        // Whoever hides here leans out from behind it now and then.
        if (hider && !spot.found && spot.peek > 0.03) {
          const lean = spot.side * (spot.r + 9) * spot.peek;
          drawPet(ctx, variantLook(hider.look, hider.variant, t, spot.hider), spot.x + lean, spot.y - 1 - spot.peek * 4, 34, {
            t,
            flip: spot.side < 0,
            seed: spot.hider + 20,
          });
        }
        // Spots already looked in fade back so you can tell where you've been.
        if (spot.checked && !spot.found) ctx.globalAlpha = 0.5;
        drawProp(ctx, spot);
        ctx.globalAlpha = 1;
      },
    });
    if (hider && spot.found) {
      const px = spot.x + spot.side * (spot.r + 24);
      items.push({
        y: spot.y + 5,
        draw: () => {
          const born = Math.min(1, spot.age / 0.4);
          const pop = 0.4 + born * 0.6 + Math.sin(born * Math.PI) * 0.3;
          const hop = Math.abs(Math.sin(t * 8 + spot.hider)) * 8;
          shadow(ctx, px, spot.y + 6, 14, 0.18);
          drawPet(ctx, variantLook(hider.look, hider.variant, t, spot.hider), px, spot.y + 5 - hop, 38 * pop, {
            t,
            flip: spot.side > 0,
            mood: "happy",
            seed: spot.hider + 20,
          });
        },
      });
    }
  }
  items.push({ y: s.player.y, draw: () => drawPlayer(ctx, s, look, t) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // Looking inside: a ring fills around the spot, the same as lifting an egg.
  for (const spot of s.spots) {
    if (spot.look > 0 && !spot.checked) progressRing(ctx, spot.x, spot.y - spot.r * 0.7, spot.r + 16, spot.look, "#22c55e", 7);
  }
}

/* ---------- The whole frame ---------- */

function statusOf(m: MiniState): { text: string; color: string } {
  if (m.phase === "ready") return { text: "Get ready...", color: "#64748b" };
  if (m.id === "tag") {
    if (m.swapT > 0) return { text: "Get ready to run!", color: "#ef4444" };
    return m.round === 1 ? { text: "You're it! Tag Zip!", color: "#f59e0b" } : { text: "Run from Zip!", color: "#ef4444" };
  }
  if (m.id === "steps") {
    if (m.phase === "done") return { text: m.medal > 0 ? "You did it!" : "So close!", color: "#64748b" };
    if (m.eye === "awake" || m.eye === "huff") return { text: "FREEZE!", color: "#ef4444" };
    if (m.eye === "stir") return { text: "Careful...", color: "#f59e0b" };
    return { text: "Sneak!", color: "#16a34a" };
  }
  return { text: `Round ${Math.min(m.round + 1, 2)} of 2: find ${m.hiding}`, color: "#16a34a" };
}

function instructionOf(m: MiniState): string {
  if (m.id === "tag") return "Tag Zip as many times as you can!";
  if (m.id === "steps") return "Stop moving when the eye opens!";
  return "Push into a hiding spot to look inside!";
}

function drawHud(ctx: Ctx, m: MiniState, w: number, t: number, ui: number) {
  ctx.save();
  ctx.translate(12 * ui, 12 * ui);
  ctx.scale(ui, ui);
  const barW = Math.max(150, Math.min(280, w / ui - 150));

  // What to do right now.
  const status = statusOf(m);
  ctx.font = `700 15px "Fredoka", "Inter", system-ui, sans-serif`;
  const tw = Math.min(barW + 40, ctx.measureText(status.text).width + 24);
  ctx.fillStyle = status.color;
  roundRect(ctx, 0, 0, tw, 28, 14);
  ctx.fill();
  label(ctx, status.text, tw / 2, 15, 15, "#ffffff");

  // The clock.
  const clock = miniClock(m);
  const y = 36;
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  roundRect(ctx, 0, y, barW, 14, 7);
  ctx.fill();
  if (clock) {
    const k = Math.max(0, Math.min(1, clock.left / clock.total));
    const urgent = clock.left <= 5 && m.phase === "play";
    ctx.fillStyle = urgent ? (Math.floor(t * 6) % 2 ? "#ef4444" : "#fb7185") : k < 0.4 ? "#f59e0b" : "#22c55e";
    roundRect(ctx, 2, y + 2, Math.max(8, (barW - 4) * k), 10, 5);
    ctx.fill();
    label(ctx, `${Math.ceil(clock.left)}s`, barW + 22, y + 8, 15, "#ffffff", "rgba(15, 23, 42, 0.6)");
  } else {
    // Cozy style has no clock to beat; show how long it's been instead.
    ctx.fillStyle = "#38bdf8";
    roundRect(ctx, 2, y + 2, barW - 4, 10, 5);
    ctx.fill();
    label(ctx, `${Math.floor(m.time)}s`, barW + 22, y + 8, 15, "#ffffff", "rgba(15, 23, 42, 0.6)");
  }

  // The score.
  const sy = 68;
  if (m.id === "tag") {
    for (let i = 0; i < Math.max(3, m.catches); i++) {
      ctx.fillStyle = i < m.catches ? "#fde047" : "rgba(15, 23, 42, 0.3)";
      starPath(ctx, 11 + i * 22, sy, 9, 5, 0.5);
      ctx.fill();
    }
    const hx = Math.max(3, m.catches) * 22 + 22;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < m.hearts ? "#fb7185" : "rgba(15, 23, 42, 0.3)";
      heartPath(ctx, hx + i * 22, sy - 1, 8);
      ctx.fill();
    }
  } else if (m.id === "seek") {
    for (let i = 0; i < m.hiding; i++) {
      ctx.fillStyle = i < m.found ? "#22c55e" : "rgba(15, 23, 42, 0.3)";
      ellipse(ctx, 10 + i * 24, sy, 9, 9);
      ctx.fill();
      if (i < m.found) label(ctx, "✓", 10 + i * 24, sy + 1, 12, "#ffffff");
    }
  } else if (m.spotted > 0) {
    label(ctx, `Spotted ${m.spotted}×`, 44, sy, 14, "#ffffff", "rgba(15, 23, 42, 0.6)");
  }
  ctx.restore();
}

/** Draw one frame of a mini game, filling a w×h canvas. */
export function renderMini(
  ctx: Ctx,
  m: MiniState,
  w: number,
  h: number,
  dpr: number,
  t: number,
  joy: Joystick | null,
  playerLook: Look,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const big = Math.min(w, h) >= 700;
  const ui = big ? 1.35 : 1;
  const top = 92 * ui;
  const scale = Math.min((w - 16) / m.w, (h - top - 12) / m.h, 1.7);
  const ox = (w - m.w * scale) / 2;
  const oy = top + (h - top - 12 - m.h * scale) / 2;
  const theme = THEMES[m.id];

  ctx.fillStyle = shade(theme.ground, -0.22);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // The arena floor, with a few soft blotches and a fence around it.
  ctx.save();
  roundRect(ctx, 0, 0, m.w, m.h, 26);
  ctx.fillStyle = theme.ground;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = theme.ground2;
  for (let i = 0; i < 9; i++) {
    ellipse(ctx, hash(i, 1) * m.w, hash(i, 2) * m.h, 50 + hash(i, 3) * 70, 22 + hash(i, 4) * 26);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = theme.fence;
  ctx.lineWidth = 9;
  roundRect(ctx, 0, 0, m.w, m.h, 26);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2.5;
  roundRect(ctx, 3, 3, m.w - 6, m.h - 6, 23);
  ctx.stroke();

  if (m.id === "tag") drawTag(ctx, m, playerLook, t);
  else if (m.id === "steps") drawSteps(ctx, m, playerLook, t, theme);
  else drawSeek(ctx, m, playerLook, t);

  drawParticles(ctx, m.particles);
  drawPopups(ctx, m.popups);
  ctx.restore();

  drawHud(ctx, m, w, t, ui);

  // Big words: the countdown, "Go!", and whatever just happened.
  const cx = w / 2;
  const cy = oy + m.h * scale * (m.id === "steps" && !m.wide ? 0.52 : 0.4);
  if (m.phase === "ready") {
    const n = Math.ceil(m.readyT);
    const pop = 1 + (1 - (n - m.readyT)) * 0.35;
    label(ctx, String(n), cx, cy, 86 * ui * pop, "#ffffff", theme.accent);
    label(ctx, instructionOf(m), cx, cy + 74 * ui, Math.min(22 * ui, (w - 32) / 15), "#ffffff", theme.accent);
  } else if (m.phase === "play" && m.time < 0.7 && m.bannerT <= 0) {
    label(ctx, "Go!", cx, cy, 72 * ui * (1 + m.time * 0.3), "#ffffff", theme.accent);
  } else if (m.bannerT > 0) {
    const size = Math.min(40 * ui, (w - 32) / (m.banner.length * 0.52));
    const grow = m.phase === "done" ? 1 + Math.sin(Math.min(1, m.doneT * 3) * Math.PI) * 0.2 : 1;
    label(ctx, m.banner, cx, cy, size * grow, "#ffffff", m.phase === "done" && m.medal === 0 ? "#64748b" : theme.accent);
  }

  if (joy) drawJoystick(ctx, joy);
}
