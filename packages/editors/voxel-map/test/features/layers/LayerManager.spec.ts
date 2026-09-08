// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { layerManagerStyles } from "../../../src/features/layers/LayerManager.styles.ts";

describe("LayerManager", () => {
  test("uses the workspace spacing token around the layer tree", () => {
    assert.match(
      layerManagerStyles.cssText,
      /jolly-tree\s*{[^}]*margin-inline:\s*var\(--jolly-space-1, 4px\)/
    );
  });
});
