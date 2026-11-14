import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, type SxProps, type Theme } from "@mui/material";
import { gameGradient, type Game } from "~/gameCatalog";

interface GameIconTileProps {
  game: Game;
  size?: number;
  sx?: SxProps<Theme>;
}

/** Rounded, glossy app-icon style tile for a game. */
export default function GameIconTile({ game, size = 40, sx }: GameIconTileProps) {
  return (
    <Box
      aria-hidden
      sx={[
        {
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: `${Math.round(size * 0.28)}px`,
          background: gameGradient(game),
          color: "white",
          display: "grid",
          placeItems: "center",
          fontSize: size * 0.44,
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 ${Math.round(size * 0.08)}px ${Math.round(size * 0.3)}px ${game.colors.to}55, inset 0 1px 0 rgba(255,255,255,0.45)`,
          "& svg": { filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" },
          // glossy highlight
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 48%)",
            pointerEvents: "none",
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}>
      <FontAwesomeIcon icon={game.icon} />
    </Box>
  );
}
