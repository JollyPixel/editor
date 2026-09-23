// Import Third-party Dependencies
import {
  PORTS,
  socketUrl
} from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";

// Import Internal Dependencies
import {
  encodeModelDocument,
  encodeTextureDocument
} from "../../vite/modelSeed.ts";

export { expect } from "@playwright/test";

export interface E2EModel {
  id: string;
  textureId: string;
}

export const test = editorFixture<E2EModel>({
  socketUrl: socketUrl(PORTS.voxelModel),
  editor: {
    maxFps: 5
  },
  async create(catalog) {
    const folder = e2eFolder();
    const textureId = await catalog.create(
      `${folder}/model.pixelart`,
      encodeTextureDocument(),
      { kind: PIXEL_ART_KIND }
    );
    const id = await catalog.create(
      `${folder}/model.voxelmodel.json`,
      encodeModelDocument(textureId),
      { kind: VOXEL_MODEL_KIND }
    );

    return {
      id,
      textureId
    };
  }
});
