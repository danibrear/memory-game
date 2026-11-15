import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  define: {
    // Names the build, so a game can tell the first load after an update and keep a
    // restore point of the save from before it (see app/storage/saveVault.ts).
    // Amplify sets AWS_COMMIT_ID; anywhere else a production build gets its build time.
    __APP_BUILD__: JSON.stringify(
      process.env.AWS_COMMIT_ID || (command === "build" ? new Date().toISOString() : "dev"),
    ),
  },
}));
