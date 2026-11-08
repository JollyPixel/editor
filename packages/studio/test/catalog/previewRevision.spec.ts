// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  previewRevision,
  type PreviewRevisionCatalog
} from "../../src/catalog/previewRevision.ts";

function createCatalog(
  revisions: Record<string, string>
): PreviewRevisionCatalog {
  const catalog = {
    record: (assetId: string) => (
      assetId in revisions ?
        {
          revision: revisions[assetId]
        } :
        undefined
    ),
    dependencies: {
      transitiveDependencies: (assetId: string) => (
        assetId === "model" ?
          [
            {
              id: "texture",
              kind: "pixelart"
            }
          ] :
          []
      )
    }
  };

  return catalog as unknown as PreviewRevisionCatalog;
}

describe("previewRevision", () => {
  test("keys an asset without dependencies on its own revision", () => {
    const catalog = createCatalog({ texture: "t1" });

    assert.strictEqual(previewRevision(catalog, "texture"), "t1");
  });

  test("changes when a dependency moves alone", () => {
    const before = previewRevision(
      createCatalog({ model: "r1", texture: "t1" }),
      "model"
    );
    const after = previewRevision(
      createCatalog({ model: "r1", texture: "t2" }),
      "model"
    );

    assert.notStrictEqual(after, before);
    assert.strictEqual(
      previewRevision(createCatalog({ model: "r1", texture: "t2" }), "model"),
      after
    );
  });
});
