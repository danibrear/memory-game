import { keyframes } from "@emotion/react";
import {
  faHouse,
  faPause,
  faPlay,
  faRotateRight,
  faStar,
  faVolumeHigh,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, ButtonBase, IconButton, Paper, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { NAV_HEIGHT } from "~/components/NavBar";
import {
  sfxEat,
  sfxFinish,
  sfxGo,
  sfxGobble,
  sfxGotEaten,
  sfxLevelUp,
  sfxRumble,
  sfxTick,
  setMuted as setAudioMuted,
  unlockAudio,
} from "~/games/hole/audio";
import { MODES, SKINS, SOLO_STARS, TILT, UNLOCK_LABELS, type Kind, type ModeId, type Skin } from "~/games/hole/config";
import {
  cityEaten,
  createGame,
  ranking,
  setViewSize,
  step,
  timeLeft,
  type Game,
  type Input,
} from "~/games/hole/engine";
import { render, type Joystick } from "~/games/hole/render";
import { getStoredData, setStoredData } from "~/storage";
import { DISPLAY_FONT } from "~/theme";
import type { Route } from "./+types/hole";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hole Drop - Games by DaniB" },
    {
      name: "description",
      content: "Steer a hungry hole around the city, gobble everything, and grow bigger than everyone else!",
    },
  ];
}

const STEP = 1 / 60;
const SETTINGS_KEY = "hole-settings";
const BEST_KEY = "hole-best-v2";
const JOY_RADIUS = 56;

type Screen = "menu" | "playing" | "results";

interface Settings {
  name: string;
  skinId: string;
  mode: ModeId;
  muted: boolean;
}

interface Row {
  id: number;
  name: string;
  color: string;
  score: number;
  isPlayer: boolean;
  rainbow: boolean;
}

interface Hud {
  score: number;
  level: number;
  progress: number;
  timeLeft: number;
  rank: number;
  rows: Row[];
  pct: number;
  alive: boolean;
  respawnIn: number;
  countdown: number;
  phase: Game["phase"];
}

interface Toast {
  id: number;
  text: string;
  color: string;
  big?: boolean;
}

interface FeedItem {
  id: number;
  eater: Pick<Row, "name" | "color" | "rainbow" | "isPlayer">;
  victim: Pick<Row, "name" | "color" | "rainbow" | "isPlayer">;
}

interface Unlock {
  id: number;
  emoji: string;
  label: string;
  more: number;
}

interface Result {
  mode: ModeId;
  score: number;
  rank: number;
  rows: Row[];
  pct: number;
  stars: number;
  seconds: number;
  cleared: boolean;
  newBest: boolean;
  best: number;
}

const EMPTY_HUD: Hud = {
  score: 0,
  level: 1,
  progress: 0,
  timeLeft: 0,
  rank: 1,
  rows: [],
  pct: 0,
  alive: true,
  respawnIn: 0,
  countdown: 3,
  phase: "countdown",
};

const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

const fmtTime = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

const fmtNum = (n: number) => n.toLocaleString("en-US");

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const RAINBOW_RING = "conic-gradient(#f87171, #fb923c, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)";

// ─── Animations ───────────────────────────────────────────────────────────────

const pop = keyframes`
  0% { transform: scale(0.3); opacity: 0; }
  30% { transform: scale(1.15); opacity: 1; }
  45% { transform: scale(1); opacity: 1; }
  85% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
`;
const toastIn = keyframes`
  0% { transform: translateY(12px) scale(0.85); opacity: 0; }
  15% { transform: translateY(0) scale(1.06); opacity: 1; }
  25% { transform: scale(1); }
  80% { opacity: 1; }
  100% { transform: translateY(-14px); opacity: 0; }
`;
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;
const fall = keyframes`
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
`;
const feedIn = keyframes`
  0% { transform: translateX(-24px); opacity: 0; }
  6% { transform: translateX(0); opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
`;
const unlockIn = keyframes`
  0% { transform: translateY(30px) scale(0.8); opacity: 0; }
  10% { transform: translateY(0) scale(1.05); opacity: 1; }
  16% { transform: scale(1); }
  85% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: translateY(10px) scale(0.95); }
`;
const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

// ─── Small UI pieces ──────────────────────────────────────────────────────────

const glass = {
  bgcolor: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
  color: "#0f172a",
} as const;

function HoleIcon({ skin, size = 48 }: { skin: Skin; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size * 0.78,
        borderRadius: "50%",
        p: `${Math.max(3, size * 0.09)}px`,
        background: skin.rainbow ? RAINBOW_RING : skin.color,
        boxShadow: `0 ${size * 0.08}px ${size * 0.2}px rgba(15,23,42,0.25)`,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "linear-gradient(180deg, #3b4262 0%, #0b0c12 45%, #050609 100%)",
        }}
      />
    </Box>
  );
}

