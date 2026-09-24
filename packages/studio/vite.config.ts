// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type Plugin
} from "vite";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { readEditorPackages } from "./vite/editorManifest.ts";
import { editorPagesPlugin } from "./vite/editorPagesPlugin.ts";
import { resolveProjectRoot } from "./vite/projectRoot.ts";
import { createStudioProject } from "./src/seed.ts";

// CONSTANTS
const kTilesetFile = path.join(
  import.meta.dirname,
  "public",
  "textures",
  "tileset.png"
);
const kEditors = readEditorPackages([
  "@jolly-pixel/editor.voxel-map",
  "@jolly-pixel/editor.voxel-model"
]);

async function assetWorkspacePlugin(
  inMemory: boolean
): Promise<Plugin> {
  const { handlers, seed } = await createStudioProject(
    await fs.readFile(kTilesetFile)
  );

  return createAssetWorkspacePlugin({
    root: resolveProjectRoot(import.meta.dirname),
    ...(inMemory ? {
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory()
    } : {}),
    handlers,
    seed
  });
}

export default defineConfig(async({ mode }) => {
  const e2e = mode === "e2e";

  return {
    base: "./",
    server: e2e ? {
      port: PORTS.studio,
      strictPort: true
    } : undefined,
    plugins: [
      editorPagesPlugin(kEditors),
      mode === "static" ? null : await assetWorkspacePlugin(e2e)
    ]
  };
});
