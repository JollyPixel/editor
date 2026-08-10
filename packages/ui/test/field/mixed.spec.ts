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
    const values: FieldValue<unknown>[] = [
      0, "", false, null, undefined, Number.NaN, "mixed"
    ];

    for (const value of values) {
      assert.equal(
        isMixed(value),
        false,
        `expected ${String(value)} not to be mixed`
      );
    }
  });

  test("rejects an unrelated symbol", () => {
    assert.equal(isMixed(Symbol.for("something.else")), false);
  });

  test("narrows the union to the value type", () => {
    const field: FieldValue<number> = 42;

    assert.equal(isMixed(field) ? -1 : field + 1, 43);
  });

  /**
   * A type level regression guard. If `Mixed` ever widens back to `symbol`, `FieldValue<number>`
   * becomes `number | symbol` and this assignment stops compiling, which is the only way to catch
   * it: every assertion below still passes at runtime when the types have collapsed.
   */
  test("keeps its distinct type, so FieldValue does not collapse to a bare symbol", () => {
    const sentinel: FieldValue<number> = Mixed;
    const concrete: FieldValue<number> = 7;

    assert.equal(isMixed(sentinel), true);
    assert.equal(isMixed(concrete), false);
  });
});
