import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import elStyles from "~/styles/el.css?url";
import type { Route } from "./+types/el";

export const links: Route.LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap",
  },
  { rel: "stylesheet", href: elStyles },
];

// Unlisted page: keep it out of search results and link previews.
export function meta() {
  return [
    { title: "Games by DaniB" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/** CSS custom properties passed through the `style` prop. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

/** Seeded, so the server and the browser draw exactly the same sky. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const skyRandom = seededRandom(11);
const SKY_STARS: CssVars[] = Array.from({ length: 56 }, () => {
  // Squared so more stars gather near the top, away from the hills.
  const y = skyRandom() ** 2 * 82;
  // Stars that fall behind the letter stay tiny so they never read as stray dots in the words.
  const size = y > 26 ? 1.2 + skyRandom() : 1.5 + skyRandom() * 2.5;
  return {
    "--x": `${(skyRandom() * 100).toFixed(2)}%`,
    "--y": `${y.toFixed(2)}%`,
    "--s": `${size.toFixed(1)}px`,
    "--d": `${(2.6 + skyRandom() * 3.4).toFixed(2)}s`,
    "--w": `${(skyRandom() * -6).toFixed(2)}s`,
  };
});

const STAR_COLORS = ["#ffe9a6", "#ffc2dc", "#cdb8ff", "#a8ecff", "#ffffff"];
const HEART_COLORS = ["#ff3b6b", "#ff7aa8", "#ffb3cf", "#ffd0e2"];
const MAX_TAPPED_STARS = 40;
const HEARTS_PER_TAP = 9;

type Spark = { id: number; kind: "star" | "heart"; style: CssVars };

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 0c.8 7.5 4.5 11.2 12 12-7.5.8-11.2 4.5-12 12-.8-7.5-4.5-11.2-12-12 7.5-.8 11.2-4.5 12-12Z"
      />
    </svg>
  );
}

export default function ElRoute() {
  const skyRef = useRef<HTMLElement>(null);
  const heartRef = useRef<HTMLSpanElement>(null);
  const nextId = useRef(0);
  const [sparks, setSparks] = useState<Spark[]>([]);

  /** Tap anywhere on the sky to leave a star there. */
  const addStar = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(".el-badge")) return;

    const sky = event.currentTarget.getBoundingClientRect();
    const star: Spark = {
      id: nextId.current++,
      kind: "star",
      style: {
        "--x": `${event.clientX - sky.left}px`,
        "--y": `${event.clientY - sky.top}px`,
        "--s": `${between(16, 34).toFixed(0)}px`,
        "--c": pick(STAR_COLORS),
        "--r": `${between(-20, 20).toFixed(0)}deg`,
      },
    };

    setSparks((current) => {
      const next = [...current, star];
      const stars = next.filter((spark) => spark.kind === "star");
      if (stars.length <= MAX_TAPPED_STARS) return next;
      // The sky is full: the oldest tapped star makes room.
      return next.filter((spark) => spark.id !== stars[0].id);
    });
  };

  /** The heart badge sends a burst of hearts up toward the moon. */
  const sendHearts = () => {
    const sky = skyRef.current?.getBoundingClientRect();
    const heart = heartRef.current?.getBoundingClientRect();
    if (!sky || !heart) return;

    const x = heart.left + heart.width / 2 - sky.left;
    const y = heart.top + heart.height / 2 - sky.top;
    const hearts: Spark[] = Array.from({ length: HEARTS_PER_TAP }, () => ({
      id: nextId.current++,
      kind: "heart",
      style: {
        "--x": `${x}px`,
        "--y": `${y}px`,
        "--s": `${between(14, 28).toFixed(0)}px`,
        "--c": pick(HEART_COLORS),
        "--r": `${between(-35, 35).toFixed(0)}deg`,
        "--dx": `${between(-110, 110).toFixed(0)}px`,
        "--dy": `${between(-260, -150).toFixed(0)}px`,
        "--d": `${between(1.1, 1.9).toFixed(2)}s`,
      },
    }));
    setSparks((current) => [...current, ...hearts]);
  };

  const removeSpark = (id: number) =>
    setSparks((current) => current.filter((spark) => spark.id !== id));

  return (
    <main ref={skyRef} className="el-sky" onPointerDown={addStar}>
      <div className="el-stars" aria-hidden="true">
        {SKY_STARS.map((style, i) => (
          <span key={i} className="el-dot" style={style} />
        ))}
      </div>

      <svg
        className="el-hills"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false">
        <path fill="#341d6e" d="M0 120C200 40 380 60 560 110s400 40 640-40v130H0Z" />
        <path fill="#1b1140" d="M0 150c180-50 320 20 520 0s380-60 680-10v60H0Z" />
      </svg>

      <div className="el-sparks" aria-hidden="true">
        {sparks.map((spark) =>
          spark.kind === "star" ? (
            <span key={spark.id} className="el-spark el-spark--star" style={spark.style}>
              <Sparkle />
            </span>
          ) : (
            <span
              key={spark.id}
              className="el-spark el-spark--heart"
              style={spark.style}
              onAnimationEnd={() => removeSpark(spark.id)}>
              <FontAwesomeIcon icon={faHeart} />
            </span>
          ),
        )}
      </div>

      <article className="el-letter">
        <div className="el-top" aria-hidden="true">
          <div className="el-moon" />
          <Sparkle className="el-mystar" />
          <Sparkle className="el-mystar-kid" />
        </div>

        <h1 className="el-hello">Hey baby E!</h1>
        <p className="el-body">
          Hey my love, this is Daddy and I wanted to make this special page just
          for you. I hope you know how proud I am of you and that you're the best
          thing that's ever happened to me. I love you to the moon and back,
          forever and always. I can't wait to see all the amazing things you'll do
          as you grow up. You're my little star, shining so bright!
        </p>
        <p className="el-sign">
          With all my love,
          <br />
          Daddy.
        </p>

        <div className="el-badge-row">
          <button type="button" className="el-badge" onClick={sendHearts}>
            <span>DB</span>
            <span ref={heartRef} className="el-heart">
              <FontAwesomeIcon icon={faHeart} />
            </span>
            <span>'s EB</span>
          </button>
        </div>
      </article>
    </main>
  );
}
