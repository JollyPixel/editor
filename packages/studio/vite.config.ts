// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig, type Plugin } from "vite";
import { textureAssetKind } from "@jolly-pixel/asset-server";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import { voxelMapAssetKind } from "@jolly-pixel/asset.voxel-map";
import { voxelModelAssetKind } from "@jolly-pixel/asset.voxel-model";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  editorPagesPlugin,
  resolveEditorPages,
  type EditorPage
} from "./vite/editorPages.ts";
import { resolveProjectRoot } from "./vite/projectRoot.ts";
import {
  CHUNK_SIZE,
  createStudioSeed
} from "./vite/seed/index.ts";

// CONSTANTS
const kEditorPages: EditorPage[] = [
  {
    name: "voxel-map",
    package: "@jolly-pixel/editor.voxel-map"
  },
  {
    name: "voxel-model",
    package: "@jolly-pixel/editor.voxel-model"
  }
];

const seed = await createStudioSeed();

function staticEditorPagesPlugin(): Plugin {
  return {
    name: "studio-static-editor-pages",
    apply: "build",
    async closeBundle() {
      for (const [name, source] of resolveEditorPages(kEditorPages)) {
        await fs.cp(
          source,
          path.join(import.meta.dirname, "dist", "editors", name),
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
        pages: kEditorPages
      }),
      ...staticHosting ? [staticEditorPagesPlugin()] : [createAssetWorkspacePlugin({
        root: resolveProjectRoot(import.meta.dirname),
        ...(e2e ? {
          source: new MemoryAssetSource(),
          eventStore: EventStore.persistence.memory()
        } : {}),
        handlers: [
          pixelArtAssetKind({ defaultSize: seed.tilesetSize }),
          voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
          voxelModelAssetKind(),
          textureAssetKind()
        ],
        seed: seed.assets
      })]
    ]
  };
});
