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
import { readStudioProject } from "./vite/seed/index.ts";

// CONSTANTS
const kEditors = readEditorPackages([
  "@jolly-pixel/editor.voxel-map",
  "@jolly-pixel/editor.voxel-model"
]);

async function assetWorkspacePlugin(
  inMemory: boolean
): Promise<Plugin> {
  const { handlers, seed } = await readStudioProject();

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
