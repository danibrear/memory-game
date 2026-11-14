import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faMinus, faPlus, faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dialog } from "@mui/material";
import {
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import GameIconTile from "~/components/GameIconTile";
import { GAMES, type Game } from "~/gameCatalog";

/**
 * Shared, polished building blocks for the classic games.
 * Styles live in app/game-kit.css (classes prefixed `dg-`).
 */

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Unknown game id: ${id}`);
  return game;
}

function gameVars(game: Game): CSSProperties {
  return {
    "--g-from": game.colors.from,
    "--g-to": game.colors.to,
  } as CSSProperties;
}

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Motion helpers ---------- */

/** True when the player has asked their device for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** The visible text of a node, used to notice when a shown value changes. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "bigint"
  ) {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/**
 * Replays the `dg-bump` pop on the returned ref's element every time `value`
 * changes (never on first render).
 */
export function useBump<T extends HTMLElement>(value: unknown, enabled = true) {
  const ref = useRef<T>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const el = ref.current;
    if (!el || !enabled) return;
    el.classList.remove("is-bump");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("is-bump");
  }, [value, enabled]);
  return ref;
}

/** A number (or short label) that pops whenever it changes. */
export function Bump({
  value,
  className,
  children,
}: {
  /** What to watch. Defaults to the text of `children`. */
  value?: unknown;
  className?: string;
  children: ReactNode;
}) {
  const ref = useBump<HTMLSpanElement>(value ?? textOf(children));
  return (
    <span ref={ref} className={cx("dg-bump", className)}>
      {children}
    </span>
  );
}

/** Counts up from 0 to `value`. Used for scores and stats on win screens. */
export function CountUp({
  value,
  duration = 900,
  delay = 350,
}: {
  value: number;
  /** Longest the count may take, in ms. Small numbers finish sooner. */
  duration?: number;
  delay?: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value <= 0 || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const total = Math.min(duration, 180 + value * 60);
    const start = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / total));
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);
  return <span className="dg-count">{shown}</span>;
}

export interface DealOptions {
  /** Deal the descendants matching this selector (default: direct children). */
  selector?: string;
  /** Column count of a grid: deals in a diagonal wave instead of one by one. */
  cols?: number;
  /** Gap between items in ms. Shrinks so the whole deal fits in `maxTotal`. */
  step?: number;
  duration?: number;
  maxTotal?: number;
}

/**
 * Deals a board in: each item under `ref` pops up in turn whenever `dealKey`
 * changes while the board is on screen. Uses the Web Animations API, so it
 * never fights the CSS animations (shake, match pop) on the same elements.
 */
export function useDealIn(
  ref: RefObject<HTMLElement | null>,
  dealKey: unknown,
  { selector, cols, step = 45, duration = 360, maxTotal = 520 }: DealOptions = {},
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const items = Array.from(
      selector ? root.querySelectorAll<HTMLElement>(selector) : root.children,
    ) as HTMLElement[];
    if (!items.length || typeof items[0].animate !== "function") return;
    const order = (i: number) => (cols ? Math.floor(i / cols) + (i % cols) : i);
    const gap = Math.min(step, maxTotal / Math.max(1, order(items.length - 1)));
    const anims = items.map((el, i) =>
      el.animate(
        // Only the starting pose: each item settles into whatever it should be.
        [{ offset: 0, opacity: 0, transform: "translateY(18px) scale(0.55)" }],
        {
          duration,
          delay: order(i) * gap,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          fill: "backwards",
        },
      ),
    );
    return () => anims.forEach((a) => a.cancel());
    // Options are read fresh on each deal; only a new deal should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);
}

/* ---------- Layout ---------- */

export function GameShell({
  game,
  children,
}: {
  game: Game;
  children: ReactNode;
}) {
  return (
    <div className="dg-vars dg-shell" style={gameVars(game)}>
      {children}
    </div>
  );
}

export function StartScreen({
  game,
  title,
  subtitle,
  children,
}: {
  game: Game;
  title?: string;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="dg-start">
      <div className="dg-hero">
        <GameIconTile game={game} size={104} />
      </div>
      <h1 className="dg-title">{title ?? game.name}</h1>
      <p className="dg-subtitle">{subtitle}</p>
      {children}
    </div>
  );
}

export function Panel({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="dg-panel">
      {label && <span className="dg-label">{label}</span>}
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */

type KitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "neutral" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconDefinition;
  iconEnd?: IconDefinition;
  round?: boolean;
};

export function KitButton({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  round,
  className,
  children,
  type = "button",
  ...rest
}: KitButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "dg-btn",
        `dg-btn--${variant}`,
        size !== "md" && `dg-btn--${size}`,
        round && "dg-btn--round",
        className,
      )}
      {...rest}>
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
      {iconEnd && <FontAwesomeIcon icon={iconEnd} />}
    </button>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  children,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="dg-stepper" role="group" aria-label={label}>
      <KitButton
        round
        variant="neutral"
        icon={faMinus}
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      />
      <div className="dg-stepper-value" aria-live="polite">
        {children}
      </div>
      <KitButton
        round
        variant="neutral"
        icon={faPlus}
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      />
    </div>
  );
}

export interface Choice<T> {
  value: T;
  label: ReactNode;
  icon?: IconDefinition;
  title?: string;
}

export function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="dg-seg" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className="dg-seg-btn"
          aria-pressed={opt.value === value}
          title={opt.title}
          onClick={() => onChange(opt.value)}>
          {opt.icon && <FontAwesomeIcon icon={opt.icon} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- HUD ---------- */

export function StatPill({
  icon,
  color,
  dim,
  children,
  label,
  bump = true,
}: {
  icon?: IconDefinition;
  color?: string;
  dim?: boolean;
  label?: string;
  /** Pop the value when it changes. Turn off if the content animates itself. */
  bump?: boolean;
  children: ReactNode;
}) {
  const valueRef = useBump<HTMLSpanElement>(textOf(children), bump);
  return (
    <span
      className={cx("dg-pill", dim && "dg-pill--dim")}
      style={color ? ({ "--pill-color": color } as CSSProperties) : undefined}
      aria-label={label}>
      {icon && <FontAwesomeIcon icon={icon} />}
      <span ref={valueRef} className="dg-bump">
        {children}
      </span>
    </span>
  );
}

export type BannerTone =
  | "game"
  | "p1"
  | "p2"
  | "good"
  | "bad"
  | "gold"
  | "soft";

export function Banner({
  tone = "game",
  icon,
  children,
}: {
  tone?: BannerTone;
  icon?: IconDefinition;
  children: ReactNode;
}) {
  return (
    <span
      className={cx("dg-banner", tone !== "game" && `dg-banner--${tone}`)}
      role="status">
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
    </span>
  );
}

/* ---------- Celebration ---------- */

export function Stars({ count, total = 3 }: { count: number; total?: number }) {
  return (
    <div className="dg-stars" aria-label={`${count} out of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <FontAwesomeIcon
          key={i}
          icon={faStar}
          className={cx("dg-star", i < count && "dg-star--lit")}
        />
      ))}
    </div>
  );
}

