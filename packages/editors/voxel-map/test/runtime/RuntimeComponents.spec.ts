// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  RUNTIME_COMPONENTS,
  VOXEL_MAP_DEFINITION
} from "../../src/runtime/index.ts";

describe("RUNTIME_COMPONENTS", () => {
  it("uses physics only for a voxel map whose collision is on", () => {
    const usesPhysics =
      RUNTIME_COMPONENTS.usesPhysics?.[VOXEL_MAP_DEFINITION.type];
    const settings: Systems.JSONObject[] = [
      { collision: true },
      {},
      { collision: "yes" }
    ];

    assert.deepStrictEqual(
      settings.map((data) => usesPhysics?.(data)),
      [true, false, false]
    );
  });
});
