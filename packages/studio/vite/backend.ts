// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import type { RunMode } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import type { StudioProject } from "../server/project/StudioProject.ts";
import {
  StudioBackend,
  type StudioBackendOptions
} from "../server/StudioBackend.ts";
import { E2E_BACKEND_OPTIONS } from "./e2eBackend.ts";

export function backend(
  project: StudioProject,
  mode: RunMode
): Plugin {
  let opened: StudioBackend | null = null;

  return {
    name: "studio-backend",
    apply: "serve",
    async configureServer(server) {
      opened = await StudioBackend.open(
        project,
        backendOptions(mode)
      );
      server.middlewares.use(opened.middleware);

      if (server.httpServer !== null) {
        opened.attach(server.httpServer, {
          allowedHosts: server.config.server.allowedHosts
        });
      }
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        await opened?.[Symbol.asyncDispose]();
        opened = null;
      }
    }
  };
}

function backendOptions(
  mode: RunMode
): StudioBackendOptions {
  const { inMemory } = mode.assetServer;
  if (mode.e2e) {
    return {
      inMemory,
      ...E2E_BACKEND_OPTIONS
    };
  }

  return {
    inMemory,
    accounts: {
      env: process.env,
      logger: createLogger()
    }
  };
}
