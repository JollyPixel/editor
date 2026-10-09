// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  MaterialPreviews,
  type PreviewOwner
} from "#src/state/index.ts";

// CONSTANTS
const kStored = MaterialSurface.create({ opacity: 0.5 });

describe("MaterialPreviews", () => {
  test("shows peers' layers in client order under this person's layer", () => {
    const previews = new MaterialPreviews();

    previews.set("glass", null, { metalness: 0.9 });
    previews.set("glass", "zoe", { roughness: 0.1, metalness: 0.2 });
    previews.set("glass", "bob", { roughness: 0.3, color: "#ff0000" });

    assert.deepEqual(
      previews.surfaceOf("glass", kStored),
      { ...kStored, roughness: 0.1, metalness: 0.9, color: "#ff0000" }
    );
    assert.deepEqual(previews.surfaceOf("metal", kStored), kStored);
  });

  test("tells which material and owner each change is for, and only real changes", () => {
    const previews = new MaterialPreviews();
    const changes: Array<[string, PreviewOwner]> = [];
    previews.on("change", (materialId, owner) => changes.push([materialId, owner]));

    previews.set("glass", "bob", { roughness: 0.3 });
    previews.end("glass", "bob");
    previews.end("glass", "bob");
    previews.end("metal", null);

    assert.deepEqual(changes, [["glass", "bob"], ["glass", "bob"]]);
    assert.equal(previews.layer("glass", "bob"), undefined);
    assert.deepEqual(previews.surfaceOf("glass", kStored), kStored);
  });
});
