import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowsRotate,
  faBasketShopping,
  faBolt,
  faBook,
  faClover,
  faCoins,
  faEgg,
  faHouse,
  faLock,
  faPaw,
  faPlay,
  faRotateLeft,
  faStar,
  faStore,
  faTrophy,
  faVolumeHigh,
  faVolumeXmark,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Banner,
  GameShell,
  getGame,
  KitButton,
  KitDialog,
  Panel,
  StartScreen,
  StatPill,
  WinScreen,
} from "~/components/game/GameKit";
import { setMuted, sfx, unlockAudio } from "~/games/eggs/audio";
import {
  BIOMES,
  FUSE_COUNT,
  PETS,
  RARITIES,
  SELL_SECONDS,
  SKINS,
  basketSize,
  fmtCoins,
  maxLevel,
  penSize,
  petById,
  petFor,
  petRate,
  skinById,
  upgradeCost,
  type Look,
  type PetDef,
  type Rarity,
  type UpgradeId,
} from "~/games/eggs/config";
import {
  anyFusable,
  bookCount,
  buy,
  canFuse,
  countOf,
  createGame,
  fuse,
  penIsFull,
  savedRate,
  sell,
  step,
  tapAt,
  toSave,
  totalRate,
  type Game,
  type GameEvent,
  type SavedGame,
} from "~/games/eggs/engine";
import {
  computeView,
  paintEggIcon,
  paintPetIcon,
  render,
  screenToWorld,
  type Joystick,
  type Mood,
  type View,
} from "~/games/eggs/render";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import eggsStyles from "~/styles/eggs.css?url";
import type { Route } from "./+types/eggs";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: eggsStyles }];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sneaky Eggs - Games by DaniB" },
    {
      name: "description",
      content:
        "Sneak eggs past the sleepy Grumbles, run them home, and hatch rare pets to fill your Pet Book!",
    },
  ];
}

const STORAGE_KEY = "sneaky-eggs";
/** Joystick reach in px: roomier on tablets, where thumbs travel further. */
const joyRadius = (w: number, h: number) => (Math.min(w, h) >= 700 ? 76 : 56);
const STEP = 1 / 60;
/** Pets keep earning (at half speed) for up to this long while you're away. */
const AWAY_CAP_SECONDS = 600;

type Phase = "START" | "PLAYING" | "WON";
type PanelId = "shop" | "pets" | "book";

interface Save {
  game: SavedGame | null;
  skin: string;
  muted: boolean;
  lastSeen: number;
}

const DEFAULT_SAVE: Save = { game: null, skin: SKINS[0].id, muted: false, lastSeen: 0 };

interface Hud {
  coins: number;
  rate: number;
  speed: number;
  pets: number;
  cap: number;
  book: number;
  canBuy: boolean;
  canFuse: boolean;
  penFull: boolean;
}

const EMPTY_HUD: Hud = {
  coins: 0,
  rate: 0,
  speed: 0,
  pets: 0,
  cap: penSize(0),
  book: 0,
  canBuy: false,
  canFuse: false,
  penFull: false,
};

