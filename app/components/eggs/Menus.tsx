import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBasketShopping,
  faBolt,
  faBone,
  faBullseye,
  faCheck,
  faClover,
  faCoins,
  faDove,
  faDroplet,
  faDumbbell,
  faFeatherPointed,
  faEgg,
  faFire,
  faForwardFast,
  faGift,
  faHandSparkles,
  faHatWizard,
  faHeart,
  faHouse,
  faLocationDot,
  faLock,
  faMapLocationDot,
  faMedal,
  faPaw,
  faPersonRunning,
  faPiggyBank,
  faQuestion,
  faRainbow,
  faSeedling,
  faSocks,
  faStairs,
  faStar,
  faSun,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChoiceGroup, KitButton } from "~/components/game/GameKit";
import { ACHIEVEMENTS, type AchKind } from "~/games/eggs/achievements";
import {
  BIOMES,
  DECOR_BONUS,
  FEATHER_BONUS,
  FUSE_COUNT,
  HATS,
  HOME_DECOR,
  MISSION_STREAK,
  MISSION_STREAK_STARS,
  PETS,
  POWER_EGGS,
  RARITIES,
  SIZES,
  SLOT_LEVELS,
  TRAILS,
  UPGRADE_IDS,
  VARIANTS,
  armsScale,
  awayCap,
  awayShare,
  basketSize,
  courierEvery,
  dashCooldown,
  dressed,
  equipSlots,
  fmtCoins,
  missionText,
  handsScale,
  hatchScale,
  penSize,
  petFor,
  petRate,
  ripenScale,
  shinyChance,
  sockBonus,
  treatsMult,
  upgradeCost,
  type HatId,
  type HomeDecorId,
  type Look,
  type PetDef,
  type PowerEggId,
  type PowerupId,
  type Rarity,
  type TrailId,
  type UpgradeId,
} from "~/games/eggs/config";
import {
  canFuse,
  canRebirth,
  coinMult,
  countOf,
  missionProgress,
  rebirthGain,
  sellPrice,
  type Game,
} from "~/games/eggs/engine";
import {
  paintEggIcon,
  paintPetIcon,
  paintPowerEggIcon,
  paintPowerupIcon,
  type Mood,
} from "~/games/eggs/render";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Keep hyphenated names like "Mer-Kitty" on one line. */
export const noBreak = (name: string) => name.replace(/-/g, "‑");

/* ---------- Little pictures ---------- */

export function PetIcon({
  look,
  size,
  hidden,
  mood,
  variant = 0,
}: {
  look: Look;
  size: number;
  hidden?: boolean;
  mood?: Mood;
  /** Hatch variant: 2 paints it Golden, 3 Rainbow. */
  variant?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPetIcon(ref.current, look, size, mood, variant);
  }, [look, size, mood, variant]);
  return (
    <canvas
      ref={ref}
      className={cx("se-icon", hidden && "is-hidden")}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function EggIcon({ biome, rarity, size }: { biome: number; rarity: Rarity; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintEggIcon(ref.current, biome, rarity, size);
  }, [biome, rarity, size]);
  return <canvas ref={ref} className="se-icon" style={{ width: size, height: size }} aria-hidden />;
}

export function PowerEggIcon({ color, size, hidden }: { color: string; size: number; hidden?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPowerEggIcon(ref.current, color, size);
  }, [color, size]);
  return (
    <canvas
      ref={ref}
      className={cx("se-icon", hidden && "is-hidden")}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function PowerupIcon({ kind, size }: { kind: PowerupId; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPowerupIcon(ref.current, kind, size);
  }, [kind, size]);
  return <canvas ref={ref} className="se-icon" style={{ width: size, height: size }} aria-hidden />;
}

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  if (s >= 3600) return `${Math.round(s / 360) / 10}h`;
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
};

export function RarityChip({ rarity }: { rarity: Rarity }) {
  const info = RARITIES[rarity];
  return (
    <span
      className={cx("se-chip", rarity === 4 && "is-mythic")}
      style={{ "--chip": info.color, "--chip-dk": info.dark } as CSSProperties}>
      {info.name}
    </span>
  );
}

export function Coin() {
  return <span className="se-coin" aria-hidden />;
}

