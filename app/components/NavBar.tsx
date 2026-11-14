import { faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import CloseIcon from "@mui/icons-material/Close";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import {
  AppBar,
  Box,
  Button,
  ButtonBase,
  Container,
  Drawer,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router";
import {
  GAMES,
  gamesByCategory,
  getGameByPath,
  randomGame,
  type Game,
} from "~/gameCatalog";
import { DISPLAY_FONT } from "~/theme";
import { recordGameVisit } from "~/utils/recentGames";
import GameIconTile from "./GameIconTile";
import Logo from "./Logo";

export const NAV_HEIGHT = 64;
export const NAV_BACKGROUND =
  "linear-gradient(100deg, #140f2e 0%, #23124a 55%, #3a1145 100%)";
const PANEL_BG = "#1a1436";
const HOVER_BG = "rgba(255,255,255,0.08)";
const ACTIVE_BG = "rgba(255,255,255,0.14)";
const MUTED = "rgba(255,255,255,0.62)";

function NewBadge() {
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75,
        px: 0.75,
        py: "1px",
        borderRadius: 1,
        fontSize: "0.6rem",
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: "#3b2300",
        background: "linear-gradient(135deg, #fde047, #f59e0b)",
        verticalAlign: "middle",
      }}>
      NEW
    </Box>
  );
}

function MenuGameItem({
  game,
  active,
  onSelect,
  compact = false,
}: {
  game: Game;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <ButtonBase
      component={RouterLink}
      to={game.path}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      sx={{
        width: "100%",
        justifyContent: "flex-start",
        textAlign: "left",
        gap: 1.5,
        p: compact ? 1 : 1.25,
        borderRadius: 3,
        color: "white",
        background: active ? ACTIVE_BG : "transparent",
        transition: "background 0.15s ease",
        "&:hover": { background: active ? ACTIVE_BG : HOVER_BG },
        "&:hover .menu-tile": { transform: "scale(1.06) rotate(-3deg)" },
        "&.Mui-focusVisible": { outline: "2px solid #a78bfa", outlineOffset: 2 },
      }}>
      <GameIconTile
        game={game}
        size={compact ? 38 : 42}
        sx={{ transition: "transform 0.18s ease" }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ display: "block", fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.25 }}>
          {game.name}
          {game.isNew && <NewBadge />}
        </Typography>
        {!compact && (
          <Typography
            component="span"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              fontSize: "0.76rem",
              lineHeight: 1.35,
              color: MUTED,
              mt: 0.25,
            }}>
            {game.description}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}