interface Reveal {
  def: PetDef;
  shiny: boolean;
  fused: boolean;
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

const UPGRADE_IDS: UpgradeId[] = ["speed", "basket", "pen", "luck"];

/** Keep hyphenated names like "Mer-Kitty" on one line. */
const noBreak = (name: string) => name.replace(/-/g, "\u2011");

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function hudOf(g: Game): Hud {
  return {
    coins: Math.floor(g.coins),
    rate: totalRate(g),
    speed: g.up.speed,
    pets: g.pets.length,
    cap: penSize(g.up.pen),
    book: bookCount(g.book),
    canBuy: UPGRADE_IDS.some((id) => {
      const cost = upgradeCost(id, g.up[id]);
      return cost !== null && g.coins >= cost;
    }),
    canFuse: anyFusable(g),
    penFull: penIsFull(g),
  };
}

const sameHud = (a: Hud, b: Hud) =>
  (Object.keys(a) as (keyof Hud)[]).every((k) => a[k] === b[k]);

/* ---------- Little pictures ---------- */

function PetIcon({
  look,
  size,
  hidden,
  mood,
}: {
  look: Look;
  size: number;
  hidden?: boolean;
  mood?: Mood;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPetIcon(ref.current, look, size, mood);
  }, [look, size, mood]);
  return (
    <canvas
      ref={ref}
      className={cx("se-icon", hidden && "is-hidden")}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function EggIcon({ biome, rarity, size }: { biome: number; rarity: Rarity; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintEggIcon(ref.current, biome, rarity, size);
  }, [biome, rarity, size]);
  return <canvas ref={ref} className="se-icon" style={{ width: size, height: size }} aria-hidden />;
}

function RarityChip({ rarity }: { rarity: Rarity }) {
  const info = RARITIES[rarity];
  return (
    <span className="se-chip" style={{ "--chip": info.color, "--chip-dk": info.dark } as CSSProperties}>
      {info.name}
    </span>
  );
}

function Coin() {
  return <span className="se-coin" aria-hidden />;
}

/* ---------- Dialog contents ---------- */

interface UpgradeInfo {
  id: UpgradeId;
  icon: IconDefinition;
  color: string;
  name: string;
  now: (level: number) => string;
  hint: (level: number) => string;
}

const UPGRADES: UpgradeInfo[] = [
  {
    id: "speed",
    icon: faBolt,
    color: "#f59e0b",
    name: "Speedy Sneakers",
    now: (l) => `Speed ${l}`,
    hint: (l) => {
      const next = BIOMES.find((b) => b.speedReq > l);
      return next ? `Speed ${next.speedReq} opens ${next.name}` : "Zoom past every Grumble";
    },
  },
  {
    id: "basket",
    icon: faBasketShopping,
    color: "#fb7185",
    name: "Egg Basket",
    now: (l) => `Carry ${basketSize(l)} egg${basketSize(l) > 1 ? "s" : ""}`,
    hint: () => "Carry more eggs each trip",
  },
  {
    id: "pen",
    icon: faPaw,
    color: "#22c55e",
    name: "Bigger Pen",
    now: (l) => `Room for ${penSize(l)} pets`,
    hint: () => "More pets means more coins",
  },
  {
    id: "luck",
    icon: faClover,
    color: "#10b981",
    name: "Lucky Clover",
    now: (l) => `Luck ${l}`,
    hint: () => "Rare eggs show up more often",
  },
];

function ShopBody({ g, onBuy }: { g: Game; onBuy: (id: UpgradeId) => void }) {
  return (
    <div className="se-list">
      {UPGRADES.map((u) => {
        const level = g.up[u.id];
        const cost = upgradeCost(u.id, level);
        const afford = cost !== null && g.coins >= cost;
        return (
          <div className="se-row" key={u.id}>
            <span className="se-row-icon" style={{ "--tile": u.color } as CSSProperties}>
              <FontAwesomeIcon icon={u.icon} />
            </span>
            <div className="se-row-text">
              <strong>{u.name}</strong>
              <span>{u.now(level)}</span>
              <small>{cost === null ? "All the way up!" : u.hint(level)}</small>
            </div>
            {cost === null ? (
              <span className="se-max">MAX</span>
            ) : (
              <KitButton
                size="sm"
                disabled={!afford}
                onClick={() => onBuy(u.id)}
                aria-label={`Buy ${u.name} for ${fmtCoins(cost)} coins`}>
                <Coin />
                {fmtCoins(cost)}
              </KitButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PetsBody({
  g,
  onFuse,
  onSell,
}: {
  g: Game;
  onFuse: (id: string) => void;
  onSell: (id: string) => void;
}) {
  const kinds = PETS.filter((p) => countOf(g, p.id) > 0).sort(
    (a, b) => b.biome - a.biome || b.rarity - a.rarity,
  );
  if (!kinds.length) {
    return (
      <p className="dg-subtitle" style={{ margin: "0 auto" }}>
        No pets yet! Bring an egg home and it will hatch into one.
      </p>
    );
  }
  return (
    <>
      <p className="se-tip">
        <FontAwesomeIcon icon={faWandMagicSparkles} /> Fuse {FUSE_COUNT} of the same pet to make a
        rarer one!
      </p>
      <div className="se-list">
        {kinds.map((def) => {
          const n = countOf(g, def.id);
          const fusable = canFuse(g, def.id);
          const hasShiny = g.pets.some((p) => p.id === def.id && p.shiny);
          return (
            <div className="se-row" key={def.id}>
              <span className="se-row-pet">
                <PetIcon look={def.look} size={52} />
                <b>×{n}</b>
              </span>
              <div className="se-row-text">
                <strong>
                  {noBreak(def.name)}
                  {hasShiny && <FontAwesomeIcon icon={faStar} className="se-shiny" title="Shiny" />}
                </strong>
                <RarityChip rarity={def.rarity} />
                <small>
                  <Coin /> {fmtCoins(petRate(def))} a second
                </small>
              </div>
              <div className="se-row-actions">
                {def.rarity < 3 && (
                  <KitButton
                    size="sm"
                    disabled={!fusable}
                    onClick={() => onFuse(def.id)}
                    aria-label={`Fuse ${FUSE_COUNT} ${def.name}`}>
                    Fuse {Math.min(n, FUSE_COUNT)}/{FUSE_COUNT}
                  </KitButton>
                )}
                <KitButton
                  size="sm"
                  variant="neutral"
                  onClick={() => onSell(def.id)}
                  aria-label={`Sell one ${def.name} for ${fmtCoins(petRate(def) * SELL_SECONDS)} coins`}>
                  Sell <Coin />
                  {fmtCoins(petRate(def) * SELL_SECONDS)}
                </KitButton>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BookBody({ g }: { g: Game }) {
  return (
    <div className="se-book">
      {BIOMES.map((b, i) => {
        const open = g.up.speed >= b.speedReq;
        return (
          <section key={b.id}>
            <h3 style={{ "--biome": b.fence } as CSSProperties}>
              {b.name}
              {!open && (
                <span>
                  <FontAwesomeIcon icon={faLock} /> Speed {b.speedReq}
                </span>
              )}
            </h3>
            <div className="se-book-grid">
              {([0, 1, 2, 3] as Rarity[]).map((r) => {
                const def = petFor(i, r);
                const found = g.book[def.id] ?? 0;
                return (
                  <div
                    key={def.id}
                    className={cx("se-book-cell", found > 0 && "is-found")}
                    style={{ "--chip": RARITIES[r].color } as CSSProperties}
                    aria-label={found ? `${def.name}, ${RARITIES[r].name}` : `Not found yet, ${RARITIES[r].name}`}>
                    <PetIcon look={def.look} size={58} hidden={!found} />
                    {found > 1 && <FontAwesomeIcon icon={faStar} className="se-shiny" />}
                    <span>{found ? noBreak(def.name) : "???"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- The game ---------- */

export default function SneakyEggs() {
  const game = getGame("eggs");

  const [phase, setPhase] = useState<Phase>("START");
  const [save, setSave] = useState<Save>(DEFAULT_SAVE);
  const [loaded, setLoaded] = useState(false);
  const [away, setAway] = useState(0);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [place, setPlace] = useState<{ id: number; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [, bump] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const saveRef = useRef<Save>(DEFAULT_SAVE);
  const viewRef = useRef<View | null>(null);
  const hudRef = useRef<Hud>(EMPTY_HUD);
  const joyRef = useRef<Joystick & { id: number }>({
    active: false,
    ox: 0,
    oy: 0,
    dx: 0,
    dy: 0,
    r: 56,
    id: -1,
  });
  const keysRef = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const pendingWinRef = useRef(false);
  const eventsRef = useRef<(g: Game) => void>(() => {});

  const reveal = reveals[0] ?? null;
  pausedRef.current = panel !== null || reveal !== null;

  /* ── Saving ── */

  const persist = useCallback((patch?: Partial<Save>, quiet = false) => {
    const g = gameRef.current;
    const next: Save = {
      ...saveRef.current,
      ...patch,
      ...(g ? { game: toSave(g) } : {}),
      lastSeen: Date.now(),
    };
    saveRef.current = next;
    setStoredData(STORAGE_KEY, next);
    if (!quiet) setSave(next);
  }, []);

  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY) as Partial<Save> | null;
    if (stored && typeof stored === "object") {
      const merged: Save = { ...DEFAULT_SAVE, ...stored };
      saveRef.current = merged;
      setSave(merged);
      setMuted(merged.muted);
      if (merged.game && merged.lastSeen) {
        const secs = Math.min(AWAY_CAP_SECONDS, (Date.now() - merged.lastSeen) / 1000);
        if (secs > 60) setAway(Math.floor(secs * savedRate(merged.game) * 0.5));
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (gameRef.current) persist(undefined, true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [persist]);

  /* ── Messages ── */

  const say = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ id: Date.now() + Math.random(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!place) return;
    const t = window.setTimeout(() => setPlace(null), 1900);
    return () => clearTimeout(t);
  }, [place]);

  const refreshHud = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const next = hudOf(g);
    if (!sameHud(next, hudRef.current)) {
      hudRef.current = next;
      setHud(next);
    }
  }, []);

  // Re-made every render so the game loop always calls the freshest version.
  eventsRef.current = (g: Game) => {
    if (!g.events.length) return;
    const events: GameEvent[] = g.events.splice(0);
    for (const e of events) {
      switch (e.type) {
        case "pickup":
          sfx.pickup(e.rarity);
          if (g.stats.eggs < 2) say("Run home before the Grumble catches you!");
          break;
        case "wake":
          sfx.wake();
          break;
        case "caught":
          sfx.caught();
          say("The Grumble took the egg back. Try again!", "bad");
          break;
        case "deliver":
          sfx.deliver();
          if (g.stats.eggs <= 2) say("Tap the egg to help it hatch!", "good");
          break;
        case "tap":
          sfx.tap();
          break;
        case "hatch": {
          const def = petById(e.petId);
          if (!def) break;
          if (e.fused) sfx.fuse();
          else sfx.hatch(def.rarity);
          if (e.isNew) {
            setReveals((list) => [...list, { def, shiny: e.shiny, fused: e.fused }]);
          } else {
            say(`${e.shiny ? "Shiny " : ""}${def.name} joined your pen!`, "good");
          }
          break;
        }
        case "biome":
          setPlace({ id: Date.now(), text: e.biome < 0 ? "Home" : BIOMES[e.biome].name });
          break;
        case "blocked":
          sfx.nope();
          if (e.reason === "gate") {
            say(`You need Speed ${BIOMES[e.biome].speedReq} sneakers for ${BIOMES[e.biome].name}!`, "bad");
          } else if (e.reason === "hands") {
            say("Your hands are full! Take the egg home first.");
          } else if (e.reason === "pads") {
            say("Your egg nests are full! Hatch those eggs first.");
          } else {
            say("Your pen is full! Open Pets to fuse or sell.", "bad");
          }
          break;
        case "complete":
          pendingWinRef.current = true;
          break;
      }
    }
    refreshHud();
  };

  /* ── Start / stop ── */

  const play = () => {
    unlockAudio();
    const g = createGame(saveRef.current.game);
    if (away > 0) {
      g.coins += away;
      setAway(0);
    }
    gameRef.current = g;
    joyRef.current.active = false;
    keysRef.current.clear();
    pendingWinRef.current = false;
    hudRef.current = hudOf(g);
    setHud(hudRef.current);
    setReveals([]);
    setPanel(null);
    persist();
    setPhase("PLAYING");
    if (!g.pets.length && g.pads.every((p) => !p.egg)) {
      say("Walk up the path and grab an egg!");
    }
  };

  const quit = () => {
    persist();
    gameRef.current = null;
    setPanel(null);
    setPhase("START");
  };

  const startOver = () => {
    clearStoredData(STORAGE_KEY);
    const fresh: Save = { ...DEFAULT_SAVE, skin: saveRef.current.skin, muted: saveRef.current.muted };
    saveRef.current = fresh;
    gameRef.current = null;
    setSave(fresh);
    setAway(0);
    setConfirmReset(false);
  };

  const toggleSound = () => {
    unlockAudio();
    const muted = !saveRef.current.muted;
    setMuted(muted);
    persist({ muted });
  };

  const closeReveal = () => {
    const rest = reveals.slice(1);
    setReveals(rest);
    if (!rest.length && pendingWinRef.current) {
      pendingWinRef.current = false;
      sfx.win();
      persist();
      setPanel(null);
      setPhase("WON");
    }
  };

  /* ── Menu actions ── */

  const onBuy = (id: UpgradeId) => {
    const g = gameRef.current;
    if (!g) return;
    const before = g.up.speed;
    if (!buy(g, id)) {
      sfx.nope();
      return;
    }
    const opened = id === "speed" ? BIOMES.find((b) => b.speedReq === g.up.speed && b.speedReq > before) : undefined;
    if (opened) {
      sfx.gate();
      say(`${opened.name} is open! Head up the path.`, "good");
    } else {
      sfx.buy();
    }
    refreshHud();
    persist(undefined, true);
    bump((n) => n + 1);
  };

  const onFuse = (id: string) => {
    const g = gameRef.current;
    if (!g || !fuse(g, id)) return;
    eventsRef.current(g);
    persist(undefined, true);
    bump((n) => n + 1);
  };

  const onSell = (id: string) => {
    const g = gameRef.current;
    if (!g) return;
    const coins = sell(g, id);
    if (!coins) return;
    sfx.sell();
    refreshHud();
    persist(undefined, true);
    bump((n) => n + 1);
  };

  /* ── Input ── */

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    const g = gameRef.current;
    const stage = stageRef.current;
    if (!g || !stage || pausedRef.current) return;
    unlockAudio();
    const rect = stage.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const v = viewRef.current;
    if (v) {
      const w = screenToWorld(v, sx, sy);
      if (tapAt(g, w.x, w.y)) return;
    }
    // The newest finger always takes the stick. If a lift was ever missed (a
    // system gesture on a tablet, say), the next touch puts things right.
    joyRef.current = {
      active: true,
      ox: sx,
      oy: sy,
      dx: 0,
      dy: 0,
      r: joyRadius(rect.width, rect.height),
      id: e.pointerId,
    };
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      // Older browsers: the joystick still works while the finger stays on the stage.
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const joy = joyRef.current;
    const stage = stageRef.current;
    if (!joy.active || joy.id !== e.pointerId || !stage) return;
    const rect = stage.getBoundingClientRect();
    let dx = e.clientX - rect.left - joy.ox;
    let dy = e.clientY - rect.top - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > joy.r) {
      dx = (dx / d) * joy.r;
      dy = (dy / d) * joy.r;
    }
    joy.dx = dx;
    joy.dy = dy;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyRef.current.id === e.pointerId) joyRef.current.active = false;
  };

  useEffect(() => {
    if (phase !== "PLAYING") return;
    const keys = keysRef.current;
    const MOVE = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!MOVE.has(k) || pausedRef.current) return;
      keys.add(k);
      e.preventDefault();
      unlockAudio();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => {
      keys.clear();
      joyRef.current.active = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      keys.clear();
    };
  }, [phase]);

  // Touch screens (iPad Safari above all): stop the page from scrolling,
  // zooming, selecting text or swiping "back" while a finger is steering.
  useEffect(() => {
    if (phase !== "PLAYING") return;
    const stage = stageRef.current;
    if (!stage) return;
    const hold = (e: TouchEvent) => {
      const target = e.target as Element | null;
      // Buttons still need their taps; everything else belongs to the game.
      if (target?.closest?.("[data-ui]")) return;
      if (e.cancelable) e.preventDefault();
    };
    const noPinch = (e: Event) => e.preventDefault();
    stage.addEventListener("touchstart", hold, { passive: false });
    stage.addEventListener("touchmove", hold, { passive: false });
    // Safari-only pinch events; other browsers never fire them.
    document.addEventListener("gesturestart", noPinch);
    document.addEventListener("gesturechange", noPinch);
    return () => {
      stage.removeEventListener("touchstart", hold);
      stage.removeEventListener("touchmove", hold);
      document.removeEventListener("gesturestart", noPinch);
      document.removeEventListener("gesturechange", noPinch);
    };
  }, [phase]);

  /* ── Game loop ── */

  useEffect(() => {
    if (phase !== "PLAYING") return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let saveT = 0;
    // Drop the canvas resolution a notch if a device can't keep up (older
    // tablets with big, dense screens).
    let quality = 1;
    let frameAvg = 16;
    let slowFrames = 0;

    const readInput = () => {
      const keys = keysRef.current;
      let x = 0;
      let y = 0;
      if (keys.has("arrowleft") || keys.has("a")) x -= 1;
      if (keys.has("arrowright") || keys.has("d")) x += 1;
      if (keys.has("arrowup") || keys.has("w")) y -= 1;
      if (keys.has("arrowdown") || keys.has("s")) y += 1;
      if (x || y) return { x, y };
      const joy = joyRef.current;
      if (!joy.active) return { x: 0, y: 0 };
      return { x: joy.dx / joy.r, y: joy.dy / joy.r };
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const g = gameRef.current;
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!g || !canvas || !stage) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      let dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
      if (frameAvg > 24 && quality > 0.5) {
        slowFrames++;
        if (slowFrames > 90) {
          quality = Math.max(0.5, quality - 0.25);
          slowFrames = 0;
          frameAvg = 16;
        }
      } else {
        slowFrames = 0;
      }
      if (!pausedRef.current) {
        const input = readInput();
        while (dt > 0) {
          const slice = Math.min(STEP, dt);
          step(g, slice, input);
          dt -= slice;
        }
        eventsRef.current(g);

        hudT -= 1;
        if (hudT <= 0) {
          hudT = 8;
          refreshHud();
        }
        saveT += 1;
        if (saveT > 300) {
          saveT = 0;
          persist(undefined, true);
        }
      }

      const view = computeView(g, w, h);
      viewRef.current = view;
      render(
        ctx,
        g,
        view,
        dpr,
        now / 1000,
        joyRef.current,
        skinById(saveRef.current.skin).look,
        bookCount(g.book) < 3,
      );
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, persist, refreshHud]);

  /* ── Screens ── */

  const g = gameRef.current;
  const skin = skinById(save.skin);

  if (phase === "WON" && g) {
    return (
      <GameShell game={game}>
        <WinScreen
          icon={faTrophy}
          title="Pet Master!"
          subtitle={
            <>
              You found all <strong>{PETS.length} pets</strong> and filled the whole Pet Book!
            </>
          }>
          <div className="se-parade">
            {PETS.filter((p) => p.rarity === 3).map((p) => (
              <PetIcon key={p.id} look={p.look} size={62} mood="happy" />
            ))}
          </div>
          <div className="dg-row">
            <StatPill icon={faEgg} label="Eggs carried home">
              {g.stats.eggs} eggs
            </StatPill>
            <StatPill icon={faWandMagicSparkles} color="#a855f7" label="Fusions">
              {g.stats.fused} fusions
            </StatPill>
          </div>
          <div className="dg-row" style={{ marginTop: 8 }}>
            <KitButton size="lg" icon={faPlay} onClick={() => setPhase("PLAYING")}>
              Keep Playing
            </KitButton>
          </div>
        </WinScreen>
      </GameShell>
    );
  }

  if (phase === "START" || !g) {
    const found = save.game ? bookCount(save.game.book) : 0;
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle="Sneak eggs past the sleepy Grumbles, run them home, and hatch rare pets!">
          <div className="se-mascots">
            <EggIcon biome={0} rarity={2} size={64} />
            <PetIcon look={skin.look} size={96} mood="happy" />
            <PetIcon look={BIOMES[0].guard} size={84} mood="sleep" />
          </div>

          <Panel label="How to play">
            <ol className="se-how">
              <li>Tiptoe up to a nest and grab an egg.</li>
              <li>Run home before the Grumble catches you!</li>
              <li>Tap your egg to hatch a pet. Pets earn coins.</li>
              <li>Buy faster sneakers to open new lands.</li>
            </ol>
          </Panel>

          <Panel label="Pick your color">
            <div className="se-skins" role="group" aria-label="Pick your color">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="se-skin"
                  aria-pressed={s.id === save.skin}
                  aria-label={s.name}
                  onClick={() => persist({ skin: s.id })}>
                  <PetIcon look={s.look} size={46} />
                </button>
              ))}
            </div>
          </Panel>

          {found > 0 && (
            <StatPill icon={faBook} label="Pets found">
              {found} of {PETS.length} pets found
            </StatPill>
          )}
          {away > 0 && (
            <Banner tone="gold" icon={faCoins}>
              Your pets earned {fmtCoins(away)} coins!
            </Banner>
          )}

          <div className="dg-row">
            <KitButton size="lg" icon={faPlay} onClick={play} disabled={!loaded}>
              {save.game ? "Keep Playing" : "Play"}
            </KitButton>
          </div>
          {save.game && (
            <div className="dg-row">
              <KitButton variant="neutral" size="sm" icon={faRotateLeft} onClick={() => setConfirmReset(true)}>
                Start over
              </KitButton>
            </div>
          )}
        </StartScreen>

        <KitDialog
          game={game}
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          icon={faArrowsRotate}
          title="Start over?">
          <p className="dg-subtitle" style={{ margin: "0 auto 8px" }}>
            Your pets, coins and Pet Book will be gone for good.
          </p>
          <div className="dg-row">
            <KitButton variant="neutral" onClick={() => setConfirmReset(false)}>
              Keep my pets
            </KitButton>
            <KitButton variant="danger" onClick={startOver}>
              Start over
            </KitButton>
          </div>
        </KitDialog>
      </GameShell>
    );
  }

  const petsAlert = hud.penFull || hud.canFuse;

  return (
    <GameShell game={game}>
      <div
        ref={stageRef}
        className="se-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}>
        <canvas
          ref={canvasRef}
          className="se-canvas"
          role="img"
          aria-label="Sneaky Eggs play field. Use the arrow keys or drag to move."
        />

        <div className="se-top">
          <div className="se-top-left">
            <span className="se-coins" data-ui aria-label={`${hud.coins} coins`}>
              <Coin />
              <b>{fmtCoins(hud.coins)}</b>
              {hud.rate > 0 && <small>+{fmtCoins(hud.rate)}/s</small>}
            </span>
            <span className="se-speed" data-ui>
              <FontAwesomeIcon icon={faBolt} /> Speed {hud.speed}
            </span>
          </div>
          <div className="se-top-right" data-ui>
            <KitButton
              round
              variant="neutral"
              size="sm"
              icon={save.muted ? faVolumeXmark : faVolumeHigh}
              aria-label={save.muted ? "Turn sound on" : "Turn sound off"}
              onClick={toggleSound}
            />
            <KitButton round variant="neutral" size="sm" icon={faHouse} aria-label="Back to the menu" onClick={quit} />
          </div>
        </div>

        {place && (
          <div className="se-place" key={place.id} aria-hidden>
            {place.text}
          </div>
        )}
        {toast && (
          <div className={cx("se-toast", `is-${toast.tone}`)} key={toast.id} role="status">
            {toast.text}
          </div>
        )}

        <div className="se-dock" data-ui>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => setPanel("shop")}
            aria-label="Upgrades">
            <FontAwesomeIcon icon={faStore} />
            <span>Shop</span>
            {hud.canBuy && <i className="se-badge is-good" aria-label="You can afford an upgrade" />}
          </button>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => setPanel("pets")}
            aria-label={`Pets, ${hud.pets} of ${hud.cap}`}>
            <FontAwesomeIcon icon={faPaw} />
            <span>
              {hud.pets}/{hud.cap}
            </span>
            {petsAlert && <i className={cx("se-badge", hud.penFull ? "is-bad" : "is-good")} />}
          </button>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => setPanel("book")}
            aria-label={`Pet Book, ${hud.book} of ${PETS.length} found`}>
            <FontAwesomeIcon icon={faBook} />
            <span>
              {hud.book}/{PETS.length}
            </span>
          </button>
        </div>
      </div>

      <KitDialog
        game={game}
        open={panel === "shop"}
        onClose={() => setPanel(null)}
        icon={faStore}
        title="Shop"
        className="se-menu">
        <StatPill label="Your coins">
          <Coin /> {fmtCoins(g.coins)}
        </StatPill>
        <ShopBody g={g} onBuy={onBuy} />
        <KitButton variant="neutral" onClick={() => setPanel(null)}>
          Back to the eggs
        </KitButton>
      </KitDialog>

      <KitDialog
        game={game}
        open={panel === "pets"}
        onClose={() => setPanel(null)}
        icon={faPaw}
        title={`My Pets (${g.pets.length}/${penSize(g.up.pen)})`}
        className="se-menu">
        <StatPill label="Coins every second">
          <Coin /> {fmtCoins(totalRate(g))} every second
        </StatPill>
        <PetsBody g={g} onFuse={onFuse} onSell={onSell} />
        <KitButton variant="neutral" onClick={() => setPanel(null)}>
          Back to the eggs
        </KitButton>
      </KitDialog>

      <KitDialog
        game={game}
        open={panel === "book"}
        onClose={() => setPanel(null)}
        icon={faBook}
        title={`Pet Book (${bookCount(g.book)}/${PETS.length})`}
        className="se-menu">
        <BookBody g={g} />
        <KitButton variant="neutral" onClick={() => setPanel(null)}>
          Back to the eggs
        </KitButton>
      </KitDialog>

      <KitDialog
        game={game}
        open={reveal !== null}
        onClose={closeReveal}
        icon={reveal?.fused ? faWandMagicSparkles : faStar}
        title={reveal?.fused ? "Fusion!" : "New pet!"}>
        {reveal && (
          <>
            <div
              className={cx("se-reveal", reveal.shiny && "is-shiny")}
              style={{ "--chip": RARITIES[reveal.def.rarity].color } as CSSProperties}>
              <PetIcon look={reveal.def.look} size={150} mood="happy" />
            </div>
            <strong className="se-reveal-name">
              {reveal.shiny && "Shiny "}
              {noBreak(reveal.def.name)}
            </strong>
            <RarityChip rarity={reveal.def.rarity} />
            <p className="dg-subtitle" style={{ margin: 0 }}>
              <Coin /> Earns {fmtCoins(petRate(reveal.def, reveal.shiny))}{" "}
              {petRate(reveal.def, reveal.shiny) === 1 ? "coin" : "coins"} every second
            </p>
            <KitButton size="lg" onClick={closeReveal}>
              Yay!
            </KitButton>
          </>
        )}
      </KitDialog>
    </GameShell>
  );
}
