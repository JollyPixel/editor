// Import Third-party Dependencies
import { PIXEL_ART_KIND, pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import {
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";
import {
  openSharedTabWorkspace,
  type StandaloneWorkspace
} from "@jolly-pixel/editor.host/offline";

// Import Internal Dependencies
import {
  TEXTURE_SIZE,
  encodeModelDocument
} from "../../vite/modelSeed.ts";

export function openOfflineWorkspace(
  name: string = "default"
): Promise<StandaloneWorkspace> {
  const textureId = crypto.randomUUID();

  return openSharedTabWorkspace({
    name,
    handlers: [
      voxelModelAssetKind(),
      pixelArtAssetKind({ defaultSize: TEXTURE_SIZE })
    ],
    seed: {
      "textures/model.pixelart": {
        id: textureId,
        kind: PIXEL_ART_KIND
      },
      "models/model.voxelmodel.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MODEL_KIND,
        content: () => encodeModelDocument(textureId)
      }
    }
  });
}
