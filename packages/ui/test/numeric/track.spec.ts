// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Track } from "../../src/numeric/track.ts";

describe("Numeric.Track", () => {
  test("maps a pointer position onto the range and snaps it to the step", () => {
    const track = new Track(
      { left: 100, width: 200 },
      { step: 0.5, min: -10, max: 10 }
    );

    assert.equal(track.valueAt(100), -10);
    assert.equal(track.valueAt(152), -5);
    assert.equal(track.valueAt(300), 10);
  });

  test("clamps a pointer outside the track to the bounds", () => {
    const track = new Track(
      { left: 0, width: 80 },
      { step: 1, min: 0, max: 8 }
    );

    assert.equal(track.valueAt(-40), 0);
    assert.equal(track.valueAt(120), 8);
  });

  test("spreads the whole range over the track width", () => {
    const track = new Track(
      { left: 0, width: 200 },
      { step: 0.01, min: 0, max: 1 }
    );

    assert.equal(track.pixelsPerStep, 2);
  });

  test("has no position or step size when collapsed", () => {
    const track = new Track(
      { left: 0, width: -4 },
      { step: 1, min: 0, max: 10 }
    );

    assert.equal(track.width, 0);
    assert.equal(track.valueAt(0), undefined);
    assert.equal(track.pixelsPerStep, undefined);
  });

  test("has no step size for an unbounded or empty range", () => {
    for (const bounds of [
      { step: 1, min: 0, max: Number.POSITIVE_INFINITY },
      { step: 1, min: 4, max: 4 },
      { step: 0, min: 0, max: 1 }
    ]) {
      assert.equal(
        new Track({ left: 0, width: 200 }, bounds).pixelsPerStep,
        undefined
      );
    }
  });
});
