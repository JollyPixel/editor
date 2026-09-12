// Import Node.js Dependencies
import assert from "node:assert/strict";
import { it } from "node:test";

// Import Internal Dependencies
import { BlockShapeRegistry } from "../../src/blocks/shape/index.ts";
import { BlockVariantCache } from "../../src/mesh/variants/BlockVariantCache.ts";
import type { BlockVariantFace } from "../../src/mesh/variants/types.ts";
import { splitBoundaryFace } from "../../src/mesh/neighbourhood/splitBoundaryFace.ts";
import { FACE } from "../../src/utils/math.ts";
import { makeMeshFixture } from "../helpers/meshFixture.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

function projectedArea(face: BlockVariantFace): number {
  let twiceArea = 0;
  for (let vertexIndex = 0; vertexIndex < face.vertexCount; vertexIndex++) {
    const nextIndex = (vertexIndex + 1) % face.vertexCount;
    const height = face.positions[vertexIndex * 3 + 1];
    const depth = face.positions[vertexIndex * 3 + 2];
    twiceArea += height * face.positions[nextIndex * 3 + 2] -
      depth * face.positions[nextIndex * 3 + 1];
  }

  return Math.abs(twiceArea) / 2;
}

for (const remove of [false, true]) {
  it(`splits partial slab coverage without losing exposed area (remove=${remove})`, () => {
    const fixture = makeMeshFixture();
    fixture.blockRegistry.register(makeBlockDef(4, "slabBottom", {
      alphaMode: "blend"
    }));
    const variants = new BlockVariantCache({
      blockRegistry: fixture.blockRegistry,
      tilesetManager: fixture.tilesetManager,
      shapeRegistry: BlockShapeRegistry.createDefault()
    });
    const face = variants.get(1, 0)!.faces.find((face) => face.cull === FACE.PosX)!;
    const neighbour = variants.get(4, 0)!.faces.find((face) => face.cull === FACE.NegX)!;
    const originalPositions = face.positions.slice();
    const frontSlot = 100;
    const pieces = splitBoundaryFace({ face, neighbour, frontSlot, remove });
    const exposed = pieces.filter((piece) => piece.slot === face.slot);
    const shared = pieces.filter((piece) => piece.slot === frontSlot);
    assert.equal(exposed.reduce((area, piece) => area + projectedArea(piece), 0), 0.5);
    assert.equal(shared.reduce((area, piece) => area + projectedArea(piece), 0), remove ? 0 : 0.5);
    assert.deepEqual(face.positions, originalPositions);
    for (const piece of exposed) {
      assert.equal(piece.merge, null);
      for (let vertexIndex = 0; vertexIndex < piece.vertexCount; vertexIndex++) {
        assert.ok(piece.positions[vertexIndex * 3 + 1] >= 0.5);
        assert.ok(piece.tileUvs[vertexIndex * 2] >= 0);
        assert.ok(piece.tileUvs[vertexIndex * 2] <= 1);
        assert.ok(piece.tileUvs[vertexIndex * 2 + 1] >= 0);
        assert.ok(piece.tileUvs[vertexIndex * 2 + 1] <= 1);
      }
    }
  });
}
