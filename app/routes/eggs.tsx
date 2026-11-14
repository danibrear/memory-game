import {
  faArrowsRotate,
  faBolt,
  faBook,
  faBullseye,
  faCoins,
  faEgg,
  faForwardFast,
  faHouse,
  faMapLocationDot,
  faMusic,
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
  BookBody,
  Coin,
  cx,
  EggIcon,
  MapBody,
  noBreak,
  PetIcon,
  PetsBody,
  RarityChip,
  ShopBody,
  StarIcon,
  TrophiesBody,
  upgradeName,
} from "~/components/eggs/Menus";
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
import { ACHIEVEMENTS, achievementById } from "~/games/eggs/achievements";
import { setMusic, setMusicMood, setMuted, sfx, unlockAudio } from "~/games/eggs/audio";
import {
  BIOMES,
  HATS,
  HOME_DECOR,
  PETS,
  RARITIES,
  SKINS,
  TRAILS,
  UPGRADE_IDS,
  dashCooldown,
  dressed,
  fmtCoins,
  missionText,
  penSize,
  petById,
  petRate,
  skinById,
  upgradeCost,
  type HatId,
  type HomeDecorId,
  type PetDef,
  type TrailId,
  type UpgradeId,
} from "~/games/eggs/config";
import {
  anyFusable,
  bookCount,
  buy,
  buyDecor,
  buyHat,
  buyTrail,
  coinMult,
  createGame,
  dash,
  fuse,
  missionProgress,
  penIsFull,
  savedRate,
  sell,
  setBuddy,
  setFlag,
  step,
  tapAt,
  tapWorld,
  toSave,
  totalRate,
  travel,
  pickTrail,
  wearHat,
  wish,
  type Game,
  type GameEvent,
  type SavedGame,
} from "~/games/eggs/engine";
import {
  computeView,
  render,
  screenToWorld,
  shootingStarAt,
  type Joystick,
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
const STEP = 1 / 60;
/** Pets keep earning (at half speed) for up to this long while you're away. */
const AWAY_CAP_SECONDS = 600;
/** Joystick reach in px: roomier on tablets, where thumbs travel further. */
const joyRadius = (w: number, h: number) => (Math.min(w, h) >= 700 ? 76 : 56);

type Phase = "START" | "PLAYING" | "WON";
type PanelId = "shop" | "pets" | "book" | "trophies" | "map";

interface Save {
  game: SavedGame | null;
  skin: string;
  muted: boolean;
  music: boolean;
  /** The title-screen secret. */
  giant: boolean;
  lastSeen: number;
}

const DEFAULT_SAVE: Save = {
  game: null,
  skin: SKINS[0].id,
  muted: false,
  music: true,
  giant: false,
  lastSeen: 0,
};

interface Hud {
  coins: number;
  rate: number;
  stars: number;
  speed: number;
  pets: number;
  cap: number;
  book: number;
  trophies: number;
  dash: number;
  frenzy: boolean;
  /** The mission nearest to done, as "text|have|need" (a string so it compares cheaply). */
  mission: string;
  canBuy: boolean;
  canStyle: boolean;
  canFuse: boolean;
  penFull: boolean;
}

const EMPTY_HUD: Hud = {
  coins: 0,
  rate: 0,
  stars: 0,
  speed: 0,
  pets: 0,
  cap: penSize(0),
  book: 0,
  trophies: 0,
  dash: 0,
  frenzy: false,
  mission: "",
  canBuy: false,
  canStyle: false,
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

interface Cheer {
  id: number;
  name: string;
  stars: number;
}

function hudOf(g: Game): Hud {
  const open = g.missions
    .filter((m) => m.doneT <= 0)
    .sort((a, b) => missionProgress(g, b) / b.target - missionProgress(g, a) / a.target)[0];
  return {
    coins: Math.floor(g.coins),
    rate: totalRate(g),
    stars: g.stars,
    speed: g.up.speed,
    pets: g.pets.length,
    cap: penSize(g.up.pen),
    book: bookCount(g.book),
    trophies: Object.keys(g.ach).length,
    dash: g.up.dash,
    frenzy: g.frenzy > 0,
    mission: open ? `${missionText(open.kind, open.target)}|${missionProgress(g, open)}|${open.target}` : "",
    canBuy:
      UPGRADE_IDS.some((id) => {
        const cost = upgradeCost(id, g.up[id]);
        return cost !== null && g.coins >= cost;
      }) || HOME_DECOR.some((d) => !g.home.includes(d.id) && g.coins >= d.cost),
    canStyle:
      HATS.some((h) => !g.hats.includes(h.id) && g.stars >= h.cost) ||
      TRAILS.some((t) => !g.trails.includes(t.id) && g.stars >= t.cost),
    canFuse: anyFusable(g),
    penFull: penIsFull(g),
  };
}

const sameHud = (a: Hud, b: Hud) =>
  (Object.keys(a) as (keyof Hud)[]).every((k) => a[k] === b[k]);

const fmtWait = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} seconds`;

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
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const [place, setPlace] = useState<{ id: number; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seenTrophies, setSeenTrophies] = useState(0);
  const [dashKey, setDashKey] = useState(0);
  const [tickles, setTickles] = useState(0);
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
  const tapRef = useRef<{ id: number; x: number; y: number; at: number } | null>(null);
  const keysRef = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const pendingWinRef = useRef(false);
  const coinTapsRef = useRef(0);
  const nightToldRef = useRef(false);
  const eventsRef = useRef<(g: Game) => void>(() => {});

  const reveal = reveals[0] ?? null;
  const cheer = cheers[0] ?? null;
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

  // Trophy banners queue up and show one at a time.
  useEffect(() => {
    if (!cheer) return;
    const t = window.setTimeout(() => setCheers((list) => list.slice(1)), 2300);
    return () => clearTimeout(t);
  }, [cheer]);

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
          if (e.mystery) say("You got the Mystery Egg! Run!", "good");
          else if (g.stats.eggs < 2) say("Run home before the Grumble catches you!");
          break;
        case "wake":
          sfx.wake();
          break;
        case "caught":
          sfx.caught();
          say("The Grumble took the egg back. Try again!", "bad");
          break;
        case "escape":
          sfx.escape(e.close);
          if (e.close) say("Phew! That was close!", "good");
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
          setMusicMood(e.biome, g.night);
          break;
        case "blocked":
          sfx.nope();
          if (e.reason === "gate") {
            say(`You need Speed ${BIOMES[e.biome].speedReq} sneakers for ${BIOMES[e.biome].name}!`, "bad");
          } else if (e.reason === "hands") {
            say("Your hands are full! Take the egg home first.");
          } else if (e.reason === "pads") {
            say("Your egg nests are full! Hatch those eggs first.");
          } else if (e.reason === "chest") {
            say(`The gift chest fills up again in ${fmtWait(e.seconds)}.`);
          } else if (e.reason === "travel") {
            say("Carry your eggs home on foot first!");
          } else {
            say("Your pen is full! Open Pets to fuse or sell.", "bad");
          }
          break;
        case "complete":
          pendingWinRef.current = true;
          break;
        case "achievement": {
          const a = achievementById(e.id);
          if (!a) break;
          sfx.achievement();
          setCheers((list) => [...list, { id: Date.now() + Math.random(), name: a.name, stars: a.stars }]);
          break;
        }
        case "catchup":
          say(`Welcome back! You earned ${e.count} trophies and ${e.stars} stars.`, "good");
          break;
        case "pat":
          sfx.pat();
          break;
        case "grumblePat":
          sfx.purr();
          if (g.stats.grumblePats === 1) say("Shhh... the Grumble likes that.");
          break;
        case "knock":
          sfx.knock();
          if (e.coins > 0) {
            sfx.coins();
            say("Someone slid coins under the door!", "good");
          }
          break;
        case "chest":
          sfx.chest();
          say(`Gift chest! +${fmtCoins(e.coins)} coins and a star!`, "good");
          break;
        case "mystery":
          sfx.mystery();
          say(`A Mystery Egg appeared in ${BIOMES[e.biome].name}!`, "good");
          break;
        case "mysteryGone":
          say("The Mystery Egg vanished...");
          break;
        case "night":
          sfx.night();
          setMusicMood(g.biome, true);
          if (!nightToldRef.current) {
            nightToldRef.current = true;
            say("Night time! Rare eggs love the moonlight.");
          }
          break;
        case "day":
          sfx.day();
          setMusicMood(g.biome, false);
          break;
        case "wish":
          sfx.wish();
          say("You caught a shooting star! Double coins for 30 seconds!", "good");
          break;
        case "frenzy":
          break;
        case "mission":
          sfx.mission();
          say(
            e.stars
              ? `Mission done! +${fmtCoins(e.coins)} coins and ${e.stars} bonus stars!`
              : `Mission done! +${fmtCoins(e.coins)} coins`,
            "good",
          );
          break;
        case "sugar":
          sfx.sugar();
          break;
        case "coconut":
          sfx.bonk();
          break;
        case "chime":
          sfx.chime(e.note);
          break;
        case "boing":
          sfx.boing();
          break;
        case "rustle":
          sfx.rustle();
          break;
        case "snow":
          sfx.snow();
          break;
        case "secret":
          sfx.secret();
          say(`You found a hidden star! ${e.count} of ${BIOMES.length}`, "good");
          break;
        case "taxi":
          sfx.taxi();
          say("Whoosh! The saucer flew you home!", "good");
          break;
        case "sleepy":
          sfx.zzz();
          break;
        case "dash":
          sfx.dash();
          setDashKey((k) => k + 1);
          break;
        case "travel":
          sfx.poof();
          break;
        case "bug":
          sfx.coins();
          if (e.golden) {
            sfx.secret();
            say("A golden glitterbug! +1 star", "good");
          }
          break;
      }
    }
    refreshHud();
  };

  /* ── Start / stop ── */

  const play = () => {
    unlockAudio();
    const g = createGame(saveRef.current.game, { giant: saveRef.current.giant });
    if (away > 0) {
      g.coins += away;
      g.stats.earned += away;
      setAway(0);
    }
    gameRef.current = g;
    // Handy while developing: poke at the live game from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __eggs?: Game }).__eggs = g;
    joyRef.current.active = false;
    keysRef.current.clear();
    pendingWinRef.current = false;
    nightToldRef.current = false;
    coinTapsRef.current = 0;
    hudRef.current = hudOf(g);
    setHud(hudRef.current);
    setSeenTrophies(hudRef.current.trophies);
    setReveals([]);
    setCheers([]);
    setPanel(null);
    setDashKey(0);
    setMusicMood(-1, false);
    persist();
    setPhase("PLAYING");
    if (!g.pets.length && g.pads.every((p) => !p.egg)) {
      say("Walk up the path and grab an egg!");
    }
    eventsRef.current(g);
  };

  const quit = () => {
    persist();
    gameRef.current = null;
    setPanel(null);
    setPhase("START");
  };

  const startOver = () => {
    clearStoredData(STORAGE_KEY);
    const fresh: Save = {
      ...DEFAULT_SAVE,
      skin: saveRef.current.skin,
      muted: saveRef.current.muted,
      music: saveRef.current.music,
    };
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

  const openPanel = (id: PanelId) => {
    unlockAudio();
    if (id === "trophies") setSeenTrophies(hudRef.current.trophies);
    setPanel(id);
  };

  // Music follows the game: on while playing, unless muted or switched off.
  useEffect(() => {
    setMusic(phase === "PLAYING" && save.music && !save.muted);
    return () => setMusic(false);
  }, [phase, save.music, save.muted]);

  /* ── Menu actions ── */

  const afterAction = (g: Game) => {
    eventsRef.current(g);
    refreshHud();
    persist(undefined, true);
    bump((n) => n + 1);
  };

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
      if (id === "dash" && g.up.dash === 1) say("Tap ZOOM for a burst of speed!", "good");
      else say(`${upgradeName(id)} upgraded!`, "good");
    }
    afterAction(g);
  };

  const onHat = (id: HatId) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.hats.includes(id)) {
      wearHat(g, id);
      sfx.tap();
    } else if (buyHat(g, id)) {
      sfx.buy();
    } else {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onTrail = (id: TrailId) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.trails.includes(id)) {
      pickTrail(g, id);
      sfx.tap();
    } else if (buyTrail(g, id)) {
      sfx.buy();
    } else {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onDecor = (id: HomeDecorId) => {
    const g = gameRef.current;
    if (!g) return;
    if (!buyDecor(g, id)) {
      sfx.nope();
      return;
    }
    sfx.gate();
    say("Placed! Go and have a look at home.", "good");
    afterAction(g);
  };

  const onFuse = (id: string) => {
    const g = gameRef.current;
    if (!g || !fuse(g, id)) return;
    afterAction(g);
  };

  const onSell = (id: string) => {
    const g = gameRef.current;
    if (!g) return;
    if (!sell(g, id)) return;
    sfx.sell();
    afterAction(g);
  };

  const onBuddy = (id: string | null) => {
    const g = gameRef.current;
    if (!g) return;
    setBuddy(g, id);
    sfx.pat();
    afterAction(g);
  };

  const onGo = (biome: number) => {
    const g = gameRef.current;
    if (!g) return;
    if (travel(g, biome)) setPanel(null);
    afterAction(g);
  };

  const onDash = () => {
    const g = gameRef.current;
    if (!g || pausedRef.current) return;
    unlockAudio();
    if (dash(g)) eventsRef.current(g);
  };

  const onCoinTap = () => {
    const g = gameRef.current;
    if (!g) return;
    unlockAudio();
    sfx.tap();
    coinTapsRef.current += 1;
    if (coinTapsRef.current === 10) {
      sfx.coins();
      say("Ka-ching!", "good");
      setFlag(g, "kaching");
      eventsRef.current(g);
    }
  };

  const tickle = () => {
    unlockAudio();
    sfx.pat();
    const n = tickles + 1;
    setTickles(n);
    if (n % 7 === 0) {
      sfx.secret();
      persist({ giant: !saveRef.current.giant });
    }
  };

  /* ── Input ── */

  const stagePoint = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    const g = gameRef.current;
    const stage = stageRef.current;
    if (!g || !stage || pausedRef.current) return;
    unlockAudio();
    const at = stagePoint(e);
    const v = viewRef.current;
    if (v) {
      // Hatching eggs react the instant a finger lands, so fast tapping feels good.
      const w = screenToWorld(v, at.x, at.y);
      if (tapAt(g, w.x, w.y)) return;
    }
    tapRef.current = { id: e.pointerId, x: at.x, y: at.y, at: performance.now() };
    // The newest finger always takes the stick. If a lift was ever missed (a
    // system gesture on a tablet, say), the next touch puts things right.
    joyRef.current = {
      active: true,
      ox: at.x,
      oy: at.y,
      dx: 0,
      dy: 0,
      r: joyRadius(at.w, at.h),
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
    if (!joy.active || joy.id !== e.pointerId || !stageRef.current) return;
    const at = stagePoint(e);
    let dx = at.x - joy.ox;
    let dy = at.y - joy.oy;
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
    const tap = tapRef.current;
    if (!tap || tap.id !== e.pointerId) return;
    tapRef.current = null;
    const g = gameRef.current;
    const v = viewRef.current;
    if (!g || !v || !stageRef.current || e.type === "pointercancel") return;
    const at = stagePoint(e);
    // A quick touch that didn't travel is a tap, not a steer.
    if (Math.hypot(at.x - tap.x, at.y - tap.y) > 14 || performance.now() - tap.at > 400) return;
    if (g.shoot && !g.shoot.caught) {
      const star = shootingStarAt(g.shoot, at.w, at.h);
      if (Math.hypot(star.x - at.x, star.y - at.y) < 90 && wish(g)) {
        eventsRef.current(g);
        return;
      }
    }
    const w = screenToWorld(v, at.x, at.y);
    if (tapWorld(g, w.x, w.y)) eventsRef.current(g);
  };

  useEffect(() => {
    if (phase !== "PLAYING") return;
    const keys = keysRef.current;
    const MOVE = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (pausedRef.current) return;
      if (k === " " || k === "shift") {
        const g = gameRef.current;
        if (!e.repeat && g && dash(g)) eventsRef.current(g);
        if (k === " ") e.preventDefault();
        return;
      }
      if (!MOVE.has(k)) return;
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
      const skin = skinById(saveRef.current.skin).look;
      render(ctx, g, view, dpr, now / 1000, joyRef.current, dressed(skin, g.hat), bookCount(g.book) < 3);
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
              You found all <strong>20 egg pets</strong>! Now fuse three Legendary pets to
              discover the secret Mythic ones.
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
            <StatPill icon={faTrophy} color="#f59e0b" label="Trophies">
              {Object.keys(g.ach).length} trophies
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
    const trophies = save.game?.ach?.length ?? 0;
    const hat = save.game?.hat;
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle="Sneak eggs past the sleepy Grumbles, run them home, and hatch rare pets!">
          <div className="se-mascots">
            <EggIcon biome={0} rarity={2} size={64} />
            <button
              type="button"
              className={cx("se-tickle", save.giant && "is-giant")}
              key={tickles}
              onClick={tickle}
              aria-label="Your character. Tap to tickle.">
              <PetIcon look={dressed(skin.look, hat)} size={96} mood="happy" />
            </button>
            <PetIcon look={BIOMES[0].guard} size={84} mood="sleep" />
          </div>
          {save.giant && (
            <Banner tone="gold" icon={faStar}>
              Secret found: Big Sneak mode!
            </Banner>
          )}

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
            <div className="dg-row">
              <StatPill icon={faBook} label="Pets found">
                {found} of {PETS.length} pets
              </StatPill>
              <StatPill icon={faTrophy} color="#f59e0b" label="Trophies earned">
                {trophies} of {ACHIEVEMENTS.length} trophies
              </StatPill>
            </div>
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
          <div className="dg-row">
            <KitButton
              variant="neutral"
              size="sm"
              icon={faMusic}
              aria-pressed={save.music}
              onClick={() => persist({ music: !save.music })}>
              Music {save.music ? "on" : "off"}
            </KitButton>
            {save.game && (
              <KitButton variant="neutral" size="sm" icon={faRotateLeft} onClick={() => setConfirmReset(true)}>
                Start over
              </KitButton>
            )}
          </div>
        </StartScreen>

        <KitDialog
          game={game}
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          icon={faArrowsRotate}
          title="Start over?">
          <p className="dg-subtitle" style={{ margin: "0 auto 8px" }}>
            Your pets, coins, trophies and Pet Book will be gone for good.
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
  const newTrophies = Math.max(0, hud.trophies - seenTrophies);
  const mapOpen = hud.speed >= BIOMES[1].speedReq;

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
            <button
              type="button"
              className={cx("se-coins", hud.frenzy && "is-frenzy")}
              data-ui
              onClick={onCoinTap}
              aria-label={`${hud.coins} coins`}>
              <Coin />
              <b>{fmtCoins(hud.coins)}</b>
              {hud.rate > 0 && <small>+{fmtCoins(hud.rate)}/s</small>}
              {hud.frenzy && <em>x2</em>}
            </button>
            <div className="se-chips">
              <button
                type="button"
                className="se-speed"
                data-ui
                onClick={() => openPanel("trophies")}
                aria-label={`${hud.stars} stars. Open trophies.`}>
                <StarIcon /> {hud.stars}
              </button>
              <span className="se-speed" data-ui>
                <FontAwesomeIcon icon={faBolt} /> Speed {hud.speed}
              </span>
            </div>
            {hud.mission && (
              <button
                type="button"
                className="se-mission"
                data-ui
                key={hud.mission.split("|")[0]}
                onClick={() => openPanel("trophies")}
                aria-label={`Mission: ${hud.mission.split("|")[0]}, ${hud.mission.split("|")[1]} of ${hud.mission.split("|")[2]}`}>
                <FontAwesomeIcon icon={faBullseye} />
                <span>{hud.mission.split("|")[0]}</span>
                <b>
                  {hud.mission.split("|")[1]}/{hud.mission.split("|")[2]}
                </b>
              </button>
            )}
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
            {mapOpen && (
              <KitButton
                round
                variant="neutral"
                size="sm"
                icon={faMapLocationDot}
                aria-label="Map"
                onClick={() => openPanel("map")}
              />
            )}
            <KitButton round variant="neutral" size="sm" icon={faHouse} aria-label="Back to the menu" onClick={quit} />
          </div>
        </div>

        {place && (
          <div className="se-place" key={place.id} aria-hidden>
            {place.text}
          </div>
        )}
        {cheer && (
          <div className="se-cheer" key={cheer.id} role="status">
            <FontAwesomeIcon icon={faTrophy} />
            <span>
              <small>Trophy!</small>
              {cheer.name}
            </span>
            <b>
              +{cheer.stars} <StarIcon />
            </b>
          </div>
        )}
        {toast && (
          <div className={cx("se-toast", `is-${toast.tone}`)} key={toast.id} role="status">
            {toast.text}
          </div>
        )}

        {hud.dash > 0 && (
          <button
            type="button"
            key={dashKey}
            className={cx("se-dash", dashKey > 0 && "is-cooling")}
            style={{ "--cd": `${dashCooldown(hud.dash)}s` } as CSSProperties}
            data-ui
            onPointerDown={onDash}
            aria-label="Zoom dash">
            <FontAwesomeIcon icon={faForwardFast} />
            <span>ZOOM</span>
          </button>
        )}

        <div className="se-dock" data-ui>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => openPanel("shop")}
            aria-label="Shop">
            <FontAwesomeIcon icon={faStore} />
            <span>Shop</span>
            {(hud.canBuy || hud.canStyle) && <i className="se-badge is-good" aria-label="You can afford something" />}
          </button>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => openPanel("pets")}
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
            onClick={() => openPanel("book")}
            aria-label={`Pet Book, ${hud.book} of ${PETS.length} found`}>
            <FontAwesomeIcon icon={faBook} />
            <span>
              {hud.book}/{PETS.length}
            </span>
          </button>
          <button
            type="button"
            className="dg-btn dg-btn--neutral se-dock-btn"
            onClick={() => openPanel("trophies")}
            aria-label={`Trophies, ${hud.trophies} of ${ACHIEVEMENTS.length} earned`}>
            <FontAwesomeIcon icon={faTrophy} />
            <span>
              {hud.trophies}/{ACHIEVEMENTS.length}
            </span>
            {newTrophies > 0 && <i className="se-badge is-gold">{newTrophies}</i>}
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
        <ShopBody
          g={g}
          playerLook={skin.look}
          onBuy={onBuy}
          onHat={onHat}
          onTrail={onTrail}
          onDecor={onDecor}
        />
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
        <PetsBody g={g} onFuse={onFuse} onSell={onSell} onBuddy={onBuddy} />
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
        open={panel === "trophies"}
        onClose={() => setPanel(null)}
        icon={faTrophy}
        title="Trophies"
        className="se-menu">
        <TrophiesBody g={g} />
        <KitButton variant="neutral" onClick={() => setPanel(null)}>
          Back to the eggs
        </KitButton>
      </KitDialog>

      <KitDialog
        game={game}
        open={panel === "map"}
        onClose={() => setPanel(null)}
        icon={faMapLocationDot}
        title="Map"
        className="se-menu">
        <MapBody g={g} onGo={onGo} />
        <KitButton variant="neutral" onClick={() => setPanel(null)}>
          Back to the eggs
        </KitButton>
      </KitDialog>

      <KitDialog
        game={game}
        open={reveal !== null}
        onClose={closeReveal}
        icon={reveal?.fused ? faWandMagicSparkles : faStar}
        title={reveal?.def.rarity === 4 ? "A Mythic pet!" : reveal?.fused ? "Fusion!" : "New pet!"}>
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
              {reveal.def.blurb}
            </p>
            <p className="dg-subtitle" style={{ margin: 0 }}>
              <Coin /> Earns {fmtCoins(petRate(reveal.def, reveal.shiny) * coinMult(g))}{" "}
              {petRate(reveal.def, reveal.shiny) * coinMult(g) === 1 ? "coin" : "coins"} every second
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
