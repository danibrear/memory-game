import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Tests run without the React Router plugin: they cover plain modules (saves,
// engines), not routes.
export default defineConfig({
  plugins: [tsconfigPaths()],
  define: { __APP_BUILD__: JSON.stringify("test-build") },
  test: { include: ["app/**/*.test.ts"], environment: "node" },
});
