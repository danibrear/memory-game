// ─── Hole Drop: 2.5D city renderer (plain Canvas 2D) ─────────────────────────

import { BLOCK, HK, MAX_LEAN, PERSP, ROAD, TILT, WALK } from "./config";
import { fits, ranking, type Game, type Hole } from "./engine";
import type { Block, Obj } from "./world";

interface View {
  W: number;
  H: number;
  cx: number;
  cy: number;
  camX: number;
  camY: number;
  zoom: number;
  time: number;
}

export interface Joystick {
  active: boolean;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt];

// ─── Color helpers ────────────────────────────────────────────────────────────

const shadeCache = new Map<string, string>();
/** f < 1 darkens toward black, f > 1 lightens toward white. */
function shade(hex: string, f: number): string {
  const key = hex + f;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = Number.parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f <= 1) {
    r *= f;
    g *= f;
    b *= f;
  } else {
    const t = Math.min(1, f - 1);
    r += (255 - r) * t;
    g += (255 - g) * t;
    b += (255 - b) * t;
  }
  const out = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, out);
  return out;
}

export function holeColor(h: Hole, time: number) {
  return h.rainbow ? `hsl(${(time * 90 + h.id * 40) % 360},95%,62%)` : h.color;
}

// ─── Projection ───────────────────────────────────────────────────────────────

function pr(v: View, x: number, y: number, z: number): Pt {
  const bx = (x - v.camX) * v.zoom + v.cx;
  const by = (y - v.camY) * v.zoom * TILT + v.cy;
  if (z === 0) return [bx, by];
  const k = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, z * v.zoom * PERSP));
  return [bx + (bx - v.cx) * k, by - z * v.zoom * HK + (by - v.cy) * k * 0.35];
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Bilinear point on a face quad (a=bottom-left, b=bottom-right, c=top-right, d=top-left). */
function bl(q: Quad, u: number, v: number): Pt {
  return lerpPt(lerpPt(q[0], q[1], u), lerpPt(q[3], q[2], u), v);
}