function Wordmark({ size = "1.3rem" }: { size?: string }) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.2px",
        whiteSpace: "nowrap",
      }}>
      DaniB's{" "}
      <Box
        component="span"
        sx={{
          background: "linear-gradient(90deg, #c4b5fd, #f9a8d4, #fdba74)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
        Games
      </Box>
    </Box>
  );
}

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentGame = getGameByPath(location.pathname);
  const isHome = location.pathname === "/";

  const menuAnchor = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close menus and remember the game on every navigation.
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
    if (currentGame) recordGameVisit(currentGame);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const surpriseMe = () => navigate(randomGame(currentGame?.path).path);
  const groups = gamesByCategory();

  // Balance category groups across 3 menu columns by game count.
  const menuColumns: (typeof groups)[] = [[], [], []];
  const columnWeights = [0, 0, 0];
  for (const group of groups) {
    const i = columnWeights.indexOf(Math.min(...columnWeights));
    menuColumns[i].push(group);
    columnWeights[i] += group.games.length + 0.5;
  }

  const pillButtonSx = {
    color: "white",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.9rem",
    borderRadius: "999px",
    px: 1.75,
    height: 38,
    "&:hover": { background: HOVER_BG },
  } as const;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: NAV_HEIGHT,
        justifyContent: "center",
        background: NAV_BACKGROUND,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 6px 24px rgba(10, 6, 30, 0.35)",
        zIndex: 1000,
      }}>
      <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {/* Brand */}
        <ButtonBase
          component={RouterLink}
          to="/"
          aria-label="DaniB's Games home"
          sx={{
            gap: 1.25,
            borderRadius: 3,
            pr: 1,
            color: "white",
            flexShrink: 0,
            "&:hover .nav-logo": { transform: "rotate(-8deg) scale(1.06)" },
          }}>
          <Box className="nav-logo" sx={{ transition: "transform 0.2s ease" }}>
            <Logo size={36} />
          </Box>
          <Box sx={{ display: { xs: currentGame ? "none" : "block", sm: "block" } }}>
            <Wordmark />
          </Box>
        </ButtonBase>

        {/* Current game breadcrumb */}
        {currentGame && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
              ml: { xs: 0, sm: 0.5 },
            }}>
            <Box
              sx={{
                display: { xs: "none", sm: "block" },
                width: "1px",
                height: 24,
                background: "rgba(255,255,255,0.18)",
                mr: 0.5,
              }}
            />
            <GameIconTile game={currentGame} size={28} />
            <Typography
              noWrap
              sx={{ fontWeight: 700, fontSize: "0.95rem", color: "white" }}>
              {currentGame.name}
            </Typography>
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Desktop actions */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<HomeRoundedIcon />}
            aria-current={isHome ? "page" : undefined}
            sx={{ ...pillButtonSx, background: isHome ? ACTIVE_BG : "transparent" }}>
            Home
          </Button>
          <Button
            ref={menuAnchor}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "all-games-menu" : undefined}
            endIcon={
              <KeyboardArrowDownRoundedIcon
                sx={{
                  transition: "transform 0.2s ease",
                  transform: menuOpen ? "rotate(180deg)" : "none",
                }}
              />
            }
            sx={{ ...pillButtonSx, background: menuOpen ? ACTIVE_BG : "transparent" }}>
            All games
            <Box
              component="span"
              sx={{
                ml: 1,
                px: 0.9,
                borderRadius: "999px",
                fontSize: "0.72rem",
                fontWeight: 800,
                background: "rgba(255,255,255,0.16)",
              }}>
              {GAMES.length}
            </Box>
          </Button>
          <Button
            onClick={surpriseMe}
            startIcon={<FontAwesomeIcon icon={faShuffle} style={{ fontSize: "0.85rem" }} />}
            sx={{
              ...pillButtonSx,
              ml: 1,
              fontWeight: 700,
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              boxShadow: "0 3px 0 #831843, 0 6px 16px rgba(236,72,153,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #9d74f8 0%, #f05aa8 100%)",
              },
              "&:active": { transform: "translateY(2px)", boxShadow: "0 1px 0 #831843" },
            }}>
            Surprise me
          </Button>
        </Box>

        {/* Mobile actions */}
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Surprise me">
            <IconButton
              onClick={surpriseMe}
              aria-label="Play a random game"
              sx={{ color: "white", fontSize: "1rem" }}>
              <FontAwesomeIcon icon={faShuffle} />
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={() => setDrawerOpen(true)}
            aria-label="Open games menu"
            sx={{ color: "white" }}>
            <MenuRoundedIcon />
          </IconButton>
        </Box>
      </Container>

      {/* Desktop mega menu */}
      <Popover
        id="all-games-menu"
        open={menuOpen}
        anchorEl={menuAnchor.current}
        onClose={() => setMenuOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              width: 760,
              maxWidth: "calc(100vw - 32px)",
              borderRadius: 4,
              background: PANEL_BG,
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 60px rgba(8, 4, 28, 0.55)",
              p: 2.5,
            },
          },
        }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: 2 }}>
          {menuColumns.map((column, i) => (
            <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {column.map(({ category, games }) => (
                <Box key={category.id}>
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: MUTED,
                      px: 1.25,
                      mb: 0.5,
                    }}>
                    {category.emoji} {category.label}
                  </Typography>
                  {games.map((game) => (
                    <MenuGameItem
                      key={game.id}
                      game={game}
                      active={currentGame?.id === game.id}
                      onSelect={() => setMenuOpen(false)}
                    />
                  ))}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxWidth: "88vw",
              background: PANEL_BG,
              color: "white",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            },
          },
        }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 2,
            height: NAV_HEIGHT,
            background: NAV_BACKGROUND,
            flexShrink: 0,
          }}>
          <Logo size={32} />
          <Wordmark size="1.2rem" />
          <Box sx={{ flex: 1 }} />
          <IconButton
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 1.5, overflowY: "auto" }}>
          <ButtonBase
            component={RouterLink}
            to="/"
            onClick={() => setDrawerOpen(false)}
            aria-current={isHome ? "page" : undefined}
            sx={{
              width: "100%",
              justifyContent: "flex-start",
              gap: 1.5,
              p: 1,
              mb: 1,
              borderRadius: 3,
              color: "white",
              fontWeight: 700,
              background: isHome ? ACTIVE_BG : "transparent",
              "&:hover": { background: HOVER_BG },
            }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "11px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.1)",
              }}>
              <HomeRoundedIcon fontSize="small" />
            </Box>
            Home
          </ButtonBase>
          {groups.map(({ category, games }) => (
            <Box key={category.id} sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTED,
                  px: 1,
                  mb: 0.5,
                }}>
                {category.emoji} {category.label}
              </Typography>
              {games.map((game) => (
                <MenuGameItem
                  key={game.id}
                  game={game}
                  compact
                  active={currentGame?.id === game.id}
                  onSelect={() => setDrawerOpen(false)}
                />
              ))}
            </Box>
          ))}
        </Box>
      </Drawer>
    </AppBar>
  );
}
