import {
  faClockRotateLeft,
  faHeart,
  faPlay,
  faShuffle,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, ButtonBase, Container, Link, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import GameIconTile from "~/components/GameIconTile";
import Logo from "~/components/Logo";
import { NAV_BACKGROUND } from "~/components/NavBar";
import {
  CATEGORIES,
  FEATURED_GAME,
  GAMES,
  gameGradient,
  getCategory,
  randomGame,
  type Game,
  type GameCategory,
} from "~/gameCatalog";
import { DISPLAY_FONT } from "~/theme";
import { useRecentGames } from "~/utils/recentGames";
import type { Route } from "./+types/landing";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DaniB's Games — free games for kids & families" },
    {
      name: "description",
      content:
        "Free puzzle, arcade, and memory games made with love for the whole family. No ads, no sign-up.",
    },
  ];
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** Chunky "game button" — solid face with a darker ledge underneath. */
const chunkyButtonSx = (face: string, ledge: string) =>
  ({
    textTransform: "none",
    fontFamily: DISPLAY_FONT,
    fontWeight: 600,
    fontSize: { xs: "1.05rem", md: "1.15rem" },
    letterSpacing: "0.2px",
    borderRadius: "16px",
    px: 3,
    py: 1.25,
    color: "white",
    background: face,
    boxShadow: `0 5px 0 ${ledge}, 0 12px 24px rgba(0,0,0,0.25)`,
    transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.15s ease",
    "&:hover": { background: face, filter: "brightness(1.08)" },
    "&:active": { transform: "translateY(4px)", boxShadow: `0 1px 0 ${ledge}` },
  }) as const;

/** Dotted + glow texture laid over a game's gradient. */
const artTexture =
  "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.35) 0, rgba(255,255,255,0) 40%), radial-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.5px)";

function NewRibbon() {
  return (
    <Box
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: "8px",
        fontSize: "0.68rem",
        fontWeight: 900,
        letterSpacing: "0.08em",
        color: "#3b2300",
        background: "linear-gradient(135deg, #fef08a, #f59e0b)",
        boxShadow: "0 2px 0 #b45309",
      }}>
      NEW
    </Box>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const FLOATING_TILES: { gameIdx: number; top: string; left: string; size: number; rotate: number }[] = [
  { gameIdx: 1, top: "14%", left: "1.5%", size: 54, rotate: -12 },
  { gameIdx: 4, top: "62%", left: "1%", size: 44, rotate: 10 },
  { gameIdx: 6, top: "8%", left: "46%", size: 40, rotate: 14 },
  { gameIdx: 3, top: "78%", left: "50%", size: 50, rotate: -8 },
  { gameIdx: 8, top: "12%", left: "92%", size: 46, rotate: 8 },
];

function FeaturedCard({ game }: { game: Game }) {
  return (
    <ButtonBase
      component={RouterLink}
      to={game.path}
      aria-label={`Play ${game.name}`}
      sx={{
        display: "block",
        width: "100%",
        maxWidth: 420,
        ml: "auto",
        textAlign: "left",
        borderRadius: "28px",
        overflow: "hidden",
        background: "#1d1640",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: `0 30px 60px rgba(5,2,20,0.5), 0 0 0 6px rgba(255,255,255,0.04)`,
        transform: "rotate(2deg)",
        transition: "transform 0.25s ease",
        "&:hover": { transform: "rotate(0deg) translateY(-4px)" },
        "&:hover .featured-icon": { transform: "scale(1.08) rotate(-6deg)" },
      }}>
      <Box
        sx={{
          position: "relative",
          height: 220,
          background: `${artTexture}, ${gameGradient(game)}`,
          backgroundSize: "auto, 18px 18px, auto",
          display: "grid",
          placeItems: "center",
        }}>
        <Box sx={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 1 }}>
          {game.isNew && <NewRibbon />}
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: "8px",
              fontSize: "0.7rem",
              fontWeight: 800,
              color: "white",
              background: "rgba(0,0,0,0.22)",
              backdropFilter: "blur(4px)",
            }}>
            Featured
          </Box>
        </Box>
        <Box
          className="featured-icon"
          sx={{
            transition: "transform 0.25s ease",
            filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.3))",
          }}>
          <GameIconTile game={game} size={112} sx={{ boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5)" }} />
        </Box>
      </Box>
      <Box sx={{ p: 2.5, color: "white" }}>
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1.1 }}>
          {game.name}
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.92rem", mt: 0.75, mb: 2 }}>
          {game.description}
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            px: 2.25,
            py: 1,
            borderRadius: "14px",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            background: gameGradient(game, 180),
            boxShadow: `0 4px 0 ${game.colors.to}`,
          }}>
          <FontAwesomeIcon icon={faPlay} /> Play now
        </Box>
      </Box>
    </ButtonBase>
  );
}