function ColorDot({ row, size = 12 }: { row: Pick<Row, "color" | "rainbow">; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: row.rainbow ? RAINBOW_RING : row.color,
        boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.12)",
      }}
    />
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        dur: 2.4 + Math.random() * 1.8,
        color: ["#f472b6", "#facc15", "#22d3ee", "#a3e635", "#fb923c", "#a78bfa"][i % 6],
        w: 6 + Math.random() * 6,
      })),
    [],
  );
  return (
    <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 4 }}>
      {pieces.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            bgcolor: p.color,
            borderRadius: 0.5,
            animation: `${fall} ${p.dur}s ${p.delay}s linear infinite`,
            opacity: 0,
            animationFillMode: "both",
          }}
        />
      ))}
    </Box>
  );
}

function RoundButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: typeof faPause;
  onClick: () => void;
}) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      sx={{
        ...glass,
        width: 48,
        height: 48,
        fontSize: 18,
        "&:hover": { bgcolor: "#fff" },
      }}>
      <FontAwesomeIcon icon={icon} />
    </IconButton>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HoleDrop() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const joyRef = useRef<Joystick>({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const mouseRef = useRef({ active: false, x: 0, y: 0 });
  /** Whichever control was touched last wins, so a resting cursor can't fight the arrow keys. */
  const inputModeRef = useRef<"keys" | "mouse">("mouse");
  const scaleRef = useRef(1);

  const [screen, setScreen] = useState<Screen>("menu");
  const [settings, setSettings] = useState<Settings>({ name: "", skinId: "aqua", mode: "classic", muted: false });
  const [best, setBest] = useState<Partial<Record<ModeId, number>>>({});
  const hudStore = useRef(createHudStore());
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [goFlash, setGoFlash] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  const skin = skinById(settings.skinId);
  const live = useRef({ screen, paused, settings, best });
  live.current = { screen, paused, settings, best };

  // ── Load saved settings ────────────────────────────────────────────────────
  useEffect(() => {
    const saved = getStoredData(SETTINGS_KEY) as Partial<Settings> | null;
    if (saved) setSettings((s) => ({ ...s, ...saved, mode: saved.mode && MODES[saved.mode] ? saved.mode : s.mode }));
    const savedBest = getStoredData(BEST_KEY) as Partial<Record<ModeId, number>> | null;
    if (savedBest) setBest(savedBest);
    setIsTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  useEffect(() => {
    setStoredData(SETTINGS_KEY, settings);
    setAudioMuted(settings.muted);
  }, [settings]);

  const pushToast = useCallback((text: string, color = "#ffffff", big = false) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, color, big }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1700);
  }, []);

  const pushFeed = useCallback((item: Omit<FeedItem, "id">) => {
    const id = Math.random();
    setFeed((f) => [...f.slice(-3), { ...item, id }]);
    setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 4500);
  }, []);

  const showUnlock = useCallback((kinds: Kind[]) => {
    const order = Object.keys(UNLOCK_LABELS) as Kind[];
    const named = order.filter((k) => kinds.includes(k));
    if (!named.length) return;
    const top = UNLOCK_LABELS[named[0]]!;
    const id = Math.random();
    setUnlock({ id, emoji: top.emoji, label: top.label, more: named.length - 1 });
    setTimeout(() => setUnlock((u) => (u?.id === id ? null : u)), 2800);
  }, []);

  // ── Demo city behind the menu ──────────────────────────────────────────────
  const makeDemo = useCallback(() => {
    const s = live.current.settings;
    const sk = skinById(s.skinId);
    gameRef.current = createGame({
      mode: "classic",
      name: s.name.trim() || "You",
      color: sk.color,
      rainbow: !!sk.rainbow,
      demo: true,
    });
  }, []);

  useEffect(() => {
    if (!gameRef.current) makeDemo();
  }, [makeDemo]);

  // Keep the demo hole dressed in the chosen skin + name.
  useEffect(() => {
    const g = gameRef.current;
    if (g?.demo) {
      g.player.color = skin.color;
      g.player.rainbow = !!skin.rainbow;
      g.player.name = settings.name.trim() || "You";
    }
  }, [skin, settings.name]);

  // ── Start / finish ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    unlockAudio();
    const s = live.current.settings;
    const sk = skinById(s.skinId);
    gameRef.current = createGame({
      mode: s.mode,
      name: s.name.trim() || "You",
      color: sk.color,
      rainbow: !!sk.rainbow,
    });
    setResult(null);
    setPaused(false);
    setToasts([]);
    setFeed([]);
    setUnlock(null);
    hudStore.current.set(EMPTY_HUD);
    setScreen("playing");
    setShowHint(true);
    setTimeout(() => setShowHint(false), 5000);
  }, []);

  const finishGame = useCallback((g: Game) => {
    const rows = ranking(g).map<Row>((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      score: h.score,
      isPlayer: h.isPlayer,
      rainbow: h.rainbow,
    }));
    const rank = rows.findIndex((r) => r.isPlayer) + 1;
    const pct = cityEaten(g);
    const stars = g.mode === "solo" ? SOLO_STARS.filter((t) => pct >= t).length : 0;
    const score = g.player.score;
    const prevBest = live.current.best[g.mode] ?? 0;
    const newBest = score > prevBest;
    if (newBest) {
      const nb = { ...live.current.best, [g.mode]: score };
      setBest(nb);
      setStoredData(BEST_KEY, nb);
    }
    const win = g.mode === "classic" ? rank === 1 : g.mode === "solo" ? stars >= 2 : g.clearedAt !== null;
    sfxFinish(win);
    setResult({
      mode: g.mode,
      score,
      rank,
      rows,
      pct,
      stars,
      seconds: g.clearedAt ?? g.time,
      cleared: g.clearedAt !== null,
      newBest,
      best: Math.max(prevBest, score),
    });
    setPaused(false);
    setScreen("results");
  }, []);

  const goMenu = useCallback(() => {
    setPaused(false);
    setResult(null);
    setScreen("menu");
    makeDemo();
  }, [makeDemo]);

  // ── Input ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map: Record<string, keyof typeof keysRef.current> = {
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",
      KeyS: "down",
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
    };
    const down = (e: KeyboardEvent) => {
      if (live.current.screen !== "playing") return;
      if (e.target instanceof HTMLInputElement) return;
      const k = map[e.code];
      if (k) {
        keysRef.current[k] = true;
        inputModeRef.current = "keys";
        e.preventDefault();
      }
      if (e.code === "Escape" || e.code === "KeyP") setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (k) keysRef.current[k] = false;
    };
    const blur = () => {
      keysRef.current = { up: false, down: false, left: false, right: false };
    };
    const vis = () => {
      if (document.hidden && live.current.screen === "playing") setPaused(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const localPoint = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (live.current.screen !== "playing") return;
    unlockAudio();
    if (e.pointerType === "mouse") return;
    const p = localPoint(e);
    joyRef.current = { active: true, ox: p.x, oy: p.y, x: p.x, y: p.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setShowHint(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = localPoint(e);
    if (e.pointerType === "mouse") {
      const m = mouseRef.current;
      // Only a real mouse movement (not a tiny jitter) takes control back from the keys.
      if (!m.active || Math.hypot(p.x - m.x, p.y - m.y) > 4) inputModeRef.current = "mouse";
      mouseRef.current = { active: true, x: p.x, y: p.y };
      return;
    }
    const j = joyRef.current;
    if (!j.active) return;
    const dx = p.x - j.ox;
    const dy = p.y - j.oy;
    const d = Math.hypot(dx, dy);
    const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
    j.x = j.ox + dx * k;
    j.y = j.oy + dy * k;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") joyRef.current.active = false;
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") mouseRef.current.active = false;
  };

  // ── Main loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let frameAvg = 16;
    let slowFrames = 0;

    const readInput = (g: Game, W: number, H: number): Input => {
      const k = keysRef.current;
      const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (kx || ky) {
        const m = Math.hypot(kx, ky);
        return { x: kx / m, y: ky / m };
      }
      const j = joyRef.current;
      if (j.active) {
        const dx = j.x - j.ox;
        const dy = j.y - j.oy;
        const d = Math.hypot(dx, dy);
        if (d < 6) return { x: 0, y: 0 };
        const m = Math.min(1, d / (JOY_RADIUS * 0.8));
        return { x: (dx / d) * m, y: (dy / d) * m };
      }
      // Using the keys: no arrow held means stop, never drift toward the cursor.
      if (inputModeRef.current === "keys") return { x: 0, y: 0 };
      const mouse = mouseRef.current;
      if (mouse.active) {
        const p = g.player;
        const px = (p.x - g.cam.x) * g.cam.zoom + W / 2;
        const py = (p.y - g.cam.y) * g.cam.zoom * TILT + H / 2;
        const dx = mouse.x - px;
        const dy = (mouse.y - py) / TILT;
        const d = Math.hypot(dx, dy);
        const dead = Math.max(14, p.r * g.cam.zoom * 0.35);
        if (d < dead) return { x: 0, y: 0 };
        const m = Math.min(1, (d - dead) / 110);
        return { x: (dx / d) * m, y: (dy / d) * m };
      }
      return { x: 0, y: 0 };
    };

    const handleEvents = (g: Game) => {
      if (g.demo) {
        if (g.phase === "over") makeDemo();
        return;
      }
      const pid = g.player.id;
      for (const e of g.events) {
        switch (e.type) {
          case "eat":
            if (e.holeId === pid) {
              sfxEat(e.fit, e.combo);
              if (e.combo >= 10 && e.combo % 10 === 0) pushToast(`${e.combo}x COMBO!`, "#facc15");
            }
            break;
          case "fall":
            if (e.holeId === pid && e.fit > 45) sfxRumble();
            break;
          case "levelup":
            if (e.holeId === pid) {
              sfxLevelUp();
              pushToast(`SIZE ${e.level}!`, "#a3e635", true);
            }
            break;
          case "unlock":
            if (e.holeId === pid) showUnlock(e.kinds);
            break;
          case "gobble": {
            const eater = g.holes[e.eaterId];
            const victim = g.holes[e.victimId];
            pushFeed({
              eater: { name: eater.name, color: eater.color, rainbow: eater.rainbow, isPlayer: eater.isPlayer },
              victim: { name: victim.name, color: victim.color, rainbow: victim.rainbow, isPlayer: victim.isPlayer },
            });
            if (eater.isPlayer) {
              sfxGobble();
              pushToast(`You gobbled ${victim.name}! 😋`, eater.color);
            } else if (victim.isPlayer) {
              sfxGotEaten();
              pushToast(`${eater.name} gobbled you! 😵`, "#f87171");
            }
            break;
          }
          case "tick":
            sfxTick(e.secondsLeft <= 3);
            break;
          case "go":
            sfxGo();
            setGoFlash(true);
            setTimeout(() => setGoFlash(false), 900);
            break;
          case "over":
            finishGame(g);
            break;
          default:
            break;
        }
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frameStart = performance.now();
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      const g = gameRef.current;
      if (!canvas || !wrap || !g) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * scaleRef.current;
      const pw = Math.round(W * dpr);
      const ph = Math.round(H * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      setViewSize(W, H);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      const running = !L.paused && (L.screen !== "results" || g.phase === "over");
      if (running) {
        // Advance by exactly the time this frame covers (split into small sub-steps).
        // A fixed 1/60 step with no interpolation sometimes runs 0 or 2 steps per frame,
        // which shows up as a stutter when the city scrolls fast.
        const input = L.screen === "playing" ? readInput(g, W, H) : { x: 0, y: 0 };
        const steps = Math.max(1, Math.ceil(dt / STEP));
        const sub = dt / steps;
        for (let i = 0; i < steps; i++) {
          step(g, sub, input);
          handleEvents(g);
        }
      }

      render(ctx, g, W, H, dpr, now / 1000, joyRef.current);

      // Adaptive resolution: drop pixel density on slow devices.
      const ft = performance.now() - frameStart;
      frameAvg = frameAvg * 0.95 + ft * 0.05;
      if (frameAvg > 20 && scaleRef.current > 0.6) {
        slowFrames++;
        if (slowFrames > 90) {
          scaleRef.current = Math.max(0.6, scaleRef.current - 0.15);
          slowFrames = 0;
          frameAvg = 16;
        }
      } else slowFrames = 0;

      hudT -= dt;
      if (hudT <= 0 && !g.demo) {
        hudT = 0.1;
        const p = g.player;
        const ranked = ranking(g);
        hudStore.current.set({
          score: p.score,
          level: p.level,
          progress: p.progress,
          timeLeft: timeLeft(g),
          rank: ranked.indexOf(p) + 1,
          rows: ranked.map((h) => ({
            id: h.id,
            name: h.name,
            color: h.color,
            score: h.score,
            isPlayer: h.isPlayer,
            rainbow: h.rainbow,
          })),
          pct: cityEaten(g),
          alive: p.alive,
          respawnIn: p.respawnT,
          countdown: g.countdown,
          phase: g.phase,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finishGame, makeDemo, pushToast, pushFeed, showUnlock]);

  const toggleMute = () => {
    unlockAudio();
    setSettings((s) => ({ ...s, muted: !s.muted }));
  };

  const mode = MODES[settings.mode];
  const playing = screen === "playing";
  const g = gameRef.current;
  const gameMode = g && !g.demo ? g.mode : settings.mode;

  return (
    <Box
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        position: "relative",
        height: `calc(100dvh - ${NAV_HEIGHT + 12}px)`,
        minHeight: 420,
        overflow: "hidden",
        bgcolor: "#3bb4e6",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        cursor: playing ? "crosshair" : "default",
        fontFamily: DISPLAY_FONT,
      }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      {playing && (
        <>
          <HudView store={hudStore.current} skin={skin} gameMode={gameMode} showHint={showHint} isTouch={isTouch} goFlash={goFlash} />

          {/* buttons */}
          <Box sx={{ position: "absolute", bottom: { xs: 12, sm: 18 }, right: { xs: 12, sm: 18 }, display: "flex", gap: 1 }}>
            <RoundButton label={settings.muted ? "Unmute" : "Mute"} icon={settings.muted ? faVolumeXmark : faVolumeHigh} onClick={toggleMute} />
            <RoundButton label="Pause" icon={faPause} onClick={() => setPaused(true)} />
          </Box>

          {/* gobble feed */}
          <Box
            sx={{
              position: "absolute",
              top: { xs: 104, sm: 136 },
              left: { xs: 8, sm: 14 },
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              pointerEvents: "none",
              maxWidth: { xs: 190, sm: 260 },
            }}>
            {feed.map((f) => (
              <Box
                key={f.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.6,
                  px: 1.1,
                  py: 0.4,
                  borderRadius: 99,
                  bgcolor: "rgba(15,23,42,0.72)",
                  color: "#fff",
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 600,
                  fontSize: { xs: 12, sm: 13.5 },
                  whiteSpace: "nowrap",
                  animation: `${feedIn} 4.5s ease-out forwards`,
                }}>
                <ColorDot row={f.eater} size={10} />
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.eater.isPlayer ? "You" : f.eater.name}
                </Box>
                <Box component="span" sx={{ opacity: 0.75 }}>
                  gobbled
                </Box>
                <ColorDot row={f.victim} size={10} />
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.victim.isPlayer ? "you" : f.victim.name}
                </Box>
              </Box>
            ))}
          </Box>

          {/* unlock card */}
          {unlock && (
            <Box
              key={unlock.id}
              sx={{
                position: "absolute",
                bottom: { xs: 84, sm: 34 },
                left: "50%",
                transform: "translateX(-50%)",
                pointerEvents: "none",
              }}>
              <Box
                sx={{
                  ...glass,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  pl: 1.25,
                  pr: 2.5,
                  py: 1,
                  borderRadius: 99,
                  border: "3px solid #a3e635",
                  animation: `${unlockIn} 2.8s ease-out forwards`,
                  whiteSpace: "nowrap",
                }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 28,
                    bgcolor: "#ecfccb",
                  }}>
                  {unlock.emoji}
                </Box>
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 12, color: "#65a30d", letterSpacing: "0.08em" }}>
                    NEW FOOD UNLOCKED
                  </Typography>
                  <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 17, sm: 20 }, lineHeight: 1.1 }}>
                    Now you can eat {unlock.label}!{unlock.more > 0 ? ` +${unlock.more} more` : ""}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* toasts */}
          <Box
            sx={{
              position: "absolute",
              top: { xs: 120, sm: 90 },
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.75,
              pointerEvents: "none",
            }}>
            {toasts.map((t) => (
              <Box
                key={t.id}
                sx={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 700,
                  fontSize: t.big ? { xs: 34, sm: 44 } : { xs: 20, sm: 26 },
                  color: t.color,
                  textShadow: "0 3px 0 rgba(15,23,42,0.55), 0 0 18px rgba(15,23,42,0.35)",
                  WebkitTextStroke: "1px rgba(15,23,42,0.35)",
                  animation: `${toastIn} 1.7s ease-out forwards`,
                  textAlign: "center",
                  px: 2,
                }}>
                {t.text}
              </Box>
            ))}
          </Box>

          {paused && (
            <Overlay>
              <Panel>
                <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 34, mb: 2 }}>Paused</Typography>
                <Box sx={{ display: "grid", gap: 1.25 }}>
                  <BigButton color="#22c55e" icon={faPlay} onClick={() => setPaused(false)}>
                    Keep playing
                  </BigButton>
                  <BigButton color="#3b82f6" icon={faRotateRight} onClick={startGame}>
                    Start over
                  </BigButton>
                  {g && !g.demo && g.mode === "chill" && (
                    <BigButton color="#f59e0b" icon={faStar} onClick={() => finishGame(g)}>
                      I'm done!
                    </BigButton>
                  )}
                  <BigButton color="#64748b" icon={faHouse} onClick={goMenu}>
                    Menu
                  </BigButton>
                </Box>
              </Panel>
            </Overlay>
          )}
        </>
      )}

      {/* ── Menu ────────────────────────────────────────────────────────── */}
      {screen === "menu" && (
        <Overlay dim={0.15}>
          <Panel wide>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mb: 0.5 }}>
              <Box sx={{ animation: `${bob} 2.4s ease-in-out infinite` }}>
                <HoleIcon skin={skin} size={58} />
              </Box>
              <Typography
                component="h1"
                sx={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 700,
                  fontSize: { xs: 40, sm: 52 },
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                  background: "linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #f59e0b 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}>
                Hole Drop
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: DISPLAY_FONT, color: "#475569", fontSize: { xs: 15, sm: 17 }, mb: 2.5 }}>
              Gobble up the city and grow into the biggest hole!
            </Typography>

            <TextField
              value={settings.name}
              onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value.slice(0, 14) }))}
              placeholder="Type your name"
              size="small"
              fullWidth
              inputProps={{ "aria-label": "Your name", maxLength: 14, style: { textAlign: "center", fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 600 } }}
              sx={{ mb: 2, maxWidth: 320, "& .MuiOutlinedInput-root": { borderRadius: 99, bgcolor: "#f8fafc" } }}
            />

            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: 14, color: "#64748b", mb: 1 }}>
              Pick your color
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: { xs: 0.75, sm: 1 }, mb: 2.5 }}>
              {SKINS.map((s) => {
                const on = s.id === settings.skinId;
                return (
                  <ButtonBase
                    key={s.id}
                    aria-label={s.name}
                    aria-pressed={on}
                    onClick={() => setSettings((st) => ({ ...st, skinId: s.id }))}
                    sx={{
                      borderRadius: "50%",
                      p: 0.5,
                      transform: on ? "scale(1.12)" : "scale(1)",
                      transition: "transform 150ms",
                      outline: on ? "3px solid #0f172a" : "3px solid transparent",
                      outlineOffset: 1,
                      "&:hover": { transform: "scale(1.12)" },
                    }}>
                    <HoleIcon skin={s} size={40} />
                  </ButtonBase>
                );
              })}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 2.5 }}>
              {(Object.keys(MODES) as ModeId[]).map((id) => {
                const m = MODES[id];
                const on = id === settings.mode;
                return (
                  <ButtonBase
                    key={id}
                    onClick={() => setSettings((s) => ({ ...s, mode: id }))}
                    aria-pressed={on}
                    sx={{
                      flexDirection: "column",
                      borderRadius: 3,
                      p: { xs: 1, sm: 1.5 },
                      border: "2px solid",
                      borderColor: on ? "#7c3aed" : "#e2e8f0",
                      bgcolor: on ? "#f5f3ff" : "#fff",
                      boxShadow: on ? "0 6px 16px rgba(124,58,237,0.2)" : "none",
                      transition: "all 150ms",
                      textAlign: "center",
                      "&:hover": { borderColor: on ? "#7c3aed" : "#c4b5fd" },
                    }}>
                    <Box sx={{ fontSize: { xs: 26, sm: 30 }, lineHeight: 1 }}>{m.emoji}</Box>
                    <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 16, sm: 18 }, mt: 0.5 }}>
                      {m.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: { xs: 11.5, sm: 13 },
                        color: "#64748b",
                        lineHeight: 1.25,
                        mt: 0.25,
                        display: { xs: on ? "block" : "none", sm: "block" },
                      }}>
                      {m.blurb}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>

            <Button
              onClick={startGame}
              variant="contained"
              size="large"
              startIcon={<FontAwesomeIcon icon={faPlay} />}
              sx={{
                fontFamily: DISPLAY_FONT,
                fontWeight: 700,
                fontSize: 24,
                textTransform: "none",
                borderRadius: 99,
                px: 6,
                py: 1,
                background: "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)",
                boxShadow: "0 6px 0 #15803d, 0 10px 20px rgba(22,163,74,0.35)",
                "&:hover": { background: "linear-gradient(180deg, #4ade80 0%, #15803d 100%)" },
                "&:active": { transform: "translateY(3px)", boxShadow: "0 3px 0 #15803d" },
              }}>
              Play!
            </Button>
            <Typography sx={{ fontFamily: DISPLAY_FONT, color: "#64748b", fontSize: 14, mt: 2 }}>
              {best[mode.id] ? `🏅 Your best in ${mode.name}: ${fmtNum(best[mode.id]!)}` : isTouch ? "Drag your finger to steer" : "Steer with your mouse or arrow keys"}
            </Typography>
          </Panel>
          <Box sx={{ position: "absolute", bottom: 14, right: 14 }}>
            <RoundButton label={settings.muted ? "Unmute" : "Mute"} icon={settings.muted ? faVolumeXmark : faVolumeHigh} onClick={toggleMute} />
          </Box>
        </Overlay>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {screen === "results" && result && (
        <Overlay>
          {((result.mode === "classic" && result.rank === 1) || (result.mode === "solo" && result.stars === 3) || result.cleared) && <Confetti />}
          <Panel>
            <ResultsBody result={result} />
            <Box sx={{ display: "flex", gap: 1.25, justifyContent: "center", mt: 2.5, flexWrap: "wrap" }}>
              <BigButton color="#22c55e" icon={faRotateRight} onClick={startGame}>
                Play again
              </BigButton>
              <BigButton color="#64748b" icon={faHouse} onClick={goMenu}>
                Menu
              </BigButton>
            </Box>
          </Panel>
        </Overlay>
      )}
    </Box>
  );
}

