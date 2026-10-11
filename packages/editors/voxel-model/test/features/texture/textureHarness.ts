// Import Third-party Dependencies
import {
  PixelDocument,
  type PixelCommand
} from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockTransform,
  type ModelChange,
  type UVLayoutData,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { BlockTextures } from "#src/features/texture/BlockTextures.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { createModelFixture } from "../../fixtures/model.ts";
import { modelAccess } from "../../fixtures/modelAccess.ts";

// CONSTANTS
export const TEXTURE_SIZE = { x: 256, y: 256 };
export const TORSO_REGION_ID = "block-torso";

export function stackedAt(
  x: number,
  y = 0
): UVLayoutData {
  return {
    state: "stacked",
    rect: { x, y, width: 16, height: 16 }
  };
}

export function torsoSnapshot(
  uv: UVLayoutData
): VoxelModelSnapshot {
  return {
    nodes: [
      {
        kind: "block",
        id: "torso",
        parentId: null,
        name: "Torso",
        transform: BlockTransform.create(),
        uv
      }
    ],
    materials: [],
    animationSets: []
  };
}

export function createTextureHarness() {
  const pixelEvents: PixelCommand[] = [];
  const pixels = new PixelDocument({
    size: TEXTURE_SIZE
  });
  pixels.on("command", (command) => pixelEvents.push(command));
  const { document, blocks, selection, addBlock } = createModelFixture();
  const frames = { requested: 0 };
  const access = modelAccess();
  const textures = new BlockTextures({
    pixels,
    document,
    blocks,
    selection,
    access,
    requestFrame: () => frames.requested++
  });
  const changes: ModelChange[] = [];
  document.on("change", (change) => changes.push(change));

  return {
    access,
    pixels,
    pixelEvents,
    uv: pixels.uv,
    document,
    blocks,
    selection,
    addBlock,
    textures,
    changes,
    frames
  };
}

export function uvOf(
  block: ModelBlock,
  index: number
): [number, number] {
  const attribute = block.mesh.geometry.getAttribute("uv");

  return [attribute.getX(index), attribute.getY(index)];
}

export function regionIdOf(
  block: ModelBlock
): string {
  return `block-${block.uuid}`;
}
