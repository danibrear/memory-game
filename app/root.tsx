import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { config as faConfig } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import NavBar, { NAV_HEIGHT } from "./components/NavBar";
import Welcome from "./components/Welcome";
import { theme } from "./theme";

// Ship FontAwesome's CSS with the SSR bundle instead of injecting it at runtime,
// so icons are sized correctly on first paint.
faConfig.autoAddCss = false;

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Games by DaniB" },
    {
      name: "description",
      content: "Free fun games made with love for the whole family!",
    },
    { property: "og:title", content: "DaniB's Games" },
    {
      property: "og:description",
      content: "Free fun games made with love for the whole family!",
    },
    { property: "og:url", content: "https://games.db.rocks" },
    { property: "og:image", content: "https://games.db.rocks/og-image.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "DaniB's Games" },
    {
      name: "twitter:description",
      content: "Free fun games made with love for the whole family!",
    },
    { name: "twitter:image", content: "https://games.db.rocks/og-image.png" },
  ];
}

/** Spacer under the fixed nav. Game pages keep a little breathing room. */
const Offset = ({ flush }: { flush: boolean }) => (
  <Box sx={{ height: flush ? NAV_HEIGHT : NAV_HEIGHT + 12 }} />
);

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

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
          <NavBar />
          <Offset flush={isHome} />
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
