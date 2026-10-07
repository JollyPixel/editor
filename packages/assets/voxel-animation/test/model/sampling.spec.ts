// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clipTick,
  sampleChannel,
  sampleClip
} from "#src/model/sampling.ts";
import {
  frameToTick,
  isFrameRate,
  snapToFrame,
  tickToFrame
} from "#src/model/ticks.ts";
import {
  clip,
  key
} from "../helpers/clips.ts";

describe("sampleChannel", () => {
  test("holds the first and last values outside the keys", () => {
    const keys = [key(100, 1), key(200, 3)];

    assert.equal(sampleChannel(keys, 0)?.x, 1);
    assert.equal(sampleChannel(keys, 300)?.x, 3);
    assert.equal(sampleChannel([], 0), undefined);
  });

  test("interpolates with the earlier key's mode", () => {
    assert.equal(sampleChannel([key(0, 0, "linear"), key(100, 10)], 25)?.x, 2.5);
    assert.equal(sampleChannel([key(0, 0, "step"), key(100, 10)], 99)?.x, 0);
    assert.equal(sampleChannel([key(0, 0, "smooth"), key(100, 10)], 50)?.x, 5);
    assert.ok(sampleChannel([key(0, 0, "smooth"), key(100, 10)], 25)!.x < 2.5);
  });

  test("spins past a full turn when keys say so", () => {
    assert.equal(sampleChannel([key(0, 0), key(100, -720)], 50)?.x, -360);
  });
});

describe("sampleClip", () => {
  test("samples each track's keyed channels only", () => {
    const walk = clip("walk", {
      tracks: [
        { path: "body", position: [key(0, 0), key(100, 4)] },
        { path: "body/arm", rotation: [key(0, 90)], scale: [key(0, 2)] }
      ]
    });

    assert.deepEqual(sampleClip(walk, 50), new Map([
      ["body", { position: { x: 2, y: 0, z: 0 } }],
      ["body/arm", { rotation: { x: 90, y: 0, z: 0 }, scale: { x: 2, y: 0, z: 0 } }]
    ]));
  });
});

describe("clipTick", () => {
  test("wraps a loop and holds a one-shot at its ends", () => {
    assert.equal(clipTick({ length: 100, loop: true }, 250), 50);
    assert.equal(clipTick({ length: 100, loop: true }, -10), 90);
    assert.equal(clipTick({ length: 100, loop: false }, 250), 100);
    assert.equal(clipTick({ length: 100, loop: false }, -10), 0);
  });
});

describe("ticks", () => {
  test("keeps the usual frame rates on whole ticks", () => {
    for (const fps of [12, 24, 25, 30, 48, 60]) {
      assert.equal(isFrameRate(fps), true, String(fps));
    }
    assert.equal(isFrameRate(7), false);
    assert.equal(isFrameRate(24.5), false);
    assert.equal(frameToTick(12, 24), 12000);
    assert.equal(tickToFrame(12000, 30), 15);
    assert.equal(snapToFrame(1499, 12), 2000);
    assert.equal(snapToFrame(999, 12), 0);
  });
});
