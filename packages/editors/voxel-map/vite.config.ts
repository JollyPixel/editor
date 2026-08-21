// Import Node.js Dependencies
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import {
  createAssetBackend,
  FilesystemAssetSource,
  textureAssetHandler,
  STATE_DIRECTORY
} from "@jolly-pixel/asset-server";
import {
  createAssetCatalogPlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import {
  encodePixelArtDocument,
  pixelArtAssetHandler
} from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";
import {
  createVoxelMapState,
  encodeVoxelMapDocument,
  voxelMapAssetHandler
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

// CONSTANTS
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kAssetsUrlPrefix = "/assets/";
const kChunkSize = 16;
const kTextureSize = {
  x: 32,
  y: 32
};
const kSeedFiles: Record<string, () => Uint8Array> = {
  "textures/block.pixelart": () => encodePixelArtDocument(
    new PixelBuffer({ size: kTextureSize })
  ),
  "maps/overworld.voxelmap.json": () => {
    const state = createVoxelMapState(kChunkSize);
    state.world.addLayer("Ground");

    return encodeVoxelMapDocument(state);
  }
};
const kContentTypes: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".pixelart": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};

/**
 * Writes the starter documents on a first run so the back-end has something
 * to catalog. Existing files are never overwritten: once the workspace
 * exists it is the source of truth.
 */
async function seedAssets(): Promise<void> {
  // The event store opens before the back-end writes its state directory,
  // and sqlite will not create the file inside a directory that is missing.
  await fs.mkdir(
    path.join(kAssetsRoot, STATE_DIRECTORY),
    { recursive: true }
  );

  for (const [relative, build] of Object.entries(kSeedFiles)) {
    const target = path.join(kAssetsRoot, relative);
    try {
      await fs.access(target);
    }
    catch {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, build());
    }
  }
}

/**
 * Serves the asset workspace under a known prefix. The catalog hands the
 * browser root-relative source paths, which have to resolve to something.
 */
function assetStaticPlugin() {
  return {
    name: "voxel-map-assets",
    configureServer(devServer: {
      middlewares: {
        use(handler: (
          request: { url?: string; },
          response: {
            statusCode: number;
            setHeader(key: string, value: string): void;
            end(payload?: string): void;
          },
          next: () => void
        ) => void): void;
      };
    }) {
      devServer.middlewares.use((request, response, next) => {
        const url = request.url ?? "";
        if (!url.startsWith(kAssetsUrlPrefix)) {
          next();

          return;
        }

        const relative = decodeURIComponent(
          url.slice(kAssetsUrlPrefix.length).split("?")[0]
        );
        const target = path.join(kAssetsRoot, relative);
        // Keeps a "../" in the request from escaping the workspace.
        if (!target.startsWith(kAssetsRoot + path.sep)) {
          response.statusCode = 403;
          response.end();

          return;
        }

        response.setHeader(
          "content-type",
          kContentTypes[path.extname(target)] ?? "application/octet-stream"
        );
        createReadStream(target)
          .on("error", () => {
            response.statusCode = 404;
            response.end();
          })
          .pipe(response as unknown as NodeJS.WritableStream);
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(async({ command }) => {
  // A production build ships the client only. Starting the back-end, its
  // watchers and its sqlite store would be pure cost there.
  if (command !== "serve") {
    return {};
  }

  await seedAssets();

  const eventStore = await EventStore.persistence.sqlite(
    path.join(kAssetsRoot, ".jollypixel", "events.db")
  );
  const backend = await createAssetBackend({
    source: new FilesystemAssetSource(kAssetsRoot),
    eventStore,
    handlers: [
      pixelArtAssetHandler({ defaultSize: kTextureSize }),
      voxelMapAssetHandler({ chunkSize: kChunkSize }),
      textureAssetHandler()
    ]
  });

  // One Server shared by the network plugin and the back-end: `attach` adds
  // the catalog room and the resolver that opens a room per edited asset.
  const server = new Server({ eventStore });
  backend.attach(server);

  return {
    server: {
      allowedHosts: true
    },
    plugins: [
      createWebSocketNetworkPlugin({ server }),
      createAssetCatalogPlugin({ projection: backend.catalog }),
      assetStaticPlugin()
    ]
  };
});
