// Import Third-party Dependencies
import type { ProjectFileData } from "@jolly-pixel/asset-server/node";
import { DEFAULT_ACCESS } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "../shared/seed.ts";

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
      defaultSize: TEXTURE_SIZE
    },
    "@jolly-pixel/asset.scene": {},
    "@jolly-pixel/asset.script": {},
    "@jolly-pixel/asset.sound": {},
    "@jolly-pixel/asset.voxel-map": {},
    "@jolly-pixel/asset.voxel-model": {},
    "@jolly-pixel/asset.voxel-animation": {}
  },
  access: DEFAULT_ACCESS
};
