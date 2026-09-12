// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  makeMeshFixture,
  countChunkVertices,
  buildGeometries
} from "../helpers/meshFixture.ts";
import { ChunkGeometryKey } from "../../src/mesh/ChunkGeometryKey.ts";

for (const greedy of [false, true]) {
  describe(`transparency boundaries (greedy=${greedy})`, () => {
    for (const cullSelfFaces of [false, true]) {
      for (const transform of [0, 1, 4, 5]) {
        it(`keeps separated slabs (cull=${cullSelfFaces}, transform=${transform})`, () => {
          const fixture = makeMeshFixture({ greedy });
          fixture.blockRegistry.register(makeBlockDef(4, "slabBottom", {
            alphaMode: "blend", cullSelfFaces
          }));
          for (const height of [0, 1]) {
            fixture.layer.setVoxelAt({ x: 0, y: height, z: 0 }, { blockId: 4, transform });
          }
          assert.equal(countChunkVertices(fixture), 48);
        });
      }
    }

    it("keeps opposing front sides only on a retained shared boundary", () => {
      const fixture = makeMeshFixture({ greedy });
      fixture.blockRegistry.register(makeBlockDef(4, "cube", {
        alphaMode: "blend", cullSelfFaces: false
      }));
      for (const column of [0, 1]) {
        fixture.layer.setVoxelAt({ x: column, y: 0, z: 0 }, { blockId: 4, transform: 0 });
      }
      const counts = new Map<string, number>();
      for (const [key, geometry] of buildGeometries(fixture)) {
        counts.set(ChunkGeometryKey.parse(key).surface.side,
          geometry.getAttribute("position").count);
      }
      assert.equal(counts.get("front"), 8);
      assert.equal(counts.get("double"), 40);
    });

    for (const alphaMode of ["opaque", "mask", "blend"] as const) {
      it(`applies explicit layer replacement to ${alphaMode} blocks`, () => {
        const fixture = makeMeshFixture({ greedy });
        fixture.blockRegistry.register(makeBlockDef(4, "cube", { alphaMode }));
        fixture.layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 1, transform: 0 });
        const upper = fixture.world.addLayer("upper");
        upper.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 4, transform: 0 });
        assert.equal(countChunkVertices(fixture), alphaMode === "opaque" ? 0 : 24);
        fixture.world.updateLayer("upper", { compositing: "replace" });
        assert.equal(countChunkVertices(fixture), 0);
        fixture.world.updateLayer("upper", { opacity: 0.5 });
        assert.equal(countChunkVertices(fixture), 24);
      });
    }
  });
}
