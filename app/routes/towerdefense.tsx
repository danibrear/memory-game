import {
  faArrowUp,
  faCoins,
  faFlag,
  faForward,
  faHeart,
  faPause,
  faPlay,
  faRotateRight,
  faSkull,
  faTrophy,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Box,
  Button,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx, unlockAudio } from "~/games/towerdefense/audio";
import {
  COLS,
  ENEMIES,
  MAX_LIVES,
  ROWS,
  TOTAL_WAVES,
  TOWERS,
  TOWER_ORDER,
  WAVES,
  type EnemyType,
  type TowerType,
} from "~/games/towerdefense/config";
import {
  canCallWave,
  canPlace,
  createGame,
  placeTower,
  sellTower,
  sellValue,
  startWave,
  step,
  towerAt,
  upgradeCost,
  upgradeTower,
  type Game,
  type Level,
  type Phase,
  type Tower,
} from "~/games/towerdefense/engine";
import {
  drawBoard,
  drawEnemySprite,
  drawTower,
  renderFrame,
} from "~/games/towerdefense/sprites";
import type { Route } from "./+types/towerdefense";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tower Defense - Games by DaniB" },
    { name: "description", content: "Build a maze of towers and stop the waves!" },
  ];
}

const STEP = 1 / 60;
const MUTE_KEY = "td-muted";

interface Hud {
  gold: number;
  lives: number;
  wave: number;
  phase: Phase;
  canCall: boolean;
  remaining: number;
}

const snapshot = (g: Game): Hud => ({
  gold: g.gold,
  lives: g.lives,
  wave: g.wave,
  phase: g.phase,
  canCall: canCallWave(g),
  remaining: g.enemies.length + g.spawnQueue.length,
});

const sameHud = (a: Hud, b: Hud) =>
  a.gold === b.gold &&
  a.lives === b.lives &&
  a.wave === b.wave &&
  a.phase === b.phase &&
  a.canCall === b.canCall &&
  a.remaining === b.remaining;

// ─── Sprite icons (small static canvases) ─────────────────────────────────────

function useSpriteCanvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, ...deps]);
  return ref;
}

function TowerIcon({ type, level = 0, size = 48 }: { type: TowerType; level?: Level; size?: number }) {
  const ref = useSpriteCanvas(
    size,
    (ctx) =>
      drawTower(ctx, type, level, { angle: -Math.PI / 4, recoil: 0, flash: 0 }, size / 2, size / 2 - size * 0.04, size * 0.95, 0.6),
    [type, level],
  );
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

function EnemyIcon({ type, size = 26 }: { type: EnemyType; size?: number }) {
  const ref = useSpriteCanvas(
    size,
    (ctx) => {
      const r = ENEMIES[type].radius;
      const s = (size * 0.8) / (r * 2.9);
      drawEnemySprite(ctx, type, size / 2, size / 2 + size * 0.08, s, 0, { dirX: 1, dirY: 0.3, seed: 1.2 });
    },
    [type],
  );
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Stat({ icon, color, children }: { icon: typeof faCoins; color: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderRadius: 99,
        bgcolor: "action.hover",
        fontWeight: 800,
        fontSize: { xs: "0.95rem", md: "1.1rem" },
        fontVariantNumeric: "tabular-nums",
      }}>
      <FontAwesomeIcon icon={icon} style={{ color }} />
      {children}
    </Box>
  );
}

function describeLevel(type: TowerType, level: Level) {
  const s = TOWERS[type].levels[level];
  const rows: { label: string; value: string }[] = [
    { label: "Damage", value: String(s.dmg) },
    { label: "Range", value: s.range.toFixed(1) },
    { label: "Speed", value: `${s.rate}/s` },
  ];
  if (s.splash) rows.push({ label: "Blast", value: s.splash.toFixed(1) });
  if (s.slow) rows.push({ label: "Slow", value: `${Math.round((1 - s.slow) * 100)}% · ${s.slowDur}s` });
  if (s.chains) rows.push({ label: "Chains", value: String(s.chains) });
  return rows;
}