function subQuad(ctx: CanvasRenderingContext2D, q: Quad, u0: number, u1: number, v0: number, v1: number) {
  const a = bl(q, u0, v0);
  const b = bl(q, u1, v0);
  const c = bl(q, u1, v1);
  const d = bl(q, u0, v1);
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

interface Faces {
  front: Quad;
  side: Quad | null;
  top: Quad;
}

function box(
  ctx: CanvasRenderingContext2D,
  v: View,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  color: string,
  topColor?: string,
): Faces {
  const bSW = pr(v, x0, y1, z0);
  const bSE = pr(v, x1, y1, z0);
  const bNE = pr(v, x1, y0, z0);
  const bNW = pr(v, x0, y0, z0);
  const tSW = pr(v, x0, y1, z1);
  const tSE = pr(v, x1, y1, z1);
  const tNE = pr(v, x1, y0, z1);
  const tNW = pr(v, x0, y0, z1);
  let side: Quad | null = null;
  if (tSE[0] < bSE[0] - 0.4) {
    side = [bSE, bNE, tNE, tSE];
    poly(ctx, side, shade(color, 0.72));
  } else if (tSW[0] > bSW[0] + 0.4) {
    side = [bNW, bSW, tSW, tNW];
    poly(ctx, side, shade(color, 0.72));
  }
  const front: Quad = [bSW, bSE, tSE, tSW];
  poly(ctx, front, shade(color, 0.88));
  const top: Quad = [tSW, tSE, tNE, tNW];
  poly(ctx, top, topColor ?? shade(color, 1.08));
  return { front, side, top };
}

function cyl(
  ctx: CanvasRenderingContext2D,
  v: View,
  x: number,
  y: number,
  r: number,
  z0: number,
  z1: number,
  color: string,
  topColor?: string,
) {
  const pb = pr(v, x, y, z0);
  const pt = pr(v, x, y, z1);
  const rx = r * v.zoom;
  const ry = rx * TILT;
  ctx.beginPath();
  ctx.ellipse(pb[0], pb[1], rx, ry, 0, 0, Math.PI);
  ctx.lineTo(pt[0] - rx, pt[1]);
  ctx.ellipse(pt[0], pt[1], rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = shade(color, 0.85);
  ctx.fill();
  // soft highlight strip
  if (rx > 6) {
    ctx.beginPath();
    ctx.moveTo(pb[0] - rx * 0.55, pb[1] + ry * 0.8);
    ctx.lineTo(pt[0] - rx * 0.55, pt[1] + ry * 0.8);
    ctx.lineTo(pt[0] - rx * 0.25, pt[1] + ry * 0.97);
    ctx.lineTo(pb[0] - rx * 0.25, pb[1] + ry * 0.97);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(pt[0], pt[1], rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = topColor ?? shade(color, 1.1);
  ctx.fill();
}

function ball(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, z: number, r: number, color: string) {
  const p = pr(v, x, y, z);
  const R = r * v.zoom;
  if (R < 4) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(p[0], p[1], R, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, 0.8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p[0] - R * 0.08, p[1] - R * 0.1, R * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p[0] - R * 0.35, p[1] - R * 0.38, R * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, 1.35);
  ctx.fill();
}

// ─── Object sprites ───────────────────────────────────────────────────────────

function drawPerson(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const { x, y } = o;
  const hop = o.panic > 0 ? Math.abs(Math.sin(o.anim)) * 3 : 0;
  const zb = z + hop;
  if (v.zoom < 0.55) {
    ball(ctx, v, x, y, zb + 9, 4, o.c1);
    return;
  }
  const step = Math.sin(o.anim) * 1.4;
  box(ctx, v, x - 2.6, y - 1.4 + step * 0.3, x - 0.4, y + 1.4 + step * 0.3, zb, zb + 6, "#334155");
  box(ctx, v, x + 0.4, y - 1.4 - step * 0.3, x + 2.6, y + 1.4 - step * 0.3, zb, zb + 6, "#334155");
  box(ctx, v, x - 3.2, y - 2, x + 3.2, y + 2, zb + 6, zb + 14, o.c1);
  if (o.panic > 0) {
    const sh = Math.sin(o.anim * 1.3) * 1.5;
    ctx.strokeStyle = o.c2;
    ctx.lineWidth = Math.max(1, 1.6 * v.zoom);
    ctx.lineCap = "round";
    ctx.beginPath();
    const l0 = pr(v, x - 3.6, y, zb + 13);
    const l1 = pr(v, x - 5.5, y, zb + 19 + sh);
    const r0 = pr(v, x + 3.6, y, zb + 13);
    const r1 = pr(v, x + 5.5, y, zb + 19 - sh);
    ctx.moveTo(l0[0], l0[1]);
    ctx.lineTo(l1[0], l1[1]);
    ctx.moveTo(r0[0], r0[1]);
    ctx.lineTo(r1[0], r1[1]);
    ctx.stroke();
  }
  const hp = pr(v, x, y, zb + 17.5);
  const R = 3.7 * v.zoom;
  ctx.beginPath();
  ctx.arc(hp[0], hp[1], R, 0, Math.PI * 2);
  ctx.fillStyle = o.c2;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hp[0], hp[1] - R * 0.25, R * 1.02, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fillStyle = o.c3;
  ctx.fill();
}

function canopy(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, z: number, R: number, color: string) {
  const p = pr(v, x, y, z);
  const r = R * v.zoom;
  if (r < 9) {
    ctx.fillStyle = shade(color, 0.78);
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, 1.12);
    ctx.beginPath();
    ctx.arc(p[0] - r * 0.2, p[1] - r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = shade(color, 0.72);
  ctx.beginPath();
  ctx.arc(p[0] + r * 0.06, p[1] + r * 0.14, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p[0] - r * 0.05, p[1] - r * 0.02, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  const t = pr(v, x - R * 0.15, y, z + R * 0.55);
  ctx.beginPath();
  ctx.arc(t[0], t[1], r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, 1.1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(t[0] - r * 0.22, t[1] - r * 0.2, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, 1.32);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const s = o.w / 30;
  cyl(ctx, v, o.x, o.y, 3.4 * s, z, z + o.h * 0.42, o.c2);
  canopy(ctx, v, o.x, o.y, z + o.h * 0.66, o.w * 0.5, o.c1);
}

function drawPine(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const s = o.w / 28;
  cyl(ctx, v, o.x, o.y, 3 * s, z, z + o.h * 0.25, o.c2);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const zt = z + o.h * (0.18 + i * 0.22);
    const half = (o.w / 2) * (1 - i * 0.24);
    const left = pr(v, o.x - half, o.y + 2, zt);
    const right = pr(v, o.x + half, o.y + 2, zt);
    const apex = pr(v, o.x, o.y, zt + o.h * 0.38);
    const mid = pr(v, o.x, o.y + 2, zt);
    poly(ctx, [left, right, apex], o.c1);
    poly(ctx, [mid, right, apex], shade(o.c1, 0.8));
  }
}

function drawBush(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const r = o.w * 0.36;
  ball(ctx, v, o.x - o.w * 0.22, o.y + 1, z + r * 0.9, r, o.c1);
  ball(ctx, v, o.x + o.w * 0.22, o.y + 1, z + r * 0.9, r * 0.95, o.c1);
  ball(ctx, v, o.x, o.y - 2, z + r * 1.3, r * 1.05, o.c1);
  if (o.c2 !== o.c1 && v.zoom > 0.6) {
    ctx.fillStyle = o.c2;
    for (let i = 0; i < 4; i++) {
      const a = o.seed * 10 + i * 1.7;
      const p = pr(v, o.x + Math.cos(a) * r * 0.8, o.y + Math.sin(a) * r * 0.3, z + r * 1.5 + Math.sin(a * 3) * 2);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.6 * v.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  cyl(ctx, v, o.x, o.y, 2.6, z, z + 2, o.c1);
  cyl(ctx, v, o.x, o.y, 1.3, z + 2, z + 46, o.c1);
  box(ctx, v, o.x - 3.5, o.y - 3.5, o.x + 3.5, o.y + 3.5, z + 46, z + 50, "#334155");
  const p = pr(v, o.x, o.y, z + 45);
  ctx.beginPath();
  ctx.arc(p[0], p[1], 3.2 * v.zoom, 0, Math.PI * 2);
  ctx.fillStyle = o.c2;
  ctx.fill();
}

function wedgeCanopy(
  ctx: CanvasRenderingContext2D,
  v: View,
  x: number,
  y: number,
  zRim: number,
  zTop: number,
  R: number,
  a: string,
  b: string,
) {
  const apex = pr(v, x, y, zTop);
  const n = 8;
  const rim: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    rim.push(pr(v, x + Math.cos(t) * R, y + Math.sin(t) * R, zRim));
  }
  for (let i = 0; i < n; i++) poly(ctx, [apex, rim[i], rim[i + 1]], i % 2 ? a : b);
}

function drawUmbrella(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  cyl(ctx, v, o.x, o.y, 9, z + 8, z + 9.5, "#f1f5f9");
  cyl(ctx, v, o.x, o.y, 1, z, z + 26, "#94a3b8");
  wedgeCanopy(ctx, v, o.x, o.y, z + 23, z + o.h, 13, o.c1, o.c2);
}

function drawCart(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const f = box(ctx, v, x0, y0, x1, y1, z + 5, z + 19, o.c1);
  ctx.beginPath();
  subQuad(ctx, f.front, 0, 1, 0.55, 0.75);
  ctx.fillStyle = o.c2;
  ctx.fill();
  for (const wx of [x0 + 6, x1 - 6]) {
    const p = pr(v, wx, y1, z + 4);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.5 * v.zoom, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
  }
  cyl(ctx, v, o.x, o.y, 1, z + 19, z + 28, "#94a3b8");
  wedgeCanopy(ctx, v, o.x, o.y, z + 26, z + o.h, 15, o.c2, "#ffffff");
}

function wheels(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const horiz = o.w >= o.d;
  const y1 = o.y + o.d / 2;
  ctx.fillStyle = "#1f2937";
  const r = 4 * v.zoom;
  if (horiz) {
    for (const wx of [o.x - o.w * 0.3, o.x + o.w * 0.3]) {
      const p = pr(v, wx, y1, z + 3);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r, r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const wx of [o.x - o.w / 2 + 2, o.x + o.w / 2 - 2]) {
      const p = pr(v, wx, y1 - 5, z + 3);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r * 0.55, r * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCar(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const horiz = o.w >= o.d;
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  wheels(ctx, v, o, z);
  const body = box(ctx, v, x0, y0, x1, y1, z + 3, z + 11, o.c1);
  // Lights on the visible end of a north/south car.
  if (!horiz) {
    const front = o.motion.type === "car" ? o.motion.dir === 1 : true;
    ctx.beginPath();
    subQuad(ctx, body.front, 0.1, 0.28, 0.45, 0.8);
    subQuad(ctx, body.front, 0.72, 0.9, 0.45, 0.8);
    ctx.fillStyle = front ? "#fef9c3" : "#ef4444";
    ctx.fill();
  }
  const glass = o.c2;
  let cx0: number, cx1: number, cy0: number, cy1: number;
  if (horiz) {
    cx0 = x0 + o.w * 0.24;
    cx1 = x1 - o.w * 0.2;
    cy0 = y0 + 2;
    cy1 = y1 - 2;
  } else {
    cx0 = x0 + 2;
    cx1 = x1 - 2;
    cy0 = y0 + o.d * 0.24;
    cy1 = y1 - o.d * 0.22;
  }
  const cab = box(ctx, v, cx0, cy0, cx1, cy1, z + 11, z + 18.5, glass, shade(o.c1, 1.12));
  if (horiz) {
    ctx.beginPath();
    subQuad(ctx, cab.front, 0.47, 0.53, 0, 1);
    ctx.fillStyle = shade(o.c1, 0.85);
    ctx.fill();
  }
}

function drawVan(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  wheels(ctx, v, o, z);
  const f = box(ctx, v, x0, y0, x1, y1, z + 3, z + o.h, o.c1);
  ctx.beginPath();
  if (o.w >= o.d) {
    subQuad(ctx, f.front, 0.06, 0.3, 0.5, 0.85);
    subQuad(ctx, f.front, 0.36, 0.62, 0.5, 0.85);
  } else subQuad(ctx, f.front, 0.12, 0.88, 0.5, 0.85);
  ctx.fillStyle = o.c2;
  ctx.fill();
}

function drawBus(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  wheels(ctx, v, o, z);
  const f = box(ctx, v, x0, y0, x1, y1, z + 3, z + o.h, o.c1);
  ctx.beginPath();
  if (o.w >= o.d) {
    const n = 6;
    for (let i = 0; i < n; i++) subQuad(ctx, f.front, 0.04 + i * 0.16, 0.17 + i * 0.16, 0.48, 0.84);
  } else {
    subQuad(ctx, f.front, 0.1, 0.9, 0.5, 0.86);
  }
  if (f.side) {
    const n = 2;
    for (let i = 0; i < n; i++) subQuad(ctx, f.side, 0.1 + i * 0.45, 0.45 + i * 0.45, 0.5, 0.84);
  }
  ctx.fillStyle = o.c2;
  ctx.fill();
  ctx.beginPath();
  subQuad(ctx, f.top, 0.08, 0.92, 0.2, 0.8);
  ctx.fillStyle = shade(o.c1, 1.2);
  ctx.fill();
}

function drawHouse(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const eave = z + o.h * 0.56;
  const ridge = z + o.h;
  const walls = box(ctx, v, x0, y0, x1, y1, z, eave, o.c1);
  // door + windows
  ctx.beginPath();
  subQuad(ctx, walls.front, 0.43, 0.57, 0, 0.62);
  ctx.fillStyle = o.c3;
  ctx.fill();
  ctx.beginPath();
  subQuad(ctx, walls.front, 0.12, 0.3, 0.32, 0.76);
  subQuad(ctx, walls.front, 0.7, 0.88, 0.32, 0.76);
  if (walls.side) subQuad(ctx, walls.side, 0.35, 0.65, 0.32, 0.76);
  ctx.fillStyle = "#bfe9ff";
  ctx.fill();

  const ym = o.y;
  const o3 = 4;
  const back: Pt[] = [pr(v, x0 - o3, y0 - o3, eave), pr(v, x1 + o3, y0 - o3, eave), pr(v, x1 + o3, ym, ridge), pr(v, x0 - o3, ym, ridge)];
  poly(ctx, back, shade(o.c2, 0.7));
  // gable ends
  if (walls.side) {
    const gx = walls.side[0] === walls.front[1] ? x1 : x0;
    poly(ctx, [pr(v, gx, y0, eave), pr(v, gx, y1, eave), pr(v, gx, ym, ridge)], shade(o.c1, 0.7));
  }
  // chimney
  box(ctx, v, x1 - o.w * 0.3, y0 + o.d * 0.18, x1 - o.w * 0.3 + 9, y0 + o.d * 0.18 + 9, eave, ridge + 6, "#c2410c");
  const front: Pt[] = [pr(v, x0 - o3, y1 + o3, eave), pr(v, x1 + o3, y1 + o3, eave), pr(v, x1 + o3, ym, ridge), pr(v, x0 - o3, ym, ridge)];
  poly(ctx, front, o.c2);
  ctx.strokeStyle = shade(o.c2, 1.25);
  ctx.lineWidth = Math.max(1, 1.5 * v.zoom);
  ctx.beginPath();
  ctx.moveTo(front[3][0], front[3][1]);
  ctx.lineTo(front[2][0], front[2][1]);
  ctx.stroke();
}

function drawFountain(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number, time: number) {
  const R = o.w / 2;
  cyl(ctx, v, o.x, o.y, R, z, z + 10, o.c1);
  const wp = pr(v, o.x, o.y, z + 10);
  ctx.beginPath();
  ctx.ellipse(wp[0], wp[1], (R - 5) * v.zoom, (R - 5) * v.zoom * TILT, 0, 0, Math.PI * 2);
  ctx.fillStyle = o.c2;
  ctx.fill();
  const rip = (time * 0.6 + o.seed) % 1;
  ctx.beginPath();
  ctx.ellipse(wp[0], wp[1], (R - 5) * v.zoom * (0.3 + rip * 0.7), (R - 5) * v.zoom * TILT * (0.3 + rip * 0.7), 0, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - rip)})`;
  ctx.lineWidth = Math.max(1, 1.5 * v.zoom);
  ctx.stroke();
  cyl(ctx, v, o.x, o.y, 5, z + 10, z + 22, o.c3);
  cyl(ctx, v, o.x, o.y, R * 0.32, z + 21, z + 24, o.c1, o.c2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + time;
    const t = (time * 1.4 + i * 0.37) % 1;
    const dist = R * 0.32 + t * R * 0.4;
    const zz = z + 24 + Math.sin(t * Math.PI) * 10;
    const p = pr(v, o.x + Math.cos(a) * dist, o.y + Math.sin(a) * dist, zz);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 1.8 * v.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roofDetails(ctx: CanvasRenderingContext2D, v: View, o: Obj, top: Quad, z: number) {
  ctx.beginPath();
  subQuad(ctx, top, 0.07, 0.93, 0.07, 0.93);
  ctx.fillStyle = shade(o.c1, 0.95);
  ctx.fill();
  if (o.w > 60) {
    const ax = o.x + o.w * 0.12;
    const ay = o.y - o.d * 0.1;
    box(ctx, v, ax, ay, ax + 18, ay + 14, z, z + 9, "#cbd5e1");
  }
}

function drawShop(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const f = box(ctx, v, x0, y0, x1, y1, z, z + o.h, o.c1);
  // big ground floor windows
  ctx.beginPath();
  subQuad(ctx, f.front, 0.06, 0.4, 0.04, 0.38);
  subQuad(ctx, f.front, 0.6, 0.94, 0.04, 0.38);
  ctx.fillStyle = "#bfe9ff";
  ctx.fill();
  ctx.beginPath();
  subQuad(ctx, f.front, 0.44, 0.56, 0, 0.36);
  ctx.fillStyle = "#475569";
  ctx.fill();
  // upper windows
  ctx.beginPath();
  const cols = Math.max(2, Math.round(o.w / 30));
  for (let i = 0; i < cols; i++) {
    const u0 = 0.08 + (i / cols) * 0.86;
    subQuad(ctx, f.front, u0, u0 + 0.86 / cols - 0.08, 0.62, 0.84);
  }
  if (f.side) {
    subQuad(ctx, f.side, 0.15, 0.45, 0.62, 0.84);
    subQuad(ctx, f.side, 0.55, 0.85, 0.62, 0.84);
  }
  ctx.fillStyle = "#dbeafe";
  ctx.fill();
  // striped awning sticking out over the sidewalk
  const az = z + o.h * 0.47;
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const ax0 = x0 + 4 + ((o.w - 8) / stripes) * i;
    const ax1 = ax0 + (o.w - 8) / stripes;
    poly(
      ctx,
      [pr(v, ax0, y1, az + 7), pr(v, ax1, y1, az + 7), pr(v, ax1, y1 + 12, az - 2), pr(v, ax0, y1 + 12, az - 2)],
      i % 2 ? o.c2 : o.c3,
    );
  }
  roofDetails(ctx, v, o, f.top, z + o.h);
}

function windowGrid(ctx: CanvasRenderingContext2D, q: Quad, cols: number, rows: number, color: string, wide = 0.62, tall = 0.6) {
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const v0 = 0.04 + (r / rows) * 0.92;
    const v1 = v0 + (0.92 / rows) * tall;
    for (let c = 0; c < cols; c++) {
      const u0 = 0.06 + (c / cols) * 0.88;
      subQuad(ctx, q, u0, u0 + (0.88 / cols) * wide, v0, v1);
    }
  }
  ctx.fillStyle = color;
  ctx.fill();
}

function drawOffice(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const f = box(ctx, v, x0, y0, x1, y1, z, z + o.h, o.c1);
  const rows = Math.max(3, Math.floor(o.h / 24));
  const detail = v.zoom > 0.35;
  if (detail) {
    windowGrid(ctx, f.front, Math.max(3, Math.round(o.w / 24)), rows, "#cfe8ff");
    if (f.side) windowGrid(ctx, f.side, Math.max(3, Math.round(o.d / 24)), rows, "#9fc6ea");
  }
  roofDetails(ctx, v, o, f.top, z + o.h);
}

function drawTower(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const hMain = o.h * 0.82;
  const f = box(ctx, v, x0, y0, x1, y1, z, z + hMain, o.c1);
  const ribbons = (q: Quad, n: number, color: string) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const u0 = 0.07 + (i / n) * 0.86;
      subQuad(ctx, q, u0, u0 + (0.86 / n) * 0.55, 0.03, 0.97);
    }
    ctx.fillStyle = color;
    ctx.fill();
  };
  ribbons(f.front, Math.max(4, Math.round(o.w / 22)), "#cfe8ff");
  if (f.side) ribbons(f.side, Math.max(4, Math.round(o.d / 22)), "#9fc6ea");
  roofDetails(ctx, v, o, f.top, z + hMain);
  const inset = o.w * 0.2;
  const t = box(ctx, v, x0 + inset, y0 + inset, x1 - inset, y1 - inset, z + hMain, z + o.h, o.c1);
  ctx.beginPath();
  subQuad(ctx, t.front, 0.15, 0.85, 0.3, 0.7);
  ctx.fillStyle = "#cfe8ff";
  ctx.fill();
  const a0 = pr(v, o.x, o.y, z + o.h);
  const a1 = pr(v, o.x, o.y, z + o.h + 34);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = Math.max(1, 2 * v.zoom);
  ctx.beginPath();
  ctx.moveTo(a0[0], a0[1]);
  ctx.lineTo(a1[0], a1[1]);
  ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(a1[0], a1[1], 2.5 * v.zoom, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyscraper(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = o.y - o.d / 2;
  const y1 = o.y + o.d / 2;
  const f = box(ctx, v, x0, y0, x1, y1, z, z + o.h, o.c1);
  const bands = (q: Quad, light: string) => {
    const n = Math.floor(o.h / 20);
    ctx.beginPath();
    for (let i = 0; i < n; i++) subQuad(ctx, q, 0, 1, i / n + 0.012, i / n + 0.03);
    ctx.fillStyle = light;
    ctx.fill();
    ctx.beginPath();
    subQuad(ctx, q, 0, 0.04, 0, 1);
    subQuad(ctx, q, 0.96, 1, 0, 1);
    subQuad(ctx, q, 0.48, 0.52, 0, 1);
    ctx.fillStyle = shade(o.c1, 0.65);
    ctx.fill();
  };
  bands(f.front, "rgba(255,255,255,0.45)");
  if (f.side) bands(f.side, "rgba(255,255,255,0.28)");
  // glossy reflection streak
  ctx.beginPath();
  subQuad(ctx, f.front, 0.12, 0.22, 0.2, 0.95);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
  // helipad
  ctx.beginPath();
  subQuad(ctx, f.top, 0.06, 0.94, 0.06, 0.94);
  ctx.fillStyle = "#475569";
  ctx.fill();
  const c = bl(f.top, 0.5, 0.5);
  const rr = o.w * 0.32 * v.zoom;
  ctx.beginPath();
  ctx.ellipse(c[0], c[1], rr, rr * TILT, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = Math.max(1, 2.5 * v.zoom);
  ctx.stroke();
  if (v.zoom > 0.25) {
    ctx.beginPath();
    subQuad(ctx, f.top, 0.38, 0.44, 0.35, 0.65);
    subQuad(ctx, f.top, 0.56, 0.62, 0.35, 0.65);
    subQuad(ctx, f.top, 0.44, 0.56, 0.47, 0.53);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
  }
}

function drawSmall(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  switch (o.kind) {
    case "cone": {
      box(ctx, v, o.x - 4.5, o.y - 4.5, o.x + 4.5, o.y + 4.5, z, z + 1.5, shade(o.c1, 0.85));
      const l = pr(v, o.x - 3.6, o.y + 1, z + 1.5);
      const r = pr(v, o.x + 3.6, o.y + 1, z + 1.5);
      const a = pr(v, o.x, o.y, z + o.h);
      poly(ctx, [l, r, a], o.c1);
      const s0 = 0.38;
      const s1 = 0.58;
      poly(ctx, [lerpPt(l, a, s0), lerpPt(r, a, s0), lerpPt(r, a, s1), lerpPt(l, a, s1)], o.c2);
      break;
    }
    case "hydrant": {
      cyl(ctx, v, o.x, o.y, 3.4, z, z + 10, o.c1);
      ball(ctx, v, o.x, o.y, z + 10.5, 3.4, o.c1);
      ball(ctx, v, o.x - 4, o.y + 1, z + 6.5, 1.6, o.c1);
      ball(ctx, v, o.x + 4, o.y + 1, z + 6.5, 1.6, o.c1);
      break;
    }
    case "trash":
      cyl(ctx, v, o.x, o.y, 5, z, z + 14, o.c1, o.c2);
      break;
    case "flower": {
      cyl(ctx, v, o.x, o.y, 5, z, z + 7, o.c1);
      ball(ctx, v, o.x, o.y, z + 9, 3.5, o.c3);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + o.seed * 6;
        ball(ctx, v, o.x + Math.cos(a) * 3, o.y + Math.sin(a) * 2, z + 11 + i, 2.6, o.c2);
      }
      break;
    }
    case "ball": {
      ball(ctx, v, o.x, o.y, z + 4.5, 4.5, o.c1);
      const p = pr(v, o.x, o.y, z + 4.5);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 1.6 * v.zoom, 4.2 * v.zoom, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = o.c2;
      ctx.fill();
      break;
    }
    case "mailbox": {
      box(ctx, v, o.x - 1, o.y - 1, o.x + 1, o.y + 1, z, z + 7, "#475569");
      const f = box(ctx, v, o.x - 4.5, o.y - 3.5, o.x + 4.5, o.y + 3.5, z + 7, z + 14, o.c1);
      ctx.beginPath();
      subQuad(ctx, f.front, 0.25, 0.75, 0.6, 0.75);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      break;
    }
    case "bench": {
      const horiz = o.w >= o.d;
      const x0 = o.x - o.w / 2;
      const x1 = o.x + o.w / 2;
      const y0 = o.y - o.d / 2;
      const y1 = o.y + o.d / 2;
      box(ctx, v, x0 + 2, y0 + 2, x0 + 4, y1 - 2, z, z + 5, o.c2);
      box(ctx, v, x1 - 4, y0 + 2, x1 - 2, y1 - 2, z, z + 5, o.c2);
      if (horiz) {
        box(ctx, v, x0, y0, x1, y0 + 2.5, z + 5, z + 12, o.c1);
        box(ctx, v, x0, y0 + 2.5, x1, y1, z + 5, z + 7, o.c1);
      } else {
        box(ctx, v, x0, y0, x0 + 2.5, y1, z + 5, z + 12, o.c1);
        box(ctx, v, x0 + 2.5, y0, x1, y1, z + 5, z + 7, o.c1);
      }
      break;
    }
  }
}

// ─── Level of detail ──────────────────────────────────────────────────────────
// Small things far away are drawn as simple shapes, batched by color into a
// handful of fills. That keeps big zoomed-out cities smooth on phones.

const BLOB_KINDS = new Set(["person", "cone", "hydrant", "trash", "flower", "ball", "mailbox", "bench", "lamp", "bush"]);

function isBlob(o: Obj, zoom: number) {
  if (!BLOB_KINDS.has(o.kind)) return false;
  if (o.kind === "lamp") return zoom < 1.1;
  if (o.kind === "person") return zoom < 0.95;
  if (o.kind === "bush") return o.fit * zoom < 9;
  return o.fit * zoom < 7;
}

type Batch = Map<string, Path2D>;

function batchPath(b: Batch, color: string) {
  let p = b.get(color);
  if (!p) {
    p = new Path2D();
    b.set(color, p);
  }
  return p;
}

function addBlob(b: Batch, v: View, o: Obj) {
  const z = v.zoom;
  if (o.kind === "lamp") {
    const base = pr(v, o.x, o.y, 0);
    const top = pr(v, o.x, o.y, o.h);
    const w = Math.max(1.2, 1.6 * z);
    batchPath(b, "#475569").rect(base[0] - w / 2, top[1], w, base[1] - top[1]);
    const r = Math.max(1.5, 3 * z);
    batchPath(b, o.c2).rect(top[0] - r, top[1] - r, r * 2, r * 2);
    return;
  }
  if (o.kind === "person") {
    const hop = o.panic > 0 ? Math.abs(Math.sin(o.anim)) * 3 : 0;
    const body = pr(v, o.x, o.y, 9 + hop);
    const s = Math.max(1.4, 4 * z);
    batchPath(b, o.c1).rect(body[0] - s * 0.8, body[1] - s, s * 1.6, s * 2.2);
    const hp = pr(v, o.x, o.y, 17 + hop);
    const hpth = batchPath(b, o.c2);
    hpth.moveTo(hp[0] + s * 0.9, hp[1]);
    hpth.arc(hp[0], hp[1], s * 0.9, 0, Math.PI * 2);
    return;
  }
  const p = pr(v, o.x, o.y, o.h * 0.5);
  if (o.kind === "bush" || o.kind === "ball") {
    const r = Math.max(1.5, (o.kind === "bush" ? o.w * 0.45 : 4.5) * z);
    const path = batchPath(b, o.c1);
    path.moveTo(p[0] + r, p[1]);
    path.arc(p[0], p[1], r, 0, Math.PI * 2);
    return;
  }
  const w = Math.max(1.5, o.w * z);
  const hgt = Math.max(2, o.h * z * 0.9);
  batchPath(b, o.c1).rect(p[0] - w / 2, p[1] - hgt / 2, w, hgt);
}

function drawObj(ctx: CanvasRenderingContext2D, v: View, o: Obj, z: number) {
  // Far away / tiny on screen: a quick blob reads the same and is much cheaper.
  if (o.fit * v.zoom < 4.5 && o.fit < 20) {
    const p = pr(v, o.x, o.y, z + o.h * 0.5);
    const s = Math.max(1.5, o.fit * v.zoom);
    ctx.fillStyle = o.kind === "lamp" ? "#475569" : o.c1;
    if (o.kind === "lamp") {
      const b = pr(v, o.x, o.y, z);
      const t = pr(v, o.x, o.y, z + o.h);
      ctx.fillRect(b[0] - 0.75, t[1], 1.5, b[1] - t[1]);
      ctx.fillStyle = o.c2;
      ctx.fillRect(t[0] - 1.5, t[1] - 1.5, 3, 3);
      return;
    }
    ctx.fillRect(p[0] - s * 0.6, p[1] - s, s * 1.2, s * 1.6);
    return;
  }
  switch (o.kind) {
    case "person":
      return drawPerson(ctx, v, o, z);
    case "tree":
    case "bigtree":
      return drawTree(ctx, v, o, z);
    case "pine":
      return drawPine(ctx, v, o, z);
    case "bush":
      return drawBush(ctx, v, o, z);
    case "lamp":
      return drawLamp(ctx, v, o, z);
    case "umbrella":
      return drawUmbrella(ctx, v, o, z);
    case "cart":
      return drawCart(ctx, v, o, z);
    case "car":
      return drawCar(ctx, v, o, z);
    case "van":
      return drawVan(ctx, v, o, z);
    case "bus":
      return drawBus(ctx, v, o, z);
    case "house":
      return drawHouse(ctx, v, o, z);
    case "fountain":
      return drawFountain(ctx, v, o, z, v.time);
    case "shop":
      return drawShop(ctx, v, o, z);
    case "office":
      return drawOffice(ctx, v, o, z);
    case "tower":
      return drawTower(ctx, v, o, z);
    case "skyscraper":
      return drawSkyscraper(ctx, v, o, z);
    default:
      return drawSmall(ctx, v, o, z);
  }
}

// ─── Ground ───────────────────────────────────────────────────────────────────

const LOT_COLORS: Record<Block["type"], string> = {
  downtown: "#e9e6df",
  office: "#ebe7de",
  shops: "#f2e7d5",
  plaza: "#efe5d3",
  park: "#8fd46b",
  parking: "#7c8494",
  houses: "#a5dc7c",
};

function drawGround(ctx: CanvasRenderingContext2D, v: View, g: Game, dpr: number, bounds: Bounds) {
  const { world } = g;
  const z = v.zoom;
  ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, dpr * (v.cx - v.camX * z), dpr * (v.cy - v.camY * z * TILT));

  // beach border + sidewalk base
  ctx.fillStyle = "#f6e3a8";
  ctx.fillRect(-36, -36, world.size + 72, world.size + 72);
  ctx.fillStyle = "#dfe1e7";
  ctx.fillRect(0, 0, world.size, world.size);

  // roads
  ctx.fillStyle = "#5d6474";
  for (let i = 0; i <= world.n; i++) {
    const c = i * BLOCK;
    ctx.fillRect(0, c, world.size, ROAD);
    ctx.fillRect(c, 0, ROAD, world.size);
  }

  // lots
  for (const b of world.blocks) {
    if (b.x > bounds.x1 || b.x + b.w < bounds.x0 || b.y > bounds.y1 || b.y + b.h < bounds.y0) continue;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = "#e4e6ec";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const L = b.lot;
    ctx.fillStyle = LOT_COLORS[b.type];
    ctx.fillRect(L.x, L.y, L.w, L.h);
    lotDetails(ctx, b);
  }

  // lane dashes (skip intersections)
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 20]);
  ctx.beginPath();
  for (let i = 0; i <= world.n; i++) {
    const mid = i * BLOCK + ROAD / 2;
    for (let k = 0; k < world.n; k++) {
      const a = k * BLOCK + ROAD + 26;
      const bEnd = (k + 1) * BLOCK - 26;
      if (mid > bounds.y0 - 50 && mid < bounds.y1 + 50 && bEnd > bounds.x0 && a < bounds.x1) {
        ctx.moveTo(a, mid);
        ctx.lineTo(bEnd, mid);
      }
      if (mid > bounds.x0 - 50 && mid < bounds.x1 + 50 && bEnd > bounds.y0 && a < bounds.y1) {
        ctx.moveTo(mid, a);
        ctx.lineTo(mid, bEnd);
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // crosswalks
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let j = 0; j <= world.n; j++) {
    for (let i = 0; i <= world.n; i++) {
      const X = i * BLOCK;
      const Y = j * BLOCK;
      if (X > bounds.x1 || X + ROAD < bounds.x0 || Y > bounds.y1 || Y + ROAD < bounds.y0) continue;
      for (let s = 8; s < ROAD - 8; s += 14) {
        if (i < world.n) ctx.fillRect(X + ROAD + 3, Y + s, 16, 8);
        if (i > 0) ctx.fillRect(X - 19, Y + s, 16, 8);
        if (j < world.n) ctx.fillRect(X + s, Y + ROAD + 3, 8, 16);
        if (j > 0) ctx.fillRect(X + s, Y - 19, 8, 16);
      }
    }
  }
}

function lotDetails(ctx: CanvasRenderingContext2D, b: Block) {
  const L = b.lot;
  const cx = L.x + L.w / 2;
  const cy = L.y + L.h / 2;
  switch (b.type) {
    case "downtown":
    case "office":
    case "shops": {
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 40; t < L.w; t += 40) {
        ctx.moveTo(L.x + t, L.y);
        ctx.lineTo(L.x + t, L.y + L.h);
        ctx.moveTo(L.x, L.y + t);
        ctx.lineTo(L.x + L.w, L.y + t);
      }
      ctx.stroke();
      break;
    }
    case "plaza": {
      ctx.fillStyle = "#e6d6bd";
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = LOT_COLORS.plaza;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9bdc74";
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "park": {
      ctx.fillStyle = "#84c95f";
      for (let k = 0; k < 5; k++) {
        const a = b.seed * 50 + k * 2.3;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 100, cy + Math.sin(a * 1.3) * 100, 40, 26, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ecdcb6";
      ctx.fillRect(L.x, cy - 13, L.w, 26);
      ctx.fillRect(cx - 13, L.y, 26, L.h);
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "parking": {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const stalls = 7;
      const sw = L.w / stalls;
      for (let k = 0; k <= stalls; k++) {
        const x = L.x + k * sw;
        ctx.moveTo(x, L.y + 6);
        ctx.lineTo(x, L.y + 78);
        ctx.moveTo(x, L.y + L.h - 78);
        ctx.lineTo(x, L.y + L.h - 6);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(250,204,21,0.8)";
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(L.x + 10, cy);
      ctx.lineTo(L.x + L.w - 10, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "houses": {
      const cell = L.w / 2;
      ctx.fillStyle = "#e9dcc0";
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 2; gx++) {
          const x0 = L.x + cell * gx;
          const y0 = L.y + cell * gy;
          ctx.fillRect(x0 + cell / 2 - 7, y0 + cell * 0.6, 14, cell * 0.4 + WALK);
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, L.y + 6);
      ctx.lineTo(cx, L.y + L.h - 6);
      ctx.moveTo(L.x + 6, cy);
      ctx.lineTo(L.x + L.w - 6, cy);
      ctx.stroke();
      break;
    }
  }
}

// ─── Shadows ──────────────────────────────────────────────────────────────────

const ROUND_SHADOW = new Set(["tree", "bigtree", "pine", "bush", "umbrella", "fountain", "person", "ball", "lamp", "hydrant", "cone", "trash", "flower"]);

function drawShadows(ctx: CanvasRenderingContext2D, objs: Obj[], zoom: number) {
  ctx.beginPath();
  for (const o of objs) {
    if (o.falling) continue;
    if (o.fit * zoom < 4.5 && o.fit < 20) continue;
    const sh = Math.min(o.h, 220);
    const ox = sh * 0.42;
    const oy = sh * 0.34;
    if (ROUND_SHADOW.has(o.kind)) {
      const r = o.kind === "lamp" ? 5 : o.kind === "person" ? 4.5 : o.w * 0.48;
      const k = o.kind === "lamp" ? 0.9 : o.kind === "person" ? 0.25 : 0.5;
      ctx.moveTo(o.x + ox * k + r, o.y + oy * k);
      ctx.ellipse(o.x + ox * k, o.y + oy * k, r, r, 0, 0, Math.PI * 2);
    } else {
      const x0 = o.x - o.w / 2;
      const x1 = o.x + o.w / 2;
      const y0 = o.y - o.d / 2;
      const y1 = o.y + o.d / 2;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1 + ox, y0 + oy);
      ctx.lineTo(x1 + ox, y1 + oy);
      ctx.lineTo(x0 + ox, y1 + oy);
      ctx.lineTo(x0, y1);
      ctx.closePath();
    }
  }
  ctx.fillStyle = "rgba(30,41,82,0.2)";
  ctx.fill("nonzero");
}

// ─── Holes ────────────────────────────────────────────────────────────────────

function holeRim(h: Hole, v: View) {
  const rx = h.r * v.zoom;
  return { rx, ry: rx * TILT, lw: Math.max(3, rx * 0.12) };
}

function holeAlpha(h: Hole, time: number) {
  return h.invulnT > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(time * 10)) : 1;
}

function drawHoleBack(ctx: CanvasRenderingContext2D, v: View, h: Hole) {
  const [x, y] = pr(v, h.x, h.y, 0);
  const { rx, ry, lw } = holeRim(h, v);
  const col = holeColor(h, v.time);
  ctx.globalAlpha = holeAlpha(h, v.time);
  ctx.beginPath();
  ctx.ellipse(x, y, rx + lw * 1.4, ry + lw * 1.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.globalAlpha *= 0.22;
  ctx.fill();
  ctx.globalAlpha = holeAlpha(h, v.time);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#050609";
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y - ry, 0, y + ry * 0.25);
  grad.addColorStop(0, "rgba(70,78,110,0.95)");
  grad.addColorStop(0.45, "rgba(20,22,34,0.6)");
  grad.addColorStop(1, "rgba(5,6,9,0)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHoleFront(ctx: CanvasRenderingContext2D, v: View, g: Game, h: Hole, falling: Obj[]) {
  const [x, y] = pr(v, h.x, h.y, 0);
  const { rx, ry, lw } = holeRim(h, v);
  if (falling.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - rx * 1.25, y - 5000, rx * 2.5, 5000);
    ctx.ellipse(x, y, rx - lw * 0.3, ry - lw * 0.3, 0, 0, Math.PI * 2);
    ctx.clip();
    falling.sort((a, b) => a.y - b.y);
    for (const o of falling) {
      const f = o.falling!;
      const total = o.h + o.fit * 0.6 + 12;
      const t = Math.min(1, f.depth / total);
      ctx.globalAlpha = 1 - Math.pow(t, 1.6) * 0.92;
      const [gx, gy] = pr(v, o.x, o.y, 0);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(f.tilt * t);
      ctx.translate(-gx, -gy);
      drawObj(ctx, v, o, -f.depth);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const col = holeColor(h, v.time);
  ctx.globalAlpha = holeAlpha(h, v.time);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y - lw * 0.15, rx - lw * 0.3, ry - lw * 0.3, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = lw * 0.3;
  ctx.stroke();

  if (h.isPlayer && !g.demo) {
    const pr2 = lw * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(x, y, rx + pr2, ry + pr2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
    if (h.progress > 0.005) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx + pr2, ry + pr2, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * h.progress);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }
  for (const ring of g.rings) {
    if (ring.holeId !== h.id) continue;
    const t = ring.t / 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * (1 + t * 1.2), ry * (1 + t * 1.2), 0, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 1 - t;
    ctx.lineWidth = lw * (1.4 - t);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ─── Labels, fx, overlays ─────────────────────────────────────────────────────

function drawTags(ctx: CanvasRenderingContext2D, v: View, g: Game) {
  const leader = g.holes.length > 1 ? ranking(g)[0] : null;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineJoin = "round";
  for (const h of g.holes) {
    if (!h.alive) continue;
    const [x, y] = pr(v, h.x, h.y, 0);
    const { ry, lw } = holeRim(h, v);
    if (x < -100 || x > v.W + 100 || y < -100 || y > v.H + 150) continue;
    const isMe = h.isPlayer && !g.demo;
    const size = isMe ? 16 : 13;
    ctx.font = `700 ${size}px Fredoka, "Inter", system-ui, sans-serif`;
    const ty = y - ry - lw * 2 - 6;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(15,23,42,0.7)";
    ctx.strokeText(h.name, x, ty);
    ctx.fillStyle = isMe ? "#ffffff" : shade(h.color.startsWith("#") ? h.color : "#ffffff", 1.35);
    ctx.fillText(h.name, x, ty);
    if (leader === h && leader.score > 0) {
      ctx.font = `${size + 4}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.fillText("👑", x, ty - size - 2);
    }
  }
}

function drawFx(ctx: CanvasRenderingContext2D, v: View, g: Game) {
  for (const p of g.particles) {
    const [x, y] = pr(v, p.x, p.y, p.z);
    const t = p.life / p.max;
    if (p.kind === "dust") {
      ctx.globalAlpha = t * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size * v.zoom * (1.6 - t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.fillStyle = p.color;
      const s = p.size * v.zoom;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const f of g.floaters) {
    const [x, y] = pr(v, f.x, f.y, f.z);
    const px = Math.round(15 * f.size + 4);
    ctx.font = `700 ${px}px Fredoka, "Inter", system-ui, sans-serif`;
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(15,23,42,0.75)";
    ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawHint(ctx: CanvasRenderingContext2D, v: View, g: Game) {
  if (!g.hint || g.phase !== "playing") return;
  const [hx, hy] = pr(v, g.hint.x, g.hint.y, 0);
  if (hx > 40 && hx < v.W - 40 && hy > 40 && hy < v.H - 40) return;
  const ang = Math.atan2(hy - v.cy, hx - v.cx);
  const ex = v.cx + Math.cos(ang) * (v.W / 2 - 46);
  const ey = v.cy + Math.sin(ang) * (v.H / 2 - 56);
  const bob = Math.sin(v.time * 6) * 5;
  ctx.save();
  ctx.translate(ex + Math.cos(ang) * bob, ey + Math.sin(ang) * bob);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-10, -15);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 15);
  ctx.closePath();
  ctx.fillStyle = holeColor(g.player, v.time);
  ctx.strokeStyle = "rgba(15,23,42,0.75)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawJoystick(ctx: CanvasRenderingContext2D, joy: Joystick) {
  if (!joy.active) return;
  ctx.beginPath();
  ctx.arc(joy.ox, joy.oy, 56, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(joy.x, joy.y, 24, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
}

// ─── Frame ────────────────────────────────────────────────────────────────────

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function render(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, dpr: number, time: number, joy: Joystick) {
  const shake = g.cam.shake;
  const sx = shake ? (Math.random() - 0.5) * shake * 16 : 0;
  const sy = shake ? (Math.random() - 0.5) * shake * 16 : 0;
  const v: View = {
    W,
    H,
    cx: W / 2 + sx,
    cy: H / 2 + sy,
    camX: g.cam.x,
    camY: g.cam.y,
    zoom: g.cam.zoom,
    time,
  };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const water = ctx.createLinearGradient(0, 0, 0, H);
  water.addColorStop(0, "#4cc3ee");
  water.addColorStop(1, "#2d9fd8");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, W, H);

  const halfW = W / 2 / v.zoom;
  const halfH = H / 2 / (v.zoom * TILT);
  const bounds: Bounds = {
    x0: v.camX - halfW - 60,
    x1: v.camX + halfW + 60,
    y0: v.camY - halfH - 60,
    y1: v.camY + halfH + 60,
  };
  const leanPad = W * 0.35 / v.zoom;
  const objBounds: Bounds = {
    x0: bounds.x0 - leanPad,
    x1: bounds.x1 + leanPad,
    y0: bounds.y0 - 40,
    y1: bounds.y1 + 520,
  };

  drawGround(ctx, v, g, dpr, bounds);

  const visible: Obj[] = [];
  const fallingBy = new Map<number, Obj[]>();
  for (const o of g.objs) {
    if (o.dead) continue;
    if (o.falling) {
      const list = fallingBy.get(o.falling.holeId);
      if (list) list.push(o);
      else fallingBy.set(o.falling.holeId, [o]);
      continue;
    }
    if (o.x < objBounds.x0 || o.x > objBounds.x1 || o.y < objBounds.y0 || o.y > objBounds.y1) continue;
    visible.push(o);
  }

  drawShadows(ctx, visible, v.zoom);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const holes = g.holes.filter((h) => h.alive && h.x > bounds.x0 - h.r && h.x < bounds.x1 + h.r && h.y > bounds.y0 - h.r && h.y < bounds.y1 + h.r);
  for (const h of holes) drawHoleBack(ctx, v, h);

  const blobs: Batch = new Map();
  type Entry = { key: number; o?: Obj; h?: Hole };
  const entries: Entry[] = [];
  for (const o of visible) {
    if (isBlob(o, v.zoom) && o.wobble <= 0) addBlob(blobs, v, o);
    else entries.push({ key: o.y + o.d / 2, o });
  }
  for (const [color, path] of blobs) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  for (const h of holes) entries.push({ key: h.y + 0.5, h });
  entries.sort((a, b) => a.key - b.key);

  const player = g.player;
  for (const e of entries) {
    if (e.h) {
      drawHoleFront(ctx, v, g, e.h, fallingBy.get(e.h.id) ?? []);
      continue;
    }
    const o = e.o!;
    if (o.wobble > 0) {
      const [gx, gy] = pr(v, o.x, o.y, 0);
      ctx.translate(gx, gy);
      ctx.rotate(Math.sin(time * 38 + o.seed * 10) * 0.05 * o.wobble);
      ctx.translate(-gx, -gy);
      drawObj(ctx, v, o, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      drawObj(ctx, v, o, 0);
    }
    // Tiny "too big" marker when the player is pushing against something.
    if (o.wobble > 0.5 && player.alive && !fits(o, player) && Math.hypot(o.x - player.x, o.y - player.y) < player.r + o.fit) {
      const [lx, ly] = pr(v, o.x, o.y, o.h + 12);
      ctx.font = `${16}px system-ui, "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = Math.min(1, o.wobble);
      ctx.fillText("🔒", lx, ly);
      ctx.globalAlpha = 1;
    }
  }

  // X-ray outline so the player can always find their hole under buildings.
  if (player.alive && !g.demo) {
    const [px, py] = pr(v, player.x, player.y, 0);
    const { rx, ry, lw } = holeRim(player, v);
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([lw * 1.6, lw * 1.2]);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = holeColor(player, time);
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawFx(ctx, v, g);
  drawTags(ctx, v, g);
  drawHint(ctx, v, g);
  drawJoystick(ctx, joy);
}
