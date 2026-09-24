// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig, type Plugin } from "vite";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  editorPagesPlugin,
  readEditorPackages,
  type EditorPackage
} from "./vite/editorPages.ts";
import { resolveProjectRoot } from "./vite/projectRoot.ts";
import { readStudioProject } from "./vite/seed/index.ts";

// CONSTANTS
const kEditors = readEditorPackages([
  "@jolly-pixel/editor.voxel-map",
  "@jolly-pixel/editor.voxel-model"
]);

const project = await readStudioProject();

function staticEditorPagesPlugin(
  editors: readonly EditorPackage[]
): Plugin {
  return {
    name: "studio-static-editor-pages",
    apply: "build",
    async closeBundle() {
      for (const editor of editors) {
        await fs.cp(
          editor.dist,
          path.join(import.meta.dirname, "dist", "editors", editor.name),
          { recursive: true }
        );
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const staticHosting = mode === "static";
  const e2e = mode === "e2e";

  return {
    base: "./",
    server: e2e ? {
      port: PORTS.studio,
      strictPort: true
    } : undefined,
    plugins: [
      editorPagesPlugin({
        editors: kEditors
      }),
      ...staticHosting ? [staticEditorPagesPlugin(kEditors)] : [createAssetWorkspacePlugin({
        root: resolveProjectRoot(import.meta.dirname),
        ...(e2e ? {
          source: new MemoryAssetSource(),
          eventStore: EventStore.persistence.memory()
        } : {}),
        handlers: project.handlers,
        seed: project.seed
      })]
    ]
  };
});
