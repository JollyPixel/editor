// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Mixed,
  isMixed,
  type FieldValue
} from "../../src/field/mixed.ts";

describe("Field.Mixed", () => {
  test("is registered globally, so identity survives a duplicate module instance", () => {
    assert.equal(Mixed, Symbol.for("jolly-pixel.ui.mixed"));
    assert.equal(Symbol.keyFor(Mixed), "jolly-pixel.ui.mixed");
  });

  test("is not equal to a same described local symbol", () => {
    assert.notEqual(Mixed, Symbol("jolly-pixel.ui.mixed"));
  });
});

describe("Field.isMixed", () => {
  test("recognises the sentinel", () => {
    assert.equal(isMixed(Mixed), true);
  });

  test("rejects ordinary values, including falsy ones", () => {
    const values: FieldValue<unknown>[] = [0, "", false, null, undefined, Number.NaN, "mixed"];

    for (const value of values) {
      assert.equal(isMixed(value), false, `expected ${String(value)} not to be mixed`);
    }
  });

  test("rejects an unrelated symbol", () => {
    assert.equal(isMixed(Symbol.for("something.else")), false);
  });

  test("narrows the union to the value type", () => {
    const field: FieldValue<number> = 42;

    assert.equal(isMixed(field) ? -1 : field + 1, 43);
  });
});
