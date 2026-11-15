// ─── Sneaky Eggs: the FanScout house ad ─────────────────────────────────────
//
// A branded card that plays through a few slides. Each finished slide unlocks
// one reward on the track underneath, so the longer a player watches, the more
// they take home. The screen that opens it decides what the rewards are.

import { faCheck, faLock, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import { KitButton, KitDialog } from "~/components/game/GameKit";
import type { Game as CatalogGame } from "~/gameCatalog";
import { AD_SLIDE_TIME } from "~/games/eggs/config";
import { AD_SLIDES, FANSCOUT, FANSCOUT_MARK, fanscoutUrl } from "~/games/eggs/fanscout";
import { cx, StarIcon } from "./Menus";

/** The winged-F mark. It takes the text colour, so it works on any fill. */
export function FanScoutMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="70 70 372 372"
      aria-hidden
      focusable="false">
      <path d={FANSCOUT_MARK} fill="currentColor" />
    </svg>
  );
}

/** The app icon: the white mark on FanScout green. */
export function FanScoutTile({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx("se-fs-tile", className)}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      aria-hidden>
      <FanScoutMark size={size * 0.74} />
    </span>
  );
}

/** One thing the ad pays out, and how many seconds of watching it takes. */
export interface AdOffer {
  id: string;
  at: number;
  name: string;
  desc: string;
  icon: IconDefinition;
}

/** Map pins and the arcs between them, as on FanScout's share card. Decoration only. */
function Pins() {
  const pin = "M0 -15a9 9 0 0 1 9 9c0 6-9 15-9 15s-9-9-9-15a9 9 0 0 1 9-9zm0 5.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 0 0 0-6.8z";
  return (
    <svg className="se-fs-pins" viewBox="176 46 140 126" preserveAspectRatio="xMaxYMid meet" aria-hidden>
      <path d="M196 150Q214 86 292 112" />
      <path d="M196 150Q196 96 246 76" />
      <path d="M246 76Q276 70 292 112" />
      <g transform="translate(292 112) scale(1.45)">
        <path className="is-big" d={pin} />
      </g>
      <g transform="translate(246 76) scale(0.9)">
        <path d={pin} />
      </g>
      <g transform="translate(196 150) scale(0.75)">
        <path d={pin} />
      </g>
    </svg>
  );
}

export function FanScoutAd({
  game,
  open,
  placement,
  offers,
  visitStars = 0,
  onVisit,
  onClose,
}: {
  game: CatalogGame;
  open: boolean;
  /** Which spot in the game opened the ad. It rides along on the link to FanScout. */
  placement: string;
  offers: AdOffer[];
  /** Stars on offer for tapping through to FanScout today, or 0. */
  visitStars?: number;
  onVisit: () => void;
  /** Called with the seconds watched. The opener pays out whatever that has earned. */
  onClose: (seconds: number) => void;
}) {
  const [ms, setMs] = useState(0);
  const msRef = useRef(0);
  const length = offers.length ? offers[offers.length - 1].at : 0;

  useEffect(() => {
    if (!open) return;
    msRef.current = 0;
    setMs(0);
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Only time spent actually looking at the ad counts.
      if (document.visibilityState === "visible") {
        msRef.current = Math.min(length * 1000, msRef.current + Math.min(250, now - last));
        setMs(msRef.current);
      }
      last = now;
    }, 100);
    return () => clearInterval(id);
  }, [open, length]);

  const secs = ms / 1000;
  const unlocked = offers.filter((o) => secs >= o.at).length;
  const next = offers[unlocked];
  const done = unlocked === offers.length;
  const slideIdx = Math.floor(secs / AD_SLIDE_TIME) % AD_SLIDES.length;
  const slide = AD_SLIDES[slideIdx];
  const close = () => onClose(msRef.current / 1000);

  return (
    <KitDialog
      game={game}
      open={open}
      onClose={close}
      icon={faCheck}
      title={offers.length > 1 ? "Watch and win boosts" : "Watch and win"}
      className="se-fs-dialog">
      <div className="se-fs-card">
        <Pins />
        <div className="se-fs-head">
          <FanScoutTile size={44} />
          <strong className="se-fs-word">{FANSCOUT.name}</strong>
          <small className="se-fs-tag">Ad · from the maker of this game</small>
        </div>
        <div className="se-fs-slide" key={slideIdx}>
          <span className="se-fs-eyebrow">{slide.eyebrow}</span>
          <p className="se-fs-title">
            {slide.title[0]} <em>{slide.title[1]}</em>
          </p>
          <p className="se-fs-body">{slide.body}</p>
        </div>
        <div className="se-fs-foot">
          <div className="se-fs-dots" aria-hidden>
            {AD_SLIDES.map((_, i) => (
              <i key={i} className={cx(i === slideIdx && "is-on")} />
            ))}
          </div>
          <a
            className="se-fs-cta"
            href={fanscoutUrl(placement)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onVisit}>
            <span className="se-fs-dot" aria-hidden />
            {FANSCOUT.site}
            {visitStars > 0 && (
              <b>
                +{visitStars} <StarIcon />
              </b>
            )}
          </a>
        </div>
      </div>

      <ol className="se-fs-track">
        {offers.map((o, i) => {
          const got = secs >= o.at;
          const left = Math.ceil(o.at - secs);
          return (
            <li key={o.id} className={cx(got && "is-got", i === unlocked && "is-next")}>
              <span className="se-fs-ico">
                <FontAwesomeIcon icon={got ? faCheck : o.icon} />
              </span>
              <span className="se-fs-rtext">
                <b>{o.name}</b>
                <small>{o.desc}</small>
              </span>
              <span className="se-fs-when">
                {got ? "Yours!" : i === unlocked ? `${left}s` : <FontAwesomeIcon icon={faLock} />}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="se-fs-bar" aria-hidden>
        <i style={{ width: `${length ? Math.min(100, (secs / length) * 100) : 0}%` }} />
      </div>

      <div className="dg-row">
        {unlocked === 0 ? (
          <>
            <KitButton variant="neutral" onClick={close}>
              No thanks
            </KitButton>
            <KitButton disabled>{next ? `Boost in ${Math.ceil(next.at - secs)}...` : "..."}</KitButton>
          </>
        ) : (
          <KitButton onClick={close}>
            {offers.length === 1
              ? "Collect!"
              : done
                ? `Collect all ${offers.length}!`
                : `Collect ${unlocked} now`}
          </KitButton>
        )}
      </div>
      {unlocked > 0 && !done && next && (
        <span className="dg-caption">
          Keep watching: {next.name} in {Math.ceil(next.at - secs)}s
        </span>
      )}
    </KitDialog>
  );
}
