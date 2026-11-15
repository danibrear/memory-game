// ─── Sneaky Eggs: the Home part of the Shop ─────────────────────────────────
//
// Three pages: the house (grow it, paint it), the special buildings, and the
// decorations around the pen. Builds run on real time, so this page ticks once
// a second while it is open.

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCheck,
  faClock,
  faDroplet,
  faGift,
  faHammer,
  faHouseChimney,
  faLock,
  faMedal,
  faPaintRoller,
  faRainbow,
  faSeedling,
  faStairs,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChoiceGroup, KitButton } from "~/components/game/GameKit";
import {
  BAKE_EVERY,
  BARN_SPACE,
  BUILDINGS,
  BUILDING_MAX,
  CAKE_FRENZY,
  DECOR_BONUS,
  HATCHERY_SCALE,
  HOME_DECOR,
  HOUSE_MAX,
  HOUSE_TIERS,
  MILL_HOURS,
  MILL_SHARE,
  PAINTS,
  SPARKLE_MULT,
  WELL_EVERY,
  WELL_HOLD,
  WORKSHOP_BUILDERS,
  WORKSHOP_SPEED,
  fmtCoins,
  fmtCountdown,
  fmtDuration,
  houseNeeded,
  siteCost,
  type BuildingId,
  type HomeDecorId,
  type HousePaint,
  type PaintSlot,
  type SiteId,
} from "~/games/eggs/config";
import {
  buildBlock,
  buildSeconds,
  builderCount,
  freeBuilders,
  jobFor,
  jobLeft,
  jobProgress,
  nextIn,
  ownsPaint,
  rushCost,
  siteLevel,
  stockOf,
  type Game,
} from "~/games/eggs/engine";
import { paintBuildingIcon, paintHouseIcon } from "~/games/eggs/render";
import { Coin, StarIcon, cx } from "./Menus";

export type HomeTab = "house" | "buildings" | "decor";

/* ---------- Little pictures ---------- */

