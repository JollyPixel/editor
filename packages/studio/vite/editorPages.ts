// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  normalizePath,
  type Plugin
} from "vite";

// Import Internal Dependencies
import type { EditorPages } from "../server/editors/EditorPages.ts";
import type { EditorPagesWatcher } from "../server/editors/EditorPagesWatcher.ts";
import { EditorPageInput } from "./EditorPageInput.ts";
import { ServedEditorPages } from "./ServedEditorPages.ts";

// CONSTANTS
const kHtmlFile = /\.html$/;
const kShellPages = {
  index: "index.html"
};
const kUiModule = /[\\/](?:packages|@jolly-pixel)[\\/]ui[\\/]dist[\\/]/;

export interface EditorPagesPluginOptions {
  /**
   * Studio pages bundled next to the editor pages, by entry name, relative to
   * the Vite root.
   * @default { index: "index.html" }
   */
  shellPages?: Readonly<Record<string, string>>;
}

export function editorPages(
  pages: EditorPages,
  options: EditorPagesPluginOptions = {}
): Plugin {
  const { shellPages = kShellPages } = options;
  let outDir: string;
  let watcher: EditorPagesWatcher | null = null;
  const inputs = new Map<string, EditorPageInput>();

  return {
    name: "studio-editor-pages",
    config(config, env) {
      const root = path.resolve(config.root ?? "");
      for (const input of EditorPageInput.compiled(root, pages.editors)) {
        inputs.set(input.id, input);
      }
      if (env.command === "serve") {
        return {
          optimizeDeps: {
            entries: [
              ...Object.values(shellPages),
              ...Array.from(inputs.values(), (input) => input.entry)
            ]
          }
        };
      }

      return {
        build: {
          rolldownOptions: {
            input: {
              ...Object.fromEntries(
                Object.entries(shellPages).map(
                  ([name, page]) => [name, path.join(root, page)]
                )
              ),
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
    resolveId: {
      filter: {
        id: kHtmlFile
      },
      handler(id) {
        const normalized = normalizePath(id);

        return inputs.has(normalized) ? normalized : null;
      }
    },
    load: {
      filter: {
        id: kHtmlFile
      },
      handler(id) {
        return inputs.get(id)?.load() ?? null;
      }
    },
    configureServer(server) {
      server.middlewares.use(
        new ServedEditorPages(server, inputs.values()).middleware
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
