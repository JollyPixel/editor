// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { setName } from "#src/boot/animationSetSource.ts";

describe("setName", () => {
  test("keeps the file name without folders or extension", () => {
    assert.equal(setName("animations/Humanoid Walk.voxelanim.json"), "Humanoid Walk");
    assert.equal(setName("odd.txt"), "odd.txt");
  });
});
