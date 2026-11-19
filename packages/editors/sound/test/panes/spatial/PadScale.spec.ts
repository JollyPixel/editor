// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PadScale } from "#src/panes/spatial/PadScale.ts";

describe("PadScale", () => {
  for (const { distance, extent } of [
    {
      distance: 3,
      extent: 10
    },
    {
      distance: 18,
      extent: 100
    },
    {
      distance: 100,
      extent: 100
    },
    {
      distance: 150,
      extent: 1_000
    }
  ]) {
    test(`covers ${distance} units with a pad edge at ${extent} units`, () => {
      assert.equal(PadScale.covering(distance).extent, extent);
    });
  }

  test("keeps the same edge while the covered distance stays in its decade", () => {
    assert.equal(
      PadScale.covering(16).extent,
      PadScale.covering(32).extent
    );
  });

  test("places the listener at the centre and the edge distance on the rim", () => {
    const scale = new PadScale(99);

    assert.equal(scale.radius(0), 0);
    assert.equal(scale.radius(99), 1);
    assert.equal(scale.radius(9), 0.5);
  });

  test("maps a pad point back to the world along the same direction", () => {
    const world = new PadScale(99).toWorld({
      x: 0,
      z: -0.5
    });

    assert.deepEqual(
      [Math.round(world.x * 1e9) / 1e9 + 0, Math.round(world.z * 1e9) / 1e9],
      [0, -9]
    );
  });
});