function Podium({ rows }: { rows: Row[] }) {
  const order = [1, 0, 2].filter((i) => rows[i]);
  const heights = [96, 68, 48];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Box sx={{ width: "100%", mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 1 }}>
        {order.map((i) => {
          const r = rows[i];
          return (
            <Box key={r.id} sx={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
              <HoleIcon skin={{ id: String(r.id), name: r.name, color: r.color, rainbow: r.rainbow }} size={i === 0 ? 52 : 42} />
              <Typography
                sx={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 700,
                  fontSize: i === 0 ? 16 : 14,
                  mt: 0.5,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: r.isPlayer ? "#7c3aed" : "#0f172a",
                }}>
                {r.isPlayer ? `${r.name} (you)` : r.name}
              </Typography>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 13, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                {fmtNum(r.score)}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  width: "100%",
                  height: heights[i],
                  borderRadius: "12px 12px 4px 4px",
                  display: "grid",
                  placeItems: "start center",
                  pt: 0.75,
                  fontSize: 26,
                  background: r.isPlayer
                    ? "linear-gradient(180deg, #c4b5fd, #8b5cf6)"
                    : ["linear-gradient(180deg, #fde68a, #f59e0b)", "linear-gradient(180deg, #e2e8f0, #94a3b8)", "linear-gradient(180deg, #fed7aa, #ea580c)"][i],
                  boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)",
                }}>
                {medals[i]}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ mt: 1.25, textAlign: "left" }}>
        {rows.slice(3).map((r, k) => (
          <Box
            key={r.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              py: 0.4,
              px: 1.25,
              borderRadius: 2,
              bgcolor: r.isPlayer ? "rgba(124,58,237,0.12)" : "transparent",
              fontFamily: DISPLAY_FONT,
              fontWeight: r.isPlayer ? 700 : 500,
              fontSize: 15,
            }}>
            <Box sx={{ width: 22, textAlign: "center", color: "#64748b" }}>{k + 4}</Box>
            <ColorDot row={r} size={12} />
            <Box sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Box>
            <Box sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.score)}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── HUD (re-renders on its own so the canvas page never does) ────────────────

