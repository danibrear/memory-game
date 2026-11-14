import {
  faArrowRight,
  faArrowsRotate,
  faCookieBite,
  faFaceSadTear,
  faMedal,
  faPlay,
  faPlus,
  faRotateLeft,
  faStar,
  faTrophy,
  faVolumeHigh,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Banner,
  CountUp,
  GameShell,
  getGame,
  KitButton,
  KitDialog,
  Panel,
  prefersReducedMotion,
  StartScreen,
  StatPill,
  Stars,
  WinScreen,
} from "~/components/game/GameKit";
import { setMuted, sfx, unlockAudio } from "~/games/munch/audio";
import {
  addExtraSlot,
  BASE_SLOTS,
  buildRun,
  dispatch,
  freeSlot,
  levelTitle,
  pictureFor,
  starsFor,
  step,
  type Munchy,
  type MunchyMode,
  type Run,
} from "~/games/munch/engine";
import { PALETTE, type ColorKey } from "~/games/munch/levels";
import { drawBoard, drawFlights, drawPreview, shade } from "~/games/munch/render";
import { getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/munch";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Munch Bunch - Games by DaniB" },
    {
      name: "description",
      content:
        "Send hungry Munchies to gobble a pixel picture, one color at a time, from the bottom up!",
    },
  ];
}

const STORAGE_KEY = "munch-bunch";
/** Vertical space taken by everything on the play screen except the board. */
const RESERVED_HEIGHT = 500;
const MAX_BOARD_WIDTH = 452;

type Phase = "START" | "PLAYING" | "STUCK" | "WON";

interface Saved {
  level: number;
  muted: boolean;
  /** Best stars per level index. */
  stars: Record<number, number>;
}

const DEFAULT_SAVE: Saved = { level: 0, muted: false, stars: {} };

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** How long a Munchy takes to hop from its queue to a munch spot. */
const HOP_MS = 420;
/** How long the rest of the queue takes to shuffle forward. */
const QUEUE_SLIDE_MS = 300;

/** A send in progress: where that column's Munchies were just before it. */
interface PendingSend {
  column: number;
  sentId: number;
  before: Map<number, DOMRect>;
}

const centerOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * Path for a Munchy that starts (dx, dy) away from its spot: an arc through the
 * air, leaning into the jump, then a little squash as it lands.
 */
