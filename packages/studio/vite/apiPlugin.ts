// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import {
  StudioApi,
  type StudioApiOptions
} from "../server/api/StudioApi.ts";

export function apiPlugin(
  options: StudioApiOptions
): Plugin {
  let api: StudioApi | null = null;

  return {
    name: "studio-api",
    apply: "serve",
    async configureServer(server) {
      api = await StudioApi.open(options);
      server.middlewares.use(api.middleware);
    },
    async closeBundle() {
      await api?.[Symbol.asyncDispose]();
      api = null;
    }
  };
}
