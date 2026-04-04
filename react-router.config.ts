import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  async prerender() {
    return ["/", "/memory", "/color", "/match", "/ballsort", "/bubblepop", "/quadra", "/towerdefense"];
  },
} satisfies Config;
