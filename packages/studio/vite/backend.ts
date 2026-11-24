// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import type { RunMode } from "@jolly-pixel/e2e";
import { PLAY_PAGE_DIR } from "@jolly-pixel/server";
import {
  ServerBackend,
  ShellPackages,
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
import { DevPlayer } from "./player/DevPlayer.ts";
import { E2E_BACKEND_OPTIONS } from "./e2eBackend.ts";
import type { EditorPagesApi } from "./pages/editorPages.ts";
import { playerArchive } from "./player/offlinePlay.ts";
import { playerModules } from "./player/modules.ts";
import { projectContributions } from "./project/contributions.ts";

export interface BackendPluginOptions {
  project: Project;
  mode: RunMode;
  settings: ServerSettings;
  /**
   * Serves the editor pages and renders the play page this back-end answers.
   */
  pages: EditorPagesApi;
}

export function backend(
  options: BackendPluginOptions
): Plugin {
  const {
    project,
    mode,
    settings
  } = options;
  let opened: ServerBackend | null = null;

  return {
    name: "studio-backend",
    apply: "serve",
    async configureServer(server) {
      const hosting = settings.hosting(STUDIO_ROOT);
      const { root } = server.config;
      const pages = options.pages.served(server);
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
                root
              })
          ),
          shellPackages: ShellPackages.compiledFrom(project),
          ...backendOptions(mode, settings),
          ...await studioBackendFiles(player),
          editorPages: pages,
          playPage: {
            html: pages.claim(PLAY_PAGE_DIR)
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
    const { accountsPolicy, ...e2eOptions } = E2E_BACKEND_OPTIONS;

    return {
      inMemory,
      ...e2eOptions,
      ...settings.hostsFolder ? {} : { accountsPolicy }
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
