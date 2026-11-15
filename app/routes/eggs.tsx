import {
  faArrowsRotate,
  faBolt,
  faBook,
  faBullseye,
  faClockRotateLeft,
  faClover,
  faCoins,
  faDice,
  faEgg,
  faFeather,
  faFeatherPointed,
  faShareNodes,
  faSnowflake,
  faForwardFast,
  faGift,
  faHammer,
  faHeart,
  faHouse,
  faMapLocationDot,
  faMedal,
  faMusic,
  faPaw,
  faPersonRunning,
  faPlay,
  faRotateLeft,
  faStar,
  faStopwatch,
  faSun,
  faStore,
  faTriangleExclamation,
  faTrophy,
  faVolumeHigh,
  faVolumeXmark,
  faWandMagicSparkles,
  faWeightHanging,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FanScoutAd, FanScoutTile, type AdOffer } from "~/components/eggs/FanScoutAd";
import {
  BookBody,
  Coin,
  cx,
  EggIcon,
  MapBody,
  noBreak,
  PetIcon,
  PetsBody,
  PowerupIcon,
  RarityChip,
  ShopBody,
  type ShopTab,
  StarIcon,
  TrophiesBody,
  upgradeName,
} from "~/components/eggs/Menus";
import {
  Banner,
  ChoiceGroup,
  GameShell,
  getGame,
  KitButton,
  KitDialog,
  Panel,
  Stars,
  StartScreen,
  StatPill,
  WinScreen,
  type Choice,
} from "~/components/game/GameKit";
import { HomeBody } from "~/components/eggs/HomeMenu";
import { ACHIEVEMENTS, achievementById } from "~/games/eggs/achievements";
import { setMusic, setMusicMood, setMuted, sfx, unlockAudio } from "~/games/eggs/audio";
import {
  BIOMES,
  HATS,
  HOME_DECOR,
  PETS,
  AD_AWAY_MULT,
  AD_REWARDS,
  AD_VISIT_STARS,
  adRewardById,
  FREEZE_CD,
  MEDAL_COLORS,
  MEDAL_NAMES,
  MINI_BUFF_TIME,
  MINI_DICE,
  POWERUPS,
  RARITIES,
  EPIC,
  FUSE_COUNT,
  LEGENDARY,
  MYTHIC,
  SHARE_URL,
  SIZES,
  SKINS,
  TRAILS,
  UPGRADE_IDS,
  VARIANTS,
  ZIP_LOOK,
  awayCap,
  awayShare,
  dashCooldown,
  dressed,
  fmtCoins,
  isJackpot,
  levelTitle,
  miniById,
  powerEggById,
  xpNeed,
  missionText,
  penSize,
  petById,
  petRate,
  skinById,
  traitName,
  upgradeCost,
  type AdRewardId,
  buildingById,
  fmtCountdown,
  siteName,
  type BuildingId,
  type HatId,
  type HomeDecorId,
  type Look,
  type MiniId,
  type PaintSlot,
  type PetDef,
  type SiteId,
  type PowerEggId,
  type PowerupId,
  type TrailId,
  type UpgradeId,
} from "~/games/eggs/config";
import {
  adVisit,
  adWait,
  anyFusable,
  bookCount,
  buy,
  buyDecor,
  buyHat,
  buyTrail,
  carryWeight,
  claimAd,
  coinMult,
  createGame,
  dash,
  equip,
  finishMini,
  freeze,
  fuse,
  hatchWait,
  rebirth,
  rebirthGain,
  usePower,
  missionProgress,
  anyBuildable,
  anyToCollect,
  collectFrom,
  jobLeft,
  penCap,
  pickPaint,
  rushBuild,
  startBuild,
  startOverSave,
  tickTown,
  penIsFull,
  prizeWait,
  rollDice,
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
  type MiniReward,
  type SavedGame,
} from "~/games/eggs/engine";
import { createMini, stepMini, type Hider, type MiniState } from "~/games/eggs/minigames";
import { renderMini } from "~/games/eggs/minigamesRender";
import {
  computeView,
  render,
  screenToWorld,
  shootingStarAt,
  type Joystick,
  type View,
} from "~/games/eggs/render";
import { FANSCOUT, AD_SLIDES, fanscoutUrl } from "~/games/eggs/fanscout";
import {
  createEggsVault,
  DEFAULT_SAVE,
  POINT_LABEL,
  type Save,
  type SavePoint,
} from "~/games/eggs/saves";
import { storage } from "~/utils/storage";
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

/** The save file and its restore points. Nothing in it leaves this device. */
const vault = createEggsVault(storage);
const STEP = 1 / 60;
/** Pets keep earning (at half speed) for up to this long while you're away. */

/** Joystick reach in px: roomier on tablets, where thumbs travel further. */
const joyRadius = (w: number, h: number) => (Math.min(w, h) >= 700 ? 76 : 56);

const STYLE_OPTIONS: Choice<"sneaky" | "cozy">[] = [
  { value: "sneaky", label: "Sneaky", icon: faStopwatch, title: "Timers and heavy eggs" },
  { value: "cozy", label: "Cozy", icon: faFeather, title: "No timers, light eggs" },
];

/** True the first time it's asked about a tip, so each one is only explained once. */
function tellOnce(g: Game, key: string): boolean {
  if (g.flags[key]) return false;
  g.flags[key] = 1;
  return true;
}

type Phase = "START" | "PLAYING" | "WON";
/** Where in the game the FanScout ad was opened from. */
type AdPlacement = "hud" | "sign" | "shop" | "title";

const AD_ICONS: Record<AdRewardId, typeof faEgg> = {
  hatch: faEgg,
  coins: faCoins,
  luck: faClover,
  prize: faGift,
};
const AD_OFFERS: AdOffer[] = AD_REWARDS.map((r) => ({ ...r, icon: AD_ICONS[r.id] }));

type PanelId = "shop" | "pets" | "book" | "trophies" | "map";

/** What the title screen says about the save it found, if anything needs saying. */
type SaveNote =
  | { kind: "recovered"; when: number }
  | { kind: "broken" }
  | { kind: "restored"; when: number }
  | { kind: "reset" };

const WHEN = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const fmtWhen = (t: number) => WHEN.format(new Date(t));
function saveNoteText(note: SaveNote): string {
  switch (note.kind) {
    case "recovered":
      return `We couldn't open your last save, so we brought back your game from ${fmtWhen(note.when)}.`;
    case "broken":
      return "We couldn't open your saved game, so this is a fresh start. A copy of the old one is kept on this device.";
    case "restored":
      return `Your game from ${fmtWhen(note.when)} is back!`;
    case "reset":
      return "Changed your mind? Your old game is under Saved games.";
  }
}
const DAY = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

const POINT_LOOK: Record<SavePoint["kind"], { icon: IconDefinition; color: string }> = {
  daily: { icon: faSun, color: "#f59e0b" },
  update: { icon: faArrowsRotate, color: "#8b5cf6" },
  reset: { icon: faRotateLeft, color: "#f97316" },
  restore: { icon: faClockRotateLeft, color: "#22c55e" },
};

