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
  BlockShapeRegistry,
  TilesetManager,
  VoxelTransform
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { GhostBlock } from "../../../../src/features/painting/rendering/GhostBlock.ts";
import { TileOpacityProbe } from "../../../../src/features/blocks/tileOpacity.ts";
import type { GhostTarget } from "../../../../src/features/painting/model/ghostTarget.ts";

function ghostOf(): GhostBlock {
  const tilesetManager = new TilesetManager();

  return new GhostBlock({
    blockRegistry: new BlockRegistry([
      {
        id: 1,
        name: "Ramp",
        shapeId: "ramp"
      }
    ]),
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    tileOpacity: new TileOpacityProbe(tilesetManager, () => null)
  });
}

function targetOf(
  patch: Partial<GhostTarget> = {}
): GhostTarget {
  return {
    position: {
      x: 2,
      y: 0,
      z: -1
    },
    blockId: 1,
    transform: VoxelTransform.Identity,
    overlay: false,
    ...patch
  };
}

function meshOf(
  ghost: GhostBlock
): THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
  const [mesh] = ghost.children;
  assert.ok(mesh instanceof THREE.Mesh);
  assert.ok(Array.isArray(mesh.material));

  return mesh;
}

describe("GhostBlock", () => {
  test("starts hidden", () => {
    assert.equal(ghostOf().visible, false);
  });

  test("centres the block on its cell", () => {
    const ghost = ghostOf();

    assert.equal(ghost.draw(targetOf()), true);
    assert.equal(ghost.visible, true);
    assert.deepEqual(ghost.position.toArray(), [2.5, 0.5, -0.5]);
    assert.deepEqual(ghost.scale.toArray(), [1, 1, 1]);

    const { geometry } = meshOf(ghost);
    geometry.computeBoundingBox();
    assert.deepEqual(geometry.boundingBox?.min.toArray(), [-0.5, -0.5, -0.5]);
    assert.deepEqual(geometry.boundingBox?.max.toArray(), [0.5, 0.5, 0.5]);
  });

  test("draws semi-transparent without writing depth", () => {
    const ghost = ghostOf();
    ghost.draw(targetOf());
    const [material] = meshOf(ghost).material;

    assert.equal(material.transparent, true);
    assert.ok(material.opacity < 1);
    assert.equal(material.depthWrite, false);
  });

  test("slightly grows over an existing block", () => {
    const ghost = ghostOf();
    ghost.draw(targetOf({ overlay: true }));

    assert.ok(ghost.scale.x > 1);
  });

  test("reuses the geometry of an orientation it already built", () => {
    const ghost = ghostOf();

    ghost.draw(targetOf());
    const identity = meshOf(ghost).geometry;
    ghost.draw(targetOf({
      transform: new VoxelTransform({ rotation: 1 })
    }));
    const rotated = meshOf(ghost).geometry;
    ghost.draw(targetOf());

    assert.notEqual(rotated, identity);
    assert.equal(meshOf(ghost).geometry, identity);
  });

  test("hides itself for an unknown block", () => {
    const ghost = ghostOf();
    ghost.draw(targetOf());

    assert.equal(ghost.draw(targetOf({ blockId: 99 })), false);
    assert.equal(ghost.visible, false);
  });
});
