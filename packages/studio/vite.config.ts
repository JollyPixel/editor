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
  createAssetWorkspacePlugin,
  ProjectFile
} from "@jolly-pixel/asset-server/node";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { EditorPages } from "./server/EditorPages.ts";
import {
  DEFAULT_PROJECT_FILE,
  StudioProject
} from "./server/StudioProject.ts";
import { editorPagesPlugin } from "./vite/editorPagesPlugin.ts";
import { projectModulesPlugin } from "./vite/projectModules.ts";
import { createStudioSeed } from "./src/seed.ts";

// CONSTANTS
const kTilesetFile = path.join(
  import.meta.dirname,
  "public",
  "textures",
  "tileset.png"
);
const kRoomGraceMs = 5 * 60_000;

async function assetWorkspacePlugin(
  project: StudioProject,
  inMemory: boolean
): Promise<Plugin> {
  return createAssetWorkspacePlugin({
    root: project.file.root,
    ...(inMemory ? {
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory()
    } : {}),
    handlers: project.kinds.handlers(),
    seed: await createStudioSeed(await fs.readFile(kTilesetFile)),
    roomGraceMs: kRoomGraceMs
  });
}

export default defineConfig(async({ mode }) => {
  const e2e = mode === "e2e";
  const root = StudioProject.resolveRoot(import.meta.dirname);
  const project = e2e || mode === "static" ?
    await StudioProject.load(new ProjectFile(root, DEFAULT_PROJECT_FILE)) :
    await StudioProject.open(root);

  return {
    base: "./",
    server: e2e ? {
      port: PORTS.studio,
      strictPort: true
    } : undefined,
    plugins: [
      projectModulesPlugin(project),
      editorPagesPlugin(new EditorPages(project.editors)),
      mode === "static" ? null : await assetWorkspacePlugin(project, e2e)
    ]
  };
});
