import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  route("/memory", "routes/memory.tsx"),
  route("/color", "routes/color.tsx"),
] satisfies RouteConfig;
