// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  searchForWorkspaceRoot,
  type Plugin
} from "vite";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { EditorPages } from "./server/EditorPages.ts";
import { StudioProject } from "./server/StudioProject.ts";
import { editorPagesPlugin } from "./vite/editorPagesPlugin.ts";
import { projectManifestPlugin } from "./vite/projectManifestPlugin.ts";
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
  const inMemory = e2e || mode === "static";
  const project = await StudioProject.open(
    StudioProject.resolveRoot(import.meta.dirname),
    { inMemory }
  );

  return {
    base: "./",
    server: {
      ...(e2e ? {
        port: PORTS.studio,
        strictPort: true
      } : {}),
      fs: {
        allow: [
          searchForWorkspaceRoot(import.meta.dirname),
          ...project.kinds.resolver.directories
        ]
      }
    },
    plugins: [
      prebundleWorkspace(),
      createProjectKindsPlugin(project.kinds),
      projectManifestPlugin(project),
      inMemory ? null : createProjectFileWatchPlugin(project.file),
      editorPagesPlugin(new EditorPages(project.editors)),
      mode === "static" ? null : await assetWorkspacePlugin(project, e2e)
    ]
  };
});
