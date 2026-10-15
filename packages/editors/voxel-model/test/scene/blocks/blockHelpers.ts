// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";
import {
  BlockTransform,
  type BlockTransformJSON,
  type ModelDocument,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ModelBlock,
  type ModelBlockOptions
} from "#src/scene/blocks/ModelBlock.ts";
import { FlatShading } from "#src/scene/blocks/FlatShading.ts";

// CONSTANTS
const kFlatShading = new FlatShading();

export function createBlock(
  options: Omit<ModelBlockOptions, "flatShading"> = {}
): ModelBlock {
  return new ModelBlock({
    ...options,
    flatShading: kFlatShading
  });
}

export function transformAt(
  position: { x: number; y: number; z: number; }
): BlockTransformJSON {
  return BlockTransform.create({ position });
}

export function recordCommands(
  document: ModelDocument
): VoxelModelCommand[] {
  const commands: VoxelModelCommand[] = [];
  document.on("change", (change) => commands.push(change.command));

  return commands;
}

export function assertCloseTo(
  actual: THREE.Vector3,
  expected: [number, number, number]
): void {
  actual.toArray().forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) < 1e-6,
      `axis ${index}: ${value} is not ${expected[index]}`
    );
  });
}