function createHudStore() {
  let value = EMPTY_HUD;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: Hud) {
      if (sameHud(value, next)) return;
      value = next;
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}
type HudStore = ReturnType<typeof createHudStore>;

/** Only compare what the HUD actually shows, rounded the way it is displayed. */
function sameHud(a: Hud, b: Hud) {
  if (
    a.score !== b.score ||
    a.level !== b.level ||
    Math.round(a.progress * 100) !== Math.round(b.progress * 100) ||
    Math.ceil(a.timeLeft) !== Math.ceil(b.timeLeft) ||
    a.rank !== b.rank ||
    Math.floor(a.pct * 100) !== Math.floor(b.pct * 100) ||
    a.alive !== b.alive ||
    Math.ceil(a.respawnIn) !== Math.ceil(b.respawnIn) ||
    Math.ceil(a.countdown) !== Math.ceil(b.countdown) ||
    a.phase !== b.phase ||
    a.rows.length !== b.rows.length
  )
    return false;
  for (let i = 0; i < a.rows.length; i++) {
    if (a.rows[i].id !== b.rows[i].id || a.rows[i].score !== b.rows[i].score) return false;
  }
  return true;
}

function HudView({
  store,
  skin,
  gameMode,
  showHint,
  isTouch,
  goFlash,
}: {
  store: HudStore;
  skin: Skin;
  gameMode: ModeId;
  showHint: boolean;
  isTouch: boolean;
  goFlash: boolean;
}) {
  const hud = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: { xs: 8, sm: 14 },
          left: { xs: 8, sm: 14 },
          ...glass,
          borderRadius: 4,
          px: 1.5,
          py: 1,
          minWidth: { xs: 130, sm: 170 },
          pointerEvents: "none",
        }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <HoleIcon skin={skin} size={26} />
          <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.1 }}>
            Size {hud.level}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.75, height: 8, borderRadius: 99, bgcolor: "rgba(15,23,42,0.1)", overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${Math.round(hud.progress * 100)}%`,
              borderRadius: 99,
              background: skin.rainbow ? RAINBOW_RING : skin.color,
              transition: "width 120ms linear",
            }}
          />
        </Box>
        <Typography
          sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 20, sm: 24 }, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
          {fmtNum(hud.score)}
        </Typography>
      </Box>

      {/* timer */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 8, sm: 14 },
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}>
        <Box
          sx={{
            ...glass,
            borderRadius: 99,
            px: 2.25,
            py: 0.5,
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            fontSize: { xs: 24, sm: 30 },
            fontVariantNumeric: "tabular-nums",
            color: MODES[gameMode].duration && hud.timeLeft <= 10 ? "#dc2626" : "#0f172a",
            animation: MODES[gameMode].duration && hud.timeLeft <= 10 && hud.phase === "playing" ? `${pulse} 1s ease-in-out infinite` : undefined,
          }}>
          {MODES[gameMode].duration ? fmtTime(hud.phase === "countdown" ? MODES[gameMode].duration : hud.timeLeft) : `${Math.floor(hud.pct * 100)}%`}
        </Box>
      </Box>

      {/* leaderboard / progress */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 8, sm: 14 },
          right: { xs: 8, sm: 14 },
          ...glass,
          borderRadius: 4,
          px: 1.5,
          py: 1,
          width: { xs: 140, sm: 200 },
          pointerEvents: "none",
        }}>
        {gameMode === "classic" ? (
          <Leaderboard rows={hud.rows} />
        ) : (
          <>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: 13, color: "#475569" }}>City eaten</Typography>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>
              {Math.floor(hud.pct * 100)}%
            </Typography>
            <Box sx={{ mt: 0.5, height: 8, borderRadius: 99, bgcolor: "rgba(15,23,42,0.1)", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${hud.pct * 100}%`, bgcolor: "#22c55e", borderRadius: 99 }} />
            </Box>
            {gameMode === "solo" && (
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, fontSize: 14 }}>
                {SOLO_STARS.map((t) => (
                  <FontAwesomeIcon key={t} icon={faStar} style={{ color: hud.pct >= t ? "#f59e0b" : "#cbd5e1" }} />
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* countdown */}
      {(hud.phase === "countdown" || goFlash) && (
        <Box
          key={goFlash ? "go" : Math.ceil(hud.countdown)}
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}>
          <Box
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: { xs: 110, sm: 150 },
              textShadow: "0 6px 0 rgba(15,23,42,0.5)",
              WebkitTextStroke: "3px rgba(15,23,42,0.55)",
              paintOrder: "stroke fill",
              color: goFlash ? "#a3e635" : "#fff",
              animation: `${pop} ${goFlash ? 0.9 : 1}s ease-out forwards`,
            }}>
            {goFlash ? "GO!" : Math.max(1, Math.ceil(hud.countdown))}
          </Box>
        </Box>
      )}

      {/* respawn */}
      {!hud.alive && hud.phase === "playing" && (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <Box sx={{ ...glass, borderRadius: 4, px: 3, py: 2, textAlign: "center" }}>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 24 }}>Oh no! 😵</Typography>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: "#475569" }}>
              Back in {Math.max(1, Math.ceil(hud.respawnIn))}…
            </Typography>
          </Box>
        </Box>
      )}

      {/* first-time hint */}
      {showHint && hud.phase !== "countdown" && (
        <Box
          sx={{
            position: "absolute",
            bottom: { xs: 80, sm: 30 },
            left: "50%",
            transform: "translateX(-50%)",
            ...glass,
            borderRadius: 99,
            px: 2.5,
            py: 1,
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: { xs: 15, sm: 17 },
            whiteSpace: "nowrap",
            pointerEvents: "none",
            animation: `${bob} 1.6s ease-in-out infinite`,
          }}>
          {isTouch ? "👆 Drag anywhere to move" : "🖱️ Point where you want to go (or use arrow keys)"}
        </Box>
      )}

    </>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Overlay({ children, dim = 0.35 }: { children: React.ReactNode; dim?: number }) {
  return (
    <Box
      onPointerDown={(e) => e.stopPropagation()}
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: `rgba(15,23,42,${dim})`,
        p: 2,
        overflowY: "auto",
        touchAction: "auto",
        zIndex: 5,
      }}>
      {children}
    </Box>
  );
}

