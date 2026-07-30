// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { compileGlobPattern } from "../../src/utils/glob.ts";

describe("compileGlobPattern", () => {
  test("matches a literal pattern with no \"*\" exactly", () => {
    const regex = compileGlobPattern("voxel.renderer.voxel-set");

    assert.strictEqual(regex.test("voxel.renderer.voxel-set"), true);
    assert.strictEqual(regex.test("voxel.renderer.voxel-setX"), false);
    assert.strictEqual(regex.test("Xvoxel.renderer.voxel-set"), false);
  });

  test("a literal \".\" only matches a literal \".\", not \"any character\"", () => {
    const regex = compileGlobPattern("voxel.renderer.voxel-set");

    assert.strictEqual(regex.test("voxelXrendererXvoxel-set"), false);
  });

  test("a trailing \"*\" matches any suffix, including an empty one", () => {
    const regex = compileGlobPattern("voxel.renderer.*");

    assert.strictEqual(regex.test("voxel.renderer."), true);
    assert.strictEqual(regex.test("voxel.renderer.voxel-set"), true);
    assert.strictEqual(regex.test("voxel.renderer.object-added"), true);
    assert.strictEqual(regex.test("voxel.other.voxel-set"), false);
  });

  test("\"*\" matches across namespace separators too, not just within one segment", () => {
    const regex = compileGlobPattern("*.$join");

    assert.strictEqual(regex.test("voxel.renderer.$join"), true);
    assert.strictEqual(regex.test("pixel-draw.$join"), true);
  });

  test("other regex-special characters in the pattern are escaped and treated literally", () => {
    const regex = compileGlobPattern("voxel-set+1");

    assert.strictEqual(regex.test("voxel-set+1"), true);
    assert.strictEqual(regex.test("voxel-set1"), false);
  });
});
