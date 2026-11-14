// ─── Munch Bunch: canvas drawing (glossy cubes + flying bites) ───────────────

import { FLY_MS, type Run } from "./engine";
import { PALETTE, type ColorKey, type Picture, isColorKey } from "./levels";

/** Darken (amt < 0) or lighten (amt > 0) a hex color. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function roundRect(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}

const sprites = new Map<string, HTMLCanvasElement>();

/** A pre-rendered glossy cube, cached per color, size and pixel ratio. */
export function cubeSprite(c: ColorKey, size: number, dpr: number): HTMLCanvasElement {
  const key = `${c}|${size}|${dpr}`;
  const hit = sprites.get(key);
  if (hit) return hit;

  const col = PALETTE[c];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * dpr);
  const x = canvas.getContext("2d")!;
  x.scale(dpr, dpr);
  const p = Math.max(1, size * 0.06), w = size - p * 2, r = w * 0.24;

  roundRect(x, p, p + w * 0.07, w, w * 0.93, r);
  x.fillStyle = shade(col, -0.38);
  x.fill();

  const body = x.createLinearGradient(0, p, 0, p + w);
  body.addColorStop(0, shade(col, 0.28));
  body.addColorStop(1, shade(col, -0.1));
  roundRect(x, p, p, w, w * 0.88, r);
  x.fillStyle = body;
  x.fill();

  const gloss = x.createLinearGradient(0, p + w * 0.07, 0, p + w * 0.45);
  gloss.addColorStop(0, "rgba(255,255,255,.78)");
  gloss.addColorStop(1, "rgba(255,255,255,.04)");
  roundRect(x, p + w * 0.12, p + w * 0.07, w * 0.76, w * 0.36, r * 0.7);
  x.fillStyle = gloss;
  x.fill();

  x.beginPath();
  x.arc(p + w * 0.25, p + w * 0.22, w * 0.075, 0, Math.PI * 2);
  x.fillStyle = "rgba(255,255,255,.95)";
  x.fill();

  sprites.set(key, canvas);
  return canvas;
}

/** How long the picture takes to build itself when a level starts. */
export const BUILD_MS = 640;
/** How long one cube takes to pop in during the build. */
const CUBE_POP_MS = 260;

function backOut(k: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/**
 * Draws the picture. `sinceStartMs` is the time since the level began: for the
 * first BUILD_MS the cubes pop in from the bottom row up, sweeping left to
 * right. Leave it out (or pass Infinity) to draw the finished board.
 */
export function drawBoard(
  x: CanvasRenderingContext2D,
  run: Run,
  cell: number,
  dpr: number,
  sinceStartMs = Infinity,
) {
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, run.cols * cell, run.rows * cell);
  const building = sinceStartMs < BUILD_MS;
  const lastOrder = Math.max(1, run.rows - 1 + (run.cols - 1) * 0.4);
  for (const c of run.cells) {
    const X = c.x * cell, Y = c.y * cell;
    if (c.state === 0) {
      let s = 1;
      if (building) {
        const order = run.rows - 1 - c.y + c.x * 0.4;
        const delay = (order / lastOrder) * (BUILD_MS - CUBE_POP_MS);
        const k = (sinceStartMs - delay) / CUBE_POP_MS;
        if (k <= 0) continue;
        if (k < 1) s = backOut(k);
      }
      if (s === 1) {
        x.drawImage(cubeSprite(c.c, cell, dpr), X, Y, cell, cell);
      } else {
        const d = cell * s;
        x.drawImage(cubeSprite(c.c, cell, dpr), X + (cell - d) / 2, Y + (cell - d) / 2, d, d);
      }
    } else {
      // Ghost of an eaten cube, so you can see the picture disappearing.
      x.fillStyle = "rgba(255,255,255,.05)";
      roundRect(x, X + cell * 0.18, Y + cell * 0.18, cell * 0.64, cell * 0.64, cell * 0.18);
      x.fill();
    }
  }
}

export interface Point { x: number; y: number }

/**
 * Draws cubes flying from the board into their Munchy's mouth on a full-screen
 * overlay. `from` is the cube's on-screen center; `to` is the mouth.
 */
export function drawFlights(
  x: CanvasRenderingContext2D,
  run: Run,
  cell: number,
  dpr: number,
  from: (cx: number, cy: number) => Point,
  to: (slot: number) => Point | null,
) {
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, x.canvas.width / dpr, x.canvas.height / dpr);
  for (const f of run.flights) {
    const target = to(run.slots.indexOf(f.munchy));
    if (!target) continue;
    const start = from(f.cell.x, f.cell.y);
    const k = Math.min(1, f.t / FLY_MS);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const cx = (start.x + target.x) / 2;
    const cy = Math.min(start.y, target.y) - 60 - Math.abs(target.x - start.x) * 0.15;
    const px = (1 - e) * (1 - e) * start.x + 2 * (1 - e) * e * cx + e * e * target.x;
    const py = (1 - e) * (1 - e) * start.y + 2 * (1 - e) * e * cy + e * e * target.y;
    const s = cell * (1 - 0.55 * e);
    x.save();
    x.translate(px, py);
    x.rotate(f.rot * e);
    x.drawImage(cubeSprite(f.cell.c, cell, dpr), -s / 2, -s / 2, s, s);
    x.restore();
  }
}

/** Small flat preview of a picture (used on the win screen). */
export function drawPreview(x: CanvasRenderingContext2D, picture: Picture, cell: number, dpr: number) {
  const rows = picture.art.length;
  const cols = Math.max(...picture.art.map((r) => r.length));
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, cols * cell, rows * cell);
  picture.art.forEach((row, y) =>
    [...row].forEach((ch, X) => {
      if (isColorKey(ch)) x.drawImage(cubeSprite(ch, cell, dpr), X * cell, y * cell, cell, cell);
    }),
  );
}