function Panel({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        zIndex: 5,
        width: "100%",
        maxWidth: wide ? 560 : 420,
        my: "auto",
        p: { xs: 2.25, sm: 3.5 },
        borderRadius: 6,
        textAlign: "center",
        bgcolor: "rgba(255,255,255,0.96)",
        color: "#0f172a",
        boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
      {children}
    </Paper>
  );
}

function BigButton({
  children,
  color,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  icon: typeof faPlay;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      variant="contained"
      startIcon={<FontAwesomeIcon icon={icon} />}
      sx={{
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        fontSize: 19,
        textTransform: "none",
        borderRadius: 99,
        px: 3.5,
        py: 0.9,
        minWidth: 180,
        bgcolor: color,
        boxShadow: "0 4px 0 rgba(15,23,42,0.25)",
        "&:hover": { bgcolor: color, filter: "brightness(1.08)" },
        "&:active": { transform: "translateY(2px)", boxShadow: "0 2px 0 rgba(15,23,42,0.25)" },
      }}>
      {children}
    </Button>
  );
}

function Leaderboard({ rows }: { rows: Row[] }) {
  const meIdx = rows.findIndex((r) => r.isPlayer);
  const top = rows.slice(0, 5);
  const showMe = meIdx >= 5;
  const line = (r: Row, place: number) => (
    <Box
      key={r.id}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        py: 0.2,
        px: 0.5,
        mx: -0.5,
        borderRadius: 1.5,
        bgcolor: r.isPlayer ? "rgba(124,58,237,0.12)" : "transparent",
        fontFamily: DISPLAY_FONT,
        fontSize: { xs: 12.5, sm: 14 },
        fontWeight: r.isPlayer ? 700 : 500,
      }}>
      <Box sx={{ width: 16, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{place}</Box>
      <ColorDot row={r} size={11} />
      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Box>
      <Box sx={{ fontVariantNumeric: "tabular-nums", display: { xs: "none", sm: "block" } }}>{fmtNum(r.score)}</Box>
    </Box>
  );
  return (
    <Box>
      {top.map((r, i) => line(r, i + 1))}
      {showMe && (
        <>
          <Box sx={{ textAlign: "center", color: "#94a3b8", lineHeight: 0.8, fontSize: 12 }}>⋯</Box>
          {line(rows[meIdx], meIdx + 1)}
        </>
      )}
    </Box>
  );
}

