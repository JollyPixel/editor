// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TurntableAngles
} from "../../../../src/features/blocks/library/TurntableAngles.ts";

// CONSTANTS
const kRest = {
  yaw: 1,
  pitch: 0.4
};

describe("TurntableAngles", () => {
  it("starts every block at rest and spins it from where it stands", () => {
    const angles = new TurntableAngles(kRest, 0.5);

    assert.deepEqual(angles.angleForBlock(7), kRest);
    assert.equal(angles.advance(7).yaw, 1.5);
    assert.deepEqual(angles.advance(7), {
      yaw: 2,
      pitch: 0.4
    });
    assert.equal(angles.angleForBlock(7).yaw, 2);
    assert.deepEqual(angles.angleForBlock(8), kRest);
  });

  it("forgets the blocks it is not told to keep", () => {
    const angles = new TurntableAngles(kRest, 0.5);
    angles.advance(7);
    angles.advance(8);

    angles.keep([8]);

    assert.equal(angles.angleForBlock(7).yaw, 1);
    assert.equal(angles.angleForBlock(8).yaw, 1.5);
  });
});