function Hero({ recent }: { recent: Game[] }) {
  const navigate = useNavigate();
  const continueGame = recent[0];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        color: "white",
        background: `radial-gradient(ellipse at 15% 0%, rgba(139,92,246,0.45) 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(236,72,153,0.35) 0%, transparent 55%), ${NAV_BACKGROUND}`,
        pt: { xs: 5, md: 8 },
        pb: { xs: 7, md: 10 },
      }}>
      {/* Decorative floating game tiles */}
      <Box aria-hidden sx={{ display: { xs: "none", md: "block" } }}>
        {FLOATING_TILES.map((t, i) => {
          const game = GAMES[t.gameIdx % GAMES.length];
          return (
            <Box
              key={i}
              sx={{
                position: "absolute",
                top: t.top,
                left: t.left,
                opacity: 0.28,
                transform: `rotate(${t.rotate}deg)`,
                animation: `heroFloat ${5 + i}s ease-in-out ${i * 0.4}s infinite alternate`,
                "@keyframes heroFloat": {
                  from: { translate: "0 0" },
                  to: { translate: "0 -14px" },
                },
              }}>
              <GameIconTile game={game} size={t.size} />
            </Box>
          );
        })}
      </Box>

      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          alignItems: "center",
          gap: { xs: 5, md: 6 },
        }}>
        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 0.75,
              mb: 2.5,
              borderRadius: "999px",
              fontSize: "0.82rem",
              fontWeight: 600,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
            {GAMES.length} free games · No ads · No sign-up
          </Box>

          <Typography
            component="h1"
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: { xs: "2.6rem", sm: "3.2rem", md: "4.2rem" },
              lineHeight: 1.02,
              letterSpacing: "-0.5px",
              mb: 2,
              textShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}>
            Pick a game.
            <br />
            <Box
              component="span"
              sx={{
                background: "linear-gradient(90deg, #fde047 0%, #fb923c 40%, #f472b6 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
              Start playing!
            </Box>
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: "1.02rem", md: "1.15rem" },
              color: "rgba(255,255,255,0.75)",
              maxWidth: 480,
              mx: { xs: "auto", md: 0 },
              mb: 4,
              lineHeight: 1.6,
            }}>
            Puzzles, arcade action, and brain teasers made for kids and families.
            Your progress saves right in your browser.
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: { xs: "center", md: "flex-start" },
            }}>
            {continueGame ? (
              <Button
                component={RouterLink}
                to={continueGame.path}
                startIcon={<FontAwesomeIcon icon={faPlay} style={{ fontSize: "0.9rem" }} />}
                sx={chunkyButtonSx("linear-gradient(180deg, #4ade80 0%, #16a34a 100%)", "#14532d")}>
                Continue {continueGame.name}
              </Button>
            ) : (
              <Button
                component={RouterLink}
                to={FEATURED_GAME.path}
                startIcon={<FontAwesomeIcon icon={faPlay} style={{ fontSize: "0.9rem" }} />}
                sx={chunkyButtonSx("linear-gradient(180deg, #4ade80 0%, #16a34a 100%)", "#14532d")}>
                Play {FEATURED_GAME.name}
              </Button>
            )}
            <Button
              onClick={() => navigate(randomGame().path)}
              startIcon={<FontAwesomeIcon icon={faShuffle} style={{ fontSize: "0.9rem" }} />}
              sx={chunkyButtonSx("linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)", "#3b0764")}>
              Surprise me
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <FeaturedCard game={FEATURED_GAME} />
        </Box>
      </Container>
    </Box>
  );
}

// ─── Recently played ──────────────────────────────────────────────────────────

