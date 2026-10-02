// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { MouseMask } from "../../../src/devices/mouse/MouseMask.ts";

describe("MouseMask", () => {
  test("combines queued and sampled bits", () => {
    const mask = new MouseMask();

    mask.queue(0b001);
    mask.sample(0b010);
    mask.take("step");

    assert.strictEqual(mask.value, 0b011);
    assert.strictEqual(mask.has(0b001), true);
    assert.strictEqual(mask.has(0b100), false);
  });

  test("each reader takes every sampled bit once", () => {
    const mask = new MouseMask();

    mask.sample(0b001);
    mask.take("step");
    assert.strictEqual(mask.value, 0b001);

    mask.sample(0b010);
    mask.take("step");
    assert.strictEqual(mask.value, 0b010);

    mask.take("frame");
    assert.strictEqual(mask.value, 0b011);

    mask.take("frame");
    assert.strictEqual(mask.value, 0);
  });

  test("reset clears published, queued, and sampled bits", () => {
    const mask = new MouseMask();
    mask.queue(0b001);
    mask.sample(0b010);

    mask.reset();
    mask.take("frame");

    assert.strictEqual(mask.value, 0);
  });
});
