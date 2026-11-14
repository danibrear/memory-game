import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // The site is served as static files (Amplify), so there is no server to
  // answer React Router's lazy `/__manifest` requests. Ship every route in the
  // initial manifest and prerender all of them instead.
  routeDiscovery: { mode: "initial" },
  prerender: true,
} satisfies Config;
