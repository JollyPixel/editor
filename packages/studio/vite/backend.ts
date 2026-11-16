// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import type { RunMode } from "@jolly-pixel/e2e";
import {
  ServerBackend,
  type ServerBackendOptions,
  type Project,
  type ServerSettings
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_ROOT,
  studioBackendFiles
} from "../node/studioFiles.ts";
import { DevPlayer } from "./DevPlayer.ts";
import { E2E_BACKEND_OPTIONS } from "./e2eBackend.ts";
import { EditorPageInput } from "./EditorPageInput.ts";
import { playerModules } from "./playerModules.ts";
import { projectContributions } from "./projectContributions.ts";
import { ServedEditorPages } from "./ServedEditorPages.ts";
import { ServedPlayerPage } from "./ServedPlayerPage.ts";

export function backend(
  project: Project,
  mode: RunMode,
  settings: ServerSettings
): Plugin {
  let opened: ServerBackend | null = null;

  return {
    name: "studio-backend",
    apply: "serve",
    async configureServer(server) {
      const hosting = settings.hosting(STUDIO_ROOT);
      opened = await ServerBackend.open(
        {
          hosting,
          openProject: async(root) => (
            root === project.file.root ?
              project :
              openStudioProject({
                settings,
                root,
                inMemory: mode.assetServer.inMemory
              })
          ),
          ...backendOptions(mode, settings),
          ...await studioBackendFiles(
            new DevPlayer({
              root: server.config.root,
              plugins: [
                projectContributions(project),
                playerModules()
              ],
              logger: server.config.logger
            })
          ),
          editorPages: new ServedEditorPages(
            server,
            EditorPageInput.compiled(server.config.root, project.editors)
          ),
          playPage: new ServedPlayerPage(server),
          allowedHosts: server.config.server.allowedHosts
        }
      );
      server.middlewares.use(opened.middleware);

      if (server.httpServer !== null) {
        opened.attach(server.httpServer);
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
  settings: ServerSettings
): Omit<
  ServerBackendOptions,
  "hosting" | "openProject" | "player" | "playPage" | "preferences"
> {
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
