// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type VoxelLayer, VoxelWorld } from "../../src/world/index.ts";
import { makeVoxelEntry } from "./voxelEntry.ts";

export interface TwoLayerWorld {
  world: VoxelWorld;
  a: VoxelLayer;
  b: VoxelLayer;
}

export function makeTwoLayerWorld(): TwoLayerWorld {
  const world = new VoxelWorld(4);
  const a = world.addLayer("A");
  const b = world.addLayer("B");
  world.setVoxelAt("A", { x: 0, y: 0, z: 0 }, makeVoxelEntry());
  world.setVoxelAt("B", { x: 8, y: 0, z: 0 }, makeVoxelEntry());

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
): Omit<ReturnType<VoxelLayer["toJSON"]>, "id"> {
  const { id, ...rest } = layer.toJSON();

  return rest;
}
