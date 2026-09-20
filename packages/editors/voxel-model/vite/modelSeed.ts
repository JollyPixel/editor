// Import Third-party Dependencies
import {
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument
} from "@jolly-pixel/asset.voxel-model";

// CONSTANTS
export const TEXTURE_SIZE = { x: 64, y: 64 };

export function encodeTextureDocument(): Uint8Array {
  return encodePixelArtDocument(
    serializePixelBuffer(new PixelBuffer({ size: TEXTURE_SIZE }))
  );
}

export function encodeModelDocument(
  textureId: string
): Uint8Array {
  return encodeVoxelModelDocument(
    createVoxelModelDocument({
      texture: {
        id: textureId,
        kind: PIXEL_ART_KIND
      }
    })
  );
}
