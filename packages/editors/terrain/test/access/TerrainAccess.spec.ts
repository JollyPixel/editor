// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Grants } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  canImportHeights,
  canUseTool,
  TERRAIN_CAPABILITIES,
  type TerrainCapability
} from "#src/access/TerrainAccess.ts";
import { BRUSH_TOOLS } from "#src/features/sculpt/model/SculptSettings.ts";

function resolved(
  denied: readonly string[]
): Grants<TerrainCapability> {
  return TERRAIN_CAPABILITIES.resolveGrants({
    can: (event) => (denied.includes(event) ? "read" : "write")
  });
}

describe("TerrainAccess", () => {
  test("no tool is usable and no import allowed when every command is refused", () => {
    const { none } = TERRAIN_CAPABILITIES;

    assert.equal(BRUSH_TOOLS.some((tool) => canUseTool(none, tool)), false);
    assert.equal(canImportHeights(none), false);
  });

  test("a refused command takes away only the tools that write it", () => {
    const access = resolved(["splat-patched"]);

    assert.deepEqual(BRUSH_TOOLS.filter((tool) => !canUseTool(access, tool)), ["paint"]);
  });

  test("importing a heightmap needs chunk rights, since it adds chunks and changes tiers", () => {
    assert.equal(canImportHeights(resolved(["heights-patched"])), false);
    assert.equal(canImportHeights(resolved(["chunk-added"])), false);
    assert.equal(canImportHeights(resolved([])), true);
  });
});
