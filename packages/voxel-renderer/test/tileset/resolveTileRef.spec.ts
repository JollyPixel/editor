// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveTileRef } from "../../src/tileset/resolve.ts";

describe("resolveTileRef", () => {
  it("expands a tuple, taking the default tileset", () => {
    assert.deepEqual(resolveTileRef([2, 3], "atlas"), {
      col: 2,
      row: 3,
      tilesetId: "atlas"
    });
  });

  it("keeps an explicit tilesetId over the default one", () => {
    assert.deepEqual(resolveTileRef({ col: 1, row: 1, tilesetId: "decor" }, "atlas"), {
      col: 1,
      row: 1,
      tilesetId: "decor"
    });
  });

  it("leaves tilesetId out when neither side provides one", () => {
    assert.deepEqual(resolveTileRef({ col: 1, row: 1 }), {
      col: 1,
      row: 1
    });
  });

  it("copies the reference instead of mutating it", () => {
    const ref = { col: 1, row: 1 };
    const resolved = resolveTileRef(ref, "atlas");

    assert.notEqual(resolved, ref);
    assert.deepEqual(ref, { col: 1, row: 1 });
  });
});
