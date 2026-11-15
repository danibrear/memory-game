import {
  faArrowUp,
  faBolt,
  faCoins,
  faCrosshairs,
  faGem,
  faMeteor,
  faSnowflake,
  faTowerBroadcast,
  faTriangleExclamation,
  faFlag,
  faForward,
  faHeart,
  faInfinity,
  faLightbulb,
  faMap,
  faPause,
  faPlay,
  faRepeat,
  faRotateRight,
  faSkull,
  faStar,
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
import GameIconTile from "~/components/GameIconTile";
import { NAV_HEIGHT } from "~/components/NavBar";
import {
  ChoiceGroup,
  Confetti,
  GameShell,
  KitButton,
  KitDialog,
  getGame,
} from "~/components/game/GameKit";
import { playSfx, unlockAudio } from "~/games/towerdefense/audio";
import {
  ABILITIES,
  COLS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENEMIES,
  ENEMY_ORDER,
  HILL_RANGE_BONUS,
  MAPS,
  ROWS,
  TARGETING,
  TARGETING_ORDER,
  TERRAIN,
  TOTAL_WAVES,
  TOWERS,
  TOWER_ORDER,
  getMap,
  starsFor,
  waveDef,
  type Cell,
  type Difficulty,
  type EnemyType,
  type MapDef,
  type Targeting,
  type Terrain,
  type TowerLevel,
  type TowerType,
} from "~/games/towerdefense/config";
import {
  canCallWave,
  canPlace,
  canSpecialize,
  castFreeze,
  castMeteor,
  chooseSpec,
  clearRubble,
  continueEndless,
  createGame,
  mineIncome,
  nextEvent,
  placeTower,
  sellTower,
  sellValue,
  setTargeting,
  startWave,
  step,
  towerAt,
  towerStats,
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
  drawMapThumb,
  drawTerrainSwatch,
  drawTower,
  renderFrame,
} from "~/games/towerdefense/sprites";
import { getStoredData, setStoredData } from "~/storage";
import towerDefenseStyles from "~/styles/towerdefense.css?url";
import type { Route } from "./+types/towerdefense";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: towerDefenseStyles },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tower Defense - Games by DaniB" },
    { name: "description", content: "Build a maze of towers across five battlefields and stop the waves!" },
  ];
}

const STEP = 1 / 60;
const MUTE_KEY = "td-muted";
const AUTO_KEY = "td-auto";
/** With auto-start on: seconds between the board clearing and the next wave setting off. */
const AUTO_START_DELAY = 5;
/** Where the battle's top bar rests once the page scrolls: just under the site nav. */
const HUD_TOP = NAV_HEIGHT + 8;
const SAVE_KEY = "tower-defense";

// ─── Saved progress ───────────────────────────────────────────────────────────

interface Save {
  difficulty: Difficulty;
  /** Best stars per map, per difficulty. */
  stars: Record<string, Partial<Record<Difficulty, number>>>;
  /** Highest endless wave reached per map. */
  endless: Record<string, number>;
}

const EMPTY_SAVE: Save = { difficulty: "normal", stars: {}, endless: {} };

function loadSave(): Save {
  const raw = getStoredData(SAVE_KEY) as Partial<Save> | null;
  if (!raw || typeof raw !== "object") return EMPTY_SAVE;
  return {
    difficulty: DIFFICULTY_ORDER.includes(raw.difficulty as Difficulty) ? (raw.difficulty as Difficulty) : "normal",
    stars: raw.stars && typeof raw.stars === "object" ? raw.stars : {},
    endless: raw.endless && typeof raw.endless === "object" ? raw.endless : {},
  };
}

// ─── Sprite icons (small static canvases) ─────────────────────────────────────

function useCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[],
) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);
  return ref;
}

function TowerIcon({
  type,
  level = 0,
  spec = null,
  size = 48,
}: {
  type: TowerType;
  level?: Level;
  spec?: 0 | 1 | null;
  size?: number;
}) {
  const ref = useCanvas(
    size,
    size,
    (ctx) =>
      drawTower(ctx, type, level, { angle: -Math.PI / 4, recoil: 0, flash: 0 }, size / 2, size / 2 - size * 0.04, size * 0.95, 0.6, spec),
    [type, level, spec],
  );
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

function EnemyIcon({ type, size = 26 }: { type: EnemyType; size?: number }) {
  const ref = useCanvas(
    size,
    size,
    (ctx) => {
      const r = ENEMIES[type].radius;
      // Flyers need extra room for their wings.
      const s = (size * (ENEMIES[type].flying ? 0.5 : 0.8)) / (r * 2.9);
      const y = size / 2 + size * (ENEMIES[type].flying ? 0.22 : 0.08);
      drawEnemySprite(ctx, type, size / 2, y, s, 0, { dirX: 1, dirY: 0.3, seed: 1.2 });
    },
    [type],
  );
  return <canvas ref={ref} style={{ width: size, height: size, display: "block", flexShrink: 0 }} />;
}

function TerrainIcon({ type, size = 36 }: { type: Terrain; size?: number }) {
  const ref = useCanvas(size, size, (ctx) => drawTerrainSwatch(ctx, type, size), [type]);
  return <canvas ref={ref} className="td-swatch" style={{ width: size, height: size }} />;
}

const THUMB_CELL = 16;

function MapThumb({ map }: { map: MapDef }) {
  const ref = useCanvas(COLS * THUMB_CELL, ROWS * THUMB_CELL, (ctx) => drawMapThumb(ctx, map, THUMB_CELL), [map.id]);
  return <canvas ref={ref} className="td-thumb" />;
}

// ─── Map picker ───────────────────────────────────────────────────────────────

function StarRow({ count }: { count: number }) {
  return (
    <span className="td-stars" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <FontAwesomeIcon key={i} icon={faStar} className={i < count ? "is-lit" : undefined} />
      ))}
    </span>
  );
}

