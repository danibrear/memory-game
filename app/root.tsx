import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import {
  faBrain,
  faCopy,
  faPaintBrush,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
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
          <AppBar position="fixed" sx={{ padding: 2, mb: 4, zIndex: 1000 }}>
            <Container
              maxWidth="lg"
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                gap: 2,
              }}>
              <Box
                component="span"
                sx={{ fontWeight: "bold", fontSize: "1.5rem" }}>
                DaniB's Games
              </Box>
              {PAGES.map((page) => (
                <Button
                  key={page.name}
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    navigate(page.path);
                  }}>
                  {page.name}
                </Button>
              ))}
            </Container>
            <Container
              sx={{
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                gap: 2,
              }}>
              <IconButton
                onClick={() => {
                  setMobileDrawerOpen(true);
                }}>
                <MenuIcon color="inherit" />
              </IconButton>
              <Box component="span" sx={{ fontWeight: "bold" }}>
                DaniB's Games
              </Box>
            </Container>
            <Drawer
              anchor="left"
              variant="temporary"
              onClose={() => setMobileDrawerOpen(false)}
              open={mobileDrawerOpen}>
              <List
                style={{
                  marginTop: 20,
                }}>
                {PAGES.map((page) => (
                  <ListItem key={page.name} disablePadding>
                    <ListItemButton
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        navigate(page.path);
                      }}>
                      <ListItemIcon>{page.icon}</ListItemIcon>
                      <Typography
                        variant="button"
                        style={{
                          padding: 0,
                          margin: 0,
                          color: "inherit",
                        }}>
                        {page.name}
                      </Typography>
                    </ListItemButton>
                  </ListItem>
                ))}
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