/** Where the player is with a mini game: reading about it, playing it, or looking at the medal. */
interface MiniUi {
  id: MiniId;
  stage: "intro" | "play" | "result";
  reward?: MiniReward;
  summary?: string;
}

/** Who peeks out of each tent, for the dialogs. */
const MINI_MASCOT: Record<MiniId, { look: Look; mood: "happy" | "sleep" | "normal" }> = {
  tag: { look: ZIP_LOOK, mood: "happy" },
  steps: { look: BIOMES[1].guard, mood: "sleep" },
  seek: { look: PETS[0].look, mood: "happy" },
};

const MEDAL_TITLES = ["Nice try!", "Bronze medal!", "Silver medal!", "Gold medal!"];

/** "3:05" for the buff chips. */
const fmtClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The player's own pets take part in Hide and Seek: one of each kind, the fanciest first. */
function hidersOf(g: Game): Hider[] {
  const best = new Map<string, number>();
  for (const pet of g.pets) best.set(pet.id, Math.max(best.get(pet.id) ?? 0, pet.v));
  return [...best.entries()]
    .map(([id, variant]) => ({ def: petById(id), variant }))
    .filter((h): h is { def: PetDef; variant: number } => Boolean(h.def))
    .sort((a, b) => b.variant - a.variant || b.def.rarity - a.def.rarity || b.def.biome - a.def.biome)
    .map((h) => ({ look: h.def.look, name: h.def.name, variant: h.variant }));
}

interface Hud {
  coins: number;
  rate: number;
  stars: number;
  speed: number;
  /** Percent of speed lost to heavy eggs right now. */
  heavy: number;
  level: number;
  /** XP toward the next level, 0-100. */
  xp: number;
  held: PowerupId | "";
  frost: boolean;
  /** True while there's an egg worth skipping the wait for. */
  hatching: boolean;
  /** Mini-game prizes: seconds of Zoomies and happy pets left, and Lucky Dice held. */
  zoom: number;
  happy: number;
  dice: number;
  /** Seconds until the FanScout ad is ready again; 0 = ready, -1 = never offered (Cozy). */
  adWait: number;
  /** Whole seconds left on each ad boost. */
  boostCoins: number;
  boostHatch: number;
  boostLuck: number;
  feathers: number;
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
  /** The build that finishes soonest, as "name|seconds left|builds running", or "". */
  build: string;
  /** A building at home has something to collect, and the player is out in the lands. */
  ready: boolean;
}

const EMPTY_HUD: Hud = {
  coins: 0,
  rate: 0,
  stars: 0,
  speed: 0,
  heavy: 0,
  level: 1,
  xp: 0,
  held: "",
  frost: false,
  hatching: false,
  zoom: 0,
  happy: 0,
  dice: 0,
  adWait: -1,
  boostCoins: 0,
  boostHatch: 0,
  boostLuck: 0,
  feathers: 0,
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
  build: "",
  ready: false,
};

interface Reveal {
  def: PetDef;
  v: number;
  s: number;
  fused: boolean;
  isNew: boolean;
  /** It came from a Lucky Dice roll, not a hatch: the coins it paid when nothing got better. */
  dice?: { coins: number };
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
    heavy: Math.round(carryWeight(g) * 100),
    level: g.level,
    xp: Math.min(100, Math.round((g.xp / xpNeed(g.level)) * 20) * 5),
    held: g.held ?? "",
    frost: g.equipped.includes("frost"),
    hatching: !g.cozy && hatchWait(g) > 4,
    zoom: Math.ceil(g.zoomT),
    happy: Math.ceil(g.happyT),
    dice: g.dice,
    adWait: g.cozy ? -1 : adWait(g),
    boostCoins: Math.ceil(g.frenzy),
    boostHatch: Math.ceil(g.hatchT),
    boostLuck: Math.ceil(g.luckT),
    feathers: g.feathers,
    pets: g.pets.length,
    cap: penCap(g),
    book: bookCount(g.book),
    trophies: Object.keys(g.ach).length,
    dash: g.up.dash,
    frenzy: g.frenzy > 0,
    mission: open ? `${missionText(open.kind, open.target)}|${missionProgress(g, open)}|${open.target}` : "",
    canBuy:
      UPGRADE_IDS.some((id) => {
        const cost = upgradeCost(id, g.up[id]);
        return cost !== null && g.coins >= cost;
      }) ||
      HOME_DECOR.some((d) => !g.home.includes(d.id) && g.coins >= d.cost) ||
      anyBuildable(g),
    canStyle:
      HATS.some((h) => !g.hats.includes(h.id) && g.stars >= h.cost) ||
      TRAILS.some((t) => !g.trails.includes(t.id) && g.stars >= t.cost),
    canFuse: anyFusable(g),
    penFull: penIsFull(g),
    build: buildChip(g),
    ready: g.biome >= 0 && anyToCollect(g),
  };
}

function buildChip(g: Game): string {
  const jobs = g.town.jobs;
  if (!jobs.length) return "";
  const soonest = jobs.reduce((a, b) => (b.end < a.end ? b : a));
  const name = soonest.site === "house" ? siteName("house", g.town.house + 1) : siteName(soonest.site);
  return `${name}|${Math.ceil(jobLeft(soonest))}|${jobs.length}`;
}

