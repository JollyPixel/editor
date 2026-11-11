// Import Third-party Dependencies
import type { ProjectFileData } from "@jolly-pixel/asset-server/node";
import { DEFAULT_ACCESS } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "../shared/seed.ts";

// CONSTANTS
const kSnapshot = {
  delay: 2_000,
  maxDelay: 30_000
};

export const STUDIO_PROJECT_FILE: ProjectFileData = {
  version: 1,
  editors: [
    "@jolly-pixel/editor.model",
    "@jolly-pixel/editor.pixel-art",
    "@jolly-pixel/editor.scene",
    "@jolly-pixel/editor.script",
    "@jolly-pixel/editor.sound",
    "@jolly-pixel/editor.texture",
    "@jolly-pixel/editor.voxel-map",
    "@jolly-pixel/editor.voxel-model"
  ],
  kinds: {
    "@jolly-pixel/asset.font": {},
    "@jolly-pixel/asset.model": {},
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE,
      snapshot: kSnapshot
    },
    "@jolly-pixel/asset.scene": {},
    "@jolly-pixel/asset.script": {},
    "@jolly-pixel/asset.sound": {},
    "@jolly-pixel/asset.voxel-map": {
      blockset: {
        tileSize: 32,
        defaultSize: {
          x: 256,
          y: 256
        },
        snapshot: kSnapshot
      },
      voxelmap: {
        chunkSize: 16,
        snapshot: {
          delay: 5_000,
          maxDelay: 60_000
        }
      }
    },
    "@jolly-pixel/asset.voxel-model": {
      snapshot: kSnapshot
    },
    "@jolly-pixel/asset.voxel-animation": {
      snapshot: kSnapshot
    }
  },
  access: DEFAULT_ACCESS
};