function RecentlyPlayed({ games }: { games: Game[] }) {
  if (games.length === 0) return null;
  return (
    <Box sx={{ mb: { xs: 4, md: 5 } }}>
      <SectionTitle icon={faClockRotateLeft}>Jump back in</SectionTitle>
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}>
        {games.map((game) => (
          <ButtonBase
            key={game.id}
            component={RouterLink}
            to={game.path}
            sx={(t) => ({
              flexShrink: 0,
              gap: 1.25,
              pl: 1,
              pr: 2,
              py: 1,
              borderRadius: "16px",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "text.primary",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 2px 8px rgba(30,20,80,0.06)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: `0 8px 18px ${game.colors.to}33`,
              },
              ...t.applyStyles("dark", { bgcolor: "#1b1735" }),
            })}>
            <GameIconTile game={game} size={34} />
            {game.name}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

// ─── Game grid ────────────────────────────────────────────────────────────────

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: Parameters<typeof FontAwesomeIcon>[0]["icon"];
}) {
  return (
    <Typography
      component="h2"
      sx={{
        fontFamily: DISPLAY_FONT,
        fontWeight: 600,
        fontSize: { xs: "1.5rem", md: "1.85rem" },
        color: "text.primary",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        mb: 2,
      }}>
      {icon && (
        <FontAwesomeIcon icon={icon} style={{ fontSize: "0.8em", opacity: 0.5 }} />
      )}
      {children}
    </Typography>
  );
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: GameCategory | "all";
  onChange: (v: GameCategory | "all") => void;
}) {
  const options = [
    { id: "all" as const, label: "All games", emoji: "✨", count: GAMES.length },
    ...CATEGORIES.map((c) => ({
      ...c,
      count: GAMES.filter((g) => g.category === c.id).length,
    })).filter((c) => c.count > 0),
  ];

  return (
    <Box
      role="tablist"
      aria-label="Filter games by type"
      sx={{
        display: "flex",
        gap: 1,
        overflowX: "auto",
        pb: 1,
        mb: { xs: 2.5, md: 3 },
        mx: { xs: -2, sm: 0 },
        px: { xs: 2, sm: 0 },
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <ButtonBase
            key={opt.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            sx={(t) => ({
              flexShrink: 0,
              gap: 0.75,
              px: 1.75,
              height: 40,
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "0.88rem",
              transition: "all 0.15s ease",
              ...(selected
                ? {
                    color: "white",
                    background: "linear-gradient(135deg, #7c3aed, #db2777)",
                    boxShadow: "0 3px 0 #6b2161, 0 6px 14px rgba(219,39,119,0.3)",
                  }
                : {
                    color: "text.primary",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { borderColor: "#a78bfa" },
                    ...t.applyStyles("dark", { bgcolor: "#1b1735" }),
                  }),
            })}>
            <span aria-hidden>{opt.emoji}</span>
            {opt.label}
            <Box
              component="span"
              sx={{
                fontSize: "0.72rem",
                fontWeight: 800,
                px: 0.75,
                borderRadius: "999px",
                background: selected ? "rgba(255,255,255,0.22)" : "rgba(124,58,237,0.1)",
              }}>
              {opt.count}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function GameCard({ game }: { game: Game }) {
  const category = getCategory(game.category);
  return (
    <ButtonBase
      component={RouterLink}
      to={game.path}
      aria-label={`Play ${game.name}`}
      sx={(t) => ({
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        textAlign: "left",
        borderRadius: { xs: "20px", md: "24px" },
        overflow: "hidden",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 2px 10px rgba(30,20,80,0.06)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-6px)",
          boxShadow: `0 20px 40px ${game.colors.to}40`,
        },
        "&:hover .card-icon": { transform: "scale(1.1) rotate(-6deg)" },
        "&:hover .card-play": { filter: "brightness(1.08)" },
        "&:active": { transform: "translateY(-2px) scale(0.99)" },
        "&.Mui-focusVisible": { outline: `3px solid ${game.colors.from}`, outlineOffset: 3 },
        ...t.applyStyles("dark", {
          bgcolor: "#1b1735",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        }),
      })}>
      {/* Art */}
      <Box
        sx={{
          position: "relative",
          aspectRatio: { xs: "4 / 3", sm: "16 / 10" },
          background: `${artTexture}, ${gameGradient(game, 150)}`,
          backgroundSize: "auto, 16px 16px, auto",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}>
        {/* soft decorative rings */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            width: "120%",
            aspectRatio: "1",
            right: "-60%",
            bottom: "-70%",
            borderRadius: "50%",
            border: "18px solid rgba(255,255,255,0.12)",
          }}
        />
        <Box sx={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 0.75, alignItems: "center" }}>
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: "8px",
              fontSize: { xs: "0.62rem", md: "0.7rem" },
              fontWeight: 800,
              color: "white",
              background: "rgba(0,0,0,0.2)",
              backdropFilter: "blur(4px)",
              whiteSpace: "nowrap",
            }}>
            {category.label}
          </Box>
          <Box sx={{ flex: 1 }} />
          {game.isNew && <NewRibbon />}
        </Box>
        <Box
          className="card-icon"
          sx={{
            color: "white",
            fontSize: { xs: "2.6rem", md: "3.4rem" },
            transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.25))",
          }}>
          <FontAwesomeIcon icon={game.icon} />
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: { xs: 1.5, md: 2.25 }, display: "flex", flexDirection: "column", flex: 1 }}>
        <Typography
          component="h3"
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: { xs: "1.08rem", md: "1.3rem" },
            lineHeight: 1.15,
            color: "text.primary",
          }}>
          {game.name}
        </Typography>
        <Typography
          sx={{
            display: { xs: "none", sm: "-webkit-box" },
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontSize: "0.88rem",
            lineHeight: 1.45,
            color: "text.secondary",
            mt: 0.75,
          }}>
          {game.description}
        </Typography>
        <Box sx={{ flex: 1, minHeight: { xs: 10, md: 16 } }} />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography
            component="span"
            sx={{
              fontSize: { xs: "0.7rem", md: "0.78rem" },
              fontWeight: 600,
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              whiteSpace: "nowrap",
            }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, opacity: 0.6 }}>
              <FontAwesomeIcon icon={faUserGroup} />
            </Box>
            {game.players}
          </Typography>
          <Box
            className="card-play"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              fontFamily: DISPLAY_FONT,
              fontWeight: 600,
              fontSize: { xs: "0.85rem", md: "0.95rem" },
              px: { xs: 1.5, md: 2 },
              py: { xs: 0.5, md: 0.75 },
              borderRadius: "12px",
              color: "white",
              background: gameGradient(game, 180),
              boxShadow: `0 3px 0 ${game.colors.to}`,
              textShadow: "0 1px 1px rgba(0,0,0,0.25)",
            }}>
            <FontAwesomeIcon icon={faPlay} style={{ fontSize: "0.75em" }} /> Play
          </Box>
        </Box>
      </Box>
    </ButtonBase>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const recent = useRecentGames();
  const [filter, setFilter] = useState<GameCategory | "all">("all");
  const visibleGames = useMemo(
    () => (filter === "all" ? GAMES : GAMES.filter((g) => g.category === filter)),
    [filter],
  );

  return (
    <Box
      sx={(t) => ({
        bgcolor: "#f6f4fd",
        minHeight: "100dvh",
        ...t.applyStyles("dark", { bgcolor: "#0f0c1f" }),
      })}>
      <Hero recent={recent} />

      <Container
        maxWidth="lg"
        component="main"
        sx={{ position: "relative", mt: { xs: -3, md: -4 }, pb: { xs: 6, md: 10 } }}>
        <Box
          sx={(t) => ({
            borderRadius: { xs: "24px", md: "32px" },
            p: { xs: 2, sm: 3, md: 4 },
            bgcolor: "#ffffff",
            border: "1px solid rgba(124,58,237,0.08)",
            boxShadow: "0 -12px 40px rgba(20,10,60,0.18)",
            ...t.applyStyles("dark", {
              bgcolor: "#16122c",
              border: "1px solid rgba(255,255,255,0.06)",
            }),
          })}>
          <RecentlyPlayed games={recent} />

          <SectionTitle>All games</SectionTitle>
          <CategoryFilter value={filter} onChange={setFilter} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
              gap: { xs: 1.5, sm: 2.5, md: 3 },
            }}>
            {visibleGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </Box>
        </Box>
      </Container>

      <Box
        component="footer"
        sx={{
          textAlign: "center",
          pb: 5,
          px: 2,
          color: "text.secondary",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}>
        <Logo size={32} />
        <Typography variant="body2" sx={{ maxWidth: 360 }}>
          Every game saves in your browser — nothing is ever tracked.
        </Typography>
        <Typography
          variant="body2"
          component={Link}
          href="https://db.rocks"
          target="_blank"
          rel="noopener"
          sx={{
            fontWeight: 600,
            color: "text.secondary",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}>
          Made with{" "}
          <FontAwesomeIcon icon={faHeart} style={{ color: "#ef4444", fontSize: "0.85rem" }} />{" "}
          by DaniB
        </Typography>
      </Box>
    </Box>
  );
}
