// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  composeBlockId,
  type BlockShape,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import {
  DEFAULT_UV_SLOTS,
  rectOf,
  type UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockProjection } from "#src/projection/BlockProjection.ts";
import { makeResolvedBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();

function shapeOf(
  id: string
): BlockShape {
  const shape = kShapes.get(id);
  assert.ok(shape, `missing shape ${id}`);

  return shape;
}

describe("BlockProjection", () => {
  it("round-trips a local block id through its region id", () => {
    assert.equal(BlockProjection.regionIdOf(4), "block-4");
    assert.equal(BlockProjection.localBlockIdOf("block-4"), 4);
    assert.equal(BlockProjection.localBlockIdOf("block-x"), null);
    assert.equal(BlockProjection.localBlockIdOf("other-4"), null);
    assert.equal(BlockProjection.localBlockIdOf("block-0"), null);
    assert.equal(BlockProjection.localBlockIdOf("block-65536"), null);
  });

  it("names the region after the local id of a projected block", () => {
    const block = makeResolvedBlockDef(composeBlockId(2, 7), "cube");
    const projection = new BlockProjection(block, shapeOf("cube"), 8);

    assert.equal(projection.regionId, "block-7");
  });

  it("maps every cube face onto the block's tile", () => {
    const block = makeResolvedBlockDef(1, "cube", {
      defaultTexture: { col: 1, row: 2 }
    });
    const faces = new BlockProjection(block, shapeOf("cube"), 8).faces();

    assert.deepEqual(Object.keys(faces), [...DEFAULT_UV_SLOTS]);
    for (const geometry of Object.values(faces)) {
      assert.deepEqual(geometry, { x: 8, y: 16, width: 8, height: 8 });
    }
  });

  it("keeps the tile rotation on the face geometry", () => {
    const block = makeResolvedBlockDef(1, "cube", {
      defaultTexture: { col: 0, row: 0, rotation: 1 }
    });
    const faces = new BlockProjection(block, shapeOf("cube"), 8).faces();

    assert.deepEqual(faces.top, {
      x: 0,
      y: 0,
      width: 8,
      height: 8,
      rotation: 1
    });
  });

  it("maps a ramp side onto a triangle", () => {
    const block = makeResolvedBlockDef(1, "ramp");
    const faces = new BlockProjection(block, shapeOf("ramp"), 8).faces();

    assert.deepEqual(faces.left, {
      shape: "triangle",
      corner: "bottom-right",
      rect: { x: 0, y: 0, width: 8, height: 8 }
    });
    assert.equal(faces.back, undefined);
  });

  it("projects nothing for a block whose shape is unknown", () => {
    const block = makeResolvedBlockDef(1, "cube");
    const projection = new BlockProjection(block, undefined, 8);

    assert.equal(projection.textured, false);
    assert.equal(projection.isBox, true);
    assert.deepEqual(projection.faces(), {});
    assert.deepEqual(projection.islandFaces(), []);
  });

  it("gives one island face per textured slot", () => {
    const block = makeResolvedBlockDef(3, "ramp");
    const faces = new BlockProjection(block, shapeOf("ramp"), 8).islandFaces();

    assert.equal(faces.length, 5);
    assert.ok(faces.every(({ regionId }) => regionId === "block-3"));
  });

  it("reads every slot as one tile in the stacked faces", () => {
    const block = makeResolvedBlockDef(1, "ramp", {
      faceTextures: { top: { col: 0, row: 0 } }
    });
    const projection = new BlockProjection(block, shapeOf("ramp"), 8);

    assert.ok(heightOf(projection.faces().top) > 8);
    assert.equal(heightOf(projection.stackedFaces().top), 8);
  });

  it("spans an island only over the tile area the renderer samples", () => {
    const shared = makeResolvedBlockDef(1, "ramp");
    const owned = makeResolvedBlockDef(2, "ramp", {
      faceTextures: { top: { col: 0, row: 0 } }
    });

    assert.equal(topIslandHeight(shared), 8);
    assert.ok(topIslandHeight(owned) > 8);
  });
});

function heightOf(
  geometry: UVGeometry
): number {
  return rectOf(geometry).height;
}

function topIslandHeight(
  block: ResolvedBlockDefinition
): number {
  const projection = new BlockProjection(block, shapeOf("ramp"), 8);
  const faces = projection.islandFaces();
  const top = faces[projection.layout.slots.findIndex(
    ({ slot }) => slot === "top"
  )];

  return heightOf(top.geometry);
}
