import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGift,
  faHeart,
  faPlay,
  faShieldHeart,
  faTabletScreenButton,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dialog } from "@mui/material";
import type { CSSProperties } from "react";
import Logo from "~/components/Logo";
import { KitButton } from "~/components/game/GameKit";
import { useLocalStorageState } from "~/utils/useLocalStoredState";

/** The site's logo colors, so the dialog matches the brand rather than one game. */
const WELCOME_VARS = {
  "--g-from": "#a78bfa",
  "--g-to": "#f472b6",
} as CSSProperties;

type Fact = {
  icon: IconDefinition;
  label: string;
  /** Light and dark ends of the icon badge, taken from the kit's tokens. */
  from: string;
  to: string;
};

/** The fine print below, as pictures a kid can read at a glance. */
const FACTS: Fact[] = [
  {
    icon: faGift,
    label: "Free to play",
    from: "var(--dg-gold-from)",
    to: "var(--dg-gold)",
  },
  {
    icon: faTabletScreenButton,
    label: "Saves on this device",
    from: "var(--dg-p1-from)",
    to: "var(--dg-p1)",
  },
  {
    icon: faShieldHeart,
    label: "Never tracked",
    from: "var(--dg-p2-from)",
    to: "var(--dg-p2)",
  },
];

export default function Welcome() {
  const {
    value: isWelcomeShown,
    setValue: setIsWelcomeShown,
    isLoading: isWelcomeLoading,
    isError: isWelcomeError,
  } = useLocalStorageState<boolean>("welcome-shown", true);

  const dismiss = () => setIsWelcomeShown(false);

  return (
    <Dialog
      open={isWelcomeShown && !isWelcomeLoading && !isWelcomeError}
      onClose={dismiss}
      aria-labelledby="welcome-title"
      aria-describedby="welcome-note"
      slotProps={{
        backdrop: { className: "dg-welcome-backdrop" },
        paper: {
          className: "dg-vars dg-dialog dg-welcome",
          style: WELCOME_VARS,
        },
      }}>
      <div className="dg-welcome-logo">
        <Logo size={76} />
      </div>

      <h2 id="welcome-title">Welcome to my games!</h2>

      <ul className="dg-welcome-facts">
        {FACTS.map((fact) => (
          <li
            key={fact.label}
            style={
              {
                "--fact-from": fact.from,
                "--fact-to": fact.to,
              } as CSSProperties
            }>
            <span className="dg-welcome-fact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={fact.icon} />
            </span>
            {fact.label}
          </li>
        ))}
      </ul>

      <p id="welcome-note" className="dg-welcome-note">
        These games are free to play. Your game is saved in your browser and
        nothing is ever tracked.
      </p>

      {/* The wrapper carries the entrance animation, so the button's own
          pressed-down transform still works once it has landed. */}
      <div className="dg-welcome-play-wrap">
        <KitButton
          className="dg-welcome-play"
          aria-label="Play"
          onClick={dismiss}>
          <FontAwesomeIcon icon={faPlay} />
        </KitButton>
      </div>

      <p className="dg-welcome-sig">
        <FontAwesomeIcon icon={faHeart} beat style={{ color: "#f43f5e" }} />
        DaniB
      </p>
    </Dialog>
  );
}
