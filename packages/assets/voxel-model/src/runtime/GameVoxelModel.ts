// Import Third-party Dependencies
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ModelDocument } from "../model/index.ts";
import type { ModelViewTexture } from "./ModelView.ts";
import { pixelModelTexture } from "./pixelModelTexture.ts";
import type { VoxelModelSource } from "./VoxelModelSource.ts";

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
