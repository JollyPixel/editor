// Import Third-party Dependencies
import {
  decodeVoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kEncoder = new TextEncoder();

export function parseVoxelWorld(
  text: string
): VoxelWorldJSON {
  return decodeVoxelDocument(
    kEncoder.encode(text)
  );
}
