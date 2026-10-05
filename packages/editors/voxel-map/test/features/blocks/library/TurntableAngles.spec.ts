// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TurntableAngles
} from "../../../../src/features/blocks/library/TurntableAngles.ts";

describe("TurntableAngles", () => {
  it("starts every block at rest and spins it from where it stands", () => {
    const angles = new TurntableAngles(1, 0.5);

    assert.equal(angles.of(7), 1);
    assert.equal(angles.advance(7), 1.5);
    assert.equal(angles.advance(7), 2);
    assert.equal(angles.of(7), 2);
    assert.equal(angles.of(8), 1);
  });

  it("forgets the blocks it is not told to keep", () => {
    const angles = new TurntableAngles(1, 0.5);
    angles.advance(7);
    angles.advance(8);

    angles.keep([8]);

    assert.equal(angles.of(7), 1);
    assert.equal(angles.of(8), 1.5);
  });
});