const GUIDE_TERRAIN: Terrain[] = ["hill", "road", "water", "rock", "rubble"];

const GUIDE_TOOLS = [
  {
    icon: faGem,
    name: "Final forms",
    text: "A level-3 tower can become one of two specialists. The choice is permanent.",
  },
  {
    icon: faTowerBroadcast,
    name: "Beacon",
    text: "Towers in its light fire faster, and it's the main way to make Shades targetable.",
  },
  {
    icon: faCoins,
    name: "Gold Mine",
    text: "Pays out every wave. Greedy early mines win long games, if you survive them.",
  },
  { icon: faMeteor, name: "Meteor", text: "Your own strike on a 40 second cooldown. Hits everything where it lands." },
  { icon: faSnowflake, name: "Cold Snap", text: "Slows the whole map for 4 seconds. Save it for a leak." },
  {
    icon: faBolt,
    name: "Shifting maps",
    text: "Tidewater floods and Rockslide Pass loses its walls. Marked tiles show what changes and when.",
  },
];

function MapSelect({
  save,
  onDifficulty,
  onPlay,
}: {
  save: Save;
  onDifficulty: (d: Difficulty) => void;
  onPlay: (map: MapDef) => void;
}) {
  const game = getGame("towerdefense");
  const earned = MAPS.reduce((sum, m) => sum + (save.stars[m.id]?.[save.difficulty] ?? 0), 0);
  return (
    <div className="td-menu">
      <header className="td-menu-head">
        <GameIconTile game={game} size={76} />
        <div>
          <h1 className="dg-title">Tower Defense</h1>
          <p className="dg-subtitle td-menu-sub">
            Pick a battlefield. Each one changes where you can build and where the enemy can walk.
          </p>
        </div>
      </header>

      <div className="td-diff">
        <ChoiceGroup
          label="Difficulty"
          value={save.difficulty}
          onChange={onDifficulty}
          options={DIFFICULTY_ORDER.map((d) => ({ value: d, label: DIFFICULTIES[d].name }))}
        />
        <span className="dg-caption">{DIFFICULTIES[save.difficulty].blurb}</span>
        <span className="td-total">
          <FontAwesomeIcon icon={faStar} /> {earned} / {MAPS.length * 3}
        </span>
      </div>

      <div className="td-maps">
        {MAPS.map((map) => {
          const stars = save.stars[map.id]?.[save.difficulty] ?? 0;
          const endless = save.endless[map.id] ?? 0;
          return (
            <button key={map.id} type="button" className="td-map" onClick={() => onPlay(map)}>
              <MapThumb map={map} />
              <span className="td-map-body">
                <span className="td-map-top">
                  <span className="td-map-name">{map.name}</span>
                  <span className="td-skulls" aria-label={`Danger ${map.skulls} of 3`}>
                    {[0, 1, 2].map((i) => (
                      <FontAwesomeIcon key={i} icon={faSkull} className={i < map.skulls ? "is-lit" : undefined} />
                    ))}
                  </span>
                </span>
                <span className="td-map-blurb">{map.blurb}</span>
                <span className="td-map-tip">
                  <FontAwesomeIcon icon={faLightbulb} /> {map.tip}
                </span>
                <span className="td-map-foot">
                  <StarRow count={stars} />
                  {endless > 0 && (
                    <span className="td-endless">
                      <FontAwesomeIcon icon={faInfinity} /> wave {endless}
                    </span>
                  )}
                  <span className="td-play">
                    <FontAwesomeIcon icon={faPlay} /> Play
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="td-guides">
        <section className="dg-panel td-guide">
          <span className="dg-label">Know the ground</span>
          <ul>
            {GUIDE_TERRAIN.map((t) => (
              <li key={t}>
                <TerrainIcon type={t} />
                <span>
                  <b>{TERRAIN[t].name}</b>
                  {TERRAIN[t].hint}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="dg-panel td-guide">
          <span className="dg-label">Know your tools</span>
          <ul>
            {GUIDE_TOOLS.map((tool) => (
              <li key={tool.name}>
                <span className="td-tool-icon">
                  <FontAwesomeIcon icon={tool.icon} />
                </span>
                <span>
                  <b>{tool.name}</b>
                  {tool.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="dg-panel td-guide">
          <span className="dg-label">Know the enemy</span>
          <ul>
            {ENEMY_ORDER.map((t) => (
              <li key={t}>
                <EnemyIcon type={t} size={36} />
                <span>
                  <b>{ENEMIES[t].name}</b>
                  {ENEMIES[t].trait}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
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

const pct = (n: number) => `+${Math.round(n * 100)}%`;

/** The numbers that matter for one level (or final form) of a tower. */
function describeStats(type: TowerType, s: TowerLevel, tower?: Tower) {
  const hill = tower?.onHill ? HILL_RANGE_BONUS : 1;
  const rows: { label: string; value: string }[] = [];
  if (s.aura) {
    rows.push({ label: "Light", value: (s.range * hill).toFixed(1) });
    rows.push({ label: "Fire rate", value: pct(s.aura.rate) });
    if (s.aura.range) rows.push({ label: "Range", value: pct(s.aura.range) });
    if (s.aura.shield) rows.push({ label: "Jam-proof", value: "Yes" });
    return rows;
  }
  if (s.income) {
    rows.push({ label: "Gold per wave", value: String(s.income) });
    if (s.bounty) rows.push({ label: "Kill gold", value: pct(s.bounty) });
    return rows;
  }
  const range = s.range * hill * (1 + (tower?.buffRange ?? 0));
  const rate = s.rate * (1 + (tower?.buffRate ?? 0));
  rows.push({ label: "Damage", value: String(s.dmg) });
  rows.push({ label: "Range", value: range.toFixed(1) });
  rows.push({ label: "Speed", value: `${Number(rate.toFixed(2))}/s` });
  if (s.splash) rows.push({ label: "Blast", value: s.splash.toFixed(1) });
  if (s.slow) rows.push({ label: "Slow", value: `${Math.round((1 - s.slow) * 100)}% · ${s.slowDur}s` });
  if (s.chains && TOWERS[type].levels[0].chains) rows.push({ label: "Chains", value: String(s.chains) });
  if (s.burn) rows.push({ label: "Burn", value: `${s.burn}/s · ${s.burnDur}s` });
  if (s.stun) rows.push({ label: "Freeze", value: `${s.stun}s` });
  return rows;
}

/** The fine print for a tower: what it can and can't do right now. */
function towerNotes(tower: Tower): string[] {
  const def = TOWERS[tower.type];
  const stats = towerStats(tower);
  const notes: string[] = [];
  if (tower.onHill) notes.push(def.role === "income" ? "On a hilltop (no bonus for mines)" : "On a hilltop: +25% range");
  if (def.role === "support") {
    notes.push("Shades inside the light can be targeted");
    notes.push("Bonuses from several Beacons don't add up");
    return notes;
  }
  if (def.role === "income") {
    notes.push("Pays out each time a wave starts, from the wave after it was built");
    return notes;
  }
  if (tower.buffRate > 0) {
    notes.push(`In a Beacon's light: ${pct(tower.buffRate)} speed${tower.buffRange ? `, ${pct(tower.buffRange)} range` : ""}`);
  }
  if (tower.shielded) notes.push("Shielded from Jinx pulses");
  if (stats.pierce ?? def.pierce) notes.push("Shots ignore armor");
  if (stats.seesStealth) notes.push("Spots Shades without a Beacon");
  notes.push(def.needsSight && !stats.overRocks ? "Needs a clear view: rocks block its shots" : "Fires over rocks and rubble");
  if (!def.hitsAir) notes.push("Can't hit flying enemies");
  return notes;
}

function TowerPanel({
  tower,
  gold,
  onUpgrade,
  onSpec,
  onSell,
  onTargeting,
  onClose,
}: {
  tower: Tower;
  gold: number;
  onUpgrade: () => void;
  onSpec: (spec: 0 | 1) => void;
  onSell: () => void;
  onTargeting: (t: Targeting) => void;
  onClose: () => void;
}) {
  const def = TOWERS[tower.type];
  const cost = upgradeCost(tower);
  const stats = towerStats(tower);
  const now = describeStats(tower.type, stats, tower);
  const next = tower.level < 2 ? describeStats(tower.type, def.levels[tower.level + 1], tower) : null;
  const choosing = canSpecialize(tower);
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 3,
        minWidth: 260,
        flex: { xs: "1 1 100%", md: "0 0 340px" },
        borderTop: `4px solid ${def.color}`,
      }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <TowerIcon type={tower.type} level={tower.level} spec={tower.spec} size={56} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>
            {tower.spec !== null ? def.specs[tower.spec].name : def.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {tower.spec !== null ? `${def.name} · final form` : `Level ${tower.level + 1} of 3`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.25, mb: 1 }}>
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
      </Box>
      <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25, color: "text.secondary", fontSize: "0.82rem", lineHeight: 1.45 }}>
        {towerNotes(tower).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </Box>

      {def.role === "attack" && (
        <>
          <Typography
            variant="caption"
            sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 800, color: "text.secondary", mb: 0.5 }}>
            <FontAwesomeIcon icon={faCrosshairs} /> SHOOT AT
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={tower.targeting}
            onChange={(_, v: Targeting | null) => v && onTargeting(v)}
            aria-label="Targeting"
            sx={{ mb: 1.5 }}>
            {TARGETING_ORDER.map((t) => (
              <Tooltip key={t} title={TARGETING[t].hint} arrow>
                <ToggleButton value={t} sx={{ fontWeight: 800, textTransform: "none", py: 0.4 }}>
                  {TARGETING[t].label}
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </>
      )}

      {choosing && (
        <>
          <Typography
            variant="caption"
            sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 800, color: "text.secondary", mb: 0.75 }}>
            <FontAwesomeIcon icon={faGem} /> CHOOSE A FINAL FORM (YOU CAN'T SWITCH LATER)
          </Typography>
          <div className="td-specs">
            {def.specs.map((spec, i) => {
              const affordable = gold >= spec.cost;
              return (
                <button
                  key={spec.name}
                  type="button"
                  className="td-spec"
                  disabled={!affordable}
                  onClick={() => onSpec(i as 0 | 1)}
                  style={{ borderColor: def.color }}>
                  <span className="td-spec-top">
                    <TowerIcon type={tower.type} level={2} spec={i as 0 | 1} size={40} />
                    <span>
                      <b>{spec.name}</b>
                      <span className="td-spec-cost">
                        <FontAwesomeIcon icon={faCoins} /> {spec.cost}
                      </span>
                    </span>
                  </span>
                  <span className="td-spec-blurb">{spec.blurb}</span>
                  <span className="td-spec-stats">
                    {describeStats(tower.type, spec, tower)
                      .map((row) => `${row.label} ${row.value}`)
                      .join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <Box sx={{ display: "flex", gap: 1 }}>
        {!choosing && (
          <Button
            fullWidth
            variant="contained"
            color="success"
            disabled={cost === null || gold < cost}
            onClick={onUpgrade}
            startIcon={<FontAwesomeIcon icon={faArrowUp} />}
            sx={{ fontWeight: 800 }}>
            {cost === null ? "Final form" : `Upgrade · ${cost}`}
          </Button>
        )}
        <Button
          fullWidth={choosing}
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

function RubblePanel({
  cost,
  gold,
  onClear,
  onClose,
}: {
  cost: number;
  gold: number;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 3,
        minWidth: 260,
        flex: { xs: "1 1 100%", md: "0 0 320px" },
        borderTop: "4px solid #978c7d",
      }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <TerrainIcon type="rubble" size={52} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>Rubble</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Blocks the way and the view
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </Box>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        Clearing it leaves open ground you can build on. Enemies can walk there too, so check it doesn't hand them
        a shortcut.
      </Typography>
      <Button
        fullWidth
        variant="contained"
        color="warning"
        disabled={gold < cost}
        onClick={onClear}
        startIcon={<FontAwesomeIcon icon={faCoins} />}
        sx={{ fontWeight: 800 }}>
        Clear · {cost}
      </Button>
    </Paper>
  );
}

// ─── Battle ───────────────────────────────────────────────────────────────────

interface Hud {
  gold: number;
  lives: number;
  wave: number;
  phase: Phase;
  endless: boolean;
  canCall: boolean;
  remaining: number;
  /** Whole seconds until each ability is ready (0 = ready). */
  meteorCd: number;
  freezeCd: number;
  /** Gold the mines will pay when the next wave starts. */
  income: number;
  /** Wave of the next flood / rockslide, or 0. */
  eventWave: number;
  towers: number;
}

const snapshot = (g: Game): Hud => ({
  gold: g.gold,
  lives: g.lives,
  wave: g.wave,
  phase: g.phase,
  endless: g.endless,
  canCall: canCallWave(g),
  remaining: g.enemies.length + g.spawnQueue.length,
  meteorCd: Math.ceil(g.cooldowns.meteor),
  freezeCd: Math.ceil(g.cooldowns.freeze),
  income: mineIncome(g),
  eventWave: nextEvent(g)?.wave ?? 0,
  towers: g.towers.length,
});

const sameHud = (a: Hud, b: Hud) =>
  a.gold === b.gold &&
  a.lives === b.lives &&
  a.wave === b.wave &&
  a.phase === b.phase &&
  a.endless === b.endless &&
  a.canCall === b.canCall &&
  a.remaining === b.remaining &&
  a.meteorCd === b.meteorCd &&
  a.freezeCd === b.freezeCd &&
  a.income === b.income &&
  a.eventWave === b.eventWave &&
  a.towers === b.towers;

function Battle({
  map,
  difficulty,
  bestEndless,
  onExit,
  onRestart,
  onWin,
  onEndlessWave,
}: {
  map: MapDef;
  difficulty: Difficulty;
  bestEndless: number;
  onExit: () => void;
  onRestart: () => void;
  onWin: (stars: number) => void;
  onEndlessWave: (wave: number) => void;
}) {
  const game = getGame("towerdefense");
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) gameRef.current = createGame(map, difficulty);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hudMarkRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);
  const hoverRef = useRef<Cell | null>(null);
  /** Exact pointer position on the board in cell units (for aiming the meteor). */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const [cs, setCs] = useState(40);
  const [hud, setHud] = useState<Hud>(() => snapshot(gameRef.current!));
  const [tool, setTool] = useState<TowerType | null>("blaster");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [aiming, setAiming] = useState(false);
  /** Auto-start: after the first wave, each next one sets off by itself. */
  const [auto, setAuto] = useState(false);
  /** Whole seconds until auto-start sends the next wave (0 = not counting). */
  const [autoIn, setAutoIn] = useState(0);
  /** True while the top bar is floating over the board instead of sitting above it. */
  const [hudStuck, setHudStuck] = useState(false);
  const [, bump] = useState(0);

  // Live values the animation loop reads without re-subscribing
  const live = useRef({ tool, selectedId, selectedCell, speed, paused, muted, cs, aiming, auto });
  live.current = { tool, selectedId, selectedCell, speed, paused: paused || leaving, muted, cs, aiming, auto };

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
      setAuto(localStorage.getItem(AUTO_KEY) === "1");
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

  // The top bar follows the player down the page (to the shop and back), so
  // Start, gold and lives never scroll away. Note when it lifts off so it can
  // cast a deeper shadow over the board.
  useEffect(() => {
    const mark = hudMarkRef.current;
    if (!mark || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setHudStuck(!entry.isIntersecting), {
      rootMargin: `-${HUD_TOP + 1}px 0px 0px 0px`,
    });
    io.observe(mark);
    return () => io.disconnect();
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
    // Keeps play smooth on slower tablets: if frames keep arriving late, the
    // board is drawn with fewer pixels (it stays the same size on screen).
    let quality = 1;
    let frameMs = 16;
    let lateFor = 0;
    // Auto-start countdown, in real seconds, and the number last shown for it.
    let autoLeft = AUTO_START_DELAY;
    let autoShown = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const g = gameRef.current!;
      const L = live.current;
      const elapsed = now - last;
      const dt = Math.min(0.1, elapsed / 1000);
      last = now;
      if (elapsed < 250 && !document.hidden) {
        frameMs = frameMs * 0.9 + elapsed * 0.1;
        lateFor = frameMs > 26 ? lateFor + elapsed : 0;
        if (lateFor > 2500 && quality > 0.5) {
          quality -= 0.25;
          lateFor = 0;
          frameMs = 16;
        }
      }
      // Auto-start: once the board is clear the next wave sets off after a
      // short count. The first wave always waits for the player, and pausing
      // holds the count.
      const autoArmed = () => L.auto && g.phase === "build" && g.wave > 0 && canCallWave(g);
      if (!autoArmed()) {
        autoLeft = AUTO_START_DELAY;
      } else if (!L.paused) {
        autoLeft -= dt;
        if (autoLeft <= 0) {
          startWave(g);
          autoLeft = AUTO_START_DELAY;
        }
      }
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
        const dpr = Math.max(1, (window.devicePixelRatio || 1) * quality);
        if (canvas.dataset.quality !== String(quality)) canvas.dataset.quality = String(quality);
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
        const building = L.tool !== null && !L.aiming && g.phase !== "gameover" && g.phase !== "win";
        const showGhost =
          building && hover && !towerAt(g, hover.r, hover.c) && g.terrain[hover.r][hover.c] !== "rubble";
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
          selectedCell: L.selectedCell,
          aim: L.aiming ? pointerRef.current : null,
        });
      }

      const snap = snapshot(g);
      setHud((prev) => (sameHud(prev, snap) ? prev : snap));
      const count = autoArmed() ? Math.ceil(autoLeft) : 0;
      if (count !== autoShown) {
        autoShown = count;
        setAutoIn(count);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Record results as they happen
  const reported = useRef({ win: false });
  useEffect(() => {
    const g = gameRef.current!;
    if (hud.phase === "win" && !reported.current.win) {
      reported.current.win = true;
      onWin(starsFor(g.lives, g.maxLives));
    }
    if (hud.endless && hud.wave > bestEndless) onEndlessWave(hud.wave);
  }, [hud.phase, hud.endless, hud.wave, bestEndless, onWin, onEndlessWave]);

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
    setAiming(false);
    setTool((cur) => (toggle && cur === t ? null : t));
    setSelectedId(null);
    setSelectedCell(null);
  }, []);

  /** Pointer position in cell units, where (0, 0) is the centre of the top-left cell. */
  const pointFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * COLS - 0.5,
      y: ((e.clientY - rect.top) / rect.height) * ROWS - 0.5,
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    unlockAudio();
    const cell = cellFromEvent(e);
    if (!cell) return;
    const g = gameRef.current!;
    if (aiming) {
      const at = pointFromEvent(e);
      if (castMeteor(g, at.x, at.y)) setAiming(false);
      return;
    }
    const existing = towerAt(g, cell.r, cell.c);
    if (existing) {
      setSelectedId(existing.id);
      setSelectedCell(null);
      setTool(null);
      return;
    }
    if (g.terrain[cell.r][cell.c] === "rubble") {
      setSelectedCell(cell);
      setSelectedId(null);
      return;
    }
    setSelectedCell(null);
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
    startWave(gameRef.current!);
    setPaused(false);
  }, []);

  const upgradeSelected = useCallback(() => {
    if (selectedId === null) return;
    upgradeTower(gameRef.current!, selectedId);
    bump((n) => n + 1);
  }, [selectedId]);

  const sellSelected = useCallback(() => {
    if (selectedId === null) return;
    sellTower(gameRef.current!, selectedId);
    setSelectedId(null);
  }, [selectedId]);

  const retarget = useCallback(
    (targeting?: Targeting) => {
      if (selectedId === null) return;
      const g = gameRef.current!;
      const t = g.towers.find((tw) => tw.id === selectedId);
      if (!t) return;
      // No argument = step to the next option (the T shortcut).
      const next =
        targeting ?? TARGETING_ORDER[(TARGETING_ORDER.indexOf(t.targeting) + 1) % TARGETING_ORDER.length];
      setTargeting(g, selectedId, next);
      bump((n) => n + 1);
    },
    [selectedId],
  );

  const specSelected = useCallback(
    (spec: 0 | 1) => {
      if (selectedId === null) return;
      chooseSpec(gameRef.current!, selectedId, spec);
      bump((n) => n + 1);
    },
    [selectedId],
  );

  /** Meteor: the first press starts aiming, the board click fires it. */
  const toggleMeteor = useCallback(() => {
    unlockAudio();
    if (gameRef.current!.cooldowns.meteor > 0) return;
    setAiming((a) => !a);
  }, []);

  const coldSnap = useCallback(() => {
    unlockAudio();
    castFreeze(gameRef.current!);
  }, []);

  const clearSelectedRubble = useCallback(() => {
    if (!selectedCell) return;
    const res = clearRubble(gameRef.current!, selectedCell.r, selectedCell.c);
    if (res.ok) setSelectedCell(null);
    else setToast(res.reason);
  }, [selectedCell]);

  const goEndless = () => {
    continueEndless(gameRef.current!);
    setPaused(false);
  };

  const requestExit = () => {
    const g = gameRef.current!;
    const inProgress = g.wave > 0 && g.phase !== "gameover" && g.phase !== "win";
    if (inProgress) setLeaving(true);
    else onExit();
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

  const toggleAuto = useCallback(() => {
    setAuto((a) => {
      try {
        localStorage.setItem(AUTO_KEY, a ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !a;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TOWER_ORDER.length) {
        chooseTool(TOWER_ORDER[idx]);
      } else if (e.key === "Escape") {
        setAiming(false);
        setTool(null);
        setSelectedId(null);
        setSelectedCell(null);
      } else if (e.key.toLowerCase() === "q") {
        toggleMeteor();
      } else if (e.key.toLowerCase() === "e") {
        coldSnap();
      } else if (e.key === " ") {
        e.preventDefault();
        callWave();
      } else if (e.key.toLowerCase() === "u") {
        upgradeSelected();
      } else if (e.key.toLowerCase() === "t") {
        retarget();
      } else if (e.key.toLowerCase() === "p") {
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "a") {
        toggleAuto();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        sellSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseTool, callWave, upgradeSelected, sellSelected, retarget, toggleMeteor, coldSnap, toggleAuto]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const g = gameRef.current;
  const selected = selectedId !== null ? g.towers.find((t) => t.id === selectedId) ?? null : null;
  const rubble = selectedCell && g.terrain[selectedCell.r][selectedCell.c] === "rubble" ? selectedCell : null;
  const nextWave = hud.endless || hud.wave < TOTAL_WAVES ? waveDef(hud.wave) : null;
  const over = hud.phase === "gameover" || hud.phase === "win";
  const stars = hud.phase === "win" ? starsFor(hud.lives, g.maxLives) : 0;
  // Nothing is happening until the player sends the wave, so the button asks for a tap.
  const waiting = hud.phase === "build" && hud.canCall;

  return (
    <Box sx={{ pb: 6, pt: 1, maxWidth: COLS * 52 + 16, mx: "auto", px: { xs: 0.5, sm: 1 } }}>
      <Box ref={hudMarkRef} aria-hidden sx={{ height: "1px", mb: "-1px" }} />
      {/* HUD */}
      <Paper
        elevation={hudStuck ? 8 : 2}
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: { xs: 1, md: 1.5 },
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 3,
          position: "sticky",
          top: HUD_TOP,
          zIndex: 30, // over the board and its overlays, under the site nav
          // A phone on its side is too short to give up a strip of the board.
          "@media (max-height: 520px)": { position: "static" },
        }}>
        <Tooltip title={`${map.name} on ${DIFFICULTIES[difficulty].name}. Back to the maps`}>
          <Button
            size="small"
            color="inherit"
            onClick={requestExit}
            startIcon={<FontAwesomeIcon icon={faMap} />}
            sx={{ fontWeight: 800, textTransform: "none", minWidth: 0, px: 1.25 }}>
            <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
              {map.name}
            </Box>
            <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
              Maps
            </Box>
          </Button>
        </Tooltip>
        <Stat icon={faCoins} color="#f59e0b">
          {hud.gold}
        </Stat>
        <Stat icon={faHeart} color="#ef4444">
          {hud.lives}
        </Stat>
        <Stat icon={hud.endless ? faInfinity : faFlag} color="#6366f1">
          {hud.endless ? Math.max(1, hud.wave) : `${Math.max(1, hud.wave)}/${TOTAL_WAVES}`}
        </Stat>
        {hud.eventWave > 0 && (
          <Tooltip title={`${nextEvent(g)?.label ?? "The map changes"} when wave ${hud.eventWave} starts`}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 99,
                fontWeight: 800,
                fontSize: "0.85rem",
                color: "#b45309",
                bgcolor: "rgba(245,158,11,0.16)",
                // The wave before it happens, make sure it gets noticed.
                animation: hud.eventWave - hud.wave <= 1 ? "tdPulse 1s ease-in-out infinite" : undefined,
              }}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
              Wave {hud.eventWave}
            </Box>
          </Tooltip>
        )}
        {nextWave && hud.canCall && (
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.75, ml: 0.5 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, mr: 0.25 }}>
              NEXT
            </Typography>
            {nextWave.groups.map((gr, i) => (
              <Tooltip key={i} title={`${ENEMIES[gr.type].name}: ${ENEMIES[gr.type].trait}`} arrow>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    borderRadius: 99,
                    pr: 0.75,
                    // First time this enemy shows up: ring it so the tooltip gets read.
                    boxShadow: g.seen.includes(gr.type) ? undefined : "0 0 0 2px #f59e0b",
                  }}>
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
        {/* The controls travel as one group: when the bar is too narrow they
            drop to a second row together, with Start at the right-hand edge. */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.75, md: 1.5 },
            ml: "auto",
            flex: { xs: "1 1 100%", sm: "0 0 auto" },
          }}>
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
            <span>
              <IconButton onClick={() => setPaused((p) => !p)} disabled={over}>
                <FontAwesomeIcon icon={paused ? faPlay : faPause} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={muted ? "Sound on" : "Mute"}>
            <IconButton onClick={toggleMute}>
              <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              auto
                ? "Auto-start is on: after the first wave, each next one sets off by itself (A)"
                : "Auto-start: let each next wave set off by itself (A)"
            }>
            <ToggleButton
              value="auto"
              size="small"
              selected={auto}
              onChange={toggleAuto}
              aria-label="Auto-start waves"
              sx={{
                fontWeight: 800,
                px: 1.25,
                gap: 0.75,
                borderRadius: 99,
                "&.Mui-selected, &.Mui-selected:hover": {
                  color: "success.main",
                  bgcolor: "rgba(34,197,94,0.16)",
                  borderColor: "rgba(34,197,94,0.55)",
                },
              }}>
              <FontAwesomeIcon icon={faRepeat} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Auto
              </Box>
            </ToggleButton>
          </Tooltip>
          <Button
            variant="contained"
            className={`td-start${waiting ? " is-waiting" : ""}`}
            disabled={!hud.canCall}
            onClick={callWave}
            startIcon={
              autoIn > 0 ? (
                // Auto-start is counting down. Keyed so the number pops on every tick.
                <span key={autoIn} className="td-start-count" aria-label={`starts in ${autoIn} seconds`}>
                  {autoIn}
                </span>
              ) : (
                <FontAwesomeIcon icon={hud.phase === "wave" ? faForward : faPlay} />
              )
            }
            sx={{
              fontWeight: 900,
              fontSize: "0.95rem",
              borderRadius: 99,
              px: { xs: 2, sm: 2.5 },
              minHeight: 44,
              // On a phone the button takes whatever is left of its row.
              flexGrow: { xs: 1, sm: 0 },
              whiteSpace: "nowrap",
              background: hud.canCall ? "linear-gradient(135deg, #22c55e 0%, #15803d 100%)" : undefined,
              boxShadow: hud.canCall ? "0 4px 14px rgba(34,197,94,0.45)" : undefined,
            }}>
            {hud.phase === "wave" ? (
              "Send next"
            ) : hud.wave === 0 ? (
              "Start"
            ) : (
              <>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Start&nbsp;
                </Box>
                wave {hud.wave + 1}
              </>
            )}
          </Button>
        </Box>
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
              cursor: tool || aiming ? "crosshair" : "pointer",
            }}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return;
              hoverRef.current = cellFromEvent(e);
              pointerRef.current = pointFromEvent(e);
            }}
            onPointerLeave={() => {
              hoverRef.current = null;
              pointerRef.current = null;
            }}
            onClick={handleClick}
            onContextMenu={(e) => {
              e.preventDefault();
              setAiming(false);
              setTool(null);
              setSelectedId(null);
              setSelectedCell(null);
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
                p: 1,
              }}>
              {hud.phase === "win" && <Confetti />}
              <Paper
                className="td-result"
                sx={{ p: { xs: 2, md: 3.5 }, borderRadius: 4, textAlign: "center", maxWidth: 380 }}>
                {hud.phase === "win" ? (
                  <span className="td-stars td-stars--big" aria-label={`${stars} of 3 stars`}>
                    {[0, 1, 2].map((i) => (
                      <FontAwesomeIcon key={i} icon={faStar} className={i < stars ? "is-lit" : undefined} />
                    ))}
                  </span>
                ) : (
                  <Box sx={{ fontSize: { xs: "2rem", md: "3rem" }, color: hud.endless ? "#6366f1" : "#64748b" }}>
                    <FontAwesomeIcon icon={hud.endless ? faTrophy : faSkull} />
                  </Box>
                )}
                <Typography variant="h4" sx={{ fontFamily: "var(--dg-display)", fontWeight: 700, mb: 0.5 }}>
                  {hud.phase === "win" ? "You Won!" : hud.endless ? "Overrun at last" : "Game Over"}
                </Typography>
                <Typography sx={{ mb: { xs: 1.5, md: 2.5 }, color: "text.secondary" }}>
                  {hud.phase === "win"
                    ? `${map.name} held with ${hud.lives} of ${g.maxLives} lives left.`
                    : hud.endless
                      ? `You lasted until wave ${hud.wave}.${hud.wave >= bestEndless ? " That's your best yet!" : ""}`
                      : `You made it to wave ${hud.wave} of ${TOTAL_WAVES}.`}
                </Typography>
                <div className="dg-row">
                  {hud.phase === "win" && (
                    <KitButton icon={faInfinity} onClick={goEndless}>
                      Keep going
                    </KitButton>
                  )}
                  <KitButton
                    variant={hud.phase === "win" ? "neutral" : "primary"}
                    icon={faRotateRight}
                    onClick={onRestart}>
                    {hud.phase === "win" ? "Replay" : "Try again"}
                  </KitButton>
                  <KitButton variant="neutral" icon={faMap} onClick={onExit}>
                    Maps
                  </KitButton>
                </div>
              </Paper>
            </Box>
          )}
        </Box>
      </Box>

      {/* Abilities */}
      <div className="td-abilities">
        <button
          type="button"
          className={`td-ability td-ability--meteor${aiming ? " is-aiming" : ""}`}
          disabled={hud.meteorCd > 0 || over}
          onClick={toggleMeteor}
          title={ABILITIES.meteor.hint}
          style={{ "--cd": hud.meteorCd / ABILITIES.meteor.cooldown } as React.CSSProperties}>
          <FontAwesomeIcon icon={faMeteor} />
          <span>
            <b>{ABILITIES.meteor.name}</b>
            <small>{aiming ? "Pick a spot" : hud.meteorCd > 0 ? `${hud.meteorCd}s` : "Ready · Q"}</small>
          </span>
        </button>
        <button
          type="button"
          className="td-ability td-ability--freeze"
          disabled={hud.freezeCd > 0 || over}
          onClick={coldSnap}
          title={ABILITIES.freeze.hint}
          style={{ "--cd": hud.freezeCd / ABILITIES.freeze.cooldown } as React.CSSProperties}>
          <FontAwesomeIcon icon={faSnowflake} />
          <span>
            <b>{ABILITIES.freeze.name}</b>
            <small>{hud.freezeCd > 0 ? `${hud.freezeCd}s` : "Ready · E"}</small>
          </span>
        </button>
        {hud.income > 0 && (
          <span className="td-income" title="Your Gold Mines pay this each time a wave starts">
            <FontAwesomeIcon icon={faCoins} /> +{hud.income} per wave
          </span>
        )}
      </div>

      {/* Shop + selected tower */}
      <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap", alignItems: "stretch" }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flex: 1, alignContent: "flex-start" }}>
          {TOWER_ORDER.map((type, i) => {
            const def = TOWERS[type];
            const cost = def.levels[0].cost;
            const active = tool === type && !aiming;
            const built = def.limit ? g.towers.filter((t) => t.type === type).length : 0;
            const affordable = hud.gold >= cost && (!def.limit || built < def.limit);
            return (
              <Paper
                key={type}
                elevation={active ? 6 : 1}
                onClick={() => chooseTool(type, true)}
                sx={{
                  position: "relative",
                  width: { xs: "calc(25% - 6px)", sm: 124 },
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
                <Typography sx={{ fontWeight: 900, fontSize: { xs: "0.8rem", sm: "0.95rem" }, lineHeight: 1.2 }}>
                  {def.name}
                  {def.limit ? ` ${built}/${def.limit}` : ""}
                </Typography>
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
            onSpec={specSelected}
            onSell={sellSelected}
            onTargeting={retarget}
            onClose={() => setSelectedId(null)}
          />
        )}
        {rubble && !selected && (
          <RubblePanel
            cost={map.rubbleCost}
            gold={hud.gold}
            onClear={clearSelectedRubble}
            onClose={() => setSelectedCell(null)}
          />
        )}
      </Box>

      <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
        Build towers to make a maze: enemies always take the shortest way to your castle, and you can keep
        building during a wave. Hilltops add range, rocks block the view, and flying enemies ignore your maze.
        Tap a tower to upgrade it, sell it or change what it shoots at. At level 3 every tower can take one of
        two final forms. Beacons reveal Shades, and Gold Mines pay you every wave. Careful: selling a tower
        while enemies are on the board makes them all run faster.
      </Typography>
      <Typography variant="caption" sx={{ display: { xs: "none", md: "block" }, color: "text.disabled", mt: 0.5 }}>
        Shortcuts: 1–7 pick a tower · Space start / send wave · A auto-start · Q meteor · E cold snap · U
        upgrade · T change target · Delete sell · P pause · Esc cancel
      </Typography>

      <KitDialog game={game} open={leaving} onClose={() => setLeaving(false)} icon={faMap} title="Leave this battle?">
        <p className="dg-subtitle" style={{ margin: "0 auto 16px" }}>
          Your towers and progress on this map will be lost.
        </p>
        <div className="dg-row">
          <KitButton variant="neutral" onClick={() => setLeaving(false)}>
            Stay
          </KitButton>
          <KitButton variant="danger" onClick={onExit}>
            Leave
          </KitButton>
        </div>
      </KitDialog>
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TowerDefense() {
  const game = getGame("towerdefense");
  const [save, setSave] = useState<Save>(EMPTY_SAVE);
  const saveRef = useRef(save);
  const [battle, setBattle] = useState<{ mapId: string; difficulty: Difficulty; run: number } | null>(null);

  useEffect(() => {
    const loaded = loadSave();
    saveRef.current = loaded;
    setSave(loaded);
  }, []);

  const update = useCallback((change: (s: Save) => Save) => {
    const next = change(saveRef.current);
    saveRef.current = next;
    setSave(next);
    setStoredData(SAVE_KEY, next);
  }, []);

  const mapId = battle?.mapId;
  const difficulty = battle?.difficulty;

  const recordWin = useCallback(
    (stars: number) => {
      if (!mapId || !difficulty) return;
      update((s) => {
        const best = s.stars[mapId]?.[difficulty] ?? 0;
        if (stars <= best) return s;
        return { ...s, stars: { ...s.stars, [mapId]: { ...s.stars[mapId], [difficulty]: stars } } };
      });
    },
    [mapId, difficulty, update],
  );

  const recordEndless = useCallback(
    (wave: number) => {
      if (!mapId) return;
      update((s) => ((s.endless[mapId] ?? 0) >= wave ? s : { ...s, endless: { ...s.endless, [mapId]: wave } }));
    },
    [mapId, update],
  );

  return (
    <GameShell game={game}>
      {battle ? (
        <Battle
          key={`${battle.mapId}:${battle.difficulty}:${battle.run}`}
          map={getMap(battle.mapId)}
          difficulty={battle.difficulty}
          bestEndless={save.endless[battle.mapId] ?? 0}
          onExit={() => {
            setBattle(null);
            window.scrollTo({ top: 0 });
          }}
          onRestart={() => setBattle((b) => (b ? { ...b, run: b.run + 1 } : b))}
          onWin={recordWin}
          onEndlessWave={recordEndless}
        />
      ) : (
        <MapSelect
          save={save}
          onDifficulty={(d) => update((s) => ({ ...s, difficulty: d }))}
          onPlay={(map) => {
            unlockAudio();
            setBattle({ mapId: map.id, difficulty: save.difficulty, run: 0 });
            // The card may have been tapped from further down the page.
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </GameShell>
  );
}
