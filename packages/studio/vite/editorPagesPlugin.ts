// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import type { EditorPages } from "../server/EditorPages.ts";
import type { EditorPagesWatcher } from "../server/EditorPagesWatcher.ts";

export function editorPagesPlugin(
  pages: EditorPages
): Plugin[] {
  let outDir: string;
  let watcher: EditorPagesWatcher | null = null;

  return [
    {
      name: "studio-editor-pages",
      configureServer(server) {
        server.middlewares.use(pages.middleware);
        watcher = pages.watch(server);
      },
      buildEnd() {
        watcher?.close();
        watcher = null;
      }
    },
    {
      name: "studio-editor-pages-copy",
      apply: "build",
      configResolved(config) {
        outDir = path.resolve(config.root, config.build.outDir);
      },
      closeBundle() {
        return pages.copyTo(outDir);
      }
    }
  ];
}
