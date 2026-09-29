// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayerVisibility } from "../../src/view/VoxelLayerVisibility.ts";

function layer(
  name: string,
  visible: boolean
) {
  return {
    name,
    visible,
    compositing: "composite" as const,
    position: { x: 0, y: 0, z: 0 },
    getChunk: () => undefined
  };
}

describe("VoxelLayerVisibility", () => {
  it("follows the layer until overridden by name", () => {
    const visibility = new VoxelLayerVisibility();

    assert.equal(visibility.isVisible(layer("Ground", true)), true);
    visibility.override("Ground", false);
    assert.equal(visibility.isVisible(layer("Ground", true)), false);
    assert.equal(visibility.isVisible(layer("Top", false)), false);
    visibility.override("Top", true);
    assert.equal(visibility.isVisible(layer("Top", false)), true);
    assert.deepEqual([...visibility.overrides], [["Ground", false], ["Top", true]]);
  });

  it("reports a change only when an override changes", () => {
    let changes = 0;
    const visibility = new VoxelLayerVisibility(() => {
      changes++;
    });

    visibility.override("Ground", false);
    visibility.override("Ground", false);
    visibility.reset("Top");
    visibility.reset("Ground");
    visibility.clear();
    visibility.override("Top", true);
    visibility.clear();

    assert.equal(changes, 4);
    assert.equal(visibility.overrides.size, 0);
  });
});
