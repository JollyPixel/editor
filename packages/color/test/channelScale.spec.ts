// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  fromRGBA8,
  toRGBA8
} from "../src/convert/bytes.ts";
import { parseColor } from "../src/parse/index.ts";
import type {
  RGBA,
  RGBA8
} from "../src/types.ts";

/**
 * `RGBA` and `RGBA8` carry the same four keys, so the only thing keeping a
 * unit color out of a byte-scale slot is the brand on each. The
 * `@ts-expect-error` lines below fail the build if that brand ever stops
 * biting; `npm run typecheck` is what actually runs them.
 */
describe("channel scales are not interchangeable", () => {
  test("object literals still assign to either scale", () => {
    const unit: RGBA = {
      r: 1,
      g: 0.4,
      b: 0,
      a: 1
    };
    const byte: RGBA8 = {
      r: 255,
      g: 102,
      b: 0,
      a: 255
    };

    assert.deepEqual(toRGBA8(unit), byte);
    assert.deepEqual(fromRGBA8(byte), unit);
  });

  test("a spread keeps the scale it came from", () => {
    const unit = parseColor("#ff6600")!;
    const faded: RGBA = {
      ...unit,
      a: 0.5
    };

    assert.equal(faded.a, 0.5);
  });

  test("neither scale assigns to the other", () => {
    const unit = parseColor("#ff6600")!;
    const byte = toRGBA8(unit);

    // @ts-expect-error unit channels must not pass as bytes
    const asByte: RGBA8 = unit;
    // @ts-expect-error byte channels must not pass as units
    const asUnit: RGBA = byte;
    // @ts-expect-error a byte color must not be re-divided by 255
    const twice = toRGBA8(byte);

    assert.ok(asByte && asUnit && twice);
  });
});
