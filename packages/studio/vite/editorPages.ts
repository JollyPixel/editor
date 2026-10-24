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

// CONSTANTS
const kHtmlFile = /\.html$/;
const kUiModule = /[\\/](?:packages|@jolly-pixel)[\\/]ui[\\/]dist[\\/]/;

export function editorPages(
  pages: EditorPages
): Plugin[] {
  let outDir: string;
  let watcher: EditorPagesWatcher | null = null;
  const inputs = new Map<string, EditorPageInput>();

  return [
    {
      name: "studio-editor-pages",
      configureServer(server) {
        server.middlewares.use(
          pages.middleware
        );
        watcher = pages.watch(server);
      },
      buildEnd() {
        watcher?.close();
        watcher = null;
      }
    },
    {
      name: "studio-editor-pages-build",
      apply: "build",
      config(config) {
        const root = path.resolve(config.root ?? "");
        for (const editor of pages.editors) {
          if (editor.page !== null) {
            const input = new EditorPageInput(root, editor.name, editor.page);
            inputs.set(input.id, input);
          }
        }
        if (inputs.size === 0) {
          return null;
        }

        return {
          build: {
            rolldownOptions: {
              input: {
                index: path.join(root, "index.html"),
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
      writeBundle() {
        return pages.copyTo(outDir);
      }
    }
  ];
}
