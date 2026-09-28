// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  type VoxelCoord,
  type VoxelEntry,
  type VoxelLayer,
  VoxelWorld
} from "../../src/document/world/index.ts";
import {
  serializeVoxelLayer,
  type VoxelLayerJSON
} from "../../src/document/serialization/index.ts";
import { makeVoxelEntry } from "./voxelEntry.ts";

export interface TwoLayerWorld {
  world: VoxelWorld;
  a: VoxelLayer;
  b: VoxelLayer;
}

export function writeVoxel(
  world: VoxelWorld,
  layerName: string,
  position: VoxelCoord,
  entry: VoxelEntry = makeVoxelEntry()
): void {
  world.silently(() => world.patchVoxels(layerName, [
    position.x,
    position.y,
    position.z,
    entry.blockId,
    entry.transform
  ]));
}

export function eraseVoxel(
  world: VoxelWorld,
  layerName: string,
  position: VoxelCoord
): void {
  world.silently(() => world.patchVoxels(layerName, [
    position.x,
    position.y,
    position.z,
    0,
    0
  ]));
}

export function makeTwoLayerWorld(): TwoLayerWorld {
  const world = new VoxelWorld(4);
  const a = world.addLayer("A");
  const b = world.addLayer("B");
  writeVoxel(world, "A", { x: 0, y: 0, z: 0 });
  writeVoxel(world, "B", { x: 8, y: 0, z: 0 });

  return { world, a, b };
}

export function clearAllDirty(
  world: VoxelWorld
): void {
  for (const { chunk } of world.getAllChunks()) {
    chunk.dirty = false;
  }
}

export function dirtyFlags(
  { a, b }: TwoLayerWorld
): { a: boolean; b: boolean; } {
  const chunkA = a.getChunk(0, 0, 0);
  const chunkB = b.getChunk(2, 0, 0);
  assert.ok(chunkA && chunkB, "both layers must still own their chunk");

  return { a: chunkA.dirty, b: chunkB.dirty };
}

export function withoutId(
  layer: VoxelLayer
): Omit<VoxelLayerJSON, "id"> {
  const { id, ...rest } = serializeVoxelLayer(layer);

  return rest;
}

export function voxelContent(
  layer: VoxelLayer
): Pick<VoxelLayerJSON, "palette" | "chunks"> {
  const { palette, chunks } = serializeVoxelLayer(layer);

  return { palette, chunks };
}
