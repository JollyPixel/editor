// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import type {
  Plugin,
  ViteDevServer
} from "vite";

// Import Internal Dependencies
import type { EditorPageFiles } from "./EditorPageFiles.ts";
import type { EditorPagesWatcher } from "./EditorPagesWatcher.ts";
import {
  PageInput,
  virtualPages
} from "./PageInput.ts";
import { ServedPages } from "./ServedPages.ts";

// CONSTANTS
const kIndexPage = "index.html";
const kUiModule = /[\\/](?:packages|@jolly-pixel)[\\/]ui[\\/]dist[\\/]/;

export interface EditorPagesPluginOptions {
  /**
   * Routes of the studio pages bundled next to the shell and the editor
   * pages. The page of route `play` is `pages/play.html`, served at `play/`.
   * @default []
   */
  shellPages?: Iterable<string>;
}

export interface EditorPagesApi {
  served(
    server: ViteDevServer
  ): ServedPages;
}

export interface EditorPagesPlugin extends Plugin<EditorPagesApi> {
  api: EditorPagesApi;
}

export function editorPages(
  pages: EditorPageFiles,
  options: EditorPagesPluginOptions = {}
): EditorPagesPlugin {
  const { shellPages = [] } = options;
  let outDir: string;
  let watcher: EditorPagesWatcher | null = null;
  const inputs = new Map<string, PageInput>();
  const served = new WeakMap<ViteDevServer, ServedPages>();

  const api: EditorPagesApi = {
    served(server) {
      let current = served.get(server);
      if (current === undefined) {
        current = new ServedPages(server, inputs.values());
        served.set(server, current);
      }

      return current;
    }
  };

  return {
    name: "studio-editor-pages",
    api,
    config(config, env) {
      const root = path.resolve(config.root ?? "");
      const compiled = [
        ...PageInput.editors(root, pages.editors),
        ...Array.from(shellPages, (route) => PageInput.shell(root, route))
      ];
      for (const input of compiled) {
        inputs.set(input.id, input);
      }
      if (env.command === "serve") {
        return {
          optimizeDeps: {
            entries: [
              kIndexPage,
              ...Array.from(inputs.values(), (input) => input.entry)
            ]
          }
        };
      }

      return {
        build: {
          rolldownOptions: {
            input: {
              index: path.join(root, kIndexPage),
              ...Object.fromEntries(
                Array.from(inputs.values(), (input) => [input.name, input.id])
              )
            },
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: "ui",
                    test: kUiModule,
                    tags: ["$initial"]
                  }
                ]
              }
            },
            experimental: {
              chunkOptimization: {
                mergeCommonChunks: false
              }
            }
          }
        }
      };
    },
    configResolved(config) {
      outDir = path.resolve(
        config.root,
        config.build.outDir
      );
    },
    ...virtualPages(inputs),
    configureServer(server) {
      server.middlewares.use(
        api.served(server).middleware
      );
      server.middlewares.use(
        pages.middleware
      );
      watcher = pages.watch(server);
    },
    buildEnd() {
      watcher?.close();
      watcher = null;
    },
    writeBundle() {
      return pages.copyTo(outDir);
    }
  };
}
