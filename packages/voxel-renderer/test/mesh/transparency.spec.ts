// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  makeMeshFixture,
  countChunkVertices,
  buildGeometries,
  place
} from "../helpers/meshFixture.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "../helpers/ids.ts";
import { ChunkGeometryKey } from "../../src/mesh/ChunkGeometryKey.ts";

for (const greedy of [false, true]) {
  describe(`transparency boundaries (greedy=${greedy})`, () => {
    for (const cullCoveredFaces of [false, true]) {
      for (const transform of [0, 1, 4, 5]) {
        it(`keeps separated slabs (cull=${cullCoveredFaces}, transform=${transform})`, () => {
          const fixture = makeMeshFixture({ greedy });
          fixture.blockRegistry.register(makeBlockDef(kLeavesId, "slabBottom", {
            alphaMode: "blend",
            cullCoveredFaces
          }));
          place(fixture, [0, 0, 0], kLeavesId, transform);
          place(fixture, [0, 1, 0], kLeavesId, transform);

          assert.equal(countChunkVertices(fixture), 48);
        });
      }
    }

    it("keeps opposing front sides only on a retained shared boundary", () => {
      const fixture = makeMeshFixture({ greedy });
      fixture.blockRegistry.register(makeBlockDef(kLeavesId, "cube", {
        alphaMode: "blend",
        cullCoveredFaces: false
      }));
      place(fixture, [0, 0, 0], kLeavesId);
      place(fixture, [1, 0, 0], kLeavesId);

      const counts = new Map<string, number>();
      for (const [key, geometry] of buildGeometries(fixture)) {
        counts.set(
          ChunkGeometryKey.parse(key).surface.side,
          geometry.getAttribute("position").count
        );
      }

      assert.equal(counts.get("front"), 8);
      assert.equal(counts.get("double"), greedy ? 24 : 40);
    });

    for (const alphaMode of ["opaque", "mask", "blend"] as const) {
      it(`applies explicit layer replacement to ${alphaMode} blocks`, () => {
        const fixture = makeMeshFixture({ greedy });
        fixture.blockRegistry.register(makeBlockDef(kLeavesId, "cube", { alphaMode }));
        place(fixture, [0, 0, 0], kCubeId);
        place(fixture.world.addLayer("upper"), [0, 0, 0], kLeavesId);

        assert.equal(countChunkVertices(fixture), alphaMode === "opaque" ? 0 : 24);

        fixture.world.updateLayer("upper", { compositing: "replace" });
        assert.equal(countChunkVertices(fixture), 0);

        fixture.world.updateLayer("upper", { opacity: 0.5 });
        assert.equal(countChunkVertices(fixture), 24);
      });
    }
  });
}