function TowerPanel({
  tower,
  gold,
  onUpgrade,
  onSell,
  onClose,
}: {
  tower: Tower;
  gold: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  const def = TOWERS[tower.type];
  const cost = upgradeCost(tower);
  const now = describeLevel(tower.type, tower.level);
  const next = tower.level < 2 ? describeLevel(tower.type, (tower.level + 1) as Level) : null;
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 3,
        minWidth: 260,
        flex: { xs: "1 1 100%", md: "0 0 300px" },
        borderTop: `4px solid ${def.color}`,
      }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <TowerIcon type={tower.type} level={tower.level} size={56} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{def.name}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Level {tower.level + 1} of 3
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.25, mb: 1.5 }}>
        {now.map((row, i) => {
          const upgraded = next && next[i] && next[i].value !== row.value ? next[i].value : null;
          return (
            <Box key={row.label} sx={{ display: "contents" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {row.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {row.value}
                {upgraded && (
                  <Box component="span" sx={{ color: "success.main", ml: 1 }}>
                    → {upgraded}
                  </Box>
                )}
              </Typography>
            </Box>
          );
        })}
        {next && next.length > now.length && (
          <>
            {next.slice(now.length).map((row) => (
              <Box key={row.label} sx={{ display: "contents" }}>
                <Typography variant="body2" sx={{ color: "success.main" }}>
                  {row.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>
                  NEW · {row.value}
                </Typography>
              </Box>
            ))}
          </>
        )}
        {def.pierce && (
          <Typography variant="body2" sx={{ gridColumn: "1 / -1", color: "text.secondary" }}>
            Shots ignore armor
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          color="success"
          disabled={cost === null || gold < cost}
          onClick={onUpgrade}
          startIcon={<FontAwesomeIcon icon={faArrowUp} />}
          sx={{ fontWeight: 800 }}>
          {cost === null ? "Max level" : `Upgrade · ${cost}`}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onSell}
          sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
          Sell +{sellValue(tower)}
        </Button>
      </Box>
    </Paper>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TowerDefense() {
  const gameRef = useRef<Game>(createGame());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);
  const hoverRef = useRef<{ r: number; c: number } | null>(null);

  const [cs, setCs] = useState(40);
  const [hud, setHud] = useState<Hud>(() => snapshot(gameRef.current));
  const [tool, setTool] = useState<TowerType | null>("blaster");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, bump] = useState(0);

  // Live values the animation loop reads without re-subscribing
  const live = useRef({ tool, selectedId, speed, paused, muted, cs });
  live.current = { tool, selectedId, speed, paused, muted, cs };

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Responsive cell size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setCs(Math.max(16, Math.min(52, Math.floor(el.clientWidth / COLS))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  // Game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const g = gameRef.current;
      const L = live.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!L.paused) {
        acc += dt * L.speed;
        let steps = 0;
        while (acc >= STEP && steps < 8) {
          step(g, STEP);
          acc -= STEP;
          steps++;
        }
        if (steps === 8) acc = 0;
      }

      // Sound
      if (g.sfx.length) {
        if (!L.muted) for (const s of new Set(g.sfx)) playSfx(s);
        g.sfx.length = 0;
      }

      // Render
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const s = L.cs;
        const dpr = window.devicePixelRatio || 1;
        const pw = Math.round(COLS * s * dpr);
        const ph = Math.round(ROWS * s * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        const key = `${g.routeVersion}:${s}:${dpr}`;
        if (!boardRef.current || boardRef.current.key !== key) {
          const board = boardRef.current?.canvas ?? document.createElement("canvas");
          board.width = pw;
          board.height = ph;
          const bctx = board.getContext("2d");
          if (bctx) {
            bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawBoard(bctx, g, s);
          }
          boardRef.current = { canvas: board, key };
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, COLS * s, ROWS * s);

        const hover = hoverRef.current;
        const selected = L.selectedId !== null ? g.towers.find((t) => t.id === L.selectedId) ?? null : null;
        const building = L.tool !== null && g.phase !== "gameover" && g.phase !== "win";
        const showGhost = building && hover && !towerAt(g, hover.r, hover.c);
        renderFrame(ctx, g, {
          s,
          board: boardRef.current.canvas,
          showGrid: building,
          hover: showGhost ? hover : null,
          ghost:
            showGhost && L.tool
              ? { type: L.tool, ok: canPlace(g, L.tool, hover!.r, hover!.c).ok }
              : null,
          selected,
          maxLives: MAX_LIVES,
        });
      }

      const snap = snapshot(g);
      setHud((prev) => (sameHud(prev, snap) ? prev : snap));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const cellFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  };

  /** Pick a tower to build. `toggle` lets a second tap on the same shop card cancel it. */
  const chooseTool = useCallback((t: TowerType, toggle = false) => {
    setTool((cur) => (toggle && cur === t ? null : t));
    setSelectedId(null);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    unlockAudio();
    const cell = cellFromEvent(e);
    if (!cell) return;
    const g = gameRef.current;
    const existing = towerAt(g, cell.r, cell.c);
    if (existing) {
      setSelectedId(existing.id);
      setTool(null);
      return;
    }
    if (tool) {
      const res = placeTower(g, tool, cell.r, cell.c);
      if (!res.ok) setToast(res.reason);
      bump((n) => n + 1);
      return;
    }
    setSelectedId(null);
  };

  const callWave = useCallback(() => {
    unlockAudio();
    startWave(gameRef.current);
    setPaused(false);
  }, []);

  const upgradeSelected = useCallback(() => {
    if (selectedId === null) return;
    upgradeTower(gameRef.current, selectedId);
    bump((n) => n + 1);
  }, [selectedId]);

  const sellSelected = useCallback(() => {
    if (selectedId === null) return;
    sellTower(gameRef.current, selectedId);
    setSelectedId(null);
  }, [selectedId]);

  const restart = () => {
    gameRef.current = createGame();
    boardRef.current = null;
    setSelectedId(null);
    setTool("blaster");
    setPaused(false);
    setHud(snapshot(gameRef.current));
  };

  const toggleMute = () => {
    unlockAudio();
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !m;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TOWER_ORDER.length) {
        chooseTool(TOWER_ORDER[idx]);
      } else if (e.key === "Escape") {
        setTool(null);
        setSelectedId(null);
      } else if (e.key === " ") {
        e.preventDefault();
        callWave();
      } else if (e.key.toLowerCase() === "u") {
        upgradeSelected();
      } else if (e.key.toLowerCase() === "p") {
        setPaused((p) => !p);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        sellSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseTool, callWave, upgradeSelected, sellSelected]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const g = gameRef.current;
  const selected = selectedId !== null ? g.towers.find((t) => t.id === selectedId) ?? null : null;
  const nextWave = hud.wave < TOTAL_WAVES ? WAVES[hud.wave] : null;
  const over = hud.phase === "gameover" || hud.phase === "win";

  return (
    <Box sx={{ pb: 6, pt: 1, maxWidth: COLS * 52 + 16, mx: "auto" }}>
      {/* HUD */}
      <Paper
        elevation={2}
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: { xs: 1, md: 1.5 },
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 3,
        }}>
        <Stat icon={faCoins} color="#f59e0b">
          {hud.gold}
        </Stat>
        <Stat icon={faHeart} color="#ef4444">
          {hud.lives}
        </Stat>
        <Stat icon={faFlag} color="#6366f1">
          {Math.max(1, hud.wave)}/{TOTAL_WAVES}
        </Stat>
        {nextWave && hud.canCall && (
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.75, ml: 0.5 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, mr: 0.25 }}>
              NEXT
            </Typography>
            {nextWave.groups.map((gr, i) => (
              <Tooltip key={i} title={ENEMIES[gr.type].name} arrow>
                <Box sx={{ display: "flex", alignItems: "center", fontWeight: 800, fontSize: "0.85rem" }}>
                  <EnemyIcon type={gr.type} />×{gr.count}
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}
        {hud.phase === "wave" && !hud.canCall && (
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
            {hud.remaining} enemies left
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={speed}
          onChange={(_, v) => v && setSpeed(v)}
          aria-label="Game speed">
          <ToggleButton value={1} sx={{ fontWeight: 800, px: 1.25 }}>
            1×
          </ToggleButton>
          <ToggleButton value={2} sx={{ fontWeight: 800, px: 1.25 }}>
            2×
          </ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title={paused ? "Resume (P)" : "Pause (P)"}>
          <IconButton onClick={() => setPaused((p) => !p)} disabled={over}>
            <FontAwesomeIcon icon={paused ? faPlay : faPause} />
          </IconButton>
        </Tooltip>
        <Tooltip title={muted ? "Sound on" : "Mute"}>
          <IconButton onClick={toggleMute}>
            <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          disabled={!hud.canCall}
          onClick={callWave}
          startIcon={<FontAwesomeIcon icon={hud.phase === "wave" ? faForward : faPlay} />}
          sx={{
            fontWeight: 900,
            borderRadius: 99,
            px: 2.5,
            background: hud.canCall ? "linear-gradient(135deg, #22c55e 0%, #15803d 100%)" : undefined,
            boxShadow: hud.canCall ? "0 4px 14px rgba(34,197,94,0.45)" : undefined,
          }}>
          {hud.phase === "wave" ? "Send next" : hud.wave === 0 ? "Start" : `Wave ${hud.wave + 1}`}
        </Button>
      </Paper>

      {/* Board */}
      <Box ref={wrapRef} sx={{ width: "100%" }}>
        <Box
          sx={{
            position: "relative",
            width: COLS * cs,
            height: ROWS * cs,
            mx: "auto",
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25), inset 0 0 0 3px rgba(0,0,0,0.15)",
            touchAction: "manipulation",
          }}>
          <canvas
            ref={canvasRef}
            style={{
              width: COLS * cs,
              height: ROWS * cs,
              display: "block",
              cursor: tool ? "crosshair" : "pointer",
            }}
            onPointerMove={(e) => {
              if (e.pointerType === "mouse") hoverRef.current = cellFromEvent(e);
            }}
            onPointerLeave={() => (hoverRef.current = null)}
            onClick={handleClick}
            onContextMenu={(e) => {
              e.preventDefault();
              setTool(null);
              setSelectedId(null);
            }}
          />

          {toast && (
            <Box
              sx={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "rgba(17,24,39,0.88)",
                color: "white",
                px: 2,
                py: 0.75,
                borderRadius: 99,
                fontWeight: 700,
                fontSize: "0.9rem",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}>
              {toast}
            </Box>
          )}

          {paused && !over && (
            <Box
              onClick={() => setPaused(false)}
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(15,23,42,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}>
              <Typography sx={{ color: "white", fontWeight: 900, fontSize: "2rem", textShadow: "0 2px 8px #000" }}>
                <FontAwesomeIcon icon={faPause} /> Paused
              </Typography>
            </Box>
          )}

          {over && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(15,23,42,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
              }}>
              <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4, textAlign: "center", maxWidth: 340 }}>
                <Box sx={{ fontSize: "3rem", color: hud.phase === "win" ? "#f59e0b" : "#64748b", mb: 1 }}>
                  <FontAwesomeIcon icon={hud.phase === "win" ? faTrophy : faSkull} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
                  {hud.phase === "win" ? "You Won!" : "Game Over"}
                </Typography>
                <Typography sx={{ mb: 3, color: "text.secondary" }}>
                  {hud.phase === "win"
                    ? `All ${TOTAL_WAVES} waves defeated with ${hud.lives} lives left!`
                    : `You made it to wave ${hud.wave}.`}
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={restart}
                  startIcon={<FontAwesomeIcon icon={faRotateRight} />}
                  sx={{ fontWeight: 900, borderRadius: 99, px: 3 }}>
                  Play again
                </Button>
              </Paper>
            </Box>
          )}
        </Box>
      </Box>

      {/* Shop + selected tower */}
      <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap", alignItems: "stretch" }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flex: 1, alignContent: "flex-start" }}>
          {TOWER_ORDER.map((type, i) => {
            const def = TOWERS[type];
            const cost = def.levels[0].cost;
            const active = tool === type;
            const affordable = hud.gold >= cost;
            return (
              <Paper
                key={type}
                elevation={active ? 6 : 1}
                onClick={() => chooseTool(type, true)}
                sx={{
                  position: "relative",
                  width: { xs: "calc(33.33% - 6px)", sm: 132 },
                  p: 1,
                  borderRadius: 3,
                  cursor: "pointer",
                  textAlign: "center",
                  border: "2px solid",
                  borderColor: active ? def.color : "transparent",
                  bgcolor: active ? `${def.color}1f` : "background.paper",
                  opacity: affordable ? 1 : 0.55,
                  transition: "transform 0.12s ease, box-shadow 0.12s ease",
                  userSelect: "none",
                  "@media (hover: hover)": { "&:hover": { transform: "translateY(-2px)" } },
                  "&:active": { transform: "scale(0.97)" },
                }}>
                <Box
                  sx={{
                    position: "absolute",
                    top: 6,
                    left: 8,
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    color: "text.disabled",
                    display: { xs: "none", md: "block" },
                  }}>
                  {i + 1}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <TowerIcon type={type} size={52} />
                </Box>
                <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", lineHeight: 1.2 }}>{def.name}</Typography>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: affordable ? "#d97706" : "text.disabled",
                  }}>
                  <FontAwesomeIcon icon={faCoins} /> {cost}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary", lineHeight: 1.25, mt: 0.25 }}>
                  {def.tagline}
                </Typography>
              </Paper>
            );
          })}
        </Box>
        {selected && (
          <TowerPanel
            tower={selected}
            gold={hud.gold}
            onUpgrade={upgradeSelected}
            onSell={sellSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </Box>

      <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
        Build towers on the grass to make a maze. Enemies always take the shortest way to your castle, and
        you can keep building during a wave. Tap a tower to upgrade or sell it.
      </Typography>
      <Typography variant="caption" sx={{ display: { xs: "none", md: "block" }, color: "text.disabled", mt: 0.5 }}>
        Shortcuts: 1–5 pick a tower · Space start / send wave · U upgrade · Delete sell · P pause · Esc cancel
      </Typography>
    </Box>
  );
}
