import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import HomeIcon from "@mui/icons-material/Home";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  useTheme,
} from "@mui/material";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

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

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
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
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                navigate("/memory");
              }}>
              Play Memory Game
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                navigate("/color");
              }}>
              Play Color Game
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                navigate("/match");
              }}>
              Play Match Game
            </Button>
          </Container>
          <Container
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 2,
            }}>
            <IconButton onClick={() => navigate("/")}>
              <HomeIcon />
            </IconButton>
            <Box component="span" sx={{ fontWeight: "bold" }}>
              DaniB's Games
            </Box>
          </Container>
        </AppBar>
        <Offset />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
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
