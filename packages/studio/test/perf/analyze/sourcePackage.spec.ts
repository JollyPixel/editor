// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sourcePackage } from "../../../perf/analyze/sourcePackage.ts";

// CONSTANTS
const kCases = [
  ["file:///repo/node_modules/.pnpm/three@0.180.0/node_modules/three/build/three.module.js", "three"],
  ["C:\\repo\\node_modules\\@lit\\reactive-element\\css-tag.js", "@lit/reactive-element"],
  ["../../packages/editors/voxel-map/src/index.ts", "@jolly-pixel/editor.voxel-map"],
  ["../../packages/assets/scene/src/index.ts", "@jolly-pixel/asset.scene"],
  ["../../packages/voxel-renderer/src/index.ts", "@jolly-pixel/voxel-renderer"],
  ["../src/main.ts", "(this package)"]
] as const;

describe("sourcePackage", () => {
  for (const [source, expected] of kCases) {
    test(`names ${expected} for ${source}`, () => {
      assert.equal(sourcePackage(source), expected);
    });
  }
});
