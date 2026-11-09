// Import Third-party Dependencies
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ModelViewTexture } from "../viewer/ModelView.ts";
import { pixelModelTexture } from "../viewer/pixelModelTexture.ts";
import type { VoxelModelSource } from "../viewer/VoxelModelSource.ts";

export class GameVoxelModel implements VoxelModelSource {
  readonly document: ModelDocument;
  readonly texture: ModelViewTexture;

  constructor(
    document: ModelDocument,
    pixels: PixelDocument
  ) {
    this.document = document;
    this.texture = pixelModelTexture(pixels).texture;
  }

  attach(): () => void {
    return () => undefined;
  }
}