function hopFrames(dx: number, dy: number): Keyframe[] {
  const lift = Math.min(72, 30 + Math.hypot(dx, dy) * 0.16);
  const lean = dx > 0 ? -1 : 1;
  const AIR = 0.76; // share of the time spent in the air; the rest is the landing
  const STEPS = 8;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const e = t * t * (3 - 2 * t);
    const x = dx * (1 - e);
    const y = dy * (1 - e) - lift * Math.sin(Math.PI * t);
    const tilt = lean * 12 * Math.sin(Math.PI * t);
    frames.push({
      offset: t * AIR,
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(1, 1)`,
    });
  }
  frames.push({ offset: 0.88, transform: "translate(0px, 3px) rotate(0deg) scale(1.16, 0.84)" });
  frames.push({ offset: 1, transform: "translate(0px, 0px) rotate(0deg) scale(1, 1)" });
  return frames;
}

function MunchyView({
  c,
  count,
  mode = "idle",
  mini,
  done,
  elRef,
}: {
  c: ColorKey;
  count?: number;
  mode?: MunchyMode;
  mini?: boolean;
  done?: boolean;
  elRef?: (el: HTMLDivElement | null) => void;
}) {
  const col = PALETTE[c];
  const style = {
    "--c": col,
    "--hi": shade(col, 0.6),
    "--dk": shade(col, -0.28),
    "--dk2": shade(col, -0.5),
  } as CSSProperties;
  return (
    <div
      ref={elRef}
      className={cx(
        "mb-munchy",
        mini && "is-mini",
        mode === "eating" && "is-eating",
        mode === "waiting" && "is-waiting",
        done && "is-done",
      )}
      style={style}
      aria-hidden>
      <span className="mb-feet">
        <i />
        <i />
      </span>
      <span className="mb-body" />
      <span className="mb-shine" />
      <span className="mb-eyes">
        <i />
        <i />
      </span>
      <span className="mb-mouth" />
      <span className="mb-zz">z z</span>
      {count !== undefined && <span className="mb-badge">{count}</span>}
    </div>
  );
}

function PicturePreview({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const picture = pictureFor(index);
  const rows = picture.art.length;
  const cols = Math.max(...picture.art.map((r) => r.length));
  const cell = Math.floor(Math.min(150 / cols, 150 / rows));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cols * cell * dpr;
    canvas.height = rows * cell * dpr;
    drawPreview(canvas.getContext("2d")!, picture, cell, dpr);
  }, [picture, cell, cols, rows]);
  return (
    <div className="mb-preview">
      <canvas ref={ref} style={{ width: cols * cell, height: rows * cell }} />
    </div>
  );
}

export default function MunchBunch() {
  const game = getGame("munch");

  const [phase, setPhase] = useState<Phase>("START");
  const [save, setSave] = useState<Saved>(DEFAULT_SAVE);
  const [result, setResult] = useState<{ stars: number; secs: number; best: boolean } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [cell, setCell] = useState(24);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const runRef = useRef<Run | null>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Every Munchy on screen (queued or in a spot), by id. */
  const munchyEls = useRef(new Map<number, HTMLDivElement>());
  const trackEl = (id: number) => (el: HTMLDivElement | null) => {
    if (el) munchyEls.current.set(id, el);
    else munchyEls.current.delete(id);
  };
  const pendingSend = useRef<PendingSend | null>(null);
  const timers = useRef<number[]>([]);

  const run = runRef.current;

  // ── Saved progress ──
  useEffect(() => {
    const stored = getStoredData(STORAGE_KEY) as Partial<Saved> | null;
    if (stored) {
      const merged = { ...DEFAULT_SAVE, ...stored };
      setSave(merged);
      setMuted(merged.muted);
    }
  }, []);

  const persist = useCallback((patch: Partial<Saved>) => {
    setSave((prev) => {
      const next = { ...prev, ...patch };
      setStoredData(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showToast = (text: string) => setToast({ id: Date.now(), text });
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Start a level ──
  const startLevel = (index: number) => {
    unlockAudio();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    munchyEls.current.clear();
    runRef.current = buildRun(index, performance.now());
    persist({ level: index });
    setResult(null);
    setPhase("PLAYING");
    rerender();
    if (index === 0) later(() => showToast("Tap a Munchy to send it to eat!"), 500);
  };

  // ── Board sizing ──
  const measure = useCallback(() => {
    const r = runRef.current;
    const box = boxRef.current;
    if (!r || !box) return;
    const w = Math.min(box.clientWidth, MAX_BOARD_WIDTH) - 24;
    const h = Math.max(170, window.innerHeight - RESERVED_HEIGHT);
    setCell(Math.max(12, Math.floor(Math.min(w / r.cols, h / r.rows))));
  }, []);

  useEffect(() => {
    if (phase !== "PLAYING" && phase !== "STUCK") return;
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [phase, run, measure]);

  // ── Game loop ──
  useEffect(() => {
    if (phase !== "PLAYING") return;
    const r = runRef.current;
    const board = boardRef.current;
    const fx = fxRef.current;
    if (!r || !board || !fx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const calm = prefersReducedMotion();
    const bx = board.getContext("2d")!;
    const fxx = fx.getContext("2d")!;
    const sizeFx = () => {
      fx.width = window.innerWidth * dpr;
      fx.height = window.innerHeight * dpr;
    };
    sizeFx();
    window.addEventListener("resize", sizeFx);

    let raf = 0;
    let last = performance.now();
    let stopped = false;

    const tick = (t: number) => {
      if (stopped) return;
      const dt = Math.min(50, t - last);
      last = t;
      const ev = step(r, dt);

      for (const m of ev.bitten) {
        const el = munchyEls.current.get(m.id);
        if (el) {
          el.classList.remove("is-bite");
          void el.offsetWidth;
          el.classList.add("is-bite");
        }
      }
      if (ev.bites) sfx.bite();
      for (const m of ev.finished) {
        sfx.done();
        later(() => {
          freeSlot(r, m);
          rerender();
        }, 480);
      }
      if (ev.dirty) rerender();

      const c = board.clientWidth / r.cols;
      drawBoard(bx, r, c, dpr, calm ? Infinity : t - r.startedAt);
      const br = board.getBoundingClientRect();
      drawFlights(
        fxx,
        r,
        c,
        dpr,
        (x, y) => ({ x: br.left + (x + 0.5) * c, y: br.top + (y + 0.5) * c }),
        (slot) => {
          const el = slotRefs.current[slot];
          if (!el) return null;
          const sr = el.getBoundingClientRect();
          return { x: sr.left + sr.width / 2, y: sr.top + sr.height * 0.58 };
        },
      );

      if (ev.outcome === "won") {
        stopped = true;
        later(() => {
          const stars = starsFor(r);
          const prevBest = save.stars[r.index] ?? 0;
          sfx.win();
          persist({
            level: r.index + 1,
            stars: { ...save.stars, [r.index]: Math.max(prevBest, stars) },
          });
          setResult({
            stars,
            secs: Math.round((performance.now() - r.startedAt) / 1000),
            best: stars > prevBest && prevBest > 0,
          });
          setPhase("WON");
        }, 650);
        return;
      }
      if (ev.outcome === "stuck") {
        stopped = true;
        sfx.stuck();
        setPhase("STUCK");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeFx);
      fxx.setTransform(1, 0, 0, 1, 0, 0);
      fxx.clearRect(0, 0, fx.width, fx.height);
    };
    // `save` is read only when a level ends; restarting the loop for it would reset timing.
  }, [phase, run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the canvas backing store matched to the cell size.
  useEffect(() => {
    const r = runRef.current;
    const board = boardRef.current;
    if (!r || !board) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    board.width = r.cols * cell * dpr;
    board.height = r.rows * cell * dpr;
    drawBoard(
      board.getContext("2d")!,
      r,
      cell,
      dpr,
      prefersReducedMotion() ? Infinity : performance.now() - r.startedAt,
    );
  }, [cell, run, phase]);

  // After a send: the Munchy hops from its queue to its spot, and the Munchies
  // behind it shuffle forward. Runs before paint so nothing flashes in place.
  useLayoutEffect(() => {
    const send = pendingSend.current;
    if (!send) return;
    pendingSend.current = null;
    const r = runRef.current;
    if (!r) return;

    const hopper = munchyEls.current.get(send.sentId);
    const spot = slotRefs.current[r.slots.findIndex((m) => m?.id === send.sentId)];
    const hopFrom = send.before.get(send.sentId);
    if (hopper && spot && hopFrom && typeof hopper.animate === "function") {
      // Measure the spot, not the Munchy: its CSS pop-in is already scaling it.
      const from = centerOf(hopFrom);
      const to = centerOf(spot.getBoundingClientRect());
      hopper.style.zIndex = "6";
      const anim = hopper.animate(hopFrames(from.x - to.x, from.y - to.y), {
        duration: HOP_MS,
        easing: "linear",
      });
      const settle = () => {
        hopper.style.zIndex = "";
      };
      anim.onfinish = settle;
      anim.oncancel = settle;
    }

    r.queues[send.column]?.slice(0, 3).forEach((m, i) => {
      const el = munchyEls.current.get(m.id);
      if (!el || typeof el.animate !== "function") return;
      const was = send.before.get(m.id);
      if (!was) {
        // Newly visible at the back of the line
        el.animate([{ offset: 0, opacity: 0, transform: "scale(0.2)" }], {
          duration: 220,
          delay: 120,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          fill: "backwards",
        });
        return;
      }
      const now = el.getBoundingClientRect();
      const from = centerOf(was);
      const to = centerOf(now);
      const start: Keyframe = {
        offset: 0,
        transform: `translate(${(from.x - to.x).toFixed(1)}px, ${(from.y - to.y).toFixed(1)}px) scale(${(was.width / now.width).toFixed(3)})`,
      };
      // The new front Munchy grows out of its faded "next up" size
      if (i === 0) start.opacity = 0.6;
      el.animate([start], {
        duration: QUEUE_SLIDE_MS,
        easing: "cubic-bezier(0.34, 1.4, 0.64, 1)",
      });
    });
  });

  // ── Actions ──
  const sendFrom = (column: number) => {
    unlockAudio();
    const r = runRef.current;
    if (!r || phase !== "PLAYING") return;
    // Remember where this column's Munchies are, so they can travel from there.
    const sent = r.queues[column]?.[0];
    const before = new Map<number, DOMRect>();
    if (!prefersReducedMotion()) {
      for (const m of r.queues[column]?.slice(0, 3) ?? []) {
        const el = munchyEls.current.get(m.id);
        if (el) before.set(m.id, el.getBoundingClientRect());
      }
    }
    const res = dispatch(r, column);
    if (res === "sent") {
      sfx.send();
      if (sent && before.size) pendingSend.current = { column, sentId: sent.id, before };
      rerender();
    } else if (res === "full") {
      sfx.nope();
      const el = slotsRef.current;
      if (el) {
        el.classList.remove("is-shake");
        void el.offsetWidth;
        el.classList.add("is-shake");
      }
      showToast("All spots are full!");
    }
  };

  const addSpot = () => {
    unlockAudio();
    const r = runRef.current;
    if (!r || !addExtraSlot(r)) return;
    sfx.done();
    setPhase("PLAYING");
    rerender();
  };

  const toggleSound = () => {
    unlockAudio();
    setMuted(!save.muted);
    persist({ muted: !save.muted });
  };

  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);

  // ── Start screen ──
  if (phase === "START" || !run) {
    return (
      <GameShell game={game}>
        <StartScreen
          game={game}
          subtitle="Send hungry Munchies to gobble up a pixel picture, one color at a time!">
          <div className="mb-mascots">
            {(["K", "G", "B"] as ColorKey[]).map((c) => (
              <MunchyView key={c} c={c} mode="eating" />
            ))}
          </div>
          <Panel label="How to play">
            <ol className="mb-how">
              <li>Tap a Munchy to send it to a munch spot.</li>
              <li>It eats cubes of its color, starting from the bottom.</li>
              <li>Don't fill every spot with Munchies that can't reach their color!</li>
            </ol>
          </Panel>
          {totalStars > 0 && (
            <StatPill icon={faStar} color="#f59e0b" label="Stars collected">
              {totalStars} stars collected
            </StatPill>
          )}
          <div className="dg-row">
            <KitButton size="lg" icon={faPlay} onClick={() => startLevel(save.level)}>
              Play Level {save.level + 1}
            </KitButton>
          </div>
          {save.level > 0 && (
            <div className="dg-row">
              <KitButton variant="neutral" size="sm" icon={faRotateLeft} onClick={() => startLevel(0)}>
                Start from Level 1
              </KitButton>
            </div>
          )}
        </StartScreen>
      </GameShell>
    );
  }

  // ── Win screen ──
  if (phase === "WON" && result) {
    const titles = ["", "Yum!", "Delicious!", "Perfect Munch!"];
    const tips = [
      "",
      "Try it without the extra spot and without filling every spot.",
      "So close! Try not to fill every spot for 3 stars.",
      "You never filled every spot. Great planning!",
    ];
    return (
      <GameShell game={game}>
        <WinScreen
          icon={result.stars === 3 ? faTrophy : result.stars === 2 ? faMedal : faCookieBite}
          iconColor={result.stars === 1 ? game.colors.to : undefined}
          title={titles[result.stars]}
          subtitle={
            <>
              You ate the whole <strong>{run.picture.name}</strong> in{" "}
              <CountUp value={result.secs} />s.
              <br />
              {tips[result.stars]}
            </>
          }>
          <PicturePreview index={run.index} />
          <Stars count={result.stars} />
          {result.best && <Banner tone="gold" icon={faTrophy}>New best!</Banner>}
          <div className="dg-row" style={{ marginTop: 8 }}>
            <KitButton variant="neutral" icon={faArrowsRotate} onClick={() => startLevel(run.index)}>
              Play Again
            </KitButton>
            <KitButton iconEnd={faArrowRight} onClick={() => startLevel(run.index + 1)}>
              Next Level
            </KitButton>
          </div>
        </WinScreen>
      </GameShell>
    );
  }

  // ── Playing / stuck ──
  const occupied = run.slots.filter(Boolean).length;
  const glowStyle = { "--mb-glow": run.picture.glow } as CSSProperties;

  return (
    <GameShell game={game}>
      <div className="mb-play" style={glowStyle}>
        <div className="mb-hud">
          <StatPill icon={faCookieBite} label="Level">
            Level {run.index + 1}
          </StatPill>
          <span className="mb-name">{levelTitle(run.index)}</span>
          <KitButton
            round
            variant="neutral"
            size="sm"
            icon={save.muted ? faVolumeXmark : faVolumeHigh}
            aria-label={save.muted ? "Turn sound on" : "Turn sound off"}
            onClick={toggleSound}
          />
          <KitButton
            round
            variant="neutral"
            size="sm"
            icon={faRotateLeft}
            aria-label="Restart level"
            onClick={() => startLevel(run.index)}
          />
        </div>

        <div
          className="mb-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.total}
          aria-valuenow={run.gone}>
          <i style={{ width: `${(run.gone / run.total) * 100}%` }} />
        </div>

        <div className="mb-board-box" ref={boxRef}>
          <div className="mb-board">
            <canvas
              ref={boardRef}
              style={{ width: run.cols * cell, height: run.rows * cell }}
              aria-label={`${run.picture.name} picture, ${run.total - run.gone} cubes left`}
              role="img"
            />
          </div>
        </div>

        <div className="mb-slots-label">
          <span>Munch spots</span>
          <span>
            {occupied} / {run.slots.length}
          </span>
        </div>
        <div className="mb-slots" ref={slotsRef}>
          {run.slots.map((m, k) => (
            <div
              key={k}
              ref={(el) => {
                slotRefs.current[k] = el;
              }}
              className={cx("mb-slot", k >= BASE_SLOTS && "is-extra", m && "is-filled")}>
              {m && (
                <MunchyView
                  key={m.id}
                  c={m.c}
                  count={m.cap - m.eaten}
                  mode={m.done ? "idle" : m.mode}
                  done={m.done}
                  elRef={trackEl(m.id)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mb-queue">
          {run.queues.map((q, k) => (
            <button
              key={k}
              type="button"
              className={cx("mb-col", !q.length && "is-empty")}
              disabled={!q.length}
              aria-label={q.length ? `Send a Munchy that eats ${q[0].cap} cubes` : "Empty"}
              onClick={() => sendFrom(k)}>
              {q.length > 0 && (
                <>
                  <MunchyView key={q[0].id} c={q[0].c} count={q[0].cap} elRef={trackEl(q[0].id)} />
                  <span className="mb-nexts">
                    {q.slice(1, 3).map((m: Munchy) => (
                      <MunchyView key={m.id} c={m.c} mini elRef={trackEl(m.id)} />
                    ))}
                    {q.length > 3 && <span className="mb-more">+{q.length - 3}</span>}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        <div className="dg-row mb-actions">
          <KitButton
            icon={faPlus}
            disabled={run.extraUsed}
            onClick={addSpot}
            className="mb-extra">
            Extra Spot
          </KitButton>
          <KitButton variant="neutral" onClick={() => setPhase("START")}>
            Quit
          </KitButton>
        </div>
      </div>

      {toast && (
        <div className="mb-toast" key={toast.id} role="status">
          {toast.text}
        </div>
      )}
      <canvas ref={fxRef} className="mb-fx" aria-hidden />

      <KitDialog
        game={game}
        open={phase === "STUCK"}
        onClose={() => startLevel(run.index)}
        icon={faFaceSadTear}
        title="The Munchies are stuck!">
        <p className="dg-subtitle" style={{ margin: "0 auto 16px" }}>
          Every spot is full and nobody can reach their color.
        </p>
        <div className="dg-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {!run.extraUsed && (
            <KitButton icon={faPlus} onClick={addSpot}>
              Use Extra Spot
            </KitButton>
          )}
          <KitButton variant="neutral" icon={faRotateLeft} onClick={() => startLevel(run.index)}>
            Try Again
          </KitButton>
        </div>
      </KitDialog>
    </GameShell>
  );
}