function ResultsBody({ result }: { result: Result }) {
  const headline = (() => {
    if (result.mode === "classic") {
      if (result.rank === 1) return { emoji: "🏆", title: "You're the BIGGEST hole!" };
      if (result.rank <= 3) return { emoji: result.rank === 2 ? "🥈" : "🥉", title: `${ordinal(result.rank)} place!` };
      return { emoji: "💪", title: `${ordinal(result.rank)} place. Try again!` };
    }
    if (result.mode === "solo") {
      return { emoji: result.stars === 3 ? "🌟" : result.stars ? "⭐" : "🕳️", title: `You ate ${Math.floor(result.pct * 100)}% of the city!` };
    }
    return result.cleared
      ? { emoji: "🎉", title: `City cleared in ${fmtTime(result.seconds)}!` }
      : { emoji: "😋", title: `You ate ${Math.floor(result.pct * 100)}% of the city!` };
  })();

  return (
    <>
      <Box sx={{ fontSize: 64, lineHeight: 1, mb: 1 }}>{headline.emoji}</Box>
      <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 26, sm: 30 }, lineHeight: 1.15, mb: 1 }}>
        {headline.title}
      </Typography>

      {result.mode === "solo" && (
        <Box sx={{ display: "flex", gap: 1, justifyContent: "center", fontSize: 40, mb: 1 }}>
          {SOLO_STARS.map((t, i) => (
            <FontAwesomeIcon key={t} icon={faStar} style={{ color: i < result.stars ? "#f59e0b" : "#e2e8f0" }} />
          ))}
        </Box>
      )}

      <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: "#475569" }}>
        Score <b style={{ color: "#0f172a" }}>{fmtNum(result.score)}</b>
        {result.newBest ? " · New best! 🎉" : ` · Best ${fmtNum(result.best)}`}
      </Typography>

      {result.mode === "classic" && <Podium rows={result.rows} />}
    </>
  );
}
