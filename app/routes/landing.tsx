import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Container, Divider, Link, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { PAGES } from "~/root";

const CARD_COLORS = [
  { bg: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)", shadow: "#7c3aed" },
  { bg: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)", shadow: "#db2777" },
  { bg: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)", shadow: "#ea580c" },
  { bg: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)", shadow: "#16a34a" },
  { bg: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)", shadow: "#0284c7" },
  { bg: "linear-gradient(135deg, #f87171 0%, #dc2626 100%)", shadow: "#dc2626" },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <Box>
      <Box sx={{ textAlign: "center", py: { xs: 4, md: 6 }, px: 2 }}>
        <Typography
          variant="h2"
          sx={{
            fontWeight: 900,
            fontSize: { xs: "2.4rem", md: "3.8rem" },
            background: "linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #ea580c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-1px",
            mb: 1.5,
          }}>
          DaniB's Games 🎮
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: "1rem", md: "1.2rem" },
            color: "text.secondary",
            maxWidth: 420,
            mx: "auto",
          }}>
          Choose a game and start playing!
        </Typography>
      </Box>

      <Container maxWidth="md" sx={{ pb: 8 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 3 },
          }}>
          {PAGES.map((page, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <Box
                key={page.name}
                onClick={() => navigate(page.path)}
                sx={{
                  background: color.bg,
                  borderRadius: 4,
                  p: { xs: 2.5, md: 3 },
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 1,
                  boxShadow: `0 8px 24px ${color.shadow}44`,
                  transition: "transform 0.18s ease, box-shadow 0.18s ease",
                  "&:hover": {
                    transform: "translateY(-6px) scale(1.03)",
                    boxShadow: `0 18px 40px ${color.shadow}66`,
                  },
                  "&:active": {
                    transform: "scale(0.96)",
                    transition: "transform 0.08s ease",
                  },
                }}>
                <Box
                  sx={{
                    width: { xs: 52, md: 60 },
                    height: { xs: 52, md: 60 },
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: { xs: "1.5rem", md: "1.75rem" },
                    color: "white",
                    mb: 0.5,
                    flexShrink: 0,
                  }}>
                  {page.icon}
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: "white !important",
                    fontSize: { xs: "0.95rem", md: "1.05rem" },
                    lineHeight: 1.2,
                  }}>
                  {page.name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.88) !important",
                    fontSize: { xs: "0.72rem", md: "0.82rem" },
                    lineHeight: 1.4,
                  }}>
                  {page.description}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Container>

      <Divider />
      <Box sx={{ textAlign: "center", py: 3 }}>
        <Typography
          variant="body2"
          component={Link}
          href="https://db.rocks"
          target="_blank"
          sx={{
            color: "text.secondary",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}>
          Made with <FontAwesomeIcon icon={faHeart} style={{ color: "red", fontSize: "0.85rem" }} /> by DaniB
        </Typography>
      </Box>
    </Box>
  );
}
