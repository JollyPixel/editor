// Import Third-party Dependencies
import {
  decodeVoxelMapDocument
} from "@jolly-pixel/voxel.renderer/asset/VoxelMapDocument.ts";
import type { VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";

const kEncoder = new TextEncoder();

export function parseVoxelWorld(
  text: string
): VoxelWorldJSON {
  return decodeVoxelMapDocument(
    kEncoder.encode(text)
  );
}
