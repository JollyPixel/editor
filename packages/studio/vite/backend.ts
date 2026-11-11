// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import type { RunMode } from "@jolly-pixel/e2e";
import {
  StudioBackend,
  type StudioBackendOptions,
  type StudioProject,
  type StudioServerSettings
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { studioBackendFiles } from "../node/studioFiles.ts";
import { E2E_BACKEND_OPTIONS } from "./e2eBackend.ts";
import { EditorPageInput } from "./EditorPageInput.ts";
import { ServedEditorPages } from "./ServedEditorPages.ts";

export function backend(
  project: StudioProject,
  mode: RunMode,
  settings: StudioServerSettings
): Plugin {
  let opened: StudioBackend | null = null;

  return {
    name: "studio-backend",
    apply: "serve",
    async configureServer(server) {
      opened = await StudioBackend.open(
        project,
        {
          ...backendOptions(mode, settings),
          ...await studioBackendFiles(),
          editorPages: new ServedEditorPages(
            server,
            EditorPageInput.compiled(server.config.root, project.editors)
          )
        }
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
  mode: RunMode,
  settings: StudioServerSettings
): Omit<StudioBackendOptions, "player" | "preferences"> {
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
      masterPassword: settings.masterPassword,
      logger: createLogger()
    }
  };
}
