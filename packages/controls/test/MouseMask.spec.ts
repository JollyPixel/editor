// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { MouseMask } from "../src/devices/MouseMask.ts";

describe("MouseMask", () => {
  test("combines queued and sampled bits", () => {
    const mask = new MouseMask();

    mask.queue(0b001);
    mask.sample(0b010);

    assert.strictEqual(mask.value, 0b011);
    assert.strictEqual(mask.has(0b001), true);
    assert.strictEqual(mask.has(0b100), false);
  });

  test("restores transitions accumulated across samples", () => {
    const mask = new MouseMask();

    mask.sample(0b001);
    mask.sample(0b010);
    assert.strictEqual(mask.value, 0b010);

    mask.publishFrame();
    assert.strictEqual(mask.value, 0b011);

    mask.publishFrame();
    assert.strictEqual(mask.value, 0);
  });

  test("reset clears published, queued, and accumulated bits", () => {
    const mask = new MouseMask();
    mask.queue(0b001);
    mask.sample(0b010);

    mask.reset();
    mask.publishFrame();

    assert.strictEqual(mask.value, 0);
  });
});
