// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ClipSampler } from "#src/model/sampling/ClipSampler.ts";
import { KeyCurve } from "#src/model/sampling/KeyCurve.ts";
import {
  clip,
  key
} from "../../helpers/clips.ts";

function sampleAt(
  keys: Parameters<typeof key>[],
  tick: number
): number | undefined {
  return new KeyCurve(keys.map((args) => key(...args))).sample(tick)?.x;
}

describe("KeyCurve", () => {
  test("holds the first and last values outside the keys", () => {
    assert.equal(sampleAt([[100, 1], [200, 3]], 0), 1);
    assert.equal(sampleAt([[100, 1], [200, 3]], 300), 3);
    assert.equal(sampleAt([], 0), undefined);
  });

  test("interpolates with the earlier key's mode", () => {
    assert.equal(sampleAt([[0, 0, "linear"], [100, 10]], 25), 2.5);
    assert.equal(sampleAt([[0, 0, "step"], [100, 10]], 99), 0);
    assert.equal(sampleAt([[0, 0, "smooth"], [100, 10]], 50), 5);
    assert.ok(sampleAt([[0, 0, "smooth"], [100, 10]], 25)! < 2.5);
  });

  test("finds the segment around a tick, and lands on a key at its tick", () => {
    const keys: Parameters<typeof key>[] = [[0, 0], [100, 10, "step"], [200, 20], [300, 40]];

    assert.equal(sampleAt(keys, 100), 10);
    assert.equal(sampleAt(keys, 150), 10);
    assert.equal(sampleAt(keys, 250), 30);
  });

  test("spins past a full turn when keys say so", () => {
    assert.equal(sampleAt([[0, 0], [100, -720]], 50), -360);
  });

  test("rejects keys out of tick order and ignores later edits to its input", () => {
    assert.throws(() => new KeyCurve([key(100, 0), key(100, 1)]), RangeError);

    const value = { x: 10, y: 0, z: 0 };
    const curve = new KeyCurve([key(0, 0), { ...key(100, 0), value }]);
    value.x = 99;
    assert.equal(curve.sample(100)?.x, 10);
  });
});

describe("ClipSampler", () => {
  test("samples each track's keyed channels only, found by path in any case", () => {
    const walk = clip("walk", {
      tracks: [
        { path: "body", position: [key(0, 0), key(100, 4)] },
        { path: "body/arm", rotation: [key(0, 90)], scale: [key(0, 2)] }
      ]
    });
    const samples = new ClipSampler(walk).sample(50);

    assert.deepEqual([...samples], [
      { path: "body", position: { x: 2, y: 0, z: 0 } },
      { path: "body/arm", rotation: { x: 90, y: 0, z: 0 }, scale: { x: 2, y: 0, z: 0 } }
    ]);
    assert.equal(samples.get("Body/ ARM ")?.rotation?.x, 90);
  });
});
