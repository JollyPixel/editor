// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import type {
  PackageResolverOptions,
  ProjectFileData
} from "@jolly-pixel/asset-server/node";
import {
  createVoxelMapFile,
  encodeBlocksetFile,
  blocksetAsset,
  blocksetFileFromPng,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelFile,
  VOXEL_MODEL_FILE,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE,
  encodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { GamePlayer } from "#src/node/game/BuiltPlayer.ts";
import { DEFAULT_ACCESS } from "#src/node/project/StudioAccess.ts";
import { StudioProject } from "#src/node/project/StudioProject.ts";

// CONSTANTS
const kPackagesDir = path.join(import.meta.dirname, "..", "..", "..");
const kBlocksetFile = path.join(import.meta.dirname, "..", "fixtures", "blockset.png");
const kBlocksetAssetId = "blockset-overworld";
export const FIRST_PARTY_PACKAGES: PackageResolverOptions = {
  searchFolders: [
    path.join(kPackagesDir, "assets"),
    path.join(kPackagesDir, "editors")
  ]
};
export const TEST_PROJECT_FILE: ProjectFileData = {
  version: 1,
  editors: [
    "@jolly-pixel/editor.voxel-map",
    "@jolly-pixel/editor.voxel-model"
  ],
  kinds: {
    "@jolly-pixel/asset.voxel-map": {},
    "@jolly-pixel/asset.voxel-model": {}
  },
  access: DEFAULT_ACCESS
};
export const UNBUILT_PLAYER: GamePlayer = {
  files: () => Promise.reject(new Error("no game player is built in tests"))
};

export function openTestProject(): Promise<StudioProject> {
  return StudioProject.open(
    path.join(import.meta.dirname, "..", "project"),
    {
      inMemory: true,
      packages: FIRST_PARTY_PACKAGES,
      template: TEST_PROJECT_FILE
    }
  );
}

export async function testSeed(): Promise<AssetSeedMap> {
  const blockset = await blocksetFileFromPng(
    await fs.readFile(kBlocksetFile),
    {
      tileSize: DEFAULT_TILE_SIZE
    }
  );

  return {
    "maps/overworld.blockset.json": {
      id: kBlocksetAssetId,
      kind: BLOCKSET_KIND,
      content: () => encodeBlocksetFile(blockset)
    },
    "maps/overworld.voxelmap.json": {
      id: "map-overworld",
      kind: VOXEL_MAP_KIND,
      content: () => encodeVoxelWorld(
        createVoxelMapFile({
          chunkSize: DEFAULT_CHUNK_SIZE,
          blocksets: [
            {
              id: "default",
              asset: blocksetAsset(kBlocksetAssetId)
            }
          ]
        })
      )
    },
    "models/model.voxelmodel.json": {
      id: "model-default",
      kind: VOXEL_MODEL_KIND,
      content: () => VOXEL_MODEL_FILE.encode(
        createVoxelModelFile({
          texture: {
            id: "model-texture",
            kind: "pixelart"
          }
        })
      )
    }
  };
}
