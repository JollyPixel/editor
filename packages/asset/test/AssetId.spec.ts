// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetId } from "../src/index.ts";

describe("AssetId", () => {
  test("rejects a blank identifier", () => {
    for (const value of ["", " "]) {
      assert.throws(
        () => new AssetId(value),
        {
          name: "TypeError",
          message: /must not be empty/
        }
      );
    }
  });

  test("from wraps a string and keeps an existing AssetId", () => {
    const id = new AssetId("hero-model");

    assert.equal(AssetId.from("hero-model").value, "hero-model");
    assert.equal(AssetId.from(id), id);
  });

  test("equals compares values", () => {
    const id = new AssetId("hero-model");

    assert.ok(id.equals(new AssetId("hero-model")));
    assert.ok(!id.equals(new AssetId("theme-music")));
  });

  test("serializes as its value", () => {
    const id = new AssetId("hero-model");

    assert.equal(`${id}`, "hero-model");
    assert.equal(JSON.stringify({ id }), "{\"id\":\"hero-model\"}");
  });
});