export function StarIcon() {
  return <FontAwesomeIcon icon={faStar} className="se-star" aria-hidden />;
}

/* ---------- Shop ---------- */

interface UpgradeInfo {
  icon: IconDefinition;
  color: string;
  name: string;
  now: (level: number) => string;
  hint: (level: number) => string;
}

const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  speed: {
    icon: faBolt,
    color: "#f59e0b",
    name: "Speedy Sneakers",
    now: (l) => `Speed ${l}`,
    hint: (l) => {
      const next = BIOMES.find((b) => b.speedReq > l);
      return next ? `Speed ${next.speedReq} opens ${next.name}` : "Zoom past every Grumble";
    },
  },
  dash: {
    icon: faForwardFast,
    color: "#f97316",
    name: "Zoom Dash",
    now: (l) => (l ? `Ready every ${dashCooldown(l)}s` : "Not learned yet"),
    hint: (l) => (l ? "Zoom again sooner" : "Adds a ZOOM speed button"),
  },
  hands: {
    icon: faHandSparkles,
    color: "#ec4899",
    name: "Quick Hands",
    now: (l) => (l ? `Lift eggs ${Math.round((1 - handsScale(l)) * 100)}% faster` : "Rare eggs lift slowly"),
    hint: () => "Lift rare eggs faster",
  },
  arms: {
    icon: faDumbbell,
    color: "#0ea5e9",
    name: "Strong Arms",
    now: (l) =>
      armsScale(l) === 0
        ? "Eggs don't slow you down"
        : l
          ? `Eggs feel ${Math.round((1 - armsScale(l)) * 100)}% lighter`
          : "Rare eggs are heavy",
    hint: () => "Heavy eggs slow you less",
  },
  courier: {
    icon: faDove,
    color: "#14b8a6",
    name: "Egg Courier",
    now: (l) => (l ? `Brings an egg every ${courierEvery(l)}s` : "No courier yet"),
    hint: () => "A bird brings eggs home for you",
  },
  jar: {
    icon: faPiggyBank,
    color: "#f472b6",
    name: "Coin Jar",
    now: (l) => `Away: ${Math.round(awayShare(l) * 100)}% for ${fmtTime(awayCap(l))}`,
    hint: () => "Pets earn more while you're away",
  },
  basket: {
    icon: faBasketShopping,
    color: "#fb7185",
    name: "Egg Basket",
    now: (l) => `Carry ${basketSize(l)} egg${basketSize(l) > 1 ? "s" : ""}`,
    hint: () => "Carry more eggs each trip",
  },
  pen: {
    icon: faPaw,
    color: "#22c55e",
    name: "Bigger Pen",
    now: (l) => `Room for ${penSize(l)} pets`,
    hint: () => "More pets means more coins",
  },
  treats: {
    icon: faBone,
    color: "#d97706",
    name: "Pet Treats",
    now: (l) => (l ? `Pets earn ${treatsMult(l)}x coins` : "No treats yet"),
    hint: () => "Every pet earns more coins",
  },
  warm: {
    icon: faFire,
    color: "#ef4444",
    name: "Warm Nests",
    now: (l) => (l ? `Eggs hatch ${Math.round((1 - hatchScale(l)) * 100)}% faster` : "Normal hatching"),
    hint: () => "Eggs hatch faster",
  },
  ripen: {
    icon: faSun,
    color: "#eab308",
    name: "Sun Lamp",
    now: (l) => (l ? `Eggs ripen ${Math.round((1 - ripenScale(l)) * 100)}% faster` : "Rare eggs ripen slowly"),
    hint: () => "Shorter egg countdowns",
  },
  luck: {
    icon: faClover,
    color: "#10b981",
    name: "Lucky Clover",
    now: (l) => `Luck ${l}`,
    hint: () => "Rare eggs show up more often",
  },
  sparkle: {
    icon: faWandMagicSparkles,
    color: "#a855f7",
    name: "Sparkle Charm",
    now: (l) => `${Math.round(shinyChance(l) * 100)}% shiny chance`,
    hint: () => "More Shiny, Golden and Rainbow hatches",
  },
  socks: {
    icon: faSocks,
    color: "#6366f1",
    name: "Tiptoe Socks",
    now: (l) => (l ? `Grumbles wake ${sockBonus(l).toFixed(1)}s slower` : "No socks yet"),
    hint: () => "Grumbles take longer to wake up",
  },
};