/** "Windmill", "Windmill and Bakery", "Windmill, Bakery and Barn". */
const listOf = (names: string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

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
  const [shopTab, setShopTab] = useState<ShopTab>("upgrades");
  const [homeFocus, setHomeFocus] = useState<SiteId | null>(null);
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const [place, setPlace] = useState<{ id: number; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [points, setPoints] = useState<SavePoint[]>([]);
  const [savesOpen, setSavesOpen] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<SaveNote | null>(null);
  const [confirmRebirth, setConfirmRebirth] = useState(false);
  const [ad, setAd] = useState<AdPlacement | null>(null);
  const [awayBoosted, setAwayBoosted] = useState(false);
  const [freezeKey, setFreezeKey] = useState(0);
  const [mini, setMini] = useState<MiniUi | null>(null);
  const miniRef = useRef<MiniState | null>(null);
  const miniPlayRef = useRef(false);
  const miniTickRef = useRef<(m: MiniState) => void>(() => {});
  /** Game time before which walking into the sign won't offer the ad again. */
  const signQuietRef = useRef(-Infinity);
  /** Ad counts from the title screen, added to the save's stats on the next Play. */
  const titleAdRef = useRef({ opened: 0, done: 0, clicked: 0, seconds: 0 });
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
  // The main game stands still while a mini game is on screen.
  pausedRef.current = panel !== null || reveal !== null || ad !== null || confirmRebirth || mini !== null;
  miniPlayRef.current = mini?.stage === "play";

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
    vault.write(next);
    if (!quiet) setSave(next);
  }, []);

  /** Puts a save on the title screen: the one found at start-up, or one just restored. */
  const adopt = useCallback((next: Save, payAway: boolean) => {
    saveRef.current = next;
    setSave(next);
    setMuted(next.muted);
    let earned = 0;
    if (payAway && next.game && next.lastSeen) {
      const jar = next.game.up?.jar ?? 0;
      const secs = Math.min(awayCap(jar), (Date.now() - next.lastSeen) / 1000);
      if (secs > 60) earned = Math.floor(secs * savedRate(next.game) * awayShare(jar));
    }
    setAway(earned);
  }, []);

  useEffect(() => {
    // The vault takes today's restore point here, before anything can write over the save.
    const found = vault.load();
    if (found.save) adopt(found.save, found.status === "ok");
    if (found.status === "recovered" && found.from) {
      setSaveNote({ kind: "recovered", when: found.from.t });
    } else if (found.status === "broken") {
      setSaveNote({ kind: "broken" });
    }
    setPoints(vault.points());
    setLoaded(true);
  }, [adopt]);

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
    const built: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case "buildStart":
          sfx.buy();
          if (tellOnce(g, "toldBuild")) say("The builders are on it! Tap the building site to hurry them up.", "good");
          break;
        case "hammer":
          sfx.tap();
          break;
        case "built":
          built.push(
            e.site === "house"
              ? `Your ${siteName("house", e.level)}`
              : e.level > 1
                ? `${siteName(e.site)} (level ${e.level})`
                : `The ${siteName(e.site)}`,
          );
          break;
        case "collect":
          if (e.id === "bakery") {
            sfx.sugar();
            say(`Yum! Double coins for ${e.amount} seconds!`, "good");
          } else if (e.id === "well") {
            sfx.wish();
            say(e.amount === 1 ? "A wishing star! +1 star" : `Wishing stars! +${e.amount} stars`, "good");
          } else {
            sfx.coins();
          }
          break;
        case "ready":
          // At home you can see the bubble; out in the lands a nudge helps.
          if (g.biome >= 0) {
            say(e.id === "bakery" ? "A cupcake is ready at your Bakery!" : "A star floated up in your Wishing Well!");
          }
          break;
        case "site":
          openHome(e.site);
          break;
        case "pickup":
          sfx.pickup(e.rarity);
          if (e.mystery) say("You got the Mystery Egg! Run!", "good");
          else if (g.stats.eggs < 2) say("Run home before the Grumble catches you!");
          else if (carryWeight(g) > 0 && tellOnce(g, "toldHeavy")) {
            say("Rare eggs are heavy, so you run slower. Strong Arms in the Shop helps!");
          }
          break;
        case "grab":
          sfx.grab();
          if (tellOnce(g, "toldGrab")) say("Rare eggs take a moment to lift. Hold still... the Grumble is waking!");
          break;
        case "ripe":
          if (e.rarity >= EPIC) {
            sfx.ripe();
            say(
              e.biome === g.biome
                ? `${RARITIES[e.rarity].name} egg is ripe. Go go go!`
                : `${RARITIES[e.rarity].name} egg is ripe in ${BIOMES[e.biome].name}!`,
              "good",
            );
          }
          break;
        case "wake":
          sfx.wake();
          break;
        case "caught":
          sfx.caught();
          say(
            e.home
              ? e.eggs > 0
                ? `Caught! The Grumble took the ${e.eggs > 1 ? "eggs" : "egg"} and sent you back to the start.`
                : "Caught! Back to the start you go."
              : e.eggs > 0
                ? `The Grumble took the ${e.eggs > 1 ? "eggs" : "egg"} back. Try again!`
                : "Too slow! The Grumble shooed you off the nest.",
            "bad",
          );
          break;
        case "level":
          sfx.achievement();
          setCheers((list) => [
            ...list,
            { id: Date.now() + Math.random(), name: `Level ${e.level}: ${levelTitle(e.level)}`, stars: e.stars },
          ]);
          break;
        case "alarm":
          if (tellOnce(g, "toldAlarm")) say("Uh oh, that woke EVERY Grumble. Dodge them all the way home!", "bad");
          break;
        case "bonk":
          sfx.bonk();
          if (e.out) {
            sfx.coins();
            say(`You knocked out the ${BIOMES[e.biome].name} Grumble! +${fmtCoins(e.coins)} coins`, "good");
          } else if (tellOnce(g, "toldBonk")) {
            say("Bonk! Grumbles lose a heart when they run into things. Three bonks knocks one out.", "good");
          }
          break;
        case "mythicEgg":
          sfx.mystery();
          say(`A MYTHIC egg appeared in ${BIOMES[e.biome].name}! They almost never do.`, "good");
          break;
        case "mini":
          sfx.wake();
          if (tellOnce(g, "toldMini")) say("A mini-Grumble spotted you! They guard the groves.", "bad");
          break;
        case "shield":
          sfx.pop();
          say("Your Bubble Shield popped and saved you!", "good");
          break;
        case "feather":
          say("Your Feather Egg kept you from being sent home.", "good");
          break;
        case "gotPower":
          sfx.powerup();
          say(`${POWERUPS[e.kind].name}! ${e.kind === "bubble" ? POWERUPS[e.kind].desc : "Tap its button to use it."}`, "good");
          break;
        case "power":
          sfx.powerup();
          say(e.kind === "dizzy" ? "The Grumbles are all dizzy!" : "Every egg just ripened!", "good");
          break;
        case "powerHint":
          say(POWERUPS.bubble.desc);
          break;
        case "freeze":
          sfx.freeze();
          setFreezeKey((k) => k + 1);
          break;
        case "powerEgg": {
          const def = powerEggById(e.id);
          if (!def) break;
          sfx.jackpot();
          say(
            e.isNew
              ? `You found the ${def.name}! Wear it from the Shop's Powers tab.`
              : `Another ${def.name}: +5 stars!`,
            "good",
          );
          break;
        }
        case "ancientReady":
          sfx.ripe();
          say(`The ancient nest in ${BIOMES[e.biome].name} has a Power Egg ready!`, "good");
          break;
        case "courier":
          sfx.tap();
          break;
        case "door":
          sfx.knock();
          joyRef.current.active = false;
          keysRef.current.clear();
          setMini({ id: e.id, stage: "intro" });
          break;
        case "dice": {
          const def = petById(e.petId);
          if (!def) break;
          sfx.dice();
          if (e.better && isJackpot(e.v, e.s)) sfx.jackpot();
          else if (e.better) sfx.hatch(2);
          else sfx.coins();
          // Always a card: the Pets menu is open, and a toast would be hidden behind it.
          setReveals((list) => [...list, { def, v: e.v, s: e.s, fused: false, isNew: false, dice: { coins: e.coins } }]);
          break;
        }
        case "buffEnd":
          say(e.kind === "zoom" ? "Your Zoomies wore off. Zip will race you again!" : "Your pets have calmed down. Play Hide and Seek to cheer them up again!");
          break;
        case "rebirth":
          sfx.win();
          say(`Reborn with ${e.feathers} new Golden ${e.feathers === 1 ? "Feather" : "Feathers"}!`, "good");
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
          if (e.isNew || isJackpot(e.v, e.s)) {
            if (isJackpot(e.v, e.s)) sfx.jackpot();
            setReveals((list) => [...list, { def, v: e.v, s: e.s, fused: e.fused, isNew: e.isNew }]);
          } else {
            say(`${traitName(def, e.v, e.s)} joined your pen!`, "good");
          }
          break;
        }
        case "biome":
          setPlace({ id: Date.now(), text: e.biome < 0 ? "Home" : BIOMES[e.biome].name });
          setMusicMood(e.biome, g.night);
          break;
        case "blocked":
          if (e.reason === "ripening") {
            // The countdown over the nest says it all, so only explain it the first time.
            if (tellOnce(g, "toldRipen")) {
              say("That egg isn't ripe yet. Wait for its countdown to finish!");
            }
            break;
          }
          if (e.reason === "ancient") {
            if (tellOnce(g, "toldAncient")) {
              say("An ancient nest! It lays a Power Egg, but it takes its time. Check the Map for its timer.");
            }
            break;
          }
          if (e.reason === "holding") {
            if (tellOnce(g, "toldHolding")) say("Use the power-up you're holding before picking up another.");
            break;
          }
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
          } else if (e.reason === "door") {
            say("Take your eggs home first, then come back and play!");
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
        case "billboard":
          if (g.cozy) {
            say(`${FANSCOUT.name}: ${AD_SLIDES[0].title.join(" ")}`);
          } else if (e.tap || g.time >= signQuietRef.current) {
            // A walk-in only offers the ad when there is one to watch; a tap always answers.
            if (e.tap || adWait(g) <= 0) openAd("sign");
          }
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
    if (built.length) {
      sfx.achievement();
      say(`${listOf(built)} ${built.length > 1 ? "are" : "is"} finished!`, "good");
    }
    refreshHud();
  };

  /* ── Start / stop ── */

  const play = () => {
    unlockAudio();
    setSaveNote(null);
    const g = createGame(saveRef.current.game, {
      giant: saveRef.current.giant,
      cozy: saveRef.current.cozy,
    });
    if (away > 0) {
      g.coins += away;
      g.stats.earned += away;
      setAway(0);
    }
    setAwayBoosted(false);
    const seen = titleAdRef.current;
    g.stats.adsOpened += seen.opened;
    g.stats.adsDone += seen.done;
    g.stats.adsClicked += seen.clicked;
    g.stats.adSeconds += seen.seconds;
    titleAdRef.current = { opened: 0, done: 0, clicked: 0, seconds: 0 };
    signQuietRef.current = -Infinity;
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
    miniRef.current = null;
    setMini(null);
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
    miniRef.current = null;
    setMini(null);
    setPanel(null);
    setPhase("START");
  };

  const startOver = () => {
    // The town is never wiped: a fresh game keeps the house and buildings.
    const kept = startOverSave(saveRef.current.game);
    // The vault keeps what's being cleared as a restore point.
    vault.reset();
    const fresh: Save = {
      ...DEFAULT_SAVE,
      skin: saveRef.current.skin,
      muted: saveRef.current.muted,
      music: saveRef.current.music,
      game: kept,
      lastSeen: kept ? Date.now() : 0,
    };
    if (kept) vault.write(fresh);
    saveRef.current = fresh;
    gameRef.current = null;
    setSave(fresh);
    setAway(0);
    setAwayBoosted(false);
    const restorable = vault.points();
    setPoints(restorable);
    setSaveNote(restorable.length ? { kind: "reset" } : null);
    setConfirmReset(false);
  };

  const closeSaves = () => {
    setSavesOpen(false);
    setPickedPoint(null);
  };

  const restorePoint = (id: string) => {
    const point = points.find((p) => p.id === id);
    const restored = vault.restore(id);
    setPickedPoint(null);
    setPoints(vault.points());
    if (!restored || !point) return;
    gameRef.current = null;
    adopt(restored, false);
    setSaveNote({ kind: "restored", when: point.t });
    setSavesOpen(false);
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
    if (id === "shop") {
      setShopTab("upgrades");
      setHomeFocus(null);
    }
    setPanel(id);
  };

  /** Open the Shop on its Home section, pointing at a building if one was tapped. */
  const openHome = (site: SiteId | null) => {
    unlockAudio();
    joyRef.current.active = false;
    setShopTab("home");
    setHomeFocus(site);
    setPanel("shop");
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

  const onStart = (site: SiteId) => {
    const g = gameRef.current;
    if (!g) return;
    if (!startBuild(g, site)) {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onRush = (site: SiteId) => {
    const g = gameRef.current;
    if (!g) return;
    if (!rushBuild(g, site)) {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onCollect = (id: BuildingId) => {
    const g = gameRef.current;
    if (!g) return;
    if (!collectFrom(g, id)) {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onPaint = (slot: PaintSlot, id: string) => {
    const g = gameRef.current;
    if (!g) return;
    const did = pickPaint(g, slot, id);
    if (!did) {
      sfx.nope();
      say("Not enough stars yet. Trophies, missions and the Wishing Well give stars.");
      return;
    }
    if (did === "bought") sfx.buy();
    else sfx.tap();
    afterAction(g);
  };

  /** The Home page ticks once a second: builds finish even though the game is paused behind it. */
  const onHomeTick = () => {
    const g = gameRef.current;
    if (g && tickTown(g)) afterAction(g);
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

  const onFreeze = () => {
    const g = gameRef.current;
    if (!g || pausedRef.current) return;
    unlockAudio();
    if (freeze(g)) eventsRef.current(g);
  };

  /* Mini games: the tent asks, the arena takes over the canvas, then the medal card. */
  const startMini = (id: MiniId) => {
    const g = gameRef.current;
    const stage = stageRef.current;
    if (!g || !stage) return;
    unlockAudio();
    miniRef.current = createMini(id, {
      viewW: stage.clientWidth,
      viewH: stage.clientHeight,
      cozy: g.cozy,
      hiders: hidersOf(g),
    });
    // Dev builds only, like `__eggs`: the running mini game, for poking at.
    if (import.meta.env.DEV) (window as unknown as { __eggsMini?: MiniState }).__eggsMini = miniRef.current;
    joyRef.current.active = false;
    keysRef.current.clear();
    setToast(null);
    setMini({ id, stage: "play" });
  };

  const leaveMini = () => {
    const g = gameRef.current;
    miniRef.current = null;
    joyRef.current.active = false;
    keysRef.current.clear();
    setMini(null);
    // The player is still standing at the tent: don't ask again straight away.
    if (g) g.doorCd = 2;
  };

  // Re-made every render, like the main game's event handler.
  miniTickRef.current = (m: MiniState) => {
    for (const e of m.events.splice(0)) {
      switch (e.type) {
        case "count":
        case "tick":
          sfx.count();
          break;
        case "go":
          sfx.go();
          break;
        case "score":
          sfx.pickup(2);
          if (m.id !== "steps") sfx.giggle();
          break;
        case "ouch":
          sfx.caught();
          break;
        case "tell":
          sfx.warn();
          break;
        case "whoosh":
          sfx.dash();
          break;
        case "round":
          sfx.gate();
          break;
        case "awake":
          sfx.wake();
          break;
        case "asleep":
          sfx.zzz();
          break;
        case "peek":
          sfx.giggle();
          break;
        case "miss":
          sfx.rustle();
          sfx.nope();
          break;
        case "done":
          if (e.medal > 0) sfx.medal(e.medal);
          else sfx.nope();
          break;
      }
    }
    // Let the cheer play for a moment, then hand over the prize and show the medal.
    const g = gameRef.current;
    if (g && m.phase === "done" && m.doneT >= 1.5 && miniPlayRef.current) {
      miniPlayRef.current = false;
      const reward = finishMini(g, m.id, m.medal);
      setMini({ id: m.id, stage: "result", reward, summary: m.summary });
      eventsRef.current(g);
      refreshHud();
      persist(undefined, true);
    }
  };

  const onRoll = (id: string) => {
    const g = gameRef.current;
    if (!g) return;
    if (!rollDice(g, id)) {
      sfx.nope();
      return;
    }
    afterAction(g);
  };

  const onPower = () => {
    const g = gameRef.current;
    if (!g || pausedRef.current) return;
    unlockAudio();
    usePower(g);
    eventsRef.current(g);
  };

  const onEquip = (id: PowerEggId) => {
    const g = gameRef.current;
    if (!g) return;
    if (equip(g, id)) sfx.buy();
    else {
      sfx.nope();
      say("No free slot. Take one off first, or level up for another.");
    }
    afterAction(g);
  };

  const doRebirth = () => {
    const g = gameRef.current;
    setConfirmRebirth(false);
    if (!g) return;
    setPanel(null);
    if (rebirth(g) > 0) eventsRef.current(g);
    afterAction(g);
  };

  /* The FanScout ad: the longer you watch, the more boosts you collect. */
  const openAd = (from: AdPlacement) => {
    if (from === "title") {
      titleAdRef.current.opened++;
      setAd(from);
      return;
    }
    const g = gameRef.current;
    if (!g || g.cozy) return;
    const wait = adWait(g);
    if (wait > 0) {
      say(`More FanScout boosts in ${fmtWait(wait)}.`);
      return;
    }
    g.stats.adsOpened++;
    setPanel(null);
    setAd(from);
  };
  const closeAd = (seconds: number) => {
    const from = ad;
    setAd(null);
    if (from === "title") {
      titleAdRef.current.seconds += Math.floor(seconds);
      if (seconds >= AD_OFFERS[0].at && !awayBoosted) {
        titleAdRef.current.done++;
        setAway((n) => n * AD_AWAY_MULT);
        setAwayBoosted(true);
        sfx.chest();
      }
      return;
    }
    const g = gameRef.current;
    if (!g) return;
    const won = claimAd(g, seconds);
    if (!won.rewards.length) {
      // Turned down: don't offer it again the moment they brush the sign.
      signQuietRef.current = g.time + 20;
      afterAction(g);
      return;
    }
    sfx.chest();
    const n = won.rewards.length;
    say(
      n === 1
        ? `${adRewardById(won.rewards[0]).name} is on!`
        : won.prize
          ? `${n} boosts collected! Mystery Prize: ${won.prize}.`
          : `${n} boosts collected!`,
      "good",
    );
    afterAction(g);
  };
  const visitAd = () => {
    const g = gameRef.current;
    if (!g) {
      titleAdRef.current.clicked++;
      return;
    }
    const stars = adVisit(g);
    if (stars > 0) say(`Thanks for checking out FanScout! +${stars} stars`, "good");
    afterAction(g);
  };

  const share = async () => {
    const g = gameRef.current;
    const found = g ? bookCount(g.book) : save.game ? bookCount(save.game.book) : 0;
    const level = g?.level ?? save.game?.level ?? 1;
    const text =
      found > 0
        ? `I'm level ${level} with ${found} of ${PETS.length} pets in Sneaky Eggs. Bet you can't sneak past the Grumbles!`
        : "Sneak eggs past the sleepy Grumbles and hatch rare pets. Bet you can't beat me!";
    if (g) g.stats.shares++;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Sneaky Eggs", text, url: SHARE_URL });
      } else {
        await navigator.clipboard.writeText(`${text} ${SHARE_URL}`);
        say("Copied! Paste it to a friend.", "good");
      }
    } catch {
      // Closing the share sheet isn't an error worth mentioning.
    }
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
    const inMini = miniPlayRef.current;
    if (!g || !stage || (pausedRef.current && !inMini)) return;
    unlockAudio();
    const at = stagePoint(e);
    const v = viewRef.current;
    if (v && !inMini) {
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
    // Inside a mini game a finger only ever steers.
    if (!g || !v || !stageRef.current || e.type === "pointercancel" || miniRef.current) return;
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
      const inMini = miniPlayRef.current;
      if (pausedRef.current && !inMini) return;
      if (k === " " || k === "shift") {
        const g = gameRef.current;
        if (!inMini && !e.repeat && g && dash(g)) eventsRef.current(g);
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
      // A mini game takes over the whole canvas until it's closed.
      const m = miniRef.current;
      if (m) {
        const input = miniPlayRef.current ? readInput() : { x: 0, y: 0 };
        while (dt > 0) {
          const slice = Math.min(STEP, dt);
          stepMini(m, slice, input);
          dt -= slice;
        }
        miniTickRef.current(m);
        renderMini(ctx, m, w, h, dpr, now / 1000, joyRef.current, dressed(skinById(saveRef.current.skin).look, g.hat));
        return;
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
              You found all <strong>{PETS.filter((p) => p.rarity < MYTHIC).length} egg pets</strong>! Now fuse{" "}
              {FUSE_COUNT} Legendary pets, or find an extremely rare Mythic egg, to discover the secret Mythic ones.
            </>
          }>
          <div className="se-parade">
            {PETS.filter((p) => p.rarity === LEGENDARY).map((p) => (
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
            <EggIcon biome={0} rarity={EPIC} size={64} />
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
          {saveNote && (
            <div className="se-save-note">
              <Banner
                tone={saveNote.kind === "restored" ? "good" : "soft"}
                icon={saveNote.kind === "broken" ? faTriangleExclamation : faClockRotateLeft}>
                {saveNoteText(saveNote)}
              </Banner>
            </div>
          )}

          <Panel label="How to play">
            <ol className="se-how">
              <li>Tiptoe up to a nest and grab an egg.</li>
              <li>Run home before the Grumble catches you!</li>
              <li>Tap your egg to hatch a pet. Pets earn coins.</li>
              <li>Buy faster sneakers to open new lands.</li>
              <li>Lead a chasing Grumble into a tree. Three bonks knocks it out!</li>
              <li>Explore the side groves for better eggs, power-ups and Power Eggs.</li>
              <li>Pop into a striped tent for a mini game and a prize.</li>
            </ol>
          </Panel>

          <Panel label="Game style">
            <ChoiceGroup
              label="Game style"
              options={STYLE_OPTIONS}
              value={save.cozy ? "cozy" : "sneaky"}
              onChange={(v) => persist({ cozy: v === "cozy" })}
            />
            <span className="dg-caption">
              {save.cozy
                ? "Gentle rules: no timers, light eggs, and a Grumble only bumps you."
                : "Timers, heavy eggs, mini-Grumbles, and one catch sends you back to the start!"}
            </span>
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
              Your pets earned {fmtCoins(away)} coins{awayBoosted ? ", doubled by FanScout!" : "!"}
            </Banner>
          )}
          {away > 0 && !awayBoosted && !save.cozy && (
            <button type="button" className="se-fsbtn is-ready is-inline" onClick={() => openAd("title")}>
              <FanScoutTile size={34} />
              <span className="se-fsbtn-text">
                <b>Double it to {fmtCoins(away * AD_AWAY_MULT)}</b>
                <small>watch a FanScout ad</small>
              </span>
            </button>
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
            <KitButton variant="neutral" size="sm" icon={faShareNodes} onClick={share}>
              Tell a friend
            </KitButton>
            {points.length > 0 && (
              <KitButton
                variant="neutral"
                size="sm"
                icon={faClockRotateLeft}
                onClick={() => setSavesOpen(true)}>
                Saved games
              </KitButton>
            )}
            {save.game && (
              <KitButton variant="neutral" size="sm" icon={faRotateLeft} onClick={() => setConfirmReset(true)}>
                Start over
              </KitButton>
            )}
          </div>

          <a
            className="se-fs-strip"
            href={fanscoutUrl("title-strip")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => titleAdRef.current.clicked++}>
            <FanScoutTile size={40} />
            <span className="se-fs-strip-text">
              <small>From the maker of this game</small>
              <b>{FANSCOUT.name}</b>
              <em>{AD_SLIDES[0].title.join(" ")}</em>
            </span>
            <i>{FANSCOUT.site}</i>
          </a>
        </StartScreen>

        <FanScoutAd
          game={game}
          open={ad === "title"}
          placement="title"
          offers={[
            {
              id: "away",
              at: AD_OFFERS[0].at,
              name: "Double your coins",
              desc: `${fmtCoins(away)} becomes ${fmtCoins(away * AD_AWAY_MULT)}`,
              icon: faCoins,
            },
          ]}
          onVisit={visitAd}
          onClose={closeAd}
        />

        <KitDialog
          game={game}
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          icon={faArrowsRotate}
          title="Start over?">
          <p className="dg-subtitle" style={{ margin: "0 auto 8px" }}>
            Your pets, coins, trophies and Pet Book will be cleared.
            {startOverSave(save.game) ? " Your house and buildings stay." : ""} If you change your
            mind, you can bring them back from Saved games on this device.
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

        <KitDialog
          game={game}
          open={savesOpen}
          onClose={closeSaves}
          icon={faClockRotateLeft}
          title="Saved games"
          className="se-menu">
          <p className="dg-subtitle" style={{ margin: "0 auto" }}>
            The game keeps a few older copies of your save on this device. Pick one to go back
            to it.
          </p>
          <div className="se-list">
            {points.map((p) => {
              const look = POINT_LOOK[p.kind];
              const picked = pickedPoint === p.id;
              return (
                <div className={cx("se-row", "se-save", picked && "is-picked")} key={p.id}>
                  <span className="se-row-icon" style={{ "--tile": look.color } as CSSProperties}>
                    <FontAwesomeIcon icon={look.icon} />
                  </span>
                  <div className="se-row-text">
                    <strong>{DAY.format(new Date(p.t))}</strong>
                    <span>
                      Level {p.summary.level} · {p.summary.pets}{" "}
                      {p.summary.pets === 1 ? "pet" : "pets"} · {fmtCoins(p.summary.coins)} coins
                    </span>
                    <small>
                      {TIME.format(new Date(p.t))} · {POINT_LABEL[p.kind]}
                    </small>
                  </div>
                  {picked ? (
                    <div className="se-row-actions">
                      <KitButton size="sm" onClick={() => restorePoint(p.id)}>
                        Yes, go back
                      </KitButton>
                      <KitButton size="sm" variant="neutral" onClick={() => setPickedPoint(null)}>
                        Cancel
                      </KitButton>
                    </div>
                  ) : (
                    <KitButton
                      size="sm"
                      variant="neutral"
                      aria-label={`Go back to the game from ${fmtWhen(p.t)}`}
                      onClick={() => setPickedPoint(p.id)}>
                      Go back
                    </KitButton>
                  )}
                </div>
              );
            })}
          </div>
          <span className="dg-caption" aria-live="polite">
            {pickedPoint && save.game
              ? "Your game as it is now is kept here too, so you can undo this."
              : "Saved games stay on this device only."}
          </span>
          <div className="dg-row">
            <KitButton variant="neutral" onClick={closeSaves}>
              Close
            </KitButton>
          </div>
        </KitDialog>
      </GameShell>
    );
  }

  const petsAlert = hud.penFull || hud.canFuse || hud.dice > 0;
  const newTrophies = Math.max(0, hud.trophies - seenTrophies);
  const mapOpen = hud.speed >= BIOMES[1].speedReq;
  // The arena has the screen to itself while a mini game is being played or just ended.
  const inMini = mini !== null && mini.stage !== "intro";
  const miniDef = mini ? miniById(mini.id) : undefined;
  const miniWait = mini ? prizeWait(g, mini.id) : 0;
  const reward = mini?.reward;

  return (
    <GameShell game={game}>
      <div
        ref={stageRef}
        className={cx("se-stage", inMini && "is-mini")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}>
        <canvas
          ref={canvasRef}
          className="se-canvas"
          role="img"
          aria-label={
            inMini && miniDef
              ? `${miniDef.name}. Use the arrow keys or drag to move.`
              : "Sneaky Eggs play field. Use the arrow keys or drag to move."
          }
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
              <span
                className="se-speed se-level"
                data-ui
                style={{ "--xp": `${hud.xp}%` } as CSSProperties}
                aria-label={`Level ${hud.level}, ${hud.xp}% of the way to the next`}>
                Lv {hud.level}
              </span>
              {hud.feathers > 0 && (
                <span className="se-speed se-feathers" data-ui aria-label={`${hud.feathers} Golden Feathers`}>
                  <FontAwesomeIcon icon={faFeatherPointed} /> {hud.feathers}
                </span>
              )}
              <span className={cx("se-speed", hud.heavy > 0 && "is-heavy")} data-ui>
                <FontAwesomeIcon icon={hud.heavy > 0 ? faWeightHanging : faBolt} />{" "}
                {hud.heavy > 0 ? `Heavy −${hud.heavy}%` : `Speed ${hud.speed}`}
              </span>
              {hud.zoom > 0 && (
                <span className="se-speed se-buff is-zoom" data-ui aria-label={`Zoomies: running faster for ${fmtWait(hud.zoom)}`}>
                  <FontAwesomeIcon icon={faPersonRunning} /> {fmtClock(hud.zoom)}
                </span>
              )}
              {hud.happy > 0 && (
                <span className="se-speed se-buff is-happy" data-ui aria-label={`Happy pets: double coins for ${fmtWait(hud.happy)}`}>
                  <FontAwesomeIcon icon={faHeart} /> x2 {fmtClock(hud.happy)}
                </span>
              )}
              {hud.dice > 0 && (
                <button
                  type="button"
                  className="se-speed se-buff is-dice"
                  data-ui
                  onClick={() => openPanel("pets")}
                  aria-label={`${hud.dice} Lucky Dice. Open Pets to roll them.`}>
                  <FontAwesomeIcon icon={faDice} /> {hud.dice}
                </button>
              )}
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
            <div className="se-top-btns">
              <KitButton
                round
                variant="neutral"
                size="sm"
                icon={save.muted ? faVolumeXmark : faVolumeHigh}
                aria-label={save.muted ? "Turn sound on" : "Turn sound off"}
                onClick={toggleSound}
              />
              {mapOpen && !inMini && (
                <KitButton
                  round
                  variant="neutral"
                  size="sm"
                  icon={faMapLocationDot}
                  aria-label="Map"
                  onClick={() => openPanel("map")}
                />
              )}
              {inMini ? (
                <KitButton round variant="neutral" size="sm" icon={faXmark} aria-label="Leave the mini game" onClick={leaveMini} />
              ) : (
                <KitButton round variant="neutral" size="sm" icon={faHouse} aria-label="Back to the menu" onClick={quit} />
              )}
            </div>
            {inMini ? null : hud.build ? (
              <button
                type="button"
                className="se-mission se-buildchip"
                data-ui
                onClick={() => openHome(null)}
                aria-label={`Building: ${hud.build.split("|")[0]}, ${fmtCountdown(Number(hud.build.split("|")[1]))} left`}>
                <FontAwesomeIcon icon={faHammer} />
                <span>
                  {hud.build.split("|")[0]}
                  {Number(hud.build.split("|")[2]) > 1 ? ` +${Number(hud.build.split("|")[2]) - 1}` : ""}
                </span>
                <b>{fmtCountdown(Number(hud.build.split("|")[1]))}</b>
              </button>
            ) : (
              hud.ready && (
                <button
                  type="button"
                  className="se-mission se-buildchip is-ready"
                  data-ui
                  onClick={() => openHome(null)}
                  aria-label="Something is ready to collect at home">
                  <FontAwesomeIcon icon={faGift} />
                  <span>Ready at home!</span>
                </button>
              )
            )}
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

        <div className="se-actions" data-ui>
          {hud.held && (
            <button
              type="button"
              className="se-act is-power"
              style={{ "--act": POWERUPS[hud.held].color } as CSSProperties}
              onPointerDown={onPower}
              aria-label={`Use ${POWERUPS[hud.held].name}`}>
              <PowerupIcon kind={hud.held} size={40} />
            </button>
          )}
          {hud.frost && (
            <button
              type="button"
              key={freezeKey}
              className={cx("se-act is-freeze", freezeKey > 0 && "is-cooling")}
              style={{ "--cd": `${FREEZE_CD}s` } as CSSProperties}
              onPointerDown={onFreeze}
              aria-label="Freeze the Grumbles">
              <FontAwesomeIcon icon={faSnowflake} />
              <span>FREEZE</span>
            </button>
          )}
        </div>

        {hud.adWait >= 0 && (
          <div className="se-fs-hud" data-ui>
            {(hud.boostCoins > 0 || hud.boostHatch > 0 || hud.boostLuck > 0) && (
              <div className="se-boosts" aria-label="Boosts running">
                {hud.boostCoins > 0 && (
                  <span>
                    <FontAwesomeIcon icon={faCoins} /> x2 <b>{fmtClock(hud.boostCoins)}</b>
                  </span>
                )}
                {hud.boostHatch > 0 && (
                  <span>
                    <FontAwesomeIcon icon={faEgg} /> x4 <b>{fmtClock(hud.boostHatch)}</b>
                  </span>
                )}
                {hud.boostLuck > 0 && (
                  <span>
                    <FontAwesomeIcon icon={faClover} /> Lucky <b>{fmtClock(hud.boostLuck)}</b>
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              className={cx("se-fsbtn", hud.adWait > 0 ? "is-waiting" : "is-ready")}
              onClick={() => openAd("hud")}
              aria-label={
                hud.adWait > 0
                  ? `More FanScout boosts in ${fmtWait(hud.adWait)}`
                  : "Watch a FanScout ad for free boosts"
              }>
              <FanScoutTile size={34} />
              <span className="se-fsbtn-text">
                <b>{hud.adWait > 0 ? fmtClock(hud.adWait) : hud.hatching ? "Hatch now" : "Free boosts"}</b>
                <small>{hud.adWait > 0 ? "next boosts" : "from FanScout"}</small>
              </span>
            </button>
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
        {hud.adWait >= 0 && (
          <button
            type="button"
            className={cx("se-fsbtn is-row", hud.adWait > 0 ? "is-waiting" : "is-ready")}
            onClick={() => openAd("shop")}>
            <FanScoutTile size={34} />
            <span className="se-fsbtn-text">
              <b>{hud.adWait > 0 ? `More boosts in ${fmtClock(hud.adWait)}` : "Free boosts"}</b>
              <small>Double coins, lucky nests and more, from FanScout</small>
            </span>
          </button>
        )}
        <ShopBody
          key={`${shopTab}-${homeFocus ?? ""}`}
          g={g}
          playerLook={skin.look}
          startTab={shopTab}
          home={
            <HomeBody
              g={g}
              focus={homeFocus}
              onStart={onStart}
              onRush={onRush}
              onCollect={onCollect}
              onPaint={onPaint}
              onDecor={onDecor}
              onTick={onHomeTick}
            />
          }
          onBuy={onBuy}
          onHat={onHat}
          onTrail={onTrail}
          onEquip={onEquip}
          onRebirth={() => setConfirmRebirth(true)}
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
        title={`My Pets (${g.pets.length}/${penCap(g)})`}
        className="se-menu">
        <StatPill label="Coins every second">
          <Coin /> {fmtCoins(totalRate(g))} every second
        </StatPill>
        <PetsBody g={g} onFuse={onFuse} onSell={onSell} onBuddy={onBuddy} onRoll={onRoll} />
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
        open={confirmRebirth}
        onClose={() => setConfirmRebirth(false)}
        icon={faFeatherPointed}
        title="Rebirth?">
        <p className="dg-subtitle" style={{ margin: "0 auto 8px" }}>
          You'll get <strong>{rebirthGain(g)}</strong> Golden {rebirthGain(g) === 1 ? "Feather" : "Feathers"}, each
          worth +10% coins forever. Your coins, upgrades and pets start over. Your Pet Book, trophies, stars, hats,
          level, Power Eggs, house and buildings stay.
        </p>
        <div className="dg-row">
          <KitButton variant="neutral" onClick={() => setConfirmRebirth(false)}>
            Not yet
          </KitButton>
          <KitButton onClick={doRebirth}>Rebirth</KitButton>
        </div>
      </KitDialog>

      <KitDialog
        game={game}
        open={mini?.stage === "intro"}
        onClose={leaveMini}
        icon={faGift}
        title={miniDef?.name ?? "Mini game"}>
        {mini && miniDef && (
          <>
            <div className="se-mini-hero">
              <PetIcon look={MINI_MASCOT[mini.id].look} size={92} mood={MINI_MASCOT[mini.id].mood} />
            </div>
            <p className="dg-subtitle" style={{ margin: 0 }}>
              {miniDef.blurb}
            </p>
            <ol className="se-how se-mini-how">
              {miniDef.how.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <div className={cx("se-mini-prize", miniWait <= 0 && "is-ready")}>
              <FontAwesomeIcon icon={faGift} />
              <span>
                <strong>{miniWait <= 0 ? "Prize ready!" : `Next prize in ${fmtWait(miniWait)}`}</strong>
                <small>
                  {miniDef.prize}
                  {mini.id === "steps"
                    ? `: up to ${MINI_DICE[3]} for a gold medal.`
                    : ` for up to ${MINI_BUFF_TIME[3] / 60} minutes.`}
                  {miniWait > 0 && " You can still play for fun and a few coins."}
                </small>
              </span>
            </div>
            {g.medals[mini.id] > 0 && (
              <span className="dg-pill se-mini-best">
                <FontAwesomeIcon icon={faMedal} style={{ color: MEDAL_COLORS[g.medals[mini.id]] }} /> Your best:{" "}
                {MEDAL_NAMES[g.medals[mini.id]]}
              </span>
            )}
            <div className="dg-row">
              <KitButton variant="neutral" onClick={leaveMini}>
                Not now
              </KitButton>
              <KitButton size="lg" icon={faPlay} onClick={() => startMini(mini.id)}>
                Play
              </KitButton>
            </div>
          </>
        )}
      </KitDialog>

      <KitDialog
        game={game}
        open={mini?.stage === "result"}
        onClose={leaveMini}
        icon={faMedal}
        title={MEDAL_TITLES[reward?.medal ?? 0]}>
        {mini && reward && (
          <>
            <Stars count={reward.medal} />
            <p className="dg-subtitle" style={{ margin: 0 }}>
              {mini.summary}
            </p>
            {reward.newBest && reward.medal > 0 && (
              <Banner tone="gold" icon={faStar}>
                New best!
              </Banner>
            )}
            <ul className="se-mini-rewards">
              {reward.zoom > 0 && (
                <li>
                  <FontAwesomeIcon icon={faPersonRunning} /> Zoomies! You run faster for {reward.zoom / 60} minutes.
                </li>
              )}
              {reward.happy > 0 && (
                <li>
                  <FontAwesomeIcon icon={faHeart} /> Happy pets! Double coins for {reward.happy / 60} minutes.
                </li>
              )}
              {reward.dice > 0 && (
                <li>
                  <FontAwesomeIcon icon={faDice} /> {reward.dice} Lucky Dice! Roll {reward.dice === 1 ? "it" : "them"} on a
                  pet in My Pets.
                </li>
              )}
              {reward.trail && (
                <li>
                  <FontAwesomeIcon icon={faStar} /> You beat Zip! His Zoom trail is yours.
                </li>
              )}
              {reward.coins > 0 && (
                <li>
                  <Coin /> +{fmtCoins(reward.coins)} coins for playing.
                  {miniWait > 0 && ` The big prize is back in ${fmtWait(miniWait)}.`}
                </li>
              )}
              {reward.medal === 0 && <li>Win a medal to take the prize home. Have another go!</li>}
            </ul>
            <div className="dg-row">
              <KitButton variant="neutral" onClick={leaveMini}>
                Back to the eggs
              </KitButton>
              <KitButton icon={faPlay} onClick={() => startMini(mini.id)}>
                Play again
              </KitButton>
            </div>
          </>
        )}
      </KitDialog>

      <FanScoutAd
        game={game}
        open={ad !== null}
        placement={ad ?? "hud"}
        offers={AD_OFFERS}
        visitStars={
          gameRef.current && gameRef.current.flags.fsVisit !== Math.floor(Date.now() / 86_400_000)
            ? AD_VISIT_STARS
            : 0
        }
        onVisit={visitAd}
        onClose={closeAd}
      />

      <KitDialog
        game={game}
        open={reveal !== null}
        onClose={closeReveal}
        icon={reveal?.dice ? faDice : reveal?.fused ? faWandMagicSparkles : faStar}
        title={
          reveal?.dice && reveal.dice.coins > 0
            ? "No luck this time"
            : reveal && isJackpot(reveal.v, reveal.s)
              ? "Jackpot!"
              : reveal?.dice
                ? "Lucky roll!"
                : reveal?.def.rarity === MYTHIC
              ? "A Mythic pet!"
              : reveal?.fused
                ? "Fusion!"
                : "New pet!"
        }>
        {reveal && (
          <>
            <div
              className={cx("se-reveal", reveal.v > 0 && "is-shiny", reveal.v === 3 && "is-rainbow")}
              style={
                {
                  "--chip": reveal.v > 0 ? VARIANTS[reveal.v].color : RARITIES[reveal.def.rarity].color,
                  "--grow": SIZES[reveal.s].scale,
                } as CSSProperties
              }>
              <PetIcon look={reveal.def.look} size={150} mood="happy" variant={reveal.v} />
            </div>
            <strong className="se-reveal-name">{noBreak(traitName(reveal.def, reveal.v, reveal.s))}</strong>
            <span className="se-row-chips">
              <RarityChip rarity={reveal.def.rarity} />
              {reveal.v > 0 && (
                <span
                  className={cx("se-trait", reveal.v === 3 && "is-rainbow")}
                  style={{ "--chip": VARIANTS[reveal.v].color } as CSSProperties}>
                  {VARIANTS[reveal.v].name} ×{VARIANTS[reveal.v].mult}
                </span>
              )}
              {reveal.s > 0 && (
                <span className="se-trait" style={{ "--chip": "#0ea5e9" } as CSSProperties}>
                  {SIZES[reveal.s].name} ×{SIZES[reveal.s].mult}
                </span>
              )}
            </span>
            <p className="dg-subtitle" style={{ margin: 0 }}>
              {reveal.dice
                ? reveal.dice.coins > 0
                  ? `It stayed the same, so the dice paid out ${fmtCoins(reveal.dice.coins)} coins instead.`
                  : "The dice made it even better!"
                : reveal.def.blurb}
            </p>
            <p className="dg-subtitle" style={{ margin: 0 }}>
              <Coin /> Earns {fmtCoins(petRate(reveal.def, reveal.v, reveal.s) * coinMult(g))}{" "}
              {petRate(reveal.def, reveal.v, reveal.s) * coinMult(g) === 1 ? "coin" : "coins"} every second
            </p>
            <div className="dg-row">
              {isJackpot(reveal.v, reveal.s) && !(reveal.dice && reveal.dice.coins > 0) && (
                <KitButton variant="neutral" icon={faShareNodes} onClick={share}>
                  Brag
                </KitButton>
              )}
              <KitButton size="lg" onClick={closeReveal}>
                {reveal.dice && reveal.dice.coins > 0 ? "OK" : "Yay!"}
              </KitButton>
            </div>
          </>
        )}
      </KitDialog>
    </GameShell>
  );
}
