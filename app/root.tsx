import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import {
  faBrain,
  faCopy,
  faCubes,
  faFlask,
  faPaintBrush,
  faCircle,
  faShield,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ThemeProvider,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import Welcome from "./components/Welcome";
import { theme } from "./theme";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Games by DaniB" },
    { name: "description", content: "Games I made for my family!" },
  ];
}

const Offset = () => {
  const theme = useTheme();
  return (
    <Box sx={{ height: `calc(${theme.mixins.toolbar.minHeight}px + 20px)` }} />
  );
};

export const PAGES = [
  {
    name: "Memory Game",
    path: "/memory",
    description:
      "Test your memory skills by matching pairs of colors in this exciting Memory Game!",
    icon: <FontAwesomeIcon icon={faBrain} />,
  },
  {
    name: "Color Game",
    path: "/color",
    description: "Color in the grid by selecting cells",
    icon: <FontAwesomeIcon icon={faPaintBrush} />,
  },
  {
    name: "Match Game",
    path: "/match",
    description: "Match pairs of colors in this exciting game!",
    icon: <FontAwesomeIcon icon={faCopy} />,
  },
  {
    name: "Ball Sort",
    path: "/ballsort",
    description: "Sort colored balls into matching tubes!",
    icon: <FontAwesomeIcon icon={faFlask} />,
  },
  {
    name: "Cascade",
    path: "/quadra",
    description: "Tetris with chain reactions!",
    icon: <FontAwesomeIcon icon={faCubes} />,
  },
  {
    name: "Bubble Pop",
    path: "/bubblepop",
    description: "Pop the bubbles before they fly away!",
    icon: <FontAwesomeIcon icon={faCircle} />,
  },
  {
    name: "Tower Defense",
    path: "/towerdefense",
    description: "Place towers to stop the enemy waves!",
    icon: <FontAwesomeIcon icon={faShield} />,
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const location = useLocation();

  const [currentRoute, setCurrentRoute] = useState(location.pathname);

  useEffect(() => {
    setCurrentRoute(location.pathname);
  }, [location.pathname]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <body>
          <AppBar
            position="fixed"
            sx={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #4a1942 100%)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
              zIndex: 1000,
            }}>
            {/* Desktop nav */}
            <Container
              maxWidth="lg"
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                py: 1,
                gap: 0.5,
              }}>
              <Box
                component="span"
                onClick={() => navigate("/")}
                sx={{
                  fontWeight: 900,
                  fontSize: "1.25rem",
                  color: "white",
                  cursor: "pointer",
                  letterSpacing: "-0.3px",
                  mr: 2,
                  flexShrink: 0,
                  userSelect: "none",
                }}>
                🎮 DaniB's Games
              </Box>
              <Box sx={{ flex: 1 }} />
              {PAGES.map((page) => {
                const isActive = currentRoute === page.path;
                return (
                  <Button
                    key={page.name}
                    onClick={() => navigate(page.path)}
                    startIcon={
                      <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>
                        {page.icon}
                      </span>
                    }
                    sx={{
                      color: "white",
                      fontWeight: isActive ? 700 : 400,
                      fontSize: "0.85rem",
                      borderRadius: "50px",
                      px: 1.75,
                      py: 0.75,
                      textTransform: "none",
                      whiteSpace: "nowrap",
                      background: isActive
                        ? "rgba(255,255,255,0.18)"
                        : "transparent",
                      "&:hover": {
                        background: "rgba(255,255,255,0.12)",
                      },
                    }}>
                    {page.name}
                  </Button>
                );
              })}
            </Container>

            {/* Mobile nav */}
            <Container
              sx={{
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                py: 1,
                gap: 1,
              }}>
              <IconButton
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ color: "white" }}>
                <MenuIcon />
              </IconButton>
              <Box
                component="span"
                onClick={() => navigate("/")}
                sx={{ fontWeight: 900, fontSize: "1.1rem", color: "white", cursor: "pointer", userSelect: "none" }}>
                🎮 DaniB's Games
              </Box>
            </Container>

            {/* Mobile drawer */}
            <Drawer
              anchor="left"
              variant="temporary"
              onClose={() => setMobileDrawerOpen(false)}
              open={mobileDrawerOpen}
              PaperProps={{
                sx: {
                  background: "linear-gradient(180deg, #1e1b4b 0%, #4a1942 100%)",
                  minWidth: 240,
                },
              }}>
              <Box
                sx={{
                  px: 2.5,
                  py: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}>
                <Typography
                  sx={{ fontWeight: 900, fontSize: "1.2rem", color: "white" }}>
                  🎮 DaniB's Games
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", mx: 2 }} />
              <List sx={{ pt: 1, px: 1 }}>
                {PAGES.map((page, i) => {
                  const isActive = currentRoute === page.path;
                  const iconColors = [
                    "#a78bfa",
                    "#f472b6",
                    "#fb923c",
                    "#4ade80",
                    "#38bdf8",
                    "#f87171",
                  ];
                  const c = iconColors[i % iconColors.length];
                  return (
                    <ListItem key={page.name} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => {
                          setMobileDrawerOpen(false);
                          navigate(page.path);
                        }}
                        sx={{
                          borderRadius: 3,
                          background: isActive
                            ? "rgba(255,255,255,0.15)"
                            : "transparent",
                          "&:hover": {
                            background: "rgba(255,255,255,0.1)",
                          },
                        }}>
                        <ListItemIcon
                          sx={{
                            minWidth: 0,
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: `${c}33`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: c,
                            fontSize: "1rem",
                            mr: 1.5,
                          }}>
                          {page.icon}
                        </ListItemIcon>
                        <Typography
                          sx={{
                            fontWeight: isActive ? 700 : 400,
                            color: "white",
                            fontSize: "0.95rem",
                          }}>
                          {page.name}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Drawer>
          </AppBar>
          <Offset />
          {children}
          <Welcome />

          <ScrollRestoration />
          <Scripts />
        </body>
      </ThemeProvider>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
