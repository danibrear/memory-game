import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faMinus, faPlus, faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dialog } from "@mui/material";
import {
  useMemo,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
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
}: {
  icon?: IconDefinition;
  color?: string;
  dim?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx("dg-pill", dim && "dg-pill--dim")}
      style={color ? ({ "--pill-color": color } as CSSProperties) : undefined}
      aria-label={label}>
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
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
  children,
}: {
  game: Game;
  open: boolean;
  onClose: () => void;
  icon: IconDefinition;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { className: "dg-vars dg-dialog", style: gameVars(game) },
      }}>
      <div className="dg-dialog-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <h2>{title}</h2>
      {children}
    </Dialog>
  );
}
