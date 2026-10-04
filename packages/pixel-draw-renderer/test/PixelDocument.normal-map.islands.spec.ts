// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { IslandFace } from "#src/normal/types.ts";
import {
  addRegion,
  createNormalMapDocument
} from "./helpers/document/normalMap.ts";

describe("PixelDocument normal map", () => {
  describe("islands", () => {
    test("are kept until a UV region changes", () => {
      const doc = createNormalMapDocument();
      let changes = 0;
      doc.on("islands-changed", () => changes++);
      const islands = doc.islands;

      assert.equal(doc.islands, islands);

      addRegion(doc, "tile");

      assert.equal(changes, 1);
      assert.notEqual(doc.islands, islands);
      assert.equal(doc.islands.islandsOf("tile").length, 1);
    });

    test("are rebuilt after a resize", () => {
      const doc = createNormalMapDocument();
      let changes = 0;
      doc.on("islands-changed", () => changes++);
      const islands = doc.islands;

      doc.resize({ x: 4, y: 4 });

      assert.equal(changes, 1);
      assert.notEqual(doc.islands, islands);
    });

    test("an idle normal map reads the current islands", () => {
      const doc = createNormalMapDocument();
      assert.equal(doc.normals.islands.islandsOf("tile").length, 0);

      addRegion(doc, "tile");

      assert.equal(doc.normals.islands.islandsOf("tile").length, 1);
    });

    test("follow the supplied faces instead of the UV regions", () => {
      const doc = createNormalMapDocument();
      const faces: IslandFace[] = [{
        regionId: "brick",
        geometry: { x: 0, y: 0, width: 4, height: 4 }
      }];
      let changes = 0;
      doc.on("islands-changed", () => changes++);

      const release = doc.useIslandFaces(() => faces);
      addRegion(doc, "tile");

      assert.equal(changes, 1);
      assert.equal(doc.islands.islandsOf("brick").length, 1);
      assert.equal(doc.islands.islandsOf("tile").length, 0);

      faces.push({
        regionId: "glass",
        geometry: { x: 4, y: 4, width: 4, height: 4 }
      });
      doc.invalidateIslands();

      assert.equal(changes, 2);
      assert.equal(doc.islands.islandsOf("glass").length, 1);

      release();

      assert.equal(changes, 3);
      assert.equal(doc.islands.islandsOf("brick").length, 0);
      assert.equal(doc.islands.islandsOf("tile").length, 1);
    });

    test("a stale release keeps the newer faces", () => {
      const doc = createNormalMapDocument();
      const release = doc.useIslandFaces(() => []);
      doc.useIslandFaces(() => [{
        regionId: "brick",
        geometry: { x: 0, y: 0, width: 4, height: 4 }
      }]);

      release();

      assert.equal(doc.islands.islandsOf("brick").length, 1);
    });
  });
});
