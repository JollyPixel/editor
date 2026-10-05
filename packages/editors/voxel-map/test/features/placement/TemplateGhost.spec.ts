// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockRegistry,
  TilesetAtlases,
  VoxelTemplate,
  VoxelTransform,
  packVoxel
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TemplateGhost } from "../../../src/features/placement/TemplateGhost.ts";
import { sourcesOf } from "../../helpers/blockSources.ts";

// CONSTANTS
const kSlabBottom = 1;
const kSlabTop = 2;

function ghostOf(): TemplateGhost {
  return new TemplateGhost({
    blockRegistry: new BlockRegistry([
      {
        id: kSlabBottom,
        name: "Slab bottom",
        shapeId: "slabBottom"
      },
      {
        id: kSlabTop,
        name: "Slab top",
        shapeId: "slabTop"
      }
    ]),
    sources: sourcesOf(new TilesetAtlases())
  });
}

function heightOf(
  ghost: TemplateGhost
): number {
  const bounds = new THREE.Box3();
  for (const child of ghost.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.computeBoundingBox();
      bounds.union(child.geometry.boundingBox!);
    }
  }

  return bounds.max.y - bounds.min.y;
}

describe("TemplateGhost", () => {
  test("draws both shapes of a merged cell", () => {
    const ghost = ghostOf();
    ghost.draw(
      new VoxelTemplate({
        id: "pair",
        name: "Pair",
        positions: [0, 0, 0],
        voxels: [packVoxel(kSlabBottom, 0)],
        partners: [packVoxel(kSlabTop, 0)]
      }),
      VoxelTransform.Identity
    );

    assert.equal(heightOf(ghost), 1);
  });

  test("draws the single shape of an unmerged cell", () => {
    const ghost = ghostOf();
    ghost.draw(
      new VoxelTemplate({
        id: "slab",
        name: "Slab",
        positions: [0, 0, 0],
        voxels: [packVoxel(kSlabBottom, 0)]
      }),
      VoxelTransform.Identity
    );

    assert.equal(heightOf(ghost), 0.5);
  });
});