export function HouseIcon({ tier, paint, size }: { tier: number; paint: HousePaint | null; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wall = paint?.wall;
  const roof = paint?.roof;
  const top = paint?.top;
  useEffect(() => {
    if (ref.current) paintHouseIcon(ref.current, tier, wall && roof && top ? { wall, roof, top } : null, size);
  }, [tier, wall, roof, top, size]);
  return <canvas ref={ref} className="se-icon" style={{ width: size, height: size }} aria-hidden />;
}

export function BuildingIcon({ id, level, size, dim }: { id: BuildingId; level: number; size: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintBuildingIcon(ref.current, id, level, size);
  }, [id, level, size]);
  return (
    <canvas
      ref={ref}
      className={cx("se-icon", dim && "is-dim")}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

/* ---------- Words ---------- */

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** What a building does at a level, in a few words. */
function effect(id: BuildingId, lv: number): string {
  switch (id) {
    case "mill":
      return `Saves up ${pct(MILL_SHARE[lv])} extra coins for ${fmtDuration(MILL_HOURS[lv] * 3600)}`;
    case "bakery":
      return `A cupcake every ${fmtDuration(BAKE_EVERY[lv])}: double coins for ${CAKE_FRENZY[lv]}s`;
    case "well":
      return `A star every ${fmtDuration(WELL_EVERY[lv])}, holds ${WELL_HOLD[lv]}`;
    case "workshop":
      return WORKSHOP_SPEED[lv] < 1
        ? `${WORKSHOP_BUILDERS[lv]} builders, ${pct(1 - WORKSHOP_SPEED[lv])} faster`
        : `${WORKSHOP_BUILDERS[lv]} builders`;
    case "barn":
      return `Room for ${BARN_SPACE[lv]} more pets`;
    case "hatchery":
      return `Eggs hatch ${pct(1 - HATCHERY_SCALE[lv])} faster`;
    case "sparkle":
      return `${pct(SPARKLE_MULT[lv] - 1)} more Shiny, Golden and Rainbow pets`;
  }
}

const DECOR_ICON: Record<HomeDecorId, { icon: IconDefinition; color: string }> = {
  garden: { icon: faSeedling, color: "#22c55e" },
  balloons: { icon: faGift, color: "#f43f5e" },
  fountain: { icon: faDroplet, color: "#0ea5e9" },
  slide: { icon: faStairs, color: "#f59e0b" },
  rainbow: { icon: faRainbow, color: "#a855f7" },
  statue: { icon: faMedal, color: "#d97706" },
};

const PAINT_LABEL: Record<PaintSlot, string> = { wall: "Walls", roof: "Roof", top: "On top" };

/* ---------- Pieces ---------- */

/** A build in progress: a bar with the time left, and a button to finish it with stars. */
function Working({
  g,
  site,
  now,
  onRush,
}: {
  g: Game;
  site: SiteId;
  now: number;
  onRush: (site: SiteId) => void;
}) {
  const job = jobFor(g, site);
  if (!job) return null;
  const cost = rushCost(g, site, now);
  return (
    <div className="se-working">
      <div className="se-bar" role="progressbar" aria-label="Build progress" aria-valuenow={Math.round(jobProgress(job, now) * 100)}>
        <i style={{ width: `${jobProgress(job, now) * 100}%` }} />
        <em>{fmtCountdown(jobLeft(job, now))}</em>
      </div>
      <KitButton
        size="sm"
        variant="neutral"
        disabled={g.stars < cost}
        onClick={() => onRush(site)}
        aria-label={`Finish now for ${cost} ${cost === 1 ? "star" : "stars"}`}>
        Finish <StarIcon /> {cost}
      </KitButton>
    </div>
  );
}

/** The button that starts a build: price on top, how long it takes underneath. */
function BuildButton({
  g,
  site,
  onStart,
}: {
  g: Game;
  site: SiteId;
  onStart: (site: SiteId) => void;
}) {
  const next = siteLevel(g, site) + 1;
  const cost = siteCost(site, next);
  const block = buildBlock(g, site);
  return (
    <div className="se-buildbtn">
      <KitButton
        size="sm"
        disabled={block !== "ok"}
        onClick={() => onStart(site)}
        aria-label={`Build for ${fmtCoins(cost)} coins, takes ${fmtDuration(buildSeconds(g, site, next))}`}>
        <Coin />
        {fmtCoins(cost)}
      </KitButton>
      <small>
        {block === "builder" ? (
          "Builders busy"
        ) : (
          <>
            <FontAwesomeIcon icon={faClock} /> {fmtDuration(buildSeconds(g, site, next))}
          </>
        )}
      </small>
    </div>
  );
}

/* ---------- The Home page ---------- */

export function HomeBody({
  g,
  focus,
  onStart,
  onRush,
  onCollect,
  onPaint,
  onDecor,
  onTick,
}: {
  g: Game;
  /** The site that was tapped in the world, if that's how we got here. */
  focus: SiteId | null;
  onStart: (site: SiteId) => void;
  onRush: (site: SiteId) => void;
  onCollect: (id: BuildingId) => void;
  onPaint: (slot: PaintSlot, id: string) => void;
  onDecor: (id: HomeDecorId) => void;
  /** Called once a second so builds can finish while the game is paused behind the menu. */
  onTick: () => void;
}) {
  const [tab, setTab] = useState<HomeTab>(focus && focus !== "house" ? "buildings" : "house");
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const tier = g.town.house;
  const house = HOUSE_TIERS[tier];
  const nextHouse = tier < HOUSE_MAX ? HOUSE_TIERS[tier + 1] : null;
  const busy = g.town.jobs.length;
  const builders = builderCount(g);

  return (
    <>
      <div className="se-hometabs">
        <ChoiceGroup<HomeTab>
          label="Home section"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "house",
              icon: faHouseChimney,
              label: <>House{buildBlock(g, "house") === "ok" && <i className="se-dot" />}</>,
            },
            {
              value: "buildings",
              icon: faHammer,
              label: (
                <>
                  Buildings
                  {BUILDINGS.some((b) => buildBlock(g, b.id) === "ok" || stockOf(g, b.id) > 0) && (
                    <i className="se-dot" />
                  )}
                </>
              ),
            },
            {
              value: "decor",
              icon: faSeedling,
              label: (
                <>
                  Decor
                  {HOME_DECOR.some((d) => !g.home.includes(d.id) && g.coins >= d.cost) && <i className="se-dot" />}
                </>
              ),
            },
          ]}
        />
      </div>

      {tab !== "decor" && (
        <p className="se-tip">
          <FontAwesomeIcon icon={faHammer} />{" "}
          {busy === 0
            ? builders === 1
              ? "Your builder is free."
              : `All ${builders} builders are free.`
            : freeBuilders(g) > 0
              ? `${freeBuilders(g)} of ${builders} builders free.`
              : builders === 1
                ? "Your builder is busy. Tap the building site to hurry it along!"
                : "All your builders are busy. Tap a building site to hurry it along!"}
        </p>
      )}

      {tab === "house" && (
        <div className="se-list">
          <div className="se-house">
            <HouseIcon tier={tier} paint={g.town.paint} size={124} />
            <div className="se-row-text">
              <strong>{house.name}</strong>
              <span>{house.coins > 0 ? `Every pet earns ${pct(house.coins)} more` : "Home sweet home"}</span>
              <small className="se-wrap">{house.blurb}</small>
            </div>
          </div>

          {nextHouse ? (
            <div className={cx("se-row se-site", focus === "house" && "is-on")}>
              <HouseIcon tier={tier + 1} paint={g.town.paint} size={58} />
              <div className="se-row-text">
                <strong>{jobFor(g, "house") ? `Building the ${nextHouse.name}` : `Build the ${nextHouse.name}`}</strong>
                <span>Every pet earns {pct(nextHouse.coins)} more</span>
                <small className="se-wrap">Opens new buildings and higher building levels.</small>
                <Working g={g} site="house" now={now} onRush={onRush} />
              </div>
              {!jobFor(g, "house") && <BuildButton g={g} site="house" onStart={onStart} />}
            </div>
          ) : (
            <p className="se-tip">
              <FontAwesomeIcon icon={faCheck} /> Your house is as grand as it gets!
            </p>
          )}

          {(["wall", "roof", "top"] as PaintSlot[]).map((slot) => (
            <div className="se-paint" key={slot}>
              <h3>
                <FontAwesomeIcon icon={faPaintRoller} /> {PAINT_LABEL[slot]}
              </h3>
              <div className="se-swatches">
                {PAINTS[slot].map((p) => {
                  const owned = ownsPaint(g, slot, p.id);
                  const on = g.town.paint[slot] === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cx("se-swatch", on && "is-on", !owned && g.stars < p.cost && "is-locked")}
                      style={{ "--c": p.color ?? "var(--dg-surface)" } as CSSProperties}
                      aria-pressed={on}
                      aria-label={owned ? p.name : `${p.name}, ${p.cost} stars`}
                      onClick={() => onPaint(slot, p.id)}>
                      {slot === "top" ? (
                        <HouseIcon tier={0} paint={{ wall: "cream", roof: "berry", top: p.id }} size={40} />
                      ) : (
                        <i />
                      )}
                      <span>{p.name}</span>
                      <b>
                        {on ? (
                          <FontAwesomeIcon icon={faCheck} />
                        ) : owned ? (
                          "Use"
                        ) : (
                          <>
                            <StarIcon /> {p.cost}
                          </>
                        )}
                      </b>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "buildings" && (
        <div className="se-list">
          {BUILDINGS.map((b) => {
            const lv = g.town.lv[b.id];
            const job = jobFor(g, b.id);
            const block = buildBlock(g, b.id);
            const need = houseNeeded(b.id, lv + 1);
            const stock = stockOf(g, b.id);
            const wait = lv > 0 ? nextIn(g, b.id, now) : 0;
            const locked = lv === 0 && !job && block === "house";
            return (
              <div
                className={cx("se-row se-site", focus === b.id && "is-on")}
                key={b.id}
                ref={focus === b.id ? focusRef : undefined}>
                <BuildingIcon id={b.id} level={lv} size={58} dim={locked} />
                <div className="se-row-text">
                  <strong>
                    {b.name}
                    {lv > 0 && <em className="se-lv">Lv {lv}</em>}
                  </strong>
                  <span>{lv > 0 ? effect(b.id, lv) : b.desc}</span>
                  {job ? (
                    <Working g={g} site={b.id} now={now} onRush={onRush} />
                  ) : (
                    <small className="se-wrap">
                      {block === "max"
                        ? "As good as it gets!"
                        : block === "house"
                          ? `Needs the ${HOUSE_TIERS[need].name}`
                          : lv > 0
                            ? `Next: ${effect(b.id, lv + 1)}`
                            : `First: ${effect(b.id, 1)}`}
                    </small>
                  )}
                  {lv > 0 && !job && (stock > 0 || wait > 0) && (
                    <span className="se-stock">
                      {stock > 0 && (
                        <KitButton
                          size="sm"
                          variant="neutral"
                          onClick={() => onCollect(b.id)}
                          aria-label={`Collect from the ${b.name}`}>
                          {b.id === "mill" ? (
                            <>
                              Collect <Coin /> {fmtCoins(stock)}
                            </>
                          ) : b.id === "well" ? (
                            <>
                              Collect <StarIcon /> {stock}
                            </>
                          ) : (
                            <>Eat a cupcake{stock > 1 ? ` (${stock})` : ""}</>
                          )}
                        </KitButton>
                      )}
                      {wait > 0 && (
                        <small>
                          <FontAwesomeIcon icon={faClock} /> Next in {fmtCountdown(wait)}
                        </small>
                      )}
                    </span>
                  )}
                </div>
                {job ? null : block === "max" ? (
                  <span className="se-max">MAX</span>
                ) : block === "house" ? (
                  <FontAwesomeIcon icon={faLock} className="se-lock" />
                ) : (
                  <BuildButton g={g} site={b.id} onStart={onStart} />
                )}
              </div>
            );
          })}
          <p className="se-tip">
            Buildings go up to level {BUILDING_MAX}. A bigger house lets them grow taller.
          </p>
        </div>
      )}

      {tab === "decor" && (
        <>
          <p className="se-tip">
            <FontAwesomeIcon icon={faSeedling} /> Decorate around the pen. Each one makes every pet earn{" "}
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
    </>
  );
}
