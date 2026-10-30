// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  claimingDrop,
  type TextureFileDrop
} from "../../../src/textures/import/TextureFileDrop.ts";

// CONSTANTS
const kBlocksetDrop: TextureFileDrop = {
  types: ["application/zip", "application/json"],
  extensions: [".zip", ".blockset.json"],
  label: "Drop blockset to add",
  drop: () => undefined
};

describe("claimingDrop", () => {
  test("claims a dragged file by its MIME type", () => {
    assert.equal(claimingDrop([kBlocksetDrop], { type: "application/zip" }), kBlocksetDrop);
    assert.equal(claimingDrop([kBlocksetDrop], { type: "image/png" }), undefined);
  });

  test("claims a dropped file by its name ending, ignoring case", () => {
    assert.equal(claimingDrop([kBlocksetDrop], new File([""], "Stone.BLOCKSET.json")), kBlocksetDrop);
    assert.equal(claimingDrop([kBlocksetDrop], new File([""], "grass.png")), undefined);
  });

  test("claims on drop a file whose type showed the overlay, whatever its name", () => {
    const notes = new File(["{}"], "notes.json", { type: "application/json" });

    assert.equal(claimingDrop([kBlocksetDrop], notes), kBlocksetDrop);
  });
});
