// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import type { RunMode } from "@jolly-pixel/e2e";
import { PLAY_PAGE_DIR } from "@jolly-pixel/server";
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
import { playerArchive } from "./offlinePlay.ts";
import { PageInput } from "./PageInput.ts";
import { playerModules } from "./playerModules.ts";
import { projectContributions } from "./projectContributions.ts";
import { ServedPages } from "./ServedPages.ts";

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
      const { root } = server.config;
      const pages = new ServedPages(server, [
        ...PageInput.editors(root, project.editors),
        PageInput.shell(root, PLAY_PAGE_DIR)
      ]);
      const player = new DevPlayer({
        root,
        plugins: [
          projectContributions(project),
          playerModules()
        ],
        logger: server.config.logger
      });
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
          ...await studioBackendFiles(player),
          editorPages: pages,
          playPage: {
            html: () => pages.render(PLAY_PAGE_DIR)
          },
          allowedHosts: server.config.server.allowedHosts
        }
      );
      server.middlewares.use(playerArchive(player));
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
