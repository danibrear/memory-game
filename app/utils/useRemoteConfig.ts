import { useEffect, useState } from "react";
import { DEFAULT_CONFIG, loadConfig, type GameConfig } from "./remoteConfig";

export function useRemoteConfig(): GameConfig {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

  return config;
}