const CONFETTI_COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#38bdf8",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const w = 7 + Math.random() * 7;
        return {
          left: `${Math.random() * 100}%`,
          "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--w": `${w}px`,
          "--h": `${w * (1.2 + Math.random() * 0.8)}px`,
          "--dx": `${(Math.random() - 0.5) * 180}px`,
          "--rot": `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540)}deg`,
          "--dur": `${2.4 + Math.random() * 1.8}s`,
          "--delay": `${Math.random() * 0.9}s`,
        } as CSSProperties;
      }),
    [pieces],
  );
  return (
    <div className="dg-confetti" aria-hidden>
      {bits.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

export function WinScreen({
  icon,
  iconColor,
  title,
  subtitle,
  confetti = true,
  children,
}: {
  icon: IconDefinition;
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  confetti?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="dg-win">
      {confetti && <Confetti />}
      <div
        className="dg-win-icon"
        style={
          iconColor ? ({ "--win-color": iconColor } as CSSProperties) : undefined
        }>
        <FontAwesomeIcon icon={icon} />
      </div>
      <h1 className="dg-title">{title}</h1>
      {subtitle && <p className="dg-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}

/* ---------- Dialog ---------- */

export function KitDialog({
  game,
  open,
  onClose,
  icon,
  title,
  className,
  children,
}: {
  game: Game;
  open: boolean;
  onClose: () => void;
  icon: IconDefinition;
  title: ReactNode;
  /** Extra class for the dialog surface, e.g. to make a roomier menu. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { className: cx("dg-vars dg-dialog", className), style: gameVars(game) },
      }}>
      <div className="dg-dialog-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <h2>{title}</h2>
      {children}
    </Dialog>
  );
}