export const upgradeName = (id: UpgradeId) => UPGRADES[id].name;

type ShopTab = "upgrades" | "powers" | "hats" | "trails" | "home";

const DECOR_ICON: Record<HomeDecorId, { icon: IconDefinition; color: string }> = {
  garden: { icon: faSeedling, color: "#22c55e" },
  balloons: { icon: faGift, color: "#f43f5e" },
  fountain: { icon: faDroplet, color: "#0ea5e9" },
  slide: { icon: faStairs, color: "#f59e0b" },
  rainbow: { icon: faRainbow, color: "#a855f7" },
  statue: { icon: faMedal, color: "#d97706" },
};

export function ShopBody({
  g,
  playerLook,
  onBuy,
  onHat,
  onTrail,
  onDecor,
  onEquip,
  onRebirth,
}: {
  g: Game;
  playerLook: Look;
  onEquip: (id: PowerEggId) => void;
  onRebirth: () => void;
  onBuy: (id: UpgradeId) => void;
  onHat: (id: HatId) => void;
  onTrail: (id: TrailId) => void;
  onDecor: (id: HomeDecorId) => void;
}) {
  const [tab, setTab] = useState<ShopTab>("upgrades");
  return (
    <>
      <div className="se-wallet">
        <span className="dg-pill" aria-label={`${Math.floor(g.coins)} coins`}>
          <Coin /> {fmtCoins(g.coins)}
        </span>
        <span className="dg-pill" aria-label={`${g.stars} stars`}>
          <StarIcon /> {g.stars}
        </span>
      </div>
      <ChoiceGroup<ShopTab>
        label="Shop section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "upgrades", label: "Upgrades" },
          { value: "powers", label: "Powers" },
          { value: "hats", label: "Hats" },
          { value: "trails", label: "Trails" },
          { value: "home", label: "Home" },
        ]}
      />

      {tab === "upgrades" && (
        <div className="se-list">
          {UPGRADE_IDS.map((id) => {
            const u = UPGRADES[id];
            const level = g.up[id];
            const cost = upgradeCost(id, level);
            const afford = cost !== null && g.coins >= cost;
            return (
              <div className="se-row" key={id}>
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
                    onClick={() => onBuy(id)}
                    aria-label={`Buy ${u.name} for ${fmtCoins(cost)} coins`}>
                    <Coin />
                    {fmtCoins(cost)}
                  </KitButton>
                )}
              </div>
            );
          })}
          <div className="se-row se-rebirth">
            <span className="se-row-icon" style={{ "--tile": "#f59e0b" } as CSSProperties}>
              <FontAwesomeIcon icon={faFeatherPointed} />
            </span>
            <div className="se-row-text">
              <strong>Rebirth</strong>
              <span>
                {g.feathers} Golden {g.feathers === 1 ? "Feather" : "Feathers"}: +
                {Math.round(g.feathers * FEATHER_BONUS * 100)}% coins
              </span>
              <small>
                {canRebirth(g)
                  ? rebirthGain(g) > 0
                    ? `Start over for +${rebirthGain(g)} more`
                    : "Earn more coins first"
                  : "Opens when you reach Starry Space"}
              </small>
            </div>
            <KitButton
              size="sm"
              variant="neutral"
              disabled={!canRebirth(g) || rebirthGain(g) < 1}
              onClick={onRebirth}
              aria-label="Rebirth">
              +{rebirthGain(g)} <FontAwesomeIcon icon={faFeatherPointed} />
            </KitButton>
          </div>
        </div>
      )}

      {tab === "powers" && (
        <>
          <p className="se-tip">
            <FontAwesomeIcon icon={faEgg} /> Power Eggs come from the ancient nest deep in each land's
            grove. Wearing {g.equipped.length} of {equipSlots(g.level)}
            {SLOT_LEVELS.some((l) => l > g.level)
              ? ` (next slot at level ${SLOT_LEVELS.find((l) => l > g.level)})`
              : ""}
            .
          </p>
          <div className="se-list">
            {POWER_EGGS.map((e) => {
              const owned = g.powerEggs.includes(e.id);
              const on = g.equipped.includes(e.id);
              const full = !on && g.equipped.length >= equipSlots(g.level);
              return (
                <div className={cx("se-row", on && "is-on")} key={e.id}>
                  <PowerEggIcon color={e.color} size={52} hidden={!owned} />
                  <div className="se-row-text">
                    <strong>{owned ? e.name : "???"}</strong>
                    <small className="se-wrap">
                      {owned ? e.desc : `Laid by the ancient nest in ${BIOMES[e.biome].name}.`}
                    </small>
                  </div>
                  {owned ? (
                    <KitButton
                      size="sm"
                      variant={on ? "neutral" : undefined}
                      disabled={full}
                      onClick={() => onEquip(e.id)}
                      aria-label={on ? `Take off ${e.name}` : `Wear ${e.name}`}>
                      {on ? "Take off" : "Wear"}
                    </KitButton>
                  ) : (
                    <FontAwesomeIcon icon={faLock} className="se-lock" />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "home" && (
        <>
          <p className="se-tip">
            <FontAwesomeIcon icon={faHouse} /> Decorate your home. Each one makes every pet earn{" "}
            {Math.round(DECOR_BONUS * 100)}% more.
          </p>
          <div className="se-list">
            {HOME_DECOR.map((d) => {
              const placed = g.home.includes(d.id);
              const look = DECOR_ICON[d.id];
              return (
                <div className="se-row" key={d.id}>
                  <span className="se-row-icon" style={{ "--tile": look.color } as CSSProperties}>
                    <FontAwesomeIcon icon={look.icon} />
                  </span>
                  <div className="se-row-text">
                    <strong>{d.name}</strong>
                    <small>{d.desc}</small>
                  </div>
                  {placed ? (
                    <span className="se-max">
                      <FontAwesomeIcon icon={faCheck} /> PLACED
                    </span>
                  ) : (
                    <KitButton
                      size="sm"
                      disabled={g.coins < d.cost}
                      onClick={() => onDecor(d.id)}
                      aria-label={`Buy ${d.name} for ${fmtCoins(d.cost)} coins`}>
                      <Coin />
                      {fmtCoins(d.cost)}
                    </KitButton>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "hats" && (
        <>
          <p className="se-tip">
            <StarIcon /> Earn stars from trophies, the gift chest and hidden secrets.
          </p>
          <div className="se-grid">
            {HATS.map((h) => {
              const owned = g.hats.includes(h.id);
              const wearing = g.hat === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={cx("se-cell", wearing && "is-on", !owned && g.stars < h.cost && "is-locked")}
                  aria-pressed={wearing}
                  aria-label={owned ? `Wear ${h.name}` : `Buy ${h.name} for ${h.cost} stars`}
                  onClick={() => onHat(h.id)}>
                  <PetIcon look={dressed(playerLook, h.id)} size={62} />
                  <span>{h.name}</span>
                  <b>
                    {wearing ? (
                      <>
                        <FontAwesomeIcon icon={faCheck} /> On
                      </>
                    ) : owned ? (
                      "Wear"
                    ) : (
                      <>
                        <StarIcon /> {h.cost}
                      </>
                    )}
                  </b>
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "trails" && (
        <>
          <p className="se-tip">
            <StarIcon /> Trails sparkle behind you as you run.
          </p>
          <div className="se-grid">
            {TRAILS.map((t) => {
              const owned = g.trails.includes(t.id);
              const using = g.trail === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cx("se-cell", using && "is-on", !owned && g.stars < t.cost && "is-locked")}
                  aria-pressed={using}
                  aria-label={owned ? `Use ${t.name}` : `Buy ${t.name} for ${t.cost} stars`}
                  onClick={() => onTrail(t.id)}>
                  <span className={cx("se-trail", `is-${t.shape}`)} aria-hidden>
                    {(t.colors.length ? t.colors : ["transparent"]).slice(0, 4).map((c, i) => (
                      <i key={i} style={{ "--c": c } as CSSProperties} />
                    ))}
                  </span>
                  <span>{t.name}</span>
                  <b>
                    {using ? (
                      <>
                        <FontAwesomeIcon icon={faCheck} /> On
                      </>
                    ) : owned ? (
                      "Use"
                    ) : (
                      <>
                        <StarIcon /> {t.cost}
                      </>
                    )}
                  </b>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Pets ---------- */

export function PetsBody({
  g,
  onFuse,
  onSell,
  onBuddy,
}: {
  g: Game;
  onFuse: (id: string) => void;
  onSell: (id: string) => void;
  onBuddy: (id: string | null) => void;
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
  const buddy = g.pets.find((p) => p.uid === g.buddy);
  const treats = coinMult(g);
  return (
    <>
      <p className="se-tip">
        <FontAwesomeIcon icon={faWandMagicSparkles} /> Fuse {FUSE_COUNT} of the same pet to make a
        rarer one. Tap <FontAwesomeIcon icon={faHeart} /> to pick a buddy.
      </p>
      <div className="se-list">
        {kinds.map((def) => {
          const n = countOf(g, def.id);
          const fusable = canFuse(g, def.id);
          const group = g.pets.filter((p) => p.id === def.id);
          const best = group.reduce((a, b) =>
            VARIANTS[b.v].mult * SIZES[b.s].mult > VARIANTS[a.v].mult * SIZES[a.s].mult ? b : a,
          );
          const bestTag = [SIZES[best.s].name, VARIANTS[best.v].name].filter(Boolean).join(" ");
          const isBuddy = buddy?.id === def.id;
          const rate = group.reduce((sum, p) => sum + petRate(def, p.v, p.s), 0) * treats;
          const price = sellPrice(g, def.id);
          return (
            <div className="se-row" key={def.id}>
              <button
                type="button"
                className={cx("se-row-pet", isBuddy && "is-buddy")}
                aria-pressed={isBuddy}
                aria-label={isBuddy ? `${def.name} is your buddy. Tap to send it back to the pen.` : `Make ${def.name} your buddy`}
                onClick={() => onBuddy(isBuddy ? null : def.id)}>
                <PetIcon look={def.look} size={52} variant={best.v} />
                <b>×{n}</b>
                <i>
                  <FontAwesomeIcon icon={faHeart} />
                </i>
              </button>
              <div className="se-row-text">
                <strong>
                  {noBreak(def.name)}
                </strong>
                <span className="se-row-chips">
                  <RarityChip rarity={def.rarity} />
                  {bestTag && (
                    <span
                      className={cx("se-trait", best.v === 3 && "is-rainbow")}
                      style={{ "--chip": VARIANTS[best.v].color } as CSSProperties}>
                      {bestTag}
                    </span>
                  )}
                </span>
                <small>
                  <Coin /> {fmtCoins(rate)} a second
                </small>
              </div>
              <div className="se-row-actions">
                {def.rarity < 4 && (
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
                  aria-label={`Sell one ${def.name} for ${fmtCoins(price)} coins`}>
                  Sell <Coin />
                  {fmtCoins(price)}
                </KitButton>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Pet Book ---------- */

const ALL_RARITIES: Rarity[] = [0, 1, 2, 3, 4];

function howToGet(def: PetDef): string {
  const land = BIOMES[def.biome].name;
  if (def.rarity === 4) return `Fuse 3 ${petFor(def.biome, 3).name}s to make one.`;
  return `Hatches from ${RARITIES[def.rarity].name} eggs in ${land}.`;
}

export function BookBody({ g }: { g: Game }) {
  const [picked, setPicked] = useState<string | null>(null);
  const def = PETS.find((p) => p.id === picked);
  const found = def ? (g.book[def.id] ?? 0) : 0;
  return (
    <>
      {def && (
        <div
          className="se-card"
          style={{ "--chip": RARITIES[def.rarity].color } as CSSProperties}
          role="status">
          <PetIcon look={def.look} size={84} hidden={!found} mood="happy" variant={found - 1} />
          <div>
            <strong>{found ? noBreak(def.name) : "???"}</strong>
            <RarityChip rarity={def.rarity} />
            {found > 0 && (
              <span className="se-variants" aria-label={`Best one found: ${VARIANTS[found - 1].name || "Normal"}`}>
                {VARIANTS.slice(1).map((v, k) => (
                  <span
                    key={v.name}
                    className={cx("se-trait", found - 1 > k ? "is-on" : "is-off", k === 2 && found === 4 && "is-rainbow")}
                    style={{ "--chip": v.color } as CSSProperties}>
                    {v.name}
                  </span>
                ))}
              </span>
            )}
            <p>{found ? def.blurb : "You haven't met this one yet."}</p>
            <small>
              {howToGet(def)}
              {found > 0 && ` You have ${countOf(g, def.id)}.`}
            </small>
          </div>
        </div>
      )}
      <div className="se-wallet">
        {VARIANTS.slice(1).map((v, k) => (
          <span
            key={v.name}
            className={cx("se-trait", k === 2 && "is-rainbow")}
            style={{ "--chip": v.color } as CSSProperties}>
            {v.name} {PETS.filter((p) => (g.book[p.id] ?? 0) >= k + 2).length}/{PETS.length}
          </span>
        ))}
      </div>
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
                {ALL_RARITIES.map((r) => {
                  const pet = petFor(i, r);
                  const have = g.book[pet.id] ?? 0;
                  return (
                    <button
                      type="button"
                      key={pet.id}
                      className={cx("se-book-cell", have > 0 && "is-found", picked === pet.id && "is-picked")}
                      style={{ "--chip": RARITIES[r].color } as CSSProperties}
                      aria-label={have ? `${pet.name}, ${RARITIES[r].name}` : `Not found yet, ${RARITIES[r].name}`}
                      onClick={() => setPicked(picked === pet.id ? null : pet.id)}>
                      <PetIcon look={pet.look} size={50} hidden={!have} variant={have - 1} />
                      {have > 1 && (
                        <FontAwesomeIcon
                          icon={faStar}
                          className="se-shiny"
                          style={{ color: VARIANTS[Math.min(have - 1, 3)].color }}
                        />
                      )}
                      <span>{have ? noBreak(pet.name) : "???"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Trophies ---------- */

const KIND_STYLE: Record<AchKind, { icon: IconDefinition; color: string }> = {
  egg: { icon: faEgg, color: "#f59e0b" },
  pet: { icon: faPaw, color: "#22c55e" },
  land: { icon: faLocationDot, color: "#0ea5e9" },
  fuse: { icon: faWandMagicSparkles, color: "#a855f7" },
  coin: { icon: faCoins, color: "#eab308" },
  skill: { icon: faPersonRunning, color: "#f97316" },
  care: { icon: faHeart, color: "#f43f5e" },
  style: { icon: faHatWizard, color: "#8b5cf6" },
  upgrade: { icon: faBolt, color: "#14b8a6" },
  secret: { icon: faQuestion, color: "#64748b" },
};

export function TrophiesBody({ g }: { g: Game }) {
  const rows = ACHIEVEMENTS.map((a) => {
    const done = Boolean(g.ach[a.id]);
    const value = Math.min(a.target, Math.max(0, a.progress(g)));
    return { a, done, value, frac: done ? 1 : value / a.target };
  }).sort((x, y) => {
    // Closest-to-done first, then earned, then still-hidden secrets.
    const rank = (r: typeof x) => (r.done ? 1 : r.a.secret ? 2 : 0);
    return rank(x) - rank(y) || y.frac - x.frac;
  });
  const earned = rows.filter((r) => r.done).length;
  return (
    <>
      <div className="se-wallet">
        <span className="dg-pill">
          <StarIcon /> {g.stars} to spend
        </span>
        <span className="dg-pill">
          {earned} of {rows.length} earned
        </span>
      </div>
      <div className="se-list">
        <div className="se-missions">
          <h3>
            <FontAwesomeIcon icon={faBullseye} /> Missions
            <span>
              {MISSION_STREAK - (g.stats.missions % MISSION_STREAK)} more for +{MISSION_STREAK_STARS} <StarIcon />
            </span>
          </h3>
          {g.missions.map((m, i) => {
            const have = missionProgress(g, m);
            const done = m.doneT > 0 || have >= m.target;
            return (
              <div className={cx("se-mission-row", done && "is-done")} key={`${m.kind}-${i}`}>
                <span>{missionText(m.kind, m.target)}</span>
                <span className="se-bar" role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={have}>
                  <i style={{ width: `${(have / m.target) * 100}%` }} />
                  <em>{done ? "Done!" : `${have} / ${m.target}`}</em>
                </span>
              </div>
            );
          })}
        </div>
        {rows.map(({ a, done, value, frac }) => {
          const hidden = a.secret && !done;
          const style = KIND_STYLE[a.kind];
          return (
            <div className={cx("se-row se-trophy", done && "is-done")} key={a.id}>
              <span
                className="se-row-icon"
                style={{ "--tile": done ? "#f59e0b" : hidden ? "#94a3b8" : style.color } as CSSProperties}>
                <FontAwesomeIcon icon={done ? faCheck : hidden ? faQuestion : style.icon} />
              </span>
              <div className="se-row-text">
                <strong>{hidden ? "Secret" : a.name}</strong>
                <small>{hidden ? "Keep exploring to find this one." : a.desc}</small>
                {!done && !hidden && a.target > 1 && (
                  <span className="se-bar" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={value}>
                    <i style={{ width: `${frac * 100}%` }} />
                    <em>
                      {fmtCoins(value)} / {fmtCoins(a.target)}
                    </em>
                  </span>
                )}
              </div>
              <span className="se-reward">
                <StarIcon /> {a.stars}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Map ---------- */

function nestSummary(g: Game, biome: number): string {
  const eggs = g.nests.filter((n) => n.biome === biome && n.egg !== null);
  const ready = eggs.filter((n) => n.ripen <= 0).length;
  return `${ready} ${ready === 1 ? "egg" : "eggs"} ready, ${eggs.length - ready} still ripening`;
}

export function MapBody({
  g,
  onGo,
}: {
  g: Game;
  onGo: (biome: number) => void;
}) {
  const carrying = g.player.carry.length > 0;
  // The countdowns keep running while the map is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const stops = [
    ...BIOMES.map((b, i) => ({ i, name: b.name, color: b.ground, ink: b.ink, req: b.speedReq })).reverse(),
    { i: -1, name: "Home", color: "#a8e083", ink: "#27500f", req: 0 },
  ];
  return (
    <>
      <p className="se-tip">
        <FontAwesomeIcon icon={faMapLocationDot} />{" "}
        {carrying ? "Carry your eggs home on foot first!" : "Hop straight to any land you've opened."}
      </p>
      <div className="se-list">
        {stops.map((s) => {
          const open = g.up.speed >= s.req;
          const here = g.biome === s.i;
          return (
            <div className="se-row" key={s.i}>
              <span className="se-row-icon se-land" style={{ "--tile": s.color, color: s.ink } as CSSProperties}>
                <FontAwesomeIcon icon={s.i < 0 ? faHouse : open ? faLocationDot : faLock} />
              </span>
              <div className="se-row-text">
                <strong>{s.name}</strong>
                <small>
                  {here ? "You are here" : open ? (s.i < 0 ? "Your nests and pen" : `Pets earn ${BIOMES[s.i].mult}x here`) : `Needs Speed ${s.req}`}
                </small>
                {open && s.i >= 0 && g.ancients[s.i] && (
                  <small>
                    {POWER_EGGS[s.i].name}:{" "}
                    {g.ancients[s.i].left > 0 ? `ready in ${fmtTime(g.ancients[s.i].left)}` : "ready now!"}
                  </small>
                )}
                {open && s.i >= 0 && (
                  <span className="se-nests" aria-label={nestSummary(g, s.i)}>
                    {g.nests
                      .filter((n) => n.biome === s.i)
                      .map((n, k) =>
                        n.egg === null ? (
                          <span className="se-nest is-empty" key={k} aria-hidden>
                            <i />
                          </span>
                        ) : (
                          <span className={cx("se-nest", n.ripen > 0 ? "is-waiting" : "is-ready")} key={k} aria-hidden>
                            <EggIcon biome={s.i} rarity={n.egg} size={26} />
                            {n.ripen > 0 ? `${Math.ceil(n.ripen)}s` : <FontAwesomeIcon icon={faCheck} />}
                          </span>
                        ),
                      )}
                  </span>
                )}
              </div>
              <KitButton size="sm" disabled={!open || carrying || here} onClick={() => onGo(s.i)}>
                Go
              </KitButton>
            </div>
          );
        })}
      </div>
    </>
  );
}
